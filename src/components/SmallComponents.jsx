import React, { useState } from "react";
import { callAI } from "../lib/aiClient";

export function CommandPalette({ query, setQuery, onClose, actions }) {
  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <input
            autoFocus
            placeholder="Type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={onClose}>Esc</button>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 10, display: "grid", gap: 6 }}>
          {filtered.slice(0, 12).map((a) => (
            <button key={a.label} className="palette-row" onClick={() => { a.run(); onClose(); setQuery(""); }}>
              <span>{a.label}</span>
              {a.kbd && <kbd>{a.kbd}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && <p className="muted">No matches.</p>}
        </div>
      </div>
    </div>
  );
}

export function AIHelper({ aiConfig, onUsed }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAI() {
    if (!q.trim()) return;
    try {
      setLoading(true);
      const text = await callAI(q, aiConfig);
      setA(text);
      onUsed?.();
    } catch (err) {
      setA(err.message || "AI request failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask for explanation..." />
      <button onClick={askAI} disabled={loading}>{loading ? "Thinking..." : "Explain"}</button>
      {a && <p className="muted">{a}</p>}
    </div>
  );
}

export function SimpleCheckpoint({ question, onDone }) {
  const [selected, setSelected] = useState(null);
  const [show, setShow] = useState(false);

  return (
    <div className="lesson-block">
      <h3>Checkpoint</h3>
      <p>{question.q}</p>
      {question.options.map((o, i) => (
        <button key={o} className="option" onClick={() => setSelected(i)}>
          {o}
        </button>
      ))}
      {!show ? (
        <button onClick={() => setShow(true)} disabled={selected == null}>
          Check
        </button>
      ) : (
        <p className="muted">{selected === question.answer ? "Correct ✅" : "Try again next round ❌"}</p>
      )}
      <button onClick={onDone}>Close</button>
    </div>
  );
}

export function AIQuestionGen({ onImportQuestions }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState("");

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true); setError(""); setPreview([]);
    const prompt = `Generate exactly ${count} multiple-choice questions about "${topic}" for a first-year university student. Difficulty: ${difficulty}.\nReturn ONLY a JSON array with this structure (no extra text):\n[{"q":"question","options":["A","B","C","D"],"answer":0,"explanation":"why","difficulty":"${difficulty}"}]\nThe "answer" field is the index (0-3) of the correct option.`;
    try {
      const raw = await callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" });
      const jsonStr = raw.startsWith("[") ? raw : raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
      const parsed = JSON.parse(jsonStr);
      setPreview(parsed);
    } catch (e) {
      setError(`Generation failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function importAll() {
    onImportQuestions(preview.map(q => ({ ...q, explanation: q.explanation || "AI-generated question." })));
    setPreview([]); setTopic("");
  }

  return (
    <div className="lesson-block">
      <h3>AI Question Generator</h3>
      <p className="muted">Paste a topic, get instant MCQs added to the Custom Bank.</p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic (e.g. Cell Division, Integration)" style={{ flex: 2, minWidth: 200 }} />
        <select value={count} onChange={e => setCount(Number(e.target.value))}>
          {[3,5,8,10].map(n => <option key={n} value={n}>{n} Qs</option>)}
        </select>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
          <option value="easy">easy</option>
          <option value="medium">medium</option>
          <option value="hard">hard</option>
        </select>
      </div>
      <button onClick={generate} disabled={loading} style={{ marginTop: 8, borderColor: "#FFD700", color: "#FFD700" }}>
        {loading ? "Generating…" : "✨ Generate Questions"}
      </button>
      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
      {preview.length > 0 && (
        <>
          <h4>Preview ({preview.length} questions)</h4>
          {preview.map((q, i) => (
            <div key={i} className="history-row">
              <span style={{ fontSize: 13 }}>{i+1}. {q.q}</span>
              <span className="muted" style={{ fontSize: 12 }}>{q.options[q.answer]}</span>
            </div>
          ))}
          <button onClick={importAll} style={{ marginTop: 8, borderColor: "#FFD700", color: "#FFD700" }}>
            ✅ Import all {preview.length} to Question Bank
          </button>
        </>
      )}
    </div>
  );
}

export function BulkImport({ onImportQuestions }) {
  const [csv, setCsv] = useState("");

  return (
    <div className="lesson-block">
      <h3>Question Authoring Studio</h3>
      <p className="muted">CSV: question,a,b,c,d,answerIndex(0-3),difficulty</p>
      <textarea rows={5} style={{ width: "100%" }} value={csv} onChange={(e) => setCsv(e.target.value)} />
      <button
        onClick={() => {
          const parsed = csv
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((line) => {
              const [q, a, b, c, d, ans, difficulty] = line.split(",");
              return { q, options: [a, b, c, d], answer: Number(ans), difficulty: difficulty || "medium", explanation: "Imported question" };
            })
            .filter((r) => r.q && r.options.every(Boolean) && Number.isInteger(r.answer));
          onImportQuestions(parsed);
          setCsv("");
        }}
      >
        Import Questions
      </button>
    </div>
  );
}
