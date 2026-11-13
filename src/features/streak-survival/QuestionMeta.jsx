import { memo } from "react";
import "./streakSurvival.css";

const DIFF = { easy: [1, "Easy"], medium: [2, "Medium"], hard: [3, "Hard"] };
const TYPE = { recall: "Recall", applied: "Applied", vignette: "Clinical case" };

// Topic chip + 3-dot difficulty meter (+ optional question type).
// Accepts a normalized question (_qTopic/_qDiff/_qType) or raw mcq fields.
// Renders nothing for questions without metadata, so older decks are unchanged.
function QuestionMeta({ q, showType = true, className = "" }) {
  const topic = q?._qTopic ?? q?.topic ?? null;
  const diff = q?._qDiff ?? (DIFF[q?.difficulty] ? q.difficulty : null);
  const type = q?._qType ?? q?.qtype ?? null;
  const isTf = (q?._qFormat ?? q?.format) === "tf";
  if (!topic && !diff && !isTf && !(showType && type)) return null;
  const [n, label] = DIFF[diff] || [0, ""];
  return (
    <span className={`qm ${className}`}>
      {topic && <span className="qm-topic" title={topic}>{topic}</span>}
      {diff && (
        <span className={`qm-diff qm-${diff}`} role="img" aria-label={`Difficulty: ${label}`} title={label}>
          {[1, 2, 3].map((d) => <i key={d} className={d <= n ? "on" : ""} />)}
          <span className="qm-diff-l">{label}</span>
        </span>
      )}
      {isTf && <span className="qm-type">True/False</span>}
      {showType && type && TYPE[type] && <span className="qm-type">{TYPE[type]}</span>}
    </span>
  );
}

export default memo(QuestionMeta);
