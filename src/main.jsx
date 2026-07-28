import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { ToastProvider } from "./components/Toast";
import "./styles.css";

// Stale SW chunk recovery — global error listeners + lazyWithRetry wrapper
import "./lib/lazyWithRetry.js";

// ── Disable pinch-zoom and double-tap-zoom app-wide ──────────────────────────
// Allows zoom inside elements with the .zoom-allowed class (e.g. document viewers)
function isInsideZoomAllowed(el) {
  return el && el.closest && el.closest(".zoom-allowed");
}

// iOS Safari fires 'gesturestart' for pinch gestures — sometimes ignores viewport meta
document.addEventListener("gesturestart", (e) => {
  if (isInsideZoomAllowed(e.target)) return;
  e.preventDefault();
}, { passive: false });

// Block multi-touch move (pinch) unless inside a zoom-allowed container
document.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1 && !isInsideZoomAllowed(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

// Block double-tap-to-zoom
let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => {
  if (isInsideZoomAllowed(e.target)) return;
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Block dblclick zoom as a fallback
document.addEventListener("dblclick", (e) => {
  if (isInsideZoomAllowed(e.target)) return;
  e.preventDefault();
}, { passive: false });

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
