import { memo, useMemo } from "react";
import { createPortal } from "react-dom";
import HIcon from "./HIcon.jsx";
import { weekStrip } from "../../hooks/useStreakMoment.js";
import { useUI } from "../../contexts/UIContext.jsx";
import { useState, useEffect } from "react";

// Streak detail sheet — opened from the GameBar flame chip. Shows the 7-day
// strip, longest run, freeze inventory and the "how it works" explainer.
function StreakSheet({ open, onClose, streak, longestStreak, freezes, save, onBuyFreeze }) {
  const { setMobileNavHidden } = useUI();
  const [shown, setShown] = useState(false);
  const days = useMemo(() => weekStrip(streak), [streak]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => { cancelAnimationFrame(raf); setShown(false); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMobileNavHidden(true);
    return () => setMobileNavHidden(false);
  }, [open, setMobileNavHidden]);

  if (!open) return null;
  const gems = save?.gems || 0;
  const canAfford = gems >= 15 && (freezes || 0) < 3;

  return createPortal(
    <>
      <div className={`hm-sheet-backdrop${shown ? " show" : ""}`} onClick={onClose} />
      <div className={`hm-sheet hm-ss${shown ? " show" : ""}`} role="dialog" aria-label="Streak details">
        <div className="hm-sh-handle" />
        <div className="hm-ss-hero">
          <HIcon name="flame" size={34} color="#FF8A3D" />
          <div className="hm-ss-num">{streak || 0}</div>
          <div className="hm-ss-cap">day streak · best {longestStreak || streak || 0}</div>
        </div>

        <div className="hm-sm-week">
          {days.map((d) => (
            <span key={d.key} className={`hm-sm-day${d.lit ? " lit" : ""}${d.today ? " today" : ""}`}>
              {d.today ? <HIcon name="flame" size={12} color="#FF8A3D" /> : d.letter}
            </span>
          ))}
        </div>
        <p className="hm-ss-hint">Open Scholars Circle any day — reading, a summary or an exam all keep the flame lit.</p>

        <div className="hm-sh-row">
          <div className="hm-sh-ic" style={{ background: "rgba(124,199,255,.1)", color: "#7CC7FF" }}>
            <HIcon name="freeze" size={18} />
          </div>
          <div className="hm-sh-info">
            <h4>Streak Freeze {(freezes || 0) > 0 && <span className="hm-own-tag">owns {freezes}/3</span>}</h4>
            <p>Miss a day without losing your streak. Auto-used when needed.</p>
          </div>
          <button
            className={`hm-sh-buy${canAfford ? "" : " cant"}`}
            onClick={canAfford ? onBuyFreeze : undefined}
            title={(freezes || 0) >= 3 ? "Max 3 freezes" : canAfford ? "Buy for 15 gems" : "Not enough gems"}
          >
            <HIcon name="gem" size={12} />15
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default memo(StreakSheet);
