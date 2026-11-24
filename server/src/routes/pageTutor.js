// Page Tutor — "Explain This Page". One cached generation per page, shared by
// file content hash. Generation is Premium-only; cache hits are free for every
// authenticated user with access to the file. Audio generates per section in
// the background; the lesson JSON returns immediately.
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { fetchPdfBytes, pageTexts, singlePagePdfBase64, sha256, MAX_PAGE_TEXT } from "../lib/pageTutor/pdfPage.js";
import { generateLesson, PROMPT_VERSION } from "../lib/pageTutor/gemini.js";
import { seedAudioRows, enqueueAudio, resetAudio } from "../lib/pageTutor/audioJob.js";
import { signedUrl, AUDIO_BUCKET } from "../lib/storage.js";

const router = Router();
const LEVEL = "simplify"; // Phase 1 single mode

const PAID_ROLES = new Set(["TEACHER", "LECTURER", "ADMIN"]);
const isPaidUser = (u) => !u || u.isActivated || PAID_ROLES.has(String(u.role || "").toUpperCase());

// The reader is opened through routes that already enforce access; reaching
// here with a valid resourceId means the same link/ownership rules apply.
const canAccessResource = (resource, userId) =>
  !!resource && (resource.uploadedBy === userId || resource.status === "approved" || resource.linkShared);

// Shared-cache access: a lesson may be served when at least one accessible
// resource carries the same content.
async function canAccessLesson(lesson, userId) {
  const r = await prisma.resource.findFirst({
    where: {
      contentHash: lesson.contentHash,
      OR: [{ uploadedBy: userId }, { status: "approved" }, { linkShared: true }],
    },
    select: { id: true },
  });
  return !!r;
}

async function audioPayload(lessonId) {
  const rows = await prisma.pageLessonAudio.findMany({ where: { lessonId }, orderBy: { sectionId: "asc" } });
  const sections = [];
  for (const r of rows) {
    sections.push({
      sectionId: r.sectionId,
      status: r.status,
      durationMs: r.durationMs,
      url: r.status === "ready" ? await signedUrl(r.path, { bucket: AUDIO_BUCKET }) : null,
    });
  }
  return sections;
}

const inflight = new Map(); // cacheKey -> Promise — one generation per page at a time

const lessonPayload = (l, page) => ({
  cached: true, lessonId: l.id, lesson: l.lesson, audioStatus: l.audioStatus,
  generationSource: l.generationSource, page,
});

// POST /api/page-tutor/lesson { resourceId, page, pageImage?, pageText?, regenerate? }
// pageImage: client-rendered JPEG data URL — used ONLY by the GLM fallback
// (Gemini sees the server-built one-page PDF; a forged client image can at
// worst produce a flagged `glm` lesson, regenerable via regenerate:true).
router.post("/lesson", requireAuth, async (req, res) => {
  try {
    const { resourceId, regenerate } = req.body || {};
    const page = Math.max(1, parseInt(req.body?.page, 10) || 0);
    const pageImage = typeof req.body?.pageImage === "string" &&
      /^data:image\/(jpeg|png|webp);base64,/.test(req.body.pageImage) &&
      req.body.pageImage.length < 600_000 ? req.body.pageImage : null;
    const clientPageText = String(req.body?.pageText || "").slice(0, MAX_PAGE_TEXT);
    if (!resourceId || !page) return res.status(400).json({ error: "resourceId and page are required" });

    const resource = await prisma.resource.findUnique({ where: { id: String(resourceId) } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    if (resource.contentType !== "pdf") return res.status(400).json({ error: "Page Tutor works on PDFs" });
    if (!canAccessResource(resource, req.user.sub)) return res.status(403).json({ error: "No access to this resource" });

    // Content hash — lazily backfilled on first explain.
    let contentHash = resource.contentHash;
    let pdfBuf = null;
    if (!contentHash) {
      pdfBuf = await fetchPdfBytes(resource);
      contentHash = sha256(pdfBuf);
      prisma.resource.update({ where: { id: resource.id }, data: { contentHash } }).catch(() => {});
    }

    const existing = await prisma.pageLesson.findUnique({
      where: { contentHash_page_level_promptVersion: { contentHash, page, level: LEVEL, promptVersion: PROMPT_VERSION } },
    });
    // Regenerate = redo a glm-produced lesson with the real engine. Falls
    // through to fresh generation below; on failure the glm lesson is served.
    const regenTarget = !!(regenerate && existing && !existing.hidden && existing.generationSource !== "gemini");
    if (existing && !existing.hidden && !regenTarget) {
      return res.json(lessonPayload(existing, page));
    }
    if (existing?.hidden) return res.status(410).json({ error: "This lesson was taken down after error reports" });

    // Fresh generation — Premium only. Cache hits above are free.
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { isActivated: true, role: true } });
    if (!isPaidUser(user)) {
      return res.status(403).json({ error: "Explaining new pages is a Premium feature. Lessons other students already generated are free.", code: "premium_required" });
    }

    const cacheKey = `${contentHash}:${page}:${LEVEL}:${PROMPT_VERSION}`;
    let promise = inflight.get(cacheKey);
    if (!promise || regenTarget) {
      promise = (async () => {
        if (!pdfBuf) pdfBuf = await fetchPdfBytes(resource);
        const onePage = await singlePagePdfBase64(pdfBuf, page).catch(() => null);
        // Parse only the single page (not the whole document) — keeps pdf.js
        // font warnings to one line per generation instead of one per page,
        // and avoids O(n) parsing on every explain call.
        let pageText = "";
        if (onePage) {
          const single = Buffer.from(onePage.base64, "base64");
          pageText = ((await pageTexts(single, `${resource.id}:${page}`).catch(() => []))[0] || "").slice(0, MAX_PAGE_TEXT);
        }
        // Scanned pages: server extraction is empty — client OCR text fills in.
        if (!pageText && clientPageText) pageText = clientPageText;
        if (!onePage && !pageText) throw new Error(`page ${page} unreadable`);
        const r = await generateLesson({
          pdfBase64: onePage?.base64 || null, pageText, page,
          resourceTitle: resource.title, pageImage, allowFallback: !regenTarget,
        });
        if (!r.ok) {
          if (r.lessonFailedSchema && r.rawText) return { fallback: r.rawText, source: r.source || "gemini" };
          throw new Error(r.error || "generation failed");
        }
        return { lesson: r.lesson, grounded: r.grounded, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model, source: r.source };
      })().finally(() => { if (!regenTarget) inflight.delete(cacheKey); });
      if (!regenTarget) inflight.set(cacheKey, promise);
    }

    let result;
    try { result = await promise; } catch (err) {
      console.error(`[pageTutor] generation failed ${cacheKey}:`, err.message);
      // Regen failed — the flagged lesson is still better than an error.
      if (regenTarget && existing) {
        return res.json({ ...lessonPayload(existing, page), regenFailed: true });
      }
      return res.status(502).json({ error: "Could not explain this page right now — try again shortly" });
    }

    let lessonData;
    if (result.fallback) {
      lessonData = {
        page_title: `Page ${page}`,
        sections: [{ id: "s1", heading: "Explanation", explanation: result.fallback.slice(0, 4000), narration: "", terms: [], anchor_quote: "", source: "added_context", unclear: false }],
        key_points: [], clinical_note: null, recall: [],
      };
    } else {
      lessonData = result.lesson;
    }

    if (regenTarget && existing) {
      // Replace the glm lesson in place — same cache row, upgraded source.
      const upgraded = await prisma.pageLesson.update({
        where: { id: existing.id },
        data: {
          status: result.fallback ? "text_only" : "ready",
          lesson: lessonData,
          audioStatus: result.fallback ? "skipped" : "pending",
          generationSource: result.source || "gemini",
          model: result.model || null, tokensIn: result.tokensIn || 0, tokensOut: result.tokensOut || 0,
          regenerations: { increment: 1 },
        },
      });
      if (!result.fallback) {
        await resetAudio(upgraded.id, lessonData.sections);
        enqueueAudio(upgraded.id);
      }
      prisma.pageLessonEvent.create({ data: { userId: req.user.sub, lessonId: upgraded.id, kind: "regenerate" } }).catch(() => {});
      console.log(`[pageTutor] regenerated ${cacheKey} via ${result.source}`);
      return res.status(201).json({ cached: false, regenerated: true, lessonId: upgraded.id, lesson: lessonData, audioStatus: upgraded.audioStatus, generationSource: upgraded.generationSource, page });
    }

    let lesson;
    try {
      lesson = await prisma.pageLesson.create({
        data: {
          contentHash, resourceId: resource.id, page, level: LEVEL, promptVersion: PROMPT_VERSION,
          status: result.fallback ? "text_only" : "ready",
          lesson: lessonData,
          audioStatus: result.fallback ? "skipped" : "pending",
          generationSource: result.source || "gemini",
          model: result.model || null, tokensIn: result.tokensIn || 0, tokensOut: result.tokensOut || 0,
        },
      });
    } catch (e) {
      if (e.code === "P2002") { // lost a concurrent race — serve the winner's row
        lesson = await prisma.pageLesson.findUnique({
          where: { contentHash_page_level_promptVersion: { contentHash, page, level: LEVEL, promptVersion: PROMPT_VERSION } },
        });
        if (lesson) return res.json(lessonPayload(lesson, page));
      }
      throw e;
    }

    if (!result.fallback) {
      await seedAudioRows(lesson.id, lessonData.sections);
      enqueueAudio(lesson.id);
    }
    if (result.source && result.source !== "gemini") {
      prisma.pageLessonEvent.create({ data: { userId: req.user.sub, lessonId: lesson.id, kind: "fallback_glm" } }).catch(() => {});
    }
    console.log(`[pageTutor] generated ${cacheKey} via ${result.source} in ${result.tokensIn || 0}+${result.tokensOut || 0} tok (grounded ${result.grounded?.grounded ?? "-"}, demoted ${result.grounded?.demoted ?? "-"})`);
    res.status(201).json({ cached: false, lessonId: lesson.id, lesson: lessonData, audioStatus: lesson.audioStatus, generationSource: lesson.generationSource, page });
  } catch (err) {
    console.error("[pageTutor] lesson error:", err);
    res.status(500).json({ error: "Failed to load the lesson" });
  }
});

// GET /api/page-tutor/lessons?resourceId= — pages with a shared-cached lesson.
// Powers the thumbnail dots (students can see which pages are already free).
router.get("/lessons", requireAuth, async (req, res) => {
  try {
    const resource = await prisma.resource.findUnique({ where: { id: String(req.query.resourceId || "") } });
    if (!resource || !canAccessResource(resource, req.user.sub)) return res.status(403).json({ error: "No access" });
    if (!resource.contentHash) return res.json({ pages: [] });
    const rows = await prisma.pageLesson.findMany({
      where: { contentHash: resource.contentHash, level: LEVEL, promptVersion: PROMPT_VERSION, hidden: false },
      select: { page: true },
    });
    res.json({ pages: rows.map((r) => r.page) });
  } catch {
    res.status(500).json({ error: "Failed to load lessons" });
  }
});

// GET /api/page-tutor/audio/:lessonId — polled until audioStatus settles.
router.get("/audio/:lessonId", requireAuth, async (req, res) => {
  try {
    const lesson = await prisma.pageLesson.findUnique({ where: { id: req.params.lessonId } });
    if (!lesson || lesson.hidden) return res.status(404).json({ error: "Lesson not found" });
    if (!(await canAccessLesson(lesson, req.user.sub))) return res.status(403).json({ error: "No access" });
    const sections = await audioPayload(lesson.id);
    res.json({ audioStatus: lesson.audioStatus, sections });
  } catch (err) {
    res.status(500).json({ error: "Failed to load audio" });
  }
});

// POST /api/page-tutor/lesson/:id/retry-audio — regenerate failed/missing audio.
router.post("/lesson/:id/retry-audio", requireAuth, async (req, res) => {
  try {
    const lesson = await prisma.pageLesson.findUnique({ where: { id: req.params.id } });
    if (!lesson || lesson.hidden) return res.status(404).json({ error: "Lesson not found" });
    if (!(await canAccessLesson(lesson, req.user.sub))) return res.status(403).json({ error: "No access" });
    if (lesson.audioStatus === "skipped") return res.status(400).json({ error: "This lesson has no narration" });
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { isActivated: true, role: true } });
    if (!isPaidUser(user)) return res.status(403).json({ error: "Premium feature", code: "premium_required" });
    await resetAudio(lesson.id, lesson.lesson?.sections || []);
    await prisma.pageLesson.update({ where: { id: lesson.id }, data: { audioStatus: "pending" } });
    enqueueAudio(lesson.id);
    res.json({ audioStatus: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Retry failed" });
  }
});

// POST /api/page-tutor/lesson/:id/flashcards { resourceId } — recall -> FSRS.
router.post("/lesson/:id/flashcards", requireAuth, async (req, res) => {
  try {
    const lesson = await prisma.pageLesson.findUnique({ where: { id: req.params.id } });
    if (!lesson || lesson.hidden) return res.status(404).json({ error: "Lesson not found" });
    const resourceId = String(req.body?.resourceId || lesson.resourceId || "");
    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource || !canAccessResource(resource, req.user.sub)) return res.status(403).json({ error: "No access to this resource" });

    const recall = Array.isArray(lesson.lesson?.recall) ? lesson.lesson.recall : [];
    if (!recall.length) return res.status(400).json({ error: "This lesson has no recall questions" });

    const existing = await prisma.pdfFlashcard.findMany({
      where: { userId: req.user.sub, resourceId: resource.id },
      select: { front: true },
    });
    const have = new Set(existing.map((f) => f.front.trim().toLowerCase()));
    let created = 0;
    for (const r of recall) {
      const front = String(r.question || "").trim();
      const back = String(r.answer || "").trim();
      if (!front || !back || have.has(front.toLowerCase())) continue;
      const card = await prisma.pdfFlashcard.create({
        data: { userId: req.user.sub, resourceId: resource.id, front, back, sourcePage: lesson.page },
      });
      await prisma.pdfReviewItem.create({
        data: { userId: req.user.sub, resourceId: resource.id, itemType: "flashcard", pageIndex: -1, flashcardId: card.id, topic: resource.title, subject: resource.subject },
      }).catch(() => {});
      created += 1;
    }
    prisma.pageLessonEvent.create({ data: { userId: req.user.sub, lessonId: lesson.id, kind: "flashcards_saved" } }).catch(() => {});
    res.status(201).json({ created, total: recall.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to save flashcards" });
  }
});

// POST /api/page-tutor/lesson/:id/report { reason?, note? } — review queue;
// lessons with repeat reports auto-hide until regenerated.
router.post("/lesson/:id/report", requireAuth, async (req, res) => {
  try {
    const lesson = await prisma.pageLesson.findUnique({ where: { id: req.params.id } });
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    const reason = ["errors", "outdated", "inappropriate", "other"].includes(req.body?.reason) ? req.body.reason : "errors";
    const note = String(req.body?.note || "").slice(0, 500);
    await prisma.report.upsert({
      where: { reporterId_targetType_targetId: { reporterId: req.user.sub, targetType: "pageLesson", targetId: lesson.id } },
      create: { reporterId: req.user.sub, targetType: "pageLesson", targetId: lesson.id, reason, note },
      update: { reason, note },
    });
    const count = await prisma.report.count({ where: { targetType: "pageLesson", targetId: lesson.id } });
    const hidden = count >= 3;
    await prisma.pageLesson.update({
      where: { id: lesson.id },
      data: { reportCount: count, ...(hidden && !lesson.hidden ? { hidden: true, status: "hidden" } : {}) },
    });
    prisma.pageLessonEvent.create({ data: { userId: req.user.sub, lessonId: lesson.id, kind: "report" } }).catch(() => {});
    if (hidden) console.warn(`[pageTutor] lesson ${lesson.id} auto-hidden after ${count} reports`);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to send report" });
  }
});

const EVENT_KINDS = new Set(["open", "audio_finish", "recall_answer", "section_play", "ask_voice", "explain_page", "fallback_glm", "tts_speech", "regenerate"]);

// POST /api/page-tutor/lesson/:id/event { kind } — day-one metrics.
router.post("/lesson/:id/event", requireAuth, async (req, res) => {
  const kind = String(req.body?.kind || "");
  if (!EVENT_KINDS.has(kind)) return res.status(400).json({ error: "bad kind" });
  try {
    await prisma.pageLessonEvent.create({ data: { userId: req.user.sub, lessonId: String(req.params.id), kind } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "failed" });
  }
});

export default router;
