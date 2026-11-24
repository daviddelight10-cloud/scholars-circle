// Recall step at the end of every lesson — short Q&A with self-grade.
// Answers feed FSRS via the "Make flashcards" save on the panel.
import { useState } from "react";
import { GRADES } from "./lessonUtils.js";

export default function RecallStep({ T, recall, onGraded }) {
  const [revealed, setRevealed] = useState({}); // idx -> bool
  const [graded, setGraded] = useState({});     // idx -> gradeId
  if (!recall?.length) return null;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, marginBottom: 8 }}>
        Check yourself
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recall.map((r, i) => (
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
        ))}
      </div>
    </div>
  );
}
