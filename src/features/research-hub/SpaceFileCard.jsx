import { useEffect, useRef, useState } from "react";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";
import { formatRelativeDate } from "./constants";

const RING_R = 10;
const RING_CIRC = 2 * Math.PI * RING_R; // ~62.8

/**
 * Course-space file card matching the prototype:
 * accent bar, icon box, serif title, mono filename, ⋯ menu (Share/Delete),
 * bookmark button, tags row (type · subject · views · date), and a
 * progress-ring footer that opens the practice sheet. The whole card
 * body also opens the sheet.
 */
export default function SpaceFileCard({
  file,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onShare,
  onDelete,
  canDelete,
  onPractice,
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
  const typeLabel = ({
    mcq: "MCQ",
    flashcard_deck: "CARDS",
    tutorial_question: "TQ",
    image: "IMG",
  })[file.contentType] || (file.contentType || "file").toUpperCase();
  const delay = `${Math.min(index * 50, 400)}ms`;

  // Study-material badges — which generated variants live inside this doc.
  const variantBadges = [
    file.variants?.mcq && ["✎", "MCQs"],
    file.variants?.flashcard && ["🎴", "Flashcards"],
    file.variants?.summary && ["📝", "Summary"],
  ].filter(Boolean);

  // Coverage ring — driven by MCQ practice progress on this file's variant.
  const mcqVariant = file.variants?.mcq;
  const prog = mcqVariant && mcqProgress ? mcqProgress[mcqVariant.id] : null;
  const coveredPct = prog
    ? (prog.learnedPct ?? (prog.total > 0 ? Math.min(100, Math.round(((prog.mastered || 0) / prog.total) * 100)) : null))
    : null;
  const dashOffset = coveredPct != null ? RING_CIRC * (1 - coveredPct / 100) : RING_CIRC;

  const onCardClick = (e) => {
    // Let menu / bookmark / dropdown interactions handle themselves.
    if (e.target.closest(".sp-action") || e.target.closest(".cs-menu")) return;
    onPractice(file);
  };

  return (
    <div
      className="sp-card sp-fade-up"
      style={{ animationDelay: delay }}
      onClick={onCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPractice(file); } }}
      aria-label={`Open practice options for ${file.title}`}
    >
      <div className="sp-accent-bar" />

      {/* Header: icon + title + menu + bookmark */}
      <div className="sp-card-head">
        <div className="sp-icon-box">{icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="sp-card-title">{file.title}</p>
          <p className="sp-card-sub">{fileName}</p>
        </div>

        <div className="cs-menu-wrap" ref={menuRef}>
          <button
            className="sp-action"
            aria-label="More options"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ pointerEvents: "none" }}>
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="cs-menu" role="menu">
              <button
                role="menuitem"
                className="cs-menu-item"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShare(file.shareToken); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" />
                  <path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" />
                </svg>
                <span>Share</span>
              </button>
              {canDelete && (
                <button
                  role="menuitem"
                  className="cs-menu-item cs-menu-danger"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(file); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1 -2 2H7a2 2 0 0 1 -2 -2V6" /><path d="M8 6V4a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>

        <button
          className={`sp-action${isBookmarked ? " active" : ""}`}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
          disabled={bookmarkBusy}
          onClick={(e) => { e.stopPropagation(); onToggleBookmark(file); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }}>
            <path d="M9 4h6a2 2 0 0 1 2 2v14l-5 -3l-5 3v-14a2 2 0 0 1 2 -2" />
          </svg>
        </button>
      </div>

      {/* Tags row */}
      <div className="sp-tags">
        <span className="sp-tag sp-tag-gold">{typeLabel}</span>
        {file.subject && <span className="sp-tag sp-tag-gold">{file.subject}</span>}
        {file.courseCode && <span className="sp-tag sp-tag-gold">{file.courseCode}</span>}
        {variantBadges.map(([icon, label]) => (
          <span key={label} className="sp-tag sp-tag-variant" title={label}>{icon}</span>
        ))}
        <span className="sp-meta">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s4 -7 10 -7 10 7 10 7 -4 7 -10 7 -10 -7 -10 -7z" /><circle cx="12" cy="12" r="3" />
          </svg>
          {formatViewCount(file.viewCount || 0)}
        </span>
        {relDate && <span className="sp-meta">{relDate}</span>}
      </div>

      {/* Progress footer — clicking anywhere on the card opens the sheet */}
      <div className="sp-progress-box">
        <div className="sp-progress-inner">
          <div style={{ width: 26, height: 26, position: "relative", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 26 26" style={{ position: "absolute", top: 0, left: 0 }}>
              <circle cx="13" cy="13" r={RING_R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle cx="13" cy="13" r={RING_R} fill="none" stroke="#F5A623" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={RING_CIRC.toFixed(1)} strokeDashoffset={dashOffset.toFixed(1)} transform="rotate(-90 13 13)" />
            </svg>
          </div>
          <p className="sp-progress-text">
            {coveredPct != null ? `${coveredPct}% covered · Tap to practice` : "Tap to practice"}
          </p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#646E84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 15l6 -6l6 6" />
        </svg>
      </div>
    </div>
  );
}
