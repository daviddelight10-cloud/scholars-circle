import { callAI, callAIMultimodal, extractJSON } from "./aiClient";
import { chunkText } from "./extractFileText";

export const MAX_QUESTIONS = 1000;
export const QUESTIONS_PER_CHUNK = 50;
export const MAX_FLASHCARDS = 50;
export const CONCURRENCY_LIMIT = 3;
export const MAX_CHUNKS = 20;
export const MIN_CHUNK_SIZE = 5000;

export function buildMcqPrompt(text, questionCount) {
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
7. If the content already contains questions, extract and format them properly.

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

export function buildSummaryPrompt(text) {
  return `You are an expert academic assistant. Create a comprehensive but concise study summary from the content below.

Format the summary with clear headings (using ##) and bullet points. Include:
- Key concepts and definitions
- Important relationships and processes
- Notable examples or applications
- Any critical formulas or dates

Keep it well-structured and easy to scan. Use markdown formatting.

CONTENT:
"""
${text}
"""`;
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
 * @returns {Promise<{rows: Array, warnings: string[]}>}
 */
export async function generateMcqs(text, images, onProgress, options = {}) {
  const { customCount = null, onWarning } = options;
  const warnings = [];

  // Image-based: send images to multimodal AI
  if (images.length > 0 && text.length < 50) {
    const imgCount = customCount || Math.min(QUESTIONS_PER_CHUNK, MAX_QUESTIONS);
    onProgress?.(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
    const prompt = buildMcqPrompt("The images contain study material. Generate comprehensive MCQs covering all the content visible.", imgCount);
    const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
    const rows = mapAiMcqsToRows(extractJSON(raw, "array"));
    if (rows.length === 0) throw new Error("AI didn't generate valid questions. Try again.");
    return { rows, warnings };
  }

  if (!text.trim()) throw new Error("No text could be extracted from this material.");

  // Determine chunk count from BOTH text length and desired question count,
  // so a large custom count still gets enough chunks to stay within the
  // per-call token budget (QUESTIONS_PER_CHUNK questions max per AI call).
  const textBasedChunks = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(text.length / MIN_CHUNK_SIZE)));
  const countBasedChunks = customCount ? Math.min(MAX_CHUNKS, Math.ceil(customCount / QUESTIONS_PER_CHUNK)) : 1;
  const desiredChunks = Math.max(textBasedChunks, countBasedChunks);
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / desiredChunks));
  const chunks = chunkText(text, chunkSize);
  const totalPossible = chunks.length * QUESTIONS_PER_CHUNK;
  const targetCount = customCount ? Math.min(customCount, totalPossible) : Math.min(MAX_QUESTIONS, totalPossible);
  const questionsPerChunk = Math.min(QUESTIONS_PER_CHUNK, Math.ceil(targetCount / chunks.length));

  onProgress?.(`Generating MCQs from ${chunks.length} section${chunks.length > 1 ? "s" : ""}… (up to ${targetCount} questions)`);

  if (customCount && targetCount < customCount) {
    const w = `⚠️ Requested ${customCount} questions, but this document can only support ~${targetCount} given its length — generating the maximum achievable.`;
    warnings.push(w);
    onWarning?.(w);
  }

  // Process chunks in concurrency-limited batches to avoid rate-limit (429) errors
  const chunkResults = [];
  for (let batchStart = 0; batchStart < chunks.length; batchStart += CONCURRENCY_LIMIT) {
    const batchEnd = Math.min(batchStart + CONCURRENCY_LIMIT, chunks.length);
    const batchPromises = [];
    for (let idx = batchStart; idx < batchEnd; idx++) {
      const count = idx === chunks.length - 1 ? Math.min(QUESTIONS_PER_CHUNK, targetCount - (questionsPerChunk * (chunks.length - 1))) : questionsPerChunk;
      const requested = Math.max(5, count);
      const prompt = buildMcqPrompt(chunks[idx], requested);
      batchPromises.push(
        callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" })
          .then((raw) => {
            try {
              const rows = mapAiMcqsToRows(extractJSON(raw, "array"));
              return { rows, requested, error: null };
            } catch (e) {
              return { rows: [], requested, error: e.message };
            }
          })
          .catch((err) => ({ rows: [], requested, error: err.message }))
      );
    }
    const batchResults = await Promise.all(batchPromises);
    chunkResults.push(...batchResults);
  }

  let allRows = chunkResults.flatMap((r) => r.rows).slice(0, targetCount);

  // Adaptive retry: if total < 50% of target, retry underproducing chunks with halved counts
  if (allRows.length < targetCount * 0.5 && allRows.length < MAX_QUESTIONS) {
    const underproducing = chunkResults
      .map((r, idx) => ({ idx, requested: r.requested, produced: r.rows.length, error: r.error }))
      .filter((r) => r.produced < r.requested * 0.5);

    if (underproducing.length > 0) {
      onProgress?.(`Retrying ${underproducing.length} section${underproducing.length > 1 ? "s" : ""} with fewer questions…`);
      const retryRows = [];
      for (let rStart = 0; rStart < underproducing.length; rStart += CONCURRENCY_LIMIT) {
        const rEnd = Math.min(rStart + CONCURRENCY_LIMIT, underproducing.length);
        const retryBatchPromises = [];
        for (let ri = rStart; ri < rEnd; ri++) {
          const r = underproducing[ri];
          const retryCount = Math.max(5, Math.ceil(r.requested / 2));
          const prompt = buildMcqPrompt(chunks[r.idx], retryCount);
          retryBatchPromises.push(
            callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" })
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

  // Build warning if chunks underproduced
  const failedChunks = chunkResults.filter((r) => r.rows.length === 0).length;
  const lowChunks = chunkResults.filter((r) => r.rows.length > 0 && r.rows.length < r.requested * 0.5).length;
  if (failedChunks > 0 || lowChunks > 0) {
    const parts = [];
    if (failedChunks > 0) parts.push(`${failedChunks} section${failedChunks > 1 ? "s" : ""} failed`);
    if (lowChunks > 0) parts.push(`${lowChunks} section${lowChunks > 1 ? "s" : ""} produced fewer questions than requested`);
    const w = `⚠️ ${parts.join(" and ")} — some content may not be fully covered.`;
    warnings.push(w);
    onWarning?.(w);
    console.warn("MCQ generation stats:", chunkResults.map((r, i) => ({ chunk: i, requested: r.requested, produced: r.rows.length, error: r.error })));
  }

  if (allRows.length === 0) throw new Error("AI couldn't generate questions from this content. Try a different file.");
  return { rows: allRows, warnings };
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
    const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
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
    return callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" })
      .then((raw) => { try { return mapAiFlashcards(extractJSON(raw, "array")); } catch { return []; } })
      .catch(() => []);
  });

  const results = await Promise.all(promises);
  const allCards = results.flat().slice(0, MAX_FLASHCARDS);
  if (allCards.length === 0) throw new Error("AI couldn't generate flashcards from this content. Try a different file.");
  return allCards;
}

/**
 * Generate a summary from extracted text/images.
 * @param {string} text - Extracted text
 * @param {string[]} images - Array of image data URLs
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<string>}
 */
export async function generateSummary(text, images, onProgress) {
  if (images.length > 0 && text.length < 50) {
    onProgress?.(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
    const contextText = "The images contain study material. Generate comprehensive content covering all the content visible.";
    const prompt = buildSummaryPrompt(contextText);
    const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
    return raw || "No summary generated.";
  }

  if (!text.trim()) throw new Error("No text could be extracted from this material.");

  const textBasedChunks = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(text.length / MIN_CHUNK_SIZE)));
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / textBasedChunks));
  const chunks = chunkText(text, chunkSize);
  onProgress?.(`Generating summary from ${chunks.length} section${chunks.length > 1 ? "s" : ""}…`);
  const combinedText = chunks.join("\n\n").slice(0, 20000);
  const prompt = buildSummaryPrompt(combinedText);
  const raw = await callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" });
  if (!raw || !raw.trim()) throw new Error("AI didn't generate a summary. Try again.");
  return raw;
}
