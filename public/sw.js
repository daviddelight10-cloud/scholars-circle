// Dynamic version - changes with each deployment
const CACHE_NAME = "scholars-circle-v-" + Date.now();
const STATIC_CACHE = "scholars-circle-static-v2";
const DYNAMIC_CACHE = "scholars-circle-dynamic-v2";

const staticAssets = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing new service worker");
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(staticAssets);
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Fetch - Network first for API, Cache first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Network-first strategy for API calls (to get fresh data)
  if (url.pathname.startsWith("/api/") || 
      url.pathname.startsWith("/auth/") || 
      url.pathname.startsWith("/ai/") ||
      url.pathname.startsWith("/user-data/") ||
      url.pathname.startsWith("/subjects/") ||
      url.pathname.startsWith("/questions/") ||
      url.hostname.includes("openrouter.ai") ||
      url.hostname.includes("generativelanguage.googleapis.com")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response for caching
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version, but fetch fresh version in background
        fetch(request).then((freshResponse) => {
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, freshResponse);
          });
        }).catch(() => {}); // Ignore fetch errors
        return cachedResponse;
      }
      
      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Activate - clean old caches but preserve dynamic cache (data)
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new service worker");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Only delete old static caches, preserve dynamic cache (user data)
          if (cacheName.startsWith("scholars-circle-static-") && cacheName !== STATIC_CACHE) {
            console.log("[SW] Deleting old static cache:", cacheName);
            return caches.delete(cacheName);
          }
          // Delete the old versioned caches
          if (cacheName === "scholars-circle-v1" || cacheName.startsWith("scholars-circle-v-")) {
            console.log("[SW] Deleting old versioned cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// Handle messages from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Skip waiting requested");
    self.skipWaiting();
  }
  
  // Handle version check
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
