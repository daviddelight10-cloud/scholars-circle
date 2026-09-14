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

const Chevron = ({ color = "#4B5563" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M9 6l6 6l-6 6" />
  </svg>
);
const Plus = ({ color = "#7FADF5" }) => (
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
 * file === null → closed.
 */
export default function PracticeSheet({
  file,
  onClose,
  onOpen,
  onGenerate,
  onGuidedStudy,
  onExamSimulation,
  generating,
}) {
  const { modalProps, focusRef } = useModalA11y({
    isOpen: !!file,
    onClose,
    labelledBy: "sp-sheet-title",
  });

  if (!file) return null;

  const mcq = file.variants?.mcq || null;
  const flashcard = file.variants?.flashcard || null;
  const summary = file.variants?.summary || null;
  const mcqCount = getVariantCount(mcq);
  const cardCount = getVariantCount(flashcard);
  const canExtract = !!(file.fileUrl || file.description);
  const act = (fn) => () => { onClose(); fn?.(); };

  return (
    <div className="cs-sheet-backdrop" onClick={onClose}>
      <div
        {...modalProps}
        ref={focusRef}
        className="cs-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cs-sheet-handle" />

        {/* Header — PRACTICE label + serif title + close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
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
            icon="✎" iconBg="rgba(61,214,140,0.1)"
            label="MCQ"
            sub={mcq
              ? (mcqCount ? `${mcqCount} questions · ready` : "Ready to practice")
              : "Not generated yet · tap to create"}
            subColor={mcq ? undefined : "#7FADF5"}
            variant={mcq ? undefined : "generate"}
            disabled={generating}
            onClick={act(() => mcq ? onOpen(mcq.shareToken) : onGenerate?.(file, "mcqs"))}
          />
          <SheetBtn
            icon="🧠" iconBg="rgba(245,197,66,0.12)"
            label="Guided study"
            sub={canExtract ? "AI walks you through the key concepts" : "No extractable text on this item"}
            badge="RECOMMENDED"
            variant="recommended"
            disabled={!canExtract || generating}
            onClick={act(() => onGuidedStudy?.(file))}
          />
          <SheetBtn
            icon="🎴" iconBg="rgba(61,214,140,0.1)"
            label="Flashcards"
            sub={flashcard
              ? (cardCount ? `${cardCount} cards · ready` : "Ready to review")
              : "Not generated yet · tap to create"}
            subColor={flashcard ? undefined : "#7FADF5"}
            variant={flashcard ? undefined : "generate"}
            disabled={generating}
            onClick={act(() => flashcard ? onOpen(flashcard.shareToken) : onGenerate?.(file, "mcqs"))}
          />
          <SheetBtn
            icon="📝" iconBg="rgba(127,173,245,0.1)"
            label="Summary"
            sub={summary ? "Read the AI summary" : "Not generated yet · tap to create"}
            subColor={summary ? undefined : "#7FADF5"}
            variant={summary ? undefined : "generate"}
            disabled={generating}
            onClick={act(() => summary ? onOpen(summary.shareToken) : onGenerate?.(file, "summary"))}
          />
          <SheetBtn
            icon="🎓" iconBg="rgba(255,107,94,0.1)"
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
            icon="👥" iconBg="rgba(127,173,245,0.12)"
            label="Go live with friends"
            sub="Study this together, in real time"
            badge="COMING SOON"
            variant="golive"
            disabled
          />
        </div>
      </div>
    </div>
  );
}
