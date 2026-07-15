import React, { useState } from "react";

const SUB_MODES = [
  { id: "generate_notes", label: "📝 Study Notes", desc: "Comprehensive notes with examples" },
  { id: "generate_flashcards", label: "🃏 Flashcards", desc: "Anki-style Q&A cards" },
  { id: "generate_quiz", label: "📋 Practice Quiz", desc: "Multiple choice questions" }
];

export function GenerateMode({ tutor, onImportFlashcards, onImportQuestions, subject }) {
  const { generate, loading } = tutor;
  const [subMode, setSubMode] = useState("generate_notes");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setError(null);
    setResult(null);
    try {
      const res = await generate({
        mode: subMode,
        input: topic,
        extra: { args: subMode === "generate_notes" ? [] : [count] }
      });
      setResult({ ...res, mode: subMode });
    } catch (e) {
      setError(e.message);
    }
  }

  function handleImport() {
    if (!result?.parsed) return;
    if (subMode === "generate_flashcards" && onImportFlashcards) {
      onImportFlashcards(result.parsed.map(c => ({
        front: c.front,
        back: c.back,
        subject: subject?.label || ""
      })));
      alert(`✓ Imported ${result.parsed.length} flashcards`);
    } else if (subMode === "generate_quiz" && onImportQuestions) {
      onImportQuestions(result.parsed.map(q => ({
        q: q.q,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        subjectId: subject?.id
      })));
      alert(`✓ Imported ${result.parsed.length} questions`);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Sub-mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {SUB_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setSubMode(m.id); setResult(null); }}
            style={{
              flex: "1 1 150px",
              padding: 12,
              borderRadius: 10,
              border: subMode === m.id ? "2px solid #FFD700" : "1px solid rgba(255,215,0,0.2)",
              background: subMode === m.id ? "rgba(255,215,0,0.15)" : "rgba(20,20,20,0.8)",
              color: "#fff",
              cursor: "pointer",
              textAlign: "left"
            }}
          >
            <div style={{ fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#FFD700" }}>Topic or content</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Photosynthesis in plants, or paste a paragraph..."
          rows={3}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(255,215,0,0.3)",
            background: "rgba(20,20,20,0.8)",
            color: "#fff",
            fontSize: 14,
            resize: "vertical"
          }}
        />
      </div>

      {(subMode === "generate_flashcards" || subMode === "generate_quiz") && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#FFD700" }}>How many?</label>
          <input
            type="number"
            min={3}
            max={30}
            value={count}
            onChange={(e) => setCount(Math.max(3, Math.min(30, +e.target.value || 10)))}
            style={{
              width: 100,
              padding: 8,
              borderRadius: 8,
              border: "1px solid rgba(255,215,0,0.3)",
              background: "rgba(20,20,20,0.8)",
              color: "#fff"
            }}
          />
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !topic.trim()}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "none",
          background: loading ? "rgba(255,215,0,0.5)" : "linear-gradient(135deg, #FFD700, #DAA520)",
          color: "#fff",
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          fontSize: 15
        }}
      >
        {loading ? "✨ Generating..." : "✨ Generate"}
      </button>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 16 }}>
          {result.parsed && Array.isArray(result.parsed) ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>✓ Generated {result.parsed.length} items</h4>
                <button
                  onClick={handleImport}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  📥 Import to my {subMode === "generate_flashcards" ? "Flashcards" : "Question Bank"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                {result.parsed.map((item, i) => (
                  <div key={i} style={{ padding: 12, background: "rgba(20,20,20,0.8)", borderRadius: 8, border: "1px solid rgba(255,215,0,0.2)" }}>
                    {subMode === "generate_flashcards" ? (
                      <>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.front}</div>
                        <div style={{ fontSize: 13, color: "#9ca3af" }}>{item.back}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{i + 1}. {item.q}</div>
                        {item.options?.map((opt, j) => (
                          <div key={j} style={{ fontSize: 13, color: j === item.answer ? "#10b981" : "#9ca3af", marginLeft: 12 }}>
                            {String.fromCharCode(65 + j)}. {opt} {j === item.answer && "✓"}
                          </div>
                        ))}
                        {item.explanation && <div style={{ fontSize: 12, color: "#FFD700", marginTop: 6, fontStyle: "italic" }}>{item.explanation}</div>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: 16, background: "rgba(20,20,20,0.8)", borderRadius: 10, whiteSpace: "pre-wrap", color: "#e5e7eb", fontSize: 14, lineHeight: 1.7, maxHeight: 600, overflowY: "auto" }}>
              {result.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
