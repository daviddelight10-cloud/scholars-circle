import { useState, useEffect } from "react";

export default function BookmarkSpacePicker({
  show,
  onClose,
  resource,
  folders,
  onConfirm,
  onCreateFolder,
}) {
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [busy, setBusy] = useState(false);

  const ownFolders = folders?.own || [];
  const sharedFolders = folders?.shared || [];
  const allFolders = [...ownFolders, ...sharedFolders];

  useEffect(() => {
    if (show && allFolders.length > 0 && !selectedFolderId) {
      setSelectedFolderId(allFolders[0].id);
    }
    if (!show) {
      setSelectedFolderId("");
    }
  }, [show, allFolders.length]);

  if (!show || !resource) return null;

  const handleConfirm = async () => {
    if (!selectedFolderId) return;
    setBusy(true);
    try {
      await onConfirm(resource, selectedFolderId);
    } finally {
      setBusy(false);
      setSelectedFolderId("");
    }
  };

  const handleClose = () => {
    if (busy) return;
    setSelectedFolderId("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-3" onClick={handleClose}>
      <div
        className="w-full max-w-[540px] max-h-[88vh] overflow-y-auto rounded-2xl border border-gold-border bg-hub-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-xl font-bold text-gold">Add to space</h2>
          <button onClick={handleClose} className="rounded-lg px-2 py-1 text-base text-hub-text-muted transition-colors hover:text-hub-text">✕</button>
        </div>

        <div className="mb-3 rounded-lg border border-hub-border bg-hub-bg p-3">
          <div className="mb-1 text-[11px] text-hub-text-dim">Saving</div>
          <div className="text-sm font-bold text-hub-text">{resource.title}</div>
          {resource.subject && (
            <div className="mt-0.5 text-[10px] text-hub-text-muted">{resource.subject}</div>
          )}
        </div>

        <div className="mb-3">
          <div className="mb-2 block text-[11px] font-semibold text-hub-text-muted">
            Choose a space <span className="text-gold">*</span>
          </div>

          {allFolders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hub-border p-4 text-center text-[11px] text-hub-text-dim">
              No spaces yet. Create one to save this material.
            </div>
          ) : (
            allFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`mb-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                  selectedFolderId === folder.id
                    ? "border-gold-border bg-gold-dim"
                    : "border-hub-border bg-hub-bg"
                }`}
              >
                <div className="text-2xl">{folder.visibility === "private" ? "📁" : "📂"}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-hub-text">{folder.name}</div>
                  {folder.courseCode && (
                    <div className="text-[10px] text-hub-text-muted">{folder.courseCode}</div>
                  )}
                </div>
                {selectedFolderId === folder.id && <div className="shrink-0 text-lg text-gold">✓</div>}
              </div>
            ))
          )}

          <div
            onClick={() => onCreateFolder()}
            className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-hub-border p-3 transition-all hover:border-gold"
          >
            <div className="text-2xl text-hub-text-muted">+</div>
            <div className="text-[11px] font-semibold text-hub-text-muted">Create new space</div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg border border-hub-border px-5 py-3 text-sm font-semibold text-hub-text-muted transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || !selectedFolderId}
            className={`rounded-lg px-6 py-3 text-sm font-bold transition-all active:scale-95 ${
              busy || !selectedFolderId
                ? "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-60"
                : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
            }`}
          >
            {busy ? "Saving…" : "Add to space ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
