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

function SheetRow({ icon, iconBg, label, sub, badge, badgeStyle, disabled, onClick, danger }) {
  return (
    <button className="cs-sheet-row" disabled={disabled} onClick={onClick} aria-disabled={disabled || undefined}>
      <span className="cs-sheet-ico" style={{ background: iconBg }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="cs-sheet-row-label" style={danger ? { color: "#FF8A9B" } : undefined}>{label}</span>
        {sub && <div className="cs-sheet-row-sub">{sub}</div>}
      </span>
      {badge && <span className="cs-sheet-badge" style={badgeStyle}>{badge}</span>}
      {!badge && !disabled && <span style={{ color: "#5D6472", fontSize: 14 }}>›</span>}
    </button>
  );
}

/**
 * Bottom action sheet for a course-space file.
 * file === null → closed.
 */
export default function PracticeSheet({
  file,
  onClose,
  onOpen,
  onGenerate,
  onGuidedStudy,
  onExamSimulation,
  onShare,
  onDelete,
  canDelete,
  generating,
}) {
  const { modalProps, focusRef } = useModalA11y({
    isOpen: !!file,
    onClose,
    label: file ? `Actions for ${file.title}` : "File actions",
  });

  if (!file) return null;

  const mcq = file.variants?.mcq || null;
  const flashcard = file.variants?.flashcard || null;
  const summary = file.variants?.summary || null;
  const mcqCount = getVariantCount(mcq);
  const cardCount = getVariantCount(flashcard);
  const canExtract = !!(file.fileUrl || file.description);
  const fileName = file.fileName || file.title || "";

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

        {/* Header */}
        <div style={{ marginBottom: 10, padding: "0 4px" }}>
          <div className="cs-sheet-title">{file.title}</div>
          <div className="cs-sheet-sub">{fileName}</div>
        </div>

        <SheetRow
          icon="✎" iconBg="rgba(245,166,35,0.12)"
          label="Practice MCQs"
          sub={mcq ? `${mcqCount || ""} questions ready`.trim() : "Generate questions from this material"}
          disabled={generating}
          onClick={act(() => mcq ? onOpen(mcq.shareToken) : onGenerate?.(file, "mcqs"))}
        />
        <SheetRow
          icon="🧠" iconBg="rgba(255,215,0,0.10)"
          label="Guided study"
          sub={canExtract ? "AI breaks this material into sections with checks" : "No extractable text on this item"}
          badge="Recommended"
          badgeStyle={{ color: "#0A0D13", background: "linear-gradient(135deg, #F5A623, #E08E12)" }}
          disabled={!canExtract || generating}
          onClick={act(() => onGuidedStudy?.(file))}
        />
        <SheetRow
          icon="🎴" iconBg="rgba(61,214,140,0.10)"
          label="Flashcards"
          sub={flashcard ? `${cardCount || ""} cards ready`.trim() : "Generate a deck from this material"}
          disabled={generating}
          onClick={act(() => flashcard ? onOpen(flashcard.shareToken) : onGenerate?.(file, "mcqs"))}
        />
        <SheetRow
          icon="📝" iconBg="rgba(79,142,247,0.10)"
          label="Summary"
          sub={summary ? "Read the AI summary" : "Generate a summary PDF"}
          disabled={generating}
          onClick={act(() => summary ? onOpen(summary.shareToken) : onGenerate?.(file, "summary"))}
        />
        <SheetRow
          icon="🎓" iconBg="rgba(139,92,246,0.10)"
          label="Exam simulation"
          sub={mcq ? "Timed mock exam from these questions" : "Generate MCQs first"}
          disabled={!mcq || generating}
          onClick={act(() => onExamSimulation?.([mcq.id]))}
        />
        <SheetRow
          icon="📄" iconBg="rgba(255,255,255,0.06)"
          label="View material"
          sub="Open the original document"
          onClick={act(() => onOpen(file.shareToken))}
        />
        <SheetRow
          icon="🔴" iconBg="rgba(255,84,112,0.10)"
          label="Go live with friends"
          sub="Study this material together in real time"
          badge="Coming soon"
          badgeStyle={{ color: "#9199A8", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)" }}
          disabled
        />

        <div className="cs-sheet-divider" />

        <SheetRow
          icon="⤴" iconBg="rgba(255,255,255,0.06)"
          label="Share file"
          onClick={act(() => onShare(file.shareToken))}
        />
        {canDelete && (
          <SheetRow
            icon="🗑" iconBg="rgba(255,84,112,0.10)"
            label="Delete permanently"
            sub="Removes the file and its generated content"
            danger
            onClick={act(() => onDelete?.(file))}
          />
        )}
      </div>
    </div>
  );
}
