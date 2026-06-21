import { createClient } from "@supabase/supabase-js";
import path from "path";

const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("[supabaseStorage] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — file uploads will fail");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const BUCKET = "resources";

/** Ensure the bucket exists (creates it as public if missing) */
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    console.log("[supabaseStorage] bucket not found — creating it now");
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) console.error("[supabaseStorage] failed to create bucket:", error.message);
    else console.log("[supabaseStorage] bucket created:", BUCKET);
  }
}

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the public URL on success, throws on error.
 */
export async function uploadFile(buffer, fileName, mimeType) {
  await ensureBucket();
  // Use only timestamp + random + extension — avoids ALL filename path issues
  const ext = path.extname(fileName || "").toLowerCase() || ".bin";
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;

  console.log("[supabaseStorage] uploading to bucket:", BUCKET, "path:", storagePath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    console.error("[supabaseStorage] upload error:", error);
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  console.log("[supabaseStorage] public URL:", data.publicUrl);
  return { publicUrl: data.publicUrl, storagePath };
}

/**
 * Delete a file from Supabase Storage by its storage path.
 */
export async function deleteFile(storagePath) {
  if (!storagePath) return;
  await supabase.storage.from(BUCKET).remove([storagePath]);
}
