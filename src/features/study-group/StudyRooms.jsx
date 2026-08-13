import React, { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

export default function StudyRooms({ classroomId, token, currentUser }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", pomodoroMin: 25, breakMin: 5 });
  const [activeRoom, setActiveRoom] = useState(null);
  const [timer, setTimer] = useState(0);
  const [timerMode, setTimerMode] = useState("focus"); // focus | break
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${token}` };
  const myId = currentUser?.id || currentUser?.sub;

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/study-rooms`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRooms(data);
      // Check if I'm in any active room
      const myRoom = data.find((r) => r.participants?.some((p) => p.userId === myId && !p.leftAt));
      if (myRoom && !activeRoom) setActiveRoom(myRoom);
    } catch (err) {
      console.error("Study rooms error:", err);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  // Timer logic
  useEffect(() => {
    if (!timerRunning || !activeRoom) return;
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        const totalSeconds = (timerMode === "focus" ? activeRoom.pomodoroMin : activeRoom.breakMin) * 60;
        if (prev >= totalSeconds) {
          // Switch mode
          setTimerMode((m) => (m === "focus" ? "break" : "focus"));
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerRunning, activeRoom, timerMode]);

  async function createRoom() {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/study-rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(newRoom),
      });
      if (!res.ok) throw new Error("Failed to create");
      const room = await res.json();
      setActiveRoom(room);
      setTimer(0);
      setTimerMode("focus");
      setTimerRunning(true);
      setShowCreate(false);
      setNewRoom({ name: "", pomodoroMin: 25, breakMin: 5 });
      fetchRooms();
    } catch (err) {
      console.error("Create room error:", err);
    }
  }

  async function joinRoom(roomId) {
    try {
      await fetch(`${API_BASE}/study-group/study-rooms/${roomId}/join`, {
        method: "POST",
        headers: authHeaders,
      });
      fetchRooms();
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        setActiveRoom({ ...room, participants: [...(room.participants || []), { userId: myId, user: { id: myId, username: currentUser?.username } }] });
        setTimer(0);
        setTimerMode("focus");
        setTimerRunning(true);
      }
    } catch (err) {
      console.error("Join room error:", err);
    }
  }

  async function leaveRoom(roomId) {
    try {
      await fetch(`${API_BASE}/study-group/study-rooms/${roomId}/leave`, {
        method: "POST",
        headers: authHeaders,
      });
      setActiveRoom(null);
      setTimerRunning(false);
      setTimer(0);
      fetchRooms();
    } catch (err) {
      console.error("Leave room error:", err);
    }
  }

  async function endRoom(roomId) {
    try {
      await fetch(`${API_BASE}/study-group/study-rooms/${roomId}/end`, {
        method: "POST",
        headers: authHeaders,
      });
      setActiveRoom(null);
      setTimerRunning(false);
      setTimer(0);
      fetchRooms();
    } catch (err) {
      console.error("End room error:", err);
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function getDisplayName(user) {
    return user?.fullName || user?.username || "Scholar";
  }

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  }

  const totalSeconds = activeRoom ? (timerMode === "focus" ? activeRoom.pomodoroMin : activeRoom.breakMin) * 60 : 0;
  const progress = totalSeconds > 0 ? (timer / totalSeconds) * 100 : 0;

  if (loading) {
    return (
      <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading study rooms…</div>
      </div>
    );
  }

  return (
    <div>
      {/* Active timer */}
      {activeRoom && (
        <div className="sg-timer-card">
          <div className="sg-timer-header">
            <div className="sg-timer-room-name">📚 {activeRoom.name}</div>
            <div className={`sg-timer-mode ${timerMode}`}>{timerMode === "focus" ? "🎯 Focus" : "☕ Break"}</div>
          </div>
          <div className="sg-timer-display">
            <div className="sg-timer-ring">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,215,0,0.1)" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke={timerMode === "focus" ? "#FFD700" : "#3DD68C"}
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="sg-timer-text">{formatTime(timer)}</div>
            </div>
          </div>
          <div className="sg-timer-controls">
            <button className="cr-btn-outline" onClick={() => setTimerRunning(!timerRunning)}>
              {timerRunning ? "⏸ Pause" : "▶ Resume"}
            </button>
            <button className="cr-btn-outline" onClick={() => { setTimer(0); setTimerMode(timerMode === "focus" ? "break" : "focus"); }}>
              ⏭ Skip
            </button>
            {activeRoom.hostId === myId ? (
              <button className="cr-btn" style={{ background: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.4)" }} onClick={() => endRoom(activeRoom.id)}>
                End Session
              </button>
            ) : (
              <button className="cr-btn" style={{ background: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.4)" }} onClick={() => leaveRoom(activeRoom.id)}>
                Leave
              </button>
            )}
          </div>
          <div className="sg-timer-participants">
            <span className="sg-timer-participants-label">Studying now:</span>
            {activeRoom.participants?.filter((p) => !p.leftAt).map((p) => (
              <span key={p.userId} className="sg-timer-participant-chip">
                {getInitials(getDisplayName(p.user))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Create room button */}
      {!activeRoom && (
        <div className="cr-collapsible" style={{ marginBottom: 12 }}>
          <div className="cr-collapsible-header" onClick={() => setShowCreate(!showCreate)}>
            <span>🚀 Start Study Session</span>
            <span>{showCreate ? "▲" : "▼"}</span>
          </div>
          {showCreate && (
            <div className="cr-collapsible-body">
              <input
                className="cr-input"
                value={newRoom.name}
                onChange={(e) => setNewRoom((p) => ({ ...p, name: e.target.value }))}
                placeholder="Session name (e.g., 'Calculus cram session')"
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#9ca3af" }}>Focus (min)</label>
                  <input className="cr-input" type="number" value={newRoom.pomodoroMin} onChange={(e) => setNewRoom((p) => ({ ...p, pomodoroMin: parseInt(e.target.value) || 25 }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#9ca3af" }}>Break (min)</label>
                  <input className="cr-input" type="number" value={newRoom.breakMin} onChange={(e) => setNewRoom((p) => ({ ...p, breakMin: parseInt(e.target.value) || 5 }))} />
                </div>
              </div>
              <button className="cr-btn" style={{ width: "100%" }} onClick={createRoom}>Start Session</button>
            </div>
          )}
        </div>
      )}

      {/* Active rooms list */}
      {!activeRoom && (
        <div>
          {rooms.length === 0 ? (
            <div className="cr-empty" style={{ padding: "32px 20px" }}>
              <div className="cr-empty-icon">🚀</div>
              <div className="cr-empty-title">No active study sessions</div>
              <div className="cr-empty-desc">Start a Pomodoro session and invite your group to join!</div>
            </div>
          ) : (
            <div className="sg-rooms-list">
              {rooms.map((room) => {
                const activeParticipants = room.participants?.filter((p) => !p.leftAt) || [];
                const isHost = room.hostId === myId;
                return (
                  <div key={room.id} className="sg-room-card">
                    <div className="sg-room-info">
                      <div className="sg-room-name">📚 {room.name}</div>
                      <div className="sg-room-meta">
                        Hosted by {getDisplayName(room.host)} · {room.pomodoroMin}min focus / {room.breakMin}min break
                      </div>
                      <div className="sg-room-participants">
                        {activeParticipants.map((p) => (
                          <span key={p.userId} className="sg-room-participant-dot" title={getDisplayName(p.user)}>
                            {getInitials(getDisplayName(p.user))}
                          </span>
                        ))}
                        <span className="sg-room-count">{activeParticipants.length} studying</span>
                      </div>
                    </div>
                    <button className="cr-btn" onClick={() => joinRoom(room.id)}>Join</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
