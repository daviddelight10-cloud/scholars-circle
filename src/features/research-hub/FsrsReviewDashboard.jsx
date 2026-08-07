const TYPE_ICON = { whole_pdf: "📄", page: "📖", flashcard: "🃏", mcq: "❓", legacy_mcq: "❓" };
const TYPE_LABEL = { whole_pdf: "PDF Review", page: "Page Review", flashcard: "Flashcard", mcq: "MCQ", legacy_mcq: "MCQ" };

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
          Open any PDF, practice MCQs, or study flashcards in the Research Hub. The FSRS algorithm will schedule when to revisit each item for optimal retention.
        </div>
      </div>
    );
  }

  const items = fsrsDue?.items || [];

  const wholePdfs = items.filter((i) => i.itemType === "whole_pdf");
  const pages = items.filter((i) => i.itemType === "page");
  const flashcards = items.filter((i) => i.itemType === "flashcard");
  const mcqs = items.filter((i) => i.itemType === "mcq" || i.itemType === "legacy_mcq");

  const duePagesByResource = new Map();
  for (const p of pages) {
    const key = p.resource?.id || "unknown";
    if (!duePagesByResource.has(key)) duePagesByResource.set(key, { resource: p.resource, pages: [] });
    duePagesByResource.get(key).pages.push(p);
  }

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

      {wholePdfs.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">PDFs to Re-read</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {wholePdfs.map((item) => (
              <div key={item.id} className="cursor-pointer rounded-xl border border-hub-border bg-hub-surface p-3 transition-colors" onClick={() => onOpenPdf(item.resource?.shareToken)}>
                <div className="mb-1.5 text-sm font-bold text-hub-text">{item.resource?.title}</div>
                <div className="text-[11px] text-hub-text-dim">{item.resource?.subject}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[#ef4444]">Due now</span>
                  <span className="text-[10px] text-hub-text-dim">Reps: {item.reps}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {duePagesByResource.size > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">Pages to Review</div>
          {Array.from(duePagesByResource.entries()).map(([resId, group]) => (
            <div key={resId} className="mb-2.5 rounded-xl border border-hub-border bg-hub-surface p-3">
              <div className="mb-2 text-sm font-bold text-hub-text">{group.resource?.title}</div>
              <div className="flex flex-wrap gap-1.5">
                {group.pages.map((p) => (
                  <button key={p.id} onClick={() => onOpenPdf(group.resource?.shareToken, p.pageIndex)}
                    className="cursor-pointer rounded-lg border border-gold-border bg-gold-dim px-3 py-1.5 text-[11px] font-semibold text-gold transition-all active:scale-95">
                    p.{p.pageIndex}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
