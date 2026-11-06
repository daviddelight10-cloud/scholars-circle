import rateLimit from "express-rate-limit";

// Client-reported quiz results feed XP, streaks and leaderboards, so reject
// anything that isn't a sane 0 <= score <= total whole-number pair.
export const MAX_QUESTIONS_PER_ATTEMPT = 500;

export function parseScore(rawScore, rawTotal) {
  const score = Number(rawScore);
  const total = Number(rawTotal);
  if (!Number.isInteger(score) || !Number.isInteger(total)) return null;
  if (total < 1 || total > MAX_QUESTIONS_PER_ATTEMPT) return null;
  if (score < 0 || score > total) return null;
  return { score, total };
}

// XP is still farmable one capped attempt at a time — throttle the write
// routes so scripted farming stays slow. Keyed per user (IP pre-auth).
export const xpAttemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: "Too many attempts — slow down" },
});
