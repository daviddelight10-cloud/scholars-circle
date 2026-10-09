// ── OCR for scanned/image-only PDF pages ─────────────────────────────────────
// tesseract.js is imported lazily — it is only needed when a page carries no
// embedded text. The worker script, wasm core and English traineddata are
// served from /ocr/ (public dir, copied from node_modules) so OCR works
// offline after first use — service worker caches /ocr/ CacheFirst. Results
// are cached in IndexedDB per document so a scanned page is OCR'd only once.

const OCR_LANG = "eng";
const OCR_BASE = "/ocr";

// Rendered width used for the OCR source image — enough for sharp characters
// without paying for a 4× raster of a full slide.
const OCR_RENDER_SCALE = 2.0;

let workerPromise = null;
let onStatusCb = null;

export function setOcrStatusListener(cb) {
  onStatusCb = cb;
}
const emitStatus = (msg) => { try { onStatusCb?.(msg); } catch {} };

// Flatten whatever tesseract.js v6 returns into a word list. Newer builds put
// words directly on data; older nested them under blocks→paragraphs→lines.
function extractWords(data) {
  if (Array.isArray(data?.words) && data.words.length) {
    return data.words.map((w) => ({ text: w.text, bbox: w.bbox }));
  }
  const words = [];
  for (const b of data?.blocks || []) {
    for (const p of b.paragraphs || []) {
      for (const l of p.lines || []) {
        for (const w of l.words || []) words.push({ text: w.text, bbox: w.bbox });
      }
    }
  }
  return words;
}

async function getWorker() {
  if (!workerPromise) {
    emitStatus("Loading OCR engine…");
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(OCR_LANG, 1, {
        workerPath: `${OCR_BASE}/worker.min.js`,
        corePath: OCR_BASE,           // dir — worker appends the right core file
        langPath: `${OCR_BASE}/lang`,
        gzip: true,
        logger: (m) => {
          if (m?.status === "recognizing text" && typeof m.progress === "number") {
            emitStatus(`OCR ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      return worker;
    })();
    // If worker creation fails (offline, CDN blocked), drop the promise so the
    // next attempt retries instead of poisoning the cache.
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

export function ocrAvailable() {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

// ── IndexedDB result cache ───────────────────────────────────────────────────
function ocrDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sc_pdf_ocr", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("pages");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedOcr(docKey, page) {
  try {
    const db = await ocrDb();
    return await new Promise((resolve) => {
      const req = db.transaction("pages", "readonly").objectStore("pages").get(`${docKey}:${page}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function cacheOcr(docKey, page, entry) {
  try {
    const db = await ocrDb();
    await new Promise((resolve) => {
      const tx = db.transaction("pages", "readwrite");
      tx.objectStore("pages").put(entry, `${docKey}:${page}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// ── Page → OCR index entry ───────────────────────────────────────────────────
// Returns { raw, itemStart, words, ocr:true } | null. `words` carry bbox in
// normalized [0..1] page coordinates so the text-layer renderer can place an
// invisible selectable span over each word — search, selection and highlight
// all work on scans as if the text were real.
export async function ocrPage(pdfDoc, docKey, pageNum) {
  if (!ocrAvailable()) return null;

  const cached = await getCachedOcr(docKey, pageNum);
  if (cached && Array.isArray(cached.itemStart)) return cached;

  emitStatus(`OCR page ${pageNum}…`);
  const worker = await getWorker();

  const page = await pdfDoc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  await page.render({ canvasContext: ctx, viewport }).promise;
  const { data } = await worker.recognize(canvas);
  canvas.width = canvas.height = 0;

  const words = extractWords(data)
    .map((w) => {
      const b = w.bbox || {};
      return {
        t: w.text,
        x0: b.x0 / viewport.width, y0: b.y0 / viewport.height,
        x1: b.x1 / viewport.width, y1: b.y1 / viewport.height,
      };
    })
    .filter((w) => w.t && w.t.trim());

  if (!words.length) return { raw: "", itemStart: [], words: [], ocr: true };

  const itemStart = [];
  let raw = "";
  for (const w of words) {
    itemStart.push(raw.length);
    raw += (raw ? " " : "") + w.t;
  }

  const entry = { raw, itemStart, words, ocr: true };
  cacheOcr(docKey, pageNum, entry);
  return entry;
}
