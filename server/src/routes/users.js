import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ensureLeagueAssignments, getWeekStart } from "../lib/leagueJob.js";

const router = express.Router();

// GET /api/users/me/department - Get current user's department and year level
router.get("/me/department", requireAuth, async (req, res) => {
  try {
    const userDept = await prisma.userDepartment.findUnique({
      where: { userId: req.user.sub },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!userDept) return res.json({ department: null, yearLevel: null, semester: null });
    res.json({
      department: userDept.department?.name || null,
      yearLevel: userDept.yearLevel || null,
      semester: userDept.semester || null,
    });
  } catch (error) {
    console.error("Error fetching user department:", error);
    res.status(500).json({ error: "Failed to fetch department" });
  }
});

// Leaderboard: accessible to all authenticated users
router.get("/leaderboard", requireAuth, async (req, res) => {
  try {
  const { period = "all", friends = "false", page = "1", limit = "50" } = req.query;

  // Ensure current user has a league assignment for this week
  const weekStart = getWeekStart();
  let myLeague = await prisma.userLeague.findUnique({ where: { userId: req.user.sub } });
  if (!myLeague || new Date(myLeague.weekStart) < weekStart) {
    await ensureLeagueAssignments();
    myLeague = await prisma.userLeague.findUnique({ where: { userId: req.user.sub } });
  }
  const myTier = myLeague?.tier || "bronze";
  const myPromoted = myLeague?.promoted || false;
  const myDemoted = myLeague?.demoted || false;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  let startDate;
  let prevStartDate;

  if (period === "daily") {
    startDate = todayStart;
    prevStartDate = new Date(todayStart);
    prevStartDate.setDate(prevStartDate.getDate() - 1);
  } else if (period === "weekly") {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    prevStartDate = new Date(now);
    prevStartDate.setDate(prevStartDate.getDate() - 14);
  } else if (period === "monthly") {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 1);
    prevStartDate = new Date(now);
    prevStartDate.setMonth(prevStartDate.getMonth() - 2);
  }

  // Build where clause — scope to user's league unless friends filter is on
  const userWhere = { role: "STUDENT" };
  if (friends === "true") {
    const followingIds = await prisma.userFollow.findMany({
      where: { followerId: req.user.sub },
      select: { followingId: true },
    });
    const ids = followingIds.map(f => f.followingId);
    ids.push(req.user.sub); // include self
    userWhere.id = { in: ids };
  } else {
    // Scope to same league tier
    const leagueUserIds = await prisma.userLeague.findMany({
      where: { tier: myTier },
      select: { userId: true },
    });
    const leagueIds = leagueUserIds.map(l => l.userId);
    leagueIds.push(req.user.sub); // ensure self is included
    userWhere.id = { in: leagueIds };
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

  // quizAttempts are the live XP source; legacy Session rows are dead (Learn tab removed).
  // Bound the include to the period — or just today for "all" (dailyXP pill).
  const activitySince = startDate || todayStart;
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
      totalXp: true,
      progress: {
        select: {
          xp: true,
          streak: true,
          mastery: true,
        },
      },
      userProfile: {
        select: { avatar: true },
      },
      quizAttempts: {
        where: { createdAt: { gte: activitySince } },
        select: {
          xpAwarded: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Fetch previous period quiz XP for trend calculation
  let prevPeriodXPMap = {};
  if (startDate && prevStartDate) {
    const prevUsers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        quizAttempts: {
          where: { createdAt: { gte: prevStartDate, lt: startDate } },
          select: { xpAwarded: true },
        },
      },
    });
    prevPeriodXPMap = {};
    for (const u of prevUsers) {
      prevPeriodXPMap[u.id] = u.quizAttempts.reduce((sum, q) => sum + (q.xpAwarded || 0), 0);
    }
  }

  const leaderboard = users.map((user) => {
    const masteryObj = user.progress?.mastery || {};
    const masteryValues = Object.values(masteryObj);
    const avgMastery = masteryValues.length > 0
      ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
      : 0;

    const quizAttempts = user.quizAttempts || [];
    const quizXP = quizAttempts.reduce((sum, q) => sum + (q.xpAwarded || 0), 0);
    const periodXP = period !== "all"
      ? quizXP
      : user.progress?.xp || 0;

    // XP earned today (for the "+N today" pill)
    const dailyXP = quizAttempts
      .filter((q) => new Date(q.createdAt) >= todayStart)
      .reduce((sum, q) => sum + (q.xpAwarded || 0), 0);

    return {
      username: user.username || user.fullName?.split(/\s+/)[0] || user.email?.split("@")[0] || "scholar",
      fullName: user.fullName || null,
      userId: user.id,
      isMe: user.id === req.user.sub,
      avatar: user.userProfile?.avatar || null,
      xp: periodXP,
      totalXP: user.progress?.xp || 0,
      dailyXP,
      streak: user.progress?.streak || 0,
      avgMastery: Math.round(avgMastery),
      _prevXP: prevPeriodXPMap[user.id] || 0,
      trend: 0, // will be calculated after sorting
    };
  }).sort((a, b) => b.xp - a.xp);

  // Calculate trend: compare current rank with previous period rank
  if (startDate && prevStartDate) {
    const prevSorted = [...leaderboard].sort((a, b) => b._prevXP - a._prevXP);
    const prevRanks = {};
    prevSorted.forEach((entry, index) => {
      prevRanks[entry.userId] = index + 1;
    });
    leaderboard.forEach((entry, index) => {
      const currentRank = index + 1;
      const prevRank = prevRanks[entry.userId] || (leaderboard.length + 1);
      entry.trend = prevRank - currentRank; // positive = moved up, negative = moved down
    });
  }

  // Calculate daily ranks (based on daily XP)
  const sortedByDailyXP = [...leaderboard].sort((a, b) => b.dailyXP - a.dailyXP);
  const dailyRanks = {};
  sortedByDailyXP.forEach((entry, index) => {
    dailyRanks[entry.userId] = index + 1;
  });

  // Add daily rank, remove internal fields, apply pagination
  const totalCount = leaderboard.length;
  const paginated = leaderboard.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  const leaderboardWithDailyRank = paginated.map(entry => {
    const { _prevXP, ...rest } = entry;
    return {
      ...rest,
      dailyRank: dailyRanks[entry.userId] || 0,
    };
  });

  res.json({
    entries: leaderboardWithDailyRank,
    total: totalCount,
    page: pageNum,
    limit: limitNum,
    hasMore: pageNum * limitNum < totalCount,
    league: {
      tier: myTier,
      promoted: myPromoted,
      demoted: myDemoted,
      weekStart: myLeague?.weekStart || weekStart,
      totalInLeague: friends === "true" ? totalCount : (await prisma.userLeague.count({ where: { tier: myTier } }).catch(() => totalCount)),
    },
  });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Follow a user
router.post("/:userId/follow", requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user.sub) return res.status(400).json({ error: "Cannot follow yourself" });
  try {
    const existing = await prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: req.user.sub, followingId: userId } },
    });
    await prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId: req.user.sub, followingId: userId } },
      create: { followerId: req.user.sub, followingId: userId },
      update: {},
    });
    if (!existing) {
      try {
        const me = await prisma.user.findUnique({
          where: { id: req.user.sub },
          select: { fullName: true, username: true },
        });
        const { sendPushToUser } = await import("../lib/pushSender.js");
        await sendPushToUser(
          userId,
          {
            title: `${me?.fullName || me?.username || "Someone"} started following you`,
            body: "Tap to view their profile",
            tag: "social",
            data: { tab: "discuss" },
          },
          { category: "social" }
        );
      } catch (e) {
        console.warn("[users] follow push failed:", e?.message);
      }
    }
    res.json({ following: true });
  } catch (error) {
    console.error("Follow error:", error);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

// Unfollow a user
router.delete("/:userId/follow", requireAuth, async (req, res) => {
  const { userId } = req.params;
  try {
    await prisma.userFollow.deleteMany({
      where: { followerId: req.user.sub, followingId: userId },
    });
    res.json({ following: false });
  } catch (error) {
    console.error("Unfollow error:", error);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

// Get following status + counts
router.get("/:userId/follow-info", requireAuth, async (req, res) => {
  const { userId } = req.params;
  try {
    const [isFollowing, followerCount, followingCount] = await Promise.all([
      prisma.userFollow.findUnique({
        where: { followerId_followingId: { followerId: req.user.sub, followingId: userId } },
      }),
      prisma.userFollow.count({ where: { followingId: userId } }),
      prisma.userFollow.count({ where: { followerId: userId } }),
    ]);
    res.json({ isFollowing: !!isFollowing, followerCount, followingCount });
  } catch (error) {
    console.error("Follow info error:", error);
    res.status(500).json({ error: "Failed to fetch follow info" });
  }
});

// User profile endpoint - get detailed stats for a specific user
router.get("/:userId/profile", requireAuth, async (req, res) => {
  const { userId } = req.params;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      createdAt: true,
      progress: {
        select: {
          xp: true,
          streak: true,
          mastery: true,
        },
      },
      userProfile: {
        select: { avatar: true, level: true, university: { select: { name: true } } },
      },
      quizAttempts: {
        where: { createdAt: { gte: weekAgo } },
        select: { xpAwarded: true },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check if current user follows this user
  const followInfo = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId: req.user.sub, followingId: userId } },
  }).catch(() => null);
  const [followerCount, followingCount] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }).catch(() => 0),
    prisma.userFollow.count({ where: { followerId: userId } }).catch(() => 0),
  ]);

  const masteryObj = user.progress?.mastery || {};
  const masteryValues = Object.values(masteryObj);
  const avgMastery = masteryValues.length > 0
    ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
    : 0;

  const weeklyXP = (user.quizAttempts || []).reduce((sum, q) => sum + (q.xpAwarded || 0), 0);

  res.json({
    username: user.username || user.fullName?.split(/\s+/)[0] || user.email?.split("@")[0] || "scholar",
    fullName: user.fullName || null,
    avatar: user.userProfile?.avatar || null,
    level: user.userProfile?.level || null,
    uni: user.userProfile?.university?.name || null,
    xp: user.progress?.xp || 0,
    streak: user.progress?.streak || 0,
    avgMastery: Math.round(avgMastery),
    weeklyXP,
    isFollowing: !!followInfo,
    followerCount,
    followingCount,
  });
});

// Teacher-only: list users (no password hashes)
router.get("/", requireAuth, requireRole("TEACHER"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// Teacher-only: recent login events (last 30 days)
router.get("/logins", requireAuth, requireRole("TEACHER"), async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const events = await prisma.loginEvent.findMany({
    where: { createdAt: { gte: since } },
    include: {
      user: { select: { id: true, username: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(events);
});

export default router;

