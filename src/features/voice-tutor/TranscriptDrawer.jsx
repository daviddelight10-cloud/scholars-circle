import { useEffect, useRef } from "react";
import { COLORS, FONTS } from "./voiceConfig.js";

export default function TranscriptDrawer({ open, onClose, transcript = [] }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, open]);

  if (!open) return null;

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 9998,
          opacity: 0,
          animation: "scVtFadeIn 0.2s forwards",
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 0, right: 0, bottom: 0,
          height: "min(420px, 60vh)",
          background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          zIndex: 9999,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "scVtSlideUp 0.25s ease-out",
        }}
      >
        <style>{`
          @keyframes scVtSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes scVtFadeIn { to { opacity: 1; } }
        `}</style>

        <div style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h3 style={{
            margin: 0, fontSize: 16, fontWeight: 700,
            color: COLORS.text, fontFamily: FONTS.display,
          }}>Transcript</h3>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: COLORS.textDim,
              fontSize: 20, cursor: "pointer", padding: "4px 8px",
            }}
          >✕</button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {transcript.length > 0 ? (
            transcript.map((entry, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 14,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: entry.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  fontSize: 9,
                  color: COLORS.textFaint,
                  fontFamily: FONTS.mono,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  {entry.role === "user" ? "You" : "Tutor"} · {formatTime(entry.ts)}
                </div>
                <div style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: entry.role === "user"
                    ? hexToRgba(COLORS.electric, 0.12)
                    : COLORS.inkLight,
                  border: entry.role === "user"
                    ? `1px solid ${hexToRgba(COLORS.electric, 0.25)}`
                    : `1px solid ${COLORS.border}`,
                  fontSize: 13,
                  color: COLORS.text,
                  fontFamily: FONTS.body,
                  lineHeight: 1.5,
                }}>
                  {entry.text}
                </div>
              </div>
            ))
          ) : (
            <div style={{
              textAlign: "center",
              padding: "40px 0",
              color: COLORS.textFaint,
              fontSize: 13,
              fontFamily: FONTS.body,
            }}>No transcript yet. Start speaking to see the conversation.</div>
          )}
        </div>
      </div>
    </>
  );
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
