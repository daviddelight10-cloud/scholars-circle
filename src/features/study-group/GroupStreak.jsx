import React, { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railay.app";
const MILESTONES = [
  { days: 3, emoji: "🌱", label: "Getting started" },
  { days: 7, emoji: "🔥", label: "1 week strong" },
  { days: 14, emoji: "⚡", label: "2 weeks unstoppable" },
  { days: 30, emoji: "🏆", label: "Monthly masters" },
  { days: 50, emoji: "💎", label: "Diamond scholars" },
  { days: 100, emoji: "👑", label: "Legendary" },
];

export default function GroupStreak({ classroomId, token }) {
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCelebrate, setShowCelebrate] = useState(null);

  const fetchStreak = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/streak`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setStreakData(data);
    } catch (err) {
      console.error("Streak error:", err);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token]);

  useEffect(() => {
    fetchStreak();
    const interval = setInterval(fetchStreak, 30000);
    return () => clearInterval(interval);
  }, [fetchStreak]);

  // Check for milestone celebrations
  useEffect(() => {
    if (!streakData?.groupStreak) return;
    const milestone = MILESTONES.find((m) => m.days === streakData.groupStreak);
    if (milestone) {
      setShowCelebrate(milestone);
      setTimeout(() => setShowCelebrate(null), 5000);
    }
  }, [streakData?.groupStreak]);

  if (loading) {
    return (
      <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading streak…</div>
      </div>
    );
  }

  if (!streakData) return null;

  const { groupStreak, totalMembers, studiedToday, totalSessions, memberStreaks } = streakData;
  const nextMilestone = MILESTONES.find((m) => m.days > groupStreak);
  const prevMilestone = [...MILESTONES].reverse().find((m) => m.days <= groupStreak);
  const progressToNext = nextMilestone
    ? Math.round(((groupStreak - (prevMilestone?.days || 0)) / (nextMilestone.days - (prevMilestone?.days || 0))) * 100)
    : 100;

  return (
    <div>
      {/* Main streak card */}
      <div className="sg-streak-hero">
        <div className="sg-streak-flame">{groupStreak > 0 ? "🔥" : "💤"}</div>
        <div className="sg-streak-count">{groupStreak}</div>
        <div className="sg-streak-label">Day Group Streak</div>
        <div className="sg-streak-sub">
          {groupStreak > 0 ? "Keep it going together!" : "Start studying to begin the streak!"}
        </div>
      </div>

      {/* Quick stats */}
      <div className="sg-streak-stats">
        <div className="sg-streak-stat-card">
          <div className="sg-streak-stat-icon">👥</div>
          <div className="sg-streak-stat-value">{totalMembers}</div>
          <div className="sg-streak-stat-label">Members</div>
        </div>
        <div className="sg-streak-stat-card">
          <div className="sg-streak-stat-icon">📚</div>
          <div className="sg-streak-stat-value">{studiedToday}</div>
          <div className="sg-streak-stat-label">Studied Today</div>
        </div>
        <div className="sg-streak-stat-card">
          <div className="sg-streak-stat-icon">🎯</div>
          <div className="sg-streak-stat-value">{totalSessions}</div>
          <div className="sg-streak-stat-label">Total Sessions</div>
        </div>
      </div>

      {/* Milestone progress */}
      {nextMilestone && (
        <div className="sg-streak-milestone">
          <div className="sg-streak-milestone-header">
            <span>Next milestone: {nextMilestone.emoji} {nextMilestone.label}</span>
            <span>{groupStreak} / {nextMilestone.days} days</span>
          </div>
          <div className="sg-streak-milestone-bar">
            <div className="sg-streak-milestone-fill" style={{ width: `${progressToNext}%` }} />
          </div>
        </div>
      )}

      {/* Milestone badges */}
      <div className="sg-streak-badges">
        {MILESTONES.map((m) => {
          const achieved = groupStreak >= m.days;
          return (
            <div key={m.days} className={`sg-streak-badge ${achieved ? "achieved" : "locked"}`}>
              <div className="sg-streak-badge-emoji">{achieved ? m.emoji : "🔒"}</div>
              <div className="sg-streak-badge-label">{m.label}</div>
              <div className="sg-streak-badge-days">{m.days} days</div>
            </div>
          );
        })}
      </div>

      {/* Member streaks */}
      {memberStreaks && memberStreaks.length > 0 && (
        <div className="sg-streak-members">
          <div className="sg-streak-members-title">🔥 Member Streaks</div>
          {memberStreaks
            .sort((a, b) => b.streak - a.streak)
            .map((m) => (
              <div key={m.userId} className="sg-streak-member-row">
                <span className="sg-streak-member-flame">{m.streak > 0 ? "🔥" : "💤"}</span>
                <span className="sg-streak-member-days">{m.streak} days</span>
                <span className="sg-streak-member-xp">⚡ {m.xp?.toLocaleString() || 0} XP</span>
              </div>
            ))}
        </div>
      )}

      {/* Celebration overlay */}
      {showCelebrate && (
        <div className="sg-celebrate-overlay">
          <div className="sg-celebrate-card">
            <div className="sg-celebrate-emoji" style={{ fontSize: 60 }}>{showCelebrate.emoji}</div>
            <div className="sg-celebrate-title">Group Milestone!</div>
            <div className="sg-celebrate-desc">{showCelebrate.label}</div>
            <div className="sg-celebrate-sub">{groupStreak} days studying together! 🎉</div>
          </div>
        </div>
      )}
    </div>
  );
}
