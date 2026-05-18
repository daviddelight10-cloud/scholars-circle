import express from "express";

import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import { z } from "zod";

import { prisma } from "../db.js";

import { generateActivationKey } from "./keys.js";

import { requireAuth } from "../middleware/auth.js";



const router = express.Router();



const registerSchema = z.object({

  email: z.string().email(),

  username: z.string().min(3),

  password: z.string().min(6),

  role: z.enum(["STUDENT", "TEACHER", "LECTURER"]).optional(),

  inviteCode: z.string().optional(),

});



router.post("/register", async (req, res) => {

  try {

    const data = registerSchema.parse(req.body);

    let desiredRole = data.role || "STUDENT";

    let usedInvite = null; // tracked so we can mark it used after user creation

    // Faculty signup (anyone with a non-student role requires an invite)
    if (desiredRole !== "STUDENT") {

      if (!data.inviteCode) {
        return res.status(403).json({ error: "Faculty invite code is required" });
      }

      // Try DB-stored invite first
      const invite = await prisma.teacherInvite.findUnique({ where: { code: data.inviteCode } });

      if (invite) {
        if (invite.usedById) {
          return res.status(403).json({ error: "This invite code has already been used" });
        }
        if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
          return res.status(403).json({ error: "This invite code has expired" });
        }
        if (invite.email && data.email.toLowerCase() !== invite.email.toLowerCase()) {
          return res.status(403).json({ error: `This invite code is reserved for ${invite.email}` });
        }
        usedInvite = invite;
        // The invite code determines the role granted, not the form selection
        desiredRole = invite.assignedRole || "LECTURER";
      } else {
        // Fallback: legacy global env var (always grants TEACHER)
        const expected = process.env.TEACHER_INVITE_CODE || "";
        if (!expected || data.inviteCode !== expected) {
          return res.status(403).json({ error: "Invalid invite code" });
        }
        desiredRole = "TEACHER";
      }

    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Generate unique activation key for students
    let activationKey = null;
    if (desiredRole === "STUDENT") {
      // Ensure uniqueness
      let unique = false;
      while (!unique) {
        activationKey = generateActivationKey();
        const existing = await prisma.user.findUnique({ where: { activationKey } });
        if (!existing) unique = true;
      }
    }

    const user = await prisma.user.create({

      data: {

        email: data.email,

        username: data.username,

        passwordHash,

        role: desiredRole,

        activationKey,

        isActivated: desiredRole !== "STUDENT",

      },

    });

    // If a DB invite was used, mark it consumed
    if (usedInvite) {
      try {
        await prisma.teacherInvite.update({
          where: { id: usedInvite.id },
          data: { usedById: user.id, usedAt: new Date() }
        });
      } catch (e) {
        console.error("Failed to mark invite used:", e);
      }
    }

    return res.status(201).json({ id: user.id, username: user.username, role: user.role, activationKey: user.activationKey, isActivated: user.isActivated });

  } catch (e) {
    console.error("Registration error:", e);

    if (e.code === "P2002") {
      const target = e.meta?.target || [];
      const field = Array.isArray(target) && target.includes("email") ? "email" : "username";
      return res.status(400).json({ error: `An account with that ${field} already exists. Please use a different ${field} or log in.` });
    }

    return res.status(400).json({ error: "Registration failed", details: e.message });

  }

});



router.post("/login", async (req, res) => {

  const schema = z.object({ login: z.string(), password: z.string() });

  try {

    const { login, password } = schema.parse(req.body);

    const user = await prisma.user.findFirst({

      where: { OR: [{ email: login }, { username: login }] },

    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);

    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    await prisma.loginEvent

      .create({

        data: {

          userId: user.id,

          ip: req.ip || null,

          userAgent: req.headers["user-agent"] || null,

        },

      })

      .catch(() => {});

    const token = jwt.sign({ sub: user.id, role: user.role, username: user.username, isActivated: user.isActivated }, process.env.JWT_SECRET, {

      expiresIn: "7d",

    });

    return res.json({ token, user: { id: user.id, username: user.username, role: user.role, activationKey: user.activationKey, isActivated: user.isActivated } });

  } catch (e) {

    return res.status(400).json({ error: "Login failed", details: e.message });

  }

});



// GET /auth/refresh — Refresh user's auth status and get new token
router.get("/refresh", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        username: true,
        role: true,
        activationKey: true,
        isActivated: true,
        activationExpiry: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if activation has expired and deactivate if so
    let isActivated = user.isActivated;
    if (user.isActivated && user.activationExpiry) {
      const now = new Date();
      const expiry = new Date(user.activationExpiry);
      if (now > expiry) {
        // Key has expired — deactivate the user
        await prisma.user.update({
          where: { id: user.id },
          data: { isActivated: false },
        });
        isActivated = false;
        console.log(`[auth/refresh] User ${user.username} deactivated — key expired at ${user.activationExpiry}`);
      }
    }

    // Generate new token with updated isActivated status
    const token = jwt.sign(
      { sub: user.id, role: user.role, username: user.username, isActivated },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        activationKey: user.activationKey,
        isActivated,
      },
    });
  } catch (e) {
    console.error("Refresh error:", e);
    return res.status(400).json({ error: "Failed to refresh auth status" });
  }
});




// DELETE /auth/delete-account — Delete user account (requires password confirmation)
router.delete("/delete-account", requireAuth, async (req, res) => {
  try {
    const schema = z.object({ password: z.string() });
    const { password } = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Delete user's data cascade
    await prisma.user.delete({
      where: { id: user.id },
    });

    return res.json({ message: "Account deleted successfully" });
  } catch (e) {
    console.error("Delete account error:", e);
    return res.status(400).json({ error: "Failed to delete account", details: e.message });
  }
});




export default router;
