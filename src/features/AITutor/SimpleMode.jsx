import React, { useState } from "react";

// Generic single-input mode used for Explain, Solve, Summarize, Translate
export function SimpleMode({ tutor, mode, config }) {
  const { generate, loading } = tutor;
  const [input, setInput] = useState("");
  const [extra, setExtra] = useState(""); // for translate target lang
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleRun() {
    if (!input.trim()) return;
    setError(null);
    setResult(null);
    try {
      const args = mode === "translate" ? [extra || "English"] : [];
      const res = await generate({ mode, input, extra: { args } });
      setResult(res.text);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>{config.icon} {config.title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{config.description}</p>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={config.placeholder}
        rows={config.rows || 4}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid rgba(99,102,241,0.3)",
          background: "rgba(30,41,59,0.8)",
          color: "#fff",
          fontSize: 14,
          resize: "vertical",
          marginBottom: 12
        }}
      />

      {mode === "translate" && (
        <input
          type="text"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Target language (e.g., French, Spanish, Yoruba)"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.3)",
            background: "rgba(30,41,59,0.8)",
            color: "#fff",
            marginBottom: 12
          }}
        />
      )}

      <button
        onClick={handleRun}
        disabled={loading || !input.trim()}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "none",
          background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          fontSize: 15
        }}
      >
        {loading ? `⏳ ${config.loadingText || "Working..."}` : config.buttonText || "Run"}
      </button>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 16,
          padding: 16,
          background: "rgba(30,41,59,0.8)",
          borderRadius: 10,
          whiteSpace: "pre-wrap",
          color: "#e5e7eb",
          fontSize: 14,
          lineHeight: 1.7,
          maxHeight: 600,
          overflowY: "auto",
          border: "1px solid rgba(99,102,241,0.2)"
        }}>
          {result}
        </div>
      )}
    </div>
  );
}
