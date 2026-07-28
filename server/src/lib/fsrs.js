/**
 * FSRS (Free Spaced Repetition Scheduler) — FSRS-4.5 implementation
 *
 * Rating scale (1-4):
 *   1 = Again   — forgot, must see again soon
 *   2 = Hard    — correct but with significant effort
 *   3 = Good    — correct after some hesitation
 *   4 = Easy    — perfect, instant recall
 *
 * Card states:
 *   0 = new       — never reviewed
 *   1 = learning  — in initial learning phase
 *   2 = review    — in review phase
 *   3 = relearning — failed review, back in learning
 */

// FSRS-4.5 default weights (18 parameters)
const DEFAULT_W = [
  0.4072, 1.1829, 3.1262, 15.4742, 7.2102, 0.5316, 1.0651,
  0.0234, 1.616, 0.1544, 1.0347, 1.9395, 0.1097, 0.2975,
  2.2042, 0.2407, 2.9466, 0.5141,
];

const REQUEST_RETENTION = 0.9;
const MAX_INTERVAL = 36500;
const FACTOR = 19 / 81; // 0.2346 — derived from target retention

/**
 * Create a new FSRS card state.
 */
export function fsrsNewCard() {
  return {
    state: 0,        // new
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReviewAt: null,
  };
}

/**
 * Compute retrievability R for a card given elapsed days and stability.
 * R = (1 + elapsedDays / (9 * S)) ^ (-1)
 */
function retrievability(stability, elapsedDays) {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * Compute initial stability and difficulty for a first review.
 * Uses w[0..3] based on grade.
 */
function initStabilityDifficulty(grade, w) {
  const gradeIndex = grade - 1; // 0-3
  const stability = Math.max(0.1, w[gradeIndex]);
  const difficulty = Math.min(10, Math.max(1, w[4] - (grade - 3) * w[5]));
  return { stability, difficulty };
}

/**
 * Update difficulty based on grade and retrievability.
 * D' = w4 - (w4 - D) * (1 - R * w6)  — simplified FSRS-4.5
 * Clamped to [1, 10].
 */
function updateDifficulty(difficulty, grade, w) {
  const gradeDeltas = [-w[5], -w[5] * 0.5, 0, w[5]];
  const newD = difficulty + gradeDeltas[grade - 1];
  // Mean reversion toward w[4]
  const reverted = newD + (w[4] - newD) * w[6];
  return Math.min(10, Math.max(1, Math.round(reverted * 100) / 100));
}

/**
 * Core FSRS scheduling: given current card state and a grade, compute next state.
 *
 * @param {object} card — { state, stability, difficulty, reps, lapses, lastReviewAt }
 * @param {number} grade — 1 (Again) to 4 (Easy)
 * @param {Date} now — review timestamp
 * @param {number[]} w — weight array (optional, defaults to FSRS-4.5)
 * @returns {{ state, stability, difficulty, reps, lapses, lastReviewAt, intervalDays, nextReviewDate, retrievability }}
 */
export function fsrsRate(card, grade, now = new Date(), w = DEFAULT_W) {
  const g = Math.max(1, Math.min(4, Math.round(grade)));
  const prev = card || fsrsNewCard();
  const elapsedDays = prev.lastReviewAt
    ? Math.max(0, Math.round((now - new Date(prev.lastReviewAt)) / 86400000))
    : 0;

  let { state, stability, difficulty, reps, lapses } = prev;

  if (state === 0 || stability === 0) {
    // First review — initialize
    const init = initStabilityDifficulty(g, w);
    stability = init.stability;
    difficulty = init.difficulty;
    state = g === 1 ? 1 : 2; // Again → learning, else review
    reps = 1;
  } else {
    // Subsequent review
    const R = retrievability(stability, elapsedDays);
    difficulty = updateDifficulty(difficulty, g, w);

    if (g === 1) {
      // Failed — relearning
      lapses += 1;
      state = 3;
      // Stability decreases: S' = S * w11 (relearning factor)
      stability = Math.max(0.1, stability * w[11]);
      reps += 1;
    } else {
      // Passed — review or relearning → review
      state = 2;
      reps += 1;

      // Stability update for successful review
      // S' = S * (e^(w8 * (1 - R)) * (w9 + (4 - g) * w10) + 1)
      const easeFactor = w[9] + (4 - g) * w[10];
      const recallFactor = Math.exp(w[8] * (1 - R));
      stability = Math.max(0.1, stability * (recallFactor * easeFactor + 1));
    }
  }

  // Clamp stability
  stability = Math.round(stability * 100) / 100;

  // Compute next interval
  // I = S * (1 / R_target - 1) * FACTOR, where R_target = REQUEST_RETENTION
  // But FSRS uses: I = S * (1/R - 1) for the actual retrievability target
  const targetR = REQUEST_RETENTION;
  let intervalDays = Math.round(stability * (1 / targetR - 1) * FACTOR);

  // For learning/relearning state, use short fixed intervals
  if (state === 1) {
    intervalDays = g === 1 ? 1 : Math.max(1, Math.round(stability));
  } else if (state === 3) {
    intervalDays = 1; // Relearning: see again tomorrow
  }

  // Clamp interval
  intervalDays = Math.max(1, Math.min(MAX_INTERVAL, intervalDays));

  // Compute next review date
  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  const finalR = retrievability(stability, intervalDays);

  return {
    state,
    stability,
    difficulty,
    reps,
    lapses,
    lastReviewAt: now,
    intervalDays,
    nextReviewDate,
    retrievability: Math.round(finalR * 1000) / 1000,
  };
}

/**
 * Human-readable interval label for the frontend.
 */
export function intervalLabel(intervalDays) {
  if (intervalDays === 0) return "Today";
  if (intervalDays === 1) return "Tomorrow";
  if (intervalDays < 7) return `In ${intervalDays} days`;
  if (intervalDays < 14) return "In 1 week";
  if (intervalDays < 30) return `In ${Math.round(intervalDays / 7)} weeks`;
  if (intervalDays < 60) return "In 1 month";
  if (intervalDays < 365) return `In ${Math.round(intervalDays / 30)} months`;
  return `In ${Math.round(intervalDays / 365)} years`;
}

/**
 * Map FSRS state to a human-readable label.
 */
export function stateLabel(state) {
  return ["New", "Learning", "Review", "Relearning"][state] || "Unknown";
}

/**
 * Check if a card is "mastered" (stability > 21 days and state === 2).
 */
export function isMastered(card) {
  return card.state === 2 && card.stability >= 21;
}
