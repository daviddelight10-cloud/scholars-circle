import { useEffect, useRef, useState } from "react";
import { IconCheck, IconDice, IconLock, IconPause, IconPie, IconPlay } from "../icons.jsx";
import { sounds } from "../sounds";
import { addGems, loadSave, trySpendGems } from "../../streak-survival/survivalStore";

const LIFELINE_GEMS = 10;
const KEY_TO_LETTER = { "1": "A", "2": "B", "3": "C", "4": "D", a: "A", b: "B", c: "C", d: "D" };
const KEY_TO_CONF = { l: "Low", m: "Medium", h: "High" };

function buzz(ms) {
  try { navigator.vibrate?.(ms); } catch {}
}

export default function VotingView({ room, actions, timeLeft, myId }) {
  const q = room.question;
  const [selected, setSelected] = useState(q?.answered?.option || null);
  const [gemNote, setGemNote] = useState(null);
  const locked = !!q.answered;
  const isPresenter = room.isHost && room.presenterMode;
  const isSpectator = !!room.mySpectator;
  const observing = isPresenter || isSpectator; // non-interactive variants
  const lastTickRef = useRef(null);
  // A gem spend is in flight until the server answers — refund exactly once on denial.
  const pendingSpendRef = useRef(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (timeLeft != null && timeLeft <= 5 && timeLeft > 0 && timeLeft !== lastTickRef.current) {
      lastTickRef.current = timeLeft;
      sounds.tick();
    }
  }, [timeLeft]);

  // Server verdict on the lifeline → settle or refund the pending gem spend.
  useEffect(() => {
    if (!room.poll || !pendingSpendRef.current) return;
    pendingSpendRef.current = false;
    if (room.poll.denied) {
      addGems(LIFELINE_GEMS);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGemNote(room.poll.denied);
    }
  }, [room.poll]);

  useEffect(() => () => { if (pendingSpendRef.current) { pendingSpendRef.current = false; addGems(LIFELINE_GEMS); } }, []);

  // Keyboard play: 1-4/A-D picks an option, L·M·H then locks that confidence.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (lockedRef.current) return;
      if (!selectedRef.current && KEY_TO_LETTER[k]) {
        e.preventDefault();
        pick(KEY_TO_LETTER[k]);
      } else if (selectedRef.current && KEY_TO_CONF[k]) {
        e.preventDefault();
        lockWith(KEY_TO_CONF[k]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!q) return null;
  const letters = Object.keys(q.options); // ["A","B","C","D"]
  const lockedIds = new Set(q.lockedIds || []);
  const pending = room.participants.filter((p) => p.connected && !p.spectator && !lockedIds.has(p.userId) && !(p.isHost && room.presenterMode));
  const pendingNames = pending.filter((p) => p.userId !== myId).map((p) => p.username).slice(0, 2);
  const waitingText = pending.length === 0
    ? "Everyone's in!"
    : pendingNames.length
      ? `waiting on ${pendingNames.join(" & ")}${pending.length - pendingNames.length > 1 ? ` +${pending.length - pendingNames.length}` : ""}`
      : "waiting on you";

  function pick(letter) {
    if (lockedRef.current) return;
    setSelected(letter);
    buzz(10);
  }

  function lockWith(conf) {
    const opt = selectedRef.current;
    if (!opt || lockedRef.current) return;
    sounds.lock();
    buzz(30);
    actions.answer(opt, conf);
  }

  const toggleWager = () => {
    if (locked) return;
    sounds.wager();
    actions.wager(!q.wagerActive);
  };

  const useLifeline = () => {
    if (q.lifelineUsed || locked || (q.lockedCount || 0) === 0) return;
    if (!trySpendGems(LIFELINE_GEMS)) {
      setGemNote(`Not enough 💎 — you have ${loadSave()?.gems ?? 0}. Earn more in Streak Survival.`);
      return;
    }
    pendingSpendRef.current = true;
    actions.useLifeline();
  };

  return (
    <div className="lq-view">
      {isSpectator && (
        <div className="lq-spec-banner" role="status">
          <div className="lq-spec-text">
            <b>You're watching</b>
            <span>Join the game from this moment — your score starts at 0.</span>
          </div>
          <button className="lq-spec-join" onClick={actions.spectatorJoin}>Join the game</button>
        </div>
      )}
      {isPresenter && (
        <div className="lq-pres-banner" role="status">
          <div className="lq-spec-text">
            <b>Presenting</b>
            <span>{room.paused ? "Timer paused — resume when you're ready." : "You see the room's answers as they lock in. You're not playing."}</span>
          </div>
          <button
            className={`lq-pres-pause${room.paused ? " on" : ""}`}
            onClick={() => (room.paused ? actions.resume() : actions.pause())}
          >
            {room.paused ? <><IconPlay size={14} /> Resume</> : <><IconPause size={14} /> Pause</>}
          </button>
        </div>
      )}
      <div className="lq-lockstrip" role="status">
        <div className="lq-lockstrip-bar"><span style={{ width: `${q.totalCount ? Math.round((q.lockedCount / q.totalCount) * 100) : 0}%` }} /></div>
        <p className="lq-lockstrip-text">
          <IconLock size={11} /> {q.lockedCount}/{q.totalCount} locked · {isPresenter || isSpectator ? `${pending.length} still voting` : waitingText}
        </p>
      </div>

      <p className="lq-q-label">{q.qLabel}</p>
      <p className="lq-q-text">{q.question}</p>

      {!observing && !locked && room.talkedThrough === 0 && (
        <p className="lq-first-hint">Pick an answer, then tap how sure you are — that locks it in.</p>
      )}

      <div className="lq-options">
        {letters.map((letter) => {
          const isSel = selected === letter;
          const mineLocked = locked && q.answered?.option === letter;
          const tallyCount = room.hostTally?.tally?.[letter] || 0;
          const tallyTotal = room.hostTally?.locked || 0;
          const tallyPct = tallyTotal > 0 ? Math.round((tallyCount / tallyTotal) * 100) : 0;
          return (
            <div key={letter} className="lq-option-wrap">
              <button
                type="button"
                className={`lq-option${isSel ? " selected" : ""}${locked ? (mineLocked ? " locked" : " dimmed") : ""}`}
                onClick={() => pick(letter)}
                disabled={locked || observing}
                aria-pressed={isSel}
              >
                <span className="lq-option-chip">{letter}</span>
                <p className="lq-option-text" style={{ margin: 0 }}>{q.options[letter]}</p>
                {mineLocked && <IconCheck size={15} style={{ color: "#3DD68C" }} />}
                {isSel && !locked && <IconCheck size={15} style={{ color: "#3B82F6" }} />}
                {isPresenter && (
                  <span className="lq-option-tally">
                    <span className="lq-tally-bar" style={{ width: `${tallyPct}%` }} />
                    <span className="lq-tally-count">{tallyCount > 0 ? `${tallyCount} · ${tallyPct}%` : ""}</span>
                  </span>
                )}
              </button>
              {isSel && !locked && !observing && (
                <div className="lq-conf-inline" role="group" aria-label="Confidence — tap to lock your answer">
                  <span className="lq-conf-inline-label">Sure?</span>
                  {["Low", "Medium", "High"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`lq-conf-chip lq-conf-${lvl.toLowerCase()}`}
                      onClick={() => lockWith(lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="lq-kbd-hint">
        {observing
          ? isPresenter ? "Answers lock in live — pause any time to discuss" : "Spectators can chat and react while watching"
          : "Pick an answer, then tap a confidence to lock — keys 1-4, then L·M·H"}
      </p>

      <div className="lq-action-group">
        {!observing && !locked && (
          <div className="lq-powerups" role="group" aria-label="Power-ups">
            {q.wagerEligible && (
              <button className={`lq-wager-btn${q.wagerActive ? " active" : ""}`} onClick={toggleWager} title="Wager 30 XP: +30 if right, −30 if wrong">
                <IconDice size={14} />
                {q.wagerActive ? "Wager on · ±30 XP" : "Double or nothing"}
              </button>
            )}
            <button
              className="lq-lifeline-btn"
              onClick={useLifeline}
              disabled={q.lifelineUsed || (q.lockedCount || 0) === 0}
              title={(q.lockedCount || 0) === 0 ? "Unlocks once someone locks an answer" : "See how the group voted"}
            >
              <IconPie size={14} /> {q.lifelineUsed ? "Lifeline used" : `Ask group · ${LIFELINE_GEMS} 💎`}
            </button>
          </div>
        )}
        {gemNote && <p className="lq-gem-note">{gemNote}</p>}

        {isPresenter && (
          <button className="lq-reveal-now" onClick={actions.forceReveal}>
            Reveal now
          </button>
        )}

        {locked && (
          <p className="lq-locked-note">
            <IconCheck size={13} /> Locked — {waitingText === "waiting on you" ? "waiting for the group" : waitingText}
          </p>
        )}
      </div>
    </div>
  );
}
