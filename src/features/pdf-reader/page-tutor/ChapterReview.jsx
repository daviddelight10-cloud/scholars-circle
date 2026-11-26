// Chapter review — interleaved quiz sampling recall questions across ALL
// explained pages of the document (not just the open one). Retrieval practice
// + spacing: the strongest retention technique we can ship for free — the
// items already exist in the shared lesson cache.
//
// Sessions feed the real FSRS schedule: every answer POSTs a grade
// (correct → Good, miss/skip → Again), due-page items lead the queue, and a
// couple of saved deck questions interleave for variety.
import { useEffect, useMemo, useState } from "react";
import { McqCard } from "./RecallStep.jsx";
import { logEvent } from "./pageTutorApi.js";
import { questEvent } from "../../streak-survival/survivalStore.js";
import { rateQuestion, normalizeQuestion } from "../../streak-survival/fsrsBridge.js";
import { ConfettiBurst } from "./Celebration.jsx";

const SAMPLE = 10;
const RING_C = 2 * Math.PI * 30; // done-screen score ring radius

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChapterReview({ T, items, resourceId, onJumpPage, onRankCheck, duePages, deckItems, onFinish }) {
  // Sample once per mount — due-page questions lead the queue, the rest
  // shuffle in behind; up to 2 saved deck questions splice in mid-run.
  const baseQuiz = useMemo(() => {
    const due = duePages instanceof Set ? duePages : new Set();
    const dueFirst = shuffle(items.filter((i) => due.has(i.page)));
    const rest = shuffle(items.filter((i) => !due.has(i.page)));
    const out = [...dueFirst, ...rest].slice(0, SAMPLE);
    shuffle(deckItems || []).slice(0, 2).forEach((d, k) => {
      const nq = normalizeQuestion(d.q, k);
      if (!nq.q || nq.opts.filter((o) => String(o).trim()).length < 2) return;
      out.splice(Math.min(out.length, 3 + k * 4), 0, {
        question: nq.q,
        options: nq.opts,
        correct_index: nq.a,
        page: d.q?._srcPage != null ? d.q._srcPage + 1 : null,
        lessonId: null,
        deck: true,
      });
    });
    return out;
  }, [items, deckItems, duePages]);

  const [roundItems, setRoundItems] = useState(null); // retest-missed round
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // idx -> { ok: true|false|"skip", picked?: number }
  const [revealed, setRevealed] = useState({}); // idx -> answer shown, awaiting self-grade
  const [xpEarned, setXpEarned] = useState(0);
  const [xpFlash, setXpFlash] = useState(0);   // bumps to re-trigger the "+XP" chip
  const [done, setDone] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [ringPct, setRingPct] = useState(0);

  const quiz = roundItems || baseQuiz;
  const total = quiz.length;
  const answered = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((v) => v.ok === true).length;
  const item = quiz[idx];

  useEffect(() => {
    if (baseQuiz[0]?.lessonId) logEvent(baseQuiz[0].lessonId, "review_start");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Done → persist score + ring animation + confetti on a strong finish.
  useEffect(() => {
    if (!done || !total) return;
    onFinish?.(correctCount, total);
    const pct = (correctCount / total) * 100;
    if (pct >= 80) setConfetti(true);
    const t = requestAnimationFrame(() => setRingPct(pct));
    return () => cancelAnimationFrame(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quiz.length) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center", color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
        No questions yet — explain a couple of pages first and your recall questions become a mixed review.
      </div>
    );
  }

  const mark = (ok, picked) => {
    const already = answers[idx] !== undefined; // re-answering after Back never re-awards
    setAnswers((m) => ({ ...m, [idx]: { ok, picked } }));
    if (!already) {
      questEvent("answered", 1);
      if (ok === true) questEvent("correct", 1);
      // Every answer feeds FSRS — misses reschedule sooner, not just vanish.
      // (Deck items without a page link no-op inside rateQuestion.)
      if (resourceId && item.page != null) {
        rateQuestion({
          resourceId, pageIndex: item.page - 1, grade: ok === true ? 3 : 1,
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

  const retestMissed = () => {
    const missed = shuffle(quiz.filter((_, i) => answers[i]?.ok !== true));
    if (!missed.length) return;
    setRoundItems(missed);
    setAnswers({});
    setRevealed({});
    setIdx(0);
    setDone(false);
    setRingPct(0);
    setRound((r) => r + 1);
  };

  if (done) {
    const pct = Math.round((correctCount / total) * 100);
    // Per-page accuracy — one bar row per source page in this session.
    const byPage = new Map();
    quiz.forEach((q, i) => {
      const key = q.deck ? "deck" : q.page;
      const g = byPage.get(key) || { n: 0, c: 0 };
      g.n += 1;
      if (answers[i]?.ok === true) g.c += 1;
      byPage.set(key, g);
    });
    const pageRows = [...byPage.entries()].sort((a, b) =>
      (a[0] === "deck") - (b[0] === "deck") || String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
    const missedPages = [...new Set(quiz.filter((_, i) => answers[i]?.ok === false || answers[i]?.ok === "skip").map((q) => q.page).filter((p) => p != null))];
    const missedCount = quiz.filter((_, i) => answers[i]?.ok !== true).length;
    const verdict = pct >= 80 ? "Solid — this material is sticking." : pct >= 50 ? "Getting there — review the misses." : "Time to re-read the flagged pages.";

    return (
      <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {confetti && <ConfettiBurst onDone={() => setConfetti(false)} />}
        <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
          <svg width="84" height="84" viewBox="0 0 72 72" role="img" aria-label={`${pct}% correct`}>
            <defs>
              <linearGradient id="cr-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFD166" /><stop offset="100%" stopColor="#F5A623" />
              </linearGradient>
            </defs>
            <circle cx="36" cy="36" r="30" fill="none" stroke={`${T.border}88`} strokeWidth="5" />
            <circle cx="36" cy="36" r="30" fill="none" stroke="url(#cr-ring-grad)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - ringPct / 100)} transform="rotate(-90 36 36)"
              style={{ transition: "stroke-dashoffset .9s cubic-bezier(.33,1,.68,1)" }} />
            <text x="36" y="34" textAnchor="middle" fontSize="17" fontWeight="800" fill={T.text} fontFamily="Manrope,sans-serif">{Math.round(ringPct)}%</text>
            <text x="36" y="48" textAnchor="middle" fontSize="9.5" fill={T.muted} fontFamily="Manrope,sans-serif">{correctCount}/{total}</text>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginTop: 8 }}>
            {pct >= 80 ? "🏆 " : pct >= 50 ? "💪 " : "📖 "}{round > 0 ? `Retest · ${correctCount}/${total}` : verdict}
          </div>
          {xpEarned > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
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

        {/* Per-page accuracy */}
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", background: T.inputBg }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, marginBottom: 8 }}>
            By page
          </div>
          {pageRows.map(([p, g]) => {
            const pPct = Math.round((g.c / g.n) * 100);
            return (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, width: 44, flexShrink: 0 }}>
                  {p === "deck" ? "🃏 Deck" : `p.${p}`}
                </span>
                <div style={{ flex: 1, height: 6, background: `${T.border}66`, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pPct}%`, borderRadius: 3,
                    background: pPct >= 80 ? "#3DD68C" : pPct >= 50 ? "#F5A623" : "#FF5470",
                    transition: "width .6s ease",
                  }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, width: 30, textAlign: "right" }}>{g.c}/{g.n}</span>
              </div>
            );
          })}
        </div>

        {missedCount > 0 && (
          <button
            onClick={retestMissed}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #FFC24B 0%, #F5A623 55%, #E8940C 100%)",
              boxShadow: "0 4px 14px rgba(245,166,35,0.3)",
              color: "#1B212D", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}
          >↻ Retest the {missedCount} missed</button>
        )}

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
        {round > 0 ? "Retest · " : ""}Question {idx + 1} of {total} · {item.deck
          ? <span>From <b style={{ color: "#F5A623" }}>your deck</b></span>
          : <>From <b style={{ color: "#F5A623" }}>page {item.page}</b></>}
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
