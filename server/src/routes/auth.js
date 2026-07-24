import express from "express";

import { z } from "zod";

import { createClient } from "@supabase/supabase-js";

import { prisma } from "../db.js";

import { generateActivationKey } from "./keys.js";

import { requireAuth, requireSupabaseAuth, invalidateUserCache } from "../middleware/auth.js";

import { logSecurityEvent } from "../lib/logger.js";



const router = express.Router();

// Supabase admin client for server-side auth operations (user deletion, metadata updates)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const profileSchema = z.object({

  fullName: z.string().optional(),

  email: z.string().email().optional(),

  role: z.enum(["STUDENT", "TEACHER", "LECTURER"]).optional(),

  inviteCode: z.string().optional(),

});

// POST /auth/profile — Create Prisma User profile after Supabase signup
// Called by the frontend after supabase.auth.signUp() succeeds
router.post("/profile", requireSupabaseAuth, async (req, res) => {

  try {

    const data = profileSchema.parse(req.body);

    const supabaseId = req.user.supabaseId;
    const email = req.user.email || data.email;

    if (!supabaseId || !email) {
      return res.status(400).json({ error: "Missing Supabase user ID or email from token" });
    }

    // Check if profile already exists
    const existing = await prisma.user.findUnique({ where: { supabaseId } });

    if (existing) {
      return res.json({
        id: existing.id,
        email: existing.email,
        username: existing.username,
        fullName: existing.fullName,
        role: existing.role,
        activationKey: existing.activationKey,
        isActivated: existing.isActivated,
        planType: existing.planType || null,
        activationExpiry: existing.activationExpiry || null,
        activatedAt: existing.activatedAt || null,
      });
    }

    let desiredRole = data.role || "STUDENT";
    let usedInvite = null;

    // Faculty signup requires an invite code
    if (desiredRole !== "STUDENT") {

      if (!data.inviteCode) {
        return res.status(403).json({ error: "Faculty invite code is required" });
      }

      const invite = await prisma.teacherInvite.findUnique({ where: { code: data.inviteCode } });

      if (invite) {
        if (invite.usedById) {
          return res.status(403).json({ error: "This invite code has already been used" });
        }
        if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
          return res.status(403).json({ error: "This invite code has expired" });
        }
        if (invite.email && email.toLowerCase() !== invite.email.toLowerCase()) {
          return res.status(403).json({ error: `This invite code is reserved for ${invite.email}` });
        }
        usedInvite = invite;
        desiredRole = invite.assignedRole || "LECTURER";
      } else {
        const expected = process.env.TEACHER_INVITE_CODE || "";
        if (!expected || data.inviteCode !== expected) {
          return res.status(403).json({ error: "Invalid invite code" });
        }
        desiredRole = "TEACHER";
      }

    }

    // Generate unique activation key for students
    let activationKey = null;
    if (desiredRole === "STUDENT") {
      let unique = false;
      while (!unique) {
        activationKey = generateActivationKey();
        const existingKey = await prisma.user.findUnique({ where: { activationKey } });
        if (!existingKey) unique = true;
      }
    }

    const user = await prisma.user.create({

      data: {
        email,
        supabaseId,
        fullName: data.fullName || null,
        role: desiredRole,
        activationKey,
        isActivated: desiredRole !== "STUDENT",
      },

    });

    // Mark invite as used
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

    // Update Supabase user's app_metadata with prismaId and role
    // This enables the fast path in auth middleware (no DB lookup needed)
    try {
      await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
        app_metadata: { prismaId: user.id, role: user.role },
      });
    } catch (e) {
      console.error("Failed to update Supabase app_metadata:", e.message);
      // Non-fatal — DB lookup fallback will work
    }

    // Invalidate cache
    invalidateUserCache(supabaseId);

    return res.status(201).json({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      activationKey: user.activationKey,
      isActivated: user.isActivated,
      planType: user.planType || null,
      activationExpiry: user.activationExpiry || null,
      activatedAt: user.activatedAt || null,
    });

  } catch (e) {
    console.error("Profile creation error:", e);

    if (e instanceof z.ZodError) {
      const firstError = e.errors[0];
      return res.status(400).json({
        error: firstError.message,
        field: firstError.path.join('.'),
        details: e.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
      });
    }

    if (e.code === "P2002") {
      const target = e.meta?.target || [];
      const field = Array.isArray(target) && target.includes("email") ? "email" : "supabaseId";
      return res.status(400).json({ error: `An account with that ${field} already exists.` });
    }

    return res.status(400).json({
      error: e.message || "Failed to create profile. Please try again.",
      details: e.message
    });

  }

});



// GET /auth/refresh — Fetch user's app profile using Supabase session token
// No new token is issued — Supabase handles token refresh on the frontend
router.get("/refresh", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { supabaseId: req.user.supabaseId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        activationKey: true,
        isActivated: true,
        activationExpiry: true,
        planType: true,
        activatedAt: true,
        totalXp: true,
        freeTrialViews: true,
        freeTrialLimit: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User profile not found", code: "PROFILE_NOT_FOUND" });
    }

    // Check if activation has expired and deactivate if so
    let isActivated = user.isActivated;
    if (user.isActivated && user.activationExpiry) {
      const now = new Date();
      const expiry = new Date(user.activationExpiry);
      if (now > expiry) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isActivated: false },
        });
        isActivated = false;
        console.log(`[auth/refresh] User ${user.username || user.email} deactivated — key expired at ${user.activationExpiry}`);
      }
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName || null,
        role: user.role,
        activationKey: user.activationKey,
        isActivated,
        planType: user.planType || null,
        activationExpiry: user.activationExpiry || null,
        activatedAt: user.activatedAt || null,
        totalXp: user.totalXp || 0,
        freeTrialViews: user.freeTrialViews ?? 0,
        freeTrialLimit: user.freeTrialLimit ?? 3,
      },
    });
  } catch (e) {
    console.error("Refresh error:", e);
    return res.status(400).json({ error: "Failed to refresh auth status" });
  }
});

// DELETE /auth/delete-account — Delete user account from both Supabase and Prisma
router.delete("/delete-account", requireAuth, async (req, res) => {
  try {
    const supabaseId = req.user.supabaseId;
    const prismaId = req.user.sub;

    // Delete from Supabase Auth
    if (supabaseId) {
      const { error: supaError } = await supabaseAdmin.auth.admin.deleteUserById(supabaseId);
      if (supaError) {
        console.error("Failed to delete Supabase user:", supaError.message);
        // Continue to delete Prisma record anyway
      }
    }

    // Delete from Prisma (cascades to all related data)
    await prisma.user.delete({
      where: { id: prismaId },
    });

    // Invalidate cache
    invalidateUserCache(supabaseId);

    // Clear httpOnly cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    logSecurityEvent(prismaId, 'account_deleted', {}, req);

    return res.json({ message: "Account deleted successfully" });
  } catch (e) {
    console.error("Delete account error:", e);
    return res.status(400).json({ error: "Failed to delete account", details: e.message });
  }
});




export default router;
