import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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
        user: { select: { id: true, username: true, fullName: true, role: true } },
        reactions: {
          include: { user: { select: { id: true, username: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(messages);
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
    const { text, resourceId } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text required" });

    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const message = await prisma.classroomMessage.create({
      data: {
        classroomId,
        userId,
        text: text.trim(),
        resourceId: resourceId || null,
      },
      include: {
        user: { select: { id: true, username: true, fullName: true, role: true } },
        reactions: true,
      },
    });

    res.status(201).json(message);
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
            id: true, username: true, fullName: true, role: true,
            totalXp: true,
            progress: { select: { xp: true, streak: true, sessions: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    // Include the teacher/creator
    const creator = await prisma.user.findUnique({
      where: { id: classroom.createdById },
      select: {
        id: true, username: true, fullName: true, role: true,
        totalXp: true,
        progress: { select: { xp: true, streak: true, sessions: true } },
      },
    });

    const allMembers = [
      ...(creator ? [{ id: "creator-" + creator.id, user: creator, joinedAt: null, isCreator: true }] : []),
      ...members.map((m) => ({ ...m, isCreator: false })),
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
            id: true, username: true, fullName: true,
            totalXp: true,
            progress: { select: { xp: true, streak: true, sessions: true } },
            sessions: { select: { score: true, total: true, createdAt: true } },
          },
        },
      },
    });

    const creator = await prisma.user.findUnique({
      where: { id: classroom.createdById },
      select: {
        id: true, username: true, fullName: true,
        totalXp: true,
        progress: { select: { xp: true, streak: true, sessions: true } },
        sessions: { select: { score: true, total: true, createdAt: true } },
      },
    });

    const allUsers = [creator, ...members.map((m) => m.user)].filter(Boolean);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const entries = allUsers.map((u) => {
      const weeklySessions = (u.sessions || []).filter((s) => new Date(s.createdAt) >= weekStart);
      const weeklyXP = weeklySessions.reduce((sum, s) => sum + (s.score * 10), 0);
      const totalQuestions = (u.sessions || []).reduce((sum, s) => sum + s.total, 0);
      const accuracy = totalQuestions > 0
        ? Math.round(((u.sessions || []).reduce((sum, s) => sum + s.score, 0) / totalQuestions) * 100)
        : 0;

      return {
        userId: u.id,
        username: u.username || u.fullName?.split(/\s+/)[0] || "Scholar",
        xp: u.progress?.xp || u.totalXp || 0,
        weeklyXP,
        streak: u.progress?.streak || 0,
        sessions: u.progress?.sessions || 0,
        accuracy,
        isMe: u.id === userId,
      };
    });

    const sortKey = sort === "streak" ? "streak" : sort === "sessions" ? "sessions" : "weeklyXP";
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
          include: { user: { select: { id: true, username: true, fullName: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const goalsWithTotals = goals.map((g) => ({
      ...g,
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
router.post("/:classroomId/goals", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { title, targetValue, metric, deadline } = req.body;
    if (!title?.trim() || !targetValue) return res.status(400).json({ error: "Title and target required" });

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
        host: { select: { id: true, username: true, fullName: true } },
        participants: {
          include: { user: { select: { id: true, username: true, fullName: true } } },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    res.json(rooms);
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

// POST /api/study-group/study-rooms/:roomId/join
router.post("/study-rooms/:roomId/join", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.sub;

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

// ============ QUIZ DUELS ============

// GET /api/study-group/:classroomId/duels
router.get("/:classroomId/duels", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const duels = await prisma.classroomDuel.findMany({
      where: {
        classroomId,
        OR: [{ challengerId: userId }, { challengedId: userId }],
      },
      include: {
        challenger: { select: { id: true, username: true, fullName: true } },
        challenged: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json(duels);
  } catch (error) {
    console.error("Error fetching duels:", error);
    res.status(500).json({ error: "Failed to fetch duels" });
  }
});

// POST /api/study-group/:classroomId/duels
router.post("/:classroomId/duels", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user.sub;
    const { challengedId, subjectId } = req.body;
    if (!challengedId) return res.status(400).json({ error: "Challenged user required" });

    const isMember = await verifyMembership(classroomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    if (challengedId === userId) return res.status(400).json({ error: "Cannot challenge yourself" });

    const duel = await prisma.classroomDuel.create({
      data: {
        classroomId,
        challengerId: userId,
        challengedId,
        subjectId: subjectId || null,
      },
      include: {
        challenger: { select: { id: true, username: true, fullName: true } },
        challenged: { select: { id: true, username: true, fullName: true } },
      },
    });

    res.status(201).json(duel);
  } catch (error) {
    console.error("Error creating duel:", error);
    res.status(500).json({ error: "Failed to create duel" });
  }
});

// POST /api/study-group/duels/:duelId/respond
router.post("/duels/:duelId/respond", requireAuth, async (req, res) => {
  try {
    const { duelId } = req.params;
    const userId = req.user.sub;
    const { status } = req.body; // accepted | declined

    const duel = await prisma.classroomDuel.findUnique({ where: { id: duelId } });
    if (!duel) return res.status(404).json({ error: "Duel not found" });
    if (duel.challengedId !== userId) return res.status(403).json({ error: "Not the challenged user" });

    const updated = await prisma.classroomDuel.update({
      where: { id: duelId },
      data: { status },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error responding to duel:", error);
    res.status(500).json({ error: "Failed to respond" });
  }
});

// POST /api/study-group/duels/:duelId/complete
router.post("/duels/:duelId/complete", requireAuth, async (req, res) => {
  try {
    const { duelId } = req.params;
    const userId = req.user.sub;
    const { challengerScore, challengedScore } = req.body;

    const duel = await prisma.classroomDuel.findUnique({ where: { id: duelId } });
    if (!duel) return res.status(404).json({ error: "Duel not found" });
    if (duel.status !== "accepted") return res.status(400).json({ error: "Duel not accepted" });

    const winnerId = challengerScore > challengedScore
      ? duel.challengerId
      : challengedScore > challengerScore
      ? duel.challengedId
      : null;

    const updated = await prisma.classroomDuel.update({
      where: { id: duelId },
      data: {
        status: "completed",
        challengerScore: parseInt(challengerScore) || 0,
        challengedScore: parseInt(challengedScore) || 0,
        winnerId,
        completedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error completing duel:", error);
    res.status(500).json({ error: "Failed to complete duel" });
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
            id: true,
            progress: { select: { streak: true, sessions: true, xp: true } },
            sessions: { select: { createdAt: true } },
          },
        },
      },
    });

    const creator = await prisma.user.findUnique({
      where: { id: classroom.createdById },
      select: {
        id: true,
        progress: { select: { streak: true, sessions: true, xp: true } },
        sessions: { select: { createdAt: true } },
      },
    });

    const allUsers = [creator, ...members.map((m) => m.user)].filter(Boolean);

    // Group streak = min streak among all members who have studied at least once
    const streaks = allUsers.map((u) => u.progress?.streak || 0);
    const groupStreak = streaks.length > 0 ? Math.min(...streaks.filter((s) => s > 0)) : 0;

    // Members studying today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const studiedToday = allUsers.filter((u) =>
      (u.sessions || []).some((s) => new Date(s.createdAt) >= today)
    ).length;

    // Collective study hours (approx from sessions)
    const totalSessions = allUsers.reduce((sum, u) => sum + (u.progress?.sessions || 0), 0);

    res.json({
      groupStreak,
      totalMembers: allUsers.length,
      studiedToday,
      totalSessions,
      memberStreaks: allUsers.map((u) => ({
        userId: u.id,
        streak: u.progress?.streak || 0,
        xp: u.progress?.xp || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching group streak:", error);
    res.status(500).json({ error: "Failed to fetch streak" });
  }
});

export default router;
