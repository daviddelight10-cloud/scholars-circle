import { memo } from "react";
import HIcon from "./HIcon.jsx";
import { levelFromXP, xpIntoLevel, XP_PER_LEVEL } from "../../features/streak-survival/survivalStore.js";

function GameBar({ streak, save, firstRun, onOpenShop, onOpenBoard, onOpenStats, onOpenGoal }) {
  const level = levelFromXP(save.xp || 0);
  const xpIn = xpIntoLevel(save.xp || 0);
  return (
    <div className="hm-gamebar">
      <div className="hm-gb-row">
        <span className="hm-pill"><HIcon name="flame" size={12} color="#FF8A3D" /><b>{streak || 0}</b>&nbsp;day{(streak || 0) === 1 ? "" : "s"}</span>
        {(save.freezes || 0) > 0 && (
          <span className="hm-pill hm-freeze" title="Streak Freeze ready">
            <HIcon name="freeze" size={11} /><b>{save.freezes}</b>
          </span>
        )}
        <button className="hm-pill hm-gem" onClick={onOpenShop} title="Open rewards shop">
          <HIcon name="gem" size={12} color="#6EC1FF" /><b>{save.gems || 0}</b>
        </button>
        <span className="hm-gb-sp" />
        <button className="hm-gicon" title="Circle leaderboard" onClick={onOpenBoard}>
          <HIcon name="trophy" size={15} color="#FFC55C" />
        </button>
        <button className="hm-gicon" title="Quick analytics" onClick={onOpenStats}>
          <HIcon name="chart" size={15} />
        </button>
      </div>
      <div className="hm-gb-xp">
        <span className="hm-lvl">LVL {level}</span>
        <div className="hm-xpbar"><i style={{ width: `${Math.min(100, (xpIn / XP_PER_LEVEL) * 100)}%` }} /></div>
        <span className="hm-xptext">{xpIn}/{XP_PER_LEVEL} XP</span>
        <button className="hm-goal" title="Edit daily goal" onClick={onOpenGoal}>
          <HIcon name="target" size={13} />
        </button>
      </div>
      {firstRun && (
        <div className="hm-xp-hint">Review cards and finish cases to earn XP and gems.</div>
      )}
    </div>
  );
}

export default memo(GameBar);
