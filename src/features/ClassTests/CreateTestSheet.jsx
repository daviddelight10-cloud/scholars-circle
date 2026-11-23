import { useEffect, useMemo, useState } from "react";
import { classTestApi } from "./classTestApi.js";

const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const TYPE_LABEL = { mcq: "MCQ", truefalse: "T/F", fillblank: "Fill-in" };
const EMPTY_MANUAL = { type: "mcq", question: "", options: ["", "", "", ""], answerIndex: 0, answerText: "", marks: 1, topic: "", explanation: "", saveToBank: false, secure: true };

function bankToSelected(q) {
  return {
    question: q.question,
    optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
    answerIndex: q.answerIndex, explanation: q.explanation, topic: q.topic,
    questionType: q.questionType || "mcq", answerText: q.answerText || null,
    marks: 1, _secure: q.secure,
  };
}

/** Lecturer: build a class test — pick from the bank and/or write questions inline. */
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
    showAnswers: false,
    published: true,
  });
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [bank, setBank] = useState(null); // null = loading
  const [topicFilter, setTopicFilter] = useState("");
  const [selected, setSelected] = useState(new Map()); // key → question payload
  const [quota, setQuota] = useState({}); // topic → count input
  const [manual, setManual] = useState(null); // null | manual draft
  const [gen, setGen] = useState(null); // null | AI-generate draft
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
  const byTopic = useMemo(() => {
    const m = new Map();
    for (const q of visible) {
      const k = q.topic || "General";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(q);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const selKey = (q) => q.id;
  const toggle = (q) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(selKey(q))) next.delete(selKey(q));
      else next.set(selKey(q), bankToSelected(q));
      return next;
    });
  };

  const addRandom = (n, pool = visible) => {
    const avail = pool.filter((q) => !selected.has(selKey(q)));
    const pick = [...avail].sort(() => Math.random() - 0.5).slice(0, n);
    if (!pick.length) return;
    setSelected((prev) => {
      const next = new Map(prev);
      for (const q of pick) next.set(selKey(q), bankToSelected(q));
      return next;
    });
  };

  const addTopicQuota = (topic) => {
    const n = Math.max(1, parseInt(quota[topic]) || 5);
    const pool = (bank || []).filter((q) => (q.topic || "General") === topic);
    addRandom(n, pool);
  };

  const setMarks = (key, v) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const q = next.get(key);
      if (q) next.set(key, { ...q, marks: Math.min(20, Math.max(1, parseInt(v) || 1)) });
      return next;
    });
  };

  const manualValid = () => {
    if (!manual) return false;
    if (!manual.question.trim()) return false;
    if (manual.type === "fillblank") return !!manual.answerText.trim();
    if (manual.type === "truefalse") return [0, 1].includes(manual.answerIndex);
    return manual.options.filter((o) => o.trim()).length >= 2 && !!manual.options[manual.answerIndex]?.trim();
  };

  const addManual = async () => {
    if (!manualValid()) return;
    let payload;
    if (manual.type === "fillblank") {
      payload = { questionType: "fillblank", question: manual.question.trim(), answerText: manual.answerText.trim(), marks: manual.marks, topic: manual.topic.trim() || null, explanation: manual.explanation.trim() || null };
    } else if (manual.type === "truefalse") {
      payload = { questionType: "truefalse", question: manual.question.trim(), optionA: "True", optionB: "False", optionC: "", optionD: "", answerIndex: manual.answerIndex, marks: manual.marks, topic: manual.topic.trim() || null, explanation: manual.explanation.trim() || null };
    } else {
      payload = {
        questionType: "mcq", question: manual.question.trim(),
        optionA: manual.options[0].trim(), optionB: manual.options[1].trim(),
        optionC: manual.options[2].trim(), optionD: manual.options[3].trim(),
        answerIndex: manual.answerIndex, marks: manual.marks,
        topic: manual.topic.trim() || null, explanation: manual.explanation.trim() || null,
      };
    }
    const key = `manual-${Date.now()}`;
    if (manual.saveToBank && subjectId) {
      try {
        const saved = await classTestApi.addBankQuestion({ ...payload, subjectId, secure: manual.secure }, token);
        setBank((b) => (b ? [...b, saved] : b));
        setSelected((prev) => new Map(prev).set(saved.id, { ...bankToSelected(saved), marks: payload.marks }));
        setManual(null);
        return;
      } catch { /* fall through — keep it as a test-only question */ }
    }
    setSelected((prev) => new Map(prev).set(key, payload));
    setManual(null);
  };

  // AI-generate straight into the server bank (secure/CA-only) and select
  // them for this test — the fix for "tests use old MCQ data".
  const runGenerate = async () => {
    if (!gen?.topic?.trim()) return setGen((g) => ({ ...g, error: "Enter a topic" }));
    if (!subjectId) return setGen((g) => ({ ...g, error: "Pick a subject above" }));
    setGen((g) => ({ ...g, busy: true, error: null }));
    try {
      const r = await classTestApi.generateQuestions(
        { subjectId, topic: gen.topic.trim(), count: gen.count, difficulty: gen.difficulty, questionType: gen.qtype },
        token
      );
      const rows = r.questions || [];
      setBank((b) => (b ? [...b, ...rows] : rows));
      setSelected((prev) => {
        const next = new Map(prev);
        for (const q of rows) next.set(selKey(q), bankToSelected(q));
        return next;
      });
      setGen(null);
    } catch (e) {
      setGen((g) => ({ ...g, busy: false, error: e.message || "Generation failed" }));
    }
  };

  const submit = async () => {
    setErr(null);
    if (!form.title.trim()) return setErr("Give the test a title");
    if (selected.size === 0) return setErr("Add at least one question");
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
            <label className="ct-toggle"><input type="checkbox" checked={form.showAnswers} onChange={set("showAnswers")} /> Review answers after close</label>
            <label className="ct-toggle"><input type="checkbox" checked={form.published} onChange={set("published")} /> Publish now</label>
          </div>
        </div>

        {/* Selected summary — marks editable per question */}
        {selected.size > 0 && (
          <div className="ct-selbox">
            <div className="ct-label" style={{ marginBottom: 4 }}>Selected — {selected.size} questions · {[...selected.values()].reduce((s, q) => s + q.marks, 0)} marks</div>
            {[...selected.entries()].map(([key, q]) => (
              <div key={key} className="ct-selrow">
                <span className="ct-typebadge">{TYPE_LABEL[q.questionType || "mcq"]}</span>
                <span className="ct-selrow-text">{q.question}</span>
                <input
                  className="ct-input ct-marks" type="number" min={1} max={20}
                  value={q.marks} title="Marks"
                  onChange={(e) => setMarks(key, e.target.value)}
                />
                <button className="ct-selrow-x" onClick={() => setSelected((p) => { const n = new Map(p); n.delete(key); return n; })}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="ct-label">Questions — pick from your bank or write new ones</div>
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
            <button className="ct-btn ghost small" onClick={() => setGen(gen ? null : { topic: "", count: 10, difficulty: "medium", qtype: "mcq", busy: false, error: null })}>✨ Generate</button>
            <button className="ct-btn small" style={{ marginLeft: "auto" }} onClick={() => setManual(manual ? null : { ...EMPTY_MANUAL })}>✍️ Write question</button>
            {selected.size > 0 && <button className="ct-btn danger small" onClick={() => setSelected(new Map())}>Clear</button>}
          </div>

          {/* AI generate — server-side, lands in the bank as CA-only */}
          {gen && (
            <div className="ct-manual">
              <div className="ct-row">
                <input className="ct-input" placeholder="Topic — e.g. Cardiac cycle" value={gen.topic} onChange={(e) => setGen((g) => ({ ...g, topic: e.target.value }))} />
                <select className="ct-input" value={gen.count} onChange={(e) => setGen((g) => ({ ...g, count: Number(e.target.value) }))}>
                  {[5, 10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n} questions</option>)}
                </select>
              </div>
              <div className="ct-row">
                <select className="ct-input" value={gen.difficulty} onChange={(e) => setGen((g) => ({ ...g, difficulty: e.target.value }))}>
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select>
                <select className="ct-input" value={gen.qtype} onChange={(e) => setGen((g) => ({ ...g, qtype: e.target.value }))}>
                  <option value="mcq">Multiple choice</option><option value="truefalse">True / False</option><option value="fillblank">Fill in the blank</option>
                </select>
              </div>
              {gen.error && <div style={{ fontSize: 12, color: "#f87171" }}>{gen.error}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ct-btn ghost small" style={{ flex: 1 }} onClick={() => setGen(null)}>Cancel</button>
                <button className="ct-btn small" style={{ flex: 1 }} disabled={gen.busy} onClick={runGenerate}>
                  {gen.busy ? "Generating…" : `✨ Generate ${gen.count} into test`}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--app-dim)" }}>
                Saved to your bank as CA-only and auto-selected below.
              </div>
            </div>
          )}

          {/* Inline question writer */}
          {manual && (
            <div className="ct-manual">
              <div className="ct-typebar">
                {[["mcq", "Multiple choice"], ["truefalse", "True / False"], ["fillblank", "Fill in the blank"]].map(([v, l]) => (
                  <button key={v} className={`ct-btn small${manual.type === v ? "" : " ghost"}`} onClick={() => setManual((m) => ({ ...m, type: v }))}>{l}</button>
                ))}
              </div>
              <textarea className="ct-input" rows={2} placeholder="Question" value={manual.question} onChange={(e) => setManual((m) => ({ ...m, question: e.target.value }))} />
              {manual.type === "mcq" && manual.options.map((o, i) => (
                <div key={i} className="ct-optrow">
                  <input type="radio" name="ct-correct" checked={manual.answerIndex === i} onChange={() => setManual((m) => ({ ...m, answerIndex: i }))} title="Correct answer" />
                  <input className="ct-input" placeholder={`Option ${"ABCD"[i]}`} value={o} onChange={(e) => setManual((m) => { const opts = [...m.options]; opts[i] = e.target.value; return { ...m, options: opts }; })} />
                </div>
              ))}
              {manual.type === "truefalse" && (
                <div style={{ display: "flex", gap: 12 }}>
                  {[["True", 0], ["False", 1]].map(([l, v]) => (
                    <label key={v} className="ct-toggle"><input type="radio" name="ct-tf" checked={manual.answerIndex === v} onChange={() => setManual((m) => ({ ...m, answerIndex: v }))} /> {l}</label>
                  ))}
                </div>
              )}
              {manual.type === "fillblank" && (
                <input className="ct-input" placeholder="Accepted answer (separate variants with | )" value={manual.answerText} onChange={(e) => setManual((m) => ({ ...m, answerText: e.target.value }))} />
              )}
              <div className="ct-row">
                <input className="ct-input" type="number" min={1} max={20} placeholder="Marks" value={manual.marks} onChange={(e) => setManual((m) => ({ ...m, marks: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) }))} />
                <input className="ct-input" placeholder="Topic (optional)" value={manual.topic} onChange={(e) => setManual((m) => ({ ...m, topic: e.target.value }))} />
              </div>
              <input className="ct-input" placeholder="Explanation shown in review (optional)" value={manual.explanation} onChange={(e) => setManual((m) => ({ ...m, explanation: e.target.value }))} />
              {manual.type === "mcq" && subjectId && (
                <label className="ct-toggle">
                  <input type="checkbox" checked={manual.saveToBank} onChange={(e) => setManual((m) => ({ ...m, saveToBank: e.target.checked }))} />
                  Also save to question bank
                  {manual.saveToBank && (
                    <span style={{ marginLeft: 4 }}>
                      (<input type="checkbox" checked={manual.secure} onChange={(e) => setManual((m) => ({ ...m, secure: e.target.checked }))} /> CA-only — hidden from student practice)
                    </span>
                  )}
                </label>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ct-btn ghost small" style={{ flex: 1 }} onClick={() => setManual(null)}>Cancel</button>
                <button className="ct-btn small" style={{ flex: 1 }} disabled={!manualValid()} onClick={addManual}>Add to test</button>
              </div>
            </div>
          )}

          <div className="ct-picker-list">
            {bank === null ? (
              <div className="ct-empty-sub" style={{ padding: 16 }}>Loading question bank…</div>
            ) : byTopic.length === 0 ? (
              <div className="ct-empty-sub" style={{ padding: 16 }}>
                No bank questions for this subject — write one above, or add via Question Tools.
              </div>
            ) : (
              byTopic.map(([topic, qs]) => (
                <div key={topic}>
                  <div className="ct-topic-head">
                    <span>{topic} ({qs.length})</span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        className="ct-quota" type="number" min={1} max={99}
                        value={quota[topic] ?? ""} placeholder="5"
                        onChange={(e) => setQuota((q) => ({ ...q, [topic]: e.target.value }))}
                      />
                      <button onClick={() => addTopicQuota(topic)}>+ pick random</button>
                    </span>
                  </div>
                  {qs.slice(0, 100).map((q) => (
                    <label key={q.id} className="ct-qrow">
                      <input type="checkbox" checked={selected.has(selKey(q))} onChange={() => toggle(q)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ct-qrow-text">
                          {(q.questionType && q.questionType !== "mcq") && <span className="ct-typebadge">{TYPE_LABEL[q.questionType]}</span>}{" "}
                          {q.question}
                        </div>
                        <div className="ct-qrow-meta">
                          {q.topic || "General"}{q.difficulty ? ` · ${q.difficulty}` : ""}
                          {q.secure && <span className="ct-chip draft" style={{ marginLeft: 6 }}>CA-only</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
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
