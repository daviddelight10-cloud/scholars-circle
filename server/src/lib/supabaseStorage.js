import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("[supabaseStorage] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — file uploads will fail");
}

export const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "");

export const BUCKET = "resources";

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the public URL on success, throws on error.
 */
export async function uploadFile(buffer, fileName, mimeType) {
  // Sanitize: replace spaces and special chars with dashes, keep extension
  const safeName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove accents
    .replace(/[^a-zA-Z0-9._-]/g, "-")  // replace invalid chars with dash
    .replace(/-+/g, "-")               // collapse multiple dashes
    .toLowerCase();
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(uniqueName, buffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(uniqueName);
  return { publicUrl: data.publicUrl, storagePath: uniqueName };
}

/**
 * Delete a file from Supabase Storage by its storage path.
 */
export async function deleteFile(storagePath) {
  if (!storagePath) return;
  await supabase.storage.from(BUCKET).remove([storagePath]);
}
