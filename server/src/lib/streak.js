/**
 * Universal daily streak logic (UserProgress).
 * If the user studied today already, streak stays the same.
 * If the user studied yesterday, streak increments.
 * Otherwise, streak resets to 1 (unless streak freezes cover the gap).
 * Also updates longestStreak.
 *
 * @param {string} userId
 * @param {object} prisma - prisma client
 * @returns {Promise<{ streak: number, longestStreak: number, isNewDay: boolean }>}
 */
export async function updateUniversalStreak(userId, prisma) {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const up = await prisma.userProgress.findUnique({ where: { userId } });

  if (!up) {
    // Create progress record if it doesn't exist
    const created = await prisma.userProgress.create({
      data: {
        userId,
        streak: 1,
        longestStreak: 1,
        lastStudied: new Date(),
      },
    });
    return { streak: 1, longestStreak: 1, isNewDay: true };
  }

  const lastDay = up.lastStudied
    ? new Date(up.lastStudied).toISOString().split("T")[0]
    : null;

  if (lastDay === today) {
    // Already studied today — no change
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
    const gapDays = Math.round((new Date(today) - new Date(lastDay)) / 86400000);
    const missed = Math.max(0, gapDays - 1);
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
