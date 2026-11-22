import { useState } from "react";
import { classroomApi } from "./classroomApi.js";
import { ClassroomAssignmentsPanel } from "../ClassroomAssignments/ClassroomAssignmentsPanel.jsx";
import { ClassTestPanel } from "../ClassTests/ClassTestPanel.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "assignments", label: "📝 Assignments" },
  { id: "tests", label: "✍️ Tests" },
  { id: "exams", label: "📅 Exam dates" },
];

const fmtExam = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const daysUntil = (d) => Math.ceil((new Date(d) - Date.now()) / 86400000);

/** Work: assignments, class tests and exam dates in one filterable place. */
export function WorkTab({ classroom, filter, onFilter, isHost, teacherMode, token, subjects, currentUser, assignments, onComplete, onChanged }) {
  const [examForm, setExamForm] = useState(null); // {title, examDate, duration}
  const [saving, setSaving] = useState(false);
  const exams = (classroom.exams || []).slice().sort((a, b) => new Date(a.examDate) - new Date(b.examDate));
  const legacy = (assignments || []).filter(Boolean);

  const addExam = async () => {
    if (!examForm?.title?.trim() || !examForm?.examDate) return;
    setSaving(true);
    try {
      await classroomApi.createExam(classroom.id, examForm, token);
      setExamForm(null);
      onChanged();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const examsSection = (
    <div>
      {(filter === "all") && <div className="cx-section">📅 Exam dates</div>}
      {teacherMode && !examForm && (
        <button className="cx-btn ghost small" style={{ marginBottom: 8 }} onClick={() => setExamForm({ title: "", examDate: "", duration: 60 })}>＋ Add exam date</button>
      )}
      {examForm && (
        <div className="cx-panel">
          <input className="cx-input" placeholder="Exam title — e.g. MTH111 Mid-Semester" value={examForm.title} onChange={(e) => setExamForm((f) => ({ ...f, title: e.target.value }))} style={{ marginBottom: 8 }} />
          <input className="cx-input" type="datetime-local" value={examForm.examDate} onChange={(e) => setExamForm((f) => ({ ...f, examDate: e.target.value }))} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="cx-btn ghost small" style={{ flex: 1 }} onClick={() => setExamForm(null)}>Cancel</button>
            <button className="cx-btn small" style={{ flex: 1 }} disabled={saving} onClick={addExam}>{saving ? "Saving…" : "Add"}</button>
          </div>
        </div>
      )}
      {exams.length === 0 && !examForm ? (
        <div className="cx-empty" style={{ padding: "16px" }}>
          <div className="cx-empty-sub">{isHost ? "No exam dates yet — add one so students see the countdown." : "No exam dates posted yet."}</div>
        </div>
      ) : (
        exams.map((e) => {
          const d = daysUntil(e.examDate);
          const past = d < 0;
          return (
            <div key={e.id} className="cx-row">
              <span style={{ fontSize: 18 }}>📅</span>
              <span className="cx-row-main">
                <span className="cx-row-title">{e.title}</span>
                <span className="cx-row-meta">{fmtExam(e.examDate)} · {e.duration ? `${e.duration} min` : ""}</span>
              </span>
              <span className={`cx-badge ${past ? "due" : d <= 7 ? "warn" : "live"}`} style={past || d <= 7 ? {} : { background: "rgba(255,255,255,.06)", color: "var(--app-dim)" }}>
                {past ? "Past" : d === 0 ? "Today" : `${d}d`}
              </span>
            </div>
          );
        })
      )}
    </div>
  );

  const assignmentsSection = (
    <div>
      {filter === "all" && <div className="cx-section">📝 Assignments</div>}
      <ClassroomAssignmentsPanel classroomId={classroom.id} isHost={isHost} currentUser={currentUser} token={token} />
      {legacy.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="cx-section">Legacy assignments</div>
          {legacy.map((a) => {
            const subj = (subjects || []).find((s) => s.id === a.subjectId);
            return (
              <div key={a.id} className="cx-row">
                <span className="cx-row-main">
                  <span className="cx-row-title">{a.title}</span>
                  <span className="cx-row-meta">{subj?.label || ""}{a.due ? ` · Due ${a.due}` : ""}</span>
                </span>
                <button
                  className={`cx-btn small${a.done ? " ghost" : ""}`}
                  style={a.done ? { borderColor: "rgba(16,185,129,.4)", color: "#10b981" } : {}}
                  onClick={() => onComplete?.(a.id)}
                >{a.done ? "✓ Done" : "Mark done"}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const testsSection = (
    <div>
      {filter === "all" && <div className="cx-section">✍️ Class tests</div>}
      <ClassTestPanel classroomId={classroom.id} isHost={isHost} token={token} subjects={subjects} classroomName={classroom.name} me={currentUser} />
    </div>
  );

  return (
    <div>
      <div className="cx-filter">
        {FILTERS.map((f) => (
          <button key={f.id} className={`cx-filter-btn${filter === f.id ? " active" : ""}`} onClick={() => onFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      {(filter === "all" || filter === "assignments") && assignmentsSection}
      {(filter === "all" || filter === "tests") && testsSection}
      {(filter === "all" || filter === "exams") && examsSection}
    </div>
  );
}
