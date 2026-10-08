import { useState } from "react";
import { createPortal } from "react-dom";
import { callAIChat, extractJSON } from "../../lib/aiClient";
import { EXAM_LABELS, STATION_TYPES, DEFAULT_CLOSING_POINTS, SPECIALTY_META } from "./caseData.js";
import { validateStation, saveCustomStation } from "./stationLibrary.js";

const VOICE_CHOICES = ["", "Kore", "Sulafat", "Aoede", "Leda", "Vindemiatrix", "Iapetus", "Charon", "Puck", "Fenrir", "Sadachbia", "Achird"];

const AI_DRAFT_SYSTEM = `You are an OSCE station author for medical students. Write a complete, realistic virtual-patient case as a raw JSON object (no markdown fences, no preamble) matching EXACTLY this schema:
{
 "title": string, "bed": string (e.g. "BED 14"), "demo": string (e.g. "Female, 34, teacher"),
 "cc": string (chief complaint, patient's own words), "specialty": string,
 "station_type": "history" | "counselling" | "data",
 "candidate_instructions": string (what the candidate is asked to do),
 "persona": string (personality, emotional state, how they behave — one line),
 "history": { "fact label": "what the patient answers when asked about it", ...8-14 entries },
 "exam": { "general"|"vitals"|"cardiovascular"|"respiratory"|"abdomen"|"neuro"|"msk"|"mental_state"|"genitourinary": "examination findings" },
 "investigations": { "test name (lowercase)": { "result": string, "indicated": boolean } },
 "diagnosis": string (the hidden correct diagnosis),
 "essential_points": string[] (8-14 examiner checklist items the candidate should cover),
 "critical": number[] (0-based indices into essential_points of must-do safety items — usually 1-3),
 "management_key": string[] (6-10 items a good management plan includes),
 "closing_points": string[] (2-4 closing/safety-netting items),
 "viva": string[] (2-4 short examiner follow-up questions),
 "hidden_agenda": { "reveal": string (a private worry the patient only shares if truly invited) }
}
Rules: medically accurate and internally consistent; the patient NEVER names the diagnosis in their answers; exam/investigation findings must support (not trivially announce) the diagnosis; include 1-2 red herrings.`;

const EMPTY = {
  title: "", bed: "", demo: "", cc: "", specialty: "General Medicine",
  station_type: "history", candidate_instructions: "", persona: "",
  history: {}, exam: {}, investigations: {},
  diagnosis: "", essential_points: [], critical: [],
  management_key: [], closing_points: [...DEFAULT_CLOSING_POINTS], viva: [],
  hidden_agenda: { reveal: "" }, voice: "",
};

function rowsOf(obj) {
  return Object.entries(obj || {});
}

export default function StationCreator({ station, aiConfig, onSaved, onClose }) {
  const [d, setD] = useState(() => ({ ...EMPTY, ...(station || {}), hidden_agenda: { reveal: "", ...(station?.hidden_agenda || {}) } }));
  const [errors, setErrors] = useState([]);
  const [aiIdea, setAiIdea] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setSaved(false); };
  const setHist = (oldK, newK, newV) => {
    setD((p) => {
      const h = { ...p.history };
      if (oldK !== newK) delete h[oldK];
      h[newK] = newV;
      return { ...p, history: h };
    });
    setSaved(false);
  };

  async function aiDraft() {
    const idea = aiIdea.trim();
    if (!idea || aiBusy) return;
    setAiBusy(true); setAiErr("");
    try {
      const raw = await callAIChat({
        system: AI_DRAFT_SYSTEM,
        messages: [{ role: "user", content: `Station idea: ${idea}` }],
        provider: aiConfig?.provider,
        model: aiConfig?.model,
      });
      const json = extractJSON(raw);
      if (!json || typeof json !== "object") throw new Error("empty");
      setD((p) => ({ ...p, ...json, id: p.id, custom: true, hidden_agenda: { reveal: "", ...(json.hidden_agenda || {}) } }));
      setSaved(false);
    } catch {
      setAiErr("Couldn't draft that — try a clearer idea, e.g. 'DKA in a 22-year-old student'.");
    }
    setAiBusy(false);
  }

  function save() {
    const v = validateStation(d);
    setErrors(v.errors);
    if (!v.ok) return;
    saveCustomStation(d);
    setSaved(true);
    onSaved?.(v.station);
  }

  const specialties = Object.keys(SPECIALTY_META);

  return createPortal(
    <div className="vp-consult-screen">
      <div className="vp-consult-col" style={{ overflowY: "auto" }}>
        <header className="vp-glass vp-case-top">
          <div className="vp-ct-row1">
            <button className="vp-ct-back" onClick={onClose}>←</button>
            <div className="vp-ct-title-wrap">
              <div className="vp-ct-title">✎ Station Creator</div>
              <div className="vp-ct-sub">Build a playable OSCE case — for solo practice and group rooms</div>
            </div>
          </div>
        </header>

        <div className="vp-sc-body">
          {/* AI draft */}
          <div className="vp-glass vp-sc-sec">
            <div className="vp-panel-title">⚡ AI draft</div>
            <div className="vp-sc-airow">
              <input
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && aiDraft()}
                placeholder="e.g. DKA in a 22-year-old, breaking bad news about miscarriage…"
              />
              <button className="vp-cta-start" onClick={aiDraft} disabled={aiBusy || !aiIdea.trim()}>
                {aiBusy ? "Drafting…" : "Draft it"}
              </button>
            </div>
            {aiErr && <div className="vp-voice-err" style={{ marginTop: 8 }}>⚠ {aiErr}</div>}
            <div className="vp-og-hint">Fills every field below — review and edit before saving. Clinical accuracy is on you.</div>
          </div>

          {/* Basics */}
          <div className="vp-glass vp-sc-sec">
            <div className="vp-panel-title">Station</div>
            <div className="vp-sc-grid2">
              <label>Title<input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Chest pain in a taxi driver" /></label>
              <label>Bed / location<input value={d.bed} onChange={(e) => set("bed", e.target.value)} placeholder="BED 4" /></label>
              <label>Demographics<input value={d.demo} onChange={(e) => set("demo", e.target.value)} placeholder="Male, 58, taxi driver" /></label>
              <label>Specialty
                <select value={d.specialty} onChange={(e) => set("specialty", e.target.value)}>
                  {specialties.map((s) => <option key={s}>{s}</option>)}
                  <option>General Medicine</option>
                </select>
              </label>
            </div>
            <label style={{ marginTop: 10 }}>Chief complaint (patient's own words)
              <input value={d.cc} onChange={(e) => set("cc", e.target.value)} placeholder="It feels like an elephant on my chest, doctor…" />
            </label>
            <label style={{ marginTop: 10 }}>Candidate instructions
              <input value={d.candidate_instructions} onChange={(e) => set("candidate_instructions", e.target.value)} placeholder="Take a history, examine, and discuss your plan" />
            </label>
            <div className="vp-sc-strow">
              {Object.entries(STATION_TYPES).map(([k, t]) => (
                <button key={k} className={`vp-ob-card sm ${d.station_type === k ? "sel" : ""}`} onClick={() => set("station_type", k)}>
                  <span className="vp-ob-emoji">{t.icon}</span>
                  <span><span className="vp-ob-card-t">{t.label}</span></span>
                </button>
              ))}
            </div>
          </div>

          {/* Persona + agenda */}
          <div className="vp-glass vp-sc-sec">
            <div className="vp-panel-title">🎭 Patient persona & hidden agenda</div>
            <label>Persona
              <input value={d.persona} onChange={(e) => set("persona", e.target.value)} placeholder="Anxious, minimises symptoms, apologises for wasting your time" />
            </label>
            <label style={{ marginTop: 10 }}>Hidden agenda — what they only reveal if truly invited
              <textarea value={d.hidden_agenda.reveal} onChange={(e) => setD((p) => ({ ...p, hidden_agenda: { ...p.hidden_agenda, reveal: e.target.value } }))}
                placeholder="Secretly terrified it's cancer — her mother died of it" rows={2} />
            </label>
            <label style={{ marginTop: 10 }}>Voice (voice consults)
              <select value={d.voice || ""} onChange={(e) => set("voice", e.target.value)}>
                {VOICE_CHOICES.map((v) => <option key={v} value={v}>{v || "Auto (by persona)"}</option>)}
              </select>
            </label>
          </div>

          {/* History script */}
          <div className="vp-glass vp-sc-sec">
            <div className="vp-panel-title">📜 History script <span className="vp-og-tickcount">{rowsOf(d.history).length} facts</span></div>
            {rowsOf(d.history).map(([k, v], i) => (
              <div key={i} className="vp-sc-kv">
                <input className="k" value={k} placeholder="Onset" onChange={(e) => setHist(k, e.target.value, v)} />
                <input className="v" value={v} placeholder="What the patient answers" onChange={(e) => setHist(k, k, e.target.value)} />
                <button onClick={() => { const h = { ...d.history }; delete h[k]; set("history", h); }}>✕</button>
              </div>
            ))}
            <button className="vp-back-btn2" onClick={() => set("history", { ...d.history, [`Fact ${rowsOf(d.history).length + 1}`]: "" })}>+ Add fact</button>
          </div>

          {/* Exam findings */}
          <div className="vp-glass vp-sc-sec">
            <div className="vp-panel-title">🩺 Examination findings</div>
            {Object.keys(EXAM_LABELS).map((k) => (
              <label key={k} style={{ display: "block", marginTop: 8 }}>
                {EXAM_ICONS_LABEL[k] || ""} {EXAM_LABELS[k]}
                <input
                  value={d.exam[k] || ""}
                  onChange={(e) => { const x = { ...d.exam }; if (e.target.value.trim()) x[k] = e.target.value; else delete x[k]; set("exam", x); }}
                  placeholder="leave blank = unremarkable"
                />
              </label>
            ))}
          </div>

          {/* Investigations */}
          <div className="vp-glass vp-sc-sec">
            <div className="vp-panel-title">🧪 Investigations</div>
            {rowsOf(d.investigations).map(([name, inv], i) => (
              <div key={i} className="vp-sc-inv">
                <input className="n" value={name} placeholder="ECG"
                  onChange={(e) => { const x = { ...d.investigations }; delete x[name]; x[e.target.value] = inv; set("investigations", x); }} />
                <input className="r" value={inv.result} placeholder="Result"
                  onChange={(e) => { const x = { ...d.investigations }; x[name] = { ...inv, result: e.target.value }; set("investigations", x); }} />
                <label className={`vp-sc-ind ${inv.indicated ? "on" : ""}`}>
                  <input type="checkbox" checked={!!inv.indicated}
                    onChange={(e) => { const x = { ...d.investigations }; x[name] = { ...inv, indicated: e.target.checked }; set("investigations", x); }} />
                  indicated
                </label>
                <button onClick={() => { const x = { ...d.investigations }; delete x[name]; set("investigations", x); }}>✕</button>
              </div>
            ))}
            <button className="vp-back-btn2" onClick={() => set("investigations", { ...d.investigations, [`test${rowsOf(d.investigations).length + 1}`]: { result: "", indicated: false } })}>+ Add investigation</button>
          </div>

          {/* Answer key */}
          <div className="vp-glass vp-sc-sec">
            <div className="vp-panel-title">🔑 Answer key (hidden from candidates)</div>
            <label>Diagnosis<input value={d.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="ST-elevation MI (inferior)" /></label>
            <ListEditor label="Examiner checklist" items={d.essential_points} critical={d.critical}
              onChange={(items, critical) => { setD((p) => ({ ...p, essential_points: items, critical })); setSaved(false); }}
              addLabel="+ Add checklist item" criticalFlags />
            <ListEditor label="Expected management" items={d.management_key}
              onChange={(items) => { set("management_key", items); }} addLabel="+ Add management item" />
            <ListEditor label="Closing & safety-netting" items={d.closing_points}
              onChange={(items) => { set("closing_points", items); }} addLabel="+ Add closing item" />
            <ListEditor label="Viva / examiner questions" items={d.viva}
              onChange={(items) => { set("viva", items); }} addLabel="+ Add viva question" />
          </div>

          {errors.length > 0 && (
            <div className="vp-voice-err" style={{ margin: "0 16px 10px" }}>
              {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
            </div>
          )}

          <div className="vp-sc-footer">
            <button className="vp-cta-start" onClick={save}>{saved ? "✓ Saved" : "Save station"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const EXAM_ICONS_LABEL = {
  general: "🧍", vitals: "🩺", cardiovascular: "🫀", respiratory: "🫁",
  abdomen: "🤢", neuro: "🧠", msk: "🦴", mental_state: "💭", genitourinary: "🚻",
};

function ListEditor({ label, items, onChange, addLabel, critical = [], criticalFlags = false }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="vp-field-lbl">{label} <span className="vp-og-tickcount">{items.length}</span></div>
      {items.map((it, i) => (
        <div key={i} className="vp-sc-li">
          {criticalFlags && (
            <button
              className={`vp-sc-crit ${critical.includes(i) ? "on" : ""}`}
              title="Critical item — missing it caps the grade"
              onClick={() => onChange(items, critical.includes(i) ? critical.filter((x) => x !== i) : [...critical, i])}
            >🚩</button>
          )}
          <input value={it} onChange={(e) => { const l = [...items]; l[i] = e.target.value; onChange(l, critical); }} />
          <button onClick={() => {
            const l = items.filter((_, x) => x !== i);
            onChange(l, criticalFlags ? critical.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) : critical);
          }}>✕</button>
        </div>
      ))}
      <button className="vp-back-btn2" onClick={() => onChange([...items, ""], critical)}>{addLabel}</button>
    </div>
  );
}
