import { useEffect, useRef } from "react";
import { COLORS, FONTS, hexToRgba } from "./voiceConfig.js";

export default function TranscriptOverlay({ transcript }) {
  const containerRef = useRef(null);

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!transcript || transcript.length === 0) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: 100, // Above the action bar
      left: 0,
      right: 0,
      maxHeight: "35vh", // Take up bottom 1/3 of screen
      padding: "20px 40px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      pointerEvents: "none", // Let clicks pass through to background
      zIndex: 50,
      maskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 100%)",
      WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 100%)",
    }}>
      <div 
        ref={containerRef}
        style={{
          width: "100%",
          maxWidth: 600,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
          paddingRight: 10,
          pointerEvents: "auto", // Allow scrolling within the text area
          scrollbarWidth: "none", // Hide scrollbar Firefox
          msOverflowStyle: "none", // Hide scrollbar IE
        }}
      >
        <style>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>
        
        {transcript.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: isUser ? hexToRgba(COLORS.electric, 0.2) : hexToRgba(COLORS.surfaceLight, 0.6),
                border: `1px solid ${isUser ? hexToRgba(COLORS.electric, 0.3) : hexToRgba(COLORS.border, 0.5)}`,
                backdropFilter: "blur(12px)",
                padding: "12px 18px",
                borderRadius: 20,
                borderBottomRightRadius: isUser ? 4 : 20,
                borderBottomLeftRadius: isUser ? 20 : 4,
                color: isUser ? "#fff" : COLORS.text,
                fontSize: 14,
                fontFamily: FONTS.body,
                lineHeight: 1.5,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                animation: "scFadeUp 0.3s ease-out forwards",
                transformOrigin: isUser ? "bottom right" : "bottom left",
              }}
            >
              {msg.text}
            </div>
          );
        })}
      </div>
      
      <style>{`
        @keyframes scFadeUp {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
