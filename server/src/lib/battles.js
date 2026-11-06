import { prisma } from "../db.js";
import { awardBadge } from "./badges.js";
import { AUTHOR_SELECT, publicUser } from "./social.js";

// ── Group-vs-group battles (Study Groups 2.0) ────────────────────────────────
// A GroupBattle is a challenge that becomes a live-quiz room on accept. The
// room engine calls finalizeBattle() on completion and cancelBattle() when the
// host ends early — ratings/XP/badges are written here, never by the client.

export const MAX_LINEUP = 5;
export const MIN_LINEUP = 1;
const ELO_K = 32;
const BATTLE_XP_WIN = 30;  // group-XP bonus per winning lineup member who played
const BATTLE_XP_PLAY = 15; // participation bonus (losers + draws)
const RANKED_MIN_ACTIVE = 3;          // members active in last 7d, per side
const RANKED_MEMBER_AGE_MS = 3 * 24 * 60 * 60 * 1000; // in the group ≥3d to play ranked
const RANKED_DAILY_CAP = 3;           // ranked battles per group per rolling day
const RANKED_REMATCH_MS = 24 * 60 * 60 * 1000;        // same opponent once/24h
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STALE_MS = 4 * 60 * 60 * 1000; // room died (server restart) → sweep

export function pendingExpiry() {
  return new Date(Date.now() + PENDING_TTL_MS);
}

// Captain = group creator or a member promoted to role="captain".
export async function isGroupCaptain(classroomId, userId) {
  const c = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { createdById: true, kind: true },
  });
  if (!c || c.kind !== "group") return false;
  if (c.createdById === userId) return true;
  const m = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId } },
    select: { role: true },
  }).catch(() => null);
  return m?.role === "captain";
}

// 1..5 unique userIds, all members of the group. Ranked lineups must also
// have been members for RANKED_MEMBER_AGE_MS (blocks ring-ins for point runs).
export async function validateLineup(classroomId, ids, { ranked = false } = {}) {
  if (!Array.isArray(ids) || ids.length < MIN_LINEUP || ids.length > MAX_LINEUP) {
    return { ok: false, error: `Lineup must be ${MIN_LINEUP}–${MAX_LINEUP} players` };
  }
  const unique = [...new Set(ids.map(String))];
  if (unique.length !== ids.length) return { ok: false, error: "Duplicate players in lineup" };
  const members = await prisma.classroomMember.findMany({
    where: { classroomId, userId: { in: unique } },
    select: { userId: true, joinedAt: true },
  });
  if (members.length !== unique.length) {
    return { ok: false, error: "Every player must be a member of your group" };
  }
  if (ranked) {
    const cutoff = Date.now() - RANKED_MEMBER_AGE_MS;
    if (members.some((m) => new Date(m.joinedAt).getTime() > cutoff)) {
      return { ok: false, error: "Ranked players must have been in the group 3+ days" };
    }
  }
  return { ok: true, lineup: unique };
}

// Ranked anti-farm rules — every check runs for BOTH groups where it applies.
export async function rankedGuards(fromId, toId) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - RANKED_REMATCH_MS);
  const ids = [fromId, toId];

  // ≥3 distinct members with group-XP events in the last 7 days.
  const activeRows = await prisma.groupXpEvent.groupBy({
    by: ["classroomId", "userId"],
    where: { classroomId: { in: ids }, createdAt: { gte: weekAgo } },
  });
  const activeCount = new Map();
  for (const r of activeRows) activeCount.set(r.classroomId, (activeCount.get(r.classroomId) || 0) + 1);
  if (ids.some((id) => (activeCount.get(id) || 0) < RANKED_MIN_ACTIVE)) {
    return { ok: false, error: `Ranked needs ${RANKED_MIN_ACTIVE}+ members active this week on both sides` };
  }

  // ≤3 ranked battles per group per rolling 24h.
  const recent = await prisma.groupBattle.groupBy({
    by: ["challengerId"],
    where: { mode: "ranked", createdAt: { gte: dayAgo }, challengerId: { in: ids } },
    _count: true,
  });
  const recentIn = await prisma.groupBattle.groupBy({
    by: ["challengedId"],
    where: { mode: "ranked", createdAt: { gte: dayAgo }, challengedId: { in: ids } },
    _count: true,
  });
  const dailyCount = (id) =>
    (recent.find((r) => r.challengerId === id)?._count || 0) +
    (recentIn.find((r) => r.challengedId === id)?._count || 0);
  if (ids.some((id) => dailyCount(id) >= RANKED_DAILY_CAP)) {
    return { ok: false, error: "Ranked limit reached — 3 battles per group per day" };
  }

  // Same pairing at most once per 24h (either direction).
  const rematch = await prisma.groupBattle.findFirst({
    where: {
      mode: "ranked",
      createdAt: { gte: dayAgo },
      OR: [
        { challengerId: fromId, challengedId: toId },
        { challengerId: toId, challengedId: fromId },
      ],
    },
    select: { id: true },
  });
  if (rematch) return { ok: false, error: "You already battled this group in the last 24h" };

  return { ok: true };
}

// ── Finalization (called by the room engine) ─────────────────────────────────

function teamPoints(room) {
  const s = { a: 0, b: 0 };
  for (const p of room.participants.values()) {
    if (p.team === "a") s.a += p.points || 0;
    else if (p.team === "b") s.b += p.points || 0;
  }
  return s;
}

function eloDelta(ra, rb, scoreA) {
  const expected = 1 / (1 + Math.pow(10, (rb - ra) / 400));
  return Math.round(ELO_K * (scoreA - expected));
}

// Persist the result, update Elo for ranked, award group XP + badges, and
// notify/announce. Idempotent — only the first call for an active battle lands.
export async function finalizeBattle(room) {
  const b = room.battle;
  if (!b) return;
  const scores = teamPoints(room);
  const winnerId =
    scores.a === scores.b ? null : scores.a > scores.b ? b.a.classroomId : b.b.classroomId;

  const claimed = await prisma.groupBattle.updateMany({
    where: { id: b.id, status: "active" },
    data: {
      status: "completed",
      scoreA: scores.a,
      scoreB: scores.b,
      winnerId,
      completedAt: new Date(),
    },
  });
  if (claimed.count === 0) return; // already finalized (e.g. rematch round)

  let ratingDeltaA = null;
  let ratingDeltaB = null;
  if (b.mode === "ranked") {
    const [ca, cb] = await Promise.all([
      prisma.classroom.findUnique({ where: { id: b.a.classroomId }, select: { rating: true } }),
      prisma.classroom.findUnique({ where: { id: b.b.classroomId }, select: { rating: true } }),
    ]);
    const scoreA = winnerId === null ? 0.5 : winnerId === b.a.classroomId ? 1 : 0;
    ratingDeltaA = eloDelta(ca?.rating ?? 1200, cb?.rating ?? 1200, scoreA);
    ratingDeltaB = -ratingDeltaA;
    await Promise.all([
      prisma.classroom.update({
        where: { id: b.a.classroomId },
        data: {
          rating: { increment: ratingDeltaA },
          rankedWins: winnerId === b.a.classroomId ? { increment: 1 } : undefined,
          rankedLosses: winnerId === b.b.classroomId ? { increment: 1 } : undefined,
        },
      }),
      prisma.classroom.update({
        where: { id: b.b.classroomId },
        data: {
          rating: { increment: ratingDeltaB },
          rankedWins: winnerId === b.b.classroomId ? { increment: 1 } : undefined,
          rankedLosses: winnerId === b.a.classroomId ? { increment: 1 } : undefined,
        },
      }),
    ]);
    await prisma.groupBattle.update({
      where: { id: b.id },
      data: { ratingDeltaA, ratingDeltaB },
    }).catch(() => {});
  }

  // Battle group-XP bonus — written straight to the ledger for the two
  // battling classrooms only (not fanned out to every group the player is in).
  const playedIds = new Set([...room.participants.values()].filter((p) => p.team).map((p) => p.userId));
  const rows = [];
  for (const uid of playedIds) {
    const side = b.a.lineup.includes(uid) ? "a" : "b";
    const won = winnerId === (side === "a" ? b.a.classroomId : b.b.classroomId);
    rows.push({
      classroomId: side === "a" ? b.a.classroomId : b.b.classroomId,
      userId: uid,
      xp: won ? BATTLE_XP_WIN : BATTLE_XP_PLAY,
      source: "battle",
      dedupeKey: `battle:${b.id}:${uid}`,
    });
  }
  if (rows.length) {
    await prisma.groupXpEvent.createMany({ data: rows, skipDuplicates: true }).catch(() => {});
  }

  // Badges: winners get First Victory; battle counts unlock Veteran at 10.
  for (const uid of playedIds) {
    const side = b.a.lineup.includes(uid) ? "a" : "b";
    const won = winnerId === (side === "a" ? b.a.classroomId : b.b.classroomId);
    if (won) awardBadge(uid, "battle_first_win").catch(() => {});
    const plays = await prisma.groupXpEvent.count({ where: { userId: uid, source: "battle" } }).catch(() => 0);
    if (plays >= 10) awardBadge(uid, "battle_veteran_10").catch(() => {});
  }

  // Announce + notify (best-effort, mirrors the live-quiz announce pattern).
  try {
    const { sendPushToUsers } = await import("./pushSender.js");
    const scoreline = `${b.a.name} ${scores.a} – ${scores.b} ${b.b.name}`;
    const outcome = winnerId === null ? "draw" : "win";
    const headline =
      winnerId === null ? `⚔️ ${scoreline} — draw!`
      : `⚔️ ${scoreline} — ${winnerId === b.a.classroomId ? b.a.name : b.b.name} takes it!`;
    await sendPushToUsers(
      [...playedIds],
      {
        title: headline,
        body: `Battle over — ${b.mode === "ranked" ? "ranked · " : ""}${outcome === "draw" ? "points shared" : "GG"}`,
        tag: `battle-${b.id}`,
        data: { tab: "discuss", feedTab: "groups", battle: b.id, liveCode: room.code },
      },
      { category: "social" }
    );
    const author = await prisma.userProfile.findUnique({
      where: { userId: b.createdById },
      select: { universityId: true },
    }).catch(() => null);
    await prisma.feedPost.create({
      data: {
        authorId: b.createdById,
        kind: "activity",
        text: `⚔️ Group battle: ${scoreline}${b.mode === "ranked" ? ` (ranked${ratingDeltaA != null ? `, ${ratingDeltaA > 0 ? "+" : ""}${ratingDeltaA} rating` : ""})` : ""}`,
        universityId: author?.universityId || null,
      },
    }).catch(() => {});
  } catch (e) {
    console.warn("[battle] finalize notify failed:", e?.message);
  }
}

// Host ended the room before completion — no scores, rating or XP.
export async function cancelBattle(room) {
  const b = room.battle;
  if (!b) return;
  await prisma.groupBattle.updateMany({
    where: { id: b.id, status: "active" },
    data: { status: "cancelled" },
  }).catch(() => {});
}

// Stale-state sweeps: pending challenges expire; active battles whose room
// died (deploy/crash) get cancelled; scheduled-war reminder pings.
export async function sweepBattles() {
  const now = new Date();
  await prisma.groupBattle.updateMany({
    where: { status: "pending", expiresAt: { lt: now } },
    data: { status: "expired" },
  }).catch(() => {});
  await prisma.groupBattle.updateMany({
    where: { status: "active", acceptedAt: { lt: new Date(now - ACTIVE_STALE_MS) } },
    data: { status: "cancelled" },
  }).catch(() => {});
}

export async function sendScheduledReminders() {
  const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const due = await prisma.groupBattle.findMany({
    where: {
      status: "pending",
      reminderSent: false,
      scheduledFor: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, challengerId: true, challengedId: true, scheduledFor: true },
  }).catch(() => []);
  if (!due.length) return;
  const { sendPushToUsers } = await import("./pushSender.js");
  for (const b of due) {
    const groups = await prisma.classroom.findMany({
      where: { id: { in: [b.challengerId, b.challengedId] } },
      select: { id: true, name: true, createdById: true },
    });
    await sendPushToUsers(
      groups.map((g) => g.createdById),
      {
        title: "⚔️ War tomorrow",
        body: `${groups.find((g) => g.id === b.challengerId)?.name || "A group"} vs ${groups.find((g) => g.id === b.challengedId)?.name || "your group"} — ${new Date(b.scheduledFor).toLocaleString()}`,
        tag: `war-${b.id}`,
        data: { tab: "discuss", feedTab: "groups", battle: b.id },
      },
      { category: "social" }
    ).catch(() => {});
    await prisma.groupBattle.update({ where: { id: b.id }, data: { reminderSent: true } }).catch(() => {});
  }
}

export function startBattleJobs() {
  const tick = () => {
    sweepBattles().catch((e) => console.warn("[battle] sweep failed:", e?.message));
    sendScheduledReminders().catch((e) => console.warn("[battle] reminders failed:", e?.message));
  };
  tick();
  const id = setInterval(tick, 60 * 60 * 1000);
  console.log("[battles] sweeper + scheduled-war reminders started");
  return () => clearInterval(id);
}

// Resolve lineup userIds → public user shapes for the battle detail view.
export async function hydrateLineups(battle) {
  const ids = [...(battle.lineupA || []), ...(battle.lineupB || [])].map(String);
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: AUTHOR_SELECT })
    : [];
  const byId = new Map(users.map((u) => [u.id, publicUser(u)]));
  return {
    a: (battle.lineupA || []).map((id) => byId.get(String(id)) || { id, name: "Scholar" }),
    b: (battle.lineupB || []).map((id) => byId.get(String(id)) || { id, name: "Scholar" }),
  };
}
