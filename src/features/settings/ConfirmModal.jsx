/**
 * Destructive-action confirmation modal matching the prototype design.
 */
export default function ConfirmModal({ open, title, text, confirmLabel = "Confirm", onClose, onConfirm }) {
  if (!open) return null;
  return (
    <div className="st-modal" onClick={onClose} role="alertdialog" aria-label={title}>
      <div className="st-mbox" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="st-mrow">
          <button onClick={onClose}>Cancel</button>
          <button className="st-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
