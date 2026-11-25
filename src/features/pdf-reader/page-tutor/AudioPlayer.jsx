// Mini audio player pinned at the bottom of the lesson panel — play/pause,
// ±10s, speed cycle, progress bar. Audio itself lives in usePageTutor's single
// element so it keeps playing while the student scrolls or turns pages.
// In speech mode (device voice fallback) the bar tracks sentence chunks and
// the ±10s buttons hop a few chunks — SpeechSynthesis can't seek in seconds.
import { fmtTime } from "./lessonUtils.js";

export default function AudioPlayer({ T, player, sectionHeading, onToggle, onSeekBy, onCycleSpeed, onSeekTo, follow, onToggleFollow }) {
  const speech = player.mode === "speech";
  const pct = player.dur > 0 ? Math.min(100, (player.time / player.dur) * 100) : 0;
  const btn = {
    width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.border}`,
    background: "transparent", color: T.text, cursor: "pointer", fontSize: 12,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0,
  };
  return (
    <div style={{
      borderTop: `1px solid ${T.border}80`, padding: "10px 12px", flexShrink: 0,
      background: `${T.toolbar}CC`, // translucent so the glass sheet reads through
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{sectionHeading || "Page lesson"}</span>
        {speech && (
          <span style={{
            flexShrink: 0, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
            color: "#4F8EF7", border: "1px solid rgba(79,142,247,0.4)", borderRadius: 999, padding: "1.5px 7px",
            background: "rgba(79,142,247,0.1)",
          }}>Device voice</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button style={btn} onClick={() => onSeekBy(-10)} title={speech ? "Back a bit" : "Back 10s"}>−10</button>
        <button
          style={{ ...btn, width: 40, height: 40, background: T.accent, color: "#fff", border: "none", fontSize: 15 }}
          onClick={onToggle}
          title={player.playing ? "Pause" : "Play"}
        >
          {player.playing ? "❚❚" : "▶"}
        </button>
        <button style={btn} onClick={() => onSeekBy(10)} title={speech ? "Forward a bit" : "Forward 10s"}>+10</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ height: 6, background: T.border, borderRadius: 4, cursor: "pointer", position: "relative" }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onSeekTo((e.clientX - r.left) / r.width);
            }}
          >
            <div style={{ height: "100%", width: `${pct}%`, background: T.accent, borderRadius: 4, transition: speech ? "width .3s ease" : "none" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginTop: 3 }}>
            {speech ? (
              <>
                <span>sentence {Math.min(player.chunk + 1, player.chunks)}/{player.chunks || 1}</span>
                <span>device voice</span>
              </>
            ) : (
              <>
                <span>{fmtTime(player.time * 1000)}</span>
                <span>{fmtTime(player.dur * 1000)}</span>
              </>
            )}
          </div>
        </div>
        {onToggleFollow && (
          <button
            style={{ ...btn, width: "auto", borderRadius: 8, padding: "0 8px", fontSize: 10.5, fontWeight: 800, color: follow ? "#4F8EF7" : T.muted, borderColor: follow ? "rgba(79,142,247,0.5)" : T.border, background: follow ? "rgba(79,142,247,0.10)" : "transparent" }}
            onClick={onToggleFollow}
            title="Follow along — scroll the page to the playing section"
          >
            📍
          </button>
        )}
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
