import crypto from "crypto";

// Rotating attendance codes. A session stores a random secret; the code shown
// to the room is HMAC(secret, windowIndex) reduced to 6 digits, so a code
// forwarded on WhatsApp dies within a minute and nothing needs storing per tick.
export const WINDOW_SECS = 30;

export function windowIndex(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / WINDOW_SECS);
}

export function newSecret() {
  return crypto.randomBytes(24).toString("hex");
}

export function codeFor(secret, idx) {
  const h = crypto.createHmac("sha256", secret).update(String(idx)).digest();
  const n = h.readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

// Seconds until the currently displayed code rotates.
export function secondsLeft(nowMs = Date.now()) {
  return WINDOW_SECS - (Math.floor(nowMs / 1000) % WINDOW_SECS);
}

// Accepts the current and the previous window (30–60s effective life) so a
// code read just before rotation still works.
export function isValidCode(secret, code, nowMs = Date.now()) {
  const given = String(code || "").trim();
  if (!/^\d{6}$/.test(given)) return false;
  const idx = windowIndex(nowMs);
  const gb = Buffer.from(given);
  return [idx, idx - 1].some((i) => {
    const want = Buffer.from(codeFor(secret, i));
    return crypto.timingSafeEqual(want, gb);
  });
}

export function haversineM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
