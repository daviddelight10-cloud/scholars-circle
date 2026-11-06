import { prisma } from "../db.js";
import { initFirebase, isFirebaseInitialized, getMessaging } from "./firebaseAdmin.js";

let configured = false;

export function configurePush() {
  configured = initFirebase();
  return configured;
}

export function isPushConfigured() {
  return configured;
}

/**
 * Send a single push notification to a userId via FCM.
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

  const messaging = getMessaging();
  if (!messaging) return { sent: 0, skipped: "messaging_unavailable" };

  let sent = 0;
  const deadIds = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        const message = {
          token: s.fcmToken,
          notification: {
            title: payload.title,
            body: payload.body || "",
          },
          data: stringifyData(payload.data),
          webpush: {
            notification: {
              tag: payload.tag || "default",
              requireInteraction: !!payload.requireInteraction,
              icon: "/icon-192.png",
              badge: "/icon-96.png",
              ...(Array.isArray(payload.actions) && payload.actions.length > 0
                ? { actions: payload.actions }
                : {}),
            },
            fcmOptions: {
              link: buildLink(payload.data),
            },
          },
        };

        await messaging.send(message);
        sent++;
        prisma.pushSubscription.update({
          where: { id: s.id },
          data: { lastUsed: new Date() },
        }).catch(() => {});
      } catch (err) {
        const code = err.code || err.errorInfo?.code || "";
        if (
          code.includes("UNREGISTERED") ||
          code.includes("INVALID_ARGUMENT") ||
          code.includes("registration-token-not-registered")
        ) {
          deadIds.push(s.id);
        } else {
          console.warn(`[push] FCM send failed for sub ${s.id}: ${code} ${err.message}`);
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
    users: results.length,
  };
}

/**
 * Notify the members of a study group about an activity (message, goal, join, …).
 * Loads members via classroomId, excludes the actor, respects the `groups` pref,
 * and routes the tap to the Feed's Groups tab.
 *
 * @param {string} classroomId  the group id
 * @param {string} actorId      the user who triggered the activity (skipped)
 * @param {{title:string, body:string, tag?:string, data?:object}} payload
 * @returns {Promise<{sent:number, members:number}>}
 */
export async function notifyGroupMembers(classroomId, actorId, payload) {
  if (!classroomId || !payload?.title) return { sent: 0 };
  const members = await prisma.classroomMember.findMany({
    where: { classroomId, userId: { not: actorId } },
    select: { userId: true },
  });
  if (!members.length) return { sent: 0, members: 0 };
  const data = { tab: "discuss", feedTab: "groups", ...(payload.data || {}) };
  const result = await sendPushToUsers(
    members.map((m) => m.userId),
    { ...payload, data },
    { category: "groups" }
  );
  return { ...result, members: members.length };
}

function buildLink(data) {
  if (!data?.tab && !data?.liveCode) return "/";
  const p = new URLSearchParams();
  if (data.tab) p.set("tab", data.tab);
  if (data.liveCode) p.set("live", data.liveCode);
  if (data.feedTab) p.set("feedTab", data.feedTab);
  if (data.battle) p.set("battle", data.battle);
  return `/?${p}`;
}

function stringifyData(data) {
  if (!data) return {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}
