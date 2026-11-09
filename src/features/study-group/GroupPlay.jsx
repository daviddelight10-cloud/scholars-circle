import { useState } from "react";
import QuizBattles from "./QuizBattles.jsx";
import { GroupClanBattles } from "../groups/ClanBattles.jsx";
import { FdSheet } from "../feed/feedUi.jsx";

// Play tab = one place to start something. "Live quiz" is a session with your
// own group; "Clan battle" pits your group against another group. The two
// lists below share a single Start button instead of two competing heroes.
export default function GroupPlay({ classroomId, token, currentUser, group, members = [], isCaptain, onJoinQuiz }) {
  const [chooser, setChooser] = useState(false);
  const [quizSignal, setQuizSignal] = useState(0);
  const [challengeSignal, setChallengeSignal] = useState(0);

  return (
    <div className="gv-play-tab">
      <div className="gv-battles-hero">
        <div className="gv-battles-hero-text">
          <b>Play together</b>
          <span>Run a live quiz with your group, or challenge another clan.</span>
        </div>
        <button className="fd-go-btn" onClick={() => setChooser(true)}>⚡ Start</button>
      </div>

      <QuizBattles
        classroomId={classroomId}
        token={token}
        currentUser={currentUser}
        onJoinQuiz={onJoinQuiz}
        hideHero
        startSignal={quizSignal}
      />
      {group && (
        <GroupClanBattles
          token={token}
          group={group}
          me={currentUser}
          members={members}
          isCaptain={isCaptain}
          onJoinQuiz={onJoinQuiz}
          hideHero
          challengeSignal={challengeSignal}
        />
      )}

      {chooser && (
        <FdSheet title="Start something" onClose={() => setChooser(false)}>
          <div className="gv-add-rows">
            <button className="gv-add-row create" onClick={() => { setChooser(false); setQuizSignal((n) => n + 1); }}>
              ⚡ Live quiz with the group
            </button>
            <button
              className="gv-add-row join"
              disabled={!isCaptain}
              onClick={() => { setChooser(false); setChallengeSignal((n) => n + 1); }}
            >
              ⚔️ Challenge another clan{!isCaptain ? " (captains only)" : ""}
            </button>
          </div>
        </FdSheet>
      )}
    </div>
  );
}
