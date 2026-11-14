import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listGroupChallenges } from "../exam/examApi";
import { fmtDeadline } from "../exam/challengeUtils";
import { examFromResource } from "../exam/examApi";
import CreateChallengeSheet from "../exam/CreateChallengeSheet";
import { FdSheet } from "../feed/feedUi.jsx";
import { API_BASE } from "../../lib/constants";

const authHeaders = () => {
  try {
    const d = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return d.authToken ? { Authorization: `Bearer ${d.authToken}` } : {};
  } catch { return {}; }
};

/**
 * Play-tab strip for async exam challenges attached to this group, plus the
 * exam-picker sheet used by the "Exam challenge" start option.
 * `signal` bumps to open the picker from the shared Start chooser.
 */
export default function GroupExamChallenges({ classroomId, startSignal = 0 }) {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedExam, setPickedExam] = useState(null);
  const [exams, setExams] = useState(null);

  const load = useCallback(() => {
    listGroupChallenges(classroomId)
      .then((d) => setChallenges(d?.challenges || []))
      .catch(() => setChallenges([]));
  }, [classroomId]);

  useEffect(() => { load(); }, [load]);

  // External "start an exam challenge" signal from the Play chooser
  // (same pattern as QuizBattles' startSignal).
  useEffect(() => { if (startSignal) setPickerOpen(true); }, [startSignal]);

  // Lazily load the user's saved exams the first time the picker opens.
  useEffect(() => {
    if (!pickerOpen || exams != null) return;
    fetch(`${API_BASE}/api/resources?mine=1`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExams((Array.isArray(data) ? data : []).filter((r) => r.contentType === "exam")))
      .catch(() => setExams([]));
  }, [pickerOpen, exams]);

  const open = (challenges || []).filter((c) => !c.closed);
  const done = (challenges || []).filter((c) => c.closed).slice(0, 3);

  return (
    <>
      {(open.length > 0 || done.length > 0) && (
        <div className="gxc-strip">
          {open.map((c) => (
            <button key={c.id} className="gxc-card" onClick={() => navigate(`/exam/${c.token}`)}>
              <div className="gxc-card-top">
                <span className="gxc-ic">📝</span>
                <div className="gxc-info">
                  <b>{c.exam.name}</b>
                  <span>{c.creatorName} · {c.exam.questionCount}q{c.exam.timeLimitMin ? ` · ${c.exam.timeLimitMin}m` : ""}</span>
                </div>
                <span className="gxc-deadline">{fmtDeadline(c.deadline) || "Open"}</span>
              </div>
              <div className="gxc-card-bottom">
                <span>👥 {c.taken} taken{c.scoring === "best" ? " · best wins" : " · first try"}</span>
                <span className={`gxc-cta${c.myAttempt ? " done" : ""}`}>
                  {c.myAttempt ? `✓ ${Math.round((c.myAttempt.score / (c.myAttempt.total || 1)) * 100)}% — board` : "Take exam →"}
                </span>
              </div>
            </button>
          ))}
          {done.map((c) => (
            <button key={c.id} className="gxc-card closed" onClick={() => navigate(`/exam/${c.token}`)}>
              <div className="gxc-card-top">
                <span className="gxc-ic">🏁</span>
                <div className="gxc-info">
                  <b>{c.exam.name}</b>
                  <span>{c.creatorName} · {c.taken} took it</span>
                </div>
                <span className="gxc-cta">Results →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {pickerOpen && !pickedExam && (
        <FdSheet title="Pick an exam to challenge the group" onClose={() => setPickerOpen(false)}>
          <div className="gxc-picker">
            {exams == null && <div className="gxc-empty">Loading your exams…</div>}
            {exams?.length === 0 && (
              <div className="gxc-empty">
                No saved exams yet — build one from a material in My Space first (Exam tab → Build an exam).
              </div>
            )}
            {(exams || []).map((r) => {
              const p = examFromResource(r);
              return (
                <button key={r.id} className="gv-add-row create" onClick={() => setPickedExam(r)}>
                  📝 {p?.config?.name || r.title}
                  <span className="gxc-exam-sub">{p?.questions?.length || 0} questions{p?.config?.timeLimitMin ? ` · ${p.config.timeLimitMin} min` : ""}</span>
                </button>
              );
            })}
          </div>
        </FdSheet>
      )}

      {pickedExam && (
        <CreateChallengeSheet
          exam={pickedExam}
          fixedGroupId={classroomId}
          onClose={() => { setPickedExam(null); setPickerOpen(false); }}
          onCreated={() => { setPickedExam(null); setPickerOpen(false); load(); }}
        />
      )}
    </>
  );
}
