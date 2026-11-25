import { useState } from "react";

// Mind map — the lesson's own structure drawn as a collapsible tree.
// Root = page title, branches = sections, leaves = key points + terms.
// No model call: the hierarchy already exists in every cached lesson.

function MapNode({ T, depth, active, children, label, sub, onJump }) {
  const [open, setOpen] = useState(depth < 1);
  const hasKids = !!children?.length;
  return (
    <div style={{ position: "relative", paddingLeft: depth ? 22 : 0 }}>
      {depth > 0 && (
        // elbow connector — vertical rail + horizontal stub
        <>
          <span style={{ position: "absolute", left: 0, top: -8, bottom: 8, width: 1.5, background: `${T.gold}55` }} />
          <span style={{ position: "absolute", left: 0, top: 14, width: 14, height: 1.5, background: `${T.gold}55` }} />
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 0" }}>
        {hasKids ? (
          <button onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}
            style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.muted, fontSize: 10, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", lineHeight: 1 }}>
            {open ? "−" : "+"}
          </button>
        ) : (
          <span style={{ width: 20, flexShrink: 0, textAlign: "center", fontSize: 9, color: T.muted }}>•</span>
        )}
        <button onClick={hasKids ? () => setOpen(!open) : onJump}
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: depth === 0 ? `linear-gradient(135deg, ${T.gold}18, transparent)` : active ? "rgba(79,142,247,0.10)" : T.inputBg, border: `1px solid ${active ? "rgba(79,142,247,0.5)" : depth === 0 ? `${T.gold}44` : T.border}`, borderRadius: 9, padding: depth === 0 ? "8px 11px" : "6px 10px", cursor: hasKids || onJump ? "pointer" : "default", fontFamily: "inherit" }}>
          <div style={{ fontSize: depth === 0 ? 12.5 : depth === 1 ? 12 : 11, fontWeight: depth <= 1 ? 800 : 600, color: depth === 0 ? T.gold : active ? "#4F8EF7" : T.text, lineHeight: 1.3 }}>
            {label}
          </div>
          {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{sub}</div>}
        </button>
        {onJump && depth === 1 && (
          <button onClick={onJump} title="Jump to section"
            style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: "#4F8EF7", fontSize: 11, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
            ↗
          </button>
        )}
      </div>
      {hasKids && open && (
        <div style={{ paddingLeft: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function MindMap({ T, lesson, playingIdx, onJumpSection, onSeeOnPage }) {
  const les = lesson?.lesson;
  if (!les?.sections?.length) return null;
  const keyPoints = les.key_points || [];
  return (
    <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "4px 14px 14px", flex: 1 }}>
      <MapNode
        T={T} depth={0}
        label={les.page_title || `Page ${lesson.page}`}
        sub={`${les.sections.length} sections · ${keyPoints.length} key points`}
      >
        {les.sections.map((s, i) => (
          <MapNode
            key={s.id || i}
            T={T} depth={1}
            active={playingIdx === i}
            label={s.heading || `Section ${i + 1}`}
            onJump={() => onJumpSection?.(i)}
          >
            {(s.key_points || []).slice(0, 3).map((k, j) => (
              <MapNode key={`k${j}`} T={T} depth={2} label={k} />
            ))}
            {(s.terms || []).slice(0, 2).map((t, j) => (
              <MapNode key={`t${j}`} T={T} depth={2} label={t.term || t}
                sub={t.term && t.definition ? t.definition : undefined} />
            ))}
            {s.anchor_quote && (
              <MapNode key="q" T={T} depth={2} label="See on page ↗"
                onJump={() => onSeeOnPage?.(s.anchor_quote)} />
            )}
          </MapNode>
        ))}
        {keyPoints.length > 0 && (
          <MapNode T={T} depth={1} label="Key points">
            {keyPoints.slice(0, 6).map((k, j) => (
              <MapNode key={`pk${j}`} T={T} depth={2} label={k} />
            ))}
          </MapNode>
        )}
      </MapNode>
    </div>
  );
}
