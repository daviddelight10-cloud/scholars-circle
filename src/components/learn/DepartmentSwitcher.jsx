import { useState, useEffect } from "react";
import { getDepartments, setUserDepartment } from "../../lib/departments.js";
import { getUniversities, createUniversity } from "../../lib/universities.js";
import { saveMyProfile } from "../../lib/profileApi.js";

const YEAR_LEVELS = [1, 2, 3, 4, 5, 6];
const GRADE_LEVELS = ["SS1", "SS2", "SS3", "JSS1", "JSS2", "JSS3"];

function liveCount(subjects, deptId) {
  if (!subjects?.length) return null;
  return subjects.filter(s =>
    s.departmentId === deptId ||
    (s.subjectDepts || []).some(d => d.departmentId === deptId)
  ).length;
}

export default function DepartmentSwitcher({ activeDept, activeYearLevel, activeSemester, subjects, onConfirm, onClose, onSkip, isOnboarding = false, initialUniversityId }) {
  const [step, setStep] = useState("uni");
  const [universities, setUniversities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedUni, setSelectedUni] = useState(null);
  const [isUniStudent, setIsUniStudent] = useState(true);
  const [uniQuery, setUniQuery] = useState("");
  const [showUniCreate, setShowUniCreate] = useState(false);
  const [newUniName, setNewUniName] = useState("");
  const [selectedDept, setSelectedDept] = useState(activeDept || null);
  const [selectedYear, setSelectedYear] = useState(activeYearLevel || 1);
  const [selectedSemester, setSelectedSemester] = useState(activeSemester || null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deptLoading, setDeptLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    getUniversities()
      .then((u) => setUniversities(u))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialUniversityId && universities.length > 0) {
      const uni = universities.find(u => u.id === initialUniversityId);
      if (uni) {
        setSelectedUni(uni);
        setStep("dept");
        loadDepartments(uni.id);
      }
    }
  }, [initialUniversityId, universities]);

  const filteredUnis = universities.filter(u =>
    !uniQuery || u.name.toLowerCase().includes(uniQuery.toLowerCase())
  );

  async function loadDepartments(universityId) {
    setDeptLoading(true);
    try {
      const depts = await getDepartments(universityId);
      setDepartments(depts);
    } catch {
      setDepartments([]);
    } finally {
      setDeptLoading(false);
    }
  }

  function handleSelectUni(uni) {
    setSelectedUni(uni);
    setStep("dept");
    loadDepartments(uni.id);
  }

  async function handleCreateUni() {
    if (!newUniName.trim()) return;
    try {
      const uni = await createUniversity(newUniName.trim(), isUniStudent ? "university" : "school");
      setUniversities(prev => [...prev, uni]);
      setSelectedUni(uni);
      setShowUniCreate(false);
      setNewUniName("");
      setStep("dept");
      loadDepartments(uni.id);
    } catch {
      // ignore
    }
  }

  function handleSkip() {
    (onSkip || onClose)?.();
  }

  async function handleConfirm() {
    if (!selectedDept && isUniStudent) return;
    setSaving(true);
    try {
      const uniId = selectedUni?.id || null;
      if (isUniStudent && selectedDept) {
        await setUserDepartment(selectedDept.id, selectedYear, selectedSemester, uniId);
        await saveMyProfile({
          universityId: uniId,
          isUniversityStudent: true,
          institution: selectedUni?.name || null,
          level: `${selectedYear * 100} Level`,
          departmentId: selectedDept.id,
          yearLevel: selectedYear,
          semester: selectedSemester,
        }).catch(() => {});
        onConfirm(selectedDept, selectedYear, selectedSemester, selectedUni);
      } else {
        await saveMyProfile({
          isUniversityStudent: false,
          schoolName: selectedUni?.name || newUniName || null,
          universityId: uniId,
          level: selectedGrade,
        }).catch(() => {});
        onConfirm(null, selectedGrade, null, selectedUni);
      }
    } catch {
      setSaving(false);
    }
  }

  const steps = isUniStudent ? ["uni", "dept", "year", "semester"] : ["uni", "grade"];
  const stepIndex = steps.indexOf(step);

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
  const inputStyle = {
    width: "100%", background: "#0a0b18", border: "0.5px solid #1e2245",
    borderRadius: "10px", padding: "12px 14px", fontSize: "14px",
    color: "#e8eaf6", outline: "none",
  };
  const stepHeaders = {
    uni: { title: isOnboarding ? "Select your University or School" : "Change University / School", sub: "We'll show content relevant to your institution" },
    dept: { title: "Select your Department", sub: "Courses will be filtered to your department" },
    year: { title: "Select Year Level", sub: "We'll show courses for your year" },
    semester: { title: "Select Semester", sub: "First or Second semester?" },
    grade: { title: "Select your Grade Level", sub: "What class are you in?" },
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && !isOnboarding && onClose?.()}>
      <style>{`@keyframes deptSlideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={sheet}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h2 style={{ color: "#e8eaf6", fontSize: "18px", fontWeight: 700, margin: 0 }}>
              {stepHeaders[step]?.title || "Select"}
            </h2>
            <p style={{ color: "#7b82b8", fontSize: "13px", margin: "4px 0 0" }}>
              {stepHeaders[step]?.sub || ""}
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
          {steps.map((s, i) => (
            <div key={s} style={{
              flex: 1, height: "3px", borderRadius: "2px",
              background: i <= stepIndex ? "#B8860B" : "#1e2245",
            }} />
          ))}
        </div>

        {/* Step: University/School */}
        {step === "uni" && (
          <>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", background: "#0a0b18", borderRadius: "12px", padding: "4px" }}>
              <button onClick={() => setIsUniStudent(true)} style={{
                flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
                background: isUniStudent ? "#1a1a1a" : "none", color: isUniStudent ? "#FFD700" : "#4a5080",
                fontSize: "13px", fontWeight: 700,
              }}>🎓 University / Polytechnic</button>
              <button onClick={() => setIsUniStudent(false)} style={{
                flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
                background: !isUniStudent ? "#1a1a1a" : "none", color: !isUniStudent ? "#FFD700" : "#4a5080",
                fontSize: "13px", fontWeight: 700,
              }}>📚 Secondary School</button>
            </div>

            <input
              type="text"
              placeholder={isUniStudent ? "Search universities…" : "Search schools…"}
              value={uniQuery}
              onChange={(e) => setUniQuery(e.target.value)}
              style={{ ...inputStyle, marginBottom: "12px" }}
            />

            {loading ? (
              <div style={{ color: "#7b82b8", textAlign: "center", padding: "24px" }}>Loading…</div>
            ) : fetchError && filteredUnis.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
                <div style={{ fontWeight: 600, color: "#e8eaf6", marginBottom: 6 }}>Couldn't load institutions</div>
                <div style={{ fontSize: 12, color: "#7b82b8", marginBottom: 16 }}>Check your connection.</div>
              </div>
            ) : filteredUnis.length === 0 && !showUniCreate ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div style={{ color: "#7b82b8", fontSize: 13, marginBottom: 12 }}>
                  No results for "{uniQuery}". Add it manually?
                </div>
                <button onClick={() => setShowUniCreate(true)} style={{
                  padding: "10px 20px", background: "#1a1a1a", color: "#FFD700",
                  border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                  + Add "{uniQuery || "your institution"}"
                </button>
              </div>
            ) : showUniCreate ? (
              <div style={{ marginBottom: "12px" }}>
                <input
                  type="text"
                  placeholder="Enter institution name"
                  value={newUniName}
                  onChange={(e) => setNewUniName(e.target.value)}
                  style={{ ...inputStyle, marginBottom: "10px" }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setShowUniCreate(false)} style={{
                    flex: 1, padding: "10px", background: "#0a0b18", color: "#7b82b8",
                    border: "0.5px solid #1e2245", borderRadius: "10px", fontSize: 13, cursor: "pointer",
                  }}>Cancel</button>
                  <button onClick={handleCreateUni} disabled={!newUniName.trim()} style={{
                    flex: 1, padding: "10px", background: newUniName.trim() ? "#1a1a1a" : "#1e2245", color: "#FFD700",
                    border: "none", borderRadius: "10px", fontSize: 13, fontWeight: 600, cursor: newUniName.trim() ? "pointer" : "default",
                  }}>Add & Continue</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                  {filteredUnis.map((u) => (
                    <div key={u.id} style={pill(selectedUni?.id === u.id)} onClick={() => handleSelectUni(u)}>
                      <span style={{ fontSize: "22px" }}>{u.type === "school" ? "🏫" : u.type === "polytechnic" ? "🏛️" : "🎓"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.name}</div>
                        <div style={{ fontSize: "11px", color: "#4a5080" }}>
                          {u.type === "school" ? "Secondary School" : u.type === "polytechnic" ? "Polytechnic" : "University"}
                          {u.city ? ` · ${u.city}` : ""}
                        </div>
                      </div>
                      {selectedUni?.id === u.id && <span style={{ color: "#B8860B", fontSize: "18px" }}>✓</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowUniCreate(true)} style={{
                  width: "100%", marginTop: "8px", padding: "12px",
                  background: "transparent", color: "#7b82b8",
                  border: "0.5px dashed #2a2d4a", borderRadius: "12px", fontSize: 13, cursor: "pointer",
                }}>
                  + Can't find yours? Add manually
                </button>
              </>
            )}

            {isOnboarding && (
              <button onClick={handleSkip} style={{ width: "100%", marginTop: 12, padding: "10px", background: "none", border: "none", color: "#4a5080", fontSize: 13, cursor: "pointer" }}>
                Skip for now
              </button>
            )}
          </>
        )}

        {/* Step: Department */}
        {step === "dept" && (
          <>
            {deptLoading ? (
              <div style={{ color: "#7b82b8", textAlign: "center", padding: "24px" }}>Loading departments…</div>
            ) : departments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🏛️</div>
                <div style={{ fontWeight: 600, color: "#e8eaf6", marginBottom: 6 }}>No departments for {selectedUni?.name}</div>
                <div style={{ fontSize: 12, color: "#7b82b8", marginBottom: 20 }}>
                  No departments have been created for this institution yet. You can skip and set up later.
                </div>
                <button onClick={() => setStep("year")} style={{
                  width: "100%", padding: "13px", background: "#1a1a1a", color: "#e8eaf6",
                  border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer",
                }}>
                  Skip →
                </button>
              </div>
            ) : (
              <>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
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
                </div>
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
              </>
            )}
            <button onClick={() => setStep("uni")} style={{
              width: "100%", marginTop: 8, padding: "10px", background: "none", border: "none",
              color: "#4a5080", fontSize: 13, cursor: "pointer",
            }}>
              ← Back
            </button>
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

        {/* Step: Grade Level (non-university) */}
        {step === "grade" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {GRADE_LEVELS.map((g) => (
                <button key={g} onClick={() => setSelectedGrade(g)} style={{
                  padding: "18px 12px", borderRadius: "12px", cursor: "pointer",
                  border: selectedGrade === g ? "1.5px solid #B8860B" : "0.5px solid #1e2245",
                  background: selectedGrade === g ? "#0f1535" : "#0a0b18",
                  color: selectedGrade === g ? "#e8eaf6" : "#7b82b8",
                  fontWeight: 700, fontSize: "15px",
                }}>
                  {g}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setStep("uni")} style={{
                flex: 1, padding: "14px", background: "#0a0b18", color: "#7b82b8",
                border: "0.5px solid #1e2245", borderRadius: "12px", fontSize: "14px", cursor: "pointer",
              }}>
                ← Back
              </button>
              <button onClick={handleConfirm} disabled={saving || !selectedGrade} style={{
                flex: 2, padding: "14px", background: selectedGrade ? "#1a1a1a" : "#1e2245", color: "#e8eaf6",
                border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: selectedGrade ? "pointer" : "default",
              }}>
                {saving ? "Saving…" : `Confirm — ${selectedUni?.name || ""}, ${selectedGrade}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
