// Single source for the competitive weekly league (promote/demote in
// leagueJob). The client's LEAGUES in src/lib/constants.js is a different
// ladder — lifetime-XP progression with a 6th "champion" tier — the two are
// intentionally distinct features, each single-sourced.
export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"];

// Weekly-XP thresholds used only to seed a brand-new user's tier. Existing
// users move strictly via the weekly promote/demote job — never recompute a
// stored tier from current XP (that was the demotion bug).
const TIER_MIN_WEEKLY_XP = { bronze: 0, silver: 100, gold: 250, platinum: 500, diamond: 1000 };

export function tierForWeeklyXP(weeklyXP) {
  let tier = "bronze";
  for (const t of TIERS) {
    if (weeklyXP >= TIER_MIN_WEEKLY_XP[t]) tier = t;
  }
  return tier;
}

// Africa/Lagos is UTC+1 year-round (no DST). League weeks and group-XP weeks
// anchor to Lagos midnight so resets land at 00:00 local for the user base —
// server-local time previously put them ~1h late.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export function getWeekStart(date = new Date()) {
  const shifted = new Date(date.getTime() + LAGOS_OFFSET_MS);
  const day = shifted.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // back to Monday, Lagos time
  const mondayUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + diff);
  return new Date(mondayUtc - LAGOS_OFFSET_MS);
}
