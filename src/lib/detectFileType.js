/**
 * Detect file type from magic bytes (file signature) instead of relying
 * solely on file extensions. Falls back to extension/MIME if magic bytes
 * are inconclusive.
 *
 * Supported types: pdf, docx, pptx, doc, txt, image (png/jpg/gif/bmp/webp)
 *
 * @param {File|Blob} file
 * @returns {Promise<string>} — one of: "pdf", "docx", "pptx", "doc", "txt", "image", "unknown"
 */
export async function detectFileType(file) {
  if (!file) return "unknown";

  // Fast path: check well-known MIME types
  const mime = file.type || "";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime === "text/plain") return "txt";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (mime === "application/msword") return "doc";

  // Read first 8 bytes for magic number detection
  let header = null;
  try {
    const slice = file.slice(0, 8);
    const buf = await slice.arrayBuffer();
    header = new Uint8Array(buf);
  } catch {
    header = null;
  }

  if (header && header.length >= 4) {
    // PDF: %PDF (25 50 44 46)
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
      return "pdf";
    }

    // PNG: 89 50 4E 47
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
      return "image";
    }

    // JPEG: FF D8 FF
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return "image";
    }

    // GIF: 47 49 46 38
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
      return "image";
    }

    // BMP: 42 4D
    if (header[0] === 0x42 && header[1] === 0x4d) {
      return "image";
    }

    // WebP: RIFF....WEBP — need to check bytes 8-11 for "WEBP"
    // (RIFF is also used by WAV, AVI, so we must verify the format tag)
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      try {
        const slice2 = file.slice(8, 12);
        const buf2 = await slice2.arrayBuffer();
        const tag = new Uint8Array(buf2);
        if (tag[0] === 0x57 && tag[1] === 0x45 && tag[2] === 0x42 && tag[3] === 0x50) {
          return "image";
        }
      } catch {}
    }

    // DOCX and PPTX are ZIP archives: PK 03 04
    if (header[0] === 0x50 && header[1] === 0x4b && (header[2] === 0x03 || header[2] === 0x05) && (header[3] === 0x04 || header[3] === 0x06 || header[3] === 0x07 || header[3] === 0x08)) {
      // It's a ZIP — could be DOCX, PPTX, or other. Need to inspect contents.
      try {
        const type = await detectZipType(file);
        if (type) return type;
      } catch {
        // fall through to extension check
      }
    }

    // DOC (older binary format): D0 CF 11 E0 A1 B1 1A E1 (OLE2 compound document)
    if (header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0 && header[4] === 0xa1 && header[5] === 0xb1 && header[6] === 0x1a && header[7] === 0xe1) {
      return "doc";
    }
  }

  // Fallback: check file extension
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".doc")) return "doc";
  if (name.endsWith(".txt")) return "txt";
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) return "image";

  // Last resort: try reading as text
  if (header) {
    // If all bytes are printable ASCII or common whitespace, treat as text
    let printable = true;
    for (let i = 0; i < Math.min(header.length, 8); i++) {
      const b = header[i];
      if (!((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d)) {
        printable = false;
        break;
      }
    }
    if (printable) return "txt";
  }

  return "unknown";
}

/**
 * Inspect a ZIP archive to determine if it's a DOCX or PPTX by scanning
 * raw bytes for characteristic folder names. ZIP files store entry names
 * as plain text in the central directory (near the end of the file).
 * This avoids loading JSZip just for type detection.
 */
async function detectZipType(file) {
  // Read the last 64KB of the file (central directory is at the end)
  // plus the first 2KB (local file headers are at the start)
  const tailSize = Math.min(65536, file.size);
  const headSize = Math.min(2048, file.size);

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
