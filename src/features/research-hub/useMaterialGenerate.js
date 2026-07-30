import { useState, useCallback, useRef } from "react";
import { callAI, callAIMultimodal, extractJSON } from "../../lib/aiClient";
import { extractFileText, chunkText } from "../../lib/extractFileText";
import { generateSummaryPdf } from "../../lib/generateSummaryPdf";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const FETCH_TIMEOUT_MS = 30_000;

const MAX_QUESTIONS = 1000;
const QUESTIONS_PER_CHUNK = 50;
const MAX_FLASHCARDS = 50;
const CONCURRENCY_LIMIT = 3;
const MAX_CHUNKS = 20;
const MIN_CHUNK_SIZE = 5000;

function buildMcqPrompt(text, questionCount) {
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

function buildFlashcardPrompt(text, count) {
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

function buildSummaryPrompt(text) {
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

function mapAiMcqsToRows(parsed) {
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

function mapAiFlashcards(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((fc) => fc && fc.front && fc.back)
    .map((fc) => ({ front: String(fc.front), back: String(fc.back) }))
    .filter((fc) => fc.front.trim() && fc.back.trim());
}

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {};
  } catch {
    return {};
  }
}

/**
 * Fetch a file from a URL via the backend proxy to avoid CORS issues.
 * Uses AbortController for a 30s timeout.
 */
async function fetchFileFromUrl(url, fileName) {
  const proxyUrl = `${API_BASE}/api/resources/proxy-pdf?url=${encodeURIComponent(url)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(proxyUrl, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) {
 throw new Error(`Failed to fetch file (HTTP ${res.status}). Try again.`);
    }
    const blob = await res.blob();
    return new File([blob], fileName || "material", { type: blob.type || "application/octet-stream" });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("File fetch timed out after 30s. Check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract text from a resource (by fileUrl or description for notes).
 * Returns { text, images }.
 */
async function extractResourceText(resource) {
  if (resource.contentType === "note" && resource.description) {
    return { text: resource.description, images: [] };
  }
  if (!resource.fileUrl) throw new Error("This material has no file to extract text from.");
  const fileName = resource.fileName || resource.title || "material";
  const file = await fetchFileFromUrl(resource.fileUrl, fileName);
  return extractFileText(file, 15);
}

/**
 * Generate MCQs from extracted text/images.
 * Returns array of MCQ row objects.
 */
async function generateMcqs(text, images, onProgress) {
  if (images.length > 0 && text.length < 50) {
    onProgress?.(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
    const contextText = "The images contain study material. Generate comprehensive content covering all the content visible.";
    const imgCount = Math.min(QUESTIONS_PER_CHUNK, MAX_QUESTIONS);
    const prompt = buildMcqPrompt(contextText, imgCount);
    const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
    const rows = mapAiMcqsToRows(extractJSON(raw, "array"));
    if (rows.length === 0) throw new Error("AI didn't generate valid questions. Try again.");
    return rows;
  }

  if (!text.trim()) throw new Error("No text could be extracted from this material.");

  const textBasedChunks = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(text.length / MIN_CHUNK_SIZE)));
  const desiredChunks = textBasedChunks;
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / desiredChunks));
  const chunks = chunkText(text, chunkSize);

  const totalPossible = chunks.length * QUESTIONS_PER_CHUNK;
  const targetCount = Math.min(MAX_QUESTIONS, totalPossible);
  const questionsPerChunk = Math.min(QUESTIONS_PER_CHUNK, Math.ceil(targetCount / chunks.length));
  onProgress?.(`Generating MCQs from ${chunks.length} section${chunks.length > 1 ? "s" : ""}… (up to ${targetCount} questions)`);

  const chunkResults = [];
  for (let batchStart = 0; batchStart < chunks.length; batchStart += CONCURRENCY_LIMIT) {
    const batchEnd = Math.min(batchStart + CONCURRENCY_LIMIT, chunks.length);
    const batchPromises = [];
    for (let idx = batchStart; idx < batchEnd; idx++) {
      const count = idx === chunks.length - 1 ? targetCount - (questionsPerChunk * (chunks.length - 1)) : questionsPerChunk;
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

  // Adaptive retry
  if (allRows.length < targetCount * 0.5 && allRows.length < MAX_QUESTIONS) {
    const underproducing = chunkResults
      .map((r, idx) => ({ idx, requested: r.requested, produced: r.rows.length }))
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

  if (allRows.length === 0) throw new Error("AI couldn't generate questions from this content. Try a different file.");
  return allRows;
}

/**
 * Generate flashcards from extracted text/images.
 * Returns array of { front, back } objects.
 */
async function generateFlashcards(text, images, onProgress) {
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
 * Returns the summary text string.
 */
async function generateSummary(text, images, onProgress) {
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

/**
 * Convert a summary text into a base64 PDF buffer (for saving as a PDF resource).
 * Returns { fileBuffer, fileName }.
 */
function summaryToPdfBuffer(title, subject, summaryText) {
  const pdfBuffer = generateSummaryPdf(title, subject, summaryText);
  const bytes = new Uint8Array(pdfBuffer);
  let binary = "";
  const chunkSz = 8192;
  for (let i = 0; i < bytes.length; i += chunkSz) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSz));
  }
  const base64 = btoa(binary);
  const fileName = `[AI] Summary — ${title}.pdf`;
  return { fileBuffer: base64, fileName };
}

/**
 * Hook that manages per-material AI generation state.
 * Tracks which resource is currently generating and its progress.
 *
 * Returns:
 *  - generatingId: resource id currently generating (or null)
 *  - genProgress: progress message string
 *  - genError: error message string
 *  - generate: async (resource, kind, onSave) => void
 *      kind: "mcqs" | "flashcards" | "summary"
 *      onSave: (payload) => void  — called with the study-tool-save payload
 */
export function useMaterialGenerate() {
  const [generatingId, setGeneratingId] = useState(null);
  const [genProgress, setGenProgress] = useState("");
  const [genError, setGenError] = useState("");
  const [genErrorId, setGenErrorId] = useState(null);
  const activeRef = useRef(null);
  const lastResourceRef = useRef(null);
  const lastKindRef = useRef(null);
  const lastOnSaveRef = useRef(null);

  const generate = useCallback(async (resource, kind, onSave) => {
    if (!resource || !onSave) return;
    if (activeRef.current) return; // prevent concurrent generations
    activeRef.current = resource.id;
    lastResourceRef.current = resource;
    lastKindRef.current = kind;
    lastOnSaveRef.current = onSave;
    setGeneratingId(resource.id);
    setGenError("");
    setGenErrorId(null);
    setGenProgress("Extracting text from material…");

    try {
      const { text, images } = await extractResourceText(resource);
      const baseTitle = resource.title || "Material";
      const baseSubject = resource.subject || "";

      if (kind === "mcqs") {
        const rows = await generateMcqs(text, images, setGenProgress);
        setGenProgress(`Generated ${rows.length} questions ✓ — saving…`);
        onSave({
          title: `${baseTitle} — MCQs`,
          subject: baseSubject,
          contentType: "mcq",
          mcqData: JSON.stringify(rows),
          folderId: resource.folderId || null,
          sourceResourceId: resource.id,
          isPublic: false,
        });
      } else if (kind === "flashcards") {
        const cards = await generateFlashcards(text, images, setGenProgress);
        setGenProgress(`Generated ${cards.length} flashcards ✓ — saving…`);
        onSave({
          title: `${baseTitle} — Flashcards`,
          subject: baseSubject,
          contentType: "flashcard_deck",
          flashcardData: JSON.stringify(cards),
          folderId: resource.folderId || null,
          sourceResourceId: resource.id,
          isPublic: false,
        });
      } else if (kind === "summary") {
        const summaryText = await generateSummary(text, images, setGenProgress);
        setGenProgress("Generating formatted PDF…");
        const { fileBuffer, fileName } = summaryToPdfBuffer(baseTitle, baseSubject, summaryText);
        onSave({
          title: baseTitle,
          subject: baseSubject,
          contentType: "pdf",
          fileBuffer,
          fileName,
          description: summaryText,
          folderId: resource.folderId || null,
          sourceResourceId: resource.id,
          isPublic: false,
        });
      }
      setGenProgress("");
    } catch (err) {
      setGenError(err.message || "AI generation failed. Try again.");
      setGenErrorId(resource.id);
      setGenProgress("");
    } finally {
      activeRef.current = null;
      setGeneratingId(null);
    }
  }, []);

  const retry = useCallback(() => {
    const resource = lastResourceRef.current;
    const kind = lastKindRef.current;
    const onSave = lastOnSaveRef.current;
    if (resource && kind && onSave) {
      generate(resource, kind, onSave);
    }
  }, [generate]);

  const clearError = useCallback(() => {
    setGenError("");
    setGenErrorId(null);
  }, []);

  return { generatingId, genProgress, genError, genErrorId, generate, retry, clearError };
}
