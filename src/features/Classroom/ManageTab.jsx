import { useState } from "react";
import { AttendancePanel } from "../Attendance/AttendancePanel.jsx";
import { BulkImport, AIQuestionGen } from "../../components/SmallComponents.jsx";

/**
 * Manage (lecturer only): run attendance, review the report, grow the
 * question bank, and share the class invite code.
 */
export function ManageTab({ classroom, token, onImportQuestions }) {
  const [copied, setCopied] = useState(false);
  const [showTools, setShowTools] = useState(false);

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

  return (
    <div>
      {/* Invite */}
      {classroom.joinCode && (
        <div className="cx-code-box" style={{ marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--app-dim)", marginBottom: 3 }}>Class invite code</div>
            <div className="cx-code">{classroom.joinCode}</div>
          </div>
          <button className="cx-btn ghost small" onClick={copyCode}>{copied ? "Copied ✓" : "Copy"}</button>
          {"share" in navigator && <button className="cx-btn small" onClick={share}>Share</button>}
        </div>
      )}

      <div className="cx-section">📋 Attendance</div>
      <AttendancePanel classroomId={classroom.id} isHost token={token} />

      <div className="cx-section">🛠️ Question bank tools</div>
      <div className="cx-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setShowTools((s) => !s)}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)" }}>Bulk import & AI generate</span>
          <span style={{ color: "var(--app-dim)" }}>{showTools ? "▲" : "▼"}</span>
        </div>
        {showTools && (
          <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <BulkImport onImportQuestions={onImportQuestions} />
            <AIQuestionGen onImportQuestions={onImportQuestions} />
          </div>
        )}
      </div>

      <div className="cx-panel-meta" style={{ marginTop: 14 }}>
        Question bank feeds your class tests — create a test under Work → Tests.
      </div>
    </div>
  );
}
