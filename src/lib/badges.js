// Badge catalog for the Progress → Stats screen.
// Every badge exposes progress(ctx) → { cur, max }; earned = cur >= max.
//
// ctx shape:
//   stats      — legacy UserProgress { xp, sessions, streak, totalCorrect, coins }
//   history    — legacy session history [{ subjectId, score, total, ts, mode, seconds }]
//   subjects   — legacy question-bank subjects
//   save       — streak-survival save { xp, gems, lifetimeGems, questClaimed,
//                 stats: { answered, correct, reviewCleared, perfectRuns, runs } }
//   fsrsStats  — GET /api/resources/fsrs/stats response
//   analytics  — GET /api/resources/fsrs/analytics response
//   community  — { saved, uploads }
//   vpCases    — Virtual Patient casesCompleted count

import { levelProgress } from "../features/streak-survival/survivalStore.js";

export const BADGE_GROUPS = [
  { id: "review", label: "Daily Review", icon: "📚" },
  { id: "streak", label: "Streaks", icon: "🔥" },
  { id: "practice", label: "Practice", icon: "⚡" },
  { id: "explore", label: "Explore", icon: "🧭" },
  { id: "secret", label: "Secret", icon: "❓" },
];

const p = (cur, max) => ({ cur: Math.max(0, cur || 0), max: Math.max(1, max || 1) });

// Any item that has ever been reviewed sits in learning/review/mastered.
const reviewedCount = (f) => (f?.learningCount || 0) + (f?.reviewCount || 0) + (f?.masteredCount || 0);

// Days reviewed over the trailing N days (incl. today) from analytics.dailyReviews.
function daysReviewed(analytics, n) {
  const map = analytics?.dailyReviews || {};
  let hit = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if ((map[d.toISOString().slice(0, 10)] || 0) > 0) hit++;
  }
  return hit;
}

const bestStreak = (f) => Math.max(f?.streak || 0, f?.longestStreak || 0);
const accuracy = (save) => (save?.stats?.answered || 0) > 0 ? (save.stats.correct || 0) / save.stats.answered : 0;

export const BADGES = [
  /* ── Daily Review (FSRS) ─────────────────────────────────────────── */
  { id: "first_review", group: "review", icon: "🌱", label: "First Steps", desc: "Review your first item",
    progress: (c) => p(reviewedCount(c.fsrsStats) > 0 ? 1 : 0, 1) },
  { id: "goal_crusher", group: "review", icon: "🎯", label: "Goal Crusher", desc: "Hit your daily review goal",
    progress: (c) => p((c.fsrsStats?.dailyGoal || 0) > 0 && (c.fsrsStats?.reviewedToday || 0) >= c.fsrsStats.dailyGoal ? 1 : 0, 1) },
  { id: "week_clean", group: "review", icon: "🗓️", label: "Perfect Week", desc: "Review every day for 7 days", rarity: "rare",
    progress: (c) => p(daysReviewed(c.analytics, 7), 7) },
  { id: "reviews_100", group: "review", icon: "🔁", label: "Repetition", desc: "Complete 100 reviews lifetime",
    progress: (c) => p(c.fsrsStats?.totalReviews || 0, 100) },
  { id: "reviews_500", group: "review", icon: "🏋️", label: "Iron Memory", desc: "Complete 500 reviews lifetime", rarity: "rare",
    progress: (c) => p(c.fsrsStats?.totalReviews || 0, 500) },
  { id: "mastered_10", group: "review", icon: "🎓", label: "Memorizer", desc: "Master 10 items",
    progress: (c) => p(c.fsrsStats?.masteredCount || 0, 10) },
  { id: "mastered_50", group: "review", icon: "🏆", label: "Vault", desc: "Master 50 items",
    progress: (c) => p(c.fsrsStats?.masteredCount || 0, 50) },
  { id: "mastered_100", group: "review", icon: "👑", label: "Grandmaster", desc: "Master 100 items", rarity: "rare",
    progress: (c) => p(c.fsrsStats?.masteredCount || 0, 100) },
  { id: "sharp_memory", group: "review", icon: "💎", label: "Steel Trap", desc: "Hold 90% retention over 50+ items", rarity: "rare",
    progress: (c) => p((c.fsrsStats?.totalItems || 0) >= 50 && (c.fsrsStats?.avgRetrievability || 0) >= 0.9 ? 1 : 0, 1) },
  { id: "deep_deck", group: "review", icon: "🏛️", label: "Deep Deck", desc: "Grow your deck to 500 items", rarity: "legendary",
    progress: (c) => p(c.fsrsStats?.totalItems || 0, 500) },

  /* ── Streaks ─────────────────────────────────────────────────────── */
  { id: "streak_3", group: "streak", icon: "⚡", label: "On Fire", desc: "Keep a 3-day streak",
    progress: (c) => p(bestStreak(c.fsrsStats), 3) },
  { id: "streak_7", group: "streak", icon: "🔥", label: "7-Day Streak", desc: "Keep a 7-day streak",
    progress: (c) => p(bestStreak(c.fsrsStats), 7) },
  { id: "streak_14", group: "streak", icon: "💫", label: "14-Day Streak", desc: "Keep a 14-day streak",
    progress: (c) => p(bestStreak(c.fsrsStats), 14) },
  { id: "streak_30", group: "streak", icon: "🌟", label: "30-Day Streak", desc: "Keep a 30-day streak", rarity: "rare",
    progress: (c) => p(bestStreak(c.fsrsStats), 30) },
  { id: "streak_100", group: "streak", icon: "💠", label: "Centurion", desc: "Keep a 100-day streak", rarity: "legendary",
    progress: (c) => p(bestStreak(c.fsrsStats), 100) },

  /* ── Practice (Rapid Recall / survival) ──────────────────────────── */
  { id: "answered_100", group: "practice", icon: "🎯", label: "Sharpshooter", desc: "Answer 100 practice questions",
    progress: (c) => p(c.save?.stats?.answered || 0, 100) },
  { id: "answered_500", group: "practice", icon: "🎖️", label: "Veteran", desc: "Answer 500 practice questions",
    progress: (c) => p(c.save?.stats?.answered || 0, 500) },
  { id: "sharp_80", group: "practice", icon: "🧠", label: "Precision", desc: "80% accuracy over 100+ answers", rarity: "rare",
    progress: (c) => p((c.save?.stats?.answered || 0) >= 100 && accuracy(c.save) >= 0.8 ? 1 : 0, 1) },
  { id: "flawless", group: "practice", icon: "💎", label: "Flawless", desc: "Finish a run with zero misses",
    progress: (c) => p(c.save?.stats?.perfectRuns || 0, 1) },
  { id: "cleaner", group: "practice", icon: "🧹", label: "Cleaner", desc: "Clear 25 missed reviews",
    progress: (c) => p(c.save?.stats?.reviewCleared || 0, 25) },
  { id: "quest_day", group: "practice", icon: "📜", label: "Quest Clear", desc: "Finish all 3 daily quests in one day",
    progress: (c) => p((c.save?.questClaimed || []).length, 3) },
  { id: "level_5", group: "practice", icon: "⭐", label: "Scholar", desc: "Reach level 5",
    progress: (c) => p(levelProgress(c.save?.xp || 0).level, 5) },
  { id: "level_10", group: "practice", icon: "🌟", label: "Master Scholar", desc: "Reach level 10", rarity: "rare",
    progress: (c) => p(levelProgress(c.save?.xp || 0).level, 10) },
  { id: "gem_hoarder", group: "practice", icon: "💰", label: "Gem Hoarder", desc: "Earn 500 gems lifetime",
    progress: (c) => p(c.save?.lifetimeGems || 0, 500) },

  /* ── Explore ─────────────────────────────────────────────────────── */
  { id: "polyglot", group: "explore", icon: "🧭", label: "Explorer", desc: "Study across 3+ subjects",
    progress: (c) => p(Object.keys(c.fsrsStats?.bySubject || {}).length, 3) },
  { id: "curator", group: "explore", icon: "📌", label: "Curator", desc: "Save 5 resources to My Space",
    progress: (c) => p(c.community?.saved || 0, 5) },
  { id: "contributor", group: "explore", icon: "📤", label: "Contributor", desc: "Upload 3 resources", rarity: "rare",
    progress: (c) => p(c.community?.uploads || 0, 3) },
  { id: "vp_intern", group: "explore", icon: "🩺", label: "Intern", desc: "Complete your first clinical case",
    progress: (c) => p(c.vpCases || 0, 1) },
  { id: "vp_resident", group: "explore", icon: "🏥", label: "Resident", desc: "Complete 10 clinical cases", rarity: "rare",
    progress: (c) => p(c.vpCases || 0, 10) },
  { id: "night_owl", group: "explore", icon: "🦉", label: "Night Owl", desc: "Study after 10 pm", rarity: "rare",
    progress: (c) => p((c.history || []).some((x) => new Date(x.ts).getHours() >= 22) ? 1 : 0, 1) },
  { id: "early_bird", group: "explore", icon: "🐦", label: "Early Bird", desc: "Study before 6 am", rarity: "rare",
    progress: (c) => p((c.history || []).some((x) => new Date(x.ts).getHours() < 6) ? 1 : 0, 1) },

  /* ── Secret (masked until earned) ────────────────────────────────── */
  { id: "comeback", group: "secret", icon: "🔄", label: "Comeback Kid", desc: "Return after a 7+ day break", hidden: true,
    progress: (c) => {
      const h = c.history || [];
      if (h.length < 2) return p(0, 1);
      const srt = [...h].sort((a, b) => b.ts - a.ts);
      return p(srt[0].ts - srt[1].ts > 7 * 86400000 ? 1 : 0, 1);
    } },
  { id: "marathon", group: "secret", icon: "🏃", label: "Marathon", desc: "Review 3x your daily goal in one day", hidden: true,
    progress: (c) => {
      const g = c.fsrsStats?.dailyGoal || 0;
      return p(g > 0 && (c.fsrsStats?.reviewedToday || 0) >= g * 3 ? 1 : 0, 1);
    } },
];

/** Resolve a catalog against ctx → [{ ...badge, cur, max, earned }] */
export function resolveBadges(ctx, list = BADGES) {
  return list.map((b) => {
    let prog = { cur: 0, max: 1 };
    try { prog = b.progress(ctx) || prog; } catch { /* badge check failed → locked */ }
    const max = Math.max(1, prog.max || 1);
    const cur = Math.min(Math.max(0, prog.cur || 0), max);
    return { ...b, cur, max, earned: (prog.cur || 0) >= max };
  });
}
