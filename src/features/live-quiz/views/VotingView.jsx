import { useEffect, useRef, useState } from "react";
import { IconCheck, IconDice, IconLock, IconPie } from "../icons.jsx";
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
  const pending = room.participants.filter((p) => p.connected && !lockedIds.has(p.userId));
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
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span className={`lq-timer-pill${timeLeft != null && timeLeft <= 5 ? " danger" : ""}`}>
          {timeLeft != null ? `${timeLeft}s` : "…"}
        </span>
      </div>

      <div className="lq-vote-info">
        <IconLock size={12} />
        <p style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, margin: 0 }}>Votes hidden until everyone locks in</p>
      </div>
      <p className="lq-vote-status">{q.lockedCount} of {q.totalCount} locked · {waitingText}</p>

      <p className="lq-q-label">{q.qLabel}</p>
      <p className="lq-q-text">{q.question}</p>

      <div className="lq-options">
        {letters.map((letter) => {
          const isSel = selected === letter;
          const mineLocked = locked && q.answered?.option === letter;
          return (
            <div key={letter} className="lq-option-wrap">
              <button
                type="button"
                className={`lq-option${isSel ? " selected" : ""}${locked ? (mineLocked ? " locked" : " dimmed") : ""}`}
                onClick={() => pick(letter)}
                disabled={locked}
                aria-pressed={isSel}
              >
                <span className="lq-option-chip">{letter}</span>
                <p className="lq-option-text" style={{ margin: 0 }}>{q.options[letter]}</p>
                {mineLocked && <IconCheck size={15} style={{ color: "#3DD68C" }} />}
                {isSel && !locked && <IconCheck size={15} style={{ color: "#3B82F6" }} />}
              </button>
              {isSel && !locked && (
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

      <p className="lq-kbd-hint">Pick an answer, then tap a confidence to lock — keys 1-4, then L·M·H</p>

      <div className="lq-action-group">
        {q.wagerEligible && !locked && (
          <button className={`lq-wager-btn${q.wagerActive ? " active" : ""}`} onClick={toggleWager}>
            <IconDice size={14} />
            {q.wagerActive ? "Wager active — +30 / −30 XP on this one" : "Double or Nothing — wager 30 XP"}
          </button>
        )}

        {!locked && (
          <button
            className="lq-lifeline-btn"
            onClick={useLifeline}
            disabled={q.lifelineUsed || (q.lockedCount || 0) === 0}
            title={(q.lockedCount || 0) === 0 ? "Unlocks once someone locks an answer" : undefined}
          >
            <IconPie size={14} /> {q.lifelineUsed ? "Lifeline used" : `Ask the Group · −${LIFELINE_GEMS} 💎`}
          </button>
        )}
        {gemNote && <p className="lq-gem-note">{gemNote}</p>}

        {room.isHost && !locked && (
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
