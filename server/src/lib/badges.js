import { prisma } from "../db.js";

// ─── Badge Catalogue ───────────────────────────────────────────────
export const BADGE_DEFS = [
  // Streak badges
  { key: "streak_3", name: "3-Day Streak", description: "Study 3 days in a row", icon: "🔥", category: "streak" },
  { key: "streak_7", name: "Week Warrior", description: "7-day study streak", icon: "⚡", category: "streak" },
  { key: "streak_14", name: "Fortnight Focus", description: "14-day streak", icon: "💪", category: "streak" },
  { key: "streak_30", name: "Monthly Machine", description: "30-day streak", icon: "🏆", category: "streak" },
  // League badges
  { key: "league_silver", name: "Silver Tier", description: "Promoted to Silver league", icon: "🥈", category: "league" },
  { key: "league_gold", name: "Gold Tier", description: "Promoted to Gold league", icon: "🥇", category: "league" },
  { key: "league_platinum", name: "Platinum Tier", description: "Promoted to Platinum league", icon: "💎", category: "league" },
  { key: "league_diamond", name: "Diamond Tier", description: "Promoted to Diamond league", icon: "👑", category: "league" },
  // Duel badges
  { key: "first_duel_win", name: "First Blood", description: "Win your first duel", icon: "⚔️", category: "duel" },
  { key: "duel_5_wins", name: "Duelist", description: "Win 5 duels", icon: "🗡️", category: "duel" },
  { key: "duel_perfect", name: "Flawless Victory", description: "Score 10/10 in a duel", icon: "✨", category: "duel" },
  // Study badges
  { key: "first_session", name: "First Steps", description: "Complete your first study session", icon: "📖", category: "study" },
  { key: "sessions_10", name: "Studious", description: "Complete 10 sessions", icon: "📚", category: "study" },
  { key: "sessions_50", name: "Scholar", description: "Complete 50 sessions", icon: "🎓", category: "study" },
  { key: "perfect_score", name: "100% Club", description: "Score 100% on any exam", icon: "💯", category: "study" },
  { key: "xp_1000", name: "XP Hunter", description: "Earn 1000 total XP", icon: "🌟", category: "study" },
  // Social badges
  { key: "first_post", name: "Social Butterfly", description: "Make your first wall post", icon: "🦋", category: "social" },
  { key: "challenge_winner", name: "Challenge Champion", description: "Win a weekly challenge", icon: "🏅", category: "social" },
];

// Ensure all badges exist in DB
export async function seedBadges() {
  for (const def of BADGE_DEFS) {
    await prisma.badge.upsert({
      where: { key: def.key },
      update: { name: def.name, description: def.description, icon: def.icon, category: def.category },
      create: def,
    });
  }
  console.log(`[badges] seeded ${BADGE_DEFS.length} badges`);
}

// Award a badge to user (idempotent)
export async function awardBadge(userId, badgeKey) {
  const badge = await prisma.badge.findUnique({ where: { key: badgeKey } });
  if (!badge) return null;
  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (existing) return null; // already has it
  const ub = await prisma.userBadge.create({
    data: { userId, badgeId: badge.id },
    include: { badge: true },
  });
  return ub;
}

// Check & award streak badges for a user
export async function checkStreakBadges(userId) {
  const progress = await prisma.userProgress.findUnique({ where: { userId } });
  if (!progress) return [];
  const streak = progress.streak || 0;
  const awarded = [];
  if (streak >= 3) { const r = await awardBadge(userId, "streak_3"); if (r) awarded.push(r); }
  if (streak >= 7) { const r = await awardBadge(userId, "streak_7"); if (r) awarded.push(r); }
  if (streak >= 14) { const r = await awardBadge(userId, "streak_14"); if (r) awarded.push(r); }
  if (streak >= 30) { const r = await awardBadge(userId, "streak_30"); if (r) awarded.push(r); }
  return awarded;
}

// Check & award study badges
export async function checkStudyBadges(userId) {
  const progress = await prisma.userProgress.findUnique({ where: { userId } });
  if (!progress) return [];
  const awarded = [];
  if (progress.sessions >= 1) { const r = await awardBadge(userId, "first_session"); if (r) awarded.push(r); }
  if (progress.sessions >= 10) { const r = await awardBadge(userId, "sessions_10"); if (r) awarded.push(r); }
  if (progress.sessions >= 50) { const r = await awardBadge(userId, "sessions_50"); if (r) awarded.push(r); }
  if (progress.xp >= 1000) { const r = await awardBadge(userId, "xp_1000"); if (r) awarded.push(r); }
  return awarded;
}

// Check duel badges
export async function checkDuelBadges(userId) {
  const wins = await prisma.challengeDuel.count({ where: { winnerId: userId, status: "completed" } });
  const awarded = [];
  if (wins >= 1) { const r = await awardBadge(userId, "first_duel_win"); if (r) awarded.push(r); }
  if (wins >= 5) { const r = await awardBadge(userId, "duel_5_wins"); if (r) awarded.push(r); }
  return awarded;
}

// ─── League Tiers ──────────────────────────────────────────────────
export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"];
const TIER_THRESHOLDS = { bronze: 0, silver: 200, gold: 500, platinum: 1000, diamond: 2000 };

export function computeTier(weeklyXP) {
  let tier = "bronze";
  for (const [t, threshold] of Object.entries(TIER_THRESHOLDS)) {
    if (weeklyXP >= threshold) tier = t;
  }
  return tier;
}

// Get or create user's league row
export async function getUserLeague(userId) {
  let league = await prisma.userLeague.findUnique({ where: { userId } });
  if (!league) {
    league = await prisma.userLeague.create({ data: { userId } });
  }
  return league;
}

// Add XP to weekly league counter and potentially promote
export async function addLeagueXP(userId, xpGained) {
  let league = await getUserLeague(userId);
  const newWeeklyXP = league.weeklyXP + xpGained;
  const newTier = computeTier(newWeeklyXP);
  const promoted = TIERS.indexOf(newTier) > TIERS.indexOf(league.tier);

  league = await prisma.userLeague.update({
    where: { userId },
    data: { weeklyXP: newWeeklyXP, tier: newTier, promoted },
  });

  // Award league badge on promotion
  if (promoted && newTier !== "bronze") {
    await awardBadge(userId, `league_${newTier}`);
  }
  return league;
}
