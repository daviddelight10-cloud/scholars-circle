import { useCallback, useEffect, useRef } from "react";

/**
 * Hardware/browser back-button support for in-app overlays.
 *
 * On Android (browser or installed PWA) the back button pops browser history —
 * Escape listeners never fire. The app lives on a single route, so without a
 * pushed entry per overlay the first back press exits the whole app.
 *
 * Each registered overlay pushes a history entry on mount (or when `open`
 * flips true). A single popstate listener then closes the TOPMOST open
 * overlay instead of letting the browser leave the page.
 *
 * Bookkeeping:
 * - `stack` mirrors the pushed entries; last element is topmost.
 * - `pendingPops` counts history.back() calls WE issued; their popstate events
 *   are consumed here so they can't close a fresh overlay entry (matters for
 *   StrictMode remounts and UI closes that back() past a deeper overlay).
 * - Overlays whose close() only dismisses an INTERNAL sub-layer (a modal,
 *   quit-confirm, detail view) stay mounted; after the commit settles the
 *   entry re-pushes itself so the surface keeps a back-stop for every level.
 * - Unmount cleanup splices the entry. If it was topmost AND is still the
 *   current history entry (`history.state.scOvl === id`) a history.back()
 *   consumes it. The state check matters: if a router navigation pushed a
 *   real route above us, backing would silently undo that navigation — so we
 *   leave the stale entry instead (a later back to it is a benign no-op).
 */
const stack = [];
let seq = 0;
let listening = false;
// Timestamps of history.back() calls WE issued; their popstate events are
// consumed here so they can't close a fresh overlay entry (matters for
// StrictMode remounts and UI closes that back() past a deeper overlay).
// Entries expire — a programmatic back that never dispatches popstate
// (e.g. already at history bottom) must not eat the user's next real back.
const pendingPops = [];

function programmaticBack() {
  pendingPops.push(Date.now());
  window.history.back();
}

function onPopState(e) {
  const now = Date.now();
  while (pendingPops.length && now - pendingPops[0] > 2000) pendingPops.shift();
  if (pendingPops.length) { pendingPops.shift(); return; }
  const top = stack[stack.length - 1];
  if (!top) return;
  // The pop landed exactly on the top overlay's own entry — that happens when
  // a UI close issued history.back() past a deeper overlay. Nothing to close.
  if (e.state && e.state.scOvl === top.id) return;
  stack.pop();
  top.close();
  // close() may have only dismissed an internal sub-layer while the overlay
  // stays mounted. Re-push a fresh stop unless its cleanup ran meanwhile.
  setTimeout(() => {
    if (!top.alive) return;
    top.id = ++seq;
    stack.push(top);
    window.history.pushState({ scOvl: top.id }, "");
  }, 0);
}

function ensureListener() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", onPopState);
}

function isCurrentEntry(entry) {
  try { return window.history.state?.scOvl === entry.id; } catch { return false; }
}

/**
 * @param {() => void} onClose - invoked when the hardware/browser back button
 *   pops this overlay. Pass the surface's normal "dismiss" action; it may
 *   choose to close an internal layer instead of unmounting (the entry is
 *   renewed automatically while the component stays mounted).
 * @param {{ open?: boolean }} [opts] - set `open: false` to skip registration
 *   (e.g. surfaces mounted conditionally or modals that mount hidden).
 * @returns {{ close: () => void, isTop: () => boolean }}
 *   `close` is a UI-close that also consumes the pushed history entry — calling
 *   the raw onClose is equally safe (cleanup pops the entry on unmount), but
 *   `close` removes it immediately without waiting for unmount.
 */
export function useOverlayBackClose(onClose, { open = true } = {}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const entryRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    ensureListener();
    const entry = { id: ++seq, alive: true, close: () => onCloseRef.current?.() };
    entryRef.current = entry;
    stack.push(entry);
    window.history.pushState({ scOvl: entry.id }, "");
    return () => {
      entry.alive = false;
      const i = stack.lastIndexOf(entry);
      if (i < 0) return; // already removed by the popstate handler
      stack.splice(i, 1);
      if (i === stack.length && isCurrentEntry(entry)) programmaticBack();
    };
  }, [open]);

  const close = useCallback(() => {
    const entry = entryRef.current;
    const i = entry ? stack.lastIndexOf(entry) : -1;
    if (i >= 0) {
      stack.splice(i, 1);
      if (i === stack.length && isCurrentEntry(entry)) programmaticBack();
    }
    onCloseRef.current?.();
  }, []);

  const isTop = useCallback(() => stack[stack.length - 1] === entryRef.current, []);

  return { close, isTop };
}
