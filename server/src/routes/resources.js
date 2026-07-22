import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/aiRateLimit.js";
import multer from "multer";
import path from "path";
import { uploadFile, deleteFile } from "../lib/supabaseStorage.js";
import { sm2, computeQuality, computeDueDate, updateUniversalStreak } from "../lib/sm2.js";
import { fsrsRate, fsrsNewCard, intervalLabel, stateLabel, isMastered } from "../lib/fsrs.js";
import { pptxToPdf } from "../lib/pptxToPdf.js";

const router = express.Router();

// Memory storage — file buffer sent directly to Supabase, never written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".docx", ".doc", ".txt", ".json", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".pptx"];
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "text/plain",
      "application/json",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/bmp",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, PPTX, TXT, JSON, and image files are allowed (max 50MB)"));
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
      where: {
        AND: [
          where,
          {
            OR: [
              { status: "approved" },
              { uploadedBy: req.user.sub, status: "rejected" },
            ],
          },
        ],
      },
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
      include: { uploader: { select: { id: true, username: true, role: true } }, university: { select: { id: true, name: true, type: true } }, _count: { select: { bookmarks: true } }, resourceDepts: { include: { department: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(resources);
  } catch (error) {
    console.error("Error fetching teacher resources:", error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

// GET /api/resources/bookmarks - Get current user's bookmarked resources (with folderId)
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
    res.json(bookmarks.map((b) => ({ ...b.resource, bookmarkFolderId: b.folderId })));
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

// POST /api/resources/:id/bookmark - Bookmark a resource (optionally into a folder)
router.post("/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;

    // If folderId provided, verify the user owns or has access to that folder
    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      if (folder.ownerId !== req.user.sub && folder.visibility !== "link") {
        return res.status(403).json({ error: "You don't have access to this folder" });
      }
    }

    const bookmark = await prisma.resourceBookmark.upsert({
      where: { resourceId_userId: { resourceId: id, userId: req.user.sub } },
      create: { resourceId: id, userId: req.user.sub, folderId: folderId || null },
      update: { folderId: folderId || null },
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

// GET /api/resources/all - Get ALL resources (teacher/lecturer only)
router.get("/all", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        university: { select: { id: true, name: true, type: true } },
        resourceDepts: { include: { department: { select: { id: true, name: true } } } },
        _count: { select: { bookmarks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(resources);
  } catch (error) {
    console.error("Error fetching all resources:", error);
    res.status(500).json({ error: "Failed to fetch all resources" });
  }
});

// GET /api/resources/pending - Get all pending resources for teacher/lecturer approval
router.get("/pending", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { status: "pending" },
      include: { uploader: { select: { id: true, username: true, role: true } }, university: { select: { id: true, name: true, type: true } }, resourceDepts: { include: { department: { select: { id: true, name: true } } } } },
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
    const { resourceId, score, total, details, mode } = req.body;
    if (!resourceId || score === undefined || total === undefined) {
      return res.status(400).json({ error: "resourceId, score, and total are required" });
    }

    const attemptMode = mode === "exam" ? "exam" : "practice";

    // Check if this is the user's first attempt on this resource
    const existingAttempts = await prisma.quizAttempt.findMany({
      where: { resourceId, userId: req.user.sub },
      select: { id: true },
    });
    const isFirstAttempt = existingAttempts.length === 0;

    // Gate XP to first attempt only (prevents farming); 10 XP per correct — matches session rate
    const xpAwarded = isFirstAttempt ? score * 10 : 0;

    // Create attempt record
    const attempt = await prisma.quizAttempt.create({
      data: { resourceId, userId: req.user.sub, score, total, xpAwarded, mode: attemptMode, details: details || null },
    });

    // Increment takenCount on first attempt only
    if (isFirstAttempt) {
      await prisma.resource.update({
        where: { id: resourceId },
        data: { takenCount: { increment: 1 } },
      });
    }

    // Update FSRS spaced repetition for each MCQ question
    if (details && Array.isArray(details)) {
      const now = new Date();
      for (const d of details) {
        // Map quiz result to FSRS grade (1=Again, 2=Hard, 3=Good, 4=Easy)
        const grade = d.correct ? (d.timeSpentMs && d.timeSpentMs < 5000 ? 4 : 3) : 1;

        const existing = await prisma.pdfReviewItem.findUnique({
          where: {
            userId_resourceId_itemType_pageIndex_flashcardId: {
              userId: req.user.sub,
              resourceId,
              itemType: "mcq",
              pageIndex: d.questionIndex,
              flashcardId: "none",
            },
          },
        }).catch(() => null);

        const card = existing
          ? {
              state: existing.state,
              stability: existing.stability,
              difficulty: existing.difficulty,
              reps: existing.reps,
              lapses: existing.lapses,
              lastReviewAt: existing.lastReviewAt,
            }
          : fsrsNewCard();

        const result = fsrsRate(card, grade, now);

        await prisma.pdfReviewItem.upsert({
          where: {
            userId_resourceId_itemType_pageIndex_flashcardId: {
              userId: req.user.sub,
              resourceId,
              itemType: "mcq",
              pageIndex: d.questionIndex,
              flashcardId: "none",
            },
          },
          create: {
            userId: req.user.sub,
            resourceId,
            itemType: "mcq",
            pageIndex: d.questionIndex,
            flashcardId: "none",
            state: result.state,
            stability: result.stability,
            difficulty: result.difficulty,
            reps: result.reps,
            lapses: result.lapses,
            lastReviewAt: result.lastReviewAt,
            nextReviewAt: result.nextReviewDate,
            dueAt: result.nextReviewDate,
          },
          update: {
            state: result.state,
            stability: result.stability,
            difficulty: result.difficulty,
            reps: result.reps,
            lapses: result.lapses,
            lastReviewAt: result.lastReviewAt,
            nextReviewAt: result.nextReviewDate,
            dueAt: result.nextReviewDate,
          },
        }).catch(() => {});
      }
    }

    // Update universal daily streak (synced across the whole app)
    const streakInfo = await updateUniversalStreak(req.user.sub, prisma);

    // Write XP to both ledgers on first attempt so totalXp and userProgress.xp stay in sync
    if (xpAwarded > 0) {
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { totalXp: { increment: xpAwarded } },
      });
      await prisma.userProgress.upsert({
        where: { userId: req.user.sub },
        create: { userId: req.user.sub, xp: xpAwarded },
        update: { xp: { increment: xpAwarded } },
      }).catch(() => {});
    }

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


// GET /api/resources/my-mcq-progress — Per-resource MCQ attempt progress for the current user
router.get("/my-mcq-progress", requireAuth, async (req, res) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: req.user.sub },
      select: { resourceId: true, score: true, total: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const progress = {};
    for (const a of attempts) {
      if (!progress[a.resourceId]) {
        progress[a.resourceId] = {
          bestScore: a.score,
          total: a.total,
          attempts: 1,
          lastAttemptedAt: a.createdAt,
        };
      } else {
        progress[a.resourceId].attempts += 1;
        if (a.score > progress[a.resourceId].bestScore) {
          progress[a.resourceId].bestScore = a.score;
        }
        if (a.createdAt > progress[a.resourceId].lastAttemptedAt) {
          progress[a.resourceId].lastAttemptedAt = a.createdAt;
        }
      }
    }

    res.json(progress);
  } catch (error) {
    console.error("Error fetching MCQ progress:", error);
    res.status(500).json({ error: "Failed to fetch MCQ progress" });
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
// Uses optionalAuth so guests can load metadata and see the login overlay
router.get("/:token", optionalAuth, async (req, res) => {
  try {
    const { token } = req.params;

    const resource = await prisma.resource.findUnique({
      where: { shareToken: token },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Unauthenticated guests get safe metadata only — fileUrl/mcqData withheld
    // The frontend shows its login/signup overlay for the actual content
    if (!req.user) {
      const { fileUrl, storagePath, mcqData, ...safe } = resource;
      return res.json({ ...safe, _requiresAuth: true });
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
    const { title, subject, contentType, description, mcqData, flashcardData, fileBuffer, fileName, isPublic, folderId } = req.body;

    if (!title || !contentType) {
      return res.status(400).json({ error: "Title and content type are required" });
    }

    const finalSubject = subject || "";

    // If folderId is provided, fetch folder for metadata inheritance
    let folder = null;
    let folderDeptIds = [];
    if (folderId) {
      folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { folderDepts: { select: { departmentId: true } } },
      });
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      folderDeptIds = folder.folderDepts.map((fd) => fd.departmentId);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    const isStudent = user?.role === "STUDENT";

    const shareToken = await generateShareToken();
    // If saving into a shared folder, status follows uploader role (pending for students)
    // Otherwise respect isPublic flag
    let status;
    if (folderId) {
      status = "approved";
    } else {
      status = isPublic ? "approved" : "private";
    }

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

    // For flashcard_deck type: validate flashcardData
    let parsedFlashcardData = null;
    if (contentType === "flashcard_deck") {
      if (!flashcardData) {
        return res.status(400).json({ error: "Flashcard data is required for flashcard_deck type" });
      }
      parsedFlashcardData = typeof flashcardData === "string" ? JSON.parse(flashcardData) : flashcardData;
      if (!Array.isArray(parsedFlashcardData) || parsedFlashcardData.length === 0) {
        return res.status(400).json({ error: "Flashcard data must be a non-empty array of {front, back} objects" });
      }
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        subject: folder?.courseCode || finalSubject,
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
        flashcardData: parsedFlashcardData,
        status,
        folderId: folderId || null,
        resourceDepts: folderDeptIds.length > 0 ? {
          create: folderDeptIds.map((deptId) => ({ departmentId: deptId })),
        } : undefined,
      },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });

    // Seed FSRS PdfReviewItems for each flashcard in a flashcard_deck
    if (contentType === "flashcard_deck" && parsedFlashcardData) {
      const now = new Date();
      await prisma.pdfReviewItem.createMany({
        data: parsedFlashcardData.map((_, idx) => ({
          userId: req.user.sub,
          resourceId: resource.id,
          itemType: "flashcard",
          pageIndex: -1,
          flashcardId: `deck_${idx}`,
          state: 0,
          stability: 0,
          difficulty: 0,
          reps: 0,
          lapses: 0,
          dueAt: now,
        })),
      }).catch(() => {});
    }

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

// ============ FSRS SPACED REPETITION (Unified) ============

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserFsrsWeights(userId) {
  const profile = await prisma.userFsrsProfile.findUnique({ where: { userId } }).catch(() => null);
  if (profile?.weights && Array.isArray(profile.weights) && profile.weights.length === 18) {
    return { weights: profile.weights, targetRetention: profile.targetRetention || 0.9, dailyGoal: profile.dailyGoal || 20 };
  }
  return { weights: null, targetRetention: 0.9, dailyGoal: 20 };
}

// ── POST /api/resources/fsrs/init — Initialize FSRS tracking for any resource ──
router.post("/fsrs/init", requireAuth, async (req, res) => {
  try {
    const { resourceId, totalPages, topic, subject } = req.body;
    if (!resourceId) return res.status(400).json({ error: "resourceId is required" });

    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    const subj = subject || resource.subject || null;
    const top = topic || resource.title || null;
    let created = 0;

    // Create whole_pdf item
    const existingWhole = await prisma.pdfReviewItem.findUnique({
      where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId, itemType: "whole_pdf", pageIndex: -1, flashcardId: "none" } },
    }).catch(() => null);
    if (!existingWhole) {
      await prisma.pdfReviewItem.create({
        data: { userId: req.user.sub, resourceId, itemType: "whole_pdf", pageIndex: -1, flashcardId: "none", topic: top, subject: subj },
      }).catch(() => {});
      created++;
    }

    // Create per-page items for PDFs
    if (resource.contentType === "pdf" && totalPages) {
      const pages = Math.max(1, Math.min(totalPages || 1, 500));
      for (let p = 1; p <= pages; p++) {
        const exists = await prisma.pdfReviewItem.findUnique({
          where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId, itemType: "page", pageIndex: p, flashcardId: "none" } },
        }).catch(() => null);
        if (!exists) {
          await prisma.pdfReviewItem.create({
            data: { userId: req.user.sub, resourceId, itemType: "page", pageIndex: p, flashcardId: "none", topic: top, subject: subj },
          }).catch(() => {});
          created++;
        }
      }
    }

    // Create MCQ items for MCQ resources
    if (resource.contentType === "mcq" && resource.mcqData) {
      const mcqData = typeof resource.mcqData === "string" ? JSON.parse(resource.mcqData) : resource.mcqData;
      if (Array.isArray(mcqData)) {
        for (let i = 0; i < mcqData.length; i++) {
          const exists = await prisma.pdfReviewItem.findUnique({
            where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId, itemType: "mcq", pageIndex: i, flashcardId: "none" } },
          }).catch(() => null);
          if (!exists) {
            await prisma.pdfReviewItem.create({
              data: { userId: req.user.sub, resourceId, itemType: "mcq", pageIndex: i, flashcardId: "none", topic: top, subject: subj },
            }).catch(() => {});
            created++;
          }
        }
      }
    }

    res.json({ initialized: true, itemCount: created });
  } catch (error) {
    console.error("Error initializing FSRS tracking:", error);
    res.status(500).json({ error: "Failed to initialize FSRS tracking" });
  }
});

// ── POST /api/resources/fsrs/rate — Rate any review item ──
router.post("/fsrs/rate", requireAuth, async (req, res) => {
  try {
    const { resourceId, itemType, pageIndex, flashcardId, grade, topic, subject } = req.body;
    if (!resourceId || !itemType || grade === undefined) {
      return res.status(400).json({ error: "resourceId, itemType, and grade are required" });
    }
    const g = Math.max(1, Math.min(4, Math.round(grade)));
    const pIdx = (itemType === "page" || itemType === "mcq" || itemType === "legacy_mcq") ? (pageIndex ?? -1) : -1;
    const fId = itemType === "flashcard" ? (flashcardId || "none") : "none";

    const existing = await prisma.pdfReviewItem.findUnique({
      where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId, itemType, pageIndex: pIdx, flashcardId: fId } },
    });

    let item;
    if (!existing) {
      // Auto-create if not exists
      const resource = await prisma.resource.findUnique({ where: { id: resourceId }, select: { subject: true, title: true } }).catch(() => null);
      item = await prisma.pdfReviewItem.create({
        data: {
          userId: req.user.sub, resourceId, itemType, pageIndex: pIdx, flashcardId: fId,
          topic: topic || resource?.title || null,
          subject: subject || resource?.subject || null,
        },
      });
    } else {
      item = existing;
    }

    const card = {
      state: item.state,
      stability: item.stability,
      difficulty: item.difficulty,
      reps: item.reps,
      lapses: item.lapses,
      lastReviewAt: item.lastReviewAt,
    };

    const { weights } = await getUserFsrsWeights(req.user.sub);
    const result = fsrsRate(card, g, new Date(), weights || undefined);

    await prisma.pdfReviewItem.update({
      where: { id: item.id },
      data: {
        state: result.state,
        stability: result.stability,
        difficulty: result.difficulty,
        reps: result.reps,
        lapses: result.lapses,
        lastReviewAt: result.lastReviewAt,
        nextReviewAt: result.nextReviewDate,
        dueAt: result.nextReviewDate,
        topic: topic || item.topic || undefined,
        subject: subject || item.subject || undefined,
      },
    });

    // Increment review count for weight optimization
    await prisma.userFsrsProfile.upsert({
      where: { userId: req.user.sub },
      create: { userId: req.user.sub, totalReviews: 1 },
      update: { totalReviews: { increment: 1 } },
    }).catch(() => {});

    const streakInfo = await updateUniversalStreak(req.user.sub, prisma).catch(() => null);

    // Award XP for correct answers (grade >= 3): 10 XP per correct, same as session rate
    const xpAwarded = g >= 3 ? 10 : 0;
    if (xpAwarded > 0) {
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { totalXp: { increment: xpAwarded } },
      }).catch(() => {});
      await prisma.userProgress.upsert({
        where: { userId: req.user.sub },
        create: { userId: req.user.sub, xp: xpAwarded },
        update: { xp: { increment: xpAwarded } },
      }).catch(() => {});
    }

    res.json({
      nextReviewAt: result.nextReviewDate,
      intervalDays: result.intervalDays,
      intervalLabel: intervalLabel(result.intervalDays),
      state: result.state,
      stateLabel: stateLabel(result.state),
      stability: result.stability,
      difficulty: result.difficulty,
      reps: result.reps,
      retrievability: result.retrievability,
      streak: streakInfo?.streak ?? 0,
      longestStreak: streakInfo?.longestStreak ?? 0,
      xpAwarded,
    });
  } catch (error) {
    console.error("Error rating review item:", error);
    res.status(500).json({ error: "Failed to rate review item" });
  }
});

// ── GET /api/resources/fsrs/due — All due items, interleaved ──
router.get("/fsrs/due", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 50));
    const subjectFilter = req.query.subject || null;

    const where = { userId: req.user.sub, dueAt: { lte: now } };
    if (subjectFilter) where.subject = subjectFilter;

    const items = await prisma.pdfReviewItem.findMany({
      where,
      include: {
        resource: { select: { id: true, title: true, subject: true, shareToken: true, fileUrl: true, contentType: true, mcqData: true } },
      },
      orderBy: [{ lapses: "desc" }, { dueAt: "asc" }],
      take: limit,
    });

    // Interleave: sort by priority (lapsed first, then by due date), then rotate item types
    const priorityOrder = { whole_pdf: 0, page: 1, mcq: 2, legacy_mcq: 2, flashcard: 3 };
    items.sort((a, b) => {
      const pa = (a.lapses > 0 ? 0 : 1);
      const pb = (b.lapses > 0 ? 0 : 1);
      if (pa !== pb) return pa - pb;
      return new Date(a.dueAt) - new Date(b.dueAt);
    });

    // Fetch flashcard data
    const flashcardIds = items.filter((i) => i.itemType === "flashcard").map((f) => f.flashcardId).filter(Boolean);
    const fcData = await prisma.pdfFlashcard.findMany({ where: { id: { in: flashcardIds } } });
    const fcMap = new Map(fcData.map((f) => [f.id, f]));

    // Enrich items
    const enriched = items.map((i) => {
      const base = {
        id: i.id,
        itemType: i.itemType,
        pageIndex: i.pageIndex,
        state: i.state,
        stability: i.stability,
        difficulty: i.difficulty,
        reps: i.reps,
        lapses: i.lapses,
        dueAt: i.dueAt,
        topic: i.topic,
        subject: i.subject,
        resource: i.resource,
      };
      if (i.itemType === "flashcard") {
        base.flashcard = fcMap.get(i.flashcardId) || null;
      }
      if (i.itemType === "mcq" && i.resource?.mcqData) {
        const mcqData = typeof i.resource.mcqData === "string" ? JSON.parse(i.resource.mcqData) : i.resource.mcqData;
        if (Array.isArray(mcqData) && mcqData[i.pageIndex]) {
          base.mcq = mcqData[i.pageIndex];
        }
      }
      return base;
    });

    // Group by topic for the response
    const byTopic = {};
    for (const item of enriched) {
      const key = item.topic || item.subject || "General";
      if (!byTopic[key]) byTopic[key] = [];
      byTopic[key].push(item);
    }

    const { dailyGoal } = await getUserFsrsWeights(req.user.sub);

    res.json({
      items: enriched,
      byTopic,
      totalDue: items.length,
      dailyGoal,
      dailyProgress: Math.min(items.length, dailyGoal),
    });
  } catch (error) {
    console.error("Error fetching FSRS due items:", error);
    res.status(500).json({ error: "Failed to fetch due items" });
  }
});

// ── GET /api/resources/fsrs/stats — Enhanced FSRS stats ──
router.get("/fsrs/stats", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const items = await prisma.pdfReviewItem.findMany({
      where: { userId: req.user.sub },
      select: { state: true, stability: true, difficulty: true, dueAt: true, itemType: true, reps: true, lapses: true, subject: true, lastReviewAt: true },
    });

    const dueCount = items.filter((i) => new Date(i.dueAt) <= now).length;
    const learningCount = items.filter((i) => i.state === 1 || i.state === 3).length;
    const masteredCount = items.filter((i) => isMastered(i)).length;
    const newCount = items.filter((i) => i.state === 0).length;
    const reviewCount = items.filter((i) => i.state === 2 && !isMastered(i)).length;

    // By subject
    const bySubject = {};
    for (const i of items) {
      const s = i.subject || "General";
      if (!bySubject[s]) bySubject[s] = { total: 0, due: 0, mastered: 0, learning: 0 };
      bySubject[s].total++;
      if (new Date(i.dueAt) <= now) bySubject[s].due++;
      if (isMastered(i)) bySubject[s].mastered++;
      if (i.state === 1 || i.state === 3) bySubject[s].learning++;
    }

    // Average retrievability for review-state items
    const reviewItems = items.filter((i) => i.state === 2 && i.stability > 0 && i.lastReviewAt);
    let avgRetrievability = 1;
    if (reviewItems.length > 0) {
      const totalR = reviewItems.reduce((sum, i) => {
        const elapsedDays = Math.max(0, Math.round((now - new Date(i.lastReviewAt)) / 86400000));
        const R = Math.pow(1 + elapsedDays / (9 * i.stability), -1);
        return sum + R;
      }, 0);
      avgRetrievability = Math.round((totalR / reviewItems.length) * 1000) / 1000;
    }

    const nextDue = items.length > 0
      ? items.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0].dueAt
      : null;

    const up = await prisma.userProgress.findUnique({
      where: { userId: req.user.sub },
      select: { streak: true, longestStreak: true, lastStudied: true },
    }).catch(() => null);

    const { dailyGoal } = await getUserFsrsWeights(req.user.sub);

    res.json({
      totalItems: items.length,
      dueCount,
      learningCount,
      masteredCount,
      newCount,
      reviewCount,
      mcqCount: items.filter((i) => i.itemType === "mcq" || i.itemType === "legacy_mcq").length,
      flashcardCount: items.filter((i) => i.itemType === "flashcard").length,
      pdfCount: items.filter((i) => i.itemType === "whole_pdf" || i.itemType === "page").length,
      bySubject,
      avgRetrievability,
      dailyGoal,
      nextDueAt: nextDue,
      streak: up?.streak ?? 0,
      longestStreak: up?.longestStreak ?? 0,
    });
  } catch (error) {
    console.error("Error fetching FSRS stats:", error);
    res.status(500).json({ error: "Failed to fetch FSRS stats" });
  }
});

// ── GET /api/resources/fsrs/analytics — Retention analytics ──
router.get("/fsrs/analytics", requireAuth, async (req, res) => {
  try {
    const days = Math.max(7, Math.min(90, parseInt(req.query.days) || 30));
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - days);

    const items = await prisma.pdfReviewItem.findMany({
      where: { userId: req.user.sub },
      select: { state: true, stability: true, difficulty: true, dueAt: true, itemType: true, reps: true, lapses: true, subject: true, lastReviewAt: true, createdAt: true },
    });

    // Daily review counts for heatmap
    const dailyReviews = {};
    for (let d = 0; d < days; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const key = date.toISOString().slice(0, 10);
      dailyReviews[key] = 0;
    }
    for (const i of items) {
      if (i.lastReviewAt && new Date(i.lastReviewAt) >= since) {
        const key = new Date(i.lastReviewAt).toISOString().slice(0, 10);
        if (dailyReviews[key] !== undefined) dailyReviews[key]++;
      }
    }

    // Items mastered this period
    const masteredThisPeriod = items.filter((i) => isMastered(i) && i.lastReviewAt && new Date(i.lastReviewAt) >= since).length;

    // Average difficulty by subject
    const difficultyBySubject = {};
    for (const i of items) {
      const s = i.subject || "General";
      if (!difficultyBySubject[s]) difficultyBySubject[s] = { total: 0, count: 0 };
      if (i.difficulty > 0) {
        difficultyBySubject[s].total += i.difficulty;
        difficultyBySubject[s].count++;
      }
    }
    for (const s of Object.keys(difficultyBySubject)) {
      const d = difficultyBySubject[s];
      d.avg = d.count > 0 ? Math.round((d.total / d.count) * 100) / 100 : 0;
    }

    // Lapse rate by subject
    const lapseBySubject = {};
    for (const i of items) {
      const s = i.subject || "General";
      if (!lapseBySubject[s]) lapseBySubject[s] = { total: 0, lapsed: 0 };
      lapseBySubject[s].total++;
      if (i.lapses > 0) lapseBySubject[s].lapsed++;
    }

    res.json({
      dailyReviews,
      totalItems: items.length,
      masteredThisPeriod,
      difficultyBySubject,
      lapseBySubject,
      days,
    });
  } catch (error) {
    console.error("Error fetching FSRS analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ── GET /api/resources/fsrs/status/:resourceId ──
router.get("/fsrs/status/:resourceId", requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const items = await prisma.pdfReviewItem.findMany({
      where: { userId: req.user.sub, resourceId },
      orderBy: { itemType: "asc" },
    });

    const wholePdf = items.find((i) => i.itemType === "whole_pdf") || null;
    const pages = items.filter((i) => i.itemType === "page").sort((a, b) => a.pageIndex - b.pageIndex);
    const flashcardItems = items.filter((i) => i.itemType === "flashcard");
    const mcqItems = items.filter((i) => i.itemType === "mcq" || i.itemType === "legacy_mcq");

    const flashcardIds = flashcardItems.map((f) => f.flashcardId).filter(Boolean);
    const fcData = await prisma.pdfFlashcard.findMany({ where: { id: { in: flashcardIds } } });
    const fcMap = new Map(fcData.map((f) => [f.id, f]));

    const now = new Date();
    const dueCount = items.filter((i) => new Date(i.dueAt) <= now).length;

    res.json({
      wholePdf,
      pages: pages.map((p) => ({
        pageIndex: p.pageIndex,
        state: p.state, stability: p.stability, difficulty: p.difficulty,
        reps: p.reps, lapses: p.lapses, dueAt: p.dueAt, lastReviewAt: p.lastReviewAt,
        isDue: new Date(p.dueAt) <= now, isMastered: isMastered(p),
      })),
      flashcards: flashcardItems.map((i) => ({ ...i, flashcard: fcMap.get(i.flashcardId) || null })),
      mcqs: mcqItems.map((i) => ({ ...i, isDue: new Date(i.dueAt) <= now, isMastered: isMastered(i) })),
      totalItems: items.length,
      dueCount,
    });
  } catch (error) {
    console.error("Error fetching FSRS status:", error);
    res.status(500).json({ error: "Failed to fetch FSRS status" });
  }
});

// ── POST /api/resources/fsrs/flashcards/generate ──
router.post("/fsrs/flashcards/generate", requireAuth, aiRateLimit, async (req, res) => {
  try {
    const { resourceId, pages, count } = req.body;
    if (!resourceId || !pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: "resourceId and pages array are required" });
    }
    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    const numCards = Math.max(3, Math.min(30, count || 10));
    const combinedText = pages.map((p) => p.text).join("\n\n").slice(0, 20000);

    const aiRes = await fetch(`${process.env.API_BASE || "http://localhost:4000"}/ai-proxy/generate-multimodal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: req.headers.authorization || "" },
      body: JSON.stringify({
        prompt: `You are an expert flashcard creator for university students. Generate exactly ${numCards} flashcards from the text below.\n\nFORMAT — return as a JSON array:\n[{"front": "question or prompt", "back": "concise answer"}]\n\nRules:\n- Front should be a clear question, definition prompt, or concept name\n- Back should be a concise but complete answer (1-3 sentences)\n- Cover the most important concepts from the text\n- Return ONLY the JSON array, no markdown or explanation\n\nTEXT:\n"""\n${combinedText}\n"""`,
        provider: "openrouter",
        model: "google/gemini-2.5-flash",
      }),
    }).catch(() => null);

    if (!aiRes || !aiRes.ok) return res.status(500).json({ error: "AI generation failed. Please try again." });

    const aiData = await aiRes.json();
    const rawText = aiData.text || "";
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

    const created = [];
    for (const fc of flashcards) {
      if (!fc.front || !fc.back) continue;
      const flashcard = await prisma.pdfFlashcard.create({
        data: { userId: req.user.sub, resourceId, front: fc.front, back: fc.back, sourcePage: pages[0]?.page || null },
      });
      await prisma.pdfReviewItem.create({
        data: { userId: req.user.sub, resourceId, itemType: "flashcard", pageIndex: -1, flashcardId: flashcard.id, topic: resource.title, subject: resource.subject },
      }).catch(() => {});
      created.push(flashcard);
    }
    res.status(201).json({ flashcards: created, count: created.length });
  } catch (error) {
    console.error("Error generating flashcards:", error);
    res.status(500).json({ error: "Failed to generate flashcards" });
  }
});

// ── GET /api/resources/fsrs/flashcards/:resourceId ──
router.get("/fsrs/flashcards/:resourceId", requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const flashcards = await prisma.pdfFlashcard.findMany({
      where: { userId: req.user.sub, resourceId },
      orderBy: { createdAt: "desc" },
    });
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
          state: review.state, stability: review.stability, difficulty: review.difficulty,
          reps: review.reps, lapses: review.lapses, dueAt: review.dueAt,
          isDue: new Date(review.dueAt) <= now, isMastered: isMastered(review),
        } : null,
      };
    });
    res.json({ flashcards: result });
  } catch (error) {
    console.error("Error fetching flashcards:", error);
    res.status(500).json({ error: "Failed to fetch flashcards" });
  }
});

// ── GET/PUT /api/resources/fsrs/daily-goal ──
router.get("/fsrs/daily-goal", requireAuth, async (req, res) => {
  try {
    const profile = await prisma.userFsrsProfile.findUnique({ where: { userId: req.user.sub } });
    res.json({ dailyGoal: profile?.dailyGoal || 20 });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch daily goal" });
  }
});

router.put("/fsrs/daily-goal", requireAuth, async (req, res) => {
  try {
    const { dailyGoal } = req.body;
    const goal = Math.max(5, Math.min(100, parseInt(dailyGoal) || 20));
    const profile = await prisma.userFsrsProfile.upsert({
      where: { userId: req.user.sub },
      create: { userId: req.user.sub, dailyGoal: goal },
      update: { dailyGoal: goal },
    });
    res.json({ dailyGoal: profile.dailyGoal });
  } catch (error) {
    res.status(500).json({ error: "Failed to update daily goal" });
  }
});

// ── POST /api/resources/fsrs/migrate-sm2 — Migrate legacy SM-2 data to FSRS ──
router.post("/fsrs/migrate-sm2", requireAuth, async (req, res) => {
  try {
    const oldItems = await prisma.reviewQueueItem.findMany({
      where: { userId: req.user.sub },
      include: { resource: { select: { subject: true, title: true } } },
    });

    let migrated = 0;
    for (const old of oldItems) {
      const exists = await prisma.pdfReviewItem.findUnique({
        where: { userId_resourceId_itemType_pageIndex_flashcardId: { userId: req.user.sub, resourceId: old.resourceId, itemType: "legacy_mcq", pageIndex: old.questionIndex, flashcardId: "none" } },
      }).catch(() => null);
      if (!exists) {
        // Convert SM-2 to approximate FSRS state
        const isMasteredSM2 = old.repetitions >= 3 && old.intervalDays >= 21;
        await prisma.pdfReviewItem.create({
          data: {
            userId: req.user.sub,
            resourceId: old.resourceId,
            itemType: "legacy_mcq",
            pageIndex: old.questionIndex,
            flashcardId: "none",
            state: isMasteredSM2 ? 2 : (old.repetitions > 0 ? 2 : 0),
            stability: Math.max(0.1, old.intervalDays || 1),
            difficulty: Math.min(10, Math.max(1, (old.easinessFactor || 2.5) * 2)),
            reps: old.repetitions || 0,
            lapses: 0,
            lastReviewAt: old.lastReviewed,
            dueAt: old.dueAt,
            nextReviewAt: old.dueAt,
            topic: old.resource?.title || null,
            subject: old.resource?.subject || null,
          },
        });
        migrated++;
      }
    }

    res.json({ migrated, totalOldItems: oldItems.length });
  } catch (error) {
    console.error("Error migrating SM-2 data:", error);
    res.status(500).json({ error: "Failed to migrate SM-2 data" });
  }
});

// ── Backward-compatible aliases for old /pdf-review/* routes ──
// These re-dispatch to the /fsrs/* handlers by re-entering the router
router.post("/pdf-review/init", requireAuth, (req, res) => { req.url = "/fsrs/init"; router.handle(req, res, () => {}); });
router.post("/pdf-review/rate", requireAuth, (req, res) => { req.url = "/fsrs/rate"; router.handle(req, res, () => {}); });
router.get("/pdf-review/due", requireAuth, (req, res) => { req.url = "/fsrs/due"; router.handle(req, res, () => {}); });
router.get("/pdf-review/stats", requireAuth, (req, res) => { req.url = "/fsrs/stats"; router.handle(req, res, () => {}); });
router.get("/pdf-review/status/:resourceId", requireAuth, (req, res) => { req.url = req.url.replace("/pdf-review/", "/fsrs/"); router.handle(req, res, () => {}); });
router.post("/pdf-review/flashcards/generate", requireAuth, aiRateLimit, (req, res) => { req.url = "/fsrs/flashcards/generate"; router.handle(req, res, () => {}); });
router.get("/pdf-review/flashcards/:resourceId", requireAuth, (req, res) => { req.url = req.url.replace("/pdf-review/", "/fsrs/"); router.handle(req, res, () => {}); });

// POST /api/resources/convert-pptx — Convert PPTX to PDF (server-side)
router.post("/convert-pptx", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "PPTX file is required" });
    }

    const pdfBuffer = await pptxToPdf(req.file.buffer);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(req.file.originalname, ".pptx")}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error converting PPTX to PDF:", error);
    res.status(500).json({ error: error.message || "Failed to convert PPTX to PDF" });
  }
});

// POST /api/resources - Create new resource (any authenticated user)
router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { title, subject, contentType, description, isPremium, mcqData, department, level, semester, departmentIds, folderId, universityId, isPublic } = req.body;

    if (!title || !contentType) {
      return res.status(400).json({ error: "Title and content type are required" });
    }

    const finalSubject = subject || "";

    // Fetch user's department info for auto-filling if not provided
    const userDept = await prisma.userDepartment.findUnique({
      where: { userId: req.user.sub },
      include: { department: { select: { name: true } }, university: { select: { id: true, name: true } } },
    });
    // Also fetch user profile for university info
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: req.user.sub },
      select: { universityId: true, isUniversityStudent: true, schoolName: true },
    });
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    const isStudent = user?.role === "STUDENT";

    // If folderId is provided, fetch the folder to inherit metadata and department associations
    let folder = null;
    let folderDeptIds = [];
    if (folderId) {
      folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { folderDepts: { select: { departmentId: true } } },
      });
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      folderDeptIds = folder.folderDepts.map((fd) => fd.departmentId);
    }

    // Auto-fill department/level/semester from user's profile if not provided
    const finalDept = department || userDept?.department?.name || null;
    const levelMap = { 1: "100 Level", 2: "200 Level", 3: "300 Level", 4: "400 Level", 5: "500 Level", 6: "600 Level" };
    const finalLevel = level || (userDept ? levelMap[userDept.yearLevel] || null : null);
    const finalSemester = semester || userDept?.semester || null;
    // Auto-fill universityId from user's profile or userDepartment
    const finalUniversityId = universityId || userDept?.universityId || userProfile?.universityId || null;

    // Parse departmentIds — can be a JSON array string or repeated form fields
    // If uploading into a shared folder, inherit the folder's department associations
    let parsedDeptIds = [];
    if (folderId && folderDeptIds.length > 0) {
      parsedDeptIds = folderDeptIds;
    } else if (departmentIds) {
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
    } else if (contentType !== "note") {
      // For non-MCQ, non-note types, file is required
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
        subject: folder?.courseCode || finalSubject,
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
        flashcardData: contentType === "flashcard_deck" ? (typeof req.body.flashcardData === "string" ? JSON.parse(req.body.flashcardData) : req.body.flashcardData) : null,
        status: isPublic === "true" || isPublic === true ? "approved" : "private",
        department: finalDept,
        level: finalLevel,
        semester: finalSemester,
        universityId: finalUniversityId,
        folderId: folderId || null,
        resourceDepts: parsedDeptIds.length > 0 ? {
          create: parsedDeptIds.map((deptId) => ({ departmentId: deptId })),
        } : undefined,
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        university: { select: { id: true, name: true, type: true } },
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
    const { title, subject, description, isPremium, department, level, semester, departmentIds, mcqData, universityId } = req.body;

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

    // Parse mcqData if provided (for MCQ-type resources)
    let parsedMcqData = null;
    if (mcqData) {
      try {
        const data = typeof mcqData === "string" ? JSON.parse(mcqData) : mcqData;
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ error: "MCQ data must be a non-empty array" });
        }
        parsedMcqData = data;
      } catch {
        return res.status(400).json({ error: "Invalid MCQ data format" });
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
        ...(universityId !== undefined && { universityId: universityId || null }),
        ...(parsedMcqData && { mcqData: parsedMcqData }),
        ...(parsedDeptIds !== null && {
          resourceDepts: {
            deleteMany: {},
            create: parsedDeptIds.map((deptId) => ({ departmentId: deptId })),
          },
        }),
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        university: { select: { id: true, name: true, type: true } },
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

// ============ PHASE 11: SCOPED SESSION ENDPOINTS ============

// ── GET /api/resources/fsrs/due-mcqs — Due MCQ items scoped by subject or resourceIds ──
router.get("/fsrs/due-mcqs", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const { subject, resourceIds } = req.query;
    const limit = Math.max(1, Math.min(20, parseInt(req.query.limit) || 20));

    const where = {
      userId: req.user.sub,
      itemType: { in: ["mcq", "legacy_mcq"] },
      dueAt: { lte: now },
    };

    if (subject) {
      where.subject = subject;
    }

    if (resourceIds) {
      const ids = resourceIds.split(",").filter(Boolean);
      if (ids.length > 0) where.resourceId = { in: ids };
    }

    const items = await prisma.pdfReviewItem.findMany({
      where,
      include: {
        resource: { select: { id: true, title: true, subject: true, shareToken: true, mcqData: true } },
      },
      orderBy: [{ lapses: "desc" }, { dueAt: "asc" }],
      take: limit,
    });

    const enriched = items.map((i) => {
      const base = {
        id: i.id,
        resourceId: i.resourceId,
        pageIndex: i.pageIndex,
        state: i.state,
        stability: i.stability,
        difficulty: i.difficulty,
        reps: i.reps,
        lapses: i.lapses,
        dueAt: i.dueAt,
        topic: i.topic,
        subject: i.subject,
        resource: i.resource,
      };
      if (i.resource?.mcqData) {
        const mcqData = typeof i.resource.mcqData === "string" ? JSON.parse(i.resource.mcqData) : i.resource.mcqData;
        if (Array.isArray(mcqData) && mcqData[i.pageIndex]) {
          base.mcq = mcqData[i.pageIndex];
        }
      }
      return base;
    }).filter((i) => i.mcq);

    res.json({ items: enriched, totalDue: enriched.length });
  } catch (error) {
    console.error("Error fetching due MCQs:", error);
    res.status(500).json({ error: "Failed to fetch due MCQs" });
  }
});

// ── GET /api/resources/fsrs/weak-topics — Ranked weak topics scoped by subject or resourceIds ──
router.get("/fsrs/weak-topics", requireAuth, async (req, res) => {
  try {
    const { subject, resourceIds } = req.query;

    const where = {
      userId: req.user.sub,
      itemType: { in: ["mcq", "legacy_mcq", "page", "whole_pdf"] },
    };

    if (subject) {
      where.subject = subject;
    }

    if (resourceIds) {
      const ids = resourceIds.split(",").filter(Boolean);
      if (ids.length > 0) where.resourceId = { in: ids };
    }

    const items = await prisma.pdfReviewItem.findMany({
      where,
      select: { topic: true, subject: true, lapses: true, difficulty: true, state: true, dueAt: true },
    });

    // Group by topic
    const topicMap = {};
    for (const i of items) {
      const key = i.topic || i.subject || "General";
      if (!topicMap[key]) {
        topicMap[key] = { topic: key, dueCount: 0, totalItems: 0, sumDifficulty: 0, sumLapses: 0 };
      }
      const t = topicMap[key];
      t.totalItems++;
      t.sumDifficulty += i.difficulty || 0;
      t.sumLapses += i.lapses || 0;
      if (new Date(i.dueAt) <= new Date()) t.dueCount++;
    }

    const ranked = Object.values(topicMap).map((t) => ({
      topic: t.topic,
      dueCount: t.dueCount,
      avgDifficulty: t.totalItems > 0 ? Math.round((t.sumDifficulty / t.totalItems) * 100) / 100 : 0,
      lapseRate: t.totalItems > 0 ? Math.round((t.sumLapses / t.totalItems) * 100) / 100 : 0,
    })).sort((a, b) => (b.dueCount + b.lapseRate * 2) - (a.dueCount + a.lapseRate * 2));

    res.json({ topics: ranked.slice(0, 15) });
  } catch (error) {
    console.error("Error fetching weak topics:", error);
    res.status(500).json({ error: "Failed to fetch weak topics" });
  }
});

// ── POST /api/resources/folders/:folderId/quiz-attempts — Combined folder-wide quiz attempt ──
router.post("/folders/:folderId/quiz-attempts", requireAuth, async (req, res) => {
  try {
    const { folderId } = req.params;
    const { score, total, details, mode } = req.body;

    if (score === undefined || total === undefined) {
      return res.status(400).json({ error: "score and total are required" });
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const attemptMode = mode === "exam" ? "exam" : "practice";

    // Check if this is the user's first folder attempt
    const existingAttempts = await prisma.folderQuizAttempt.findMany({
      where: { folderId, userId: req.user.sub },
      select: { id: true },
    });
    const isFirstAttempt = existingAttempts.length === 0;
    const xpAwarded = isFirstAttempt ? score * 10 : 0;

    const attempt = await prisma.folderQuizAttempt.create({
      data: { folderId, userId: req.user.sub, score, total, xpAwarded, mode: attemptMode, details: details || null },
    });

    // Update FSRS for each question in details
    if (details && Array.isArray(details)) {
      const now = new Date();
      for (const d of details) {
        if (!d.resourceId) continue;
        const grade = d.correct ? (d.timeSpentMs && d.timeSpentMs < 5000 ? 4 : 3) : 1;

        const existing = await prisma.pdfReviewItem.findUnique({
          where: {
            userId_resourceId_itemType_pageIndex_flashcardId: {
              userId: req.user.sub,
              resourceId: d.resourceId,
              itemType: "mcq",
              pageIndex: d.questionIndex,
              flashcardId: "none",
            },
          },
        }).catch(() => null);

        const card = existing
          ? { state: existing.state, stability: existing.stability, difficulty: existing.difficulty, reps: existing.reps, lapses: existing.lapses, lastReviewAt: existing.lastReviewAt }
          : fsrsNewCard();

        const result = fsrsRate(card, grade, now);

        await prisma.pdfReviewItem.upsert({
          where: {
            userId_resourceId_itemType_pageIndex_flashcardId: {
              userId: req.user.sub,
              resourceId: d.resourceId,
              itemType: "mcq",
              pageIndex: d.questionIndex,
              flashcardId: "none",
            },
          },
          create: {
            userId: req.user.sub,
            resourceId: d.resourceId,
            itemType: "mcq",
            pageIndex: d.questionIndex,
            flashcardId: "none",
            state: result.state,
            stability: result.stability,
            difficulty: result.difficulty,
            reps: result.reps,
            lapses: result.lapses,
            lastReviewAt: result.lastReviewAt,
            nextReviewAt: result.nextReviewDate,
            dueAt: result.nextReviewDate,
          },
          update: {
            state: result.state,
            stability: result.stability,
            difficulty: result.difficulty,
            reps: result.reps,
            lapses: result.lapses,
            lastReviewAt: result.lastReviewAt,
            nextReviewAt: result.nextReviewDate,
            dueAt: result.nextReviewDate,
          },
        }).catch(() => {});
      }
    }

    // Update streak
    const streakInfo = await updateUniversalStreak(req.user.sub, prisma);

    // Award XP
    if (xpAwarded > 0) {
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { totalXp: { increment: xpAwarded } },
      });
      await prisma.userProgress.upsert({
        where: { userId: req.user.sub },
        create: { userId: req.user.sub, xp: xpAwarded },
        update: { xp: { increment: xpAwarded } },
      }).catch(() => {});
    }

    res.json({
      xpAwarded,
      streak: streakInfo.streak,
      longestStreak: streakInfo.longestStreak,
      streakIsNewDay: streakInfo.isNewDay,
    });
  } catch (error) {
    console.error("Error saving folder quiz attempt:", error);
    res.status(500).json({ error: "Failed to save folder quiz attempt" });
  }
});

export default router;
