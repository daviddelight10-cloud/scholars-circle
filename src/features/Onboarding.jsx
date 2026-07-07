import { useState, useEffect } from "react";
import { saveMyProfile } from "../lib/profileApi.js";
import { getUniversities, FALLBACK_UNIVERSITIES } from "../lib/universities.js";

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
  const [selectedSubjects, setSelectedSubjects] = useState(subjects.map((s) => s.id));
  const [examDate, setExamDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(45);
  const [confidence, setConfidence] = useState(2);

  const totalSteps = 5;

  const [isUniStudent, setIsUniStudent] = useState(true);
  const [uniName, setUniName] = useState("");
  const [uniId, setUniId] = useState(null);
  const [uniResults, setUniResults] = useState(() =>
    FALLBACK_UNIVERSITIES.map((name, i) => ({ id: "fb-" + i, name, type: "university", city: null }))
  );

  useEffect(() => {
    getUniversities()
      .then((rows) => {
        if (rows && rows.length > 0) {
          setUniResults(rows);
        }
      })
      .catch(() => {});
  }, []);

  function handleUniChange(value) {
    setUniName(value);
    const match = uniResults.find((u) => u.name === value);
    setUniId(match ? match.id : null);
  }

  function toggleSubject(id) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function finish() {
    markOnboarded();
    // Save academic context to profile
    saveMyProfile({
      isUniversityStudent: isUniStudent,
      institution: uniName || null,
      universityId: uniId || null,
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
      isUniStudent,
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
            <h2>👋 Welcome to Scholar's Circle</h2>
            <p className="muted">
              The smart study companion built for first-year university students. Let's set you up in under a
              minute.
            </p>
            <ul style={{ lineHeight: 1.9 }}>
              <li>📅 Auto-built daily study plan</li>
              <li>🎧 Turn lectures into flashcards instantly</li>
              <li>📝 Sit real timed past papers</li>
              <li>🔥 Streaks, XP, and a leaderboard</li>
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
            <h2>🎓 Are you a university student?</h2>
            <p className="muted">This helps us tailor your experience.</p>
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button
                onClick={() => { setIsUniStudent(true); setStep(2); }}
                style={{
                  flex: 1, padding: "24px 16px", borderRadius: "14px", cursor: "pointer",
                  border: isUniStudent ? "2px solid #FFD700" : "1px solid #333",
                  background: isUniStudent ? "#1a1500" : "#111",
                  color: isUniStudent ? "#FFD700" : "#888",
                  fontSize: "15px", fontWeight: 700,
                }}
              >
                🎓 Yes, I'm a university / polytechnic student
              </button>
              <button
                onClick={() => { setIsUniStudent(false); setStep(2); }}
                style={{
                  flex: 1, padding: "24px 16px", borderRadius: "14px", cursor: "pointer",
                  border: !isUniStudent ? "2px solid #FFD700" : "1px solid #333",
                  background: !isUniStudent ? "#1a1500" : "#111",
                  color: !isUniStudent ? "#FFD700" : "#888",
                  fontSize: "15px", fontWeight: 700,
                }}
              >
                📚 No, I'm in secondary school
              </button>
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
            <h2>{isUniStudent ? "🏛️ Which university?" : "🏫 Which school?"}</h2>
            <p className="muted">
              {isUniStudent ? "Search for your university. We'll connect you with coursemates." : "Type your school name to get started."}
            </p>
            <div style={{ marginTop: "12px" }}>
              <input
                type="text"
                list="uni-datalist"
                placeholder={isUniStudent ? "Search e.g. University of Lagos" : "e.g. King's College, Lagos"}
                value={uniName}
                onChange={(e) => handleUniChange(e.target.value)}
                style={{ fontSize: 16, padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                autoFocus
              />
              <datalist id="uni-datalist">
                {uniResults.map((u) => (
                  <option key={u.id} value={u.name} />
                ))}
              </datalist>
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
            <h2>📚 Pick your courses</h2>
            <p className="muted">Which subjects are you taking this semester?</p>
            <div className="onboarding-grid">
              {subjects.map((s) => {
                const active = selectedSubjects.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSubject(s.id)}
                    className={`onboarding-pill ${active ? "active" : ""}`}
                  >
                    <span style={{ fontSize: 22 }}>{s.icon}</span>
                    <span>{s.label}</span>
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
                ✨ Start Studying
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
