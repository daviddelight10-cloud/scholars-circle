import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Leaderboard: accessible to all authenticated users
router.get("/leaderboard", requireAuth, async (req, res) => {
  const { period = "all", subjectId } = req.query;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  let startDate;

  if (period === "daily") {
    startDate = todayStart;
  } else if (period === "weekly") {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === "monthly") {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const users = await prisma.user.findMany({
    where: {
      role: "STUDENT",
    },
    select: {
      id: true,
      username: true,
      role: true,
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
    },
    take: 100,
  });

  const leaderboard = users.map((user) => {
    const masteryObj = user.progress?.mastery || {};
    const masteryValues = Object.values(masteryObj);
    const avgMastery = masteryValues.length > 0
      ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
      : 0;

    const sessions = user.sessions || [];
    const totalCorrect = user.progress?.totalCorrect || 0;
    const totalQuestions = sessions.reduce((sum, s) => sum + s.total, 0);
    const correctRate = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const studyHours = sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 3600;

    const personalBest = sessions.length > 0
      ? Math.max(...sessions.filter(s => s.mode === "exam").map(s => s.percentage))
      : 0;

    // Calculate XP gained in period
    const periodXP = period !== "all"
      ? sessions.reduce((sum, s) => sum + (s.score * 10), 0)
      : user.progress?.xp || 0;

    // Calculate daily XP (XP earned today)
    const todaySessions = sessions.filter(s => new Date(s.createdAt) >= todayStart);
    const dailyXP = todaySessions.reduce((sum, s) => sum + (s.score * 10), 0);

    return {
      username: user.username,
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
      earnedBadges: [], // Will be populated from badge logic
    };
  }).sort((a, b) => b.xp - a.xp);

  // Calculate daily ranks (based on daily XP)
  const sortedByDailyXP = [...leaderboard].sort((a, b) => b.dailyXP - a.dailyXP);
  const dailyRanks = {};
  sortedByDailyXP.forEach((entry, index) => {
    dailyRanks[entry.userId] = index + 1;
  });

  // Add daily rank to each entry
  const leaderboardWithDailyRank = leaderboard.map(entry => ({
    ...entry,
    dailyRank: dailyRanks[entry.userId] || 0,
  }));

  res.json(leaderboardWithDailyRank);
});

// User profile endpoint - get detailed stats for a specific user
router.get("/:userId/profile", requireAuth, async (req, res) => {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
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
          subjectId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const masteryObj = user.progress?.mastery || {};
  const masteryValues = Object.values(masteryObj);
  const avgMastery = masteryValues.length > 0
    ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
    : 0;

  const sessions = user.sessions || [];
  const totalQuestions = sessions.reduce((sum, s) => sum + s.total, 0);
  const correctRate = totalQuestions > 0 ? ((user.progress?.totalCorrect || 0) / totalQuestions) * 100 : 0;
  const studyHours = sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 3600;
  const personalBest = sessions.length > 0
    ? Math.max(...sessions.filter(s => s.mode === "exam").map(s => s.percentage))
    : 0;

  res.json({
    username: user.username,
    xp: user.progress?.xp || 0,
    sessions: user.progress?.sessions || 0,
    streak: user.progress?.streak || 0,
    avgMastery: Math.round(avgMastery),
    correctRate: Math.round(correctRate),
    studyHours: Math.round(studyHours * 10) / 10,
    personalBest: Math.round(personalBest),
    recentSessions: sessions.map(s => ({
      score: s.score,
      total: s.total,
      percentage: s.percentage,
      mode: s.mode,
      subjectId: s.subjectId,
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
    take: 100,
  });
  res.json(users);
});

// Teacher-only: recent login events
router.get("/logins", requireAuth, requireRole("TEACHER"), async (_req, res) => {
  const events = await prisma.loginEvent.findMany({
    include: {
      user: { select: { id: true, username: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(events);
});

export default router;

