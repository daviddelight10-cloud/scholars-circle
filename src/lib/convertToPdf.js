import { jsPDF } from "jspdf";

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
    const wrapped = doc.splitTextToSize(para, contentWidth);
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
 * Convert DOCX to PDF — mammoth extracts HTML (with images), render to PDF via jsPDF.html().
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

  onProgress?.("Rendering document to PDF…");

  // Create off-screen container with styled HTML
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 595px;
    padding: 40px;
    background: #ffffff;
    color: #1e1e23;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13px;
    line-height: 1.6;
    box-sizing: border-box;
  `;
  container.innerHTML = `
    <div style="border-bottom: 2px solid #b8860b; padding-bottom: 10px; margin-bottom: 20px;">
      <h1 style="color: #b8860b; font-size: 20px; margin: 0; font-family: Helvetica, Arial, sans-serif;">${file.name.replace(/\.docx$/i, "")}</h1>
    </div>
    ${html}
  `;

  // Style images inside
  container.querySelectorAll("img").forEach((img) => {
    img.style.cssText = "max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;";
  });
  // Style headings
  container.querySelectorAll("h1, h2, h3").forEach((h) => {
    h.style.color = "#b8860b";
    h.style.fontFamily = "Helvetica, Arial, sans-serif";
    h.style.marginTop = "16px";
  });
  container.querySelectorAll("h1").forEach((h) => { h.style.fontSize = "18px"; });
  container.querySelectorAll("h2").forEach((h) => { h.style.fontSize = "16px"; });
  container.querySelectorAll("h3").forEach((h) => { h.style.fontSize = "14px"; });
  // Style tables
  container.querySelectorAll("table").forEach((t) => {
    t.style.cssText = "width: 100%; border-collapse: collapse; margin: 10px 0;";
  });
  container.querySelectorAll("td, th").forEach((c) => {
    c.style.cssText = "border: 1px solid #ddd; padding: 6px 8px;";
  });

  document.body.appendChild(container);

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    await doc.html(container, {
      callback: (doc) => {},
      margin: [40, 40, 40, 40],
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      autoPaging: "text",
    });

    const blob = doc.output("blob");
    return { pdfBlob: blob, fileName: replaceExt(file.name, ".pdf") };
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Convert PPTX to PDF — calls server-side conversion endpoint.
 */
async function pptxToPdfClient(file, onProgress) {
  onProgress?.("Uploading to server for conversion…");

  const formData = new FormData();
  formData.append("file", file);

  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/api/resources/convert-pptx`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

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

  const name = file.name.toLowerCase();
  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
  const isPDF = file.type === "application/pdf" || name.endsWith(".pdf");
  const isTXT = file.type === "text/plain" || name.endsWith(".txt");
  const isDOCX = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx");
  const isPPTX = file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || name.endsWith(".pptx");
  const isDOC = name.endsWith(".doc");

  if (isImage || isPDF || isDOC) return null;
  if (isTXT) return txtToPdf(file, onProgress);
  if (isDOCX) return docxToPdf(file, onProgress);
  if (isPPTX) return pptxToPdfClient(file, onProgress);

  return null;
}

/**
 * Check if a file needs conversion to PDF.
 */
export function needsConversion(file) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
  const isPDF = file.type === "application/pdf" || name.endsWith(".pdf");
  const isDOC = name.endsWith(".doc");
  const isJSON = name.endsWith(".json");
  return !(isImage || isPDF || isDOC || isJSON);
}
