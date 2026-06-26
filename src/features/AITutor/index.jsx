import React, { useState, useMemo } from "react";
import { useAITutor } from "./useAITutor.js";
import { DISCIPLINES, getDiscipline } from "./disciplines.js";
import { ChatMode } from "./ChatMode.jsx";
import { GenerateMode } from "./GenerateMode.jsx";
import { SimpleMode } from "./SimpleMode.jsx";
import { MaterialMode } from "./MaterialMode.jsx";
import LearningRoom from "./LearningRoom.jsx";

const MODES = [
  { id: "chat", label: "Chat", icon: "💬", desc: "Ask anything" },
  { id: "learn", label: "Learn", icon: "🎬", desc: "Watch YouTube lessons + ask AI as you go" },
  { id: "material", label: "From Material", icon: "📎", desc: "Upload PDF/DOCX — summarize, learn, MCQs, flashcards" },
  { id: "generate", label: "Generate", icon: "📚", desc: "Notes, flashcards, quizzes" },
  { id: "explain", label: "Explain", icon: "🎯", desc: "Deep dive on a topic" },
  { id: "solve", label: "Solve", icon: "🧮", desc: "Step-by-step problems" },
  { id: "summarize", label: "Summarize", icon: "📑", desc: "Compress long text" },
  { id: "translate", label: "Translate", icon: "🌍", desc: "Multi-language" }
];

const FAB_TOOLS = [
  { id: "material", icon: "📎", label: "From Materials", desc: "Upload & analyze documents" },
  { id: "generate", icon: "📚", label: "Generator", desc: "Notes, flashcards, quizzes" },
  { id: "explain", icon: "🎯", label: "Explain", desc: "Deep dive on a topic" },
  { id: "solve", icon: "🧮", label: "Solve", desc: "Step-by-step solutions" },
  { id: "summarize", icon: "📑", label: "Summarize", desc: "Compress long text" },
  { id: "translate", icon: "🌍", label: "Translate", desc: "Multi-language" },
  { id: "lectures", icon: "🎓", label: "Lecture → Notes", desc: "Convert lectures to notes" },
];

const SIMPLE_MODE_CONFIG = {
  explain: {
    title: "Deep Topic Explainer",
    icon: "🎯",
    description: "Get a Feynman-style breakdown with examples, pitfalls, and self-check questions.",
    placeholder: "Topic to explain (e.g., 'How does mitosis work?')",
    rows: 2,
    buttonText: "🎯 Explain in Depth",
    loadingText: "Building explanation..."
  },
  solve: {
    title: "Step-by-Step Problem Solver",
    icon: "🧮",
    description: "Paste a math, physics, chemistry, or engineering problem. Get every step shown.",
    placeholder: "Paste your problem here. Include all given information.",
    rows: 5,
    buttonText: "🧮 Solve Step-by-Step",
    loadingText: "Solving..."
  },
  summarize: {
    title: "Smart Summarizer",
    icon: "📑",
    description: "Paste lecture notes, articles, or chapter text. Get a TL;DR + key points + terms.",
    placeholder: "Paste text to summarize...",
    rows: 8,
    buttonText: "📑 Summarize",
    loadingText: "Reading..."
  },
  translate: {
    title: "Academic Translator",
    icon: "🌍",
    description: "Translate while preserving academic register. Includes vocabulary notes.",
    placeholder: "Text to translate...",
    rows: 4,
    buttonText: "🌍 Translate",
    loadingText: "Translating..."
  }
};

export default function AITutor({
  aiConfig,
  subjects = [],
  initialSubjectId,
  studentProfile,
  onImportFlashcards,
  onImportQuestions,
  classroomDocs,
  token,
  demoMode,
  demoUsage,
  setDemoUsage,
  onNavigate
}) {
  const [mode, setMode] = useState("chat");
  const [subjectId, setSubjectId] = useState(initialSubjectId || subjects[0]?.id || "");
  const [disciplineId, setDisciplineId] = useState(studentProfile?.discipline || null);
  const [showSettings, setShowSettings] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const subject = useMemo(() => subjects.find(s => s.id === subjectId), [subjects, subjectId]);

  const tutor = useAITutor({
    aiConfig,
    subject,
    disciplineId,
    classroomDocs,
    studentProfile
  });

  const activeDiscipline = getDiscipline(tutor.discipline);

  function handleFabSelect(toolId) {
    setFabOpen(false);
    if (toolId === "lectures") {
      if (onNavigate) onNavigate("lectures");
      return;
    }
    setMode(toolId);
  }

  return (
    <div className="ai-tutor-card" style={{
      padding: 0,
      overflow: "hidden",
      background: "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))",
      border: "1px solid rgba(99,102,241,0.2)",
      borderRadius: 16
    }}>
      {/* Header */}
      <div className="ai-tutor-header" style={{
        padding: 16,
        background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))",
        borderBottom: "1px solid rgba(99,102,241,0.2)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, background: "linear-gradient(135deg, #fff, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              💬 Scholar's Circle AI
            </h2>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              Your academic chat assistant
              {subject && <> · 📖 {subject.label}</>}
            </div>
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(99,102,241,0.3)",
              background: "rgba(30,41,59,0.8)",
              color: "#a5b4fc",
              cursor: "pointer",
              fontSize: 13
            }}
          >
            ⚙️ {showSettings ? "Hide" : "Settings"}
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(15,23,42,0.6)", borderRadius: 10, display: "grid", gap: 10 }}>
            {subjects.length > 0 && (
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Subject context</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 6, background: "rgba(30,41,59,0.8)", color: "#fff", border: "1px solid rgba(99,102,241,0.3)" }}
                >
                  <option value="">— No subject —</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>Discipline (overrides auto-detect)</label>
              <select
                value={disciplineId || ""}
                onChange={(e) => setDisciplineId(e.target.value || null)}
                style={{ width: "100%", padding: 8, borderRadius: 6, background: "rgba(30,41,59,0.8)", color: "#fff", border: "1px solid rgba(99,102,241,0.3)" }}
              >
                <option value="">Auto-detect from subject</option>
                {DISCIPLINES.map(d => (
                  <option key={d.id} value={d.id}>{d.icon} {d.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                {activeDiscipline.style}
              </div>
            </div>
          </div>
        )}

        {/* Desktop Mode Tabs (hidden on mobile) */}
        <div className="ai-tutor-desktop-tabs ai-tutor-tabs" style={{ gap: 6, marginTop: 14, overflowX: "auto", paddingBottom: 4 }}>
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                flex: "0 0 auto",
                padding: "8px 14px",
                borderRadius: 8,
                border: mode === m.id ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.2)",
                background: mode === m.id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(30,41,59,0.6)",
                color: mode === m.id ? "#fff" : "#a5b4fc",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap"
              }}
              title={m.desc}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Primary Tabs (Chat / Learn) — visible on mobile only */}
      <div className="ai-tutor-primary-tabs ai-tutor-mobile-only">
        <button
          className={mode === "chat" ? "active" : ""}
          onClick={() => setMode("chat")}
        >
          💬 Chat
        </button>
        <button
          className={mode === "learn" ? "active" : ""}
          onClick={() => setMode("learn")}
        >
          🎬 Learn
        </button>
      </div>

      {/* Active mode indicator on mobile (when not chat/learn) */}
      {mode !== "chat" && mode !== "learn" && (
        <div className="ai-tutor-mobile-only" style={{ padding: "8px 16px 0" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.25)"
          }}>
            <span style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 600 }}>
              {MODES.find(m => m.id === mode)?.icon} {MODES.find(m => m.id === mode)?.label}
            </span>
            <button
              onClick={() => setMode("chat")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(99,102,241,0.3)",
                background: "rgba(30,41,59,0.8)",
                color: "#a5b4fc",
                cursor: "pointer",
                fontSize: 11
              }}
            >
              ← Back to Chat
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: 0 }}>
        {mode === "chat" && (
          <div className="ai-tutor-body-pad" style={{ padding: 16 }}>
            <ChatMode tutor={tutor} />
          </div>
        )}
        {mode === "learn" && (
          <LearningRoom tutor={tutor} subject={subject} aiConfig={aiConfig} />
        )}
        {mode === "material" && (
          <MaterialMode
            tutor={tutor}
            subject={subject}
            onImportFlashcards={onImportFlashcards}
            onImportQuestions={onImportQuestions}
          />
        )}
        {mode === "generate" && (
          <GenerateMode
            tutor={tutor}
            subject={subject}
            onImportFlashcards={onImportFlashcards}
            onImportQuestions={onImportQuestions}
          />
        )}
        {mode === "explain" && <SimpleMode tutor={tutor} mode="explain" config={SIMPLE_MODE_CONFIG.explain} />}
        {mode === "solve" && <SimpleMode tutor={tutor} mode="solve" config={SIMPLE_MODE_CONFIG.solve} />}
        {mode === "summarize" && <SimpleMode tutor={tutor} mode="summarize" config={SIMPLE_MODE_CONFIG.summarize} />}
        {mode === "translate" && <SimpleMode tutor={tutor} mode="translate" config={SIMPLE_MODE_CONFIG.translate} />}

        {tutor.error && mode !== "chat" && (
          <div style={{ margin: 16, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 13 }}>
            {tutor.error}
          </div>
        )}
      </div>

      {/* Mobile FAB (Floating Action Button) */}
      <button
        className={`ai-tutor-fab ai-tutor-mobile-only${fabOpen ? " open" : ""}`}
        onClick={() => setFabOpen(o => !o)}
        aria-label="More AI tools"
      >
        +
      </button>

      {/* FAB Popup Overlay */}
      {fabOpen && (
        <div className="ai-tutor-fab-overlay" onClick={() => setFabOpen(false)}>
          <div className="ai-tutor-fab-popup" onClick={e => e.stopPropagation()}>
            <div className="ai-tutor-fab-popup-header">
              <h3>✨ AI Tools</h3>
              <button className="ai-tutor-fab-popup-close" onClick={() => setFabOpen(false)}>✕</button>
            </div>
            <div className="ai-tutor-fab-grid">
              {FAB_TOOLS.map(tool => (
                <button key={tool.id} onClick={() => handleFabSelect(tool.id)}>
                  <span className="fab-tool-icon">{tool.icon}</span>
                  <span className="fab-tool-label">{tool.label}</span>
                  <span className="fab-tool-desc">{tool.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
