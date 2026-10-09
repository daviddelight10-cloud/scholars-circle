import { useMemo, useState } from "react";
import ExitPill from "../../components/ExitPill.jsx";
import { useOverlayBackClose } from "../../hooks/useOverlayBackClose.js";
import { DRUGS, DRUG_CLASSES, findInteractions } from "./drugData.js";
import { getFavs, toggleFav, getRecents, pushRecent } from "../reference/refPrefs.js";
import QuickQuiz, { drugQuestions } from "../reference/QuickQuiz.jsx";
import "../reference/clinicalRef.css";

const NS = "drugs";

function usePrefs() {
  const [favs, setFavs] = useState(() => getFavs(NS));
  const [recents, setRecents] = useState(() => getRecents(NS));
  const fav = (id) => setFavs(toggleFav(NS, id));
  const visit = (id) => setRecents(pushRecent(NS, id));
  return { favs, recents, fav, visit };
}

function matches(d, q) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    d.name.toLowerCase().includes(t) ||
    d.generic.toLowerCase().includes(t) ||
    d.indications.toLowerCase().includes(t) ||
    (d.brands || []).some((b) => b.toLowerCase().includes(t))
  );
}

function monographText(d) {
  return [
    `${d.name} (${d.generic})${d.brands?.length ? ` — ${d.brands.join(", ")}` : ""}`,
    `Class: ${d.class}`,
    `Indications: ${d.indications}`,
    `Adult dose: ${d.dose}`,
    d.peds ? `Pediatric: ${d.peds}` : null,
    d.renal ? `Renal: ${d.renal}` : null,
    `Contraindications: ${d.contraindications}`,
    `Side effects: ${d.sideEffects}`,
    `Interactions: ${d.interactions}`,
    `Pregnancy: ${d.pregnancy}`,
    d.monitor && d.monitor !== "—" ? `Monitor: ${d.monitor}` : null,
    "",
    "Educational reference only — verify against local guidelines.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ── Detail view ─────────────────────────────────────────── */
function DrugDetail({ drug, onBack, favs, onFav, onQuiz, onCopy }) {
  const sections = [
    { ico: "🎯", title: "Indications", body: drug.indications, open: true },
    { ico: "📏", title: "Adult dosing", body: drug.dose, open: true },
    drug.peds && { ico: "🧒", title: "Pediatric dosing", body: drug.peds, cls: "kids" },
    drug.renal && { ico: "🫘", title: "Renal adjustment", body: drug.renal, cls: "kids" },
    { ico: "⚠️", title: "Contraindications & cautions", body: drug.contraindications, cls: "warn", open: true },
    { ico: "🩹", title: "Adverse effects", body: drug.sideEffects },
    { ico: "🔄", title: "Interactions", body: drug.interactions },
    { ico: "🤰", title: "Pregnancy & lactation", body: drug.pregnancy, cls: "preg" },
    drug.monitor && drug.monitor !== "—" && { ico: "📋", title: "Monitoring & pearls", body: drug.monitor },
  ].filter(Boolean);

  return (
    <div className="cr-detail">
      <div className="cr-detail-head">
        <div>
          <h1 className="cr-detail-title">{drug.name}</h1>
          <div className="cr-detail-meta">
            <b>{drug.generic}</b> · <span className="cr-card-class">{drug.class}</span>
          </div>
          {drug.brands?.length > 0 && <div className="cr-brands">Brands: {drug.brands.join(" · ")}</div>}
        </div>
        <button
          type="button"
          className={`cr-fav ${favs.includes(drug.name) ? "on" : ""}`}
          onClick={() => onFav(drug.name)}
          aria-label={favs.includes(drug.name) ? "Remove favorite" : "Add favorite"}
          style={{ fontSize: 22 }}
        >
          {favs.includes(drug.name) ? "★" : "☆"}
        </button>
      </div>

      {drug.highAlert && (
        <div className="cr-alert-banner">
          <span className="ico">⚠️</span>
          <div>
            <b>High-alert medication.</b> Errors with this drug carry elevated
            risk of serious harm — double-check dose, route and patient before
            administration (ISMP category).
          </div>
        </div>
      )}

      <div className="cr-actions">
        <button type="button" className="cr-btn-primary" onClick={onQuiz}>
          ⚡ Quiz me
        </button>
        <button type="button" className="cr-btn-ghost" onClick={onCopy}>
          📋 Copy monograph
        </button>
        <button type="button" className="cr-btn-ghost" onClick={onBack}>
          ← All drugs
        </button>
      </div>

      {sections.map((s) => (
        <details key={s.title} className={`cr-section ${s.cls || ""}`} open={s.open}>
          <summary>
            <span className="s-ico">{s.ico}</span>
            {s.title}
          </summary>
          <div className="s-body">{s.body}</div>
        </details>
      ))}

      <div className="cr-disclaimer">
        <b>Educational reference only.</b> Dosing varies by indication,
        formulation, age, weight, renal/hepatic function and local protocol.
        Verify against your formulary and current guidelines before prescribing.
      </div>
    </div>
  );
}

/* ── Interaction checker ─────────────────────────────────── */
function InteractionChecker({ onPick }) {
  const [tray, setTray] = useState([]);
  const [q, setQ] = useState("");

  const suggestions = useMemo(() => {
    if (!q.trim()) return [];
    return DRUGS.filter((d) => matches(d, q) && !tray.includes(d)).slice(0, 8);
  }, [q, tray]);

  const results = useMemo(() => findInteractions(tray), [tray]);
  const major = results.filter((r) => r.severity === "major").length;

  const add = (d) => {
    if (tray.length >= 30 || tray.includes(d)) return;
    setTray((t) => [...t, d]);
    setQ("");
  };

  return (
    <div>
      <p className="cr-muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
        Add drugs to check for known clinically important interactions (curated list — not exhaustive).
      </p>
      <div className="cr-checker-tray">
        {tray.map((d) => (
          <span key={d.name} className="cr-tray-drug">
            {d.name}
            <button type="button" aria-label={`Remove ${d.name}`} onClick={() => setTray((t) => t.filter((x) => x !== d))}>
              ✕
            </button>
          </span>
        ))}
        {tray.length === 0 && <span className="cr-tray-hint">Search below to add 2+ drugs…</span>}
      </div>

      <div className="cr-search" style={{ marginTop: 10 }}>
        <span>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Add a drug — e.g. warfarin, ibuprofen, sertraline…"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="cr-grid" style={{ marginTop: 8 }}>
          {suggestions.map((d) => (
            <button key={d.name} type="button" className="cr-card cr-drug-card" onClick={() => add(d)}>
              <span className="cr-card-name">{d.name}</span>
              <span className="cr-card-generic">{d.generic}</span>
            </button>
          ))}
        </div>
      )}

      {tray.length >= 2 && (
        <div style={{ marginTop: 14 }}>
          {results.length === 0 ? (
            <div className="cr-empty">
              <div className="e-ico">✅</div>
              <div className="e-title">No known major interactions</div>
              <div className="e-sub">None of the {tray.length} selected drugs appear in the curated pairs — always verify with a full checker for prescribing.</div>
            </div>
          ) : (
            <>
              <div className="cr-count" style={{ marginTop: 4 }}>
                {results.length} interaction{results.length === 1 ? "" : "s"} found
                {major > 0 && <span className="cr-badge major" style={{ marginLeft: 8 }}>{major} major</span>}
              </div>
              {results.map((r, i) => (
                <div key={i} className={`cr-int-card ${r.severity}`}>
                  <div className="cr-int-pair">
                    <button type="button" className="cr-btn-ghost" style={{ padding: "4px 10px" }} onClick={() => onPick(r.drugA)}>
                      {r.drugA.name}
                    </button>
                    <span className="x">×</span>
                    <button type="button" className="cr-btn-ghost" style={{ padding: "4px 10px" }} onClick={() => onPick(r.drugB)}>
                      {r.drugB.name}
                    </button>
                    <span className={`cr-badge ${r.severity}`}>{r.severity}</span>
                  </div>
                  <div className="cr-int-note">{r.note}</div>
                </div>
              ))}
              <button type="button" className="cr-btn-ghost cr-clear" onClick={() => setTray([])}>
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Browse ──────────────────────────────────────────────── */
export default function DrugReference({ onBack }) {
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [cls, setCls] = useState("");
  const [sel, setSel] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [toast, setToast] = useState("");
  const { favs, recents, fav, visit } = usePrefs();

  // Device/browser back: dismiss quiz → drug detail → leave the tool.
  useOverlayBackClose(() => {
    if (quiz) setQuiz(null);
    else if (sel) setSel(null);
    else onBack?.();
  }, { open: !!onBack });

  const filtered = useMemo(
    () => DRUGS.filter((d) => matches(d, search) && (!cls || d.class === cls)),
    [search, cls]
  );

  const favDrugs = favs.map((id) => DRUGS.find((d) => d.name === id)).filter(Boolean);
  const recentDrugs = recents.map((id) => DRUGS.find((d) => d.name === id)).filter(Boolean).slice(0, 8);

  const open = (d) => {
    setSel(d);
    visit(d.name);
    window.scrollTo({ top: 0 });
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const copyMonograph = async (d) => {
    try {
      await navigator.clipboard.writeText(monographText(d));
      flash("Monograph copied");
    } catch {
      flash("Couldn't copy — clipboard blocked");
    }
  };

  const startQuiz = (d) => {
    const questions = drugQuestions(d, DRUGS);
    if (questions.length) setQuiz({ title: `💊 ${d.name}`, subtitle: d.class, questions });
  };

  if (sel) {
    return (
      <div className="cr-page">
        <ExitPill title={sel.name} onBack={() => setSel(null)} />
        <DrugDetail
          drug={sel}
          onBack={() => setSel(null)}
          favs={favs}
          onFav={fav}
          onQuiz={() => startQuiz(sel)}
          onCopy={() => copyMonograph(sel)}
        />
        {quiz && <QuickQuiz {...quiz} onClose={() => setQuiz(null)} />}
        {toast && <div className="cr-toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="cr-page">
      <ExitPill title="Drug Reference" onBack={onBack} />

      <header className="cr-hero">
        <div className="cr-hero-kicker">Clinical Reference</div>
        <h1 className="cr-hero-title">💊 Drug Reference</h1>
        <p className="cr-hero-sub">
          {DRUGS.length} monographs — dosing, contraindications, interactions and
          monitoring. Search by name, brand or indication.
        </p>
      </header>

      <div className="cr-toolbar">
        <div className="cr-tabs">
          <button type="button" className={`cr-tab ${tab === "browse" ? "on" : ""}`} onClick={() => setTab("browse")}>
            📋 Browse
          </button>
          <button type="button" className={`cr-tab ${tab === "checker" ? "on" : ""}`} onClick={() => setTab("checker")}>
            ⚡ Interaction Checker
          </button>
        </div>

        {tab === "browse" && (
          <>
            <div className="cr-search" style={{ marginTop: 10 }}>
              <span>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search drug, brand, generic, or indication…"
              />
            </div>
            <div className="cr-chips">
              <button type="button" className={`cr-chip ${!cls ? "on" : ""}`} onClick={() => setCls("")}>
                All
              </button>
              {DRUG_CLASSES.map((c) => (
                <button key={c} type="button" className={`cr-chip ${cls === c ? "on" : ""}`} onClick={() => setCls(cls === c ? "" : c)}>
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {tab === "checker" ? (
        <InteractionChecker onPick={open} />
      ) : (
        <>
          {!search && !cls && favDrugs.length > 0 && (
            <>
              <div className="cr-rail-label">⭐ Favorites</div>
              <div className="cr-rail">
                {favDrugs.map((d) => (
                  <button key={d.name} type="button" className="cr-rail-item" onClick={() => open(d)}>
                    <span className="r-name">{d.name}</span>
                    <span className="r-sub">{d.class}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!search && !cls && recentDrugs.length > 0 && (
            <>
              <div className="cr-rail-label">🕘 Recent</div>
              <div className="cr-rail">
                {recentDrugs.map((d) => (
                  <button key={d.name} type="button" className="cr-rail-item" onClick={() => open(d)}>
                    <span className="r-name">{d.name}</span>
                    <span className="r-sub">{d.class}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="cr-count">
            {filtered.length} drug{filtered.length === 1 ? "" : "s"}
            {cls ? ` in ${cls}` : ""}
          </div>

          {filtered.length === 0 ? (
            <div className="cr-empty">
              <div className="e-ico">🔍</div>
              <div className="e-title">No matches for "{search}"</div>
              <div className="e-sub">Try the generic name, a brand, or an indication.</div>
            </div>
          ) : (
            <div className="cr-grid">
              {filtered.map((d) => (
                <button key={d.name} type="button" className="cr-card cr-drug-card" onClick={() => open(d)}>
                  <div className="cr-card-top">
                    <div>
                      <div className="cr-card-name">{d.name}</div>
                      <div className="cr-card-generic">{d.generic}</div>
                    </div>
                    <span
                      className={`cr-fav ${favs.includes(d.name) ? "on" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label="Toggle favorite"
                      onClick={(e) => {
                        e.stopPropagation();
                        fav(d.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          fav(d.name);
                        }
                      }}
                    >
                      {favs.includes(d.name) ? "★" : "☆"}
                    </span>
                  </div>
                  <span className="cr-card-class">{d.class}</span>
                  <div className="cr-card-indications">{d.indications}</div>
                  {d.highAlert && <span className="cr-card-alert">⚠ High alert</span>}
                </button>
              ))}
            </div>
          )}

          <div className="cr-disclaimer">
            <b>Educational reference only.</b> {DRUGS.length} monographs cover
            common medications — not a substitute for your formulary, BNF, or
            clinical judgment. Doses vary by patient and protocol; always verify.
          </div>
        </>
      )}

      {quiz && <QuickQuiz {...quiz} onClose={() => setQuiz(null)} />}
      {toast && <div className="cr-toast">{toast}</div>}
    </div>
  );
}
