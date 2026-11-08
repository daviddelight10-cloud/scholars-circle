import { callAI, callAIStream, callAITutor, callAIMultimodal, extractJSON } from "./aiClient";
import { chunkText } from "./extractFileText";
import { createArrayStreamParser } from "./streamJsonArray.js";

// Abort helper — carries the same stoppedByUser flag callAIStream throws, so
// useMaterialGenerate's catch closes the overlay quietly on Stop.
function ensureNotAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("Generation stopped.");
    err.stoppedByUser = true;
    throw err;
  }
}

export const MAX_QUESTIONS = 1000;
export const QUESTIONS_PER_CHUNK = 25;
export const MAX_FLASHCARDS = 50;
export const CONCURRENCY_LIMIT = 3;
export const MAX_CHUNKS = 20;
export const EXTRACT_MAX_CHUNKS = 50;
export const MIN_CHUNK_SIZE = 5000;
// Default target for normal documents scales with length (~1 question per
// 5k chars ≈ 2.5 pages), bounded so small docs still get a useful set and
// huge docs don't produce an unwieldy/expensive bank.
export const DEFAULT_QUESTION_FLOOR = 10;
export const DEFAULT_QUESTION_CAP = 150;
export const AUTO_QUESTION_COUNT = 20;
const CHARS_PER_QUESTION = 5000;
const EXTRACT_RETRY_ROUNDS = 2;

export function buildMcqPrompt(text, questionCount, opts = {}) {
  const { extractMode = false, expectedCount = 0, retryHint = false } = opts;
  if (extractMode) {
    const countHint = expectedCount > 0 ? ` This section contains approximately ${expectedCount} questions — extract ALL of them.` : "";
    const retryText = retryHint ? " A previous pass missed questions — extract EVERY single one, do not stop early." : "";
    return `You are an expert exam MCQ extractor. Extract ALL multiple-choice questions that already exist in this content and format them properly.${countHint}${retryText}

"""
${text}
"""

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.
2. Extract ONLY the questions that already exist in the content — do NOT generate new questions.
3. If no questions are found in this section, return an empty array [].
4. Each extracted question must have exactly 4 options (A, B, C, D) and one correct answer.
5. Preserve the original question text, options, and correct answer as written in the document.
6. Include the explanation only if one is provided in the document; otherwise leave it empty.

Format:
[
  {
    "question": "Question text?",
    "options": {"A":"...","B":"...","C":"...","D":"..."},
    "correct": "A",
    "explanation": "Brief explanation."
  }
]`;
  }

  const { style = "mixed", difficulty = "mixed", realWorld = false, highYield = false, focusTopic = "", rich = false } = opts;
  if (!rich) {
    return `You are an expert exam MCQ generator for university students. Generate exactly ${questionCount} multiple-choice questions based on this content:

"""
${text}
"""

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.
2. Generate exactly ${questionCount} questions — one per topic/concept in the content.
3. Each question must have exactly 4 options (A, B, C, D) and one correct answer.
4. Questions should test understanding and application, not just memorization.
5. Include a brief explanation for each question.
6. Cover the breadth of the content — don't repeat similar questions.

Format:
[
  {
    "question": "Question text?",
    "options": {"A":"...","B":"...","C":"...","D":"..."},
    "correct": "A",
    "explanation": "Brief explanation."
  }
]`;
  }

  const styleRule = {
    recall: "Write direct recall questions: definitions, facts, classifications, key values. One clear stem, no story.",
    applied: "Write applied questions: a 1-2 sentence scenario where the student must apply a concept from the content.",
    vignette: "Write clinical-vignette questions: a short patient case (age, sex, setting, presenting complaint, relevant history/examination/vital signs/investigations WITH units), then a single-best-answer lead-in such as \"What is the most likely diagnosis?\", \"What is the most appropriate next step?\" or \"Which mechanism explains this?\".",
    mixed: "Mix the styles: about 30% direct recall, 40% applied short scenarios, 30% clinical vignettes (age, sex, presentation, key findings with units).",
  }[style] || "";
  const diffRule = {
    easy: "Difficulty: straightforward. Test core must-know facts; distractors clearly belong to the same category but are distinguishable.",
    hard: "Difficulty: hard. Test discrimination between closely related concepts. Every distractor must be a plausible near-miss that a half-prepared student would choose.",
    mixed: "Difficulty: mixed — roughly 30% easy, 45% medium, 25% hard.",
  }[difficulty] || "";
  const extras = [
    realWorld ? "REAL-WORLD FOCUS: prefer real clinical/practical situations — common presentations, red flags, investigation and management decisions, drug choice/dose/adverse effects — over abstract definitions." : "",
    highYield ? "HIGH-YIELD ONLY: prioritise what exams most often test — common conditions, classic presentations, first-line management, key mechanisms. Skip trivia." : "",
    focusTopic ? `FOCUS: concentrate on "${String(focusTopic).slice(0, 120)}" as it appears in the content; ignore unrelated parts.` : "",
  ].filter(Boolean).join("\n");

  return `You are a senior medical-school examiner writing high-quality single-best-answer MCQs. Generate exactly ${questionCount} questions based ONLY on this content:

"""
${text}
"""

STYLE: ${styleRule}
${diffRule}
${extras}

ITEM-WRITING RULES (follow strictly):
1. Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.
2. Exactly 4 options (A, B, C, D), exactly ONE unambiguously best answer that is supported by the content.
3. All options must be the same category and similar length (e.g. all diagnoses, or all drugs). Distractors must be plausible, never silly.
4. Never use "all of the above", "none of the above", "A and B", or absolute words (always/never) as cues. Do not leak the answer in the stem.
5. Do not repeat a question or test the same fact twice. Spread questions across DIFFERENT topics in the content.
6. Use exact terms, doses and values from the content; never invent facts that are not in it.
7. explanation = 2-3 short sentences: why the correct answer is right, then why the most tempting distractor is wrong.
8. Add "topic" (2-4 word subtopic), "difficulty" ("easy"|"medium"|"hard") and "type" ("recall"|"applied"|"vignette").

Format:
[
  {
    "question": "Stem?",
    "options": {"A":"...","B":"...","C":"...","D":"..."},
    "correct": "A",
    "explanation": "Why A is right; why the best distractor is wrong.",
    "topic": "Brachial plexus",
    "difficulty": "medium",
    "type": "applied"
  }
]`;
}

// Is a clinical-vignette/rich prompt enabled for this run?
export function isRichOptions(o) {
  return !!o && (o.style || o.difficulty || o.realWorld || o.highYield || o.focusTopic || o.rich);
}

export function maxSupportedQuestions(chars) {
  return Math.max(10, Math.min(DEFAULT_QUESTION_CAP, Math.round((chars || 0) / 200)));
}

export function autoQuestionCount(chars) {
  return Math.min(AUTO_QUESTION_COUNT, maxSupportedQuestions(chars));
}

// Split `total` questions across chunks in proportion to their length (largest remainder).
export function allocateQuestions(chunks, total) {
  const n = chunks.length;
  if (!n) return [];
  const lens = chunks.map((c) => Math.max(1, c.length));
  const sum = lens.reduce((a, b) => a + b, 0);
  const raw = lens.map((l) => (l / sum) * total);
  const out = raw.map((r) => Math.min(QUESTIONS_PER_CHUNK, Math.floor(r)));
  let left = Math.min(total, n * QUESTIONS_PER_CHUNK) - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && k < order.length * 3; k++) {
    const i = order[k % order.length][1];
    if (out[i] < QUESTIONS_PER_CHUNK) { out[i]++; left--; }
  }
  return out;
}

const POSITIONAL_RE = /\b(all|none) of the above\b|\b(both|either)\b.*\b[A-D]\b|\b[A-D]\s*(and|&|,)\s*[A-D]\b/i;

// LLMs over-pick B/C as the answer. Spread the correct letter evenly by
// permuting options (skipped for questions whose options refer to each other).
export function rebalanceAnswers(rows, rng = Math.random) {
  const L = ["A", "B", "C", "D"];
  const targets = [];
  while (targets.length < rows.length) targets.push(...[...L].sort(() => rng() - 0.5));
  return rows.map((r, i) => {
    const opts = r.options || {};
    if (L.some((k) => !opts[k]) || L.some((k) => POSITIONAL_RE.test(String(opts[k])))) return r;
    const target = targets[i];
    const others = L.filter((k) => k !== r.correct).map((k) => opts[k]).sort(() => rng() - 0.5);
    const next = {};
    let oi = 0;
    for (const k of L) next[k] = k === target ? opts[r.correct] : others[oi++];
    return { ...r, options: next, correct: target };
  });
}

// Second AI pass: check each answer key against the source and drop/fix bad ones.
export async function verifyMcqRows(rows, sourceText, { signal } = {}) {
  if (!rows.length) return rows;
  const list = rows.map((r, i) => `${i}. ${r.question}\nA) ${r.options.A}\nB) ${r.options.B}\nC) ${r.options.C}\nD) ${r.options.D}\nMarked answer: ${r.correct}`).join("\n\n");
  const prompt = `You are a strict examiner. Using ONLY the SOURCE, check each question's marked answer.

SOURCE:
"""
${sourceText.slice(0, 14000)}
"""

QUESTIONS:
${list}

For every question return a verdict: "ok" (marked answer is supported and unambiguous), "fix" (a different option is correct — give it), or "drop" (not answerable from the source, ambiguous, or more than one correct option).
Return ONLY a JSON array: [{"i":0,"verdict":"ok"},{"i":1,"verdict":"fix","correct":"C"},{"i":2,"verdict":"drop"}]`;
  try {
    ensureNotAborted(signal);
    const raw = await callAI(prompt, { provider: "openrouter", model: "z-ai/glm-5.3-flash" });
    const verdicts = extractJSON(raw, "array");
    if (!Array.isArray(verdicts)) return rows;
    const byIdx = new Map(verdicts.map((v) => [Number(v.i), v]));
    const out = [];
    rows.forEach((r, i) => {
      const v = byIdx.get(i);
      if (!v || v.verdict === "ok") return out.push(r);
      if (v.verdict === "fix" && ["A", "B", "C", "D"].includes(String(v.correct).toUpperCase())) return out.push({ ...r, correct: String(v.correct).toUpperCase(), _verified: "fixed" });
    });
    return out.length >= Math.ceil(rows.length / 2) ? out : rows;
  } catch (e) {
    if (e?.stoppedByUser) throw e;
    return rows;
  }
}

export function buildFlashcardPrompt(text, count) {
  return `You are an expert flashcard creator for university students. Generate exactly ${count} flashcards from the text below.

FORMAT — return as a JSON array:
[{"front": "question or prompt", "back": "concise answer"}]

Rules:
- Front should be a clear question, definition prompt, or concept name
- Back should be a concise but complete answer (1-3 sentences)
- Cover the most important concepts from the text
- Return ONLY the JSON array, no markdown or explanation

TEXT:
"""
${text}
"""`;
}

const SUMMARY_FORMAT_CONTRACT = `STRICT FORMAT CONTRACT:
- Start directly with the first "##" section — do NOT add a top-level # title.
- Use "##" for section headings and "###" for sub-headings.
- Use "-" for bullet points and "1. " for numbered lists (always a space after the period).
- Use ** only around important terms inline, e.g. - **Mitosis:** cell division that…
- Markdown tables (| col | col |) are allowed for comparisons/classifications.
- No HTML, no horizontal rules, no code fences. Blockquotes (>) only for the callouts below.
- Keep bullets scannable — one idea each.`;

const SUMMARY_SCAFFOLD = `Choose ONE section scaffold based on the content — YOU decide:

IF the content is medical/clinical (anatomy, physiology, pathology, pharmacology, clinical medicine, nursing, dentistry, public health, biochemistry with clinical relevance):
## Overview & Definition
## Pathophysiology / Mechanism
## Clinical Presentation
## Investigations & Diagnosis
## Management & Treatment   — include a "| Drug | Dose | Notes |" table whenever medications appear
## Complications & Prognosis
## Red Flags & Clinical Pearls
## Likely Exam Questions

For clinical content ONLY, also mark critical items as callout quotes inside the relevant section:
> ⚠️ RED FLAG: <dangerous sign/complication not to miss>
> 💎 PEARL: <high-yield clinical insight>

OTHERWISE (non-medical content):
## Key Concepts
## Definitions
## Formulas & Key Facts
## Worked Examples / Processes
## Likely Exam Questions
## Mnemonics & Memory Aids

Skip a section only if the content genuinely lacks material for it.`;

export function buildSummaryPrompt(text) {
  return `You are an expert academic assistant. Create a comprehensive but concise study summary from the content below.

${SUMMARY_SCAFFOLD}

${SUMMARY_FORMAT_CONTRACT}

CONTENT:
"""
${text}
"""`;
}

export function buildChunkSummaryPrompt(text, index, total) {
  return `You are an expert academic assistant. Below is part ${index} of ${total} of a longer document.
Extract dense study notes from THIS part only — key concepts, definitions, formulas/dates, examples, and anything exam-relevant. Be thorough; nothing important may be dropped.

Format: "-" bullet points with **term**: explanation. No headings, no prose paragraphs, no # titles.

CONTENT (part ${index}/${total}):
"""
${text}
"""`;
}

export function buildMergeSummaryPrompt(notes) {
  return `You are an expert academic assistant. Below are study notes extracted from ALL parts of a document. Merge them into ONE comprehensive, well-organized study summary — deduplicate, group related ideas, and keep every distinct fact.

${SUMMARY_SCAFFOLD}

${SUMMARY_FORMAT_CONTRACT}

NOTES:
"""
${notes}
"""`;
}

/**
 * Heuristic detection of existing MCQs in extracted text.
 * Counts option markers (A), B., (C), D:) and numbered question stems.
 * Stem/question-mark signals only count when real option markers exist —
 * otherwise any numbered list or FAQ false-positives as a question bank.
 * Returns estimated count, or 0 if below confidence threshold.
 */
export function countExistingMcqs(text) {
  if (!text || text.trim().length < 100) return 0;

  // Count option-marker lines: A), B., (C), D:, a), (a), a. etc.
  const optionMarkerRe = /^\s*\(?[A-Da-d][).:]\s+\S/gm;
  const optionMatches = text.match(optionMarkerRe) || [];
  const optionGroups = Math.floor(optionMatches.length / 4);

  // Count numbered question stems: "1.", "1)", "Q1.", "Question 1:", etc.
  // Broader: any numbered line that looks like a question (with or without ?)
  const questionStemRe = /^\s*(?:\d+[).:]\s+\S|Q\d+[).:]?\s+\S|Question\s*\d+[).:]?\s+\S)/gim;
  const questionStems = text.match(questionStemRe) || [];

  // Also count lines ending with ? as potential questions
  const questionMarkRe = /^\s*.+\?\s*$/gm;
  const questionMarkLines = text.match(questionMarkRe) || [];

  const stemSignals = optionGroups > 0
    ? Math.max(questionStems.length, Math.floor(questionMarkLines.length / 2))
    : 0;
  const estimated = Math.max(optionGroups, stemSignals);
  return estimated >= 5 ? estimated : 0;
}

/**
 * Remove duplicate MCQ rows by normalized question text.
 * Keeps first occurrence of each unique question.
 */
export function dedupeMcqs(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.question.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mapAiMcqsToRows(parsed) {
  if (!Array.isArray(parsed)) {
    if (parsed && Array.isArray(parsed.mcq_questions)) parsed = parsed.mcq_questions;
    else return [];
  }
  return parsed
    .filter((q) => q && q.question && q.options && q.correct !== undefined && q.correct !== null)
    .map((q) => {
      const opts = q.options;
      let row;
      if (Array.isArray(opts)) {
        row = {
          question: q.question,
          options: { A: opts[0] || "", B: opts[1] || "", C: opts[2] || "", D: opts[3] || "" },
          correct: typeof q.correct === "number" ? ["A", "B", "C", "D"][q.correct] || "A" : String(q.correct),
          explanation: q.explanation || "",
        };
      } else {
        row = {
          question: q.question,
          options: { A: opts.A || "", B: opts.B || "", C: opts.C || "", D: opts.D || "" },
          correct: typeof q.correct === "number" ? ["A", "B", "C", "D"][q.correct] || "A" : String(q.correct),
          explanation: q.explanation || "",
        };
      }
      row.correct = row.correct.toUpperCase();
      if (q.topic) row.topic = String(q.topic).slice(0, 60);
      if (["easy", "medium", "hard"].includes(String(q.difficulty).toLowerCase())) row.difficulty = String(q.difficulty).toLowerCase();
      if (["recall", "applied", "vignette"].includes(String(q.type).toLowerCase())) row.qtype = String(q.type).toLowerCase();
      return row;
    })
    .filter((r) => r.options.A.trim() && r.options.B.trim() && r.options.C.trim() && r.options.D.trim() && r.question.trim());
}

export function mapAiFlashcards(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((fc) => fc && fc.front && fc.back)
    .map((fc) => ({ front: String(fc.front), back: String(fc.back) }))
    .filter((fc) => fc.front.trim() && fc.back.trim());
}

/**
 * Generate MCQs from extracted text/images.
 * @param {string} text - Extracted text
 * @param {string[]} images - Array of image data URLs
 * @param {function} [onProgress] - Progress callback
 * @param {object} [options] - Optional configuration
 * @param {number|null} [options.customCount] - User-specified question count
 * @param {function} [options.onWarning] - Warning callback
 * @param {function} [options.onRows] - Streams rows in as they're written:
 *   called per question while the AI streams (per chunk on non-streaming
 *   servers). The final returned set stays authoritative — onRows previews.
 * @param {AbortSignal} [options.signal] - Abort in-flight generation.
 * @param {boolean} [options.allowExtract] - Internal: false disables MCQ-bank
 *   extraction mode (used by the extraction→generation fallback).
 * @returns {Promise<{rows: Array, warnings: string[]}>}
 */
export async function generateMcqs(text, images, onProgress, options = {}) {
  const { customCount = null, autoTarget = null, onWarning, onRows, signal, allowExtract = true, verify = false } = options;
  const rich = isRichOptions(options);
  const promptOpts = { style: options.style, difficulty: options.difficulty, realWorld: options.realWorld, highYield: options.highYield, focusTopic: options.focusTopic, rich };
  const mcqTotal = customCount || autoTarget || undefined;
  const warnings = [];
  ensureNotAborted(signal);

  // Image-based: send images to multimodal AI
  if (images.length > 0 && text.length < 50) {
    const imgCount = customCount || Math.min(QUESTIONS_PER_CHUNK, MAX_QUESTIONS);
    onProgress?.(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
    const prompt = buildMcqPrompt("The images contain study material. Generate comprehensive MCQs covering all the content visible.", imgCount, promptOpts);
    const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "z-ai/glm-5.3-flash" });
    const rows = mapAiMcqsToRows(extractJSON(raw, "array"));
    if (rows.length === 0) throw new Error("AI didn't generate valid questions. Try again.");
    return { rows, warnings };
  }

  if (!text.trim()) throw new Error("No text could be extracted from this material.");

  // ── Extraction mode: detect existing MCQs in the document ───────────────
  // When the document already contains MCQs (e.g. a question bank), extract
  // them as-is instead of generating new ones. This prevents over-generation
  // where a 100-question document would otherwise produce 200+ questions.
  const existingCount = countExistingMcqs(text);
  const useExtractMode = allowExtract && !customCount && existingCount >= 5;

  // Determine chunk count from BOTH text length and desired question count,
  // so a large custom count still gets enough chunks to stay within the
  // per-call token budget (QUESTIONS_PER_CHUNK questions max per AI call).
  const chunkLimit = useExtractMode ? EXTRACT_MAX_CHUNKS : MAX_CHUNKS;
  const textBasedChunks = Math.min(chunkLimit, Math.max(1, Math.ceil(text.length / MIN_CHUNK_SIZE)));
  const countBasedChunks = customCount ? Math.min(MAX_CHUNKS, Math.ceil(customCount / QUESTIONS_PER_CHUNK)) : 1;
  // In extraction mode, also factor in the detected question count to create enough chunks
  const extractCountChunks = useExtractMode ? Math.min(chunkLimit, Math.ceil(existingCount / 15)) : 0;
  const desiredChunks = Math.max(textBasedChunks, countBasedChunks, extractCountChunks);
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / desiredChunks));
  const chunks = chunkText(text, chunkSize);
  const totalPossible = chunks.length * QUESTIONS_PER_CHUNK;
  // Per-chunk expected question counts (extraction mode): run the same
  // heuristic on each chunk so underproducing sections can be detected and
  // retried later — the doc-wide estimate is the overall target, these are
  // the per-section expectations.
  const avgExpectedPerChunk = chunks.length ? Math.ceil(existingCount / chunks.length) : 0;
  const chunkExpected = useExtractMode ? chunks.map((c) => countExistingMcqs(c)) : null;
  const targetCount = useExtractMode
    ? Math.min(existingCount, MAX_QUESTIONS)
    : customCount
      ? Math.min(customCount, totalPossible)
      : autoTarget
        ? Math.min(autoTarget, totalPossible)
        : Math.min(totalPossible, Math.max(DEFAULT_QUESTION_FLOOR, Math.min(DEFAULT_QUESTION_CAP, Math.round(text.length / CHARS_PER_QUESTION))));
  const questionsPerChunk = Math.min(QUESTIONS_PER_CHUNK, Math.ceil(targetCount / chunks.length));

  if (useExtractMode) {
    onProgress?.(`Extracting ~${existingCount} existing questions from ${chunks.length} section${chunks.length > 1 ? "s" : ""}…`);
  } else {
    onProgress?.(`Generating MCQs from ${chunks.length} section${chunks.length > 1 ? "s" : ""}… (up to ${targetCount} questions)`);
  }

  if (customCount && targetCount < customCount) {
    const w = `⚠️ Requested ${customCount} questions, but this document can only support ~${targetCount} given its length — generating the maximum achievable.`;
    warnings.push(w);
    onWarning?.(w);
  }

  // Streamed chunk call — feeds each completed question object to onRows while
  // the AI writes it; the buffered raw text stays the authoritative source.
  const runChunk = (prompt) => {
    const cfg = { provider: "openrouter", model: "z-ai/glm-5.3-flash", ...(mcqTotal ? { mcqTotal } : {}) };
    if (!onRows) {
      return callAI(prompt, cfg)
        .then((raw) => {
          try {
            return { raw, rows: mapAiMcqsToRows(extractJSON(raw, "array")), error: null };
          } catch (e) {
            return { raw, rows: [], error: e.message };
          }
        })
        .catch((err) => ({ raw: "", rows: [], error: err.message }));
    }
    const emitted = [];
    const parser = createArrayStreamParser((obj) => {
      const rows = mapAiMcqsToRows([obj]);
      if (rows.length > 0) {
        emitted.push(...rows);
        onRows(rows);
      }
    });
    return callAIStream(prompt, cfg, { onToken: (acc) => parser.push(acc), signal })
      .then((raw) => {
        try {
          const rows = mapAiMcqsToRows(extractJSON(raw, "array"));
          // Buffered fallback (no token events): emit the whole chunk at once
          // so the preview still fills in per-chunk on non-streaming servers.
          if (emitted.length === 0 && rows.length > 0) onRows(rows);
          return { raw, rows, error: null };
        } catch (e) {
          // Streamed objects beat nothing — salvage what arrived.
          return { raw, rows: emitted, error: emitted.length ? null : e.message };
        }
      })
      .catch((err) => ({ raw: "", rows: [], error: err.message }));
  };

  const alloc = !useExtractMode && (rich || customCount || autoTarget) ? allocateQuestions(chunks, targetCount) : null;

  // Process chunks in concurrency-limited batches to avoid rate-limit (429) errors
  const chunkResults = [];
  for (let batchStart = 0; batchStart < chunks.length; batchStart += CONCURRENCY_LIMIT) {
    ensureNotAborted(signal);
    const batchEnd = Math.min(batchStart + CONCURRENCY_LIMIT, chunks.length);
    const batchPromises = [];
    for (let idx = batchStart; idx < batchEnd; idx++) {
      let prompt;
      let requested;
      if (useExtractMode) {
        prompt = buildMcqPrompt(chunks[idx], 0, { extractMode: true, expectedCount: chunkExpected[idx] || avgExpectedPerChunk });
        requested = 0;
      } else if (alloc) {
        requested = alloc[idx];
        if (requested <= 0) { batchPromises.push(Promise.resolve({ rows: [], requested: 0, error: null })); continue; }
        prompt = buildMcqPrompt(chunks[idx], requested, promptOpts);
      } else {
        const count = idx === chunks.length - 1 ? Math.min(QUESTIONS_PER_CHUNK, targetCount - (questionsPerChunk * (chunks.length - 1))) : questionsPerChunk;
        requested = Math.max(5, count);
        prompt = buildMcqPrompt(chunks[idx], requested, promptOpts);
      }
      batchPromises.push(
        runChunk(prompt)
          .then(({ rows, error }) => ({ rows, requested, error }))
      );
    }
    const batchResults = await Promise.all(batchPromises);
    chunkResults.push(...batchResults);
  }
  ensureNotAborted(signal);

  // Optional answer-check pass: verify each chunk's questions against its own source text.
  if (verify && !useExtractMode) {
    onProgress?.("Checking answers against your material…");
    for (let i = 0; i < chunkResults.length; i += CONCURRENCY_LIMIT) {
      ensureNotAborted(signal);
      const slice = chunkResults.slice(i, i + CONCURRENCY_LIMIT);
      const checked = await Promise.all(slice.map((r, k) => (r.rows.length ? verifyMcqRows(r.rows, chunks[i + k], { signal }) : r.rows)));
      checked.forEach((rows, k) => { chunkResults[i + k] = { ...chunkResults[i + k], rows }; });
    }
  }

  let allRows = chunkResults.flatMap((r) => r.rows);

  // Deduplicate in extraction mode (AI may extract the same question from overlapping chunks)
  if (useExtractMode) {
    allRows = dedupeMcqs(allRows);
    // In extraction mode, do NOT cap to the heuristic estimate — keep all extracted questions
    allRows = allRows.slice(0, MAX_QUESTIONS);
  } else {
    allRows = (rich ? dedupeMcqs(allRows) : allRows).slice(0, targetCount);
  }

  // Adaptive retry: if total < 50% of target, retry underproducing chunks with halved counts
  if (!useExtractMode && allRows.length < targetCount * 0.5 && allRows.length < MAX_QUESTIONS) {
    const underproducing = chunkResults
      .map((r, idx) => ({ idx, requested: r.requested, produced: r.rows.length, error: r.error }))
      .filter((r) => r.produced < r.requested * 0.5);

    if (underproducing.length > 0) {
      onProgress?.(`Retrying ${underproducing.length} section${underproducing.length > 1 ? "s" : ""} with fewer questions…`);
      const retryRows = [];
      for (let rStart = 0; rStart < underproducing.length; rStart += CONCURRENCY_LIMIT) {
        ensureNotAborted(signal);
        const rEnd = Math.min(rStart + CONCURRENCY_LIMIT, underproducing.length);
        const retryBatchPromises = [];
        for (let ri = rStart; ri < rEnd; ri++) {
          const r = underproducing[ri];
          const retryCount = Math.max(5, Math.ceil(r.requested / 2));
          const prompt = buildMcqPrompt(chunks[r.idx], retryCount, promptOpts);
          retryBatchPromises.push(
            callAI(prompt, { provider: "openrouter", model: "z-ai/glm-5.3-flash", ...(mcqTotal ? { mcqTotal } : {}) })
              .then((raw) => { try { return mapAiMcqsToRows(extractJSON(raw, "array")); } catch { return []; } })
              .catch(() => [])
          );
        }
        const batchRetryResults = await Promise.all(retryBatchPromises);
        retryRows.push(...batchRetryResults);
      }
      allRows = [...allRows, ...retryRows.flat()].slice(0, targetCount);
    }
  }

  if (rich && !useExtractMode) allRows = rebalanceAnswers(dedupeMcqs(allRows));

  // Extraction mode: retry chunks that produced FEWER questions than their
  // per-chunk estimate, so a question-bank document yields its real count.
  // Bounded by EXTRACT_RETRY_ROUNDS to cap token spend; deduped counts are
  // used so a retry that resurfaces the same questions doesn't look like progress.
  if (useExtractMode && allRows.length < existingCount) {
    const deficits = () => chunkResults
      .map((r, idx) => ({ idx, expected: chunkExpected[idx], produced: dedupeMcqs(r.rows).length }))
      .filter((d) => d.produced < d.expected);

    for (let round = 0, pending = deficits(); pending.length > 0 && round < EXTRACT_RETRY_ROUNDS && allRows.length < existingCount; round++) {
      ensureNotAborted(signal);
      onProgress?.(`Re-checking ${pending.length} section${pending.length > 1 ? "s" : ""} that may still have questions…`);
      for (let rStart = 0; rStart < pending.length; rStart += CONCURRENCY_LIMIT) {
        const rEnd = Math.min(rStart + CONCURRENCY_LIMIT, pending.length);
        const retryBatchPromises = [];
        for (let ri = rStart; ri < rEnd; ri++) {
          const d = pending[ri];
          const prompt = buildMcqPrompt(chunks[d.idx], 0, { extractMode: true, expectedCount: d.expected, retryHint: true });
          retryBatchPromises.push(
            callAI(prompt, { provider: "openrouter", model: "z-ai/glm-5.3-flash" })
              .then((raw) => { try { return { idx: d.idx, rows: mapAiMcqsToRows(extractJSON(raw, "array")) }; } catch { return { idx: d.idx, rows: [] }; } })
              .catch(() => ({ idx: d.idx, rows: [] }))
          );
        }
        const batchRetryResults = await Promise.all(retryBatchPromises);
        for (const res of batchRetryResults) {
          chunkResults[res.idx].rows.push(...res.rows);
        }
      }
      allRows = dedupeMcqs(chunkResults.flatMap((r) => r.rows)).slice(0, MAX_QUESTIONS);
      pending = deficits();
    }

    if (allRows.length > 0 && allRows.length < existingCount) {
      const w = `⚠️ Detected ~${existingCount} questions but extracted ${allRows.length} — some may have been missed.`;
      warnings.push(w);
      onWarning?.(w);
    }
  }

  // Build warning if chunks underproduced
  const failedChunks = chunkResults.filter((r) => r.rows.length === 0).length;
  const lowChunks = chunkResults.filter((r) => r.requested > 0 && r.rows.length > 0 && r.rows.length < r.requested * 0.5).length;
  if (failedChunks > 0 || lowChunks > 0) {
    const parts = [];
    if (failedChunks > 0) parts.push(`${failedChunks} section${failedChunks > 1 ? "s" : ""} failed`);
    if (lowChunks > 0) parts.push(`${lowChunks} section${lowChunks > 1 ? "s" : ""} produced fewer questions than requested`);
    const w = `⚠️ ${parts.join(" and ")} — some content may not be fully covered.`;
    warnings.push(w);
    onWarning?.(w);
    console.warn("MCQ generation stats:", chunkResults.map((r, i) => ({ chunk: i, requested: r.requested, produced: r.rows.length, error: r.error })));
  }

  if (allRows.length === 0) {
    // Extraction-mode false positive — the doc looked like a question bank
    // but had nothing extractable. Re-run in generation mode instead of failing.
    if (useExtractMode) {
      onProgress?.("No existing questions found — generating fresh ones instead…");
      onWarning?.("⚠️ No existing questions found in this document — generated fresh ones instead.");
      return generateMcqs(text, images, onProgress, { ...options, allowExtract: false });
    }
    // Surface the real per-chunk cause — a swallowed rate-limit/service
    // error shouldn't read as "try a different file".
    const firstErr = chunkResults.find((r) => r.error)?.error;
    if (firstErr) {
      const err = new Error(firstErr);
      if (/daily ai limit/i.test(firstErr)) err.isLimitError = true;
      throw err;
    }
    throw new Error("AI couldn't generate questions from this content. Try a different file.");
  }
  return { rows: allRows, warnings };
}

/**
 * Convert MCQ rows into flashcards.
 * front = question text, back = correct option text only (no explanation).
 * Produces one flashcard per MCQ — same count.
 */
export function mcqsToFlashcards(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && r.question && r.options && r.correct)
    .map((r) => ({
      front: r.question,
      back: r.options[r.correct] || "",
    }))
    .filter((fc) => fc.front.trim() && fc.back.trim());
}

/**
 * Generate flashcards from extracted text/images.
 * @param {string} text - Extracted text
 * @param {string[]} images - Array of image data URLs
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<Array<{front: string, back: string}>>}
 */
export async function generateFlashcards(text, images, onProgress) {
  if (images.length > 0 && text.length < 50) {
    onProgress?.(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
    const contextText = "The images contain study material. Generate comprehensive content covering all the content visible.";
    const prompt = buildFlashcardPrompt(contextText, MAX_FLASHCARDS);
    const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "z-ai/glm-5.3-flash" });
    const cards = mapAiFlashcards(extractJSON(raw, "array"));
    if (cards.length === 0) throw new Error("AI didn't generate valid flashcards. Try again.");
    return cards;
  }

  if (!text.trim()) throw new Error("No text could be extracted from this material.");

  const textBasedChunks = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(text.length / MIN_CHUNK_SIZE)));
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / textBasedChunks));
  const chunks = chunkText(text, chunkSize);
  const cardsPerChunk = Math.ceil(MAX_FLASHCARDS / chunks.length);
  onProgress?.(`Generating flashcards from ${chunks.length} section${chunks.length > 1 ? "s" : ""}…`);

  const promises = chunks.map((chunk) => {
    const prompt = buildFlashcardPrompt(chunk, cardsPerChunk);
    return callAI(prompt, { provider: "openrouter", model: "z-ai/glm-5.3-flash" })
      .then((raw) => { try { return mapAiFlashcards(extractJSON(raw, "array")); } catch { return []; } })
      .catch((err) => ({ error: err.message }));
  });

  const results = await Promise.all(promises);
  const allCards = results.flat().filter((c) => c && c.front).slice(0, MAX_FLASHCARDS);
  if (allCards.length === 0) {
    const firstErr = results.find((r) => r && r.error)?.error;
    if (firstErr) {
      const err = new Error(firstErr);
      if (/daily ai limit/i.test(firstErr)) err.isLimitError = true;
      throw err;
    }
    throw new Error("AI couldn't generate flashcards from this content. Try a different file.");
  }
  return allCards;
}

/**
 * Generate a summary from extracted text/images.
 * @param {string} text - Extracted text
 * @param {string[]} images - Array of image data URLs
 * @param {function} [onProgress] - Progress callback
 * @param {object} [options] - { onToken: (accumulatedRaw) => void, signal }
 *   onToken streams the final summary text live (SSE via the tutor endpoint);
 *   when provided, the last pass of generation streams token-by-token.
 * @returns {Promise<string>}
 */
export async function generateSummary(text, images, onProgress, { onToken, signal } = {}) {
  if (images.length > 0 && text.length < 50) {
    onProgress?.(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
    const contextText = "The images contain study material. Generate comprehensive content covering all the content visible.";
    const prompt = buildSummaryPrompt(contextText);
    const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "z-ai/glm-5.3-flash" });
    return raw || "No summary generated.";
  }

  if (!text.trim()) throw new Error("No text could be extracted from this material.");

  const textBasedChunks = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(text.length / MIN_CHUNK_SIZE)));
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / textBasedChunks));
  const chunks = chunkText(text, chunkSize);
  const aiOpts = { provider: "openrouter", model: "z-ai/glm-5.3-flash" };

  // Short docs — single pass (streams when onToken is provided).
  if (chunks.length <= 1 || text.length <= 20000) {
    onProgress?.("Generating summary…");
    const prompt = buildSummaryPrompt(chunks.join("\n\n").slice(0, 20000));
    const raw = onToken
      ? (await callAITutor(prompt, aiOpts, { onToken, signal })).raw
      : await callAI(prompt, aiOpts);
    if (!raw || !raw.trim()) throw new Error("AI didn't generate a summary. Try again.");
    return raw;
  }

  // Long docs — map-reduce so nothing is silently truncated.
  const notes = new Array(chunks.length).fill("");
  let done = 0;
  for (let batchStart = 0; batchStart < chunks.length; batchStart += CONCURRENCY_LIMIT) {
    const batchEnd = Math.min(batchStart + CONCURRENCY_LIMIT, chunks.length);
    const batch = [];
    for (let idx = batchStart; idx < batchEnd; idx++) {
      batch.push(
        callAI(buildChunkSummaryPrompt(chunks[idx], idx + 1, chunks.length), aiOpts)
          .then((raw) => { notes[idx] = raw || ""; })
          .catch(() => {})
          .finally(() => { done++; onProgress?.(`Summarizing part ${done} of ${chunks.length}…`); })
      );
    }
    await Promise.all(batch);
  }

  const validNotes = notes.filter(Boolean);
  if (!validNotes.length) throw new Error("AI didn't generate a summary. Try again.");
  if (validNotes.length === 1) return validNotes[0];

  onProgress?.("Merging into final summary…");
  const mergePrompt = buildMergeSummaryPrompt(validNotes.join("\n\n").slice(0, 30000));
  const merged = onToken
    ? (await callAITutor(mergePrompt, aiOpts, { onToken, signal })).raw
    : await callAI(mergePrompt, aiOpts);
  if (!merged || !merged.trim()) return validNotes.join("\n\n");
  return merged;
}
