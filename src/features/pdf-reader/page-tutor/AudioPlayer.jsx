// Mini audio player pinned at the bottom of the lesson panel — play/pause,
// ±10s, speed cycle, progress bar. Audio itself lives in usePageTutor's single
// element so it keeps playing while the student scrolls or turns pages.
import { fmtTime } from "./lessonUtils.js";

export default function AudioPlayer({ T, player, sectionHeading, onToggle, onSeekBy, onCycleSpeed, onSeekTo }) {
  const pct = player.dur > 0 ? Math.min(100, (player.time / player.dur) * 100) : 0;
  const btn = {
    width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.border}`,
    background: "transparent", color: T.text, cursor: "pointer", fontSize: 12,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0,
  };
  return (
    <div style={{
      borderTop: `1px solid ${T.border}`, padding: "10px 12px", flexShrink: 0,
      background: T.toolbar,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {sectionHeading || "Page lesson"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button style={btn} onClick={() => onSeekBy(-10)} title="Back 10s">−10</button>
        <button
          style={{ ...btn, width: 40, height: 40, background: T.accent, color: "#fff", border: "none", fontSize: 15 }}
          onClick={onToggle}
          title={player.playing ? "Pause" : "Play"}
        >
          {player.playing ? "❚❚" : "▶"}
        </button>
        <button style={btn} onClick={() => onSeekBy(10)} title="Forward 10s">+10</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ height: 6, background: T.border, borderRadius: 4, cursor: "pointer", position: "relative" }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onSeekTo((e.clientX - r.left) / r.width);
            }}
          >
            <div style={{ height: "100%", width: `${pct}%`, background: T.accent, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginTop: 3 }}>
            <span>{fmtTime(player.time * 1000)}</span>
            <span>{fmtTime(player.dur * 1000)}</span>
          </div>
        </div>
        <button
          style={{ ...btn, width: "auto", borderRadius: 8, padding: "0 8px", fontSize: 11, fontWeight: 700 }}
          onClick={onCycleSpeed}
          title="Playback speed"
        >
          {player.speed}x
        </button>
      </div>
    </div>
  );
}
