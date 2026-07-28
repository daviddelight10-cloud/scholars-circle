import React, { useEffect, useState } from "react";
import { assignmentsApi } from "./api.js";

export function ClassroomAssignmentsPanel({ classroomId, isHost, currentUser, token }) {
  const [view, setView] = useState("list"); // list | detail | gradebook
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await assignmentsApi.list(classroomId, token);
      setAssignments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [classroomId]);

  if (view === "detail" && selected) {
    return (
      <AssignmentDetail
        assignmentId={selected}
        token={token}
        currentUser={currentUser}
        onBack={() => { setView("list"); setSelected(null); load(); }}
      />
    );
  }

  if (view === "gradebook") {
    return <Gradebook classroomId={classroomId} token={token} onBack={() => setView("list")} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontFamily: "Syne, sans-serif", fontSize: 16, color: "#f1f5f9" }}>📝 Assignments</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isHost && (
            <>
              <button className="cr-btn-outline" onClick={() => setView("gradebook")}>📊 Gradebook</button>
              <button className="cr-btn" onClick={() => setShowCreate(!showCreate)}>
                {showCreate ? "✕ Cancel" : "➕ New Assignment"}
              </button>
            </>
          )}
        </div>
      </div>

      {showCreate && isHost && (
        <CreateAssignmentForm
          classroomId={classroomId}
          token={token}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {loading && <div className="cr-glass" style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Loading…</div>}

      {!loading && assignments.length === 0 && (
        <div className="cr-empty" style={{ padding: "32px 20px" }}>
          <div className="cr-empty-icon">📝</div>
          <div className="cr-empty-title">No assignments yet</div>
          <div className="cr-empty-desc">{isHost ? "Create one above to get started." : "Check back later."}</div>
        </div>
      )}

      {assignments.map((a) => {
        const mySubmission = a.submissions?.[0];
        const due = a.dueAt ? new Date(a.dueAt) : null;
        const isOverdue = due && due < new Date() && !mySubmission;
        return (
          <div
            key={a.id}
            className="cr-glass-flat"
            style={{ marginBottom: 8, cursor: "pointer", borderLeft: `3px solid ${isOverdue ? "#ef4444" : "#FFD700"}` }}
            onClick={() => { setSelected(a.id); setView("detail"); }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", fontFamily: "Syne, sans-serif" }}>{a.title}</div>
                {a.description && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, maxHeight: 36, overflow: "hidden" }}>{a.description}</div>}
                <div style={{ fontSize: 11, color: "#FFD700", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {due && <span style={{ color: isOverdue ? "#f87171" : "#FFD700" }}>📅 Due {due.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
                  <span>🎯 {a.points} pts</span>
                  <span>📎 {a.type}</span>
                  {isHost && <span>📥 {a._count?.submissions || 0} submissions</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {!isHost && mySubmission && (
                  mySubmission.grade !== null && mySubmission.grade !== undefined ? (
                    <span className="cr-badge" style={{ background: "rgba(16,185,129,0.2)", color: "#10b981" }}>
                      Graded: {mySubmission.grade}/{a.points}
                    </span>
                  ) : (
                    <span className="cr-badge" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>✓ Submitted</span>
                  )
                )}
                {!isHost && !mySubmission && isOverdue && <span className="cr-badge" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>Overdue</span>}
                {!isHost && !mySubmission && !isOverdue && <span className="cr-badge" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>Pending</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateAssignmentForm({ classroomId, token, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [points, setPoints] = useState(100);
  const [type, setType] = useState("text");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await assignmentsApi.create(classroomId, {
        title: title.trim(),
        description: description.trim() || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        points: parseInt(points) || 100,
        type
      }, token);
      onCreated?.();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="cr-glass" style={{ marginBottom: 12 }}>
      <input className="cr-input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title *" style={{ marginBottom: 8 }} />
      <textarea className="cr-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions / description" rows={3} style={{ marginBottom: 8, resize: "vertical" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
        <div>
          <label className="cr-field-label">Due date/time</label>
          <input className="cr-input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        <div>
          <label className="cr-field-label">Points</label>
          <input className="cr-input" type="number" min="1" max="1000" value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
        <div>
          <label className="cr-field-label">Submission type</label>
          <select className="cr-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="text">Text only</option>
            <option value="file">File only</option>
            <option value="both">Text + file</option>
          </select>
        </div>
      </div>
      <button className="cr-btn" type="submit" disabled={busy || !title.trim()} style={(busy || !title.trim()) ? { opacity: 0.5 } : {}}>
        {busy ? "Creating..." : "📝 Create Assignment"}
      </button>
    </form>
  );

}

function AssignmentDetail({ assignmentId, token, currentUser, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const d = await assignmentsApi.get(assignmentId, token);
      setData(d);
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [assignmentId]);

  if (loading || !data) return <div className="cr-glass" style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Loading…</div>;

  const mySub = !data.isHost ? data.submissions?.[0] : null;

  return (
    <div>
      <button className="cr-btn-outline" onClick={onBack} style={{ marginBottom: 12 }}>← Back</button>
      <div className="cr-glass">
        <h3 style={{ margin: 0, fontFamily: "Syne, sans-serif", fontSize: 16, color: "#f1f5f9" }}>{data.title}</h3>
        {data.description && <p style={{ color: "#cbd5e1", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>{data.description}</p>}
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#FFD700", flexWrap: "wrap" }}>
          {data.dueAt && <span>📅 Due {new Date(data.dueAt).toLocaleString()}</span>}
          <span>🎯 {data.points} pts</span>
        </div>
      </div>

      {!data.isHost && (
        <SubmissionForm assignment={data} mySubmission={mySub} token={token} onSubmitted={load} />
      )}

      {data.isHost && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ fontFamily: "Syne, sans-serif", fontSize: 14, color: "#f1f5f9" }}>Submissions ({data.submissions.length})</h4>
          {data.submissions.length === 0 && <p style={{ color: "#6b7280", fontSize: 12 }}>No submissions yet.</p>}
          {data.submissions.map((s) => (
            <SubmissionRow key={s.id} submission={s} maxPoints={data.points} token={token} onGraded={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionForm({ assignment, mySubmission, token, onSubmitted }) {
  const [content, setContent] = useState(mySubmission?.content || "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await assignmentsApi.submit(assignment.id, { content, file }, token);
      alert("Submitted!");
      setFile(null);
      onSubmitted?.();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  const showText = assignment.type === "text" || assignment.type === "both";
  const showFile = assignment.type === "file" || assignment.type === "both";

  return (
    <form onSubmit={submit} className="cr-glass" style={{ marginTop: 12 }}>
      <h4 style={{ marginTop: 0, fontFamily: "Syne, sans-serif", fontSize: 14, color: "#f1f5f9" }}>{mySubmission ? "📤 Update Submission" : "📤 Submit Your Work"}</h4>
      {mySubmission?.grade !== null && mySubmission?.grade !== undefined && (
        <div style={{ padding: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "#10b981" }}>
            Graded: {mySubmission.grade} / {assignment.points} ({Math.round(mySubmission.grade / assignment.points * 100)}%)
          </div>
          {mySubmission.feedback && <div style={{ color: "#cbd5e1", marginTop: 6, whiteSpace: "pre-wrap" }}>💬 {mySubmission.feedback}</div>}
        </div>
      )}
      {showText && (
        <textarea
          className="cr-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your answer..."
          rows={6}
          style={{ resize: "vertical", marginBottom: 8 }}
        />
      )}
      {showFile && (
        <div style={{ marginBottom: 8 }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ color: "#cbd5e1" }} />
          {mySubmission?.fileName && <div style={{ fontSize: 12, color: "#FFD700", marginTop: 4 }}>Current: {mySubmission.fileName}</div>}
        </div>
      )}
      <button className="cr-btn" type="submit" disabled={busy || (!content.trim() && !file)} style={(busy || (!content.trim() && !file)) ? { opacity: 0.5 } : {}}>
        {busy ? "Submitting..." : mySubmission ? "Update Submission" : "Submit"}
      </button>
    </form>
  );

}

function SubmissionRow({ submission, maxPoints, token, onGraded }) {
  const [expanded, setExpanded] = useState(false);
  const [grade, setGrade] = useState(submission.grade ?? "");
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await assignmentsApi.grade(submission.id, {
        grade: grade === "" ? null : parseInt(grade),
        feedback: feedback || null
      }, token);
      setExpanded(false);
      onGraded?.();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cr-glass-flat" style={{ marginBottom: 6, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <b style={{ color: "#f1f5f9", fontSize: 13 }}>{submission.student?.username || "Unknown"}</b>
          <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 8 }}>
            Submitted {new Date(submission.submittedAt).toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {submission.grade !== null && submission.grade !== undefined ? (
            <span className="cr-badge" style={{ background: "rgba(16,185,129,0.2)", color: "#10b981" }}>
              {submission.grade}/{maxPoints}
            </span>
          ) : (
            <span className="cr-badge" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>Ungraded</span>
          )}
          <button className="cr-btn-outline" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Close" : "Review"}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, padding: 12, background: "rgba(10,10,10,0.5)", borderRadius: 8 }}>
          {submission.content && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>TEXT SUBMISSION</div>
              <div style={{ whiteSpace: "pre-wrap", color: "#FFD700", fontSize: 12 }}>{submission.content}</div>
            </div>
          )}
          {submission.fileUrl && (
            <div style={{ marginBottom: 12 }}>
              <a
                href={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/classroom-assignments/submissions/${submission.id}/download`}
                target="_blank"
                rel="noreferrer"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/classroom-assignments/submissions/${submission.id}/download`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = submission.fileName || "submission";
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert("Download failed: " + err.message);
                  }
                }}
                style={{ color: "#FFD700", fontSize: 12 }}
              >
                📎 {submission.fileName || "Download attachment"}
              </a>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label className="cr-field-label">Grade (out of {maxPoints})</label>
              <input className="cr-input" type="number" min="0" max={maxPoints} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label className="cr-field-label">Feedback</label>
              <textarea className="cr-input" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} style={{ resize: "vertical" }} />
            </div>
          </div>
          <button className="cr-btn" onClick={save} disabled={busy} style={busy ? { opacity: 0.5 } : {}}>
            {busy ? "Saving..." : "💾 Save Grade"}
          </button>
        </div>
      )}
    </div>
  );

}

function Gradebook({ classroomId, token, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    assignmentsApi.gradebook(classroomId, token)
      .then(setData)
      .catch((e) => alert("Failed: " + e.message))
      .finally(() => setLoading(false));
  }, [classroomId, token]);

  if (loading || !data) return <div className="cr-glass" style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Loading…</div>;

  function exportCSV() {
    const headers = ["Student", "Email", ...data.assignments.map((a) => `${a.title} (${a.points})`), "Average %"];
    const rows = data.rows.map((r) => [
      r.student.username,
      r.student.email || "",
      ...r.cells.map((c) => c.grade !== null && c.grade !== undefined ? c.grade : (c.submitted ? "—" : "")),
      r.avgPct !== null ? r.avgPct + "%" : ""
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gradebook-${classroomId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button className="cr-btn-outline" onClick={onBack}>← Back</button>
        <button className="cr-btn" onClick={exportCSV}>📥 Export CSV</button>
      </div>
      <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, color: "#f1f5f9", marginBottom: 12 }}>📊 Gradebook</h3>
      {data.assignments.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: 12 }}>No assignments yet.</p>
      ) : (
        <div className="cr-glass" style={{ overflowX: "auto" }}>
          <table className="cr-table">
            <thead>
              <tr>
                <th className="cr-th">Student</th>
                {data.assignments.map((a) => (
                  <th key={a.id} className="cr-th" title={a.title}>{a.title.length > 16 ? a.title.slice(0, 14) + "…" : a.title}<br /><span style={{ fontSize: 10, color: "#6b7280" }}>({a.points})</span></th>
                ))}
                <th className="cr-th">Avg %</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.student.id} className="cr-tr">
                  <td className="cr-td"><b style={{ color: "#f1f5f9" }}>{r.student.username}</b></td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="cr-td">
                      {c.grade !== null && c.grade !== undefined ? (
                        <span style={{ color: c.grade / c.points >= 0.5 ? "#10b981" : "#f87171" }}>{c.grade}</span>
                      ) : c.submitted ? (
                        <span style={{ color: "#f59e0b" }}>—</span>
                      ) : (
                        <span style={{ color: "#64748b" }}>·</span>
                      )}
                    </td>
                  ))}
                  <td className="cr-td">
                    {r.avgPct !== null ? (
                      <b style={{ color: r.avgPct >= 50 ? "#10b981" : "#f87171" }}>{r.avgPct}%</b>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

