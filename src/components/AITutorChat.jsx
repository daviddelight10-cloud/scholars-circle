import React, { useState, useEffect, useRef } from "react";
import { callAI } from "../lib/aiClient";
import { api } from "../lib/appUtils";
import { DEMO_LIMITS } from "../lib/constants";

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
      const context = selectedSubject
        ? `You are a helpful tutor for ${selectedSubject}. The user is studying this subject. Keep answers concise and educational. After explaining, always ask if the user wants you to: break the concept down more, or explain it like they're 6 years old.`
        : "You are a friendly, knowledgeable academic chat assistant for university students. Be conversational and helpful. Focus on academics but can also help with study tips, planning, and motivation. Keep answers clear and concise.";

      let systemPrompt = context + "\n\nSubjects available: " + subjects.map(s => s.label).join(", ");
      let responseText = "";

      try {
        responseText = await callAI(`${systemPrompt}\n\nUser: ${userMsg}`, aiConfig);
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
                { role: "system", content: systemPrompt },
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

      setChatHistory([...newHistory, { role: "assistant", content: finalResponse, timestamp: Date.now() }]);

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
      <div className="ai-chat-container" ref={chatContainerRef} style={{ maxHeight: "400px", overflowY: "auto" }}>
        {chatHistory.map((msg, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 20 }}>{msg.role === "user" ? "👤" : "🤖"}</span>
              <div className={msg.role === "user" ? "ai-chat-msg-user" : "ai-chat-msg-assistant"} style={{ flex: 1 }}>
                {msg.content.includes("[FollowUpButtons]") ? (
                  <>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content.replace("[FollowUpButtons]", "")}</p>
                    <div style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      flexWrap: "wrap"
                    }}>
                      <button
                        onClick={() => {
                          const lastUserMsg = chatHistory.slice(0, i).reverse().find(m => m.role === "user");
                          const originalQ = lastUserMsg?.content || "the previous topic";
                          sendMessage(`Break down ${originalQ} in more detail for me`);
                        }}
                        disabled={loading}
                        style={{
                          background: "#1e3a5f",
                          border: "1px solid #3b82f6",
                          color: "#60a5fa",
                          padding: "8px 16px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500
                        }}
                      >
                        🔍 Break it down more
                      </button>
                      <button
                        onClick={() => {
                          const lastUserMsg = chatHistory.slice(0, i).reverse().find(m => m.role === "user");
                          const originalQ = lastUserMsg?.content || "the previous topic";
                          sendMessage(`Explain ${originalQ} like I'm 6 years old to me`);
                        }}
                        disabled={loading}
                        style={{
                          background: "#1e3a5f",
                          border: "1px solid #3b82f6",
                          color: "#60a5fa",
                          padding: "8px 16px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500
                        }}
                      >
                        👶 Explain like I'm 6
                      </button>
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
        <button onClick={() => sendMessage()} disabled={loading || !message.trim()} style={{ borderColor: "#818cf8", color: "#818cf8" }}>
          Send
        </button>
      </div>
    </div>
  );
}
