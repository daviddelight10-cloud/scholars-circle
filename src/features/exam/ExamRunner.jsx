import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  normalizeExamPayload, shuffleArray, shuffleMcqOptions, gradeObjectiveAnswer,
  isObjectiveType, isWrittenType, totalMarks, countByType,
  saveExamSession, loadExamSession, clearExamSession,
} from "./examSchema";
import { gradeWrittenAnswers, submitExamAttempt } from "./examApi";
import ExamResults from "./ExamResults";
import "./exam.css";

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Prepare the item order for a fresh run: shuffle questions + mcq options per config. */
function prepareItems(questions, config) {
  let items = [...questions];
  if (config.shuffleQuestions) items = shuffleArray(items);
  if (config.shuffleOptions) items = items.map((q) => (q.type === "mcq" ? shuffleMcqOptions(q) : q));
  return items;
}

export default function ExamRunner({ exam, examResourceId, sourceTitle, onBack, onStreakUpdate, onXpUpdate }) {
  const payload = useMemo(() => normalizeExamPayload(exam), [exam]);
  const config = payload?.config || {};
  const timed = (config.timeLimitMin || 0) > 0;
  const practiceMode = config.mode === "practice";
  const examId = examResourceId || `local-${sourceTitle || "exam"}`;

  const [resumeOffer, setResumeOffer] = useState(null); // saved session
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [locked, setLocked] = useState({}); // practice mode: answered-and-revealed
  const [timeLeft, setTimeLeft] = useState(timed ? config.timeLimitMin * 60000 : 0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gradingStage, setGradingStage] = useState("");
  const [result, setResult] = useState(null);
  const startRef = useRef(Date.now());
  const submitRef = useRef(null);

  // ── Init: offer resume if a saved session exists ─────────────────────────
  useEffect(() => {
    if (!payload) return;
    const saved = loadExamSession(examId);
    if (saved && Array.isArray(saved.order) && saved.order.length) {
      setResumeOffer(saved);
      return;
    }
    setItems(prepareItems(payload.questions, config));
    startRef.current = Date.now();
  }, [payload, examId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startFresh = useCallback(() => {
    clearExamSession(examId);
    setResumeOffer(null);
    setItems(prepareItems(payload.questions, config));
    startRef.current = Date.now();
  }, [payload, config, examId]);

  const resume = useCallback(() => {
    const saved = resumeOffer;
    if (!saved) return;
    const byId = {};
    for (const q of payload.questions) byId[q.id] = q;
    const restored = saved.order.map((id) => byId[id]).filter(Boolean);
    if (!restored.length) return startFresh();
    setItems(restored);
    setAnswers(saved.answers || {});
    setFlagged(new Set(saved.flagged || []));
    setLocked(saved.locked || {});
    setIdx(Math.min(saved.idx || 0, restored.length - 1));
    if (timed) setTimeLeft(Math.max(1000, saved.timeLeft ?? config.timeLimitMin * 60000));
    setElapsed(saved.elapsed || 0);
    startRef.current = Date.now() - (saved.elapsed || 0);
    setResumeOffer(null);
  }, [resumeOffer, payload, timed, config.timeLimitMin, startFresh]);

  // ── Autosave every few seconds ────────────────────────────────────────────
  const stateSnapshot = useCallback(() => ({
    order: (items || []).map((q) => q.id),
    answers, flagged: [...flagged], locked, idx,
    timeLeft, elapsed: Date.now() - startRef.current,
  }), [items, answers, flagged, locked, idx, timeLeft]);

  useEffect(() => {
    if (!items || result) return;
    const t = setInterval(() => saveExamSession(examId, stateSnapshot()), 4000);
    return () => clearInterval(t);
  }, [items, result, examId, stateSnapshot]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!items || paused || result) return;
    const t = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
      if (timed) {
        setTimeLeft((prev) => {
          if (prev <= 1000) {
            submitRef.current?.(true);
            return 0;
          }
          return prev - 1000;
        });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [items, paused, result, timed]);

  // ── Answers ───────────────────────────────────────────────────────────────
  // lock:false lets text inputs update without triggering practice-mode reveal
  const setAnswer = useCallback((value, { lock } = {}) => {
    setAnswers((prev) => ({ ...prev, [idx]: value }));
    if (lock !== false && practiceMode && isObjectiveType(items?.[idx]?.type)) {
      setLocked((prev) => ({ ...prev, [idx]: true }));
    }
  }, [idx, items, practiceMode]);

  const pauseBankRef = useRef(0);
  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      if (next) pauseBankRef.current = Date.now() - startRef.current;
      else startRef.current = Date.now() - (pauseBankRef.current || 0);
      return next;
    });
  }, []);

  const toggleFlag = useCallback(() => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, [idx]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting || !items) return;
    setSubmitting(true);
    setConfirmSubmit(false);
    clearExamSession(examId);

    // 1. Objective grading (instant, local)
    const objective = {};
    let marks = 0;
    for (let i = 0; i < items.length; i++) {
      const g = gradeObjectiveAnswer(items[i], answers[i]);
      if (g) {
        objective[i] = g;
        marks += g.marksAwarded;
      }
    }

    // 2. Written grading (batched AI)
    let aiGrading = {};
    const writtenIdx = items.map((q, i) => (isWrittenType(q.type) ? i : -1)).filter((i) => i >= 0);
    let gradingFailed = false;
    if (writtenIdx.length) {
      setGradingStage(`AI is marking ${writtenIdx.length} written answer${writtenIdx.length > 1 ? "s" : ""}…`);
      try {
        const byId = await gradeWrittenAnswers(items, answers);
        for (const i of writtenIdx) {
          const g = byId[items[i].id];
          if (g) {
            aiGrading[i] = g;
            marks += g.marksAwarded;
          }
        }
        if (Object.keys(aiGrading).length < writtenIdx.length) gradingFailed = true;
      } catch (err) {
        gradingFailed = true;
        console.warn("[exam] grading failed:", err?.message);
      }
    }
    setGradingStage("");

    const total = totalMarks(items);
    const details = items.map((q, i) => ({
      questionIndex: i,
      questionId: q.id,
      type: q.type,
      correct: objective[i]?.correct ?? null,
      selected: answers[i] ?? null,
      marksAwarded: objective[i]?.marksAwarded ?? aiGrading[i]?.marksAwarded ?? 0,
      maxMarks: q.marks,
      feedback: aiGrading[i]?.feedback || null,
    }));

    let serverData = {};
    if (examResourceId) {
      try {
        serverData = await submitExamAttempt(examResourceId, { score: marks, total, details });
        if (serverData.streak != null && onStreakUpdate) onStreakUpdate(serverData.streak, serverData.longestStreak);
        if (serverData.xpAwarded > 0 && onXpUpdate) onXpUpdate(serverData.xpAwarded);
      } catch (err) {
        console.error("[exam] submit error:", err);
      }
    }

    setResult({
      items, answers, objective, aiGrading, gradingFailed,
      score: marks, total,
      autoSubmitted: auto,
      timeMs: Date.now() - startRef.current,
      ...serverData,
    });
    setSubmitting(false);
  }, [submitting, items, answers, examId, examResourceId, onStreakUpdate, onXpUpdate]);

  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!payload) {
    return (
      <div className="exr-root exr-center">
        <div className="exr-empty">⚠️ This exam couldn't be loaded.</div>
        <button className="exr-btn ghost" onClick={onBack}>← Back</button>
      </div>
    );
  }

  if (resumeOffer) {
    const n = Object.keys(resumeOffer.answers || {}).length;
    return (
      <div className="exr-root exr-center">
        <div className="exr-resume-card">
          <div className="exr-resume-ic">⏸</div>
          <div className="exr-resume-title">Resume your exam?</div>
          <p className="exr-resume-sub">
            You have an unfinished attempt — {n} of {payload.questions.length} answered
            {timed ? `, ${fmt(resumeOffer.timeLeft)} left` : ""}.
          </p>
          <button className="exr-btn primary" onClick={resume}>Resume exam</button>
          <button className="exr-btn ghost" onClick={startFresh}>Start over</button>
        </div>
      </div>
    );
  }

  if (!items) return <div className="exr-root exr-center"><div className="exr-empty">Preparing…</div></div>;

  if (result) {
    return (
      <ExamResults
        result={result}
        exam={payload}
        sourceTitle={sourceTitle}
        onBack={onBack}
        onRetake={startFresh}
      />
    );
  }

  const q = items[idx];
  const answered = Object.keys(answers).filter((k) => answers[k] !== "" && answers[k] != null).length;
  const byType = countByType(items);
  const isLocked = practiceMode && locked[idx] && isObjectiveType(q.type);
  const lowTime = timed && timeLeft < 60000;

  return (
    <div className="exr-root">
      {/* Header */}
      <div className="exr-top">
        <div className="exr-top-left">
          <span className="exr-title">🎓 {config.name || sourceTitle || "Exam"}</span>
          <span className="exr-sub">Q{idx + 1}/{items.length} · {answered} answered</span>
        </div>
        <div className="exr-top-right">
          <span className={`exr-timer${lowTime ? " low" : ""}`}>
            ⏱ {timed ? fmt(timeLeft) : fmt(elapsed)}
          </span>
          {timed && (
            <button className={`exr-chip-btn${paused ? " on" : ""}`} onClick={togglePause}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          )}
          <button className="exr-chip-btn" onClick={() => setShowNav((v) => !v)}>🗺</button>
          <button className="exr-chip-btn danger" onClick={onBack} aria-label="Exit exam">✕</button>
        </div>
      </div>

      <div className="exr-progress"><div style={{ width: `${((idx + 1) / items.length) * 100}%` }} /></div>

      {/* Navigator */}
      {showNav && (
        <div className="exr-nav">
          <div className="exr-nav-grid">
            {items.map((it, i) => {
              const cls = [
                "exr-nav-dot",
                i === idx ? "cur" : "",
                answers[i] != null && answers[i] !== "" ? "done" : "",
                flagged.has(i) ? "flag" : "",
              ].join(" ");
              return (
                <button key={it.id || i} className={cls} onClick={() => { setIdx(i); setShowNav(false); }}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="exr-nav-legend">
            <span>🟢 Answered</span><span>🟡 Current</span><span>🚩 Flagged</span><span>⬛ Unanswered</span>
          </div>
        </div>
      )}

      {/* Paused overlay */}
      {paused && (
        <div className="exr-paused">
          <div className="exr-resume-ic">⏸</div>
          <div className="exr-resume-title">Exam paused</div>
          <div className="exr-resume-sub">⏱ {fmt(timeLeft)} remaining</div>
          <button className="exr-btn primary" onClick={togglePause}>Resume</button>
        </div>
      )}

      {/* Question body */}
      {!paused && (
        <div className="exr-body">
          <div className="exr-qcard">
            <div className="exr-qhead">
              <span className={`exr-qtype t-${q.type}`}>{typeBadge(q.type)}</span>
              <span className="exr-qmarks">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
              <button className={`exr-flag${flagged.has(idx) ? " on" : ""}`} onClick={toggleFlag}>
                {flagged.has(idx) ? "🚩" : "🏳"}
              </button>
            </div>
            <div className="exr-qtext">{q.question}</div>
            {q.type === "fillblank" && <div className="exr-qhint">Type the missing word or phrase</div>}
            {(q.type === "shortanswer" || q.type === "essay") && (
              <div className="exr-qhint">Written answer — the AI marks it against a scheme at the end</div>
            )}
          </div>

          <AnswerInput
            q={q}
            value={answers[idx]}
            locked={isLocked}
            practiceMode={practiceMode}
            onChange={setAnswer}
          />

          {/* Practice-mode instant feedback */}
          {practiceMode && isLocked && (
            <PracticeFeedback q={q} answer={answers[idx]} />
          )}

          <div className="exr-foot">
            <button className="exr-btn ghost" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              ← Prev
            </button>
            {idx < items.length - 1 ? (
              <button className="exr-btn primary" onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))}>
                Next →
              </button>
            ) : (
              <button className="exr-btn submit" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit exam ✓"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Submit confirm */}
      {confirmSubmit && (
        <div className="exr-modal-bg" onClick={() => setConfirmSubmit(false)}>
          <div className="exr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exr-resume-ic">📝</div>
            <div className="exr-resume-title">Submit exam?</div>
            <p className="exr-resume-sub">
              {items.length - answered > 0
                ? `${items.length - answered} unanswered question${items.length - answered > 1 ? "s" : ""} will score 0.`
                : "All questions answered."}
              {flagged.size > 0 && ` ${flagged.size} flagged.`}
              {writtenSummary(byType)}
            </p>
            <div className="exr-modal-row">
              <button className="exr-btn ghost" onClick={() => setConfirmSubmit(false)}>Go back</button>
              <button className="exr-btn submit" onClick={() => handleSubmit(false)}>Submit now</button>
            </div>
          </div>
        </div>
      )}

      {/* AI marking overlay */}
      {gradingStage && (
        <div className="exr-modal-bg">
          <div className="exr-modal">
            <div className="exr-spinner" />
            <div className="exr-resume-title">{gradingStage}</div>
            <p className="exr-resume-sub">Hang tight — objective answers are already scored.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function typeBadge(type) {
  const map = {
    mcq: "◉ MCQ",
    truefalse: "⚖ True/False",
    fillblank: "✎ Fill blank",
    shortanswer: "≡ Short answer",
    essay: "📝 Theory",
  };
  return map[type] || type;
}

function writtenSummary(byType) {
  const written = (byType.shortanswer || 0) + (byType.essay || 0);
  return written > 0 ? ` ${written} written answer${written > 1 ? "s" : ""} will be AI-marked.` : "";
}

function AnswerInput({ q, value, locked, practiceMode, onChange }) {
  if (q.type === "mcq") {
    return (
      <div className="exr-opts">
        {Object.entries(q.options).map(([key, val]) => {
          const isSel = value === key;
          const showCorrect = locked && key === q.correct;
          const showWrong = locked && isSel && key !== q.correct;
          return (
            <button
              key={key}
              className={`exr-opt${isSel ? " sel" : ""}${showCorrect ? " ok" : ""}${showWrong ? " bad" : ""}`}
              disabled={locked}
              onClick={() => onChange(key)}
            >
              <span className="exr-opt-key">{key}</span>
              <span className="exr-opt-val">{val}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "truefalse") {
    return (
      <div className="exr-opts row">
        {[true, false].map((v) => {
          const isSel = value === v || String(value) === String(v);
          const showCorrect = locked && v === q.correct;
          const showWrong = locked && isSel && v !== q.correct;
          return (
            <button
              key={String(v)}
              className={`exr-opt tf${isSel ? " sel" : ""}${showCorrect ? " ok" : ""}${showWrong ? " bad" : ""}`}
              disabled={locked}
              onClick={() => onChange(v)}
            >
              {v ? "✓ True" : "✕ False"}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "fillblank") {
    return (
      <div className="exr-fillblank">
        <input
          className={`exr-text-input${locked ? (value && gradeObjectiveAnswer(q, value)?.correct ? " ok" : " bad") : ""}`}
          type="text"
          value={value || ""}
          disabled={locked}
          placeholder="Type the missing word/phrase…"
          onChange={(e) => onChange(e.target.value, { lock: false })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && practiceMode && !locked) onChange(e.target.value);
          }}
          onBlur={(e) => {
            if (practiceMode && !locked && e.target.value.trim()) onChange(e.target.value);
          }}
        />
        {locked && <div className="exr-qhint">Answer: {(q.acceptableAnswers || [])[0]}</div>}
      </div>
    );
  }

  // shortanswer / essay
  return (
    <textarea
      className="exr-textarea"
      rows={q.type === "essay" ? 9 : 4}
      value={value || ""}
      placeholder={q.type === "essay" ? "Write a structured answer — cover all parts of the question…" : "Type a short answer…"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function PracticeFeedback({ q, answer }) {
  const g = gradeObjectiveAnswer(q, answer);
  if (!g) return null;
  return (
    <div className={`exr-feedback${g.correct ? " ok" : " bad"}`}>
      <b>{g.correct ? "✓ Correct" : "✗ Incorrect"}</b>
      {q.type === "fillblank" && !g.correct && (
        <span> — accepted: {(q.acceptableAnswers || []).slice(0, 3).join(", ")}</span>
      )}
      {q.explanation && <p>{q.explanation}</p>}
    </div>
  );
}
