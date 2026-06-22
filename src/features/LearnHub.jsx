import React, { useState, useEffect, useMemo } from "react";
import { callAI } from "../lib/aiClient";
import MarkdownText from "../components/MarkdownText.jsx";
import DepartmentSwitcher from "../components/learn/DepartmentSwitcher.jsx";
import CourseCustomizer, { loadUserCourses } from "../components/learn/CourseCustomizer.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function masteryLevel(pct) {
  if (pct >= 81) return { label: "Mastered", color: "#10b981", icon: "🏆" };
  if (pct >= 51) return { label: "Practiced", color: "#3b82f6", icon: "💪" };
  if (pct >= 21) return { label: "Learning", color: "#f59e0b", icon: "📖" };
  return { label: "Beginner", color: "#6b7280", icon: "🌱" };
}

function getDueCount(srData, subjectId) {
  const now = Date.now();
  const deck = srData?.[subjectId] || {};
  return Object.values(deck).filter((c) => !c.nextReview || c.nextReview <= now).length;
}

function getSubjectHistory(history, subjectId) {
  return (history || []).filter(
    (h) => h.subjectId === subjectId || h.sourceId === subjectId || h.source?.id === subjectId
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Ring
// ─────────────────────────────────────────────────────────────────────────────
function ProgressRing({ pct = 0, size = 56, stroke = 4, color = "#10b981" }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>
        {pct}%
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject Card
// ─────────────────────────────────────────────────────────────────────────────
function SubjectCard({ s, mastery, srData, history, onSelect, isSelected }) {
  const pct = Math.round(mastery?.[s.id] || 0);
  const { label: lvlLabel, color: lvlColor, icon: lvlIcon } = masteryLevel(pct);
  const due = getDueCount(srData, s.id);
  const sessions = getSubjectHistory(history, s.id).length;
  const accent = s.accent || "#10b981";

  return (
    <button
      onClick={() => onSelect(s.id)}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${accent}20, ${accent}0a)`
          : "rgba(15,23,42,0.7)",
        border: isSelected ? `2px solid ${accent}` : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "18px 16px", cursor: "pointer",
        textAlign: "left", width: "100%", display: "flex", flexDirection: "column",
        gap: 12, transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{s.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{s.label}</div>
            <div style={{ fontSize: 12, color: lvlColor, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              {lvlIcon} {lvlLabel}
            </div>
          </div>
        </div>
        <ProgressRing pct={pct} color={accent} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>📝 {sessions} sessions</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>❓ {s.questions?.length || 0} Qs</span>
        {due > 0 && (
          <span style={{
            fontSize: 11, color: "#f59e0b",
            background: "rgba(245,158,11,0.12)", padding: "2px 8px", borderRadius: 20,
          }}>
            🔄 {due} due
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────────────────────
function HubOverview({ s, mastery, history, srData, wrongCounts, onTab }) {
  const pct = Math.round(mastery?.[s.id] || 0);
  const { label: lvlLabel, color: lvlColor, icon: lvlIcon } = masteryLevel(pct);
  const due = getDueCount(srData, s.id);
  const sessions = getSubjectHistory(history, s.id);
  const lastDate = sessions[sessions.length - 1]?.date
    ? new Date(sessions[sessions.length - 1].date).toLocaleDateString()
    : "Never";

  const weakTopics = Object.entries(wrongCounts || {})
    .filter(([k]) => k.startsWith(s.id + "-"))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  let recommendation = "Start a Practice session to build mastery!";
  if (due > 0) recommendation = `You have ${due} flashcard${due > 1 ? "s" : ""} due for review.`;
  else if (pct >= 70) recommendation = "Excellent progress! Try a full Exam to test yourself.";
  else if (sessions.length > 0) recommendation = "Keep going — tackle weak areas to improve mastery.";

  const accent = s.accent || "#10b981";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 20,
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <ProgressRing pct={pct} size={72} stroke={6} color={lvlColor} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{lvlIcon} {lvlLabel}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Last studied: {lastDate}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Total sessions: {sessions.length}</div>
        </div>
      </div>

      <div style={{
        background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: 10, padding: 14,
      }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: "#7dd3fc", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>💡 Next step</div>
        <div style={{ fontSize: 14, color: "#e2e8f0" }}>{recommendation}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { icon: "📝", label: "Practice", tab: "practice", color: "#10b981" },
          { icon: "🎓", label: "Exam", tab: "exam", color: "#3b82f6" },
          { icon: "🔄", label: `Flashcards${due > 0 ? ` (${due})` : ""}`, tab: "flashcards", color: "#f59e0b" },
          { icon: "📑", label: "Outline", tab: "outline", color: "#8b5cf6" },
        ].map(({ icon, label, tab, color }) => (
          <button key={tab} onClick={() => onTab(tab)} style={{
            background: `${color}12`, border: `1px solid ${color}30`,
            borderRadius: 10, padding: "12px 10px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            color: "#e2e8f0", fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {weakTopics.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠️ Weak areas</div>
          {weakTopics.map(([key, count]) => (
            <div key={key} style={{
              display: "flex", justifyContent: "space-between",
              background: "rgba(239,68,68,0.06)", borderRadius: 8, padding: "8px 12px", marginBottom: 6,
            }}>
              <span style={{ fontSize: 13, color: "#fca5a5" }}>{key.split("-").slice(1).join(" ") || key}</span>
              <span style={{ fontSize: 12, color: "#f87171" }}>{count}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Lessons
// ─────────────────────────────────────────────────────────────────────────────
function HubLessons({ s }) {
  const [expanded, setExpanded] = useState(null);

  if (!s.lessons?.length) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>No lessons yet</div>
        <div style={{ fontSize: 13 }}>Lessons for this subject are coming soon.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 13 }}>Read each lesson, then practice to lock it in.</p>
      {s.lessons.map((lesson, i) => (
        <div key={i} style={{
          background: "rgba(15,23,42,0.6)", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              width: "100%", background: "none", border: "none", padding: "14px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer", color: "#f1f5f9",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14, textAlign: "left" }}>📖 {lesson.title}</span>
            <span style={{ color: "#475569", fontSize: 14, flexShrink: 0, marginLeft: 8 }}>{expanded === i ? "▲" : "▼"}</span>
          </button>
          {expanded === i && (
            <div style={{ padding: "0 16px 16px", color: "#cbd5e1", fontSize: 13, lineHeight: 1.75 }}>
              {lesson.content}
              {lesson.resources?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 600, color: "#7dd3fc", marginBottom: 8, fontSize: 12, textTransform: "uppercase" }}>Resources</div>
                  {lesson.resources.map((r, j) => (
                    <a key={j} href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 6, color: "#60a5fa", fontSize: 13, marginBottom: 6, textDecoration: "none" }}>
                      <span>{r.type === "video" ? "🎥" : "📄"}</span>{r.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Practice  (inline session with instant feedback + AI explain)
// ─────────────────────────────────────────────────────────────────────────────
const BASE2 = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const XP_PER_CORRECT_PRACTICE = 5; // reduced vs exam (10)

function HubPractice({ s, mastery, token, completeSession, startSubjectPractice, demoMode, aiConfig, setMastery, setWrongCounts }) {
  const [phase, setPhase]           = useState("setup");
  const [qCount, setQCount]         = useState(10);
  const [customCount, setCustomCount] = useState(""); // user-typed custom number
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [showTopicDrop, setShowTopicDrop] = useState(false);
  const [quickFilter, setQuickFilter] = useState("all"); // all | wrong | unseen | remaining
  const [showQMap, setShowQMap]       = useState(false);
  const [questions, setQuestions]   = useState([]);
  const [current, setCurrent]       = useState(0);
  const [selected, setSelected]     = useState(null);
  const [answered, setAnswered]     = useState(false);
  const [score, setScore]           = useState(0);
  const [xp, setXp]                 = useState(0);
  const [xpFlash, setXpFlash]       = useState(null);
  const [practiceStreak, setPracticeStreak] = useState(0);
  const [results, setResults]       = useState([]);
  const [sessionStart]              = useState(Date.now);
  const [startMastery, setStartMastery] = useState(0);
  const [aiExpl, setAiExpl]         = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  // Grid data: map of questionId -> { status: 'correct'|'wrong'|'unseen', attemptCount }
  const [gridMap, setGridMap]       = useState({});
  const [gridLoading, setGridLoading] = useState(false);

  const maxQ = s.questions?.length || 0;
  const curMastery = Math.round(mastery?.[s.id] || 0);
  const { label: masteryLabel, color: masteryColor } = masteryLevel(curMastery);

  // Restore persisted filter prefs + cached grid whenever subject changes
  useEffect(() => {
    if (!s.id) return;
    try {
      const prefsRaw = localStorage.getItem(`sc_practice_prefs_${s.id}`);
      if (prefsRaw) {
        const p = JSON.parse(prefsRaw);
        if (p.quickFilter) setQuickFilter(p.quickFilter);
        if ("selectedTopic" in p) setSelectedTopic(p.selectedTopic);
        if (p.qCount !== undefined) setQCount(p.qCount);
      } else {
        setQuickFilter("all"); setSelectedTopic(null);
      }
      const gridRaw = localStorage.getItem(`sc_practice_grid_${s.id}`);
      if (gridRaw) setGridMap(JSON.parse(gridRaw));
      else setGridMap({});
    } catch {}
  }, [s.id]);

  // Save filter prefs whenever they change
  useEffect(() => {
    if (!s.id) return;
    try {
      localStorage.setItem(`sc_practice_prefs_${s.id}`, JSON.stringify({ quickFilter, selectedTopic, qCount }));
    } catch {}
  }, [s.id, quickFilter, selectedTopic, qCount]);

  // Fetch per-question mastery grid from backend and update cache
  useEffect(() => {
    if (!s.id || !token) return;
    setGridLoading(true);
    let token_ = typeof token === "string" ? token : "";
    if (!token_) try { token_ = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken || ""; } catch {}
    fetch(`${BASE2}/api/mastery/grid/${s.id}`, {
      headers: { Authorization: `Bearer ${token_}` },
    })
      .then(r => r.ok ? r.json() : { grid: [] })
      .then(data => {
        const map = {};
        (data.grid || []).forEach(g => { map[g.id] = g; });
        if (Object.keys(map).length > 0) {
          setGridMap(map);
          try { localStorage.setItem(`sc_practice_grid_${s.id}`, JSON.stringify(map)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setGridLoading(false));
  }, [s.id, token]);

  // Cache grid on every local (optimistic) update
  useEffect(() => {
    if (!s.id || Object.keys(gridMap).length === 0) return;
    try { localStorage.setItem(`sc_practice_grid_${s.id}`, JSON.stringify(gridMap)); } catch {}
  }, [s.id, gridMap]);

  // Coverage stats derived from grid
  const masteredCount = useMemo(() => Object.values(gridMap).filter(g => g.status === "correct").length, [gridMap]);
  const wrongCount    = useMemo(() => Object.values(gridMap).filter(g => g.status === "wrong").length, [gridMap]);
  const unseenCount   = useMemo(() => maxQ - Object.keys(gridMap).length, [gridMap, maxQ]);

  // Build topic list from q.topic strings
  const topicGroups = useMemo(() => {
    const map = {};
    (s.questions || []).forEach(q => {
      const t = q.topic || "General";
      if (!map[t]) map[t] = 0;
      map[t]++;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [s.questions]);
  const showTopicPicker = topicGroups.length >= 1;

  function buildPool() {
    let pool = [...(s.questions || [])];
    // Topic filter
    if (selectedTopic) {
      const filtered = pool.filter(q => (q.topic || "General") === selectedTopic);
      if (filtered.length > 0) pool = filtered;
    }
    // Quick-filter modes — always apply filter, even if it results in 0 (so user sees "No questions match")
    if (quickFilter === "wrong") {
      pool = pool.filter(q => gridMap[q.id]?.status === "wrong");
    } else if (quickFilter === "unseen") {
      pool = pool.filter(q => !gridMap[q.id]);
    } else if (quickFilter === "remaining") {
      pool = pool.filter(q => gridMap[q.id]?.status !== "correct");
    }
    // Smart ordering: unseen first, then wrong, then mastered
    pool.sort((a, b) => {
      const order = { unseen: 0, wrong: 1, correct: 2 };
      const aStatus = gridMap[a.id]?.status || "unseen";
      const bStatus = gridMap[b.id]?.status || "unseen";
      const diff = (order[aStatus] ?? 0) - (order[bStatus] ?? 0);
      if (diff !== 0) return diff;
      return Math.random() - 0.5; // shuffle within tier
    });
    return pool;
  }

  function startPractice() {
    if (!maxQ) return;
    let pool = buildPool();
    const count = customCount !== "" ? Math.min(Math.max(1, parseInt(customCount) || 1), pool.length)
                : qCount === "all" ? pool.length
                : Math.min(parseInt(qCount), pool.length);
    pool = pool.slice(0, count);
    setStartMastery(Math.round(mastery?.[s.id] || 0));
    setQuestions(pool);
    setCurrent(0); setSelected(null); setAnswered(false);
    setScore(0); setXp(0); setPracticeStreak(0); setResults([]); setAiExpl("");
    setPhase("practicing");
  }

  function handleAnswer(idx) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const q = questions[current];
    const correct = idx === q.answer;
    const newStreak = correct ? practiceStreak + 1 : 0;
    const bonus = correct && newStreak > 0 && newStreak % 3 === 0 ? 5 : 0;
    const gained = correct ? XP_PER_CORRECT_PRACTICE + bonus : 0;
    if (correct) setScore(p => p + 1);
    setPracticeStreak(newStreak);
    setXp(p => p + gained);
    setXpFlash(correct ? (bonus > 0 ? `+${gained} XP 🔥 Streak!` : `+${gained} XP`) : "No XP");
    setTimeout(() => setXpFlash(null), 1800);
    setResults(p => [...p, { correct, q, chosen: idx, xpGained: gained, questionId: q.id }]);
    setAiExpl("");
    // Optimistically update local grid so dots refresh
    if (q.id) {
      setGridMap(prev => ({
        ...prev,
        [q.id]: { ...(prev[q.id] || {}), id: q.id, status: correct ? "correct" : "wrong", attemptCount: (prev[q.id]?.attemptCount || 0) + 1 },
      }));
    }
    if (setWrongCounts && q.key) {
      setWrongCounts(prev => ({
        ...prev,
        [q.key]: correct ? Math.max((prev[q.key] || 0) - 1, 0) : (prev[q.key] || 0) + 1,
      }));
    }
  }

  function next() {
    if (current + 1 >= questions.length) {
      finishSession();
      return;
    }
    setCurrent(c => c + 1);
    setSelected(null); setAnswered(false); setAiExpl("");
  }

  function finishSession() {
    setPhase("complete");
    const finalResults = results;
    const finalScore   = score;
    const seconds      = Math.round((Date.now() - sessionStart) / 1000);
    // Submit mastery to backend (updates per-question + subject mastery %)
    const masteryPayload = finalResults
      .filter(r => r.questionId)
      .map(r => ({ questionId: r.questionId, correct: r.correct }));
    if (masteryPayload.length > 0) {
      import("../lib/mastery.js").then(({ submitMasterySession }) => {
        submitMasterySession(s.id, masteryPayload, null).then(res => {
          if (res?.masteryPct !== undefined && setMastery) {
            setMastery(prev => ({ ...prev, [s.id]: res.masteryPct }));
          }
        });
      });
    }
    // Wire into completeSession for general XP, streak, leaderboard, history
    if (completeSession) {
      completeSession(
        {
          mode: "practice",
          score: finalScore,
          total: questions.length,
          seconds,
          streakBonus: 0,
          results: finalResults.map(r => ({
            questionId: r.questionId || r.q?.key,
            selected: r.chosen ?? 0,
            correct: r.correct,
          })),
        },
        s
      );
    }
  }

  async function getAIExplain() {
    const q = questions[current];
    if (!aiConfig?.apiKey && aiConfig?.provider !== "openrouter") {
      setAiExpl("Add an AI API key in Settings to unlock AI explanations.");
      return;
    }
    setAiLoading(true);
    try {
      const prompt = `You are a helpful study tutor. A student just answered this question:\n\nQuestion: ${q.q}\nOptions: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(" | ")}\nCorrect answer: ${q.options[q.answer]}\n\nGive a clear, concise explanation (2-3 sentences) of why this answer is correct. Be educational and encouraging.`;
      const reply = await callAI(prompt, aiConfig);
      setAiExpl(reply);
    } catch {
      setAiExpl("Could not get AI explanation. Check your AI settings.");
    }
    setAiLoading(false);
  }

  // ── No questions ─────────────────────────────────────────
  if (!maxQ) return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
      <div style={{ fontWeight: 600 }}>No questions available yet</div>
    </div>
  );

  // ── Setup ────────────────────────────────────────────────
  if (phase === "setup") {
    const pool = buildPool();
    const poolSize = pool.length;
    const presetCounts = [5, 10, 15, 20, 30].filter(n => n <= poolSize);
    const effectiveCount = customCount !== ""
      ? Math.min(Math.max(1, parseInt(customCount) || 1), poolSize)
      : qCount === "all" ? poolSize : Math.min(parseInt(qCount), poolSize);
    const DOT_COLORS = { correct: "#10b981", wrong: "#ef4444", unseen: "rgba(255,255,255,0.1)" };
    const allQIds = (s.questions || []).map(q => q.id).filter(Boolean);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Mastery hero + coverage bar */}
        <div style={{
          background: `linear-gradient(135deg, ${masteryColor}18, ${masteryColor}06)`,
          border: `1px solid ${masteryColor}30`,
          borderRadius: 14, padding: "14px 18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width="54" height="54" viewBox="0 0 54 54">
                <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5"/>
                <circle cx="27" cy="27" r="22" fill="none" stroke={masteryColor} strokeWidth="5"
                  strokeDasharray={`${(curMastery / 100) * 138.2} 138.2`}
                  strokeLinecap="round" transform="rotate(-90 27 27)"/>
              </svg>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:800, color:masteryColor }}>{curMastery}%</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{masteryLabel}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {masteredCount}/{maxQ} mastered · {wrongCount} wrong · {unseenCount} unseen
              </div>
              <div style={{ fontSize: 11, color: masteryColor, marginTop: 3, fontWeight: 600 }}>
                🔥 3-correct streak = +5 bonus XP · {XP_PER_CORRECT_PRACTICE} XP/correct
              </div>
            </div>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg, ${masteryColor}, ${masteryColor}aa)`,
              width: `${maxQ > 0 ? (masteredCount / maxQ) * 100 : 0}%`, transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 4, textAlign: "right" }}>
            {maxQ > 0 ? Math.round((masteredCount / maxQ) * 100) : 0}% coverage — 100% mastery requires every question correct
          </div>
        </div>

        {/* Topic picker — dropdown */}
        {showTopicPicker && (
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>📖 Topic</div>
            <button
              onClick={() => setShowTopicDrop(v => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: selectedTopic ? "rgba(57,73,171,0.18)" : "rgba(255,255,255,0.04)",
                border: selectedTopic ? "1px solid rgba(57,73,171,0.5)" : "1px solid rgba(255,255,255,0.08)",
                color: selectedTopic ? "#a5b4fc" : "#94a3b8",
              }}
            >
              <span>📖 {selectedTopic || "All topics"}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{showTopicDrop ? "▲" : "▼"}</span>
            </button>

            {showTopicDrop && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                maxHeight: 260, overflowY: "auto",
              }}>
                {[{ name: null, count: s.questions?.length || 0 }, ...topicGroups].map(t => {
                  const active = t.name === selectedTopic;
                  return (
                    <button
                      key={t.name ?? "__all__"}
                      onClick={() => { setSelectedTopic(t.name); setShowTopicDrop(false); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "11px 16px", background: active ? "rgba(57,73,171,0.22)" : "transparent",
                        border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                        cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
                        color: active ? "#a5b4fc" : "#94a3b8", textAlign: "left",
                      }}
                    >
                      <span>{t.name ? `📖 ${t.name}` : "📚 All topics"}</span>
                      <span style={{ fontSize: 11, opacity: 0.55 }}>
                        {active ? "✓ " : ""}{t.count}q
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick-filter chips */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Focus on</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "all",       label: `All (${maxQ})`,                             color: "#10b981" },
              { id: "unseen",    label: `⚫ Unseen (${unseenCount})`,                 color: "#6b7280" },
              { id: "wrong",     label: `🔴 Review wrong (${wrongCount})`,            color: "#ef4444" },
              { id: "remaining", label: `⏳ Master remaining (${unseenCount + wrongCount})`, color: "#f59e0b" },
            ].map(f => (
              <button key={f.id} onClick={() => setQuickFilter(f.id)} style={{
                padding: "7px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: quickFilter === f.id ? `${f.color}22` : "rgba(255,255,255,0.03)",
                border: quickFilter === f.id ? `1px solid ${f.color}` : "1px solid rgba(255,255,255,0.08)",
                color: quickFilter === f.id ? f.color : "#475569",
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Per-question dot grid — React-controlled (replaces <details> which breaks on mobile) */}
        {!gridLoading && allQIds.length > 0 && (
          <div>
            <button
              onClick={() => setShowQMap(v => !v)}
              style={{
                background: "none", border: "none", padding: "4px 0",
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer", width: "100%",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {showQMap ? "▼" : "▶"} Question Map
              </span>
              <span style={{ fontWeight: 400, color: "#334155", fontSize: 11 }}>🟢 mastered · 🔴 wrong · ⚫ unseen</span>
            </button>
            {showQMap && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 10 }}>
                {allQIds.slice(0, 200).map(id => {
                  const status = gridMap[id]?.status || "unseen";
                  return (
                    <div key={id} title={status} style={{
                      width: 10, height: 10, borderRadius: 2,
                      background: DOT_COLORS[status] || DOT_COLORS.unseen,
                      transition: "background 0.3s",
                    }} />
                  );
                })}
                {allQIds.length > 200 && (
                  <span style={{ fontSize: 10, color: "#475569", alignSelf: "center" }}>+{allQIds.length - 200} more</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Question count chips + custom input */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Number of questions</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {presetCounts.map(n => (
              <button key={n} onClick={() => { setQCount(n); setCustomCount(""); }} style={{
                padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: qCount === n && customCount === "" ? "#10b981" : "rgba(16,185,129,0.08)",
                border: qCount === n && customCount === "" ? "1px solid #10b981" : "1px solid rgba(16,185,129,0.2)",
                color: qCount === n && customCount === "" ? "#fff" : "#6ee7b7",
              }}>{n}</button>
            ))}
            <button onClick={() => { setQCount("all"); setCustomCount(""); }} style={{
              padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: qCount === "all" && customCount === "" ? "#10b981" : "rgba(16,185,129,0.08)",
              border: qCount === "all" && customCount === "" ? "1px solid #10b981" : "1px solid rgba(16,185,129,0.2)",
              color: qCount === "all" && customCount === "" ? "#fff" : "#6ee7b7",
            }}>All ({poolSize})</button>
            <input
              type="number" min="1" max={poolSize} placeholder="Custom #"
              value={customCount}
              onChange={e => setCustomCount(e.target.value)}
              style={{
                width: 80, padding: "8px 10px", borderRadius: 20,
                background: customCount !== "" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                border: customCount !== "" ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.12)",
                color: "#e2e8f0", fontSize: 13, fontWeight: 700, outline: "none",
              }}
            />
          </div>
        </div>

        {/* XP preview + start */}
        <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)",
          borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#6ee7b7" }}>✅ Instant Feedback · Smart Ordering</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Unseen → Wrong → Mastered · AI Explain after each answer</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24" }}>+{effectiveCount * XP_PER_CORRECT_PRACTICE} XP max</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>if all correct</div>
          </div>
        </div>

        <button onClick={startPractice} disabled={poolSize === 0} style={{
          background: poolSize === 0 ? "#1e293b" : "linear-gradient(135deg,#047857,#10b981)",
          color: poolSize === 0 ? "#475569" : "#fff", border: "none", borderRadius: 12,
          padding: "15px", fontSize: 15, fontWeight: 700,
          cursor: poolSize === 0 ? "not-allowed" : "pointer",
        }}>
          {poolSize === 0 ? "No questions match this filter" : `📝 Start Practice · ${effectiveCount} questions`}
        </button>

        {/* Full session modes */}
        <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 11, color: "#334155", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Or launch a full session</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { id: "adaptive",      label: "🎯 Adaptive", color: "#3b82f6" },
              { id: "spaced",        label: "🧠 Spaced",   color: "#8b5cf6" },
              { id: "practicehints", label: "💡 Hints",    color: "#f59e0b" },
            ].map(m => (
              <button key={m.id} onClick={() => startSubjectPractice(s.id, m.id)} style={{
                padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                background: `${m.color}10`, border: `1px solid ${m.color}30`, color: m.color,
              }}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Practicing ───────────────────────────────────────────
  if (phase === "practicing") {
    const q = questions[current];
    const progressPct = ((current + (answered ? 1 : 0)) / questions.length) * 100;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Progress bar + live XP + streak */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg,#047857,#10b981)", width: `${progressPct}%`, transition: "width 0.3s ease", borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{current + 1}/{questions.length}</span>
          <span style={{ fontSize: 12, color: "#fbbf24", whiteSpace: "nowrap", fontWeight: 800 }}>⚡{xp} XP</span>
          {practiceStreak >= 2 && <span style={{ fontSize: 11, color: "#f97316", fontWeight: 700, whiteSpace: "nowrap" }}>🔥{practiceStreak}x</span>}
        </div>

        {/* XP flash */}
        {xpFlash && (
          <div style={{
            textAlign: "center", fontSize: 15, fontWeight: 800,
            color: xpFlash.startsWith("+") ? "#34d399" : "#64748b",
            animation: "xpPop 1.8s ease forwards",
          }}>{xpFlash}</div>
        )}
        <style>{`@keyframes xpPop { 0%{opacity:1;transform:translateY(0) scale(1)} 50%{transform:translateY(-6px) scale(1.1)} 100%{opacity:0;transform:translateY(-14px)} }`}</style>

        {/* Difficulty + question */}
        <div style={{ background: "rgba(15,23,42,0.7)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
          {q.difficulty && (
            <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {q.difficulty}
            </div>
          )}
          <div style={{ fontSize: 14, color: "#f1f5f9", lineHeight: 1.65, fontWeight: 500 }}>{q.q}</div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options.map((opt, idx) => {
            let bg = "rgba(15,23,42,0.5)";
            let border = "1px solid rgba(255,255,255,0.07)";
            let color = "#e2e8f0";
            let trailIcon = null;
            if (answered) {
              if (idx === q.answer)        { bg = "rgba(16,185,129,0.15)";  border = "1px solid #10b981"; color = "#6ee7b7"; trailIcon = "✓"; }
              else if (idx === selected)   { bg = "rgba(239,68,68,0.15)";   border = "1px solid #ef4444"; color = "#fca5a5"; trailIcon = "✕"; }
              else                         { bg = "rgba(15,23,42,0.25)";   color = "#334155"; }
            }
            return (
              <button key={idx} onClick={() => handleAnswer(idx)} disabled={answered} style={{
                background: bg, border, borderRadius: 10, padding: "11px 14px",
                cursor: answered ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 10,
                color, fontSize: 13, fontWeight: 500,
                transition: "all 0.15s", textAlign: "left",
              }}>
                <span style={{ fontWeight: 800, fontSize: 12, opacity: 0.5, flexShrink: 0, width: 16 }}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span style={{ flex: 1 }}>{opt}</span>
                {trailIcon && <span style={{ fontWeight: 800, flexShrink: 0 }}>{trailIcon}</span>}
              </button>
            );
          })}
        </div>

        {/* Feedback section */}
        {answered && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Result banner */}
            <div style={{
              borderRadius: 10, padding: "10px 14px",
              background: selected === q.answer ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              border: selected === q.answer ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 20 }}>{selected === q.answer ? "✅" : "❌"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: selected === q.answer ? "#6ee7b7" : "#fca5a5" }}>
                {selected === q.answer ? "Correct!" : `Correct: ${q.options[q.answer]}`}
              </span>
            </div>

            {/* Built-in explanation */}
            {q.explanation && (
              <div style={{
                background: "rgba(255,255,255,0.03)", borderRadius: 10,
                padding: "10px 14px", fontSize: 13, color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.05)", lineHeight: 1.65,
              }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>📖 </span>{q.explanation}
              </div>
            )}

            {/* AI explain button + output */}
            <button onClick={getAIExplain} disabled={aiLoading} style={{
              alignSelf: "flex-start", padding: "8px 16px", borderRadius: 8,
              cursor: aiLoading ? "wait" : "pointer",
              background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)",
              color: "#c4b5fd", fontSize: 12, fontWeight: 700, opacity: aiLoading ? 0.7 : 1,
            }}>
              {aiLoading ? "⏳ Thinking…" : "🤖 AI Explain"}
            </button>

            {aiExpl && (
              <div style={{
                background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: 10, padding: "12px 14px",
                fontSize: 13, color: "#ddd6fe", lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 700, color: "#c4b5fd", marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>🤖 AI Explanation</div>
                <MarkdownText>{aiExpl}</MarkdownText>
              </div>
            )}

            <button onClick={next} style={{
              background: "linear-gradient(135deg,#047857,#10b981)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              {current + 1 >= questions.length ? "See Results →" : "Next Question →"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Complete ─────────────────────────────────────────────
  const pct         = Math.round((score / questions.length) * 100);
  const emoji       = pct >= 80 ? "🏆" : pct >= 60 ? "💪" : pct >= 40 ? "📖" : "🌱";
  const grade       = pct >= 80 ? "Excellent!" : pct >= 60 ? "Good work!" : pct >= 40 ? "Keep practising" : "Needs work";
  const finalMastery = Math.round(mastery?.[s.id] || 0);
  const masteryDelta = finalMastery - startMastery;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{emoji}</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: "#f1f5f9" }}>{pct}%</div>
        <div style={{ fontSize: 16, color: "#94a3b8", marginTop: 4 }}>{grade}</div>
        <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>{score}/{questions.length} correct</div>
      </div>

      {/* XP + mastery delta summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
          borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24" }}>+{xp} XP</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>earned this session</div>
        </div>
        <div style={{
          background: masteryDelta >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: masteryDelta >= 0 ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12, padding: "12px 14px", textAlign: "center"
        }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: masteryDelta >= 0 ? "#10b981" : "#ef4444" }}>
            {masteryDelta >= 0 ? "+" : ""}{masteryDelta}%
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>mastery change</div>
        </div>
      </div>

      {/* Per-question breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
        {results.map((r, i) => (
          <div key={i} style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            background: r.correct ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)",
            borderRadius: 8, padding: "9px 12px",
            border: r.correct ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(239,68,68,0.15)",
          }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{r.correct ? "✅" : "❌"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.45 }}>{r.q.q}</div>
              {!r.correct && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>Correct: {r.q.options[r.q.answer]}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setPhase("setup")} style={{
          flex: 1, background: "linear-gradient(135deg,#047857,#10b981)",
          color: "#fff", border: "none", borderRadius: 10,
          padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>🔄 Practice Again</button>
        <button onClick={() => startSubjectPractice(s.id, "exam")} style={{
          flex: 1, background: "rgba(59,130,246,0.1)",
          border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd",
          borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>🎓 Take Exam</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Exam
// ─────────────────────────────────────────────────────────────────────────────
function HubExam({ s, startSubjectPractice, demoMode }) {
  const [qCount, setQCount] = useState("all");
  const [minutes, setMinutes] = useState("");

  const selectStyle = {
    background: "#0f172a", border: "1px solid #334155",
    borderRadius: 6, color: "#f1f5f9", padding: "5px 10px",
    fontSize: 13, cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#93c5fd", marginBottom: 4 }}>🎓 {s.label} Exam</div>
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Full timed exam. Tests your complete understanding of this subject.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13, color: "#cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Questions</span>
          <select value={qCount} onChange={e => setQCount(e.target.value)} style={selectStyle}>
            <option value="all">All ({s.questions?.length || 0})</option>
            {[10, 20, 30, 50].filter(n => n < (s.questions?.length || 0)).map(n => (
              <option key={n} value={n}>{n} questions</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: "#cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Time limit</span>
          <select value={minutes} onChange={e => setMinutes(e.target.value)} style={selectStyle}>
            <option value="">Auto (~1.5 min/Q)</option>
            {[10, 15, 20, 30, 45, 60, 90, 120].map(n => (
              <option key={n} value={n}>{n} min</option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={() => startSubjectPractice(s.id, "exam", qCount, minutes || null)}
        style={{
          background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
          color: "#fff", border: "none", borderRadius: 12,
          padding: "15px", fontSize: 15, fontWeight: 700,
          cursor: "pointer", letterSpacing: "0.01em",
        }}
      >
        🎓 Start Exam
      </button>

      {demoMode && (
        <p style={{ fontSize: 12, color: "#475569", textAlign: "center", margin: 0 }}>
          Free trial: limited to 10 questions per exam.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Flashcards
// ─────────────────────────────────────────────────────────────────────────────
function HubFlashcards({ s, srData, customFlashcards, setCustomFlashcards, demoMode }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [flip, setFlip] = useState(null);

  const subjectCards = (customFlashcards || []).filter(c => c.subjectId === s.id);
  const due = getDueCount(srData, s.id);

  function addCard() {
    if (!front.trim() || !back.trim()) return;
    const card = {
      id: `${s.id}-${Date.now()}`,
      subjectId: s.id,
      front: front.trim(), back: back.trim(),
      nextReview: Date.now(), easeFactor: 2.5, interval: 1, repetitions: 0,
    };
    setCustomFlashcards(prev => [...(prev || []), card]);
    setFront(""); setBack("");
  }

  function removeCard(id) {
    setCustomFlashcards(prev => (prev || []).filter(c => c.id !== id));
  }

  const inputStyle = {
    width: "100%", background: "#0f172a", border: "1px solid #1e293b",
    borderRadius: 8, padding: "9px 12px", color: "#f1f5f9",
    fontSize: 13, boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {due > 0 && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 12, padding: "14px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 600, color: "#fbbf24", fontSize: 14 }}>🔄 {due} cards due for review</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Review now for best retention</div>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Your Cards ({subjectCards.length})
        </div>
        {subjectCards.length === 0 ? (
          <p style={{ color: "#334155", fontSize: 13, margin: 0 }}>No flashcards yet. Add some below.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {subjectCards.map((card) => (
              <div
                key={card.id}
                style={{
                  background: "rgba(15,23,42,0.6)", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.05)", padding: "10px 12px",
                  cursor: "pointer",
                }}
                onClick={() => setFlip(flip === card.id ? null : card.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{card.front}</div>
                    {flip === card.id && (
                      <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {card.back}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeCard(card.id); }}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, padding: "0 0 0 8px", flexShrink: 0 }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 14, border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          ➕ New Flashcard
        </div>
        <input value={front} onChange={e => setFront(e.target.value)} placeholder="Front — question or term" style={{ ...inputStyle, marginBottom: 8 }} />
        <input value={back} onChange={e => setBack(e.target.value)} placeholder="Back — answer or definition" style={{ ...inputStyle, marginBottom: 10 }} />
        <button onClick={addCard} style={{
          background: "linear-gradient(135deg,#047857,#10b981)", color: "#fff",
          border: "none", borderRadius: 8, padding: "9px 20px",
          cursor: "pointer", fontWeight: 600, fontSize: 13,
        }}>
          Add Card
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Outline
// ─────────────────────────────────────────────────────────────────────────────
function HubOutline({ s, outlineProgress, setOutlineProgress }) {
  const [sem, setSem] = useState("sem1");
  const outlines = s.courseOutlines?.[sem] || [];
  const progress = outlineProgress?.[s.id] || {};

  function toggle(key) {
    const updated = { ...progress, [key]: !progress[key] };
    setOutlineProgress(prev => ({ ...prev, [s.id]: updated }));
  }

  const completed = outlines.filter((w, i) => progress[`week-${w.week}`]).length;
  const pct = outlines.length > 0 ? Math.round((completed / outlines.length) * 100) : 0;

  if (outlines.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📑</div>
        <div style={{ fontWeight: 600 }}>No course outline available</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        background: "rgba(255,255,255,0.02)", borderRadius: 12,
        padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)",
      }}>
        <ProgressRing pct={pct} size={52} stroke={5} color="#8b5cf6" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{completed}/{outlines.length} weeks covered</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Tick each week as you cover it</div>
        </div>
        {s.courseOutlines?.sem2?.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["sem1", "sem2"].map(s2 => (
              <button key={s2} onClick={() => setSem(s2)} style={{
                padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                background: sem === s2 ? "#8b5cf6" : "transparent",
                border: `1px solid ${sem === s2 ? "#8b5cf6" : "#334155"}`,
                color: sem === s2 ? "#fff" : "#64748b",
              }}>{s2.toUpperCase()}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 380, overflowY: "auto" }}>
        {outlines.map((week, i) => {
          const key = `week-${week.week}`;
          const done = !!progress[key];
          return (
            <div
              key={i} onClick={() => toggle(key)}
              style={{
                background: done ? "rgba(139,92,246,0.1)" : "rgba(15,23,42,0.5)",
                border: done ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.05)",
                borderRadius: 10, padding: "12px 14px",
                display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: done ? "none" : "2px solid #334155",
                background: done ? "#8b5cf6" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {done && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: done ? "#c4b5fd" : "#e2e8f0", lineHeight: 1.4 }}>
                  Week {week.week}: {week.title}
                </div>
                {week.lecturers?.length > 0 && (
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
                    {week.lecturers.join(" · ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject Hub Panel (slide-in from right)
// ─────────────────────────────────────────────────────────────────────────────
const HUB_TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "lessons",  label: "Lessons",  icon: "📖" },
  { id: "practice", label: "Practice", icon: "📝" },
  { id: "exam",     label: "Exam",     icon: "🎓" },
  { id: "flashcards", label: "Cards",  icon: "🔄" },
  { id: "outline",  label: "Outline",  icon: "📑" },
];

function SubjectHubPanel({ s, onClose, ...props }) {
  const [activeTab, setActiveTab] = useState("overview");
  const accent = s.accent || "#10b981";

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          .hub-panel-overlay { display: none !important; }
          .hub-panel-container {
            left: 0 !important;
            width: 100vw !important;
            border-left: none !important;
            box-shadow: none !important;
          }
          .hub-panel-content { max-width: 900px; margin: 0 auto; }
        }
      `}</style>
      <div className="hub-panel-overlay" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 8500, backdropFilter: "blur(2px)" }} />
      <div className="hub-panel-container" style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(540px, 100vw)",
        background: "#080f1a",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        zIndex: 8501, display: "flex", flexDirection: "column",
        animation: "learnHubSlideIn 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 12,
          background: `linear-gradient(135deg, ${accent}12, transparent)`,
        }}>
          {/* Small Back button */}
          <button onClick={onClose} style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8", cursor: "pointer", borderRadius: 8,
            padding: "5px 10px", fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>← Back</button>
          <span style={{ fontSize: 26 }}>{s.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9" }}>{s.label}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 1 }}>
              {s.questions?.length || 0} questions · {s.lessons?.length || 0} lessons
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: "flex", overflowX: "auto",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          scrollbarWidth: "none",
        }}>
          {HUB_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "11px 15px", fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", flexShrink: 0,
                color: activeTab === t.id ? accent : "#475569",
                borderBottom: activeTab === t.id ? `2px solid ${accent}` : "2px solid transparent",
                transition: "color 0.15s",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div className="hub-panel-content">
            {activeTab === "overview"   && <HubOverview   s={s} onTab={setActiveTab} {...props} />}
            {activeTab === "lessons"    && <HubLessons    s={s} />}
            {/* Keep HubPractice always mounted so grid/filters/session survive tab switches */}
            <div style={{ display: activeTab === "practice" ? "block" : "none" }}>
              <HubPractice s={s} mastery={props.mastery} {...props} />
            </div>
            {activeTab === "exam"       && <HubExam       s={s} {...props} />}
            {activeTab === "flashcards" && <HubFlashcards s={s} {...props} />}
            {activeTab === "outline"    && <HubOutline    s={s} {...props} />}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes learnHubSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LearnHub export
// ─────────────────────────────────────────────────────────────────────────────
export default function LearnHub({
  subjects,
  mastery,
  srData,
  wrongCounts,
  history,
  customFlashcards,
  setCustomFlashcards,
  outlineProgress,
  setOutlineProgress,
  demoMode,
  DEMO_LIMITS,
  token,
  completeSession,
  startSubjectPractice,
  startAdaptive,
  startSpacedReview,
  startWeakDrill,
  startErrorDrill,
  setActiveSession,
  toast,
  dueCards,
  aiConfig,
  setMastery,
  setWrongCounts,
  activeDept,
  activeYearLevel,
  onOpenDeptSwitcher,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [enabledIds, setEnabledIds] = useState(() => {
    const saved = loadUserCourses();
    return saved ? new Set(saved) : null;
  });

  const selectedSubject = useMemo(() => (subjects || []).find(s => s.id === selectedId), [subjects, selectedId]);

  // Filter subjects by active dept + year level, then by user enabled list
  const filteredSubjects = useMemo(() => {
    const all = subjects || [];

    // Dept courses always visible regardless of custom list
    let deptList = all;
    if (activeDept) {
      deptList = all.filter(s =>
        s.departmentId === activeDept.id ||
        s.subjectDepts?.some(d => d.departmentId === activeDept.id)
      );
      if (activeYearLevel)
        deptList = deptList.filter(s => !s.yearLevel || s.yearLevel === activeYearLevel);
    }

    if (!enabledIds) return deptList;

    // User has a custom list — also show any extra courses they added from other depts
    const deptIds = new Set(deptList.map(s => s.id));
    return all.filter(s => deptIds.has(s.id) || enabledIds.has(s.id));
  }, [subjects, activeDept, activeYearLevel, enabledIds]);

  const hubProps = {
    mastery, srData, wrongCounts, history,
    customFlashcards, setCustomFlashcards,
    outlineProgress, setOutlineProgress,
    demoMode, DEMO_LIMITS, token,
    completeSession,
    startSubjectPractice, startAdaptive,
    startSpacedReview, startWeakDrill, startErrorDrill,
    setActiveSession, toast, dueCards, aiConfig,
    setMastery, setWrongCounts,
  };

  function handleTopicPractice(subjectId, topicId, count) {
    startSubjectPractice(subjectId, "practice", count, null, topicId);
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
            📚 Learn Hub
          </h2>
          <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
            Pick a subject to study — practice, exam, flashcards, lessons & more inside.
          </p>
        </div>

        {/* Department + Year pills */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => onOpenDeptSwitcher?.()}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "20px", cursor: "pointer",
              border: activeDept ? "1.5px solid #3949ab" : "0.5px solid #1e2245",
              background: activeDept ? "#0f1535" : "#0a0b18",
              color: activeDept ? "#7986cb" : "#7b82b8", fontSize: "13px", fontWeight: 600,
            }}
          >
            {activeDept ? `${activeDept.icon || "🏛️"} ${activeDept.name}` : "🏛️ All Departments"} ▾
          </button>

          {activeDept && (
            <button
              onClick={() => onOpenDeptSwitcher?.()}
              style={{
                padding: "8px 14px", borderRadius: "20px", cursor: "pointer",
                border: "1.5px solid #f59e0b", background: "#1a1000",
                color: "#ffb74d", fontSize: "13px", fontWeight: 700,
              }}
            >
              Year {activeYearLevel} ▾
            </button>
          )}

          <button
            onClick={() => setShowCustomizer(true)}
            title="Customize my courses"
            style={{
              padding: "8px 12px", borderRadius: "20px", cursor: "pointer",
              border: "0.5px solid #1e2245", background: "#0a0b18",
              color: "#7b82b8", fontSize: "13px",
            }}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Cross-subject quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        <button
          onClick={startAdaptive}
          style={{ padding: "8px 16px", borderRadius: 20, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", color: "#93c5fd", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          🎯 Adaptive (all subjects)
        </button>
        <button
          onClick={startSpacedReview}
          style={{ padding: "8px 16px", borderRadius: 20, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.08)", color: "#c4b5fd", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          🧠 Spaced Review
        </button>
        {!demoMode && (
          <button
            onClick={startWeakDrill}
            style={{ padding: "8px 16px", borderRadius: 20, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#fca5a5", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            💪 Weak Drill
          </button>
        )}
      </div>

      {/* Empty state when dept filter yields nothing */}
      {filteredSubjects.length === 0 && (subjects || []).length > 0 && (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          background: "#0a0b18", borderRadius: "16px", border: "0.5px solid #1e2245",
        }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
          <div style={{ color: "#e8eaf6", fontWeight: 600, marginBottom: "8px" }}>No courses found</div>
          <div style={{ color: "#7b82b8", fontSize: "13px", marginBottom: "16px" }}>
            No courses match {activeDept ? activeDept.name : "your filter"}{activeYearLevel ? ` Year ${activeYearLevel}` : ""}.
          </div>
          <button
            onClick={() => onOpenDeptSwitcher?.()}
            style={{ padding: "10px 20px", background: "#1a237e", border: "none", borderRadius: "10px", color: "#e8eaf6", fontWeight: 600, cursor: "pointer" }}
          >
            Change Department
          </button>
        </div>
      )}

      {/* Subject grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {filteredSubjects.map(s => (
          <SubjectCard
            key={s.id}
            s={s}
            mastery={mastery}
            srData={srData}
            history={history}
            onSelect={(id) => setSelectedId(id)}
            isSelected={selectedId === s.id}
          />
        ))}
      </div>

      {selectedSubject && (
        <SubjectHubPanel
          s={selectedSubject}
          onClose={() => setSelectedId(null)}
          {...hubProps}
        />
      )}

      {/* Course customizer */}
      {showCustomizer && (
        <CourseCustomizer
          allSubjects={subjects || []}
          activeDept={activeDept}
          activeYearLevel={activeYearLevel}
          onClose={() => setShowCustomizer(false)}
          onCoursesChange={(ids) => setEnabledIds(new Set(ids))}
        />
      )}
    </div>
  );
}
