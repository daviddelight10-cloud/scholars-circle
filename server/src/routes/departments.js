import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /api/departments — public, list all departments (optional ?universityId=xxx)
router.get("/", async (req, res) => {
  try {
    const { universityId } = req.query;
    const where = {};
    if (universityId) {
      where.OR = [
        { universityId: universityId },
        { universityId: null },
      ];
    }
    const rows = await prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        university: { select: { id: true, name: true } },
        _count: { select: { subjects: true } },
      },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/departments — TEACHER/LECTURER only
router.post("/", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { name, icon, universityId } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const dept = await prisma.department.create({
      data: { name, icon: icon || null, universityId: universityId || null },
    });
    res.status(201).json(dept);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Department already exists" });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/departments/:id
router.patch("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { name, icon } = req.body;
    const dept = await prisma.department.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(icon !== undefined && { icon }) },
    });
    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/departments/:id — only if no subjects assigned
router.delete("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const count = await prisma.subject.count({ where: { departmentId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ error: `Cannot delete — ${count} course(s) still assigned to this department.` });
    }
    await prisma.department.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/departments/user — get current user's department + year level
router.get("/user", requireAuth, async (req, res) => {
  try {
    const row = await prisma.userDepartment.findUnique({
      where: { userId: req.user.sub },
      include: { department: true },
    });
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/departments/user — set user's department + year level
router.post("/user", requireAuth, async (req, res) => {
  try {
    const { departmentId, yearLevel, semester, universityId } = req.body;
    if (!departmentId || !yearLevel) {
      return res.status(400).json({ error: "departmentId and yearLevel required" });
    }
    const row = await prisma.userDepartment.upsert({
      where: { userId: req.user.sub },
      update: { departmentId, universityId: universityId || null, yearLevel: Number(yearLevel), semester: semester || null, setAt: new Date() },
      create: { userId: req.user.sub, departmentId, universityId: universityId || null, yearLevel: Number(yearLevel), semester: semester || null },
      include: { department: true, university: { select: { id: true, name: true } } },
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
