import { useState, useEffect } from "react";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../../lib/departments.js";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const EMOJI_OPTIONS = ["🩺", "💉", "🔬", "💊", "🦷", "🧬", "🏥", "⚕️", "🧪", "📋", "🫀", "🧠", "👁️", "🦴", "🩻"];

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

async function getSubjects() {
  const res = await fetch(`${BASE}/subjects`);
  return res.ok ? res.json() : [];
}

async function patchSubject(id, data) {
  const res = await authFetch(`${BASE}/subjects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update course");
  return res.json();
}

export default function DepartmentManager() {
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDeptId, setActiveDeptId] = useState(null);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showEditDept, setShowEditDept] = useState(null);
  const [showEditCourse, setShowEditCourse] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    Promise.all([getDepartments(), getSubjects()])
      .then(([depts, subs]) => { setDepartments(depts); setSubjects(subs); })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreateDept(name, icon) {
    try {
      const d = await createDepartment(name, icon);
      setDepartments((prev) => [...prev, { ...d, _count: { subjects: 0 } }]);
      setShowAddDept(false);
      showToast("Department created");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleUpdateDept(id, name, icon) {
    try {
      const d = await updateDepartment(id, { name, icon });
      setDepartments((prev) => prev.map((x) => x.id === id ? { ...x, ...d } : x));
      setShowEditDept(null);
      showToast("Department updated");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeleteDept(id) {
    try {
      await deleteDepartment(id);
      setDepartments((prev) => prev.filter((x) => x.id !== id));
      if (activeDeptId === id) setActiveDeptId(null);
      showToast("Department deleted");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleUpdateCourse(id, data) {
    try {
      const updated = await patchSubject(id, data);
      setSubjects((prev) => prev.map((s) => s.id === id ? { ...s, ...updated } : s));
      setShowEditCourse(null);
      showToast("Course updated");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const deptCourses = activeDeptId ? subjects.filter((s) => s.departmentId === activeDeptId) : [];
  const unassigned = subjects.filter((s) => !s.departmentId);

  const card = {
    background: "#0a0b18", border: "0.5px solid #1e2245", borderRadius: "12px",
    padding: "14px 16px", marginBottom: "8px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: "12px",
  };

  if (loading) return <div style={{ color: "#7b82b8", padding: "24px", textAlign: "center" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: "720px" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          padding: "12px 20px", borderRadius: "10px", fontWeight: 600, fontSize: "14px",
          background: toast.type === "error" ? "#2a0a0a" : "#0f2a1a",
          color: toast.type === "error" ? "#ef9a9a" : "#a5d6a7",
          border: `0.5px solid ${toast.type === "error" ? "#4a1010" : "#2a6a3a"}`,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ color: "#e8eaf6", fontSize: "18px", fontWeight: 700, margin: 0 }}>Departments & Courses</h2>
        <button onClick={() => setShowAddDept(true)} style={{
          padding: "9px 16px", background: "#1a237e", border: "none", borderRadius: "10px",
          color: "#e8eaf6", fontWeight: 600, fontSize: "13px", cursor: "pointer",
        }}>
          + Add Department
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: activeDeptId ? "1fr 1.4fr" : "1fr", gap: "16px" }}>
        {/* Department list */}
        <div>
          <div style={{ color: "#7b82b8", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
            Departments
          </div>
          {departments.length === 0 && (
            <div style={{ color: "#4a5080", fontSize: "13px", padding: "16px 0" }}>No departments yet. Add one above.</div>
          )}
          {departments.map((d) => (
            <div key={d.id}
              style={{ ...card, background: activeDeptId === d.id ? "#0f1535" : "#0a0b18", border: activeDeptId === d.id ? "0.5px solid #3949ab" : "0.5px solid #1e2245" }}
              onClick={() => setActiveDeptId(activeDeptId === d.id ? null : d.id)}
            >
              <span style={{ fontSize: "22px" }}>{d.icon || "🏛️"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e8eaf6", fontWeight: 600 }}>{d.name}</div>
                <div style={{ color: "#4a5080", fontSize: "12px" }}>{d._count?.subjects || subjects.filter((s) => s.departmentId === d.id).length} courses</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowEditDept(d); }} style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "16px" }}>✏️</button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteDept(d.id); }} style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "16px" }}>🗑️</button>
            </div>
          ))}

          {unassigned.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ color: "#4a5080", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
                Unassigned ({unassigned.length})
              </div>
              {unassigned.map((s) => (
                <div key={s.id} style={{ ...card, cursor: "default" }}>
                  <span style={{ fontSize: "18px" }}>{s.icon || "📚"}</span>
                  <div style={{ flex: 1, color: "#c5c9e8", fontSize: "14px" }}>{s.label}</div>
                  <button onClick={() => setShowEditCourse(s)} style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "14px" }}>Assign →</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course list for active dept */}
        {activeDeptId && (
          <div>
            <div style={{ color: "#7b82b8", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
              Courses in {departments.find((d) => d.id === activeDeptId)?.name}
            </div>
            {deptCourses.length === 0 && (
              <div style={{ color: "#4a5080", fontSize: "13px", padding: "16px 0" }}>
                No courses assigned yet. Use "Assign →" on unassigned courses.
              </div>
            )}
            {deptCourses.map((s) => (
              <div key={s.id} style={{ ...card, cursor: "default" }}>
                <span style={{ fontSize: "18px" }}>{s.icon || "📚"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e8eaf6", fontWeight: 600, fontSize: "14px" }}>{s.label}</div>
                  <div style={{ color: "#4a5080", fontSize: "12px" }}>Year {s.yearLevel || "?"} · {s.questions?.length || 0} questions</div>
                </div>
                <button onClick={() => setShowEditCourse(s)} style={{ background: "none", border: "none", color: "#7b82b8", cursor: "pointer", fontSize: "14px" }}>✏️</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Department modal */}
      {showAddDept && <DeptForm onSave={handleCreateDept} onClose={() => setShowAddDept(false)} />}
      {showEditDept && <DeptForm existing={showEditDept} onSave={(name, icon) => handleUpdateDept(showEditDept.id, name, icon)} onClose={() => setShowEditDept(null)} />}
      {showEditCourse && (
        <CourseForm
          course={showEditCourse}
          departments={departments}
          onSave={(data) => handleUpdateCourse(showEditCourse.id, data)}
          onClose={() => setShowEditCourse(null)}
        />
      )}
    </div>
  );
}

function DeptForm({ existing, onSave, onClose }) {
  const [name, setName] = useState(existing?.name || "");
  const [icon, setIcon] = useState(existing?.icon || EMOJI_OPTIONS[0]);

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(7,8,15,0.85)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
  };
  const card = {
    background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "16px",
    padding: "24px", width: "100%", maxWidth: "360px",
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <h3 style={{ color: "#e8eaf6", fontWeight: 700, margin: "0 0 16px" }}>{existing ? "Edit" : "New"} Department</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Department name"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
            background: "#0a0b18", border: "0.5px solid #1e2245", color: "#e8eaf6",
            fontSize: "15px", outline: "none", boxSizing: "border-box",
          }}
        />
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: "#7b82b8", fontSize: "12px", marginBottom: "8px" }}>Icon</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {EMOJI_OPTIONS.map((e) => (
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
  const [deptId, setDeptId] = useState(course.departmentId || "");
  const [yearLevel, setYearLevel] = useState(course.yearLevel || 1);
  const [icon, setIcon] = useState(course.icon || "📚");

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(7,8,15,0.85)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
  };
  const card = {
    background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "16px",
    padding: "24px", width: "100%", maxWidth: "360px",
  };
  const sel = {
    width: "100%", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
    background: "#0a0b18", border: "0.5px solid #1e2245", color: "#e8eaf6",
    fontSize: "15px", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <h3 style={{ color: "#e8eaf6", fontWeight: 700, margin: "0 0 4px" }}>Assign Course</h3>
        <p style={{ color: "#7b82b8", fontSize: "13px", margin: "0 0 16px" }}>{course.label}</p>

        <label style={{ color: "#7b82b8", fontSize: "12px" }}>Department</label>
        <select value={deptId} onChange={(e) => setDeptId(e.target.value)} style={sel}>
          <option value="">-- Unassigned --</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
        </select>

        <label style={{ color: "#7b82b8", fontSize: "12px" }}>Year Level</label>
        <select value={yearLevel} onChange={(e) => setYearLevel(Number(e.target.value))} style={sel}>
          {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>

        <label style={{ color: "#7b82b8", fontSize: "12px", display: "block", marginBottom: "6px" }}>Icon</label>
        <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} style={{ ...sel, width: "60px", textAlign: "center", fontSize: "20px", marginBottom: "16px" }} />

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "#0a0b18", border: "0.5px solid #1e2245", borderRadius: "10px", color: "#7b82b8", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onSave({ departmentId: deptId || null, yearLevel, icon })} style={{ flex: 2, padding: "11px", background: "#1a237e", border: "none", borderRadius: "10px", color: "#e8eaf6", fontWeight: 600, cursor: "pointer" }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
