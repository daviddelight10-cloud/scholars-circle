import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { callAI } from "../lib/aiClient.js";
import MarkdownText from "../components/MarkdownText.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const XP_PER_CORRECT = 20;
const BASE_LEVEL_BONUS = 100;
const FIRST_LEVEL_SIZE = 5;
const LEVEL_SIZE = 10;

function questionsForLevel(idx) {
  return idx === 0 ? FIRST_LEVEL_SIZE : LEVEL_SIZE;
}

function levelIndexForQuestion(qIdx) {
  if (qIdx < FIRST_LEVEL_SIZE) return 0;
  return 1 + Math.floor((qIdx - FIRST_LEVEL_SIZE) / LEVEL_SIZE);
}

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
  return { ...q, options: newOptions, correct: remap[q.correct] || q.correct };
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= breakpoint : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

/* ── Audio ── */
function createAudioSystem() {
  let ctx = null, muted = false;
  function ensureCtx() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = "sine", gain = 0.15, delay = 0) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(c.destination); osc.start(t0); osc.stop(t0 + dur);
  }
  return {
    correct() { tone(659.25, 0.1); tone(830.6, 0.14, "sine", 0.13, 0.06); },
    wrong() { tone(196, 0.18, "sawtooth", 0.14); tone(150, 0.25, "sawtooth", 0.12, 0.09); },
    levelUp() { [440, 554.4, 659.25, 880].forEach((f, i) => tone(f, 0.22, "triangle", 0.13, i * 0.09)); },
    complete() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.25, "triangle", 0.14, i * 0.1)); },
    cascade() { tone(440, 0.08, "sine", 0.1); tone(587.33, 0.12, "sine", 0.1, 0.05); },
    mastery() { [659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.2, "triangle", 0.14, i * 0.08)); },
    hint() { tone(523.25, 0.08, "sine", 0.1); tone(659.25, 0.1, "sine", 0.08, 0.04); },
    setMuted(m) { muted = m; }, isMuted() { return muted; }, ensureCtx,
  };
}

/* ── Confetti ── */
function useConfetti(canvasRef) {
  const particlesRef = useRef([]), rafRef = useRef(null), runningRef = useRef(false);
  const burst = useCallback((x, y, count = 20, colors = ["#00E5FF", "#FFB627", "#FF5E7E", "#4ADE80"]) => {
    for (let i = 0; i < count; i++) particlesRef.current.push({
      x, y, vx: (Math.random() - 0.5) * 8, vy: Math.random() * -8 - 3,
      size: Math.random() * 5 + 3, color: colors[Math.floor(Math.random() * colors.length)],
      life: 1, rot: Math.random() * 360, vrot: (Math.random() - 0.5) * 10,
    });
    if (!runningRef.current) run();
  }, []);
  const run = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const cctx = canvas.getContext("2d"); runningRef.current = true;
    function step() {
      cctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach(p => {
        p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.life -= 0.012; p.rot += p.vrot;
        cctx.save(); cctx.globalAlpha = Math.max(p.life, 0);
        cctx.translate(p.x, p.y); cctx.rotate(p.rot * Math.PI / 180);
        cctx.fillStyle = p.color; cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        cctx.restore();
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      if (particlesRef.current.length > 0) rafRef.current = requestAnimationFrame(step);
      else runningRef.current = false;
    }
    step();
  }, [canvasRef]);
  useEffect(() => {
    const onResize = () => { const c = canvasRef.current; if (c) { c.width = window.innerWidth; c.height = window.innerHeight; } };
    onResize(); window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [canvasRef]);
  return { burst };
}

/* ── Persistence ── */
function saveProgress(resourceId, state) {
  try { localStorage.setItem(`sc_cascade_progress_${resourceId}`, JSON.stringify(state)); } catch {}
}
function loadProgress(resourceId) {
  try { const raw = localStorage.getItem(`sc_cascade_progress_${resourceId}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearProgress(resourceId) {
  try { localStorage.removeItem(`sc_cascade_progress_${resourceId}`); } catch {}
}

/* ── Rail geometry ── */
function buildRailPoints(numLevels) {
  const points = [];
  const totalNodes = numLevels + 1; // levels + mastery
  for (let i = 0; i < totalNodes; i++) {
    const t = i / (totalNodes - 1);
    const x = 8 + t * 84;
    const y = i % 2 === 0 ? 70 : 24;
    points.push({ x, y });
  }
  return points;
}

function buildSmoothPath(points) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1], p1 = points[i];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

const LEVEL_COLORS = ["#00E5FF", "#00E5FF", "#FFB627", "#FFB627", "#FF5E7E", "#4ADE80"];

function getLevelColor(idx, total) {
  if (idx >= total - 1) return "#4ADE80"; // mastery
  return LEVEL_COLORS[Math.min(idx, LEVEL_COLORS.length - 1)];
}

/* ── Component ─────────────────────────────────────────────── */
export default function McqCascadeRunner({ resource, shareToken, questions, onBack, onQuizComplete, onStreakUpdate, onXpUpdate }) {
  const isMobile = useIsMobile();
  const audioRef = useRef(null);
  const confettiCanvasRef = useRef(null);
  const { burst } = useConfetti(confettiCanvasRef);
  const qcardRef = useRef(null);
  const railRef = useRef(null);

  const allQuestions = useMemo(() => {
    return shuffleArray(questions.map(shuffleOptions));
  }, [questions]);

  const numLevels = useMemo(() => {
    if (allQuestions.length <= FIRST_LEVEL_SIZE) return 1;
    return 1 + Math.ceil((allQuestions.length - FIRST_LEVEL_SIZE) / LEVEL_SIZE);
  }, [allQuestions]);
  const totalNodes = numLevels + 1; // +1 for mastery
  const railPoints = useMemo(() => buildRailPoints(numLevels), [numLevels]);
  const pathD = useMemo(() => buildSmoothPath(railPoints), [railPoints]);

  const [gameState, setGameState] = useState("playing");
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [levelQueues, setLevelQueues] = useState(() => {
    const queues = Array.from({ length: numLevels }, () => []);
    const mastery = [];
    allQuestions.forEach((q, i) => {
      const lvl = levelIndexForQuestion(i);
      if (lvl < numLevels) queues[lvl].push({ ...q, _id: i, weak: false, correctCount: 0 });
    });
    return { queues, mastery };
  });
  const [currentQ, setCurrentQ] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState(new Set());
  const [wasRevealed, setWasRevealed] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [aiExplainData, setAiExplainData] = useState({ text: "", loading: false });
  const [soundOn, setSoundOn] = useState(true);
  const [shake, setShake] = useState(false);
  const [cardFlash, setCardFlash] = useState("");
  const [logEntries, setLogEntries] = useState([]);
  const [knownCount, setKnownCount] = useState(0);
  const [retiredWeakCount, setRetiredWeakCount] = useState(0);
  const [weakTouchedIds, setWeakTouchedIds] = useState(new Set());
  const [levelCorrectCount, setLevelCorrectCount] = useState(0);
  const [totalCorrectCount, setTotalCorrectCount] = useState(0);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [levelCompleteData, setLevelCompleteData] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [chipAnim, setChipAnim] = useState(null);
  const [pingAnim, setPingAnim] = useState(null);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false);

  const totalQuestions = allQuestions.length;
  const levelLabel = (idx) => idx >= numLevels ? "Mastery" : `Level ${idx + 1}`;

  // Load saved progress on mount
  useEffect(() => {
    const saved = loadProgress(resource?.id || "default");
    if (saved && saved.currentLevelIdx != null) {
      setResumeAvailable(true);
    }
  }, [resource]);

  // Init audio
  useEffect(() => {
    const init = () => { if (!audioRef.current) audioRef.current = createAudioSystem(); audioRef.current.ensureCtx(); };
    ["pointerdown", "keydown", "touchstart"].forEach(evt => window.addEventListener(evt, init, { once: true, passive: true }));
    return () => ["pointerdown", "keydown", "touchstart"].forEach(evt => window.removeEventListener(evt, init, { once: true, passive: true }));
  }, []);

  // Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setShowExitConfirm(true); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Serve first question or resume
  useEffect(() => {
    if (gameState === "playing" && !currentQ && !resumeAvailable) {
      pickNext();
    }
  }, [gameState, currentQ, resumeAvailable]);

  function playSound(fn) {
    if (!audioRef.current) audioRef.current = createAudioSystem();
    audioRef.current[fn]();
  }

  function addLog(text, color) {
    setLogEntries(prev => [...prev, { text, color, id: Date.now() + Math.random() }]);
  }

  function saveState() {
    saveProgress(resource?.id || "default", {
      currentLevelIdx, knownCount, retiredWeakCount, totalCorrectCount,
      weakTouchedIds: [...weakTouchedIds],
    });
  }

  function pickNext(overrideLevelIdx) {
    const { queues, mastery } = levelQueues;
    const baseLevel = overrideLevelIdx != null ? overrideLevelIdx : currentLevelIdx;
    let lvl = baseLevel;

    // Find next level with questions starting from baseLevel
    while (lvl < numLevels && queues[lvl].length === 0) {
      lvl++;
    }

    if (lvl >= numLevels) {
      // Check mastery
      if (mastery.length > 0) {
        const q = mastery.shift();
        setCurrentLevelIdx(numLevels);
        setCurrentQ(q);
        setSelectedAnswer(null);
        setIsLocked(false);
        setShowExplain(false);
        setAiExplainData({ text: "", loading: false });
        setLevelQueues({ queues, mastery });
        return;
      }
      // All done
      showCompletion();
      return;
    }

    // If we skipped past the base level, it means the base level is empty
    // and subsequent levels have questions — but we should show level complete first
    if (lvl !== baseLevel && overrideLevelIdx == null) {
      // Level complete — let handleContinue/handleLevelComplete handle transition
      return;
    }

    const q = queues[lvl].shift();
    setLevelQueues({ queues, mastery });
    setCurrentLevelIdx(lvl);
    setCurrentQ(q);
    setSelectedAnswer(null);
    setIsLocked(false);
    setEliminatedOptions(new Set());
    setWasRevealed(false);
    setShowExplain(false);
    setAiExplainData({ text: "", loading: false });
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
    setSelectedAnswer(null);

    const answeredAt = currentLevelIdx;
    const { queues, mastery } = levelQueues;

    if (!currentQ.weak) {
      setWeakTouchedIds(prev => new Set(prev).add(currentQ._id));
    }
    currentQ.weak = true;

    if (answeredAt >= numLevels) {
      mastery.push(currentQ);
      addLog(`👁 Revealed at Mastery — loops back.`, "coral");
      setPingAnim({ idx: answeredAt, color: "#FF5E7E", double: false, ts: Date.now() });
    } else {
      const nextIdx = answeredAt + 1;
      if (queues[nextIdx]) {
        queues[nextIdx].push(currentQ);
      } else {
        mastery.push(currentQ);
      }
      queues[answeredAt].push({ ...currentQ, _id: currentQ._id + "_r", weak: true, correctCount: 0 });
      addLog(`👁 Revealed — cascades to ${levelLabel(nextIdx)} + re-ask at end of ${levelLabel(answeredAt)}.`, "coral");
      setChipAnim({ from: answeredAt, to: nextIdx >= numLevels ? numLevels : nextIdx, color: "#FF5E7E", ts: Date.now() });
      playSound("cascade");
    }

    playSound("wrong");
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setLevelQueues({ queues, mastery });
    saveState();
  }

  function handleAnswer(optionKey) {
    if (isLocked || !currentQ) return;
    const isCorrect = optionKey === currentQ.correct;
    setSelectedAnswer(optionKey);
    setIsLocked(true);

    const answeredAt = currentLevelIdx;
    const { queues, mastery } = levelQueues;

    if (isCorrect) {
      playSound("correct");
      setCardFlash("correct");
      setTimeout(() => setCardFlash(""), 500);
      setTotalCorrectCount(c => c + 1);

      if (!currentQ.weak) {
        addLog(`✓ "${currentQ.question.slice(0, 40)}..." correct — known!`, "green");
        setKnownCount(c => c + 1);
        setLevelCorrectCount(c => c + 1);
      } else {
        currentQ.correctCount++;
        if (currentQ.correctCount >= 2) {
          addLog(`✓ "${currentQ.question.slice(0, 40)}..." mastered (2/2) — retired!`, "green");
          setRetiredWeakCount(c => c + 1);
          setLevelCorrectCount(c => c + 1);
          playSound("mastery");
          setPingAnim({ idx: answeredAt, color: "#4ADE80", double: true, ts: Date.now() });
          const rect = qcardRef.current?.getBoundingClientRect();
          if (rect) burst(rect.left + rect.width / 2, rect.top, 20);
        } else if (answeredAt >= numLevels) {
          // At mastery, correct 1/2 — requeue
          mastery.push(currentQ);
          addLog(`✓ Correct at Mastery (1/2) — one more to confirm.`, "gold");
          setPingAnim({ idx: answeredAt, color: "#FFB627", double: false, ts: Date.now() });
        } else {
          // Jump to mastery
          mastery.push(currentQ);
          addLog(`✓ Correct (1/2) — jumps to Mastery, still weak.`, "gold");
          setChipAnim({ from: answeredAt, to: numLevels, color: "#FFB627", ts: Date.now() });
          playSound("cascade");
        }
      }
    } else {
      playSound("wrong");
      setCardFlash("wrong");
      setTimeout(() => setCardFlash(""), 500);
      setShake(true);
      setTimeout(() => setShake(false), 400);

      if (!currentQ.weak) {
        setWeakTouchedIds(prev => new Set(prev).add(currentQ._id));
      }
      currentQ.weak = true;

      if (answeredAt >= numLevels) {
        // Miss at mastery — loop back
        mastery.push(currentQ);
        addLog(`✕ Missed at Mastery — loops back.`, "coral");
        setPingAnim({ idx: answeredAt, color: "#FF5E7E", double: false, ts: Date.now() });
      } else {
        // Cascade to next level
        const nextIdx = answeredAt + 1;
        if (queues[nextIdx]) {
          queues[nextIdx].push(currentQ);
        } else {
          mastery.push(currentQ);
        }
        // Also re-ask at end of current level
        queues[answeredAt].push({ ...currentQ, _id: currentQ._id + "_r", weak: true, correctCount: 0 });
        addLog(`✕ Missed — cascades to ${levelLabel(nextIdx)} + re-ask at end of ${levelLabel(answeredAt)}.`, "coral");
        setChipAnim({ from: answeredAt, to: nextIdx >= numLevels ? numLevels : nextIdx, color: "#FF5E7E", ts: Date.now() });
        playSound("cascade");
      }
    }

    setLevelQueues({ queues, mastery });
    saveState();
  }

  function handleContinue() {
    const { queues, mastery } = levelQueues;

    // Check if current level is empty
    if (currentLevelIdx < numLevels && queues[currentLevelIdx].length === 0) {
      // Level complete!
      handleLevelComplete();
      return;
    }

    if (currentLevelIdx >= numLevels && mastery.length === 0) {
      showCompletion();
      return;
    }

    pickNext();
  }

  async function handleLevelComplete() {
    const levelBonus = BASE_LEVEL_BONUS * Math.pow(2, currentLevelIdx);
    const xpFromCorrect = levelCorrectCount * XP_PER_CORRECT;
    const totalXp = xpFromCorrect + levelBonus;

    playSound("levelUp");
    const rect = qcardRef.current?.getBoundingClientRect();
    if (rect) burst(rect.left + rect.width / 2, rect.top, 30);

    setLevelCompleteData({ levelIdx: currentLevelIdx, xpFromCorrect, levelBonus, totalXp, correctCount: levelCorrectCount });
    setShowLevelComplete(true);

    // Submit to backend
    await submitLevel(currentLevelIdx, levelCorrectCount, totalXp);
  }

  function handleAdvanceLevel() {
    setShowLevelComplete(false);
    setLevelCorrectCount(0);
    let nextIdx = currentLevelIdx + 1;

    // Skip empty levels with no mastery questions
    const { queues, mastery } = levelQueues;
    while (nextIdx < numLevels && queues[nextIdx].length === 0 && mastery.length === 0) {
      nextIdx++;
    }

    setCurrentLevelIdx(nextIdx);
    saveState();

    if (nextIdx >= numLevels && mastery.length === 0) {
      showCompletion();
    } else {
      pickNext(nextIdx);
    }
  }

  async function submitLevel(levelIdx, correctCount, totalXp) {
    if (!resource?.id) return;
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const token = authData.authToken;
      const res = await fetch(`${API_BASE}/api/resources/quiz-attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          resourceId: resource.id,
          score: correctCount,
          total: totalQuestions,
          details: [],
          levelBonus: totalXp,
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

  function showCompletion() {
    setGameState("complete");
    playSound("complete");
    clearProgress(resource?.id || "default");
    const rect = qcardRef.current?.getBoundingClientRect();
    if (rect) burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 40);
  }

  function handleRestart() {
    clearProgress(resource?.id || "default");
    const queues = Array.from({ length: numLevels }, () => []);
    const mastery = [];
    allQuestions.forEach((q, i) => {
      const lvl = levelIndexForQuestion(i);
      if (lvl < numLevels) queues[lvl].push({ ...q, _id: i, weak: false, correctCount: 0 });
    });
    setLevelQueues({ queues, mastery });
    setCurrentLevelIdx(0);
    setCurrentQ(null);
    setKnownCount(0);
    setRetiredWeakCount(0);
    setWeakTouchedIds(new Set());
    setLevelCorrectCount(0);
    setTotalCorrectCount(0);
    setLogEntries([]);
    setResumeAvailable(false);
    setEliminatedOptions(new Set());
    setWasRevealed(false);
    setGameState("playing");
    setShowLevelComplete(false);
  }

  function handleResume() {
    const saved = loadProgress(resource?.id || "default");
    if (saved) {
      setCurrentLevelIdx(saved.currentLevelIdx || 0);
      setKnownCount(saved.knownCount || 0);
      setRetiredWeakCount(saved.retiredWeakCount || 0);
      setTotalCorrectCount(saved.totalCorrectCount || 0);
      setWeakTouchedIds(new Set(saved.weakTouchedIds || []));
      setResumeAvailable(false);
      // Rebuild queues from saved state — simpler: just restart from saved level
      const queues = Array.from({ length: numLevels }, () => []);
      const mastery = [];
      allQuestions.forEach((q, i) => {
        const lvl = levelIndexForQuestion(i);
        if (lvl >= saved.currentLevelIdx && lvl < numLevels) {
          queues[lvl].push({ ...q, _id: i, weak: false, correctCount: 0 });
        }
      });
      setLevelQueues({ queues, mastery });
      setCurrentQ(null);
    }
  }

  function handleStartNew() {
    setShowStartOverConfirm(true);
  }

  function confirmStartOver() {
    clearProgress(resource?.id || "default");
    setResumeAvailable(false);
    setShowStartOverConfirm(false);
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
      setAiExplainData({ text: "Could not get AI explanation.", loading: false });
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    if (audioRef.current) audioRef.current.setMuted(!next);
  }

  // ── Colors ──
  const ink = "#0A0D13", cardBg = "#111826", cardBorder = "rgba(255,255,255,0.08)";
  const blue = "#00E5FF", gold = "#FFB627", coral = "#FF5E7E", green = "#4ADE80";
  const textHi = "#EAEEF7", textDim = "#8b93a7";

  // ── Resume screen ──
  if (resumeAvailable) {
    const saved = loadProgress(resource?.id || "default");
    const savedLevel = saved?.currentLevelIdx || 0;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)", color: textHi, fontFamily: "Manrope, sans-serif", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: isMobile ? 520 : 640, minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "max(18px, env(safe-area-inset-top)) clamp(14px, 4vw, 24px) max(18px, env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Weak Spot Cascade</div>
            <div style={{ color: textDim, fontSize: 14, marginBottom: 24 }}>{numLevels} levels · {totalQuestions} questions</div>
            <div style={{ background: "rgba(255,182,39,0.08)", border: "1px solid rgba(255,182,39,0.3)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: gold, marginBottom: 6 }}>SAVED PROGRESS</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{levelLabel(savedLevel)}</div>
              <div style={{ fontSize: 13, color: textDim, marginTop: 4 }}>{saved?.knownCount || 0} known · {saved?.retiredWeakCount || 0} mastered</div>
            </div>
            <button onClick={handleResume} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Continue from {levelLabel(savedLevel)} →</button>
            <button onClick={handleStartNew} style={{ width: "100%", padding: 14, borderRadius: 10, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`, color: textDim, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Start Over</button>
            <button onClick={onBack} style={{ width: "100%", padding: 12, borderRadius: 10, cursor: "pointer", background: "transparent", border: "none", color: textDim, fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 13 }}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Start Over confirmation ──
  if (showStartOverConfirm) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,13,19,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24, maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Start over?</div>
          <div style={{ fontSize: 14, color: textDim, marginBottom: 20 }}>Your saved progress will be erased and you'll begin from Level 1.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowStartOverConfirm(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${cardBorder}`, background: "transparent", color: textHi, fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button onClick={confirmStartOver} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: coral, color: ink, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Start Over</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Level complete screen ──
  if (showLevelComplete && levelCompleteData) {
    const d = levelCompleteData;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)", color: textHi, fontFamily: "Manrope, sans-serif", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <canvas ref={confettiCanvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }} />
        <div style={{ width: "100%", maxWidth: isMobile ? 520 : 640, minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "max(18px, env(safe-area-inset-top)) clamp(14px, 4vw, 24px) max(18px, env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>{levelLabel(d.levelIdx)} Complete</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 800, background: `linear-gradient(135deg, ${green}, ${blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "10px 0" }}>+{d.totalXp} XP</div>
            <div style={{ fontSize: 14, color: textDim, marginTop: 10, lineHeight: 1.6 }}>
              {d.correctCount} correct × {XP_PER_CORRECT} = {d.xpFromCorrect} XP<br />
              Level bonus: {d.levelBonus} XP
            </div>
            <button onClick={handleAdvanceLevel} style={{ width: "100%", padding: 14, marginTop: 20, borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15 }}>
              {d.levelIdx + 1 >= numLevels ? "Enter Mastery →" : `Continue to ${levelLabel(d.levelIdx + 1)} →`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Completion screen ──
  if (gameState === "complete") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)", color: textHi, fontFamily: "Manrope, sans-serif", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <canvas ref={confettiCanvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }} />
        <div style={{ width: "100%", maxWidth: isMobile ? 520 : 640, minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "max(18px, env(safe-area-inset-top)) clamp(14px, 4vw, 24px) max(18px, env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>All questions mastered</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 800, background: `linear-gradient(135deg, ${green}, ${blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "10px 0" }}>{knownCount + retiredWeakCount} / {totalQuestions}</div>
            <div style={{ fontSize: 13, color: textDim, marginTop: 10, lineHeight: 1.6 }}>
              {knownCount} known on first try · {retiredWeakCount} cascaded through weak-spot tracking
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleRestart} style={{ flex: 1, padding: 14, background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink, fontSize: 15, fontWeight: 700, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>Run again</button>
              <button onClick={onBack} style={{ flex: 1, padding: 14, background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`, color: textDim, fontSize: 15, fontWeight: 700, borderRadius: 10, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>← Back</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Exit confirm ──
  if (showExitConfirm) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,13,19,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24, maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Leave the cascade?</div>
          <div style={{ fontSize: 14, color: textDim, marginBottom: 20 }}>Your progress will be saved so you can resume later.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowExitConfirm(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${cardBorder}`, background: "transparent", color: textHi, fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Stay</button>
            <button onClick={() => { saveState(); onBack(); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: coral, color: ink, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Leave</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main playing screen ──
  const activeIdx = Math.min(currentLevelIdx, numLevels);
  const progress = activeIdx / (totalNodes - 1);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)", color: textHi, fontFamily: "Manrope, sans-serif", display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <canvas ref={confettiCanvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }} />

      <div className={shake ? "cascade-shake" : ""} style={{ width: "100%", maxWidth: isMobile ? 520 : 640, minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "max(14px, env(safe-area-inset-top)) clamp(12px, 4vw, 20px) max(14px, env(safe-area-inset-bottom))" }}>

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setShowExitConfirm(true)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`, color: textDim, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: textDim }}>{levelLabel(currentLevelIdx)}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            <span style={{ color: green }}>{knownCount + retiredWeakCount}/{totalQuestions}</span>
            <button onClick={toggleSound} style={{ fontSize: 10, color: soundOn ? blue : textDim, border: `1px solid ${soundOn ? "rgba(0,229,255,0.35)" : cardBorder}`, background: "transparent", padding: "3px 7px", borderRadius: 6, cursor: "pointer" }}>{soundOn ? "🔊" : "🔇"}</button>
          </div>
        </div>

        {/* Rail */}
        <div ref={railRef} style={{ position: "relative", background: "radial-gradient(circle at 20% 85%, rgba(0,229,255,0.08), transparent 42%), radial-gradient(circle at 75% 10%, rgba(74,222,128,0.09), transparent 46%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: `1px solid ${cardBorder}`, borderRadius: 16, height: isMobile ? 120 : 140, overflow: "hidden", flexShrink: 0, marginBottom: 10 }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <defs>
              <linearGradient id="cascadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="45%" stopColor="#FFB627" />
                <stop offset="75%" stopColor="#FF5E7E" />
                <stop offset="100%" stopColor="#4ADE80" />
              </linearGradient>
            </defs>
            <path d={pathD} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="0.6 2.4" vectorEffect="non-scaling-stroke" />
            <path d={pathD} fill="none" stroke="url(#cascadeGrad)" strokeWidth="1.3" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: 1000, strokeDashoffset: 1000 * (1 - progress), transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
          </svg>
          {railPoints.map((p, i) => {
            const isActive = i === activeIdx;
            const isDone = i < activeIdx;
            const isMastery = i === numLevels;
            const color = getLevelColor(i, totalNodes);
            const count = i === currentLevelIdx ? (levelQueues.queues[i]?.length || 0) + (i >= numLevels ? levelQueues.mastery.length : 0) : (i >= numLevels ? levelQueues.mastery.length : levelQueues.queues[i]?.length || 0);
            return (
              <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 3 }}>
                <div style={{
                  width: isMastery ? 36 : 30, height: isMastery ? 36 : 30, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: isMastery ? 16 : 12, fontWeight: 700,
                  background: isActive ? color : isDone ? "rgba(74,222,128,0.1)" : cardBg,
                  border: `2px solid ${isActive ? color : isDone ? green : cardBorder}`,
                  color: isActive ? ink : isDone ? green : textDim,
                  opacity: isActive || isDone ? 1 : 0.5,
                  boxShadow: isActive ? `0 0 12px ${color}66` : "none",
                  transition: "all 0.3s ease",
                  position: "relative",
                }}>
                  {isDone ? "✓" : isMastery ? "★" : i + 1}
                  {count > 0 && <span style={{ position: "absolute", top: -5, right: -5, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700, color: ink, background: gold, borderRadius: 20, minWidth: 14, height: 14, padding: "0 3px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 2px ${ink}` }}>{count}</span>}
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: isActive ? color : isDone ? green : textDim, textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: isActive ? 700 : 400 }}>{isMastery ? "Mastery" : `L${i + 1}`}</span>
              </div>
            );
          })}
          {/* Chip animation */}
          {chipAnim && <CascadeChip from={railPoints[chipAnim.from]} to={railPoints[Math.min(chipAnim.to, railPoints.length - 1)]} color={chipAnim.color} key={chipAnim.ts} onComplete={() => setChipAnim(null)} />}
          {/* Ping animation */}
          {pingAnim && <CascadePing point={railPoints[Math.min(pingAnim.idx, railPoints.length - 1)]} color={pingAnim.color} double={pingAnim.double} key={pingAnim.ts} onComplete={() => setPingAnim(null)} />}
        </div>

        {/* Question card */}
        {currentQ && gameState === "playing" && !showLevelComplete && (
          <div ref={qcardRef} className={cardFlash === "correct" ? "cascade-correct-flash" : cardFlash === "wrong" ? "cascade-wrong-flash" : ""} style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: `1px solid ${cardBorder}`, borderRadius: 16, padding: isMobile ? 18 : 24, backdropFilter: "blur(20px)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {/* Tags */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 6, fontWeight: 600, color: getLevelColor(activeIdx, totalNodes), background: getLevelColor(activeIdx, totalNodes) + "1A", border: `1px solid ${getLevelColor(activeIdx, totalNodes)}55` }}>{levelLabel(currentLevelIdx).toUpperCase()}</span>
              {currentQ.weak && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: gold, background: "rgba(255,182,39,0.1)", border: "1px solid rgba(255,182,39,0.3)", padding: "3px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  WEAK SPOT
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: currentQ.correctCount >= 1 ? gold : "rgba(255,182,39,0.25)" }} />
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: currentQ.correctCount >= 2 ? gold : "rgba(255,182,39,0.25)" }} />
                </span>
              )}
            </div>

            {/* Question */}
            <div style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.5, fontWeight: 600, marginBottom: 16, color: textHi }}>{currentQ.question}</div>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(currentQ.options).map(([key, value]) => {
                const isCorrectOpt = key === currentQ.correct;
                const isSelected = selectedAnswer === key;
                const isEliminated = eliminatedOptions.has(key);
                const showCorrect = isLocked && isCorrectOpt;
                const showWrong = isLocked && isSelected && !isCorrectOpt;
                let borderColor = cardBorder, bgColor = cardBg, textColor = textHi;
                if (!isLocked && isSelected) { borderColor = blue; bgColor = "rgba(0,229,255,0.08)"; }
                if (showCorrect) { borderColor = green; bgColor = "rgba(74,222,128,0.15)"; textColor = green; }
                if (showWrong) { borderColor = coral; bgColor = "rgba(255,94,126,0.15)"; textColor = coral; }
                if (isEliminated) { borderColor = cardBorder; bgColor = "transparent"; textColor = textDim; }
                return (
                  <button key={key} onClick={() => handleAnswer(key)} disabled={isLocked || isEliminated} style={{ padding: "12px 14px", background: bgColor, border: `1px solid ${borderColor}`, color: textColor, fontSize: 14, textAlign: "left", fontWeight: 500, borderRadius: 10, cursor: isLocked || isEliminated ? "default" : "pointer", fontFamily: "Manrope, sans-serif", transition: "opacity 0.25s, border-color 0.25s, background 0.25s", display: "flex", alignItems: "center", gap: 10, opacity: isEliminated ? 0.3 : (isLocked && !showCorrect && !showWrong ? 0.5 : 1), textDecoration: isEliminated ? "line-through" : "none" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13, opacity: 0.7, minWidth: 18 }}>{key}</span>
                    <span style={{ flex: 1 }}>{value}</span>
                    {showCorrect && <span style={{ color: green }}>✓</span>}
                    {showWrong && <span style={{ color: coral }}>✗</span>}
                  </button>
                );
              })}
            </div>

            {/* Hint / Reveal (before answering) */}
            {!isLocked && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={handleHint} style={{ flex: 1, padding: "11px 10px", borderRadius: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, cursor: "pointer", border: `1px solid ${cardBorder}`, background: "transparent", color: textDim }}>💡 Hint (50/50)</button>
                <button onClick={handleReveal} style={{ flex: 1, padding: "11px 10px", borderRadius: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, cursor: "pointer", border: `1px solid ${cardBorder}`, background: "transparent", color: textDim }}>👁 Reveal answer</button>
              </div>
            )}

            {/* AI Explain */}
            {isLocked && !showExplain && (
              <div style={{ marginTop: 12 }}>
                <button onClick={handleExplain} style={{ padding: "10px", borderRadius: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, cursor: "pointer", border: "1px solid rgba(255,182,39,0.35)", background: "rgba(255,182,39,0.08)", color: gold, width: "100%" }}>✨ Ask AI</button>
              </div>
            )}
            {showExplain && (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: textHi, background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 10, padding: 12, marginTop: 12 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: blue, marginBottom: 6, display: "block" }}>AI Explanation</span>
                {aiExplainData.loading ? <span className="cascade-dots">Thinking</span> : <MarkdownText>{aiExplainData.text}</MarkdownText>}
              </div>
            )}

            {/* Continue */}
            {isLocked && (
              <button onClick={handleContinue} style={{ width: "100%", padding: 13, marginTop: 14, borderRadius: 10, fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink }}>Continue →</button>
            )}
          </div>
        )}

        {/* Log panel */}
        {logEntries.length > 0 && (
          <div style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.03), rgba(255,255,255,0.005))", border: `1px solid ${cardBorder}`, borderRadius: 12, padding: "10px 12px", maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column-reverse", gap: 6, flexShrink: 0, marginTop: 8 }}>
            {logEntries.slice(-5).map(entry => (
              <div key={entry.id} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.4, padding: "6px 8px", borderRadius: 6, borderLeft: `2px solid ${entry.color === "green" ? green : entry.color === "gold" ? gold : coral}`, background: "rgba(255,255,255,0.02)", color: entry.color === "green" ? "#c8f5d8" : entry.color === "gold" ? "#ffe4ad" : "#ffc9d4" }}>{entry.text}</div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes cascadeShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        .cascade-shake { animation: cascadeShake 0.4s ease; }
        @keyframes cascadeCorrectGlow { 0%{box-shadow:0 0 0 0 rgba(74,222,128,0.6)} 100%{box-shadow:0 0 30px 6px rgba(74,222,128,0)} }
        .cascade-correct-flash { animation: cascadeCorrectGlow 0.5s ease; }
        @keyframes cascadeWrongGlow { 0%{box-shadow:0 0 0 0 rgba(255,94,126,0.6)} 100%{box-shadow:0 0 30px 6px rgba(255,94,126,0)} }
        .cascade-wrong-flash { animation: cascadeWrongGlow 0.5s ease; }
        @keyframes cascadeDots { 0%{content:'.'} 33%{content:'..'} 66%{content:'...'} 100%{content:'.'} }
        .cascade-dots::after { content: '\\00a0'; animation: cascadeDots 1.2s steps(4,end) infinite; }
        button:focus-visible { outline: 2px solid ${gold}; outline-offset: 2px; }
      `}</style>
    </div>
  );
}

/* ── Cascade chip animation ── */
function CascadeChip({ from, to, color, onComplete }) {
  const ref = useRef(null);
  useEffect(() => {
    const duration = 650;
    const start = performance.now();
    const ctrlX = (from.x + to.x) / 2;
    const ctrlY = Math.min(from.y, to.y) - 16;
    let raf;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * ctrlX + e * e * to.x;
      const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * ctrlY + e * e * to.y;
      if (ref.current) {
        ref.current.style.left = x + "%";
        ref.current.style.top = y + "%";
        if (t > 0.82) ref.current.style.opacity = String(Math.max(1 - (t - 0.82) / 0.18, 0));
      }
      if (t < 1) raf = requestAnimationFrame(step);
      else if (onComplete) onComplete();
    }
    raf = requestAnimationFrame(step);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [from, to, onComplete]);
  return <div ref={ref} style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px 2px ${color}`, transform: "translate(-50%,-50%)", zIndex: 5, pointerEvents: "none", left: `${from.x}%`, top: `${from.y}%` }} />;
}

/* ── Ping animation ── */
function CascadePing({ point, color, double, onComplete }) {
  const [showSecond, setShowSecond] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => { if (double) setShowSecond(true); }, 130);
    const t2 = setTimeout(() => { if (onComplete) onComplete(); }, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [double, onComplete]);
  return (
    <>
      <div style={{ position: "absolute", left: `${point.x}%`, top: `${point.y}%`, width: 30, height: 30, borderRadius: "50%", transform: "translate(-50%,-50%) scale(0.6)", border: `2px solid ${color}`, opacity: 0.9, animation: "cascadePing 0.7s ease-out forwards", zIndex: 2, pointerEvents: "none" }} />
      {showSecond && <div style={{ position: "absolute", left: `${point.x}%`, top: `${point.y}%`, width: 30, height: 30, borderRadius: "50%", transform: "translate(-50%,-50%) scale(0.6)", border: `2px solid ${color}`, opacity: 0.9, animation: "cascadePing 0.7s ease-out forwards", zIndex: 2, pointerEvents: "none" }} />}
      <style>{`@keyframes cascadePing { 0%{transform:translate(-50%,-50%) scale(0.6);opacity:0.9} 100%{transform:translate(-50%,-50%) scale(2.3);opacity:0} }`}</style>
    </>
  );
}
