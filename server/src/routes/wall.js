import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { awardBadge } from "../lib/badges.js";

const router = express.Router();

// GET /wall?classroomId=... — feed for a classroom
router.get("/", requireAuth, async (req, res) => {
  try {
    const { classroomId, cursor, limit = 20 } = req.query;
    if (!classroomId) return res.status(400).json({ error: "classroomId required" });

    const where = { classroomId };
    if (cursor) where.createdAt = { lt: new Date(cursor) };

    const posts = await prisma.wallPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      include: {
        author: { select: { id: true, username: true } },
        reactions: {
          select: { id: true, userId: true, emoji: true },
        },
      },
    });

    res.json(posts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /wall — create a new post
router.post("/", requireAuth, async (req, res) => {
  try {
    const { classroomId, content, kind, metadata } = req.body;
    if (!classroomId || !content) return res.status(400).json({ error: "classroomId and content required" });

    const post = await prisma.wallPost.create({
      data: {
        classroomId,
        authorId: req.user.sub,
        content,
        kind: kind || "post",
        metadata: metadata || undefined,
      },
      include: {
        author: { select: { id: true, username: true } },
        reactions: true,
      },
    });

    // Award first_post badge
    await awardBadge(req.user.sub, "first_post");

    res.json(post);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /wall/:id — delete own post
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await prisma.wallPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.authorId !== req.user.sub) return res.status(403).json({ error: "Not your post" });
    await prisma.wallPost.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /wall/:id/react — add/toggle reaction
router.post("/:id/react", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;
    const { emoji = "👍" } = req.body;

    // Toggle: if exists, remove; otherwise add
    const existing = await prisma.wallReaction.findUnique({
      where: { postId_userId_emoji: { postId: id, userId, emoji } },
    });

    if (existing) {
      await prisma.wallReaction.delete({ where: { id: existing.id } });
      return res.json({ action: "removed", emoji });
    }

    const reaction = await prisma.wallReaction.create({
      data: { postId: id, userId, emoji },
    });
    res.json({ action: "added", reaction });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
