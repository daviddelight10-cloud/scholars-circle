import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

const EMU_PER_PT = 914400 / 72;
const DEBUG = process.env.PPTX_TO_PDF_DEBUG === "true";

function logDebug(...args) {
  if (DEBUG) console.log("[pptxToPdf]", ...args);
}

function emuToPt(emu) {
  return Math.round(emu / EMU_PER_PT);
}

function parseColor(hex) {
  if (!hex) return rgb(0, 0, 0);
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function sanitizePdfText(text) {
  // Decompose accented characters and remove combining diacritics
  text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Map typographic ligatures to plain ASCII
  text = text
    .replace(/[\uFB00]/g, "ff")
    .replace(/[\uFB01]/g, "fi")
    .replace(/[\uFB02]/g, "fl")
    .replace(/[\uFB03]/g, "ffi")
    .replace(/[\uFB04]/g, "ffl")
    .replace(/[\uFB05\uFB06]/g, "st");

  // Map common smart punctuation to ASCII equivalents
  text = text
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u2022]/g, "*")
    .replace(/[\u00A0]/g, " ");

  // Normalize whitespace and strip control characters
  text = text
    .replace(/\r\n/g, " ")
    .replace(/[\r\n]/g, " ")
    .replace(/\t/g, "    ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Final safety net: any remaining character outside the WinAnsi/ASCII range
  // (printable ASCII 0x20-0x7E or Latin-1 Supplement 0xA0-0xFF) is replaced with a space.
  return text.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ");
}

function decodeXmlEntities(text) {
  return sanitizePdfText(
    text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  );
}

/**
 * Extract paragraphs from shape XML, preserving per-run formatting
 * (bold, font size, color) and paragraph alignment + line spacing.
 * Returns array of paragraphs, each with { runs, align, lineSpacingPct }
 */
function extractParagraphs(spXml) {
  const paragraphs = spXml.match(/<a:p[^>]*>[\s\S]*?<\/a:p>/g) || [];
  return paragraphs.map((paraXml) => {
    // Parse paragraph properties
    let align = "l"; // default left
    let lineSpacingPct = 120; // default 120%
    // Support both <a:pPr ...>...</a:pPr> and self-closing <a:pPr .../>
    const pPrMatch = paraXml.match(/<a:pPr([^>]*)>([\s\S]*?)<\/a:pPr>/);
    const pPrSelfClosingMatch = paraXml.match(/<a:pPr([^>]*?)\/>/);
    if (pPrMatch) {
      const attrs = pPrMatch[1];
      const algnMatch = attrs.match(/algn="(l|ctr|r|just)"/);
      if (algnMatch) align = algnMatch[1];
      const lnSpcMatch = pPrMatch[2].match(/<a:lnSpc>[\s\S]*?<a:spcPct val="(\d+)"/);
      if (lnSpcMatch) lineSpacingPct = parseInt(lnSpcMatch[1], 10) / 1000;
    } else if (pPrSelfClosingMatch) {
      const attrs = pPrSelfClosingMatch[1];
      const algnMatch = attrs.match(/algn="(l|ctr|r|just)"/);
      if (algnMatch) align = algnMatch[1];
    }

    // Parse runs
    const runs = [];
    const runXmls = paraXml.match(/<a:r[^>]*>[\s\S]*?<\/a:r>/g) || [];
    for (const runXml of runXmls) {
      const textMatch = runXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/);
      if (!textMatch) continue;
      const text = decodeXmlEntities(textMatch[1]);

      let isBold = false;
      let isItalic = false;
      let fontSize = 18;
      let color = rgb(0, 0, 0);

      const rPrMatch = runXml.match(/<a:rPr([^>]*)>/);
      if (rPrMatch) {
        const attrs = rPrMatch[1];
        isBold = /b="1"/.test(attrs) || /b="true"/.test(attrs);
        isItalic = /i="1"/.test(attrs) || /i="true"/.test(attrs);
        const sizeMatch = attrs.match(/sz="(\d+)"/);
        if (sizeMatch) fontSize = parseInt(sizeMatch[1], 10) / 100;
      }
      // Color is a child element of <a:rPr>, not an attribute — search the full runXml
      const colorMatch = runXml.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);
      if (colorMatch) color = parseColor(colorMatch[1]);

      if (text) {
        runs.push({ text, bold: isBold, italic: isItalic, fontSize, color });
      }
    }

    return { runs, align, lineSpacingPct };
  }).filter((p) => p.runs.length > 0);
}

/**
 * Parse shape fill color from <p:spPr>
 */
function getShapeFill(spXml) {
  const spPrMatch = spXml.match(/<p:spPr[\s\S]*?<\/p:spPr>/);
  if (!spPrMatch) return null;
  const spPr = spPrMatch[0];
  const solidFillMatch = spPr.match(/<a:solidFill>[\s\S]*?<a:srgbClr val="([0-9A-Fa-f]{6})"/);
  if (solidFillMatch) return parseColor(solidFillMatch[1]);
  return null;
}

function getShapeBounds(xml) {
  // Anchor to <p:spPr>, <p:grpSpPr>, <p:graphicFramePr>, or a direct <p:xfrm>
  // to avoid grabbing a nested child's <a:xfrm>.
  let spPrMatch = xml.match(/<p:(?:spPr|grpSpPr|graphicFramePr)[\s\S]*?<a:xfrm>([\s\S]*?)<\/a:xfrm>/);
  if (!spPrMatch) {
    spPrMatch = xml.match(/<p:xfrm>([\s\S]*?)<\/p:xfrm>/);
  }
  const xfrmContent = spPrMatch ? spPrMatch[1] : null;
  if (!xfrmContent) return null;
  const offMatch = xfrmContent.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
  const extMatch = xfrmContent.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  if (!offMatch || !extMatch) return null;
  return {
    x: emuToPt(parseInt(offMatch[1], 10)),
    y: emuToPt(parseInt(offMatch[2], 10)),
    width: emuToPt(parseInt(extMatch[1], 10)),
    height: emuToPt(parseInt(extMatch[2], 10)),
  };
}

function getPictureRId(picXml) {
  const blipMatch = picXml.match(/<a:blip r:embed="([^"]+)"/);
  return blipMatch ? blipMatch[1] : null;
}

function getImageFileName(relsXml, rId) {
  let relMatch = relsXml.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
  if (!relMatch) {
    relMatch = relsXml.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rId}"`));
  }
  if (!relMatch) return null;
  let target = relMatch[1];
  if (target.startsWith("../")) target = target.slice(3);
  return target;
}

function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    const w = font.widthOfTextAtSize(test, fontSize);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const result = [];
  for (const line of lines) {
    if (font.widthOfTextAtSize(line, fontSize) <= maxWidth) {
      result.push(line);
    } else {
      let chunk = "";
      for (const ch of line) {
        if (font.widthOfTextAtSize(chunk + ch, fontSize) > maxWidth && chunk) {
          result.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk) result.push(chunk);
    }
  }
  return result;
}

/**
 * Wrap a paragraph's runs into lines, preserving per-run formatting.
 * Each line is an array of { text, font, fontSize, color } segments.
 */
function wrapParagraphRuns(runs, helv, helvBold, helvItalic, helvBoldItalic, maxWidth) {
  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (const run of runs) {
    const font = run.bold
      ? (run.italic ? helvBoldItalic : helvBold)
      : (run.italic ? helvItalic : helv);
    const words = run.text.split(" ");

    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      const wordWidth = font.widthOfTextAtSize(word, run.fontSize);
      const spaceWidth = currentLine.length > 0 ? font.widthOfTextAtSize(" ", run.fontSize) : 0;
      const testWidth = currentWidth + spaceWidth + wordWidth;

      if (testWidth > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
      }

      if (currentLine.length > 0) {
        // Add space segment
        currentLine.push({ text: " ", font, fontSize: run.fontSize, color: run.color, width: spaceWidth });
        currentWidth += spaceWidth;
      }

      // Split long words by characters
      if (wordWidth > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          const chunkWidth = font.widthOfTextAtSize(chunk + ch, run.fontSize);
          if (chunkWidth > maxWidth && chunk) {
            currentLine.push({ text: chunk, font, fontSize: run.fontSize, color: run.color, width: font.widthOfTextAtSize(chunk, run.fontSize) });
            lines.push(currentLine);
            currentLine = [];
            currentWidth = 0;
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        if (chunk) {
          const chunkWidth = font.widthOfTextAtSize(chunk, run.fontSize);
          currentLine.push({ text: chunk, font, fontSize: run.fontSize, color: run.color, width: chunkWidth });
          currentWidth += chunkWidth;
        }
      } else {
        currentLine.push({ text: word, font, fontSize: run.fontSize, color: run.color, width: wordWidth });
        currentWidth += wordWidth;
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Parse top-level slide elements (p:sp, p:pic, p:grpSp) with proper nesting.
 * Uses a stack-based approach so nested p:grpSp inside p:grpSp is handled correctly.
 */
function parseTopLevelElements(xml) {
  const elements = [];
  // Match only actual element openings: tag name must be followed by > or whitespace
  // to avoid matching <p:spTree>, <p:spPr>, <p:grpSpPr> etc.
  const openTagRegex = /<(p:sp|p:pic|p:grpSp|p:cxnSp|p:graphicFrame)(?=\s|>)([\s\S]*?)>/g;
  logDebug("parseTopLevelElements: input length", xml.length);
  let match;
  while ((match = openTagRegex.exec(xml)) !== null) {
    const tag = match[1];
    const tagStart = match.index;
    const afterTag = openTagRegex.lastIndex;

    // Find the matching closing tag, accounting for nesting.
    // Use a regex that matches only actual element openings (tag name
    // followed by > or whitespace) to avoid matching child elements
    // like <p:spPr>, <p:spTree>, <p:grpSpPr> as nested <p:sp>/<p:grpSp>.
    const closeTag = `</${tag}>`;
    const nestedOpenRegex = new RegExp(`<${tag.replace(/:/g, '\\:')}(?:\\s|>)`, 'g');
    let depth = 1;
    let searchPos = afterTag;
    while (depth > 0 && searchPos < xml.length) {
      const nextClose = xml.indexOf(closeTag, searchPos);
      nestedOpenRegex.lastIndex = searchPos;
      const nestedMatch = nestedOpenRegex.exec(xml);
      const nextOpen = nestedMatch ? nestedMatch.index : -1;
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchPos = nestedOpenRegex.lastIndex;
      } else {
        depth--;
        searchPos = nextClose + closeTag.length;
      }
    }
    const contentEnd = searchPos - closeTag.length;
    const content = xml.slice(afterTag, contentEnd);
    elements.push({ tag, content });
    openTagRegex.lastIndex = searchPos;
  }
  logDebug("parseTopLevelElements: found", elements.length, "elements");
  return elements;
}

/**
 * Recursively process slide elements (shapes, pictures, groups).
 * Supports p:sp, p:pic, and p:grpSp with nested children.
 */
async function processElements(slideXml, page, pdfDoc, zip, relsXml, imageCache, slideWidthPt, slideHeightPt, offsetX, offsetY, helv, helvBold, helvItalic, helvBoldItalic) {
  logDebug("processElements: offsetX", offsetX, "offsetY", offsetY, "slideHeightPt", slideHeightPt);
  const elements = parseTopLevelElements(slideXml);
  for (const { tag, content } of elements) {

    if (tag === "p:grpSp") {
      // Get group bounds for offset
      const grpBounds = getShapeBounds(content);
      const grpOffsetX = (grpBounds?.x || 0) + offsetX;
      const grpOffsetY = (grpBounds?.y || 0) + offsetY;

      // Recursively process child elements inside the group
      await processElements(content, page, pdfDoc, zip, relsXml, imageCache, slideWidthPt, slideHeightPt, grpOffsetX, grpOffsetY, helv, helvBold, helvItalic, helvBoldItalic);
    } else if (tag === "p:pic") {
      const bounds = getShapeBounds(content);
      const rId = getPictureRId(content);
      if (!bounds || !rId) continue;

      const imageFileName = getImageFileName(relsXml, rId);
      if (!imageFileName) continue;

      const fullPath = `ppt/${imageFileName}`.replace(/\.\.\//g, "");
      if (!zip.files[fullPath]) continue;

      let img;
      if (imageCache.has(fullPath)) {
        img = imageCache.get(fullPath);
      } else {
        const imgBuffer = await zip.files[fullPath].async("uint8array");
        try {
          if (fullPath.match(/\.png$/i)) {
            img = await pdfDoc.embedPng(imgBuffer);
          } else if (fullPath.match(/\.(jpg|jpeg)$/i)) {
            img = await pdfDoc.embedJpg(imgBuffer);
          } else {
            continue;
          }
          imageCache.set(fullPath, img);
        } catch (e) {
          console.warn(`[pptxToPdf] Failed to embed image ${fullPath}:`, e.message);
          continue;
        }
      }

      const drawX = bounds.x + offsetX;
      const drawY = slideHeightPt - (bounds.y + offsetY) - bounds.height;
      page.drawImage(img, {
        x: drawX,
        y: drawY,
        width: bounds.width,
        height: bounds.height,
      });
    } else if (tag === "p:sp" || tag === "p:cxnSp" || tag === "p:graphicFrame") {
      let bounds = getShapeBounds(content);
      if (!bounds) {
        logDebug("No bounds for", tag, "— using full-page fallback");
        bounds = { x: 0, y: 0, width: slideWidthPt, height: slideHeightPt };
      }

      const paragraphs = extractParagraphs(content);
      if (paragraphs.length === 0) {
        logDebug("No paragraphs in", tag, "— skipping");
        continue;
      }
      logDebug("Drawing", tag, "bounds:", bounds, "paragraphs:", paragraphs.length);

      const drawX = bounds.x + offsetX;
      const drawY = bounds.y + offsetY;
      const shapeWidth = bounds.width;
      const shapeHeight = bounds.height;

      // Draw shape background if present
      const fillColor = getShapeFill(content);
      if (fillColor) {
        page.drawRectangle({
          x: drawX,
          y: slideHeightPt - drawY - shapeHeight,
          width: shapeWidth,
          height: shapeHeight,
          color: fillColor,
        });
      }

      // Text rendering: top-to-bottom
      const padding = 4;
      const textLeft = drawX + padding;
      const textTop = slideHeightPt - drawY - padding; // top of text area (pdf-lib y)
      const textBottom = slideHeightPt - drawY - shapeHeight + padding;
      const maxWidth = shapeWidth - padding * 2;

      let cursorY = textTop;

      for (const para of paragraphs) {
        const lineSpacing = para.lineSpacingPct / 100;
        const maxFontSize = Math.max(...para.runs.map((r) => r.fontSize));
        const lineHeight = maxFontSize * lineSpacing;

        // Wrap runs into lines with per-run formatting
        const lines = wrapParagraphRuns(para.runs, helv, helvBold, helvItalic, helvBoldItalic, maxWidth);

        for (const lineSegments of lines) {
          if (cursorY - lineHeight < textBottom) break;

          // Calculate total line width for alignment
          const totalWidth = lineSegments.reduce((sum, s) => sum + s.width, 0);

          let lineX = textLeft;
          if (para.align === "ctr") {
            lineX = textLeft + (maxWidth - totalWidth) / 2;
          } else if (para.align === "r") {
            lineX = textLeft + (maxWidth - totalWidth);
          }

          // Draw each segment
          for (const seg of lineSegments) {
            page.drawText(seg.text, {
              x: lineX,
              y: cursorY - seg.fontSize,
              size: seg.fontSize,
              font: seg.font,
              color: seg.color,
            });
            lineX += seg.width;
          }

          cursorY -= lineHeight;
        }

        // Extra spacing between paragraphs
        cursorY -= maxFontSize * 0.3;
      }
    }
  }
}

async function findSoffice() {
  const candidates = [
    "soffice",
    "libreoffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/snap/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 2000 });
      return candidate;
    } catch {
      // continue searching
    }
  }
  return null;
}

async function convertWithLibreOffice(pptxBuffer) {
  const soffice = await findSoffice();
  if (!soffice) return null;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-conv-"));
  const pptxPath = path.join(tmpDir, "input.pptx");
  const pdfPath = path.join(tmpDir, "input.pdf");
  // Use a separate LibreOffice user profile per conversion to avoid lock files
  const userProfileUrl = "file:///" + tmpDir.replace(/\\/g, "/").replace(/\/$/, "");

  try {
    await fs.writeFile(pptxPath, pptxBuffer);

    logDebug("Using LibreOffice for conversion:", soffice);
    const { stdout, stderr } = await execFileAsync(
      soffice,
      [
        "-env:UserInstallation=" + userProfileUrl,
        "--headless",
        "--invisible",
        "--norestore",
        "--nolockcheck",
        "--convert-to",
        "pdf",
        "--outdir",
        tmpDir,
        pptxPath,
      ],
      { timeout: 120000 }
    );

    const stats = await fs.stat(pdfPath).catch(() => null);
    if (!stats || stats.size === 0) {
      logDebug("LibreOffice produced no PDF output");
      return null;
    }

    const pdfBuffer = await fs.readFile(pdfPath);
    logDebug("LibreOffice conversion successful, PDF size:", pdfBuffer.length);
    return pdfBuffer;
  } catch (err) {
    logDebug("LibreOffice conversion failed:", err.message);
    if (err.stderr) logDebug("LibreOffice stderr:", err.stderr);
    return null;
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function pptxToPdf(pptxBuffer) {
  // Try LibreOffice headless first — highest fidelity
  const librePdf = await convertWithLibreOffice(pptxBuffer);
  if (librePdf) return librePdf;

  // Fallback to JSZip/pdf-lib parser
  logDebug("LibreOffice not available, falling back to JSZip parser");
  return pptxToPdfFallback(pptxBuffer);
}

async function pptxToPdfFallback(pptxBuffer) {
  const zip = await JSZip.loadAsync(pptxBuffer);

  // Read presentation.xml for slide dimensions
  const presXmlFile = zip.file("ppt/presentation.xml");
  let slideWidthPt = 720;
  let slideHeightPt = 540;
  if (presXmlFile) {
    const presXml = await presXmlFile.async("string");
    const sldSizeMatch = presXml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
    if (sldSizeMatch) {
      slideWidthPt = emuToPt(parseInt(sldSizeMatch[1], 10));
      slideHeightPt = emuToPt(parseInt(sldSizeMatch[2], 10));
    }
  }

  // Get sorted list of slide files
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/i)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || "0", 10);
      return na - nb;
    });

  if (slideFiles.length === 0) throw new Error("No slides found in PPTX");

  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helvBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const imageCache = new Map();

  for (const slidePath of slideFiles) {
    const slideXml = await zip.files[slidePath].async("string");
    const slideNum = slidePath.match(/slide(\d+)/i)?.[1] || "1";

    // Read slide rels for image references
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    let relsXml = "";
    if (zip.files[relsPath]) {
      relsXml = await zip.files[relsPath].async("string");
    }

    const page = pdfDoc.addPage([slideWidthPt, slideHeightPt]);

    // White background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: slideWidthPt,
      height: slideHeightPt,
      color: rgb(1, 1, 1),
    });

    // Parse all elements (shapes, pictures, groups) recursively
    await processElements(
      slideXml, page, pdfDoc, zip, relsXml, imageCache,
      slideWidthPt, slideHeightPt, 0, 0,
      helv, helvBold, helvItalic, helvBoldItalic
    );
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
