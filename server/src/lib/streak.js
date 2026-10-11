/**
 * Universal daily streak logic (UserProgress).
 * If the user studied today already, streak stays the same.
 * If the user studied yesterday, streak increments.
 * Otherwise, streak resets to 1 (unless streak freezes cover the gap).
 * Also updates longestStreak.
 *
 * "Day" boundaries are the USER'S local calendar day, not UTC —
 * UserProgress.tzOffsetMinutes (minutes EAST of UTC, e.g. +60 Lagos) is
 * reported by the client on data load/sync and persists on the row. A caller
 * may pass the freshly-reported offset via `tzOffsetMinutes`; when omitted
 * the stored value is used, defaulting to 0 (UTC) for users who never report.
 * `lastStudied` stays an absolute instant — only the day boundary moves.
 *
 * @param {string} userId
 * @param {object} prisma - prisma client
 * @param {number} [tzOffsetMinutes] - minutes EAST of UTC (e.g. +60 for WAT)
 * @returns {Promise<{ streak: number, longestStreak: number, isNewDay: boolean }>}
 */

// Shifted-UTC trick: add the offset, then read the UTC date — that's the
// user's local calendar day as YYYY-MM-DD.
function localDayKey(ms, offsetMin) {
  return new Date(ms + offsetMin * 60000).toISOString().slice(0, 10);
}

// Integer days between two YYYY-MM-DD day keys.
function dayDiff(a, b) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

function clampOffset(min) {
  const n = Math.round(min);
  return Number.isFinite(n) ? Math.max(-840, Math.min(840, n)) : 0; // UTC±14
}

export async function updateUniversalStreak(userId, prisma, tzOffsetMinutes) {
  const up = await prisma.userProgress.findUnique({ where: { userId } });

  // Prefer a freshly-reported offset; fall back to the stored one.
  const hasExplicitOffset = Number.isFinite(tzOffsetMinutes);
  const offsetMin = hasExplicitOffset ? clampOffset(tzOffsetMinutes) : (up?.tzOffsetMinutes || 0);
  const offsetChanged = hasExplicitOffset && offsetMin !== (up?.tzOffsetMinutes || 0);

  const nowMs = Date.now();
  const today = localDayKey(nowMs, offsetMin);
  const yesterday = localDayKey(nowMs - 86400000, offsetMin);

  if (!up) {
    // Create progress record if it doesn't exist
    await prisma.userProgress.create({
      data: {
        userId,
        streak: 1,
        longestStreak: 1,
        lastStudied: new Date(),
        tzOffsetMinutes: offsetMin,
      },
    });
    return { streak: 1, longestStreak: 1, isNewDay: true };
  }

  const lastDay = up.lastStudied ? localDayKey(new Date(up.lastStudied).getTime(), offsetMin) : null;

  if (lastDay === today) {
    // Already studied today — no streak change, but keep the stored offset
    // fresh so travellers keep the right day boundaries.
    if (offsetChanged) {
      await prisma.userProgress.update({
        where: { userId },
        data: { tzOffsetMinutes: offsetMin },
      }).catch(() => {});
    }
    return {
      streak: up.streak,
      longestStreak: up.longestStreak,
      isNewDay: false,
    };
  }

  let newStreak;
  let freezesUsed = 0;
  if (lastDay === yesterday) {
    newStreak = up.streak + 1;
  } else if (lastDay) {
    // Missed days between lastStudied and today — one freeze covers one day.
    const missed = Math.max(0, dayDiff(today, lastDay) - 1);
    const available = up.freezes || 0;
    if (missed > 0 && available >= missed) {
      newStreak = up.streak + 1;
      freezesUsed = missed;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const newLongest = Math.max(up.longestStreak || 0, newStreak);

  await prisma.userProgress.update({
    where: { userId },
    data: {
      streak: newStreak,
      longestStreak: newLongest,
      lastStudied: new Date(),
      ...(offsetChanged ? { tzOffsetMinutes: offsetMin } : {}),
      ...(freezesUsed > 0 ? { freezes: { decrement: freezesUsed } } : {}),
    },
  });

  // Streak milestones → activity post in the social feed
  const MILESTONES = [7, 14, 30, 50, 100, 200, 365];
  if (MILESTONES.includes(newStreak)) {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { universityId: true },
      });
      await prisma.feedPost.create({
        data: {
          authorId: userId,
          kind: "activity",
          text: `hit a ${newStreak}-day streak`,
          universityId: profile?.universityId || null,
        },
      });
    } catch (err) {
      console.warn("Streak milestone post failed:", err.message);
    }
  }

  return {
    streak: newStreak,
    longestStreak: newLongest,
    isNewDay: true,
    freezesUsed,
    freezes: (up.freezes || 0) - freezesUsed,
  };
}
