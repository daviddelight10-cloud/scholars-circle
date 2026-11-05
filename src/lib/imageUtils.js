/**
 * Shared image helpers for AI payloads.
 *
 * Images reach the multimodal AI as base64 data URLs inside a JSON body — the
 * server caps requests (express.json limit) and oversized images are slow and
 * expensive for the model, which downsamples them anyway. Always downscale
 * before attaching.
 */

/**
 * Read a File/Blob to a data URL (no resize — use downscaleImage for AI use).
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.onerror = () => reject(new Error("Failed to read image file"));
    r.readAsDataURL(file);
  });
}

/**
 * Downscale an image (File, Blob, or data URL) to a JPEG data URL.
 * JPEG output also normalizes PNG/WebP/HEIC-ish inputs onto a white background.
 * @param {File|Blob|string} src
 * @param {number} [maxDim=1600] - max width/height in pixels
 * @param {number} [quality=0.82] - JPEG quality 0–1
 * @returns {Promise<string>} JPEG data URL
 */
export function downscaleImage(src, maxDim = 1600, quality = 0.82) {
  const toDataUrl = typeof src === "string" ? Promise.resolve(src) : readFileAsDataUrl(src);
  return toDataUrl.then(dataUrl => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Couldn't read that image format."));
    img.src = dataUrl;
  }));
}

/**
 * Approximate decoded byte size of a data URL's payload (for payload guards).
 * @param {string} dataUrl
 * @returns {number} bytes
 */
export function dataUrlBytes(dataUrl) {
  const i = (dataUrl || "").indexOf("base64,");
  if (i < 0) return (dataUrl || "").length;
  return Math.floor((dataUrl.length - i - 7) * 3 / 4);
}
