import { useState } from "react";

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

  const totalSteps = 4;

  function toggleSubject(id) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function finish() {
    markOnboarded();
    onComplete({
      selectedSubjects,
      examDate,
      dailyMinutes,
      confidence,
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
                style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}
                onClick={() => setStep(1)}
              >
                Get Started →
              </button>
            </div>
          </>
        )}

        {step === 1 && (
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
              <button onClick={() => setStep(0)} className="ghost">
                Back
              </button>
              <button
                style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}
                onClick={() => setStep(2)}
                disabled={selectedSubjects.length === 0}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
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
                      ? { borderColor: "#2dd4a0", color: "#2dd4a0" }
                      : undefined
                  }
                >
                  {m} min
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button onClick={() => setStep(1)} className="ghost">
                Back
              </button>
              <button
                style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}
                onClick={() => setStep(3)}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
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
                      ? { borderColor: "#2dd4a0", color: "#2dd4a0" }
                      : undefined
                  }
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button onClick={() => setStep(2)} className="ghost">
                Back
              </button>
              <button
                style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}
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
