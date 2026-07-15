/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo 2 algorithm by Piotr Wozniak.
 *
 * Quality scale (0-5):
 *   5 - Perfect, instant recall
 *   4 - Correct after some hesitation
 *   3 - Correct with significant effort
 *   2 - Incorrect but felt easy to recall
 *   1 - Incorrect, felt familiar
 *   0 - Complete blackout
 *
 * Quality >= 3 is considered a "pass" (repetition counts).
 */

/**
 * Map a boolean correct/incorrect + timeSpentMs to a quality score (0-5).
 * For correct answers, faster responses get higher quality.
 * For incorrect answers, quality is 0-2 based on whether the user
 * was close (we can't know closeness, so we use 2 as default).
 *
 * @param {boolean} correct
 * @param {number|null} timeSpentMs - time taken to answer (optional)
 * @returns {number} quality 0-5
 */
export function computeQuality(correct, timeSpentMs = null) {
  if (!correct) return 2;
  if (timeSpentMs == null) return 4;
  // For correct answers, factor in response time
  // < 5s: perfect (5), < 15s: good (4), < 30s: ok (3), else still correct (3)
  if (timeSpentMs < 5000) return 5;
  if (timeSpentMs < 15000) return 4;
  return 3;
}

/**
 * Core SM-2 algorithm: given current state and a quality response,
 * compute the next easiness factor, interval, and repetition count.
 *
 * @param {number} quality - response quality 0-5
 * @param {number} easinessFactor - current EF (default 2.5)
 * @param {number} repetitions - current repetition count
 * @param {number} intervalDays - current interval in days
 * @returns {{ easinessFactor: number, intervalDays: number, repetitions: number }}
 */
export function sm2(quality, easinessFactor = 2.5, repetitions = 0, intervalDays = 0) {
  // Clamp quality to 0-5
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let newEF;
  let newRepetitions;
  let newInterval;

  if (q < 3) {
    // Failed — reset repetitions, start over with interval of 1 day
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Passed — increment repetitions
    newRepetitions = repetitions + 1;

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(intervalDays * easinessFactor);
    }
  }

  // Update easiness factor using the SM-2 formula
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  newEF = easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  // EF should never drop below 1.3
  newEF = Math.max(1.3, newEF);

  // Round EF to 2 decimal places
  newEF = Math.round(newEF * 100) / 100;

  // Safety: interval should be at least 1 day
  newInterval = Math.max(1, newInterval);

  return {
    easinessFactor: newEF,
    intervalDays: newInterval,
    repetitions: newRepetitions,
  };
}

/**
 * Compute the next due date from an SM-2 result.
 *
 * @param {number} intervalDays
 * @param {Date} from - base date (default: now)
 * @returns {Date} due date
 */
export function computeDueDate(intervalDays, from = new Date()) {
  const due = new Date(from);
  due.setDate(due.getDate() + intervalDays);
  return due;
}

/**
 * Compute a human-readable interval label for the frontend.
 *
 * @param {number} intervalDays
 * @returns {string}
 */
export function intervalLabel(intervalDays) {
  if (intervalDays === 1) return "Tomorrow";
  if (intervalDays < 7) return `In ${intervalDays} days`;
  if (intervalDays < 14) return "In 1 week";
  if (intervalDays < 30) return `In ${Math.round(intervalDays / 7)} weeks`;
  if (intervalDays < 60) return "In 1 month";
  return `In ${Math.round(intervalDays / 30)} months`;
}

/**
 * Update the universal daily streak in UserProgress.
 * If the user studied today already, streak stays the same.
 * If the user studied yesterday, streak increments.
 * Otherwise, streak resets to 1.
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
  if (lastDay === yesterday) {
    newStreak = up.streak + 1;
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
    },
  });

  return { streak: newStreak, longestStreak: newLongest, isNewDay: true };
}
