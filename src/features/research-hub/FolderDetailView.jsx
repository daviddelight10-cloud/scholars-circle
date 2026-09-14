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
  onGenerate, generatingId, genProgress,
  uploadModal, createFolderModal, bookmarkPicker,
  onStartStudying,
  onGuidedStudy, onDeleteResource, canDeleteFile,
}) {
  const [sheetFile, setSheetFile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Files tab = source files + standalone items (bookmarked MCQ sets / decks /
  // summaries that have no source file) so nothing disappears from the space.
  const files = useMemo(() => {
    const mats = folderCategorized.materials || [];
    const seen = new Set(mats.map((f) => f.id));
    const standalone = [
      ...(folderCategorized.mcqs || []),
      ...(folderCategorized.flashcards || []),
      ...(folderCategorized.summaries || []),
    ].filter((f) => f.standalone && !seen.has(f.id) && seen.add(f.id));
    return [...mats, ...standalone];
  }, [folderCategorized]);
  const allMcqIds = (folderCategorized.allMcqResources || []).map((r) => r.id);
  const showTopicsTab = !!folderDetail?.courseCode;
  const masteryPct = folderDetail?.masteryPct || 0;

  // If the topics tab isn't available, stay on files.
  const tab = activeFolderTab === "topics" && !showTopicsTab ? "materials" : activeFolderTab;

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
      <div className="mx-auto max-w-[1080px] p-5 sm:p-6" style={{ paddingBottom: "80px" }}>
        {/* Sticky header — back + space name + ⋯ menu */}
        <div className="sticky top-0 z-40 -mx-5 mb-[18px] px-5 pb-3 pt-3 sm:-mx-6 sm:px-6" style={{ background: "rgba(10,10,10,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="cs-glass-pill inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-[#9199A8] transition-all active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-4 w-4">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              My Space
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[#4F8EF7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Course Space
              </div>
              <div className="truncate text-[13px] font-bold text-[#F3F5F8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                {folderDetail?.courseCode || folderDetail?.name || ""}
              </div>
            </div>

            {folderDetail ? (
              <div className="cs-menu-wrap shrink-0" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="cs-glass-icon-btn text-[#9199A8]"
                  aria-label="Space options"
                  aria-expanded={menuOpen}
                >
                  ⋯
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
            ) : (
              <div style={{ width: 38 }} />
            )}
          </div>
        </div>

        {/* Hero card */}
        <div className="cs-glass mb-5 rounded-2xl p-5" style={{ borderRadius: 20 }}>
          <h1
            className="m-0 text-[clamp(26px,7vw,36px)] font-extrabold leading-[1.05] tracking-[-0.01em] text-[#F3F5F8]"
            style={{ fontFamily: "'Syne', sans-serif", wordBreak: "break-word" }}
          >
            {folderDetail?.courseCode || folderDetail?.name || "Loading…"}
          </h1>
          {folderDetail?.name && folderDetail?.courseCode && (
            <div className="mt-1 text-[13px] text-[#9199A8]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {folderDetail.name}
            </div>
          )}

          {/* Badge row */}
          <div className="mt-3 flex flex-wrap gap-2">
            {folderDetail?.level && (
              <span
                className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-medium"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "#F5A623", background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.30)" }}
              >
                {folderDetail.level}
              </span>
            )}
            {folderDetail?.semester && (
              <span
                className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-medium"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3DD68C", background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.28)" }}
              >
                {folderDetail.semester}
              </span>
            )}
          </div>

          {/* Progress + stats */}
          <div className="mt-4">
            <div className="cs-hero-progress">
              <div style={{ width: `${masteryPct}%` }} />
            </div>
            <div className="mt-2.5 flex items-center gap-3.5 text-[12.5px] text-[#9199A8]">
              <span>📄 {counts.materials} files</span>
              <span className="h-1 w-1 rounded-full bg-[#5D6472]" />
              <span>🧬 {folderDetail?.topicCount || 0} topics</span>
              <span className="h-1 w-1 rounded-full bg-[#5D6472]" />
              <span>{masteryPct}% mastered</span>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        {folderDetail && (
          <button
            onClick={() => onUploadToFolder(folderDetail.id)}
            className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-[15px] font-bold transition-all active:scale-95"
            style={{
              color: "#141008",
              border: "none",
              background: "linear-gradient(135deg, #F5A623, #E08E12)",
              boxShadow: "0 8px 24px -8px rgba(245,166,35,0.45)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" className="h-[17px] w-[17px]">
              <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" />
            </svg>
            Add to space
          </button>
        )}

        {/* Files | Topics tabs */}
        <div className="cs-segment mb-[18px]" role="tablist" aria-label="Space sections">
          <button
            role="tab"
            aria-selected={tab !== "topics"}
            className={tab !== "topics" ? "cs-segment-active" : ""}
            onClick={() => setActiveFolderTab("materials")}
          >
            📄 Files{counts.materials > 0 ? ` · ${counts.materials}` : ""}
          </button>
          {showTopicsTab && (
            <button
              role="tab"
              aria-selected={tab === "topics"}
              className={tab === "topics" ? "cs-segment-active" : ""}
              onClick={() => setActiveFolderTab("topics")}
            >
              🗺 Topics{(folderDetail?.topicCount || 0) > 0 ? ` · ${folderDetail.topicCount}` : ""}
            </button>
          )}
        </div>

        {/* Content */}
        {folderLoading ? (
          <LoadingState grid count={4} />
        ) : tab === "topics" && folderDetail?.courseCode ? (
          <EmbeddedRoadmapView
            courseCode={folderDetail.courseCode}
            folderId={folderDetail.id}
            folderResources={files}
            onOpenResource={onOpen}
            onStartStudying={onStartStudying}
            onGenerate={onGenerate}
          />
        ) : files.length > 0 ? (
          <div className="cs-grid grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
            {files.map((file, i) => (
              <SpaceFileCard
                key={file.id}
                file={file}
                isBookmarked={bookmarkedIds.has(file.id)}
                bookmarkBusy={bookmarkBusyId === file.id}
                onToggleBookmark={onToggleBookmark}
                onShare={onShare}
                onDelete={onDeleteResource}
                canDelete={canDeleteFile?.(file)}
                onOpen={onOpen}
                onPractice={setSheetFile}
                onGenerate={onGenerate}
                generatingId={generatingId}
                genProgress={genProgress}
                mcqProgress={mcqProgress}
                index={i}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📄"
            title="No materials in this space yet."
            message="Upload PDFs, notes, or other files to get started."
          />
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
        onShare={onShare}
        onDelete={onDeleteResource}
        canDelete={sheetFile ? canDeleteFile?.(sheetFile) : false}
        generating={sheetFile ? generatingId === sheetFile.id : false}
      />

      {uploadModal}
      {createFolderModal}
      {bookmarkPicker}
    </>
  );
}
