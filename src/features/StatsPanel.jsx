import React, { useState } from "react";
import { callAI } from "../lib/aiClient";
import MarkdownText from "../components/MarkdownText.jsx";
import PeerComparison from "../components/analytics/PeerComparison.jsx";
import MasteryGrid from "../components/analytics/MasteryGrid.jsx";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:     "#0A0D13",
  card:   "#0d0f1f",
  line:   "#1e2140",
  accent: "#1a1a1a",
  border: "#B8860B",
  text:   "#e8eaf6",
  muted:  "#7b82b8",
  hint:   "#4a5080",
  faint:  "#12142a",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@400;500;600&display=swap');
  @keyframes sp-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sp-slide { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
  .sp-card { animation: sp-in 0.28s ease forwards; }
  .sp-modal-anim { animation: sp-in 0.22s ease forwards; }
`;

function percent(score, total) {
  if (!total) return 0;
  return Math.round((score / total) * 100);
}

// ─── Weekly activity bar chart ─────────────────────────────────────────────────
function WeeklyChart({ history }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toDateString();
  });
  const counts = days.map(day =>
    history.filter(h => h.ts && new Date(h.ts).toDateString() === day).length
  );
  const max = Math.max(...counts, 1);
  const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: D.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12, fontFamily: "Syne,sans-serif" }}>
        ACTIVITY — LAST 7 DAYS
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
        {days.map((day, i) => {
          const h = counts[i];
          const pct = (h / max) * 100;
          const isToday = day === new Date().toDateString();
          return (
            <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: h > 0 ? D.muted : D.hint }}>{h > 0 ? h : ""}</div>
              <div style={{
                width: "100%", height: `${Math.max(6, pct * 0.55)}px`,
                background: isToday ? `linear-gradient(180deg, #5c6bc0, #B8860B)` : h > 0 ? "#1a1a1a" : "#0d0f22",
                border: `0.5px solid ${isToday ? D.border : h > 0 ? "#2a2d5a" : D.line}`,
                borderRadius: 5, transition: "height 0.3s ease",
              }} title={`${h} session${h !== 1 ? "s" : ""}`} />
              <div style={{ fontSize: 9, color: isToday ? D.border : D.hint, fontWeight: isToday ? 700 : 400 }}>
                {labels[new Date(day).getDay()]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Exam Review Modal ─────────────────────────────────────────────────────────
function ExamReviewModal({ exam, onClose, aiConfig }) {
  const [explanations, setExplanations] = useState({});
  const [loadingIdx, setLoadingIdx]     = useState(null);

  const qs = exam.questions || [];
  const missed = qs.filter(q => !q.correct);

  async function explain(q, idx) {
    if (explanations[idx] || loadingIdx === idx) return;
    setLoadingIdx(idx);
    try {
      const prompt = `A student got this question wrong in an exam.
Question: ${q.question || q.text || "(no question text)"}
Their answer: ${q.userAnswer || "(no answer recorded)"}
Correct answer: ${q.correctAnswer || q.answer || "(see options)"}
Options: ${q.options ? q.options.join(" | ") : "N/A"}

Give a clear, concise explanation (3-5 sentences) of why the correct answer is right and what the student misunderstood. Use simple language.`;
      const raw = await callAI(prompt, aiConfig);
      setExplanations(e => ({ ...e, [idx]: raw || "No explanation available." }));
    } catch {
      setExplanations(e => ({ ...e, [idx]: "Couldn't load explanation — check your connection." }));
    } finally {
      setLoadingIdx(null);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 3000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: "0 0 0 0",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sp-modal-anim" style={{
        background: "#0a0c1e", border: `0.5px solid ${D.line}`,
        borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 680,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px 12px", borderBottom: `0.5px solid ${D.line}`,
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: D.text, fontFamily: "Syne,sans-serif" }}>
              📋 Exam Review — {exam.subjectLabel}
            </div>
            <div style={{ fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", marginTop: 2 }}>
              Score: {exam.score}/{exam.total} ({percent(exam.score, exam.total)}%) · {exam.ts ? new Date(exam.ts).toLocaleDateString() : ""}
              {qs.length > 0 && ` · ${missed.length} wrong`}
            </div>
          </div>
          {missed.length > 0 && (
            <span style={{ fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", fontWeight: 600, padding: "7px 14px" }}>
              {missed.length} missed
            </span>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: D.muted, cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "14px 18px 20px", scrollbarWidth: "none" }}>
          {qs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 13, color: D.muted, fontFamily: "Manrope,sans-serif", lineHeight: 1.7 }}>
                Score: <strong style={{ color: D.text }}>{percent(exam.score, exam.total)}%</strong><br />
                {exam.score}/{exam.total} correct<br />
                <span style={{ fontSize: 11, color: D.hint }}>Detailed question data not available for this session.</span>
              </div>
            </div>
          ) : (
            qs.map((q, idx) => {
              const isWrong = !q.correct;
              const qText   = q.question || q.text || `Question ${idx + 1}`;
              const correct = q.correctAnswer || q.answer || "";
              const userAns = q.userAnswer || "";
              return (
                <div key={idx} style={{
                  background: isWrong ? "#140808" : "#071410",
                  border: `0.5px solid ${isWrong ? "#4a1414" : "#0a3020"}`,
                  borderRadius: 14, padding: "12px 14px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{isWrong ? "✗" : "✓"}</span>
                    <div style={{ fontSize: 12, color: D.text, fontFamily: "Manrope,sans-serif", lineHeight: 1.6, flex: 1 }}>
                      <strong>Q{idx + 1}.</strong> {qText}
                    </div>
                  </div>

                  {/* Answer comparison */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginLeft: 22, marginBottom: isWrong ? 10 : 0 }}>
                    {userAns && (
                      <div style={{ fontSize: 11, color: isWrong ? "#ef9a9a" : "#81c784", fontFamily: "Manrope,sans-serif" }}>
                        <span style={{ fontWeight: 600 }}>Your answer: </span>{userAns}
                      </div>
                    )}
                    {isWrong && correct && (
                      <div style={{ fontSize: 11, color: "#81c784", fontFamily: "Manrope,sans-serif" }}>
                        <span style={{ fontWeight: 600 }}>Correct: </span>{correct}
                      </div>
                    )}
                  </div>

                  {/* AI explanation */}
                  {isWrong && (
                    <div style={{ marginLeft: 22 }}>
                      {!explanations[idx] && (
                        <button
                          onClick={() => explain(q, idx)}
                          disabled={loadingIdx === idx}
                          style={{
                            background: "#0a0c1e", border: `0.5px solid ${D.line}`,
                            borderRadius: 8, padding: "5px 11px", fontSize: 11,
                            color: D.border, cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600,
                          }}
                        >
                          {loadingIdx === idx ? "Loading…" : "🤖 AI Explain"}
                        </button>
                      )}
                      {explanations[idx] && (
                        <div style={{
                          background: "#080d2a", border: `0.5px solid #1e2a5a`,
                          borderRadius: 10, padding: "10px 13px", marginTop: 8,
                          fontSize: 11, color: "#b0b8e8", fontFamily: "Manrope,sans-serif", lineHeight: 1.7,
                        }}>
                          🤖 <MarkdownText>{explanations[idx]}</MarkdownText>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main StatsPanel ───────────────────────────────────────────────────────────
/**
 * @param {{ history: any[], stats: any, subjects: any[], aiConfig: any }} props
 */
export default function StatsPanel({ history, stats, subjects, aiConfig }) {
  const [reviewExam, setReviewExam] = useState(null);

  const exams    = [...history].filter(h => h.mode === "exam" || h.mode === "practice").reverse().slice(0, 20);
  const avgScore = history.length ? Math.round(history.reduce((a, h) => a + percent(h.score, h.total), 0) / history.length) : 0;

  const summaryCards = [
    { icon: "📊", label: "Avg Score",     value: `${avgScore}%`,           color: avgScore >= 70 ? "#81c784" : avgScore >= 50 ? "#ffd54f" : "#ef9a9a" },
    { icon: "📚", label: "Sessions",      value: stats?.sessions ?? 0,     color: "#DAA520" },
    { icon: "🔥", label: "Streak",        value: `${stats?.streak ?? 0}d`, color: "#ff7043" },
    { icon: "🎯", label: "Weekly Goal",   value: `${Math.min(stats?.sessions ?? 0, stats?.weeklyGoal ?? 5)}/${stats?.weeklyGoal ?? 5}`, color: "#80cbc4" },
  ];

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Summary row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 18 }}>
        {summaryCards.map(sc => (
          <div key={sc.label} className="sp-card" style={{
            background: D.faint, border: `0.5px solid ${D.line}`,
            borderRadius: 14, padding: "12px 12px 10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{sc.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: sc.color, lineHeight: 1, fontFamily: "Syne,sans-serif" }}>{sc.value}</div>
            <div style={{ fontSize: 9, color: D.hint, marginTop: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{sc.label}</div>
          </div>
        ))}
      </div>

      {/* ── Weekly activity ── */}
      <div style={{ background: D.faint, border: `0.5px solid ${D.line}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
        <WeeklyChart history={history} />
      </div>

      {/* ── Exam history ── */}
      <div style={{ background: D.faint, border: `0.5px solid ${D.line}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: D.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12, fontFamily: "Syne,sans-serif" }}>
          EXAM HISTORY
        </div>
        {exams.length === 0 ? (
          <p style={{ fontSize: 12, color: D.hint, fontFamily: "Manrope,sans-serif" }}>No exams yet — start practising to see your results here.</p>
        ) : (
          exams.map((h, i) => {
            const p    = percent(h.score, h.total);
            const pass = p >= 50;
            const col  = p >= 75 ? "#81c784" : p >= 50 ? "#ffd54f" : "#ef9a9a";
            return (
              <div key={`${h.ts}-${i}`} className="sp-card" style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 12, marginBottom: 8,
                background: pass ? "#071410" : "#140808",
                border: `0.5px solid ${pass ? "#0a3020" : "#4a1414"}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: D.text, fontFamily: "Manrope,sans-serif", marginBottom: 2 }}>
                    {h.subjectLabel || "Session"}
                  </div>
                  <div style={{ fontSize: 10, color: D.muted, fontFamily: "Manrope,sans-serif" }}>
                    {h.ts ? new Date(h.ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : ""} · {h.mode}
                    {h.total > 0 && ` · ${h.score}/${h.total} correct`}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: col, fontFamily: "Syne,sans-serif" }}>{p}%</div>
                  <div style={{ fontSize: 9, color: pass ? "#81c784" : "#ef9a9a", fontWeight: 600, letterSpacing: "0.04em" }}>{pass ? "PASS" : "FAIL"}</div>
                </div>
                <button
                  onClick={() => setReviewExam(h)}
                  style={{
                    background: "#0a0c1e", border: `0.5px solid ${D.line}`,
                    borderRadius: 9, padding: "5px 10px", fontSize: 10,
                    color: D.muted, cursor: "pointer", fontFamily: "Manrope,sans-serif",
                    fontWeight: 600, flexShrink: 0,
                  }}
                >Review ↗</button>
              </div>
            );
          })
        )}
      </div>

      {/* Exam Review Modal */}
      {reviewExam && (
        <ExamReviewModal
          exam={reviewExam}
          aiConfig={aiConfig}
          onClose={() => setReviewExam(null)}
        />
      )}
    </div>
  );
}
