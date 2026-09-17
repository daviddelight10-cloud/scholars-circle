import CircleSheet from "./CircleSheet.jsx";
import McIcon from "./McIcon.jsx";

/**
 * Card overflow (⋮) action sheet — prototype "action-sheet".
 * target: { name, kind } | null
 */
export default function CardActionSheet({ open, onClose, target, onShare, onCopyLink, onReport }) {
  if (!target) return null;
  return (
    <CircleSheet open={open} onClose={onClose} title={target.name} kind={target.kind}>
      <button className="mc-act-row" onClick={onShare}>
        <McIcon name="share" />
        <div>
          <div className="mc-r-t">Share</div>
          <div className="mc-r-s">Send to classmates or groups</div>
        </div>
      </button>
      <button className="mc-act-row" onClick={onCopyLink}>
        <McIcon name="link" />
        <div>
          <div className="mc-r-t">Copy link</div>
          <div className="mc-r-s">Opens in the app for anyone on Circle</div>
        </div>
      </button>
      <button className="mc-act-row danger" onClick={onReport}>
        <McIcon name="flag" />
        <div>
          <div className="mc-r-t">Report</div>
          <div className="mc-r-s">Outdated, wrong, or doesn't match the course</div>
        </div>
      </button>
    </CircleSheet>
  );
}
