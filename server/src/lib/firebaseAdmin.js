import admin from "firebase-admin";

let initialized = false;

export function initFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[firebase] Service account credentials missing — FCM push notifications disabled. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env vars.");
    return false;
  }

  // Handle escaped newlines in private key (common when stored in .env files)
  privateKey = privateKey.replace(/\\n/g, "\n");

  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    initialized = true;
    console.log("[firebase] Firebase Admin initialized — FCM ready.");
    return true;
  } catch (err) {
    console.error("[firebase] Failed to initialize Firebase Admin:", err.message);
    return false;
  }
}

export function isFirebaseInitialized() {
  return initialized;
}

export function getMessaging() {
  if (!initialized) return null;
  return admin.messaging();
}
