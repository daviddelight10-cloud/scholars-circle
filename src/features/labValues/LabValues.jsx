import { useMemo, useState } from "react";
import ExitPill from "../../components/ExitPill.jsx";
import { useOverlayBackClose } from "../../hooks/useOverlayBackClose.js";
import { LABS, LAB_CATEGORIES, CATEGORY_MAP, parseRange, checkValue } from "./labData.js";
import { getFavs, toggleFav, getRecents, pushRecent } from "../reference/refPrefs.js";
import QuickQuiz, { labQuestions } from "../reference/QuickQuiz.jsx";
import "../reference/clinicalRef.css";

const NS = "labs";

function usePrefs() {
  const [favs, setFavs] = useState(() => getFavs(NS));
  const [recents, setRecents] = useState(() => getRecents(NS));
  const fav = (id) => setFavs(toggleFav(NS, id));
  const visit = (id) => setRecents(pushRecent(NS, id));
  return { favs, recents, fav, visit };
}

function labId(l) {
  return l.parameter;
}

function matches(l, q) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    l.parameter.toLowerCase().includes(t) ||
    (l.aliases || []).some((a) => a.toLowerCase().includes(t)) ||
    (l.low + " " + l.high).toLowerCase().includes(t)
  );
}

function sameRange(l) {
  return !l.female || l.female === l.male || l.female === "same" || l.female === "—";
}

function hasCritical(l) {
  const ok = (s) => s && s !== "—";
  return ok(l.critical_low) || ok(l.critical_high);
}

/* ── Value checker bar ───────────────────────────────────── */
function ValueChecker({ lab }) {
  const [raw, setRaw] = useState("");
  const [sex, setSex] = useState(sameRange(lab) ? null : "male");
  const r = lab.numeric || parseRange(sex === "female" ? lab.female : lab.male) || parseRange(lab.male);
  const res = raw.trim() ? checkValue(lab, raw, sex) : null;

  // Domain for the bar: pad the range so the band sits centre-ish.
  let d0 = 0;
  let d1 = 1;
  if (r) {
    const lo = r.lo ?? 0;
    const span = r.hi != null ? r.hi - lo : r.lo || 1;
    d0 = Math.min(0, lo - span * 0.6);
    d1 = (r.hi ?? lo + span * 2) + span * 0.6;
    if (res) {
      d0 = Math.min(d0, res.value - span * 0.15);
      d1 = Math.max(d1, res.value + span * 0.15);
    }
  }
  const pct = (v) => Math.max(0, Math.min(100, ((v - d0) / (d1 - d0)) * 100));

  const verdicts = {
    "in-range": { cls: "ok", label: "✓ In range", sub: "Within the reference interval." },
    low: { cls: "warn", label: "↓ Below range", sub: lab.low || "Below the reference interval." },
    high: { cls: "warn", label: "↑ Above range", sub: lab.high || "Above the reference interval." },
    "critical-low": { cls: "bad", label: "🚨 CRITICAL LOW", sub: `${lab.critical_low} — urgent clinical assessment.` },
    "critical-high": { cls: "bad", label: "🚨 CRITICAL HIGH", sub: `${lab.critical_high} — urgent clinical assessment.` },
  };
  const v = res ? verdicts[res.verdict] : null;

  return (
    <div className="cr-checker">
      <div className="cr-checker-title">Check a patient value</div>
      <div className="cr-checker-row">
        <input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Result…"
          aria-label={`Patient ${lab.parameter} result`}
        />
        {lab.unit && <span className="unit-lbl">{lab.unit}</span>}
        {!sameRange(lab) && (
          <span className="cr-seg">
            <button type="button" className={sex === "male" ? "on" : ""} onClick={() => setSex("male")}>♂ M</button>
            <button type="button" className={sex === "female" ? "on" : ""} onClick={() => setSex("female")}>♀ F</button>
          </span>
        )}
      </div>

      {r && (
        <div className="cr-bar" aria-hidden="true">
          {r.lo != null && r.hi != null && (
            <div className="cr-bar-band" style={{ left: `${pct(r.lo)}%`, width: `${pct(r.hi) - pct(r.lo)}%` }} />
          )}
          {r.lo == null && r.hi != null && (
            <div className="cr-bar-band" style={{ left: "0%", width: `${pct(r.hi)}%` }} />
          )}
          {r.lo != null && r.hi == null && (
            <div className="cr-bar-band" style={{ left: `${pct(r.lo)}%`, width: `${100 - pct(r.lo)}%` }} />
          )}
          {res && (
            <div
              className={`cr-bar-dot ${res.verdict === "in-range" ? "ok" : res.verdict.startsWith("critical") ? "bad" : "warn"}`}
              style={{ left: `${pct(res.value)}%` }}
            />
          )}
        </div>
      )}

      {res && v && (
        <div className={`cr-verdict ${v.cls}`}>
          {v.label}
          <span className="v-sub">{v.sub}</span>
        </div>
      )}
      {!r && raw.trim() && (
        <div className="cr-verdict warn">
          Can't auto-check
          <span className="v-sub">This range isn't numeric — compare manually: {sex === "female" ? lab.female : lab.male}.</span>
        </div>
      )}
    </div>
  );
}

/* ── Lab detail body (shared by card + table row) ────────── */
function LabBody({ lab }) {
  const cat = CATEGORY_MAP[lab.category];
  return (
    <>
      <div className="cr-range-grid">
        <div className="cr-range-cell">
          <div className="lbl">{sameRange(lab) ? "Reference" : "♂ Male"}</div>
          <div className="val">{lab.male} {lab.unit}</div>
        </div>
        <div className="cr-range-cell">
          <div className="lbl">{sameRange(lab) ? "Category" : "♀ Female"}</div>
          <div className="val" style={{ color: sameRange(lab) ? "#8b6cff" : "#4ade80" }}>
            {sameRange(lab) ? `${cat?.icon || ""} ${cat?.label || lab.category}` : `${lab.female} ${lab.unit}`}
          </div>
        </div>
      </div>

      {hasCritical(lab) && (
        <div className="cr-crit-row">
          {lab.critical_low && lab.critical_low !== "—" && (
            <span className="cr-badge crit">▼ Crit low {lab.critical_low}</span>
          )}
          {lab.critical_high && lab.critical_high !== "—" && (
            <span className="cr-badge crit">▲ Crit high {lab.critical_high}</span>
          )}
        </div>
      )}

      {lab.conv && <div className="cr-conv">{lab.conv}</div>}

      {(lab.low || lab.high) && (
        <div className="cr-causes">
          {lab.low ? (
            <div className="cr-cause lo">
              <div className="h">↓ Low {lab.parameter.split("(")[0].trim()}</div>
              {lab.low}
            </div>
          ) : null}
          {lab.high ? (
            <div className="cr-cause hi">
              <div className="h">↑ High {lab.parameter.split("(")[0].trim()}</div>
              {lab.high}
            </div>
          ) : null}
        </div>
      )}

      {lab.note && (
        <div className="cr-pearl">
          <b>💡 Pearl</b> — {lab.note}
        </div>
      )}

      <ValueChecker lab={lab} />
    </>
  );
}

/* ── Card list item (mobile) ─────────────────────────────── */
function LabCard({ lab, open, onToggle, favs, onFav }) {
  return (
    <div className={`cr-lab-card ${open ? "open" : ""}`}>
      <button type="button" className="cr-lab-head" onClick={onToggle} aria-expanded={open}>
        <span className="cr-lab-name">
          {lab.parameter}
          {lab.unit && <span className="unit">{lab.unit}</span>}
        </span>
        {hasCritical(lab) && <span className="cr-badge crit">⚠</span>}
        <span className="cr-lab-range">
          {sameRange(lab) ? lab.male : `♂${lab.male} ♀${lab.female}`}
        </span>
        <span
          className={`cr-fav ${favs.includes(labId(lab)) ? "on" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Toggle favorite"
          onClick={(e) => {
            e.stopPropagation();
            onFav(labId(lab));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              onFav(labId(lab));
            }
          }}
        >
          {favs.includes(labId(lab)) ? "★" : "☆"}
        </span>
        <span className="cr-lab-chev">▾</span>
      </button>
      {open && (
        <div className="cr-lab-body">
          <LabBody lab={lab} />
        </div>
      )}
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function LabValues({ onBack }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [openId, setOpenId] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const { favs, recents, fav, visit } = usePrefs();

  // Device/browser back: dismiss quiz → leave the tool.
  useOverlayBackClose(() => { if (quiz) setQuiz(null); else onBack?.(); }, { open: !!onBack });

  const filtered = useMemo(
    () => LABS.filter((l) => matches(l, search) && (!cat || l.category === cat)),
    [search, cat]
  );

  const favLabs = favs.map((id) => LABS.find((l) => labId(l) === id)).filter(Boolean);
  const recentLabs = recents.map((id) => LABS.find((l) => labId(l) === id)).filter(Boolean).slice(0, 8);

  const toggle = (l) => {
    const id = labId(l);
    const opening = openId !== id;
    setOpenId(opening ? id : null);
    if (opening) visit(id);
  };

  const startQuiz = () => {
    const pool = filtered.length >= 4 ? filtered : LABS;
    const questions = labQuestions(pool);
    if (questions.length) {
      setQuiz({
        title: "🧪 Lab Values Quiz",
        subtitle: `${questions.length} questions — ranges, units & causes`,
        questions,
      });
    }
  };

  return (
    <div className="cr-page">
      <ExitPill title="Lab Values" onBack={onBack} />

      <header className="cr-hero">
        <div className="cr-hero-kicker">Clinical Reference</div>
        <h1 className="cr-hero-title">🧪 Lab Values</h1>
        <p className="cr-hero-sub">
          {LABS.length} analytes — reference ranges, critical thresholds, causes
          and clinical pearls. Type a patient result to check it against the range.
        </p>
      </header>

      <div className="cr-toolbar">
        <div className="cr-search">
          <span>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search — e.g. K+, Hb, troponin, GGT, ABG…"
          />
        </div>
        <div className="cr-chips">
          <button type="button" className={`cr-chip ${!cat ? "on" : ""}`} onClick={() => setCat("")}>
            All
          </button>
          {LAB_CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`cr-chip ${cat === c.id ? "on" : ""}`} onClick={() => setCat(cat === c.id ? "" : c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {!search && !cat && favLabs.length > 0 && (
        <>
          <div className="cr-rail-label">⭐ Favorites</div>
          <div className="cr-rail">
            {favLabs.map((l) => (
              <button key={labId(l)} type="button" className="cr-rail-item" onClick={() => toggle(l)}>
                <span className="r-name">{l.parameter}</span>
                <span className="r-sub">{l.male} {l.unit}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {!search && !cat && recentLabs.length > 0 && (
        <>
          <div className="cr-rail-label">🕘 Recent</div>
          <div className="cr-rail">
            {recentLabs.map((l) => (
              <button key={labId(l)} type="button" className="cr-rail-item" onClick={() => toggle(l)}>
                <span className="r-name">{l.parameter}</span>
                <span className="r-sub">{l.male} {l.unit}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="cr-count">
        {filtered.length} result{filtered.length === 1 ? "" : "s"}
        {cat ? ` in ${CATEGORY_MAP[cat]?.label}` : ""}
        <button type="button" className="cr-btn-ghost" style={{ float: "right", padding: "5px 12px" }} onClick={startQuiz}>
          ⚡ Quiz me
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="cr-empty">
          <div className="e-ico">🔍</div>
          <div className="e-title">No matches for "{search}"</div>
          <div className="e-sub">Try an abbreviation — K+, Hb, CRP, GGT…</div>
        </div>
      ) : (
        <>
          {/* Mobile: expandable cards */}
          <div className="cr-lab-cards">
            {filtered.map((l) => (
              <LabCard
                key={labId(l)}
                lab={l}
                open={openId === labId(l)}
                onToggle={() => toggle(l)}
                favs={favs}
                onFav={fav}
              />
            ))}
          </div>

          {/* Desktop: table with expandable detail row */}
          <div className="cr-labtable-wrap">
            <table className="cr-labtable">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Reference</th>
                  <th>Critical</th>
                  <th>Category</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const id = labId(l);
                  const isOpen = openId === id;
                  return [
                    <tr
                      key={id}
                      className={isOpen ? "open-row" : ""}
                      onClick={() => toggle(l)}
                    >
                      <td className="lbl">
                        {l.parameter}
                        {l.unit && <span className="unit"> · {l.unit}</span>}
                      </td>
                      <td className="mono">
                        {sameRange(l) ? l.male : `♂${l.male} ♀${l.female}`}
                      </td>
                      <td>
                        {hasCritical(l) ? (
                          <span className="cr-badge crit">⚠</span>
                        ) : (
                          <span className="cr-faint">—</span>
                        )}
                      </td>
                      <td className="cr-muted">{CATEGORY_MAP[l.category]?.icon} {CATEGORY_MAP[l.category]?.label}</td>
                      <td>
                        <span
                          className={`cr-fav ${favs.includes(id) ? "on" : ""}`}
                          role="button"
                          tabIndex={0}
                          aria-label="Toggle favorite"
                          onClick={(e) => {
                            e.stopPropagation();
                            fav(id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              e.preventDefault();
                              fav(id);
                            }
                          }}
                        >
                          {favs.includes(id) ? "★" : "☆"}
                        </span>
                      </td>
                    </tr>,
                    isOpen && (
                      <tr key={`${id}-detail`}>
                        <td colSpan={5} className="cr-lab-detail-td">
                          <LabBody lab={l} />
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="cr-disclaimer">
        <b>Reference ranges vary.</b> Intervals differ by laboratory, assay, age,
        pregnancy and clinical context — always defer to the reporting lab's own
        ranges. Educational use only.
      </div>

      {quiz && <QuickQuiz {...quiz} onClose={() => setQuiz(null)} />}
    </div>
  );
}
