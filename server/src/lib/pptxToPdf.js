import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// PPTX uses EMU (English Metric Units): 914400 EMU = 1 inch = 72 pt
const EMU_PER_PT = 914400 / 72;
// Default slide dimensions (10in x 7.5in = 720pt x 540pt for 4:3)
// 16:9 is 13.333in x 7.5in = 960pt x 540pt

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

// Extract text runs from a shape's XML, preserving formatting
function extractTextRuns(spXml) {
  const runs = [];
  const paragraphs = spXml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
  for (const paraXml of paragraphs) {
    const textRuns = paraXml.match(/<a:r>[\s\S]*?<\/a:r>/g) || [];
    let paraText = "";
    let isBold = false;
    let fontSize = 18; // default 18pt
    let color = rgb(0, 0, 0);

    for (const runXml of textRuns) {
      const textMatch = runXml.match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (!textMatch) continue;
      const text = textMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      const rPrMatch = runXml.match(/<a:rPr([^>]*)>/);
      if (rPrMatch) {
        const attrs = rPrMatch[1];
        isBold = /b="1"/.test(attrs) || /b="true"/.test(attrs);
        const sizeMatch = attrs.match(/sz="(\d+)"/);
        if (sizeMatch) fontSize = parseInt(sizeMatch[1], 10) / 100;
        const colorMatch = attrs.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);
        if (colorMatch) color = parseColor(colorMatch[1]);
      }

      paraText += text;
    }

    if (paraText.trim()) {
      runs.push({ text: paraText, bold: isBold, fontSize, color });
    }
  }
  return runs;
}

// Extract offset and extent from a shape/picture's <p:spPr> or <p:xfrm>
function getShapeBounds(xml) {
  const xfrmMatch = xml.match(/<a:xfrm>([\s\S]*?)<\/a:xfrm>/);
  if (!xfrmMatch) return null;
  const offMatch = xfrmMatch[1].match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
  const extMatch = xfrmMatch[1].match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  if (!offMatch || !extMatch) return null;
  return {
    x: emuToPt(parseInt(offMatch[1], 10)),
    y: emuToPt(parseInt(offMatch[2], 10)),
    width: emuToPt(parseInt(extMatch[1], 10)),
    height: emuToPt(parseInt(extMatch[2], 10)),
  };
}

// Get image relationship ID from a picture element
function getPictureRId(picXml) {
  const blipMatch = picXml.match(/<a:blip r:embed="([^"]+)"/);
  return blipMatch ? blipMatch[1] : null;
}

// Get image filename from slide rels
function getImageFileName(relsXml, rId) {
  // Try Id before Target, then Target before Id (different PPTX generators order differently)
  let relMatch = relsXml.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
  if (!relMatch) {
    relMatch = relsXml.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rId}"`));
  }
  if (!relMatch) return null;
  let target = relMatch[1];
  if (target.startsWith("../")) target = target.slice(3);
  return target;
}

// Wrap text to fit within a given width. Long words are character-split as fallback.
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
  // Fallback: if any single line exceeds maxWidth, split by characters
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

export async function pptxToPdf(pptxBuffer) {
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

  // Cache for embedded images
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

    // Parse shapes (text boxes) and pictures in order
    // Match both <p:sp>...</p:sp> and <p:pic>...</p:pic>
    const elementRegex = /<(p:sp|p:pic)([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = elementRegex.exec(slideXml)) !== null) {
      const tag = match[1];
      const content = match[2];

      if (tag === "p:pic") {
        // Picture element — embed image at position
        const bounds = getShapeBounds(content);
        const rId = getPictureRId(content);
        if (!bounds || !rId) continue;

        const imageFileName = getImageFileName(relsXml, rId);
        if (!imageFileName) continue;

        const fullPath = `ppt/${imageFileName}`.replace(/\.\.\//g, "");
        if (!zip.files[fullPath]) continue;

        // Check cache
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

        // Draw image at position (pdf-lib uses bottom-left origin, PPTX uses top-left)
        page.drawImage(img, {
          x: bounds.x,
          y: slideHeightPt - bounds.y - bounds.height,
          width: bounds.width,
          height: bounds.height,
        });
      } else if (tag === "p:sp") {
        // Shape element — extract and draw text
        const bounds = getShapeBounds(content);
        if (!bounds) continue;

        const textRuns = extractTextRuns(content);
        if (textRuns.length === 0) continue;

        let textY = slideHeightPt - bounds.y - bounds.height;
        const textX = bounds.x + 4;
        const maxWidth = bounds.width - 8;

        for (const run of textRuns) {
          const font = run.bold ? helvBold : helv;
          const lines = wrapText(run.text, font, run.fontSize, maxWidth);
          for (const line of lines) {
            if (textY + run.fontSize > slideHeightPt - bounds.y) break;
            page.drawText(line, {
              x: textX,
              y: textY + run.fontSize,
              size: run.fontSize,
              font,
              color: run.color,
            });
            textY += run.fontSize * 1.2;
          }
          textY += 2;
        }
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
