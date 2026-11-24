// Chapter review — interleaved quiz sampling recall questions across ALL
// explained pages of the document (not just the open one). Retrieval practice
// + spacing: the strongest retention technique we can ship for free — the
// items already exist in the shared lesson cache.
import { useEffect, useMemo, useState } from "react";
import { McqCard } from "./RecallStep.jsx";
import { logEvent } from "./pageTutorApi.js";
import { questEvent } from "../../streak-survival/survivalStore.js";

const SAMPLE = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChapterReview({ T, items, onJumpPage }) {
  // Sample once per mount — mix across pages, MCQs already sorted first.
  const quiz = useMemo(() => shuffle(items).slice(0, SAMPLE), [items]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // idx -> true(correct) | false(wrong) | "skip"
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (quiz[0]?.lessonId) logEvent(quiz[0].lessonId, "review_start");
  }, [quiz]);

  if (!quiz.length) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center", color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
        No questions yet — explain a couple of pages first and your recall questions become a mixed review.
      </div>
    );
  }

  const item = quiz[idx];
  const total = quiz.length;
  const answered = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((v) => v === true).length;
  const missedPages = [...new Set(quiz.filter((_, i) => answers[i] === false || answers[i] === "skip").map((q) => q.page))];

  const mark = (ok) => {
    setAnswers((m) => ({ ...m, [idx]: ok }));
    questEvent("answered", 1);
    if (ok) questEvent("correct", 1);
    if (item.lessonId) logEvent(item.lessonId, "review_answer");
    setTimeout(() => {
      if (idx + 1 < total) setIdx(idx + 1);
      else {
        setDone(true);
        if (item.lessonId) logEvent(item.lessonId, "review_finish");
      }
    }, ok ? 700 : 1100);
  };

  if (done) {
    const pct = Math.round((correctCount / total) * 100);
    return (
      <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
          <div style={{ fontSize: 34 }}>{pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "📖"}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 6 }}>{correctCount}/{total} correct</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
            {pct >= 80 ? "Solid — this material is sticking." : pct >= 50 ? "Getting there — review the misses." : "Time to re-read the flagged pages."}
          </div>
        </div>
        {missedPages.length > 0 && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", background: T.inputBg }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, marginBottom: 8 }}>
              Review these pages
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {missedPages.map((p) => (
                <button
                  key={p}
                  onClick={() => onJumpPage?.(p)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: "#4F8EF7", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >Page {p} →</button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isMcq = Array.isArray(item.options) && item.options.length >= 2 && item.correct_index >= 0;

  return (
    <div style={{ padding: "14px 14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 4, background: `${T.border}55`, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(answered / total) * 100}%`, background: "#3DD68C", borderRadius: 3, transition: "width .3s ease" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>{answered}/{total}</span>
      </div>
      <div style={{ fontSize: 10.5, color: T.muted }}>
        From <b style={{ color: "#F5A623" }}>page {item.page}</b>
      </div>
      {isMcq ? (
        <McqCard
          T={T} r={item}
          picked={answers[idx] === undefined ? undefined : item.correct_index}
          onPick={(oi) => mark(oi === item.correct_index)}
        />
      ) : (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", background: T.inputBg }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>{item.question}</div>
          {answers[idx] !== undefined ? (
            <div style={{ fontSize: 12.5, color: T.text, marginTop: 8, lineHeight: 1.5, borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
              {item.answer}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
              <button
                onClick={() => mark("skip")}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >Skip</button>
              <button
                onClick={() => mark(true)}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >Reveal</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
