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
        <h3 style={{ margin: 0, fontFamily: "Syne, sans-serif", fontSize: 16, color: "#f1f5f9" }}>📹 Live Sessions</h3>
        {isHost && (
          <button className="cr-btn" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "✕ Cancel" : "➕ Schedule Session"}
          </button>
        )}
      </div>

      {showCreate && isHost && (
        <form onSubmit={handleCreate} className="cr-glass" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label className="cr-field-label">Title *</label>
            <input className="cr-input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Lecture 5: Cell Biology" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="cr-field-label">Description <span style={{ color: "#6b7280", fontSize: 11 }}>(optional)</span></label>
            <textarea className="cr-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Topic agenda, prerequisites, etc." rows={2} style={{ resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <label className="cr-field-label">Scheduled for *</label>
              <input className="cr-input" required type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
            <div>
              <label className="cr-field-label">Duration (minutes)</label>
              <input className="cr-input" type="number" min="5" max="480" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} />
            </div>
          </div>
          <button className="cr-btn" type="submit" disabled={creating || !title.trim()} style={(!title.trim() || creating) ? { opacity: 0.5 } : {}}>
            {creating ? "Scheduling..." : "📅 Schedule"}
          </button>
        </form>
      )}

      {loading && <div className="cr-glass" style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Loading sessions…</div>}
      {error && <div className="cr-glass" style={{ padding: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", marginBottom: 12 }}>{error}</div>}

      {!loading && sessions.length === 0 && (
        <div className="cr-empty" style={{ padding: "32px 20px" }}>
          <div className="cr-empty-icon">📹</div>
          <div className="cr-empty-title">No sessions yet</div>
          <div className="cr-empty-desc">{isHost ? "Click 'Schedule Session' to host your first live class." : "Your lecturer will schedule one soon."}</div>
        </div>
      )}

      {/* Live now */}
      {live.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="cr-section-label" style={{ color: "#ef4444" }}>🔴 Live Now</div>
          {live.map((s) => (
            <SessionCard key={s.id} session={s} isHost={isHost} accent="#ef4444" actionLabel="🎥 Join Live" onAction={() => handleJoin(s)} onCancel={isHost ? () => handleCancel(s) : null} />
          ))}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="cr-section-label" style={{ color: "#FFD700" }}>📅 Upcoming</div>
          {upcoming.map((s) => (
            <SessionCard key={s.id} session={s} isHost={isHost} accent="#FFD700" actionLabel={isHost ? "▶️ Start Now" : "⏳ Waiting…"} actionDisabled={!isHost} onAction={isHost ? () => handleStart(s) : null} onCancel={isHost ? () => handleCancel(s) : null} />
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <div className="cr-section-label" style={{ color: "#64748b" }}>📼 Past</div>
          {past.slice(0, 10).map((s) => (
            <SessionCard key={s.id} session={s} isHost={isHost} accent="#64748b" actionLabel={null} onAction={null} onCancel={null} />
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
    <div className="cr-glass-flat" style={{ marginBottom: 8, borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", fontFamily: "Syne, sans-serif" }}>{session.title}</div>
          {session.description && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{session.description}</div>}
          <div style={{ fontSize: 11, color: "#FFD700", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 12 }}>
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
              className="cr-btn"
              onClick={onAction}
              disabled={actionDisabled}
              style={actionDisabled ? { opacity: 0.5, cursor: "default" } : { background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
            >
              {actionLabel}
            </button>
          )}
          {onCancel && session.status === "scheduled" && (
            <button
              className="cr-btn-outline"
              onClick={onCancel}
              title="Cancel"
              style={{ borderColor: "rgba(239,68,68,0.4)", color: "#f87171", padding: "6px 10px" }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

