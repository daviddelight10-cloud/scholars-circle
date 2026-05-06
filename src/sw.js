/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";
import { BackgroundSyncPlugin } from "workbox-background-sync";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Precache build assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);

// App shell caching - cache core UI files
registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "style",
  new StaleWhileRevalidate({
    cacheName: "app-shell",
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  })
);

// Cache Google Fonts with stale-while-revalidate
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({
    cacheName: "google-fonts",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

// Cache Unsplash hero/cover images
registerRoute(
  ({ url }) => url.origin === "https://images.unsplash.com",
  new CacheFirst({
    cacheName: "unsplash-images",
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// Network-first for API calls with background sync
const bgSyncPlugin = new BackgroundSyncPlugin("api-queue", {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours
});

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/") || url.href.includes("railway.app"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
      bgSyncPlugin,
    ],
  })
);

// Offline fallback
setCatchHandler(async ({ event }) => {
  if (event.request.destination === "document") {
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>Offline - Scholar's Circle</title></head>
        <body style="text-align:center;padding:50px;font-family:sans-serif;">
          <h1>You're Offline</h1>
          <p>Please check your internet connection and try again.</p>
          <button onclick="location.reload()">Retry</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
  return Response.error();
});
