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
    xp: 0,                    // game XP — drives level + career titles
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
  };
}

let cache = null;

export function loadSave() {
  if (cache) return cache;
  const key = `sc_survival_v1::${getUid()}`;
  try {
    const raw = localStorage.getItem(key);
    cache = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
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

// ---------- XP / levels (prototype math, exact) ----------

export const XP_PER_LEVEL = 120;
export const levelFromXP = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const xpIntoLevel = (xp) => xp % XP_PER_LEVEL;

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
