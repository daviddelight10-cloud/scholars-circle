// Durable file storage for generated/derived files (classroom documents,
// Page Tutor audio). Railway's local disk is ephemeral — files written to
// uploads/ vanish on every redeploy. Everything lives in the existing
// Cloudflare R2 bucket under key prefixes; objects are private and served
// through presigned URLs. Without R2 keys (local dev) we fall back to disk —
// same behavior as before, no regression.
import fs from "fs";
import path from "path";
import { r2Enabled, r2Put, r2SignedGet, r2Delete, r2DeletePrefix } from "./supabaseStorage.js";

// "Buckets" are key prefixes inside the single R2 resources bucket.
const CLASSROOM_PREFIX = "classroom-docs";
export const AUDIO_BUCKET = "page-tutor-audio";

export const storageEnabled = () => r2Enabled();

const storagePath = (url) => url?.startsWith("storage://") ? url.slice("storage://".length) : null;
export const isStorageUrl = (url) => !!storagePath(url);

const CONTENT_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Persist a multer disk-staged file. Returns the value to store in
 * ClassroomDocument.fileUrl — "storage://<path>" when R2 is configured,
 * otherwise the old "/uploads/<file>" disk path.
 */
export async function saveDocument(file) {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (!storageEnabled()) {
    return `/uploads/${file.filename}`;
  }
  const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname).toLowerCase()}`;
  await r2Put(`${CLASSROOM_PREFIX}/${objectPath}`, fs.readFileSync(file.path), CONTENT_TYPES[ext] || "application/octet-stream");
  fs.unlink(file.path, () => {}); // storage owns it now — drop the disk copy
  return `storage://${objectPath}`;
}

/** Resolve a stored fileUrl to a fetchable source for the download route. */
export async function openDocument(fileUrl) {
  const objectPath = storagePath(fileUrl);
  if (!objectPath || !storageEnabled()) return null;
  return r2SignedGet(`${CLASSROOM_PREFIX}/${objectPath}`, 600).catch(() => null);
}

/** Delete a stored object (best effort — used when a document row is removed). */
export async function removeDocument(fileUrl) {
  const objectPath = storagePath(fileUrl);
  if (!objectPath || !storageEnabled()) return;
  await r2Delete(`${CLASSROOM_PREFIX}/${objectPath}`).catch(() => {});
}

// ---- Generic buffer helpers (Page Tutor audio, etc.) ----
// Object paths are stored bare — the caller knows the prefix.
// Without R2 keys (local dev) files fall back to the served /uploads dir
// and the returned ref starts with "/" — callers should treat it as a served path.
const uploadsDir = () => path.join(process.cwd(), "uploads");

export async function saveBuffer(buf, objectPath, { bucket = AUDIO_BUCKET, contentType = "audio/mpeg" } = {}) {
  if (!storageEnabled()) {
    const dir = path.join(uploadsDir(), bucket);
    fs.mkdirSync(dir, { recursive: true });
    const diskName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${path.basename(objectPath)}`;
    fs.writeFileSync(path.join(dir, diskName), buf);
    return `/uploads/${bucket}/${diskName}`;
  }
  await r2Put(`${bucket}/${objectPath}`, buf, contentType);
  return objectPath;
}

/** Presigned fetch URL for a stored object; pass-through for disk-fallback paths. */
export async function signedUrl(objectPath, { bucket = AUDIO_BUCKET, expiresIn = 900 } = {}) {
  if (!objectPath) return null;
  if (objectPath.startsWith("/")) return objectPath; // disk fallback — served by this app
  if (!storageEnabled()) return null;
  return r2SignedGet(`${bucket}/${objectPath}`, expiresIn).catch(() => null);
}

/** Delete every object under a prefix (used on lesson regenerate). */
export async function removePrefix(prefix, { bucket = AUDIO_BUCKET } = {}) {
  if (!storageEnabled()) return;
  await r2DeletePrefix(`${bucket}/${prefix}`).catch(() => {});
}
