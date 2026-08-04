import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  extractSkeletonFromOutline,
  retroactiveMatchDocuments,
  checkVerificationThreshold,
} from "../lib/topicExtractionService.js";
import { logError } from "../lib/logger.js";

const router = express.Router();

// GET /api/curriculum/:courseCode/topics — List all topics for a course
router.get("/:courseCode/topics", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode },
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
    const { topics, source = "ai_inferred", outlineText, courseName } = req.body;

    // Path A: Server-side generation from outline/courseName
    if (outlineText || courseName) {
      const result = await extractSkeletonFromOutline({
        courseCode,
        outlineText,
        courseName,
        userId: req.user.sub,
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
          courseCode_title: { courseCode, title: t.title.trim() },
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

    // Resolve prerequisite titles to IDs
    const titleToId = new Map(created.map((t) => [t.title, t.id]));
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

    // Re-fetch with prerequisites resolved
    const finalTopics = await prisma.curriculumTopic.findMany({
      where: { courseCode },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    });

    res.status(201).json(finalTopics);
  } catch (err) {
    console.error("Error saving curriculum topics:", err.message);
    res.status(500).json({ error: "Failed to save topics" });
  }
});

// PATCH /api/curriculum/topics/:id — Update a topic
router.patch("/topics/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, displayOrder, prerequisiteIds } = req.body;
    const topic = await prisma.curriculumTopic.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(prerequisiteIds !== undefined && { prerequisiteIds }),
      },
    });
    res.json(topic);
  } catch (err) {
    console.error("Error updating curriculum topic:", err.message);
    res.status(500).json({ error: "Failed to update topic" });
  }
});

// DELETE /api/curriculum/topics/:id — Delete a topic
router.delete("/topics/:id", requireAuth, async (req, res) => {
  try {
    await prisma.curriculumTopic.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting curriculum topic:", err.message);
    res.status(500).json({ error: "Failed to delete topic" });
  }
});

// POST /api/curriculum/topics/:id/corroborate — User corroborates an AI-inferred topic
router.post("/topics/:id/corroborate", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const topic = await prisma.curriculumTopic.findUnique({
      where: { id: req.params.id },
    });
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    // Outline-sourced topics are pre-verified — no corroboration needed
    if (topic.source === "outline") {
      return res.json({ ok: true, alreadyVerified: true, topic });
    }

    if (topic.corroboratingUserIds.includes(userId)) {
      return res.json({ ok: true, alreadyCorroborated: true, topic });
    }

    const newCorroborating = [...topic.corroboratingUserIds, userId];
    const newDispute = topic.disputeUserIds.filter((id) => id !== userId);

    // Recompute avgConfidence from actual document_topic_matches
    const matches = await prisma.documentTopicMatch.findMany({
      where: { topicId: topic.id },
      select: { confidence: true },
    });
    const avgConfidence = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
      : 0;

    const shouldVerify =
      newCorroborating.length >= 5 && avgConfidence > 0.7 && newDispute.length === 0;

    const newStatus = newDispute.length > 0 ? "disputed" : shouldVerify ? "verified" : "unverified";

    const updated = await prisma.curriculumTopic.update({
      where: { id: topic.id },
      data: {
        corroboratingUserIds: newCorroborating,
        disputeUserIds: newDispute,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        verified: shouldVerify,
        status: newStatus,
      },
    });

    res.json({ ok: true, topic: updated });
  } catch (err) {
    console.error("Error corroborating topic:", err.message);
    res.status(500).json({ error: "Failed to corroborate topic" });
  }
});

// POST /api/curriculum/topics/:id/dispute — User disputes an AI-inferred topic
router.post("/topics/:id/dispute", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const topic = await prisma.curriculumTopic.findUnique({
      where: { id: req.params.id },
    });
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    // Outline-sourced topics cannot be disputed
    if (topic.source === "outline") {
      return res.status(400).json({ error: "Outline-sourced topics cannot be disputed" });
    }

    if (topic.disputeUserIds.includes(userId)) {
      return res.json({ ok: true, alreadyDisputed: true, topic });
    }

    const newDispute = [...topic.disputeUserIds, userId];
    const newCorroborating = topic.corroboratingUserIds.filter((id) => id !== userId);

    // Recompute avgConfidence from actual document_topic_matches
    const matches = await prisma.documentTopicMatch.findMany({
      where: { topicId: topic.id },
      select: { confidence: true },
    });
    const avgConfidence = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
      : 0;

    const updated = await prisma.curriculumTopic.update({
      where: { id: topic.id },
      data: {
        disputeUserIds: newDispute,
        corroboratingUserIds: newCorroborating,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        verified: false,
        status: "disputed",
      },
    });

    res.json({ ok: true, topic: updated });
  } catch (err) {
    console.error("Error disputing topic:", err.message);
    res.status(500).json({ error: "Failed to dispute topic" });
  }
});

// GET /api/curriculum/:courseCode/matches — Get document-topic matches for current user
router.get("/:courseCode/matches", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const userId = req.user.sub;

    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode },
      select: { id: true },
    });
    const topicIds = topics.map((t) => t.id);
    if (topicIds.length === 0) return res.json([]);

    const matches = await prisma.documentTopicMatch.findMany({
      where: { userId, topicId: { in: topicIds } },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            contentType: true,
            fileUrl: true,
            shareToken: true,
            subject: true,
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

// POST /api/curriculum/matches — Create/update a document-topic match
// Also triggers verification threshold check after insert
router.post("/matches", requireAuth, async (req, res) => {
  try {
    const { resourceId, topicId, confidence, matchSource } = req.body;
    if (!resourceId || !topicId) {
      return res.status(400).json({ error: "resourceId and topicId are required" });
    }

    const match = await prisma.documentTopicMatch.upsert({
      where: {
        userId_resourceId_topicId: {
          userId: req.user.sub,
          resourceId,
          topicId,
        },
      },
      update: {
        confidence: confidence ?? 0,
        matchSource: matchSource || "ai",
      },
      create: {
        userId: req.user.sub,
        resourceId,
        topicId,
        confidence: confidence ?? 0,
        matchSource: matchSource || "ai",
      },
    });

    // Run verification threshold check after match insert
    try {
      await checkVerificationThreshold(topicId);
    } catch (verifyErr) {
      logError(verifyErr, { context: "checkVerificationThreshold on match insert", topicId });
    }

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

// GET /api/curriculum/:courseCode/topic-progress — Aggregate FSRS stats per topic
router.get("/:courseCode/topic-progress", requireAuth, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const userId = req.user.sub;

    const topics = await prisma.curriculumTopic.findMany({
      where: { courseCode },
      select: { id: true },
    });
    const topicIds = topics.map((t) => t.id);
    if (topicIds.length === 0) return res.json({});

    // Get all matched resource IDs grouped by topic
    const matches = await prisma.documentTopicMatch.findMany({
      where: { userId, topicId: { in: topicIds } },
      select: { topicId: true, resourceId: true },
    });

    const topicToResourceIds = new Map();
    for (const m of matches) {
      if (!topicToResourceIds.has(m.topicId)) topicToResourceIds.set(m.topicId, []);
      topicToResourceIds.get(m.topicId).push(m.resourceId);
    }

    const result = {};

    for (const [topicId, resourceIds] of topicToResourceIds) {
      if (resourceIds.length === 0) {
        result[topicId] = { totalItems: 0, avgStability: 0, avgRetrievability: 0, masteredCount: 0, label: "Not started" };
        continue;
      }

      const items = await prisma.pdfReviewItem.findMany({
        where: { userId, resourceId: { in: resourceIds } },
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
      where: { courseCode },
      select: { id: true, title: true, description: true },
    });
    if (topics.length === 0) {
      return res.status(400).json({ error: "No skeleton exists for this course yet" });
    }

    // Count resources — folder-scoped if folderId provided, else fallback to subject/courseCode OR
    const countWhere = folderId
      ? { folderId, uploadedBy: userId }
      : {
          OR: [
            { subject: courseCode, uploadedBy: userId },
            { folder: { courseCode }, uploadedBy: userId },
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

    // Run the matching synchronously (user sees progress via polling or SSE in future)
    const result = await retroactiveMatchDocuments(courseCode, userId, folderId);

    res.json({
      ok: true,
      matchCount: result.matchCount,
      resourceCount: result.resourceCount,
      message: `Matched ${result.matchCount} document-topic pairs from ${result.resourceCount} documents.`,
    });
  } catch (err) {
    console.error("Error during retroactive matching:", err.message);
    res.status(500).json({ error: "Failed to run retroactive matching" });
  }
});

export default router;
