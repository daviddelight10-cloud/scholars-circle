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
          sessions: true,
          streak: true,
          totalCorrect: true,
          mastery: true,
        },
      },
      sessions: {
        where: startDate ? { createdAt: { gte: startDate } } : undefined,
        select: {
          score: true,
          total: true,
          percentage: true,
          durationSec: true,
          mode: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      quizAttempts: {
        where: startDate ? { createdAt: { gte: startDate } } : undefined,
        select: {
          score: true,
          xpAwarded: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Fetch previous period data for trend calculation
  let prevPeriodXPMap = {};
  if (startDate && prevStartDate) {
    const prevUsers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        sessions: {
          where: { createdAt: { gte: prevStartDate, lt: startDate } },
          select: { score: true, createdAt: true },
        },
        quizAttempts: {
          where: { createdAt: { gte: prevStartDate, lt: startDate } },
          select: { score: true, xpAwarded: true, createdAt: true },
        },
      },
    });
    prevPeriodXPMap = {};
    for (const u of prevUsers) {
      const sessionXP = u.sessions.reduce((sum, s) => sum + (s.score * 10), 0);
      const quizXP = u.quizAttempts.reduce((sum, q) => sum + (q.xpAwarded || 0), 0);
      prevPeriodXPMap[u.id] = sessionXP + quizXP;
    }
  }

  const leaderboard = users.map((user) => {
    const masteryObj = user.progress?.mastery || {};
    const masteryValues = Object.values(masteryObj);
    const avgMastery = masteryValues.length > 0
      ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
      : 0;

    const sessions = user.sessions || [];
    const quizAttempts = user.quizAttempts || [];
    const totalCorrect = user.progress?.totalCorrect || 0;
    const totalQuestions = sessions.reduce((sum, s) => sum + s.total, 0);
    const correctRate = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const studyHours = sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 3600;

    const examScores = sessions.filter(s => s.mode === "exam").map(s => s.percentage);
    const personalBest = examScores.length > 0
      ? Math.max(...examScores)
      : 0;

    // Calculate XP gained in period (from both sessions AND quiz attempts)
    const sessionXP = sessions.reduce((sum, s) => sum + (s.score * 10), 0);
    const quizXP = quizAttempts.reduce((sum, q) => sum + (q.xpAwarded || 0), 0);
    const periodXP = period !== "all"
      ? sessionXP + quizXP
      : user.progress?.xp || 0;

    // Calculate daily XP (XP earned today)
    const todaySessions = sessions.filter(s => new Date(s.createdAt) >= todayStart);
    const todayQuizzes = quizAttempts.filter(q => new Date(q.createdAt) >= todayStart);
    const dailyXP = todaySessions.reduce((sum, s) => sum + (s.score * 10), 0)
      + todayQuizzes.reduce((sum, q) => sum + (q.xpAwarded || 0), 0);

    // Calculate trend (rank change vs previous period)
    const prevXP = prevPeriodXPMap[user.id] || 0;
    const currentRank = 0; // will be set after sorting

    return {
      username: user.username || user.fullName?.split(/\s+/)[0] || user.email?.split("@")[0] || "scholar",
      userId: user.id,
      xp: periodXP,
      totalXP: user.progress?.xp || 0,
      dailyXP: dailyXP,
      sessions: user.progress?.sessions || 0,
      streak: user.progress?.streak || 0,
      avgMastery: Math.round(avgMastery),
      correctRate: Math.round(correctRate),
      studyHours: Math.round(studyHours * 10) / 10,
      personalBest: Math.round(personalBest),
      lastActive: sessions.length > 0 ? sessions[0].createdAt : user.createdAt,
      earnedBadges: [],
      _prevXP: prevXP,
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
    await prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId: req.user.sub, followingId: userId } },
      create: { followerId: req.user.sub, followingId: userId },
      update: {},
    });
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
          sessions: true,
          streak: true,
          totalCorrect: true,
          mastery: true,
        },
      },
      sessions: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          score: true,
          total: true,
          percentage: true,
          durationSec: true,
          mode: true,
          createdAt: true,
        },
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

  const sessions = user.sessions || [];
  const totalQuestions = sessions.reduce((sum, s) => sum + s.total, 0);
  const correctRate = totalQuestions > 0 ? ((user.progress?.totalCorrect || 0) / totalQuestions) * 100 : 0;
  const studyHours = sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 3600;
  const profileExamScores = sessions.filter(s => s.mode === "exam").map(s => s.percentage);
  const personalBest = profileExamScores.length > 0
    ? Math.max(...profileExamScores)
    : 0;

  res.json({
    username: user.username || user.fullName?.split(/\s+/)[0] || user.email?.split("@")[0] || "scholar",
    xp: user.progress?.xp || 0,
    sessions: user.progress?.sessions || 0,
    streak: user.progress?.streak || 0,
    avgMastery: Math.round(avgMastery),
    correctRate: Math.round(correctRate),
    studyHours: Math.round(studyHours * 10) / 10,
    personalBest: Math.round(personalBest),
    isFollowing: !!followInfo,
    followerCount,
    followingCount,
    recentSessions: sessions.map(s => ({
      score: s.score,
      total: s.total,
      percentage: s.percentage,
      mode: s.mode,
      date: s.createdAt,
    })),
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

