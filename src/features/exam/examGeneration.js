import { callAI, callAIMultimodal, extractJSON } from "../../lib/aiClient";
import { chunkText } from "../../lib/extractFileText";
import { countExistingMcqs } from "../../lib/generationCore";
import { normalizeQuestion, normalizeExamPayload, ALL_TYPES, EXAM_VERSION } from "./examSchema";

const AI_MODEL = { provider: "openrouter", model: "z-ai/glm-5.3-flash" };
const CONCURRENCY_LIMIT = 3;
const MIN_CHUNK_SIZE = 5000;
const MAX_CHUNKS = 20;
const QUESTIONS_PER_CHUNK = 25;
const MAX_QUESTIONS = 200;

const TYPE_DESCRIPTIONS = {
  mcq: `"mcq" — multiple choice with options {"A","B","C","D"} and "correct" letter`,
  truefalse: `"truefalse" — statement with "correct": true or false`,
  fillblank: `"fillblank" — sentence with a ____ blank and "acceptableAnswers": [valid answers]`,
  shortanswer: `"shortanswer" — brief written answer; include "modelAnswer" and "markingScheme" (array of grading points)`,
  essay: `"essay" — theory/structured written question; include "modelAnswer" and "markingScheme" (array of grading points)`,
};

/**
 * Detect whether free-text looks like an existing written/theory question paper
 * (numbered prompts WITHOUT A–D options, "explain/describe/discuss" verbs,
 * mark allocations like "(10 marks)"). Returns an estimated count or 0.
 */
function countWrittenQuestions(text) {
  if (!text || text.trim().length < 100) return 0;
  const stemRe = /^\s*(?:\d+[).:]\s+\S|Q\d+[).:]?\s+\S|Question\s*\d+[).:]?\s+\S)/gim;
  const stems = text.match(stemRe) || [];
  const verbRe = /\b(explain|describe|discuss|outline|compare|contrast|evaluate|define|state|list|analy[sz]e|justify|elaborate|sketch|derive|prove)\b/gi;
  const verbs = text.match(verbRe) || [];
  const marksRe = /\(?\s*\d+\s*(?:marks?|points?|pts?)\s*\)?/gi;
  const marks = text.match(marksRe) || [];
  // Written papers have numbered prompts + either directive verbs or mark allocations
  const estimated = stems.length;
  const signals = verbs.length + marks.length;
  return estimated >= 3 && signals >= estimated ? estimated : 0;
}

function buildAnalysisPrompt(sample) {
  return `You are an exam-format analyzer. Look at this document sample and describe what it contains.

"""
${sample}
"""

Return ONLY a JSON object:
{
  "docType": "question_bank" | "study_material" | "mixed",
  "detectedTypes": [<subset of "mcq","truefalse","fillblank","shortanswer","essay">],
  "language": "<ISO language code, e.g. "en", "de">",
  "estimatedQuestions": <number of questions already present in the document, 0 if none>,
  "topics": ["<up to 6 topic names covered>"],
  "summary": "<one line describing the document>"
}

Rules:
- "question_bank" = the document IS a list of exam questions to be answered
- "study_material" = notes/textbook content with no questions — questions must be authored from it
- "mixed" = contains both questions and study content
- detectedTypes = the QUESTION formats actually present. Theory/structured questions with no answer options = "essay"; one-line written responses = "shortanswer"; prompts like "____ is..." = "fillblank"; true/false items = "truefalse".`;
}

/**
 * Analyze a document's content/format so the builder can show what the AI found.
 * Combines cheap heuristics with one AI classification call on a text sample.
 * @returns {Promise<{docType, detectedTypes[], language, estimatedQuestions, topics[], summary, hasExistingMcqs}>}
 */
export async function analyzeDocument(text, images = []) {
  const mcqCount = countExistingMcqs(text);
  const writtenCount = countWrittenQuestions(text);
  const heuristicTypes = [];
  if (mcqCount >= 5) heuristicTypes.push("mcq");
  if (writtenCount >= 3) heuristicTypes.push("essay");

  // Fast path: no AI call needed when heuristics already agree it's a pure MCQ bank
  if (mcqCount >= 5 && writtenCount < 3 && !images.length) {
    return {
      docType: "question_bank",
      detectedTypes: ["mcq"],
      language: "en",
      estimatedQuestions: mcqCount,
      topics: [],
      summary: `Question bank detected — ~${mcqCount} multiple-choice questions.`,
      hasExistingMcqs: true,
    };
  }

  const sample = [
    text.slice(0, 5000),
    text.length > 12000 ? "\n\n…\n\n" + text.slice(Math.floor(text.length / 2), Math.floor(text.length / 2) + 3000) : "",
  ].join("");

  if (!sample.trim() && images.length > 0) {
    const raw = await callAIMultimodal(
      buildAnalysisPrompt("The images contain a document. Analyze what is visible."),
      images,
      [],
      AI_MODEL
    );
    try {
      const parsed = extractJSON(raw, "object");
      return sanitizeAnalysis(parsed, heuristicTypes, mcqCount, writtenCount);
    } catch {
      return defaultAnalysis(heuristicTypes, mcqCount, writtenCount);
    }
  }

  try {
    const raw = await callAI(buildAnalysisPrompt(sample), AI_MODEL);
    const parsed = extractJSON(raw, "object");
    return sanitizeAnalysis(parsed, heuristicTypes, mcqCount, writtenCount);
  } catch {
    return defaultAnalysis(heuristicTypes, mcqCount, writtenCount);
  }
}

function defaultAnalysis(heuristicTypes, mcqCount, writtenCount) {
  const estimated = Math.max(mcqCount, writtenCount);
  return {
    docType: heuristicTypes.length ? (heuristicTypes.length > 1 ? "mixed" : "question_bank") : "study_material",
    detectedTypes: heuristicTypes.length ? heuristicTypes : ["mcq"],
    language: "en",
    estimatedQuestions: estimated,
    topics: [],
    summary: estimated ? `Found ~${estimated} existing questions.` : "Study material — the AI will author questions from it.",
    hasExistingMcqs: mcqCount >= 5,
  };
}

function sanitizeAnalysis(parsed, heuristicTypes, mcqCount, writtenCount) {
  const base = defaultAnalysis(heuristicTypes, mcqCount, writtenCount);
  if (!parsed || typeof parsed !== "object") return base;
  const detected = Array.isArray(parsed.detectedTypes)
    ? [...new Set(parsed.detectedTypes.filter((t) => ALL_TYPES.includes(t)))]
    : base.detectedTypes;
  // Union with heuristic detections so regex-found questions are never dropped
  for (const t of heuristicTypes) if (!detected.includes(t)) detected.push(t);
  return {
    docType: ["question_bank", "study_material", "mixed"].includes(parsed.docType) ? parsed.docType : base.docType,
    detectedTypes: detected.length ? detected : base.detectedTypes,
    language: typeof parsed.language === "string" && parsed.language ? parsed.language : base.language,
    estimatedQuestions: Math.max(Number(parsed.estimatedQuestions) || 0, base.estimatedQuestions),
    topics: Array.isArray(parsed.topics) ? parsed.topics.map(String).slice(0, 6) : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : base.summary,
    hasExistingMcqs: mcqCount >= 5 || detected.includes("mcq") && base.docType === "question_bank",
  };
}

function buildQuestionsPrompt(text, { types, count, extractMode, language }) {
  const typeList = types.map((t) => TYPE_DESCRIPTIONS[t]).filter(Boolean).join("\n  ");
  const langNote = language && language !== "en" ? `\nWrite all questions and answers in the SAME language as the document (${language}).` : "";

  if (extractMode) {
    return `You are an expert exam question extractor. Extract ALL questions that already exist in this content — preserving each question's original format. Do NOT invent new questions.${langNote}

"""
${text}
"""

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.
2. If no questions are found in this section, return an empty array [].
3. Keep each question's original wording. Supported "type" values:
  ${typeList}
4. Every question needs "marks" (use the document's mark allocation if shown, else 1 for objective types, 5 for shortanswer, 10 for essay).
5. For written questions (shortanswer/essay): if the document includes an answer key or marking scheme use it for "modelAnswer"/"markingScheme"; otherwise write a concise model answer and marking scheme yourself.

Format:
[
  {"type":"mcq","question":"...","options":{"A":"..","B":"..","C":"..","D":".."},"correct":"A","explanation":"..","marks":1},
  {"type":"essay","question":"...","modelAnswer":"...","markingScheme":["point 1","point 2"],"marks":10}
]`;
  }

  return `You are an expert exam author for university students. Write exactly ${count} exam questions based on this content:${langNote}

"""
${text}
"""

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.
2. Write exactly ${count} questions spread across these formats (proportionate to the list):
  ${typeList}
3. MCQs need 4 options A–D and a "correct" letter. Fillblank questions must include the blank as ____ in the question text plus "acceptableAnswers".
4. Written questions (shortanswer/essay) need a strong "modelAnswer" and a "markingScheme" array — each element one gradable point.
5. Every question gets "marks": 1 for mcq/truefalse/fillblank, 5 for shortanswer, 10 for essay.
6. Test understanding and application; cover the breadth of the content; no repeats.

Format:
[
  {"type":"mcq","question":"...","options":{"A":"..","B":"..","C":"..","D":".."},"correct":"A","explanation":"..","marks":1},
  {"type":"truefalse","question":"...","correct":true,"explanation":"..","marks":1},
  {"type":"fillblank","question":"... ____ ...","acceptableAnswers":["..."],"explanation":"..","marks":1},
  {"type":"shortanswer","question":"...","modelAnswer":"...","markingScheme":["point"],"marks":5},
  {"type":"essay","question":"...","modelAnswer":"...","markingScheme":["point 1","point 2"],"marks":10}
]`;
}

/**
 * Generate or extract a full exam (mixed question types) from document text/images.
 * @param {string} text
 * @param {string[]} images
 * @param {object} config — { types[], questionCount, name, mode, timeLimitMin, shuffleQuestions, shuffleOptions, passMarkPct }
 * @param {object} analysis — result of analyzeDocument
 * @param {function} onProgress
 * @returns {Promise<{payload, warnings[]}>}
 */
export async function generateExam(text, images, config, analysis, onProgress) {
  const warnings = [];
  const types = (config.types || []).filter((t) => ALL_TYPES.includes(t));
  if (!types.length) throw new Error("Pick at least one question type.");

  const docHasQuestions = analysis?.docType === "question_bank" || analysis?.docType === "mixed";
  const detected = analysis?.detectedTypes || [];
  // Extraction preserves the document's real questions; only extract the types
  // the document actually contains and the user asked for.
  const extractable = types.filter((t) => detected.includes(t));
  const extractMode = docHasQuestions && extractable.length > 0;
  const effectiveTypes = extractMode ? extractable : types;

  // Image-only path
  if ((!text || text.length < 50) && images.length > 0) {
    onProgress?.(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
    const prompt = buildQuestionsPrompt("The images contain a document.", {
      types: effectiveTypes,
      count: config.questionCount || 20,
      extractMode,
      language: analysis?.language,
    });
    const raw = await callAIMultimodal(prompt, images, [], AI_MODEL);
    const questions = mapQuestions(extractJSON(raw, "array"));
    if (!questions.length) throw new Error("AI didn't produce valid questions. Try again.");
    return { payload: buildPayload(questions, config, analysis), warnings };
  }

  if (!text?.trim()) throw new Error("No text could be extracted from this material.");

  // Chunking — same approach as generateMcqs
  const targetCount = extractMode
    ? Math.min(analysis?.estimatedQuestions || 60, MAX_QUESTIONS)
    : Math.min(config.questionCount || 20, MAX_QUESTIONS);
  const textBasedChunks = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(text.length / MIN_CHUNK_SIZE)));
  const countBasedChunks = extractMode ? Math.min(MAX_CHUNKS, Math.ceil(targetCount / 15)) : Math.min(MAX_CHUNKS, Math.ceil(targetCount / QUESTIONS_PER_CHUNK));
  const desiredChunks = Math.max(textBasedChunks, countBasedChunks);
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / desiredChunks));
  const chunks = chunkText(text, chunkSize);
  const perChunk = Math.max(4, Math.ceil(targetCount / chunks.length));

  onProgress?.(
    extractMode
      ? `Extracting questions from ${chunks.length} section${chunks.length > 1 ? "s" : ""}…`
      : `Building ${targetCount} questions from ${chunks.length} section${chunks.length > 1 ? "s" : ""}…`
  );

  const allRows = [];
  for (let start = 0; start < chunks.length; start += CONCURRENCY_LIMIT) {
    const batch = [];
    for (let i = start; i < Math.min(start + CONCURRENCY_LIMIT, chunks.length); i++) {
      const prompt = buildQuestionsPrompt(chunks[i], {
        types: effectiveTypes,
        count: Math.min(QUESTIONS_PER_CHUNK, perChunk),
        extractMode,
        language: analysis?.language,
      });
      batch.push(
        callAI(prompt, AI_MODEL)
          .then((raw) => {
            try {
              return mapQuestions(extractJSON(raw, "array"));
            } catch {
              return [];
            }
          })
          .catch(() => [])
      );
    }
    const results = await Promise.all(batch);
    for (const r of results) allRows.push(...r);
    onProgress?.(`Building questions… ${Math.min(allRows.length, targetCount)}/${extractMode ? "?" : targetCount}`);
  }

  let questions = dedupeQuestions(allRows);
  if (!extractMode) questions = questions.slice(0, targetCount);
  else questions = questions.slice(0, MAX_QUESTIONS);

  // In extraction mode some detected-but-unselected types may still slip in — filter to selected
  questions = questions.filter((q) => types.includes(q.type));

  if (!questions.length) {
    if (extractMode) warnings.push("AI found fewer extractable questions than expected — try generating instead.");
    throw new Error("AI couldn't produce questions from this content. Try a different file or mode.");
  }
  if (!extractMode && questions.length < targetCount * 0.5) {
    warnings.push(`Only ${questions.length} of ${targetCount} requested questions could be generated.`);
  }

  return { payload: buildPayload(questions, config, analysis), warnings };
}

function mapQuestions(parsed) {
  const arr = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(arr)) return [];
  return arr.map((q, i) => normalizeQuestion(q, i)).filter(Boolean);
}

function dedupeQuestions(questions) {
  const seen = new Set();
  return questions.filter((q) => {
    const key = q.question.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPayload(questions, config, analysis) {
  const payload = {
    version: EXAM_VERSION,
    kind: "exam",
    config: {
      name: config.name || "Exam",
      timeLimitMin: config.timeLimitMin ?? 0,
      mode: config.mode === "practice" ? "practice" : "exam",
      shuffleQuestions: config.shuffleQuestions !== false,
      shuffleOptions: config.shuffleOptions !== false,
      passMarkPct: config.passMarkPct ?? 50,
      types: [...new Set(questions.map((q) => q.type))],
    },
    analysis: analysis
      ? {
          docType: analysis.docType,
          detectedTypes: analysis.detectedTypes,
          language: analysis.language,
          summary: analysis.summary,
        }
      : null,
    questions,
  };
  // Ensure it's round-trippable through normalize
  return normalizeExamPayload(payload) || payload;
}
