import React, { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const SORT_OPTIONS = [
  { value: "xp", label: "Weekly XP", emoji: "⚡" },
  { value: "streak", label: "Streak", emoji: "🔥" },
  { value: "sessions", label: "Sessions", emoji: "📚" },
];

export default function GroupLeaderboard({ classroomId, token, currentUser }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("xp");

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/leaderboard?sort=${sort}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      console.error("Leaderboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token, sort]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 15000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  }

  function getRankStyle(rank) {
    if (rank === 0) return { medal: "🥇", glow: "rgba(255,215,0,0.25)" };
    if (rank === 1) return { medal: "🥈", glow: "rgba(192,192,192,0.2)" };
    if (rank === 2) return { medal: "🥉", glow: "rgba(205,127,50,0.2)" };
    return { medal: null, glow: null };
  }

  function getValueLabel(entry) {
    if (sort === "streak") return `${entry.streak} day streak`;
    if (sort === "sessions") return `${entry.sessions} sessions`;
    return `${entry.weeklyXP.toLocaleString()} XP this week`;
  }

  if (loading) {
    return (
      <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading leaderboard…</div>
      </div>
    );
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div>
      {/* Sort toggle */}
      <div className="sg-lb-sort-row">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`sg-lb-sort-btn ${sort === opt.value ? "active" : ""}`}
            onClick={() => setSort(opt.value)}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="sg-lb-podium">
          {podium.map((entry, i) => {
            const { medal, glow } = getRankStyle(i);
            return (
              <div key={entry.userId} className={`sg-lb-podium-card ${i === 0 ? "first" : ""}`} style={glow ? { boxShadow: `0 0 20px ${glow}` } : {}}>
                <div className="sg-lb-podium-medal">{medal}</div>
                <div className="sg-lb-podium-avatar">{getInitials(entry.username)}</div>
                <div className="sg-lb-podium-name">
                  {entry.username} {entry.isMe && <span className="sg-lb-self">(You)</span>}
                </div>
                <div className="sg-lb-podium-value">{getValueLabel(entry)}</div>
                {i === 0 && <div className="sg-lb-crown">👑</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="sg-lb-list">
          {rest.map((entry, i) => {
            const rank = i + 4;
            return (
              <div key={entry.userId} className={`sg-lb-row ${entry.isMe ? "me" : ""}`}>
                <div className="sg-lb-rank">#{rank}</div>
                <div className="sg-lb-avatar">{getInitials(entry.username)}</div>
                <div className="sg-lb-name">
                  {entry.username} {entry.isMe && <span className="sg-lb-self">(You)</span>}
                </div>
                <div className="sg-lb-value">{getValueLabel(entry)}</div>
                <div className="sg-lb-accuracy">{entry.accuracy}% acc</div>
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && (
        <div className="cr-empty" style={{ padding: "32px 20px" }}>
          <div className="cr-empty-icon">🏆</div>
          <div className="cr-empty-title">No data yet</div>
          <div className="cr-empty-desc">Start studying to appear on the leaderboard!</div>
        </div>
      )}
    </div>
  );
}
