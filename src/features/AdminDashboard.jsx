import React, { useState, useMemo } from "react";

const D = {
  bg:     "#07080F",
  card:   "#0d0f1f",
  faint:  "#12142a",
  line:   "#1e2140",
  border: "#B8860B",
  text:   "#e8eaf6",
  muted:  "#7b82b8",
  hint:   "#4a5080",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@400;500;600&display=swap');
  @keyframes ad-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .ad-row { animation: ad-in 0.25s ease forwards; }
  .ad-row:hover { background: #1a1d3a !important; }
`;

// ─── 14-day activity bar chart ─────────────────────────────────────────────────
function ActivityChart({ logins }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toDateString();
  });
  const counts = days.map(day =>
    logins.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === day).length
  );
  const max = Math.max(...counts, 1);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: D.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12, fontFamily: "Syne,sans-serif" }}>
        LOGIN ACTIVITY — LAST 14 DAYS
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
        {days.map((day, i) => {
          const h = counts[i];
          const pct = (h / max) * 100;
          const isToday = day === new Date().toDateString();
          const d = new Date(day);
          const label = `${d.getMonth()+1}/${d.getDate()}`;
          return (
            <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ fontSize: 9, color: h > 0 ? D.muted : "transparent" }}>{h}</div>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(6, pct * 0.6)}px`,
                  background: isToday
                    ? "linear-gradient(180deg,#5c6bc0,#B8860B)"
                    : h > 0 ? "#1a1a1a" : "#0d0f22",
                  border: `0.5px solid ${isToday ? D.border : h > 0 ? "#2a2d5a" : D.line}`,
                  borderRadius: 4,
                }}
                title={`${label}: ${h} login${h !== 1 ? "s" : ""}`}
              />
              {i % 2 === 0 && (
                <div style={{ fontSize: 8, color: isToday ? D.border : D.hint }}>{label}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main AdminDashboard ───────────────────────────────────────────────────────
export default function AdminDashboard({ adminUsers, adminLogins, adminLoading, onRefresh, token }) {
  const [search, setSearch]     = useState("");
  const [sortBy, setSortBy]     = useState("joined");
  const [sortDir, setSortDir]   = useState("desc");

  const todayStr = new Date().toDateString();

  const activeToday = useMemo(() =>
    new Set(adminLogins.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === todayStr).map(l => l.user?.id || l.userId)).size,
    [adminLogins, todayStr]
  );

  const students  = adminUsers.filter(u => u.role?.toUpperCase() === "STUDENT");
  const teachers   = adminUsers.filter(u => u.role?.toUpperCase() === "TEACHER");
  const lecturers  = adminUsers.filter(u => u.role?.toUpperCase() === "LECTURER");

  const loginCountByUser = useMemo(() => {
    const map = {};
    adminLogins.forEach(l => {
      const uid = l.user?.id || l.userId;
      if (uid) map[uid] = (map[uid] || 0) + 1;
    });
    return map;
  }, [adminLogins]);

  const lastLoginByUser = useMemo(() => {
    const map = {};
    adminLogins.forEach(l => {
      const uid = l.user?.id || l.userId;
      if (!uid) return;
      if (!map[uid] || new Date(l.createdAt) > new Date(map[uid])) map[uid] = l.createdAt;
    });
    return map;
  }, [adminLogins]);

  const filtered = useMemo(() => {
    let arr = adminUsers.filter(u =>
      !search ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
    );
    arr = [...arr].sort((a, b) => {
      let va, vb;
      if (sortBy === "joined")   { va = new Date(a.createdAt||0); vb = new Date(b.createdAt||0); }
      else if (sortBy === "name"){ va = a.username||"";           vb = b.username||""; }
      else if (sortBy === "logins"){ va = loginCountByUser[a.id]||0; vb = loginCountByUser[b.id]||0; }
      else if (sortBy === "last"){ va = new Date(lastLoginByUser[a.id]||0); vb = new Date(lastLoginByUser[b.id]||0); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [adminUsers, search, sortBy, sortDir, loginCountByUser, lastLoginByUser]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  const kpis = [
    { icon: "👥", label: "Total Users",    value: adminUsers.length,               color: "#DAA520" },
    { icon: "🎓", label: "Students",       value: students.length,                 color: "#80cbc4" },
    { icon: "🧑‍🏫", label: "Teachers",    value: teachers.length,                 color: "#ffb74d" },
    { icon: "🏫", label: "Lecturers",      value: lecturers.length,                color: "#f48fb1" },
    { icon: "🟢", label: "Active Today",   value: activeToday,                     color: "#81c784" },
    { icon: "🔑", label: "Logins (30d)",   value: adminLogins.length,              color: "#ce93d8" },
  ];

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
        justifyContent: "space-between", flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: D.text, fontFamily: "Syne,sans-serif" }}>🛡️ Admin Dashboard</div>
          <div style={{ fontSize: 11, color: D.muted }}>Platform overview and user management</div>
        </div>
        <button
          onClick={onRefresh}
          disabled={adminLoading || !token}
          style={{
            background: D.faint, border: `0.5px solid ${D.line}`,
            borderRadius: 10, padding: "7px 16px", fontSize: 12,
            color: adminLoading ? D.hint : D.border, cursor: adminLoading ? "default" : "pointer",
            fontFamily: "Manrope,sans-serif", fontWeight: 600,
          }}
        >
          {adminLoading ? "⏳ Loading…" : "🔄 Refresh"}
        </button>
      </div>

      {!token && (
        <div style={{ background: "#1a1000", border: "0.5px solid #4a3a00", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#ffb74d" }}>
          ⚠️ Backend token missing — log in via backend to see live data.
        </div>
      )}

      {/* KPI rows — 3 + 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
        {kpis.slice(0,3).map(k => (
          <div key={k.label} style={{
            background: D.faint, border: `0.5px solid ${D.line}`,
            borderRadius: 14, padding: "12px 10px 10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1, fontFamily: "Syne,sans-serif" }}>{k.value}</div>
            <div style={{ fontSize: 9, color: D.hint, marginTop: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        {kpis.slice(3).map(k => (
          <div key={k.label} style={{
            background: D.faint, border: `0.5px solid ${D.line}`,
            borderRadius: 14, padding: "12px 10px 10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1, fontFamily: "Syne,sans-serif" }}>{k.value}</div>
            <div style={{ fontSize: 9, color: D.hint, marginTop: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div style={{ background: D.faint, border: `0.5px solid ${D.line}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
        {adminLoading
          ? <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: D.hint }}>⏳ Loading activity…</div>
          : <ActivityChart logins={adminLogins} />
        }
      </div>

      {/* User table */}
      <div style={{ background: D.faint, border: `0.5px solid ${D.line}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
        {/* Table header */}
        <div style={{ padding: "12px 16px", borderBottom: `0.5px solid ${D.line}`, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.border, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "Syne,sans-serif", flex: 1 }}>
            USERS ({filtered.length})
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name / email / role…"
            style={{
              background: D.card, border: `0.5px solid ${D.line}`,
              borderRadius: 9, padding: "6px 12px", fontSize: 11,
              color: D.text, fontFamily: "Manrope,sans-serif", outline: "none", width: 200,
            }}
          />
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 90px 80px 80px 90px",
          padding: "8px 16px", borderBottom: `0.5px solid ${D.line}`,
          background: "#0a0c1e",
        }}>
          {[["name","Name"],["joined","Joined"],["last","Last Active"],["logins","Logins"],["","Role"]].map(([col, label]) => (
            <div
              key={col || label}
              onClick={() => col && toggleSort(col)}
              style={{
                fontSize: 9, fontWeight: 700, color: sortBy === col ? D.border : D.hint,
                cursor: col ? "pointer" : "default",
                letterSpacing: "0.07em", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {label}
              {col && sortBy === col && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 400, overflowY: "auto", scrollbarWidth: "none" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: D.hint }}>
              {adminUsers.length === 0 ? "No data loaded yet — click Refresh." : "No users match your search."}
            </div>
          ) : (
            filtered.map((u, i) => {
              const logins    = loginCountByUser[u.id] || 0;
              const lastLogin = lastLoginByUser[u.id];
              const isTeacher = u.role?.toUpperCase() !== "STUDENT";
              const roleColor = u.role?.toUpperCase() === "LECTURER" ? "#f48fb1" : isTeacher ? "#ffb74d" : "#80cbc4";
              return (
                <div
                  key={u.id}
                  className="ad-row"
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 90px 80px 80px 90px",
                    padding: "10px 16px",
                    borderBottom: i < filtered.length - 1 ? `0.5px solid ${D.line}` : "none",
                    background: "transparent", transition: "background 0.15s",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: D.text, fontFamily: "Manrope,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.username || "—"}
                    </div>
                    <div style={{ fontSize: 10, color: D.hint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email || ""}</div>
                  </div>
                  <div style={{ fontSize: 10, color: D.muted, alignSelf: "center" }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: D.muted, alignSelf: "center" }}>
                    {lastLogin ? new Date(lastLogin).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: logins > 0 ? "#DAA520" : D.hint, alignSelf: "center" }}>
                    {logins}
                  </div>
                  <div style={{ alignSelf: "center" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: roleColor,
                      background: `${roleColor}18`, border: `0.5px solid ${roleColor}40`,
                      borderRadius: 6, padding: "2px 7px", letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}>{u.role || "?"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
