import { useRef } from "react";
import { createPortal } from "react-dom";
import { useModalA11y } from "../../hooks/useModalA11y";

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

const Chevron = ({ color = "#646E84" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M9 6l6 6l-6 6" />
  </svg>
);
const Plus = ({ color = "#F5A623" }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);

function SheetBtn({ icon, iconBg, label, sub, subColor, badge, disabled, onClick, variant }) {
  return (
    <button
      className={`sp-sheet-btn${variant ? ` ${variant}` : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-disabled={disabled || undefined}
    >
      <span className="sp-sheet-ico" style={{ background: iconBg }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div className="sp-sheet-label">{label}</div>
        {sub && <div className="sp-sheet-sub" style={subColor ? { color: subColor } : undefined}>{sub}</div>}
      </span>
      {badge
        ? <span className="sp-sheet-badge">{badge}</span>
        : (variant === "generate" ? <Plus /> : <Chevron />)}
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
}) {
  const { modalProps, focusRef } = useModalA11y({
    isOpen: !!file,
    onClose,
    labelledBy: "sp-sheet-title",
  });

  const dragRef = useRef(null);

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
  const flashcard = file.variants?.flashcard || null;
  const summary = file.variants?.summary || null;
  const mcqCount = getVariantCount(mcq);
  const cardCount = getVariantCount(flashcard);
  const prog = mcq && mcqProgress ? mcqProgress[mcq.id] : null;
  const mcqPct = prog
    ? (prog.learnedPct ?? (prog.total > 0 ? Math.min(100, Math.round(((prog.mastered || 0) / prog.total) * 100)) : null))
    : null;
  const bestPct = prog && (prog.bestTotal || prog.total) > 0 ? Math.round((prog.bestScore / (prog.bestTotal || prog.total)) * 100) : null;
  const canExtract = !!(file.fileUrl || file.description);
  const act = (fn) => () => { onClose(); fn?.(); };

  // Guided Study progress for this material — server-synced index prop first,
  // then the per-key localStorage record written by GuidedStudy itself.
  let gsProg = guidedProgress?.[file.id] || null;
  if (!gsProg) {
    try {
      const raw = localStorage.getItem(`sc_guided_progress_${file.id}`);
      if (raw) { const p = JSON.parse(raw); if (p && p.total > 0) gsProg = p; }
    } catch {}
  }

  const mcqSub = mcq
    ? prog
      ? (prog.total > 0
        ? `${mcqPct}% learned · 🌟 ${prog.mastered || 0}/${prog.total} mastered · best ${bestPct}%${prog.attempts > 1 ? ` · ${prog.attempts} attempts` : ""}`
        : `best ${prog.bestScore}/${prog.bestTotal ?? "?"}${prog.attempts > 1 ? ` · ${prog.attempts} attempts` : ""}`)
      : (mcqCount ? `${mcqCount} questions · ready` : "Ready to practice")
    : "Not generated yet · tap to create";

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

        {/* Header — PRACTICE label + serif title + close */}
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, touchAction: "none" }}
          onPointerDown={onDragStart}
        >
          <div style={{ minWidth: 0 }}>
            <p className="cs-sheet-label">PRACTICE</p>
            <p className="cs-sheet-title" id="sp-sheet-title">{file.title}</p>
          </div>
          <button className="cs-sheet-close" onClick={onClose} aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="sp-sheet-list">
          <SheetBtn
            icon="✎" iconBg="rgba(245,166,35,0.1)"
            label="MCQ"
            sub={mcqSub}
            badge={mcqPct != null ? `${mcqPct}%` : undefined}
            subColor={mcq ? undefined : "#F5A623"}
            variant={mcq ? undefined : "generate"}
            disabled={generating}
            onClick={act(() => mcq ? onOpen(mcq.shareToken) : onGenerate?.(file, "mcqs"))}
          />
          <SheetBtn
            icon={preparingStudy ? "⏳" : "🧠"} iconBg="rgba(245,166,35,0.12)"
            label="Guided study"
            sub={preparingStudy
              ? "Extracting document…"
              : gsProg
                ? (gsProg.done >= gsProg.total ? "All sections complete — review anytime" : `Continue — ${gsProg.done} of ${gsProg.total} sections done`)
                : canExtract ? "AI walks you through the key concepts" : "No extractable text on this item"}
            badge={preparingStudy ? undefined : gsProg ? (gsProg.done >= gsProg.total ? "DONE" : `${gsProg.done}/${gsProg.total}`) : "RECOMMENDED"}
            variant="recommended"
            disabled={!canExtract || generating || preparingStudy}
            onClick={act(() => onGuidedStudy?.(file))}
          />
          <SheetBtn
            icon="🎴" iconBg="rgba(245,166,35,0.1)"
            label="Flashcards"
            sub={flashcard
              ? (cardCount ? `${cardCount} cards · ready` : "Ready to review")
              : "Not generated yet · tap to create"}
            subColor={flashcard ? undefined : "#F5A623"}
            variant={flashcard ? undefined : "generate"}
            disabled={generating}
            onClick={act(() => flashcard ? onOpen(flashcard.shareToken) : onGenerate?.(file, "mcqs"))}
          />
          <SheetBtn
            icon="📝" iconBg="rgba(245,166,35,0.1)"
            label="Summary"
            sub={summary ? "Read the AI summary" : "Not generated yet · tap to create"}
            subColor={summary ? undefined : "#F5A623"}
            variant={summary ? undefined : "generate"}
            disabled={generating}
            onClick={act(() => summary ? onOpen(summary.shareToken) : onGenerate?.(file, "summary"))}
          />
          <SheetBtn
            icon="🎓" iconBg="rgba(255,84,112,0.1)"
            label="Exam simulator"
            sub={mcq ? "Timed, mixed-format mock test" : "Generate MCQs first"}
            disabled={!mcq || generating}
            onClick={act(() => onExamSimulation?.([mcq.id]))}
          />
          <SheetBtn
            icon="📄" iconBg="rgba(255,255,255,0.05)"
            label="View material"
            sub={file.fileName ? `Open ${file.fileName}` : "Open the original document"}
            onClick={act(() => onOpen(file.shareToken))}
          />

          <div className="sp-sheet-divider" />

          <SheetBtn
            icon="👥" iconBg="rgba(245,166,35,0.1)"
            label="Go live with friends"
            sub={mcq ? "Quiz together, in real time" : "Generate MCQs first"}
            subColor={mcq ? undefined : "#F5A623"}
            variant="golive"
            disabled={!mcq || generating || goingLive}
            onClick={act(() => onGoLive?.(file))}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
