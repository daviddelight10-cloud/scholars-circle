import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /api/topics?subjectId=xxx
router.get("/", async (req, res) => {
  try {
    const { subjectId } = req.query;
    if (!subjectId) return res.status(400).json({ error: "subjectId required" });

    const topics = await prisma.topic.findMany({
      where: { subjectId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { questions: true } },
      },
    });
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/topics
router.post("/", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const { subjectId, name, icon, displayOrder } = req.body;
    if (!subjectId || !name) return res.status(400).json({ error: "subjectId and name required" });
    const topic = await prisma.topic.create({
      data: { subjectId, name, icon: icon || null, displayOrder: displayOrder || 0 },
    });
    res.status(201).json(topic);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Topic already exists in this subject" });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/topics/:id
router.patch("/:id", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const { name, icon, displayOrder } = req.body;
    const topic = await prisma.topic.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(icon !== undefined && { icon }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
    });
    res.json(topic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/topics/:id
router.delete("/:id", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    await prisma.topic.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
