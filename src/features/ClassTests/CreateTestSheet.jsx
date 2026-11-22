import { useEffect, useMemo, useState } from "react";
import { classTestApi } from "./classTestApi.js";

const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Lecturer: build a class test from the question bank. */
export function CreateTestSheet({ classroomId, token, subjects, onDone, onCancel }) {
  const now = new Date();
  const [form, setForm] = useState({
    title: "",
    instructions: "",
    durationMin: 30,
    opensAt: toLocalInput(now),
    closesAt: toLocalInput(new Date(now.getTime() + 2 * 3600 * 1000)),
    shuffleQ: true,
    shuffleOpt: true,
    showScore: true,
    published: true,
  });
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [bank, setBank] = useState(null); // null = loading
  const [topicFilter, setTopicFilter] = useState("");
  const [selected, setSelected] = useState(new Map()); // bankId → question payload
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!subjectId) { setBank([]); return; }
    setBank(null);
    classTestApi.bankQuestions(subjectId, token)
      .then((rows) => setBank(rows || []))
      .catch(() => setBank([]));
  }, [subjectId, token]);

  const topics = useMemo(() => [...new Set((bank || []).map((q) => q.topic).filter(Boolean))].sort(), [bank]);
  const visible = useMemo(() => (bank || []).filter((q) => !topicFilter || q.topic === topicFilter), [bank, topicFilter]);

  const toggle = (q) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, {
        question: q.question, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        answerIndex: q.answerIndex, explanation: q.explanation, topic: q.topic, marks: 1,
      });
      return next;
    });
  };

  const addRandom = (n) => {
    const pool = visible.filter((q) => !selected.has(q.id));
    const pick = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    if (!pick.length) return;
    setSelected((prev) => {
      const next = new Map(prev);
      for (const q of pick) next.set(q.id, {
        question: q.question, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        answerIndex: q.answerIndex, explanation: q.explanation, topic: q.topic, marks: 1,
      });
      return next;
    });
  };

  const submit = async () => {
    setErr(null);
    if (!form.title.trim()) return setErr("Give the test a title");
    if (selected.size === 0) return setErr("Pick at least one question");
    if (new Date(form.closesAt) <= new Date(form.opensAt)) return setErr("Closing time must be after opening time");
    setSaving(true);
    try {
      await classTestApi.create(classroomId, { ...form, questions: [...selected.values()] }, token);
      onDone();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="ct-sheet-head">
        <div className="ct-sheet-title">New class test</div>
        <button className="ct-btn ghost small" onClick={onCancel}>← Back</button>
      </div>

      <div className="ct-form">
        <input className="ct-input" placeholder="Title — e.g. MTH111 CA Test 2" value={form.title} onChange={set("title")} />
        <textarea className="ct-input" rows={2} placeholder="Instructions for students (optional)" value={form.instructions} onChange={set("instructions")} />

        <div className="ct-row">
          <div>
            <div className="ct-label">Opens</div>
            <input className="ct-input" type="datetime-local" value={form.opensAt} onChange={set("opensAt")} />
          </div>
          <div>
            <div className="ct-label">Closes</div>
            <input className="ct-input" type="datetime-local" value={form.closesAt} onChange={set("closesAt")} />
          </div>
        </div>
        <div className="ct-row">
          <div>
            <div className="ct-label">Duration (min)</div>
            <input className="ct-input" type="number" min={1} max={300} value={form.durationMin} onChange={set("durationMin")} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
            <label className="ct-toggle"><input type="checkbox" checked={form.shuffleQ} onChange={set("shuffleQ")} /> Shuffle questions</label>
            <label className="ct-toggle"><input type="checkbox" checked={form.shuffleOpt} onChange={set("shuffleOpt")} /> Shuffle options</label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
            <label className="ct-toggle"><input type="checkbox" checked={form.showScore} onChange={set("showScore")} /> Show score on submit</label>
            <label className="ct-toggle"><input type="checkbox" checked={form.published} onChange={set("published")} /> Publish now</label>
          </div>
        </div>

        <div className="ct-label">Questions — {selected.size} selected</div>
        <div className="ct-picker">
          <div className="ct-picker-bar">
            <select className="ct-input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicFilter(""); }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.label || s.name}</option>)}
            </select>
            <select className="ct-input" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
              <option value="">All topics</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="ct-picker-bar" style={{ borderBottom: "1px solid var(--app-border, rgba(255,255,255,0.08))" }}>
            <button className="ct-btn ghost small" onClick={() => addRandom(10)}>+10 random</button>
            <button className="ct-btn ghost small" onClick={() => addRandom(20)}>+20 random</button>
            <button className="ct-btn ghost small" onClick={() => addRandom(visible.length)}>All shown ({visible.length})</button>
            {selected.size > 0 && <button className="ct-btn danger small" onClick={() => setSelected(new Map())}>Clear</button>}
          </div>
          <div className="ct-picker-list">
            {bank === null ? (
              <div className="ct-empty-sub" style={{ padding: 16 }}>Loading question bank…</div>
            ) : visible.length === 0 ? (
              <div className="ct-empty-sub" style={{ padding: 16 }}>
                No bank questions for this subject yet — add some via Question Tools below, then come back.
              </div>
            ) : (
              visible.slice(0, 300).map((q) => (
                <label key={q.id} className="ct-qrow">
                  <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q)} />
                  <div>
                    <div className="ct-qrow-text">{q.question}</div>
                    <div className="ct-qrow-meta">{q.topic || "General"}{q.difficulty ? ` · ${q.difficulty}` : ""}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {err && <div style={{ fontSize: 12, color: "#f87171" }}>{err}</div>}
        <button className="ct-btn" disabled={saving} onClick={submit}>
          {saving ? "Creating…" : `Create test · ${selected.size} questions`}
        </button>
      </div>
    </div>
  );
}
