import { useState, useRef, useEffect } from "react";
import { callAI, callAIMultimodal, extractJSON } from "../../lib/aiClient";
import { extractFileText, chunkText } from "../../lib/extractFileText";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText, gold } from "./constants";

const emptyMcqRow = () => ({ question: "", options: { A: "", B: "", C: "", D: "" }, correct: "A", explanation: "" });
const emptyFlashcard = () => ({ front: "", back: "" });

const MAX_QUESTIONS = 300;
const CHUNK_SIZE = 12000;
const QUESTIONS_PER_CHUNK = 50;
const MAX_FLASHCARDS = 50;

const ACCEPTED_EXTS = ".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.pptx,.webp,.gif,.bmp";

function extToContentType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) return "image";
  if (["docx", "doc"].includes(ext)) return "docx";
  if (["pptx"].includes(ext)) return "pptx";
  if (["txt"].includes(ext)) return "txt";
  return null;
}

function stripExt(filename) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.substring(0, idx) : filename;
}

const STEP_LABELS = ["Import", "Details", "Review", "Save"];

export default function UploadWizard({
  show,
  onClose,
  subjects,
  folders,
  presetFolderId,
  userProfile,
  onUploadFile,
  onSaveStudyTool,
  uploading,
  uploadProgress,
}) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isNote, setIsNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [action, setAction] = useState(null); // 'material' | 'flashcards' | 'mcqs' | 'summary'
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [genError, setGenError] = useState("");
  const [mcqRows, setMcqRows] = useState([emptyMcqRow()]);
  const [flashcards, setFlashcards] = useState([emptyFlashcard()]);
  const [summaryText, setSummaryText] = useState("");
  const [destFolderId, setDestFolderId] = useState("");
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
      setAction(null);
      setGenerating(false);
      setGenProgress("");
      setGenError("");
      setMcqRows([emptyMcqRow()]);
      setFlashcards([emptyFlashcard()]);
      setSummaryText("");
      setDestFolderId(presetFolderId || "");
    }
  }, [show, presetFolderId]);

  if (!show) return null;

  // ── Step 1: File handling ──────────────────────────────────────────────────

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelected(f);
  };

  const handleFileSelected = (f) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setGenError("File too large — 50MB max"); return; }
    setFile(f);
    setGenError("");
    setTitle(stripExt(f.name));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelected(f);
  };

  const canProceedStep1 = isNote ? noteContent.trim().length > 0 : file !== null;

  // ── Step 2: Action selection ───────────────────────────────────────────────

  const handleChooseAction = (chosen) => {
    setAction(chosen);
    if (chosen === "material") {
      setStep(4);
    } else {
      setStep(3);
      generateContent(chosen);
    }
  };

  // ── Step 3: AI Generation ──────────────────────────────────────────────────

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

  const buildFlashcardPrompt = (text, count) => {
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
  };

  const buildSummaryPrompt = (text) => {
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
  };

  const mapAiMcqsToRows = (parsed) => {
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
  };

  const mapAiFlashcards = (parsed) => {
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((fc) => fc && fc.front && fc.back)
      .map((fc) => ({ front: String(fc.front), back: String(fc.back) }))
      .filter((fc) => fc.front.trim() && fc.back.trim());
  };

  const generateContent = async (chosenAction) => {
    const sourceFile = file;
    if (!sourceFile && !isNote) { setGenError("No file selected"); return; }
    setGenerating(true);
    setGenError("");
    setGenProgress(isNote ? "Processing note…" : "Extracting text from file…");

    try {
      let text = "";
      let images = [];

      if (isNote) {
        text = noteContent;
      } else {
        const result = await extractFileText(sourceFile, 15);
        text = result.text;
        images = result.images;
      }

      // Image-based: send to multimodal AI
      if (images.length > 0 && text.length < 50 && !isNote) {
        setGenProgress(`Analyzing ${images.length} image${images.length > 1 ? "s" : ""} with AI…`);
        const contextText = "The images contain study material. Generate comprehensive content covering all the content visible.";

        if (chosenAction === "mcqs") {
          const prompt = buildMcqPrompt(contextText, Math.min(QUESTIONS_PER_CHUNK, MAX_QUESTIONS));
          const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
          const parsed = extractJSON(raw, "array");
          const rows = mapAiMcqsToRows(parsed);
          if (rows.length === 0) throw new Error("AI didn't generate valid questions. Try again.");
          setMcqRows(rows);
          setGenProgress(`Generated ${rows.length} questions ✓`);
        } else if (chosenAction === "flashcards") {
          const prompt = buildFlashcardPrompt(contextText, MAX_FLASHCARDS);
          const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
          const parsed = extractJSON(raw, "array");
          const cards = mapAiFlashcards(parsed);
          if (cards.length === 0) throw new Error("AI didn't generate valid flashcards. Try again.");
          setFlashcards(cards);
          setGenProgress(`Generated ${cards.length} flashcards ✓`);
        } else if (chosenAction === "summary") {
          const prompt = buildSummaryPrompt(contextText);
          const raw = await callAIMultimodal(prompt, images, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
          setSummaryText(raw || "No summary generated.");
          setGenProgress("Summary generated ✓");
        }
        return;
      }

      if (!isNote && !text.trim()) throw new Error("No text could be extracted from this file.");
      if (isNote && !noteContent.trim()) throw new Error("Note is empty.");

      const chunks = chunkText(text, CHUNK_SIZE);

      if (chosenAction === "mcqs") {
        const totalPossible = chunks.length * QUESTIONS_PER_CHUNK;
        const targetCount = Math.min(MAX_QUESTIONS, totalPossible);
        const questionsPerChunk = Math.ceil(targetCount / chunks.length);
        setGenProgress(`Generating MCQs from ${chunks.length} section${chunks.length > 1 ? "s" : ""}… (up to ${targetCount} questions)`);

        const promises = chunks.map((chunk, idx) => {
          const count = idx === chunks.length - 1 ? targetCount - (questionsPerChunk * (chunks.length - 1)) : questionsPerChunk;
          const prompt = buildMcqPrompt(chunk, Math.max(5, count));
          return callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" })
            .then((raw) => { try { return mapAiMcqsToRows(extractJSON(raw, "array")); } catch { return []; } })
            .catch(() => []);
        });

        const results = await Promise.all(promises);
        const allRows = results.flat().slice(0, MAX_QUESTIONS);
        if (allRows.length === 0) throw new Error("AI couldn't generate questions from this content. Try a different file.");
        setMcqRows(allRows);
        setGenProgress(`Generated ${allRows.length} questions ✓ — review and edit below`);

      } else if (chosenAction === "flashcards") {
        const cardsPerChunk = Math.ceil(MAX_FLASHCARDS / chunks.length);
        setGenProgress(`Generating flashcards from ${chunks.length} section${chunks.length > 1 ? "s" : ""}…`);

        const promises = chunks.map((chunk) => {
          const prompt = buildFlashcardPrompt(chunk, cardsPerChunk);
          return callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" })
            .then((raw) => { try { return mapAiFlashcards(extractJSON(raw, "array")); } catch { return []; } })
            .catch(() => []);
        });

        const results = await Promise.all(promises);
        const allCards = results.flat().slice(0, MAX_FLASHCARDS);
        if (allCards.length === 0) throw new Error("AI couldn't generate flashcards from this content. Try a different file.");
        setFlashcards(allCards);
        setGenProgress(`Generated ${allCards.length} flashcards ✓ — review and edit below`);

      } else if (chosenAction === "summary") {
        setGenProgress(`Generating summary from ${chunks.length} section${chunks.length > 1 ? "s" : ""}…`);
        const combinedText = chunks.join("\n\n").slice(0, 20000);
        const prompt = buildSummaryPrompt(combinedText);
        const raw = await callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" });
        if (!raw || !raw.trim()) throw new Error("AI didn't generate a summary. Try again.");
        setSummaryText(raw);
        setGenProgress("Summary generated ✓ — review and edit below");
      }
    } catch (err) {
      setGenError(err.message || "AI generation failed. Try again.");
      setGenProgress("");
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 3: Editable content helpers ───────────────────────────────────────

  const updateMcqRow = (index, patch) =>
    setMcqRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const updateMcqOption = (rowIndex, optKey, value) =>
    setMcqRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, options: { ...row.options, [optKey]: value } } : row)));
  const addMcqRow = () => setMcqRows((prev) => [...prev, emptyMcqRow()]);
  const removeMcqRow = (index) => setMcqRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const updateFlashcard = (index, field, value) =>
    setFlashcards((prev) => prev.map((fc, i) => (i === index ? { ...fc, [field]: value } : fc)));
  const addFlashcard = () => setFlashcards((prev) => [...prev, emptyFlashcard()]);
  const removeFlashcard = (index) => setFlashcards((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  // ── Step 4: Save ───────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!title.trim() || !subject.trim()) { setGenError("Add a title and subject first"); return; }

    if (action === "material") {
      if (isNote) {
        onUploadFile({
          title: title.trim(),
          subject: subject.trim(),
          contentType: "note",
          description: noteContent.trim(),
          folderId: destFolderId || null,
        });
      } else if (file) {
        onUploadFile({
          title: title.trim(),
          subject: subject.trim(),
          contentType: extToContentType(file.name) || "pdf",
          file,
          folderId: destFolderId || null,
        });
      }
    } else if (action === "mcqs") {
      const incomplete = mcqRows.some((row) => !row.question.trim() || Object.values(row.options).some((o) => !o.trim()));
      if (incomplete) { setGenError("Fill in every question and all 4 options"); return; }
      onSaveStudyTool({
        title: title.trim(),
        subject: subject.trim(),
        contentType: "mcq",
        mcqData: JSON.stringify(mcqRows),
        folderId: destFolderId || null,
      });
    } else if (action === "flashcards") {
      const incomplete = flashcards.some((fc) => !fc.front.trim() || !fc.back.trim());
      if (incomplete) { setGenError("Fill in all flashcard fronts and backs"); return; }
      onSaveStudyTool({
        title: title.trim(),
        subject: subject.trim(),
        contentType: "flashcard_deck",
        flashcardData: JSON.stringify(flashcards),
        folderId: destFolderId || null,
      });
    } else if (action === "summary") {
      if (!summaryText.trim()) { setGenError("Summary is empty"); return; }
      onSaveStudyTool({
        title: title.trim(),
        subject: subject.trim(),
        contentType: "note",
        description: summaryText.trim(),
        folderId: destFolderId || null,
      });
    }
  };

  const canSave = () => {
    if (!title.trim() || !subject.trim()) return false;
    if (action === "mcqs") return mcqRows.some((r) => r.question.trim());
    if (action === "flashcards") return flashcards.some((fc) => fc.front.trim());
    if (action === "summary") return summaryText.trim().length > 0;
    if (action === "material") return Boolean(isNote ? noteContent.trim() : file);
    return false;
  };

  // ── Step indicator ─────────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const effectiveStep = action === "material" ? (step === 4 ? 4 : step) : step;
    return (
      <div style={sharedStyles.stepIndicator}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          let style = sharedStyles.stepDot;
          if (stepNum === effectiveStep) style = sharedStyles.stepDotActive;
          else if (stepNum < effectiveStep) style = sharedStyles.stepDotDone;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={style} />
              {(stepNum === effectiveStep || (stepNum === 1 && effectiveStep > 1)) && (
                <span style={{ fontSize: fontSize.xs, color: stepNum === effectiveStep ? goldText : colors.textDim, fontWeight: fontWeight.semibold }}>
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
            {step === 2 && "Choose what to create"}
            {step === 3 && "Review & edit"}
            {step === 4 && "Save to your space"}
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
                    <div style={{ fontSize: 32 }}>✓</div>
                    <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.success }}>{file.name}</div>
                    <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>{(file.size / 1024).toFixed(0)} KB</div>
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

            {genError && (
              <div style={{ fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.md, padding: "6px 10px", background: colors.dangerBg, borderRadius: borderRadius.sm }}>
                {genError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg }}>
              <button
                onClick={() => { setIsNote(!isNote); setFile(null); setGenError(""); }}
                style={{ background: "none", border: "none", color: colors.textMuted, fontSize: fontSize.sm, cursor: "pointer", padding: 0 }}
              >
                {isNote ? "← Upload a file instead" : "or write a note manually →"}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                style={canProceedStep1 ? sharedStyles.wizardBtnPrimary : sharedStyles.wizardBtnDisabled}
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Details & Choose Action ────────────────────────────── */}
        {step === 2 && (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <label style={sharedStyles.fieldLabel}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Upper Limb — Brachial Plexus" style={sharedStyles.input} />
            </div>
            <div style={{ marginBottom: spacing.lg }}>
              <label style={sharedStyles.fieldLabel}>Subject / course code</label>
              <input list="wizardSubjectOptions" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. BIO 111" style={sharedStyles.input} />
              <datalist id="wizardSubjectOptions">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
              {[
                { key: "material", icon: "📄", label: "Save as Material", desc: "Upload the file as-is" },
                { key: "flashcards", icon: "🎴", label: "Generate Flashcards", desc: "AI creates flashcard deck" },
                { key: "mcqs", icon: "✎", label: "Generate MCQs", desc: "AI creates quiz questions" },
                { key: "summary", icon: "📝", label: "Generate Summary", desc: "AI creates study summary" },
              ].map((choice) => (
                <div
                  key={choice.key}
                  onClick={() => handleChooseAction(choice.key)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = goldBorder; e.currentTarget.style.background = goldDim; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.background = colors.bg; e.currentTarget.style.transform = "none"; }}
                  style={sharedStyles.choiceCard}
                >
                  <div style={sharedStyles.choiceCardIcon}>{choice.icon}</div>
                  <div style={sharedStyles.choiceCardLabel}>{choice.label}</div>
                  <div style={sharedStyles.choiceCardDesc}>{choice.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: spacing.lg }}>
              <button onClick={() => setStep(1)} style={sharedStyles.wizardBackBtn}>← Back</button>
            </div>
          </>
        )}

        {/* ── Step 3: AI Processing & Review ─────────────────────────────── */}
        {step === 3 && (
          <>
            {generating ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: spacing.md }}>🤖</div>
                <div style={{ fontSize: fontSize.sm, color: goldText, marginBottom: spacing.sm }}>{genProgress}</div>
                <div style={{ height: "4px", background: colors.surface, borderRadius: borderRadius.sm, overflow: "hidden", maxWidth: "300px", margin: "0 auto" }}>
                  <div style={{ height: "100%", width: "100%", background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: borderRadius.sm, animation: "shimmer 1.5s infinite" }} />
                </div>
              </div>
            ) : genError ? (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⚠️</div>
                <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.danger, marginBottom: spacing.sm }}>{genError}</div>
                <div style={{ display: "flex", gap: spacing.sm, justifyContent: "center" }}>
                  <button onClick={() => generateContent(action)} style={sharedStyles.wizardBtn}>Try again</button>
                  <button onClick={() => setStep(2)} style={sharedStyles.wizardBackBtn}>← Back</button>
                </div>
              </div>
            ) : (
              <>
                {/* MCQ Review */}
                {action === "mcqs" && (
                  <>
                    <div style={{ fontSize: fontSize.sm, color: goldText, marginBottom: spacing.sm, fontWeight: fontWeight.semibold }}>
                      {mcqRows.filter((r) => r.question.trim()).length} questions ready — review and edit
                    </div>
                    {mcqRows.map((row, i) => (
                      <div key={i} style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
                          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Question {i + 1}</span>
                          {mcqRows.length > 1 && <button onClick={() => removeMcqRow(i)} style={{ background: "none", border: "none", color: "#ef9a9a", fontSize: fontSize.xs, cursor: "pointer" }}>Remove</button>}
                        </div>
                        <input value={row.question} onChange={(e) => updateMcqRow(i, { question: e.target.value })} placeholder="Question text" style={{ ...sharedStyles.input, marginBottom: spacing.sm }} />
                        {Object.entries(row.options).map(([key, value]) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: "6px" }}>
                            <input type="radio" name={`correct-${i}`} checked={row.correct === key} onChange={() => updateMcqRow(i, { correct: key })} style={{ accentColor: gold }} />
                            <span style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: row.correct === key ? colors.success : colors.textDim, width: "16px" }}>{key}</span>
                            <input value={value} onChange={(e) => updateMcqOption(i, key, e.target.value)} placeholder={`Option ${key}`} style={{ ...sharedStyles.input, flex: 1 }} />
                          </div>
                        ))}
                        <textarea value={row.explanation} onChange={(e) => updateMcqRow(i, { explanation: e.target.value })} placeholder="Brief explanation (optional)" style={{ ...sharedStyles.input, minHeight: "40px", resize: "vertical", marginTop: "6px" }} />
                      </div>
                    ))}
                    <button onClick={addMcqRow} style={{ width: "100%", padding: "10px", borderRadius: borderRadius.lg, border: `1px dashed ${colors.border}`, background: "none", color: colors.textMuted, fontSize: fontSize.base, cursor: "pointer", marginBottom: spacing.md }}>+ Add question</button>
                  </>
                )}

                {/* Flashcard Review */}
                {action === "flashcards" && (
                  <>
                    <div style={{ fontSize: fontSize.sm, color: goldText, marginBottom: spacing.sm, fontWeight: fontWeight.semibold }}>
                      {flashcards.filter((fc) => fc.front.trim()).length} flashcards ready — review and edit
                    </div>
                    {flashcards.map((fc, i) => (
                      <div key={i} style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
                          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Card {i + 1}</span>
                          {flashcards.length > 1 && <button onClick={() => removeFlashcard(i)} style={{ background: "none", border: "none", color: "#ef9a9a", fontSize: fontSize.xs, cursor: "pointer" }}>Remove</button>}
                        </div>
                        <input value={fc.front} onChange={(e) => updateFlashcard(i, "front", e.target.value)} placeholder="Front (question/concept)" style={{ ...sharedStyles.input, marginBottom: spacing.sm }} />
                        <textarea value={fc.back} onChange={(e) => updateFlashcard(i, "back", e.target.value)} placeholder="Back (answer)" style={{ ...sharedStyles.input, minHeight: "50px", resize: "vertical" }} />
                      </div>
                    ))}
                    <button onClick={addFlashcard} style={{ width: "100%", padding: "10px", borderRadius: borderRadius.lg, border: `1px dashed ${colors.border}`, background: "none", color: colors.textMuted, fontSize: fontSize.base, cursor: "pointer", marginBottom: spacing.md }}>+ Add flashcard</button>
                  </>
                )}

                {/* Summary Review */}
                {action === "summary" && (
                  <>
                    <div style={{ fontSize: fontSize.sm, color: goldText, marginBottom: spacing.sm, fontWeight: fontWeight.semibold }}>
                      Summary generated — review and edit
                    </div>
                    <textarea
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      style={{ ...sharedStyles.input, minHeight: "300px", resize: "vertical", fontFamily: "monospace", fontSize: fontSize.sm, lineHeight: 1.6 }}
                    />
                  </>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: spacing.lg }}>
                  <button onClick={() => setStep(2)} style={sharedStyles.wizardBackBtn}>← Back</button>
                  <button onClick={() => setStep(4)} style={sharedStyles.wizardBtnPrimary}>Continue →</button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Step 4: Save to Space ──────────────────────────────────────── */}
        {step === 4 && (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <label style={sharedStyles.fieldLabel}>Save to space</label>
              <select value={destFolderId} onChange={(e) => setDestFolderId(e.target.value)} style={sharedStyles.select}>
                <option value="">No space (loose material)</option>
                {allFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}{f.courseCode ? ` — ${f.courseCode}` : ""}</option>
                ))}
              </select>
            </div>

            {/* Summary of what will be saved */}
            <div style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: goldText, marginBottom: spacing.sm }}>Ready to save</div>
              <div style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.6 }}>
                <strong>{title}</strong> — {subject}
              </div>
              <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: spacing.xs }}>
                {action === "material" && (isNote ? "📝 Note" : `📄 ${file?.name || "File"}`)}
                {action === "mcqs" && `✎ ${mcqRows.filter((r) => r.question.trim()).length} MCQ questions`}
                {action === "flashcards" && `🎴 ${flashcards.filter((fc) => fc.front.trim()).length} flashcards`}
                {action === "summary" && "📝 AI-generated summary"}
                {" → "}
                {destFolderId ? allFolders.find((f) => f.id === destFolderId)?.name : "Loose material"}
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

            {genError && (
              <div style={{ fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.md, padding: "6px 10px", background: colors.dangerBg, borderRadius: borderRadius.sm }}>
                {genError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep(action === "material" ? 2 : 3)} style={sharedStyles.wizardBackBtn} disabled={uploading}>← Back</button>
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
