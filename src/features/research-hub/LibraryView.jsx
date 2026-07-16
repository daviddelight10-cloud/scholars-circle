import { useState, useMemo } from "react";
import { colors, spacing, fontSize, fontWeight, sharedStyles } from "./constants";
import SubjectDetailView from "./SubjectDetailView";
import { FolderDeskCard, SubjectDeskCard, CreateDeckCard } from "./DeskCard";

function groupBySubject(resources, currentUserId, bookmarkedIds, bookmarkFolderMap) {
  const filtered = resources.filter((r) => {
    if (r.status === "rejected" && String(r.uploadedBy) !== currentUserId) return false;
    if (r.status === "pending" && String(r.uploadedBy) !== currentUserId) return false;
    const isOwned = String(r.uploadedBy) === currentUserId;
    const isBookmarked = bookmarkedIds && bookmarkedIds.has(r.id);
    if (!isOwned && !isBookmarked) return false;
    // If bookmarked into a specific folder, don't show as loose material
    if (isBookmarked && !isOwned && bookmarkFolderMap && bookmarkFolderMap[r.id]) return false;
    return true;
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
  bookmarkFolderMap,
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

  const grouped = useMemo(() => {
    let result = groupBySubject(resources, currentUserId, bookmarkedIds, bookmarkFolderMap);
    if (search) {
      const q = search.toLowerCase();
      result = result
        .filter((s) =>
          s.subject.toLowerCase().includes(q) ||
          s.resources.some((r) => r.title?.toLowerCase().includes(q))
        );
    }
    return result;
  }, [resources, currentUserId, bookmarkedIds, bookmarkFolderMap, search]);

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

  const hasFolders = (filteredOwnFolders.length > 0 || filteredSharedFolders.length > 0);
  const hasLooseMaterials = grouped.length > 0;
  const isEmpty = !hasFolders && !hasLooseMaterials && !search;

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
      ) : isEmpty ? (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: spacing.md }}>📚</div>
          <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm }}>
            Your space is empty
          </div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5, marginBottom: spacing.xl }}>
            Upload materials using the + button below, or bookmark items from the Community tab to add them here.
          </div>
          <button onClick={onCreateFolder} style={{ ...sharedStyles.addBtn }}>+ Create your first space</button>
        </div>
      ) : (
      <>
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ ...sharedStyles.searchWrap, flex: "1 1 200px" }}>
          <span style={{ color: "#3a3d60", fontSize: fontSize.lg }}>🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your spaces & materials…"
            style={sharedStyles.searchInput} />
        </div>
      </div>

      {/* Unified grid: create card + folder spaces + loose material subject groups */}
      <div style={sharedStyles.grid}>
        <CreateDeckCard onClick={onCreateFolder} />

        {filteredOwnFolders.map((folder) => (
          <FolderDeskCard
            key={folder.id}
            folder={folder}
            onClick={() => onOpenFolder(folder.id)}
          />
        ))}

        {filteredSharedFolders.map((folder) => (
          <FolderDeskCard
            key={folder.id}
            folder={folder}
            onClick={() => onOpenFolder(folder.id)}
          />
        ))}

        {grouped.map((s) => (
          <SubjectDeskCard
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

      {/* No results from search */}
      {search && !hasFolders && !hasLooseMaterials && (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>🔍</div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim }}>
            No results for "{search}"
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
