import { useState, useRef, useEffect } from "react";
import { callAI, callAIMultimodal, extractJSON } from "../../lib/aiClient";
import { extractFileText, chunkText } from "../../lib/extractFileText";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

const emptyMcqRow = () => ({ question: "", options: { A: "", B: "", C: "", D: "" }, correct: "A", explanation: "" });

const MAX_QUESTIONS = 300;
const QUESTIONS_PER_CHUNK = 50;
const CONCURRENCY_LIMIT = 3;
const MAX_CHUNKS = 15;
const MIN_CHUNK_SIZE = 5000;

export default function UploadModal({
  show, onClose,
  uploadType, setUploadType,
  uploadTitle, setUploadTitle,
  uploadSubject, setUploadSubject,
  uploadFile, setUploadFile,
  uploadDescription, setUploadDescription,
  uploadPreview, setUploadPreview,
  uploadProgress, setUploadProgress,
  uploading, setUploading,
  dragOver, setDragOver,
  mcqRows, setMcqRows,
  subjects,
  fileInputRef,
  onSubmitFile, onSubmitMcq,
}) {
  const [aiFile, setAiFile] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiWarning, setAiWarning] = useState("");
  const aiFileInputRef = useRef(null);
  const [aiDragOver, setAiDragOver] = useState(false);

  useEffect(() => {
    if (show) {
      setAiFile(null);
      setAiGenerating(false);
      setAiProgress("");
      setAiError("");
      setAiWarning("");
      setAiDragOver(false);
    }
  }, [show]);

  if (!show) return null;

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleFileSelected = (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert("File too large — 50MB max"); return; }
    setUploadFile(file);
    const detected = extToContentType(file.name);
    if (detected) setUploadType(detected);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setUploadPreview(url);
    } else {
      setUploadPreview(null);
    }
  };

  const extToContentType = (filename) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["pdf"].includes(ext)) return "pdf";
    if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) return "image";
    if (["docx", "doc"].includes(ext)) return "docx";
    if (["pptx"].includes(ext)) return "pptx";
    if (["txt"].includes(ext)) return "txt";
    return null;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  // ── AI MCQ Generation ──────────────────────────────────────────────────────

  const handleAiFilePick = (e) => {
    const file = e.target.files?.[0];
    if (file) handleAiFileSelected(file);
  };

  const handleAiFileSelected = (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setAiError("File too large — 50MB max"); return; }
    setAiFile(file);
    setAiError("");
  };

  const handleAiDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAiDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleAiFileSelected(file);
  };

  const buildMcqPrompt = (text, questionCount) => {
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
  };

  const mapAiMcqsToRows = (parsed) => {
    if (!Array.isArray(parsed)) {
      if (parsed && Array.isArray(parsed.mcq_questions)) {
        parsed = parsed.mcq_questions;
      } else {
        return [];
      }
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
  };

  const generateAiMcqs = async () => {
    if (!aiFile) { setAiError("Upload a file first"); return; }
    setAiGenerating(true);
    setAiError("");
    setAiProgress("Extracting text from file…");

    try {
      const { text, images } = await extractFileText(aiFile, 15);

      // Image-based: send images to multimodal AI
      if (images.length > 0 && text.length < 50) {
        setAiProgress(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
        const prompt = buildMcqPrompt("The images contain study material. Generate comprehensive MCQs covering all the content visible.", Math.min(QUESTIONS_PER_CHUNK, MAX_QUESTIONS));
        const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
        const parsed = extractJSON(raw, "array");
        const rows = mapAiMcqsToRows(parsed);
        if (rows.length === 0) throw new Error("AI didn't generate valid questions. Try again.");
        setMcqRows(rows);
        setAiProgress(`Generated ${rows.length} questions ✓`);
        return;
      }

      if (!text.trim()) throw new Error("No text could be extracted from this file.");

      // Text-based: chunk and generate in concurrency-limited batches
      const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(text.length / MAX_CHUNKS));
      const chunks = chunkText(text, chunkSize);
      const totalPossible = chunks.length * QUESTIONS_PER_CHUNK;
      const targetCount = Math.min(MAX_QUESTIONS, totalPossible);
      const questionsPerChunk = Math.ceil(targetCount / chunks.length);

      setAiProgress(`Generating MCQs from ${chunks.length} section${chunks.length > 1 ? "s" : ""}… (up to ${targetCount} questions)`);
      setAiWarning("");

      // Process chunks in concurrency-limited batches to avoid rate-limit (429) errors
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

      let allRows = chunkResults.flatMap((r) => r.rows).slice(0, MAX_QUESTIONS);

      // Adaptive retry: if total < 50% of target, retry underproducing chunks with halved counts
      if (allRows.length < targetCount * 0.5 && allRows.length < MAX_QUESTIONS) {
        const underproducing = chunkResults
          .map((r, idx) => ({ idx, requested: r.requested, produced: r.rows.length, error: r.error }))
          .filter((r) => r.produced < r.requested * 0.5);

        if (underproducing.length > 0) {
          setAiProgress(`Retrying ${underproducing.length} section${underproducing.length > 1 ? "s" : ""} with fewer questions…`);
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
          allRows = [...allRows, ...retryRows.flat()].slice(0, MAX_QUESTIONS);
        }
      }

      // Build warning if chunks underproduced
      const failedChunks = chunkResults.filter((r) => r.rows.length === 0).length;
      const lowChunks = chunkResults.filter((r) => r.rows.length > 0 && r.rows.length < r.requested * 0.5).length;
      if (failedChunks > 0 || lowChunks > 0) {
        const parts = [];
        if (failedChunks > 0) parts.push(`${failedChunks} section${failedChunks > 1 ? "s" : ""} failed`);
        if (lowChunks > 0) parts.push(`${lowChunks} section${lowChunks > 1 ? "s" : ""} produced fewer questions than requested`);
        setAiWarning(`⚠️ ${parts.join(" and ")} — some content may not be fully covered.`);
        console.warn("MCQ generation stats:", chunkResults.map((r, i) => ({ chunk: i, requested: r.requested, produced: r.rows.length, error: r.error })));
      }

      if (allRows.length === 0) throw new Error("AI couldn't generate questions from this content. Try a different file.");

      setMcqRows(allRows);
      setAiProgress(`Generated ${allRows.length} questions ✓ — review, edit, or submit below`);
    } catch (err) {
      setAiError(err.message || "AI generation failed. Try again.");
      setAiProgress("");
    } finally {
      setAiGenerating(false);
    }
  };

  // ── MCQ row helpers ────────────────────────────────────────────────────────

  const updateMcqRow = (index, patch) =>
    setMcqRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const updateMcqOption = (rowIndex, optKey, value) =>
    setMcqRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, options: { ...row.options, [optKey]: value } } : row)));
  const addMcqRow = () => setMcqRows((prev) => [...prev, emptyMcqRow()]);
  const removeMcqRow = (index) => setMcqRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  return (
    <div style={sharedStyles.overlay} onClick={onClose}>
      <div style={sharedStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
          <h2 style={sharedStyles.modalTitle}>Add material</h2>
          <button onClick={onClose} style={sharedStyles.closeBtn}>✕</button>
        </div>

        <div style={sharedStyles.segmentRow}>
          {[["pdf", "PDF"], ["image", "Image"], ["docx", "DOCX"], ["pptx", "PPTX"], ["txt", "TXT"], ["note", "Note"], ["mcq", "MCQ set"]].map(([key, label]) => (
            <button key={key} onClick={() => setUploadType(key)} style={uploadType === key ? sharedStyles.segActive : sharedStyles.seg}>{label}</button>
          ))}
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <label style={sharedStyles.fieldLabel}>Title</label>
          <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Upper Limb — Brachial Plexus Notes" style={sharedStyles.input} />
        </div>
        <div style={{ marginBottom: spacing.md }}>
          <label style={sharedStyles.fieldLabel}>Subject / course code</label>
          <input list="subjectOptions" value={uploadSubject} onChange={(e) => setUploadSubject(e.target.value)} placeholder="e.g. BIO 111" style={sharedStyles.input} />
          <datalist id="subjectOptions">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </div>

        {uploadType === "note" ? (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <label style={sharedStyles.fieldLabel}>Note content</label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Write your note here…"
                style={{ ...sharedStyles.input, minHeight: "120px", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <button onClick={onSubmitFile} disabled={uploading || !uploadDescription.trim()} style={{ ...sharedStyles.submit, opacity: uploading || !uploadDescription.trim() ? 0.5 : 1, cursor: uploading || !uploadDescription.trim() ? "not-allowed" : "pointer" }}>
              {uploading ? "Uploading..." : "Publish note"}
            </button>
          </>
        ) : uploadType !== "mcq" ? (
          <>
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                ...sharedStyles.dropzone,
                borderColor: dragOver ? colors.borderActive : uploadFile ? colors.successBorder : colors.border,
                background: dragOver ? "#1a1a00" : colors.bg,
              }}
            >
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.pptx,.webp,.gif,.bmp" onChange={handleFilePick} style={{ display: "none" }} ref={fileInputRef} />
              {uploadPreview ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: spacing.sm }}>
                  <img src={uploadPreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: borderRadius.sm, objectFit: "contain" }} />
                  <span style={{ fontSize: fontSize.sm, color: colors.success }}>✓ {uploadFile.name}</span>
                </div>
              ) : uploadFile ? (
                <span style={{ fontSize: fontSize.base, color: colors.success }}>✓ {uploadFile.name}</span>
              ) : (
                <span style={{ fontSize: fontSize.base, color: colors.textDim }}>
                  {dragOver ? "Drop file here" : "Tap to choose or drag a file · PDF, JPG, PNG, DOCX · max 20MB"}
                </span>
              )}
            </label>

            {uploading && (
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ height: "6px", background: colors.bg, borderRadius: borderRadius.sm, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #b8860b, #FFD700)", borderRadius: borderRadius.sm, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: fontSize.xs, color: goldText, textAlign: "center", marginTop: spacing.xs }}>{uploadProgress}%</div>
              </div>
            )}

            <button onClick={onSubmitFile} disabled={uploading || !uploadFile} style={{ ...sharedStyles.submit, opacity: uploading || !uploadFile ? 0.5 : 1, cursor: uploading || !uploadFile ? "not-allowed" : "pointer" }}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </>
        ) : (
          <>
            {/* AI Generation Section */}
            <div style={{ background: colors.bg, border: `0.5px solid ${goldBorder}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: goldText, marginBottom: spacing.sm }}>
                ✨ Generate MCQs from a file with AI
              </div>
              <p style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 1.5 }}>
                Upload a PDF, DOCX, TXT, PPTX, or image — AI will extract and generate up to {MAX_QUESTIONS} questions automatically. Large documents are split into sections and processed in parallel for speed.
              </p>

              {/* AI file dropzone */}
              <label
                onDrop={handleAiDrop}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAiDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setAiDragOver(false); }}
                style={{
                  display: "block", textAlign: "center", padding: "16px 12px",
                  border: `1.5px dashed ${aiDragOver ? colors.borderActive : aiFile ? colors.successBorder : colors.border}`,
                  borderRadius: borderRadius.md, cursor: "pointer", marginBottom: spacing.sm, transition: "all 0.15s",
                  background: aiDragOver ? "#1a1a00" : "transparent",
                }}
              >
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.pptx,.webp,.gif,.bmp" onChange={handleAiFilePick} style={{ display: "none" }} ref={aiFileInputRef} />
                {aiFile ? (
                  <span style={{ fontSize: fontSize.base, color: colors.success }}>✓ {aiFile.name} ({(aiFile.size / 1024).toFixed(0)} KB)</span>
                ) : (
                  <span style={{ fontSize: fontSize.base, color: colors.textDim }}>
                    {aiDragOver ? "Drop file here" : "📎 Tap or drag a file for AI generation"}
                  </span>
                )}
              </label>

              {aiError && (
                <div style={{ fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.sm, padding: "6px 10px", background: colors.dangerBg, borderRadius: borderRadius.sm }}>
                  {aiError}
                </div>
              )}

              {aiProgress && !aiGenerating && (
                <div style={{ fontSize: fontSize.xs, color: colors.success, marginBottom: spacing.sm, padding: "6px 10px", background: colors.successBg, borderRadius: borderRadius.sm }}>
                  {aiProgress}
                </div>
              )}

              {aiWarning && !aiGenerating && (
                <div style={{ fontSize: fontSize.xs, color: "#facc15", marginBottom: spacing.sm, padding: "6px 10px", background: "rgba(250, 204, 21, 0.08)", border: "0.5px solid rgba(250, 204, 21, 0.3)", borderRadius: borderRadius.sm }}>
                  {aiWarning}
                </div>
              )}

              {aiGenerating && (
                <div style={{ marginBottom: spacing.sm }}>
                  <div style={{ fontSize: fontSize.xs, color: goldText, textAlign: "center", marginBottom: spacing.xs }}>{aiProgress}</div>
                  <div style={{ height: "4px", background: colors.surface, borderRadius: borderRadius.sm, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, transparent, #FFD700, transparent)", borderRadius: borderRadius.sm, animation: "shimmer 1.5s infinite" }} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: spacing.sm }}>
                <button
                  onClick={generateAiMcqs}
                  disabled={aiGenerating || !aiFile}
                  style={{
                    flex: 1, padding: "10px", borderRadius: borderRadius.md,
                    background: aiGenerating || !aiFile ? goldDim : "linear-gradient(135deg, #b8860b, #FFD700)",
                    border: `0.5px solid ${goldBorder}`,
                    fontSize: fontSize.base, fontWeight: fontWeight.bold,
                    color: aiGenerating || !aiFile ? goldText : "#0a0a0a",
                    cursor: aiGenerating || !aiFile ? "not-allowed" : "pointer",
                  }}
                >
                  {aiGenerating ? "Generating…" : "🤖 Generate MCQs"}
                </button>
                {mcqRows.some((r) => r.question.trim()) && (
                  <button
                    onClick={onSubmitMcq}
                    disabled={uploading}
                    style={{
                      padding: "10px 16px", borderRadius: borderRadius.md,
                      background: goldDim, border: `0.5px solid ${goldBorder}`,
                      fontSize: fontSize.base, fontWeight: fontWeight.bold, color: goldText,
                      cursor: uploading ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    {uploading ? "Submitting…" : `Quick Submit (${mcqRows.filter((r) => r.question.trim()).length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
              <div style={{ flex: 1, height: "0.5px", background: colors.border }} />
              <span style={{ fontSize: fontSize.xs, color: colors.textDim, fontWeight: fontWeight.semibold }}>OR ADD MANUALLY</span>
              <div style={{ flex: 1, height: "0.5px", background: colors.border }} />
            </div>

            {/* MCQ count badge */}
            {mcqRows.filter((r) => r.question.trim()).length > 0 && (
              <div style={{ fontSize: fontSize.xs, color: goldText, marginBottom: spacing.sm, fontWeight: fontWeight.semibold }}>
                {mcqRows.filter((r) => r.question.trim()).length} question{mcqRows.filter((r) => r.question.trim()).length !== 1 ? "s" : ""} ready
              </div>
            )}

            {/* Editable MCQ rows */}
            {mcqRows.map((row, i) => (
              <div key={i} style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
                  <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Question {i + 1}</span>
                  {mcqRows.length > 1 && <button onClick={() => removeMcqRow(i)} style={{ background: "none", border: "none", color: "#ef9a9a", fontSize: fontSize.xs, cursor: "pointer" }}>Remove</button>}
                </div>
                <input value={row.question} onChange={(e) => updateMcqRow(i, { question: e.target.value })} placeholder="Question text" style={{ ...sharedStyles.input, marginBottom: spacing.sm }} />
                {Object.entries(row.options).map(([key, value]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: "6px" }}>
                    <input type="radio" name={`correct-${i}`} checked={row.correct === key} onChange={() => updateMcqRow(i, { correct: key })} title="Mark as correct" style={{ accentColor: colors.borderActive }} />
                    <span style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: row.correct === key ? colors.success : colors.textDim, width: "16px" }}>{key}</span>
                    <input value={value} onChange={(e) => updateMcqOption(i, key, e.target.value)} placeholder={`Option ${key}`} style={{ ...sharedStyles.input, flex: 1 }} />
                  </div>
                ))}
                <textarea value={row.explanation} onChange={(e) => updateMcqRow(i, { explanation: e.target.value })} placeholder="Brief explanation (optional but recommended)" style={{ ...sharedStyles.input, minHeight: "50px", resize: "vertical", marginTop: "6px" }} />
              </div>
            ))}
            <button onClick={addMcqRow} style={{ width: "100%", padding: "10px", borderRadius: borderRadius.lg, border: `1px dashed ${colors.border}`, background: "none", color: colors.textMuted, fontSize: fontSize.base, fontWeight: fontWeight.semibold, cursor: "pointer", marginBottom: spacing.md }}>+ Add another question</button>

            {uploading && (
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ height: "6px", background: colors.bg, borderRadius: borderRadius.sm, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #b8860b, #FFD700)", borderRadius: borderRadius.sm, transition: "width 0.2s" }} />
                </div>
              </div>
            )}

            <button onClick={onSubmitMcq} disabled={uploading} style={{ ...sharedStyles.submit, opacity: uploading ? 0.5 : 1, cursor: uploading ? "not-allowed" : "pointer" }}>
              {uploading ? "Submitting..." : `Submit MCQs (${mcqRows.filter((r) => r.question.trim()).length})`}
            </button>
          </>
        )}

        <p style={sharedStyles.modalFootnote}>
          Your upload will appear in My Uploads. Student uploads require moderator approval before going public; teacher/lecturer uploads go live immediately.
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
