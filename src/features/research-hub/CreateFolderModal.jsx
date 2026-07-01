import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles } from "./constants";

export default function CreateFolderModal({
  show, onClose, onCreate,
  newName, setNewName,
  newCourseCode, setNewCourseCode,
  newVisibility, setNewVisibility,
  newLevel, setNewLevel,
  newSemester, setNewSemester,
}) {
  if (!show) return null;

  return (
    <div style={sharedStyles.overlay} onClick={onClose}>
      <div style={sharedStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
          <h2 style={sharedStyles.modalTitle}>Create folder</h2>
          <button onClick={onClose} style={sharedStyles.closeBtn}>✕</button>
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <label style={sharedStyles.fieldLabel}>Folder name</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Anatomy — Year 1" style={sharedStyles.input} />
        </div>
        <div style={{ marginBottom: spacing.md }}>
          <label style={sharedStyles.fieldLabel}>Course code (optional)</label>
          <input value={newCourseCode} onChange={(e) => setNewCourseCode(e.target.value)} placeholder="e.g. BIO 111" style={sharedStyles.input} />
        </div>
        <div style={{ display: "flex", gap: spacing.md, marginBottom: spacing.md }}>
          <div style={{ flex: 1 }}>
            <label style={sharedStyles.fieldLabel}>Level</label>
            <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)} style={sharedStyles.select}>
              <option value="">Any level</option>
              {["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={sharedStyles.fieldLabel}>Semester</label>
            <select value={newSemester} onChange={(e) => setNewSemester(e.target.value)} style={sharedStyles.select}>
              <option value="">Any semester</option>
              <option value="First Semester">First Semester</option>
              <option value="Second Semester">Second Semester</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: spacing.xl }}>
          <label style={sharedStyles.fieldLabel}>Visibility</label>
          <div style={sharedStyles.segmentRow}>
            {[["private", "🔒 Private"], ["link", "🔗 Link share"], ["shared", "👥 Department"]].map(([key, label]) => (
              <button key={key} onClick={() => setNewVisibility(key)} style={newVisibility === key ? sharedStyles.segActive : sharedStyles.seg}>{label}</button>
            ))}
          </div>
          <p style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: "6px", lineHeight: 1.4 }}>
            {newVisibility === "private" && "Only you can see this folder."}
            {newVisibility === "link" && "Anyone with the link can view this folder."}
            {newVisibility === "shared" && "Students in your department can access this folder."}
          </p>
        </div>

        <button onClick={onCreate} disabled={!newName.trim()} style={{ ...sharedStyles.submit, opacity: !newName.trim() ? 0.5 : 1, cursor: !newName.trim() ? "not-allowed" : "pointer" }}>
          Create folder
        </button>
      </div>
    </div>
  );
}
