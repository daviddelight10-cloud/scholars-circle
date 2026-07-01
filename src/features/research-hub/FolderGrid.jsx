import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

function FolderCard({ folder, onClick, shared = false }) {
  const itemCount = folder._count?.resources ?? 0;

  return (
    <div style={sharedStyles.folderCard} onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderActive; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.boxShadow = "none"; }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <div style={{ fontSize: 28 }}>{shared ? "📂" : "📁"}</div>
        {itemCount > 0 && (
          <span style={{
            fontSize: fontSize.xs, fontWeight: fontWeight.bold, padding: "3px 10px",
            borderRadius: borderRadius.pill, background: goldDim,
            color: goldText, border: `0.5px solid ${goldBorder}`,
          }}>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
        )}
      </div>

      <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#e8e8e8", marginBottom: spacing.xs }}>
        {folder.name}
      </div>

      {folder.courseCode && (
        <div style={{ fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm }}>{folder.courseCode}</div>
      )}

      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: spacing.sm }}>
        {folder.level && (
          <span style={{
            fontSize: fontSize.xs, padding: "2px 8px", borderRadius: borderRadius.sm,
            background: "#1a1a1a", color: goldText, border: `0.5px solid ${goldBorder}`,
          }}>{folder.level}</span>
        )}
        {folder.semester && (
          <span style={{
            fontSize: fontSize.xs, padding: "2px 8px", borderRadius: borderRadius.sm,
            background: colors.successBg, color: "#a5d6a7", border: `0.5px solid ${colors.successBorder}`,
          }}>{folder.semester}</span>
        )}
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{
          fontSize: fontSize.xs, padding: "2px 8px", borderRadius: borderRadius.sm,
          background: folder.visibility === "private" ? "#1a0808" : colors.successBg,
          color: folder.visibility === "private" ? "#ef9a9a" : "#a5d6a7",
          border: `0.5px solid ${folder.visibility === "private" ? "#4a1010" : colors.successBorder}`,
        }}>
          {folder.visibility === "private" ? "🔒 Private" : folder.visibility === "link" ? "🔗 Link" : "👥 Shared"}
        </span>
        {shared && folder.owner?.username && (
          <span style={{ fontSize: fontSize.xs, color: colors.textDim }}>by {folder.owner.username}</span>
        )}
      </div>
    </div>
  );
}

export default function FolderGrid({ folders, sharedFolders, search, onOpenFolder, onCreateFolder }) {
  const filteredOwn = (folders || []).filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const filteredShared = (sharedFolders || []).filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const hasAny = filteredOwn.length > 0 || filteredShared.length > 0;

  if (!hasAny && !search) {
    return (
      <div style={sharedStyles.emptyState}>
        <div style={{ fontSize: 48, marginBottom: spacing.md }}>📁</div>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm }}>No folders yet</div>
        <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
          Create a folder to organize your study materials. You can make private folders or share them with your department.
        </div>
        <button onClick={onCreateFolder} style={{ ...sharedStyles.addBtn, marginTop: spacing.xl }}>+ Create your first folder</button>
      </div>
    );
  }

  return (
    <div>
      {filteredOwn.length > 0 && (
        <div style={{ marginBottom: spacing.xxl }}>
          <div style={sharedStyles.sectionLabel}>My Folders</div>
          <div style={sharedStyles.folderGrid}>
            {filteredOwn.map((folder) => (
              <FolderCard key={folder.id} folder={folder} onClick={() => onOpenFolder(folder.id)} />
            ))}
          </div>
        </div>
      )}

      {filteredShared.length > 0 && (
        <div>
          <div style={sharedStyles.sectionLabel}>Shared With Me</div>
          <div style={sharedStyles.folderGrid}>
            {filteredShared.map((folder) => (
              <FolderCard key={folder.id} folder={folder} shared onClick={() => onOpenFolder(folder.id)} />
            ))}
          </div>
        </div>
      )}

      {!hasAny && search && (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>🔍</div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim }}>No folders match "{search}"</div>
        </div>
      )}
    </div>
  );
}
