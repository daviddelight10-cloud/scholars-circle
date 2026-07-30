import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Initialize Analytics if supported (not supported in service worker / some browsers)
if (typeof window !== "undefined") {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  }).catch(() => {});
}

let messaging = null;
let messagingSupported = false;

export async function getFirebaseMessaging() {
  if (messaging) return messaging;
  messagingSupported = await isSupported();
  if (!messagingSupported) return null;
  messaging = getMessaging(app);
  return messaging;
}

export async function isMessagingSupported() {
  if (messagingSupported) return true;
  messagingSupported = await isSupported();
  return messagingSupported;
}

export { app };
