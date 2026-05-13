import React, { useEffect, useState } from "react";
import { lecturersApi } from "./api.js";

export function LecturerDirectory({ token, onSelect, onMessage }) {
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [institution, setInstitution] = useState("");

  // Debounce filter inputs to prevent reload-flicker on every keystroke
  const [debounced, setDebounced] = useState({ search: "", department: "", institution: "" });
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ search, department, institution }), 350);
    return () => clearTimeout(t);
  }, [search, department, institution]);

  useEffect(() => {
    let alive = true;
    // First load shows skeleton; subsequent reloads show inline refresh badge (preserves scroll)
    if (hasLoadedOnce) setRefreshing(true); else setLoading(true);
    lecturersApi.list({ token, ...debounced })
      .then((data) => { if (alive) { setLecturers(data); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) { setLoading(false); setRefreshing(false); setHasLoadedOnce(true); } });
    return () => { alive = false; };
  }, [token, debounced]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, marginBottom: 4 }}>👨‍🏫 Lecturer Directory</h2>
        <p className="muted" style={{ margin: 0 }}>Browse lecturer profiles, view their work, and reach out.</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <input
          type="text"
          placeholder="🔍 Search by name, department, research..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Stable-height results container: no scroll jumps when refreshing */}
      <div style={{ position: "relative", minHeight: 320 }}>
        {refreshing && (
          <div style={{
            position: "absolute",
            top: -32,
            right: 0,
            padding: "4px 10px",
            background: "rgba(99,102,241,0.2)",
            border: "1px solid rgba(99,102,241,0.4)",
            color: "#a5b4fc",
            borderRadius: 99,
            fontSize: 11,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "pulse 1s infinite" }} />
            Refreshing…
          </div>
        )}

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading lecturers...</div>
        )}
        {error && (
          <div style={{ padding: 16, background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: 8 }}>{error}</div>
        )}
        {!loading && !error && lecturers.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
            <p>No lecturer profiles found.</p>
            <p style={{ fontSize: 12 }}>Lecturers can create their profile from the Lecturers tab.</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s" }}>
          {lecturers.map((l) => (
            <LecturerCard key={l.id} lecturer={l} onSelect={onSelect} onMessage={onMessage} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LecturerCard({ lecturer, onSelect, onMessage }) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        cursor: "pointer",
        transition: "transform 0.15s, border-color 0.15s",
        border: "1px solid rgba(99,102,241,0.2)"
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)"; }}
      onClick={() => onSelect?.(lecturer)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: lecturer.avatarUrl ? `url(${lecturer.avatarUrl}) center/cover` : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            color: "#fff",
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          {!lecturer.avatarUrl && (lecturer.fullName?.charAt(0) || "?")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
            {lecturer.title ? `${lecturer.title} ` : ""}{lecturer.fullName}
            {lecturer.isVerified && <span title="Verified">✅</span>}
          </div>
          <div style={{ fontSize: 12, color: "#a5b4fc" }}>{lecturer.department || "—"}</div>
          {lecturer.institution && <div style={{ fontSize: 11, color: "#9ca3af" }}>🏛️ {lecturer.institution}</div>}
        </div>
      </div>

      {lecturer.bio && (
        <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {lecturer.bio}
        </div>
      )}

      {lecturer.researchAreas?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {lecturer.researchAreas.slice(0, 3).map((r) => (
            <span key={r} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderRadius: 99 }}>{r}</span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid rgba(99,102,241,0.15)" }}>
        <div style={{ fontSize: 12, color: "#fbbf24" }}>
          ⭐ {(lecturer.rating || 0).toFixed(1)} <span style={{ color: "#9ca3af", fontSize: 11 }}>({lecturer.totalRatings || 0})</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onMessage?.(lecturer); }}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #818cf8",
            background: "transparent",
            color: "#a5b4fc",
            cursor: "pointer",
            fontSize: 12
          }}
        >
          💬 Message
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(99,102,241,0.3)",
  background: "rgba(30,41,59,0.8)",
  color: "#fff",
  fontSize: 13
};
