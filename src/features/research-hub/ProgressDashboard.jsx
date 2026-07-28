import { colors, spacing, fontSize, fontWeight, sharedStyles, goldText } from "./constants";

export default function ProgressDashboard({ progressData, reviewCount, reviewStats }) {
  if (!progressData) return <div style={sharedStyles.emptyState}>Loading progress...</div>;

  const streak = reviewStats?.streak ?? 0;
  const longestStreak = reviewStats?.longestStreak ?? 0;
  const avgEF = reviewStats?.avgEasinessFactor ?? 2.5;
  const mastered = reviewStats?.masteredCount ?? 0;
  const dueCount = reviewStats?.dueCount ?? 0;

  return (
    <div>
      <div style={{ display: "flex", gap: spacing.md, marginBottom: spacing.xxl, flexWrap: "wrap" }}>
        <div style={sharedStyles.statPill}>
          <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: goldText }}>{progressData.totalXp}</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>Total XP</div>
        </div>
        <div style={sharedStyles.statPill}>
          <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: goldText }}>Lv {progressData.level}</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>Level</div>
        </div>
        <div style={sharedStyles.statPill}>
          <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: "#ff7043" }}>🔥 {streak}</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>Day Streak{longestStreak > streak ? ` (best: ${longestStreak})` : ""}</div>
        </div>
        <div style={sharedStyles.statPill}>
          <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.danger }}>{reviewCount}</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>Review Queue{dueCount > 0 ? ` (${dueCount} due)` : ""}</div>
        </div>
        <div style={sharedStyles.statPill}>
          <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.success }}>{mastered}</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>SM-2 Mastered</div>
        </div>
        <div style={sharedStyles.statPill}>
          <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: "#888" }}>{avgEF}</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>Avg Easiness</div>
        </div>
      </div>

      <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.md }}>Subject Mastery</div>
      {progressData.subjects.length === 0 ? (
        <div style={sharedStyles.emptyState}>
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>📊</div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>No quiz attempts yet</div>
          <div style={{ fontSize: fontSize.base, color: colors.textDim }}>Take an MCQ to see your progress here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {progressData.subjects.map((s) => (
            <div key={s.subject} style={{
              background: colors.surface, border: `0.5px solid ${colors.border}`,
              borderRadius: 10, padding: spacing.md,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
                <span style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: "#e8e8e8" }}>{s.subject}</span>
                <span style={{
                  fontSize: fontSize.sm, fontWeight: fontWeight.bold,
                  color: s.masteryPct >= 70 ? colors.success : s.masteryPct >= 40 ? colors.warning : colors.danger,
                }}>{s.masteryPct}%</span>
              </div>
              <div style={{ height: 8, background: colors.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${s.masteryPct}%`,
                  background: s.masteryPct >= 70 ? "linear-gradient(90deg, #2a6a3a, #66bb6a)" : s.masteryPct >= 40 ? "linear-gradient(90deg, #3a2800, #ffb74d)" : "linear-gradient(90deg, #4a1010, #ff5470)",
                  borderRadius: 4, transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{ fontSize: fontSize.sm, color: colors.textDim, marginTop: "6px" }}>{s.correct} / {s.total} questions mastered</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
