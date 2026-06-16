import { useState, useEffect } from "react";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../../lib/departments.js";

const BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const EMOJI_OPTIONS = ["🩺","💉","🔬","💊","🦷","🧬","🏥","⚕️","🧪","📋","🫀","🧠","👁️","🦴","🩻","📐","⚖️","🌿","💻","🎓"];

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
}

async function getSubjects() {
  const res = await fetch(`${BASE}/subjects`);
  return res.ok ? res.json() : [];
}

async function patchSubject(id, data) {
  const res = await authFetch(`${BASE}/subjects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to update course");
  return res.json();
}

// Returns the list of departmentIds currently assigned to a subject (union of primary + join table)
function getSubjectDeptIds(subject) {
  const fromJoin = (subject.subjectDepts || []).map(d => d.departmentId);
  if (fromJoin.length > 0) return fromJoin;
  return subject.departmentId ? [subject.departmentId] : [];
}

export default function DepartmentManager() {
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDeptId, setActiveDeptId] = useState(null);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showEditDept, setShowEditDept] = useState(null);
  const [showEditCourse, setShowEditCourse] = useState(null);
  const [saving, setSaving] = useState(null); // subjectId being toggled
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([getDepartments(), getSubjects()])
      .then(([depts, subs]) => { setDepartments(depts); setSubjects(subs); })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  function updateSubjectLocal(updated) {
    setSubjects(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
  }

  async function handleCreateDept(name, icon) {
    try {
      const d = await createDepartment(name, icon);
      setDepartments(prev => [...prev, { ...d, _count: { subjects: 0 } }]);
      setShowAddDept(false);
      showToast("Department created");
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleUpdateDept(id, name, icon) {
    try {
      const d = await updateDepartment(id, { name, icon });
      setDepartments(prev => prev.map(x => x.id === id ? { ...x, ...d } : x));
      setShowEditDept(null);
      showToast("Department updated");
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleDeleteDept(id) {
    if (!window.confirm("Delete this department?")) return;
    try {
      await deleteDepartment(id);
      setDepartments(prev => prev.filter(x => x.id !== id));
      if (activeDeptId === id) setActiveDeptId(null);
      showToast("Department deleted");
    } catch (err) { showToast(err.message, "error"); }
  }

  // Quick toggle: add or remove a single dept from a subject
  async function quickToggleDept(subject, deptId) {
    setSaving(subject.id);
    try {
      const current = getSubjectDeptIds(subject);
      const next = current.includes(deptId)
        ? current.filter(id => id !== deptId)   // remove
        : [...current, deptId];                  // add
      const updated = await patchSubject(subject.id, {
        departmentIds: next,
        departmentId: next[0] ?? null,
        yearLevel: subject.yearLevel,
        icon: subject.icon,
      });
      updateSubjectLocal(updated);
      showToast(current.includes(deptId) ? "Removed from department" : "Added to department");
    } catch (err) { showToast(err.message, "error"); }
    finally { setSaving(null); }
  }

  // Full edit (year level, icon, multiple depts)
  async function handleEditCourse(id, data) {
    try {
      const updated = await patchSubject(id, data);
      updateSubjectLocal(updated);
      setShowEditCourse(null);
      showToast("Course updated");
    } catch (err) { showToast(err.message, "error"); }
  }

  // Subjects in the active dept
  const deptCourses = activeDeptId
    ? subjects.filter(s => getSubjectDeptIds(s).includes(activeDeptId))
    : [];

  // Subjects NOT in the active dept (available to add)
  const otherCourses = activeDeptId
    ? subjects.filter(s => !getSubjectDeptIds(s).includes(activeDeptId))
    : [];

  const filteredOther = searchQuery
    ? otherCourses.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : otherCourses;

  // Count per dept (live, from local state)
  function deptCount(deptId) {
    return subjects.filter(s => getSubjectDeptIds(s).includes(deptId)).length;
  }

  const baseCard = {
    background: "#0a0b18", border: "0.5px solid #1e2245", borderRadius: "12px",
    padding: "12px 14px", marginBottom: "7px", display: "flex", alignItems: "center", gap: "12px",
  };

  if (loading) return <div style={{ color: "#7b82b8", padding: "24px", textAlign: "center" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: "800px" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          padding: "12px 20px", borderRadius: "10px", fontWeight: 600, fontSize: "14px",
          background: toast.type === "error" ? "#2a0a0a" : "#0f2a1a",
          color: toast.type === "error" ? "#ef9a9a" : "#a5d6a7",
          border: `0.5px solid ${toast.type === "error" ? "#4a1010" : "#1a5a2a"}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ color: "#e8eaf6", fontSize: "18px", fontWeight: 700, margin: 0 }}>Departments & Courses</h2>
        <button onClick={() => setShowAddDept(true)} style={{
          padding: "9px 16px", background: "#1a237e", border: "none", borderRadius: "10px",
          color: "#e8eaf6", fontWeight: 600, fontSize: "13px", cursor: "pointer",
        }}>+ Add Department</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: activeDeptId ? "260px 1fr" : "1fr", gap: "18px" }}>

        {/* ── Left: Department list ── */}
        <div>
          <div style={{ color: "#7b82b8", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
            Departments ({departments.length})
          </div>
          {departments.length === 0 && (
            <div style={{ color: "#4a5080", fontSize: "13px", padding: "16px 0" }}>No departments yet.</div>
          )}
          {departments.map(d => (
            <div key={d.id}
              onClick={() => { setActiveDeptId(activeDeptId === d.id ? null : d.id); setSearchQuery(""); }}
              style={{
                ...baseCard, cursor: "pointer",
                background: activeDeptId === d.id ? "#0f1535" : "#0a0b18",
                border: activeDeptId === d.id ? "1px solid #3949ab" : "0.5px solid #1e2245",
              }}
            >
              <span style={{ fontSize: "22px" }}>{d.icon || "🏛️"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e8eaf6", fontWeight: 600, fontSize: "14px" }}>{d.name}</div>
                <div style={{ color: "#4a5080", fontSize: "12px" }}>{deptCount(d.id)} courses</div>
              </div>
              <button onClick={e => { e.stopPropagation(); setShowEditDept(d); }}
                style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "15px", padding: "4px" }}>✏️</button>
              <button onClick={e => { e.stopPropagation(); handleDeleteDept(d.id); }}
                style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "15px", padding: "4px" }}>🗑️</button>
            </div>
          ))}
        </div>

        {/* ── Right: Course panel ── */}
        {activeDeptId && (() => {
          const deptName = departments.find(d => d.id === activeDeptId)?.name || "";
          return (
            <div>
              {/* Assigned courses */}
              <div style={{ color: "#7b82b8", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
                In {deptName} ({deptCourses.length})
              </div>

              {deptCourses.length === 0 && (
                <div style={{ color: "#4a5080", fontSize: "13px", padding: "10px 0 16px", fontStyle: "italic" }}>
                  No courses yet — add from below ↓
                </div>
              )}

              {deptCourses.map(s => (
                <div key={s.id} style={{ ...baseCard, background: "#0a1a10", border: "0.5px solid #1a4a2a" }}>
                  <span style={{ fontSize: "18px" }}>{s.icon || "📚"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#a5d6a7", fontWeight: 600, fontSize: "14px" }}>{s.label}</div>
                    <div style={{ color: "#4a5080", fontSize: "12px" }}>
                      Year {s.yearLevel || "?"} · {s.questions?.length || 0}Q
                      {getSubjectDeptIds(s).length > 1 && (
                        <span style={{ color: "#7986cb", marginLeft: "6px" }}>
                          +{getSubjectDeptIds(s).length - 1} other dept{getSubjectDeptIds(s).length > 2 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEditCourse(s)}
                    style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "13px", padding: "4px 8px" }}
                  >✏️</button>
                  <button
                    disabled={saving === s.id}
                    onClick={() => quickToggleDept(s, activeDeptId)}
                    style={{
                      padding: "5px 10px", borderRadius: "7px", border: "0.5px solid #4a1010",
                      background: "#1a0808", color: "#ef9a9a", fontSize: "12px", fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >{saving === s.id ? "…" : "✕ Remove"}</button>
                </div>
              ))}

              {/* Divider */}
              <div style={{ borderTop: "0.5px solid #1e2245", margin: "16px 0 12px" }} />

              {/* Available courses to add */}
              <div style={{ color: "#7b82b8", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
                All other courses ({otherCourses.length}) — click + to add
              </div>

              {otherCourses.length > 4 && (
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search courses…"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: "8px", marginBottom: "10px",
                    background: "#0a0b18", border: "0.5px solid #1e2245", color: "#e8eaf6",
                    fontSize: "13px", outline: "none", boxSizing: "border-box",
                  }}
                />
              )}

              {filteredOther.length === 0 && (
                <div style={{ color: "#4a5080", fontSize: "13px", fontStyle: "italic" }}>No other courses found.</div>
              )}

              {filteredOther.map(s => (
                <div key={s.id} style={{ ...baseCard }}>
                  <span style={{ fontSize: "18px" }}>{s.icon || "📚"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#c5c9e8", fontSize: "14px" }}>{s.label}</div>
                    <div style={{ color: "#4a5080", fontSize: "12px" }}>
                      Year {s.yearLevel || "?"}
                      {getSubjectDeptIds(s).length > 0 && (
                        <span style={{ marginLeft: "6px", color: "#7986cb" }}>
                          · also in {getSubjectDeptIds(s).length} dept{getSubjectDeptIds(s).length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEditCourse(s)}
                    style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "13px", padding: "4px 8px" }}
                  >✏️</button>
                  <button
                    disabled={saving === s.id}
                    onClick={() => quickToggleDept(s, activeDeptId)}
                    style={{
                      padding: "5px 10px", borderRadius: "7px", border: "0.5px solid #1e3a1e",
                      background: "#0a1a0a", color: "#a5d6a7", fontSize: "12px", fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >{saving === s.id ? "…" : "+ Add"}</button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Modals */}
      {showAddDept && <DeptForm onSave={handleCreateDept} onClose={() => setShowAddDept(false)} />}
      {showEditDept && (
        <DeptForm existing={showEditDept}
          onSave={(name, icon) => handleUpdateDept(showEditDept.id, name, icon)}
          onClose={() => setShowEditDept(null)} />
      )}
      {showEditCourse && (
        <CourseForm
          course={showEditCourse}
          departments={departments}
          onSave={data => handleEditCourse(showEditCourse.id, data)}
          onClose={() => setShowEditCourse(null)}
        />
      )}
    </div>
  );
}

function DeptForm({ existing, onSave, onClose }) {
  const [name, setName] = useState(existing?.name || "");
  const [icon, setIcon] = useState(existing?.icon || EMOJI_OPTIONS[0]);

  const overlay = { position: "fixed", inset: 0, background: "rgba(7,8,15,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
  const card = { background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "360px" };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <h3 style={{ color: "#e8eaf6", fontWeight: 700, margin: "0 0 16px" }}>{existing ? "Edit" : "New"} Department</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Department name"
          style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px", background: "#0a0b18", border: "0.5px solid #1e2245", color: "#e8eaf6", fontSize: "15px", outline: "none", boxSizing: "border-box" }} />
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: "#7b82b8", fontSize: "12px", marginBottom: "8px" }}>Icon</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setIcon(e)} style={{
                width: "36px", height: "36px", borderRadius: "8px", cursor: "pointer",
                border: icon === e ? "2px solid #3949ab" : "0.5px solid #1e2245",
                background: icon === e ? "#0f1535" : "#0a0b18", fontSize: "18px",
              }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "#0a0b18", border: "0.5px solid #1e2245", borderRadius: "10px", color: "#7b82b8", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim(), icon)} style={{ flex: 2, padding: "11px", background: "#1a237e", border: "none", borderRadius: "10px", color: "#e8eaf6", fontWeight: 600, cursor: "pointer" }}>
            {existing ? "Save Changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseForm({ course, departments, onSave, onClose }) {
  const [selectedDeptIds, setSelectedDeptIds] = useState(
    () => {
      const fromJoin = (course.subjectDepts || []).map(d => d.departmentId);
      return fromJoin.length > 0 ? fromJoin : (course.departmentId ? [course.departmentId] : []);
    }
  );
  const [yearLevel, setYearLevel] = useState(course.yearLevel || 1);
  const [icon, setIcon] = useState(course.icon || "📚");

  function toggleDept(id) {
    setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const overlay = { position: "fixed", inset: 0, background: "rgba(7,8,15,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
  const card = { background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "380px" };
  const inp = { width: "100%", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px", background: "#0a0b18", border: "0.5px solid #1e2245", color: "#e8eaf6", fontSize: "15px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <h3 style={{ color: "#e8eaf6", fontWeight: 700, margin: "0 0 4px" }}>Edit Course</h3>
        <p style={{ color: "#7b82b8", fontSize: "13px", margin: "0 0 16px" }}>{course.label}</p>

        {/* Department checkboxes */}
        <div style={{ color: "#7b82b8", fontSize: "12px", marginBottom: "8px", fontWeight: 600 }}>
          Departments <span style={{ color: "#4a5080", fontWeight: 400 }}>(check to assign, uncheck to remove)</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px", maxHeight: "180px", overflowY: "auto" }}>
          {departments.map(d => {
            const checked = selectedDeptIds.includes(d.id);
            return (
              <label key={d.id} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                borderRadius: "8px", cursor: "pointer",
                background: checked ? "#0a1535" : "#0a0b18",
                border: `1px solid ${checked ? "#3949ab" : "#1e2245"}`,
                transition: "all 0.15s",
              }}>
                <input type="checkbox" checked={checked} onChange={() => toggleDept(d.id)}
                  style={{ accentColor: "#3949ab", width: "16px", height: "16px", flexShrink: 0 }} />
                <span style={{ fontSize: "18px" }}>{d.icon || "🏛️"}</span>
                <span style={{ color: checked ? "#7986cb" : "#94a3b8", fontSize: "14px", fontWeight: checked ? 700 : 400 }}>{d.name}</span>
                {checked && <span style={{ marginLeft: "auto", fontSize: "11px", color: "#3949ab", fontWeight: 700 }}>✓ ASSIGNED</span>}
              </label>
            );
          })}
        </div>

        {selectedDeptIds.length === 0 && (
          <div style={{ background: "#1a0a0a", border: "0.5px solid #4a1010", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px", color: "#ef9a9a", fontSize: "12px" }}>
            ⚠️ No departments selected — saving will fully unassign this course.
          </div>
        )}

        {/* Year Level */}
        <div style={{ color: "#7b82b8", fontSize: "12px", marginBottom: "6px", fontWeight: 600 }}>Year Level</div>
        <select value={yearLevel} onChange={e => setYearLevel(Number(e.target.value))} style={inp}>
          {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>

        {/* Icon */}
        <div style={{ color: "#7b82b8", fontSize: "12px", marginBottom: "6px", fontWeight: 600 }}>Icon</div>
        <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={2}
          style={{ ...inp, width: "64px", textAlign: "center", fontSize: "22px", marginBottom: "18px" }} />

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "#0a0b18", border: "0.5px solid #1e2245", borderRadius: "10px", color: "#7b82b8", cursor: "pointer" }}>Cancel</button>
          <button
            onClick={() => onSave({ departmentIds: selectedDeptIds, departmentId: selectedDeptIds[0] ?? null, yearLevel, icon })}
            style={{ flex: 2, padding: "11px", background: "#1a237e", border: "none", borderRadius: "10px", color: "#e8eaf6", fontWeight: 600, cursor: "pointer" }}
          >Save Changes</button>
        </div>
      </div>
    </div>
  );
}
