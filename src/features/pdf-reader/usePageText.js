import { useCallback, useRef, useState } from "react";
import { ocrPage, setOcrStatusListener } from "./ocr.js";

// Per-document page-text access with two caches:
//  - pageIndexRef: { raw, itemStart[], words?, ocr? } per page — feeds search
//    and span mapping; `words` present when the page was OCR'd
//  - textCacheRef: plain page text, LRU-capped at 50 pages
// Scanned pages (no embedded text) are OCR'd on demand and merged into the
// same caches, so search, selection, and quiz generation work identically.
export function usePageText(pdfDocRef, docKey) {
  const pageIndexRef = useRef({}); // { page: { raw, itemStart[], words?, ocr? } }
  const textCacheRef = useRef({});
  const ocrInFlightRef = useRef(new Set());
  const [ocrStatus, setOcrStatus] = useState(null); // { page, message } | null

  // A page "needs OCR" when its embedded text is thin — scanned slide decks
  // return ~0 chars, watermarks/headers alone return a few.
  const NEEDS_OCR_LEN = 25;

  const getPageIndexData = useCallback(async (n) => {
    const cached = pageIndexRef.current[n];
    if (cached) return cached;
    if (!pdfDocRef.current) return null;
    try {
      const page = await pdfDocRef.current.getPage(n);
      const tc = await page.getTextContent();
      const itemStart = [];
      let raw = "";
      for (const it of tc.items) {
        if (!it.str) continue;
        itemStart.push(raw.length);
        raw += (raw ? " " : "") + it.str;
      }
      const entry = { raw, itemStart };
      pageIndexRef.current[n] = entry;
      return entry;
    } catch { return null; }
  }, []);

  // OCR a page and merge it into the index. Returns the entry (or null).
  const ocrPageIndex = useCallback(async (n) => {
    if (!pdfDocRef.current || !docKey) return null;
    if (ocrInFlightRef.current.has(n)) return pageIndexRef.current[n] || null;
    const existing = pageIndexRef.current[n];
    if (existing?.ocr || (existing && existing.raw.length >= NEEDS_OCR_LEN)) {
      return existing;
    }
    ocrInFlightRef.current.add(n);
    setOcrStatus({ page: n, message: `Scanning page ${n} for text…` });
    setOcrStatusListener((m) => setOcrStatus((s) => s && { ...s, message: m }));
    try {
      const entry = await ocrPage(pdfDocRef.current, docKey, n);
      if (entry) {
        pageIndexRef.current[n] = entry;
        if (entry.raw) textCacheRef.current[n] = entry.raw;
        return entry;
      }
      return null;
    } finally {
      ocrInFlightRef.current.delete(n);
      setOcrStatus((s) => (ocrInFlightRef.current.size === 0 ? null : s));
    }
  }, [docKey]);

  // OCR every page that lacks real text — used by "scan document" flows.
  const ocrDocument = useCallback(async (onProgress) => {
    if (!pdfDocRef.current || !docKey) return { scanned: 0, skipped: 0 };
    const total = pdfDocRef.current.numPages;
    let scanned = 0, skipped = 0;
    for (let n = 1; n <= total; n++) {
      const idx = await getPageIndexData(n); // fills cache, decides need
      if (idx && idx.raw.length >= NEEDS_OCR_LEN) { skipped++; continue; }
      if (idx?.ocr) { skipped++; continue; }
      const entry = await ocrPageIndex(n);
      if (entry && entry.raw.length) scanned++;
      else skipped++;
      onProgress?.({ page: n, total, scanned });
    }
    setOcrStatus(null);
    return { scanned, skipped };
  }, [docKey, getPageIndexData, ocrPageIndex]);

  const getPageText = useCallback(async (n) => {
    if (textCacheRef.current[n]) {
      // LRU: move accessed key to end by re-inserting
      const val = textCacheRef.current[n];
      delete textCacheRef.current[n];
      textCacheRef.current[n] = val;
      return val;
    }
    if (!pdfDocRef.current) return "";
    const page = await pdfDocRef.current.getPage(n);
    const tc = await page.getTextContent();
    const text = tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
    // Scanned page — pull OCR text if already indexed (don't trigger OCR here;
    // explicit scan flows call ocrPageIndex/ocrDocument).
    const idx = pageIndexRef.current[n];
    const finalText = text || idx?.raw || "";
    const keys = Object.keys(textCacheRef.current);
    if (keys.length >= 50) {
      delete textCacheRef.current[keys[0]];
    }
    textCacheRef.current[n] = finalText;
    return finalText;
  }, []);

  return { getPageText, getPageIndexData, ocrPageIndex, ocrDocument, ocrStatus, pageIndexRef };
}
