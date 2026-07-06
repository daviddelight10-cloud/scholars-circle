import { useState, useMemo } from "react";
import { colors, spacing, fontSize, fontWeight, sharedStyles, goldDim, goldBorder, goldText } from "./constants";
import ResourceCard from "./ResourceCard";

const TYPE_FILTERS = [
  { key: "all", label: "All", icon: "📚" },
  { key: "pdf", label: "PDFs", icon: "📄" },
  { key: "mcq", label: "MCQs", icon: "❓" },
  { key: "flashcard_deck", label: "Flashcards", icon: "🃏" },
  { key: "note", label: "Notes", icon: "📝" },
];

export default function SubjectDetailView({ subject, level, resources, fsrsSubjectStats, onBack, onOpen, onToggleBookmark, onShare, bookmarkedIds, bookmarkBusyId, mcqProgress, onStudySubject }) {
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

  const dueCount = fsrsSubjectStats?.due || 0;
  const masteredCount = fsrsSubjectStats?.mastered || 0;
  const totalCount = fsrsSubjectStats?.total || 0;
  const masteryPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={sharedStyles.backBtn}>← Back to Library</button>

      {/* Subject header */}
      <div style={{
        background: colors.surface, border: `0.5px solid ${colors.border}`,
        borderRadius: "16px", padding: spacing.xl, marginBottom: spacing.xl,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: spacing.md }}>
          <div>
            <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: goldText, marginBottom: spacing.xs }}>
              {subject}
            </div>
            {level && (
              <div style={{ fontSize: fontSize.base, color: colors.textMuted }}>{level} Level</div>
            )}
          </div>
          {dueCount > 0 && (
            <button onClick={onStudySubject} style={{
              padding: "10px 20px", borderRadius: "24px", cursor: "pointer",
              background: goldDim, border: `0.5px solid ${goldBorder}`,
              color: goldText, fontSize: fontSize.sm, fontWeight: fontWeight.bold,
              display: "flex", alignItems: "center", gap: spacing.sm,
            }}>
              🔁 Study {dueCount} due
            </button>
          )}
        </div>

        {/* Stats row */}
        {totalCount > 0 && (
          <div style={{ display: "flex", gap: spacing.lg, marginTop: spacing.lg, flexWrap: "wrap" }}>
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              <span style={{ fontWeight: fontWeight.bold, color: colors.text }}>{resources.length}</span> materials
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              <span style={{ fontWeight: fontWeight.bold, color: colors.text }}>{totalCount}</span> FSRS items
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              <span style={{ fontWeight: fontWeight.bold, color: dueCount > 0 ? "#ef4444" : colors.textMuted }}>{dueCount}</span> due
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              <span style={{ fontWeight: fontWeight.bold, color: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : colors.textMuted }}>{masteredCount}</span> mastered ({masteryPct}%)
            </div>
          </div>
        )}
      </div>

      {/* Type filters + search */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
          {TYPE_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              style={typeFilter === f.key ? sharedStyles.chipActive : sharedStyles.chip}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>
        <div style={{ ...sharedStyles.searchWrap, flex: "1 1 200px", minHeight: "40px" }}>
          <span style={{ color: "#3a3d60", fontSize: fontSize.lg }}>🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search in ${subject}…`}
            style={sharedStyles.searchInput} />
        </div>
      </div>

      {/* Resource grid */}
      {filtered.length === 0 ? (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>📭</div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
            No materials found
          </div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim }}>
            {search ? `No results for "${search}"` : `No ${typeFilter !== "all" ? TYPE_FILTERS.find(f => f.key === typeFilter)?.label.toLowerCase() : "materials"} in ${subject} yet`}
          </div>
        </div>
      ) : (
        <div style={sharedStyles.grid}>
          {filtered.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              isBookmarked={bookmarkedIds?.has(resource.id) || false}
              bookmarkBusy={bookmarkBusyId === resource.id}
              onOpen={onOpen}
              onToggleBookmark={onToggleBookmark}
              onShare={onShare}
              mcqProgress={mcqProgress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
