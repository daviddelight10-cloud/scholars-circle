import { memo } from "react";
import McIcon from "./McIcon.jsx";
import { useLongPress } from "./useLongPress.js";

const VISIBILITY_PILL = {
  private: { icon: "lock", label: "Private", cls: "private" },
  link: { icon: "link", label: "Link", cls: "link" },
  shared: { icon: "link", label: "Shared", cls: "link" },
};

/**
 * My Space card — prototype "space-card".
 * Grid + list variants; star toggles bookmark; long-press/right-click
 * (own spaces only) opens the delete confirmation.
 */
function SpaceCard({
  folder,
  onClick,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onRequestDelete,
  listView = false,
}) {
  const itemCount = folder._count?.resources ?? 0;
  const pill = VISIBILITY_PILL[folder.visibility] || VISIBILITY_PILL.private;
  const isPdfSpace = /^(pdf|docs?|papers)/i.test(folder.name || "");

  const longPress = useLongPress(() => onRequestDelete?.(folder));

  return (
    <div
      className={`mc-space-card${listView ? "" : ""}`}
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
      {onToggleBookmark && (
        <button
          className={`mc-star${isBookmarked ? " starred" : ""}`}
          disabled={bookmarkBusy}
          title={isBookmarked ? "Remove from saved" : "Save to pinned"}
          onClick={(e) => {
            e.stopPropagation();
            if (!bookmarkBusy) onToggleBookmark(folder);
          }}
        >
          <McIcon name="star" filled={isBookmarked} />
        </button>
      )}

      <div className={`mc-tile${isPdfSpace ? " pdf" : ""}`}>
        <McIcon name={isPdfSpace ? "filetext" : folder.visibility === "private" ? "folder" : "books"} />
      </div>

      <div className="mc-card-body">
        <h3>{folder.name}</h3>
        <div className="mc-meta">
          <span><b>{itemCount}</b> item{itemCount === 1 ? "" : "s"}</span>
          <span className={`mc-pill ${pill.cls}`}>
            <McIcon name={pill.icon} />
            {pill.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(SpaceCard);
