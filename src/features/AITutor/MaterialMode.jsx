import React, { useState } from "react";
import { extractTextFromFile } from "./fileExtract.js";

const STORAGE_KEY = "scholars-circle-saved-materials";

/**
 * AI Tutor "Material" mode:
 *   1. Student uploads PDF / DOCX / TXT / Markdown.
 *   2. We extract the text in the browser.
 *   3. Student asks for: Summary, Teach me, MCQs, or Flashcards.
 * The extracted text is fed to the same `tutor.generate(...)` pipeline used elsewhere,
 * so disciplines / subject context still apply.
 */
export function MaterialMode({ tutor, subject, onImportFlashcards, onImportQuestions }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [images, setImages] = useState([]); // base64 data URLs for image/scanned PDF
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [pages, setPages] = useState(null);
  const [output, setOutput] = useState(null); // { kind, text, parsed? }
  const [busy, setBusy] = useState(null); // current action label
  const [mcqCount, setMcqCount] = useState(10);
  const [flashCount, setFlashCount] = useState(10);
  const [showSaved, setShowSaved] = useState(false);
  const [savedMaterials, setSavedMaterials] = useState(getSavedMaterials());

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setExtractError(null);
    setText("");
    setImages([]);
    setOutput(null);
    setFile(f);
    setExtracting(true);
    try {
      const result = await extractTextFromFile(f);
      setText(result.text);
      setPages(result.pages || null);
      setImages(result.images || []);
      if (result.images && result.images.length > 0) {
        setExtractError(`Loaded ${result.images.length} image${result.images.length > 1 ? 's' : ''} — will be sent to the AI for analysis.`);
      } else if (!result.text || result.text.length < 30) {
        setExtractError("Very little text was extracted. If this is a scanned PDF, please paste the text manually below.");
      }
    } catch (err) {
      setExtractError(err.message || "Failed to read file");
    } finally {
      setExtracting(false);
    }
  }

  function clearFile() {
    setFile(null);
    setText("");
    setImages([]);
    setPages(null);
    setOutput(null);
    setExtractError(null);
  }

  async function run(action) {
    if (!text.trim() && images.length === 0) {
      alert("Please upload a file or paste text first.");
      return;
    }
    setBusy(action);
    setOutput(null);
    try {
      let result;
      const imgParam = images.length > 0 ? images : undefined;
      if (action === "summary") {
        result = await tutor.generate({ mode: "summarize", input: trimForAI(text), images: imgParam });
        setOutput({ kind: "summary", text: result.text });
      } else if (action === "teach") {
        const prompt = `Teach me everything in the following document as if I'm a 100-level student. Structure your response with:\n\n1. **Quick Overview** (3-5 sentences)\n2. **Key Concepts** (each explained simply with an analogy or example)\n3. **How These Concepts Connect**\n4. **Common Misconceptions / Pitfalls**\n5. **3 Self-Check Questions** (without answers, so I can think)\n\nDocument content:\n"""\n${trimForAI(text)}\n"""`;
        result = await tutor.generate({ mode: "explain", input: prompt, images: imgParam });
        setOutput({ kind: "teach", text: result.text });
      } else if (action === "mcq") {
        const prompt = `Generate ${mcqCount} multiple-choice questions strictly based on this material. Cover the most important concepts. Each question must have 4 options and one correct answer.\n\nReturn ONLY a JSON array of objects with this exact shape:\n[{"q": "question text", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "why this is correct"}]\n\nNo markdown, no commentary, just JSON.\n\nMaterial:\n"""\n${trimForAI(text)}\n"""`;
        result = await tutor.generate({ mode: "generate_quiz", input: prompt, images: imgParam });
        setOutput({ kind: "mcq", text: result.text, parsed: result.parsed });
      } else if (action === "flash") {
        const prompt = `Create ${flashCount} flashcards from this material. Cover the most testable concepts and definitions.\n\nReturn ONLY a JSON array of objects:\n[{"front": "question or term", "back": "answer or definition"}]\n\nNo markdown, no commentary, just JSON.\n\nMaterial:\n"""\n${trimForAI(text)}\n"""`;
        result = await tutor.generate({ mode: "generate_flashcards", input: prompt, images: imgParam });
        setOutput({ kind: "flash", text: result.text, parsed: result.parsed });
      }
    } catch (err) {
      alert("AI request failed: " + err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Upload zone */}
      <div style={{
        padding: 18,
        border: "2px dashed rgba(255,215,0,0.4)",
        borderRadius: 12,
        background: "rgba(10,10,10,0.5)",
        textAlign: "center"
      }}>
        <div style={{ fontSize: 32 }}>📎</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Upload your study material
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
          PDF, DOCX, TXT, MD, or images (PNG/JPG) — up to ~50 pages
        </div>
        <label style={{
          display: "inline-block",
          padding: "10px 20px",
          background: "linear-gradient(135deg, #FFD700, #DAA520)",
          color: "#fff",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13
        }}>
          {file ? "📁 Change file" : "📤 Choose file"}
          <input type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.bmp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/*" onChange={handleFile} style={{ display: "none" }} />
        </label>
        {file && (
          <div style={{ marginTop: 10, color: "#FFD700", fontSize: 12 }}>
            <b>{file.name}</b> {pages ? `· ${pages} page${pages > 1 ? "s" : ""}` : ""} · {Math.round(file.size / 1024)} KB
            <button onClick={clearFile} style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#f87171", cursor: "pointer", fontSize: 11 }}>
              ✕ Clear
            </button>
          </div>
        )}
        {extracting && <div style={{ marginTop: 10, color: "#fbbf24", fontSize: 12 }}>📖 Extracting text…</div>}
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
            {images.slice(0, 3).map((img, i) => (
              <img key={i} src={img} alt={`Page ${i + 1}`} style={{ width: 70, height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,215,0,0.4)" }} />
            ))}
            {images.length > 3 && (
              <span style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>+{images.length - 3} more</span>
            )}
          </div>
        )}
        {extractError && <div style={{ marginTop: 10, color: "#f87171", fontSize: 12 }}>⚠️ {extractError}</div>}
      </div>

      {/* Text preview / paste fallback */}
      {(text || file) && (
        <details style={{ background: "rgba(10,10,10,0.6)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 8, padding: 10 }}>
          <summary style={{ cursor: "pointer", color: "#FFD700", fontSize: 13 }}>
            📄 Extracted text preview ({text.length.toLocaleString()} chars) — click to view/edit
          </summary>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 6, border: "1px solid rgba(255,215,0,0.3)", background: "rgba(0,0,0,0.3)", color: "#FFD700", fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
          />
        </details>
      )}
      {!file && (
        <details style={{ background: "rgba(10,10,10,0.6)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 8, padding: 10 }}>
          <summary style={{ cursor: "pointer", color: "#FFD700", fontSize: 13 }}>
            ✏️ Or paste text directly
          </summary>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste lecture notes, chapter text, transcripts…"
            style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 6, border: "1px solid rgba(255,215,0,0.3)", background: "rgba(0,0,0,0.3)", color: "#FFD700", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
          />
        </details>
      )}

      {/* Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <ActionBtn icon="📑" label="Summarize" desc="Concise overview" onClick={() => run("summary")} loading={busy === "summary"} disabled={!text.trim() || !!busy} />
        <ActionBtn icon="🎓" label="Teach me" desc="Walk-through lesson" onClick={() => run("teach")} loading={busy === "teach"} disabled={!text.trim() || !!busy} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ActionBtn icon="❓" label="Generate MCQs" desc={`${mcqCount} questions`} onClick={() => run("mcq")} loading={busy === "mcq"} disabled={!text.trim() || !!busy} />
          <input type="number" min="3" max="150" value={mcqCount} onChange={(e) => setMcqCount(parseInt(e.target.value) || 10)} style={smallInp} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ActionBtn icon="🃏" label="Flashcards" desc={`${flashCount} cards`} onClick={() => run("flash")} loading={busy === "flash"} disabled={!text.trim() || !!busy} />
          <input type="number" min="3" max="50" value={flashCount} onChange={(e) => setFlashCount(parseInt(e.target.value) || 10)} style={smallInp} />
        </div>
      </div>

      {/* Saved Materials Section */}
      <div style={{ background: "rgba(10,10,10,0.6)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>💾 Saved Materials</h3>
          <button
            onClick={() => {
              setSavedMaterials(getSavedMaterials());
              setShowSaved(!showSaved);
            }}
            style={{ ...smallBtn, marginTop: 0, padding: "4px 10px", fontSize: 11 }}
          >
            {showSaved ? "Hide" : `Show (${savedMaterials.length})`}
          </button>
        </div>
        {showSaved && (
          <div>
            {savedMaterials.length === 0 ? (
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>No saved materials yet. Generate MCQs or flashcards and save them locally.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {savedMaterials.map((item) => (
                  <div key={item.id} style={{ background: "rgba(20,20,20,0.6)", borderRadius: 6, padding: 10, border: "1px solid rgba(255,215,0,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 18, marginRight: 6 }}>{item.kind === "mcq" ? "❓" : "🃏"}</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{item.kind === "mcq" ? `${item.data.length} Questions` : `${item.data.length} Flashcards`}</span>
                        {item.subject && <span style={{ fontSize: 11, color: "#FFD700", marginLeft: 8 }}>· {item.subject.label}</span>}
                      </div>
                      <button
                        onClick={() => {
                          deleteMaterial(item.id);
                          setSavedMaterials(getSavedMaterials());
                        }}
                        style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#f87171", cursor: "pointer", fontSize: 10 }}
                      >
                        ✕
                      </button>
                    </div>
                    <p className="muted" style={{ fontSize: 11, margin: "0 0 8px 0" }}>
                      Saved {new Date(item.savedAt).toLocaleDateString()} at {new Date(item.savedAt).toLocaleTimeString()}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {item.kind === "mcq" && onImportQuestions && subject && (
                        <button
                          onClick={() => {
                            const questions = item.data.map((q, i) => ({
                              id: `saved-${item.id}-${i}`,
                              q: q.q,
                              options: q.options,
                              answer: q.answer,
                              explanation: q.explanation || ""
                            }));
                            onImportQuestions(subject.id, questions);
                            alert(`✓ ${questions.length} questions added to ${subject.label}`);
                          }}
                          style={{ ...smallBtn, marginTop: 0, padding: "4px 10px", fontSize: 11 }}
                        >
                          📥 Import to {subject.label}
                        </button>
                      )}
                      {item.kind === "flash" && onImportFlashcards && subject && (
                        <button
                          onClick={() => {
                            onImportFlashcards(subject.id, item.data.map((c, idx) => ({
                              id: `saved-${item.id}-${idx}`,
                              front: c.front,
                              back: c.back
                            })));
                            alert(`✓ ${item.data.length} flashcards added to ${subject.label}`);
                          }}
                          style={{ ...smallBtn, marginTop: 0, padding: "4px 10px", fontSize: 11 }}
                        >
                          📥 Import to {subject.label}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setOutput({ kind: item.kind, parsed: item.data });
                          setShowSaved(false);
                        }}
                        style={{ ...smallBtn, marginTop: 0, padding: "4px 10px", fontSize: 11 }}
                      >
                        👁️ View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output */}
      {output && (
        <Output
          output={output}
          subject={subject}
          onImportFlashcards={onImportFlashcards}
          onImportQuestions={onImportQuestions}
          onSave={() => setSavedMaterials(getSavedMaterials())}
        />
      )}
    </div>
  );
}

function ActionBtn({ icon, label, desc, onClick, loading, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,215,0,0.4)",
        background: disabled ? "rgba(255,215,0,0.15)" : "linear-gradient(145deg, rgba(255,215,0,0.25), rgba(218,165,32,0.15))",
        color: disabled ? "#9ca3af" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        flex: 1
      }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>
        {loading ? "Working…" : label}
      </div>
      <div style={{ fontSize: 11, color: "#FFD700", marginTop: 2 }}>{desc}</div>
    </button>
  );
}

function Output({ output, subject, onImportFlashcards, onImportQuestions, onSave }) {
  if (output.kind === "summary" || output.kind === "teach") {
    return (
      <div className="card" style={{ padding: 14, background: "rgba(10,10,10,0.7)", border: "1px solid rgba(255,215,0,0.3)" }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>
          {output.kind === "summary" ? "📑 Summary" : "🎓 Lesson"}
        </h3>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, color: "#FFD700" }}>
          {output.text}
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(output.text); }}
          style={smallBtn}
        >
          📋 Copy
        </button>
      </div>
    );
  }

  if (output.kind === "mcq") {
    if (!output.parsed || !Array.isArray(output.parsed)) {
      return (
        <div className="card" style={{ padding: 12, color: "#f87171" }}>
          ⚠️ AI returned non-JSON output. Raw response below:
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 8, color: "#FFD700" }}>{output.text}</pre>
        </div>
      );
    }
    return (
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>❓ {output.parsed.length} Questions</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                saveMaterial("mcq", output.parsed, subject);
                onSave?.();
                alert("✓ Saved to local storage");
              }}
              style={{ ...smallBtn, background: "rgba(34,197,94,0.2)", borderColor: "rgba(34,197,94,0.4)" }}
            >
              💾 Save locally
            </button>
            {onImportQuestions && subject && (
              <button
                onClick={() => {
                  const questions = output.parsed.map((q, i) => ({
                    id: `mat-${Date.now()}-${i}`,
                    q: q.q,
                    options: q.options,
                    answer: q.answer,
                    explanation: q.explanation || ""
                  }));
                  onImportQuestions(subject.id, questions);
                  alert(`✓ ${questions.length} questions added to ${subject.label}`);
                }}
                style={smallBtn}
              >
                📥 Add to {subject.label}
              </button>
            )}
          </div>
        </div>
        {output.parsed.map((q, i) => (
          <details key={i} style={{ marginTop: 10, padding: 10, background: "rgba(10,10,10,0.6)", borderRadius: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13 }}><b>Q{i + 1}:</b> {q.q}</summary>
            <ol type="A" style={{ marginTop: 8, paddingLeft: 22 }}>
              {q.options?.map((opt, j) => (
                <li key={j} style={{
                  color: j === q.answer ? "#10b981" : "#cbd5e1",
                  fontWeight: j === q.answer ? 700 : 400,
                  fontSize: 13,
                  marginBottom: 2
                }}>
                  {opt} {j === q.answer && "✓"}
                </li>
              ))}
            </ol>
            {q.explanation && <div style={{ fontSize: 12, color: "#FFD700", marginTop: 6 }}>💡 {q.explanation}</div>}
          </details>
        ))}
      </div>
    );
  }

  if (output.kind === "flash") {
    if (!output.parsed || !Array.isArray(output.parsed)) {
      return (
        <div className="card" style={{ padding: 12, color: "#f87171" }}>
          ⚠️ AI returned non-JSON output. Raw response below:
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 8, color: "#FFD700" }}>{output.text}</pre>
        </div>
      );
    }
    return <FlashcardViewer cards={output.parsed} subject={subject} onImport={onImportFlashcards} />;
  }

  return null;
}

function FlashcardViewer({ cards, subject, onImport }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[i];
  if (!card) return null;

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>🃏 Flashcard {i + 1} / {cards.length}</h3>
        {i === 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                saveMaterial("flash", cards, subject);
                onSave?.();
                alert("✓ Saved to local storage");
              }}
              style={{ ...smallBtn, background: "rgba(34,197,94,0.2)", borderColor: "rgba(34,197,94,0.4)" }}
            >
              💾 Save locally
            </button>
            {onImport && subject && (
              <button
                onClick={() => {
                  onImport(subject.id, cards.map((c, idx) => ({
                    id: `mat-card-${Date.now()}-${idx}`,
                    front: c.front,
                    back: c.back
                  })));
                  alert(`✓ ${cards.length} flashcards added to ${subject.label}`);
                }}
                style={smallBtn}
              >
                📥 Save all to {subject.label}
              </button>
            )}
          </div>
        )}
      </div>
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          padding: 24,
          minHeight: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          background: flipped ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #FFD700, #DAA520)",
          color: "#fff",
          borderRadius: 12,
          cursor: "pointer",
          fontSize: 16,
          fontWeight: flipped ? 500 : 600,
          whiteSpace: "pre-wrap",
          userSelect: "none"
        }}
      >
        {flipped ? card.back : card.front}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
        <button onClick={() => { setI((x) => Math.max(0, x - 1)); setFlipped(false); }} disabled={i === 0} style={smallBtn}>← Prev</button>
        <button onClick={() => setFlipped((f) => !f)} style={smallBtn}>{flipped ? "Show front" : "Reveal answer"}</button>
        <button onClick={() => { setI((x) => Math.min(cards.length - 1, x + 1)); setFlipped(false); }} disabled={i === cards.length - 1} style={smallBtn}>Next →</button>
      </div>
    </div>
  );
}

function trimForAI(t) {
  const MAX = 14000;
  if (t.length <= MAX) return t;
  return t.slice(0, MAX) + "\n\n[...content truncated for AI processing...]";
}

function getSavedMaterials() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMaterial(kind, data, subject) {
  const saved = getSavedMaterials();
  const newItem = {
    id: Date.now(),
    kind,
    data,
    subject: subject ? { id: subject.id, label: subject.label } : null,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newItem, ...saved]));
  return newItem;
}

function deleteMaterial(id) {
  const saved = getSavedMaterials().filter(m => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

const smallBtn = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid rgba(255,215,0,0.4)",
  background: "rgba(20,20,20,0.6)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
  marginTop: 8
};

const smallInp = {
  width: "100%",
  padding: 4,
  borderRadius: 4,
  border: "1px solid rgba(255,215,0,0.3)",
  background: "rgba(10,10,10,0.7)",
  color: "#fff",
  fontSize: 11,
  textAlign: "center",
  boxSizing: "border-box"
};
