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
      // ── Federal Universities with Medical/Health Sciences ──
      { name: "Ahmadu Bello University", type: "university", country: "Nigeria", city: "Zaria" },
      { name: "Bayero University, Kano", type: "university", country: "Nigeria", city: "Kano" },
      { name: "Federal University of Health Sciences, Azare", type: "university", country: "Nigeria", city: "Azare" },
      { name: "Federal University of Health Sciences, Ila-Orangun", type: "university", country: "Nigeria", city: "Ila-Orangun" },
      { name: "Federal University of Health Sciences, Otukpo", type: "university", country: "Nigeria", city: "Otukpo" },
      { name: "Nnamdi Azikiwe University", type: "university", country: "Nigeria", city: "Awka" },
      { name: "Obafemi Awolowo University", type: "university", country: "Nigeria", city: "Ile-Ife" },
      { name: "University of Abuja", type: "university", country: "Nigeria", city: "Gwagwalada" },
      { name: "University of Benin", type: "university", country: "Nigeria", city: "Benin City" },
      { name: "University of Calabar", type: "university", country: "Nigeria", city: "Calabar" },
      { name: "University of Ibadan", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "University of Ilorin", type: "university", country: "Nigeria", city: "Ilorin" },
      { name: "University of Jos", type: "university", country: "Nigeria", city: "Jos" },
      { name: "University of Lagos", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "University of Maiduguri", type: "university", country: "Nigeria", city: "Maiduguri" },
      { name: "University of Nigeria, Nsukka", type: "university", country: "Nigeria", city: "Nsukka" },
      { name: "University of Port Harcourt", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "University of Uyo", type: "university", country: "Nigeria", city: "Uyo" },
      { name: "Usmanu Danfodiyo University", type: "university", country: "Nigeria", city: "Sokoto" },

      // ── State Universities with Medical/Health Sciences ──
      { name: "Abia State University", type: "university", country: "Nigeria", city: "Uturu" },
      { name: "Ambrose Alli University", type: "university", country: "Nigeria", city: "Ekpoma" },
      { name: "Bayelsa Medical University", type: "university", country: "Nigeria", city: "Yenagoa" },
      { name: "Benue State University", type: "university", country: "Nigeria", city: "Makurdi" },
      { name: "Chukwuemeka Odumegwu Ojukwu University", type: "university", country: "Nigeria", city: "Uli" },
      { name: "Delta State University, Abraka", type: "university", country: "Nigeria", city: "Abraka" },
      { name: "Ebonyi State University", type: "university", country: "Nigeria", city: "Abakaliki" },
      { name: "Edo State University, Uzairue", type: "university", country: "Nigeria", city: "Iyamho" },
      { name: "Ekiti State University", type: "university", country: "Nigeria", city: "Ado-Ekiti" },
      { name: "Gombe State University", type: "university", country: "Nigeria", city: "Gombe" },
      { name: "Imo State University", type: "university", country: "Nigeria", city: "Owerri" },
      { name: "Kaduna State University", type: "university", country: "Nigeria", city: "Kaduna" },
      { name: "Kwara State University", type: "university", country: "Nigeria", city: "Malete" },
      { name: "Ladoke Akintola University of Technology", type: "university", country: "Nigeria", city: "Ogbomoso" },
      { name: "Lagos State University", type: "university", country: "Nigeria", city: "Ojo" },
      { name: "Nasarawa State University, Keffi", type: "university", country: "Nigeria", city: "Keffi" },
      { name: "Niger Delta University", type: "university", country: "Nigeria", city: "Amassoma" },
      { name: "Olabisi Onabanjo University", type: "university", country: "Nigeria", city: "Ago-Iwoye" },
      { name: "Osun State University", type: "university", country: "Nigeria", city: "Osogbo" },
      { name: "Rivers State University", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "Sokoto State University", type: "university", country: "Nigeria", city: "Sokoto" },

      // ── Private Universities with Medical/Health Sciences ──
      { name: "Afe Babalola University", type: "university", country: "Nigeria", city: "Ado-Ekiti" },
      { name: "Babcock University", type: "university", country: "Nigeria", city: "Ilishan-Remo" },
      { name: "Bingham University", type: "university", country: "Nigeria", city: "Karu" },
      { name: "Benson Idahosa University", type: "university", country: "Nigeria", city: "Benin City" },
      { name: "Igbinedion University", type: "university", country: "Nigeria", city: "Okada" },
      { name: "Madonna University", type: "university", country: "Nigeria", city: "Elele" },
      { name: "PAMO University of Medical Sciences", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "Redeemer's University", type: "university", country: "Nigeria", city: "Ede" },
      { name: "Nile University of Nigeria", type: "university", country: "Nigeria", city: "Abuja" },
      { name: "Novena University", type: "university", country: "Nigeria", city: "Ogume" },
      { name: "Gregory University", type: "university", country: "Nigeria", city: "Uturu" },
      { name: "Achievers University", type: "university", country: "Nigeria", city: "Owo" },
      { name: "Elizade University", type: "university", country: "Nigeria", city: "Ilara-Mokin" },
      { name: "Wesley University", type: "university", country: "Nigeria", city: "Ondo" },
      { name: "Anchor University", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "Covenant University", type: "university", country: "Nigeria", city: "Ota" },
      { name: "Bowen University", type: "university", country: "Nigeria", city: "Iwo" },
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
