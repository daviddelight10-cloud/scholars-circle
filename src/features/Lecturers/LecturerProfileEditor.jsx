import React, { useEffect, useState } from "react";
import { lecturersApi } from "./api.js";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const EMPTY = {
  title: "",
  fullName: "",
  department: "",
  institution: "",
  bio: "",
  qualifications: [],
  researchAreas: [],
  officeHours: {},
  officeLocation: "",
  contactEmail: "",
  phone: "",
  avatarUrl: "",
  websiteUrl: "",
  linkedinUrl: "",
  yearsExperience: "",
  isPublic: true
};

export function LecturerProfileEditor({ token, onSaved }) {
  const [draft, setDraft] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [qualInput, setQualInput] = useState("");
  const [researchInput, setResearchInput] = useState("");

  useEffect(() => {
    let alive = true;
    lecturersApi.getMine(token)
      .then((d) => { if (alive && d) setDraft({ ...EMPTY, ...d, officeHours: d.officeHours || {} }); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  function set(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
    setSaved(false);
  }

  function setOfficeHour(day, time) {
    setDraft((d) => ({ ...d, officeHours: { ...(d.officeHours || {}), [day]: time } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        yearsExperience: draft.yearsExperience ? parseInt(draft.yearsExperience) : null
      };
      const result = await lecturersApi.saveMine(payload, token);
      setDraft({ ...EMPTY, ...result, officeHours: result.officeHours || {} });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading your profile...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>👨‍🏫 My Lecturer Profile</h2>
        <p className="muted" style={{ margin: 0 }}>Build a profile so students can find and reach you.</p>
      </div>

      <div className="card">
        <Field label="Title">
          <select value={draft.title || ""} onChange={(e) => set("title", e.target.value)} style={inputStyle}>
            <option value="">— None —</option>
            <option>Prof.</option>
            <option>Dr.</option>
            <option>Mr.</option>
            <option>Mrs.</option>
            <option>Ms.</option>
          </select>
        </Field>

        <Field label="Full Name *">
          <input value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} style={inputStyle} placeholder="e.g., Adebayo Williams" />
        </Field>

        <Field label="Department">
          <input value={draft.department} onChange={(e) => set("department", e.target.value)} style={inputStyle} placeholder="e.g., Computer Science" />
        </Field>

        <Field label="Institution">
          <input value={draft.institution} onChange={(e) => set("institution", e.target.value)} style={inputStyle} placeholder="e.g., University of Lagos" />
        </Field>

        <Field label="Bio" hint="A short description of who you are and what you teach">
          <textarea value={draft.bio} onChange={(e) => set("bio", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="e.g., Senior Lecturer specializing in machine learning and data structures..." />
        </Field>

        <Field label="Years of Experience">
          <input type="number" min="0" max="60" value={draft.yearsExperience || ""} onChange={(e) => set("yearsExperience", e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </Field>

        <Field label="Qualifications" hint="Press Enter to add each one (e.g., PhD, MSc, BSc)">
          <input
            value={qualInput}
            onChange={(e) => setQualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && qualInput.trim()) {
                e.preventDefault();
                set("qualifications", [...(draft.qualifications || []), qualInput.trim()]);
                setQualInput("");
              }
            }}
            placeholder="e.g., PhD Computer Science (Oxford, 2018) — press Enter"
            style={inputStyle}
          />
          <ChipList
            items={draft.qualifications}
            onRemove={(i) => set("qualifications", draft.qualifications.filter((_, j) => j !== i))}
          />
        </Field>

        <Field label="Research Areas" hint="Press Enter to add each one">
          <input
            value={researchInput}
            onChange={(e) => setResearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && researchInput.trim()) {
                e.preventDefault();
                set("researchAreas", [...(draft.researchAreas || []), researchInput.trim()]);
                setResearchInput("");
              }
            }}
            placeholder="e.g., Machine Learning, NLP, Computer Vision"
            style={inputStyle}
          />
          <ChipList
            items={draft.researchAreas}
            onRemove={(i) => set("researchAreas", draft.researchAreas.filter((_, j) => j !== i))}
          />
        </Field>

        <Field label="Office Hours">
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 6 }}>
            {DAYS.map((day) => (
              <React.Fragment key={day}>
                <div style={{ alignSelf: "center", textTransform: "capitalize", color: "#a5b4fc", fontSize: 13 }}>{day}</div>
                <input
                  value={(draft.officeHours || {})[day] || ""}
                  onChange={(e) => setOfficeHour(day, e.target.value)}
                  placeholder="e.g., 10:00-12:00"
                  style={{ ...inputStyle, padding: 8 }}
                />
              </React.Fragment>
            ))}
          </div>
        </Field>

        <Field label="Office Location">
          <input value={draft.officeLocation} onChange={(e) => set("officeLocation", e.target.value)} placeholder="e.g., Block C, Room 204" style={inputStyle} />
        </Field>

        <Field label="Contact Email">
          <input type="email" value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="lecturer@uni.edu" style={inputStyle} />
        </Field>

        <Field label="Phone">
          <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234..." style={inputStyle} />
        </Field>

        <Field label="Website">
          <input value={draft.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://..." style={inputStyle} />
        </Field>

        <Field label="LinkedIn">
          <input value={draft.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/..." style={inputStyle} />
        </Field>

        <Field label="Avatar URL" hint="Link to your photo">
          <input value={draft.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} placeholder="https://..." style={inputStyle} />
        </Field>

        <Field label="Visibility">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={draft.isPublic} onChange={(e) => set("isPublic", e.target.checked)} />
            <span>Show my profile publicly to students</span>
          </label>
        </Field>
      </div>

      {error && <div style={{ padding: 12, marginTop: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: 8 }}>{error}</div>}

      <div style={{ position: "sticky", bottom: 0, padding: 16, marginTop: 16, borderRadius: 12, background: "rgba(15,23,42,0.95)", backdropFilter: "blur(8px)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
        {saved && <span style={{ color: "#10b981" }}>✓ Saved</span>}
        <button onClick={save} disabled={saving || !draft.fullName?.trim()} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: draft.fullName?.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.3)", color: "#fff", fontWeight: 700, cursor: saving ? "wait" : "pointer", fontSize: 14 }}>
          {saving ? "Saving..." : "💾 Save Profile"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#e0e7ff", marginBottom: 4 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

function ChipList({ items, onRemove }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {items.map((item, i) => (
        <span key={i} style={{ padding: "4px 10px 4px 12px", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", borderRadius: 99, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {item}
          <button onClick={() => onRemove(i)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", padding: 0, fontSize: 14 }}>×</button>
        </span>
      ))}
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
