import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Flag, Clock, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Trophy, Zap, BarChart3, Flame, Sparkles, Send, Pause, Play, AlertTriangle } from "lucide-react";
import { copyShareToken } from "../lib/researchUtils.js";
import MarkdownText from "../components/MarkdownText.jsx";
import { callAI } from "../lib/aiClient.js";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const XP_PER_CORRECT = 20;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptions(q) {
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
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatCountdown(ms) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const fullscreenStyle = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "#060818", display: "flex", flexDirection: "column",
};

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function McqExamRunner({ resource, shareToken, onBack, onQuizComplete }) {
  const isMobile = useIsMobile();
  const rawQuestions = useMemo(() => {
    const raw = resource.mcqData;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return []; } }
    return [];
  }, [resource]);

  const [phase, setPhase] = useState("config"); // config | exam | results
  const [examQuestions, setExamQuestions] = useState([]);
  const [questionCount, setQuestionCount] = useState("all");
  const [timeMode, setTimeMode] = useState("auto");
  const [customMinutes, setCustomMinutes] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [paused, setPaused] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [aiExplainData, setAiExplainData] = useState({});
  const [followUpInput, setFollowUpInput] = useState("");
  const [aiFollowUpLoading, setAiFollowUpLoading] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const questionStartRef = useRef(Date.now());
  const timePerQuestion = useRef({});
  const examStartRef = useRef(Date.now());
  const timerRef = useRef(null);

  const totalQuestions = examQuestions.length;
  const autoMinutes = Math.max(5, Math.round((totalQuestions * 90) / 60));
  const examMinutes = timeMode === "custom" && customMinutes ? parseInt(customMinutes) : autoMinutes;

  const startExam = useCallback(() => {
    let qs = rawQuestions;
    if (questionCount !== "all") {
      qs = shuffleArray(qs).slice(0, parseInt(questionCount));
    }
    const prepared = shuffleArray(qs).map(shuffleOptions);
    setExamQuestions(prepared);
    setCurrentIndex(0);
    setAnswers({});
    setFlagged(new Set());
    setPaused(false);
    setShowSubmitConfirm(false);
    setResultsData(null);
    setSubmitError("");
    setShowReview(false);
    setReviewIdx(0);
    setAiExplainData({});
    setTimeRemaining(examMinutes * 60 * 1000);
    examStartRef.current = Date.now();
    questionStartRef.current = Date.now();
    timePerQuestion.current = {};
    setPhase("exam");
  }, [rawQuestions, questionCount, examMinutes]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "exam" || paused) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(timerRef.current);
          submitExam();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, paused]);

  // Track time per question
  useEffect(() => {
    if (phase === "exam") {
      questionStartRef.current = Date.now();
    }
  }, [currentIndex, phase]);

  const handleSelectAnswer = useCallback((optionKey) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: optionKey }));
  }, [currentIndex]);

  const handleFlag = useCallback(() => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex(currentIndex + 1);
  }, [currentIndex, totalQuestions]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const goToQuestion = useCallback((idx) => {
    setCurrentIndex(idx);
    setShowReview(false);
  }, []);

  const score = useMemo(() => {
    return examQuestions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
  }, [examQuestions, answers]);

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;

  const submitExam = useCallback(async () => {
    if (phase !== "exam") return;
    setSubmitting(true);
    setSubmitError("");
    setShowSubmitConfirm(false);
    // Record time for current question
    const elapsed = Date.now() - questionStartRef.current;
    timePerQuestion.current[currentIndex] = (timePerQuestion.current[currentIndex] || 0) + elapsed;
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const token = authData.authToken;
      const res = await fetch(`${API_BASE}/api/resources/quiz-attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          resourceId: resource.id,
          mode: "exam",
          score,
          total: totalQuestions,
          details: examQuestions.map((q, i) => ({
            questionIndex: i,
            correct: answers[i] === q.correct,
            timeSpentMs: timePerQuestion.current[i] ?? null,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResultsData(data);
        if (onQuizComplete) onQuizComplete(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error || "Failed to submit exam");
        setResultsData({ xpAwarded: score * XP_PER_CORRECT, totalXp: null, percentile: null, rank: null, totalTakers: null });
      }
    } catch {
      setSubmitError("Network error — results shown locally");
      setResultsData({ xpAwarded: score * XP_PER_CORRECT, totalXp: null, percentile: null, rank: null, totalTakers: null });
    } finally {
      setSubmitting(false);
      setPhase("results");
    }
  }, [phase, currentIndex, resource.id, score, totalQuestions, examQuestions, answers, onQuizComplete]);

  const getAIExplain = useCallback(async (qIdx) => {
    const q = examQuestions[qIdx];
    if (!q) return;
    setAiExplainData(prev => ({ ...prev, [qIdx]: { ...prev[qIdx], loading: true } }));
    try {
      const optionsStr = Object.entries(q.options).map(([k, v]) => `${k}. ${v}`).join("\n");
      const correctAnswer = q.options[q.correct] || q.correct;
      const userAnswer = answers[qIdx] ? q.options[answers[qIdx]] : "(no answer)";
      const prompt = `You are a helpful study tutor. A student answered this MCQ question in exam mode:\n\nQuestion: ${q.question}\nOptions:\n${optionsStr}\nCorrect answer: ${correctAnswer}\nStudent's answer: ${userAnswer}\n\nGive a clear, concise explanation (2-3 sentences) of why the correct answer is right. Be educational and encouraging.`;
      const text = await callAI(prompt, { provider: "openrouter" });
      setAiExplainData(prev => ({ ...prev, [qIdx]: { explanation: text || "No explanation generated.", followUps: [], loading: false } }));
    } catch {
      setAiExplainData(prev => ({ ...prev, [qIdx]: { explanation: "Could not get AI explanation. Please try again.", followUps: [], loading: false } }));
    }
  }, [examQuestions, answers]);

  const askFollowUp = useCallback(async (qIdx) => {
    const q = examQuestions[qIdx];
    if (!q || !followUpInput.trim()) return;
    const userQuestion = followUpInput.trim();
    setFollowUpInput("");
    setAiFollowUpLoading(true);
    try {
      const optionsStr = Object.entries(q.options).map(([k, v]) => `${k}. ${v}`).join("\n");
      const correctAnswer = q.options[q.correct] || q.correct;
      const prevExplain = aiExplainData[qIdx]?.explanation || "";
      const prevFollowUps = (aiExplainData[qIdx]?.followUps || []).map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
      const prompt = `You are a helpful study tutor. The student asked about this MCQ question earlier and you gave an explanation. Now they have a follow-up question.\n\nOriginal Question: ${q.question}\nOptions:\n${optionsStr}\nCorrect answer: ${correctAnswer}\n\nYour previous explanation: ${prevExplain}\n\nPrevious follow-ups:\n${prevFollowUps || "(none)"}\n\nStudent's follow-up question: ${userQuestion}\n\nAnswer concisely (2-4 sentences). Be educational and encouraging.`;
      const text = await callAI(prompt, { provider: "openrouter" });
      setAiExplainData(prev => ({ ...prev, [qIdx]: { ...prev[qIdx], followUps: [...(prev[qIdx]?.followUps || []), { question: userQuestion, answer: text || "No response." }] } }));
    } catch {
      setAiExplainData(prev => ({ ...prev, [qIdx]: { ...prev[qIdx], followUps: [...(prev[qIdx]?.followUps || []), { question: userQuestion, answer: "Could not get a response. Please try again." }] } }));
    } finally {
      setAiFollowUpLoading(false);
    }
  }, [examQuestions, aiExplainData, followUpInput]);

  const handleShare = async () => {
    if (!shareToken) return;
    const success = await copyShareToken(shareToken);
    if (success) { setShareToast("Link copied!"); setTimeout(() => setShareToast(""), 2200); }
  };

  const handleRetake = useCallback(() => {
    setPhase("config");
    setExamQuestions([]);
    setAnswers({});
    setFlagged(new Set());
    setResultsData(null);
    setAiExplainData({});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== "exam" || paused) return;
    const handler = (e) => {
      const key = e.key.toUpperCase();
      const q = examQuestions[currentIndex];
      if (!q) return;
      if (["A", "B", "C", "D"].includes(key) && q.options[key]) {
        e.preventDefault();
        handleSelectAnswer(key);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape" && onBack) {
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, paused, currentIndex, examQuestions, onBack]);

  // ─── Config Phase ───
  if (phase === "config") {
    const qCount = rawQuestions.length;
    return (
      <div style={{ ...fullscreenStyle, alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "Manrope, sans-serif" }}>
        <button onClick={onBack} style={{ position: "absolute", top: 20, left: 20, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "#7b82b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          ← Back
        </button>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: "#4a5080", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Exam Mode</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#c5c9e8", fontFamily: "Syne, sans-serif", margin: 0 }}>{resource?.title || "Untitled Quiz"}</h1>
            <div style={{ fontSize: 13, color: "#4a5080", marginTop: 6 }}>{qCount} questions available</div>
          </div>
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: 16, padding: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#5a6090", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Question Count</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {[{ v: "all", l: `All (${qCount})` }, { v: "10", l: "10" }, { v: "20", l: "20" }, { v: "30", l: "30" }, { v: "50", l: "50" }].filter(o => o.v === "all" || parseInt(o.v) <= qCount).map(o => (
                <button key={o.v} onClick={() => setQuestionCount(o.v)} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, border: questionCount === o.v ? "2px solid #f87171" : "1px solid #2a2d4a", background: questionCount === o.v ? "rgba(248,113,113,0.15)" : "transparent", color: questionCount === o.v ? "#f87171" : "#7b82b8" }}>{o.l}</button>
              ))}
            </div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#5a6090", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Time Limit</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={() => setTimeMode("auto")} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, border: timeMode === "auto" ? "2px solid #f87171" : "1px solid #2a2d4a", background: timeMode === "auto" ? "rgba(248,113,113,0.15)" : "transparent", color: timeMode === "auto" ? "#f87171" : "#7b82b8" }}>Auto (~{autoMinutes} min)</button>
              <button onClick={() => setTimeMode("custom")} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, border: timeMode === "custom" ? "2px solid #f87171" : "1px solid #2a2d4a", background: timeMode === "custom" ? "rgba(248,113,113,0.15)" : "transparent", color: timeMode === "custom" ? "#f87171" : "#7b82b8" }}>Custom</button>
            </div>
            {timeMode === "custom" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                {[10, 15, 20, 30, 45, 60, 90, 120].map(n => (
                  <button key={n} onClick={() => setCustomMinutes(String(n))} style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, border: customMinutes === String(n) ? "2px solid #f87171" : "1px solid #2a2d4a", background: customMinutes === String(n) ? "rgba(248,113,113,0.15)" : "transparent", color: customMinutes === String(n) ? "#f87171" : "#7b82b8" }}>{n} min</button>
                ))}
              </div>
            )}
            <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 12, color: "#5a6090", lineHeight: 1.6 }}>
              <strong style={{ color: "#7b82b8" }}>Exam rules:</strong> No instant feedback. Timer counts down. Flag questions for review. Auto-submits on timeout.
            </div>
            <button onClick={startExam} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #b91c1c, #f87171)", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Trophy size={18} /> Start Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Results Phase ───
  if (phase === "results") {
    const totalTime = Date.now() - examStartRef.current;
    const avgTime = totalQuestions > 0 ? totalTime / totalQuestions : 0;
    const times = examQuestions.map((_, i) => timePerQuestion.current[i] || 0).filter(t => t > 0);
    const slowestQ = times.length > 0 ? Math.max(...times) : 0;
    const pct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const reviewQ = examQuestions[reviewIdx];

    return (
      <div style={{ ...fullscreenStyle, overflowY: "auto", padding: isMobile ? "16px" : "40px 20px", fontFamily: "Manrope, sans-serif" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "#7b82b8", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>← Back to Research Hub</button>

          {/* Score header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{pct >= 70 ? "🎉" : pct >= 50 ? "📊" : "📚"}</div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#c5c9e8", fontFamily: "Syne, sans-serif", margin: "0 0 4px" }}>Exam Complete</h1>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: pct >= 70 ? "#4ade80" : pct >= 50 ? "#ffd54f" : "#ef5350" }}>
              {score}/{totalQuestions} ({pct}%)
            </div>
            {resultsData?.xpAwarded != null && (
              <div style={{ fontSize: 13, color: "#FFD700", marginTop: 6 }}>+{resultsData.xpAwarded} XP</div>
            )}
            {resultsData?.percentile != null && (
              <div style={{ fontSize: 12, color: "#5a6090", marginTop: 4 }}>
                Percentile: {resultsData.percentile} · Rank: {resultsData.rank}/{resultsData.totalTakers}
              </div>
            )}
            {submitError && <div style={{ fontSize: 12, color: "#ef5350", marginTop: 8 }}>{submitError}</div>}
          </div>

          {/* Time analytics */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            {[
              { icon: "⏱️", label: "Total Time", value: formatTime(totalTime) },
              { icon: "📊", label: "Avg/Q", value: formatTime(avgTime) },
              { icon: "🐌", label: "Slowest Q", value: formatTime(slowestQ) },
              { icon: "✅", label: "Correct", value: score },
              { icon: "❌", label: "Wrong", value: totalQuestions - score - unansweredCount },
              { icon: "⏭️", label: "Unanswered", value: unansweredCount },
            ].map(s => (
              <div key={s.label} style={{ flex: "1 1 100px", background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#c5c9e8" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#5a6090", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per-question review */}
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#c5c9e8", fontFamily: "Syne, sans-serif", margin: 0 }}>Review Questions</h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {examQuestions.map((_, i) => {
                  const isCorrect = answers[i] === examQuestions[i].correct;
                  const isUnanswered = !answers[i];
                  return (
                    <button key={i} onClick={() => setReviewIdx(i)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: reviewIdx === i ? "#5c6bc0" : isUnanswered ? "#1e2245" : isCorrect ? "#1a3a1a" : "#3a1a1a", color: reviewIdx === i ? "#fff" : isUnanswered ? "#5a6090" : isCorrect ? "#4ade80" : "#ef5350" }}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {reviewQ && (
              <div>
                <div style={{ fontSize: 12, color: "#5a6090", marginBottom: 8 }}>Question {reviewIdx + 1} of {totalQuestions}</div>
                <div style={{ fontSize: 14, color: "#c5c9e8", lineHeight: 1.7, marginBottom: 16 }}>{reviewQ.question}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(reviewQ.options).map(([key, val]) => {
                    const isCorrect = key === reviewQ.correct;
                    const isSelected = answers[reviewIdx] === key;
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: isCorrect ? "rgba(74,222,128,0.1)" : isSelected ? "rgba(239,83,80,0.1)" : "#0a0c1e", border: `0.5px solid ${isCorrect ? "#2a6a3a" : isSelected ? "#6a2a2a" : "#1e2245"}` }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isCorrect ? "#4ade80" : isSelected ? "#ef5350" : "#5a6090", minWidth: 20 }}>{key}.</span>
                        <span style={{ fontSize: 13, color: isCorrect ? "#4ade80" : isSelected ? "#ef5350" : "#7b82b8", flex: 1 }}>{val}</span>
                        {isCorrect && <CheckCircle2 size={16} style={{ color: "#4ade80" }} />}
                        {isSelected && !isCorrect && <XCircle size={16} style={{ color: "#ef5350" }} />}
                      </div>
                    );
                  })}
                </div>
                {!answers[reviewIdx] && <div style={{ fontSize: 12, color: "#5a6090", marginTop: 8, fontStyle: "italic" }}>Not answered</div>}
                {timePerQuestion.current[reviewIdx] && (
                  <div style={{ fontSize: 11, color: "#4a5080", marginTop: 8 }}>Time spent: {formatTime(timePerQuestion.current[reviewIdx])}</div>
                )}

                {/* AI Explain */}
                <div style={{ marginTop: 16 }}>
                  {!aiExplainData[reviewIdx] && (
                    <button onClick={() => getAIExplain(reviewIdx)} style={{ padding: "8px 16px", background: "transparent", border: "0.5px solid #5c6bc0", borderRadius: 10, color: "#5c6bc0", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={14} /> Get AI Explanation
                    </button>
                  )}
                  {aiExplainData[reviewIdx]?.loading && <div style={{ fontSize: 12, color: "#5a6090", marginTop: 8 }}>⏳ Thinking…</div>}
                  {aiExplainData[reviewIdx]?.explanation && !aiExplainData[reviewIdx]?.loading && (
                    <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: 10, padding: 14, marginTop: 8 }}>
                      <MarkdownText>{aiExplainData[reviewIdx].explanation}</MarkdownText>
                      {aiExplainData[reviewIdx].followUps?.map((fu, fi) => (
                        <div key={fi} style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid #1e2245" }}>
                          <div style={{ fontSize: 12, color: "#7b82b8" }}>Q: {fu.question}</div>
                          <div style={{ fontSize: 12, color: "#5a6090", marginTop: 4 }}>A: {fu.answer}</div>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <input value={reviewIdx === currentIndex ? followUpInput : ""} onChange={e => { setReviewIdx(reviewIdx); setFollowUpInput(e.target.value); }} onKeyDown={e => { if (e.key === "Enter" && !aiFollowUpLoading) { setReviewIdx(reviewIdx); askFollowUp(reviewIdx); } }} placeholder="Ask a follow-up…" style={{ flex: 1, padding: "8px 12px", background: "#060818", border: "0.5px solid #2a2d4a", borderRadius: 8, color: "#c5c9e8", fontSize: 12 }} />
                        <button onClick={() => askFollowUp(reviewIdx)} disabled={aiFollowUpLoading || !followUpInput.trim()} style={{ padding: "8px 14px", background: "#5c6bc0", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, opacity: aiFollowUpLoading || !followUpInput.trim() ? 0.5 : 1 }}>
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={handleRetake} style={{ flex: 1, padding: "12px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: 10, color: "#FFD700", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <RotateCcw size={16} /> Retake Exam
            </button>
            <button onClick={handleShare} style={{ flex: 1, padding: "12px", background: "transparent", border: "0.5px solid #2a2d4a", borderRadius: 10, color: "#7b82b8", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Share2 size={16} /> Share
            </button>
          </div>
          {shareToast && <div style={{ textAlign: "center", fontSize: 12, color: "#4ade80", marginTop: 12 }}>{shareToast}</div>}
        </div>
      </div>
    );
  }

  // ─── Exam Phase ───
  if (rawQuestions.length === 0 || totalQuestions === 0) {
    return (
      <div style={{ ...fullscreenStyle, alignItems: "center", justifyContent: "center", fontFamily: "Manrope, sans-serif" }}>
        <p style={{ color: "#5a6090", fontSize: 14 }}>No questions available.</p>
        <button onClick={onBack} style={{ marginTop: 16, padding: "8px 16px", background: "transparent", border: "0.5px solid #2a2d4a", borderRadius: 8, color: "#7b82b8", cursor: "pointer", fontSize: 13 }}>← Back</button>
      </div>
    );
  }

  const q = examQuestions[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const isFlagged = flagged.has(currentIndex);
  const progressPct = ((currentIndex + 1) / totalQuestions) * 100;
  const timeLow = timeRemaining != null && timeRemaining < 60000;

  return (
    <div style={{ ...fullscreenStyle, fontFamily: "Manrope, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: isMobile ? "10px 12px" : "14px 24px", borderBottom: "0.5px solid #1e2245", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#5a6090", cursor: "pointer", fontSize: 20, padding: 4 }}>
          <X size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 10, background: timeLow ? "rgba(239,83,80,0.15)" : "#0d0f20", border: `0.5px solid ${timeLow ? "#ef5350" : "#1e2245"}` }}>
          <Clock size={isMobile ? 14 : 16} style={{ color: timeLow ? "#ef5350" : "#7b82b8" }} />
          <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: timeLow ? "#ef5350" : "#c5c9e8", fontFamily: "Manrope, sans-serif", fontVariantNumeric: "tabular-nums" }}>
            {formatCountdown(timeRemaining || 0)}
          </span>
        </div>
        <button onClick={() => setPaused(!paused)} style={{ background: "none", border: "0.5px solid #2a2d4a", borderRadius: 8, padding: "6px 10px", color: "#7b82b8", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Resume" : "Pause"}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#0d0f20", flexShrink: 0 }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #b91c1c, #f87171)", transition: "width 0.3s ease" }} />
      </div>

      {/* Paused overlay */}
      {paused && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,24,0.9)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Pause size={48} style={{ color: "#5a6090" }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c5c9e8" }}>Exam Paused</div>
          <button onClick={() => setPaused(false)} style={{ padding: "10px 24px", background: "#5c6bc0", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Play size={16} /> Resume
          </button>
        </div>
      )}

      {/* Question navigator grid */}
      <div style={{ padding: isMobile ? "8px 12px" : "10px 24px", display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "0.5px solid #1e2245", flexShrink: 0, maxHeight: 60, overflowY: "auto" }}>
        {examQuestions.map((_, i) => {
          const isAnswered = answers[i] != null;
          const isF = flagged.has(i);
          return (
            <button key={i} onClick={() => goToQuestion(i)} style={{ width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: i === currentIndex ? "#5c6bc0" : isAnswered ? "#1a3a1a" : "#0d0f20", color: i === currentIndex ? "#fff" : isAnswered ? "#4ade80" : "#5a6090", border: i === currentIndex ? "none" : "0.5px solid #1e2245", position: "relative" }}>
              {i + 1}
              {isF && <span style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: "#ffd54f" }} />}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px" : "24px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 680, width: "100%" }}>
          <div style={{ fontSize: 12, color: "#5a6090", marginBottom: 12, fontWeight: 600 }}>
            Question {currentIndex + 1} of {totalQuestions}
          </div>
          <div style={{ fontSize: isMobile ? 15 : 17, color: "#c5c9e8", lineHeight: 1.7, marginBottom: 24 }}>
            {q.question}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(q.options).map(([key, val]) => {
              const isSelected = selectedAnswer === key;
              return (
                <button key={key} onClick={() => handleSelectAnswer(key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "12px 14px" : "14px 18px", borderRadius: 12, cursor: "pointer", textAlign: "left", background: isSelected ? "rgba(92,107,192,0.15)" : "#0d0f20", border: isSelected ? "1.5px solid #5c6bc0" : "0.5px solid #1e2245", transition: "all 0.15s ease" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "#5c6bc0" : "#5a6090", minWidth: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: isSelected ? "rgba(92,107,192,0.2)" : "transparent" }}>{key}</span>
                  <span style={{ fontSize: isMobile ? 13 : 14, color: isSelected ? "#c5c9e8" : "#7b82b8", flex: 1 }}>{val}</span>
                </button>
              );
            })}
          </div>

          {/* Flag button */}
          <button onClick={handleFlag} style={{ marginTop: 20, padding: "8px 16px", background: "transparent", border: `0.5px solid ${isFlagged ? "#ffd54f" : "#2a2d4a"}`, borderRadius: 10, color: isFlagged ? "#ffd54f" : "#5a6090", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Flag size={14} /> {isFlagged ? "Flagged" : "Flag for review"}
          </button>
        </div>
      </div>

      {/* Footer nav */}
      <div style={{ padding: isMobile ? "12px" : "16px 24px", borderTop: "0.5px solid #1e2245", flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 10 }}>
          <button onClick={handlePrev} disabled={currentIndex === 0} style={{ padding: isMobile ? "10px" : "12px 16px", background: "transparent", border: "0.5px solid #2a2d4a", borderRadius: 10, color: currentIndex === 0 ? "#3a3d60" : "#5a6090", cursor: currentIndex === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, opacity: currentIndex === 0 ? 0.5 : 1 }}>
            <ChevronLeft size={15} /> Prev
          </button>
          {currentIndex < totalQuestions - 1 ? (
            <button onClick={handleNext} style={{ flex: 1, padding: isMobile ? "10px" : "12px 16px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: 10, color: "#FFD700", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={() => setShowSubmitConfirm(true)} style={{ flex: 1, padding: isMobile ? "10px" : "12px 16px", background: "linear-gradient(135deg, #b91c1c, #f87171)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <CheckCircle2 size={16} /> Submit Exam
            </button>
          )}
        </div>
      </div>

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,24,0.85)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: 16, padding: 28, maxWidth: 400, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={24} style={{ color: "#f87171" }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#c5c9e8", margin: 0 }}>Submit Exam?</h3>
            </div>
            <div style={{ fontSize: 13, color: "#7b82b8", lineHeight: 1.6, marginBottom: 8 }}>
              You answered <strong style={{ color: "#4ade80" }}>{answeredCount}</strong> of <strong style={{ color: "#c5c9e8" }}>{totalQuestions}</strong> questions.
            </div>
            {unansweredCount > 0 && (
              <div style={{ fontSize: 13, color: "#ef5350", marginBottom: 8 }}>
                {unansweredCount} question{unansweredCount > 1 ? "s" : ""} unanswered.
              </div>
            )}
            <div style={{ fontSize: 12, color: "#5a6090", marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowSubmitConfirm(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "0.5px solid #2a2d4a", borderRadius: 10, color: "#7b82b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button onClick={submitExam} disabled={submitting} style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg, #b91c1c, #f87171)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
