import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  extractSkeletonFromOutline,
  retroactiveMatchDocuments,
} from "../lib/topicExtractionService.js";

const router = express.Router();

// GET /api/curriculum/:courseCode/topics — List all topics for a course
router.get("/:courseCode/topics", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: req.user.sub },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      include: {
        _count: { select: { documentMatches: true } },
      },
    });
    res.json(topics);
  } catch (err) {
    console.error("Error fetching curriculum topics:", err.message);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

// POST /api/curriculum/:courseCode/topics — Generate skeleton server-side
// Accepts either { topics, source } (client-provided) or { outlineText, courseName } (server-generated)
router.post("/:courseCode/topics", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { topics, source = "ai_inferred", outlineText, courseName, merge } = req.body;

    // Path A: Server-side generation from outline/courseName
    if (outlineText || courseName) {
      const result = await extractSkeletonFromOutline({
        courseCode,
        outlineText,
        courseName,
        userId: req.user.sub,
        merge: !!merge,
      });
      return res.status(201).json(result.topics);
    }

    // Path B: Client-provided topics (backward compat — save directly)
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: "topics array or outlineText/courseName is required" });
    }

    const verified = source === "outline";
    const status = verified ? "verified" : "unverified";
    const created = [];

    for (const t of topics) {
      if (!t.title || !t.title.trim()) continue;
      const topic = await prisma.curriculumTopic.upsert({
        where: {
          createdBy_courseCode_title: { createdBy: req.user.sub, courseCode, title: t.title.trim() },
        },
        update: {
          description: t.description || null,
          displayOrder: t.displayOrder ?? 0,
          subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
          ...(verified && { verified: true, source: "outline", status: "verified" }),
        },
        create: {
          courseCode,
          title: t.title.trim(),
          description: t.description || null,
          displayOrder: t.displayOrder ?? 0,
          subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
          source,
          verified,
          status,
          createdBy: req.user.sub,
        },
      });
      created.push(topic);
    }

    // Resolve prerequisite titles to IDs — include pre-existing topics so an
    // imported/merged roadmap can reference topics created earlier.
    const allCourseTopics = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: req.user.sub },
      select: { id: true, title: true },
    });
    const titleToId = new Map(allCourseTopics.map((t) => [t.title, t.id]));
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i];
      if (!t.prerequisiteTitles || t.prerequisiteTitles.length === 0) continue;
      const topicId = titleToId.get(t.title.trim());
      if (!topicId) continue;
      const prereqIds = t.prerequisiteTitles
        .map((pt) => titleToId.get(pt.trim()))
        .filter(Boolean);
      if (prereqIds.length > 0) {
        await prisma.curriculumTopic.update({
          where: { id: topicId },
          data: { prerequisiteIds: prereqIds },
        });
      }
    }

    // Re-fetch with prerequisites resolved (scoped to this user)
    const finalTopics = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: req.user.sub },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    });

    res.status(201).json(finalTopics);
  } catch (err) {
    console.error("Error saving curriculum topics:", err.message);
    res.status(500).json({ error: "Failed to save topics" });
  }
});

// PATCH /api/curriculum/topics/:id — Update a topic (owner only)
router.patch("/topics/:id", requireAuth, async (req, res) => {
  try {
    const existing = await prisma.curriculumTopic.findUnique({
      where: { id: req.params.id },
      select: { createdBy: true },
    });
    if (!existing) return res.status(404).json({ error: "Topic not found" });
    if (existing.createdBy !== req.user.sub) {
      return res.status(403).json({ error: "Not authorized to modify this topic" });
    }

    const { title, description, displayOrder, prerequisiteIds, subtopics, doneSubs, manuallyDone } = req.body;
    const topic = await prisma.curriculumTopic.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(prerequisiteIds !== undefined && { prerequisiteIds }),
        ...(Array.isArray(subtopics) && {
          subtopics: subtopics.map((s) => String(s).trim()).filter(Boolean).slice(0, 100),
        }),
        ...(Array.isArray(doneSubs) && {
          doneSubs: doneSubs.map((s) => String(s)).slice(0, 200),
        }),
        ...(manuallyDone !== undefined && { manuallyDone: !!manuallyDone }),
      },
    });
    res.json(topic);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A topic with this title already exists in this course" });
    }
    console.error("Error updating curriculum topic:", err.message);
    res.status(500).json({ error: "Failed to update topic" });
  }
});

// DELETE /api/curriculum/topics/:id — Delete a topic (owner only)
router.delete("/topics/:id", requireAuth, async (req, res) => {
  try {
    const existing = await prisma.curriculumTopic.findUnique({
      where: { id: req.params.id },
      select: { createdBy: true },
    });
    if (!existing) return res.status(404).json({ error: "Topic not found" });
    if (existing.createdBy !== req.user.sub) {
      return res.status(403).json({ error: "Not authorized to delete this topic" });
    }

    await prisma.curriculumTopic.delete({ where: { id: req.params.id } });
    // Remove the deleted topic from other topics' prerequisites
    const dependents = await prisma.curriculumTopic.findMany({
      where: { createdBy: req.user.sub, prerequisiteIds: { has: req.params.id } },
      select: { id: true, prerequisiteIds: true },
    });
    for (const dep of dependents) {
      await prisma.curriculumTopic.update({
        where: { id: dep.id },
        data: { prerequisiteIds: dep.prerequisiteIds.filter((pid) => pid !== req.params.id) },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting curriculum topic:", err.message);
    res.status(500).json({ error: "Failed to delete topic" });
  }
});

// PATCH /api/curriculum/:courseCode/reorder — Bulk reorder topics (owner only)
router.patch("/:courseCode/reorder", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { topicIds } = req.body;
    if (!Array.isArray(topicIds) || topicIds.length === 0) {
      return res.status(400).json({ error: "topicIds array is required" });
    }

    // Verify all topics belong to the requesting user
    const topics = await prisma.curriculumTopic.findMany({
      where: { id: { in: topicIds }, courseCode },
      select: { id: true, createdBy: true },
    });
    const unauthorized = topics.some((t) => t.createdBy !== req.user.sub);
    if (unauthorized) {
      return res.status(403).json({ error: "Not authorized to reorder some topics" });
    }

    await prisma.$transaction(
      topicIds.map((id, i) =>
        prisma.curriculumTopic.update({
          where: { id },
          data: { displayOrder: i },
        })
      )
    );

    const updated = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: req.user.sub },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    });
    res.json(updated);
  } catch (err) {
    console.error("Error reordering topics:", err.message);
    res.status(500).json({ error: "Failed to reorder topics" });
  }
});

// GET /api/curriculum/:courseCode/matches — Get document-topic matches for current user
router.get("/:courseCode/matches", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const userId = req.user.sub;

    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: userId },
      select: { id: true },
    });
    const topicIds = topics.map((t) => t.id);
    if (topicIds.length === 0) return res.json([]);

    const matches = await prisma.documentTopicMatch.findMany({
      where: {
        userId,
        topicId: { in: topicIds },
        resource: { sourceResourceId: null },
      },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            contentType: true,
            fileUrl: true,
            shareToken: true,
            subject: true,
            viewCount: true,
          },
        },
        topic: {
          select: { id: true, title: true, displayOrder: true },
        },
      },
    });

    res.json(matches);
  } catch (err) {
    console.error("Error fetching document-topic matches:", err.message);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// POST /api/curriculum/matches — Manually place a document under a topic.
// Manual placements (matchSource "manual") beat AI matches and are never
// overwritten or skipped by retroactive matching.
router.post("/matches", requireAuth, async (req, res) => {
  try {
    const { resourceId, topicId, matchSource } = req.body;
    if (!resourceId || !topicId) {
      return res.status(400).json({ error: "resourceId and topicId are required" });
    }
    const userId = req.user.sub;

    // Topic must belong to the caller's roadmap copy
    const topic = await prisma.curriculumTopic.findUnique({
      where: { id: topicId },
      select: { createdBy: true },
    });
    if (!topic) return res.status(404).json({ error: "Topic not found" });
    if (topic.createdBy !== userId) {
      return res.status(403).json({ error: "Not authorized to edit this roadmap" });
    }

    // Resource must be accessible to the caller: uploaded by them, bookmarked
    // by them, or inside a folder they own or have bookmarked.
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        uploadedBy: true,
        bookmarks: { where: { userId }, select: { id: true }, take: 1 },
        folder: {
          select: {
            ownerId: true,
            folderBookmarks: { where: { userId }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    if (!resource) return res.status(404).json({ error: "Document not found" });
    const accessible =
      resource.uploadedBy === userId ||
      resource.bookmarks.length > 0 ||
      resource.folder?.ownerId === userId ||
      (resource.folder?.folderBookmarks?.length ?? 0) > 0;
    if (!accessible) {
      return res.status(403).json({ error: "You can't place a document you don't have access to" });
    }

    const source = matchSource === "ai" ? "ai" : "manual";
    const confidence = source === "manual" ? 1 : (req.body.confidence ?? 0);
    const match = await prisma.documentTopicMatch.upsert({
      where: {
        userId_resourceId_topicId: { userId, resourceId, topicId },
      },
      update: { confidence, matchSource: source },
      create: { userId, resourceId, topicId, confidence, matchSource: source },
    });

    res.status(201).json(match);
  } catch (err) {
    console.error("Error creating document-topic match:", err.message);
    res.status(500).json({ error: "Failed to create match" });
  }
});

// DELETE /api/curriculum/matches/:id — Remove a document-topic match
router.delete("/matches/:id", requireAuth, async (req, res) => {
  try {
    const match = await prisma.documentTopicMatch.findUnique({
      where: { id: req.params.id },
    });
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.userId !== req.user.sub) {
      return res.status(403).json({ error: "Not authorized to delete this match" });
    }

    await prisma.documentTopicMatch.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting document-topic match:", err.message);
    res.status(500).json({ error: "Failed to delete match" });
  }
});

// GET /api/curriculum/:courseCode/export — Roadmap as portable JSON (prereqs by title)
router.get("/:courseCode/export", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: req.user.sub },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    });
    const idToTitle = new Map(topics.map((t) => [t.id, t.title]));
    res.json({
      version: 1,
      courseCode,
      exportedAt: new Date().toISOString(),
      topics: topics.map((t) => ({
        title: t.title,
        description: t.description || "",
        subtopics: t.subtopics || [],
        displayOrder: t.displayOrder,
        prerequisiteTitles: (t.prerequisiteIds || []).map((id) => idToTitle.get(id)).filter(Boolean),
      })),
    });
  } catch (err) {
    console.error("Error exporting roadmap:", err.message);
    res.status(500).json({ error: "Failed to export roadmap" });
  }
});

// GET /api/curriculum/:courseCode/prefs — Per-course user preferences (exam date)
router.get("/:courseCode/prefs", requireAuth, async (req, res) => {
  try {
    const pref = await prisma.userCoursePref.findUnique({
      where: { userId_courseCode: { userId: req.user.sub, courseCode: req.params.courseCode } },
    });
    res.json({ examDate: pref?.examDate || null });
  } catch (err) {
    console.error("Error fetching course prefs:", err.message);
    res.status(500).json({ error: "Failed to fetch course prefs" });
  }
});

// PATCH /api/curriculum/:courseCode/prefs — Set/clear exam date { examDate: ISO|null }
router.patch("/:courseCode/prefs", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { examDate } = req.body;
    const date = examDate ? new Date(examDate) : null;
    if (examDate && isNaN(date.getTime())) {
      return res.status(400).json({ error: "Invalid examDate" });
    }
    const pref = await prisma.userCoursePref.upsert({
      where: { userId_courseCode: { userId: req.user.sub, courseCode } },
      update: { examDate: date },
      create: { userId: req.user.sub, courseCode, examDate: date },
    });
    res.json({ examDate: pref.examDate });
  } catch (err) {
    console.error("Error saving course prefs:", err.message);
    res.status(500).json({ error: "Failed to save course prefs" });
  }
});

// GET /api/curriculum/:courseCode/topic-progress — Aggregate FSRS stats per topic
router.get("/:courseCode/topic-progress", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const userId = req.user.sub;

    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: userId },
      select: { id: true },
    });
    const topicIds = topics.map((t) => t.id);
    if (topicIds.length === 0) return res.json({});

    // Get all matched resource IDs grouped by topic (exclude AI-generated variants)
    const matches = await prisma.documentTopicMatch.findMany({
      where: {
        userId,
        topicId: { in: topicIds },
        resource: { sourceResourceId: null },
      },
      select: { topicId: true, resourceId: true },
    });

    const topicToResourceIds = new Map();
    const allSourceIds = new Set();
    for (const m of matches) {
      if (!topicToResourceIds.has(m.topicId)) topicToResourceIds.set(m.topicId, []);
      topicToResourceIds.get(m.topicId).push(m.resourceId);
      allSourceIds.add(m.resourceId);
    }

    // FSRS review items are recorded against generated variants (MCQ /
    // flashcard / summary resources), while matches point at source docs.
    // Expand each topic's id set to include its variants so practicing a
    // variant counts toward the topic's progress.
    const variants = allSourceIds.size
      ? await prisma.resource.findMany({
          where: { sourceResourceId: { in: [...allSourceIds] } },
          select: { id: true, sourceResourceId: true },
        })
      : [];
    const variantIdsBySource = new Map();
    for (const v of variants) {
      if (!variantIdsBySource.has(v.sourceResourceId)) variantIdsBySource.set(v.sourceResourceId, []);
      variantIdsBySource.get(v.sourceResourceId).push(v.id);
    }

    const result = {};

    for (const [topicId, resourceIds] of topicToResourceIds) {
      const expandedIds = [...resourceIds];
      for (const rid of resourceIds) {
        const vs = variantIdsBySource.get(rid);
        if (vs) expandedIds.push(...vs);
      }

      const items = await prisma.pdfReviewItem.findMany({
        where: { userId, resourceId: { in: expandedIds } },
        select: { state: true, stability: true, reps: true, lapses: true, lastReviewAt: true },
      });

      if (items.length === 0) {
        result[topicId] = { totalItems: 0, avgStability: 0, avgRetrievability: 0, masteredCount: 0, label: "Not started" };
        continue;
      }

      const now = new Date();
      let totalRetrievability = 0;
      let totalStability = 0;
      let masteredCount = 0;

      for (const item of items) {
        totalStability += item.stability || 0;
        if (item.stability > 0 && item.lastReviewAt) {
          const elapsedDays = Math.max(0, (now - new Date(item.lastReviewAt)) / 86400000);
          const R = Math.exp(-elapsedDays / Math.max(0.1, item.stability));
          totalRetrievability += R;
          if (R > 0.9 && item.state === 2) masteredCount++;
        }
      }

      const avgRetrievability = totalRetrievability / items.length;
      const avgStability = totalStability / items.length;

      let label = "Learning";
      if (items.length === 0) label = "Not started";
      else if (avgRetrievability > 0.9) label = "Mastered";
      else if (avgRetrievability > 0.7) label = "Reviewing";
      else if (avgRetrievability > 0.3) label = "Learning";
      else label = "New";

      result[topicId] = {
        totalItems: items.length,
        avgStability: Math.round(avgStability * 100) / 100,
        avgRetrievability: Math.round(avgRetrievability * 100) / 100,
        masteredCount,
        label,
      };
    }

    // Fill in topics with no matches
    for (const t of topics) {
      if (!result[t.id]) {
        result[t.id] = { totalItems: 0, avgStability: 0, avgRetrievability: 0, masteredCount: 0, label: "Not started" };
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Error fetching topic progress:", err.message);
    res.status(500).json({ error: "Failed to fetch topic progress" });
  }
});

// POST /api/curriculum/:courseCode/retroactive-match — Server-side batch match
// Runs AI matching server-side, writes matches authoritatively
router.post("/:courseCode/retroactive-match", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const userId = req.user.sub;
    const { folderId } = req.body || {};

    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode, createdBy: userId },
      select: { id: true, title: true, description: true },
    });
    if (topics.length === 0) {
      return res.status(400).json({ error: "No skeleton exists for this course yet" });
    }

    // Count resources — folder-scoped if folderId provided, else fallback to subject/courseCode OR
    // Includes documents the user bookmarked, not just uploaded
    const ownedOrBookmarked = {
      OR: [{ uploadedBy: userId }, { bookmarks: { some: { userId } } }],
    };
    const countWhere = folderId
      ? { AND: [{ folderId }, ownedOrBookmarked] }
      : {
          AND: [
            { OR: [{ subject: courseCode }, { folder: { courseCode } }] },
            ownedOrBookmarked,
          ],
        };
    const resourceCount = await prisma.resource.count({ where: countWhere });

    if (resourceCount === 0) {
      return res.json({
        ok: true,
        matchCount: 0,
        resourceCount: 0,
        message: "No documents found for this course.",
      });
    }

    const result = await retroactiveMatchDocuments(courseCode, userId, folderId);

    res.json({
      ok: true,
      matchCount: result.matchCount,
      resourceCount: result.resourceCount,
      errorCount: result.errorCount || 0,
      message: `Matched ${result.matchCount} document-topic pairs from ${result.resourceCount} documents${result.errorCount ? ` (${result.errorCount} failed)` : ""}.`,
    });
  } catch (err) {
    console.error("Error during retroactive matching:", err.message);
    res.status(500).json({ error: err.message || "Failed to run retroactive matching" });
  }
});

// POST /api/curriculum/cleanup-variant-matches — Remove DocumentTopicMatch entries for AI-generated variant resources
router.post("/cleanup-variant-matches", requireAuth, async (req, res) => {
  try {
    // Find all DocumentTopicMatch entries where the matched resource has a sourceResourceId (i.e. it's a variant)
    const variantMatches = await prisma.documentTopicMatch.findMany({
      where: { resource: { sourceResourceId: { not: null } } },
      select: { id: true },
    });

    if (variantMatches.length === 0) {
      return res.json({ deleted: 0, message: "No variant matches to clean up." });
    }

    await prisma.documentTopicMatch.deleteMany({
      where: { id: { in: variantMatches.map((m) => m.id) } },
    });

    res.json({ deleted: variantMatches.length, message: `Removed ${variantMatches.length} variant document-topic matches.` });
  } catch (err) {
    console.error("Error cleaning up variant matches:", err.message);
    res.status(500).json({ error: err.message || "Failed to clean up variant matches" });
  }
});

export default router;
