import { Fragment, useEffect, useRef, useState } from "react";
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
const TYPE_LABEL = { mcq: "MCQ", truefalse: "T/F", fillblank: "Fill-in" };
const STATUS_LABEL = { submitted: "✓", in_progress: "…writing", no_submit: "didn't finish", absent: "absent" };

/** Lecturer: live monitor + score matrix + retake/override/force-submit + item analysis. */
export function TestResults({ test, token, classroomName, onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("scores"); // scores | analysis
  const [analysis, setAnalysis] = useState(null);
  const [busyRow, setBusyRow] = useState(null); // attemptId being acted on
  const [editScore, setEditScore] = useState({}); // attemptId → {score, note, open}
  const pollRef = useRef(null);

  const load = (silent = false) => {
    classTestApi.results(test.id, token)
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => { if (!silent) setErr(e.message); });
  };

  useEffect(() => { load(); }, [test.id, token]);

  // Live monitor: poll every 15s while the window is open.
  useEffect(() => {
    if (!data?.test?.isOpen) return;
    pollRef.current = setInterval(() => load(true), 15000);
    return () => clearInterval(pollRef.current);
  }, [data?.test?.isOpen, test.id, token]);

  useEffect(() => {
    if (tab === "analysis" && !analysis) {
      classTestApi.analysis(test.id, token).then(setAnalysis).catch(() => setAnalysis({ items: [] }));
    }
  }, [tab, analysis, test.id, token]);

  const resetAttempt = async (r) => {
    if (!r.attemptId) return;
    if (!window.confirm(`Reset ${r.student.fullName || r.student.username}'s attempt? They'll be able to sit it again.`)) return;
    setBusyRow(r.attemptId);
    try { await classTestApi.resetAttempt(test.id, r.attemptId, token); load(); }
    catch (e) { alert(e.message); }
    finally { setBusyRow(null); }
  };

  const forceSubmitAll = async () => {
    const n = data?.stats?.inProgress || 0;
    if (!n) return;
    if (!window.confirm(`Force-submit ${n} in-progress attempt${n === 1 ? "" : "s"}? Current answers are graded as-is.`)) return;
    try {
      const r = await classTestApi.forceSubmit(test.id, token);
      load();
      alert(`${r.submitted} attempt${r.submitted === 1 ? "" : "s"} submitted.`);
    } catch (e) { alert(e.message); }
  };

  const saveScore = async (r) => {
    const e = editScore[r.attemptId];
    if (!e) return;
    setBusyRow(r.attemptId);
    try {
      await classTestApi.adjustScore(test.id, r.attemptId, e.score === "" ? null : Number(e.score), e.note || null, token);
      setEditScore((p) => ({ ...p, [r.attemptId]: { ...e, open: false } }));
      load();
    } catch (err2) { alert(err2.message); }
    finally { setBusyRow(null); }
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Matric Number", "Name", "Email", "Guest", "Status", "Score", "Max Score", "Percent", "Late", "Focus Lost", "Submitted At"],
      ...data.rows.map((r) => [
        r.student.matricNumber || "",
        r.student.fullName || r.student.username || "",
        r.student.email || "",
        r.guest ? "yes" : "",
        r.status,
        r.score ?? "",
        r.maxScore ?? "",
        r.percent ?? "",
        r.late ? "yes" : "",
        r.focusLost || "",
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
          <div className="ct-card-meta">
            {fmtWindow(data.test)} · {data.test.durationMin} min · max {data.test.maxScore} marks
            {data.test.isOpen && <span className="ct-chip open" style={{ marginLeft: 8 }}>● live</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {stats.inProgress > 0 && (
            <button className="ct-btn danger small" onClick={forceSubmitAll}>Force-submit {stats.inProgress}</button>
          )}
          <button className="ct-btn ghost small" onClick={exportCsv}>⬇ CSV</button>
        </div>
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><div className="ct-stat-v">{stats.sat}/{stats.members}</div><div className="ct-stat-l">Submitted</div></div>
        <div className="ct-stat"><div className="ct-stat-v">{stats.inProgress}</div><div className="ct-stat-l">Writing now</div></div>
        <div className="ct-stat"><div className="ct-stat-v">{stats.absent}</div><div className="ct-stat-l">Didn't sit</div></div>
        {stats.guests > 0 && <div className="ct-stat"><div className="ct-stat-v">{stats.guests}</div><div className="ct-stat-l">Guests</div></div>}
        {stats.flagged > 0 && <div className="ct-stat"><div className="ct-stat-v" style={{ color: "#f87171" }}>{stats.flagged}</div><div className="ct-stat-l">Flagged</div></div>}
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
              <tr><th>Matric</th><th>Name</th><th>Status</th><th>Score</th><th>%</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.student.id}>
                  <tr className={r.guest ? "ct-row-guest" : ""}>
                    <td>{r.student.matricNumber || "—"}</td>
                    <td>
                      {r.student.fullName || r.student.username || "—"}
                      {r.guest && <span className="ct-chip upcoming" style={{ marginLeft: 6 }}>guest</span>}
                    </td>
                    <td>
                      {STATUS_LABEL[r.status] || r.status}
                      {r.late && <span className="ct-chip late" style={{ marginLeft: 6 }}>late</span>}
                      {r.forceClosed && <span className="ct-chip draft" style={{ marginLeft: 6 }}>forced</span>}
                      {(r.focusLost || 0) >= 3 && <span className="ct-chip late" style={{ marginLeft: 6 }} title="Left the exam screen">👁 {r.focusLost}×</span>}
                    </td>
                    <td>
                      {r.score != null ? `${r.score}/${r.maxScore}` : "—"}
                      {r.overridden && <span className="ct-chip done" style={{ marginLeft: 6 }} title={r.overrideNote || "Score adjusted"}>adj</span>}
                    </td>
                    <td>{r.percent != null ? `${r.percent}%` : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.attemptId && r.status === "submitted" && (
                        <button
                          className="ct-btn ghost small"
                          title="Adjust score"
                          onClick={() => setEditScore((p) => ({ ...p, [r.attemptId]: { score: p[r.attemptId]?.score ?? r.score ?? "", note: r.overrideNote || "", open: !p[r.attemptId]?.open } }))}
                        >±</button>
                      )}
                      {r.attemptId && (r.status === "submitted" || r.status === "no_submit") && (
                        <button className="ct-btn ghost small" disabled={busyRow === r.attemptId} title="Allow retake" onClick={() => resetAttempt(r)}>↺</button>
                      )}
                    </td>
                  </tr>
                  {editScore[r.attemptId]?.open && (
                    <tr>
                      <td colSpan={6}>
                        <div className="ct-override">
                          <span className="ct-card-meta">Adjust score (max {r.maxScore}):</span>
                          <input
                            className="ct-input ct-marks" type="number" min={0} max={r.maxScore}
                            value={editScore[r.attemptId].score}
                            onChange={(e) => setEditScore((p) => ({ ...p, [r.attemptId]: { ...p[r.attemptId], score: e.target.value } }))}
                          />
                          <input
                            className="ct-input" style={{ flex: 1 }} placeholder="Reason (e.g. appeal granted)"
                            value={editScore[r.attemptId].note}
                            onChange={(e) => setEditScore((p) => ({ ...p, [r.attemptId]: { ...p[r.attemptId], note: e.target.value } }))}
                          />
                          <button className="ct-btn small" disabled={busyRow === r.attemptId} onClick={() => saveScore(r)}>Save</button>
                          <button className="ct-btn ghost small" onClick={() => { setEditScore((p) => ({ ...p, [r.attemptId]: { ...p[r.attemptId], score: "" } })); }}>Clear adj</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
                  <div className="ct-card-title" style={{ whiteSpace: "normal" }}>
                    <span className="ct-typebadge">{TYPE_LABEL[it.questionType || "mcq"]}</span> Q{it.index + 1}. {it.question}
                  </div>
                  <div className="ct-card-meta">
                    {it.topic || "General"} · {it.marks} mark{it.marks > 1 ? "s" : ""} ·{" "}
                    {it.correctPct != null ? `${it.correctPct}% got it right` : "no submissions"} · answer: {it.questionType === "fillblank" ? it.answerText : LETTERS[it.answerIndex]}
                  </div>
                  {it.questionType !== "fillblank" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {it.picks.slice(0, it.questionType === "truefalse" ? 2 : 4).map((n, i) => (
                        <span key={i} className="ct-chip" style={{ background: i === it.answerIndex ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.06)", color: i === it.answerIndex ? "#34d399" : "var(--app-dim,#94a3b8)" }}>
                          {LETTERS[i]}: {n}
                        </span>
                      ))}
                    </div>
                  )}
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
