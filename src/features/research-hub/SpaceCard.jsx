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
 * My Space row — Gizmo-style: colored left edge, name, "N items", star pin.
 * Long-press/right-click (own spaces only) opens the delete confirmation.
 */
function SpaceCard({
  folder,
  onClick,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onRequestDelete,
}) {
  const itemCount = folder._count?.resources ?? 0;
  const pill = VISIBILITY_PILL[folder.visibility] || VISIBILITY_PILL.private;
  const tint = tileTintStyle(folder.id || folder.name);

  const longPress = useLongPress(() => onRequestDelete?.(folder));

  return (
    <div
      className="mc-row"
      onClick={onClick}
      {...(onRequestDelete ? {
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
      {onToggleBookmark && (
        <button
          className={`mc-star${isBookmarked ? " starred" : ""}`}
          disabled={bookmarkBusy}
          title={isBookmarked ? "Unpin" : "Pin to top"}
          onClick={(e) => {
            e.stopPropagation();
            if (!bookmarkBusy) onToggleBookmark(folder);
          }}
        >
          <McIcon name="star" filled={isBookmarked} />
        </button>
      )}
    </div>
  );
}

export default memo(SpaceCard);
