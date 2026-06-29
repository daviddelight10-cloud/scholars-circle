import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Flag, SkipForward, RotateCcw, Share2, Clock, CheckCircle2, XCircle, ChevronRight, Trophy, Zap, BarChart3, Flame } from "lucide-react";
import RatingsAndComments from "../components/RatingsAndComments.jsx";
import { copyShareToken } from "../lib/researchUtils.js";

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

const fullscreenStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "#060818",
  display: "flex",
  flexDirection: "column",
};

const backBtnStyle = {
  display: "flex", alignItems: "center", gap: "8px",
  padding: "8px 12px", background: "#111328",
  border: "0.5px solid #2a2d4a", borderRadius: "8px",
  fontSize: "13px", color: "#7b82b8", cursor: "pointer",
  marginBottom: "20px",
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

export default function McqQuizRunner({ resource, shareToken, onBack, onQuizComplete }) {
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
      prepareQuestions(rawQuestions);
    }
  }, [rawQuestions, prepareQuestions]);

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
      } else {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error || "Failed to submit quiz");
        setResultsData({
          xpAwarded: score * XP_PER_CORRECT,
          totalXp: null,
          percentile: null,
          rank: null,
          totalTakers: null,
        });
      }
    } catch {
      setSubmitError("Network error — results shown locally");
      setResultsData({
        xpAwarded: score * XP_PER_CORRECT,
        totalXp: null,
        percentile: null,
        rank: null,
        totalTakers: null,
      });
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
  }, []);

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
      <div style={{ ...fullscreenStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <ExitButton onBack={onBack} />
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
        <div style={{ fontSize: "15px", marginBottom: "16px", color: "#7b82b8" }}>This quiz has no questions yet.</div>
        <button onClick={onBack} style={backBtnStyle}>← Back to Research Hub</button>
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
      <div style={{ ...fullscreenStyle, overflowY: "auto" }}>
        <ExitButton onBack={onBack} />
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: isMobile ? "50px 12px 32px" : "60px 20px 40px" }}>
          <div style={{
            background: "#0d0f20",
            border: "0.5px solid #1e2245",
            borderRadius: isMobile ? "12px" : "16px",
            padding: isMobile ? "24px 16px" : "32px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: isMobile ? "32px" : "40px", marginBottom: "8px" }}>
              {score === totalQuestions ? "🏆" : score >= totalQuestions / 2 ? "🎉" : "📚"}
            </div>
            <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 700, color: "#e8eaf6", marginBottom: "4px" }}>
              Quiz Complete!
            </div>
            <div style={{ fontSize: isMobile ? "24px" : "28px", fontWeight: 800, color: score >= totalQuestions / 2 ? "#66bb6a" : "#ffb74d", marginBottom: "16px" }}>
              {score} / {totalQuestions}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? "8px" : "10px", marginBottom: "16px" }}>
              <StatCard icon={<Zap size={16} />} label="XP Earned" value={`+${xpEarned}`} color="#f5a623" />
              <StatCard icon={<Clock size={16} />} label="Total Time" value={formatTime(totalTime)} color="#7986cb" />
              {totalXp != null && (
                <StatCard icon={<BarChart3 size={16} />} label="Total XP" value={`${totalXp} ${level != null ? `(Lv ${level})` : ""}`} color="#7986cb" />
              )}
              {percentile != null && (
                <StatCard icon={<Trophy size={16} />} label="Percentile" value={`Top ${100 - percentile}%`} color="#66bb6a" />
              )}
              {rank != null && totalTakers != null && (
                <StatCard icon={<Trophy size={16} />} label="Rank" value={`#${rank} / ${totalTakers}`} color="#9fa8da" />
              )}
              {streak != null && streak > 0 && (
                <StatCard icon={<Flame size={16} />} label="Streak" value={`${streak} day${streak > 1 ? "s" : ""}`} color="#ff7043" />
              )}
            </div>

            {submitError && (
              <div style={{ fontSize: "11px", color: "#ffb74d", marginBottom: "16px", lineHeight: 1.4 }}>
                {submitError}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => setShowReview(!showReview)} style={{
                flex: "1 1 100%", padding: "12px", background: "#0f1128", border: "0.5px solid #252860",
                borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#7986cb", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}>
                {showReview ? "Hide Review" : "Review All Questions"}
              </button>
              <button onClick={handleRetake} style={{
                flex: 1, padding: "12px", background: "#1a237e", border: "0.5px solid #3949ab",
                borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#c5cae9", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}>
                <RotateCcw size={16} /> Retake All
              </button>
              {hasWrongQuestions && (
                <button onClick={handleRetryWrong} style={{
                  flex: 1, padding: "12px", background: "#2a0a0a", border: "0.5px solid #6a2a2a",
                  borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#ef9a9a", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}>
                  <RotateCcw size={16} /> Retry Wrong ({wrongCount})
                </button>
              )}
              <button onClick={onBack} style={{
                flex: 1, padding: "12px", background: "#0f1128", border: "0.5px solid #252860",
                borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#7986cb", cursor: "pointer",
              }}>
                ← Back to Hub
              </button>
            </div>
          </div>

          {shareToken && (
            <button onClick={handleShare} style={{
              width: "100%", marginTop: "16px", padding: "12px",
              background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px",
              fontSize: "13px", fontWeight: 600, color: "#7986cb", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
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
                    marginBottom: isMobile ? "8px" : "12px", padding: isMobile ? "12px" : "16px",
                    background: "#0d0f20", border: `0.5px solid ${isCorrect ? "#2a6a3a" : wasSkipped ? "#3a3d60" : "#6a2a2a"}`,
                    borderRadius: "10px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      {isCorrect ? <CheckCircle2 size={isMobile ? 14 : 16} style={{ color: "#66bb6a", flexShrink: 0, marginTop: 2 }} /> : wasSkipped ? <SkipForward size={isMobile ? 14 : 16} style={{ color: "#7b82b8", flexShrink: 0, marginTop: 2 }} /> : <XCircle size={isMobile ? 14 : 16} style={{ color: "#ef5350", flexShrink: 0, marginTop: 2 }} />}
                      <span style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: 600, color: "#c5c9e8", lineHeight: 1.4 }}>Q{i + 1}. {q.question}</span>
                    </div>
                    {Object.entries(q.options).map(([key, val]) => {
                      const isCorrectOpt = key === q.correct;
                      const isUserPick = userAnswer === key;
                      return (
                        <div key={key} style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          padding: isMobile ? "6px 10px" : "8px 12px", marginBottom: "4px", borderRadius: "6px",
                          background: isCorrectOpt ? "rgba(76,175,80,0.12)" : isUserPick ? "rgba(244,67,54,0.12)" : "transparent",
                          border: `0.5px solid ${isCorrectOpt ? "#2a6a3a" : isUserPick ? "#6a2a2a" : "#1e2245"}`,
                        }}>
                          <span style={{ fontSize: isMobile ? "11px" : "12px", fontWeight: 700, color: isCorrectOpt ? "#66bb6a" : isUserPick ? "#ef5350" : "#5a6090", minWidth: "18px" }}>{key}.</span>
                          <span style={{ fontSize: isMobile ? "12px" : "13px", color: isCorrectOpt ? "#a5d6a7" : isUserPick ? "#ef9a9a" : "#9fa8da", flex: 1 }}>{val}</span>
                          {isCorrectOpt && <CheckCircle2 size={isMobile ? 12 : 14} style={{ color: "#66bb6a" }} />}
                          {isUserPick && !isCorrectOpt && <XCircle size={isMobile ? 12 : 14} style={{ color: "#ef5350" }} />}
                        </div>
                      );
                    })}
                    {q.explanation && (
                      <div style={{
                        marginTop: "8px", padding: isMobile ? "8px 10px" : "10px 12px",
                        background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px",
                        fontSize: isMobile ? "11px" : "12px", color: "#9fa8da", lineHeight: 1.5,
                      }}>
                        <span style={{ fontWeight: 700, color: "#7986cb" }}>Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                    <div style={{ marginTop: "6px", fontSize: isMobile ? "10px" : "11px", color: "#4a5080" }}>
                      Time: {formatTime(timePerQuestion.current[i])}
                      {flagged.has(i) && " · Flagged"}
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
              background: "#0f2a1a", border: "0.5px solid #2a6a3a", color: "#a5d6a7",
              padding: "10px 20px", borderRadius: "20px", fontSize: "13px", fontWeight: 600, zIndex: 10001,
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

  return (
    <div style={fullscreenStyle}>
      <ExitButton onBack={onBack} />

      <div style={{
        display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px",
        padding: isMobile ? "8px 44px 8px 12px" : "12px 52px 12px 20px",
        background: "#0a0c1e", borderBottom: "0.5px solid #1e2245",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: isMobile ? "11px" : "13px", fontWeight: 600, color: "#9fa8da", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {resource.title}
        </span>
        <span style={{ fontSize: isMobile ? "10px" : "12px", color: "#5a6090", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <Clock size={isMobile ? 11 : 13} /> {formatTime(elapsedThisQ)}
        </span>
        <span style={{ fontSize: isMobile ? "10px" : "12px", fontWeight: 600, color: "#66bb6a", flexShrink: 0 }}>
          {score}/{totalQuestions}
        </span>
      </div>

      <div style={{ padding: isMobile ? "8px 12px 0" : "12px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: isMobile ? "11px" : "12px", fontWeight: 600, color: "#7b82b8" }}>
            Q{currentIndex + 1}/{totalQuestions}
            {retryWrongOnly && <span style={{ marginLeft: 6, color: "#ef9a9a" }}>(wrong only)</span>}
          </span>
        </div>
        <div style={{ height: "4px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: "linear-gradient(90deg, #3949ab, #5c6bc0)",
            borderRadius: "4px", transition: "width 0.3s ease",
          }} />
        </div>
        {(!isMobile || totalQuestions <= 20) && (
          <div style={{ display: "flex", gap: "3px", marginTop: "6px", flexWrap: "wrap" }}>
            {shuffledQuestions.map((_, i) => (
              <button
                key={i}
                onClick={() => goToQuestion(i)}
                style={{
                  width: isMobile ? "8px" : "10px", height: isMobile ? "8px" : "10px", borderRadius: "50%",
                  border: "none", cursor: "pointer", padding: 0,
                  background: i === currentIndex ? "#5c6bc0"
                    : locked[i] ? (answers[i] === shuffledQuestions[i].correct ? "#4caf50" : "#ef5350")
                    : skipped.has(i) ? "#5a6090"
                    : flagged.has(i) ? "#ff7043"
                    : "#1e2245",
                }}
                title={`Q${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "20px", maxWidth: "700px", margin: "0 auto", width: "100%" }}>
        <div style={{
          background: "#0d0f20",
          border: "0.5px solid #1e2245",
          borderRadius: isMobile ? "10px" : "12px",
          padding: isMobile ? "14px" : "20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
            <div style={{ fontSize: isMobile ? "14px" : "16px", fontWeight: 600, color: "#e8eaf6", lineHeight: 1.5, flex: 1 }}>
              {q.question}
            </div>
            <button onClick={handleFlag} style={{
              background: "none", border: "none", cursor: "pointer", padding: "4px",
              color: isFlagged ? "#ff7043" : "#3a3d60", flexShrink: 0,
            }} title="Flag for review">
              <Flag size={isMobile ? 16 : 18} fill={isFlagged ? "#ff7043" : "none"} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "6px" : "8px" }}>
            {Object.entries(q.options).map(([key, value]) => {
              const isSelected = selectedAnswer === key;
              const isCorrectOption = key === q.correct;
              const showCorrect = isLocked && isCorrectOption;
              const showWrong = isLocked && isSelected && !isCorrectOption;

              return (
                <div
                  key={key}
                  onClick={() => handleSelectAnswer(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: isMobile ? "8px" : "12px",
                    padding: isMobile ? "10px 12px" : "12px 14px", borderRadius: "10px",
                    border: showCorrect ? "1px solid #2a6a3a" : showWrong ? "1px solid #6a2a2a" : "0.5px solid #1e2245",
                    background: showCorrect ? "#0f2a1a" : showWrong ? "#2a0f0f" : isSelected ? "#0f1240" : "transparent",
                    cursor: isLocked ? "default" : "pointer",
                    transition: "all 0.15s",
                    opacity: isLocked && !isSelected && !isCorrectOption ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    width: isMobile ? "24px" : "28px", height: isMobile ? "24px" : "28px", borderRadius: "6px",
                    background: showCorrect ? "#2a6a3a" : showWrong ? "#6a2a2a" : "#12142a",
                    border: showCorrect ? "1px solid #3a8a4a" : showWrong ? "1px solid #8a3a3a" : "0.5px solid #252860",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: isMobile ? "11px" : "12px", fontWeight: 700,
                    color: showCorrect ? "#a5d6a7" : showWrong ? "#ef9a9a" : "#5a6090",
                    flexShrink: 0,
                  }}>
                    {key}
                  </div>
                  <span style={{
                    fontSize: isMobile ? "13px" : "14px",
                    color: showCorrect ? "#a5d6a7" : showWrong ? "#ef9a9a" : "#c5c9e8",
                    flex: 1,
                  }}>
                    {value}
                  </span>
                  {showCorrect && <CheckCircle2 size={isMobile ? 16 : 18} style={{ color: "#66bb6a" }} />}
                  {showWrong && <XCircle size={isMobile ? 16 : 18} style={{ color: "#ef5350" }} />}
                </div>
              );
            })}
          </div>

          {isLocked && q.explanation && (
            <div style={{
              marginTop: isMobile ? "12px" : "16px", padding: isMobile ? "10px 12px" : "14px",
              background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px",
              fontSize: isMobile ? "12px" : "13px", color: "#9fa8da", lineHeight: 1.6,
            }}>
              <span style={{ fontWeight: 700, color: "#7986cb" }}>Explanation: </span>
              {q.explanation}
            </div>
          )}

          {isLocked && !q.explanation && (
            <div style={{
              marginTop: "12px", padding: "10px 14px",
              background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px",
              fontSize: "12px", color: "#4a5080", fontStyle: "italic",
            }}>
              No explanation provided for this question.
            </div>
          )}

          {isLocked ? (
            <button
              onClick={handleNext}
              disabled={submitting}
              style={{
                width: "100%", marginTop: isMobile ? "12px" : "16px", padding: isMobile ? "10px" : "12px",
                background: submitting ? "#0f1128" : "#1a237e",
                border: "0.5px solid #3949ab", borderRadius: "10px",
                fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: "#c5cae9",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {submitting ? "Submitting..." : currentIndex < totalQuestions - 1 ? "Next" : "See Results"}
              {!submitting && <ChevronRight size={isMobile ? 14 : 16} />}
            </button>
          ) : (
            <div style={{ display: "flex", gap: "10px", marginTop: isMobile ? "12px" : "16px" }}>
              <button
                onClick={handleSkip}
                style={{
                  flex: 1, padding: isMobile ? "10px" : "12px",
                  background: "transparent", border: "0.5px solid #2a2d4a", borderRadius: "10px",
                  fontSize: isMobile ? "12px" : "13px", fontWeight: 600, color: "#5a6090", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                }}
              >
                <SkipForward size={isMobile ? 13 : 15} /> Skip
              </button>
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={{ marginTop: "12px", textAlign: "center", fontSize: "11px", color: "#3a3d60" }}>
            Press A–D to select · Enter to skip/next · Esc to exit
          </div>
        )}
      </div>
    </div>
  );
}

function ExitButton({ onBack }) {
  if (!onBack) return null;
  return (
    <button
      onClick={onBack}
      title="Exit (Esc)"
      style={{
        position: "fixed", top: 12, right: 12, zIndex: 10000,
        width: 36, height: 36, borderRadius: "50%",
        background: "rgba(0,0,0,0.5)", border: "none",
        color: "#fff", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <X size={18} />
    </button>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 14px", background: "#0a0c1e",
      border: "0.5px solid #1e2245", borderRadius: "10px",
    }}>
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: "11px", color: "#5a6090", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "14px", fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}
