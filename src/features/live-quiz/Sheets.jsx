// Small themed bottom sheets used inside the live room — replace the native
// window.confirm dialogs (which look broken in dark/PWA) and hold host tools.

export function ConfirmSheet({ title, body, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  return (
    <div className="lq-sheet-backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="lq-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="lq-sheet-grab" />
        <p className="lq-sheet-title">{title}</p>
        {body && <p className="lq-sheet-body">{body}</p>}
        <button className={`lq-btn-primary${danger ? " danger" : ""}`} onClick={onConfirm}>{confirmLabel}</button>
        <button className="lq-btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// Host-only tools, kept out of the player footer.
export function HostSheet({ presenterMode, micOpen, canPresent, onPresenter, onMic, onEnd, onClose }) {
  return (
    <div className="lq-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Host tools">
      <div className="lq-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="lq-sheet-grab" />
        <p className="lq-sheet-title">Host tools</p>
        {canPresent && (
          <button className="lq-host-row" onClick={onPresenter} aria-pressed={presenterMode}>
            <span className="lq-host-row-t"><b>Present mode</b><i>Watch answers live without playing</i></span>
            <span className={`lq-switch${presenterMode ? " on" : ""}`} />
          </button>
        )}
        <button className="lq-host-row" onClick={onMic} aria-pressed={micOpen}>
          <span className="lq-host-row-t"><b>Open floor</b><i>Keep mics on during questions</i></span>
          <span className={`lq-switch${micOpen ? " on" : ""}`} />
        </button>
        <button className="lq-host-row danger" onClick={onEnd}>
          <span className="lq-host-row-t"><b>End session for everyone</b></span>
        </button>
        <button className="lq-btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
