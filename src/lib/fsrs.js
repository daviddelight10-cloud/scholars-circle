/**
 * FSRS (Free Spaced Repetition Scheduler) — FSRS-6 implementation.
 * Client-side port of server/src/lib/fsrs.js — keep the math in sync.
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

// FSRS-6 default weights (21 parameters)
const DEFAULT_W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
  0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

const REQUEST_RETENTION = 0.9;
const MAX_INTERVAL = 36500;
const S_MIN = 0.1;
const S_MAX = 36500;
const INIT_S_MAX = 100;
const D_MIN = 1;
const D_MAX = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round2 = (v) => Math.round(v * 100) / 100;

// FSRS-6 forgetting curve: R(t,S) = (1 + factor * t/S)^(-w20)
// factor is derived so that R(S,S) = 0.9.
function decayOf(w) {
  return -w[20];
}

function factorOf(w) {
  return Math.pow(0.9, 1 / decayOf(w)) - 1;
}

/**
 * Create a new FSRS card state. `due` is epoch ms so entries can be
 * filtered with `card.due <= Date.now()`.
 */
export function fsrsNewCard() {
  return {
    state: 0,        // new
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReviewAt: null,
    due: null,
  };
}

/**
 * Normalize a stored entry to an FSRS card. Handles legacy SM-2 entries
 * ({ interval, ease, due }) by mapping interval→stability and ease→difficulty.
 */
export function toFsrsCard(entry) {
  if (!entry) return fsrsNewCard();
  // Already FSRS-shaped (has stability/state fields)
  if (entry.stability !== undefined || entry.state !== undefined) {
    return {
      ...fsrsNewCard(),
      ...entry,
      lastReviewAt: entry.lastReviewAt ? new Date(entry.lastReviewAt) : null,
    };
  }
  // Legacy entry: { interval, ease, due }
  const interval = Math.max(0.1, Number(entry.interval) || 1);
  const ease = Number(entry.ease) || 2.5;
  return {
    state: entry.reps > 0 || interval > 1 ? 2 : 0,
    stability: interval,
    difficulty: clamp(ease * 2, D_MIN, D_MAX),
    reps: entry.reps || 0,
    lapses: entry.lapses || 0,
    lastReviewAt: entry.lastReviewAt ? new Date(entry.lastReviewAt) : null,
    due: entry.due ?? null,
  };
}

function retrievability(stability, elapsedDays, w) {
  if (stability <= 0) return 0;
  return Math.pow(1 + factorOf(w) * (elapsedDays / stability), decayOf(w));
}

function initStability(grade, w) {
  return clamp(w[grade - 1], S_MIN, INIT_S_MAX);
}

function initDifficulty(grade, w) {
  return clamp(w[4] - Math.exp((grade - 1) * w[5]) + 1, D_MIN, D_MAX);
}

/**
 * Difficulty after a review (FSRS-6, with linear damping + mean reversion):
 *   delta_d = -w[6] * (G - 3)
 *   next_d  = D + delta_d * (10 - D) / 9
 *   D'      = w[7] * D0(Easy) + (1 - w[7]) * next_d
 */
function nextDifficulty(difficulty, grade, w) {
  const deltaD = -w[6] * (grade - 3);
  const damped = difficulty + deltaD * ((D_MAX - difficulty) / 9);
  const reverted = w[7] * initDifficulty(4, w) + (1 - w[7]) * damped;
  return clamp(round2(reverted), D_MIN, D_MAX);
}

/**
 * Stability after a successful different-day recall:
 *   S'r = S * (e^w8 * (11-D) * S^(-w9) * (e^(w10*(1-R)) - 1)
 *             * w15 (if G=2) * w16 (if G=4) + 1)
 */
function recallStability(difficulty, stability, r, grade, w) {
  const hardPenalty = grade === 2 ? w[15] : 1;
  const easyBonus = grade === 4 ? w[16] : 1;
  return stability * (
    Math.exp(w[8]) * (11 - difficulty) * Math.pow(stability, -w[9]) *
    Math.expm1(w[10] * (1 - r)) * hardPenalty * easyBonus + 1
  );
}

/**
 * Stability after forgetting a different-day review:
 *   S'f = w11 * D^(-w12) * ((S+1)^w13 - 1) * e^(w14*(1-R))
 * Capped so post-lapse stability never exceeds the same-day bound.
 */
function forgetStability(difficulty, stability, r, w) {
  const raw = w[11] * Math.pow(difficulty, -w[12]) *
    (Math.pow(stability + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  const cap = stability / Math.exp(w[17] * w[18]);
  return clamp(raw, 0.01, cap);
}

/**
 * Stability after a same-day review:
 *   S's = S * e^(w17 * (G - 3 + w18)) * S^(-w19)
 * For G >= 2 the increment is clamped so stability never decreases.
 */
function sameDayStability(stability, grade, w) {
  const sInc = Math.exp(w[17] * (grade - 3 + w[18])) * Math.pow(stability, -w[19]);
  const next = stability * sInc;
  return grade >= 2 ? Math.max(next, stability) : next;
}

/**
 * Core FSRS scheduling: given current card state and a grade, compute next state.
 *
 * @param {object} card — FSRS card (from fsrsNewCard/toFsrsCard)
 * @param {number} grade — 1 (Again) to 4 (Easy)
 * @param {Date} now — review timestamp
 * @param {number[]} w — weight array (optional, defaults to FSRS-6)
 * @returns {object} next card state, including `due` (epoch ms) and `intervalDays`
 */
export function fsrsRate(card, grade, now = new Date(), w = DEFAULT_W) {
  if (!Array.isArray(w) || w.length !== 21) w = DEFAULT_W;
  const g = Math.max(1, Math.min(4, Math.round(grade)));
  const prev = card || fsrsNewCard();
  const elapsedDays = prev.lastReviewAt
    ? Math.max(0, (now - new Date(prev.lastReviewAt)) / 86400000)
    : 0;
  const sameDay = !!prev.lastReviewAt && elapsedDays < 1;

  let { state, stability, difficulty, reps, lapses } = prev;

  if (state === 0 || stability === 0) {
    // First review — initialize
    stability = initStability(g, w);
    difficulty = initDifficulty(g, w);
    state = g === 1 ? 1 : 2; // Again → learning, else review
    reps = 1;
  } else {
    // Subsequent review
    const R = retrievability(stability, elapsedDays, w);
    difficulty = nextDifficulty(difficulty, g, w);

    if (g === 1) {
      // Failed — relearning
      lapses += 1;
      state = 3;
      stability = sameDay
        ? sameDayStability(stability, g, w)
        : forgetStability(difficulty, stability, R, w);
      reps += 1;
    } else {
      // Passed — review or relearning → review
      state = 2;
      reps += 1;
      stability = sameDay
        ? sameDayStability(stability, g, w)
        : recallStability(difficulty, stability, R, g, w);
    }
  }

  stability = clamp(round2(stability), 0.01, S_MAX);

  // Compute next interval — I(r,S) ≈ S at target retention
  const factor = factorOf(w);
  let intervalDays = Math.round(
    (stability / factor) * (Math.pow(REQUEST_RETENTION, 1 / decayOf(w)) - 1)
  );

  // For learning/relearning state, use short fixed intervals
  if (state === 1) {
    intervalDays = g === 1 ? 1 : Math.max(1, Math.round(stability));
  } else if (state === 3) {
    intervalDays = 1; // Relearning: see again tomorrow
  }

  // ±15% jitter for longer review intervals to prevent clustering
  if (state === 2 && intervalDays > 2) {
    const jitter = 0.85 + Math.random() * 0.3;
    intervalDays = Math.max(1, Math.round(intervalDays * jitter));
  }

  intervalDays = Math.max(1, Math.min(MAX_INTERVAL, intervalDays));

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  const finalR = retrievability(stability, intervalDays, w);

  return {
    state,
    stability,
    difficulty,
    reps,
    lapses,
    lastReviewAt: now,
    intervalDays,
    nextReviewDate,
    due: nextReviewDate.getTime(),
    retrievability: Math.round(finalR * 1000) / 1000,
  };
}

/**
 * Human-readable interval label.
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

/**
 * Map a session result (correct + self-rated confidence) to an FSRS grade.
 * confidence values from SessionPlayer: "unsure" | "okay" | "sure".
 */
export function gradeFromResult({ correct, confidence } = {}) {
  if (!correct) return 1;
  if (confidence === "unsure") return 2;
  if (confidence === "sure") return 4;
  return 3;
}
