import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function TeacherInvitesPanel({ token }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newExpiry, setNewExpiry] = useState(30);
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState("all"); // all | unused | used | expired

  async function load() {
    setLoading(true);
    try {
      const data = await req("/teacher-invites", { token });
      setInvites(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function createInvite() {
    setCreating(true);
    try {
      await req("/teacher-invites", {
        method: "POST",
        token,
        body: {
          email: newEmail.trim() || null,
          notes: newNotes.trim() || null,
          expiresInDays: newExpiry > 0 ? newExpiry : null
        }
      });
      setNewEmail("");
      setNewNotes("");
      setNewExpiry(30);
      await load();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id) {
    if (!confirm("Revoke this unused invite code?")) return;
    try {
      await req(`/teacher-invites/${id}`, { method: "DELETE", token });
      await load();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  function copy(code, id) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  const filtered = invites.filter((i) => {
    if (filter === "unused") return !i.isUsed && !i.isExpired;
    if (filter === "used") return i.isUsed;
    if (filter === "expired") return i.isExpired && !i.isUsed;
    return true;
  });

  const stats = {
    total: invites.length,
    unused: invites.filter((i) => !i.isUsed && !i.isExpired).length,
    used: invites.filter((i) => i.isUsed).length,
    expired: invites.filter((i) => i.isExpired && !i.isUsed).length
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>🎫 Teacher Invite Codes</h2>
        <p className="muted" style={{ margin: 0 }}>
          Generate unique single-use invite codes for lecturers to sign up. Share each code privately with the intended recipient.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total" value={stats.total} color="#a5b4fc" onClick={() => setFilter("all")} active={filter === "all"} />
        <StatCard label="Available" value={stats.unused} color="#10b981" onClick={() => setFilter("unused")} active={filter === "unused"} />
        <StatCard label="Used" value={stats.used} color="#6366f1" onClick={() => setFilter("used")} active={filter === "used"} />
        <StatCard label="Expired" value={stats.expired} color="#f87171" onClick={() => setFilter("expired")} active={filter === "expired"} />
      </div>

      {/* Generate panel */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>➕ Generate New Invite</h3>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Recipient email <span style={{ color: "#9ca3af", fontSize: 11 }}>(optional, locks to this email)</span></label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="lecturer@uni.edu"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Notes <span style={{ color: "#9ca3af", fontSize: 11 }}>(your own reference)</span></label>
            <input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="e.g., Dr. Adebayo - Mathematics"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Expires in (days)</label>
            <input
              type="number"
              min="0"
              max="365"
              value={newExpiry}
              onChange={(e) => setNewExpiry(parseInt(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
          <button
            onClick={createInvite}
            disabled={creating}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: creating ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              fontWeight: 700,
              cursor: creating ? "wait" : "pointer"
            }}
          >
            {creating ? "..." : "Generate"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
          💡 Tip: Leave "Expires in" as 0 for a code that never expires. Codes are single-use.
        </div>
      </div>

      {error && <div style={{ padding: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: 8, marginBottom: 12 }}>{error}</div>}

      {/* Invite list */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading invites...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
            {filter === "all" ? "No invite codes yet. Generate one above." : `No ${filter} codes.`}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(99,102,241,0.1)", textAlign: "left", fontSize: 12, color: "#a5b4fc" }}>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Recipient / Notes</th>
                  <th style={thStyle}>Used By</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Expires</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}>
                    <td style={tdStyle}>
                      <code style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>{i.code}</code>
                    </td>
                    <td style={tdStyle}>
                      {i.isUsed ? (
                        <span style={badgeStyle("#6366f1")}>✓ Used</span>
                      ) : i.isExpired ? (
                        <span style={badgeStyle("#f87171")}>⌛ Expired</span>
                      ) : (
                        <span style={badgeStyle("#10b981")}>● Available</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 13 }}>{i.email || <span style={{ color: "#64748b" }}>(any email)</span>}</div>
                      {i.notes && <div style={{ fontSize: 11, color: "#9ca3af" }}>{i.notes}</div>}
                    </td>
                    <td style={tdStyle}>
                      {i.usedByUser ? (
                        <div>
                          <div style={{ fontSize: 13 }}>{i.usedByUser.username}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{i.usedByUser.email}</div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{i.usedAt ? new Date(i.usedAt).toLocaleString() : ""}</div>
                        </div>
                      ) : (
                        <span style={{ color: "#64748b" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, color: "#cbd5e1" }}>{new Date(i.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td style={tdStyle}>
                      {i.expiresAt ? (
                        <span style={{ fontSize: 12, color: i.isExpired ? "#f87171" : "#cbd5e1" }}>
                          {new Date(i.expiresAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ color: "#64748b" }}>Never</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => copy(i.code, i.id)}
                        title="Copy code"
                        style={iconBtn}
                      >
                        {copiedId === i.id ? "✓" : "📋"}
                      </button>
                      {!i.isUsed && (
                        <button
                          onClick={() => revoke(i.id)}
                          title="Revoke"
                          style={{ ...iconBtn, color: "#f87171" }}
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 14,
        borderRadius: 10,
        border: active ? `2px solid ${color}` : "1px solid rgba(99,102,241,0.2)",
        background: active ? `${color}22` : "rgba(30,41,59,0.6)",
        color: "#fff",
        cursor: "pointer",
        textAlign: "left"
      }}
    >
      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </button>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4, fontWeight: 600 };
const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(99,102,241,0.3)",
  background: "rgba(15,23,42,0.8)",
  color: "#fff",
  fontSize: 13,
  boxSizing: "border-box"
};
const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10, verticalAlign: "top" };
const iconBtn = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 16,
  padding: 4,
  marginLeft: 4,
  color: "#a5b4fc"
};
const badgeStyle = (color) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 99,
  background: `${color}22`,
  color,
  fontSize: 11,
  fontWeight: 600
});
