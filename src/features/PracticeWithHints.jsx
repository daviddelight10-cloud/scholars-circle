import { useState } from "react";
import { XP_PER_CORRECT, STREAK_BONUS, MODE_MULTIPLIERS } from "../data";

const HINTS_KEY = "sc_practice_hints_v1";

function loadHints() {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHints(hints) {
  localStorage.setItem(HINTS_KEY, JSON.stringify(hints));
}

export function PracticeWithHints({ questions, subject, onComplete }) {
  console.log("PracticeWithHints rendered with questions:", questions?.length, "subject:", subject);
  
  // Setup state
  const [isSetup, setIsSetup] = useState(true);
  const [questionCount, setQuestionCount] = useState(10);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(loadHints());
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [completed, setCompleted] = useState(false);
  
  // Streak tracking
  const [currentStreak, setCurrentStreak] = useState(0);
  const [streakBonus, setStreakBonus] = useState(0);
  const [totalStreakBonus, setTotalStreakBonus] = useState(0);

  const currentQuestion = practiceQuestions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.answer;
  
  // Calculate XP in real-time
  const modeMultiplier = MODE_MULTIPLIERS["practicehints"] || 1.1;
  const currentXP = Math.round((score * XP_PER_CORRECT + totalStreakBonus) * modeMultiplier);

  console.log("Current question:", currentQuestion, "Hint level:", hintLevel);
  
  // Start practice with selected number of questions
  function startPractice() {
    if (!questions || questions.length === 0) return;
    
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(questionCount, questions.length));
    setPracticeQuestions(selected);
    setIsSetup(false);
  }

  // Generate hints based on question type
  function generateHints(question, level) {
    if (!question) return [];
    
    console.log("Generating hints for question, level:", level);
    
    const hints = [];
    
    // Hint 1: General topic clue
    hints.push(`💡 Topic hint: This question relates to ${subject?.label || "this subject"}. Think about the core concepts.`);
    
    // Hint 2: Eliminate wrong options
    const options = question.options || [];
    const answer = question.answer !== undefined ? question.answer : 0;
    
    console.log("Question options:", options, "answer:", answer);
    
    if (options.length >= 2) {
      const wrongOptions = options
        .map((opt, i) => i !== answer ? { opt, i } : null)
        .filter(Boolean);
      
      if (wrongOptions.length >= 1) {
        const toEliminate = wrongOptions.slice(0, Math.min(2, wrongOptions.length));
        const letters = toEliminate.map(e => String.fromCharCode(65 + e.i)).join(" and ");
        hints.push(`🎯 Eliminate: Options ${letters} are likely incorrect.`);
      }
    }
    
    // Hint 3: Conceptual hint
    hints.push(`📚 Concept hint: Focus on the key principle being tested. The answer aligns with the fundamental definition.`);
    
    // Hint 4: Near answer (very strong hint)
    if (options.length >= 1) {
      const correctLetter = String.fromCharCode(65 + answer);
      hints.push(`🔥 Strong hint: The correct answer is option ${correctLetter}. Review this concept for future questions.`);
    }
    
    const result = hints.slice(0, level);
    console.log("Generated hints:", result);
    return result;
  }

  function handleAnswer(answerIndex) {
    if (!currentQuestion) return;
    
    setSelectedAnswer(answerIndex);
    setShowResult(true);
    
    const correct = answerIndex === currentQuestion.answer;
    
    const result = {
      questionId: currentQuestion.id || currentIndex,
      correct,
      selected: answerIndex,
      hintsUsed: hintLevel
    };
    
    const newResults = [...results, result];
    setResults(newResults);
    
    if (correct) {
      setScore(score + 1);
      
      // Update streak and calculate bonus
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      
      // Check for streak bonus milestones
      if (STREAK_BONUS[newStreak]) {
        const bonus = STREAK_BONUS[newStreak];
        setStreakBonus(bonus);
        setTotalStreakBonus(prev => prev + bonus);
      }
    } else {
      // Reset streak on wrong answer
      setCurrentStreak(0);
      setStreakBonus(0);
    }
  }

  function handleNext() {
    setStreakBonus(0); // Reset streak bonus display
    
    if (currentIndex < practiceQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setHintLevel(0);
    } else {
      // Complete session - show results, don't auto-save
      setCompleted(true);
    }
  }
  
  function handleSaveAndExit() {
    const finalScore = {
      total: practiceQuestions.length,
      correct: score,
      percentage: Math.round((score / practiceQuestions.length) * 100),
      results: results,
      mode: "practicehints",
      streakBonus: totalStreakBonus
    };
    
    // Save hints usage
    const newHintsUsed = {
      ...hintsUsed,
      [subject?.id || "practice"]: (hintsUsed[subject?.id || "practice"] || 0) + results.reduce((sum, r) => sum + r.hintsUsed, 0)
    };
    saveHints(newHintsUsed);
    
    onComplete(finalScore);
  }
  
  // Exit without saving (for setup screen)
  function handleExit() {
    onComplete(null);
  }

  function requestHint() {
    console.log("Requesting hint, current level:", hintLevel);
    if (hintLevel < 4) {
      setHintLevel(hintLevel + 1);
      console.log("Hint level incremented to:", hintLevel + 1);
    }
  }

  function skipQuestion() {
    const result = {
      questionId: currentQuestion.id || currentIndex,
      correct: false,
      selected: -1,
      hintsUsed: hintLevel,
      skipped: true
    };
    
    const newResults = [...results, result];
    setResults(newResults);
    handleNext();
  }

  // Setup Screen - select number of questions
  if (isSetup) {
    const maxQuestions = questions?.length || 0;
    
    return (
      <div className="card" style={{ 
        background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        borderRadius: 20,
        overflow: "hidden",
        maxWidth: 480,
        margin: "0 auto"
      }}>
        {/* Header */}
        <div style={{ 
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))",
          padding: "24px",
          borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
          textAlign: "center"
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            margin: "0 auto 16px",
            boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)"
          }}>
            💡
          </div>
          <h2 style={{ margin: 0, fontSize: 24, background: "linear-gradient(135deg, #fff, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Practice with Hints</h2>
          <p style={{ margin: "8px 0 0", color: "#9ca3af", fontSize: 14 }}>{subject?.label || "Subject"} · {maxQuestions} questions available</p>
        </div>
        
        {/* Settings */}
        <div style={{ padding: 24 }}>
          {maxQuestions === 0 ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ color: "#f87171", fontSize: 16 }}>⚠️ No questions available</p>
              <p style={{ color: "#9ca3af", fontSize: 14 }}>Please select a subject with questions.</p>
            </div>
          ) : (
            <>
              {/* Question Count Selector */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", color: "#e0e7ff", fontSize: 14, marginBottom: 12, fontWeight: 600 }}>
                  Number of Questions
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[5, 10, 15, 20, 30, 50].map(num => (
                    <button
                      key={num}
                      onClick={() => setQuestionCount(Math.min(num, maxQuestions))}
                      style={{
                        flex: "1 0 calc(33.333% - 16px)",
                        minWidth: 70,
                        padding: "12px 16px",
                        background: questionCount === Math.min(num, maxQuestions) 
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)" 
                          : "rgba(30, 41, 59, 0.8)",
                        border: questionCount === Math.min(num, maxQuestions)
                          ? "2px solid rgba(99, 102, 241, 0.5)"
                          : "1px solid rgba(99, 102, 241, 0.2)",
                        borderRadius: 12,
                        color: questionCount === Math.min(num, maxQuestions) ? "#fff" : "#a5b4fc",
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      {Math.min(num, maxQuestions)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Features Preview */}
              <div style={{ 
                background: "rgba(30, 41, 59, 0.6)", 
                borderRadius: 12, 
                padding: 16, 
                marginBottom: 24,
                border: "1px solid rgba(99, 102, 241, 0.15)"
              }}>
                <p style={{ color: "#9ca3af", fontSize: 13, margin: 0, lineHeight: 1.8 }}>
                  ✨ Features available:
                </p>
                <ul style={{ color: "#93c5fd", fontSize: 13, margin: "8px 0 0", paddingLeft: 20 }}>
                  <li>Progressive hints (up to 4 per question)</li>
                  <li>Instant feedback with explanations</li>
                  <li>XP & streak bonuses</li>
                  <li>Flag questions for review</li>
                </ul>
              </div>
              
              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={handleExit}
                  style={{
                    flex: 1,
                    background: "rgba(107, 114, 128, 0.2)",
                    border: "1px solid rgba(107, 114, 128, 0.3)",
                    padding: "14px 20px",
                    borderRadius: 12,
                    color: "#9ca3af",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  ✕ Cancel
                </button>
                <button
                  onClick={startPractice}
                  style={{
                    flex: 2,
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    padding: "14px 20px",
                    borderRadius: 12,
                    color: "white",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)"
                  }}
                >
                  🚀 Start Practice
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  
  if (!currentQuestion) {
    return (
      <div className="card" style={{ 
        background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: 20,
        padding: 24,
        textAlign: "center"
      }}>
        <h3 style={{ color: "#f1f5f9" }}>Practice Mode with Hints</h3>
        <p style={{ color: "#9ca3af" }}>No questions available. Please select a subject from the main menu.</p>
      </div>
    );
  }
  
  // Completion screen with review
  if (completed) {
    const pct = Math.round((score / practiceQuestions.length) * 100);
    const emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📖";
    const baseXP = score * XP_PER_CORRECT;
    const finalXP = Math.round((baseXP + totalStreakBonus) * modeMultiplier);
    
    return (
      <div className="card" style={{ 
        textAlign: "center",
        background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        borderRadius: 20
      }}>
        {/* Hero Section */}
        <div style={{ 
          background: pct >= 80 
            ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))"
            : "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))",
          padding: "32px 24px",
          borderRadius: "20px 20px 0 0",
          borderBottom: "1px solid rgba(99, 102, 241, 0.2)"
        }}>
          <div style={{ fontSize: 64, marginBottom: 16, animation: "bounce 1s" }}>{emoji}</div>
          <h2 style={{ margin: 0, fontSize: 28, background: "linear-gradient(135deg, #fff, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Practice Complete!</h2>
          <div style={{ 
            fontSize: "4rem", 
            fontWeight: 800, 
            margin: "16px 0",
            background: pct >= 80 ? "linear-gradient(135deg, #4ade80, #22c55e)" : "linear-gradient(135deg, #60a5fa, #3b82f6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            {pct}%
          </div>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>{score} / {practiceQuestions.length} correct · {subject?.label || "Practice"}</p>
        </div>
        
        {/* XP Breakdown */}
        <div style={{ padding: 24 }}>
          <div style={{ 
            background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.1))", 
            borderRadius: 16, 
            padding: 20, 
            marginBottom: 20,
            border: "1px solid rgba(251,191,36,0.3)",
            boxShadow: "0 4px 20px rgba(251, 191, 36, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>⚡</span>
              <span style={{ fontSize: 36, fontWeight: 800, color: "#fbbf24" }}>+{finalXP}</span>
              <span style={{ fontSize: 18, color: "#fbbf24", opacity: 0.8 }}>XP</span>
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>Base XP</span>
                <span style={{ color: "#e0e7ff" }}>{baseXP} ({score} × {XP_PER_CORRECT})</span>
              </div>
              {totalStreakBonus > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#fbbf24" }}>
                  <span>🔥 Streak Bonus</span>
                  <span>+{totalStreakBonus} XP</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#60a5fa" }}>
                <span>🎯 Mode Bonus</span>
                <span>+{Math.round(baseXP * (modeMultiplier - 1))} XP</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleSaveAndExit}
            style={{ 
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              border: "none",
              padding: "16px 32px",
              borderRadius: 12,
              color: "white",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(34, 197, 94, 0.4)",
              width: "100%"
            }}
          >
            ✓ Save & Exit
          </button>
        </div>
        
        {/* Review all answers */}
        <div style={{ textAlign: "left", padding: "0 24px 24px", maxHeight: 400, overflowY: "auto" }}>
          <h3 style={{ textAlign: "center", marginBottom: 16, color: "#e0e7ff" }}>📝 Review All Answers</h3>
          {results.map((r, i) => {
            const q = practiceQuestions[i];
            if (!q) return null;
            const isCorrect = r.correct;
            
            return (
              <div key={i} style={{ 
                borderLeft: `3px solid ${isCorrect ? "#22c55e" : "#ef4444"}`,
                marginBottom: 12,
                background: isCorrect ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.05))" : "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))",
                borderRadius: 12,
                padding: 16
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <p style={{ margin: 0, fontWeight: 600, flex: 1, color: "#f1f5f9" }}>Q{i + 1}: {q.q || q.question}</p>
                  <span style={{ fontSize: 20 }}>{isCorrect ? "✅" : "❌"}</span>
                </div>
                
                {!isCorrect && (
                  <>
                    <p style={{ margin: "4px 0", color: "#f87171", fontSize: 14 }}>
                      Your answer: <strong>{r.selected >= 0 ? q.options?.[r.selected] : "Skipped"}</strong>
                    </p>
                    <p style={{ margin: "4px 0", color: "#4ade80", fontSize: 14 }}>
                      Correct: <strong>{q.options?.[q.answer]}</strong>
                    </p>
                  </>
                )}
                
                {isCorrect && (
                  <p style={{ margin: "4px 0", color: "#4ade80", fontSize: 14 }}>
                    ✓ <strong>{q.options?.[q.answer]}</strong>
                  </p>
                )}
                
                {q.explanation && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#94a3b8" }}>
                    💡 {q.explanation}
                  </p>
                )}
                
                {r.hintsUsed > 0 && (
                  <p style={{ margin: "4px 0", fontSize: 12, color: "#fbbf24" }}>
                    💡 Used {r.hintsUsed} hint{r.hintsUsed > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const currentHints = generateHints(currentQuestion, hintLevel);
  console.log("Current hints to display:", currentHints, "Length:", currentHints.length, "Hint level:", hintLevel);

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
        padding: "12px 16px",
        borderBottom: "1px solid rgba(99, 102, 241, 0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 2px 10px rgba(99, 102, 241, 0.4)"
            }}>
              💡
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, background: "linear-gradient(135deg, #fff, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Practice with Hints</h3>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{subject?.label || "Subject"}</p>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {/* Question Counter */}
            <div style={{
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: "#e0e7ff"
            }}>
              Q{currentIndex + 1}<span style={{ color: "#6b7280" }}>/{practiceQuestions.length}</span>
            </div>
            
            {/* XP Counter */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              padding: "4px 10px",
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 12,
              color: "#fff",
              boxShadow: "0 2px 10px rgba(251, 191, 36, 0.4)"
            }}>
              <span style={{ fontSize: 12 }}>⚡</span>
              <span>{currentXP}</span>
            </div>
            
            {/* Streak Counter */}
            {currentStreak >= 2 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: currentStreak >= 7 ? "linear-gradient(135deg, #f97316, #ea580c)" 
                           : currentStreak >= 5 ? "linear-gradient(135deg, #ef4444, #dc2626)"
                           : "linear-gradient(135deg, #22c55e, #16a34a)",
                padding: "4px 10px",
                borderRadius: 20,
                fontWeight: 700,
                fontSize: 12,
                color: "#fff",
                boxShadow: `0 2px 10px ${currentStreak >= 7 ? "rgba(249, 115, 22, 0.4)" : currentStreak >= 5 ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}`,
                animation: "pulse 1s infinite"
              }}>
                <span style={{ fontSize: 12 }}>🔥</span>
                <span>{currentStreak}</span>
                {streakBonus > 0 && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.2)", padding: "1px 4px", borderRadius: 8 }}>+{streakBonus}</span>}
              </div>
            )}
            
            {/* Exit Button */}
            <button
              onClick={handleExit}
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                padding: "4px 10px",
                borderRadius: 8,
                color: "#f87171",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ padding: "0 16px", marginTop: 12 }}>
        <div style={{ 
          height: 4, 
          background: "rgba(30, 41, 59, 0.8)", 
          borderRadius: 10, 
          overflow: "hidden",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            height: "100%",
            width: `${((currentIndex + 1) / practiceQuestions.length) * 100}%`,
            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
            borderRadius: 10,
            transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 0 10px rgba(99, 102, 241, 0.5)"
          }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ padding: "16px" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))",
          borderRadius: 12,
          padding: "14px",
          marginBottom: 16,
          border: "1px solid rgba(99, 102, 241, 0.15)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)"
        }}>
          <p style={{ 
            fontSize: 15, 
            lineHeight: 1.6, 
            color: "#f1f5f9",
            margin: 0
          }}>
            {currentQuestion.q || currentQuestion.question}
          </p>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(currentQuestion.options || []).map((option, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = selectedAnswer === i;
            const isCorrectOption = i === currentQuestion.answer;
            
            let bgGradient = "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))";
            let borderColor = "rgba(99, 102, 241, 0.2)";
            let glowColor = "transparent";
            
            if (showResult) {
              if (isCorrectOption) {
                bgGradient = "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))";
                borderColor = "rgba(34, 197, 94, 0.5)";
                glowColor = "rgba(34, 197, 94, 0.3)";
              } else if (isSelected && !isCorrectOption) {
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
                key={i}
                onClick={() => !showResult && handleAnswer(i)}
                disabled={showResult}
                style={{
                  padding: "14px 16px",
                  background: bgGradient,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 12,
                  color: "#f1f5f9",
                  textAlign: "left",
                  cursor: showResult ? "default" : "pointer",
                  fontSize: 14,
                  transition: "all 0.2s ease",
                  boxShadow: `0 2px 10px ${glowColor}`,
                  transform: isSelected && !showResult ? "scale(1.01)" : "scale(1)",
                  WebkitTapHighlightColor: "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ 
                      width: 28, 
                      height: 28, 
                      minWidth: 28,
                      borderRadius: 8,
                      background: showResult && isCorrectOption ? "linear-gradient(135deg, #22c55e, #16a34a)" 
                                : showResult && isSelected && !isCorrectOption ? "linear-gradient(135deg, #ef4444, #dc2626)"
                                : isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" 
                                : "rgba(99, 102, 241, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 13,
                      color: isSelected || (showResult && isCorrectOption) ? "#fff" : "#a5b4fc"
                    }}>
                      {showResult && isCorrectOption ? "✓" : showResult && isSelected && !isCorrectOption ? "✗" : letter}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{option}</span>
                  </div>
                  {showResult && isCorrectOption && (
                    <span style={{ 
                      background: "linear-gradient(135deg, #22c55e, #16a34a)", 
                      padding: "3px 8px", 
                      borderRadius: 12, 
                      fontSize: 11, 
                      fontWeight: 600,
                      color: "#fff",
                      whiteSpace: "nowrap"
                    }}>✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hints Section */}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ 
          background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))",
          borderRadius: 12, 
          padding: 12,
          border: "1px solid rgba(59, 130, 246, 0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <span style={{ fontWeight: 600, color: "#60a5fa", fontSize: 13 }}>Hints</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {[1, 2, 3, 4].map((level) => (
                <div key={level} style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: level <= hintLevel ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "rgba(59, 130, 246, 0.2)",
                  boxShadow: level <= hintLevel ? "0 0 8px rgba(59, 130, 246, 0.5)" : "none",
                  transition: "all 0.3s"
                }} />
              ))}
              {hintLevel < 4 && !showResult && (
                <button
                  onClick={requestHint}
                  style={{
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                    color: "white",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    marginLeft: 4,
                    boxShadow: "0 2px 10px rgba(59, 130, 246, 0.4)"
                  }}
                >
                  +Hint
                </button>
              )}
            </div>
          </div>
          
          {currentHints.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {currentHints.map((hint, i) => (
                <div key={i} style={{ 
                  padding: 10, 
                  background: "rgba(30, 41, 59, 0.6)", 
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#93c5fd",
                  borderLeft: "2px solid #3b82f6",
                  animation: `fadeIn 0.3s ease-out ${i * 0.1}s both`
                }}>
                  {hint}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
              Tap "+Hint" for progressive hints
            </p>
          )}
        </div>
      </div>

      {/* Explanation (shown after answer) */}
      {showResult && currentQuestion.explanation && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ 
            background: isCorrect 
              ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.05))" 
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.05))",
            borderRadius: 12, 
            padding: 12,
            border: `2px solid ${isCorrect ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{isCorrect ? "✅" : "❌"}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: isCorrect ? "#4ade80" : "#f87171" }}>
                {isCorrect ? "Correct!" : "Incorrect"}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, margin: 0 }}>
              {currentQuestion.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ padding: "0 16px 16px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {!showResult && (
          <button
            onClick={skipQuestion}
            style={{
              background: "rgba(107, 114, 128, 0.2)",
              color: "#9ca3af",
              border: "1px solid rgba(107, 114, 128, 0.3)",
              padding: "10px 16px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600
            }}
          >
            Skip
          </button>
        )}
        
        {showResult && (
          <button
            onClick={handleNext}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 2px 15px rgba(99, 102, 241, 0.4)"
            }}
          >
            {currentIndex < practiceQuestions.length - 1 ? "Next →" : "Finish 🎉"}
          </button>
        )}
      </div>
    </div>
  );
}
