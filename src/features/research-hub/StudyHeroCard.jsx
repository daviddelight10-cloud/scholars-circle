import { memo } from "react";

/**
 * Due-today hero (Gizmo-style): soft gradient banner at the top of My Space
 * surfacing the FSRS review queue. Shown only when cards are due.
 */
function StudyHeroCard({ fsrsStats, onStudyNow }) {
  const due = fsrsStats?.dueCount ?? 0;
  const streak = fsrsStats?.streak ?? 0;
  if (!due) return null;

  return (
    <div className="mc-hero">
      <div className="mc-hero-main">
        <div className="mc-hero-title">
          {due} card{due === 1 ? "" : "s"} due today
        </div>
        <div className="mc-hero-sub">
          {streak > 0 ? `🔥 ${streak}-day streak — keep it alive` : "A quick session keeps memory fresh"}
        </div>
      </div>
      <button className="mc-hero-cta" onClick={onStudyNow}>
        Study now
      </button>
    </div>
  );
}

export default memo(StudyHeroCard);
