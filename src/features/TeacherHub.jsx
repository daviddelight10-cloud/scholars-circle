import React, { useState, useEffect } from "react";
import { extractTextFromFile } from "./AITutor/fileExtract.js";
import { callAI, extractJSON } from "../lib/aiClient.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const SUBJECTS = ["Biology","Chemistry","Physics","Mathematics","Anatomy","Physiology","Pharmacology","GST","Other"];
const SUB_COLOR = {
  Biology:"#22C55E", Chemistry:"#F5A623", Physics:"#FFD700", Mathematics:"#6C63FF",
  Anatomy:"#14B8A6", Physiology:"#F97316", Pharmacology:"#DAA520", GST:"#EC4899", Other:"#6B7280"
};
const OPTS = ["A","B","C","D"];

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onCopy, copied }) {
  const [open, setOpen] = useState(false);
  const c = SUB_COLOR[note.subject] || "#888";
  return (
    <div className="card fade" style={{ padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1 }}>
          <span className="pill" style={{ background:`${c}15`, color:c, border:`1px solid ${c}30`, marginBottom:10 }}>{note.subject}</span>
          <div className="syne" style={{ fontWeight:700, fontSize:15, color:"#E8E9F0", marginTop:8 }}>{note.title}</div>
        </div>
        <div style={{ display:"flex", gap:7, flexShrink:0 }}>
          <button className="btn btn-ghost btn-xs" onClick={() => onCopy(note)}>
            {copied === note.id ? "✓" : "Share"}
          </button>
          <button className="btn btn-xs" onClick={() => setOpen(p => !p)}>
            {open ? "▲" : "▼ Read"}
          </button>
        </div>
      </div>
      {open && (
        <div className="fade" style={{ borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:14, paddingTop:14,
          fontSize:13.5, lineHeight:1.85, color:"#9899A6", whiteSpace:"pre-wrap", fontFamily:"'Manrope',sans-serif" }}>
          {note.content}
        </div>
      )}
    </div>
  );
}

// ── Quiz Modal ─────────────────────────────────────────────────────────────────
function QuizModal({ q, onClose, onShare, shared }) {
  const [sel, setSel] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const c = SUB_COLOR[q.subject] || "#888";
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade">
        {/* Modal header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div>
            <span className="pill" style={{ background:`${c}15`, color:c, border:`1px solid ${c}30` }}>{q.subject}</span>
            <div style={{ fontSize:10, color:"#444", fontFamily:"'Syne',sans-serif", marginTop:6, letterSpacing:"0.08em" }}>ID: {q.id}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#777", borderRadius:8, width:30, height:30, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        {/* Question */}
        <div className="syne" style={{ fontWeight:700, fontSize:16.5, lineHeight:1.55, marginBottom:22, color:"#E8E9F0" }}>
          {q.question}
        </div>

        {/* Options */}
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:20 }}>
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct;
            const isSelected = i === sel;
            let bg = "rgba(255,255,255,0.03)", border = "rgba(255,255,255,0.08)", color = "#C0C1CC", dotBorder = "rgba(255,255,255,0.15)", dotColor = "#666";
            if (revealed) {
              if (isCorrect)        { bg="rgba(34,197,94,0.09)"; border="rgba(34,197,94,0.4)"; color="#22C55E"; dotBorder="#22C55E"; dotColor="#22C55E"; }
              else if (isSelected)  { bg="rgba(239,68,68,0.07)"; border="rgba(239,68,68,0.35)"; color="#EF4444"; dotBorder="#EF4444"; dotColor="#EF4444"; }
            } else if (isSelected)  { bg="rgba(79,142,247,0.1)"; border="rgba(79,142,247,0.4)"; color="#E8E9F0"; dotBorder="#FFD700"; dotColor="#FFD700"; }
            return (
              <button key={i} disabled={revealed} onClick={() => setSel(i)}
                style={{ width:"100%", textAlign:"left", background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 14px", color, fontFamily:"'Manrope',sans-serif", fontSize:13.5, cursor:revealed?"default":"pointer", display:"flex", gap:12, alignItems:"center", transition:"all 0.18s" }}>
                <div style={{ width:26, height:26, borderRadius:"50%", border:`2px solid ${dotBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, flexShrink:0, color:dotColor }}>
                  {revealed && isCorrect ? "✓" : revealed && isSelected && !isCorrect ? "✗" : OPTS[i]}
                </div>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {revealed && q.explanation && (
          <div className="fade" style={{ background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.18)", borderRadius:10, padding:"13px 15px", marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#22C55E", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"0.1em", marginBottom:7 }}>EXPLANATION</div>
            <div style={{ fontSize:13.5, color:"#9899A6", lineHeight:1.7, fontFamily:"'Manrope',sans-serif" }}>{q.explanation}</div>
          </div>
        )}

        {/* Result banner */}
        {revealed && (
          <div className="fade" style={{ textAlign:"center", marginBottom:16, fontSize:14, fontFamily:"'Syne',sans-serif", fontWeight:700, color: sel === q.correct ? "#22C55E" : "#EF4444" }}>
            {sel === q.correct ? "🎉 Correct!" : `❌ Incorrect — Answer was ${OPTS[q.correct]}`}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:"flex", gap:9 }}>
          {!revealed
            ? <button className="btn" onClick={() => setRevealed(true)} disabled={sel === null} style={{ flex:1 }}>Submit Answer</button>
            : <button className="btn btn-ghost" onClick={() => { setSel(null); setRevealed(false); }} style={{ flex:1 }}>Try Again</button>
          }
          <button className="btn btn-gold btn-sm" onClick={() => onShare(q)}>
            {shared === q.id ? "✓ Copied!" : "📤 Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TeacherHub({ token, auth }) {
  const [mainTab, setMainTab] = useState("resources"); // resources | admin | pricing
  const [resTab, setResTab] = useState("mcq");
  const [questions, setQuestions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSub, setFilterSub] = useState("All");
  const [activeQ, setActiveQ] = useState(null);
  const [shareMsg, setShareMsg] = useState("");

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSub, setAdminSub] = useState("questions");
  const [saving, setSaving] = useState(false);

  // Forms
  const emptyQForm = () => ({ subject:"Biology", question:"", options:["","","",""], correct:0, explanation:"" });
  const emptyNForm = () => ({ subject:"Biology", title:"", content:"" });
  const [qForm, setQForm] = useState(emptyQForm());
  const [nForm, setNForm] = useState(emptyNForm());

  // AI Generation
  const [aiText, setAiText] = useState("");
  const [aiFile, setAiFile] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCount, setAiCount] = useState(5);

  // URL param for shared question
  const [sharedCode, setSharedCode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setSharedCode(code);
      setMainTab("resources");
      setResTab("mcq");
    }
    load();
  }, []);

  useEffect(() => {
    if (sharedCode && questions.length > 0) {
      const q = questions.find(q => q.id === sharedCode);
      if (q) setActiveQ(q);
    }
  }, [sharedCode, questions]);

  async function load() {
    setLoading(true);
    try {
      // Load questions from backend
      const r = await fetch(`${API_BASE}/questions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (r.ok) {
        const data = await r.json();
        const qs = Array.isArray(data) ? data : data.questions || [];
        // Transform to match our format
        setQuestions(qs.map(q => ({
          id: q.id,
          subject: q.subject?.label || "Other",
          question: q.question,
          options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean),
          correct: q.answerIndex,
          explanation: q.explanation,
          difficulty: q.difficulty,
          year: q.year,
        })));
      }
    } catch { setQuestions([]); }
    setLoading(false);
  }

  async function addQ() {
    if (!qForm.question.trim() || qForm.options.some(o => !o.trim())) return;
    setSaving(true);
    try {
      // Find or create subject
      const subjectLabel = qForm.subject;
      let subjectId;
      const subjectsRes = await fetch(`${API_BASE}/subjects`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (subjectsRes.ok) {
        const subjects = await subjectsRes.json();
        const subj = subjects.find(s => s.label === subjectLabel);
        if (subj) subjectId = subj.id;
      }

      if (!subjectId && token) {
        // Create subject
        const newSubRes = await fetch(`${API_BASE}/subjects`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ label: subjectLabel }),
        });
        if (newSubRes.ok) {
          const newSub = await newSubRes.json();
          subjectId = newSub.id;
        }
      }

      if (!subjectId) throw new Error("Could not find or create subject");

      const newQ = {
        subjectId,
        question: qForm.question,
        optionA: qForm.options[0],
        optionB: qForm.options[1],
        optionC: qForm.options[2],
        optionD: qForm.options[3],
        answerIndex: qForm.correct,
        explanation: qForm.explanation,
        difficulty: "medium",
        year: new Date().getFullYear(),
      };

      const res = await fetch(`${API_BASE}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newQ),
      });
      if (!res.ok) throw new Error("Failed to save question");
      const saved = await res.json();
      setQuestions(prev => [...prev, {
        id: saved.id,
        subject: qForm.subject,
        question: qForm.question,
        options: qForm.options.filter(Boolean),
        correct: qForm.correct,
        explanation: qForm.explanation,
      }]);
      setQForm(emptyQForm());
    } catch (e) {
      alert(e.message || "Failed to add question");
    }
    setSaving(false);
  }

  async function delQ(id) {
    if (!token) return;
    if (!window.confirm("Delete this question?")) return;
    try {
      await fetch(`${API_BASE}/questions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch { alert("Failed to delete"); }
  }

  async function addN() {
    if (!nForm.title.trim() || !nForm.content.trim()) return;
    setSaving(true);
    try {
      // Notes are stored in localStorage for now (or could be backend)
      const newN = { id:`N${Date.now().toString(36).toUpperCase()}`, ...nForm, createdAt:Date.now() };
      const stored = JSON.parse(localStorage.getItem("sc_teacher_hub_notes") || "[]");
      stored.push(newN);
      localStorage.setItem("sc_teacher_hub_notes", JSON.stringify(stored));
      setNotes(stored);
      setNForm(emptyNForm());
    } catch { alert("Failed to save note"); }
    setSaving(false);
  }

  async function delN(id) {
    const stored = JSON.parse(localStorage.getItem("sc_teacher_hub_notes") || "[]");
    const updated = stored.filter(n => n.id !== id);
    localStorage.setItem("sc_teacher_hub_notes", JSON.stringify(updated));
    setNotes(updated);
  }

  // AI Generation from content
  async function generateFromAI() {
    if (!aiText.trim() && !aiFile) { alert("Paste text or upload a file"); return; }
    setAiGenerating(true);
    try {
      let text = aiText.trim();
      if (aiFile) {
        const { text: extracted } = await extractTextFromFile(aiFile);
        text = extracted;
      }
      const countStr = aiCount > 0 ? `${aiCount}` : "as many high-quality questions as you can based on the content (aim for 10-20)";
      const prompt = `You are an expert exam question generator. Generate ${countStr} multiple-choice questions from the following study material. Cover different topics and difficulty levels from the content. Each question must be answerable from the material provided.\n\nReturn ONLY a valid JSON array, each item: { "question": string, "options": [4 strings], "answer": 0-3, "difficulty": "easy"|"medium"|"hard", "explanation": string, "topic": string }.\n\nStudy material:\n${text}`;
      const result = await callAI(prompt);
      const parsed = extractJSON(result, "array");
      const generated = parsed.map((q, i) => ({
        id: `ai-${Date.now()}-${i}`,
        subject: qForm.subject,
        question: q.question || "",
        options: q.options || ["","","",""],
        correct: q.answer ?? 0,
        explanation: q.explanation || "",
      }));
      // Add to questions state (temporarily, user can save to backend)
      setQuestions(prev => [...prev, ...generated]);
      setAiText("");
      setAiFile(null);
      alert(`Generated ${generated.length} questions! Review them below.`);
    } catch (e) {
      alert(e.message || "AI generation failed");
    }
    setAiGenerating(false);
  }

  function share(item) {
    const isQ = item.question !== undefined;
    const url = `${window.location.origin}${window.location.pathname}?code=${item.id}`;
    const text = isQ
      ? `📚 Scholar's Circle MCQ\n\n${item.question}\n\nSubject: ${item.subject} | Code: ${item.id}\n\n🔗 Practice now: ${url}`
      : `📝 Scholar's Circle Study Note\n\nTopic: ${item.title} — ${item.subject}\n\n🔗 Access full notes: ${url}`;
    navigator.clipboard.writeText(text).then(() => {
      setShareMsg(item.id);
      setTimeout(() => setShareMsg(""), 2500);
    }).catch(() => {});
  }

  const filteredQ = filterSub === "All" ? questions : questions.filter(q => q.subject === filterSub);
  const filteredN = filterSub === "All" ? notes : notes.filter(n => n.subject === filterSub);
  const allSubjects = [...new Set([...questions.map(q=>q.subject), ...notes.map(n=>n.subject)])];

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    .syne { font-family:'Syne',sans-serif; }
    .man { font-family:'Manrope',sans-serif; }

    .mtab { background:transparent; border:none; color:#555; cursor:pointer; padding:9px 20px; font-family:'Syne',sans-serif; font-size:12px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; border-bottom:2px solid transparent; transition:all 0.18s; }
    .mtab.on { color:#FFD700; border-bottom-color:#FFD700; }
    .mtab.gold.on { color:#F5A623; border-bottom-color:#F5A623; }
    .mtab:hover:not(.on) { color:#aaa; }

    .btn { font-family:'Syne',sans-serif; font-weight:700; font-size:12px; letter-spacing:0.05em; text-transform:uppercase; border:none; cursor:pointer; padding:9px 20px; border-radius:9px; background:linear-gradient(135deg,#FFD700,#6C63FF); color:#fff; transition:all 0.18s; }
    .btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 5px 18px rgba(79,142,247,0.3); }
    .btn:disabled { opacity:0.4; cursor:not-allowed; transform:none !important; }
    .btn-sm { padding:7px 16px; }
    .btn-xs { padding:5px 12px; font-size:11px; }
    .btn-gold { background:linear-gradient(135deg,#F5A623,#F7C948); color:#0A0D13; }
    .btn-gold:hover:not(:disabled) { box-shadow:0 5px 18px rgba(245,166,35,0.3); }
    .btn-ghost { background:transparent; border:1px solid rgba(79,142,247,0.3); color:#FFD700; }
    .btn-red { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#EF4444; }

    .card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; transition:border-color 0.2s; }
    .card:hover { border-color:rgba(255,255,255,0.13); }

    .pill { display:inline-flex; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; font-family:'Syne',sans-serif; letter-spacing:0.08em; text-transform:uppercase; }

    input, textarea, select { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:9px; color:#E8E9F0; font-family:'Manrope',sans-serif; font-size:13px; outline:none; transition:border-color 0.2s; padding:10px 13px; width:100%; }
    input:focus, textarea:focus, select:focus { border-color:rgba(79,142,247,0.45); }
    select option { background:#0D0E1A; }
    ::placeholder { color:#333; }
    textarea { resize:vertical; }

    .overlay { position:fixed; inset:0; background:rgba(7,8,15,0.9); display:flex; align-items:center; justify-content:center; z-index:999; padding:20px; backdrop-filter:blur(10px); }
    .modal { background:#0D0E1A; border:1px solid rgba(255,255,255,0.1); border-radius:20px; width:100%; max-width:500px; max-height:88vh; overflow-y:auto; padding:26px 22px; }

    .filter-btn { background:transparent; border:1px solid rgba(255,255,255,0.08); color:#555; border-radius:20px; padding:5px 13px; font-size:11px; font-weight:700; font-family:'Syne',sans-serif; letter-spacing:0.06em; cursor:pointer; transition:all 0.18s; }
    .filter-btn.on { background:rgba(79,142,247,0.12); border-color:rgba(79,142,247,0.3); color:#FFD700; }

    .q-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:16px 18px; transition:all 0.22s; cursor:default; }
    .q-card:hover { border-color:rgba(79,142,247,0.2); transform:translateY(-2px); box-shadow:0 8px 28px rgba(0,0,0,0.3); }

    .pricing-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:28px 22px; transition:all 0.25s; }
    .pricing-card:hover { transform:translateY(-3px); }
    .pricing-featured { background:linear-gradient(135deg,rgba(79,142,247,0.08),rgba(108,99,255,0.08)); border-color:rgba(79,142,247,0.3); }

    .tag { font-family:'Syne',sans-serif; font-weight:700; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; }
    .fade { animation:fd 0.3s ease; }
    @keyframes fd { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
    .pulse { animation:pl 1.5s ease-in-out infinite; }
    @keyframes pl { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .spin { animation:sp 1s linear infinite; display:inline-block; }
    @keyframes sp { to{transform:rotate(360deg)} }

    ::-webkit-scrollbar { width:3px; }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
  `;

  return (
    <div style={{ minHeight:"100vh", background:"#0A0D13", color:"#E8E9F0", fontFamily:"'Manrope',sans-serif" }}>
      <style>{CSS}</style>

      {/* ── TOP HEADER ── */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth:940, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 0 0" }}>
            <div style={{ width:38,height:38,background:"linear-gradient(135deg,#FFD700,#6C63FF)",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>📚</div>
            <div>
              <div className="syne" style={{ fontWeight:800, fontSize:16 }}>Teacher Hub</div>
              <div style={{ fontSize:11, color:"#444", marginTop:1 }}>
                Scholar's Circle · {questions.length} MCQs · {notes.length} Notes
              </div>
            </div>
            <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
              <button className="btn btn-gold btn-xs" onClick={() => setMainTab("pricing")}>💎 Upgrade</button>
              {auth?.user?.role === "TEACHER" || auth?.user?.role === "LECTURER" ? (
                <button className="btn btn-ghost btn-xs" onClick={() => setMainTab("admin")}>🔒 Admin</button>
              ) : null}
            </div>
          </div>
          {/* Main tabs */}
          <div style={{ display:"flex", marginTop:14 }}>
            {[{id:"resources",label:"📋 Resources"},{id:"admin",label:"🔒 Admin"},{id:"pricing",label:"💎 Pricing"}].map(t => {
              if (t.id === "admin" && auth?.user?.role !== "TEACHER" && auth?.user?.role !== "LECTURER") return null;
              return (
                <button key={t.id} className={`mtab ${mainTab===t.id?"on":""} ${t.id==="pricing"?"gold":""}`}
                  onClick={() => setMainTab(t.id)}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:940, margin:"0 auto", padding:"28px 20px" }}>

        {/* ═══════════ RESOURCES TAB ═══════════ */}
        {mainTab === "resources" && (
          <div className="fade">
            {/* Share CTA banner */}
            <div style={{ background:"linear-gradient(135deg,rgba(79,142,247,0.07),rgba(108,99,255,0.07))", border:"1px solid rgba(79,142,247,0.15)", borderRadius:14, padding:"14px 20px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <div>
                <div className="syne" style={{ fontWeight:700, fontSize:13, color:"#FFD700" }}>Share Scholar's Circle</div>
                <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Invite classmates to study together — it's free to start.</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-sm" onClick={() => {
                  navigator.clipboard.writeText("🎓 Join me on Scholar's Circle — the best way to study MCQs and ace exams!\n\nFree signup: https://scholarscircle.app\n\nCommunity questions, AI tutor, flashcards & more.");
                  setShareMsg("app"); setTimeout(() => setShareMsg(""), 2500);
                }}>
                  {shareMsg === "app" ? "✓ Link Copied!" : "📤 Share App Link"}
                </button>
                <button className="btn btn-gold btn-sm" onClick={() => setMainTab("pricing")}>See Plans →</button>
              </div>
            </div>

            {/* Sub tabs + filter */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:12 }}>
              <div style={{ display:"flex", background:"rgba(255,255,255,0.03)", borderRadius:10, padding:3, gap:2 }}>
                {[{id:"mcq",label:"⚡ MCQ Questions"},{id:"notes",label:"📄 Study Notes"}].map(t => (
                  <button key={t.id} onClick={() => setResTab(t.id)} style={{
                    background:resTab===t.id?"linear-gradient(135deg,#FFD700,#6C63FF)":"transparent",
                    color:resTab===t.id?"#fff":"#555",
                    border:"none", borderRadius:8, padding:"8px 18px", fontSize:12,
                    fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"0.05em", cursor:"pointer", transition:"all 0.18s"
                  }}>{t.label}</button>
                ))}
              </div>
              {/* Subject filters */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["All", ...allSubjects.slice(0,5)].map(s => (
                  <button key={s} className={`filter-btn ${filterSub===s?"on":""}`} onClick={() => setFilterSub(s)}>{s}</button>
                ))}
              </div>
            </div>

            {loading && (
              <div style={{ textAlign:"center", padding:60, color:"#444" }}>
                <div className="spin" style={{ fontSize:24, marginBottom:12 }}>⟳</div>
                <div className="pulse" style={{ fontSize:13 }}>Loading resources...</div>
              </div>
            )}

            {/* ── MCQ GRID ── */}
            {resTab === "mcq" && !loading && (
              filteredQ.length === 0
                ? <EmptyState icon="📭" title="No questions yet" sub="Teachers can add MCQ questions from the Admin tab." />
                : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:14 }}>
                    {filteredQ.map(q => {
                      const c = SUB_COLOR[q.subject] || "#888";
                      return (
                        <div key={q.id} className="q-card fade">
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                            <span className="pill" style={{ background:`${c}15`, color:c, border:`1px solid ${c}30` }}>{q.subject}</span>
                            <span style={{ fontSize:10, color:"#444", fontFamily:"'Syne',sans-serif" }}>{q.id}</span>
                          </div>
                          <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.6, marginBottom:14, color:"#C8C9D5",
                            display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                            {q.question}
                          </div>
                          <div style={{ fontSize:11, color:"#444", marginBottom:12 }}>
                            {q.options.length} options · {q.explanation ? "Explanation included" : "No explanation"}
                          </div>
                          <div style={{ display:"flex", gap:7 }}>
                            <button className="btn btn-sm" style={{ flex:1 }} onClick={() => setActiveQ(q)}>Attempt →</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => share(q)}>
                              {shareMsg === q.id ? "✓" : "Share"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
            )}

            {/* ── NOTES LIST ── */}
            {resTab === "notes" && !loading && (
              filteredN.length === 0
                ? <EmptyState icon="📭" title="No notes yet" sub="Teachers can add study notes from the Admin tab." />
                : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {filteredN.map(n => (
                      <NoteCard key={n.id} note={n} onCopy={share} copied={shareMsg} />
                    ))}
                  </div>
            )}
          </div>
        )}

        {/* ═══════════ ADMIN TAB ═══════════ */}
        {mainTab === "admin" && (
          <div className="fade">
            {/* Admin header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div>
                <div className="syne" style={{ fontWeight:800, fontSize:22 }}>Admin Panel</div>
                <div style={{ color:"#555", fontSize:13, marginTop:2 }}>
                  {questions.length} questions · {notes.length} notes
                </div>
              </div>
            </div>

            {/* Admin sub-tabs */}
            <div style={{ display:"flex", background:"rgba(255,255,255,0.03)", borderRadius:10, padding:3, width:"fit-content", gap:2, marginBottom:26 }}>
              {[{id:"questions",label:"⚡ Add Question"},{id:"ai",label:"🤖 AI Generate"},{id:"notes",label:"📄 Add Note"},{id:"manage",label:"🗂 Manage All"}].map(t => (
                <button key={t.id} onClick={() => setAdminSub(t.id)} style={{
                  background:adminSub===t.id?"linear-gradient(135deg,#FFD700,#6C63FF)":"transparent",
                  color:adminSub===t.id?"#fff":"#555", border:"none", borderRadius:8,
                  padding:"8px 16px", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700,
                  letterSpacing:"0.05em", cursor:"pointer", transition:"all 0.18s"
                }}>{t.label}</button>
              ))}
            </div>

            {/* ── ADD QUESTION ── */}
            {adminSub === "questions" && (
              <div className="card fade" style={{ padding:"22px 24px", maxWidth:600 }}>
                <div className="syne" style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>Add MCQ Question</div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Subject</div>
                  <select value={qForm.subject} onChange={e => setQForm(p=>({...p,subject:e.target.value}))}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Correct Answer</div>
                  <select value={qForm.correct} onChange={e => setQForm(p=>({...p,correct:parseInt(e.target.value)}))}>
                    {OPTS.map((l,i) => <option key={l} value={i}>Option {l}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Question</div>
                  <textarea rows={3} placeholder="Type the question..." value={qForm.question} onChange={e => setQForm(p=>({...p,question:e.target.value}))} />
                </div>
                {OPTS.map((l,i) => (
                  <div key={l} style={{ marginBottom:10 }}>
                    <div className="tag" style={{ color:i===qForm.correct?"#22C55E":"#555", marginBottom:5 }}>
                      Option {l} {i===qForm.correct?"✓ CORRECT":""}
                    </div>
                    <input placeholder={`Option ${l}...`} value={qForm.options[i]}
                      onChange={e => setQForm(p=>{ const o=[...p.options]; o[i]=e.target.value; return{...p,options:o}; })} />
                  </div>
                ))}
                <div style={{ marginBottom:18 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Explanation (optional)</div>
                  <textarea rows={2} placeholder="Why is this the correct answer?" value={qForm.explanation} onChange={e => setQForm(p=>({...p,explanation:e.target.value}))} />
                </div>
                <button className="btn" onClick={addQ} disabled={saving||!qForm.question.trim()||qForm.options.some(o=>!o.trim())}>
                  {saving ? "Saving..." : "+ Add Question"}
                </button>
              </div>
            )}

            {/* ── AI GENERATE ── */}
            {adminSub === "ai" && (
              <div className="card fade" style={{ padding:"22px 24px", maxWidth:600 }}>
                <div className="syne" style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>Generate Questions with AI</div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Subject</div>
                  <select value={qForm.subject} onChange={e => setQForm(p=>({...p,subject:e.target.value}))}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Paste Content</div>
                  <textarea rows={6} placeholder="Paste lecture notes, textbook content, or any study material..." value={aiText} onChange={e => setAiText(e.target.value)} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Or Upload File (PDF, DOCX, TXT)</div>
                  <input type="file" accept=".pdf,.docx,.txt" onChange={e => setAiFile(e.target.files[0])} />
                  {aiFile && <div style={{ fontSize:12, color:"#FFD700", marginTop:6 }}>Selected: {aiFile.name}</div>}
                </div>
                <div style={{ marginBottom:18, display:"flex", alignItems:"center", gap:10 }}>
                  <div className="tag" style={{ color:"#555", whiteSpace:"nowrap" }}>Number of Questions:</div>
                  <input type="number" min={0} max={150} value={aiCount} onChange={e => setAiCount(Math.max(0, Math.min(150, parseInt(e.target.value) || 0)))} style={{ width:70, textAlign:"center" }} />
                  <span style={{ fontSize:11, color:"#555" }}>0 = Auto (AI decides)</span>
                </div>
                <button className="btn" onClick={generateFromAI} disabled={aiGenerating}>
                  {aiGenerating ? "⏳ Generating..." : `🤖 Generate ${aiCount > 0 ? aiCount : "Auto"} Questions`}
                </button>
              </div>
            )}

            {/* ── ADD NOTE ── */}
            {adminSub === "notes" && (
              <div className="card fade" style={{ padding:"22px 24px", maxWidth:600 }}>
                <div className="syne" style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>Add Study Note</div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Subject</div>
                  <select value={nForm.subject} onChange={e => setNForm(p=>({...p,subject:e.target.value}))}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Title</div>
                  <input placeholder="e.g. Krebs Cycle Summary" value={nForm.title} onChange={e => setNForm(p=>({...p,title:e.target.value}))} />
                </div>
                <div style={{ marginBottom:18 }}>
                  <div className="tag" style={{ color:"#555", marginBottom:6 }}>Content</div>
                  <textarea rows={8} placeholder="Type your note content here..." value={nForm.content} onChange={e => setNForm(p=>({...p,content:e.target.value}))} />
                </div>
                <button className="btn" onClick={addN} disabled={saving||!nForm.title.trim()||!nForm.content.trim()}>
                  {saving ? "Saving..." : "+ Add Note"}
                </button>
              </div>
            )}

            {/* ── MANAGE ── */}
            {adminSub === "manage" && (
              <div className="fade">
                <div className="tag" style={{ color:"#555", marginBottom:12 }}>Questions ({questions.length})</div>
                {questions.length === 0 && <div style={{ color:"#444", fontSize:13, marginBottom:20 }}>No questions yet.</div>}
                {questions.map(q => {
                  const c = SUB_COLOR[q.subject]||"#888";
                  return (
                    <div key={q.id} className="card" style={{ padding:"11px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                      <span className="pill" style={{ background:`${c}15`, color:c, border:`1px solid ${c}30`, flexShrink:0 }}>{q.subject}</span>
                      <div style={{ flex:1, fontSize:13, color:"#C0C1CC", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{q.question}</div>
                      <span style={{ fontSize:10, color:"#444", flexShrink:0, fontFamily:"'Syne',sans-serif" }}>{q.id}</span>
                      <button className="btn btn-red btn-xs" onClick={() => delQ(q.id)}>Del</button>
                    </div>
                  );
                })}
                <div className="tag" style={{ color:"#555", marginBottom:12, marginTop:24 }}>Notes ({notes.length})</div>
                {notes.length === 0 && <div style={{ color:"#444", fontSize:13 }}>No notes yet.</div>}
                {notes.map(n => {
                  const c = SUB_COLOR[n.subject]||"#888";
                  return (
                    <div key={n.id} className="card" style={{ padding:"11px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                      <span className="pill" style={{ background:`${c}15`, color:c, border:`1px solid ${c}30`, flexShrink:0 }}>{n.subject}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"#C0C1CC" }}>{n.title}</div>
                      </div>
                      <button className="btn btn-red btn-xs" onClick={() => delN(n.id)}>Del</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ PRICING TAB ═══════════ */}
        {mainTab === "pricing" && (
          <div className="fade">
            {/* Hero */}
            <div style={{ textAlign:"center", padding:"8px 20px 44px" }}>
              <div style={{ display:"inline-block", background:"rgba(79,142,247,0.1)", border:"1px solid rgba(79,142,247,0.18)", borderRadius:20, padding:"5px 16px", fontSize:11, color:"#FFD700", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"0.1em", marginBottom:18 }}>
                🚀 SCHOLAR'S CIRCLE · IBADAN
              </div>
              <div className="syne" style={{ fontWeight:800, fontSize:32, letterSpacing:"-0.03em", lineHeight:1.2, marginBottom:14 }}>
                Study Smarter.<br />
                <span style={{ background:"linear-gradient(135deg,#FFD700,#6C63FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                  Score Higher.
                </span>
              </div>
              <div style={{ color:"#666", fontSize:14, maxWidth:500, margin:"0 auto 30px", lineHeight:1.75 }}>
                AI flashcards, MCQ practice, study notes, and a personal AI tutor — built specifically for Nigerian university students.
              </div>
              <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
                <button className="btn btn-gold" style={{ padding:"13px 32px", fontSize:14 }}>Start Free Today →</button>
                <button className="btn btn-ghost" style={{ padding:"13px 32px", fontSize:14 }}>Watch Demo</button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:"flex", justifyContent:"center", gap:36, marginBottom:44, flexWrap:"wrap" }}>
              {[["500+","Questions"],["AI Tutor","24/7"],["Free","Forever Plan"],["5 min","To Set Up"]].map(([v,l]) => (
                <div key={l} style={{ textAlign:"center" }}>
                  <div className="syne" style={{ fontWeight:800, fontSize:24, color:"#FFD700" }}>{v}</div>
                  <div style={{ fontSize:12, color:"#555", marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Pricing cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:16, marginBottom:40 }}>
              {/* Free */}
              <div className="pricing-card">
                <div className="syne" style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>Free</div>
                <div className="syne" style={{ fontWeight:800, fontSize:30, marginBottom:4 }}>₦0</div>
                <div style={{ color:"#555", fontSize:12, marginBottom:22 }}>No credit card · Forever free</div>
                {["Browse community MCQs","Read study notes","10 AI tutor messages/day","Basic flashcard quiz"].map(f => (
                  <div key={f} style={{ display:"flex", gap:9, alignItems:"center", marginBottom:10, fontSize:13, color:"#777" }}>
                    <span style={{ color:"#22C55E" }}>✓</span>{f}
                  </div>
                ))}
                <button className="btn btn-ghost" style={{ width:"100%", marginTop:18 }}>Get Started Free</button>
              </div>

              {/* Pro — Featured */}
              <div className="pricing-card pricing-featured" style={{ position:"relative" }}>
                <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#FFD700,#6C63FF)", borderRadius:20, padding:"4px 16px", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, whiteSpace:"nowrap", color:"#fff" }}>
                  MOST POPULAR
                </div>
                <div className="syne" style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>Student Pro</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:4 }}>
                  <div className="syne" style={{ fontWeight:800, fontSize:30, color:"#FFD700" }}>₦1,500</div>
                  <div style={{ color:"#555", fontSize:12 }}>/month</div>
                </div>
                <div style={{ color:"#555", fontSize:12, marginBottom:22 }}>≈ ₦50/day · Cancel anytime</div>
                {["Unlimited AI tutor","Generate flashcards from notes","Full MCQ question bank","Spaced repetition quiz","Progress analytics dashboard","Priority support"].map(f => (
                  <div key={f} style={{ display:"flex", gap:9, alignItems:"center", marginBottom:10, fontSize:13, color:"#C0C1CC" }}>
                    <span style={{ color:"#FFD700" }}>✓</span>{f}
                  </div>
                ))}
                <button className="btn" style={{ width:"100%", marginTop:18 }}>Upgrade to Pro</button>
              </div>

              {/* School */}
              <div className="pricing-card">
                <div className="syne" style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>School Plan</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:4 }}>
                  <div className="syne" style={{ fontWeight:800, fontSize:30, color:"#F5A623" }}>₦45,000</div>
                  <div style={{ color:"#555", fontSize:12 }}>/month</div>
                </div>
                <div style={{ color:"#555", fontSize:12, marginBottom:22 }}>Up to 50 students · One invoice</div>
                {["Everything in Pro","Teacher admin panel","Add custom questions & notes","Student progress dashboard","Bulk student onboarding","Dedicated account manager"].map(f => (
                  <div key={f} style={{ display:"flex", gap:9, alignItems:"center", marginBottom:10, fontSize:13, color:"#888" }}>
                    <span style={{ color:"#F5A623" }}>✓</span>{f}
                  </div>
                ))}
                <button className="btn btn-gold" style={{ width:"100%", marginTop:18 }}>Contact Sales</button>
              </div>
            </div>

            {/* How it works */}
            <div style={{ marginBottom:40 }}>
              <div className="syne" style={{ fontWeight:800, fontSize:22, textAlign:"center", marginBottom:28 }}>How It Works</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14 }}>
                {[
                  {icon:"1️⃣", title:"Sign Up Free", desc:"Create an account in under 2 minutes. No credit card needed."},
                  {icon:"2️⃣", title:"Pick Your Subjects", desc:"Choose your courses and access community MCQs and notes instantly."},
                  {icon:"3️⃣", title:"Study with AI", desc:"Generate flashcards, use the AI tutor, and quiz yourself daily."},
                  {icon:"4️⃣", title:"Track Progress", desc:"See your improvement, streaks, and XP grow over time."},
                ].map(s => (
                  <div key={s.title} className="card" style={{ padding:"18px 16px", textAlign:"center" }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>{s.icon}</div>
                    <div className="syne" style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{s.title}</div>
                    <div style={{ fontSize:12.5, color:"#666", lineHeight:1.65 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ background:"linear-gradient(135deg,rgba(79,142,247,0.1),rgba(108,99,255,0.1))", border:"1px solid rgba(79,142,247,0.2)", borderRadius:18, padding:"30px 24px", textAlign:"center" }}>
              <div className="syne" style={{ fontWeight:800, fontSize:22, marginBottom:8 }}>Ready to ace your exams?</div>
              <div style={{ color:"#666", fontSize:13.5, marginBottom:22, maxWidth:400, margin:"0 auto 22px" }}>
                Join students across Ibadan who study smarter with Scholar's Circle.
              </div>
              <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
                <button className="btn btn-gold" style={{ padding:"12px 30px" }}>Start Free →</button>
                <button className="btn btn-ghost" style={{ padding:"12px 30px" }} onClick={() => {
                  navigator.clipboard.writeText("🎓 Scholar's Circle — Study smarter, score higher!\n\nFree AI-powered MCQ practice, flashcards & more.\n\nJoin free: https://scholarscircle.app");
                  setShareMsg("cta"); setTimeout(()=>setShareMsg(""),2500);
                }}>
                  {shareMsg==="cta" ? "✓ Copied!" : "📤 Share Link"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ QUIZ MODAL ═══════════ */}
      {activeQ && (
        <QuizModal q={activeQ} onClose={() => setActiveQ(null)} onShare={share} shared={shareMsg} />
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"60px 20px" }}>
      <div style={{ fontSize:48, marginBottom:14 }}>{icon}</div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, marginBottom:6 }}>{title}</div>
      <div style={{ color:"#555", fontSize:13 }}>{sub}</div>
    </div>
  );
}
