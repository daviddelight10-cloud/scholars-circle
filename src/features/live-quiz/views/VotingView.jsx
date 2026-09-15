import { useEffect, useRef, useState } from "react";
import { IconCheck, IconDice, IconLock, IconPie } from "../icons.jsx";
import { sounds } from "../sounds";

export default function VotingView({ room, actions, timeLeft }) {
  const q = room.question;
  const [selected, setSelected] = useState(q.answered?.option || null);
  const [confidence, setConfidence] = useState(q.answered?.confidence || null);
  const locked = !!q.answered;
  const lastTickRef = useRef(null);

  useEffect(() => {
    if (timeLeft != null && timeLeft <= 5 && timeLeft > 0 && timeLeft !== lastTickRef.current) {
      lastTickRef.current = timeLeft;
      sounds.tick();
    }
  }, [timeLeft]);

  if (!q) return null;
  const letters = Object.keys(q.options); // ["A","B","C","D"]

  const lockIn = () => {
    if (!selected || !confidence || locked) return;
    sounds.lock();
    actions.answer(selected, confidence);
  };

  const toggleWager = () => {
    if (locked) return;
    sounds.wager();
    actions.wager(!q.wagerActive);
  };

  return (
    <div className="lq-view">
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span className={`lq-timer-pill${timeLeft != null && timeLeft <= 5 ? " danger" : ""}`}>
          {timeLeft != null ? `${timeLeft}s` : "…"}
        </span>
      </div>

      <div className="lq-vote-info">
        <IconLock size={13} />
        <p style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, margin: 0 }}>Votes hidden until everyone locks in</p>
      </div>
      <p className="lq-vote-status">
        {q.lockedCount} of {q.totalCount} locked in{locked ? "" : " · waiting on you"}
      </p>

      <p className="lq-q-label">{q.qLabel}</p>
      <p className="lq-q-text">{q.question}</p>

      <div className="lq-options">
        {letters.map((letter) => {
          const isSel = selected === letter;
          return (
            <div
              key={letter}
              className={`lq-option${isSel ? " selected" : ""}`}
              onClick={() => !locked && setSelected(letter)}
              role="button"
              aria-pressed={isSel}
            >
              <span className="lq-option-chip">{letter}</span>
              <p className="lq-option-text" style={{ margin: 0 }}>{q.options[letter]}</p>
              {isSel && <IconCheck size={15} style={{ color: "#3B82F6" }} />}
            </div>
          );
        })}
      </div>

      <div className="lq-action-group">
        {q.wagerEligible && !locked && (
          <button className={`lq-wager-btn${q.wagerActive ? " active" : ""}`} onClick={toggleWager}>
            <IconDice size={14} />
            {q.wagerActive ? "Wager active — +30 / −30 XP on this one" : "Double or Nothing — wager 30 XP"}
          </button>
        )}

        <button
          className="lq-lifeline-btn"
          onClick={actions.useLifeline}
          disabled={q.lifelineUsed || locked}
        >
          <IconPie size={14} /> {q.lifelineUsed ? "Lifeline used" : "Ask the Group (−50 coins)"}
        </button>

        {selected && !locked && (
          <div className="lq-confidence">
            <p className="lq-confidence-label">Rate your confidence:</p>
            <div className="lq-confidence-chips">
              {["Low", "Medium", "High"].map((lvl) => (
                <button
                  key={lvl}
                  className={`lq-conf-chip${confidence === lvl ? " selected" : ""}`}
                  onClick={() => setConfidence(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className={`lq-btn-primary${locked ? " loading" : ""}`}
          onClick={lockIn}
          disabled={!selected || !confidence || locked}
        >
          {locked ? "Waiting for reveal…" : "Lock in your answer"}
        </button>
      </div>
    </div>
  );
}
