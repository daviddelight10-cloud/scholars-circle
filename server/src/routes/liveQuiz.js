import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { generateTicket, consumeTicket } from "./voiceSession.js";
import {
  createRoom,
  getRoom,
  getRoomByCode,
  registerParticipant,
  attachSocket,
  detachSocket,
  handleMessage,
  endRoom,
} from "../lib/liveQuizRooms.js";

const router = Router();

function userId(req) {
  return req.user.sub || req.user.id;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeMcqData(mcqData) {
  let rows = mcqData;
  if (typeof rows === "string") {
    try { rows = JSON.parse(rows); } catch { rows = null; }
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((q) => q && q.question && q.options && q.correct)
    .map((q) => {
      const opts = Array.isArray(q.options)
        ? { A: q.options[0] || "", B: q.options[1] || "", C: q.options[2] || "", D: q.options[3] || "" }
        : { A: q.options.A || "", B: q.options.B || "", C: q.options.C || "", D: q.options.D || "" };
      const correct = String(q.correct).toUpperCase();
      return { question: String(q.question), options: opts, correct, explanation: q.explanation || "" };
    })
    .filter((q) => ["A", "B", "C", "D"].includes(q.correct) && q.options.A && q.options.B && q.options.C && q.options.D);
}

// POST /api/live-quiz/create — create a room from an MCQ resource
router.post("/create", requireAuth, async (req, res) => {
  try {
    const { mcqResourceId, timePerQuestion, numQuestions } = req.body || {};
    if (!mcqResourceId) return res.status(400).json({ error: "mcqResourceId is required" });

    const mcq = await prisma.resource.findUnique({
      where: { id: mcqResourceId },
      select: { id: true, title: true, contentType: true, mcqData: true, sourceResourceId: true, status: true },
    });
    if (!mcq) return res.status(404).json({ error: "MCQ resource not found" });
    if (mcq.contentType !== "mcq" || !mcq.mcqData) {
      return res.status(400).json({ error: "This resource has no MCQ questions" });
    }

    const questions = normalizeMcqData(mcq.mcqData);
    if (questions.length === 0) {
      return res.status(400).json({ error: "This MCQ set is empty" });
    }

    const room = createRoom({
      hostId: userId(req),
      hostName: req.user.username,
      resourceId: mcq.sourceResourceId || null,
      mcqResourceId: mcq.id,
      title: mcq.title,
      questions: shuffle(questions),
      settings: { timePerQuestion, numQuestions },
    });
    registerParticipant(room, userId(req), req.user.username);

    const ticket = generateTicket(room.id, userId(req));
    res.json({
      roomId: room.id,
      code: room.code,
      ticket,
      title: room.title,
      questionCount: questions.length,
      maxQuestions: questions.length,
    });
  } catch (err) {
    console.error("Live quiz create error:", err);
    res.status(500).json({ error: "Failed to create live session" });
  }
});

// GET /api/live-quiz/:code — public-ish room preview for invite landing
router.get("/:code", requireAuth, async (req, res) => {
  try {
    const room = getRoomByCode(req.params.code);
    if (!room || room.phase === "ended") {
      return res.status(404).json({ error: "Session not found or already ended" });
    }
    const host = room.participants.get(room.hostId);
    res.json({
      roomId: room.id,
      code: room.code,
      title: room.title,
      host: host?.username || "Host",
      phase: room.phase,
      joinable: room.phase === "lobby" || room.phase === "transition",
      participantCount: [...room.participants.values()].filter((p) => p.connected).length,
      maxParticipants: 8,
      settings: room.settings,
      isMember: room.participants.has(userId(req)),
    });
  } catch (err) {
    console.error("Live quiz preview error:", err);
    res.status(500).json({ error: "Failed to load session" });
  }
});

// POST /api/live-quiz/join — join by code, returns WS ticket
router.post("/join", requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    const room = getRoomByCode(code);
    if (!room || room.phase === "ended") {
      return res.status(404).json({ error: "Session not found or already ended" });
    }
    const uid = userId(req);
    const already = room.participants.has(uid);
    if (!already && room.phase !== "lobby" && room.phase !== "transition") {
      return res.status(409).json({ error: "Session already in progress", phase: room.phase });
    }
    if (!already && room.participants.size >= 8) {
      return res.status(409).json({ error: "Room is full" });
    }
    const reg = registerParticipant(room, uid, req.user.username);
    if (!reg.ok) return res.status(409).json({ error: reg.error });
    const ticket = generateTicket(room.id, uid);
    res.json({ roomId: room.id, code: room.code, ticket, title: room.title });
  } catch (err) {
    console.error("Live quiz join error:", err);
    res.status(500).json({ error: "Failed to join session" });
  }
});

// POST /api/live-quiz/:roomId/ticket — fresh WS ticket for reconnects
router.post("/:roomId/ticket", requireAuth, async (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room || room.phase === "ended") return res.status(404).json({ error: "Session not found" });
  if (!room.participants.has(userId(req))) return res.status(403).json({ error: "Not a participant" });
  res.json({ ticket: generateTicket(room.id, userId(req)) });
});

// POST /api/live-quiz/:roomId/voice-token — LiveKit access token for voice chat
router.post("/:roomId/voice-token", requireAuth, async (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room || room.phase === "ended") return res.status(404).json({ error: "Session not found" });
  if (!room.participants.has(userId(req))) return res.status(403).json({ error: "Not a participant" });

  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(503).json({ error: "voice_unavailable" });
  }

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId(req),
      name: req.user.username || "Scholar",
      ttl: "2h",
    });
    at.addGrant({
      room: `lq-${room.code}`,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    res.json({ token: await at.toJwt(), url: LIVEKIT_URL });
  } catch (err) {
    console.error("LiveKit token error:", err);
    res.status(500).json({ error: "Failed to create voice token" });
  }
});

// POST /api/live-quiz/:roomId/end — host ends the session for everyone
router.post("/:roomId/end", requireAuth, async (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room || room.phase === "ended") return res.status(404).json({ error: "Session not found" });
  if (room.hostId !== userId(req)) return res.status(403).json({ error: "Only the host can end the session" });
  endRoom(room, "ended_by_host");
  res.json({ ok: true });
});

// ── WebSocket attach (called from index.js upgrade handler) ──────────────────
export function attachLiveQuizSocket(request, ws) {
  const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);
  const m = pathname.match(/^\/api\/live-quiz\/([^/]+)\/ws$/);
  if (!m) return false;

  const ticketInfo = consumeTicket(searchParams.get("ticket"));
  if (!ticketInfo) return false;

  const room = getRoom(ticketInfo.sessionId);
  if (!room || room.phase === "ended") return false;

  const result = attachSocket(room, ticketInfo.userId, null, ws);
  if (!result.ok) return false;

  ws.on("message", (data) => {
    let parsed;
    try { parsed = JSON.parse(data.toString()); } catch { return; }
    try {
      handleMessage(room, ticketInfo.userId, parsed);
    } catch (err) {
      console.error("Live quiz message error:", err.message);
    }
  });

  ws.on("close", () => detachSocket(room, ticketInfo.userId));
  ws.on("error", () => detachSocket(room, ticketInfo.userId));
  return true;
}

export default router;
