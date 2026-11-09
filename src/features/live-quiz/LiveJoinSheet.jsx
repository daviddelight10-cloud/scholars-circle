import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMaterialLives, joinLiveRoom } from "./liveQuizApi.js";
import "./LiveJoinSheet.css";

// "Live on this material" chooser: when someone is already live on the
// material you're about to host, list their session(s) so you can join —
// or host your own independent room anyway.
//
// useMaterialLives(id) — fetch sessions for a material/mcq id (refetch with
// refresh() — e.g. when opening the sheet).
// <LiveJoinSheet> — bottom sheet listing rooms with Join buttons + a
// "Host your own" escape hatch wired to the caller's create flow.

export function useMaterialLives(resourceId) {
  const [lives, setLives] = useState([]);
  const refresh = useCallback(async () => {
    if (!resourceId) { setLives([]); return []; }
    try {
      const rows = await getMaterialLives(resourceId);
      setLives(rows);
      return rows;
    } catch {
      setLives([]);
      return [];
    }
  }, [resourceId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { lives, refresh };
}

export function LiveJoinSheet({ rooms, onClose, onHost }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null); // code being joined | "host"
  const [err, setErr] = useState("");

  const join = async (room) => {
    if (busy) return;
    setBusy(room.code);
    setErr("");
    try {
      const [res] = await Promise.all([
        joinLiveRoom(room.code),
        import("./LiveQuizPage"),
      ]);
      navigate(`/live/${res.code}`, {
        state: { ticket: res.ticket, roomId: res.roomId, returnTo: window.location.pathname },
      });
    } catch (e) {
      setErr(e.message || "Couldn't join that session");
      setBusy(null);
    }
  };

  const host = async () => {
    if (busy) return;
    setBusy("host");
    setErr("");
    try {
      await onHost?.(); // parent navigates on success
    } catch (e) {
      setErr(e.message || "Couldn't start live session");
      setBusy(null);
    }
  };

  return (
    <div className="ljs-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Live on this material">
      <div className="ljs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ljs-grab" />
        <div className="ljs-head">
          <b>Live on this material</b>
          <button className="ljs-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ljs-rooms">
          {rooms.map((r) => (
            <div key={r.code} className="ljs-room">
              <div className="ljs-room-info">
                <div className="ljs-room-host">
                  <span className={`ljs-dot${r.lobby ? "" : " prog"}`} />
                  <b>{r.host}{r.isMember ? " (you)" : ""}</b>
                </div>
                <div className="ljs-room-sub">
                  {r.lobby
                    ? `Lobby · ${r.players}/${r.maxPlayers} players${r.hostConnected ? "" : " · host offline"}`
                    : `In progress · ${r.connected} in room — join to watch`}
                </div>
              </div>
              {r.joinable !== "full" ? (
                <button className="ljs-join" onClick={() => join(r)} disabled={!!busy}>
                  {busy === r.code ? "Joining…" : r.lobby ? "Join" : "Watch"}
                </button>
              ) : (
                <span className="ljs-full">Full</span>
              )}
            </div>
          ))}
          {rooms.length === 0 && <div className="ljs-empty">No live sessions on this material right now.</div>}
        </div>

        {err && <div className="ljs-err">{err}</div>}

        <button className="ljs-host" onClick={host} disabled={!!busy}>
          {busy === "host" ? "Creating…" : "⚡ Host your own live"}
        </button>
      </div>
    </div>
  );
}
