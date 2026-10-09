// Shared pdf.js loader — bundled through Vite (no CDN dependency, works
// offline once the PWA has cached assets). pdfjs-dist 6.x ships pure ESM.
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Some call sites still reach for the legacy global — keep it populated.
if (typeof window !== "undefined") window.pdfjsLib = pdfjsLib;

export function loadPdfJs() {
  return Promise.resolve(pdfjsLib);
}

export default pdfjsLib;
