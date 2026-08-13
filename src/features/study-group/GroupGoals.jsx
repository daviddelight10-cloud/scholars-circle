import React, { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const METRICS = [
  { value: "xp", label: "XP earned", emoji: "⚡" },
  { value: "questions", label: "Questions answered", emoji: "❓" },
  { value: "sessions", label: "Study sessions", emoji: "📚" },
  { value: "hours", label: "Study hours", emoji: "⏰" },
];

export default function GroupGoals({ classroomId, token, isTeacher }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", targetValue: 500, metric: "xp", deadline: "" });
  const [celebrate, setCelebrate] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/goals`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      // Check for newly completed goals
      data.forEach((g) => {
        if (g.completedAt && !goals.find((old) => old.id === g.id && old.completedAt)) {
          setCelebrate(g);
          setTimeout(() => setCelebrate(null), 4000);
        }
      });
      setGoals(data);
    } catch (err) {
      console.error("Goals error:", err);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token]);

  useEffect(() => {
    fetchGoals();
    const interval = setInterval(fetchGoals, 10000);
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

  function getMetricEmoji(metric) {
    return METRICS.find((m) => m.value === metric)?.emoji || "🎯";
  }

  function getMetricLabel(metric) {
    return METRICS.find((m) => m.value === metric)?.label || metric;
  }

  function formatDeadline(date) {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const days = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (days < 0) return "Expired";
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days}d`;
  }

  if (loading) {
    return (
      <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading goals…</div>
      </div>
    );
  }

  return (
    <div>
      {isTeacher && (
        <div className="cr-collapsible" style={{ marginBottom: 12 }}>
          <div className="cr-collapsible-header" onClick={() => setShowCreate(!showCreate)}>
            <span>🎯 Create Group Goal</span>
            <span>{showCreate ? "▲" : "▼"}</span>
          </div>
          {showCreate && (
            <div className="cr-collapsible-body">
              <input
                className="cr-input"
                value={newGoal.title}
                onChange={(e) => setNewGoal((p) => ({ ...p, title: e.target.value }))}
                placeholder="Goal title (e.g., '500 XP this week')"
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <select
                  className="cr-input"
                  value={newGoal.metric}
                  onChange={(e) => setNewGoal((p) => ({ ...p, metric: e.target.value }))}
                  style={{ flex: 1, minWidth: 120 }}
                >
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
                  ))}
                </select>
                <input
                  className="cr-input"
                  type="number"
                  value={newGoal.targetValue}
                  onChange={(e) => setNewGoal((p) => ({ ...p, targetValue: e.target.value }))}
                  placeholder="Target"
                  style={{ flex: 1, minWidth: 80 }}
                />
              </div>
              <input
                className="cr-input"
                type="datetime-local"
                value={newGoal.deadline}
                onChange={(e) => setNewGoal((p) => ({ ...p, deadline: e.target.value }))}
                style={{ marginBottom: 8 }}
              />
              <button className="cr-btn" style={{ width: "100%" }} onClick={createGoal}>Create Goal</button>
            </div>
          )}
        </div>
      )}

      {goals.length === 0 ? (
        <div className="cr-empty" style={{ padding: "32px 20px" }}>
          <div className="cr-empty-icon">🎯</div>
          <div className="cr-empty-title">No group goals yet</div>
          <div className="cr-empty-desc">{isTeacher ? "Create a goal to motivate your group." : "Check back soon for group study goals."}</div>
        </div>
      ) : (
        <div className="sg-goals-list">
          {goals.map((goal) => {
            const isComplete = !!goal.completedAt;
            const deadline = formatDeadline(goal.deadline);
            return (
              <div key={goal.id} className={`sg-goal-card ${isComplete ? "complete" : ""}`}>
                <div className="sg-goal-header">
                  <div className="sg-goal-title">
                    {getMetricEmoji(goal.metric)} {goal.title}
                  </div>
                  {deadline && !isComplete && (
                    <span className={`sg-goal-deadline ${deadline === "Expired" ? "expired" : ""}`}>{deadline}</span>
                  )}
                  {isComplete && <span className="sg-goal-complete-badge">✅ Done!</span>}
                </div>
                <div className="sg-goal-progress-bar">
                  <div
                    className="sg-goal-progress-fill"
                    style={{
                      width: `${goal.percentage}%`,
                      background: isComplete
                        ? "linear-gradient(90deg, #3DD68C, #10b981)"
                        : "linear-gradient(90deg, #FFD700, #f59e0b)",
                    }}
                  />
                </div>
                <div className="sg-goal-progress-text">
                  <span>{goal.totalProgress.toLocaleString()} / {goal.targetValue.toLocaleString()} {getMetricLabel(goal.metric)}</span>
                  <span>{goal.percentage}%</span>
                </div>
                <div className="sg-goal-contributors">
                  {goal.progress.slice(0, 5).map((p) => (
                    <span key={p.userId} className="sg-contributor-chip">
                      {(p.user?.fullName || p.user?.username || "S").slice(0, 8)}: {p.value}
                    </span>
                  ))}
                  {goal.progress.length > 5 && <span className="sg-contributor-more">+{goal.progress.length - 5} more</span>}
                </div>
                {!isComplete && (
                  <div className="sg-goal-actions">
                    <button className="cr-btn-outline" style={{ fontSize: 11 }} onClick={() => contribute(goal.id, 10)}>
                      +10 {getMetricEmoji(goal.metric)}
                    </button>
                    <button className="cr-btn-outline" style={{ fontSize: 11 }} onClick={() => contribute(goal.id, 25)}>
                      +25 {getMetricEmoji(goal.metric)}
                    </button>
                    <button className="cr-btn-outline" style={{ fontSize: 11 }} onClick={() => contribute(goal.id, 50)}>
                      +50 {getMetricEmoji(goal.metric)}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {celebrate && (
        <div className="sg-celebrate-overlay">
          <div className="sg-celebrate-card">
            <div className="sg-celebrate-emoji">🎉</div>
            <div className="sg-celebrate-title">Goal Complete!</div>
            <div className="sg-celebrate-desc">{celebrate.title}</div>
            <div className="sg-celebrate-sub">The group crushed it together! 🙌</div>
          </div>
        </div>
      )}
    </div>
  );
}
