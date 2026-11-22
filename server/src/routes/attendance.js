import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { codeFor, windowIndex, secondsLeft, isValidCode, haversineM, newSecret } from "../lib/attendanceCode.js";

const router = express.Router();

const ELIGIBLE_PCT = 75;

const markLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: "Too many attempts — wait a moment and try again" },
});

const uid = (req) => req.user.sub || req.user.id;
const staff = [requireAuth, requireRole("TEACHER", "LECTURER")];

async function ownedClassroom(classroomId, userId) {
  const c = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { id: true, createdById: true } });
  if (!c) return { code: 404, error: "Classroom not found" };
  if (c.createdById !== userId) return { code: 403, error: "Only the classroom owner can do this" };
  return { classroom: c };
}

async function memberOf(classroomId, userId) {
  const m = await prisma.classroomMember.findUnique({ where: { classroomId_userId: { classroomId, userId } } }).catch(() => null);
  return !!m;
}

async function ownedSession(sessionId, userId) {
  const s = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!s) return { code: 404, error: "Session not found" };
  if (s.createdById !== userId) return { code: 403, error: "Only the host can do this" };
  return { session: s };
}

// Lazily close sessions whose window has elapsed.
async function expireIfDue(s) {
  if (s.status === "open" && s.closesAt <= new Date()) {
    return prisma.attendanceSession.update({ where: { id: s.id }, data: { status: "closed", closedAt: s.closesAt } });
  }
  return s;
}

const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

// ============ LECTURER ============

// Open an attendance session (closes any session still open in this classroom)
router.post("/classrooms/:classroomId/sessions", ...staff, async (req, res) => {
  try {
    const own = await ownedClassroom(req.params.classroomId, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });

    const { title, durationMins, geo } = req.body || {};
    const mins = Math.min(180, Math.max(1, parseInt(durationMins) || 15));
    const now = new Date();

    const data = {
      classroomId: req.params.classroomId,
      createdById: uid(req),
      title: String(title || "").trim().slice(0, 120) || `Lecture — ${now.toLocaleDateString("en-GB")}`,
      secret: newSecret(),
      closesAt: new Date(now.getTime() + mins * 60 * 1000),
    };

    const lat = num(geo?.lat), lng = num(geo?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      data.geoLat = lat;
      data.geoLng = lng;
      data.geoRadiusM = Math.min(2000, Math.max(20, parseInt(geo?.radiusM) || 150));
      data.geoMode = geo?.mode === "require" ? "require" : geo?.mode === "off" ? "off" : "flag";
    } else {
      data.geoMode = "off";
    }

    const [, session] = await prisma.$transaction([
      prisma.attendanceSession.updateMany({
        where: { classroomId: req.params.classroomId, status: "open" },
        data: { status: "closed", closedAt: now },
      }),
      prisma.attendanceSession.create({ data }),
    ]);

    res.json({ id: session.id, title: session.title, closesAt: session.closesAt, geoMode: session.geoMode });
  } catch (err) {
    console.error("Open attendance error:", err);
    res.status(500).json({ error: "Failed to start attendance" });
  }
});

// Current rotating code + who is marked so far (host screen polls this)
router.get("/sessions/:id/live", ...staff, async (req, res) => {
  try {
    const own = await ownedSession(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const session = await expireIfDue(own.session);

    const marks = await prisma.attendanceMark.findMany({
      where: { sessionId: session.id },
      orderBy: { markedAt: "desc" },
      include: { user: { select: { id: true, username: true } } },
    });
    const total = await prisma.classroomMember.count({ where: { classroomId: session.classroomId } });

    res.json({
      id: session.id,
      title: session.title,
      status: session.status,
      closesAt: session.closesAt,
      code: session.status === "open" ? codeFor(session.secret, windowIndex()) : null,
      secondsLeft: secondsLeft(),
      total,
      markedCount: marks.length,
      marks: marks.map((m) => ({ userId: m.user.id, username: m.user.username, markedAt: m.markedAt, method: m.method, verified: m.verified })),
    });
  } catch (err) {
    console.error("Live attendance error:", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

router.post("/sessions/:id/close", ...staff, async (req, res) => {
  try {
    const own = await ownedSession(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    await prisma.attendanceSession.update({ where: { id: own.session.id }, data: { status: "closed", closedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Close attendance error:", err);
    res.status(500).json({ error: "Failed to close attendance" });
  }
});

// Manual add/remove (late arrival, dead phone, suspected proxy)
router.put("/sessions/:id/marks/:userId", ...staff, async (req, res) => {
  try {
    const own = await ownedSession(req.params.id, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const { present } = req.body || {};
    const where = { sessionId_userId: { sessionId: own.session.id, userId: req.params.userId } };

    if (present === false) {
      await prisma.attendanceMark.delete({ where }).catch(() => {});
      return res.json({ ok: true, present: false });
    }
    if (!(await memberOf(own.session.classroomId, req.params.userId))) {
      return res.status(400).json({ error: "Not a member of this classroom" });
    }
    await prisma.attendanceMark.upsert({
      where,
      update: { method: "manual", verified: true },
      create: { sessionId: own.session.id, userId: req.params.userId, method: "manual", verified: true },
    });
    res.json({ ok: true, present: true });
  } catch (err) {
    console.error("Manual mark error:", err);
    res.status(500).json({ error: "Failed to update attendance" });
  }
});

// Per-classroom report: one row per member, one column per session
router.get("/classrooms/:classroomId/report", ...staff, async (req, res) => {
  try {
    const own = await ownedClassroom(req.params.classroomId, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });

    const [members, sessions] = await Promise.all([
      prisma.classroomMember.findMany({
        where: { classroomId: req.params.classroomId },
        include: { user: { select: { id: true, username: true, email: true, userProfile: { select: { fullName: true, matricNumber: true } } } } },
      }),
      prisma.attendanceSession.findMany({
        where: { classroomId: req.params.classroomId },
        orderBy: { createdAt: "asc" },
        include: { marks: true },
      }),
    ]);

    const rows = members.map(({ user }) => {
      const cells = sessions.map((s) => {
        const m = s.marks.find((x) => x.userId === user.id);
        return m ? { present: true, verified: m.verified, method: m.method } : { present: false };
      });
      const attended = cells.filter((c) => c.present).length;
      const rate = sessions.length ? Math.round((attended / sessions.length) * 100) : 0;
      return {
        student: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.userProfile?.fullName || null,
          matricNumber: user.userProfile?.matricNumber || null,
        },
        cells,
        attended,
        rate,
        eligible: sessions.length > 0 && rate >= ELIGIBLE_PCT,
      };
    }).sort((a, b) => (a.student.matricNumber || a.student.username || "").localeCompare(b.student.matricNumber || b.student.username || ""));

    res.json({
      threshold: ELIGIBLE_PCT,
      totalSessions: sessions.length,
      sessions: sessions.map((s) => ({ id: s.id, title: s.title, createdAt: s.createdAt, status: s.status, count: s.marks.length })),
      rows,
    });
  } catch (err) {
    console.error("Attendance report error:", err);
    res.status(500).json({ error: "Failed to load report" });
  }
});

// Host: the session still open in a classroom (so the panel can resume after a refresh)
router.get("/classrooms/:classroomId/host-active", ...staff, async (req, res) => {
  try {
    const own = await ownedClassroom(req.params.classroomId, uid(req));
    if (own.error) return res.status(own.code).json({ error: own.error });
    const open = await prisma.attendanceSession.findFirst({
      where: { classroomId: req.params.classroomId, status: "open", closesAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    });
    res.json({ session: open });
  } catch (err) {
    console.error("Host active error:", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

// ============ STUDENT ============

// Sessions open right now across every classroom the student belongs to
// (optionally narrowed with ?classroomId=). Never exposes secret or venue coords.
router.get("/active", requireAuth, async (req, res) => {
  try {
    const where = {
      status: "open",
      closesAt: { gt: new Date() },
      classroom: { members: { some: { userId: uid(req) } } },
    };
    if (req.query.classroomId) where.classroomId = String(req.query.classroomId);
    const rows = await prisma.attendanceSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        classroom: { select: { name: true } },
        marks: { where: { userId: uid(req) }, select: { id: true, verified: true } },
      },
    });
    res.json({
      sessions: rows.map((s) => ({
        id: s.id,
        title: s.title,
        classroomId: s.classroomId,
        classroomName: s.classroom?.name || "Class",
        closesAt: s.closesAt,
        needsLocation: s.geoMode !== "off" && s.geoLat != null,
        locationRequired: s.geoMode === "require" && s.geoLat != null,
        marked: s.marks.length > 0,
      })),
    });
  } catch (err) {
    console.error("Active attendance error:", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

router.post("/sessions/:id/mark", requireAuth, markLimiter, async (req, res) => {
  try {
    const userId = uid(req);
    const s0 = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
    if (!s0) return res.status(404).json({ error: "Attendance session not found" });
    if (!(await memberOf(s0.classroomId, userId))) return res.status(403).json({ error: "You're not in this class" });

    const s = await expireIfDue(s0);
    if (s.status !== "open") return res.status(400).json({ error: "Attendance is closed" });

    const existing = await prisma.attendanceMark.findUnique({ where: { sessionId_userId: { sessionId: s.id, userId } } });
    if (existing) return res.json({ ok: true, alreadyMarked: true, verified: existing.verified });

    if (!isValidCode(s.secret, req.body?.code)) return res.status(400).json({ error: "Wrong or expired code — check the screen and try again" });

    let verified = true;
    let distanceM = null;
    if (s.geoMode !== "off" && s.geoLat != null && s.geoLng != null) {
      const lat = num(req.body?.lat), lng = num(req.body?.lng);
      const have = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      if (have) {
        const slack = Math.min(100, Math.max(0, num(req.body?.accuracy) || 0));
        distanceM = haversineM({ lat: s.geoLat, lng: s.geoLng }, { lat, lng });
        verified = distanceM <= (s.geoRadiusM || 150) + slack;
      } else {
        verified = false;
      }
      if (!verified && s.geoMode === "require") {
        return res.status(400).json({ error: have ? "You don't appear to be in the lecture venue" : "Location is required for this session — allow location and retry" });
      }
    }

    await prisma.attendanceMark.create({ data: { sessionId: s.id, userId, method: "code", verified, distanceM } });
    res.json({ ok: true, verified });
  } catch (err) {
    if (err.code === "P2002") return res.json({ ok: true, alreadyMarked: true });
    console.error("Mark attendance error:", err);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

// My attendance per classroom (optionally ?classroomId=)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const where = { classroom: { members: { some: { userId: uid(req) } } } };
    if (req.query.classroomId) where.classroomId = String(req.query.classroomId);
    const sessions = await prisma.attendanceSession.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        classroom: { select: { name: true } },
        marks: { where: { userId: uid(req) }, select: { id: true } },
      },
    });
    const byClass = new Map();
    for (const s of sessions) {
      if (!byClass.has(s.classroomId)) byClass.set(s.classroomId, { classroomId: s.classroomId, classroomName: s.classroom?.name || "Class", records: [] });
      byClass.get(s.classroomId).records.push({ id: s.id, title: s.title, createdAt: s.createdAt, present: s.marks.length > 0 });
    }
    const classrooms = [...byClass.values()].map((c) => {
      const attended = c.records.filter((r) => r.present).length;
      return { ...c, attended, totalSessions: c.records.length, rate: Math.round((attended / c.records.length) * 100) };
    });
    res.json({ threshold: ELIGIBLE_PCT, classrooms });
  } catch (err) {
    console.error("My attendance error:", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

export default router;
