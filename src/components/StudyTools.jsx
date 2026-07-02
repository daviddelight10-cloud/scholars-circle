import React, { useState, useEffect } from "react";
import { toast } from "./Toast";

export function PomodoroTimer({ onSessionDone }) {
  const MODES = [
    { id: "work", label: "Focus", duration: 25 * 60, color: "#FFD700" },
    { id: "short", label: "Short Break", duration: 5 * 60, color: "#FFD700" },
    { id: "long", label: "Long Break", duration: 15 * 60, color: "#fb923c" },
  ];

  const [modeIdx, setModeIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(MODES[0].duration);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [task, setTask] = useState("");

  const mode = MODES[modeIdx];

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        // Close any open modals - handled by parent App component
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      if (mode.id === "work") {
        setCycles((c) => c + 1);
        if (onSessionDone) onSessionDone();
      }
      const msg = mode.id === "work" ? "Focus session done! Take a break." : "Break over — back to work!";
      if (window.Notification?.permission === "granted") new Notification("Scholar's Circle", { body: msg });
      else toast.info(msg);
      return;
    }
    const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [running, timeLeft, mode, onSessionDone]);

  function switchMode(i) {
    setModeIdx(i);
    setTimeLeft(MODES[i].duration);
    setRunning(false);
  }

  function requestNotifPerm() {
    if (window.Notification) Notification.requestPermission();
  }

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const progress = 1 - timeLeft / mode.duration;

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <h2>Pomodoro Timer</h2>
      <div className="row" style={{ justifyContent: "center", marginBottom: 16 }}>
        {MODES.map((m, i) => (
          <button key={m.id} onClick={() => switchMode(i)}
            style={{ borderColor: modeIdx === i ? m.color : undefined, color: modeIdx === i ? m.color : undefined }}>
            {m.label}
          </button>
        ))}
      </div>
      {task && <p className="muted">Working on: <strong>{task}</strong></p>}
      <div style={{ position: "relative", display: "inline-flex", margin: "16px auto" }}>
        <svg width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="100" cy="100" r="88" fill="none" stroke="#3e4752" strokeWidth="10" />
          <circle cx="100" cy="100" r="88" fill="none" stroke={mode.color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 88}`}
            strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress)}`}
            style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "2.8rem", fontWeight: "bold", color: mode.color }}>{mins}:{secs}</span>
          <span className="muted" style={{ fontSize: 13 }}>{mode.label}</span>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 8 }}>
        <button onClick={() => setRunning((v) => !v)} style={{ borderColor: mode.color, color: mode.color, padding: "10px 24px", fontSize: "1rem" }}>
          {running ? "⏸ Pause" : "▶ Start"}
        </button>
        <button onClick={() => { setTimeLeft(mode.duration); setRunning(false); }}>↺ Reset</button>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>Completed focus sessions today: <strong>{cycles}</strong></p>
      <div style={{ marginTop: 12 }}>
        <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="What are you studying?" style={{ width: "100%", maxWidth: 320 }} />
      </div>
      <button className="muted" style={{ marginTop: 8, fontSize: 12 }} onClick={requestNotifPerm}>Enable notifications</button>
    </div>
  );
}

export function NotesEditor({ subjects, notes, setNotes }) {
  const [activeSubject, setActiveSubject] = useState(subjects[0]?.id || "");
  const text = notes[activeSubject] || "";

  return (
    <div className="card">
      <h2>My Notes</h2>
      <p className="muted">Write and save personal notes per subject. Auto-saved.</p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {subjects.map((s) => (
          <button key={s.id} onClick={() => setActiveSubject(s.id)}
            style={{ borderColor: activeSubject === s.id ? "#FFD700" : undefined, color: activeSubject === s.id ? "#FFD700" : undefined }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0" }}>
        <strong>{subjects.find((s) => s.id === activeSubject)?.label} Notes</strong>
        <span className="muted" style={{ fontSize: 12 }}>{text.length} characters</span>
        {text && (
          <button style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => {
            const blob = new Blob([text], { type: "text/plain" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = `${activeSubject}_notes.txt`; a.click();
          }}>Export .txt</button>
        )}
      </div>
      <textarea
        rows={18}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 14, lineHeight: 1.7, resize: "vertical" }}
        value={text}
        placeholder={`Start typing your ${subjects.find((s) => s.id === activeSubject)?.label} notes here…\n\nTips:\n• Use bullet points\n• Write key formulas\n• Summarise each lesson in your own words`}
        onChange={(e) => setNotes((prev) => ({ ...prev, [activeSubject]: e.target.value }))}
      />
    </div>
  );
}

export function TimetableBuilder({ timetable, setTimetable, subjects }) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const HOURS = ["8am","9am","10am","11am","12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm"];
  const COLORS = ["#FFD700","#FFD700","#fb923c","#facc15","#f472b6","#FFD700","#a78bfa"];

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ subject: "", color: COLORS[0] });

  function cellKey(d, h) { return `${d}-${h}`; }

  function save() {
    if (!draft.subject.trim()) { setEditing(null); return; }
    setTimetable(prev => ({ ...prev, [editing]: { subject: draft.subject, color: draft.color } }));
    setEditing(null);
  }

  function clear(key) { setTimetable(prev => { const n = {...prev}; delete n[key]; return n; }); }

  return (
    <div className="card">
      <h2>Weekly Study Timetable</h2>
      <p className="muted">Click any cell to assign a subject or custom label.</p>
      <div style={{ overflowX: "auto" }}>
        <table className="timetable">
          <thead>
            <tr>
              <th></th>
              {DAYS.map(d => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(h => (
              <tr key={h}>
                <td className="tt-hour">{h}</td>
                {DAYS.map(d => {
                  const key = cellKey(d, h);
                  const cell = timetable[key];
                  return (
                    <td key={key} className="tt-cell"
                      style={{ background: cell ? cell.color + "33" : undefined, borderColor: cell ? cell.color : undefined, cursor: "pointer" }}
                      onClick={() => { setDraft(cell ? { subject: cell.subject, color: cell.color } : { subject: "", color: COLORS[0] }); setEditing(key); }}>
                      {cell ? <span style={{ fontSize: 12, color: cell.color, fontWeight: "bold" }}>{cell.subject}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal-box">
            <h3>Edit slot: {editing}</h3>
            <input value={draft.subject} onChange={e => setDraft(p => ({...p, subject: e.target.value}))} placeholder="Subject or activity" style={{ width: "100%" }} />
            <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {subjects.map((s, i) => (
                <button key={s.id} style={{ fontSize: 12, borderColor: COLORS[i % COLORS.length] }}
                  onClick={() => setDraft({ subject: s.label, color: COLORS[i % COLORS.length] })}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setDraft(p => ({...p, color: c}))}
                  style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: draft.color === c ? "3px solid white" : "2px solid transparent" }} />
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button style={{ borderColor: "#FFD700", color: "#FFD700" }} onClick={save}>Save</button>
              <button className="danger" onClick={() => { clear(editing); setEditing(null); }}>Clear</button>
              <button onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CheatSheet({ subjects, mastery }) {
  const [active, setActive] = useState(subjects[0]?.id || "");
  const subject = subjects.find(s => s.id === active);

  function printSheet() {
    const win = window.open("", "_blank");
    const content = subject.lessons.map(l => `<h3>${l.title}</h3><p>${l.content}</p>`).join("");
    const keyFacts = subject.questions.slice(0, 5).map(q =>
      `<li><strong>Q:</strong> ${q.q}<br/><strong>A:</strong> ${q.options[q.answer]} — ${q.explanation}</li>`
    ).join("");
    win.document.write(`<html><head><title>${subject.label} Cheat Sheet</title>
    <style>body{font-family:sans-serif;padding:24px;max-width:700px;margin:auto}h1{color:#FFD700}h3{color:#FFD700}li{margin-bottom:8px}</style></head>
    <body><h1>${subject.icon} ${subject.label} — Quick Reference Sheet</h1>${content}<h2>Key Facts</h2><ul>${keyFacts}</ul></body></html>`);
    win.document.close(); win.print();
  }

  return (
    <div className="card">
      <div className="row">
        <h2>Cheat Sheets</h2>
        <button onClick={printSheet} style={{ borderColor: "#fb923c", color: "#fb923c" }}>🖨️ Print / Save PDF</button>
      </div>
      <p className="muted">Auto-generated quick reference from lesson content + key Q&A.</p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {subjects.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)}
            style={{ borderColor: active === s.id ? "#FFD700" : undefined, color: active === s.id ? "#FFD700" : undefined }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      {subject && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 6px" }}>
            <h3 style={{ margin: 0 }}>{subject.icon} {subject.label}</h3>
            <span className="muted" style={{ fontSize: 13 }}>Mastery: {mastery[subject.id] || 0}%</span>
          </div>
          {subject.lessons.map(l => (
            <div key={l.title} className="lesson-block">
              <strong style={{ color: "#FFD700" }}>{l.title}</strong>
              <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{l.content}</p>
            </div>
          ))}
          <h3>Key Q&A</h3>
          {subject.questions.slice(0, 6).map((q, i) => (
            <div key={i} className="cheat-qa">
              <p style={{ margin: "0 0 4px" }}><strong>Q{i+1}:</strong> {q.q}</p>
              <p style={{ margin: 0, color: "#FFD700", fontSize: 14 }}><strong>A:</strong> {q.options[q.answer]} — <span className="muted">{q.explanation}</span></p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
