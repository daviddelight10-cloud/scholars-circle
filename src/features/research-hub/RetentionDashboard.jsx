import { useState, useEffect, useCallback } from "react";
import { colors, spacing, fontSize, fontWeight, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export default function RetentionDashboard({ fsrsStats, fsrsAnalytics, onBack }) {
  const [dailyGoal, setDailyGoal] = useState(20);
  const [goalSaving, setGoalSaving] = useState(false);

  useEffect(() => {
    if (fsrsStats?.dailyGoal) setDailyGoal(fsrsStats.dailyGoal);
  }, [fsrsStats?.dailyGoal]);

  const saveDailyGoal = useCallback(async (goal) => {
    setGoalSaving(true);
    try {
      await fetch(`${API_BASE}/api/resources/fsrs/daily-goal`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ dailyGoal: goal }),
      });
      setDailyGoal(goal);
    } catch {}
    setGoalSaving(false);
  }, []);

  if (!fsrsStats) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: fontSize.md, color: colors.textMuted }}>Loading analytics…</div>
      </div>
    );
  }

  const { totalItems, dueCount, learningCount, masteredCount, streak, longestStreak, bySubject, avgRetrievability } = fsrsStats;
  const masteryPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;
  const retentionPct = Math.round((avgRetrievability || 0) * 100);

  // Subject breakdown sorted by total items
  const subjectEntries = Object.entries(bySubject || {}).sort((a, b) => b[1].total - a[1].total);

  // Daily review heatmap data
  const dailyReviews = fsrsAnalytics?.dailyReviews || {};
  const heatmapDays = Object.entries(dailyReviews).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDaily = Math.max(1, ...Object.values(dailyReviews));

  function heatColor(count) {
    if (count === 0) return colors.bg;
    const intensity = count / maxDaily;
    if (intensity < 0.25) return "#0f2a1a";
    if (intensity < 0.5) return "#1a4a1a";
    if (intensity < 0.75) return "#2a6a2a";
    return "#22c55e";
  }

  return (
    <div style={{ padding: spacing.lg, overflowY: "auto", maxHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
        <div>
          <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: "#e8e8e8" }}>Retention Analytics</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textDim }}>Track your learning and retention</div>
        </div>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: fontSize.sm }}>← Back</button>
        )}
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.xl }}>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: dueCount > 0 ? "#ef4444" : colors.textMuted }}>{dueCount}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Due now</div>
        </div>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#f59e0b" }}>{learningCount}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Learning</div>
        </div>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#22c55e" }}>{masteredCount}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Mastered</div>
        </div>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: goldText }}>{totalItems}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Total items</div>
        </div>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#7986cb" }}>{retentionPct}%</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Avg retention</div>
        </div>
        {streak > 0 && (
          <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#ff7043" }}>{streak}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Day streak</div>
          </div>
        )}
      </div>

      {/* Mastery progress bar */}
      <div style={{ marginBottom: spacing.xl }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Overall Mastery</span>
          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: "#22c55e" }}>{masteredCount}/{totalItems} ({masteryPct}%)</span>
        </div>
        <div style={{ height: 10, background: colors.bg, borderRadius: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${masteryPct}%`, background: "linear-gradient(90deg, #22c55e, #4caf50)", borderRadius: 5, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Daily Goal */}
      <div style={{ marginBottom: spacing.xl, padding: spacing.md, background: colors.bg, borderRadius: 12, border: `0.5px solid ${colors.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Daily Review Goal</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Items to review each day</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
            {[10, 20, 30, 50].map(g => (
              <button key={g} onClick={() => saveDailyGoal(g)} disabled={goalSaving} style={{
                padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
                background: dailyGoal === g ? goldDim : "transparent",
                border: `0.5px solid ${dailyGoal === g ? goldBorder : colors.border}`,
                color: dailyGoal === g ? goldText : colors.textDim,
              }}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Subject breakdown */}
      {subjectEntries.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.md }}>Subject Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {subjectEntries.map(([subject, stats]) => {
              const subMasteryPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
              return (
                <div key={subject} style={{ padding: spacing.sm, background: colors.bg, borderRadius: 8, border: `0.5px solid ${colors.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: "#e8e8e8" }}>{subject}</span>
                    <span style={{ fontSize: fontSize.xs, color: colors.textDim }}>{stats.total} items · {stats.due} due</span>
                  </div>
                  <div style={{ height: 6, background: "#0a0c1e", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${subMasteryPct}%`, background: "linear-gradient(90deg, #22c55e, #4caf50)", borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Study heatmap */}
      {heatmapDays.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.md }}>Study Activity (30 days)</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {heatmapDays.map(([date, count]) => (
              <div key={date} title={`${date}: ${count} reviews`} style={{
                width: 14, height: 14, borderRadius: 3,
                background: heatColor(count),
                border: count > 0 ? "none" : `0.5px solid #1a1d35`,
              }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: spacing.sm, fontSize: 10, color: colors.textDim }}>
            <span>Less</span>
            <div style={{ display: "flex", gap: 3 }}>
              {[0, 0.25, 0.5, 0.75, 1].map(i => (
                <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(Math.round(i * maxDaily)) }} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      )}

      {/* Streak info */}
      <div style={{ marginBottom: spacing.xl, padding: spacing.md, background: colors.bg, borderRadius: 12, border: `0.5px solid ${colors.border}` }}>
        <div style={{ display: "flex", gap: spacing.xl, justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#ff7043" }}>{streak || 0}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Current Streak</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: goldText }}>{longestStreak || 0}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Longest Streak</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#22c55e" }}>{fsrsAnalytics?.masteredThisPeriod || 0}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim }}>Mastered (30d)</div>
          </div>
        </div>
      </div>

      {/* Difficulty by subject */}
      {fsrsAnalytics?.difficultyBySubject && Object.keys(fsrsAnalytics.difficultyBySubject).length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.md }}>Difficulty by Subject</div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {Object.entries(fsrsAnalytics.difficultyBySubject).map(([subject, d]) => (
              <div key={subject} style={{ display: "flex", justifyContent: "space-between", padding: spacing.sm, background: colors.bg, borderRadius: 8, border: `0.5px solid ${colors.border}` }}>
                <span style={{ fontSize: fontSize.sm, color: "#e8e8e8" }}>{subject}</span>
                <span style={{ fontSize: fontSize.sm, color: d.avg > 5 ? "#ef4444" : d.avg > 3 ? "#f59e0b" : "#22c55e", fontWeight: fontWeight.semibold }}>
                  {d.avg.toFixed(1)} / 10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
