import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { mode, score, total, durationSec, answers = [] } = req.body;
    const percentage = total > 0 ? (score / total) * 100 : 0;

    // Filter out answers with questionIds that don't exist in DB (e.g. data.js keys like "bio112-0")
    const validAnswers = [];
    for (const a of answers) {
      if (a.questionId && !a.questionId.match(/^[a-z]+\d+-\d+$/)) {
        try {
          await prisma.question.findUnique({ where: { id: a.questionId } });
          validAnswers.push(a);
        } catch { /* skip invalid questionId */ }
      }
      // Skip data.js-style questionIds (they won't exist in DB)
    }

    const session = await prisma.sessionAttempt.create({
      data: {
        userId: req.user.sub,
        mode,
        score,
        total,
        percentage,
        durationSec: durationSec || null,
        answers: {
          create: validAnswers.map((a) => ({
            questionId: a.questionId,
            selected: a.selected,
            correct: !!a.correct,
            confidence: a.confidence || null,
          })),
        },
      },
      include: { answers: true },
    });
    res.status(201).json(session);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to save session" });
  }
});

router.get("/mine", requireAuth, async (req, res) => {
  const rows = await prisma.sessionAttempt.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(rows);
});

export default router;
