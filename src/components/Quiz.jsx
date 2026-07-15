import { useMemo, useState } from "react";
import { shuffle } from "../utils";

export default function Quiz({ subject, onExit, onComplete }) {
  const questions = useMemo(
    () => shuffle(subject.questions).map((q, i) => ({ ...q, id: i })),
    [subject]
  );
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const current = questions[idx];

  function submit() {
    if (selected == null || showResult) return;
    const correct = selected === current.answer;
    if (correct) setScore((s) => s + 1);
    setShowResult(true);
  }

  function next() {
    if (idx === questions.length - 1) {
      onComplete({ score, total: questions.length });
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setShowResult(false);
  }

  return (
    <div className="card">
      <div className="row">
        <h2>
          {subject.icon} {subject.label}
        </h2>
        <button onClick={onExit}>Exit</button>
      </div>
      <p className="muted">
        Question {idx + 1}/{questions.length}
      </p>
      <p className="question">{current.q}</p>
      <div className="options">
        {current.options.map((opt, i) => {
          const isCorrect = showResult && i === current.answer;
          const isWrong = showResult && i === selected && i !== current.answer;
          const isSelected = selected === i;
          return (
            <button
              key={opt}
              className={`option ${isCorrect ? "ok" : ""} ${isWrong ? "bad" : ""} ${isSelected ? "selected" : ""}`}
              onClick={() => setSelected(i)}
              disabled={showResult}
            >
              {String.fromCharCode(65 + i)}. {opt}
              {isSelected && <span style={{ marginLeft: 8, fontWeight: 700, color: isCorrect ? "#065f46" : isWrong ? "#991b1b" : "#FFD700" }}>✓</span>}
            </button>
          );
        })}
      </div>
      {showResult && <p className="muted">{current.explanation}</p>}
      <div className="row">
        {!showResult ? (
          <button onClick={submit} disabled={selected == null}>
            Submit
          </button>
        ) : (
          <button onClick={next}>{idx === questions.length - 1 ? "Finish" : "Next"}</button>
        )}
      </div>
    </div>
  );
}
