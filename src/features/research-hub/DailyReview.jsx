import { useState, useEffect, useCallback } from "react";

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

export default function DailyReview({ onBack, onComplete, onOpenPdf }) {
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

  if (loading) {
    return (
      <div className="px-5 py-14 text-center">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-hub-border border-t-gold" />
        <div className="text-sm font-bold text-hub-text-muted">Loading review items…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-14 text-center">
        <div className="mb-3 text-4xl">⚠️</div>
        <div className="mb-3 text-sm text-[#ef4444]">{error}</div>
        <button onClick={fetchDue} className="mr-2 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-5 py-2 text-[11px] font-bold text-gold transition-all active:scale-95">Retry</button>
        <button onClick={onBack} className="cursor-pointer rounded-lg border border-hub-border px-5 py-2 text-[11px] text-hub-text-muted transition-all active:scale-95">← Back</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <div className="mb-3 text-5xl">✅</div>
        <div className="mb-2 text-base font-bold text-[#22c55e]">All caught up!</div>
        <div className="mx-auto max-w-[360px] text-[13px] leading-relaxed text-hub-text-dim">
          No items due for review right now. Open some PDFs or practice MCQs to build your review queue.
        </div>
        <button onClick={onBack} className="mt-4 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">← Back to Hub</button>
      </div>
    );
  }

  if (finished) {
    const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;
    return (
      <div className="px-5 py-10 text-center">
        <div className="mb-3 text-5xl">🎉</div>
        <div className="mb-2 text-base font-bold text-gold">Session Complete!</div>
        <div className="my-4 flex justify-center gap-4">
          <div className="text-center">
            <div className="text-xl font-extrabold text-hub-text-muted">{sessionStats.reviewed}</div>
            <div className="text-[10px] text-hub-text-dim">Reviewed</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-extrabold" style={{ color: accuracy >= 70 ? "#22c55e" : "#f59e0b" }}>{accuracy}%</div>
            <div className="text-[10px] text-hub-text-dim">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-extrabold text-gold">{dailyGoal}</div>
            <div className="text-[10px] text-hub-text-dim">Daily Goal</div>
          </div>
        </div>
        <button onClick={onBack} className="cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">← Back to Hub</button>
      </div>
    );
  }

  const typeIcon = { whole_pdf: "📄", page: "📖", flashcard: "🃏", mcq: "❓", legacy_mcq: "❓" }[currentItem?.itemType] || "📚";
  const typeLabel = { whole_pdf: "PDF Review", page: "Page Review", flashcard: "Flashcard", mcq: "MCQ", legacy_mcq: "MCQ" }[currentItem?.itemType] || "Review";

  const progressPct = sessionStats.total > 0 ? Math.round((sessionStats.reviewed / sessionStats.total) * 100) : 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-[600px] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-hub-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={onBack} className="cursor-pointer text-[11px] text-hub-text-muted">← Back</button>
          <span className="text-[11px] font-semibold text-hub-text-muted">
            {sessionStats.reviewed}/{sessionStats.total} · Goal: {dailyGoal}
          </span>
          <span className="text-[10px] text-hub-text-dim">{typeLabel}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-hub-bg">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-[#22c55e] transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-auto p-4">
        {/* FSRS state indicator */}
        <div className="mb-3 text-center text-[10px] text-hub-text-dim">
          {STATE_LABELS[currentItem.state] || ""} · {currentItem.reps || 0} reps · {currentItem.lapses > 0 ? `${currentItem.lapses} lapses` : "No lapses"}
        </div>

        {/* Topic badge */}
        {currentItem.topic && (
          <div className="mb-2 text-center">
            <span className="rounded-full bg-hub-bg px-2.5 py-0.5 text-[10px] text-hub-text-dim">{currentItem.topic}</span>
          </div>
        )}

        {/* Card content */}
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-hub-border bg-[#0d0f20] p-6 text-center">
          <div className="mb-3 text-3xl">{typeIcon}</div>

          {currentItem.itemType === "flashcard" ? (
            <>
              {(currentItem.subject || currentItem.resource?.title) && (
                <div className="mb-2 text-[10px] text-hub-text-dim">
                  {currentItem.resource?.title}{currentItem.subject && currentItem.resource?.title ? " · " : ""}{currentItem.subject}
                </div>
              )}
              <div className="mb-3 text-sm font-bold text-hub-text">
                {currentItem.flashcard?.front || "No front text"}
              </div>
              {showAnswer && (
                <div className="w-full rounded-lg bg-hub-bg p-3 text-[13px] leading-relaxed text-hub-text-muted">
                  {currentItem.flashcard?.back || "No back text"}
                </div>
              )}
            </>
          ) : currentItem.itemType === "mcq" || currentItem.itemType === "legacy_mcq" ? (
            <>
              <div className="mb-3 text-sm font-bold text-hub-text">
                {currentItem.mcq?.question || currentItem.mcq?.q || `Question ${(currentItem.pageIndex || 0) + 1}`}
              </div>
              {showAnswer && currentItem.mcq?.options && (
                <div className="w-full text-left">
                  {(() => {
                    const opts = currentItem.mcq.options;
                    const correctKey = currentItem.mcq?.correct ?? currentItem.mcq?.answer ?? null;
                    if (Array.isArray(opts)) {
                      return opts.map((opt, oi) => {
                        const isCorrect = String.fromCharCode(65 + oi) === correctKey || oi === (currentItem.mcq?.correctIndex ?? currentItem.mcq?.answer);
                        return (
                          <div key={oi} className={`mb-1 rounded-lg border p-2 px-3 text-[11px] ${
                            isCorrect ? "border-[#22c55e] bg-[#0f2a1a] text-[#a5d6a7]" : "border-hub-border bg-hub-bg text-hub-text-muted"
                          }`}>
                            {String.fromCharCode(65 + oi)}. {opt}
                          </div>
                        );
                      });
                    }
                    return Object.entries(opts).map(([key, val]) => {
                      const isCorrect = key === correctKey;
                      return (
                        <div key={key} className={`mb-1 rounded-lg border p-2 px-3 text-[11px] ${
                          isCorrect ? "border-[#22c55e] bg-[#0f2a1a] text-[#a5d6a7]" : "border-hub-border bg-hub-bg text-hub-text-muted"
                        }`}>
                          {key}. {val}
                        </div>
                      );
                    });
                  })()}
                  {currentItem.mcq?.explanation && (
                    <div className="mt-2 text-[10px] italic text-hub-text-dim">
                      {currentItem.mcq.explanation}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-2 text-sm font-bold text-hub-text">
                {currentItem.resource?.title || "Review this content"}
              </div>
              <div className="mb-3 text-[11px] text-hub-text-dim">
                {currentItem.itemType === "page" ? `Page ${currentItem.pageIndex}` : "Full document review"}
                {currentItem.subject ? ` · ${currentItem.subject}` : ""}
              </div>
              {onOpenPdf && currentItem.resource?.shareToken && (
                <button onClick={() => onOpenPdf(currentItem.resource.shareToken, currentItem.itemType === "page" ? currentItem.pageIndex : null)} className="mb-3 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-5 py-2 text-[11px] font-bold text-gold transition-all active:scale-95">
                  {currentItem.itemType === "page" ? `📖 Open Page ${currentItem.pageIndex}` : "📄 Open Document"}
                </button>
              )}
              {showAnswer && (
                <div className="mt-3 text-[11px] leading-relaxed text-hub-text-muted">
                  How well did you remember the key concepts from this {currentItem.itemType === "page" ? "page" : "document"}?
                  Rate your recall below.
                </div>
              )}
            </>
          )}

          {!showAnswer && (
            <button onClick={() => setShowAnswer(true)} className="mt-4 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">
              {currentItem.itemType === "flashcard" || currentItem.itemType === "mcq" || currentItem.itemType === "legacy_mcq" ? "Show Answer" : "Reveal & Rate"}
            </button>
          )}
        </div>

        {/* Rating buttons */}
        {showAnswer && rating === null && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[1, 2, 3, 4].map(g => (
              <button key={g} onClick={() => handleRate(g)} className="flex min-w-[70px] cursor-pointer flex-col items-center gap-1 rounded-xl border px-4 py-3 transition-all active:scale-95" style={{
                background: g === 1 ? "#2a0a0a" : g === 2 ? "#2a1a0a" : g === 3 ? "#0a2a0a" : "#0a0a2a",
                borderColor: GRADE_LABELS[g].color,
                color: GRADE_LABELS[g].color,
              }}>
                <span className="text-base font-bold">{GRADE_LABELS[g].label}</span>
                <span className="text-[10px] opacity-70">{GRADE_LABELS[g].desc}</span>
                <span className="text-[10px] opacity-50">{GRADE_LABELS[g].nextTime}</span>
              </button>
            ))}
          </div>
        )}

        {/* Rating feedback */}
        {rating !== null && (
          <div className="mt-3 text-center text-[11px]" style={{ color: GRADE_LABELS[rating]?.color || "#888" }}>
            Rated: {GRADE_LABELS[rating]?.label} · Next card…
          </div>
        )}
      </div>
    </div>
  );
}
