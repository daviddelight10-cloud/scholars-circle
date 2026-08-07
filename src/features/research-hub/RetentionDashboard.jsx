import { useState, useEffect, useCallback } from "react";

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
      <div className="px-5 py-14 text-center text-sm text-hub-text-muted">Loading analytics…</div>
    );
  }

  const { totalItems, dueCount, learningCount, masteredCount, streak, longestStreak, bySubject, avgRetrievability } = fsrsStats;
  const masteryPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;
  const retentionPct = Math.round((avgRetrievability || 0) * 100);

  const subjectEntries = Object.entries(bySubject || {}).sort((a, b) => b[1].total - a[1].total);

  const dailyReviews = fsrsAnalytics?.dailyReviews || {};
  const heatmapDays = Object.entries(dailyReviews).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDaily = Math.max(1, ...Object.values(dailyReviews));

  function heatColor(count) {
    if (count === 0) return "#0a0a0a";
    const intensity = count / maxDaily;
    if (intensity < 0.25) return "#0f2a1a";
    if (intensity < 0.5) return "#1a4a1a";
    if (intensity < 0.75) return "#2a6a2a";
    return "#22c55e";
  }

  return (
    <div className="max-h-full overflow-y-auto p-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-base font-bold text-hub-text">Retention Analytics</div>
          <div className="text-[11px] text-hub-text-dim">Track your learning and retention</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="cursor-pointer text-[11px] text-hub-text-muted">← Back</button>
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold" style={{ color: dueCount > 0 ? "#ef4444" : "#888" }}>{dueCount}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Due now</div>
        </div>
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold text-[#f59e0b]">{learningCount}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Learning</div>
        </div>
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold text-[#22c55e]">{masteredCount}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Mastered</div>
        </div>
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold text-gold">{totalItems}</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Total items</div>
        </div>
        <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-xl font-extrabold text-[#7986cb]">{retentionPct}%</div>
          <div className="mt-0.5 text-[10px] text-hub-text-dim">Avg retention</div>
        </div>
        {streak > 0 && (
          <div className="flex min-w-[80px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
            <div className="text-xl font-extrabold text-[#ff7043]">{streak}</div>
            <div className="mt-0.5 text-[10px] text-hub-text-dim">Day streak</div>
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-1.5 flex justify-between">
          <span className="text-[11px] font-semibold text-hub-text-muted">Overall Mastery</span>
          <span className="text-[11px] font-bold text-[#22c55e]">{masteredCount}/{totalItems} ({masteryPct}%)</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-hub-bg">
          <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#4caf50] transition-all duration-300" style={{ width: `${masteryPct}%` }} />
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-hub-border bg-hub-bg p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-hub-text-muted">Daily Review Goal</div>
            <div className="text-[10px] text-hub-text-dim">Items to review each day</div>
          </div>
          <div className="flex items-center gap-2">
            {[10, 20, 30, 50].map(g => (
              <button key={g} onClick={() => saveDailyGoal(g)} disabled={goalSaving} className={`cursor-pointer rounded-md border px-3 py-1 text-[10px] font-semibold transition-all ${
                dailyGoal === g
                  ? "border-gold-border bg-gold-dim text-gold"
                  : "border-hub-border text-hub-text-dim"
              }`}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      {subjectEntries.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-semibold text-hub-text-muted">Subject Breakdown</div>
          <div className="flex flex-col gap-2">
            {subjectEntries.map(([subject, stats]) => {
              const subMasteryPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
              return (
                <div key={subject} className="rounded-lg border border-hub-border bg-hub-bg p-2">
                  <div className="mb-1 flex justify-between">
                    <span className="text-[11px] font-semibold text-hub-text">{subject}</span>
                    <span className="text-[10px] text-hub-text-dim">{stats.total} items · {stats.due} due</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#0a0c1e]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#4caf50] transition-all duration-300" style={{ width: `${subMasteryPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {heatmapDays.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-semibold text-hub-text-muted">Study Activity (30 days)</div>
          <div className="flex flex-wrap gap-[3px]">
            {heatmapDays.map(([date, count]) => (
              <div key={date} title={`${date}: ${count} reviews`} className="h-3.5 w-3.5 rounded-[3px]" style={{
                background: heatColor(count),
                border: count > 0 ? "none" : "0.5px solid #1a1d35",
              }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-hub-text-dim">
            <span>Less</span>
            <div className="flex gap-[3px]">
              {[0, 0.25, 0.5, 0.75, 1].map(i => (
                <div key={i} className="h-3 w-3 rounded-[2px]" style={{ background: heatColor(Math.round(i * maxDaily)) }} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-hub-border bg-hub-bg p-3">
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <div className="text-xl font-extrabold text-[#ff7043]">{streak || 0}</div>
            <div className="text-[10px] text-hub-text-dim">Current Streak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-extrabold text-gold">{longestStreak || 0}</div>
            <div className="text-[10px] text-hub-text-dim">Longest Streak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-extrabold text-[#22c55e]">{fsrsAnalytics?.masteredThisPeriod || 0}</div>
            <div className="text-[10px] text-hub-text-dim">Mastered (30d)</div>
          </div>
        </div>
      </div>

      {fsrsAnalytics?.difficultyBySubject && Object.keys(fsrsAnalytics.difficultyBySubject).length > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-semibold text-hub-text-muted">Difficulty by Subject</div>
          <div className="flex flex-col gap-2">
            {Object.entries(fsrsAnalytics.difficultyBySubject).map(([subject, d]) => (
              <div key={subject} className="flex justify-between rounded-lg border border-hub-border bg-hub-bg p-2">
                <span className="text-[11px] text-hub-text">{subject}</span>
                <span className="text-[11px] font-semibold" style={{ color: d.avg > 5 ? "#ef4444" : d.avg > 3 ? "#f59e0b" : "#22c55e" }}>
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
