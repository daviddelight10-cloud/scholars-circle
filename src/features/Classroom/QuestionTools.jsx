import { useState } from "react";
import { classTestApi } from "../ClassTests/classTestApi.js";

/**
 * Lecturer question-bank tools — SERVER-backed. Generated/imported
 * questions land in the same bank the class-test picker reads (marked
 * secure/CA-only), replacing the old client-side generator whose output
 * went to a localStorage "Custom Bank" tests could never see.
 */
export function QuestionTools({ subjects = [], token }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [mode, setMode] = useState("generate"); // generate | import

  // generate state
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [qtype, setQtype] = useState("mcq");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {kind, text}

  // import state
  const [csv, setCsv] = useState("");
  const [secure, setSecure] = useState(true);

  const generate = async () => {
    if (!subjectId) return setMsg({ kind: "err", text: "Pick a subject first" });
    if (!topic.trim()) return setMsg({ kind: "err", text: "Enter a topic" });
    setBusy(true); setMsg(null);
    try {
      const r = await classTestApi.generateQuestions({ subjectId, topic: topic.trim(), count, difficulty, questionType: qtype }, token);
      setMsg({ kind: "ok", text: `✓ ${r.count} questions added to your bank (CA-only) — pick them when creating a test.` });
      setTopic("");
    } catch (e) {
      setMsg({ kind: "err", text: e.message || "Generation failed" });
    } finally { setBusy(false); }
  };

  const importCsv = async () => {
    if (!subjectId) return setMsg({ kind: "err", text: "Pick a subject first" });
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return setMsg({ kind: "err", text: "Paste CSV rows first" });
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      // question,A,B,C,D,answerIndex(1-4 or 0-3),[topic],[explanation]
      if (parts.length < 6) return setMsg({ kind: "err", text: `Line ${i + 1}: need question,A,B,C,D,answer` });
      let ai = Number(parts[5]);
      if (ai >= 1 && ai <= 4) ai -= 1;
      if (!(ai >= 0 && ai <= 3)) return setMsg({ kind: "err", text: `Line ${i + 1}: answer must be 1–4` });
      rows.push({
        subjectId, question: parts[0],
        optionA: parts[1], optionB: parts[2], optionC: parts[3], optionD: parts[4],
        answerIndex: ai, topic: parts[6] || undefined, explanation: parts[7] || undefined,
        secure, questionType: "mcq",
      });
    }
    setBusy(true); setMsg(null);
    try {
      const r = await classTestApi.bulkQuestions(rows, token);
      setMsg({ kind: "ok", text: `✓ ${r.count} questions imported to your bank.` });
      setCsv("");
    } catch (e) {
      setMsg({ kind: "err", text: e.message || "Import failed" });
    } finally { setBusy(false); }
  };

  return (
    <div className="cx-qt">
      <div className="cx-field">
        <label className="cx-label">Subject</label>
        <select className="cx-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">— choose subject —</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.label || s.name}</option>)}
        </select>
      </div>

      <div className="cx-seg">
        <button className={`cx-seg-btn${mode === "generate" ? " on" : ""}`} onClick={() => setMode("generate")}>✨ Generate with AI</button>
        <button className={`cx-seg-btn${mode === "import" ? " on" : ""}`} onClick={() => setMode("import")}>⬆ Import CSV</button>
      </div>

      {mode === "generate" ? (
        <>
          <div className="cx-field">
            <label className="cx-label">Topic</label>
            <input className="cx-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cardiac cycle, Moles & stoichiometry" />
          </div>
          <div className="cx-grid3">
            <div className="cx-field">
              <label className="cx-label">Count</label>
              <select className="cx-input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="cx-field">
              <label className="cx-label">Difficulty</label>
              <select className="cx-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
            <div className="cx-field">
              <label className="cx-label">Type</label>
              <select className="cx-input" value={qtype} onChange={(e) => setQtype(e.target.value)}>
                <option value="mcq">MCQ</option><option value="truefalse">True/False</option><option value="fillblank">Fill blank</option>
              </select>
            </div>
          </div>
          <button className="cx-btn full" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "✨ Generate into bank"}
          </button>
          <div className="cx-hint">Generated questions are saved <b>CA-only</b> — students can't pre-read them in practice. Pick them when building a class test.</div>
        </>
      ) : (
        <>
          <div className="cx-field">
            <label className="cx-label">CSV rows — question,A,B,C,D,answer(1–4)</label>
            <textarea className="cx-input" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)}
              placeholder={"What is 2+2,3,4,5,6,2\nSI unit of force,Joule,Newton,Watt,Pascal,2,Units"} />
          </div>
          <label className="cx-check">
            <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
            <span>CA-only (hide from student practice)</span>
          </label>
          <button className="cx-btn full" onClick={importCsv} disabled={busy}>
            {busy ? "Importing…" : "⬆ Import into bank"}
          </button>
        </>
      )}

      {msg && <div className={`cx-msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
