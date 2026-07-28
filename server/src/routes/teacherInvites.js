import express from "express";
import crypto from "crypto";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Format: SC-TCH-XXXX-XXXX
function generateInviteCode() {
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `SC-TCH-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

// GET /teacher-invites — list all invites (teacher only)
router.get("/", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const invites = await prisma.teacherInvite.findMany({
      orderBy: { createdAt: "desc" }
    });

    // Hydrate creator + user details
    const userIds = new Set();
    invites.forEach((i) => {
      if (i.createdBy) userIds.add(i.createdBy);
      if (i.usedById) userIds.add(i.usedById);
    });
    const users = userIds.size
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, username: true, email: true }
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const now = new Date();
    const enriched = invites.map((i) => ({
      ...i,
      createdByUser: userMap[i.createdBy] || null,
      usedByUser: i.usedById ? userMap[i.usedById] || null : null,
      isExpired: i.expiresAt ? new Date(i.expiresAt) < now : false,
      isUsed: !!i.usedById
    }));
    res.json(enriched);
  } catch (err) {
    console.error("List teacher invites error:", err);
    res.status(500).json({ error: "Failed to fetch invites" });
  }
});

// POST /teacher-invites — generate a new invite code
router.post("/", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const { email, notes, expiresInDays, assignedRole } = req.body || {};

    // Validate role: only LECTURER or TEACHER allowed (default LECTURER)
    const role = assignedRole === "TEACHER" ? "TEACHER" : "LECTURER";

    // Ensure unique code
    let code, attempts = 0;
    while (attempts < 10) {
      code = generateInviteCode();
      const exists = await prisma.teacherInvite.findUnique({ where: { code } });
      if (!exists) break;
      attempts++;
    }

    const expiresAt = expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const invite = await prisma.teacherInvite.create({
      data: {
        code,
        createdBy: req.user.sub || req.user.id,
        assignedRole: role,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
        expiresAt
      }
    });
    res.json(invite);
  } catch (err) {
    console.error("Create invite error:", err);
    res.status(500).json({ error: "Failed to create invite" });
  }
});

// DELETE /teacher-invites/:id — revoke an unused invite
router.delete("/:id", requireAuth, requireRole("TEACHER"), async (req, res) => {
  try {
    const invite = await prisma.teacherInvite.findUnique({ where: { id: req.params.id } });
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.usedById) {
      return res.status(400).json({ error: "Cannot revoke an invite that has already been used" });
    }
    await prisma.teacherInvite.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete invite error:", err);
    res.status(500).json({ error: "Failed to delete invite" });
  }
});

// PUBLIC: GET /teacher-invites/validate/:code — check if a code is valid (no auth — used on signup)
router.get("/validate/:code", async (req, res) => {
  try {
    const invite = await prisma.teacherInvite.findUnique({ where: { code: req.params.code } });
    if (!invite) return res.json({ valid: false, reason: "not_found" });
    if (invite.usedById) return res.json({ valid: false, reason: "already_used" });
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.json({ valid: false, reason: "expired" });
    }
    res.json({ valid: true, hint: invite.email ? `Assigned to ${invite.email}` : null });
  } catch (err) {
    res.status(500).json({ error: "Validation failed" });
  }
});

export default router;
export { generateInviteCode };
