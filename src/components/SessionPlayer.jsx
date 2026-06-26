import React, { useState, useEffect } from "react";
import { MODE_MULTIPLIERS, XP_PER_CORRECT, STREAK_BONUS } from "../data";
import { callAI } from "../lib/aiClient";
import { calculateSessionAnalytics, PostSessionInsights } from "../features/EnhancedSession";

export function SessionPlayer({ session, onExit, onComplete, aiConfig }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [confidence, setConfidence] = useState("unsure");
  const [timeLeft, setTimeLeft] = useState(session.totalSeconds ?? null);
  const [startedAt] = useState(Date.now());
  const [finalResult, setFinalResult] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [streakBonus, setStreakBonus] = useState(0);
  const [totalStreakBonus, setTotalStreakBonus] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());

  const current = session.questions[idx];
  const modeMultiplier = MODE_MULTIPLIERS[session.mode] || 1;
  const currentXP = Math.round((score * XP_PER_CORRECT + totalStreakBonus) * modeMultiplier);

  function toggleFlag() {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  }

  async function askAIForExplanation() {
    if (!current) return;
    setAiLoading(true);
    setAiExplanation(null);
    try {
      const userAnswer = current.options[selected];
      const correctAnswer = current.options[current.answer];
      const isCorrect = selected === current.answer;
      const prompt = `You are a helpful tutor. A student answered a multiple choice question${isCorrect ? " correctly" : " incorrectly"}.

Question: ${current.q}

The student chose: ${userAnswer}

The correct answer is: ${correctAnswer}

The existing explanation is: ${current.explanation || "No explanation provided."}

${isCorrect
  ? "The student got it right! Reinforce why this is correct and briefly explain the concept. Keep it concise (2-3 sentences) and educational."
  : "Explain in a friendly, encouraging way why the student's answer is wrong and why the correct answer is right. Keep it concise (2-3 sentences) and educational."}`;
      const explanation = await callAI(prompt, aiConfig);
      setAiExplanation(explanation);
    } catch (err) {
      setAiExplanation("Sorry, couldn't get AI explanation. Please try again later.");
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  const isExamLike = session.mode === "exam";
  const perQuestionTarget = session.totalSeconds ? Math.round(session.totalSeconds / session.questions.length) : null;

  useEffect(() => {
    if (timeLeft == null || showResult || finalResult) return undefined;
    if (timeLeft <= 0) {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      setFinalResult({
        score,
        total: session.questions.length,
        results,
        mode: session.mode,
        seconds: elapsedSeconds
      });
      return undefined;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, showResult, finalResult]);

  if (!current) {
    return (
      <div className="card">
        <h2>No questions available for this mode.</h2>
        <button onClick={onExit}>Back</button>
      </div>
    );
  }

  if (finalResult) {
    const analytics = calculateSessionAnalytics(finalResult.results, session.questions, finalResult.seconds);
    return (
      <PostSessionInsights
        analytics={analytics}
        session={session}
        results={finalResult.results}
        questions={session.questions}
        history={[]}
        aiConfig={aiConfig}
        onExit={() => {
          onComplete({ ...finalResult, streakBonus: totalStreakBonus, flaggedQuestions: Array.from(flaggedQuestions) });
          onExit();
        }}
        onSave={() => {
          onComplete({ ...finalResult, streakBonus: totalStreakBonus, flaggedQuestions: Array.from(flaggedQuestions) });
        }}
      />
    );
  }

  function submit() {
    if (selected == null || showResult) return;
    setAiExplanation(null);
    const correct = selected === current.answer;
    if (correct) {
      setScore((s) => s + 1);
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      if (STREAK_BONUS[newStreak]) {
        const bonus = STREAK_BONUS[newStreak];
        setStreakBonus(bonus);
        setTotalStreakBonus(prev => prev + bonus);
      }
    } else {
      setCurrentStreak(0);
      setStreakBonus(0);
    }
    setResults((r) => [
      ...r,
      {
        key: current.key,
        questionId: current.questionId || current.key,
        subjectId: current.subjectId,
        selected: selected ?? 0,
        correct,
        confidence,
      },
    ]);
    if (isExamLike) {
      if (idx === session.questions.length - 1) {
        setFinalResult({
          score: correct ? score + 1 : score,
          total: session.questions.length,
          results: [...results, { key: current.key, subjectId: current.subjectId, correct, confidence }],
          mode: session.mode,
          seconds: Math.round((Date.now() - startedAt) / 1000),
        });
      } else {
        setIdx((i) => i + 1);
        setSelected(null);
        setConfidence("unsure");
      }
      return;
    }
    setShowResult(true);
  }

  function next() {
    setAiExplanation(null);
    setStreakBonus(0);
    if (idx === session.questions.length - 1) {
      setFinalResult({
        score,
        total: session.questions.length,
        results,
        mode: session.mode,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      });
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setShowResult(false);
  }

  return (
    <div className="card" style={{
      background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))",
      border: "1px solid rgba(99, 102, 241, 0.2)",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      borderRadius: 20,
      overflow: "hidden"
    }}>
      {/* Animated Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))",
        padding: "20px 24px",
        borderBottom: "1px solid rgba(99, 102, 241, 0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)"
            }}>
              {session.source.icon}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, background: "linear-gradient(135deg, #fff, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{session.source.label}</h3>
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{session.mode === "exam" ? "Exam Mode" : session.mode === "weak" ? "Weak Drill" : session.mode === "adaptive" ? "Adaptive" : "Practice"}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {timeLeft != null && (
              <div style={{
                background: timeLeft < 60 ? "linear-gradient(135deg, #ef4444, #dc2626)" : "rgba(30, 41, 59, 0.8)",
                border: "1px solid " + (timeLeft < 60 ? "rgba(239, 68, 68, 0.5)" : "rgba(99, 102, 241, 0.3)"),
                padding: "8px 16px",
                borderRadius: 30,
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                animation: timeLeft < 60 ? "pulse 1s infinite" : "none"
              }}>
                ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}

            <div style={{
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              padding: "8px 16px",
              borderRadius: 30,
              fontSize: 13,
              fontWeight: 600,
              color: "#e0e7ff"
            }}>
              Q{idx + 1}<span style={{ color: "#6b7280" }}>/{session.questions.length}</span>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              padding: "8px 16px",
              borderRadius: 30,
              fontWeight: 700,
              fontSize: 14,
              color: "#fff",
              boxShadow: "0 4px 15px rgba(251, 191, 36, 0.4)",
              animation: "pulse 2s infinite"
            }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span>{currentXP}</span>
              <span style={{ fontSize: 11, opacity: 0.9 }}>XP</span>
            </div>

            {currentStreak >= 2 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: currentStreak >= 7 ? "linear-gradient(135deg, #f97316, #ea580c)"
                           : currentStreak >= 5 ? "linear-gradient(135deg, #ef4444, #dc2626)"
                           : "linear-gradient(135deg, #22c55e, #16a34a)",
                padding: "8px 16px",
                borderRadius: 30,
                fontWeight: 700,
                fontSize: 14,
                color: "#fff",
                boxShadow: `0 4px 15px ${currentStreak >= 7 ? "rgba(249, 115, 22, 0.4)" : currentStreak >= 5 ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}`,
                animation: "pulse 1s infinite"
              }}>
                <span style={{ fontSize: 16 }}>🔥</span>
                <span>{currentStreak}</span>
                {streakBonus > 0 && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: 10 }}>+{streakBonus}</span>}
              </div>
            )}

            <button
              type="button"
              onClick={onExit}
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                padding: "8px 16px",
                borderRadius: 10,
                color: "#f87171",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                zIndex: 10,
                position: "relative"
              }}
            >
              ✕ Exit
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ padding: "0 24px", marginTop: 20 }}>
        <div style={{
          height: 6,
          background: "rgba(30, 41, 59, 0.8)",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            height: "100%",
            width: `${((idx + 1) / session.questions.length) * 100}%`,
            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
            borderRadius: 10,
            transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)"
          }} />
        </div>
      </div>

      {isExamLike && (
        <div style={{ padding: "12px 24px 0" }}>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
            Running score: <span style={{ color: "#e0e7ff" }}>{score}/{Math.max(1, idx + (showResult ? 1 : 0))}</span>
            {perQuestionTarget && <span> · Pace: ~{perQuestionTarget}s/question</span>}
          </p>
        </div>
      )}

      {/* Question */}
      <div style={{ padding: "24px" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          border: "1px solid rgba(99, 102, 241, 0.15)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
          position: "relative"
        }}>
          <button
            onClick={toggleFlag}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: flaggedQuestions.has(idx) ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.1)",
              border: flaggedQuestions.has(idx) ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(99, 102, 241, 0.2)",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              color: flaggedQuestions.has(idx) ? "#f87171" : "#a5b4fc"
            }}
            title="Flag for review"
          >
            {flaggedQuestions.has(idx) ? "🚩" : "🏳️"}
          </button>

          <p style={{
            fontSize: 17,
            lineHeight: 1.7,
            color: "#f1f5f9",
            margin: 0,
            paddingRight: 50
          }}>
            {current.q}
          </p>
        </div>

        {/* Confidence & Read Aloud */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ color: "#9ca3af", fontSize: 13 }}>Confidence:</label>
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#e0e7ff",
                fontSize: 14
              }}
            >
              <option value="unsure">🤔 Unsure</option>
              <option value="okay">😊 Okay</option>
              <option value="sure">😎 Sure</option>
            </select>
          </div>
          <button
            onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(current.q))}
            style={{
              background: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              padding: "8px 16px",
              borderRadius: 8,
              color: "#a5b4fc",
              fontSize: 14,
              cursor: "pointer"
            }}
          >
            🔊 Read
          </button>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {current.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrectOption = showResult && i === current.answer;
            const isWrong = showResult && i === selected && i !== current.answer;

            let bgGradient = "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))";
            let borderColor = "rgba(99, 102, 241, 0.2)";
            let glowColor = "transparent";

            if (showResult) {
              if (isCorrectOption) {
                bgGradient = "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))";
                borderColor = "rgba(34, 197, 94, 0.5)";
                glowColor = "rgba(34, 197, 94, 0.3)";
              } else if (isWrong) {
                bgGradient = "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))";
                borderColor = "rgba(239, 68, 68, 0.5)";
                glowColor = "rgba(239, 68, 68, 0.3)";
              }
            } else if (isSelected) {
              bgGradient = "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1))";
              borderColor = "rgba(99, 102, 241, 0.5)";
              glowColor = "rgba(99, 102, 241, 0.3)";
            }

            return (
              <button
                key={opt}
                onClick={() => !showResult && setSelected(i)}
                disabled={showResult}
                style={{
                  padding: "16px 20px",
                  background: bgGradient,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 14,
                  color: "#f1f5f9",
                  textAlign: "left",
                  cursor: showResult ? "default" : "pointer",
                  fontSize: 15,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: `0 4px 15px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  transform: isSelected && !showResult ? "scale(1.02)" : "scale(1)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: isCorrectOption ? "linear-gradient(135deg, #22c55e, #16a34a)"
                                : isWrong ? "linear-gradient(135deg, #ef4444, #dc2626)"
                                : isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                                : "rgba(99, 102, 241, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 14,
                      color: isSelected || isCorrectOption ? "#fff" : "#a5b4fc"
                    }}>
                      {isCorrectOption ? "✓" : isWrong ? "✗" : String.fromCharCode(65 + i)}
                    </span>
                    <span>{opt}</span>
                  </div>
                  {isCorrectOption && (
                    <span style={{
                      background: "linear-gradient(135deg, #22c55e, #16a34a)",
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#fff"
                    }}>Correct</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation (shown after answer) */}
      {showResult && !isExamLike && (
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))",
            borderRadius: 16,
            padding: 20,
            border: "1px solid rgba(59, 130, 246, 0.2)"
          }}>
            <p style={{ color: "#93c5fd", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              💡 {current.explanation || "No explanation available."}
            </p>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={askAIForExplanation}
                disabled={aiLoading}
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 10,
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: aiLoading ? "wait" : "pointer",
                  boxShadow: "0 4px 15px rgba(59, 130, 246, 0.4)"
                }}
              >
                {aiLoading ? "🤖 Thinking..." : "🤖 Ask AI to explain"}
              </button>
              {aiExplanation && (
                <div style={{
                  marginTop: 12,
                  padding: 16,
                  background: "rgba(30, 41, 59, 0.6)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: 12,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#93c5fd"
                }}>
                  <strong style={{ color: "#60a5fa" }}>AI Explanation:</strong>
                  <p style={{ margin: "8px 0 0" }}>{aiExplanation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ padding: "0 24px 24px", display: "flex", gap: 12, justifyContent: "flex-end" }}>
        {!showResult || isExamLike ? (
          <button
            onClick={submit}
            disabled={selected == null}
            style={{
              background: selected == null ? "rgba(99, 102, 241, 0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white",
              border: "none",
              padding: "14px 28px",
              borderRadius: 12,
              cursor: selected == null ? "not-allowed" : "pointer",
              fontSize: 15,
              fontWeight: 600,
              boxShadow: selected == null ? "none" : "0 4px 20px rgba(99, 102, 241, 0.4)",
              transition: "all 0.2s"
            }}
          >
            {isExamLike && idx === session.questions.length - 1 ? "Submit Exam 📝" : "Submit →"}
          </button>
        ) : (
          <button
            onClick={next}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white",
              border: "none",
              padding: "14px 28px",
              borderRadius: 12,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 600,
              boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
              transition: "all 0.2s"
            }}
          >
            {idx === session.questions.length - 1 ? "Finish 🎉" : "Next Question →"}
          </button>
        )}
      </div>
    </div>
  );
}

export default SessionPlayer;
