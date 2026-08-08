import { useState, useCallback, useRef } from "react";
import { extractFileText } from "../../lib/extractFileText";
import { generateSummaryPdf } from "../../lib/generateSummaryPdf";
import { generateMcqs, generateFlashcards, generateSummary, mcqsToFlashcards } from "../../lib/generationCore";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const FETCH_TIMEOUT_MS = 30_000;

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
 *  - generate: async (resource, kind, onSave, existingMcqData) => void
 *      kind: "mcqs" | "flashcards" | "summary"
 *      onSave: (payload) => void  — called with the study-tool-save payload
 *      existingMcqData: array of existing MCQ rows (for reuse), optional
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

  const generate = useCallback(async (resource, kind, onSave, existingMcqData) => {
    if (!resource || !onSave) return;
    if (activeRef.current) return; // prevent concurrent generations
    activeRef.current = resource.id;
    lastResourceRef.current = resource;
    lastKindRef.current = kind;
    lastOnSaveRef.current = onSave;
    setGeneratingId(resource.id);
    setGenError("");
    setGenErrorId(null);

    try {
      const baseTitle = resource.title || "Material";
      const baseSubject = resource.subject || "";

      if (kind === "mcqs" || kind === "flashcards") {
        // Combined generation: MCQs first, then flashcards derived from MCQs
        let mcqRows = null;

        if (existingMcqData && Array.isArray(existingMcqData) && existingMcqData.length > 0) {
          mcqRows = existingMcqData;
          setGenProgress(`Using ${mcqRows.length} existing MCQs — generating flashcards…`);
        } else {
          setGenProgress("Extracting text from material…");
          const { text, images } = await extractResourceText(resource);
          setGenProgress("Generating MCQs + Flashcards…");
          const { rows } = await generateMcqs(text, images, setGenProgress);
          mcqRows = rows;
        }

        const flashcards = mcqsToFlashcards(mcqRows);
        setGenProgress(`Generated ${mcqRows.length} MCQs + ${flashcards.length} flashcards ✓ — saving…`);

        // Save MCQs first
        onSave({
          title: `${baseTitle} — MCQs`,
          subject: baseSubject,
          contentType: "mcq",
          mcqData: JSON.stringify(mcqRows),
          folderId: resource.folderId || null,
          sourceResourceId: resource.id,
          isPublic: false,
        });

        // Save flashcards second (derived from MCQs)
        onSave({
          title: `${baseTitle} — Flashcards`,
          subject: baseSubject,
          contentType: "flashcard_deck",
          flashcardData: JSON.stringify(flashcards),
          folderId: resource.folderId || null,
          sourceResourceId: resource.id,
          isPublic: false,
          isSecondary: true,
        });
      } else if (kind === "summary") {
        setGenProgress("Extracting text from material…");
        const { text, images } = await extractResourceText(resource);
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
      generate(resource, kind, onSave, null);
    }
  }, [generate]);

  const clearError = useCallback(() => {
    setGenError("");
    setGenErrorId(null);
  }, []);

  return { generatingId, genProgress, genError, genErrorId, generate, retry, clearError };
}
