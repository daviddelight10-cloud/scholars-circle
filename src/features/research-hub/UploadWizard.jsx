import { useState, useRef, useEffect } from "react";
import { convertToPdf } from "../../lib/convertToPdf";
import { detectFileType, typeToContentType } from "../../lib/detectMimeType";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText, gold } from "./constants";
import { PRESET_SUBJECTS } from "./constants";

const ACCEPTED_EXTS = ".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.pptx,.webp,.gif,.bmp";

function stripExt(filename) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.substring(0, idx) : filename;
}

const STEP_LABELS = ["Import", "Details"];

export default function UploadWizard({
  show,
  onClose,
  folders,
  presetFolderId,
  userProfile,
  onUploadFile,
  uploading,
  uploadProgress,
  uploadError,
  onClearUploadError,
  onCreateFolder,
}) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isNote, setIsNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState("");
  const [convertError, setConvertError] = useState("");
  const [genError, setGenError] = useState("");
  const [destFolderId, setDestFolderId] = useState("");
  const [titleError, setTitleError] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [showNewSpaceInput, setShowNewSpaceInput] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceCourseCode, setNewSpaceCourseCode] = useState("");
  const [creatingSpace, setCreatingSpace] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (show) {
      setStep(1);
      setFile(null);
      setIsNote(false);
      setNoteContent("");
      setDragOver(false);
      setTitle("");
      setSubject("");
      setCustomSubject("");
      setConverting(false);
      setConvertProgress("");
      setConvertError("");
      setGenError("");
      const firstFolderId = folders?.own?.[0]?.id || folders?.shared?.[0]?.id || "";
      setDestFolderId(presetFolderId || firstFolderId);
      setTitleError("");
      setSubjectError("");
      setSaveError("");
      setIsPublic(true);
      setShowNewSpaceInput(!presetFolderId && !firstFolderId);
      setNewSpaceName("");
      setNewSpaceCourseCode("");
      setCreatingSpace(false);
      if (onClearUploadError) onClearUploadError();
    }
  }, [show, presetFolderId]);

  if (!show) return null;

  // ── Step 1: File handling ──────────────────────────────────────────────────

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelected(f);
  };

  const handleFileSelected = async (f) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setGenError("File too large — 50MB max"); return; }
    setGenError("");
    setConvertError("");

    // Show immediate UI feedback before async detection
    setFile(f);
    setTitle(stripExt(f.name));
    setConverting(true);
    setConvertProgress("Reading file…");

    const detectedType = await detectFileType(f);
    if (detectedType === "unknown") {
      setConverting(false);
      setConvertProgress("");
      setGenError("Unsupported file type. Please upload PDF, DOCX, TXT, PPTX, or an image.");
      return;
    }

    const needsConvert = !["image", "pdf", "doc"].includes(detectedType) && !f.name.toLowerCase().endsWith(".json");

    if (needsConvert) {
      setConvertProgress("Converting to PDF…");
      try {
        const result = await convertToPdf(f, (status) => setConvertProgress(status));
        if (result) {
          const pdfFile = new File([result.pdfBlob], result.fileName, { type: "application/pdf" });
          setFile(pdfFile);
          setTitle(stripExt(result.fileName));
          setConvertProgress("");
        }
      } catch (err) {
        setConvertError(err.message || "Conversion failed — you can still use the original file");
        setFile(f);
        setTitle(stripExt(f.name));
      } finally {
        setConverting(false);
        setConvertProgress("");
      }
    } else {
      // Materialize the file into an in-memory Blob before storing it.
      // On some mobile devices, files picked from cloud-backed sources (Google
      // Drive, "Recent" downloads, etc.) return a File/Blob that is lazily
      // streamed from a content provider over the network when actually read.
      // If that happens during the real upload, it surfaces as a generic
      // "network error" even though the actual failure is reading the file
      // locally. Reading it fully here decouples storage from upload.
      try {
        setConvertProgress("Reading file…");
        const buffer = await f.arrayBuffer();
        const materializedFile = new File([buffer], f.name, { type: f.type || "application/octet-stream" });
        setFile(materializedFile);
      } catch (err) {
        setConvertError("Could not read the selected file — please try picking it again");
        setFile(f);
      } finally {
        setConverting(false);
        setConvertProgress("");
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelected(f);
  };

  const canProceedStep1 = isNote ? noteContent.trim().length > 0 : file !== null && !converting;

  // ── Step 2: Details & Save ─────────────────────────────────────────────────

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    setCreatingSpace(true);
    try {
      const newFolder = await onCreateFolder(newSpaceName.trim(), newSpaceCourseCode.trim());
      if (newFolder) {
        setDestFolderId(newFolder.id);
        setShowNewSpaceInput(false);
        setNewSpaceName("");
        setNewSpaceCourseCode("");
      }
    } catch {
      // error handled by ResearchHub toast
    } finally {
      setCreatingSpace(false);
    }
  };

  const finalSubject = subject === "Custom" ? customSubject.trim() : subject;

  const handleSave = async () => {
    setSaveError("");
    if (!title.trim()) { setSaveError("Please enter a title for your document"); return; }
    if (!finalSubject) { setSaveError("Please choose a subject"); return; }
    if (!destFolderId) { setSaveError("Please choose a space to save into, or create one"); return; }

    if (isNote) {
      if (!noteContent.trim()) { setSaveError("Your note is empty — please go back and add content"); return; }
      onUploadFile({
        title: title.trim(),
        subject: finalSubject,
        contentType: "note",
        description: noteContent.trim(),
        folderId: destFolderId || null,
        isPublic,
      });
    } else if (file) {
      const detectedType = await detectFileType(file);
      const contentType = typeToContentType(detectedType) || "pdf";
      onUploadFile({
        title: title.trim(),
        subject: finalSubject,
        contentType,
        file,
        folderId: destFolderId || null,
        isPublic,
      });
    } else {
      setSaveError("No file selected — please go back to step 1");
    }
  };

  const canSave = () => {
    if (!title.trim()) return false;
    if (!finalSubject) return false;
    if (!destFolderId) return false;
    return Boolean(isNote ? noteContent.trim() : file);
  };

  // ── Step indicator ─────────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    return (
      <div style={sharedStyles.stepIndicator}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          let style = sharedStyles.stepDot;
          if (stepNum === step) style = sharedStyles.stepDotActive;
          else if (stepNum < step) style = sharedStyles.stepDotDone;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={style} />
              {(stepNum === step || (stepNum === 1 && step > 1)) && (
                <span style={{ fontSize: fontSize.xs, color: stepNum === step ? goldText : colors.textDim, fontWeight: fontWeight.semibold }}>
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const ownFolders = folders?.own || [];
  const sharedFolders = folders?.shared || [];
  const allFolders = [...ownFolders, ...sharedFolders];

  return (
    <div style={sharedStyles.overlay} onClick={onClose}>
      <div style={sharedStyles.wizardModal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <h2 style={sharedStyles.modalTitle}>
            {step === 1 && "Add to your space"}
            {step === 2 && "Details & Save"}
          </h2>
          <button onClick={onClose} style={sharedStyles.closeBtn}>✕</button>
        </div>

        {renderStepIndicator()}

        {/* ── Step 1: Import ─────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            {!isNote ? (
              <label
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                style={{
                  ...sharedStyles.wizardDropzone,
                  borderColor: dragOver ? goldBorder : file ? colors.successBorder : colors.border,
                  background: dragOver ? goldDim : "transparent",
                }}
              >
                <input type="file" accept={ACCEPTED_EXTS} onChange={handleFilePick} style={{ display: "none" }} ref={fileInputRef} />
                {file ? (
                  <>
                    <div style={{ fontSize: 32 }}>{converting ? "⏳" : "✓"}</div>
                    <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: converting ? goldText : colors.success }}>{file.name}</div>
                    <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>{(file.size / 1024).toFixed(0)} KB{converting ? " · converting…" : ""}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 36 }}>📎</div>
                    <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text }}>
                      {dragOver ? "Drop file here" : "Drop your file here, or tap to browse"}
                    </div>
                    <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>
                      PDF, DOCX, PPTX, TXT, JPG, PNG · max 50MB
                    </div>
                  </>
                )}
              </label>
            ) : (
              <div>
                <label style={sharedStyles.fieldLabel}>Write your note</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write or paste your note here…"
                  autoFocus
                  style={{ ...sharedStyles.input, minHeight: "160px", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            )}

            {converting && (
              <div style={{ marginTop: spacing.md, textAlign: "center" }}>
                <div style={{ fontSize: fontSize.sm, color: goldText, marginBottom: spacing.xs }}>{convertProgress || "Converting to PDF…"}</div>
                <div style={{ height: "4px", background: colors.surface, borderRadius: borderRadius.sm, overflow: "hidden", maxWidth: "300px", margin: "0 auto" }}>
                  <div style={{ height: "100%", width: "100%", background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: borderRadius.sm, animation: "shimmer 1.5s infinite" }} />
                </div>
              </div>
            )}

            {convertError && !converting && (
              <div style={{ fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.md, padding: "6px 10px", background: colors.dangerBg, borderRadius: borderRadius.sm }}>
                {convertError}
              </div>
            )}

            {genError && (
              <div style={{ fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.md, padding: "6px 10px", background: colors.dangerBg, borderRadius: borderRadius.sm }}>
                {genError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg }}>
              <button
                onClick={() => { setIsNote(!isNote); setFile(null); setGenError(""); setConvertError(""); }}
                style={{ background: "none", border: "none", color: colors.textMuted, fontSize: fontSize.sm, cursor: "pointer", padding: 0 }}
              >
                {isNote ? "← Upload a file instead" : "or write a note manually →"}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                style={canProceedStep1 ? sharedStyles.wizardBtnPrimary : sharedStyles.wizardBtnDisabled}
              >
                {converting ? "Converting…" : "Continue →"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Details & Save ────────────────────────────────────── */}
        {step === 2 && (
          <>
            {/* Title */}
            <div style={{ marginBottom: spacing.md }}>
              <label style={sharedStyles.fieldLabel}>Title</label>
              <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(""); }} placeholder="e.g. Upper Limb — Brachial Plexus" style={{ ...sharedStyles.input, borderColor: titleError ? colors.danger : undefined }} />
              {titleError && <div style={{ fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.xs }}>{titleError}</div>}
            </div>

            {/* Subject — mandatory dropdown */}
            <div style={{ marginBottom: spacing.md }}>
              <label style={sharedStyles.fieldLabel}>
                Subject <span style={{ color: colors.danger }}>*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSubjectError(""); setCustomSubject(""); }}
                style={{ ...sharedStyles.select, borderColor: !subject ? colors.danger : undefined }}
              >
                <option value="" disabled>Select a subject…</option>
                {PRESET_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {subjectError && <div style={{ fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.xs }}>{subjectError}</div>}
              {subject === "Custom" && (
                <input
                  value={customSubject}
                  onChange={(e) => { setCustomSubject(e.target.value); setSubjectError(""); }}
                  placeholder="Type your subject/topic name…"
                  autoFocus
                  style={{ ...sharedStyles.input, marginTop: spacing.sm, borderColor: !customSubject.trim() ? colors.danger : undefined }}
                />
              )}
            </div>

            {/* Space selector */}
            <div style={{ marginBottom: spacing.md }}>
              <label style={sharedStyles.fieldLabel}>
                Save to space <span style={{ color: colors.danger }}>*</span>
              </label>
              <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginBottom: spacing.xs }}>
                Choose an existing space or create a new one to continue.
              </div>
              {allFolders.length > 0 && (
                <select value={destFolderId} onChange={(e) => setDestFolderId(e.target.value)} style={{ ...sharedStyles.select, marginBottom: spacing.xs, borderColor: !destFolderId ? colors.danger : undefined }}>
                  <option value="" disabled>Select a space…</option>
                  {allFolders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}{f.courseCode ? ` — ${f.courseCode}` : ""}</option>
                  ))}
                </select>
              )}
              {!showNewSpaceInput ? (
                <button
                  onClick={() => setShowNewSpaceInput(true)}
                  style={{ background: "none", border: `0.5px solid ${goldBorder}`, color: goldText, fontSize: fontSize.xs, padding: "6px 12px", borderRadius: borderRadius.sm, cursor: "pointer", fontWeight: fontWeight.semibold }}
                >
                  + Create new space
                </button>
              ) : (
                <div style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm }}>
                  <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: goldText, marginBottom: spacing.sm }}>New space</div>
                  <input
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    placeholder="Space name (e.g. Anatomy — Year 1)"
                    style={{ ...sharedStyles.input, marginBottom: spacing.sm }}
                    autoFocus
                  />
                  <input
                    value={newSpaceCourseCode}
                    onChange={(e) => setNewSpaceCourseCode(e.target.value)}
                    placeholder="Course code (optional, e.g. BIO 111)"
                    style={{ ...sharedStyles.input, marginBottom: spacing.sm }}
                  />
                  <div style={{ display: "flex", gap: spacing.sm }}>
                    <button
                      onClick={handleCreateSpace}
                      disabled={!newSpaceName.trim() || creatingSpace}
                      style={{ ...sharedStyles.wizardBtnPrimary, padding: "6px 16px", fontSize: fontSize.xs, opacity: !newSpaceName.trim() || creatingSpace ? 0.5 : 1, cursor: !newSpaceName.trim() || creatingSpace ? "not-allowed" : "pointer" }}
                    >
                      {creatingSpace ? "Creating…" : "Create space ✓"}
                    </button>
                    <button
                      onClick={() => { setShowNewSpaceInput(false); setNewSpaceName(""); setNewSpaceCourseCode(""); }}
                      style={{ background: "none", border: "none", color: colors.textDim, fontSize: fontSize.xs, cursor: "pointer", padding: "6px 8px" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Public / Private toggle */}
            <div style={{ marginBottom: spacing.lg }}>
              <label style={sharedStyles.fieldLabel}>Visibility</label>
              <div style={{
                display: "flex", alignItems: "center", gap: spacing.sm,
                background: colors.bg, border: `0.5px solid ${colors.border}`,
                borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`,
                cursor: "pointer", userSelect: "none",
              }} onClick={() => setIsPublic((v) => !v)}>
                <div style={{
                  width: "44px", height: "24px", borderRadius: "12px",
                  background: isPublic ? gold : colors.border,
                  position: "relative", flexShrink: 0,
                  transition: "background 0.2s ease",
                }}>
                  <div style={{
                    position: "absolute", top: "2px", left: isPublic ? "22px" : "2px",
                    width: "20px", height: "20px", borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: isPublic ? goldText : colors.text }}>
                    {isPublic ? "🌍 Public — appears in community" : "🔒 Private — only you"}
                  </div>
                  <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: "2px" }}>
                    {isPublic ? "Visible to all users in the Community tab" : "Only visible to you in your library"}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary of what will be saved */}
            <div style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: goldText, marginBottom: spacing.sm }}>Ready to save</div>
              <div style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.6 }}>
                <strong>{title || "Untitled"}</strong> — {finalSubject || "⚠️ No subject"}
              </div>
              <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: spacing.xs }}>
                {isNote ? "📝 Note" : "📄 " + (file?.name || "File")}
                {" → "}
                {destFolderId ? allFolders.find((f) => f.id === destFolderId)?.name : "⚠️ No space chosen"}
                {" · "}
                {isPublic ? "🌍 Public" : "🔒 Private"}
              </div>
            </div>

            {uploading && (
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ height: "6px", background: colors.bg, borderRadius: borderRadius.sm, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: `linear-gradient(90deg, #b8860b, ${gold})`, borderRadius: borderRadius.sm, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: fontSize.xs, color: goldText, textAlign: "center", marginTop: spacing.xs }}>{uploadProgress}%</div>
              </div>
            )}

            {saveError && !uploading && (
              <div style={{ fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.md, padding: "8px 12px", background: colors.dangerBg, borderRadius: borderRadius.sm, display: "flex", alignItems: "center", gap: spacing.sm }}>
                <span style={{ flex: 1 }}>⚠️ {saveError}</span>
                <button
                  onClick={() => {
                    if (saveError.includes("title")) { setStep(2); }
                    else if (saveError.includes("file") || saveError.includes("note")) setStep(1);
                    setSaveError("");
                  }}
                  style={{ background: "none", border: `0.5px solid ${colors.danger}`, color: colors.danger, fontSize: fontSize.xs, padding: "4px 10px", borderRadius: borderRadius.sm, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Fix it →
                </button>
              </div>
            )}

            {uploadError && !uploading && (
              <div style={{ fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.md, padding: "8px 12px", background: colors.dangerBg, borderRadius: borderRadius.sm }}>
                ⚠️ {uploadError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep(1)} style={sharedStyles.wizardBackBtn} disabled={uploading}>← Back</button>
              <button
                onClick={handleSave}
                disabled={uploading || !canSave()}
                style={uploading || !canSave() ? sharedStyles.wizardBtnDisabled : sharedStyles.wizardBtnPrimary}
              >
                {uploading ? "Saving…" : "Save to space ✓"}
              </button>
            </div>
          </>
        )}

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
}
