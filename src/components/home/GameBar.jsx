import { memo } from "react";
import HIcon from "./HIcon.jsx";

function GameBar({ save, onOpenShop, onOpenBoard, onOpenStats }) {
  return (
    <div className="hm-gamebar">
      <div className="hm-gb-row">
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
