import QuizBattles from "./QuizBattles.jsx";
import { GroupClanBattles } from "../groups/ClanBattles.jsx";

// Arena tab = clan-vs-clan battles on top, then in-group quiz battles.
// The group's XP board lives on the Board tab now — no duplication.
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
    </div>
  );
}
