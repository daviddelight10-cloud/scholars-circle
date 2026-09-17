import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import SubjectDetailView from "./SubjectDetailView";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import SpaceCard from "./SpaceCard.jsx";
import McIcon from "./McIcon.jsx";
import { getSubjectIcon } from "./subjectColors";

function groupBySubject(resources, currentUserId, bookmarkedIds, bookmarkFolderMap) {
  const filtered = resources.filter((r) => {
    const isOwned = String(r.uploadedBy) === currentUserId;
    if (isOwned && r.folderId) return false;
    if (r.status === "rejected" && !isOwned) return false;
    if (r.status === "pending" && !isOwned) return false;
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

const SORT_OPTIONS = [
  { key: "recent", label: "Recent" },
  { key: "name", label: "Name A–Z" },
  { key: "items", label: "Most items" },
];

export default function LibraryView({
  resources,
  resourcesLoading,
  resourcesError,
  onRetry,
  currentUserId,
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
  onOpenRecycleBin,
  recycleCount = 0,
  onRequestDeleteSpace,
}) {
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [spaceSort, setSpaceSort] = useState("recent");
  const [listView, setListView] = useState(() => {
    try {
      const saved = localStorage.getItem("mc_space_view");
      if (saved) return saved === "list";
    } catch {}
    return typeof window !== "undefined" && window.innerWidth < 640;
  });
  // Local pins for own spaces (the backend bookmark is reserved for others' folders)
  const [ownPins, setOwnPins] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mc_own_pins") || "[]")); } catch { return new Set(); }
  });
  const sortRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("mc_space_view", listView ? "list" : "grid"); } catch {}
  }, [listView]);

  useEffect(() => {
    try { localStorage.setItem("mc_own_pins", JSON.stringify([...ownPins])); } catch {}
  }, [ownPins]);

  const toggleOwnPin = useCallback((folder) => {
    if (!folder?.id) return;
    setOwnPins((prev) => {
      const next = new Set(prev);
      if (next.has(folder.id)) next.delete(folder.id);
      else next.add(folder.id);
      return next;
    });
  }, []);

  useEffect(() => {
    try { localStorage.setItem("mc_space_view", listView ? "list" : "grid"); } catch {}
  }, [listView]);

  useEffect(() => {
    if (!sortOpen) return;
    const onDoc = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [sortOpen]);

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
    return folders.own.filter((f) => f.name.toLowerCase().includes(q) || (f.courseCode || "").toLowerCase().includes(q));
  }, [folders, search]);

  const filteredBookmarkedFolders = useMemo(() => {
    if (!folders?.bookmarked) return [];
    if (!search) return folders.bookmarked;
    const q = search.toLowerCase();
    return folders.bookmarked.filter((f) => f.name.toLowerCase().includes(q) || (f.courseCode || "").toLowerCase().includes(q));
  }, [folders, search]);

  const sortFolders = (list) => {
    const arr = [...list];
    if (spaceSort === "name") arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (spaceSort === "items") arr.sort((a, b) => ((b._count?.resources || 0) - (a._count?.resources || 0)));
    return arr; // "recent" = API order (updatedAt desc)
  };

  if (selectedSubject) {
    return (
      <SubjectDetailView
        subject={selectedSubject.subject}
        level={selectedSubject.level}
        resources={selectedSubject.resources}
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
  const sortedOwn = sortFolders(filteredOwnFolders);
  const sortedPinned = sortFolders(filteredBookmarkedFolders);
  const pinnedOwn = sortedOwn.filter((f) => ownPins.has(f.id));
  const pinnedAll = [...pinnedOwn, ...sortedPinned];

  if (resourcesLoading) {
    return <LoadingState grid count={4} />;
  }
  if (resourcesError) {
    return <ErrorState message={resourcesError} onRetry={onRetry} />;
  }

  return (
    <div className="mc-root">
      {/* Search pill */}
      <div className="mc-search">
        <span className="mc-s-ic"><McIcon name="search" /></span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your spaces…"
        />
      </div>

      {/* Sort row */}
      <div className="mc-sort-row">
        <div ref={sortRef} style={{ position: "relative" }}>
          <button className="mc-chip-sm" onClick={() => setSortOpen((v) => !v)}>
            {SORT_OPTIONS.find((o) => o.key === spaceSort)?.label || "Recent"}
            <McIcon name="chev" size={12} />
          </button>
          {sortOpen && (
            <div className="mc-sort-menu">
              {SORT_OPTIONS.map((o) => (
                <button key={o.key} className={spaceSort === o.key ? "active" : ""} onClick={() => { setSpaceSort(o.key); setSortOpen(false); }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={`mc-chip-sm${savedOnly ? " active" : ""}`} onClick={() => setSavedOnly((v) => !v)}>
          <McIcon name="star" filled={savedOnly} size={13} /> Saved
        </button>
        <span className="mc-spacer" />
        {onOpenRecycleBin && (
          <button className="mc-icon-btn" title="Recycle bin" onClick={onOpenRecycleBin}>
            <McIcon name="trash" />
            {recycleCount > 0 && <span className="mc-tn">{recycleCount}</span>}
          </button>
        )}
        <button
          className={`mc-icon-btn${listView ? " active" : ""}`}
          title={listView ? "Grid view" : "List view"}
          onClick={() => setListView((v) => !v)}
        >
          <McIcon name={listView ? "list" : "grid"} />
        </button>
      </div>

      <div className="mc-content">
        {isEmpty ? (
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
          {/* PINNED — starred own spaces + bookmarked (saved) spaces */}
          {pinnedAll.length > 0 && (
            <>
              <div className="mc-section-label">PINNED</div>
              <div className={`mc-grid${listView ? " mc-list-view" : ""}`}>
                {pinnedAll.map((folder) => (
                  <SpaceCard
                    key={folder.id}
                    folder={folder}
                    onClick={() => onOpenFolder(folder.id)}
                    isBookmarked={ownPins.has(folder.id) || folderBookmarkedIds?.has(folder.id)}
                    bookmarkBusy={folderBookmarkBusyId === folder.id}
                    onToggleBookmark={ownPins.has(folder.id) ? toggleOwnPin : onToggleFolderBookmark}
                    listView={listView}
                  />
                ))}
              </div>
            </>
          )}

          {/* ALL SPACES — own folders */}
          {!savedOnly && (
            <>
              <div className="mc-section-label">ALL SPACES</div>
              <div className={`mc-grid${listView ? " mc-list-view" : ""}`}>
                <div
                  className="mc-space-card"
                  onClick={onCreateFolder}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderStyle: "dashed", background: "transparent", boxShadow: "none",
                    minHeight: listView ? 66 : 132,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#555" }}>
                    <McIcon name="plus" size={24} />
                    <span style={{ fontSize: 11, fontWeight: 700 }}>Create new space</span>
                  </div>
                </div>

                {sortedOwn.map((folder) => (
                  <SpaceCard
                    key={folder.id}
                    folder={folder}
                    onClick={() => onOpenFolder(folder.id)}
                    isBookmarked={ownPins.has(folder.id)}
                    bookmarkBusy={false}
                    onToggleBookmark={toggleOwnPin}
                    onRequestDelete={onRequestDeleteSpace}
                    listView={listView}
                  />
                ))}
              </div>
            </>
          )}

          {/* MATERIALS — loose (folder-less) subject groups */}
          {!savedOnly && grouped.length > 0 && (
            <>
              <div className="mc-section-label">MATERIALS</div>
              <div className={`mc-grid${listView ? " mc-list-view" : ""}`}>
                {grouped.map((s) => (
                  <div
                    key={s.subject}
                    className="mc-space-card"
                    onClick={() => setSelectedSubject({ subject: s.subject, resources: s.resources })}
                  >
                    <div className="mc-tile"><span style={{ fontSize: 20 }}>{getSubjectIcon(s.subject)}</span></div>
                    <div className="mc-card-body">
                      <h3>{s.subject}</h3>
                      <div className="mc-meta">
                        <span><b>{s.resources.length}</b> item{s.resources.length === 1 ? "" : "s"}</span>
                        <span className="mc-pill link">
                          <McIcon name="books" />Loose
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {savedOnly && pinnedAll.length === 0 && (
            <div className="mc-empty-note">
              No saved spaces yet — tap the star on a space to pin it.
            </div>
          )}

          {search && !hasFolders && !hasLooseMaterials && (
            <EmptyState icon="🔍" message={`No results for "${search}"`} />
          )}
        </>
        )}
      </div>
    </div>
  );
}
