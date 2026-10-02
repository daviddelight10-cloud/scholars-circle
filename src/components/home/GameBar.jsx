import { memo } from "react";
import HIcon from "./HIcon.jsx";
import { freeTierPhase, trialDaysLeft } from "../../lib/freeTier.js";

function GameBar({ streak, save, onOpenShop, onOpenBoard, onOpenStats }) {
  const phase = freeTierPhase(); // 'trial' | 'free' | null (paid)
  const daysLeft = phase === "trial" ? trialDaysLeft() : 0;
  return (
    <div className="hm-gamebar">
      <div className="hm-gb-row">
        <span className="hm-chip" title="Day streak">
          <HIcon name="flame" size={12} color="#FF8A3D" /><b>{streak || 0}</b>
        </span>
        {save.freezes > 0 && (
          <span className="hm-chip hm-freeze" title="Streak freezes">
            <HIcon name="freeze" size={11} /><b>{save.freezes}</b>
          </span>
        )}
        {phase === "trial" && (
          <button
            className="hm-pill hm-trial"
            title="Free trial — tap to upgrade"
            onClick={() => window.dispatchEvent(new CustomEvent("sc-open-premium"))}
          >
            ⏳<b>{daysLeft}d</b> trial
          </button>
        )}
        {phase === "free" && (
          <button
            className="hm-pill hm-free"
            title="Free plan — tap to upgrade"
            onClick={() => window.dispatchEvent(new CustomEvent("sc-open-premium"))}
          >
            💎 Free
          </button>
        )}
        <span className="hm-gb-sp" />
        <button className="hm-pill hm-gem" onClick={onOpenShop} title="Open rewards shop">
          <HIcon name="gem" size={12} color="#6EC1FF" /><b>{save.gems || 0}</b>
        </button>
        <button className="hm-gicon" title="Circle leaderboard" onClick={onOpenBoard}>
          <HIcon name="trophy" size={15} color="#FFC55C" />
        </button>
        <button className="hm-gicon" title="Quick analytics" onClick={onOpenStats}>
          <HIcon name="chart" size={15} />
        </button>
      </div>
    </div>
  );
}

export default memo(GameBar);
