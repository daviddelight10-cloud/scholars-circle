import { useState } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";
import EmbeddedRoadmapView from "../../components/home/EmbeddedRoadmapView";
import { formatRelativeDate } from "./constants";
import MaterialCard from "./MaterialCard.jsx";

const emptyStateConfig = {
  materials: { icon: "📄", message: "No materials in this space yet.", cta: "Upload PDFs, notes, or other files to get started." },
  summaries: { icon: "📝", message: "No AI-generated summaries yet.", cta: "Upload a file and choose 'Generate Summary' to create one." },
  flashcards: { icon: "🎴", message: "No flashcard decks in this space yet.", cta: "Upload a file and choose 'Generate Flashcards' to create a deck." },
  mcqs: { icon: "✎", message: "No MCQ sets in this space yet.", cta: "Upload a file and choose 'Generate MCQs' or create manually." },
};

export default function FolderDetailView({
  folderDetail, folderLoading, folderCategorized, activeFolderTab, setActiveFolderTab,
  folderIsOwner, onClose, onShareFolder, onDeleteFolder,
  onUploadToFolder, onToggleFolderBookmark, folderBookmarkedIds, folderBookmarkBusyId,
  bookmarkedIds, bookmarkFolderMap, bookmarkBusyId, onOpen, onToggleBookmark, onShare, mcqProgress,
  onSpacedReview, onAdaptiveDrill, onExamSimulation, onPracticeAll,
  onGenerate, onStudyWithVoice, generatingId, genProgress, genErrorId, genError, onRetry, onDismissGenError,
  uploadModal, createFolderModal, bookmarkPicker,
  onStartStudying,
}) {
  const counts = folderCategorized.counts || { materials: 0, summaries: 0, flashcards: 0, mcqs: 0 };
  const currentList = folderCategorized[activeFolderTab] || [];
  const emptyCfg = emptyStateConfig[activeFolderTab] || emptyStateConfig.materials;

  const folderResources = folderCategorized.materials || [];
  const showTopicsTab = !!folderDetail?.courseCode;

  const chips = [
    { key: "materials", label: "📄 Files", icon: "📄", shortLabel: "Files", count: counts.materials },
    ...(showTopicsTab ? [{ key: "topics", label: "�️ My Topic", icon: "�️", shortLabel: "My Topic", count: folderDetail?.topicCount || 0 }] : []),
    { key: "summaries", label: "📝 Summary", icon: "📝", shortLabel: "Summary", count: counts.summaries },
    { key: "flashcards", label: "🎴 Cards", icon: "🗂️", shortLabel: "Cards", count: counts.flashcards },
    { key: "mcqs", label: "✎ MCQs", icon: "✍️", shortLabel: "MCQs", count: counts.mcqs },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1080px] p-5 sm:p-6" style={{ paddingBottom: "80px" }}>
        {/* Top bar — glass back pill + icon buttons */}
        <div className="mb-[22px] flex items-center justify-between">
          <button
            onClick={onClose}
            className="cs-glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-[#9199A8] transition-all active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-4 w-4">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            My Space
          </button>

          {folderDetail && (
            <div className="flex shrink-0 gap-2">
              {!folderIsOwner && folderDetail.visibility !== "private" && (
                <button
                  onClick={() => onToggleFolderBookmark(folderDetail)}
                  disabled={folderBookmarkBusyId === folderDetail.id}
                  className="cs-glass-icon-btn text-[#5D6472]"
                  style={{ opacity: folderBookmarkBusyId === folderDetail.id ? 0.5 : 1 }}
                  title={folderBookmarkedIds?.has(folderDetail.id) ? "Remove from my space" : "Save to my space"}
                >
                  {folderBookmarkedIds?.has(folderDetail.id) ? "★" : "☆"}
                </button>
              )}
              {folderDetail.visibility === "link" && (
                <button
                  onClick={() => onShareFolder(folderDetail)}
                  className="cs-glass-icon-btn text-[#5D6472]"
                >
                  ⤴
                </button>
              )}
              {folderIsOwner && (
                <button
                  onClick={() => onDeleteFolder(folderDetail.id)}
                  className="cs-glass-icon-btn text-[#5D6472]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Hero header */}
        <div className="mb-5">
          <span
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#4F8EF7]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Course Space
          </span>
          <h1
            className="m-0 text-[clamp(28px,8vw,38px)] font-extrabold leading-[1.05] tracking-[-0.01em] text-[#F3F5F8]"
            style={{ fontFamily: "'Syne', sans-serif", wordBreak: "break-word" }}
          >
            {folderDetail?.courseCode || folderDetail?.name || "Loading…"}
          </h1>

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

          {/* Meta row */}
          <div className="mt-2.5 flex items-center gap-3.5 text-[12.5px] text-[#9199A8]">
            <span className="flex items-center gap-1.5">🧬 {folderDetail?.topicCount || 0} topics</span>
            <span className="h-1 w-1 rounded-full bg-[#5D6472]" />
            <span>{folderDetail?.masteryPct || 0}% mastered</span>
          </div>
        </div>

        {/* Primary CTA — the only gold surface at top */}
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

        {/* Stat pill row — horizontal scroll */}
        <div className="cs-stat-scroll mb-[18px]">
          {chips.map((chip) => (
            <div
              key={chip.key}
              className="cs-stat-pill"
              onClick={() => setActiveFolderTab(chip.key)}
              style={{
                cursor: "pointer",
                ...(activeFolderTab === chip.key
                  ? { border: "1px solid rgba(79,142,247,0.3)", background: "rgba(79,142,247,0.08)" }
                  : {}),
              }}
            >
              <span className="text-[14px]">{chip.icon}</span>
              <span className="text-[12px] font-semibold text-[#9199A8]">{chip.shortLabel}</span>
              <span
                className="ml-auto text-[12px] font-semibold"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: chip.count > 0 ? "#3DD68C" : "#5D6472" }}
              >
                {chip.count}
              </span>
            </div>
          ))}
        </div>

        {/* MCQ session actions (only on MCQs tab) */}
        {activeFolderTab === "mcqs" && !folderLoading && currentList.length > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-hub-border bg-hub-surface p-3">
              <span className="mr-1 text-[11px] font-bold text-hub-text-muted">Session:</span>
              <button
                onClick={() => onSpacedReview?.(currentList.map(r => r.variants?.mcq?.id).filter(Boolean))}
                className="flex items-center gap-1.5 rounded-full border border-hub-border bg-hub-bg px-3.5 py-1.5 text-[11px] font-semibold text-hub-text-muted transition-all active:scale-95"
              >
                🔁 Spaced Review
              </button>
              <button
                onClick={() => onAdaptiveDrill?.(currentList.map(r => r.variants?.mcq?.id).filter(Boolean))}
                className="flex items-center gap-1.5 rounded-full border border-hub-border bg-hub-bg px-3.5 py-1.5 text-[11px] font-semibold text-hub-text-muted transition-all active:scale-95"
              >
                🎯 Adaptive Drill
              </button>
              <button
                onClick={() => onExamSimulation?.(currentList.map(r => r.variants?.mcq?.id).filter(Boolean))}
                className="flex items-center gap-1.5 rounded-full border border-hub-border bg-hub-bg px-3.5 py-1.5 text-[11px] font-semibold text-hub-text-muted transition-all active:scale-95"
              >
                🎓 Exam Simulation
              </button>
            </div>
            {currentList.length > 1 && (
              <div className="mb-4">
                <button
                  onClick={() => onPracticeAll?.()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold-border bg-gold-dim px-5 py-3 text-sm font-bold text-gold transition-all active:scale-[0.98]"
                >
                  ▶ Practice All {currentList.length} MCQ Sets
                </button>
              </div>
            )}
          </>
        )}

        {/* Grid or Roadmap */}
        {folderLoading ? (
          <LoadingState grid count={4} />
        ) : activeFolderTab === "topics" && folderDetail?.courseCode ? (
          <EmbeddedRoadmapView
            courseCode={folderDetail.courseCode}
            folderId={folderDetail.id}
            folderResources={folderResources}
            onOpenResource={onOpen}
            onStartStudying={onStartStudying}
            onGenerate={onGenerate}
          />
        ) : currentList.length > 0 ? (
          <div className="cs-grid grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
            {currentList.map((file, i) => (
              <MaterialCard
                key={file.id}
                file={file}
                isBookmarked={bookmarkedIds.has(file.id)}
                bookmarkBusy={bookmarkBusyId === file.id}
                onOpen={onOpen}
                onToggleBookmark={onToggleBookmark}
                onShare={onShare}
                onGenerate={onGenerate}
                generatingId={generatingId}
                genProgress={genProgress}
                index={i}
                showBookmark={false}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={emptyCfg.icon} title={emptyCfg.message} message={emptyCfg.cta} />
        )}
      </div>
      {uploadModal}
      {createFolderModal}
      {bookmarkPicker}
    </>
  );
}
