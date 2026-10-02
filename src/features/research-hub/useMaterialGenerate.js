import { useState, useCallback, useRef } from "react";
import { extractFileText } from "../../lib/extractFileText";
import { generateSummaryPdf } from "../../lib/generateSummaryPdf";
import { generateMcqs, generateSummary } from "../../lib/generationCore";
import { API_BASE } from "../../lib/constants";
import { consume } from "../../lib/freeTier.js";

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
export async function extractResourceText(resource) {
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
 *      kind: "mcqs" | "summary"
 *      onSave: (payload) => void  — called with the study-tool-save payload
 *      existingMcqData: array of existing MCQ rows (for reuse), optional
 */
export function useMaterialGenerate() {
  const [generatingId, setGeneratingId] = useState(null);
  const [genProgress, setGenProgress] = useState("");
  const [genError, setGenError] = useState("");
  const [genErrorId, setGenErrorId] = useState(null);
  // Live-streamed summary text (null = not streaming / not a summary run)
  const [streamText, setStreamText] = useState(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  const activeRef = useRef(null);
  const abortRef = useRef(null);
  const lastResourceRef = useRef(null);
  const lastKindRef = useRef(null);
  const lastOnSaveRef = useRef(null);

  const generate = useCallback(async (resource, kind, onSave, existingMcqData) => {
    if (!resource || !onSave) return;
    if (activeRef.current) return; // prevent concurrent generations
    activeRef.current = resource.id;
    abortRef.current = new AbortController();
    lastResourceRef.current = resource;
    lastKindRef.current = kind;
    lastOnSaveRef.current = onSave;
    setGeneratingId(resource.id);
    setGenError("");
    setGenErrorId(null);
    setStreamText(null);
    setStreamDone(false);

    try {
      const baseTitle = resource.title || "Material";
      const baseSubject = resource.subject || "";

      if (kind === "mcqs") {
        let mcqRows = null;

        if (existingMcqData && Array.isArray(existingMcqData) && existingMcqData.length > 0) {
          mcqRows = existingMcqData;
          setGenProgress(`Using ${mcqRows.length} existing questions…`);
        } else {
          setGenProgress("Extracting text from material…");
          const { text, images } = await extractResourceText(resource);
          setGenProgress("Generating Rapid Recall…");
          const { rows } = await generateMcqs(text, images, setGenProgress);
          mcqRows = rows;
        }

        setGenProgress(`Generated ${mcqRows.length} questions ✓ — saving…`);

        if (abortRef.current?.signal.aborted) return;
        onSave({
          title: `${baseTitle} — Rapid Recall`,
          subject: baseSubject,
          contentType: "mcq",
          mcqData: JSON.stringify(mcqRows),
          folderId: resource.folderId || null,
          sourceResourceId: resource.id,
          isPublic: false,
        });
      } else if (kind === "summary") {
        // Open the streaming view instantly — it shows progress until tokens land
        setStreamTitle(baseTitle);
        setStreamText("");
        setGenProgress("Extracting text from material…");
        const { text, images } = await extractResourceText(resource);
        const summaryText = await generateSummary(text, images, setGenProgress, {
          onToken: (raw) => setStreamText(raw),
          signal: abortRef.current?.signal,
        });
        setGenProgress("Generating formatted PDF…");
        const { fileBuffer, fileName } = summaryToPdfBuffer(baseTitle, baseSubject, summaryText);
        if (abortRef.current?.signal.aborted) return;
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
      consume(kind === "mcqs" ? "mcqGen" : "summary");
      setGenProgress("");
      setStreamDone(true);
    } catch (err) {
      if (err.stoppedByUser) {
        setStreamText(null); // cancelled — close the stream view quietly
      } else {
        setGenError(err.message || "AI generation failed. Try again.");
        setGenErrorId(resource.id);
      }
      setGenProgress("");
    } finally {
      activeRef.current = null;
      abortRef.current = null;
      setGeneratingId(null);
    }
  }, []);

  // Stop the in-flight generation (abort the AI stream and close the overlay)
  const cancel = useCallback(() => {
    abortRef.current?.abort(new DOMException("Stopped", "AbortError"));
    setStreamText(null);
  }, []);

  // Dismiss the finished streaming view
  const closeStream = useCallback(() => {
    setStreamText(null);
    setStreamDone(false);
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

  return { generatingId, genProgress, genError, genErrorId, streamText, streamTitle, streamDone, generate, retry, cancel, closeStream, clearError };
}
