import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function authFetch(path, token) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

export function AttendancePanel({ classroomId, isHost, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const path = isHost
      ? `/live-sessions/classrooms/${classroomId}/attendance-report`
      : `/live-sessions/classrooms/${classroomId}/my-attendance`;
    authFetch(path, token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [classroomId, isHost, token]);

  // Wrap output in a stable-height container so that loading/loaded transitions
  // don't shift surrounding content (which causes the page to scroll up/down).
  return (
    <div style={{ minHeight: 240 }}>
      {loading && <div style={{ padding: 12, color: "#9ca3af" }}>Loading attendance…</div>}
      {error && <div style={{ padding: 12, color: "#f87171" }}>Failed: {error}</div>}
      {!loading && !error && data && (isHost ? <FacultyView data={data} /> : <StudentView data={data} />)}
    </div>
  );
}

function FacultyView({ data }) {
  if (data.totalSessions === 0) {
    return <p style={{ color: "#9ca3af" }}>No live sessions held yet — attendance will appear here once you host your first class.</p>;
  }

  function exportCSV() {
    const headers = ["Student", "Email", ...data.sessions.map((s) => s.title), "Sessions Attended", "Rate %", "Total Min"];
    const rows = data.rows.map((r) => [
      r.student.username,
      r.student.email || "",
      ...r.cells.map((c) => c.attended ? "✓" : "✗"),
      r.attendedCount,
      r.attendanceRate + "%",
      r.totalMinutes
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#a5b4fc" }}>
          {data.rows.length} students × {data.totalSessions} sessions
        </div>
        <button onClick={exportCSV} style={btnPrimary}>📥 Export CSV</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(99,102,241,0.1)" }}>
              <th style={th}>Student</th>
              {data.sessions.map((s) => (
                <th key={s.id} style={th} title={s.title}>
                  {s.title.length > 14 ? s.title.slice(0, 12) + "…" : s.title}
                  <br />
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{new Date(s.scheduledFor).toLocaleDateString()}</span>
                </th>
              ))}
              <th style={th}>Rate</th>
              <th style={th}>Min</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.student.id} style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}>
                <td style={td}><b>{r.student.username}</b></td>
                {r.cells.map((c, i) => (
                  <td key={i} style={td}>
                    {c.attended ? (
                      <span title={`${Math.round((c.durationS || 0) / 60)} min`} style={{ color: "#10b981", fontSize: 16 }}>✓</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>·</span>
                    )}
                  </td>
                ))}
                <td style={td}>
                  <b style={{ color: r.attendanceRate >= 75 ? "#10b981" : r.attendanceRate >= 50 ? "#f59e0b" : "#f87171" }}>
                    {r.attendanceRate}%
                  </b>
                </td>
                <td style={td}>{r.totalMinutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentView({ data }) {
  if (data.totalSessions === 0) {
    return <p style={{ color: "#9ca3af" }}>No live sessions yet for this classroom.</p>;
  }
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
        <Stat label="Sessions Attended" value={`${data.attendedCount}/${data.totalSessions}`} color="#a5b4fc" />
        <Stat label="Attendance Rate" value={`${data.attendanceRate}%`} color={data.attendanceRate >= 75 ? "#10b981" : data.attendanceRate >= 50 ? "#f59e0b" : "#f87171"} />
      </div>
      {data.records.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 6, borderLeft: `3px solid ${r.attended ? "#10b981" : "#64748b"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <div>
              <b>{r.title}</b>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(r.scheduledFor).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {r.attended ? (
                <>
                  <span style={{ color: "#10b981", fontSize: 14, fontWeight: 700 }}>✓ Attended</span>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{Math.round((r.durationS || 0) / 60)} min</div>
                </>
              ) : (
                <span style={{ color: "#f87171" }}>✗ Absent</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 14 }}>
      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th = { padding: 8, textAlign: "left", borderBottom: "2px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 12 };
const td = { padding: 8 };
const btnPrimary = { padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
