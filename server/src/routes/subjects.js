import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { departmentId, yearLevel } = req.query;

  const where = {};
  if (departmentId) where.departmentId = departmentId;
  if (yearLevel) where.yearLevel = Number(yearLevel);

  const rows = await prisma.subject.findMany({
    where,
    orderBy: { label: "asc" },
    include: {
      subjectDepts: { select: { departmentId: true } },
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
          explanation: true,
          topicId: true,
          topic: true,
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
      explanation: q.explanation,
      topicId: q.topicId,
      topic: q.topic,
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

router.patch("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { label, description, departmentId, yearLevel, icon, departmentIds } = req.body;
    const updated = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        ...(label && { label }),
        ...(description !== undefined && { description }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(yearLevel !== undefined && { yearLevel: yearLevel ? Number(yearLevel) : null }),
        ...(icon !== undefined && { icon }),
      },
    });
    // Handle multi-department assignment
    if (Array.isArray(departmentIds)) {
      await prisma.subjectDepartment.deleteMany({ where: { subjectId: req.params.id } });
      if (departmentIds.length > 0) {
        await prisma.subjectDepartment.createMany({
          data: departmentIds.map(did => ({ subjectId: req.params.id, departmentId: did })),
          skipDuplicates: true,
        });
      }
      // Sync primary departmentId with first selection (or null if none)
      await prisma.subject.update({
        where: { id: req.params.id },
        data: { departmentId: departmentIds[0] ?? null },
      });
    }
    const result = await prisma.subject.findUnique({
      where: { id: req.params.id },
      include: { subjectDepts: { select: { departmentId: true } } },
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.subject.delete({
      where: { id },
    });
    res.status(200).json({ message: "Subject deleted successfully" });
  } catch (err) {
    console.error("Delete subject error:", err);
    res.status(500).json({ error: err.message || "Failed to delete subject" });
  }
});

export default router;
