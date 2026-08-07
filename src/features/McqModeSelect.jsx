import { useState, useMemo } from "react";
import { getWeakSpots } from "../lib/studyHistory.js";

const MODE_DATA = {
  practice: {
    icon: "\u{1F3AF}",
    title: "Weak Spot Cascade",
    desc: "Level-based progression with dynamic question queues. Missed questions cascade to the next level and re-ask at the end of each level.",
    pills: ["Dynamic levels", "Weak-spot cascade", "Visual level map", "AI explanations"],
    cta: "Start Cascade \u2192",
    hint: "Master every question \u2014 missed ones follow you until you nail them twice.",
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
  arcade: {
    icon: "\u26A1",
    title: "Arcade Mode",
    desc: "Fast-paced lane-runner game. Dodge wrong answers, grab power-ups, and chase high scores.",
    pills: ["Real-time gameplay", "Power-ups & streaks", "Spaced repetition", "Missed question review"],
    cta: "Start Arcade Mode \u2192",
    hint: "Gamified review \u2014 great for quick, engaging study sessions.",
    accent: "#E8B84B",
    accentBg: "rgba(232,184,75,0.05)",
    accentBorder: "rgba(232,184,75,0.22)",
    glow: "rgba(232,184,75,0.16)",
    iconBg: "rgba(232,184,75,0.12)",
    iconBorder: "rgba(232,184,75,0.3)",
    pillBg: "rgba(232,184,75,0.06)",
    pillBorder: "rgba(232,184,75,0.3)",
  },
};

export default function McqModeSelect({ resource, onBack, onSelect, onQuizComplete }) {
  const [mode, setMode] = useState("practice");
  const [fadeKey, setFadeKey] = useState(0);
  const [sessionType, setSessionType] = useState("all");

  const questionCount = useMemo(() => {
    if (!resource?.mcqData) return 0;
    if (Array.isArray(resource.mcqData)) return resource.mcqData.length;
    if (typeof resource.mcqData === "string") {
      try { return JSON.parse(resource.mcqData).length; } catch { return 0; }
    }
    return 0;
  }, [resource]);

  const weakSpots = useMemo(() => {
    if (!resource?.id) return [];
    return getWeakSpots(resource.id);
  }, [resource]);

  const weakCount = weakSpots.length;
  const showSessionOptions = false;

  const modeIndex = mode === "practice" ? 0 : mode === "exam" ? 1 : 2;

  const sessionQuestionCount = useMemo(() => questionCount, [questionCount]);

  const practiceTime = Math.max(5, Math.round(sessionQuestionCount * 0.5));
  const examTime = Math.max(10, Math.round(questionCount * 1.5));

  const d = MODE_DATA[mode];

  const handleSetMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setFadeKey((k) => k + 1);
  };

  const handleStart = () => {
    if (mode === "arcade") {
      onSelect("arcade", { sessionType: "all", questionCount });
    } else {
      onSelect(mode, { sessionType: "all", questionCount });
    }
  };

  const modeTabs = [
    { key: "practice", label: "Cascade", icon: "\u{1F3AF}" },
    { key: "exam", label: "Exam", icon: "\u{1F393}" },
    { key: "arcade", label: "Arcade", icon: "\u26A1" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 20% 0%, rgba(76,141,255,0.08), transparent 45%), radial-gradient(circle at 85% 15%, rgba(232,184,75,0.05), transparent 40%), #0A0D13",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px 60px",
      fontFamily: "Manrope, sans-serif",
      color: "#F2F4F8",
    }}>
      <div style={{ width: "100%", maxWidth: 480, margin: "auto 0" }}>
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
            ~{mode === "practice" ? practiceTime : mode === "arcade" ? Math.max(3, Math.round(questionCount * 0.3)) : examTime} min
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
            width: "calc(33.333% - 2.67px)",
            borderRadius: 10,
            background: d.accent,
            transform: `translateX(${modeIndex * 100}%)`,
            transition: "transform 0.32s cubic-bezier(0.65,0,0.35,1), background 0.32s ease",
            zIndex: 1,
          }} />
          {modeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleSetMode(tab.key)}
              style={{
                flex: 1,
                position: "relative",
                zIndex: 2,
                background: "none",
                border: "none",
                padding: "12px 0",
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 700,
                fontSize: 13.5,
                color: mode === tab.key ? "#0A0D13" : "#9AA3B2",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 10,
                transition: "color 0.25s ease",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: showSessionOptions ? 16 : 22, position: "relative", zIndex: 2 }}>
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

          {/* Session options (practice mode only, 20+ questions) */}
          {showSessionOptions && (
            <div style={{ marginBottom: 22, position: "relative", zIndex: 2 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#5C6472",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}>
                Session Size
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SessionOption
                  label="All questions"
                  count={questionCount}
                  selected={sessionType === "all"}
                  accent={d.accent}
                  onClick={() => setSessionType("all")}
                />
                {weakCount > 0 && (
                  <SessionOption
                    label="Weak spots only"
                    count={weakCount}
                    selected={sessionType === "weak"}
                    accent="#FF6B5E"
                    badge="missed"
                    onClick={() => setSessionType("weak")}
                  />
                )}
                {questionCount > 10 && (
                  <SessionOption
                    label="Quick 10"
                    count={Math.min(10, questionCount)}
                    selected={sessionType === "quick10"}
                    accent={d.accent}
                    onClick={() => setSessionType("quick10")}
                  />
                )}
                {questionCount > 20 && (
                  <SessionOption
                    label="Quick 20"
                    count={Math.min(20, questionCount)}
                    selected={sessionType === "quick20"}
                    accent={d.accent}
                    onClick={() => setSessionType("quick20")}
                  />
                )}
                {questionCount > 30 && (
                  <SessionOption
                    label="Quick 30"
                    count={Math.min(30, questionCount)}
                    selected={sessionType === "quick30"}
                    accent={d.accent}
                    onClick={() => setSessionType("quick30")}
                  />
                )}
                <SessionOption
                  label="🔥 Streak Survival"
                  count={questionCount}
                  selected={sessionType === "survival"}
                  accent="#FF5E7E"
                  badge="endless"
                  onClick={() => setSessionType("survival")}
                />
              </div>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={handleStart}
            style={{
              width: "100%",
              boxSizing: "border-box",
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
      `}</style>
    </div>
  );
}

function SessionOption({ label, count, selected, accent, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${selected ? accent : "rgba(255,255,255,0.08)"}`,
        background: selected ? `${accent}15` : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      <span style={{
        fontSize: 13.5,
        fontWeight: 600,
        color: selected ? accent : "#9AA3B2",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        {label}
        {badge && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 999,
            background: "rgba(255,107,94,0.15)",
            color: "#FF6B5E",
            border: "0.5px solid rgba(255,107,94,0.3)",
          }}>
            {badge}
          </span>
        )}
      </span>
      <span style={{
        fontSize: 12.5,
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        color: selected ? accent : "#5C6472",
      }}>
        {count}
      </span>
    </button>
  );
}
