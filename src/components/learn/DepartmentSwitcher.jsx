import { useState, useEffect } from "react";
import { getDepartments, setUserDepartment } from "../../lib/departments.js";

const YEAR_LEVELS = [1, 2, 3, 4, 5, 6];

function liveCount(subjects, deptId) {
  if (!subjects?.length) return null; // null = fall back to _count
  return subjects.filter(s =>
    s.departmentId === deptId ||
    (s.subjectDepts || []).some(d => d.departmentId === deptId)
  ).length;
}

export default function DepartmentSwitcher({ activeDept, activeYearLevel, activeSemester, subjects, onConfirm, onClose, onSkip, isOnboarding = false }) {
  const [departments, setDepartments] = useState([]);
  const [step, setStep] = useState("dept"); // "dept" | "year" | "semester"
  const [selectedDept, setSelectedDept] = useState(activeDept || null);
  const [selectedYear, setSelectedYear] = useState(activeYearLevel || 1);
  const [selectedSemester, setSelectedSemester] = useState(activeSemester || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    getDepartments()
      .then((d) => setDepartments(d))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  function handleSkip() {
    (onSkip || onClose)?.();
  }

  async function handleConfirm() {
    if (!selectedDept) return;
    setSaving(true);
    try {
      await setUserDepartment(selectedDept.id, selectedYear, selectedSemester);
      onConfirm(selectedDept, selectedYear, selectedSemester);
    } catch {
      setSaving(false);
    }
  }

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(7,8,15,0.88)", zIndex: 9000,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  };
  const sheet = {
    background: "#0d0f20", borderRadius: "20px 20px 0 0",
    border: "0.5px solid #1e2245", borderBottom: "none",
    padding: "28px 24px 48px",
    width: "100%", maxWidth: "520px",
    minHeight: "320px", maxHeight: "92vh", overflowY: "auto",
    animation: "deptSlideUp 0.32s cubic-bezier(0.32,0.72,0,1) forwards",
  };
  const pill = (active) => ({
    display: "flex", alignItems: "center", gap: "12px",
    padding: "14px 16px", borderRadius: "12px", cursor: "pointer",
    border: active ? "1.5px solid #B8860B" : "0.5px solid #1e2245",
    background: active ? "#0f1535" : "#0a0b18",
    color: active ? "#e8eaf6" : "#7b82b8",
    marginBottom: "8px", transition: "all 0.15s",
  });

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && !isOnboarding && onClose?.()}>
      <style>{`@keyframes deptSlideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={sheet}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h2 style={{ color: "#e8eaf6", fontSize: "18px", fontWeight: 700, margin: 0 }}>
              {step === "dept" ? (isOnboarding ? "Select your Department" : "Change Department") : "Select Year Level"}
            </h2>
            <p style={{ color: "#7b82b8", fontSize: "13px", margin: "4px 0 0" }}>
              {step === "dept" ? "Courses will be filtered to your department" : "We'll show courses for your year"}
            </p>
          </div>
          {!isOnboarding && (
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#7b82b8", fontSize: "22px", cursor: "pointer", padding: "4px" }}>
              ×
            </button>
          )}
        </div>

        {/* Step indicators */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {["dept", "year", "semester"].map((s) => (
            <div key={s} style={{
              flex: 1, height: "3px", borderRadius: "2px",
              background: s === step || (s === "dept" && (step === "year" || step === "semester")) || (s === "year" && step === "semester") ? "#B8860B" : "#1e2245",
            }} />
          ))}
        </div>

        {/* Step: Department */}
        {step === "dept" && (
          <>
            {loading ? (
              <div style={{ color: "#7b82b8", textAlign: "center", padding: "24px" }}>Loading departments…</div>
            ) : fetchError ? (
              <div style={{ textAlign: "center", padding: "24px" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
                <div style={{ fontWeight: 600, color: "#e8eaf6", marginBottom: 6 }}>Couldn't load departments</div>
                <div style={{ fontSize: 12, color: "#7b82b8", marginBottom: 16 }}>Check your connection or ask your teacher to set up departments.</div>
                <button onClick={handleSkip} style={{ width: "100%", padding: "13px", background: "#1a1a1a", color: "#e8eaf6", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>
                  Skip for now
                </button>
              </div>
            ) : departments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🏛️</div>
                <div style={{ fontWeight: 600, color: "#e8eaf6", marginBottom: 6 }}>No departments yet</div>
                <div style={{ fontSize: 12, color: "#7b82b8", marginBottom: 20 }}>
                  Your teacher hasn't created any departments yet. You can skip this and set it up later from the Learn tab.
                </div>
                <button onClick={handleSkip} style={{ width: "100%", padding: "13px", background: "#1a1a1a", color: "#e8eaf6", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>
                  Skip for now
                </button>
              </div>
            ) : (
              <>
                {departments.map((d) => (
                  <div key={d.id} style={pill(selectedDept?.id === d.id)} onClick={() => setSelectedDept(d)}>
                    <span style={{ fontSize: "24px" }}>{d.icon || "🏛️"}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "15px" }}>{d.name}</div>
                      <div style={{ fontSize: "12px", color: "#4a5080" }}>
                        {(() => { const c = liveCount(subjects, d.id); return c !== null ? c : (d._count?.subjects || 0); })()}{" "}courses
                      </div>
                    </div>
                    {selectedDept?.id === d.id && <span style={{ marginLeft: "auto", color: "#B8860B", fontSize: "18px" }}>✓</span>}
                  </div>
                ))}
                <button
                  onClick={() => selectedDept && setStep("year")}
                  disabled={!selectedDept}
                  style={{
                    width: "100%", marginTop: "16px", padding: "14px",
                    background: selectedDept ? "#1a1a1a" : "#1e2245", color: selectedDept ? "#e8eaf6" : "#4a5080",
                    border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: selectedDept ? "pointer" : "default",
                  }}
                >
                  Next →
                </button>
                {isOnboarding && (
                  <button onClick={handleSkip} style={{ width: "100%", marginTop: 8, padding: "10px", background: "none", border: "none", color: "#4a5080", fontSize: 13, cursor: "pointer" }}>
                    Skip for now
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* Step: Year Level */}
        {step === "year" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {YEAR_LEVELS.map((y) => (
                <button key={y} onClick={() => setSelectedYear(y)} style={{
                  padding: "18px 12px", borderRadius: "12px", cursor: "pointer",
                  border: selectedYear === y ? "1.5px solid #f59e0b" : "0.5px solid #1e2245",
                  background: selectedYear === y ? "#1a1000" : "#0a0b18",
                  color: selectedYear === y ? "#ffb74d" : "#7b82b8",
                  fontWeight: 700, fontSize: "16px",
                }}>
                  Year {y}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setStep("dept")} style={{
                flex: 1, padding: "14px", background: "#0a0b18", color: "#7b82b8",
                border: "0.5px solid #1e2245", borderRadius: "12px", fontSize: "14px", cursor: "pointer",
              }}>
                ← Back
              </button>
              <button onClick={() => setStep("semester")} style={{
                flex: 2, padding: "14px", background: "#1a1a1a", color: "#e8eaf6",
                border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer",
              }}>
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step: Semester */}
        {step === "semester" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {["First Semester", "Second Semester"].map((s) => (
                <button key={s} onClick={() => setSelectedSemester(s)} style={{
                  padding: "22px 14px", borderRadius: "12px", cursor: "pointer",
                  border: selectedSemester === s ? "1.5px solid #B8860B" : "0.5px solid #1e2245",
                  background: selectedSemester === s ? "#0f1535" : "#0a0b18",
                  color: selectedSemester === s ? "#e8eaf6" : "#7b82b8",
                  fontWeight: 700, fontSize: "15px",
                }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setStep("year")} style={{
                flex: 1, padding: "14px", background: "#0a0b18", color: "#7b82b8",
                border: "0.5px solid #1e2245", borderRadius: "12px", fontSize: "14px", cursor: "pointer",
              }}>
                ← Back
              </button>
              <button onClick={handleConfirm} disabled={saving || !selectedSemester} style={{
                flex: 2, padding: "14px", background: selectedSemester ? "#1a1a1a" : "#1e2245", color: "#e8eaf6",
                border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: selectedSemester ? "pointer" : "default",
              }}>
                {saving ? "Saving…" : `Confirm — ${selectedDept?.icon || "🏛️"} ${selectedDept?.name}, Year ${selectedYear}, ${selectedSemester || ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
