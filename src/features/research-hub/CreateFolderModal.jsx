import { useState, useEffect } from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles } from "./constants";
import { getDepartments } from "../../lib/departments.js";

export default function CreateFolderModal({
  show, onClose, onCreate,
  newName, setNewName,
  newCourseCode, setNewCourseCode,
  newVisibility, setNewVisibility,
  newLevel, setNewLevel,
  newSemester, setNewSemester,
  userDept,
  newFolderDeptIds, setNewFolderDeptIds,
}) {
  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [showDeptChange, setShowDeptChange] = useState(false);

  const hasDept = !!userDept?.departmentId;

  useEffect(() => {
    if (show && newVisibility === "shared") {
      setDeptLoading(true);
      getDepartments()
        .then((depts) => {
          setDepartments(depts || []);
          if (hasDept && newFolderDeptIds.length === 0) {
            setNewFolderDeptIds([userDept.departmentId]);
          }
        })
        .catch(() => setDepartments([]))
        .finally(() => setDeptLoading(false));
    }
    if (!show) {
      setShowDeptChange(false);
    }
  }, [show, newVisibility]);

  if (!show) return null;

  function handleDeptSelect(deptId) {
    if (deptId) {
      setNewFolderDeptIds([deptId]);
    }
  }

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
              <button key={key} onClick={() => {
                setNewVisibility(key);
                if (key === "shared" && hasDept && newFolderDeptIds.length === 0) {
                  setNewFolderDeptIds([userDept.departmentId]);
                }
              }} style={newVisibility === key ? sharedStyles.segActive : sharedStyles.seg}>{label}</button>
            ))}
          </div>
          <p style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: "6px", lineHeight: 1.4 }}>
            {newVisibility === "private" && "Only you can see this folder."}
            {newVisibility === "link" && "Anyone with the link can view this folder."}
            {newVisibility === "shared" && "Students in the selected department can access this folder."}
          </p>
        </div>

        {newVisibility === "shared" && (
          <div style={{ marginBottom: spacing.xl }}>
            <label style={sharedStyles.fieldLabel}>Department</label>

            {hasDept && !showDeptChange ? (
              <div style={{
                display: "flex", alignItems: "center", gap: spacing.sm,
                padding: "10px 14px", borderRadius: borderRadius.md,
                background: colors.surface, border: `0.5px solid ${colors.border}`,
              }}>
                <span style={{ fontSize: 20 }}>{userDept?.department?.icon || "🏛️"}</span>
                <span style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text }}>
                  {userDept?.department?.name || "Your department"}
                </span>
                <span style={{
                  fontSize: fontSize.xs, color: colors.textDim,
                  marginLeft: "auto", cursor: "pointer",
                }} onClick={() => setShowDeptChange(true)}>
                  Change
                </span>
              </div>
            ) : !hasDept ? (
              <div>
                <div style={{
                  padding: "10px 14px", borderRadius: borderRadius.md,
                  background: "rgba(255,193,7,0.08)", border: "0.5px solid rgba(255,193,7,0.25)",
                  marginBottom: spacing.sm, fontSize: fontSize.sm, color: "#ffc107",
                }}>
                  ⚠️ You haven't set a department yet. Pick one below — it will be saved to your profile.
                </div>
                {deptLoading ? (
                  <div style={{ fontSize: fontSize.sm, color: colors.textDim }}>Loading departments…</div>
                ) : (
                  <select
                    value={newFolderDeptIds[0] || ""}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    style={sharedStyles.select}
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.icon} {dept.name}</option>
                    ))}
                  </select>
                )}
                <div style={{ marginTop: spacing.sm, fontSize: fontSize.xs, color: colors.textDim }}>
                  Tip: You can also set your department from your{" "}
                  <span style={{ color: colors.text, textDecoration: "underline", cursor: "pointer" }}
                    onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("sc-navigate", { detail: { tab: "profile" } })); }}
                  >
                    Profile page
                  </span>.
                </div>
              </div>
            ) : (
              <div>
                {deptLoading ? (
                  <div style={{ fontSize: fontSize.sm, color: colors.textDim }}>Loading departments…</div>
                ) : (
                  <select
                    value={newFolderDeptIds[0] || ""}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    style={sharedStyles.select}
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.icon} {dept.name}</option>
                    ))}
                  </select>
                )}
                <div style={{ marginTop: spacing.sm, fontSize: fontSize.xs, color: colors.textDim, cursor: "pointer" }}
                  onClick={() => {
                    setShowDeptChange(false);
                    if (hasDept) setNewFolderDeptIds([userDept.departmentId]);
                  }}
                >
                  ← Use my current department
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={onCreate} disabled={!newName.trim()} style={{ ...sharedStyles.submit, opacity: !newName.trim() ? 0.5 : 1, cursor: !newName.trim() ? "not-allowed" : "pointer" }}>
          Create folder
        </button>
      </div>
    </div>
  );
}
