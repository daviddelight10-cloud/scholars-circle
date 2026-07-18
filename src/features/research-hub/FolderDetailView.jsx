import ResourceCard from "./ResourceCard";
import { getSubjectColor } from "./subjectColors";

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
  uploadModal, createFolderModal, bookmarkPicker,
}) {
  const folderSubTabs = [
    ["materials", "📄 Materials", folderCategorized.materials.length],
    ["summaries", "📝 Summary", folderCategorized.summaries.length],
    ["flashcards", "🎴 Cards", folderCategorized.flashcards.length],
    ["mcqs", "✎ MCQs", folderCategorized.mcqs.length],
  ];
  const currentList = folderCategorized[activeFolderTab] || [];
  const emptyCfg = emptyStateConfig[activeFolderTab] || emptyStateConfig.materials;
  const sc = getSubjectColor(folderDetail?.courseCode || folderDetail?.name);

  return (
    <>
      <div className="mx-auto max-w-[1200px] p-6">
        <div className="mb-8 flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-2 rounded-lg border border-hub-border bg-hub-bg px-3 py-2 text-[13px] text-hub-text-muted transition-all active:scale-95">
            ← My Space
          </button>
          <div className="flex-1">
            <div className="text-xl font-bold text-gold">{folderDetail?.name || "Loading…"}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {folderDetail?.courseCode && <span className="text-[11px] text-hub-text-muted">{folderDetail.courseCode}</span>}
              {folderDetail?.level && (
                <span className="rounded border border-gold-border bg-hub-bg px-2 py-0.5 text-[10px] text-gold">{folderDetail.level}</span>
              )}
              {folderDetail?.semester && (
                <span className="rounded border border-success-border bg-success-bg px-2 py-0.5 text-[10px] text-success-text">{folderDetail.semester}</span>
              )}
            </div>
          </div>
          {folderDetail && (
            <div className="flex gap-2">
              {!folderIsOwner && folderDetail.visibility !== "private" && (
                <button
                  onClick={() => onToggleFolderBookmark(folderDetail)}
                  disabled={folderBookmarkBusyId === folderDetail.id}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-lg transition-all active:scale-90"
                  style={{
                    color: folderBookmarkedIds?.has(folderDetail.id) ? "#FFD700" : "#555",
                    opacity: folderBookmarkBusyId === folderDetail.id ? 0.5 : 1,
                  }}
                  title={folderBookmarkedIds?.has(folderDetail.id) ? "Remove from my space" : "Save to my space"}
                >
                  {folderBookmarkedIds?.has(folderDetail.id) ? "★" : "☆"}
                </button>
              )}
              {folderDetail.visibility === "link" && (
                <button onClick={() => onShareFolder(folderDetail)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-base transition-all active:scale-90">🔗</button>
              )}
              {folderIsOwner && (
                <button onClick={() => onDeleteFolder(folderDetail.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-base transition-all active:scale-90" style={{ color: "#ef9a9a" }}>🗑</button>
              )}
            </div>
          )}
        </div>

        {folderDetail && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => onUploadToFolder(folderDetail.id)}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-hub-bg transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #b8860b, #FFD700)", border: "none" }}
            >
              📎 Add to space
            </button>
          </div>
        )}

        <div className="sc-tabrow mb-4 flex gap-2 overflow-x-auto border-b border-hub-border">
          {folderSubTabs.map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setActiveFolderTab(key)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                activeFolderTab === key
                  ? "border-gold font-bold text-gold"
                  : "border-transparent text-hub-text-dim hover:text-hub-text-muted"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeFolderTab === key ? "bg-gold-dim text-gold" : "bg-hub-border text-hub-text-dim"
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {folderLoading ? (
          <div className="px-5 py-16 text-center text-[13px] text-hub-text-dim">Loading space contents…</div>
        ) : currentList.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {currentList.map((resource, i) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                isBookmarked={bookmarkedIds.has(resource.id)}
                bookmarkBusy={bookmarkBusyId === resource.id}
                onOpen={onOpen}
                onToggleBookmark={onToggleBookmark}
                onShare={onShare}
                mcqProgress={mcqProgress}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <div className="mb-2 text-4xl">{emptyCfg.icon}</div>
            <div className="mb-1 text-sm font-bold text-hub-text-muted">{emptyCfg.message}</div>
            <div className="mx-auto max-w-md text-[13px] leading-relaxed text-hub-text-dim">{emptyCfg.cta}</div>
          </div>
        )}
      </div>
      {uploadModal}
      {createFolderModal}
      {bookmarkPicker}
    </>
  );
}
