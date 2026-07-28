// Web Push helper: sends notifications to one user or many users.
// Auto-cleans dead subscriptions (HTTP 404/410 from Apple/Google/Mozilla push services).
import webpush from "web-push";
import { prisma } from "../db.js";

let configured = false;

export function configurePush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@scholars-circle.app";

  if (!pub || !priv) {
    console.warn("[push] VAPID keys missing — push notifications disabled. Run `node server/scripts/generate-vapid.js`.");
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
    console.log("[push] Web Push configured.");
    return true;
  } catch (err) {
    console.error("[push] Failed to configure VAPID:", err.message);
    return false;
  }
}

export function isPushConfigured() {
  return configured;
}

/**
 * Send a single push notification to a userId.
 * Payload should be a small JSON object (max ~4KB).
 * @param {string} userId
 * @param {{title:string, body:string, tag?:string, data?:object, requireInteraction?:boolean, actions?:Array}} payload
 * @param {{category?:string}} options - optional, will respect user preferences
 */
export async function sendPushToUser(userId, payload, options = {}) {
  if (!configured) return { sent: 0, skipped: "not_configured" };
  if (!userId || !payload?.title) return { sent: 0, skipped: "invalid_args" };

  // Respect notification preferences if a category is specified.
  if (options.category) {
    const prefs = await prisma.notificationPreference.findUnique({ where: { userId } }).catch(() => null);
    if (prefs && prefs[options.category] === false) {
      return { sent: 0, skipped: "user_opted_out" };
    }
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, skipped: "no_subscriptions" };

  let sent = 0;
  const deadIds = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 } // 24h
        );
        sent++;
        // Mark as recently used (best-effort, ignore failure)
        prisma.pushSubscription.update({
          where: { id: s.id },
          data: { lastUsed: new Date() }
        }).catch(() => {});
      } catch (err) {
        const status = err.statusCode;
        if (status === 404 || status === 410) {
          // Subscription gone — clean up
          deadIds.push(s.id);
        } else {
          console.warn(`[push] send failed for sub ${s.id}: ${status} ${err.body || err.message}`);
        }
      }
    })
  );

  if (deadIds.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } }).catch(() => {});
  }

  return { sent, dead: deadIds.length };
}

/**
 * Send push to many users in parallel.
 */
export async function sendPushToUsers(userIds, payload, options = {}) {
  if (!userIds?.length) return { sent: 0 };
  const results = await Promise.all(
    userIds.map((u) => sendPushToUser(u, payload, options).catch((e) => ({ sent: 0, error: e.message })))
  );
  return {
    sent: results.reduce((sum, r) => sum + (r.sent || 0), 0),
    users: results.length
  };
}
