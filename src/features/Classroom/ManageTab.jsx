import { useState } from "react";
import { AttendancePanel } from "../Attendance/AttendancePanel.jsx";
import { QuestionTools } from "./QuestionTools.jsx";

/** Manage (lecturer only) — iOS-settings-style grouped sections. */
export function ManageTab({ classroom, token, subjects = [] }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState("attendance"); // attendance | questions | null

  const copyCode = async () => {
    if (!classroom.joinCode) return;
    try {
      await navigator.clipboard.writeText(classroom.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const share = async () => {
    if (!classroom.joinCode) return;
    try {
      await navigator.share({
        title: classroom.name,
        text: `Join my class "${classroom.name}" on Scholar's Circle — code: ${classroom.joinCode}`,
      });
    } catch { copyCode(); }
  };

  const Row = ({ id, icon, title, sub }) => (
    <button className={`cx-mrow${open === id ? " on" : ""}`} onClick={() => setOpen(open === id ? null : id)}>
      <span className="cx-mrow-ic">{icon}</span>
      <span className="cx-mrow-tx">
        <span className="cx-mrow-title">{title}</span>
        <span className="cx-mrow-sub">{sub}</span>
      </span>
      <span className="cx-mrow-caret">{open === id ? "▲" : "▼"}</span>
    </button>
  );

  return (
    <div className="cx-manage">
      {classroom.joinCode && (
        <div className="cx-invite-card">
          <div className="cx-invite-tx">
            <div className="cx-invite-label">Class invite code</div>
            <div className="cx-invite-code">{classroom.joinCode}</div>
          </div>
          <div className="cx-invite-acts">
            <button className="cx-btn ghost small" onClick={copyCode}>{copied ? "✓ Copied" : "Copy"}</button>
            {"share" in navigator && <button className="cx-btn small" onClick={share}>Share</button>}
          </div>
        </div>
      )}

      <div className="cx-mgroup">
        <Row id="attendance" icon="📋" title="Attendance" sub="Take attendance, view the report" />
        {open === "attendance" && (
          <div className="cx-mbody">
            <AttendancePanel classroomId={classroom.id} isHost token={token} />
          </div>
        )}
      </div>

      <div className="cx-mgroup">
        <Row id="questions" icon="🧠" title="Question bank" sub="AI-generate or bulk-import questions for tests" />
        {open === "questions" && (
          <div className="cx-mbody">
            <QuestionTools subjects={subjects} token={token} />
            <div className="cx-hint" style={{ marginTop: 10 }}>
              Bank questions feed <b>Work → Tests</b>. New questions appear in the picker immediately.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
