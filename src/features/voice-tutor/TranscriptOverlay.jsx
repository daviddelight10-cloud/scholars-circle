import { useEffect, useRef } from "react";
import { COLORS, FONTS, hexToRgba } from "./voiceConfig.js";

export default function TranscriptOverlay({ transcript }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!transcript || transcript.length === 0) return null;

  return (
    <div className="sc-vt-transcript">
      <div ref={containerRef} className="sc-vt-transcript-list">
        {transcript.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              className="sc-vt-transcript-bubble"
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: isUser
                  ? "linear-gradient(160deg, rgba(79,142,247,0.18), rgba(79,142,247,0.08))"
                  : "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                border: isUser
                  ? "1px solid rgba(79,142,247,0.25)"
                  : "1px solid rgba(255,255,255,0.08)",
                padding: "12px 18px",
                borderRadius: 20,
                borderBottomRightRadius: isUser ? 4 : 20,
                borderBottomLeftRadius: isUser ? 20 : 4,
                color: isUser ? "#fff" : COLORS.text,
                fontSize: 14,
                fontFamily: FONTS.body,
                lineHeight: 1.5,
                boxShadow: "0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
                transformOrigin: isUser ? "bottom right" : "bottom left",
              }}
            >
              {msg.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
