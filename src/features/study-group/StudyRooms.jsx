import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../lib/constants";
import { Avatar } from "../feed/feedUi";

export default function StudyRooms({ classroomId, token, currentUser }) {
  const [rooms, setRooms] = useState(null);
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
      const myRoom = data.find((r) => r.participants?.some((p) => p.userId === myId && !p.leftAt));
      if (myRoom && !activeRoom) setActiveRoom(myRoom);
    } catch (err) {
      console.error("Study rooms error:", err);
    }
  }, [classroomId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  useEffect(() => {
    if (!timerRunning || !activeRoom) return;
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        const totalSeconds = (timerMode === "focus" ? activeRoom.pomodoroMin : activeRoom.breakMin) * 60;
        if (prev >= totalSeconds) {
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
        setActiveRoom({ ...room, participants: [...(room.participants || []), { userId: myId, user: { id: myId, name: currentUser?.username } }] });
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

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const totalSeconds = activeRoom ? (timerMode === "focus" ? activeRoom.pomodoroMin : activeRoom.breakMin) * 60 : 0;
  const progress = totalSeconds > 0 ? (timer / totalSeconds) * 100 : 0;
  const CIRC = 2 * Math.PI * 54;

  if (rooms === null) {
    return (
      <div className="fd-skeletons">
        {[0, 1].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 84 }} />)}
      </div>
    );
  }

  return (
    <div className="gv-rooms">
      {activeRoom && (
        <div className="gv-timer fd-card">
          <div className="gv-timer-head">
            <span className="gv-timer-name">📚 {activeRoom.name}</span>
            <span className={`gv-timer-mode ${timerMode}`}>{timerMode === "focus" ? "🎯 Focus" : "☕ Break"}</span>
          </div>
          <div className="gv-timer-ring">
            <svg width="132" height="132" viewBox="0 0 132 132">
              <circle cx="66" cy="66" r="54" fill="none" stroke="rgba(245,197,66,0.12)" strokeWidth="7" />
              <circle
                cx="66" cy="66" r="54" fill="none"
                stroke={timerMode === "focus" ? "var(--fd-gold, #F5C542)" : "#3DD68C"}
                strokeWidth="7"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress / 100)}
                strokeLinecap="round"
                transform="rotate(-90 66 66)"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="gv-timer-text">{fmt(timer)}</div>
          </div>
          <div className="gv-timer-crew">
            {activeRoom.participants?.filter((p) => !p.leftAt).map((p) => (
              <Avatar key={p.userId} user={p.user} size={26} />
            ))}
            <span className="gv-timer-crew-count">{activeRoom.participants?.filter((p) => !p.leftAt).length || 1} studying</span>
          </div>
          <div className="gv-timer-controls">
            <button className="fd-follow-btn sm" onClick={() => setTimerRunning(!timerRunning)}>
              {timerRunning ? "⏸ Pause" : "▶ Resume"}
            </button>
            <button className="fd-follow-btn sm" onClick={() => { setTimer(0); setTimerMode(timerMode === "focus" ? "break" : "focus"); }}>
              ⏭ Skip
            </button>
            <button
              className="fd-join-btn danger"
              onClick={() => (activeRoom.hostId === myId ? endRoom(activeRoom.id) : leaveRoom(activeRoom.id))}
            >
              {activeRoom.hostId === myId ? "End session" : "Leave"}
            </button>
          </div>
        </div>
      )}

      {!activeRoom && (
        showCreate ? (
          <div className="gv-room-create fd-card">
            <input
              className="fd-sheet-input"
              value={newRoom.name}
              onChange={(e) => setNewRoom((p) => ({ ...p, name: e.target.value }))}
              placeholder="Session name (e.g., 'Anatomy cram')"
            />
            <div className="gv-room-create-row">
              <label className="gv-room-field">Focus (min)
                <input className="fd-sheet-input" type="number" value={newRoom.pomodoroMin} onChange={(e) => setNewRoom((p) => ({ ...p, pomodoroMin: parseInt(e.target.value) || 25 }))} />
              </label>
              <label className="gv-room-field">Break (min)
                <input className="fd-sheet-input" type="number" value={newRoom.breakMin} onChange={(e) => setNewRoom((p) => ({ ...p, breakMin: parseInt(e.target.value) || 5 }))} />
              </label>
            </div>
            <div className="gv-room-create-row">
              <button className="fd-follow-btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="fd-join-btn" style={{ flex: 1 }} onClick={createRoom}>Start session</button>
            </div>
          </div>
        ) : (
          <button className="fd-go-btn" onClick={() => setShowCreate(true)}>🚀 Start a focus room</button>
        )
      )}

      {!activeRoom && rooms.length === 0 && (
        <div className="fd-empty">
          <div className="fd-empty-icon">🚀</div>
          <div className="fd-empty-title">No active sessions</div>
          <div className="fd-empty-sub">Start a Pomodoro room and the group can join your timer.</div>
        </div>
      )}

      {!activeRoom && rooms.length > 0 && (
        <div className="gv-rooms-list">
          {rooms.map((room) => {
            const act = room.participants?.filter((p) => !p.leftAt) || [];
            return (
              <div key={room.id} className="gv-room fd-card">
                <span className="gv-room-pulse" />
                <div className="gv-room-info">
                  <div className="gv-room-name">📚 {room.name}</div>
                  <div className="gv-room-meta">
                    {room.host?.name || "Member"} · {room.pomodoroMin}m focus / {room.breakMin}m break
                  </div>
                  <div className="gv-room-crew">
                    {act.slice(0, 5).map((p) => <Avatar key={p.userId} user={p.user} size={20} />)}
                    <span className="gv-room-count">{act.length} in</span>
                  </div>
                </div>
                <button className="fd-join-btn" onClick={() => joinRoom(room.id)}>Join</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
