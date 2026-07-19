import { useState, useMemo } from "react";
import SubjectDetailView from "./SubjectDetailView";
import { FolderDeskCard, SubjectDeskCard, CreateDeckCard } from "./DeskCard";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";

function groupBySubject(resources, currentUserId, bookmarkedIds, bookmarkFolderMap) {
  const filtered = resources.filter((r) => {
    if (r.status === "rejected" && String(r.uploadedBy) !== currentUserId) return false;
    if (r.status === "pending" && String(r.uploadedBy) !== currentUserId) return false;
    const isOwned = String(r.uploadedBy) === currentUserId;
    const isBookmarked = bookmarkedIds && bookmarkedIds.has(r.id);
    if (!isOwned && !isBookmarked) return false;
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
  folderBookmarkedIds,
  folderBookmarkBusyId,
  onToggleFolderBookmark,
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

  const filteredBookmarkedFolders = useMemo(() => {
    if (!folders?.bookmarked) return [];
    if (!search) return folders.bookmarked;
    const q = search.toLowerCase();
    return folders.bookmarked.filter((f) => f.name.toLowerCase().includes(q));
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

  const hasFolders = (filteredOwnFolders.length > 0 || filteredBookmarkedFolders.length > 0);
  const hasLooseMaterials = grouped.length > 0;
  const isEmpty = !hasFolders && !hasLooseMaterials && !search;

  return (
    <div>
      {resourcesLoading ? (
        <LoadingState grid count={4} />
      ) : resourcesError ? (
        <ErrorState message={resourcesError} onRetry={onRetry} />
      ) : isEmpty ? (
        <div className="px-5 py-16 text-center">
          <div className="mb-6 text-6xl">📚</div>
          <div className="mb-2 text-xl font-extrabold text-hub-text-muted">Your space is empty</div>
          <div className="mx-auto mb-8 max-w-md text-[13px] leading-relaxed text-hub-text-dim">
            Welcome! This is your personal study circle. Here's how to get started:
          </div>
          <div className="mx-auto max-w-md space-y-3 text-left">
            <div className="flex items-start gap-3 rounded-xl border border-hub-border bg-hub-surface p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-dim text-sm font-bold text-gold">1</div>
              <div>
                <div className="text-[13px] font-bold text-hub-text">Upload your first material</div>
                <div className="text-[11px] text-hub-text-dim">Tap the + button below to upload a PDF, note, or create MCQs.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-hub-border bg-hub-surface p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-dim text-sm font-bold text-gold">2</div>
              <div>
                <div className="text-[13px] font-bold text-hub-text">Create a space to organize</div>
                <div className="text-[11px] text-hub-text-dim">Group materials by subject, level, or semester into folders.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-hub-border bg-hub-surface p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-dim text-sm font-bold text-gold">3</div>
              <div>
                <div className="text-[13px] font-bold text-hub-text">Bookmark from Community</div>
                <div className="text-[11px] text-hub-text-dim">Find materials in the Community tab and tap ☆ to save them here.</div>
              </div>
            </div>
          </div>
          <button onClick={onCreateFolder} className="mt-8 rounded-lg border border-gold-border bg-gold-dim px-5 py-2.5 text-sm font-semibold text-gold transition-all active:scale-95">
            + Create your first space
          </button>
        </div>
      ) : (
      <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-h-[40px] flex-1 items-center gap-3 rounded-full border border-hub-border bg-hub-bg px-4 py-2">
          <span className="text-lg text-hub-text-dim">🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your spaces & materials…"
            className="flex-1 bg-none border-none text-sm text-hub-text outline-none placeholder:text-hub-text-dim" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CreateDeckCard onClick={onCreateFolder} />

        {filteredOwnFolders.map((folder, i) => (
          <FolderDeskCard
            key={folder.id}
            folder={folder}
            onClick={() => onOpenFolder(folder.id)}
            isBookmarked={folderBookmarkedIds?.has(folder.id)}
            bookmarkBusy={folderBookmarkBusyId === folder.id}
            onToggleBookmark={onToggleFolderBookmark}
            index={i + 1}
          />
        ))}

        {grouped.map((s, i) => (
          <SubjectDeskCard
            key={s.subject}
            subject={s.subject}
            resources={s.resources}
            fsrsSubjectStats={fsrsStats?.bySubject?.[s.subject]}
            onClick={() => setSelectedSubject({
              subject: s.subject,
              resources: s.resources,
            })}
            index={i + filteredOwnFolders.length + 1}
          />
        ))}
      </div>

      {filteredBookmarkedFolders.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">★ Saved Spaces</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBookmarkedFolders.map((folder, i) => (
              <FolderDeskCard
                key={folder.id}
                folder={folder}
                onClick={() => onOpenFolder(folder.id)}
                isBookmarked={true}
                bookmarkBusy={folderBookmarkBusyId === folder.id}
                onToggleBookmark={onToggleFolderBookmark}
                shared
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {search && !hasFolders && !hasLooseMaterials && (
        <EmptyState icon="🔍" message={`No results for "${search}"`} />
      )}
      </>
      )}
    </div>
  );
}
