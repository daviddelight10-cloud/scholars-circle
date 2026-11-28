// Fetch a resource's PDF bytes, hash them, extract a single page's text, and
// build a one-page PDF for Gemini. Sending the page as a real PDF (not a
// client-rendered image) keeps the shared cache un-poisonable — the server
// sees exactly the bytes the student is reading.
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import pdfParse from "pdf-parse";

export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

const bytesCache = new Map(); // resourceId -> { buf, at } — avoid re-downloading the same lecture
const BYTES_TTL = 10 * 60 * 1000;

export async function fetchPdfBytes(resource) {
  const hit = bytesCache.get(resource.id);
  if (hit && Date.now() - hit.at < BYTES_TTL) return hit.buf;
  const url = resource.fileUrl;
  if (!url || !/^https?:\/\//.test(url)) throw new Error("Resource has no downloadable file");
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) }); // bound the download — large files over slow storage links
  if (!res.ok) throw new Error(`Could not fetch PDF (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  bytesCache.set(resource.id, { buf, at: Date.now() });
  if (bytesCache.size > 20) { // simple eviction
    const oldest = [...bytesCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) bytesCache.delete(oldest[0]);
  }
  return buf;
}

const textCache = new Map(); // `${resourceId}` -> { pages, at }

// pdf-parse extracts whole-doc text; the custom pagerender splits it per page.
export async function pageTexts(buf, resourceId = "anon") {
  const hit = textCache.get(resourceId);
  if (hit && Date.now() - hit.at < BYTES_TTL) return hit.pages;
  const pages = [];
  const data = await pdfParse(buf, {
    pagerender: (pageData) => pageData.getTextContent().then((tc) => {
      pages.push(tc.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim());
      return "";
    }),
  });
  const n = Math.max(pages.length, data?.numpages || pages.length);
  const result = Array.from({ length: n }, (_, i) => pages[i] || "");
  textCache.set(resourceId, { pages: result, at: Date.now() });
  if (textCache.size > 20) textCache.clear();
  return result;
}

export const MAX_PAGE_TEXT = 6000; // cap what reaches the model
export const MAX_DOC_CONTEXT = 8000; // cap the whole-doc digest

// Whole-document digest for lesson generation: one ~180-char preview per page
// so the model knows where the current page sits in the material ("as
// introduced on p.2"). pageTexts() is already 10-min cached per resourceId —
// the whole-doc parse happens once per document, not per explain call.
export async function docDigest(buf, resourceId = "anon") {
  const pages = await pageTexts(buf, resourceId);
  const parts = [];
  let used = 0;
  for (let i = 0; i < pages.length; i++) {
    const preview = (pages[i] || "").slice(0, 180).trim();
    if (!preview) continue; // scanned/blank pages contribute nothing readable
    const line = `[p${i + 1}] ${preview}`;
    if (used + line.length > MAX_DOC_CONTEXT) break;
    parts.push(line);
    used += line.length;
  }
  return parts.join("\n");
}

// One-page PDF (the "best option" input): the model sees the exact page —
// layout, diagrams, handwriting — with no client-supplied image to poison.
export async function singlePagePdfBase64(buf, page /* 1-based */) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pageCount = src.getPageCount();
  if (page < 1 || page > pageCount) throw new Error(`Page ${page} out of range (1-${pageCount})`);
  const out = await PDFDocument.create();
  const [p] = await out.copyPages(src, [page - 1]);
  out.addPage(p);
  const bytes = await out.save({ useObjectStreams: true });
  return { base64: Buffer.from(bytes).toString("base64"), pageCount };
}
