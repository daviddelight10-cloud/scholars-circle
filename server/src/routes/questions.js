import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Get all questions with filters
router.get("/", requireAuth, async (req, res) => {
  const { subjectId, difficulty, year, topic } = req.query;
  const rows = await prisma.question.findMany({
    where: {
      ...(subjectId ? { subjectId } : {}),
      ...(difficulty ? { difficulty: String(difficulty) } : {}),
      ...(year ? { year: Number(year) } : {}),
      ...(topic ? { topic: String(topic) } : {}),
    },
    include: {
      subject: { select: { id: true, label: true } },
    },
  });
  res.json(rows);
});

// Get unique topics for a subject
router.get("/topics", requireAuth, async (req, res) => {
  const { subjectId } = req.query;

  if (!subjectId) {
    return res.status(400).json({ error: "subjectId is required" });
  }

  const questions = await prisma.question.findMany({
    where: { subjectId },
    select: { topic: true },
    distinct: ["topic"],
  });

  const topics = questions
    .filter((q) => q.topic)
    .map((q) => q.topic);

  res.json(topics);
});

// Get topic analytics (class averages)
router.get("/topics/analytics", requireAuth, async (req, res) => {
  const { subjectId, topic } = req.query;

  if (!subjectId) {
    return res.status(400).json({ error: "subjectId is required" });
  }

  // Get all questions for this topic
  const questions = await prisma.question.findMany({
    where: {
      subjectId,
      ...(topic ? { topic } : {}),
    },
    select: { id: true },
  });

  const questionIds = questions.map((q) => q.id);

  // Get all attempts for these questions
  const attempts = await prisma.attemptAnswer.findMany({
    where: { questionId: { in: questionIds } },
    select: {
      correct: true,
      questionId: true,
    },
  });

  // Calculate analytics
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.correct).length;
  const avgScore = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

  // Get user's performance
  const userAttempts = await prisma.attemptAnswer.findMany({
    where: {
      questionId: { in: questionIds },
      session: { userId: req.user.sub },
    },
    select: { correct: true },
  });

  const userTotal = userAttempts.length;
  const userCorrect = userAttempts.filter((a) => a.correct).length;
  const userScore = userTotal > 0 ? (userCorrect / userTotal) * 100 : 0;

  res.json({
    topic: topic || "All Topics",
    totalQuestions: questions.length,
    totalAttempts,
    avgScore: Math.round(avgScore * 10) / 10,
    userScore: Math.round(userScore * 10) / 10,
    userAttempts: userTotal,
    comparison: userScore > avgScore ? "above" : userScore < avgScore ? "below" : "at",
  });
});

// Create question with topic (teacher only)
router.post("/", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { subjectId, question, optionA, optionB, optionC, optionD, answerIndex, difficulty, year, explanation, topic } = req.body;
    if (!subjectId || !question || !optionA || !optionB || !optionC || !optionD || answerIndex === undefined) {
      return res.status(400).json({ error: "Missing required fields (subjectId, question, optionA-D, answerIndex)" });
    }
    const q = await prisma.question.create({
      data: { subjectId, question, optionA, optionB, optionC, optionD, answerIndex, difficulty, year, explanation, topic },
    });
    res.status(201).json(q);
  } catch (err) {
    console.error("Create question error:", err);
    res.status(500).json({ error: err.message || "Failed to create question" });
  }
});

// Bulk create questions with topics (teacher only)
router.post("/bulk", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: "questions must be an array" });
    }

    if (questions.length === 0) {
      return res.status(400).json({ error: "questions array is empty" });
    }

    // Validate required fields
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.subjectId || !q.question || !q.optionA || !q.optionB || !q.optionC || !q.optionD || q.answerIndex === undefined) {
        return res.status(400).json({ error: `Question ${i + 1} is missing required fields (subjectId, question, optionA-D, answerIndex)` });
      }
    }

    const created = await prisma.question.createMany({
      data: questions,
    });

    res.status(201).json({ count: created.count });
  } catch (err) {
    console.error("Bulk create error:", err);
    res.status(500).json({ error: err.message || "Failed to create questions" });
  }
});

// Update question (teacher only)
router.patch("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ["question", "optionA", "optionB", "optionC", "optionD", "answerIndex", "difficulty", "year", "explanation", "topic"];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const updated = await prisma.question.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error("Update question error:", err);
    res.status(500).json({ error: err.message || "Failed to update question" });
  }
});

// Delete question (teacher only)
router.delete("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete question error:", err);
    res.status(500).json({ error: err.message || "Failed to delete question" });
  }
});

export default router;
