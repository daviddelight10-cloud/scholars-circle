import { useMemo, useState } from "react";

export function PastPaperDrill({ subjects, onStartPastPaper }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [year, setYear] = useState("");
  const [questionCount, setQuestionCount] = useState("all");
  const [customMinutes, setCustomMinutes] = useState("");

  const subject = subjects.find((s) => s.id === subjectId);
  const allQs = (subject?.questions || []).map((q, i) => ({
    ...q,
    year: q.year || 2020 + (i % 6),
  }));
  const yearsAvailable = useMemo(() => [...new Set(allQs.map((q) => q.year))].sort(), [allQs]);
  const yearQs = year ? allQs.filter((q) => String(q.year) === String(year)) : [];
  
  // Calculate selected questions
  const selectedQs = questionCount === "all" 
    ? yearQs 
    : yearQs.slice(0, parseInt(questionCount));
  
  // Calculate time
  const autoMinutes = Math.max(10, Math.round((selectedQs.length * 90) / 60));
  const minutes = customMinutes ? parseInt(customMinutes) : autoMinutes;

  function start() {
    if (!selectedQs.length) return;
    onStartPastPaper(selectedQs, year, minutes);
  }

  return (
    <div className="card">
      <h2>📝 Past-Paper Drill</h2>
      <p className="muted">
        Sit a real timed paper. Pick a course and a year — we'll run the timer and grade you against the mark scheme.
      </p>

      <div className="lesson-block">
        <strong>📌 Exam-day tips for first-years</strong>
        <ul style={{ marginTop: 6 }}>
          <li>Read every question all the way through before answering.</li>
          <li>If a question takes &gt; 2 minutes, flag it and move on. Come back later.</li>
          <li>Eliminate two clearly wrong options first — your odds jump from 25% to 50%.</li>
          <li>Watch your time: aim for ~1.5 minutes per multiple-choice question.</li>
          <li>After the paper, review every wrong answer. That's where the marks come back.</li>
        </ul>
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setYear(""); }}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Pick a year…</option>
          {yearsAvailable.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>
          <option value="all">All questions</option>
          {[10, 20, 30, 50].map(n => (
            <option key={n} value={n} disabled={yearQs.length < n}>
              {n} questions
            </option>
          ))}
        </select>
        <select value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)}>
          <option value="">Auto time (~{autoMinutes} min)</option>
          {[10, 15, 20, 30, 45, 60, 90, 120].map(n => (
            <option key={n} value={n}>
              {n} minutes
            </option>
          ))}
        </select>
        <button
          onClick={start}
          disabled={!selectedQs.length}
          style={{ borderColor: "#fb923c", color: "#fb923c" }}
        >
          🚀 Start {year ? `${year} Paper` : "Paper"} ({selectedQs.length} Qs · {minutes} min)
        </button>
      </div>

      <h3 style={{ marginTop: 18 }}>Available papers</h3>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {yearsAvailable.map((y) => {
          const count = allQs.filter((q) => q.year === y).length;
          return (
            <button
              key={y}
              onClick={() => { setYear(String(y)); }}
              style={{ borderColor: String(year) === String(y) ? "#fb923c" : undefined, color: String(year) === String(y) ? "#fb923c" : undefined }}
            >
              {subject?.icon} {y} · {count} Qs
            </button>
          );
        })}
      </div>

      {selectedQs.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Preview ({selectedQs.length} questions)</h3>
          {selectedQs.slice(0, 5).map((q, i) => (
            <div key={i} className="history-row">
              <span style={{ fontSize: 13 }}>
                {i + 1}. {q.q}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {q.difficulty || "medium"}
              </span>
            </div>
          ))}
          {selectedQs.length > 5 && <p className="muted" style={{ fontSize: 12 }}>…and {selectedQs.length - 5} more.</p>}
        </>
      )}
    </div>
  );
}
