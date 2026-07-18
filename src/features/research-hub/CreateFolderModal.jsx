import { useState, useEffect } from "react";
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-in w-full max-w-[460px] rounded-2xl border border-hub-border bg-hub-surface p-6"
        style={{ maxHeight: "86vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-hub-text">Create folder</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-sm text-hub-text-muted transition-all active:scale-90">✕</button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Folder name</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Anatomy — Year 1"
            className="w-full rounded-lg border border-hub-border bg-hub-bg px-3 py-2.5 text-sm text-hub-text outline-none transition-colors focus:border-gold-border" />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Course code (optional)</label>
          <input value={newCourseCode} onChange={(e) => setNewCourseCode(e.target.value)} placeholder="e.g. BIO 111"
            className="w-full rounded-lg border border-hub-border bg-hub-bg px-3 py-2.5 text-sm text-hub-text outline-none transition-colors focus:border-gold-border" />
        </div>

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Level</label>
            <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}
              className="w-full rounded-lg border border-hub-border bg-hub-bg px-3 py-2.5 text-sm text-hub-text outline-none cursor-pointer">
              <option value="">Any level</option>
              {["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Semester</label>
            <select value={newSemester} onChange={(e) => setNewSemester(e.target.value)}
              className="w-full rounded-lg border border-hub-border bg-hub-bg px-3 py-2.5 text-sm text-hub-text outline-none cursor-pointer">
              <option value="">Any semester</option>
              <option value="First Semester">First Semester</option>
              <option value="Second Semester">Second Semester</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Visibility</label>
          <div className="flex gap-1 rounded-lg border border-hub-border bg-hub-bg p-1">
            {[["private", "🔒 Private"], ["link", "🔗 Link share"], ["shared", "👥 Department"]].map(([key, label]) => (
              <button key={key} onClick={() => {
                setNewVisibility(key);
                if (key === "shared" && hasDept && newFolderDeptIds.length === 0) {
                  setNewFolderDeptIds([userDept.departmentId]);
                }
              }} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
                newVisibility === key
                  ? "bg-gold-dim text-gold border border-gold-border"
                  : "text-hub-text-dim hover:text-hub-text-muted border border-transparent"
              }`}>{label}</button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-hub-text-dim">
            {newVisibility === "private" && "Only you can see this folder."}
            {newVisibility === "link" && "Anyone with the link can view this folder."}
            {newVisibility === "shared" && "Students in the selected department can access this folder."}
          </p>
        </div>

        {newVisibility === "shared" && (
          <div className="mb-6">
            <label className="mb-1 block text-[11px] font-semibold text-hub-text-muted">Department</label>

            {hasDept && !showDeptChange ? (
              <div className="flex items-center gap-2 rounded-lg border border-hub-border bg-hub-surface px-3.5 py-2.5">
                <span className="text-xl">{userDept?.department?.icon || "🏛️"}</span>
                <span className="text-sm font-semibold text-hub-text">{userDept?.department?.name || "Your department"}</span>
                <span className="ml-auto cursor-pointer text-[11px] text-gold" onClick={() => setShowDeptChange(true)}>Change</span>
              </div>
            ) : !hasDept ? (
              <div>
                <div className="mb-2 rounded-lg border border-gold-border bg-gold-dim px-3.5 py-2.5 text-[12px] text-gold">
                  ⚠️ You haven't set a department yet. Pick one below — it will be saved to your profile.
                </div>
                {deptLoading ? (
                  <div className="text-[12px] text-hub-text-dim">Loading departments…</div>
                ) : (
                  <select
                    value={newFolderDeptIds[0] || ""}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    className="w-full rounded-lg border border-hub-border bg-hub-bg px-3 py-2.5 text-sm text-hub-text outline-none cursor-pointer"
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.icon} {dept.name}</option>
                    ))}
                  </select>
                )}
                <div className="mt-2 text-[10px] text-hub-text-dim">
                  Tip: You can also set your department from your{" "}
                  <span className="cursor-pointer text-gold underline"
                    onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("sc-navigate", { detail: { tab: "profile" } })); }}
                  >
                    Profile page
                  </span>.
                </div>
              </div>
            ) : (
              <div>
                {deptLoading ? (
                  <div className="text-[12px] text-hub-text-dim">Loading departments…</div>
                ) : (
                  <select
                    value={newFolderDeptIds[0] || ""}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    className="w-full rounded-lg border border-hub-border bg-hub-bg px-3 py-2.5 text-sm text-hub-text outline-none cursor-pointer"
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.icon} {dept.name}</option>
                    ))}
                  </select>
                )}
                <div className="mt-2 cursor-pointer text-[10px] text-hub-text-dim"
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

        <button
          onClick={onCreate}
          disabled={!newName.trim()}
          className="w-full rounded-lg py-3 text-sm font-bold text-hub-bg transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #b8860b, #FFD700)", border: "none", cursor: !newName.trim() ? "not-allowed" : "pointer" }}
        >
          Create folder
        </button>
      </div>
    </div>
  );
}
