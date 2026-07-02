import React, { useEffect, useState, useRef, useCallback } from "react";

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
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const path = isHost
      ? `/live-sessions/classrooms/${classroomId}/attendance-report`
      : `/live-sessions/classrooms/${classroomId}/my-attendance`;
    authFetch(path, tokenRef.current)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [classroomId, isHost]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={{ minHeight: 240 }}>
      {!loading && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button className="cr-btn-outline" onClick={fetchData} style={{ padding: "4px 10px", fontSize: 11 }}>🔄 Refresh</button>
        </div>
      )}
      {loading && <div className="cr-glass" style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Loading attendance…</div>}
      {error && (
        <div className="cr-glass" style={{ padding: 12, color: "#f87171", marginBottom: 8 }}>
          Failed: {error}
          <button className="cr-btn-outline" onClick={fetchData} style={{ marginLeft: 8, padding: "2px 8px", fontSize: 11, borderColor: "rgba(239,68,68,0.4)", color: "#f87171" }}>Retry</button>
        </div>
      )}
      {!loading && !error && data && (isHost ? <FacultyView data={data} /> : <StudentView data={data} />)}
    </div>
  );
}

function FacultyView({ data }) {
  if (data.totalSessions === 0) {
    return <div className="cr-empty" style={{ padding: "32px 20px" }}><div className="cr-empty-icon">📋</div><div className="cr-empty-title">No sessions held yet</div><div className="cr-empty-desc">Attendance will appear here once you host your first class.</div></div>;
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
        <div style={{ fontSize: 12, color: "#FFD700" }}>
          {data.rows.length} students × {data.totalSessions} sessions
        </div>
        <button className="cr-btn" onClick={exportCSV}>📥 Export CSV</button>
      </div>
      <div className="cr-glass" style={{ overflowX: "auto" }}>
        <table className="cr-table">
          <thead>
            <tr>
              <th className="cr-th">Student</th>
              {data.sessions.map((s) => (
                <th key={s.id} className="cr-th" title={s.title}>
                  {s.title.length > 14 ? s.title.slice(0, 12) + "…" : s.title}
                  <br />
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{new Date(s.scheduledFor).toLocaleDateString()}</span>
                </th>
              ))}
              <th className="cr-th">Rate</th>
              <th className="cr-th">Min</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.student.id} className="cr-tr">
                <td className="cr-td"><b style={{ color: "#f1f5f9" }}>{r.student.username}</b></td>
                {r.cells.map((c, i) => (
                  <td key={i} className="cr-td">
                    {c.attended ? (
                      <span title={`${Math.round((c.durationS || 0) / 60)} min`} style={{ color: "#10b981", fontSize: 16 }}>✓</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>·</span>
                    )}
                  </td>
                ))}
                <td className="cr-td">
                  <b style={{ color: r.attendanceRate >= 75 ? "#10b981" : r.attendanceRate >= 50 ? "#f59e0b" : "#f87171" }}>
                    {r.attendanceRate}%
                  </b>
                </td>
                <td className="cr-td">{r.totalMinutes}</td>
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
    return <div className="cr-empty" style={{ padding: "32px 20px" }}><div className="cr-empty-icon">📋</div><div className="cr-empty-title">No sessions yet</div><div className="cr-empty-desc">No live sessions have been held for this classroom.</div></div>;
  }
  return (
    <div>
      <div className="cr-stats" style={{ marginBottom: 12 }}>
        <div className="cr-stat"><div className="cr-stat-icon">✓</div><div className="cr-stat-value">{data.attendedCount}/{data.totalSessions}</div><div className="cr-stat-label">Attended</div></div>
        <div className="cr-stat"><div className="cr-stat-icon">📊</div><div className="cr-stat-value" style={{ color: data.attendanceRate >= 75 ? "#10b981" : data.attendanceRate >= 50 ? "#f59e0b" : "#f87171" }}>{data.attendanceRate}%</div><div className="cr-stat-label">Rate</div></div>
      </div>
      {data.records.map((r) => (
        <div key={r.id} className="cr-glass-flat" style={{ marginBottom: 6, borderLeft: `3px solid ${r.attended ? "#10b981" : "#64748b"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <div>
              <b style={{ color: "#f1f5f9", fontSize: 13, fontFamily: "Syne, sans-serif" }}>{r.title}</b>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{new Date(r.scheduledFor).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {r.attended ? (
                <>
                  <span style={{ color: "#10b981", fontSize: 13, fontWeight: 700 }}>✓ Attended</span>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{Math.round((r.durationS || 0) / 60)} min</div>
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

