import { useEffect, useRef, useState } from "react";
import { formatViewCount } from "../../lib/researchUtils";
import { formatRelativeDate } from "./constants";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

const IC = {
  file: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M9 13h6" /><path d="M9 17h6" />
    </svg>
  ),
  check: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M5 12l5 5l10 -10" />
    </svg>
  ),
  eye: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="2" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
    </svg>
  ),
  pencil: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />
    </svg>
  ),
  cards: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <rect x="3" y="8" width="12" height="13" rx="2" /><path d="M8 4h9a2 2 0 0 1 2 2v11" />
    </svg>
  ),
  notes: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6" /><path d="M9 11h6" /><path d="M9 15h4" />
    </svg>
  ),
  dots: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
  ),
  bookmark: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" />
    </svg>
  ),
  share: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1 -1v-7" /><path d="M16 6l-4 -4l-4 4" /><path d="M12 2v14" />
    </svg>
  ),
  trash: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  ),
};

function ProgressRing({ pct }) {
  const done = pct >= 100;
  const has = pct > 0;
  const C = 2 * Math.PI * 18;
  const dash = (Math.min(pct, 100) / 100) * C;
  return (
    <div className={`sp-ring${done ? " done" : has ? "" : " empty"}`} aria-hidden="true">
      <svg className="sp-ring-svg" viewBox="0 0 44 44">
        <circle className="track" cx="22" cy="22" r="18" fill="none" strokeWidth="3" />
        {has && (
          <circle
            className="bar" cx="22" cy="22" r="18" fill="none" strokeWidth="3"
            strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`}
          />
        )}
      </svg>
      {done ? IC.check : has ? <span className="sp-ring-pct">{pct}</span> : IC.file}
    </div>
  );
}

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
  const pct = prog && prog.total > 0 ? Math.min(100, Math.round((prog.bestScore / prog.total) * 100)) : 0;

  // Which study tools exist for this file — shown as mini icons in the meta row
  const tools = [
    file.variants?.mcq ? IC.pencil : null,
    file.variants?.summary ? IC.notes : null,
  ].filter(Boolean);

  const label = pct >= 100 ? "fully covered" : pct > 0 ? `${pct}% covered` : "not started";

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
