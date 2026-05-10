import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import crypto from "crypto";

const router = express.Router();

// Generate a short unique key like "SC-A3F8-K9D2"
function generateActivationKey() {
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `SC-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

// GET /keys/students — Teachers see all students with their keys & activation status
router.get("/students", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: {
        id: true,
        username: true,
        email: true,
        activationKey: true,
        isActivated: true,
        activatedAt: true,
        activatedBy: true,
        createdAt: true,
        activationExpiry: true,
        planType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Resolve activatedBy usernames
    const teacherIds = [...new Set(students.filter(s => s.activatedBy).map(s => s.activatedBy))];
    const teachers = teacherIds.length
      ? await prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, username: true } })
      : [];
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.username]));

    const now = new Date();
    const result = students.map(s => {
      // Calculate days remaining
      let daysRemaining = null;
      let isExpired = false;
      
      if (s.activationExpiry) {
        const expiryDate = new Date(s.activationExpiry);
        const diffMs = expiryDate - now;
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isExpired = daysRemaining <= 0;
      }
      
      return {
        ...s,
        activatedByUsername: s.activatedBy ? teacherMap[s.activatedBy] || "Unknown" : null,
        daysRemaining,
        isExpired,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching student keys:", error);
    res.status(500).json({ error: "Failed to fetch student keys" });
  }
});

// POST /keys/activate/:userId — Teacher activates a student key
router.post("/activate/:userId", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const { userId } = req.params;
    const teacherId = req.user.sub;

    const student = await prisma.user.findUnique({ where: { id: userId } });
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "STUDENT") return res.status(400).json({ error: "User is not a student" });
    if (student.isActivated) return res.status(400).json({ error: "Student is already activated" });

    // Calculate expiry date based on duration
    const duration = req.body.duration || "month1";
    const now = new Date();
    let expiryDate = new Date(now);
    
    if (duration === "week1") {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else if (duration === "week2") {
      expiryDate.setDate(expiryDate.getDate() + 14);
    } else {
      expiryDate.setDate(expiryDate.getDate() + 30); // month1
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isActivated: true,
        activatedAt: now,
        activatedBy: teacherId,
        planType: duration,
        activationExpiry: expiryDate,
      },
      select: {
        id: true,
        username: true,
        activationKey: true,
        isActivated: true,
        activatedAt: true,
        activatedBy: true,
      },
    });

    res.json({ ...updated, activatedByUsername: req.user.username });
  } catch (error) {
    console.error("Error activating student:", error);
    res.status(500).json({ error: "Failed to activate student" });
  }
});

// POST /keys/deactivate/:userId — Teacher deactivates a student key
router.post("/deactivate/:userId", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const { userId } = req.params;

    const student = await prisma.user.findUnique({ where: { id: userId } });
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "STUDENT") return res.status(400).json({ error: "User is not a student" });
    if (!student.isActivated) return res.status(400).json({ error: "Student is already deactivated" });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isActivated: false,
        activatedAt: null,
        activatedBy: null,
      },
      select: {
        id: true,
        username: true,
        activationKey: true,
        isActivated: true,
        activatedAt: true,
        activatedBy: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error deactivating student:", error);
    res.status(500).json({ error: "Failed to deactivate student" });
  }
});

// Export the key generator for use in auth registration
export { generateActivationKey };
export default router;
