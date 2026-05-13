import React, { useState, useRef, useEffect } from "react";

export function ChatMode({ tutor }) {
  const { messages, ask, loading, clearHistory } = tutor;
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    try {
      await ask(msg);
    } catch (err) {
      // error already in tutor.error
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 500 }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "rgba(15, 23, 42, 0.5)",
          borderRadius: 12,
          marginBottom: 12,
          minHeight: 400
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <p>Start a conversation with your AI tutor</p>
            <p style={{ fontSize: 12 }}>Ask anything about your subject — concepts, problems, exam prep.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: 12,
              background: m.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(30, 41, 59, 0.9)",
              color: m.role === "user" ? "#fff" : "#e5e7eb",
              whiteSpace: "pre-wrap",
              fontSize: 14,
              lineHeight: 1.6,
              border: m.role === "assistant" ? "1px solid rgba(99, 102, 241, 0.2)" : "none"
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "#9ca3af", fontStyle: "italic", padding: "8px 14px" }}>
            🤔 Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your tutor anything..."
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(99, 102, 241, 0.3)",
            background: "rgba(30, 41, 59, 0.8)",
            color: "#fff",
            fontSize: 14
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: loading ? "rgba(99, 102, 241, 0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer"
          }}
        >
          Send
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            title="Clear chat"
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "transparent",
              color: "#f87171",
              cursor: "pointer"
            }}
          >
            🗑️
          </button>
        )}
      </form>
    </div>
  );
}
