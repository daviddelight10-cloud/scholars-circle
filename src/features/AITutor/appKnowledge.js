// App knowledge + question-bank retrieval for the AI tutor.
// Gives the model a catalog of app features and real subject/question data,
// and resolves "pull me practice questions" requests against the actual bank.

// ─── Normalization ───────────────────────────────────────────────────────────

// "BIO-111" -> "bio111", "Cell & Molecular Bio!" -> "cell molecular bio"
function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Squashed variant for compact codes: "BIO-111" -> "bio111"
function squash(s) {
  return norm(s).replace(/\s+/g, "");
}

function tokens(s) {
  return norm(s).split(/\s+/).filter(w => w.length >= 2);
}

// ─── Subject matching ────────────────────────────────────────────────────────

// Score how well a free-text subject reference matches a real subject.
// Handles "bio111" vs "BIO-111", "biology" vs "BIO-111 · Biology", etc.
function scoreSubject(needle, subject) {
  if (!needle) return 0;
  const nq = norm(needle);
  const ns = squash(needle);
  const label = subject.label || subject.id || "";
  const lq = norm(label);
  const ls = squash(label);

  if (!nq) return 0;
  if (ls === ns || lq === nq) return 100;                       // exact
  if (ls && ns && (ls.includes(ns) || ns.includes(ls))) return 80; // code-ish contains
  // word overlap with prefix stems ("bio" matches "biology")
  const nw = tokens(needle);
  const lw = tokens(label);
  if (!nw.length || !lw.length) return 0;
  const stemHits = nw.filter(w => lw.some(l => l.startsWith(w) || w.startsWith(l))).length;
  return (stemHits / nw.length) * 60;
}

export function findSubject(ref, subjects) {
  if (!ref || !subjects?.length) return null;
  let best = null, bestScore = 0;
  for (const s of subjects) {
    const sc = scoreSubject(ref, s);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  return bestScore >= 30 ? best : null;
}

// ─── Topic matching ──────────────────────────────────────────────────────────

function scoreQuestion(q, topicWords) {
  const hay = norm(`${q.topic || ""} ${q.q || q.question || ""}`);
  return topicWords.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
}

// ─── Practice resolution ─────────────────────────────────────────────────────

/**
 * Resolve a practice request against the real question bank.
 * @param {{subject?: string, topic?: string}} req — labels from the AI (or user text)
 * @param {Array} subjects — merged subject list with .questions
 * @returns {null | {subject, subjectLabel, subjectIcon, topic, questions, total}}
 */
export function resolvePractice(req, subjects) {
  if (!subjects?.length) return null;
  const subjectRef = req?.subject || "";
  const topicRef = req?.topic || "";

  const subject = findSubject(subjectRef, subjects) || findSubject(topicRef, subjects);
  if (!subject) return null;

  const pool = subject.questions || [];
  if (!pool.length) return null;

  let questions = pool;
  let matchedTopic = topicRef || null;

  if (topicRef) {
    const tw = tokens(topicRef);
    if (tw.length) {
      const scored = pool
        .map(q => ({ q, s: scoreQuestion(q, tw) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s);
      if (scored.length) {
        questions = scored.map(x => x.q);
        // Use the canonical topic label if a clear one exists
        const topics = [...new Set(scored.slice(0, 15).map(x => x.q.topic).filter(Boolean))];
        if (topics.length) matchedTopic = topics[0];
      }
    }
  }

  return {
    subject,
    subjectId: subject.id,
    subjectLabel: subject.label,
    subjectIcon: subject.icon || "📚",
    topic: matchedTopic,
    questions,
    total: questions.length,
  };
}

// ─── Keyword fallback search (when the model doesn't flag practice intent) ───

const PRACTICE_INTENT = /\b(questions?|quiz|mcq|practice|practise|past.?questions?|tutorial|exam|test me|test)\b/i;

export function hasPracticeIntent(text) {
  return PRACTICE_INTENT.test(text || "");
}

/**
 * Improved bank search — scores every subject by query overlap on
 * label + topic + question text, then returns the best pool.
 */
export function searchQuestionBank(query, subjects) {
  if (!subjects?.length || !query) return { found: false };
  const words = tokens(query).filter(w => w.length > 2);
  if (!words.length) return { found: false };

  // Try subject-first resolution: any query word that identifies a subject
  const subject = findSubject(query, subjects);

  const candidates = subject ? [subject] : subjects;
  let best = null;

  for (const subj of candidates) {
    const pool = subj.questions || [];
    if (!pool.length) continue;
    const scored = pool.map(q => {
      const hay = norm(`${q.q || q.question || ""} ${q.topic || ""}`);
      let s = 0;
      for (const w of words) if (hay.includes(w)) s += 1;
      return { q, s };
    });
    let hits = scored.filter(x => x.s > 0);

    // If we matched the subject explicitly, its whole pool is fair game
    // even when question text doesn't echo the query words.
    if (subject && hits.length === 0) hits = scored;

    if (hits.length && (!best || hits.length > best.pool.length)) {
      best = { subj, pool: hits.sort((a, b) => b.s - a.s).map(x => x.q) };
    }
  }

  if (best && (best.pool.length >= 2 || subject)) {
    const subj = best.subj;
    const topics = [...new Set(best.pool.map(q => q.topic).filter(Boolean))];
    return {
      found: true,
      questions: best.pool.slice(0, 25),
      subjectLabel: subj.label,
      subjectIcon: subj.icon || "📚",
      topic: topics.length === 1 ? topics[0] : null,
      bankCount: best.pool.length,
      subject,
    };
  }
  return { found: false };
}

// ─── Catalog for the system prompt ───────────────────────────────────────────

const APP_FEATURES = `Scholar's Circle app features (answer "how do I…" questions with these):
- Practice tab: MCQ practice + timed Exam Simulator per subject (quick practice, survival, cascade modes)
- Flashcards: decks + spaced repetition (FSRS) review
- Folders & Resources: shared course materials, PDFs, past questions — read, bookmark, quiz
- Guided Study (📚 button here): roadmap → explain → questions → flashcards on any topic
- Voice Tutor: hands-free spoken lessons
- Learn tab here: YouTube lessons with AI follow-along
- Study Groups & Live Sessions: real-time quiz battles with classmates
- Clinical tools: clinical cases, OSCE practice, drug reference, lab values, medical calculators
- Gamification: XP, streaks, leagues/leaderboard, badges
- This AI chat: attachments (+ button), voice input (mic), practice questions pulled from the real question bank`;

/**
 * Compact catalog injected into the tutor prompt so the model knows the app's
 * subjects, question counts, and topic coverage — and can cite exact labels.
 */
export function buildAppCatalog(subjects, maxTopicsPerSubject = 12) {
  if (!subjects?.length) return "";
  const lines = subjects
    .filter(s => (s.questions || []).length > 0)
    .map(s => {
      const topics = [...new Set((s.questions || []).map(q => q.topic).filter(Boolean))]
        .slice(0, maxTopicsPerSubject);
      const topicStr = topics.length ? ` — topics: ${topics.join(", ")}` : "";
      return `- "${s.label}" (${(s.questions || []).length} questions)${topicStr}`;
    });
  if (!lines.length) return "";
  return `## Scholar's Circle question bank (REAL data — cite exact labels)\n${lines.join("\n")}`;
}

export { APP_FEATURES };
