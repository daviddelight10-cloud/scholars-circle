import { memo } from "react";
import { getSubjectColor, getSubjectIcon } from "./subjectColors";

const SubjectDeckCard = memo(function SubjectDeckCard({ subject, level, resources, fsrsSubjectStats, onClick, index = 0 }) {
  const sc = getSubjectColor(subject);
  const icon = getSubjectIcon(subject);
  const itemCount = resources.length;
  const dueCount = fsrsSubjectStats?.due || 0;
  const masteredCount = fsrsSubjectStats?.mastered || 0;
  const masteryPct = fsrsSubjectStats && fsrsSubjectStats.total > 0
    ? Math.round((masteredCount / fsrsSubjectStats.total) * 100)
    : 0;

  const typeCounts = resources.reduce((acc, r) => {
    const t = r.contentType || "note";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const typeEntries = Object.entries(typeCounts).slice(0, 3);
  const delay = `${Math.min(index * 40, 400)}ms`;

  return (
    <div
      onClick={onClick}
      className="stagger-in relative cursor-pointer overflow-hidden rounded-xl border border-hub-border bg-hub-surface p-4 transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 hover:border-hub-border-active"
      style={{ borderLeftWidth: "3px", borderLeftColor: sc.accent, animationDelay: delay }}
    >
      {dueCount > 0 && (
        <div className="due-pulse absolute right-2 top-2 rounded-full border border-coral-300 bg-coral-100 px-2.5 py-0.5 text-[10px] font-bold text-coral-400">
          {dueCount} due
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-2xl"
          style={{ background: sc.bg, borderColor: sc.border }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-hub-text">{subject}</div>
          {level && (
            <div className="mt-0.5 text-[11px] text-hub-text-dim">{level} Level</div>
          )}
        </div>
      </div>

      <div className="mb-1 flex gap-4">
        <div className="text-[11px] text-hub-text-muted">
          <span className="font-bold text-hub-text">{itemCount}</span> items
        </div>
        {fsrsSubjectStats && fsrsSubjectStats.total > 0 && (
          <div className="text-[11px] text-hub-text-muted">
            <span
              className="font-bold"
              style={{ color: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : "#888" }}
            >
              {masteredCount}
            </span>{" "}
            mastered
          </div>
        )}
      </div>

      {fsrsSubjectStats && fsrsSubjectStats.total > 0 && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-hub-bg">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${masteryPct}%`,
              background: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : "#FFD700",
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {typeEntries.map(([type, count]) => {
          const labels = { pdf: "📄", mcq: "❓", flashcard_deck: "🃏", note: "📝", image: "🖼", docx: "📝", pptx: "📊", txt: "📃", tutorial_question: "❓" };
          return (
            <span key={type} className="flex items-center gap-1 text-[10px] text-hub-text-dim">
              {labels[type] || "📎"} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
});

export default SubjectDeckCard;
