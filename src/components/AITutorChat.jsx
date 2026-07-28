import React, { useState, useEffect, useRef } from "react";
import { callAI } from "../lib/aiClient";
import { api } from "../lib/appUtils";
import { DEMO_LIMITS } from "../lib/constants";
import { buildSystemPrompt, buildConversationContext } from "../features/AITutor/prompts.js";
import { detectDiscipline } from "../features/AITutor/disciplines.js";

export function AITutorChat({ aiConfig, chatHistory, setChatHistory, subjects, token, demoMode, demoUsage, setDemoUsage }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const prevHistoryLengthRef = useRef(0);

  const scrollToBottom = () => {
    const c = chatContainerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  };

  useEffect(() => {
    if (chatHistory.length > prevHistoryLengthRef.current) {
      scrollToBottom();
    }
    prevHistoryLengthRef.current = chatHistory.length;
  }, [chatHistory]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      const welcomeMsg = {
        role: "assistant",
        content: "👋 Hey! I'm your Scholar's Circle AI assistant. I can help with any subject — homework, concepts, study tips, exam prep, or just chat about academic life. What's on your mind?",
        timestamp: Date.now()
      };
      setChatHistory([welcomeMsg]);
    }
  }, []);

  async function sendMessage(overrideMessage = null) {
    const msgToSend = overrideMessage || message;
    if (!msgToSend.trim() || loading) return;

    if (demoMode && (demoUsage.aiTutorMessages || 0) >= DEMO_LIMITS.aiTutorMessages) {
      setChatHistory([...chatHistory, { role: "assistant", content: `Demo limit reached: You've used ${DEMO_LIMITS.aiTutorMessages} AI tutor messages. Register for full access.`, timestamp: Date.now() }]);
      return;
    }

    const userMsg = msgToSend.trim();
    if (!overrideMessage) {
      setMessage("");
    }
    setLoading(true);

    const newHistory = [...chatHistory, { role: "user", content: userMsg, timestamp: Date.now() }];
    setChatHistory(newHistory);

    if (demoMode) {
      setDemoUsage(prev => ({ ...prev, aiTutorMessages: (prev.aiTutorMessages || 0) + 1 }));
    }

    try {
      const subject = selectedSubject ? { id: selectedSubject, label: selectedSubject } : null;
      const disciplineId = detectDiscipline(selectedSubject);
      const systemPrompt = buildSystemPrompt({ mode: "chat", disciplineId, subject });
      const convoHistory = newHistory.filter(m => m.role === "user" || m.role === "assistant").slice(-8);
      const convoCtx = buildConversationContext(convoHistory, 8);
      let responseText = "";

      try {
        responseText = await callAI(`${systemPrompt}${convoCtx}\n\nSTUDENT: ${userMsg}\n\nTUTOR:`, aiConfig);
      } catch (proxyError) {
        console.log("Backend proxy failed, trying direct call:", proxyError);

        if (aiConfig.provider === "gemini") {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${userMsg}` }] }],
              generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error?.message || "API request failed");
          }
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
        } else {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify({
              model: aiConfig.model,
              messages: [
                { role: "system", content: systemPrompt + convoCtx },
                { role: "user", content: userMsg }
              ],
              max_tokens: 500,
              temperature: 0.7,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error?.message || "API request failed");
          }
          responseText = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
        }
      }

      let finalResponse = responseText;
      const isError = responseText.toLowerCase().startsWith("error:") || responseText.toLowerCase().includes("demo limit");
      if (!isError) {
        finalResponse = responseText + "\n\n[FollowUpButtons]";
      }

      const aiMsg = { role: "assistant", content: finalResponse, timestamp: Date.now() };
      setChatHistory([...newHistory, aiMsg]);

      if (token) {
        api("/user-data/chat", { token, method: "POST", body: { role: "assistant", content: finalResponse } }).catch(console.error);
      }
    } catch (e) {
      console.error("AI Tutor error:", e);
      setChatHistory([...newHistory, { role: "assistant", content: "Error: " + e.message, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    const welcomeMsg = {
      role: "assistant",
      content: "👋 Hey! I'm your Scholar's Circle AI assistant. I can help with any subject — homework, concepts, study tips, exam prep, or just chat about academic life. What's on your mind?",
      timestamp: Date.now()
    };
    setChatHistory([welcomeMsg]);
    if (token) {
      api("/user-data/chat", { token, method: "DELETE" }).catch(console.error);
    }
  }

  function copyMessage(content, i) {
    const text = content.replace("[FollowUpButtons]", "").trim();
    navigator.clipboard.writeText(text);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  const [copiedIdx, setCopiedIdx] = useState(null);
  const userMsgCount = chatHistory.filter(m => m.role === "user").length;
  const quickActions = [
    { icon: "🔍", label: "Explain simpler", getPrompt: (q) => `Explain ${q} in simpler terms, as if for a beginner` },
    { icon: "📝", label: "Test me", getPrompt: (q) => `Generate 3 multiple-choice questions about ${q} to test my understanding` },
    { icon: "🃏", label: "Flashcards", getPrompt: (q) => `Generate 5 flashcards about ${q}` },
    { icon: "📖", label: "Example", getPrompt: (q) => `Give me a concrete real-world example of ${q}` },
  ];

  return (
    <div className="card">
      <div className="row">
        <h2>Scholar's Circle AI</h2>
        <button onClick={clearHistory} style={{ fontSize: 12 }}>Clear Chat</button>
      </div>
      <div className="row">
        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
          <option value="">General (All Subjects)</option>
          {subjects.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
        </select>
      </div>
      {userMsgCount >= 2 && (
        <div style={{ textAlign: "center", fontSize: 11, color: "#646E84", padding: "4px 0" }}>
          🧠 AI remembers this conversation
        </div>
      )}
      <div className="ai-chat-container" ref={chatContainerRef} style={{ maxHeight: "400px", overflowY: "auto" }}>
        {chatHistory.map((msg, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 20 }}>{msg.role === "user" ? "👤" : "🤖"}</span>
              <div className={msg.role === "user" ? "ai-chat-msg-user" : "ai-chat-msg-assistant"} style={{ flex: 1 }}>
                {msg.content.includes("[FollowUpButtons]") ? (
                  <>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content.replace("[FollowUpButtons]", "")}</p>
                    {/* Quick action chips */}
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      {quickActions.map((qa) => {
                        const lastUserMsg = chatHistory.slice(0, i).reverse().find(m => m.role === "user");
                        const originalQ = lastUserMsg?.content || "the previous topic";
                        return (
                          <button
                            key={qa.label}
                            onClick={() => sendMessage(qa.getPrompt(originalQ))}
                            disabled={loading}
                            style={{
                              background: "#1a1a2e", border: "1px solid rgba(255,215,0,0.2)",
                              color: "#7b82b8", padding: "5px 11px", borderRadius: 14,
                              cursor: "pointer", fontSize: 11, fontWeight: 600,
                            }}
                          >{qa.icon} {qa.label}</button>
                        );
                      })}
                      <button
                        onClick={() => copyMessage(msg.content, i)}
                        title="Copy answer"
                        style={{
                          background: "#1a1a2e", border: "1px solid rgba(255,215,0,0.2)",
                          color: copiedIdx === i ? "#4caf50" : "#7b82b8", padding: "5px 11px", borderRadius: 14,
                          cursor: "pointer", fontSize: 11, fontWeight: 600,
                        }}
                      >{copiedIdx === i ? "✓ Copied" : "⧉ Copy"}</button>
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                )}
                <span className="muted" style={{ fontSize: 11 }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <span className="muted">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="ai-chat-input"
          style={{ flex: 1 }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask me anything about your studies..."
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={() => sendMessage()} disabled={loading || !message.trim()} style={{ borderColor: "#FFD700", color: "#FFD700" }}>
          Send
        </button>
      </div>
    </div>
  );
}
