import { COLORS, FONTS } from "./voiceConfig.js";

export default function ConceptsDrawer({ open, onClose, concepts = [], onConceptClick }) {
  if (!open) return null;

  return (
    <>
      <div className="sc-vt-drawer-overlay" onClick={onClose} />
      <div className="sc-vt-drawer right">
        <div className="sc-vt-drawer-header">
          <div>
            <h3>Key Concepts</h3>
            <p>Extracted from your document</p>
          </div>
          <button className="sc-vt-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="sc-vt-drawer-body">
          {concepts.length > 0 ? (
            concepts.map((concept, i) => (
              <button
                key={i}
                className="sc-vt-concept-btn"
                onClick={() => onConceptClick?.(concept)}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span className="sc-vt-concept-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="sc-vt-concept-text">{concept}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="sc-vt-empty">No concepts extracted yet</div>
          )}
        </div>
      </div>
    </>
  );
}
