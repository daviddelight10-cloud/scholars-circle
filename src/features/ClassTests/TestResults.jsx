import { useEffect, useState } from "react";
import { classTestApi, fmtWindow } from "./classTestApi.js";

function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const LETTERS = "ABCD";

/** Lecturer: who sat the test, scores by matric, CSV export, per-question analysis. */
export function TestResults({ test, token, classroomName, onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("scores"); // scores | analysis
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    classTestApi.results(test.id, token).then(setData).catch((e) => setErr(e.message));
  }, [test.id, token]);

  useEffect(() => {
    if (tab === "analysis" && !analysis) {
      classTestApi.analysis(test.id, token).then(setAnalysis).catch(() => setAnalysis({ items: [] }));
    }
  }, [tab, analysis, test.id, token]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Matric Number", "Name", "Email", "Status", "Score", "Max Score", "Percent", "Late", "Submitted At"],
      ...data.rows.map((r) => [
        r.student.matricNumber || "",
        r.student.fullName || r.student.username || "",
        r.student.email || "",
        r.status,
        r.score ?? "",
        r.maxScore ?? "",
        r.percent ?? "",
        r.late ? "yes" : "",
        r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
      ]),
    ];
    downloadCsv(`${(classroomName || "class")}-${test.title}-results.csv`.replace(/[^\w.-]+/g, "_"), rows);
  };

  if (err) return <div className="ct-empty"><div className="ct-empty-title">Couldn't load results</div><div className="ct-empty-sub">{err}</div><button className="ct-back" onClick={onBack}>← Back</button></div>;
  if (!data) return <div className="ct-empty"><div className="ct-empty-sub">Loading results…</div></div>;

  const { stats, rows } = data;

  return (
    <div>
      <button className="ct-back" onClick={onBack}>← Tests</button>
      <div className="ct-sheet-head">
        <div>
          <div className="ct-sheet-title">{data.test.title}</div>
          <div className="ct-card-meta">{fmtWindow(data.test)} · {data.test.durationMin} min · max {data.test.maxScore} marks</div>
        </div>
        <button className="ct-btn ghost small" onClick={exportCsv}>⬇ CSV</button>
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><div className="ct-stat-v">{stats.sat}/{stats.members}</div><div className="ct-stat-l">Submitted</div></div>
        <div className="ct-stat"><div className="ct-stat-v">{stats.inProgress}</div><div className="ct-stat-l">In progress</div></div>
        <div className="ct-stat"><div className="ct-stat-v">{stats.absent}</div><div className="ct-stat-l">Didn't sit</div></div>
        <div className="ct-stat"><div className="ct-stat-v">{stats.avgPercent ?? "—"}{stats.avgPercent != null ? "%" : ""}</div><div className="ct-stat-l">Class avg</div></div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button className={`ct-btn small${tab === "scores" ? "" : " ghost"}`} onClick={() => setTab("scores")}>Scores</button>
        <button className={`ct-btn small${tab === "analysis" ? "" : " ghost"}`} onClick={() => setTab("analysis")}>Question analysis</button>
      </div>

      {tab === "scores" && (
        <div className="ct-results-wrap">
          <table className="ct-table">
            <thead>
              <tr><th>Matric</th><th>Name</th><th>Status</th><th>Score</th><th>%</th><th>Submitted</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student.id}>
                  <td>{r.student.matricNumber || "—"}</td>
                  <td>{r.student.fullName || r.student.username || "—"}</td>
                  <td>
                    {r.status === "submitted" ? "✓" : r.status === "in_progress" ? "…writing" : r.status === "no_submit" ? "didn't finish" : "absent"}
                    {r.late && <span className="ct-chip late" style={{ marginLeft: 6 }}>late</span>}
                  </td>
                  <td>{r.score != null ? `${r.score}/${r.maxScore}` : "—"}</td>
                  <td>{r.percent != null ? `${r.percent}%` : "—"}</td>
                  <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "analysis" && (
        !analysis ? (
          <div className="ct-empty-sub" style={{ padding: 16 }}>Loading analysis…</div>
        ) : (
          <div className="ct-list">
            {analysis.items.map((it) => (
              <div key={it.index} className="ct-card" style={{ alignItems: "flex-start" }}>
                <div className="ct-card-main">
                  <div className="ct-card-title" style={{ whiteSpace: "normal" }}>Q{it.index + 1}. {it.question}</div>
                  <div className="ct-card-meta">
                    {it.topic || "General"} · {it.marks} mark{it.marks > 1 ? "s" : ""} ·{" "}
                    {it.correctPct != null ? `${it.correctPct}% got it right` : "no submissions"} · answer: {LETTERS[it.answerIndex]}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {it.picks.map((n, i) => (
                      <span key={i} className="ct-chip" style={{ background: i === it.answerIndex ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.06)", color: i === it.answerIndex ? "#34d399" : "var(--app-dim,#94a3b8)" }}>
                        {LETTERS[i]}: {n}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {analysis.items.length === 0 && <div className="ct-empty"><div className="ct-empty-sub">No submissions yet.</div></div>}
          </div>
        )
      )}
    </div>
  );
}
