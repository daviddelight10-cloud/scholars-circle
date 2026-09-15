import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import EmbeddedRoadmapView from "../../components/home/EmbeddedRoadmapView";
import SpaceFileCard from "./SpaceFileCard.jsx";
import PracticeSheet from "./PracticeSheet.jsx";

export default function FolderDetailView({
  folderDetail, folderLoading, folderCategorized, activeFolderTab, setActiveFolderTab,
  folderIsOwner, onClose, onShareFolder, onDeleteFolder,
  onUploadToFolder, onToggleFolderBookmark, folderBookmarkedIds, folderBookmarkBusyId,
  bookmarkedIds, bookmarkBusyId, onOpen, onToggleBookmark, onShare, mcqProgress,
  onSpacedReview, onAdaptiveDrill, onExamSimulation, onPracticeAll,
  onGenerate, generatingId,
  uploadModal, createFolderModal, bookmarkPicker,
  onStartStudying,
  onGuidedStudy, onDeleteResource, canDeleteFile, preparingStudy,
  onGoLive,
}) {
  const [sheetFile, setSheetFile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileSearch, setFileSearch] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, [menuOpen]);

  const counts = folderCategorized.counts || { materials: 0, summaries: 0, flashcards: 0, mcqs: 0 };

  // Files tab = every document in the space: source files, their AI-generated
  // variants (MCQs / flashcards / summaries saved by the AI tools), and
  // standalone items with no source file — each rendered as its own card.
  const allFiles = useMemo(() => {
    const asDoc = (r, selfKind) => ({
      ...r,
      variants: selfKind
        ? { summary: selfKind === "summary" ? r : null, mcq: selfKind === "mcq" ? r : null, flashcard: selfKind === "flashcard" ? r : null }
        : r.variants,
    });
    const docs = [];
    const seen = new Set();
    for (const m of folderCategorized.materials || []) {
      docs.push(m);
      seen.add(m.id);
      for (const kind of ["summary", "mcq", "flashcard"]) {
        const v = m.variants?.[kind];
        if (v && !seen.has(v.id)) { docs.push(asDoc(v, kind)); seen.add(v.id); }
      }
    }
    for (const list of ["mcqs", "flashcards", "summaries"]) {
      for (const f of folderCategorized[list] || []) {
        // Standalone items the PDF viewer's study tool auto-saves are titled
        // "[AI] …" — keep them out of the Files grid (they live in library).
        if (f.standalone && f.title?.startsWith("[AI]")) { seen.add(f.id); continue; }
        if (f.standalone && !seen.has(f.id)) { docs.push(f); seen.add(f.id); }
      }
    }
    return docs;
  }, [folderCategorized]);

  const files = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) return allFiles;
    return allFiles.filter((f) =>
      (f.title || "").toLowerCase().includes(q) ||
      (f.fileName || "").toLowerCase().includes(q) ||
      (f.subject || "").toLowerCase().includes(q) ||
      (f.courseCode || "").toLowerCase().includes(q)
    );
  }, [allFiles, fileSearch]);

  const allMcqIds = (folderCategorized.allMcqResources || []).map((r) => r.id);
  const showTopicsTab = !!folderDetail?.courseCode;
  const masteryPct = folderDetail?.masteryPct || 0;

  // If the topics tab isn't available, stay on files.
  const tab = activeFolderTab === "topics" && !showTopicsTab ? "materials" : activeFolderTab;
  const levelSem = [folderDetail?.level, folderDetail?.semester].filter(Boolean).join(" · ");

  const menuItem = (label, fn, opts = {}) => (
    <button
      role="menuitem"
      className={`cs-menu-item${opts.danger ? " cs-menu-danger" : ""}`}
      disabled={opts.disabled}
      onClick={() => { setMenuOpen(false); fn?.(); }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="mx-auto w-full max-w-[1400px]" style={{ paddingBottom: "96px" }}>

        {/* Sticky app header */}
        <div className="sp-header px-5 md:px-8 lg:px-12">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              aria-label="Back to My Space"
              className="flex h-9 w-9 items-center justify-center rounded-full border text-[#9AA3B5] transition-colors"
              style={{ background: "#151A24", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#646E84]">Course Space</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-[#EDEFF5]">
                {levelSem || folderDetail?.courseCode || folderDetail?.name || ""}
              </div>
            </div>

            <div className="cs-menu-wrap shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full border text-[#9AA3B5] transition-colors"
                style={{ background: "#151A24", borderColor: "rgba(255,255,255,0.07)" }}
                aria-label="Space options"
                aria-expanded={menuOpen}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ pointerEvents: "none" }}>
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="cs-menu" role="menu">
                    {!folderIsOwner && folderDetail.visibility !== "private" &&
                      menuItem(
                        folderBookmarkedIds?.has(folderDetail.id) ? "★ Remove from my space" : "☆ Save to my space",
                        () => onToggleFolderBookmark(folderDetail),
                        { disabled: folderBookmarkBusyId === folderDetail.id }
                      )}
                    {folderDetail.shareToken &&
                      menuItem("⤴ Share folder", () => onShareFolder(folderDetail))}
                    {allMcqIds.length > 0 &&
                      menuItem(`▶ Practice all (${counts.mcqs} sets)`, () => onPracticeAll?.())}
                    {allMcqIds.length > 0 &&
                      menuItem("🔁 Spaced review", () => onSpacedReview?.(allMcqIds))}
                    {allMcqIds.length > 0 &&
                      menuItem("� Adaptive drill", () => onAdaptiveDrill?.(allMcqIds))}
                    {allMcqIds.length > 0 &&
                      menuItem("�🎓 Exam simulation", () => onExamSimulation?.(allMcqIds))}
                    {folderIsOwner &&
                      menuItem("🗑 Delete folder", () => onDeleteFolder(folderDetail.id), { danger: true })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Course hero card */}
        <div className="px-5 md:px-8 lg:px-12">
          <div className="sp-hero">
            <div className="sp-hero-glow-a" />
            <div className="sp-hero-glow-b" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#F5A623" }} />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#F5A623" }}>Active Course</span>
              </div>
              <h2 className="sp-hero-title">{folderDetail?.courseCode || folderDetail?.name || "Loading…"}</h2>
              <p className="sp-hero-sub">
                {folderDetail?.name && folderDetail?.courseCode
                  ? folderDetail.name
                  : (folderDetail?.description || "Your study space")}
              </p>
              <div className="sp-hero-bar">
                <div style={{ width: `${masteryPct}%` }} />
              </div>
            </div>

            <div className="sp-hero-stats relative">
              <div>
                <div className="sp-hero-stat-num">{allFiles.length}</div>
                <div className="sp-hero-stat-label">Files</div>
              </div>
              <div className="sp-hero-divider" />
              <div>
                <div className="sp-hero-stat-num">{folderDetail?.topicCount || 0}</div>
                <div className="sp-hero-stat-label">Topics</div>
              </div>
              <div className="sp-hero-divider" />
              <div>
                <div className="sp-hero-stat-num">{masteryPct}<span className="text-sm md:text-base">%</span></div>
                <div className="sp-hero-stat-label">Mastered</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 px-5 md:px-8 lg:px-12">
          <div className="sp-tabs" role="tablist" aria-label="Space sections">
            <button
              role="tab"
              aria-selected={tab !== "topics"}
              className={`sp-tab${tab !== "topics" ? " active" : ""}`}
              onClick={() => setActiveFolderTab("materials")}
            >
              Files
            </button>
            {showTopicsTab && (
              <button
                role="tab"
                aria-selected={tab === "topics"}
                className={`sp-tab${tab === "topics" ? " active" : ""}`}
                onClick={() => setActiveFolderTab("topics")}
              >
                Topics
              </button>
            )}
          </div>
        </div>

        {/* Search + Add */}
        {tab !== "topics" && (
          <div className="mt-4 flex items-center gap-2 px-5 md:px-8 lg:px-12">
            <div className="sp-search">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#646E84" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="Search files…"
                aria-label="Search files in this space"
              />
            </div>
            <button
              onClick={() => onUploadToFolder(folderDetail?.id)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2.5 text-[11px] font-bold text-black transition-all active:scale-95"
              style={{ background: "#F5A623", border: "none" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Add to space
            </button>
          </div>
        )}

        {/* Files grid */}
        {tab !== "topics" && (
          <div className="mt-4 grid grid-cols-1 gap-4 px-5 md:grid-cols-2 md:px-8 lg:px-12 xl:grid-cols-3">
            {folderLoading ? (
              <div className="col-span-full"><LoadingState grid count={4} /></div>
            ) : files.length > 0 ? (
              files.map((file, i) => (
                <SpaceFileCard
                  key={file.id}
                  file={file}
                  isBookmarked={bookmarkedIds.has(file.id)}
                  bookmarkBusy={bookmarkBusyId === file.id}
                  onToggleBookmark={onToggleBookmark}
                  onShare={onShare}
                  onDelete={onDeleteResource}
                  canDelete={canDeleteFile?.(file)}
                  onPractice={setSheetFile}
                  mcqProgress={mcqProgress}
                  index={i}
                />
              ))
            ) : fileSearch ? (
              <div className="col-span-full">
                <EmptyState icon="🔍" title={`No files match "${fileSearch}"`} message="Try a different search term." />
              </div>
            ) : (
              <div className="col-span-full">
                <EmptyState icon="📄" title="No materials in this space yet." message="Upload PDFs, notes, or other files to get started." />
              </div>
            )}
          </div>
        )}

        {/* Topics roadmap */}
        {tab === "topics" && folderDetail?.courseCode && (
          <div className="mt-4 px-5 md:px-8 lg:px-12">
            {folderLoading ? (
              <LoadingState grid count={4} />
            ) : (
              <EmbeddedRoadmapView
                courseCode={folderDetail.courseCode}
                folderId={folderDetail.id}
                folderResources={allFiles}
                onOpenResource={onOpen}
                onStartStudying={onStartStudying}
                onGenerate={onGenerate}
              />
            )}
          </div>
        )}
      </div>

      {/* File action sheet */}
      <PracticeSheet
        file={sheetFile}
        onClose={() => setSheetFile(null)}
        onOpen={onOpen}
        onGenerate={onGenerate}
        onGuidedStudy={onGuidedStudy}
        onExamSimulation={onExamSimulation}
        onGoLive={onGoLive}
        generating={sheetFile ? generatingId === sheetFile.id : false}
        preparingStudy={preparingStudy}
        mcqProgress={mcqProgress}
      />

      {/* Guided-study extraction indicator — persists until study opens */}
      {preparingStudy && (
        <div
          className="fixed bottom-24 left-1/2 z-[1002] flex -translate-x-1/2 items-center gap-2.5 rounded-full border px-4 py-2.5 text-[13px] font-semibold shadow-lg"
          style={{ background: "#12161F", borderColor: "rgba(245,166,35,0.35)", color: "#F5A623", animation: "fade-up 0.2s ease both" }}
          role="status"
        >
          <span className="animate-spin" style={{ display: "inline-block" }}>⏳</span>
          Preparing guided study…
        </div>
      )}

      {uploadModal}
      {createFolderModal}
      {bookmarkPicker}
    </>
  );
}
