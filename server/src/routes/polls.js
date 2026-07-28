import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const uid = (req) => req.user.sub || req.user.id;

// Create poll for a session (host only)
router.post(
  "/sessions/:sessionId",
  requireAuth,
  requireRole("TEACHER", "LECTURER"),
  async (req, res) => {
    try {
      const { question, options } = req.body || {};
      if (!question?.trim()) return res.status(400).json({ error: "Question required" });
      if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
        return res.status(400).json({ error: "Provide 2-6 options" });
      }
      const session = await prisma.liveSession.findUnique({ where: { id: req.params.sessionId } });
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.hostId !== uid(req)) return res.status(403).json({ error: "Only the host can create polls" });

      const poll = await prisma.livePoll.create({
        data: {
          sessionId: session.id,
          createdById: uid(req),
          question: question.trim(),
          options: options.map((o) => String(o).trim()).filter(Boolean)
        }
      });
      res.json(poll);
    } catch (err) {
      console.error("Create poll:", err);
      res.status(500).json({ error: "Failed to create poll" });
    }
  }
);

// List polls for a session
router.get("/sessions/:sessionId", requireAuth, async (req, res) => {
  try {
    const polls = await prisma.livePoll.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { votes: true } } }
    });
    res.json(polls);
  } catch (err) {
    console.error("List polls:", err);
    res.status(500).json({ error: "Failed to list polls" });
  }
});

// Vote (any participant)
router.post("/:pollId/vote", requireAuth, async (req, res) => {
  try {
    const { optionIndex } = req.body || {};
    const idx = parseInt(optionIndex);
    if (Number.isNaN(idx)) return res.status(400).json({ error: "optionIndex required" });

    const poll = await prisma.livePoll.findUnique({ where: { id: req.params.pollId } });
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    if (poll.status !== "active") return res.status(400).json({ error: "Poll has ended" });
    const opts = Array.isArray(poll.options) ? poll.options : [];
    if (idx < 0 || idx >= opts.length) return res.status(400).json({ error: "Invalid option" });

    const vote = await prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId: uid(req) } },
      update: { optionIndex: idx },
      create: { pollId: poll.id, userId: uid(req), optionIndex: idx }
    });
    res.json(vote);
  } catch (err) {
    console.error("Vote:", err);
    res.status(500).json({ error: "Failed to vote" });
  }
});

// Get poll results (anyone in the session)
router.get("/:pollId/results", requireAuth, async (req, res) => {
  try {
    const poll = await prisma.livePoll.findUnique({
      where: { id: req.params.pollId },
      include: { votes: true }
    });
    if (!poll) return res.status(404).json({ error: "Not found" });

    const opts = Array.isArray(poll.options) ? poll.options : [];
    const counts = opts.map(() => 0);
    for (const v of poll.votes) {
      if (v.optionIndex >= 0 && v.optionIndex < counts.length) counts[v.optionIndex]++;
    }
    const myVote = poll.votes.find((v) => v.userId === uid(req));

    res.json({
      id: poll.id,
      question: poll.question,
      options: opts,
      counts,
      total: poll.votes.length,
      status: poll.status,
      myVote: myVote?.optionIndex ?? null,
      createdAt: poll.createdAt,
      endedAt: poll.endedAt
    });
  } catch (err) {
    console.error("Poll results:", err);
    res.status(500).json({ error: "Failed to load results" });
  }
});

// End poll (host only)
router.post("/:pollId/end", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const poll = await prisma.livePoll.findUnique({
      where: { id: req.params.pollId },
      include: { session: true }
    });
    if (!poll) return res.status(404).json({ error: "Not found" });
    if (poll.session.hostId !== uid(req)) return res.status(403).json({ error: "Not the host" });

    const updated = await prisma.livePoll.update({
      where: { id: poll.id },
      data: { status: "ended", endedAt: new Date() }
    });
    res.json(updated);
  } catch (err) {
    console.error("End poll:", err);
    res.status(500).json({ error: "Failed to end poll" });
  }
});

export default router;
