import { useMemo, useState } from "react";
import { CALCS, CALC_CATEGORIES, CALC_MAP, calcReady, toComputeValues } from "./calcData";
import { getFavs, getRecents, toggleFav, pushRecent } from "../reference/refPrefs";
import "../reference/clinicalRef.css";
import ExitPill from "../../components/ExitPill.jsx";

function CalcField({ spec, value, unit, onVal, onUnit }) {
  if (spec.type === "check") {
    const on = !!value;
    return (
      <button type="button" className={`cr-check-item${on ? " on" : ""}`} onClick={() => onVal(!on)}>
        <span className="cr-check-box">{on ? "✓" : ""}</span>
        <span className="cr-check-txt">{spec.label}</span>
        <span className="cr-check-pts">{spec.pts > 0 ? `+${spec.pts}` : spec.pts}</span>
      </button>
    );
  }
  if (spec.type === "radio") {
    return (
      <div className="cr-field">
        <div className="cr-field-label">{spec.label}</div>
        {spec.options.map((o) => (
          <button key={o.v} type="button" className={`cr-radio-item${value === o.v ? " on" : ""}`} onClick={() => onVal(o.v)}>
            <span className="cr-radio-dot" />
            <span style={{ flex: 1 }}>{o.lbl}</span>
          </button>
        ))}
      </div>
    );
  }
  if (spec.type === "seg") {
    return (
      <div className="cr-field">
        <div className="cr-field-label">{spec.label}</div>
        <div className="cr-seg">
          {spec.options.map(([v, lbl]) => (
            <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onVal(v)}>{lbl}</button>
          ))}
        </div>
      </div>
    );
  }
  // num
  return (
    <div className="cr-field">
      <div className="cr-field-label">
        <span>{spec.label}{spec.optional ? " · optional" : ""}</span>
        {spec.hint && <span className="hint">{spec.hint}</span>}
      </div>
      <div className="cr-input-row">
        <input
          className="cr-num"
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          min={spec.min} max={spec.max} step={spec.step}
          onChange={(e) => onVal(e.target.value)}
        />
        {spec.units.length > 1 ? (
          <select className="cr-unit-sel" value={unit} onChange={(e) => onUnit(e.target.value)}>
            {spec.units.map(([u]) => <option key={u} value={u}>{u}</option>)}
          </select>
        ) : (
          <span className="cr-unit-sel" style={{ display: "flex", alignItems: "center", cursor: "default" }}>{spec.units[0][0]}</span>
        )}
      </div>
    </div>
  );
}

function CalcDetail({ calc, onBack, onOpen }) {
  const [raw, setRaw] = useState(() => {
    const init = {};
    calc.inputs.forEach((i) => {
      if (i.type === "num") init[`${i.key}__unit`] = i.units[0][0];
      else if (i.type === "check") init[i.key] = false;
      else init[i.key] = i.type === "radio" ? null : i.default;
    });
    return init;
  });
  const [copied, setCopied] = useState(false);

  const ready = calcReady(calc, raw);
  const result = ready ? calc.compute(toComputeValues(calc, raw)) : null;

  const copyResult = async () => {
    if (!result) return;
    const txt = `${calc.name}: ${result.value} ${result.unit} — ${result.label}`.replace(/\s+/g, " ").trim();
    try { await navigator.clipboard.writeText(txt); } catch {
      const t = document.createElement("textarea");
      t.value = txt; document.body.appendChild(t); t.select();
      document.execCommand("copy"); t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="cr-page">
      <div className="cr-detail-head">
        <button className="cr-btn-ghost" onClick={onBack}>← Back</button>
        <h3 style={{ flex: 1, minWidth: 0 }}><span className="cr-detail-ico" style={{ width: 38, height: 38, fontSize: 18 }}>{calc.icon}</span>{calc.name}</h3>
      </div>
      <div style={{ fontSize: 12, color: "var(--cr-muted)", marginBottom: 14 }}>{calc.short}</div>

      <div className="cr-card" style={{ marginBottom: 14 }}>
        {calc.inputs.map((spec) => (
          <CalcField
            key={spec.key}
            spec={spec}
            value={raw[spec.key]}
            unit={raw[`${spec.key}__unit`]}
            onVal={(v) => setRaw((s) => ({ ...s, [spec.key]: v }))}
            onUnit={(u) => setRaw((s) => ({ ...s, [`${spec.key}__unit`]: u }))}
          />
        ))}

        {!ready && (
          <div className="cr-note" style={{ textAlign: "center" }}>Fill in the fields above to calculate</div>
        )}

        {result && (
          <div className={`cr-result ${result.tone}`}>
            <div className="cr-result-value">{result.value}<span className="cr-result-unit"> {result.unit}</span></div>
            <div className="cr-result-label">{result.label}</div>
            {result.sub && <div className="cr-result-sub">{result.sub}</div>}
            {(result.extra || []).filter(Boolean).length > 0 && (
              <div className="cr-result-extra">
                {(result.extra || []).filter(Boolean).map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
            <button className="cr-btn-ghost" style={{ marginTop: 12, fontSize: 11.5 }} onClick={copyResult}>
              {copied ? "✓ Copied" : "📋 Copy result"}
            </button>
          </div>
        )}

        <div className="cr-formula">ƒ {calc.formula}</div>
        {calc.cite && <div className="cr-cite">Source: {calc.cite}</div>}
      </div>

      {calc.pearl && (
        <div className="cr-card" style={{ borderColor: "rgba(245,197,66,0.3)" }}>
          <div className="cr-sec-h">💡 CLINICAL PEARL</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--cr-muted)" }}>{calc.pearl}</div>
        </div>
      )}

      {(calc.related || []).length > 0 && (
        <div className="cr-related">
          <div className="cr-sec-h">🔗 RELATED</div>
          <div className="cr-related-row">
            {calc.related.map((rid) => CALC_MAP[rid] && (
              <button key={rid} className="cr-chip" onClick={() => onOpen(CALC_MAP[rid])}>
                {CALC_MAP[rid].icon} {CALC_MAP[rid].name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cr-note">For education only — verify against current guidelines & patient-specific factors before clinical use.</div>
    </div>
  );
}

export default function MedicalCalculators({ onBack }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sel, setSel] = useState(null);
  const [favs, setFavs] = useState(() => getFavs("calcs"));
  const [recents, setRecents] = useState(() => getRecents("calcs"));

  const open = (calc) => { setSel(calc); setRecents(pushRecent("calcs", calc.id)); window.scrollTo(0, 0); };
  const toggleF = (id) => setFavs(toggleFav("calcs", id));

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return CALCS.filter((c) => {
      if (cat !== "All" && c.cat !== cat) return false;
      if (!ql) return true;
      return c.name.toLowerCase().includes(ql) || c.short.toLowerCase().includes(ql) ||
        CALC_CATEGORIES.find((x) => x.id === c.cat)?.label.toLowerCase().includes(ql);
    });
  }, [q, cat]);

  const favCalcs = favs.map((id) => CALC_MAP[id]).filter(Boolean);
  const recentCalcs = recents.map((id) => CALC_MAP[id]).filter(Boolean).slice(0, 6);

  if (sel) {
    return <CalcDetail calc={sel} onBack={() => setSel(null)} onOpen={(c) => { open(c); }} />;
  }

  return (
    <div className="cr-page">
      <ExitPill title="Medical Calculators" onBack={onBack} />
      <div className="cr-hero">
        <h2><span className="cr-ico">🧮</span>Medical Calculators</h2>
        <p>{CALCS.length} clinical scores & formulas — search, tap, calculate</p>
      </div>

      <div className="cr-sticky">
        <div className="cr-search">
          <span className="si">🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search calculators (eGFR, Wells, fluids…)" />
          {q && <button className="x" onClick={() => setQ("")}>✕</button>}
        </div>
        <div className="cr-chips">
          <button className={`cr-chip${cat === "All" ? " on" : ""}`} onClick={() => setCat("All")}>All</button>
          {CALC_CATEGORIES.map((c) => (
            <button key={c.id} className={`cr-chip${cat === c.id ? " on" : ""}`} onClick={() => setCat(c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {recentCalcs.length > 0 && !q && (
        <div className="cr-rail-wrap">
          <div className="cr-sec-h">🕘 Recently used</div>
          <div className="cr-rail">
            {recentCalcs.map((c) => (
              <button key={c.id} className="cr-rail-item" onClick={() => open(c)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {favCalcs.length > 0 && !q && cat === "All" && (
        <>
          <div className="cr-sec-h">⭐ Favorites</div>
          <div className="cr-grid">
            {favCalcs.map((c) => <CalcCard key={c.id} calc={c} isFav onOpen={open} onFav={toggleF} />)}
          </div>
          <div className="cr-sec-h">All calculators</div>
        </>
      )}

      {filtered.length === 0 ? (
        <div className="cr-empty">No calculators match "{q}"</div>
      ) : (
        <div className="cr-grid">
          {filtered.map((c) => (
            <CalcCard key={c.id} calc={c} isFav={favs.includes(c.id)} onOpen={open} onFav={toggleF} />
          ))}
        </div>
      )}

      <div className="cr-note">For educational purposes only. Always verify calculations in clinical practice.</div>
    </div>
  );
}

function CalcCard({ calc, isFav, onOpen, onFav }) {
  const cat = CALC_CATEGORIES.find((c) => c.id === calc.cat);
  return (
    <div className="cr-card cr-calc-card" onClick={() => onOpen(calc)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(calc)}>
      <div className="cr-calc-ico">{calc.icon}</div>
      <div className="cr-calc-info">
        <div className="cr-calc-name">{calc.name}</div>
        <div className="cr-calc-short">{calc.short}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
        <span
          role="button"
          tabIndex={0}
          style={{ fontSize: 15, lineHeight: 1, padding: 4, cursor: "pointer", color: isFav ? "var(--cr-gold)" : "var(--cr-faint)" }}
          onClick={(e) => { e.stopPropagation(); onFav(calc.id); }}
          onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onFav(calc.id))}
        >
          {isFav ? "★" : "☆"}
        </span>
        <span className="cr-calc-cat">{cat?.label}</span>
      </div>
    </div>
  );
}
