import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

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

  // Handle controller change (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('New service worker controller activated');
    // Don't reload automatically - let the app handle it via UI
  });
} else {
  console.log('Service Worker not supported in this browser');
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
