import GroupStreak from "./GroupStreak.jsx";
import GroupLeaderboard from "./GroupLeaderboard.jsx";

// Board tab = group streak hero + member leaderboard. One competitive view.
export default function GroupBoard({ classroomId, token }) {
  return (
    <div className="gv-board-tab">
      <GroupStreak classroomId={classroomId} token={token} />
      <GroupLeaderboard classroomId={classroomId} token={token} />
    </div>
  );
}
