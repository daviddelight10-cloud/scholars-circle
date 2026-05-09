import { useEffect, useMemo, useState } from "react";
import { callAI, extractJSON as extractJSONShared } from "../lib/aiClient";

// Maximum days for day-by-day plan before switching to weekly
const MAX_DAILY_DAYS = 21;

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
    
    // Use weekly format for long durations
    const isWeekly = days > MAX_DAILY_DAYS;
    const weeksCount = Math.ceil(days / 7);
    
    let prompt;
    if (isWeekly) {
      prompt = `You are an expert tutor for first-year university students.
Create a WEEKLY study plan to prepare for the ${subject?.label || "course"} exam on ${examDate}.
Student details:
- Weeks remaining: ${weeksCount}
- Daily study time available: ${dailyMinutes} minutes
- Current confidence (1=lost, 5=ready): ${confidence}
- Lesson topics in this course: ${lessons.join("; ") || "general first-year content"}
${focusAreas ? `- Specific areas to focus on: ${focusAreas}` : ""}

Return ONLY a JSON array. Each item represents ONE WEEK:
{"week": <1-based number>, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "focusTopics": ["topic1", "topic2"], "tasks": [{"title": string, "type": "read"|"practice"|"flashcards"|"pastpaper"|"review"|"video"|"quiz", "minutes": number, "priority": "high"|"medium"|"low", "day": "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday"}]}

Build exactly ${weeksCount} weeks. Start with fundamentals in early weeks, progress to advanced topics, and end with revision + past papers in the final 2 weeks. Spread ${dailyMinutes * 7} total minutes across each week. Include at least 1 rest day per week. Mix reading + practice + videos.`;
    } else {
      prompt = `You are an expert tutor for first-year university students.
Create a day-by-day study plan to prepare for the ${subject?.label || "course"} exam on ${examDate}.
Student details:
- Days remaining: ${days}
- Daily study time available: ${dailyMinutes} minutes
- Current confidence (1=lost, 5=ready): ${confidence}
- Lesson topics in this course: ${lessons.join("; ") || "general first-year content"}
${focusAreas ? `- Specific areas to focus on: ${focusAreas}` : ""}

Return ONLY a JSON array. Each item:
{"day": <1-based number>, "date": "YYYY-MM-DD", "tasks": [{"title": string, "type": "read"|"practice"|"flashcards"|"pastpaper"|"review"|"video"|"quiz", "minutes": number, "priority": "high"|"medium"|"low"}]}
Build exactly ${days} days. Front-load weak topics. Add at least one past-paper day in the final 3 days. Mix reading + practice + videos. Include rest days every 4-5 days. Keep total minutes per day at or under ${dailyMinutes}. Prioritize tasks based on importance.`;
    }
    
    try {
      setLoading(true);
      const raw = await callAI(prompt, aiConfig);
      const plan = extractJSON(raw);
      const state = loadPlan(userId);
      state.plans[subjectId] = { examDate, dailyMinutes, confidence, focusAreas, createdAt: Date.now(), days: plan, isWeekly };
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
      <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        {examDate && Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) > MAX_DAILY_DAYS 
          ? `Long-term plan: will generate ${Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))} weekly summaries`
          : "Day-by-day plan for short durations"}
      </p>
      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
    </div>
  );
}

// Study Materials Generator Component
export function StudyMaterialsGenerator({ aiConfig, onMaterialsGenerated }) {
  const [topic, setTopic] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState(null);

  async function generateMaterials() {
    setError("");
    if (!topic.trim()) {
      setError("Enter a topic to generate materials for.");
      return;
    }
    
    const prompt = `You are an expert tutor. Create study materials for the topic: "${topic}".

Return ONLY a JSON object with this structure:
{
  "summary": "A 2-3 paragraph summary of the key concepts",
  "keyPoints": ["point1", "point2", "point3", "point4", "point5"],
  "questions": [
    {"q": "question text", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "why this answer"}
  ],
  "flashcards": [
    {"front": "question or term", "back": "answer or definition"}
  ]
}

Generate exactly:
- 1 summary (2-3 paragraphs)
- 5 key points
- 5 multiple choice questions with 4 options each
- 5 flashcards

Make questions challenging but fair for first-year university students.`;

    try {
      setLoading(true);
      const raw = await callAI(prompt, aiConfig);
      const data = extractJSONShared(raw, "object");
      setMaterials(data);
      if (onMaterialsGenerated) onMaterialsGenerated(data);
    } catch (e) {
      setError(`Could not generate materials: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lesson-block">
      <h3>📚 Study Materials Generator</h3>
      <p className="muted">Enter a topic to generate summary, MCQs, and flashcards.</p>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <input
          type="text"
          placeholder="e.g., Mitosis and Cell Division"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
        <button
          onClick={generateMaterials}
          disabled={loading}
          style={{ borderColor: "#818cf8", color: "#818cf8" }}
        >
          {loading ? "Generating..." : "✨ Generate"}
        </button>
      </div>
      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
      
      {materials && (
        <div style={{ marginTop: 16 }}>
          <h4>📝 Summary</h4>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{materials.summary}</p>
          
          <h4 style={{ marginTop: 12 }}>🔑 Key Points</h4>
          <ul style={{ fontSize: 13, lineHeight: 1.8 }}>
            {materials.keyPoints?.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          
          <h4 style={{ marginTop: 12 }}>❓ Practice Questions</h4>
          <div style={{ fontSize: 13 }}>
            {materials.questions?.map((q, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 8, background: "#f3f4f6", borderRadius: 6 }}>
                <p><strong>Q{i+1}:</strong> {q.q}</p>
                <div style={{ marginLeft: 8 }}>
                  {q.options?.map((opt, j) => (
                    <div key={j} style={{ color: j === q.answer ? "#059669" : "#374151" }}>
                      {String.fromCharCode(65 + j)}) {opt} {j === q.answer && "✓"}
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{q.explanation}</p>
              </div>
            ))}
          </div>
          
          <h4 style={{ marginTop: 12 }}>🃏 Flashcards</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {materials.flashcards?.map((card, i) => (
              <div key={i} style={{ padding: 12, background: "#fef3c7", borderRadius: 6, fontSize: 12 }}>
                <strong>Front:</strong> {card.front}
                <hr style={{ border: "none", borderTop: "1px dashed #d97706", margin: "8px 0" }} />
                <strong>Back:</strong> {card.back}
              </div>
            ))}
          </div>
        </div>
      )}
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
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  
  const todaysTasks = useMemo(() => {
    const out = [];
    for (const sid of Object.keys(planState.plans || {})) {
      const plan = planState.plans[sid];
      const subject = subjects.find((s) => s.id === sid);
      
      if (plan.isWeekly) {
        // Weekly plan: find the week containing today
        const week = (plan.days || []).find((w) => 
          w.startDate <= todayStr && w.endDate >= todayStr
        );
        if (week) {
          // Get tasks for today's day of week
          const todayTasks = (week.tasks || []).filter((t) => t.day === dayOfWeek);
          for (let i = 0; i < todayTasks.length; i++) {
            out.push({
              sid,
              subjectLabel: subject?.label || sid,
              subjectIcon: subject?.icon || "📚",
              taskIndex: i,
              weekFocus: week.focusTopics?.join(", "),
              ...todayTasks[i],
            });
          }
        }
      } else {
        // Daily plan: find the day matching today
        const day = (plan.days || []).find((d) => d.date === todayStr);
        if (day) {
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
    }
    return out;
  }, [planState, subjects, todayStr, dayOfWeek]);

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

      <StudyMaterialsGenerator aiConfig={aiConfig} />

      {planSubjectIds.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Active plans</h3>
          {planSubjectIds.map((sid) => {
            const plan = planState.plans[sid];
            const subject = subjects.find((s) => s.id === sid);
            const completedTasks = Object.keys(planState.completed || {}).filter(k => k.startsWith(`${todayStr}:`)).length;
            const progress = Math.round((completedTasks / (todaysTasks.length || 1)) * 100);
            
            // Calculate totals differently for weekly vs daily
            let totalTasks, totalMinutes, upcoming;
            if (plan.isWeekly) {
              totalTasks = (plan.days || []).reduce((sum, w) => sum + (w.tasks?.length || 0), 0);
              totalMinutes = (plan.days || []).reduce((sum, w) => sum + (w.tasks?.reduce((s, t) => s + (t.minutes || 0), 0) || 0), 0);
              upcoming = (plan.days || []).filter((w) => w.endDate >= todayStr).slice(0, 3);
            } else {
              totalTasks = (plan.days || []).reduce((sum, d) => sum + (d.tasks?.length || 0), 0);
              totalMinutes = (plan.days || []).reduce((sum, d) => sum + (d.tasks?.reduce((s, t) => s + (t.minutes || 0), 0) || 0), 0);
              upcoming = (plan.days || []).filter((d) => d.date >= todayStr).slice(0, 5);
            }
            
            return (
              <div key={sid} className="lesson-block">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <strong>
                    {subject?.icon} {subject?.label} — exam {fmtDate(plan.examDate)}
                    {plan.isWeekly && <span style={{ color: "#818cf8", marginLeft: 8 }}>(Weekly Plan)</span>}
                  </strong>
                  <div className="row" style={{ gap: 8 }}>
                    <button onClick={() => deletePlan(sid)} style={{ fontSize: 12 }}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {plan.isWeekly 
                    ? `${plan.days?.length || 0} weeks · ${totalTasks} tasks · ${Math.round(totalMinutes / 60)}h total`
                    : `${plan.days?.length || 0} days · ${totalTasks} tasks · ${Math.round(totalMinutes / 60)}h total`
                  }
                  · Confidence: {plan.confidence || "N/A"}
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
                  {plan.isWeekly ? (
                    upcoming.map((w, i) => (
                      <li key={i}>
                        <span className="muted">Week {w.week} ({fmtDate(w.startDate)} - {fmtDate(w.endDate)}):</span>
                        <br />
                        <span style={{ fontSize: 11 }}>Focus: {w.focusTopics?.join(", ") || "General review"}</span>
                        <br />
                        <span style={{ fontSize: 11 }}>{(w.tasks || []).map((t) => t.title).join(" · ") || "—"}</span>
                      </li>
                    ))
                  ) : (
                    upcoming.map((d, i) => (
                      <li key={i}>
                        <span className="muted">{fmtDate(d.date)}:</span>{" "}
                        {(d.tasks || []).map((t) => t.title).join(" · ") || "—"}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
