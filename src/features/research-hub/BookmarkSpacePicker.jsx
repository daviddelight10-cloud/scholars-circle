import { useState, useEffect } from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

export default function BookmarkSpacePicker({
  show,
  onClose,
  resource,
  folders,
  onConfirm,
  onCreateFolder,
}) {
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [busy, setBusy] = useState(false);

  const ownFolders = folders?.own || [];
  const sharedFolders = folders?.shared || [];
  const allFolders = [...ownFolders, ...sharedFolders];

  useEffect(() => {
    if (show && allFolders.length > 0 && !selectedFolderId) {
      setSelectedFolderId(allFolders[0].id);
    }
    if (!show) {
      setSelectedFolderId("");
    }
  }, [show, allFolders.length]);

  if (!show || !resource) return null;

  const handleConfirm = async () => {
    if (!selectedFolderId) return;
    setBusy(true);
    try {
      await onConfirm(resource, selectedFolderId);
    } finally {
      setBusy(false);
      setSelectedFolderId("");
    }
  };

  const handleClose = () => {
    if (busy) return;
    setSelectedFolderId("");
    onClose();
  };

  return (
    <div style={sharedStyles.overlay} onClick={handleClose}>
      <div style={sharedStyles.wizardModal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <h2 style={sharedStyles.modalTitle}>Add to space</h2>
          <button onClick={handleClose} style={sharedStyles.closeBtn}>✕</button>
        </div>

        <div style={{
          background: colors.bg, border: `0.5px solid ${colors.border}`,
          borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
        }}>
          <div style={{ fontSize: fontSize.sm, color: colors.textDim, marginBottom: "4px" }}>Saving</div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text }}>
            {resource.title}
          </div>
          {resource.subject && (
            <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: "2px" }}>
              {resource.subject}
            </div>
          )}
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <div style={{ ...sharedStyles.fieldLabel, marginBottom: spacing.sm }}>
            Choose a space <span style={{ color: goldText }}>*</span>
          </div>

          {allFolders.length === 0 ? (
            <div style={{
              fontSize: fontSize.sm, color: colors.textDim, textAlign: "center",
              padding: spacing.lg, border: `1px dashed ${colors.border}`, borderRadius: borderRadius.md,
            }}>
              No spaces yet. Create one to save this material.
            </div>
          ) : (
            allFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  ...sharedStyles.choiceCard,
                  borderColor: selectedFolderId === folder.id ? goldBorder : colors.border,
                  background: selectedFolderId === folder.id ? goldDim : colors.bg,
                  marginBottom: spacing.sm,
                  display: "flex", alignItems: "center", gap: spacing.md,
                }}
              >
                <div style={{ fontSize: 24 }}>{folder.visibility === "private" ? "📁" : "📂"}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {folder.name}
                  </div>
                  {folder.courseCode && (
                    <div style={{ fontSize: fontSize.xs, color: colors.textMuted }}>{folder.courseCode}</div>
                  )}
                </div>
                {selectedFolderId === folder.id && <div style={{ color: goldText, fontSize: 18, flexShrink: 0 }}>✓</div>}
              </div>
            ))
          )}

          {/* Create new space */}
          <div
            onClick={() => onCreateFolder()}
            style={{
              border: `1px dashed ${colors.border}`,
              borderRadius: borderRadius.md, padding: `${spacing.md} ${spacing.md}`,
              display: "flex", alignItems: "center", gap: spacing.md, cursor: "pointer",
              marginTop: spacing.sm,
            }}
          >
            <div style={{ fontSize: 24, color: colors.textMuted }}>+</div>
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold }}>
              Create new space
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg }}>
          <button onClick={handleClose} style={sharedStyles.wizardBackBtn}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={busy || !selectedFolderId}
            style={(busy || !selectedFolderId) ? sharedStyles.wizardBtnDisabled : sharedStyles.wizardBtnPrimary}
          >
            {busy ? "Saving…" : "Add to space ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
