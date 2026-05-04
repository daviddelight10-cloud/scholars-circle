import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { subjectId, difficulty, year } = req.query;
  const rows = await prisma.question.findMany({
    where: {
      ...(subjectId ? { subjectId } : {}),
      ...(difficulty ? { difficulty: String(difficulty) } : {}),
      ...(year ? { year: Number(year) } : {}),
    },
  });
  res.json(rows);
});

router.post("/", requireAuth, requireRole("TEACHER"), async (req, res) => {
  const q = await prisma.question.create({ data: req.body });
  res.status(201).json(q);
});

export default router;
