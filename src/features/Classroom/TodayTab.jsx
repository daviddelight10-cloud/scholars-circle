import { useCallback, useEffect, useState } from "react";
import { classroomApi } from "./classroomApi.js";
import { attendanceApi } from "../Attendance/attendanceApi.js";
import { MarkCard } from "../Attendance/StudentAttendance.jsx";

const daysUntil = (d) => Math.ceil((new Date(d) - Date.now()) / 86400000);
const fmtShort = (d) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Today: everything that needs you right now, then what's next.
 * Students see the attendance prompt + open test here instead of hunting tabs.
 */
export function TodayTab({ classroom, attentionItems, isHost, token, onGoWork, onGoManage, onChanged }) {
  const [activeAttn, setActiveAttn] = useState([]);
  const [myRate, setMyRate] = useState(null);
  const [composer, setComposer] = useState({ title: "", content: "", isImportant: false });
  const [posting, setPosting] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const attnOpen = attentionItems.some((i) => i.type === "attendance" && !i.marked);

  const loadAttendance = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([
        attendanceApi.active(token, classroom.id),
        attendanceApi.mine(token, classroom.id),
      ]);
      setActiveAttn(a.sessions || []);
      const mine = m?.classrooms?.[0];
      setMyRate(mine && mine.totalSessions > 0 ? { rate: mine.rate, attended: mine.attended, total: mine.totalSessions, threshold: m.threshold } : null);
    } catch {}
  }, [token, classroom.id]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);
  useEffect(() => {
    const t = setInterval(loadAttendance, 15000);
    return () => clearInterval(t);
  }, [loadAttendance]);

  const openTests = attentionItems.filter((i) => i.type === "test" && !i.done);
  const dueWork = attentionItems.filter((i) => i.type === "assignment");
  const exams = (classroom.exams || []).filter((e) => new Date(e.examDate) > new Date());
  const nextExam = exams[0];
  const announcements = classroom.announcements || [];

  const post = async () => {
    if (!composer.title.trim() || !composer.content.trim()) return;
    setPosting(true);
    try {
      await classroomApi.addAnnouncement(classroom.id, composer, token);
      setComposer({ title: "", content: "", isImportant: false });
      setShowComposer(false);
      onChanged();
    } catch (e) {
      alert(e.message);
    } finally {
      setPosting(false);
    }
  };

  const hasAttention = activeAttn.length > 0 || openTests.length > 0 || dueWork.length > 0;

  return (
    <div>
      {/* ── Needs your attention ── */}
      {activeAttn.map((s) => (
        <div key={s.id} className="cx-attn-card attendance" style={{ display: "block", padding: 0, border: "none", background: "transparent" }}>
          <MarkCard s={s} token={token} onDone={loadAttendance} />
        </div>
      ))}
      {(openTests.length > 0 || dueWork.length > 0) && (
        <div className="cx-attn">
          {openTests.map((t) => (
            <button key={t.id} className="cx-attn-card test" style={{ textAlign: "left" }} onClick={() => onGoWork("tests")}>
              <span className="cx-attn-ic">✍️</span>
              <span className="cx-attn-main">
                <span className="cx-attn-title">{t.title}</span>
                <span className="cx-attn-sub">{t.durationMin} min · closes {fmtShort(t.closesAt)}</span>
              </span>
              <span className="cx-attn-go">Start →</span>
            </button>
          ))}
          {dueWork.map((a) => (
            <button key={a.id} className="cx-attn-card assignment" style={{ textAlign: "left" }} onClick={() => onGoWork("assignments")}>
              <span className="cx-attn-ic">📝</span>
              <span className="cx-attn-main">
                <span className="cx-attn-title">{a.title}</span>
                <span className="cx-attn-sub">Due {fmtShort(a.dueAt)}</span>
              </span>
              <span className="cx-attn-go">Open →</span>
            </button>
          ))}
        </div>
      )}
      {isHost && (
        <div className="cx-attn">
          <button className="cx-attn-card attendance" style={{ textAlign: "left" }} onClick={onGoManage}>
            <span className="cx-attn-ic">📋</span>
            <span className="cx-attn-main">
              <span className="cx-attn-title">{attnOpen ? "Attendance is running" : "Take attendance"}</span>
              <span className="cx-attn-sub">In-hall code + QR for this lecture</span>
            </span>
            <span className="cx-attn-go">Open →</span>
          </button>
        </div>
      )}
      {!hasAttention && !isHost && (
        <div className="cx-panel" style={{ textAlign: "center", padding: "14px" }}>
          <span style={{ fontSize: 12, color: "var(--app-dim)" }}>✨ Nothing needs you right now — you're all caught up.</span>
        </div>
      )}

      {/* ── My attendance ── */}
      {myRate && !isHost && (
        <div className="cx-panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="cx-panel-title">My attendance</div>
            <div className="cx-panel-meta">{myRate.attended} of {myRate.total} sessions · {myRate.threshold}% needed for exams</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: myRate.rate >= myRate.threshold ? "#34d399" : myRate.rate >= 50 ? "#fbbf24" : "#f87171" }}>{myRate.rate}%</div>
        </div>
      )}

      {/* ── Next exam ── */}
      {nextExam && (
        <div className="cx-exam-banner">
          📅 {nextExam.title} — in {daysUntil(nextExam.examDate)} day{daysUntil(nextExam.examDate) === 1 ? "" : "s"} · {new Date(nextExam.examDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </div>
      )}

      {/* ── Announcements ── */}
      <div className="cx-section">Announcements</div>
      {isHost && (
        showComposer ? (
          <div className="cx-panel">
            <input className="cx-input" placeholder="Title" value={composer.title} onChange={(e) => setComposer((c) => ({ ...c, title: e.target.value }))} style={{ marginBottom: 8 }} />
            <textarea className="cx-input" rows={3} placeholder="What should the class know?" value={composer.content} onChange={(e) => setComposer((c) => ({ ...c, content: e.target.value }))} style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--app-dim)", cursor: "pointer" }}>
                <input type="checkbox" checked={composer.isImportant} onChange={(e) => setComposer((c) => ({ ...c, isImportant: e.target.checked }))} />⚠️ Important
              </label>
              <button className="cx-btn ghost small" onClick={() => setShowComposer(false)}>Cancel</button>
              <button className="cx-btn small" style={{ marginLeft: "auto" }} disabled={posting} onClick={post}>{posting ? "Posting…" : "Post"}</button>
            </div>
          </div>
        ) : (
          <button className="cx-btn ghost small" style={{ marginBottom: 10 }} onClick={() => setShowComposer(true)}>📢 Post announcement</button>
        )
      )}
      {announcements.length === 0 ? (
        <div className="cx-empty" style={{ padding: "24px 16px" }}>
          <div className="cx-empty-ic">📭</div>
          <div className="cx-empty-sub">{isHost ? "Post your first announcement above." : "No announcements yet — check back later."}</div>
        </div>
      ) : (
        announcements.slice(0, 15).map((a) => (
          <div key={a.id} className={`cx-panel${a.isImportant ? " important" : ""}`}>
            <div className="cx-panel-title">{a.isImportant ? "⚠️ " : ""}{a.title}</div>
            <div className="cx-panel-body">{a.content}</div>
            <div className="cx-panel-meta">{new Date(a.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))
      )}
    </div>
  );
}
