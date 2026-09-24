import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalA11y } from "../../hooks/useModalA11y";
import { feedApi } from "../feed/feedApi";

function getVariantCount(variant) {
  if (!variant) return 0;
  try {
    if (variant.contentType === "mcq" && variant.mcqData) {
      const data = typeof variant.mcqData === "string" ? JSON.parse(variant.mcqData) : variant.mcqData;
      return Array.isArray(data) ? data.length : 0;
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
const IcoFlame = (p) => (
  <I {...p} filled>
    <path d="M12 22c4.4 0 7-2.8 7-6.5 0-3-1.8-5.4-3.4-7.4C14 6 13 4 13 2c-3 2-5 4.5-5.5 7-.3-.5-.5-1-.5-1.5C5.5 9 5 11.3 5 14.5 5 19.2 7.6 22 12 22z" />
  </I>
);
const IcoClock = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></I>
);
const IcoShuffle = (p) => (
  <I {...p}>
    <path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" />
    <path d="M15 15l6 6" /><path d="M4 4l5 5" />
  </I>
);
const IcoChevron = (p) => <I {...p}><path d="M9 6l6 6-6 6" /></I>;
const IcoArrowRight = (p) => <I {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></I>;

const initials = (name) =>
  (name || "?").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

function PmTile({ icon, name, sub, tint, featured, badge, disabled, onClick }) {
  return (
    <button
      className={`pm-tile${tint ? ` ${tint}` : ""}${featured ? " featured" : ""}`}
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
  streak,
}) {
  const { modalProps, focusRef } = useModalA11y({
    isOpen: !!file,
    onClose,
    labelledBy: "sp-sheet-title",
  });

  const dragRef = useRef(null);
  const [livePeople, setLivePeople] = useState([]);

  // Real faces for the live tile — suggested people + active quiz hosts,
  // best-effort; renders nothing until data arrives.
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
  const mcqCount = getVariantCount(mcq);
  const prog = mcq && mcqProgress ? mcqProgress[mcq.id] : null;
  const mcqPct = prog
    ? (prog.learnedPct ?? (prog.total > 0 ? Math.min(100, Math.round(((prog.mastered || 0) / prog.total) * 100)) : null))
    : null;
  const bestPct = prog && (prog.bestTotal || prog.total) > 0 ? Math.round((prog.bestScore / (prog.bestTotal || prog.total)) * 100) : null;
  const canExtract = !!(file.fileUrl || file.description);
  const act = (fn) => () => { onClose(); fn?.(); };
  const estMin = Math.max(1, Math.ceil((mcqCount || 20) * 5 / 60));

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
      ? `${mcqCount} questions · ${mcqPct ?? 0}% learned${bestPct != null ? ` · best ${bestPct}%` : ""}`
      : (mcqCount ? `${mcqCount} questions queued and ready to go` : "Ready to practice")
    : "Generate questions from this material";

  const gsSub = preparingStudy
    ? "Extracting document…"
    : gsProg
      ? (gsProg.done >= gsProg.total ? "All sections complete" : `Continue — ${gsProg.done} of ${gsProg.total} sections`)
      : canExtract ? "AI walkthrough" : "No extractable text";

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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {streak > 0 && (
              <span className="pm-streak" aria-label={`${streak} day streak`}>
                <IcoFlame size={15} />
                <span>{streak}</span>
              </span>
            )}
            <button className="cs-sheet-close" onClick={onClose} aria-label="Close menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="pm-scroll">
          {/* Hero — Rapid Recall */}
          <section className="pm-hero" aria-label="Rapid recall session">
            <div className="pm-hero-row">
              <div className="pm-hero-icon"><IcoBolt size={21} /></div>
              <div className="pm-hero-info">
                <div className="pm-hero-name-row">
                  <span className="pm-hero-name">Rapid recall</span>
                  <span className={`pm-badge-ready${mcq ? "" : " pm-badge-setup"}`}>{mcq ? "Ready" : "Setup"}</span>
                </div>
                <div className="pm-hero-sub">{heroSub}</div>
                {mcq && (
                  <div className="pm-hero-meta">
                    <span className="pm-chip"><IcoClock size={12} />~{estMin} min</span>
                    <span className="pm-chip"><IcoShuffle size={12} />Mixed types</span>
                  </div>
                )}
              </div>
            </div>
            <button
              className="pm-hero-btn"
              disabled={generating}
              onClick={act(() => (mcq ? onOpen(mcq.shareToken) : onGenerate?.(file, "mcqs")))}
            >
              {mcq ? "Start recall" : generating ? "Generating…" : "Generate questions"} <IcoArrowRight size={15} />
            </button>
          </section>

          <div className="pm-section">More ways to practice</div>

          <div className="pm-grid">
            <PmTile
              tint="tint-gold" featured badge="AI"
              icon={<IcoBrain size={17} />}
              name="Guided study"
              sub={gsSub}
              disabled={!canExtract || generating || preparingStudy}
              onClick={act(() => onGuidedStudy?.(file))}
            />
            <PmTile
              tint="tint-green"
              icon={<IcoFileText size={17} />}
              name="Summary"
              sub={summary ? "AI recap" : "Tap to create"}
              disabled={generating}
              onClick={act(() => (summary ? onOpen(summary.shareToken) : onGenerate?.(file, "summary")))}
            />
            <PmTile
              tint="tint-coral"
              icon={<IcoClipboard size={17} />}
              name="Exam sim"
              sub={mcq ? "Timed test" : "Needs Rapid Recall"}
              disabled={!mcq || generating}
              onClick={act(() => onExamSimulation?.([mcq.id]))}
            />
            <PmTile
              icon={<IcoFile size={17} />}
              name="Material"
              sub={file.fileName || "Source document"}
              onClick={act(() => onOpen(file.shareToken))}
            />
          </div>

          {/* Live */}
          <button
            className="pm-live"
            disabled={!mcq || generating || goingLive}
            onClick={act(() => onGoLive?.(file))}
            aria-label="Go live with friends — quiz together in real time"
          >
            <span className="pm-tile-icon"><IcoUsers size={17} /></span>
            <span className="pm-live-body">
              <span className="pm-live-name"><span className="pm-live-dot" />{goingLive ? "Opening lobby…" : "Go live with friends"}</span>
              <span className="pm-live-sub">{mcq ? "Quiz together in real time" : "Generate Rapid Recall first"}</span>
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
      </div>
    </div>,
    document.body
  );
}
