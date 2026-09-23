import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { NIGERIAN_INSTITUTIONS } from "../lib/institutions.js";

const router = express.Router();

// GET /api/profile — get current user's profile
router.get("/", requireAuth, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.sub },
      include: {
        university: { select: { id: true, name: true, type: true, city: true } },
      },
    });

    // Also fetch userDepartment for backward compat
    const userDept = await prisma.userDepartment.findUnique({
      where: { userId: req.user.sub },
      include: {
        department: { select: { id: true, name: true, icon: true } },
        university: { select: { id: true, name: true, type: true } },
      },
    });

    res.json({ profile, userDept });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profile — upsert current user's profile
router.put("/", requireAuth, async (req, res) => {
  try {
    const {
      fullName,
      avatar,
      discipline,
      level,
      institution,
      universityId,
      schoolName,
      department,
      programme,
      matricNumber,
      bio,
      learningStyle,
      goals,
      targetGrade,
      studyHoursPerDay,
      isUniversityStudent,
      // Department sync fields
      departmentId,
      yearLevel,
      semester,
      courses,
    } = req.body;

    // Resolve universityId — clients may send fallback ids (e.g. "ng-12")
    // that are not real DB rows; a bad FK would fail the entire upsert.
    let resolvedUniversityId = universityId || null;
    if (resolvedUniversityId) {
      const exists = await prisma.university.findUnique({
        where: { id: resolvedUniversityId },
        select: { id: true },
      });
      if (!exists) resolvedUniversityId = null;
    }

    // Fallback picks / plain names: find-or-create a University row by name so
    // the profile gets a real FK. Only names in the institution catalog get
    // auto-created rows (keeps the table clean of typos).
    if (!resolvedUniversityId && institution && String(institution).trim()) {
      const instName = String(institution).trim();
      const catalog = NIGERIAN_INSTITUTIONS.find(
        (i) => i.name.toLowerCase() === instName.toLowerCase()
      );
      if (catalog) {
        try {
          const uni = await prisma.university.upsert({
            where: { name: catalog.name },
            update: {},
            create: {
              name: catalog.name,
              type: catalog.type || "university",
              country: "Nigeria",
              city: catalog.city || null,
            },
            select: { id: true },
          });
          resolvedUniversityId = uni.id;
        } catch {}
      }
    }

    const data = {
      fullName,
      avatar,
      discipline,
      level,
      institution,
      universityId: resolvedUniversityId,
      schoolName,
      department,
      programme,
      matricNumber,
      bio,
      learningStyle,
      goals,
      targetGrade,
      studyHoursPerDay: studyHoursPerDay ? Number(studyHoursPerDay) : undefined,
      isUniversityStudent: isUniversityStudent !== undefined ? Boolean(isUniversityStudent) : undefined,
      ...(Array.isArray(courses) && { courses }),
    };

    // Remove undefined values
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    const profile = await prisma.userProfile.upsert({
      where: { userId: req.user.sub },
      update: data,
      create: {
        userId: req.user.sub,
        ...data,
      },
      include: {
        university: { select: { id: true, name: true, type: true, city: true } },
      },
    });

    // Sync UserDepartment if departmentId is provided
    if (departmentId && yearLevel) {
      await prisma.userDepartment.upsert({
        where: { userId: req.user.sub },
        update: {
          departmentId,
          universityId: resolvedUniversityId,
          yearLevel: Number(yearLevel),
          semester: semester || null,
          setAt: new Date(),
        },
        create: {
          userId: req.user.sub,
          departmentId,
          universityId: resolvedUniversityId,
          yearLevel: Number(yearLevel),
          semester: semester || null,
        },
      });
    }

    res.json(profile);
  } catch (err) {
    console.error("Profile save error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/profile — reset profile (admin/debug only)
router.delete("/", requireAuth, async (req, res) => {
  try {
    await prisma.userProfile.deleteMany({ where: { userId: req.user.sub } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
