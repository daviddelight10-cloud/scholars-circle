/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

self.skipWaiting();
cleanupOutdatedCaches();

// Precache build assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);

// Navigation requests: always go to network first, never serve stale HTML.
// Stale HTML references old chunk filenames that 404 on new deployments.
// Only fall back to offline.html when the network is truly unavailable.
registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    try {
      const resp = await fetch(event.request, { cache: "no-store" });
      if (resp && resp.ok) {
        // Cache the fresh HTML for offline use
        const cache = await caches.open("pages-cache");
        cache.put(event.request, resp.clone());
        return resp;
      }
      throw new Error("Navigation response not ok");
    } catch (err) {
      // Network failed — try cached HTML, then offline page
      const cache = await caches.open("pages-cache");
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const offline = await cache.match("/offline.html");
      if (offline) return offline;
      return Response.error();
    }
  }
);

// Cache Unsplash hero/cover images
registerRoute(
  ({ url }) => url.origin === "https://images.unsplash.com",
  new CacheFirst({
    cacheName: "unsplash-images",
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// Subjects (include questions) — StaleWhileRevalidate: instant from cache, refresh in background
// Must be registered BEFORE the generic API route below
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    (url.port === "4000" || url.pathname.startsWith("/api/")) &&
    url.pathname.includes("/subjects"),
  new StaleWhileRevalidate({
    cacheName: "subjects-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  })
);

// Network-first for all other API calls (port 4000 in dev, /api in prod)
registerRoute(
  ({ url }) => url.port === "4000" || url.pathname.startsWith("/api/"),
  new NetworkFirst({ cacheName: "api-cache", networkTimeoutSeconds: 6 })
);

// ============ PUSH NOTIFICATION SUPPORT ============

// Handle push events (notifications from server).
// CRITICAL: this handler MUST always call showNotification, otherwise browsers
// will eventually unsubscribe the device (Chrome enforces "user-visible push only").
self.addEventListener('push', (event) => {
  console.log('[sw] push event received');

  // Robust payload parsing — the body may be JSON, text, or empty.
  let data = {};
  try {
    if (event.data) {
      try { data = event.data.json(); }
      catch { data = { title: "Scholar's Circle", body: event.data.text() }; }
    }
  } catch (err) {
    console.warn('[sw] push payload parse failed:', err);
    data = {};
  }

  const title = data.title || "Scholar's Circle";
  const body = data.body || 'You have a new notification';

  const notificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [200, 100, 200],
    requireInteraction: !!data.requireInteraction,
    tag: data.tag || 'default',
    renotify: !!data.tag, // re-alert when same tag updates
    data: data.data || {},
  };

  // Actions are optional and unsupported on some platforms (e.g. iOS Safari).
  if (Array.isArray(data.actions) && data.actions.length) {
    notificationOptions.actions = data.actions;
  }

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions).catch((err) => {
      console.error('[sw] showNotification failed, retrying with minimal payload:', err);
      // Fall back to absolute minimum so the user still sees SOMETHING and the
      // browser doesn't auto-unsubscribe due to a missing user-visible push.
      return self.registration.showNotification(title, { body });
    })
  );
});

// Also surface push subscription changes (some browsers rotate endpoints).
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[sw] pushsubscriptionchange — clients should re-subscribe on next visit');
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            // Post message to navigate to specific section if provided
            if (data?.tab) {
              client.postMessage({ type: 'NAVIGATE', tab: data.tab });
            }
            return;
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          const url = data?.tab ? `/?tab=${data.tab}` : '/';
          return clients.openWindow(url);
        }
      })
  );
});

// Handle notification close (track dismissal)
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});

// ============ PERIODIC BACKGROUND SYNC FOR REMINDERS ============

// Register for periodic sync when activated
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Try to register periodic background sync
      if ('periodicSync' in self.registration) {
        try {
          const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
          if (status.state === 'granted') {
            await self.registration.periodicSync.register('study-reminders', {
              minInterval: 60 * 60 * 1000 // Check every hour
            });
            console.log('Periodic background sync registered');
          }
        } catch (err) {
          console.log('Periodic sync not supported:', err);
        }
      }
    })()
  );
});

// Handle periodic sync events
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'study-reminders') {
    event.waitUntil(checkAndSendReminders());
  }
});

// Check for pending reminders and send notifications
async function checkAndSendReminders() {
  try {
    // Get stored reminder data from IndexedDB or cache
    const cache = await caches.open('reminder-data');
    const response = await cache.match('/pending-reminders');
    
    if (response) {
      const reminders = await response.json();
      const now = Date.now();
      
      for (const reminder of reminders) {
        if (reminder.time <= now && !reminder.sent) {
          await self.registration.showNotification(reminder.title, {
            body: reminder.body,
            icon: '/icon-192.png',
            badge: '/icon-96.png',
            tag: reminder.id,
            data: reminder.data
          });
          
          // Mark as sent
          reminder.sent = true;
        }
      }
      
      // Update cache
      await cache.put('/pending-reminders', new Response(JSON.stringify(reminders)));
    }
  } catch (err) {
    console.error('Error checking reminders:', err);
  }
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data.type === 'SCHEDULE_REMINDER') {
    scheduleReminder(event.data.reminder);
  } else if (event.data.type === 'CANCEL_REMINDER') {
    cancelReminder(event.data.id);
  } else if (event.data.type === 'CLEAR_CACHES') {
    // App detected stale chunks — purge everything and skip waiting
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    self.skipWaiting();
  }
});

async function scheduleReminder(reminder) {
  try {
    const cache = await caches.open('reminder-data');
    let reminders = [];
    
    const existing = await cache.match('/pending-reminders');
    if (existing) {
      reminders = await existing.json();
    }
    
    reminders.push(reminder);
    await cache.put('/pending-reminders', new Response(JSON.stringify(reminders)));
  } catch (err) {
    console.error('Error scheduling reminder:', err);
  }
}

async function cancelReminder(id) {
  try {
    const cache = await caches.open('reminder-data');
    const existing = await cache.match('/pending-reminders');
    
    if (existing) {
      const reminders = await existing.json();
      const filtered = reminders.filter(r => r.id !== id);
      await cache.put('/pending-reminders', new Response(JSON.stringify(filtered)));
    }
  } catch (err) {
    console.error('Error canceling reminder:', err);
  }
}

console.log('Scholar\'s Circle Service Worker loaded with notification support');
