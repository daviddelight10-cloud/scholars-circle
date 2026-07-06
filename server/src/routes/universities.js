import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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
      where: { universityId: req.params.id },
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
    const uni = await prisma.university.create({
      data: {
        name,
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

// POST /api/universities/seed — seed initial Nigerian universities (admin only)
router.post("/seed", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  try {
    const seeds = [
      { name: "University of Lagos", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "University of Ibadan", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "University of Nigeria, Nsukka", type: "university", country: "Nigeria", city: "Nsukka" },
      { name: "Obafemi Awolowo University", type: "university", country: "Nigeria", city: "Ile-Ife" },
      { name: "University of Benin", type: "university", country: "Nigeria", city: "Benin City" },
      { name: "Ahmadu Bello University", type: "university", country: "Nigeria", city: "Zaria" },
      { name: "University of Ilorin", type: "university", country: "Nigeria", city: "Ilorin" },
      { name: "Covenant University", type: "university", country: "Nigeria", city: "Ota" },
      { name: "Federal University of Technology, Akure", type: "university", country: "Nigeria", city: "Akure" },
      { name: "University of Port Harcourt", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "Lagos State University", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "Bayero University Kano", type: "university", country: "Nigeria", city: "Kano" },
      { name: "Nnamdi Azikiwe University", type: "university", country: "Nigeria", city: "Awka" },
      { name: "Yaba College of Technology", type: "polytechnic", country: "Nigeria", city: "Lagos" },
      { name: "Federal Polytechnic, Ilaro", type: "polytechnic", country: "Nigeria", city: "Ilaro" },
      { name: "Kaduna Polytechnic", type: "polytechnic", country: "Nigeria", city: "Kaduna" },
    ];
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
