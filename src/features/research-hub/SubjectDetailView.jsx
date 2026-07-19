import { useState, useMemo } from "react";
import { getSubjectColor } from "./subjectColors";
import ResourceCard from "./ResourceCard";
import EmptyState from "./EmptyState";

const TYPE_FILTERS = [
  { key: "all", label: "All", icon: "📚" },
  { key: "pdf", label: "PDFs", icon: "📄" },
  { key: "mcq", label: "MCQs", icon: "❓" },
  { key: "flashcard_deck", label: "Flashcards", icon: "🃏" },
  { key: "note", label: "Notes", icon: "📝" },
];

export default function SubjectDetailView({ subject, level, resources, fsrsSubjectStats, onBack, onOpen, onToggleBookmark, onShare, bookmarkedIds, bookmarkBusyId, mcqProgress, onStudySubject, backLabel = "Library" }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = resources;
    if (typeFilter !== "all") {
      result = result.filter((r) => r.contentType === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.title?.toLowerCase().includes(q));
    }
    return result;
  }, [resources, typeFilter, search]);

  const sc = getSubjectColor(subject);
  const dueCount = fsrsSubjectStats?.due || 0;
  const masteredCount = fsrsSubjectStats?.mastered || 0;
  const totalCount = fsrsSubjectStats?.total || 0;
  const masteryPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  return (
    <div>
      <button onClick={onBack} className="mb-8 flex items-center gap-2 rounded-lg border border-hub-border bg-hub-bg px-3 py-2 text-[13px] text-hub-text-muted transition-all active:scale-95">
        ← Back to {backLabel}
      </button>

      <div className="mb-8 rounded-2xl border border-hub-border bg-hub-surface p-6" style={{ borderLeftWidth: "3px", borderLeftColor: sc.accent }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-2xl font-extrabold" style={{ color: sc.text }}>{subject}</div>
            {level && (
              <div className="text-[13px] text-hub-text-muted">{level} Level</div>
            )}
          </div>
          {dueCount > 0 && onStudySubject && (
            <button onClick={onStudySubject} className="flex items-center gap-2 rounded-full border border-gold-border bg-gold-dim px-5 py-2.5 text-[11px] font-bold text-gold transition-all active:scale-95">
              🔁 Study {dueCount} due
            </button>
          )}
        </div>

        {totalCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-hub-text-muted">
            <div><span className="font-bold text-hub-text">{resources.length}</span> materials</div>
            <div><span className="font-bold text-hub-text">{totalCount}</span> FSRS items</div>
            <div><span className="font-bold" style={{ color: dueCount > 0 ? "#ef4444" : "#888" }}>{dueCount}</span> due</div>
            <div><span className="font-bold" style={{ color: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : "#888" }}>{masteredCount}</span> mastered ({masteryPct}%)</div>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
                typeFilter === f.key
                  ? "border border-gold-border bg-gold-dim text-gold"
                  : "border border-hub-border bg-hub-bg text-hub-text-muted"
              }`}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>
        <div className="flex min-h-[40px] flex-1 items-center gap-3 rounded-full border border-hub-border bg-hub-bg px-4 py-2">
          <span className="text-lg text-hub-text-dim">🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search in ${subject}…`}
            className="flex-1 border-none bg-none text-sm text-hub-text outline-none placeholder:text-hub-text-dim" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No materials found"
          message={search ? `No results for "${search}"` : `No ${typeFilter !== "all" ? TYPE_FILTERS.find(f => f.key === typeFilter)?.label.toLowerCase() : "materials"} in ${subject} yet`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((resource, i) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              isBookmarked={bookmarkedIds?.has(resource.id) || false}
              bookmarkBusy={bookmarkBusyId === resource.id}
              onOpen={onOpen}
              onToggleBookmark={onToggleBookmark}
              onShare={onShare}
              mcqProgress={mcqProgress}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
