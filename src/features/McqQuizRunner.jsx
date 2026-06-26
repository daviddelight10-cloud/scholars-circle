import { useState, useMemo, useCallback, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const XP_PER_CORRECT = 20;

export default function McqQuizRunner({ resource, onBack, onQuizComplete }) {
  const questions = useMemo(() => {
    const raw = resource.mcqData;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return [];
  }, [resource]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const questionStartRef = useRef(Date.now());
  const timePerQuestion = useRef({});

  // Reset question timer when index changes
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [currentIndex]);

  const totalQuestions = questions.length;
  const score = useMemo(() => {
    return questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
  }, [answers, questions]);

  const handleSelectAnswer = useCallback((optionKey) => {
    if (locked[currentIndex]) return;
    const elapsed = Date.now() - questionStartRef.current;
    timePerQuestion.current[currentIndex] = elapsed;
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionKey }));
    setLocked((prev) => ({ ...prev, [currentIndex]: true }));
  }, [currentIndex, locked]);

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
          details: questions.map((q, i) => ({
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
    setCurrentIndex(0);
    setAnswers({});
    setLocked({});
    setShowResults(false);
    setResultsData(null);
    setSubmitError("");
  }, []);

  if (totalQuestions === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#7b82b8" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
        <div style={{ fontSize: "15px", marginBottom: "16px" }}>This quiz has no questions yet.</div>
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

    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <button onClick={onBack} style={backBtnStyle}>← Back to Research Hub</button>

        <div style={{
          background: "#0d0f20",
          border: "0.5px solid #1e2245",
          borderRadius: "16px",
          padding: "32px 24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>
            {score === totalQuestions ? "🏆" : score >= totalQuestions / 2 ? "🎉" : "📚"}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#e8eaf6", marginBottom: "6px" }}>
            Quiz Complete!
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: score >= totalQuestions / 2 ? "#66bb6a" : "#ffb74d", marginBottom: "20px" }}>
            {score} / {totalQuestions}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            <div style={statRowStyle}>
              <span style={statLabelStyle}>XP Earned</span>
              <span style={{ ...statValueStyle, color: "#f5a623" }}>+{xpEarned} XP</span>
            </div>

            {totalXp != null && (
              <div style={statRowStyle}>
                <span style={statLabelStyle}>Total XP</span>
                <span style={{ ...statValueStyle, color: "#7986cb" }}>
                  {totalXp} XP {level != null && <span style={{ marginLeft: 6, padding: "2px 8px", borderRadius: "8px", background: "#1a237e", fontSize: "11px" }}>Lv {level}</span>}
                </span>
              </div>
            )}

            {percentile != null && (
              <div style={statRowStyle}>
                <span style={statLabelStyle}>Percentile</span>
                <span style={{ ...statValueStyle, color: "#66bb6a" }}>
                  Top {100 - percentile}%{percentile >= 90 ? " 🏅" : ""}
                </span>
              </div>
            )}

            {rank != null && totalTakers != null && (
              <div style={statRowStyle}>
                <span style={statLabelStyle}>Rank</span>
                <span style={{ ...statValueStyle, color: "#9fa8da" }}>
                  #{rank} of {totalTakers} takers
                </span>
              </div>
            )}

            {streak != null && streak > 0 && (
              <div style={statRowStyle}>
                <span style={statLabelStyle}>Daily Streak</span>
                <span style={{ ...statValueStyle, color: "#ff7043" }}>
                  🔥 {streak} day{streak > 1 ? "s" : ""}
                  {streakIsNewDay && <span style={{ marginLeft: 6, fontSize: "11px", color: "#ffb74d" }}>+1 today!</span>}
                  {longestStreak > streak && <span style={{ marginLeft: 6, fontSize: "11px", color: "#5a6090" }}>best: {longestStreak}</span>}
                </span>
              </div>
            )}
          </div>

          {submitError && (
            <div style={{ fontSize: "11px", color: "#ffb74d", marginBottom: "16px", lineHeight: 1.4 }}>
              {submitError}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleRetake} style={{
              flex: 1, padding: "12px", background: "#1a237e", border: "0.5px solid #3949ab",
              borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#c5cae9", cursor: "pointer",
            }}>
              🔄 Retake Quiz
            </button>
            <button onClick={onBack} style={{
              flex: 1, padding: "12px", background: "#0f1128", border: "0.5px solid #252860",
              borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#7986cb", cursor: "pointer",
            }}>
              ← Back to Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const isLocked = locked[currentIndex];
  const progressPct = ((currentIndex + (isLocked ? 1 : 0)) / totalQuestions) * 100;

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto" }}>
      <button onClick={onBack} style={backBtnStyle}>← Back to Research Hub</button>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#9fa8da" }}>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <span style={{ fontSize: "12px", color: "#4a5080" }}>
            Score: {score}/{totalQuestions}
          </span>
        </div>
        <div style={{
          height: "6px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: "linear-gradient(90deg, #3949ab, #5c6bc0)",
            borderRadius: "4px", transition: "width 0.3s ease",
          }} />
        </div>
      </div>

      <div style={{
        background: "#0d0f20",
        border: "0.5px solid #1e2245",
        borderRadius: "12px",
        padding: "20px",
      }}>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#e8eaf6", lineHeight: 1.5, marginBottom: "18px" }}>
          {q.question}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px", borderRadius: "10px",
                  border: showCorrect ? "1px solid #2a6a3a" : showWrong ? "1px solid #6a2a2a" : "0.5px solid #1e2245",
                  background: showCorrect ? "#0f2a1a" : showWrong ? "#2a0f0f" : isSelected ? "#0f1240" : "transparent",
                  cursor: isLocked ? "default" : "pointer",
                  transition: "all 0.15s",
                  opacity: isLocked && !isSelected && !isCorrectOption ? 0.5 : 1,
                }}
              >
                <div style={{
                  width: "24px", height: "24px", borderRadius: "6px",
                  background: showCorrect ? "#2a6a3a" : showWrong ? "#6a2a2a" : "#12142a",
                  border: showCorrect ? "1px solid #3a8a4a" : showWrong ? "1px solid #8a3a3a" : "0.5px solid #252860",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: 700,
                  color: showCorrect ? "#a5d6a7" : showWrong ? "#ef9a9a" : "#5a6090",
                  flexShrink: 0,
                }}>
                  {key}
                </div>
                <span style={{
                  fontSize: "13px",
                  color: showCorrect ? "#a5d6a7" : showWrong ? "#ef9a9a" : "#c5c9e8",
                  flex: 1,
                }}>
                  {value}
                </span>
                {showCorrect && <span style={{ fontSize: "16px" }}>✓</span>}
                {showWrong && <span style={{ fontSize: "16px" }}>✗</span>}
              </div>
            );
          })}
        </div>

        {isLocked && q.explanation && (
          <div style={{
            marginTop: "16px", padding: "12px 14px",
            background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px",
            fontSize: "12px", color: "#9fa8da", lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 700, color: "#7986cb" }}>Explanation: </span>
            {q.explanation}
          </div>
        )}

        {isLocked && (
          <button
            onClick={handleNext}
            disabled={submitting}
            style={{
              width: "100%", marginTop: "16px", padding: "12px",
              background: submitting ? "#0f1128" : "#1a237e",
              border: "0.5px solid #3949ab", borderRadius: "10px",
              fontSize: "14px", fontWeight: 700, color: "#c5cae9",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? "Submitting..." : currentIndex < totalQuestions - 1 ? "Next Question →" : "See Results →"}
          </button>
        )}
      </div>
    </div>
  );
}

const backBtnStyle = {
  display: "flex", alignItems: "center", gap: "8px",
  padding: "8px 12px", background: "#111328",
  border: "0.5px solid #2a2d4a", borderRadius: "8px",
  fontSize: "13px", color: "#7b82b8", cursor: "pointer",
  marginBottom: "20px",
};

const statRowStyle = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 14px", background: "#0a0c1e",
  border: "0.5px solid #1e2245", borderRadius: "8px",
};

const statLabelStyle = {
  fontSize: "13px", fontWeight: 600, color: "#7b82b8",
};

const statValueStyle = {
  fontSize: "14px", fontWeight: 700,
};
