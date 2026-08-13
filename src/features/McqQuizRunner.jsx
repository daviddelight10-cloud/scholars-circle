import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Flag, SkipForward, RotateCcw, Share2, Clock, CheckCircle2, XCircle, Trophy, Zap, BarChart3, Flame, Sparkles, Send } from "lucide-react";
import RatingsAndComments from "../components/RatingsAndComments.jsx";
import { copyShareToken } from "../lib/researchUtils.js";
import MarkdownText from "../components/MarkdownText.jsx";
import { callAI } from "../lib/aiClient.js";
import { recordPracticeResult, getWeakSpotQuestions } from "../lib/studyHistory.js";
import McqSurvivalRunner from "./McqSurvivalRunner.jsx";
import McqCascadeRunner from "./McqCascadeRunner.jsx";

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
  return {
    ...q,
    options: newOptions,
    correct: remap[q.correct] || q.correct,
  };
}

function formatTime(ms) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

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

export default function McqQuizRunner({ resource, shareToken, sessionConfig, onBack, onQuizComplete, switchMode, onStreakUpdate, onXpUpdate }) {
  const isMobile = useIsMobile();
  const rawQuestions = useMemo(() => {
    const raw = resource.mcqData;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  }, [resource]);

  // Survival mode — render dedicated component
  if (sessionConfig?.sessionType === "survival" && rawQuestions.length > 0) {
    return (
      <McqSurvivalRunner
        resource={resource}
        shareToken={shareToken}
        questions={rawQuestions}
        onBack={onBack}
        onQuizComplete={onQuizComplete}
        onStreakUpdate={onStreakUpdate}
        onXpUpdate={onXpUpdate}
      />
    );
  }

  // Cascade mode (replaces practice) — render dedicated component
  if (rawQuestions.length > 0) {
    return (
      <McqCascadeRunner
        resource={resource}
        shareToken={shareToken}
        questions={rawQuestions}
        onBack={onBack}
        onQuizComplete={onQuizComplete}
        onStreakUpdate={onStreakUpdate}
        onXpUpdate={onXpUpdate}
      />
    );
  }

  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [skipped, setSkipped] = useState(new Set());
  const [showResults, setShowResults] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [retryWrongOnly, setRetryWrongOnly] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const [aiExplainData, setAiExplainData] = useState({}); // keyed by question index: { explanation, followUps: [], loading }
  const [followUpInput, setFollowUpInput] = useState("");
  const [aiFollowUpLoading, setAiFollowUpLoading] = useState(false);
  const questionStartRef = useRef(Date.now());
  const timePerQuestion = useRef({});
  const quizStartRef = useRef(Date.now());

  const prepareQuestions = useCallback((questions, wrongOnly = false, prevAnswers = null) => {
    let qs = questions;
    if (wrongOnly && prevAnswers) {
      qs = questions.filter((q, i) => prevAnswers[i] !== q.correct);
    }
    const shuffled = shuffleArray(qs).map(shuffleOptions);
    setShuffledQuestions(shuffled);
    setCurrentIndex(0);
    setAnswers({});
    setLocked({});
    setFlagged(new Set());
    setSkipped(new Set());
    setShowResults(false);
    setShowReview(false);
    setResultsData(null);
    setSubmitError("");
    setRetryWrongOnly(wrongOnly);
    questionStartRef.current = Date.now();
    quizStartRef.current = Date.now();
    timePerQuestion.current = {};
  }, []);

  useEffect(() => {
    if (rawQuestions.length > 0) {
      let qs = rawQuestions;
      const sType = sessionConfig?.sessionType;
      if (sType === "weak" && resource?.id) {
        // getWeakSpotQuestions returns [weak..., rest...] — take only weak portion
        const weakCount = sessionConfig?.questionCount || qs.length;
        qs = getWeakSpotQuestions(resource.id, rawQuestions).slice(0, weakCount);
      } else if (sType === "quick10") {
        qs = shuffleArray(rawQuestions).slice(0, Math.min(10, rawQuestions.length));
      } else if (sType === "quick20") {
        qs = shuffleArray(rawQuestions).slice(0, Math.min(20, rawQuestions.length));
      } else if (sType === "quick30") {
        qs = shuffleArray(rawQuestions).slice(0, Math.min(30, rawQuestions.length));
      }
      prepareQuestions(qs);
    }
  }, [rawQuestions, prepareQuestions, sessionConfig, resource]);

  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && onBack) onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  const totalQuestions = shuffledQuestions.length;
  const score = useMemo(() => {
    return shuffledQuestions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
  }, [answers, shuffledQuestions]);

  const handleSelectAnswer = useCallback((optionKey) => {
    if (locked[currentIndex]) return;
    const elapsed = Date.now() - questionStartRef.current;
    timePerQuestion.current[currentIndex] = elapsed;
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionKey }));
    setLocked((prev) => ({ ...prev, [currentIndex]: true }));
  }, [currentIndex, locked]);

  const handleSkip = useCallback(() => {
    if (locked[currentIndex]) return;
    setSkipped((prev) => new Set(prev).add(currentIndex));
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitQuiz();
    }
  }, [currentIndex, locked, totalQuestions]);

  const handleFlag = useCallback(() => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitQuiz();
    }
  }, [currentIndex, totalQuestions]);

  const submitQuiz = async () => {
    setSubmitting(true);
    setSubmitError("");

    // Track weak spots locally for future "weak spots only" sessions
    if (resource?.id) {
      try {
        recordPracticeResult(resource.id, shuffledQuestions, answers);
      } catch {}
    }

    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const token = authData.authToken;
      const res = await fetch(`${API_BASE}/api/resources/quiz-attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resourceId: resource.id,
          score,
          total: totalQuestions,
          details: shuffledQuestions.map((q, i) => ({
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
        if (data.streak != null && onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
        if (data.xpAwarded > 0 && onXpUpdate) onXpUpdate(data.xpAwarded);
      } else {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error || "Failed to submit quiz");
        const fallbackXp = score * XP_PER_CORRECT;
        setResultsData({
          xpAwarded: fallbackXp,
          totalXp: null,
          percentile: null,
          rank: null,
          totalTakers: null,
        });
        if (fallbackXp > 0 && onXpUpdate) onXpUpdate(fallbackXp);
      }
    } catch {
      setSubmitError("Network error — results shown locally");
      const fallbackXp = score * XP_PER_CORRECT;
      setResultsData({
        xpAwarded: fallbackXp,
        totalXp: null,
        percentile: null,
        rank: null,
        totalTakers: null,
      });
      if (fallbackXp > 0 && onXpUpdate) onXpUpdate(fallbackXp);
    } finally {
      setSubmitting(false);
      setShowResults(true);
    }
  };

  const handleRetake = useCallback(() => {
    prepareQuestions(rawQuestions);
  }, [rawQuestions, prepareQuestions]);

  const handleRetryWrong = useCallback(() => {
    prepareQuestions(shuffledQuestions, true, answers);
  }, [shuffledQuestions, answers, prepareQuestions]);

  const handleShare = async () => {
    if (!shareToken) return;
    const success = await copyShareToken(shareToken);
    if (success) {
      setShareToast("Link copied!");
      setTimeout(() => setShareToast(""), 2200);
    }
  };

  const goToQuestion = useCallback((idx) => {
    setCurrentIndex(idx);
    setShowReview(false);
    setFollowUpInput("");
  }, []);

  const getAIExplain = useCallback(async (qIdx) => {
    const q = shuffledQuestions[qIdx];
    if (!q) return;
    setAiExplainData(prev => ({ ...prev, [qIdx]: { ...prev[qIdx], loading: true } }));
    try {
      const optionsStr = Object.entries(q.options).map(([k, v]) => `${k}. ${v}`).join("\n");
      const correctAnswer = q.options[q.correct] || q.correct;
      const userAnswer = answers[qIdx] ? q.options[answers[qIdx]] : "(skipped)";
      const prompt = `You are a helpful study tutor. A student just answered this MCQ question:\n\nQuestion: ${q.question}\nOptions:\n${optionsStr}\nCorrect answer: ${correctAnswer}\nStudent's answer: ${userAnswer}\n\nGive a clear, concise explanation (2-3 sentences) of why the correct answer is right. Be educational and encouraging.`;
      const text = await callAI(prompt, { provider: "openrouter" });
      setAiExplainData(prev => ({ ...prev, [qIdx]: { explanation: text || "No explanation generated.", followUps: [], loading: false } }));
    } catch {
      setAiExplainData(prev => ({ ...prev, [qIdx]: { explanation: "Could not get AI explanation. Please try again.", followUps: [], loading: false } }));
    }
  }, [shuffledQuestions, answers]);

  const askFollowUp = useCallback(async (qIdx) => {
    const q = shuffledQuestions[qIdx];
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
      setAiExplainData(prev => ({
        ...prev,
        [qIdx]: {
          ...prev[qIdx],
          followUps: [...(prev[qIdx]?.followUps || []), { question: userQuestion, answer: text || "No response." }],
        },
      }));
    } catch {
      setAiExplainData(prev => ({
        ...prev,
        [qIdx]: {
          ...prev[qIdx],
          followUps: [...(prev[qIdx]?.followUps || []), { question: userQuestion, answer: "Could not get a response. Please try again." }],
        },
      }));
    } finally {
      setAiFollowUpLoading(false);
    }
  }, [shuffledQuestions, aiExplainData, followUpInput]);

  const totalTime = Date.now() - quizStartRef.current;

  // Keyboard shortcuts
  useEffect(() => {
    if (showResults || totalQuestions === 0) return;
    const handler = (e) => {
      const key = e.key.toUpperCase();
      const q = shuffledQuestions[currentIndex];
      if (!q || locked[currentIndex]) {
        if (e.key === "Enter" && locked[currentIndex]) {
          handleNext();
        }
        return;
      }
      if (["A", "B", "C", "D"].includes(key) && q.options[key]) {
        e.preventDefault();
        handleSelectAnswer(key);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex, shuffledQuestions, locked, showResults, totalQuestions]);

  if (rawQuestions.length === 0) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(circle at 12% -8%, rgba(76,141,255,0.10), transparent 42%), radial-gradient(circle at 100% 0%, rgba(232,184,75,0.06), transparent 38%), #0A0D13",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "Manrope, sans-serif", color: "#F2F4F8",
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              position: "fixed", top: 16, right: 20, zIndex: 10000,
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#9AA3B2", cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        )}
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>{"\u{1F4ED}"}</div>
        <div style={{ fontSize: "15px", marginBottom: "16px", color: "#9AA3B2" }}>This quiz has no questions yet.</div>
        <button onClick={onBack} style={{
          padding: "12px 24px", borderRadius: 14,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          fontSize: 14, fontWeight: 700, color: "#9AA3B2", cursor: "pointer",
        }}>{"\u2190 Back to Research Hub"}</button>
      </div>
    );
  }

  if (showResults) {
    const xpEarned = resultsData?.xpAwarded ?? score * XP_PER_CORRECT;
    const totalXp = resultsData?.totalXp;
    const level = totalXp != null ? Math.floor(totalXp / 100) + 1 : null;
    const percentile = resultsData?.percentile;
    const rank = resultsData?.rank;
    const totalTakers = resultsData?.totalTakers;
    const streak = resultsData?.streak;
    const longestStreak = resultsData?.longestStreak;
    const streakIsNewDay = resultsData?.streakIsNewDay;
    const wrongCount = totalQuestions - score;
    const hasWrongQuestions = wrongCount > 0;

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999, overflowY: "auto",
        background: "radial-gradient(circle at 12% -8%, rgba(76,141,255,0.10), transparent 42%), radial-gradient(circle at 100% 0%, rgba(232,184,75,0.06), transparent 38%), #0A0D13",
        fontFamily: "Manrope, sans-serif", color: "#F2F4F8",
      }}>
        {onBack && (
          <button
            onClick={onBack}
            title="Exit (Esc)"
            style={{
              position: "fixed", top: 16, right: 20, zIndex: 10000,
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#9AA3B2", cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        )}
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: isMobile ? "50px 16px 32px" : "60px 24px 40px" }}>
          <div style={{
            background: "linear-gradient(165deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: isMobile ? 20 : 24,
            padding: isMobile ? "28px 20px" : "36px 28px",
            textAlign: "center",
            backdropFilter: "blur(18px)", position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: "-30%", right: "-20%",
              width: 200, height: 200, borderRadius: "50%",
              background: score >= totalQuestions / 2
                ? "radial-gradient(circle, rgba(62,207,142,0.12), transparent 70%)"
                : "radial-gradient(circle, rgba(255,107,94,0.10), transparent 70%)",
              pointerEvents: "none",
            }} />

            <div style={{ fontSize: isMobile ? "32px" : "40px", marginBottom: "8px", position: "relative", zIndex: 2 }}>
              {score === totalQuestions ? "\u{1F3C6}" : score >= totalQuestions / 2 ? "\u{1F389}" : "\u{1F4DA}"}
            </div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              fontSize: isMobile ? 18 : 22, color: "#F2F4F8", marginBottom: "4px", position: "relative", zIndex: 2,
            }}>
              Quiz Complete!
            </div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 800,
              fontSize: isMobile ? 24 : 28,
              color: score >= totalQuestions / 2 ? "#3ECF8E" : "#E8B84B",
              marginBottom: 16, position: "relative", zIndex: 2,
            }}>
              {score} / {totalQuestions}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? "8px" : "10px", marginBottom: "16px", position: "relative", zIndex: 2 }}>
              <StatCard icon={<Zap size={16} />} label="XP Earned" value={`+${xpEarned}`} color="#E8B84B" />
              <StatCard icon={<Clock size={16} />} label="Total Time" value={formatTime(totalTime)} color="#4C8DFF" />
              {totalXp != null && (
                <StatCard icon={<BarChart3 size={16} />} label="Total XP" value={`${totalXp} ${level != null ? `(Lv ${level})` : ""}`} color="#4C8DFF" />
              )}
              {percentile != null && (
                <StatCard icon={<Trophy size={16} />} label="Percentile" value={`Top ${100 - percentile}%`} color="#3ECF8E" />
              )}
              {rank != null && totalTakers != null && (
                <StatCard icon={<Trophy size={16} />} label="Rank" value={`#${rank} / ${totalTakers}`} color="#E8B84B" />
              )}
              {streak != null && streak > 0 && (
                <StatCard icon={<Flame size={16} />} label="Streak" value={`${streak} day${streak > 1 ? "s" : ""}`} color="#FF6B5E" />
              )}
            </div>

            {submitError && (
              <div style={{ fontSize: "11px", color: "#E8B84B", marginBottom: "16px", lineHeight: 1.4, position: "relative", zIndex: 2 }}>
                {submitError}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
              <button onClick={() => setShowReview(!showReview)} style={{
                flex: "1 1 100%", padding: "13px", background: "rgba(76,141,255,0.08)", border: "1px solid rgba(76,141,255,0.25)",
                borderRadius: 14, fontSize: 14, fontWeight: 700, color: "#4C8DFF", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                fontFamily: "Manrope, sans-serif",
              }}>
                {showReview ? "Hide Review" : "Review All Questions"}
              </button>
              <button onClick={handleRetake} style={{
                flex: 1, padding: "13px", background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.25)",
                borderRadius: 14, fontSize: 14, fontWeight: 700, color: "#3ECF8E", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                fontFamily: "Manrope, sans-serif",
              }}>
                <RotateCcw size={16} /> Retake All
              </button>
              {hasWrongQuestions && (
                <button onClick={handleRetryWrong} style={{
                  flex: 1, padding: "13px", background: "rgba(255,107,94,0.08)", border: "1px solid rgba(255,107,94,0.25)",
                  borderRadius: 14, fontSize: 14, fontWeight: 700, color: "#FF6B5E", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  fontFamily: "Manrope, sans-serif",
                }}>
                  <RotateCcw size={16} /> Retry Wrong ({wrongCount})
                </button>
              )}
              <button onClick={onBack} style={{
                flex: 1, padding: "13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, fontSize: 14, fontWeight: 700, color: "#9AA3B2", cursor: "pointer",
                fontFamily: "Manrope, sans-serif",
              }}>
                {"\u2190"} Back to Hub
              </button>
            </div>
          </div>

          {shareToken && (
            <button onClick={handleShare} style={{
              width: "100%", marginTop: "16px", padding: "13px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
              fontSize: 13, fontWeight: 600, color: "#9AA3B2", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              fontFamily: "Manrope, sans-serif",
            }}>
              <Share2 size={16} /> Share this quiz
            </button>
          )}

          {showReview && (
            <div style={{ marginTop: isMobile ? "12px" : "16px" }}>
              {shuffledQuestions.map((q, i) => {
                const userAnswer = answers[i];
                const isCorrect = userAnswer === q.correct;
                const wasSkipped = skipped.has(i) && !locked[i];
                return (
                  <div key={i} style={{
                    marginBottom: isMobile ? "8px" : "12px", padding: isMobile ? "14px" : "18px",
                    background: "linear-gradient(165deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))",
                    border: `1px solid ${isCorrect ? "rgba(62,207,142,0.25)" : wasSkipped ? "rgba(255,255,255,0.07)" : "rgba(255,107,94,0.25)"}`,
                    borderRadius: 16,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      {isCorrect ? <CheckCircle2 size={isMobile ? 14 : 16} style={{ color: "#3ECF8E", flexShrink: 0, marginTop: 2 }} /> : wasSkipped ? <SkipForward size={isMobile ? 14 : 16} style={{ color: "#9AA3B2", flexShrink: 0, marginTop: 2 }} /> : <XCircle size={isMobile ? 14 : 16} style={{ color: "#FF6B5E", flexShrink: 0, marginTop: 2 }} />}
                      <span style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: 600, color: "#F2F4F8", lineHeight: 1.4 }}>Q{i + 1}. {q.question}</span>
                    </div>
                    {Object.entries(q.options).map(([key, val]) => {
                      const isCorrectOpt = key === q.correct;
                      const isUserPick = userAnswer === key;
                      return (
                        <div key={key} style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          padding: isMobile ? "8px 10px" : "10px 12px", marginBottom: "4px", borderRadius: 10,
                          background: isCorrectOpt ? "rgba(62,207,142,0.08)" : isUserPick ? "rgba(255,107,94,0.08)" : "transparent",
                          border: `1px solid ${isCorrectOpt ? "rgba(62,207,142,0.2)" : isUserPick ? "rgba(255,107,94,0.2)" : "rgba(255,255,255,0.05)"}`,
                        }}>
                          <span style={{ fontSize: isMobile ? "11px" : "12px", fontWeight: 700, color: isCorrectOpt ? "#3ECF8E" : isUserPick ? "#FF6B5E" : "#565F6D", minWidth: "18px" }}>{key}.</span>
                          <span style={{ fontSize: isMobile ? "12px" : "13px", color: isCorrectOpt ? "#3ECF8E" : isUserPick ? "#FF6B5E" : "#9AA3B2", flex: 1 }}>{val}</span>
                          {isCorrectOpt && <CheckCircle2 size={isMobile ? 12 : 14} style={{ color: "#3ECF8E" }} />}
                          {isUserPick && !isCorrectOpt && <XCircle size={isMobile ? 12 : 14} style={{ color: "#FF6B5E" }} />}
                        </div>
                      );
                    })}
                    {q.explanation && (
                      <div style={{
                        marginTop: "8px", padding: isMobile ? "10px 12px" : "12px 14px",
                        background: "rgba(76,141,255,0.06)", border: "1px solid rgba(76,141,255,0.2)", borderRadius: 12,
                        fontSize: isMobile ? "11px" : "12px", color: "#9AA3B2", lineHeight: 1.5,
                      }}>
                        <span style={{ fontWeight: 700, color: "#4C8DFF" }}>Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                    <div style={{ marginTop: "6px", fontSize: isMobile ? "10px" : "11px", color: "#565F6D" }}>
                      Time: {formatTime(timePerQuestion.current[i])}
                      {flagged.has(i) && " · Flagged"}
                    </div>

                    {/* AI Explain in review */}
                    <div style={{ marginTop: "8px" }}>
                      {!aiExplainData[i] && (
                        <button
                          onClick={() => getAIExplain(i)}
                          style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            padding: isMobile ? "7px 12px" : "8px 14px",
                            background: "rgba(76,141,255,0.1)", border: "1px solid rgba(76,141,255,0.3)",
                            borderRadius: 10, fontSize: isMobile ? "11px" : "12px", fontWeight: 700,
                            color: "#4C8DFF", cursor: "pointer",
                          }}
                        >
                          <Sparkles size={isMobile ? 12 : 14} /> AI Explain
                        </button>
                      )}

                      {aiExplainData[i]?.loading && (
                        <div style={{
                          marginTop: "6px", padding: "8px 12px",
                          background: "rgba(76,141,255,0.06)", border: "1px solid rgba(76,141,255,0.2)",
                          borderRadius: 10, fontSize: "11px", color: "#4C8DFF",
                        }}>
                          {"\u23F3"} Getting AI explanation…
                        </div>
                      )}

                      {aiExplainData[i]?.explanation && !aiExplainData[i]?.loading && (
                        <div style={{
                          marginTop: "6px", padding: isMobile ? "10px 12px" : "12px 14px",
                          background: "rgba(76,141,255,0.06)", border: "1px solid rgba(76,141,255,0.22)",
                          borderRadius: 12,
                        }}>
                          <div style={{
                            fontSize: "10px", fontWeight: 700, color: "#4C8DFF",
                            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px",
                            display: "flex", alignItems: "center", gap: "4px",
                          }}>
                            <Sparkles size={11} /> AI Explanation
                          </div>
                          <div style={{ fontSize: isMobile ? "11px" : "12px", color: "#9AA3B2", lineHeight: 1.6 }}>
                            <MarkdownText>{aiExplainData[i].explanation}</MarkdownText>
                          </div>

                          {aiExplainData[i].followUps?.map((fu, fi) => (
                            <div key={fi} style={{ marginTop: "8px" }}>
                              <div style={{ fontSize: "11px", color: "#4C8DFF", fontWeight: 600, marginBottom: "2px" }}>
                                Q: {fu.question}
                              </div>
                              <div style={{
                                fontSize: "11px", color: "#9AA3B2", lineHeight: 1.5,
                                padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 8,
                              }}>
                                {fu.answer}
                              </div>
                            </div>
                          ))}

                          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                            <input
                              value={i === currentIndex ? followUpInput : ""}
                              onChange={(e) => { setCurrentIndex(i); setFollowUpInput(e.target.value); }}
                              onKeyDown={(e) => { if (e.key === "Enter" && !aiFollowUpLoading) { setCurrentIndex(i); askFollowUp(i); } }}
                              placeholder="Ask a follow-up…"
                              disabled={aiFollowUpLoading}
                              style={{
                                flex: 1, padding: isMobile ? "7px 10px" : "8px 12px",
                                background: "#12161F", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
                                color: "#F2F4F8", fontSize: "11px", outline: "none", fontFamily: "Manrope, sans-serif",
                              }}
                            />
                            <button
                              onClick={() => { setCurrentIndex(i); askFollowUp(i); }}
                              disabled={aiFollowUpLoading || (i === currentIndex && !followUpInput.trim())}
                              style={{
                                padding: isMobile ? "7px 10px" : "8px 12px",
                                background: aiFollowUpLoading ? "#12161F" : "rgba(76,141,255,0.15)",
                                border: "1px solid rgba(76,141,255,0.3)", borderRadius: 8,
                                color: "#4C8DFF", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: aiFollowUpLoading ? 0.5 : 1,
                              }}
                            >
                              <Send size={isMobile ? 11 : 13} />
                            </button>
                          </div>
                          {aiFollowUpLoading && i === currentIndex && (
                            <div style={{ fontSize: "10px", color: "#565F6D", marginTop: "3px" }}>{"\u23F3"} Thinking…</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {resource?.id && (
            <RatingsAndComments resourceId={resource.id} />
          )}

          {shareToast && (
            <div style={{
              position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
              background: "rgba(62,207,142,0.15)", border: "1px solid rgba(62,207,142,0.3)", color: "#3ECF8E",
              padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 10001,
            }}>
              {shareToast}
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = shuffledQuestions[currentIndex];
  if (!q) return null;
  const selectedAnswer = answers[currentIndex];
  const isLocked = locked[currentIndex];
  const isFlagged = flagged.has(currentIndex);
  const isSkipped = skipped.has(currentIndex);
  const progressPct = ((currentIndex + (isLocked || isSkipped ? 1 : 0)) / totalQuestions) * 100;
  const elapsedThisQ = isLocked ? timePerQuestion.current[currentIndex] : Date.now() - questionStartRef.current;
  const isCorrect = isLocked && selectedAnswer === q.correct;

  const ink = "#0A0D13";
  const inkRaised = "#12161F";
  const cardBorder = "rgba(255,255,255,0.07)";
  const textHi = "#F2F4F8";
  const textMid = "#9AA3B2";
  const textLow = "#565F6D";
  const blue = "#4C8DFF";
  const gold = "#E8B84B";
  const coral = "#FF6B5E";
  const green = "#3ECF8E";

  const pad = isMobile ? "0 20px" : "0 36px";
  const maxW = isMobile ? "640px" : "720px";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: `radial-gradient(circle at 12% -8%, rgba(76,141,255,0.10), transparent 42%), radial-gradient(circle at 100% 0%, rgba(232,184,75,0.06), transparent 38%), ${ink}`,
      display: "flex", justifyContent: "center",
      fontFamily: "Manrope, sans-serif", color: textHi,
    }}>
      {/* App shell */}
      <div style={{
        width: "100%", maxWidth: 1180, height: "100dvh",
        display: "flex", flexDirection: "column", position: "relative",
      }}>

        {/* ─── Top bar ─── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "calc(16px + env(safe-area-inset-top)) 20px 14px" : "24px 36px 16px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, letterSpacing: "0.06em", fontWeight: 500,
              color: gold, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: isMobile ? 220 : 400,
            }}>
              {(resource.title || "QUIZ").toUpperCase()}
            </div>
            {retryWrongOnly && (
              <div style={{ fontSize: 10.5, color: coral, fontWeight: 600 }}>WRONG-ONLY RETRY</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 500, color: textMid,
            }}>
              {"\u23F1"} {formatTime(elapsedThisQ)}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 500, color: green,
            }}>
              {"\u25CF"} {score}/{totalQuestions}
            </div>
            {onBack && (
              <button
                onClick={onBack}
                title="Exit (Esc)"
                style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)", border: `1px solid ${cardBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: textMid, cursor: "pointer", fontSize: 15, flexShrink: 0,
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ─── Progress: EKG pulse line ─── */}
        <div style={{ padding: isMobile ? "0 20px 6px" : "0 36px 8px", flexShrink: 0 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8,
          }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13.5, color: textHi,
            }}>
              Q{currentIndex + 1} <span style={{ color: textLow, fontWeight: 600 }}>/ {totalQuestions}</span>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5, letterSpacing: "0.06em",
              padding: "3px 9px", borderRadius: 20,
              background: "rgba(76,141,255,0.1)", color: blue,
              border: "1px solid rgba(76,141,255,0.25)",
            }}>
              {sessionConfig?.sessionType === "weak" ? "WEAK SPOTS" :
               sessionConfig?.sessionType === "quick10" ? "QUICK 10" :
               sessionConfig?.sessionType === "quick20" ? "QUICK 20" :
               sessionConfig?.sessionType === "quick30" ? "QUICK 30" : "PRACTICE"}
            </div>
          </div>
          {/* EKG track */}
          <div style={{ position: "relative", height: 26, width: "100%", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, borderBottom: "1.5px solid rgba(255,255,255,0.06)" }} />
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0,
              width: `${Math.max(2, progressPct)}%`,
              overflow: "hidden",
              transition: "width 0.5s cubic-bezier(0.65,0,0.35,1)",
            }}>
              <svg width="1600" height="26" viewBox="0 0 1600 26" fill="none" style={{ display: "block", height: 26 }}>
                <path d="M0 13 H60 L75 13 L85 3 L95 23 L105 13 L120 13 H180
                         H240 L255 13 L265 3 L275 23 L285 13 H300
                         H360 L375 13 L385 3 L395 23 L405 13 H420
                         H480 L495 13 L505 3 L515 23 L525 13 H540
                         H600 L615 13 L625 3 L635 23 L645 13 H660
                         H720 L735 13 L745 3 L755 23 L765 13 H780
                         H840 L855 13 L865 3 L875 23 L885 13 H900
                         H960 L975 13 L985 3 L995 23 L1005 13 H1020
                         H1080 L1095 13 L1105 3 L1115 23 L1125 13 H1140
                         H1200 L1215 13 L1225 3 L1235 23 L1245 13 H1260
                         H1320 L1335 13 L1345 3 L1355 23 L1365 13 H1380
                         H1440 L1455 13 L1465 3 L1475 23 L1485 13 H1600"
                      stroke="url(#ekgGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <defs>
                  <linearGradient id="ekgGrad" x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={gold}/>
                    <stop offset="100%" stopColor={blue}/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        {/* ─── Scrollable middle zone ─── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto", padding: "0 0 8px",
          WebkitOverflowScrolling: "touch",
        }}>
          <div style={{
            display: "flex", flexDirection: "column",
            padding: isMobile ? "0 20px" : "0 36px",
            maxWidth: maxW, margin: "0 auto", width: "100%",
          }}>
            {/* Question card */}
            <div style={{
              marginTop: isMobile ? 16 : 22,
              background: "linear-gradient(165deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
              border: `1px solid ${cardBorder}`,
              borderRadius: isMobile ? 24 : 28,
              padding: isMobile ? "26px 22px 22px" : "36px 34px 30px",
              backdropFilter: "blur(18px)", position: "relative", overflow: "hidden",
            }}>
              {/* Card glow */}
              <div style={{
                position: "absolute", top: "-40%", right: "-30%",
                width: 220, height: 220, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(76,141,255,0.12), transparent 70%)",
                pointerEvents: "none",
              }} />

              {/* Question header */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14,
                position: "relative", zIndex: 2, marginBottom: 18,
              }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontWeight: 700,
                  fontSize: isMobile ? 19 : 22, lineHeight: 1.4, letterSpacing: "-0.005em",
                }}>
                  {q.question}
                </div>
                <button
                  onClick={handleFlag}
                  style={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isFlagged ? "rgba(232,184,75,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isFlagged ? "rgba(232,184,75,0.4)" : cardBorder}`,
                    color: isFlagged ? gold : textLow, cursor: "pointer",
                    fontSize: 15, transition: "color 0.2s, border-color 0.2s",
                  }}
                  title="Flag for review"
                >
                  <Flag size={15} fill={isFlagged ? gold : "none"} />
                </button>
              </div>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 2 }}>
                {Object.entries(q.options).map(([key, value]) => {
                  const isSelected = selectedAnswer === key;
                  const isCorrectOption = key === q.correct;
                  const showCorrect = isLocked && isCorrectOption;
                  const showWrong = isLocked && isSelected && !isCorrectOption;
                  const isDim = isLocked && !isSelected && !isCorrectOption;

                  let borderColor = cardBorder;
                  let bgColor = "rgba(255,255,255,0.02)";
                  let badgeBg = "rgba(255,255,255,0.04)";
                  let badgeColor = textMid;
                  let badgeBorder = cardBorder;

                  if (!isLocked && isSelected) {
                    borderColor = blue; bgColor = "rgba(76,141,255,0.08)";
                    badgeBg = blue; badgeColor = "#fff"; badgeBorder = blue;
                  }
                  if (showCorrect) {
                    borderColor = green; bgColor = "rgba(62,207,142,0.08)";
                    badgeBg = green; badgeColor = ink; badgeBorder = green;
                  }
                  if (showWrong) {
                    borderColor = coral; bgColor = "rgba(255,107,94,0.08)";
                    badgeBg = coral; badgeColor = ink; badgeBorder = coral;
                  }

                  return (
                    <div
                      key={key}
                      onClick={() => handleSelectAnswer(key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: isMobile ? "15px 16px" : "17px 18px",
                        borderRadius: 16,
                        border: `1.5px solid ${borderColor}`,
                        background: bgColor,
                        cursor: isLocked ? "default" : "pointer",
                        transition: "border-color 0.2s ease, background 0.2s ease, transform 0.12s ease",
                        opacity: isDim ? 0.45 : 1,
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 9,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 13,
                        color: badgeColor, background: badgeBg,
                        border: `1px solid ${badgeBorder}`, flexShrink: 0,
                      }}>
                        {key}
                      </div>
                      <span style={{
                        fontSize: isMobile ? 14.5 : 15, lineHeight: 1.45, color: textHi, flex: 1,
                      }}>
                        {value}
                      </span>
                      {showCorrect && <CheckCircle2 size={17} style={{ color: green, flexShrink: 0 }} />}
                      {showWrong && <XCircle size={17} style={{ color: coral, flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation panel (slide-open) */}
              {isLocked && (
                <div style={{
                  maxHeight: isLocked ? 600 : 0, overflow: "hidden",
                  marginTop: isLocked ? 16 : 0, opacity: isLocked ? 1 : 0,
                  transition: "max-height 0.4s ease, margin-top 0.4s ease, opacity 0.3s ease",
                  position: "relative", zIndex: 2,
                }}>
                  {/* Built-in explanation */}
                  {q.explanation && (
                    <div style={{
                      borderRadius: 16,
                      border: "1px solid rgba(76,141,255,0.22)",
                      background: "rgba(76,141,255,0.06)",
                      padding: "16px 16px",
                      marginBottom: 12,
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 7,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: blue, marginBottom: 8, fontWeight: 500,
                      }}>
                        <Sparkles size={12} /> Explanation
                      </div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: textMid }}>
                        {q.explanation}
                      </div>
                    </div>
                  )}

                  {/* AI Explain button + follow-up chat */}
                  <div style={{ marginTop: 4 }}>
                    {!aiExplainData[currentIndex] && (
                      <button
                        onClick={() => getAIExplain(currentIndex)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "10px 16px",
                          background: "rgba(76,141,255,0.1)", border: "1px solid rgba(76,141,255,0.3)",
                          borderRadius: 12, fontSize: 13, fontWeight: 700,
                          color: blue, cursor: "pointer",
                        }}
                      >
                        <Sparkles size={15} /> AI Explain
                      </button>
                    )}

                    {aiExplainData[currentIndex]?.loading && (
                      <div style={{
                        marginTop: 8, padding: "12px 16px",
                        background: "rgba(76,141,255,0.06)", border: "1px solid rgba(76,141,255,0.2)",
                        borderRadius: 12, fontSize: 12.5, color: blue,
                      }}>
                        {"\u23F3"} Getting AI explanation…
                      </div>
                    )}

                    {aiExplainData[currentIndex]?.explanation && !aiExplainData[currentIndex]?.loading && (
                      <div style={{
                        marginTop: 8, padding: "16px",
                        background: "rgba(76,141,255,0.06)", border: "1px solid rgba(76,141,255,0.22)",
                        borderRadius: 16,
                      }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 7,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
                          color: blue, marginBottom: 8, fontWeight: 500,
                        }}>
                          <Sparkles size={12} /> AI Explanation
                        </div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: textMid }}>
                          <MarkdownText>{aiExplainData[currentIndex].explanation}</MarkdownText>
                        </div>

                        {/* Follow-up Q&A history */}
                        {aiExplainData[currentIndex].followUps?.map((fu, fi) => (
                          <div key={fi} style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, color: blue, fontWeight: 600, marginBottom: 3 }}>
                              Q: {fu.question}
                            </div>
                            <div style={{
                              fontSize: 12.5, lineHeight: 1.6, color: textMid,
                              padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8,
                            }}>
                              {fu.answer}
                            </div>
                          </div>
                        ))}

                        {/* Follow-up input */}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <input
                            value={followUpInput}
                            onChange={(e) => setFollowUpInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !aiFollowUpLoading) askFollowUp(currentIndex); }}
                            placeholder="Ask a follow-up question…"
                            disabled={aiFollowUpLoading}
                            style={{
                              flex: 1, padding: "10px 14px",
                              background: inkRaised, border: `1px solid ${cardBorder}`, borderRadius: 10,
                              color: textHi, fontSize: 13, outline: "none", fontFamily: "Manrope, sans-serif",
                            }}
                          />
                          <button
                            onClick={() => askFollowUp(currentIndex)}
                            disabled={aiFollowUpLoading || !followUpInput.trim()}
                            style={{
                              padding: "10px 14px",
                              background: aiFollowUpLoading || !followUpInput.trim() ? inkRaised : "rgba(76,141,255,0.15)",
                              border: "1px solid rgba(76,141,255,0.3)", borderRadius: 10,
                              color: blue, cursor: aiFollowUpLoading || !followUpInput.trim() ? "default" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: aiFollowUpLoading || !followUpInput.trim() ? 0.5 : 1,
                            }}
                          >
                            <Send size={15} />
                          </button>
                        </div>
                        {aiFollowUpLoading && (
                          <div style={{ fontSize: 11, color: textLow, marginTop: 4 }}>{"\u23F3"} Thinking…</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mastery row */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              margin: "14px 0 0",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5, color: textLow,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: isLocked ? (isCorrect ? green : coral) : blue,
              }} />
              {isLocked
                ? (isCorrect ? "Correct" : selectedAnswer ? "Incorrect" : "Skipped")
                : "Not yet answered"}
              {isFlagged && <span style={{ marginLeft: 6, color: gold }}>{"\u2691"} Flagged</span>}
            </div>
          </div>
        </div>

        {/* ─── Bottom controls (pinned) ─── */}
        <div style={{
          flexShrink: 0,
          padding: isMobile ? "14px 20px calc(16px + env(safe-area-inset-bottom))" : "18px 36px 28px",
          background: `linear-gradient(0deg, ${ink} 55%, rgba(10,13,19,0))`,
        }}>
          <div style={{ display: "flex", gap: 10, maxWidth: maxW, margin: "0 auto" }}>
            {/* Prev button */}
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0 || submitting}
              style={{
                flex: "0 0 92px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: isMobile ? "16px 0" : "17px 0",
                borderRadius: 16,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${cardBorder}`,
                color: currentIndex === 0 ? textLow : textMid,
                fontWeight: 700, fontSize: 14, cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                opacity: currentIndex === 0 ? 0.4 : 1,
                transition: "background 0.2s",
                fontFamily: "Manrope, sans-serif",
              }}
              onMouseEnter={(e) => { if (currentIndex > 0) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            >
              {"\u2039"} Prev
            </button>

            {/* Next / Skip / Submit button */}
            {isLocked ? (
              <button
                onClick={handleNext}
                disabled={submitting}
                style={{
                  flex: 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: isMobile ? "16px 0" : "17px 0",
                  borderRadius: 16, border: "none",
                  background: submitting ? textLow : (isCorrect ? green : coral),
                  color: submitting ? "rgba(255,255,255,0.5)" : ink,
                  fontWeight: 700, fontSize: 14.5, cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: isCorrect ? "0 8px 24px -8px rgba(62,207,142,0.5)" : "0 8px 24px -8px rgba(255,107,94,0.5)",
                  transition: "background 0.25s ease, color 0.25s ease",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                {submitting ? "Submitting..." : currentIndex < totalQuestions - 1
                  ? (isCorrect ? "Correct — Continue →" : "Continue →")
                  : (isCorrect ? "Correct — See Results →" : "See Results →")}
              </button>
            ) : (
              <button
                onClick={handleSkip}
                style={{
                  flex: 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: isMobile ? "16px 0" : "17px 0",
                  borderRadius: 16, border: "none",
                  background: textLow, color: "rgba(255,255,255,0.5)",
                  fontWeight: 700, fontSize: 14.5, cursor: "pointer",
                  transition: "background 0.25s ease, color 0.25s ease",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                <SkipForward size={16} /> Skip Question
              </button>
            )}
          </div>
        </div>

        {/* Keyboard hint */}
        {!isMobile && (
          <div style={{
            position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
            fontSize: 10, color: "rgba(86,95,109,0.6)", pointerEvents: "none",
          }}>
            A–D select · Enter skip/next · Esc exit
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 14px", background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
    }}>
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: "#565F6D", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}
