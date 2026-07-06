import { useState, useMemo } from "react";
import { colors, spacing, fontSize, fontWeight, sharedStyles, goldDim, goldBorder, goldText } from "./constants";
import SubjectDeckCard from "./SubjectDeckCard";
import SubjectDetailView from "./SubjectDetailView";
import FolderGrid from "./FolderGrid";
import DailyReview from "./DailyReview";
import RetentionDashboard from "./RetentionDashboard";

const SOURCE_FILTERS = [
  { key: "all", label: "All Materials" },
  { key: "mine", label: "My Uploads" },
  { key: "department", label: "Department" },
];

function groupByLevelThenSubject(resources, sourceFilter, currentUserId) {
  const filtered = resources.filter((r) => {
    if (r.status === "pending" && r.uploadedBy !== currentUserId) return false;
    if (sourceFilter === "mine") return r.uploadedBy === currentUserId;
    if (sourceFilter === "department") return r.uploadedBy !== currentUserId;
    return true;
  });

  const byLevel = {};
  for (const r of filtered) {
    const level = r.level || "Unlevelled";
    const subject = r.subject || "General";
    if (!byLevel[level]) byLevel[level] = {};
    if (!byLevel[level][subject]) byLevel[level][subject] = [];
    byLevel[level][subject].push(r);
  }

  const sortedLevels = Object.keys(byLevel).sort((a, b) => {
    if (a === "Unlevelled") return 1;
    if (b === "Unlevelled") return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return sortedLevels.map((level) => ({
    level,
    subjects: Object.keys(byLevel[level]).sort().map((subject) => ({
      subject,
      resources: byLevel[level][subject],
    })),
  }));
}

function StatsStrip({ fsrsStats, onExpand }) {
  if (!fsrsStats) return null;
  const { totalItems, dueCount, masteredCount, streak } = fsrsStats;

  return (
    <div
      onClick={onExpand}
      style={{
        display: "flex", gap: spacing.lg, padding: "10px 16px",
        background: colors.surface, border: `0.5px solid ${colors.border}`,
        borderRadius: "12px", marginBottom: spacing.lg, cursor: "pointer",
        alignItems: "center", flexWrap: "wrap", transition: "borderColor 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = goldBorder; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; }}
    >
      <div style={{ fontSize: fontSize.sm, color: colors.textMuted, display: "flex", alignItems: "center", gap: spacing.xs }}>
        📊 <span style={{ fontWeight: fontWeight.bold, color: colors.text }}>{totalItems}</span> items
      </div>
      <div style={{ fontSize: fontSize.sm, color: colors.textMuted, display: "flex", alignItems: "center", gap: spacing.xs }}>
        ✅ <span style={{ fontWeight: fontWeight.bold, color: masteredCount > 0 ? "#22c55e" : colors.textMuted }}>{masteredCount}</span> mastered
      </div>
      {dueCount > 0 && (
        <div style={{ fontSize: fontSize.sm, color: colors.textMuted, display: "flex", alignItems: "center", gap: spacing.xs }}>
          🔁 <span style={{ fontWeight: fontWeight.bold, color: "#ef4444" }}>{dueCount}</span> due
        </div>
      )}
      {streak > 0 && (
        <div style={{ fontSize: fontSize.sm, color: colors.textMuted, display: "flex", alignItems: "center", gap: spacing.xs }}>
          🔥 <span style={{ fontWeight: fontWeight.bold, color: "#f59e0b" }}>{streak}</span> day streak
        </div>
      )}
      <div style={{ marginLeft: "auto", fontSize: fontSize.xs, color: colors.textDim }}>View analytics →</div>
    </div>
  );
}

function ReviewBanner({ dueCount, onStart }) {
  if (!dueCount || dueCount === 0) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 18px", marginBottom: spacing.lg,
      background: "rgba(245,166,35,0.10)", border: `0.5px solid ${goldBorder}`,
      borderRadius: "16px", animation: "fadeup 0.2s ease",
      flexWrap: "wrap", gap: spacing.sm,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <span style={{ fontSize: 24 }}>🔁</span>
        <div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: goldText }}>
            {dueCount} card{dueCount !== 1 ? "s" : ""} due for review
          </div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Keep your streak alive — review now</div>
        </div>
      </div>
      <button onClick={onStart} style={{
        padding: "8px 20px", borderRadius: "24px", cursor: "pointer",
        background: goldDim, border: `0.5px solid ${goldBorder}`,
        color: goldText, fontSize: fontSize.sm, fontWeight: fontWeight.bold,
        display: "flex", alignItems: "center", gap: spacing.xs,
      }}>
        Start Review ▶
      </button>
    </div>
  );
}

export default function LibraryView({
  resources,
  currentUserId,
  fsrsStats,
  fsrsAnalytics,
  folders,
  bookmarkedIds,
  bookmarkBusyId,
  mcqProgress,
  onOpen,
  onToggleBookmark,
  onShare,
  onOpenPdf,
  onRefresh,
  onCreateFolder,
  onOpenFolder,
}) {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedLevels, setExpandedLevels] = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFolders, setShowFolders] = useState(false);

  const grouped = useMemo(() => {
    let result = groupByLevelThenSubject(resources, sourceFilter, currentUserId);
    if (search) {
      const q = search.toLowerCase();
      result = result
        .map((levelGroup) => ({
          ...levelGroup,
          subjects: levelGroup.subjects.filter((s) =>
            s.subject.toLowerCase().includes(q) ||
            s.resources.some((r) => r.title?.toLowerCase().includes(q))
          ),
        }))
        .filter((lg) => lg.subjects.length > 0);
    }
    return result;
  }, [resources, sourceFilter, currentUserId, search]);

  const toggleLevel = (level) => {
    setExpandedLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  // Subject detail view
  if (selectedSubject) {
    return (
      <SubjectDetailView
        subject={selectedSubject.subject}
        level={selectedSubject.level}
        resources={selectedSubject.resources}
        fsrsSubjectStats={fsrsStats?.bySubject?.[selectedSubject.subject]}
        onBack={() => setSelectedSubject(null)}
        onOpen={onOpen}
        onToggleBookmark={onToggleBookmark}
        onShare={onShare}
        bookmarkedIds={bookmarkedIds}
        bookmarkBusyId={bookmarkBusyId}
        mcqProgress={mcqProgress}
        onStudySubject={() => {
          setSelectedSubject(null);
          setShowReview(true);
        }}
      />
    );
  }

  // Daily review overlay
  if (showReview) {
    return (
      <DailyReview
        onBack={() => { setShowReview(false); onRefresh(); }}
        onComplete={onRefresh}
        onOpenPdf={onOpenPdf}
      />
    );
  }

  // Analytics overlay
  if (showAnalytics) {
    return (
      <RetentionDashboard
        fsrsStats={fsrsStats}
        fsrsAnalytics={fsrsAnalytics}
        onBack={() => setShowAnalytics(false)}
      />
    );
  }

  const dueCount = fsrsStats?.dueCount || 0;
  const hasFolders = folders?.own?.length > 0 || folders?.shared?.length > 0;

  return (
    <div>
      {/* Review banner */}
      <ReviewBanner dueCount={dueCount} onStart={() => setShowReview(true)} />

      {/* Stats strip */}
      <StatsStrip fsrsStats={fsrsStats} onExpand={() => setShowAnalytics(true)} />

      {/* Source filters + search */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: spacing.xs }}>
          {SOURCE_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setSourceFilter(f.key)}
              style={sourceFilter === f.key ? sharedStyles.chipActive : sharedStyles.chip}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ ...sharedStyles.searchWrap, flex: "1 1 200px" }}>
          <span style={{ color: "#3a3d60", fontSize: fontSize.lg }}>🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects or materials…"
            style={sharedStyles.searchInput} />
        </div>
      </div>

      {/* Level → Subject grouping */}
      {grouped.length === 0 ? (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: spacing.md }}>📚</div>
          <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm }}>
            {search ? "No results found" : "No materials yet"}
          </div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
            {search
              ? `Try a different search term or clear the filter.`
              : `Upload materials or open PDFs and MCQs from the Community tab to build your library. The FSRS algorithm will automatically schedule reviews.`
            }
          </div>
        </div>
      ) : (
        grouped.map((levelGroup) => {
          const isExpanded = expandedLevels[levelGroup.level] !== false; // default expanded
          const totalItems = levelGroup.subjects.reduce((sum, s) => sum + s.resources.length, 0);
          const totalDue = levelGroup.subjects.reduce((sum, s) => {
            const stats = fsrsStats?.bySubject?.[s.subject];
            return sum + (stats?.due || 0);
          }, 0);

          return (
            <div key={levelGroup.level} style={{ marginBottom: spacing.xl }}>
              {/* Level header */}
              <button
                onClick={() => toggleLevel(levelGroup.level)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "10px 16px", marginBottom: spacing.md,
                  background: colors.surface, border: `0.5px solid ${colors.border}`,
                  borderRadius: "12px", cursor: "pointer",
                  fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                  <span style={{ fontSize: 14 }}>{isExpanded ? "▼" : "▶"}</span>
                  <span>{levelGroup.level} Level</span>
                  <span style={{
                    fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
                    color: colors.textDim, background: colors.bg,
                    padding: "2px 10px", borderRadius: "12px",
                  }}>{totalItems} items</span>
                  {totalDue > 0 && (
                    <span style={{
                      fontSize: fontSize.xs, fontWeight: fontWeight.bold,
                      color: "#ef4444", background: "rgba(239,68,68,0.12)",
                      padding: "2px 10px", borderRadius: "12px",
                    }}>{totalDue} due</span>
                  )}
                </div>
              </button>

              {/* Subject deck cards */}
              {isExpanded && (
                <div style={sharedStyles.grid}>
                  {levelGroup.subjects.map((s) => (
                    <SubjectDeckCard
                      key={s.subject}
                      subject={s.subject}
                      level={levelGroup.level}
                      resources={s.resources}
                      fsrsSubjectStats={fsrsStats?.bySubject?.[s.subject]}
                      onClick={() => setSelectedSubject({
                        subject: s.subject,
                        level: levelGroup.level,
                        resources: s.resources,
                      })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Folders section */}
      {hasFolders && (
        <div style={{ marginTop: spacing.xxl }}>
          <button
            onClick={() => setShowFolders(!showFolders)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "10px 16px", marginBottom: spacing.md,
              background: colors.surface, border: `0.5px solid ${colors.border}`,
              borderRadius: "12px", cursor: "pointer",
              fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <span style={{ fontSize: 14 }}>{showFolders ? "▼" : "▶"}</span>
              <span>📁 My Folders</span>
            </div>
          </button>
          {showFolders && (
            <FolderGrid
              folders={folders.own}
              sharedFolders={folders.shared}
              onOpenFolder={onOpenFolder}
              onCreateFolder={onCreateFolder}
            />
          )}
        </div>
      )}
    </div>
  );
}
