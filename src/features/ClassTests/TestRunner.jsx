import { useCallback, useEffect, useRef, useState } from "react";
import { classTestApi } from "./classTestApi.js";
import { useOverlayBackClose } from "../../hooks/useOverlayBackClose.js";

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const isAnswered = (v) => v !== undefined && v !== null && v !== "";

/**
 * Student test runner — questions arrive shuffled with no answers; the server
 * grades. `shareToken` switches start/submit to the share-link endpoints
 * (guest takes) but the exam UI is identical.
 */
export function TestRunner({ test, token, onDone, shareToken = null, me = null }) {
  const [phase, setPhase] = useState("cover"); // cover | exam | result | review
  const [details, setDetails] = useState({ displayName: me?.fullName || me?.name || "", matricNo: me?.matricNumber || "" });
  const [paper, setPaper] = useState(null);    // { attemptId, questions, deadlineTs, offsetMs, test }
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [leftMs, setLeftMs] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null); // post-close review payload
  const [err, setErr] = useState(null);
  const submitRef = useRef(null);
  const lastFocusPing = useRef(0);

  // Back button: leave the cover freely; mid-exam confirm leaving (progress
  // is saved server-side, so exiting and resuming later is safe).
  useOverlayBackClose(() => {
    if (phase === "exam") setLeaving(true);
    else onDone();
  }, { open: true });

  const answeredCount = paper ? paper.questions.filter((q) => isAnswered(answers[q.id])).length : 0;

  const startCall = useCallback((d) => {
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
  }, []);

  const begin = async () => {
    setErr(null);
    const resuming = test.myAttempt?.status === "in_progress";
    if (!resuming && !details.displayName.trim()) return setErr("Enter your name — it goes on the results sheet.");
    try {
      const d = shareToken
        ? await classTestApi.shareStart(shareToken, details, token)
        : await classTestApi.start(test.id, details, token);
      startCall(d);
    } catch (e) {
      setErr(e.status === 409 && e.data?.expired ? "Your time for this test has expired." : (e.message || "Couldn't start the test"));
    }
  };

  // Resumable guests/members: skip the form when an attempt already exists.
  useEffect(() => {
    if (test.myAttempt?.status === "in_progress") begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSubmit = useCallback(async (isRetry = false) => {
    if (!paper || submitting) return;
    setSubmitting(true);
    setSubmitFailed(false);
    const target = shareToken ? (paper.test?.id || test.id) : test.id;
    try { localStorage.removeItem(`sc_ct_${paper.attemptId}`); } catch {}
    try {
      const r = await classTestApi.submit(target, answers, token);
      setResult(r);
      setPhase("result");
    } catch (e) {
      if (e.status === 409) { setResult({ submitted: true }); setPhase("result"); }
      else {
        // Network/server hiccup — keep the paper, offer retry (answers are safe locally).
        setSubmitFailed(true);
        setErr(e.message || "Couldn't submit — check your connection");
      }
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }, [paper, submitting, answers, test.id, shareToken, token]);

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

  // Focus-loss flag — throttled to one ping per 5s so flicking tabs doesn't spam.
  useEffect(() => {
    if (phase !== "exam" || !paper) return;
    const ping = () => {
      const now = Date.now();
      if (now - lastFocusPing.current < 5000) return;
      lastFocusPing.current = now;
      const target = shareToken ? (paper.test?.id || test.id) : test.id;
      classTestApi.flagFocus(target, token).catch(() => {});
    };
    const onVis = () => { if (document.hidden) ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", ping);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", ping);
    };
  }, [phase, paper, test.id, shareToken, token]);

  // Keyboard: ←/→ navigate, 1-4/A-D pick, Enter = next/submit.
  useEffect(() => {
    if (phase !== "exam" || !paper) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" && e.target.type === "text") return;
      if (e.target.tagName === "TEXTAREA") return;
      const q = paper.questions[idx];
      const letters = { a: 0, b: 1, c: 2, d: 3 };
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(paper.questions.length - 1, i + 1));
      else if (q?.options?.length) {
        let pick = -1;
        if (/^[1-4]$/.test(e.key)) pick = Number(e.key) - 1;
        else if (letters[e.key.toLowerCase()] !== undefined) pick = letters[e.key.toLowerCase()];
        if (pick >= 0 && pick < q.options.length) {
          setAnswers((a) => ({ ...a, [q.id]: pick }));
          if (idx < paper.questions.length - 1) setTimeout(() => setIdx((i) => i + 1), 120);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, paper, idx]);

  const loadReview = async () => {
    try {
      const d = await classTestApi.mine(test.id, token);
      if (d.review) { setReview(d.review); setPhase("review"); }
      else setErr("Review isn't available yet — your lecturer releases it after the test closes.");
    } catch (e) { setErr(e.message); }
  };

  // ── Cover ──────────────────────────────────────────────────────────
  if (phase === "cover") {
    // Already submitted — score + optional review instead of a dead Begin.
    if (test.myAttempt?.status === "submitted") {
      const pct = test.myAttempt.percent;
      return (
        <div className="ctr-root">
          <div className="ctr-cover">
            <div className="ctr-cover-ic">✅</div>
            <div className="ctr-cover-title">{test.title}</div>
            {test.showScore && pct != null ? (
              <>
                <div className="ctr-score">{pct}%</div>
                <div className="ctr-score-sub">{test.myAttempt.score} / {test.myAttempt.maxScore} marks</div>
              </>
            ) : (
              <div className="ctr-cover-sub">Submitted — scores will be released by your lecturer.</div>
            )}
            {err && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{err}</div>}
            <button className="ct-btn" onClick={onDone}>Back</button>
            <button className="ct-btn ghost" style={{ marginLeft: 8 }} onClick={loadReview}>Review answers</button>
          </div>
        </div>
      );
    }
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
          <div className="ctr-details">
            <input
              className="ct-input" placeholder="Your full name (goes on the results sheet)"
              value={details.displayName}
              onChange={(e) => setDetails((d) => ({ ...d, displayName: e.target.value }))}
            />
            <input
              className="ct-input" placeholder="Matric / Reg number (optional)"
              value={details.matricNo}
              onChange={(e) => setDetails((d) => ({ ...d, matricNo: e.target.value }))}
            />
          </div>
          {err && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{err}</div>}
          <button className="ct-btn" onClick={begin}>{test.myAttempt ? "Resume attempt" : "Begin test"} →</button>
          <button className="ct-btn ghost" style={{ marginLeft: 8 }} onClick={onDone}>Back</button>
        </div>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────
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
          {!shareToken && test.showAnswers && (
            <button className="ct-btn ghost" style={{ marginLeft: 8 }} onClick={loadReview}>Review answers</button>
          )}
        </div>
      </div>
    );
  }

  // ── Post-close review ──────────────────────────────────────────────
  if (phase === "review" && review) {
    return (
      <div className="ctr-root">
        <div className="ctr-top">
          <span className="ctr-title">Review — {test.title}</span>
          <button className="ct-btn ghost small" onClick={onDone}>← Done</button>
        </div>
        <div className="ct-list">
          {review.map((r, i) => (
            <div key={i} className="ct-card ctr-review-card">
              <div className="ct-card-main">
                <div className="ct-card-title" style={{ whiteSpace: "normal" }}>
                  {r.correct ? "✅" : "❌"} Q{i + 1}. {r.question}
                </div>
                {r.questionType === "fillblank" ? (
                  <div className="ct-card-meta">
                    Your answer: <b>{r.pickedText || "—"}</b> · accepted: <b>{r.acceptedAnswer}</b>
                  </div>
                ) : (
                  <div className="ctr-review-opts">
                    {r.options.map((o, oi) => (
                      <div
                        key={oi}
                        className={`ctr-review-opt${oi === r.correctIndex ? " right" : ""}${oi === r.picked && oi !== r.correctIndex ? " wrong" : ""}`}
                      >
                        <b>{"ABCD"[oi]}</b> {o}
                        {oi === r.correctIndex && " ✓"}
                        {oi === r.picked && oi !== r.correctIndex && " — your pick"}
                      </div>
                    ))}
                  </div>
                )}
                <div className="ct-card-meta" style={{ marginTop: 4 }}>
                  {r.marksAwarded}/{r.marks} marks{r.topic ? ` · ${r.topic}` : ""}
                </div>
                {r.explanation && <div className="ctr-review-expl">{r.explanation}</div>}
              </div>
            </div>
          ))}
        </div>
        <button className="ct-btn" style={{ width: "100%", marginTop: 14 }} onClick={onDone}>Done</button>
      </div>
    );
  }

  if (!paper) return null;
  const q = paper.questions[idx];
  const isLast = idx === paper.questions.length - 1;
  const low = leftMs < 60000;
  const isFill = q.questionType === "fillblank";

  return (
    <div className="ctr-root">
      <div className="ctr-top">
        <span className="ctr-title">{paper.test.title}</span>
        <span className={`ctr-timer${low ? " low" : ""}`}>⏱ {fmt(leftMs)}</span>
      </div>
      <div className="ctr-progress"><div style={{ width: `${(answeredCount / paper.questions.length) * 100}%` }} /></div>

      <div className="ctr-qnum">
        Question {idx + 1} of {paper.questions.length}{q.marks > 1 ? ` · ${q.marks} marks` : ""}
        {q.questionType && q.questionType !== "mcq" ? ` · ${q.questionType === "truefalse" ? "True/False" : "Fill in the blank"}` : ""}
      </div>
      <div className="ctr-qtext">{q.question}</div>

      {isFill ? (
        <input
          className="ct-input ctr-fillin"
          placeholder="Type your answer…"
          value={answers[q.id] ?? ""}
          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
        />
      ) : (
        q.options.map((opt, i) => (
          <button
            key={i}
            className={`ctr-opt${answers[q.id] === i ? " sel" : ""}`}
            onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
          >
            <span className="ctr-opt-letter">{String.fromCharCode(65 + i)}</span>
            <span>{opt}</span>
          </button>
        ))
      )}

      <div className="ctr-dots">
        {paper.questions.map((qq, i) => (
          <button
            key={qq.id}
            className={`ctr-dot${isAnswered(answers[qq.id]) ? " answered" : ""}${i === idx ? " current" : ""}`}
            onClick={() => setIdx(i)}
          >{i + 1}</button>
        ))}
      </div>

      {submitFailed && (
        <div className="ctr-submit-warn">
          ⚠️ Couldn't reach the server — your answers are saved locally. Keep writing and retry.
          <button className="ct-btn small" style={{ marginLeft: 8 }} disabled={submitting} onClick={() => doSubmit(true)}>
            {submitting ? "Retrying…" : "Retry now"}
          </button>
        </div>
      )}

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

      {leaving && (
        <div className="modal-overlay" onClick={() => setLeaving(false)}>
          <div className="cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">Leave the test?</h3>
            <p style={{ fontSize: 12, color: "var(--app-dim)", marginBottom: 14 }}>
              Your answers are saved — you can resume while the test is still open. The timer keeps running.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ct-btn" style={{ flex: 1 }} onClick={() => setLeaving(false)}>Keep writing</button>
              <button className="ct-btn ghost" style={{ flex: 1 }} onClick={onDone}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-overlay" onClick={() => setConfirming(false)}>
          <div className="cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">Submit test?</h3>
            <p style={{ fontSize: 12, color: "var(--app-dim)", marginBottom: 14 }}>
              {answeredCount} of {paper.questions.length} answered. You can't change answers after submitting.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ct-btn ghost" style={{ flex: 1 }} onClick={() => setConfirming(false)}>Keep writing</button>
              <button className="ct-btn" style={{ flex: 1 }} disabled={submitting} onClick={() => doSubmit()}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
