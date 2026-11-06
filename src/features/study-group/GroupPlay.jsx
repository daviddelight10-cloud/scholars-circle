import QuizBattles from "./QuizBattles.jsx";
import GroupBoard from "./GroupBoard.jsx";
import { GroupClanBattles } from "../groups/ClanBattles.jsx";

// Play tab = clan-vs-clan battles on top, then in-group quiz battles,
// streak + leaderboard below.
export default function GroupPlay({ classroomId, token, currentUser, group, members = [], isCaptain, onJoinQuiz }) {
  return (
    <div className="gv-play-tab">
      {group && (
        <GroupClanBattles
          token={token}
          group={group}
          me={currentUser}
          members={members}
          isCaptain={isCaptain}
          onJoinQuiz={onJoinQuiz}
        />
      )}
      <QuizBattles classroomId={classroomId} token={token} currentUser={currentUser} onJoinQuiz={onJoinQuiz} />
      <GroupBoard classroomId={classroomId} token={token} />
    </div>
  );
}
