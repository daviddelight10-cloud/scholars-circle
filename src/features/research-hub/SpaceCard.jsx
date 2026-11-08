import { memo } from "react";
import McIcon from "./McIcon.jsx";
import { useLongPress } from "./useLongPress.js";
import { tileTintStyle } from "../../lib/researchUtils.js";

const VISIBILITY_PILL = {
  private: { icon: "lock", label: "Private", cls: "private" },
  link: { icon: "link", label: "Link", cls: "link" },
  shared: { icon: "link", label: "Shared", cls: "link" },
};

/**
 * My Space row — Gizmo-style: colored left edge, name, "N items", due badge,
 * star pin and a visible ⋮ menu. Long-press/right-click opens the same menu.
 */
function SpaceCard({
  folder,
  onClick,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onOpenMenu,
  dueCount = 0,
  archived = false,
}) {
  // Count files only — bookmarked items saved into the space don't count
  const itemCount = folder._count?.resources ?? 0;
  const pill = VISIBILITY_PILL[folder.visibility] || VISIBILITY_PILL.private;
  const tint = tileTintStyle(folder.id || folder.name);

  const longPress = useLongPress(() => onOpenMenu?.(folder));

  return (
    <div
      className={`mc-row${archived ? " archived" : ""}`}
      onClick={onClick}
      {...(onOpenMenu ? {
        onPointerDown: longPress.onPointerDown,
        onPointerUp: longPress.onPointerUp,
        onPointerLeave: longPress.onPointerLeave,
        onPointerCancel: longPress.onPointerCancel,
        onPointerMove: longPress.onPointerMove,
        onContextMenu: longPress.onContextMenu,
        onClickCapture: longPress.onClickCapture,
      } : {})}
    >
      <span className="mc-row-edge" style={{ background: tint.color }} />
      <div className="mc-row-body">
        <h3>{folder.name}</h3>
        <span className="mc-row-sub">
          <b>{itemCount}</b> item{itemCount === 1 ? "" : "s"}
          {folder.visibility !== "private" && (
            <> · <span className={`mc-pill ${pill.cls}`}><McIcon name={pill.icon} />{pill.label}</span></>
          )}
        </span>
      </div>
      {dueCount > 0 && !archived && (
        <span className="mc-due" title={`${dueCount} due for review`}>{dueCount} due</span>
      )}
      {onToggleBookmark && !archived && (
        <button
          className={`mc-star${isBookmarked ? " starred" : ""}`}
          disabled={bookmarkBusy}
          title={isBookmarked ? "Unpin" : "Pin to top"}
          aria-label={isBookmarked ? "Unpin space" : "Pin space to top"}
          onClick={(e) => {
            e.stopPropagation();
            if (!bookmarkBusy) onToggleBookmark(folder);
          }}
        >
          <McIcon name="star" filled={isBookmarked} />
        </button>
      )}
      {onOpenMenu && (
        <button
          className="mc-more"
          aria-label={`More options for ${folder.name}`}
          aria-haspopup="dialog"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(folder); }}
        >
          <McIcon name="more" />
        </button>
      )}
    </div>
  );
}

export default memo(SpaceCard);
