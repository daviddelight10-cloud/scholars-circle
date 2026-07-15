import { useState, useMemo } from "react";
import { colors, spacing, fontSize, fontWeight, sharedStyles } from "./constants";
import SubjectDeckCard from "./SubjectDeckCard";
import SubjectDetailView from "./SubjectDetailView";
import FolderGrid from "./FolderGrid";
import SubTabBar from "./SubTabBar";

function groupBySubject(resources, currentUserId, bookmarkedIds) {
  const filtered = resources.filter((r) => {
    if (r.status === "rejected" && String(r.uploadedBy) !== currentUserId) return false;
    if (r.status === "pending" && String(r.uploadedBy) !== currentUserId) return false;
    return String(r.uploadedBy) === currentUserId || (bookmarkedIds && bookmarkedIds.has(r.id));
  });

  const bySubject = {};
  for (const r of filtered) {
    const subject = r.subject || "General";
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(r);
  }

  return Object.keys(bySubject).sort().map((subject) => ({
    subject,
    resources: bySubject[subject],
  }));
}

export default function LibraryView({
  resources,
  resourcesLoading,
  resourcesError,
  onRetry,
  currentUserId,
  fsrsStats,
  folders,
  bookmarkedIds,
  bookmarkBusyId,
  mcqProgress,
  onOpen,
  onToggleBookmark,
  onShare,
  onCreateFolder,
  onOpenFolder,
}) {
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subTab, setSubTab] = useState("materials");

  const grouped = useMemo(() => {
    let result = groupBySubject(resources, currentUserId, bookmarkedIds);
    if (search) {
      const q = search.toLowerCase();
      result = result
        .filter((s) =>
          s.subject.toLowerCase().includes(q) ||
          s.resources.some((r) => r.title?.toLowerCase().includes(q))
        );
    }
    return result;
  }, [resources, currentUserId, bookmarkedIds, search]);

  const filteredOwnFolders = useMemo(() => {
    if (!folders?.own) return [];
    if (!search) return folders.own;
    const q = search.toLowerCase();
    return folders.own.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, search]);

  const filteredSharedFolders = useMemo(() => {
    if (!folders?.shared) return [];
    if (!search) return folders.shared;
    const q = search.toLowerCase();
    return folders.shared.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, search]);

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
        backLabel="My Space"
      />
    );
  }

  const ownFolderCount = folders?.own?.length || 0;
  const sharedFolderCount = folders?.shared?.length || 0;
  const totalFolderCount = ownFolderCount + sharedFolderCount;

  const subTabs = [
    ["materials", "Materials"],
    ["folders", "Folders", totalFolderCount],
  ];

  return (
    <div>
      {resourcesLoading ? (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⏳</div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
            Loading your space…
          </div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim }}>
            Fetching your materials from the server.
          </div>
        </div>
      ) : resourcesError ? (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⚠️</div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
            Something went wrong
          </div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5, marginBottom: spacing.md }}>
            {resourcesError}
          </div>
          <button onClick={onRetry} style={{ ...sharedStyles.chipActive, cursor: "pointer" }}>↻ Retry</button>
        </div>
      ) : (
      <>
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ ...sharedStyles.searchWrap, flex: "1 1 200px" }}>
          <span style={{ color: "#3a3d60", fontSize: fontSize.lg }}>🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={subTab === "materials" ? "Search your materials…" : "Search your folders…"}
            style={sharedStyles.searchInput} />
        </div>
      </div>

      <SubTabBar tabs={subTabs} activeTab={subTab} onTabChange={setSubTab} />

      {subTab === "materials" ? (
        grouped.length === 0 ? (
          <div style={sharedStyles.emptyState}>
            <div style={{ fontSize: 48, marginBottom: spacing.md }}>📚</div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm }}>
              {search ? "No results found" : "Your space is empty"}
            </div>
            <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
              {search
                ? "Try a different search term."
                : "Upload materials using the + button below, or bookmark items from the Community tab to add them here."
              }
            </div>
          </div>
        ) : (
          <div style={sharedStyles.grid}>
            {grouped.map((s) => (
              <SubjectDeckCard
                key={s.subject}
                subject={s.subject}
                resources={s.resources}
                fsrsSubjectStats={fsrsStats?.bySubject?.[s.subject]}
                onClick={() => setSelectedSubject({
                  subject: s.subject,
                  resources: s.resources,
                })}
              />
            ))}
          </div>
        )
      ) : (
        <FolderGrid
          folders={filteredOwnFolders}
          sharedFolders={filteredSharedFolders}
          search={search}
          onOpenFolder={onOpenFolder}
          onCreateFolder={onCreateFolder}
        />
      )}
      </>
      )}
    </div>
  );
}
