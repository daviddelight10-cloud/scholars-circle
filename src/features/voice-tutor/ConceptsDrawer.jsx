import { COLORS, FONTS } from "./voiceConfig.js";

export default function ConceptsDrawer({ open, onClose, concepts = [], onConceptClick }) {
  if (!open) return null;

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
          top: 0, right: 0, bottom: 0,
          width: "min(380px, 90vw)",
          background: COLORS.surface,
          borderLeft: `1px solid ${COLORS.border}`,
          zIndex: 9999,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "scVtSlideInRight 0.25s ease-out",
        }}
      >
        <style>{`
          @keyframes scVtSlideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes scVtFadeIn { to { opacity: 1; } }
        `}</style>

        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <h3 style={{
              margin: 0, fontSize: 16, fontWeight: 700,
              color: COLORS.text, fontFamily: FONTS.display,
            }}>Key Concepts</h3>
            <p style={{
              margin: "4px 0 0", fontSize: 11,
              color: COLORS.textDim, fontFamily: FONTS.body,
            }}>Extracted from your document</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: COLORS.textDim,
              fontSize: 20, cursor: "pointer", padding: "4px 8px",
            }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {concepts.length > 0 ? (
            concepts.map((concept, i) => (
              <button
                key={i}
                onClick={() => onConceptClick?.(concept)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px 14px",
                  background: COLORS.inkLight,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  marginBottom: 8,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.electricDim;
                  e.currentTarget.style.background = COLORS.inkLighter;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border;
                  e.currentTarget.style.background = COLORS.inkLight;
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}>
                  <span style={{
                    fontSize: 10, color: COLORS.gold,
                    fontFamily: FONTS.mono, flexShrink: 0, marginTop: 2,
                  }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{
                    fontSize: 12, color: COLORS.text,
                    fontFamily: FONTS.body, lineHeight: 1.5,
                  }}>{concept}</span>
                </div>
              </button>
            ))
          ) : (
            <div style={{
              textAlign: "center",
              padding: "40px 0",
              color: COLORS.textFaint,
              fontSize: 13,
              fontFamily: FONTS.body,
            }}>No concepts extracted yet</div>
          )}
        </div>
      </div>
    </>
  );
}
