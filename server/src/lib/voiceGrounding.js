import fs from "fs";
import path from "path";
import os from "os";

const CHUNK_SIZE = 12000;
const CHUNK_OVERLAP = 500;

const GEMINI_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

export function getLiveModel() {
  return process.env.GEMINI_LIVE_MODEL || GEMINI_LIVE_MODEL;
}

export function getGeminiLiveWsUrl() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured on the server");
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;
}

export function getGeminiLiveWsOptions() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured on the server");
  return {
    headers: {
      "x-goog-api-key": key,
    },
  };
}

async function downloadFile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractPdfText(buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function extractDocxText(buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractPptxText(buffer) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)/)[1], 10);
      return na - nb;
    });
  const texts = [];
  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("text");
    const textNodes = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const slideText = textNodes
      .map((t) => t.replace(/<a:t>/, "").replace(/<\/a:t>/, ""))
      .join(" ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
    texts.push(slideText);
  }
  return texts.join("\n\n");
}

async function extractTxtText(buffer) {
  return buffer.toString("utf-8");
}

export async function extractTextFromFile(fileUrl, mimeType, fileName) {
  const buffer = await downloadFile(fileUrl);
  const ext = (fileName || "").toLowerCase().split(".").pop() || "";
  const type = mimeType || "";

  if (type === "application/pdf" || ext === "pdf") {
    return extractPdfText(buffer);
  }
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return extractDocxText(buffer);
  }
  if (
    type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    return extractPptxText(buffer);
  }
  if (
    type === "application/msword" ||
    ext === "doc"
  ) {
    return extractDocxText(buffer);
  }
  // Fallback: treat as text
  return extractTxtText(buffer);
}

export function chunkText(text, maxChars = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= maxChars) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = start + maxChars;
    if (end < clean.length) {
      const lastPara = clean.lastIndexOf("\n\n", end);
      const lastSentence = clean.lastIndexOf(". ", end);
      if (lastPara > start + maxChars * 0.5) end = lastPara;
      else if (lastSentence > start + maxChars * 0.5) end = lastSentence + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    start = end - overlap;
    if (start < 0) start = 0;
    if (start >= clean.length) break;
  }
  return chunks;
}

const MODE_INSTRUCTIONS = {
  teach: `You are in TEACH mode. Explain concepts from the document clearly and thoroughly. Break down complex topics into digestible parts. Use short analogies when helpful. Ask the student if they understand before moving to the next concept.`,
  quiz: `You are in QUIZ mode. Ask the student questions based ONLY on the document content. Wait for their answer, then provide feedback. Start with easier questions and progressively increase difficulty. Explain why it was correct or incorrect using only the document.`,
  discuss: `You are in DISCUSS mode. Have a natural conversation about the document topics. Encourage the student to think critically. Ask short follow-up questions that probe deeper into the material.`,
};

export function buildVoiceSystemPrompt(chunks, mode = "teach", resourceTitle = "") {
  const modeInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.teach;
  const documentContext = chunks
    .map((chunk, i) => `--- Document Excerpt ${i + 1} ---\n${chunk}`)
    .join("\n\n");

  return `You are Scholar's Circle Voice Tutor, a highly empathetic and conversational AI study companion for medical students.

${modeInstruction}

CRITICAL GROUNDING RULES — VIOLATION OF THESE RULES IS A SYSTEM FAILURE:
1. You may ONLY use information from the document excerpts provided below.
2. If the answer to a question is NOT found in the document excerpts, you MUST say: "I couldn't find that in your materials. Please check your document or upload additional resources."
3. NEVER use your general knowledge, training data, or any external information to answer questions.
4. NEVER invent, hallucinate, or fabricate information that is not explicitly stated in the document.
5. If you are unsure whether something is in the document, err on the side of saying you couldn't find it.
6. When quoting or referencing information, indicate which part of the document it comes from.
7. Stay within the scope of the document. Do not go off-topic or bring in outside concepts.

CONVERSATIONAL & HUMAN-LIKE STYLE:
- Speak in a warm, encouraging, conversational tone, like a friendly peer tutor.
- VERY IMPORTANT: Frequently use natural conversational fillers at the start of your responses (e.g., "Hmm", "Ah", "Let's see", "Got it", "Right", "Okay", "Yeah").
- Use clear, simple language. Avoid jargon unless it's defined in the document.
- Keep responses EXTREMELY concise (1-3 short sentences max) since this is a fast-paced voice conversation.
- Pause naturally to let the student absorb information.
- Use the student's name if they introduce themselves.

The student is studying: ${resourceTitle || "an uploaded document"}

DOCUMENT EXCERPTS (your ONLY source of truth):
${documentContext}

Remember: You are strictly limited to the content above. If it's not in the excerpts, you cannot answer it. Keep it very conversational, brief, and human-sounding.`;
}

export function extractConceptsFromChunks(chunks, maxConcepts = 12) {
  const concepts = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const sentences = chunk.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 10 || trimmed.length > 80) continue;

      const lower = trimmed.toLowerCase();
      if (
        lower.startsWith("this ") ||
        lower.startsWith("these ") ||
        lower.startsWith("the following") ||
        lower.startsWith("figure ") ||
        lower.startsWith("table ") ||
        lower.startsWith("page ")
      )
        continue;

      const key = lower.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);

      if (/^[A-Z][a-z]/.test(trimmed) && !trimmed.endsWith(":")) {
        concepts.push(trimmed);
      }
      if (concepts.length >= maxConcepts) break;
    }
    if (concepts.length >= maxConcepts) break;
  }

  return concepts;
}
