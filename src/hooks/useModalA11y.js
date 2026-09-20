import { useEffect, useRef, useCallback } from "react";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

/**
 * Accessibility behaviors for a modal dialog:
 * - traps Tab/Shift+Tab focus inside the dialog
 * - closes on Escape
 * - restores focus to the previously focused element on close
 * - returns ARIA props to spread on the dialog element
 *
 * @param {object} opts
 * @param {boolean} opts.isOpen - whether the modal is currently shown
 * @param {() => void} opts.onClose - called when Escape is pressed
 * @param {string} [opts.labelledBy] - id of the dialog's heading element
 * @param {string} [opts.label] - fallback accessible name when no heading id exists
 * @returns {{ modalProps: object, focusRef: (el: HTMLElement|null) => void }}
 */
export function useModalA11y({ isOpen, onClose, labelledBy, label }) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  // Keep the latest onClose without making it an effect dependency — an inline
  // (unstable) callback must not restart the effect on every parent re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const setPanelRef = useCallback((el) => { panelRef.current = el; }, []);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement;

    // Move initial focus into the dialog (first focusable, else the panel itself).
    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector(FOCUSABLE);
      if (first) first.focus({ preventScroll: true });
      else if (panel.getAttribute("tabindex") !== null) panel.focus({ preventScroll: true });
    };
    // Panel may mount in the same commit; try immediately and again after paint.
    focusFirst();
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      // Restore focus to the element that opened the modal.
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const modalProps = {
    role: "dialog",
    "aria-modal": true,
    ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
    ...(label && !labelledBy ? { "aria-label": label } : {}),
  };

  return { modalProps, focusRef: setPanelRef };
}
