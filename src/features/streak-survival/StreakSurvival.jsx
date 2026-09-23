import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { callAI } from '../../lib/aiClient.js';
import { recordPracticeResult } from '../../lib/studyHistory.js';
import { API_BASE } from '../../lib/constants';
import { getMyLeague, getLeagueStandings, checkBadges } from '../../lib/gamificationApi.js';
import {
  loadSave, mutate, tickDay,
  levelFromXP, titleForLevel,
  TIER_XP, TIER_GEMS,
  activeQuests, questEvent, claimQuest,
  ACHIEVEMENTS, checkAchievements,
  SHOP, THEMES, buyItem, equipTheme,
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
const REVIVE_COSTS = [15, 30]; // escalating gem cost per revive
const MAX_REVIVES = 2;

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

// Count-up stat for the end screen — rAF cubic ease-out, optional delay.
function CountUp({ value, delay = 0, dur = 900, dec = 0, suf = '' }) {
  const [txt, setTxt] = useState((0).toFixed(dec) + suf);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0 - delay) / dur));
      setTxt((value * (1 - Math.pow(1 - p, 3))).toFixed(dec) + suf);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, dur, dec, suf]);
  return txt;
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

// ── Typed-answer matching ──
const normText = (s) => String(s || '')
  .toLowerCase()
  .replace(/^(the|a|an)\s+/, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Small Levenshtein — answer strings are short, so O(m·n) is fine.
function levDist(a, b) {
  if (Math.abs(a.length - b.length) > 5) return 6;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Lenient-but-fair compare: exact after normalizing, containment of a
// meaningful term, or ~1 typo per 8 characters.
function typedMatch(input, answer) {
  const ni = normText(input);
  const ta = normText(answer);
  if (!ni || !ta) return false;
  if (ni === ta) return true;
  if (ni.length >= 4 && ta.includes(ni)) return true;
  return levDist(ni, ta) <= Math.max(1, Math.floor(ta.length / 8));
}

// Only short, single-term answers make good typing questions — long sentences
// and compound options ("All of the above", "Both A and B") fall back to choices.
function isTypeable(text) {
  const t = (text || '').trim();
  if (!t || t.length > 30 || t.split(/\s+/).length > 5) return false;
  return !/\bof the above\b|^(both|neither|all|none)\b|^[a-d]\s*(and|or)\s*[a-d]\b/i.test(t);
}

export default function StreakSurvival({ resource, items, mode: forcedMode, onBack, onQuizComplete, onStreakUpdate, onXpUpdate }) {
  // ── Save ──
  const [save, setSave] = useState(() => { tickDay(); return { ...loadSave() }; });
  const bump = useCallback(() => setSave({ ...loadSave() }), []);
  const editSave = useCallback((fn) => { mutate(fn); bump(); }, [bump]);

  // Session-setup preferences (persisted in the save blob)
  const prefs = save.quizPrefs || { style: 'smart', recallFirst: true, speedRound: false };
  const setPref = (k, v) => editSave((s) => { s.quizPrefs = { ...(s.quizPrefs || {}), [k]: v }; });

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
  const [qNum, setQNum] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correctN, setCorrectN] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionGems, setSessionGems] = useState(0);
  const [current, setCurrent] = useState(null); // {q, idx}
  const [history, setHistory] = useState([]); // answered cards this run — powers "view previous"
  const [pastIdx, setPastIdx] = useState(null); // null = live question; n = viewing history[n]
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
  // Answer style for the live card — rolled from quizPrefs at serve time:
  // 'mcq' (choices), 'type' (free recall), 'card' (flip + self-grade)
  const [qMode, setQMode] = useState('mcq');
  const [typed, setTyped] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [optsShown, setOptsShown] = useState(true); // recall-first veil
  const typeInputRef = useRef(null);
  const boltOutRef = useRef(null); // speed-round timeout → freshest closure
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
  const sinceMissRef = useRef(0); // correct answers since last miss (earn-back heart)
  const heartEarnedRef = useRef(false); // earn-back heart already granted this run
  const [quitTarget, setQuitTarget] = useState(null); // 'home'|'exit' — confirm-quit modal

  // ── Chrome ──
  const [cardAnim, setCardAnim] = useState(''); // 'q-enter' | 'q-exit' — prototype slide transitions
  const [vig, setVig] = useState(null); // {k:'good'|'bad', n} — edge vignette flash
  const [flies, setFlies] = useState([]); // fly-to-HUD particles
  const vigNRef = useRef(0);
  const exitingRef = useRef(false); // card exit animation in flight (blocks double-advance)
  const gemStatRef = useRef(null);
  const xpStatRef = useRef(null);
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
  const lvl = levelFromXP(save.xp);

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
  // Toasts are capped at 2 visible — extras queue and pump in as slots free up.
  const toastQueueRef = useRef([]);
  const visibleToastsRef = useRef(0);
  const toast = useCallback((msg, color = '#FFB627', ms = 1600) => {
    const item = { id: ++toastId, msg, color };
    const show = (it) => {
      visibleToastsRef.current += 1;
      setToasts((t) => [...t, it]);
      setTimeout(() => {
        visibleToastsRef.current -= 1;
        setToasts((t) => t.filter((x) => x.id !== it.id));
        const nxt = toastQueueRef.current.shift();
        if (nxt) show(nxt);
      }, ms);
    };
    if (visibleToastsRef.current >= 2) toastQueueRef.current.push(item);
    else show(item);
  }, []);

  const xpFloat = useCallback((text, color = '#00E5FF') => {
    const id = ++floatId;
    const x = 40 + Math.random() * 20; // vw center-ish
    const y = 22 + Math.random() * 6;
    setFloats((f) => [...f, { id, text, color, x, y }]);
    setTimeout(() => setFloats((f) => f.filter((x2) => x2.id !== id)), 1000);
  }, []);

  // Fly-to-HUD particle: a "+N XP"/"+N 💎" chip that arcs from the tapped
  // option to the HUD stat counter, which then pops. Layout-agnostic — reads
  // live bounding rects like the prototype.
  const flyToHud = useCallback((fromEl, text, color, targetEl) => {
    if (!fromEl || !targetEl) return;
    const r = fromEl.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    const id = ++floatId;
    setFlies((f) => [...f, {
      id, text, color,
      x: r.left + r.width / 2, y: r.top,
      tx: t.left + t.width / 2 - (r.left + r.width / 2),
      ty: t.top + t.height / 2 - r.top,
      go: false,
    }]);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setFlies((f) => f.map((x) => (x.id === id ? { ...x, go: true } : x)));
    }));
    setTimeout(() => {
      setFlies((f) => f.filter((x) => x.id !== id));
      targetEl.classList.remove('pop');
      void targetEl.offsetWidth;
      targetEl.classList.add('pop');
      setTimeout(() => targetEl.classList.remove('pop'), 340);
    }, 560);
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
  const grantXp = useCallback((n, label, srcEl) => {
    const before = lvl;
    editSave((s) => { s.xp += n; });
    // Feed the unified XP pool (stats.xp -> server via /user-data/sync)
    if (onXpUpdate) onXpUpdate(n);
    else window.dispatchEvent(new CustomEvent('sc-xp-gained', { detail: { xp: n } }));
    const after = levelFromXP(loadSave().xp);
    setSessionXp((v) => v + n);
    if (srcEl && xpStatRef.current) flyToHud(srcEl, `+${n} XP`, '#00E5FF', xpStatRef.current);
    else xpFloat(`+${n} XP${label ? ` ${label}` : ''}`, '#00E5FF');
    qe('xpToday', n);
    if (after > before) {
      setLevelUp(after);
      sound.levelup();
      haptics.success();
      setTimeout(() => setLevelUp(null), 1600);
    }
  }, [editSave, lvl, xpFloat, flyToHud, qe, onXpUpdate]);

  const grantGems = useCallback((n, why, srcEl) => {
    editSave((s) => { s.gems += n; s.lifetimeGems += n; });
    setSessionGems((v) => v + n);
    if (srcEl && gemStatRef.current) flyToHud(srcEl, `+${n} 💎`, '#FFB627', gemStatRef.current);
    else xpFloat(`+${n} 💎${why ? ` ${why}` : ''}`, '#FFB627');
  }, [editSave, xpFloat, flyToHud]);

  // ── Question serving ──
  // Roll the answer style for a just-served card. Long/compound answers fall
  // back to choices — typing a paragraph feels bad and grades unfairly.
  function rollQMode(q) {
    const style = prefs.style || 'smart';
    if (style === 'mcq') return 'mcq';
    const typeable = isTypeable(q.opts[q.a]);
    if (style === 'typing') return typeable ? 'type' : 'mcq';
    if (style === 'flashcard') return 'card';
    if (style === 'mixed') {
      // Variety mix — choices weighted heaviest since they're the fastest.
      const pool = typeable ? ['mcq', 'mcq', 'type', 'card'] : ['mcq', 'mcq', 'card'];
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // Smart mix (default) — unseen cards stay recognition-based; once a card
    // is inside the FSRS pipeline (learning/review/relearning), short answers
    // switch to free recall. Recognition first, recall once you know it.
    const seen = (cardStates[q._key]?.state ?? 0) > 0;
    return seen && typeable ? 'type' : 'mcq';
  }

  // Per-card style state reset — called by every serve site (game + review).
  function prepForMode(q) {
    const m = rollQMode(q);
    setQMode(m);
    setTyped('');
    setFlipped(false);
    setOptsShown(!(prefs.recallFirst && m === 'mcq'));
  }

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
    prepForMode(q);
    qStartRef.current = Date.now();
    exitingRef.current = false;
    setPastIdx(null);
    setCardAnim('q-enter');
    setVig(null);
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
        setSessionXp((v) => v + data.xpAwarded);
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
    // A held shield absorbs the heart loss (streak still resets).
    if (save.shields > 0) {
      editSave((s) => { s.shields -= 1; });
      toast('🛡 Shield absorbed the hit', '#00E5FF');
      sound.milestone();
      haptics.medium();
      return;
    }
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

  const reviveCostNow = () => REVIVE_COSTS[Math.min(revivesUsed, REVIVE_COSTS.length - 1)];

  function reviveWithGems() {
    const cost = reviveCostNow();
    if (revivesUsed >= MAX_REVIVES || save.gems < cost) return;
    editSave((s) => { s.gems -= cost; });
    setRevivesUsed((n) => n + 1);
    setLives(1);
    setGameOver(false);
    sound.levelup();
    haptics.success();
    toast('❤️ Revived — keep going!', '#FF7A9E');
    setTimeout(() => serveNext(runMode), 250);
  }

  function redeemHeartRefill() {
    if (revivesUsed >= MAX_REVIVES || save.heartRefills <= 0) return;
    editSave((s) => { s.heartRefills -= 1; });
    setRevivesUsed((n) => n + 1);
    setLives(1);
    setGameOver(false);
    sound.levelup();
    haptics.success();
    toast('❤️ Heart refill used — keep going!', '#FF7A9E');
    setTimeout(() => serveNext(runMode), 250);
  }

  // ── Shared answer resolution (game mode) ──
  // Every answer style funnels here — MCQ pick, typed check, flip-card
  // self-grade, speed-round timeout. pickedIdx/optEl are cosmetic (missed-queue
  // detail + fly-to-HUD particle origin); via carries the style for XP weighting.
  function resolveAnswer(q, { isCorrect, pickedIdx = null, optEl = null, via = 'mcq' } = {}) {
    const elapsed = Date.now() - qStartRef.current;
    timesRef.current.push(elapsed);
    setAnswered((n) => n + 1);
    qe('answered', 1);
    editSave((s) => { s.stats.answered += 1; });

    if (isCorrect) {
      setVig({ k: 'good', n: ++vigNRef.current });
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > runBest) setRunBest(newStreak);
      qe('maxCombo', newStreak, { setMax: true });
      setCorrectN((n) => n + 1);
      qe('correct', 1);
      editSave((s) => { s.stats.correct += 1; });
      if (elapsed < 5000) qe('speedy', 1);
      if (elapsed < 3000) checkSpeedy3();

      // PB crossing — celebrate the moment the old record falls
      if (best > 0 && newStreak === best + 1) {
        toast('🏆 New personal best!', '#FFB627', 2200);
        sound.milestone();
      }

      // Earn-back heart: 5 straight after a miss restores one life (once per run)
      sinceMissRef.current += 1;
      if (runMode === 'survival' && !heartEarnedRef.current && sinceMissRef.current >= 5 && lives < MAX_LIVES) {
        heartEarnedRef.current = true;
        setLives((l) => Math.min(MAX_LIVES, l + 1));
        toast('❤️ Heart earned back — 5 straight!', '#FF7A9E');
        sound.milestone();
        haptics.success();
      }

      // Tier XP scaled by combo multiplier, plus a small recall bonus for
      // typed answers (free recall is harder than recognition), plus gem drops every 5
      const mult = newStreak >= 10 ? 2 : newStreak >= 5 ? 1.5 : 1;
      const boost = via === 'type' ? 1.25 : 1;
      const label = [mult > 1 ? `×${mult} combo` : '', boost > 1 ? 'recall' : ''].filter(Boolean).join(' · ') || null;
      grantXp(Math.round(TIER_XP[tier] * mult * boost), label, optEl);
      if (newStreak % 5 === 0) grantGems(TIER_GEMS[tier], 'combo', optEl);
      if (newStreak === 10) grantXp(10, 'combo bonus', optEl);

      // Speed bonus — only on timed cards (learning/review) beaten inside the window
      const wasTimed = runMode === 'survival' && [1, 2].includes(cardStates[q._key]?.state);
      if (wasTimed && elapsed <= SPEED_WINDOW) {
        grantXp(elapsed <= 3000 ? 5 : 2, elapsed <= 3000 ? '⚡⚡ lightning' : '⚡ fast', optEl);
      }

      sound.correct();
      haptics.success();
      setFlash('correct-flash');
      setTimeout(() => setFlash(''), 500);
      setComboPulse(true);
      setTimeout(() => setComboPulse(false), 400);

      // Milestones
      if (newStreak === 3) { toast('⚡ Warming up — medium XP', '#FFB627'); sound.milestone(); haptics.medium(); setFlash('milestone-flash'); setTimeout(() => setFlash(''), 900); }
      else if (newStreak === 5) { toast('⚡ Combo boost — ×1.5 XP', '#FFB627'); sound.milestone(); haptics.medium(); fire(24); }
      else if (newStreak === 6) { toast('🔥 On fire — hard XP', '#FF5E7E'); sound.milestone(); haptics.medium(); setFlash('milestone-flash'); setTimeout(() => setFlash(''), 900); }
      else if (newStreak === 10) { toast('🌪️ Combo ×2 — double XP!', '#FF5E7E'); sound.milestone(); haptics.medium(); fire(40); }
      else if (newStreak > 0 && newStreak % 10 === 0) { toast(`🌟 ${newStreak} streak!`, '#FFB627'); sound.milestone(); haptics.medium(); fire(40); }
      else if (newStreak > 0 && newStreak % 5 === 0) fire(24);
    } else {
      setVig({ k: 'bad', n: ++vigNRef.current });
      reviewMissedRef.current.push({ ...q, pickedIdx });
      setStreak(0);
      sinceMissRef.current = 0;
      sound.wrong();
      haptics.error();
      setFlash('wrong-flash');
      setTimeout(() => setFlash(''), 500);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      if (runMode === 'survival') loseLife();
    }
  }

  function handlePick(i) {
    if (locked || !current || eliminated.has(i)) return;
    const q = current.q;
    const isCorrect = i === q.a;
    setPicked(i);
    setLocked(true);
    setHistory((h) => [...h, { q, picked: i, via: 'mcq', ok: isCorrect }]);
    answersRef.current[q._pageIndex] = String.fromCharCode(65 + (q._order ? q._order[i] : i));
    applyRating(q, isCorrect, false);
    resolveAnswer(q, { isCorrect, pickedIdx: i, optEl: appRef.current?.querySelectorAll('.opt')?.[i] });
  }

  // Typed free-recall answer — fuzzy-matched against the correct option text.
  function submitTyped(e) {
    e?.preventDefault?.();
    if (locked || !current) return;
    const text = typed.trim();
    if (!text) return;
    const q = current.q;
    const isCorrect = typedMatch(text, q.opts[q.a]);
    setLocked(true);
    typeInputRef.current?.blur();
    setHistory((h) => [...h, { q, picked: null, via: 'type', typed: text, ok: isCorrect }]);
    if (screen === 'review') {
      resolveReviewAnswer(q, { isCorrect, optEl: typeInputRef.current });
    } else {
      applyRating(q, isCorrect, false);
      resolveAnswer(q, { isCorrect, optEl: typeInputRef.current, via: 'type' });
    }
  }

  // Flip-card self-grade — "knew it" counts as a correct answer through the
  // same streak/XP/heart pipeline; "missed it" routes to the review queue.
  function flipCard() {
    if (locked || !current || flipped) return;
    setFlipped(true);
    sound.click();
    haptics.light();
  }

  function gradeCard(knewIt) {
    if (locked || !current || !flipped) return;
    const q = current.q;
    setLocked(true);
    setHistory((h) => [...h, { q, picked: null, via: 'card', selfKnew: knewIt, ok: knewIt }]);
    if (screen === 'review') resolveReviewAnswer(q, { isCorrect: knewIt });
    else { applyRating(q, knewIt, false); resolveAnswer(q, { isCorrect: knewIt, via: 'card' }); }
  }

  // Speed round — the drain bar is a real clock: timeout counts as a miss but
  // still reveals the correct answer so it teaches, not just punishes.
  function boltOut() {
    if (locked || !current || modal || quitTarget || gameOver) return;
    const q = current.q;
    setPicked(null);
    setLocked(true);
    setHistory((h) => [...h, { q, picked: null, via: 'timeout', ok: false }]);
    toast('⏱ Out of time!', '#FF5E7E');
    if (screen === 'review') resolveReviewAnswer(q, { isCorrect: false });
    else { applyRating(q, false, false); resolveAnswer(q, { isCorrect: false }); }
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
    const q = current.q;
    setRevealed(true);
    setLocked(true);
    setHistory((h) => [...h, { q, picked: null, via: 'reveal', ok: false }]);
    applyRating(q, false, true);
    resolveAnswer(q, { isCorrect: false });
  }

  function handleHint() {
    if (locked || !current) return;
    setHintUsed(true);
    sound.click();
    if (qMode !== 'mcq') return; // type/card: surface the hint text, nothing to eliminate
    const wrongKeys = current.q.opts.map((_, i) => i).filter((i) => i !== current.q.a && !eliminated.has(i));
    if (wrongKeys.length <= 1) return;
    setEliminated((prev) => new Set(prev).add(wrongKeys[Math.floor(Math.random() * wrongKeys.length)]));
  }

  async function handleExplain() {
    if (!current) return;
    const q = current.q;
    const optionsStr = q.opts.map((v, i) => `${String.fromCharCode(65 + i)}. ${v}`).join('\n');
    const lastEntry = history[history.length - 1];
    const pickedText = picked != null ? q.opts[picked]
      : lastEntry?.via === 'type' ? `"${lastEntry.typed}" (typed)`
      : lastEntry?.via === 'card' ? (lastEntry.selfKnew ? '(self-graded: knew it)' : "(self-graded: didn't know)")
      : '(revealed)';
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
    if (exitingRef.current) return;
    exitingRef.current = true;
    setCardAnim('q-exit');
    setTimeout(() => serveNext(runMode), 200);
  }

  // ── Review loop ──
  // Shared resolution for review answers — re-serves aren't re-rated (the
  // original miss already posted "Again"), they just clear or re-queue.
  function resolveReviewAnswer(q, { isCorrect, optEl = null } = {}) {
    applyRating(q, isCorrect, false, true);
    if (isCorrect) {
      setVig({ k: 'good', n: ++vigNRef.current });
      setReviewBadge('correct');
      sound.correct();
      haptics.light();
      grantXp(5, 'review', optEl);
      setClearedN((n) => n + 1);
      qe('reviewCleared', 1);
      editSave((s) => { s.stats.reviewCleared += 1; });
    } else {
      setVig({ k: 'bad', n: ++vigNRef.current });
      setReviewBadge('wrong');
      sound.wrong();
      haptics.error();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  function handleReviewPick(i) {
    if (locked || !current || eliminated.has(i)) return;
    const q = current.q;
    const isCorrect = i === q.a;
    setPicked(i);
    setLocked(true);
    setHistory((h) => [...h, { q, picked: i, via: 'mcq', ok: isCorrect }]);
    resolveReviewAnswer(q, { isCorrect, optEl: appRef.current?.querySelectorAll('.opt')?.[i] });
  }

  function handleReviewNext() {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setCardAnim('q-exit');
    setTimeout(() => {
      exitingRef.current = false;
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
      prepForMode(next);
      qStartRef.current = Date.now();
      setCardAnim('q-enter');
      setVig(null);
    }, 200);
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
    setStreak(0); setRunBest(0);
    setQNum(0); setAnswered(0); setCorrectN(0);
    setSessionXp(0); setSessionGems(0);
    setGameOver(false); setRevivesUsed(0);
    setStreakCelebration(null); streakCelebrateRef.current = null;
    setHistory([]); setPastIdx(null);
    deckClearedRef.current = false;
    setSectionTarget(Math.min(SECTION_SIZE, bank.length));
    timesRef.current = [];
    setQuitTarget(null);
    usedRef.current = new Set();
    lastIdxRef.current = -1;
    answersRef.current = {};
    reviewMissedRef.current = [];
    speedy3Ref.current = false;
    sinceMissRef.current = 0;
    heartEarnedRef.current = false;
    runEndedRef.current = false;
    exitingRef.current = false;
    setScreen('game');
    setTimeout(() => serveNext(mode), 0);
  }

  const runEndedRef = useRef(false);
  function endRun(mode) {
    if (runEndedRef.current) return;
    runEndedRef.current = true;
    exitingRef.current = false; // the q-exit that triggered endRun never reaches serveIdx
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
      prepForMode(next);
      qStartRef.current = Date.now();
      setPastIdx(null);
      setCardAnim('q-enter');
      setVig(null);
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
    checkAchievementsNow({ bestStreak: Math.max(runBest, best), combo: runBest, perfectRun: perfect });
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
      combo: extra.combo ?? runBest,
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
          setSessionXp((v) => v + data.xpAwarded);
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
      checkAchievementsNow({ bestStreak: Math.max(runBest, best), combo: runBest });
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

  function buyShield() {
    if (save.shields >= SHOP.shield.max) { toast('Shield already held', '#8b93a7'); return; }
    if (buyItem('shield')) { toast('🛡 Shield equipped — blocks one heart loss', '#00E5FF'); bump(); }
    else toast(`Not enough gems (${SHOP.shield.cost} 💎)`, '#FF5E7E');
  }

  function buyRefill() {
    if (save.heartRefills >= SHOP.heartRefill.max) { toast('Refill already held', '#8b93a7'); return; }
    if (buyItem('heartRefill')) { toast('❤️ Heart refill stored — free revive on game over', '#FF7A9E'); bump(); }
    else toast(`Not enough gems (${SHOP.heartRefill.cost} 💎)`, '#FF5E7E');
  }

  function pickTheme(id) {
    if (equipTheme(id)) { bump(); sound.click(); }
    else { const t = THEMES.find((x) => x.id === id); toast(`Not enough gems (${t?.cost} 💎)`, '#FF5E7E'); }
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
    setModal(null);
    editSave((s) => Object.assign(s, {
      bestByScope: {}, xp: 0, gems: 20, lifetimeGems: 20, freezes: 0,
      warmupDate: '', streakRewardDate: '', questDate: '', questProgress: {},
      questClaimed: [], questBonus: false,
      stats: { answered: 0, correct: 0, reviewCleared: 0, perfectRuns: 0, runs: 0 },
      achievements: [], soundOn: true,
      shields: 0, heartRefills: 0, themesOwned: ['cyan'], theme: 'cyan',
      quizPrefs: { style: 'smart', recallFirst: true, speedRound: false },
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
      if (gameOver) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (save.heartRefills > 0 && revivesUsed < MAX_REVIVES) redeemHeartRefill();
          else if (revivesUsed < MAX_REVIVES && save.gems >= reviveCostNow()) reviveWithGems();
          else dismissGameOver();
        }
        return;
      }
      if (e.key === 'Escape') { requestQuit('home'); return; }
      if (screen !== 'game' && screen !== 'review') return;
      if (!current) return;
      if (pastIdx != null) {
        // Browsing earlier questions — ‹ › navigate, Enter/Esc returns to live
        const lastBrowsable = history.length - (locked ? 1 : 0) - 1;
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); setPastIdx(null); setCardAnim('q-enter');
        } else if (e.key === 'ArrowLeft') {
          setPastIdx((p) => Math.max(0, (p ?? 0) - 1));
        } else if (e.key === 'ArrowRight') {
          setPastIdx((p) => Math.min(lastBrowsable, (p ?? 0) + 1));
        }
        return;
      }
      if (locked) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); screen === 'review' ? handleReviewNext() : handleContinue(); }
        return;
      }
      const k = e.key.toLowerCase();
      if (qMode === 'card') {
        if (!flipped && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flipCard(); }
        else if (flipped && k === '1') gradeCard(false);
        else if (flipped && k === '2') gradeCard(true);
        else if (k === 'h') handleHint();
        return;
      }
      const num = ['1', '2', '3', '4'].indexOf(k);
      const letIdx = ['a', 'b', 'c', 'd'].indexOf(k);
      const idx = num >= 0 ? num : letIdx;
      if (idx >= 0 && qMode === 'mcq' && optsShown && idx < (current.q.opts?.length || 0)) {
        screen === 'review' ? handleReviewPick(idx) : handlePick(idx);
      } else if (k === 'h') handleHint();
      else if (k === 'r' && screen === 'game') handleReveal();
      else if (k === 'e' && locked) handleExplain();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ── Speed round clock ──
  // boltOutRef always points at the freshest closure so the timeout reads
  // live state. The effect's cleanup clears the clock the instant the card
  // locks (any answer path) or a new card is served.
  useEffect(() => { boltOutRef.current = boltOut; });
  useEffect(() => {
    if (!prefs.speedRound || !current || locked) return;
    if (screen !== 'game' && screen !== 'review') return;
    const t = setTimeout(() => boltOutRef.current?.(), SPEED_WINDOW);
    return () => clearTimeout(t);
  }, [current, locked, screen, prefs.speedRound]);

  // ── Derived ──
  const forecast = buildForecast(cardStates);
  const dueHere = Object.values(cardStates).filter((c) => c.isDue).length;
  const ring = current ? masteryDots(cardStates[current.q._key]) : { dots: 0, mastered: false, due: false };
  // "View previous" — history holds answered cards; the live (locked) card is
  // the last entry, so browsable history ends one earlier.
  const pastEntry = pastIdx != null ? history[pastIdx] : null;
  const prevCount = history.length - (locked ? 1 : 0);
  const shownQ = pastEntry ? pastEntry.q : current?.q;
  const shownPicked = pastEntry ? pastEntry.picked : picked;
  const shownLocked = Boolean(pastEntry) || locked;
  // Replay the answer style a card was answered in when browsing history.
  const liveEntry = !pastEntry && locked ? history[history.length - 1] : null;
  const modeOf = (e) => (e?.via === 'type' ? 'type' : e?.via === 'card' ? 'card' : 'mcq');
  const shownMode = pastEntry ? modeOf(pastEntry) : qMode;
  const shownEntry = pastEntry || liveEntry;
  const shownTyped = shownEntry?.typed;
  const shownOk = shownEntry?.ok;
  const shownRing = shownQ ? masteryDots(cardStates[shownQ._key]) : ring;
  const quests = activeQuests();
  const goalPct = stats?.dailyGoal ? Math.min(100, ((stats.reviewedToday || 0) / stats.dailyGoal) * 100) : 0;

  // Shared daily-quests card — shown on the home screen and again on the
  // end screen so finishing a run visibly moves quest progress.
  const questsCard = (style) => (
    <div className="quests-card" style={style}>
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
  );

  // ═══════════ RENDER ═══════════
  return (
    <div className="ss-root" data-theme={save.theme || 'cyan'} style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'radial-gradient(ellipse at top, #111826 0%, #0A0D13 55%)' }}>
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div ref={appRef} className={`ss-app${shake ? ' shake' : ''}`}>

        {/* HUD — slim prototype-style bar: hearts+combo while running, streak otherwise */}
        <header className="hud">
          <div className="hud-left">
            {runMode === 'survival' && (screen === 'game' || screen === 'review') ? (
              <>
                <div className="lives">
                  {[0, 1, 2].map((i) => <span key={i} className={`heart${i >= lives ? ' lost' : ''}`} />)}
                </div>
                {(save.shields || 0) > 0 && (
                  <span className="shield-pill" title="Shield — blocks one heart loss">🛡</span>
                )}
              </>
            ) : (
              <span className="hud-stat hud-stat-btn" onClick={() => setModal('profile')} title="Profile">
                <span className="hud-ico">🔥</span>{stats?.streak ?? 0}<span className="hud-dim">day</span>
              </span>
            )}
            {streak >= 2 && (screen === 'game' || screen === 'review') && (
              <span className={`combo-pill show${streak >= 10 ? ' hot' : ''}${comboPulse ? ' pulse' : ''}`}>
                <span className="fire-emoji">🔥</span>{streak}
              </span>
            )}
          </div>
          <div className="hud-right">
            <span className="hud-stat" ref={gemStatRef}><span className="hud-ico">💎</span>{save.gems}</span>
            <span className="hud-stat" ref={xpStatRef}><span className="hud-ico">⚡</span>{save.xp}</span>
            <button className="hud-btn" onClick={() => setModal('setup')} title="Session setup">⚙</button>
            <button className="hud-btn" onClick={openLeague} title="League">🏆</button>
            <button className="hud-btn" onClick={toggleSound} title="Sound">{save.soundOn ? '🔊' : '🔇'}</button>
            {screen === 'home' && (
              <button className="hud-btn" onClick={() => requestQuit('exit')} title="Exit">✕</button>
            )}
          </div>
        </header>

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

            {questsCard({ marginTop: 10 })}
          </div>
        )}

        {/* ═══ GAME / REVIEW ═══ */}
        {(screen === 'game' || screen === 'review') && current && (
          <div className={screen === 'review' ? 'review-screen' : 'game-screen'}>
            <div className="run-stats">
              {runMode === 'survival' && screen === 'game' && sectionTarget > 0 && (
                <span className="deck-progress">{Math.min(qNum, sectionTarget)}/{sectionTarget}</span>
              )}
              <button className="quit-btn" onClick={() => requestQuit('home')}>quit</button>
            </div>

            {/* Per-question segmented progress (survival sections) — the gold
                tick marks the personal best for this scope. */}
            {runMode === 'survival' && screen === 'game' && sectionTarget > 0 && (
              <div className="progress">
                {Array.from({ length: sectionTarget }, (_, i) => (
                  <span
                    key={i}
                    className={`seg${i < answered ? ' done' : ''}${i === answered - 1 ? ' pop' : ''}`}
                  />
                ))}
                {best > 0 && (
                  <span className="pb-tick" style={{ left: `${(Math.min(best, sectionTarget) / sectionTarget) * 100}%` }}>
                    <span className="pb-tick-lbl">PB {best}</span>
                  </span>
                )}
              </div>
            )}

            {screen === 'review' && (
              <div className="review-head">
                <span className="review-title">Clear your misses</span>
                <span className="review-count">{reviewQueue.length} left · {clearedN} cleared</span>
              </div>
            )}

            <div className={`qcard ${flash} ${cardAnim}`}>
              {pastEntry && <span className="review-tag">↩ question {pastIdx + 1} of {history.length}</span>}
              {!pastEntry && screen === 'review' && <span className="review-tag">missed — try again</span>}
              {!pastEntry && reviewBadge && (
                <span className={`retry-badge show ${reviewBadge}`}>
                  {reviewBadge === 'correct' ? '✓ cleared' : reviewBadge === 'wrong' ? '✗ back of queue' : 'revealed'}
                </span>
              )}
              <div className="qcard-head">
                <span className="difficulty-tag" style={{ color: tierColor }}>{pastEntry ? 'earlier' : runMode === 'survival' ? tier : 'practice'}</span>
                <span className="mastery-ring">
                  {shownRing.due && <span className="due-flag">⏰</span>}
                  {shownRing.mastered ? '🌟' : [0, 1, 2].map((d) => <span key={d} className={`mrdot${shownRing.dots > d ? ' on' : ''}`} />)}
                </span>
              </div>

              <div className="qtext">{shownQ.q}</div>

              {/* Speed timer — with Speed round on it's the real clock (timeout
                  counts as a miss) and shows on every card. Otherwise it's the
                  speed-bonus cue on cards answered correctly before (FSRS
                  learning=1 / review=2) — but never while typing, where racing
                  a 3–7s window is unreachable anyway. Pure CSS drain —
                  key remounts per question so the animation restarts. */}
              {!pastEntry && !locked && current
                && (prefs.speedRound
                  || (shownMode !== 'type' && runMode === 'survival' && screen === 'game'
                    && [1, 2].includes(cardStates[bank[current.idx]?._key]?.state))) && (
                <div className="timer-track" key={`${qNum}-${current.idx}`}>
                  <div className="timer-fill" />
                </div>
              )}

              {/* Answer surface — style rolled per card from Session setup */}
              {shownMode === 'card' ? (
                <>
                  <button type="button" className={`flip-zone${flipped || shownLocked ? ' on' : ''}`}
                    disabled={flipped || shownLocked} onClick={flipCard}>
                    {flipped || shownLocked ? shownQ.opts[shownQ.a] : 'Tap to reveal the answer'}
                  </button>
                  {shownEntry?.via === 'card' && (
                    <div className="self-note">{shownEntry.selfKnew ? '✓ marked as known' : '✗ marked as missed'}</div>
                  )}
                </>
              ) : shownMode === 'type' ? (
                shownLocked ? (
                  <div className={`type-result${shownOk ? ' ok' : ' no'}`}>
                    {shownTyped && <span className="tr-you">you typed: {shownTyped}</span>}
                    <span className="tr-ans">{shownQ.opts[shownQ.a]}</span>
                  </div>
                ) : (
                  <form className="type-form" onSubmit={submitTyped}>
                    <input
                      ref={typeInputRef}
                      className="type-input"
                      type="text"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="Type the answer…"
                      maxLength={140}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck="false"
                      aria-label="Type your answer"
                    />
                    <button type="submit" className="type-check" disabled={!typed.trim()} aria-label="Check answer">✓</button>
                  </form>
                )
              ) : !optsShown && !shownLocked ? (
                <button type="button" className="opt-veil"
                  onClick={() => { setOptsShown(true); sound.click(); haptics.light(); }}>
                  👀 Recall it first — tap to show choices
                </button>
              ) : (
              <div className="options">
                {shownQ.opts.map((opt, i) => {
                  let cls = 'opt';
                  if (!pastEntry && eliminated.has(i)) cls += ' eliminated';
                  const isAns = i === shownQ.a;
                  const isPicked = i === shownPicked;
                  if (shownLocked) {
                    if (isAns && isPicked) cls += ' correct sweep';
                    else if (isAns) cls += ' correct reveal';
                    else if (isPicked) cls += ' wrong picked-wrong';
                  }
                  return (
                    <button key={`${pastEntry ? `p${pastIdx}` : current.idx}-${i}`} className={cls} style={{ '--i': i }}
                      disabled={shownLocked || (!pastEntry && eliminated.has(i))}
                      onClick={() => (screen === 'review' ? handleReviewPick(i) : handlePick(i))}>
                      <span className="ltr">{i + 1}</span>
                      <span className="opt-text">{opt}</span>
                      <span className="mark">
                        {shownLocked && isAns && (
                          <svg viewBox="0 0 24 24" className="ok"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                        {shownLocked && isPicked && !isAns && (
                          <svg viewBox="0 0 24 24" className="no"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}

              {!pastEntry && fsrsNote && (
                <div className="fsrs-note show" style={{ color: { 1: '#FF5E7E', 2: '#FFB627', 3: '#4ADE80', 4: '#00E5FF' }[fsrsNote.grade] }}>
                  🧠 {{ 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }[fsrsNote.grade]}
                  {fsrsNote.intervalLabel ? ` · next review in ${fsrsNote.intervalLabel}` : ''}
                </div>
              )}
            </div>

            {/* Below the card — screen-level info so the card stays compact */}
            {!pastEntry && hintUsed && <div className="hint-box show">💡 {current.q.hint || (qMode === 'mcq' ? 'One wrong option eliminated.' : 'Try recalling the exact term.')}</div>}

            {/* Stored explanation — free, instant; AI thread below stays optional */}
            {(pastEntry ? pastEntry.q.explanation : (locked && !explain.show ? current.q.explanation : null)) && (
              <div className="explain-box show stored-explain">
                <span className="explain-label">📖 Why</span>
                {pastEntry ? pastEntry.q.explanation : current.q.explanation}
              </div>
            )}

            {!pastEntry && explain.show && (
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

            {/* Sticky bottom action dock — Gizmo-style, off the card */}
            <div className={`action-dock${!pastEntry && locked ? ' post' : ''}`}>
              {pastEntry ? (
                <>
                  <button type="button" className="dock-nav" disabled={pastIdx <= 0}
                    onClick={() => { setPastIdx((p) => Math.max(0, p - 1)); setCardAnim('q-enter'); }}
                    aria-label="Previous question">‹</button>
                  <button type="button" className="btn-continue"
                    onClick={() => { setPastIdx(null); setCardAnim('q-enter'); }}>Back to current</button>
                  <button type="button" className="dock-nav" disabled={pastIdx >= prevCount - 1}
                    onClick={() => { setPastIdx((p) => Math.min(prevCount - 1, p + 1)); setCardAnim('q-enter'); }}
                    aria-label="Next question">›</button>
                </>
              ) : !locked ? (
                <>
                  {prevCount > 0 && (
                    <button type="button" className="dock-nav"
                      onClick={() => { setPastIdx(prevCount - 1); setCardAnim('q-enter'); }}
                      aria-label="See previous questions">‹</button>
                  )}
                  {qMode === 'card' ? (
                    !flipped ? (
                      <button type="button" className="btn-continue" onClick={flipCard}>Flip card</button>
                    ) : (
                      <>
                        <button type="button" className="dock-no" onClick={() => gradeCard(false)}>✗ Missed it</button>
                        <button type="button" className="btn-continue" onClick={() => gradeCard(true)}>✓ Knew it</button>
                      </>
                    )
                  ) : (
                    <>
                      {(qMode === 'mcq' || current.q.hint) && <button type="button" onClick={handleHint}>💡 Hint</button>}
                      {screen === 'game' && <button type="button" onClick={handleReveal}>👁 Reveal</button>}
                    </>
                  )}
                </>
              ) : (
                <>
                  {prevCount > 0 && (
                    <button type="button" className="dock-nav"
                      onClick={() => { setPastIdx(prevCount - 1); setCardAnim('q-enter'); }}
                      aria-label="See previous questions">‹</button>
                  )}
                  <button type="button" className="btn-explain" onClick={handleExplain} disabled={explain.loading}>✨ Ask AI</button>
                  <button type="button" className="btn-continue" onClick={screen === 'review' ? handleReviewNext : handleContinue}>
                    {screen === 'review' ? 'Next →' : 'Continue →'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ END ═══ */}
        {screen === 'end' && endInfo && (
          <div className="end-screen show">
            <div className="end-verdict">{endInfo.deckCleared ? 'Section complete!' : verdictFor(endInfo.best, runMode)}</div>
            <div className="end-score">
              <CountUp value={runMode === 'survival' ? endInfo.best : endInfo.answered} dur={1000} />
            </div>
            <div className="end-label">{runMode === 'survival' ? 'best streak this run' : 'questions this session'}</div>
            {endInfo.deckCleared && (
              <div className="end-cleared-note">All {sectionTarget} questions survived · +{endInfo.clearBonus} XP bonus — come back when cards are due, spacing makes it stick.</div>
            )}
            <div className="run-chips">
              <span className="run-chip blue">+<CountUp value={endInfo.xp} /> XP</span>
              <span className="run-chip gold">+<CountUp value={endInfo.gems} delay={100} /> 💎</span>
              <span className="run-chip"><CountUp value={endInfo.acc} delay={200} suf="%" /> acc</span>
              {endInfo.avgSec > 0 && <span className="run-chip">⏱ <CountUp value={endInfo.avgSec} dec={1} suf="s" delay={300} /> avg</span>}
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
            {questsCard({ marginTop: 14, textAlign: 'left' })}
            <button className="primary" onClick={() => startRun(runMode)}>{runMode === 'survival' ? 'Run it back' : 'Practice again'}</button>
            <div className="secondary-row">
              {!isDaily && <button onClick={() => setScreen('home')}>Home</button>}
              <button onClick={onBack}>{isDaily ? 'Done' : 'Exit'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Toasts — capped at 2 visible, stacked in a container */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="tier-toast show" style={{ color: t.color, border: `1px solid ${t.color}55`, background: '#111826f0' }}>{t.msg}</div>
        ))}
      </div>
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

      {/* Answer-feedback edge vignette (keyed remount re-triggers the flash) */}
      {vig && <div key={vig.n} className={`vignette ${vig.k}`} />}

      {/* Fly-to-HUD particles */}
      {flies.map((f) => (
        <span
          key={f.id}
          className={`fly${f.go ? ' go' : ''}`}
          style={{ left: f.x, top: f.y, color: f.color, '--tx': `${f.tx}px`, '--ty': `${f.ty}px` }}
        >
          {f.text}
        </span>
      ))}

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
            {save.heartRefills > 0 && revivesUsed < MAX_REVIVES && (
              <button className="go-revive" onClick={redeemHeartRefill}>
                ❤️ Use heart refill — free revive
              </button>
            )}
            <button
              className="go-revive"
              disabled={revivesUsed >= MAX_REVIVES || save.gems < reviveCostNow()}
              onClick={reviveWithGems}
            >
              {revivesUsed >= MAX_REVIVES
                ? 'No revives left this run'
                : save.gems >= reviveCostNow()
                  ? `💎 ${reviveCostNow()} — Revive & keep going`
                  : `💎 Revive — need ${reviveCostNow()} gems`}
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
      {/* ═══ SESSION SETUP — answer style + extras, persisted in the save ═══ */}
      {modal === 'setup' && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Session setup</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="section-lbl">Answer style</div>
            {[
              ['smart', 'Smart mix', 'choices for new cards, typing once you know them'],
              ['mcq', 'Choices', 'pick from four options'],
              ['typing', 'Type it out', 'free recall — strongest for memory'],
              ['flashcard', 'Flip cards', 'reveal, then grade yourself'],
              ['mixed', 'Variety mix', 'a bit of everything'],
            ].map(([id, nm, ds]) => (
              <div className="setting-row" key={id}>
                <span>{nm}<div className="shop-desc">{ds}</div></span>
                <button className={`setting-btn${prefs.style === id ? ' on' : ''}`}
                  onClick={() => { setPref('style', id); sound.click(); }}>
                  {prefs.style === id ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
            <div className="section-lbl">Extras</div>
            <div className="setting-row">
              <span>Recall first<div className="shop-desc">choices stay hidden until you tap</div></span>
              <button className={`setting-btn${prefs.recallFirst ? ' on' : ''}`}
                onClick={() => { setPref('recallFirst', !prefs.recallFirst); sound.click(); }}>
                {prefs.recallFirst ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="setting-row">
              <span>Speed round<div className="shop-desc">7s per question — out of time counts as a miss</div></span>
              <button className={`setting-btn${prefs.speedRound ? ' on' : ''}`}
                onClick={() => { setPref('speedRound', !prefs.speedRound); sound.click(); }}>
                {prefs.speedRound ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      )}

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

            <div className="section-lbl">Shop · {save.gems}💎</div>
            <div className="setting-row">
              <span>🛡 Shield<span className="freeze-count">×{save.shields || 0}</span>
                <div className="shop-desc">Absorbs one heart loss</div>
              </span>
              <button className="setting-btn" onClick={buyShield} disabled={save.gems < SHOP.shield.cost || (save.shields || 0) >= SHOP.shield.max}>
                {(save.shields || 0) >= SHOP.shield.max ? 'Held' : `Buy · ${SHOP.shield.cost}💎`}
              </button>
            </div>
            <div className="setting-row">
              <span>❤️ Heart refill<span className="freeze-count">×{save.heartRefills || 0}</span>
                <div className="shop-desc">Free revive on game over</div>
              </span>
              <button className="setting-btn" onClick={buyRefill} disabled={save.gems < SHOP.heartRefill.cost || (save.heartRefills || 0) >= SHOP.heartRefill.max}>
                {(save.heartRefills || 0) >= SHOP.heartRefill.max ? 'Held' : `Buy · ${SHOP.heartRefill.cost}💎`}
              </button>
            </div>
            <div className="setting-row">
              <span>Streak freeze<span className="freeze-count">×{save.freezes}</span></span>
              <button className="setting-btn" onClick={buyFreeze} disabled={save.gems < 15}>Buy · 15💎</button>
            </div>

            <div className="section-lbl">Theme</div>
            <div className="theme-row">
              {THEMES.map((t) => {
                const owned = (save.themesOwned || ['cyan']).includes(t.id);
                const active = (save.theme || 'cyan') === t.id;
                return (
                  <button
                    key={t.id}
                    className={`theme-btn${active ? ' active' : ''}`}
                    onClick={() => pickTheme(t.id)}
                    title={owned ? `Equip ${t.name}` : `Unlock ${t.name} — ${t.cost}💎`}
                  >
                    <span className="theme-dot" style={{ background: t.color }} />
                    <span className="theme-name">{t.name}</span>
                    <span className="theme-cost">{active ? 'ON' : owned ? 'Equip' : `${t.cost}💎`}</span>
                  </button>
                );
              })}
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
            <button className="danger-btn" onClick={() => setModal('reset')}>reset survival progress</button>
          </div>
        </div>
      )}

      {/* ═══ RESET CONFIRM ═══ */}
      {modal === 'reset' && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Reset progress?</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-sub">
              This clears survival gems, XP, items, themes and achievements on this device. Your day streak and FSRS schedule are untouched.
            </div>
            <div className="quit-actions">
              <button className="setting-btn on" onClick={() => setModal(null)}>Keep progress</button>
              <button className="setting-btn danger" onClick={resetSave}>Reset</button>
            </div>
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
