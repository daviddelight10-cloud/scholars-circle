import { memo, useState } from "react";
import { getSubjectColor, getSubjectIcon } from "./subjectColors";

const TYPE_LABELS = {
  pdf: "📄", mcq: "✎", flashcard_deck: "🎴", note: "📝",
  image: "🖼", docx: "📝", pptx: "📊", txt: "📃", tutorial_question: "❓",
};

const DeskCard = memo(function DeskCard({
  name,
  subject,
  icon,
  subtitle,
  itemCount,
  typeCounts,
  dueCount,
  masteredCount,
  masteryPct,
  visibility,
  shared,
  ownerName,
  onClick,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  folderId,
  index = 0,
}) {
  const [hovered, setHovered] = useState(false);
  const sc = getSubjectColor(subject || name);
  const delay = `${Math.min(index * 40, 400)}ms`;

  const typeEntries = typeCounts
    ? Object.entries(typeCounts).slice(0, 4).filter(([, c]) => c > 0)
    : [];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="stagger-in relative cursor-pointer overflow-hidden rounded-xl border border-hub-border bg-hub-surface p-4 transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 hover:border-hub-border-active"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: sc.accent,
        animationDelay: delay,
        boxShadow: hovered ? `0 4px 20px ${sc.bg}` : undefined,
      }}
    >
      {dueCount > 0 && (
        <div className="due-pulse absolute right-2 top-2 rounded-full border border-coral-300 bg-coral-100 px-2.5 py-0.5 text-[10px] font-bold text-coral-400">
          {dueCount} due
        </div>
      )}

      {onToggleBookmark && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!bookmarkBusy) onToggleBookmark({ id: folderId, name, _count: { resources: itemCount } });
          }}
          disabled={bookmarkBusy}
          className="absolute top-2 transition-all duration-150"
          style={{
            right: dueCount > 0 ? "52px" : "8px",
            background: "none",
            border: "none",
            cursor: bookmarkBusy ? "wait" : "pointer",
            fontSize: 16,
            padding: "2px 4px",
            lineHeight: 1,
            color: isBookmarked ? "#FFD700" : "#555",
            opacity: bookmarkBusy ? 0.5 : 1,
            transform: hovered ? "scale(1.15)" : "scale(1)",
          }}
          title={isBookmarked ? "Remove from my space" : "Add to my space"}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
      )}

      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-2xl"
          style={{ background: sc.bg, borderColor: sc.border }}
        >
          {icon || sc.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-hub-text">{name}</div>
          {subtitle && (
            <div className="mt-0.5 text-[11px] text-hub-text-dim">{subtitle}</div>
          )}
        </div>
      </div>

      <div className="mb-1 flex gap-4">
        <div className="text-[11px] text-hub-text-muted">
          <span className="font-bold text-hub-text">{itemCount}</span> items
        </div>
        {masteredCount != null && masteredCount > 0 && (
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

      {masteryPct != null && masteryPct > 0 && (
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

      <div className="flex flex-wrap items-center gap-1.5">
        {typeEntries.map(([type, count]) => (
          <span key={type} className="flex items-center gap-1 text-[10px] text-hub-text-dim">
            {TYPE_LABELS[type] || "📎"} {count}
          </span>
        ))}
        {visibility && (
          <span
            className="rounded px-2 py-0.5 text-[10px]"
            style={{
              background: visibility === "private" ? "#1a0808" : "#0f2a1a",
              color: visibility === "private" ? "#ef9a9a" : "#a5d6a7",
              border: `0.5px solid ${visibility === "private" ? "#4a1010" : "#2a6a3a"}`,
            }}
          >
            {visibility === "private" ? "🔒 Private" : visibility === "link" ? "🔗 Link" : "👥 Shared"}
          </span>
        )}
        {shared && ownerName && (
          <span className="text-[10px] text-hub-text-dim">by {ownerName}</span>
        )}
      </div>
    </div>
  );
});

export function FolderDeskCard({ folder, onClick, isBookmarked, bookmarkBusy, onToggleBookmark, shared, index }) {
  const itemCount = folder._count?.resources ?? 0;
  const subjectHint = folder.courseCode || folder.name || "";
  return (
    <DeskCard
      name={folder.name}
      subject={subjectHint}
      icon={folder.visibility === "shared" || folder.visibility === "link" ? "📂" : "📁"}
      subtitle={folder.courseCode || null}
      itemCount={itemCount}
      typeCounts={null}
      visibility={folder.visibility}
      shared={shared || folder.ownerId !== folder.owner?.id}
      ownerName={folder.owner?.username}
      onClick={onClick}
      isBookmarked={isBookmarked}
      bookmarkBusy={bookmarkBusy}
      onToggleBookmark={onToggleBookmark}
      folderId={folder.id}
      index={index}
    />
  );
}

export function SubjectDeskCard({ subject, resources, fsrsSubjectStats, onClick, index }) {
  const sc = getSubjectColor(subject);
  const icon = getSubjectIcon(subject);
  const itemCount = resources.length;
  const dueCount = fsrsSubjectStats?.due || 0;
  const masteredCount = fsrsSubjectStats?.mastered || 0;
  const masteryPct = fsrsSubjectStats && fsrsSubjectStats.total > 0
    ? Math.round((masteredCount / fsrsSubjectStats.total) * 100)
    : null;

  const typeCounts = resources.reduce((acc, r) => {
    const t = r.contentType || "note";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <DeskCard
      name={subject}
      subject={subject}
      icon={icon}
      subtitle={null}
      itemCount={itemCount}
      typeCounts={typeCounts}
      dueCount={dueCount}
      masteredCount={masteredCount}
      masteryPct={masteryPct}
      onClick={onClick}
      index={index}
    />
  );
}

export function CreateDeckCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="stagger-in flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hub-border p-6 transition-all duration-150 active:scale-[0.97]"
      style={{
        borderColor: hovered ? "rgba(255,215,0,0.35)" : undefined,
        background: hovered ? "rgba(255,215,0,0.08)" : "transparent",
      }}
    >
      <div className="text-3xl" style={{ color: hovered ? "#FFD700" : "#555", transition: "color 0.15s" }}>+</div>
      <div className="text-[11px] font-semibold text-hub-text-muted">Create new space</div>
    </div>
  );
}

export default DeskCard;
