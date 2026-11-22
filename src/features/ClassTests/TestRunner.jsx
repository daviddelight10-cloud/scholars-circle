import { useCallback, useEffect, useRef, useState } from "react";
import { classTestApi } from "./classTestApi.js";

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Student test runner — questions arrive shuffled with no answers; the server grades. */
export function TestRunner({ test, token, onDone }) {
  const [phase, setPhase] = useState("cover"); // cover | exam | result | error
  const [paper, setPaper] = useState(null);    // { attemptId, questions, deadlineTs, offsetMs, test }
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [leftMs, setLeftMs] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const submitRef = useRef(null);

  const answeredCount = paper ? paper.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== null).length : 0;

  const begin = async () => {
    setErr(null);
    try {
      const d = await classTestApi.start(test.id, token);
      const offsetMs = new Date(d.serverNow).getTime() - Date.now();
      setPaper({
        attemptId: d.attemptId,
        questions: d.questions,
        deadlineTs: new Date(d.deadline).getTime(),
        offsetMs,
        test: d.test,
      });
      setAnswers(d.answers || {});
      setLeftMs(new Date(d.deadline).getTime() - (Date.now() + offsetMs));
      setPhase("exam");
    } catch (e) {
      if (e.status === 409 && e.data?.expired) setErr("Your time for this test has expired.");
      else if (e.status === 409) setErr(e.message);
      else setErr(e.message || "Couldn't start the test");
    }
  };

  const doSubmit = useCallback(async () => {
    if (!paper || submitting) return;
    setSubmitting(true);
    try { localStorage.removeItem(`sc_ct_${paper.attemptId}`); } catch {}
    try {
      const r = await classTestApi.submit(test.id, answers, token);
      setResult(r);
      setPhase("result");
    } catch (e) {
      setErr(e.message);
      if (e.status === 409) { setResult({ submitted: true }); setPhase("result"); }
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }, [paper, submitting, answers, test.id, token]);

  useEffect(() => { submitRef.current = doSubmit; }, [doSubmit]);

  // Server-anchored countdown + autosave
  useEffect(() => {
    if (phase !== "exam" || !paper) return;
    const t = setInterval(() => {
      const left = paper.deadlineTs - (Date.now() + paper.offsetMs);
      setLeftMs(left);
      if (left <= 0) submitRef.current?.();
    }, 1000);
    const save = setInterval(() => {
      try { localStorage.setItem(`sc_ct_${paper.attemptId}`, JSON.stringify(answers)); } catch {}
    }, 4000);
    return () => { clearInterval(t); clearInterval(save); };
  }, [phase, paper, answers]);

  // Restore any locally-saved answers on top of what the server returned
  useEffect(() => {
    if (!paper) return;
    try {
      const raw = localStorage.getItem(`sc_ct_${paper.attemptId}`);
      if (raw) setAnswers((a) => ({ ...a, ...JSON.parse(raw) }));
    } catch {}
  }, [paper]);

  if (phase === "cover") {
    return (
      <div className="ctr-root">
        <div className="ctr-cover">
          <div className="ctr-cover-ic">✍️</div>
          <div className="ctr-cover-title">{test.title}</div>
          <div className="ctr-cover-meta">
            <span className="ct-chip upcoming">{test.questionCount} questions</span>
            <span className="ct-chip upcoming">{test.durationMin} min</span>
          </div>
          <div className="ctr-cover-sub">
            {test.instructions ? `${test.instructions}\n\n` : ""}
            One attempt only — the timer starts when you begin and the test submits automatically at time-up.
          </div>
          {err && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{err}</div>}
          <button className="ct-btn" onClick={begin}>{test.myAttempt ? "Resume attempt" : "Begin test"} →</button>
          <button className="ct-btn ghost" style={{ marginLeft: 8 }} onClick={onDone}>Back</button>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const hasScore = result && result.score !== undefined;
    return (
      <div className="ctr-root">
        <div className="ctr-cover">
          <div className="ctr-cover-ic">{result?.late ? "⏰" : "✅"}</div>
          <div className="ctr-cover-title">{result?.late ? "Submitted late" : "Test submitted"}</div>
          {hasScore ? (
            <>
              <div className="ctr-score">{result.percent}%</div>
              <div className="ctr-score-sub">{result.score} / {result.maxScore} marks</div>
            </>
          ) : (
            <div className="ctr-cover-sub">Your answers were recorded — your lecturer will release scores.</div>
          )}
          {err && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{err}</div>}
          <button className="ct-btn" onClick={onDone}>Back to class</button>
        </div>
      </div>
    );
  }

  if (!paper) return null;
  const q = paper.questions[idx];
  const isLast = idx === paper.questions.length - 1;
  const low = leftMs < 60000;

  return (
    <div className="ctr-root">
      <div className="ctr-top">
        <span className="ctr-title">{paper.test.title}</span>
        <span className={`ctr-timer${low ? " low" : ""}`}>⏱ {fmt(leftMs)}</span>
      </div>
      <div className="ctr-progress"><div style={{ width: `${(answeredCount / paper.questions.length) * 100}%` }} /></div>

      <div className="ctr-qnum">Question {idx + 1} of {paper.questions.length}{q.marks > 1 ? ` · ${q.marks} marks` : ""}</div>
      <div className="ctr-qtext">{q.question}</div>

      {q.options.map((opt, i) => (
        <button
          key={i}
          className={`ctr-opt${answers[q.id] === i ? " sel" : ""}`}
          onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
        >
          <span className="ctr-opt-letter">{String.fromCharCode(65 + i)}</span>
          <span>{opt}</span>
        </button>
      ))}

      <div className="ctr-dots">
        {paper.questions.map((qq, i) => (
          <button
            key={qq.id}
            className={`ctr-dot${answers[qq.id] != null ? " answered" : ""}${i === idx ? " current" : ""}`}
            onClick={() => setIdx(i)}
          >{i + 1}</button>
        ))}
      </div>

      <div className="ctr-nav">
        <button className="ct-btn ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>← Prev</button>
        {isLast ? (
          <button className="ct-btn" disabled={submitting} onClick={() => setConfirming(true)}>
            {submitting ? "Submitting…" : "Submit ✓"}
          </button>
        ) : (
          <button className="ct-btn ghost" onClick={() => setIdx((i) => i + 1)}>Next →</button>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        {!isLast && <button className="ct-back" onClick={() => setConfirming(true)}>Submit now · {answeredCount}/{paper.questions.length} answered</button>}
      </div>

      {confirming && (
        <div className="modal-overlay" onClick={() => setConfirming(false)}>
          <div className="cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">Submit test?</h3>
            <p style={{ fontSize: 12, color: "var(--app-dim)", marginBottom: 14 }}>
              {answeredCount} of {paper.questions.length} answered. You can't change answers after submitting.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ct-btn ghost" style={{ flex: 1 }} onClick={() => setConfirming(false)}>Keep writing</button>
              <button className="ct-btn" style={{ flex: 1 }} disabled={submitting} onClick={doSubmit}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
