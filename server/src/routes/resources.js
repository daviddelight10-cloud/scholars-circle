import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/aiRateLimit.js";
import multer from "multer";
import path from "path";
import { uploadFile, deleteFile } from "../lib/supabaseStorage.js";
import { sm2, computeQuality, computeDueDate, updateUniversalStreak } from "../lib/sm2.js";
import { fsrsRate, fsrsNewCard, intervalLabel, stateLabel, isMastered } from "../lib/fsrs.js";

const router = express.Router();

// Memory storage — file buffer sent directly to Supabase, never written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".docx", ".doc", ".txt", ".json"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, TXT, and JSON files are allowed (max 20MB)"));
    }
  },
});

// Helper: Generate unique 6-char share token
async function generateShareToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  let unique = false;

  while (!unique) {
    token = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const existing = await prisma.resource.findUnique({
      where: { shareToken: token },
    });
    if (!existing) unique = true;
  }
  return token;
}

// GET /api/resources - List resources with filters
router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, type, subject, department, level, semester } = req.query;

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { subject: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(type && type !== "all" && { contentType: type }),
      ...(subject && subject !== "all" && { subject }),
      ...(level && level !== "all" && { level }),
      ...(semester && semester !== "all" && { semester }),
      ...(department && department !== "all" && {
        OR: [
          { department },
          { resourceDepts: { some: { department: { name: department } } } },
        ],
      }),
    };

    const resources = await prisma.resource.findMany({
      where: { ...where, status: "approved" },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        _count: { select: { bookmarks: true } },
        resourceDepts: { include: { department: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(resources);
  } catch (error) {
    console.error("Error fetching resources:", error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

// GET /api/resources/teacher/my - Get user's own uploaded resources (MUST be before /:token)
router.get("/teacher/my", requireAuth, async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { uploadedBy: req.user.sub },
      include: { uploader: { select: { id: true, username: true, role: true } }, _count: { select: { bookmarks: true } }, resourceDepts: { include: { department: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(resources);
  } catch (error) {
    console.error("Error fetching teacher resources:", error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

// GET /api/resources/bookmarks - Get current user's bookmarked resources
router.get("/bookmarks", requireAuth, async (req, res) => {
  try {
    const bookmarks = await prisma.resourceBookmark.findMany({
      where: { userId: req.user.sub },
      include: {
        resource: {
          include: {
            uploader: { select: { id: true, username: true, role: true } },
            _count: { select: { bookmarks: true } },
            resourceDepts: { include: { department: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookmarks.map((b) => b.resource));
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

// POST /api/resources/:id/bookmark - Bookmark a resource
router.post("/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const bookmark = await prisma.resourceBookmark.upsert({
      where: { resourceId_userId: { resourceId: id, userId: req.user.sub } },
      create: { resourceId: id, userId: req.user.sub },
      update: {},
    });
    res.status(201).json(bookmark);
  } catch (error) {
    console.error("Error bookmarking resource:", error);
    res.status(500).json({ error: "Failed to bookmark resource" });
  }
});

// DELETE /api/resources/:id/bookmark - Remove bookmark
router.delete("/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.resourceBookmark.deleteMany({
      where: { resourceId: id, userId: req.user.sub },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing bookmark:", error);
    res.status(500).json({ error: "Failed to remove bookmark" });
  }
});

// GET /api/resources/pending - Get all pending resources for teacher/lecturer approval
router.get("/pending", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { status: "pending" },
      include: { uploader: { select: { id: true, username: true, role: true } }, resourceDepts: { include: { department: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(resources);
  } catch (error) {
    console.error("Error fetching pending resources:", error);
    res.status(500).json({ error: "Failed to fetch pending resources" });
  }
});

// PATCH /api/resources/:id/approve - Approve a pending resource
router.patch("/:id/approve", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    const updated = await prisma.resource.update({
      where: { id },
      data: { status: "approved" },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error approving resource:", error);
    res.status(500).json({ error: "Failed to approve resource" });
  }
});

// PATCH /api/resources/:id/reject - Reject a pending resource
router.patch("/:id/reject", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    const updated = await prisma.resource.update({
      where: { id },
      data: { status: "rejected" },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error rejecting resource:", error);
    res.status(500).json({ error: "Failed to reject resource" });
  }
});

// POST /api/quiz-attempts - Submit quiz attempt, award XP, return stats
router.post("/quiz-attempts", requireAuth, async (req, res) => {
  try {
    const { resourceId, score, total, details } = req.body;
    if (!resourceId || score === undefined || total === undefined) {
      return res.status(400).json({ error: "resourceId, score, and total are required" });
    }

    const xpAwarded = score * 20;

    // Check if this is the user's first attempt on this resource
    const existingAttempts = await prisma.quizAttempt.findMany({
      where: { resourceId, userId: req.user.sub },
      select: { id: true },
    });
    const isFirstAttempt = existingAttempts.length === 0;

    // Create attempt record
    const attempt = await prisma.quizAttempt.create({
      data: { resourceId, userId: req.user.sub, score, total, xpAwarded, details: details || null },
    });

    // Increment takenCount on first attempt only
    if (isFirstAttempt) {
      await prisma.resource.update({
        where: { id: resourceId },
        data: { takenCount: { increment: 1 } },
      });
    }

    // Update review queue using SM-2 spaced repetition algorithm
    if (details && Array.isArray(details)) {
      for (const d of details) {
        const quality = computeQuality(d.correct, d.timeSpentMs ?? null);

        // Find existing review item for this question
        const existing = await prisma.reviewQueueItem.findUnique({
          where: { userId_resourceId_questionIndex: { userId: req.user.sub, resourceId, questionIndex: d.questionIndex } },
        }).catch(() => null);

        if (d.correct && quality >= 4 && (!existing || existing.repetitions >= 2)) {
          // High-quality correct answer with enough repetitions — graduate from review queue
          await prisma.reviewQueueItem.deleteMany({
            where: { userId: req.user.sub, resourceId, questionIndex: d.questionIndex },
          }).catch(() => {});
        } else {
          // Apply SM-2 algorithm
          const currentEF = existing?.easinessFactor ?? 2.5;
          const currentReps = existing?.repetitions ?? 0;
          const currentInterval = existing?.intervalDays ?? 0;

          const result = sm2(quality, currentEF, currentReps, currentInterval);
          const dueAt = computeDueDate(result.intervalDays);

          await prisma.reviewQueueItem.upsert({
            where: { userId_resourceId_questionIndex: { userId: req.user.sub, resourceId, questionIndex: d.questionIndex } },
            create: {
              userId: req.user.sub,
              resourceId,
              questionIndex: d.questionIndex,
              dueAt,
              easinessFactor: result.easinessFactor,
              intervalDays: result.intervalDays,
              repetitions: result.repetitions,
              lastReviewed: new Date(),
              quality,
            },
            update: {
              dueAt,
              easinessFactor: result.easinessFactor,
              intervalDays: result.intervalDays,
              repetitions: result.repetitions,
              lastReviewed: new Date(),
              quality,
            },
          }).catch(() => {});
        }
      }
    }

    // Update universal daily streak (synced across the whole app)
    const streakInfo = await updateUniversalStreak(req.user.sub, prisma);

    // Increment user's totalXp
    await prisma.user.update({
      where: { id: req.user.sub },
      data: { totalXp: { increment: xpAwarded } },
    });

    // Compute percentile and rank
    const allAttempts = await prisma.quizAttempt.findMany({
      where: { resourceId },
      select: { score: true, userId: true },
      orderBy: { score: "desc" },
    });

    const totalTakers = allAttempts.length;
    const worseCount = allAttempts.filter((a) => a.score < score).length;
    const percentile = totalTakers > 1 ? Math.round((worseCount / (totalTakers - 1)) * 100) : 100;

    // Find user's rank (1-based, ties share the same rank)
    let rank = 1;
    for (const a of allAttempts) {
      if (a.score > score) rank++;
      else break;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { totalXp: true },
    });

    res.json({
      xpAwarded,
      totalXp: user?.totalXp ?? 0,
      percentile,
      rank,
      totalTakers,
      streak: streakInfo.streak,
      longestStreak: streakInfo.longestStreak,
      streakIsNewDay: streakInfo.isNewDay,
    });
  } catch (error) {
    console.error("Error saving quiz attempt:", error);
    res.status(500).json({ error: "Failed to save quiz attempt" });
  }
});

// GET /api/quiz-attempts/:resourceId/stats - Get quiz stats for a resource
router.get("/quiz-attempts/:resourceId/stats", requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const attempts = await prisma.quizAttempt.findMany({
      where: { resourceId },
      select: { score: true, total: true },
    });
    const totalTakers = attempts.length;
    const avgScore = totalTakers > 0 ? (attempts.reduce((sum, a) => sum + a.score, 0) / totalTakers).toFixed(1) : 0;
    res.json({ totalTakers, avgScore });
  } catch (error) {
    console.error("Error fetching quiz stats:", error);
    res.status(500).json({ error: "Failed to fetch quiz stats" });
  }
});

// GET /api/resources/proxy-pdf?url=... - Proxy file from R2 to avoid CORS issues
router.get("/proxy-pdf", requireAuth, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Only allow proxying from R2 public URL or known storage domains
    const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
    const allowedPrefixes = [
      r2PublicUrl,
      "https://r2.cloudflarestorage.com",
      "https://pub-",
    ].filter(Boolean);

    // Also allow any URL that starts with the R2 public URL domain
    let isAllowed = allowedPrefixes.some((p) => url.startsWith(p));
    if (!isAllowed && r2PublicUrl) {
      try {
        const r2Host = new URL(r2PublicUrl).hostname;
        const urlHost = new URL(url).hostname;
        if (r2Host === urlHost) isAllowed = true;
      } catch {}
    }
    if (!isAllowed) {
      return res.status(403).json({ error: "URL domain not allowed" });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch file from storage" });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(buffer);
  } catch (error) {
    console.error("File proxy error:", error);
    res.status(500).json({ error: "Failed to proxy file" });
  }
});

// GET /api/resources/review-queue - Get current user's due review items (MUST be before /:token)
router.get("/review-queue", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const items = await prisma.reviewQueueItem.findMany({
      where: { userId: req.user.sub },
      include: {
        resource: {
          select: { id: true, title: true, subject: true, mcqData: true, shareToken: true },
        },
      },
      orderBy: { dueAt: "asc" },
    });

    const due = items.filter((item) => new Date(item.dueAt) <= now);
    const upcoming = items.filter((item) => new Date(item.dueAt) > now);

    res.json({
      due: due.map((item) => ({
        id: item.id,
        questionIndex: item.questionIndex,
        dueAt: item.dueAt,
        easinessFactor: item.easinessFactor,
        intervalDays: item.intervalDays,
        repetitions: item.repetitions,
        resource: item.resource,
      })),
      upcoming: upcoming.map((item) => ({
        id: item.id,
        questionIndex: item.questionIndex,
        dueAt: item.dueAt,
        easinessFactor: item.easinessFactor,
        intervalDays: item.intervalDays,
        repetitions: item.repetitions,
        resource: item.resource,
      })),
      total: items.length,
    });
  } catch (error) {
    console.error("Error fetching review queue:", error);
    res.status(500).json({ error: "Failed to fetch review queue" });
  }
});

// DELETE /api/resources/review-queue/:id - Remove a review queue item
router.delete("/review-queue/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.reviewQueueItem.deleteMany({
      where: { id, userId: req.user.sub },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing review queue item:", error);
    res.status(500).json({ error: "Failed to remove review queue item" });
  }
});

// GET /api/resources/review-queue/stats - SM-2 summary stats for the user
router.get("/review-queue/stats", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const items = await prisma.reviewQueueItem.findMany({
      where: { userId: req.user.sub },
      select: { dueAt: true, easinessFactor: true, intervalDays: true, repetitions: true },
    });

    const dueCount = items.filter((i) => new Date(i.dueAt) <= now).length;
    const avgEF = items.length > 0
      ? Math.round((items.reduce((sum, i) => sum + i.easinessFactor, 0) / items.length) * 100) / 100
      : 2.5;
    const masteredCount = items.filter((i) => i.repetitions >= 3 && i.intervalDays >= 21).length;
    const nextDue = items.length > 0
      ? items.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0].dueAt
      : null;

    // Get streak from UserProgress
    const up = await prisma.userProgress.findUnique({
      where: { userId: req.user.sub },
      select: { streak: true, longestStreak: true, lastStudied: true },
    });

    res.json({
      totalItems: items.length,
      dueCount,
      upcomingCount: items.length - dueCount,
      avgEasinessFactor: avgEF,
      masteredCount,
      nextDueAt: nextDue,
      streak: up?.streak ?? 0,
      longestStreak: up?.longestStreak ?? 0,
      lastStudied: up?.lastStudied ?? null,
    });
  } catch (error) {
    console.error("Error fetching review queue stats:", error);
    res.status(500).json({ error: "Failed to fetch review queue stats" });
  }
});


router.get("/progress", requireAuth, async (req, res) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: req.user.sub },
      include: {
        resource: { select: { id: true, subject: true, mcqData: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const subjectStats = {};
    for (const attempt of attempts) {
      const subject = attempt.resource.subject;
      if (!subjectStats[subject]) {
        subjectStats[subject] = { correctSet: new Set(), totalQ: 0 };
      }
      let totalQ = 0;
      if (attempt.resource.mcqData) {
        const mcqData = typeof attempt.resource.mcqData === "string"
          ? JSON.parse(attempt.resource.mcqData)
          : attempt.resource.mcqData;
        if (Array.isArray(mcqData)) totalQ = mcqData.length;
      }
      subjectStats[subject].totalQ = Math.max(subjectStats[subject].totalQ, totalQ);
      if (attempt.details && Array.isArray(attempt.details)) {
        for (const d of attempt.details) {
          if (d.correct) subjectStats[subject].correctSet.add(`${attempt.resourceId}:${d.questionIndex}`);
        }
      }
    }

    const allMcqResources = await prisma.resource.findMany({
      where: { contentType: "mcq", status: "approved" },
      select: { id: true, subject: true, mcqData: true },
    });

    for (const r of allMcqResources) {
      if (!subjectStats[r.subject]) {
        subjectStats[r.subject] = { correctSet: new Set(), totalQ: 0 };
      }
      let totalQ = 0;
      if (r.mcqData) {
        const mcqData = typeof r.mcqData === "string" ? JSON.parse(r.mcqData) : r.mcqData;
        if (Array.isArray(mcqData)) totalQ = mcqData.length;
      }
      subjectStats[r.subject].totalQ += totalQ;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { totalXp: true },
    });

    const subjects = Object.entries(subjectStats).map(([subject, s]) => ({
      subject,
      correct: s.correctSet.size,
      total: s.totalQ,
      masteryPct: s.totalQ > 0 ? Math.round((s.correctSet.size / s.totalQ) * 100) : 0,
    }));

    res.json({
      totalXp: user?.totalXp || 0,
      level: Math.floor((user?.totalXp || 0) / 100) + 1,
      subjects,
    });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// GET /api/resources/:token - Get resource by share token
router.get("/:token", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;

    const resource = await prisma.resource.findUnique({
      where: { shareToken: token },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.json(resource);
  } catch (error) {
    console.error("Error fetching resource by token:", error);
    res.status(500).json({ error: "Failed to fetch resource" });
  }
});

// POST /api/resources/study-tool-save - Save AI-generated study tool (any authenticated user)
// Creates a resource with status "private" (default) or "approved" (if isPublic=true)
// Auto-bookmarks for the creator so it appears in "My Space"
router.post("/study-tool-save", requireAuth, async (req, res) => {
  try {
    const { title, subject, contentType, description, mcqData, fileBuffer, fileName, isPublic } = req.body;

    if (!title || !subject || !contentType) {
      return res.status(400).json({ error: "Title, subject, and content type are required" });
    }

    const shareToken = await generateShareToken();
    const status = isPublic ? "approved" : "private";

    let fileUrl = null;
    let storagePath = null;
    let storedFileName = null;
    let mimeType = null;

    // For PDF type: decode base64 buffer and upload to R2
    if (contentType === "pdf" && fileBuffer) {
      const buffer = Buffer.from(fileBuffer, "base64");
      const result = await uploadFile(buffer, fileName || "study-summary.pdf", "application/pdf");
      fileUrl = result.publicUrl;
      storagePath = result.storagePath;
      storedFileName = fileName || "study-summary.pdf";
      mimeType = "application/pdf";
    }

    // For MCQ type: validate mcqData
    let parsedMcqData = null;
    if (contentType === "mcq") {
      if (!mcqData) {
        return res.status(400).json({ error: "MCQ data is required for MCQ type" });
      }
      parsedMcqData = typeof mcqData === "string" ? JSON.parse(mcqData) : mcqData;
      if (!Array.isArray(parsedMcqData) || parsedMcqData.length === 0) {
        return res.status(400).json({ error: "MCQ data must be a non-empty array" });
      }
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        subject,
        contentType,
        fileUrl,
        storagePath,
        fileName: storedFileName,
        mimeType,
        description: description || null,
        uploadedBy: req.user.sub,
        isPremium: false,
        shareToken,
        mcqData: parsedMcqData,
        status,
      },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });

    // Auto-bookmark for the creator so it appears in "My Space"
    await prisma.resourceBookmark.upsert({
      where: { resourceId_userId: { resourceId: resource.id, userId: req.user.sub } },
      create: { resourceId: resource.id, userId: req.user.sub },
      update: {},
    }).catch(() => {});

    res.status(201).json(resource);
  } catch (error) {
    console.error("Error saving study tool:", error);
    res.status(500).json({ error: error.message || "Failed to save study tool" });
  }
});

// ============ FSRS SPACED REPETITION (PDF) ============

// POST /api/resources/pdf-review/init — Initialize FSRS tracking for a PDF resource
router.post("/pdf-review/init", requireAuth, async (req, res) => {
  try {
    const { resourceId, totalPages } = req.body;
    if (!resourceId) return res.status(400).json({ error: "resourceId is required" });

    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    if (resource.contentType !== "pdf") return res.status(400).json({ error: "FSRS tracking is for PDF resources only" });

    const pages = Math.max(1, Math.min(totalPages || 1, 500));
    let created = 0;

    // Create whole_pdf item if not exists
    const existingWhole = await prisma.pdfReviewItem.findUnique({
      where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId, itemType: "whole_pdf", pageIndex: -1, flashcardId: "none" } },
    }).catch(() => null);

    if (!existingWhole) {
      await prisma.pdfReviewItem.create({
        data: { userId: req.user.sub, resourceId, itemType: "whole_pdf", pageIndex: -1, flashcardId: "none" },
      }).catch(() => {});
      created++;
    }

    // Create per-page items if not exists
    for (let p = 1; p <= pages; p++) {
      const exists = await prisma.pdfReviewItem.findUnique({
        where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId, itemType: "page", pageIndex: p, flashcardId: "none" } },
      }).catch(() => null);
      if (!exists) {
        await prisma.pdfReviewItem.create({
          data: { userId: req.user.sub, resourceId, itemType: "page", pageIndex: p, flashcardId: "none" },
        }).catch(() => {});
        created++;
      }
    }

    res.json({ initialized: true, itemCount: created });
  } catch (error) {
    console.error("Error initializing FSRS tracking:", error);
    res.status(500).json({ error: "Failed to initialize FSRS tracking" });
  }
});

// POST /api/resources/pdf-review/rate — Rate a PDF review item (Again/Hard/Good/Easy)
router.post("/pdf-review/rate", requireAuth, async (req, res) => {
  try {
    const { resourceId, itemType, pageIndex, flashcardId, grade } = req.body;
    if (!resourceId || !itemType || grade === undefined) {
      return res.status(400).json({ error: "resourceId, itemType, and grade are required" });
    }
    const g = Math.max(1, Math.min(4, Math.round(grade)));
    const pIdx = itemType === "page" ? (pageIndex ?? -1) : -1;
    const fId = itemType === "flashcard" ? (flashcardId || "none") : "none";

    const existing = await prisma.pdfReviewItem.findUnique({
      where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId, itemType, pageIndex: pIdx, flashcardId: fId } },
    });

    if (!existing) {
      return res.status(404).json({ error: "Review item not found. Initialize tracking first." });
    }

    const card = {
      state: existing.state,
      stability: existing.stability,
      difficulty: existing.difficulty,
      reps: existing.reps,
      lapses: existing.lapses,
      lastReviewAt: existing.lastReviewAt,
    };

    const result = fsrsRate(card, g);

    await prisma.pdfReviewItem.update({
      where: { id: existing.id },
      data: {
        state: result.state,
        stability: result.stability,
        difficulty: result.difficulty,
        reps: result.reps,
        lapses: result.lapses,
        lastReviewAt: result.lastReviewAt,
        nextReviewAt: result.nextReviewDate,
        dueAt: result.nextReviewDate,
      },
    });

    // Update streak
    const streakInfo = await updateUniversalStreak(req.user.sub, prisma).catch(() => null);

    res.json({
      nextReviewAt: result.nextReviewDate,
      intervalDays: result.intervalDays,
      intervalLabel: intervalLabel(result.intervalDays),
      state: result.state,
      stateLabel: stateLabel(result.state),
      stability: result.stability,
      difficulty: result.difficulty,
      reps: result.reps,
      streak: streakInfo?.streak ?? 0,
    });
  } catch (error) {
    console.error("Error rating PDF review item:", error);
    res.status(500).json({ error: "Failed to rate review item" });
  }
});

// GET /api/resources/pdf-review/due — Get all due FSRS items for the user
router.get("/pdf-review/due", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const items = await prisma.pdfReviewItem.findMany({
      where: { userId: req.user.sub, dueAt: { lte: now } },
      include: {
        resource: { select: { id: true, title: true, subject: true, shareToken: true, fileUrl: true, contentType: true } },
      },
      orderBy: { dueAt: "asc" },
    });

    const wholePdfs = items.filter((i) => i.itemType === "whole_pdf");
    const pages = items.filter((i) => i.itemType === "page");
    const flashcards = items.filter((i) => i.itemType === "flashcard");

    // For flashcards, fetch the flashcard data
    const flashcardIds = flashcards.map((f) => f.flashcardId).filter(Boolean);
    const fcData = await prisma.pdfFlashcard.findMany({
      where: { id: { in: flashcardIds } },
    });
    const fcMap = new Map(fcData.map((f) => [f.id, f]));

    res.json({
      wholePdfs: wholePdfs.map((i) => ({ ...i, resource: i.resource })),
      pages: pages.map((i) => ({ ...i, resource: i.resource })),
      flashcards: flashcards.map((i) => ({ ...i, flashcard: fcMap.get(i.flashcardId) || null, resource: i.resource })),
      totalDue: items.length,
    });
  } catch (error) {
    console.error("Error fetching FSRS due items:", error);
    res.status(500).json({ error: "Failed to fetch due items" });
  }
});

// GET /api/resources/pdf-review/stats — FSRS summary stats
router.get("/pdf-review/stats", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const items = await prisma.pdfReviewItem.findMany({
      where: { userId: req.user.sub },
      select: { state: true, stability: true, dueAt: true, itemType: true, reps: true },
    });

    const dueCount = items.filter((i) => new Date(i.dueAt) <= now).length;
    const learningCount = items.filter((i) => i.state === 1 || i.state === 3).length;
    const masteredCount = items.filter((i) => isMastered(i)).length;
    const newCount = items.filter((i) => i.state === 0).length;
    const reviewCount = items.filter((i) => i.state === 2 && !isMastered(i)).length;

    const nextDue = items.length > 0
      ? items.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0].dueAt
      : null;

    const up = await prisma.userProgress.findUnique({
      where: { userId: req.user.sub },
      select: { streak: true, longestStreak: true, lastStudied: true },
    }).catch(() => null);

    res.json({
      totalItems: items.length,
      dueCount,
      learningCount,
      masteredCount,
      newCount,
      reviewCount,
      nextDueAt: nextDue,
      streak: up?.streak ?? 0,
      longestStreak: up?.longestStreak ?? 0,
    });
  } catch (error) {
    console.error("Error fetching FSRS stats:", error);
    res.status(500).json({ error: "Failed to fetch FSRS stats" });
  }
});

// GET /api/resources/pdf-review/status/:resourceId — Get FSRS status for a specific resource
router.get("/pdf-review/status/:resourceId", requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const items = await prisma.pdfReviewItem.findMany({
      where: { userId: req.user.sub, resourceId },
      orderBy: { itemType: "asc" },
    });

    const wholePdf = items.find((i) => i.itemType === "whole_pdf") || null;
    const pages = items.filter((i) => i.itemType === "page").sort((a, b) => a.pageIndex - b.pageIndex);
    const flashcardItems = items.filter((i) => i.itemType === "flashcard");

    // Fetch flashcard data
    const flashcardIds = flashcardItems.map((f) => f.flashcardId).filter(Boolean);
    const fcData = await prisma.pdfFlashcard.findMany({
      where: { id: { in: flashcardIds } },
    });
    const fcMap = new Map(fcData.map((f) => [f.id, f]));

    const flashcards = flashcardItems.map((i) => ({
      ...i,
      flashcard: fcMap.get(i.flashcardId) || null,
    }));

    const now = new Date();
    const dueCount = items.filter((i) => new Date(i.dueAt) <= now).length;

    res.json({
      wholePdf,
      pages: pages.map((p) => ({
        pageIndex: p.pageIndex,
        state: p.state,
        stability: p.stability,
        difficulty: p.difficulty,
        reps: p.reps,
        lapses: p.lapses,
        dueAt: p.dueAt,
        lastReviewAt: p.lastReviewAt,
        isDue: new Date(p.dueAt) <= now,
        isMastered: isMastered(p),
      })),
      flashcards,
      totalItems: items.length,
      dueCount,
    });
  } catch (error) {
    console.error("Error fetching FSRS status:", error);
    res.status(500).json({ error: "Failed to fetch FSRS status" });
  }
});

// POST /api/resources/pdf-review/flashcards/generate — Generate AI flashcards from PDF text
router.post("/pdf-review/flashcards/generate", requireAuth, aiRateLimit, async (req, res) => {
  try {
    const { resourceId, pages, count } = req.body;
    if (!resourceId || !pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: "resourceId and pages array are required" });
    }

    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    const numCards = Math.max(3, Math.min(30, count || 10));
    const combinedText = pages.map((p) => p.text).join("\n\n").slice(0, 20000);

    // Server-side AI call — use the proxy endpoint directly
    const aiRes = await fetch(`${process.env.API_BASE || "http://localhost:3000"}/ai-proxy/generate-multimodal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.authorization || "",
      },
      body: JSON.stringify({
        prompt: `You are an expert flashcard creator for university students. Generate exactly ${numCards} flashcards from the text below.

FORMAT — return as a JSON array:
[{"front": "question or prompt", "back": "concise answer"}]

Rules:
- Front should be a clear question, definition prompt, or concept name
- Back should be a concise but complete answer (1-3 sentences)
- Cover the most important concepts from the text
- Return ONLY the JSON array, no markdown or explanation

TEXT:
"""
${combinedText}
"""`,
        provider: "openrouter",
        model: "google/gemini-2.5-flash",
      }),
    }).catch(() => null);

    if (!aiRes || !aiRes.ok) {
      return res.status(500).json({ error: "AI generation failed. Please try again." });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.text || "";

    // Parse JSON from AI response
    let flashcards = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      flashcards = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI flashcard response" });
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return res.status(500).json({ error: "AI returned no valid flashcards" });
    }

    // Save flashcards and create FSRS review items
    const created = [];
    for (const fc of flashcards) {
      if (!fc.front || !fc.back) continue;
      const sourcePage = pages[0]?.page || null;
      const flashcard = await prisma.pdfFlashcard.create({
        data: {
          userId: req.user.sub,
          resourceId,
          front: fc.front,
          back: fc.back,
          sourcePage,
        },
      });

      await prisma.pdfReviewItem.create({
        data: {
          userId: req.user.sub,
          resourceId,
          itemType: "flashcard",
          pageIndex: -1,
          flashcardId: flashcard.id,
        },
      }).catch(() => {});

      created.push(flashcard);
    }

    res.status(201).json({ flashcards: created, count: created.length });
  } catch (error) {
    console.error("Error generating flashcards:", error);
    res.status(500).json({ error: "Failed to generate flashcards" });
  }
});

// GET /api/resources/pdf-review/flashcards/:resourceId — Get all flashcards for a resource
router.get("/pdf-review/flashcards/:resourceId", requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const flashcards = await prisma.pdfFlashcard.findMany({
      where: { userId: req.user.sub, resourceId },
      orderBy: { createdAt: "desc" },
    });

    // Also fetch FSRS status for each flashcard
    const reviewItems = await prisma.pdfReviewItem.findMany({
      where: { userId: req.user.sub, resourceId, itemType: "flashcard" },
    });
    const reviewMap = new Map(reviewItems.map((r) => [r.flashcardId, r]));

    const now = new Date();
    const result = flashcards.map((fc) => {
      const review = reviewMap.get(fc.id);
      return {
        ...fc,
        fsrs: review ? {
          state: review.state,
          stability: review.stability,
          difficulty: review.difficulty,
          reps: review.reps,
          lapses: review.lapses,
          dueAt: review.dueAt,
          isDue: new Date(review.dueAt) <= now,
          isMastered: isMastered(review),
        } : null,
      };
    });

    res.json({ flashcards: result });
  } catch (error) {
    console.error("Error fetching flashcards:", error);
    res.status(500).json({ error: "Failed to fetch flashcards" });
  }
});

// POST /api/resources - Create new resource (any authenticated user)
router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { title, subject, contentType, description, isPremium, mcqData, department, level, semester, departmentIds } = req.body;

    if (!title || !subject || !contentType) {
      return res.status(400).json({ error: "Title, subject, and content type are required" });
    }

    // Fetch user's department info for auto-filling if not provided
    const userDept = await prisma.userDepartment.findUnique({
      where: { userId: req.user.sub },
      include: { department: { select: { name: true } } },
    });
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    const isStudent = user?.role === "STUDENT";

    // Auto-fill department/level/semester from user's profile if not provided
    const finalDept = department || userDept?.department?.name || null;
    const levelMap = { 1: "100 Level", 2: "200 Level", 3: "300 Level", 4: "400 Level", 5: "500 Level", 6: "600 Level" };
    const finalLevel = level || (userDept ? levelMap[userDept.yearLevel] || null : null);
    const finalSemester = semester || userDept?.semester || null;

    // Parse departmentIds — can be a JSON array string or repeated form fields
    let parsedDeptIds = [];
    if (departmentIds) {
      if (typeof departmentIds === "string") {
        try { parsedDeptIds = JSON.parse(departmentIds); } catch { parsedDeptIds = [departmentIds]; }
      } else if (Array.isArray(departmentIds)) {
        parsedDeptIds = departmentIds;
      }
    }

    // For MCQ type, mcqData is required instead of file
    if (contentType === "mcq") {
      if (!mcqData) {
        return res.status(400).json({ error: "MCQ data is required for MCQ type" });
      }
      const parsedMcqData = JSON.parse(mcqData);
      if (!Array.isArray(parsedMcqData) || parsedMcqData.length === 0) {
        return res.status(400).json({ error: "MCQ data must be a non-empty array" });
      }
    } else {
      // For non-MCQ types, file is required
      if (!req.file) {
        return res.status(400).json({ error: "File is required for this content type" });
      }
    }

    const shareToken = await generateShareToken();

    // Upload file to Supabase Storage (for non-MCQ types)
    let fileUrl = null;
    let storagePath = null;
    let fileName = null;
    let mimeType = null;

    if (req.file) {
      const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      fileUrl = result.publicUrl;
      storagePath = result.storagePath;
      fileName = req.file.originalname;
      mimeType = req.file.mimetype;
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        subject,
        contentType,
        fileUrl,
        storagePath,
        fileName,
        mimeType,
        description: description || null,
        uploadedBy: req.user.sub,
        isPremium: isPremium === "true",
        shareToken,
        mcqData: contentType === "mcq" ? JSON.parse(mcqData) : null,
        status: isStudent ? "approved" : "pending",
        department: finalDept,
        level: finalLevel,
        semester: finalSemester,
        resourceDepts: parsedDeptIds.length > 0 ? {
          create: parsedDeptIds.map((deptId) => ({ departmentId: deptId })),
        } : undefined,
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        resourceDepts: { include: { department: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json(resource);
  } catch (error) {
    console.error("Error creating resource:", error);
    res.status(500).json({ error: error.message || "Failed to create resource" });
  }
});

// POST /api/resources/:token/view - Log view, enforce free trial, return allowed status
router.post("/:token/view", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.sub;

    const resource = await prisma.resource.findUnique({ where: { shareToken: token } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    // Increment resource view count (always)
    await prisma.resource.update({
      where: { id: resource.id },
      data: { viewCount: { increment: 1 } },
    });

    // Log view record (ignore duplicates)
    prisma.resourceView.create({ data: { resourceId: resource.id, userId: userId || null } }).catch(() => {});

    // Authenticated user — check access based on premium flag
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isActivated: true, freeTrialViews: true, freeTrialLimit: true },
      });

      if (user) {
        // Non-premium resources: unlimited access for everyone
        if (!resource.isPremium) {
          return res.json({ allowed: true, unlimited: true, isPremium: false, freeTrialViews: user.freeTrialViews, freeTrialLimit: user.freeTrialLimit });
        }

        // Premium resources: only activated/paid users get access
        if (user.isActivated) {
          return res.json({ allowed: true, unlimited: true, isPremium: true, freeTrialViews: user.freeTrialViews, freeTrialLimit: user.freeTrialLimit });
        }

        // Non-activated user trying to view premium resource — blocked
        return res.json({ allowed: false, unlimited: false, isPremium: true, freeTrialViews: user.freeTrialViews, freeTrialLimit: user.freeTrialLimit });
      }
    }

    // Guest user — no access to premium, free access to non-premium
    if (!resource.isPremium) {
      return res.json({ allowed: true, unlimited: true, isPremium: false, freeTrialViews: 0, freeTrialLimit: 3 });
    }
    return res.json({ allowed: false, unlimited: false, isPremium: true, freeTrialViews: 0, freeTrialLimit: 3 });
  } catch (error) {
    console.error("Error logging view:", error);
    res.status(500).json({ error: "Failed to log view" });
  }
});

// PATCH /api/resources/:id - Update resource (uploader or teacher/lecturer)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, description, isPremium, department, level, semester, departmentIds } = req.body;

    const resource = await prisma.resource.findUnique({
      where: { id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    const isTeacher = user?.role === "TEACHER" || user?.role === "LECTURER";

    if (resource.uploadedBy !== req.user.sub && !isTeacher) {
      return res.status(403).json({ error: "You can only edit your own resources" });
    }

    // Parse departmentIds if provided
    let parsedDeptIds = null;
    if (departmentIds) {
      if (typeof departmentIds === "string") {
        try { parsedDeptIds = JSON.parse(departmentIds); } catch { parsedDeptIds = [departmentIds]; }
      } else if (Array.isArray(departmentIds)) {
        parsedDeptIds = departmentIds;
      }
    }

    const updated = await prisma.resource.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(subject && { subject }),
        ...(description !== undefined && { description }),
        ...(isPremium !== undefined && { isPremium: isPremium === "true" }),
        ...(department !== undefined && { department }),
        ...(level !== undefined && { level }),
        ...(semester !== undefined && { semester }),
        ...(parsedDeptIds !== null && {
          resourceDepts: {
            deleteMany: {},
            create: parsedDeptIds.map((deptId) => ({ departmentId: deptId })),
          },
        }),
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        resourceDepts: { include: { department: { select: { id: true, name: true } } } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating resource:", error);
    res.status(500).json({ error: "Failed to update resource" });
  }
});

// DELETE /api/resources/:id - Delete resource (uploader or teacher/lecturer)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const resource = await prisma.resource.findUnique({
      where: { id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });

    // Teachers can delete any resource (including student uploads); uploaders can delete their own
    if (resource.uploadedBy !== req.user.sub && user?.role !== "TEACHER" && user?.role !== "LECTURER") {
      return res.status(403).json({ error: "You can only delete your own resources" });
    }

    // Delete file from Supabase Storage
    if (resource.storagePath) {
      await deleteFile(resource.storagePath);
    }

    await prisma.resource.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting resource:", error);
    res.status(500).json({ error: "Failed to delete resource" });
  }
});

// ============ RATINGS ============

// POST /api/resources/:id/rate - Rate a resource (1-5 stars)
router.post("/:id/rate", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { stars } = req.body;
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: "Stars must be between 1 and 5" });
    }

    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    await prisma.resourceRating.upsert({
      where: { resourceId_userId: { resourceId: id, userId: req.user.sub } },
      create: { resourceId: id, userId: req.user.sub, stars: parseInt(stars) },
      update: { stars: parseInt(stars) },
    });

    const ratings = await prisma.resourceRating.aggregate({
      where: { resourceId: id },
      _avg: { stars: true },
      _count: { stars: true },
    });

    await prisma.resource.update({
      where: { id },
      data: {
        avgRating: ratings._avg.stars || 0,
        ratingCount: ratings._count.stars || 0,
      },
    });

    res.json({ avgRating: ratings._avg.stars || 0, ratingCount: ratings._count.stars || 0 });
  } catch (error) {
    console.error("Error rating resource:", error);
    res.status(500).json({ error: "Failed to rate resource" });
  }
});

// ============ COMMENTS ============

// GET /api/resources/:id/comments - List comments for a resource
router.get("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await prisma.resourceComment.findMany({
      where: { resourceId: id },
      include: { user: { select: { id: true, username: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/resources/:id/comments - Add a comment
router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, flagged } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    const comment = await prisma.resourceComment.create({
      data: {
        resourceId: id,
        userId: req.user.sub,
        text: text.trim(),
        flagged: flagged || false,
      },
      include: { user: { select: { id: true, username: true, fullName: true } } },
    });

    if (flagged) {
      await prisma.resource.update({
        where: { id },
        data: { flagCount: { increment: 1 } },
      });
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// POST /api/resources/:id/flag - Flag a resource as outdated/wrong
router.post("/:id/flag", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    if (text && text.trim()) {
      await prisma.resourceComment.create({
        data: {
          resourceId: id,
          userId: req.user.sub,
          text: text.trim(),
          flagged: true,
        },
      });
    }

    await prisma.resource.update({
      where: { id },
      data: { flagCount: { increment: 1 } },
    });

    res.json({ success: true, flagCount: resource.flagCount + 1 });
  } catch (error) {
    console.error("Error flagging resource:", error);
    res.status(500).json({ error: "Failed to flag resource" });
  }
});

export default router;
