import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const { title, questionIds } = req.body;
  const row = await prisma.challenge.create({
    data: { title, questionIds, createdById: req.user.sub },
  });
  res.status(201).json(row);
});

router.get("/:id", async (req, res) => {
  const row = await prisma.challenge.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const questions = await prisma.question.findMany({ where: { id: { in: row.questionIds } } });
  return res.json({ ...row, questions });
});

export default router;
