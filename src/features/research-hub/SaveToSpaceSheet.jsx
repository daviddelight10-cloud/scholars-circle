import { useEffect, useState } from "react";
import BookmarkSpacePicker from "./BookmarkSpacePicker.jsx";
import { listFolders, createFolder } from "../../lib/foldersApi.js";
import { bookmarkResource } from "../../lib/resourcesApi.js";
import "../../research-hub.css";

/**
 * "Save to space" sheet for surfaces outside My Space (shared-link landing
 * pages, feed cards). Wraps BookmarkSpacePicker: lazily loads the user's
 * spaces, requires a pick — no loose saves — and supports inline space
 * creation without leaving the page.
 *
 *   open      — show/hide
 *   resource  — { id, title, subject? } to bookmark
 *   onClose   — dismissed (or finished — onSaved fires first)
 *   onSaved   — (result, folderId, folderName) after a successful save
 *   notify    — (message) error/success channel (toast)
 */
export default function SaveToSpaceSheet({ open, resource, onClose, onSaved, notify }) {
  const [folders, setFolders] = useState(null); // null = not loaded yet
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createErr, setCreateErr] = useState("");

  useEffect(() => {
    if (!open) return;
    if (folders === null && !loadFailed) {
      listFolders()
        .then(setFolders)
        .catch(() => setLoadFailed(true));
    }
  }, [open, folders, loadFailed]);

  const nameOf = (folderId) =>
    [...(folders?.own || []), ...(folders?.shared || [])].find((f) => f.id === folderId)?.name;

  const finish = async (folderId, folderName) => {
    const result = await bookmarkResource(resource.id, folderId);
    onSaved?.(result, folderId, folderName);
    onClose?.();
  };

  const handleConfirm = async (_res, folderId) => {
    try {
      await finish(folderId, nameOf(folderId));
    } catch (e) {
      notify?.(e.message || "Couldn't save — try again");
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setCreateErr("");
    try {
      const folder = await createFolder({ name });
      setFolders((f) => ({ ...(f || {}), own: [folder, ...(f?.own || [])] }));
      try {
        await finish(folder.id, folder.name);
      } catch (e) {
        // Space was created — drop back to the picker so the user can retry
        // saving into it.
        notify?.(e.message || "Space created — save failed, try again");
        setCreating(false);
      }
    } catch (e) {
      setCreateErr(e.message || "Couldn't create space");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  // Inline "new space" step — creates a private space and saves straight in,
  // so a user with no spaces never dead-ends on the shared page.
  if (creating) {
    return (
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 p-3"
        onClick={() => !busy && setCreating(false)}
      >
        <div
          className="w-full max-w-[440px] rounded-2xl border border-gold-border bg-hub-surface p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-1 mt-0 text-xl font-bold text-gold">New space</h2>
          <p className="mb-4 mt-0 text-[12px] text-hub-text-dim">
            {resource?.title ? `"${resource.title}" will be saved into it.` : "The material will be saved into it."}
          </p>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder='e.g. "Anatomy — Year 2"'
            className="w-full rounded-lg border border-hub-border bg-hub-bg px-3 py-2.5 text-sm text-hub-text placeholder:text-hub-text-dim focus:border-gold-border focus:outline-none"
          />
          {createErr && <div className="mt-2 text-[12px] text-red-400">{createErr}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setCreating(false)}
              disabled={busy}
              className="rounded-lg border border-hub-border px-5 py-3 text-sm font-semibold text-hub-text-muted transition-all active:scale-95"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={busy || !newName.trim()}
              className={`rounded-lg px-6 py-3 text-sm font-bold transition-all active:scale-95 ${
                busy || !newName.trim()
                  ? "cursor-not-allowed border border-hub-border bg-hub-surface text-hub-text-dim opacity-60"
                  : "bg-gradient-to-br from-[#b8860b] to-gold text-[#0a0a0a]"
              }`}
            >
              {busy ? "Creating…" : "Create & save ✓"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (folders === null) {
    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-3"
        onClick={loadFailed ? undefined : onClose}
      >
        <div
          className="w-full max-w-[440px] rounded-2xl border border-gold-border bg-hub-surface p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {loadFailed ? (
            <>
              <div className="mb-3 text-sm text-hub-text">Couldn't load your spaces</div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-hub-border px-4 py-2 text-sm font-semibold text-hub-text-muted"
                >
                  Close
                </button>
                <button
                  onClick={() => setLoadFailed(false)}
                  className="rounded-lg bg-gradient-to-br from-[#b8860b] to-gold px-4 py-2 text-sm font-bold text-[#0a0a0a]"
                >
                  Retry
                </button>
              </div>
            </>
          ) : (
            <div className="py-4 text-sm text-hub-text-muted">Loading your spaces…</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <BookmarkSpacePicker
      show={open}
      resource={resource}
      folders={folders}
      onClose={onClose}
      onConfirm={handleConfirm}
      onCreateFolder={() => { setNewName(""); setCreateErr(""); setCreating(true); }}
    />
  );
}
