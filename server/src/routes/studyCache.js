import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/study-cache/:topic — Get cached study content for a topic
router.get("/:topic", requireAuth, async (req, res) => {
  try {
    const topic = decodeURIComponent(req.params.topic);
    const userId = req.user.sub;

    const cache = await prisma.studySessionCache.findUnique({
      where: { userId_topic: { userId, topic } },
    });

    if (!cache) return res.status(404).json({ error: "No cache found" });

    res.json({
      topic: cache.topic,
      courseCode: cache.courseCode,
      roadmap: cache.roadmap,
      flashcards: cache.flashcards,
      explanations: cache.explanations,
      updatedAt: cache.updatedAt,
    });
  } catch (err) {
    console.error("Error fetching study cache:", err.message);
    res.status(500).json({ error: "Failed to fetch study cache" });
  }
});

// POST /api/study-cache — Save/update cached study content
router.post("/", requireAuth, async (req, res) => {
  try {
    const { topic, courseCode, roadmap, flashcards, explanations } = req.body;
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "topic is required" });
    }
    const userId = req.user.sub;

    const data = {};
    if (courseCode !== undefined) data.courseCode = courseCode;
    if (roadmap !== undefined) data.roadmap = roadmap;
    if (flashcards !== undefined) data.flashcards = flashcards;

    // For explanations, we need to merge with existing data (deep merge per section key)
    if (explanations !== undefined) {
      const existing = await prisma.studySessionCache.findUnique({
        where: { userId_topic: { userId, topic } },
        select: { explanations: true },
      });
      const existingExp = existing?.explanations || {};
      if (typeof existingExp === "string") {
        try { JSON.parse(existingExp); } catch { /* ignore */ }
      }
      const mergedExp = existingExp && typeof existingExp === "object" ? { ...existingExp } : {};
      for (const [key, val] of Object.entries(explanations)) {
        mergedExp[key] = { ...(mergedExp[key] || {}), ...val };
      }
      data.explanations = mergedExp;
    }

    const cache = await prisma.studySessionCache.upsert({
      where: { userId_topic: { userId, topic } },
      update: data,
      create: { userId, topic, ...data },
    });

    res.json({
      topic: cache.topic,
      courseCode: cache.courseCode,
      roadmap: cache.roadmap,
      flashcards: cache.flashcards,
      explanations: cache.explanations,
      updatedAt: cache.updatedAt,
    });
  } catch (err) {
    console.error("Error saving study cache:", err.message);
    res.status(500).json({ error: "Failed to save study cache" });
  }
});

// DELETE /api/study-cache/:topic — Clear cache for a topic
router.delete("/:topic", requireAuth, async (req, res) => {
  try {
    const topic = decodeURIComponent(req.params.topic);
    const userId = req.user.sub;

    await prisma.studySessionCache.deleteMany({
      where: { userId, topic },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting study cache:", err.message);
    res.status(500).json({ error: "Failed to delete study cache" });
  }
});

export default router;
