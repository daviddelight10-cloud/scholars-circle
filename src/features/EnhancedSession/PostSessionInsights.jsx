import { useState, useEffect } from "react";
import { callAI } from "../../lib/aiClient";
import { generateTipsPrompt } from "./SmartEngine";

/**
 * Beautiful post-session insights with:
 * - Visual score breakdown by topic
 * - Performance graph (bar chart)
 * - AI-generated study tips
 * - Shareable result card
 * - Improvement tracking
 */
export default function PostSessionInsights({ analytics, session, results, questions, history = [], aiConfig, onExit, onSave }) {
  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // overview | topics | review | tips

  // Fetch AI tips on mount
  useEffect(() => {
    if (aiConfig && analytics) {
      setTipsLoading(true);
      const prompt = generateTipsPrompt(analytics, session.source?.label || "Practice");
      callAI(prompt, aiConfig)
        .then(raw => {
          try {
            const parsed = JSON.parse(raw.replace(/```json?|```/g, "").trim());
            if (Array.isArray(parsed)) setTips(parsed);
          } catch {
            // Try to extract tips from raw text
            const lines = raw.split("\n").filter(l => l.trim().length > 10);
            setTips(lines.slice(0, 4));
          }
        })
        .catch(() => setTips(["Keep practicing your weak areas consistently.", "Review incorrect answers after each session."]))
        .finally(() => setTipsLoading(false));
    }
  }, []);

  // Historical improvement (compare to last 5 sessions in same subject)
  const subjectHistory = history
    .filter(h => h.subjectId === session.source?.id)
    .slice(-5)
    .map(h => Math.round((h.score / Math.max(1, h.total)) * 100));
  
  const prevAvg = subjectHistory.length > 0
    ? Math.round(subjectHistory.reduce((a, b) => a + b, 0) / subjectHistory.length)
    : null;
  
  const improvement = prevAvg !== null ? analytics.percentage - prevAvg : null;

  const pct = analytics.percentage;
  const emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 60 ? "💪" : pct >= 40 ? "📖" : "🔄";
  const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "F";

  const tabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "topics", label: "🎯 Topics" },
    { key: "review", label: "📝 Review" },
    { key: "tips", label: "💡 Tips" },
  ];

  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(10, 10, 10, 0.97), rgba(20, 20, 20, 0.95))",
      border: "1px solid rgba(255, 215, 0, 0.2)",
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    }}>
      {/* Hero Header */}
      <div style={{
        background: pct >= 70
          ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))"
          : "linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(218, 165, 32, 0.1))",
        padding: "28px 24px",
        textAlign: "center",
        borderBottom: "1px solid rgba(255, 215, 0, 0.15)",
      }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{emoji}</div>
        <div style={{
          fontSize: 52, fontWeight: 800,
          background: pct >= 70 ? "linear-gradient(135deg, #4ade80, #22c55e)" : "linear-gradient(135deg, #60a5fa, #FFD700)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>{pct}%</div>
        <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 4 }}>
          {analytics.score}/{analytics.total} correct · Grade: <strong style={{ color: "#FFD700" }}>{grade}</strong> · {Math.floor(analytics.duration / 60)}m {analytics.duration % 60}s
        </div>

        {/* Improvement indicator */}
        {improvement !== null && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
            padding: "6px 14px", borderRadius: 20,
            background: improvement > 0 ? "rgba(34, 197, 94, 0.15)" : improvement < 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(100, 116, 139, 0.15)",
            border: `1px solid ${improvement > 0 ? "rgba(34, 197, 94, 0.3)" : improvement < 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(100, 116, 139, 0.3)"}`,
          }}>
            <span>{improvement > 0 ? "📈" : improvement < 0 ? "📉" : "➡️"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: improvement > 0 ? "#4ade80" : improvement < 0 ? "#f87171" : "#94a3b8" }}>
              {improvement > 0 ? "+" : ""}{improvement}% vs your average
            </span>
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: "rgba(255, 215, 0, 0.1)" }}>
        {[
          { icon: "⏱️", value: `${analytics.avgTimePerQuestion}s`, label: "Avg/Q" },
          { icon: "🔥", value: analytics.longestStreak, label: "Best Streak" },
          { icon: "🎯", value: analytics.weakTopics.length, label: "Weak Areas" },
          { icon: "💪", value: analytics.strongTopics.length, label: "Strong" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "14px 8px", textAlign: "center", background: "rgba(10, 10, 10, 0.9)" }}>
            <div style={{ fontSize: 16 }}>{s.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFD700" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 215, 0, 0.15)", padding: "0 8px" }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, padding: "12px 4px", border: "none", cursor: "pointer",
              background: "transparent", fontSize: 11, fontWeight: 600, transition: "all 0.2s",
              color: activeTab === t.key ? "#FFD700" : "#64748b",
              borderBottom: activeTab === t.key ? "2px solid #FFD700" : "2px solid transparent",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: 24, maxHeight: 400, overflowY: "auto" }}>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            {/* Performance Bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
                <span>Score Progress</span>
                <span>{analytics.score}/{analytics.total}</span>
              </div>
              <div style={{ height: 10, background: "rgba(20, 20, 20, 0.8)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 10, transition: "width 1s ease-out",
                  width: `${pct}%`,
                  background: pct >= 70 ? "linear-gradient(90deg, #22c55e, #4ade80)" : pct >= 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)",
                }} />
              </div>
            </div>

            {/* Answer Breakdown Visual */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>Answer Pattern</div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {results.map((r, i) => (
                  <div key={i} style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: r.correct ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: "#fff", fontWeight: 700,
                  }}>{i + 1}</div>
                ))}
              </div>
            </div>

            {/* Historical Graph */}
            {subjectHistory.length > 1 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>Recent Sessions ({session.source?.label})</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
                  {[...subjectHistory, pct].map((score, i) => {
                    const isLatest = i === subjectHistory.length;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 9, color: isLatest ? "#FFD700" : "#64748b" }}>{score}%</div>
                        <div style={{
                          width: "100%", borderRadius: 4,
                          height: `${Math.max(10, score * 0.7)}px`,
                          background: isLatest ? "linear-gradient(180deg, #FFD700, #DAA520)" : "rgba(255, 215, 0, 0.3)",
                          transition: "height 0.5s",
                        }} />
                        <div style={{ fontSize: 8, color: "#64748b" }}>{isLatest ? "Now" : `#${i + 1}`}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confidence Calibration */}
            <div style={{ background: "rgba(20, 20, 20, 0.5)", borderRadius: 12, padding: 14, border: "1px solid rgba(255, 215, 0, 0.15)" }}>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>🎯 Confidence Calibration</div>
              {(() => {
                const confMap = { unsure: 40, okay: 60, sure: 80 };
                const avgConf = results.length > 0
                  ? Math.round(results.reduce((a, r) => a + (confMap[r.confidence] || 60), 0) / results.length)
                  : 50;
                const gap = avgConf - pct;
                const label = gap > 10 ? "Overconfident" : gap < -10 ? "Underconfident" : "Well Calibrated";
                const color = gap > 10 ? "#f59e0b" : gap < -10 ? "#60a5fa" : "#22c55e";
                return (
                  <div style={{ fontSize: 13, color }}>
                    {label} — Felt {avgConf}%, scored {pct}%
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Topics Tab */}
        {activeTab === "topics" && (
          <div>
            {analytics.topicBreakdown.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>No topic data available</div>
            )}
            {analytics.topicBreakdown.map(topic => (
              <div key={topic.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                borderBottom: "1px solid rgba(255, 215, 0, 0.1)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: topic.pct >= 70 ? "rgba(34, 197, 94, 0.2)" : topic.pct >= 50 ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, border: `1px solid ${topic.pct >= 70 ? "rgba(34, 197, 94, 0.3)" : topic.pct >= 50 ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                }}>
                  {topic.pct >= 70 ? "✅" : topic.pct >= 50 ? "⚠️" : "❌"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#FFD700" }}>{topic.label}</div>
                  <div style={{ height: 4, background: "rgba(20, 20, 20, 0.8)", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${topic.pct}%`,
                      background: topic.pct >= 70 ? "#22c55e" : topic.pct >= 50 ? "#f59e0b" : "#ef4444",
                    }} />
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: topic.pct >= 70 ? "#4ade80" : topic.pct >= 50 ? "#fbbf24" : "#f87171" }}>
                  {topic.correct}/{topic.total}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === "review" && (
          <div>
            {results.map((r, i) => {
              const q = questions[i];
              if (!q) return null;
              return (
                <div key={i} style={{
                  borderLeft: `3px solid ${r.correct ? "#22c55e" : "#ef4444"}`,
                  marginBottom: 10, borderRadius: 10, padding: 14,
                  background: r.correct ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", flex: 1 }}>Q{i + 1}: {q.q}</span>
                    <span style={{ fontSize: 16, marginLeft: 8 }}>{r.correct ? "✅" : "❌"}</span>
                  </div>
                  {!r.correct && (
                    <>
                      <div style={{ fontSize: 12, color: "#f87171" }}>Your answer: {q.options?.[r.selected] || "—"}</div>
                      <div style={{ fontSize: 12, color: "#4ade80" }}>Correct: {q.options?.[q.answer] || "—"}</div>
                    </>
                  )}
                  {q.explanation && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>💡 {q.explanation}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tips Tab */}
        {activeTab === "tips" && (
          <div>
            {tipsLoading && (
              <div style={{ textAlign: "center", padding: 20, color: "#9ca3af" }}>
                <div className="spinner" style={{ margin: "0 auto 12px" }} />
                🤖 AI is analyzing your performance...
              </div>
            )}
            {!tipsLoading && tips.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {tips.map((tip, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: 14, borderRadius: 12,
                    background: "rgba(255, 215, 0, 0.08)",
                    border: "1px solid rgba(255, 215, 0, 0.15)",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: "linear-gradient(135deg, #FFD700, #2563eb)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: "#FFD700", lineHeight: 1.5 }}>{tip}</div>
                  </div>
                ))}
              </div>
            )}
            {!tipsLoading && tips.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>
                Configure your AI key in Settings to get personalized tips.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255, 215, 0, 0.15)", display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            if (onSave) onSave();
            if (onExit) onExit();
          }}
          style={{
            background: "linear-gradient(135deg, #22c55e, #16a34a)",
            border: "none", padding: "12px 24px", borderRadius: 10,
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            boxShadow: "0 4px 15px rgba(34, 197, 94, 0.4)",
          }}
        >✓ Save & Exit</button>

        <button
          onClick={() => {
            const text = `📊 ${session.source?.label || "Practice"} Results\n🏆 Score: ${pct}% (${analytics.score}/${analytics.total})\n🔥 Streak: ${analytics.longestStreak}\n⏱️ Time: ${Math.floor(analytics.duration / 60)}m\n\n— Scholar's Circle`;
            if (navigator.share) navigator.share({ title: "My Results", text });
            else navigator.clipboard?.writeText(text).then(() => alert("Copied!"));
          }}
          style={{
            background: "rgba(255, 215, 0, 0.2)", border: "1px solid rgba(255, 215, 0, 0.3)",
            padding: "12px 24px", borderRadius: 10, color: "#FFD700",
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}
        >📤 Share</button>

        {analytics.weakTopics.length > 0 && (
          <button
            onClick={() => {
              // Signal parent to start weak drill
              if (onExit) onExit("drill-weak");
            }}
            style={{
              background: "rgba(245, 158, 11, 0.2)", border: "1px solid rgba(245, 158, 11, 0.3)",
              padding: "12px 24px", borderRadius: 10, color: "#fbbf24",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >⚔️ Drill Weak Topics</button>
        )}
      </div>
    </div>
  );
}
