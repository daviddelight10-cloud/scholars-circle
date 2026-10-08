import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { logSecurityEvent } from "../lib/logger.js";
import { generateTicket, consumeTicket } from "./voiceSession.js";
import {
  createRoom,
  getRoom,
  getRoomByCode,
  attachSocket,
  detachSocket,
  handleMessage,
  destroyRoom,
} from "../lib/osceRooms.js";

const router = Router();

function username(req) {
  return req.user?.username || req.user?.name || "Student";
}

// POST /api/osce-rooms — create a room. Body: { station } (case payload —
// travels inside the room, no DB storage needed).
router.post("/", requireAuth, async (req, res) => {
  try {
    const room = createRoom({
      hostId: req.user.sub,
      hostName: username(req),
      station: req.body?.station,
    });
    logSecurityEvent(req.user.sub, "osce_room_create", { roomId: room.id }, req);
    const ticket = generateTicket(room.id, req.user.sub);
    res.json({ roomId: room.id, code: room.code, ticket });
  } catch (err) {
    console.error("OSCE room create error:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// POST /api/osce-rooms/join — { code } → { roomId, ticket }
router.post("/join", requireAuth, async (req, res) => {
  const code = String(req.body?.code || "").toUpperCase().trim();
  const room = getRoomByCode(code);
  if (!room) return res.status(404).json({ error: "Room not found — check the PIN" });
  if (room.phase === "ended") return res.status(410).json({ error: "This room has ended" });
  const ticket = generateTicket(room.id, req.user.sub);
  res.json({ roomId: room.id, code: room.code, ticket });
});

// GET /api/osce-rooms/:id/state — lightweight preview (lobby join check)
router.get("/:id/state", requireAuth, async (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({
    roomId: room.id,
    code: room.code,
    phase: room.phase,
    stationTitle: room.station?.title || room.station?.cc || "OSCE station",
    memberCount: room.participants.size,
  });
});

// POST /api/osce-rooms/:id/ticket — fresh WS ticket for reconnection
router.post("/:id/ticket", requireAuth, async (req, res) => {
  const room = getRoom(req.params.id);
  if (!room || !room.participants.has(req.user.sub)) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json({ ticket: generateTicket(room.id, req.user.sub) });
});

// DELETE /api/osce-rooms/:id — host closes the room
router.delete("/:id", requireAuth, async (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.hostId !== req.user.sub) return res.status(403).json({ error: "Only the host can end the room" });
  destroyRoom(room.id);
  res.json({ ok: true });
});

// ── WebSocket attach — /api/osce-rooms/:id/ws?ticket=&name= ─────────────────
export function attachOsceSocket(request, ws) {
  const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);
  const m = pathname.match(/^\/api\/osce-rooms\/([^/]+)\/ws$/);
  if (!m) return false;

  const ticketInfo = consumeTicket(searchParams.get("ticket"));
  if (!ticketInfo) return false;

  const room = getRoom(ticketInfo.sessionId);
  if (!room || room.phase === "ended") return false;

  const name = String(searchParams.get("name") || "Student").slice(0, 40);
  const result = attachSocket(room, ticketInfo.userId, name, ws);
  if (!result.ok) {
    send(ws, { type: "error", message: result.error || "Could not join" });
    try { ws.close(); } catch {}
    return true; // handled — we responded before closing
  }

  ws.on("message", (data) => {
    if (data.length > 16384) return; // cap frame size
    let parsed;
    try { parsed = JSON.parse(data.toString()); } catch { return; }
    try {
      handleMessage(room, ticketInfo.userId, parsed);
    } catch (err) {
      console.error("OSCE room message error:", err.message);
    }
  });
  ws.on("close", () => detachSocket(room, ticketInfo.userId));
  ws.on("error", () => detachSocket(room, ticketInfo.userId));
  return true;
}

function send(ws, msg) {
  try { ws.send(JSON.stringify(msg)); } catch {}
}

export default router;
