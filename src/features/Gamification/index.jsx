import { useState, useEffect } from "react";
import LeaguesBadges from "./LeaguesBadges";
import DuelArena from "./DuelArena";
import ClassWall from "./ClassWall";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function GamificationHub({ token, userId, username, classroomId: propClassroomId, leaderboard: propLeaderboard }) {
  const [tab, setTab] = useState("leagues");
  const [classrooms, setClassrooms] = useState([]);
  const [activeClassroomId, setActiveClassroomId] = useState(propClassroomId || null);
  const [leaderboard, setLeaderboard] = useState(propLeaderboard || []);

  // Fetch user's classrooms for wall
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/classroom`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setClassrooms(data);
          if (!activeClassroomId) setActiveClassroomId(data[0].id);
        }
      }).catch(() => {});
  }, [token]);

  // Fetch leaderboard for duel opponent picker
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/users/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLeaderboard(data); })
      .catch(() => {});
  }, [token]);

  const tabs = [
    { key: "leagues", label: "🏆 Leagues" },
    { key: "duels", label: "⚔️ Duels" },
    { key: "wall", label: "📣 Wall" },
  ];

  return (
    <div>
      {/* Top tab navigation */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 16, background: "var(--card-bg, #1e293b)",
        borderRadius: 12, padding: 4, border: "1px solid var(--border-color, #334155)",
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "10px 8px", border: "none", borderRadius: 8,
              background: tab === t.key ? "var(--accent-color, #3b82f6)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--text-secondary, #94a3b8)",
              fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "leagues" && <LeaguesBadges token={token} />}
      {tab === "duels" && <DuelArena token={token} userId={userId} leaderboard={leaderboard} />}
      {tab === "wall" && (
        <div>
          {/* Classroom picker for wall */}
          {classrooms.length > 1 && (
            <select
              value={activeClassroomId || ""}
              onChange={e => setActiveClassroomId(e.target.value)}
              style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color, #334155)", background: "var(--card-bg, #1e293b)", color: "var(--text-primary)", fontSize: 12, width: "100%" }}
            >
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {activeClassroomId ? (
            <ClassWall token={token} userId={userId} classroomId={activeClassroomId} username={username} />
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏫</div>
              <div style={{ fontSize: 13 }}>Join a classroom to see the class wall</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
