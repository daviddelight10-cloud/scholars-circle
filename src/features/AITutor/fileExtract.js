/**
 * Browser-side file text extraction.
 * Supports: .pdf (pdf.js CDN), .docx (mammoth CDN), .txt, .md, plain text.
 * Returns { text, pages? }.
 */

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const MAMMOTH_CDN = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";

function loadScript(src, globalKey) {
  return new Promise((resolve, reject) => {
    if (globalKey && window[globalKey]) return resolve(window[globalKey]);
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalKey ? window[globalKey] : true));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(globalKey ? window[globalKey] : true);
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function extractTextFromFile(file) {
  if (!file) throw new Error("No file provided");
  const name = (file.name || "").toLowerCase();
  const type = file.type || "";

  // PDF
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const pdfjsLib = await loadScript(PDFJS_CDN, "pdfjsLib");
    if (!pdfjsLib) throw new Error("PDF.js not available");
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer.byteLength) throw new Error("File is empty");
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const pageText = tc.items.map((it) => it.str || "").filter(Boolean).join(" ");
        fullText += pageText + "\n\n";
      } catch (e) {
        console.warn(`PDF page ${i} extract failed:`, e);
      }
    }
    return { text: cleanText(fullText), pages: pdf.numPages };
  }

  // DOCX
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    await loadScript(MAMMOTH_CDN, "mammoth");
    const mammoth = window.mammoth;
    if (!mammoth) throw new Error("Mammoth (DOCX reader) failed to load");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: cleanText(result.value || "") };
  }

  // Plain text / markdown / anything readable as text
  if (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".csv")
  ) {
    const text = await file.text();
    return { text: cleanText(text) };
  }

  // Old .doc files are not supported in browser without server-side conversion
  if (type === "application/msword" || name.endsWith(".doc")) {
    throw new Error("Old .doc format isn't supported. Please save as .docx or .pdf and re-upload.");
  }

  throw new Error(`Unsupported file type: ${file.type || name}. Try PDF, DOCX, TXT, or MD.`);
}

function cleanText(s) {
  return (s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
