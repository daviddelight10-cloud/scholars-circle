import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const REPORT_REASONS = ["outdated", "errors", "course", "spam", "copyright"];
const REPORT_TARGET_TYPES = ["folder", "resource"];

// Public copyright endpoint: cap submissions per IP so the report queue can't
// be flooded anonymously. In-memory store is per-instance — good enough for v1.
const copyrightLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many submissions — please try again later" },
});

const clip = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

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

// POST /api/reports/copyright — Public copyright takedown notice (no account).
// Rights holders shouldn't have to sign up to report infringement. Accepts a
// share link (/resources/:token or /folders/:token) or explicit target id.
router.post("/copyright", copyrightLimiter, async (req, res) => {
  try {
    const { targetUrl, targetType, targetId, contactName, contactEmail, claimDescription, evidenceUrl, declarationAccepted, note } = req.body || {};

    if (!declarationAccepted) {
      return res.status(400).json({ error: "You must confirm the declaration to submit a copyright notice" });
    }
    const name = clip(contactName, 120);
    const contact = clip(contactEmail, 200);
    const claim = clip(claimDescription, 2000);
    if (!name || !contact || !claim) {
      return res.status(400).json({ error: "Name, contact, and a description of the copyrighted work are required" });
    }

    // Resolve the target — a share link or explicit targetType + targetId.
    let resolvedType = null;
    let resolvedId = null;
    const urlMatch = typeof targetUrl === "string" && targetUrl.trim()
      ? targetUrl.trim().match(/\/(resources|folders)\/([A-Za-z0-9_-]{4,})/)
      : null;
    if (urlMatch) {
      resolvedType = urlMatch[1] === "resources" ? "resource" : "folder";
      const token = urlMatch[2];
      if (resolvedType === "resource") {
        const r = await prisma.resource.findUnique({ where: { shareToken: token }, select: { id: true } });
        resolvedId = r?.id;
      } else {
        const f = await prisma.folder.findFirst({ where: { shareToken: token, deletedAt: null }, select: { id: true } });
        resolvedId = f?.id;
      }
      if (!resolvedId) {
        return res.status(404).json({ error: "We couldn't find that content — check the link and try again" });
      }
    } else if (REPORT_TARGET_TYPES.includes(targetType) && typeof targetId === "string") {
      const exists = targetType === "folder"
        ? !!(await prisma.folder.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true } }))
        : !!(await prisma.resource.findUnique({ where: { id: targetId }, select: { id: true } }));
      if (!exists) return res.status(404).json({ error: "Reported item not found" });
      resolvedType = targetType;
      resolvedId = targetId;
    } else {
      return res.status(400).json({ error: "A link to the material (or its ID) is required" });
    }

    // Each external notice is a separate legal claim — no dedupe across guests.
    const report = await prisma.report.create({
      data: {
        reporterId: null,
        targetType: resolvedType,
        targetId: resolvedId,
        reason: "copyright",
        contactName: name,
        contactEmail: contact,
        claimDescription: claim,
        evidenceUrl: clip(evidenceUrl, 500),
        declarationAccepted: true,
        note: clip(note, 2000),
      },
    });

    res.status(201).json({ success: true, id: report.id });
  } catch (error) {
    console.error("Error creating copyright report:", error);
    res.status(500).json({ error: "Failed to submit notice" });
  }
});

export default router;
