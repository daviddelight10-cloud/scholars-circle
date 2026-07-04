import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

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
  if (!show) return null;

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleFileSelected = (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert("File too large — 50MB max"); return; }
    setUploadFile(file);
    const ext = file.name.split(".").pop()?.toLowerCase();
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
              {uploading ? "Submitting..." : "Submit MCQs"}
            </button>
          </>
        )}

        <p style={sharedStyles.modalFootnote}>
          Your upload will appear in My Uploads. Student uploads require moderator approval before going public; teacher/lecturer uploads go live immediately.
        </p>
      </div>
    </div>
  );
}
