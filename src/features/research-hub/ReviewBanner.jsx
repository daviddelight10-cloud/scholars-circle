import { colors, spacing, fontSize, fontWeight, borderRadius, goldDim, goldBorder, goldText } from "./constants";

export default function ReviewBanner({ reviewData, reviewStats, onReview }) {
  if (!reviewData || reviewData.total === 0) return null;
  const dueCount = reviewData.due.length;
  const avgEF = reviewStats?.avgEasinessFactor;
  const mastered = reviewStats?.masteredCount;

  return (
    <div style={{
      background: dueCount > 0 ? "linear-gradient(135deg, #1a1a00, #0d0d00)" : colors.surface,
      border: dueCount > 0 ? `0.5px solid ${goldBorder}` : `0.5px solid ${colors.border}`,
      borderRadius: borderRadius.lg, padding: `${spacing.md} ${spacing.lg}`, marginBottom: spacing.lg,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap",
      boxShadow: dueCount > 0 ? "0 2px 12px rgba(255,215,0,0.1)" : "none",
    }}>
      <div>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: dueCount > 0 ? goldText : colors.textMuted }}>
          {dueCount > 0 ? `📚 ${dueCount} question${dueCount > 1 ? "s" : ""} due for review` : `📅 ${reviewData.total} question${reviewData.total > 1 ? "s" : ""} in review queue`}
        </div>
        <div style={{ fontSize: fontSize.sm, color: colors.textDim, marginTop: "2px" }}>
          {dueCount > 0 ? "SM-2 spaced repetition — review now while it's fresh" : "Upcoming reviews — we'll remind you when they're due"}
          {avgEF != null && <span style={{ marginLeft: spacing.sm, color: "#555" }}>EF: {avgEF}</span>}
          {mastered != null && mastered > 0 && <span style={{ marginLeft: spacing.sm, color: colors.success }}>✓ {mastered} mastered</span>}
        </div>
      </div>
      <button onClick={onReview} style={{
        padding: "8px 18px", borderRadius: borderRadius.pill,
        background: dueCount > 0 ? goldDim : "#111",
        border: dueCount > 0 ? `0.5px solid ${goldBorder}` : `0.5px solid ${colors.border}`,
        fontSize: fontSize.sm, fontWeight: fontWeight.bold,
        color: dueCount > 0 ? goldText : colors.textMuted, cursor: "pointer",
      }}>
        {dueCount > 0 ? "Review now →" : "Practice early"}
      </button>
    </div>
  );
}
