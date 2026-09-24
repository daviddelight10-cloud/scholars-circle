import { useEffect, useMemo, useState } from "react";
import { API_BASE, BADGES } from "../../lib/constants";
import { AchievementsBadges } from "../SearchAndBadges";
import { loadSave, levelProgress } from "../../features/streak-survival/survivalStore.js";
import "./stats.css";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const GOAL_OPTS = [10, 20, 40];

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

function loadCached(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null")?.data ?? null; } catch { return null; }
}

function dayList(dailyReviews, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: DAY_LABELS[d.getDay()], count: dailyReviews?.[key] || 0, today: i === 0 });
  }
  return out;
}

export default function StatsDashboard({ stats, history, subjects }) {
  const [days, setDays] = useState(30);
  const [fsrsStats, setFsrsStats] = useState(() => loadCached("sc_fsrs_stats"));
  const [analytics, setAnalytics] = useState(() => (days === 30 ? loadCached("sc_fsrs_analytics") : null));
  const [save] = useState(() => ({ ...loadSave() }));
  const [goalSaving, setGoalSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d) {
          setFsrsStats(d);
          try { localStorage.setItem("sc_fsrs_stats", JSON.stringify({ data: d, ts: Date.now() })); } catch {}
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/api/resources/fsrs/analytics?days=${days}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d) {
          setAnalytics(d);
          if (days === 30) { try { localStorage.setItem("sc_fsrs_analytics", JSON.stringify({ data: d, ts: Date.now() })); } catch {} }
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [days]);

  // Only use analytics matching the selected range — stale data from another
  // range is ignored while the refetch is in flight.
  const a = analytics?.days === days ? analytics : null;

  const saveDailyGoal = async (goal) => {
    setGoalSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/daily-goal`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ dailyGoal: goal }),
      });
      if (res.ok) setFsrsStats((s) => (s ? { ...s, dailyGoal: goal } : s));
    } catch {}
    setGoalSaving(false);
  };

  const s = fsrsStats;
  const retention = s?.avgRetrievability != null ? Math.round(s.avgRetrievability * 100) : null;
  const goal = s?.dailyGoal || 0;

  // ── Activity chart ──
  const daysList = useMemo(() => dayList(a?.dailyReviews, days), [a, days]);
  const chartMax = Math.max(1, goal, ...daysList.map((d) => d.count));
  const periodTotal = daysList.reduce((t, d) => t + d.count, 0);
  const avgPerDay = days > 0 ? Math.round((periodTotal / days) * 10) / 10 : 0;
  const bestDay = daysList.reduce((b, d) => Math.max(b, d.count), 0);

  // ── Due forecast (next 7 days) ──
  const forecast = useMemo(() => {
    const map = a?.dueForecast || {};
    return Object.entries(map).sort((x, y) => x[0].localeCompare(y[0])).map(([date, count], i) => ({
      label: DAY_LABELS[new Date(`${date}T12:00:00`).getDay()],
      count,
      today: i === 0,
    }));
  }, [a]);
  const forecastMax = Math.max(1, ...forecast.map((d) => d.count));
  const weekDue = forecast.reduce((t, d) => t + d.count, 0);

  // ── Memory state distribution ──
  const states = [
    { key: "new", label: "New", count: s?.newCount || 0, cls: "sd-seg-new" },
    { key: "learning", label: "Learning", count: s?.learningCount || 0, cls: "sd-seg-learning" },
    { key: "review", label: "Review", count: s?.reviewCount || 0, cls: "sd-seg-review" },
    { key: "mastered", label: "Mastered", count: s?.masteredCount || 0, cls: "sd-seg-mastered" },
  ];
  const stateTotal = Math.max(1, states.reduce((t, x) => t + x.count, 0));

  // ── Subject breakdown ──
  const subjRows = useMemo(() => {
    const bySubject = s?.bySubject || {};
    const lapseMap = a?.lapseBySubject || {};
    const diffMap = a?.difficultyBySubject || {};
    return Object.entries(bySubject)
      .map(([name, x]) => {
        const l = lapseMap[name];
        return {
          name,
          total: x.total || 0,
          due: x.due || 0,
          masteredPct: x.total ? Math.round(((x.mastered || 0) / x.total) * 100) : 0,
          lapsePct: l?.total ? Math.round((l.lapsed / l.total) * 100) : 0,
          diff: diffMap[name]?.avg,
        };
      })
      .sort((a, b) => a.masteredPct - b.masteredPct || b.due - a.due);
  }, [s, a]);

  const { level, into: xpIn, needed: xpNeeded } = levelProgress(save.xp || 0);
  const xpPct = xpNeeded > 0 ? Math.min(100, (xpIn / xpNeeded) * 100) : 0;

  if (!s && !a) {
    return <div className="sd-root"><p className="sd-loading">Loading your stats…</p></div>;
  }

  return (
    <div className="sd-root">
      {/* ── Header ── */}
      <div className="sd-head">
        <div>
          <h2 className="sd-title">Your stats</h2>
          <p className="sd-sub">Memory, streaks and workload from spaced repetition</p>
        </div>
        <div className="sd-range">
          {[7, 30, 90].map((d) => (
            <button key={d} className={`sd-chip${days === d ? " on" : ""}`} onClick={() => setDays(d)}>{d}D</button>
          ))}
        </div>
      </div>

      {/* ── Top stat cards ── */}
      <div className="sd-cards">
        <div className="sd-card">
          <b style={{ color: retention != null && retention >= 85 ? "var(--sd-green)" : "var(--sd-amber)" }}>
            {retention != null ? `${retention}%` : "—"}
          </b>
          <span>Retention</span>
        </div>
        <div className="sd-card"><b style={{ color: (s?.dueCount || 0) > 0 ? "var(--sd-rose)" : "var(--sd-text)" }}>{s?.dueCount ?? "—"}</b><span>Due now</span></div>
        <div className="sd-card"><b style={{ color: "var(--sd-green)" }}>{s?.masteredCount ?? "—"}</b><span>Mastered</span></div>
        <div className="sd-card">
          <b style={{ color: "var(--sd-amber)" }}>{s?.streak ?? 0}d</b>
          <span>Streak{s?.longestStreak ? ` · best ${s.longestStreak}d` : ""}</span>
        </div>
      </div>

      {/* ── Activity chart + goal line ── */}
      <div className="sd-panel">
        <div className="sd-panel-head">
          <h3>Review activity</h3>
          <span className="sd-panel-meta">best {bestDay} · avg {avgPerDay}/day</span>
        </div>
        <div className="sd-chart">
          {goal > 0 && chartMax > goal && (
            <div className="sd-goalline" style={{ bottom: `${(goal / chartMax) * 100}%` }}>
              <span>goal {goal}</span>
            </div>
          )}
          {daysList.map((d, i) => (
            <div key={i} className={`sd-col${d.today ? " today" : ""}`}>
              <i style={{ height: `${Math.max(4, (d.count / chartMax) * 100)}%` }} title={`${d.count} reviewed`} />
              {days <= 7 && <span>{d.label}</span>}
            </div>
          ))}
        </div>
        {days > 7 && <p className="sd-note">Reviews per day — last {days} days</p>}
      </div>

      {/* ── Due forecast ── */}
      {forecast.length > 0 && (
        <div className="sd-panel">
          <div className="sd-panel-head">
            <h3>Coming up</h3>
            <span className="sd-panel-meta">{weekDue} due next 7 days</span>
          </div>
          <div className="sd-chart sm">
            {forecast.map((d, i) => (
              <div key={i} className={`sd-col fc${d.today ? " today" : ""}`}>
                <i style={{ height: `${Math.max(4, (d.count / forecastMax) * 100)}%` }} title={`${d.count} due`} />
                <span>{d.today ? "Now" : d.label}</span>
              </div>
            ))}
          </div>
          <p className="sd-note">Items your memory will ask for — reviewing today keeps tomorrow lighter</p>
        </div>
      )}

      {/* ── Memory state ── */}
      {s && s.totalItems > 0 && (
        <div className="sd-panel">
          <div className="sd-panel-head">
            <h3>Your memory</h3>
            <span className="sd-panel-meta">{s.totalItems} items</span>
          </div>
          <div className="sd-statebar">
            {states.filter((x) => x.count > 0).map((x) => (
              <div key={x.key} className={`sd-seg ${x.cls}`} style={{ width: `${(x.count / stateTotal) * 100}%` }} title={`${x.label}: ${x.count}`} />
            ))}
          </div>
          <div className="sd-legend">
            {states.map((x) => (
              <span key={x.key}><i className={`sd-dot ${x.cls}`} />{x.label} <b>{x.count}</b></span>
            ))}
          </div>
        </div>
      )}

      {/* ── XP / level ── */}
      <div className="sd-panel">
        <div className="sd-panel-head">
          <h3>Level {level}</h3>
          <span className="sd-panel-meta">{xpIn}/{xpNeeded} XP</span>
        </div>
        <div className="sd-xpbar"><i style={{ width: `${xpPct}%` }} /></div>
      </div>

      {/* ── Daily goal ── */}
      <div className="sd-panel">
        <div className="sd-panel-head">
          <h3>Daily review goal</h3>
          <span className="sd-panel-meta">items per day</span>
        </div>
        <div className="sd-goals">
          {GOAL_OPTS.map((g) => (
            <button
              key={g}
              className={`sd-goal${goal === g ? " on" : ""}`}
              disabled={goalSaving}
              onClick={() => saveDailyGoal(g)}
            >{g}</button>
          ))}
        </div>
      </div>

      {/* ── Subject breakdown ── */}
      {subjRows.length > 0 && (
        <div className="sd-panel">
          <div className="sd-panel-head">
            <h3>Subjects</h3>
            <span className="sd-panel-meta">worst first</span>
          </div>
          {subjRows.map((row) => (
            <div key={row.name} className="sd-subj">
              <div className="sd-subj-info">
                <h4>{row.name}</h4>
                <span>
                  {row.total} items{row.due > 0 ? ` · ${row.due} due` : ""}
                  {row.diff ? ` · diff ${row.diff.toFixed ? row.diff.toFixed(1) : row.diff}/10` : ""}
                  {row.lapsePct > 0 ? ` · ${row.lapsePct}% ever missed` : ""}
                </span>
              </div>
              <div className="sd-subj-bar"><i style={{ width: `${row.masteredPct}%` }} /></div>
              <span className="sd-subj-pct">{row.masteredPct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Badges ── */}
      <AchievementsBadges badges={BADGES} stats={stats} history={history} subjects={subjects} />
    </div>
  );
}
