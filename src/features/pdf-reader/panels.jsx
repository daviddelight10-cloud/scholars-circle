// ── Note editor modal (margin note on a highlight) ──────────────────────────
export function NoteEditorModal({ noteEdit, marks, onSave, onClose, T, s, isMobile }) {
  if (!noteEdit) return null;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,0.25)" }} onClick={onClose} />
      <div
        style={{
          position: "fixed",
          left: "50%",
          ...(isMobile ? { bottom: 90, transform: "translateX(-50%)" } : { top: "35%", transform: "translate(-50%,-50%)" }),
          width: isMobile ? "92vw" : 340,
          zIndex: 301,
          background: T.toolbar,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          boxShadow: `0 14px 44px ${T.shadow}`,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          📝 Note — page {noteEdit.page}
        </div>
        <textarea
          autoFocus
          rows={3}
          defaultValue={(marks[noteEdit.page] || []).find((m) => m.id === noteEdit.id)?.note || ""}
          placeholder="Add a margin note…"
          style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", fontFamily: "inherit", resize: "vertical" }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { onSave(noteEdit.page, noteEdit.id, e.target.value.trim()); onClose(); } }}
          id="sc-note-edit"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
          <button style={s.selPopBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.selPopBtn, background: T.accent, color: "#fff", border: "none" }}
            onClick={() => {
              const v = document.getElementById("sc-note-edit")?.value?.trim() || "";
              onSave(noteEdit.page, noteEdit.id, v);
              onClose();
            }}
          >
            Save note
          </button>
        </div>
      </div>
    </>
  );
}

// ── Notes panel (all marks across the document) ──────────────────────────────
export function NotesPanel({ marks, onJump, onClose, T, s, isMobile }) {
  return (
    <div style={{ position: "fixed", top: 110, ...(isMobile ? { left: 8, right: 8 } : { right: 16 }), width: isMobile ? "auto" : 320, maxHeight: "60vh", overflowY: "auto", zIndex: 200, background: T.toolbar, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: `0 10px 32px ${T.shadow}`, padding: 8 }}>
      <div style={{ fontSize: 11, color: T.muted, padding: "4px 8px", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
        <span>Highlights & notes ({marks.length})</span>
        <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 10 }} onClick={onClose}>Close</button>
      </div>
      {marks.length === 0 && (
        <div style={{ padding: "16px 12px", fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
          Select text on the page to highlight it, add a note, or turn it into a quiz question.
        </div>
      )}
      {marks.map((m) => (
        <div key={m.id} style={{ ...s.searchItem, borderBottom: `1px solid ${T.border}` }} onClick={() => { onJump(m.page, m.id); onClose(); }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color.replace("0.4", "0.9"), flexShrink: 0 }} />
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: T.accent }}>p.{m.page}</span>
            {m.note && <span style={{ fontSize: 10, color: T.muted }}>📝</span>}
          </span>
          <span style={{ display: "block", fontSize: 12, color: T.text, lineHeight: 1.4 }}>
            “{m.text.slice(0, 110)}{m.text.length > 110 ? "…" : ""}”
          </span>
          {m.note && <span style={{ display: "block", fontSize: 11.5, color: T.muted, marginTop: 2 }}>📝 {m.note}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Keyboard shortcuts overlay ───────────────────────────────────────────────
export function ShortcutsModal({ onClose, T }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.toolbar, borderRadius: 16, padding: 24, maxWidth: 380, width: "90%",
          boxShadow: `0 8px 32px ${T.shadow}`, border: `0.5px solid ${T.border}`,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Keyboard Shortcuts
          <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18 }} onClick={onClose}>✕</button>
        </div>
        {[
          { key: "← / →", action: "Previous / Next page" },
          { key: "+ / -", action: "Zoom in / out" },
          { key: "B", action: "Bookmark current page" },
          { key: "T", action: "Cycle theme (light → dark → sepia)" },
          { key: "F", action: "Toggle fullscreen" },
          { key: "H", action: "Toggle highlighter tool" },
          { key: "?", action: "Show this shortcuts overlay" },
          { key: "Esc", action: "Close overlays / exit fullscreen" },
        ].map((sc) => (
          <div key={sc.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `0.5px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.text }}>{sc.action}</span>
            <kbd style={{
              background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6,
              padding: "2px 10px", fontSize: 12, fontWeight: 600, color: T.muted,
              fontFamily: "monospace",
            }}>{sc.key}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reading analytics overlay ────────────────────────────────────────────────
export function StatsModal({ stats, numPages, strokeCount, onClose, T }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.toolbar, borderRadius: 16, padding: 24, maxWidth: 420, width: "90%",
          boxShadow: `0 8px 32px ${T.shadow}`, border: `0.5px solid ${T.border}`,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Reading Analytics
          <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18 }} onClick={onClose}>✕</button>
        </div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: T.inputBg, borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>
              {Math.floor(stats.totalSeconds / 60)}m {stats.totalSeconds % 60}s
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Total reading time</div>
          </div>
          <div style={{ background: T.inputBg, borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>
              {stats.pagesRead.length}<span style={{ fontSize: 14, color: T.muted }}>/{numPages}</span>
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Pages read</div>
          </div>
          <div style={{ background: T.inputBg, borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>
              {numPages > 0 ? Math.round((stats.pagesRead.length / numPages) * 100) : 0}%
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Progress</div>
          </div>
          <div style={{ background: T.inputBg, borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>{strokeCount}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Highlights made</div>
          </div>
        </div>

        {/* Most-read pages */}
        {Object.keys(stats.pageTimes).length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 8 }}>Most time spent</div>
            {Object.entries(stats.pageTimes)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([pg, secs]) => (
                <div key={pg} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.text, width: 60 }}>Page {pg}</span>
                  <div style={{ flex: 1, height: 8, background: T.inputBg, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.min(100, (secs / Math.max(...Object.values(stats.pageTimes))) * 100)}%`,
                      height: "100%", background: T.accent, borderRadius: 4,
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: T.muted, width: 40, textAlign: "right" }}>
                    {Math.floor(secs / 60)}m {secs % 60}s
                  </span>
                </div>
              ))}
          </div>
        )}

        {stats.pagesRead.length === 0 && (
          <div style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: 20 }}>
            Start reading to see your analytics here.
          </div>
        )}
      </div>
    </div>
  );
}
