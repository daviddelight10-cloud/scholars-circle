import ResourceCard from "./ResourceCard";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

const emptyStateConfig = {
  materials: { icon: "📄", message: "No materials in this space yet.", cta: "Upload PDFs, notes, or other files to get started." },
  summary: { icon: "📝", message: "No AI-generated summaries yet.", cta: "Upload a file and choose 'Generate Summary' to create one." },
  flashcards: { icon: "🎴", message: "No flashcard decks in this space yet.", cta: "Upload a file and choose 'Generate Flashcards' to create a deck." },
  mcqs: { icon: "✎", message: "No MCQ sets in this space yet.", cta: "Upload a file and choose 'Generate MCQs' or create manually." },
};

export default function FolderDetailView({
  folderDetail, folderLoading, folderCategorized, activeFolderTab, setActiveFolderTab,
  folderIsOwner, onClose, onShareFolder, onDeleteFolder,
  onUploadToFolder,
  bookmarkedIds, bookmarkFolderMap, bookmarkBusyId, onOpen, onToggleBookmark, onShare, mcqProgress,
  uploadModal, createFolderModal, bookmarkPicker,
}) {
  const folderSubTabs = [
    ["materials", "📄 Materials", folderCategorized.materials.length],
    ["summary", "📝 Summary", folderCategorized.summaries.length],
    ["flashcards", "🎴 Flash Cards", folderCategorized.flashcards.length],
    ["mcqs", "✎ MCQs", folderCategorized.mcqs.length],
  ];
  const currentList = folderCategorized[activeFolderTab] || [];
  const emptyCfg = emptyStateConfig[activeFolderTab] || emptyStateConfig.materials;

  return (
    <>
      <div style={{ padding: spacing.xl, maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}>
          <button onClick={onClose} style={sharedStyles.backBtn}>← My Space</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textBright }}>
              {folderDetail?.name || "Loading…"}
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: spacing.xs }}>
              {folderDetail?.courseCode && <span style={{ fontSize: fontSize.sm, color: colors.textMuted }}>{folderDetail.courseCode}</span>}
              {folderDetail?.level && (
                <span style={{
                  fontSize: fontSize.xs, padding: "2px 8px", borderRadius: borderRadius.sm,
                  background: "#1a1a1a", color: goldText, border: `0.5px solid ${goldBorder}`,
                }}>{folderDetail.level}</span>
              )}
              {folderDetail?.semester && (
                <span style={{
                  fontSize: fontSize.xs, padding: "2px 8px", borderRadius: borderRadius.sm,
                  background: colors.successBg, color: "#a5d6a7", border: `0.5px solid ${colors.successBorder}`,
                }}>{folderDetail.semester}</span>
              )}
            </div>
          </div>
          {folderDetail && (
            <div style={{ display: "flex", gap: spacing.sm }}>
              {folderDetail.visibility === "link" && (
                <button onClick={() => onShareFolder(folderDetail)} style={sharedStyles.iconActionBtn}>🔗</button>
              )}
              {folderIsOwner && (
                <button onClick={() => onDeleteFolder(folderDetail.id)} style={{ ...sharedStyles.iconActionBtn, color: "#ef9a9a" }}>🗑</button>
              )}
            </div>
          )}
        </div>

        {folderDetail && (
          <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" }}>
            <button onClick={() => onUploadToFolder(folderDetail.id)} style={{
              padding: "10px 20px", borderRadius: borderRadius.lg,
              background: `linear-gradient(135deg, #b8860b, ${goldText})`,
              border: "none", fontSize: fontSize.md, fontWeight: fontWeight.bold,
              color: "#0a0a0a", cursor: "pointer", display: "flex", alignItems: "center", gap: spacing.sm,
            }}>
              📎 Add to space
            </button>
          </div>
        )}

        <div className="sc-tabrow" style={{ ...sharedStyles.tabRow, marginBottom: spacing.lg }}>
          {folderSubTabs.map(([key, label, count]) => (
            <button key={key} onClick={() => setActiveFolderTab(key)} style={activeFolderTab === key ? sharedStyles.tabActive : sharedStyles.tab}>
              {label}
              {count > 0 && <span style={sharedStyles.tabCount}>{count}</span>}
            </button>
          ))}
        </div>

        {folderLoading ? (
          <div style={sharedStyles.emptyState}>Loading space contents…</div>
        ) : currentList.length > 0 ? (
          <div style={sharedStyles.grid}>
            {currentList.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                isBookmarked={bookmarkedIds.has(resource.id)}
                bookmarkBusy={bookmarkBusyId === resource.id}
                onOpen={onOpen}
                onToggleBookmark={onToggleBookmark}
                onShare={onShare}
                mcqProgress={mcqProgress}
              />
            ))}
          </div>
        ) : (
          <div style={sharedStyles.emptyState}>
            <div style={{ fontSize: 36, marginBottom: spacing.sm }}>{emptyCfg.icon}</div>
            <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
              {emptyCfg.message}
            </div>
            <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
              {emptyCfg.cta}
            </div>
          </div>
        )}
      </div>
      {uploadModal}
      {createFolderModal}
      {bookmarkPicker}
    </>
  );
}
