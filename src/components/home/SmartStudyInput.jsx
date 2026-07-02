import React, { useState, useRef, useEffect } from "react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:     "#07080F",
  card:   "#0d0f1f",
  accent: "#1a1a1a",
  border: "#B8860B",
  line:   "#1e2140",
  text:   "#e8eaf6",
  muted:  "#7b82b8",
  hint:   "#4a5080",
  faint:  "#1a1d35",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@400;500;600&display=swap');

  @keyframes ssi-in  { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes ssi-pop { 0%{transform:scale(0.94);opacity:0} 100%{transform:scale(1);opacity:1} }
  @keyframes ssi-pulse { 0%,100%{box-shadow:0 0 0 0 #22c55e55} 50%{box-shadow:0 0 0 5px #22c55e00} }

  .ssi-animate { animation: ssi-in  0.28s ease forwards; }
  .ssi-pop     { animation: ssi-pop 0.22s ease forwards; }

  .ssi-action-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 20px;
    font-size: 12px; font-weight: 600; cursor: pointer;
    font-family: Manrope, sans-serif;
    transition: filter 0.15s, transform 0.15s;
    white-space: nowrap;
  }
  .ssi-action-btn:hover { filter: brightness(1.18); transform: translateY(-1px); }

  .ssi-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 11px; border-radius: 20px;
    font-size: 11px; font-weight: 600; cursor: pointer;
    font-family: Manrope, sans-serif;
    transition: filter 0.15s, transform 0.15s;
  }
  .ssi-chip:hover { filter: brightness(1.15); transform: translateY(-1px); }

  .ssi-upload-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 10px;
    font-size: 11px; font-weight: 600; cursor: pointer;
    font-family: Manrope, sans-serif; border: none;
    transition: background 0.15s;
  }
`;

const ACTIONS = [
  { mode: "auto-roadmap", icon: "📋", label: "Build Roadmap",  bg: D.accent,   border: D.border, color: "#FFD700" },
  { mode: "explain",      icon: "📖", label: "Explain this",   bg: "#0b1e3a",  border: "#1e4a7a", color: "#90caf9" },
  { mode: "flashcards",   icon: "🃏", label: "Flashcards",     bg: "#1a100a",  border: "#4a2800", color: "#ffb74d" },
  { mode: "quiz",         icon: "🎯", label: "Quiz me",        bg: "#0a1f10",  border: "#1a4a25", color: "#81c784" },
];

const PLACEHOLDERS = [
  "Type a topic or paste your notes…",
  "e.g. Photosynthesis, Newton's Laws, World War II…",
  "Paste an essay, chapter, or question here…",
  "What do you want to master today?",
];

// ─── AI avatar (reused from AITutorWidget style) ───────────────────────────────
function AIAvatar() {
  return (
    <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: "#0f1240", border: "1.5px solid #B8860B",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <circle cx="13" cy="14" r="9" fill="#1a1a1a" stroke="#B8860B" strokeWidth="1.2" />
          <circle cx="10" cy="13.5" r="1.4" fill="#90caf9" />
          <circle cx="16" cy="13.5" r="1.4" fill="#90caf9" />
          <path d="M10 17.5 Q13 19.5 16 17.5" stroke="#90caf9" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <line x1="13" y1="5" x2="13" y2="8" stroke="#5c6bc0" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="13" cy="4.5" r="1.2" fill="#5c6bc0" />
        </svg>
      </div>
      <div style={{
        position: "absolute", bottom: 1, right: 1,
        width: 9, height: 9, borderRadius: "50%",
        background: "#22c55e", border: "1.5px solid #0d0f22",
        animation: "ssi-pulse 2s ease-in-out infinite",
      }} />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
/**
 * @param {{ onOpenStudy: (topic: string, mode: string, attachment?: object) => void, onOpenLearn: () => void }} props
 */
export default function SmartStudyInput({ onOpenStudy, onOpenLearn }) {
  const [text, setText]               = useState("");
  const [attachment, setAttachment]   = useState(null);  // { type, name, content, dataUrl }
  const [showActions, setShowActions] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef(null);
  const docRef      = useRef(null);
  const imgRef      = useRef(null);

  // Cycle placeholder
  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, []);

  // Show action strip when there is content
  useEffect(() => {
    setShowActions(text.trim().length > 0 || !!attachment);
  }, [text, attachment]);

  // ── File handlers ──
  function handleDocSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setAttachment({ type: "doc", name: file.name, content: (ev.target.result || "").slice(0, 4000), dataUrl: null });
    };
    reader.readAsText(file);
  }

  function handleImgSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setAttachment({ type: "img", name: file.name, content: `[Image: ${file.name}]`, dataUrl: ev.target.result });
    };
    reader.readAsDataURL(file);
  }

  // ── Launch study ──
  function launch(mode) {
    const topic = text.trim();
    if (!topic && !attachment) return;
    const effectiveTopic = topic || (attachment?.name || "uploaded material");
    onOpenStudy?.(effectiveTopic, mode, attachment || null);
    // Reset
    setText("");
    setAttachment(null);
  }

  const hasContent = text.trim().length > 0 || !!attachment;

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Main card ── */}
      <div style={{
        background: "#0d0f22",
        border: `0.5px solid ${D.line}`,
        borderRadius: 18,
        padding: "14px 14px 12px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background accent */}
        <div style={{
          position: "absolute", top: -50, right: -50,
          width: 200, height: 200, borderRadius: "50%",
          background: "#1a1a1a", opacity: 0.1, pointerEvents: "none",
        }} />

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, position: "relative" }}>
          <AIAvatar />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: "#B8860B",
              letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "Syne, sans-serif", marginBottom: 3,
            }}>
              AI Study Assistant · Online
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#c5c9e8", lineHeight: 1.4, fontFamily: "Manrope, sans-serif" }}>
              What do you want to learn today?
            </div>
          </div>
        </div>

        {/* Attachment preview */}
        {attachment && (
          <div className="ssi-animate" style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#0a0c1e", border: `0.5px solid ${D.line}`,
            borderRadius: 10, padding: "7px 12px", marginBottom: 8,
          }}>
            {attachment.type === "img"
              ? <img src={attachment.dataUrl} alt={attachment.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
              : <span style={{ fontSize: 18 }}>📄</span>
            }
            <span style={{ flex: 1, fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {attachment.name}
            </span>
            <button onClick={() => setAttachment(null)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, color: D.hint, padding: "0 4px",
            }}>×</button>
          </div>
        )}

        {/* Text input area */}
        <div style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && hasContent) {
                e.preventDefault();
                launch("auto-roadmap");
              }
            }}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", resize: "none",
              background: "#080a18", border: `0.5px solid ${hasContent ? D.border : D.line}`,
              borderRadius: 13, padding: "11px 14px 11px 14px",
              paddingBottom: 36,
              fontSize: 13, color: D.text,
              fontFamily: "Manrope, sans-serif", outline: "none",
              lineHeight: 1.6, transition: "border-color 0.2s",
              scrollbarWidth: "none",
            }}
            onFocus={e  => e.target.style.borderColor = D.border}
            onBlur={e   => e.target.style.borderColor = hasContent ? D.border : D.line}
          />

          {/* Upload buttons inside textarea bottom-left */}
          <div style={{ position: "absolute", bottom: 8, left: 10, display: "flex", gap: 4 }}>
            <button
              className="ssi-upload-btn"
              onClick={() => docRef.current?.click()}
              style={{ background: "#0f1230", color: D.muted }}
              title="Upload document"
            >
              📄 <span style={{ fontSize: 10 }}>Doc</span>
            </button>
            <button
              className="ssi-upload-btn"
              onClick={() => imgRef.current?.click()}
              style={{ background: "#0f1230", color: D.muted }}
              title="Upload image"
            >
              🖼 <span style={{ fontSize: 10 }}>Image</span>
            </button>
          </div>

          {/* Enter hint bottom-right */}
          {hasContent && (
            <div style={{
              position: "absolute", bottom: 11, right: 12,
              fontSize: 9, color: D.hint, fontFamily: "Manrope,sans-serif",
            }}>
              ↵ Roadmap
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input ref={docRef} type="file" accept=".txt,.pdf,.doc,.docx,.md" style={{ display: "none" }}
          onChange={e => { handleDocSelect(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { handleImgSelect(e.target.files?.[0]); e.target.value = ""; }} />

        {/* ── Action strip (slides in when content is present) ── */}
        {showActions && (
          <div className="ssi-animate" style={{
            display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap",
          }}>
            {ACTIONS.map(a => (
              <button
                key={a.mode}
                className="ssi-action-btn ssi-pop"
                onClick={() => launch(a.mode)}
                style={{ background: a.bg, border: `0.5px solid ${a.border}`, color: a.color }}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Always-visible bottom row ── */}
        {!showActions && (
          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
            <button
              className="ssi-action-btn"
              onClick={() => onOpenLearn?.()}
              style={{
                background: "#0a1020", border: "0.5px solid #ef5350",
                color: "#ef9a9a",
              }}
            >
              ▶ Video Lesson
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
