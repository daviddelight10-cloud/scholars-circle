import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prisma } from "../db.js";

const router = Router();

// Get all announcements for current user (unread first)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const announcements = await prisma.campusAnnouncement.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      include: {
        sender: {
          select: { id: true, username: true, role: true }
        },
        reads: {
          where: { userId },
          select: { id: true }
        }
      },
      orderBy: [
        { createdAt: "desc" }
      ]
    });

    // Mark which are read
    const withReadStatus = announcements.map(a => ({
      ...a,
      isRead: a.reads.length > 0,
      readCount: a.reads.length
    }));

    // Sort: unread first, then by date
    withReadStatus.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(withReadStatus);
  } catch (err) {
    console.error("Get announcements error:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

// Get unread count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const unreadCount = await prisma.campusAnnouncement.count({
      where: {
        reads: { none: { userId } },
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      }
    });

    res.json({ count: unreadCount });
  } catch (err) {
    console.error("Unread count error:", err);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// Create announcement (teacher/lecturer only)
router.post("/", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { category, title, content, attachments, expiresAt } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required" });
    }

    const announcement = await prisma.campusAnnouncement.create({
      data: {
        senderId: req.user.sub,
        category: category || "GENERAL",
        title,
        content,
        attachments: attachments || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      include: {
        sender: {
          select: { id: true, username: true, role: true }
        }
      }
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error("Create announcement error:", err);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// Mark announcement as read
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    // Check if announcement exists
    const announcement = await prisma.campusAnnouncement.findUnique({
      where: { id }
    });

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    // Create read record (unique constraint prevents duplicates)
    await prisma.campusAnnouncementRead.create({
      data: {
        announcementId: id,
        userId
      }
    }).catch(() => {
      // Ignore if already read
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// Delete announcement (sender only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await prisma.campusAnnouncement.findUnique({
      where: { id }
    });

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    if (announcement.senderId !== req.user.sub) {
      return res.status(403).json({ error: "Can only delete your own announcements" });
    }

    await prisma.campusAnnouncement.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete announcement error:", err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
