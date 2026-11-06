import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ensureLeagueAssignments } from "../lib/leagueJob.js";
import { getWeekStart } from "../lib/tiers.js";

const router = express.Router();

// Leaderboard aggregates are expensive to compute per-request (XP sums per
// user over the period + rank order). Cache the ranked user-id list and XP
// maps for 45s — clients already poll every 30s, so identical work otherwise
// runs twice per user per minute at 10x traffic.
const LB_CACHE_TTL_MS = 45 * 1000;
const lbCache = new Map();

async function sumXpByUser(userIds, gte, lt) {
  if (!userIds.length) return new Map();
  const rows = await prisma.quizAttempt.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, createdAt: lt ? { gte, lt } : { gte } },
    _sum: { xpAwarded: true },
  });
  return new Map(rows.map((r) => [r.userId, r._sum.xpAwarded || 0]));
}

// Returns { order, xpMap, prevMap, dailyMap, prevRanks, dailyRanks } — userIds
// sorted by period XP desc, plus per-user maps for the response fields.
async function boardAggregates(cacheKey, { userIds, period, startDate, prevStartDate, todayStart }) {
  const hit = lbCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < LB_CACHE_TTL_MS) return hit.data;
  if (lbCache.size > 200) lbCache.clear();

  const [xpMap, prevMap, dailyMap] = await Promise.all([
    period === "all"
      ? prisma.userProgress
          .findMany({ where: { userId: { in: userIds } }, select: { userId: true, xp: true } })
          .then((rows) => new Map(rows.map((r) => [r.userId, r.xp || 0])))
      : sumXpByUser(userIds, startDate),
    startDate && prevStartDate ? sumXpByUser(userIds, prevStartDate, startDate) : Promise.resolve(new Map()),
    sumXpByUser(userIds, todayStart),
  ]);

  const order = [...userIds].sort((a, b) => (xpMap.get(b) || 0) - (xpMap.get(a) || 0));

  // Rank by previous-period XP → trend (positive = climbed places)
  const prevOrder = [...userIds].sort((a, b) => (prevMap.get(b) || 0) - (prevMap.get(a) || 0));
  const prevRanks = new Map(prevOrder.map((id, i) => [id, i + 1]));
  const dailyOrder = [...userIds].sort((a, b) => (dailyMap.get(b) || 0) - (dailyMap.get(a) || 0));
  const dailyRanks = new Map(dailyOrder.map((id, i) => [id, i + 1]));

  const data = { order, xpMap, prevMap, dailyMap, prevRanks, dailyRanks };
  lbCache.set(cacheKey, { ts: Date.now(), data });
  return data;
}

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

  // Scope to followed users, else the requester's league tier
  let scopeIds;
  if (friends === "true") {
    const followingIds = await prisma.userFollow.findMany({
      where: { followerId: req.user.sub },
      select: { followingId: true },
    });
    scopeIds = followingIds.map((f) => f.followingId);
    scopeIds.push(req.user.sub); // include self
  } else {
    const leagueUserIds = await prisma.userLeague.findMany({
      where: { tier: myTier },
      select: { userId: true },
    });
    scopeIds = leagueUserIds.map((l) => l.userId);
    if (!scopeIds.includes(req.user.sub)) scopeIds.push(req.user.sub);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

  // Aggregates (cached): XP per user for the period/prev-period/today plus
  // rank order — groupBy sums only, no per-attempt row loading.
  const cacheKey = `${period}|${friends === "true" ? `f:${req.user.sub}` : `t:${myTier}`}`;
  const { order, xpMap, dailyMap, prevRanks, dailyRanks } = await boardAggregates(cacheKey, {
    userIds: scopeIds,
    period,
    startDate,
    prevStartDate,
    todayStart,
  });

  const totalCount = order.length;
  const myRank = (order.indexOf(req.user.sub) + 1) || null;
  const pageIds = order.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  // Load full user fields for just the page being returned.
  const pageUsers = await prisma.user.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      progress: { select: { xp: true, streak: true, mastery: true } },
      userProfile: { select: { avatar: true } },
    },
  });
  const byId = new Map(pageUsers.map((u) => [u.id, u]));

  const leaderboardWithDailyRank = pageIds.map((id) => {
    const user = byId.get(id);
    if (!user) return null;
    const masteryObj = user.progress?.mastery || {};
    const masteryValues = Object.values(masteryObj);
    const avgMastery = masteryValues.length > 0
      ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
      : 0;
    const currentRank = order.indexOf(id) + 1;
    return {
      username: user.username || user.fullName?.split(/\s+/)[0] || user.email?.split("@")[0] || "scholar",
      fullName: user.fullName || null,
      userId: user.id,
      isMe: user.id === req.user.sub,
      avatar: user.userProfile?.avatar || null,
      xp: xpMap.get(id) || 0,
      totalXP: user.progress?.xp || 0,
      dailyXP: dailyMap.get(id) || 0,
      streak: user.progress?.streak || 0,
      avgMastery: Math.round(avgMastery),
      trend: startDate && prevStartDate ? (prevRanks.get(id) || (totalCount + 1)) - currentRank : 0,
      dailyRank: dailyRanks.get(id) || 0,
    };
  }).filter(Boolean);

  res.json({
    entries: leaderboardWithDailyRank,
    total: totalCount,
    myRank,
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
      isActivated: true,
      activatedAt: true,
      activationExpiry: true,
      planType: true,
      paymentStatus: true,
      referralCode: true,
      _count: { select: { referralsGiven: true } },
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

