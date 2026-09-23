// Local persistence for the Streak Survival experience.
// FSRS scheduling lives server-side; this store holds game-only state:
// game XP/level, gems, freezes, quests, achievements, per-resource best streak.

export function getUid() {
  try {
    const authRaw = localStorage.getItem('scholars-circle-auth');
    if (authRaw) {
      const authParsed = JSON.parse(authRaw);
      return authParsed.authUser?.id || authParsed.authUser?.username || 'guest';
    }
  } catch { /* ignore */ }
  return localStorage.getItem('scholars-circle-current-user') || 'guest';
}

const todayKey = () => new Date().toISOString().slice(0, 10);

function defaults() {
  return {
    // { [resourceId|'global']: number }
    bestByScope: {},
    xp: 0,                    // unified total XP — mirrors server UserProgress.xp; drives level + career titles
    gems: 20,
    lifetimeGems: 20,
    freezes: 0,
    warmupDate: '',
    streakRewardDate: '',
    questDate: '',
    questProgress: {},        // { [questId]: number }
    questClaimed: [],         // quest ids claimed today
    questBonus: false,        // all-quests-done bonus chest granted today
    stats: { answered: 0, correct: 0, reviewCleared: 0, perfectRuns: 0, runs: 0 },
    achievements: [],         // unlocked achievement ids
    soundOn: true,
    shields: 0,               // held shields — absorb one heart loss each
    heartRefills: 0,          // held refills — free revive on game over
    themesOwned: ['cyan'],
    theme: 'cyan',
    quizPrefs: { style: 'smart', recallFirst: true, speedRound: false }, // session-setup choices
  };
}

let cache = null;

export function loadSave() {
  if (cache) return cache;
  const key = `sc_survival_v1::${getUid()}`;
  try {
    const raw = localStorage.getItem(key);
    cache = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    cache.quizPrefs = { ...defaults().quizPrefs, ...(cache.quizPrefs || {}) };
    // One-time migration: pre-'smart' saves stored the old silent defaults
    // ('mcq'/no recall-first). Only migrate untouched prefs — explicit picks stay.
    if (cache.quizPrefs.v !== 2) {
      const untouched = cache.quizPrefs.style === 'mcq' && !cache.quizPrefs.recallFirst && !cache.quizPrefs.speedRound;
      cache.quizPrefs.v = 2;
      if (untouched) { cache.quizPrefs.style = 'smart'; cache.quizPrefs.recallFirst = true; }
    }
  } catch {
    cache = defaults();
  }
  return cache;
}

export function persist() {
  if (!cache) return;
  const key = `sc_survival_v1::${getUid()}`;
  // setItem is quota-guarded globally via safeStorage.js
  try { localStorage.setItem(key, JSON.stringify(cache)); } catch { /* quota */ }
}

export function mutate(fn) {
  const s = loadSave();
  fn(s);
  persist();
  return s;
}

// Day-rollover housekeeping: rotates quest progress and bonus flags.
// Server FSRS owns the real day streak — nothing here touches it.
export function tickDay() {
  return mutate((s) => {
    const today = todayKey();
    if (s.questDate !== today) {
      s.questDate = today;
      s.questProgress = {};
      s.questClaimed = [];
      s.questBonus = false;
    }
  });
}

// ---------- XP / levels (progressive curve) ----------
// Cost of level n → n+1 grows by 60 each level: 120, 180, 240, ...
// totalXpForLevel(L) = 120(L-1) + 30(L-1)(L-2)  →  L5 = 840, L10 = 3240

export const XP_PER_LEVEL = 120; // base cost of level 1→2
export const xpForNextLevel = (level) => XP_PER_LEVEL + 60 * (Math.max(1, level) - 1);

export function levelProgress(xp) {
  let level = 1;
  let into = Math.max(0, xp || 0);
  while (into >= xpForNextLevel(level)) {
    into -= xpForNextLevel(level);
    level++;
  }
  const needed = xpForNextLevel(level);
  return { level, into, needed, pct: Math.min(100, (into / needed) * 100) };
}

export const levelFromXP = (xp) => levelProgress(xp).level;
export const xpIntoLevel = (xp) => levelProgress(xp).into;

// Keep the local XP mirror aligned with the unified app/server total
// (stats.xp, which syncs with UserProgress.xp via /user-data/sync max-merge).
export function syncTotalXp(total) {
  return mutate((s) => {
    const t = Math.max(0, Math.round(total || 0));
    if (t > s.xp) s.xp = t;
  });
}

export const CAREER_TITLES = [
  [1, 'Novice'],
  [3, 'Apprentice'],
  [5, 'Scholar'],
  [8, 'Sage'],
  [12, 'Master'],
  [16, 'Grandmaster'],
  [20, 'Legend'],
];
export function titleForLevel(lv) {
  let t = CAREER_TITLES[0][1];
  for (const [min, name] of CAREER_TITLES) if (lv >= min) t = name;
  return t;
}

export const TIER_XP = { easy: 5, medium: 10, hard: 20 };
export const TIER_GEMS = { easy: 1, medium: 2, hard: 3 };

// ---------- Shop / consumables / themes ----------

export const SHOP = {
  shield:      { cost: 12, max: 1, key: 'shields' },
  heartRefill: { cost: 10, max: 1, key: 'heartRefills' },
};

export const THEMES = [
  { id: 'cyan',   name: 'Cyan',   color: '#00E5FF', deep: '#0aa8c4', cost: 0 },
  { id: 'gold',   name: 'Gold',   color: '#FFB627', deep: '#c78c12', cost: 25 },
  { id: 'violet', name: 'Violet', color: '#B388FF', deep: '#7c5cd6', cost: 25 },
];

// kind: 'shield' | 'heartRefill' → true if purchased
export function buyItem(kind) {
  const def = SHOP[kind];
  if (!def) return false;
  let ok = false;
  mutate((s) => {
    if ((s[def.key] || 0) >= def.max || s.gems < def.cost) return;
    s.gems -= def.cost;
    s[def.key] = (s[def.key] || 0) + 1;
    ok = true;
  });
  return ok;
}

// Buy (if needed) and equip a theme. Returns true if equipped.
export function equipTheme(id) {
  const t = THEMES.find((x) => x.id === id);
  if (!t) return false;
  let ok = false;
  mutate((s) => {
    if (!Array.isArray(s.themesOwned)) s.themesOwned = ['cyan'];
    if (!s.themesOwned.includes(id)) {
      if (s.gems < t.cost) return;
      s.gems -= t.cost;
      s.themesOwned.push(id);
    }
    s.theme = id;
    ok = true;
  });
  return ok;
}

// ---------- Quests (prototype rotation, exact) ----------

const QUEST_POOL = [
  { id: 'ans15',   ico: '🎯', name: 'Answer 15 questions',        key: 'answered',     target: 15, reward: 8 },
  { id: 'ans30',   ico: '🔥', name: 'Answer 30 questions',        key: 'answered',     target: 30, reward: 12 },
  { id: 'cor10',   ico: '✅', name: 'Get 10 correct answers',     key: 'correct',      target: 10, reward: 8 },
  { id: 'cor20',   ico: '💪', name: 'Get 20 correct answers',     key: 'correct',      target: 20, reward: 15 },
  { id: 'cmb5',    ico: '⚡', name: 'Reach a 5 combo',            key: 'maxCombo',     target: 5,  reward: 10 },
  { id: 'cmb10',   ico: '🌪️', name: 'Reach a 10 combo',          key: 'maxCombo',     target: 10, reward: 18 },
  { id: 'rev3',    ico: '🔁', name: 'Clear 3 missed reviews',     key: 'reviewCleared',target: 3,  reward: 10 },
  { id: 'spd5',    ico: '💨', name: '5 answers under 5 seconds',  key: 'speedy',       target: 5,  reward: 10 },
  { id: 'perfect', ico: '🏆', name: 'Finish a run with no misses', key: 'perfectRun',  target: 1,  reward: 15 },
  { id: 'xp100',   ico: '✨', name: 'Earn 100 XP today',          key: 'xpToday',      target: 100, reward: 10 },
];

export function activeQuests(date = new Date()) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 864e5);
  const picked = [];
  for (let i = 0; picked.length < 3 && i < QUEST_POOL.length * 2; i++) {
    const q = QUEST_POOL[(dayOfYear * 7 + i * 3) % QUEST_POOL.length];
    if (!picked.some((p) => p.key === q.key)) picked.push(q);
  }
  return picked;
}

// Increment a quest stat. Returns array of quest ids newly completed (unclaimed).
export function questEvent(key, value, { setMax = false } = {}) {
  const done = [];
  mutate((s) => {
    for (const q of activeQuests()) {
      if (q.key !== key || s.questClaimed.includes(q.id)) continue;
      const cur = s.questProgress[q.id] || 0;
      const next = setMax ? Math.max(cur, value) : cur + value;
      s.questProgress[q.id] = next;
      if (cur < q.target && next >= q.target) done.push(q.id);
    }
  });
  return done;
}

export function claimQuest(id) {
  let reward = 0;
  mutate((s) => {
    const q = activeQuests().find((x) => x.id === id);
    if (!q || s.questClaimed.includes(id)) return;
    if ((s.questProgress[id] || 0) < q.target) return;
    s.questClaimed.push(id);
    s.gems += q.reward;
    s.lifetimeGems += q.reward;
    reward = q.reward;
    // all-quests bonus chest
    if (!s.questBonus && activeQuests().every((x) => s.questClaimed.includes(x.id))) {
      s.questBonus = true;
    }
  });
  return reward;
}

// ---------- Achievements (prototype list, exact) ----------

export const ACHIEVEMENTS = [
  { id: 'first_run',   ico: '🎬', nm: 'First Run',     ds: 'Complete your first survival run',  gm: 5 },
  { id: 'streak10',    ico: '🔥', nm: 'On Fire',       ds: 'Reach a 10 streak',                  gm: 10 },
  { id: 'streak25',    ico: '⚡', nm: 'Unstoppable',   ds: 'Reach a 15 streak — a flawless section', gm: 25 },
  { id: 'streak50',    ico: '🌟', nm: 'Legendary',     ds: 'Complete 25 survival runs',          gm: 50 },
  { id: 'perfect_run', ico: '💎', nm: 'Flawless',      ds: 'Finish a run with zero misses',      gm: 15 },
  { id: 'combo15',     ico: '🌀', nm: 'Combo Master',  ds: 'Hit a 12 combo',                     gm: 15 },
  { id: 'speed_demon', ico: '💨', nm: 'Speed Demon',   ds: 'Answer correctly in under 3 seconds',gm: 10 },
  { id: 'reviewer',    ico: '🔁', nm: 'Diligent',      ds: 'Clear 10 missed reviews (lifetime)', gm: 15 },
  { id: 'centurion',   ico: '💯', nm: 'Centurion',     ds: 'Answer 100 questions (lifetime)',    gm: 20 },
  { id: 'scholar500',  ico: '📚', nm: 'Bookworm',      ds: 'Answer 500 questions (lifetime)',    gm: 50 },
];

// check(ctx) → newly unlocked achievement objects
export function checkAchievements(ctx) {
  // ctx: { bestStreak, combo, perfectRun, speedy3, reviewClearedTotal, answeredTotal, runsTotal }
  const unlocked = [];
  mutate((s) => {
    const grant = (id) => {
      if (s.achievements.includes(id)) return;
      s.achievements.push(id);
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) {
        s.gems += a.gm;
        s.lifetimeGems += a.gm;
        unlocked.push(a);
      }
    };
    if (ctx.runsTotal >= 1) grant('first_run');
    if (ctx.bestStreak >= 10) grant('streak10');
    if (ctx.bestStreak >= 15) grant('streak25');
    if (ctx.runsTotal >= 25) grant('streak50');
    if (ctx.perfectRun) grant('perfect_run');
    if (ctx.combo >= 12) grant('combo15');
    if (ctx.speedy3) grant('speed_demon');
    if (ctx.reviewClearedTotal >= 10) grant('reviewer');
    if (ctx.answeredTotal >= 100) grant('centurion');
    if (ctx.answeredTotal >= 500) grant('scholar500');
  });
  return unlocked;
}
