import crypto from "crypto";
import { WebSocket } from "ws";

// ── In-memory OSCE group-practice room manager ───────────────────────────────
// Same ephemeral model as liveQuizRooms: rooms live only in process memory,
// joined by 6-char PIN, sockets authenticated by the shared voice-session
// ticket store. The station case JSON travels inside the room so no DB table
// is needed — a room carries everything.

const rooms = new Map();      // roomId -> room
const roomByCode = new Map(); // code -> roomId

const MAX_PARTICIPANTS = 6;   // candidate + examiner + patient + 3 observers
const GRACE_MS = 30000;       // disconnect grace before a member is dropped
const ROOM_TTL_MS = 30 * 60 * 1000; // idle sweep
const MAX_TRANSCRIPT = 400;
const MAX_TEXT = 1500;
const ROLES = ["candidate", "examiner", "patient"]; // anything else = observer

const COLORS = ["#3B82F6", "#FF6B5E", "#F5C542", "#3DD68C", "#A78BFA", "#EC4899"];

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(msg)); } catch {}
  }
}

function broadcast(room, msg, exceptUserId = null) {
  for (const p of room.participants.values()) {
    if (p.userId === exceptUserId) continue;
    send(p.ws, msg);
  }
}

function pickColor(room) {
  const used = new Set([...room.participants.values()].map((p) => p.color));
  return COLORS.find((c) => !used.has(c)) || COLORS[room.participants.size % COLORS.length];
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function getRoomByCode(code) {
  const id = roomByCode.get(String(code || "").toUpperCase());
  return id ? rooms.get(id) : null;
}

// Role-player script is private — observers/candidate must never see the
// hidden facts, persona or agenda. Only examiner + human patient get it.
function publicStation(room, forRole) {
  const s = room.station;
  if (!s) return null;
  const base = {
    title: s.title || s.cc || "OSCE station",
    cc: s.cc,
    bed: s.bed,
    demo: s.demo,
    specialty: s.specialty,
    station_type: s.station_type || "history",
    candidate_instructions: s.candidate_instructions || null,
  };
  if (forRole === "examiner") {
    return {
      ...base,
      essential_points: s.essential_points || [],
      closing_points: s.closing_points || [],
      critical: s.critical || [],
      diagnosis: s.diagnosis,
      management_key: s.management_key || [],
      viva: s.viva || [],
    };
  }
  if (forRole === "patient") {
    // The human patient actor gets the full script to play from.
    return { ...base, script: s };
  }
  if (forRole === "observer") {
    // Observers watch with the mark scheme — checklist + critical flags, but
    // never the patient script, hidden findings or diagnosis.
    return {
      ...base,
      examKeys: Object.keys(s.exam || {}),
      essential_points: s.essential_points || [],
      closing_points: s.closing_points || [],
      critical: s.critical || [],
    };
  }
  // Candidate gets the exam menu (which exams exist) but never the findings —
  // those are released one at a time by the `exam`/`inv` message handlers.
  base.examKeys = Object.keys(s.exam || {});
  // When the room runs an AI patient, the CANDIDATE's client runs the persona
  // prompt locally and relays replies — it needs the script. The same data is
  // already client-side in solo mode, so this leaks nothing new.
  if (forRole === "candidate" && room.roles.patient === "ai") {
    base.script = s;
  }
  return base; // candidate + observers see the public brief only
}

function publicParticipant(room, p) {
  const role = Object.entries(room.roles).find(([, uid]) => uid === p.userId)?.[0] || "observer";
  return {
    userId: p.userId,
    username: p.username,
    color: p.color,
    connected: p.connected,
    role,
    isHost: p.userId === room.hostId,
  };
}

function roomState(room, forUserId) {
  const role = Object.entries(room.roles).find(([, uid]) => uid === forUserId)?.[0] || "observer";
  const state = {
    type: "room_state",
    roomId: room.id,
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    me: { userId: forUserId, role },
    roles: { ...room.roles },
    station: publicStation(room, role === "patient" && room.roles.patient === "ai" ? "observer" : role),
    participants: [...room.participants.values()].map((p) => publicParticipant(room, p)),
    transcript: room.transcript,
    ticks: room.ticks,
    tickCount: room.ticks.length,
    globalRating: room.globalRating,
    examinerNote: room.examinerNote,
    timerEndsAt: room.timerEndsAt,
    timerSec: room.timerSec,
    aiPatient: room.roles.patient === "ai",
  };
  // The transcript is visible to everyone, but each role filters differently:
  // candidate sees patient lines; observers see all. Stage directions are
  // already stripped client-side. Nothing private is ever in the transcript.
  return state;
}

function pushState(room) {
  for (const p of room.participants.values()) {
    if (p.connected) send(p.ws, roomState(room, p.userId));
  }
}

// Station payload sanity — keep it structured, never a free-form prompt.
function sanitizeStation(raw) {
  if (!raw || typeof raw !== "object") return null;
  const s = (v, n = 400) => (typeof v === "string" ? v.slice(0, n).trim() : "");
  const list = (v, n = 30, m = 400) =>
    Array.isArray(v) ? v.slice(0, n).map((x) => s(x, m)).filter(Boolean) : [];
  const kv = (v, max = 40) => {
    const out = {};
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v).slice(0, max)) {
        const kk = s(k, 60); const vv = s(val, 800);
        if (kk && vv) out[kk] = vv;
      }
    }
    return out;
  };
  const inv = {};
  if (raw.investigations && typeof raw.investigations === "object") {
    for (const [k, v] of Object.entries(raw.investigations).slice(0, 40)) {
      if (v && typeof v === "object") inv[s(k, 60)] = { result: s(v.result, 800), indicated: !!v.indicated };
    }
  }
  const st = {
    bed: s(raw.bed, 40), demo: s(raw.demo, 200), cc: s(raw.cc, 300),
    title: s(raw.title, 120),
    specialty: s(raw.specialty, 60),
    station_type: ["history", "counselling", "data"].includes(raw.station_type) ? raw.station_type : "history",
    candidate_instructions: s(raw.candidate_instructions, 600),
    persona: s(raw.persona, 600),
    history: kv(raw.history),
    exam: kv(raw.exam),
    investigations: inv,
    diagnosis: s(raw.diagnosis, 300),
    essential_points: list(raw.essential_points, 40),
    management_key: list(raw.management_key, 30),
    closing_points: list(raw.closing_points, 10),
    critical: Array.isArray(raw.critical) ? raw.critical.slice(0, 20).map((n) => (Number.isInteger(n) ? n : -1)).filter((n) => n >= 0) : [],
    viva: list(raw.viva, 10),
  };
  if (raw.hidden_agenda && typeof raw.hidden_agenda === "object") {
    const reveal = s(raw.hidden_agenda.reveal, 600);
    if (reveal) st.hidden_agenda = { reveal };
  }
  if (!st.cc && !st.title) return null;
  return st;
}

export function createRoom({ hostId, hostName, station }) {
  const code = generateCode();
  const room = {
    id: crypto.randomUUID(),
    code,
    hostId,
    station: sanitizeStation(station) || { title: "OSCE station", cc: "Custom station" },
    phase: "lobby", // lobby | station | debrief | ended
    roles: { candidate: null, examiner: null, patient: "ai" },
    participants: new Map(),
    transcript: [],
    ticks: [],
    globalRating: null,
    examinerNote: "",
    timerEndsAt: null,
    timerSec: 480,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(room.id, room);
  roomByCode.set(code, room.id);
  return room;
}

export function attachSocket(room, userId, username, ws) {
  if (room.phase === "ended") return { ok: false, error: "Room ended" };
  let p = room.participants.get(userId);
  if (!p) {
    if (room.participants.size >= MAX_PARTICIPANTS) return { ok: false, error: "Room is full" };
    p = { userId, username: username || "Student", color: pickColor(room), ws: null, connected: false, offlineTimer: null };
    room.participants.set(userId, p);
  }
  if (p.offlineTimer) { clearTimeout(p.offlineTimer); p.offlineTimer = null; }
  p.ws = ws;
  p.connected = true;
  if (username) p.username = username;
  send(ws, roomState(room, userId));
  broadcast(room, { type: "member_update", participants: [...room.participants.values()].map((x) => publicParticipant(room, x)) }, userId);
  return { ok: true };
}

function removeParticipant(room, userId) {
  const p = room.participants.get(userId);
  if (!p) return;
  room.participants.delete(userId);
  // Vacate a role the departed member held
  for (const role of ROLES) {
    if (room.roles[role] === userId) room.roles[role] = role === "patient" ? "ai" : null;
  }
  if (room.hostId === userId) {
    const next = room.participants.values().next().value;
    room.hostId = next ? next.userId : room.hostId;
  }
  if (room.participants.size === 0) destroyRoom(room.id);
  else pushState(room);
}

export function detachSocket(room, userId) {
  const p = room.participants.get(userId);
  if (!p) return;
  p.connected = false;
  p.ws = null;
  p.offlineTimer = setTimeout(() => removeParticipant(room, userId), GRACE_MS);
  broadcast(room, { type: "member_update", participants: [...room.participants.values()].map((x) => publicParticipant(room, x)) });
}

export function destroyRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  broadcast(room, { type: "room_closed" });
  for (const p of room.participants.values()) {
    if (p.offlineTimer) clearTimeout(p.offlineTimer);
    if (p.ws) { try { p.ws.close(); } catch {} }
  }
  rooms.delete(roomId);
  roomByCode.delete(room.code);
}

function requireRole(room, userId, role) {
  return room.roles[role] === userId;
}

export function handleMessage(room, userId, msg) {
  room.lastActivityAt = Date.now();
  const isHost = room.hostId === userId;

  switch (msg.type) {
    case "set_role": {
      if (!isHost) return;
      const role = String(msg.role || "");
      const uid = String(msg.userId || "");
      if (role === "patient" && msg.value === "ai") {
        room.roles.patient = "ai";
      } else if (ROLES.includes(role) && room.participants.has(uid)) {
        room.roles[role] = room.roles[role] === uid ? null : uid; // toggle
        // a user can hold only one role
        for (const r of ROLES) if (r !== role && room.roles[r] === uid) room.roles[r] = null;
      }
      pushState(room);
      return;
    }
    case "set_station": {
      if (!isHost || room.phase !== "lobby") return;
      const st = sanitizeStation(msg.station);
      if (!st) return send(room.participants.get(userId)?.ws, { type: "error", message: "Invalid station" });
      room.station = st;
      pushState(room);
      return;
    }
    case "set_timer": {
      if (!isHost || room.phase !== "lobby") return;
      const sec = Math.max(60, Math.min(900, Number(msg.timerSec) || 480));
      room.timerSec = sec;
      pushState(room);
      return;
    }
    case "start_station": {
      if (!isHost || room.phase === "ended") return;
      if (!room.roles.candidate) return send(room.participants.get(userId)?.ws, { type: "error", message: "Assign a candidate first" });
      room.phase = "station";
      room.transcript = [];
      room.ticks = [];
      room.globalRating = null;
      room.examinerNote = "";
      room.timerEndsAt = Date.now() + room.timerSec * 1000;
      room.stationTimerId = setTimeout(() => {
        if (room.phase === "station") {
          room.phase = "debrief";
          room.timerEndsAt = null;
          pushState(room);
          broadcast(room, { type: "bell" });
        }
      }, room.timerSec * 1000);
      pushState(room);
      broadcast(room, { type: "bell" });
      return;
    }
    case "end_station": {
      if (!isHost && !requireRole(room, userId, "examiner")) return;
      if (room.stationTimerId) { clearTimeout(room.stationTimerId); room.stationTimerId = null; }
      room.phase = "debrief";
      room.timerEndsAt = null;
      pushState(room);
      broadcast(room, { type: "bell" });
      return;
    }
    case "back_to_lobby": {
      if (!isHost) return;
      room.phase = "lobby";
      room.timerEndsAt = null;
      pushState(room);
      return;
    }
    case "say": {
      if (room.phase !== "station") return;
      const text = String(msg.text || "").slice(0, MAX_TEXT).trim();
      if (!text) return;
      let role = null;
      if (requireRole(room, userId, "candidate")) role = "doc";
      else if (requireRole(room, userId, "patient")) role = "pt";
      else if (requireRole(room, userId, "examiner") && msg.role === "ex") role = "ex";
      if (!role) return;
      const line = { role, from: userId, text, ts: Date.now() };
      room.transcript.push(line);
      if (room.transcript.length > MAX_TRANSCRIPT) room.transcript.shift();
      broadcast(room, { type: "say", line });
      return;
    }
    case "exam":
    case "inv": {
      // Candidate taps an exam/investigation — the server holds the findings,
      // so the action line + result get broadcast without leaking the case.
      if (room.phase !== "station" || !requireRole(room, userId, "candidate")) return;
      const key = String(msg.key || msg.label || "").slice(0, 60).trim();
      const label = String(msg.label || key).slice(0, 80).trim();
      if (!key) return;
      let result, lowYield = false;
      if (msg.type === "exam") {
        result = room.station.exam?.[key] || "Nothing significant found on this examination.";
      } else {
        const entry = room.station.investigations?.[key.toLowerCase()];
        result = entry ? entry.result : "Result within normal limits — low diagnostic yield for this presentation.";
        lowYield = !(entry && entry.indicated);
      }
      const action = { role: "doc", from: userId, text: `[${msg.type === "exam" ? "Examines" : "Orders"}: ${label}]`, ts: Date.now() };
      const finding = { role: "sys", from: "station", text: result, lowYield, ts: Date.now() + 1 };
      room.transcript.push(action, finding);
      if (room.transcript.length > MAX_TRANSCRIPT) room.transcript = room.transcript.slice(-MAX_TRANSCRIPT);
      broadcast(room, { type: "say", line: action });
      broadcast(room, { type: "say", line: finding });
      return;
    }
    case "ai_reply": {
      // The candidate's client runs the AI patient and relays its reply so
      // everyone (examiner/observers) sees it. Only valid while patient=ai.
      if (room.roles.patient !== "ai" || !requireRole(room, userId, "candidate") || room.phase !== "station") return;
      const text = String(msg.text || "").slice(0, MAX_TEXT).trim();
      if (!text) return;
      const line = { role: "pt", from: "ai", text, ts: Date.now() };
      room.transcript.push(line);
      if (room.transcript.length > MAX_TRANSCRIPT) room.transcript.shift();
      broadcast(room, { type: "say", line });
      return;
    }
    case "tick": {
      if (!requireRole(room, userId, "examiner") || room.phase !== "station") return;
      const idx = Number(msg.idx);
      const n = (room.station.essential_points || []).length + (room.station.closing_points || []).length;
      if (!Number.isInteger(idx) || idx < 0 || idx >= n) return;
      if (msg.on) {
        if (!room.ticks.includes(idx)) room.ticks.push(idx);
      } else {
        room.ticks = room.ticks.filter((i) => i !== idx);
      }
      broadcast(room, { type: "tick", idx, on: !!msg.on });
      return;
    }
    case "global_rating": {
      if (!requireRole(room, userId, "examiner")) return;
      const r = ["clear_pass", "borderline", "fail"].includes(msg.rating) ? msg.rating : null;
      room.globalRating = r;
      broadcast(room, { type: "global_rating", rating: r });
      return;
    }
    case "examiner_note": {
      if (!requireRole(room, userId, "examiner")) return;
      room.examinerNote = String(msg.text || "").slice(0, 1200);
      broadcast(room, { type: "examiner_note", text: room.examinerNote });
      return;
    }
    case "leave_room": {
      // Explicit leave — skip the disconnect grace so a departing host
      // migrates immediately instead of freezing the lobby for 30s.
      const p = room.participants.get(userId);
      if (p?.offlineTimer) { clearTimeout(p.offlineTimer); p.offlineTimer = null; }
      removeParticipant(room, userId);
      return;
    }
    case "end_room": {
      if (!isHost) return;
      destroyRoom(room.id);
      return;
    }
    default:
      return;
  }
}

// Idle-room sweeper — drop empty/dead rooms so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    const stale = now - room.lastActivityAt > ROOM_TTL_MS;
    if (stale || (room.participants.size === 0 && now - room.createdAt > GRACE_MS)) {
      rooms.delete(id);
      roomByCode.delete(room.code);
    }
  }
}, 60000).unref?.();
