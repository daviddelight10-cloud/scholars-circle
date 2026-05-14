import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── Voice helpers ─────────────────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

function speak(text, onEnd) {
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  // Pick a clear English voice if available
  const voices = synth.getVoices();
  const preferred = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"))
    || voices.find(v => v.lang.startsWith("en") && !v.localService)
    || voices.find(v => v.lang.startsWith("en"));
  if (preferred) utterance.voice = preferred;
  if (onEnd) utterance.onend = onEnd;
  synth.speak(utterance);
}

export function ChatMode({ tutor }) {
  const { messages, ask, loading, clearHistory } = tutor;
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem("sc_tutor_autospeak") === "1"; } catch { return false; }
  });
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto-speak latest AI response
  useEffect(() => {
    if (!autoSpeak || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === "assistant" && !loading) {
      handleSpeak(messages.length - 1, last.content);
    }
  }, [messages.length, loading, autoSpeak]);

  // ─── TTS ──────────────────────────────────────────────────────────────────
  function handleSpeak(idx, text) {
    if (speakingIdx === idx) {
      // Stop
      synth?.cancel();
      setSpeakingIdx(null);
      return;
    }
    setSpeakingIdx(idx);
    speak(text, () => setSpeakingIdx(null));
  }

  // ─── STT (Speech-to-Text) ─────────────────────────────────────────────────
  function toggleListening() {
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function toggleAutoSpeak() {
    const next = !autoSpeak;
    setAutoSpeak(next);
    try { localStorage.setItem("sc_tutor_autospeak", next ? "1" : "0"); } catch {}
  }

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    // Stop listening if active
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
    try {
      await ask(msg);
    } catch (err) {
      // error already in tutor.error
    }
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "min(70vh, 700px)",
      minHeight: 360
    }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "rgba(15, 23, 42, 0.5)",
          borderRadius: 12,
          marginBottom: 10,
          minHeight: 0
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <p>Start a conversation with your AI tutor</p>
            <p style={{ fontSize: 12 }}>Ask anything about your subject — concepts, problems, exam prep.</p>
            <p style={{ fontSize: 11, marginTop: 8, color: "#64748b" }}>🎤 Use the mic button to speak · 🔊 Click listen on any response</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: m.role === "user" ? "92%" : "100%",
              padding: "10px 14px",
              borderRadius: 12,
              background: m.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(30, 41, 59, 0.9)",
              color: m.role === "user" ? "#fff" : "#e5e7eb",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              fontSize: 14,
              lineHeight: 1.6,
              border: m.role === "assistant" ? "1px solid rgba(99, 102, 241, 0.2)" : "none"
            }}
          >
            {m.content}
            {/* TTS button for AI responses */}
            {m.role === "assistant" && (
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => handleSpeak(i, m.content)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    background: speakingIdx === i ? "rgba(99, 102, 241, 0.3)" : "transparent",
                    color: speakingIdx === i ? "#c4b5fd" : "#a5b4fc",
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {speakingIdx === i ? "⏹️ Stop" : "🔊 Listen"}
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "#9ca3af", fontStyle: "italic", padding: "8px 14px" }}>
            🤔 Thinking...
          </div>
        )}
      </div>

      {/* Voice Controls Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={toggleAutoSpeak}
          title={autoSpeak ? "Auto-speak ON — AI replies will be read aloud" : "Auto-speak OFF"}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: `1px solid ${autoSpeak ? "rgba(34, 197, 94, 0.4)" : "rgba(99, 102, 241, 0.2)"}`,
            background: autoSpeak ? "rgba(34, 197, 94, 0.15)" : "transparent",
            color: autoSpeak ? "#4ade80" : "#64748b",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          {autoSpeak ? "🔊 Auto-speak ON" : "🔇 Auto-speak OFF"}
        </button>
        <span style={{ fontSize: 10, color: "#64748b" }}>
          {SpeechRecognition ? "🎤 Voice input available" : "🎤 Voice not supported in this browser"}
        </span>
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        {/* Mic Button */}
        <button
          type="button"
          onClick={toggleListening}
          title={listening ? "Stop listening" : "Speak your question"}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: listening ? "2px solid #ef4444" : "1px solid rgba(99, 102, 241, 0.3)",
            background: listening ? "rgba(239, 68, 68, 0.15)" : "rgba(30, 41, 59, 0.8)",
            color: listening ? "#f87171" : "#a5b4fc",
            cursor: "pointer",
            fontSize: 16,
            animation: listening ? "pulse 1.5s infinite" : "none",
            transition: "all 0.2s"
          }}
        >
          {listening ? "⏹️" : "🎤"}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening... speak now" : "Ask your tutor anything..."}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: listening ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(99, 102, 241, 0.3)",
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
