import React, { useState, useEffect } from "react";
import GroupChat from "./GroupChat.jsx";
import GroupMembers from "./GroupMembers.jsx";
import GroupGoals from "./GroupGoals.jsx";
import GroupLeaderboard from "./GroupLeaderboard.jsx";
import StudyRooms from "./StudyRooms.jsx";
import QuizBattles from "./QuizBattles.jsx";
import GroupStreak from "./GroupStreak.jsx";

const HUB_TABS = [
  { id: "chat", icon: "💬", label: "Chat" },
  { id: "members", icon: "👥", label: "Members" },
  { id: "leaderboard", icon: "🏆", label: "Leaderboard" },
  { id: "goals", icon: "🎯", label: "Goals" },
  { id: "study", icon: "🚀", label: "Study Rooms" },
  { id: "battles", icon: "⚔️", label: "Quiz Battles" },
  { id: "streak", icon: "🔥", label: "Streak" },
];

export default function StudyGroupHub({ token, currentUser, subjects = [], isFaculty = false }) {
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");

  const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/classroom/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setClassrooms(data || []);
        if (data && data.length > 0) setSelectedClassroom(data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedClassroom?.id) return;
    fetch(`${API_BASE}/classroom/${selectedClassroom.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setSelectedClassroom(data))
      .catch(() => {});
  }, [token, selectedClassroom?.id]);

  function getInitials(name) {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    return (words[0]?.[0] || "?") + (words[1]?.[0] || "");
  }

  if (loading) {
    return (
      <div className="sgh-loading">
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading study groups…</div>
      </div>
    );
  }

  if (classrooms.length === 0) {
    return (
      <div className="sgh-empty">
        <div className="sgh-empty-icon">📚</div>
        <div className="sgh-empty-title">No study groups yet</div>
        <div className="sgh-empty-desc">
          {isFaculty
            ? "Create a classroom first from the Classroom tab, then come back here to use study group features."
            : "Join a classroom from the Classroom tab to unlock study group features."}
        </div>
      </div>
    );
  }

  return (
    <div className="sgh-shell">
      {/* Classroom selector */}
      <div className="sgh-classroom-bar">
        <div className="sgh-classroom-label">📚 Study Group:</div>
        <div className="sgh-classroom-chips">
          {classrooms.map((c) => (
            <button
              key={c.id}
              className={`sgh-classroom-chip ${selectedClassroom?.id === c.id ? "active" : ""}`}
              onClick={() => setSelectedClassroom(c)}
            >
              <span className="sgh-chip-avatar">{getInitials(c.name)}</span>
              <span className="sgh-chip-name">{c.name}</span>
              <span className="sgh-chip-count">{c._count?.members ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="sgh-tab-bar">
        {HUB_TABS.map((t) => (
          <button
            key={t.id}
            className={`sgh-tab-btn ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="sgh-tab-icon">{t.icon}</span>
            <span className="sgh-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab} className="sgh-tab-content">
        {activeTab === "chat" && (
          <GroupChat classroomId={selectedClassroom.id} token={token} currentUser={currentUser} />
        )}
        {activeTab === "members" && (
          <GroupMembers classroomId={selectedClassroom.id} token={token} currentUser={currentUser} />
        )}
        {activeTab === "leaderboard" && (
          <GroupLeaderboard classroomId={selectedClassroom.id} token={token} currentUser={currentUser} />
        )}
        {activeTab === "goals" && (
          <GroupGoals classroomId={selectedClassroom.id} token={token} isTeacher={isFaculty} />
        )}
        {activeTab === "study" && (
          <StudyRooms classroomId={selectedClassroom.id} token={token} currentUser={currentUser} />
        )}
        {activeTab === "battles" && (
          <QuizBattles
            classroomId={selectedClassroom.id}
            token={token}
            currentUser={currentUser}
            members={selectedClassroom?.members || []}
            subjects={subjects}
          />
        )}
        {activeTab === "streak" && (
          <GroupStreak classroomId={selectedClassroom.id} token={token} />
        )}
      </div>
    </div>
  );
}
