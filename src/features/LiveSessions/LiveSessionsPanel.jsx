import React, { useEffect, useState } from "react";
import { liveSessionsApi } from "./api.js";
import { LiveSessionRoom } from "./LiveSessionRoom.jsx";

export function LiveSessionsPanel({ classroomId, classroomName, isHost, currentUser, token }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSession, setActiveSession] = useState(null); // session being attended

  // create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    return d.toISOString().slice(0, 16); // local datetime-local string
  });
  const [durationMins, setDurationMins] = useState(60);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await liveSessionsApi.listForClassroom(classroomId, token);
      setSessions(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // refresh every 30s so students see "live" status
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await liveSessionsApi.schedule(classroomId, {
        title: title.trim(),
        description: description.trim() || null,
        scheduledFor: new Date(scheduledFor).toISOString(),
        durationMins: parseInt(durationMins) || 60
      }, token);
      setTitle("");
      setDescription("");
      setShowCreate(false);
      await load();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleStart(session) {
    try {
      const updated = await liveSessionsApi.start(session.id, token);
      // Open the room
      setActiveSession({ ...session, ...updated, classroom: { id: classroomId, name: classroomName } });
      load();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  async function handleJoin(session) {
    setActiveSession({ ...session, classroom: { id: classroomId, name: classroomName } });
  }

  async function handleCancel(session) {
    if (!confirm(`Cancel session "${session.title}"?`)) return;
    try {
      await liveSessionsApi.cancel(session.id, token);
      load();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  const live = sessions.filter((s) => s.status === "live");
  const upcoming = sessions.filter((s) => s.status === "scheduled");
  const past = sessions.filter((s) => s.status === "ended" || s.status === "cancelled");

  if (activeSession) {
    return (
      <LiveSessionRoom
        session={activeSession}
        currentUser={currentUser}
        isHost={isHost && activeSession.hostId === (currentUser?.id || currentUser?.sub)}
        token={token}
        onLeave={() => { setActiveSession(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>📹 Live Sessions</h3>
        {isHost && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff", fontWeight: 600, cursor: "pointer"
            }}
          >
            {showCreate ? "✕ Cancel" : "➕ Schedule Session"}
          </button>
        )}
      </div>

      {showCreate && isHost && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Lecture 5: Cell Biology"
              style={inp}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Description <span style={hint}>(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topic agenda, prerequisites, etc."
              rows={2}
              style={{ ...inp, resize: "vertical" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Scheduled for *</label>
              <input
                required
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Duration (minutes)</label>
              <input
                type="number"
                min="5"
                max="480"
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
                style={inp}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !title.trim()}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none",
              background: title.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.3)",
              color: "#fff", fontWeight: 700, cursor: creating ? "wait" : "pointer"
            }}
          >
            {creating ? "Scheduling..." : "📅 Schedule"}
          </button>
        </form>
      )}

      {loading && <div style={{ padding: 20, color: "#9ca3af" }}>Loading sessions...</div>}
      {error && <div style={{ padding: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: 8, marginBottom: 12 }}>{error}</div>}

      {!loading && sessions.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
          {isHost
            ? "No sessions yet. Click 'Schedule Session' to host your first live class."
            : "No live sessions yet. Your lecturer will schedule one soon."}
        </div>
      )}

      {/* Live now */}
      {live.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#ef4444", marginBottom: 8, letterSpacing: 0.5 }}>
            🔴 Live Now
          </div>
          {live.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isHost={isHost}
              accent="#ef4444"
              actionLabel="🎥 Join Live"
              onAction={() => handleJoin(s)}
              onCancel={isHost ? () => handleCancel(s) : null}
            />
          ))}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#a5b4fc", marginBottom: 8, letterSpacing: 0.5 }}>
            📅 Upcoming
          </div>
          {upcoming.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isHost={isHost}
              accent="#6366f1"
              actionLabel={isHost ? "▶️ Start Now" : "⏳ Waiting…"}
              actionDisabled={!isHost}
              onAction={isHost ? () => handleStart(s) : null}
              onCancel={isHost ? () => handleCancel(s) : null}
            />
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 8, letterSpacing: 0.5 }}>
            📼 Past
          </div>
          {past.slice(0, 10).map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isHost={isHost}
              accent="#64748b"
              actionLabel={null}
              onAction={null}
              onCancel={null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, isHost, accent, actionLabel, actionDisabled, onAction, onCancel }) {
  const dt = new Date(session.scheduledFor);
  const attendCount = session._count?.attendances || 0;
  return (
    <div className="card" style={{ marginBottom: 8, borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{session.title}</div>
          {session.description && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{session.description}</div>}
          <div style={{ fontSize: 12, color: "#a5b4fc", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <span>🕐 {dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
            <span>⏱ {session.durationMins} min</span>
            {(session.status === "live" || session.status === "ended") && (
              <span>👥 {attendCount} attended</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {actionLabel && (
            <button
              onClick={onAction}
              disabled={actionDisabled}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: actionDisabled ? "rgba(99,102,241,0.3)" : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                color: "#fff", fontWeight: 600,
                cursor: actionDisabled ? "default" : "pointer",
                fontSize: 13
              }}
            >
              {actionLabel}
            </button>
          )}
          {onCancel && session.status === "scheduled" && (
            <button
              onClick={onCancel}
              title="Cancel"
              style={{
                padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)",
                background: "transparent", color: "#f87171", cursor: "pointer"
              }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4, fontWeight: 600 };
const hint = { color: "#9ca3af", fontSize: 11, fontWeight: 400 };
const inp = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(99,102,241,0.3)",
  background: "rgba(15,23,42,0.8)",
  color: "#fff",
  fontSize: 13,
  boxSizing: "border-box"
};
