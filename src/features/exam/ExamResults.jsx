import { useState } from "react";
import { gradeObjectiveAnswer, isWrittenType, countByType, totalMarks, QUESTION_TYPES } from "./examSchema";

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function ExamResults({ result, exam, sourceTitle, onBack, onRetake }) {
  const [filter, setFilter] = useState("all"); // all | wrong | written
  const { items, answers, objective, aiGrading, gradingFailed, score, total, timeMs } = result;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passMark = exam?.config?.passMarkPct ?? 50;
  const passed = pct >= passMark;
  const byType = countByType(items);
  const writtenCount = (byType.shortanswer || 0) + (byType.essay || 0);

  const rows = items.map((q, i) => {
    const obj = objective[i] || gradeObjectiveAnswer(q, answers[i]);
    const ai = aiGrading?.[i];
    return { q, i, obj, ai, answer: answers[i] };
  });

  const wrongCount = rows.filter((r) => r.obj && !r.obj.correct).length
    + rows.filter((r) => r.ai && r.ai.marksAwarded < r.ai.maxMarks * 0.5).length;

  const visible = rows.filter((r) => {
    if (filter === "wrong") {
      if (r.obj) return !r.obj.correct;
      if (r.ai) return r.ai.marksAwarded < r.ai.maxMarks * 0.5;
      return true; // ungraded written — show
    }
    if (filter === "written") return isWrittenType(r.q.type);
    return true;
  });

  return (
    <div className="exr-root exr-scroll">
      <div className="exr-results">
        {/* Score card */}
        <div className="exr-score-card">
          <div className="exr-score-emoji">{passed ? "🏆" : pct >= 40 ? "📊" : "📚"}</div>
          <div className="exr-score-title">
            {result.autoSubmitted ? "Time's up — exam submitted" : "Exam complete"}
          </div>
          <div className="exr-score-big" style={{ color: passed ? "#66bb6a" : "#ffb74d" }}>
            {Number.isInteger(score) ? score : score.toFixed(1)} / {total} marks
          </div>
          <div className="exr-score-pct">{pct}% · pass mark {passMark}% · {passed ? "PASSED" : "Below pass mark"}</div>

          <div className="exr-score-grid">
            <div className="exr-score-cell"><b>{items.length}</b><span>questions</span></div>
            <div className="exr-score-cell"><b>{fmtTime(timeMs)}</b><span>time</span></div>
            {result.xpAwarded != null && <div className="exr-score-cell gold"><b>+{result.xpAwarded}</b><span>XP</span></div>}
            {result.streak > 0 && <div className="exr-score-cell"><b>🔥 {result.streak}</b><span>streak</span></div>}
          </div>

          {/* Per-type breakdown */}
          <div className="exr-type-chips">
            {Object.entries(byType).map(([t, n]) => (
              <span key={t} className={`exr-chip t-${t}`}>{QUESTION_TYPES[t]?.icon} {n} {QUESTION_TYPES[t]?.label || t}</span>
            ))}
          </div>
          {gradingFailed && (
            <div className="exr-warn">
              ⚠️ Some written answers couldn't be AI-marked — compare them to the model answers below and grade yourself.
            </div>
          )}

          <div className="exr-modal-row" style={{ marginTop: 14 }}>
            <button className="exr-btn ghost" onClick={onBack}>← Back</button>
            <button className="exr-btn primary" onClick={onRetake}>↻ Retake</button>
          </div>
        </div>

        {/* Filter row */}
        <div className="exr-filter">
          {[["all", `All (${rows.length})`], ["wrong", `Needs work (${wrongCount})`], ...(writtenCount ? [["written", `Written (${writtenCount})`]] : [])].map(([k, l]) => (
            <button key={k} className={`exr-fchip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>

        {/* Review list */}
        {visible.map(({ q, i, obj, ai, answer }) => (
          <ReviewRow key={q.id || i} q={q} n={i + 1} obj={obj} ai={ai} answer={answer} />
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ q, n, obj, ai, answer }) {
  const status = obj ? (obj.correct ? "ok" : "bad") : ai ? (ai.marksAwarded >= ai.maxMarks * 0.5 ? "ok" : "bad") : "na";
  const marksText = obj
    ? `${obj.marksAwarded}/${obj.maxMarks}`
    : ai
      ? `${ai.marksAwarded}/${ai.maxMarks}`
      : `–/${q.marks}`;

  return (
    <div className={`exr-review ${status}`}>
      <div className="exr-review-head">
        <span className={`exr-qtype t-${q.type}`}>{QUESTION_TYPES[q.type]?.icon} {QUESTION_TYPES[q.type]?.label || q.type}</span>
        <span className="exr-qmarks">{marksText} marks</span>
      </div>
      <div className="exr-review-q">Q{n}. {q.question}</div>

      {/* Objective answers */}
      {q.type === "mcq" && (
        <div className="exr-opts review">
          {Object.entries(q.options).map(([k, v]) => (
            <div
              key={k}
              className={`exr-opt ro${k === q.correct ? " ok" : ""}${answer === k && k !== q.correct ? " bad" : ""}`}
            >
              <span className="exr-opt-key">{k}</span>
              <span className="exr-opt-val">{v}</span>
            </div>
          ))}
        </div>
      )}
      {q.type === "truefalse" && (
        <div className="exr-answers-line">
          You answered <b className={obj?.correct ? "ok" : "bad"}>{answer == null ? "—" : answer === true || answer === "true" ? "True" : "False"}</b>
          {" · "}Correct: <b className="ok">{q.correct ? "True" : "False"}</b>
        </div>
      )}
      {q.type === "fillblank" && (
        <div className="exr-answers-line">
          You answered <b className={obj?.correct ? "ok" : "bad"}>{answer || "—"}</b>
          {" · "}Accepted: <b className="ok">{(q.acceptableAnswers || []).join(", ")}</b>
        </div>
      )}

      {/* Written answers */}
      {isWrittenType(q.type) && (
        <>
          <div className="exr-your-answer">
            <div className="exr-ans-label">Your answer</div>
            <p>{answer?.trim() ? answer : <i>No answer given.</i>}</p>
          </div>
          {ai ? (
            <div className="exr-ai-grade">
              <div className="exr-ans-label ai">🤖 AI marking — {ai.marksAwarded}/{ai.maxMarks}</div>
              {ai.feedback && <p>{ai.feedback}</p>}
              {ai.coveredPoints?.length > 0 && (
                <div className="exr-scheme ok">✓ {ai.coveredPoints.join(" · ")}</div>
              )}
              {ai.missedPoints?.length > 0 && (
                <div className="exr-scheme bad">✗ missed: {ai.missedPoints.join(" · ")}</div>
              )}
            </div>
          ) : (
            <div className="exr-ai-grade">
              <div className="exr-ans-label">Model answer — grade yourself</div>
              <p>{q.modelAnswer}</p>
              {Array.isArray(q.markingScheme) && q.markingScheme.length > 0 && (
                <ul className="exr-scheme-list">
                  {q.markingScheme.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {q.explanation && !isWrittenType(q.type) && (
        <div className="exr-review-exp"><b>Explanation:</b> {q.explanation}</div>
      )}
    </div>
  );
}
