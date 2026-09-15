/**
 * Quota-safe localStorage writes.
 *
 * localStorage is capped ~5MB/origin. When it's full, setItem throws
 * QuotaExceededError and previously that error surfaced to users. This module
 * patches Storage.prototype.setItem once at app bootstrap:
 *
 *   1. On a quota error, evict known *re-fetchable* cache keys only
 *      (resource/subject/roadmap/arcade/challenge caches) and retry the write.
 *   2. If the write still fails (e.g. the user's own data blob alone exceeds
 *      the quota), the original error propagates — we never silently drop
 *      user-owned data.
 *
 * Keys are only ever evicted from an explicit allowlist of cache prefixes —
 * auth tokens, per-user state, notes, flashcards, chat history, and any
 * third-party SDK keys are never touched.
 */

// Re-fetchable caches only. Do NOT add user-owned data keys here.
const EVICTABLE_EXACT = new Set([
  "sc_resources_list",
  "sc_user_profile",
  "sc_subjects_cache",
  "sc_fsrs_stats",
  "sc_fsrs_analytics",
]);

const EVICTABLE_PREFIXES = [
  "challenge-",        // shared-challenge payload cache
  "sc_roadmap_",       // per-course roadmap cache
  "sc_arcade_short_",  // generated arcade-question cache
];

// Cache entries older than this are swept at boot, before quota is ever hit.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isQuotaError(err) {
  return (
    err &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" || // Firefox
      err.code === 22 ||                            // legacy Chrome
      err.code === 1014)                            // legacy Firefox
  );
}

function isEvictableKey(key) {
  return EVICTABLE_EXACT.has(key) || EVICTABLE_PREFIXES.some((p) => key.startsWith(p));
}

/** Remove evictable cache keys. Returns the keys removed. */
function evictCaches() {
  const removed = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && isEvictableKey(key)) {
        try {
          localStorage.removeItem(key);
          removed.push(key);
        } catch {}
      }
    }
  } catch {}
  return removed;
}

/** Drop expired entries among evictable cache keys (entries storing { ts }). */
function sweepExpiredCaches() {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key || !isEvictableKey(key)) continue;
    try {
      const ts = JSON.parse(localStorage.getItem(key) || "{}").ts;
      if (typeof ts === "number" && now - ts > CACHE_TTL_MS) localStorage.removeItem(key);
    } catch {}
  }
}

function installSafeStorage() {
  if (typeof window === "undefined" || typeof Storage === "undefined" || typeof localStorage === "undefined") return;
  if (Storage.prototype.__scQuotaSafe) return; // guard against HMR double-install
  Storage.prototype.__scQuotaSafe = true;

  const origSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function (key, value) {
    try {
      return origSetItem.call(this, key, value);
    } catch (err) {
      if (this !== localStorage || !isQuotaError(err)) throw err;

      const evicted = evictCaches();
      if (evicted.length) {
        console.warn(`[storage] Quota exceeded — evicted ${evicted.length} cached item(s):`, evicted);
      }
      // Retry once. If it still fails, let the original quota error propagate.
      return origSetItem.call(this, key, value);
    }
  };

  try {
    sweepExpiredCaches();
  } catch {}
}

installSafeStorage();
