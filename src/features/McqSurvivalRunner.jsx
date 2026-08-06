import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { callAI } from "../lib/aiClient.js";
import { recordPracticeResult } from "../lib/studyHistory.js";
import MarkdownText from "../components/MarkdownText.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const MAX_LIVES = 3;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptions(q) {
  const entries = Object.entries(q.options);
  const shuffled = shuffleArray(entries);
  const newOptions = {};
  const remap = {};
  shuffled.forEach(([origKey, val], i) => {
    const newKey = String.fromCharCode(65 + i);
    newOptions[newKey] = val;
    remap[origKey] = newKey;
  });
  return {
    ...q,
    options: newOptions,
    correct: remap[q.correct] || q.correct,
  };
}

/* ── Audio system ──────────────────────────────────────────── */
function createAudioSystem() {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = "sine", gain = 0.15, delay = 0) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  return {
    correct(streakLevel) {
      tone(659.25, 0.1, "sine", 0.16);
      tone(830.6, 0.14, "sine", 0.13, 0.06);
      if (streakLevel % 3 === 0 && streakLevel > 0) tone(1046.5, 0.2, "sine", 0.14, 0.13);
    },
    wrong() {
      tone(196, 0.18, "sawtooth", 0.14);
      tone(150, 0.25, "sawtooth", 0.12, 0.09);
    },
    tierUp() {
      [440, 554.4, 659.25, 880].forEach((f, i) => tone(f, 0.22, "triangle", 0.13, i * 0.09));
    },
    gameOver() {
      [392, 349.2, 293.7, 220].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.12, i * 0.15));
    },
    best() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.25, "triangle", 0.14, i * 0.1));
    },
    hint() {
      tone(880, 0.09, "sine", 0.1);
    },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    ensureCtx,
  };
}

/* ── Confetti ──────────────────────────────────────────────── */
function useConfetti(canvasRef) {
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  const burst = useCallback((x, y, count = 20, colors = ["#00E5FF", "#FFB627", "#FF5E7E", "#4ADE80"]) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * -8 - 3,
        size: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 10,
      });
    }
    if (!runningRef.current) run();
  }, []);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    runningRef.current = true;

    function step() {
      cctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach(p => {
        p.vy += 0.28;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.012;
        p.rot += p.vrot;
        cctx.save();
        cctx.globalAlpha = Math.max(p.life, 0);
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot * Math.PI / 180);
        cctx.fillStyle = p.color;
        cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        cctx.restore();
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        runningRef.current = false;
      }
    }
    step();
  }, [canvasRef]);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [canvasRef]);

  return { burst };
}

/* ── Component ─────────────────────────────────────────────── */
export default function McqSurvivalRunner({ resource, shareToken, questions, onBack, onQuizComplete, onStreakUpdate, onXpUpdate }) {
  const audioRef = useRef(null);
  const confettiCanvasRef = useRef(null);
  const { burst } = useConfetti(confettiCanvasRef);
  const appRef = useRef(null);
  const qcardRef = useRef(null);
  const tierToastTimerRef = useRef(null);

  const [gameState, setGameState] = useState("playing");
  const [streak, setStreak] = useState(0);
  const [runBestStreak, setRunBestStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [currentQ, setCurrentQ] = useState(null);
  const [questionNum, setQuestionNum] = useState(0);
  const [usedIndices, setUsedIndices] = useState(new Set());
  const [missedQuestions, setMissedQuestions] = useState([]);
  const [eliminatedOptions, setEliminatedOptions] = useState(new Set());
  const [isLocked, setIsLocked] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [wasRevealed, setWasRevealed] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [aiExplainData, setAiExplainData] = useState({ text: "", loading: false });
  const [soundOn, setSoundOn] = useState(true);
  const [tierToast, setTierToast] = useState({ show: false, msg: "", color: "" });
  const [shake, setShake] = useState(false);
  const [cardFlash, setCardFlash] = useState("");
  const [streakPulse, setStreakPulse] = useState(false);

  // Review state
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const [totalMissedCount, setTotalMissedCount] = useState(0);
  const [reviewEliminated, setReviewEliminated] = useState(new Set());
  const [reviewLocked, setReviewLocked] = useState(false);
  const [reviewSelected, setReviewSelected] = useState(null);
  const [reviewBadge, setReviewBadge] = useState({ show: false, type: "" });
  const [reviewExplain, setReviewExplain] = useState({ text: "", loading: false });
  const [showReviewExplain, setShowReviewExplain] = useState(false);

  const shuffledPool = useMemo(() => {
    return shuffleArray(questions.map(shuffleOptions));
  }, [questions]);

  const currentTier = streak >= 6 ? "hard" : streak >= 3 ? "medium" : "easy";
  const tierColor = currentTier === "hard" ? "#FF5E7E" : currentTier === "medium" ? "#FFB627" : "#00E5FF";

  // Load best streak
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sc_survival_best_${resource?.id || "default"}`);
      if (raw) setBestStreak(parseInt(raw, 10) || 0);
    } catch {}
  }, [resource]);

  // Init audio on first interaction
  useEffect(() => {
    const init = () => {
      if (!audioRef.current) audioRef.current = createAudioSystem();
      audioRef.current.ensureCtx();
    };
    ["pointerdown", "keydown", "touchstart"].forEach(evt => {
      window.addEventListener(evt, init, { once: true, passive: true });
    });
    return () => {
      ["pointerdown", "keydown", "touchstart"].forEach(evt => {
        window.removeEventListener(evt, init, { once: true, passive: true });
      });
    };
  }, []);

  // Escape to exit
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && onBack) onBack(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  // Serve first question
  useEffect(() => {
    if (shuffledPool.length > 0 && !currentQ && gameState === "playing") {
      serveNextQuestion();
    }
  }, [shuffledPool, gameState]);

  function playSound(fn) {
    if (!audioRef.current) audioRef.current = createAudioSystem();
    audioRef.current[fn]();
  }

  function showTierToast(msg, color) {
    setTierToast({ show: true, msg, color });
    clearTimeout(tierToastTimerRef.current);
    tierToastTimerRef.current = setTimeout(() => setTierToast({ show: false, msg: "", color: "" }), 1100);
  }

  function getTierPct() {
    if (streak < 3) return (streak / 3) * 100;
    if (streak < 6) return ((streak - 3) / 3) * 100;
    return (((streak - 6) % 3) / 3) * 100;
  }

  function serveNextQuestion() {
    let pool = shuffledPool;
    let available = pool.map((_, i) => i).filter(i => !usedIndices.has(i));
    if (available.length === 0) {
      // All used — reset pool
      setUsedIndices(new Set());
      available = pool.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    setUsedIndices(prev => new Set(prev).add(idx));
    setCurrentQ(pool[idx]);
    setQuestionNum(prev => prev + 1);
    setEliminatedOptions(new Set());
    setIsLocked(false);
    setSelectedAnswer(null);
    setWasRevealed(false);
    setShowExplain(false);
    setAiExplainData({ text: "", loading: false });
  }

  function handleAnswer(optionKey) {
    if (isLocked || !currentQ) return;
    const isCorrect = optionKey === currentQ.correct;
    setSelectedAnswer(optionKey);
    setIsLocked(true);

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > runBestStreak) setRunBestStreak(newStreak);
      playSound("correct");
      setCardFlash("correct");
      setTimeout(() => setCardFlash(""), 500);
      setStreakPulse(true);
      setTimeout(() => setStreakPulse(false), 400);

      // Tier up check
      const newTier = newStreak >= 6 ? "hard" : newStreak >= 3 ? "medium" : "easy";
      if (newTier !== currentTier && newStreak > 0) {
        playSound("tierUp");
        if (newTier === "medium") showTierToast("⚡ Level up: Medium", "#FFB627");
        if (newTier === "hard") showTierToast("🔥 Level up: Hard", "#FF5E7E");
      }

      // Confetti on every 5-streak
      if (newStreak > 0 && newStreak % 5 === 0) {
        const rect = qcardRef.current?.getBoundingClientRect();
        if (rect) burst(rect.left + rect.width / 2, rect.top, 26);
      }
    } else {
      setMissedQuestions(prev => [...prev, { ...currentQ, picked: optionKey }]);
      setStreak(0);
      playSound("wrong");
      setCardFlash("wrong");
      setTimeout(() => setCardFlash(""), 500);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => endGame(), 600);
        }
        return newLives;
      });
    }
  }

  function handleHint() {
    if (isLocked || !currentQ) return;
    playSound("hint");
    const wrongKeys = Object.keys(currentQ.options).filter(k => k !== currentQ.correct && !eliminatedOptions.has(k));
    if (wrongKeys.length <= 1) return;
    const target = wrongKeys[Math.floor(Math.random() * wrongKeys.length)];
    setEliminatedOptions(prev => new Set(prev).add(target));
  }

  function handleReveal() {
    if (isLocked || !currentQ) return;
    setIsLocked(true);
    setWasRevealed(true);
    setMissedQuestions(prev => [...prev, { ...currentQ, picked: null }]);
    setStreak(0);
    playSound("wrong");
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setTimeout(() => endGame(), 600);
      }
      return newLives;
    });
  }

  async function handleExplain() {
    if (!currentQ) return;
    setShowExplain(true);
    setAiExplainData({ text: "", loading: true });
    try {
      const optionsStr = Object.entries(currentQ.options).map(([k, v]) => `${k}. ${v}`).join("\n");
      const correctAnswer = currentQ.options[currentQ.correct] || currentQ.correct;
      const userAnswer = selectedAnswer ? currentQ.options[selectedAnswer] : "(revealed)";
      const prompt = `You are a helpful study tutor. A student just answered this MCQ question:\n\nQuestion: ${currentQ.question}\nOptions:\n${optionsStr}\nCorrect answer: ${correctAnswer}\nStudent's answer: ${userAnswer}\n\nGive a clear, concise explanation (2-3 sentences) of why the correct answer is right. Be educational and encouraging.`;
      const text = await callAI(prompt, { provider: "openrouter" });
      setAiExplainData({ text: text || "No explanation generated.", loading: false });
    } catch {
      setAiExplainData({ text: "Could not get AI explanation. Please try again.", loading: false });
    }
  }

  function handleContinue() {
    if (lives <= 0) {
      endGame();
    } else {
      serveNextQuestion();
    }
  }

  function endGame() {
    playSound("gameOver");
    // Submit to backend
    submitAttempt();
    if (missedQuestions.length > 0) {
      setReviewQueue(missedQuestions.map(q => ({ ...q })));
      setTotalMissedCount(missedQuestions.length);
      setClearedCount(0);
      setReviewIndex(0);
      setGameState("review");
    } else {
      setGameState("gameover");
    }
  }

  async function submitAttempt() {
    if (!resource?.id) return;
    try {
      recordPracticeResult(resource.id, shuffledPool, {});
    } catch {}
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const token = authData.authToken;
      const res = await fetch(`${API_BASE}/api/resources/quiz-attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resourceId: resource.id,
          score: runBestStreak,
          total: questionNum,
          details: [],
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

  // ── Review handlers ──
  function handleReviewAnswer(optionKey) {
    if (reviewLocked) return;
    const item = reviewQueue[reviewIndex];
    const isCorrect = optionKey === item.correct;
    setReviewSelected(optionKey);
    setReviewLocked(true);

    if (isCorrect) {
      playSound("correct");
      setReviewBadge({ show: true, type: "correct" });
    } else {
      playSound("wrong");
      setReviewBadge({ show: true, type: "wrong" });
    }
  }

  function handleReviewHint() {
    if (reviewLocked) return;
    playSound("hint");
    const item = reviewQueue[reviewIndex];
    const wrongKeys = Object.keys(item.options).filter(k => k !== item.correct && !reviewEliminated.has(k));
    if (wrongKeys.length <= 1) return;
    const target = wrongKeys[Math.floor(Math.random() * wrongKeys.length)];
    setReviewEliminated(prev => new Set(prev).add(target));
  }

  function handleReviewReveal() {
    if (reviewLocked) return;
    setReviewLocked(true);
    setReviewSelected(null);
    setReviewBadge({ show: true, type: "neutral" });
  }

  async function handleReviewExplain() {
    const item = reviewQueue[reviewIndex];
    if (!item) return;
    setShowReviewExplain(true);
    setReviewExplain({ text: "", loading: true });
    try {
      const optionsStr = Object.entries(item.options).map(([k, v]) => `${k}. ${v}`).join("\n");
      const correctAnswer = item.options[item.correct] || item.correct;
      const prompt = `You are a helpful study tutor. A student is reviewing this MCQ question:\n\nQuestion: ${item.question}\nOptions:\n${optionsStr}\nCorrect answer: ${correctAnswer}\n\nGive a clear, concise explanation (2-3 sentences) of why the correct answer is right. Be educational and encouraging.`;
      const text = await callAI(prompt, { provider: "openrouter" });
      setReviewExplain({ text: text || "No explanation generated.", loading: false });
    } catch {
      setReviewExplain({ text: "Could not get AI explanation. Please try again.", loading: false });
    }
  }

  function handleReviewNext() {
    const item = reviewQueue[reviewIndex];
    const isCorrect = reviewBadge.type === "correct";

    if (isCorrect) {
      setClearedCount(prev => prev + 1);
      const newQueue = reviewQueue.filter((_, i) => i !== reviewIndex);
      if (newQueue.length === 0) {
        setGameState("gameover");
        return;
      }
      setReviewQueue(newQueue);
      setReviewIndex(0);
    } else {
      // Move to back of queue
      const newQueue = [...reviewQueue];
      const [moved] = newQueue.splice(reviewIndex, 1);
      newQueue.push(moved);
      setReviewQueue(newQueue);
      setReviewIndex(0);
    }
    // Reset review card state
    setReviewEliminated(new Set());
    setReviewLocked(false);
    setReviewSelected(null);
    setReviewBadge({ show: false, type: "" });
    setShowReviewExplain(false);
    setReviewExplain({ text: "", loading: false });
  }

  function handleRestart() {
    setGameState("playing");
    setStreak(0);
    setRunBestStreak(0);
    setLives(MAX_LIVES);
    setCurrentQ(null);
    setQuestionNum(0);
    setUsedIndices(new Set());
    setMissedQuestions([]);
    setEliminatedOptions(new Set());
    setIsLocked(false);
    setSelectedAnswer(null);
    setWasRevealed(false);
    setShowExplain(false);
    setAiExplainData({ text: "", loading: false });
    setReviewQueue([]);
    setClearedCount(0);
    setTotalMissedCount(0);
    setReviewIndex(0);
    setReviewEliminated(new Set());
    setReviewLocked(false);
    setReviewSelected(null);
    setReviewBadge({ show: false, type: "" });
    setShowReviewExplain(false);
    setReviewExplain({ text: "", loading: false });
  }

  function toggleSound() {
    const newSoundOn = !soundOn;
    setSoundOn(newSoundOn);
    if (audioRef.current) audioRef.current.setMuted(!newSoundOn);
    if (newSoundOn) {
      if (!audioRef.current) audioRef.current = createAudioSystem();
      audioRef.current.ensureCtx();
    }
  }

  // Save best streak on game over
  useEffect(() => {
    if (gameState === "gameover") {
      const isNewBest = runBestStreak > bestStreak;
      if (isNewBest) {
        setBestStreak(runBestStreak);
        try { localStorage.setItem(`sc_survival_best_${resource?.id || "default"}`, String(runBestStreak)); } catch {}
        playSound("best");
      }
    }
  }, [gameState]);

  // ── Render ──
  const ink = "#0A0D13";
  const cardBg = "#111826";
  const cardBorder = "rgba(255,255,255,0.08)";
  const blue = "#00E5FF";
  const gold = "#FFB627";
  const coral = "#FF5E7E";
  const green = "#4ADE80";
  const textHi = "#EAEEF7";
  const textDim = "#8b93a7";

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)",
      color: textHi,
      fontFamily: "Manrope, sans-serif",
      display: "flex",
      justifyContent: "center",
      overflowY: "auto",
    }}>
      <canvas ref={confettiCanvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }} />

      {/* Tier toast */}
      {tierToast.show && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700,
          padding: "9px 18px", borderRadius: 20,
          color: tierToast.color,
          background: tierToast.color + "22",
          border: `1px solid ${tierToast.color}55`,
          zIndex: 60, pointerEvents: "none",
          opacity: 1,
          animation: "tierToastSlide 0.35s ease",
        }}>{tierToast.msg}</div>
      )}

      <div
        ref={appRef}
        className={shake ? "survival-shake" : ""}
        style={{
          width: "100%",
          maxWidth: isMobile ? 520 : 640,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          padding: "max(18px, env(safe-area-inset-top)) clamp(14px, 4vw, 24px) max(18px, env(safe-area-inset-bottom))",
        }}
      >
        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: textDim }}>
              Streak Survival
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={toggleSound} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: soundOn ? blue : textDim,
              border: `1px solid ${soundOn ? "rgba(0,229,255,0.35)" : cardBorder}`,
              background: "transparent",
              padding: "4px 8px", borderRadius: 8, cursor: "pointer",
            }}>{soundOn ? "🔊 Sound" : "🔇 Muted"}</button>

            {/* Hearts */}
            <div style={{ display: "flex", gap: 6 }}>
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <div key={i} style={{
                  width: 16, height: 16,
                  background: i < lives ? coral : "transparent",
                  border: i < lives ? "none" : `1px solid ${coral}33`,
                  clipPath: i < lives
                    ? "polygon(50% 100%, 0 35%, 0 15%, 25% 0, 50% 15%, 75% 0, 100% 15%, 100% 35%)"
                    : "none",
                  borderRadius: i < lives ? 0 : "50%",
                  opacity: i < lives ? 1 : 0.3,
                  transition: "opacity 0.3s, transform 0.3s",
                }} />
              ))}
            </div>

            {/* Streak badge */}
            <div
              className={streakPulse ? "streak-pulse" : ""}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: gold,
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ display: "inline-block", transition: "transform 0.2s" }}>🔥</span> {streak}
            </div>

            {onBack && (
              <button onClick={onBack} style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)", border: `1px solid ${cardBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: textDim, cursor: "pointer", fontSize: 14, flexShrink: 0,
              }}>✕</button>
            )}
          </div>
        </div>

        {/* Tier bar */}
        {gameState === "playing" && (
          <div style={{
            height: 4,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 2,
            marginBottom: 20,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              background: `linear-gradient(90deg, ${blue}, ${gold})`,
              width: `${getTierPct()}%`,
              transition: "width 0.4s ease",
            }} />
          </div>
        )}

        {/* ── Playing screen ── */}
        {gameState === "playing" && currentQ && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              ref={qcardRef}
              className={cardFlash === "correct" ? "survival-correct-flash" : cardFlash === "wrong" ? "survival-wrong-flash" : ""}
              style={{
                background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: `1px solid ${cardBorder}`,
                borderRadius: 20,
                padding: isMobile ? 24 : 32,
                backdropFilter: "blur(20px)",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* Difficulty tag */}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em",
                color: tierColor,
                marginBottom: 10, display: "inline-block",
                padding: "3px 8px",
                background: tierColor + "1A",
                borderRadius: 6,
                alignSelf: "flex-start",
              }}>{currentTier.toUpperCase()}</span>

              {/* Question text */}
              <div style={{
                fontSize: isMobile ? 17 : 20,
                lineHeight: 1.5,
                fontWeight: 600,
                marginBottom: 20,
                color: textHi,
              }}>{currentQ.question}</div>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(currentQ.options).map(([key, value]) => {
                  const isCorrectOpt = key === currentQ.correct;
                  const isSelected = selectedAnswer === key;
                  const isEliminated = eliminatedOptions.has(key);
                  const showCorrect = isLocked && isCorrectOpt;
                  const showWrong = isLocked && isSelected && !isCorrectOpt;

                  let borderColor = cardBorder;
                  let bgColor = cardBg;
                  let textColor = textHi;

                  if (!isLocked && isSelected) { borderColor = blue; bgColor = "rgba(0,229,255,0.08)"; }
                  if (showCorrect) { borderColor = green; bgColor = "rgba(74,222,128,0.15)"; textColor = green; }
                  if (showWrong) { borderColor = coral; bgColor = "rgba(255,94,126,0.15)"; textColor = coral; }
                  if (isEliminated) { borderColor = cardBorder; bgColor = "transparent"; textColor = textDim; }

                  return (
                    <button
                      key={key}
                      onClick={() => handleAnswer(key)}
                      disabled={isLocked || isEliminated}
                      style={{
                        padding: "13px 14px",
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        color: textColor,
                        fontSize: 14,
                        textAlign: "left",
                        fontWeight: 500,
                        borderRadius: 10,
                        cursor: isLocked || isEliminated ? "default" : "pointer",
                        fontFamily: "Manrope, sans-serif",
                        opacity: isEliminated ? 0.3 : 1,
                        textDecoration: isEliminated ? "line-through" : "none",
                        transition: "opacity 0.25s, border-color 0.25s, background 0.25s",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                        fontSize: 13, opacity: 0.7, minWidth: 18,
                      }}>{key}</span>
                      <span style={{ flex: 1 }}>{value}</span>
                      {showCorrect && <span style={{ color: green }}>✓</span>}
                      {showWrong && <span style={{ color: coral }}>✗</span>}
                    </button>
                  );
                })}
              </div>

              {/* Card actions (hint / reveal) */}
              {!isLocked && (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={handleHint} disabled={isLocked} style={{
                    flex: 1, padding: "11px 10px", borderRadius: 10,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                    cursor: "pointer",
                    border: `1px solid ${cardBorder}`, background: "transparent", color: textDim,
                  }}>💡 Hint (50/50)</button>
                  <button onClick={handleReveal} disabled={isLocked} style={{
                    flex: 1, padding: "11px 10px", borderRadius: 10,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                    cursor: "pointer",
                    border: `1px solid ${cardBorder}`, background: "transparent", color: textDim,
                  }}>👁 Reveal answer</button>
                </div>
              )}

              {/* AI Explain */}
              {isLocked && !showExplain && (
                <div style={{ marginTop: 14 }}>
                  <button onClick={handleExplain} style={{
                    flex: 1, padding: "11px 10px", borderRadius: 10,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                    cursor: "pointer",
                    border: "1px solid rgba(255,182,39,0.35)",
                    background: "rgba(255,182,39,0.08)", color: gold,
                  }}>✨ AI Explain</button>
                </div>
              )}

              {showExplain && (
                <div style={{
                  fontSize: 13, lineHeight: 1.6, color: textHi,
                  background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)",
                  borderRadius: 10, padding: 12, marginTop: 14,
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    color: blue, marginBottom: 6, display: "block",
                  }}>AI Explanation</span>
                  {aiExplainData.loading ? (
                    <span className="survival-dots">Thinking</span>
                  ) : (
                    <MarkdownText>{aiExplainData.text}</MarkdownText>
                  )}
                </div>
              )}

              {/* Post-answer actions */}
              {isLocked && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={handleContinue} style={{
                    flex: 1, padding: "13px 10px", borderRadius: 10,
                    fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", border: "none",
                    background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: "#04121a",
                  }}>{lives <= 0 ? "See results" : "Continue →"}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Review screen ── */}
        {gameState === "review" && reviewQueue.length > 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>
                Review missed questions
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: textDim }}>
                {clearedCount} / {totalMissedCount} cleared
              </div>
            </div>

            <div style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              border: `1px solid ${cardBorder}`,
              borderRadius: 20,
              padding: isMobile ? 24 : 32,
              backdropFilter: "blur(20px)",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                textTransform: "uppercase", letterSpacing: "0.1em",
                color: coral, marginBottom: 10, display: "inline-block",
                padding: "3px 8px", background: "rgba(255,94,126,0.1)", borderRadius: 6,
                alignSelf: "flex-start",
              }}>MISSED — TRY AGAIN</span>

              {/* Retry badge */}
              {reviewBadge.show && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  padding: "6px 10px", borderRadius: 8, marginBottom: 14,
                  display: "inline-block", alignSelf: "flex-start",
                  color: reviewBadge.type === "correct" ? green : reviewBadge.type === "wrong" ? coral : textDim,
                  background: reviewBadge.type === "correct" ? "rgba(74,222,128,0.1)" : reviewBadge.type === "wrong" ? "rgba(255,94,126,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${reviewBadge.type === "correct" ? "rgba(74,222,128,0.3)" : reviewBadge.type === "wrong" ? "rgba(255,94,126,0.3)" : cardBorder}`,
                }}>
                  {reviewBadge.type === "correct" ? "✅ Got it this time!" : reviewBadge.type === "wrong" ? "❌ Still tricky — you'll see this one again." : "👁 Answer revealed — you'll see this one again."}
                </div>
              )}

              <div style={{
                fontSize: isMobile ? 17 : 20, lineHeight: 1.5, fontWeight: 600,
                marginBottom: 20, color: textHi,
              }}>{reviewQueue[reviewIndex].question}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(reviewQueue[reviewIndex].options).map(([key, value]) => {
                  const item = reviewQueue[reviewIndex];
                  const isCorrectOpt = key === item.correct;
                  const isSelected = reviewSelected === key;
                  const isEliminated = reviewEliminated.has(key);
                  const showCorrect = reviewLocked && isCorrectOpt;
                  const showWrong = reviewLocked && isSelected && !isCorrectOpt;

                  let borderColor = cardBorder;
                  let bgColor = cardBg;
                  let textColor = textHi;

                  if (showCorrect) { borderColor = green; bgColor = "rgba(74,222,128,0.15)"; textColor = green; }
                  if (showWrong) { borderColor = coral; bgColor = "rgba(255,94,126,0.15)"; textColor = coral; }
                  if (isEliminated) { borderColor = cardBorder; bgColor = "transparent"; textColor = textDim; }

                  return (
                    <button
                      key={key}
                      onClick={() => handleReviewAnswer(key)}
                      disabled={reviewLocked || isEliminated}
                      style={{
                        padding: "13px 14px",
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        color: textColor,
                        fontSize: 14, textAlign: "left", fontWeight: 500,
                        borderRadius: 10,
                        cursor: reviewLocked || isEliminated ? "default" : "pointer",
                        fontFamily: "Manrope, sans-serif",
                        opacity: isEliminated ? 0.3 : 1,
                        textDecoration: isEliminated ? "line-through" : "none",
                        transition: "opacity 0.25s, border-color 0.25s, background 0.25s",
                        display: "flex", alignItems: "center", gap: 10,
                      }}
                    >
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13, opacity: 0.7, minWidth: 18 }}>{key}</span>
                      <span style={{ flex: 1 }}>{value}</span>
                      {showCorrect && <span style={{ color: green }}>✓</span>}
                      {showWrong && <span style={{ color: coral }}>✗</span>}
                    </button>
                  );
                })}
              </div>

              {/* Review card actions */}
              {!reviewLocked && (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={handleReviewHint} style={{
                    flex: 1, padding: "11px 10px", borderRadius: 10,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                    cursor: "pointer",
                    border: `1px solid ${cardBorder}`, background: "transparent", color: textDim,
                  }}>💡 Hint (50/50)</button>
                  <button onClick={handleReviewReveal} style={{
                    flex: 1, padding: "11px 10px", borderRadius: 10,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                    cursor: "pointer",
                    border: `1px solid ${cardBorder}`, background: "transparent", color: textDim,
                  }}>👁 Reveal answer</button>
                </div>
              )}

              {/* Review AI Explain */}
              {reviewLocked && !showReviewExplain && (
                <div style={{ marginTop: 14 }}>
                  <button onClick={handleReviewExplain} style={{
                    flex: 1, padding: "11px 10px", borderRadius: 10,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                    cursor: "pointer",
                    border: "1px solid rgba(255,182,39,0.35)",
                    background: "rgba(255,182,39,0.08)", color: gold,
                  }}>✨ AI Explain</button>
                </div>
              )}

              {showReviewExplain && (
                <div style={{
                  fontSize: 13, lineHeight: 1.6, color: textHi,
                  background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)",
                  borderRadius: 10, padding: 12, marginTop: 14,
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    color: blue, marginBottom: 6, display: "block",
                  }}>AI Explanation</span>
                  {reviewExplain.loading ? (
                    <span className="survival-dots">Thinking</span>
                  ) : (
                    <MarkdownText>{reviewExplain.text}</MarkdownText>
                  )}
                </div>
              )}

              {/* Review post-actions */}
              {reviewLocked && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={handleReviewNext} style={{
                    flex: 1, padding: "13px 10px", borderRadius: 10,
                    fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", border: "none",
                    background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: "#04121a",
                  }}>{reviewBadge.type === "correct" && reviewQueue.length === 1 ? "Finish" : "Next"}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── End screen ── */}
        {gameState === "gameover" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: textDim,
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>You survived</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 52, fontWeight: 800,
              background: `linear-gradient(135deg, ${coral}, ${gold})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", margin: "10px 0",
            }}>{runBestStreak}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: textDim,
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>questions in a row</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: gold,
                border: "1px solid rgba(255,182,39,0.35)", background: "rgba(255,182,39,0.08)",
                padding: "5px 12px", borderRadius: 20,
              }}>Best: {bestStreak}</span>
              {runBestStreak >= bestStreak && runBestStreak > 0 && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: ink,
                  background: `linear-gradient(135deg, ${gold}, ${coral})`,
                  padding: "5px 12px", borderRadius: 20, fontWeight: 700,
                }}>🏆 New best!</span>
              )}
            </div>

            {totalMissedCount > 0 && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: textDim,
                marginTop: 12, lineHeight: 1.5,
              }}>
                Reviewed {totalMissedCount} missed question{totalMissedCount > 1 ? "s" : ""} — cleared every one of them.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={handleRestart} style={{
                flex: 1, padding: 14,
                background: `linear-gradient(135deg, ${blue}, #0aa8c4)`,
                color: "#04121a", fontSize: 15, fontWeight: 700,
                border: "none", borderRadius: 10, cursor: "pointer",
                fontFamily: "Manrope, sans-serif",
              }}>Try again</button>
              <button onClick={onBack} style={{
                flex: 1, padding: 14,
                background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`,
                color: textDim, fontSize: 15, fontWeight: 700,
                borderRadius: 10, cursor: "pointer",
                fontFamily: "Manrope, sans-serif",
              }}>← Back</button>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes survivalShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .survival-shake { animation: survivalShake 0.4s ease; }
        @keyframes survivalCorrectGlow {
          0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
          100% { box-shadow: 0 0 30px 6px rgba(74,222,128,0); }
        }
        .survival-correct-flash { animation: survivalCorrectGlow 0.5s ease; }
        @keyframes survivalWrongGlow {
          0% { box-shadow: 0 0 0 0 rgba(255,94,126,0.6); }
          100% { box-shadow: 0 0 30px 6px rgba(255,94,126,0); }
        }
        .survival-wrong-flash { animation: survivalWrongGlow 0.5s ease; }
        @keyframes firePulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.6) rotate(-8deg); }
          100% { transform: scale(1); }
        }
        .streak-pulse span:first-child { animation: firePulse 0.4s ease; }
        @keyframes tierToastSlide {
          0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes survivalDots {
          0% { content: '.'; }
          33% { content: '..'; }
          66% { content: '...'; }
          100% { content: '.'; }
        }
        .survival-dots::after { content: '\\00a0'; animation: survivalDots 1.2s steps(4, end) infinite; }
        button:focus-visible {
          outline: 2px solid ${gold};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
