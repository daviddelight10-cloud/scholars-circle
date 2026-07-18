import { jsPDF } from "jspdf";
import { detectFileType, detectFileTypeSync } from "./detectMimeType";

const MAMMOTH_CDN = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";

const _scriptPromises = {};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.type = "text/javascript";
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureScript(src, windowKey) {
  if (window[windowKey]) return;
  if (_scriptPromises[src]) return _scriptPromises[src];
  _scriptPromises[src] = loadScript(src);
  await _scriptPromises[src];
}

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

function getAuthToken() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken;
  } catch {
    return null;
  }
}

function replaceExt(filename, newExt) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.substring(0, idx) + newExt : filename + newExt;
}

/**
 * Break words wider than maxWidth into chunks separated by spaces.
 * Works with jsPDF's splitTextToSize which only breaks on real spaces.
 */
function splitLongWords(text, maxWidth, doc) {
  const words = text.split(/(\s+)/);
  const result = [];
  for (const word of words) {
    if (/^\s+$/.test(word)) { result.push(word); continue; }
    if (doc.getTextWidth(word) <= maxWidth) { result.push(word); continue; }
    let chunk = "";
    for (const ch of word) {
      if (doc.getTextWidth(chunk + ch) > maxWidth) {
        if (chunk) result.push(chunk + " ");
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    if (chunk) result.push(chunk);
  }
  return result.join("");
}

/**
 * Decode HTML entities to plain text.
 */
function decodeEntities(text) {
  const txt = document.createElement("textarea");
  txt.innerHTML = text;
  return txt.value;
}

/**
 * Strip HTML tags and return plain text with line breaks preserved.
 */
function htmlToPlainText(html) {
  const container = document.createElement("div");
  container.innerHTML = html;

  function walk(node, lines) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (text.trim()) {
          lines.push({ type: "text", content: decodeEntities(text) });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === "br") {
          lines.push({ type: "break" });
        } else if (tag === "p" || tag === "div") {
          walk(child, lines);
          lines.push({ type: "break" });
        } else if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
          lines.push({ type: "break" });
          lines.push({ type: "heading", level: parseInt(tag[1]), content: decodeEntities(child.textContent) });
          lines.push({ type: "break" });
        } else if (tag === "li") {
          lines.push({ type: "listitem", content: decodeEntities(child.textContent) });
        } else if (tag === "ul" || tag === "ol") {
          lines.push({ type: "break" });
          walk(child, lines);
          lines.push({ type: "break" });
        } else if (tag === "table") {
          lines.push({ type: "break" });
          const rows = child.querySelectorAll("tr");
          rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll("td, th")).map((c) => decodeEntities(c.textContent.trim()));
            lines.push({ type: "tablerow", cells });
          });
          lines.push({ type: "break" });
        } else if (tag === "img") {
          lines.push({ type: "image", src: child.getAttribute("src") || "" });
        } else if (tag === "pre") {
          lines.push({ type: "break" });
          lines.push({ type: "text", content: decodeEntities(child.textContent) });
          lines.push({ type: "break" });
        } else if (tag === "strong" || tag === "b" || tag === "em" || tag === "i" || tag === "span" || tag === "a") {
          walk(child, lines);
        } else {
          walk(child, lines);
        }
      }
    }
  }

  const lines = [];
  walk(container, lines);

  // Merge consecutive text blocks so inline-formatted text (e.g. <p>Hello <strong>world</strong></p>)
  // renders as a single wrapped line instead of separate lines.
  const merged = [];
  for (const block of lines) {
    if (block.type === "text" && merged.length > 0 && merged[merged.length - 1].type === "text") {
      merged[merged.length - 1].content += block.content;
    } else {
      merged.push({ ...block });
    }
  }
  return merged;
}

/**
 * Convert TXT to PDF — paginated text with proper margins.
 */
async function txtToPdf(file, onProgress) {
  onProgress?.("Reading text file…");
  const text = await file.text();
  if (!text.trim()) throw new Error("Text file is empty");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 50;
  const marginTop = 60;
  const marginBottom = 50;
  const contentWidth = pageWidth - marginX * 2;
  const fontSize = 11;
  const lineHeight = fontSize * 1.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(30, 30, 35);

  // Header band
  doc.setFillColor(20, 20, 28);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setFontSize(12);
  doc.setTextColor(184, 134, 11);
  doc.setFont("helvetica", "bold");
  doc.text(file.name, marginX, 25);

  let y = marginTop;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(30, 30, 35);

  const paragraphs = text.split(/\n/);
  for (const para of paragraphs) {
    const broken = splitLongWords(para, contentWidth, doc);
    const wrapped = doc.splitTextToSize(broken, contentWidth);
    for (const line of wrapped) {
      if (y > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(30, 30, 35);
      }
      doc.text(line, marginX, y);
      y += lineHeight;
    }
    y += 4;
  }

  const blob = doc.output("blob");
  return { pdfBlob: blob, fileName: replaceExt(file.name, ".pdf") };
}

/**
 * Convert DOCX to PDF — mammoth extracts HTML, then we render text directly
 * with jsPDF's text API for full control over wrapping and pagination.
 * Images are embedded as base64. No html2canvas — no clipping, no blank pages.
 */
async function docxToPdf(file, onProgress) {
  onProgress?.("Loading DOCX converter…");
  await ensureScript(MAMMOTH_CDN, "mammoth");

  onProgress?.("Extracting document content…");
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.convertToHtml(
    { arrayBuffer },
    { convertImage: window.mammoth.images.imgElement((image) => image.read("base64").then((imageBuffer) => ({ src: `data:${image.contentType};base64,${imageBuffer}` }))) }
  );
  const html = result.value;
  if (!html.trim()) throw new Error("No content found in DOCX file");

  onProgress?.("Parsing document structure…");
  const blocks = htmlToPlainText(html);

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 50;
  const marginTop = 60;
  const marginBottom = 50;
  const contentWidth = pageWidth - marginX * 2;

  // Header band
  doc.setFillColor(20, 20, 28);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setFontSize(12);
  doc.setTextColor(184, 134, 11);
  doc.setFont("helvetica", "bold");
  doc.text(file.name.replace(/\.docx$/i, ""), marginX, 25);

  let y = marginTop;

  function ensureSpace(needed) {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  }

  function writeText(text, opts = {}) {
    const fs = opts.fontSize || 11;
    const lh = fs * 1.5;
    const font = opts.font || "helvetica";
    const style = opts.style || "normal";
    const color = opts.color || [30, 30, 35];
    const indent = opts.indent || 0;

    doc.setFont(font, style);
    doc.setFontSize(fs);
    doc.setTextColor(color[0], color[1], color[2]);

    const broken = splitLongWords(text, contentWidth - indent, doc);
    const wrapped = doc.splitTextToSize(broken, contentWidth - indent);
    for (const line of wrapped) {
      ensureSpace(lh);
      doc.text(line, marginX + indent, y);
      y += lh;
    }
  }

  onProgress?.("Rendering document to PDF…");

  for (const block of blocks) {
    switch (block.type) {
      case "text":
        writeText(block.content);
        y += 4;
        break;

      case "break":
        y += 6;
        break;

      case "heading": {
        const sizes = { 1: 18, 2: 16, 3: 14, 4: 13, 5: 12, 6: 11 };
        const fs = sizes[block.level] || 14;
        y += 4;
        writeText(block.content, { fontSize: fs, style: "bold", color: [184, 134, 11] });
        y += 6;
        break;
      }

      case "listitem":
        writeText("• " + block.content, { indent: 20 });
        y += 2;
        break;

      case "tablerow": {
        if (!block.cells.length) break;
        const colWidth = contentWidth / block.cells.length;
        const cellPad = 4;
        const cellLineHeight = 12;
        const minRowHeight = 16;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 45);

        // First pass: wrap all cell text and calculate max row height
        const wrappedCells = block.cells.map((cell) => {
          if (!cell) return [];
          const cellContentWidth = colWidth - cellPad * 2;
          const broken = splitLongWords(cell, cellContentWidth, doc);
          return doc.splitTextToSize(broken, cellContentWidth);
        });
        const maxRowHeight = Math.max(minRowHeight, ...wrappedCells.map((w) => w.length * cellLineHeight + cellPad * 2));

        ensureSpace(maxRowHeight);

        // Draw cell borders with correct height
        block.cells.forEach((_, ci) => {
          const cx = marginX + ci * colWidth;
          doc.setDrawColor(200, 200, 200);
          doc.rect(cx, y, colWidth, maxRowHeight);
        });

        // Draw cell text
        wrappedCells.forEach((wrapped, ci) => {
          const cx = marginX + ci * colWidth + cellPad;
          let cy = y + cellPad + 8;
          for (const line of wrapped) {
            doc.text(line, cx, cy);
            cy += cellLineHeight;
          }
        });

        y += maxRowHeight + 2;
        break;
      }

      case "image": {
        if (!block.src || !block.src.startsWith("data:image")) break;
        try {
          const imgData = block.src;
          const img = new Image();
          img.src = imgData;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          const maxW = contentWidth;
          const maxH = pageHeight - marginBottom - marginTop;
          let imgW = img.naturalWidth || img.width;
          let imgH = img.naturalHeight || img.height;
          const ratio = Math.min(maxW / imgW, maxH / imgH, 1);
          imgW = imgW * ratio;
          imgH = imgH * ratio;

          ensureSpace(imgH + 10);
          const format = block.src.includes("image/png") ? "PNG" : block.src.includes("image/webp") ? "WEBP" : "JPEG";
          doc.addImage(imgData, format, marginX, y, imgW, imgH);
          y += imgH + 8;
        } catch {
          // Skip broken images
        }
        break;
      }
    }
  }

  onProgress?.("Finalizing PDF…");
  const blob = doc.output("blob");
  return { pdfBlob: blob, fileName: replaceExt(file.name, ".pdf") };
}

/**
 * Convert PPTX to PDF — calls server-side conversion endpoint.
 * Renames the file to .pptx if needed so the server accepts it.
 */
async function pptxToPdfClient(file, onProgress) {
  onProgress?.("Uploading to server for conversion…");

  // Ensure the file has a .pptx extension — the server multer filter checks it
  let uploadFile = file;
  const lowerName = (file.name || "").toLowerCase();
  if (!lowerName.endsWith(".pptx")) {
    const baseName = file.name.replace(/\.[^.]+$/, "") || "presentation";
    uploadFile = new File([file], baseName + ".pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  }

  const formData = new FormData();
  formData.append("file", uploadFile);

  const token = getAuthToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  let res;
  try {
    res = await fetch(`${API_BASE}/api/resources/convert-pptx`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("PPTX conversion timed out — the server took too long. You can still upload the original file.");
    }
    throw new Error("Failed to connect to server for PPTX conversion. You can still upload the original file.");
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Conversion failed" }));
    throw new Error(err.error || "Failed to convert PPTX");
  }

  onProgress?.("Generating PDF…");
  const blob = await res.blob();
  return { pdfBlob: blob, fileName: replaceExt(file.name, ".pdf") };
}

/**
 * Main entry point — detects file type and dispatches to the right converter.
 * Returns { pdfBlob, fileName } or null if no conversion is needed.
 * @param {File} file
 * @param {(status: string) => void} onProgress
 * @returns {Promise<{pdfBlob: Blob, fileName: string} | null>}
 */
export async function convertToPdf(file, onProgress) {
  if (!file) return null;

  const detectedType = await detectFileType(file);

  if (detectedType === "image" || detectedType === "pdf" || detectedType === "doc") return null;
  if (detectedType === "txt") return txtToPdf(file, onProgress);
  if (detectedType === "docx") return docxToPdf(file, onProgress);
  if (detectedType === "pptx") return pptxToPdfClient(file, onProgress);

  return null;
}

/**
 * Check if a file needs conversion to PDF.
 */
export function needsConversion(file) {
  if (!file) return false;
  const detectedType = detectFileTypeSync(file);
  return !(detectedType === "image" || detectedType === "pdf" || detectedType === "doc" || file.name.toLowerCase().endsWith(".json"));
}
