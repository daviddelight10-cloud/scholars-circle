import { useEffect, useMemo, useState } from "react";
import CircleSheet from "./CircleSheet.jsx";
import { autoQuestionCount, maxSupportedQuestions, DEFAULT_QUESTION_CAP, AUTO_SCALE_MAX, FREE_MCQ_TOTAL_CAP } from "../../lib/generationCore.js";

const PREFS_KEY = "sc_mcq_gen_prefs";
const STYLES = [
  ["mixed", "Mixed", "A balance of facts, short scenarios and patient cases."],
  ["recall", "Recall", "Direct facts, definitions and key values."],
  ["applied", "Applied", "Short scenarios that apply a concept."],
  ["vignette", "Clinical case", "Patient vignette with findings, then diagnosis or next step."],
];
const DIFFS = [["mixed", "Mixed"], ["easy", "Easy"], ["hard", "Hard"]];
const PRESETS = [
  { id: "quick", name: "Quick check", sub: "10 questions", cfg: { count: 10, style: "mixed", difficulty: "mixed", realWorld: false, highYield: false } },
  { id: "std", name: "Standard", sub: "20 questions", cfg: { count: 20, style: "mixed", difficulty: "mixed", realWorld: false, highYield: false } },
  { id: "deep", name: "Deep dive", sub: "50 questions", cfg: { count: 50, style: "applied", difficulty: "mixed", realWorld: true, highYield: false } },
  { id: "exam", name: "Exam prep", sub: "100 clinical cases", cfg: { count: 100, style: "vignette", difficulty: "hard", realWorld: true, highYield: true } },
];

const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {}; } catch { return {}; } };

function genTime(count, verify) {
  const rounds = Math.ceil(Math.ceil(count / 25) / 3);
  const secs = rounds * 30 + (verify ? rounds * 15 : 0);
  return secs < 60 ? "under a minute" : `about ${Math.ceil(secs / 60)} min`;
}

export default function GenerateMcqSheet({ open, onClose, resource, analyze, onGenerate, isPaid, remainingFree }) {
  const [state, setState] = useState({ status: "idle", data: null, error: "" });
  const [mode, setMode] = useState("auto");
  const prefs = useMemo(loadPrefs, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [count, setCount] = useState(prefs.count || 20);
  const [style, setStyle] = useState(prefs.style || "mixed");
  const [difficulty, setDifficulty] = useState(prefs.difficulty || "mixed");
  const [realWorld, setRealWorld] = useState(!!prefs.realWorld);
  const [highYield, setHighYield] = useState(!!prefs.highYield);
  const [verify, setVerify] = useState(prefs.verify !== false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [pFrom, setPFrom] = useState("");
  const [pTo, setPTo] = useState("");
  const [showLock, setShowLock] = useState(false);

  useEffect(() => {
    if (!open || !resource) return;
    setMode("auto"); setShowLock(false); setFocusOpen(false); setTopic(""); setPFrom(""); setPTo("");
    let live = true;
    setState({ status: "loading", data: null, error: "" });
    analyze(resource)
      .then((data) => { if (live) setState({ status: "ready", data, error: "" }); })
      .catch((e) => { if (live) setState({ status: "error", data: null, error: e?.message || "Couldn't read this material." }); });
    return () => { live = false; };
  }, [open, resource?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = state.data;
  const isBank = !!data && data.existingCount >= 5;
  const pages = data?.pages || 0;
  const rangeOn = focusOpen && pages > 1 && (pFrom || pTo);
  const effChars = useMemo(() => {
    if (!data) return 0;
    if (!rangeOn || !data.pageStarts?.length) return data.chars;
    const ps = data.pageStarts;
    const from = Math.max(1, Math.min(parseInt(pFrom, 10) || 1, ps.length));
    const to = Math.max(from, Math.min(parseInt(pTo, 10) || ps.length, ps.length));
    return (to < ps.length ? ps[to] : data.chars) - ps[from - 1];
  }, [data, rangeOn, pFrom, pTo]);
  const maxQ = data ? Math.min(DEFAULT_QUESTION_CAP, maxSupportedQuestions(effChars)) : DEFAULT_QUESTION_CAP;
  const autoN = data ? autoQuestionCount(effChars, isPaid ? AUTO_SCALE_MAX : FREE_MCQ_TOTAL_CAP) : 20;
  // `maxQ` is a guidance estimate only — premium users may push past it up to
  // the hard 200 cap (the engine warns when the doc truly can't reach).
  const n = Math.max(1, Math.min(count, DEFAULT_QUESTION_CAP));
  const shortDoc = data && maxQ < 20;

  const clampSet = (v) => setCount(Math.max(1, Math.min(parseInt(v, 10) || 1, DEFAULT_QUESTION_CAP)));
  const applyPreset = (p) => { setCount(p.cfg.count); setStyle(p.cfg.style); setDifficulty(p.cfg.difficulty); setRealWorld(p.cfg.realWorld); setHighYield(p.cfg.highYield); };
  const openCustom = () => { if (!isPaid) { setShowLock(true); return; } setShowLock(false); setMode("custom"); };

  const styleName = STYLES.find((s) => s[0] === style)?.[1] || "";
  const go = () => {
    if (isBank) { onGenerate(null); return; }
    if (mode === "custom") {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify({ count: n, style, difficulty, realWorld, highYield, verify })); } catch {}
      const pageRange = rangeOn ? { from: parseInt(pFrom, 10) || 1, to: parseInt(pTo, 10) || pages } : null;
      onGenerate({ mode: "custom", count: n, style, difficulty, realWorld, highYield, verify, focusTopic: topic.trim(), pageRange });
    } else {
      onGenerate({ mode: "auto", count: autoN, style: "mixed", difficulty: "mixed" });
    }
  };

  const total = isBank ? data.existingCount : mode === "custom" ? n : autoN;
  const ready = state.status === "ready";

  return (
    <CircleSheet open={open} onClose={onClose} title={resource?.title} kind="Practice Questions">
      {open && (
        <div className="gm">
          {state.status === "loading" && (
            <div className="gm-load" role="status"><span className="gm-spin" />Checking your material…</div>
          )}
          {state.status === "error" && <p className="gm-err">{state.error}</p>}

          {ready && isBank && (
            <div className="gm-card on">
              <b>Looks like a question bank</b>
              <span>About {data.existingCount} questions found. We'll import them exactly as written and keep any explanations. Customising isn't needed.</span>
            </div>
          )}

          {ready && !isBank && (
            <>
              <button className={`gm-card${mode === "auto" ? " on" : ""}`} onClick={() => { setMode("auto"); setShowLock(false); }} aria-pressed={mode === "auto"}>
                <span className="gm-tag">Recommended</span>
                <b>Auto · {autoN} questions</b>
                <span>{shortDoc ? "Short material, so we'll write as many good questions as it supports." : "A balanced set that covers the whole material."}</span>
              </button>

              <button className={`gm-card${mode === "custom" ? " on" : ""}${isPaid ? "" : " locked"}`} onClick={openCustom} aria-pressed={mode === "custom"}>
                <span className="gm-tag pro">{isPaid ? "Premium" : "Premium · locked"}</span>
                <b>Customise</b>
                <span>Choose how many (1 to {DEFAULT_QUESTION_CAP}), clinical style, difficulty and focus.</span>
              </button>

              {showLock && !isPaid && (
                <div className="gm-lock" role="alert">
                  <span>Customising is a Premium feature. Auto still works on your free plan{remainingFree != null ? ` (${remainingFree} generations left)` : ""}.</span>
                  <button onClick={() => window.dispatchEvent(new CustomEvent("sc-open-premium"))}>Upgrade</button>
                </div>
              )}

              {mode === "custom" && isPaid && (
                <div className="gm-panel">
                  <div className="gm-presets" role="group" aria-label="Presets">
                    {PRESETS.map((p) => (
                      <button key={p.id} onClick={() => applyPreset(p)}><b>{p.name}</b><span>{p.sub}</span></button>
                    ))}
                  </div>

                  <div className="gm-lab">Number of questions</div>
                  <div className="gm-count">
                    <button aria-label="Fewer" onClick={() => setCount(Math.max(1, n - 1))}>−</button>
                    <input type="number" inputMode="numeric" min="1" max={DEFAULT_QUESTION_CAP} value={count} onChange={(e) => setCount(e.target.value === "" ? "" : parseInt(e.target.value, 10) || 1)} onBlur={(e) => clampSet(e.target.value)} aria-label="Number of questions" />
                    <button aria-label="More" onClick={() => setCount(Math.min(DEFAULT_QUESTION_CAP, n + 1))}>+</button>
                  </div>
                  <div className="gm-chips">
                    {[10, 20, 50, 100, 200].map((v) => (
                      <button key={v} className={n === v ? "on" : ""} onClick={() => setCount(v)}>{v}</button>
                    ))}
                  </div>
                  <p className="gm-help">{n > maxQ ? `This ${rangeOn ? "page range" : "material"} supports about ${maxQ} strong questions — beyond that, questions may repeat facts or range further from the source.` : `This ${rangeOn ? "page range" : "material"} supports up to about ${maxQ} questions.`}</p>

                  <div className="gm-lab">Question style</div>
                  <div className="gm-seg" role="radiogroup">
                    {STYLES.map(([id, name]) => (
                      <button key={id} role="radio" aria-checked={style === id} className={style === id ? "on" : ""} onClick={() => setStyle(id)}>{name}</button>
                    ))}
                  </div>
                  <p className="gm-help">{STYLES.find((s) => s[0] === style)?.[2]}</p>

                  <div className="gm-lab">Difficulty</div>
                  <div className="gm-seg" role="radiogroup">
                    {DIFFS.map(([id, name]) => (
                      <button key={id} role="radio" aria-checked={difficulty === id} className={difficulty === id ? "on" : ""} onClick={() => setDifficulty(id)}>{name}</button>
                    ))}
                  </div>

                  <button className="gm-focus" onClick={() => setFocusOpen((v) => !v)} aria-expanded={focusOpen}>
                    {focusOpen ? "Advanced options" : "More options — refine, focus, verify"}<span aria-hidden="true">{focusOpen ? "−" : "+"}</span>
                  </button>
                  {focusOpen && (
                    <div className="gm-focus-body">
                      <label className="gm-tog"><input type="checkbox" checked={realWorld} onChange={(e) => setRealWorld(e.target.checked)} /><span><b>Real-world focus</b><small>Real clinical situations, red flags, management and drug choices.</small></span></label>
                      <label className="gm-tog"><input type="checkbox" checked={highYield} onChange={(e) => setHighYield(e.target.checked)} /><span><b>High-yield only</b><small>Concentrate on what exams test most often.</small></span></label>
                      <label className="gm-tog"><input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} /><span><b>Double-check answers</b><small>A second pass removes or fixes answers the material doesn't support.</small></span></label>

                      <div className="gm-lab">Focus (optional)</div>
                      <input className="gm-text" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Topic, e.g. brachial plexus" aria-label="Focus topic" />
                      {pages > 1 && (
                        <div className="gm-range">
                          <span>Pages</span>
                          <input type="number" inputMode="numeric" min="1" max={pages} value={pFrom} onChange={(e) => setPFrom(e.target.value)} placeholder="1" aria-label="From page" />
                          <span>to</span>
                          <input type="number" inputMode="numeric" min="1" max={pages} value={pTo} onChange={(e) => setPTo(e.target.value)} placeholder={String(pages)} aria-label="To page" />
                          <small>of {pages}</small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="gm-foot">
            <button className="gm-go" disabled={!ready} onClick={go}>
              {isBank ? `Import about ${total} questions` : mode === "custom" ? `Generate ${total} ${styleName.toLowerCase()} questions` : `Generate ${total} questions`}
            </button>
            {ready && !isBank && (
              <p className="gm-est">Takes {genTime(total, mode === "custom" && verify)} · about {Math.max(1, Math.ceil(total * 5 / 60))} min to review{!isPaid ? " · uses 1 free generation" : ""}</p>
            )}
            <button className="gm-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
    </CircleSheet>
  );
}
