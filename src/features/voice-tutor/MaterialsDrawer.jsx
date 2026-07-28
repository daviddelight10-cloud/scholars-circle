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
      <div className="sc-vt-drawer-overlay" onClick={onClose} />
      <div className="sc-vt-drawer left">
        <div className="sc-vt-drawer-header">
          <div>
            <h3>Materials</h3>
            {materials && (
              <p>{materials.chunkCount} chunks · {Math.round(materials.totalLength / 1000)}k chars</p>
            )}
          </div>
          <button className="sc-vt-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="sc-vt-drawer-body">
          {materials ? (
            <>
              <div className="sc-vt-drawer-card">
                <div className="sc-vt-drawer-label">Source Document</div>
                <div className="sc-vt-drawer-title">{materials.title}</div>
              </div>

              <div className="sc-vt-drawer-label" style={{ marginBottom: 10 }}>Grounding Chunks</div>

              {materials.chunks?.map((chunk, i) => (
                <div key={i} className="sc-vt-drawer-card" style={{ padding: 0, overflow: "hidden" }}>
                  <button className="sc-vt-chunk-btn" onClick={() => toggleChunk(i)}>
                    <span className="sc-vt-chunk-num">#{i + 1}</span>
                    <span className="sc-vt-chunk-preview">{chunk.preview}...</span>
                    <span className="sc-vt-chunk-len">{chunk.length}</span>
                  </button>
                  {expandedChunks.has(i) && (
                    <div className="sc-vt-chunk-expanded">{chunk.preview}</div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="sc-vt-empty">No materials loaded yet</div>
          )}
        </div>
      </div>
    </>
  );
}
