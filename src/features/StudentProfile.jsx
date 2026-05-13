import React, { useState, useEffect } from "react";
import { DISCIPLINES } from "./AITutor/disciplines.js";

const PROFILE_KEY = "sc_student_profile_v1";

export const ACADEMIC_LEVELS = [
  { id: "100", label: "100 Level (1st Year)", icon: "🌱" },
  { id: "200", label: "200 Level (2nd Year)", icon: "🌿" },
  { id: "300", label: "300 Level (3rd Year)", icon: "🌳" },
  { id: "400", label: "400 Level (4th Year)", icon: "🎓" },
  { id: "500", label: "500 Level (5th Year)", icon: "🏆" },
  { id: "postgrad", label: "Postgraduate", icon: "🔬" },
  { id: "secondary", label: "Secondary School", icon: "📚" }
];

export const LEARNING_STYLES = [
  { id: "visual", label: "Visual", icon: "👁️", desc: "Diagrams, charts, videos" },
  { id: "auditory", label: "Auditory", icon: "👂", desc: "Listening, discussions" },
  { id: "reading", label: "Reading/Writing", icon: "📖", desc: "Notes, articles" },
  { id: "kinesthetic", label: "Hands-on", icon: "✋", desc: "Practice, experiments" }
];

export const AVATAR_OPTIONS = ["🎓", "📚", "🧑‍🎓", "👨‍🎓", "👩‍🎓", "🧠", "💡", "🌟", "🚀", "🔬", "📐", "🎨", "💻", "⚖️", "⚕️", "🏛️"];

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {}
}

const EMPTY_PROFILE = {
  fullName: "",
  avatar: "🎓",
  discipline: "",
  level: "",
  institution: "",
  department: "",
  programme: "",
  matricNumber: "",
  bio: "",
  learningStyle: "",
  goals: "",
  targetGrade: "",
  studyHoursPerDay: 2,
  joinedAt: null,
  updatedAt: null
};

/** Hook to access and update the student profile. */
export function useStudentProfile() {
  const [profile, setProfile] = useState(() => loadProfile());

  const update = (changes) => {
    const next = {
      ...(profile || EMPTY_PROFILE),
      ...changes,
      updatedAt: new Date().toISOString(),
      joinedAt: profile?.joinedAt || new Date().toISOString()
    };
    setProfile(next);
    saveProfile(next);
  };

  const reset = () => {
    clearProfile();
    setProfile(null);
  };

  return { profile, update, reset, isComplete: !!(profile?.fullName && profile?.discipline && profile?.level) };
}

export function StudentProfile({ profile, onSave, authUser }) {
  const [draft, setDraft] = useState(profile || EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("info"); // info, academic, preferences

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);

  function set(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const completion = computeCompletion(draft);
  const selectedDiscipline = DISCIPLINES.find((d) => d.id === draft.discipline);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Hero */}
      <div
        style={{
          padding: 24,
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))",
          border: "1px solid rgba(99,102,241,0.3)",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap"
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            flexShrink: 0
          }}
        >
          {draft.avatar || "🎓"}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>
            {draft.fullName || authUser?.username || "Your Profile"}
          </h2>
          <div style={{ fontSize: 13, color: "#a5b4fc", marginTop: 4 }}>
            {selectedDiscipline ? `${selectedDiscipline.icon} ${selectedDiscipline.label}` : "Set your discipline"}
            {draft.level && ` · ${ACADEMIC_LEVELS.find((l) => l.id === draft.level)?.label || draft.level}`}
          </div>
          {draft.institution && (
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
              🏛️ {draft.institution}
              {draft.department && ` · ${draft.department}`}
            </div>
          )}

          {/* Completion bar */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
              <span>Profile completion</span>
              <span>{completion}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(0,0,0,0.3)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${completion}%`,
                  background: completion === 100 ? "#10b981" : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                  transition: "width 0.3s"
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "info", label: "👤 Personal Info" },
          { id: "academic", label: "🎓 Academic Info" },
          { id: "preferences", label: "⚙️ Preferences" }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: tab === t.id ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.2)",
              background: tab === t.id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(30,41,59,0.6)",
              color: tab === t.id ? "#fff" : "#a5b4fc",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Personal Info */}
      {tab === "info" && (
        <div className="card">
          <Field label="Full Name *" hint="As you'd like it shown to lecturers and peers">
            <input
              type="text"
              value={draft.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="e.g., Adaeze Okonkwo"
              style={inputStyle}
            />
          </Field>

          <Field label="Avatar" hint="Pick an emoji that represents you">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AVATAR_OPTIONS.map((emo) => (
                <button
                  key={emo}
                  onClick={() => set("avatar", emo)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    border: draft.avatar === emo ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.2)",
                    background: draft.avatar === emo ? "rgba(99,102,241,0.2)" : "rgba(30,41,59,0.6)",
                    fontSize: 22,
                    cursor: "pointer"
                  }}
                >
                  {emo}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Bio" hint="Optional — a few words about you (max 200 chars)">
            <textarea
              value={draft.bio}
              onChange={(e) => set("bio", e.target.value.slice(0, 200))}
              placeholder="e.g., Aspiring biomedical engineer, love football and music."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>{(draft.bio || "").length}/200</div>
          </Field>
        </div>
      )}

      {/* Academic Info */}
      {tab === "academic" && (
        <div className="card">
          <Field label="Academic Discipline *" hint="This personalizes your AI Tutor and learning content">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {DISCIPLINES.filter((d) => d.id !== "general").map((d) => (
                <button
                  key={d.id}
                  onClick={() => set("discipline", d.id)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: draft.discipline === d.id ? `2px solid ${d.color}` : "1px solid rgba(99,102,241,0.2)",
                    background: draft.discipline === d.id ? `${d.color}22` : "rgba(30,41,59,0.6)",
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{d.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{d.label}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                    {d.examples.slice(0, 2).join(", ")}
                  </div>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Academic Level *">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {ACADEMIC_LEVELS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => set("level", l.id)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: draft.level === l.id ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.2)",
                    background: draft.level === l.id ? "rgba(99,102,241,0.2)" : "rgba(30,41,59,0.6)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    textAlign: "left"
                  }}
                >
                  {l.icon} {l.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Institution">
            <input
              type="text"
              value={draft.institution}
              onChange={(e) => set("institution", e.target.value)}
              placeholder="e.g., University of Lagos"
              style={inputStyle}
            />
          </Field>

          <Field label="Department / Faculty">
            <input
              type="text"
              value={draft.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="e.g., Computer Science"
              style={inputStyle}
            />
          </Field>

          <Field label="Programme / Major">
            <input
              type="text"
              value={draft.programme}
              onChange={(e) => set("programme", e.target.value)}
              placeholder="e.g., B.Sc Computer Science"
              style={inputStyle}
            />
          </Field>

          <Field label="Matriculation / Student ID">
            <input
              type="text"
              value={draft.matricNumber}
              onChange={(e) => set("matricNumber", e.target.value)}
              placeholder="e.g., CSC/2024/0456"
              style={inputStyle}
            />
          </Field>
        </div>
      )}

      {/* Preferences */}
      {tab === "preferences" && (
        <div className="card">
          <Field label="Learning Style" hint="Helps the AI Tutor adapt to how you learn best">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {LEARNING_STYLES.map((ls) => (
                <button
                  key={ls.id}
                  onClick={() => set("learningStyle", ls.id)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: draft.learningStyle === ls.id ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.2)",
                    background: draft.learningStyle === ls.id ? "rgba(99,102,241,0.2)" : "rgba(30,41,59,0.6)",
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{ls.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ls.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{ls.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Daily Study Goal (hours)">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.5"
                value={draft.studyHoursPerDay}
                onChange={(e) => set("studyHoursPerDay", parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontWeight: 700, color: "#a5b4fc", minWidth: 60 }}>
                {draft.studyHoursPerDay} hr
              </span>
            </div>
          </Field>

          <Field label="Target Grade / GPA">
            <input
              type="text"
              value={draft.targetGrade}
              onChange={(e) => set("targetGrade", e.target.value)}
              placeholder="e.g., First Class, 4.5 GPA, A"
              style={inputStyle}
            />
          </Field>

          <Field label="Learning Goals" hint="What do you want to achieve this semester?">
            <textarea
              value={draft.goals}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="e.g., Master calculus, ace physics exam, build a portfolio project..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </div>
      )}

      {/* Save bar */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          padding: 16,
          marginTop: 20,
          borderRadius: 12,
          background: "rgba(15,23,42,0.95)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(99,102,241,0.3)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "flex-end"
        }}
      >
        {saved && <span style={{ color: "#10b981", fontSize: 13 }}>✓ Profile saved</span>}
        <button
          onClick={handleSave}
          disabled={!draft.fullName?.trim()}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "none",
            background: draft.fullName?.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.3)",
            color: "#fff",
            fontWeight: 700,
            cursor: draft.fullName?.trim() ? "pointer" : "not-allowed",
            fontSize: 14
          }}
        >
          💾 Save Profile
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(99,102,241,0.3)",
  background: "rgba(30,41,59,0.8)",
  color: "#fff",
  fontSize: 14,
  boxSizing: "border-box"
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#e0e7ff", marginBottom: 4 }}>
        {label}
      </label>
      {hint && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

function computeCompletion(p) {
  if (!p) return 0;
  const fields = ["fullName", "discipline", "level", "institution", "department", "programme", "learningStyle", "targetGrade", "goals"];
  const filled = fields.filter((f) => p[f] && String(p[f]).trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}
