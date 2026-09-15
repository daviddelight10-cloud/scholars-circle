import crypto from "crypto";
import { WebSocket } from "ws";
import { prisma } from "../db.js";
import { addLeagueXP } from "./badges.js";

// ── In-memory live-quiz room manager ─────────────────────────────────────────
// Live room state is ephemeral (like voice sessions); a LiveQuizSession DB row
// is written on create/complete for history + XP auditing.

const rooms = new Map(); // roomId -> room
const roomByCode = new Map(); // code -> roomId

const MAX_PARTICIPANTS = 8;
const TRANSITION_MS = 2500;
const READY_FALLBACK_MS = 25000;
const TEACHBACK_MS = 45000;
const GRACE_MS = 30000;
const ROOM_TTL_MS = 5 * 60 * 1000; // keep finished rooms briefly for reconnects
const LIFELINE_COST = 50;
const XP_PER_CORRECT = 20;
const XP_TEACHBACK = 50;
const XP_WAGER = 30;

const COLORS = ["#3B82F6", "#FF6B5E", "#F5C542", "#3DD68C", "#A78BFA", "#EC4899", "#14B8A6", "#F97316"];
const EMOJI_ALLOWED = new Set(["💡", "🔥", "👏", "❤️", "😂", "🎉"]);

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function getRoomByCode(code) {
  const id = roomByCode.get(String(code || "").toUpperCase());
  return id ? rooms.get(id) : null;
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
  return [...room.participants.values()].filter((p) => p.connected);
}

function publicParticipant(p) {
  return {
    userId: p.userId,
    username: p.username,
    color: p.color,
    connected: p.connected,
    lobbyReady: p.lobbyReady,
    score: p.score,
    isHost: false, // filled by caller
  };
}

function publicParticipants(room) {
  return [...room.participants.values()].map((p) => ({
    ...publicParticipant(p),
    isHost: p.userId === room.hostId,
  }));
}

// ── Room lifecycle ───────────────────────────────────────────────────────────

export function createRoom({ hostId, hostName, resourceId, mcqResourceId, title, questions, settings }) {
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
    groupStreak: 0,
    talkedThrough: 0,
    timerId: null,
    phaseDeadline: null,
    chatLog: [],
    dbId: null,
    createdAt: Date.now(),
    emptySince: null,
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
    totalCount: connectedParticipants(room).length,
    wagerEligible: room.wagerEligible.has(forUserId),
    wagerActive: room.wagers.get(forUserId) === true,
    lifelineUsed: room.lifelineUsed.has(forUserId),
    answered: room.answers.has(forUserId)
      ? { option: room.answers.get(forUserId).option, confidence: room.answers.get(forUserId).confidence }
      : null,
  };
}

function buildSnapshot(room, forUserId) {
  const snap = {
    type: "room_state",
    roomId: room.id,
    code: room.code,
    title: room.title,
    phase: room.phase,
    isHost: forUserId === room.hostId,
    settings: room.settings,
    maxQuestions: room.allQuestions.length,
    poolSize: room.allQuestions.length,
    participants: publicParticipants(room),
    talkedThrough: room.talkedThrough,
    groupStreak: room.groupStreak,
    chatLog: room.chatLog.slice(-50),
    serverNow: Date.now(),
  };
  if (room.phase === "question" || room.phase === "reveal" || room.phase === "teachback") {
    snap.question = currentQuestionPayload(room, forUserId);
  }
  if (room.phase === "reveal" || room.phase === "teachback") {
    snap.reveal = buildRevealPayload(room);
    snap.ready = { ready: [...room.readySet], needed: connectedParticipants(room).map((p) => p.userId) };
  }
  if (room.phase === "teachback") {
    snap.teachBack = { teacherId: room.teachBack?.teacherId, text: room.teachBack?.text || null };
  }
  if (room.phase === "complete") {
    snap.complete = room.results;
  }
  return snap;
}

// ── Lobby handlers ───────────────────────────────────────────────────────────

export function registerParticipant(room, userId, username) {
  let p = room.participants.get(userId);
  if (p) {
    if (username && p.username === "Scholar") p.username = username;
    return { ok: true, participant: p };
  }
  if (room.participants.size >= MAX_PARTICIPANTS) return { ok: false, error: "Room is full" };
  p = {
    userId,
    username: username || "Scholar",
    color: pickColor(room),
    ws: null,
    connected: false,
    lobbyReady: userId === room.hostId,
    score: 0,
    stats: { times: [], correct: 0, lucky: 0 },
    graceTimerId: null,
  };
  room.participants.set(userId, p);
  broadcast(room, { type: "lobby_state", participants: publicParticipants(room) });
  return { ok: true, participant: p };
}

export function attachSocket(room, userId, username, ws) {
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
  // Don't let a disconnect stall the room
  checkQuestionDone(room);
  checkReadyDone(room);
}

export function handleMessage(room, userId, msg) {
  const p = room.participants.get(userId);
  if (!p || !p.connected) return;
  const isHost = userId === room.hostId;

  switch (msg.type) {
    case "ping":
      send(p.ws, { type: "pong", t: msg.t });
      return;
    case "lobby_ready":
      if (room.phase !== "lobby") return;
      p.lobbyReady = !!msg.ready;
      broadcast(room, { type: "lobby_state", participants: publicParticipants(room) });
      return;
    case "settings":
      if (room.phase !== "lobby" || !isHost) return;
      applySettings(room, msg);
      broadcast(room, { type: "lobby_state", participants: publicParticipants(room), settings: room.settings });
      return;
    case "start":
      if (room.phase !== "lobby" || !isHost) return;
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
      handleChat(room, p, msg);
      return;
    case "reaction": {
      const emoji = String(msg.emoji || "").slice(0, 8);
      if (!EMOJI_ALLOWED.has(emoji)) return;
      broadcast(room, { type: "reaction", userId, emoji });
      return;
    }
    case "leave":
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
  room.phaseDeadline = Date.now() + room.settings.timePerQuestion * 1000;
  room.talkedThrough = room.qIndex;

  for (const p of room.participants.values()) {
    if (!p.connected) continue;
    send(p.ws, { type: "question", ...currentQuestionPayload(room, p.userId) });
  }
  scheduleTimer(room, room.settings.timePerQuestion * 1000, () => revealQuestion(room));
}

function handleAnswer(room, p, msg) {
  if (room.phase !== "question" || room.answers.has(p.userId)) return;
  const option = String(msg.option || "").toUpperCase();
  if (!["A", "B", "C", "D"].includes(option)) return;
  const confidence = ["Low", "Medium", "High"].includes(msg.confidence) ? msg.confidence : null;
  if (!confidence) return;

  const q = room.questions[room.qIndex];
  const timeMs = Math.max(0, room.settings.timePerQuestion * 1000 - (room.phaseDeadline - Date.now()));
  const correct = option === q.correct;
  room.answers.set(p.userId, { option, confidence, timeMs, correct });

  p.stats.times.push(timeMs / 1000);
  if (correct) {
    p.stats.correct++;
    addXp(room, p.userId, XP_PER_CORRECT);
    if (confidence === "Low") p.stats.lucky++;
    if (room.wagers.get(p.userId) === true) addXp(room, p.userId, XP_WAGER);
  } else if (room.wagers.get(p.userId) === true) {
    addXp(room, p.userId, -XP_WAGER);
  }
  p.score += correct ? 1 : 0;

  broadcast(room, {
    type: "lock_update",
    locked: room.answers.size,
    total: connectedParticipants(room).length,
  });
  checkQuestionDone(room);
}

function checkQuestionDone(room) {
  if (room.phase !== "question") return;
  const connected = connectedParticipants(room);
  if (connected.length > 0 && room.answers.size >= connected.length) {
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
  for (const p of room.participants.values()) {
    scores[p.userId] = p.score;
    xpEarned[p.userId] = room.xp.get(p.userId) || 0;
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
    picks,
    scores,
    xpEarned,
    numCorrect,
    soleCorrectId: soleCorrect,
    groupStreak: room.groupStreak,
  };
}

function revealQuestion(room) {
  if (room.phase !== "question") return;
  const q = room.questions[room.qIndex];
  const connected = connectedParticipants(room);
  const allCorrect =
    connected.length > 0 &&
    connected.every((p) => room.answers.get(p.userId)?.correct === true);
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
  if (text) {
    addXp(room, room.teachBack.teacherId, XP_TEACHBACK);
    broadcast(room, {
      type: "teachback",
      userId: room.teachBack.teacherId,
      name: teacher?.username,
      color: teacher?.color,
      text,
      xpBonus: XP_TEACHBACK,
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
    needed: connectedParticipants(room).map((p) => p.userId),
    deadline: room.phaseDeadline,
  });
  scheduleTimer(room, READY_FALLBACK_MS, () => advance(room));
}

function checkReadyDone(room) {
  if (room.phase !== "reveal") return;
  const needed = connectedParticipants(room);
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

async function handleLifeline(room, p) {
  if (room.phase !== "question") return;
  if (room.answers.has(p.userId)) return;
  if (room.lifelineUsed.has(p.userId)) return;

  try {
    const progress = await prisma.userProgress.findUnique({ where: { userId: p.userId } });
    if (!progress || progress.coins < LIFELINE_COST) {
      send(p.ws, { type: "lifeline_denied", reason: "Not enough coins" });
      return;
    }
    await prisma.userProgress.update({
      where: { userId: p.userId },
      data: { coins: { decrement: LIFELINE_COST } },
    });
  } catch {
    send(p.ws, { type: "lifeline_denied", reason: "Could not use lifeline" });
    return;
  }

  room.lifelineUsed.add(p.userId);
  // Reveal the distribution of already-locked answers (anonymized)
  const votes = { A: 0, B: 0, C: 0, D: 0 };
  for (const a of room.answers.values()) votes[a.option]++;
  send(p.ws, { type: "poll", votes, basedOn: room.answers.size });
  broadcast(room, { type: "lifeline_used", userId: p.userId }, p.userId);
}

function handleChat(room, p, msg) {
  const text = String(msg.text || "").trim().slice(0, 300);
  if (!text) return;
  const entry = { userId: p.userId, name: p.username, color: p.color, text, ts: Date.now() };
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
  return awards;
}

async function completeSession(room) {
  room.phase = "complete";
  if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }

  const leaderboard = [...room.participants.values()]
    .map((p) => ({
      userId: p.userId,
      username: p.username,
      color: p.color,
      score: p.score,
      xp: room.xp.get(p.userId) || 0,
    }))
    .sort((a, b) => b.score - a.score || b.xp - a.xp);

  const awards = computeAwards(room);
  const xpEarned = {};
  for (const [uid, xp] of room.xp) xpEarned[uid] = xp;

  room.results = { leaderboard, awards, xpEarned, totalQuestions: room.questions.length };
  broadcast(room, { type: "complete", ...room.results });

  persistSession(room, "complete").catch(() => {});

  // Award XP (fire-and-forget per participant)
  for (const [userId, xp] of room.xp) {
    if (xp <= 0) continue;
    (async () => {
      try {
        await prisma.userProgress.upsert({
          where: { userId },
          update: { xp: { increment: xp } },
          create: { userId, xp },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { totalXp: { increment: xp } },
        }).catch(() => {});
        await addLeagueXP(userId, xp);
      } catch (err) {
        console.warn(`Live quiz XP award failed for ${userId}:`, err.message);
      }
    })();
  }

  scheduleTimer(room, ROOM_TTL_MS, () => deleteRoom(room.id));
}

export function endRoom(room, reason = "ended_by_host") {
  if (room.phase === "ended") return;
  room.phase = "ended";
  if (room.timerId) { clearTimeout(room.timerId); room.timerId = null; }
  broadcast(room, { type: "session_ended", reason });
  persistSession(room, "ended").catch(() => {});
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
      endedAt: status === "complete" || status === "ended" ? new Date() : undefined,
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
