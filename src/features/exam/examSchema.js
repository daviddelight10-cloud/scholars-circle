/**
 * Exam schema — question types, normalization, objective grading, scoring.
 * An exam is a JSON payload stored in Resource.mcqData with contentType "exam":
 * { version, kind:"exam", config, analysis, questions[] }
 */

export const QUESTION_TYPES = {
  mcq: { label: "Multiple choice", icon: "◉", objective: true, defaultMarks: 1 },
  truefalse: { label: "True / False", icon: "⚖", objective: true, defaultMarks: 1 },
  fillblank: { label: "Fill in the blank", icon: "✎", objective: true, defaultMarks: 1 },
  shortanswer: { label: "Short answer", icon: "≡", objective: false, defaultMarks: 5 },
  essay: { label: "Theory / Essay", icon: "📝", objective: false, defaultMarks: 10 },
};

export const ALL_TYPES = Object.keys(QUESTION_TYPES);
export const OBJECTIVE_TYPES = ALL_TYPES.filter((t) => QUESTION_TYPES[t].objective);
export const WRITTEN_TYPES = ALL_TYPES.filter((t) => !QUESTION_TYPES[t].objective);

export const EXAM_VERSION = 1;
export const MIN_TIME_MIN = 5;
export const MAX_TIME_MIN = 180;

export function isObjectiveType(type) {
  return !!QUESTION_TYPES[type]?.objective;
}

export function isWrittenType(type) {
  return QUESTION_TYPES[type] ? !QUESTION_TYPES[type].objective : false;
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle an mcq question's options and remap the correct letter. */
export function shuffleMcqOptions(q) {
  if (!q?.options || typeof q.options !== "object") return q;
  const entries = Object.entries(q.options);
  const shuffled = shuffleArray(entries);
  const newOptions = {};
  const remap = {};
  shuffled.forEach(([origKey, val], i) => {
    const newKey = String.fromCharCode(65 + i);
    newOptions[newKey] = val;
    remap[origKey] = newKey;
  });
  return { ...q, options: newOptions, correct: remap[q.correct] || q.correct };
}

function normText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[.,;:!?"'()\-–—/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a raw AI-produced question into the canonical shape, or null if invalid. */
export function normalizeQuestion(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const type = ALL_TYPES.includes(raw.type) ? raw.type : null;
  const question = String(raw.question || "").trim();
  if (!type || !question) return null;

  const q = {
    id: raw.id || `q${index + 1}`,
    type,
    question,
    marks: Number.isFinite(raw.marks) && raw.marks > 0 ? raw.marks : QUESTION_TYPES[type].defaultMarks,
    explanation: String(raw.explanation || "").trim() || null,
    topic: String(raw.topic || "").trim() || null,
  };

  if (type === "mcq") {
    let opts = raw.options;
    let options = null;
    if (Array.isArray(opts)) {
      options = {};
      opts.slice(0, 4).forEach((v, i) => {
        options[String.fromCharCode(65 + i)] = String(v ?? "");
      });
    } else if (opts && typeof opts === "object") {
      options = {};
      for (const k of ["A", "B", "C", "D"]) options[k] = String(opts[k] ?? "");
    }
    if (!options || Object.values(options).filter((v) => v.trim()).length < 2) return null;
    let correct = raw.correct;
    if (typeof correct === "number") correct = String.fromCharCode(65 + correct);
    correct = String(correct || "").trim().toUpperCase().charAt(0);
    if (!options[correct]) return null;
    return { ...q, options, correct };
  }

  if (type === "truefalse") {
    let correct = raw.correct;
    if (typeof correct === "string") {
      const s = correct.trim().toLowerCase();
      correct = s === "true" || s === "a" || s === "yes";
    }
    if (typeof correct !== "boolean") return null;
    return { ...q, correct };
  }

  if (type === "fillblank") {
    const answers = [];
    if (Array.isArray(raw.acceptableAnswers)) answers.push(...raw.acceptableAnswers);
    if (raw.answer) answers.unshift(raw.answer);
    if (raw.correct && typeof raw.correct === "string") answers.unshift(raw.correct);
    const acceptableAnswers = [...new Set(answers.map((a) => String(a).trim()).filter(Boolean))];
    if (acceptableAnswers.length === 0) return null;
    return { ...q, acceptableAnswers };
  }

  // shortanswer / essay — written, AI-graded
  const modelAnswer = String(raw.modelAnswer || raw.answer || "").trim();
  if (!modelAnswer) return null;
  let markingScheme = raw.markingScheme;
  if (Array.isArray(markingScheme)) {
    markingScheme = markingScheme
      .map((p) => (typeof p === "string" ? p : p?.point || p?.criterion || ""))
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (typeof markingScheme === "string" && markingScheme.trim()) {
    markingScheme = markingScheme.split(/\n|•|;|\|/).map((s) => s.trim()).filter(Boolean);
  } else {
    markingScheme = null;
  }
  return { ...q, modelAnswer, markingScheme };
}

/**
 * Normalize a full exam payload (as stored in mcqData).
 * Returns { version, kind:"exam", config, analysis, questions } or null.
 */
export function normalizeExamPayload(raw) {
  if (!raw || typeof raw !== "object" || raw.kind !== "exam") return null;
  if (!Array.isArray(raw.questions)) return null;
  const questions = raw.questions
    .map((q, i) => normalizeQuestion(q, i))
    .filter(Boolean);
  if (questions.length === 0) return null;
  const config = raw.config && typeof raw.config === "object" ? raw.config : {};
  return {
    version: raw.version || EXAM_VERSION,
    kind: "exam",
    config: {
      name: String(config.name || "Exam"),
      timeLimitMin: Number.isFinite(config.timeLimitMin) ? config.timeLimitMin : 0,
      mode: config.mode === "practice" ? "practice" : "exam",
      shuffleQuestions: config.shuffleQuestions !== false,
      shuffleOptions: config.shuffleOptions !== false,
      passMarkPct: Number.isFinite(config.passMarkPct) ? config.passMarkPct : 50,
      types: Array.isArray(config.types) ? config.types.filter((t) => ALL_TYPES.includes(t)) : ALL_TYPES,
    },
    analysis: raw.analysis && typeof raw.analysis === "object" ? raw.analysis : null,
    questions,
  };
}

export function countByType(questions) {
  const out = {};
  for (const q of questions || []) out[q.type] = (out[q.type] || 0) + 1;
  return out;
}

export function totalMarks(questions) {
  return (questions || []).reduce((s, q) => s + (q.marks || 1), 0);
}

/**
 * Grade an objective question (mcq / truefalse / fillblank) client-side.
 * Returns { correct, marksAwarded, maxMarks }. Written types return null.
 */
export function gradeObjectiveAnswer(q, userAnswer) {
  if (!q || !isObjectiveType(q.type)) return null;
  const maxMarks = q.marks || 1;

  if (userAnswer === undefined || userAnswer === null || userAnswer === "") {
    return { correct: false, marksAwarded: 0, maxMarks, blank: true };
  }

  if (q.type === "mcq") {
    const correct = String(userAnswer).trim().toUpperCase() === q.correct;
    return { correct, marksAwarded: correct ? maxMarks : 0, maxMarks };
  }
  if (q.type === "truefalse") {
    const correct = userAnswer === q.correct || String(userAnswer) === String(q.correct);
    return { correct, marksAwarded: correct ? maxMarks : 0, maxMarks };
  }
  if (q.type === "fillblank") {
    const given = normText(userAnswer);
    const correct = (q.acceptableAnswers || []).some((a) => {
      const want = normText(a);
      return want && (given === want || given.includes(want) || want.includes(given));
    });
    return { correct, marksAwarded: correct ? maxMarks : 0, maxMarks };
  }
  return null;
}

/** Default time estimate in minutes for a set of questions. */
export function suggestTimeLimit(questions) {
  let secs = 0;
  for (const q of questions || []) {
    secs += q.type === "essay" ? 600 : q.type === "shortanswer" ? 240 : 75;
  }
  return Math.max(MIN_TIME_MIN, Math.round(secs / 60));
}

// ── In-progress session persistence (localStorage resume) ──────────────────

const sessionKey = (examId) => `sc_exam_session_${examId}`;

export function saveExamSession(examId, state) {
  try {
    localStorage.setItem(sessionKey(examId), JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {}
}

export function loadExamSession(examId) {
  try {
    const raw = localStorage.getItem(sessionKey(examId));
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Stale after 24h — the timer can't be trusted anyway
    if (!s || Date.now() - (s.savedAt || 0) > 24 * 3600 * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearExamSession(examId) {
  try {
    localStorage.removeItem(sessionKey(examId));
  } catch {}
}
