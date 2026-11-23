import { useState } from "react";
import { classroomApi, initials, attentionBadges, classPalette } from "./classroomApi.js";

function JoinSheet({ token, onJoined, onClose }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const { classroom } = await classroomApi.joinByCode(code, token);
      onJoined(classroom);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cx-modal" onClick={onClose}>
      <div className="cx-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-title">Join a class</div>
        <input
          className="cx-input"
          placeholder="Class code — e.g. MTH4F2"
          value={code}
          autoFocus
          autoCapitalize="characters"
          maxLength={10}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && join()}
          style={{ letterSpacing: 2, fontWeight: 700, fontSize: 16, textAlign: "center" }}
        />
        {err && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{err}</div>}
        <div className="cx-modal-actions">
          <button className="cx-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cx-btn" disabled={busy || code.trim().length < 4} onClick={join}>
            {busy ? "Joining…" : "Join class"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateSheet({ token, subjects, onCreated, onClose }) {
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState(subjects?.[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await classroomApi.create({ name: name.trim(), subjectId: subjectId || undefined }, token);
      onCreated(c);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="cx-modal" onClick={onClose}>
      <div className="cx-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-title">New class</div>
        <input className="cx-input" placeholder="Class name — e.g. MTH111 Calculus" value={name} autoFocus onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} />
        {subjects?.length > 0 && (
          <select className="cx-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label || s.name}</option>)}
          </select>
        )}
        {err && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{err}</div>}
        <div className="cx-modal-actions">
          <button className="cx-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cx-btn" disabled={busy || !name.trim()} onClick={create}>
            {busy ? "Creating…" : "Create class"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Level 1 — your classes, with live badges and one clear action. */
export function ClassList({ classes, attention, teacherMode, token, subjects, onOpen, onChanged }) {
  const [sheet, setSheet] = useState(null); // join | create

  const primary = teacherMode
    ? <button className="cx-btn small" onClick={() => setSheet("create")}>+ New class</button>
    : <button className="cx-btn small" onClick={() => setSheet("join")}>Join class</button>;

  return (
    <div className="cx-root">
      <div className="cx-head">
        <div className="cx-title">🏫 Classes</div>
        {primary}
      </div>

      {classes.length === 0 ? (
        <div className="cx-empty">
          <div className="cx-empty-ic">🏫</div>
          <div className="cx-empty-title">{teacherMode ? "No classes yet" : "You haven't joined a class"}</div>
          <div className="cx-empty-sub">
            {teacherMode
              ? "Create a class to post announcements, run attendance and set tests."
              : "Ask your lecturer for the class code — it looks like MTH4F2."}
          </div>
          {primary}
        </div>
      ) : (
        <div className="cx-list">
          {classes.map((c, i) => {
            const badges = attentionBadges(attention[c.id]);
            const [c1, c2] = classPalette(c.name);
            return (
              <button key={c.id} className="cx-card" style={{ "--d": `${Math.min(i * 45, 400)}ms` }} onClick={() => onOpen(c.id)}>
                <span className="cx-avatar" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, color: "#fff" }}>{initials(c.name)}</span>
                <span className="cx-card-main">
                  <span className="cx-card-name">{c.name}</span>
                  <span className="cx-card-meta">
                    {teacherMode ? `${c._count?.members ?? 0} student${(c._count?.members ?? 0) === 1 ? "" : "s"}` : `${c.createdBy?.fullName || c.createdBy?.username || "Lecturer"} · ${c._count?.members ?? 0} members`}
                  </span>
                  {badges.length > 0 && (
                    <span className="cx-badges">
                      {badges.map((b) => <span key={b.label} className={`cx-badge ${b.kind}`}>{b.icon} {b.label}</span>)}
                    </span>
                  )}
                </span>
                <span className="cx-card-arrow">›</span>
              </button>
            );
          })}
        </div>
      )}

      {sheet === "join" && (
        <JoinSheet
          token={token}
          onClose={() => setSheet(null)}
          onJoined={(c) => { setSheet(null); onChanged(); onOpen(c.id); }}
        />
      )}
      {sheet === "create" && (
        <CreateSheet
          token={token}
          subjects={subjects}
          onClose={() => setSheet(null)}
          onCreated={(c) => { setSheet(null); onChanged(); onOpen(c.id); }}
        />
      )}
    </div>
  );
}
