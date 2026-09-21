import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { callAI } from '../../lib/aiClient.js';
import { recordPracticeResult } from '../../lib/studyHistory.js';
import { API_BASE } from '../../lib/constants';
import { getMyLeague, getLeagueStandings, checkBadges } from '../../lib/gamificationApi.js';
import {
  loadSave, mutate, tickDay,
  levelFromXP, levelProgress, titleForLevel,
  TIER_XP, TIER_GEMS,
  activeQuests, questEvent, claimQuest,
  ACHIEVEMENTS, checkAchievements,
} from './survivalStore.js';
import {
  getAuthHeaders, isAuthed,
  deriveRating, normalizeBank, normalizeQuestion,
  initFsrs, fetchCardStates, rateQuestion,
  pickPracticeIndex, pickSurvivalIndex, masteryDots, buildForecast,
} from './fsrsBridge.js';
import { sound, setSoundEnabled } from './survivalAudio.js';
import { haptics } from '../../lib/haptics';
import useConfetti from './useConfetti.js';
import './streakSurvival.css';

const MAX_LIVES = 3;
const SPEED_WINDOW = 7000;
const REVIVE_COST = 15;

const QUOTES = [
  { t: 'Repetition is the mother of learning.', a: 'Latin proverb' },
  { t: 'We are what we repeatedly do. Excellence is not an act, but a habit.', a: 'Will Durant' },
  { t: 'Little by little, a little becomes a lot.', a: 'Tanzanian proverb' },
  { t: 'Memory is the treasury and guardian of all things.', a: 'Cicero' },
  { t: 'The art of remembering is the art of thinking.', a: 'William James' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil?';
  if (h < 12) return 'Good morning, scholar';
  if (h < 17) return 'Good afternoon, scholar';
  if (h < 21) return 'Good evening, scholar';
  return 'Late-night grind';
}

// Survival runs are finite sections of SECTION_SIZE questions (Duolingo-style:
// a bounded session ends on completion, not on an endless recycle).
const SECTION_SIZE = 15;

function verdictFor(best, mode) {
  if (mode === 'practice') return 'Practice complete';
  if (best >= 15) return 'Flawless section';
  if (best >= 10) return 'On fire';
  if (best >= 7) return 'Strong run';
  if (best >= 3) return 'Warming up';
  return 'Every legend starts at zero';
}

let floatId = 0;
let toastId = 0;

// Fisher–Yates shuffle of a question's options. Returns a new question with
// remapped answer index; `_order[i]` = original index now shown at position i,
// so picked letters can still be mapped back for weakspot reporting.
function shuffleQuestion(q) {
  const order = q.opts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Compose with any previous shuffle so _order always maps a displayed
  // position back to the ORIGINAL bank option index (weakspot letters).
  const composed = q._order ? order.map((i) => q._order[i]) : order;
  return { ...q, opts: order.map((i) => q.opts[i]), a: order.indexOf(q.a), _order: composed };
}

export default function StreakSurvival({ resource, items, mode: forcedMode, onBack, onQuizComplete, onStreakUpdate, onXpUpdate }) {
  // ── Save ──
  const [save, setSave] = useState(() => { tickDay(); return { ...loadSave() }; });
  const bump = useCallback(() => setSave({ ...loadSave() }), []);
  const editSave = useCallback((fn) => { mutate(fn); bump(); }, [bump]);

  // ── Bank ──
  const isDaily = Array.isArray(items) && items.length > 0;
  const bank = useMemo(() => {
    if (isDaily) {
      return items.map((it) => ({
        ...normalizeQuestion(it.mcq, it.pageIndex, it.resourceId, it.itemType || 'mcq'),
        _topic: it.topic,
        _subject: it.subject,
      }));
    }
    if (resource?.mcqData) return normalizeBank(resource.mcqData, resource.id);
    return [];
  }, [isDaily, items, resource]);

  // ── FSRS state ──
  const [cardStates, setCardStates] = useState({});
  const [stats, setStats] = useState(null); // {streak, reviewedToday, dailyGoal, dueCount, masteredCount}

  // ── Screens ──
  const [screen, setScreen] = useState(bank.length === 0 ? 'home' : 'game');
  const [runMode, setRunMode] = useState(isDaily || forcedMode === 'practice' ? 'practice' : 'survival');

  // ── Run state ──
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [runBest, setRunBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [qNum, setQNum] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correctN, setCorrectN] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionGems, setSessionGems] = useState(0);
  const [current, setCurrent] = useState(null); // {q, idx}
  const [sectionTarget, setSectionTarget] = useState(Math.min(SECTION_SIZE, bank.length)); // questions this survival section
  const usedRef = useRef(new Set()); // bank indices already served this run
  const lastIdxRef = useRef(-1);
  const answersRef = useRef({}); // rawIndex -> picked letter (for weakspots)

  // Per-card state
  const [locked, setLocked] = useState(false);
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [eliminated, setEliminated] = useState(new Set());
  const [fsrsNote, setFsrsNote] = useState(null);
  const [explain, setExplain] = useState({ show: false, loading: false, thread: [] }); // thread: [{role:'ai'|'user', text}]
  const [followUp, setFollowUp] = useState('');
  const explainCtxRef = useRef(null); // question context for follow-up prompts
  const explainThreadRef = useRef(null);
  const qStartRef = useRef(Date.now());

  // Review loop
  const [reviewQueue, setReviewQueue] = useState([]);
  const [clearedN, setClearedN] = useState(0);
  const [missedTotal, setMissedTotal] = useState(0);
  const [reviewBadge, setReviewBadge] = useState(null); // 'correct'|'wrong'|'neutral'
  const reviewMissedRef = useRef([]);

  // End screen
  const [endInfo, setEndInfo] = useState(null);

  // Game over (hearts depleted)
  const [gameOver, setGameOver] = useState(false);
  const [revivesUsed, setRevivesUsed] = useState(0);
  const [streakCelebration, setStreakCelebration] = useState(null); // new streak day count
  const streakCelebrateRef = useRef(null); // pending streak increment, shown on end screen
  const deckClearedRef = useRef(false); // survival: served the whole section
  const timesRef = useRef([]); // per-question ms, game phase only
  const [quitTarget, setQuitTarget] = useState(null); // 'home'|'exit' — confirm-quit modal

  // ── Chrome ──
  const [timerPct, setTimerPct] = useState(100);
  const timerRef = useRef(null);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(''); // 'correct-flash'|'wrong-flash'|'milestone-flash'
  const [comboPulse, setComboPulse] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [floats, setFloats] = useState([]);
  const [levelUp, setLevelUp] = useState(null); // new level number
  const [modal, setModal] = useState(null); // 'profile'|'league'|'chest'
  const [league, setLeague] = useState(null);
  const [leagueBusy, setLeagueBusy] = useState(false);
  const [chestState, setChestState] = useState({ opened: false, reward: '' });
  const [pendingChest, setPendingChest] = useState(null); // 'warmup'|'quest'

  const { canvasRef, fire } = useConfetti();
  const appRef = useRef(null);

  const scope = isDaily ? 'global' : String(resource?.id || 'default');
  const best = save.bestByScope?.[scope] || 0;
  const tier = streak >= 6 ? 'hard' : streak >= 3 ? 'medium' : 'easy';
  const tierColor = tier === 'hard' ? '#FF5E7E' : tier === 'medium' ? '#FFB627' : '#00E5FF';
  const lvlProg = levelProgress(save.xp);
  const lvl = lvlProg.level;

  // ── Init ──
  useEffect(() => {
    setSoundEnabled(loadSave().soundOn);
    if (isAuthed()) {
      fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setStats(d))
        .catch(() => {});
    }
    if (isDaily) {
      const map = {};
      for (const it of items) {
        map[`${it.resourceId}:${it.pageIndex}`] = {
          state: it.state, stability: it.stability, difficulty: it.difficulty,
          dueAt: it.dueAt, isDue: true, isMastered: false, itemType: it.itemType || 'mcq',
        };
      }
      setCardStates(map);
    } else if (resource?.id && isAuthed()) {
      initFsrs(resource.id).then(() => fetchCardStates(resource.id)).then((map) => {
        const keyed = {};
        for (const [pi, v] of Object.entries(map)) keyed[`${resource.id}:${pi}`] = v;
        setCardStates(keyed);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start: daily items → practice; material → survival is the default mode
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || bank.length === 0) return;
    startedRef.current = true;
    if (isDaily) {
      serveIdx(0, 'practice');
    } else {
      startRun('survival');
    }
  }, [isDaily, bank]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toasts & floats ──
  const toast = useCallback((msg, color = '#FFB627', ms = 1600) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  const xpFloat = useCallback((text, color = '#00E5FF') => {
    const id = ++floatId;
    const x = 40 + Math.random() * 20; // vw center-ish
    const y = 22 + Math.random() * 6;
    setFloats((f) => [...f, { id, text, color, x, y }]);
    setTimeout(() => setFloats((f) => f.filter((x2) => x2.id !== id)), 1000);
  }, []);

  // questEvent + completion toast
  const qe = useCallback((key, value, opts) => {
    const done = questEvent(key, value, opts);
    done.forEach((id) => {
      const q = activeQuests().find((x) => x.id === id);
      if (q) toast(`✅ ${q.name} — claim 💎${q.reward}`, '#4ADE80', 2400);
    });
    if (done.length) bump();
  }, [toast, bump]);

  // ── Economy ──
  const grantXp = useCallback((n, label) => {
    const before = lvl;
    editSave((s) => { s.xp += n; });
    // Feed the unified XP pool (stats.xp -> server via /user-data/sync)
    if (onXpUpdate) onXpUpdate(n);
    else window.dispatchEvent(new CustomEvent('sc-xp-gained', { detail: { xp: n } }));
    const after = levelFromXP(loadSave().xp);
    setSessionXp((v) => v + n);
    xpFloat(`+${n} XP${label ? ` ${label}` : ''}`, '#00E5FF');
    qe('xpToday', n);
    if (after > before) {
      setLevelUp(after);
      sound.levelup();
      haptics.success();
      setTimeout(() => setLevelUp(null), 1600);
    }
  }, [editSave, lvl, xpFloat, qe, onXpUpdate]);

  const grantGems = useCallback((n, why) => {
    editSave((s) => { s.gems += n; s.lifetimeGems += n; });
    setSessionGems((v) => v + n);
    xpFloat(`+${n} 💎${why ? ` ${why}` : ''}`, '#FFB627');
  }, [editSave, xpFloat]);

  // ── Question serving ──
  function serveIdx(idx, mode) {
    const q = bank[idx];
    if (!q) { endRun(mode); return; }
    lastIdxRef.current = idx;
    usedRef.current.add(idx);
    setCurrent({ q: shuffleQuestion(q), idx });
    setQNum((n) => n + 1);
    setLocked(false); setPicked(null); setRevealed(false);
    setHintUsed(false); setEliminated(new Set());
    setFsrsNote(null); setExplain({ show: false, loading: false, thread: [] }); setFollowUp('');
    qStartRef.current = Date.now();
    setTimerPct(100);
  }

  function serveNext(mode) {
    if (isDaily) {
      // Daily review: sequential, finite
      const nextIdx = bank.findIndex((_, i) => !usedRef.current.has(i));
      if (nextIdx === -1) { endRun(mode); return; }
      serveIdx(nextIdx, mode);
      return;
    }
    if (mode === 'practice') {
      serveIdx(pickPracticeIndex(bank, keyedStatesForBank(), lastIdxRef.current), mode);
      return;
    }
    // Survival: finite section — the run is won by clearing SECTION_SIZE
    // questions (never recycled). Choice blends toward weak/due FSRS cards as
    // the streak climbs; the final question prefers a strong card so the
    // section ends on a win when possible.
    if (qNum >= sectionTarget) {
      deckClearedRef.current = true;
      toast('🏁 Section complete — finishing up!', '#4ADE80', 2200);
      endRun(mode);
      return;
    }
    const avail = bank.map((_, i) => i).filter((i) => !usedRef.current.has(i));
    const states = keyedStatesForBank();
    let allowed = new Set(avail);
    if (qNum === sectionTarget - 1) {
      const strong = avail.filter((i) => {
        const st = states[i];
        return st && st.state === 2 && (st.stability || 0) >= 7;
      });
      if (strong.length > 0) allowed = new Set(strong);
    }
    serveIdx(pickSurvivalIndex(bank, states, lastIdxRef.current, streak, allowed), mode);
  }

  function keyedStatesForBank() {
    // cardStates is keyed by _key; pickPracticeIndex wants bank-index keys
    const map = {};
    bank.forEach((q, i) => { if (cardStates[q._key]) map[i] = cardStates[q._key]; });
    return map;
  }

  // ── Survival speed timer (visual only) ──
  useEffect(() => {
    if (screen !== 'game' || runMode !== 'survival' || locked || !current || gameOver) {
      clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - qStartRef.current;
      const pct = Math.max(0, 100 - (elapsed / SPEED_WINDOW) * 100);
      setTimerPct(pct);
      if (pct <= 0) clearInterval(timerRef.current);
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [screen, runMode, locked, current, gameOver]);

  // ── Rating ──
  // skipRate: review-queue re-serves aren't re-rated — the original miss
  // already posted "Again"; a same-session correct would distort the schedule.
  function applyRating(q, correct, rev, skipRate = false) {
    const grade = deriveRating({
      correct, revealed: rev, hintUsed, elapsedMs: Date.now() - qStartRef.current,
    });
    if (skipRate) return grade;
    setFsrsNote({ grade, intervalLabel: null });
    rateQuestion({
      resourceId: q._resourceId ?? resource?.id,
      pageIndex: q._pageIndex,
      grade,
      topic: q._topic || resource?.title,
      subject: q._subject || resource?.subject,
      itemType: cardStates[q._key]?.itemType || q._itemType || 'mcq',
    }).then((data) => {
      if (!data) return;
      setFsrsNote({ grade, intervalLabel: data.intervalLabel });
      setCardStates((prev) => ({
        ...prev,
        [q._key]: {
          state: data.state, stability: data.stability, difficulty: data.difficulty,
          dueAt: data.nextReviewAt, isDue: false, isMastered: data.stability >= 21,
        },
      }));
      if (data.streak != null && onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
      if (data.xpAwarded > 0) {
        editSave((s) => { s.xp += data.xpAwarded; }); // keep local mirror = unified total
        if (onXpUpdate) onXpUpdate(data.xpAwarded);
        else window.dispatchEvent(new CustomEvent('sc-xp-gained', { detail: { xp: data.xpAwarded } }));
      }
      setStats((s) => {
        if (s && data.streak != null && data.streak > (s.streak ?? 0)) streakCelebrateRef.current = data.streak;
        return s ? { ...s, streak: data.streak ?? s.streak, reviewedToday: (s.reviewedToday ?? 0) + 1 } : s;
      });
    });
    return grade;
  }

  function loseLife() {
    const nl = lives - 1;
    setLives(nl);
    sound.heart();
    if (nl <= 0) setTimeout(() => triggerGameOver(), 650);
  }

  function triggerGameOver() {
    if (runEndedRef.current) return;
    sound.heartbreak();
    sound.over();
    haptics.error();
    setGameOver(true);
  }

  function dismissGameOver() {
    setGameOver(false);
    endRun(runMode);
  }

  function reviveWithGems() {
    if (save.gems < REVIVE_COST) return;
    editSave((s) => { s.gems -= REVIVE_COST; });
    setRevivesUsed((n) => n + 1);
    setLives(1);
    setGameOver(false);
    sound.levelup();
    haptics.success();
    toast('❤️ Revived — streak alive!', '#FF7A9E');
    setTimeout(() => serveNext(runMode), 250);
  }

  // ── Answer (game mode) ──
  function handlePick(i) {
    if (locked || !current || eliminated.has(i)) return;
    const q = current.q;
    const isCorrect = i === q.a;
    setPicked(i);
    setLocked(true);
    answersRef.current[q._pageIndex] = String.fromCharCode(65 + (q._order ? q._order[i] : i));
    applyRating(q, isCorrect, false);

    const elapsed = Date.now() - qStartRef.current;
    timesRef.current.push(elapsed);
    setAnswered((n) => n + 1);
    qe('answered', 1);
    editSave((s) => { s.stats.answered += 1; });

    if (isCorrect) {
      const newStreak = streak + 1;
      const newCombo = combo + 1;
      setStreak(newStreak);
      setCombo(newCombo);
      if (newStreak > runBest) setRunBest(newStreak);
      if (newCombo > bestCombo) { setBestCombo(newCombo); qe('maxCombo', newCombo, { setMax: true }); }
      setCorrectN((n) => n + 1);
      qe('correct', 1);
      editSave((s) => { s.stats.correct += 1; });
      if (elapsed < 5000) qe('speedy', 1);
      if (elapsed < 3000) checkSpeedy3();

      // Tier XP + gems
      const xp = TIER_XP[tier];
      grantXp(xp);
      if (newCombo > 0 && newCombo % 5 === 0) grantGems(TIER_GEMS[tier], 'combo');
      if (newCombo === 10) grantXp(10, 'combo bonus');

      // Speed bonus — only on timed cards (learning/review) beaten inside the window
      const wasTimed = runMode === 'survival' && [1, 2].includes(cardStates[q._key]?.state);
      if (wasTimed && elapsed <= SPEED_WINDOW) {
        grantXp(elapsed <= 3000 ? 5 : 2, elapsed <= 3000 ? '⚡⚡ lightning' : '⚡ fast');
      }

      sound.correct();
      haptics.success();
      setFlash('correct-flash');
      setTimeout(() => setFlash(''), 500);
      setComboPulse(true);
      setTimeout(() => setComboPulse(false), 400);

      // Milestones
      if (newStreak === 3) { toast('⚡ Warming up — medium XP', '#FFB627'); sound.milestone(); haptics.medium(); setFlash('milestone-flash'); setTimeout(() => setFlash(''), 900); }
      else if (newStreak === 6) { toast('🔥 On fire — hard XP', '#FF5E7E'); sound.milestone(); haptics.medium(); setFlash('milestone-flash'); setTimeout(() => setFlash(''), 900); }
      else if (newStreak > 0 && newStreak % 10 === 0) { toast(`🌟 ${newStreak} streak!`, '#FFB627'); sound.milestone(); haptics.medium(); fire(40); }
      else if (newStreak > 0 && newStreak % 5 === 0) fire(24);
    } else {
      reviewMissedRef.current.push({ ...q, pickedIdx: i });
      setStreak(0);
      setCombo(0);
      sound.wrong();
      haptics.error();
      setFlash('wrong-flash');
      setTimeout(() => setFlash(''), 500);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      if (runMode === 'survival') loseLife();
    }
  }

  const speedy3Ref = useRef(false);
  function checkSpeedy3() {
    if (!speedy3Ref.current) {
      speedy3Ref.current = true;
      checkAchievementsNow({ speedy3: true });
    }
  }

  function handleReveal() {
    if (locked || !current) return;
    setRevealed(true);
    setLocked(true);
    applyRating(current.q, false, true);
    reviewMissedRef.current.push({ ...current.q, pickedIdx: null });
    timesRef.current.push(Date.now() - qStartRef.current);
    setAnswered((n) => n + 1);
    qe('answered', 1);
    editSave((s) => { s.stats.answered += 1; });
    setStreak(0);
    setCombo(0);
    sound.wrong();
    haptics.error();
    setShake(true);
    setTimeout(() => setShake(false), 400);
    if (runMode === 'survival') loseLife();
  }

  function handleHint() {
    if (locked || !current) return;
    setHintUsed(true);
    sound.click();
    const wrongKeys = current.q.opts.map((_, i) => i).filter((i) => i !== current.q.a && !eliminated.has(i));
    if (wrongKeys.length <= 1) return;
    setEliminated((prev) => new Set(prev).add(wrongKeys[Math.floor(Math.random() * wrongKeys.length)]));
  }

  async function handleExplain() {
    if (!current) return;
    const q = current.q;
    const optionsStr = q.opts.map((v, i) => `${String.fromCharCode(65 + i)}. ${v}`).join('\n');
    const pickedText = picked != null ? q.opts[picked] : '(revealed)';
    explainCtxRef.current = { qText: q.q, optionsStr, correct: q.opts[q.a], pickedText };
    setExplain({ show: true, loading: true, thread: [] });
    try {
      const prompt = `You are a helpful study tutor. A student just answered this MCQ question:\n\nQuestion: ${q.q}\nOptions:\n${optionsStr}\nCorrect answer: ${q.opts[q.a]}\nStudent's answer: ${pickedText}\n\nGive a clear, concise explanation (2-3 sentences) of why the correct answer is right. Be educational and encouraging.`;
      const text = await callAI(prompt, { provider: 'openrouter' });
      setExplain({ show: true, loading: false, thread: [{ role: 'ai', text: text || 'No explanation generated.' }] });
    } catch {
      setExplain({ show: true, loading: false, thread: [{ role: 'ai', text: 'Could not get AI explanation. Please try again.' }] });
    }
  }

  async function handleFollowUp(e) {
    e?.preventDefault?.();
    const text = followUp.trim();
    if (!text || explain.loading || !explain.show) return;
    const ctx = explainCtxRef.current;
    setFollowUp('');
    setExplain((s) => ({ ...s, loading: true, thread: [...s.thread, { role: 'user', text }] }));
    try {
      const context = ctx
        ? `You are a helpful study tutor helping a student with this MCQ:\n\nQuestion: ${ctx.qText}\nOptions:\n${ctx.optionsStr}\nCorrect answer: ${ctx.correct}\nStudent's answer: ${ctx.pickedText}\n`
        : 'You are a helpful study tutor. ';
      const history = explain.thread.map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text}`).join('\n');
      const prompt = `${context}\nConversation so far:\n${history}\n\nStudent asks: ${text}\n\nAnswer concisely (2-4 sentences), grounded in this question's material. If the student asks something unrelated, gently steer them back to the topic.`;
      const reply = await callAI(prompt, { provider: 'openrouter' });
      setExplain((s) => ({ ...s, loading: false, thread: [...s.thread, { role: 'ai', text: reply || 'No response generated.' }] }));
    } catch {
      setExplain((s) => ({ ...s, loading: false, thread: [...s.thread, { role: 'ai', text: 'Could not get a response — try again.' }] }));
    }
  }

  function handleContinue() {
    if (runMode === 'survival' && lives <= 0) { endRun('survival'); return; }
    serveNext(runMode);
  }

  // ── Review loop ──
  function handleReviewPick(i) {
    if (locked || !current) return;
    const q = current.q;
    const isCorrect = i === q.a;
    setPicked(i);
    setLocked(true);
    applyRating(q, isCorrect, false, true);
    if (isCorrect) {
      setReviewBadge('correct');
      sound.correct();
      haptics.light();
      grantXp(5, 'review');
      setClearedN((n) => n + 1);
      qe('reviewCleared', 1);
      editSave((s) => { s.stats.reviewCleared += 1; });
    } else {
      setReviewBadge('wrong');
      sound.wrong();
      haptics.error();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  function handleReviewNext() {
    const q = current.q;
    const wasCorrect = reviewBadge === 'correct';
    const rest = reviewQueue.filter((x) => x._key !== q._key);
    const nextQueue = wasCorrect ? rest : [...rest, q];
    setReviewQueue(nextQueue);
    setReviewBadge(null);
    if (nextQueue.length === 0) { finishToEnd(); return; }
    const next = nextQueue[0];
    const idx = bank.findIndex((b) => b._key === next._key);
    setCurrent({ q: shuffleQuestion(next), idx });
    setQNum((n) => n + 1);
    setLocked(false); setPicked(null); setRevealed(false);
    setHintUsed(false); setEliminated(new Set());
    setFsrsNote(null); setExplain({ show: false, loading: false, thread: [] }); setFollowUp('');
    qStartRef.current = Date.now();
  }

  // ── Run lifecycle ──
  function startRun(mode) {
    sound.click();
    // Daily warmup bonus once per day
    const today = new Date().toISOString().slice(0, 10);
    if (save.warmupDate !== today) {
      editSave((s) => { s.warmupDate = today; s.gems += 5; s.lifetimeGems += 5; });
      setPendingChest('warmup');
    }
    setRunMode(mode);
    setLives(MAX_LIVES);
    setStreak(0); setRunBest(0); setCombo(0); setBestCombo(0);
    setQNum(0); setAnswered(0); setCorrectN(0);
    setSessionXp(0); setSessionGems(0);
    setGameOver(false); setRevivesUsed(0);
    setStreakCelebration(null); streakCelebrateRef.current = null;
    deckClearedRef.current = false;
    setSectionTarget(Math.min(SECTION_SIZE, bank.length));
    timesRef.current = [];
    setQuitTarget(null);
    usedRef.current = new Set();
    lastIdxRef.current = -1;
    answersRef.current = {};
    reviewMissedRef.current = [];
    speedy3Ref.current = false;
    runEndedRef.current = false;
    setScreen('game');
    setTimeout(() => serveNext(mode), 0);
  }

  const runEndedRef = useRef(false);
  function endRun(mode) {
    if (runEndedRef.current) return;
    runEndedRef.current = true;
    const missed = reviewMissedRef.current;
    editSave((s) => { s.stats.runs += 1; });
    if (missed.length > 0) {
      setMissedTotal(missed.length);
      setClearedN(0);
      const queue = [...missed];
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      setReviewQueue(queue);
      setScreen('review');
      // serve first review card
      const next = queue[0];
      const idx = bank.findIndex((b) => b._key === next._key);
      setCurrent({ q: shuffleQuestion(next), idx });
      setQNum((n) => n + 1);
      setLocked(false); setPicked(null); setRevealed(false);
      setHintUsed(false); setEliminated(new Set());
      setFsrsNote(null); setExplain({ show: false, loading: false, thread: [] }); setFollowUp('');
      qStartRef.current = Date.now();
      return;
    }
    finishToEnd(mode);
  }

  function finishToEnd(mode = runMode) {
    const acc = answered > 0 ? Math.round((correctN / answered) * 100) : 0;
    const perfect = answered > 0 && reviewMissedRef.current.length === 0;
    const newBest = runBest > best;
    if (newBest) editSave((s) => { s.bestByScope = { ...(s.bestByScope || {}), [scope]: runBest }; });
    if (perfect) { qe('perfectRun', 1); editSave((s) => { s.stats.perfectRuns += 1; }); }
    if (runMode === 'survival' || mode === 'survival') { if (!gameOver) sound.over(); }
    if (perfect && answered > 0) { sound.perfect(); fire(80); }
    checkAchievementsNow({ bestStreak: Math.max(runBest, best), combo: bestCombo, perfectRun: perfect });
    fireServerCompletion();
    // Streak-extended celebration fires over the end screen (Duolingo-style:
    // the streak increment is delivered inside the flow that earned it).
    if (streakCelebrateRef.current) {
      setStreakCelebration(streakCelebrateRef.current);
      fire(60); sound.milestone(); haptics.success();
    }
    // Warmup/quest chest surfaces over the end screen
    if (pendingChest) { setChestState({ opened: false, reward: '' }); setModal('chest'); }
    // Section cleared → the finite-run win condition. Bonus XP + celebration.
    const deckCleared = deckClearedRef.current && (runMode === 'survival' || mode === 'survival');
    const clearBonus = deckCleared ? 25 : 0;
    if (deckCleared) { grantXp(clearBonus, 'deck clear'); fire(80); sound.chest(); haptics.success(); }
    const times = timesRef.current;
    const avgSec = times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) / 100) / 10 : 0;
    setEndInfo({
      best: runBest, answered, correct: correctN, acc, avgSec,
      xp: sessionXp + clearBonus, gems: sessionGems, cleared: clearedN,
      missed: missedTotal || reviewMissedRef.current.length,
      newBest, perfect, revives: revivesUsed, deckCleared, clearBonus,
      quote: QUOTES[Math.floor(Math.random() * QUOTES.length)],
    });
    setScreen('end');
  }

  function checkAchievementsNow(extra = {}) {
    const s = loadSave();
    const unlocked = checkAchievements({
      bestStreak: extra.bestStreak ?? runBest,
      combo: extra.combo ?? bestCombo,
      perfectRun: extra.perfectRun ?? false,
      speedy3: extra.speedy3 ?? false,
      reviewClearedTotal: s.stats.reviewCleared,
      answeredTotal: s.stats.answered,
      runsTotal: s.stats.runs,
    });
    unlocked.forEach((a) => toast(`🏅 ${a.nm} · +${a.gm}💎`, '#FFB627', 2400));
    if (unlocked.length) bump();
  }

  function fireServerCompletion() {
    if (!isAuthed()) return;
    // Server badges — runs for both material and daily sessions
    try {
      const token = JSON.parse(localStorage.getItem('scholars-circle-auth') || '{}').authToken;
      if (token) checkBadges(token).catch(() => {});
    } catch { /* ignore */ }
    // quiz-attempts for material context (existing pattern)
    if (resource?.id) {
      try { recordPracticeResult(resource.id, rawMcqArr(), answersRef.current); } catch { /* ignore */ }
      fetch(`${API_BASE}/api/resources/quiz-attempts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resourceId: resource.id, score: correctN, total: Math.max(answered, 1), details: [] }),
      }).then((r) => (r.ok ? r.json() : null)).then((data) => {
        if (!data) return;
        if (onQuizComplete) onQuizComplete(data);
        if (data.streakIsNewDay && data.streak > 0) {
          streakCelebrateRef.current = Math.max(streakCelebrateRef.current || 0, data.streak);
          setStreakCelebration(streakCelebrateRef.current);
          fire(50); sound.milestone(); haptics.success();
        }
        if (data.streak != null && onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
        if (data.xpAwarded > 0) {
          editSave((s) => { s.xp += data.xpAwarded; }); // keep local mirror = unified total
          if (onXpUpdate) onXpUpdate(data.xpAwarded);
          else window.dispatchEvent(new CustomEvent('sc-xp-gained', { detail: { xp: data.xpAwarded } }));
        }
      }).catch(() => {});
    }
  }

  function rawMcqArr() {
    const arr = typeof resource?.mcqData === 'string' ? JSON.parse(resource.mcqData) : resource?.mcqData;
    return Array.isArray(arr) ? arr : [];
  }

  function requestQuit(target) {
    sound.click();
    const inRun = !runEndedRef.current
      && (screen === 'game' || screen === 'review')
      && (answered > 0 || streak > 0 || reviewMissedRef.current.length > 0);
    if (inRun) { setQuitTarget(target); return; }
    if (target === 'exit' || isDaily) { onBack?.(); return; }
    setScreen('home');
  }

  function confirmQuit() {
    const target = quitTarget;
    setQuitTarget(null);
    if (runEndedRef.current) { target === 'exit' ? onBack?.() : setScreen('home'); return; }
    // Record the partial run so progress isn't silently discarded.
    runEndedRef.current = true;
    editSave((s) => { s.stats.runs += 1; });
    setGameOver(false);
    if (target === 'exit') {
      if (runBest > best) editSave((s) => { s.bestByScope = { ...(s.bestByScope || {}), [scope]: runBest }; });
      checkAchievementsNow({ bestStreak: Math.max(runBest, best), combo: bestCombo });
      fireServerCompletion();
      onBack?.();
      return;
    }
    finishToEnd();
  }

  // ── Modals ──
  function openLeague() {
    setModal('league');
    if (!isAuthed()) return;
    setLeagueBusy(true);
    try {
      const token = JSON.parse(localStorage.getItem('scholars-circle-auth') || '{}').authToken;
      getMyLeague(token)
        .then((mine) => getLeagueStandings(token, mine?.tier).then((rows) => setLeague({ mine, rows: Array.isArray(rows) ? rows : [] })))
        .catch(() => setLeague({ mine: null, rows: [] }))
        .finally(() => setLeagueBusy(false));
    } catch { setLeagueBusy(false); }
  }

  function openChest(kind) {
    setPendingChest(kind);
    setChestState({ opened: false, reward: '' });
    setModal('chest');
  }

  function popChest() {
    if (chestState.opened) return;
    sound.chest();
    fire(60);
    const reward = pendingChest === 'quest' ? 20 : 5;
    editSave((s) => { s.gems += reward; s.lifetimeGems += reward; });
    setChestState({ opened: true, reward: `+${reward} 💎` });
    setPendingChest(null);
  }

  function toggleSound() {
    const next = !save.soundOn;
    editSave((s) => { s.soundOn = next; });
    setSoundEnabled(next);
    if (next) sound.click();
  }

  function buyFreeze() {
    if (save.gems < 15) { toast('Not enough gems (15 💎)', '#FF5E7E'); return; }
    editSave((s) => { s.gems -= 15; s.freezes += 1; });
    // Sync freeze inventory to the server (fire-and-forget; stats resync reconciles)
    try {
      fetch(`${API_BASE}/api/resources/fsrs/freeze`, { method: 'POST', headers: getAuthHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && typeof d.freezes === 'number') editSave((s) => { s.freezes = d.freezes; }); })
        .catch(() => {});
    } catch {}
    toast('🧊 Streak freeze purchased', '#00E5FF');
  }

  function resetSave() {
    if (!window.confirm('Reset all Streak Survival progress? (gems, XP, achievements)')) return;
    editSave((s) => Object.assign(s, {
      bestByScope: {}, xp: 0, gems: 20, lifetimeGems: 20, freezes: 0,
      warmupDate: '', streakRewardDate: '', questDate: '', questProgress: {},
      questClaimed: [], questBonus: false,
      stats: { answered: 0, correct: 0, reviewCleared: 0, perfectRuns: 0, runs: 0 },
      achievements: [], soundOn: true,
    }));
    toast('Progress reset', '#8b93a7');
  }

  // Keep the follow-up thread pinned to the latest message.
  useEffect(() => {
    const el = explainThreadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [explain.thread, explain.loading]);

  // ── Keyboard ──
  useEffect(() => {
    const h = (e) => {
      // Don't hijack shortcuts while the user is typing a follow-up question.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (modal) { if (e.key === 'Escape') setModal(null); return; }
      if (quitTarget) {
        if (e.key === 'Escape') setQuitTarget(null);
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmQuit(); }
        return;
      }
      if (gameOver) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (save.gems >= REVIVE_COST) reviveWithGems(); else dismissGameOver(); } return; }
      if (e.key === 'Escape') { requestQuit('home'); return; }
      if (screen !== 'game' && screen !== 'review') return;
      if (!current) return;
      if (locked) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); screen === 'review' ? handleReviewNext() : handleContinue(); }
        return;
      }
      const k = e.key.toLowerCase();
      const num = ['1', '2', '3', '4'].indexOf(k);
      const letIdx = ['a', 'b', 'c', 'd'].indexOf(k);
      const idx = num >= 0 ? num : letIdx;
      if (idx >= 0 && idx < (current.q.opts?.length || 0)) {
        screen === 'review' ? handleReviewPick(idx) : handlePick(idx);
      } else if (k === 'h') handleHint();
      else if (k === 'r' && screen === 'game') handleReveal();
      else if (k === 'e' && locked) handleExplain();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ── Derived ──
  const forecast = buildForecast(cardStates);
  const dueHere = Object.values(cardStates).filter((c) => c.isDue).length;
  const ring = current ? masteryDots(cardStates[current.q._key]) : { dots: 0, mastered: false, due: false };
  const quests = activeQuests();
  const goalPct = stats?.dailyGoal ? Math.min(100, ((stats.reviewedToday || 0) / stats.dailyGoal) * 100) : 0;
  const R = 26; const CIRC = 2 * Math.PI * R;

  // ═══════════ RENDER ═══════════
  return (
    <div className="ss-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)' }}>
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div ref={appRef} className={`ss-app${shake ? ' shake' : ''}`}>

        {/* HUD */}
        <div className="hud-card">
          <div className="hud-top">
            <div className="hud-stats" onClick={() => setModal('profile')} title="Profile">
              <span className="hud-stat"><span className="hud-ico">🔥</span>{stats?.streak ?? 0}<span className="hud-dim">day</span></span>
              <span className="hud-stat"><span className="hud-ico">💎</span>{save.gems}</span>
              {save.freezes > 0 && <span className="hud-stat"><span className="hud-ico">🧊</span>{save.freezes}</span>}
            </div>
            <div className="hud-actions">
              <button className="hud-btn" onClick={openLeague} title="League">🏆</button>
              <button className="hud-btn" onClick={toggleSound} title="Sound">{save.soundOn ? '🔊' : '🔇'}</button>
              <button className="hud-btn" onClick={() => requestQuit('exit')} title="Exit">✕</button>
            </div>
          </div>
          <div className="xpbar-row">
            <span className="xp-level">Lv {lvl} · {titleForLevel(lvl)}</span>
            <div className="xpbar"><div className="xpbar-fill" style={{ width: `${lvlProg.pct}%` }} /></div>
            <span className="xpbar-label">{lvlProg.into}/{lvlProg.needed}</span>
            <svg className="goal-ring" viewBox="0 0 64 64" onClick={() => setModal('profile')} title="Daily goal">
              <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
              <circle className="goal-ring-fill" cx="32" cy="32" r={R} fill="none" stroke="#4ADE80" strokeWidth="7"
                strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - goalPct / 100)}
                transform="rotate(-90 32 32)" />
              <text x="32" y="37" textAnchor="middle" fontSize="16" fill="#EAEEF7" fontFamily="JetBrains Mono, monospace">
                {stats?.reviewedToday ?? 0}
              </text>
            </svg>
          </div>
        </div>

        {/* ═══ HOME ═══ */}
        {screen === 'home' && (
          <div className="home-screen">
            <div className="home-hero">
              <div className="home-greet">{greeting()}</div>
              <div className="home-title">{resource?.title || 'Streak Survival'}</div>
              <div className="home-sub">
                {bank.length} QUESTIONS · {dueHere} DUE · BEST {best}
              </div>
              <div className="home-status">
                {stats?.dailyGoal != null && (
                  <span className={`status-chip ${(stats.reviewedToday || 0) >= stats.dailyGoal ? 'green' : 'blue'}`}>
                    🎯 {stats.reviewedToday || 0}/{stats.dailyGoal} today
                  </span>
                )}
                {save.freezes > 0 && <span className="status-chip blue">🧊 {save.freezes} freeze{save.freezes > 1 ? 's' : ''}</span>}
                {pendingChest && (
                  <button className="status-chip gold" style={{ cursor: 'pointer' }} onClick={() => openChest(pendingChest)}>
                    🎁 chest ready — tap
                  </button>
                )}
              </div>
            </div>

            <button className="mode-card survival" onClick={() => startRun('survival')}>
              <span className="mc-ico">🔥</span>
              <span className="mc-mid">
                <span className="mc-title">Survival Run</span>
                <span className="mc-desc">3 lives · {Math.min(SECTION_SIZE, bank.length)} questions · clear the section</span>
              </span>
              <span className="mc-arrow">›</span>
            </button>
            <button className="mode-card practice" onClick={() => startRun('practice')}>
              <span className="mc-ico">📚</span>
              <span className="mc-mid">
                <span className="mc-title">Practice</span>
                <span className="mc-desc">No lives · FSRS picks your weakest questions first</span>
              </span>
              <span className="mc-arrow">›</span>
            </button>

            {forecast.some((n) => n > 0) && (
              <button className="forecast-card" onClick={() => startRun('practice')}>
                <div className="forecast-sum">
                  Memory forecast — <span className="hot">{forecast[0]} due today</span>
                  {forecast.slice(1).reduce((a, b) => a + b, 0) > 0 && ` · ${forecast.slice(1).reduce((a, b) => a + b, 0)} this week`}
                </div>
                <div className="forecast-bars">
                  {forecast.map((n, i) => {
                    const max = Math.max(...forecast, 1);
                    const dow = (new Date().getDay() + i) % 7; // 0=Sun..6=Sat
                    const lbl = i === 0 ? 'now' : ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'][dow];
                    return (
                      <div key={i} className={`fbar${i === 0 ? ' today' : ''}${n > 0 ? ' has' : ''}`}>
                        <span className={`fbar-num${n > 0 ? ' has' : ''}`}>{n || ''}</span>
                        <div className="fbar-fill" style={{ height: `${Math.max(3, (n / max) * 100)}%` }} />
                        <span className="fbar-lbl">{lbl}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="forecast-cta">tap to start practice →</div>
              </button>
            )}

            <div className="quests-card" style={{ marginTop: 10 }}>
              {quests.map((q) => {
                const prog = Math.min(save.questProgress?.[q.id] || 0, q.target);
                const done = prog >= q.target;
                const claimed = save.questClaimed?.includes(q.id);
                return (
                  <div key={q.id} className={`quest-row${claimed ? ' done' : ''}`}>
                    <span className="quest-ico">{q.ico}</span>
                    <div className="quest-mid">
                      <div className="quest-name">{q.name}</div>
                      <div className="quest-bar"><div className="quest-fill" style={{ width: `${(prog / q.target) * 100}%` }} /></div>
                    </div>
                    <div className="quest-right">
                      {claimed ? <span className="quest-check">✓</span> : done ? (
                        <button className="setting-btn on" onClick={() => { const r = claimQuest(q.id); if (r) { toast(`+${r} 💎`, '#FFB627'); bump(); if (loadSave().questBonus) openChest('quest'); } }}>Claim</button>
                      ) : (
                        <>
                          <span className="quest-count">{prog}/{q.target}</span>
                          <span className="quest-rwd">+{q.reward}💎</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ GAME / REVIEW ═══ */}
        {(screen === 'game' || screen === 'review') && current && (
          <div className={screen === 'review' ? 'review-screen' : 'game-screen'}>
            <div className="run-stats">
              {runMode === 'survival' && screen === 'game' ? (
                <div className="lives">
                  {[0, 1, 2].map((i) => <span key={i} className={`heart${i >= lives ? ' lost' : ''}`} />)}
                </div>
              ) : (
                <span className="practice-lbl show">{screen === 'review' ? '🔁 REVIEW' : '📚 PRACTICE'}</span>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {combo >= 2 && (
                  <span className={`combo-pill show${combo >= 10 ? ' hot' : ''}${comboPulse ? ' pulse' : ''}`}>
                    <span className="fire-emoji">🔥</span>{combo}
                  </span>
                )}
                {runMode === 'survival' && screen === 'game' && sectionTarget > 0 && (
                  <span className="deck-progress">{Math.min(qNum, sectionTarget)}/{sectionTarget}</span>
                )}
                <button className="quit-btn" onClick={() => requestQuit('home')}>quit</button>
              </div>
            </div>

            {/* Tier progress (survival) */}
            {runMode === 'survival' && screen === 'game' && (
              <div className="tier-bar">
                {[3, 6, 9, 12].map((mark, i) => {
                  const prev = i === 0 ? 0 : [3, 6, 9][i - 1];
                  const p = Math.max(0, Math.min(1, (streak - prev) / (mark - prev)));
                  return (
                    <div key={mark} className={`tier-seg${streak >= mark ? ' full' : ''}`} style={{ '--p': `${p * 100}%` }}>
                      <span className="seg-dot">{mark}</span>
                    </div>
                  );
                })}
                {best > 0 && (
                  <div className="tier-best" style={{ left: `${(Math.min(best, 12) / 12) * 100}%` }}>
                    <span className="tier-best-lbl">PB {best}</span>
                  </div>
                )}
              </div>
            )}

            {screen === 'review' && (
              <div className="review-head">
                <span className="review-title">Clear your misses</span>
                <span className="review-count">{reviewQueue.length} left · {clearedN} cleared</span>
              </div>
            )}

            <div className={`qcard ${flash}`}>
              {screen === 'review' && <span className="review-tag">missed — try again</span>}
              {reviewBadge && (
                <span className={`retry-badge show ${reviewBadge}`}>
                  {reviewBadge === 'correct' ? '✓ cleared' : reviewBadge === 'wrong' ? '✗ back of queue' : 'revealed'}
                </span>
              )}
              <div className="qcard-head">
                <span className="difficulty-tag" style={{ color: tierColor }}>{runMode === 'survival' ? tier : 'practice'}</span>
                <span className="mastery-ring">
                  {ring.due && <span className="due-flag">⏰</span>}
                  {ring.mastered ? '🌟' : [0, 1, 2].map((d) => <span key={d} className={`mrdot${ring.dots > d ? ' on' : ''}`} />)}
                </span>
              </div>

              <div className="qtext">{current.q.q}</div>

              {/* Speed timer — only on cards the user has answered correctly
                  before (FSRS learning=1 / review=2). New (0) and relearning
                  (3, forgotten) cards get no clock pressure; the bar appearing
                  is also a subtle "you know this one" cue. */}
              {runMode === 'survival' && screen === 'game' && !locked && current
                && [1, 2].includes(cardStates[bank[current.idx]?._key]?.state) && (
                <div className="timer-bar">
                  <div className={`timer-fill${timerPct < 35 ? ' low' : timerPct < 70 ? ' mid' : ''}`} style={{ width: `${timerPct}%` }} />
                </div>
              )}

              {hintUsed && <div className="hint-box show">💡 {current.q.hint || 'One wrong option eliminated.'}</div>}

              <div className="options">
                {current.q.opts.map((opt, i) => {
                  let cls = 'opt';
                  if (eliminated.has(i)) cls += ' eliminated';
                  if (locked) {
                    if (i === current.q.a) cls += ' correct';
                    else if (i === picked) cls += ' wrong picked-wrong';
                  }
                  return (
                    <button key={i} className={cls} disabled={locked || eliminated.has(i)}
                      onClick={() => (screen === 'review' ? handleReviewPick(i) : handlePick(i))}>
                      <span className="ltr">{String.fromCharCode(65 + i)}</span>{opt}
                    </button>
                  );
                })}
              </div>

              {fsrsNote && (
                <div className="fsrs-note show" style={{ color: { 1: '#FF5E7E', 2: '#FFB627', 3: '#4ADE80', 4: '#00E5FF' }[fsrsNote.grade] }}>
                  🧠 {{ 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }[fsrsNote.grade]}
                  {fsrsNote.intervalLabel ? ` · next review in ${fsrsNote.intervalLabel}` : ''}
                </div>
              )}

              {!locked && (
                <div className="card-actions">
                  <button type="button" onClick={handleHint}>💡 Hint</button>
                  {screen === 'game' && <button type="button" onClick={handleReveal}>👁 Reveal</button>}
                </div>
              )}

              {explain.show && (
                <div className="explain-box show">
                  <span className="explain-label">✨ AI Tutor</span>
                  <div className="explain-thread" ref={explainThreadRef}>
                    {explain.thread.map((m, i) => (
                      <div key={i} className={`explain-msg ${m.role}`}>{m.text}</div>
                    ))}
                    {explain.loading && <span className="dot-loading explain-typing">Thinking</span>}
                  </div>
                  <form className="explain-ask" onSubmit={handleFollowUp}>
                    <input
                      type="text"
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
                      placeholder="Ask a follow-up…"
                      maxLength={300}
                      aria-label="Ask a follow-up question"
                    />
                    <button type="submit" disabled={explain.loading || !followUp.trim()}>→</button>
                  </form>
                </div>
              )}

              {locked && (
                <div className="post-actions show">
                  <button type="button" className="btn-explain" onClick={handleExplain} disabled={explain.loading}>✨ Ask AI</button>
                  <button type="button" className="btn-continue" onClick={screen === 'review' ? handleReviewNext : handleContinue}>
                    {screen === 'review' ? 'Next →' : 'Continue →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ END ═══ */}
        {screen === 'end' && endInfo && (
          <div className="end-screen show">
            <div className="trophy rise">{endInfo.deckCleared ? '🏆' : endInfo.perfect ? '🏆' : endInfo.best >= 12 ? '🌟' : '💪'}</div>
            <div className="end-verdict">{endInfo.deckCleared ? 'Section complete!' : verdictFor(endInfo.best, runMode)}</div>
            <div className="end-score">{runMode === 'survival' ? endInfo.best : endInfo.answered}</div>
            <div className="end-label">{runMode === 'survival' ? 'best streak this run' : 'questions this session'}</div>
            {endInfo.deckCleared && (
              <div className="end-cleared-note">All {sectionTarget} questions survived · +{endInfo.clearBonus} XP bonus — come back when cards are due, spacing makes it stick.</div>
            )}
            <div className="run-chips">
              <span className="run-chip blue">+{endInfo.xp} XP</span>
              <span className="run-chip gold">+{endInfo.gems} 💎</span>
              <span className="run-chip">{endInfo.acc}% acc</span>
              {endInfo.avgSec > 0 && <span className="run-chip">⏱ {endInfo.avgSec}s avg</span>}
              {endInfo.cleared > 0 && <span className="run-chip green">🔁 {endInfo.cleared} cleared</span>}
              {endInfo.revives > 0 && <span className="run-chip revive-chip">❤️‍🩹 {endInfo.revives} revive{endInfo.revives > 1 ? 's' : ''}</span>}
            </div>
            {stats?.dailyGoal != null && (
              <div className={`goal-nudge show ${(stats.reviewedToday || 0) >= stats.dailyGoal ? 'done' : (stats.dailyGoal - (stats.reviewedToday || 0)) <= 3 ? 'close' : 'far'}`}>
                {(stats.reviewedToday || 0) >= stats.dailyGoal
                  ? '🎯 Daily goal complete!'
                  : `🎯 ${stats.dailyGoal - (stats.reviewedToday || 0)} more to hit your daily goal`}
              </div>
            )}
            <div className="end-quote show">“{endInfo.quote.t}”<span className="q-author">— {endInfo.quote.a}</span></div>
            <div className="best-row">
              <span className="best-pill">best: {Math.max(best, endInfo.best)}</span>
              {endInfo.newBest && <span className="new-best-pill show">NEW BEST!</span>}
            </div>
            <button className="primary" onClick={() => startRun(runMode)}>{runMode === 'survival' ? 'Run it back' : 'Practice again'}</button>
            <div className="secondary-row">
              {!isDaily && <button onClick={() => setScreen('home')}>Home</button>}
              <button onClick={onBack}>{isDaily ? 'Done' : 'Exit'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Toasts */}
      {toasts.map((t) => (
        <div key={t.id} className="tier-toast show" style={{ color: t.color, border: `1px solid ${t.color}55`, background: '#111826f0' }}>{t.msg}</div>
      ))}
      {floats.map((f) => (
        <div key={f.id} className="xp-float" style={{ left: `${f.x}vw`, top: `${f.y}vh`, color: f.color }}>{f.text}</div>
      ))}

      {/* Level-up overlay */}
      {levelUp && (
        <div className="level-overlay show">
          <div className="level-box">
            <div className="level-lbl">Level up</div>
            <div className="level-big">{levelUp}</div>
            <div className="level-lbl">{titleForLevel(levelUp)}</div>
          </div>
        </div>
      )}

      {/* Last-life tension vignette */}
      {runMode === 'survival' && screen === 'game' && lives === 1 && !gameOver && !locked && (
        <div className="danger-vignette" />
      )}

      {/* ═══ GAME OVER (hearts depleted) ═══ */}
      {gameOver && (
        <div className="gameover-overlay">
          <div className="go-hearts">
            <span className="go-heart" />
            <span className="go-heart" />
            <span className="go-heart" />
          </div>
          <div className="go-title">OUT OF HEARTS</div>
          <div className="go-sub">
            streak <span className="go-streak">{runBest}</span> · {answered} answered · {reviewMissedRef.current.length} to review
          </div>
          <div className="go-actions">
            <button
              className="go-revive"
              disabled={save.gems < REVIVE_COST}
              onClick={reviveWithGems}
            >
              {save.gems >= REVIVE_COST ? `💎 ${REVIVE_COST} — Revive & keep going` : `💎 Revive — need ${REVIVE_COST} gems`}
            </button>
            <button className="go-continue" onClick={dismissGameOver}>
              {reviewMissedRef.current.length > 0 ? 'Review your misses →' : 'See results →'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STREAK-EXTENDED CELEBRATION ═══ */}
      {streakCelebration != null && (
        <div className="streak-celebrate" onClick={() => setStreakCelebration(null)}>
          <div className="streak-flame">🔥</div>
          <div className="streak-num">{streakCelebration}</div>
          <div className="streak-lbl">day streak — extended!</div>
          <div className="streak-tap">tap to continue</div>
        </div>
      )}

      {/* ═══ QUIT CONFIRM ═══ */}
      {quitTarget && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setQuitTarget(null)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">{quitTarget === 'exit' ? 'Exit run?' : 'End run?'}</span>
              <button className="modal-close" onClick={() => setQuitTarget(null)}>✕</button>
            </div>
            <div className="modal-sub">
              Your {runBest}-streak and {answered} answer{answered === 1 ? '' : 's'} will be recorded.
            </div>
            <div className="quit-actions">
              <button className="setting-btn on" onClick={() => setQuitTarget(null)}>Keep going</button>
              <button className="setting-btn danger" onClick={confirmQuit}>
                {quitTarget === 'exit' ? 'Exit' : 'End run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROFILE MODAL ═══ */}
      {modal === 'profile' && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Profile</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-sub">Lv {lvl} {titleForLevel(lvl)} · {save.xp} lifetime XP</div>
            <div className="stat-grid">
              <div className="stat-box"><div className="num">{save.stats.answered}</div><div className="lbl">answered</div></div>
              <div className="stat-box"><div className="num">{save.stats.answered ? Math.round((save.stats.correct / save.stats.answered) * 100) : 0}%</div><div className="lbl">accuracy</div></div>
              <div className="stat-box"><div className="num">{Math.max(...Object.values(save.bestByScope || { x: 0 }), 0)}</div><div className="lbl">best streak</div></div>
              <div className="stat-box"><div className="num">{save.stats.reviewCleared}</div><div className="lbl">reviews cleared</div></div>
            </div>
            {stats?.dailyGoal != null && (
              <div className="goal-box">
                <div className="goal-head"><span>daily goal</span><span>{stats.reviewedToday || 0}/{stats.dailyGoal}</span></div>
                <div className="goal-bar"><div className="goal-fill" style={{ width: `${goalPct}%` }} /></div>
              </div>
            )}
            <div className="mastery-line">
              🌟 {Object.values(cardStates).filter((c) => c.isMastered).length} mastered
              <span className="mastery-dot" style={{ background: '#4ADE80' }} />{Object.values(cardStates).filter((c) => !c.isMastered && !c.isDue && c.state > 0).length} strong
              <span className="mastery-dot" style={{ background: '#FFB627' }} />{dueHere} due
            </div>

            <div className="section-lbl">Settings</div>
            <div className="setting-row">
              <span>Sound</span>
              <button className={`setting-btn${save.soundOn ? ' on' : ''}`} onClick={toggleSound}>{save.soundOn ? 'ON' : 'OFF'}</button>
            </div>
            <div className="setting-row">
              <span>Streak freeze<span className="freeze-count">×{save.freezes}</span></span>
              <button className="setting-btn" onClick={buyFreeze} disabled={save.gems < 15}>Buy · 15💎</button>
            </div>

            <div className="section-lbl">Achievements · {save.achievements.length}/{ACHIEVEMENTS.length}</div>
            <div className="ach-grid">
              {ACHIEVEMENTS.map((a) => {
                const un = save.achievements.includes(a.id);
                return (
                  <div key={a.id} className={`ach${un ? ' unlocked' : ''}`}>
                    <span className="ico">{a.ico}</span>
                    <div><div className="nm">{a.nm}</div><div className="ds">{a.ds}</div><div className="gm">+{a.gm}💎</div></div>
                  </div>
                );
              })}
            </div>
            <button className="danger-btn" onClick={resetSave}>reset survival progress</button>
          </div>
        </div>
      )}

      {/* ═══ LEAGUE MODAL ═══ */}
      {modal === 'league' && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Weekly League</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-sub">
              {league?.mine ? `${league.mine.tier} tier · ${league.mine.weeklyXP} XP this week` : 'real players, weekly XP'}
            </div>
            {leagueBusy && <div className="modal-sub">Loading standings…</div>}
            {!leagueBusy && league?.rows?.map((row, i) => {
              const isYou = league.mine && row.userId === league.mine.userId;
              return (
                <div key={row.id || i} className={`lg-row${i < 3 ? ' top' : ''}${isYou ? ' you' : ''}`}>
                  <span className="lg-rank">{i + 1}</span>
                  <span className="lg-ava">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎓'}</span>
                  <span className="lg-name">{row.user?.username || 'player'}{isYou && <span className="you-tag">you</span>}</span>
                  <span className="lg-xp">{row.weeklyXP} XP</span>
                </div>
              );
            })}
            {!leagueBusy && league && league.rows?.length === 0 && (
              <div className="modal-sub">No standings yet — earn XP to appear here.</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CHEST MODAL ═══ */}
      {modal === 'chest' && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal chest-modal">
            <span className={`chest-emoji${chestState.opened ? ' pop' : ''}`} onClick={popChest} role="button" tabIndex={0}>
              {chestState.opened ? '🎉' : '🎁'}
            </span>
            <div className="chest-title">{pendingChest === 'quest' ? 'Quest bonus chest' : 'Daily warmup'}</div>
            <div className="chest-sub">{chestState.opened ? 'Nice. Come back tomorrow for more.' : 'Tap the chest to open it.'}</div>
            {chestState.opened && <div className="chest-reward show">{chestState.reward}</div>}
            <button className="primary" onClick={() => setModal(null)}>{chestState.opened ? 'Collect' : 'Later'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
