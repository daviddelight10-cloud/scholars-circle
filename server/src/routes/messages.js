import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { AUTHOR_SELECT, publicUser } from "../lib/social.js";

const router = express.Router();

const RESOURCE_CARD_SELECT = { id: true, title: true, subject: true, contentType: true, shareToken: true };

// Lightweight in-memory presence + typing — chat-scale only, no persistence needed.
const lastSeen = new Map();   // userId -> ts
const typingTo = new Map();   // `${typerId}|${readerId}` -> ts
const TYPING_TTL = 4000;
const ONLINE_TTL = 120000;    // "online" = hit a messages route in the last 2min

function userId(req) {
  const uid = req.user.sub || req.user.id;
  if (uid) lastSeen.set(uid, Date.now());
  return uid;
}
function isOnline(uid) { return Date.now() - (lastSeen.get(uid) || 0) < ONLINE_TTL; }
function isTyping(from, to) { return Date.now() - (typingTo.get(`${from}|${to}`) || 0) < TYPING_TTL; }

// Resolve reply previews + resource cards for a batch of DirectMessages.
async function decorate(messages, uid) {
  const resourceIds = [...new Set(messages.map((m) => m.resourceId).filter(Boolean))];
  const replyIds = [...new Set(messages.map((m) => m.replyToId).filter(Boolean))];
  const [resources, replies] = await Promise.all([
    resourceIds.length
      ? prisma.resource.findMany({ where: { id: { in: resourceIds } }, select: RESOURCE_CARD_SELECT })
      : [],
    replyIds.length
      ? prisma.directMessage.findMany({
          where: { id: { in: replyIds } },
          select: { id: true, content: true, fromId: true, from: { select: { fullName: true, username: true } } },
        })
      : [],
  ]);
  const resById = new Map(resources.map((r) => [r.id, r]));
  const repById = new Map(replies.map((r) => [r.id, {
    id: r.id,
    text: r.content.slice(0, 140),
    senderName: r.from?.fullName || r.from?.username || "Scholar",
    isMine: r.fromId === uid,
  }]));

  const reactionCounts = (m) => {
    const counts = {};
    (m.reactions || []).forEach((r) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    return counts;
  };

  return messages.map((m) => ({
    id: m.id,
    text: m.content,
    ts: m.createdAt,
    isMine: m.fromId === uid,
    read: m.read,
    resource: m.resourceId ? resById.get(m.resourceId) || null : null,
    replyTo: m.replyToId ? repById.get(m.replyToId) || { id: m.replyToId, deleted: true } : null,
    reactions: reactionCounts(m),
    myReactions: (m.reactions || []).filter((r) => r.userId === uid).map((r) => r.emoji),
  }));
}

// Fire-and-forget DM push. Category "directMessages" respects NotificationPreference.directMessages.
async function dmPush(toUid, fromUid, preview) {
  try {
    const { sendPushToUser } = await import("../lib/pushSender.js");
    const sender = await prisma.user.findUnique({
      where: { id: fromUid },
      select: { fullName: true, username: true },
    });
    const who = sender?.fullName || sender?.username || "Someone";
    await sendPushToUser(
      toUid,
      {
        title: `💬 ${who}`,
        body: preview.slice(0, 200),
        tag: `dm-${fromUid}`,
        data: { tab: "discuss", feedTab: "chats", chatWith: fromUid },
      },
      { category: "directMessages" }
    );
  } catch (e) {
    console.warn("[messages] push failed:", e?.message);
  }
}

// ============ INBOX ============

// GET /api/messages/inbox — latest message per conversation partner + unread counts.
// Shares the DirectMessage table with /lecturers/messages, so lecturer threads
// show up here too — one unified inbox.
router.get("/inbox", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const messages = await prisma.directMessage.findMany({
      where: { OR: [{ fromId: uid }, { toId: uid }] },
      orderBy: { createdAt: "desc" },
      take: 400,
    });

    const partnerMap = new Map();
    for (const m of messages) {
      const partnerId = m.fromId === uid ? m.toId : m.fromId;
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { partnerId, lastMessage: m, unreadCount: 0 });
      }
      if (m.toId === uid && !m.read) partnerMap.get(partnerId).unreadCount++;
    }

    const partners = await prisma.user.findMany({
      where: { id: { in: [...partnerMap.keys()] } },
      select: AUTHOR_SELECT,
    });
    const byId = new Map(partners.map((u) => [u.id, publicUser(u)]));

    // "Request" = sender doesn't follow me AND I don't follow them → cold DM
    const [iFollow, theyFollow] = await Promise.all([
      prisma.userFollow.findMany({
        where: { followerId: uid, followingId: { in: [...partnerMap.keys()] } },
        select: { followingId: true },
      }),
      prisma.userFollow.findMany({
        where: { followerId: { in: [...partnerMap.keys()] }, followingId: uid },
        select: { followerId: true },
      }),
    ]);
    const iFollowSet = new Set(iFollow.map((f) => f.followingId));
    const theyFollowSet = new Set(theyFollow.map((f) => f.followerId));

    res.json(
      [...partnerMap.values()]
        .map((e) => ({
          partner: {
            ...(byId.get(e.partnerId) || { id: e.partnerId, name: "Scholar" }),
            online: isOnline(e.partnerId),
          },
          lastMessage: {
            id: e.lastMessage.id,
            text: e.lastMessage.content,
            ts: e.lastMessage.createdAt,
            isMine: e.lastMessage.fromId === uid,
            read: e.lastMessage.read,
          },
          unreadCount: e.unreadCount,
          request: !iFollowSet.has(e.partnerId) && !theyFollowSet.has(e.partnerId),
        }))
        .filter((e) => e.partner)
    );
  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).json({ error: "Failed to fetch inbox" });
  }
});

// GET /api/messages/unread-count — badge for the Chats tab.
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const count = await prisma.directMessage.count({
      where: { toId: userId(req), read: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count unread" });
  }
});

// ============ PEER SEARCH (new chat) ============

// GET /api/messages/peers?q= — people to message. Empty q returns followed
// users + same-university scholars ranked by XP.
router.get("/peers", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const q = (req.query.q || "").trim();

    const [me, follows] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: uid }, select: { universityId: true } }),
      prisma.userFollow.findMany({ where: { followerId: uid }, select: { followingId: true } }),
    ]);
    const followingIds = new Set(follows.map((f) => f.followingId));
    const myUni = me?.universityId || null;

    const select = { ...AUTHOR_SELECT, progress: { select: { xp: true, streak: true } } };
    const shape = (u) => ({
      ...publicUser(u),
      xp: u.progress?.xp || 0,
      streak: u.progress?.streak || 0,
      isFollowing: followingIds.has(u.id),
      sameUni: !!(myUni && u.userProfile?.universityId === myUni),
    });

    if (q) {
      const users = await prisma.user.findMany({
        where: {
          id: { not: uid },
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
          ],
        },
        select,
        take: 40,
      });
      // Same uni + followed first, then XP
      users.sort((a, b) => {
        const score = (u) =>
          (myUni && u.userProfile?.universityId === myUni ? 2 : 0) +
          (followingIds.has(u.id) ? 1 : 0);
        const d = score(b) - score(a);
        return d !== 0 ? d : (b.progress?.xp || 0) - (a.progress?.xp || 0);
      });
      return res.json(users.slice(0, 15).map(shape));
    }

    // No query — people I follow, then top scholars at my university
    const followed = await prisma.user.findMany({
      where: { id: { in: [...followingIds] } },
      select,
      take: 20,
    });
    let rest = [];
    if (followed.length < 15) {
      rest = await prisma.user.findMany({
        where: {
          id: { notIn: [uid, ...followingIds] },
          ...(myUni ? { userProfile: { universityId: myUni } } : {}),
        },
        select,
        orderBy: { progress: { xp: "desc" } },
        take: 15 - followed.length,
      });
    }
    res.json([...followed, ...rest].map(shape));
  } catch (err) {
    console.error("Peers error:", err);
    res.status(500).json({ error: "Failed to search people" });
  }
});

// ============ THREADS ============

// GET /api/messages/thread/:userId?before= — conversation with a user.
// Returns { messages, peerTyping, peerOnline }. `read` on incoming messages
// reflects their pre-fetch state (this fetch marks them read after snapshot),
// so the client can draw the "New messages" divider above the first one.
router.get("/thread/:userId", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const otherId = req.params.userId;
    const { before } = req.query;

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { fromId: uid, toId: otherId },
          { fromId: otherId, toId: uid },
        ],
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { reactions: true },
    });

    const decorated = await decorate(messages.reverse(), uid);

    await prisma.directMessage.updateMany({
      where: { toId: uid, fromId: otherId, read: false },
      data: { read: true },
    });

    res.json({
      messages: decorated,
      peerTyping: isTyping(otherId, uid),
      peerOnline: isOnline(otherId),
    });
  } catch (err) {
    console.error("Thread error:", err);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// POST /api/messages { toUserId, content, resourceId?, replyToId? } — send a DM.
router.post("/", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { toUserId, content, resourceId, replyToId } = req.body || {};
    const text = content?.trim();
    if (!toUserId || (!text && !resourceId)) return res.status(400).json({ error: "Recipient and content required" });
    if (toUserId === uid) return res.status(400).json({ error: "Cannot message yourself" });
    if (text && text.length > 2000) return res.status(400).json({ error: "Message too long" });

    const target = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "User not found" });

    let resource = null;
    if (resourceId) {
      resource = await prisma.resource.findUnique({ where: { id: resourceId }, select: RESOURCE_CARD_SELECT });
      if (!resource) return res.status(404).json({ error: "Material not found" });
    }
    if (replyToId) {
      const orig = await prisma.directMessage.findFirst({
        where: { id: replyToId, OR: [{ fromId: uid, toId: toUserId }, { fromId: toUserId, toId: uid }] },
        select: { id: true },
      });
      if (!orig) return res.status(404).json({ error: "Reply target not found" });
    }

    const dm = await prisma.directMessage.create({
      data: {
        fromId: uid,
        toId: toUserId,
        content: text || (resource ? `Shared ${resource.title}` : ""),
        resourceId: resource?.id || null,
        replyToId: replyToId || null,
      },
    });

    const [decorated] = await decorate([{ ...dm, reactions: [] }], uid);
    res.status(201).json(decorated);

    dmPush(toUserId, uid, text || `Shared ${resource?.title || "a material"}`);
  } catch (err) {
    console.error("Send DM error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/messages/typing { toUserId } — heartbeat while composing.
router.post("/typing", requireAuth, async (req, res) => {
  const uid = userId(req);
  const { toUserId } = req.body || {};
  if (toUserId) typingTo.set(`${uid}|${toUserId}`, Date.now());
  res.json({ ok: true });
});

// POST /api/messages/:id/reactions { emoji } — toggle a reaction on a DM.
router.post("/:id/reactions", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { emoji } = req.body || {};
    if (!emoji || String(emoji).length > 16) return res.status(400).json({ error: "Emoji required" });

    const msg = await prisma.directMessage.findUnique({ where: { id: req.params.id } });
    if (!msg || (msg.fromId !== uid && msg.toId !== uid)) {
      return res.status(404).json({ error: "Message not found" });
    }

    const existing = await prisma.directMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: msg.id, userId: uid, emoji } },
    }).catch(() => null);

    if (existing) {
      await prisma.directMessageReaction.delete({ where: { id: existing.id } });
      return res.json({ removed: true });
    }
    const reaction = await prisma.directMessageReaction.create({
      data: { messageId: msg.id, userId: uid, emoji },
    });
    res.status(201).json(reaction);
  } catch (err) {
    console.error("DM reaction error:", err);
    res.status(500).json({ error: "Failed to react" });
  }
});

// DELETE /api/messages/:id — sender deletes their own message.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const msg = await prisma.directMessage.findUnique({ where: { id: req.params.id } });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.fromId !== uid) return res.status(403).json({ error: "Not your message" });
    await prisma.directMessage.delete({ where: { id: msg.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete DM error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
