/**
 * Shared file text extraction utility.
 * Supports PDF (text + scanned fallback to page images), DOCX, TXT, PPTX, and images.
 * Dynamically loads CDN scripts as needed.
 *
 * @returns { Promise<{ text: string, images: string[] }> }
 */

import { detectFileType } from "./detectFileType.js";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const MAMMOTH_CDN = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
const JSZIP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

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

/**
 * Extract text and/or images from a File object.
 * @param {File} file
 * @param {number} maxImagePages — max pages to render as images for scanned PDFs (default 10)
 * @returns {Promise<{text: string, images: string[]}>}
 */
export async function extractFileText(file, maxImagePages = 10) {
  if (!file) throw new Error("No file provided");

  const type = await detectFileType(file);

  const isImage = type === "image";
  const isPDF = type === "pdf";
  const isTXT = type === "txt";
  const isDOCX = type === "docx";
  const isPPTX = type === "pptx";

  if (isImage) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
    return { text: "", images: [dataUrl] };
  }

  if (isPDF) {
    await ensureScript(PDFJS_CDN, "pdfjsLib");
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF.js library not available");
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error("File is empty");

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    if (!pdf || pdf.numPages === 0) throw new Error("PDF has no pages");

    let fullText = "";
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        if (textContent && textContent.items && textContent.items.length > 0) {
          const pageText = textContent.items
            .map((item) => item.str || "")
            .filter((str) => str.trim().length > 0)
            .join(" ");
          fullText += pageText + "\n\n";
        }
      } catch (e) {
        console.warn(`Error extracting page ${i}:`, e);
      }
    }

    fullText = fullText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

    if (fullText.length < 20) {
      // Scanned PDF — render pages as images
      const pageImages = [];
      const maxPages = Math.min(totalPages, maxImagePages);
      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const c = document.createElement("canvas");
          c.width = viewport.width;
          c.height = viewport.height;
          await page.render({ canvasContext: c.getContext("2d"), viewport }).promise;
          pageImages.push(c.toDataURL("image/png"));
        } catch (e) {
          console.warn(`Failed to render page ${i} as image:`, e);
        }
      }
      return { text: fullText, images: pageImages };
    }

    return { text: fullText, images: [] };
  }

  if (isTXT) {
    const text = await file.text();
    if (!text || text.trim().length === 0) throw new Error("Text file is empty");
    return { text: text.trim(), images: [] };
  }

  if (isDOCX) {
    await ensureScript(MAMMOTH_CDN, "mammoth");
    const arrayBuffer = await file.arrayBuffer();
    let result;
    try {
      result = await window.mammoth.extractRawText({ arrayBuffer });
    } catch {
      throw new Error("Could not read this DOCX file. It may be corrupted or not a valid Word document.");
    }
    const text = (result.value || "").trim();
    if (!text) throw new Error("No text found in DOCX file");
    return { text, images: [] };
  }

  if (isPPTX) {
    await ensureScript(JSZIP_CDN, "JSZip");
    let zip;
    try {
      zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    } catch {
      throw new Error("Could not read this PPTX file. It may be corrupted or incomplete.");
    }
    let fullText = "";
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/i)?.[1] || "0", 10);
        const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || "0", 10);
        return na - nb;
      });
    for (const slideName of slideFiles) {
      try {
        const xml = await zip.files[slideName].async("string");
        const texts = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
        if (texts) {
          fullText += texts.map((t) => t.replace(/<[^>]+>/g, "")).join(" ") + "\n\n";
        }
      } catch {}
    }
    fullText = fullText.trim();
    if (!fullText) throw new Error("No text found in PPTX file");
    return { text: fullText, images: [] };
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, TXT, PPTX, or an image.");
}

/**
 * Chunk text into segments of approximately maxChars each.
 * Tries to split on paragraph boundaries.
 * @returns {string[]}
 */
export function chunkText(text, maxChars = 12000) {
  if (text.length <= maxChars) return [text];

  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChars) {
      if (current) chunks.push(current.trim());
      // If a single paragraph is too long, split by sentences
      if (para.length > maxChars) {
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        current = "";
        for (const sentence of sentences) {
          if ((current + sentence).length > maxChars) {
            if (current) chunks.push(current.trim());
            current = sentence;
          } else {
            current += sentence;
          }
        }
      } else {
        current = para;
      }
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
