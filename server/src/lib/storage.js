// Durable file storage for classroom documents.
// Railway's local disk is ephemeral — files written to uploads/ vanish on
// every redeploy. When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set we
// store objects in a private Supabase Storage bucket and serve them through
// short-lived signed URLs. Without keys (local dev) we fall back to disk —
// same behavior as before, no regression.
import fs from "fs";
import path from "path";

const BUCKET = "classroom-docs";
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

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  // POST /bucket — 409/already-exists is fine.
  try {
    await storageFetch("/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    });
  } catch { /* if the check fails the upload attempt will surface the real error */ }
  bucketReady = true;
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
  await ensureBucket();
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
