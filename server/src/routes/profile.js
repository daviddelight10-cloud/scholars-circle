import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

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
    } = req.body;

    const data = {
      fullName,
      avatar,
      discipline,
      level,
      institution,
      universityId: universityId || null,
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
          universityId: universityId || null,
          yearLevel: Number(yearLevel),
          semester: semester || null,
          setAt: new Date(),
        },
        create: {
          userId: req.user.sub,
          departmentId,
          universityId: universityId || null,
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
