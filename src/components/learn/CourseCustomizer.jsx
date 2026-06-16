import { useState, useEffect } from "react";
import { getDepartments } from "../../lib/departments.js";

const STORAGE_KEY = "sc_user_courses";

export function loadUserCourses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveUserCourses(courses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch {}
}

export default function CourseCustomizer({ allSubjects, activeDept, activeYearLevel, onClose, onCoursesChange }) {
  const [tab, setTab] = useState("mine");
  const [departments, setDepartments] = useState([]);
  const [browseDeptId, setBrowseDeptId] = useState(null);
  const [enabledIds, setEnabledIds] = useState(() => {
    const saved = loadUserCourses();
    if (saved) return new Set(saved);
    return new Set(allSubjects.map((s) => s.id));
  });

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {});
  }, []);

  const myCourses = allSubjects.filter(
    (s) => s.departmentId === activeDept?.id && (activeYearLevel ? s.yearLevel === activeYearLevel : true)
  );

  const browseDept = departments.find((d) => d.id === browseDeptId);
  const otherCourses = browseDeptId
    ? allSubjects.filter((s) => s.departmentId === browseDeptId)
    : [];

  function toggleCourse(id) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const arr = [...next];
      saveUserCourses(arr);
      onCoursesChange?.(arr);
      return next;
    });
  }

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(7,8,15,0.85)", zIndex: 1000,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  };
  const sheet = {
    background: "#0d0f20", borderRadius: "20px 20px 0 0", border: "0.5px solid #1e2245",
    padding: "24px 20px 40px", width: "100%", maxWidth: "480px", maxHeight: "88vh", overflowY: "auto",
  };
  const tabBtn = (active) => ({
    flex: 1, padding: "10px", background: active ? "#1a237e" : "transparent",
    border: active ? "none" : "none", borderRadius: "8px",
    color: active ? "#e8eaf6" : "#7b82b8", fontWeight: active ? 600 : 400,
    cursor: "pointer", fontSize: "14px",
  });
  const row = (enabled) => ({
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 14px", borderRadius: "10px", marginBottom: "6px",
    background: "#0a0b18", border: "0.5px solid #1e2245",
  });

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={sheet}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ color: "#e8eaf6", fontSize: "17px", fontWeight: 700, margin: 0 }}>My Courses</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#7b82b8", fontSize: "22px", cursor: "pointer" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#0a0b18", borderRadius: "10px", padding: "4px", marginBottom: "16px" }}>
          <button style={tabBtn(tab === "mine")} onClick={() => setTab("mine")}>My Courses</button>
          <button style={tabBtn(tab === "other")} onClick={() => setTab("other")}>Other Departments</button>
        </div>

        {/* My Courses tab */}
        {tab === "mine" && (
          <>
            {myCourses.length === 0 && (
              <div style={{ color: "#4a5080", textAlign: "center", padding: "32px 16px", fontSize: "14px" }}>
                No courses found for your department & year level.
              </div>
            )}
            {myCourses.map((s) => (
              <div key={s.id} style={row(enabledIds.has(s.id))}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>{s.icon || "📚"}</span>
                  <div>
                    <div style={{ color: "#e8eaf6", fontWeight: 600, fontSize: "14px" }}>{s.label}</div>
                    {s.description && <div style={{ color: "#4a5080", fontSize: "12px" }}>{s.description}</div>}
                  </div>
                </div>
                <button
                  onClick={() => toggleCourse(s.id)}
                  style={{
                    width: "40px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                    background: enabledIds.has(s.id) ? "#1a237e" : "#1e2245",
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: "3px", left: enabledIds.has(s.id) ? "18px" : "3px",
                    width: "18px", height: "18px", borderRadius: "50%",
                    background: enabledIds.has(s.id) ? "#7986cb" : "#4a5080",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Other departments tab */}
        {tab === "other" && (
          <>
            {!browseDeptId ? (
              <>
                <p style={{ color: "#7b82b8", fontSize: "13px", marginBottom: "12px" }}>Browse and add courses from other departments</p>
                {departments.filter((d) => d.id !== activeDept?.id).map((d) => (
                  <div key={d.id} onClick={() => setBrowseDeptId(d.id)} style={{
                    ...row(false), cursor: "pointer",
                    justifyContent: "flex-start", gap: "12px",
                  }}>
                    <span style={{ fontSize: "22px" }}>{d.icon || "🏛️"}</span>
                    <div>
                      <div style={{ color: "#e8eaf6", fontWeight: 600 }}>{d.name}</div>
                      <div style={{ color: "#4a5080", fontSize: "12px" }}>{d._count?.subjects || 0} courses</div>
                    </div>
                    <span style={{ marginLeft: "auto", color: "#4a5080" }}>›</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <button onClick={() => setBrowseDeptId(null)} style={{
                  background: "none", border: "none", color: "#7b82b8", cursor: "pointer",
                  fontSize: "13px", marginBottom: "12px", padding: 0,
                }}>
                  ← Back to departments
                </button>
                <div style={{ color: "#e8eaf6", fontWeight: 700, marginBottom: "12px" }}>
                  {browseDept?.icon} {browseDept?.name}
                </div>
                {otherCourses.length === 0 && (
                  <div style={{ color: "#4a5080", textAlign: "center", padding: "24px" }}>No courses in this department yet.</div>
                )}
                {otherCourses.map((s) => (
                  <div key={s.id} style={row(enabledIds.has(s.id))}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{s.icon || "📚"}</span>
                      <div>
                        <div style={{ color: "#e8eaf6", fontWeight: 600, fontSize: "14px" }}>{s.label}</div>
                        <div style={{ color: "#4a5080", fontSize: "12px" }}>Year {s.yearLevel || "?"}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCourse(s.id)}
                      style={{
                        padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                        background: enabledIds.has(s.id) ? "#2a0a0a" : "#0f2a1a",
                        color: enabledIds.has(s.id) ? "#ef9a9a" : "#a5d6a7",
                        fontSize: "12px", fontWeight: 600,
                      }}
                    >
                      {enabledIds.has(s.id) ? "Remove" : "+ Add"}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
