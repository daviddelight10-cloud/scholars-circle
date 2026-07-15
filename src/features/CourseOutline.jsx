import React, { useState, useMemo } from "react";

export default function CourseOutline({ subjects, outlineSubjectId, setOutlineSubjectId, startSubjectPractice, addNote, outlineProgress, setOutlineProgress, toast }) {

  const subject = subjects.find((s) => s.id === outlineSubjectId) || subjects[0];

  const [noteView, setNoteView] = useState(null); // { text, title, weekKey }

  const [noteSearch, setNoteSearch] = useState("");

  // Combine both semesters into a single outline
  const sem1 = subject?.courseOutlines?.sem1 || [];
  const sem2 = subject?.courseOutlines?.sem2 || [];
  const outline = [...sem1, ...sem2];

  const outlineState = outlineProgress[subject?.id] || {};

  function toggleStudied(weekKey) {
    setOutlineProgress((prev) => {
      const next = { ...prev };
      const subj = { ...(next[subject.id] || {}) };
      subj[weekKey] = !subj[weekKey];
      next[subject.id] = subj;
      return next;
    });
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const highlightNote = useMemo(() => {
    if (!noteView?.text) return null;
    if (!noteSearch.trim()) return [noteView.text];
    try {
      const parts = noteView.text.split(new RegExp(`(${escapeRegExp(noteSearch)})`, "gi"));
      return parts.map((part, i) => (
        part.toLowerCase() === noteSearch.toLowerCase() ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
      ));
    } catch {
      return [noteView.text];
    }
  }, [noteView, noteSearch]);

  function copyNote(text) {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => toast.success("Copied!")).catch(() => toast.error("Copy failed"));
  }

  function printNote(text, title) {
    if (!text) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return toast.error("Please allow pop-ups to print the note.");
    win.document.write(`<!doctype html><html><head><title>${title || "Study Note"}</title><style>body{font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;padding:24px;line-height:1.6;} h2{margin-top:0;}</style></head><body><h2>${title || "Study Note"}</h2><pre style="white-space:pre-wrap">${text}</pre></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="card">
      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Course Outline</h2>
        <select value={outlineSubjectId} onChange={(e) => setOutlineSubjectId(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {!outline.length && (
        <p className="muted">No outline yet for this semester.</p>
      )}

      {outline.length > 0 && (
        <div className="outline-list">
          {outline.map((mod, i) => (
            <div key={i} className="lesson-block">
              <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>
                <div>
                  <strong>{mod.title}</strong>
                  {mod.week && <span className="muted" style={{ marginLeft: 8 }}>Week {mod.week}</span>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button onClick={() => startSubjectPractice(subject.id, "practice")}>Start Practice</button>
                  <button onClick={() => addNote((mod.notes || ""))}>Copy to Notes</button>
                  {mod.notes && <button onClick={() => setNoteView({ text: mod.notes, title: mod.title, weekKey: mod.week })}>📖 Study note</button>}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={!!outlineState[mod.week]} onChange={() => toggleStudied(mod.week)} />
                    Mark as studied
                  </label>
                </div>
              </div>
              {mod.outcomes && mod.outcomes.length > 0 && (
                <ul className="muted" style={{ marginTop: 8 }}>
                  {mod.outcomes.map((o, idx) => (
                    <li key={idx}>{o}</li>
                  ))}
                </ul>
              )}
              {mod.notes && <p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>{mod.notes}</p>}
              {mod.resources && mod.resources.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 13 }}>Resources:</strong>
                  <ul className="muted" style={{ marginTop: 4 }}>
                    {mod.resources.map((r, idx) => (
                      <li key={idx}><a href={r} target="_blank" rel="noreferrer">{r}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {noteView && (
        <div className="modal-overlay" onClick={() => setNoteView(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0 }}>{noteView.title || "Study Note"}</h3>
              {noteView.weekKey && <span className="muted">Week {noteView.weekKey}</span>}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input placeholder="Search in note" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} style={{ flex: 1 }} />
              <button onClick={() => copyNote(noteView.text)}>Copy</button>
              <button onClick={() => printNote(noteView.text, noteView.title)}>Print/PDF</button>
              <button onClick={() => startSubjectPractice(outlineSubjectId, "practice")}>Start practice</button>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto", lineHeight: 1.6, marginTop: 10 }}>
              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                {highlightNote || noteView.text}
              </div>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={!!outlineState[noteView.weekKey]} onChange={() => toggleStudied(noteView.weekKey)} />
                Mark as studied
              </label>
              <button onClick={() => setNoteView(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
