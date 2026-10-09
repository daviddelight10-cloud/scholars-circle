// Shared pdf.js loader — bundled through Vite (no CDN dependency, works
// offline once the PWA has cached assets). The legacy build is used because
// the modern build needs very recent JS APIs that many Android WebViews and
// in-app browsers lack, which leaves pages blank on mobile.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Some call sites still reach for the legacy global — keep it populated.
if (typeof window !== "undefined") window.pdfjsLib = pdfjsLib;

export function loadPdfJs() {
  return Promise.resolve(pdfjsLib);
}

export default pdfjsLib;
