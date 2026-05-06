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
        activationExpiry: true,
        planType: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Resolve activatedBy usernames
    const teacherIds = [...new Set(students.filter(s => s.activatedBy).map(s => s.activatedBy))];
    const teachers = teacherIds.length
      ? await prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, username: true } })
      : [];
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.username]));

    const result = students.map(s => ({
      ...s,
      activatedByUsername: s.activatedBy ? teacherMap[s.activatedBy] || "Unknown" : null,
      isExpired: s.activationExpiry ? new Date(s.activationExpiry) < new Date() : false,
    }));

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
    const { duration = "month1" } = req.body; // week1, week2, month1
    const teacherId = req.user.sub;

    const student = await prisma.user.findUnique({ where: { id: userId } });
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "STUDENT") return res.status(400).json({ error: "User is not a student" });
    if (student.isActivated) return res.status(400).json({ error: "Student is already activated" });

    // Calculate expiry date based on duration
    const now = new Date();
    let activationExpiry;
    switch (duration) {
      case "week1":
        activationExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case "week2":
        activationExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case "month1":
        activationExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        activationExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isActivated: true,
        activatedAt: new Date(),
        activatedBy: teacherId,
        activationExpiry,
        planType: duration,
        paymentStatus: "verified",
      },
      select: {
        id: true,
        username: true,
        activationKey: true,
        isActivated: true,
        activatedAt: true,
        activatedBy: true,
        activationExpiry: true,
        planType: true,
        paymentStatus: true,
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
