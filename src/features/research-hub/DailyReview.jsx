import { useState, useEffect, useCallback } from "react";
import { colors, spacing, fontSize, fontWeight, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

const GRADE_LABELS = {
  1: { label: "Again", desc: "Forgot", color: "#ef4444", nextTime: "< 1 min" },
  2: { label: "Hard", desc: "With effort", color: "#f59e0b", nextTime: "~3 min" },
  3: { label: "Good", desc: "Remembered", color: "#22c55e", nextTime: "~1 day" },
  4: { label: "Easy", desc: "Instantly", color: "#7986cb", nextTime: "~4 days" },
};

const STATE_LABELS = { 0: "🆕 New", 1: "📖 Learning", 2: "🔄 Review", 3: "🔁 Relearning" };

export default function DailyReview({ onBack, onComplete }) {
  const [items, setItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [rating, setRating] = useState(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0, total: 0 });
  const [finished, setFinished] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(20);

  const fetchDue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/due?limit=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setDailyGoal(data.dailyGoal || 20);
        setSessionStats(prev => ({ ...prev, total: Math.min((data.items || []).length, data.dailyGoal || 20) }));
      } else {
        setError("Failed to load review items");
      }
    } catch {
      setError("Network error loading review items");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDue(); }, [fetchDue]);

  const currentItem = items[currentIdx];

  const handleRate = async (grade) => {
    if (!currentItem || rating !== null) return;
    setRating(grade);

    try {
      await fetch(`${API_BASE}/api/resources/fsrs/rate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          resourceId: currentItem.resource?.id,
          itemType: currentItem.itemType,
          pageIndex: currentItem.pageIndex,
          flashcardId: currentItem.flashcard?.id || currentItem.flashcardId || undefined,
          grade,
          topic: currentItem.topic,
          subject: currentItem.subject,
        }),
      });
    } catch {}

    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (grade >= 3 ? 1 : 0),
    }));

    setTimeout(() => {
      if (currentIdx + 1 >= items.length || sessionStats.reviewed + 1 >= dailyGoal) {
        setFinished(true);
        onComplete?.();
      } else {
        setCurrentIdx(i => i + 1);
        setShowAnswer(false);
        setRating(null);
      }
    }, 500);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${colors.border}`, borderTopColor: goldText, animation: "scSpin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <style>{`@keyframes scSpin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted }}>Loading review items…</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 36, marginBottom: spacing.md }}>⚠️</div>
        <div style={{ fontSize: fontSize.md, color: "#ef4444", marginBottom: spacing.md }}>{error}</div>
        <button onClick={fetchDue} style={{ padding: "8px 20px", borderRadius: 8, background: goldDim, border: `0.5px solid ${goldBorder}`, color: goldText, cursor: "pointer", fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>Retry</button>
        <button onClick={onBack} style={{ padding: "8px 20px", borderRadius: 8, background: "none", border: `0.5px solid ${colors.border}`, color: colors.textMuted, cursor: "pointer", fontSize: fontSize.sm, marginLeft: spacing.sm }}>← Back</button>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: spacing.md }}>✅</div>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: "#22c55e", marginBottom: spacing.sm }}>All caught up!</div>
        <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 360, margin: "0 auto", lineHeight: 1.5 }}>
          No items due for review right now. Open some PDFs or practice MCQs to build your review queue.
        </div>
        <button onClick={onBack} style={{ marginTop: spacing.lg, padding: "10px 24px", borderRadius: 8, background: goldDim, border: `0.5px solid ${goldBorder}`, color: goldText, cursor: "pointer", fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>← Back to Hub</button>
      </div>
    );
  }

  // Finished state
  if (finished) {
    const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: spacing.md }}>🎉</div>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: goldText, marginBottom: spacing.sm }}>Session Complete!</div>
        <div style={{ display: "flex", gap: spacing.lg, justifyContent: "center", marginTop: spacing.lg, marginBottom: spacing.xl }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.textMuted }}>{sessionStats.reviewed}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Reviewed</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: accuracy >= 70 ? "#22c55e" : "#f59e0b" }}>{accuracy}%</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Accuracy</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: goldText }}>{dailyGoal}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Daily Goal</div>
          </div>
        </div>
        <button onClick={onBack} style={{ padding: "10px 24px", borderRadius: 8, background: goldDim, border: `0.5px solid ${goldBorder}`, color: goldText, cursor: "pointer", fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>← Back to Hub</button>
      </div>
    );
  }

  // Item type icon
  const typeIcon = { whole_pdf: "📄", page: "📖", flashcard: "🃏", mcq: "❓", legacy_mcq: "❓" }[currentItem?.itemType] || "📚";
  const typeLabel = { whole_pdf: "PDF Review", page: "Page Review", flashcard: "Flashcard", mcq: "MCQ", legacy_mcq: "MCQ" }[currentItem?.itemType] || "Review";

  // Progress
  const progressPct = sessionStats.total > 0 ? Math.round((sessionStats.reviewed / sessionStats.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 600, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ padding: spacing.md, borderBottom: `0.5px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: fontSize.sm }}>← Back</button>
          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>
            {sessionStats.reviewed}/{sessionStats.total} · Goal: {dailyGoal}
          </span>
          <span style={{ fontSize: fontSize.xs, color: colors.textDim }}>{typeLabel}</span>
        </div>
        <div style={{ height: 4, background: colors.bg, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${goldText}, #22c55e)`, borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Card */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: spacing.lg, overflow: "auto" }}>
        {/* FSRS state indicator */}
        <div style={{ textAlign: "center", marginBottom: spacing.md, fontSize: fontSize.xs, color: colors.textDim }}>
          {STATE_LABELS[currentItem.state] || ""} · {currentItem.reps || 0} reps · {currentItem.lapses > 0 ? `${currentItem.lapses} lapses` : "No lapses"}
        </div>

        {/* Topic badge */}
        {currentItem.topic && (
          <div style={{ textAlign: "center", marginBottom: spacing.sm }}>
            <span style={{ fontSize: fontSize.xs, color: colors.textDim, background: colors.bg, padding: "2px 10px", borderRadius: 10 }}>{currentItem.topic}</span>
          </div>
        )}

        {/* Card content */}
        <div style={{
          background: "#0d0f20", border: `0.5px solid ${colors.border}`, borderRadius: 16,
          padding: spacing.xl, minHeight: 200, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: spacing.md }}>{typeIcon}</div>

          {currentItem.itemType === "flashcard" ? (
            <>
              <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#e8e8e8", marginBottom: spacing.md }}>
                {currentItem.flashcard?.front || "No front text"}
              </div>
              {showAnswer && (
                <div style={{ fontSize: fontSize.base, color: colors.textMuted, lineHeight: 1.6, padding: spacing.md, background: colors.bg, borderRadius: 8, width: "100%" }}>
                  {currentItem.flashcard?.back || "No back text"}
                </div>
              )}
            </>
          ) : currentItem.itemType === "mcq" || currentItem.itemType === "legacy_mcq" ? (
            <>
              <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#e8e8e8", marginBottom: spacing.md }}>
                {currentItem.mcq?.question || currentItem.mcq?.q || `Question ${(currentItem.pageIndex || 0) + 1}`}
              </div>
              {showAnswer && currentItem.mcq?.options && (
                <div style={{ width: "100%", textAlign: "left" }}>
                  {(() => {
                    const opts = currentItem.mcq.options;
                    const correctKey = currentItem.mcq?.correct ?? currentItem.mcq?.answer ?? null;
                    if (Array.isArray(opts)) {
                      return opts.map((opt, oi) => {
                        const isCorrect = String.fromCharCode(65 + oi) === correctKey || oi === (currentItem.mcq?.correctIndex ?? currentItem.mcq?.answer);
                        return (
                          <div key={oi} style={{
                            padding: "8px 12px", marginBottom: 4, borderRadius: 8,
                            background: isCorrect ? "#0f2a1a" : colors.bg,
                            border: `0.5px solid ${isCorrect ? "#22c55e" : colors.border}`,
                            fontSize: fontSize.sm, color: isCorrect ? "#a5d6a7" : colors.textMuted,
                          }}>
                            {String.fromCharCode(65 + oi)}. {opt}
                          </div>
                        );
                      });
                    }
                    return Object.entries(opts).map(([key, val]) => {
                      const isCorrect = key === correctKey;
                      return (
                        <div key={key} style={{
                          padding: "8px 12px", marginBottom: 4, borderRadius: 8,
                          background: isCorrect ? "#0f2a1a" : colors.bg,
                          border: `0.5px solid ${isCorrect ? "#22c55e" : colors.border}`,
                          fontSize: fontSize.sm, color: isCorrect ? "#a5d6a7" : colors.textMuted,
                        }}>
                          {key}. {val}
                        </div>
                      );
                    });
                  })()}
                  {currentItem.mcq?.explanation && (
                    <div style={{ marginTop: spacing.sm, fontSize: fontSize.xs, color: colors.textDim, fontStyle: "italic" }}>
                      {currentItem.mcq.explanation}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#e8e8e8", marginBottom: spacing.sm }}>
                {currentItem.resource?.title || "Review this content"}
              </div>
              <div style={{ fontSize: fontSize.sm, color: colors.textDim }}>
                {currentItem.itemType === "page" ? `Page ${currentItem.pageIndex}` : "Full document review"}
              </div>
              {showAnswer && (
                <div style={{ marginTop: spacing.md, fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 1.5 }}>
                  Try to recall the key concepts from this {currentItem.itemType === "page" ? "page" : "document"}.
                  Rate your recall below.
                </div>
              )}
            </>
          )}

          {!showAnswer && (
            <button onClick={() => setShowAnswer(true)} style={{
              marginTop: spacing.lg, padding: "10px 24px", borderRadius: 8,
              background: goldDim, border: `0.5px solid ${goldBorder}`, color: goldText,
              cursor: "pointer", fontSize: fontSize.sm, fontWeight: fontWeight.bold,
            }}>
              Show Answer
            </button>
          )}
        </div>

        {/* Rating buttons */}
        {showAnswer && rating === null && (
          <div style={{ display: "flex", gap: spacing.sm, justifyContent: "center", marginTop: spacing.lg, flexWrap: "wrap" }}>
            {[1, 2, 3, 4].map(g => (
              <button key={g} onClick={() => handleRate(g)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                background: g === 1 ? "#2a0a0a" : g === 2 ? "#2a1a0a" : g === 3 ? "#0a2a0a" : "#0a0a2a",
                border: `0.5px solid ${GRADE_LABELS[g].color}`,
                color: GRADE_LABELS[g].color, minWidth: 70,
              }}>
                <span style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>{GRADE_LABELS[g].label}</span>
                <span style={{ fontSize: fontSize.xs, opacity: 0.7 }}>{GRADE_LABELS[g].desc}</span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>{GRADE_LABELS[g].nextTime}</span>
              </button>
            ))}
          </div>
        )}

        {/* Rating feedback */}
        {rating !== null && (
          <div style={{ textAlign: "center", marginTop: spacing.md, fontSize: fontSize.sm, color: GRADE_LABELS[rating]?.color || colors.textMuted }}>
            Rated: {GRADE_LABELS[rating]?.label} · Next card…
          </div>
        )}
      </div>
    </div>
  );
}
