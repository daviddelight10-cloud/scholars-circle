import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
const bucketName = (process.env.R2_BUCKET_NAME || "resources").trim();
const publicUrlBase = (process.env.R2_PUBLIC_URL || "").trim().replace(/\/$/, "");

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn("[r2Storage] R2_ACCOUNT_ID, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY not set — uploads will fail");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

export const BUCKET = bucketName;

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns the public URL on success, throws on error.
 */
export async function uploadFile(buffer, fileName, mimeType) {
  const ext = path.extname(fileName || "").toLowerCase() || ".bin";
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;

  console.log("[r2Storage] uploading to bucket:", BUCKET, "path:", storagePath);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
    Body: buffer,
    ContentType: mimeType || "application/octet-stream",
  }));

  if (!publicUrlBase) {
    throw new Error("R2_PUBLIC_URL is not set — cannot generate public file URL");
  }

  const publicUrl = `${publicUrlBase}/${storagePath}`;
  console.log("[r2Storage] public URL:", publicUrl);
  return { publicUrl, storagePath };
}

/**
 * Delete a file from Cloudflare R2 by its storage path.
 */
export async function deleteFile(storagePath) {
  if (!storagePath) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storagePath }));
  } catch (err) {
    console.error("[r2Storage] delete error:", err.message);
  }
}
