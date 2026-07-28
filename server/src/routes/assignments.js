import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (_req, res) => {
  const rows = await prisma.assignment.findMany({
    include: { subject: true, submits: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

router.post("/", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  const { title, subjectId, dueAt } = req.body;
  const row = await prisma.assignment.create({
    data: {
      title,
      subjectId,
      dueAt: dueAt ? new Date(dueAt) : null,
      createdById: req.user.sub,
    },
  });
  res.status(201).json(row);
});

router.post("/:id/submit", requireAuth, async (req, res) => {
  const row = await prisma.assignmentSubmit.upsert({
    where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.sub } },
    update: { status: "submitted", submittedAt: new Date() },
    create: {
      assignmentId: req.params.id,
      studentId: req.user.sub,
      status: "submitted",
      submittedAt: new Date(),
    },
  });
  res.json(row);
});

export default router;
