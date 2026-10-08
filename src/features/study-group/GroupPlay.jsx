import QuizBattles from "./QuizBattles.jsx";
import GroupBoard from "./GroupBoard.jsx";

// Play tab = quiz battles on top, streak + leaderboard below.
// One competitive view — battles are the action, the board is the score.
export default function GroupPlay({ classroomId, token, currentUser, onJoinQuiz }) {
  return (
    <div className="gv-play-tab">
      <QuizBattles classroomId={classroomId} token={token} currentUser={currentUser} onJoinQuiz={onJoinQuiz} />
      <GroupBoard classroomId={classroomId} token={token} />
    </div>
  );
}
