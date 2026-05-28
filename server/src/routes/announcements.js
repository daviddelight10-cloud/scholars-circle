import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { sendPushToUsers, isPushConfigured } from "../lib/pushSender.js";

const router = Router();

// Get all announcements for current user (unread first, filtered by role)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const announcements = await prisma.campusAnnouncement.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ],
        // Filter by targetRoles: empty array or includes user's role
        OR: [
          { targetRoles: { isEmpty: true } },
          { targetRoles: { has: user.role } }
        ]
      },
      include: {
        sender: {
          select: { id: true, username: true, role: true }
        },
        reads: {
          where: { userId },
          select: { id: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, username: true, role: true }
            }
          },
          orderBy: { createdAt: "asc" }
        },
        _count: {
          select: { reads: true, comments: true }
        }
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ]
    });

    // Mark which are read
    const withReadStatus = announcements.map(a => ({
      ...a,
      isRead: a.reads.length > 0,
      readCount: a._count.reads,
      commentCount: a._count.comments
    }));

    // Sort: unread first, then by priority, then by date
    withReadStatus.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      const priorityOrder = { CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
      const pA = priorityOrder[a.priority] || 2;
      const pB = priorityOrder[b.priority] || 2;
      if (pA !== pB) return pB - pA;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(withReadStatus);
  } catch (err) {
    console.error("Get announcements error:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

// Get unread count (filtered by role)
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const unreadCount = await prisma.campusAnnouncement.count({
      where: {
        reads: { none: { userId } },
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ],
        OR: [
          { targetRoles: { isEmpty: true } },
          { targetRoles: { has: user.role } }
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
    const { category, priority, targetRoles, title, content, attachments, expiresAt } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required" });
    }

    const announcement = await prisma.campusAnnouncement.create({
      data: {
        senderId: req.user.sub,
        category: category || "GENERAL",
        priority: priority || "NORMAL",
        targetRoles: targetRoles || [],
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

    // Send push notifications for IMPORTANT or CRITICAL announcements
    if (isPushConfigured() && (category === "IMPORTANT" || priority === "CRITICAL" || priority === "HIGH")) {
      try {
        // Get all users matching targetRoles (or all if empty)
        const whereClause = targetRoles && targetRoles.length > 0
          ? { role: { in: targetRoles } }
          : {};
        
        const targetUsers = await prisma.user.findMany({
          where: whereClause,
          select: { id: true }
        });

        const userIds = targetUsers.map(u => u.id);
        
        if (userIds.length > 0) {
          const priorityEmoji = priority === "CRITICAL" ? "🚨" : priority === "HIGH" ? "⚠️" : "📢";
          await sendPushToUsers(userIds, {
            title: `${priorityEmoji} ${title}`,
            body: content.substring(0, 200),
            tag: `announcement-${announcement.id}`,
            data: { announcementId: announcement.id, type: "campus-announcement" },
            requireInteraction: priority === "CRITICAL"
          });
          console.log(`[push] Sent announcement to ${userIds.length} users`);
        }
      } catch (pushErr) {
        console.error("[push] Failed to send announcement push:", pushErr);
        // Don't fail the request if push fails
      }
    }

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

// Add comment to announcement
router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const announcement = await prisma.campusAnnouncement.findUnique({
      where: { id }
    });

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    const comment = await prisma.announcementComment.create({
      data: {
        announcementId: id,
        userId: req.user.sub,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, username: true, role: true }
        }
      }
    });

    res.status(201).json(comment);
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Get analytics for faculty (their own announcements)
router.get("/analytics/my", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const userId = req.user.sub;

    const announcements = await prisma.campusAnnouncement.findMany({
      where: { senderId: userId },
      include: {
        _count: {
          select: { reads: true, comments: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const analytics = announcements.map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
      priority: a.priority,
      targetRoles: a.targetRoles,
      createdAt: a.createdAt,
      expiresAt: a.expiresAt,
      readCount: a._count.reads,
      commentCount: a._count.comments
    }));

    // Calculate overall stats
    const totalAnnouncements = analytics.length;
    const totalReads = analytics.reduce((sum, a) => sum + a.readCount, 0);
    const totalComments = analytics.reduce((sum, a) => sum + a.commentCount, 0);
    const avgReadRate = totalAnnouncements > 0 
      ? (analytics.reduce((sum, a) => sum + (a.readCount > 0 ? 1 : 0), 0) / totalAnnouncements * 100).toFixed(1)
      : 0;

    res.json({
      overall: {
        totalAnnouncements,
        totalReads,
        totalComments,
        avgReadRate: parseFloat(avgReadRate)
      },
      byAnnouncement: analytics
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export default router;
