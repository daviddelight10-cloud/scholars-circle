import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createLiveRoom } from "../live-quiz/liveQuizApi.js";
import { LiveJoinSheet, useMaterialLives } from "../live-quiz/LiveJoinSheet.jsx";
import { masteryDots, topicStats, buildSession, sessionMinutes, topicKey } from "./fsrsBridge.js";
import QuestionMeta from "./QuestionMeta.jsx";
import "./streakSurvival.css";

// Gizmo-style deck screen: every question as a tap-to-reveal card, a topics
// strip with mastery, and a floating bar with the auto-sized session, the
// Survival | Practice choice, Start recall and Live.
// Rendered for saved Rapid Recall decks (from StreakSurvival's 'deck' screen)
// and for streaming drafts (from ResearchHub's generation overlay).

function DeckCard({ q, state, delay }) {
  const [open, setOpen] = useState(false);
  const ring = state ? masteryDots(state) : null;
  const letters = q.opts.map((_, i) => String.fromCharCode(65 + i));
  return (
    <div
      className={`deck-card${open ? " open" : ""}`}
      style={{ animationDelay: `${Math.min(delay, 400)}ms` }}
      onClick={() => setOpen((v) => !v)}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
    >
      <div className="deck-card-top">
        {ring && (
          <span className={`deck-ring${ring.due ? " due" : ""}`} title={ring.due ? "Due for review" : "Mastery"}>
            {ring.due ? "⏰ DUE" : "●".repeat(Math.max(1, ring.dots))}
          </span>
        )}
        <span className="deck-hint">{open ? "tap to hide" : "tap to reveal"}</span>
      </div>
      <QuestionMeta q={q} className="deck-meta" />
      <p className="deck-q">{q.q}</p>
      <div className="deck-opts">
        {q.opts.map((opt, i) => (
          <div key={i} className={`deck-opt${open && i === q.a ? " is-correct" : ""}`}>
            <span className="deck-opt-letter">{letters[i]}</span>
            <span className="deck-opt-text">{opt}</span>
            {open && i === q.a && <span className="deck-check">✓</span>}
          </div>
        ))}
      </div>
      {open && q.explanation && <p className="deck-expl">{q.explanation}</p>}
    </div>
  );
}

function ProgressRing({ pct }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--app-tint-strong,rgba(128,128,128,.25))" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#3DDC97" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 22 22)" />
    </svg>
  );
}

function DeckView({
  title,
  meta,
  rows,            // normalized questions [{q, opts, a, explanation, _key, _qTopic...}]
  states,          // optional: FSRS states keyed by _key
  generating,      // true while AI is still streaming
  progressText,
  error,
  onRetry,
  onStop,
  onBack,
  onStartRecall,   // ({ mode, topics } | undefined)
  canStart,
  startNote,       // e.g. preview note while the deck is a draft
  cooldownNote,    // replaces the start action while hearts recharge
  liveResourceId,  // enables Live; null/undefined hides the button
  previewBadge,
  showModes = false, // saved decks: topics strip, mode toggle, session summary
  mode = "survival",
  onMode,
  survivalNote,    // e.g. "5 hearts left" for the free-tier pool (default "3 lives")
}) {
  const navigate = useNavigate();
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveErr, setLiveErr] = useState("");
  const [liveSheet, setLiveSheet] = useState(false);
  const [scope, setScope] = useState(null); // { label, topics: [name] } | null
  const list = useMemo(() => rows || [], [rows]);
  // Sessions already running on this material (anyone's) — shown on the
  // Live button; hosting your own always stays possible from the sheet.
  const { lives: materialLives, refresh: refreshLives } = useMaterialLives(liveResourceId);

  const goLive = async () => {
    if (!liveResourceId || liveBusy) return;
    setLiveBusy(true);
    setLiveErr("");
    try {
      // Warm the /live route chunk in parallel so navigation commits instantly.
      const [res] = await Promise.all([
        createLiveRoom(liveResourceId),
        import("../live-quiz/LiveQuizPage"),
      ]);
      navigate(`/live/${res.code}`, { state: { ticket: res.ticket, roomId: res.roomId, returnTo: window.location.pathname } });
    } catch (err) {
      setLiveErr(err.message || "Couldn't start live session");
    } finally {
      setLiveBusy(false);
    }
  };

  const headerSub = useMemo(() => {
    if (generating && list.length === 0) return progressText || "Preparing your questions…";
    if (generating) return `${list.length} question${list.length === 1 ? "" : "s"} so far — still generating…`;
    return meta;
  }, [generating, list.length, progressText, meta]);

  const topics = useMemo(() => (showModes ? topicStats(list, states || {}) : []), [showModes, list, states]);
  const weak = useMemo(() => topics.filter((t) => t.total >= 2 && t.pct < 70).slice(0, 3), [topics]);
  const shown = useMemo(() => {
    if (!scope) return list;
    const want = new Set(scope.topics.map(topicKey));
    return list.filter((q) => want.has(topicKey(q._qTopic)));
  }, [list, scope]);

  const session = useMemo(
    () => (showModes ? buildSession(list, states || {}, { topics: scope?.topics || null }) : null),
    [showModes, list, states, scope],
  );
  const masteredN = useMemo(() => list.filter((q) => { const s = states?.[q._key]; return s && (s.isMastered || (s.stability || 0) >= 21); }).length, [list, states]);
  const dueN = useMemo(() => list.filter((q) => states?.[q._key]?.isDue).length, [list, states]);
  const masteredPct = list.length ? Math.round((masteredN / list.length) * 100) : 0;

  const start = () => onStartRecall?.(showModes ? { mode, topics: scope?.topics || null } : undefined);
  const pickScope = (s) => setScope((cur) => (cur && s && cur.label === s.label ? null : s));

  return (
    <div className="deck-root">
      {/* Topbar */}
      <div className="deck-top">
        <button className="deck-back" onClick={onBack} aria-label="Back">✕</button>
        <div className="deck-title-wrap">
          <div className="deck-title">
            {title}
            {previewBadge && <span className="deck-preview-tag">PREVIEW</span>}
          </div>
          <div className="deck-sub">{headerSub}</div>
        </div>
        {generating && (
          <button className="deck-stop" onClick={onStop}>Stop</button>
        )}
      </div>

      {/* Cards */}
      <div className="deck-scroll">
        {showModes && list.length > 0 && (
          <div className="deck-prog">
            <ProgressRing pct={masteredPct} />
            <div className="deck-prog-t">
              <b>{masteredN} of {list.length} mastered</b>
              <span>{dueN > 0 ? `${dueN} due for review` : "Nothing due — practise to strengthen"}</span>
            </div>
          </div>
        )}

        {topics.length >= 2 && (
          <div className="deck-topics" role="group" aria-label="Filter by topic">
            <button className={`dt-chip${!scope ? " on" : ""}`} aria-pressed={!scope} onClick={() => setScope(null)}>All <em>{list.length}</em></button>
            {weak.length > 0 && (
              <button
                className={`dt-chip weak${scope?.label === "Weak topics" ? " on" : ""}`}
                aria-pressed={scope?.label === "Weak topics"}
                onClick={() => pickScope({ label: "Weak topics", topics: weak.map((t) => t.topic) })}
              >Weak topics <em>{weak.reduce((s, t) => s + t.total, 0)}</em></button>
            )}
            {topics.map((t) => (
              <button
                key={t.key}
                className={`dt-chip${scope?.label === t.topic ? " on" : ""}`}
                aria-pressed={scope?.label === t.topic}
                onClick={() => pickScope({ label: t.topic, topics: [t.topic] })}
              >{t.topic} <em>{t.pct}%</em></button>
            ))}
          </div>
        )}

        {shown.map((q, i) => (
          <DeckCard key={q._key || i} q={q} state={states?.[q._key]} delay={i * 35} />
        ))}
        {generating && (
          <div className="deck-card deck-card-skel" aria-hidden="true">
            <div className="deck-skel-line" />
            <div className="deck-skel-line short" />
            <div className="deck-skel-opts">
              <div className="deck-skel-opt" /><div className="deck-skel-opt" />
            </div>
          </div>
        )}
        {!generating && error && (
          <div className="deck-error">
            <p>{error}</p>
            <button onClick={onRetry}>Retry</button>
          </div>
        )}
        <div className={`deck-scroll-pad${showModes ? " tall" : ""}`} />
      </div>

      {/* Floating bar */}
      <div className={`deck-bar${showModes ? " col" : ""}`}>
        {showModes && !cooldownNote && session && (
          <div className="deck-sess">
            <div className="deck-seg" role="radiogroup" aria-label="Run style">
              <button role="radio" aria-checked={mode === "survival"} className={mode === "survival" ? "on" : ""} onClick={() => onMode?.("survival")}>
                <b>Survival</b><span>{survivalNote || "3 lives"}</span>
              </button>
              <button role="radio" aria-checked={mode === "practice"} className={mode === "practice" ? "on" : ""} onClick={() => onMode?.("practice")}>
                <b>Practice</b><span>No lives</span>
              </button>
            </div>
            <div className="deck-sess-t">
              {scope ? <><b>{scope.label}</b> · </> : null}
              {session.indices.length} question{session.indices.length === 1 ? "" : "s"} · about {sessionMinutes(session.indices.length)} min
              {session.due > 0 ? ` · ${session.due} due` : ""}
            </div>
          </div>
        )}
        <div className="deck-bar-row">
          {cooldownNote ? (
            <div className="deck-cooldown">{cooldownNote}</div>
          ) : (
            <button className="deck-start" disabled={!canStart || (showModes && session && session.indices.length === 0)} onClick={start}>
              <span className="deck-start-ico">▶</span>{scope ? `Practise ${scope.label}` : mode === "practice" && showModes ? "Start practice" : "Start recall"}
            </button>
          )}
          {liveResourceId && (
            <button
              className="deck-live"
              onClick={async () => {
                const rows = await refreshLives(); // freshest state before deciding
                if (rows.length === 0) { goLive(); return; }
                setLiveSheet(true);
              }}
              disabled={liveBusy}
              title="Quiz together in real time"
            >
              <span className="deck-live-dot" />{liveBusy ? "Opening…" : materialLives.length ? `Live · ${materialLives.length}` : "Live"}
            </button>
          )}
        </div>
      </div>
      {startNote && <div className="deck-note">{startNote}</div>}
      {liveErr && <div className="deck-note err">{liveErr}</div>}
      {liveSheet && (
        <LiveJoinSheet
          rooms={materialLives}
          onClose={() => setLiveSheet(false)}
          onHost={async () => { setLiveSheet(false); await goLive(); }}
        />
      )}
    </div>
  );
}

export default memo(DeckView);
