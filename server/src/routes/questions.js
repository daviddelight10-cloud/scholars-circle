import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

const STAFF_ROLES = ["TEACHER", "LECTURER", "ADMIN"];
const isStaff = (req) => STAFF_ROLES.includes(req.user?.role);

// Get all questions with filters. Students only see the practice pool —
// `secure` questions (CA material) are staff-only so test items stay hidden.
router.get("/", requireAuth, async (req, res) => {
  const { subjectId, difficulty, year, topic, secure } = req.query;
  const rows = await prisma.question.findMany({
    where: {
      ...(subjectId ? { subjectId } : {}),
      ...(difficulty ? { difficulty: String(difficulty) } : {}),
      ...(year ? { year: Number(year) } : {}),
      ...(topic ? { topic: String(topic) } : {}),
      // Students: practice pool only — MCQ + not CA-secured (other types and
      // secure questions would break the A–D practice UI or leak test items).
      ...(isStaff(req) ? (secure !== undefined ? { secure: secure === "true" } : {}) : { secure: false, questionType: "mcq" }),
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
    const { subjectId, question, optionA, optionB, optionC, optionD, answerIndex, difficulty, year, explanation, topic, questionType, answerText, secure } = req.body;
    const type = ["mcq", "truefalse", "fillblank"].includes(questionType) ? questionType : "mcq";
    if (!subjectId || !question) {
      return res.status(400).json({ error: "Missing required fields (subjectId, question)" });
    }
    if (type === "fillblank") {
      if (!answerText || !String(answerText).trim()) return res.status(400).json({ error: "Fill-in questions need an answer" });
    } else if (type === "truefalse") {
      if (![0, 1].includes(Number(answerIndex))) return res.status(400).json({ error: "True/False needs answerIndex 0 (True) or 1 (False)" });
    } else if (!optionA || !optionB || !optionC || !optionD || answerIndex === undefined) {
      return res.status(400).json({ error: "Missing required fields (subjectId, question, optionA-D, answerIndex)" });
    }
    const q = await prisma.question.create({
      data: {
        subjectId, question,
        optionA: type === "truefalse" ? "True" : (optionA || ""),
        optionB: type === "truefalse" ? "False" : (optionB || ""),
        optionC: type === "truefalse" ? "" : (optionC || ""),
        optionD: type === "truefalse" ? "" : (optionD || ""),
        answerIndex: type === "fillblank" ? -1 : Number(answerIndex),
        questionType: type,
        answerText: type === "fillblank" ? String(answerText).trim() : null,
        secure: !!secure,
        difficulty, year, explanation, topic,
      },
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
    const allowed = ["question", "optionA", "optionB", "optionC", "optionD", "answerIndex", "difficulty", "year", "explanation", "topic", "questionType", "answerText", "secure"];
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
