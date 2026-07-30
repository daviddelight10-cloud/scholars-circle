// FCM Push client helpers.
// Handles permission, getting an FCM token via Firebase Messaging, and syncing
// the token with our backend.

import { API_BASE } from "./constants.js";
import { getFirebaseMessaging, isMessagingSupported } from "./firebase.js";
import { getToken, deleteToken } from "firebase/messaging";

/** True if the browser supports FCM web push at all. */
export async function isPushSupported() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  return await isMessagingSupported();
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

let cachedFcmConfig = null;
async function fetchFcmConfig() {
  if (cachedFcmConfig) return cachedFcmConfig;
  const r = await fetch(`${API_BASE}/push/fcm-config`);
  if (!r.ok) throw new Error("Cannot reach push server");
  const data = await r.json();
  if (!data.enabled || !data.vapidKey) throw new Error("Push notifications not configured on the server");
  cachedFcmConfig = data;
  return cachedFcmConfig;
}

/** Request browser permission. Returns the new permission state. */
export async function requestPushPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

/**
 * Subscribe to push notifications via FCM and register the token with the backend.
 * @param {string} token - JWT for authentication.
 * @returns {Promise<{ok: boolean, reason?: string, fcmToken?: string}>}
 */
export async function subscribeToPush(token) {
  const supported = await isPushSupported();
  if (!supported) return { ok: false, reason: "unsupported" };
  if (isIOS() && !isStandalone()) {
    return { ok: false, reason: "ios_needs_install" };
  }

  const perm = await requestPushPermission();
  if (perm !== "granted") return { ok: false, reason: perm };

  const messaging = await getFirebaseMessaging();
  if (!messaging) return { ok: false, reason: "messaging_unsupported" };

  const config = await fetchFcmConfig();

  let fcmToken;
  try {
    fcmToken = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
  } catch (err) {
    console.error("[push] getToken failed:", err);
    return { ok: false, reason: "token_error" };
  }

  if (!fcmToken) return { ok: false, reason: "no_token" };

  // Send to server
  const r = await fetch(`${API_BASE}/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      fcmToken,
      platform: "web",
      userAgent: navigator.userAgent
    })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return { ok: false, reason: err.error || "server_error" };
  }

  localStorage.setItem("sc_push_subscribed", "1");
  return { ok: true, fcmToken };
}

/** Unsubscribe from push notifications and tell the server. */
export async function unsubscribeFromPush(token) {
  const supported = await isPushSupported();
  if (!supported) return { ok: true };
  try {
    const messaging = await getFirebaseMessaging();
    if (messaging) {
      const currentToken = await getToken(messaging, {
        vapidKey: cachedFcmConfig?.vapidKey,
      }).catch(() => null);

      if (currentToken) {
        await deleteToken(messaging);
        await fetch(`${API_BASE}/push/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ fcmToken: currentToken })
        }).catch(() => {});
      }
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

/** True if this browser/user has an active FCM token. */
export async function hasActiveSubscription() {
  const supported = await isPushSupported();
  if (!supported) return false;
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return false;
    const config = await fetchFcmConfig().catch(() => null);
    if (!config) return false;
    const token = await getToken(messaging, { vapidKey: config.vapidKey }).catch(() => null);
    return !!token;
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
