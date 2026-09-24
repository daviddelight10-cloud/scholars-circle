import { memo } from "react";
import HIcon from "./HIcon.jsx";

function GameBar({ streak, save, onOpenShop, onOpenBoard, onOpenStats }) {
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
