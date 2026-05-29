import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".docx", ".doc", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and TXT files are allowed"));
    }
  },
});

// ============ CLASSROOM MANAGEMENT ============

// Create a new classroom (teacher only)
router.post("/", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { name, subjectId } = req.body;
    const classroom = await prisma.classroom.create({
      data: {
        name,
        subjectId,
        createdById: req.user.sub,
      },
      include: {
        createdBy: { select: { id: true, username: true } },
      },
    });
    res.json(classroom);
  } catch (error) {
    console.error("Error creating classroom:", error);
    res.status(500).json({ error: "Failed to create classroom" });
  }
});

// Get all classrooms for current user
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const isTeacher = req.user.role === "TEACHER";

    let classrooms;
    if (isTeacher) {
      classrooms = await prisma.classroom.findMany({
        where: { createdById: userId },
        include: {
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      const memberships = await prisma.classroomMember.findMany({
        where: { userId },
        include: {
          classroom: {
            include: {
              createdBy: { select: { id: true, username: true } },
              _count: { select: { members: true, announcements: true, documents: true } },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      });
      classrooms = memberships.map((m) => m.classroom);
    }

    res.json(classrooms);
  } catch (error) {
    console.error("Error fetching classrooms:", error);
    res.status(500).json({ error: "Failed to fetch classrooms" });
  }
});

// Get classroom by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true } },
        links: { orderBy: { createdAt: "desc" } },
        announcements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            reads: { where: { userId: req.user.sub } },
            _count: { select: { reads: true } },
          },
        },
        documents: {
          orderBy: { uploadedAt: "desc" },
          include: {
            _count: { select: { downloads: true } },
          },
        },
        exams: { orderBy: { examDate: "asc" } },
        members: {
          include: { user: { select: { id: true, username: true } } },
        },
      },
    });

    if (!classroom) {
      return res.status(404).json({ error: "Classroom not found" });
    }

    res.json(classroom);
  } catch (error) {
    console.error("Error fetching classroom:", error);
    res.status(500).json({ error: "Failed to fetch classroom" });
  }
});

// Join a classroom (student)
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const membership = await prisma.classroomMember.create({
      data: {
        classroomId: id,
        userId,
      },
    });

    res.json(membership);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Already a member of this classroom" });
    }
    console.error("Error joining classroom:", error);
    res.status(500).json({ error: "Failed to join classroom" });
  }
});

// ============ LINKS ============

// Add a link to classroom (teacher only)
router.post("/:id/links", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, url } = req.body;

    const link = await prisma.classroomLink.create({
      data: {
        classroomId: id,
        title,
        url,
      },
    });

    res.json(link);
  } catch (error) {
    console.error("Error adding link:", error);
    res.status(500).json({ error: "Failed to add link" });
  }
});

// Delete a link (teacher only)
router.delete("/:classroomId/links/:linkId", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { linkId } = req.params;
    await prisma.classroomLink.delete({ where: { id: linkId } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting link:", error);
    res.status(500).json({ error: "Failed to delete link" });
  }
});

// ============ ANNOUNCEMENTS ============

// Create announcement (teacher only)
router.post("/:id/announcements", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, isImportant } = req.body;

    const announcement = await prisma.classroomAnnouncement.create({
      data: {
        classroomId: id,
        title,
        content,
        isImportant: isImportant || false,
      },
    });

    res.json(announcement);

    // Fire-and-forget push notifications to all classroom members
    (async () => {
      try {
        const { sendPushToUsers } = await import("../lib/pushSender.js");
        const [classroom, members] = await Promise.all([
          prisma.classroom.findUnique({ where: { id }, select: { name: true } }),
          prisma.classroomMember.findMany({ where: { classroomId: id }, select: { userId: true } })
        ]);
        const ids = members.map((m) => m.userId).filter((u) => u !== req.user.sub);
        if (ids.length === 0) return;
        await sendPushToUsers(
          ids,
          {
            title: `📢 ${isImportant ? "[Important] " : ""}${classroom?.name || "Classroom"}: ${title}`,
            body: (content || "").slice(0, 200),
            tag: `announcement-${announcement.id}`,
            requireInteraction: !!isImportant,
            data: { tab: "classroom", classroomId: id, announcementId: announcement.id }
          },
          { category: "announcements" }
        );
      } catch (err) {
        console.warn("Failed to send announcement push:", err.message);
      }
    })();
  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// Mark announcement as read (student)
router.post("/announcements/:announcementId/read", requireAuth, async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user.sub;

    const read = await prisma.announcementRead.create({
      data: {
        announcementId,
        userId,
      },
    });

    res.json(read);
  } catch (error) {
    if (error.code === "P2002") {
      return res.json({ success: true, alreadyRead: true });
    }
    console.error("Error marking announcement read:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// ============ DOCUMENTS ============

// Upload document (teacher only)
router.post("/:id/documents", requireAuth, requireRole("TEACHER", "LECTURER"), upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const document = await prisma.classroomDocument.create({
      data: {
        classroomId: id,
        title: title || file.originalname,
        filename: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        fileType: path.extname(file.originalname).toLowerCase().replace(".", ""),
        fileSize: file.size,
      },
    });

    res.json(document);
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// Download document
router.get("/documents/:documentId/download", requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.sub;

    const document = await prisma.classroomDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Record download
    await prisma.documentDownload.create({
      data: {
        documentId,
        userId,
      },
    }).catch(() => {}); // Ignore if already downloaded

    const filePath = path.join(uploadDir, path.basename(document.fileUrl));
    res.download(filePath, document.filename);
  } catch (error) {
    console.error("Error downloading document:", error);
    res.status(500).json({ error: "Failed to download document" });
  }
});

// Delete document (teacher only)
router.delete("/:classroomId/documents/:documentId", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await prisma.classroomDocument.findUnique({
      where: { id: documentId },
    });

    if (document) {
      // Delete file from disk
      const filePath = path.join(uploadDir, path.basename(document.fileUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      // Delete from database
      await prisma.classroomDocument.delete({ where: { id: documentId } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// ============ EXAMS ============

// Create exam (teacher only)
router.post("/:id/exams", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, examDate, duration, subjectId } = req.body;

    const exam = await prisma.exam.create({
      data: {
        classroomId: id,
        title,
        examDate: new Date(examDate),
        duration: parseInt(duration),
        subjectId,
      },
    });

    res.json(exam);
  } catch (error) {
    console.error("Error creating exam:", error);
    res.status(500).json({ error: "Failed to create exam" });
  }
});

// Get all public exams (for countdown)
router.get("/exams/upcoming", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const exams = await prisma.exam.findMany({
      where: {
        examDate: { gte: now },
        isPublic: true,
      },
      orderBy: { examDate: "asc" },
      take: 10,
    });

    res.json(exams);
  } catch (error) {
    console.error("Error fetching upcoming exams:", error);
    res.status(500).json({ error: "Failed to fetch exams" });
  }
});

export default router;
