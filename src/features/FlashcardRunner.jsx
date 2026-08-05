import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { recordPracticeResult } from "../lib/studyHistory.js";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://scholars-circle-production.up.railway.app";
const XP_PER_CORRECT = 20;
const LANES = 3;
const CENTER_LANE = (LANES - 1) / 2;
const START_LANE = Math.floor(CENTER_LANE);
const CARD_W = 160;
const MAX_LIVES = 3;
const POWERUP_SPAWN_CHANCE = 0.28;
const MAX_SHIELDS = 2;

/* ── MCQ → game question mapping ────────────────────────────── */
function mcqToGameQuestion(mcq, index) {
  const options = mcq.options || {};
  const optArr =
    Array.isArray(options)
      ? options
      : Object.values(options);
  const correctIdx =
    typeof mcq.correct === "string"
      ? mcq.correct.charCodeAt(0) - 65
      : mcq.correct || 0;
  const correctText = optArr[correctIdx] ?? optArr[0] ?? "—";
  const wrongTexts = optArr.filter((_, i) => i !== correctIdx);
  const shuffledWrongs = shuffleArray(wrongTexts);
  const randomWrongs = shuffledWrongs.slice(0, 2).map((w) => w ?? "—");
  while (randomWrongs.length < 2) randomWrongs.push("—");
  return {
    index,
    q: mcq.question || "",
    a: correctText,
    wrongs: randomWrongs,
    explanation: mcq.explanation || "",
    correctKey: mcq.correct,
    options: mcq.options,
    label: "Question",
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Audio system (Web Audio API — ported from prototype) ──── */
function createAudioSystem() {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, duration, { type = "sine", volume = 0.15, glideTo = null, delay = 0 } = {}) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  return {
    laneSwitch() { tone(320, 0.08, { type: "triangle", volume: 0.08, glideTo: 480 }); },
    correct() {
      tone(523.25, 0.12, { type: "sine", volume: 0.16 });
      tone(659.25, 0.14, { type: "sine", volume: 0.14, delay: 0.05 });
    },
    wrong() { tone(160, 0.28, { type: "sawtooth", volume: 0.14, glideTo: 80 }); },
    streak() {
      [0, 0.08, 0.16].forEach((d, i) => tone(523.25 * Math.pow(1.19, i), 0.12, { type: "triangle", volume: 0.15, delay: d }));
    },
    powerUp() { tone(440, 0.1, { type: "square", volume: 0.1, glideTo: 880 }); },
    shieldBlock() { tone(200, 0.2, { type: "square", volume: 0.12, glideTo: 400 }); },
    gameOver() {
      [523.25, 466.16, 392.0, 349.23].forEach((f, i) => tone(f, 0.35, { type: "sine", volume: 0.13, delay: i * 0.12 }));
    },
    start() {
      tone(523.25, 0.1, { type: "sine", volume: 0.1 });
      tone(659.25, 0.1, { type: "sine", volume: 0.1, delay: 0.08 });
      tone(783.99, 0.15, { type: "sine", volume: 0.1, delay: 0.16 });
    },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
  };
}

/* ── Component ──────────────────────────────────────────────── */
export default function FlashcardRunner({
  resource,
  shareToken,
  onBack,
  onQuizComplete,
  onStreakUpdate,
  onXpUpdate,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const [gameState, setGameState] = useState("menu");
  const [muted, setMuted] = useState(false);
  const [finalStats, setFinalStats] = useState(null);
  const [missedReview, setMissedReview] = useState([]);
  const [powerupBadges, setPowerupBadges] = useState({ shield: 0, slowmo: false });
  const [toast, setToast] = useState({ text: "", type: "", show: false });
  const [hudState, setHudState] = useState({ score: 0, streak: 0, combo: 1, lives: MAX_LIVES });
  const [questionDisplay, setQuestionDisplay] = useState({ text: "", label: "", isReview: false });
  const toastTimeoutRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0, active: false });

  /* Parse MCQ data */
  const gameQuestions = useMemo(() => {
    const raw = resource?.mcqData;
    if (!raw) return [];
    let parsed = raw;
    if (typeof raw === "string") {
      try { parsed = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(parsed)) return [];
    return shuffleArray(parsed).map((mcq, i) => mcqToGameQuestion(mcq, i));
  }, [resource]);

  const G = useRef(null);

  function initState() {
    G.current = {
      score: 0, streak: 0, bestStreak: 0,
      lives: MAX_LIVES,
      frame: 0, bgPulse: 0,
      screenShake: 0, flashColor: null, flashAlpha: 0,
      player: { lane: START_LANE, targetLane: START_LANE, y: 0, bobPhase: 0 },
      currentQ: null, answers: [], cardDepth: 1.0, cardSpawned: false,
      answered: false, answerCorrect: false,
      particles: [], scorePopups: [], speedLines: [], stars: [],
      shieldCount: 0, slowmoActive: false, slowmoPending: false,
      activePowerUp: null,
      missedThisRun: [], reviewQueue: [], questionIndex: 0,
      answerMap: {}, timePerQuestion: {}, questionStartTime: 0,
      correctCount: 0, totalCount: 0,
      lastTime: 0, paused: false,
    };
    for (let i = 0; i < 90; i++) {
      G.current.stars.push({
        x: Math.random(), y: Math.random() * 0.4,
        r: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
        ts: Math.random() * 0.04 + 0.01,
      });
    }
  }

  /* ── Canvas sizing ──────────────────────────────────────── */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  /* ── Spawn next question ────────────────────────────────── */
  function spawnNextQuestion() {
    const g = G.current;
    if (!g) return;

    let q;
    const dueIdx = g.reviewQueue.findIndex(r => r.dueAt <= g.questionIndex);
    const isReview = dueIdx !== -1;
    if (isReview) {
      q = g.reviewQueue.splice(dueIdx, 1)[0].question;
    } else if (g.questionIndex < gameQuestions.length) {
      q = gameQuestions[g.questionIndex];
    } else if (g.reviewQueue.length > 0) {
      q = g.reviewQueue.shift().question;
    } else {
      endGame();
      return;
    }
    g.questionIndex++;
    g.currentQ = q;
    g.questionStartTime = performance.now();

    // Build lane answers: correct + 2 wrongs, shuffled
    const wrongsPool = [...q.wrongs];
    const chosenWrongs = [];
    while (chosenWrongs.length < LANES - 1 && wrongsPool.length) {
      const i = Math.floor(Math.random() * wrongsPool.length);
      chosenWrongs.push(wrongsPool.splice(i, 1)[0]);
    }
    const allAnswers = [q.a, ...chosenWrongs];
    for (let i = allAnswers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext("2d") : null;
    g.answers = allAnswers.map((text, lane) => ({
      text, lane, isCorrect: text === q.a,
      fitFontSize: ctx ? fitAnswerFontSize(ctx, text) : 16,
    }));
    g.cardDepth = 1.0;
    g.cardSpawned = true;
    g.answered = false;
    g.slowmoActive = g.slowmoPending;
    g.slowmoPending = false;

    // Power-up orb
    g.activePowerUp = null;
    if (Math.random() < POWERUP_SPAWN_CHANCE) {
      const type = Math.random() < 0.55 ? "shield" : "slowmo";
      if (type === "shield" && g.shieldCount >= MAX_SHIELDS) {
        // skip
      } else {
        g.activePowerUp = { type, lane: Math.floor(Math.random() * LANES), collected: false };
      }
    }

    setPowerupBadges({ shield: g.shieldCount, slowmo: g.slowmoActive });
    setQuestionDisplay({
      text: q.q,
      label: (isReview ? "↻ Review · " : "") + (q.label || "Question"),
      isReview,
    });
  }

  function fitAnswerFontSize(ctx, text) {
    let fontSize = 24;
    ctx.font = `700 ${fontSize}px Sora, sans-serif`;
    while (ctx.measureText(text).width > CARD_W * 0.85 && fontSize > 8) {
      fontSize -= 1;
      ctx.font = `700 ${fontSize}px Sora, sans-serif`;
    }
    return fontSize;
  }

  /* ── Answer question ────────────────────────────────────── */
  function answerQuestion(correct) {
    const g = G.current;
    if (!g || g.answered || !g.currentQ) return;
    g.answered = true;
    g.answerCorrect = correct;
    g.totalCount++;
    const elapsed = performance.now() - g.questionStartTime;
    const qIdx = g.currentQ.index;
    const playerLane = Math.round(g.player.lane);
    g.timePerQuestion[qIdx] = elapsed;
    const px = getLaneX(g.player.lane, 0);
    const py = g.player.y;

    if (!correct) {
      g.missedThisRun.push({
        question: g.currentQ.q,
        correctAnswer: g.currentQ.a,
        yourAnswer: g.answers[playerLane]?.text || "—",
        explanation: g.currentQ.explanation,
      });
      g.reviewQueue.push({
        question: g.currentQ,
        dueAt: g.questionIndex + 6 + Math.floor(Math.random() * 4),
      });
    }

    // Shield absorbs wrong answer
    if (!correct && g.shieldCount > 0) {
      g.shieldCount--;
      g.totalCount--;
      audioRef.current?.shieldBlock();
      showToast("Blocked!", "streak");
      spawnParticles(px, py, "#00E5FF", 22);
      g.flashColor = "#00E5FF"; g.flashAlpha = 0.25;
      setPowerupBadges({ shield: g.shieldCount, slowmo: g.slowmoActive });
      updateUI();
      setTimeout(() => { if (G.current && !G.current.paused) spawnNextQuestion(); }, 950);
      return;
    }

    if (correct) {
      g.correctCount++;
      g.streak++;
      if (g.streak > g.bestStreak) g.bestStreak = g.streak;
      const combo = 1 + Math.min(g.streak * 0.1, 2);
      const points = Math.round(100 * combo);
      g.score += points;
      showToast("+" + points, "correct");
      audioRef.current?.correct();
      spawnParticles(px, py, "#4ADE80", 25);
      spawnScorePopup(px, py - 40, "+" + points, "#4ADE80");
      g.flashColor = "#4ADE80"; g.flashAlpha = 0.2;
      if (g.streak >= 5 && g.streak % 5 === 0) {
        setTimeout(() => showToast(g.streak + " STREAK!", "streak"), 500);
        setTimeout(() => audioRef.current?.streak(), 500);
      }
      g.answerMap[qIdx] = g.currentQ.correctKey;
    } else {
      g.streak = 0;
      g.lives--;
      showToast("Wrong!", "wrong");
      audioRef.current?.wrong();
      spawnParticles(px, py, "#EF4444", 20);
      g.screenShake = 15;
      g.flashColor = "#EF4444"; g.flashAlpha = 0.35;
      g.answerMap[qIdx] = String.fromCharCode(65 + playerLane);
      if (g.lives <= 0) {
        audioRef.current?.gameOver();
        updateUI();
        setTimeout(() => endGame(), 900);
        return;
      }
    }
    updateUI();
    setTimeout(() => { if (G.current && !G.current.paused) spawnNextQuestion(); }, 950);
  }

  function showToast(text, type) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text, type, show: true });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, type === "streak" ? 1200 : 1000);
  }

  function updateUI() {
    const g = G.current;
    if (!g) return;
    const combo = 1 + Math.min(g.streak * 0.1, 2);
    setHudState({ score: g.score, streak: g.streak, combo, lives: g.lives });
  }

  function getCanvasHeight() {
    const canvas = canvasRef.current;
    if (!canvas) return 600;
    return canvas.getBoundingClientRect().height;
  }

  function getCanvasWidth() {
    const canvas = canvasRef.current;
    if (!canvas) return 800;
    return canvas.getBoundingClientRect().width;
  }

  function getLaneSep() {
    const W = getCanvasWidth();
    return Math.min(W * 0.3, 220);
  }

  function getLaneX(lane, depth) {
    const W = getCanvasWidth();
    const t = 1 - depth;
    return W / 2 + (lane - CENTER_LANE) * getLaneSep() * t;
  }

  function getDepthY(depth) {
    const H = getCanvasHeight();
    const horizonY = H * 0.32;
    const playerY = H * 0.82;
    const t = 1 - depth;
    return horizonY + (playerY - horizonY) * t;
  }

  function getDepthScale(depth) {
    const t = 1 - depth;
    return 0.2 + 0.8 * t;
  }

  function spawnParticles(x, y, color, count) {
    const g = G.current;
    if (!g) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 40 + Math.random() * 20, maxLife: 60,
        color, size: Math.random() * 4 + 2,
      });
    }
  }

  function spawnScorePopup(x, y, text, color) {
    const g = G.current;
    if (!g) return;
    g.scorePopups.push({ x, y, text, color, life: 60, maxLife: 60, vy: -1.5 });
  }

  function collectPowerUp() {
    const g = G.current;
    if (!g || !g.activePowerUp || g.activePowerUp.collected) return;
    g.activePowerUp.collected = true;
    audioRef.current?.powerUp();
    if (g.activePowerUp.type === "shield") {
      g.shieldCount = Math.min(MAX_SHIELDS, g.shieldCount + 1);
      showToast("Shield +1", "streak");
    } else {
      g.slowmoPending = true;
      showToast("Slow-Mo!", "streak");
    }
    setPowerupBadges({ shield: g.shieldCount, slowmo: g.slowmoActive });
  }

  /* ── End game ───────────────────────────────────────────── */
  function endGame() {
    const g = G.current;
    if (!g) return;
    g.paused = true;
    audioRef.current?.gameOver();
    const stats = {
      score: g.score,
      bestStreak: g.bestStreak,
      correct: g.correctCount,
      total: g.totalCount,
      accuracy: g.totalCount > 0 ? Math.round((g.correctCount / g.totalCount) * 100) : 0,
    };
    setFinalStats(stats);
    setMissedReview([...g.missedThisRun]);
    setGameState("gameover");
    submitResults(g);
  }

  async function submitResults(g) {
    if (!resource?.id) return;
    try {
      const mcqsForWeak = gameQuestions.map((gq) => ({
        question: gq.q,
        options: gq.options,
        correct: gq.correctKey,
        explanation: gq.explanation,
      }));
      recordPracticeResult(resource.id, mcqsForWeak, g.answerMap);
    } catch {}
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const token = authData.authToken;
      const details = Object.keys(g.answerMap).map((idx) => {
        const gq = gameQuestions[parseInt(idx)];
        return {
          questionIndex: parseInt(idx),
          correct: gq ? g.answerMap[idx] === gq.correctKey : false,
          timeSpentMs: g.timePerQuestion[idx] ?? null,
        };
      });
      const res = await fetch(`${API_BASE}/api/resources/quiz-attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resourceId: resource.id,
          score: g.correctCount,
          total: g.totalCount,
          details,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (onQuizComplete) onQuizComplete(data);
        if (data.streak != null && onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
        if (data.xpAwarded > 0 && onXpUpdate) onXpUpdate(data.xpAwarded);
      }
    } catch {}
  }

  /* ── Start game ─────────────────────────────────────────── */
  function startGame() {
    if (!audioRef.current) audioRef.current = createAudioSystem();
    audioRef.current.start();
    initState();
    setPowerupBadges({ shield: 0, slowmo: false });
    setFinalStats(null);
    setMissedReview([]);
    setHudState({ score: 0, streak: 0, combo: 1, lives: MAX_LIVES });
    setGameState("playing");
    setTimeout(() => spawnNextQuestion(), 50);
  }

  /* ── Input: lane switching (not instant answer) ─────────── */
  function moveLane(dir) {
    const g = G.current;
    if (!g || gameState !== "playing") return;
    const newLane = Math.max(0, Math.min(LANES - 1, g.player.targetLane + dir));
    if (newLane !== g.player.targetLane) {
      g.player.targetLane = newLane;
      audioRef.current?.laneSwitch();
      const px = getLaneX(g.player.lane, 0);
      for (let i = 0; i < 8; i++) {
        g.particles.push({
          x: px, y: g.player.y,
          vx: dir * (Math.random() * 3 + 2),
          vy: (Math.random() - 0.5) * 3,
          life: 22, maxLife: 22,
          color: "#00E5FF", size: Math.random() * 2 + 1,
        });
      }
    }
  }

  function handleKeyDown(e) {
    if (gameState !== "playing") {
      if ((e.code === "Enter" || e.code === "Space") && (gameState === "menu" || gameState === "gameover")) {
        startGame();
      }
      return;
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault(); moveLane(-1);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault(); moveLane(1);
    }
  }

  function handleTouchStart(e) {
    e.preventDefault();
    if (gameState !== "playing") return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, active: true };
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const ts = touchStartRef.current;
    if (!ts || !ts.active) return;
    const t = e.touches[0];
    const dx = t.clientX - ts.x;
    const dy = t.clientY - ts.y;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
      ts.active = false;
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    const ts = touchStartRef.current;
    if (!ts || !ts.active) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - ts.x;
    const dy = t.clientY - ts.y;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const tapX = t.clientX - rect.left;
      const third = rect.width / 3;
      const targetLane = tapX < third ? 0 : tapX < third * 2 ? 1 : 2;
      const g = G.current;
      if (g) {
        const dir = targetLane - g.player.targetLane;
        if (dir !== 0) moveLane(dir > 0 ? 1 : -1);
      }
    }
    ts.active = false;
  }

  /* ── Game loop (ported from prototype) ────────────────────── */
  function gameLoop(timestamp) {
    const g = G.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    const W = getCanvasWidth();
    const H = getCanvasHeight();

    if (g.paused) {
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = g.lastTime ? Math.min((timestamp - g.lastTime) / 16.67, 3) : 1;
    g.lastTime = timestamp;
    g.frame++;

    // ── Update ──
    g.stars.forEach(s => { s.tw += s.ts; });
    g.bgPulse += 0.02;

    if (gameState === "menu" || gameState === "gameover") {
      updateParticles(g, dt);
      updateScorePopups(g, dt);
      g.player.bobPhase += 0.05;
    } else {
      // Smooth lane transition
      if (g.player.lane !== g.player.targetLane) {
        const diff = g.player.targetLane - g.player.lane;
        g.player.lane += diff * 0.22;
        if (Math.abs(diff) < 0.01) g.player.lane = g.player.targetLane;
      }
      g.player.bobPhase += 0.15;
      g.player.y = H * 0.78 + Math.sin(g.player.bobPhase) * 3;

      // Card approach
      if (g.cardSpawned) {
        if (!g.answered) {
          const baseSpeed = 0.0065;
          const speedBoost = Math.min(g.streak * 0.0003, 0.004);
          const slowmoMul = g.slowmoActive ? 0.55 : 1;
          g.cardDepth -= (baseSpeed + speedBoost) * slowmoMul * dt;

          // Power-up collection
          if (g.activePowerUp && !g.activePowerUp.collected && g.cardDepth < 0.4 &&
              Math.round(g.player.lane) === g.activePowerUp.lane) {
            collectPowerUp();
          }

          if (g.cardDepth <= 0.05) {
            const correctLane = g.answers.find(a => a.isCorrect)?.lane;
            const playerLane = Math.round(g.player.lane);
            answerQuestion(playerLane === correctLane);
          }
        } else {
          g.cardDepth -= 0.018 * dt;
          if (g.cardDepth < -0.3) g.cardSpawned = false;
        }
      }

      // Speed lines
      const slRate = 0.08 + Math.min(g.streak * 0.015, 0.3);
      if (Math.random() < slRate) {
        const depth = Math.random() * 0.7 + 0.2;
        g.speedLines.push({
          x: getLaneX(Math.random() * (LANES - 1), depth),
          y: getDepthY(depth),
          len: Math.random() * 60 + 30,
          opacity: Math.random() * 0.35 + 0.15,
          depth,
        });
      }
      // Update speed lines (in-place compaction)
      {
        let w = 0;
        for (let r = 0; r < g.speedLines.length; r++) {
          const s = g.speedLines[r];
          s.depth -= 0.015 * dt;
          s.y = getDepthY(s.depth);
          if (s.depth > -0.1 && s.y < H + 50) g.speedLines[w++] = s;
        }
        g.speedLines.length = w;
      }

      // Player trail
      if (g.frame % 2 === 0) {
        const px = getLaneX(g.player.lane, 0);
        g.particles.push({
          x: px + (Math.random() - 0.5) * 18,
          y: g.player.y + 20 + Math.random() * 15,
          vx: (Math.random() - 0.5) * 0.5,
          vy: Math.random() * 2 + 1,
          life: 28, maxLife: 28,
          color: g.streak >= 5 ? "#FFB627" : "#00E5FF",
          size: Math.random() * 3 + 1,
        });
      }

      updateParticles(g, dt);
      updateScorePopups(g, dt);

      if (g.screenShake > 0.3) g.screenShake *= 0.88;
      if (g.flashAlpha > 0.01) g.flashAlpha *= 0.9;
    }

    // ── Draw ──
    ctx.save();
    if (g.screenShake > 0.3) {
      ctx.translate((Math.random() - 0.5) * g.screenShake, (Math.random() - 0.5) * g.screenShake);
    }

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#06080f");
    bg.addColorStop(0.4, "#0d1424");
    bg.addColorStop(0.7, "#1a2340");
    bg.addColorStop(1, "#0d1424");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Horizon glow
    const horizonY = H * 0.32;
    const glowGrad = ctx.createRadialGradient(W / 2, horizonY, 0, W / 2, horizonY, W * 0.6);
    const pulseI = 0.15 + Math.sin(g.bgPulse) * 0.05;
    glowGrad.addColorStop(0, `rgba(255, 94, 126, ${pulseI})`);
    glowGrad.addColorStop(0.4, `rgba(255, 182, 39, ${pulseI * 0.5})`);
    glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    g.stars.forEach(s => {
      const tw = (Math.sin(s.tw) + 1) * 0.5;
      ctx.fillStyle = `rgba(241, 244, 255, ${s.a * (0.3 + tw * 0.7)})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    drawTrack(ctx, W, H, g);

    // Speed lines
    g.speedLines.forEach(s => {
      const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.len);
      grad.addColorStop(0, "rgba(0, 229, 255, 0)");
      grad.addColorStop(0.5, `rgba(0, 229, 255, ${s.opacity})`);
      grad.addColorStop(1, "rgba(0, 229, 255, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + s.len);
      ctx.stroke();
    });

    // Answer cards + power-up orb
    if (g.cardSpawned && g.currentQ) {
      for (let lane = 0; lane < LANES; lane++) drawAnswerCard(ctx, g, lane, g.cardDepth);
      if (g.activePowerUp && !g.activePowerUp.collected) drawPowerUpOrb(ctx, g, g.activePowerUp, g.cardDepth);
    }

    // Particles (halo + dot, no shadowBlur)
    for (let i = 0; i < g.particles.length; i++) {
      const p = g.particles[i];
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawPlayer(ctx, W, H, g);

    // Score popups
    g.scorePopups.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.font = "bold 22px Sora, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // Flash overlay
    if (g.flashAlpha > 0.01 && g.flashColor) {
      ctx.fillStyle = g.flashColor;
      ctx.globalAlpha = g.flashAlpha;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
    rafRef.current = requestAnimationFrame(gameLoop);
  }

  function updateParticles(g, dt) {
    let w = 0;
    for (let r = 0; r < g.particles.length; r++) {
      const p = g.particles[r];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.15 * dt;
      p.life -= dt;
      if (p.life > 0) g.particles[w++] = p;
    }
    g.particles.length = w;
  }

  function updateScorePopups(g, dt) {
    let w = 0;
    for (let r = 0; r < g.scorePopups.length; r++) {
      const p = g.scorePopups[r];
      p.y += p.vy * dt; p.vy *= 0.95; p.life -= dt;
      if (p.life > 0) g.scorePopups[w++] = p;
    }
    g.scorePopups.length = w;
  }

  /* ── Drawing: track ── */
  function drawTrack(ctx, W, H, g) {
    const horizonY = H * 0.32;
    const playerY = H * 0.82;
    const laneSep = getLaneSep();

    // Faint lane lines
    ctx.strokeStyle = "rgba(140, 160, 220, 0.12)";
    ctx.lineWidth = 1;
    for (let b = -0.5; b <= LANES - 0.5; b++) {
      const off = b - CENTER_LANE;
      ctx.beginPath();
      ctx.moveTo(W / 2 + off * laneSep, playerY);
      ctx.lineTo(W / 2, horizonY);
      ctx.stroke();
    }

    // Glowing player lane edges
    const pL = g.player.lane;
    const leftB = (pL - 0.5) - CENTER_LANE, rightB = (pL + 0.5) - CENTER_LANE;
    const edgeColor = g.streak >= 5 ? "rgba(255, 182, 39, 0.55)" : "rgba(0, 229, 255, 0.45)";
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = g.streak >= 5 ? "#FFB627" : "#00E5FF";
    ctx.shadowBlur = 18;
    for (const b of [leftB, rightB]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + b * laneSep, playerY);
      ctx.lineTo(W / 2, horizonY);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Perspective grid (horizontal lines)
    ctx.strokeStyle = "rgba(140, 160, 220, 0.08)";
    ctx.lineWidth = 1;
    const numLines = 14;
    const scroll = (g.frame * 0.008) % 1;
    for (let i = 0; i < numLines; i++) {
      const t = (i + scroll) / numLines;
      const depth = 1 - t;
      if (depth < 0 || depth > 1) continue;
      const y = getDepthY(depth);
      const sep = laneSep * (1 - depth) * 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - sep * 1.5, y);
      ctx.lineTo(W / 2 + sep * 1.5, y);
      ctx.stroke();
    }

    // Ground below player
    const gGrad = ctx.createLinearGradient(0, playerY, 0, H);
    gGrad.addColorStop(0, "rgba(13, 20, 36, 0.8)");
    gGrad.addColorStop(1, "rgba(6, 8, 15, 1)");
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, playerY, W, H - playerY);

    // Ground neon line
    ctx.strokeStyle = g.streak >= 5 ? "#FFB627" : "#FF5E7E";
    ctx.lineWidth = 2;
    ctx.shadowColor = g.streak >= 5 ? "#FFB627" : "#FF5E7E";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(0, playerY);
    ctx.lineTo(W, playerY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ── Drawing: answer card ── */
  function drawAnswerCard(ctx, g, lane, depth) {
    const answer = g.answers[lane];
    if (!answer) return;
    const x = getLaneX(lane, depth);
    const y = getDepthY(depth);
    const scale = getDepthScale(depth);
    const cardW = CARD_W * scale;
    const cardH = 100 * scale;
    if (cardW < 4) return;

    const isPlayerLane = Math.round(g.player.lane) === lane;
    const alpha = depth < 0 ? Math.max(0, 1 + depth * 3) : 1;

    let topColor, glowColor;
    if (g.answered) {
      if (answer.isCorrect) { topColor = "#4ADE80"; glowColor = "#4ADE80"; }
      else if (isPlayerLane && !g.answerCorrect) { topColor = "#EF4444"; glowColor = "#EF4444"; }
      else { topColor = "#7e8aaf"; glowColor = null; }
    } else {
      if (isPlayerLane) { topColor = "#FFB627"; glowColor = "#FFB627"; }
      else { topColor = ["#00E5FF", "#FFB627", "#FF5E7E"][lane]; glowColor = null; }
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    if (glowColor) { ctx.shadowColor = glowColor; ctx.shadowBlur = 28 * scale; }
    else { ctx.shadowColor = "rgba(0, 0, 0, 0.5)"; ctx.shadowBlur = 16 * scale; }

    // Card body (white)
    const cardGrad = ctx.createLinearGradient(0, -cardH / 2, 0, cardH / 2);
    cardGrad.addColorStop(0, "#f8faff");
    cardGrad.addColorStop(1, "#dfe4f5");
    ctx.fillStyle = cardGrad;
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 12 * scale);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Top accent
    ctx.fillStyle = topColor;
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, 4 * scale);

    // Answer text
    ctx.fillStyle = "#0d1424";
    const fontSize = Math.max(8, answer.fitFontSize * scale);
    ctx.font = `700 ${fontSize}px Sora, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(answer.text, 0, 5 * scale);

    // Lane dot
    ctx.fillStyle = ["#00E5FF", "#FFB627", "#FF5E7E"][lane];
    ctx.beginPath();
    ctx.arc(0, -cardH / 2 - 10 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ── Drawing: power-up orb ── */
  function drawPowerUpOrb(ctx, g, powerUp, depth) {
    const x = getLaneX(powerUp.lane, depth);
    const scale = getDepthScale(depth);
    const cardH = 100 * scale;
    const y = getDepthY(depth) - cardH / 2 - 26 * scale;
    const r = 16 * scale;
    if (r < 3) return;

    const color = powerUp.type === "shield" ? "#00E5FF" : "#FFB627";
    const bob = Math.sin(g.frame * 0.12) * 4 * scale;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * scale;

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0d1424";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = `${Math.max(8, r)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(powerUp.type === "shield" ? "🛡" : "⏱", 0, 1);

    ctx.restore();
  }

  /* ── Drawing: player character ── */
  function drawPlayer(ctx, W, H, g) {
    const x = getLaneX(g.player.lane, 0);
    const y = g.player.y;

    ctx.save();
    ctx.translate(x, y);

    const auraColor = g.streak >= 5 ? "#FFB627" : "#00E5FF";
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 25;

    // Aura
    ctx.fillStyle = `rgba(${g.streak >= 5 ? "255, 182, 39" : "0, 229, 255"}, 0.15)`;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.shadowBlur = 12;
    const bodyGrad = ctx.createLinearGradient(0, -25, 0, 25);
    bodyGrad.addColorStop(0, "#FF5E7E");
    bodyGrad.addColorStop(1, "#FFB627");
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, -16, -25, 32, 50, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner card
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    roundRect(ctx, -12, -20, 24, 30, 4);
    ctx.fill();

    // Lightning icon
    ctx.fillStyle = "#FF5E7E";
    ctx.beginPath();
    ctx.moveTo(2, -16); ctx.lineTo(-5, -7); ctx.lineTo(-1, -7);
    ctx.lineTo(-3, -1); ctx.lineTo(5, -10); ctx.lineTo(1, -10);
    ctx.lineTo(3, -16); ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#0d1424";
    ctx.beginPath();
    ctx.arc(-5, 14, 2.5, 0, Math.PI * 2);
    ctx.arc(5, 14, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-4, 13, 1, 0, Math.PI * 2);
    ctx.arc(6, 13, 1, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = "#0d1424";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 16, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Running legs
    const legPhase = Math.sin(g.player.bobPhase * 2);
    ctx.strokeStyle = "#FF5E7E";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, 25); ctx.lineTo(-6 + legPhase * 6, 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 25); ctx.lineTo(6 - legPhase * 6, 36);
    ctx.stroke();

    // Running arms
    ctx.strokeStyle = "#FFB627";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-16, -5); ctx.lineTo(-22 - legPhase * 5, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, -5); ctx.lineTo(22 + legPhase * 5, 5);
    ctx.stroke();

    // Ground glow
    ctx.fillStyle = `rgba(${g.streak >= 5 ? "255, 182, 39" : "0, 229, 255"}, 0.35)`;
    ctx.beginPath();
    ctx.ellipse(0, 38, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ── Effects ────────────────────────────────────────────── */
  useEffect(() => {
    resizeCanvas();
    if (!G.current) initState();
    g_lastTimeReset();
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  function g_lastTimeReset() {
    if (G.current) G.current.lastTime = 0;
  }

  // Input listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Resize listener
  useEffect(() => {
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeCanvas]);

  // Visibility change
  useEffect(() => {
    const onVisibility = () => {
      if (G.current) G.current.paused = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Mute toggle
  useEffect(() => {
    if (audioRef.current) audioRef.current.setMuted(muted);
  }, [muted]);

  /* ── Empty state ────────────────────────────────────────── */
  if (gameQuestions.length === 0) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#06080f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Sora, sans-serif",
        color: "#F2F4F8",
        padding: 24,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No questions available</div>
        <div style={{ fontSize: 14, color: "#9AA3B2", marginBottom: 24 }}>This resource has no MCQ data to play.</div>
        <button onClick={onBack} style={{
          padding: "10px 20px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#9AA3B2",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
        }}>← Back</button>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: "100vh",
      background: "#06080f",
      display: "flex",
      flexDirection: "column",
      fontFamily: "Sora, sans-serif",
      color: "#F2F4F8",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(6,8,15,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        zIndex: 10,
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          color: "#9AA3B2",
          cursor: "pointer",
        }}>← Back</button>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#FFB627",
          textAlign: "center",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 12px",
        }}>⚡ {resource?.title || "Arcade"}</div>
        <button onClick={() => setMuted((m) => !m)} style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 16,
          cursor: "pointer",
          color: muted ? "#5C6472" : "#9AA3B2",
        }}>{muted ? "🔇" : "🔊"}</button>
      </div>

      {/* Canvas container */}
      <div ref={containerRef} style={{
        flex: 1,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            touchAction: "none",
          }}
        />

        {/* ── HTML HUD overlay ── */}
        {gameState === "playing" && (
          <>
            {/* Top-left: score + lives */}
            <div style={{
              position: "absolute",
              top: 12,
              left: 16,
              zIndex: 5,
              pointerEvents: "none",
            }}>
              <div style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#F2F4F8",
                textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                lineHeight: 1,
              }}>{hudState.score}</div>
              <div style={{
                fontSize: 9,
                fontWeight: 700,
                color: "#5C6472",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginTop: 2,
              }}>Score</div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {Array.from({ length: MAX_LIVES }).map((_, i) => (
                  <div key={i} style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: i < hudState.lives
                      ? "linear-gradient(135deg, #FF5E7E, #FFB627)"
                      : "rgba(255,255,255,0.08)",
                    boxShadow: i < hudState.lives ? "0 0 8px rgba(255,94,126,0.5)" : "none",
                  }} />
                ))}
              </div>
            </div>

            {/* Top-right: streak + combo */}
            {hudState.streak > 0 && (
              <div style={{
                position: "absolute",
                top: 12,
                right: 16,
                zIndex: 5,
                pointerEvents: "none",
                textAlign: "right",
              }}>
                <div style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: hudState.streak >= 5 ? "#FFB627" : "#00E5FF",
                  textShadow: `0 0 12px ${hudState.streak >= 5 ? "rgba(255,182,39,0.6)" : "rgba(0,229,255,0.6)"}`,
                  lineHeight: 1,
                }}>{hudState.streak}🔥</div>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#5C6472",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginTop: 2,
                }}>Streak</div>
                {hudState.combo > 1 && (
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#FFB627",
                    marginTop: 4,
                  }}>{hudState.combo.toFixed(1)}x combo</div>
                )}
              </div>
            )}

            {/* Power-up badges */}
            {(powerupBadges.shield > 0 || powerupBadges.slowmo) && (
              <div style={{
                position: "absolute",
                top: 80,
                right: 16,
                zIndex: 5,
                display: "flex",
                gap: 6,
                pointerEvents: "none",
              }}>
                {powerupBadges.shield > 0 && (
                  <div style={{
                    background: "rgba(0,229,255,0.12)",
                    border: "1px solid rgba(0,229,255,0.35)",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#00E5FF",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}>🛡 {powerupBadges.shield}</div>
                )}
                {powerupBadges.slowmo && (
                  <div style={{
                    background: "rgba(255,182,39,0.12)",
                    border: "1px solid rgba(255,182,39,0.35)",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#FFB627",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}>⏱ Slow-Mo</div>
                )}
              </div>
            )}

            {/* Question card overlay */}
            {questionDisplay.text && (
              <div style={{
                position: "absolute",
                top: "12%",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 5,
                pointerEvents: "none",
                maxWidth: "90%",
                textAlign: "center",
              }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: questionDisplay.isReview ? "#FFB627" : "#5C6472",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 6,
                }}>{questionDisplay.label}</div>
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#F2F4F8",
                  lineHeight: 1.4,
                  textShadow: "0 2px 12px rgba(0,0,0,0.9)",
                }}>{questionDisplay.text}</div>
              </div>
            )}

            {/* Toast */}
            {toast.show && (
              <div style={{
                position: "absolute",
                top: "38%",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 8,
                pointerEvents: "none",
                fontSize: toast.type === "streak" ? 28 : 24,
                fontWeight: 800,
                color: toast.type === "correct" ? "#4ADE80"
                  : toast.type === "wrong" ? "#EF4444"
                  : toast.type === "streak" ? "#FFB627"
                  : "#00E5FF",
                textShadow: `0 0 20px ${
                  toast.type === "correct" ? "rgba(74,222,128,0.6)"
                  : toast.type === "wrong" ? "rgba(239,68,68,0.6)"
                  : toast.type === "streak" ? "rgba(255,182,39,0.6)"
                  : "rgba(0,229,255,0.6)"
                }`,
                animation: "toastPop 0.3s ease-out",
              }}>{toast.text}</div>
            )}

            {/* Bottom hint */}
            <div style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5,
              pointerEvents: "none",
              fontSize: 11,
              color: "rgba(140,160,220,0.4)",
              fontWeight: 600,
            }}>← / A &nbsp;&nbsp; D / → &nbsp;&nbsp;·&nbsp;&nbsp; Swipe to switch lanes</div>
          </>
        )}

        {/* Start screen overlay */}
        {gameState === "menu" && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(6,8,15,0.8)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 20,
            padding: 24,
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>⚡</div>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 28,
              marginBottom: 8,
              textAlign: "center",
              margin: 0,
              background: "linear-gradient(135deg, #FF5E7E, #FFB627)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Arcade Mode</h1>
            <div style={{
              fontSize: 14,
              color: "#9AA3B2",
              textAlign: "center",
              marginBottom: 4,
              maxWidth: 320,
            }}>{resource?.title || "Untitled Quiz"}</div>
            <div style={{
              fontSize: 12,
              color: "#5C6472",
              marginBottom: 28,
            }}>{gameQuestions.length} questions · 3 lives</div>
            <button onClick={startGame} style={{
              padding: "16px 40px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #FF5E7E, #FFB627)",
              color: "#06080f",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              marginBottom: 24,
              transition: "transform 0.15s ease",
              boxShadow: "0 4px 24px rgba(255,94,126,0.3)",
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.96)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >Start Running →</button>
            <div style={{
              display: "flex",
              gap: 16,
              fontSize: 12,
              color: "#5C6472",
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: 400,
            }}>
              <span>⬅️ / A — Left</span>
              <span>➡️ / D — Right</span>
              <span>📱 Swipe to switch lanes</span>
            </div>
            <div style={{
              marginTop: 16,
              fontSize: 11,
              color: "#5C6472",
              textAlign: "center",
              maxWidth: 300,
              lineHeight: 1.6,
            }}>
              Switch to the correct answer lane before the card reaches you. Missed questions resurface later. Collect power-ups for shields and slow-mo!
            </div>
          </div>
        )}

        {/* Game over screen overlay */}
        {gameState === "gameover" && finalStats && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            background: "rgba(6,8,15,0.92)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 20,
            padding: "24px 16px",
            overflowY: "auto",
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {finalStats.accuracy >= 70 ? "🏆" : finalStats.accuracy >= 50 ? "📊" : "🎮"}
            </div>
            <h2 style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 24,
              marginBottom: 20,
              margin: 0,
              background: "linear-gradient(135deg, #FF5E7E, #FFB627)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Run Complete!</h2>

            {/* Stat tiles */}
            <div style={{
              display: "flex",
              gap: 10,
              marginBottom: 20,
              flexWrap: "wrap",
              justifyContent: "center",
            }}>
              {[
                { val: finalStats.score, label: "Score", color: "#FFB627" },
                { val: `${finalStats.correct}/${finalStats.total}`, label: "Correct", color: "#4ADE80" },
                { val: `${finalStats.accuracy}%`, label: "Accuracy", color: "#00E5FF" },
                { val: `${finalStats.bestStreak}🔥`, label: "Best Streak", color: "#FF5E7E" },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderTop: `2px solid ${s.color}`,
                  borderRadius: 12,
                  padding: "12px 18px",
                  textAlign: "center",
                  minWidth: 72,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: "#5C6472", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Missed review */}
            {missedReview.length > 0 && (
              <div style={{ width: "100%", maxWidth: 460, marginBottom: 20 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#5C6472",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}>Missed Questions ({missedReview.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {missedReview.slice(0, 10).map((m, i) => (
                    <div key={i} style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#F2F4F8",
                        marginBottom: 6,
                        lineHeight: 1.4,
                      }}>{m.question}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                        <span style={{ color: "#EF4444" }}>
                          You: {m.yourAnswer}
                        </span>
                        <span style={{ color: "#4ADE80" }}>
                          Correct: {m.correctAnswer}
                        </span>
                      </div>
                      {m.explanation && (
                        <div style={{
                          fontSize: 11.5,
                          color: "#9AA3B2",
                          marginTop: 6,
                          lineHeight: 1.5,
                        }}>{m.explanation}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button onClick={startGame} style={{
                padding: "14px 28px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #FF5E7E, #FFB627)",
                color: "#06080f",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
              }}>Run Again →</button>
              <button onClick={onBack} style={{
                padding: "14px 24px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#9AA3B2",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}>← Back</button>
            </div>
          </div>
        )}
      </div>

      {/* Toast keyframe animation */}
      <style>{`
        @keyframes toastPop {
          0% { transform: translateX(-50%) scale(0.5); opacity: 0; }
          50% { transform: translateX(-50%) scale(1.15); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
