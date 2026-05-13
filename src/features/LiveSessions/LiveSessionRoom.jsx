import React, { useEffect, useRef, useState } from "react";
import { liveSessionsApi } from "./api.js";

/**
 * Embeds Jitsi Meet via the external API.
 * Loads https://meet.jit.si/external_api.js once per page load.
 */
function loadJitsiScript() {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve(window.JitsiMeetExternalAPI);
    const existing = document.getElementById("jitsi-external-api");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.JitsiMeetExternalAPI));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "jitsi-external-api";
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => resolve(window.JitsiMeetExternalAPI);
    script.onerror = () => reject(new Error("Failed to load Jitsi script"));
    document.body.appendChild(script);
  });
}

export function LiveSessionRoom({ session, currentUser, isHost, token, onLeave }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let api = null;

    async function setup() {
      try {
        // Record join in our backend
        await liveSessionsApi.recordJoin(session.id, token).catch(() => {});

        const Jitsi = await loadJitsiScript();
        if (cancelled) return;

        const displayName = currentUser?.username || "Student";
        const email = currentUser?.email || undefined;

        api = new Jitsi("meet.jit.si", {
          roomName: session.roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName, email },
          configOverwrite: {
            startWithVideoMuted: !isHost,
            startWithAudioMuted: !isHost,
            disableDeepLinking: true,
            prejoinPageEnabled: false
          },
          interfaceConfigOverwrite: {
            DEFAULT_BACKGROUND: "#0f172a",
            DISABLE_VIDEO_BACKGROUND: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            TOOLBAR_BUTTONS: [
              "microphone", "camera", "desktop", "fullscreen",
              "fodeviceselection", "hangup", "chat", "raisehand",
              "videoquality", "filmstrip", "tileview",
              ...(isHost ? ["recording", "livestreaming", "settings"] : [])
            ]
          }
        });
        apiRef.current = api;

        api.addListener("readyToClose", () => {
          handleLeave();
        });
        api.addListener("videoConferenceLeft", () => {
          handleLeave();
        });

        setLoading(false);
      } catch (e) {
        console.error("Jitsi setup failed:", e);
        setError(e.message);
        setLoading(false);
      }
    }

    setup();

    return () => {
      cancelled = true;
      try {
        if (apiRef.current) {
          apiRef.current.dispose();
          apiRef.current = null;
        }
      } catch {}
      // Record leave on unmount
      liveSessionsApi.recordLeave(session.id, token).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  function handleLeave() {
    try { apiRef.current?.dispose(); } catch {}
    apiRef.current = null;
    liveSessionsApi.recordLeave(session.id, token).catch(() => {});
    onLeave?.();
  }

  async function handleEndSession() {
    if (!confirm("End this live session for everyone?")) return;
    try {
      await liveSessionsApi.end(session.id, token);
      handleLeave();
    } catch (e) {
      alert("Failed to end session: " + e.message);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#0f172a", display: "flex", flexDirection: "column"
    }}>
      <div style={{
        padding: "10px 16px",
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
        borderBottom: "1px solid rgba(99,102,241,0.3)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 8
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#ef4444", animation: "pulse 1.5s infinite"
            }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{session.title}</span>
            <span style={{ color: "#a5b4fc", fontSize: 12 }}>LIVE</span>
          </div>
          {session.classroom?.name && (
            <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>
              {session.classroom.name}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isHost && (
            <button onClick={handleEndSession} style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "#ef4444", color: "#fff",
              fontWeight: 600, cursor: "pointer"
            }}>
              ⏹ End Session for All
            </button>
          )}
          <button onClick={handleLeave} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)",
            background: "rgba(30,41,59,0.6)", color: "#fff", cursor: "pointer"
          }}>
            ← Leave
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#a5b4fc" }}>
          Connecting to live session…
        </div>
      )}

      {error && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", padding: 40, textAlign: "center" }}>
          ⚠️ Failed to connect: {error}<br />
          Please check your internet connection and refresh.
        </div>
      )}

      <div ref={containerRef} style={{
        flex: 1, width: "100%", display: error ? "none" : "block"
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
