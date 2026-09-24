import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE } from "../../lib/constants";
import PracticeMcqCard from "../streak-survival/PracticeMcqCard.jsx";
import { normalizeQuestion } from "../streak-survival/fsrsBridge.js";


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
  const [fsrsStats, setFsrsStats] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  // Missed-MCQ review loop (prototype behavior): grade-1 MCQs are re-asked at session end
  const [missedQueue, setMissedQueue] = useState([]);
  const [reviewPhase, setReviewPhase] = useState(false);
  const [clearedCount, setClearedCount] = useState(0);

  // Folder selection
  const [selectedFolder, setSelectedFolder] = useState(null); // null = show folder picker
  const [byFolder, setByFolder] = useState({});
  const [allItems, setAllItems] = useState([]);

  // Scroll container ref for auto-scroll on item change
  const scrollRef = useRef(null);

  const fetchDue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/due?limit=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllItems((data.items || []).filter(i => i.itemType !== "flashcard"));
        const folders = {};
        for (const [k, f] of Object.entries(data.byFolder || {})) {
          const items = (f.items || []).filter(i => i.itemType !== "flashcard");
          if (items.length) folders[k] = { ...f, items, dueCount: items.length };
        }
        setByFolder(folders);
        setDailyGoal(data.dailyGoal || 20);
      } else {
        setError("Failed to load review items");
      }
    } catch {
      setError("Network error loading review items");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDue(); }, [fetchDue]);

  // When a folder is selected, set items and session stats
  useEffect(() => {
    if (!selectedFolder) return;
    let folderItems;
    if (selectedFolder === "__all__") {
      folderItems = allItems;
    } else if (byFolder[selectedFolder]) {
      folderItems = byFolder[selectedFolder].items;
    } else {
      return;
    }
    setItems(folderItems);
    setCurrentIdx(0);
    setSessionStats({ reviewed: 0, correct: 0, total: Math.min(folderItems.length, dailyGoal || 20) });
  }, [selectedFolder, byFolder, allItems, dailyGoal]);

  // Scroll to top when current item changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentIdx]);

  const fetchFsrsStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFsrsStats(data);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchFsrsStats(); }, [fetchFsrsStats]);

  const isMcqItem = (it) => it?.itemType === "mcq" || it?.itemType === "legacy_mcq";
  // During the missed-review phase, serve from the missed queue head
  const currentItem = reviewPhase ? missedQueue[0] : items[currentIdx];
  const lastMcqAnswerRef = useRef(null); // last PracticeMcqCard answer (read on Continue)
  const [cardNonce, setCardNonce] = useState(0);

  const finishSession = () => {
    setFinished(true);
    fetchFsrsStats();
    onComplete?.();
  };

  const advanceSession = () => {
    if (currentIdx + 1 >= items.length || sessionStats.reviewed >= dailyGoal) {
      if (missedQueue.length > 0) {
        setReviewPhase(true);
        setCardNonce(n => n + 1);
      } else {
        finishSession();
      }
    } else {
      setCurrentIdx(i => i + 1);
      setShowAnswer(false);
      setRating(null);
    }
  };

  // PracticeMcqCard callbacks — fires optimistically on answer, again with serverAck on response
  const handleMcqRated = (res) => {
    if (res.serverAck) return;
    lastMcqAnswerRef.current = res;
    window.dispatchEvent(new CustomEvent("sc-fsrs-rated"));
    if (!reviewPhase) {
      setSessionStats(prev => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        correct: prev.correct + (res.correct ? 1 : 0),
      }));
      if (!res.correct) setMissedQueue(q => [...q, currentItem]);
    }
  };

  const handleMcqNext = () => {
    if (reviewPhase) {
      const wasCorrect = lastMcqAnswerRef.current?.correct;
      const nextQueue = wasCorrect ? missedQueue.slice(1) : [...missedQueue.slice(1), missedQueue[0]];
      setMissedQueue(nextQueue);
      if (wasCorrect) setClearedCount(c => c + 1);
      setCardNonce(n => n + 1);
      if (nextQueue.length === 0) finishSession();
      return;
    }
    advanceSession();
  };

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
          grade,
          topic: currentItem.topic,
          subject: currentItem.subject,
        }),
      });
    } catch {}
    window.dispatchEvent(new CustomEvent("sc-fsrs-rated"));

    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (grade >= 3 ? 1 : 0),
    }));

    setTimeout(advanceSession, 500);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-5">
        <div className="relative mb-5 h-14 w-14">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-hub-border border-t-gold" />
          <div className="absolute inset-0 flex items-center justify-center text-xl">📚</div>
        </div>
        <div className="text-sm font-semibold text-hub-text">Loading your reviews…</div>
        <div className="mt-1 text-[11px] text-hub-text-dim">Fetching due items from your folders</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-5">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-coral-300 bg-coral-50 text-3xl">⚠️</div>
        <div className="mb-1 text-sm font-bold text-coral-400">{error}</div>
        <div className="mb-5 text-[11px] text-hub-text-dim">Something went wrong loading your reviews</div>
        <div className="flex gap-2">
          <button onClick={fetchDue} className="cursor-pointer rounded-xl bg-gold px-5 py-2.5 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-95">↻ Retry</button>
          <button onClick={onBack} className="cursor-pointer rounded-xl border border-hub-border px-5 py-2.5 text-[12px] font-semibold text-hub-text-muted transition-all active:scale-95">← Back</button>
        </div>
      </div>
    );
  }

  // ── Folder Selection Screen ──
  if (!selectedFolder) {
    const folderEntries = Object.entries(byFolder).sort((a, b) => b[1].dueCount - a[1].dueCount);
    const totalDue = allItems.length;
    const folderIcons = ["📘", "📗", "📙", "📕", "📓", "📔", "📒", "📚"];
    return (
      <div className="mx-auto flex h-full w-full max-w-[560px] flex-col">
        {/* Header */}
        <div className="shrink-0 px-5 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={onBack} className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-hub-text-muted transition-colors hover:text-hub-text">
              <span className="text-[14px]">←</span> Back
            </button>
            <span className="text-[10px] font-medium uppercase tracking-wider text-hub-text-dim">Daily Review</span>
          </div>
          {/* Hero */}
          <div className="mb-1 flex items-end gap-3">
            <div className="text-3xl font-extrabold text-hub-text">Reviews</div>
            {totalDue > 0 && (
              <div className="mb-1 rounded-full bg-gold-dim px-2.5 py-0.5 text-[12px] font-bold text-gold">{totalDue} due</div>
            )}
          </div>
          <div className="text-[12px] text-hub-text-dim">Pick a folder to start your review session</div>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-auto px-5 pb-6">
          {/* All Folders featured card */}
          {folderEntries.length > 1 && (
            <button
              onClick={() => setSelectedFolder("__all__")}
              className="group mb-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-gold-border bg-gradient-to-r from-gold-dim to-transparent p-4 text-left transition-all hover:border-gold active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-dim text-xl">📋</div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-gold">All Folders</div>
                <div className="text-[10px] text-hub-text-dim">Review everything due across all folders</div>
              </div>
              <div className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-gold px-2 text-[11px] font-bold text-[#0a0a0a]">{totalDue}</div>
            </button>
          )}

          {/* Individual folders */}
          <div className="space-y-2">
            {folderEntries.map(([key, f], idx) => {
              const mcqCount = f.items.filter(i => i.itemType === "mcq" || i.itemType === "legacy_mcq").length;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedFolder(key)}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-hub-border bg-hub-surface p-4 text-left transition-all hover:border-hub-text-dim hover:bg-hub-surface-hover active:scale-[0.98]"
                  style={{ animation: `stagger-in 0.25s ease both ${idx * 0.04}s` }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hub-bg text-xl transition-colors group-hover:bg-hub-surface-hover">
                    {key === "__unfiled__" ? "�" : folderIcons[idx % folderIcons.length]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] font-bold text-hub-text">
                      {key === "__unfiled__" ? "Unfiled" : f.folderName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-hub-text-dim">
                      {mcqCount > 0 && <span className="rounded bg-hub-bg px-1.5 py-0.5">❓ {mcqCount}</span>}
                    </div>
                  </div>
                  <div className="flex h-7 min-w-[28px] items-center justify-center rounded-full border border-hub-border bg-hub-bg px-2 text-[11px] font-bold text-hub-text-muted transition-colors group-hover:border-gold-border group-hover:text-gold">{f.dueCount}</div>
                </button>
              );
            })}
          </div>

          {folderEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-hub-border bg-hub-surface text-3xl">✅</div>
              <div className="text-sm font-semibold text-hub-text">All caught up!</div>
              <div className="mt-1 text-[11px] text-hub-text-dim">No items due for review right now</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-5">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-success-border bg-success-bg text-4xl">✅</div>
        <div className="mb-1 text-lg font-bold text-success-text">All caught up!</div>
        <div className="max-w-[320px] text-center text-[12px] leading-relaxed text-hub-text-dim">
          No items due in this folder right now. Open some PDFs or practice MCQs to build your review queue.
        </div>

        {/* Mini stats */}
        {fsrsStats && (
          <div className="mt-5 flex gap-3">
            <div className="flex flex-col items-center rounded-2xl border border-hub-border bg-hub-surface px-4 py-3">
              <div className="text-lg font-bold text-hub-text">{fsrsStats.totalItems}</div>
              <div className="text-[9px] uppercase tracking-wider text-hub-text-dim">Total</div>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-hub-border bg-hub-surface px-4 py-3">
              <div className="text-lg font-bold text-[#7986cb]">{fsrsStats.masteredCount}</div>
              <div className="text-[9px] uppercase tracking-wider text-hub-text-dim">Mastered</div>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-hub-border bg-hub-surface px-4 py-3">
              <div className="text-lg font-bold text-gold">🔥 {fsrsStats.streak}</div>
              <div className="text-[9px] uppercase tracking-wider text-hub-text-dim">Streak</div>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {Object.keys(byFolder).length > 1 && (
            <button onClick={() => setSelectedFolder(null)} className="cursor-pointer rounded-xl border border-hub-border px-5 py-2.5 text-[12px] font-semibold text-hub-text-muted transition-all active:scale-95">← Folders</button>
          )}
          <button onClick={onBack} className="cursor-pointer rounded-xl bg-gold px-6 py-2.5 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-95">← Back to Hub</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;
    const retentionPct = fsrsStats ? Math.round(fsrsStats.avgRetrievability * 100) : null;
    const gradeColor = accuracy >= 70 ? "#22c55e" : accuracy >= 50 ? "#f59e0b" : "#ef4444";
    return (
      <div className="mx-auto flex h-full w-full max-w-[560px] flex-col overflow-auto px-5 py-8">
        {/* Celebration */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <div className="text-xl font-extrabold text-gold">Session Complete!</div>
          <div className="mt-1 text-[12px] text-hub-text-dim">You reviewed {sessionStats.reviewed} {sessionStats.reviewed === 1 ? "card" : "cards"} this session</div>
          {clearedCount > 0 && (
            <div className="mt-1 text-[11px] font-semibold text-[#22c55e]">🔁 {clearedCount} missed question{clearedCount > 1 ? "s" : ""} cleared in review</div>
          )}
        </div>

        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center rounded-2xl border border-hub-border bg-hub-surface p-4">
            <div className="text-2xl font-extrabold text-hub-text">{sessionStats.reviewed}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-hub-text-dim">Reviewed</div>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-hub-border bg-hub-surface p-4">
            <div className="text-2xl font-extrabold" style={{ color: gradeColor }}>{accuracy}%</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-hub-text-dim">Accuracy</div>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-hub-border bg-hub-surface p-4">
            <div className="text-2xl font-extrabold text-gold">{dailyGoal}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-hub-text-dim">Goal</div>
          </div>
        </div>

        {/* Analytics Dashboard */}
        {fsrsStats && (
          <div className="mb-5 rounded-2xl border border-hub-border bg-hub-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12px] font-bold text-hub-text">📊 FSRS Analytics</span>
              <button onClick={() => setShowAnalytics(s => !s)} className="cursor-pointer rounded-lg bg-hub-bg px-2.5 py-1 text-[10px] font-semibold text-gold transition-colors hover:bg-hub-surface-hover">{showAnalytics ? "Hide" : "Details"}</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center">
                <div className="text-base font-bold text-hub-text">{fsrsStats.totalItems}</div>
                <div className="text-[9px] uppercase tracking-wider text-hub-text-dim">Total</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-base font-bold" style={{ color: retentionPct != null && retentionPct >= 85 ? "#22c55e" : "#f59e0b" }}>{retentionPct != null ? `${retentionPct}%` : "—"}</div>
                <div className="text-[9px] uppercase tracking-wider text-hub-text-dim">Recall</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-base font-bold text-[#7986cb]">{fsrsStats.masteredCount}</div>
                <div className="text-[9px] uppercase tracking-wider text-hub-text-dim">Mastered</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-base font-bold text-[#f59e0b]">{fsrsStats.dueCount}</div>
                <div className="text-[9px] uppercase tracking-wider text-hub-text-dim">Due</div>
              </div>
            </div>
            {showAnalytics && (
              <div className="mt-3 space-y-2.5 border-t border-hub-border pt-3">
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-hub-text-dim">Card States</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-hub-bg px-2 py-1 text-[10px] text-hub-text-muted">🆕 {fsrsStats.newCount} new</span>
                    <span className="rounded-lg bg-hub-bg px-2 py-1 text-[10px] text-hub-text-muted">📖 {fsrsStats.learningCount} learning</span>
                    <span className="rounded-lg bg-hub-bg px-2 py-1 text-[10px] text-hub-text-muted">🔄 {fsrsStats.reviewCount} review</span>
                    <span className="rounded-lg bg-hub-bg px-2 py-1 text-[10px] text-hub-text-muted">🏆 {fsrsStats.masteredCount} mastered</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-hub-bg px-3 py-2">
                  <span className="text-[10px] text-hub-text-dim">🔥 Streak</span>
                  <span className="text-[10px] font-bold text-gold">{fsrsStats.streak} days · best: {fsrsStats.longestStreak}</span>
                </div>
                {fsrsStats.bySubject && Object.keys(fsrsStats.bySubject).length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-hub-text-dim">By Subject</div>
                    <div className="space-y-1">
                      {Object.entries(fsrsStats.bySubject).slice(0, 5).map(([subj, s]) => (
                        <div key={subj} className="flex items-center justify-between rounded-lg bg-hub-bg px-3 py-1.5 text-[10px]">
                          <span className="font-medium text-hub-text-muted">{subj}</span>
                          <span className="text-hub-text-dim">{s.total} items · {s.due} due · {s.mastered} ✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg bg-hub-bg px-3 py-2">
                  <span className="text-[10px] text-hub-text-dim">Item Types</span>
                  <span className="text-[10px] text-hub-text-muted">📄 {fsrsStats.pdfCount} · ❓ {fsrsStats.mcqCount}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-2">
          {Object.keys(byFolder).length > 1 && (
            <button onClick={() => { setFinished(false); setSelectedFolder(null); setReviewPhase(false); setMissedQueue([]); setClearedCount(0); }} className="cursor-pointer rounded-xl border border-hub-border px-5 py-2.5 text-[12px] font-semibold text-hub-text-muted transition-all active:scale-95">← Folders</button>
          )}
          <button onClick={onBack} className="cursor-pointer rounded-xl bg-gold px-6 py-2.5 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-95">← Back to Hub</button>
        </div>
      </div>
    );
  }

  const typeIcon = { mcq: "❓", legacy_mcq: "❓" }[currentItem?.itemType] || "📚";
  const typeLabel = { mcq: "Rapid Recall", legacy_mcq: "Rapid Recall" }[currentItem?.itemType] || "Review";

  const progressPct = sessionStats.total > 0 ? Math.round((sessionStats.reviewed / sessionStats.total) * 100) : 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-[560px] flex-col">
      {/* Header */}
      <div className="shrink-0 px-5 pb-3 pt-4">
        <div className="mb-2.5 flex items-center justify-between">
          <button onClick={() => setSelectedFolder(null)} className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-hub-text-muted transition-colors hover:text-hub-text">
            <span className="text-[14px]">←</span> Folders
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-hub-text">{sessionStats.reviewed}</span>
            <span className="text-[10px] text-hub-text-dim">/ {sessionStats.total}</span>
          </div>
          <span className="max-w-[120px] truncate text-[10px] font-medium text-hub-text-dim">
            {selectedFolder === "__all__" ? "All Folders" : byFolder[selectedFolder]?.folderName || "Review"}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-hub-bg">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-[#22c55e] transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Card scroll area */}
      <div ref={scrollRef} className="flex flex-1 flex-col items-center overflow-auto px-5 pb-6 pt-4">
        {/* Meta badges */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="rounded-full border border-hub-border bg-hub-surface px-2.5 py-1 text-[10px] font-medium text-hub-text-muted">{typeIcon} {typeLabel}</span>
          {STATE_LABELS[currentItem.state] && (
            <span className="rounded-full border border-hub-border bg-hub-surface px-2.5 py-1 text-[10px] text-hub-text-dim">{STATE_LABELS[currentItem.state]}</span>
          )}
          {currentItem.lapses > 0 && (
            <span className="rounded-full border border-coral-300 bg-coral-50 px-2.5 py-1 text-[10px] text-coral-400">🔁 {currentItem.lapses} lapse{currentItem.lapses > 1 ? "s" : ""}</span>
          )}
          {reviewPhase && (
            <span className="rounded-full border border-coral-300 bg-coral-50 px-2.5 py-1 text-[10px] text-coral-400">🔁 Review · {missedQueue.length} left</span>
          )}
        </div>

        {/* Topic badge */}
        {currentItem.topic && (
          <div className="mb-3 text-center">
            <span className="rounded-full bg-hub-bg px-3 py-1 text-[10px] font-medium text-hub-text-dim">{currentItem.topic}</span>
          </div>
        )}

        {/* MCQ items use the Streak Survival practice card (auto-graded via FSRS-6) */}
        {isMcqItem(currentItem) && currentItem.mcq ? (
          <div className="w-full">
            <PracticeMcqCard
              key={`${currentItem.resource?.id || "r"}:${currentItem.pageIndex}:${cardNonce}`}
              question={normalizeQuestion(currentItem.mcq, currentItem.pageIndex, currentItem.resource?.id, currentItem.itemType)}
              cardState={{
                state: currentItem.state,
                stability: currentItem.stability,
                dueAt: currentItem.dueAt,
                isDue: true,
              }}
              badge={reviewPhase ? "missed — try again" : undefined}
              onRated={handleMcqRated}
              onNext={handleMcqNext}
            />
          </div>
        ) : (
        /* Card content */
        <div className="w-full rounded-2xl border border-hub-border bg-hub-surface p-5 shadow-lg shadow-black/20">
          {(currentItem.subject || currentItem.resource?.title) && (
            <div className="mb-3 text-[10px] uppercase tracking-wider text-hub-text-dim">
              {currentItem.resource?.title}{currentItem.subject && currentItem.resource?.title ? " · " : ""}{currentItem.subject}
            </div>
          )}
          <div className="mb-4 text-[15px] font-bold leading-relaxed text-hub-text">
            {currentItem.flashcard?.front || currentItem.topic || "Review item"}
          </div>
          {showAnswer && currentItem.flashcard?.back && (
            <div className="rounded-xl border border-success-border bg-success-bg p-3 text-[13px] leading-relaxed text-success-text">
              {currentItem.flashcard.back}
            </div>
          )}

          {/* Action buttons inside card */}
          {!showAnswer && (
            <button onClick={() => setShowAnswer(true)} className="mt-4 w-full cursor-pointer rounded-xl bg-gold py-3 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-[0.98]">
              Show Answer
            </button>
          )}
        </div>
        )}

        {/* Rating buttons (non-MCQ items only — MCQs self-grade via PracticeMcqCard) */}
        {!isMcqItem(currentItem) && showAnswer && rating === null && (
          <div className="mt-4 grid w-full grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(g => (
              <button key={g} onClick={() => handleRate(g)} className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border py-3 transition-all active:scale-95" style={{
                background: g === 1 ? "#2a0a0a" : g === 2 ? "#2a1a0a" : g === 3 ? "#0a2a0a" : "#0a0a2a",
                borderColor: GRADE_LABELS[g].color,
              }}>
                <span className="text-[13px] font-bold" style={{ color: GRADE_LABELS[g].color }}>{GRADE_LABELS[g].label}</span>
                <span className="text-[9px] opacity-60" style={{ color: GRADE_LABELS[g].color }}>{GRADE_LABELS[g].desc}</span>
                <span className="text-[9px] opacity-40" style={{ color: GRADE_LABELS[g].color }}>{GRADE_LABELS[g].nextTime}</span>
              </button>
            ))}
          </div>
        )}

        {/* Rating feedback */}
        {!isMcqItem(currentItem) && rating !== null && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-hub-border bg-hub-surface px-4 py-2.5 text-[12px]" style={{ color: GRADE_LABELS[rating]?.color || "#888" }}>
            <span className="text-base">{rating <= 2 ? "😕" : rating === 3 ? "🙂" : "😎"}</span>
            Rated: {GRADE_LABELS[rating]?.label} · Next card…
          </div>
        )}
      </div>
    </div>
  );
}
