import { useRef, useCallback, useEffect } from "react";

/**
 * Long-press (550ms) + right-click detection for space cards, matching the
 * prototype behavior: hold ~250ms adds a "holding" visual state, 550ms fires
 * the callback. A click right after a fired long-press is suppressed.
 *
 * Returns props to spread onto the card element:
 *   onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, onPointerMove,
 *   onContextMenu, onClick (capture-phase suppressor)
 * plus `isHolding` (bind to class) and `longPressBind` helper.
 */
export function useLongPress(onLongPress, { holdMs = 550, glowMs = 250 } = {}) {
  const timer = useRef(null);
  const glowTimer = useRef(null);
  const fired = useRef(false);
  const cb = useRef(onLongPress);

  useEffect(() => {
    cb.current = onLongPress;
  }, [onLongPress]);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    clearTimeout(glowTimer.current);
    timer.current = null;
    glowTimer.current = null;
  }, []);

  const onPointerDown = useCallback((e) => {
    // Ignore presses on interactive children (buttons)
    if (e.target.closest("button, a, input, textarea, select")) return;
    fired.current = false;
    glowTimer.current = setTimeout(() => {
      const el = e.currentTarget;
      if (el && el.classList) el.classList.add("holding");
    }, glowMs);
    timer.current = setTimeout(() => {
      fired.current = true;
      const el = e.currentTarget;
      if (el && el.classList) el.classList.remove("holding");
      cb.current?.(e);
    }, holdMs);
  }, [glowMs, holdMs]);

  const cancelHolding = useCallback((e) => {
    clear();
    const el = e.currentTarget;
    if (el && el.classList) el.classList.remove("holding");
  }, [clear]);

  const onContextMenu = useCallback((e) => {
    e.preventDefault();
    clear();
    cb.current?.(e);
  }, [clear]);

  const onClickCapture = useCallback((e) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerUp: cancelHolding,
    onPointerLeave: cancelHolding,
    onPointerCancel: cancelHolding,
    onPointerMove: (e) => {
      // Cancel on significant movement (scrolling) — pointermove fires often,
      // only clear when a press is active.
      if (timer.current || glowTimer.current) {
        // Allow small jitter: cancel if pointer moved out of the element bounds
        const r = e.currentTarget.getBoundingClientRect();
        const { clientX, clientY } = e;
        if (clientX < r.left - 8 || clientX > r.right + 8 || clientY < r.top - 8 || clientY > r.bottom + 8) {
          cancelHolding(e);
        }
      }
    },
    onContextMenu,
    onClickCapture,
  };
}
