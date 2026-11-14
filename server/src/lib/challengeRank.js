// Pure helpers for exam-challenge leaderboards + per-question stats.

/**
 * Collapse attempts to one ranked row per user.
 * scoring "first" → earliest attempt counts; "best" → highest score (earliest on ties).
 * Rows sorted score desc, then faster duration, then earlier finish. Ties share a rank.
 */
export function rankAttempts(attempts, scoring = "first") {
  const byUser = new Map();
  for (const a of attempts) {
    const cur = byUser.get(a.userId);
    if (!cur) { byUser.set(a.userId, a); continue; }
    const better = scoring === "best"
      ? a.score > cur.score || (a.score === cur.score && (a.durationMs ?? Infinity) < (cur.durationMs ?? Infinity))
      : new Date(a.createdAt) < new Date(cur.createdAt);
    if (better) byUser.set(a.userId, a);
  }
  const ranked = [...byUser.values()].sort((x, y) =>
    y.score - x.score
    || (x.durationMs ?? Infinity) - (y.durationMs ?? Infinity)
    || new Date(x.createdAt) - new Date(y.createdAt)
  );
  let rank = 0;
  let lastScore = null;
  return ranked.map((a, i) => {
    if (a.score !== lastScore) rank = i + 1;
    lastScore = a.score;
    return { ...a, rank };
  });
}

/**
 * Aggregate per-question correctness across attempt `details` JSON
 * ([{questionIndex, questionId, correct, marksAwarded, maxMarks}]).
 * Returns hardest/easiest (top 3 each by correctPct).
 */
export function questionStats(attempts) {
  const acc = new Map();
  for (const a of attempts) {
    const details = Array.isArray(a.details) ? a.details : [];
    for (const d of details) {
      if (!d) continue;
      const key = d.questionId ?? `q${d.questionIndex}`;
      const cur = acc.get(key) || { questionIndex: d.questionIndex ?? 0, n: 0, correct: 0, marks: 0, max: 0 };
      cur.n += 1;
      if (d.correct) cur.correct += 1;
      cur.marks += d.marksAwarded ?? 0;
      cur.max += d.maxMarks ?? 0;
      acc.set(key, cur);
    }
  }
  const rows = [...acc.entries()].map(([id, s]) => ({
    questionId: id,
    questionIndex: s.questionIndex,
    attempts: s.n,
    correctPct: s.n ? Math.round((s.correct / s.n) * 100) : 0,
    avgMarksPct: s.max > 0 ? Math.round((s.marks / s.max) * 100) : 0,
  }));
  rows.sort((a, b) => a.correctPct - b.correctPct || a.questionIndex - b.questionIndex);
  return {
    avgPct: null, // filled by caller if needed
    hardest: rows.slice(0, 3),
    easiest: rows.slice(-3).reverse(),
  };
}
