import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalA11y } from "../../hooks/useModalA11y";
import { feedApi } from "../feed/feedApi";
import { loadSave, mutate } from "../streak-survival/survivalStore.js";
import { loadHistory } from "../../lib/studyHistory.js";

// Answer-style options — same ids as StreakSurvival's Session setup
const STYLE_OPTIONS = [
  ["smart", "Smart mix", "choices for new cards, typing once you know them"],
  ["mcq", "Choices", "pick from four options"],
  ["typing", "Type it out", "free recall — strongest for memory"],
  ["flashcard", "Flip cards", "reveal, then grade yourself"],
  ["mixed", "Variety mix", "a bit of everything"],
];
const EXTRA_OPTIONS = [
  ["recallFirst", "Recall first", "choices stay hidden until you tap"],
  ["speedRound", "Speed round", "7s per question — out of time counts as a miss"],
];

const relTime = (ts) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

function getVariantCount(variant) {
  if (!variant) return 0;
  try {
    if (variant.contentType === "mcq" && variant.mcqData) {
      const data = typeof variant.mcqData === "string" ? JSON.parse(variant.mcqData) : variant.mcqData;
      return Array.isArray(data) ? data.length : 0;
    }
    if (variant.contentType === "exam" && variant.mcqData) {
      const data = typeof variant.mcqData === "string" ? JSON.parse(variant.mcqData) : variant.mcqData;
      return Array.isArray(data?.questions) ? data.questions.length : 0;
    }
    if (variant.contentType === "flashcard_deck" && variant.flashcardData) {
      const data = typeof variant.flashcardData === "string" ? JSON.parse(variant.flashcardData) : variant.flashcardData;
      return Array.isArray(data) ? data.length : 0;
    }
  } catch {
    return 0;
  }
  return 0;
}

/* ── Inline stroke icons (tabler-style) ─────────────────────────── */

const I = ({ size = 16, sw = 2, children, filled }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ display: "block" }}
  >
    {children}
  </svg>
);

const IcoBolt = (p) => <I {...p} filled><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></I>;
const IcoBrain = (p) => (
  <I {...p}>
    <path d="M12 4c-2.5-1.5-6-.5-6 2.2 0 .5.1 1 .3 1.5C5.3 8.4 4.5 9.6 4.5 11c0 .7.2 1.4.6 2-.3.6-.5 1.3-.4 2 .3 2.5 3 3.7 5.3 2.7.6-.3 1-.8 1-1.4V6.2c0-.9.4-1.8 1-2.2z" />
    <path d="M12 4c2.5-1.5 6-.5 6 2.2 0 .5-.1 1-.3 1.5 1 .7 1.8 1.9 1.8 3.3 0 .7-.2 1.4-.6 2 .3.6.5 1.3.4 2-.3 2.5-3 3.7-5.3 2.7-.6-.3-1-.8-1-1.4V6.2c0-.9-.4-1.8-1-2.2z" />
  </I>
);
const IcoFileText = (p) => (
  <I {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
    <path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h6" />
  </I>
);
const IcoClipboard = (p) => (
  <I {...p}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" /><path d="M9 16h4" />
  </I>
);
const IcoFile = (p) => (
  <I {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
    <path d="M14 2v6h6" />
  </I>
);
const IcoUsers = (p) => (
  <I {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M17.5 15c2 .8 3.4 2.5 4 5" />
  </I>
);
const IcoClock = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></I>
);
const IcoSliders = (p) => (
  <I {...p}>
    <path d="M4 8h4" /><path d="M14 8h6" /><circle cx="11" cy="8" r="2" />
    <path d="M4 16h10" /><path d="M18 16h2" /><circle cx="16" cy="16" r="2" />
  </I>
);
const IcoChevron = (p) => <I {...p}><path d="M9 6l6 6-6 6" /></I>;
const IcoArrowRight = (p) => <I {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></I>;

const initials = (name) =>
  (name || "?").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

function PmTile({ icon, name, sub, tint, featured, badge, disabled, onClick, delay = 0 }) {
  return (
    <button
      className={`pm-tile pm-anim${tint ? ` ${tint}` : ""}${featured ? " featured" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
      disabled={disabled}
      onClick={onClick}
    >
      {badge && <span className="pm-tile-badge">{badge}</span>}
      <span className="pm-tile-icon">{icon}</span>
      <span className="pm-tile-name">{name}</span>
      <span className="pm-tile-sub">{sub}</span>
      <span className="pm-tile-arrow"><IcoChevron size={14} /></span>
    </button>
  );
}

/**
 * Bottom action sheet for a course-space file — prototype-matched.
 * Drag down on the handle/header to dismiss (30% height or flick), snaps
 * back otherwise; backdrop tap and the close button also dismiss.
 * file === null → closed.
 */
export default function PracticeSheet({
  file,
  onClose,
  onOpen,
  onGenerate,
  onGuidedStudy,
  onExamSimulation,
  onGoLive,
  goingLive,
  generating,
  preparingStudy,
  mcqProgress,
  guidedProgress,
  onJoinLive,
}) {
  const { modalProps, focusRef } = useModalA11y({
    isOpen: !!file,
    onClose,
    labelledBy: "sp-sheet-title",
  });

  const dragRef = useRef(null);
  const [livePeople, setLivePeople] = useState([]);
  const [activeQuizzes, setActiveQuizzes] = useState([]);
  // Session prefs (answer style + extras) — persisted to the survival save so
  // StreakSurvival picks them up the moment the runner mounts.
  const [prefs, setPrefs] = useState(() => loadSave()?.quizPrefs || { style: "smart", recallFirst: true, speedRound: false });
  const [settingsPos, setSettingsPos] = useState(null);
  const gearRef = useRef(null);

  const setPref = (k, v) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    try {
      mutate((s) => { s.quizPrefs = { ...(s.quizPrefs || {}), [k]: v }; });
    } catch {}
  };

  const toggleSettings = () => {
    if (settingsPos) { setSettingsPos(null); return; }
    const r = gearRef.current?.getBoundingClientRect();
    setSettingsPos(r
      ? { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }
      : { top: 90, right: 16 });
  };

  // Real faces for the live tile (suggested people + quiz hosts) and any
  // joinable lobby for this material — best-effort, renders fine without it.
  useEffect(() => {
    if (!file) return;
    let dead = false;
    (async () => {
      const [sug, quizzes] = await Promise.all([
        feedApi.getSuggested().catch(() => []),
        feedApi.getActiveQuizzes().catch(() => []),
      ]);
      if (dead) return;
      const people = [];
      const seen = new Set();
      const add = (key, name, avatar) => {
        if (!key || seen.has(key)) return;
        seen.add(key);
        people.push({ name: name || "?", avatar: avatar || null });
      };
      for (const u of sug || []) add(u.id || u.username || u.name, u.name || u.username, u.avatar);
      for (const q of quizzes || []) add(q.hostId || q.host, q.hostName || q.host, q.hostAvatar);
      setLivePeople(people.slice(0, 5));
      setActiveQuizzes(quizzes || []);
    })();
    return () => { dead = true; };
  }, [file]);

  // Drag-to-dismiss on the grab zone (handle + header)
  const onDragStart = (e) => {
    if (e.target.closest("button")) return;
    const el = e.currentTarget.closest(".cs-sheet");
    if (!el) return;
    dragRef.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), v: 0, dy: 0 };
    el.classList.add("cs-sheet-dragging");
    el.setPointerCapture?.(e.pointerId);
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const now = performance.now();
      const dt = now - d.lastT;
      if (dt > 0) d.v = (ev.clientY - d.lastY) / dt;
      d.lastY = ev.clientY;
      d.lastT = now;
      d.dy = Math.max(0, ev.clientY - d.startY);
      el.style.transform = `translateY(${d.dy}px)`;
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !el.isConnected) return;
      const threshold = el.offsetHeight * 0.3;
      if (d.dy > threshold || d.v > 0.5) {
        // Flick / far enough — animate out, then close
        el.classList.remove("cs-sheet-dragging");
        el.style.transition = "transform 0.22s ease-in";
        el.style.transform = "translateY(105%)";
        setTimeout(onClose, 200);
      } else {
        // Snap back
        el.classList.remove("cs-sheet-dragging");
        el.style.transition = "transform 0.25s cubic-bezier(0.32,0.72,0,1)";
        el.style.transform = "translateY(0)";
        setTimeout(() => { el.style.transition = ""; el.style.transform = ""; }, 260);
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { once: true });
    document.addEventListener("pointercancel", onUp, { once: true });
  };

  if (!file) return null;

  const mcq = file.variants?.mcq || null;
  const summary = file.variants?.summary || null;
  const exam = file.variants?.exam || null;
  const examCount = getVariantCount(exam);
  const mcqCount = getVariantCount(mcq);
  const prog = mcq && mcqProgress ? mcqProgress[mcq.id] : null;
  const mcqPct = prog
    ? (prog.learnedPct ?? (prog.total > 0 ? Math.min(100, Math.round(((prog.mastered || 0) / prog.total) * 100)) : null))
    : null;
  const bestPct = prog && (prog.bestTotal || prog.total) > 0 ? Math.round((prog.bestScore / (prog.bestTotal || prog.total)) * 100) : null;
  const canExtract = !!(file.fileUrl || file.description);
  const act = (fn) => () => { onClose(); fn?.(); };
  const estMin = Math.max(1, Math.ceil((mcqCount || 20) * 5 / 60));

  // Saved exam resources get a slim take-exam sheet instead of the practice grid
  if (file.contentType === "exam") {
    const qCount = getVariantCount(file);
    return createPortal(
      <div className="cs-sheet-backdrop" onClick={onClose}>
        <div
          {...modalProps}
          ref={focusRef}
          className="cs-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="cs-sheet-grab"
            onPointerDown={onDragStart}
            role="separator"
            aria-label="Drag down to close"
          >
            <div className="cs-sheet-handle" />
          </div>
          <div className="pm-top" onPointerDown={onDragStart}>
            <div style={{ minWidth: 0 }}>
              <p className="cs-sheet-label">EXAM</p>
              <p className="cs-sheet-title" id="sp-sheet-title">{file.title}</p>
              <p className="pm-header-meta">
                <IcoClipboard size={11} />
                <span>Saved exam{qCount ? ` · ${qCount} questions` : ""}</span>
              </p>
            </div>
            <button className="cs-sheet-close" onClick={onClose} aria-label="Close menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="pm-scroll">
            <section className="pm-hero pm-anim" aria-label="Exam session">
              <div className="pm-hero-row">
                <div className="pm-hero-icon"><IcoClipboard size={21} /></div>
                <div className="pm-hero-info">
                  <div className="pm-hero-name-row">
                    <span className="pm-hero-name">Exam</span>
                    <span className="pm-badge-ready">Ready</span>
                  </div>
                  <div className="pm-hero-sub">
                    {qCount ? `${qCount} questions` : "Saved exam"} — retake anytime
                  </div>
                </div>
              </div>
              <button
                className="pm-hero-btn"
                onClick={act(() => onExamSimulation?.(file))}
              >
                Start exam <IcoArrowRight size={15} />
              </button>
            </section>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Guided Study progress for this material — server-synced index prop first,
  // then the per-key localStorage record written by GuidedStudy itself.
  let gsProg = guidedProgress?.[file.id] || null;
  if (!gsProg) {
    try {
      const raw = localStorage.getItem(`sc_guided_progress_${file.id}`);
      if (raw) { const p = JSON.parse(raw); if (p && p.total > 0) gsProg = p; }
    } catch {}
  }

  const heroSub = mcq
    ? prog
      ? mcqPct != null
        ? `${mcqCount} questions · ${mcqPct}% learned`
        : `best ${prog.bestScore}/${prog.bestTotal ?? prog.total ?? "?"}${prog.attempts > 1 ? ` · ${prog.attempts} attempts` : ""}`
      : (mcqCount ? `${mcqCount} questions queued and ready to go` : "Ready to practice")
    : "Generate questions from this material";

  const gsDone = gsProg && gsProg.done >= gsProg.total;
  const gsSub = preparingStudy
    ? "Extracting document…"
    : gsProg
      ? (gsDone ? "All sections complete — review anytime" : `Continue — ${gsProg.done} of ${gsProg.total} sections`)
      : canExtract ? "AI walkthrough" : "No extractable text";
  const gsBadge = preparingStudy
    ? null
    : gsProg ? (gsDone ? "DONE" : `${gsProg.done}/${gsProg.total}`) : "AI";

  // A joinable lobby already running on this material — join instead of hosting
  const liveMatch = activeQuizzes.find(
    (q) => (mcq && q.mcqResourceId === mcq.id) || q.resourceId === file.id
  ) || null;

  const styleLabel = STYLE_OPTIONS.find(([id]) => id === prefs.style)?.[1] || "Smart mix";

  // Most recent study timestamp across the material and its MCQ variant
  let lastStudiedTs = 0;
  for (const e of loadHistory(file.id)) lastStudiedTs = Math.max(lastStudiedTs, e.ts || 0);
  if (mcq) for (const e of loadHistory(mcq.id)) lastStudiedTs = Math.max(lastStudiedTs, e.ts || 0);

  const fileTypeLabel =
    file.subject ||
    (file.contentType === "pdf" ? "PDF"
      : file.contentType === "note" ? "Note"
      : file.contentType === "mcq" ? "Question set"
      : file.contentType === "flashcard_deck" ? "Flashcards"
      : file.contentType === "link" ? "Link"
      : file.contentType === "video" ? "Video"
      : "Material");
  const fileIcon =
    file.contentType === "mcq" ? <IcoBolt size={11} />
    : file.contentType === "note" || file.contentType === "pdf" ? <IcoFileText size={11} />
    : file.contentType === "flashcard_deck" ? <IcoClipboard size={11} />
    : <IcoFile size={11} />;

  const shownPeople = livePeople.slice(0, 3);
  const extraPeople = livePeople.length - shownPeople.length;

  return createPortal(
    <div className="cs-sheet-backdrop" onClick={onClose}>
      <div
        {...modalProps}
        ref={focusRef}
        className="cs-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab zone — drag down to dismiss */}
        <div
          className="cs-sheet-grab"
          onPointerDown={onDragStart}
          role="separator"
          aria-label="Drag down to close"
        >
          <div className="cs-sheet-handle" />
        </div>

        {/* Header — PRACTICE label + title + streak + close */}
        <div
          className="pm-top"
          onPointerDown={onDragStart}
        >
          <div style={{ minWidth: 0 }}>
            <p className="cs-sheet-label">PRACTICE</p>
            <p className="cs-sheet-title" id="sp-sheet-title">{file.title}</p>
            <p className="pm-header-meta">{fileIcon}<span>{fileTypeLabel}</span></p>
          </div>
          <button className="cs-sheet-close" onClick={onClose} aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="pm-scroll">
          {/* Hero — Rapid Recall */}
          <section className="pm-hero pm-anim" aria-label="Rapid recall session">
            <div className="pm-hero-row">
              <div className="pm-hero-icon"><IcoBolt size={21} /></div>
              <div className="pm-hero-info">
                <div className="pm-hero-name-row">
                  <span className="pm-hero-name">Rapid recall</span>
                  <span className={`pm-badge-ready${mcq ? "" : " pm-badge-setup"}`}>{mcq ? "Ready" : "Setup"}</span>
                </div>
                <div className="pm-hero-sub">{heroSub}</div>
                {mcq && mcqPct != null && (
                  <div className="pm-progress" role="progressbar" aria-valuenow={mcqPct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="pm-progress-bar" style={{ width: `${mcqPct}%` }} />
                  </div>
                )}
                {mcq && (
                  <div className="pm-hero-meta">
                    {mcqCount > 0 && <span className="pm-chip"><IcoClock size={12} />~{estMin} min</span>}
                    <button
                      ref={gearRef}
                      type="button"
                      className="pm-chip pm-chip-style"
                      onClick={toggleSettings}
                      aria-expanded={!!settingsPos}
                      aria-haspopup="menu"
                    >
                      <IcoSliders size={12} />{styleLabel}
                    </button>
                    {prog?.mastered != null && prog.total > 0 && (
                      <span className="pm-chip pm-chip-good">🌟 {prog.mastered}/{prog.total} mastered</span>
                    )}
                    {bestPct != null && <span className="pm-chip pm-chip-best">Best {bestPct}%</span>}
                    {prog?.attempts > 0 && <span className="pm-chip">{prog.attempts} attempt{prog.attempts > 1 ? "s" : ""}</span>}
                    {lastStudiedTs > 0 && <span className="pm-chip pm-chip-ice"><IcoClock size={11} />{relTime(lastStudiedTs)}</span>}
                  </div>
                )}
              </div>
            </div>
            <button
              className="pm-hero-btn"
              disabled={generating}
              onClick={act(() => (mcq ? onOpen(mcq.shareToken) : onGenerate?.(file, "mcqs")))}
            >
              {mcq ? (prog ? "Continue recall" : "Start recall") : generating ? "Generating…" : "Generate questions"} <IcoArrowRight size={15} />
            </button>
          </section>

          <div className="pm-section pm-anim" style={{ animationDelay: "60ms" }}>More ways to practice</div>

          <div className="pm-grid">
            <PmTile
              delay={90}
              tint="tint-violet" badge={gsBadge}
              icon={<IcoBrain size={17} />}
              name="Guided study"
              sub={gsSub}
              disabled={!canExtract || generating || preparingStudy}
              onClick={act(() => onGuidedStudy?.(file))}
            />
            <PmTile
              delay={130}
              tint="tint-blue"
              icon={<IcoFileText size={17} />}
              name="Summary"
              sub={summary ? "AI recap" : "Tap to create"}
              disabled={generating}
              onClick={act(() => (summary ? onOpen(summary.shareToken) : onGenerate?.(file, "summary")))}
            />
            <PmTile
              delay={170}
              tint="tint-green"
              icon={<IcoClipboard size={17} />}
              name="Exam sim"
              sub={
                exam
                  ? `${examCount || "Saved"} questions — take exam`
                  : canExtract
                    ? "AI builds a custom exam"
                    : "No extractable text"
              }
              disabled={!canExtract || generating}
              onClick={act(() => onExamSimulation?.(exam || file))}
            />
            <PmTile
              delay={210}
              tint="tint-rose"
              icon={<IcoFile size={17} />}
              name="Material"
              sub={file.fileName || "Source document"}
              onClick={act(() => onOpen(file.shareToken))}
            />
          </div>

          {/* Live */}
          <button
            className="pm-live pm-anim"
            style={{ animationDelay: "250ms" }}
            disabled={liveMatch ? false : (!mcq || generating || goingLive)}
            onClick={act(() => (liveMatch ? onJoinLive?.(liveMatch.code) : onGoLive?.(file)))}
            aria-label={liveMatch ? `Join live quiz — ${liveMatch.players} in lobby` : "Go live with friends — quiz together in real time"}
          >
            <span className="pm-tile-icon"><IcoUsers size={17} /></span>
            <span className="pm-live-body">
              <span className="pm-live-name"><span className="pm-live-dot" />{liveMatch ? "Join live quiz" : goingLive ? "Opening lobby…" : "Go live with friends"}</span>
              <span className="pm-live-sub">{liveMatch ? `${liveMatch.host} · ${liveMatch.players}/8 in lobby` : mcq ? "Quiz together in real time" : "Generate Rapid Recall first"}</span>
            </span>
            {shownPeople.length > 0 && (
              <span className="pm-avatars" aria-hidden="true">
                {shownPeople.map((p, i) =>
                  p.avatar
                    ? <img key={i} className="pm-avatar" src={p.avatar} alt="" />
                    : <span key={i} className={`pm-avatar pm-av-${i}`}>{initials(p.name)}</span>
                )}
                {extraPeople > 0 && <span className="pm-avatar pm-av-2">+{extraPeople}</span>}
              </span>
            )}
            <span className="pm-chev"><IcoChevron size={16} /></span>
          </button>
        </div>

        {/* Session settings — anchored popover, survives the hero's overflow:clip */}
        {settingsPos && (
          <>
            <div className="pm-menu-backdrop" onClick={() => setSettingsPos(null)} />
            <div
              className="pm-menu"
              role="menu"
              aria-label="Recall session settings"
              style={{ top: settingsPos.top, right: settingsPos.right }}
            >
              <div className="pm-menu-label">Answer style</div>
              {STYLE_OPTIONS.map(([id, name, desc]) => (
                <button
                  key={id}
                  className={`pm-menu-item${prefs.style === id ? " on" : ""}`}
                  role="menuitemradio"
                  aria-checked={prefs.style === id}
                  onClick={() => setPref("style", id)}
                >
                  <span className="pm-menu-item-body">
                    <span className="pm-menu-item-name">{name}</span>
                    <span className="pm-menu-item-desc">{desc}</span>
                  </span>
                  {prefs.style === id && <span className="pm-menu-check">✓</span>}
                </button>
              ))}
              <div className="pm-menu-label">Extras</div>
              {EXTRA_OPTIONS.map(([k, name, desc]) => (
                <button
                  key={k}
                  className="pm-menu-item"
                  role="menuitemcheckbox"
                  aria-checked={!!prefs[k]}
                  onClick={() => setPref(k, !prefs[k])}
                >
                  <span className="pm-menu-item-body">
                    <span className="pm-menu-item-name">{name}</span>
                    <span className="pm-menu-item-desc">{desc}</span>
                  </span>
                  <span className={`pm-menu-toggle${prefs[k] ? " on" : ""}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
