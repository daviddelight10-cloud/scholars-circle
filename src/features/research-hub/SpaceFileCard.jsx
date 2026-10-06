import { useEffect, useRef, useState } from "react";
import { formatViewCount, mcqRingPct } from "../../lib/researchUtils";
import { formatRelativeDate } from "./constants";
import { IC } from "./spaceRowIcons.jsx";
import { ProgressRing } from "./spaceRowUi.jsx";


/**
 * Shared ⋯ dropdown for file rows — Bookmark / Share / Rename / Delete.
 * Used by SpaceFileCard (Files tab) and TopicSheet doc rows.
 */
export function FileMenu({
  file,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onShare,
  onDelete,
  canDelete,
  onRename,
  kebabClass = "sp-row-kebab",
  menuClass = "sp-row-menu",
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

  const item = (icon, label, fn, danger, disabled) => (
    <button
      role="menuitem"
      className={`cs-menu-item${danger ? " cs-menu-danger" : ""}`}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); fn?.(file); }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="cs-menu-wrap sp-row-kebab-wrap" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        className={kebabClass}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {IC.dots}
      </button>
      {menuOpen && (
        <div className={`cs-menu ${menuClass}`} role="menu">
          {item(IC.bookmark, isBookmarked ? "Remove bookmark" : "Bookmark",
            onToggleBookmark, false, bookmarkBusy)}
          {item(IC.share, "Share", onShare)}
          {item(IC.pencil, "Rename", onRename)}
          {canDelete && item(IC.trash, "Delete", onDelete, true)}
        </div>
      )}
    </div>
  );
}

/**
 * Compact file row — prototype-matched.
 * Ring (coverage) | title + bookmark flag | meta row | ⋯ menu.
 * Card click opens the practice sheet; kebab opens a dropdown menu.
 */
export default function SpaceFileCard({
  file,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onShare,
  onDelete,
  canDelete,
  onRename,
  onPractice,
  mcqProgress,
  index = 0,
}) {
  const mcqVariant = file.variants?.mcq;
  const prog = mcqVariant && mcqProgress ? mcqProgress[mcqVariant.id] : null;
  const pct = mcqRingPct(prog);

  // Which study tools exist for this file — shown as mini icons in the meta row
  const tools = [
    file.variants?.mcq ? IC.pencil : null,
    file.variants?.summary ? IC.notes : null,
  ].filter(Boolean);

  const label = pct >= 100 ? "fully mastered" : pct > 0 ? `${pct}% learned` : "not started";

  return (
    <div
      className="sp-row sp-fade-up"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
      role="button"
      tabIndex={0}
      aria-label={`Practice ${file.title}, ${label}`}
      onClick={() => onPractice?.(file)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onPractice?.(file);
        }
      }}
    >
      <ProgressRing pct={pct} />

      <div className="sp-row-body">
        <div className="sp-row-title-row">
          <p className="sp-row-title">{file.title}</p>
          {isBookmarked && <span className="sp-row-flag" aria-label="Bookmarked">{IC.bookmark}</span>}
        </div>
        <div className="sp-row-meta">
          {(file.subject || file.courseCode) && (
            <>
              <span className="sub">{file.subject || file.courseCode}</span><span>·</span>
            </>
          )}
          <span>{formatRelativeDate(file.createdAt)}</span>
          <span>·</span>
          {IC.eye}
          <span>{formatViewCount(file.viewCount || 0)}</span>
          <span className="grow" />
          {tools.length > 0 && <span className="sp-row-tools">{tools.map((t, i) => <span key={i}>{t}</span>)}</span>}
        </div>
      </div>

      <FileMenu
        file={file}
        isBookmarked={isBookmarked}
        bookmarkBusy={bookmarkBusy}
        onToggleBookmark={onToggleBookmark}
        onShare={onShare}
        onDelete={onDelete}
        canDelete={canDelete}
        onRename={onRename}
      />
    </div>
  );
}
