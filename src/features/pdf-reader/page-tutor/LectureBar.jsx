import { useMemo, useState } from "react";

// Lecture mode — continuous playback across a page range. Picker collapses to a
// single row; during a lecture it becomes a live status bar (preparing /
// blocked / playing) with a stop button.
export default function LectureBar({ T, page, numPages, tutor, ctl }) {
  const { lecture, blocked, prep, premium, start, stop, resume } = ctl;
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(page);
  const [to, setTo] = useState(Math.min(numPages, page + 4));
  const [cachedOnly, setCachedOnly] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const lo = Math.max(1, Math.min(from, to));
  const hi = Math.min(numPages, Math.max(from, to));
  const range = useMemo(() => {
    const out = [];
    for (let p = lo; p <= hi; p++) out.push(p);
    return out;
  }, [lo, hi]);
  const known = tutor.lessonPages || new Set();
  const uncached = range.filter((p) => !known.has(p)).length;
  const playableCount = cachedOnly ? range.length - uncached : range.length;
  const needsConfirm = !cachedOnly && uncached > 3;

  // ── Live lecture ────────────────────────────────────────────────────────────
  if (lecture) {
    const cur = lecture.queue[lecture.pos];
    const dot = <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0, animation: "sc-pulse 1.4s ease infinite" }} />;
    return (
      <div style={{ padding: "9px 12px", borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
        {dot}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>
            {prep ? `Preparing page ${prep}…` : `Lecture · ${lecture.pos + 1}/${lecture.queue.length} — page ${cur}`}
          </div>
          {lecture.cachedOnly && <div style={{ fontSize: 10.5, color: T.muted }}>explained pages only</div>}
        </div>
        {blocked && !prep ? (
          <button onClick={resume} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#F5B942,#E8963C)", color: "#fff", fontWeight: 900, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            ▶ Continue
          </button>
        ) : null}
        <button onClick={stop} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          ⏹ Stop
        </button>
      </div>
    );
  }

  // ── Picker ──────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button onClick={() => { setFrom(page); setTo(Math.min(numPages, page + 4)); setOpen(true); }}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 12, border: `1px dashed ${T.border}`, background: "transparent", color: T.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        🎧 Lecture mode — play pages back-to-back
      </button>
    );
  }

  const inp = { width: 54, padding: "4px 6px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontWeight: 800, fontSize: 12, fontFamily: "inherit", textAlign: "center" };
  const chip = (label, v) => (
    <button key={label} onClick={() => setTo(Math.min(numPages, page + v))}
      style={{ padding: "3px 9px", borderRadius: 999, border: `1px solid ${T.border}`, background: T.chipBg, color: T.muted, fontWeight: 700, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: "11px 12px", borderRadius: 12, background: T.inputBg, border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>🎧 Play a lecture</div>
        <button onClick={() => { setOpen(false); setConfirming(false); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>✕</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 700 }}>Pages</span>
        <input type="number" min={1} max={numPages} value={from} onChange={(e) => setFrom(+e.target.value || 1)} style={inp} />
        <span style={{ fontSize: 11.5, color: T.muted }}>→</span>
        <input type="number" min={1} max={numPages} value={to} onChange={(e) => setTo(+e.target.value || numPages)} style={inp} />
        {chip("+3", 3)}{chip("+5", 5)}
        <button onClick={() => setTo(numPages)} style={{ padding: "3px 9px", borderRadius: 999, border: `1px solid ${T.border}`, background: T.chipBg, color: T.muted, fontWeight: 700, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" }}>to end</button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: T.muted, fontWeight: 600, marginBottom: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={cachedOnly} onChange={(e) => { setCachedOnly(e.target.checked); setConfirming(false); }} />
        Explained pages only <span style={{ fontSize: 10, opacity: 0.8 }}>(free — no generation)</span>
      </label>
      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>
        {playableCount} page{playableCount === 1 ? "" : "s"}
        {uncached > 0 && !cachedOnly ? ` · ${uncached} will be generated${premium === false ? " (needs Premium)" : ""}` : ""}
        {cachedOnly && uncached > 0 ? ` · ${uncached} skipped` : ""}
      </div>
      {needsConfirm && !confirming ? (
        <button onClick={() => setConfirming(true)} style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: `1px solid ${T.gold}66`, background: "rgba(245,185,66,0.08)", color: T.gold, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Generate {uncached} lesson{uncached === 1 ? "" : "s"}? Tap to confirm
        </button>
      ) : (
        <button onClick={() => { setOpen(false); setConfirming(false); start(lo, hi, cachedOnly); }}
          disabled={playableCount === 0}
          style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "none", background: playableCount ? "linear-gradient(135deg,#F5B942,#E8963C)" : T.chipBg, color: playableCount ? "#fff" : T.muted, fontWeight: 900, fontSize: 12.5, cursor: playableCount ? "pointer" : "default", fontFamily: "inherit" }}>
          ▶ Start lecture — {playableCount} page{playableCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
