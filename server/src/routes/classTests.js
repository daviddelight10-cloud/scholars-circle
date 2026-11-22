import express from "express";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

const uid = (req) => req.user.sub || req.user.id;
const staff = [requireAuth, requireRole("TEACHER", "LECTURER", "ADMIN")];
const GRACE_MS = 120 * 1000; // submit grace after the deadline
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const genToken = () => crypto.randomBytes(8).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
const genCode = () => Array.from(crypto.randomBytes(6)).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: "Too many attempts — wait a moment and try again" },
});

const shareStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — wait a moment and try again" },
});

async function ownedClassroom(classroomId, userId) {
  const c = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { id: true, name: true, createdById: true } });
  if (!c) return { code: 404, error: "Classroom not found" };
  if (c.createdById !== userId) return { code: 403, error: "Only the classroom owner can do this" };
  return { classroom: c };
}

async function memberOf(classroomId, userId) {
  const m = await prisma.classroomMember.findUnique({ where: { classroomId_userId: { classroomId, userId } } }).catch(() => null);
  return !!m;
}

async function ownedTest(testId, userId) {
  const t = await prisma.classTest.findUnique({ where: { id: testId }, include: { classroom: { select: { createdById: true, name: true } } } });
  if (!t) return { code: 404, error: "Test not found" };
  if (t.classroom.createdById !== userId) return { code: 403, error: "Only the classroom owner can do this" };
  return { test: t };
}

const shuffled = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const normText = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const fillblankMatches = (given, accepted) => {
  const g = normText(given);
  if (!g) return false;
  return String(accepted || "").split("|").map(normText).filter(Boolean).includes(g);
};

// What a student is allowed to see while sitting the test — no answers.
function servedPaper(test, questions, attempt) {
  const order = Array.isArray(attempt.order) && attempt.order.length ? attempt.order : questions.map((q) => q.id);
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const optMap = attempt.optMap || {};
  return order.map((qid) => {
    const q = byId[qid];
    if (!q) return null;
    if (q.questionType === "fillblank") {
      return { id: q.id, question: q.question, marks: q.marks, topic: q.topic, questionType: "fillblank", options: [] };
    }
    const orig = q.questionType === "truefalse" ? ["True", "False"] : [q.optionA, q.optionB, q.optionC, q.optionD];
    const map = optMap[qid] || orig.map((_, i) => i);
    return {
      id: q.id,
      question: q.question,
      marks: q.marks,
      topic: q.topic,
      questionType: q.questionType || "mcq",
      options: map.map((i) => orig[i]),
    };
  }).filter(Boolean);
}

function deadlineFor(test, attempt) {
  const byDuration = attempt.startedAt.getTime() + test.durationMin * 60 * 1000;
  return new Date(Math.min(byDuration, test.closesAt.getTime()));
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return "Add at least one question";
  if (questions.length > 200) return "Maximum 200 questions per test";
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q.question !== "string" || !q.question.trim()) return `Question ${i + 1} is empty`;
    const type = ["mcq", "truefalse", "fillblank"].includes(q.questionType) ? q.questionType : "mcq";
    if (type === "fillblank") {
      if (!String(q.answerText || "").trim()) return `Question ${i + 1} (fill-in) needs an accepted answer`;
    } else {
      const opts = type === "truefalse" ? ["True", "False"] : [q.optionA, q.optionB, q.optionC, q.optionD];
      if (opts.filter((o) => typeof o === "string" && o.trim()).length < 2) return `Question ${i + 1} needs at least 2 options`;
      const ai = Number(q.answerIndex);
      const maxAi = type === "truefalse" ? 1 : 3;
      if (!Number.isInteger(ai) || ai < 0 || ai > maxAi || !String(opts[ai] || "").trim()) return `Question ${i + 1} has an invalid answer`;
    }
    const marks = q.marks === undefined ? 1 : Number(q.marks);
    if (!Number.isInteger(marks) || marks < 1 || marks > 20) return `Question ${i + 1} has invalid marks (1-20)`;
  }
  return null;
}

const testSummary = (t, myAttempt, isOwner = false) => ({
  id: t.id,
  title: t.title,
  instructions: t.instructions,
  durationMin: t.durationMin,
  opensAt: t.opensAt,
  closesAt: t.closesAt,
  published: t.published,
  showScore: t.showScore,
  showAnswers: t.showAnswers,
  shareEnabled: t.shareEnabled,
  ...(isOwner ? { shareCode: t.shareCode, shareToken: t.shareToken } : {}),
  questionCount: t._count?.questions ?? t.questions?.length ?? 0,
  attemptCount: t._count?.attempts ?? 0,
  myAttempt: myAttempt
    ? { status: myAttempt.status, score: t.showScore ? myAttempt.score : undefined, maxScore: t.showScore ? myAttempt.maxScore : undefined, percent: t.showScore ? myAttempt.percent : undefined }
    : null,
});

// Grade an attempt's answers against the snapshotted key. Shared by submit,
// force-submit and (re)grading paths. Returns the fields written to the row.
function gradeAttempt(attempt, questions, test) {
  const incoming = attempt.answers || {};
  const optMap = attempt.optMap || {};
  let score = 0, maxScore = 0;
  const detail = questions.map((q) => {
    maxScore += q.marks;
    const served = incoming[q.id];
    if (q.questionType === "fillblank") {
      const text = typeof served === "string" ? served : null;
      const correct = fillblankMatches(text, q.answerText);
      if (correct) score += q.marks;
      return { questionId: q.id, text, correct, marksAwarded: correct ? q.marks : 0, maxMarks: q.marks };
    }
    const servedIdx = served === null || served === undefined || typeof served === "string" ? null : Number(served);
    const selectedOrigIdx = servedIdx === null || !Number.isInteger(servedIdx) ? null : (optMap[q.id] ? optMap[q.id][servedIdx] : servedIdx);
    const correct = selectedOrigIdx !== null && selectedOrigIdx === q.answerIndex;
    if (correct) score += q.marks;
    return {
      questionId: q.id,
      selected: servedIdx,
      selectedOrigIdx,
      correct,
      marksAwarded: correct ? q.marks : 0,
      maxMarks: q.marks,
    };
  });
  const percent = maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0;
  return { detail, score, maxScore, percent };
}

function memberTargets(classroomId, excludeUserId) {
  return prisma.classroomMember.findMany({ where: { classroomId }, select: { userId: true } })
    .then((ms) => ms.map((m) => m.userId).filter((id) => id !== excludeUserId));
}

function pushMembers(classroomId, excludeUserId, payload) {
  (async () => {
    try {
      const { sendPushToUsers } = await import("../lib/pushSender.js");
      const ids = await memberTargets(classroomId, excludeUserId);
      if (ids.length) await sendPushToUsers(ids, payload, { category: "examAlerts" });
    } catch (err) {
      console.warn("Class test push failed:", err.message);
    }
  })();
}

// ============ LECTURER ============

// Create a test with snapshotted questions
router.post("/classrooms/:classroomId/tests", ...staff, async (req, res) => {
  try {
    const own = await ownedClassroom(req.params.classroomId, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });

    const { title, instructions, durationMin, opensAt, closesAt, shuffleQ, shuffleOpt, showScore, showAnswers, published, questions } = req.body || {};
    const qErr = validateQuestions(questions);
    if (qErr) return res.status(400).json({ error: qErr });

    const open = new Date(opensAt);
    const close = new Date(closesAt);
    if (isNaN(open) || isNaN(close)) return res.status(400).json({ error: "opensAt and closesAt are required" });
    if (close <= open) return res.status(400).json({ error: "Closing time must be after opening time" });
    const dur = Math.min(300, Math.max(1, parseInt(durationMin) || 30));

    const test = await prisma.classTest.create({
      data: {
        classroomId: req.params.classroomId,
        createdById: uid(req),
        title: String(title || "").trim().slice(0, 160) || "Class test",
        instructions: instructions ? String(instructions).slice(0, 2000) : null,
        durationMin: dur,
        opensAt: open,
        closesAt: close,
        shuffleQ: shuffleQ !== false,
        shuffleOpt: shuffleOpt !== false,
        showScore: showScore !== false,
        showAnswers: !!showAnswers,
        published: published !== false,
        questions: {
          create: questions.map((q, i) => {
            const type = ["mcq", "truefalse", "fillblank"].includes(q.questionType) ? q.questionType : "mcq";
            return {
              order: i,
              question: String(q.question).trim(),
              optionA: type === "truefalse" ? "True" : String(q.optionA ?? ""),
              optionB: type === "truefalse" ? "False" : String(q.optionB ?? ""),
              optionC: type === "truefalse" ? "" : String(q.optionC ?? ""),
              optionD: type === "truefalse" ? "" : String(q.optionD ?? ""),
              answerIndex: type === "fillblank" ? -1 : Number(q.answerIndex),
              explanation: q.explanation ? String(q.explanation).slice(0, 2000) : null,
              marks: Number.isInteger(Number(q.marks)) ? Math.min(20, Math.max(1, Number(q.marks))) : 1,
              topic: q.topic ? String(q.topic).slice(0, 120) : null,
              questionType: type,
              answerText: type === "fillblank" ? String(q.answerText).trim().slice(0, 500) : null,
            };
          }),
        },
      },
      include: { _count: { select: { questions: true } } },
    });

    res.status(201).json(testSummary(test, null, true));

    // Notify class members — same fire-and-forget pattern as announcements
    if (test.published) {
      pushMembers(test.classroomId, uid(req), {
        title: `✍️ ${own.classroom?.name || "Class"}: ${test.title}`,
        body: `New test — ${questions.length} questions, ${test.durationMin} min. Opens ${open.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`,
        tag: `classtest-${test.id}`,
        data: { tab: "classroom", classroomId: test.classroomId, testId: test.id },
      });
    }
  } catch (err) {
    console.error("Create class test error:", err);
    res.status(500).json({ error: "Failed to create test" });
  }
});

// List tests — students see published only; the owner sees everything + counts
router.get("/classrooms/:classroomId/tests", requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const c = await prisma.classroom.findUnique({ where: { id: req.params.classroomId }, select: { createdById: true } });
    if (!c) return res.status(404).json({ error: "Classroom not found" });
    const isOwner = c.createdById === userId;
    if (!isOwner && !(await memberOf(req.params.classroomId, userId))) {
      return res.status(403).json({ error: "You're not in this class" });
    }

    const tests = await prisma.classTest.findMany({
      where: { classroomId: req.params.classroomId, ...(isOwner ? {} : { published: true }) },
      orderBy: { opensAt: "desc" },
      include: {
        _count: { select: { questions: true, attempts: true } },
        attempts: { where: { userId }, select: { status: true, score: true, maxScore: true, percent: true } },
      },
    });
    res.json({ tests: tests.map((t) => testSummary(t, t.attempts[0], isOwner)), isOwner });
  } catch (err) {
    console.error("List class tests error:", err);
    res.status(500).json({ error: "Failed to load tests" });
  }
});

// Owner: full test incl. answers, for preview/edit
router.get("/tests/:id", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const questions = await prisma.classTestQuestion.findMany({ where: { testId: own.test.id }, orderBy: { order: "asc" } });
    res.json({ test: own.test, questions });
  } catch (err) {
    console.error("Get class test error:", err);
    res.status(500).json({ error: "Failed to load test" });
  }
});

// Owner: edit window/settings/publish (questions are immutable once created)
router.patch("/tests/:id", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const { title, instructions, durationMin, opensAt, closesAt, shuffleQ, shuffleOpt, showScore, showAnswers, published } = req.body || {};
    const data = {};
    if (title !== undefined) data.title = String(title).trim().slice(0, 160) || own.test.title;
    if (instructions !== undefined) data.instructions = instructions ? String(instructions).slice(0, 2000) : null;
    if (durationMin !== undefined) data.durationMin = Math.min(300, Math.max(1, parseInt(durationMin) || own.test.durationMin));
    if (opensAt !== undefined) { const d = new Date(opensAt); if (!isNaN(d)) data.opensAt = d; }
    if (closesAt !== undefined) { const d = new Date(closesAt); if (!isNaN(d)) data.closesAt = d; }
    if (shuffleQ !== undefined) data.shuffleQ = !!shuffleQ;
    if (shuffleOpt !== undefined) data.shuffleOpt = !!shuffleOpt;
    if (showScore !== undefined) data.showScore = !!showScore;
    if (showAnswers !== undefined) data.showAnswers = !!showAnswers;
    if (published !== undefined) data.published = !!published;
    const updated = await prisma.classTest.update({ where: { id: own.test.id }, data, include: { _count: { select: { questions: true, attempts: true } } } });
    res.json(testSummary(updated, null, true));

    // Flipping on score or answer release → "results released" push.
    const released = (data.showScore === true && !own.test.showScore) || (data.showAnswers === true && !own.test.showAnswers);
    if (released) {
      pushMembers(own.test.classroomId, uid(req), {
        title: `📊 Results released — ${updated.title}`,
        body: "Your score is in — open the class test to see how you did.",
        tag: `classtest-${updated.id}`,
        data: { tab: "classroom", classroomId: updated.classroomId, testId: updated.id },
      });
    }
  } catch (err) {
    console.error("Update class test error:", err);
    res.status(500).json({ error: "Failed to update test" });
  }
});

router.delete("/tests/:id", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    await prisma.classTest.delete({ where: { id: own.test.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete class test error:", err);
    res.status(500).json({ error: "Failed to delete test" });
  }
});

// Owner: toggle share link on/off — generates token + 6-char code once.
router.post("/tests/:id/share", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const enabled = req.body?.enabled !== false;
    const data = { shareEnabled: enabled };
    if (enabled && !own.test.shareToken) {
      data.shareToken = genToken();
      data.shareCode = genCode();
    }
    const updated = await prisma.classTest.update({ where: { id: own.test.id }, data });
    res.json({ shareEnabled: updated.shareEnabled, shareToken: updated.shareToken, shareCode: updated.shareCode });
  } catch (err) {
    console.error("Share class test error:", err);
    res.status(500).json({ error: "Failed to update sharing" });
  }
});

// Owner: clone the test (questions included) into another owned classroom.
router.post("/tests/:id/clone", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const targetId = String(req.body?.classroomId || "");
    if (!targetId) return res.status(400).json({ error: "classroomId is required" });
    const target = await ownedClassroom(targetId, uid(req));
    if (target.error) return res.status(target.code).json({ error: target.error });

    const questions = await prisma.classTestQuestion.findMany({ where: { testId: own.test.id }, orderBy: { order: "asc" } });
    const copy = await prisma.classTest.create({
      data: {
        classroomId: targetId,
        createdById: uid(req),
        title: own.test.title,
        instructions: own.test.instructions,
        durationMin: own.test.durationMin,
        opensAt: req.body?.opensAt ? new Date(req.body.opensAt) : own.test.opensAt,
        closesAt: req.body?.closesAt ? new Date(req.body.closesAt) : own.test.closesAt,
        shuffleQ: own.test.shuffleQ,
        shuffleOpt: own.test.shuffleOpt,
        showScore: own.test.showScore,
        showAnswers: own.test.showAnswers,
        published: req.body?.published !== false,
        questions: {
          create: questions.map((q) => ({
            order: q.order, question: q.question,
            optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
            answerIndex: q.answerIndex, explanation: q.explanation,
            marks: q.marks, topic: q.topic, questionType: q.questionType, answerText: q.answerText,
          })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });
    res.status(201).json(testSummary(copy, null, true));
  } catch (err) {
    console.error("Clone class test error:", err);
    res.status(500).json({ error: "Failed to clone test" });
  }
});

// Owner: reset one student's attempt → they can sit it again.
router.post("/tests/:id/attempts/:attemptId/reset", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const attempt = await prisma.classTestAttempt.findUnique({ where: { id: req.params.attemptId } });
    if (!attempt || attempt.testId !== own.test.id) return res.status(404).json({ error: "Attempt not found" });
    await prisma.classTestAttempt.delete({ where: { id: attempt.id } });
    res.json({ ok: true, reset: true });
  } catch (err) {
    console.error("Reset attempt error:", err);
    res.status(500).json({ error: "Failed to reset attempt" });
  }
});

// Owner: force-submit every in-progress attempt (invigilator ends the sitting).
router.post("/tests/:id/force-submit", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const open = await prisma.classTestAttempt.findMany({ where: { testId: own.test.id, status: "in_progress" } });
    if (!open.length) return res.json({ submitted: 0 });
    const questions = await prisma.classTestQuestion.findMany({ where: { testId: own.test.id } });
    const now = new Date();
    let done = 0;
    for (const a of open) {
      const { detail, score, maxScore, percent } = gradeAttempt(a, questions, own.test);
      const late = now.getTime() > deadlineFor(own.test, a).getTime() + GRACE_MS;
      await prisma.classTestAttempt.update({
        where: { id: a.id },
        data: { detail, score, maxScore, percent, late, forceClosed: true, status: "submitted", submittedAt: now },
      }).catch(() => {});
      done++;
    }
    res.json({ submitted: done });
  } catch (err) {
    console.error("Force-submit error:", err);
    res.status(500).json({ error: "Failed to force-submit" });
  }
});

// Owner: adjust a submitted score (appeals) — keeps the original in detail.
router.patch("/tests/:id/attempts/:attemptId/score", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const attempt = await prisma.classTestAttempt.findUnique({ where: { id: req.params.attemptId } });
    if (!attempt || attempt.testId !== own.test.id) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.status !== "submitted") return res.status(409).json({ error: "Only submitted attempts can be adjusted" });

    const { score, note } = req.body || {};
    if (score === null || score === undefined) {
      // clear the override
      await prisma.classTestAttempt.update({
        where: { id: attempt.id },
        data: { scoreOverride: null, overrideNote: null, percent: attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 1000) / 10 : attempt.percent },
      });
      return res.json({ ok: true, cleared: true });
    }
    const s = Number(score);
    if (!Number.isInteger(s) || s < 0 || s > attempt.maxScore) {
      return res.status(400).json({ error: `Score must be 0–${attempt.maxScore}` });
    }
    const updated = await prisma.classTestAttempt.update({
      where: { id: attempt.id },
      data: { scoreOverride: s, overrideNote: note ? String(note).slice(0, 300) : null, percent: attempt.maxScore ? Math.round((s / attempt.maxScore) * 1000) / 10 : 0 },
    });
    res.json({ ok: true, score: updated.scoreOverride ?? updated.score, percent: updated.percent });
  } catch (err) {
    console.error("Score override error:", err);
    res.status(500).json({ error: "Failed to adjust score" });
  }
});

// Student-side: count a focus-loss event (blur / tab hide) during the attempt.
router.post("/tests/:id/focus", requireAuth, async (req, res) => {
  try {
    const attempt = await prisma.classTestAttempt.findUnique({
      where: { testId_userId: { testId: req.params.id, userId: uid(req) } },
      select: { id: true, status: true },
    });
    if (!attempt || attempt.status !== "in_progress") return res.json({ ok: true });
    await prisma.classTestAttempt.update({ where: { id: attempt.id }, data: { focusLost: { increment: 1 } } });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // never interrupt an exam for telemetry
  }
});

// Owner: full results — every class member × their attempt, plus share-link guests.
router.get("/tests/:id/results", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });

    const [members, attempts, marksAgg] = await Promise.all([
      prisma.classroomMember.findMany({
        where: { classroomId: own.test.classroomId },
        include: { user: { select: { id: true, username: true, email: true, userProfile: { select: { fullName: true, matricNumber: true } } } } },
      }),
      prisma.classTestAttempt.findMany({ where: { testId: own.test.id } }),
      prisma.classTestQuestion.aggregate({ where: { testId: own.test.id }, _sum: { marks: true } }),
    ]);
    const totalMarks = marksAgg._sum.marks || 0;

    const byUser = Object.fromEntries(attempts.map((a) => [a.userId, a]));
    const memberIds = new Set(members.map((m) => m.user.id));
    const now = new Date();

    const statusOf = (a) => !a ? "absent" : (a.status === "in_progress" && deadlineFor(own.test, a) < now ? "no_submit" : a.status);
    const scoreFields = (a) => ({
      score: a?.status === "submitted" ? (a.scoreOverride ?? a.score) : null,
      maxScore: a?.status === "submitted" ? a.maxScore : null,
      percent: a?.status === "submitted" ? a.percent : null,
    });

    const rows = members.map(({ user }) => {
      const a = byUser[user.id];
      return {
        attemptId: a?.id || null,
        guest: false,
        student: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: a?.displayName || user.userProfile?.fullName || null,
          matricNumber: a?.matricNo || user.userProfile?.matricNumber || null,
        },
        status: statusOf(a),
        ...scoreFields(a),
        late: a?.late || false,
        forceClosed: a?.forceClosed || false,
        focusLost: a?.focusLost || 0,
        overridden: a?.scoreOverride != null,
        overrideNote: a?.overrideNote || null,
        startedAt: a?.startedAt || null,
        submittedAt: a?.submittedAt || null,
      };
    });

    // Share-link takers who aren't class members — flagged guests.
    const guests = attempts.filter((a) => a.viaShare && !memberIds.has(a.userId));
    if (guests.length) {
      const guestUsers = await prisma.user.findMany({
        where: { id: { in: guests.map((g) => g.userId) } },
        select: { id: true, username: true, email: true, userProfile: { select: { fullName: true, matricNumber: true } } },
      });
      const gById = Object.fromEntries(guestUsers.map((u) => [u.id, u]));
      for (const a of guests) {
        const user = gById[a.userId];
        rows.push({
          attemptId: a.id,
          guest: true,
          student: {
            id: a.userId,
            username: user?.username || null,
            email: user?.email || null,
            fullName: a.displayName || user?.userProfile?.fullName || null,
            matricNumber: a.matricNo || user?.userProfile?.matricNumber || null,
          },
          status: statusOf(a),
          ...scoreFields(a),
          late: a.late,
          forceClosed: a.forceClosed,
          focusLost: a.focusLost || 0,
          overridden: a.scoreOverride != null,
          overrideNote: a.overrideNote || null,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
        });
      }
    }

    rows.sort((a, b) => (a.student.matricNumber || a.student.fullName || a.student.username || "").localeCompare(b.student.matricNumber || b.student.fullName || b.student.username || ""));

    const sat = rows.filter((r) => r.status === "submitted");
    const avg = sat.length ? Math.round((sat.reduce((s, r) => s + (r.percent || 0), 0) / sat.length) * 10) / 10 : null;
    const isOpen = now >= own.test.opensAt && now <= own.test.closesAt;

    res.json({
      test: { id: own.test.id, title: own.test.title, durationMin: own.test.durationMin, opensAt: own.test.opensAt, closesAt: own.test.closesAt, maxScore: totalMarks, isOpen },
      stats: {
        members: members.length,
        sat: sat.length,
        inProgress: rows.filter((r) => r.status === "in_progress").length,
        absent: rows.filter((r) => r.status === "absent" || r.status === "no_submit").length,
        guests: guests.length,
        flagged: rows.filter((r) => r.late || (r.focusLost || 0) >= 3).length,
        avgPercent: avg,
      },
      rows,
    });
  } catch (err) {
    console.error("Class test results error:", err);
    res.status(500).json({ error: "Failed to load results" });
  }
});

// Owner: per-question breakdown — how many picked each option (item analysis)
router.get("/tests/:id/analysis", ...staff, async (req, res) => {
  try {
    const own = await ownedTest(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const [questions, attempts] = await Promise.all([
      prisma.classTestQuestion.findMany({ where: { testId: own.test.id }, orderBy: { order: "asc" } }),
      prisma.classTestAttempt.findMany({ where: { testId: own.test.id, status: "submitted" }, select: { detail: true } }),
    ]);
    const items = questions.map((q, i) => {
      const picks = [0, 0, 0, 0];
      let correct = 0, answered = 0;
      for (const a of attempts) {
        const d = (a.detail || []).find((x) => x.questionId === q.id);
        if (!d) continue;
        if (d.selected != null || d.text) { answered++; if (d.selectedOrigIdx != null) picks[d.selectedOrigIdx] = (picks[d.selectedOrigIdx] || 0) + 1; }
        if (d.correct) correct++;
      }
      return {
        index: i,
        question: q.question,
        topic: q.topic,
        questionType: q.questionType,
        answerIndex: q.answerIndex,
        answerText: q.questionType === "fillblank" ? q.answerText : undefined,
        marks: q.marks,
        picks,          // per ORIGINAL option index
        answered,
        correctCount: correct,
        correctPct: attempts.length ? Math.round((correct / attempts.length) * 100) : null,
      };
    });
    res.json({ submitted: attempts.length, items });
  } catch (err) {
    console.error("Class test analysis error:", err);
    res.status(500).json({ error: "Failed to load analysis" });
  }
});

// ============ SHARE LINK (public-ish) ============

// Share-code → token (so lecturers can write a 6-char code on the board)
router.get("/share/code/:code", optionalAuth, shareStartLimiter, async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ error: "Invalid code" });
  const t = await prisma.classTest.findFirst({ where: { shareCode: code, shareEnabled: true }, select: { shareToken: true } });
  if (!t) return res.status(404).json({ error: "No shared test with that code" });
  res.json({ token: t.shareToken });
});

// Share landing meta — guests see the paper details; taking needs auth.
router.get("/share/:token", optionalAuth, async (req, res) => {
  try {
    const t = await prisma.classTest.findFirst({
      where: { shareToken: req.params.token, shareEnabled: true },
      include: {
        classroom: { select: { name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    if (!t) return res.status(404).json({ error: "Shared test not found" });
    const now = new Date();
    const phase = now < t.opensAt ? "upcoming" : now > t.closesAt ? "closed" : "open";
    let mine = null;
    if (req.user?.sub) {
      const a = await prisma.classTestAttempt.findUnique({
        where: { testId_userId: { testId: t.id, userId: req.user.sub } },
        select: { status: true, score: true, maxScore: true, percent: true },
      });
      if (a) mine = { status: a.status, ...(t.showScore ? { score: a.score, maxScore: a.maxScore, percent: a.percent } : {}) };
    }
    res.json({
      testId: t.id,
      title: t.title,
      instructions: t.instructions,
      classroomName: t.classroom.name,
      durationMin: t.durationMin,
      opensAt: t.opensAt,
      closesAt: t.closesAt,
      questionCount: t._count.questions,
      taken: t._count.attempts,
      phase,
      showScore: t.showScore,
      authed: !!req.user?.sub,
      mine,
    });
  } catch (err) {
    console.error("Share meta error:", err);
    res.status(500).json({ error: "Failed to load shared test" });
  }
});

// ============ STUDENT ============

// Shared start logic for class members and share-link takers.
async function startAttempt({ test, userId, viaShare, displayName, matricNo }) {
  const now = new Date();
  if (now < test.opensAt) return { code: 409, error: "This test hasn't opened yet", opensAt: test.opensAt };

  const questions = await prisma.classTestQuestion.findMany({ where: { testId: test.id }, orderBy: { order: "asc" } });
  if (!questions.length) return { code: 409, error: "This test has no questions" };

  let attempt = await prisma.classTestAttempt.findUnique({ where: { testId_userId: { testId: test.id, userId } } });
  if (attempt?.status === "submitted") return { code: 409, error: "You've already submitted this test" };
  if (now > test.closesAt && !attempt) return { code: 409, error: "This test has closed" };

  if (!attempt) {
    const order = test.shuffleQ ? shuffled(questions.map((q) => q.id)) : questions.map((q) => q.id);
    const optMap = {};
    if (test.shuffleOpt) {
      for (const q of questions) {
        if (q.questionType !== "mcq") continue; // T/F keeps canonical order; fillblank has none
        optMap[q.id] = shuffled([0, 1, 2, 3]);
      }
    }
    attempt = await prisma.classTestAttempt.create({
      data: {
        testId: test.id,
        userId,
        order,
        optMap,
        viaShare: !!viaShare,
        displayName: displayName ? String(displayName).trim().slice(0, 120) : null,
        matricNo: matricNo ? String(matricNo).trim().slice(0, 40) : null,
      },
    });
  } else if (displayName || matricNo) {
    // Late name edits allowed while in-progress.
    attempt = await prisma.classTestAttempt.update({
      where: { id: attempt.id },
      data: {
        ...(displayName ? { displayName: String(displayName).trim().slice(0, 120) } : {}),
        ...(matricNo ? { matricNo: String(matricNo).trim().slice(0, 40) } : {}),
      },
    });
  }

  const deadline = deadlineFor(test, attempt);
  if (now > deadline) {
    return { code: 409, error: "Your time for this test has expired", expired: true };
  }

  return {
    attemptId: attempt.id,
    test: { id: test.id, title: test.title, instructions: test.instructions, durationMin: test.durationMin, showScore: test.showScore },
    questions: servedPaper(test, questions, attempt),
    answers: attempt.answers || {},
    serverNow: now,
    deadline,
  };
}

// Start (or resume) an attempt as a class member.
router.post("/tests/:id/start", requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const test = await prisma.classTest.findUnique({ where: { id: req.params.id } });
    if (!test || !test.published) return res.status(404).json({ error: "Test not found" });
    if (!(await memberOf(test.classroomId, userId))) return res.status(403).json({ error: "You're not in this class" });

    const { displayName, matricNo } = req.body || {};
    const out = await startAttempt({ test, userId, viaShare: false, displayName, matricNo });
    if (out.error) return res.status(out.code).json(out);
    res.json(out);
  } catch (err) {
    console.error("Start class test error:", err);
    res.status(500).json({ error: "Failed to start test" });
  }
});

// Start (or resume) an attempt via a share link — any signed-in user.
router.post("/share/:token/start", requireAuth, shareStartLimiter, async (req, res) => {
  try {
    const userId = uid(req);
    const test = await prisma.classTest.findFirst({ where: { shareToken: req.params.token, shareEnabled: true, published: true } });
    if (!test) return res.status(404).json({ error: "Shared test not found" });
    const member = await memberOf(test.classroomId, userId);

    const { displayName, matricNo } = req.body || {};
    const out = await startAttempt({ test, userId, viaShare: !member, displayName, matricNo });
    if (out.error) return res.status(out.code).json(out);
    res.json(out);
  } catch (err) {
    console.error("Share-start error:", err);
    res.status(500).json({ error: "Failed to start test" });
  }
});

// Submit answers — graded server-side against the snapshotted key.
router.post("/tests/:id/submit", requireAuth, submitLimiter, async (req, res) => {
  try {
    const userId = uid(req);
    const test = await prisma.classTest.findUnique({ where: { id: req.params.id } });
    if (!test) return res.status(404).json({ error: "Test not found" });

    const attempt = await prisma.classTestAttempt.findUnique({ where: { testId_userId: { testId: test.id, userId } } });
    if (!attempt) return res.status(409).json({ error: "No attempt in progress — start the test first" });
    if (attempt.status === "submitted") return res.status(409).json({ error: "Already submitted" });
    // Membership check only for non-share attempts — guests legitimately submit.
    if (!attempt.viaShare && !(await memberOf(test.classroomId, userId))) {
      return res.status(403).json({ error: "You're not in this class" });
    }

    const incoming = (req.body && typeof req.body.answers === "object" && req.body.answers) || {};
    attempt.answers = { ...(attempt.answers || {}), ...incoming };

    const questions = await prisma.classTestQuestion.findMany({ where: { testId: test.id } });
    const { detail, score, maxScore, percent } = gradeAttempt(attempt, questions, test);

    const now = new Date();
    const late = now.getTime() > deadlineFor(test, attempt).getTime() + GRACE_MS;

    const updated = await prisma.classTestAttempt.update({
      where: { id: attempt.id },
      data: { answers: attempt.answers, detail, score, maxScore, percent, late, status: "submitted", submittedAt: now },
    });

    res.json({
      submitted: true,
      late,
      submittedAt: updated.submittedAt,
      ...(test.showScore ? { score, maxScore, percent } : {}),
    });
  } catch (err) {
    console.error("Submit class test error:", err);
    res.status(500).json({ error: "Failed to submit test" });
  }
});

// Student: own attempt state + post-close review when the lecturer releases it.
router.get("/tests/:id/my", requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const test = await prisma.classTest.findUnique({ where: { id: req.params.id } });
    if (!test) return res.status(404).json({ error: "Test not found" });
    const attempt = await prisma.classTestAttempt.findUnique({ where: { testId_userId: { testId: test.id, userId } } });

    const closed = new Date() > test.closesAt;
    const canReview = test.showAnswers && closed && attempt?.status === "submitted";
    let review = null;
    if (canReview) {
      const questions = await prisma.classTestQuestion.findMany({ where: { testId: test.id }, orderBy: { order: "asc" } });
      const optMap = attempt.optMap || {};
      const byId = Object.fromEntries((attempt.detail || []).map((d) => [d.questionId, d]));
      review = (attempt.order || questions.map((q) => q.id)).map((qid) => {
        const q = questions.find((x) => x.id === qid);
        const d = byId[qid];
        if (!q) return null;
        const origOpts = q.questionType === "truefalse" ? ["True", "False"] : [q.optionA, q.optionB, q.optionC, q.optionD];
        const map = optMap[qid] || origOpts.map((_, i) => i);
        return {
          question: q.question,
          questionType: q.questionType,
          marks: q.marks,
          topic: q.topic,
          explanation: q.explanation,
          options: map.map((i) => origOpts[i]),
          correctIndex: q.answerIndex >= 0 ? map.indexOf(q.answerIndex) : null,
          acceptedAnswer: q.questionType === "fillblank" ? q.answerText : undefined,
          picked: d?.selected ?? null,
          pickedText: d?.text ?? null,
          correct: !!d?.correct,
          marksAwarded: d?.marksAwarded ?? 0,
        };
      }).filter(Boolean);
    }

    res.json({
      test: { id: test.id, title: test.title, showScore: test.showScore, showAnswers: test.showAnswers, opensAt: test.opensAt, closesAt: test.closesAt, closed },
      attempt: attempt
        ? {
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            late: attempt.late,
            forceClosed: attempt.forceClosed,
            ...(test.showScore || attempt.status !== "submitted" ? { score: attempt.scoreOverride ?? attempt.score, maxScore: attempt.maxScore, percent: attempt.percent } : {}),
          }
        : null,
      review,
    });
  } catch (err) {
    console.error("My class test error:", err);
    res.status(500).json({ error: "Failed to load result" });
  }
});

export default router;
