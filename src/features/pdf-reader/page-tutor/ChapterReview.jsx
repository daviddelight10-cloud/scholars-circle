// Chapter review — interleaved quiz sampling recall questions across ALL
// explained pages of the document (not just the open one). Retrieval practice
// + spacing: the strongest retention technique we can ship for free — the
// items already exist in the shared lesson cache.
import { useEffect, useMemo, useState } from "react";
import { McqCard } from "./RecallStep.jsx";
import { logEvent } from "./pageTutorApi.js";
import { questEvent } from "../../streak-survival/survivalStore.js";
import { rateQuestion } from "../../streak-survival/fsrsBridge.js";

const SAMPLE = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChapterReview({ T, items, resourceId, onJumpPage, onRankCheck }) {
  // Sample once per mount — mix across pages, MCQs already sorted first.
  const quiz = useMemo(() => shuffle(items).slice(0, SAMPLE), [items]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // idx -> { ok: true|false|"skip", picked?: number }
  const [revealed, setRevealed] = useState({}); // idx -> answer shown, awaiting self-grade
  const [xpEarned, setXpEarned] = useState(0);
  const [xpFlash, setXpFlash] = useState(0);   // bumps to re-trigger the "+5" chip
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
  const correctCount = Object.values(answers).filter((v) => v.ok === true).length;
  const missedPages = [...new Set(quiz.filter((_, i) => answers[i]?.ok === false || answers[i]?.ok === "skip").map((q) => q.page))];

  const mark = (ok, picked) => {
    const already = answers[idx] !== undefined; // re-answering after Back never re-awards
    setAnswers((m) => ({ ...m, [idx]: { ok, picked } }));
    if (!already) {
      questEvent("answered", 1);
      if (ok === true) {
        questEvent("correct", 1);
        // Real server XP via rateQuestion — moves the actual leaderboard.
        if (resourceId) {
          rateQuestion({
            resourceId, pageIndex: item.page - 1, grade: 3,
            itemType: "page_tutor_review", topic: "chapter review", subject: "chapter review",
          }).then((data) => {
            if (data?.xpAwarded > 0) {
              questEvent("xpToday", data.xpAwarded);
              window.dispatchEvent(new CustomEvent("sc-xp-gained", { detail: { xp: data.xpAwarded } }));
              setXpEarned((x) => x + data.xpAwarded);
              setXpFlash((x) => x + 1);
            }
          }).catch(() => {});
        }
      }
      if (item.lessonId) logEvent(item.lessonId, "review_answer");
    }
    setTimeout(() => {
      if (idx + 1 < total) setIdx(idx + 1);
      else {
        setDone(true);
        if (item.lessonId) logEvent(item.lessonId, "review_finish");
        onRankCheck?.();
      }
    }, ok === true ? 700 : 1100);
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
          {xpEarned > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
              padding: "7px 14px", borderRadius: 999,
              background: "linear-gradient(135deg, rgba(245,166,35,0.16), rgba(245,166,35,0.06))",
              border: "1px solid rgba(245,166,35,0.35)",
              fontSize: 13, fontWeight: 800, color: "#F5A623",
              animation: "sc-fade-in-up .4s ease both",
            }}>
              ⚡ +{xpEarned} XP earned
            </div>
          )}
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
  const cur = answers[idx]; // answered state for this card (Back → read-only)

  return (
    <div style={{ padding: "14px 14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        <button
          onClick={() => idx > 0 && setIdx(idx - 1)}
          disabled={idx === 0}
          style={{
            background: "none", border: `1px solid ${T.border}`, borderRadius: 8,
            color: idx === 0 ? T.muted : T.text, fontSize: 13, fontWeight: 700,
            cursor: idx === 0 ? "default" : "pointer", padding: "4px 10px",
            opacity: idx === 0 ? 0.4 : 1, fontFamily: "inherit",
          }}
          title="Previous question"
        >‹</button>
        <div style={{ flex: 1, height: 4, background: `${T.border}55`, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(answered / total) * 100}%`, background: "#3DD68C", borderRadius: 3, transition: "width .3s ease" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>{answered}/{total}</span>
        {xpEarned > 0 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: "#F5A623" }}>⚡{xpEarned}</span>
        )}
        {xpFlash > 0 && (
          <span
            key={xpFlash}
            style={{
              position: "absolute", right: 0, top: -18,
              fontSize: 12, fontWeight: 800, color: "#F5A623",
              animation: "sc-fade-in-up .5s ease both", pointerEvents: "none",
            }}
          >+XP</span>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: T.muted }}>
        Question {idx + 1} of {total} · From <b style={{ color: "#F5A623" }}>page {item.page}</b>
      </div>
      {isMcq ? (
        cur ? (
          // Back onto an answered MCQ → show the recorded result, no re-pick.
          <McqCard T={T} r={item} picked={cur.picked} onPick={() => {}} />
        ) : (
          <McqCard T={T} r={item} picked={undefined} onPick={(oi) => mark(oi === item.correct_index, oi)} />
        )
      ) : (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", background: T.inputBg }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>{item.question}</div>
          {cur || revealed[idx] ? (
            <>
              <div style={{ fontSize: 12.5, color: T.text, marginTop: 8, lineHeight: 1.5, borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
                {item.answer}
              </div>
              {!cur && (
                <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                  <button
                    onClick={() => mark(false)}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid rgba(255,80,80,0.35)`, background: "rgba(255,80,80,0.08)", color: "#FF8080", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >Missed it</button>
                  <button
                    onClick={() => mark(true)}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "#3DD68C", color: "#0c2318", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >Knew it ✓</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
              <button
                onClick={() => mark("skip")}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >Skip</button>
              <button
                onClick={() => setRevealed((r) => ({ ...r, [idx]: true }))}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >Reveal</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
