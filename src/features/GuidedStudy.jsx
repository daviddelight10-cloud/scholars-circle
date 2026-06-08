import React, { useState, useEffect, useRef } from "react";
import { callAI } from "../lib/aiClient";

// ─── Session history helpers ────────────────────────────────────────────────────
const SESSIONS_KEY = "sc_guided_sessions";
function loadSessions() { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]"); } catch { return []; } }
function saveSession(entry) {
  try {
    const sessions = loadSessions().filter(s => s.topic !== entry.topic).slice(0, 19);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([entry, ...sessions]));
  } catch {}
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:     "#07080F",
  card:   "#0d0f1f",
  bar:    "#0a0b15",
  accent: "#1a237e",
  border: "#3949ab",
  line:   "#1e2140",
  line2:  "#1a1d35",
  text:   "#e8eaf6",
  muted:  "#7b82b8",
  hint:   "#4a5080",
  faint:  "#2a2d50",
};

const STYLES = `
  @keyframes gs-spin { to { transform: rotate(360deg); } }
  @keyframes gs-slide-in { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
  .gs-history-panel { animation: gs-slide-in 0.25s ease; }
  @keyframes gs-in   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes gs-pop  { 0%{transform:scale(0.95);opacity:0} 100%{transform:scale(1);opacity:1} }
  .gs-animate { animation: gs-in 0.3s ease forwards; }
  .gs-pop     { animation: gs-pop 0.25s ease forwards; }
`;

// ─── AI helpers ────────────────────────────────────────────────────────────────
function extractJSON(text) {
  try { const s = text.indexOf("{"), e = text.lastIndexOf("}") + 1; if (s !== -1) return JSON.parse(text.slice(s, e)); } catch {}
  try { const s = text.indexOf("["), e = text.lastIndexOf("]") + 1; if (s !== -1) return JSON.parse(text.slice(s, e)); } catch {}
  return null;
}

async function aiRoadmap(topic, aiConfig) {
  const raw = await callAI(
    `You are an expert educator. Generate a structured learning roadmap for: "${topic}"
Reply ONLY with valid JSON (no markdown):
{"title":"topic title","description":"2-sentence engaging overview of what the student will learn","sections":[{"id":1,"title":"Section title","summary":"1 sentence describing what this covers"},{"id":2,"title":"...","summary":"..."}]}
Include 5-7 sections, from fundamentals to advanced. Keep summaries under 12 words.`,
    aiConfig
  );
  return extractJSON(raw);
}

async function aiExplain(topic, section, aiConfig) {
  return await callAI(
    `You are an expert tutor teaching "${topic}". Explain this section thoroughly: "${section.title}"
Write 4-5 paragraphs covering: core concept + clear definition, how it works with a concrete example, real-world relevance, connection to "${topic}".
Plain text only — no markdown headers or bullet symbols.`,
    aiConfig
  );
}

async function aiQuestion(topic, section, explanation, aiConfig) {
  const raw = await callAI(
    `Based on an explanation of "${section.title}" (part of "${topic}"), generate ONE deep comprehension question that tests understanding, not just recall.
Reply ONLY with valid JSON: {"question":"...","hint":"a subtle clue — do not give the answer"}`,
    aiConfig
  );
  return extractJSON(raw);
}

async function aiEvaluate(topic, section, question, answer, aiConfig) {
  return await callAI(
    `Topic: "${topic}" — Section: "${section.title}"
Question: "${question}"
Student answer: "${answer}"
Give 2-3 sentences of constructive feedback. Note what was correct, what was missing, and reinforce the key concept. Be encouraging.`,
    aiConfig
  );
}

async function aiFlashcards(topic, sections, aiConfig) {
  const raw = await callAI(
    `Create flashcards for "${topic}" covering these sections: ${sections.map(s => s.title).join(", ")}.
Reply ONLY with a valid JSON array:
[{"front":"Term or question (concise)","back":"Definition or answer (concise)"},...]
Include 8-12 cards. Mix: term definitions, process steps, application questions. Keep each card under 25 words per side.`,
    aiConfig
  );
  const result = extractJSON(raw);
  return Array.isArray(result) ? result : [];
}

// ─── Shared UI pieces ──────────────────────────────────────────────────────────
function Spinner({ message }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"40px 20px" }}>
      <div style={{
        width:34, height:34, borderRadius:"50%",
        border:`3px solid ${D.line}`, borderTopColor: D.border,
        animation:"gs-spin 0.75s linear infinite",
      }} />
      {message && <span style={{ fontSize:12, color:D.muted, fontFamily:"Manrope,sans-serif", textAlign:"center" }}>{message}</span>}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: extra }) {
  const base = {
    display:"inline-flex", alignItems:"center", gap:6,
    padding:"8px 16px", borderRadius:20, cursor: disabled ? "not-allowed" : "pointer",
    fontSize:12, fontWeight:600, fontFamily:"Manrope,sans-serif",
    transition:"filter 0.15s, transform 0.15s", opacity: disabled ? 0.5 : 1,
    ...extra,
  };
  const variants = {
    primary:  { background: D.accent, border:`0.5px solid ${D.border}`, color:"#c5cae9" },
    ghost:    { background:"transparent", border:`0.5px solid ${D.line}`, color:D.muted },
    red:      { background:"#1a0808", border:"0.5px solid #4a1010", color:"#ef9a9a" },
    green:    { background:"#0a1f10", border:"0.5px solid #1a4a25", color:"#81c784" },
    yellow:   { background:"#1f1000", border:"0.5px solid #4a2a00", color:"#ffb74d" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.filter="brightness(1.18)"; e.currentTarget.style.transform="translateY(-1px)"; }}}
      onMouseLeave={e => { e.currentTarget.style.filter=""; e.currentTarget.style.transform=""; }}
    >{children}</button>
  );
}

// ─── Roadmap Section Card ──────────────────────────────────────────────────────
function SectionCard({ section, index, studied, onStudy }) {
  return (
    <div className="gs-animate" style={{
      display:"flex", alignItems:"center", gap:12,
      padding:"11px 14px",
      background: studied ? "#0b1628" : D.card,
      border:`0.5px solid ${studied ? "#1e3a6a" : D.line}`,
      borderRadius:13, marginBottom:8, transition:"border-color 0.2s",
    }}>
      <div style={{
        width:28, height:28, borderRadius:"50%", flexShrink:0,
        background: studied ? D.accent : D.faint,
        border:`0.5px solid ${studied ? D.border : "#2a2d4a"}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:11, fontWeight:700,
        color: studied ? "#c5cae9" : D.muted,
        fontFamily:"Manrope,sans-serif",
      }}>
        {studied ? "✓" : index + 1}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:D.text, fontFamily:"Manrope,sans-serif" }}>{section.title}</div>
        <div style={{ fontSize:11, color:D.muted, marginTop:2, fontFamily:"Manrope,sans-serif" }}>{section.summary}</div>
      </div>

      <Btn onClick={() => onStudy(section)} variant={studied ? "ghost" : "primary"} style={{ flexShrink:0 }}>
        {studied ? "Review" : "Study →"}
      </Btn>
    </div>
  );
}

// ─── Flip Card ─────────────────────────────────────────────────────────────────
function FlipCard({ card, flipped, onFlip }) {
  return (
    <div onClick={onFlip} style={{ cursor:"pointer", perspective:900, minHeight:170 }}>
      <div style={{
        position:"relative", width:"100%", minHeight:170,
        transformStyle:"preserve-3d",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
        transition:"transform 0.4s ease",
      }}>
        {/* Front */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          background:"#0d1235", border:`0.5px solid ${D.border}`,
          borderRadius:16, padding:"22px 18px",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center",
        }}>
          <div style={{ fontSize:9, color:D.hint, marginBottom:10, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"Manrope,sans-serif" }}>QUESTION / TERM</div>
          <div style={{ fontSize:14, fontWeight:600, color:"#c5cae9", lineHeight:1.55, fontFamily:"Manrope,sans-serif" }}>{card.front}</div>
          <div style={{ fontSize:9, color:D.hint, marginTop:14, fontFamily:"Manrope,sans-serif" }}>tap to reveal ↩</div>
        </div>
        {/* Back */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          transform:"rotateY(180deg)",
          background:"#0b1e3a", border:"0.5px solid #3a5a9a",
          borderRadius:16, padding:"22px 18px",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center",
        }}>
          <div style={{ fontSize:9, color:"#3a6a9a", marginBottom:10, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"Manrope,sans-serif" }}>ANSWER</div>
          <div style={{ fontSize:13, color:"#90caf9", lineHeight:1.6, fontFamily:"Manrope,sans-serif" }}>{card.back}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:10, color:D.muted, fontFamily:"Manrope,sans-serif" }}>Progress</span>
        <span style={{ fontSize:10, color:D.border, fontFamily:"Manrope,sans-serif", fontWeight:600 }}>{current}/{total} sections</span>
      </div>
      <div style={{ height:4, background:D.faint, borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg, ${D.border}, #7986cb)`, borderRadius:4, transition:"width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
const LAUNCH_MSGS = {
  "auto-roadmap": "Building your learning roadmap\u2026",
  "flashcards":   "Generating flashcards\u2026",
  "explain":      "Building roadmap and explanation\u2026",
  "quiz":         "Building roadmap and preparing quiz\u2026",
};

export default function GuidedStudy({ aiConfig, initialTopic = "", startMode = "input", initialAttachment = null }) {
  const isAutoLaunch = !!(initialTopic.trim() && startMode !== "input");
  const [phase, setPhase]               = useState("input");
  const [topic, setTopic]               = useState(initialTopic);
  const [pastedContent, setPasted]      = useState("");
  const [showPaste, setShowPaste]       = useState(false);
  const [roadmap, setRoadmap]           = useState(null);
  const [studied, setStudied]           = useState(new Set());
  const [activeSection, setActive]      = useState(null);
  const [explanation, setExplanation]   = useState("");
  const [qData, setQData]               = useState(null);   // {question, hint}
  const [userAnswer, setUserAnswer]     = useState("");
  const [feedback, setFeedback]         = useState("");
  const [flashcards, setFlashcards]     = useState([]);
  const [cardIdx, setCardIdx]           = useState(0);
  const [cardFlipped, setFlipped]       = useState(false);
  const [loading, setLoading]           = useState(isAutoLaunch);
  const [loadingMsg, setLoadingMsg]     = useState(isAutoLaunch ? (LAUNCH_MSGS[startMode] || "Working\u2026") : "");
  const [autoError, setAutoError]       = useState("");
  const [sectionStep, setSectionStep]   = useState("explain"); // explain | question | feedback
  const [attachment, setAttachment]     = useState(initialAttachment);
  const [isOnline, setIsOnline]         = useState(navigator.onLine);
  const [showHistory, setShowHistory]   = useState(false);
  const [sessions, setSessions]         = useState(() => loadSessions());
  const mountedRef                      = useRef(true);

  // ── Online/offline listener ──
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => { mountedRef.current = false; window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // ── Auto-launch when startMode is provided with a topic ──
  useEffect(() => {
    if (!initialTopic.trim() || startMode === "input") return;
    const topicStr = attachment?.content
      ? `${initialTopic}\n\nContext provided by student:\n${attachment.content.slice(0, 2000)}`
      : initialTopic;
    if (startMode === "auto-roadmap") {
      autoRoadmap(topicStr);
    } else if (startMode === "flashcards") {
      autoFlashcards(topicStr);
    } else if (startMode === "explain" || startMode === "quiz") {
      autoExplain(topicStr, startMode);
    }
  // eslint-disable-next-line
  }, []);

  function offlineCheck() {
    if (!navigator.onLine) { setAutoError("You're offline \u2014 please reconnect to use AI features."); return true; }
    return false;
  }

  async function autoRoadmap(topicStr) {
    if (offlineCheck()) return;
    setAutoError(""); setLoading(true); setLoadingMsg("Building your learning roadmap\u2026");
    try {
      const result = await aiRoadmap(topicStr, aiConfig);
      if (result?.sections?.length) {
        setRoadmap(result); setStudied(new Set()); setPhase("roadmap");
        const entry = { topic: initialTopic || topicStr, date: new Date().toISOString(), sections: result.sections.map(s => s.title) };
        saveSession(entry); setSessions(loadSessions());
      } else setAutoError("Couldn't parse the roadmap \u2014 please try again.");
    } catch (e) {
      setAutoError("AI request failed: " + (e?.message || "check your connection"));
    } finally { setLoading(false); }
  }

  async function autoFlashcards(topicStr) {
    if (offlineCheck()) return;
    setAutoError(""); setFlashcards([]); setCardIdx(0); setFlipped(false);
    setPhase("flashcards"); setLoading(true); setLoadingMsg("Generating flashcards\u2026");
    try {
      const fakeSection = [{ id: 1, title: initialTopic }];
      const cards = await aiFlashcards(initialTopic, fakeSection, aiConfig);
      if (cards?.length) setFlashcards(cards);
      else setAutoError("Couldn't generate flashcards \u2014 please try again.");
    } catch (e) {
      setAutoError("AI request failed: " + (e?.message || "check your connection"));
    } finally { setLoading(false); }
  }

  async function autoExplain(topicStr, mode) {
    if (offlineCheck()) return;
    setAutoError(""); setLoading(true); setLoadingMsg("Building roadmap\u2026");
    try {
      const result = await aiRoadmap(topicStr, aiConfig);
      if (!result?.sections?.length) { setAutoError("Couldn't build a roadmap \u2014 please try again."); return; }
      setRoadmap(result); setStudied(new Set());
      const firstSection = result.sections[0];
      setActive(firstSection); setSectionStep("explain"); setPhase("section");
      setLoadingMsg("Generating explanation\u2026");
      const text = await aiExplain(initialTopic, firstSection, aiConfig);
      setExplanation(text);
      setStudied(new Set([firstSection.id]));
      if (mode === "quiz") {
        setSectionStep("question");
        setLoadingMsg("Generating a comprehension question\u2026");
        const q = await aiQuestion(initialTopic, firstSection, text, aiConfig);
        setQData(q);
      }
    } catch (e) {
      setAutoError("AI request failed: " + (e?.message || "check your connection"));
    } finally { setLoading(false); }
  }

  // ── Handlers ──
  async function handleRoadmap() {
    if (!topic.trim()) return;
    if (offlineCheck()) return;
    setLoading(true); setLoadingMsg("Building your learning roadmap…");
    try {
      const fullTopic = pastedContent.trim()
        ? `${topic}\n\nContext provided by student:\n${pastedContent.slice(0, 2000)}`
        : topic;
      const result = await aiRoadmap(fullTopic, aiConfig);
      if (result?.sections?.length) {
        setRoadmap(result);
        setStudied(new Set());
        setPhase("roadmap");
        const entry = { topic: topic, date: new Date().toISOString(), sections: result.sections.map(s => s.title) };
        saveSession(entry); setSessions(loadSessions());
      }
    } finally { setLoading(false); }
  }

  async function handleStudy(section) {
    setActive(section);
    setSectionStep("explain");
    setExplanation(""); setQData(null); setUserAnswer(""); setFeedback("");
    setPhase("section");
    setLoading(true); setLoadingMsg("Generating explanation…");
    try {
      const text = await aiExplain(topic, section, aiConfig);
      setExplanation(text);
      setStudied(prev => new Set([...prev, section.id]));
    } finally { setLoading(false); }
  }

  async function handleAskQuestion() {
    setSectionStep("question");
    setLoading(true); setLoadingMsg("Generating a comprehension question…");
    try {
      const q = await aiQuestion(topic, activeSection, explanation, aiConfig);
      setQData(q);
    } finally { setLoading(false); }
  }

  async function handleSubmitAnswer() {
    if (!userAnswer.trim()) return;
    setSectionStep("feedback");
    setLoading(true); setLoadingMsg("Evaluating your answer…");
    try {
      const fb = await aiEvaluate(topic, activeSection, qData.question, userAnswer, aiConfig);
      setFeedback(fb);
    } finally { setLoading(false); }
  }

  async function handleFlashcards(sections) {
    setFlashcards([]); setCardIdx(0); setFlipped(false);
    setPhase("flashcards");
    setLoading(true); setLoadingMsg("Generating flashcards…");
    try {
      const cards = await aiFlashcards(topic, sections || roadmap?.sections || [], aiConfig);
      setFlashcards(cards);
    } finally { setLoading(false); }
  }

  function nextSection() {
    if (!roadmap) return;
    const ids = roadmap.sections.map(s => s.id);
    const currentIdx = ids.indexOf(activeSection?.id);
    const next = roadmap.sections[currentIdx + 1];
    if (next) handleStudy(next);
    else setPhase("roadmap");
  }

  // ── Common wrapper ──
  const wrap = (children) => (
    <div style={{ flex:1, overflowY:"auto", padding:"16px 14px 20px", scrollbarWidth:"none" }}>
      {children}
    </div>
  );

  const card = (children, extra) => (
    <div className="gs-animate" style={{
      background:D.card, border:`0.5px solid ${D.line}`,
      borderRadius:16, padding:"14px 16px", marginBottom:12, ...extra,
    }}>{children}</div>
  );

  // ── INPUT PHASE (or auto-loading) ──
  if (phase === "input" && loading) return wrap(<><style>{STYLES}</style><Spinner message={loadingMsg} /></>);

  if (phase === "input") return wrap(
    <>
      <style>{STYLES}</style>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          background:"#1a1000", border:"0.5px solid #f57c00", borderRadius:12,
          padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{ fontSize:16 }}>📶</span>
          <span style={{ fontSize:12, color:"#ffb74d", fontFamily:"Manrope,sans-serif" }}>You're offline — please reconnect to use AI features.</span>
        </div>
      )}

      {/* Auto-error banner */}
      {autoError && (
        <div style={{
          background:"#1a0a0a", border:"0.5px solid #e53935", borderRadius:12,
          padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <span style={{ fontSize:12, color:"#ef9a9a", fontFamily:"Manrope,sans-serif", flex:1 }}>{autoError}</span>
          <button
            onClick={() => { setAutoError(""); isAutoLaunch && (topic.trim() ? handleRoadmap() : null); }}
            style={{ background:"#e53935", border:"none", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#fff", cursor:"pointer", fontFamily:"Manrope,sans-serif", fontWeight:600 }}
          >Retry</button>
        </div>
      )}

      {/* Hero */}
      <div style={{ textAlign:"center", padding:"24px 0 20px" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🧠</div>
        <div style={{ fontSize:18, fontWeight:700, color:D.text, fontFamily:"Syne,sans-serif", marginBottom:6 }}>
          Guided Study
        </div>
        <div style={{ fontSize:12, color:D.muted, fontFamily:"Manrope,sans-serif", lineHeight:1.6 }}>
          Enter a topic and I'll build a personalized learning roadmap,<br/>
          explain each section, test your understanding, and generate flashcards.
        </div>
      </div>

      {/* Topic input */}
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !loading && handleRoadmap()}
        placeholder="e.g. Photosynthesis, Recursion, The French Revolution…"
        style={{
          width:"100%", boxSizing:"border-box",
          background:"#0a0c1e", border:`0.5px solid ${D.line}`,
          borderRadius:14, padding:"12px 16px", fontSize:13,
          color:D.text, fontFamily:"Manrope,sans-serif", outline:"none",
          marginBottom:10, transition:"border-color 0.2s",
        }}
        onFocus={e => e.target.style.borderColor = D.border}
        onBlur={e  => e.target.style.borderColor = D.line}
      />

      {/* Paste toggle */}
      <button
        onClick={() => setShowPaste(o => !o)}
        style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif", marginBottom:8, padding:0 }}
      >
        {showPaste ? "▾ Hide content paste" : "▸ Paste notes / content (optional)"}
      </button>

      {showPaste && (
        <textarea
          value={pastedContent}
          onChange={e => setPasted(e.target.value)}
          placeholder="Paste your lecture notes, textbook excerpts, or any content here…"
          rows={5}
          style={{
            width:"100%", boxSizing:"border-box", resize:"vertical",
            background:"#0a0c1e", border:`0.5px solid ${D.line}`,
            borderRadius:12, padding:"10px 14px", fontSize:12,
            color:D.muted, fontFamily:"Manrope,sans-serif", outline:"none",
            marginBottom:10,
          }}
        />
      )}

      <Btn onClick={handleRoadmap} disabled={!topic.trim() || loading || !isOnline} style={{ width:"100%", justifyContent:"center", padding:"11px 16px" }}>
        {loading ? <Spinner message="" /> : "Generate Learning Roadmap →"}
      </Btn>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div style={{ marginTop:16 }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{ background:"none", border:`0.5px solid ${D.line}`, borderRadius:10, padding:"7px 14px", cursor:"pointer", fontSize:11, color:D.muted, fontFamily:"Manrope,sans-serif", display:"flex", alignItems:"center", gap:6 }}
          >
            📂 Recent Sessions ({sessions.length})
            <span style={{ fontSize:9 }}>{showHistory ? "▲" : "▼"}</span>
          </button>
          {showHistory && (
            <div className="gs-history-panel" style={{
              marginTop:8, background:D.card, border:`0.5px solid ${D.line}`,
              borderRadius:14, overflow:"hidden",
            }}>
              {sessions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => { setTopic(s.topic); setShowHistory(false); }}
                  style={{
                    padding:"10px 14px", borderBottom: i < sessions.length-1 ? `0.5px solid ${D.line}` : "none",
                    cursor:"pointer", display:"flex", flexDirection:"column", gap:3,
                    transition:"background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = D.faint}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ fontSize:12, fontWeight:600, color:D.text, fontFamily:"Manrope,sans-serif" }}>{s.topic}</div>
                  <div style={{ fontSize:10, color:D.hint, fontFamily:"Manrope,sans-serif" }}>
                    {new Date(s.date).toLocaleDateString(undefined,{month:"short",day:"numeric"})} · {s.sections?.length || 0} sections
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <Spinner message={loadingMsg} />}

      {/* How it works */}
      {card(
        <>
          <div style={{ fontSize:11, fontWeight:700, color:D.border, fontFamily:"Syne,sans-serif", marginBottom:10, letterSpacing:"0.06em" }}>HOW IT WORKS</div>
          {[
            ["📋", "Roadmap",    "AI builds a structured outline of 5-7 sections"],
            ["📖", "Explain",    "Deep explanation of each section with examples"],
            ["🎯", "Questions",  "Socratic questions to test your comprehension"],
            ["🃏", "Flashcards", "Auto-generated flashcards from the whole topic"],
          ].map(([icon, label, desc]) => (
            <div key={label} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
              <div>
                <span style={{ fontSize:12, fontWeight:600, color:D.text, fontFamily:"Manrope,sans-serif" }}>{label} </span>
                <span style={{ fontSize:11, color:D.muted, fontFamily:"Manrope,sans-serif" }}>— {desc}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );

  // ── ROADMAP PHASE ──
  if (phase === "roadmap" && roadmap) return wrap(
    <>
      <style>{STYLES}</style>

      <ProgressBar current={studied.size} total={roadmap.sections.length} />

      {card(
        <>
          <div style={{ fontSize:16, fontWeight:700, color:D.text, fontFamily:"Syne,sans-serif", marginBottom:5 }}>
            📋 {roadmap.title}
          </div>
          <div style={{ fontSize:12, color:D.muted, lineHeight:1.6, fontFamily:"Manrope,sans-serif" }}>
            {roadmap.description}
          </div>
        </>
      )}

      {roadmap.sections.map((s, i) => (
        <SectionCard key={s.id} section={s} index={i} studied={studied.has(s.id)} onStudy={handleStudy} />
      ))}

      <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
        <Btn variant="yellow" onClick={() => handleFlashcards(roadmap.sections)}>🃏 Generate all flashcards</Btn>
        <Btn variant="ghost" onClick={() => { setPhase("input"); setRoadmap(null); }}>← New topic</Btn>
      </div>
    </>
  );

  // ── SECTION PHASE ──
  if (phase === "section" && activeSection) return wrap(
    <>
      <style>{STYLES}</style>

      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <Btn variant="ghost" onClick={() => setPhase("roadmap")}>← Roadmap</Btn>
        <span style={{ fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif" }}>
          {roadmap?.sections.findIndex(s => s.id === activeSection.id) + 1} / {roadmap?.sections.length}
        </span>
      </div>

      {/* Section header */}
      {card(
        <div style={{ fontSize:15, fontWeight:700, color:D.text, fontFamily:"Syne,sans-serif" }}>
          📖 {activeSection.title}
        </div>
      )}

      {/* ── Explain step ── */}
      {sectionStep === "explain" && (
        <>
          {loading ? <Spinner message={loadingMsg} /> : (
            explanation && (
              <div className="gs-animate" style={{
                background:D.card, border:`0.5px solid ${D.line}`,
                borderRadius:16, padding:"16px",
                fontSize:13, color:"#c5cae9", lineHeight:1.8,
                fontFamily:"Manrope,sans-serif", marginBottom:12, whiteSpace:"pre-wrap",
              }}>
                {explanation}
              </div>
            )
          )}
          {explanation && !loading && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <Btn onClick={handleAskQuestion}>🎯 Test my understanding</Btn>
              <Btn variant="yellow" onClick={() => handleFlashcards([activeSection])}>🃏 Flashcards for this section</Btn>
              <Btn variant="ghost" onClick={nextSection}>Next section →</Btn>
            </div>
          )}
        </>
      )}

      {/* ── Question step ── */}
      {sectionStep === "question" && (
        <>
          {loading ? <Spinner message={loadingMsg} /> : qData && (
            <>
              {card(
                <>
                  <div style={{ fontSize:10, color:D.border, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"Manrope,sans-serif", marginBottom:8 }}>
                    🎯 COMPREHENSION CHECK
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, color:D.text, lineHeight:1.6, fontFamily:"Manrope,sans-serif" }}>
                    {qData.question}
                  </div>
                  {qData.hint && (
                    <div style={{ marginTop:10, fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif" }}>
                      💡 Hint: {qData.hint}
                    </div>
                  )}
                </>
              )}
              <textarea
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder="Type your answer here…"
                rows={4}
                style={{
                  width:"100%", boxSizing:"border-box", resize:"vertical",
                  background:"#0a0c1e", border:`0.5px solid ${D.line}`,
                  borderRadius:13, padding:"11px 14px", fontSize:12,
                  color:D.text, fontFamily:"Manrope,sans-serif",
                  outline:"none", marginBottom:10,
                }}
                onFocus={e => e.target.style.borderColor = D.border}
                onBlur={e  => e.target.style.borderColor = D.line}
              />
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <Btn onClick={handleSubmitAnswer} disabled={!userAnswer.trim()}>Submit answer →</Btn>
                <Btn variant="ghost" onClick={() => setSectionStep("explain")}>← Back to explanation</Btn>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Feedback step ── */}
      {sectionStep === "feedback" && (
        <>
          {loading ? <Spinner message={loadingMsg} /> : feedback && (
            <>
              {card(
                <>
                  <div style={{ fontSize:10, color:D.hint, fontFamily:"Manrope,sans-serif", marginBottom:6 }}>Your answer:</div>
                  <div style={{ fontSize:12, color:D.muted, fontFamily:"Manrope,sans-serif", fontStyle:"italic", marginBottom:12 }}>"{userAnswer}"</div>
                  <div style={{ fontSize:10, color:"#81c784", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"Manrope,sans-serif", marginBottom:8 }}>
                    ✦ AI Feedback
                  </div>
                  <div style={{ fontSize:13, color:"#c8e6c9", lineHeight:1.7, fontFamily:"Manrope,sans-serif" }}>
                    {feedback}
                  </div>
                </>,
                { border:"0.5px solid #1a4a25" }
              )}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <Btn variant="green" onClick={nextSection}>Next section →</Btn>
                <Btn variant="ghost" onClick={() => setPhase("roadmap")}>Back to roadmap</Btn>
                <Btn variant="yellow" onClick={() => handleFlashcards([activeSection])}>🃏 Flashcards</Btn>
              </div>
            </>
          )}
        </>
      )}
    </>
  );

  // ── FLASHCARDS PHASE ──
  if (phase === "flashcards") return wrap(
    <>
      <style>{STYLES}</style>

      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center", justifyContent:"space-between" }}>
        <Btn variant="ghost" onClick={() => setPhase(roadmap ? "roadmap" : "input")}>← Back</Btn>
        <span style={{ fontSize:11, color:D.muted, fontFamily:"Manrope,sans-serif" }}>
          🃏 {flashcards.length > 0 ? `${cardIdx + 1} / ${flashcards.length}` : ""}
        </span>
      </div>

      {loading ? <Spinner message={loadingMsg} /> : (
        flashcards.length > 0 ? (
          <>
            <FlipCard card={flashcards[cardIdx]} flipped={cardFlipped} onFlip={() => setFlipped(f => !f)} />

            <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"center", alignItems:"center" }}>
              <Btn variant="ghost" disabled={cardIdx === 0}
                onClick={() => { setCardIdx(i => i - 1); setFlipped(false); }}>
                ◀ Prev
              </Btn>
              <span style={{ fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif", minWidth:60, textAlign:"center" }}>
                {cardIdx + 1} of {flashcards.length}
              </span>
              <Btn variant="ghost" disabled={cardIdx === flashcards.length - 1}
                onClick={() => { setCardIdx(i => i + 1); setFlipped(false); }}>
                Next ▶
              </Btn>
            </div>

            {/* Progress dots */}
            <div style={{ display:"flex", gap:4, justifyContent:"center", marginTop:12, flexWrap:"wrap" }}>
              {flashcards.map((_, i) => (
                <div key={i}
                  onClick={() => { setCardIdx(i); setFlipped(false); }}
                  style={{
                    width:7, height:7, borderRadius:"50%", cursor:"pointer",
                    background: i === cardIdx ? D.border : D.faint,
                    transition:"background 0.2s",
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:32, fontSize:12, color:D.hint, fontFamily:"Manrope,sans-serif" }}>
            No flashcards generated. Try again.
          </div>
        )
      )}
    </>
  );

  return null;
}
