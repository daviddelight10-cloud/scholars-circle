import { useState, useRef, useEffect } from "react";
import { convertToPdf } from "../../lib/convertToPdf";
import { detectFileType, typeToContentType } from "../../lib/detectMimeType";
import { PRESET_SUBJECTS } from "./constants";

// Two separate pickers: broad or media-mixed accept lists make many Android
// builds (Transsion/MIUI) open a photos-only sheet with no file browser.
// A document-MIME-only accept forces document handlers (Files/DocumentsUI);
// images get their own image/* input so photos still work. Type validation
// happens in detectFileType() below.
const DOC_ACCEPT =
  "application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.presentationml.presentation," +
  "text/plain";
const FILE_INPUT_ID = "upload-wizard-file";
const IMG_INPUT_ID = "upload-wizard-image";

function stripExt(filename) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.substring(0, idx) : filename;
}

// "Lipids_251020_1940" -> "Lipids"; "BIO 111 notes" stays intact
function humanizeTitle(filename) {
  const base = stripExt(filename).replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return stripExt(filename);
  const tokens = base.split(" ");
  while (
    tokens.length > 1 &&
    /^\d+$/.test(tokens[tokens.length - 1]) &&
    (tokens[tokens.length - 1].length >= 4 || /^\d+$/.test(tokens[tokens.length - 2]))
  ) {
    tokens.pop();
  }
  const cleaned = tokens.join(" ").trim() || base;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const SUBJECT_HINTS = [
  [/anat|dissect|limb|plexus|muscle/i, "Anatomy"],
  [/physio|cardio|renal|neuro/i, "Physiology"],
  [/biochem|lipid|metabol|enzyme|protein|carb|amino/i, "Biochemistry"],
  [/path|histol|tumou?r|disease/i, "Pathology"],
  [/pharm|drug|dosage/i, "Pharmacology"],
  [/micro|bacter|virus|fung|parasit|immun/i, "Microbiology"],
  [/surg|operat/i, "Surgery"],
  [/paed|pediatr|neonat|child/i, "Paediatrics"],
  [/obstet|gynaec|pregnan/i, "Obstetrics & Gynaecology"],
  [/medicine|clinic/i, "Internal Medicine"],
];

function suggestSubject(text) {
  if (!text) return "";
  for (const [re, s] of SUBJECT_HINTS) if (re.test(text)) return s;
  const lower = text.toLowerCase();
  return PRESET_SUBJECTS.find((s) => s !== "Custom" && lower.includes(s.toLowerCase())) || "";
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
  resources,
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
  const [spacePickerOpen, setSpacePickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const imgInputRef = useRef(null);
  const titleInputRef = useRef(null);

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
      const all = [...(folders?.own || []), ...(folders?.shared || [])];
      const firstFolderId = all[0]?.id || "";
      setDestFolderId(presetFolderId || firstFolderId);
      // Prefill subject from the space this upload was launched from
      const presetFolder = presetFolderId ? all.find((f) => f.id === presetFolderId) : null;
      if (presetFolder) {
        setSubject(suggestSubject(`${presetFolder.name || ""} ${presetFolder.courseCode || ""}`));
      }
      setTitleError("");
      setSubjectError("");
      setSaveError("");
      setIsPublic(true);
      setShowNewSpaceInput(!presetFolderId && !firstFolderId);
      setNewSpaceName("");
      setNewSpaceCourseCode("");
      setCreatingSpace(false);
      setSpacePickerOpen(false);
      if (onClearUploadError) onClearUploadError();
    }
  }, [show, presetFolderId]);

  // Focus + select the title when landing on step 2 so it can be typed over
  useEffect(() => {
    if (step !== 2) return;
    const t = setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, [step]);

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
    setTitle(humanizeTitle(f.name));
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
          setTitle(humanizeTitle(result.fileName));
          setConvertProgress("");
        }
      } catch (err) {
        setConvertError(err.message || "Conversion failed — you can still use the original file");
        setFile(f);
        setTitle(humanizeTitle(f.name));
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
        setTitle(humanizeTitle(f.name));
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
        setSpacePickerOpen(false);
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
    setTitleError("");
    setSubjectError("");
    if (!title.trim()) { setTitleError("Please enter a title for your document"); return; }
    if (!finalSubject) { setSubjectError("Choose a subject to continue."); return; }
    if (!destFolderId) { setSpacePickerOpen(true); setSaveError("Please choose a space to save into, or create one"); return; }

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

  const renderStepIndicator = () => (
    <div className="mb-4 flex items-center gap-2">
      <span className="shrink-0 text-[10px] font-semibold text-hub-text-muted">
        Step {step} of {STEP_LABELS.length} · {STEP_LABELS[step - 1]}
      </span>
      {STEP_LABELS.map((_, i) => (
        <div key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i < step ? "bg-gold" : "bg-hub-border"}`} />
      ))}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const ownFolders = folders?.own || [];
  const sharedFolders = folders?.shared || [];
  const allFolders = [...ownFolders, ...sharedFolders];
  const selectedFolder = allFolders.find((f) => f.id === destFolderId) || null;
  const subjectSuggestion = suggestSubject(file?.name || title);

  const duplicate = (() => {
    const t = title.trim().toLowerCase();
    if (!t || !resources?.length) return null;
    return resources.find(
      (r) =>
        (r.title || "").trim().toLowerCase() === t &&
        String(r.folderId || "") === String(destFolderId || "")
    ) || null;
  })();

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-[540px] max-h-[88vh] overflow-y-auto rounded-2xl border border-gold-border bg-hub-surface p-6" onClick={(e) => e.stopPropagation()}>
        <input id={FILE_INPUT_ID} ref={fileInputRef} type="file" accept={DOC_ACCEPT} onChange={handleFilePick} className="hidden" />
        <input id={IMG_INPUT_ID} ref={imgInputRef} type="file" accept="image/*" onChange={handleFilePick} className="hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-xl font-bold text-gold">
            {step === 1 && "Add to your space"}
            {step === 2 && "Save document"}
          </h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-base text-hub-text-muted transition-colors hover:text-hub-text">✕</button>
        </div>

        {renderStepIndicator()}

        {/* ── Step 1: Import ─────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            {!isNote ? (
              <>
                <label
                  htmlFor={FILE_INPUT_ID}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                    dragOver ? "border-gold-border bg-gold-dim" : file ? "border-[#22c55e]/40" : "border-hub-border"
                  }`
                  }
                >
                  {file ? (
                    <>
                      <div className="text-3xl">{converting ? "⏳" : "✓"}</div>
                      <div className="text-sm font-bold" style={{ color: converting ? "#FFD700" : "#22c55e" }}>{file.name}</div>
                      <div className="text-[10px] text-hub-text-dim">{(file.size / 1024).toFixed(0)} KB{converting ? " · converting…" : ""}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl">📎</div>
                      <div className="text-sm font-semibold text-hub-text">
                        {dragOver ? "Drop file here" : "Drag a file here — or pick below"}
                      </div>
                      <div className="text-[10px] text-hub-text-dim">
                        PDF, DOCX, PPTX, TXT · max 50MB
                      </div>
                    </>
                  )}
                </label>
                {!file && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label
                      htmlFor={FILE_INPUT_ID}
                      className="cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-3 py-3 text-center text-[13px] font-bold text-gold transition-all active:scale-95"
                    >
                      📄 Choose document
                    </label>
                    <label
                      htmlFor={IMG_INPUT_ID}
                      className="cursor-pointer rounded-lg border border-hub-border bg-hub-bg px-3 py-3 text-center text-[13px] font-bold text-hub-text transition-all active:scale-95"
                    >
                      🖼 Photo / scan
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Write your note</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write or paste your note here…"
                  autoFocus
                  className="min-h-[160px] resize-y rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold"
                />
              </div>
            )}

            {converting && (
              <div className="mt-3 text-center">
                <div className="mb-1 text-[11px] text-gold">{convertProgress || "Converting to PDF…"}</div>
                <div className="mx-auto h-1 max-w-[300px] overflow-hidden rounded-full bg-hub-surface">
                  <div className="h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, transparent, #FFD700, transparent)", animation: "shimmer 1.5s infinite" }} />
                </div>
              </div>
            )}

            {convertError && !converting && (
              <div className="mt-3 rounded-md bg-[#ef4444]/10 px-2.5 py-1.5 text-[10px] text-[#ef4444]">{convertError}</div>
            )}

            {genError && (
              <div className="mt-3 rounded-md bg-[#ef4444]/10 px-2.5 py-1.5 text-[10px] text-[#ef4444]">{genError}</div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => { setIsNote(!isNote); setFile(null); setGenError(""); setConvertError(""); }}
                className="cursor-pointer border-none bg-transparent p-0 text-[11px] text-hub-text-muted"
              >
                {isNote ? "← Upload a file instead" : "or write a note manually →"}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className={`rounded-lg px-6 py-3 text-sm font-bold transition-all active:scale-95 ${
                  canProceedStep1
                    ? "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
                    : "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-60"
                }`
                }
              >
                {converting ? "Converting…" : "Continue →"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Details & Save ────────────────────────────────────── */}
        {step === 2 && (
          <>
            {/* File chip */}
            <div className="flex items-center gap-3 rounded-xl border border-hub-border bg-hub-bg px-3 py-2.5">
              <span className="text-xl">{isNote ? "📝" : "📄"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-hub-text">{isNote ? "Note" : file?.name}</div>
                <div className="text-[10px] text-hub-text-dim">
                  {isNote ? `${noteContent.trim().length} characters` : `${((file?.size || 0) / 1024).toFixed(0)} KB · Imported`}
                </div>
              </div>
              <span className="text-lg text-[#22c55e]">✓</span>
              <button
                type="button"
                onClick={() => (isNote ? setStep(1) : fileInputRef.current?.click())}
                className="shrink-0 cursor-pointer rounded-md border border-hub-border px-2.5 py-1 text-[10px] font-semibold text-hub-text-muted transition-colors hover:text-hub-text"
              >
                {isNote ? "Edit" : "Replace"}
              </button>
            </div>

            {/* Title */}
            <div className="mb-3">
              <label className="mb-1 mt-3 block text-[11px] font-semibold text-hub-text-muted">Title</label>
              <input ref={titleInputRef} value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(""); }} placeholder="e.g. Upper Limb — Brachial Plexus" className={`w-full rounded-lg border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold ${titleError ? "border-[#ef4444]" : "border-hub-border"}`} />
              {titleError && <div className="mt-1 text-[10px] text-[#ef4444]">{titleError}</div>}
            </div>

            {/* Subject — mandatory dropdown */}
            <div className="mb-3">
              <label className="mb-1 flex items-center justify-between text-[11px] font-semibold text-hub-text-muted">
                <span>Subject</span>
                <span className="text-[10px] font-normal">Required</span>
              </label>
              <select
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSubjectError(""); setCustomSubject(""); }}
                className={`w-full rounded-lg border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold ${subjectError || !subject ? "border-[#ef4444]" : "border-hub-border"}`}
              >
                <option value="" disabled>Select a subject…</option>
                {subjectSuggestion ? (
                  <>
                    <optgroup label="Suggested from your file">
                      <option value={subjectSuggestion}>{subjectSuggestion}</option>
                    </optgroup>
                    <optgroup label="All subjects">
                      {PRESET_SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  PRESET_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))
                )}
              </select>
              {subjectError && <div className="mt-1 text-[10px] text-[#ef4444]">{subjectError}</div>}
              {subject === "Custom" && (
                <input
                  value={customSubject}
                  onChange={(e) => { setCustomSubject(e.target.value); setSubjectError(""); }}
                  placeholder="Type your subject/topic name…"
                  autoFocus
                  className={`mt-2 w-full rounded-lg border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold ${!customSubject.trim() ? "border-[#ef4444]" : "border-hub-border"}`}
                />
              )}
              {subjectSuggestion && subject !== subjectSuggestion && (
                <button
                  type="button"
                  onClick={() => { setSubject(subjectSuggestion); setSubjectError(""); setCustomSubject(""); }}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-gold-border bg-gold-dim px-3 py-1.5 text-[11px] font-semibold text-gold"
                >
                  ✨ Looks like {subjectSuggestion}. Use it
                </button>
              )}
            </div>

            {/* Saving to */}
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">
                Saving to <span className="text-[#ef4444]">*</span>
              </label>
              {selectedFolder && !spacePickerOpen ? (
                <div className="flex items-center gap-3 rounded-xl border border-hub-border bg-hub-bg px-3 py-2.5">
                  <span className="text-lg">📁</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-hub-text">
                      {selectedFolder.name}{selectedFolder.courseCode ? ` — ${selectedFolder.courseCode}` : ""}
                    </div>
                    <div className="text-[10px] text-hub-text-dim">
                      {presetFolderId === selectedFolder.id ? "Current space" : "Existing space"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpacePickerOpen(true)}
                    className="shrink-0 cursor-pointer border-none bg-transparent text-[11px] font-semibold text-gold"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-1 text-[10px] text-hub-text-dim">
                    Choose an existing space or create a new one to continue.
                  </div>
                  {allFolders.length > 0 && (
                <select value={destFolderId} onChange={(e) => setDestFolderId(e.target.value)} className={`mb-1 w-full rounded-lg border bg-hub-bg p-3 text-sm text-hub-text outline-none transition-colors focus:border-gold ${!destFolderId ? "border-[#ef4444]" : "border-hub-border"}`}>
                  <option value="" disabled>Select a space…</option>
                  {allFolders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}{f.courseCode ? ` — ${f.courseCode}` : ""}</option>
                  ))}
                </select>
              )}
              {!showNewSpaceInput ? (
                <button
                  onClick={() => setShowNewSpaceInput(true)}
                  className="cursor-pointer rounded-md border border-gold-border px-3 py-1.5 text-[10px] font-semibold text-gold"
                >
                  + Create new space
                </button>
              ) : (
                <div className="mt-2 rounded-lg border border-hub-border bg-hub-bg p-3">
                  <div className="mb-2 text-[10px] font-bold text-gold">New space</div>
                  <input
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    placeholder="Space name (e.g. Anatomy — Year 1)"
                    className="mb-2 w-full rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none focus:border-gold"
                    autoFocus
                  />
                  <input
                    value={newSpaceCourseCode}
                    onChange={(e) => setNewSpaceCourseCode(e.target.value)}
                    placeholder="Course code (optional, e.g. BIO 111)"
                    className="mb-2 w-full rounded-lg border border-hub-border bg-hub-bg p-3 text-sm text-hub-text outline-none focus:border-gold"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSpace}
                      disabled={!newSpaceName.trim() || creatingSpace}
                      className={`rounded-lg px-4 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
                        !newSpaceName.trim() || creatingSpace
                          ? "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-50"
                          : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
                      }`}
                    >
                      {creatingSpace ? "Creating…" : "Create space ✓"}
                    </button>
                    <button
                      onClick={() => { setShowNewSpaceInput(false); setNewSpaceName(""); setNewSpaceCourseCode(""); }}
                      className="cursor-pointer border-none bg-transparent p-1.5 text-[10px] text-hub-text-dim"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {/* Who can see it */}
            <div className="mb-4">
              <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Who can see it</label>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-hub-border bg-hub-bg p-1">
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`cursor-pointer rounded-lg border-none py-2 text-[12px] font-semibold transition-all ${!isPublic ? "bg-hub-surface text-hub-text" : "bg-transparent text-hub-text-dim"}`}
                >
                  🔒 Only me
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`cursor-pointer rounded-lg border-none py-2 text-[12px] font-semibold transition-all ${isPublic ? "bg-hub-surface text-hub-text" : "bg-transparent text-hub-text-dim"}`}
                >
                  🌍 Community
                </button>
              </div>
              <div className="mt-1 text-[10px] text-hub-text-dim">
                {isPublic ? "Shows in the Community tab for all students." : "Only you can open this document."}
              </div>
            </div>

            {duplicate && (
              <div className="mb-3 rounded-md border border-[#facc15]/30 bg-[#facc15]/10 px-3 py-2 text-[10px] text-[#facc15]">
                ⚠️ A document named "{duplicate.title}" already exists in this space — saving will create a copy.
              </div>
            )}

            {uploading && (
              <div className="mb-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-hub-bg">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#b8860b] to-gold transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="mt-1 text-center text-[10px] text-gold">{uploadProgress}%</div>
              </div>
            )}

            {saveError && !uploading && (
              <div className="mb-3 flex items-center gap-2 rounded-md bg-[#ef4444]/10 px-3 py-2 text-[10px] text-[#ef4444]">
                <span className="flex-1">⚠️ {saveError}</span>
                <button
                  onClick={() => {
                    if (saveError.includes("title")) { setStep(2); }
                    else if (saveError.includes("file") || saveError.includes("note")) setStep(1);
                    setSaveError("");
                  }}
                  className="shrink-0 cursor-pointer whitespace-nowrap rounded-md border border-[#ef4444] px-2.5 py-1 text-[10px] text-[#ef4444]"
                >
                  Fix it →
                </button>
              </div>
            )}

            {uploadError && !uploading && (
              <div className="mb-3 rounded-md bg-[#ef4444]/10 px-3 py-2 text-[10px] text-[#ef4444]">
                ⚠️ {uploadError}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} disabled={uploading} className="cursor-pointer rounded-lg border border-hub-border px-5 py-3 text-sm font-semibold text-hub-text-muted transition-all active:scale-95 disabled:opacity-50">← Back</button>
              <button
                onClick={handleSave}
                disabled={uploading || !canSave()}
                className={`rounded-lg px-6 py-3 text-sm font-bold transition-all active:scale-95 ${
                  uploading || !canSave()
                    ? "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-60"
                    : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
                }`}
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
