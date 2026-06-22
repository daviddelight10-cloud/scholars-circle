import React, { useState, useEffect } from "react";
import { extractTextFromFile } from "../features/AITutor/fileExtract.js";
import { extractJSON } from "../lib/aiClient.js";

const DRAFT_KEY = "sc_teacher_drafts_v1";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const inp = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0a0c1e",
  border: "0.5px solid #1e2140",
  borderRadius: 9,
  padding: "8px 12px",
  fontSize: 12,
  color: "#e8eaf6",
  outline: "none",
  fontFamily: "Manrope,sans-serif",
};

const diffColor = (d) =>
  d === "hard" ? "#ef9a9a" : d === "easy" ? "#81c784" : "#ffd54f";

export default function TeacherQuestionManager({ token, subjects, onSubjectsRefresh }) {
  const [tab, setTab] = useState("add");
  const [mode, setMode] = useState("manual");
  const [subjectId, setSubjectId] = useState("");

  // Draft queue
  const [drafts, setDrafts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]"); } catch { return []; }
  });
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Library (published questions)
  const [library, setLibrary] = useState([]);
  const [libLoading, setLibLoading] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [libSearch, setLibSearch] = useState("");
  const [libDiff, setLibDiff] = useState("");

  // Outline
  const [outline, setOutline] = useState([]);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: "", description: "", week: "" });

  // Notes
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState({ title: "", body: "", isShared: false });
  const [editingNote, setEditingNote] = useState(null);

  // Manual form
  const blankForm = { question: "", optionA: "", optionB: "", optionC: "", optionD: "", answerIndex: 0, difficulty: "medium", year: new Date().getFullYear(), explanation: "", topic: "" };
  const [manualForm, setManualForm] = useState(blankForm);

  // AI generation
  const [aiText, setAiText] = useState("");
  const [aiFile, setAiFile] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCount, setAiCount] = useState(10);

  // New subject modal
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectForm, setNewSubjectForm] = useState({ label: "", description: "" });

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    if (!subjectId || !token) return;
    if (tab === "library") fetchLibrary();
    else if (tab === "outline") fetchOutline();
    else if (tab === "notes") fetchNotes();
  }, [subjectId, tab]);

  function notify(msg, isErr = false) {
    if (isErr) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 3500);
  }

  // ─── Library ────────────────────────────────────────────────────────────
  async function fetchLibrary() {
    if (!subjectId) return;
    setLibLoading(true);
    try {
      const r = await fetch(`${API_BASE}/questions?subjectId=${subjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to load questions");
      const data = await r.json();
      setLibrary(Array.isArray(data) ? data : data.questions || []);
    } catch (e) { notify(e.message, true); }
    finally { setLibLoading(false); }
  }

  async function saveEditedQuestion() {
    if (!editingQ) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/questions/${editingQ.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingQ),
      });
      if (!r.ok) throw new Error("Failed to update question");
      const updated = await r.json();
      setLibrary(prev => prev.map(q => q.id === updated.id ? updated : q));
      setEditingQ(null);
      notify("Question updated");
    } catch (e) { notify(e.message, true); }
    finally { setLoading(false); }
  }

  async function deleteQuestion(id) {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    try {
      const r = await fetch(`${API_BASE}/questions/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to delete question");
      setLibrary(prev => prev.filter(q => q.id !== id));
      notify("Question deleted");
    } catch (e) { notify(e.message, true); }
  }

  async function aiExplainQuestion(q) {
    try {
      const prompt = `Generate a concise explanation (2-3 sentences) for this multiple choice question:\nQuestion: "${q.question}"\nCorrect answer (Option ${["A","B","C","D"][q.answerIndex]}): ${[q.optionA,q.optionB,q.optionC,q.optionD][q.answerIndex]}\nWrong options: ${["A","B","C","D"].filter((_,i)=>i!==q.answerIndex).map((l,i)=>[q.optionA,q.optionB,q.optionC,q.optionD].filter((_,idx)=>idx!==q.answerIndex)[i]).join(", ")}\nExplain why the correct answer is right and why the others are wrong.`;
      const r = await fetch(`${API_BASE}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      return data.text || "";
    } catch { return ""; }
  }

  function exportCSV() {
    const rows = [["#", "Question", "A", "B", "C", "D", "Answer", "Difficulty", "Topic", "Year", "Explanation"]];
    library.forEach((q, i) =>
      rows.push([i + 1, q.question, q.optionA, q.optionB, q.optionC, q.optionD,
        ["A","B","C","D"][q.answerIndex], q.difficulty, q.topic || "", q.year, q.explanation || ""])
    );
    const csv = rows.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `questions_${subjectId}.csv`;
    a.click();
  }

  const filteredLib = library.filter(q => {
    const s = libSearch.toLowerCase();
    if (s && !q.question.toLowerCase().includes(s) && !(q.topic || "").toLowerCase().includes(s)) return false;
    if (libDiff && q.difficulty !== libDiff) return false;
    return true;
  });

  // ─── Outline ────────────────────────────────────────────────────────────
  async function fetchOutline() {
    setOutlineLoading(true);
    try {
      const r = await fetch(`${API_BASE}/subjects/${subjectId}/outline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setOutline([]); return; }
      const data = await r.json();
      setOutline(Array.isArray(data) ? data : data.topics || []);
    } catch { setOutline([]); }
    finally { setOutlineLoading(false); }
  }

  async function addTopic() {
    if (!newTopic.title.trim()) return;
    try {
      const r = await fetch(`${API_BASE}/subjects/${subjectId}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newTopic),
      });
      if (!r.ok) throw new Error("Failed to add topic");
      const t = await r.json();
      setOutline(prev => [...prev, t]);
      setNewTopic({ title: "", description: "", week: "" });
      notify("Topic added");
    } catch (e) { notify(e.message, true); }
  }

  async function toggleCovered(t) {
    try {
      const r = await fetch(`${API_BASE}/subjects/${subjectId}/outline/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ covered: !t.covered }),
      });
      if (!r.ok) return;
      const updated = await r.json();
      setOutline(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch {}
  }

  async function deleteTopic(id) {
    if (!window.confirm("Delete this topic?")) return;
    try {
      await fetch(`${API_BASE}/subjects/${subjectId}/outline/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setOutline(prev => prev.filter(t => t.id !== id));
    } catch (e) { notify(e.message, true); }
  }

  // ─── Notes ──────────────────────────────────────────────────────────────
  async function fetchNotes() {
    setNotesLoading(true);
    try {
      const r = await fetch(`${API_BASE}/subjects/${subjectId}/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setNotes([]); return; }
      const data = await r.json();
      setNotes(Array.isArray(data) ? data : data.notes || []);
    } catch { setNotes([]); }
    finally { setNotesLoading(false); }
  }

  async function createNote() {
    if (!newNote.title.trim() || !newNote.body.trim()) { notify("Title and body required", true); return; }
    try {
      const r = await fetch(`${API_BASE}/subjects/${subjectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newNote),
      });
      if (!r.ok) throw new Error("Failed to create note");
      const n = await r.json();
      setNotes(prev => [n, ...prev]);
      setNewNote({ title: "", body: "", isShared: false });
      notify("Note saved");
    } catch (e) { notify(e.message, true); }
  }

  async function saveNote() {
    if (!editingNote) return;
    try {
      const r = await fetch(`${API_BASE}/subjects/${subjectId}/notes/${editingNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingNote),
      });
      if (!r.ok) throw new Error("Failed to update note");
      const updated = await r.json();
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      setEditingNote(null);
      notify("Note updated");
    } catch (e) { notify(e.message, true); }
  }

  async function deleteNote(id) {
    if (!window.confirm("Delete this note?")) return;
    try {
      await fetch(`${API_BASE}/subjects/${subjectId}/notes/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e) { notify(e.message, true); }
  }

  async function toggleShareNote(n) {
    try {
      const r = await fetch(`${API_BASE}/subjects/${subjectId}/notes/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isShared: !n.isShared }),
      });
      if (!r.ok) return;
      const updated = await r.json();
      setNotes(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch {}
  }

  // ─── Add Questions ───────────────────────────────────────────────────────
  function addManualDraft() {
    if (!manualForm.question.trim() || !manualForm.optionA.trim() || !manualForm.optionB.trim()) {
      notify("Question and at least 2 options are required", true); return;
    }
    setDrafts(prev => [...prev, { id: Date.now().toString(), subjectId, ...manualForm }]);
    setManualForm(blankForm);
    notify("Added to review queue");
  }

  async function generateFromAI() {
    if (!subjectId) { notify("Select a subject first", true); return; }
    if (!aiText.trim() && !aiFile) { notify("Paste text or upload a file", true); return; }
    setAiGenerating(true);
    try {
      let text = aiText.trim();
      if (aiFile) { const { text: extracted, images } = await extractTextFromFile(aiFile); text = extracted; }
      const countStr = aiCount > 0 ? `${aiCount}` : "as many high-quality questions as you can based on the content (aim for 10-20)";
      const prompt = `You are an expert exam question generator. Generate ${countStr} multiple-choice questions from the following study material. Cover different topics and difficulty levels from the content. Each question must be answerable from the material provided.\n\nReturn ONLY a valid JSON array, each item: { "question": string, "options": [4 strings], "answer": 0-3, "difficulty": "easy"|"medium"|"hard", "explanation": string, "topic": string }.\n\nStudy material:\n${text}`;
      const r = await fetch(`${API_BASE}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok) throw new Error("AI request failed");
      const data = await r.json();
      const raw = data.text || "";
      const parsed = extractJSON(raw, "array");
      const generated = parsed.map((q, i) => ({
        id: `ai-${Date.now()}-${i}`, subjectId,
        question: q.question || "", optionA: q.options?.[0] || "", optionB: q.options?.[1] || "",
        optionC: q.options?.[2] || "", optionD: q.options?.[3] || "",
        answerIndex: q.answer ?? 0, difficulty: q.difficulty || "medium",
        year: new Date().getFullYear(), explanation: q.explanation || "", topic: q.topic || "",
      }));
      setDrafts(prev => [...prev, ...generated]);
      setAiText(""); setAiFile(null);
      notify(`Generated ${generated.length} questions — review them in the Queue tab`);
    } catch (e) { notify(e.message || "Generation failed", true); }
    finally { setAiGenerating(false); }
  }

  // ─── Publish ────────────────────────────────────────────────────────────
  async function publishDrafts() {
    if (!drafts.length) { notify("No questions in queue", true); return; }
    if (!subjectId || !subjectId.startsWith("c")) { notify("Please select a valid database subject", true); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/questions/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questions: drafts.map(q => ({
            subjectId,
            question: String(q.question), optionA: String(q.optionA), optionB: String(q.optionB),
            optionC: String(q.optionC || ""), optionD: String(q.optionD || ""),
            answerIndex: parseInt(q.answerIndex) || 0, difficulty: String(q.difficulty || "medium"),
            year: parseInt(q.year) || new Date().getFullYear(),
            explanation: String(q.explanation || ""), topic: String(q.topic || ""),
          })),
        }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).error) || "Publish failed");
      const data = await r.json();
      setDrafts([]); setSelectedIds(new Set());
      notify(`Published ${data.count} questions successfully!`);
      if (onSubjectsRefresh) onSubjectsRefresh();
    } catch (e) { notify(e.message, true); }
    finally { setLoading(false); }
  }

  // ─── Create Subject ──────────────────────────────────────────────────────
  async function handleCreateSubject() {
    if (!newSubjectForm.label.trim()) { notify("Subject name is required", true); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: newSubjectForm.label.trim(), description: newSubjectForm.description.trim() || null }),
      });
      if (!r.ok) throw new Error("Failed to create subject");
      const s = await r.json();
      setSubjectId(s.id);
      setShowNewSubject(false);
      setNewSubjectForm({ label: "", description: "" });
      notify(`Created: ${s.label}`);
      if (onSubjectsRefresh) onSubjectsRefresh();
    } catch (e) { notify(e.message, true); }
    finally { setLoading(false); }
  }

  // ─── Tab switch helper ───────────────────────────────────────────────────
  function switchTab(id) {
    setTab(id);
    if (!subjectId || !token) return;
    if (id === "library") fetchLibrary();
    else if (id === "outline") fetchOutline();
    else if (id === "notes") fetchNotes();
  }

  const tabStyle = (id) => ({
    padding: "7px 13px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
    fontFamily: "Manrope,sans-serif", border: `0.5px solid ${tab === id ? "#3949ab" : "#1e2140"}`,
    background: tab === id ? "#1a237e" : "#0d0f1f", color: tab === id ? "#c5cae9" : "#4a5080",
  });

  const TABS = [
    { id: "add",     label: "✏️ Add" },
    { id: "queue",   label: `📋 Queue (${drafts.length})` },
    { id: "library", label: `📚 Library (${library.length})` },
    { id: "outline", label: "📖 Outline" },
    { id: "notes",   label: "📒 Notes" },
  ];

  return (
    <div style={{ fontFamily: "Manrope,sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf6", fontFamily: "Syne,sans-serif", flex: 1 }}>🏫 Teacher Hub</div>
      </div>

      {/* Status banners */}
      {error && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: "#1a0808", border: "0.5px solid #4a1414", color: "#ef9a9a", fontSize: 12 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: "#071410", border: "0.5px solid #0a3020", color: "#81c784", fontSize: 12 }}>
          {success}
        </div>
      )}

      {/* Subject selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <select
          value={subjectId}
          onChange={e => setSubjectId(e.target.value)}
          style={{ flex: 1, ...inp, padding: "9px 12px" }}
        >
          <option value="">Select subject…</option>
          {subjects.filter(s => s.id && s.id !== "custom").map(s => (
            <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowNewSubject(true)}
          style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 9, padding: "8px 13px", fontSize: 11, color: "#3949ab", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}
        >
          + Subject
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map(t => <button key={t.id} onClick={() => switchTab(t.id)} style={tabStyle(t.id)}>{t.label}</button>)}
      </div>

      {/* ── ADD QUESTIONS ─────────────────────────────────────────────── */}
      {tab === "add" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["manual", "✍️ Manual Entry"], ["ai", "🤖 AI from Content"]].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} style={{ ...tabStyle(id), borderRadius: 8, border: `0.5px solid ${mode === id ? "#3949ab" : "#1e2140"}`, background: mode === id ? "#1a237e" : "#0d0f1f", color: mode === id ? "#c5cae9" : "#4a5080" }}>{label}</button>
            ))}
          </div>

          {mode === "manual" && (
            <div style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Question *</label>
                <textarea value={manualForm.question} onChange={e => setManualForm(f => ({ ...f, question: e.target.value }))} rows={2} placeholder="Enter the question…" style={{ ...inp, resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["A", "B", "C", "D"].map(l => (
                  <div key={l}>
                    <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Option {l}{l <= "B" ? " *" : ""}</label>
                    <input value={manualForm[`option${l}`]} onChange={e => setManualForm(f => ({ ...f, [`option${l}`]: e.target.value }))} placeholder={`Option ${l}…`} style={inp} />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Correct Answer</label>
                  <select value={manualForm.answerIndex} onChange={e => setManualForm(f => ({ ...f, answerIndex: parseInt(e.target.value) }))} style={inp}>
                    {["A", "B", "C", "D"].map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Difficulty</label>
                  <select value={manualForm.difficulty} onChange={e => setManualForm(f => ({ ...f, difficulty: e.target.value }))} style={inp}>
                    {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Year</label>
                  <input type="number" value={manualForm.year} onChange={e => setManualForm(f => ({ ...f, year: parseInt(e.target.value) }))} style={inp} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Topic</label>
                <input value={manualForm.topic} onChange={e => setManualForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Integration, Cell Biology…" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Explanation</label>
                <textarea value={manualForm.explanation} onChange={e => setManualForm(f => ({ ...f, explanation: e.target.value }))} rows={2} placeholder="Why is the answer correct?" style={{ ...inp, resize: "vertical" }} />
              </div>
              <button onClick={addManualDraft} style={{ background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "#c5cae9", cursor: "pointer", fontWeight: 700 }}>
                Add to Queue →
              </button>
            </div>
          )}

          {mode === "ai" && (
            <div style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 6, fontWeight: 600 }}>Upload File (PDF, DOCX, TXT, MD)</label>
                <input type="file" accept=".pdf,.docx,.txt,.md,.markdown" onChange={e => setAiFile(e.target.files[0])} style={{ fontSize: 12, color: "#7b82b8" }} />
                {aiFile && <div style={{ fontSize: 11, color: "#7b82b8", marginTop: 5 }}>📎 {aiFile.name}</div>}
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#4a5080" }}>— OR —</div>
              <div>
                <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Paste Text / Lecture Notes</label>
                <textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={8} placeholder="Paste lecture notes, textbook content, slides…" style={{ ...inp, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: 11, color: "#3949ab", fontWeight: 600, whiteSpace: "nowrap" }}>Number of Questions:</label>
                <input type="number" min={0} max={50} value={aiCount} onChange={e => setAiCount(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))} style={{ ...inp, width: 70, textAlign: "center" }} />
                <span style={{ fontSize: 10, color: "#4a5080" }}>0 = Auto (AI decides)</span>
              </div>
              <button onClick={generateFromAI} disabled={aiGenerating} style={{ background: aiGenerating ? "#12142a" : "#1a237e", border: "0.5px solid #3949ab", borderRadius: 10, padding: "10px 16px", fontSize: 13, color: aiGenerating ? "#4a5080" : "#c5cae9", cursor: aiGenerating ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {aiGenerating ? "⏳ Generating…" : `🤖 Generate ${aiCount > 0 ? aiCount : "Auto"} Questions`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW QUEUE ──────────────────────────────────────────────── */}
      {tab === "queue" && (
        <div>
          {drafts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080", fontSize: 13 }}>
              No drafts yet. Add questions via the Add tab.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelectedIds(selectedIds.size === drafts.length ? new Set() : new Set(drafts.map(q => q.id)))}
                  style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 8, padding: "6px 12px", fontSize: 11, color: "#7b82b8", cursor: "pointer" }}
                >
                  {selectedIds.size === drafts.length ? "Deselect All" : "Select All"}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => { setDrafts(p => p.filter(q => !selectedIds.has(q.id))); setSelectedIds(new Set()); }}
                    style={{ background: "#140808", border: "0.5px solid #4a1414", borderRadius: 8, padding: "6px 12px", fontSize: 11, color: "#ef9a9a", cursor: "pointer" }}
                  >
                    Delete Selected ({selectedIds.size})
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={publishDrafts}
                  disabled={loading}
                  style={{ background: loading ? "#12142a" : "linear-gradient(135deg,#22c55e,#16a34a)", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, color: loading ? "#4a5080" : "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}
                >
                  {loading ? "Publishing…" : `🚀 Publish ${drafts.length} Questions`}
                </button>
              </div>
              <div style={{ display: "grid", gap: 10, maxHeight: 540, overflowY: "auto", paddingRight: 4 }}>
                {drafts.map((q, i) => (
                  <div key={q.id} style={{ background: selectedIds.has(q.id) ? "#0d1030" : "#0d0f1f", border: `0.5px solid ${selectedIds.has(q.id) ? "#3949ab" : "#1e2140"}`, borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <input type="checkbox" checked={selectedIds.has(q.id)} onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(q.id) : n.delete(q.id); setSelectedIds(n); }} style={{ marginTop: 3, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: "#4a5080", flexShrink: 0, marginTop: 3 }}>#{i + 1}</span>
                      <textarea
                        value={q.question}
                        onChange={e => setDrafts(p => p.map(x => x.id === q.id ? { ...x, question: e.target.value } : x))}
                        rows={2}
                        style={{ ...inp, flex: 1, resize: "vertical" }}
                      />
                      <button onClick={() => setDrafts(p => p.filter(x => x.id !== q.id))} style={{ background: "#140808", border: "0.5px solid #4a1414", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#ef9a9a", cursor: "pointer", flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                      {["A", "B", "C", "D"].map((l, idx) => (
                        <div key={l} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: q.answerIndex === idx ? "#81c784" : "#4a5080", fontWeight: q.answerIndex === idx ? 700 : 400, flexShrink: 0, width: 14 }}>{l}:</span>
                          <input value={q[`option${l}`] || ""} onChange={e => setDrafts(p => p.map(x => x.id === q.id ? { ...x, [`option${l}`]: e.target.value } : x))} style={{ ...inp, fontSize: 11, padding: "5px 8px" }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <select value={q.answerIndex} onChange={e => setDrafts(p => p.map(x => x.id === q.id ? { ...x, answerIndex: parseInt(e.target.value) } : x))} style={{ ...inp, width: "auto", fontSize: 11, padding: "4px 8px" }}>
                        {["A", "B", "C", "D"].map((l, i) => <option key={l} value={i}>✓ {l}</option>)}
                      </select>
                      <select value={q.difficulty} onChange={e => setDrafts(p => p.map(x => x.id === q.id ? { ...x, difficulty: e.target.value } : x))} style={{ ...inp, width: "auto", fontSize: 11, padding: "4px 8px" }}>
                        {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input value={q.topic || ""} onChange={e => setDrafts(p => p.map(x => x.id === q.id ? { ...x, topic: e.target.value } : x))} placeholder="topic…" style={{ ...inp, width: 110, fontSize: 11, padding: "4px 8px" }} />
                    </div>
                    <textarea value={q.explanation || ""} onChange={e => setDrafts(p => p.map(x => x.id === q.id ? { ...x, explanation: e.target.value } : x))} rows={1} placeholder="Explanation…" style={{ ...inp, marginTop: 6, fontSize: 11, resize: "vertical" }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QUESTION LIBRARY ──────────────────────────────────────────── */}
      {tab === "library" && (
        <div>
          {!subjectId ? (
            <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080", fontSize: 13 }}>Select a subject to view published questions.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Search by keyword or topic…" style={{ ...inp, maxWidth: 220 }} />
                <select value={libDiff} onChange={e => setLibDiff(e.target.value)} style={{ ...inp, width: "auto", padding: "7px 10px" }}>
                  <option value="">All difficulties</option>
                  {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div style={{ flex: 1 }} />
                <button onClick={fetchLibrary} style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#7b82b8", cursor: "pointer" }}>🔄 Refresh</button>
                <button onClick={exportCSV} disabled={!library.length} style={{ background: "#071410", border: "0.5px solid #0a3020", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: library.length ? "#81c784" : "#4a5080", cursor: library.length ? "pointer" : "not-allowed" }}>⬇️ Export CSV</button>
              </div>
              {libLoading ? (
                <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080" }}>Loading questions…</div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
                  {filteredLib.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080", fontSize: 13 }}>No questions found.</div>
                  ) : filteredLib.map((q, i) => (
                    <div key={q.id} style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 12, padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 7 }}>
                        <span style={{ fontSize: 10, color: "#4a5080", flexShrink: 0, marginTop: 2 }}>#{i + 1}</span>
                        <div style={{ flex: 1, fontSize: 12, color: "#e8eaf6", lineHeight: 1.6 }}>{q.question}</div>
                        <button onClick={() => setEditingQ({ ...q })} style={{ background: "#080d2a", border: "0.5px solid #1e2a5a", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: "#9fa8da", cursor: "pointer", flexShrink: 0 }}>Edit</button>
                        <button onClick={() => deleteQuestion(q.id)} style={{ background: "#140808", border: "0.5px solid #4a1414", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#ef9a9a", cursor: "pointer", flexShrink: 0 }}>✕</button>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: diffColor(q.difficulty), background: diffColor(q.difficulty) + "18", border: `0.5px solid ${diffColor(q.difficulty)}44`, borderRadius: 6, padding: "2px 7px" }}>{q.difficulty}</span>
                        {q.topic && <span style={{ fontSize: 10, color: "#7b82b8" }}>📌 {q.topic}</span>}
                        {q.year && <span style={{ fontSize: 10, color: "#4a5080" }}>{q.year}</span>}
                        {!q.explanation && <span style={{ fontSize: 10, color: "#ff8a65" }}>⚠️ No explanation</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── COURSE OUTLINE ────────────────────────────────────────────── */}
      {tab === "outline" && (
        <div>
          {!subjectId ? (
            <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080", fontSize: 13 }}>Select a subject first.</div>
          ) : (
            <>
              <div style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#3949ab", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Add Topic</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px auto", gap: 8, marginBottom: 8 }}>
                  <input value={newTopic.title} onChange={e => setNewTopic(t => ({ ...t, title: e.target.value }))} placeholder="Topic title…" style={inp} />
                  <input value={newTopic.week} onChange={e => setNewTopic(t => ({ ...t, week: e.target.value }))} placeholder="Wk #" style={{ ...inp, padding: "8px 8px" }} />
                  <button onClick={addTopic} style={{ background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: 9, padding: "8px 16px", fontSize: 12, color: "#c5cae9", cursor: "pointer", fontWeight: 700 }}>Add</button>
                </div>
                <input value={newTopic.description} onChange={e => setNewTopic(t => ({ ...t, description: e.target.value }))} placeholder="Description (optional)…" style={inp} />
              </div>
              {outlineLoading ? (
                <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080" }}>Loading…</div>
              ) : outline.length === 0 ? (
                <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080", fontSize: 13 }}>No topics yet. Add your first topic above.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {outline.map((t, i) => (
                    <div key={t.id} style={{ background: t.covered ? "#071410" : "#0d0f1f", border: `0.5px solid ${t.covered ? "#0a3020" : "#1e2140"}`, borderRadius: 12, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                      {t.week && (
                        <span style={{ fontSize: 10, color: "#4a5080", flexShrink: 0, background: "#12142a", border: "0.5px solid #1e2140", borderRadius: 6, padding: "2px 7px" }}>Wk {t.week}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.covered ? "#81c784" : "#e8eaf6", textDecoration: t.covered ? "line-through" : "none" }}>{t.title}</div>
                        {t.description && <div style={{ fontSize: 11, color: "#4a5080", marginTop: 2 }}>{t.description}</div>}
                      </div>
                      <button onClick={() => toggleCovered(t)} style={{ background: t.covered ? "#071410" : "#0d0f1f", border: `0.5px solid ${t.covered ? "#0a3020" : "#1e2140"}`, borderRadius: 8, padding: "4px 10px", fontSize: 10, color: t.covered ? "#81c784" : "#4a5080", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {t.covered ? "✓ Done" : "Mark Done"}
                      </button>
                      <button onClick={() => deleteTopic(t.id)} style={{ background: "#140808", border: "0.5px solid #4a1414", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#ef9a9a", cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── NOTES ─────────────────────────────────────────────────────── */}
      {tab === "notes" && (
        <div>
          {!subjectId ? (
            <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080", fontSize: 13 }}>Select a subject first.</div>
          ) : (
            <>
              <div style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#3949ab", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>New Note</div>
                <input value={newNote.title} onChange={e => setNewNote(n => ({ ...n, title: e.target.value }))} placeholder="Note title…" style={{ ...inp, marginBottom: 8 }} />
                <textarea value={newNote.body} onChange={e => setNewNote(n => ({ ...n, body: e.target.value }))} rows={4} placeholder="Write your note…" style={{ ...inp, resize: "vertical", marginBottom: 8 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 11, color: "#7b82b8", cursor: "pointer" }}>
                    <input type="checkbox" checked={newNote.isShared} onChange={e => setNewNote(n => ({ ...n, isShared: e.target.checked }))} />
                    👥 Share with students
                  </label>
                  <button onClick={createNote} style={{ marginLeft: "auto", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: 9, padding: "7px 16px", fontSize: 12, color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Save Note</button>
                </div>
              </div>
              {notesLoading ? (
                <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080" }}>Loading…</div>
              ) : notes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "44px 20px", color: "#4a5080", fontSize: 13 }}>No notes yet. Create your first note above.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {notes.map(n => (
                    <div key={n.id} style={{ background: "#0d0f1f", border: `0.5px solid ${n.isShared ? "#1e3a5a" : "#1e2140"}`, borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf6", marginBottom: 4 }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: "#7b82b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{n.body}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setEditingNote({ ...n })} style={{ background: "#080d2a", border: "0.5px solid #1e2a5a", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: "#9fa8da", cursor: "pointer" }}>Edit</button>
                          <button onClick={() => deleteNote(n.id)} style={{ background: "#140808", border: "0.5px solid #4a1414", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#ef9a9a", cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {n.createdAt && <span style={{ fontSize: 10, color: "#4a5080" }}>{new Date(n.createdAt).toLocaleDateString()}</span>}
                        <button
                          onClick={() => toggleShareNote(n)}
                          style={{ fontSize: 10, background: n.isShared ? "#071428" : "#12142a", border: `0.5px solid ${n.isShared ? "#1e3a5a" : "#1e2140"}`, borderRadius: 6, padding: "2px 9px", color: n.isShared ? "#64b5f6" : "#4a5080", cursor: "pointer" }}
                        >
                          {n.isShared ? "👥 Shared with students" : "🔒 Private"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── EDIT QUESTION MODAL ───────────────────────────────────────── */}
      {editingQ && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && setEditingQ(null)}>
          <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2140", borderTop: "2px solid #3949ab", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px 10px", borderBottom: "0.5px solid #1e2140", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf6", flex: 1, fontFamily: "Syne,sans-serif" }}>Edit Question</div>
              <button onClick={() => setEditingQ(null)} style={{ background: "none", border: "none", color: "#4a5080", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "14px 18px 24px", display: "grid", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Question</label>
                <textarea value={editingQ.question} onChange={e => setEditingQ(q => ({ ...q, question: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["A", "B", "C", "D"].map(l => (
                  <div key={l}>
                    <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Option {l}</label>
                    <input value={editingQ[`option${l}`] || ""} onChange={e => setEditingQ(q => ({ ...q, [`option${l}`]: e.target.value }))} style={inp} />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Correct Answer</label>
                  <select value={editingQ.answerIndex} onChange={e => setEditingQ(q => ({ ...q, answerIndex: parseInt(e.target.value) }))} style={inp}>
                    {["A", "B", "C", "D"].map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Difficulty</label>
                  <select value={editingQ.difficulty} onChange={e => setEditingQ(q => ({ ...q, difficulty: e.target.value }))} style={inp}>
                    {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Year</label>
                  <input type="number" value={editingQ.year} onChange={e => setEditingQ(q => ({ ...q, year: parseInt(e.target.value) }))} style={inp} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#3949ab", display: "block", marginBottom: 4, fontWeight: 600 }}>Topic</label>
                <input value={editingQ.topic || ""} onChange={e => setEditingQ(q => ({ ...q, topic: e.target.value }))} style={inp} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: "#3949ab", fontWeight: 600 }}>Explanation</label>
                  {!editingQ.explanation && (
                    <button
                      onClick={async () => {
                        const exp = await aiExplainQuestion(editingQ);
                        if (exp) setEditingQ(q => ({ ...q, explanation: exp }));
                        else notify("AI couldn't generate an explanation", true);
                      }}
                      style={{ background: "#080d2a", border: "0.5px solid #1e2a5a", borderRadius: 6, padding: "2px 9px", fontSize: 10, color: "#9fa8da", cursor: "pointer" }}
                    >
                      🤖 AI Generate
                    </button>
                  )}
                </div>
                <textarea value={editingQ.explanation || ""} onChange={e => setEditingQ(q => ({ ...q, explanation: e.target.value }))} rows={3} placeholder="Why is the answer correct?" style={{ ...inp, resize: "vertical" }} />
              </div>
              <button onClick={saveEditedQuestion} disabled={loading} style={{ background: loading ? "#12142a" : "#1a237e", border: "0.5px solid #3949ab", borderRadius: 10, padding: "10px 16px", fontSize: 13, color: loading ? "#4a5080" : "#c5cae9", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT NOTE MODAL ───────────────────────────────────────────── */}
      {editingNote && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => e.target === e.currentTarget && setEditingNote(null)}>
          <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2140", borderRadius: 16, width: "100%", maxWidth: 520, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf6", flex: 1, fontFamily: "Syne,sans-serif" }}>Edit Note</div>
              <button onClick={() => setEditingNote(null)} style={{ background: "none", border: "none", color: "#4a5080", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <input value={editingNote.title} onChange={e => setEditingNote(n => ({ ...n, title: e.target.value }))} style={{ ...inp, marginBottom: 8 }} />
            <textarea value={editingNote.body} onChange={e => setEditingNote(n => ({ ...n, body: e.target.value }))} rows={5} style={{ ...inp, resize: "vertical", marginBottom: 8 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 11, color: "#7b82b8", cursor: "pointer" }}>
                <input type="checkbox" checked={editingNote.isShared} onChange={e => setEditingNote(n => ({ ...n, isShared: e.target.checked }))} />
                👥 Share with students
              </label>
              <button onClick={saveNote} style={{ marginLeft: "auto", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: 9, padding: "7px 16px", fontSize: 12, color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW SUBJECT MODAL ─────────────────────────────────────────── */}
      {showNewSubject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => e.target === e.currentTarget && setShowNewSubject(false)}>
          <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2140", borderRadius: 16, width: "100%", maxWidth: 420, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf6", marginBottom: 14, fontFamily: "Syne,sans-serif" }}>Create New Subject</div>
            <input value={newSubjectForm.label} onChange={e => setNewSubjectForm(f => ({ ...f, label: e.target.value }))} placeholder="Subject name (e.g. PHY-112)" style={{ ...inp, marginBottom: 8 }} />
            <textarea value={newSubjectForm.description} onChange={e => setNewSubjectForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description (optional)…" style={{ ...inp, resize: "vertical", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNewSubject(false)} style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 9, padding: "8px 14px", fontSize: 12, color: "#7b82b8", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreateSubject} disabled={loading} style={{ background: loading ? "#12142a" : "#1a237e", border: "0.5px solid #3949ab", borderRadius: 9, padding: "8px 16px", fontSize: 12, color: loading ? "#4a5080" : "#c5cae9", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}>
                {loading ? "Creating…" : "Create Subject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
