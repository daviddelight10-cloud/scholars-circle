import React, { useState, useEffect } from "react";
import { extractTextFromFile } from "../features/AITutor/fileExtract.js";

const DRAFT_STORAGE_KEY = "sc_teacher_drafts_v1";

export default function TeacherQuestionManager({ token, subjects, onSubjectsRefresh }) {
  const [mode, setMode] = useState("manual"); // manual, ai, review
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [showNewSubjectModal, setShowNewSubjectModal] = useState(false);
  const [draftQueue, setDraftQueue] = useState([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Manual entry form state
  const [manualForm, setManualForm] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    answerIndex: 0,
    difficulty: "medium",
    year: new Date().getFullYear(),
    explanation: "",
    topic: "",
  });

  // AI generation state
  const [aiText, setAiText] = useState("");
  const [aiFile, setAiFile] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  // New subject form
  const [newSubjectForm, setNewSubjectForm] = useState({
    label: "",
    description: "",
    icon: "📖",
    accent: "#3b82f6",
  });

  // Load drafts from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        setDraftQueue(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load drafts:", e);
    }
  }, []);

  // Save drafts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftQueue));
  }, [draftQueue]);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  // ─── Manual Entry ───
  function handleManualAdd() {
    if (!manualForm.question.trim() || !manualForm.optionA.trim() || !manualForm.optionB.trim()) {
      setError("Question and at least 2 options are required");
      return;
    }
    const newQ = {
      id: Date.now().toString(),
      subjectId: selectedSubjectId,
      question: manualForm.question.trim(),
      optionA: manualForm.optionA.trim(),
      optionB: manualForm.optionB.trim(),
      optionC: manualForm.optionC.trim(),
      optionD: manualForm.optionD.trim(),
      answerIndex: manualForm.answerIndex,
      difficulty: manualForm.difficulty,
      year: manualForm.year,
      explanation: manualForm.explanation.trim(),
      topic: manualForm.topic.trim(),
    };
    setDraftQueue(prev => [...prev, newQ]);
    setManualForm({
      question: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      answerIndex: 0,
      difficulty: "medium",
      year: new Date().getFullYear(),
      explanation: "",
      topic: "",
    });
    setSuccess("Question added to review queue");
    setTimeout(() => setSuccess(null), 2000);
  }

  // ─── AI Generation ───
  async function handleAIGenerate() {
    if (!selectedSubjectId) {
      setError("Please select a subject first");
      return;
    }
    if (!aiText.trim() && !aiFile) {
      setError("Please paste text or upload a file");
      return;
    }
    setAiGenerating(true);
    setError(null);

    try {
      let text = aiText.trim();
      if (aiFile) {
        const { text: extracted } = await extractTextFromFile(aiFile);
        text = extracted;
      }

      const prompt = `You are a quiz generator. Based on the following content, generate 10 multiple-choice questions (MCQs) in valid JSON format. Return ONLY a JSON array of objects, each with: "question" (string), "options" (array of 4 strings), "answer" (number 0-3, index of correct option), "difficulty" ("easy"/"medium"/"hard"), "explanation" (string), "topic" (string).

Content:
${text}`;

      const response = await fetch(`${API_BASE}/ai/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error("Failed to generate questions");

      const data = await response.json();
      let parsed;
      try {
        const raw = data.text || "";
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
      } catch {
        throw new Error("AI response was not valid JSON. Try again.");
      }
      const generated = (Array.isArray(parsed) ? parsed : []).map((q, i) => ({
        id: `ai-${Date.now()}-${i}`,
        subjectId: selectedSubjectId,
        question: q.question || q.q,
        optionA: q.options?.[0] || q.optionA,
        optionB: q.options?.[1] || q.optionB,
        optionC: q.options?.[2] || q.optionC,
        optionD: q.options?.[3] || q.optionD,
        answerIndex: q.answer !== undefined ? q.answer : q.answerIndex,
        difficulty: q.difficulty || "medium",
        year: q.year || new Date().getFullYear(),
        explanation: q.explanation || "",
        topic: q.topic || "",
      }));

      setDraftQueue(prev => [...prev, ...generated]);
      setSuccess(`Generated ${generated.length} questions`);
      setAiText("");
      setAiFile(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e.message || "Failed to generate questions");
    } finally {
      setAiGenerating(false);
    }
  }

  // ─── Draft Management ───
  function handleDeleteDraft(id) {
    setDraftQueue(prev => prev.filter(q => q.id !== id));
    setSelectedDraftIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleEditDraft(id, field, value) {
    setDraftQueue(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  function handleSelectAll() {
    if (selectedDraftIds.size === draftQueue.length) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(draftQueue.map(q => q.id)));
    }
  }

  function handleDeleteSelected() {
    setDraftQueue(prev => prev.filter(q => !selectedDraftIds.has(q.id)));
    setSelectedDraftIds(new Set());
  }

  // ─── Publish ───
  async function handlePublish() {
    if (draftQueue.length === 0) {
      setError("No questions to publish");
      return;
    }
    if (!selectedSubjectId) {
      setError("Please select a subject");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const toPublish = draftQueue.map(q => ({
        subjectId: selectedSubjectId,
        question: String(q.question || ""),
        optionA: String(q.optionA || ""),
        optionB: String(q.optionB || ""),
        optionC: String(q.optionC || ""),
        optionD: String(q.optionD || ""),
        answerIndex: parseInt(q.answerIndex, 10) || 0,
        difficulty: String(q.difficulty || "medium"),
        year: parseInt(q.year, 10) || new Date().getFullYear(),
        explanation: String(q.explanation || ""),
        topic: String(q.topic || ""),
      }));

      const response = await fetch(`${API_BASE}/questions/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: toPublish }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      setSuccess(`Published ${data.count} questions successfully!`);
      setDraftQueue([]);
      setSelectedDraftIds(new Set());
      setTimeout(() => setSuccess(null), 3000);

      // Refresh subjects so new questions appear
      if (onSubjectsRefresh) onSubjectsRefresh();
    } catch (e) {
      setError(e.message || "Failed to publish");
    } finally {
      setLoading(false);
    }
  }

  // ─── Create New Subject ───
  async function handleCreateSubject() {
    if (!newSubjectForm.label.trim()) {
      setError("Subject label is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/subjects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label: newSubjectForm.label.trim(),
          description: newSubjectForm.description.trim() || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to create subject");

      const newSubject = await response.json();
      setSuccess(`Created subject: ${newSubject.label}`);
      setShowNewSubjectModal(false);
      setNewSubjectForm({ label: "", description: "", icon: "📖", accent: "#3b82f6" });
      setSelectedSubjectId(newSubject.id);

      if (onSubjectsRefresh) onSubjectsRefresh();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e.message || "Failed to create subject");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 20, color: "#e0e7ff" }}>
        📝 Question Manager
      </h2>

      {/* Error / Success banners */}
      {error && (
        <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: "rgba(34,197,94,0.1)", color: "#4ade80", fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Subject selector */}
      <div style={{ marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            background: "rgba(30,41,59,0.8)",
            color: "#fff",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          <option value="">Select a subject...</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowNewSubjectModal(true)}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.3)",
            background: "rgba(99,102,241,0.2)",
            color: "#a5b4fc",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          + New Subject
        </button>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid rgba(99,102,241,0.2)", paddingBottom: 12 }}>
        <button
          onClick={() => setMode("manual")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: mode === "manual" ? "rgba(99,102,241,0.3)" : "transparent",
            color: mode === "manual" ? "#fff" : "#94a3b8",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setMode("ai")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: mode === "ai" ? "rgba(99,102,241,0.3)" : "transparent",
            color: mode === "ai" ? "#fff" : "#94a3b8",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          AI from File
        </button>
        <button
          onClick={() => setMode("review")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: mode === "review" ? "rgba(99,102,241,0.3)" : "transparent",
            color: mode === "review" ? "#fff" : "#94a3b8",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Review & Publish ({draftQueue.length})
        </button>
      </div>

      {/* Manual Entry Mode */}
      {mode === "manual" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Question</label>
            <textarea
              value={manualForm.question}
              onChange={(e) => setManualForm(f => ({ ...f, question: e.target.value }))}
              placeholder="Enter the question..."
              rows={2}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                background: "rgba(30,41,59,0.8)",
                color: "#fff",
                border: "1px solid rgba(99,102,241,0.3)",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {["A", "B", "C", "D"].map((letter, i) => (
              <div key={letter}>
                <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Option {letter}</label>
                <input
                  type="text"
                  value={manualForm[`option${letter}`]}
                  onChange={(e) => setManualForm(f => ({ ...f, [`option${letter}`]: e.target.value }))}
                  placeholder={`Option ${letter}`}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(30,41,59,0.8)",
                    color: "#fff",
                    border: "1px solid rgba(99,102,241,0.3)",
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Correct Answer</label>
              <select
                value={manualForm.answerIndex}
                onChange={(e) => setManualForm(f => ({ ...f, answerIndex: parseInt(e.target.value) }))}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(30,41,59,0.8)",
                  color: "#fff",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              >
                <option value={0}>A</option>
                <option value={1}>B</option>
                <option value={2}>C</option>
                <option value={3}>D</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Difficulty</label>
              <select
                value={manualForm.difficulty}
                onChange={(e) => setManualForm(f => ({ ...f, difficulty: e.target.value }))}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(30,41,59,0.8)",
                  color: "#fff",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Year</label>
              <input
                type="number"
                value={manualForm.year}
                onChange={(e) => setManualForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(30,41,59,0.8)",
                  color: "#fff",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Topic (optional)</label>
            <input
              type="text"
              value={manualForm.topic}
              onChange={(e) => setManualForm(f => ({ ...f, topic: e.target.value }))}
              placeholder="e.g., Integration, Cell Biology"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                background: "rgba(30,41,59,0.8)",
                color: "#fff",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Explanation (optional)</label>
            <textarea
              value={manualForm.explanation}
              onChange={(e) => setManualForm(f => ({ ...f, explanation: e.target.value }))}
              placeholder="Explain why the answer is correct..."
              rows={2}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                background: "rgba(30,41,59,0.8)",
                color: "#fff",
                border: "1px solid rgba(99,102,241,0.3)",
                resize: "vertical",
              }}
            />
          </div>

          <button
            onClick={handleManualAdd}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Add to Review Queue
          </button>
        </div>
      )}

      {/* AI from File Mode */}
      {mode === "ai" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Upload File (PDF, DOCX, TXT, MD)</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              onChange={(e) => setAiFile(e.target.files[0])}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                background: "rgba(30,41,59,0.8)",
                color: "#fff",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            />
            {aiFile && (
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Selected: {aiFile.name}</div>
            )}
          </div>

          <div style={{ textAlign: "center", color: "#64748b", fontSize: 12 }}>— OR —</div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Paste Text</label>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Paste lecture notes, textbook content, or any text to generate MCQs..."
              rows={8}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                background: "rgba(30,41,59,0.8)",
                color: "#fff",
                border: "1px solid rgba(99,102,241,0.3)",
                resize: "vertical",
              }}
            />
          </div>

          <button
            onClick={handleAIGenerate}
            disabled={aiGenerating}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: aiGenerating ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              cursor: aiGenerating ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {aiGenerating ? "Generating..." : "Generate Questions (AI)"}
          </button>
        </div>
      )}

      {/* Review & Publish Mode */}
      {mode === "review" && (
        <div>
          {draftQueue.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              No questions in review queue. Add questions via Manual Entry or AI from File.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={handleSelectAll}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(99,102,241,0.3)",
                    background: "rgba(30,41,59,0.8)",
                    color: "#a5b4fc",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {selectedDraftIds.size === draftQueue.length ? "Deselect All" : "Select All"}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedDraftIds.size === 0}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(239,68,68,0.3)",
                    background: selectedDraftIds.size === 0 ? "rgba(30,41,59,0.5)" : "rgba(239,68,68,0.2)",
                    color: selectedDraftIds.size === 0 ? "#64748b" : "#f87171",
                    cursor: selectedDraftIds.size === 0 ? "not-allowed" : "pointer",
                    fontSize: 12,
                  }}
                >
                  Delete Selected ({selectedDraftIds.size})
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={handlePublish}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: loading ? "rgba(34,197,94,0.5)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                    color: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {loading ? "Publishing..." : `Publish ${draftQueue.length} Questions`}
                </button>
              </div>

              <div style={{ display: "grid", gap: 12, maxHeight: 500, overflowY: "auto" }}>
                {draftQueue.map((q, i) => (
                  <div
                    key={q.id}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      background: selectedDraftIds.has(q.id) ? "rgba(99,102,241,0.15)" : "rgba(30,41,59,0.6)",
                      border: selectedDraftIds.has(q.id) ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(99,102,241,0.2)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={selectedDraftIds.has(q.id)}
                        onChange={(e) => {
                          const next = new Set(selectedDraftIds);
                          if (e.target.checked) next.add(q.id);
                          else next.delete(q.id);
                          setSelectedDraftIds(next);
                        }}
                      />
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>#{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "#e0e7ff", fontWeight: 600 }}>
                        {q.question}
                      </span>
                      <button
                        onClick={() => handleDeleteDraft(q.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(239,68,68,0.3)",
                          background: "rgba(239,68,68,0.1)",
                          color: "#f87171",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      {["A", "B", "C", "D"].map((letter, idx) => (
                        <div key={letter} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: q.answerIndex === idx ? "#4ade80" : "#94a3b8", fontWeight: q.answerIndex === idx ? 600 : 400 }}>
                            {letter}:
                          </span>
                          <input
                            type="text"
                            value={q[`option${letter}`]}
                            onChange={(e) => handleEditDraft(q.id, `option${letter}`, e.target.value)}
                            style={{
                              flex: 1,
                              padding: 6,
                              borderRadius: 4,
                              background: "rgba(15,23,42,0.8)",
                              color: "#fff",
                              border: "1px solid rgba(99,102,241,0.2)",
                              fontSize: 12,
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#94a3b8" }}>
                      <span>Difficulty: {q.difficulty}</span>
                      <span>Year: {q.year}</span>
                      {q.topic && <span>Topic: {q.topic}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* New Subject Modal */}
      {showNewSubjectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowNewSubjectModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              padding: 20,
              borderRadius: 12,
              background: "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(30,41,59,0.95))",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, color: "#e0e7ff" }}>Create New Subject</h3>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Subject Label</label>
                <input
                  type="text"
                  value={newSubjectForm.label}
                  onChange={(e) => setNewSubjectForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g., PHY-112"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(30,41,59,0.8)",
                    color: "#fff",
                    border: "1px solid rgba(99,102,241,0.3)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Description (optional)</label>
                <textarea
                  value={newSubjectForm.description}
                  onChange={(e) => setNewSubjectForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the subject..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(30,41,59,0.8)",
                    color: "#fff",
                    border: "1px solid rgba(99,102,241,0.3)",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowNewSubjectModal(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(99,102,241,0.3)",
                    background: "rgba(30,41,59,0.8)",
                    color: "#a5b4fc",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSubject}
                  disabled={loading}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {loading ? "Creating..." : "Create Subject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
