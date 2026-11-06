import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AUTHOR_SELECT, publicUser } from "../lib/social.js";
import { getWeekStart } from "../lib/tiers.js";
import { getRoomByCode } from "../lib/liveQuizRooms.js";
import { sendPushToUsers, notifyGroupMembers } from "../lib/pushSender.js";
import { isGroupCaptain } from "../lib/battles.js";

const RESOURCE_CARD_SELECT = { id: true, title: true, subject: true, contentType: true, shareToken: true };

function liveState(code) {
  if (!code) return { liveCode: null, liveActive: false };
  const room = getRoomByCode(code);
  return { liveCode: code, liveActive: !!room && room.phase !== "complete" };
}

const router = express.Router();

// In-memory typing state per classroom — { classroomId: Map(userId -> {name, ts}) }
const typingIn = new Map();
const TYPING_TTL = 4000;
// Ring: per-caller cooldown so a group can't be spammed into a session.
const ringCooldowns = new Map();
const RING_COOLDOWN_MS = 5 * 60 * 1000;
function typingList(classroomId, excludeUserId) {
  const m = typingIn.get(classroomId);
  if (!m) return [];
  const now = Date.now();
  return [...m.entries()]
    .filter(([uid, v]) => uid !== excludeUserId && now - v.ts < TYPING_TTL)
    .map(([uid, v]) => ({ id: uid, name: v.name }));
}

// Helper: verify classroom membership
async function verifyMembership(classroomId, userId) {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { createdById: true },
  });
  if (!classroom) return false;
  if (classroom.createdById === userId) return true;
  const membership = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId } },
  }).catch(() => null);
  return !!membership;
}

// Helper: fetch a group's name for push titles (cached on the classroom row).
async function groupName(classroomId) {
  const g = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { name: true } }).catch(() => null);
  return g?.name || "your group";
}

// ============ CHAT ============

// GET /api/study-group/groups/leaderboard — public weekly groups board.
// Registered before /:classroomId/* so "groups" isn't parsed as a classroomId.
// period=week (Lagos week, default) | all · scope=all | university (creator's uni)
router.get("/groups/leaderboard", requireAuth, async (req, res) => {
  try {
    const { period = "week", scope = "all" } = req.query;
    // sort=xp (weekly score) | rating (Elo hall of fame — default for all-time)
    const sort = req.query.sort || (period === "all" ? "rating" : "xp");
    let universityId = null;
    if (scope === "university") {
      const p = await prisma.userProfile.findUnique({
        where: { userId: req.user.sub },
        select: { universityId: true },
      });
      universityId = p?.universityId || null;
      if (!universityId) return res.json({ entries: [], myGroups: [], weekStart: getWeekStart() });
    }

    const entry = (g, i, xp) => ({
      rank: i + 1,
      id: g.id,
      name: g.name,
      subject: g.subject,
      isPublic: g.isPublic,
      memberCount: g._count.members,
      creator: g.createdBy?.fullName || g.createdBy?.username || null,
      xp,
      rating: g.rating,
      rankedWins: g.rankedWins,
      rankedLosses: g.rankedLosses,
    });
    const GROUP_SELECT = {
      id: true, name: true, subject: true, isPublic: true,
      rating: true, rankedWins: true, rankedLosses: true,
      createdBy: { select: { username: true, fullName: true } },
      _count: { select: { members: true } },
    };

    let entries;
    if (sort === "rating") {
      // Hall of fame: top groups by Elo rating, with their XP for the period.
      const uniWhere = universityId ? { createdBy: { userProfile: { is: { universityId } } } } : {};
      const top = await prisma.classroom.findMany({
        where: { kind: "group", ...uniWhere },
        orderBy: [{ rating: "desc" }, { createdAt: "asc" }],
        take: 50,
        select: GROUP_SELECT,
      });
      const xpRows = await prisma.groupXpEvent.groupBy({
        by: ["classroomId"],
        where: {
          classroomId: { in: top.map((g) => g.id) },
          ...(period !== "all" ? { createdAt: { gte: getWeekStart() } } : {}),
        },
        _sum: { xp: true },
      });
      const xpMap = new Map(xpRows.map((r) => [r.classroomId, r._sum.xp || 0]));
      entries = top.map((g, i) => entry(g, i, xpMap.get(g.id) || 0));
    } else {
      const where = { classroom: { kind: "group" } };
      if (period !== "all") where.createdAt = { gte: getWeekStart() };
      if (universityId) {
        where.classroom.createdBy = { userProfile: { is: { universityId } } };
      }

      const rows = await prisma.groupXpEvent.groupBy({
        by: ["classroomId"],
        where,
        _sum: { xp: true },
        orderBy: { _sum: { xp: "desc" } },
        take: 50,
      });
      const ids = rows.map((r) => r.classroomId);
      const groups = await prisma.classroom.findMany({
        where: { id: { in: ids } },
        select: GROUP_SELECT,
      });
      const byId = new Map(groups.map((g) => [g.id, g]));
      entries = rows
        .map((r, i) => {
          const g = byId.get(r.classroomId);
          return g ? entry(g, i, r._sum.xp || 0) : null;
        })
        .filter(Boolean);
    }

    const myMemberships = await prisma.classroomMember.findMany({
      where: { userId: req.user.sub, classroom: { kind: "group" } },
      select: { classroomId: true, classroom: { select: { name: true } } },
    });
    const ranked = new Map(entries.map((e) => [e.id, e.rank]));
    res.json({
      weekStart: getWeekStart(),
      entries,
      myGroups: myMemberships.map((m) => ({
        id: m.classroomId,
        name: m.classroom.name,
        rank: ranked.get(m.classroomId) || null,
      })),
    });
  } catch (error) {
    console.error("Groups leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch groups leaderboard" });
  }
});

// GET /api/study-group/unread-count — total unread group messages across all
// the user's groups (for the bottom-nav Feed badge). Registered before
// /:classroomId/* so "unread-count" isn't parsed as a classroomId.
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const memberships = await prisma.classroomMember.findMany({
      where: { userId, classroom: { kind: "group" } },
      select: { classroomId: true, lastReadAt: true },
    });
    const createdGroups = await prisma.classroom.findMany({
      where: { createdById: userId, kind: "group" },
      select: { id: true },
    });

    // Count unread per group: messages not by me, newer than lastReadAt (or all if null).
    const all = new Map();
    for (const m of memberships) all.set(m.classroomId, m.lastReadAt);
    for (const g of createdGroups) all.set(g.id, null);

    const counts = await Promise.all(
      [...all.entries()].map(([cid, lastReadAt]) =>
        prisma.classroomMessage.count({
          where: {
            classroomId: cid,
            userId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        })
      )
    );
    const total = counts.reduce((n, c) => n + (c || 0), 0);
    res.json({ count: total });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({ error: "Failed to count unread group messages" });
  }
});

// POST /api/study-group/:classroomId/read — mark the group chat as read
// (advances the member's lastReadAt cursor to now). Idempotent.
router.post("/:classroomId/read", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });
    await prisma.classroomMember.upsert({
      where: { classroomId_userId: { classroomId, userId } },
      update: { lastReadAt: new Date() },
      create: { classroomId, userId, lastReadAt: new Date() },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ error: "Failed to mark read" });
  }
});

// POST /api/study-group/:classroomId/mute { muted } — suppress pushes for this
// group. The unread pill still shows; only notifications are silenced.
router.post("/:classroomId/mute", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const muted = req.body?.muted !== false; // default true; pass muted:false to unmute
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });
    await prisma.classroomMember.upsert({
      where: { classroomId_userId: { classroomId, userId } },
      update: { muted },
      create: { classroomId, userId, muted },
    });
    res.json({ ok: true, muted });
  } catch (error) {
    console.error("Mute error:", error);
    res.status(500).json({ error: "Failed to update mute" });
  }
});

// GET /api/study-group/:classroomId/xp — group XP total + per-member board
// ("who practised this week and who did not").
router.get("/:classroomId/xp", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const since = getWeekStart();
    const [weekRows, allRows, members] = await Promise.all([
      prisma.groupXpEvent.groupBy({
        by: ["userId"],
        where: { classroomId, createdAt: { gte: since } },
        _sum: { xp: true },
      }),
      prisma.groupXpEvent.groupBy({
        by: ["userId"],
        where: { classroomId },
        _sum: { xp: true },
      }),
      prisma.classroomMember.findMany({
        where: { classroomId },
        include: { user: { select: AUTHOR_SELECT } },
      }),
    ]);
    const weekMap = new Map(weekRows.map((r) => [r.userId, r._sum.xp || 0]));
    const allMap = new Map(allRows.map((r) => [r.userId, r._sum.xp || 0]));
    const sorted = members
      .map((m) => ({
        ...publicUser(m.user),
        weekXp: weekMap.get(m.userId) || 0,
        allXp: allMap.get(m.userId) || 0,
        isMe: m.userId === userId,
      }))
      .sort((a, b) => b.weekXp - a.weekXp || b.allXp - a.allXp);
    // Weekly MVP — top contributor this week (only when someone actually
    // practised; a 0-XP week has no MVP).
    const mvpId = sorted.length && sorted[0].weekXp > 0 ? sorted[0].id : null;
    res.json({
      weekStart: since,
      weekXp: weekRows.reduce((s, r) => s + (r._sum.xp || 0), 0),
      allXp: allRows.reduce((s, r) => s + (r._sum.xp || 0), 0),
      members: sorted.map((m) => ({ ...m, mvp: m.id === mvpId })),
    });
  } catch (error) {
    console.error("Group XP error:", error);
    res.status(500).json({ error: "Failed to fetch group XP" });
  }
});

// GET /api/study-group/:classroomId/messages
router.get("/:classroomId/messages", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const [messages, membership] = await Promise.all([
      prisma.classroomMessage.findMany({
        where: { classroomId },
        include: {
          user: { select: AUTHOR_SELECT },
          reactions: {
            include: { user: { select: { id: true, username: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // The member's read cursor — tells the client where the "New messages"
      // divider belongs. Returned before any mark-read so the boundary is
      // stable for this page of history.
      prisma.classroomMember.findUnique({
        where: { classroomId_userId: { classroomId, userId } },
        select: { lastReadAt: true },
      }),
    ]);

    // Batch-attach shared-resource cards + reply previews (resolve by id)
    const resourceIds = [...new Set(messages.map((m) => m.resourceId).filter(Boolean))];
    const replyIds = [...new Set(messages.map((m) => m.replyToId).filter(Boolean))];
    const [resources, replies] = await Promise.all([
      resourceIds.length
        ? await prisma.resource.findMany({
            where: { id: { in: resourceIds } },
            select: RESOURCE_CARD_SELECT,
          })
        : [],
      replyIds.length
        ? await prisma.classroomMessage.findMany({
            where: { id: { in: replyIds } },
            select: { id: true, text: true, userId: true, user: { select: { fullName: true, username: true } } },
          })
        : [],
    ]);
    const resById = new Map(resources.map((r) => [r.id, r]));
    const repById = new Map(replies.map((r) => [r.id, {
      id: r.id,
      text: r.text.slice(0, 140),
      senderName: r.user?.fullName || r.user?.username || "Scholar",
      isMine: r.userId === userId,
    }]));

    res.json({
      messages: messages.map(({ user, ...m }) => ({
        ...m,
        sender: publicUser(user),
        resource: m.resourceId ? resById.get(m.resourceId) || null : null,
        replyTo: m.replyToId ? repById.get(m.replyToId) || { id: m.replyToId, deleted: true } : null,
        ...liveState(m.liveCode),
      })),
      typing: typingList(classroomId, userId),
      lastReadAt: membership?.lastReadAt || null,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /api/study-group/:classroomId/messages
router.post("/:classroomId/messages", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const { text, resourceId, liveCode, replyToId } = req.body;
    if (!text?.trim() && !resourceId) return res.status(400).json({ error: "Message text required" });

    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    if (replyToId) {
      const orig = await prisma.classroomMessage.findFirst({
        where: { id: replyToId, classroomId },
        select: { id: true },
      });
      if (!orig) return res.status(404).json({ error: "Reply target not found" });
    }

    const message = await prisma.classroomMessage.create({
      data: {
        classroomId,
        userId,
        text: text.trim() || "Shared a material",
        resourceId: resourceId || null,
        liveCode: liveCode || null,
        replyToId: replyToId || null,
      },
      include: {
        user: { select: AUTHOR_SELECT },
        reactions: true,
      },
    });

    const [resource, replyOrig] = await Promise.all([
      message.resourceId
        ? prisma.resource.findUnique({ where: { id: message.resourceId }, select: RESOURCE_CARD_SELECT })
        : null,
      message.replyToId
        ? prisma.classroomMessage.findUnique({
            where: { id: message.replyToId },
            select: { id: true, text: true, userId: true, user: { select: { fullName: true, username: true } } },
          })
        : null,
    ]);
    const replyTo = replyOrig ? {
      id: replyOrig.id,
      text: replyOrig.text.slice(0, 140),
      senderName: replyOrig.user?.fullName || replyOrig.user?.username || "Scholar",
      isMine: replyOrig.userId === userId,
    } : null;

    const { user, ...rest } = message;
    res.status(201).json({ ...rest, sender: publicUser(user), resource, replyTo, ...liveState(message.liveCode) });

    // Notify group members about the new message (fire-and-forget, respects `groups` pref).
    const senderName = user?.fullName || user?.username || "Someone";
    const preview = (text?.trim() || (resourceId ? "Shared a material" : "New message")).slice(0, 80);
    notifyGroupMembers(classroomId, userId, {
      title: `${senderName} · ${await groupName(classroomId)}`,
      body: preview,
      tag: `grp-msg-${classroomId}`,
    }).catch(() => {});
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/study-group/:classroomId/typing { name } — heartbeat while composing.
router.post("/:classroomId/typing", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });
    const name = req.body?.name?.trim() || "Someone";
    if (!typingIn.has(classroomId)) typingIn.set(classroomId, new Map());
    typingIn.get(classroomId).set(userId, { name, ts: Date.now() });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /api/study-group/messages/:messageId — author or classroom creator.
router.delete("/messages/:messageId", requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.sub;
    const msg = await prisma.classroomMessage.findUnique({
      where: { id: messageId },
      include: { classroom: { select: { createdById: true } } },
    });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    const canDelete = msg.userId === userId
      || msg.classroom.createdById === userId
      || await isGroupCaptain(msg.classroomId, userId);
    if (!canDelete) {
      return res.status(403).json({ error: "Not your message" });
    }
    await prisma.classroomMessageReaction.deleteMany({ where: { messageId } });
    await prisma.classroomMessage.delete({ where: { id: messageId } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// POST /api/study-group/messages/:messageId/pin — any member can pin/unpin.
router.post("/messages/:messageId/pin", requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.sub;
    const msg = await prisma.classroomMessage.findUnique({ where: { id: messageId } });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    const isMember = await verifyMembership(msg.classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const pinned = !msg.pinnedAt;
    const updated = await prisma.classroomMessage.update({
      where: { id: messageId },
      data: pinned ? { pinnedAt: new Date(), pinnedById: userId } : { pinnedAt: null, pinnedById: null },
    });
    res.json({ pinned, pinnedAt: updated.pinnedAt });
  } catch (error) {
    console.error("Error pinning message:", error);
    res.status(500).json({ error: "Failed to pin" });
  }
});

// POST /api/study-group/messages/:messageId/reactions
router.post("/messages/:messageId/reactions", requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.sub;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "Emoji required" });

    const existing = await prisma.classroomMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    }).catch(() => null);

    if (existing) {
      await prisma.classroomMessageReaction.delete({ where: { id: existing.id } });
      return res.json({ removed: true });
    }

    const reaction = await prisma.classroomMessageReaction.create({
      data: { messageId, userId, emoji },
    });
    res.status(201).json(reaction);
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});

// ============ MEMBERS + STATS ============

// GET /api/study-group/:classroomId/members
router.get("/:classroomId/members", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { createdById: true },
    });

    const members = await prisma.classroomMember.findMany({
      where: { classroomId },
      include: {
        user: {
          select: {
            ...AUTHOR_SELECT,
            totalXp: true,
            progress: { select: { xp: true, streak: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    // Include the teacher/creator
    const creator = await prisma.user.findUnique({
      where: { id: classroom.createdById },
      select: {
        ...AUTHOR_SELECT,
        totalXp: true,
        progress: { select: { xp: true, streak: true } },
      },
    });

    const shape = (u, extra = {}) => ({
      ...extra,
      user: publicUser(u),
      xp: u?.progress?.xp || u?.totalXp || 0,
      streak: u?.progress?.streak || 0,
    });

    const allMembers = [
      ...(creator ? [shape(creator, { id: "creator-" + creator.id, joinedAt: null, isCreator: true, role: "captain" })] : []),
      ...members.map((m) => shape(m.user, { id: m.id, joinedAt: m.joinedAt, isCreator: false, role: m.role || "member" })),
    ];

    res.json(allMembers);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// POST /api/study-group/:classroomId/promote { userId, role: "captain"|"member" }
// Creator-only: promote a member to captain (can set battle lineups) or demote.
router.post("/:classroomId/promote", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const uid = req.user.sub;
    const { userId: targetId, role } = req.body || {};
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { createdById: true, kind: true },
    });
    if (!classroom || classroom.kind !== "group") return res.status(404).json({ error: "Group not found" });
    if (classroom.createdById !== uid) return res.status(403).json({ error: "Only the group creator can manage captains" });
    if (!["captain", "member"].includes(role)) return res.status(400).json({ error: "role must be captain or member" });
    if (targetId === uid) return res.status(400).json({ error: "You're the creator — always a captain" });
    const m = await prisma.classroomMember.update({
      where: { classroomId_userId: { classroomId, userId: String(targetId || "") } },
      data: { role },
    }).catch(() => null);
    if (!m) return res.status(404).json({ error: "Not a member" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Promote error:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// POST /api/study-group/:classroomId/members/:userId/remove — kick a member.
// Creator can remove anyone except self; captains can remove regular members
// only (captains can't kick each other — that's creator power).
router.post("/:classroomId/members/:userId/remove", requireAuth, async (req, res) => {
  try {
    const { classroomId, userId: targetId } = req.params;
    const uid = req.user.sub;
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { createdById: true, kind: true, name: true },
    });
    if (!classroom || classroom.kind !== "group") return res.status(404).json({ error: "Group not found" });
    if (targetId === uid) return res.status(400).json({ error: "Use leave to remove yourself" });
    if (targetId === classroom.createdById) return res.status(403).json({ error: "Can't remove the group creator" });

    const meIsCreator = classroom.createdById === uid;
    if (!meIsCreator) {
      // Captains can kick, but only regular members — not other captains.
      const callerIsCaptain = await isGroupCaptain(classroomId, uid);
      if (!callerIsCaptain) return res.status(403).json({ error: "Only the creator or captains can remove members" });
      const target = await prisma.classroomMember.findUnique({
        where: { classroomId_userId: { classroomId, userId: String(targetId) } },
        select: { role: true },
      });
      if (!target) return res.status(404).json({ error: "Not a member" });
      if (target.role === "captain") return res.status(403).json({ error: "Only the creator can remove a captain" });
    }

    const removed = await prisma.classroomMember.delete({
      where: { classroomId_userId: { classroomId, userId: String(targetId) } },
    }).catch(() => null);
    if (!removed) return res.status(404).json({ error: "Not a member" });

    // Leave a system note in chat so the group sees it.
    try {
      const removedUser = await prisma.user.findUnique({
        where: { id: String(targetId) },
        select: { fullName: true, username: true },
      });
      await prisma.classroomMessage.create({
        data: {
          classroomId,
          userId: uid,
          text: `🚪 ${removedUser?.fullName || removedUser?.username || "A member"} was removed from the group`,
        },
      });
    } catch (e) {
      console.warn("Remove message failed:", e.message);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// POST /api/study-group/:classroomId/ring { code } — pull the group into a live
// session or battle via FCM ("Ring" from the Study Groups 2.0 brief — no media,
// just a push with a join link + an in-app overlay when the app is open).
// 5-min per-caller cooldown, one 30s reminder ping, then silence.
router.post("/:classroomId/ring", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const uid = req.user.sub;
    const { code } = req.body || {};
    if (!(await verifyMembership(classroomId, uid))) {
      return res.status(403).json({ error: "Not a member" });
    }
    const room = code ? getRoomByCode(String(code)) : null;
    if (!room || room.phase === "ended" || room.phase === "complete") {
      return res.status(404).json({ error: "No live session to ring for" });
    }
    const last = ringCooldowns.get(uid) || 0;
    const wait = RING_COOLDOWN_MS - (Date.now() - last);
    if (wait > 0) {
      return res.status(429).json({ error: "Ring is on cooldown — try again soon", retryAfterMs: wait });
    }
    ringCooldowns.set(uid, Date.now());

    const [me, classroom, members] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid }, select: { fullName: true, username: true } }),
      prisma.classroom.findUnique({ where: { id: classroomId }, select: { name: true } }),
      prisma.classroomMember.findMany({ where: { classroomId }, select: { userId: true } }),
    ]);
    const callerName = me?.fullName || me?.username || "A member";
    const groupName = classroom?.name || "your group";
    const recipients = members.map((m) => m.userId).filter((id) => id !== uid);
    const payload = {
      title: `🔔 ${callerName} is ringing ${groupName}`,
      body: `${room.title || "Live session"} — tap to join now`,
      tag: `ring-${room.code}`,
      requireInteraction: true,
      data: { tab: "discuss", liveCode: room.code, ring: "1", callerName, groupName },
    };
    const result = await sendPushToUsers(recipients, payload, { category: "social" });
    // One reminder ping ~30s later if the session is still alive, then stop.
    setTimeout(() => {
      const r = getRoomByCode(room.code);
      if (r && r.phase !== "ended" && r.phase !== "complete") {
        sendPushToUsers(recipients, { ...payload, title: `🔔 still ringing — ${groupName}` }, { category: "social" }).catch(() => {});
      }
    }, 30000).unref?.();
    res.json({ ok: true, sent: result?.sent || 0 });
  } catch (error) {
    console.error("Ring error:", error);
    res.status(500).json({ error: "Failed to ring the group" });
  }
});

// ============ GROUP LEADERBOARD ============

// GET /api/study-group/:classroomId/leaderboard
router.get("/:classroomId/leaderboard", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const { sort = "xp" } = req.query;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { createdById: true },
    });

    const members = await prisma.classroomMember.findMany({
      where: { classroomId },
      include: {
        user: {
          select: {
            ...AUTHOR_SELECT,
            totalXp: true,
            progress: { select: { xp: true, streak: true } },
            quizAttempts: {
              select: { score: true, total: true, xpAwarded: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 200,
            },
          },
        },
      },
    });

    const creator = await prisma.user.findUnique({
      where: { id: classroom.createdById },
      select: {
        ...AUTHOR_SELECT,
        totalXp: true,
        progress: { select: { xp: true, streak: true } },
        quizAttempts: {
          select: { score: true, total: true, xpAwarded: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        },
      },
    });

    const allUsers = [creator, ...members.map((m) => m.user)].filter(Boolean);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const entries = allUsers.map((u) => {
      const attempts = u.quizAttempts || [];
      const weeklyXP = attempts
        .filter((a) => new Date(a.createdAt) >= weekStart)
        .reduce((sum, a) => sum + (a.xpAwarded || 0), 0);
      const todayXP = attempts
        .filter((a) => new Date(a.createdAt) >= today)
        .reduce((sum, a) => sum + (a.xpAwarded || 0), 0);
      const totalQuestions = attempts.reduce((sum, a) => sum + (a.total || 0), 0);
      const accuracy = totalQuestions > 0
        ? Math.round((attempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalQuestions) * 100)
        : 0;
      const pub = publicUser(u);

      return {
        userId: u.id,
        username: u.username || u.fullName?.split(/\s+/)[0] || "Scholar",
        name: pub?.name || "Scholar",
        avatar: pub?.avatar || null,
        level: pub?.level || null,
        xp: u.progress?.xp || u.totalXp || 0,
        weeklyXP,
        todayXP,
        streak: u.progress?.streak || 0,
        accuracy,
        isMe: u.id === userId,
      };
    });

    const sortKey = sort === "streak" ? "streak" : sort === "all" ? "xp" : "weeklyXP";
    entries.sort((a, b) => b[sortKey] - a[sortKey]);

    res.json(entries);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ============ GOALS ============

// GET /api/study-group/:classroomId/goals
router.get("/:classroomId/goals", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const goals = await prisma.classroomGoal.findMany({
      where: { classroomId },
      include: {
        progress: {
          include: { user: { select: AUTHOR_SELECT } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const goalsWithTotals = goals.map((g) => ({
      ...g,
      progress: g.progress.map((p) => ({ ...p, user: publicUser(p.user) })),
      totalProgress: g.progress.reduce((sum, p) => sum + p.value, 0),
      percentage: Math.min(100, Math.round((g.progress.reduce((sum, p) => sum + p.value, 0) / g.targetValue) * 100)),
      myProgress: g.progress.find((p) => p.userId === userId)?.value || 0,
    }));

    res.json(goalsWithTotals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// POST /api/study-group/:classroomId/goals
// Faculty OR the classroom/group creator can set goals (student-run groups).
router.post("/:classroomId/goals", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { title, targetValue, metric, deadline } = req.body;
    if (!title?.trim() || !targetValue) return res.status(400).json({ error: "Title and target required" });

    const isFaculty = req.user.role === "TEACHER" || req.user.role === "LECTURER";
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { createdById: true },
    });
    if (!classroom) return res.status(404).json({ error: "Not found" });
    const canManage = isFaculty || classroom.createdById === req.user.sub || await isGroupCaptain(classroomId, req.user.sub);
    if (!canManage) {
      return res.status(403).json({ error: "Only group captains or faculty can set goals" });
    }

    const goal = await prisma.classroomGoal.create({
      data: {
        classroomId,
        title: title.trim(),
        targetValue: parseInt(targetValue),
        metric: metric || "xp",
        deadline: deadline ? new Date(deadline) : null,
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// POST /api/study-group/goals/:goalId/contribute
router.post("/goals/:goalId/contribute", requireAuth, async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.sub;
    const num = parseInt(req.body?.value, 10);
    if (!Number.isFinite(num) || num <= 0 || num > 10000) {
      return res.status(400).json({ error: "value must be a positive integer (max 10000)" });
    }

    const goal = await prisma.classroomGoal.findUnique({ where: { id: goalId } });
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    const isMember = await verifyMembership(goal.classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const progress = await prisma.classroomGoalProgress.upsert({
      where: { goalId_userId: { goalId, userId } },
      create: { goalId, userId, value: num },
      update: { value: { increment: num } },
    });

    // Check if goal is completed
    const allProgress = await prisma.classroomGoalProgress.aggregate({
      where: { goalId },
      _sum: { value: true },
    });
    if (allProgress._sum.value >= goal.targetValue && !goal.completedAt) {
      await prisma.classroomGoal.update({
        where: { id: goalId },
        data: { completedAt: new Date() },
      });
      // Notify the group that the goal was completed.
      const who = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, username: true },
      }).catch(() => null);
      notifyGroupMembers(goal.classroomId, userId, {
        title: `🎯 Goal completed — ${goal.title}`,
        body: `${who?.fullName || who?.username || "A member"} pushed it over the line`,
        tag: `grp-goal-${goalId}`,
      }).catch(() => {});
    }

    res.json(progress);
  } catch (error) {
    console.error("Error contributing to goal:", error);
    res.status(500).json({ error: "Failed to contribute" });
  }
});

// ============ STUDY ROOMS (POMODORO) ============

// GET /api/study-group/:classroomId/study-rooms
router.get("/:classroomId/study-rooms", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const rooms = await prisma.classroomStudyRoom.findMany({
      where: { classroomId, status: "active" },
      include: {
        host: { select: AUTHOR_SELECT },
        participants: {
          include: { user: { select: AUTHOR_SELECT } },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    res.json(
      rooms.map((r) => ({
        ...r,
        host: publicUser(r.host),
        participants: r.participants.map((p) => ({ ...p, user: publicUser(p.user) })),
      }))
    );
  } catch (error) {
    console.error("Error fetching study rooms:", error);
    res.status(500).json({ error: "Failed to fetch study rooms" });
  }
});

// POST /api/study-group/:classroomId/study-rooms
router.post("/:classroomId/study-rooms", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const { name, pomodoroMin, breakMin } = req.body;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const room = await prisma.classroomStudyRoom.create({
      data: {
        classroomId,
        name: name?.trim() || "Focus Session",
        hostId: userId,
        pomodoroMin: pomodoroMin || 25,
        breakMin: breakMin || 5,
        participants: {
          create: { userId },
        },
      },
      include: {
        host: { select: { id: true, username: true, fullName: true } },
        participants: {
          include: { user: { select: { id: true, username: true, fullName: true } } },
        },
      },
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Error creating study room:", error);
    res.status(500).json({ error: "Failed to create study room" });
  }
});

// GET /api/study-group/public-rooms — active public study rooms ("who's studying now")
router.get("/public-rooms", requireAuth, async (req, res) => {
  try {
    const rooms = await prisma.classroomStudyRoom.findMany({
      where: { isPublic: true, status: "active" },
      include: {
        host: { select: AUTHOR_SELECT },
        resource: { select: { id: true, title: true, subject: true, contentType: true, shareToken: true } },
        participants: {
          where: { leftAt: null },
          include: { user: { select: AUTHOR_SELECT } },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    // Normalize to the same shape the feed's roomBlock emits — host and
    // participants are flat public-user objects ({id, name, avatar, ...}),
    // not raw prisma rows, so <Avatar>/RoomCard render names and photos.
    res.json(rooms.map((r) => ({
      ...r,
      host: publicUser(r.host),
      participants: (r.participants || [])
        .map((p) => publicUser(p.user))
        .filter(Boolean),
      seatsUsed: r.participants.length,
    })));
  } catch (error) {
    console.error("Error fetching public rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// POST /api/study-group/public-rooms — "go live with friends" (any user can host)
router.post("/public-rooms", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { name, subject, focus, maxSeats, pomodoroMin, breakMin, resourceId } = req.body || {};

    let resource = null;
    if (resourceId) {
      resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: { id: true, title: true, subject: true },
      });
      if (!resource) return res.status(404).json({ error: "Material not found" });
    }

    const room = await prisma.classroomStudyRoom.create({
      data: {
        classroomId: null,
        isPublic: true,
        name: name?.trim() || "Focus Session",
        hostId: userId,
        subject: subject?.trim() || resource?.subject || null,
        focus: focus?.trim() || null,
        resourceId: resource?.id || null,
        maxSeats: Math.min(Math.max(parseInt(maxSeats) || 8, 2), 50),
        pomodoroMin: pomodoroMin || 25,
        breakMin: breakMin || 5,
        participants: {
          create: { userId },
        },
      },
      include: {
        host: { select: AUTHOR_SELECT },
        resource: { select: { id: true, title: true, subject: true, contentType: true, shareToken: true } },
        participants: {
          where: { leftAt: null },
          include: { user: { select: AUTHOR_SELECT } },
        },
      },
    });

    // Ping the host's circle — "went live studying X" appears in their feed
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { universityId: true },
      });
      await prisma.feedPost.create({
        data: {
          authorId: userId,
          kind: "activity",
          text: `went live${resource ? ` studying ${resource.title}` : ` in ${room.name}`}`,
          resourceId: resource?.id || null,
          universityId: profile?.universityId || null,
        },
      });
    } catch (err) {
      console.warn("Go-live activity post failed:", err.message);
    }

    // Notify the host's followers that they went live (bounded fan-out)
    try {
      const followers = await prisma.userFollow.findMany({
        where: { followingId: userId },
        select: { followerId: true },
        take: 200,
      });
      if (followers.length > 0) {
        const { sendPushToUsers } = await import("../lib/pushSender.js");
        const who = room.host?.fullName || room.host?.username || "A friend";
        await sendPushToUsers(
          followers.map((f) => f.followerId),
          {
            title: `${who} went live`,
            body: `Studying ${resource?.title || room.name} · ${room.maxSeats} seats`,
            tag: `golive-${room.id}`,
            data: { tab: "discuss" },
          },
          { category: "social" }
        );
      }
    } catch (err) {
      console.warn("Go-live push failed:", err.message);
    }

    res.status(201).json({
      ...room,
      host: publicUser(room.host),
      participants: (room.participants || [])
        .map((p) => publicUser(p.user))
        .filter(Boolean),
      seatsUsed: room.participants.length,
    });
  } catch (error) {
    console.error("Error creating public room:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// POST /api/study-group/study-rooms/:roomId/join
router.post("/study-rooms/:roomId/join", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.sub;

    const room = await prisma.classroomStudyRoom.findUnique({
      where: { id: roomId },
      include: { participants: { where: { leftAt: null }, select: { userId: true } } },
    });
    if (!room || room.status !== "active") {
      return res.status(404).json({ error: "Room is no longer active" });
    }
    const alreadyIn = room.participants.some((p) => p.userId === userId);
    if (!alreadyIn && room.participants.length >= room.maxSeats) {
      return res.status(409).json({ error: "Room is full" });
    }

    const participant = await prisma.classroomStudyRoomParticipant.upsert({
      where: { studyRoomId_userId: { studyRoomId: roomId, userId } },
      create: { studyRoomId: roomId, userId },
      update: { leftAt: null },
    });

    res.json(participant);
  } catch (error) {
    console.error("Error joining study room:", error);
    res.status(500).json({ error: "Failed to join" });
  }
});

// POST /api/study-group/study-rooms/:roomId/leave
router.post("/study-rooms/:roomId/leave", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.sub;

    await prisma.classroomStudyRoomParticipant.updateMany({
      where: { studyRoomId: roomId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error leaving study room:", error);
    res.status(500).json({ error: "Failed to leave" });
  }
});

// POST /api/study-group/study-rooms/:roomId/end
router.post("/study-rooms/:roomId/end", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.sub;

    const room = await prisma.classroomStudyRoom.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.hostId !== userId) return res.status(403).json({ error: "Only host can end" });

    await prisma.classroomStudyRoom.update({
      where: { id: roomId },
      data: { status: "completed", endedAt: new Date() },
    });

    await prisma.classroomStudyRoomParticipant.updateMany({
      where: { studyRoomId: roomId, leftAt: null },
      data: { leftAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error ending study room:", error);
    res.status(500).json({ error: "Failed to end room" });
  }
});

// ============ QUIZ BATTLES ============

// GET /api/study-group/:classroomId/battles — quiz-battle invites posted in
// group chat, annotated with live-room status (rooms live in memory).
router.get("/:classroomId/battles", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const msgs = await prisma.classroomMessage.findMany({
      where: { classroomId, liveCode: { not: null } },
      include: {
        user: { select: AUTHOR_SELECT },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const resourceIds = [...new Set(msgs.map((m) => m.resourceId).filter(Boolean))];
    const resources = resourceIds.length
      ? await prisma.resource.findMany({
          where: { id: { in: resourceIds } },
          select: RESOURCE_CARD_SELECT,
        })
      : [];
    const resById = new Map(resources.map((r) => [r.id, r]));

    res.json(
      msgs.map(({ user, ...m }) => {
        const room = m.liveCode ? getRoomByCode(m.liveCode) : null;
        return {
          id: m.id,
          code: m.liveCode,
          title: resById.get(m.resourceId)?.title || "Quiz battle",
          host: publicUser(user),
          createdAt: m.createdAt,
          live: !!room && room.phase !== "complete",
          joinable: !!room && room.phase === "lobby",
          players: room ? room.participants.size : 0,
        };
      })
    );
  } catch (error) {
    console.error("Error fetching battles:", error);
    res.status(500).json({ error: "Failed to fetch battles" });
  }
});

// ============ GROUP STREAK ============

// GET /api/study-group/:classroomId/streak
router.get("/:classroomId/streak", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { createdById: true },
    });

    const members = await prisma.classroomMember.findMany({
      where: { classroomId },
      include: {
        user: {
          select: {
            ...AUTHOR_SELECT,
            progress: { select: { streak: true, xp: true } },
            quizAttempts: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 },
          },
        },
      },
    });

    const creator = await prisma.user.findUnique({
      where: { id: classroom.createdById },
      select: {
        ...AUTHOR_SELECT,
        progress: { select: { streak: true, xp: true } },
        quizAttempts: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    const allUsers = [creator, ...members.map((m) => m.user)].filter(Boolean);

    // Group streak = min streak among all members who have studied at least once
    const streaks = allUsers.map((u) => u.progress?.streak || 0);
    const positiveStreaks = streaks.filter((s) => s > 0);
    const groupStreak = positiveStreaks.length > 0 ? Math.min(...positiveStreaks) : 0;

    // Members with quiz activity today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const studiedToday = allUsers.filter((u) =>
      (u.quizAttempts || []).some((a) => new Date(a.createdAt) >= today)
    ).length;

    // Members currently in an active study room for this classroom
    const activeParticipants = await prisma.classroomStudyRoomParticipant.findMany({
      where: { leftAt: null, studyRoom: { classroomId, status: "active" } },
      select: { userId: true },
    });
    const activeNow = new Set(activeParticipants.map((p) => p.userId)).size;

    const totalXP = allUsers.reduce((sum, u) => sum + (u.progress?.xp || 0), 0);

    res.json({
      groupStreak,
      totalMembers: allUsers.length,
      studiedToday,
      activeNow,
      totalXP,
      memberStreaks: allUsers.map((u) => {
        const pub = publicUser(u);
        return {
          userId: u.id,
          name: pub?.name || "Scholar",
          avatar: pub?.avatar || null,
          streak: u.progress?.streak || 0,
          xp: u.progress?.xp || 0,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching group streak:", error);
    res.status(500).json({ error: "Failed to fetch streak" });
  }
});

export default router;
