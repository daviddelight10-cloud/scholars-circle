import React, { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

export default function GroupMembers({ classroomId, token, currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      console.error("Members error:", err);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token]);

  useEffect(() => {
    fetchMembers();
    const interval = setInterval(fetchMembers, 15000);
    return () => clearInterval(interval);
  }, [fetchMembers]);

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  }

  function getDisplayName(user) {
    return user?.fullName || user?.username || "Scholar";
  }

  function getStats(user) {
    const xp = user?.progress?.xp || user?.totalXp || 0;
    const streak = user?.progress?.streak || 0;
    const sessions = user?.progress?.sessions || 0;
    return { xp, streak, sessions };
  }

  if (loading) {
    return (
      <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading members…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="sg-members-grid">
        {members.map((m) => {
          const user = m.user;
          const name = getDisplayName(user);
          const stats = getStats(user);
          const isCreator = m.isCreator;
          const isMe = user.id === (currentUser?.id || currentUser?.sub);

          return (
            <div key={m.id || user.id} className="sg-member-card" onClick={() => setSelectedMember(user)}>
              <div className="sg-member-avatar" style={isCreator ? { borderColor: "#FFD700" } : {}}>
                {getInitials(name)}
                {isCreator && <div className="sg-member-badge">👑</div>}
              </div>
              <div className="sg-member-info">
                <div className="sg-member-name">
                  {name} {isMe && <span className="sg-member-self">(You)</span>}
                </div>
                <div className="sg-member-role">{user.role === "TEACHER" || user.role === "LECTURER" ? "Teacher" : "Student"}</div>
                <div className="sg-member-stats">
                  <span className="sg-stat-pill">⚡ {stats.xp.toLocaleString()} XP</span>
                  <span className="sg-stat-pill">🔥 {stats.streak}d</span>
                  <span className="sg-stat-pill">📚 {stats.sessions}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedMember && (
        <div className="modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="modal-content cr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="sg-profile-header">
              <div className="sg-profile-avatar" style={{ fontSize: 36 }}>
                {getInitials(getDisplayName(selectedMember))}
              </div>
              <h3 className="sg-profile-name">{getDisplayName(selectedMember)}</h3>
              <div className="sg-profile-role">
                {selectedMember.role === "TEACHER" || selectedMember.role === "LECTURER" ? "👨‍🏫 Teacher" : "🎓 Student"}
              </div>
            </div>
            <div className="sg-profile-stats">
              <div className="sg-profile-stat">
                <div className="sg-profile-stat-value">{getStats(selectedMember).xp.toLocaleString()}</div>
                <div className="sg-profile-stat-label">Total XP</div>
              </div>
              <div className="sg-profile-stat">
                <div className="sg-profile-stat-value">{getStats(selectedMember).streak}</div>
                <div className="sg-profile-stat-label">Day Streak</div>
              </div>
              <div className="sg-profile-stat">
                <div className="sg-profile-stat-value">{getStats(selectedMember).sessions}</div>
                <div className="sg-profile-stat-label">Sessions</div>
              </div>
            </div>
            <button className="cr-btn" style={{ width: "100%", marginTop: 14 }} onClick={() => setSelectedMember(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
