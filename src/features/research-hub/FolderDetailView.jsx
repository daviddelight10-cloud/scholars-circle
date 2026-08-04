import { useState, useEffect } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";
import EmbeddedRoadmapView from "../../components/home/EmbeddedRoadmapView";
import { fetchSkeleton } from "../../lib/skeletonGenerator";

const emptyStateConfig = {
  materials: { icon: "📄", message: "No materials in this space yet.", cta: "Upload PDFs, notes, or other files to get started." },
  summaries: { icon: "📝", message: "No AI-generated summaries yet.", cta: "Upload a file and choose 'Generate Summary' to create one." },
  flashcards: { icon: "🎴", message: "No flashcard decks in this space yet.", cta: "Upload a file and choose 'Generate Flashcards' to create a deck." },
  mcqs: { icon: "✎", message: "No MCQ sets in this space yet.", cta: "Upload a file and choose 'Generate MCQs' or create manually." },
};

const VARIANT_TYPES = [
  { key: "mcq", label: "MCQs", chipLabel: "MCQ", color: "#F5A623", genKind: "mcqs" },
  { key: "flashcard", label: "Flashcards", chipLabel: "Flashcards", color: "#3DD68C", genKind: "flashcards" },
  { key: "summary", label: "Summary", chipLabel: "Summary", color: "#4F8EF7", genKind: "summary" },
];

function formatRelativeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWk = Math.floor(diffDay / 7);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWk < 4) return `${diffWk}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getVariantCount(variant) {
  if (!variant) return 0;
  try {
    if (variant.contentType === "mcq" && variant.mcqData) {
      const data = typeof variant.mcqData === "string" ? JSON.parse(variant.mcqData) : variant.mcqData;
      return Array.isArray(data) ? data.length : 0;
    }
    if (variant.contentType === "flashcard_deck" && variant.flashcardData) {
      const data = typeof variant.flashcardData === "string" ? JSON.parse(variant.flashcardData) : variant.flashcardData;
      return Array.isArray(data) ? data.length : 0;
    }
  } catch {
    return 0;
  }
  return 0;
}

function FileCard({ file, isBookmarked, bookmarkBusy, onOpen, onToggleBookmark, onShare, onGenerate, generatingId, genProgress, index }) {
  const icon = getContentTypeIcon(file.contentType);
  const relDate = formatRelativeDate(file.createdAt);
  const fileName = file.fileName || file.title || "";
  const isGenerating = generatingId === file.id;
  const delay = `${Math.min(index * 40, 400)}ms`;

  const typeLabel = (file.contentType || "file").toUpperCase();

  return (
    <div
      className="stagger-in relative overflow-hidden rounded-2xl border border-hub-border bg-hub-surface p-4 pb-3.5"
      style={{ borderLeftWidth: "3px", borderLeftColor: "#F5A623", animationDelay: delay }}
    >
      {/* Top row: icon + title + filename */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-base"
          style={{ background: "rgba(245,166,35,0.1)" }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-[15.5px] font-bold leading-tight text-hub-text" style={{ fontFamily: "'Syne', sans-serif" }}>
            {file.title}
          </h3>
          <p className="cs-filename mt-0.5 truncate text-[11.5px] text-hub-text-dim" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {fileName}
          </p>
        </div>
      </div>

      {/* Meta line */}
      <div className="mb-3 flex items-center gap-2 text-[12px] text-hub-text-muted">
        <span
          className="rounded px-2 py-0.5 text-[11px] font-bold"
          style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {typeLabel}
        </span>
        <span>👁 {formatViewCount(file.viewCount || 0)}</span>
        {relDate && <span>· {relDate}</span>}
      </div>

      {/* Variant chips */}
      <div className="cs-variants mb-3.5 flex flex-wrap gap-1.5">
        {VARIANT_TYPES.map((vt) => {
          const variant = file.variants?.[vt.key];
          if (variant) {
            const count = getVariantCount(variant);
            return (
              <button
                key={vt.key}
                onClick={() => onOpen(variant.shareToken)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-hub-text-muted transition-all active:scale-95"
                title={`Open ${vt.label}`}
              >
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: vt.color }} />
                {vt.chipLabel}
                {count > 0 && <span>· {count}</span>}
              </button>
            );
          }
          if (file.standalone) return null;
          return (
            <button
              key={vt.key}
              onClick={() => onGenerate?.(file, vt.genKind)}
              disabled={isGenerating}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-hub-border bg-transparent px-2.5 py-1.5 text-[11.5px] font-semibold text-hub-text-dim transition-all hover:border-gold hover:text-gold active:scale-95 disabled:opacity-40"
              title={`Generate ${vt.label}`}
            >
              + {vt.chipLabel}
            </button>
          );
        })}
      </div>

      {/* Generating progress */}
      {isGenerating && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-gold-border bg-gold-dim px-3 py-2">
          <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <span className="truncate text-[10px] font-semibold text-gold">{genProgress || "Generating…"}</span>
        </div>
      )}

      {/* Bottom row: Open + star + share */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOpen(file.shareToken)}
          className="flex-1 rounded-[10px] border border-hub-border bg-hub-bg py-2.5 text-center text-[13.5px] font-semibold text-hub-text transition-all active:scale-95"
        >
          Open
        </button>
        <button
          onClick={() => onToggleBookmark(file)}
          disabled={bookmarkBusy}
          title={isBookmarked ? "Remove from your space" : "Add to your space"}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-hub-border bg-transparent text-sm transition-all active:scale-90"
          style={isBookmarked ? { color: "#F5A623", borderColor: "rgba(245,166,35,0.4)", background: "rgba(245,166,35,0.08)" } : { color: "#5A6178" }}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
        <button
          onClick={() => onShare(file.shareToken)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-hub-border bg-transparent text-sm transition-all active:scale-90"
          style={{ color: "#5A6178" }}
        >
          ⤴
        </button>
      </div>
    </div>
  );
}

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

  const [filesViewMode, setFilesViewMode] = useState("flat");

  // Check if a skeleton exists for this folder's courseCode to set default toggle mode
  useEffect(() => {
    if (!folderDetail?.courseCode) { setFilesViewMode("flat"); return; }
    let cancelled = false;
    fetchSkeleton(folderDetail.courseCode)
      .then((topics) => {
        if (cancelled) return;
        setFilesViewMode(topics.length > 0 ? "topic" : "flat");
      })
      .catch(() => { if (!cancelled) setFilesViewMode("flat"); });
    return () => { cancelled = true; };
  }, [folderDetail?.courseCode]);

  const showRoadmapToggle = activeFolderTab === "materials" && folderDetail?.courseCode;
  const folderResources = folderCategorized.materials || [];

  const chips = [
    { key: "materials", label: "📄 Files", icon: "📄", shortLabel: "Files", count: counts.materials },
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
              style={{ cursor: "pointer" }}
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

        {/* Segmented control — By Topic / All Files */}
        {showRoadmapToggle && (
          <div className="cs-segment mb-5">
            <button
              onClick={() => setFilesViewMode("topic")}
              className={filesViewMode === "topic" ? "cs-segment-active" : ""}
            >
              🗺️ By Topic
            </button>
            <button
              onClick={() => setFilesViewMode("flat")}
              className={filesViewMode === "flat" ? "cs-segment-active" : ""}
            >
              📄 All Files
            </button>
          </div>
        )}

        {/* Filter chips — secondary tab row */}
        <div className="cs-chiprow mb-5 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveFolderTab(chip.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-[11px] border px-3.5 py-2 text-[13.5px] font-semibold transition-all active:scale-95 ${
                activeFolderTab === chip.key
                  ? "border-hub-text-dim bg-hub-bg text-hub-text"
                  : "border-hub-border bg-hub-surface text-hub-text-muted"
              }`}
            >
              {chip.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  activeFolderTab === chip.key ? "bg-gold text-[#1A1200]" : "bg-hub-bg text-hub-text-dim"
                }`}
              >
                {chip.count}
              </span>
            </button>
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
        ) : activeFolderTab === "materials" && filesViewMode === "topic" && folderDetail?.courseCode ? (
          <EmbeddedRoadmapView
            courseCode={folderDetail.courseCode}
            folderId={folderDetail.id}
            folderResources={folderResources}
            onOpenResource={onOpen}
            onStartStudying={onStartStudying}
          />
        ) : currentList.length > 0 ? (
          <div className="cs-grid grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
            {currentList.map((file, i) => (
              <FileCard
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
