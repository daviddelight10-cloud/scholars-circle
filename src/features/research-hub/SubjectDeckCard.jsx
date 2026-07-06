import { memo } from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";
import { getSubjectBadgeColor } from "../../lib/researchUtils";

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

const SubjectDeckCard = memo(function SubjectDeckCard({ subject, level, resources, fsrsSubjectStats, onClick }) {
  const badgeColor = getSubjectBadgeColor(subject);
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

  return (
    <div
      onClick={onClick}
      style={{
        ...sharedStyles.card,
        cursor: "pointer",
        padding: spacing.lg,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.borderActive;
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Due badge */}
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

      {/* Icon + subject name */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: borderRadius.md,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, background: badgeColor.bg, border: `0.5px solid ${badgeColor.border}`,
          flexShrink: 0,
        }}>{icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#e8e8e8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{subject}</div>
          {level && (
            <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>{level} Level</div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: spacing.md, marginBottom: spacing.sm }}>
        <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
          <span style={{ fontWeight: fontWeight.bold, color: colors.text }}>{itemCount}</span> items
        </div>
        {fsrsSubjectStats && fsrsSubjectStats.total > 0 && (
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
            <span style={{ fontWeight: fontWeight.bold, color: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : colors.textMuted }}>{masteredCount}</span> mastered
          </div>
        )}
      </div>

      {/* Mastery progress bar */}
      {fsrsSubjectStats && fsrsSubjectStats.total > 0 && (
        <div style={{ height: 4, background: colors.bg, borderRadius: 2, overflow: "hidden", marginBottom: spacing.sm }}>
          <div style={{
            height: "100%", width: `${masteryPct}%`,
            background: masteryPct >= 70 ? "#22c55e" : masteryPct >= 40 ? "#f59e0b" : goldText,
            borderRadius: 2, transition: "width 0.4s ease",
          }} />
        </div>
      )}

      {/* Type breakdown */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {typeEntries.map(([type, count]) => {
          const labels = { pdf: "📄", mcq: "❓", flashcard_deck: "🃏", note: "📝", image: "🖼", docx: "📝", pptx: "📊", txt: "📃", tutorial_question: "❓" };
          return (
            <span key={type} style={{
              fontSize: fontSize.xs, color: colors.textDim,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              {labels[type] || "📎"} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
});

export default SubjectDeckCard;
