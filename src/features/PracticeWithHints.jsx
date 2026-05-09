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

  const currentQuestion = questions && questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.answer;
  
  // Calculate XP in real-time
  const modeMultiplier = MODE_MULTIPLIERS["practicehints"] || 1.1;
  const currentXP = Math.round((score * XP_PER_CORRECT + totalStreakBonus) * modeMultiplier);

  console.log("Current question:", currentQuestion, "Hint level:", hintLevel);

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
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setHintLevel(0);
    } else {
      // Complete session
      const finalScore = {
        total: questions.length,
        correct: score,
        percentage: Math.round((score / questions.length) * 100),
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
      
      setCompleted(true);
      
      // Auto-save after brief delay
      setTimeout(() => {
        onComplete(finalScore);
      }, 500);
    }
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

  if (!currentQuestion) {
    return (
      <div className="card">
        <h3>Practice Mode with Hints</h3>
        <p className="muted">No questions available. Please select a subject from the main menu.</p>
      </div>
    );
  }

  const currentHints = generateHints(currentQuestion, hintLevel);
  console.log("Current hints to display:", currentHints, "Length:", currentHints.length, "Hint level:", hintLevel);

  return (
    <div className="card" style={{ 
      background: "var(--card-bg, #fff)", 
      color: "var(--text-primary, #111)"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: 16,
        flexWrap: "wrap",
        gap: 8
      }}>
        <h3 style={{ color: "var(--text-primary, #111)" }}>Practice Mode with Hints</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-secondary, #374151)" }}>
            Q{currentIndex + 1}/{questions.length}
          </span>
          <span style={{ color: "var(--text-secondary, #374151)" }}>
            Score: {score}/{currentIndex + (showResult ? 1 : 0)}
          </span>
          
          {/* XP Counter */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
            padding: "6px 14px",
            borderRadius: 20,
            fontWeight: 600,
            fontSize: 14,
            color: "#fff",
            boxShadow: "0 2px 8px rgba(251, 191, 36, 0.3)"
          }}>
            <span>⚡</span>
            <span>{currentXP} XP</span>
          </div>
          
          {/* Streak Counter */}
          {currentStreak >= 2 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: currentStreak >= 7 ? "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" 
                         : currentStreak >= 5 ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                         : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              padding: "6px 14px",
              borderRadius: 20,
              fontWeight: 600,
              fontSize: 14,
              color: "#fff",
              boxShadow: "0 2px 8px rgba(34, 197, 94, 0.3)"
            }}>
              <span>🔥</span>
              <span>{currentStreak} streak!</span>
              {streakBonus > 0 && <span style={{ fontSize: 11 }}>+{streakBonus}XP</span>}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ 
        height: 8, 
        background: "var(--progress-bg, #e5e7eb)", 
        borderRadius: 4, 
        marginBottom: 20,
        overflow: "hidden"
      }}>
        <div style={{
          height: "100%",
          width: `${((currentIndex + 1) / questions.length) * 100}%`,
          background: "var(--accent-color, #6366f1)",
          transition: "width 0.3s"
        }} />
      </div>

      {/* Question */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 16, color: "var(--text-primary, #111)" }}>
          {currentQuestion.q || currentQuestion.question}
        </p>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(currentQuestion.options || []).map((option, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = selectedAnswer === i;
            const isCorrectOption = i === currentQuestion.answer;
            
            let backgroundColor = "var(--option-bg, #f3f4f6)";
            let borderColor = "var(--border-color, #e5e7eb)";
            let textColor = "var(--text-primary, #111)";
            
            if (showResult) {
              if (isCorrectOption) {
                backgroundColor = "var(--correct-bg, #dcfce7)";
                borderColor = "var(--correct-border, #16a34a)";
                textColor = "var(--correct-text, #166534)";
              } else if (isSelected && !isCorrectOption) {
                backgroundColor = "var(--wrong-bg, #fee2e2)";
                borderColor = "var(--wrong-border, #dc2626)";
                textColor = "var(--wrong-text, #991b1b)";
              }
            } else if (isSelected) {
              backgroundColor = "var(--selected-bg, #e0e7ff)";
              borderColor = "var(--selected-border, #6366f1)";
              textColor = "var(--selected-text, #3730a3)";
            }

            return (
              <button
                key={i}
                onClick={() => !showResult && handleAnswer(i)}
                disabled={showResult}
                style={{
                  padding: 12,
                  background: backgroundColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 8,
                  color: textColor,
                  textAlign: "left",
                  cursor: showResult ? "default" : "pointer",
                  fontSize: 14,
                  transition: "all 0.2s"
                }}
              >
                <span style={{ fontWeight: 600, marginRight: 8 }}>{letter})</span>
                {option}
                {isSelected && (
                  <span style={{ marginLeft: 8, fontWeight: 700, color: showResult ? (isCorrectOption ? "#16a34a" : "#dc2626") : "#6366f1" }}>
                    ✓
                  </span>
                )}
                {showResult && isCorrectOption && !isSelected && (
                  <span style={{ float: "right", color: "#16a34a", fontWeight: 600 }}>✓ Correct</span>
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <span style={{ float: "right", color: "#dc2626", fontWeight: 600 }}>✗ Wrong</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hints Section */}
      <div style={{ 
        background: "var(--hint-bg, #eff6ff)", 
        borderRadius: 8, 
        padding: 16, 
        marginBottom: 16,
        border: "1px solid var(--hint-border, #3b82f6)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: "var(--hint-title, #1d4ed8)" }}>
            💡 Hints ({hintLevel}/4)
          </span>
          {hintLevel < 4 && (
            <button
              onClick={requestHint}
              style={{
                background: "var(--accent-color, #3b82f6)",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Get Hint
            </button>
          )}
        </div>
        
        {currentHints.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {currentHints.map((hint, i) => (
              <div key={i} style={{ 
                padding: 10, 
                background: "var(--hint-item-bg, rgba(59, 130, 246, 0.1))", 
                borderRadius: 6,
                fontSize: 14,
                color: "var(--hint-text, #1e40af)",
                borderLeft: "3px solid var(--accent-color, #3b82f6)"
              }}>
                {hint}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted, #6b7280)" }}>
            Click "Get Hint" to reveal progressive hints.
          </p>
        )}
      </div>

      {/* Explanation (shown after answer) */}
      {showResult && currentQuestion.explanation && (
        <div style={{ 
          background: "#000000", 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16,
          border: `2px solid ${isCorrect ? "#10b981" : "#ef4444"}`
        }}>
          <p style={{ fontWeight: 600, marginBottom: 4, color: isCorrect ? "#10b981" : "#ef4444" }}>
            {isCorrect ? "✅ Correct!" : "❌ Incorrect"}
          </p>
          <p style={{ fontSize: 13, color: "white", lineHeight: 1.5 }}>
            {currentQuestion.explanation}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        {!showResult && (
          <button
            onClick={skipQuestion}
            style={{
              background: "var(--skip-bg, #6b7280)",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            Skip
          </button>
        )}
        
        {showResult && (
          <button
            onClick={handleNext}
            style={{
              background: "var(--accent-color, #6366f1)",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            {currentIndex < questions.length - 1 ? "Next Question" : "Finish Practice"}
          </button>
        )}
      </div>
    </div>
  );
}
