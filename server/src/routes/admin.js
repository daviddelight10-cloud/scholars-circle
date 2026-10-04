import express from "express";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../db.js";
import { requireAuth, requireRole, invalidateUserCache } from "../middleware/auth.js";
import { sendPushToUsers, isPushConfigured } from "../lib/pushSender.js";
import { logSecurityEvent } from "../lib/logger.js";

const router = express.Router();

// Supabase admin client for user deletion / role metadata updates
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PLAN_PRICES = { week1: 700, week2: 1300, month1: 2400, semester: 7000 };
const PLAN_LABELS = { week1: "1 Week", week2: "2 Weeks", month1: "1 Month", semester: "Semester" };
// Monthly-equivalent for MRR estimate
const PLAN_MONTHLY = { week1: 2800, week2: 2600, month1: 2400, semester: 1750 };

const admin = [requireAuth, requireRole("TEACHER")];

function dayKey(d) {
  return new Date(d).toDateString();
}

function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toDateString();
  });
}

// ─── GET /admin/stats — headline overview aggregates ──────────────────────────
router.get("/stats", ...admin, async (_req, res) => {
  try {
    const now = new Date();
    const d1 = new Date(now); d1.setDate(d1.getDate() - 1);
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);

    const [users, logins30d, openReports, aiCalls30d, resourceCount, questionCount, activeSubs, pendingPayments] =
      await Promise.all([
        prisma.user.findMany({ select: { role: true, createdAt: true, isActivated: true, activationExpiry: true } }),
        prisma.loginEvent.findMany({ where: { createdAt: { gte: d30 } }, select: { userId: true, createdAt: true } }),
        prisma.report.count({ where: { status: "open" } }),
        prisma.aiUsageLog.count({ where: { createdAt: { gte: d30 } } }),
        prisma.resource.count(),
        prisma.question.count(),
        prisma.user.count({ where: { isActivated: true, activationExpiry: { gt: now } } }),
        prisma.user.count({ where: { paymentStatus: "pending", transactionId: { not: null } } }),
      ]);

    const byRole = { STUDENT: 0, TEACHER: 0, LECTURER: 0 };
    users.forEach((u) => { byRole[u.role] = (byRole[u.role] || 0) + 1; });

    const activeSet = (since) => new Set(logins30d.filter((l) => new Date(l.createdAt) >= since).map((l) => l.userId)).size;

    const days = lastNDays(14);
    const signups14d = days.map((day) => users.filter((u) => dayKey(u.createdAt) === day).length);
    const logins14d = days.map((day) => logins30d.filter((l) => dayKey(l.createdAt) === day).length);

    res.json({
      totalUsers: users.length,
      byRole,
      dau: activeSet(d1),
      wau: activeSet(d7),
      mau: activeSet(d30),
      activeSubs,
      pendingPayments,
      openReports,
      aiCalls30d,
      resourceCount,
      questionCount,
      days,
      signups14d,
      logins14d,
    });
  } catch (e) {
    console.error("admin/stats:", e);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ─── GET /admin/ai-usage?days=30 — AI cost visibility ─────────────────────────
router.get("/ai-usage", ...admin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true, endpoint: true, provider: true, createdAt: true },
    });

    const dayLabels = lastNDays(Math.min(days, 30));
    const perDay = dayLabels.map((day) => logs.filter((l) => dayKey(l.createdAt) === day).length);

    const byEndpoint = {};
    const byProvider = {};
    const byUser = {};
    logs.forEach((l) => {
      const ep = l.endpoint || "unknown";
      byEndpoint[ep] = (byEndpoint[ep] || 0) + 1;
      const pv = l.provider || "openrouter";
      byProvider[pv] = (byProvider[pv] || 0) + 1;
      byUser[l.userId] = (byUser[l.userId] || 0) + 1;
    });

    const topIds = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
    const topUsers = topIds.length
      ? await prisma.user.findMany({ where: { id: { in: topIds } }, select: { id: true, username: true, email: true } })
      : [];
    const userMap = Object.fromEntries(topUsers.map((u) => [u.id, u]));

    res.json({
      total: logs.length,
      days: dayLabels,
      perDay,
      byEndpoint: Object.entries(byEndpoint).sort((a, b) => b[1] - a[1]).map(([endpoint, count]) => ({ endpoint, count })),
      byProvider,
      topUsers: topIds.map((id) => ({ ...(userMap[id] || { id, username: "?" }), count: byUser[id] })),
    });
  } catch (e) {
    console.error("admin/ai-usage:", e);
    res.status(500).json({ error: "Failed to load AI usage" });
  }
});

// ─── GET /admin/revenue — subscriber + payment picture ────────────────────────
router.get("/revenue", ...admin, async (_req, res) => {
  try {
    const now = new Date();
    const in7 = new Date(now); in7.setDate(in7.getDate() + 7);

    const subs = await prisma.user.findMany({
      where: { isActivated: true, planType: { not: null } },
      select: {
        id: true, username: true, email: true, planType: true,
        paymentStatus: true, activationExpiry: true, activatedAt: true, transactionId: true,
      },
      orderBy: { activationExpiry: "asc" },
    });

    const active = subs.filter((s) => s.activationExpiry && new Date(s.activationExpiry) > now);
    const expired = subs.filter((s) => !s.activationExpiry || new Date(s.activationExpiry) <= now);
    const expiringSoon = active.filter((s) => new Date(s.activationExpiry) <= in7);

    const byPlan = {};
    let mrr = 0;
    active.forEach((s) => {
      byPlan[s.planType] = (byPlan[s.planType] || 0) + 1;
      mrr += PLAN_MONTHLY[s.planType] || 0;
    });

    const pending = await prisma.user.findMany({
      where: { paymentStatus: "pending", transactionId: { not: null } },
      select: { id: true, username: true, email: true, planType: true, transactionId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    res.json({
      activeCount: active.length,
      expiredCount: expired.length,
      expiringSoon,
      byPlan,
      mrr,
      pendingVerification: pending,
      planLabels: PLAN_LABELS,
      planPrices: PLAN_PRICES,
    });
  } catch (e) {
    console.error("admin/revenue:", e);
    res.status(500).json({ error: "Failed to load revenue" });
  }
});

// ─── GET /admin/referrals — referral oversight ────────────────────────────────
router.get("/referrals", ...admin, async (_req, res) => {
  try {
    const top = await prisma.user.findMany({
      where: { referralsGiven: { some: {} } },
      select: {
        id: true, username: true, email: true, referralCode: true, referralBankedDays: true,
        _count: { select: { referralsGiven: true } },
      },
      orderBy: { referralsGiven: { _count: "desc" } },
      take: 15,
    });
    const recent = await prisma.referral.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        referrer: { select: { username: true, email: true } },
        referee: { select: { username: true, email: true, createdAt: true } },
      },
    });
    res.json({ top, recent });
  } catch (e) {
    console.error("admin/referrals:", e);
    res.status(500).json({ error: "Failed to load referrals" });
  }
});

// ─── GET /admin/reports — moderation queue ────────────────────────────────────
router.get("/reports", ...admin, async (req, res) => {
  try {
    const status = ["open", "reviewed", "dismissed"].includes(req.query.status) ? req.query.status : undefined;
    const reports = await prisma.report.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { reporter: { select: { id: true, username: true, email: true } } },
    });

    // Resolve target titles for display
    const resIds = reports.filter((r) => r.targetType === "resource").map((r) => r.targetId);
    const folderIds = reports.filter((r) => r.targetType === "folder").map((r) => r.targetId);
    const [resources, folders] = await Promise.all([
      resIds.length ? prisma.resource.findMany({ where: { id: { in: resIds } }, select: { id: true, title: true, shareToken: true, subject: true, uploader: { select: { username: true } } } }) : [],
      folderIds.length ? prisma.folder.findMany({ where: { id: { in: folderIds } }, select: { id: true, name: true, shareToken: true, subject: true } }) : [],
    ]);
    const resMap = Object.fromEntries(resources.map((r) => [r.id, r]));
    const folderMap = Object.fromEntries(folders.map((f) => [f.id, f]));

    res.json(reports.map((r) => ({
      ...r,
      target: r.targetType === "resource" ? resMap[r.targetId] || null : folderMap[r.targetId] || null,
    })));
  } catch (e) {
    console.error("admin/reports:", e);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

// ─── PATCH /admin/reports/:id — mark reviewed / dismissed / reopen ────────────
router.patch("/reports/:id", ...admin, async (req, res) => {
  try {
    const status = req.body.status;
    if (!["open", "reviewed", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const report = await prisma.report.update({ where: { id: req.params.id }, data: { status } });
    res.json(report);
  } catch (e) {
    console.error("admin/reports patch:", e);
    res.status(500).json({ error: "Failed to update report" });
  }
});

// ─── DELETE /admin/folders/:id — staff folder moderation (soft delete) ─────────
router.delete("/folders/:id", ...admin, async (req, res) => {
  try {
    const folder = await prisma.folder.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    logSecurityEvent(req.user.sub, "admin_folder_deleted", { folder: folder.id }, req);
    res.json({ ok: true });
  } catch (e) {
    console.error("admin/folder delete:", e);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

// ─── GET /admin/content — recent uploads for oversight ────────────────────────
router.get("/content", ...admin, async (_req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true, title: true, subject: true, contentType: true, status: true,
        viewCount: true, flagCount: true, createdAt: true, shareToken: true,
        uploader: { select: { id: true, username: true, email: true } },
      },
    });
    res.json(resources);
  } catch (e) {
    console.error("admin/content:", e);
    res.status(500).json({ error: "Failed to load content" });
  }
});

// ─── GET /admin/users/:id — full user detail for the drawer ───────────────────
router.get("/users/:id", ...admin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, username: true, fullName: true, role: true,
        createdAt: true, updatedAt: true, isActivated: true, activatedAt: true,
        activatedBy: true, activationExpiry: true, planType: true,
        paymentStatus: true, transactionId: true, referralCode: true,
        referralBankedDays: true, referredById: true,
        progress: true,
        referredBy: { select: { username: true } },
        _count: {
          select: {
            loginEvents: true, referralsGiven: true, chatHistory: true,
            flashcards: true, classroomMembers: true,
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [lastLogin, aiCalls30d, uploads] = await Promise.all([
      prisma.loginEvent.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.aiUsageLog.count({ where: { userId: user.id, createdAt: { gte: since } } }),
      prisma.resource.count({ where: { uploadedBy: user.id } }),
    ]);

    let activatedByUsername = null;
    if (user.activatedBy) {
      const t = await prisma.user.findUnique({ where: { id: user.activatedBy }, select: { username: true } });
      activatedByUsername = t?.username || null;
    }

    res.json({ ...user, lastLoginAt: lastLogin?.createdAt || null, aiCalls30d, uploads, activatedByUsername });
  } catch (e) {
    console.error("admin/user detail:", e);
    res.status(500).json({ error: "Failed to load user" });
  }
});

// ─── PATCH /admin/users/:id/role — change a user's role ───────────────────────
router.patch("/users/:id/role", ...admin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["STUDENT", "LECTURER", "TEACHER"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    if (user.supabaseId) {
      invalidateUserCache(user.supabaseId);
      supabaseAdmin.auth.admin.updateUserById(user.supabaseId, {
        app_metadata: { prismaId: user.id, role },
      }).catch((e) => console.warn("Supabase role sync failed:", e.message));
    }
    logSecurityEvent(req.user.sub, "admin_role_change", { targetUser: user.id, role }, req);
    res.json({ id: user.id, role: user.role });
  } catch (e) {
    console.error("admin/role:", e);
    res.status(500).json({ error: "Failed to change role" });
  }
});

// ─── DELETE /admin/users/:id — delete a user account ──────────────────────────
router.delete("/users/:id", ...admin, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === req.user.sub) return res.status(400).json({ error: "You cannot delete your own account" });
    if (target.role === "TEACHER") return res.status(400).json({ error: "Teacher accounts cannot be deleted here" });

    if (target.supabaseId) {
      const { error } = await supabaseAdmin.auth.admin.deleteUserById(target.supabaseId);
      if (error) console.warn("Supabase delete failed:", error.message);
    }
    await prisma.user.delete({ where: { id: target.id } });
    if (target.supabaseId) invalidateUserCache(target.supabaseId);
    logSecurityEvent(req.user.sub, "admin_user_deleted", { targetUser: target.id, email: target.email }, req);
    res.json({ ok: true });
  } catch (e) {
    console.error("admin/delete user:", e);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ─── POST /admin/broadcast — push notification to a role / everyone ────────────
router.post("/broadcast", ...admin, async (req, res) => {
  try {
    const { title, body, targetRole } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (!isPushConfigured()) return res.status(503).json({ error: "Push notifications are not configured on this server" });

    const where = targetRole && ["STUDENT", "LECTURER", "TEACHER"].includes(targetRole) ? { role: targetRole } : {};
    const users = await prisma.user.findMany({ where, select: { id: true } });
    const result = await sendPushToUsers(users.map((u) => u.id), {
      title: title.trim(),
      body: (body || "").trim(),
      tag: "admin-broadcast",
      data: { tab: "home" },
    });
    logSecurityEvent(req.user.sub, "admin_broadcast", { title, targetRole: targetRole || "all", ...result }, req);
    res.json(result);
  } catch (e) {
    console.error("admin/broadcast:", e);
    res.status(500).json({ error: "Broadcast failed" });
  }
});

export default router;
