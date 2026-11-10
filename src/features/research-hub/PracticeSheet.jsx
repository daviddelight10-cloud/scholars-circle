import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalA11y } from "../../hooks/useModalA11y";
import { feedApi } from "../feed/feedApi";
import { loadSave, mutate } from "../streak-survival/survivalStore.js";
import { loadHistory } from "../../lib/studyHistory.js";
import { mcqRingPct } from "../../lib/researchUtils";
import { getExamAttempts } from "../exam/examApi";
import AvatarMark from "../../components/AvatarMark.jsx";

// Answer-style options — same ids as StreakSurvival's Session setup
const STYLE_OPTIONS = [
  ["smart", "Smart mix", "choices for new cards, typing once you know them"],
  ["mcq", "Choices", "pick from four options"],
  ["typing", "Type it out", "free recall — strongest for memory"],
  ["flashcard", "Flip cards", "reveal, then grade yourself"],
  ["mixed", "Variety mix", "a bit of everything"],
];
const EXTRA_OPTIONS = [
  ["recallFirst", "Hide choices until I tap", "choices stay hidden until you tap"],
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
  // Server-computed count for guests (question payload is withheld)
  if (variant.questionCount != null) return variant.questionCount;
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
    <path d="M12 4c2.5-1.5 6-.5 6 2.2 0 .5-.1 1-.3 1.5 1 .7 1.8 1.9 1.8 3.3 0 .7-.2 1.4-.6 2 .3.6.5 1.3.4 2-.3 2.5-3 3.7-5.3 2.7-.6-.3-1-.8-1-1.4V6.2c0-.9-.4-1.8 1-2.2z" />
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
const IcoBookmark = (p) => <I {...p}><path d="M17 3H7a2 2 0 0 0-2 2v16l7-4 7 4V5a2 2 0 0 0-2-2z" /></I>;


function PmRow({ icon, name, sub, tint, badge, disabled, onClick, delay = 0, wdelay = 2000 }) {
  return (
    <button
      className={`pm-row${tint ? ` ${tint}` : ""}`}
      style={{ "--d": `${delay}ms`, "--wd": `${wdelay}ms` }}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="pm-tile-icon">{icon}</span>
      <span className="pm-live-body">
        <span className="pm-tile-name">{name}{badge && <span className="pm-row-badge">{badge}</span>}</span>
        <span className="pm-live-sub">{sub}</span>
      </span>
      <span className="pm-chev"><IcoChevron size={16} /></span>
    </button>
  );
}

// Eased 0→target count-up for the hero's question number
function useCountUp(target, { delay = 500, dur = 1100 } = {}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
      setN(Math.round((target || 0) * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, dur]);
  return n;
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
  onExamRegenerate,
  onGoLive,
  goingLive,
  generating,
  preparingStudy,
  mcqProgress,
  guidedProgress,
  onJoinLive,
  onSaveMaterial,
}) {
  const { modalProps, focusRef } = useModalA11y({
    isOpen: !!file,
    onClose,
    labelledBy: "sp-sheet-title",
  });

  const dragRef = useRef(null);
  const [livePeople, setLivePeople] = useState([]);
  const [activeQuizzes, setActiveQuizzes] = useState([]);
  const [examAttempts, setExamAttempts] = useState(null);
  // Session prefs (answer style + extras) — persisted to the survival save so
  // StreakSurvival picks them up the moment the runner mounts.
  const [prefs, setPrefs] = useState(() => loadSave()?.quizPrefs || { style: "smart", recallFirst: true, speedRound: false });
  const [settingsPos, setSettingsPos] = useState(null);
  const gearRef = useRef(null);
  // Eased 0→N count-up for the hero's question count (prototype)
  const mcqCountForAnim = getVariantCount(file?.variants?.mcq);
  const qNum = useCountUp(file ? mcqCountForAnim : 0);

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

  // Load attempt history for the saved exam, if any.
  useEffect(() => {
    if (!file) return;
    const examRes = file.contentType === "exam" ? file : file.variants?.exam;
    if (!examRes?.id) return;
    let dead = false;
    getExamAttempts(examRes.id)
      .then((data) => { if (!dead) setExamAttempts(data); })
      .catch(() => {});
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
  const examBestPct = examAttempts?.attempts?.length
    ? Math.round(
        examAttempts.attempts.reduce((max, a) => (a.total > 0 ? Math.max(max, a.score / a.total) : max), 0) * 100
      )
    : null;
  const examAttemptsCount = examAttempts?.attempts?.length || 0;
  const mcqCount = getVariantCount(mcq);
  const prog = mcq && mcqProgress ? mcqProgress[mcq.id] : null;
  const mcqPct = prog ? mcqRingPct(prog) : null;
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
                <span>
                  Saved exam{qCount ? ` · ${qCount} questions` : ""}
                  {examAttemptsCount > 0 && ` · ${examAttemptsCount} attempt${examAttemptsCount > 1 ? "s" : ""}`}
                  {examBestPct != null && ` · best ${examBestPct}%`}
                </span>
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
              <div className="pm-hero-actions" style={{ display: "flex", gap: 10 }}>
                <button
                  className="pm-hero-btn"
                  onClick={act(() => onExamSimulation?.(file))}
                >
                  Start exam <IcoArrowRight size={15} />
                </button>
                {onExamRegenerate && (
                  <button
                    className="pm-hero-btn"
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.25)" }}
                    onClick={act(() => onExamRegenerate?.(file))}
                  >
                    New version
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const heroSub = mcq
    ? prog
      ? mcqPct != null
        ? <><b className="pm-count-num">{qNum}</b>{` questions · ${mcqPct}% learned`}</>
        : `best ${prog.bestScore}/${prog.bestTotal ?? prog.total ?? "?"}${prog.attempts > 1 ? ` · ${prog.attempts} attempts` : ""}`
      : (mcqCount ? <><b className="pm-count-num">{qNum}</b> questions ready to go</> : "Ready to practice")
    : "Turn this material into a quiz you can practise";

  // Guided Study progress — server-synced index prop first, then the
  // per-key localStorage record written by GuidedStudy itself.
  let gsProg = guidedProgress?.[file.id] || null;
  if (!gsProg) {
    try {
      const raw = localStorage.getItem(`sc_guided_progress_${file.id}`);
      if (raw) { const p = JSON.parse(raw); if (p && p.total > 0) gsProg = p; }
    } catch {}
  }
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

  const isPdf = file.contentType === "pdf" || /\.pdf$/i.test(file.fileName || "");
  const mastered = mcqPct != null && mcqPct >= 90;
  const askAi = (mode) => act(() => {
    try { sessionStorage.setItem("sc_reader_intro", mode); } catch { /* storage unavailable */ }
    onOpen(file.shareToken);
  });

  // One smart "next step" — always leads with practice questions
  let hero;
  if (!mcq) {
    hero = { key: "make", name: "Practice questions", badge: "Setup", sub: heroSub, cta: generating ? "Generating…" : "Generate questions", icon: <IcoBolt size={21} />, run: () => onGenerate?.(file, "mcqs"), disabled: generating };
  } else if (mastered && canExtract) {
    hero = { key: "exam", name: "Take an exam", badge: "Ready", sub: `${mcqPct}% learned — test yourself under exam conditions`, cta: "Start exam", icon: <IcoClipboard size={21} />, run: () => onExamSimulation?.(exam || file), alt: { label: "Keep practising", run: () => onOpen(mcq.shareToken) } };
  } else {
    hero = { key: "practice", name: "Practice questions", badge: "Ready", sub: heroSub, cta: prog ? "Continue practice" : "Start practice", icon: <IcoBolt size={21} />, run: () => onOpen(mcq.shareToken), showMeta: true };
  }

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
          {/* Smart next step — changes with how far along this material is */}
          <section className="pm-hero pm-hero-enter" aria-label="Next step">
            <div className="pm-hero-shimmer" aria-hidden="true" />
            <span className="pm-aurora pm-aurora-a" aria-hidden="true" />
            <span className="pm-aurora pm-aurora-b" aria-hidden="true" />
            <span className="pm-aurora pm-aurora-c" aria-hidden="true" />
            {[
              ["60px", "30px", "4.2s", "1s", "#FFD27A", "5px"],
              ["150px", "20px", "5s", "2.1s", "#FF9DB8", "4px"],
              ["230px", "28px", "4.6s", "1.6s", "#B8A2FF", "6px"],
              ["300px", "16px", "5.4s", "3s", "#FFD27A", "4px"],
              ["110px", "10px", "4.8s", "0.4s", "#8FE3C4", "3px"],
            ].map(([fx, fy, fd, fdel, fc, fs], i) => (
              <span key={i} className="pm-spark" aria-hidden="true"
                style={{ "--fx": fx, "--fy": fy, "--fd": fd, "--fdel": fdel, "--fc": fc, "--fs": fs }} />
            ))}
            <div className="pm-hero-row">
              <div className="pm-hero-icon"><span className="pm-hero-ring" aria-hidden="true" />{hero.icon}</div>
              <div className="pm-hero-info">
                <div className="pm-hero-name-row">
                  <span className="pm-hero-name">{hero.name}</span>
                  <span className={`pm-badge-ready${hero.badge === "Setup" || hero.badge === "Start here" ? " pm-badge-setup" : ""}`}>{hero.badge}</span>
                </div>
                <div className="pm-hero-sub">{hero.sub}</div>
                {hero.showMeta && mcqPct != null && (
                  <div className="pm-progress" role="progressbar" aria-valuenow={mcqPct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="pm-progress-bar" style={{ width: `${mcqPct}%` }} />
                  </div>
                )}
                {mcq && hero.showMeta && (
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
                      <IcoSliders size={12} />Asked as: {styleLabel}
                    </button>
                    {prog?.mastered != null && prog.total > 0 && (
                      <span className="pm-chip pm-chip-good">🌟 {prog.mastered}/{prog.total} mastered</span>
                    )}
                    {bestPct != null && <span className="pm-chip pm-chip-best">Best {bestPct}%</span>}
                    {lastStudiedTs > 0 && <span className="pm-chip pm-chip-ice"><IcoClock size={11} />{relTime(lastStudiedTs)}</span>}
                  </div>
                )}
              </div>
            </div>
            <button className="pm-hero-btn" disabled={hero.disabled} onClick={act(hero.run)}>
              <span className="pm-btn-sweep" aria-hidden="true" />
              {hero.cta} <IcoArrowRight size={15} />
            </button>
            {hero.alt && (
              <button type="button" className="pm-hero-alt" onClick={act(hero.alt.run)}>{hero.alt.label}</button>
            )}
          </section>

          <div className="pm-section pm-anim" style={{ animationDelay: "60ms" }}>More ways to study</div>
          <PmRow
            delay={90} wdelay={2000}
            tint="tint-violet" badge={gsBadge}
            icon={<IcoBrain size={17} />}
            name="Study with AI"
            sub={gsSub}
            disabled={!canExtract || generating || preparingStudy}
            onClick={act(() => onGuidedStudy?.(file))}
          />
          {hero.key !== "exam" && (
            <PmRow
              delay={130} wdelay={3200}
              tint="tint-green"
              icon={<IcoClipboard size={17} />}
              name="Exam"
              badge={exam ? (examAttemptsCount > 0 ? `${examAttemptsCount}` : null) : null}
              sub={
                exam
                  ? `${examCount || "Saved"} questions${examBestPct != null ? ` · best ${examBestPct}%` : ""}`
                  : canExtract
                    ? "Timed, exam-style paper"
                    : "No extractable text"
              }
              disabled={!canExtract || generating}
              onClick={act(() => onExamSimulation?.(exam || file))}
            />
          )}
          <PmRow
            delay={150} wdelay={4400}
            tint="tint-blue"
            icon={<IcoFileText size={17} />}
            name="Summary"
            sub={summary ? "AI recap" : "Tap to create"}
            disabled={generating}
            onClick={act(() => (summary ? onOpen(summary.shareToken) : onGenerate?.(file, "summary")))}
          />
          <PmRow
            delay={170} wdelay={5600}
            tint="tint-rose"
            icon={<IcoFile size={17} />}
            name={isPdf ? "Read & ask AI" : "Open file"}
            sub={isPdf ? "Circle anything for an instant answer" : (file.fileName || "Source document")}
            onClick={isPdf ? askAi("circle") : act(() => onOpen(file.shareToken))}
          />

          <button
            className="pm-live"
            style={{ "--d": "210ms" }}
            disabled={liveMatch ? false : (generating || goingLive)}
            onClick={act(() => (liveMatch ? onJoinLive?.(liveMatch.code) : mcq ? onGoLive?.(file) : onGenerate?.(file, "mcqs")))}
            aria-label={liveMatch ? `Join live quiz — ${liveMatch.players} in lobby` : "Go live with friends — quiz together in real time"}
          >
            <span className="pm-tile-icon"><IcoUsers size={17} /></span>
            <span className="pm-live-body">
              <span className="pm-live-name"><span className="pm-live-dot" />{liveMatch ? "Join live quiz" : goingLive ? "Opening lobby…" : "Live quiz with friends"}</span>
              <span className="pm-live-sub">{liveMatch ? `${liveMatch.host} · ${liveMatch.players}/${liveMatch.maxPlayers || 50} in lobby` : mcq ? "Everyone answers the same questions live" : "Makes practice questions first"}</span>
            </span>
            {shownPeople.length > 0 && (
              <span className="pm-avatars" aria-hidden="true">
                {shownPeople.map((p, i) =>
                  <AvatarMark key={i} avatar={p.avatar} name={p.name} size={20}
                    className={`pm-avatar${p.avatar ? "" : ` pm-av-${i}`}`}
                    style={{ marginLeft: i === 0 ? 0 : -7, border: "2px solid var(--app-card)", background: "unset", "--ad": `${500 + i * 100}ms` }} />
                )}
                {extraPeople > 0 && <span className="pm-avatar pm-av-2" style={{ "--ad": `${500 + shownPeople.length * 100}ms` }}>+{extraPeople}</span>}
              </span>
            )}
            <span className="pm-chev"><IcoChevron size={16} /></span>
          </button>

          {onSaveMaterial && (
            <button type="button" className="pm-save-link pm-anim" style={{ animationDelay: "240ms" }} onClick={act(() => onSaveMaterial(file))}>
              <IcoBookmark size={13} />Save to My Space
            </button>
          )}
        </div>

        {/* Session settings — anchored popover, survives the hero's overflow:clip */}
        {settingsPos && (
          <>
            <div className="pm-menu-backdrop" onClick={() => setSettingsPos(null)} />
            <div
              className="pm-menu"
              role="menu"
              aria-label="How questions are asked"
              style={{ top: settingsPos.top, right: settingsPos.right }}
            >
              <div className="pm-menu-label">How you'll be asked</div>
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
