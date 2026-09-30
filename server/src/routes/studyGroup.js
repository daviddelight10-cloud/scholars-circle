import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AUTHOR_SELECT, publicUser } from "../lib/social.js";
import { getRoomByCode } from "../lib/liveQuizRooms.js";

const RESOURCE_CARD_SELECT = { id: true, title: true, subject: true, contentType: true, shareToken: true };

function liveState(code) {
  if (!code) return { liveCode: null, liveActive: false };
  const room = getRoomByCode(code);
  return { liveCode: code, liveActive: !!room && room.phase !== "complete" };
}

const router = express.Router();

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

// ============ CHAT ============

// GET /api/study-group/:classroomId/messages
router.get("/:classroomId/messages", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const messages = await prisma.classroomMessage.findMany({
      where: { classroomId },
      include: {
        user: { select: AUTHOR_SELECT },
        reactions: {
          include: { user: { select: { id: true, username: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Batch-attach shared-resource cards (no relation field — resolve by id)
    const resourceIds = [...new Set(messages.map((m) => m.resourceId).filter(Boolean))];
    const resources = resourceIds.length
      ? await prisma.resource.findMany({
          where: { id: { in: resourceIds } },
          select: RESOURCE_CARD_SELECT,
        })
      : [];
    const resById = new Map(resources.map((r) => [r.id, r]));

    res.json(
      messages.map(({ user, ...m }) => ({
        ...m,
        sender: publicUser(user),
        resource: m.resourceId ? resById.get(m.resourceId) || null : null,
        ...liveState(m.liveCode),
      }))
    );
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
    const { text, resourceId, liveCode } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text required" });

    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const message = await prisma.classroomMessage.create({
      data: {
        classroomId,
        userId,
        text: text.trim(),
        resourceId: resourceId || null,
        liveCode: liveCode || null,
      },
      include: {
        user: { select: AUTHOR_SELECT },
        reactions: true,
      },
    });

    const resource = message.resourceId
      ? await prisma.resource.findUnique({ where: { id: message.resourceId }, select: RESOURCE_CARD_SELECT })
      : null;

    const { user, ...rest } = message;
    res.status(201).json({ ...rest, sender: publicUser(user), resource, ...liveState(message.liveCode) });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
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
      ...(creator ? [shape(creator, { id: "creator-" + creator.id, joinedAt: null, isCreator: true })] : []),
      ...members.map((m) => shape(m.user, { id: m.id, joinedAt: m.joinedAt, isCreator: false })),
    ];

    res.json(allMembers);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: "Failed to fetch members" });
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
    if (!isFaculty && classroom.createdById !== req.user.sub) {
      return res.status(403).json({ error: "Only the group creator or faculty can set goals" });
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
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: "Value required" });

    const progress = await prisma.classroomGoalProgress.upsert({
      where: { goalId_userId: { goalId, userId } },
      create: { goalId, userId, value: parseInt(value) },
      update: { value: { increment: parseInt(value) } },
    });

    // Check if goal is completed
    const allProgress = await prisma.classroomGoalProgress.aggregate({
      where: { goalId },
      _sum: { value: true },
    });
    const goal = await prisma.classroomGoal.findUnique({ where: { id: goalId } });
    if (goal && allProgress._sum.value >= goal.targetValue && !goal.completedAt) {
      await prisma.classroomGoal.update({
        where: { id: goalId },
        data: { completedAt: new Date() },
      });
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
    const groupStreak = streaks.length > 0 ? Math.min(...streaks.filter((s) => s > 0)) : 0;

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
