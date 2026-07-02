import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

// ─── Design tokens (matches Scholar's Circle app) ──────────────────────────
const T = {
  bg:        "#07080F",
  card:      "#0D0E18",
  cardHover: "#111220",
  border:    "rgba(255,255,255,0.07)",
  borderHi:  "rgba(61,126,255,0.28)",
  blue:      "#3D7EFF",
  blueGrad:  "linear-gradient(135deg,#3D7EFF,#6E4AFF)",
  text:      "#F1F5F9",
  muted:     "#64748B",
  dim:       "#334155",
  syne:      "Syne,sans-serif",
  mono:      "JetBrains Mono,monospace",
  body:      "Manrope,sans-serif",
};

const CATEGORIES = [
  { value: "IMPORTANT", label: "Important", color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)"  },
  { value: "LECTURES",  label: "Lectures",  color: "#3D7EFF", bg: "rgba(61,126,255,0.12)", border: "rgba(61,126,255,0.3)" },
  { value: "GENERAL",   label: "General",   color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  { value: "UPDATE",    label: "Update",    color: "#F5A623", bg: "rgba(245,166,35,0.12)", border: "rgba(245,166,35,0.3)"  },
];

const PRIORITIES = [
  { value: "LOW",      label: "Low",      color: "#64748B", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)" },
  { value: "NORMAL",   label: "Normal",   color: "#3D7EFF", bg: "rgba(61,126,255,0.12)", border: "rgba(61,126,255,0.3)"  },
  { value: "HIGH",     label: "High",     color: "#F5A623", bg: "rgba(245,166,35,0.12)", border: "rgba(245,166,35,0.3)"  },
  { value: "CRITICAL", label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)"   },
];

const ROLES = ["STUDENT", "TEACHER", "LECTURER"];

const getCategoryInfo = (cat) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[2];
const getPriorityInfo = (prio) => PRIORITIES.find((p) => p.value === prio) || PRIORITIES[1];

// ─── Small atoms ──────────────────────────────────────────────────────────────
function Badge({ label, color, bg, border }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontFamily: T.mono, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 0" }}>
      <div style={{ width: 22, height: 22, border: `2px solid ${T.borderHi}`, borderTopColor: T.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

function StatCard({ value, label, color, icon }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle,${color}22 0%,transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontFamily: T.syne, fontSize: 28, fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 10, height: 2, borderRadius: 999, background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </div>
  );
}

function AnnouncementRow({ announcement, onDelete, showDelete }) {
  const [hovered, setHovered] = useState(false);
  const cat  = getCategoryInfo(announcement.category);
  const prio = getPriorityInfo(announcement.priority);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? T.cardHover : "rgba(255,255,255,0.02)", border: `1px solid ${hovered ? T.border : "rgba(255,255,255,0.04)"}`, borderRadius: 14, padding: "12px 14px", transition: "all 0.2s" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge label={cat.label} color={cat.color} bg={cat.bg} border={cat.border} />
          <Badge label={prio.label} color={prio.color} bg={prio.bg} border={prio.border} />
        </div>
        {showDelete && (
          <button
            onClick={() => onDelete(announcement.id)}
            style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", padding: 2, opacity: hovered ? 1 : 0, transition: "opacity 0.2s, color 0.2s", lineHeight: 0, flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
            onMouseLeave={e => e.currentTarget.style.color = T.dim}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>
      <p style={{ fontFamily: T.syne, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{announcement.title}</p>
      <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{announcement.content}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim }}>{new Date(announcement.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.dim, flexShrink: 0 }} />
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{announcement.readCount ?? 0} reads</span>
        {announcement.commentCount > 0 && <>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.dim, flexShrink: 0 }} />
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{announcement.commentCount} comments</span>
        </>}
      </div>
    </div>
  );
}

// ─── Styled inputs ─────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
  borderRadius: 12, padding: "10px 14px", fontSize: 14, fontFamily: T.body,
  color: T.text, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
};
const labelStyle = { fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.dim, marginBottom: 6, display: "block" };

function DarkInput({ as: As = "input", onFocus, onBlur, style: extra = {}, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <As
      {...props}
      style={{ ...inputStyle, borderColor: focused ? T.blue : T.border, ...extra }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CampusComm({ token, currentUser }) {
  const [category, setCategory]     = useState("GENERAL");
  const [priority, setPriority]     = useState("NORMAL");
  const [targetRoles, setTargetRoles] = useState([]);
  const [title, setTitle]           = useState("");
  const [content, setContent]       = useState("");
  const [expiresAt, setExpiresAt]   = useState("");
  const [isSending, setIsSending]   = useState(false);
  const [message, setMessage]       = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [activeTab, setActiveTab]   = useState("send");
  const [analytics, setAnalytics]   = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async () => {
    try {
      const r = await fetch(`${API_BASE}/announcements`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setAnnouncements(await r.json());
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/announcements/analytics/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setAnalytics(await r.json());
    } catch (e) { console.error(e); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { if (activeTab === "analytics") fetchAnalytics(); }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setMessage({ type: "error", text: "Title and content are required" }); return; }
    setIsSending(true); setMessage(null);
    try {
      const r = await fetch(`${API_BASE}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, priority, targetRoles, title, content, expiresAt: expiresAt || null }),
      });
      if (r.ok) {
        setMessage({ type: "success", text: "Announcement sent successfully!" });
        setTitle(""); setContent(""); setExpiresAt(""); setCategory("GENERAL"); setPriority("NORMAL"); setTargetRoles([]);
        fetchAnnouncements();
      } else {
        const err = await r.json();
        setMessage({ type: "error", text: err.error || "Failed to send announcement" });
      }
    } catch { setMessage({ type: "error", text: "Failed to send announcement" }); }
    finally { setIsSending(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      const r = await fetch(`${API_BASE}/announcements/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        setMessage({ type: "success", text: "Announcement deleted" });
        fetchAnnouncements();
        if (activeTab === "analytics") fetchAnalytics();
      } else { setMessage({ type: "error", text: "Failed to delete" }); }
    } catch { setMessage({ type: "error", text: "Failed to delete" }); }
  };

  const toggleRole = (role) => setTargetRoles((p) => p.includes(role) ? p.filter((r) => r !== role) : [...p, role]);

  const myAnnouncements = announcements.filter((a) => a.senderId === currentUser?.id);

  return (
    <div style={{ fontFamily: T.body, color: T.text, minHeight: "100vh", background: T.bg, padding: "20px 16px" }}>

      {/* ── Global keyframes ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }

        .sc-input::placeholder { color: #334155; }
        .sc-input::-webkit-calendar-picker-indicator { filter: invert(0.4); }
        .sc-select option { background: #0D0E18; color: #F1F5F9; }

        /* Scrollbar */
        .sc-scroll::-webkit-scrollbar { width: 4px; }
        .sc-scroll::-webkit-scrollbar-track { background: transparent; }
        .sc-scroll::-webkit-scrollbar-thumb { background: rgba(61,126,255,0.25); border-radius: 99px; }

        @media(max-width:768px){
          .sc-main-grid { grid-template-columns: 1fr !important; }
          .sc-analytics-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media(max-width:480px){
          .sc-analytics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto", animation: "fadeUp 0.5s ease both" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Icon */}
            <div style={{ width: 40, height: 40, borderRadius: 13, background: T.blueGrad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(61,126,255,0.28)", flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" stroke="white" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: T.syne, fontWeight: 800, fontSize: 18, color: T.text, lineHeight: 1.1, margin: 0 }}>Campus Communications</h1>
              <p style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: "0.08em", margin: 0, marginTop: 2 }}>BROADCAST ANNOUNCEMENTS</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: "flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 3, gap: 3 }}>
            {["send", "analytics"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 16px", borderRadius: 9, fontSize: 12, fontFamily: T.mono, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", border: "none", transition: "all 0.2s", background: activeTab === tab ? T.blueGrad : "transparent", color: activeTab === tab ? "#fff" : T.muted, boxShadow: activeTab === tab ? "0 0 12px rgba(61,126,255,0.25)" : "none" }}>
                {tab === "send" ? "⚡ Send" : "📊 Analytics"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Toast message ── */}
        {message && (
          <div style={{ marginBottom: 16, padding: "11px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, animation: "slideIn 0.3s ease", border: `1px solid ${message.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, background: message.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", color: message.type === "success" ? "#10B981" : "#EF4444" }}>
            <span>{message.type === "success" ? "✓" : "✕"}</span>
            <span style={{ flex: 1 }}>{message.text}</span>
            <button onClick={() => setMessage(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6, lineHeight: 0 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {/* ═══ SEND TAB ═══ */}
        {activeTab === "send" && (
          <div className="sc-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>

            {/* ── Compose Form ── */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 24, animation: "fadeUp 0.4s ease both" }}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <div style={{ width: 3, height: 20, background: T.blueGrad, borderRadius: 2 }} />
                <h2 style={{ fontFamily: T.syne, fontWeight: 700, fontSize: 15, color: T.text, margin: 0 }}>Compose Announcement</h2>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Category & Priority */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Category", value: category, onChange: setCategory, options: CATEGORIES },
                    { label: "Priority", value: priority, onChange: setPriority, options: PRIORITIES },
                  ].map(({ label, value, onChange, options }) => (
                    <div key={label}>
                      <label style={labelStyle}>{label}</label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          className="sc-select"
                          style={{ ...inputStyle, appearance: "none", paddingRight: 32, cursor: "pointer" }}
                        >
                          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <svg style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.muted }} width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live preview badges */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={labelStyle}>Preview</span>
                  <Badge {...getCategoryInfo(category)} label={getCategoryInfo(category).label} />
                  <Badge {...getPriorityInfo(priority)} label={getPriorityInfo(priority).label} />
                </div>

                {/* Target audience */}
                <div>
                  <label style={labelStyle}>Target Audience <span style={{ color: T.blue }}>(all if none selected)</span></label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {ROLES.map((role) => {
                      const active = targetRoles.includes(role);
                      return (
                        <button key={role} type="button" onClick={() => toggleRole(role)}
                          style={{ padding: "7px 14px", borderRadius: 10, fontSize: 12, fontFamily: T.mono, fontWeight: 600, letterSpacing: "0.06em", cursor: "pointer", border: `1px solid ${active ? T.blue : T.border}`, background: active ? "rgba(61,126,255,0.15)" : "rgba(255,255,255,0.03)", color: active ? T.blue : T.muted, transition: "all 0.18s", boxShadow: active ? `0 0 10px rgba(61,126,255,0.2)` : "none" }}>
                          {active && "✓ "}{role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label style={labelStyle}>Title</label>
                  <input
                    className="sc-input"
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Announcement title..." maxLength={100}
                    style={{ ...inputStyle }}
                    onFocus={e => e.target.style.borderColor = T.blue}
                    onBlur={e => e.target.style.borderColor = T.border}
                  />
                </div>

                {/* Content */}
                <div>
                  <label style={labelStyle}>Content</label>
                  <textarea
                    className="sc-input"
                    value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your announcement..." maxLength={1000} rows={4}
                    style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
                    onFocus={e => e.target.style.borderColor = T.blue}
                    onBlur={e => e.target.style.borderColor = T.border}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: content.length > 900 ? "#F5A623" : T.dim }}>
                      {content.length}/1000
                    </span>
                  </div>
                </div>

                {/* Expiration */}
                <div>
                  <label style={labelStyle}>Expiration <span style={{ color: T.dim }}>(optional)</span></label>
                  <input
                    className="sc-input"
                    type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                    style={{ ...inputStyle }}
                    onFocus={e => e.target.style.borderColor = T.blue}
                    onBlur={e => e.target.style.borderColor = T.border}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={isSending}
                  style={{ width: "100%", padding: "13px", borderRadius: 13, background: isSending ? "rgba(61,126,255,0.4)" : T.blueGrad, border: "none", color: "#fff", fontFamily: T.syne, fontWeight: 700, fontSize: 14, cursor: isSending ? "not-allowed" : "pointer", transition: "all 0.2s", boxShadow: isSending ? "none" : "0 0 20px rgba(61,126,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  onMouseEnter={e => { if (!isSending) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  {isSending ? (
                    <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Sending...</>
                  ) : (
                    <><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Send Announcement</>
                  )}
                </button>
              </form>
            </div>

            {/* ── Recent Announcements Panel ── */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 20, animation: "fadeUp 0.45s ease 0.1s both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 3, height: 16, background: T.blueGrad, borderRadius: 2 }} />
                  <h2 style={{ fontFamily: T.syne, fontWeight: 700, fontSize: 14, color: T.text, margin: 0 }}>My Recent</h2>
                </div>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.blue, background: "rgba(61,126,255,0.1)", border: `1px solid rgba(61,126,255,0.2)`, borderRadius: 99, padding: "2px 8px" }}>
                  {myAnnouncements.length}
                </span>
              </div>

              {isLoading ? <Spinner /> : myAnnouncements.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: T.dim }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <p style={{ fontSize: 13, fontFamily: T.mono }}>No announcements yet</p>
                </div>
              ) : (
                <div className="sc-scroll" style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto", paddingRight: 2 }}>
                  {myAnnouncements.slice(0, 8).map((a) => (
                    <AnnouncementRow key={a.id} announcement={a} onDelete={handleDelete} showDelete />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {activeTab === "analytics" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {analyticsLoading ? <Spinner /> : analytics ? (
              <>
                {/* Overall stats */}
                <div className="sc-analytics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                  <StatCard value={analytics.overall.totalAnnouncements} label="Sent"     color="#3D7EFF" icon="📣" />
                  <StatCard value={analytics.overall.totalReads}         label="Reads"    color="#10B981" icon="👁" />
                  <StatCard value={analytics.overall.totalComments}      label="Comments" color="#DAA520" icon="💬" />
                  <StatCard value={`${analytics.overall.avgReadRate}%`}  label="Read Rate" color="#F5A623" icon="📈" />
                </div>

                {/* Per-announcement performance */}
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                    <div style={{ width: 3, height: 16, background: T.blueGrad, borderRadius: 2 }} />
                    <h3 style={{ fontFamily: T.syne, fontWeight: 700, fontSize: 14, color: T.text, margin: 0 }}>Announcement Performance</h3>
                  </div>

                  {analytics.byAnnouncement.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: T.dim }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                      <p style={{ fontFamily: T.mono, fontSize: 13 }}>No data yet</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {analytics.byAnnouncement.map((a, i) => {
                        const maxReads = Math.max(...analytics.byAnnouncement.map(x => x.readCount || 0), 1);
                        const pct = Math.round(((a.readCount || 0) / maxReads) * 100);
                        const cat = getCategoryInfo(a.category);
                        const prio = getPriorityInfo(a.priority);
                        return (
                          <div key={a.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", animation: `fadeUp 0.4s ease ${i * 60}ms both` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                                  <Badge label={cat.label} color={cat.color} bg={cat.bg} border={cat.border} />
                                  <Badge label={prio.label} color={prio.color} bg={prio.bg} border={prio.border} />
                                </div>
                                <p style={{ fontFamily: T.syne, fontWeight: 700, fontSize: 13, color: T.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
                              </div>
                              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, flexShrink: 0 }}>
                                {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                            </div>

                            {/* Read rate bar */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.blue}, #6E4AFF)`, borderRadius: 999, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
                              </div>
                              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{a.readCount ?? 0} reads</span>
                                {a.commentCount > 0 && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim }}>· {a.commentCount} comments</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", color: T.dim }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <p style={{ fontFamily: T.mono, fontSize: 13 }}>No analytics data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
