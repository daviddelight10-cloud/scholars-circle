import { useState, useRef, useEffect } from "react";
import { extractFileText } from "../../lib/extractFileText";
import { generateMcqs, MAX_QUESTIONS } from "../../lib/generationCore";

const emptyMcqRow = () => ({ question: "", options: { A: "", B: "", C: "", D: "" }, correct: "A", explanation: "" });

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
  const [aiQuestionCount, setAiQuestionCount] = useState("");
  const aiFileInputRef = useRef(null);
  const [aiDragOver, setAiDragOver] = useState(false);

  useEffect(() => {
    if (show) {
      setAiFile(null);
      setAiGenerating(false);
      setAiProgress("");
      setAiError("");
      setAiWarning("");
      setAiQuestionCount("");
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

  const generateAiMcqs = async () => {
    if (!aiFile) { setAiError("Upload a file first"); return; }
    setAiGenerating(true);
    setAiError("");
    setAiWarning("");
    setAiProgress("Extracting text from file…");

    try {
      const { text, images } = await extractFileText(aiFile, 15);
      const customCount = aiQuestionCount !== "" && !Number.isNaN(parseInt(aiQuestionCount, 10)) ? Math.max(1, Math.min(MAX_QUESTIONS, parseInt(aiQuestionCount, 10))) : null;

      const { rows, warnings } = await generateMcqs(text, images, setAiProgress, {
        customCount,
        onWarning: setAiWarning,
      });

      if (rows.length === 0) throw new Error("AI couldn't generate questions from this content. Try a different file.");

      setMcqRows(rows);
      setAiProgress(`Generated ${rows.length} questions ✓ — review, edit, or submit below`);
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-[540px] max-h-[88vh] overflow-y-auto rounded-2xl border border-gold-border bg-hub-surface p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-xl font-bold text-gold">Add material</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-base text-hub-text-muted transition-colors hover:text-hub-text">✕</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {[["pdf", "PDF"], ["image", "Image"], ["docx", "DOCX"], ["pptx", "PPTX"], ["txt", "TXT"], ["note", "Note"], ["mcq", "MCQ set"]].map(([key, label]) => (
            <button key={key} onClick={() => setUploadType(key)} className={`cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
              uploadType === key ? "bg-gold-dim border border-gold-border text-gold" : "border border-hub-border text-hub-text-dim"
            }`}>{label}</button>
          ))}
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Title</label>
          <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Upper Limb — Brachial Plexus Notes" className="w-full rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold" />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Subject / course code</label>
          <input list="subjectOptions" value={uploadSubject} onChange={(e) => setUploadSubject(e.target.value)} placeholder="e.g. BIO 111" className="w-full rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold" />
          <datalist id="subjectOptions">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </div>

        {uploadType === "note" ? (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Note content</label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Write your note here…"
                className="min-h-[120px] resize-y rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold"
              />
            </div>
            <button onClick={onSubmitFile} disabled={uploading || !uploadDescription.trim()} className={`w-full rounded-lg py-3 text-sm font-bold transition-all active:scale-95 ${
              uploading || !uploadDescription.trim() ? "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-50" : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
            }`}>
              {uploading ? "Uploading..." : "Publish note"}
            </button>
          </>
        ) : uploadType !== "mcq" ? (
          <>
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                dragOver ? "border-gold-border bg-gold-dim" : uploadFile ? "border-[#22c55e]/40" : "border-hub-border"
              }`}
            >
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.pptx,.webp,.gif,.bmp" onChange={handleFilePick} className="hidden" ref={fileInputRef} />
              {uploadPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={uploadPreview} alt="Preview" className="max-h-[160px] max-w-full rounded-md object-contain" />
                  <span className="text-[11px] text-[#22c55e]">✓ {uploadFile.name}</span>
                </div>
              ) : uploadFile ? (
                <span className="text-[13px] text-[#22c55e]">✓ {uploadFile.name}</span>
              ) : (
                <span className="text-[13px] text-hub-text-dim">
                  {dragOver ? "Drop file here" : "Tap to choose or drag a file · PDF, JPG, PNG, DOCX · max 20MB"}
                </span>
              )}
            </label>

            {uploading && (
              <div className="mb-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-hub-bg">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#b8860b] to-gold transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="mt-1 text-center text-[10px] text-gold">{uploadProgress}%</div>
              </div>
            )}

            <button onClick={onSubmitFile} disabled={uploading || !uploadFile} className={`mt-3 w-full rounded-lg py-3 text-sm font-bold transition-all active:scale-95 ${
              uploading || !uploadFile ? "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-50" : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
            }`}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </>
        ) : (
          <>
            {/* AI Generation Section */}
            <div className="mb-3 rounded-lg border border-gold-border bg-hub-bg p-3">
              <div className="mb-2 text-[11px] font-bold text-gold">
                ✨ Generate MCQs from a file with AI
              </div>
              <p className="mb-2 text-[10px] leading-relaxed text-hub-text-muted">
                Upload a PDF, DOCX, TXT, PPTX, or image — AI will extract and generate up to {MAX_QUESTIONS} questions automatically, or a specific number you choose below. If your document already contains questions, AI will extract them as-is instead of generating new ones. Large documents are split into sections and processed in parallel for speed.
              </p>

              <div className="mb-2">
                <label className="mb-1 block text-[10px] text-hub-text-muted">
                  Number of questions (optional — leave blank for auto)
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_QUESTIONS}
                  value={aiQuestionCount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { setAiQuestionCount(""); return; }
                    const num = parseInt(v, 10);
                    if (Number.isNaN(num)) return;
                    setAiQuestionCount(Math.max(1, Math.min(MAX_QUESTIONS, num)));
                  }}
                  placeholder={`Auto (up to ${MAX_QUESTIONS})`}
                  className="w-full max-w-[180px] rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none focus:border-gold"
                />
              </div>

              {/* AI file dropzone */}
              <label
                onDrop={handleAiDrop}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAiDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setAiDragOver(false); }}
                className={`block cursor-pointer rounded-lg border-1.5 border-dashed p-4 text-center transition-all ${
                  aiDragOver ? "border-gold-border bg-gold-dim" : aiFile ? "border-[#22c55e]/40" : "border-hub-border"
                }`}
              >
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.pptx,.webp,.gif,.bmp" onChange={handleAiFilePick} className="hidden" ref={aiFileInputRef} />
                {aiFile ? (
                  <span className="text-[13px] text-[#22c55e]">✓ {aiFile.name} ({(aiFile.size / 1024).toFixed(0)} KB)</span>
                ) : (
                  <span className="text-[13px] text-hub-text-dim">
                    {aiDragOver ? "Drop file here" : "📎 Tap or drag a file for AI generation"}
                  </span>
                )}
              </label>

              {aiError && (
                <div className="mb-2 rounded-md bg-[#ef4444]/10 px-2.5 py-1.5 text-[10px] text-[#ef4444]">{aiError}</div>
              )}

              {aiProgress && !aiGenerating && (
                <div className="mb-2 rounded-md bg-[#22c55e]/10 px-2.5 py-1.5 text-[10px] text-[#22c55e]">{aiProgress}</div>
              )}

              {aiWarning && !aiGenerating && (
                <div className="mb-2 rounded-md border border-[#facc15]/30 bg-[#facc15]/8 px-2.5 py-1.5 text-[10px] text-[#facc15]">{aiWarning}</div>
              )}

              {aiGenerating && (
                <div className="mb-2">
                  <div className="mb-1 text-center text-[10px] text-gold">{aiProgress}</div>
                  <div className="h-1 overflow-hidden rounded-full bg-hub-surface">
                    <div className="h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, transparent, #FFD700, transparent)", animation: "shimmer 1.5s infinite" }} />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={generateAiMcqs}
                  disabled={aiGenerating || !aiFile}
                  className={`flex-1 cursor-pointer rounded-lg border border-gold-border py-2.5 text-[13px] font-bold transition-all active:scale-95 ${
                    aiGenerating || !aiFile ? "cursor-not-allowed bg-gold-dim text-gold opacity-50" : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
                  }`}
                >
                  {aiGenerating ? "Generating…" : "🤖 Generate MCQs"}
                </button>
                {mcqRows.some((r) => r.question.trim()) && (
                  <button
                    onClick={onSubmitMcq}
                    disabled={uploading}
                    className="cursor-pointer whitespace-nowrap rounded-lg border border-gold-border bg-gold-dim px-4 py-2.5 text-[13px] font-bold text-gold transition-all active:scale-95"
                  >
                    {uploading ? "Submitting…" : `Quick Submit (${mcqRows.filter((r) => r.question.trim()).length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-hub-border" />
              <span className="text-[10px] font-semibold text-hub-text-dim">OR ADD MANUALLY</span>
              <div className="h-px flex-1 bg-hub-border" />
            </div>

            {/* MCQ count badge */}
            {mcqRows.filter((r) => r.question.trim()).length > 0 && (
              <div className="mb-2 text-[10px] font-semibold text-gold">
                {mcqRows.filter((r) => r.question.trim()).length} question{mcqRows.filter((r) => r.question.trim()).length !== 1 ? "s" : ""} ready
              </div>
            )}

            {/* Editable MCQ rows */}
            {mcqRows.map((row, i) => (
              <div key={i} className="mb-2 rounded-lg border border-hub-border bg-hub-bg p-3">
                <div className="mb-2 flex justify-between">
                  <span className="text-[11px] font-semibold text-hub-text-muted">Question {i + 1}</span>
                  {mcqRows.length > 1 && <button onClick={() => removeMcqRow(i)} className="cursor-pointer border-none bg-transparent text-[10px] text-[#ef9a9a]">Remove</button>}
                </div>
                <input value={row.question} onChange={(e) => updateMcqRow(i, { question: e.target.value })} placeholder="Question text" className="mb-2 w-full rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none focus:border-gold" />
                {Object.entries(row.options).map(([key, value]) => (
                  <div key={key} className="mb-1.5 flex items-center gap-2">
                    <input type="radio" name={`correct-${i}`} checked={row.correct === key} onChange={() => updateMcqRow(i, { correct: key })} title="Mark as correct" className="accent-gold" />
                    <span className={`w-4 text-[10px] font-bold ${row.correct === key ? "text-[#22c55e]" : "text-hub-text-dim"}`}>{key}</span>
                    <input value={value} onChange={(e) => updateMcqOption(i, key, e.target.value)} placeholder={`Option ${key}`} className="flex-1 rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none focus:border-gold" />
                  </div>
                ))}
                <textarea value={row.explanation} onChange={(e) => updateMcqRow(i, { explanation: e.target.value })} placeholder="Brief explanation (optional but recommended)" className="mt-1.5 min-h-[50px] resize-y w-full rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none focus:border-gold" />
              </div>
            ))}
            <button onClick={addMcqRow} className="mb-3 w-full cursor-pointer rounded-xl border border-dashed border-hub-border bg-transparent py-2.5 text-[13px] font-semibold text-hub-text-muted">+ Add another question</button>

            {uploading && (
              <div className="mb-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-hub-bg">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#b8860b] to-gold transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <button onClick={onSubmitMcq} disabled={uploading} className={`w-full rounded-lg py-3 text-sm font-bold transition-all active:scale-95 ${
              uploading ? "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-50" : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
            }`}>
              {uploading ? "Submitting..." : `Submit MCQs (${mcqRows.filter((r) => r.question.trim()).length})`}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-[10px] leading-relaxed text-hub-text-dim">
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
