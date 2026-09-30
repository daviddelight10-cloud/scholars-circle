import React, { useState, useEffect } from "react";
import { toast } from "./Toast";
import ExitPill from "./ExitPill.jsx";

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

export function TimetableBuilder({ timetable, setTimetable, subjects, onBack }) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const HOURS = ["8am","9am","10am","11am","12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm"];
  const PALETTE = ["#FFC55C","#6C9EFF","#4ADE80","#8B6CFF","#F472B6","#7CC7FF","#FF6B5E"];

  const [editing, setEditing] = useState(null); // { day, hour, pickHour }
  const [draft, setDraft] = useState({ subject: "", color: PALETTE[0] });

  const todayName = DAYS[(new Date().getDay() + 6) % 7]; // JS: Sun=0 → Mon-first
  const orderedDays = [...DAYS.slice(DAYS.indexOf(todayName)), ...DAYS.slice(0, DAYS.indexOf(todayName))];

  function cellKey(d, h) { return `${d}-${h}`; }

  function openEditor(day, hour, pickHour = false) {
    const cell = timetable[cellKey(day, hour)];
    setDraft(cell ? { subject: cell.subject, color: cell.color } : { subject: "", color: PALETTE[0] });
    setEditing({ day, hour, pickHour });
  }

  function notifyAdded(subject, day, hour) {
    if (!("Notification" in window)) return;
    const fire = () => {
      try {
        new Notification("📚 Added to schedule", {
          body: `${subject} — ${day} at ${hour}`,
          icon: "/icon-192.png",
          badge: "/icon-96.png",
          tag: `tt-${day}-${hour}`,
        });
      } catch {}
    };
    if (Notification.permission === "granted") fire();
    else if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => { if (p === "granted") fire(); });
    }
  }

  function save() {
    if (!draft.subject.trim()) { setEditing(null); return; }
    const key = cellKey(editing.day, editing.hour);
    const isNew = !timetable[key];
    setTimetable(prev => ({ ...prev, [key]: { subject: draft.subject, color: draft.color } }));
    if (isNew) {
      notifyAdded(draft.subject, editing.day, editing.hour);
      toast.success(`${draft.subject} added — ${editing.day} ${editing.hour}`);
    }
    setEditing(null);
  }

  function clear() {
    setTimetable(prev => { const n = {...prev}; delete n[cellKey(editing.day, editing.hour)]; return n; });
    setEditing(null);
  }

  return (
    <>
    <ExitPill title="🗓️ Schedule" onBack={onBack} />
    <div className="card">
      <h2>Weekly Study Timetable</h2>
      <p className="muted">Tap a slot to assign a subject or custom label.</p>

      {/* ── Desktop: week grid ── */}
      <div className="tt-grid-wrap">
        <table className="timetable">
          <thead>
            <tr>
              <th></th>
              {DAYS.map(d => (
                <th key={d} className={d === todayName ? "tt-today" : undefined}>
                  {d}{d === todayName ? " · today" : ""}
                </th>
              ))}
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
                    <td key={key}
                      className={`tt-cell${cell ? " filled" : ""}${d === todayName ? " tt-today-col" : ""}`}
                      style={cell ? { background: cell.color + "26", borderColor: cell.color + "66" } : undefined}
                      onClick={() => openEditor(d, h)}
                    >
                      {cell ? <span className="tt-pill" style={{ color: cell.color }}>{cell.subject}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: day cards (today first) ── */}
      <div className="tt-days">
        {orderedDays.map(day => {
          const slots = HOURS.filter(h => timetable[cellKey(day, h)])
            .map(h => ({ h, cell: timetable[cellKey(day, h)] }));
          const isToday = day === todayName;
          return (
            <div key={day} className={`tt-day${isToday ? " today" : ""}`}>
              <div className="tt-day-head">
                <span className="tt-day-name">
                  {day}
                  {isToday && <em className="tt-day-badge">Today</em>}
                </span>
                <button className="tt-day-add" onClick={() => openEditor(day, "6pm", true)} aria-label={`Add session on ${day}`}>+</button>
              </div>
              {slots.length === 0 ? (
                <div className="tt-day-empty">No sessions</div>
              ) : (
                <div className="tt-day-slots">
                  {slots.map(({ h, cell }) => (
                    <button
                      key={h}
                      className="tt-slot"
                      style={{ background: cell.color + "1f", borderColor: cell.color + "55", color: cell.color }}
                      onClick={() => openEditor(day, h)}
                    >
                      <b>{h}</b> {cell.subject}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Editor sheet ── */}
      {editing && (
        <div className="tt-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="tt-sheet" role="dialog" aria-label="Edit schedule slot">
            <div className="tt-sheet-handle" />
            <div className="tt-sheet-head">
              <h3>{timetable[cellKey(editing.day, editing.hour)] ? "Edit session" : "Add session"}</h3>
              <span className="tt-sheet-when">{editing.day}{!editing.pickHour ? ` · ${editing.hour}` : ""}</span>
            </div>
            {editing.pickHour && (
              <select
                className="tt-hour-select"
                value={editing.hour}
                onChange={(e) => setEditing(p => ({ ...p, hour: e.target.value }))}
                aria-label="Choose hour"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            )}
            <input
              value={draft.subject}
              onChange={e => setDraft(p => ({...p, subject: e.target.value}))}
              placeholder="Subject or activity"
              style={{ width: "100%" }}
              autoFocus
            />
            <div className="tt-chip-row">
              {subjects.map((s, i) => (
                <button key={s.id} className="tt-chip"
                  style={{ borderColor: PALETTE[i % PALETTE.length] + "55", color: PALETTE[i % PALETTE.length] }}
                  onClick={() => setDraft({ subject: s.label, color: PALETTE[i % PALETTE.length] })}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            <div className="tt-chip-row">
              {PALETTE.map(c => (
                <div key={c} className="tt-swatch" onClick={() => setDraft(p => ({...p, color: c}))}
                  style={{ background: c, borderColor: draft.color === c ? "#fff" : "transparent" }} />
              ))}
            </div>
            <div className="tt-sheet-actions">
              <button className="tt-save" onClick={save}>Save</button>
              {timetable[cellKey(editing.day, editing.hour)] && (
                <button className="danger" onClick={clear}>Clear</button>
              )}
              <button onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export function CheatSheet({ subjects }) {
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
