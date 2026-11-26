import { useState, useRef, useLayoutEffect, useCallback } from "react";

// Mind map — the lesson's own structure drawn as a horizontal node graph:
// root pill on the left, section nodes in a middle column, leaf nodes
// (key points / terms / "see on page") branching right of their section.
// Curved bezier connectors are measured from real node positions in layout
// space (offset* values are unaffected by CSS zoom/scroll). No model call:
// the hierarchy already exists in every cached lesson.

const pill = (extra) => ({
  flexShrink: 0,
  borderRadius: 12,
  padding: "8px 12px",
  fontFamily: "inherit",
  textAlign: "left",
  cursor: "pointer",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  ...extra,
});

export default function MindMap({ T, lesson, playingIdx, onJumpSection, onSeeOnPage }) {
  const les = lesson?.lesson;
  const [open, setOpen] = useState(() => (les?.sections || []).reduce((m, _s, i) => ({ ...m, [i]: true }), { kp: true }));
  const [zoom, setZoom] = useState(1);
  const [paths, setPaths] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const stageRef = useRef(null);
  const innerRef = useRef(null);
  const nodeRefs = useRef(new Map()); // "root" | "s<i>" | "s<i>-l<j>" → element

  const setNode = (id) => (el) => { if (el) nodeRefs.current.set(id, el); else nodeRefs.current.delete(id); };

  // Measure every node in inner-space and rebuild the connector paths.
  const measure = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const pos = (el) => {
      let x = 0, y = 0, n = el;
      while (n && n !== inner) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    };
    const edge = (a, b) => {
      const p1 = pos(a), p2 = pos(b);
      const x1 = p1.x + p1.w, y1 = p1.y + p1.h / 2;
      const x2 = p2.x, y2 = p2.y + p2.h / 2;
      const dx = Math.max(24, (x2 - x1) / 2);
      return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    };
    const root = nodeRefs.current.get("root");
    const out = [];
    if (root) {
      nodeRefs.current.forEach((el, id) => {
        if (id === "root") return;
        if (id.startsWith("s")) {
          const [si, leaf] = id.split("-");
          if (!leaf) {
            // root → every visible section node
            out.push({ d: edge(root, el), cls: "root" });
          } else {
            // section → leaf
            const sec = nodeRefs.current.get(si);
            if (sec) out.push({ d: edge(sec, el), cls: "leaf" });
          }
        }
      });
    }
    setPaths(out);
    setSize({ w: inner.scrollWidth, h: inner.scrollHeight });
  }, []);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [measure, open, lesson, zoom]);

  if (!les?.sections?.length) return null;
  const keyPoints = les.key_points || [];

  const secBtn = (i, label, sub, active) => (
    <div style={{ position: "relative", width: 168, flexShrink: 0 }}>
      <button
        ref={setNode(`s${i}`)}
        onClick={() => setOpen((m) => ({ ...m, [i]: !m[i] }))}
        style={{
          width: "100%", ...pill({
            border: `1.5px solid ${active ? "rgba(79,142,247,0.6)" : "rgba(79,142,247,0.28)"}`,
            background: active ? "rgba(79,142,247,0.14)" : "rgba(79,142,247,0.07)",
            boxShadow: active ? "0 0 0 4px rgba(79,142,247,0.10)" : "none",
          }),
        }}
        title={open[i] ? "Collapse branch" : "Expand branch"}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#4F8EF7", lineHeight: 1.3 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </button>
      {onJumpSection && (
        <button
          onClick={(e) => { e.stopPropagation(); onJumpSection(i); }}
          title="Jump to section"
          style={{
            position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: "50%",
            border: `1px solid ${T.border}`, background: T.toolbar, color: "#4F8EF7",
            fontSize: 10, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >↗</button>
      )}
    </div>
  );

  const leafBtn = (id, label, sub, onJump) => (
    <button
      key={id}
      ref={setNode(id)}
      onClick={onJump}
      disabled={!onJump}
      style={pill({
        width: 190,
        border: `1px solid ${T.border}`,
        background: T.inputBg,
        cursor: onJump ? "pointer" : "default",
      })}
      title={onJump ? "See on page" : undefined}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </button>
  );

  return (
    <div ref={stageRef} style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative", WebkitOverflowScrolling: "touch" }}>
      {/* Zoom controls */}
      <div style={{ position: "sticky", top: 8, float: "right", marginRight: 10, zIndex: 5, display: "flex", gap: 5 }}>
        {[["−", () => setZoom((z) => Math.max(0.55, +(z - 0.15).toFixed(2)))], ["+", () => setZoom((z) => Math.min(1.5, +(z + 0.15).toFixed(2)))]].map(([l, fn]) => (
          <button key={l} onClick={fn} aria-label={l === "+" ? "Zoom in" : "Zoom out"}
            style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.border}`, background: T.toolbar, color: T.text, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
            {l}
          </button>
        ))}
      </div>

      <div
        ref={innerRef}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          padding: "56px 60px 40px 40px",
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
          minWidth: "100%",
        }}
      >
        {/* Connectors — measured in layout space so they scale with the nodes */}
        <svg
          width={size.w}
          height={size.h}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
        >
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.cls === "root" ? `${T.gold}66` : `${T.border}`}
              strokeWidth={p.cls === "root" ? 1.8 : 1.3}
            />
          ))}
        </svg>

        {/* Root */}
        <div style={{ flexShrink: 0, marginRight: 64 }}>
          <div
            ref={setNode("root")}
            style={{
              width: 156, borderRadius: 14, padding: "12px 14px",
              background: `linear-gradient(135deg, ${T.gold}22, ${T.gold}0a)`,
              border: `1.5px solid ${T.gold}55`,
              boxShadow: `0 6px 20px ${T.gold}22`,
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.gold, lineHeight: 1.35, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>
              {les.page_title || `Page ${lesson.page}`}
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 3, fontWeight: 600 }}>
              {les.sections.length} sections · {keyPoints.length} key points
            </div>
          </div>
        </div>

        {/* Section rows — pill + its leaf stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {les.sections.map((s, i) => {
            const leaves = [];
            (s.key_points || []).slice(0, 3).forEach((k) =>
              leaves.push({ id: `s${i}-l${leaves.length}`, label: k }));
            (s.terms || []).slice(0, 2).forEach((t) =>
              leaves.push({ id: `s${i}-l${leaves.length}`, label: t.term || t, sub: t.term && t.definition ? t.definition : undefined }));
            if (s.anchor_quote)
              leaves.push({ id: `s${i}-l${leaves.length}`, label: "See on page ↗", jump: () => onSeeOnPage?.(s.anchor_quote) });
            return (
              <div key={s.id || i} style={{ display: "flex", alignItems: "center", gap: 52 }}>
                {secBtn(i, s.heading || `Section ${i + 1}`, `${leaves.length} points`, playingIdx === i)}
                {open[i] && leaves.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {leaves.map((l) => leafBtn(l.id, l.label, l.sub, l.jump))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Key-points branch */}
          {keyPoints.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 52 }}>
              {secBtn("kp", "Key points", `${Math.min(keyPoints.length, 6)} points`, false)}
              {open.kp && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {keyPoints.slice(0, 6).map((k, j) => leafBtn(`skp-l${j}`, k))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
