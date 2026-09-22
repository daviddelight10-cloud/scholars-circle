import { useEffect, useRef, useState } from "react";
import "./settings.css";
import { DISCIPLINES } from "../AITutor/disciplines.js";
import { ACADEMIC_LEVELS, LEARNING_STYLES, AVATAR_OPTIONS, EMPTY_PROFILE, computeCompletion } from "../StudentProfile.jsx";
import { getUniversities, getUniversityDepartments, FALLBACK_UNIVERSITIES } from "../../lib/universities.js";
import { saveMyProfile } from "../../lib/profileApi.js";
import UniversitySelect from "../../components/UniversitySelect.jsx";
import PickerSheet from "./PickerSheet.jsx";
import { API_BASE } from "../../lib/constants";
import { planLabel } from "../../lib/plans";
import { toast } from "../../components/Toast";
import ExitPill from "../../components/ExitPill.jsx";
import { toPng } from "html-to-image";

function fmtXp(xp) {
  const n = Number(xp) || 0;
  return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n);
}

export default function ProfileScreen({
  profile,
  authUser,
  onSave,
  onUsernameChange,
  stats,
  token,
  isActivated,
  onOpenPremium,
  onBack,
}) {
  const [draft, setDraft] = useState(profile || EMPTY_PROFILE);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sheet, setSheet] = useState(null); // "disc" | "level"
  const [shareOpen, setShareOpen] = useState(false);
  const [rank, setRank] = useState(null);
  const [saving, setSaving] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(authUser?.username || "");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [universities, setUniversities] = useState(() =>
    FALLBACK_UNIVERSITIES.map((name, i) => ({ id: "fb-" + i, name, type: "university", city: null }))
  );
  const [uniDepts, setUniDepts] = useState([]);
  const shareCardRef = useRef(null);

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);

  // Load universities from API (merge with fallback so list is never sparse)
  useEffect(() => {
    const fallback = FALLBACK_UNIVERSITIES.map((name, i) => ({ id: "fb-" + i, name, type: "university", city: null }));
    getUniversities()
      .then((rows) => {
        if (rows && rows.length > 0) {
          const normalized = rows.map((r) => ({ id: r.id, name: r.name, type: r.type || "university", city: r.city || null }));
          const existing = new Set(normalized.map((r) => r.name.toLowerCase()));
          setUniversities([...normalized, ...fallback.filter((f) => !existing.has(f.name.toLowerCase()))]);
        }
      })
      .catch(() => {});
  }, []);

  // Load departments when university changes
  useEffect(() => {
    if (draft.universityId) {
      getUniversityDepartments(draft.universityId).then(setUniDepts).catch(() => setUniDepts([]));
    } else {
      setUniDepts([]);
    }
  }, [draft.universityId]);

  // Rank for the stats grid
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/users/leaderboard?period=all&limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.myRank) {
          setRank(data.myRank);
        } else {
          const entries = data.entries || [];
          const idx = entries.findIndex((e) => e.isMe);
          if (idx >= 0) setRank(idx + 1);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const completion = computeCompletion(draft);
  const disc = DISCIPLINES.find((d) => d.id === draft.discipline);
  const level = ACADEMIC_LEVELS.find((l) => l.id === draft.level);
  const style = LEARNING_STYLES.find((s) => s.id === draft.learningStyle);
  const displayName = draft.fullName || authUser?.username || "Your Profile";

  const expiry = authUser?.activationExpiry ? new Date(authUser.activationExpiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry - Date.now()) / 86400000) : null;

  function set(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
  }

  function openEdit() {
    setDraft(profile || EMPTY_PROFILE);
    setUsernameDraft(authUser?.username || "");
    setUsernameError("");
    setDirty(false);
    setEditing(true);
    window.scrollTo({ top: 0 });
  }

  function exitEdit() {
    setEditing(false);
    setDirty(false);
  }

  function handleUniInput(value, uni) {
    setDraft((d) => ({
      ...d,
      universityName: value,
      institution: value,
      universityId: uni ? uni.id : null,
      isUniversityStudent: uni ? uni.type !== "school" : d.isUniversityStudent,
      schoolName: uni && uni.type === "school" ? uni.name : d.schoolName,
    }));
    setDirty(true);
  }

  async function handleSaveUsername() {
    const trimmed = usernameDraft.trim();
    if (!trimmed) { setUsernameError("Username cannot be empty"); return; }
    if (trimmed === authUser?.username) return;
    setUsernameSaving(true);
    setUsernameError("");
    try {
      const authToken = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken;
      const res = await fetch(`${API_BASE}/auth/username`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update username");
      }
      const data = await res.json();
      if (onUsernameChange) onUsernameChange(data.username);
      setUsernameSaved(true);
      setTimeout(() => setUsernameSaved(false), 2500);
    } catch (err) {
      setUsernameError(err.message);
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handleSave() {
    if (!draft.fullName?.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    try {
      onSave(draft);
      try {
        await saveMyProfile({
          fullName: draft.fullName,
          avatar: draft.avatar,
          discipline: draft.discipline,
          level: draft.level,
          institution: draft.institution,
          universityId: draft.universityId,
          isUniversityStudent: draft.isUniversityStudent,
          schoolName: draft.schoolName,
          department: draft.department,
          programme: draft.programme,
          matricNumber: draft.matricNumber,
          bio: draft.bio,
          learningStyle: draft.learningStyle,
          goals: draft.goals,
          targetGrade: draft.targetGrade,
          studyHoursPerDay: draft.studyHoursPerDay,
        });
      } catch {
        // offline fallback — localStorage already saved by onSave
      }
      if (usernameDraft.trim() && usernameDraft.trim() !== authUser?.username) {
        await handleSaveUsername();
      }
      setDirty(false);
      setEditing(false);
      toast.success("✓ Profile saved");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDraft(profile || EMPTY_PROFILE);
    setUsernameDraft(authUser?.username || "");
    setUsernameError("");
    setDirty(false);
  }

  async function saveShareImage() {
    if (!shareCardRef.current) return;
    try {
      const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = "scholars-circle-stats.png";
      link.href = dataUrl;
      link.click();
      toast.success("📸 Card saved");
    } catch {
      toast.error("Couldn't save image — try a screenshot instead");
    }
  }

  function shareStatsWA() {
    const msg = `🔥 ${stats?.streak || 0}-day streak on ScholarsCircle!\n${disc ? `${disc.icon} ${disc.label}` : ""}${level ? ` · ${level.label}` : ""}\n⭐ ${fmtXp(stats?.xp)} XP${rank ? ` · 🏆 Rank #${rank}` : ""}\nCan you beat me? 🎓 ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const discPickerItems = DISCIPLINES.filter((d) => d.id !== "general").map((d) => ({
    icon: d.icon,
    label: d.label,
    sub: d.examples.slice(0, 2).join(", "),
    value: d.id,
  }));
  const levelPickerItems = ACADEMIC_LEVELS.map((l) => ({ icon: l.icon, label: l.label, value: l.id }));

  return (
    <div className="st-root">
      <ExitPill
        title="👤 Profile"
        onBack={onBack}
        large
        right={
          <button
            className={`x-exitfab${editing ? " x-accent" : ""}`}
            onClick={() => (editing ? (dirty ? handleSave() : exitEdit()) : openEdit())}
          >
            {editing ? (dirty ? "💾 Save" : "✓ Done") : "✏️ Edit"}
          </button>
        }
      />

      {/* ═══ VIEW MODE ═══ */}
      {!editing && (
        <>
          <section className="st-hero">
            <div
              className="st-avatar"
              style={{ width: 56, height: 56, fontSize: 27, cursor: "pointer" }}
              onClick={openEdit}
              title="Tap to edit"
            >
              {draft.avatar || "🎓"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="st-name">
                {displayName}
                {isActivated && <span className="st-prem-badge">💎 PREMIUM</span>}
              </div>
              <div className="st-user">@{authUser?.username || "—"}</div>
              <div>
                {disc && <span className="st-mtag">{disc.icon} {disc.label}</span>}
                {level && <span className="st-mtag">{level.icon} {level.label}</span>}
                {(draft.universityName || draft.institution) && (
                  <span className="st-mtag">🏛 {draft.universityName || draft.institution}</span>
                )}
              </div>
              <p className={`st-bio-v${draft.bio ? "" : " st-empty"}`}>
                {draft.bio || "No bio yet — tap Edit to add one"}
              </p>
            </div>
            <div className="st-ring" title={`Profile completion ${completion}%`}>
              <svg viewBox="0 0 52 52">
                <circle className="st-ring-tr" cx="26" cy="26" r="23" pathLength="100" />
                <circle
                  className="st-ring-ba"
                  cx="26" cy="26" r="23" pathLength="100"
                  style={{ strokeDashoffset: 100 - completion }}
                />
              </svg>
              <b>{completion}%</b>
            </div>
          </section>

          <section className="st-stats">
            <button
              className="st-statshare st-press"
              onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
              title="Share stats card"
            >
              ↗
            </button>
            <div className="st-stat"><b>🔥 {stats?.streak ?? 0}</b><span>STREAK</span></div>
            <div className="st-stat"><b>⭐ {fmtXp(stats?.xp)}</b><span>XP</span></div>
            <div className="st-stat"><b>{rank ? `🏆 #${rank}` : "🏆 —"}</b><span>RANK</span></div>
            <div className="st-stat" onClick={onOpenPremium} style={{ cursor: "pointer" }}>
              <b>{isActivated ? "💎" : "🔒"}</b><span>PREMIUM</span>
            </div>
          </section>

          <section className="st-card">
            <div className="st-card-h">Academic</div>
            <div className="st-vrow">
              <span className="st-k">Discipline</span>
              <span className={`st-v${disc ? "" : " st-empty"}`}>{disc ? `${disc.icon} ${disc.label}` : "Not set"}</span>
            </div>
            <div className="st-vrow">
              <span className="st-k">Focus areas</span>
              <span className={`st-v${disc ? "" : " st-empty"}`} style={{ fontWeight: 500, fontSize: 12 }}>
                {disc ? disc.examples.slice(0, 3).join(", ") : "Not set"}
              </span>
            </div>
            <div className="st-vrow">
              <span className="st-k">Programme</span>
              <span className={`st-v${draft.programme ? "" : " st-empty"}`}>{draft.programme || "Not added"}</span>
            </div>
            <div className="st-vrow">
              <span className="st-k">Student ID</span>
              <span className={`st-v${draft.matricNumber ? "" : " st-empty"}`}>{draft.matricNumber || "Not added"}</span>
            </div>
          </section>

          <section className="st-card">
            <div className="st-card-h">Plan & Preferences</div>
            <button className="st-vrow st-clickable" onClick={onOpenPremium}>
              <span className="st-k">Subscription</span>
              <span className="st-v" style={{ color: "var(--st-accent)" }}>
                {isActivated
                  ? `💎 ${planLabel(authUser?.planType) || "Active Plan"}${daysLeft !== null ? ` · ${Math.max(0, daysLeft)}d left` : ""}`
                  : "🔒 Free · Upgrade →"}
              </span>
            </button>
            <div className="st-vrow">
              <span className="st-k">Learning style</span>
              <span className={`st-v${style ? "" : " st-empty"}`}>{style ? `${style.icon} ${style.label}` : "Not set"}</span>
            </div>
            <div className="st-vrow">
              <span className="st-k">Daily goal</span>
              <span className="st-v">{draft.studyHoursPerDay || 2} hour{(draft.studyHoursPerDay || 2) > 1 ? "s" : ""}</span>
            </div>
            <div className="st-vrow">
              <span className="st-k">Target grade</span>
              <span className={`st-v${draft.targetGrade ? "" : " st-empty"}`}>{draft.targetGrade || "Not set"}</span>
            </div>
          </section>
        </>
      )}

      {/* ═══ EDIT MODE ═══ */}
      {editing && (
        <div className="st-pedit">
          <section className="st-card" style={{ padding: 14 }}>
            <label className="st-fl" style={{ marginTop: 0 }}>Full Name <em>*</em></label>
            <input type="text" value={draft.fullName || ""} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g., Adaeze Okonkwo" />

            <label className="st-fl">Username</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={usernameDraft}
                onChange={(e) => { setUsernameDraft(e.target.value); setUsernameSaved(false); setUsernameError(""); }}
                placeholder="your_username"
                maxLength={30}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSaveUsername}
                disabled={usernameSaving || usernameDraft.trim() === authUser?.username}
                className="st-tbtn st-press"
                style={{ opacity: usernameSaving || usernameDraft.trim() === authUser?.username ? 0.5 : 1 }}
              >
                {usernameSaving ? "Saving…" : usernameSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
            {usernameError && <div style={{ fontSize: 12, color: "var(--st-red)", marginTop: 6 }}>{usernameError}</div>}

            <label className="st-fl">Avatar</label>
            <div className="st-pills">
              {AVATAR_OPTIONS.map((emo) => (
                <button
                  key={emo}
                  className={`st-pill st-press${draft.avatar === emo ? " st-sel" : ""}`}
                  onClick={() => set("avatar", emo)}
                >
                  {emo}
                </button>
              ))}
            </div>

            <label className="st-fl">Bio</label>
            <textarea
              value={draft.bio || ""}
              onChange={(e) => set("bio", e.target.value.slice(0, 200))}
              placeholder="A few words about you…"
              rows={3}
            />
            <div className="st-counter">{(draft.bio || "").length}/200</div>
          </section>

          <section className="st-card" style={{ padding: 14 }}>
            <label className="st-fl" style={{ marginTop: 0 }}>Discipline <em>*</em></label>
            <span style={{ fontSize: 11, color: "var(--st-muted)", display: "block", margin: "-2px 0 7px" }}>
              Personalizes your AI Tutor & content
            </span>
            <button type="button" className="st-selfd st-press" onClick={() => setSheet("disc")}>
              <span className="st-sf-ic">{disc?.icon || "🩺"}</span>
              <span className="st-sf-body">
                <b>{disc?.label || "Select discipline"}</b>
                <small>{disc ? disc.examples.slice(0, 2).join(", ") : "Personalizes your AI Tutor"}</small>
              </span>
              <span className="st-sf-ch">▾</span>
            </button>

            <label className="st-fl">Level <em>*</em></label>
            <button type="button" className="st-selfd st-press" onClick={() => setSheet("level")}>
              <span className="st-sf-ic">{level?.icon || "🎓"}</span>
              <span className="st-sf-body"><b>{level?.label || "Select level"}</b></span>
              <span className="st-sf-ch">▾</span>
            </button>

            <label className="st-fl">University / School</label>
            <UniversitySelect
              value={draft.universityName || draft.institution || ""}
              onChange={(val, uni) => handleUniInput(val, uni)}
              universities={universities}
              placeholder="Search for your university or school…"
            />

            <label className="st-fl">Department / Faculty</label>
            {uniDepts.length > 0 ? (
              <select
                value={draft.department || ""}
                onChange={(e) => set("department", e.target.value)}
                className="st-root-input"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 11, border: "1px solid var(--st-line)", background: "var(--st-card2)", color: "var(--st-text)", fontSize: 13.5 }}
              >
                <option value="">Select department…</option>
                {uniDepts.map((d) => (
                  <option key={d.id} value={d.name}>{d.icon || "🏛️"} {d.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={draft.department || ""}
                onChange={(e) => set("department", e.target.value)}
                placeholder="e.g., Computer Science"
              />
            )}

            <label className="st-fl">Programme / Major</label>
            <input type="text" value={draft.programme || ""} onChange={(e) => set("programme", e.target.value)} placeholder="e.g., B.Sc Computer Science" />

            <label className="st-fl">Student ID</label>
            <input type="text" value={draft.matricNumber || ""} onChange={(e) => set("matricNumber", e.target.value)} placeholder="e.g., CSC/2024/0456" />
          </section>

          <section className="st-card" style={{ padding: 14 }}>
            <label className="st-fl" style={{ marginTop: 0 }}>Learning Style</label>
            <div className="st-styles">
              {LEARNING_STYLES.map((ls) => (
                <button
                  key={ls.id}
                  className={`st-style st-press${draft.learningStyle === ls.id ? " st-sel" : ""}`}
                  onClick={() => set("learningStyle", ls.id)}
                >
                  <b>{ls.icon} {ls.label}</b>
                  <span>{ls.desc}</span>
                </button>
              ))}
            </div>

            <label className="st-fl">Daily Study Goal</label>
            <div className="st-srow">
              <input
                type="range"
                min="1" max="8" step="0.5"
                value={draft.studyHoursPerDay || 2}
                onChange={(e) => set("studyHoursPerDay", parseFloat(e.target.value))}
              />
              <span className="st-sval">{draft.studyHoursPerDay || 2} hr</span>
            </div>

            <label className="st-fl">Target Grade / GPA</label>
            <input type="text" value={draft.targetGrade || ""} onChange={(e) => set("targetGrade", e.target.value)} placeholder="e.g., First Class, 4.5 GPA" />

            <label className="st-fl">Learning Goals</label>
            <textarea
              value={draft.goals || ""}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="e.g., Master calculus, ace physics exam…"
              rows={3}
            />
          </section>
        </div>
      )}

      {/* Save bar */}
      {editing && dirty && (
        <div className="st-savebar">
          <button className="st-ghost st-press" onClick={handleDiscard}>Discard</button>
          <button className="st-save st-press" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "💾 Save Changes"}
          </button>
        </div>
      )}

      {/* Discipline / level picker sheets */}
      <PickerSheet
        open={sheet === "disc"}
        onClose={() => setSheet(null)}
        title="Select Discipline"
        subtitle="Personalizes your AI Tutor & content"
        items={discPickerItems}
        selected={draft.discipline}
        searchable
        onPick={(v) => set("discipline", v)}
      />
      <PickerSheet
        open={sheet === "level"}
        onClose={() => setSheet(null)}
        title="Select Level"
        items={levelPickerItems}
        selected={draft.level}
        onPick={(v) => set("level", v)}
      />

      {/* Share stats modal */}
      {shareOpen && (
        <div className="st-modal" onClick={() => setShareOpen(false)}>
          <div className="st-sharewrap" onClick={(e) => e.stopPropagation()}>
            <button className="st-sclose st-press" onClick={() => setShareOpen(false)} aria-label="Close">✕</button>
            <div className="st-sharecard">
              <div className="st-sc-in" ref={shareCardRef}>
                <div className="st-sc-head">
                  <div className="st-sc-av">{draft.avatar || "🎓"}</div>
                  <div className="st-who">
                    <b>{displayName}</b>
                    <span>@{authUser?.username || "—"}</span>
                  </div>
                  <span className={`st-sc-plan${isActivated ? " st-prem" : ""}`}>
                    {isActivated ? "💎 PREMIUM" : "FREE"}
                  </span>
                </div>
                <span className="st-sc-disc">
                  {disc ? `${disc.icon} ${disc.label}` : ""}{level ? ` · ${level.label}` : ""}
                </span>
                <div className="st-sc-streak">
                  <span className="st-flame">🔥</span>
                  <b>{stats?.streak || 0}</b>
                  <span>DAY STREAK</span>
                </div>
                <div className="st-sc-grid">
                  <div className="st-sc-g"><b>{fmtXp(stats?.xp)}</b><span>XP</span></div>
                  <div className="st-sc-g"><b>{rank ? `#${rank}` : "—"}</b><span>RANK</span></div>
                  <div className="st-sc-g"><b>{level ? level.label.replace(" Level", "L").replace(" (1st Year)", "").replace(" (2nd Year)", "").replace(" (3rd Year)", "").replace(" (4th Year)", "").replace(" (5th Year)", "") : "—"}</b><span>LEVEL</span></div>
                </div>
                <div className="st-sc-brand">
                  ScholarsCircle
                  <small>Study smarter, together 🎓</small>
                </div>
              </div>
            </div>
            <div className="st-srowbtns">
              <button className="st-press" onClick={saveShareImage}>📥 Save image</button>
              <button className="st-wa st-press" onClick={shareStatsWA}>💬 WhatsApp</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
