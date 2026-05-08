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
  res.json(rows);
});

router.post("/", requireAuth, requireRole("TEACHER"), async (req, res) => {
  const row = await prisma.subject.create({
    data: { label: req.body.label, description: req.body.description || null },
  });
  res.status(201).json(row);
});

export default router;
