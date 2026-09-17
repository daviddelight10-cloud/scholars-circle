import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const REPORT_REASONS = ["outdated", "errors", "course", "spam"];
const REPORT_TARGET_TYPES = ["folder", "resource"];

// POST /api/reports — Report a folder or resource
router.post("/", requireAuth, async (req, res) => {
  try {
    const { targetType, targetId, reason, note } = req.body;

    if (!REPORT_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ error: "Invalid target type" });
    }
    if (!targetId || typeof targetId !== "string") {
      return res.status(400).json({ error: "Target id is required" });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ error: "Invalid reason" });
    }

    // Verify the target exists (and is not soft-deleted for folders)
    let exists = false;
    if (targetType === "folder") {
      const folder = await prisma.folder.findUnique({ where: { id: targetId }, select: { id: true, deletedAt: true } });
      exists = !!folder && !folder.deletedAt;
    } else {
      const resource = await prisma.resource.findUnique({ where: { id: targetId }, select: { id: true } });
      exists = !!resource;
    }
    if (!exists) {
      return res.status(404).json({ error: "Reported item not found" });
    }

    // One report per user per target — allow updating the reason/note
    const report = await prisma.report.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId: req.user.sub,
          targetType,
          targetId,
        },
      },
      create: {
        reporterId: req.user.sub,
        targetType,
        targetId,
        reason,
        note: note?.trim() ? note.trim().slice(0, 2000) : null,
      },
      update: {
        reason,
        note: note?.trim() ? note.trim().slice(0, 2000) : null,
      },
    });

    res.status(201).json({ success: true, id: report.id });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

export default router;
