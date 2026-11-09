import { useState } from "react";
import AvatarMark from "../../components/AvatarMark.jsx";
import { IconTrophy, IconX } from "./icons.jsx";

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Ava({ p, size = 26 }) {
  return (
    <span className="lq-board-ava" style={{ width: size, height: size, background: p.avatar ? "transparent" : p.color }}>
      {p.avatar ? <AvatarMark avatar={p.avatar} name={p.username} size={size} /> : initials(p.username)}
    </span>
  );
}

// Ranked active players (spectators and a presenting host don't score).
export function rankPlayers(room) {
  return room.participants
    .filter((p) => !p.spectator && !(p.isHost && room.presenterMode))
    .map((p) => ({ ...p, points: p.points || 0 }))
    .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username))
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// Top-3 strip + "you" chip for big rooms, where a per-person avatar rail is
// unreadable. Tapping opens the full ranked board.
export function ScoreStrip({ room, myId }) {
  const [open, setOpen] = useState(false);
  const ranked = rankPlayers(room);
  const top = ranked.slice(0, 3);
  const me = ranked.find((p) => p.userId === myId);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <>
      <button className="lq-scorestrip" onClick={() => setOpen(true)} aria-label="Open full scoreboard">
        <span className="lq-scorestrip-top">
          {top.map((p, i) => (
            <span key={p.userId} className="lq-scorestrip-item">
              <span>{medals[i]}</span>
              <Ava p={p} size={22} />
              <b>{p.points}</b>
            </span>
          ))}
        </span>
        {me && (
          <span className="lq-scorestrip-me">
            You #{me.rank} · <b>{me.points}</b>
          </span>
        )}
        <IconTrophy size={14} />
      </button>
      {open && <BoardDrawer ranked={ranked} myId={myId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function BoardDrawer({ ranked, myId, onClose }) {
  return (
    <div className="lq-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Scoreboard">
      <div className="lq-sheet lq-board-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="lq-sheet-grab" />
        <div className="lq-board-head">
          <p className="lq-sheet-title">Scoreboard</p>
          <button className="lq-icon-btn" onClick={onClose} aria-label="Close"><IconX size={16} /></button>
        </div>
        <div className="lq-board-list">
          {ranked.map((p) => (
            <div key={p.userId} className={`lq-board-row${p.userId === myId ? " me" : ""}`}>
              <span className="lq-board-rank">{p.rank}</span>
              <Ava p={p} size={30} />
              <span className="lq-board-name">{p.username}{p.userId === myId ? " (You)" : ""}</span>
              <b className="lq-board-pts">{p.points}</b>
            </div>
          ))}
          {ranked.length === 0 && <p className="lq-sheet-body">No players yet.</p>}
        </div>
      </div>
    </div>
  );
}
