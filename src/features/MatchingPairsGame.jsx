import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const PAIRS_PER_LEVEL = 6;
const XP_PER_LEVEL = 40;

/* ── Utils ─────────────────────────────────────────────────── */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
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
    flip() { tone(520, 0.08, "triangle", 0.1); },
    match(streak) {
      const base = 523.25;
      tone(base, 0.12, "sine", 0.18);
      tone(base * 1.26, 0.12, "sine", 0.15, 0.08);
      tone(base * 1.5, 0.18, "sine", 0.15, 0.16);
      if (streak >= 2) tone(base * 2, 0.2, "sine", 0.12, 0.24);
    },
    mismatch() {
      tone(180, 0.15, "sawtooth", 0.12);
      tone(140, 0.2, "sawtooth", 0.1, 0.08);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.3, "sine", 0.15, i * 0.12));
    },
    levelUp() {
      [440, 554.4, 659.25, 880].forEach((f, i) => tone(f, 0.22, "triangle", 0.13, i * 0.09));
    },
    master() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.35, "triangle", 0.14, i * 0.1));
    },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    ensureCtx,
  };
}

function vibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} }
}

/* ── Confetti hook ─────────────────────────────────────────── */
function useConfetti(canvasRef) {
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  const burst = useCallback((x, y, count = 24, colors = ["#00E5FF", "#FFB627", "#FF5E7E", "#4ADE80"]) => {
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

/* ── Persistence ───────────────────────────────────────────── */
function loadProgress(resourceId) {
  try {
    const raw = localStorage.getItem(`sc_match_progress_${resourceId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveProgress(resourceId, data) {
  try {
    localStorage.setItem(`sc_match_progress_${resourceId}`, JSON.stringify(data));
  } catch {}
}

function clearProgress(resourceId) {
  try {
    localStorage.removeItem(`sc_match_progress_${resourceId}`);
  } catch {}
}

/* ── Component ─────────────────────────────────────────────── */
export default function MatchingPairsGame({ resource, flashcardData, gameMode = "visible", onBack, onQuizComplete, onStreakUpdate, onXpUpdate }) {
  const audioRef = useRef(null);
  const confettiCanvasRef = useRef(null);
  const { burst } = useConfetti(confettiCanvasRef);
  const timerRef = useRef(null);

  const allCards = useMemo(() => {
    const parsed = typeof flashcardData === "string" ? JSON.parse(flashcardData) : flashcardData;
    return Array.isArray(parsed) ? parsed : [];
  }, [flashcardData]);

  // Build level slices — shuffle once, split into chunks
  const levelSlices = useMemo(() => {
    if (allCards.length < 2) return [];
    const shuffled = shuffleArray(allCards);
    const slices = [];
    for (let i = 0; i < shuffled.length; i += PAIRS_PER_LEVEL) {
      slices.push(shuffled.slice(i, i + PAIRS_PER_LEVEL));
    }
    return slices;
  }, [allCards]);

  const totalLevels = levelSlices.length;

  // Game state
  const [gameState, setGameState] = useState("playing"); // playing | levelcomplete | master
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [levelStats, setLevelStats] = useState({}); // { levelIndex: { moves, seconds, bestMoves, bestSeconds } }
  const [resumeAvailable, setResumeAvailable] = useState(false);

  // Per-round state
  const [deck, setDeck] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matchedSet, setMatchedSet] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const [matchStreak, setMatchStreak] = useState(0);
  const [mismatchedPair, setMismatchedPair] = useState(null);
  const [selectedSet, setSelectedSet] = useState([]); // for visible mode
  const [removingSet, setRemovingSet] = useState(new Set()); // for visible mode removal anim
  const [wrongPair, setWrongPair] = useState(null); // for visible mode wrong anim
  const [soundOn, setSoundOn] = useState(true);
  const [streakToast, setStreakToast] = useState({ show: false, msg: "" });
  const [xpToast, setXpToast] = useState({ show: false, amount: 0 });
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Total stats across all completed levels
  const totalStats = useMemo(() => {
    let totalMoves = 0, totalSeconds = 0;
    completedLevels.forEach(lv => {
      const s = levelStats[lv];
      if (s) { totalMoves += s.moves; totalSeconds += s.seconds; }
    });
    return { totalMoves, totalSeconds };
  }, [completedLevels, levelStats]);

  // Load saved progress on mount
  useEffect(() => {
    const saved = loadProgress(resource?.id || "default");
    if (saved && saved.currentLevel != null && saved.currentLevel < totalLevels && saved.completedLevels?.length > 0) {
      setResumeAvailable(true);
    }
  }, [resource, totalLevels]);

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
    const handler = (e) => { if (e.key === "Escape") setShowExitConfirm(true); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function playSound(fn) {
    if (!audioRef.current) audioRef.current = createAudioSystem();
    audioRef.current[fn]();
  }

  function showStreakToastMsg(msg) {
    setStreakToast({ show: true, msg });
    setTimeout(() => setStreakToast({ show: false, msg: "" }), 900);
  }

  // Build deck for a level
  function buildLevelDeck(levelIndex) {
    const slice = levelSlices[levelIndex];
    if (!slice) return [];
    const cards = [];
    slice.forEach((card, i) => {
      const pairId = `pair_${levelIndex}_${i}`;
      cards.push({ pairId, type: "term", text: card.front, cardIndex: i });
      cards.push({ pairId, type: "def", text: card.back, cardIndex: i });
    });
    return shuffleArray(cards);
  }

  // Start a level
  function startLevel(levelIndex) {
    const newDeck = buildLevelDeck(levelIndex);
    setDeck(newDeck);
    setFlipped([]);
    setMatchedSet(new Set());
    setMoves(0);
    setSeconds(0);
    setLocked(false);
    setMatchStreak(0);
    setMismatchedPair(null);
    setSelectedSet([]);
    setRemovingSet(new Set());
    setWrongPair(null);
    setGameState("playing");

    // Start timer
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  }

  // Resume from saved progress
  function handleResume() {
    const saved = loadProgress(resource?.id || "default");
    if (saved) {
      setCompletedLevels(saved.completedLevels || []);
      setLevelStats(saved.levelStats || {});
      setCurrentLevel(saved.currentLevel);
      startLevel(saved.currentLevel);
    }
  }

  // Start fresh
  function handleStartNew() {
    clearProgress(resource?.id || "default");
    setCompletedLevels([]);
    setLevelStats({});
    setCurrentLevel(0);
    setResumeAvailable(false);
    startLevel(0);
  }

  // Handle card flip
  function handleFlip(idx) {
    if (locked) return;
    if (flipped.some(f => f.idx === idx)) return;
    if (matchedSet.has(idx)) return;
    if (flipped.length === 2) return;

    playSound("flip");
    const newFlipped = [...flipped, { idx }];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = newFlipped;
      const cardA = deck[a.idx];
      const cardB = deck[b.idx];
      const isMatch = cardA.pairId === cardB.pairId && cardA.type !== cardB.type;

      setTimeout(() => {
        if (isMatch) {
          const newStreak = matchStreak + 1;
          setMatchStreak(newStreak);
          setMatchedSet(prev => { const s = new Set(prev); s.add(a.idx); s.add(b.idx); return s; });
          playSound("match");
          vibrate(newStreak >= 2 ? [30, 40, 30] : 25);

          // Confetti at card position
          const cardEl = document.querySelector(`[data-card-idx="${a.idx}"]`);
          if (cardEl) {
            const rect = cardEl.getBoundingClientRect();
            burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
          }

          if (newStreak >= 2) showStreakToastMsg(`🔥 ${newStreak} in a row!`);

          // Check if level complete (compute from current matchedSet + the 2 we just added)
          const totalPairs = deck.length / 2;
          const newMatchedCount = matchedSet.size / 2 + 1;
          if (newMatchedCount >= totalPairs) {
            // Level complete!
            setTimeout(() => completeLevel(), 300);
          }
        } else {
          setMatchStreak(0);
          setMismatchedPair([a.idx, b.idx]);
          playSound("mismatch");
          vibrate(60);
          setTimeout(() => {
            setMismatchedPair(null);
          }, 500);
        }
        setFlipped([]);
        setLocked(false);
      }, 600);
    }
  }

  // Handle card select (visible mode)
  function handleSelect(idx) {
    if (locked) return;
    if (matchedSet.has(idx)) return;
    if (removingSet.has(idx)) return;

    // Toggle off if already selected
    const alreadyIdx = selectedSet.indexOf(idx);
    if (alreadyIdx !== -1) {
      setSelectedSet(selectedSet.filter(i => i !== idx));
      return;
    }
    if (selectedSet.length === 2) return;

    playSound("flip");
    const newSelected = [...selectedSet, idx];
    setSelectedSet(newSelected);

    if (newSelected.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [aIdx, bIdx] = newSelected;
      const cardA = deck[aIdx];
      const cardB = deck[bIdx];
      const isMatch = cardA.pairId === cardB.pairId && cardA.type !== cardB.type;

      if (isMatch) {
        const newStreak = matchStreak + 1;
        setMatchStreak(newStreak);
        playSound("match");
        vibrate(newStreak >= 2 ? [30, 40, 30] : 25);

        // Confetti at card position
        const cardEl = document.querySelector(`[data-card-idx="${aIdx}"]`);
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect();
          burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
        }

        if (newStreak >= 2) showStreakToastMsg(`🔥 ${newStreak} in a row!`);

        // Add to matched set, start removal animation
        setMatchedSet(prev => { const s = new Set(prev); s.add(aIdx); s.add(bIdx); return s; });
        setRemovingSet(prev => { const s = new Set(prev); s.add(aIdx); s.add(bIdx); return s; });
        setSelectedSet([]);

        // Check level complete
        const totalPairs = deck.length / 2;
        const newMatchedCount = matchedSet.size / 2 + 1;
        if (newMatchedCount >= totalPairs) {
          setTimeout(() => completeLevel(), 600);
        }

        // Unlock after removal animation
        setTimeout(() => {
          setLocked(false);
        }, 600);
      } else {
        setMatchStreak(0);
        setWrongPair([aIdx, bIdx]);
        playSound("mismatch");
        vibrate(60);
        setTimeout(() => {
          setWrongPair(null);
          setSelectedSet([]);
          setLocked(false);
        }, 500);
      }
    }
  }

  // Complete a level
  function completeLevel() {
    clearInterval(timerRef.current);
    const levelMoves = moves;
    const levelSeconds = seconds;

    // Track stats
    const prevStats = levelStats[currentLevel];
    const isNewBest = !prevStats || levelSeconds < prevStats.bestSeconds ||
      (levelSeconds === prevStats.bestSeconds && levelMoves < prevStats.bestMoves);

    const newLevelStats = {
      ...levelStats,
      [currentLevel]: {
        moves: levelMoves,
        seconds: levelSeconds,
        bestMoves: isNewBest ? levelMoves : prevStats.bestMoves,
        bestSeconds: isNewBest ? levelSeconds : prevStats.bestSeconds,
      },
    };
    setLevelStats(newLevelStats);

    const newCompleted = [...completedLevels, currentLevel];
    setCompletedLevels(newCompleted);

    // Save progress
    const nextLevel = currentLevel + 1;
    const isLastLevel = nextLevel >= totalLevels;
    saveProgress(resource?.id || "default", {
      currentLevel: isLastLevel ? currentLevel : nextLevel,
      completedLevels: newCompleted,
      levelStats: newLevelStats,
    });

    // Submit to backend
    submitLevel(levelMoves, levelSeconds, currentLevel, isLastLevel);

    // XP toast
    setXpToast({ show: true, amount: XP_PER_LEVEL });
    setTimeout(() => setXpToast({ show: false, amount: 0 }), 2000);

    if (isLastLevel) {
      playSound("master");
      // Big confetti
      burst(window.innerWidth / 2, window.innerHeight * 0.35, 80);
      setGameState("master");
      clearProgress(resource?.id || "default");
    } else {
      playSound("levelUp");
      burst(window.innerWidth / 2, window.innerHeight * 0.35, 40);
      setGameState("levelcomplete");
    }
  }

  // Submit level to backend
  async function submitLevel(levelMoves, levelSeconds, levelIdx, isLast) {
    if (!resource?.id) return;
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
          score: XP_PER_LEVEL,
          total: levelIdx + 1,
          details: { game: "matching_pairs", level: levelIdx, moves: levelMoves, seconds: levelSeconds, isLast },
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

  // Next level
  function handleNextLevel() {
    const next = currentLevel + 1;
    setCurrentLevel(next);
    startLevel(next);
  }

  // Play again from scratch
  function handlePlayAgain() {
    clearProgress(resource?.id || "default");
    setCompletedLevels([]);
    setLevelStats({});
    setCurrentLevel(0);
    setGameState("playing");
    startLevel(0);
  }

  // Exit
  function handleExit() {
    clearInterval(timerRef.current);
    if (onBack) onBack();
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

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
  const totalPairs = deck.length / 2;
  const matchedPairs = matchedSet.size / 2;

  // Not enough cards
  if (allCards.length < 2) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)",
        color: textHi, fontFamily: "Manrope, sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24,
      }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Not enough cards</div>
          <div style={{ fontSize: 14, color: textDim, marginBottom: 20 }}>You need at least 2 flashcards to play Matching Pairs.</div>
          <button onClick={onBack} style={{
            padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink,
            fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14,
          }}>← Back</button>
        </div>
      </div>
    );
  }

  // Pre-game screen (resume or start new)
  if (deck.length === 0 && gameState === "playing" && !resumeAvailable) {
    // Auto-start if no resume option
    // This handles the initial load — start level 0
    // But if resumeAvailable is true, show the choice screen
  }

  // Resume / Start screen
  if (resumeAvailable && deck.length === 0 && gameState === "playing") {
    const saved = loadProgress(resource?.id || "default");
    const savedLevel = saved?.currentLevel || 0;
    const savedCompleted = saved?.completedLevels?.length || 0;
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)",
        color: textHi, fontFamily: "Manrope, sans-serif",
        display: "flex", justifyContent: "center", overflowY: "auto",
      }}>
        <div style={{
          width: "100%", maxWidth: isMobile ? 520 : 640, minHeight: "100dvh",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "max(18px, env(safe-area-inset-top)) clamp(14px, 4vw, 24px) max(18px, env(safe-area-inset-bottom))",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Matching Pairs</div>
            <div style={{ color: textDim, fontSize: 14, marginBottom: 24 }}>
              {totalLevels} levels · {allCards.length} cards total
            </div>

            <div style={{
              background: "rgba(255,182,39,0.08)", border: "1px solid rgba(255,182,39,0.3)",
              borderRadius: 14, padding: 16, marginBottom: 12,
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: gold, marginBottom: 6 }}>
                SAVED PROGRESS
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                Level {savedLevel + 1} of {totalLevels}
              </div>
              <div style={{ fontSize: 13, color: textDim, marginTop: 4 }}>
                {savedCompleted} level{savedCompleted > 1 ? "s" : ""} completed
              </div>
            </div>

            <button onClick={handleResume} style={{
              width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink,
              fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 10,
            }}>Continue from Level {savedLevel + 1} →</button>

            <button onClick={handleStartNew} style={{
              width: "100%", padding: 14, borderRadius: 10, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`,
              color: textDim, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 10,
            }}>Start Over</button>

            <button onClick={onBack} style={{
              width: "100%", padding: 12, borderRadius: 10, cursor: "pointer",
              background: "transparent", border: "none",
              color: textDim, fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 13,
            }}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  // Auto-start first level if no resume screen needed
  useEffect(() => {
    if (deck.length === 0 && gameState === "playing" && !resumeAvailable && levelSlices.length > 0) {
      startLevel(currentLevel);
    }
  }, [deck.length, gameState, resumeAvailable, levelSlices, currentLevel]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)",
      color: textHi, fontFamily: "Manrope, sans-serif",
      display: "flex", justifyContent: "center", overflowY: "auto",
    }}>
      <canvas ref={confettiCanvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }} />

      {/* Streak toast */}
      {streakToast.show && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600,
          color: gold, background: "rgba(255,182,39,0.12)",
          border: "1px solid rgba(255,182,39,0.3)",
          padding: "8px 16px", borderRadius: 20, zIndex: 60, pointerEvents: "none",
        }}>{streakToast.msg}</div>
      )}

      {/* XP toast */}
      {xpToast.show && (
        <div style={{
          position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700,
          color: green, background: "rgba(74,222,128,0.12)",
          border: "1px solid rgba(74,222,128,0.3)",
          padding: "8px 18px", borderRadius: 20, zIndex: 60, pointerEvents: "none",
          animation: "mpXpPop 0.4s ease",
        }}>+{xpToast.amount} XP</div>
      )}

      {/* Exit confirm overlay */}
      {showExitConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 70,
          background: "rgba(10,13,19,0.72)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            width: "100%", maxWidth: 340, background: cardBg,
            border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20, textAlign: "center",
          }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, marginBottom: 8 }}>Leave this round?</h3>
            <p style={{ fontSize: 14, color: textDim, marginBottom: 16 }}>Your progress on this level won't be saved.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowExitConfirm(false)} style={{
                flex: 1, padding: 12, borderRadius: 10, cursor: "pointer",
                background: "rgba(255,255,255,0.05)", border: `1px solid ${cardBorder}`,
                color: textHi, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14,
              }}>Keep playing</button>
              <button onClick={handleExit} style={{
                flex: 1, padding: 12, borderRadius: 10, cursor: "pointer",
                background: "rgba(255,94,126,0.12)", border: "1px solid rgba(255,94,126,0.3)",
                color: coral, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14,
              }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        width: "100%", maxWidth: isMobile ? 520 : 640, minHeight: "100dvh",
        display: "flex", flexDirection: "column",
        padding: isMobile
          ? "max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom))"
          : "max(18px, env(safe-area-inset-top)) clamp(14px, 4vw, 24px) max(18px, env(safe-area-inset-bottom))",
      }}>
        {/* ── Playing screen ── */}
        {gameState === "playing" && deck.length > 0 && (
          <>
            {/* Topbar — compact */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setShowExitConfirm(true)} style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`,
                  color: textDim, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, cursor: "pointer", flexShrink: 0,
                }}>✕</button>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: textDim }}>
                  Lv {currentLevel + 1}/{totalLevels}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, alignItems: "center" }}>
                <span style={{ color: green }}>{matchedPairs}/{totalPairs}</span>
                <span style={{ color: blue }}>{moves}</span>
                <span style={{ color: gold }}>{fmtTime(seconds)}</span>
                <button onClick={toggleSound} style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  color: soundOn ? blue : textDim,
                  border: `1px solid ${soundOn ? "rgba(0,229,255,0.35)" : cardBorder}`,
                  background: "transparent", padding: "3px 6px", borderRadius: 6, cursor: "pointer",
                }}>{soundOn ? "🔊" : "🔇"}</button>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{
              height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 4,
              marginBottom: 8, overflow: "hidden", flexShrink: 0,
            }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: `linear-gradient(90deg, ${blue}, ${green})`,
                width: `${(matchedPairs / totalPairs) * 100}%`,
                transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>

            {/* Card grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(4, minmax(0, 1fr))",
              gap: isMobile ? 6 : 10,
              maxWidth: isMobile ? "100%" : 460,
              margin: "0 auto",
              width: "100%",
              perspective: gameMode === "flip" ? 800 : undefined,
              flex: 1, alignContent: "stretch",
              minHeight: 0,
            }}>
              {deck.map((card, idx) => {
                const isMatched = matchedSet.has(idx);
                const isRemoving = removingSet.has(idx);

                if (gameMode === "visible") {
                  const isSelected = selectedSet.includes(idx);
                  const isWrong = wrongPair?.includes(idx);
                  return (
                    <div
                      key={idx}
                      data-card-idx={idx}
                      role="button"
                      tabIndex={0}
                      aria-label={`${card.type === "term" ? "Term" : "Definition"}: ${card.text}`}
                      onClick={() => handleSelect(idx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(idx); }
                      }}
                      style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        textAlign: "center", padding: 8,
                        borderRadius: 10,
                        background: isMatched ? "rgba(74,222,128,0.15)" : isSelected ? "rgba(0,229,255,0.1)" : isWrong ? "rgba(255,94,126,0.15)" : cardBg,
                        border: `1.5px solid ${isMatched ? green : isSelected ? blue : isWrong ? coral : cardBorder}`,
                        borderLeft: `3px solid ${card.type === "term" ? blue : "rgba(255,255,255,0.18)"}`,
                        color: isMatched ? green : isWrong ? coral : card.type === "term" ? blue : textHi,
                        fontSize: isMobile ? "clamp(8px, 2.8vw, 11px)" : "clamp(9.5px, 3.1vw, 12px)",
                        lineHeight: 1.28, fontWeight: 600,
                        overflow: "hidden", wordBreak: "break-word", hyphens: "auto",
                        cursor: isMatched || isRemoving || locked ? "default" : "pointer",
                        userSelect: "none", WebkitTapHighlightColor: "transparent",
                        boxShadow: isSelected ? "0 0 0 2px rgba(0,229,255,0.25)" : "none",
                        opacity: isRemoving ? 0 : 1,
                        transform: isRemoving ? "scale(0.5)" : isMatched ? "scale(1)" : "scale(1)",
                        pointerEvents: isRemoving ? "none" : "auto",
                        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease, opacity 0.32s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                        ...(isMatched && !isRemoving ? { animation: "mpPop2 0.4s ease" } : {}),
                        ...(isWrong ? { animation: "mpShake2 0.35s ease" } : {}),
                      }}
                    >
                      {card.text}
                    </div>
                  );
                }

                // Flip mode rendering (existing 3D card)
                const isFlipped = flipped.some(f => f.idx === idx);
                const isMismatched = mismatchedPair?.includes(idx);
                const showFront = isFlipped || isMatched;

                return (
                  <div
                    key={idx}
                    data-card-idx={idx}
                    role="button"
                    tabIndex={0}
                    aria-label={`Card ${idx + 1}, ${showFront ? card.text : "hidden"}`}
                    onClick={() => handleFlip(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleFlip(idx); }
                    }}
                    style={{
                      width: "100%", height: "100%",
                      position: "relative",
                      cursor: isMatched || locked ? "default" : "pointer",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{
                      width: "100%", height: "100%", position: "relative",
                      transformStyle: "preserve-3d",
                      transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
                      transform: showFront ? "rotateY(180deg)" : "rotateY(0deg)",
                      ...(isMismatched ? { animation: "mpShake 0.35s ease" } : {}),
                      ...(isMatched ? { animation: "mpPop 0.4s ease" } : {}),
                    }}>
                      {/* Back face */}
                      <div style={{
                        position: "absolute", inset: 0, borderRadius: 12,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "linear-gradient(160deg, rgba(0,229,255,0.12), rgba(255,255,255,0.02))",
                        border: `1px solid ${cardBorder}`,
                        backfaceVisibility: "hidden",
                        fontSize: 22, color: blue, opacity: 0.6,
                        fontFamily: "'Syne', sans-serif",
                      }}>?</div>

                      {/* Front face */}
                      <div style={{
                        position: "absolute", inset: 0, borderRadius: 12,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        textAlign: "center", padding: 8,
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        background: isMatched ? "rgba(74,222,128,0.12)" : isMismatched ? "rgba(255,94,126,0.15)" : cardBg,
                        border: `1px solid ${isMatched ? green : isMismatched ? coral : cardBorder}`,
                        color: isMatched ? green : isMismatched ? coral : card.type === "term" ? blue : textHi,
                        fontSize: isMobile ? "clamp(8px, 2.8vw, 11px)" : "clamp(9.5px, 3.1vw, 12px)",
                        lineHeight: 1.28, fontWeight: 600,
                        overflow: "hidden", wordBreak: "break-word", hyphens: "auto",
                        ...(isMatched ? { animation: "mpGlowPulse 0.8s ease" } : {}),
                      }}>
                        {card.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Level complete screen ── */}
        {gameState === "levelcomplete" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Level {currentLevel + 1} Complete
            </div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800,
              background: `linear-gradient(135deg, ${gold}, ${blue})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", margin: "8px 0",
            }}>{fmtTime(seconds)}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {moves} moves
            </div>

            {levelStats[currentLevel] && (
              <div style={{ marginTop: 12 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: gold,
                  border: "1px solid rgba(255,182,39,0.3)", background: "rgba(255,182,39,0.08)",
                  padding: "5px 12px", borderRadius: 20,
                }}>🏆 New best!</span>
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 13, color: textDim }}>
              {completedLevels.length} of {totalLevels} levels done
            </div>

            <button onClick={handleNextLevel} style={{
              width: "100%", padding: 14, marginTop: 16, borderRadius: 10, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink,
              fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15,
            }}>Next Level →</button>
            <button onClick={() => setShowExitConfirm(true)} style={{
              width: "100%", padding: 12, marginTop: 8, borderRadius: 10, cursor: "pointer",
              background: "transparent", border: "none",
              color: textDim, fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 13,
            }}>Take a break</button>
          </div>
        )}

        {/* ── Master screen ── */}
        {gameState === "master" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
              Mastered!
            </div>
            <div style={{ color: textDim, fontSize: 14, marginBottom: 20 }}>
              You cleared all {totalLevels} levels
            </div>

            <div style={{
              display: "flex", gap: 16, justifyContent: "center", marginBottom: 20,
            }}>
              <div style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`,
                borderRadius: 14, padding: "16px 20px",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                  Total Time
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: gold }}>
                  {fmtTime(totalStats.totalSeconds)}
                </div>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`,
                borderRadius: 14, padding: "16px 20px",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                  Total Moves
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: blue }}>
                  {totalStats.totalMoves}
                </div>
              </div>
            </div>

            <button onClick={handlePlayAgain} style={{
              width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${blue}, #0aa8c4)`, color: ink,
              fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 8,
            }}>Play Again</button>
            <button onClick={onBack} style={{
              width: "100%", padding: 12, borderRadius: 10, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: `1px solid ${cardBorder}`,
              color: textDim, fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14,
            }}>← Back</button>
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes mpShake {
          0%, 100% { transform: rotateY(180deg) translateX(0); }
          20% { transform: rotateY(180deg) translateX(-6px) rotate(-1deg); }
          40% { transform: rotateY(180deg) translateX(6px) rotate(1deg); }
          60% { transform: rotateY(180deg) translateX(-4px); }
          80% { transform: rotateY(180deg) translateX(4px); }
        }
        @keyframes mpPop {
          0% { transform: rotateY(180deg) scale(1); }
          40% { transform: rotateY(180deg) scale(1.12); }
          100% { transform: rotateY(180deg) scale(1); }
        }
        @keyframes mpGlowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
        }
        @keyframes mpXpPop {
          0% { transform: translateX(-50%) translateY(-10px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes mpPop2 {
          0% { transform: scale(1); }
          40% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes mpShake2 {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px) rotate(-1deg); }
          40% { transform: translateX(6px) rotate(1deg); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        button:focus-visible {
          outline: 2px solid ${gold};
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  );
}
