// Generates a new VAPID key pair for Web Push.
// Run once and save the output to your .env file (or Railway env vars).
//
//   node server/scripts/generate-vapid.js
//
// Required env vars (in production):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT=mailto:admin@your-domain.com
//
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\n========= VAPID KEYS (Web Push) =========\n");
console.log("Add these to your .env / Railway environment:\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@scholars-circle.app`);
console.log("\n=========================================\n");
console.log("⚠️  Keep VAPID_PRIVATE_KEY secret. The PUBLIC key is safe to ship to clients.\n");
