let _chunkReloadAttempted = false;
let _reloadDebounce = null;

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

// Narrow the reload to genuine stale SW cache failures on JS/CSS chunks.
// Transient network glitches during scroll (worker fetch timeouts, aborts)
// should not reload the whole app — they retry on their own.
function isChunkNetworkError(event) {
  const msg = event?.message || "";
  if (!msg.includes("Failed to fetch dynamically imported module")) return false;
  const target = event?.target;
  // Only reload on failed script/link resource loads, not arbitrary errors
  if (!target || (target.tagName !== "SCRIPT" && target.tagName !== "LINK")) return false;
  const src = target.src || target.href;
  // Only JS/CSS chunks (.js, .mjs, .css) — ignore other resources
  if (!src || !/\.(js|mjs|css)(\?|$)/.test(src)) return false;
  return true;
}

// Global listeners for failed dynamic imports (stale SW cache)
window.addEventListener("error", (event) => {
  if (isChunkNetworkError(event)) {
    // Debounce to prevent rapid scroll from triggering multiple reloads
    if (_reloadDebounce) clearTimeout(_reloadDebounce);
    _reloadDebounce = setTimeout(() => {
      clearCachesAndReload();
    }, 1000);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event?.reason?.message || String(event?.reason || "");
  if (msg.includes("Failed to fetch dynamically imported module")) {
    // Unhandledrejection is less tied to a specific resource — only reload
    // if the stack suggests a dynamic import failure.
    const stack = event?.reason?.stack || "";
    if (stack.includes("import(") || stack.includes("dynamic import")) {
      if (_reloadDebounce) clearTimeout(_reloadDebounce);
      _reloadDebounce = setTimeout(() => {
        clearCachesAndReload();
      }, 1000);
    }
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
