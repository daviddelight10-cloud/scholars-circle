import React, { useState, useEffect } from "react";

export function QuestionBank({ subjects, onStartPastPaper }) {
  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("all");
  const [diff, setDiff] = useState("all");
  const [year, setYear] = useState("all");
  const [questionCount, setQuestionCount] = useState("all");
  const [customMinutes, setCustomMinutes] = useState("");
  const [customQuestions, setCustomQuestions] = useState([]);

  useEffect(() => {
    const uid = localStorage.getItem("scholars-circle-current-user") || "guest";
    const key = `sc_custom_questions::${uid}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setCustomQuestions(JSON.parse(raw));
    } catch {}
  }, []);

  if (!subjects || !Array.isArray(subjects)) {
    return (
      <div className="card">
        <h2>Past Questions Bank</h2>
        <p className="muted">Loading subjects...</p>
      </div>
    );
  }

  const allRows = [
    ...subjects.flatMap((s) =>
      (s.questions || []).map((qu, i) => ({ ...qu, subjectId: s.id, subjectLabel: s.label, subjectIcon: s.icon, subject: s.label, year: qu.year || 2020 + (i % 6) }))
    ),
    ...customQuestions.map((qu) => ({
      ...qu,
      subjectId: "custom",
      subjectLabel: qu.topic || "Custom",
      subjectIcon: "✨",
    }))
  ];

  const rows = allRows.filter(
    (row) =>
      (subj === "all" || row.subject === subj || (subj === "Custom" && row.subjectId === "custom")) &&
      (diff === "all" || row.difficulty === diff) &&
      (year === "all" || String(row.year) === year) &&
      (row.q.toLowerCase().includes(q.toLowerCase()) || row.options.some((o) => o.toLowerCase().includes(q.toLowerCase())))
  );

  const years = [...new Set(allRows.map(r => r.year))].sort();
  const subjectOptions = [...new Set(allRows.map(r => r.subjectLabel))];

  const selectedRows = questionCount === "all"
    ? rows
    : rows.slice(0, parseInt(questionCount));

  const autoMinutes = Math.max(10, Math.round((selectedRows.length * 90) / 60));
  const minutes = customMinutes ? parseInt(customMinutes) : autoMinutes;

  return (
    <div className="card">
      <h2>Past Questions Bank</h2>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />
        <select value={subj} onChange={(e) => setSubj(e.target.value)}>
          <option value="all">All Subjects</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={diff} onChange={(e) => setDiff(e.target.value)}>
          <option value="all">All Difficulty</option>
          <option value="easy">easy</option>
          <option value="medium">medium</option>
          <option value="hard">hard</option>
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="all">All Years</option>
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>
          <option value="all">All questions</option>
          {[10, 20, 30, 50].map(n => (
            <option key={n} value={n} disabled={rows.length < n}>
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
        {year !== "all" && selectedRows.length > 0 && (
          <button style={{ borderColor: "#fb923c", color: "#fb923c" }}
            onClick={() => onStartPastPaper && onStartPastPaper(selectedRows, year, minutes)}>
            📝 Take {year} Paper ({selectedRows.length} Qs · {minutes} min)
          </button>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>{rows.length} questions shown</p>
      {rows.slice(0, 30).map((row, i) => (
        <div key={i} className="history-row">
          <span>{row.subject} ({row.year}) — {row.q.slice(0, 70)}{row.q.length > 70 ? "…" : ""}</span>
          <strong>{row.difficulty || "medium"}</strong>
        </div>
      ))}
    </div>
  );
}

export default QuestionBank;
