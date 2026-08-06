import { useState, useMemo, useEffect } from "react";

const MODE_DATA = {
  study: {
    icon: "📚",
    title: "Study Mode",
    desc: "Flip through cards one by one with spaced repetition grading.",
    pills: ["Flip cards", "Spaced repetition", "Self-grade", "FSRS tracking"],
    cta: "Start Studying →",
    accent: "#3ECF8E",
    accentBg: "rgba(62,207,142,0.05)",
    accentBorder: "rgba(62,207,142,0.22)",
    glow: "rgba(62,207,142,0.18)",
    iconBg: "rgba(62,207,142,0.12)",
    iconBorder: "rgba(62,207,142,0.3)",
    pillBg: "rgba(62,207,142,0.06)",
    pillBorder: "rgba(62,207,142,0.3)",
  },
  matching: {
    icon: "🃏",
    title: "Matching Pairs",
    desc: "Memory game — match terms to definitions. Progress through levels and master the deck.",
    pills: ["Memory game", "Level progression", "Streaks & confetti", "Resume anytime"],
    cta: "Start Matching →",
    accent: "#00E5FF",
    accentBg: "rgba(0,229,255,0.05)",
    accentBorder: "rgba(0,229,255,0.22)",
    glow: "rgba(0,229,255,0.18)",
    iconBg: "rgba(0,229,255,0.12)",
    iconBorder: "rgba(0,229,255,0.3)",
    pillBg: "rgba(0,229,255,0.06)",
    pillBorder: "rgba(0,229,255,0.3)",
  },
};

export default function FlashcardModeSelect({ resource, onBack, onSelect }) {
  const [mode, setMode] = useState("study");
  const [fadeKey, setFadeKey] = useState(0);
  const [savedProgress, setSavedProgress] = useState(null);

  const cardCount = useMemo(() => {
    if (!resource?.flashcardData) return 0;
    try {
      const parsed = typeof resource.flashcardData === "string" ? JSON.parse(resource.flashcardData) : resource.flashcardData;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch { return 0; }
  }, [resource]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sc_match_progress_${resource?.id || "default"}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.completedLevels?.length > 0) setSavedProgress(parsed);
      }
    } catch {}
  }, [resource]);

  const handleSetMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setFadeKey(k => k + 1);
  };

  const handleStart = () => {
    onSelect(mode);
  };

  const modeTabs = [
    { key: "study", label: "Study", icon: "📚" },
    { key: "matching", label: "Matching", icon: "🃏" },
  ];

  const modeIndex = mode === "study" ? 0 : 1;
  const d = MODE_DATA[mode];
  const totalLevels = Math.ceil(cardCount / 6);

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
            background: "none",
            border: "none",
            color: "#9AA3B2",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            padding: "8px 0",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "Manrope, sans-serif",
          }}
        >
          ← Back
        </button>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            {resource?.title || "Flashcard Deck"}
          </div>
          <div style={{ fontSize: 13, color: "#9AA3B2" }}>
            {cardCount} card{cardCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{
          display: "flex",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 4,
          marginBottom: 20,
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            top: 4, bottom: 4, left: 4,
            width: "calc(50% - 2px)",
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
          <div style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 15% -10%, ${d.glow}, transparent 55%)`,
            pointerEvents: "none",
          }} />

          {/* Card top */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16, position: "relative", zIndex: 2 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, flexShrink: 0,
              background: d.iconBg, border: `1px solid ${d.iconBorder}`,
            }}>
              {d.icon}
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 19, marginBottom: 4 }}>
                {d.title}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#9AA3B2" }}>
                {d.desc}
              </div>
            </div>
          </div>

          {/* Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, position: "relative", zIndex: 2 }}>
            {d.pills.map((p) => (
              <span key={p} style={{
                fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 20,
                border: `1px solid ${d.pillBorder}`, color: d.accent, background: d.pillBg,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {p}
              </span>
            ))}
          </div>

          {/* Saved progress (matching mode only) */}
          {mode === "matching" && savedProgress && (
            <div style={{
              marginBottom: 16, padding: 12, borderRadius: 12,
              background: "rgba(255,182,39,0.08)", border: "1px solid rgba(255,182,39,0.25)",
              position: "relative", zIndex: 2,
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#FFB627", marginBottom: 4 }}>
                SAVED PROGRESS
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Level {savedProgress.currentLevel + 1} of {totalLevels} — {savedProgress.completedLevels.length} completed
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
            {mode === "matching" && savedProgress ? "Continue →" : d.cta}
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
          {mode === "study" ? "Best for learning — flip and grade yourself." : "Fun memory game — match terms to definitions across levels."}
        </div>
      </div>

      <style>{`
        @keyframes mcqFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
