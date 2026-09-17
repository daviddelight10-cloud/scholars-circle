import { memo } from "react";
import McIcon from "./McIcon.jsx";
import { getPdfReadingProgress } from "../../lib/researchUtils.js";

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function freshnessTag(resource) {
  const created = new Date(resource.createdAt || 0).getTime();
  if (!created) return null;
  const days = Math.floor((Date.now() - created) / 86400000);
  if (days <= 30) return { cls: "fresh", label: `Updated ${days <= 0 ? "today" : `${days}d ago`}` };
  if (days > 365) {
    const years = Math.floor(days / 365);
    return { cls: "stale", label: `${years} year${years > 1 ? "s" : ""} old` };
  }
  return null;
}

/**
 * Community PDF card — prototype "p-card".
 * Shows local reading progress (Open / Resume·% / Read again) and bookmark toggle.
 */
function PdfCard({
  resource,
  isBookmarked,
  bookmarkBusy,
  onOpen,
  onToggleBookmark,
  onOpenActions,
}) {
  const progress = getPdfReadingProgress(resource.fileUrl);
  const fresh = freshnessTag(resource);
  const saveCount = resource._count?.bookmarks ?? 0;
  const dateLabel = formatDate(resource.createdAt);

  let openBtn = { cls: "", icon: "filetext", label: "Open" };
  if (progress?.done) openBtn = { cls: "done", icon: "check", label: "Read again" };
  else if (progress) openBtn = { cls: "resume", icon: "play", label: `Resume · ${progress.pct}%` };

  return (
    <div className="mc-p-card" onClick={() => onOpen(resource)}>
      <div className="mc-p-top">
        <div className="mc-tile pdf">
          <McIcon name="filetext" />
        </div>
        <div className="mc-p-main">
          <h3>{resource.title}</h3>
          <div className="mc-p-subline">
            {resource.subject && <span className="mc-subj">{resource.subject}</span>}
            <span className="mc-src">{resource.university?.name || "Your School"}</span>
            {fresh && <span className={`mc-tag ${fresh.cls}`}>{fresh.label}</span>}
          </div>
        </div>
        {onOpenActions && (
          <button
            className="mc-c-more"
            title="More"
            onClick={(e) => { e.stopPropagation(); onOpenActions(resource); }}
          >
            <McIcon name="more" />
          </button>
        )}
      </div>

      <div className="mc-p-facts">
        <span className="mc-fmt">PDF</span>
        {resource.fileName && (
          <>
            <span className="mc-f">{resource.fileName}</span>
            <span className="mc-dot">·</span>
          </>
        )}
        {dateLabel && (
          <>
            <span className="mc-f">{dateLabel}</span>
            <span className="mc-dot">·</span>
          </>
        )}
        <span className="mc-stat"><McIcon name="eye" />{resource.viewCount || 0}</span>
        <span className="mc-spacer" />
        {resource.isPremium && <span className="mc-fmt">PREMIUM</span>}
      </div>

      {progress && (
        <div className="mc-p-progress">
          <div className="mc-p-bar">
            <div className={`mc-p-fill${progress.done ? " done" : ""}`} style={{ width: `${progress.pct}%` }} />
          </div>
          <span className={`mc-p-pct${progress.done ? " done" : ""}`}>
            {progress.done ? "✓ Completed" : `${progress.pct}% read`}
          </span>
        </div>
      )}

      <div className="mc-p-foot">
        <button className={`mc-open-btn ${openBtn.cls}`} onClick={(e) => { e.stopPropagation(); onOpen(resource); }}>
          <McIcon name={openBtn.icon} />{openBtn.label}
        </button>
        {onToggleBookmark && (
          <button
            className={`mc-bmk${isBookmarked ? " on" : ""}`}
            disabled={bookmarkBusy}
            title={isBookmarked ? "Remove bookmark" : "Bookmark"}
            onClick={(e) => { e.stopPropagation(); if (!bookmarkBusy) onToggleBookmark(resource); }}
          >
            <McIcon name="bookmark" filled={isBookmarked} />
            <span>{Math.max(saveCount, isBookmarked ? 1 : 0)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(PdfCard);
