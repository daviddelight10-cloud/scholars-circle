/**
 * Shared study history utilities — localStorage-based persistence for
 * AI-generated MCQs, summaries, flashcards, practice results, weak-spots, and mastery.
 *
 * Used by both PdfReader and DocumentReader.
 */

const HISTORY_PREFIX = "sc_study_history_";
const WEAKSPOT_PREFIX = "sc_study_weakspots_";
const PRACTICE_PREFIX = "sc_study_practice_";
const MAX_HISTORY = 20;

// ── Basic localStorage helpers ──────────────────────────────────────────────

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ── History keys ────────────────────────────────────────────────────────────

export function historyKey(resourceId) {
  return `${HISTORY_PREFIX}${resourceId}`;
}

export function weakspotKey(resourceId) {
  return `${WEAKSPOT_PREFIX}${resourceId}`;
}

export function practiceKey(resourceId) {
  return `${PRACTICE_PREFIX}${resourceId}`;
}

// ── History CRUD ────────────────────────────────────────────────────────────

export function loadHistory(resourceId) {
  return loadStored(historyKey(resourceId), []);
}

export function saveHistory(resourceId, entries) {
  saveStored(historyKey(resourceId), entries);
}

export function createHistoryEntry(entry) {
  return { id: Date.now(), ts: Date.now(), ...entry };
}

// ── Weak-spot tracking ──────────────────────────────────────────────────────

/**
 * Record practice results for a history entry.
 * weakspots structure: { [questionHash]: { wrongCount, lastWrongTs, question, correctAnswer } }
 */
export function recordPracticeResult(resourceId, mcqs, answers) {
  const key = weakspotKey(resourceId);
  const weakspots = loadStored(key, {});

  mcqs.forEach((q, i) => {
    const hash = hashQuestion(q.question);
    const userAnswer = answers[i];
    const isCorrect = userAnswer === q.correct;

    if (!weakspots[hash]) {
      weakspots[hash] = {
        question: q.question,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation || "",
        wrongCount: 0,
        lastWrongTs: null,
        lastPracticedTs: null,
      };
    }

    weakspots[hash].lastPracticedTs = Date.now();
    if (!isCorrect) {
      weakspots[hash].wrongCount += 1;
      weakspots[hash].lastWrongTs = Date.now();
    }
  });

  saveStored(key, weakspots);
  return weakspots;
}

export function getWeakSpots(resourceId) {
  const weakspots = loadStored(weakspotKey(resourceId), {});
  return Object.values(weakspots)
    .filter((w) => w.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount);
}

export function getWeakSpotQuestions(resourceId, mcqs) {
  const weakspots = loadStored(weakspotKey(resourceId), {});
  const weakHashes = new Set(
    Object.values(weakspots)
      .filter((w) => w.wrongCount > 0)
      .map((w) => hashQuestion(w.question))
  );
  // Sort MCQs: weak spots first, then remaining
  const weak = mcqs.filter((q) => weakHashes.has(hashQuestion(q.question)));
  const rest = mcqs.filter((q) => !weakHashes.has(hashQuestion(q.question)));
  return [...weak, ...rest];
}

// ── Mastery calculation ─────────────────────────────────────────────────────

export function getMastery(resourceId) {
  const weakspots = loadStored(weakspotKey(resourceId), {});
  const practiceData = loadStored(practiceKey(resourceId), { sessions: [], uniqueQuestions: {} });

  const allQuestions = Object.keys(weakspots);
  if (allQuestions.length === 0) {
    return { totalQuestions: 0, correctRate: 0, practicedCount: practiceData.sessions?.length || 0, mastered: 0 };
  }

  const correctQuestions = allQuestions.filter((h) => weakspots[h].wrongCount === 0 && weakspots[h].lastPracticedTs);
  const totalAnswered = allQuestions.filter((h) => weakspots[h].lastPracticedTs);

  const correctRate = totalAnswered.length > 0
    ? Math.round((correctQuestions.length / totalAnswered.length) * 100)
    : 0;

  return {
    totalQuestions: allQuestions.length,
    correctRate,
    practicedCount: practiceData.sessions?.length || 0,
    mastered: correctQuestions.length,
  };
}

export function recordPracticeSession(resourceId, entryId, score, total) {
  const key = practiceKey(resourceId);
  const data = loadStored(key, { sessions: [], uniqueQuestions: {} });
  data.sessions = data.sessions || [];
  data.sessions.push({ entryId, score, total, ts: Date.now() });
  // Keep last 50 sessions
  data.sessions = data.sessions.slice(-50);
  saveStored(key, data);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashQuestion(question) {
  const str = (question || "").trim().toLowerCase().slice(0, 200);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function getMasteryColor(rate) {
  if (rate >= 70) return "#66bb6a";
  if (rate >= 40) return "#ffb74d";
  return "#ef5350";
}

export function getMasteryEmoji(rate) {
  if (rate >= 90) return "🏆";
  if (rate >= 70) return "🎉";
  if (rate >= 40) return "📚";
  return "🌱";
}
