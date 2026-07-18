/**
 * Detect file type from magic bytes (file signature) instead of relying
 * solely on file extensions or browser MIME types. Falls back to extension/MIME
 * if magic bytes are inconclusive.
 *
 * Supported types: pdf, docx, pptx, doc, txt, image (png/jpg/gif/bmp/webp)
 *
 * @param {File|Blob} file
 * @returns {Promise<string>} — one of: "pdf", "docx", "pptx", "doc", "txt", "image", "unknown"
 */
const _fileTypeCache = new WeakMap();

export async function detectFileType(file) {
  if (!file) return "unknown";
  if (_fileTypeCache.has(file)) return _fileTypeCache.get(file);

  let result = "unknown";

  // Fast path: check well-known MIME types
  const mime = file.type || "";
  if (mime === "application/pdf") result = "pdf";
  else if (mime.startsWith("image/")) result = "image";
  else if (mime === "text/plain") result = "txt";
  else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") result = "docx";
  else if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") result = "pptx";
  else if (mime === "application/msword") result = "doc";
  else {
    // Read first 12 bytes for magic number detection
    let header = null;
    try {
      const slice = file.slice(0, 12);
      const buf = await slice.arrayBuffer();
      header = new Uint8Array(buf);
    } catch {
      header = null;
    }

    if (header && header.length >= 4) {
      // PDF: %PDF (25 50 44 46)
      if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
        result = "pdf";
      }
      // PNG: 89 50 4E 47
      else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
        result = "image";
      }
      // JPEG: FF D8 FF
      else if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
        result = "image";
      }
      // GIF: 47 49 46 38
      else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
        result = "image";
      }
      // BMP: 42 4D
      else if (header[0] === 0x42 && header[1] === 0x4d) {
        result = "image";
      }
      // WebP: RIFF....WEBP
      else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && header.length >= 12) {
        if (header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
          result = "image";
        }
      }
      // DOCX and PPTX are ZIP archives: PK 03 04 or PK 05 06
      else if (header[0] === 0x50 && header[1] === 0x4b && (header[2] === 0x03 || header[2] === 0x05) && (header[3] === 0x04 || header[3] === 0x06 || header[3] === 0x07 || header[3] === 0x08)) {
        try {
          const type = await detectZipType(file);
          if (type) result = type;
        } catch {
          // fall through
        }
      }
      // DOC (older binary format): D0 CF 11 E0 A1 B1 1A E1
      else if (header.length >= 8 && header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0 && header[4] === 0xa1 && header[5] === 0xb1 && header[6] === 0x1a && header[7] === 0xe1) {
        result = "doc";
      }
    }

    // Fallback: check file extension
    if (result === "unknown") {
      const name = (file.name || "").toLowerCase();
      if (name.endsWith(".pdf")) result = "pdf";
      else if (name.endsWith(".docx")) result = "docx";
      else if (name.endsWith(".pptx")) result = "pptx";
      else if (name.endsWith(".doc")) result = "doc";
      else if (name.endsWith(".txt")) result = "txt";
      else if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) result = "image";
    }

    // Last resort: try reading as text
    if (result === "unknown" && header && header.length > 0) {
      let printable = true;
      for (let i = 0; i < header.length; i++) {
        const b = header[i];
        if (!((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d)) {
          printable = false;
          break;
        }
      }
      if (printable) result = "txt";
    }
  }

  _fileTypeCache.set(file, result);
  return result;
}

/**
 * Inspect a ZIP archive to determine if it's a DOCX or PPTX by scanning
 * raw bytes for characteristic folder names. ZIP files store entry names
 * as plain text in the central directory (near the end of the file).
 * This avoids loading JSZip just for type detection.
 */
async function detectZipType(file) {
  // Read the last 64KB of the file (central directory is at the end)
  // plus the first 4KB (local file headers are at the start)
  const tailSize = Math.min(65536, file.size);
  const headSize = Math.min(4096, file.size);

  let combined = new Uint8Array(0);

  try {
    const tailBuf = await file.slice(file.size - tailSize, file.size).arrayBuffer();
    const tail = new Uint8Array(tailBuf);

    if (headSize > 0 && headSize < file.size) {
      const headBuf = await file.slice(0, headSize).arrayBuffer();
      const head = new Uint8Array(headBuf);
      combined = new Uint8Array(head.length + tail.length);
      combined.set(head, 0);
      combined.set(tail, head.length);
    } else {
      combined = tail;
    }
  } catch {
    return null;
  }

  // Convert to string for searching (entry names are ASCII/UTF-8)
  const text = new TextDecoder("ascii", { fatal: false }).decode(combined);

  // DOCX contains word/document.xml
  if (text.includes("word/") || text.includes("word\\")) {
    return "docx";
  }

  // PPTX contains ppt/slides/
  if (text.includes("ppt/") || text.includes("ppt\\")) {
    return "pptx";
  }

  return null;
}

/**
 * Synchronous version that only checks extension and MIME type.
 * Use when you can't await file reading (e.g., in render logic).
 * @param {File|Blob} file
 * @returns {string}
 */
export function detectFileTypeSync(file) {
  if (!file) return "unknown";

  const mime = file.type || "";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime === "text/plain") return "txt";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (mime === "application/msword") return "doc";

  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".doc")) return "doc";
  if (name.endsWith(".txt")) return "txt";
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) return "image";

  return "unknown";
}

/**
 * Map detected file type to content type used by the backend.
 * @param {string} type — output from detectFileType/detectFileTypeSync
 * @returns {string|null}
 */
export function typeToContentType(type) {
  switch (type) {
    case "pdf": return "pdf";
    case "image": return "image";
    case "docx":
    case "doc": return "docx";
    case "pptx": return "pptx";
    case "txt": return "txt";
    default: return null;
  }
}
