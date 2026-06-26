// Web Push client helpers.
// Handles permission, subscribing to the browser's push service, and syncing
// the subscription with our backend.

import { API_BASE } from "./constants.js";

/** True if the browser supports web push at all. */
export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current notification permission ("default" | "granted" | "denied" | "unsupported"). */
export function getPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Detect whether the app is running as an installed PWA / standalone window.
 * iOS Safari requires "Add to Home Screen" before push works at all.
 */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/** iOS Safari before v16.4 doesn't support web push. v16.4+ requires installed PWA. */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

let cachedVapidKey = null;
async function fetchVapidKey() {
  if (cachedVapidKey) return cachedVapidKey;
  const r = await fetch(`${API_BASE}/push/vapid-public-key`);
  if (!r.ok) throw new Error("Cannot reach push server");
  const data = await r.json();
  if (!data.enabled || !data.key) throw new Error("Push notifications not configured on the server");
  cachedVapidKey = data.key;
  return cachedVapidKey;
}

/** Request browser permission. Returns the new permission state. */
export async function requestPushPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

/**
 * Subscribe to push notifications and register the subscription with the backend.
 * @param {string} token - JWT for authentication.
 * @returns {Promise<{ok: boolean, reason?: string, endpoint?: string}>}
 */
export async function subscribeToPush(token) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (isIOS() && !isStandalone()) {
    return { ok: false, reason: "ios_needs_install" };
  }

  const perm = await requestPushPermission();
  if (perm !== "granted") return { ok: false, reason: perm };

  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, reason: "no_service_worker" };
  }

  const vapidKey = await fetchVapidKey();

  // Reuse existing subscription if present, otherwise create a new one.
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
  }

  // Send to server
  const json = sub.toJSON();
  const r = await fetch(`${API_BASE}/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent
    })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return { ok: false, reason: err.error || "server_error" };
  }

  localStorage.setItem("sc_push_subscribed", "1");
  return { ok: true, endpoint: json.endpoint };
}

/** Unsubscribe from push notifications and tell the server. */
export async function unsubscribeFromPush(token) {
  if (!isPushSupported()) return { ok: true };
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch(`${API_BASE}/push/unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ endpoint })
      }).catch(() => {});
    }
    localStorage.removeItem("sc_push_subscribed");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/** Trigger a daily-motivation-style push immediately to the calling user. */
export async function sendMotivationNow(token) {
  const r = await fetch(`${API_BASE}/push/motivate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Failed to send motivation");
  }
  return await r.json();
}

/** Send a test notification to the calling user. */
export async function sendTestPush(token) {
  const r = await fetch(`${API_BASE}/push/test`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Failed to send test notification");
  }
  return await r.json();
}

/** True if this browser/user has an active push subscription. */
export async function hasActiveSubscription() {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** Fetch + update notification preferences (per category). */
export async function getNotificationPreferences(token) {
  const r = await fetch(`${API_BASE}/push/preferences`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error("Failed to load preferences");
  return await r.json();
}

export async function saveNotificationPreferences(token, prefs) {
  const r = await fetch(`${API_BASE}/push/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(prefs)
  });
  if (!r.ok) throw new Error("Failed to save preferences");
  return await r.json();
}

/** List active devices with subscriptions for the current user. */
export async function listDevices(token) {
  const r = await fetch(`${API_BASE}/push/devices`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error("Failed to load devices");
  return await r.json();
}

export async function removeDevice(token, id) {
  const r = await fetch(`${API_BASE}/push/devices/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error("Failed to remove device");
  return await r.json();
}
