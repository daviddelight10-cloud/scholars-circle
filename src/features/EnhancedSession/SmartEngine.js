/**
 * Smart Practice Engine
 * - Adaptive difficulty: adjusts question hardness in real-time
 * - Weak-topic prioritization
 * - Spaced repetition weighting
 */

// Difficulty levels based on historical performance
const DIFFICULTY = { easy: 1, medium: 2, hard: 3 };

/**
 * Score a question's difficulty based on global/user stats
 */
function questionDifficulty(q, wrongCounts = {}, mastery = {}) {
  const key = q.key || q.questionId;
  const subjectId = q.subjectId;
  
  // If user has gotten it wrong before, it's harder for them
  const wrongCount = wrongCounts[key] || 0;
  
  // Subject mastery (0-1)
  const subjectMastery = mastery[subjectId] || 0;
  
  // Base difficulty from question attributes (if available)
  let base = DIFFICULTY.medium;
  if (q.difficulty === "easy") base = DIFFICULTY.easy;
  if (q.difficulty === "hard") base = DIFFICULTY.hard;
  
  // Adjust: questions user often gets wrong are "harder" for them
  const personalDifficulty = base + (wrongCount > 2 ? 1 : 0);
  
  return Math.min(3, personalDifficulty);
}

/**
 * Adaptive question selector: picks next question based on current performance
 * 
 * If student is doing well (>70%) → serve harder questions
 * If student is struggling (<50%) → serve easier questions
 * Always prioritize weak topics
 */
export function selectAdaptiveQuestions(pool, options = {}) {
  const {
    count = 10,
    wrongCounts = {},
    mastery = {},
    srData = {},
    recentResults = [],
  } = options;

  if (pool.length <= count) return [...pool];

  // Score each question for priority
  const scored = pool.map(q => {
    const key = q.key || q.questionId;
    const subjectId = q.subjectId;
    let priority = 0;

    // 1. Weak topics get +3 priority
    const subMastery = mastery[subjectId] || 0;
    if (subMastery < 0.5) priority += 3;
    else if (subMastery < 0.7) priority += 1;

    // 2. Previously wrong answers get +2
    const wrongs = wrongCounts[key] || 0;
    if (wrongs > 0) priority += Math.min(wrongs, 3);

    // 3. Spaced repetition: due items get +2
    const srEntry = srData[key];
    if (srEntry && srEntry.nextReview && Date.now() >= srEntry.nextReview) {
      priority += 2;
    }

    // 4. Current session performance adjusts difficulty preference
    const recentCorrect = recentResults.filter(r => r.correct).length;
    const recentTotal = recentResults.length;
    const currentRate = recentTotal > 0 ? recentCorrect / recentTotal : 0.5;
    
    const qDiff = questionDifficulty(q, wrongCounts, mastery);
    
    // If doing well → prefer harder; if struggling → prefer easier
    if (currentRate > 0.7 && qDiff >= 2) priority += 1;
    if (currentRate < 0.5 && qDiff <= 1) priority += 1;

    // Small random factor to prevent repetition
    priority += Math.random() * 0.5;

    return { q, priority, difficulty: qDiff };
  });

  // Sort by priority descending, take top N
  scored.sort((a, b) => b.priority - a.priority);
  return scored.slice(0, count).map(s => s.q);
}

/**
 * During a session, pick the next question adaptively based on running performance
 */
export function getNextAdaptiveQuestion(remaining, sessionResults) {
  if (remaining.length === 0) return null;
  if (remaining.length === 1) return { question: remaining[0], index: 0 };

  const correct = sessionResults.filter(r => r.correct).length;
  const total = sessionResults.length;
  const rate = total > 0 ? correct / total : 0.5;

  // Score remaining questions
  const scored = remaining.map((q, i) => {
    let score = 0;
    const diff = q._difficulty || 2;

    // Performance-based selection
    if (rate > 0.75) {
      // Doing great → prefer harder
      score += diff * 2;
    } else if (rate < 0.45) {
      // Struggling → prefer easier
      score += (4 - diff) * 2;
    } else {
      // Balanced → mix
      score += Math.random() * 3;
    }

    // Haven't seen this topic recently → boost
    const recentTopics = sessionResults.slice(-3).map(r => r.subjectId);
    if (!recentTopics.includes(q.subjectId)) score += 1;

    return { q, i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pick = scored[0];
  return { question: pick.q, index: pick.i };
}

/**
 * Calculate performance analytics from session results
 */
export function calculateSessionAnalytics(results, questions, durationSec) {
  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Topic breakdown
  const topicMap = {};
  results.forEach((r, i) => {
    const q = questions[i];
    const topic = q?.subjectId || q?.topic || "unknown";
    if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0, label: q?.subjectLabel || topic };
    topicMap[topic].total++;
    if (r.correct) topicMap[topic].correct++;
  });

  const topicBreakdown = Object.entries(topicMap).map(([id, data]) => ({
    id,
    label: data.label,
    correct: data.correct,
    total: data.total,
    pct: Math.round((data.correct / data.total) * 100),
  })).sort((a, b) => a.pct - b.pct); // Weakest first

  // Time per question
  const avgTimePerQ = total > 0 ? Math.round(durationSec / total) : 0;

  // Longest streak of correct answers
  let maxStreak = 0, currentStreak = 0;
  results.forEach(r => {
    if (r.correct) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); }
    else currentStreak = 0;
  });

  // Difficulty analysis
  const easyQ = results.filter((r, i) => (questions[i]?._difficulty || 2) === 1);
  const hardQ = results.filter((r, i) => (questions[i]?._difficulty || 2) === 3);

  return {
    score: correct,
    total,
    percentage: pct,
    duration: durationSec,
    avgTimePerQuestion: avgTimePerQ,
    topicBreakdown,
    longestStreak: maxStreak,
    easyAccuracy: easyQ.length > 0 ? Math.round((easyQ.filter(r => r.correct).length / easyQ.length) * 100) : null,
    hardAccuracy: hardQ.length > 0 ? Math.round((hardQ.filter(r => r.correct).length / hardQ.length) * 100) : null,
    weakTopics: topicBreakdown.filter(t => t.pct < 60),
    strongTopics: topicBreakdown.filter(t => t.pct >= 80),
  };
}

/**
 * Generate AI study tips prompt based on session performance
 */
export function generateTipsPrompt(analytics, subjectLabel) {
  const weakTopicsList = analytics.weakTopics.map(t => t.label).join(", ");
  const strongTopicsList = analytics.strongTopics.map(t => t.label).join(", ");
  
  return `A student just completed a ${subjectLabel} practice session.
Score: ${analytics.score}/${analytics.total} (${analytics.percentage}%)
Average time per question: ${analytics.avgTimePerQuestion}s
Longest correct streak: ${analytics.longestStreak}
${weakTopicsList ? `Weak areas: ${weakTopicsList}` : ""}
${strongTopicsList ? `Strong areas: ${strongTopicsList}` : ""}

Give 3-4 brief, specific study tips (1-2 sentences each) to help them improve. Focus on:
1. Their weak topics
2. Study strategies for their performance level
3. Time management if they're too slow/fast

Format as a JSON array of strings: ["tip1", "tip2", "tip3"]`;
}
