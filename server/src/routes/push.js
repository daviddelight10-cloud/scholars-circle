import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { sendPushToUser, isPushConfigured } from "../lib/pushSender.js";
import { runMotivationNow } from "../lib/studyReminderJob.js";

const router = Router();

// Public: VAPID public key (clients need this to subscribe).
router.get("/vapid-public-key", (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  res.json({
    key,
    enabled: Boolean(key) && isPushConfigured()
  });
});

// Save a new subscription for the authenticated user.
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const { endpoint, keys, userAgent } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription payload" });
    }
    const userId = req.user.sub;

    // Upsert by endpoint (one device = one endpoint)
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null, lastUsed: new Date() },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("/push/subscribe failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Remove a subscription (called on permission revoke or sign-out).
router.post("/unsubscribe", requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.sub } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get / update user's notification preferences
router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.user.sub },
      update: {},
      create: { userId: req.user.sub }
    });
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/preferences", requireAuth, async (req, res) => {
  try {
    const { announcements, assignments, liveSessions, directMessages, studyReminders } = req.body || {};
    const data = {};
    if (typeof announcements === "boolean") data.announcements = announcements;
    if (typeof assignments === "boolean") data.assignments = assignments;
    if (typeof liveSessions === "boolean") data.liveSessions = liveSessions;
    if (typeof directMessages === "boolean") data.directMessages = directMessages;
    if (typeof studyReminders === "boolean") data.studyReminders = studyReminders;

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.user.sub },
      update: data,
      create: { userId: req.user.sub, ...data }
    });
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a test notification to the calling user
router.post("/test", requireAuth, async (req, res) => {
  try {
    const result = await sendPushToUser(req.user.sub, {
      title: "🎉 Scholar's Circle notifications are ON!",
      body: "You'll now get alerts for announcements, assignments, live sessions, and messages.",
      tag: "push-test",
      requireInteraction: false,
      data: { tab: "home" }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a motivational push to the calling user immediately.
router.post("/motivate", requireAuth, async (req, res) => {
  try {
    const result = await runMotivationNow(req.user.sub);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List my devices (so user can see active subscriptions)
router.get("/devices", requireAuth, async (req, res) => {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: req.user.sub },
      select: { id: true, userAgent: true, createdAt: true, lastUsed: true },
      orderBy: { lastUsed: "desc" }
    });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/devices/:id", requireAuth, async (req, res) => {
  try {
    await prisma.pushSubscription.deleteMany({ where: { id: req.params.id, userId: req.user.sub } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
