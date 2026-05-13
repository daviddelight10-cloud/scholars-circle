import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// =================== LECTURER PROFILES ===================

// List all public lecturer profiles (with optional filters)
router.get("/", async (req, res) => {
  try {
    const { department, institution, search } = req.query;
    const where = { isPublic: true };
    if (department) where.department = { contains: department, mode: "insensitive" };
    if (institution) where.institution = { contains: institution, mode: "insensitive" };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { researchAreas: { has: search } }
      ];
    }
    const lecturers = await prisma.lecturerProfile.findMany({
      where,
      orderBy: [{ rating: "desc" }, { totalRatings: "desc" }],
      select: {
        id: true,
        title: true,
        fullName: true,
        department: true,
        institution: true,
        bio: true,
        researchAreas: true,
        avatarUrl: true,
        rating: true,
        totalRatings: true,
        isVerified: true
      }
    });
    res.json(lecturers);
  } catch (err) {
    console.error("List lecturers error:", err);
    res.status(500).json({ error: "Failed to fetch lecturers" });
  }
});

// Get the current user's own lecturer profile (for editing)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const profile = await prisma.lecturerProfile.findUnique({
      where: { userId: req.user.sub }
    });
    res.json(profile);
  } catch (err) {
    console.error("Get my lecturer profile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Get full lecturer profile by ID (public view)
router.get("/:id", async (req, res) => {
  try {
    const lecturer = await prisma.lecturerProfile.findUnique({
      where: { id: req.params.id },
      include: {
        ratings: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { student: { select: { username: true } } }
        },
        posts: {
          take: 5,
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!lecturer) return res.status(404).json({ error: "Lecturer not found" });
    if (!lecturer.isPublic) {
      // Hide if not public
      if (!req.user || req.user.sub !== lecturer.userId) {
        return res.status(403).json({ error: "This profile is private" });
      }
    }
    res.json(lecturer);
  } catch (err) {
    console.error("Get lecturer error:", err);
    res.status(500).json({ error: "Failed to fetch lecturer" });
  }
});

// Create or update own lecturer profile
router.post("/me", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "TEACHER" && req.user.role !== "LECTURER") {
      return res.status(403).json({ error: "Only faculty can create lecturer profiles" });
    }
    const data = sanitizeProfileInput(req.body);
    const profile = await prisma.lecturerProfile.upsert({
      where: { userId: req.user.sub },
      update: data,
      create: { ...data, userId: req.user.sub, fullName: data.fullName || req.user.username }
    });
    res.json(profile);
  } catch (err) {
    console.error("Upsert lecturer profile error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// =================== RATINGS ===================

router.post("/:id/rate", requireAuth, async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: "Score must be 1-5" });
    }
    // Upsert rating
    await prisma.lecturerRating.upsert({
      where: { lecturerId_studentId: { lecturerId: req.params.id, studentId: req.user.sub } },
      update: { score, comment: comment || null },
      create: { lecturerId: req.params.id, studentId: req.user.sub, score, comment: comment || null }
    });
    // Recompute aggregate
    const stats = await prisma.lecturerRating.aggregate({
      where: { lecturerId: req.params.id },
      _avg: { score: true },
      _count: { _all: true }
    });
    const updated = await prisma.lecturerProfile.update({
      where: { id: req.params.id },
      data: {
        rating: stats._avg.score || 0,
        totalRatings: stats._count._all
      }
    });
    res.json({ rating: updated.rating, totalRatings: updated.totalRatings });
  } catch (err) {
    console.error("Rate lecturer error:", err);
    res.status(500).json({ error: "Failed to rate lecturer" });
  }
});

// =================== POSTS ===================

router.post("/:id/posts", requireAuth, async (req, res) => {
  try {
    const lecturer = await prisma.lecturerProfile.findUnique({ where: { id: req.params.id } });
    if (!lecturer) return res.status(404).json({ error: "Lecturer not found" });
    if (lecturer.userId !== req.user.sub) {
      return res.status(403).json({ error: "You can only post on your own profile" });
    }
    const { title, content, tags } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "Title and content required" });
    }
    const post = await prisma.lecturerPost.create({
      data: {
        lecturerId: req.params.id,
        title: title.trim(),
        content: content.trim(),
        tags: Array.isArray(tags) ? tags : []
      }
    });
    res.json(post);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.delete("/posts/:postId", requireAuth, async (req, res) => {
  try {
    const post = await prisma.lecturerPost.findUnique({
      where: { id: req.params.postId },
      include: { lecturer: true }
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.lecturer.userId !== req.user.sub) {
      return res.status(403).json({ error: "Not your post" });
    }
    await prisma.lecturerPost.delete({ where: { id: req.params.postId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// =================== DIRECT MESSAGES ===================

// Send a message to a user (typically a lecturer)
router.post("/messages", requireAuth, async (req, res) => {
  try {
    const { toUserId, toLecturerId, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Message content required" });

    let targetUserId = toUserId;
    if (!targetUserId && toLecturerId) {
      const lec = await prisma.lecturerProfile.findUnique({ where: { id: toLecturerId } });
      if (!lec) return res.status(404).json({ error: "Lecturer not found" });
      targetUserId = lec.userId;
    }
    if (!targetUserId) return res.status(400).json({ error: "Recipient required" });
    if (targetUserId === req.user.sub) return res.status(400).json({ error: "Cannot message yourself" });

    const dm = await prisma.directMessage.create({
      data: {
        fromId: req.user.sub,
        toId: targetUserId,
        content: content.trim()
      }
    });
    res.json(dm);
  } catch (err) {
    console.error("Send DM error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get conversation thread with another user
router.get("/messages/thread/:otherUserId", requireAuth, async (req, res) => {
  try {
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { fromId: req.user.sub, toId: req.params.otherUserId },
          { fromId: req.params.otherUserId, toId: req.user.sub }
        ]
      },
      orderBy: { createdAt: "asc" }
    });
    // Mark received as read
    await prisma.directMessage.updateMany({
      where: { toId: req.user.sub, fromId: req.params.otherUserId, read: false },
      data: { read: true }
    });
    res.json(messages);
  } catch (err) {
    console.error("Get thread error:", err);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// Inbox: list latest message per conversation partner
router.get("/messages/inbox", requireAuth, async (req, res) => {
  try {
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [{ fromId: req.user.sub }, { toId: req.user.sub }]
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    // Group by partner
    const partnerMap = new Map();
    for (const m of messages) {
      const partnerId = m.fromId === req.user.sub ? m.toId : m.fromId;
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { partnerId, lastMessage: m, unreadCount: 0 });
      }
      if (m.toId === req.user.sub && !m.read) {
        partnerMap.get(partnerId).unreadCount++;
      }
    }
    // Hydrate partner details
    const partnerIds = Array.from(partnerMap.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, username: true, lecturerProfile: { select: { fullName: true, title: true, avatarUrl: true } } }
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const inbox = Array.from(partnerMap.values()).map((entry) => ({
      ...entry,
      partner: userMap.get(entry.partnerId)
    }));
    res.json(inbox);
  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).json({ error: "Failed to fetch inbox" });
  }
});

router.get("/messages/unread-count", requireAuth, async (req, res) => {
  try {
    const count = await prisma.directMessage.count({
      where: { toId: req.user.sub, read: false }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count unread" });
  }
});

// =================== HELPERS ===================

function sanitizeProfileInput(body) {
  const allowed = [
    "title", "fullName", "department", "institution", "bio",
    "qualifications", "researchAreas", "officeHours", "officeLocation",
    "contactEmail", "phone", "avatarUrl", "websiteUrl", "linkedinUrl",
    "yearsExperience", "isPublic"
  ];
  const out = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

export default router;
