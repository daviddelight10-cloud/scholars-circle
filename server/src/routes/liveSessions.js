import express from "express";
import crypto from "crypto";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

function userId(req) {
  return req.user.sub || req.user.id;
}

function generateRoomName() {
  return `sc-${crypto.randomBytes(6).toString("hex")}`;
}

// Helper: ensure the user is a member or host of the classroom
async function ensureClassroomAccess(classroomId, uid) {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { members: { where: { userId: uid } } }
  });
  if (!classroom) return { ok: false, code: 404, error: "Classroom not found" };
  const isHost = classroom.createdById === uid;
  const isMember = classroom.members.length > 0;
  if (!isHost && !isMember) return { ok: false, code: 403, error: "Not a member of this classroom" };
  return { ok: true, classroom, isHost };
}

// ============ SCHEDULE / LIST ============

// Schedule a new live session (faculty only, must own the classroom)
router.post(
  "/classrooms/:classroomId",
  requireAuth,
  requireRole("TEACHER", "LECTURER"),
  async (req, res) => {
    try {
      const { classroomId } = req.params;
      const { title, description, scheduledFor, durationMins } = req.body || {};
      if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
      if (!scheduledFor) return res.status(400).json({ error: "Scheduled time is required" });

      const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
      if (!classroom) return res.status(404).json({ error: "Classroom not found" });
      if (classroom.createdById !== userId(req)) {
        return res.status(403).json({ error: "Only the classroom owner can schedule sessions" });
      }

      const session = await prisma.liveSession.create({
        data: {
          classroomId,
          hostId: userId(req),
          title: title.trim(),
          description: description?.trim() || null,
          scheduledFor: new Date(scheduledFor),
          durationMins: parseInt(durationMins) || 60,
          roomName: generateRoomName()
        }
      });
      res.json(session);
    } catch (err) {
      console.error("Schedule session error:", err);
      res.status(500).json({ error: "Failed to schedule session" });
    }
  }
);

// List sessions for a classroom (members + host)
router.get("/classrooms/:classroomId", requireAuth, async (req, res) => {
  try {
    const access = await ensureClassroomAccess(req.params.classroomId, userId(req));
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const sessions = await prisma.liveSession.findMany({
      where: { classroomId: req.params.classroomId },
      orderBy: { scheduledFor: "desc" },
      include: { _count: { select: { attendances: true } } }
    });
    res.json(sessions);
  } catch (err) {
    console.error("List sessions error:", err);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// Currently-live sessions across all my classrooms (used by the global "live now" banner)
router.get("/live", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const memberships = await prisma.classroomMember.findMany({
      where: { userId: uid },
      select: { classroomId: true }
    });
    const ownClassrooms = await prisma.classroom.findMany({
      where: { createdById: uid },
      select: { id: true }
    });
    const classroomIds = [
      ...memberships.map((m) => m.classroomId),
      ...ownClassrooms.map((c) => c.id)
    ];
    if (classroomIds.length === 0) return res.json([]);

    const sessions = await prisma.liveSession.findMany({
      where: { status: "live", classroomId: { in: classroomIds } },
      include: { classroom: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" }
    });
    res.json(sessions);
  } catch (err) {
    console.error("Live sessions error:", err);
    res.status(500).json({ error: "Failed to fetch live sessions" });
  }
});

// Upcoming sessions across all my classrooms
router.get("/upcoming", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const memberships = await prisma.classroomMember.findMany({
      where: { userId: uid },
      select: { classroomId: true }
    });
    const ownClassrooms = await prisma.classroom.findMany({
      where: { createdById: uid },
      select: { id: true }
    });
    const classroomIds = [
      ...memberships.map((m) => m.classroomId),
      ...ownClassrooms.map((c) => c.id)
    ];
    if (classroomIds.length === 0) return res.json([]);

    const sessions = await prisma.liveSession.findMany({
      where: {
        classroomId: { in: classroomIds },
        status: "scheduled",
        scheduledFor: { gte: new Date(Date.now() - 60 * 60 * 1000) } // within 1h ago window
      },
      include: { classroom: { select: { id: true, name: true } } },
      orderBy: { scheduledFor: "asc" },
      take: 20
    });
    res.json(sessions);
  } catch (err) {
    console.error("Upcoming sessions error:", err);
    res.status(500).json({ error: "Failed to fetch upcoming sessions" });
  }
});

// ============ SESSION CONTROL ============

// Get one session (with member access check)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const session = await prisma.liveSession.findUnique({
      where: { id: req.params.id },
      include: {
        classroom: { select: { id: true, name: true, createdById: true } },
        attendances: {
          include: { /* user info expanded separately */ }
        }
      }
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    const access = await ensureClassroomAccess(session.classroomId, userId(req));
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    // Hydrate attendee usernames
    const attendeeIds = session.attendances.map((a) => a.userId);
    const users = attendeeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: attendeeIds } },
          select: { id: true, username: true, email: true }
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    session.attendances = session.attendances.map((a) => ({ ...a, user: userMap[a.userId] }));

    res.json(session);
  } catch (err) {
    console.error("Get session error:", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// Start a session — host only
router.post("/:id/start", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const session = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.hostId !== userId(req)) return res.status(403).json({ error: "Only the host can start" });
    if (session.status === "ended") return res.status(400).json({ error: "Session has already ended" });

    const updated = await prisma.liveSession.update({
      where: { id: session.id },
      data: { status: "live", startedAt: session.startedAt || new Date() }
    });
    res.json(updated);
  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ error: "Failed to start session" });
  }
});

// End a session — host only
router.post("/:id/end", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const session = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.hostId !== userId(req)) return res.status(403).json({ error: "Only the host can end" });

    const updated = await prisma.liveSession.update({
      where: { id: session.id },
      data: { status: "ended", endedAt: new Date() }
    });

    // Auto-close attendance for everyone still inside
    const now = new Date();
    const open = await prisma.sessionAttendance.findMany({
      where: { sessionId: session.id, leftAt: null }
    });
    await Promise.all(open.map((a) => prisma.sessionAttendance.update({
      where: { id: a.id },
      data: {
        leftAt: now,
        durationS: Math.floor((now - a.joinedAt) / 1000)
      }
    })));

    res.json(updated);
  } catch (err) {
    console.error("End session error:", err);
    res.status(500).json({ error: "Failed to end session" });
  }
});

// Cancel a scheduled (not yet started) session
router.delete("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const session = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.hostId !== userId(req)) return res.status(403).json({ error: "Only the host can cancel" });
    if (session.status === "live") return res.status(400).json({ error: "End the session before cancelling" });

    await prisma.liveSession.delete({ where: { id: session.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Cancel session error:", err);
    res.status(500).json({ error: "Failed to cancel session" });
  }
});

// ============ ATTENDANCE TRACKING ============

// Record join (idempotent — creates or refreshes joinedAt if user re-enters)
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const session = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "live") return res.status(400).json({ error: "Session is not live" });

    const access = await ensureClassroomAccess(session.classroomId, userId(req));
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const attendance = await prisma.sessionAttendance.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: userId(req) } },
      update: { leftAt: null }, // re-joined
      create: { sessionId: session.id, userId: userId(req) }
    });

    res.json({
      ok: true,
      attendance,
      roomName: session.roomName,
      sessionTitle: session.title
    });
  } catch (err) {
    console.error("Join session error:", err);
    res.status(500).json({ error: "Failed to record join" });
  }
});

// Record leave
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const uid = userId(req);
    const existing = await prisma.sessionAttendance.findUnique({
      where: { sessionId_userId: { sessionId, userId: uid } }
    });
    if (!existing) return res.json({ ok: true });

    const now = new Date();
    const additional = Math.floor((now - existing.joinedAt) / 1000);

    await prisma.sessionAttendance.update({
      where: { id: existing.id },
      data: {
        leftAt: now,
        durationS: existing.durationS + additional
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Leave session error:", err);
    res.status(500).json({ error: "Failed to record leave" });
  }
});

export default router;
