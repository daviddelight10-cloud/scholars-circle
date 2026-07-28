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
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf") result = "pdf";
  else if (mime.startsWith("image/")) result = "image";
  else if (mime === "text/plain") result = "txt";
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
 * Inspect a ZIP archive to determine if it's a DOCX or PPTX.
 * First checks [Content_Types].xml (usually near the start of the archive)
 * for unique OOXML content type strings. If that fails, it locates the
 * ZIP central directory by parsing the End of Central Directory record
 * and scans the file names stored there.
 *
 * This avoids loading JSZip just for type detection.
 */
async function detectZipType(file) {
  // ── 1. Fast check: [Content_Types].xml near the start ──────────────────────
  const headSize = Math.min(65536, file.size);
  try {
    const headBuf = await file.slice(0, headSize).arrayBuffer();
    const headText = new TextDecoder("utf-8", { fatal: false }).decode(headBuf).toLowerCase();

    if (headText.includes("presentationml.presentation") || headText.includes("presentationml.slide")) {
      return "pptx";
    }
    if (headText.includes("wordprocessingml.document")) {
      return "docx";
    }
  } catch {
    // fall through to central directory scan
  }

  // ── 2. Locate and read central directory via EOCD ───────────────────────────
  let centralDir = new Uint8Array(0);
  try {
    const eocdBlockSize = Math.min(65536 + 22, file.size);
    const eocdBuf = await file.slice(file.size - eocdBlockSize, file.size).arrayBuffer();
    const eocd = new Uint8Array(eocdBuf);

    // Find EOCD signature PK\x05\x06
    let eocdPos = -1;
    for (let i = eocd.length - 22; i >= 0; i--) {
      if (eocd[i] === 0x50 && eocd[i + 1] === 0x4b && eocd[i + 2] === 0x05 && eocd[i + 3] === 0x06) {
        eocdPos = i;
        break;
      }
    }

    if (eocdPos >= 0) {
      const view = new DataView(eocd.buffer, eocd.byteOffset + eocdPos, 22);
      let cdOffset = view.getUint32(16, true);
      let cdSize = view.getUint32(12, true);

      // ZIP64: offsets are 0xFFFFFFFF, must search for EOCD64 locator
      if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
        const locOffset = eocdPos - 20;
        if (locOffset >= 0) {
          const locator = new DataView(eocd.buffer, eocd.byteOffset + locOffset, 20);
          if (locator.getUint32(0, true) === 0x07064b50) {
            const eocd64Offset = Number(locator.getBigUint64(8, true));
            const eocd64Buf = await file.slice(eocd64Offset, eocd64Offset + 96).arrayBuffer();
            const eocd64 = new Uint8Array(eocd64Buf);
            const eocd64View = new DataView(eocd64.buffer, eocd64.byteOffset, Math.min(96, eocd64.length));
            // Verify signature PK\x06\x06
            if (eocd64View.getUint32(0, true) === 0x06064b50 && eocd64View.byteLength >= 56) {
              cdSize = Number(eocd64View.getBigUint64(40, true));
              cdOffset = Number(eocd64View.getBigUint64(48, true));
            }
          }
        }
      }

      if (cdSize > 0 && cdOffset >= 0 && cdOffset + cdSize <= file.size) {
        const cdBuf = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
        centralDir = new Uint8Array(cdBuf);
      }
    }
  } catch {
    // fall through to tail scan below
  }

  // ── 3. Scan central directory (or fall back to last 64KB) for filenames ─────
  let scan = centralDir;
  if (centralDir.length === 0) {
    try {
      const tailSize = Math.min(65536, file.size);
      const tailBuf = await file.slice(file.size - tailSize, file.size).arrayBuffer();
      scan = new Uint8Array(tailBuf);
    } catch {
      return null;
    }
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(scan);

  // DOCX contains word/document.xml
  if (text.includes("word/document.xml") || text.includes("word/_rels/document.xml.rels")) {
    return "docx";
  }

  // PPTX contains ppt/presentation.xml
  if (text.includes("ppt/presentation.xml") || text.includes("ppt/_rels/presentation.xml.rels")) {
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

  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".doc")) return "doc";
  if (name.endsWith(".txt")) return "txt";
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) return "image";

  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime === "text/plain") return "txt";

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
