import { useState, useEffect, useRef, useCallback } from "react";
import { calculateSessionAnalytics } from "./SmartEngine";
import PostSessionInsights from "./PostSessionInsights";
import { callAI } from "../../lib/aiClient";

/**
 * Realistic Exam Simulator with:
 * - Pause/Resume (deducts 30s penalty per pause)
 * - Question navigator with flagging
 * - Auto-submit on timeout
 * - Per-question time tracking
 * - Post-exam detailed analytics
 */
export default function ExamSimulator({ session, onExit, onComplete, aiConfig, history = [] }) {
  const questions = session.questions;
  const totalSeconds = session.totalSeconds || questions.length * 90;

  // State
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(new Array(questions.length).fill(null)); // selected option per Q
  const [flagged, setFlagged] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [perQTime, setPerQTime] = useState(new Array(questions.length).fill(0));
  const [startedAt] = useState(Date.now());
  const lastQSwitch = useRef(Date.now());

  // Timer
  useEffect(() => {
    if (paused || finished) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, paused, finished]);

  // Track time spent on current question
  useEffect(() => {
    lastQSwitch.current = Date.now();
  }, [idx]);

  const recordTimeForCurrentQ = useCallback(() => {
    const elapsed = Math.round((Date.now() - lastQSwitch.current) / 1000);
    setPerQTime(prev => {
      const copy = [...prev];
      copy[idx] = (copy[idx] || 0) + elapsed;
      return copy;
    });
  }, [idx]);

  function selectAnswer(optionIdx) {
    if (finished) return;
    setAnswers(prev => {
      const copy = [...prev];
      copy[idx] = optionIdx;
      return copy;
    });
  }

  function goToQuestion(qIdx) {
    recordTimeForCurrentQ();
    setIdx(qIdx);
    setShowNav(false);
  }

  function toggleFlag() {
    setFlagged(prev => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx);
      else s.add(idx);
      return s;
    });
  }

  function handlePause() {
    if (paused) {
      // Resume
      setPaused(false);
      lastQSwitch.current = Date.now();
    } else {
      // Pause — 30s penalty
      recordTimeForCurrentQ();
      setPaused(true);
      setPauseCount(c => c + 1);
      setTimeLeft(t => Math.max(0, t - 30));
    }
  }

  function handleSubmit() {
    recordTimeForCurrentQ();
    setFinished(true);
  }

  function handleConfirmSubmit() {
    const unanswered = answers.filter(a => a === null).length;
    if (unanswered > 0 && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    handleSubmit();
  }

  // ─── Finished: show insights ─────────────────────────────────────────
  if (finished) {
    const results = answers.map((selected, i) => ({
      selected: selected ?? -1,
      correct: selected === questions[i]?.answer,
      confidence: "okay",
      subjectId: questions[i]?.subjectId,
      questionId: questions[i]?.key || questions[i]?.questionId,
    }));

    const duration = Math.round((Date.now() - startedAt) / 1000);
    const analytics = calculateSessionAnalytics(results, questions, duration);

    // Add per-question timing info
    analytics.perQuestionTime = perQTime;
    analytics.avgTimePerQuestion = Math.round(perQTime.reduce((a, b) => a + b, 0) / Math.max(1, questions.length));
    analytics.pauseCount = pauseCount;

    const finalResult = {
      score: analytics.score,
      total: analytics.total,
      results,
      mode: session.mode,
      seconds: duration,
    };

    return (
      <PostSessionInsights
        analytics={analytics}
        session={session}
        results={results}
        questions={questions}
        history={history}
        aiConfig={aiConfig}
        onExit={(action) => {
          if (onComplete) onComplete(finalResult);
          if (onExit) onExit(action);
        }}
        onSave={() => { if (onComplete) onComplete(finalResult); }}
      />
    );
  }

  // ─── Paused overlay ───────────────────────────────────────────────────
  if (paused) {
    return (
      <div style={{
        background: "rgba(15, 23, 42, 0.98)", borderRadius: 20, padding: 40,
        textAlign: "center", border: "1px solid rgba(99, 102, 241, 0.2)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏸️</div>
        <h2 style={{ color: "#e0e7ff", margin: "0 0 8px" }}>Exam Paused</h2>
        <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>
          A 30-second penalty was applied. ({pauseCount} pause{pauseCount > 1 ? "s" : ""} used)
        </p>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", marginBottom: 24 }}>
          ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} remaining
        </div>
        <button
          onClick={handlePause}
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", padding: "14px 32px", borderRadius: 12,
            color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
          }}
        >▶️ Resume Exam</button>
      </div>
    );
  }

  // ─── Active Exam UI ──────────────────────────────────────────────────
  const current = questions[idx];
  const answered = answers.filter(a => a !== null).length;
  const progress = ((idx + 1) / questions.length) * 100;
  const isLowTime = timeLeft < 60;

  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(15, 23, 42, 0.97), rgba(30, 41, 59, 0.95))",
      border: "1px solid rgba(99, 102, 241, 0.2)",
      borderRadius: 20, overflow: "hidden",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    }}>
      {/* Header Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
        padding: "14px 20px",
        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))",
        borderBottom: "1px solid rgba(99, 102, 241, 0.15)",
      }}>
        {/* Left: Subject info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{session.source?.icon || "📝"}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e7ff" }}>{session.source?.label || "Exam"}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Q{idx + 1}/{questions.length} · {answered} answered</div>
          </div>
        </div>

        {/* Right: Timer + controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Timer */}
          <div style={{
            padding: "8px 14px", borderRadius: 20, fontWeight: 700, fontSize: 14,
            background: isLowTime ? "linear-gradient(135deg, #ef4444, #dc2626)" : "rgba(30, 41, 59, 0.8)",
            border: `1px solid ${isLowTime ? "rgba(239, 68, 68, 0.5)" : "rgba(99, 102, 241, 0.3)"}`,
            color: "#fff", animation: isLowTime ? "pulse 1s infinite" : "none",
          }}>
            ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </div>

          {/* Pause */}
          <button onClick={handlePause} style={{
            padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(245, 158, 11, 0.3)",
            background: "rgba(245, 158, 11, 0.1)", color: "#fbbf24", fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}>⏸️</button>

          {/* Navigator toggle */}
          <button onClick={() => setShowNav(!showNav)} style={{
            padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99, 102, 241, 0.3)",
            background: "rgba(99, 102, 241, 0.1)", color: "#a5b4fc", fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}>🗺️</button>

          {/* Exit */}
          <button onClick={() => { if (window.confirm("Exit exam? Progress will be lost.")) onExit(); }} style={{
            padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "rgba(239, 68, 68, 0.1)", color: "#f87171", fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}>✕</button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 4, background: "rgba(30, 41, 59, 0.8)" }}>
        <div style={{
          height: "100%", transition: "width 0.3s", borderRadius: 2,
          width: `${progress}%`,
          background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
        }} />
      </div>

      {/* Question Navigator Overlay */}
      {showNav && (
        <div style={{
          padding: 16, borderBottom: "1px solid rgba(99, 102, 241, 0.15)",
          background: "rgba(15, 23, 42, 0.95)",
        }}>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>Jump to question:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {questions.map((_, i) => {
              const isAnswered = answers[i] !== null;
              const isFlagged = flagged.has(i);
              const isCurrent = i === idx;
              let bg = "rgba(30, 41, 59, 0.8)";
              let border = "rgba(99, 102, 241, 0.2)";
              if (isCurrent) { bg = "rgba(99, 102, 241, 0.3)"; border = "#6366f1"; }
              else if (isAnswered) { bg = "rgba(34, 197, 94, 0.2)"; border = "rgba(34, 197, 94, 0.4)"; }
              if (isFlagged) border = "#f59e0b";

              return (
                <button key={i} onClick={() => goToQuestion(i)} style={{
                  width: 32, height: 32, borderRadius: 6, border: `1.5px solid ${border}`,
                  background: bg, color: "#e0e7ff", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", position: "relative",
                }}>
                  {i + 1}
                  {isFlagged && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 8 }}>🚩</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#64748b" }}>
            <span>🟢 Answered</span>
            <span>🟣 Current</span>
            <span>🚩 Flagged</span>
            <span>⬛ Unanswered</span>
          </div>
        </div>
      )}

      {/* Question Body */}
      <div style={{ padding: 24 }}>
        {/* Flag + Question */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)", borderRadius: 14, padding: 20, marginBottom: 20,
          border: "1px solid rgba(99, 102, 241, 0.12)", position: "relative",
        }}>
          <button onClick={toggleFlag} style={{
            position: "absolute", top: 12, right: 12,
            background: flagged.has(idx) ? "rgba(245, 158, 11, 0.2)" : "rgba(99, 102, 241, 0.1)",
            border: `1px solid ${flagged.has(idx) ? "rgba(245, 158, 11, 0.4)" : "rgba(99, 102, 241, 0.2)"}`,
            borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12,
            color: flagged.has(idx) ? "#fbbf24" : "#a5b4fc",
          }}>{flagged.has(idx) ? "🚩" : "🏳️"}</button>

          <div style={{ fontSize: 16, lineHeight: 1.7, color: "#f1f5f9", paddingRight: 44 }}>
            {current?.q}
          </div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {current?.options?.map((opt, i) => {
            const isSelected = answers[idx] === i;
            return (
              <button key={i} onClick={() => selectAnswer(i)} style={{
                padding: "14px 18px", borderRadius: 12, textAlign: "left",
                background: isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(30, 41, 59, 0.6)",
                border: `2px solid ${isSelected ? "rgba(99, 102, 241, 0.5)" : "rgba(99, 102, 241, 0.12)"}`,
                color: "#f1f5f9", fontSize: 14, cursor: "pointer", transition: "all 0.2s",
                transform: isSelected ? "scale(1.01)" : "scale(1)",
                boxShadow: isSelected ? "0 4px 12px rgba(99, 102, 241, 0.2)" : "none",
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 8, marginRight: 12,
                  background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99, 102, 241, 0.15)",
                  fontSize: 12, fontWeight: 700, color: isSelected ? "#fff" : "#a5b4fc",
                }}>{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div style={{
        padding: "14px 24px", borderTop: "1px solid rgba(99, 102, 241, 0.12)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button
          onClick={() => { recordTimeForCurrentQ(); setIdx(Math.max(0, idx - 1)); }}
          disabled={idx === 0}
          style={{
            padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(99, 102, 241, 0.3)",
            background: "transparent", color: idx === 0 ? "#334155" : "#a5b4fc",
            fontSize: 13, fontWeight: 600, cursor: idx === 0 ? "not-allowed" : "pointer",
          }}
        >← Prev</button>

        {/* Submit or Next */}
        {idx === questions.length - 1 ? (
          <button onClick={handleConfirmSubmit} style={{
            padding: "12px 24px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 15px rgba(34, 197, 94, 0.4)",
          }}>
            {confirmSubmit ? `Submit (${answers.filter(a => a === null).length} unanswered)?` : "Submit Exam ✓"}
          </button>
        ) : (
          <button
            onClick={() => { recordTimeForCurrentQ(); setIdx(Math.min(questions.length - 1, idx + 1)); }}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >Next →</button>
        )}
      </div>

      {/* Confirm submit overlay */}
      {confirmSubmit && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={() => setConfirmSubmit(false)}>
          <div style={{
            background: "rgba(15, 23, 42, 0.98)", borderRadius: 16, padding: 24,
            maxWidth: 360, textAlign: "center", border: "1px solid rgba(99, 102, 241, 0.2)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: "#e0e7ff", margin: "0 0 8px" }}>Submit Exam?</h3>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
              You have <strong style={{ color: "#f59e0b" }}>{answers.filter(a => a === null).length}</strong> unanswered question{answers.filter(a => a === null).length > 1 ? "s" : ""}. 
              {flagged.size > 0 && <><br/><strong style={{ color: "#f59e0b" }}>{flagged.size}</strong> flagged for review.</>}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmSubmit(false)} style={{
                padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(99, 102, 241, 0.3)",
                background: "transparent", color: "#a5b4fc", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Go Back</button>
              <button onClick={handleSubmit} style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Submit Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
