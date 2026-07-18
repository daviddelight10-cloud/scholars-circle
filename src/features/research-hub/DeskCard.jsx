import { memo, useState } from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

const SUBJECT_ICONS = {
  biology: "🧬", chemistry: "⚗️", physics: "🔭", math: "📐", mathematics: "📐",
  english: "📖", history: "🏛️", geography: "🌍", economics: "📈", psychology: "🧠",
  sociology: "👥", political: "⚖️", philosophy: "💭", computer: "💻", engineering: "⚙️",
  medicine: "⚕️", law: "⚖️", business: "💼", accounting: "🧮", finance: "💰",
  marketing: "📢", management: "📋", statistics: "📊", science: "🔬", art: "🎨",
  music: "🎵", language: "🗣️", religion: "🙏", agriculture: "🌾", education: "🎓",
};

function getSubjectIcon(subject) {
  const lower = (subject || "").toLowerCase();
  for (const key of Object.keys(SUBJECT_ICONS)) {
    if (lower.includes(key)) return SUBJECT_ICONS[key];
  }
  return "📚";
}

const TYPE_LABELS = {
  pdf: "📄", mcq: "✎", flashcard_deck: "🎴", note: "📝",
  image: "🖼", docx: "📝", pptx: "📊", txt: "📃", tutorial_question: "❓",
};

const DeskCard = memo(function DeskCard({
  name,
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
}) {
  const [hovered, setHovered] = useState(false);

  const hoverStyle = hovered
    ? { borderColor: colors.borderActive, boxShadow: "0 4px 16px rgba(0,0,0,0.35)", transform: "translateY(-2px)" }
    : {};

  const typeEntries = typeCounts
    ? Object.entries(typeCounts).slice(0, 4).filter(([, c]) => c > 0)
    : [];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...sharedStyles.deskCard, ...hoverStyle }}
    >
      {dueCount > 0 && (
        <div style={{
          position: "absolute", top: spacing.sm, right: spacing.sm,
          fontSize: fontSize.xs, fontWeight: fontWeight.bold, padding: "3px 10px",
          borderRadius: borderRadius.pill, background: "rgba(239,68,68,0.15)",
          color: "#ef4444", border: "0.5px solid rgba(239,68,68,0.35)",
        }}>
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
          style={{
            position: "absolute", top: spacing.sm, right: dueCount > 0 ? "52px" : spacing.sm,
            background: "none", border: "none", cursor: bookmarkBusy ? "wait" : "pointer",
            fontSize: 16, padding: "2px 4px", lineHeight: 1,
            color: isBookmarked ? goldText : colors.textDim,
            opacity: bookmarkBusy ? 0.5 : 1,
            transition: "color 0.15s, transform 0.15s",
            transform: hovered ? "scale(1.15)" : "scale(1)",
          }}
          title={isBookmarked ? "Remove from my space" : "Add to my space"}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: borderRadius.md,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, background: "#1a1a1a", border: `0.5px solid ${colors.border}`,
          flexShrink: 0,
        }}>{icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#e8e8e8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{name}</div>
          {subtitle && (
            <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: spacing.md, marginBottom: spacing.sm }}>
        <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
          <span style={{ fontWeight: fontWeight.bold, color: colors.text }}>{itemCount}</span> items
        </div>
        {masteredCount != null && masteredCount > 0 && (
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
            <span style={{ fontWeight: fontWeight.bold, color: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : colors.textMuted }}>{masteredCount}</span> mastered
          </div>
        )}
      </div>

      {masteryPct != null && masteryPct > 0 && (
        <div style={{ height: 4, background: colors.bg, borderRadius: 2, overflow: "hidden", marginBottom: spacing.sm }}>
          <div style={{
            height: "100%", width: `${masteryPct}%`,
            background: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : goldText,
            borderRadius: 2, transition: "width 0.4s ease",
          }} />
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        {typeEntries.map(([type, count]) => (
          <span key={type} style={{
            fontSize: fontSize.xs, color: colors.textDim,
            display: "flex", alignItems: "center", gap: 3,
          }}>
            {TYPE_LABELS[type] || "📎"} {count}
          </span>
        ))}
        {visibility && (
          <span style={{
            fontSize: fontSize.xs, padding: "2px 8px", borderRadius: borderRadius.sm,
            background: visibility === "private" ? "#1a0808" : colors.successBg,
            color: visibility === "private" ? "#ef9a9a" : "#a5d6a7",
            border: `0.5px solid ${visibility === "private" ? "#4a1010" : colors.successBorder}`,
          }}>
            {visibility === "private" ? "🔒 Private" : visibility === "link" ? "🔗 Link" : "👥 Shared"}
          </span>
        )}
        {shared && ownerName && (
          <span style={{ fontSize: fontSize.xs, color: colors.textDim }}>by {ownerName}</span>
        )}
      </div>
    </div>
  );
});

export function FolderDeskCard({ folder, onClick, isBookmarked, bookmarkBusy, onToggleBookmark, shared }) {
  const itemCount = folder._count?.resources ?? 0;
  return (
    <DeskCard
      name={folder.name}
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
    />
  );
}

export function SubjectDeskCard({ subject, resources, fsrsSubjectStats, onClick }) {
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
      icon={icon}
      subtitle={null}
      itemCount={itemCount}
      typeCounts={typeCounts}
      dueCount={dueCount}
      masteredCount={masteredCount}
      masteryPct={masteryPct}
      onClick={onClick}
    />
  );
}

export function CreateDeckCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const hoverStyle = hovered
    ? { borderColor: goldBorder, background: goldDim }
    : {};

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...sharedStyles.createDeckCard, ...hoverStyle }}
    >
      <div style={{ fontSize: 32 }}>+</div>
      <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>
        Create new space
      </div>
    </div>
  );
}

export default DeskCard;
