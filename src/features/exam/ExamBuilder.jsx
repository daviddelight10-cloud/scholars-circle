import { useState, useMemo, useEffect } from "react";
import { extractResourceText } from "../research-hub/useMaterialGenerate";
import { analyzeDocument, generateExam } from "./examGeneration";
import { saveExamResource, examFromResource } from "./examApi";
import { QUESTION_TYPES, ALL_TYPES, OBJECTIVE_TYPES, WRITTEN_TYPES } from "./examSchema";
import ExamRunner from "./ExamRunner";

const DEFAULT_COUNT = 20;

function Slider({ label, value, min, max, step = 1, onChange, format }) {
  return (
    <div className="exb-field">
      <div className="exb-field-head">
        <span>{label}</span>
        <b>{format ? format(value) : value}</b>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <button type="button" className={`exb-toggle${checked ? " on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="exb-toggle-body">
        <span className="exb-toggle-label">{label}</span>
        {hint && <span className="exb-toggle-hint">{hint}</span>}
      </span>
      <span className="exb-toggle-pill"><span /></span>
    </button>
  );
}

/**
 * Exam builder — pick a source → AI analyzes it → customize → build → run.
 * `file`: preselected source resource (with .variants).
 * `sources`: candidate list when `file` is null (folder/subject scope).
 * `existingExam`: a saved "exam" resource — jumps straight into the runner.
 */
export default function ExamBuilder({ file, sources = [], existingExam = null, onExit, onSaved, onStreakUpdate, onXpUpdate }) {
  const [phase, setPhase] = useState(existingExam ? "run" : file ? "analyzing" : "pick");
  const [source, setSource] = useState(file || null);
  const [runResource, setRunResource] = useState(existingExam || null); // saved exam resource
  const [runPayload, setRunPayload] = useState(existingExam ? examFromResource(existingExam) : null);
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [started, setStarted] = useState(false);

  // Config
  const [name, setName] = useState("");
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [timeLimitMin, setTimeLimitMin] = useState(30);
  const [untimed, setUntimed] = useState(false);
  const [mode, setMode] = useState("exam");
  const [selTypes, setSelTypes] = useState(ALL_TYPES);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleO, setShuffleO] = useState(true);
  const [passMark, setPassMark] = useState(50);

  const candidates = useMemo(
    () => sources.filter((r) => r && (r.fileUrl || r.description) && !r.sourceResourceId && r.contentType !== "exam"),
    [sources]
  );

  const pickSource = async (f) => {
    setSource(f);
    setPhase("analyzing");
    setError("");
    try {
      setProgress("Extracting text from the document…");
      const { text: t, images: imgs } = await extractResourceText(f);
      if (!t?.trim() && !imgs?.length) throw new Error("Couldn't extract any text from this file.");
      setText(t || "");
      setImages(imgs || []);
      setProgress("AI is analyzing the document…");
      const a = await analyzeDocument(t || "", imgs || []);
      setAnalysis(a);
      // Seed config from analysis
      const detected = a.detectedTypes?.length ? a.detectedTypes : ALL_TYPES;
      setSelTypes(a.docType === "study_material" ? ALL_TYPES : detected);
      const est = a.estimatedQuestions || 0;
      if (a.docType !== "study_material" && est > 0) {
        setCount(Math.min(est, 50));
      }
      setName(f.title ? `Exam — ${f.title}` : "Exam");
      setPhase("config");
    } catch (err) {
      setError(err.message || "Failed to analyze this document.");
      setPhase(candidates.length ? "pick" : "config");
    } finally {
      setProgress("");
    }
  };

  // Auto-start analysis when launched with a preselected file
  useEffect(() => {
    if (phase === "analyzing" && source && !started) {
      setStarted(true);
      pickSource(source);
    }
  }, [phase, source, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const build = async () => {
    setPhase("building");
    setError("");
    setWarnings([]);
    try {
      const config = {
        name: name.trim() || `Exam — ${source?.title || "Material"}`,
        questionCount: count,
        timeLimitMin: untimed ? 0 : timeLimitMin,
        mode,
        types: selTypes,
        shuffleQuestions: shuffleQ,
        shuffleOptions: shuffleO,
        passMarkPct: passMark,
      };
      const { payload, warnings: w } = await generateExam(text, images, config, analysis, setProgress);
      setWarnings(w || []);
      setProgress("Saving exam to your space…");
      let saved = null;
      try {
        saved = await saveExamResource(payload, source);
        onSaved?.(saved);
      } catch (e) {
        // Saving failed — still let the user take the exam now
        console.warn("[exam] save failed:", e?.message);
        setWarnings((prev) => [...prev, "⚠️ Couldn't save this exam to your space — it won't persist after this session."]);
      }
      setRunResource(saved);
      setRunPayload({ ...payload, _warnings: w });
      setPhase("run");
    } catch (err) {
      setError(err.message || "AI couldn't build the exam. Try again.");
      setPhase("config");
    } finally {
      setProgress("");
    }
  };

  const takeSaved = (examRes) => {
    setRunResource(examRes);
    setRunPayload(examFromResource(examRes));
    setPhase("run");
  };

  // ── Running ───────────────────────────────────────────────────────────────
  if (phase === "run" && runPayload) {
    return (
      <ExamRunner
        exam={runPayload}
        examResourceId={runResource?.id}
        sourceTitle={source?.title || runResource?.title}
        onBack={onExit}
        onStreakUpdate={onStreakUpdate}
        onXpUpdate={onXpUpdate}
      />
    );
  }

  // ── Source picker ─────────────────────────────────────────────────────────
  if (phase === "pick") {
    return (
      <div className="exr-root exr-scroll">
        <BuilderTop title="Build an exam" sub="Pick a document — the AI reads it and builds the exam to match." onBack={onExit} />
        <div className="exb-pick-list">
          {candidates.length === 0 && (
            <div className="exr-empty">📭 No documents here yet. Upload a PDF or note first.</div>
          )}
          {candidates.map((f) => {
            const exam = f.variants?.exam || null;
            return (
              <button key={f.id} className="exb-pick" onClick={() => pickSource(f)}>
                <span className="exb-pick-ic">{f.contentType === "pdf" ? "📄" : f.contentType === "note" ? "📝" : "📘"}</span>
                <span className="exb-pick-body">
                  <b>{f.title}</b>
                  <span>{f.subject || f.contentType}{exam ? " · has a saved exam" : ""}</span>
                </span>
                <span className="exb-pick-go">→</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Working (analyzing / building) ────────────────────────────────────────
  if (phase === "analyzing" || phase === "building") {
    return (
      <div className="exr-root exr-center">
        <div className="exb-working">
          <div className="exr-spinner big" />
          <div className="exr-resume-title">{phase === "analyzing" ? "Analyzing document" : "Building your exam"}</div>
          <p className="exr-resume-sub">{progress || "Working…"}</p>
          {phase === "building" && <p className="exb-warnline">Don't close this screen — generation can take a minute on long documents.</p>}
          <button className="exr-btn ghost" onClick={onExit}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Config ────────────────────────────────────────────────────────────────
  const savedExam = source?.variants?.exam || null;
  const detected = analysis?.detectedTypes || [];
  const isBank = analysis?.docType === "question_bank" || analysis?.docType === "mixed";
  const maxCount = isBank && analysis?.estimatedQuestions ? Math.min(Math.max(analysis.estimatedQuestions, 10), 200) : 100;
  const selectedObjective = selTypes.filter((t) => OBJECTIVE_TYPES.includes(t)).length;
  const selectedWritten = selTypes.filter((t) => WRITTEN_TYPES.includes(t)).length;

  return (
    <div className="exr-root exr-scroll">
      <BuilderTop
        title="Build an exam"
        sub={source?.title || ""}
        onBack={onExit}
      />

      {/* AI analysis summary */}
      {analysis && (
        <div className="exb-analysis">
          <div className="exb-analysis-head">
            <span className="exb-analysis-ic">🔍</span>
            <div>
              <b>{analysis.docType === "question_bank" ? "Question bank detected" : analysis.docType === "mixed" ? "Questions + study content" : "Study material"}</b>
              <p>{analysis.summary || "The AI scanned the document."}</p>
            </div>
          </div>
          <div className="exb-analysis-chips">
            {analysis.estimatedQuestions > 0 && (
              <span className="exr-chip">~{analysis.estimatedQuestions} questions found</span>
            )}
            {detected.map((t) => (
              <span key={t} className={`exr-chip t-${t}`}>{QUESTION_TYPES[t]?.icon} {QUESTION_TYPES[t]?.label}</span>
            ))}
            {analysis.language && analysis.language !== "en" && (
              <span className="exr-chip">🌐 {analysis.language}</span>
            )}
          </div>
        </div>
      )}

      {/* Saved exam shortcut */}
      {savedExam && (
        <button className="exb-saved" onClick={() => takeSaved(savedExam)}>
          <span>🎓</span>
          <span className="exb-saved-body">
            <b>{savedExam.title || "Saved exam"}</b>
            <span>Already generated for this file — start it instantly</span>
          </span>
          <span className="exb-pick-go">▶</span>
        </button>
      )}

      <div className="exb-form">
        <label className="exb-label">
          Exam name
          <input className="exr-text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GST 201 Mock" />
        </label>

        <Slider label="Questions" value={count} min={5} max={maxCount} onChange={setCount} />

        <Toggle label="No timer" hint="Untimed — take as long as you need" checked={untimed} onChange={setUntimed} />
        {!untimed && (
          <Slider label="Time limit" value={timeLimitMin} min={5} max={180} step={5} onChange={setTimeLimitMin} format={(v) => `${v} min`} />
        )}

        <div className="exb-field">
          <div className="exb-field-head"><span>Mode</span></div>
          <div className="exb-seg">
            <button className={`exb-seg-btn${mode === "exam" ? " on" : ""}`} onClick={() => setMode("exam")}>
              🎓 Exam<span>no feedback until you submit</span>
            </button>
            <button className={`exb-seg-btn${mode === "practice" ? " on" : ""}`} onClick={() => setMode("practice")}>
              ⚡ Practice<span>instant feedback per question</span>
            </button>
          </div>
        </div>

        <div className="exb-field">
          <div className="exb-field-head"><span>Question types</span><b>{selTypes.length} selected</b></div>
          <div className="exb-types">
            {ALL_TYPES.map((t) => {
              const det = detected.includes(t);
              const on = selTypes.includes(t);
              return (
                <button
                  key={t}
                  className={`exb-type${on ? " on" : ""}${det ? " det" : ""}`}
                  onClick={() => setSelTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                >
                  <span>{QUESTION_TYPES[t].icon} {QUESTION_TYPES[t].label}</span>
                  {det && <em>detected</em>}
                </button>
              );
            })}
          </div>
          {isBank && (
            <p className="exb-hint">
              {selTypes.some((t) => detected.includes(t))
                ? "This document already contains questions — they'll be extracted as written."
                : "None of the detected formats are selected — the AI will generate new questions instead."}
            </p>
          )}
          {!isBank && <p className="exb-hint">The AI will write new questions in the selected formats.</p>}
        </div>

        <Toggle label="Shuffle questions" checked={shuffleQ} onChange={setShuffleQ} />
        {selTypes.includes("mcq") && (
          <Toggle label="Shuffle answer options" checked={shuffleO} onChange={setShuffleO} />
        )}
        <Slider label="Pass mark" value={passMark} min={30} max={90} step={5} onChange={setPassMark} format={(v) => `${v}%`} />

        {selectedWritten > 0 && (
          <div className="exb-note">🤖 {selectedWritten} written type{selectedWritten > 1 ? "s" : ""} selected — the AI will mark those answers with a marking scheme.</div>
        )}
        {selectedObjective === 0 && selectedWritten === 0 && (
          <div className="exb-note warn">Pick at least one question type.</div>
        )}
        {error && <div className="exr-warn">{error}</div>}
        {warnings.map((w, i) => <div key={i} className="exr-warn">{w}</div>)}

        <button className="exr-btn primary big" disabled={selTypes.length === 0} onClick={build}>
          {savedExam ? "Build a new version" : "Build my exam"} ✨
        </button>
      </div>
    </div>
  );
}

function BuilderTop({ title, sub, onBack }) {
  return (
    <div className="exr-top">
      <div className="exr-top-left">
        <span className="exr-title">{title}</span>
        {sub ? <span className="exr-sub">{sub}</span> : null}
      </div>
      <div className="exr-top-right">
        <button className="exr-chip-btn danger" onClick={onBack} aria-label="Close">✕</button>
      </div>
    </div>
  );
}
