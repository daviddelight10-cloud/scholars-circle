import { useState } from "react";
import { Flag, CheckCircle2, XCircle, Sparkles, Send } from "lucide-react";
import MarkdownText from "../components/MarkdownText.jsx";
import { callAI } from "../lib/aiClient.js";

export default function QuestionCard({
  question,
  questionNumber,
  total,
  selectedAnswer,
  isLocked,
  isFlagged,
  isMobile,
  onSelectAnswer,
  onToggleFlag,
  showExplanation = true,
  enableAIExplain = true,
}) {
  const [aiData, setAiData] = useState(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [aiFollowUpLoading, setAiFollowUpLoading] = useState(false);

  const handleAIExplain = async () => {
    setAiData({ loading: true });
    try {
      const prompt = `You are a tutor. Explain this MCQ clearly:\n\nQuestion: ${question.question}\nOptions: ${JSON.stringify(question.options)}\nCorrect answer: ${question.correct}\n\nProvide a concise explanation of why the correct answer is right.`;
      const res = await callAI(prompt);
      setAiData({ explanation: res?.text || res || "No explanation available.", followUps: [] });
    } catch {
      setAiData({ explanation: "Could not get AI explanation. Please try again.", followUps: [] });
    }
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim()) return;
    setAiFollowUpLoading(true);
    try {
      const prompt = `Follow-up question about this MCQ:\n\nQ: ${question.question}\nCorrect: ${question.correct} - ${question.options[question.correct]}\n\nStudent asks: ${followUpInput}`;
      const res = await callAI(prompt);
      setAiData((prev) => ({
        ...prev,
        followUps: [...(prev?.followUps || []), { question: followUpInput, answer: res?.text || res || "No response." }],
      }));
      setFollowUpInput("");
    } catch {
      setAiData((prev) => ({
        ...prev,
        followUps: [...(prev?.followUps || []), { question: followUpInput, answer: "Could not get a response." }],
      }));
    } finally {
      setAiFollowUpLoading(false);
    }
  };

  if (!question) return null;

  return (
    <div style={{
      background: "#0d0f20",
      border: "0.5px solid #1e2245",
      borderRadius: isMobile ? "10px" : "12px",
      padding: isMobile ? "14px" : "20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ fontSize: isMobile ? "14px" : "16px", fontWeight: 600, color: "#e8eaf6", lineHeight: 1.5, flex: 1 }}>
          {question.question}
        </div>
        {onToggleFlag && (
          <button onClick={onToggleFlag} style={{
            background: "none", border: "none", cursor: "pointer", padding: "4px",
            color: isFlagged ? "#ff7043" : "#3a3d60", flexShrink: 0,
          }} title="Flag for review">
            <Flag size={isMobile ? 16 : 18} fill={isFlagged ? "#ff7043" : "none"} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "6px" : "8px" }}>
        {Object.entries(question.options).map(([key, value]) => {
          const isSelected = selectedAnswer === key;
          const isCorrectOption = key === question.correct;
          const showCorrect = isLocked && isCorrectOption;
          const showWrong = isLocked && isSelected && !isCorrectOption;

          return (
            <div
              key={key}
              onClick={() => !isLocked && onSelectAnswer?.(key)}
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

      {showExplanation && isLocked && question.explanation && (
        <div style={{
          marginTop: isMobile ? "12px" : "16px", padding: isMobile ? "10px 12px" : "14px",
          background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px",
          fontSize: isMobile ? "12px" : "13px", color: "#DAA520", lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 700, color: "#7986cb" }}>Explanation: </span>
          {question.explanation}
        </div>
      )}

      {enableAIExplain && isLocked && (
        <div style={{ marginTop: "12px" }}>
          {!aiData && (
            <button onClick={handleAIExplain} style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: isMobile ? "8px 14px" : "8px 16px",
              background: "rgba(218,165,32,0.12)", border: "0.5px solid rgba(218,165,32,0.3)",
              borderRadius: "8px", fontSize: isMobile ? "12px" : "13px", fontWeight: 700,
              color: "#DAA520", cursor: "pointer",
            }}>
              <Sparkles size={isMobile ? 13 : 15} /> AI Explain
            </button>
          )}

          {aiData?.loading && (
            <div style={{
              marginTop: "8px", padding: "10px 14px",
              background: "rgba(218,165,32,0.08)", border: "0.5px solid rgba(218,165,32,0.2)",
              borderRadius: "8px", fontSize: "12px", color: "#DAA520",
            }}>
              Getting AI explanation...
            </div>
          )}

          {aiData?.explanation && !aiData?.loading && (
            <div style={{
              marginTop: "8px", padding: isMobile ? "10px 12px" : "12px 14px",
              background: "rgba(218,165,32,0.08)", border: "0.5px solid rgba(218,165,32,0.2)",
              borderRadius: "10px",
            }}>
              <div style={{
                fontSize: "11px", fontWeight: 700, color: "#DAA520",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                <Sparkles size={12} /> AI Explanation
              </div>
              <div style={{ fontSize: isMobile ? "12px" : "13px", color: "#c5c9e8", lineHeight: 1.7 }}>
                <MarkdownText>{aiData.explanation}</MarkdownText>
              </div>

              {aiData.followUps?.map((fu, fi) => (
                <div key={fi} style={{ marginTop: "10px" }}>
                  <div style={{ fontSize: "12px", color: "#7986cb", fontWeight: 600, marginBottom: "3px" }}>
                    Q: {fu.question}
                  </div>
                  <div style={{
                    fontSize: "12px", color: "#c5c9e8", lineHeight: 1.6,
                    padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px",
                  }}>
                    {fu.answer}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                <input
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !aiFollowUpLoading) handleFollowUp(); }}
                  placeholder="Ask a follow-up question..."
                  disabled={aiFollowUpLoading}
                  style={{
                    flex: 1, padding: isMobile ? "8px 10px" : "8px 12px",
                    background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px",
                    color: "#c5c9e8", fontSize: "12px", outline: "none",
                  }}
                />
                <button
                  onClick={handleFollowUp}
                  disabled={aiFollowUpLoading || !followUpInput.trim()}
                  style={{
                    padding: isMobile ? "8px 10px" : "8px 12px",
                    background: aiFollowUpLoading || !followUpInput.trim() ? "#0f1128" : "rgba(218,165,32,0.15)",
                    border: "0.5px solid rgba(218,165,32,0.3)", borderRadius: "8px",
                    color: "#DAA520", cursor: aiFollowUpLoading || !followUpInput.trim() ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: aiFollowUpLoading || !followUpInput.trim() ? 0.5 : 1,
                  }}
                >
                  <Send size={isMobile ? 13 : 15} />
                </button>
              </div>
              {aiFollowUpLoading && (
                <div style={{ fontSize: "11px", color: "#5a6090", marginTop: "4px" }}>Thinking...</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
