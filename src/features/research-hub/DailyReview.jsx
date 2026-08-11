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

  // ── Folder Selection Screen ──
  if (!selectedFolder) {
    const folderEntries = Object.entries(byFolder).sort((a, b) => b[1].dueCount - a[1].dueCount);
    const totalDue = allItems.length;
    return (
      <div className="mx-auto flex h-full w-full max-w-[600px] flex-col">
        <div className="shrink-0 border-b border-hub-border p-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="cursor-pointer text-[11px] text-hub-text-muted">← Back</button>
            <span className="text-[11px] font-semibold text-hub-text-muted">{totalDue} items due</span>
            <span className="text-[10px] text-hub-text-dim">Daily Review</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4 text-center">
            <div className="text-lg font-bold text-hub-text">📚 Daily Review</div>
            <div className="mt-1 text-[11px] text-hub-text-dim">Select a folder to review its due items</div>
          </div>

          {/* All folders button */}
          {folderEntries.length > 1 && (
            <button
              onClick={() => setSelectedFolder("__all__")}
              className="mb-3 w-full cursor-pointer rounded-xl border border-gold-border bg-gold-dim p-4 text-left transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gold">📋 All Folders</span>
                <span className="rounded-full bg-gold-dim px-2 py-0.5 text-[11px] font-bold text-gold">{totalDue} due</span>
              </div>
              <div className="mt-1 text-[10px] text-hub-text-dim">Review items from all folders</div>
            </button>
          )}

          {/* Individual folder cards */}
          <div className="space-y-2">
            {folderEntries.map(([key, f]) => (
              <button
                key={key}
                onClick={() => setSelectedFolder(key)}
                className="w-full cursor-pointer rounded-xl border border-hub-border bg-[#0d0f20] p-4 text-left transition-all hover:border-hub-text-dim active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-hub-text">
                    {key === "__unfiled__" ? "📁 Unfiled" : `📁 ${f.folderName}`}
                  </span>
                  <span className="rounded-full bg-hub-bg px-2 py-0.5 text-[11px] font-bold text-hub-text-muted">{f.dueCount} due</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-hub-text-dim">
                  <span>{f.items.filter(i => i.itemType === "page").length} pages</span>
                  <span>·</span>
                  <span>{f.items.filter(i => i.itemType === "mcq" || i.itemType === "legacy_mcq").length} MCQs</span>
                  <span>·</span>
                  <span>{f.items.filter(i => i.itemType === "flashcard").length} flashcards</span>
                </div>
              </button>
            ))}
          </div>

          {folderEntries.length === 0 && (
            <div className="py-10 text-center">
              <div className="mb-2 text-4xl">✅</div>
              <div className="text-sm text-hub-text-dim">No items due for review.</div>
            </div>
          )}
        </div>
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

        {/* Mini analytics on caught-up screen */}
        {fsrsStats && (
          <div className="mx-auto mt-4 flex max-w-[360px] justify-center gap-4 rounded-xl border border-hub-border bg-[#0d0f20] p-3">
            <div className="text-center">
              <div className="text-base font-bold text-hub-text">{fsrsStats.totalItems}</div>
              <div className="text-[9px] text-hub-text-dim">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-[#7986cb]">{fsrsStats.masteredCount}</div>
              <div className="text-[9px] text-hub-text-dim">Mastered</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-gold">🔥 {fsrsStats.streak}</div>
              <div className="text-[9px] text-hub-text-dim">Day Streak</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center gap-2">
          {Object.keys(byFolder).length > 1 && (
            <button onClick={() => setSelectedFolder(null)} className="cursor-pointer rounded-lg border border-hub-border px-5 py-2.5 text-[11px] text-hub-text-muted transition-all active:scale-95">← Folders</button>
          )}
          <button onClick={onBack} className="cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">← Back to Hub</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;
    const retentionPct = fsrsStats ? Math.round(fsrsStats.avgRetrievability * 100) : null;
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

        {/* Analytics Dashboard */}
        {fsrsStats && (
          <div className="mx-auto mb-4 max-w-[420px] rounded-xl border border-hub-border bg-[#0d0f20] p-4 text-left">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-hub-text">📊 FSRS Analytics</span>
              <button onClick={() => setShowAnalytics(s => !s)} className="cursor-pointer text-[10px] text-gold">{showAnalytics ? "Hide" : "Details"}</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-sm font-bold text-hub-text">{fsrsStats.totalItems}</div>
                <div className="text-[9px] text-hub-text-dim">Total</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold" style={{ color: retentionPct != null && retentionPct >= 85 ? "#22c55e" : "#f59e0b" }}>{retentionPct != null ? `${retentionPct}%` : "—"}</div>
                <div className="text-[9px] text-hub-text-dim">Retention</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-[#7986cb]">{fsrsStats.masteredCount}</div>
                <div className="text-[9px] text-hub-text-dim">Mastered</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-[#f59e0b]">{fsrsStats.dueCount}</div>
                <div className="text-[9px] text-hub-text-dim">Due</div>
              </div>
            </div>
            {showAnalytics && (
              <div className="mt-3 space-y-2 border-t border-hub-border pt-3">
                {/* State breakdown */}
                <div>
                  <div className="mb-1 text-[10px] font-semibold text-hub-text-dim">Card States</div>
                  <div className="flex gap-1.5">
                    <span className="rounded bg-hub-bg px-2 py-0.5 text-[9px] text-hub-text-muted">🆕 {fsrsStats.newCount} new</span>
                    <span className="rounded bg-hub-bg px-2 py-0.5 text-[9px] text-hub-text-muted">📖 {fsrsStats.learningCount} learning</span>
                    <span className="rounded bg-hub-bg px-2 py-0.5 text-[9px] text-hub-text-muted">🔄 {fsrsStats.reviewCount} review</span>
                    <span className="rounded bg-hub-bg px-2 py-0.5 text-[9px] text-hub-text-muted">🏆 {fsrsStats.masteredCount} mastered</span>
                  </div>
                </div>
                {/* Streak */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-hub-text-dim">🔥 Streak</span>
                  <span className="text-[10px] font-bold text-gold">{fsrsStats.streak} days (best: {fsrsStats.longestStreak})</span>
                </div>
                {/* By subject */}
                {fsrsStats.bySubject && Object.keys(fsrsStats.bySubject).length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold text-hub-text-dim">By Subject</div>
                    <div className="space-y-1">
                      {Object.entries(fsrsStats.bySubject).slice(0, 5).map(([subj, s]) => (
                        <div key={subj} className="flex items-center justify-between text-[9px]">
                          <span className="text-hub-text-muted">{subj}</span>
                          <span className="text-hub-text-dim">{s.total} items · {s.due} due · {s.mastered} mastered</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Item type breakdown */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-hub-text-dim">Item Types</span>
                  <span className="text-[9px] text-hub-text-muted">📄 {fsrsStats.pdfCount} · ❓ {fsrsStats.mcqCount} · 🃏 {fsrsStats.flashcardCount}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-center gap-2">
          {Object.keys(byFolder).length > 1 && (
            <button onClick={() => { setFinished(false); setSelectedFolder(null); }} className="cursor-pointer rounded-lg border border-hub-border px-5 py-2.5 text-[11px] text-hub-text-muted transition-all active:scale-95">← Folders</button>
          )}
          <button onClick={onBack} className="cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">← Back to Hub</button>
        </div>
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
          <button onClick={() => setSelectedFolder(null)} className="cursor-pointer text-[11px] text-hub-text-muted">← Folders</button>
          <span className="text-[11px] font-semibold text-hub-text-muted">
            {sessionStats.reviewed}/{sessionStats.total} · Goal: {dailyGoal}
          </span>
          <span className="text-[10px] text-hub-text-dim">
            {selectedFolder === "__all__" ? "All" : byFolder[selectedFolder]?.folderName || "Review"}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-hub-bg">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-[#22c55e] transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Card */}
      <div ref={scrollRef} className="flex flex-1 flex-col items-center overflow-auto p-4 pt-6">
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
          ) : currentItem.itemType === "page" && pageQuestions && pageQuestions.questions.length > 0 ? (
            <>
              <div className="mb-2 text-sm font-bold text-hub-text">
                {currentItem.resource?.title || "Review this content"}
              </div>
              <div className="mb-3 text-[11px] text-hub-text-dim">
                Page {currentItem.pageIndex}{currentItem.subject ? ` · ${currentItem.subject}` : ""}
              </div>

              {/* MCQ Questions */}
              <div className="w-full text-left space-y-4">
                {pageQuestions.questions.filter(q => q.questionType === "mcq").map((q, qi) => {
                  const selected = pageAnswers[q.id];
                  const isCorrect = pageQuizSubmitted && selected === q.correctAnswer;
                  const isWrong = pageQuizSubmitted && selected && selected !== q.correctAnswer;
                  const opts = q.options || {};
                  return (
                    <div key={q.id} className="rounded-lg border border-hub-border bg-hub-bg p-3">
                      <div className="mb-2 text-[11px] font-semibold text-hub-text">
                        {qi + 1}. {q.question}
                      </div>
                      <div className="space-y-1">
                        {Object.entries(opts).map(([key, val]) => {
                          let borderColor = "border-hub-border";
                          let bg = "bg-hub-bg";
                          if (pageQuizSubmitted) {
                            if (key === q.correctAnswer) { borderColor = "border-[#22c55e]"; bg = "bg-[#0f2a1a]"; }
                            else if (key === selected) { borderColor = "border-[#ef4444]"; bg = "bg-[#2a0a0a]"; }
                          } else if (key === selected) {
                            borderColor = "border-gold-border"; bg = "bg-gold-dim";
                          }
                          return (
                            <button
                              key={key}
                              onClick={() => handlePageAnswer(q.id, key)}
                              disabled={pageQuizSubmitted}
                              className={`w-full rounded-lg border ${borderColor} ${bg} p-2 px-3 text-left text-[11px] transition-all ${
                                pageQuizSubmitted ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
                              } ${selected === key && !pageQuizSubmitted ? "text-gold" : pageQuizSubmitted && key === q.correctAnswer ? "text-[#a5d6a7]" : pageQuizSubmitted && key === selected ? "text-[#ef9a9a]" : "text-hub-text-muted"}`}
                            >
                              <span className="font-bold mr-1.5">{key}.</span> {val}
                              {pageQuizSubmitted && key === q.correctAnswer && <span className="ml-1 text-[10px]">✓</span>}
                              {isWrong && key === selected && <span className="ml-1 text-[10px]">✗</span>}
                            </button>
                          );
                        })}
                      </div>
                      {pageQuizSubmitted && q.explanation && (
                        <div className="mt-2 text-[10px] italic text-hub-text-dim">{q.explanation}</div>
                      )}
                    </div>
                  );
                })}

                {/* Short-answer questions */}
                {pageQuestions.questions.filter(q => q.questionType === "short_answer").map((q, qi) => {
                  const saRating = saAssessments[q.id];
                  const saText = saTextAnswers[q.id] || "";
                  return (
                  <div key={q.id} className="rounded-lg border border-hub-border bg-hub-bg p-3">
                    <div className="mb-2 text-[11px] font-semibold text-hub-text">
                      ✏️ {q.question}
                    </div>
                    {pageQuizSubmitted ? (
                      <>
                        {saText && (
                          <div className="mb-2 rounded-lg bg-hub-bg p-2 text-[11px] text-hub-text-muted border border-hub-border">
                            <span className="font-bold text-[10px] uppercase text-hub-text-dim">Your Answer:</span> {saText}
                          </div>
                        )}
                        <div className="rounded-lg bg-[#0f2a1a] border border-[#22c55e] p-2 text-[11px] text-[#a5d6a7]">
                          <span className="font-bold text-[10px] uppercase">Model Answer:</span> {q.correctAnswer || "See explanation"}
                          {q.explanation && <div className="mt-1 text-[10px] opacity-70">{q.explanation}</div>}
                        </div>
                        {pageQuizStep === "sa_review" && (
                          <div className="mt-2">
                            <div className="mb-1 text-[10px] text-hub-text-dim">Did your answer match?</div>
                            <div className="flex gap-1.5">
                              {[{ key: "yes", label: "Yes", color: "#22c55e" }, { key: "partial", label: "Partially", color: "#f59e0b" }, { key: "no", label: "No", color: "#ef4444" }].map((opt) => (
                                <button
                                  key={opt.key}
                                  onClick={() => setSaAssessments(prev => ({ ...prev, [q.id]: opt.key }))}
                                  className="cursor-pointer rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95"
                                  style={{
                                    borderColor: saRating === opt.key ? opt.color : "transparent",
                                    background: saRating === opt.key ? `${opt.color}20` : "transparent",
                                    color: saRating === opt.key ? opt.color : "#888",
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
                        className="w-full rounded-lg border border-hub-border bg-[#0a0a14] p-2.5 text-[11px] text-hub-text placeholder:text-hub-text-dim focus:border-gold-border focus:outline-none resize-none"
                      />
                    )}
                  </div>
                );})}
              </div>

              {/* Quiz result */}
              {pageQuizResult && (
                <div className="mt-4 w-full rounded-lg p-3 text-center" style={{
                  background: pageQuizResult.grade >= 3 ? "#0a2a0a" : pageQuizResult.grade >= 2 ? "#2a1a0a" : "#2a0a0a",
                  border: `0.5px solid ${pageQuizResult.grade >= 3 ? "#22c55e" : pageQuizResult.grade >= 2 ? "#f59e0b" : "#ef4444"}`,
                }}>
                  <div className="text-sm font-bold" style={{ color: pageQuizResult.grade >= 3 ? "#22c55e" : pageQuizResult.grade >= 2 ? "#f59e0b" : "#ef4444" }}>
                    {pageQuizResult.combinedPct}% — {pageQuizResult.gradeLabel}
                  </div>
                  <div className="mt-1 text-[10px] text-hub-text-dim">
                    MCQ: {pageQuizResult.mcqScore}/{pageQuizResult.mcqTotal} ({pageQuizResult.mcqPct}%) · SA: {pageQuizResult.saScore}% · Next: {pageQuizResult.intervalLabel}
                  </div>
                </div>
              )}
            </>
          ) : currentItem.itemType === "page" && pageQuestionsLoading ? (
            <>
              <div className="mb-2 text-sm font-bold text-hub-text">
                {currentItem.resource?.title || "Review this content"}
              </div>
              <div className="mb-3 text-[11px] text-hub-text-dim">
                Page {currentItem.pageIndex}
              </div>
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-hub-border border-t-gold" />
              <div className="mt-2 text-[11px] text-hub-text-dim">Loading questions…</div>
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

          {/* Show Answer / Submit Quiz / Submit Assessment buttons */}
          {currentItem.itemType === "page" && pageQuestions && pageQuestions.questions.length > 0 ? (
            <>
              {!pageQuizSubmitted && (
                <button onClick={handleSubmitPageQuiz}
                  className="mt-4 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">
                  Submit Answers
                </button>
              )}
              {pageQuizStep === "sa_review" && (
                <button onClick={handleSubmitSaAssessment}
                  className="mt-4 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">
                  Submit Assessment
                </button>
              )}
            </>
          ) : (
            !showAnswer && (
              <button onClick={() => setShowAnswer(true)} className="mt-4 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">
                {currentItem.itemType === "flashcard" || currentItem.itemType === "mcq" || currentItem.itemType === "legacy_mcq" ? "Show Answer" : "Reveal & Rate"}
              </button>
            )
          )}
        </div>

        {/* Rating buttons (non-page items or fallback) */}
        {showAnswer && rating === null && !(currentItem.itemType === "page" && pageQuestions && pageQuestions.questions.length > 0) && (
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

        {/* Next button for page quiz */}
        {pageQuizStep === "done" && currentItem.itemType === "page" && (
          <button onClick={advanceToNext} className="mt-4 cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-6 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">
            {currentIdx + 1 >= items.length || sessionStats.reviewed >= dailyGoal ? "Finish" : "Next →"}
          </button>
        )}
      </div>
    </div>
  );
}
