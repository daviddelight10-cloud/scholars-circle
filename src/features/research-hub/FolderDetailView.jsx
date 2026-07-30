import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";

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
}) {
  const counts = folderCategorized.counts || { materials: 0, summaries: 0, flashcards: 0, mcqs: 0 };
  const currentList = folderCategorized[activeFolderTab] || [];
  const emptyCfg = emptyStateConfig[activeFolderTab] || emptyStateConfig.materials;

  const chips = [
    { key: "materials", label: "📄 Files", count: counts.materials },
    { key: "summaries", label: "✎ Summary", count: counts.summaries },
    { key: "flashcards", label: "🎴 Cards", count: counts.flashcards },
    { key: "mcqs", label: "✎ MCQs", count: counts.mcqs },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1080px] p-5 sm:p-6" style={{ paddingBottom: "80px" }}>
        {/* Back button */}
        <button
          onClick={onClose}
          className="mb-4 inline-flex items-center gap-1.5 rounded-[10px] border border-hub-border bg-hub-surface px-3.5 py-2 text-[13.5px] font-semibold text-hub-text-muted transition-all active:scale-95"
        >
          ← My Space
        </button>

        {/* Header row */}
        <div className="cs-header-row mb-[18px] flex items-center justify-between">
          <div className="cs-titleblock flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[28px] font-extrabold text-gold" style={{ fontFamily: "'Syne', sans-serif" }}>
              {folderDetail?.courseCode || folderDetail?.name || "Loading…"}
            </h1>
            {folderDetail?.level && (
              <span
                className="rounded-lg border px-2.5 py-1 text-[12px] font-semibold"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "#F5A623", borderColor: "rgba(245,166,35,0.4)", background: "rgba(245,166,35,0.08)" }}
              >
                {folderDetail.level}
              </span>
            )}
            {folderDetail?.semester && (
              <span
                className="rounded-lg border px-2.5 py-1 text-[12px] font-semibold"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3DD68C", borderColor: "rgba(61,214,140,0.4)", background: "rgba(61,214,140,0.08)" }}
              >
                {folderDetail.semester}
              </span>
            )}
          </div>
          {folderDetail && (
            <div className="flex shrink-0 gap-2">
              {!folderIsOwner && folderDetail.visibility !== "private" && (
                <button
                  onClick={() => onToggleFolderBookmark(folderDetail)}
                  disabled={folderBookmarkBusyId === folderDetail.id}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-hub-border bg-hub-surface transition-all active:scale-90"
                  style={{
                    color: folderBookmarkedIds?.has(folderDetail.id) ? "#F5A623" : "#8B93A7",
                    opacity: folderBookmarkBusyId === folderDetail.id ? 0.5 : 1,
                  }}
                  title={folderBookmarkedIds?.has(folderDetail.id) ? "Remove from my space" : "Save to my space"}
                >
                  {folderBookmarkedIds?.has(folderDetail.id) ? "★" : "☆"}
                </button>
              )}
              {folderDetail.visibility === "link" && (
                <button
                  onClick={() => onShareFolder(folderDetail)}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-hub-border bg-hub-surface text-base transition-all active:scale-90"
                  style={{ color: "#8B93A7" }}
                >
                  ⤴
                </button>
              )}
              {folderIsOwner && (
                <button
                  onClick={() => onDeleteFolder(folderDetail.id)}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-hub-border bg-hub-surface text-base transition-all active:scale-90"
                  style={{ color: "#FF5470" }}
                >
                  🗑
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add to space button */}
        {folderDetail && (
          <button
            onClick={() => onUploadToFolder(folderDetail.id)}
            className="cs-addbtn mb-[22px] inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-[14px] font-bold transition-all active:scale-95"
            style={{ color: "#1A1200", border: "none" }}
          >
            📎 Add to space
          </button>
        )}

        {/* Filter chips */}
        <div className="cs-chiprow mb-5 flex gap-2">
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

        {/* Grid */}
        {folderLoading ? (
          <LoadingState grid count={4} />
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
