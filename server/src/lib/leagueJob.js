import { prisma } from "../db.js";

const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"];

function getTierFromXP(xp) {
  if (xp >= 1000) return "diamond";
  if (xp >= 500) return "platinum";
  if (xp >= 250) return "gold";
  if (xp >= 100) return "silver";
  return "bronze";
}

export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday of this week
  d.setDate(d.getDate() + diff);
  return d;
}

function getSeasonWeek(date = new Date()) {
  const d = getWeekStart(date);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const startWeek = getWeekStart(startOfYear);
  const diffMs = d - startWeek;
  const weekNum = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return parseInt(`${year}${String(weekNum).padStart(2, "0")}`);
}

/**
 * Ensure every student has a UserLeague row for the current week.
 * Creates one based on current XP if missing.
 */
export async function ensureLeagueAssignments() {
  const weekStart = getWeekStart();
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      totalXp: true,
      progress: { select: { xp: true } },
      league: true,
    },
  });

  for (const student of students) {
    if (student.league) {
      // Check if the existing league row is for this week
      if (new Date(student.league.weekStart) >= weekStart) continue;
    }

    const currentXP = student.progress?.xp || student.totalXp || 0;
    const tier = student.league?.tier || getTierFromXP(currentXP);

    await prisma.userLeague.upsert({
      where: { userId: student.id },
      create: {
        userId: student.id,
        tier,
        weeklyXP: 0,
        weekStart,
        promoted: false,
        demoted: false,
      },
      update: {
        tier,
        weeklyXP: 0,
        weekStart,
        promoted: false,
        demoted: false,
      },
    });
  }
}

/**
 * Weekly league reset: promote top 5, demote bottom 5 in each league.
 * Should run every Monday at 00:00.
 */
export async function runWeeklyLeagueReset() {
  console.log("[LeagueJob] Starting weekly league reset...");
  const prevWeekStart = getWeekStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const newWeekStart = getWeekStart();

  // Get all students with their current league and XP
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      totalXp: true,
      progress: { select: { xp: true } },
      league: true,
    },
  });

  // Group by current tier
  const byTier = {};
  for (const s of students) {
    const tier = s.league?.tier || getTierFromXP(s.progress?.xp || s.totalXp || 0);
    if (!byTier[tier]) byTier[tier] = [];
    byTier[tier].push(s);
  }

  // Process each tier
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    const users = byTier[tier] || [];

    // Sort by weeklyXP descending (most XP gained this week first)
    users.sort((a, b) => {
      const aXP = a.league?.weeklyXP || 0;
      const bXP = b.league?.weeklyXP || 0;
      return bXP - aXP;
    });

    const promoteCount = 5;
    const demoteCount = 5;
    const total = users.length;

    for (let j = 0; j < total; j++) {
      const user = users[j];
      const currentXP = user.progress?.xp || user.totalXp || 0;
      let newTier = tier;
      let promoted = false;
      let demoted = false;

      // Promote top 5 (if not already in diamond)
      if (j < promoteCount && i < TIERS.length - 1) {
        newTier = TIERS[i + 1];
        promoted = true;
      }
      // Demote bottom 5 (if not already in bronze)
      else if (j >= total - demoteCount && i > 0) {
        newTier = TIERS[i - 1];
        demoted = true;
      }

      await prisma.userLeague.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          tier: newTier,
          weeklyXP: 0,
          weekStart: newWeekStart,
          promoted,
          demoted,
        },
        update: {
          tier: newTier,
          weeklyXP: 0,
          weekStart: newWeekStart,
          promoted,
          demoted,
        },
      });
    }
  }

  console.log("[LeagueJob] Weekly league reset complete.");
}

/**
 * Update weeklyXP for a user (called when XP is awarded).
 */
export async function updateUserWeeklyXP(userId, xpGained) {
  const weekStart = getWeekStart();
  const existing = await prisma.userLeague.findUnique({ where: { userId } });

  if (!existing || new Date(existing.weekStart) < weekStart) {
    // Need new week assignment
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalXp: true, progress: { select: { xp: true } } },
    });
    const currentXP = user?.progress?.xp || user?.totalXp || 0;
    await prisma.userLeague.upsert({
      where: { userId },
      create: {
        userId,
        tier: getTierFromXP(currentXP),
        weeklyXP: xpGained,
        weekStart,
      },
      update: {
        weeklyXP: xpGained,
        weekStart,
        promoted: false,
        demoted: false,
      },
    });
  } else {
    await prisma.userLeague.update({
      where: { userId },
      data: { weeklyXP: { increment: xpGained } },
    });
  }
}

/**
 * Start the weekly league reset cron job.
 * Runs every Monday at 00:00.
 */
export function startLeagueJob() {
  // Run ensureLeagueAssignments immediately on startup
  ensureLeagueAssignments().catch((e) => console.error("[LeagueJob] Init error:", e));

  // Check every hour if it's time for a weekly reset
  const id = setInterval(async () => {
    const now = new Date();
    const weekStart = getWeekStart();
    // Check if any league assignments are stale (weekStart < this week's Monday)
    const staleCount = await prisma.userLeague.count({
      where: { weekStart: { lt: weekStart } },
    }).catch(() => 0);

    if (staleCount > 0) {
      try {
        await runWeeklyLeagueReset();
      } catch (e) {
        console.error("[LeagueJob] Weekly reset error:", e);
      }
    }
  }, 60 * 60 * 1000); // Check every hour

  console.log("[LeagueJob] League job started — will reset weekly.");
  return () => clearInterval(id);
}
