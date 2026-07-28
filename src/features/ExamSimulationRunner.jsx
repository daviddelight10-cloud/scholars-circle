import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Clock, Trophy, Zap, Flame } from "lucide-react";
import QuestionCard from "./QuestionCard.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

const fullscreenStyle = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "#060818", display: "flex", flexDirection: "column",
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptions(q) {
  if (!q.options) return q;
  const entries = Object.entries(q.options);
  const shuffled = shuffleArray(entries);
  const newOptions = {};
  const remap = {};
  shuffled.forEach(([origKey, val], i) => {
    const newKey = String.fromCharCode(65 + i);
    newOptions[newKey] = val;
    remap[origKey] = newKey;
  });
  return { ...q, options: newOptions, correct: remap[q.correct] || q.correct };
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function ExamSimulationRunner({ subject, resourceIds, questionCount = 20, timeLimitMin = 30, onBack, onStreakUpdate, onXpUpdate }) {
  const [phase, setPhase] = useState("config");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [configQuestions, setConfigQuestions] = useState(questionCount);
  const [configMinutes, setConfigMinutes] = useState(timeLimitMin);
  const [examError, setExamError] = useState("");
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  const examStartRef = useRef(0);
  const handleSubmitRef = useRef(null);

  const startExam = async (count, minutes) => {
    setLoading(true);
    setExamError("");
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (resourceIds) params.set("resourceIds", resourceIds.join(","));
    params.set("limit", String(count));

    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/due-mcqs?${params.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const enriched = shuffleArray((data.items || []).filter((i) => i.mcq))
        .slice(0, count)
        .map((i) => ({
          ...shuffleOptions(i.mcq),
          _resourceId: i.resourceId,
          _pageIndex: i.pageIndex,
          _resourceTitle: i.resource?.title,
        }));
      if (enriched.length === 0) {
        setExamError("No MCQ questions found. Add MCQ resources first, or try Spaced Review to initialize questions.");
        setLoading(false);
        return;
      }
      setItems(enriched);
      setTimeLeft(minutes * 60 * 1000);
      setPhase("exam");
      examStartRef.current = Date.now();
    } catch {
      setExamError("Failed to load exam questions. Please try again.");
      setPhase("config");
    }
    setLoading(false);
  };

  const handleSelect = (key) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: key }));
  };

  const handleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  };

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    let score = 0;
    const details = [];
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      const userAnswer = answers[i];
      const isCorrect = userAnswer === q.correct;
      if (isCorrect) score++;
      details.push({ resourceId: q._resourceId, questionIndex: q._pageIndex, correct: isCorrect, selected: userAnswer });
    }

    try {
      const firstResourceId = items[0]?._resourceId;
      const res = await fetch(`${API_BASE}/api/resources/quiz-attempts`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          resourceId: firstResourceId,
          score,
          total: items.length,
          details,
          mode: "exam",
        }),
      });
      const data = await res.json();
      setResults({ score, total: items.length, xpAwarded: data.xpAwarded, streak: data.streak, ...data });
      if (data.streak != null && onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
      if (data.xpAwarded > 0 && onXpUpdate) onXpUpdate(data.xpAwarded);
    } catch {
      setResults({ score, total: items.length });
    }
    setPhase("results");
    setSubmitting(false);
  }, [answers, items, submitting, onStreakUpdate, onXpUpdate]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  useEffect(() => {
    if (phase !== "exam" || paused) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, paused]);

  useEffect(() => {
    if (timeLeft === 0 && phase === "exam" && !submitting) {
      handleSubmitRef.current?.(true);
    }
  }, [timeLeft, phase, submitting]);

  if (phase === "config") {
    return (
      <div style={{ ...fullscreenStyle, alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "420px", width: "100%", padding: "20px" }}>
          <button onClick={onBack} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#5a6090" }}>
            <X size={22} />
          </button>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎓</div>
            <h2 style={{ color: "#c5c9e8", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Exam Simulation</h2>
            <p style={{ color: "#5a6090", fontSize: 13 }}>Configure your exam settings</p>
          </div>
          <ExamConfigField label="Number of Questions" value={configQuestions} onChange={setConfigQuestions} min={5} max={50} />
          <ExamConfigField label="Time Limit (minutes)" value={configMinutes} onChange={setConfigMinutes} min={5} max={120} />
          <div style={{ marginTop: "20px", padding: "12px 14px", background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", fontSize: "12px", color: "#7b82b8", lineHeight: 1.6 }}>
            ⚠️ No instant feedback. All questions reviewed at the end. Timer auto-submits when expired.
          </div>
          {examError && (
            <div style={{ marginTop: "12px", padding: "12px 14px", background: "#2a0f0f", border: "0.5px solid #6a2a2a", borderRadius: "10px", fontSize: "12px", color: "#ef9a9a", lineHeight: 1.6 }}>
              {examError}
            </div>
          )}
          <button
            onClick={() => startExam(configQuestions, configMinutes)}
            disabled={loading}
            style={{
              width: "100%", marginTop: "20px", padding: "14px",
              background: loading ? "#0f1128" : "linear-gradient(135deg, #b8860b, #FFD700)",
              border: "none", borderRadius: "12px",
              fontSize: "15px", fontWeight: 800, color: "#060818",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Loading..." : "Start Exam"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "results") {
    const score = results?.score || 0;
    const total = results?.total || items.length;
    const pct = Math.round((score / total) * 100);
    const timeTaken = Date.now() - examStartRef.current;

    return (
      <div style={{ ...fullscreenStyle, overflowY: "auto" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "60px 20px 40px" }}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "16px", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{pct >= 70 ? "🏆" : pct >= 50 ? "📊" : "📚"}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#e8eaf6", marginBottom: 4 }}>Exam Complete!</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: pct >= 70 ? "#66bb6a" : "#ffb74d", marginBottom: 16 }}>
              {score} / {total}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: 16 }}>
              {results?.xpAwarded != null && (
                <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                  <Zap size={16} style={{ color: "#f5a623", marginBottom: 4 }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f5a623" }}>+{results.xpAwarded}</div>
                  <div style={{ fontSize: 10, color: "#5a6090" }}>XP Earned</div>
                </div>
              )}
              <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                <Clock size={16} style={{ color: "#7986cb", marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "#7986cb" }}>{formatTime(timeTaken)}</div>
                <div style={{ fontSize: 10, color: "#5a6090" }}>Total Time</div>
              </div>
              {results?.streak > 0 && (
                <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                  <Flame size={16} style={{ color: "#ff7043", marginBottom: 4 }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#ff7043" }}>{results.streak}</div>
                  <div style={{ fontSize: 10, color: "#5a6090" }}>Day Streak</div>
                </div>
              )}
              <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                <Trophy size={16} style={{ color: "#DAA520", marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "#DAA520" }}>{pct}%</div>
                <div style={{ fontSize: 10, color: "#5a6090" }}>Score</div>
              </div>
            </div>
            <button onClick={onBack} style={{ width: "100%", padding: "12px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: 14, fontWeight: 700, color: "#7986cb", cursor: "pointer" }}>
              ← Back to Hub
            </button>
          </div>

          {/* Review all questions */}
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#7b82b8", marginBottom: "10px" }}>Review</div>
            {items.map((q, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.correct;
              return (
                <div key={i} style={{ marginBottom: "10px", padding: "14px", background: "#0d0f20", border: `0.5px solid ${isCorrect ? "#2a6a3a" : !userAnswer ? "#3a3d60" : "#6a2a2a"}`, borderRadius: "10px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                    {isCorrect ? <CheckCircle2 size={16} style={{ color: "#66bb6a", flexShrink: 0, marginTop: 2 }} /> : !userAnswer ? <span style={{ color: "#7b82b8", fontSize: 14 }}>○</span> : <XCircle size={16} style={{ color: "#ef5350", flexShrink: 0, marginTop: 2 }} />}
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#c5c9e8", lineHeight: 1.4 }}>Q{i + 1}. {q.question}</span>
                  </div>
                  {Object.entries(q.options).map(([key, val]) => {
                    const isCorrectOpt = key === q.correct;
                    const isUserPick = userAnswer === key;
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", marginBottom: "4px", borderRadius: "6px", background: isCorrectOpt ? "rgba(76,175,80,0.12)" : isUserPick ? "rgba(244,67,54,0.12)" : "transparent", border: `0.5px solid ${isCorrectOpt ? "#2a6a3a" : isUserPick ? "#6a2a2a" : "#1e2245"}` }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isCorrectOpt ? "#66bb6a" : isUserPick ? "#ef5350" : "#5a6090", minWidth: "18px" }}>{key}.</span>
                        <span style={{ fontSize: "13px", color: isCorrectOpt ? "#a5d6a7" : isUserPick ? "#ef9a9a" : "#DAA520", flex: 1 }}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ ...fullscreenStyle, alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <p style={{ color: "#7b82b8", fontSize: 14, marginBottom: 16 }}>No questions available for this exam.</p>
          <button onClick={onBack} style={{ padding: "10px 20px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", color: "#7986cb", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>← Back to Hub</button>
        </div>
      </div>
    );
  }

  const q = items[currentIndex];
  if (!q) return null;
  const progressPct = ((currentIndex + (answers[currentIndex] ? 1 : 0)) / items.length) * 100;
  const timeStr = formatTime(timeLeft);
  const answeredCount = Object.keys(answers).length;

  return (
    <div style={fullscreenStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 52px 12px 20px", background: "#0a0c1e", borderBottom: "0.5px solid #1e2245", flexShrink: 0 }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#DAA520", flex: 1 }}>🎓 Exam Simulation</span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: timeLeft < 60000 ? "#ef5350" : "#7b82b8", display: "flex", alignItems: "center", gap: "4px" }}>
          <Clock size={14} /> {timeStr}
        </span>
        <button onClick={() => setPaused(!paused)} style={{ padding: "4px 10px", background: paused ? "#0f2a1a" : "#111328", border: "0.5px solid #2a2d4a", borderRadius: "6px", fontSize: "11px", color: paused ? "#66bb6a" : "#5a6090", cursor: "pointer" }}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a6090", padding: "4px" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8" }}>Q{currentIndex + 1}/{items.length}</span>
          <span style={{ fontSize: "11px", color: "#5a6090" }}>{answeredCount} answered</span>
        </div>
        <div style={{ height: "4px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #B8860B, #FFD700)", borderRadius: "4px", transition: "width 0.3s ease" }} />
        </div>
        <div style={{ display: "flex", gap: "3px", marginTop: "6px", flexWrap: "wrap" }}>
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              style={{
                width: "10px", height: "10px", borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
                background: i === currentIndex ? "#FFD700"
                  : answers[i] ? (answers[i] === items[i].correct ? "#4caf50" : "#5c6bc0")
                  : flagged.has(i) ? "#ff7043"
                  : "#1e2245",
              }}
              title={`Q${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "20px", maxWidth: "700px", margin: "0 auto", width: "100%" }}>
        <QuestionCard
          question={q}
          questionNumber={currentIndex + 1}
          total={items.length}
          selectedAnswer={answers[currentIndex]}
          isLocked={false}
          isFlagged={flagged.has(currentIndex)}
          isMobile={isMobile}
          onSelectAnswer={handleSelect}
          onToggleFlag={handleFlag}
          showExplanation={false}
          enableAIExplain={false}
        />

        <div style={{ display: "flex", gap: "10px", marginTop: isMobile ? "12px" : "16px" }}>
          {currentIndex > 0 && (
            <button onClick={() => setCurrentIndex((i) => i - 1)} style={{ padding: isMobile ? "10px" : "12px", background: "transparent", border: "0.5px solid #2a2d4a", borderRadius: "10px", fontSize: isMobile ? "12px" : "13px", fontWeight: 600, color: "#5a6090", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <ChevronLeft size={isMobile ? 13 : 15} /> Prev
            </button>
          )}
          {currentIndex < items.length - 1 ? (
            <button onClick={() => setCurrentIndex((i) => i + 1)} style={{ flex: 1, padding: isMobile ? "10px" : "12px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: "#FFD700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              Next <ChevronRight size={isMobile ? 13 : 15} />
            </button>
          ) : (
            <button onClick={() => setShowSubmitConfirm(true)} style={{ flex: 1, padding: isMobile ? "10px" : "12px", background: "#0f2a1a", border: "0.5px solid #2a6a3a", borderRadius: "10px", fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: "#66bb6a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              Submit Exam
            </button>
          )}
        </div>
      </div>

      {showSubmitConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "16px", padding: "24px", maxWidth: "380px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📝</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf6", marginBottom: 8 }}>Submit Exam?</div>
            <div style={{ fontSize: 13, color: "#7b82b8", marginBottom: 6 }}>
              Answered: {answeredCount} / {items.length}
            </div>
            {answeredCount < items.length && (
              <div style={{ fontSize: 12, color: "#ffb74d", marginBottom: 16 }}>
                ⚠️ {items.length - answeredCount} questions unanswered
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowSubmitConfirm(false)} style={{ flex: 1, padding: "10px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: 13, fontWeight: 700, color: "#7986cb", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting} style={{ flex: 1, padding: "10px", background: "#0f2a1a", border: "0.5px solid #2a6a3a", borderRadius: "10px", fontSize: 13, fontWeight: 700, color: "#66bb6a", cursor: "pointer", opacity: submitting ? 0.5 : 1 }}>
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamConfigField({ label, value, onChange, min, max }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "6px" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          style={{
            flex: 1, padding: "10px 14px", background: "#0d0f20",
            border: "0.5px solid #1e2245", borderRadius: "10px",
            color: "#e8eaf6", fontSize: "15px", fontWeight: 700, outline: "none",
          }}
        />
      </div>
    </div>
  );
}
