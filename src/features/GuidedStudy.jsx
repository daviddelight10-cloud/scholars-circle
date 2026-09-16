import React, { useState, useEffect, useRef } from "react";
import { callAI } from "../lib/aiClient";
import MarkdownText from "../components/MarkdownText.jsx";
import { getStudyCache, saveStudyCache, clearStudyCache, recordGuidedProgress } from "../lib/studyCache.js";
import { useComboStreak } from "../lib/useComboStreak.js";
import { haptics } from "../lib/haptics.js";
import { api } from "../lib/appUtils.js";
import { XP_PER_CORRECT, STREAK_BONUS } from "../data.js";

// ─── Session history helpers ────────────────────────────────────────────────────
const SESSIONS_KEY = "sc_guided_sessions";
function loadSessions() { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]"); } catch { return []; } }
function saveSession(entry) {
  try {
    const sessions = loadSessions().filter(s => s.topic !== entry.topic).slice(0, 19);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([entry, ...sessions]));
  } catch {}
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:     "#0A0D13",
  card:   "#151A24",
  bar:    "#11151E",
  accent: "#191F2C",
  border: "#FFD700",
  line:   "rgba(255,255,255,0.09)",
  line2:  "rgba(255,255,255,0.05)",
  text:   "#EDEFF5",
  muted:  "#9AA3B5",
  hint:   "#646E84",
  faint:  "#2A3242",
  green:  "#3DD68C",
  red:    "#FF5470",
  amber:  "#F5A623",
};

const STYLES = `
  @keyframes gs-spin { to { transform: rotate(360deg); } }
  @keyframes gs-slide-in { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
  .gs-history-panel { animation: gs-slide-in 0.25s ease; }
  @keyframes gs-in   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes gs-pop  { 0%{transform:scale(0.95);opacity:0} 100%{transform:scale(1);opacity:1} }
  .gs-animate { animation: gs-in 0.3s ease forwards; }
  .gs-pop     { animation: gs-pop 0.25s ease forwards; }
`;

// ─── Content analysis helpers ──────────────────────────────────────────────────
const CONTENT_LIMIT = 48000;         // max chars sent to the roadmap prompt (~12k tokens)
const SECTION_CONTENT_LIMIT = 24000; // max chars of source sent per section explanation

function estimateSectionCount(content) {
  if (!content || typeof content !== "string" || !content.trim()) return { min: 5, max: 7, hint: "" };
  const words = content.trim().split(/\s+/).length;
  // ~1 section per 300 words of source, floor 7, cap 30 — documents should
  // break into many granular sections (Gizmo-style), never merge to fit a cap.
  const ideal = Math.round(words / 300);
  const clamped = Math.max(7, Math.min(30, ideal));
  const min = Math.max(7, clamped - 1);
  const max = Math.min(34, clamped + 2);
  const hint = words > 200
    ? ` The student provided ~${words} words of content. Ensure every key topic in the document gets its own section — do NOT skip or merge topics.`
    : "";
  return { min, max, hint };
}

// ─── AI helpers ────────────────────────────────────────────────────────────────
function extractJSON(text) {
  try { const s = text.indexOf("{"), e = text.lastIndexOf("}") + 1; if (s !== -1) return JSON.parse(text.slice(s, e)); } catch {}
  try { const s = text.indexOf("["), e = text.lastIndexOf("]") + 1; if (s !== -1) return JSON.parse(text.slice(s, e)); } catch {}
  return null;
}

// Scan text for balanced {...} regions and return each that parses as an object.
// Salvages individual objects even when the surrounding JSON is malformed or truncated.
function extractObjectsLoose(text) {
  const objs = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      let depth = 0, inStr = false, esc = false, j = i;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
      }
      if (depth === 0) {
        try {
          const obj = JSON.parse(text.slice(i, j));
          if (obj && typeof obj === "object" && !Array.isArray(obj)) objs.push(obj);
        } catch {}
        i = j;
      } else i++;
    } else i++;
  }
  return objs;
}

// Tolerant extractor for the structured explain payload. Handles code fences,
// the AI writing "check": [ ... ] instead of { ... }, and truncated output
// (salvages complete chunks). Returns { tldr, chunks } or null.
function extractStudyJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  // Normalize the AI's common mistake: "check" written with [ ] instead of { }.
  // After the swap, a leftover "]" sits outside the object and is ignored by the
  // balanced-brace scan below.
  cleaned = cleaned
    .replace(/"check"\s*:\s*\[\s*\{/g, '"check": {')
    .replace(/"check"\s*:\s*\[/g, '"check": {');
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  const text = cleaned.slice(start);

  // Fast path: whole object parses cleanly
  const end = text.lastIndexOf("}");
  if (end !== -1) {
    try {
      const obj = JSON.parse(text.slice(0, end + 1));
      if (obj && Array.isArray(obj.chunks) && obj.chunks.length) return obj;
    } catch {}
  }

  // Salvage path: recover each chunk-shaped object individually
  const tldrMatch = text.match(/"tldr"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  let tldr = "";
  if (tldrMatch) { try { tldr = JSON.parse(`"${tldrMatch[1]}"`); } catch { tldr = tldrMatch[1]; } }
  const chunks = extractObjectsLoose(text)
    .filter(o => !o.chunks && (o.markdown || o.text || o.heading));
  return chunks.length ? { tldr, chunks } : null;
}

// Short fingerprint of source content — lets document sessions be cached under a
// key unique to the material, so reopening the same file hits the cache while a
// different document with the same title doesn't collide.
function contentHash(str) {
  const s = str.trim();
  const sample = s.length > 16000 ? s.slice(0, 8000) + s.slice(-8000) : s;
  let h = 5381;
  for (let i = 0; i < sample.length; i++) h = ((h << 5) + h + sample.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + s.length.toString(36);
}

function docCacheKey(topicStr, content) {
  return content && content.trim() ? `${topicStr.trim()} ::doc:${contentHash(content)}` : topicStr.trim();
}

// Pick the slice of a long document most relevant to a section: start from the
// section's proportional position in the document, then snap toward where its
// title keywords actually appear. This way every section of a long document is
// grounded in its own part of the source instead of everyone seeing only the
// first N characters.
function sectionContentSlice(source, section, sectionIdx, sectionCount) {
  if (source.length <= SECTION_CONTENT_LIMIT) return source;
  const win = Math.min(SECTION_CONTENT_LIMIT, Math.ceil((source.length / Math.max(1, sectionCount)) * 1.6));
  let center = Math.floor(((sectionIdx + 0.5) / Math.max(1, sectionCount)) * source.length);
  const terms = String(section?.title || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4);
  if (terms.length) {
    const lower = source.toLowerCase();
    const hits = terms.map(t => lower.indexOf(t)).filter(p => p !== -1).sort((a, b) => a - b);
    if (hits.length) center = hits[Math.floor(hits.length / 2)];
  }
  const start = Math.max(0, Math.min(source.length - win, Math.floor(center - win / 2)));
  return source.slice(start, start + win);
}

// Extract a compact outline (heading-like lines) from a document. Lets the
// roadmap cover the WHOLE document even when only the first CONTENT_LIMIT
// chars fit in the prompt — later sections can still be named and ordered.
function extractOutline(source) {
  const heads = [];
  const seen = new Set();
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line.length < 4 || line.length > 90) continue;
    const isMd    = /^#{1,4}\s+\S/.test(line);
    const isNum   = /^(\d+(\.\d+)*[.):]?|chapter|section|unit|part|module|lesson|topic)\s+\S/i.test(line);
    const isCaps  = line === line.toUpperCase() && /[A-Z]{4,}/.test(line) && line.length <= 70;
    const isLabel = line.length <= 60 && /:$/.test(line) && line.split(/\s+/).length <= 8;
    if (!(isMd || isNum || isCaps || isLabel)) continue;
    const h = line.replace(/^#+\s*/, "").replace(/:$/, "");
    const k = h.toLowerCase();
    if (!seen.has(k)) { seen.add(k); heads.push(h); }
    if (heads.length >= 60) break;
  }
  return heads.join("\n");
}

// ─── Check (MCQ) normalization ─────────────────────────────────────────────────
function shuffleCheckOptions(check) {
  const order = check.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { ...check, options: order.map(i => check.options[i]), answer: order.indexOf(check.answer) };
}

function normalizeCheck(c) {
  if (Array.isArray(c)) c = c[0]; // AI sometimes wraps check in an array
  if (!c || !Array.isArray(c.options) || c.options.length < 2) return null;
  const answer = typeof c.answer === "number"
    ? c.answer
    : "abcd".indexOf(String(c.answer || "").trim().toLowerCase().charAt(0));
  if (answer < 0 || answer >= c.options.length) return null;
  return shuffleCheckOptions({
    question: String(c.question || ""),
    options: c.options.map(o => String(o)),
    answer,
    why: String(c.why || c.explanation || ""),
  });
}

function normalizeChunk(chunk) {
  if (!chunk) return null;
  const markdown = String(chunk.markdown || chunk.text || "");
  if (!markdown.trim()) return null;
  return { heading: String(chunk.heading || ""), markdown, check: normalizeCheck(chunk.check) };
}

// ─── Context helpers ──────────────────────────────────────────────────────────
function buildContextBlock(ctx) {
  if (!ctx) return "";
  const parts = [];
  if (ctx.matches?.length > 0) {
    const docList = ctx.matches.map(m => `- "${m.title}" (${m.contentType})`).join("\n");
    parts.push(`The student has these study materials available:\n${docList}\nBase your roadmap sections on the content of these materials where relevant.`);
  }
  if (ctx.subtopics?.length > 0) {
    parts.push(`The curriculum defines these subtopics that should be covered:\n${ctx.subtopics.map(s => `- ${s}`).join("\n")}\nStructure your roadmap to cover each of these subtopics.`);
  }
  if (ctx.prerequisiteTitles?.length > 0) {
    parts.push(`The student has already studied these prerequisite topics: ${ctx.prerequisiteTitles.join(", ")}. You can reference and build upon these.`);
  }
  if (ctx.progress) {
    const p = ctx.progress;
    if (p.avgRetrievability > 0) {
      const pct = Math.round(p.avgRetrievability * 100);
      parts.push(`The student's current mastery: ${p.label} (${pct}% retrievability, ${p.totalItems} review items). ${pct > 70 ? "Focus on advanced application and edge cases." : pct > 30 ? "Balance review of fundamentals with new concepts." : "Start from fundamentals and build up carefully."}`);
    }
  }
  return parts.length > 0 ? `\n\nContext:\n${parts.join("\n\n")}` : "";
}

function buildDifficultyLevel(ctx) {
  if (!ctx?.progress) return "";
  const r = ctx.progress.avgRetrievability || 0;
  if (r > 0.7) return " Generate challenging application-level questions that test deep understanding.";
  if (r > 0.3) return " Generate moderate-difficulty questions mixing recall and application.";
  return " Generate easier recall-focused questions to build foundational understanding.";
}

function buildPrevSectionBlock(prevSection, studiedTitles) {
  const parts = [];
  if (prevSection) {
    parts.push(`The student just finished studying "${prevSection.title}". Connect this explanation to what they just learned.`);
  }
  if (studiedTitles?.length > 0) {
    parts.push(`Sections already covered: ${studiedTitles.join(", ")}. Reference these where relevant to reinforce learning.`);
  }
  return parts.length > 0 ? `\n\n${parts.join(" ")}` : "";
}

async function aiRoadmap(topic, aiConfig, ctx, sourceContent = "") {
  const ctxBlock = buildContextBlock(ctx);
  const contentSlice = sourceContent.trim() ? sourceContent.slice(0, CONTENT_LIMIT) : "";
  const { min, max, hint } = estimateSectionCount(sourceContent);
  const contentBlock = contentSlice
    ? `\n\nThe student provided the following study material. Your roadmap MUST cover ALL topics in this document — do not skip any section or concept. Derive each section title from the material's own headings and content, following the document's order:\n"""\n${contentSlice}\n"""`
    : "";
  const outline = contentSlice && sourceContent.length > CONTENT_LIMIT ? extractOutline(sourceContent) : "";
  const outlineBlock = outline
    ? `\n\nThe material continues beyond the excerpt above. Here is its complete outline — your roadmap MUST include sections covering every heading in this outline, not just the excerpt:\n"""\n${outline}\n"""`
    : "";
  const raw = await callAI(
    `You are an expert educator. Generate a structured learning roadmap for: "${topic}"${ctxBlock}${contentBlock}${outlineBlock}
Reply ONLY with valid JSON (no markdown):
{"title":"topic title","description":"2-sentence engaging overview of what the student will learn","sections":[{"id":1,"title":"Section title","summary":"1 sentence describing what this covers"},{"id":2,"title":"...","summary":"..."}]}
Include ${min}-${max} sections. Each section should cover one coherent concept or chunk of content that a student can absorb in a single sitting. Order from foundational to advanced. Keep summaries under 12 words. Use clear, specific section titles (not generic like "Introduction").${hint}`,
    aiConfig
  );
  return extractJSON(raw);
}

// Returns { tldr, chunks:[{heading, markdown, check}] } on success,
// or { text } as a fallback when the AI doesn't return valid structured JSON.
async function aiExplain(topic, section, aiConfig, ctx, prevSection, studiedTitles, sourceContent = "", sectionIdx = 0, sectionCount = 1) {
  const ctxBlock = buildContextBlock(ctx);
  const prevBlock = buildPrevSectionBlock(prevSection, studiedTitles);
  const docHint = ctx?.matches?.length > 0
    ? ` Reference the student's materials (${ctx.matches.map(m => m.title).join(", ")}) where relevant.`
    : "";
  const slice = sourceContent.trim() ? sectionContentSlice(sourceContent, section, sectionIdx, sectionCount) : "";
  const contentBlock = slice
    ? `\n\nThe student provided study material — here is the excerpt most relevant to this section${sourceContent.length > SECTION_CONTENT_LIMIT ? ` (~excerpt ${sectionIdx + 1} of ${sectionCount})` : ""}. Base your explanation on this content:\n"""\n${slice}\n"""`
    : "";
  const raw = await callAI(
    `You are an expert tutor teaching "${topic}". Teach this section: "${section.title}"${ctxBlock}${prevBlock}${docHint}${contentBlock}

Reply ONLY with valid JSON (no markdown fences) in this exact shape:
{"tldr":"one-sentence takeaway","chunks":[{"heading":"short heading","markdown":"2-4 short paragraphs of markdown","check":{"question":"quick comprehension question about THIS chunk","options":["option A","option B","option C","option D"],"answer":0,"why":"1 sentence explaining the correct answer"}}]}

Rules:
- 3-5 chunks, ordered from foundational ideas to advanced ones — each chunk is a bite-sized piece a student absorbs in ~1 minute
- In "markdown": use **bold** for key terms, bullet lists for enumerations, > blockquotes for real-world examples or analogies, code blocks for formulas/diagrams, LaTeX ($...$) for math
- Every chunk MUST have a "check": a 4-option MCQ testing the core idea of that chunk (comprehension, not trivia)
- "answer" is the 0-based index of the correct option — vary it across chunks
- Keep the tone clear, encouraging, and concise`,
    aiConfig
  );
  const parsed = extractStudyJSON(raw);
  if (parsed?.chunks?.length) {
    const chunks = parsed.chunks.map(normalizeChunk).filter(Boolean);
    if (chunks.length > 0) return { tldr: String(parsed.tldr || ""), chunks };
  }
  // Response looked like JSON but nothing salvageable — don't dump raw JSON on screen
  if (raw.trim().startsWith("{") || raw.includes('"chunks"')) return { parseError: true };
  return { text: raw };
}

async function aiQuestion(topic, section, explanation, aiConfig, ctx) {
  const diffLevel = buildDifficultyLevel(ctx);
  const raw = await callAI(
    `Based on an explanation of "${section.title}" (part of "${topic}"), generate ONE deep comprehension question that tests understanding, not just recall.${diffLevel}
Reply ONLY with valid JSON: {"question":"...","hint":"a subtle clue — do not give the answer"}`,
    aiConfig
  );
  return extractJSON(raw);
}

async function aiEvaluate(topic, section, question, answer, aiConfig) {
  return await callAI(
    `Topic: "${topic}" — Section: "${section.title}"
Question: "${question}"
Student answer: "${answer}"

Format your feedback using markdown:
- Start with **✓ Correct:** followed by what the student got right (1 sentence)
- Then **△ Missing:** followed by what was overlooked or incomplete (1 sentence)
- End with **★ Tip:** followed by a key insight or way to remember the concept (1 sentence)
Keep it concise and encouraging.`,
    aiConfig
  );
}

// Cumulative end-of-topic review quiz — interleaved MCQs across all sections.
async function aiReviewQuiz(topic, sections, fuzzyTitles, aiConfig, ctx) {
  const ctxBlock = buildContextBlock(ctx);
  const diffLevel = buildDifficultyLevel(ctx);
  const fuzzyBlock = fuzzyTitles.length
    ? ` The student marked these sections as shaky — weight extra questions toward them: ${fuzzyTitles.join(", ")}.`
    : "";
  const raw = await callAI(
    `Create a cumulative review quiz for "${topic}" covering these sections: ${sections.map(s => s.title).join(", ")}.${fuzzyBlock}${ctxBlock}${diffLevel}
Reply ONLY with valid JSON (no markdown):
{"questions":[{"question":"...","options":["A","B","C","D"],"answer":0,"why":"1-sentence explanation","section":"section title this question covers"}]}
8 questions total, interleaved across sections (do NOT group questions by section). Mix recall and application. "answer" is the 0-based index of the correct option — vary it.`,
    aiConfig
  );
  const parsed = extractJSON(raw);
  // Salvage individual question objects if the overall payload was malformed/truncated
  const rawQuestions = parsed?.questions
    || extractObjectsLoose(raw).filter(o => o.question && o.options && !o.questions);
  return (rawQuestions || [])
    .map(q => { const c = normalizeCheck(q); return c ? { ...c, section: String(q.section || "") } : null; })
    .filter(Boolean);
}

// ─── Shared UI pieces ──────────────────────────────────────────────────────────
function Spinner({ message }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"40px 20px" }}>
      <div style={{
        width:34, height:34, borderRadius:"50%",
        border:`3px solid ${D.line}`, borderTopColor: D.border,
        animation:"gs-spin 0.75s linear infinite",
      }} />
      {message && <span style={{ fontSize:12, color:D.muted, fontFamily:"Manrope,sans-serif", textAlign:"center" }}>{message}</span>}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: extra }) {
  const base = {
    display:"inline-flex", alignItems:"center", gap:6,
    padding:"8px 16px", borderRadius:20, cursor: disabled ? "not-allowed" : "pointer",
    fontSize:12, fontWeight:600, fontFamily:"Manrope,sans-serif",
    transition:"filter 0.15s, transform 0.15s", opacity: disabled ? 0.5 : 1,
    ...extra,
  };
  const variants = {
    primary:  { background: D.accent, border:`0.5px solid ${D.border}`, color:"#FFD700" },
    ghost:    { background:"transparent", border:`0.5px solid ${D.line}`, color:D.muted },
    red:      { background:"#1a0808", border:"0.5px solid #4a1010", color:"#ef9a9a" },
    green:    { background:"#0a1f10", border:"0.5px solid #1a4a25", color:"#81c784" },
    yellow:   { background:"rgba(255,215,0,0.08)", border:"0.5px solid rgba(255,215,0,0.35)", color:"#FFD700" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.filter="brightness(1.18)"; e.currentTarget.style.transform="translateY(-1px)"; }}}
      onMouseLeave={e => { e.currentTarget.style.filter=""; e.currentTarget.style.transform=""; }}
    >{children}</button>
  );
}

// ─── Roadmap Section Card ──────────────────────────────────────────────────────
function SectionCard({ section, index, status, isNext, onStudy }) {
  const icon = status === "mastered" ? "★" : status === "solid" ? "✓" : status === "fuzzy" ? "~" : index + 1;
  const isFuzzy = status === "fuzzy";
  const studied = !!status;
  const statusBg = isFuzzy ? "rgba(245,166,35,0.06)" : studied ? "rgba(255,215,0,0.05)" : D.card;
  const statusBorder = isFuzzy ? "rgba(245,166,35,0.35)" : studied ? "rgba(255,215,0,0.3)" : D.line;
  const dotBg = isFuzzy ? "rgba(245,166,35,0.14)" : studied ? "rgba(255,215,0,0.12)" : D.faint;
  const dotBorder = isFuzzy ? D.amber : studied ? D.border : "rgba(255,255,255,0.12)";
  const dotColor = isFuzzy ? D.amber : studied ? "#FFD700" : D.muted;
  return (
    <div className="gs-animate" style={{
      display:"flex", alignItems:"center", gap:12,
      padding:"11px 14px",
      background: statusBg,
      border:`0.5px solid ${statusBorder}`,
      borderRadius:13, marginBottom:8, transition:"border-color 0.2s",
    }}>
      <div style={{
        width:28, height:28, borderRadius:"50%", flexShrink:0,
        background: dotBg,
        border:`0.5px solid ${dotBorder}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:11, fontWeight:700, color: dotColor, fontFamily:"Manrope,sans-serif",
      }}>
        {icon}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:D.text, fontFamily:"Manrope,sans-serif" }}>
          {section.title}
          {isNext && (
            <span style={{
              marginLeft:7, fontSize:9, fontWeight:700, letterSpacing:"0.06em",
              color:"#0A0D13", background:"linear-gradient(90deg, #F5A623, #FFD700)",
              borderRadius:6, padding:"2px 6px", verticalAlign:"middle",
            }}>▶ UP NEXT</span>
          )}
        </div>
        <div style={{ fontSize:11, color:D.muted, marginTop:2, fontFamily:"Manrope,sans-serif" }}>{section.summary}</div>
      </div>

      <Btn onClick={() => onStudy(section)} variant={studied ? "ghost" : "primary"} style={{ flexShrink:0 }}>
        {studied ? "Review" : "Study →"}
      </Btn>
    </div>
  );
}

// ─── Quick Check (interleaved MCQ) ─────────────────────────────────────────────
function CheckCard({ check, index, total, selected, onAnswer }) {
  const answered = selected !== undefined;
  const correct = answered && selected === check.answer;
  return (
    <div className="gs-pop" style={{
      background: D.card,
      border:`0.5px solid ${answered ? (correct ? "rgba(61,214,140,0.4)" : "rgba(255,84,112,0.4)") : "rgba(255,215,0,0.25)"}`,
      borderRadius:14, padding:"13px 15px", margin:"4px 0 18px",
    }}>
      <div style={{ fontSize:9, color:"#FFD700", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"Manrope,sans-serif", marginBottom:7 }}>
        ⚡ Quick check{total > 1 ? ` ${index + 1} of ${total}` : ""}
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:D.text, lineHeight:1.55, fontFamily:"Manrope,sans-serif", marginBottom:10 }}>
        {check.question}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {check.options.map((opt, oi) => {
          const isCorrect = oi === check.answer;
          const isSel = oi === selected;
          let bg = D.bar, bdr = D.line, col = D.text;
          if (answered) {
            if (isCorrect)      { bg = "rgba(61,214,140,0.08)"; bdr = D.green; col = "#7EE2A8"; }
            else if (isSel)     { bg = "rgba(255,84,112,0.08)"; bdr = D.red;   col = "#FF9AA9"; }
            else                { col = D.hint; }
          }
          return (
            <button key={oi} disabled={answered} onClick={() => onAnswer(oi)}
              style={{
                display:"flex", alignItems:"center", gap:9, textAlign:"left",
                background:bg, border:`0.5px solid ${bdr}`, borderRadius:10,
                padding:"9px 12px", fontSize:12, color:col,
                cursor: answered ? "default" : "pointer",
                fontFamily:"Manrope,sans-serif", transition:"border-color 0.15s, background 0.15s",
              }}>
              <span style={{
                width:18, height:18, borderRadius:"50%", flexShrink:0,
                border:`0.5px solid ${bdr}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, fontWeight:700,
              }}>
                {answered && isCorrect ? "✓" : answered && isSel ? "✗" : String.fromCharCode(65 + oi)}
              </span>
              <span style={{ flex:1 }}>{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div style={{
          marginTop:10, fontSize:11.5, lineHeight:1.6, fontFamily:"Manrope,sans-serif",
          color: correct ? "#7EE2A8" : D.muted,
        }}>
          {correct ? "✓ Correct. " : "✗ Not quite. "}{check.why}
        </div>
      )}
    </div>
  );
}

// ─── Confidence rating ─────────────────────────────────────────────────────────
const CONFIDENCE_OPTS = [
  ["fuzzy",    "🌫️", "Still fuzzy"],
  ["solid",    "👍",  "Got it"],
  ["mastered", "🔥",  "Nailed it"],
];

function ConfidenceRow({ onRate }) {
  return (
    <div className="gs-pop" style={{
      background:D.card, border:`0.5px solid ${D.line}`, borderRadius:14,
      padding:"13px 15px", marginTop:4, marginBottom:12,
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:D.muted, fontFamily:"Manrope,sans-serif", marginBottom:10, textAlign:"center" }}>
        How confident do you feel about this section?
      </div>
      <div style={{ display:"flex", gap:8 }}>
        {CONFIDENCE_OPTS.map(([val, icon, label]) => (
          <button key={val} onClick={() => onRate(val)} style={{
            flex:1, padding:"9px 6px", borderRadius:10, cursor:"pointer",
            background:D.bar, border:`0.5px solid ${D.line}`,
            display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            transition:"border-color 0.15s, transform 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.transform = ""; }}
          >
            <span style={{ fontSize:16 }}>{icon}</span>
            <span style={{ fontSize:10, fontWeight:600, color:D.text, fontFamily:"Manrope,sans-serif" }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total, label = "sections" }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:10, color:D.muted, fontFamily:"Manrope,sans-serif" }}>Progress</span>
        <span style={{ fontSize:10, color:D.border, fontFamily:"Manrope,sans-serif", fontWeight:600 }}>{current}/{total} {label}</span>
      </div>
      <div style={{ height:4, background:D.faint, borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg, #B8860B, #FFD700)`, borderRadius:4, transition:"width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
const LAUNCH_MSGS = {
  "auto-roadmap": "Building your learning roadmap…",
  "flashcards":   "Building your learning roadmap…", // legacy mode → roadmap
  "explain":      "Building roadmap and explanation…",
  "quiz":         "Building roadmap and preparing checks…",
};

const STATUS_LABEL = { fuzzy: "Still fuzzy 🌫️", solid: "Got it 👍", mastered: "Nailed it 🔥" };

export default function GuidedStudy({ aiConfig, initialTopic = "", startMode = "input", initialAttachment = null, studyContext = null }) {
  const isAutoLaunch = !!(initialTopic.trim() && startMode !== "input");
  const [phase, setPhase]               = useState("input");   // input | roadmap | section | review | summary
  const [topic, setTopic]               = useState(initialTopic);
  const [pastedContent, setPasted]      = useState("");
  const [sourceContent, setSourceContent] = useState("");      // full text sent to AI
  const [showPaste, setShowPaste]       = useState(false);
  const [roadmap, setRoadmap]           = useState(null);
  const [studied, setStudied]           = useState({});        // {sectionId: "fuzzy"|"solid"|"mastered"}
  const [activeSection, setActive]      = useState(null);
  const [sectionData, setSectionData]   = useState(null);      // {tldr, chunks[]} | {text}
  const [checkAnswers, setCheckAnswers] = useState({});        // {chunkIdx: optionIdx}
  const [visibleChunks, setVisibleChunks] = useState(1);
  const [qData, setQData]               = useState(null);      // {question, hint}
  const [userAnswer, setUserAnswer]     = useState("");
  const [feedback, setFeedback]         = useState("");
  const [review, setReview]             = useState(null);      // {questions, idx, answers}
  const [sessionChecks, setSessionChecks] = useState({ correct: 0, total: 0 });
  const [loading, setLoading]           = useState(isAutoLaunch);
  const [loadingMsg, setLoadingMsg]     = useState(isAutoLaunch ? (LAUNCH_MSGS[startMode] || "Working…") : "");
  const [autoError, setAutoError]       = useState("");
  const [sectionStep, setSectionStep]   = useState("learn");   // learn | question | feedback
  const [attachment]                    = useState(initialAttachment);
  const [isOnline, setIsOnline]         = useState(navigator.onLine);
  const [showHistory, setShowHistory]   = useState(false);
  const [sessions, setSessions]         = useState(() => loadSessions());
  const [fromCache, setFromCache]       = useState(false);
  const mountedRef                      = useRef(true);
  const checksRef                       = useRef({ correct: 0, total: 0 });
  const xpPostedRef                     = useRef(false);
  const sessionStartRef                 = useRef(0);
  const combo                           = useComboStreak("guided");
  const studiedCount                    = Object.keys(studied).length;
  const sessionXP                       = combo.correctCount * XP_PER_CORRECT + combo.totalStreakBonus;

  // ── Online/offline listener ──
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    sessionStartRef.current = Date.now();
    return () => { mountedRef.current = false; window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // ── Record progress for the material card that launched this session ──
  useEffect(() => {
    const rid = studyContext?.resourceId;
    if (!rid || !roadmap?.sections?.length) return;
    recordGuidedProgress(rid, {
      done: Object.keys(studied).length,
      total: roadmap.sections.length,
      title: roadmap.title || topic,
      updatedAt: new Date().toISOString(),
    });
  }, [studied, roadmap]);

  // ── Auto-launch when startMode is provided with a topic ──
  useEffect(() => {
    if (!initialTopic.trim() || startMode === "input") return;
    const attachContent = attachment?.content || "";
    if (attachContent) setSourceContent(attachContent);
    if (startMode === "explain" || startMode === "quiz") {
      autoExplain(initialTopic, attachContent);
    } else {
      // "auto-roadmap", legacy "flashcards", or unknown → roadmap
      autoRoadmap(initialTopic, attachContent);
    }
  // eslint-disable-next-line
  }, []);

  function offlineCheck() {
    if (!navigator.onLine) { setAutoError("You're offline — please reconnect to use AI features."); return true; }
    return false;
  }

  function restoreStudied(cached) {
    const s = cached?.roadmap?.progress?.studied;
    return s && typeof s === "object" ? s : {};
  }

  function persistProgress(studiedMap) {
    if (!roadmap) return;
    saveStudyCache(docCacheKey(topic, sourceContent), { roadmap: { ...roadmap, resourceId: studyContext?.resourceId, progress: { studied: studiedMap } } });
  }

  function resetSessionState() {
    setStudied({}); setSectionData(null); setCheckAnswers({}); setVisibleChunks(1);
    setQData(null); setUserAnswer(""); setFeedback(""); setReview(null); setActive(null);
    checksRef.current = { correct: 0, total: 0 };
    setSessionChecks({ correct: 0, total: 0 });
    combo.resetCombo(); xpPostedRef.current = false; sessionStartRef.current = Date.now();
  }

  function recordCheck(isCorrect) {
    checksRef.current = { correct: checksRef.current.correct + (isCorrect ? 1 : 0), total: checksRef.current.total + 1 };
    setSessionChecks({ ...checksRef.current });
    combo.handleAnswer(isCorrect);
    if (isCorrect) haptics.success(); else haptics.error();
  }

  function saveExplanation(topicStr, sectionId, data) {
    const payload = data.chunks ? { structured: data } : { text: data.text };
    saveStudyCache(topicStr, { explanations: { [String(sectionId)]: payload } });
  }

  function applyCached(cacheTopic) {
    // Shared "load from cache" logic. Returns the cached object or null.
    return getStudyCache(cacheTopic).then(cached =>
      cached?.roadmap?.sections?.length ? cached : null
    );
  }

  async function autoRoadmap(topicStr, content = "") {
    if (offlineCheck()) return;
    setAutoError(""); setLoading(true); setLoadingMsg("Loading cached roadmap…");
    const cacheTopic = docCacheKey(initialTopic || topicStr, content);
    try {
      const cached = await applyCached(cacheTopic);
      if (cached && mountedRef.current) {
        setRoadmap(cached.roadmap); setStudied(restoreStudied(cached)); setPhase("roadmap"); setFromCache(true);
        setLoading(false);
        return;
      }
      setLoadingMsg("Building your learning roadmap…");
      const result = await aiRoadmap(topicStr, aiConfig, studyContext, content);
      if (result?.sections?.length) {
        resetSessionState();
        setRoadmap(result); setPhase("roadmap"); setFromCache(false);
        const entry = { topic: initialTopic || topicStr, cacheKey: cacheTopic, date: new Date().toISOString(), sections: result.sections.map(s => s.title) };
        saveSession(entry); setSessions(loadSessions());
        saveStudyCache(cacheTopic, { roadmap: { ...result, resourceId: studyContext?.resourceId } });
      } else setAutoError("Couldn't parse the roadmap — please try again.");
    } catch (e) {
      setAutoError("AI request failed: " + (e?.message || "check your connection"));
    } finally { if (mountedRef.current) setLoading(false); }
  }

  async function autoExplain(topicStr, content = "") {
    if (offlineCheck()) return;
    setAutoError(""); setLoading(true); setLoadingMsg("Loading cached roadmap…");
    const cacheTopic = docCacheKey(initialTopic || topicStr, content);
    try {
      let result = null;
      const cached = await applyCached(cacheTopic);
      if (cached) {
        result = cached.roadmap;
        setFromCache(true);
      } else {
        setLoadingMsg("Building roadmap…");
        result = await aiRoadmap(topicStr, aiConfig, studyContext, content);
        if (result?.sections?.length) {
          setFromCache(false);
          saveStudyCache(cacheTopic, { roadmap: { ...result, resourceId: studyContext?.resourceId } });
        }
      }
      if (!result?.sections?.length) { setAutoError("Couldn't build a roadmap — please try again."); return; }
      resetSessionState();
      setRoadmap(result);
      setStudied(restoreStudied(cached));
      const firstSection = result.sections[0];
      setActive(firstSection); setSectionStep("learn"); setPhase("section");
      const sectionKey = String(firstSection.id);
      const cachedExp = cached?.explanations?.[sectionKey];
      if (cachedExp?.structured?.chunks?.length) {
        setSectionData(cachedExp.structured);
        setLoading(false);
        return;
      }
      if (cachedExp?.text) {
        setSectionData({ text: cachedExp.text });
        setLoading(false);
        return;
      }
      setLoadingMsg("Generating explanation…");
      const data = await aiExplain(initialTopic, firstSection, aiConfig, studyContext, null, [], content, 0, result.sections.length);
      setSectionData(data);
      if (!data.parseError) saveExplanation(cacheTopic, firstSection.id, data);
    } catch (e) {
      setAutoError("AI request failed: " + (e?.message || "check your connection"));
    } finally { setLoading(false); }
  }

  // ── Handlers ──
  async function handleRoadmap() {
    if (!topic.trim()) return;
    if (offlineCheck()) return;
    setLoading(true); setLoadingMsg("Loading cached roadmap…");
    try {
      const pasted = pastedContent.trim();
      const key = docCacheKey(topic, pasted);
      const cached = await applyCached(key);
      if (cached) {
        if (pasted) setSourceContent(pasted);
        setRoadmap(cached.roadmap); setStudied(restoreStudied(cached)); setPhase("roadmap"); setFromCache(true);
        setLoading(false);
        return;
      }
      setLoadingMsg("Building your learning roadmap…");
      if (pasted) setSourceContent(pasted);
      const result = await aiRoadmap(topic, aiConfig, studyContext, pasted);
      if (result?.sections?.length) {
        resetSessionState();
        setRoadmap(result);
        setPhase("roadmap"); setFromCache(false);
        const entry = { topic, cacheKey: key, date: new Date().toISOString(), sections: result.sections.map(s => s.title) };
        saveSession(entry); setSessions(loadSessions());
        saveStudyCache(key, { roadmap: { ...result, resourceId: studyContext?.resourceId } });
      }
    } finally { setLoading(false); }
  }

  async function handleStudy(section) {
    setActive(section);
    setSectionStep("learn");
    setSectionData(null); setCheckAnswers({}); setVisibleChunks(1);
    setQData(null); setUserAnswer(""); setFeedback("");
    setPhase("section");
    setLoading(true); setLoadingMsg("Loading explanation…");
    try {
      const cached = await getStudyCache(docCacheKey(topic, sourceContent));
      const sectionKey = String(section.id);
      const cachedExp = cached?.explanations?.[sectionKey];
      if (cachedExp?.structured?.chunks?.length) {
        setSectionData(cachedExp.structured);
        setLoading(false);
        return;
      }
      if (cachedExp?.text) {
        setSectionData({ text: cachedExp.text });
        setLoading(false);
        return;
      }
      setLoadingMsg("Generating explanation…");
      const studiedTitles = roadmap ? roadmap.sections.filter(s => studied[s.id]).map(s => s.title) : [];
      const prevSection = roadmap ? roadmap.sections.filter(s => studied[s.id]).pop() : null;
      const sectionIdx = roadmap ? Math.max(0, roadmap.sections.findIndex(s => s.id === section.id)) : 0;
      const data = await aiExplain(topic, section, aiConfig, studyContext, prevSection, studiedTitles, sourceContent, sectionIdx, roadmap?.sections.length || 1);
      setSectionData(data);
      if (!data.parseError) saveExplanation(docCacheKey(topic, sourceContent), section.id, data);
    } finally { setLoading(false); }
  }

  function handleCheckAnswer(chunkIdx, optIdx) {
    if (checkAnswers[chunkIdx] !== undefined) return;
    const check = sectionData?.chunks?.[chunkIdx]?.check;
    if (!check) return;
    setCheckAnswers(prev => ({ ...prev, [chunkIdx]: optIdx }));
    recordCheck(optIdx === check.answer);
    setVisibleChunks(v => Math.max(v, chunkIdx + 2));
  }

  function handleConfidence(status) {
    if (!activeSection) return;
    haptics.light();
    const next = { ...studied, [activeSection.id]: status };
    setStudied(next);
    persistProgress(next);
  }

  async function handleAskQuestion() {
    setSectionStep("question");
    setLoading(true); setLoadingMsg("Generating a comprehension question…");
    try {
      const explainText = sectionData?.chunks
        ? sectionData.chunks.map(c => c.markdown).join("\n\n")
        : sectionData?.text || "";
      const q = await aiQuestion(topic, activeSection, explainText, aiConfig, studyContext);
      setQData(q);
      if (activeSection) {
        saveStudyCache(docCacheKey(topic, sourceContent), { explanations: { [String(activeSection.id)]: { question: q } } });
      }
    } finally { setLoading(false); }
  }

  async function handleSubmitAnswer() {
    if (!userAnswer.trim()) return;
    setSectionStep("feedback");
    setLoading(true); setLoadingMsg("Evaluating your answer…");
    try {
      const fb = await aiEvaluate(topic, activeSection, qData.question, userAnswer, aiConfig);
      setFeedback(fb);
    } finally { setLoading(false); }
  }

  function nextSection() {
    if (!roadmap || !activeSection) return;
    if (!studied[activeSection.id]) {
      const next = { ...studied, [activeSection.id]: "solid" };
      setStudied(next);
      persistProgress(next);
    }
    const ids = roadmap.sections.map(s => s.id);
    const next = roadmap.sections[ids.indexOf(activeSection.id) + 1];
    if (next) handleStudy(next);
    else setPhase("roadmap");
  }

  async function startFinalReview() {
    if (!roadmap || studiedCount === 0 || offlineCheck()) return;
    setLoading(true); setLoadingMsg("Building your review quiz…");
    try {
      const fuzzyTitles = roadmap.sections.filter(s => studied[s.id] === "fuzzy").map(s => s.title);
      const questions = await aiReviewQuiz(topic, roadmap.sections, fuzzyTitles, aiConfig, studyContext);
      if (questions.length) {
        setReview({ questions, idx: 0, answers: {} });
        setPhase("review");
      } else setAutoError("Couldn't build the review quiz — please try again.");
    } catch (e) {
      setAutoError("AI request failed: " + (e?.message || "check your connection"));
    } finally { setLoading(false); }
  }

  function handleReviewAnswer(optIdx) {
    if (!review || review.answers[review.idx] !== undefined) return;
    const q = review.questions[review.idx];
    setReview(prev => ({ ...prev, answers: { ...prev.answers, [prev.idx]: optIdx } }));
    recordCheck(optIdx === q.answer);
  }

  function reviewNext() {
    if (!review) return;
    if (review.idx + 1 >= review.questions.length) finishToSummary();
    else setReview(prev => ({ ...prev, idx: prev.idx + 1 }));
  }

  function finishToSummary() {
    setPhase("summary");
    if (!xpPostedRef.current && checksRef.current.total > 0) {
      xpPostedRef.current = true;
      try {
        const token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}")?.authToken;
        if (token) {
          api("/sessions", {
            token, method: "POST",
            body: {
              mode: "practice",
              score: checksRef.current.correct,
              total: checksRef.current.total,
              durationSec: Math.round((Date.now() - (sessionStartRef.current || Date.now())) / 1000),
            },
          }).catch(() => {});
        }
      } catch {}
    }
  }

  // ── Common wrapper ──
  const wrap = (children) => (
    <div style={{ flex:1, overflowY:"auto", padding:"16px 14px 20px", scrollbarWidth:"none" }}>
      {children}
    </div>
  );

  const card = (children, extra) => (
    <div className="gs-animate" style={{
      background:D.card, border:`0.5px solid ${D.line}`,
      borderRadius:16, padding:"14px 16px", marginBottom:12, ...extra,
    }}>{children}</div>
  );

  const comboChip = combo.combo >= 3 && (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      fontSize:11, fontWeight:700, fontFamily:"Manrope,sans-serif",
      color: combo.combo >= 7 ? "#ff7043" : D.amber,
      padding:"3px 9px", borderRadius:999,
      background: combo.combo >= 7 ? "rgba(255,112,67,0.12)" : "rgba(245,166,35,0.12)",
      border:`0.5px solid ${combo.combo >= 7 ? "rgba(255,112,67,0.3)" : "rgba(245,166,35,0.3)"}`,
    }}>
      🔥 {combo.combo}x{STREAK_BONUS[combo.combo] ? ` +${STREAK_BONUS[combo.combo]}` : ""}
    </span>
  );

  const xpChip = sessionXP > 0 && (
    <span style={{
      fontSize:11, fontWeight:700, color:"#FFD700", fontFamily:"Manrope,sans-serif",
      padding:"3px 9px", borderRadius:999,
      background:"rgba(255,215,0,0.08)", border:"0.5px solid rgba(255,215,0,0.3)",
    }}>
      ⚡ +{sessionXP} XP
    </span>
  );

  // ── INPUT PHASE (or auto-loading) ──
  if (phase === "input" && loading) return wrap(<><style>{STYLES}</style><Spinner message={loadingMsg} /></>);

  if (phase === "input") return wrap(
    <>
      <style>{STYLES}</style>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          background:"#1a1000", border:"0.5px solid #f57c00", borderRadius:12,
          padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{ fontSize:16 }}>📶</span>
          <span style={{ fontSize:12, color:"#FFB74D", fontFamily:"Manrope,sans-serif" }}>You're offline — please reconnect to use AI features.</span>
        </div>
      )}

      {/* Auto-error banner */}
      {autoError && (
        <div style={{
          background:"#1a0a0a", border:"0.5px solid #e53935", borderRadius:12,
          padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <span style={{ fontSize:12, color:"#ef9a9a", fontFamily:"Manrope,sans-serif", flex:1 }}>{autoError}</span>
          <button
            onClick={() => { setAutoError(""); isAutoLaunch && (topic.trim() ? handleRoadmap() : null); }}
            style={{ background:"#e53935", border:"none", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#fff", cursor:"pointer", fontFamily:"Manrope,sans-serif", fontWeight:600 }}
          >Retry</button>
        </div>
      )}

      {/* Hero */}
      <div style={{ textAlign:"center", padding:"24px 0 20px" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🧠</div>
        <div style={{ fontSize:18, fontWeight:700, color:D.text, fontFamily:"Syne,sans-serif", marginBottom:6 }}>
          Guided Study
        </div>
        <div style={{ fontSize:12, color:D.muted, fontFamily:"Manrope,sans-serif", lineHeight:1.6 }}>
          Enter a topic or paste your notes — I'll break it into bite-sized<br/>
          sections with quick checks as you go, then a final review quiz.
        </div>
      </div>

      {/* Topic input */}
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !loading && handleRoadmap()}
        placeholder="e.g. Photosynthesis, Recursion, The French Revolution…"
        style={{
          width:"100%", boxSizing:"border-box",
          background:"#11151E", border:`0.5px solid ${D.line}`,
          borderRadius:14, padding:"12px 16px", fontSize:13,
          color:D.text, fontFamily:"Manrope,sans-serif", outline:"none",
          marginBottom:10, transition:"border-color 0.2s",
        }}
        onFocus={e => e.target.style.borderColor = D.border}
        onBlur={e  => e.target.style.borderColor = D.line}
      />

      {/* Paste toggle */}
      <button
        onClick={() => setShowPaste(o => !o)}
        style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif", marginBottom:8, padding:0 }}
      >
        {showPaste ? "▾ Hide content paste" : "▸ Paste notes / content (optional)"}
      </button>

      {showPaste && (
        <textarea
          value={pastedContent}
          onChange={e => setPasted(e.target.value)}
          placeholder="Paste your lecture notes, textbook excerpts, or any content here — the roadmap will adapt to the material and cover all of it…"
          rows={5}
          style={{
            width:"100%", boxSizing:"border-box", resize:"vertical",
            background:"#11151E", border:`0.5px solid ${D.line}`,
            borderRadius:12, padding:"10px 14px", fontSize:12,
            color:D.muted, fontFamily:"Manrope,sans-serif", outline:"none",
            marginBottom:10,
          }}
        />
      )}

      <Btn onClick={handleRoadmap} disabled={!topic.trim() || loading || !isOnline} style={{ width:"100%", justifyContent:"center", padding:"11px 16px" }}>
        {loading ? <Spinner message="" /> : "Generate Learning Roadmap →"}
      </Btn>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div style={{ marginTop:16 }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{ background:"none", border:`0.5px solid ${D.line}`, borderRadius:10, padding:"7px 14px", cursor:"pointer", fontSize:11, color:D.muted, fontFamily:"Manrope,sans-serif", display:"flex", alignItems:"center", gap:6 }}
          >
            📂 Recent Sessions ({sessions.length})
            <span style={{ fontSize:9 }}>{showHistory ? "▲" : "▼"}</span>
          </button>
          {showHistory && (
            <div className="gs-history-panel" style={{
              marginTop:8, background:D.card, border:`0.5px solid ${D.line}`,
              borderRadius:14, overflow:"hidden",
            }}>
              {sessions.map((s, i) => (
                <div
                  key={i}
                  onClick={async () => {
                    setTopic(s.topic); setShowHistory(false);
                    const cached = await getStudyCache(s.cacheKey || s.topic);
                    if (cached?.roadmap?.sections?.length) {
                      setRoadmap(cached.roadmap); setStudied(restoreStudied(cached)); setPhase("roadmap"); setFromCache(true);
                    }
                  }}
                  style={{
                    padding:"10px 14px", borderBottom: i < sessions.length-1 ? `0.5px solid ${D.line}` : "none",
                    cursor:"pointer", display:"flex", flexDirection:"column", gap:3,
                    transition:"background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = D.faint}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ fontSize:12, fontWeight:600, color:D.text, fontFamily:"Manrope,sans-serif" }}>{s.topic}</div>
                  <div style={{ fontSize:10, color:D.hint, fontFamily:"Manrope,sans-serif" }}>
                    {new Date(s.date).toLocaleDateString(undefined,{month:"short",day:"numeric"})} · {s.sections?.length || 0} sections
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <Spinner message={loadingMsg} />}

      {/* How it works */}
      {card(
        <>
          <div style={{ fontSize:11, fontWeight:700, color:D.border, fontFamily:"Syne,sans-serif", marginBottom:10, letterSpacing:"0.06em" }}>HOW IT WORKS</div>
          {[
            ["📋", "Roadmap",  "AI breaks your content into manageable sections"],
            ["📖", "Learn",    "Bite-sized chunks with a quick check after each part"],
            ["🎯", "Rate",     "Flag your confidence so weak spots resurface"],
            ["🏁", "Review",   "A final mixed quiz locks everything in"],
          ].map(([icon, label, desc]) => (
            <div key={label} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
              <div>
                <span style={{ fontSize:12, fontWeight:600, color:D.text, fontFamily:"Manrope,sans-serif" }}>{label} </span>
                <span style={{ fontSize:11, color:D.muted, fontFamily:"Manrope,sans-serif" }}>— {desc}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );

  // ── ROADMAP PHASE ──
  if (phase === "roadmap" && roadmap) return wrap(
    <>
      <style>{STYLES}</style>

      <ProgressBar current={studiedCount} total={roadmap.sections.length} />

      {studiedCount > 0 && studiedCount / roadmap.sections.length >= 0.5 && (
        <div className="gs-pop" style={{
          fontSize:11, fontWeight:600, color:"#FFD700", fontFamily:"Manrope,sans-serif",
          textAlign:"center", margin:"-6px 0 12px",
        }}>
          {studiedCount === roadmap.sections.length
            ? "🏁 All sections studied — take the Final Review to lock it in!"
            : "🔥 Halfway there — keep the momentum going"}
        </div>
      )}

      {card(
        <>
          <div style={{ fontSize:16, fontWeight:700, color:D.text, fontFamily:"Syne,sans-serif", marginBottom:5 }}>
            📋 {roadmap.title}
          </div>
          <div style={{ fontSize:12, color:D.muted, lineHeight:1.6, fontFamily:"Manrope,sans-serif" }}>
            {roadmap.description}
          </div>
        </>
      )}

      {roadmap.sections.map((s, i) => (
        <SectionCard key={s.id} section={s} index={i} status={studied[s.id]} isNext={i === roadmap.sections.findIndex(x => !studied[x.id])} onStudy={handleStudy} />
      ))}

      <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
        <Btn variant="yellow" onClick={startFinalReview} disabled={studiedCount === 0 || loading}>
          🏁 Final Review{studiedCount > 0 && studiedCount < roadmap.sections.length ? ` (${studiedCount} studied)` : ""}
        </Btn>
        <Btn variant="ghost" onClick={() => { resetSessionState(); setPhase("input"); setRoadmap(null); }}>← New topic</Btn>
        {fromCache && (
          <Btn variant="ghost" onClick={async () => {
            const key = docCacheKey(topic, sourceContent);
            await clearStudyCache(key);
            setFromCache(false);
            setLoading(true); setLoadingMsg("Regenerating roadmap…");
            try {
              const result = await aiRoadmap(topic, aiConfig, studyContext, sourceContent);
              if (result?.sections?.length) {
                resetSessionState();
                setRoadmap(result);
                saveStudyCache(key, { roadmap: { ...result, resourceId: studyContext?.resourceId } });
              }
            } catch (e) {
              setAutoError("AI request failed: " + (e?.message || "check your connection"));
            } finally { setLoading(false); }
          }}>↻ Regenerate</Btn>
        )}
      </div>

      {loading && <Spinner message={loadingMsg} />}
      {autoError && (
        <div style={{ marginTop:10, fontSize:12, color:"#ef9a9a", fontFamily:"Manrope,sans-serif" }}>{autoError}</div>
      )}
    </>
  );

  // ── SECTION PHASE ──
  if (phase === "section" && activeSection) {
    const chunks = sectionData?.chunks || null;
    const totalChecks = chunks ? chunks.filter(c => c.check).length : 0;
    const allRevealed = chunks ? visibleChunks >= chunks.length : true;
    const allChecksDone = chunks
      ? allRevealed && chunks.every((c, i) => !c.check || checkAnswers[i] !== undefined)
      : true;
    const sectionIdx = roadmap ? roadmap.sections.findIndex(s => s.id === activeSection.id) : -1;
    const isLastSection = roadmap ? sectionIdx === roadmap.sections.length - 1 : false;
    const checkOrdinal = (ci) => chunks.slice(0, ci).filter(c => c.check).length;

    return wrap(
      <>
        <style>{STYLES}</style>

        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
          <Btn variant="ghost" onClick={() => setPhase("roadmap")}>← Roadmap</Btn>
          <span style={{ fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif" }}>
            {sectionIdx + 1} / {roadmap?.sections.length}
            {chunks ? ` · part ${Math.min(visibleChunks, chunks.length)}/${chunks.length}` : ""}
          </span>
          <span style={{ flex:1 }} />
          {comboChip}
          {xpChip}
        </div>

        {/* Section header */}
        {card(
          <div style={{ fontSize:15, fontWeight:700, color:D.text, fontFamily:"Syne,sans-serif" }}>
            📖 {activeSection.title}
          </div>
        )}

        {/* ── Learn step: TL;DR + chunks with interleaved checks ── */}
        {sectionStep === "learn" && (
          <>
            {loading ? <Spinner message={loadingMsg} /> : sectionData?.parseError ? (
              card(
                <div style={{ textAlign:"center", padding:"8px 0" }}>
                  <div style={{ fontSize:13, color:D.muted, fontFamily:"Manrope,sans-serif", marginBottom:12, lineHeight:1.6 }}>
                    Something glitched while formatting this section.
                  </div>
                  <Btn variant="primary" onClick={() => handleStudy(activeSection)}>↻ Try again</Btn>
                </div>
              )
            ) : sectionData && (
              <>
                {sectionData.tldr && (
                  <div className="gs-animate" style={{
                    background:"rgba(255,215,0,0.06)", border:"0.5px solid rgba(255,215,0,0.3)",
                    borderRadius:12, padding:"10px 14px", marginBottom:14,
                    fontSize:12, color:"#E8D9A0", lineHeight:1.6, fontFamily:"Manrope,sans-serif",
                  }}>
                    <span style={{ fontWeight:700, color:"#FFD700", fontSize:10, letterSpacing:"0.08em" }}>TL;DR — </span>
                    {sectionData.tldr}
                  </div>
                )}

                {chunks ? (
                  <>
                    {chunks.slice(0, visibleChunks).map((chunk, ci) => (
                      <div key={ci} className="gs-animate" style={{ marginBottom:4 }}>
                        {chunk.heading && (
                          <div style={{
                            fontSize:13, fontWeight:700, color:"#FFD700",
                            fontFamily:"Syne,sans-serif", marginBottom:6, marginTop: ci > 0 ? 8 : 0,
                          }}>
                            {chunk.heading}
                          </div>
                        )}
                        <div style={{ fontSize:13.5, color:"#EDEFF5", lineHeight:1.75, fontFamily:"Manrope,sans-serif" }}>
                          <MarkdownText theme="gold">{chunk.markdown}</MarkdownText>
                        </div>
                        {chunk.check && (
                          <CheckCard
                            check={chunk.check}
                            index={checkOrdinal(ci)}
                            total={totalChecks}
                            selected={checkAnswers[ci]}
                            onAnswer={(oi) => handleCheckAnswer(ci, oi)}
                          />
                        )}
                        {!chunk.check && ci === visibleChunks - 1 && ci < chunks.length - 1 && (
                          <Btn variant="ghost" onClick={() => setVisibleChunks(v => v + 1)} style={{ marginBottom:14 }}>
                            Continue →
                          </Btn>
                        )}
                      </div>
                    ))}

                    {allChecksDone && (
                      <>
                        {!studied[activeSection.id] ? (
                          <ConfidenceRow onRate={handleConfidence} />
                        ) : (
                          <div style={{
                            fontSize:11, color:D.muted, fontFamily:"Manrope,sans-serif",
                            marginBottom:12, textAlign:"center",
                          }}>
                            Confidence: {STATUS_LABEL[studied[activeSection.id]] || "Got it 👍"}
                            <button
                              onClick={() => { const n = { ...studied }; delete n[activeSection.id]; setStudied(n); persistProgress(n); }}
                              style={{ background:"none", border:"none", color:D.hint, fontSize:10, cursor:"pointer", marginLeft:6, fontFamily:"Manrope,sans-serif" }}
                            >(change)</button>
                          </div>
                        )}
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          <Btn onClick={handleAskQuestion}>🎯 Test my understanding</Btn>
                          <Btn variant="green" onClick={nextSection}>
                            {isLastSection ? "Finish →" : "Next section →"}
                          </Btn>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="gs-animate" style={{
                      padding:"4px 0",
                      fontSize:13.5, color:"#EDEFF5", lineHeight:1.75,
                      fontFamily:"Manrope,sans-serif", marginBottom:12,
                    }}>
                      <MarkdownText theme="gold">{sectionData.text}</MarkdownText>
                    </div>
                    {!studied[activeSection.id] && <ConfidenceRow onRate={handleConfidence} />}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <Btn onClick={handleAskQuestion}>🎯 Test my understanding</Btn>
                      <Btn variant="green" onClick={nextSection}>
                        {isLastSection ? "Finish →" : "Next section →"}
                      </Btn>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Question step (optional typed deep-check) ── */}
        {sectionStep === "question" && (
          <>
            {loading ? <Spinner message={loadingMsg} /> : qData && (
              <>
                {card(
                  <>
                    <div style={{ fontSize:10, color:D.border, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"Manrope,sans-serif", marginBottom:8 }}>
                      🎯 COMPREHENSION CHECK
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, color:D.text, lineHeight:1.6, fontFamily:"Manrope,sans-serif" }}>
                      {qData.question}
                    </div>
                    {qData.hint && (
                      <div style={{ marginTop:10, fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif" }}>
                        💡 Hint: {qData.hint}
                      </div>
                    )}
                  </>
                )}
                <textarea
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here…"
                  rows={4}
                  style={{
                    width:"100%", boxSizing:"border-box", resize:"vertical",
                    background:"#11151E", border:`0.5px solid ${D.line}`,
                    borderRadius:13, padding:"11px 14px", fontSize:12,
                    color:D.text, fontFamily:"Manrope,sans-serif",
                    outline:"none", marginBottom:10,
                  }}
                  onFocus={e => e.target.style.borderColor = D.border}
                  onBlur={e  => e.target.style.borderColor = D.line}
                />
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Btn onClick={handleSubmitAnswer} disabled={!userAnswer.trim()}>Submit answer →</Btn>
                  <Btn variant="ghost" onClick={() => setSectionStep("learn")}>← Back to lesson</Btn>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Feedback step ── */}
        {sectionStep === "feedback" && (
          <>
            {loading ? <Spinner message={loadingMsg} /> : feedback && (
              <>
                <div className="gs-animate" style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:D.hint, fontFamily:"Manrope,sans-serif", marginBottom:6 }}>Your answer:</div>
                  <div style={{ fontSize:12, color:D.muted, fontFamily:"Manrope,sans-serif", fontStyle:"italic", marginBottom:12 }}>"{userAnswer}"</div>
                  <div style={{ fontSize:10, color:"#81c784", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"Manrope,sans-serif", marginBottom:8 }}>
                    ✦ AI Feedback
                  </div>
                  <div style={{ fontSize:13, color:"#c8e6c9", lineHeight:1.75, fontFamily:"Manrope,sans-serif", padding:"4px 0" }}>
                    <MarkdownText theme="gold">{feedback}</MarkdownText>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Btn variant="green" onClick={nextSection}>
                    {isLastSection ? "Finish →" : "Next section →"}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setSectionStep("learn")}>← Back to lesson</Btn>
                  <Btn variant="ghost" onClick={() => setPhase("roadmap")}>Roadmap</Btn>
                </div>
              </>
            )}
          </>
        )}
      </>
    );
  }

  // ── REVIEW PHASE (cumulative quiz) ──
  if (phase === "review" && review) {
    const q = review.questions[review.idx];
    const answered = review.answers[review.idx] !== undefined;
    const isLast = review.idx === review.questions.length - 1;
    const answeredCount = Object.keys(review.answers).length;
    return wrap(
      <>
        <style>{STYLES}</style>

        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
          <Btn variant="ghost" onClick={() => setPhase("roadmap")}>← Roadmap</Btn>
          <span style={{ fontSize:11, color:D.hint, fontFamily:"Manrope,sans-serif" }}>🏁 Final Review</span>
          <span style={{ flex:1 }} />
          {comboChip}
          {xpChip}
        </div>

        <ProgressBar current={answeredCount} total={review.questions.length} label="questions" />

        {q.section && (
          <div style={{
            display:"inline-block", fontSize:10, color:D.hint, fontFamily:"Manrope,sans-serif",
            background:D.bar, border:`0.5px solid ${D.line}`, borderRadius:999,
            padding:"3px 10px", marginBottom:8,
          }}>
            from: {q.section}
          </div>
        )}

        <CheckCard
          check={q}
          index={review.idx}
          total={review.questions.length}
          selected={review.answers[review.idx]}
          onAnswer={handleReviewAnswer}
        />

        {answered && (
          <Btn onClick={reviewNext} variant="primary" style={{ width:"100%", justifyContent:"center", padding:"11px 16px" }}>
            {isLast ? "See results →" : "Next question →"}
          </Btn>
        )}
      </>
    );
  }

  // ── SUMMARY PHASE (wrap-up) ──
  if (phase === "summary") {
    const totalQ = sessionChecks.total;
    const pct = totalQ > 0 ? Math.round((sessionChecks.correct / totalQ) * 100) : 0;
    const fuzzySections = roadmap ? roadmap.sections.filter(s => studied[s.id] === "fuzzy") : [];
    return wrap(
      <>
        <style>{STYLES}</style>

        <div style={{ textAlign:"center", padding:"32px 12px 20px" }} className="gs-pop">
          <div style={{ fontSize:44, marginBottom:10 }}>{pct >= 70 ? "🎉" : pct >= 40 ? "💪" : "📚"}</div>
          <div style={{ fontSize:20, fontWeight:800, color:D.text, fontFamily:"Syne,sans-serif" }}>Session Complete!</div>
          <div style={{ fontSize:12, color:D.muted, marginTop:6, fontFamily:"Manrope,sans-serif" }}>{roadmap?.title || topic}</div>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          {[
            [`${studiedCount}/${roadmap?.sections.length || 0}`, "Sections"],
            [`${pct}%`, `${sessionChecks.correct}/${totalQ} checks`],
            [`+${sessionXP}`, "XP earned"],
          ].map(([big, small]) => (
            <div key={small} style={{
              flex:1, minWidth:80, background:D.card, border:`0.5px solid ${D.line}`,
              borderRadius:14, padding:"13px 10px", textAlign:"center",
            }}>
              <div style={{ fontSize:20, fontWeight:800, color:"#FFD700", fontFamily:"Syne,sans-serif" }}>{big}</div>
              <div style={{ fontSize:9, color:D.hint, textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:"Manrope,sans-serif", marginTop:3 }}>{small}</div>
            </div>
          ))}
        </div>

        {fuzzySections.length > 0 && card(
          <>
            <div style={{ fontSize:11, fontWeight:700, color:D.amber, fontFamily:"Syne,sans-serif", marginBottom:8, letterSpacing:"0.06em" }}>
              🌫️ SECTIONS TO REVISIT
            </div>
            {fuzzySections.map(s => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <span style={{ flex:1, fontSize:12, color:D.text, fontFamily:"Manrope,sans-serif" }}>{s.title}</span>
                <Btn variant="ghost" onClick={() => handleStudy(s)} style={{ padding:"4px 12px", fontSize:11 }}>Review</Btn>
              </div>
            ))}
          </>
        )}

        {totalQ === 0 && card(
          <div style={{ fontSize:12, color:D.muted, fontFamily:"Manrope,sans-serif", lineHeight:1.6 }}>
            Tip: answer the quick checks inside each section to earn XP and track your accuracy.
          </div>
        )}

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
          <Btn variant="yellow" onClick={() => setPhase("roadmap")}>← Back to roadmap</Btn>
          <Btn variant="ghost" onClick={() => { resetSessionState(); setPhase("input"); setRoadmap(null); }}>New topic</Btn>
        </div>
      </>
    );
  }

  return null;
}
