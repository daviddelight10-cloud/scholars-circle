import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { ToastProvider } from "./components/Toast";
import "./styles.css";

// ── Stale service worker / chunk recovery ────────────────────────────────────
// When a new deployment ships, old cached index.html references chunk filenames
// that no longer exist. React lazy() throws "Failed to fetch dynamically
// imported module". We catch that and force a hard reload with cache-busting.

let _chunkReloadAttempted = false;

window.addEventListener('error', (event) => {
  const msg = event?.message || "";
  if (msg.includes("Failed to fetch dynamically imported module") && !_chunkReloadAttempted) {
    _chunkReloadAttempted = true;
    console.warn("[chunk-recovery] Stale chunk detected — reloading with cache-bust…");
    // Clear SW caches so the reload fetches fresh assets
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
    // Reload with a cache-busting query param
    const url = new URL(window.location.href);
    url.searchParams.set('_rc', Date.now().toString());
    window.location.replace(url.toString());
  }
});

// Also catch unhandled promise rejections from dynamic imports
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || String(event?.reason || "");
  if (msg.includes("Failed to fetch dynamically imported module") && !_chunkReloadAttempted) {
    _chunkReloadAttempted = true;
    console.warn("[chunk-recovery] Stale chunk detected (promise) — reloading…");
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_rc', Date.now().toString());
    window.location.replace(url.toString());
  }
});

// ── lazyWithRetry: wraps React.lazy with a retry on failure ──────────────────
const lazyWithRetry = (dynamicImport) => {
  return lazy(() =>
    dynamicImport().catch((err) => {
      // If this is a stale chunk error, try once more with cache-busting
      if (err?.message?.includes("Failed to fetch dynamically imported module") && !_chunkReloadAttempted) {
        _chunkReloadAttempted = true;
        if ('caches' in window) {
          caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
        }
        const url = new URL(window.location.href);
        url.searchParams.set('_rc', Date.now().toString());
        window.location.replace(url.toString());
        // Return a hanging promise so React doesn't render an error before reload
        return new Promise(() => {});
      }
      throw err;
    })
  );
};

// Expose for other modules that use lazy()
export { lazyWithRetry };

// Register service worker for PWA with update handling
if ('serviceWorker' in navigator) {
  let registrationPromise = null;

  window.addEventListener('load', () => {
    registrationPromise = navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // Always check for updates from network
    })
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);

        // Check for updates every 5 minutes
        setInterval(() => {
          registration.update().catch(err => {
            console.log('SW update check failed:', err);
          });
        }, 5 * 60 * 1000);

        // Check for updates when page becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });

        return registration;
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });

  // Handle controller change (new SW activated) — reload to get new assets
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
} else {
  console.log('Service Worker not supported in this browser');
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
