import { useState, useEffect } from "react";
import { saveMyProfile } from "../lib/profileApi.js";
import { getUniversities, FALLBACK_UNIVERSITIES } from "../lib/universities.js";
import UniversitySelect from "../components/UniversitySelect.jsx";
import { MEDICAL_PROGRAMS, getProgramSubjects } from "../lib/medicalPrograms.js";

const STORE_KEY = "sc_onboarded_v1";

export function isOnboarded() {
  try {
    return localStorage.getItem(STORE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(STORE_KEY, "1");
  } catch {
    // ignore
  }
}

export function OnboardingWizard({ subjects, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [examDate, setExamDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(45);
  const [confidence, setConfidence] = useState(2);
  const [programId, setProgramId] = useState("");
  const [yearLevel, setYearLevel] = useState("");

  const totalSteps = 6;

  const [uniName, setUniName] = useState("");
  const [uniId, setUniId] = useState(null);
  const [uniResults, setUniResults] = useState(() =>
    FALLBACK_UNIVERSITIES.map((name, i) => ({ id: "fb-" + i, name, type: "university", city: null }))
  );

  useEffect(() => {
    const fallback = FALLBACK_UNIVERSITIES.map((name, i) => ({ id: "fb-" + i, name, type: "university", city: null }));
    getUniversities()
      .then((rows) => {
        if (rows && rows.length > 0) {
          const normalized = rows.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type || "university",
            city: r.city || null,
          }));
          const existing = new Set(normalized.map((r) => r.name.toLowerCase()));
          setUniResults([...normalized, ...fallback.filter((f) => !existing.has(f.name.toLowerCase()))]);
        }
      })
      .catch(() => {});
  }, []);

  function handleUniChange(value, uni) {
    setUniName(value);
    setUniId(uni ? uni.id : null);
  }

  function toggleSubject(id) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const programSubjects = programId ? getProgramSubjects(programId) : [];
  const selectedProgram = MEDICAL_PROGRAMS.find((p) => p.id === programId);

  function finish() {
    markOnboarded();
    saveMyProfile({
      isUniversityStudent: true,
      institution: uniName || null,
      universityId: uniId || null,
      programme: selectedProgram ? selectedProgram.label : null,
      department: selectedProgram ? selectedProgram.label : null,
      level: yearLevel || null,
      learningStyle: "visual",
      goals: confidence <= 2 ? "Catch up and build confidence" : confidence >= 4 ? "Maintain and excel" : "Improve steadily",
      targetGrade: "A",
      studyHoursPerDay: Math.round(dailyMinutes / 60 * 10) / 10,
    }).catch(() => {});
    onComplete({
      selectedSubjects,
      examDate,
      dailyMinutes,
      confidence,
      programId,
      yearLevel,
      institution: uniName,
      universityId: uniId,
    });
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} className={`onboarding-dot ${i <= step ? "active" : ""}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h2>⚕️ Welcome to Scholar's Circle</h2>
            <p className="muted">
              The smart study companion built exclusively for medical & health-science students.
              Let's set you up in under a minute.
            </p>
            <ul style={{ lineHeight: 1.9 }}>
              <li>🩺 Clinical case simulations & OSCE prep</li>
              <li>💊 Drug reference & medical calculators</li>
              <li>🧪 Lab values & spaced repetition flashcards</li>
              <li>🔥 Streaks, XP, and a medical leaderboard</li>
            </ul>
            <div className="onboarding-actions">
              <button onClick={onSkip} className="ghost">
                Skip
              </button>
              <button
                style={{ borderColor: "#FFD700", color: "#FFD700" }}
                onClick={() => setStep(1)}
              >
                Get Started →
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>🩺 Select your medical program</h2>
            <p className="muted">Which health-science program are you enrolled in?</p>
            <div className="onboarding-grid">
              {MEDICAL_PROGRAMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setProgramId(p.id); setSelectedSubjects([]); setStep(2); }}
                  className={`onboarding-pill ${programId === p.id ? "active" : ""}`}
                  style={{
                    borderColor: programId === p.id ? p.color : undefined,
                    color: programId === p.id ? p.color : undefined,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <span style={{ fontSize: 12 }}>{p.label}</span>
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button onClick={() => setStep(0)} className="ghost">
                Back
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>🏛️ Which university / teaching hospital?</h2>
            <p className="muted">
              Search for your institution. We'll connect you with coursemates and clinical rotation groups.
            </p>
            <div style={{ marginTop: "12px" }}>
              <UniversitySelect
                value={uniName}
                onChange={(val, uni) => handleUniChange(val, uni)}
                universities={uniResults}
                placeholder="Search e.g. University of Lagos, OAUTH, Bayero University..."
                autoFocus
              />
            </div>
            {uniName && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#10b981" }}>✓ {uniName}</div>
            )}
            <div className="onboarding-actions">
              <button onClick={() => setStep(1)} className="ghost">
                Back
              </button>
              <button
                style={{ borderColor: "#FFD700", color: "#FFD700" }}
                onClick={() => setStep(3)}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>🎓 Select your year & courses</h2>
            {selectedProgram && (
              <>
                <p className="muted" style={{ marginBottom: 8 }}>Your current level:</p>
                <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {selectedProgram.levels.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setYearLevel(lvl)}
                      style={
                        yearLevel === lvl
                          ? { borderColor: selectedProgram.color, color: selectedProgram.color }
                          : undefined
                      }
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="muted">Which courses are you taking this semester?</p>
            <div className="onboarding-grid">
              {programSubjects.map((subj) => {
                const active = selectedSubjects.includes(subj);
                return (
                  <button
                    key={subj}
                    onClick={() => toggleSubject(subj)}
                    className={`onboarding-pill ${active ? "active" : ""}`}
                  >
                    <span style={{ fontSize: 18 }}>{selectedProgram?.icon || "📚"}</span>
                    <span style={{ fontSize: 12 }}>{subj}</span>
                  </button>
                );
              })}
            </div>
            <div className="onboarding-actions">
              <button onClick={() => setStep(2)} className="ghost">
                Back
              </button>
              <button
                style={{ borderColor: "#FFD700", color: "#FFD700" }}
                onClick={() => setStep(4)}
                disabled={selectedSubjects.length === 0}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2>📆 When's your next exam?</h2>
            <p className="muted">
              Used to build a personalised daily plan. Skip if you're not sure yet.
            </p>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              style={{ fontSize: 16, padding: "8px 10px" }}
            />
            <p className="muted" style={{ marginTop: 12 }}>How many minutes can you study per day?</p>
            <div className="row" style={{ gap: 6 }}>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  onClick={() => setDailyMinutes(m)}
                  style={
                    dailyMinutes === m
                      ? { borderColor: "#FFD700", color: "#FFD700" }
                      : undefined
                  }
                >
                  {m} min
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button onClick={() => setStep(3)} className="ghost">
                Back
              </button>
              <button
                style={{ borderColor: "#FFD700", color: "#FFD700" }}
                onClick={() => setStep(5)}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2>🎯 How confident are you right now?</h2>
            <p className="muted">Rate your overall current understanding. Be honest — we'll adjust the plan.</p>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              {[
                { v: 1, label: "1 — Lost", icon: "😩" },
                { v: 2, label: "2 — Shaky", icon: "😐" },
                { v: 3, label: "3 — Okay", icon: "🙂" },
                { v: 4, label: "4 — Solid", icon: "💪" },
                { v: 5, label: "5 — Ready", icon: "🚀" },
              ].map((c) => (
                <button
                  key={c.v}
                  onClick={() => setConfidence(c.v)}
                  style={
                    confidence === c.v
                      ? { borderColor: "#FFD700", color: "#FFD700" }
                      : undefined
                  }
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button onClick={() => setStep(4)} className="ghost">
                Back
              </button>
              <button
                style={{ borderColor: "#FFD700", color: "#FFD700" }}
                onClick={finish}
              >
                🩺 Start Studying
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
