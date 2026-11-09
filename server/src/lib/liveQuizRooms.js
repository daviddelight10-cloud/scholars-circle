import crypto from "crypto";
import { WebSocket } from "ws";
import { prisma } from "../db.js";
import { addLeagueXP, awardBadge } from "./badges.js";
import { updateUniversalStreak } from "./streak.js";
import { finalizeBattle, cancelBattle, teamPoints } from "./battles.js";

// ── In-memory live-quiz room manager ─────────────────────────────────────────
// Live room state is ephemeral (like voice sessions); a LiveQuizSession DB row
// is written on create/complete for history + XP auditing.

const rooms = new Map(); // roomId -> room
const roomByCode = new Map(); // code -> roomId

export const MAX_PARTICIPANTS = 50;
const TRANSITION_MS = 2500;
const READY_FALLBACK_MS = 25000;
const TEACHBACK_MS = 45000;
const GRACE_MS = 30000;
const ROOM_TTL_MS = 5 * 60 * 1000; // keep finished rooms briefly for reconnects
const XP_PER_CORRECT = 20;
const XP_TEACHBACK = 50;
const XP_WAGER = 30;
// Leaderboard points — correctness + speed + confidence calibration.
// Correct: 100 base + up to 50 by remaining time + 20 for High confidence.
// Wrong on High confidence: −20. Running total never drops below 0.
const PTS_CORRECT = 100;
const PTS_SPEED_MAX = 50;
const PTS_CONFIDENCE = 20;
// Difficulty weighting (generated MCQs carry `difficulty`): the multiplier
// scales only the correctness component — speed/confidence stay comparable.
const DIFF_MULTIPLIERS = { easy: 0.8, medium: 1, hard: 1.25 };
const CLUTCH_WINDOW_MS = 5000; // correct locks inside the final 5s count for "The Clutch"
const MSG_RATE_LIMIT = 15;     // any message type
const MSG_RATE_WINDOW_MS = 2000;
const CHAT_RATE_LIMIT = 6;     // chat is stricter — it's stored + broadcast
const CHAT_RATE_WINDOW_MS = 5000;

const COLORS = [
  "#3B82F6", "#FF6B5E", "#F5C542", "#3DD68C", "#A78BFA", "#EC4899", "#14B8A6", "#F97316",
  "#60A5FA", "#FB7185", "#FACC15", "#34D399", "#C084FC", "#F472B6", "#2DD4BF", "#FDBA74",
];
const EMOJI_ALLOWED = new Set(["💡", "🔥", "👏", "❤️", "😂", "🎉"]);

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function getRoomByCode(code) {
  const id = roomByCode.get(String(code || "").toUpperCase());
  return id ? rooms.get(id) : null;
}

export function listRooms() {
  return rooms.values();
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

function pickColor(room) {
  const used = new Set([...room.participants.values()].map((p) => p.color));
  return COLORS.find((c) => !used.has(c)) || COLORS[room.participants.size % COLORS.length];
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

function connectedParticipants(room) {
  return [...room.participants.values()].filter((p) => p.connected && !p.left);
}

// Players who actually compete: connected, not spectating, and not the host
// while they're presenting. Answers, ready checks, streaks and leaderboards
// all use this — spectators and the presenting host are never counted.
function activePlayers(room) {
  return connectedParticipants(room).filter(
    (p) => !p.spectator && !(p.userId === room.hostId && room.presenterMode)
  );
}

// Difficulty multiplier for a question — generated MCQs carry easy/medium/hard;
// anything else (or absent) plays at 1×.
export function difficultyMultiplier(q) {
  const d = String(q?.difficulty || "").toLowerCase();
  return DIFF_MULTIPLIERS[d] || 1;
}

// Group battles: room.battle = { id, mode, a:{classroomId,name,lineup:[ids]},
// b:{...} }. Lineups can differ in size — each side's score is the average
// leaderboard points of its members who answered (see teamPoints in battles.js).
function battleTeam(room, userId) {
  if (!room.battle) return null;
  if (room.battle.a.lineup.includes(userId)) return "a";
  if (room.battle.b.lineup.includes(userId)) return "b";
  return null;
}

// Live team scoreline — same per-participant average as finalizeBattle uses,
// so the in-room leader never disagrees with the official result.
function teamScores(room) {
  const s = { a: 0, b: 0 };
  if (!room.battle) return s;
  const t = { a: { total: 0, n: 0 }, b: { total: 0, n: 0 } };
  for (const p of room.participants.values()) {
    const side = p.team === "a" ? t.a : p.team === "b" ? t.b : null;
    if (!side || !(p.stats?.answered > 0)) continue;
    side.total += p.points || 0;
    side.n += 1;
  }
  s.a = t.a.n ? Math.round(t.a.total / t.a.n) : 0;
  s.b = t.b.n ? Math.round(t.b.total / t.b.n) : 0;
  return s;
}

function publicParticipant(p) {
  return {
    userId: p.userId,
    username: p.username,
    avatar: p.avatar || null,
    color: p.color,
    connected: p.connected,
    lobbyReady: p.lobbyReady,
    score: p.score,
    points: p.points || 0,
    team: p.team || null,
    spectator: !!p.spectator,
    isHost: false, // filled by caller
  };
}

function publicParticipants(room) {
  return [...room.participants.values()]
    .filter((p) => !p.left) // deliberate leavers drop off the visible list; they reappear on rejoin
    .map((p) => ({
      ...publicParticipant(p),
      isHost: p.userId === room.hostId,
    }));
}

// ── Room lifecycle ───────────────────────────────────────────────────────────

export function createRoom({ hostId, hostName, resourceId, mcqResourceId, title, questions, settings, battle }) {
  const code = generateCode();
  const room = {
    id: crypto.randomUUID(),
    code,
    hostId,
    title: title || "Live Quiz",
    resourceId: resourceId || null,
    mcqResourceId: mcqResourceId || null,
    allQuestions: questions, // full shuffled pool from mcqData
    settings: {
      timePerQuestion: settings?.timePerQuestion || 30,
      numQuestions: Math.min(settings?.numQuestions || 5, questions.length),
    },
    phase: "lobby",
    participants: new Map(),
    qIndex: -1,
    questions: [], // sliced at start
    answers: new Map(), // userId -> { option, confidence, timeMs, correct }
    readySet: new Set(),
    wagers: new Map(), // userId -> bool (accepted for current q)
    wagerEligible: new Set(), // userIds eligible this question
    prevCorrect: new Set(), // userIds correct on previous question
    lifelineUsed: new Set(),
    teachBack: null, // { teacherId, text }
    xp: new Map(), // userId -> session xp
    pointsDelta: {}, // userId -> points earned this question (for reveal)
    kicked: new Set(), // userIds removed by the host — cannot rejoin
    micOpen: false, // false = mics auto-muted during question phase
    presenterMode: false, // host presents instead of playing
    groupStreak: 0,
    talkedThrough: 0,
    timerId: null,
    phaseDeadline: null,
    chatLog: [],
    dbId: null,
    createdAt: Date.now(),
    emptySince: null,
    battle: battle || null, // group-vs-group mode — see lib/battles.js
  };
  rooms.set(room.id, room);
  roomByCode.set(code, room.id);
  return room;
}

export function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.timerId) clearTimeout(room.timerId);
  roomByCode.delete(room.code);
  rooms.delete(roomId);
}

// ── Snapshots ────────────────────────────────────────────────────────────────

function currentQuestionPayload(room, forUserId) {
  const q = room.questions[room.qIndex];
  if (!q) return null;
  return {
    index: room.qIndex,
    total: room.questions.length,
    qLabel: `QUESTION ${room.qIndex + 1} OF ${room.questions.length}`,
    question: q.question,
    options: q.options, // {A,B,C,D} text only — no correct/explanation until reveal
    deadline: room.phaseDeadline,
    timeLimit: room.settings.timePerQuestion,
    serverNow: Date.now(),
    lockedCount: room.answers.size,
    lockedIds: [...room.answers.keys()],
    totalCount: activePlayers(room).length,
    wagerEligible: room.wagerEligible.has(forUserId),
    wagerActive: room.wagers.get(forUserId) === true,
    lifelineUsed: room.lifelineUsed.has(forUserId),
    answered: room.answers.has(forUserId)
      ? { option: room.answers.get(forUserId).option, confidence: room.answers.get(forUserId).confidence }
      : null,
  };
}

// Live answer distribution for the presenting host — per-option counts only,
// never names, and never sent to anyone but the host socket.
function hostTally(room) {
  const tally = { A: 0, B: 0, C: 0, D: 0 };
  for (const a of room.answers.values()) tally[a.option] = (tally[a.option] || 0) + 1;
  const host = room.participants.get(room.hostId);
  send(host?.ws, { type: "host_tally", tally, locked: room.answers.size, total: activePlayers(room).length });
}

function buildSnapshot(room, forUserId) {
  const snap = {
    type: "room_state",
    roomId: room.id,
    code: room.code,
    title: room.title,
    phase: room.phase,
    isHost: forUserId === room.hostId,
    mySpectator: !!room.participants.get(forUserId)?.spectator,
    presenterMode: room.presenterMode,
    settings: room.settings,
    maxQuestions: room.allQuestions.length,
    poolSize: room.allQuestions.length,
    maxParticipants: MAX_PARTICIPANTS,
    participants: publicParticipants(room),
    talkedThrough: room.talkedThrough,
    groupStreak: room.groupStreak,
    micOpen: room.micOpen,
    chatLog: room.chatLog.slice(-50),
    serverNow: Date.now(),
  };
  if (room.phase === "question" || room.phase === "reveal" || room.phase === "teachback") {
    snap.question = currentQuestionPayload(room, forUserId);
  }
  if (room.phase === "reveal" || room.phase === "teachback") {
    snap.reveal = buildRevealPayload(room);
    snap.ready = { ready: [...room.readySet], needed: activePlayers(room).map((p) => p.userId) };
  }
  if (room.phase === "teachback") {
    snap.teachBack = { teacherId: room.teachBack?.teacherId, text: room.teachBack?.text || null };
  }
  if (room.phase === "complete") {
    snap.complete = room.results;
  }
  if (room.battle) {
    snap.battle = {
      id: room.battle.id,
      mode: room.battle.mode,
      myTeam: battleTeam(room, forUserId),
      a: { id: room.battle.a.classroomId, name: room.battle.a.name, lineup: room.battle.a.lineup },
      b: { id: room.battle.b.classroomId, name: room.battle.b.name, lineup: room.battle.b.lineup },
      scores: teamScores(room),
    };
  }
  return snap;
}

// ── Lobby handlers ───────────────────────────────────────────────────────────

function freshStats() {
  return {
    times: [], correct: 0, lucky: 0, clutch: 0, answered: 0,
    // confidence calibration: [correct, wrong] per level — powers the end-of-session summary
    conf: { High: [0, 0], Medium: [0, 0], Low: [0, 0] },
  };
}

export function registerParticipant(room, userId, username, avatar, opts = {}) {
  if (room.kicked.has(userId)) return { ok: false, error: "You were removed from this session" };
  // Battle rooms are locked to the two lineups — no spectators, no ring-ins.
  let team = null;
  if (room.battle) {
    team = battleTeam(room, userId);
    if (!team) return { ok: false, error: "Only lineup members can join this battle" };
  }
  let p = room.participants.get(userId);
  if (p) {
    if (username && p.username === "Scholar") p.username = username;
    if (avatar && avatar !== p.avatar) p.avatar = avatar;
    p.left = false; // deliberate leaver coming back — seat and score restored
    return { ok: true, participant: p };
  }
  // Capacity counts players only — spectators don't consume a seat.
  const seats = [...room.participants.values()].filter((x) => !x.left && !x.spectator).length;
  const wantsSeat = !opts.spectator;
  if (wantsSeat && seats >= MAX_PARTICIPANTS) return { ok: false, error: "Room is full" };
  p = {
    userId,
    username: username || "Scholar",
    avatar: avatar || null,
    color: pickColor(room),
    ws: null,
    connected: false,
    connectedAt: 0,
    spectator: !!opts.spectator && !room.battle,
    left: false,
    lobbyReady: userId === room.hostId,
    score: 0,
    points: 0,
    team,
    stats: freshStats(),
    graceTimerId: null,
    rl: null, // per-socket rate-limit buckets, filled on first message
  };
  room.participants.set(userId, p);
  broadcast(room, { type: "lobby_state", participants: publicParticipants(room) });
  return { ok: true, participant: p };
}

export function attachSocket(room, userId, username, ws) {
  if (room.kicked.has(userId)) return { ok: false, error: "You were removed from this session" };
  let p = room.participants.get(userId);
  if (!p) {
    const reg = registerParticipant(room, userId, username);
    if (!reg.ok) return reg;
    p = reg.participant;
  }
  if (p.graceTimerId) {
    clearTimeout(p.graceTimerId);
    p.graceTimerId = null;
  }
  p.ws = ws;
  p.connected = true;
  p.connectedAt = Date.now();
  p.left = false;
  room.emptySince = null;

  send(ws, buildSnapshot(room, userId));
  broadcast(room, { type: "player_joined", participants: publicParticipants(room) }, userId);
  // A rejoin mid-question shouldn't extend the deadline, but may unblock reveal/ready
  checkQuestionDone(room);
  checkReadyDone(room);
  return { ok: true, participant: p };
}

export function detachSocket(room, userId) {
  const p = room.participants.get(userId);
  if (!p) return;
  p.connected = false;
  p.ws = null;
  broadcast(room, { type: "player_left", participants: publicParticipants(room) });

  if (connectedParticipants(room).length === 0) {
    room.emptySince = Date.now();
  }
  // No auto host-transfer: a disconnected host keeps the crown until they
  // return or deliberately quit (which ends the room). The room simply waits.
  // Don't let a disconnect stall the room
  checkQuestionDone(room);
  checkReadyDone(room);
}

// Token-bucket throttle per participant — chat is stricter because messages
// persist to chatLog and broadcast to every socket.
function rateOk(p, kind) {
  const now = Date.now();
  if (!p.rl) p.rl = {};
  const [limit, win] = kind === "chat" ? [CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS] : [MSG_RATE_LIMIT, MSG_RATE_WINDOW_MS];
  const b = p.rl[kind] || (p.rl[kind] = { t: now, n: 0 });
  if (now - b.t > win) { b.t = now; b.n = 0; }
  return ++b.n <= limit;
}

export function handleMessage(room, userId, msg) {
  const p = room.participants.get(userId);
  if (!p || !p.connected) return;
  const isHost = userId === room.hostId;
  if (!rateOk(p, "any")) return;

  switch (msg.type) {
    case "ping":
      send(p.ws, { type: "pong", t: msg.t });
      return;
    case "lobby_ready":
      if (room.phase !== "lobby" || p.spectator) return;
      p.lobbyReady = !!msg.ready;
      broadcast(room, { type: "lobby_state", participants: publicParticipants(room) });
      return;
    case "settings":
      // Battle terms were agreed in the challenge — no mid-lobby tweaking.
      if (room.phase !== "lobby" || !isHost || room.battle) return;
      applySettings(room, msg);
      broadcast(room, { type: "lobby_state", participants: publicParticipants(room), settings: room.settings });
      return;
    case "presenter": {
      // Host presents instead of playing — toggling mid-run is allowed
      // between questions (lobby/reveal), not while answers are live.
      if (!isHost || room.battle) return;
      if (room.phase !== "lobby" && room.phase !== "reveal") return;
      room.presenterMode = !!msg.on;
      broadcast(room, { type: "presenter_mode", on: room.presenterMode });
      return;
    }
    case "force_advance":
      // Host skips the ready wait (reveal lingers when someone idles).
      if (!isHost || room.phase !== "reveal") return;
      if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }
      advance(room);
      return;
    case "pause": {
      if (!isHost || room.phase !== "question" || room.paused) return;
      room.paused = true;
      room.pausedRemainingMs = Math.max(0, room.phaseDeadline - Date.now());
      if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }
      broadcast(room, { type: "question_paused", remainingMs: room.pausedRemainingMs });
      return;
    }
    case "resume": {
      if (!isHost || room.phase !== "question" || !room.paused) return;
      room.paused = false;
      room.phaseDeadline = Date.now() + (room.pausedRemainingMs || 0);
      scheduleTimer(room, room.pausedRemainingMs || 0, () => revealQuestion(room));
      broadcast(room, { type: "question_resumed", deadline: room.phaseDeadline });
      return;
    }
    case "spectator_join": {
      // Late joiner flips from watching to playing (not in battles).
      if (!p.spectator || room.battle) return;
      const seats = [...room.participants.values()].filter((x) => !x.left && !x.spectator).length;
      if (seats >= MAX_PARTICIPANTS) {
        send(p.ws, { type: "spectator_denied", reason: "Room is full" });
        return;
      }
      p.spectator = false;
      p.lobbyReady = false;
      send(p.ws, buildSnapshot(room, userId));
      broadcast(room, { type: "player_joined", participants: publicParticipants(room) }, userId);
      return;
    }
    case "start":
      // Battle rooms have no lobby host duties — any connected lineup member
      // can kick off once everyone's in.
      if (room.phase !== "lobby" || (!isHost && !room.battle)) return;
      startSession(room);
      return;
    case "answer":
      handleAnswer(room, p, msg);
      return;
    case "wager":
      if (room.phase !== "question" || !room.wagerEligible.has(userId)) return;
      room.wagers.set(userId, !!msg.accept);
      send(p.ws, { type: "wager_ack", accepted: !!msg.accept });
      return;
    case "use_lifeline":
      handleLifeline(room, p);
      return;
    case "teachback":
      handleTeachBack(room, p, msg);
      return;
    case "ready_next":
      if (room.phase !== "reveal" && room.phase !== "teachback") return;
      if (room.phase === "teachback" && !room.teachBack?.resolved) return;
      room.readySet.add(userId);
      broadcast(room, {
        type: "ready_update",
        ready: [...room.readySet],
        needed: connectedParticipants(room).map((x) => x.userId),
      });
      checkReadyDone(room);
      return;
    case "chat":
      if (!rateOk(p, "chat")) return;
      handleChat(room, p, msg);
      return;
    case "reaction": {
      const emoji = String(msg.emoji || "").slice(0, 8);
      if (!EMOJI_ALLOWED.has(emoji)) return;
      broadcast(room, { type: "reaction", userId, emoji });
      return;
    }
    case "force_reveal":
      if (!isHost || room.phase !== "question") return;
      if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }
      revealQuestion(room);
      return;
    case "kick": {
      if (!isHost || msg.userId === room.hostId) return;
      const target = room.participants.get(msg.userId);
      if (!target) return;
      room.kicked.add(msg.userId);
      send(target.ws, { type: "session_ended", reason: "kicked" });
      try { target.ws?.close(); } catch {}
      detachSocket(room, msg.userId);
      // Free the seat — a kicked player shouldn't hold one of the 8 slots
      // or linger as a greyed-out avatar.
      room.participants.delete(msg.userId);
      room.answers.delete(msg.userId);
      room.readySet.delete(msg.userId);
      broadcast(room, { type: "player_left", participants: publicParticipants(room) });
      checkQuestionDone(room);
      checkReadyDone(room);
      return;
    }
    case "transfer_host": {
      if (!isHost) return;
      const target = room.participants.get(msg.userId);
      if (!target || !target.connected || msg.userId === room.hostId) return;
      room.hostId = msg.userId;
      target.lobbyReady = true;
      broadcast(room, { type: "host_changed", hostId: room.hostId, name: target.username });
      broadcast(room, { type: "lobby_state", participants: publicParticipants(room) });
      return;
    }
    case "mic_mode":
      if (!isHost) return;
      room.micOpen = !!msg.open;
      broadcast(room, { type: "mic_mode", open: room.micOpen });
      return;
    case "back_to_lobby":
      if (room.phase !== "complete") return;
      backToLobby(room);
      return;
    case "leave":
      // Deliberate leave: free the seat (scores are kept — rejoin restores).
      p.left = true;
      detachSocket(room, userId);
      return;
    case "end":
      if (!isHost) return;
      endRoom(room, "ended_by_host");
      return;
    default:
      return;
  }
}

function applySettings(room, msg) {
  const t = parseInt(msg.timePerQuestion, 10);
  const n = parseInt(msg.numQuestions, 10);
  if ([15, 20, 30, 45, 60].includes(t)) room.settings.timePerQuestion = t;
  if (n >= 1 && n <= room.allQuestions.length) {
    room.settings.numQuestions = n;
  }
}

// ── Session flow ─────────────────────────────────────────────────────────────

function startSession(room) {
  room.questions = room.allQuestions.slice(0, room.settings.numQuestions);
  room.qIndex = -1;
  room.phase = "transition";
  room.startedAt = Date.now();
  persistSession(room, "live").catch(() => {});
  broadcast(room, { type: "phase", phase: "transition", nextIndex: 0 });
  scheduleTimer(room, TRANSITION_MS, () => openQuestion(room));
}

function openQuestion(room) {
  room.qIndex++;
  if (room.qIndex >= room.questions.length) return completeSession(room);

  room.phase = "question";
  room.answers = new Map();
  room.readySet = new Set();
  room.wagers = new Map();
  room.wagerEligible = new Set(room.prevCorrect); // correct on previous q → eligible to wager
  room.teachBack = null;
  room.pointsDelta = {};
  room.paused = false;
  room.pausedRemainingMs = 0;
  room.phaseDeadline = Date.now() + room.settings.timePerQuestion * 1000;
  room.talkedThrough = room.qIndex;

  for (const p of room.participants.values()) {
    if (!p.connected) continue;
    send(p.ws, { type: "question", ...currentQuestionPayload(room, p.userId) });
  }
  if (room.presenterMode) hostTally(room); // reset the host's distribution bars
  scheduleTimer(room, room.settings.timePerQuestion * 1000, () => revealQuestion(room));
}

function handleAnswer(room, p, msg) {
  if (room.phase !== "question" || room.answers.has(p.userId)) return;
  // Spectators and the presenting host don't play.
  if (p.spectator || (room.presenterMode && p.userId === room.hostId)) return;
  const option = String(msg.option || "").toUpperCase();
  if (!["A", "B", "C", "D"].includes(option)) return;
  const confidence = ["Low", "Medium", "High"].includes(msg.confidence) ? msg.confidence : null;
  if (!confidence) return;

  const q = room.questions[room.qIndex];
  const limitMs = room.settings.timePerQuestion * 1000;
  const timeMs = Math.max(0, limitMs - (room.phaseDeadline - Date.now()));
  const correct = option === q.correct;
  room.answers.set(p.userId, { option, confidence, timeMs, correct });

  // Leaderboard points: correctness (difficulty-weighted) + speed bonus +
  // confidence calibration.
  const speedFrac = Math.max(0, Math.min(1, 1 - timeMs / limitMs));
  const mult = difficultyMultiplier(q);
  let delta = 0;
  if (correct) {
    delta = Math.round(PTS_CORRECT * mult) + Math.round(PTS_SPEED_MAX * speedFrac) + (confidence === "High" ? PTS_CONFIDENCE : 0);
  } else if (confidence === "High") {
    delta = -PTS_CONFIDENCE;
  }
  p.points = Math.max(0, (p.points || 0) + delta);
  room.pointsDelta[p.userId] = delta;

  p.stats.times.push(timeMs / 1000);
  p.stats.answered++;
  p.stats.conf[confidence][correct ? 0 : 1]++;
  // XP is a social reward — solo rooms keep points but earn no XP, otherwise
  // a lone host could farm by answering alone (same rule as teach-back).
  const social = room.participants.size > 1;
  if (correct) {
    p.stats.correct++;
    if (social) addXp(room, p.userId, XP_PER_CORRECT);
    if (confidence === "Low") p.stats.lucky++;
    if (timeMs >= limitMs - CLUTCH_WINDOW_MS) p.stats.clutch++;
    if (social && room.wagers.get(p.userId) === true) addXp(room, p.userId, XP_WAGER);
  } else if (social && room.wagers.get(p.userId) === true) {
    addXp(room, p.userId, -XP_WAGER);
  }
  p.score += correct ? 1 : 0;

  broadcast(room, {
    type: "lock_update",
    locked: room.answers.size,
    total: activePlayers(room).length,
    ids: [...room.answers.keys()],
  });
  if (room.presenterMode) hostTally(room);
  checkQuestionDone(room);
}

function checkQuestionDone(room) {
  if (room.phase !== "question") return;
  const players = activePlayers(room);
  if (players.length > 0 && room.answers.size >= players.length) {
    if (room.timerId) clearTimeout(room.timerId);
    room.timerId = null;
    revealQuestion(room);
  }
}

function addXp(room, userId, amount) {
  room.xp.set(userId, (room.xp.get(userId) || 0) + amount);
}

function buildRevealPayload(room) {
  const q = room.questions[room.qIndex];
  const picks = {};
  for (const [userId, a] of room.answers) {
    picks[userId] = { option: a.option, confidence: a.confidence, correct: a.correct, timeMs: a.timeMs };
  }
  const scores = {};
  const xpEarned = {};
  const points = {};
  for (const p of room.participants.values()) {
    scores[p.userId] = p.score;
    xpEarned[p.userId] = room.xp.get(p.userId) || 0;
    points[p.userId] = p.points || 0;
  }
  const numCorrect = [...room.answers.values()].filter((a) => a.correct).length;
  const soleCorrect = numCorrect === 1
    ? [...room.answers.entries()].find(([, a]) => a.correct)?.[0] || null
    : null;
  return {
    index: room.qIndex,
    total: room.questions.length,
    correct: q.correct,
    explanation: q.explanation || "",
    difficultyMult: difficultyMultiplier(q),
    picks,
    scores,
    xpEarned,
    points,
    pointsDelta: { ...room.pointsDelta },
    numCorrect,
    soleCorrectId: soleCorrect,
    groupStreak: room.groupStreak,
    ...(room.battle ? { teams: teamScores(room) } : {}),
  };
}

function revealQuestion(room) {
  if (room.phase !== "question") return;
  const q = room.questions[room.qIndex];
  const players = activePlayers(room);
  const allCorrect =
    players.length > 0 &&
    players.every((p) => room.answers.get(p.userId)?.correct === true);
  room.groupStreak = allCorrect ? room.groupStreak + 1 : 0;
  room.prevCorrect = new Set(
    [...room.answers.entries()].filter(([, a]) => a.correct).map(([uid]) => uid)
  );
  room.talkedThrough = room.qIndex + 1;
  room.phase = "reveal";

  const soleCorrect = buildRevealPayload(room).soleCorrectId;

  broadcast(room, { type: "reveal", ...buildRevealPayload(room) });

  if (soleCorrect && room.participants.get(soleCorrect)?.connected) {
    room.phase = "teachback";
    room.teachBack = { teacherId: soleCorrect, text: null, resolved: false };
    room.phaseDeadline = Date.now() + TEACHBACK_MS;
    broadcast(room, {
      type: "teachback_prompt",
      teacherId: soleCorrect,
      teacherName: room.participants.get(soleCorrect)?.username,
      deadline: room.phaseDeadline,
    });
    scheduleTimer(room, TEACHBACK_MS, () => resolveTeachBack(room, null));
  } else {
    startReadyCheck(room);
  }
}

function handleTeachBack(room, p, msg) {
  if (room.phase !== "teachback" || room.teachBack?.resolved) return;
  if (p.userId !== room.teachBack.teacherId) return;
  const text = String(msg.text || "").slice(0, 1000);
  resolveTeachBack(room, text.trim().length >= 5 ? text.trim() : null);
}

function resolveTeachBack(room, text) {
  if (room.phase !== "teachback" || !room.teachBack || room.teachBack.resolved) return;
  room.teachBack.resolved = true;
  room.teachBack.text = text;
  const teacher = room.participants.get(room.teachBack.teacherId);
  // Teach-back XP is a social reward — a solo host could otherwise farm +50
  // XP per question by typing 5 characters to themselves.
  const social = room.participants.size > 1;
  if (text) {
    if (social) {
      addXp(room, room.teachBack.teacherId, XP_TEACHBACK);
      awardBadge(room.teachBack.teacherId, "live_teacher").catch(() => {});
    }
    broadcast(room, {
      type: "teachback",
      userId: room.teachBack.teacherId,
      name: teacher?.username,
      color: teacher?.color,
      text,
      xpBonus: social ? XP_TEACHBACK : 0,
    });
  } else {
    broadcast(room, { type: "teachback_skipped", userId: room.teachBack.teacherId });
  }
  startReadyCheck(room);
}

function startReadyCheck(room) {
  room.phase = "reveal";
  room.readySet = new Set();
  room.phaseDeadline = Date.now() + READY_FALLBACK_MS;
  broadcast(room, {
    type: "ready_update",
    ready: [],
    needed: activePlayers(room).map((p) => p.userId),
    deadline: room.phaseDeadline,
  });
  scheduleTimer(room, READY_FALLBACK_MS, () => advance(room));
}

function checkReadyDone(room) {
  if (room.phase !== "reveal") return;
  const needed = activePlayers(room);
  if (needed.length === 0) return;
  if (needed.every((p) => room.readySet.has(p.userId))) {
    if (room.timerId) clearTimeout(room.timerId);
    room.timerId = null;
    advance(room);
  }
}

function advance(room) {
  if (room.phase === "complete" || room.phase === "ended") return;
  if (room.qIndex + 1 >= room.questions.length) {
    completeSession(room);
  } else {
    room.phase = "transition";
    broadcast(room, { type: "phase", phase: "transition", nextIndex: room.qIndex + 1 });
    scheduleTimer(room, TRANSITION_MS, () => openQuestion(room));
  }
}

// ── Lifeline / chat ──────────────────────────────────────────────────────────

// Cost is paid client-side in 💎 (survival gems) before this message is sent —
// the server just guards the once-per-session cap and serves the poll.
// Marking lifelineUsed FIRST is what closes the double-tap race (the old
// async coin debit let two requests pass the check before either recorded it).
function handleLifeline(room, p) {
  if (room.phase !== "question" || room.answers.has(p.userId)) return;
  if (room.lifelineUsed.has(p.userId)) return;
  room.lifelineUsed.add(p.userId);

  // Reveal the distribution of already-locked answers (anonymized). In
  // battles the poll is scoped to your own team — surfacing the opponent's
  // locked picks would leak their answers.
  const votes = { A: 0, B: 0, C: 0, D: 0 };
  let basedOn = 0;
  for (const [uid, a] of room.answers) {
    if (room.battle && room.participants.get(uid)?.team !== p.team) continue;
    votes[a.option]++;
    basedOn++;
  }
  if (basedOn === 0) {
    room.lifelineUsed.delete(p.userId);
    send(p.ws, { type: "lifeline_denied", reason: "No one has locked an answer yet — nothing to poll" });
    return;
  }
  send(p.ws, { type: "poll", votes, basedOn });
  broadcast(room, { type: "lifeline_used", userId: p.userId }, p.userId);
}

function handleChat(room, p, msg) {
  const text = String(msg.text || "").trim().slice(0, 300);
  if (!text) return;
  const entry = { userId: p.userId, name: p.username, avatar: p.avatar || null, color: p.color, text, ts: Date.now() };
  room.chatLog.push(entry);
  if (room.chatLog.length > 200) room.chatLog = room.chatLog.slice(-100);
  broadcast(room, { type: "chat", ...entry });
}

// ── Completion / persistence ─────────────────────────────────────────────────

function computeAwards(room) {
  const awards = [];
  const ps = [...room.participants.values()];

  let luckyWinner = null;
  let maxLucky = 0;
  for (const p of ps) {
    if (p.stats.lucky > maxLucky) { maxLucky = p.stats.lucky; luckyWinner = p; }
  }
  if (luckyWinner) {
    awards.push({ key: "lucky", title: "The Lucky Guesser", subtitle: "Guessed correctly with low confidence", winnerId: luckyWinner.userId, winnerName: luckyWinner.username, color: luckyWinner.color });
  }

  let speedWinner = null;
  let fastestAvg = Infinity;
  for (const p of ps) {
    if (p.stats.times.length > 0) {
      const avg = p.stats.times.reduce((a, b) => a + b, 0) / p.stats.times.length;
      if (avg < fastestAvg) { fastestAvg = avg; speedWinner = p; }
    }
  }
  if (speedWinner) {
    awards.push({ key: "speed", title: "The Speedster", subtitle: "Fastest average lock-in time", winnerId: speedWinner.userId, winnerName: speedWinner.username, color: speedWinner.color });
  }

  let brainWinner = null;
  let maxCorrect = -1;
  for (const p of ps) {
    if (p.stats.correct > maxCorrect) { maxCorrect = p.stats.correct; brainWinner = p; }
  }
  if (brainWinner && maxCorrect > 0) {
    awards.push({ key: "brain", title: "The Brain", subtitle: "Highest accuracy in the session", winnerId: brainWinner.userId, winnerName: brainWinner.username, color: brainWinner.color });
  }

  let clutchWinner = null;
  let maxClutch = 0;
  for (const p of ps) {
    if (p.stats.clutch > maxClutch) { maxClutch = p.stats.clutch; clutchWinner = p; }
  }
  if (clutchWinner) {
    awards.push({ key: "clutch", title: "The Clutch", subtitle: "Most correct answers in the final 5 seconds", winnerId: clutchWinner.userId, winnerName: clutchWinner.username, color: clutchWinner.color });
  }
  return awards;
}

async function completeSession(room) {
  room.phase = "complete";
  if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }

  const leaderboard = [...room.participants.values()]
    .filter((p) => !p.spectator) // watchers don't clutter the board
    .map((p) => ({
      userId: p.userId,
      username: p.username,
      avatar: p.avatar || null,
      color: p.color,
      score: p.score,
      points: p.points || 0,
      totalTimeMs: Math.round(p.stats.times.reduce((a, b) => a + b, 0) * 1000),
      xp: room.xp.get(p.userId) || 0,
    }))
    .sort((a, b) => b.points - a.points || b.score - a.score || a.totalTimeMs - b.totalTimeMs);

  const awards = computeAwards(room);
  const xpEarned = {};
  for (const [uid, xp] of room.xp) xpEarned[uid] = xp;
  const calibration = {};
  const participantIds = [];
  for (const p of room.participants.values()) {
    calibration[p.userId] = p.stats.conf;
    participantIds.push(p.userId);
  }

  room.results = { leaderboard, awards, xpEarned, calibration, participantIds, totalQuestions: room.questions.length };

  // Group battle: attach the result for the client + persist scores/rating/XP.
  // Idempotent inside finalizeBattle (only the first completion lands).
  if (room.battle) {
    const scores = teamScores(room);
    // Winner on the precise (unrounded) averages — same math as finalizeBattle,
    // so the verdict shown in-room always matches the persisted result.
    const raw = teamPoints(room);
    const winnerId = raw.a === raw.b ? null : raw.a > raw.b ? room.battle.a.classroomId : room.battle.b.classroomId;
    room.results.battle = {
      id: room.battle.id,
      mode: room.battle.mode,
      a: { classroomId: room.battle.a.classroomId, name: room.battle.a.name, score: scores.a, size: room.battle.a.lineup?.length || 0 },
      b: { classroomId: room.battle.b.classroomId, name: room.battle.b.name, score: scores.b, size: room.battle.b.lineup?.length || 0 },
      winnerId,
    };
    finalizeBattle(room).catch((e) => console.warn("[battle] finalize failed:", e?.message));
  }

  broadcast(room, { type: "complete", ...room.results });

  persistSession(room, "complete").catch(() => {});

  const winner = leaderboard[0];

  // Post-session buzz: a feed recap with the winner so the session echoes past
  // the room (best-effort — never blocks completion). Battles already post
  // their own outcome via finalizeBattle.
  if (!room.battle && winner && leaderboard.length > 1) {
    (async () => {
      try {
        const profile = await prisma.userProfile.findUnique({
          where: { userId: room.hostId },
          select: { universityId: true },
        });
        await prisma.feedPost.create({
          data: {
            authorId: room.hostId,
            kind: "activity",
            text: `wrapped a live quiz — ${room.title} ⚡ ${winner.username} took the crown with ${winner.points} pts · ${leaderboard.length} players`,
            resourceId: room.resourceId || room.mcqResourceId || null,
            universityId: profile?.universityId || null,
          },
        });
      } catch (e) {
        console.warn("[live] recap feed post failed:", e?.message);
      }
    })();
  }

  // Per-participant side effects: XP, streak credit, live badges (fire-and-forget)
  for (const p of room.participants.values()) {
    const uid = p.userId;
    const xp = room.xp.get(uid) || 0;
    (async () => {
      try {
        if (xp > 0) {
          await prisma.userProgress.upsert({
            where: { userId: uid },
            update: { xp: { increment: xp } },
            create: { userId: uid, xp },
          });
          await prisma.user.update({
            where: { id: uid },
            data: { totalXp: { increment: xp } },
          }).catch(() => {});
          await addLeagueXP(uid, xp, { source: "live" });
        }
        // A live quiz IS studying — it counts toward the daily streak.
        if (p.stats.answered > 0) {
          await updateUniversalStreak(uid, prisma).catch(() => {});
          await awardBadge(uid, "live_first").catch(() => {});
          if (winner?.userId === uid && room.participants.size > 1) {
            await awardBadge(uid, "live_win").catch(() => {});
          }
          // Well-calibrated: leaned on High confidence and was never wrong with it
          const [hc, hw] = p.stats.conf.High;
          if (hc >= 3 && hw === 0) await awardBadge(uid, "live_calibrated").catch(() => {});
        }
      } catch (err) {
        console.warn(`Live quiz completion side-effects failed for ${uid}:`, err.message);
      }
    })();
  }

  scheduleTimer(room, ROOM_TTL_MS, () => deleteRoom(room.id));
}

function backToLobby(room) {
  if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }
  room.phase = "lobby";
  room.qIndex = -1;
  room.questions = [];
  room.answers = new Map();
  room.readySet = new Set();
  room.wagers = new Map();
  room.wagerEligible = new Set();
  room.prevCorrect = new Set();
  room.lifelineUsed = new Set();
  room.teachBack = null;
  room.xp = new Map();
  room.groupStreak = 0;
  room.talkedThrough = 0;
  room.phaseDeadline = null;
  room.results = null;
  room.dbId = null; // next game persists as a fresh session row
  // reshuffle the pool so the next round isn't identical
  for (let i = room.allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.allQuestions[i], room.allQuestions[j]] = [room.allQuestions[j], room.allQuestions[i]];
  }
  for (const p of room.participants.values()) {
    p.lobbyReady = p.userId === room.hostId;
    p.spectator = false; // new game — watchers become players again
    p.score = 0;
    p.points = 0;
    p.stats = freshStats();
    if (p.connected) send(p.ws, buildSnapshot(room, p.userId));
  }
}

export function endRoom(room, reason = "ended_by_host") {
  if (room.phase === "ended") return;
  room.phase = "ended";
  if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }
  broadcast(room, { type: "session_ended", reason });
  persistSession(room, "ended").catch(() => {});
  if (room.battle) cancelBattle(room).catch(() => {});
  for (const p of room.participants.values()) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      try { p.ws.close(); } catch {}
    }
    p.connected = false;
    p.ws = null;
  }
  room.emptySince = Date.now();
  scheduleTimer(room, ROOM_TTL_MS, () => deleteRoom(room.id));
}

async function persistSession(room, status) {
  try {
    const data = {
      status,
      settings: room.settings,
      endedAt: status === "complete" || status === "ended" ? new Date() : null,
      results: status === "complete" ? room.results : undefined,
    };
    if (!room.dbId) {
      const row = await prisma.liveQuizSession.create({
        data: {
          code: room.code,
          hostId: room.hostId,
          resourceId: room.resourceId,
          mcqResourceId: room.mcqResourceId,
          title: room.title,
          settings: room.settings,
          status,
          results: room.results || undefined,
        },
      });
      room.dbId = row.id;
    } else {
      await prisma.liveQuizSession.update({ where: { id: room.dbId }, data });
    }
  } catch (err) {
    console.warn("Failed to persist live quiz session:", err.message);
  }
}

function scheduleTimer(room, ms, fn) {
  if (room.timerId) clearTimeout(room.timerId);
  room.timerId = setTimeout(() => {
    room.timerId = null;
    fn();
  }, ms);
}

// ── Empty-room sweep ─────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === "ended") continue;
    const nobodyHome = connectedParticipants(room).length === 0;
    if (nobodyHome && room.emptySince && now - room.emptySince > GRACE_MS) {
      endRoom(room, "abandoned");
    } else if (nobodyHome && !room.emptySince) {
      room.emptySince = now;
    }
  }
}, 15000);
