import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import rateLimit from "express-rate-limit";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { generateTicket, consumeTicket } from "./voiceSession.js";
import {
  createRoom,
  getRoom,
  getRoomByCode,
  listRooms,
  registerParticipant,
  attachSocket,
  detachSocket,
  handleMessage,
  endRoom,
} from "../lib/liveQuizRooms.js";

const router = Router();

// Each create announces to the feed + pushes to followers — cap it so it
// can't be spammed. Keyed by user (falls back to IP pre-auth).
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: "Too many live sessions — try again in a bit" },
});

function userId(req) {
  return req.user.sub || req.user.id;
}

// Prefer the display name (what friends know them as) over the username handle.
async function displayNameFor(id, fallback) {
  try {
    const u = await prisma.user.findUnique({
      where: { id },
      select: { username: true, fullName: true },
    });
    return u?.fullName || u?.username || fallback || "Scholar";
  } catch {
    return fallback || "Scholar";
  }
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
router.post("/create", requireAuth, createLimiter, async (req, res) => {
  try {
    const { mcqResourceId, timePerQuestion, numQuestions } = req.body || {};
    if (!mcqResourceId) return res.status(400).json({ error: "mcqResourceId is required" });

    const mcq = await prisma.resource.findUnique({
      where: { id: mcqResourceId },
      select: {
        id: true, title: true, contentType: true, mcqData: true,
        sourceResourceId: true, status: true, uploadedBy: true,
        folder: { select: { deletedAt: true } },
        sourceResource: { select: { status: true } },
      },
    });
    if (!mcq) return res.status(404).json({ error: "MCQ resource not found" });
    if (mcq.contentType !== "mcq" || !mcq.mcqData) {
      return res.status(400).json({ error: "This resource has no MCQ questions" });
    }
    if (mcq.folder?.deletedAt) {
      return res.status(410).json({ error: "This material was deleted" });
    }
    // Anyone could previously host a room (serving every question + explanation)
    // from a resource id they shouldn't see. Hosting is allowed for the owner,
    // public/approved material, or a set derived from one — nothing else.
    const uid = userId(req);
    const allowed =
      mcq.uploadedBy === uid ||
      mcq.status === "approved" ||
      mcq.sourceResource?.status === "approved";
    if (mcq.status === "rejected" || !allowed) {
      return res.status(403).json({ error: "You can't go live with this material" });
    }

    const questions = normalizeMcqData(mcq.mcqData);
    if (questions.length === 0) {
      return res.status(400).json({ error: "This MCQ set is empty" });
    }

    const hostName = await displayNameFor(uid, req.user.username);
    const room = createRoom({
      hostId: uid,
      hostName,
      resourceId: mcq.sourceResourceId || null,
      mcqResourceId: mcq.id,
      title: mcq.title,
      questions: shuffle(questions),
      settings: { timePerQuestion, numQuestions },
    });
    registerParticipant(room, uid, hostName);

    const ticket = generateTicket(room.id, userId(req));
    res.json({
      roomId: room.id,
      code: room.code,
      ticket,
      title: room.title,
      questionCount: questions.length,
      maxQuestions: questions.length,
    });

    // Announce to the host's circle: feed post + follower push (best-effort)
    (async () => {
      try {
        const profile = await prisma.userProfile.findUnique({
          where: { userId: uid },
          select: { universityId: true },
        });
        await prisma.feedPost.create({
          data: {
            authorId: uid,
            kind: "activity",
            text: `went live with ${mcq.title} — ${questions.length} question${questions.length === 1 ? "" : "s"} ⚡`,
            resourceId: mcq.sourceResourceId || mcq.id,
            liveCode: room.code,
            universityId: profile?.universityId || null,
          },
        });
        const [host, followers] = await Promise.all([
          prisma.user.findUnique({ where: { id: uid }, select: { fullName: true, username: true } }),
          prisma.userFollow.findMany({
            where: { followingId: uid },
            select: { followerId: true },
            take: 200,
          }),
        ]);
        if (followers.length > 0) {
          const { sendPushToUsers } = await import("../lib/pushSender.js");
          await sendPushToUsers(
            followers.map((f) => f.followerId),
            {
              title: `${host?.fullName || host?.username || "A friend"} went live ⚡`,
              body: `${mcq.title} · ${questions.length} questions — tap to join`,
              tag: `quiz-${room.code}`,
              data: { tab: "discuss", liveCode: room.code },
            },
            { category: "social" }
          );
        }
      } catch (e) {
        console.warn("[live-quiz] announce failed:", e?.message);
      }
    })();
  } catch (err) {
    console.error("Live quiz create error:", err);
    res.status(500).json({ error: "Failed to create live session" });
  }
});

// GET /api/live-quiz/active — joinable quiz lobbies ("who's live now")
// NOTE: must be registered before /:code so "active" isn't treated as a code.
router.get("/active", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const out = [];
    for (const room of listRooms()) {
      if (room.phase !== "lobby" && room.phase !== "transition") continue;
      const connected = [...room.participants.values()].filter((p) => p.connected).length;
      const total = room.participants.size;
      if (total >= 8 && !room.participants.has(uid)) continue;
      const host = room.participants.get(room.hostId);
      out.push({
        code: room.code,
        title: room.title,
        host: host?.username || "Host",
        isHost: room.hostId === uid,
        isMember: room.participants.has(uid),
        players: total,
        connected,
        maxPlayers: 8,
        mcqResourceId: room.mcqResourceId || null,
        resourceId: room.resourceId || null,
        questions: Math.min(room.settings?.numQuestions || room.allQuestions?.length || 0, room.allQuestions?.length || 0),
        createdAt: room.createdAt,
      });
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    res.json(out.slice(0, 20));
  } catch (err) {
    console.error("Live quiz active error:", err);
    res.status(500).json({ error: "Failed to load live quizzes" });
  }
});

// GET /api/live-quiz/history — the caller's recent completed sessions
// NOTE: must be registered before /:code so "history" isn't treated as a code.
router.get("/history", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const rows = await prisma.liveQuizSession.findMany({
      where: {
        status: "complete",
        OR: [
          { hostId: uid },
          { results: { path: ["participantIds"], array_contains: uid } },
        ],
      },
      orderBy: { endedAt: "desc" },
      take: 10,
    });
    res.json(rows.map((s) => {
      const lb = Array.isArray(s.results?.leaderboard) ? s.results.leaderboard : [];
      const myIdx = lb.findIndex((e) => e.userId === uid);
      return {
        code: s.code,
        title: s.title,
        endedAt: s.endedAt,
        isHost: s.hostId === uid,
        players: lb.length || (s.results?.participantIds?.length ?? 0),
        winner: lb[0]?.username || null,
        myRank: myIdx >= 0 ? myIdx + 1 : null,
        myPoints: myIdx >= 0 ? lb[myIdx].points ?? null : null,
        totalQuestions: s.results?.totalQuestions ?? null,
      };
    }));
  } catch (err) {
    console.error("Live quiz history error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

// GET /api/live-quiz/:code — room preview for the invite landing. Public so an
// invitee without an account can see what they're joining before signing up.
router.get("/:code", optionalAuth, async (req, res) => {
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
      isMember: req.user ? room.participants.has(userId(req)) : false,
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
    if (room.kicked.has(uid)) {
      return res.status(403).json({ error: "You were removed from this session" });
    }
    if (!already && room.phase !== "lobby" && room.phase !== "transition") {
      return res.status(409).json({ error: "Session already in progress", phase: room.phase });
    }
    if (!already && room.participants.size >= 8) {
      return res.status(409).json({ error: "Room is full" });
    }
    const reg = registerParticipant(room, uid, await displayNameFor(uid, req.user.username));
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
    // Messages here are tiny (answers, 300-char chat) — cap the frame so a
    // hostile client can't make the server parse megabyte payloads.
    if (data.length > 8192) return;
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
