import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createLiveRoom } from "../live-quiz/liveQuizApi.js";
import { masteryDots } from "./fsrsBridge.js";

// Gizmo-style deck screen: every question as a tap-to-reveal card, with a
// floating bar of Start recall (Survival is the default run) + Live.
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

function DeckView({
  title,
  meta,
  rows,            // normalized questions [{q, opts, a, explanation, _key}]
  states,          // optional: FSRS states keyed by _key
  generating,      // true while AI is still streaming
  progressText,
  error,
  onRetry,
  onStop,
  onBack,
  onStartRecall,
  canStart,
  startNote,       // e.g. preview note while the deck is a draft
  cooldownNote,    // replaces the start action while hearts recharge
  liveResourceId,  // enables Live; null/undefined hides the button
  previewBadge,
}) {
  const navigate = useNavigate();
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveErr, setLiveErr] = useState("");
  const list = rows || [];

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
        {list.map((q, i) => (
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
        <div className="deck-scroll-pad" />
      </div>

      {/* Floating bar */}
      <div className="deck-bar">
        {cooldownNote ? (
          <div className="deck-cooldown">{cooldownNote}</div>
        ) : (
          <button className="deck-start" disabled={!canStart} onClick={onStartRecall}>
            <span className="deck-start-ico">▶</span>Start recall
          </button>
        )}
        {liveResourceId && (
          <button className="deck-live" onClick={goLive} disabled={liveBusy} title="Quiz together in real time">
            <span className="deck-live-dot" />{liveBusy ? "Opening…" : "Live"}
          </button>
        )}
      </div>
      {startNote && <div className="deck-note">{startNote}</div>}
      {liveErr && <div className="deck-note err">{liveErr}</div>}
    </div>
  );
}

export default memo(DeckView);
