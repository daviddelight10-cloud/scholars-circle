import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getUserLeague, addLeagueXP, TIERS, computeTier,
  awardBadge, checkDuelBadges, checkStreakBadges, checkStudyBadges,
} from "../lib/badges.js";

const router = express.Router();

// ─── LEAGUES ───────────────────────────────────────────────────────

// GET /gamification/league — current user's league status
router.get("/league", requireAuth, async (req, res) => {
  try {
    const league = await getUserLeague(req.user.sub);
    res.json(league);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /gamification/league/standings — weekly XP leaderboard for tiers
router.get("/league/standings", requireAuth, async (req, res) => {
  try {
    const { tier } = req.query;
    const where = tier ? { tier } : {};
    const standings = await prisma.userLeague.findMany({
      where,
      orderBy: { weeklyXP: "desc" },
      take: 50,
      include: { user: { select: { id: true, username: true } } },
    });
    res.json(standings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BADGES ────────────────────────────────────────────────────────

// GET /gamification/badges — all available badges
router.get("/badges", requireAuth, async (req, res) => {
  try {
    const badges = await prisma.badge.findMany({ orderBy: { category: "asc" } });
    res.json(badges);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /gamification/my-badges — user's earned badges
router.get("/my-badges", requireAuth, async (req, res) => {
  try {
    const ub = await prisma.userBadge.findMany({
      where: { userId: req.user.sub },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    });
    res.json(ub);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gamification/check-badges — trigger badge checks (called after sessions)
router.post("/check-badges", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const streakBadges = await checkStreakBadges(userId);
    const studyBadges = await checkStudyBadges(userId);
    const duelBadges = await checkDuelBadges(userId);
    const all = [...streakBadges, ...studyBadges, ...duelBadges];
    res.json({ awarded: all.map(b => b.badge) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── WEEKLY CHALLENGES ─────────────────────────────────────────────

// GET /gamification/challenges?classroomId=...
router.get("/challenges", requireAuth, async (req, res) => {
  try {
    const { classroomId } = req.query;
    if (!classroomId) return res.status(400).json({ error: "classroomId required" });
    const now = new Date();
    const challenges = await prisma.weeklyChallenge.findMany({
      where: { classroomId, endAt: { gte: now } },
      orderBy: { startAt: "desc" },
      include: {
        entries: {
          orderBy: { score: "desc" },
          take: 10,
          include: { user: { select: { id: true, username: true } } },
        },
      },
    });
    res.json(challenges);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gamification/challenges — teacher creates a weekly challenge
router.post("/challenges", requireAuth, async (req, res) => {
  try {
    const { classroomId, title, description, questionIds, startAt, endAt, xpReward } = req.body;
    if (!classroomId || !title || !questionIds?.length) {
      return res.status(400).json({ error: "classroomId, title, questionIds required" });
    }
    const challenge = await prisma.weeklyChallenge.create({
      data: {
        classroomId, title, description,
        questionIds,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(Date.now() + 7 * 86400000),
        xpReward: xpReward || 50,
      },
    });
    res.json(challenge);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gamification/challenges/:id/submit — student submits challenge answers
router.post("/challenges/:id/submit", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;
    const { score, total } = req.body;

    const challenge = await prisma.weeklyChallenge.findUnique({ where: { id } });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    if (new Date() > challenge.endAt) return res.status(400).json({ error: "Challenge ended" });

    const existing = await prisma.weeklyChallengeEntry.findUnique({
      where: { challengeId_userId: { challengeId: id, userId } },
    });

    const entry = await prisma.weeklyChallengeEntry.upsert({
      where: { challengeId_userId: { challengeId: id, userId } },
      update: { score: Math.max(score, 0), total },
      create: { challengeId: id, userId, score, total },
    });

    // Award XP only on first submission (not re-submissions)
    if (!existing) {
      await addLeagueXP(userId, challenge.xpReward);
    }

    res.json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DUELS ─────────────────────────────────────────────────────────

// GET /gamification/duels — user's duels (sent/received)
router.get("/duels", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const duels = await prisma.challengeDuel.findMany({
      where: { OR: [{ challengerId: userId }, { challengedId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    // Enrich with usernames
    const userIds = [...new Set(duels.flatMap(d => [d.challengerId, d.challengedId]))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.username]));
    const enriched = duels.map(d => ({
      ...d,
      challengerName: userMap[d.challengerId] || "Unknown",
      challengedName: userMap[d.challengedId] || "Unknown",
    }));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gamification/duels — create a duel challenge
router.post("/duels", requireAuth, async (req, res) => {
  try {
    const challengerId = req.user.sub;
    const { challengedId, subjectId } = req.body;
    if (!challengedId) return res.status(400).json({ error: "challengedId required" });
    if (challengerId === challengedId) return res.status(400).json({ error: "Cannot duel yourself" });

    // Pick 10 random questions
    const where = subjectId ? { subjectId } : {};
    const count = await prisma.question.count({ where });
    if (count < 10) return res.status(400).json({ error: "Not enough questions (need 10)" });

    const skip = Math.max(0, Math.floor(Math.random() * (count - 10)));
    const questions = await prisma.question.findMany({ where, skip, take: 10, select: { id: true } });
    const questionIds = questions.map(q => q.id);

    const duel = await prisma.challengeDuel.create({
      data: { challengerId, challengedId, questionIds, xpStake: 20 },
    });
    res.json(duel);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gamification/duels/:id/accept
router.post("/duels/:id/accept", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;
    const duel = await prisma.challengeDuel.findUnique({ where: { id } });
    if (!duel) return res.status(404).json({ error: "Duel not found" });
    if (duel.challengedId !== userId) return res.status(403).json({ error: "Not your duel" });
    if (duel.status !== "pending") return res.status(400).json({ error: "Duel already " + duel.status });

    const updated = await prisma.challengeDuel.update({ where: { id }, data: { status: "active" } });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gamification/duels/:id/decline
router.post("/duels/:id/decline", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const duel = await prisma.challengeDuel.findUnique({ where: { id } });
    if (!duel) return res.status(404).json({ error: "Duel not found" });
    if (duel.challengedId !== req.user.sub) return res.status(403).json({ error: "Not your duel" });
    const updated = await prisma.challengeDuel.update({ where: { id }, data: { status: "declined" } });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gamification/duels/:id/answer — submit an answer for a duel question
router.post("/duels/:id/answer", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;
    const { questionId, selected } = req.body;

    const duel = await prisma.challengeDuel.findUnique({ where: { id } });
    if (!duel) return res.status(404).json({ error: "Duel not found" });
    if (duel.status !== "active") return res.status(400).json({ error: "Duel not active" });
    if (duel.challengerId !== userId && duel.challengedId !== userId) {
      return res.status(403).json({ error: "Not a participant" });
    }

    // Check correctness
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: "Question not found" });
    const correct = question.answerIndex === selected;

    const answer = await prisma.duelAnswer.upsert({
      where: { duelId_userId_questionId: { duelId: id, userId, questionId } },
      update: { selected, correct },
      create: { duelId: id, userId, questionId, selected, correct },
    });

    // Check if duel is complete (both users answered all 10)
    const answers = await prisma.duelAnswer.findMany({ where: { duelId: id } });
    const challengerAnswers = answers.filter(a => a.userId === duel.challengerId);
    const challengedAnswers = answers.filter(a => a.userId === duel.challengedId);

    let duelResult = null;
    if (challengerAnswers.length === 10 && challengedAnswers.length === 10) {
      const challengerScore = challengerAnswers.filter(a => a.correct).length;
      const challengedScore = challengedAnswers.filter(a => a.correct).length;
      const winnerId = challengerScore > challengedScore ? duel.challengerId
        : challengedScore > challengerScore ? duel.challengedId
        : null; // tie

      duelResult = await prisma.challengeDuel.update({
        where: { id },
        data: {
          status: "completed",
          challengerScore,
          challengedScore,
          winnerId,
          completedAt: new Date(),
        },
      });

      // Award XP to winner
      if (winnerId) {
        await addLeagueXP(winnerId, duel.xpStake * 2);
        await checkDuelBadges(winnerId);
        // Check for perfect score badge
        const winnerScore = winnerId === duel.challengerId ? challengerScore : challengedScore;
        if (winnerScore === 10) await awardBadge(winnerId, "duel_perfect");
      }
    }

    res.json({ answer, correct, duelResult });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /gamification/duels/:id — full duel details with questions
router.get("/duels/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;
    const duel = await prisma.challengeDuel.findUnique({
      where: { id },
      include: { answers: true },
    });
    if (!duel) return res.status(404).json({ error: "Duel not found" });
    if (duel.challengerId !== userId && duel.challengedId !== userId) {
      return res.status(403).json({ error: "Not a participant" });
    }

    // Get questions
    const questions = await prisma.question.findMany({
      where: { id: { in: duel.questionIds } },
      select: { id: true, question: true, optionA: true, optionB: true, optionC: true, optionD: true, answerIndex: duel.status === "completed" ? true : false },
    });

    // Get usernames
    const users = await prisma.user.findMany({
      where: { id: { in: [duel.challengerId, duel.challengedId] } },
      select: { id: true, username: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.username]));

    res.json({
      ...duel,
      challengerName: userMap[duel.challengerId],
      challengedName: userMap[duel.challengedId],
      questions,
      myAnswers: duel.answers.filter(a => a.userId === userId),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
