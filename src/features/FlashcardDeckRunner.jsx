import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Flame, Zap } from "lucide-react";
import { useComboStreak } from "../lib/useComboStreak.js";
import { STREAK_BONUS } from "../data.js";
import { getSubjectColor } from "./research-hub/subjectColors.js";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

const XP_PER_CORRECT = 20;
const BASE_LEVEL_BONUS = 100;
const FIRST_LEVEL_SIZE = 5;
const LEVEL_SIZE = 10;
const EASY_GRADE = 4;

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    if (authData.authToken) return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
    return { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

const GRADE_CONFIG = [
  { grade: 1, label: "Again", icon: "😵", color: "#ef5350", bg: "rgba(239,83,80,0.12)", border: "rgba(239,83,80,0.4)", interval: "<1m" },
  { grade: 2, label: "Hard", icon: "😬", color: "#ffb74d", bg: "rgba(255,183,77,0.12)", border: "rgba(255,183,77,0.4)", interval: "~6m" },
  { grade: 3, label: "Good", icon: "😊", color: "#66bb6a", bg: "rgba(102,187,106,0.12)", border: "rgba(102,187,106,0.4)", interval: "~1d" },
  { grade: 4, label: "Easy", icon: "🎉", color: "#FFD700", bg: "rgba(255,215,0,0.12)", border: "rgba(255,215,0,0.4)", interval: "~3d" },
];

/* ── Level helpers ── */
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
  try { localStorage.setItem(`sc_fc_cascade_progress_${resourceId}`, JSON.stringify(state)); } catch {}
}
function loadProgress(resourceId) {
  try { const raw = localStorage.getItem(`sc_fc_cascade_progress_${resourceId}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearProgress(resourceId) {
  try { localStorage.removeItem(`sc_fc_cascade_progress_${resourceId}`); } catch {}
}

/* ── Rail geometry ── */
function buildRailPoints(numLevels) {
  const points = [];
  const totalNodes = numLevels + 1;
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
  if (idx >= total - 1) return "#4ADE80";
  return LEVEL_COLORS[Math.min(idx, LEVEL_COLORS.length - 1)];
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

/* ── Component ─────────────────────────────────────────────── */
export default function FlashcardDeckRunner({ resource, onBack, onStreakUpdate, onXpUpdate }) {
  const isMobile = useIsMobile();
  const audioRef = useRef(null);
  const confettiCanvasRef = useRef(null);
  const { burst } = useConfetti(confettiCanvasRef);
  const qcardRef = useRef(null);
  const railRef = useRef(null);
  const combo = useComboStreak("flashcard");
  const xpEarnedRef = useRef(0);

  const allCards = useMemo(() => {
    if (!resource?.flashcardData) return [];
    try {
      const parsed = typeof resource.flashcardData === "string" ? JSON.parse(resource.flashcardData) : resource.flashcardData;
      return Array.isArray(parsed) ? shuffleArray(parsed) : [];
    } catch { return []; }
  }, [resource]);

  const numLevels = useMemo(() => {
    if (allCards.length <= FIRST_LEVEL_SIZE) return 1;
    return 1 + Math.ceil((allCards.length - FIRST_LEVEL_SIZE) / LEVEL_SIZE);
  }, [allCards]);
  const totalNodes = numLevels + 1;
  const railPoints = useMemo(() => buildRailPoints(numLevels), [numLevels]);
  const pathD = useMemo(() => buildSmoothPath(railPoints), [railPoints]);

  const [gameState, setGameState] = useState("playing");
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [levelQueues, setLevelQueues] = useState(() => {
    const queues = Array.from({ length: numLevels }, () => []);
    const mastery = [];
    allCards.forEach((c, i) => {
      const lvl = levelIndexForQuestion(i);
      if (lvl < numLevels) queues[lvl].push({ ...c, _id: i, weak: false, correctCount: 0 });
    });
    return { queues, mastery };
  });
  const [currentCard, setCurrentCard] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [shake, setShake] = useState(false);
  const [cardFlash, setCardFlash] = useState("");
  const [knownCount, setKnownCount] = useState(0);
  const [retiredWeakCount, setRetiredWeakCount] = useState(0);
  const [weakTouchedIds, setWeakTouchedIds] = useState(new Set());
  const [levelCorrectCount, setLevelCorrectCount] = useState(0);
  const [totalCorrectCount, setTotalCorrectCount] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [streakInfo, setStreakInfo] = useState(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [showLevelTransition, setShowLevelTransition] = useState(false);
  const [levelTransitionData, setLevelTransitionData] = useState(null);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [levelCompleteData, setLevelCompleteData] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [chipAnim, setChipAnim] = useState(null);
  const [pingAnim, setPingAnim] = useState(null);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);

  const totalCards = allCards.length;
  const levelLabel = (idx) => idx >= numLevels ? "Mastery" : `Level ${idx + 1}`;

  // Load saved progress on mount
  useEffect(() => {
    const saved = loadProgress(resource?.id || "default");
    if (saved && saved.currentLevelIdx != null) {
      setResumeAvailable(true);
    }
    setLoading(false);
  }, [resource]);

  // Init audio
  useEffect(() => {
    const init = () => { if (!audioRef.current) audioRef.current = createAudioSystem(); audioRef.current.ensureCtx(); };
    ["pointerdown", "keydown", "touchstart"].forEach(evt => window.addEventListener(evt, init, { once: true, passive: true }));
    return () => ["pointerdown", "keydown", "touchstart"].forEach(evt => window.removeEventListener(evt, init, { once: true, passive: true }));
  }, []);

  // Escape → exit confirm
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setShowExitConfirm(true); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Serve first card or resume
  useEffect(() => {
    if (gameState === "playing" && !currentCard && !resumeAvailable && !loading) {
      pickNext();
    }
  }, [gameState, currentCard, resumeAvailable, loading]);

  // Auto-expand rail when animations fire
  useEffect(() => {
    if (chipAnim || pingAnim) setRailCollapsed(false);
  }, [chipAnim, pingAnim]);

  // Keyboard shortcuts
  useEffect(() => {
    if (gameState !== "playing" || loading || totalCards === 0 || showLevelComplete || showLevelTransition) return;
    const onKey = (e) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (rating == null) setFlipped(f => !f);
      } else if (flipped && rating == null && ["1", "2", "3", "4"].includes(e.key)) {
        handleRate(parseInt(e.key, 10));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rating, gameState, loading, totalCards, showLevelComplete, showLevelTransition]);

  function playSound(fn) {
    if (!audioRef.current) audioRef.current = createAudioSystem();
    audioRef.current[fn]();
  }

  function saveState() {
    saveProgress(resource?.id || "default", {
      currentLevelIdx, knownCount, retiredWeakCount, totalCorrectCount, totalXp,
      weakTouchedIds: [...weakTouchedIds],
    });
  }

  function pickNext(overrideLevelIdx) {
    const { queues, mastery } = levelQueues;
    const baseLevel = overrideLevelIdx != null ? overrideLevelIdx : currentLevelIdx;
    let lvl = baseLevel;

    while (lvl < numLevels && queues[lvl].length === 0) {
      lvl++;
    }

    if (lvl >= numLevels) {
      if (mastery.length > 0) {
        const c = mastery.shift();
        setCurrentLevelIdx(numLevels);
        setCurrentCard(c);
        setFlipped(false);
        setRating(null);
        setLevelQueues({ queues, mastery });
        return;
      }
      showCompletion();
      return;
    }

    if (lvl !== baseLevel && overrideLevelIdx == null) {
      return;
    }

    const c = queues[lvl].shift();
    setLevelQueues({ queues, mastery });
    setCurrentLevelIdx(lvl);
    setCurrentCard(c);
    setFlipped(false);
    setRating(null);
  }

  async function handleRate(grade) {
    if (!currentCard || rating != null) return;
    setRating(grade);
    combo.handleAnswer(grade >= 3);

    // FSRS API call
    if (resource?.id) {
      try {
        const res = await fetch(`${API_BASE}/api/resources/fsrs/rate`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            resourceId: resource.id,
            itemType: "flashcard",
            pageIndex: -1,
            flashcardId: `deck_${currentCard._id}`,
            grade,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.streak != null) {
            setStreakInfo({ streak: data.streak, longestStreak: data.longestStreak });
            if (onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
          }
          if (data.xpAwarded > 0) {
            xpEarnedRef.current += data.xpAwarded;
            setTotalXpEarned(xpEarnedRef.current);
            if (onXpUpdate) onXpUpdate(data.xpAwarded);
          }
        }
      } catch {}
    }

    const isEasy = grade >= EASY_GRADE;
    const answeredAt = currentLevelIdx;
    const { queues, mastery } = levelQueues;

    if (isEasy) {
      playSound("correct");
      setCardFlash("correct");
      setTimeout(() => setCardFlash(""), 500);
      setTotalCorrectCount(c => c + 1);
      setTotalXp(x => x + XP_PER_CORRECT);

      if (!currentCard.weak) {
        setKnownCount(c => c + 1);
        setLevelCorrectCount(c => c + 1);
      } else {
        currentCard.correctCount++;
        if (currentCard.correctCount >= 2) {
          for (let i = mastery.length - 1; i >= 0; i--) {
            if (mastery[i].front === currentCard.front) mastery.splice(i, 1);
          }
          setRetiredWeakCount(c => c + 1);
          setLevelCorrectCount(c => c + 1);
          playSound("mastery");
          setPingAnim({ idx: answeredAt, color: "#4ADE80", double: true, ts: Date.now() });
          const rect = qcardRef.current?.getBoundingClientRect();
          if (rect) burst(rect.left + rect.width / 2, rect.top, 20);
        } else if (answeredAt >= numLevels) {
          mastery.push(currentCard);
          setPingAnim({ idx: answeredAt, color: "#FFB627", double: false, ts: Date.now() });
        } else {
          mastery.push(currentCard);
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

      if (!currentCard.weak) {
        setWeakTouchedIds(prev => new Set(prev).add(currentCard._id));
      }
      currentCard.weak = true;

      if (answeredAt >= numLevels) {
        mastery.push(currentCard);
        setPingAnim({ idx: answeredAt, color: "#FF5E7E", double: false, ts: Date.now() });
      } else {
        const nextIdx = answeredAt + 1;
        if (queues[nextIdx]) {
          queues[nextIdx].push(currentCard);
        } else {
          mastery.push(currentCard);
        }
        queues[answeredAt].push({ ...currentCard, _id: currentCard._id + "_r", weak: true, correctCount: 0 });
        setChipAnim({ from: answeredAt, to: nextIdx >= numLevels ? numLevels : nextIdx, color: "#FF5E7E", ts: Date.now() });
        playSound("cascade");
      }
    }

    setLevelQueues({ queues, mastery });
    saveState();
  }

  function handleContinue() {
    const { queues, mastery } = levelQueues;

    if (currentLevelIdx < numLevels && queues[currentLevelIdx].length === 0) {
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
    const levelTotalXp = xpFromCorrect + levelBonus;

    setTotalXp(x => x + levelBonus);

    playSound("levelUp");
    const rect = qcardRef.current?.getBoundingClientRect();
    if (rect) burst(rect.left + rect.width / 2, rect.top, 30);

    setLevelCompleteData({ levelIdx: currentLevelIdx, xpFromCorrect, levelBonus, totalXp: levelTotalXp, correctCount: levelCorrectCount });
    setShowLevelComplete(true);

    await submitLevel(currentLevelIdx, levelCorrectCount, levelTotalXp);
  }

  function handleAdvanceLevel() {
    setShowLevelComplete(false);
    setLevelCorrectCount(0);
    let nextIdx = currentLevelIdx + 1;

    const { queues, mastery } = levelQueues;
    while (nextIdx < numLevels && queues[nextIdx].length === 0 && mastery.length === 0) {
      nextIdx++;
    }

    setCurrentLevelIdx(nextIdx);
    saveState();

    if (nextIdx >= numLevels && mastery.length === 0) {
      showCompletion();
    } else {
      const color = getLevelColor(Math.min(nextIdx, numLevels), totalNodes);
      setLevelTransitionData({ label: levelLabel(nextIdx), color });
      setShowLevelTransition(true);
      setTimeout(() => {
        setShowLevelTransition(false);
        pickNext(nextIdx);
      }, 1200);
    }
  }

  async function submitLevel(levelIdx, correctCount, totalXpVal) {
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
          total: totalCards,
          details: [],
          levelBonus: totalXpVal,
        }),
      });
      if (res.ok) {
        const data = await res.json();
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
    allCards.forEach((c, i) => {
      const lvl = levelIndexForQuestion(i);
      if (lvl < numLevels) queues[lvl].push({ ...c, _id: i, weak: false, correctCount: 0 });
    });
    setLevelQueues({ queues, mastery });
    setCurrentLevelIdx(0);
    setCurrentCard(null);
    setKnownCount(0);
    setRetiredWeakCount(0);
    setWeakTouchedIds(new Set());
    setLevelCorrectCount(0);
    setTotalCorrectCount(0);
    setTotalXp(0);
    setShowLevelTransition(false);
    setLevelTransitionData(null);
    setResumeAvailable(false);
    setGameState("playing");
    setShowLevelComplete(false);
    setFlipped(false);
    setRating(null);
  }

  function handleResume() {
    const saved = loadProgress(resource?.id || "default");
    if (saved) {
      setCurrentLevelIdx(saved.currentLevelIdx || 0);
      setKnownCount(saved.knownCount || 0);
      setRetiredWeakCount(saved.retiredWeakCount || 0);
      setTotalCorrectCount(saved.totalCorrectCount || 0);
      setTotalXp(saved.totalXp || 0);
      setWeakTouchedIds(new Set(saved.weakTouchedIds || []));
      setResumeAvailable(false);
      const queues = Array.from({ length: numLevels }, () => []);
      const mastery = [];
      allCards.forEach((c, i) => {
        const lvl = levelIndexForQuestion(i);
        if (lvl >= saved.currentLevelIdx && lvl < numLevels) {
          queues[lvl].push({ ...c, _id: i, weak: false, correctCount: 0 });
        }
      });
      setLevelQueues({ queues, mastery });
      setCurrentCard(null);
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

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    if (audioRef.current) audioRef.current.setMuted(!next);
  }

  // ── Colors ──
  const ink = "#0A0D13", cardBg = "#111826", cardBorder = "rgba(255,255,255,0.08)";
  const blue = "#00E5FF", gold = "#FFB627", coral = "#FF5E7E", green = "#4ADE80";
  const textHi = "#EAEEF7", textDim = "#8b93a7";
  const sc = getSubjectColor(resource?.subject);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#060818", display: "flex", alignItems: "center", justifyContent: "center", color: "#7b82b8", fontFamily: "Manrope, sans-serif" }}>
        Loading…
      </div>
    );
  }

  // ── Empty state ──
  if (totalCards === 0) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#060818", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "Manrope, sans-serif" }}>
        <div style={{ fontSize: 40 }}>📭</div>
        <div style={{ color: "#7b82b8", fontSize: 15 }}>No flashcards available</div>
        <button onClick={onBack} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9aa2d8", cursor: "pointer", fontFamily: "Manrope, sans-serif", fontWeight: 600 }}>← Back</button>
      </div>
    );
  }

  // ── Start Over confirmation ──
  if (showStartOverConfirm) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,13,19,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24, maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: textHi, fontFamily: "Manrope, sans-serif" }}>Start over?</div>
          <div style={{ fontSize: 14, color: textDim, marginBottom: 20, fontFamily: "Manrope, sans-serif" }}>Your saved progress will be erased and you'll begin from Level 1.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowStartOverConfirm(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${cardBorder}`, background: "transparent", color: textHi, fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button onClick={confirmStartOver} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: coral, color: ink, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Start Over</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Resume screen ──
  if (resumeAvailable) {
    const saved = loadProgress(resource?.id || "default");
    const savedLevel = saved?.currentLevelIdx || 0;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)", color: textHi, fontFamily: "Manrope, sans-serif", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: isMobile ? 520 : 640, minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "max(18px, env(safe-area-inset-top)) clamp(14px, 4vw, 24px) max(18px, env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Flashcard Cascade</div>
            <div style={{ color: textDim, fontSize: 14, marginBottom: 24 }}>{numLevels} levels · {totalCards} cards</div>
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
              {d.correctCount} mastered × {XP_PER_CORRECT} = {d.xpFromCorrect} XP<br />
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
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>All cards mastered</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 800, background: `linear-gradient(135deg, ${green}, ${blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "10px 0" }}>{knownCount + retiredWeakCount} / {totalCards}</div>
            <div style={{ fontSize: 13, color: textDim, marginTop: 10, lineHeight: 1.6 }}>
              {knownCount} known on first try · {retiredWeakCount} cascaded through weak-spot tracking
            </div>
            {totalXp > 0 && (
              <div style={{ fontSize: 16, fontWeight: 700, color: gold, marginTop: 12 }}>+{totalXp} XP earned</div>
            )}
            {streakInfo?.streak > 0 && (
              <div style={{ fontSize: 13, color: "#ff7043", marginTop: 6 }}>🔥 {streakInfo.streak} day streak</div>
            )}
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
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: textHi, fontFamily: "Manrope, sans-serif" }}>Leave the cascade?</div>
          <div style={{ fontSize: 14, color: textDim, marginBottom: 20, fontFamily: "Manrope, sans-serif" }}>Your progress will be saved so you can resume later.</div>
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
  const card = currentCard;

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
            {combo.combo >= 3 && (
              <span className={combo.combo >= 7 ? "fc-pulse-glow" : ""} style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: combo.combo >= 7 ? "#ff7043" : "#ffb74d", padding: "3px 8px", borderRadius: 999, background: combo.combo >= 7 ? "rgba(255,112,67,0.14)" : "rgba(255,183,77,0.14)", border: `0.5px solid ${combo.combo >= 7 ? "rgba(255,112,67,0.35)" : "rgba(255,183,77,0.35)"}` }}>
                <Flame size={12} /> {combo.combo}x{STREAK_BONUS[combo.combo] ? ` +${STREAK_BONUS[combo.combo]}` : ""}
              </span>
            )}
            <span style={{ color: gold, fontWeight: 700 }}>+{totalXp} XP</span>
            <span style={{ color: green }}>{knownCount + retiredWeakCount}/{totalCards}</span>
            <button onClick={toggleSound} style={{ fontSize: 10, color: soundOn ? blue : textDim, border: `1px solid ${soundOn ? "rgba(0,229,255,0.35)" : cardBorder}`, background: "transparent", padding: "3px 7px", borderRadius: 6, cursor: "pointer" }}>{soundOn ? "🔊" : "🔇"}</button>
          </div>
        </div>

        {/* Rail (collapsible) */}
        {railCollapsed ? (
          <div onClick={() => setRailCollapsed(false)} style={{ position: "relative", background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: `1px solid ${cardBorder}`, borderRadius: 12, height: 36, overflow: "hidden", flexShrink: 0, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", padding: "0 12px", gap: 10 }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="fcCascadeGradMini" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00E5FF" />
                  <stop offset="45%" stopColor="#FFB627" />
                  <stop offset="75%" stopColor="#FF5E7E" />
                  <stop offset="100%" stopColor="#4ADE80" />
                </linearGradient>
              </defs>
              <path d={pathD} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={pathD} fill="none" stroke="url(#fcCascadeGradMini)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: 1000, strokeDashoffset: 1000 * (1 - progress), transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
            </svg>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: textDim, zIndex: 2, whiteSpace: "nowrap" }}>{levelLabel(currentLevelIdx)}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: getLevelColor(activeIdx, totalNodes), zIndex: 2, whiteSpace: "nowrap" }}>{Math.round(progress * 100)}%</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: textDim, zIndex: 2 }}>▾</span>
          </div>
        ) : (
          <div ref={railRef} style={{ position: "relative", background: "radial-gradient(circle at 20% 85%, rgba(0,229,255,0.08), transparent 42%), radial-gradient(circle at 75% 10%, rgba(74,222,128,0.09), transparent 46%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: `1px solid ${cardBorder}`, borderRadius: 16, height: isMobile ? 120 : 140, overflow: "hidden", flexShrink: 0, marginBottom: 10 }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="fcCascadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00E5FF" />
                  <stop offset="45%" stopColor="#FFB627" />
                  <stop offset="75%" stopColor="#FF5E7E" />
                  <stop offset="100%" stopColor="#4ADE80" />
                </linearGradient>
              </defs>
              <path d={pathD} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="0.6 2.4" vectorEffect="non-scaling-stroke" />
              <path d={pathD} fill="none" stroke="url(#fcCascadeGrad)" strokeWidth="1.3" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: 1000, strokeDashoffset: 1000 * (1 - progress), transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
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
            {chipAnim && <CascadeChip from={railPoints[chipAnim.from]} to={railPoints[Math.min(chipAnim.to, railPoints.length - 1)]} color={chipAnim.color} key={chipAnim.ts} onComplete={() => { setChipAnim(null); setRailCollapsed(true); }} />}
            {pingAnim && <CascadePing point={railPoints[Math.min(pingAnim.idx, railPoints.length - 1)]} color={pingAnim.color} double={pingAnim.double} key={pingAnim.ts} onComplete={() => { setPingAnim(null); setRailCollapsed(true); }} />}
            <button onClick={() => setRailCollapsed(true)} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: `1px solid ${cardBorder}`, color: textDim, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>▴</button>
          </div>
        )}

        {/* Flashcard */}
        {card && gameState === "playing" && !showLevelComplete && (
          <div ref={qcardRef} className={cardFlash === "correct" ? "cascade-correct-flash" : cardFlash === "wrong" ? "cascade-wrong-flash" : ""} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Tags */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 6, fontWeight: 600, color: getLevelColor(activeIdx, totalNodes), background: getLevelColor(activeIdx, totalNodes) + "1A", border: `1px solid ${getLevelColor(activeIdx, totalNodes)}55` }}>{levelLabel(currentLevelIdx).toUpperCase()}</span>
              {card.weak && (
                <span className="cascade-weak-pulse" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: gold, background: "rgba(255,182,39,0.1)", border: "1px solid rgba(255,182,39,0.3)", padding: "3px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  WEAK SPOT
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: card.correctCount >= 1 ? gold : "rgba(255,182,39,0.25)" }} />
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: card.correctCount >= 2 ? gold : "rgba(255,182,39,0.25)" }} />
                </span>
              )}
            </div>

            {/* 3D Flip Card */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                onClick={() => rating == null && setFlipped(f => !f)}
                style={{
                  perspective: "1400px",
                  cursor: rating == null ? "pointer" : "default",
                  width: "100%",
                  maxWidth: "760px",
                  minHeight: "320px",
                  filter: `drop-shadow(0 24px 50px rgba(0,0,0,0.4)) drop-shadow(0 6px 14px ${sc.bg})`,
                }}
              >
                <div style={{
                  position: "relative",
                  width: "100%",
                  minHeight: "320px",
                  transformStyle: "preserve-3d",
                  transition: "transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)",
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}>
                  {/* Front face */}
                  <div style={{
                    position: "absolute", inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    background: "rgba(15,17,36,0.85)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: `0.5px solid ${sc.border}`,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `4px solid ${sc.accent}`,
                    borderRadius: "24px",
                    padding: "48px 36px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    textAlign: "center",
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 30px ${sc.bg}`,
                  }}>
                    <div style={{
                      fontSize: 11, color: sc.text, marginBottom: 20,
                      textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
                      padding: "5px 14px", borderRadius: "999px",
                      background: sc.bg, border: `0.5px solid ${sc.border}`,
                    }}>
                      Front
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#eef0fb", lineHeight: 1.65, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                      {card.front}
                    </div>
                    <div className="fc-bounce-hint" style={{ fontSize: 13, color: "#565c8f", marginTop: 28, fontWeight: 500 }}>
                      👆 Tap card to flip
                    </div>
                  </div>

                  {/* Back face */}
                  <div style={{
                    position: "absolute", inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background: "rgba(14,20,17,0.85)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: `0.5px solid ${sc.border}`,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `4px solid ${sc.accent}`,
                    borderRadius: "24px",
                    padding: "48px 36px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    textAlign: "center",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 30px rgba(102,187,106,0.12)",
                  }}>
                    <div style={{
                      fontSize: 11, color: "#66bb6a", marginBottom: 20,
                      textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
                      padding: "5px 14px", borderRadius: "999px",
                      background: "rgba(102,187,106,0.12)", border: "0.5px solid rgba(102,187,106,0.35)",
                    }}>
                      Back
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: "#b9e8bb", lineHeight: 1.65, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                      {card.back}
                    </div>
                    {rating == null && (
                      <div className="fc-bounce-hint" style={{ fontSize: 13, color: "#565c8f", marginTop: 24, fontWeight: 500 }}>
                        Grade yourself below
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rating buttons */}
            {flipped && (
              <div className="fc-fade-in-up" style={{
                marginTop: 20, padding: "16px 14px", borderRadius: "18px",
                background: "rgba(13,15,32,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                border: "0.5px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#9aa2d8", textAlign: "center", marginBottom: 14 }}>
                  How well did you know this?
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {GRADE_CONFIG.map(({ grade, label, icon, color, bg, border, interval }, i) => (
                    <button
                      key={grade}
                      onClick={() => handleRate(grade)}
                      disabled={rating != null}
                      className="fc-fade-in-up"
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        padding: "12px 16px", borderRadius: "16px",
                        background: rating === grade ? color : bg,
                        border: `1px solid ${border}`,
                        fontSize: 12, fontWeight: 700, color: rating === grade ? "#060818" : color,
                        cursor: rating != null ? "default" : "pointer",
                        minWidth: 72,
                        transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
                        opacity: rating != null && rating !== grade ? 0.4 : 1,
                        transform: rating === grade ? "scale(1.06) translateY(-2px)" : "scale(1) translateY(0)",
                        boxShadow: rating === grade ? `0 8px 20px ${bg}` : "none",
                        animationDelay: `${i * 50}ms`,
                      }}
                      onMouseEnter={(e) => { if (rating == null) { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = `0 6px 16px ${bg}`; } }}
                      onMouseLeave={(e) => { if (rating == null) { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "none"; } }}
                    >
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <span>{label}</span>
                      <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500 }}>{interval}</span>
                    </button>
                  ))}
                </div>
                {rating != null && (
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                    {rating < EASY_GRADE && (
                      <span style={{ fontSize: 12, color: gold, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        ↻ Cascaded to {levelLabel(Math.min(currentLevelIdx + 1, numLevels))}
                      </span>
                    )}
                    {rating >= EASY_GRADE && !currentCard.weak && (
                      <span style={{ fontSize: 12, color: green, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        ✓ Mastered
                      </span>
                    )}
                    {rating >= EASY_GRADE && currentCard.weak && (
                      <span style={{ fontSize: 12, color: green, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        ✓ Weak spot progress ({currentCard.correctCount}/2)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Continue button */}
            {rating != null && (
              <button onClick={handleContinue} style={{ width: "100%", padding: 13, marginTop: 14, borderRadius: 10, fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink }}>Continue →</button>
            )}
          </div>
        )}

        {/* Level transition overlay */}
        {showLevelTransition && levelTransitionData && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,13,19,0.7)", backdropFilter: "blur(6px)" }}>
            <div className="cascade-level-slide" style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: levelTransitionData.color, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Now entering</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 42, fontWeight: 800, color: levelTransitionData.color, textShadow: `0 0 30px ${levelTransitionData.color}55` }}>{levelTransitionData.label}</div>
            </div>
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
        @keyframes cascadeLevelSlide { 0%{opacity:0;transform:translateX(60px)} 30%{opacity:1;transform:translateX(0)} 70%{opacity:1;transform:translateX(0)} 100%{opacity:0;transform:translateX(-30px)} }
        .cascade-level-slide { animation: cascadeLevelSlide 1.2s cubic-bezier(0.4,0,0.2,1); }
        @keyframes cascadeWeakPulse { 0%,100%{border-color:rgba(255,182,39,0.3);box-shadow:0 0 0 0 rgba(255,182,39,0)} 50%{border-color:rgba(255,182,39,0.6);box-shadow:0 0 8px 2px rgba(255,182,39,0.15)} }
        .cascade-weak-pulse { animation: cascadeWeakPulse 1.5s ease-in-out infinite; }
        @keyframes fcFadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .fc-fade-in-up { animation: fcFadeInUp 0.3s ease forwards; }
        @keyframes fcBounceHint { 0%,100%{opacity:0.5;transform:translateY(0)} 50%{opacity:1;transform:translateY(-3px)} }
        .fc-bounce-hint { animation: fcBounceHint 1.8s ease-in-out infinite; }
        @keyframes fcPulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(255,112,67,0.4)} 50%{box-shadow:0 0 12px 4px rgba(255,112,67,0.15)} }
        .fc-pulse-glow { animation: fcPulseGlow 1.5s ease-in-out infinite; }
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
      <div style={{ position: "absolute", left: `${point.x}%`, top: `${point.y}%`, width: 30, height: 30, borderRadius: "50%", transform: "translate(-50%,-50%) scale(0.6)", border: `2px solid ${color}`, opacity: 0.9, animation: "fcCascadePing 0.7s ease-out forwards", zIndex: 2, pointerEvents: "none" }} />
      {showSecond && <div style={{ position: "absolute", left: `${point.x}%`, top: `${point.y}%`, width: 30, height: 30, borderRadius: "50%", transform: "translate(-50%,-50%) scale(0.6)", border: `2px solid ${color}`, opacity: 0.9, animation: "fcCascadePing 0.7s ease-out forwards", zIndex: 2, pointerEvents: "none" }} />}
      <style>{`@keyframes fcCascadePing { 0%{transform:translate(-50%,-50%) scale(0.6);opacity:0.9} 100%{transform:translate(-50%,-50%) scale(2.3);opacity:0} }`}</style>
    </>
  );
}
