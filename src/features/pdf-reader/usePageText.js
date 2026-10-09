import { useCallback, useRef } from "react";

// Per-document page-text access with two caches:
//  - pageIndexRef: { raw, itemStart[] } per page — feeds search + span mapping
//  - textCacheRef: plain page text, LRU-capped at 50 pages
// Both live for the mounted reader; the pdf.js doc comes in as a ref so the
// hook never re-creates its callbacks when pages load.
export function usePageText(pdfDocRef) {
  const pageIndexRef = useRef({}); // { page: { raw, itemStart[] } }
  const textCacheRef = useRef({});

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
    // LRU eviction: cap at 50 cached pages
    const keys = Object.keys(textCacheRef.current);
    if (keys.length >= 50) {
      delete textCacheRef.current[keys[0]];
    }
    textCacheRef.current[n] = text;
    return text;
  }, []);

  return { getPageText, getPageIndexData };
}
