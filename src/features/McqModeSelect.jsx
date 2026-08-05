import { useState, useMemo } from "react";

const MODE_DATA = {
  practice: {
    icon: "\u{1F3AF}",
    title: "Practice Mode",
    desc: "Instant feedback, AI explanations, retry wrong answers, and navigate back anytime.",
    pills: ["Instant scoring", "AI explanations", "Retry wrong answers", "Previous button"],
    cta: "Start Practice Mode \u2192",
    hint: "Best for first pass through a topic \u2014 see explanations as you go.",
    accent: "#3ECF8E",
    accentBg: "rgba(62,207,142,0.05)",
    accentBorder: "rgba(62,207,142,0.22)",
    glow: "rgba(62,207,142,0.18)",
    iconBg: "rgba(62,207,142,0.12)",
    iconBorder: "rgba(62,207,142,0.3)",
    pillBg: "rgba(62,207,142,0.06)",
    pillBorder: "rgba(62,207,142,0.3)",
  },
  exam: {
    icon: "\u{1F393}",
    title: "Exam Mode",
    desc: "Timed simulation with no instant feedback. Flag questions, pause, and review at the end.",
    pills: ["Countdown timer", "Flag for review", "Question navigator", "Post-exam review"],
    cta: "Start Exam Mode \u2192",
    hint: "Best once you\u2019re confident \u2014 simulates real test conditions.",
    accent: "#FF6B5E",
    accentBg: "rgba(255,107,94,0.05)",
    accentBorder: "rgba(255,107,94,0.22)",
    glow: "rgba(255,107,94,0.16)",
    iconBg: "rgba(255,107,94,0.12)",
    iconBorder: "rgba(255,107,94,0.3)",
    pillBg: "rgba(255,107,94,0.06)",
    pillBorder: "rgba(255,107,94,0.3)",
  },
};

export default function McqModeSelect({ resource, onBack, onSelect, onQuizComplete }) {
  const [mode, setMode] = useState("practice");
  const [fadeKey, setFadeKey] = useState(0);

  const questionCount = useMemo(() => {
    if (!resource?.mcqData) return 0;
    if (Array.isArray(resource.mcqData)) return resource.mcqData.length;
    if (typeof resource.mcqData === "string") {
      try { return JSON.parse(resource.mcqData).length; } catch { return 0; }
    }
    return 0;
  }, [resource]);

  const practiceTime = Math.max(5, Math.round(questionCount * 0.5));
  const examTime = Math.max(10, Math.round(questionCount * 1.5));

  const d = MODE_DATA[mode];

  const handleSetMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setFadeKey((k) => k + 1);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 20% 0%, rgba(76,141,255,0.08), transparent 45%), radial-gradient(circle at 85% 15%, rgba(232,184,75,0.05), transparent 40%), #0A0D13",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px 60px",
      fontFamily: "Manrope, sans-serif",
      color: "#F2F4F8",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "9px 16px",
            fontSize: 14,
            fontWeight: 600,
            color: "#9AA3B2",
            cursor: "pointer",
            marginBottom: 28,
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        >
          {"\u2190 Back"}
        </button>

        {/* Header */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.14em",
          fontWeight: 500,
          color: "#5C6472",
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: 10,
        }}>
          MCQ Resource
        </div>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 26,
          lineHeight: 1.15,
          textAlign: "center",
          letterSpacing: "-0.01em",
          marginBottom: 8,
          margin: 0,
        }}>
          {resource?.title || "Untitled Quiz"}
        </h1>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "#9AA3B2",
          fontSize: 13.5,
          marginBottom: 30,
        }}>
          <span>{questionCount} questions</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#5C6472" }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: "#E8B84B",
            fontSize: 12.5,
          }}>
            ~{mode === "practice" ? practiceTime : examTime} min
          </span>
        </div>

        {/* Segmented toggle */}
        <div style={{
          display: "flex",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 4,
          marginBottom: 20,
          position: "relative",
        }}>
          {/* Sliding thumb */}
          <div style={{
            position: "absolute",
            top: 4,
            bottom: 4,
            left: 4,
            width: "calc(50% - 4px)",
            borderRadius: 10,
            background: d.accent,
            transform: mode === "exam" ? "translateX(100%)" : "translateX(0)",
            transition: "transform 0.32s cubic-bezier(0.65,0,0.35,1), background 0.32s ease",
            zIndex: 1,
          }} />
          <button
            onClick={() => handleSetMode("practice")}
            style={{
              flex: 1,
              position: "relative",
              zIndex: 2,
              background: "none",
              border: "none",
              padding: "12px 0",
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: 14.5,
              color: mode === "practice" ? "#0A0D13" : "#9AA3B2",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              borderRadius: 10,
              transition: "color 0.25s ease",
            }}
          >
            {"\u{1F3AF}"} Practice
          </button>
          <button
            onClick={() => handleSetMode("exam")}
            style={{
              flex: 1,
              position: "relative",
              zIndex: 2,
              background: "none",
              border: "none",
              padding: "12px 0",
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: 14.5,
              color: mode === "exam" ? "#0A0D13" : "#9AA3B2",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              borderRadius: 10,
              transition: "color 0.25s ease",
            }}
          >
            {"\u{1F393}"} Exam
          </button>
        </div>

        {/* Mode card */}
        <div
          key={fadeKey}
          style={{
            position: "relative",
            borderRadius: 22,
            border: `1px solid ${d.accentBorder}`,
            padding: "30px 26px 26px",
            overflow: "hidden",
            background: d.accentBg,
            transition: "background 0.35s ease, border-color 0.35s ease",
            animation: "mcqFadeIn 0.3s ease",
          }}
        >
          {/* Glow overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 15% -10%, ${d.glow}, transparent 55%)`,
            pointerEvents: "none",
          }} />

          {/* Card top */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16, position: "relative", zIndex: 2 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0,
              background: d.iconBg,
              border: `1px solid ${d.iconBorder}`,
            }}>
              {d.icon}
            </div>
            <div>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: 19,
                marginBottom: 4,
              }}>
                {d.title}
              </div>
              <div style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "#9AA3B2",
              }}>
                {d.desc}
              </div>
            </div>
          </div>

          {/* Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22, position: "relative", zIndex: 2 }}>
            {d.pills.map((p) => (
              <span
                key={p}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "7px 13px",
                  borderRadius: 20,
                  border: `1px solid ${d.pillBorder}`,
                  color: d.accent,
                  background: d.pillBg,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {p}
              </span>
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={() => onSelect(mode)}
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 14,
              border: `1.5px solid ${d.accent}`,
              background: "transparent",
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              color: d.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              position: "relative",
              zIndex: 2,
              transition: "transform 0.15s ease, background 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${d.accent}1A`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {d.cta}
          </button>
        </div>

        {/* Hint */}
        <div style={{
          textAlign: "center",
          fontSize: 12,
          color: "#5C6472",
          marginTop: 16,
          lineHeight: 1.5,
        }}>
          {d.hint}
        </div>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes mcqFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 768px) {
          .mcq-mode-select-container { max-width: 480px; }
        }
        @media (min-width: 1024px) {
          .mcq-mode-select-container { max-width: 520px; }
        }
      `}</style>
    </div>
  );
}
