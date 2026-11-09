import { useState, useCallback, useRef } from "react";
import { extractFileText } from "../../lib/extractFileText";
import { generateSummaryPdf } from "../../lib/generateSummaryPdf";
import { generateMcqs, generateSummary, countExistingMcqs } from "../../lib/generationCore";
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
function ensureNotAbortedLocal(signal) {
  if (signal?.aborted) {
    const err = new Error("Generation stopped.");
    err.stoppedByUser = true;
    throw err;
  }
}

export function useMaterialGenerate() {
  const [generatingId, setGeneratingId] = useState(null);
  const [genProgress, setGenProgress] = useState("");
  const [genError, setGenError] = useState("");
  const [genErrorId, setGenErrorId] = useState(null);
  // Live-streamed summary text (null = not streaming / not a summary run)
  const [streamText, setStreamText] = useState(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  // Live-streamed MCQ draft rows (null = no Practice Questions run in flight)
  const [draftRows, setDraftRows] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDone, setDraftDone] = useState(false); // generation finished, final set
  const activeRef = useRef(null);
  const abortRef = useRef(null);
  const lastResourceRef = useRef(null);
  const lastKindRef = useRef(null);
  const lastOnSaveRef = useRef(null);
  const lastOptionsRef = useRef(null);
  const analysisRef = useRef(null); // { id, promise } — extracted text is reused by generate()

  // Extract + inspect a material once (cached) so the generate sheet can show
  // what it supports and detect question banks without a second download.
  const analyze = useCallback((resource) => {
    if (!resource?.id) return Promise.resolve(null);
    if (analysisRef.current?.id === resource.id) return analysisRef.current.promise;
    const promise = extractResourceText(resource).then(({ text, images, pageStarts }) => ({
      text, images, pageStarts: pageStarts || [], chars: text.length,
      pages: pageStarts?.length || 0,
      existingCount: countExistingMcqs(text),
    }));
    promise.catch(() => { if (analysisRef.current?.promise === promise) analysisRef.current = null; });
    analysisRef.current = { id: resource.id, promise };
    return promise;
  }, []);

  const generate = useCallback(async (resource, kind, onSave, existingMcqData, genOptions = null) => {
    if (!resource || !onSave) return;
    if (activeRef.current) return; // prevent concurrent generations
    activeRef.current = resource.id;
    abortRef.current = new AbortController();
    lastResourceRef.current = resource;
    lastKindRef.current = kind;
    lastOnSaveRef.current = onSave;
    lastOptionsRef.current = genOptions;
    setGeneratingId(resource.id);
    setGenError("");
    setGenErrorId(null);
    setStreamText(null);
    setStreamDone(false);
    setDraftRows(null);
    setDraftDone(false);

    try {
      const baseTitle = resource.title || "Material";
      const baseSubject = resource.subject || "";
      let finalMcqRows = null; // hoisted so the success path can swap the draft

      if (kind === "mcqs") {
        let mcqRows = null;

        if (existingMcqData && Array.isArray(existingMcqData) && existingMcqData.length > 0) {
          mcqRows = existingMcqData;
          setGenProgress(`Using ${mcqRows.length} existing questions…`);
        } else {
          // Open the draft deck instantly — question cards stream in as the AI
          // writes them, and the user can preview-run the partial bank.
          setDraftTitle(`${baseTitle} — Practice Questions`);
          setDraftRows([]);
          setGenProgress("Extracting text from material…");
          const analysis = genOptions ? await analyze(resource) : null;
          const { text: fullText, images } = analysis || await extractResourceText(resource);
          let text = fullText;
          const pr = genOptions?.pageRange;
          if (pr && analysis?.pageStarts?.length) {
            const ps = analysis.pageStarts;
            const from = Math.max(1, Math.min(pr.from || 1, ps.length));
            const to = Math.max(from, Math.min(pr.to || ps.length, ps.length));
            const sliced = fullText.slice(ps[from - 1], to < ps.length ? ps[to] : undefined);
            if (sliced.trim().length > 200) text = sliced;
          }
          ensureNotAbortedLocal(abortRef.current?.signal);
          setGenProgress("Generating Practice Questions…");
          const { rows, warnings } = await generateMcqs(text, images, setGenProgress, {
            signal: abortRef.current?.signal,
            onRows: (rows) => setDraftRows((prev) => (prev == null ? prev : [...prev, ...rows])),
            ...(genOptions ? {
              rich: true,
              autoTarget: genOptions.mode === "auto" ? genOptions.count : null,
              customCount: genOptions.mode === "custom" ? genOptions.count : null,
              style: genOptions.style, difficulty: genOptions.difficulty,
              realWorld: genOptions.realWorld, highYield: genOptions.highYield,
              focusTopic: genOptions.focusTopic, verify: !!genOptions.verify,
            } : {}),
          });
          mcqRows = rows;
          if (warnings?.length) setGenProgress(warnings[0]);
        }
        finalMcqRows = mcqRows;

        setGenProgress(`Generated ${mcqRows.length} questions ✓ — saving…`);

        if (abortRef.current?.signal.aborted) return;
        onSave({
          title: `${baseTitle} — Practice Questions`,
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
      if (kind === "mcqs") {
        // Swap the draft preview for the authoritative deduped set — the deck
        // overlay stays open and its bar enables the real deck's recall/live.
        setDraftRows((prev) => (prev == null ? prev : finalMcqRows || []));
        setDraftDone(true);
      }
    } catch (err) {
      setStreamText(null); // close overlays on cancel AND on failure —
      setDraftRows(null);  // otherwise they spin on "Preparing…" forever
      if (!err.stoppedByUser) {
        setGenError(err.message || "AI generation failed. Try again.");
        setGenErrorId(resource.id);
      }
      setGenProgress("");
    } finally {
      activeRef.current = null;
      abortRef.current = null;
      setGeneratingId(null);
    }
  }, [analyze]);

  // Stop the in-flight generation (abort the AI stream and close the overlay)
  const cancel = useCallback(() => {
    abortRef.current?.abort(new DOMException("Stopped", "AbortError"));
    setStreamText(null);
    setDraftRows(null);
    setDraftDone(false);
  }, []);

  // Dismiss the finished streaming view
  const closeStream = useCallback(() => {
    setStreamText(null);
    setStreamDone(false);
  }, []);

  // Dismiss the finished Practice Questions draft deck (stop mid-run uses cancel()).
  const closeDraft = useCallback(() => {
    setDraftRows(null);
    setDraftDone(false);
  }, []);

  const retry = useCallback(() => {
    const resource = lastResourceRef.current;
    const kind = lastKindRef.current;
    const onSave = lastOnSaveRef.current;
    if (resource && kind && onSave) {
      generate(resource, kind, onSave, null, lastOptionsRef.current);
    }
  }, [generate]);

  const clearError = useCallback(() => {
    setGenError("");
    setGenErrorId(null);
  }, []);

  return { generatingId, genProgress, genError, genErrorId, streamText, streamTitle, streamDone, draftRows, draftTitle, draftDone, generate, analyze, retry, cancel, closeStream, closeDraft, clearError };
}
