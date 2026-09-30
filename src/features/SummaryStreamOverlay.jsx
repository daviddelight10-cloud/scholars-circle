import { useEffect, useRef } from "react";
import MarkdownText from "../components/MarkdownText";

const D = {
  bg: "#0a0a0a",
  bar: "#121212",
  accent: "#1e1e22",
  line: "rgba(255,255,255,0.09)",
  text: "#EDEFF5",
  muted: "#9AA3B5",
  hint: "#646E84",
  gold: "#FFD700",
};

/**
 * Full-screen live view shown while a summary is being generated.
 * The markdown materializes token-by-token on the page background —
 * same centered-column language as SummaryView. Auto-scrolls with the
 * stream unless the user scrolls up to read earlier content.
 */
export default function SummaryStreamOverlay({ title, text, progress, done, savedResource, onCancel, onClose, onOpen }) {
  const scrollHostRef = useRef(null);
  const pinnedRef = useRef(true); // auto-scroll while user hasn't scrolled up

  // Auto-scroll to the newest tokens while streaming, unless the user
  // scrolled up to read — then leave them alone.
  useEffect(() => {
    if (!pinnedRef.current || done) return;
    const el = scrollHostRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, done]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: D.bg, display: "flex", flexDirection: "column",
      fontFamily: "Manrope,sans-serif",
    }}>
      <style>{`
        @keyframes sumCursor { 0%,100% { opacity: 1; } 50% { opacity: 0.15; } }
        @keyframes sumPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes sumFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Slim top bar — same language as SummaryView */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 16px 11px", flexShrink: 0,
        borderBottom: `0.5px solid ${D.line}`, background: D.bar,
      }}>
        <button
          onClick={done ? onClose : onCancel}
          aria-label={done ? "Close" : "Cancel"}
          style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: D.accent, border: `0.5px solid ${D.line}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: D.muted, fontSize: 17,
          }}
        >{done ? "←" : "×"}</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700,
            color: D.text, lineHeight: 1.1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {title || "Summary"}
          </div>
          <div style={{ fontSize: 11, color: "#646E84", marginTop: 3 }}>
            {done ? "✓ Saved to your space" : (progress || "Writing summary…")}
          </div>
        </div>

        {!done && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0,
            color: D.gold, background: "rgba(255,215,0,0.1)",
            border: "0.5px solid rgba(255,215,0,0.3)", borderRadius: 6,
            padding: "4px 8px", animation: "sumPulse 1.4s ease infinite",
          }}>
            ✨ WRITING
          </span>
        )}
      </div>

      {/* Body — live markdown in a centered column */}
      <div
        ref={scrollHostRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", padding: "26px 18px 60px", scrollbarWidth: "thin" }}
      >
        <div style={{ maxWidth: 780, margin: "0 auto", width: "100%" }}>
          {text ? (
            <>
              <MarkdownText theme="gold">{text}</MarkdownText>
              {!done && (
                <span style={{
                  display: "inline-block", width: 9, height: 16, marginLeft: 2,
                  background: D.gold, borderRadius: 2, verticalAlign: "text-bottom",
                  animation: "sumCursor 0.9s step-end infinite",
                }} />
              )}
            </>
          ) : (
            <div style={{
              padding: "60px 20px", textAlign: "center", color: D.hint,
              fontSize: 13, animation: "sumPulse 1.6s ease infinite",
            }}>
              {progress || "Preparing…"}
            </div>
          )}

          {done && (
            <div style={{
              marginTop: 32, paddingTop: 20, borderTop: `0.5px solid ${D.line}`,
              display: "flex", gap: 10, justifyContent: "center",
              animation: "sumFadeUp 0.3s ease",
            }}>
              {savedResource?.shareToken && onOpen && (
                <button
                  onClick={() => onOpen(savedResource.shareToken)}
                  style={{
                    padding: "10px 20px", borderRadius: 999, cursor: "pointer",
                    background: D.gold, color: "#0a0a0a", border: "none",
                    fontSize: 13, fontWeight: 700, fontFamily: "Manrope,sans-serif",
                  }}
                >
                  Open summary →
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px", borderRadius: 999, cursor: "pointer",
                  background: D.accent, color: D.muted,
                  border: `0.5px solid ${D.line}`,
                  fontSize: 13, fontWeight: 600, fontFamily: "Manrope,sans-serif",
                }}
              >
                {savedResource?.shareToken && onOpen ? "Stay here" : "Done"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
