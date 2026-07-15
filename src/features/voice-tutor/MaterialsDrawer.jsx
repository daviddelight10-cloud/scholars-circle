import { useState } from "react";
import { COLORS, FONTS } from "./voiceConfig.js";

export default function MaterialsDrawer({ open, onClose, materials }) {
  const [expandedChunks, setExpandedChunks] = useState(new Set());

  if (!open) return null;

  const toggleChunk = (idx) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

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
          top: 0, left: 0, bottom: 0,
          width: "min(420px, 90vw)",
          background: COLORS.surface,
          borderRight: `1px solid ${COLORS.border}`,
          zIndex: 9999,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "scVtSlideInLeft 0.25s ease-out",
        }}
      >
        <style>{`
          @keyframes scVtSlideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
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
            }}>Materials</h3>
            {materials && (
              <p style={{
                margin: "4px 0 0", fontSize: 11,
                color: COLORS.textDim, fontFamily: FONTS.body,
              }}>{materials.chunkCount} chunks · {Math.round(materials.totalLength / 1000)}k chars</p>
            )}
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
          {materials ? (
            <>
              <div style={{
                padding: "12px 14px",
                background: COLORS.inkLight,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                marginBottom: 16,
              }}>
                <div style={{
                  fontSize: 10, color: COLORS.textFaint,
                  fontFamily: FONTS.mono, textTransform: "uppercase",
                  letterSpacing: 1, marginBottom: 4,
                }}>Source Document</div>
                <div style={{
                  fontSize: 14, color: COLORS.text,
                  fontFamily: FONTS.display, fontWeight: 600,
                }}>{materials.title}</div>
              </div>

              <div style={{
                fontSize: 10, color: COLORS.textFaint,
                fontFamily: FONTS.mono, textTransform: "uppercase",
                letterSpacing: 1, marginBottom: 10,
              }}>Grounding Chunks</div>

              {materials.chunks?.map((chunk, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 8,
                    background: COLORS.inkLight,
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => toggleChunk(i)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{
                      fontSize: 10, color: COLORS.electric,
                      fontFamily: FONTS.mono, flexShrink: 0,
                    }}>#{i + 1}</span>
                    <span style={{
                      fontSize: 11, color: COLORS.textDim,
                      fontFamily: FONTS.body,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}>{chunk.preview}...</span>
                    <span style={{
                      fontSize: 10, color: COLORS.textFaint,
                      fontFamily: FONTS.mono, flexShrink: 0,
                    }}>{chunk.length}</span>
                  </button>
                  {expandedChunks.has(i) && (
                    <div style={{
                      padding: "0 14px 12px",
                      fontSize: 11,
                      color: COLORS.textDim,
                      fontFamily: FONTS.body,
                      lineHeight: 1.6,
                    }}>{chunk.preview}</div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div style={{
              textAlign: "center",
              padding: "40px 0",
              color: COLORS.textFaint,
              fontSize: 13,
              fontFamily: FONTS.body,
            }}>No materials loaded yet</div>
          )}
        </div>
      </div>
    </>
  );
}
