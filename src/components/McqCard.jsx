import { useState } from "react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function McqCard({ mcq, T, onNext }) {
  const [picked, setPicked] = useState(null);
  const answered = picked !== null;
  const correct = answered && picked === mcq.answer;

  return (
    <div style={{
      margin: "8px 0",
      padding: "12px 14px",
      borderRadius: 14,
      background: T.hover,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
        🧠 Quick check
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.45, marginBottom: 10 }}>
        {mcq.question}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mcq.options.map((opt, i) => {
          const isPicked = picked === i;
          const isAnswer = i === mcq.answer;
          let bg = "transparent";
          let border = `1px solid ${T.border}`;
          let color = T.text;
          if (answered) {
            if (isAnswer) {
              bg = "rgba(61,214,140,0.14)";
              border = "1px solid rgba(61,214,140,0.45)";
              color = T.text;
            } else if (isPicked) {
              bg = "rgba(239,68,68,0.12)";
              border = "1px solid rgba(239,68,68,0.45)";
              color = T.text;
            } else {
              color = T.muted;
            }
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setPicked(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                border,
                background: bg,
                color,
                fontSize: 13,
                fontWeight: 500,
                textAlign: "left",
                cursor: answered ? "default" : "pointer",
                opacity: answered && !isAnswer && !isPicked ? 0.55 : 1,
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10.5, fontWeight: 700,
                background: answered && isAnswer ? "#3DD68C" : answered && isPicked ? "#ef4444" : T.border,
                color: answered && (isAnswer || isPicked) ? "#fff" : T.muted,
              }}>
                {answered && isAnswer ? "✓" : answered && isPicked ? "✕" : LETTERS[i]}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {answered && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 700, marginBottom: mcq.explanation ? 4 : 0,
            color: correct ? "#3DD68C" : "#ef4444",
          }}>
            {correct ? "Correct!" : `Not quite — the answer is ${LETTERS[mcq.answer]}.`}
          </div>
          {mcq.explanation && (
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
              {mcq.explanation}
            </div>
          )}
          {onNext && (
            <button
              onClick={onNext}
              style={{
                marginTop: 8,
                padding: "6px 14px",
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: T.toolbar,
                color: T.text,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Next question →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
