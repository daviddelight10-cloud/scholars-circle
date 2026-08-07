export default function ProgressDashboard({ progressData, reviewCount, reviewStats }) {
  if (!progressData) return <div className="px-5 py-14 text-center text-sm text-hub-text-muted">Loading progress...</div>;

  const streak = reviewStats?.streak ?? 0;
  const longestStreak = reviewStats?.longestStreak ?? 0;
  const avgEF = reviewStats?.avgEasinessFactor ?? 2.5;
  const mastered = reviewStats?.masteredCount ?? 0;
  const dueCount = reviewStats?.dueCount ?? 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-3">
        <div className="flex min-w-[100px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-2xl font-extrabold text-gold">{progressData.totalXp}</div>
          <div className="mt-0.5 text-[11px] text-hub-text-muted">Total XP</div>
        </div>
        <div className="flex min-w-[100px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-2xl font-extrabold text-gold">Lv {progressData.level}</div>
          <div className="mt-0.5 text-[11px] text-hub-text-muted">Level</div>
        </div>
        <div className="flex min-w-[100px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-2xl font-extrabold text-[#ff7043]">🔥 {streak}</div>
          <div className="mt-0.5 text-[11px] text-hub-text-muted">Day Streak{longestStreak > streak ? ` (best: ${longestStreak})` : ""}</div>
        </div>
        <div className="flex min-w-[100px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-2xl font-extrabold text-coral-500">{reviewCount}</div>
          <div className="mt-0.5 text-[11px] text-hub-text-muted">Review Queue{dueCount > 0 ? ` (${dueCount} due)` : ""}</div>
        </div>
        <div className="flex min-w-[100px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-2xl font-extrabold text-success">{mastered}</div>
          <div className="mt-0.5 text-[11px] text-hub-text-muted">SM-2 Mastered</div>
        </div>
        <div className="flex min-w-[100px] flex-col items-center rounded-xl border border-hub-border bg-hub-surface px-5 py-4 text-center">
          <div className="text-2xl font-extrabold text-[#888]">{avgEF}</div>
          <div className="mt-0.5 text-[11px] text-hub-text-muted">Avg Easiness</div>
        </div>
      </div>

      <div className="mb-4 text-sm font-bold text-hub-text-muted">Subject Mastery</div>
      {progressData.subjects.length === 0 ? (
        <div className="px-5 py-14 text-center text-sm text-hub-text-dim">
          <div className="mb-2 text-4xl">📊</div>
          <div className="text-sm font-bold text-hub-text-muted">No quiz attempts yet</div>
          <div className="mt-1 text-[13px]">Take an MCQ to see your progress here.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {progressData.subjects.map((s) => (
            <div key={s.subject} className="rounded-lg border border-hub-border bg-hub-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-hub-text">{s.subject}</span>
                <span
                  className="text-[11px] font-bold"
                  style={{ color: s.masteryPct >= 70 ? "#4caf50" : s.masteryPct >= 40 ? "#ffb74d" : "#ff5470" }}
                >{s.masteryPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-hub-bg">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${s.masteryPct}%`,
                    background: s.masteryPct >= 70 ? "linear-gradient(90deg, #2a6a3a, #66bb6a)" : s.masteryPct >= 40 ? "linear-gradient(90deg, #3a2800, #ffb74d)" : "linear-gradient(90deg, #4a1010, #ff5470)",
                  }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-hub-text-dim">{s.correct} / {s.total} questions mastered</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
