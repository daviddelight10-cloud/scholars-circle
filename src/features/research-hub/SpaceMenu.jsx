import { useEffect, useState } from "react";
import CircleSheet from "./CircleSheet.jsx";
import McIcon from "./McIcon.jsx";

/**
 * ⋮ menu for a space (folder). One place for every folder action.
 * Own folders: Review, Pin, Rename, Share, Archive, Recycle bin.
 * Saved folders: Review, Pin, Share, Archive, Remove from My Space.
 */
export default function SpaceMenu({
  folder, isOwn, isPinned, isArchived, dueCount = 0,
  onClose, onReview, onTogglePin, onRename, onShare, onToggleArchive, onDelete, onRemoveSaved,
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setRenaming(false);
    setName(folder?.name || "");
  }, [folder?.id]);

  const row = (icon, title, sub, fn, cls = "") => (
    <button className={`mc-act-row${cls ? ` ${cls}` : ""}`} onClick={fn}>
      <McIcon name={icon} />
      <div>
        <div className="mc-r-t">{title}</div>
        {sub && <div className="mc-r-s">{sub}</div>}
      </div>
    </button>
  );

  const submitRename = () => {
    const next = name.trim();
    if (!next || next === folder.name) { setRenaming(false); return; }
    onRename?.(folder, next);
  };

  return (
    <CircleSheet open={!!folder} onClose={onClose} title={folder?.name} kind="Space">
      {folder && (renaming ? (
        <>
          <input
            className="mc-rename-input"
            value={name}
            maxLength={80}
            autoFocus
            aria-label="Space name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitRename(); }}
          />
          {row("check", "Save name", null, submitRename)}
          {row("x", "Cancel", null, () => setRenaming(false))}
        </>
      ) : (
        <>
          {!isArchived && row("play", dueCount > 0 ? `Review now · ${dueCount} due` : "Review now",
            dueCount > 0 ? "Study this space's due cards" : "Nothing due right now", () => onReview?.(folder))}
          {!isArchived && isOwn && row("star", isPinned ? "Unpin from top" : "Pin to top", null, () => onTogglePin?.(folder))}
          {isOwn && row("pen", "Rename", null, () => setRenaming(true))}
          {row("share", "Share", null, () => onShare?.(folder))}
          {row("inbox", isArchived ? "Unarchive" : "Archive",
            isArchived ? "Bring it back to Home and Daily Review" : "Hide from Home and Daily Review. Nothing is deleted.",
            () => onToggleArchive?.(folder))}
          {isOwn
            ? row("trash", "Move to Recycle bin", "Restorable for 30 days", () => onDelete?.(folder), "danger")
            : row("trash", "Remove from My Space", "Unsave this folder", () => onRemoveSaved?.(folder), "danger")}
        </>
      ))}
    </CircleSheet>
  );
}
