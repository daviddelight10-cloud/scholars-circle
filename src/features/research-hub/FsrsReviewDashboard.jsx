export default function FsrsReviewDashboard({ fsrsDue, fsrsStats, onOpenPdf }) {
  if (!fsrsStats) return <div className="px-5 py-14 text-center text-sm text-hub-text-dim">Loading FSRS review data...</div>;

  const { totalItems, dueCount, learningCount, masteredCount, streak } = fsrsStats;
  const masteryPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;

  if (totalItems === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <div className="mb-3 text-5xl">📚</div>
        <div className="mb-1 text-base font-bold text-hub-text-muted">No review items yet</div>
        <div className="mx-auto max-w-[400px] text-[13px] leading-relaxed text-hub-text-dim">
          Practice MCQs or study flashcards in the Research Hub. The FSRS algorithm will schedule when to revisit each item for optimal retention.
        </div>
      </div>
    );
  }

  const items = fsrsDue?.items || [];

  const flashcards = items.filter((i) => i.itemType === "flashcard");
  const mcqs = items.filter((i) => i.itemType === "mcq" || i.itemType === "legacy_mcq");

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-3">
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold" style={{ color: dueCount > 0 ? "#ef4444" : "#888" }}>{dueCount}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Due now</div>
        </div>
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold text-[#f59e0b]">{learningCount}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Learning</div>
        </div>
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold text-[#22c55e]">{masteredCount}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Mastered</div>
        </div>
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold text-gold">{totalItems}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Total items</div>
        </div>
        {streak > 0 && (
          <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
            <div className="text-xl font-extrabold text-[#ff7043]">{streak}</div>
            <div className="mt-0.5 text-[10px] text-hub-text-dim">Day streak</div>
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-1.5 flex justify-between">
          <span className="text-[11px] font-semibold text-hub-text-muted">Mastery Progress</span>
          <span className="text-[11px] font-bold text-[#22c55e]">{masteredCount}/{totalItems} ({masteryPct}%)</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-hub-bg">
          <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#4caf50] transition-all duration-300" style={{ width: `${masteryPct}%` }} />
        </div>
      </div>

      {flashcards.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">Flashcards Due</div>
          <div className="rounded-xl border border-hub-border bg-hub-surface p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-hub-text">{flashcards.length} flashcard{flashcards.length > 1 ? "s" : ""} due</div>
                <div className="mt-0.5 text-[11px] text-hub-text-dim">
                  Across {new Set(flashcards.map((f) => f.resource?.id)).size} resource{new Set(flashcards.map((f) => f.resource?.id)).size > 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => {
                const first = flashcards[0];
                if (first?.resource?.shareToken) onOpenPdf(first.resource.shareToken);
              }}
                className="cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-4 py-2 text-[11px] font-bold text-gold transition-all active:scale-95">
                Start Review →
              </button>
            </div>
          </div>
        </div>
      )}

      {mcqs.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">MCQs Due</div>
          <div className="rounded-xl border border-hub-border bg-hub-surface p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-hub-text">{mcqs.length} MCQ{mcqs.length > 1 ? "s" : ""} due</div>
                <div className="mt-0.5 text-[11px] text-hub-text-dim">
                  Across {new Set(mcqs.map((m) => m.resource?.id)).size} resource{new Set(mcqs.map((m) => m.resource?.id)).size > 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => {
                const first = mcqs[0];
                if (first?.resource?.shareToken) onOpenPdf(first.resource.shareToken);
              }}
                className="cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-4 py-2 text-[11px] font-bold text-gold transition-all active:scale-95">
                Practice →
              </button>
            </div>
          </div>
        </div>
      )}

      {dueCount === 0 && totalItems > 0 && (
        <div className="px-5 py-10 text-center">
          <div className="mb-2 text-4xl">✅</div>
          <div className="text-sm font-bold text-[#22c55e]">All caught up!</div>
          <div className="mt-1 text-[11px] text-hub-text-dim">No items due for review right now. Come back later.</div>
        </div>
      )}
    </div>
  );
}
