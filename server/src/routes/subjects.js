import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const rows = await prisma.subject.findMany({
    orderBy: { label: "asc" },
    include: {
      questions: {
        select: {
          id: true,
          question: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          answerIndex: true,
          difficulty: true,
          year: true,
          explanation: true
        }
      }
    }
  });
  
  // Transform questions to match frontend format
  const transformedRows = rows.map(subject => ({
    ...subject,
    questions: subject.questions.map(q => ({
      id: q.id,
      q: q.question,
      options: [q.optionA, q.optionB, q.optionC, q.optionD],
      answer: q.answerIndex,
      difficulty: q.difficulty,
      year: q.year,
      explanation: q.explanation
    }))
  }));
  
  res.json(transformedRows);
});

router.post("/", requireAuth, requireRole("TEACHER"), async (req, res) => {
  const row = await prisma.subject.create({
    data: { label: req.body.label, description: req.body.description || null },
  });
  res.status(201).json(row);
});

export default router;
