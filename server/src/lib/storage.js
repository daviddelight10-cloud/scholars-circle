// Durable file storage for classroom documents.
// Railway's local disk is ephemeral — files written to uploads/ vanish on
// every redeploy. When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set we
// store objects in a private Supabase Storage bucket and serve them through
// short-lived signed URLs. Without keys (local dev) we fall back to disk —
// same behavior as before, no regression.
import fs from "fs";
import path from "path";

const BUCKET = "classroom-docs";
export const AUDIO_BUCKET = "page-tutor-audio";
const URL_ = () => process.env.SUPABASE_URL?.replace(/\/+$/, "") || null;
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || null;

export const storageEnabled = () => !!(URL_() && KEY());

const storagePath = (url) => url?.startsWith("storage://") ? url.slice("storage://".length) : null;
export const isStorageUrl = (url) => !!storagePath(url);

async function storageFetch(pathname, init = {}) {
  const res = await fetch(`${URL_()}/storage/v1${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY()}`,
      "x-upsert": "true",
      ...(init.headers || {}),
    },
  });
  return res;
}

const bucketsReady = new Set();
async function ensureBucket(bucket = BUCKET) {
  if (bucketsReady.has(bucket)) return;
  // POST /bucket — 409/already-exists is fine.
  try {
    await storageFetch("/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
  } catch { /* if the check fails the upload attempt will surface the real error */ }
  bucketsReady.add(bucket);
}

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
 * ClassroomDocument.fileUrl — "storage://<path>" when Supabase is configured,
 * otherwise the old "/uploads/<file>" disk path.
 */
export async function saveDocument(file) {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (!storageEnabled()) {
    return `/uploads/${file.filename}`;
  }
  await ensureBucket(BUCKET);
  const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname).toLowerCase()}`;
  const body = fs.readFileSync(file.path);
  const res = await storageFetch(`/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream" },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}): ${t.slice(0, 200)}`);
  }
  fs.unlink(file.path, () => {}); // storage owns it now — drop the disk copy
  return `storage://${objectPath}`;
}

/** Resolve a stored fileUrl to a fetchable source for the download route. */
export async function openDocument(fileUrl) {
  const objectPath = storagePath(fileUrl);
  if (!objectPath) return null;
  const res = await storageFetch(`/object/sign/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!res.ok) return null;
  const { signedURL } = await res.json().catch(() => ({}));
  return signedURL ? `${URL_()}/storage/v1${signedURL}` : null;
}

/** Delete a stored object (best effort — used when a document row is removed). */
export async function removeDocument(fileUrl) {
  const objectPath = storagePath(fileUrl);
  if (!objectPath || !storageEnabled()) return;
  await storageFetch(`/object/${BUCKET}/${objectPath}`, { method: "DELETE" }).catch(() => {});
}

// ---- Generic buffer helpers (Page Tutor audio, etc.) ----
// Object paths are stored bare — the caller knows the bucket.
// Without Supabase keys (local dev) files fall back to the served /uploads dir
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
  await ensureBucket(bucket);
  const res = await storageFetch(`/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: buf,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}): ${t.slice(0, 200)}`);
  }
  return objectPath;
}

/** Signed fetch URL for a stored object; pass-through for disk-fallback paths. */
export async function signedUrl(objectPath, { bucket = AUDIO_BUCKET, expiresIn = 900 } = {}) {
  if (!objectPath) return null;
  if (objectPath.startsWith("/")) return objectPath; // disk fallback — served by this app
  if (!storageEnabled()) return null;
  const res = await storageFetch(`/object/sign/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const { signedURL } = await res.json().catch(() => ({}));
  return signedURL ? `${URL_()}/storage/v1${signedURL}` : null;
}

/** Delete every object under a prefix (used on lesson regenerate). */
export async function removePrefix(prefix, { bucket = AUDIO_BUCKET } = {}) {
  if (!storageEnabled()) return;
  const res = await storageFetch(`/object/list/${bucket}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 200 }),
  }).catch(() => null);
  if (!res?.ok) return;
  const items = await res.json().catch(() => []);
  const paths = (Array.isArray(items) ? items : []).map((i) => i?.name).filter(Boolean).map((n) => `${prefix}${n}`);
  if (!paths.length) return;
  await storageFetch(`/object/${bucket}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => {});
}
