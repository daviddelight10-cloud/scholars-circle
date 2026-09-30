import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/constants";
import { Avatar } from "../feed/feedUi";

const METRICS = [
  { value: "xp", label: "XP earned", emoji: "⚡" },
  { value: "questions", label: "Questions answered", emoji: "❓" },
  { value: "sessions", label: "Study sessions", emoji: "📚" },
  { value: "hours", label: "Study hours", emoji: "⏰" },
];

export default function GroupGoals({ classroomId, token, isTeacher }) {
  const [goals, setGoals] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", targetValue: 500, metric: "xp", deadline: "" });
  const [celebrate, setCelebrate] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/goals`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setGoals((prev) => {
        data.forEach((g) => {
          if (g.completedAt && !(prev || []).find((old) => old.id === g.id && old.completedAt)) {
            setCelebrate(g);
            setTimeout(() => setCelebrate(null), 4000);
          }
        });
        return data;
      });
    } catch (err) {
      console.error("Goals error:", err);
    }
  }, [classroomId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchGoals();
    const interval = setInterval(fetchGoals, 15000);
    return () => clearInterval(interval);
  }, [fetchGoals]);

  async function createGoal() {
    if (!newGoal.title.trim() || !newGoal.targetValue) return;
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          title: newGoal.title.trim(),
          targetValue: parseInt(newGoal.targetValue),
          metric: newGoal.metric,
          deadline: newGoal.deadline || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setShowCreate(false);
      setNewGoal({ title: "", targetValue: 500, metric: "xp", deadline: "" });
      fetchGoals();
    } catch (err) {
      console.error("Create goal error:", err);
    }
  }

  async function contribute(goalId, value) {
    try {
      await fetch(`${API_BASE}/study-group/goals/${goalId}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ value: parseInt(value) }),
      });
      fetchGoals();
    } catch (err) {
      console.error("Contribute error:", err);
    }
  }

  const metricEmoji = (m) => METRICS.find((x) => x.value === m)?.emoji || "🎯";
  const metricLabel = (m) => METRICS.find((x) => x.value === m)?.label || m;

  function deadlineLabel(date) {
    if (!date) return null;
    const days = Math.ceil((new Date(date) - new Date()) / 86400000);
    if (days < 0) return "Expired";
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days}d`;
  }

  if (goals === null) {
    return (
      <div className="fd-skeletons">
        {[0, 1].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 110 }} />)}
      </div>
    );
  }

  return (
    <div className="gv-goals">
      {isTeacher && (
        showCreate ? (
          <div className="gv-goal-create fd-card">
            <input
              className="fd-sheet-input"
              value={newGoal.title}
              onChange={(e) => setNewGoal((p) => ({ ...p, title: e.target.value }))}
              placeholder="Goal title (e.g., '500 XP this week')"
            />
            <div className="gv-goal-create-row">
              <select
                className="fd-sheet-input"
                value={newGoal.metric}
                onChange={(e) => setNewGoal((p) => ({ ...p, metric: e.target.value }))}
              >
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
                ))}
              </select>
              <input
                className="fd-sheet-input"
                type="number"
                value={newGoal.targetValue}
                onChange={(e) => setNewGoal((p) => ({ ...p, targetValue: e.target.value }))}
                placeholder="Target"
              />
            </div>
            <input
              className="fd-sheet-input"
              type="datetime-local"
              value={newGoal.deadline}
              onChange={(e) => setNewGoal((p) => ({ ...p, deadline: e.target.value }))}
            />
            <div className="gv-goal-create-row">
              <button className="fd-follow-btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="fd-join-btn" style={{ flex: 1 }} onClick={createGoal}>Create goal</button>
            </div>
          </div>
        ) : (
          <button className="fd-go-btn" onClick={() => setShowCreate(true)}>🎯 New group goal</button>
        )
      )}

      {goals.length === 0 ? (
        <div className="fd-empty">
          <div className="fd-empty-icon">🎯</div>
          <div className="fd-empty-title">No group goals yet</div>
          <div className="fd-empty-sub">{isTeacher ? "Set a target — the whole group pushes toward it together." : "Check back soon for group study goals."}</div>
        </div>
      ) : (
        <div className="gv-goals-list">
          {goals.map((goal) => {
            const done = !!goal.completedAt;
            const deadline = deadlineLabel(goal.deadline);
            return (
              <div key={goal.id} className={`gv-goal fd-card ${done ? "done" : ""}`}>
                <div className="gv-goal-head">
                  <span className="gv-goal-title">{metricEmoji(goal.metric)} {goal.title}</span>
                  {done
                    ? <span className="gv-goal-badge done">✅ Done</span>
                    : deadline && <span className={`gv-goal-badge ${deadline === "Expired" ? "expired" : ""}`}>{deadline}</span>}
                </div>
                <div className="gv-goal-bar">
                  <div
                    className={`gv-goal-fill ${done ? "done" : ""}`}
                    style={{ width: `${goal.percentage}%` }}
                  />
                </div>
                <div className="gv-goal-meta">
                  <span>{goal.totalProgress.toLocaleString()} / {goal.targetValue.toLocaleString()} {metricLabel(goal.metric)}</span>
                  <span>{goal.percentage}%</span>
                </div>
                {goal.progress?.length > 0 && (
                  <div className="gv-goal-crew">
                    {goal.progress.slice(0, 6).map((p) => (
                      <span key={p.userId} className="gv-goal-crew-chip" title={`${p.user?.name || "Member"}: ${p.value}`}>
                        <Avatar user={p.user} size={18} />
                        {p.value}
                      </span>
                    ))}
                    {goal.progress.length > 6 && <span className="gv-goal-crew-more">+{goal.progress.length - 6}</span>}
                  </div>
                )}
                {!done && (
                  <div className="gv-goal-actions">
                    <button className="fd-follow-btn sm" onClick={() => contribute(goal.id, 10)}>+10 {metricEmoji(goal.metric)}</button>
                    <button className="fd-follow-btn sm" onClick={() => contribute(goal.id, 25)}>+25 {metricEmoji(goal.metric)}</button>
                    <button className="fd-follow-btn sm" onClick={() => contribute(goal.id, 50)}>+50 {metricEmoji(goal.metric)}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {celebrate && (
        <div className="gv-celebrate">
          <div className="gv-celebrate-card">
            <div className="gv-celebrate-emoji">🎉</div>
            <div className="gv-celebrate-title">Goal complete!</div>
            <div className="gv-celebrate-sub">{celebrate.title} — the group crushed it together 🙌</div>
          </div>
        </div>
      )}
    </div>
  );
}
