import { useEffect, useRef, useState } from "react";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";
import { formatRelativeDate } from "./constants";

const VARIANT_TYPES = [
  { key: "mcq", label: "MCQs", chipLabel: "MCQ", color: "#F5A623", genKind: "mcqs" },
  { key: "flashcard", label: "Flashcards", chipLabel: "Cards", color: "#3DD68C", genKind: "mcqs" },
  { key: "summary", label: "Summary", chipLabel: "Summary", color: "#4F8EF7", genKind: "summary" },
];

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

/**
 * Course-space file card — accent bar, icon, title, mono filename,
 * ⋯ menu (Share / Delete), variant chips, and a "tap to practice" footer
 * that opens the file's action sheet.
 */
export default function SpaceFileCard({
  file,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onShare,
  onDelete,
  canDelete,
  onOpen,
  onPractice,
  onGenerate,
  generatingId,
  genProgress,
  mcqProgress,
  index = 0,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, [menuOpen]);

  const icon = getContentTypeIcon(file.contentType);
  const relDate = formatRelativeDate(file.createdAt);
  const fileName = file.fileName || file.title || "";
  const isGenerating = generatingId === file.id;
  const delay = `${Math.min(index * 40, 400)}ms`;
  const typeLabel = (file.contentType || "file").toUpperCase();

  const mcqVariant = file.variants?.mcq;
  const progress = mcqVariant && mcqProgress ? mcqProgress[mcqVariant.id] : null;
  const coveredPct = progress && progress.total > 0
    ? Math.round((progress.bestScore / progress.total) * 100)
    : null;

  return (
    <div
      className="stagger-in relative rounded-2xl border border-hub-border bg-hub-surface p-4 pb-3"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: "#F5A623",
        animationDelay: delay,
      }}
    >
      {/* Top row: icon + title/filename + bookmark + ⋯ menu */}
      <div className="mb-2.5 flex items-start gap-2.5">
        <div
          className="mt-0.5 flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] text-lg"
          style={{ background: "rgba(245,166,35,0.1)" }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-[15px] font-bold leading-tight text-hub-text" style={{ fontFamily: "'Syne', sans-serif" }}>
            {file.title}
          </h3>
          <p className="cs-filename mt-0.5 text-[11px] text-hub-text-dim" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {fileName}
          </p>
        </div>

        <button
          onClick={() => onToggleBookmark(file)}
          disabled={bookmarkBusy}
          title={isBookmarked ? "Remove from your space" : "Save to your space"}
          aria-label={isBookmarked ? "Remove from your space" : "Save to your space"}
          className="shrink-0 rounded-lg p-1 text-[15px] transition-all active:scale-90"
          style={{
            color: isBookmarked ? "#F5A623" : "#5A6178",
            opacity: bookmarkBusy ? 0.5 : 1,
            background: "none",
            border: "none",
            cursor: bookmarkBusy ? "wait" : "pointer",
          }}
        >
          {isBookmarked ? "★" : "☆"}
        </button>

        <div className="cs-menu-wrap shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="File options"
            aria-expanded={menuOpen}
            className="rounded-lg p-1 text-hub-text-dim transition-all hover:text-hub-text active:scale-90"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="cs-menu" role="menu">
              <button
                role="menuitem"
                className="cs-menu-item"
                onClick={() => { setMenuOpen(false); onShare(file.shareToken); }}
              >
                ⤴ Share file
              </button>
              {canDelete && (
                <button
                  role="menuitem"
                  className="cs-menu-item cs-menu-danger"
                  onClick={() => { setMenuOpen(false); onDelete(file); }}
                >
                  🗑 Delete permanently
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Meta line */}
      <div className="mb-3 flex items-center gap-2 text-[11.5px] text-hub-text-muted">
        <span
          className="rounded px-2 py-0.5 text-[10.5px] font-bold"
          style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {typeLabel}
        </span>
        {file.subject && (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#5A6178", background: "rgba(90,97,120,0.08)" }}>
            {file.subject}
          </span>
        )}
        <span>👁 {formatViewCount(file.viewCount || 0)}</span>
        {relDate && <span>· {relDate}</span>}
      </div>

      {/* Variant chips */}
      <div className="cs-variants mb-3 flex gap-1.5">
        {VARIANT_TYPES.map((vt) => {
          const variant = file.variants?.[vt.key];
          if (variant) {
            const count = getVariantCount(variant);
            return (
              <button
                key={vt.key}
                onClick={() => onOpen(variant.shareToken)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11px] font-semibold text-hub-text-muted transition-all active:scale-95"
                title={`Open ${vt.label}`}
              >
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: vt.color }} />
                {vt.chipLabel}
                {count > 0 && <span>· {count}</span>}
              </button>
            );
          }
          if (file.standalone) return null;
          return (
            <button
              key={vt.key}
              onClick={() => onGenerate?.(file, vt.genKind)}
              disabled={isGenerating}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-hub-border bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-hub-text-dim transition-all hover:border-gold hover:text-gold active:scale-95 disabled:opacity-40"
              title={`Generate ${vt.label}`}
            >
              + {vt.chipLabel}
            </button>
          );
        })}
      </div>

      {/* Generating progress */}
      {isGenerating && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-gold-border bg-gold-dim px-3 py-2">
          <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <span className="truncate text-[10px] font-semibold text-gold">{genProgress || "Generating…"}</span>
        </div>
      )}

      {/* Practice footer → opens action sheet */}
      <button
        onClick={() => onPractice(file)}
        className="flex w-full items-center justify-between rounded-[11px] border border-hub-border bg-hub-bg px-3.5 py-2.5 text-left transition-all active:scale-[0.98]"
        style={{ cursor: "pointer" }}
      >
        <span className="text-[12.5px] font-semibold text-hub-text" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {coveredPct != null ? `${coveredPct}% covered · Tap to practice` : "Tap to practice"}
        </span>
        <span className="text-[13px] text-gold">▸</span>
      </button>
    </div>
  );
}
