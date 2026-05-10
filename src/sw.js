/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

self.skipWaiting();
cleanupOutdatedCaches();

// Precache build assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache Unsplash hero/cover images
registerRoute(
  ({ url }) => url.origin === "https://images.unsplash.com",
  new CacheFirst({
    cacheName: "unsplash-images",
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// Network-first for API calls (port 4000 in dev, /api in prod)
registerRoute(
  ({ url }) => url.port === "4000" || url.pathname.startsWith("/api/"),
  new NetworkFirst({ cacheName: "api-cache", networkTimeoutSeconds: 4 })
);

// ============ PUSH NOTIFICATION SUPPORT ============

// Handle push events (notifications from server)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const notificationOptions = {
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Scholar\'s Circle', {
      body: data.body || 'You have a new notification',
      ...notificationOptions
    })
  );
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
      await cache.put('/pending-reminders', new JSON.stringify(reminders));
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
