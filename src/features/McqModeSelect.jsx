import { useState } from "react";

const PRACTICE_ICON = "\u{1F3AF}";
const EXAM_ICON = "\u{1F393}";

export default function McqModeSelect({ resource, onBack, onSelect, onQuizComplete }) {
  const [hovered, setHovered] = useState(null);

  const modes = [
    {
      id: "practice",
      icon: PRACTICE_ICON,
      title: "Practice Mode",
      desc: "Instant feedback, AI explanations, retry wrong answers, navigate back to previous questions.",
      features: ["Instant scoring", "AI explanations", "Retry wrong answers", "Previous button"],
      gradient: "linear-gradient(135deg, #1a2a1a, #0d1f0d)",
      border: "1px solid #2a5a2a",
      accent: "#4ade80",
    },
    {
      id: "exam",
      icon: EXAM_ICON,
      title: "Exam Mode",
      desc: "Timed simulation with no instant feedback. Flag questions, pause, and review at the end.",
      features: ["Countdown timer", "Flag for review", "Question navigator", "Post-exam review"],
      gradient: "linear-gradient(135deg, #2a1a1a, #1f0d0d)",
      border: "1px solid #5a2a2a",
      accent: "#f87171",
    },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0c1e",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "Manrope, sans-serif",
    }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "none",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10,
          padding: "8px 16px",
          color: "#7b82b8",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {"\u2190 Back"}
      </button>

      {/* Resource title */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: "#4a5080", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          MCQ Resource
        </div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#c5c9e8", fontFamily: "Syne, sans-serif", margin: 0 }}>
          {resource?.title || "Untitled Quiz"}
        </h1>
        {resource?.mcqData && (
          <div style={{ fontSize: 13, color: "#4a5080", marginTop: 6 }}>
            {Array.isArray(resource.mcqData) ? resource.mcqData.length : 0} questions
          </div>
        )}
      </div>

      {/* Mode cards */}
      <div style={{
        display: "flex",
        gap: 20,
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: 720,
        width: "100%",
      }}>
        {modes.map((mode) => (
          <div
            key={mode.id}
            onMouseEnter={() => setHovered(mode.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(mode.id)}
            style={{
              flex: "1 1 300px",
              maxWidth: 340,
              background: mode.gradient,
              border: hovered === mode.id ? `2px solid ${mode.accent}` : mode.border,
              borderRadius: 18,
              padding: "28px 24px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              transform: hovered === mode.id ? "translateY(-4px)" : "translateY(0)",
              boxShadow: hovered === mode.id ? `0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px ${mode.accent}40` : "0 4px 12px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 36 }}>{mode.icon}</div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#e5e7f0", fontFamily: "Syne, sans-serif", margin: "0 0 6px" }}>
                {mode.title}
              </h3>
              <p style={{ fontSize: 12.5, color: "#7b82b8", lineHeight: 1.6, margin: 0 }}>
                {mode.desc}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {mode.features.map((f) => (
                <span
                  key={f}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: mode.accent,
                    background: `${mode.accent}15`,
                    border: `1px solid ${mode.accent}30`,
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
            <div style={{
              marginTop: "auto",
              padding: "10px 16px",
              background: hovered === mode.id ? mode.accent : "transparent",
              border: `1px solid ${mode.accent}`,
              borderRadius: 10,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 700,
              color: hovered === mode.id ? "#0a0c1e" : mode.accent,
              transition: "all 0.2s ease",
            }}>
              Start {mode.title} {"\u2192"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
