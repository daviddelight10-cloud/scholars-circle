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

// ─── Research Hub (document library) ─────────────────────────────────────────

export function authHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {};
  } catch {
    return {};
  }
}

const DOC_INTENT = /\b(notes?|pdfs?|docs?|documents?|materials?|handouts?|slides?|past.?questions?|textbook|read|summari[sz]e|open|show me|fetch|find|explain .*(doc|pdf|note|file))\b/i;

export function hasDocIntent(text) {
  return DOC_INTENT.test(text || "");
}

// Score a resource against a free-text reference — title, subject, courseCode
function scoreResource(needle, r) {
  if (!needle) return 0;
  const fields = [
    scoreSubject(needle, { label: r.title }),
    scoreSubject(needle, { label: r.subject }),
    scoreSubject(needle, { label: r.courseCode }),
  ];
  let best = Math.max(...fields);
  // tag hits
  const nq = norm(needle);
  for (const t of r.tags || []) {
    if (nq.includes(norm(t)) || norm(t).includes(nq)) best = Math.max(best, 55);
  }
  return best;
}

export function findResources(ref, resources, limit = 5) {
  if (!ref || !resources?.length) return [];
  return resources
    .map(r => ({ r, s: scoreResource(ref, r) }))
    .filter(x => x.s >= 30)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.r);
}

/**
 * Ranked keyword search over Research Hub documents.
 * Used to pre-resolve a document the student is asking about.
 */
export function searchDocuments(query, resources, limit = 5) {
  if (!resources?.length || !query) return [];
  const words = tokens(query).filter(w => w.length > 2);
  if (!words.length) return [];
  return resources
    .map(r => {
      const hay = norm(`${r.title || ""} ${r.subject || ""} ${r.courseCode || ""} ${(r.tags || []).join(" ")} ${r.description || ""}`);
      let s = 0;
      for (const w of words) if (hay.includes(w)) s += 1;
      return { r, s };
    })
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.r);
}

const CONTENT_TYPE_META = {
  pdf: { tag: "PDF", icon: "📄" },
  docx: { tag: "DOCX", icon: "📝" },
  pptx: { tag: "PPT", icon: "📊" },
  txt: { tag: "Text", icon: "📃" },
  image: { tag: "Image", icon: "🖼" },
  note: { tag: "Note", icon: "📝" },
  mcq: { tag: "MCQ set", icon: "✎" },
  flashcard_deck: { tag: "Flashcards", icon: "🎴" },
  tutorial_question: { tag: "Tutorial Qs", icon: "❓" },
};

export function docTypeMeta(contentType) {
  return CONTENT_TYPE_META[contentType] || { tag: contentType || "Doc", icon: "�" };
}

/**
 * Compact Research Hub catalog injected into the prompt so the model knows
 * which real documents exist and can cite exact titles.
 */
export function buildDocCatalog(resources, { limit = 80, prefer = "" } = {}) {
  if (!resources?.length) return "";
  const pref = norm(prefer);
  const scored = resources.map(r => {
    let s = 0;
    if (pref && norm(`${r.subject || ""} ${r.courseCode || ""} ${r.title || ""}`).includes(pref)) s = 1;
    return { r, s };
  });
  scored.sort((a, b) => b.s - a.s || new Date(b.r.createdAt || 0) - new Date(a.r.createdAt || 0));
  const lines = scored.slice(0, limit).map(({ r }) => {
    const meta = docTypeMeta(r.contentType);
    const bits = [meta.tag];
    if (r.contentType === "mcq" && Array.isArray(r.mcqData)) bits.push(`${r.mcqData.length} questions`);
    if (r.subject) bits.push(r.subject);
    if (r.courseCode) bits.push(r.courseCode);
    return `- "${r.title}" [${bits.join(" · ")}]`;
  });
  return `## Scholar's Circle Research Hub (REAL documents — cite exact titles)\n${lines.join("\n")}`;
}

// ─── MCQ resource practice ───────────────────────────────────────────────────

// Adapt a Research Hub mcqData item to the {q, options[], answer} shape used
// by PracticeView / ExamSimulator.
function mcqToBank(item) {
  if (!item || typeof item !== "object") return null;
  const opts = item.options;
  let options;
  let answer;
  if (Array.isArray(opts)) {
    options = opts;
    answer = typeof item.correct === "number" ? item.correct : 0;
  } else if (opts && typeof opts === "object") {
    const keys = Object.keys(opts).sort();
    options = keys.map(k => opts[k]);
    const ci = keys.indexOf(String(item.correct || "A").toUpperCase());
    answer = ci >= 0 ? ci : 0;
  } else {
    return null;
  }
  const q = item.question || item.q || "";
  if (!q || options.length < 2) return null;
  return { q, options, answer, explanation: item.explanation || item.explain || "", topic: item.topic };
}

/**
 * Resolve a practice request against MCQ resources in Research Hub.
 * @returns {null | {resource, subjectLabel, subjectIcon, topic, questions, total}}
 */
export function resolveMcqPractice(req, resources) {
  if (!resources?.length) return null;
  const mcqs = resources.filter(r => r.contentType === "mcq" && Array.isArray(r.mcqData) && r.mcqData.length);
  if (!mcqs.length) return null;

  const subjectRef = req?.subject || "";
  const topicRef = req?.topic || "";
  const needle = subjectRef || topicRef;

  let candidates = mcqs;
  if (needle) {
    const matched = mcqs
      .map(r => ({ r, s: scoreResource(needle, r) }))
      .filter(x => x.s >= 30)
      .sort((a, b) => b.s - a.s);
    if (matched.length) candidates = matched.map(x => x.r);
  }

  // Pick the best single resource (largest matching pool)
  const best = candidates
    .map(r => {
      let questions = r.mcqData.map(mcqToBank).filter(Boolean);
      if (topicRef && questions.some(q => q.topic)) {
        const tw = tokens(topicRef);
        const hit = questions.filter(q => tw.some(w => norm(q.topic || "").includes(w)));
        if (hit.length) questions = hit;
      }
      return { r, questions };
    })
    .filter(x => x.questions.length)
    .sort((a, b) => b.questions.length - a.questions.length)[0];

  if (!best) return null;
  return {
    resource: best.r,
    subject: { id: best.r.id, label: best.r.title, icon: "✎" },
    subjectId: best.r.id,
    subjectLabel: best.r.title,
    subjectIcon: "✎",
    topic: topicRef || best.r.subject || null,
    questions: best.questions,
    total: best.questions.length,
  };
}

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

const APP_FEATURES = `Scholar's Circle app features (answer "how do I…" questions with these):
- Research Hub: the student's document library — PDFs, notes, MCQ sets, tutorial questions, flashcard decks. You can cite documents from the list below and the student can open them directly.
- Practice tab: MCQ practice + timed Exam Simulator (quick practice, survival, cascade modes)
- Flashcards: decks + spaced repetition (FSRS) review
- Guided Study (📚 button here): roadmap → explain → questions → flashcards on any topic
- Voice Tutor: hands-free spoken lessons
- Study Groups & Live Sessions: real-time quiz battles with classmates
- Clinical tools: clinical cases, OSCE practice, drug reference, lab values, medical calculators
- Gamification: XP, streaks, leagues/leaderboard, badges
- This AI chat: attachments (+ button), voice input (mic), practice questions pulled from real MCQ sets, and Research Hub documents`;

export { APP_FEATURES };
