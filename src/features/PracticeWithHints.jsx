import { useState } from "react";

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

  const currentQuestion = questions && questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.answer;

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
    
    const result = {
      questionId: currentQuestion.id || currentIndex,
      correct: answerIndex === currentQuestion.answer,
      selected: answerIndex,
      hintsUsed: hintLevel
    };
    
    const newResults = [...results, result];
    setResults(newResults);
    
    if (answerIndex === currentQuestion.answer) {
      setScore(score + 1);
    }
  }

  function handleNext() {
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
        results: results
      };
      
      // Save hints usage
      const newHintsUsed = {
        ...hintsUsed,
        [subject?.id || "practice"]: (hintsUsed[subject?.id || "practice"] || 0) + results.reduce((sum, r) => sum + r.hintsUsed, 0)
      };
      saveHints(newHintsUsed);
      
      onComplete(finalScore);
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
    <div className="card">
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: 16 
      }}>
        <h3>Practice Mode with Hints</h3>
        <span className="muted">
          Question {currentIndex + 1} of {questions.length} | Score: {score}/{currentIndex}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ 
        height: 8, 
        background: "#374151", 
        borderRadius: 4, 
        marginBottom: 20,
        overflow: "hidden"
      }}>
        <div style={{
          height: "100%",
          width: `${((currentIndex + 1) / questions.length) * 100}%`,
          background: "#818cf8",
          transition: "width 0.3s"
        }} />
      </div>

      {/* Question */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 16 }}>
          {currentQuestion.q || currentQuestion.question}
        </p>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(currentQuestion.options || []).map((option, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = selectedAnswer === i;
            const isCorrectOption = i === currentQuestion.answer;
            
            let backgroundColor = "#1f2937";
            let borderColor = "#374151";
            
            if (showResult) {
              if (isCorrectOption) {
                backgroundColor = "#065f46";
                borderColor = "#10b981";
              } else if (isSelected && !isCorrectOption) {
                backgroundColor = "#7f1d1d";
                borderColor = "#ef4444";
              }
            } else if (isSelected) {
              backgroundColor = "#3730a3";
              borderColor = "#818cf8";
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
                  color: "white",
                  textAlign: "left",
                  cursor: showResult ? "default" : "pointer",
                  fontSize: 14,
                  transition: "all 0.2s"
                }}
              >
                <span style={{ fontWeight: 600, marginRight: 8 }}>{letter})</span>
                {option}
                {isSelected && (
                  <span style={{ marginLeft: 8, fontWeight: 700, color: showResult ? (isCorrectOption ? "#10b981" : "#ef4444") : "#93c5fd" }}>
                    ✓
                  </span>
                )}
                {showResult && isCorrectOption && !isSelected && (
                  <span style={{ float: "right", color: "#10b981" }}>✓ Correct</span>
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <span style={{ float: "right", color: "#ef4444" }}>✗ Wrong</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hints Section */}
      <div style={{ 
        background: "#1e3a5f", 
        borderRadius: 8, 
        padding: 16, 
        marginBottom: 16,
        border: "1px solid #3b82f6"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: "#93c5fd" }}>
            💡 Hints ({hintLevel}/4)
          </span>
          {hintLevel < 4 && (
            <button
              onClick={requestHint}
              style={{
                background: "#3b82f6",
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
                background: "rgba(59, 130, 246, 0.15)", 
                borderRadius: 6,
                fontSize: 14,
                color: "#bfdbfe",
                borderLeft: "3px solid #3b82f6"
              }}>
                {hint}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13, color: "#6b7280" }}>
            Click "Get Hint" to reveal progressive hints.
          </p>
        )}
      </div>

      {/* Explanation (shown after answer) */}
      {showResult && currentQuestion.explanation && (
        <div style={{ 
          background: isCorrect ? "#064e3b" : "#450a0a", 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16 
        }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>
            {isCorrect ? "✅ Correct!" : "❌ Incorrect"}
          </p>
          <p style={{ fontSize: 13, opacity: 0.9 }}>
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
              background: "#374151",
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
              background: "#818cf8",
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
