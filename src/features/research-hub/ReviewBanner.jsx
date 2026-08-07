export default function ReviewBanner({ reviewData, reviewStats, onReview }) {
  if (!reviewData || reviewData.total === 0) return null;
  const dueCount = reviewData.due.length;
  const avgEF = reviewStats?.avgEasinessFactor;
  const mastered = reviewStats?.masteredCount;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 px-4 ${
        dueCount > 0
          ? "border-gold-border bg-gradient-to-br from-[#1a1a00] to-[#0d0d00] shadow-[0_2px_12px_rgba(255,215,0,0.1)]"
          : "border-hub-border bg-hub-surface"
      }`}
    >
      <div>
        <div className={`text-sm font-bold ${dueCount > 0 ? "text-gold" : "text-hub-text-muted"}`}>
          {dueCount > 0 ? `📚 ${dueCount} question${dueCount > 1 ? "s" : ""} due for review` : `📅 ${reviewData.total} question${reviewData.total > 1 ? "s" : ""} in review queue`}
        </div>
        <div className="mt-0.5 text-[11px] text-hub-text-dim">
          {dueCount > 0 ? "SM-2 spaced repetition — review now while it's fresh" : "Upcoming reviews — we'll remind you when they're due"}
          {avgEF != null && <span className="ml-2 text-[#555]">EF: {avgEF}</span>}
          {mastered != null && mastered > 0 && <span className="ml-2 text-success">✓ {mastered} mastered</span>}
        </div>
      </div>
      <button
        onClick={onReview}
        className={`rounded-full border px-4 py-2 text-[11px] font-bold transition-all active:scale-95 ${
          dueCount > 0
            ? "border-gold-border bg-gold-dim text-gold"
            : "border-hub-border bg-[#111] text-hub-text-muted"
        }`}
      >
        {dueCount > 0 ? "Review now →" : "Practice early"}
      </button>
    </div>
  );
}
