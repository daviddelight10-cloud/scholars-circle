import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { recordPracticeResult } from "../lib/studyHistory.js";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://scholars-circle-production.up.railway.app";
const XP_PER_CORRECT = 20;
const LANES = 3;
const MAX_LIVES = 3;

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

/* ── Audio system (Web Audio API, no external files) ────────── */
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

  function beep(freq, dur, type = "sine", vol = 0.15) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }

  return {
    correct() {
      beep(660, 0.12, "sine", 0.12);
      setTimeout(() => beep(880, 0.1, "sine", 0.1), 60);
    },
    wrong() {
      beep(200, 0.2, "sawtooth", 0.1);
    },
    powerup() {
      beep(440, 0.08, "square", 0.08);
      setTimeout(() => beep(660, 0.08, "square", 0.08), 50);
      setTimeout(() => beep(880, 0.12, "square", 0.08), 100);
    },
    gameover() {
      beep(330, 0.15, "triangle", 0.12);
      setTimeout(() => beep(220, 0.2, "triangle", 0.1), 120);
      setTimeout(() => beep(165, 0.3, "triangle", 0.08), 280);
    },
    start() {
      beep(523, 0.1, "sine", 0.1);
      setTimeout(() => beep(659, 0.1, "sine", 0.1), 80);
      setTimeout(() => beep(784, 0.15, "sine", 0.1), 160);
    },
    setMuted(m) {
      muted = m;
    },
    isMuted() {
      return muted;
    },
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
  const [gameState, setGameState] = useState("menu"); // menu | playing | gameover
  const [muted, setMuted] = useState(false);
  const [finalStats, setFinalStats] = useState(null);
  const [missedReview, setMissedReview] = useState([]);
  const [powerupBadges, setPowerupBadges] = useState({ shield: 0, slowmo: 0 });

  /* Parse MCQ data */
  const gameQuestions = useMemo(() => {
    const raw = resource?.mcqData;
    if (!raw) return [];
    let parsed = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    return shuffleArray(parsed).map((mcq, i) => mcqToGameQuestion(mcq, i));
  }, [resource]);

  /* All mutable game state in refs */
  const G = useRef(null);

  function initState() {
    G.current = {
      score: 0,
      streak: 0,
      bestStreak: 0,
      lives: MAX_LIVES,
      cardDepth: 0,
      speed: 3,
      baseSpeed: 3,
      playerLane: 1,
      playerX: 1,
      playerTargetX: 1,
      particles: [],
      stars: [],
      speedLines: [],
      currentQ: null,
      currentOptions: [],
      answered: false,
      answerFlash: 0,
      answerFlashCorrect: false,
      questionIndex: 0,
      questionsSeen: 0,
      reviewQueue: [],
      missedThisRun: [],
      answers: {},
      shieldActive: 0,
      slowmoActive: 0,
      powerupChance: 0,
      flashOverlay: 0,
      shakeAmount: 0,
      lastTime: 0,
      paused: false,
      trackOffset: 0,
      vignettePulse: 0,
      correctCount: 0,
      totalCount: 0,
      timePerQuestion: {},
      questionStartTime: 0,
      gameStartTime: 0,
    };
    // init stars
    for (let i = 0; i < 60; i++) {
      G.current.stars.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() * 0.8 + 0.2,
        size: Math.random() * 2 + 0.5,
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
    // Check review queue first
    if (g.reviewQueue.length > 0 && g.reviewQueue[0].due <= g.questionsSeen) {
      q = g.reviewQueue.shift().question;
    } else if (g.questionIndex < gameQuestions.length) {
      q = gameQuestions[g.questionIndex];
      g.questionIndex++;
    } else if (g.reviewQueue.length > 0) {
      q = g.reviewQueue.shift().question;
    } else {
      // All questions exhausted — game over
      endGame();
      return;
    }

    g.currentQ = q;
    g.answered = false;
    g.answerFlash = 0;
    g.questionStartTime = performance.now();

    // Build 3-lane options: correct + 2 wrongs, shuffled
    const correctLane = Math.floor(Math.random() * LANES);
    const wrongPool = [...q.wrongs];
    g.currentOptions = [];
    for (let i = 0; i < LANES; i++) {
      if (i === correctLane) {
        g.currentOptions.push({ text: q.a, isCorrect: true, lane: i });
      } else {
        const w = wrongPool.shift() || "—";
        g.currentOptions.push({ text: w, isCorrect: false, lane: i });
      }
    }
    g.correctLane = correctLane;
    g.cardDepth = 0;
  }

  /* ── Answer question ────────────────────────────────────── */
  function answerQuestion(lane) {
    const g = G.current;
    if (!g || g.answered || !g.currentQ) return;

    g.answered = true;
    const opt = g.currentOptions[lane];
    const isCorrect = opt && opt.isCorrect;
    const elapsed = performance.now() - g.questionStartTime;
    g.timePerQuestion[g.questionsSeen] = elapsed;

    // Record answer for weak spot tracking
    const qIdx = g.currentQ.index;
    g.answers[qIdx] = isCorrect ? g.currentQ.correctKey : String.fromCharCode(65 + lane);
    g.totalCount++;

    if (isCorrect) {
      g.correctCount++;
      g.score += 100 + g.streak * 10;
      g.streak++;
      if (g.streak > g.bestStreak) g.bestStreak = g.streak;
      g.answerFlash = 1;
      g.answerFlashCorrect = true;
      g.flashOverlay = 0.3;
      audioRef.current?.correct();
      spawnParticles(g.playerX, getCanvasHeight() * 0.78, "#3ECF8E", 20);
      // Speed up slightly
      g.speed = Math.min(g.baseSpeed + g.streak * 0.15, 7);
      // Power-up chance
      if (g.streak > 0 && g.streak % 5 === 0) {
        g.powerupChance = 1;
      }
    } else {
      g.streak = 0;
      g.answerFlash = 1;
      g.answerFlashCorrect = false;
      g.shakeAmount = 8;
      g.flashOverlay = 0.4;
      audioRef.current?.wrong();

      // Shield absorbs one hit
      if (g.shieldActive > 0) {
        g.shieldActive--;
        setPowerupBadges({ shield: g.shieldActive, slowmo: g.slowmoActive });
      } else {
        g.lives--;
      }

      // Add to missed list
      g.missedThisRun.push({
        question: g.currentQ.q,
        correctAnswer: g.currentQ.a,
        yourAnswer: opt ? opt.text : "—",
        explanation: g.currentQ.explanation,
      });

      // Add to review queue (resurface 6-9 questions later)
      g.reviewQueue.push({
        question: g.currentQ,
        due: g.questionsSeen + 6 + Math.floor(Math.random() * 4),
      });

      if (g.lives <= 0) {
        setTimeout(() => endGame(), 600);
        return;
      }
    }

    g.questionsSeen++;
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

  function spawnParticles(x, y, color, count) {
    const g = G.current;
    if (!g) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      g.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        color,
        size: Math.random() * 3 + 1,
      });
    }
  }

  /* ── End game ───────────────────────────────────────────── */
  function endGame() {
    const g = G.current;
    if (!g) return;
    g.paused = true;
    audioRef.current?.gameover();

    const stats = {
      score: g.score,
      bestStreak: g.bestStreak,
      correct: g.correctCount,
      total: g.totalCount,
      accuracy:
        g.totalCount > 0
          ? Math.round((g.correctCount / g.totalCount) * 100)
          : 0,
    };
    setFinalStats(stats);
    setMissedReview([...g.missedThisRun]);
    setGameState("gameover");

    // Submit to backend
    submitResults(g);
  }

  async function submitResults(g) {
    if (!resource?.id) return;

    // Track weak spots locally
    try {
      const mcqsForWeak = gameQuestions.map((gq) => ({
        question: gq.q,
        options: gq.options,
        correct: gq.correctKey,
        explanation: gq.explanation,
      }));
      recordPracticeResult(resource.id, mcqsForWeak, g.answers);
    } catch {}

    try {
      const authData = JSON.parse(
        localStorage.getItem("scholars-circle-auth") || "{}",
      );
      const token = authData.authToken;
      const details = Object.keys(g.answers).map((idx) => {
        const gq = gameQuestions[parseInt(idx)];
        return {
          questionIndex: parseInt(idx),
          correct: gq ? g.answers[idx] === gq.correctKey : false,
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
        if (data.streak != null && onStreakUpdate)
          onStreakUpdate(data.streak, data.longestStreak);
        if (data.xpAwarded > 0 && onXpUpdate) onXpUpdate(data.xpAwarded);
      }
    } catch {}
  }

  /* ── Start game ─────────────────────────────────────────── */
  function startGame() {
    if (!audioRef.current) audioRef.current = createAudioSystem();
    audioRef.current.start();
    initState();
    setPowerupBadges({ shield: 0, slowmo: 0 });
    setFinalStats(null);
    setMissedReview([]);
    setGameState("playing");
    spawnNextQuestion();
  }

  /* ── Input handlers ─────────────────────────────────────── */
  function handleKeyDown(e) {
    const g = G.current;
    if (!g || gameState !== "playing") return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      g.playerTargetX = 0;
      answerQuestion(0);
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S" || e.key === "ArrowUp") {
      e.preventDefault();
      g.playerTargetX = 1;
      answerQuestion(1);
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      g.playerTargetX = 2;
      answerQuestion(2);
    }
  }

  function handleTouch(e) {
    const g = G.current;
    if (!g || gameState !== "playing") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const third = rect.width / 3;
    const lane = x < third ? 0 : x < third * 2 ? 1 : 2;
    g.playerTargetX = lane;
    answerQuestion(lane);
  }

  /* ── Game loop ──────────────────────────────────────────── */
  function gameLoop(timestamp) {
    const g = G.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const ctx = canvas.getContext("2d");
    const W = getCanvasWidth();
    const H = getCanvasHeight();

    if (g.paused) {
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = g.lastTime ? Math.min((timestamp - g.lastTime) / 16.67, 3) : 1;
    g.lastTime = timestamp;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0A0D13");
    bgGrad.addColorStop(0.5, "#0D1220");
    bgGrad.addColorStop(1, "#0A0D13");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Screen shake
    let shakeX = 0,
      shakeY = 0;
    if (g.shakeAmount > 0) {
      shakeX = (Math.random() - 0.5) * g.shakeAmount;
      shakeY = (Math.random() - 0.5) * g.shakeAmount;
      g.shakeAmount *= 0.85;
      if (g.shakeAmount < 0.1) g.shakeAmount = 0;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Draw stars
    g.stars.forEach((s) => {
      s.y += s.z * 0.3 * dt;
      if (s.y > 1) s.y = 0;
      const px = s.x * W;
      const py = s.y * H;
      ctx.fillStyle = `rgba(255,255,255,${s.z * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw track
    drawTrack(ctx, W, H, g, dt);

    // Draw speed lines
    drawSpeedLines(ctx, W, H, g, dt);

    // Draw answer cards
    if (g.currentQ && !g.answered) {
      drawAnswerCards(ctx, W, H, g, dt);
    } else if (g.currentQ && g.answered && g.answerFlash > 0) {
      drawAnswerCards(ctx, W, H, g, dt);
      g.answerFlash -= 0.03 * dt;
    }

    // Draw player
    drawPlayer(ctx, W, H, g, dt);

    // Draw particles
    drawParticles(ctx, g, dt);

    // Draw flash overlay
    if (g.flashOverlay > 0) {
      ctx.fillStyle = g.answerFlashCorrect
        ? `rgba(62,207,142,${g.flashOverlay})`
        : `rgba(255,107,94,${g.flashOverlay})`;
      ctx.fillRect(0, 0, W, H);
      g.flashOverlay *= 0.88;
      if (g.flashOverlay < 0.01) g.flashOverlay = 0;
    }

    // Draw vignette
    drawVignette(ctx, W, H, g, dt);

    ctx.restore();

    // Draw HUD
    drawHUD(ctx, W, H, g);

    // Update game state
    if (g.currentQ && !g.answered) {
      g.cardDepth += g.speed * dt * (g.slowmoActive > 0 ? 0.4 : 1);
      // Card reached player
      if (g.cardDepth >= 1) {
        // Auto-answer: if player is in correct lane, correct; otherwise wrong
        const playerLane = Math.round(g.playerTargetX);
        answerQuestion(playerLane);
        // Move to next after brief flash
        setTimeout(() => {
          if (G.current && !G.current.paused) spawnNextQuestion();
        }, 400);
      }
    } else if (g.answered && g.answerFlash <= 0) {
      spawnNextQuestion();
    }

    // Update power-up timers
    if (g.slowmoActive > 0) {
      g.slowmoActive -= dt * 0.016;
      if (g.slowmoActive <= 0) {
        g.slowmoActive = 0;
        setPowerupBadges({ shield: g.shieldActive, slowmo: 0 });
      }
    }

    // Award power-up
    if (g.powerupChance > 0 && g.streak > 0 && g.streak % 5 === 0) {
      g.powerupChance = 0;
      const type = Math.random() < 0.5 ? "shield" : "slowmo";
      if (type === "shield") g.shieldActive++;
      else g.slowmoActive = 5;
      setPowerupBadges({ shield: g.shieldActive, slowmo: Math.ceil(g.slowmoActive) });
      audioRef.current?.powerup();
    }

    // Smooth player position
    const targetPx = g.playerTargetX;
    g.playerX += (targetPx - g.playerX) * 0.2 * dt;

    rafRef.current = requestAnimationFrame(gameLoop);
  }

  /* ── Drawing functions ──────────────────────────────────── */
  function drawTrack(ctx, W, H, g, dt) {
    g.trackOffset += g.speed * dt * 4;
    if (g.trackOffset > 60) g.trackOffset -= 60;

    const laneW = W / LANES;
    const vanishY = H * 0.15;
    const vanishX = W / 2;

    // Lane dividers
    for (let i = 1; i < LANES; i++) {
      const topX = vanishX + (i - LANES / 2) * 20;
      const botX = i * laneW;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(topX, vanishY);
      ctx.lineTo(botX, H);
      ctx.stroke();
    }

    // Track edges
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vanishX - LANES * 10, vanishY);
    ctx.lineTo(0, H);
    ctx.moveTo(vanishX + LANES * 10, vanishY);
    ctx.lineTo(W, H);
    ctx.stroke();

    // Dashed center lines moving
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.setLineDash([20, 40]);
    ctx.lineDashOffset = -g.trackOffset;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(W / LANES * i, vanishY);
      ctx.lineTo(W / LANES * i, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawSpeedLines(ctx, W, H, g, dt) {
    if (g.speed < 4) return;
    const intensity = Math.min((g.speed - 3) / 4, 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.04 * intensity})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const len = 20 + Math.random() * 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }

  function drawAnswerCards(ctx, W, H, g, dt) {
    if (!g.currentOptions.length) return;
    const laneW = W / LANES;
    const vanishY = H * 0.15;
    const playerY = H * 0.78;

    // Perspective interpolation
    const depth = g.answered ? 1 : g.cardDepth;
    const easedDepth = depth * depth * (3 - 2 * depth); // smoothstep

    for (let i = 0; i < g.currentOptions.length; i++) {
      const opt = g.currentOptions[i];
      const laneCenterBot = i * laneW + laneW / 2;
      const laneCenterTop = W / 2 + (i - LANES / 2 + 0.5) * 24;

      const cx = laneCenterTop + (laneCenterBot - laneCenterTop) * easedDepth;
      const cy = vanishY + (playerY - vanishY) * easedDepth;

      const cardWTop = 20;
      const cardWBot = laneW * 0.85;
      const cardW = cardWTop + (cardWBot - cardWTop) * easedDepth;
      const cardH = 30 + 80 * easedDepth;
      const fontSize = 8 + 16 * easedDepth;

      // Card background
      let bgColor = "rgba(20,26,42,0.92)";
      let borderColor = "rgba(255,255,255,0.12)";
      if (g.answered) {
        if (opt.isCorrect) {
          bgColor = "rgba(62,207,142,0.2)";
          borderColor = "rgba(62,207,142,0.6)";
        } else if (i === g.playerTargetX) {
          bgColor = "rgba(255,107,94,0.2)";
          borderColor = "rgba(255,107,94,0.6)";
        }
      }

      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8 + 4 * easedDepth);
      ctx.fill();
      ctx.stroke();

      // Card text
      if (easedDepth > 0.15) {
        ctx.fillStyle = `rgba(232,234,246,${Math.min(easedDepth * 1.5, 1)})`;
        ctx.font = `${fontSize}px Manrope, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const maxWidth = cardW - 16;
        const text = truncateText(ctx, opt.text, maxWidth);
        ctx.fillText(text, cx, cy);
      }

      // Lane indicator (correct/wrong flash)
      if (g.answered && g.answerFlash > 0) {
        const flashAlpha = g.answerFlash * 0.5;
        if (opt.isCorrect) {
          ctx.strokeStyle = `rgba(62,207,142,${flashAlpha})`;
          ctx.lineWidth = 3;
          roundRect(ctx, cx - cardW / 2 - 2, cy - cardH / 2 - 2, cardW + 4, cardH + 4, 10);
          ctx.stroke();
        }
      }
    }
  }

  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && ctx.measureText(truncated + "…").width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "…";
  }

  function drawPlayer(ctx, W, H, g, dt) {
    const laneW = W / LANES;
    const playerY = H * 0.82;
    const px = g.playerX * laneW + laneW / 2;
    const size = 18;

    // Shield aura
    if (g.shieldActive > 0) {
      ctx.strokeStyle = `rgba(79,124,255,${0.4 + Math.sin(performance.now() / 200) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, playerY, size + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Glow
    const glowGrad = ctx.createRadialGradient(px, playerY, 0, px, playerY, size * 2);
    glowGrad.addColorStop(0, "rgba(232,184,75,0.3)");
    glowGrad.addColorStop(1, "rgba(232,184,75,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(px - size * 2, playerY - size * 2, size * 4, size * 4);

    // Ship body (triangle)
    ctx.fillStyle = "#E8B84B";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, playerY - size);
    ctx.lineTo(px - size * 0.7, playerY + size * 0.6);
    ctx.lineTo(px, playerY + size * 0.3);
    ctx.lineTo(px + size * 0.7, playerY + size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Engine trail
    ctx.fillStyle = `rgba(255,107,94,${0.4 + Math.sin(performance.now() / 80) * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(px - 5, playerY + size * 0.5);
    ctx.lineTo(px, playerY + size + 8 + Math.random() * 4);
    ctx.lineTo(px + 5, playerY + size * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  function drawParticles(ctx, g, dt) {
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.15 * dt;
      p.life -= 0.02 * dt;
      if (p.life <= 0) {
        g.particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = p.color.replace(")", `,${p.life})`).replace("rgb", "rgba");
      if (p.color.startsWith("#")) {
        // Convert hex to rgba
        const r = parseInt(p.color.slice(1, 3), 16);
        const gr = parseInt(p.color.slice(3, 5), 16);
        const b = parseInt(p.color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r},${gr},${b},${p.life})`;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawVignette(ctx, W, H, g, dt) {
    g.vignettePulse += dt * 0.02;
    const intensity = 0.3 + Math.sin(g.vignettePulse) * 0.05;
    const grad = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.3,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.7,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawHUD(ctx, W, H, g) {
    // Score
    ctx.fillStyle = "rgba(232,234,246,0.9)";
    ctx.font = "bold 20px Manrope, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${g.score}`, 16, 14);

    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(154,163,178,0.7)";
    ctx.fillText("SCORE", 16, 38);

    // Streak
    if (g.streak > 0) {
      ctx.fillStyle = "#E8B84B";
      ctx.font = "bold 16px Manrope, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${g.streak}x`, W - 16, 14);
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(232,184,75,0.6)";
      ctx.fillText("STREAK", W - 16, 34);
    }

    // Lives (hearts)
    const heartY = 56;
    for (let i = 0; i < MAX_LIVES; i++) {
      const hx = 16 + i * 18;
      ctx.fillStyle = i < g.lives ? "#FF6B5E" : "rgba(255,255,255,0.08)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("\u2665", hx, heartY);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ── Effects ────────────────────────────────────────────── */
  useEffect(() => {
    if (gameState === "playing") {
      resizeCanvas();
      g_lastTimeReset();
      rafRef.current = requestAnimationFrame(gameLoop);
    }
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
    if (gameState !== "playing") return;
    window.addEventListener("keydown", handleKeyDown);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("touchstart", handleTouch, { passive: false });
      canvas.addEventListener("touchend", handleTouch, { passive: false });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTouch);
        canvas.removeEventListener("touchend", handleTouch);
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
        background: "#0A0D13",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Manrope, sans-serif",
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
      background: "#0A0D13",
      display: "flex",
      flexDirection: "column",
      fontFamily: "Manrope, sans-serif",
      color: "#F2F4F8",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: "rgba(10,13,19,0.8)",
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
          color: "#E8B84B",
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

        {/* Power-up badges overlay */}
        {gameState === "playing" && (powerupBadges.shield > 0 || powerupBadges.slowmo > 0) && (
          <div style={{
            position: "absolute",
            top: 76,
            right: 16,
            display: "flex",
            gap: 8,
            zIndex: 5,
          }}>
            {powerupBadges.shield > 0 && (
              <div style={{
                background: "rgba(79,124,255,0.15)",
                border: "1px solid rgba(79,124,255,0.4)",
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 700,
                color: "#4f7cff",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}>🛡️ {powerupBadges.shield}</div>
            )}
            {powerupBadges.slowmo > 0 && (
              <div style={{
                background: "rgba(167,139,250,0.15)",
                border: "1px solid rgba(167,139,250,0.4)",
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 700,
                color: "#a78bfa",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}>🐌 {powerupBadges.slowmo}s</div>
            )}
          </div>
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
            background: "rgba(10,13,19,0.85)",
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
            }}>{gameQuestions.length} questions</div>
            <button onClick={startGame} style={{
              padding: "16px 40px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #E8B84B, #FF6B5E)",
              color: "#0A0D13",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              marginBottom: 24,
              transition: "transform 0.15s ease",
              boxShadow: "0 4px 20px rgba(232,184,75,0.3)",
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
              <span>⬇️ / S — Center</span>
              <span>➡️ / D — Right</span>
              <span>📱 Tap left/center/right</span>
            </div>
            <div style={{
              marginTop: 16,
              fontSize: 11,
              color: "#5C6472",
              textAlign: "center",
              maxWidth: 300,
              lineHeight: 1.6,
            }}>
              Pick the correct answer lane before the card reaches you. Miss a question and it resurfaces later. 3 lives — how far can you go?
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
            background: "rgba(10,13,19,0.92)",
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
                { val: finalStats.score, label: "Score", color: "#E8B84B" },
                { val: `${finalStats.correct}/${finalStats.total}`, label: "Correct", color: "#3ECF8E" },
                { val: `${finalStats.accuracy}%`, label: "Accuracy", color: "#4f7cff" },
                { val: `${finalStats.bestStreak}x`, label: "Best Streak", color: "#FF6B5E" },
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
                        <span style={{ color: "#FF6B5E" }}>
                          You: {m.yourAnswer}
                        </span>
                        <span style={{ color: "#3ECF8E" }}>
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
                background: "linear-gradient(135deg, #E8B84B, #FF6B5E)",
                color: "#0A0D13",
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
    </div>
  );
}
