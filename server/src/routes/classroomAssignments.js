import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const uid = (req) => req.user.sub || req.user.id;

const uploadDir = path.join(process.cwd(), "uploads", "submissions");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

async function classroomAccess(classroomId, userId) {
  const c = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { members: { where: { userId } } }
  });
  if (!c) return { ok: false, code: 404, error: "Classroom not found" };
  const isHost = c.createdById === userId;
  const isMember = c.members.length > 0;
  if (!isHost && !isMember) return { ok: false, code: 403, error: "Not a classroom member" };
  return { ok: true, isHost, classroom: c };
}

// ============ ASSIGNMENTS ============

// Create assignment (faculty only, classroom owner)
router.post(
  "/classroom/:classroomId",
  requireAuth,
  requireRole("TEACHER", "LECTURER"),
  async (req, res) => {
    try {
      const { title, description, dueAt, points, type } = req.body || {};
      if (!title?.trim()) return res.status(400).json({ error: "Title required" });

      const c = await prisma.classroom.findUnique({ where: { id: req.params.classroomId } });
      if (!c) return res.status(404).json({ error: "Classroom not found" });
      if (c.createdById !== uid(req)) return res.status(403).json({ error: "Only the classroom owner can post assignments" });

      const a = await prisma.classroomAssignment.create({
        data: {
          classroomId: c.id,
          createdById: uid(req),
          title: title.trim(),
          description: description?.trim() || null,
          dueAt: dueAt ? new Date(dueAt) : null,
          points: parseInt(points) || 100,
          type: ["text", "file", "both"].includes(type) ? type : "text"
        }
      });
      res.json(a);
    } catch (err) {
      console.error("Create assignment:", err);
      res.status(500).json({ error: "Failed to create assignment" });
    }
  }
);

// List assignments for a classroom
router.get("/classroom/:classroomId", requireAuth, async (req, res) => {
  try {
    const access = await classroomAccess(req.params.classroomId, uid(req));
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const list = await prisma.classroomAssignment.findMany({
      where: { classroomId: req.params.classroomId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { submissions: true } },
        submissions: {
          where: { studentId: uid(req) },
          select: { id: true, submittedAt: true, grade: true, feedback: true }
        }
      }
    });
    res.json(list);
  } catch (err) {
    console.error("List assignments:", err);
    res.status(500).json({ error: "Failed to list assignments" });
  }
});

// Get one assignment with submissions (faculty: all, student: own only)
router.get("/:assignmentId", requireAuth, async (req, res) => {
  try {
    const a = await prisma.classroomAssignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { classroom: true }
    });
    if (!a) return res.status(404).json({ error: "Assignment not found" });

    const isHost = a.classroom.createdById === uid(req);
    const access = await classroomAccess(a.classroomId, uid(req));
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const subs = await prisma.assignmentSubmission.findMany({
      where: isHost ? { assignmentId: a.id } : { assignmentId: a.id, studentId: uid(req) },
      orderBy: { submittedAt: "desc" }
    });

    // Hydrate student usernames if faculty
    if (isHost && subs.length) {
      const ids = [...new Set(subs.map((s) => s.studentId))];
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true, email: true }
      });
      const map = Object.fromEntries(users.map((u) => [u.id, u]));
      subs.forEach((s) => { s.student = map[s.studentId]; });
    }

    res.json({ ...a, submissions: subs, isHost });
  } catch (err) {
    console.error("Get assignment:", err);
    res.status(500).json({ error: "Failed to load assignment" });
  }
});

// Delete assignment (host only)
router.delete("/:assignmentId", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const a = await prisma.classroomAssignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { classroom: true }
    });
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    if (a.classroom.createdById !== uid(req)) return res.status(403).json({ error: "Not the owner" });

    await prisma.classroomAssignment.delete({ where: { id: a.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete assignment:", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ============ SUBMISSIONS ============

// Submit (text and/or file). Upserts.
router.post("/:assignmentId/submit", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const a = await prisma.classroomAssignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { classroom: true }
    });
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    const access = await classroomAccess(a.classroomId, uid(req));
    if (!access.ok) return res.status(access.code).json({ error: access.error });
    if (access.isHost) return res.status(400).json({ error: "Faculty cannot submit to their own assignment" });

    const data = {
      assignmentId: a.id,
      studentId: uid(req),
      content: req.body?.content?.trim() || null,
      fileUrl: req.file ? `/uploads/submissions/${req.file.filename}` : null,
      fileName: req.file?.originalname || null
    };
    if (!data.content && !data.fileUrl) {
      return res.status(400).json({ error: "Provide text content or a file" });
    }

    const s = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: a.id, studentId: uid(req) } },
      update: { ...data, submittedAt: new Date(), grade: null, feedback: null, gradedAt: null, gradedById: null },
      create: data
    });
    res.json(s);
  } catch (err) {
    console.error("Submit assignment:", err);
    res.status(500).json({ error: "Failed to submit" });
  }
});

// Grade a submission (host only)
router.post(
  "/submissions/:submissionId/grade",
  requireAuth,
  requireRole("TEACHER", "LECTURER"),
  async (req, res) => {
    try {
      const { grade, feedback } = req.body || {};
      const sub = await prisma.assignmentSubmission.findUnique({
        where: { id: req.params.submissionId },
        include: { assignment: { include: { classroom: true } } }
      });
      if (!sub) return res.status(404).json({ error: "Submission not found" });
      if (sub.assignment.classroom.createdById !== uid(req)) {
        return res.status(403).json({ error: "Not the owner" });
      }
      const g = grade === null || grade === undefined ? null : parseInt(grade);
      if (g !== null && (Number.isNaN(g) || g < 0 || g > sub.assignment.points)) {
        return res.status(400).json({ error: `Grade must be 0-${sub.assignment.points}` });
      }
      const updated = await prisma.assignmentSubmission.update({
        where: { id: sub.id },
        data: {
          grade: g,
          feedback: feedback?.trim() || null,
          gradedAt: g === null ? null : new Date(),
          gradedById: g === null ? null : uid(req)
        }
      });
      res.json(updated);
    } catch (err) {
      console.error("Grade submission:", err);
      res.status(500).json({ error: "Failed to grade" });
    }
  }
);

// Download a submission file (host or owner)
router.get("/submissions/:submissionId/download", requireAuth, async (req, res) => {
  try {
    const sub = await prisma.assignmentSubmission.findUnique({
      where: { id: req.params.submissionId },
      include: { assignment: { include: { classroom: true } } }
    });
    if (!sub) return res.status(404).json({ error: "Not found" });
    const isOwner = sub.studentId === uid(req);
    const isHost = sub.assignment.classroom.createdById === uid(req);
    if (!isOwner && !isHost) return res.status(403).json({ error: "Forbidden" });
    if (!sub.fileUrl) return res.status(404).json({ error: "No file" });
    const filePath = path.join(uploadDir, path.basename(sub.fileUrl));
    res.download(filePath, sub.fileName || "submission");
  } catch (err) {
    console.error("Download submission:", err);
    res.status(500).json({ error: "Failed to download" });
  }
});

// Gradebook for a classroom (faculty only)
router.get(
  "/classroom/:classroomId/gradebook",
  requireAuth,
  requireRole("TEACHER", "LECTURER"),
  async (req, res) => {
    try {
      const c = await prisma.classroom.findUnique({
        where: { id: req.params.classroomId },
        include: {
          members: { include: { user: { select: { id: true, username: true, email: true } } } }
        }
      });
      if (!c) return res.status(404).json({ error: "Not found" });
      if (c.createdById !== uid(req)) return res.status(403).json({ error: "Not the owner" });

      const assignments = await prisma.classroomAssignment.findMany({
        where: { classroomId: c.id },
        orderBy: { createdAt: "asc" },
        include: { submissions: true }
      });

      const grid = c.members.map(({ user }) => {
        const cells = assignments.map((a) => {
          const sub = a.submissions.find((s) => s.studentId === user.id);
          return sub ? { submitted: true, grade: sub.grade, points: a.points } : { submitted: false, grade: null, points: a.points };
        });
        const graded = cells.filter((x) => x.grade !== null && x.grade !== undefined);
        const totalEarned = graded.reduce((s, x) => s + x.grade, 0);
        const totalPoints = graded.reduce((s, x) => s + x.points, 0);
        const avgPct = totalPoints > 0 ? Math.round((totalEarned / totalPoints) * 100) : null;
        return { student: user, cells, avgPct, gradedCount: graded.length };
      });

      res.json({
        assignments: assignments.map((a) => ({ id: a.id, title: a.title, points: a.points, dueAt: a.dueAt })),
        rows: grid
      });
    } catch (err) {
      console.error("Gradebook:", err);
      res.status(500).json({ error: "Failed to load gradebook" });
    }
  }
);

export default router;
