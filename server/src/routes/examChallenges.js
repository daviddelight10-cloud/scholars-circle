// Exam challenges — async group exams. A creator turns a saved exam resource
// into a shareable link (/exam/<token>) or a group Play-tab card; takers run
// the same ExamRunner and their attempts link back via QuizAttempt.challengeId.
import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { rankAttempts, questionStats } from "../lib/challengeRank.js";

const router = Router();

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const genToken = () => crypto.randomBytes(8).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
const genCode = () => Array.from(crypto.randomBytes(6)).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

const isClosed = (c) => !!c.deadline && new Date(c.deadline) < new Date();

/** Parse an exam resource's mcqData into a light meta shape. */
function examMeta(resource) {
  let payload = resource?.mcqData;
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { payload = null; } }
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const config = payload?.config || {};
  return {
    name: config.name || resource?.title || "Exam",
    questionCount: questions.length,
    totalMarks: questions.reduce((s, q) => s + (q.marks || 1), 0),
    timeLimitMin: config.timeLimitMin || 0,
    mode: config.mode === "practice" ? "practice" : "exam",
    passMarkPct: config.passMarkPct ?? 50,
  };
}

async function memberOf(classroomId, userId) {
  if (!classroomId || !userId) return false;
  return !!(await prisma.classroomMember.findFirst({ where: { classroomId, userId } }));
}

/** Shared leaderboard builder for an array of attempt rows. */
function leaderboardEntries(attempts, scoring, currentUserId) {
  const userIds = [...new Set(attempts.map((a) => a.userId))];
  const perUserCount = attempts.reduce((m, a) => m.set(a.userId, (m.get(a.userId) || 0) + 1), new Map());
  const ranked = rankAttempts(attempts, scoring);
  return ranked.map((a) => ({
    rank: a.rank,
    userId: a.userId,
    name: a.user?.fullName || a.user?.username || "Scholar",
    username: a.user?.username || null,
    avatar: a.user?.userProfile?.avatar || null,
    score: a.score,
    total: a.total,
    pct: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
    durationMs: a.durationMs ?? null,
    attempts: perUserCount.get(a.userId) || 1,
    you: a.userId === currentUserId,
    finishedAt: a.createdAt,
  })).filter((e) => userIds.includes(e.userId));
}

// ── Create ───────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { examResourceId, groupId = null, deadlineHours = null, deadlineAt = null, scoring = "first", reveal = "immediate" } = req.body || {};
    if (!examResourceId) return res.status(400).json({ error: "examResourceId is required" });
    if (!["first", "best"].includes(scoring)) return res.status(400).json({ error: "scoring must be first|best" });
    if (!["immediate", "onClose"].includes(reveal)) return res.status(400).json({ error: "reveal must be immediate|onClose" });

    const exam = await prisma.resource.findUnique({ where: { id: examResourceId }, select: { id: true, contentType: true, uploadedBy: true } });
    if (!exam || exam.contentType !== "exam") return res.status(404).json({ error: "Saved exam not found" });
    if (exam.uploadedBy !== req.user.sub) return res.status(403).json({ error: "Only the exam owner can create a challenge" });
    if (groupId && !(await memberOf(groupId, req.user.sub))) {
      return res.status(403).json({ error: "You're not a member of that group" });
    }
    // Deadline: absolute `deadlineAt` (custom picker) wins, else `deadlineHours`.
    // Must be in the future; capped at 90 days so a typo can't pin a challenge open forever.
    let deadline = null;
    const maxAt = new Date(Date.now() + 90 * 24 * 3600000);
    if (deadlineAt != null) {
      const d = new Date(deadlineAt);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid deadline date" });
      if (d <= new Date()) return res.status(400).json({ error: "Deadline must be in the future" });
      if (d > maxAt) return res.status(400).json({ error: "Deadline can be at most 90 days away" });
      deadline = d;
    } else {
      const hours = Number(deadlineHours);
      if (Number.isFinite(hours) && hours > 0) deadline = new Date(Date.now() + hours * 3600000);
    }

    const challenge = await prisma.examChallenge.create({
      data: {
        token: genToken(), code: genCode(),
        examResourceId, creatorId: req.user.sub, groupId,
        scoring, reveal, deadline,
      },
    });
    res.json({ challenge, shareUrl: `/exam/${challenge.token}`, code: challenge.code });
  } catch (err) {
    console.error("exam-challenge create error:", err);
    res.status(500).json({ error: "Couldn't create the challenge" });
  }
});

// ── My challenges (creator) ──────────────────────────────────────────────
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const list = await prisma.examChallenge.findMany({
      where: { creatorId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        examResource: { select: { title: true, mcqData: true } },
        _count: { select: { attempts: true, views: true } },
      },
    });
    res.json({
      challenges: list.map((c) => ({
        id: c.id, token: c.token, code: c.code, groupId: c.groupId,
        examResourceId: c.examResourceId,
        scoring: c.scoring, reveal: c.reveal, deadline: c.deadline,
        closed: isClosed(c), createdAt: c.createdAt,
        exam: examMeta(c.examResource),
        taken: c._count.attempts, viewed: c._count.views,
      })),
    });
  } catch (err) {
    console.error("exam-challenge mine error:", err);
    res.status(500).json({ error: "Couldn't load challenges" });
  }
});

// ── Group challenges (Play tab strip) ────────────────────────────────────
router.get("/group/:groupId", requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!(await memberOf(groupId, req.user.sub))) {
      return res.status(403).json({ error: "Not a group member" });
    }
    const list = await prisma.examChallenge.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        examResource: { select: { title: true, mcqData: true } },
        creator: { select: { fullName: true, username: true } },
        _count: { select: { attempts: true } },
        attempts: { where: { userId: req.user.sub }, orderBy: { createdAt: "asc" }, select: { score: true, total: true } },
      },
    });
    res.json({
      challenges: list.map((c) => ({
        id: c.id, token: c.token, scoring: c.scoring, reveal: c.reveal,
        deadline: c.deadline, closed: isClosed(c), createdAt: c.createdAt,
        creatorName: c.creator?.fullName || c.creator?.username || "A member",
        exam: examMeta(c.examResource),
        taken: c._count.attempts,
        myAttempt: c.attempts[0] || null,
      })),
    });
  } catch (err) {
    console.error("exam-challenge group list error:", err);
    res.status(500).json({ error: "Couldn't load group challenges" });
  }
});

// ── Join code → token ────────────────────────────────────────────────────
router.get("/code/:code", optionalAuth, async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ error: "Invalid code" });
  const c = await prisma.examChallenge.findUnique({ where: { code }, select: { token: true } });
  if (!c) return res.status(404).json({ error: "No challenge with that code" });
  res.json({ token: c.token });
});

// ── Leaderboard (+ creator question stats) ───────────────────────────────
router.get("/:token/leaderboard", requireAuth, async (req, res) => {
  try {
    const c = await prisma.examChallenge.findUnique({
      where: { token: req.params.token },
      include: { examResource: { select: { title: true, mcqData: true } } },
    });
    if (!c) return res.status(404).json({ error: "Challenge not found" });

    const attempts = await prisma.quizAttempt.findMany({
      where: { challengeId: c.id },
      orderBy: { createdAt: "asc" },
      select: {
        userId: true, score: true, total: true, durationMs: true, createdAt: true, details: true,
        user: { select: { fullName: true, username: true, userProfile: { select: { avatar: true } } } },
      },
    });
    const entries = leaderboardEntries(attempts, c.scoring, req.user.sub);
    const viewed = await prisma.examChallengeView.count({ where: { challengeId: c.id } });

    const body = {
      closed: isClosed(c),
      scoring: c.scoring,
      deadline: c.deadline,
      taken: attempts.length,
      viewed,
      entries,
      mine: entries.find((e) => e.you) || null,
    };
    if (c.creatorId === req.user.sub && attempts.length) {
      const pctList = attempts.map((a) => (a.total > 0 ? a.score / a.total : 0));
      body.creatorStats = {
        ...questionStats(attempts),
        avgPct: Math.round((pctList.reduce((s, p) => s + p, 0) / pctList.length) * 100),
      };
    }
    res.json(body);
  } catch (err) {
    console.error("exam-challenge leaderboard error:", err);
    res.status(500).json({ error: "Couldn't load the leaderboard" });
  }
});

// ── Take the exam (payload for the runner) ───────────────────────────────
router.post("/:token/take", requireAuth, async (req, res) => {
  try {
    const c = await prisma.examChallenge.findUnique({
      where: { token: req.params.token },
      include: { examResource: { select: { id: true, title: true, mcqData: true } } },
    });
    if (!c) return res.status(404).json({ error: "Challenge not found" });
    if (isClosed(c)) return res.status(410).json({ error: "This challenge has ended", closed: true });

    const prior = await prisma.quizAttempt.findFirst({
      where: { challengeId: c.id, userId: req.user.sub },
      orderBy: { createdAt: "asc" },
      select: { score: true, total: true },
    });
    if (prior && c.scoring === "first") {
      return res.status(409).json({ error: "You've already taken this challenge", alreadyTaken: true, attempt: prior });
    }
    res.json({
      challengeId: c.id,
      examResourceId: c.examResource.id,
      sourceTitle: c.examResource.title,
      payload: c.examResource.mcqData,
      reveal: c.reveal,
      revealAt: c.reveal === "onClose" ? c.deadline : null,
      scoring: c.scoring,
      deadline: c.deadline,
    });
  } catch (err) {
    console.error("exam-challenge take error:", err);
    res.status(500).json({ error: "Couldn't start the challenge" });
  }
});

// ── Challenge landing meta (public-ish) ──────────────────────────────────
router.get("/:token", optionalAuth, async (req, res) => {
  try {
    const c = await prisma.examChallenge.findUnique({
      where: { token: req.params.token },
      include: {
        examResource: { select: { title: true, mcqData: true } },
        creator: { select: { fullName: true, username: true, userProfile: { select: { avatar: true } } } },
        _count: { select: { attempts: true, views: true } },
      },
    });
    if (!c) return res.status(404).json({ error: "Challenge not found" });

    const userId = req.user?.sub || null;
    if (userId) {
      prisma.examChallengeView.upsert({
        where: { challengeId_userId: { challengeId: c.id, userId } },
        create: { challengeId: c.id, userId },
        update: { viewedAt: new Date() },
      }).catch(() => {});
    }

    // Top-3 preview (names only — full board needs auth)
    const topAttempts = await prisma.quizAttempt.findMany({
      where: { challengeId: c.id },
      orderBy: { score: "desc" },
      take: 20,
      select: { userId: true, score: true, total: true, createdAt: true, durationMs: true, user: { select: { fullName: true, username: true, userProfile: { select: { avatar: true } } } } },
    });
    const top = rankAttempts(topAttempts, c.scoring).slice(0, 3).map((a) => ({
      name: a.user?.fullName || a.user?.username || "Scholar",
      avatar: a.user?.userProfile?.avatar || null,
      pct: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
    }));

    let mine = null;
    if (userId) {
      const myAttempts = await prisma.quizAttempt.findMany({
        where: { challengeId: c.id, userId },
        orderBy: { createdAt: "asc" },
        select: { score: true, total: true, createdAt: true },
      });
      if (myAttempts.length) {
        const best = myAttempts.reduce((m, a) => Math.max(m, a.total > 0 ? a.score / a.total : 0), 0);
        mine = { attempts: myAttempts.length, bestPct: Math.round(best * 100), first: myAttempts[0] };
      }
    }

    res.json({
      token: c.token,
      code: c.code,
      exam: examMeta(c.examResource),
      creator: {
        name: c.creator?.fullName || c.creator?.username || "A scholar",
        avatar: c.creator?.userProfile?.avatar || null,
      },
      groupId: c.groupId,
      scoring: c.scoring,
      reveal: c.reveal,
      deadline: c.deadline,
      closed: isClosed(c),
      taken: c._count.attempts,
      viewed: c._count.views,
      topPct: top[0]?.pct ?? null,
      top3: top,
      isCreator: userId === c.creatorId,
      mine,
      authed: !!userId,
    });
  } catch (err) {
    console.error("exam-challenge meta error:", err);
    res.status(500).json({ error: "Couldn't load the challenge" });
  }
});

// ── Cancel (creator only) ────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const c = await prisma.examChallenge.findUnique({ where: { id: req.params.id }, select: { creatorId: true } });
    if (!c) return res.status(404).json({ error: "Challenge not found" });
    if (c.creatorId !== req.user.sub) return res.status(403).json({ error: "Only the creator can cancel" });
    await prisma.examChallenge.delete({ where: { id: req.params.id } }); // attempts' challengeId → SetNull
    res.json({ ok: true });
  } catch (err) {
    console.error("exam-challenge delete error:", err);
    res.status(500).json({ error: "Couldn't delete the challenge" });
  }
});

export default router;
