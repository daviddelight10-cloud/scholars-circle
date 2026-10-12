import React, { useEffect, useState } from "react";
import { lecturersApi } from "./api.js";
import { haptics } from "../../lib/haptics.js";

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
  const [dirty, setDirty] = useState(false);
  const [qualInput, setQualInput] = useState("");
  const [researchInput, setResearchInput] = useState("");

  // App-feel chrome: large title collapses into the sticky header on scroll
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = (e) => {
      const y = e.target === document
        ? (document.documentElement.scrollTop || document.body.scrollTop)
        : e.target.scrollTop;
      setScrolled(y > 24);
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

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
    setDirty(true);
  }

  function setOfficeHour(day, time) {
    setDraft((d) => ({ ...d, officeHours: { ...(d.officeHours || {}), [day]: time } }));
    setSaved(false);
    setDirty(true);
  }

  // Chip fields share one add path — Enter key AND the visible "+ Add" button
  // (on-screen keyboards often hide Enter, so the button is the mobile path).
  function addChip(field, value, setValue) {
    const v = value.trim();
    if (!v) return;
    set(field, [...(draft[field] || []), v]);
    setValue("");
    haptics.light();
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
      setDirty(false);
      haptics.success();
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
    <div className={`lp-root${scrolled ? " scrolled" : ""}`}>
      <div className="lp-head">
        <div className={`lp-title${scrolled ? " gone" : ""}`}>
          <span className="lp-title-txt">My Profile</span>
          <span className="lp-title-sub">what students see</span>
        </div>
      </div>

      {/* Hero card */}
      <div className="lp-hero">
        <div className="lp-avatar">{initials || "👨‍🏫"}</div>
        <div className="lp-hero-info">
          <div className="lp-hero-name">{displayTitle}</div>
          <div className="lp-hero-sub">
            {[draft.department, draft.institution].filter(Boolean).join(" • ") || "Build your profile so students can find you"}
          </div>
          <div className={`lp-status-pill ${draft.isPublic ? "on" : "off"}`}>
            <span className="lp-status-dot" />
            {draft.isPublic ? "Public — visible to all students" : "Private — hidden from directory"}
          </div>
        </div>
      </div>

      {/* SECTION 1: Identity */}
      <Section num="01" title="Identity" subtitle="How students will see you in the directory">
        <div className="lp-grid">
          <Field label="Title" span={1}>
            <select className="lp-input" value={draft.title || ""} onChange={(e) => set("title", e.target.value)}>
              <option value="">— None —</option>
              <option>Prof.</option>
              <option>Dr.</option>
              <option>Mr.</option>
              <option>Mrs.</option>
              <option>Ms.</option>
            </select>
          </Field>
          <Field label="Full Name *" span={2}>
            <input className="lp-input" value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g., Adebayo Williams" />
          </Field>
          <Field label="Department">
            <input className="lp-input" value={draft.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g., Computer Science" />
          </Field>
          <Field label="Institution">
            <input className="lp-input" value={draft.institution} onChange={(e) => set("institution", e.target.value)} placeholder="e.g., University of Lagos" />
          </Field>
          <Field label="Years of Experience">
            <input className="lp-input" type="number" min="0" max="60" value={draft.yearsExperience || ""} onChange={(e) => set("yearsExperience", e.target.value)} placeholder="e.g., 8" style={{ maxWidth: 160 }} />
          </Field>
        </div>
      </Section>

      {/* SECTION 2: About */}
      <Section num="02" title="About You" subtitle="Help students understand your expertise">
        <Field label="Bio" hint="A short description of who you are and what you teach">
          <textarea className="lp-input" value={draft.bio} onChange={(e) => set("bio", e.target.value)} rows={4} style={{ resize: "vertical" }} placeholder="e.g., Senior Lecturer specializing in machine learning and data structures..." />
        </Field>
        <Field label="Qualifications" hint="Press Enter or tap Add for each one (e.g., PhD, MSc, BSc)">
          <div className="lp-chipfield">
            <input
              className="lp-input"
              value={qualInput}
              onChange={(e) => setQualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addChip("qualifications", qualInput, setQualInput); }
              }}
              placeholder="e.g., PhD Computer Science (Oxford, 2018)"
            />
            <button type="button" className="lp-addbtn" onClick={() => addChip("qualifications", qualInput, setQualInput)}>+ Add</button>
          </div>
          <ChipList
            items={draft.qualifications}
            onRemove={(i) => set("qualifications", draft.qualifications.filter((_, j) => j !== i))}
          />
        </Field>
        <Field label="Research Areas" hint="Press Enter or tap Add for each one">
          <div className="lp-chipfield">
            <input
              className="lp-input"
              value={researchInput}
              onChange={(e) => setResearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addChip("researchAreas", researchInput, setResearchInput); }
              }}
              placeholder="e.g., Machine Learning, NLP, Computer Vision"
            />
            <button type="button" className="lp-addbtn" onClick={() => addChip("researchAreas", researchInput, setResearchInput)}>+ Add</button>
          </div>
          <ChipList
            items={draft.researchAreas}
            onRemove={(i) => set("researchAreas", draft.researchAreas.filter((_, j) => j !== i))}
          />
        </Field>
      </Section>

      {/* SECTION 3: Office & Availability */}
      <Section num="03" title="Office & Availability" subtitle="When and where students can meet you">
        <Field label="Office Location">
          <input className="lp-input" value={draft.officeLocation} onChange={(e) => set("officeLocation", e.target.value)} placeholder="e.g., Block C, Room 204" />
        </Field>
        <Field label="Office Hours" hint="Leave a day blank if you're not available">
          <div className="lp-days">
            {DAYS.map((day) => (
              <div key={day} className="lp-day">
                <span className="lp-day-name">{day.slice(0, 3)}</span>
                <input
                  className="lp-input lp-day-input"
                  value={(draft.officeHours || {})[day] || ""}
                  onChange={(e) => setOfficeHour(day, e.target.value)}
                  placeholder="10:00–12:00"
                />
              </div>
            ))}
          </div>
        </Field>
      </Section>

      {/* SECTION 4: Contact */}
      <Section num="04" title="Contact Information" subtitle="How students can reach you outside the platform">
        <div className="lp-grid">
          <Field label="Contact Email">
            <input className="lp-input" type="email" value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="lecturer@uni.edu" />
          </Field>
          <Field label="Phone">
            <input className="lp-input" value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234..." />
          </Field>
          <Field label="Website">
            <input className="lp-input" value={draft.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="LinkedIn">
            <input className="lp-input" value={draft.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/..." />
          </Field>
        </div>
      </Section>

      {/* SECTION 5: Visibility */}
      <Section num="05" title="Visibility" subtitle="Control who can see your profile">
        <div className="lp-visrow" onClick={() => { haptics.selection(); set("isPublic", !draft.isPublic); }}>
          <div className="lp-vis-txt">
            <div className="lp-vis-t">Show my profile publicly to students</div>
            <div className="lp-vis-s">When enabled, students can find you in the directory and message you directly.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.isPublic}
            className={`lp-switch${draft.isPublic ? " on" : ""}`}
            aria-label="Public profile"
          />
        </div>
      </Section>

      {error && <div className="lp-error">{error}</div>}

      {/* Floating save pill — slides up only when there are unsaved changes */}
      <div className={`lp-savewrap${dirty ? " show" : ""}`}>
        <div className="lp-save">
          <span className="lp-save-note">
            {!draft.fullName?.trim() ? <span className="lp-warn">⚠ Full name is required</span> : saved ? <span className="lp-ok">✓ Saved</span> : "Unsaved changes"}
          </span>
          <button className="lp-save-btn" onClick={save} disabled={saving || !draft.fullName?.trim()}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ num, title, subtitle, children }) {
  return (
    <div className="lp-section">
      <div className="lp-section-head">
        <span className="lp-section-num">{num}</span>
        <div>
          <h3 className="lp-section-title">{title}</h3>
          {subtitle && <p className="lp-section-sub">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, span, children }) {
  return (
    <div className="lp-field" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label className="lp-label">{label}</label>
      {hint && <div className="lp-hint">{hint}</div>}
      {children}
    </div>
  );
}

function ChipList({ items, onRemove }) {
  if (!items?.length) return null;
  return (
    <div className="lp-chips">
      {items.map((item, i) => (
        <span key={i} className="lp-chip">
          {item}
          <button type="button" onClick={() => { haptics.light(); onRemove(i); }} aria-label={`Remove ${item}`}>×</button>
        </span>
      ))}
    </div>
  );
}
