import CircleSheet from "./CircleSheet.jsx";
import McIcon from "./McIcon.jsx";

/**
 * Recycle bin sheet — prototype "trash-sheet".
 * items: from GET /api/folders/recycle-bin ({ id, name, daysElapsed, daysLeft, _count }).
 */
export default function RecycleBinSheet({ open, onClose, items = [], onRestore, onPurge, busyId }) {
  return (
    <CircleSheet open={open} onClose={onClose}>
      <h2 className="mc-sheet-title" style={{ margin: "6px 0 4px" }}>Recycle bin</h2>
      <p className="mc-sheet-hint">
        Deleted spaces stay here for <b>30 days</b>, then are removed forever.<br />
        Long-press (or right-click) a space in My Space and choose "Move to Recycle Bin".
      </p>

      {items.length === 0 ? (
        <div className="mc-tr-empty">
          Bin is empty.<br />
          <span style={{ fontSize: 11.5 }}>
            Long-press or right-click a space, then choose "Move to Recycle Bin".
          </span>
        </div>
      ) : (
        items.map((t) => (
          <div key={t.id} className="mc-tr-row">
            <div className="mc-tile"><McIcon name="folder" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mc-tr-name">{t.name}</div>
              <div className="mc-tr-sub">
                {t.daysElapsed === 0 ? "Deleted today" : `Deleted ${t.daysElapsed} day${t.daysElapsed > 1 ? "s" : ""} ago`}
                {" · "}
                {t.daysLeft} day{t.daysLeft === 1 ? "" : "s"} left
              </div>
            </div>
            <button
              className="mc-tr-restore"
              disabled={busyId === t.id}
              onClick={() => onRestore?.(t)}
              style={{ opacity: busyId === t.id ? 0.5 : 1 }}
            >
              Restore
            </button>
            <button
              className="mc-tr-del"
              disabled={busyId === t.id}
              title="Delete forever"
              onClick={() => onPurge?.(t)}
            >
              <McIcon name="trash" />
            </button>
          </div>
        ))
      )}
    </CircleSheet>
  );
}
