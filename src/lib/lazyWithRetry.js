let _chunkReloadAttempted = false;

function clearCachesAndReload() {
  if (_chunkReloadAttempted) return;
  _chunkReloadAttempted = true;
  console.warn("[chunk-recovery] Stale chunk detected — reloading with cache-bust…");
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_rc", Date.now().toString());
  window.location.replace(url.toString());
}

// Global listeners for failed dynamic imports (stale SW cache)
window.addEventListener("error", (event) => {
  const msg = event?.message || "";
  if (msg.includes("Failed to fetch dynamically imported module")) {
    clearCachesAndReload();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event?.reason?.message || String(event?.reason || "");
  if (msg.includes("Failed to fetch dynamically imported module")) {
    clearCachesAndReload();
  }
});

import { lazy } from "react";

export function lazyWithRetry(dynamicImport) {
  return lazy(() =>
    dynamicImport().catch((err) => {
      if (err?.message?.includes("Failed to fetch dynamically imported module")) {
        clearCachesAndReload();
        return new Promise(() => {});
      }
      throw err;
    })
  );
}
