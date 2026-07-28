import React, { useEffect, useState } from "react";
import { liveSessionsApi } from "./api.js";
import { LiveSessionRoom } from "./LiveSessionRoom.jsx";

/**
 * Polls /live-sessions/live every 30s and shows a sticky red banner
 * whenever any of the user's classrooms have a live session.
 */
export function LiveBanner({ token, currentUser }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function poll() {
      try {
        const data = await liveSessionsApi.getLive(token);
        if (!cancelled) setSessions(data || []);
      } catch {}
    }
    poll();
    const t = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [token]);

  const visible = sessions.filter((s) => !dismissed.has(s.id));
  if (activeSession) {
    return (
      <LiveSessionRoom
        session={activeSession}
        currentUser={currentUser}
        isHost={activeSession.hostId === (currentUser?.id || currentUser?.sub)}
        token={token}
        onLeave={() => setActiveSession(null)}
      />
    );
  }
  if (visible.length === 0) return null;

  const session = visible[0]; // show one at a time

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1500,
      background: "linear-gradient(135deg, #dc2626, #ef4444)",
      color: "#fff",
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      fontWeight: 600,
      fontSize: 14,
      flexWrap: "wrap"
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%",
        background: "#fff", animation: "scLivePulse 1.5s infinite"
      }} />
      <span>
        🔴 <b>{session.classroom?.name || "A class"}</b> is live now: "{session.title}"
      </span>
      <button
        onClick={() => setActiveSession(session)}
        style={{
          padding: "6px 14px", borderRadius: 6, border: "none",
          background: "#fff", color: "#dc2626",
          fontWeight: 700, cursor: "pointer", fontSize: 13
        }}
      >
        🎥 Join Now
      </button>
      <button
        onClick={() => setDismissed((prev) => new Set(prev).add(session.id))}
        title="Dismiss"
        style={{
          padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)",
          background: "transparent", color: "#fff", cursor: "pointer"
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes scLivePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
