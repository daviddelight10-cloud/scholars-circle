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

  // Live preview initials
  const initials = (draft.fullName || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const displayTitle = [draft.title, draft.fullName].filter(Boolean).join(" ") || "Your name";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 100 }}>
      {/* Header preview card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(218,165,32,0.15))",
        border: "1px solid rgba(255,215,0,0.3)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, #FFD700, #DAA520)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 700, color: "#fff",
          flexShrink: 0
        }}>
          {initials || "👨\u200d🏫"}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{displayTitle}</h2>
          <div style={{ color: "#FFD700", fontSize: 13, marginTop: 4 }}>
            {[draft.department, draft.institution].filter(Boolean).join(" • ") || "Build your profile so students can find you"}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: draft.isPublic ? "#10b981" : "#f59e0b" }}>
            {draft.isPublic ? "● Public — visible to all students" : "○ Private — hidden from directory"}
          </div>
        </div>
      </div>

      {/* SECTION 1: Identity */}
      <Section icon="🪪" title="Identity" subtitle="How students will see you in the directory">
        <Row>
          <Field label="Title" cols={1}>
            <select value={draft.title || ""} onChange={(e) => set("title", e.target.value)} style={inputStyle}>
              <option value="">— None —</option>
              <option>Prof.</option>
              <option>Dr.</option>
              <option>Mr.</option>
              <option>Mrs.</option>
              <option>Ms.</option>
            </select>
          </Field>
          <Field label="Full Name *" cols={2}>
            <input value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} style={inputStyle} placeholder="e.g., Adebayo Williams" />
          </Field>
        </Row>
        <Row>
          <Field label="Department">
            <input value={draft.department} onChange={(e) => set("department", e.target.value)} style={inputStyle} placeholder="e.g., Computer Science" />
          </Field>
          <Field label="Institution">
            <input value={draft.institution} onChange={(e) => set("institution", e.target.value)} style={inputStyle} placeholder="e.g., University of Lagos" />
          </Field>
        </Row>
        <Field label="Years of Experience">
          <input type="number" min="0" max="60" value={draft.yearsExperience || ""} onChange={(e) => set("yearsExperience", e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} placeholder="e.g., 8" />
        </Field>
      </Section>

      {/* SECTION 2: About */}
      <Section icon="📝" title="About You" subtitle="Help students understand your expertise">
        <Field label="Bio" hint="A short description of who you are and what you teach">
          <textarea value={draft.bio} onChange={(e) => set("bio", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="e.g., Senior Lecturer specializing in machine learning and data structures..." />
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
      </Section>

      {/* SECTION 3: Office & Availability */}
      <Section icon="🏢" title="Office & Availability" subtitle="When and where students can meet you">
        <Field label="Office Location">
          <input value={draft.officeLocation} onChange={(e) => set("officeLocation", e.target.value)} placeholder="e.g., Block C, Room 204" style={inputStyle} />
        </Field>
        <Field label="Office Hours" hint="Leave a day blank if you're not available">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {DAYS.map((day) => (
              <div key={day} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: "rgba(10,10,10,0.5)", borderRadius: 8 }}>
                <div style={{ width: 70, textTransform: "capitalize", color: "#FFD700", fontSize: 12, fontWeight: 600 }}>{day.slice(0, 3)}</div>
                <input
                  value={(draft.officeHours || {})[day] || ""}
                  onChange={(e) => setOfficeHour(day, e.target.value)}
                  placeholder="10:00-12:00"
                  style={{ ...inputStyle, padding: 6, fontSize: 13, flex: 1 }}
                />
              </div>
            ))}
          </div>
        </Field>
      </Section>

      {/* SECTION 4: Contact */}
      <Section icon="📞" title="Contact Information" subtitle="How students can reach you outside the platform">
        <Row>
          <Field label="Contact Email">
            <input type="email" value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="lecturer@uni.edu" style={inputStyle} />
          </Field>
          <Field label="Phone">
            <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234..." style={inputStyle} />
          </Field>
        </Row>
        <Row>
          <Field label="Website">
            <input value={draft.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://..." style={inputStyle} />
          </Field>
          <Field label="LinkedIn">
            <input value={draft.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/..." style={inputStyle} />
          </Field>
        </Row>
      </Section>

      {/* SECTION 5: Visibility */}
      <Section icon="👁️" title="Visibility" subtitle="Control who can see your profile">
        <label style={{
          display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
          padding: 12, background: "rgba(10,10,10,0.5)", borderRadius: 8
        }}>
          <input type="checkbox" checked={draft.isPublic} onChange={(e) => set("isPublic", e.target.checked)} style={{ marginTop: 4 }} />
          <div>
            <div style={{ fontWeight: 600, color: "#FFD700" }}>Show my profile publicly to students</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
              When enabled, students can find you in the directory and message you directly.
            </div>
          </div>
        </label>
      </Section>

      {error && <div style={{ padding: 12, marginTop: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: 8 }}>{error}</div>}

      <div style={{
        position: "sticky", bottom: 12, padding: 14, marginTop: 16,
        borderRadius: 12, background: "rgba(10,10,10,0.96)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,215,0,0.4)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12, flexWrap: "wrap"
      }}>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>
          {!draft.fullName?.trim() ? <span style={{ color: "#f87171" }}>⚠ Full name is required</span> : "All changes are saved to your account"}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {saved && <span style={{ color: "#10b981", fontWeight: 600 }}>✓ Saved!</span>}
          <button onClick={save} disabled={saving || !draft.fullName?.trim()} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: draft.fullName?.trim() ? "linear-gradient(135deg, #FFD700, #DAA520)" : "rgba(255,215,0,0.3)", color: "#fff", fontWeight: 700, cursor: saving ? "wait" : "pointer", fontSize: 14 }}>
            {saving ? "Saving..." : "💾 Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(255,215,0,0.15)" }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "#FFD700" }}>
          <span style={{ marginRight: 8 }}>{icon}</span>{title}
        </h3>
        {subtitle && <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#9ca3af" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Row({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function Field({ label, hint, cols, children }) {
  const span = cols === 2 ? { gridColumn: "span 2" } : cols === 1 ? {} : {};
  return (
    <div style={{ marginBottom: 14, ...span }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#cbd5e1", marginBottom: 4, letterSpacing: 0.2 }}>{label}</label>
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
        <span key={i} style={{ padding: "4px 10px 4px 12px", background: "rgba(255,215,0,0.2)", color: "#FFD700", borderRadius: 99, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
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
  border: "1px solid rgba(255,215,0,0.3)",
  background: "rgba(20,20,20,0.8)",
  color: "#fff",
  fontSize: 14,
  boxSizing: "border-box"
};
