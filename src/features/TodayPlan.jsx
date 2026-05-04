import { useEffect, useMemo, useState } from "react";
import { callAI, extractJSON as extractJSONShared } from "../lib/aiClient";

const BASE_STORE_KEY = "sc_study_plan_v1";

function loadPlan(userId) {
  const key = userId ? `${BASE_STORE_KEY}::${userId}` : BASE_STORE_KEY;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { plans: {}, completed: {} };
  } catch {
    return { plans: {}, completed: {} };
  }
}

function savePlan(state, userId) {
  const key = userId ? `${BASE_STORE_KEY}::${userId}` : BASE_STORE_KEY;
  localStorage.setItem(key, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const extractJSON = (raw) => extractJSONShared(raw, "array");

export function StudyPlanGenerator({ subjects, aiConfig, onPlanCreated, userId, existingPlan }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [confidence, setConfidence] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusAreas, setFocusAreas] = useState("");

  async function generate() {
    setError("");
    if (!subjectId || !examDate) {
      setError("Pick a subject and an exam date.");
      return;
    }
    const subject = subjects.find((s) => s.id === subjectId);
    const lessons = (subject?.lessons || []).map((l) => l.title).slice(0, 30);
    const days = Math.max(
      1,
      Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    const prompt = `You are an expert tutor for first-year university students.
Create a day-by-day study plan to prepare for the ${subject?.label || "course"} exam on ${examDate}.
Student details:
- Days remaining: ${days}
- Daily study time available: ${dailyMinutes} minutes
- Current confidence (1=lost, 5=ready): ${confidence}
- Lesson topics in this course: ${lessons.join("; ") || "general first-year content"}
${focusAreas ? `- Specific areas to focus on: ${focusAreas}` : ""}

Return ONLY a JSON array. Each item:
{"day": <1-based number>, "date": "YYYY-MM-DD", "tasks": [{"title": string, "type": "read"|"practice"|"flashcards"|"pastpaper"|"review"|"video"|"quiz", "minutes": number, "priority": "high"|"medium"|"low"}]}
Build exactly ${Math.min(days, 21)} days. Front-load weak topics. Add at least one past-paper day in the final 3 days. Mix reading + practice + videos. Include rest days every 4-5 days. Keep total minutes per day at or under ${dailyMinutes}. Prioritize tasks based on importance.`;
    try {
      setLoading(true);
      const raw = await callAI(prompt, aiConfig);
      const plan = extractJSON(raw);
      const state = loadPlan(userId);
      state.plans[subjectId] = { examDate, dailyMinutes, confidence, focusAreas, createdAt: Date.now(), days: plan };
      savePlan(state, userId);
      if (onPlanCreated) onPlanCreated(subjectId);
    } catch (e) {
      setError(`Could not generate plan: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lesson-block">
      <h3>📅 Study Plan Generator</h3>
      <p className="muted">Tell me your exam date and I'll build a personalized day-by-day plan.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>
        <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        <input
          type="number"
          min={15}
          max={300}
          step={15}
          value={dailyMinutes}
          onChange={(e) => setDailyMinutes(Number(e.target.value))}
          style={{ width: 110 }}
          title="Daily study minutes"
        />
        <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
          <option value={1}>Confidence: 1 — Lost</option>
          <option value={2}>Confidence: 2 — Shaky</option>
          <option value={3}>Confidence: 3 — Okay</option>
          <option value={4}>Confidence: 4 — Solid</option>
          <option value={5}>Confidence: 5 — Ready</option>
        </select>
      </div>
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="Focus areas (optional, e.g., 'mitosis, genetics')"
          value={focusAreas}
          onChange={(e) => setFocusAreas(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
      </div>
      <button
        onClick={generate}
        disabled={loading}
        style={{ marginTop: 8, borderColor: "#2dd4a0", color: "#2dd4a0" }}
      >
        {loading ? "Building plan…" : "✨ Generate Plan"}
      </button>
      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
    </div>
  );
}

export function TodayScreen({
  subjects,
  mastery,
  dueCards,
  history,
  stats,
  aiConfig,
  onStartSpaced,
  onStartSubject,
  onOpenTab,
  userId,
}) {
  const [planState, setPlanState] = useState(loadPlan(userId));
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setPlanState(loadPlan(userId));
  }, [refresh, userId]);

  const weakest = useMemo(() => {
    const ranked = subjects
      .map((s) => ({ s, m: mastery[s.id] ?? 0 }))
      .sort((a, b) => a.m - b.m);
    return ranked[0];
  }, [subjects, mastery]);

  const todayStr = todayKey();
  const todaysTasks = useMemo(() => {
    const out = [];
    for (const sid of Object.keys(planState.plans || {})) {
      const plan = planState.plans[sid];
      const day = (plan.days || []).find((d) => d.date === todayStr);
      if (day) {
        const subject = subjects.find((s) => s.id === sid);
        for (let i = 0; i < (day.tasks || []).length; i++) {
          out.push({
            sid,
            subjectLabel: subject?.label || sid,
            subjectIcon: subject?.icon || "📚",
            taskIndex: i,
            ...day.tasks[i],
          });
        }
      }
    }
    return out;
  }, [planState, subjects, todayStr]);

  function toggleDone(sid, taskIndex) {
    const state = loadPlan(userId);
    const k = `${todayStr}:${sid}:${taskIndex}`;
    state.completed[k] = !state.completed[k];
    savePlan(state, userId);
    setRefresh((r) => r + 1);
  }

  function isDone(sid, taskIndex) {
    return !!planState.completed[`${todayStr}:${sid}:${taskIndex}`];
  }

  function deletePlan(sid) {
    if (!confirm("Delete this study plan?")) return;
    const state = loadPlan(userId);
    delete state.plans[sid];
    savePlan(state, userId);
    setRefresh((r) => r + 1);
  }

  const planSubjectIds = Object.keys(planState.plans || {});
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="card">
      <h2>
        {greeting} 👋 — Today
      </h2>
      <p className="muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>

      <div className="today-grid">
        <div className="today-tile">
          <div className="today-tile-label">🔥 Streak</div>
          <div className="today-tile-value">{stats?.streak ?? 0} days</div>
        </div>
        <div className="today-tile">
          <div className="today-tile-label">⚡ XP</div>
          <div className="today-tile-value">{stats?.xp ?? 0}</div>
        </div>
        <div className="today-tile">
          <div className="today-tile-label">🧠 Cards Due</div>
          <div className="today-tile-value">{dueCards?.length ?? 0}</div>
        </div>
        <div className="today-tile">
          <div className="today-tile-label">📚 Sessions</div>
          <div className="today-tile-value">{stats?.sessions ?? 0}</div>
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>What to do right now</h3>
      <div className="today-actions">
        {dueCards?.length > 0 && (
          <button onClick={onStartSpaced} style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}>
            🧠 Review {dueCards.length} due cards
          </button>
        )}
        {weakest && weakest.s && (
          <button onClick={() => onStartSubject(weakest.s.id)} style={{ borderColor: "#facc15", color: "#facc15" }}>
            🎯 Practice your weakest: {weakest.s.icon} {weakest.s.label} ({weakest.m}%)
          </button>
        )}
        <button onClick={() => onOpenTab("bank")} style={{ borderColor: "#fb923c", color: "#fb923c" }}>
          📝 Take a past paper
        </button>
        <button onClick={() => onOpenTab("lectures")} style={{ borderColor: "#818cf8", color: "#818cf8" }}>
          🎧 Convert lecture to notes
        </button>
      </div>

      <h3 style={{ marginTop: 18 }}>📅 Today's plan</h3>
      {todaysTasks.length === 0 ? (
        <p className="muted">No tasks for today. Generate a study plan below.</p>
      ) : (
        <ul className="plan-tasks">
          {todaysTasks.map((t, i) => {
            const done = isDone(t.sid, t.taskIndex);
            const priorityColor = t.priority === "high" ? "#ff6b6b" : t.priority === "medium" ? "#facc15" : "#4ade80";
            return (
              <li key={i} className={`plan-task ${done ? "done" : ""}`}>
                <label>
                  <input type="checkbox" checked={done} onChange={() => toggleDone(t.sid, t.taskIndex)} />
                  <span className="task-title">
                    {t.subjectIcon} <strong>{t.title}</strong>
                    {t.priority && (
                      <span style={{ 
                        marginLeft: 8, 
                        fontSize: 10, 
                        padding: "2px 6px", 
                        borderRadius: 4, 
                        background: priorityColor + "20", 
                        color: priorityColor,
                        fontWeight: 600
                      }}>
                        {t.priority.toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {t.type} · {t.minutes} min · {t.subjectLabel}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <StudyPlanGenerator subjects={subjects} aiConfig={aiConfig} onPlanCreated={() => setRefresh((r) => r + 1)} userId={userId} />

      {planSubjectIds.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Active plans</h3>
          {planSubjectIds.map((sid) => {
            const plan = planState.plans[sid];
            const subject = subjects.find((s) => s.id === sid);
            const upcoming = (plan.days || []).filter((d) => d.date >= todayStr).slice(0, 5);
            const totalTasks = (plan.days || []).reduce((sum, d) => sum + (d.tasks?.length || 0), 0);
            const totalMinutes = (plan.days || []).reduce((sum, d) => sum + (d.tasks?.reduce((s, t) => s + (t.minutes || 0), 0) || 0), 0);
            const completedTasks = Object.keys(planState.completed || {}).filter(k => k.startsWith(`${todayStr}:`)).length;
            const progress = Math.round((completedTasks / (todaysTasks.length || 1)) * 100);
            return (
              <div key={sid} className="lesson-block">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <strong>
                    {subject?.icon} {subject?.label} — exam {fmtDate(plan.examDate)}
                  </strong>
                  <div className="row" style={{ gap: 8 }}>
                    <button onClick={() => deletePlan(sid)} style={{ fontSize: 12 }}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {plan.days?.length || 0} days · {totalTasks} tasks · {Math.round(totalMinutes / 60)}h total · Confidence: {plan.confidence || "N/A"}
                  {plan.focusAreas && ` · Focus: ${plan.focusAreas}`}
                </div>
                <div style={{ marginTop: 8, background: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ 
                    width: `${progress}%`, 
                    background: progress >= 80 ? "#22c55e" : progress >= 50 ? "#facc15" : "#3b82f6", 
                    height: "100%", 
                    transition: "width 0.3s" 
                  }} />
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Today's progress: {completedTasks}/{todaysTasks.length} tasks completed ({progress}%)
                </p>
                <ul className="plan-tasks" style={{ marginTop: 8 }}>
                  {upcoming.map((d, i) => (
                    <li key={i}>
                      <span className="muted">{fmtDate(d.date)}:</span>{" "}
                      {(d.tasks || []).map((t) => t.title).join(" · ") || "—"}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
