// Recall step at the end of every lesson — MCQ cards when the model produced
// options (tap → instant green/red + explanation, auto-graded), plain
// show-answer cards otherwise. Answers feed FSRS via "Make flashcards".
import { useState } from "react";
import { GRADES } from "./lessonUtils.js";

const LETTERS = "ABCDEF";

export function McqCard({ T, r, picked, onPick }) {
  const answered = picked !== undefined;
  const correct = answered && picked === r.correct_index;
  return (
    <div style={{
      border: `1px solid ${answered ? (correct ? "rgba(61,214,140,0.45)" : "rgba(248,113,113,0.45)") : T.border}`,
      borderRadius: 10, padding: "10px 12px", background: T.inputBg,
      transition: "border-color .2s ease",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>{r.question}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>
        {r.options.map((opt, oi) => {
          const isPick = picked === oi;
          const isRight = oi === r.correct_index;
          return (
            <button
              key={oi}
              onClick={() => !answered && onPick(oi)}
              disabled={answered}
              style={{
                display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                padding: "8px 10px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5,
                cursor: answered ? "default" : "pointer",
                border: `1px solid ${
                  answered && isRight ? "rgba(61,214,140,0.6)"
                  : answered && isPick && !isRight ? "rgba(248,113,113,0.6)"
                  : T.border}`,
                background:
                  answered && isRight ? "rgba(61,214,140,0.12)"
                  : answered && isPick && !isRight ? "rgba(248,113,113,0.12)"
                  : "transparent",
                color: answered && (isRight || isPick) ? T.text : T.muted,
                transition: "all .15s ease",
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10.5, fontWeight: 800,
                background: answered && isRight ? "#3DD68C" : answered && isPick ? "#f87171" : T.chipBg,
                color: answered && (isRight || isPick) ? "#0b0f16" : T.muted,
              }}>
                {answered && isRight ? "✓" : answered && isPick ? "✕" : LETTERS[oi] || oi + 1}
              </span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div style={{ fontSize: 12, color: T.muted, marginTop: 8, lineHeight: 1.5, borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
          {correct ? "Correct — " : "Not quite — "}{r.answer}
        </div>
      )}
    </div>
  );
}

export default function RecallStep({ T, recall, onGraded }) {
  const [revealed, setRevealed] = useState({}); // idx -> bool (open Q&A)
  const [graded, setGraded] = useState({});     // idx -> gradeId (open Q&A)
  const [picked, setPicked] = useState({});     // idx -> option index (MCQ)
  if (!recall?.length) return null;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, marginBottom: 8 }}>
        Check yourself
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recall.map((r, i) => {
          const isMcq = Array.isArray(r.options) && r.options.length >= 2 && r.correct_index >= 0;
          if (isMcq) {
            return (
              <McqCard
                key={i} T={T} r={r} picked={picked[i]}
                onPick={(oi) => {
                  setPicked((m) => ({ ...m, [i]: oi }));
                  onGraded?.();
                }}
              />
            );
          }
          return (
            <div key={i} style={{
              border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", background: T.inputBg,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>{r.question}</div>
              {revealed[i] ? (
                <>
                  <div style={{ fontSize: 12.5, color: T.text, marginTop: 8, lineHeight: 1.5, borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
                    {r.answer}
                  </div>
                  {!graded[i] && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {GRADES.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => { setGraded((m) => ({ ...m, [i]: g.id })); onGraded?.(); }}
                          style={{
                            flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${T.border}`,
                            background: "transparent", color: T.muted, fontSize: 11, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >{g.label}</button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setRevealed((m) => ({ ...m, [i]: true }))}
                  style={{
                    marginTop: 8, padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
                    background: "transparent", color: T.accent, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >Show answer</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
