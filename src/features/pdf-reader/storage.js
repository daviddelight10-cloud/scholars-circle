import { API_BASE } from "../../lib/constants";

// ── Storage helpers ───────────────────────────────────────────────────────────
// docKeyFromUrl lives in src/lib/researchUtils.js (shared with community PDF cards)

export function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function saveStored(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Reader-state merge helpers (server ↔ local hydration) ────────────────
// Union-merge page-keyed arrays. Dedupe by id when present, else by content.
export function mergePageArrays(serverMap, localMap) {
  const out = {};
  for (const [pg, arr] of Object.entries(serverMap || {})) {
    if (Array.isArray(arr) && arr.length) out[pg] = [...arr];
  }
  for (const [pg, arr] of Object.entries(localMap || {})) {
    const s = out[pg] || [];
    const seen = new Set(s.map((x) => (x && x.id) || JSON.stringify(x)));
    const extra = (Array.isArray(arr) ? arr : []).filter((x) => !seen.has((x && x.id) || JSON.stringify(x)));
    const merged = [...s, ...extra];
    if (merged.length) out[pg] = merged;
  }
  return out;
}

export function mergeBookmarkList(serverList, localList) {
  const norm = (b) => (typeof b === "number" ? { page: b, name: "" } : b);
  const byPage = new Map();
  for (const b of (localList || []).map(norm).filter((b) => b && b.page > 0)) byPage.set(b.page, b);
  for (const b of (serverList || []).map(norm).filter((b) => b && b.page > 0)) {
    const cur = byPage.get(b.page);
    // Prefer the entry that has a name; otherwise keep local (most recent)
    if (!cur || (!cur.name && b.name)) byPage.set(b.page, b);
  }
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

export function mergeReaderStats(server, local) {
  const pageTimes = { ...(server?.pageTimes || {}) };
  for (const [pg, sec] of Object.entries(local?.pageTimes || {})) {
    pageTimes[pg] = Math.max(pageTimes[pg] || 0, sec);
  }
  const pagesRead = [...new Set([...(server?.pagesRead || []), ...(local?.pagesRead || [])])].sort((a, b) => a - b);
  return {
    pageTimes,
    pagesRead,
    sessionStart: Date.now(),
    totalSeconds: Math.max(server?.totalSeconds || 0, local?.totalSeconds || 0),
  };
}

// Route through backend proxy to avoid CORS issues with R2
export function getProxiedUrl(fileUrl) {
  if (!fileUrl) return null;
  return `${API_BASE}/api/resources/proxy-pdf?url=${encodeURIComponent(fileUrl)}`;
}

// Fetch PDF via proxy with auth headers (pdf.js can't send custom headers)
export async function fetchProxiedPdf(fileUrl) {
  const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  const res = await fetch(getProxiedUrl(fileUrl), {
    headers: authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {},
  });
  if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

// ── Offline copies (IndexedDB) ───────────────────────────────────────────
// Stores the raw PDF bytes keyed by docKey so the reader can open the
// document with no network at all (PWA shell + bundled pdf.js are already
// precached by the service worker).
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sc_pdf_offline", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetFile(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve) => {
      const req = db.transaction("files", "readonly").objectStore("files").get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function idbPutFile(key, blob) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelFile(key) {
  try {
    const db = await idbOpen();
    await new Promise((resolve) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}
