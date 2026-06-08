import React, { useState, useEffect, useRef } from "react";
import { Microscope, Zap, FlaskConical, Calculator } from "lucide-react";

// ─── Static data ─────────────────────────────────────────────────────────────
const MESSAGES = [
  "Pick a topic — I'll build your full learning roadmap →",
  "I'll explain every section, quiz you, then make flashcards →",
  "Got an exam? Enter the topic for a structured study plan →",
  "Paste your notes and I'll organise them into a roadmap →",
];

const SUBJECTS = [
  { label: "Biology",   Icon: Microscope,    color: "#4caf50", bg: "#0a1f10", border: "#1a4a25" },
  { label: "Physics",   Icon: Zap,           color: "#ffb74d", bg: "#1f1000", border: "#4a2a00" },
  { label: "Chemistry", Icon: FlaskConical,  color: "#81d4fa", bg: "#031623", border: "#0a3a55" },
  { label: "Maths",     Icon: Calculator,    color: "#b39ddb", bg: "#120d2a", border: "#2d1f5e" },
];

// ─── Styles ────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@400;500;600&display=swap');

  @keyframes aitBlink {
    0%, 90%, 100% { transform: scaleY(1); }
    93%, 97%      { transform: scaleY(0.05); }
  }
  @keyframes aitPulse {
    0%, 100% { box-shadow: 0 0 0 0 #22c55e66; }
    50%      { box-shadow: 0 0 0 4px #22c55e00; }
  }
  @keyframes aitFadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes aitFadeDown {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-8px); }
  }
  .ait-eye {
    transform-origin: center;
    animation: aitBlink 3.5s ease-in-out infinite;
  }
  .ait-eye-r {
    animation-delay: 0.08s;
  }
  .ait-msg-in  { animation: aitFadeUp   0.32s ease forwards; }
  .ait-msg-out { animation: aitFadeDown 0.28s ease forwards; }
  .ait-chip:hover { filter: brightness(1.15); transform: translateY(-1px); }
  .ait-btn:hover  { filter: brightness(1.12); transform: translateY(-1px); }
`;

// ─── AI Avatar SVG ────────────────────────────────────────────────────────
function AIAvatar() {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {/* Circle */}
      <div style={{
        width: 58, height: 58, borderRadius: "50%",
        background: "#0f1240",
        border: "1.5px solid #3949ab",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <svg viewBox="0 0 40 44" width="36" height="40" xmlns="http://www.w3.org/2000/svg">
          {/* Antenna line */}
          <line x1="20" y1="3" x2="20" y2="10" stroke="#5c6bc0" strokeWidth="1.6" strokeLinecap="round" />
          {/* Antenna dot */}
          <circle cx="20" cy="2" r="2.2" fill="#7986cb" />

          {/* Face circle */}
          <circle cx="20" cy="26" r="14" fill="#1a1e5a" />

          {/* Left eye */}
          <ellipse className="ait-eye"      cx="14.5" cy="23" rx="2.6" ry="3.4" fill="#7986cb" />
          {/* Right eye */}
          <ellipse className="ait-eye ait-eye-r" cx="25.5" cy="23" rx="2.6" ry="3.4" fill="#7986cb" />

          {/* Smile */}
          <path d="M13.5 29.5 Q20 35.5 26.5 29.5" stroke="#7986cb" strokeWidth="1.8"
                fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Online dot */}
      <div style={{
        position: "absolute", bottom: 2, right: 2,
        width: 10, height: 10, borderRadius: "50%",
        background: "#22c55e",
        border: "1.5px solid #0d0f22",
        animation: "aitPulse 2s ease-in-out infinite",
      }} />
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────
/**
 * @param {{ userName: string, onOpen: (context?: string) => void, onOpenLearn: () => void, onOpenStudy: (topic?: string) => void }} props
 */
export default function AITutorWidget({ userName = "there", onOpen, onOpenLearn, onOpenStudy }) {
  const [msgIdx, setMsgIdx]       = useState(0);
  const [animClass, setAnimClass] = useState("ait-msg-in");
  const [displayMsg, setDisplayMsg] = useState(MESSAGES[0]);
  const timerRef = useRef(null);

  // Rotate messages every 4 s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setAnimClass("ait-msg-out");
      setTimeout(() => {
        setMsgIdx(i => {
          const next = (i + 1) % MESSAGES.length;
          setDisplayMsg(MESSAGES[next]);
          return next;
        });
        setAnimClass("ait-msg-in");
      }, 300);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  function handleSubject(subject) {
    clearInterval(timerRef.current);
    setAnimClass("ait-msg-out");
    setTimeout(() => {
      setDisplayMsg(`Building ${subject} roadmap…`);
      setAnimClass("ait-msg-in");
    }, 300);
    onOpenStudy?.(subject);
  }

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Main card ── */}
      <div style={{
        position: "relative",
        background: "#0d0f22",
        border: "0.5px solid #1e2140",
        borderRadius: 18,
        padding: 14,
        overflow: "hidden",
      }}>
        {/* Background accent circle */}
        <div style={{
          position: "absolute",
          top: -40, right: -40,
          width: 170, height: 170,
          borderRadius: "50%",
          background: "#1a237e",
          opacity: 0.12,
          pointerEvents: "none",
        }} />

        {/* Two-column row */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, position: "relative" }}>

          {/* LEFT: avatar */}
          <AIAvatar />

          {/* RIGHT: label + message + button */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Label */}
            <div style={{
              fontSize: 10, fontWeight: 600,
              color: "#3949ab", letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "Syne, sans-serif",
              marginBottom: 5,
            }}>
              Guided Study · AI Powered
            </div>

            {/* Rotating message */}
            <div style={{ minHeight: 38, overflow: "hidden", marginBottom: 10 }}>
              <p
                key={displayMsg}
                className={animClass}
                style={{
                  margin: 0,
                  fontSize: 13, fontWeight: 600,
                  color: "#c5c9e8",
                  lineHeight: 1.5,
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                {displayMsg}
              </p>
            </div>

            {/* Buttons row */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <button
                className="ait-btn"
                onClick={() => onOpenStudy?.()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 20,
                  background: "linear-gradient(135deg, #3949ab, #5c6bc0)",
                  border: "0.5px solid #5c6bc0",
                  fontSize: 12, fontWeight: 600,
                  color: "#e8eaf6", cursor: "pointer",
                  fontFamily: "Manrope, sans-serif",
                  transition: "filter 0.15s, transform 0.15s",
                }}
              >
                📋 Start Guided Study
              </button>

              <button
                className="ait-btn"
                onClick={() => onOpenLearn?.()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 20,
                  background: "#0a1020",
                  border: "0.5px solid #ef5350",
                  fontSize: 12, fontWeight: 600,
                  color: "#ef9a9a", cursor: "pointer",
                  fontFamily: "Manrope, sans-serif",
                  transition: "filter 0.15s, transform 0.15s",
                }}
              >
                ▶ Video Lesson
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Subject chips ── */}
      <div style={{
        display: "flex", gap: 8, marginTop: 10,
        flexWrap: "wrap",
      }}>
        {SUBJECTS.map(({ label, Icon, color, bg, border }) => (
          <button
            key={label}
            className="ait-chip"
            onClick={() => handleSubject(label)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 13px", borderRadius: 20,
              background: bg, border: `0.5px solid ${border}`,
              fontSize: 12, fontWeight: 600, color,
              cursor: "pointer", fontFamily: "Manrope, sans-serif",
              transition: "filter 0.15s, transform 0.15s",
            }}
          >
            <Icon size={13} strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
