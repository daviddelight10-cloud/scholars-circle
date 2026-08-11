import { useState, useEffect, useCallback, useRef } from "react";

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

  // Page review AI questions state
  const [pageQuestions, setPageQuestions] = useState(null); // { questions: [...], pageIndex, resourceId }
  const [pageAnswers, setPageAnswers] = useState({}); // { questionId: selectedOption }
  const [pageQuestionsLoading, setPageQuestionsLoading] = useState(false);
  const [pageQuizSubmitted, setPageQuizSubmitted] = useState(false);
  const [pageQuizStep, setPageQuizStep] = useState("mcq"); // "mcq" | "sa_review" | "done"
  const [saAssessments, setSaAssessments] = useState({}); // { questionId: "yes"|"partial"|"no" }
  const [pageQuizResult, setPageQuizResult] = useState(null);
  const [fsrsStats, setFsrsStats] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Folder selection
  const [selectedFolder, setSelectedFolder] = useState(null); // null = show folder picker
  const [byFolder, setByFolder] = useState({});
  const [allItems, setAllItems] = useState([]);

  // Short-answer text answers
  const [saTextAnswers, setSaTextAnswers] = useState({}); // { questionId: typedText }

  // Scroll container ref for auto-scroll on item change
  const scrollRef = useRef(null);

  const fetchDue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/due?limit=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllItems(data.items || []);
        setByFolder(data.byFolder || {});
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

  const currentItem = items[currentIdx];

  // Fetch page questions when current item is a page
  useEffect(() => {
    if (!currentItem || currentItem.itemType !== "page") {
      setPageQuestions(null);
      setPageAnswers({});
      setPageQuizSubmitted(false);
      setPageQuizStep("mcq");
      setSaAssessments({});
      setPageQuizResult(null);
      return;
    }
    const resourceId = currentItem.resource?.id;
    const pageIndex = currentItem.pageIndex;
    if (!resourceId || pageIndex == null) return;

    setPageQuestionsLoading(true);
    setPageQuestions(null);
    setPageAnswers({});
    setSaTextAnswers({});
    setPageQuizSubmitted(false);
    setPageQuizStep("mcq");
    setSaAssessments({});
    setPageQuizResult(null);

    fetch(`${API_BASE}/api/resources/fsrs/page-questions/${resourceId}/${pageIndex}`, {
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          setPageQuestions(data);
        }
      })
      .catch(() => {})
      .finally(() => setPageQuestionsLoading(false));
  }, [currentItem]);

  const handlePageAnswer = (questionId, optionKey) => {
    if (pageQuizSubmitted) return;
    setPageAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  // Step 1: Submit MCQ answers, reveal results + SA model answers
  const handleSubmitPageQuiz = () => {
    if (!currentItem || pageQuizSubmitted) return;
    setPageQuizSubmitted(true);
    setPageQuizStep("sa_review");
  };

  // Step 2: Submit SA self-assessments + MCQ answers to rate endpoint
  const handleSubmitSaAssessment = async () => {
    if (!currentItem) return;
    const resourceId = currentItem.resource?.id;
    const pageIndex = currentItem.pageIndex;
    if (!resourceId || pageIndex == null) return;

    const mcqQuestions = (pageQuestions?.questions || []).filter((q) => q.questionType === "mcq");
    const saQuestions = (pageQuestions?.questions || []).filter((q) => q.questionType === "short_answer");
    const answers = mcqQuestions.map((q) => ({
      questionId: q.id,
      selectedAnswer: pageAnswers[q.id] || null,
    }));
    const saList = saQuestions.map((q) => ({
      questionId: q.id,
      rating: saAssessments[q.id] || "no",
    }));

    setPageQuizStep("done");

    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/page-questions/rate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ resourceId, pageIndex, answers, saAssessments: saList }),
      });
      if (res.ok) {
        const data = await res.json();
        setPageQuizResult(data);
        setSessionStats((prev) => ({
          ...prev,
          reviewed: prev.reviewed + 1,
          correct: prev.correct + (data.grade >= 3 ? 1 : 0),
        }));
      }
    } catch {}
  };

  const advanceToNext = () => {
    if (currentIdx + 1 >= items.length || sessionStats.reviewed + 1 >= dailyGoal) {
      setFinished(true);
      fetchFsrsStats();
      onComplete?.();
    } else {
      setCurrentIdx((i) => i + 1);
      setShowAnswer(false);
      setRating(null);
      setPageQuestions(null);
      setPageAnswers({});
      setSaTextAnswers({});
      setPageQuizSubmitted(false);
      setPageQuizStep("mcq");
      setSaAssessments({});
      setPageQuizResult(null);
    }
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
        fetchFsrsStats();
        onComplete?.();
      } else {
        setCurrentIdx(i => i + 1);
        setShowAnswer(false);
        setRating(null);
        setSaTextAnswers({});
      }
    }, 500);
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
              const pageCount = f.items.filter(i => i.itemType === "page").length;
              const mcqCount = f.items.filter(i => i.itemType === "mcq" || i.itemType === "legacy_mcq").length;
              const fcCount = f.items.filter(i => i.itemType === "flashcard").length;
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
                      {pageCount > 0 && <span className="rounded bg-hub-bg px-1.5 py-0.5">📖 {pageCount}</span>}
                      {mcqCount > 0 && <span className="rounded bg-hub-bg px-1.5 py-0.5">❓ {mcqCount}</span>}
                      {fcCount > 0 && <span className="rounded bg-hub-bg px-1.5 py-0.5">🃏 {fcCount}</span>}
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
                  <span className="text-[10px] text-hub-text-muted">📄 {fsrsStats.pdfCount} · ❓ {fsrsStats.mcqCount} · 🃏 {fsrsStats.flashcardCount}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-2">
          {Object.keys(byFolder).length > 1 && (
            <button onClick={() => { setFinished(false); setSelectedFolder(null); }} className="cursor-pointer rounded-xl border border-hub-border px-5 py-2.5 text-[12px] font-semibold text-hub-text-muted transition-all active:scale-95">← Folders</button>
          )}
          <button onClick={onBack} className="cursor-pointer rounded-xl bg-gold px-6 py-2.5 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-95">← Back to Hub</button>
        </div>
      </div>
    );
  }

  const typeIcon = { whole_pdf: "📄", page: "📖", flashcard: "🃏", mcq: "❓", legacy_mcq: "❓" }[currentItem?.itemType] || "📚";
  const typeLabel = { whole_pdf: "PDF Review", page: "Page Review", flashcard: "Flashcard", mcq: "MCQ", legacy_mcq: "MCQ" }[currentItem?.itemType] || "Review";

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
        </div>

        {/* Topic badge */}
        {currentItem.topic && (
          <div className="mb-3 text-center">
            <span className="rounded-full bg-hub-bg px-3 py-1 text-[10px] font-medium text-hub-text-dim">{currentItem.topic}</span>
          </div>
        )}

        {/* Card content */}
        <div className="w-full rounded-2xl border border-hub-border bg-hub-surface p-5 shadow-lg shadow-black/20">
          {currentItem.itemType === "flashcard" ? (
            <>
              {(currentItem.subject || currentItem.resource?.title) && (
                <div className="mb-3 text-[10px] uppercase tracking-wider text-hub-text-dim">
                  {currentItem.resource?.title}{currentItem.subject && currentItem.resource?.title ? " · " : ""}{currentItem.subject}
                </div>
              )}
              <div className="mb-4 text-[15px] font-bold leading-relaxed text-hub-text">
                {currentItem.flashcard?.front || "No front text"}
              </div>
              {showAnswer && (
                <div className="rounded-xl border border-success-border bg-success-bg p-3 text-[13px] leading-relaxed text-success-text">
                  {currentItem.flashcard?.back || "No back text"}
                </div>
              )}
            </>
          ) : currentItem.itemType === "mcq" || currentItem.itemType === "legacy_mcq" ? (
            <>
              <div className="mb-4 text-[14px] font-bold leading-relaxed text-hub-text">
                {currentItem.mcq?.question || currentItem.mcq?.q || `Question ${(currentItem.pageIndex || 0) + 1}`}
              </div>
              {showAnswer && currentItem.mcq?.options && (
                <div className="space-y-2">
                  {(() => {
                    const opts = currentItem.mcq.options;
                    const correctKey = currentItem.mcq?.correct ?? currentItem.mcq?.answer ?? null;
                    if (Array.isArray(opts)) {
                      return opts.map((opt, oi) => {
                        const isCorrect = String.fromCharCode(65 + oi) === correctKey || oi === (currentItem.mcq?.correctIndex ?? currentItem.mcq?.answer);
                        return (
                          <div key={oi} className={`flex items-start gap-2.5 rounded-xl border p-3 text-[12px] ${
                            isCorrect ? "border-success-border bg-success-bg text-success-text" : "border-hub-border bg-hub-bg text-hub-text-muted"
                          }`}>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              isCorrect ? "bg-[#22c55e] text-[#0a0a0a]" : "bg-hub-border text-hub-text-dim"
                            }`}>{String.fromCharCode(65 + oi)}</span>
                            <span className="pt-0.5">{opt}</span>
                          </div>
                        );
                      });
                    }
                    return Object.entries(opts).map(([key, val]) => {
                      const isCorrect = key === correctKey;
                      return (
                        <div key={key} className={`flex items-start gap-2.5 rounded-xl border p-3 text-[12px] ${
                          isCorrect ? "border-success-border bg-success-bg text-success-text" : "border-hub-border bg-hub-bg text-hub-text-muted"
                        }`}>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            isCorrect ? "bg-[#22c55e] text-[#0a0a0a]" : "bg-hub-border text-hub-text-dim"
                          }`}>{key}</span>
                          <span className="pt-0.5">{val}</span>
                        </div>
                      );
                    });
                  })()}
                  {currentItem.mcq?.explanation && (
                    <div className="rounded-xl bg-hub-bg p-3 text-[11px] italic leading-relaxed text-hub-text-dim">
                      {currentItem.mcq.explanation}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : currentItem.itemType === "page" && pageQuestions && pageQuestions.questions.length > 0 ? (
            <>
              <div className="mb-1 text-[14px] font-bold text-hub-text">
                {currentItem.resource?.title || "Review this content"}
              </div>
              <div className="mb-4 text-[11px] text-hub-text-dim">
                Page {currentItem.pageIndex}{currentItem.subject ? ` · ${currentItem.subject}` : ""}
              </div>

              {/* MCQ Questions */}
              <div className="space-y-3">
                {pageQuestions.questions.filter(q => q.questionType === "mcq").map((q, qi) => {
                  const selected = pageAnswers[q.id];
                  const isCorrect = pageQuizSubmitted && selected === q.correctAnswer;
                  const isWrong = pageQuizSubmitted && selected && selected !== q.correctAnswer;
                  const opts = q.options || {};
                  return (
                    <div key={q.id} className="rounded-xl border border-hub-border bg-hub-bg p-3">
                      <div className="mb-2.5 text-[12px] font-semibold leading-relaxed text-hub-text">
                        {qi + 1}. {q.question}
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(opts).map(([key, val]) => {
                          let borderCls = "border-hub-border";
                          let bgCls = "bg-hub-bg";
                          let textCls = "text-hub-text-muted";
                          let badgeBg = "bg-hub-border text-hub-text-dim";
                          if (pageQuizSubmitted) {
                            if (key === q.correctAnswer) { borderCls = "border-success-border"; bgCls = "bg-success-bg"; textCls = "text-success-text"; badgeBg = "bg-[#22c55e] text-[#0a0a0a]"; }
                            else if (key === selected) { borderCls = "border-coral-300"; bgCls = "bg-coral-50"; textCls = "text-coral-400"; badgeBg = "bg-[#ef4444] text-[#0a0a0a]"; }
                          } else if (key === selected) {
                            borderCls = "border-gold-border"; bgCls = "bg-gold-dim"; textCls = "text-gold"; badgeBg = "bg-gold text-[#0a0a0a]";
                          }
                          return (
                            <button
                              key={key}
                              onClick={() => handlePageAnswer(q.id, key)}
                              disabled={pageQuizSubmitted}
                              className={`flex w-full items-start gap-2.5 rounded-lg border ${borderCls} ${bgCls} p-2.5 text-left text-[11px] transition-all ${
                                pageQuizSubmitted ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
                              } ${textCls}`}
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${badgeBg}`}>{key}</span>
                              <span className="pt-0.5">{val}</span>
                              {pageQuizSubmitted && key === q.correctAnswer && <span className="ml-auto pt-0.5 text-[10px]">✓</span>}
                              {isWrong && key === selected && <span className="ml-auto pt-0.5 text-[10px]">✗</span>}
                            </button>
                          );
                        })}
                      </div>
                      {pageQuizSubmitted && q.explanation && (
                        <div className="mt-2 rounded-lg bg-hub-surface p-2 text-[10px] italic leading-relaxed text-hub-text-dim">{q.explanation}</div>
                      )}
                    </div>
                  );
                })}

                {/* Short-answer questions */}
                {pageQuestions.questions.filter(q => q.questionType === "short_answer").map((q, qi) => {
                  const saRating = saAssessments[q.id];
                  const saText = saTextAnswers[q.id] || "";
                  return (
                  <div key={q.id} className="rounded-xl border border-hub-border bg-hub-bg p-3">
                    <div className="mb-2.5 flex items-start gap-2 text-[12px] font-semibold leading-relaxed text-hub-text">
                      <span className="text-base">✏️</span>
                      <span>{q.question}</span>
                    </div>
                    {pageQuizSubmitted ? (
                      <>
                        {saText && (
                          <div className="mb-2 rounded-lg border border-hub-border bg-hub-surface p-2.5 text-[11px] leading-relaxed text-hub-text-muted">
                            <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-hub-text-dim">Your Answer</div>
                            {saText}
                          </div>
                        )}
                        <div className="rounded-lg border border-success-border bg-success-bg p-2.5 text-[11px] leading-relaxed text-success-text">
                          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider opacity-70">Model Answer</div>
                          {q.correctAnswer || "See explanation"}
                          {q.explanation && <div className="mt-1 text-[10px] opacity-70">{q.explanation}</div>}
                        </div>
                        {pageQuizStep === "sa_review" && (
                          <div className="mt-2.5">
                            <div className="mb-1.5 text-[10px] font-medium text-hub-text-dim">How well did you match?</div>
                            <div className="flex gap-2">
                              {[{ key: "yes", label: "✓ Got it", color: "#22c55e" }, { key: "partial", label: "◐ Partial", color: "#f59e0b" }, { key: "no", label: "✗ Missed", color: "#ef4444" }].map((opt) => (
                                <button
                                  key={opt.key}
                                  onClick={() => setSaAssessments(prev => ({ ...prev, [q.id]: opt.key }))}
                                  className="flex-1 cursor-pointer rounded-lg border py-1.5 text-[10px] font-semibold transition-all active:scale-95"
                                  style={{
                                    borderColor: saRating === opt.key ? opt.color : "transparent",
                                    background: saRating === opt.key ? `${opt.color}20` : "transparent",
                                    color: saRating === opt.key ? opt.color : "#666",
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <textarea
                        value={saText}
                        onChange={(e) => setSaTextAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Type your answer here (1-3 sentences)…"
                        rows={3}
                        className="w-full rounded-lg border border-hub-border bg-[#0a0a14] p-2.5 text-[11px] leading-relaxed text-hub-text placeholder:text-hub-text-dim focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 resize-none transition-colors"
                      />
                    )}
                  </div>
                );})}
              </div>

              {/* Quiz result */}
              {pageQuizResult && (
                <div className="mt-4 w-full rounded-xl p-4 text-center" style={{
                  background: pageQuizResult.grade >= 3 ? "#0a2a0a" : pageQuizResult.grade >= 2 ? "#2a1a0a" : "#2a0a0a",
                  border: `1px solid ${pageQuizResult.grade >= 3 ? "#22c55e" : pageQuizResult.grade >= 2 ? "#f59e0b" : "#ef4444"}`,
                }}>
                  <div className="text-lg font-extrabold" style={{ color: pageQuizResult.grade >= 3 ? "#22c55e" : pageQuizResult.grade >= 2 ? "#f59e0b" : "#ef4444" }}>
                    {pageQuizResult.combinedPct}% — {pageQuizResult.gradeLabel}
                  </div>
                  <div className="mt-1.5 flex items-center justify-center gap-3 text-[10px] text-hub-text-dim">
                    <span>MCQ: {pageQuizResult.mcqScore}/{pageQuizResult.mcqTotal}</span>
                    <span className="text-hub-border">|</span>
                    <span>SA: {pageQuizResult.saScore}%</span>
                    <span className="text-hub-border">|</span>
                    <span>Next: {pageQuizResult.intervalLabel}</span>
                  </div>
                </div>
              )}
            </>
          ) : currentItem.itemType === "page" && pageQuestionsLoading ? (
            <div className="flex flex-col items-center py-8">
              <div className="mb-1 text-[14px] font-bold text-hub-text">{currentItem.resource?.title || "Review this content"}</div>
              <div className="mb-4 text-[11px] text-hub-text-dim">Page {currentItem.pageIndex}</div>
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-hub-border border-t-gold" />
              <div className="mt-3 text-[11px] text-hub-text-dim">Loading questions…</div>
            </div>
          ) : (
            <>
              <div className="mb-1 text-[14px] font-bold text-hub-text">
                {currentItem.resource?.title || "Review this content"}
              </div>
              <div className="mb-4 text-[11px] text-hub-text-dim">
                {currentItem.itemType === "page" ? `Page ${currentItem.pageIndex}` : "Full document review"}
                {currentItem.subject ? ` · ${currentItem.subject}` : ""}
              </div>
              {onOpenPdf && currentItem.resource?.shareToken && (
                <button onClick={() => onOpenPdf(currentItem.resource.shareToken, currentItem.itemType === "page" ? currentItem.pageIndex : null)} className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-gold-border bg-gold-dim px-4 py-2.5 text-[12px] font-bold text-gold transition-all hover:bg-gold/20 active:scale-95">
                  <span>{currentItem.itemType === "page" ? "📖" : "📄"}</span>
                  {currentItem.itemType === "page" ? `Open Page ${currentItem.pageIndex}` : "Open Document"}
                </button>
              )}
              {showAnswer && (
                <div className="rounded-xl bg-hub-bg p-3 text-[12px] leading-relaxed text-hub-text-muted">
                  How well did you remember the key concepts from this {currentItem.itemType === "page" ? "page" : "document"}? Rate your recall below.
                </div>
              )}
            </>
          )}

          {/* Action buttons inside card */}
          {currentItem.itemType === "page" && pageQuestions && pageQuestions.questions.length > 0 ? (
            <>
              {!pageQuizSubmitted && (
                <button onClick={handleSubmitPageQuiz}
                  className="mt-4 w-full cursor-pointer rounded-xl bg-gold py-3 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-[0.98]">
                  Submit Answers
                </button>
              )}
              {pageQuizStep === "sa_review" && (
                <button onClick={handleSubmitSaAssessment}
                  className="mt-4 w-full cursor-pointer rounded-xl bg-gold py-3 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-[0.98]">
                  Submit Assessment
                </button>
              )}
            </>
          ) : (
            !showAnswer && (
              <button onClick={() => setShowAnswer(true)} className="mt-4 w-full cursor-pointer rounded-xl bg-gold py-3 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-[0.98]">
                {currentItem.itemType === "flashcard" || currentItem.itemType === "mcq" || currentItem.itemType === "legacy_mcq" ? "Show Answer" : "Reveal & Rate"}
              </button>
            )
          )}
        </div>

        {/* Rating buttons (non-page items or fallback) */}
        {showAnswer && rating === null && !(currentItem.itemType === "page" && pageQuestions && pageQuestions.questions.length > 0) && (
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
        {rating !== null && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-hub-border bg-hub-surface px-4 py-2.5 text-[12px]" style={{ color: GRADE_LABELS[rating]?.color || "#888" }}>
            <span className="text-base">{rating <= 2 ? "😕" : rating === 3 ? "🙂" : "😎"}</span>
            Rated: {GRADE_LABELS[rating]?.label} · Next card…
          </div>
        )}

        {/* Next button for page quiz */}
        {pageQuizStep === "done" && currentItem.itemType === "page" && (
          <button onClick={advanceToNext} className="mt-4 w-full cursor-pointer rounded-xl bg-gold py-3 text-[12px] font-bold text-[#0a0a0a] transition-all active:scale-[0.98]">
            {currentIdx + 1 >= items.length || sessionStats.reviewed >= dailyGoal ? "Finish Session ✓" : "Next →"}
          </button>
        )}
      </div>
    </div>
  );
}
