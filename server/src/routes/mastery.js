import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/mastery/session
// Body: { subjectId, topicId?, results: [{ questionId, correct }] }
router.post("/session", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { subjectId, topicId, results } = req.body;

    if (!subjectId || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: "subjectId and results[] required" });
    }

    // Upsert each QuestionAttempt
    await Promise.all(
      results.map(({ questionId, correct }) =>
        prisma.questionAttempt.upsert({
          where: { userId_questionId: { userId, questionId } },
          update: {
            attemptCount: { increment: 1 },
            lastAttempted: new Date(),
            ...(correct ? { everCorrect: true } : {}),
          },
          create: {
            userId,
            questionId,
            everCorrect: !!correct,
            attemptCount: 1,
          },
        })
      )
    );

    // Recompute SubjectMastery: count unique questions ever correct
    const [totalQs, correctQs] = await Promise.all([
      prisma.question.count({ where: { subjectId } }),
      prisma.questionAttempt.count({
        where: { userId, question: { subjectId }, everCorrect: true },
      }),
    ]);

    const masteryPct = totalQs > 0 ? Math.round((correctQs / totalQs) * 100) : 0;

    const masteryRow = await prisma.subjectMastery.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      update: {
        totalQuestions: totalQs,
        questionsCorrect: correctQs,
        masteryPct,
        lastUpdated: new Date(),
      },
      create: {
        userId,
        subjectId,
        totalQuestions: totalQs,
        questionsCorrect: correctQs,
        masteryPct,
      },
    });

    // Keep backward-compatible JSON blob in UserProgress
    const progress = await prisma.userProgress.findUnique({ where: { userId } });
    if (progress) {
      const masteryJson = typeof progress.mastery === "object" ? progress.mastery : {};
      masteryJson[subjectId] = masteryPct;
      await prisma.userProgress.update({
        where: { userId },
        data: { mastery: masteryJson },
      });
    }

    const justMastered = masteryPct === 100;

    // Award XP bonus for 100% mastery (if first time reaching it)
    let xpBonus = 0;
    if (justMastered && progress) {
      const alreadyBonused = progress.mastery?.[subjectId] === 100;
      if (!alreadyBonused) {
        xpBonus = 500;
        await prisma.userProgress.update({
          where: { userId },
          data: { xp: { increment: xpBonus } },
        });
      }
    }

    res.json({ masteryRow, masteryPct, justMastered, xpBonus });
  } catch (err) {
    console.error("mastery/session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mastery/peer/:subjectId — anonymised peer comparison
router.get("/peer/:subjectId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { subjectId } = req.params;

    const all = await prisma.subjectMastery.findMany({
      where: { subjectId },
      select: { userId: true, masteryPct: true },
    });

    if (all.length === 0) {
      return res.json({ yourPct: 0, classAvg: 0, topPct: 0, rank: null, totalStudents: 0 });
    }

    const pcts = all.map((r) => r.masteryPct).sort((a, b) => b - a);
    const mine = all.find((r) => r.userId === userId);
    const yourPct = mine ? mine.masteryPct : 0;
    const classAvg = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
    const topPct = pcts[0];
    const rank = pcts.indexOf(yourPct) + 1;

    res.json({ yourPct, classAvg, topPct, rank, totalStudents: all.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mastery/grid/:subjectId — per-question mastery grid (max 100)
router.get("/grid/:subjectId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { subjectId } = req.params;

    const questions = await prisma.question.findMany({
      where: { subjectId },
      select: { id: true, topic: true, difficulty: true },
      orderBy: { topic: "asc" },
    });

    const attempts = await prisma.questionAttempt.findMany({
      where: { userId, questionId: { in: questions.map((q) => q.id) } },
      select: { questionId: true, everCorrect: true, attemptCount: true },
    });

    const attemptMap = Object.fromEntries(attempts.map((a) => [a.questionId, a]));

    const grid = questions.map((q) => {
      const att = attemptMap[q.id];
      return {
        id: q.id,
        topic: q.topic || "General",
        difficulty: q.difficulty,
        status: att ? (att.everCorrect ? "correct" : "wrong") : "unseen",
        attemptCount: att?.attemptCount || 0,
      };
    });

    res.json({ grid, total: questions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
