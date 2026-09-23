import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NIGERIAN_INSTITUTIONS } from "../lib/institutions.js";

const router = express.Router();

// GET /api/universities — list all, with optional search ?q=lagos
router.get("/", async (req, res) => {
  try {
    const { q, type } = req.query;
    const where = {};
    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }
    if (type) {
      where.type = type;
    }
    const rows = await prisma.university.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { departments: true, userProfiles: true } },
      },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id — single university with departments
router.get("/:id", async (req, res) => {
  try {
    const row = await prisma.university.findUnique({
      where: { id: req.params.id },
      include: {
        departments: {
          orderBy: { name: "asc" },
          include: { _count: { select: { subjects: true } } },
        },
        _count: { select: { userProfiles: true } },
      },
    });
    if (!row) return res.status(404).json({ error: "University not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/departments — departments for a university
router.get("/:id/departments", async (req, res) => {
  try {
    const depts = await prisma.department.findMany({
      where: {
        OR: [
          { universityId: req.params.id },
          { universityId: null },
        ],
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { subjects: true } } },
    });
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities — TEACHER/LECTURER/ADMIN only
router.post("/", requireAuth, requireRole("TEACHER", "LECTURER", "ADMIN"), async (req, res) => {
  try {
    const { name, type, country, city } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    // Case-insensitive duplicate check before creating
    const existing = await prisma.university.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });
    if (existing) return res.status(409).json({ error: "University already exists", existing });

    const uni = await prisma.university.create({
      data: {
        name: name.trim(),
        type: type || "university",
        country: country || "Nigeria",
        city: city || null,
      },
    });
    res.status(201).json(uni);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "University already exists" });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/universities/:id — TEACHER/LECTURER/ADMIN only
router.put("/:id", requireAuth, requireRole("TEACHER", "LECTURER", "ADMIN"), async (req, res) => {
  try {
    const { name, type, country, city } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const existing = await prisma.university.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "University not found" });

    // Check for duplicate name (case-insensitive, excluding self)
    const dup = await prisma.university.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" }, NOT: { id: req.params.id } },
    });
    if (dup) return res.status(409).json({ error: "Another university with this name already exists" });

    const updated = await prisma.university.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        ...(type && { type }),
        ...(country && { country }),
        ...(city !== undefined && { city: city || null }),
      },
    });
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "University name already exists" });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/:id/departments — create department under university
router.post("/:id/departments", requireAuth, requireRole("TEACHER", "LECTURER", "ADMIN"), async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const uni = await prisma.university.findUnique({ where: { id: req.params.id } });
    if (!uni) return res.status(404).json({ error: "University not found" });
    const dept = await prisma.department.create({
      data: { name, icon: icon || null, universityId: req.params.id },
    });
    res.status(201).json(dept);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Department already exists" });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/seed — seed Nigerian institutions (admin only)
router.post("/seed", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  try {
    const seeds = NIGERIAN_INSTITUTIONS.map((i) => ({
      name: i.name,
      type: i.type || "university",
      country: "Nigeria",
      city: i.city || null,
    }));
    let created = 0;
    for (const seed of seeds) {
      try {
        await prisma.university.create({ data: seed });
        created++;
      } catch {}
    }
    res.json({ created, message: `Seeded ${created} universities` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
