import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

const uid = (req) => req.user.sub || req.user.id;
const staff = [requireAuth, requireRole("TEACHER", "LECTURER")];
const GRACE_MS = 120 * 1000; // submit grace after the deadline

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: "Too many attempts — wait a moment and try again" },
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

// What a student is allowed to see while sitting the test — no answers.
function servedPaper(test, questions, attempt) {
  const order = Array.isArray(attempt.order) && attempt.order.length ? attempt.order : questions.map((q) => q.id);
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const optMap = attempt.optMap || {};
  return order.map((qid) => {
    const q = byId[qid];
    if (!q) return null;
    const orig = [q.optionA, q.optionB, q.optionC, q.optionD];
    const map = optMap[qid] || [0, 1, 2, 3];
    return {
      id: q.id,
      question: q.question,
      marks: q.marks,
      topic: q.topic,
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
    const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
    if (opts.filter((o) => typeof o === "string" && o.trim()).length < 2) return `Question ${i + 1} needs at least 2 options`;
    const ai = Number(q.answerIndex);
    if (!Number.isInteger(ai) || ai < 0 || ai > 3 || !String(opts[ai] || "").trim()) return `Question ${i + 1} has an invalid answer`;
    const marks = q.marks === undefined ? 1 : Number(q.marks);
    if (!Number.isInteger(marks) || marks < 1 || marks > 20) return `Question ${i + 1} has invalid marks (1-20)`;
  }
  return null;
}

const testSummary = (t, myAttempt) => ({
  id: t.id,
  title: t.title,
  instructions: t.instructions,
  durationMin: t.durationMin,
  opensAt: t.opensAt,
  closesAt: t.closesAt,
  published: t.published,
  showScore: t.showScore,
  questionCount: t._count?.questions ?? t.questions?.length ?? 0,
  attemptCount: t._count?.attempts ?? 0,
  myAttempt: myAttempt
    ? { status: myAttempt.status, score: t.showScore ? myAttempt.score : undefined, maxScore: t.showScore ? myAttempt.maxScore : undefined, percent: t.showScore ? myAttempt.percent : undefined }
    : null,
});

// ============ LECTURER ============

// Create a test with snapshotted questions
router.post("/classrooms/:classroomId/tests", ...staff, async (req, res) => {
  try {
    const own = await ownedClassroom(req.params.classroomId, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });

    const { title, instructions, durationMin, opensAt, closesAt, shuffleQ, shuffleOpt, showScore, published, questions } = req.body || {};
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
        published: published !== false,
        questions: {
          create: questions.map((q, i) => ({
            order: i,
            question: String(q.question).trim(),
            optionA: String(q.optionA ?? ""),
            optionB: String(q.optionB ?? ""),
            optionC: String(q.optionC ?? ""),
            optionD: String(q.optionD ?? ""),
            answerIndex: Number(q.answerIndex),
            explanation: q.explanation ? String(q.explanation).slice(0, 2000) : null,
            marks: Number.isInteger(Number(q.marks)) ? Math.min(20, Math.max(1, Number(q.marks))) : 1,
            topic: q.topic ? String(q.topic).slice(0, 120) : null,
          })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });

    res.status(201).json(testSummary(test));

    // Notify class members — same fire-and-forget pattern as announcements
    if (test.published) {
      (async () => {
        try {
          const { sendPushToUsers } = await import("../lib/pushSender.js");
          const members = await prisma.classroomMember.findMany({ where: { classroomId: test.classroomId }, select: { userId: true } });
          const ids = members.map((m) => m.userId).filter((u) => u !== uid(req));
          if (!ids.length) return;
          await sendPushToUsers(
            ids,
            {
              title: `✍️ ${own.classroom?.name || "Class"}: ${test.title}`,
              body: `New test — ${questions.length} questions, ${test.durationMin} min. Opens ${open.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`,
              tag: `classtest-${test.id}`,
              data: { tab: "classroom", classroomId: test.classroomId, testId: test.id },
            },
            { category: "examAlerts" }
          );
        } catch (err) {
          console.warn("Class test push failed:", err.message);
        }
      })();
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
    res.json({ tests: tests.map((t) => testSummary(t, t.attempts[0])), isOwner });
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
    const { title, instructions, durationMin, opensAt, closesAt, shuffleQ, shuffleOpt, showScore, published } = req.body || {};
    const data = {};
    if (title !== undefined) data.title = String(title).trim().slice(0, 160) || own.test.title;
    if (instructions !== undefined) data.instructions = instructions ? String(instructions).slice(0, 2000) : null;
    if (durationMin !== undefined) data.durationMin = Math.min(300, Math.max(1, parseInt(durationMin) || own.test.durationMin));
    if (opensAt !== undefined) { const d = new Date(opensAt); if (!isNaN(d)) data.opensAt = d; }
    if (closesAt !== undefined) { const d = new Date(closesAt); if (!isNaN(d)) data.closesAt = d; }
    if (shuffleQ !== undefined) data.shuffleQ = !!shuffleQ;
    if (shuffleOpt !== undefined) data.shuffleOpt = !!shuffleOpt;
    if (showScore !== undefined) data.showScore = !!showScore;
    if (published !== undefined) data.published = !!published;
    const updated = await prisma.classTest.update({ where: { id: own.test.id }, data, include: { _count: { select: { questions: true, attempts: true } } } });
    res.json(testSummary(updated));
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

// Owner: full results — every class member × their attempt
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
    const now = new Date();
    const rows = members.map(({ user }) => {
      const a = byUser[user.id];
      // An attempt still "in_progress" past its deadline = the student never submitted.
      const status = !a ? "absent" : (a.status === "in_progress" && deadlineFor(own.test, a) < now ? "no_submit" : a.status);
      return {
        student: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.userProfile?.fullName || null,
          matricNumber: user.userProfile?.matricNumber || null,
        },
        status,
        score: a?.status === "submitted" ? a.score : null,
        maxScore: a?.status === "submitted" ? a.maxScore : null,
        percent: a?.status === "submitted" ? a.percent : null,
        late: a?.late || false,
        startedAt: a?.startedAt || null,
        submittedAt: a?.submittedAt || null,
      };
    }).sort((a, b) => (a.student.matricNumber || a.student.fullName || a.student.username || "").localeCompare(b.student.matricNumber || b.student.fullName || b.student.username || ""));

    const sat = rows.filter((r) => r.status === "submitted");
    const avg = sat.length ? Math.round((sat.reduce((s, r) => s + (r.percent || 0), 0) / sat.length) * 10) / 10 : null;

    res.json({
      test: { id: own.test.id, title: own.test.title, durationMin: own.test.durationMin, opensAt: own.test.opensAt, closesAt: own.test.closesAt, maxScore: totalMarks },
      stats: { members: members.length, sat: sat.length, inProgress: rows.filter((r) => r.status === "in_progress").length, absent: rows.filter((r) => r.status === "absent" || r.status === "no_submit").length, avgPercent: avg },
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
        if (d.selected != null) { answered++; picks[d.selectedOrigIdx] = (picks[d.selectedOrigIdx] || 0) + 1; }
        if (d.correct) correct++;
      }
      return {
        index: i,
        question: q.question,
        topic: q.topic,
        answerIndex: q.answerIndex,
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

// ============ STUDENT ============

// Start (or resume) an attempt. Returns the shuffled, answer-free paper.
router.post("/tests/:id/start", requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const test = await prisma.classTest.findUnique({ where: { id: req.params.id } });
    if (!test || !test.published) return res.status(404).json({ error: "Test not found" });
    if (!(await memberOf(test.classroomId, userId))) return res.status(403).json({ error: "You're not in this class" });

    const now = new Date();
    if (now < test.opensAt) return res.status(409).json({ error: "This test hasn't opened yet", opensAt: test.opensAt });

    const questions = await prisma.classTestQuestion.findMany({ where: { testId: test.id }, orderBy: { order: "asc" } });
    if (!questions.length) return res.status(409).json({ error: "This test has no questions" });

    let attempt = await prisma.classTestAttempt.findUnique({ where: { testId_userId: { testId: test.id, userId } } });
    if (attempt?.status === "submitted") return res.status(409).json({ error: "You've already submitted this test" });
    if (now > test.closesAt && !attempt) return res.status(409).json({ error: "This test has closed" });

    if (!attempt) {
      const order = test.shuffleQ ? shuffled(questions.map((q) => q.id)) : questions.map((q) => q.id);
      const optMap = {};
      if (test.shuffleOpt) {
        for (const q of questions) optMap[q.id] = shuffled([0, 1, 2, 3]);
      }
      attempt = await prisma.classTestAttempt.create({
        data: { testId: test.id, userId, order, optMap },
      });
    }

    const deadline = deadlineFor(test, attempt);
    if (now > deadline) {
      // Window ran out mid-attempt with no submission — let the client submit
      // whatever it has; the submit route grades and flags it late.
      return res.status(409).json({ error: "Your time for this test has expired", expired: true });
    }

    res.json({
      attemptId: attempt.id,
      test: { id: test.id, title: test.title, instructions: test.instructions, durationMin: test.durationMin, showScore: test.showScore },
      questions: servedPaper(test, questions, attempt),
      answers: attempt.answers || {},
      serverNow: now,
      deadline,
    });
  } catch (err) {
    console.error("Start class test error:", err);
    res.status(500).json({ error: "Failed to start test" });
  }
});

// Submit answers — graded server-side against the snapshotted key.
router.post("/tests/:id/submit", requireAuth, submitLimiter, async (req, res) => {
  try {
    const userId = uid(req);
    const test = await prisma.classTest.findUnique({ where: { id: req.params.id } });
    if (!test) return res.status(404).json({ error: "Test not found" });
    if (!(await memberOf(test.classroomId, userId))) return res.status(403).json({ error: "You're not in this class" });

    const attempt = await prisma.classTestAttempt.findUnique({ where: { testId_userId: { testId: test.id, userId } } });
    if (!attempt) return res.status(409).json({ error: "No attempt in progress — start the test first" });
    if (attempt.status === "submitted") return res.status(409).json({ error: "Already submitted" });

    const incoming = (req.body && typeof req.body.answers === "object" && req.body.answers) || {};
    const answers = { ...(attempt.answers || {}), ...incoming };

    const questions = await prisma.classTestQuestion.findMany({ where: { testId: test.id } });
    const optMap = attempt.optMap || {};

    let score = 0, maxScore = 0;
    const detail = questions.map((q) => {
      maxScore += q.marks;
      const served = answers[q.id];
      const servedIdx = served === null || served === undefined ? null : Number(served);
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

    const now = new Date();
    const late = now.getTime() > deadlineFor(test, attempt).getTime() + GRACE_MS;
    const percent = maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0;

    const updated = await prisma.classTestAttempt.update({
      where: { id: attempt.id },
      data: { answers, detail, score, maxScore, percent, late, status: "submitted", submittedAt: now },
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

// Student: own attempt state (score only when the test allows it)
router.get("/tests/:id/my", requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const test = await prisma.classTest.findUnique({ where: { id: req.params.id } });
    if (!test) return res.status(404).json({ error: "Test not found" });
    const attempt = await prisma.classTestAttempt.findUnique({ where: { testId_userId: { testId: test.id, userId } } });
    res.json({
      test: { id: test.id, title: test.title, showScore: test.showScore, opensAt: test.opensAt, closesAt: test.closesAt },
      attempt: attempt
        ? {
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            late: attempt.late,
            ...(test.showScore || attempt.status !== "submitted" ? { score: attempt.score, maxScore: attempt.maxScore, percent: attempt.percent } : {}),
          }
        : null,
    });
  } catch (err) {
    console.error("My class test error:", err);
    res.status(500).json({ error: "Failed to load result" });
  }
});

export default router;
