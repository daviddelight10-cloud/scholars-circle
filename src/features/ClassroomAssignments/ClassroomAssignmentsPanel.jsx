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
      <div style={hdr}>
        <h3 style={{ margin: 0 }}>📝 Assignments</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isHost && (
            <>
              <button onClick={() => setView("gradebook")} style={btnSecondary}>📊 Gradebook</button>
              <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>
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

      {loading && <div style={{ padding: 20, color: "#9ca3af" }}>Loading...</div>}

      {!loading && assignments.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>
          {isHost ? "No assignments yet. Create one above." : "No assignments yet."}
        </div>
      )}

      {assignments.map((a) => {
        const mySubmission = a.submissions?.[0];
        const due = a.dueAt ? new Date(a.dueAt) : null;
        const isOverdue = due && due < new Date() && !mySubmission;
        return (
          <div
            key={a.id}
            className="card"
            style={{ marginBottom: 8, cursor: "pointer", borderLeft: `3px solid ${isOverdue ? "#ef4444" : "#6366f1"}` }}
            onClick={() => { setSelected(a.id); setView("detail"); }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</div>
                {a.description && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, maxHeight: 36, overflow: "hidden" }}>{a.description}</div>}
                <div style={{ fontSize: 12, color: "#a5b4fc", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {due && <span style={{ color: isOverdue ? "#f87171" : "#a5b4fc" }}>📅 Due {due.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
                  <span>🎯 {a.points} pts</span>
                  <span>📎 {a.type}</span>
                  {isHost && <span>📥 {a._count?.submissions || 0} submissions</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {!isHost && mySubmission && (
                  mySubmission.grade !== null && mySubmission.grade !== undefined ? (
                    <span style={{ ...badge, background: "#10b981" }}>
                      Graded: {mySubmission.grade}/{a.points}
                    </span>
                  ) : (
                    <span style={{ ...badge, background: "#6366f1" }}>✓ Submitted</span>
                  )
                )}
                {!isHost && !mySubmission && isOverdue && <span style={{ ...badge, background: "#ef4444" }}>Overdue</span>}
                {!isHost && !mySubmission && !isOverdue && <span style={{ ...badge, background: "#f59e0b" }}>Pending</span>}
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
    <form onSubmit={submit} className="card" style={{ marginBottom: 12 }}>
      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title *" style={{ ...inp, marginBottom: 8 }} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions / description" rows={3} style={{ ...inp, marginBottom: 8, resize: "vertical" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>Due date/time</label>
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Points</label>
          <input type="number" min="1" max="1000" value={points} onChange={(e) => setPoints(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Submission type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inp}>
            <option value="text">Text only</option>
            <option value="file">File only</option>
            <option value="both">Text + file</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={busy || !title.trim()} style={btnPrimary}>
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

  if (loading || !data) return <div style={{ padding: 20 }}>Loading...</div>;

  const mySub = !data.isHost ? data.submissions?.[0] : null;

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSecondary, marginBottom: 12 }}>← Back</button>
      <div className="card">
        <h3 style={{ margin: 0 }}>{data.title}</h3>
        {data.description && <p style={{ color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{data.description}</p>}
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#a5b4fc", flexWrap: "wrap" }}>
          {data.dueAt && <span>📅 Due {new Date(data.dueAt).toLocaleString()}</span>}
          <span>🎯 {data.points} pts</span>
        </div>
      </div>

      {!data.isHost && (
        <SubmissionForm assignment={data} mySubmission={mySub} token={token} onSubmitted={load} />
      )}

      {data.isHost && (
        <div style={{ marginTop: 12 }}>
          <h4>Submissions ({data.submissions.length})</h4>
          {data.submissions.length === 0 && <p style={{ color: "#9ca3af" }}>No submissions yet.</p>}
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
    <form onSubmit={submit} className="card" style={{ marginTop: 12 }}>
      <h4 style={{ marginTop: 0 }}>{mySubmission ? "📤 Update Submission" : "📤 Submit Your Work"}</h4>
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
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your answer..."
          rows={6}
          style={{ ...inp, resize: "vertical", marginBottom: 8 }}
        />
      )}
      {showFile && (
        <div style={{ marginBottom: 8 }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ color: "#cbd5e1" }} />
          {mySubmission?.fileName && <div style={{ fontSize: 12, color: "#a5b4fc", marginTop: 4 }}>Current: {mySubmission.fileName}</div>}
        </div>
      )}
      <button type="submit" disabled={busy || (!content.trim() && !file)} style={btnPrimary}>
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
    <div className="card" style={{ marginBottom: 6, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <b>{submission.student?.username || "Unknown"}</b>
          <span style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8 }}>
            Submitted {new Date(submission.submittedAt).toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {submission.grade !== null && submission.grade !== undefined ? (
            <span style={{ ...badge, background: "#10b981" }}>
              {submission.grade}/{maxPoints}
            </span>
          ) : (
            <span style={{ ...badge, background: "#f59e0b" }}>Ungraded</span>
          )}
          <button onClick={() => setExpanded(!expanded)} style={btnSecondary}>
            {expanded ? "Close" : "Review"}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, padding: 12, background: "rgba(15,23,42,0.5)", borderRadius: 8 }}>
          {submission.content && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>TEXT SUBMISSION</div>
              <div style={{ whiteSpace: "pre-wrap", color: "#e0e7ff" }}>{submission.content}</div>
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
                  // Auth-fetched download
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
                style={{ color: "#a5b4fc" }}
              >
                📎 {submission.fileName || "Download attachment"}
              </a>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={lbl}>Grade (out of {maxPoints})</label>
              <input type="number" min="0" max={maxPoints} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="—" style={inp} />
            </div>
            <div>
              <label style={lbl}>Feedback</label>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
            </div>
          </div>
          <button onClick={save} disabled={busy} style={btnPrimary}>
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

  if (loading || !data) return <div style={{ padding: 20 }}>Loading...</div>;

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
        <button onClick={onBack} style={btnSecondary}>← Back</button>
        <button onClick={exportCSV} style={btnPrimary}>📥 Export CSV</button>
      </div>
      <h3>📊 Gradebook</h3>
      {data.assignments.length === 0 ? (
        <p style={{ color: "#9ca3af" }}>No assignments yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(99,102,241,0.1)" }}>
                <th style={th}>Student</th>
                {data.assignments.map((a) => (
                  <th key={a.id} style={th} title={a.title}>{a.title.length > 16 ? a.title.slice(0, 14) + "…" : a.title}<br /><span style={{ fontSize: 10, color: "#9ca3af" }}>({a.points})</span></th>
                ))}
                <th style={th}>Avg %</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.student.id} style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}>
                  <td style={td}><b>{r.student.username}</b></td>
                  {r.cells.map((c, i) => (
                    <td key={i} style={td}>
                      {c.grade !== null && c.grade !== undefined ? (
                        <span style={{ color: c.grade / c.points >= 0.5 ? "#10b981" : "#f87171" }}>{c.grade}</span>
                      ) : c.submitted ? (
                        <span style={{ color: "#f59e0b" }}>—</span>
                      ) : (
                        <span style={{ color: "#64748b" }}>·</span>
                      )}
                    </td>
                  ))}
                  <td style={td}>
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

const hdr = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 };
const lbl = { display: "block", fontSize: 11, color: "#a5b4fc", marginBottom: 4, fontWeight: 600 };
const inp = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(15,23,42,0.7)", color: "#fff", fontSize: 13, boxSizing: "border-box" };
const btnPrimary = { padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnSecondary = { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(30,41,59,0.6)", color: "#fff", cursor: "pointer", fontSize: 13 };
const badge = { padding: "3px 10px", borderRadius: 99, color: "#fff", fontSize: 11, fontWeight: 600 };
const th = { padding: 8, textAlign: "left", borderBottom: "2px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 12 };
const td = { padding: 8, textAlign: "left" };
