import { useState } from "react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// picked / onPick use the ORIGINAL option index (pre-shuffle), so the answer
// stays correct even if the display order changes on remount.
export default function McqCard({ mcq, T, picked = null, onPick, qNum, stats, onNext, error = false, onRetry }) {
  const [displayOrder] = useState(() => {
    if (!mcq) return [];
    const idx = mcq.options.map((_, i) => i);
    // Deterministic shuffle seeded by the question text — stable across
    // remounts so option letters don't jump if the card re-renders.
    let seed = 7;
    for (const c of mcq.question) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  });

  const header = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.6,
      textTransform: "uppercase", marginBottom: 6,
    }}>
      <span>🧠 Quick check{qNum ? ` · Q${qNum}` : ""}</span>
      {stats && stats.answered > 0 && (
        <span style={{ color: stats.correct === stats.answered ? "#3DD68C" : T.muted }}>
          {stats.correct}/{stats.answered} correct
        </span>
      )}
    </div>
  );

  if (error) {
    return (
      <div style={{
        margin: "8px 0", padding: "12px 14px", borderRadius: 14,
        background: T.hover, border: `1px solid ${T.border}`,
      }}>
        {header}
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>
          That question didn't render properly.
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: "6px 14px", borderRadius: 999, border: `1px solid ${T.border}`,
              background: T.toolbar, color: T.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Ask again
          </button>
        )}
      </div>
    );
  }

  const answered = picked !== null;
  const correct = answered && picked === mcq.answer;
  const correctDisplay = displayOrder.indexOf(mcq.answer);

  return (
    <div style={{
      margin: "8px 0",
      padding: "12px 14px",
      borderRadius: 14,
      background: T.hover,
      border: `1px solid ${T.border}`,
    }}>
      {header}
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.45, marginBottom: 10 }}>
        {mcq.question}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {displayOrder.map((origIdx, i) => {
          const opt = mcq.options[origIdx];
          const isPicked = picked === origIdx;
          const isAnswer = origIdx === mcq.answer;
          let bg = "transparent";
          let border = `1px solid ${T.border}`;
          let color = T.text;
          if (answered) {
            if (isAnswer) {
              bg = "rgba(61,214,140,0.14)";
              border = "1px solid rgba(61,214,140,0.45)";
            } else if (isPicked) {
              bg = "rgba(239,68,68,0.12)";
              border = "1px solid rgba(239,68,68,0.45)";
            } else {
              color = T.muted;
            }
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => onPick?.(origIdx)}
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
            {correct ? "Correct!" : `Not quite — the answer is ${LETTERS[correctDisplay]}.`}
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
