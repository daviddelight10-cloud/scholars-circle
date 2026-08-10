import { useState } from "react";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";
import { formatRelativeDate } from "./constants";

const VARIANT_TYPES = [
  { key: "mcq", label: "MCQs", chipLabel: "MCQ", color: "#F5A623", genKind: "mcqs" },
  { key: "flashcard", label: "Flashcards", chipLabel: "Flashcards", color: "#3DD68C", genKind: "mcqs" },
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

const RELEVANCE_BADGES = {
  school: { label: "Your School", color: "#4F8EF7", bg: "rgba(79,142,247,0.10)", border: "rgba(79,142,247,0.30)" },
  level: { label: "Your Level", color: "#3DD68C", bg: "rgba(61,214,140,0.08)", border: "rgba(61,214,140,0.28)" },
};

/**
 * Shared MaterialCard — used by both My Space (FolderDetailView) and Community Materials tab.
 * Props:
 *  - file: resource object with variants { mcq, flashcard, summary }
 *  - showBookmark: boolean (default true) — hide star/bookmark in My Space
 *  - relevanceTier: 1|2|3|4 (optional) — shows "Your School" / "Your Level" badge
 *  - onOpen, onToggleBookmark, onShare, onGenerate, generatingId, genProgress, index
 */
export default function MaterialCard({
  file,
  isBookmarked,
  bookmarkBusy,
  onOpen,
  onToggleBookmark,
  onShare,
  onGenerate,
  generatingId,
  genProgress,
  index = 0,
  showBookmark = true,
  relevanceTier = null,
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const icon = getContentTypeIcon(file.contentType);
  const relDate = formatRelativeDate(file.createdAt);
  const fileName = file.fileName || file.title || "";
  const isGenerating = generatingId === file.id;
  const delay = `${Math.min(index * 40, 400)}ms`;
  const typeLabel = (file.contentType || "file").toUpperCase();

  const relevanceBadge = relevanceTier === 1 || relevanceTier === 2
    ? RELEVANCE_BADGES.school
    : relevanceTier === 3
    ? RELEVANCE_BADGES.level
    : null;

  return (
    <div
      className="stagger-in relative overflow-hidden rounded-2xl border border-hub-border bg-hub-surface p-4 pb-3.5"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: relevanceBadge?.color || "#F5A623",
        animationDelay: delay,
      }}
    >
      {/* Top row: icon + title + filename */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-base"
          style={{ background: "rgba(245,166,35,0.1)" }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-[15.5px] font-bold leading-tight text-hub-text" style={{ fontFamily: "'Syne', sans-serif" }}>
            {file.title}
          </h3>
          <p className="cs-filename mt-0.5 truncate text-[11.5px] text-hub-text-dim" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {fileName}
          </p>
        </div>
        {relevanceBadge && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold whitespace-nowrap"
            style={{ color: relevanceBadge.color, background: relevanceBadge.bg, border: `0.5px solid ${relevanceBadge.border}` }}
          >
            {relevanceBadge.label}
          </span>
        )}
      </div>

      {/* Meta line */}
      <div className="mb-3 flex items-center gap-2 text-[12px] text-hub-text-muted">
        <span
          className="rounded px-2 py-0.5 text-[11px] font-bold"
          style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {typeLabel}
        </span>
        {file.courseCode && (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold text-hub-text-dim" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {file.courseCode}
          </span>
        )}
        {file.subject && (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#5A6178", background: "rgba(90,97,120,0.08)" }}>
            {file.subject}
          </span>
        )}
        <span>👁 {formatViewCount(file.viewCount || 0)}</span>
        {relDate && <span>· {relDate}</span>}
      </div>

      {/* Variant chips */}
      <div className="cs-variants mb-3.5 flex flex-wrap gap-1.5">
        {VARIANT_TYPES.map((vt) => {
          const variant = file.variants?.[vt.key];
          if (variant) {
            const count = getVariantCount(variant);
            return (
              <button
                key={vt.key}
                onClick={() => onOpen(variant.shareToken)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-hub-text-muted transition-all active:scale-95"
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
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-hub-border bg-transparent px-2.5 py-1.5 text-[11.5px] font-semibold text-hub-text-dim transition-all hover:border-gold hover:text-gold active:scale-95 disabled:opacity-40"
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

      {/* Bottom row: Open + star + share */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOpen(file.shareToken)}
          className="flex-1 rounded-[10px] border border-hub-border bg-hub-bg py-2.5 text-center text-[13.5px] font-semibold text-hub-text transition-all active:scale-95"
        >
          Open
        </button>
        <button
          onClick={() => {
            if (!showBookmark && isBookmarked) {
              setConfirmRemove(true);
            } else {
              onToggleBookmark(file);
            }
          }}
          disabled={bookmarkBusy}
          title={isBookmarked ? "Remove from your space" : "Add to your space"}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-hub-border bg-transparent text-sm transition-all active:scale-90"
          style={isBookmarked ? { color: "#F5A623", borderColor: "rgba(245,166,35,0.4)", background: "rgba(245,166,35,0.08)" } : { color: "#5A6178" }}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
        <button
          onClick={() => onShare(file.shareToken)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-hub-border bg-transparent text-sm transition-all active:scale-90"
          style={{ color: "#5A6178" }}
        >
          ⤴
        </button>
      </div>

      {/* Confirmation popup for removing from My Space */}
      {confirmRemove && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-hub-surface/95 backdrop-blur-sm">
          <div className="mx-3 rounded-xl border border-hub-border bg-hub-bg p-4 text-center">
            <p className="mb-1 text-[13px] font-bold text-hub-text">Remove from your space?</p>
            <p className="mb-3 text-[11px] text-hub-text-dim">This will remove the material and its MCQs, flashcards, and summary.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRemove(false)}
                className="flex-1 rounded-lg border border-hub-border bg-hub-surface py-2 text-[12px] font-semibold text-hub-text transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmRemove(false);
                  onToggleBookmark(file);
                }}
                disabled={bookmarkBusy}
                className="flex-1 rounded-lg border border-coral-400 bg-coral-100 py-2 text-[12px] font-bold text-coral-400 transition-all active:scale-95"
              >
                {bookmarkBusy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
