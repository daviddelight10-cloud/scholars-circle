import { useState, useRef, useEffect } from "react";
import { callAI, callAIMultimodal, callAITutor, extractJSON } from "../lib/aiClient";
import { buildSystemPrompt, buildConversationContext } from "./AITutor/prompts.js";
import { detectDiscipline } from "./AITutor/disciplines.js";
import { extractTextFromFile } from "./AITutor/fileExtract.js";
import { resolvePractice, searchQuestionBank, hasPracticeIntent, buildAppCatalog, APP_FEATURES, buildDocCatalog, findResources, searchDocuments, hasDocIntent, resolveMcqPractice, authHeaders, docTypeMeta } from "./AITutor/appKnowledge.js";
import GuidedStudy from "./GuidedStudy";
import MarkdownText from "../components/MarkdownText.jsx";
import { API_BASE } from "../lib/constants";
import { listFolders, createFolder } from "../lib/foldersApi";
import { toast } from "../components/Toast";

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  bg:      "#0A0D13",
  card:    "#151A24",
  bar:     "#11151E",
  accent:  "#191F2C",
  border:  "#FFD700",
  line:    "rgba(255,255,255,0.09)",
  line2:   "rgba(255,255,255,0.05)",
  text:    "#EDEFF5",
  muted:   "#9AA3B5",
  hint:    "#646E84",
  faint:   "#3A4356",
  userBg:  "rgba(255,215,0,0.08)",
  userBdr: "rgba(255,215,0,0.3)",
  userTxt: "#E8D9A0",
  aiBdr:   "rgba(255,255,255,0.07)",
  accent2: "#FFD700",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Manrope:wght@400;500;600&display=swap');`;

// Build suggestion chips — surface real subjects so the practice feature is discoverable
function buildChips(subjects, resources) {
  const withQs = (subjects || []).filter(s => (s.questions || []).length > 0);
  const chips = [];
  const topDoc = (resources || []).find(r => ["pdf", "docx", "note"].includes(r.contentType));
  if (topDoc) chips.push(`📄 Summarize "${(topDoc.title || "").slice(0, 34)}"`);
  if (withQs[0]) chips.push(`📋 ${withQs[0].label} practice questions`);
  chips.push("Explain a concept simply");
  if (withQs[1]) chips.push(`📋 ${withQs[1].label} practice questions`);
  chips.push("How do I use this app?");
  return chips.slice(0, 5);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Downscale an image (File or data URL) to a JPEG data URL — keeps payloads
// under the server's 10mb limit and speeds up multimodal calls.
function downscaleImage(src, maxDim = 1400, quality = 0.82) {
  const toDataUrl = typeof src === "string"
    ? Promise.resolve(src)
    : new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.onerror = () => reject(new Error("Failed to read image file"));
        r.readAsDataURL(src);
      });
  return toDataUrl.then(dataUrl => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Couldn't read that image format."));
    img.src = dataUrl;
  }));
}

// Map resolved bank questions to the ExamSimulator session shape.
function toExamSession(practice, maxQuestions = 50) {
  const pool = [...(practice.questions || [])]
    .sort(() => Math.random() - 0.5)
    .slice(0, maxQuestions)
    .map((q, i) => ({
      ...q,
      q: q.q || q.question,
      options: q.options || [],
      answer: q.answer ?? q.correctIndex ?? 0,
      key: `${practice.subjectId || "bank"}-${i}`,
      subjectId: practice.subjectId,
      subjectLabel: practice.subjectLabel,
      subjectIcon: practice.subjectIcon,
    }));
  return {
    mode: "exam",
    source: { id: practice.subjectId, label: practice.subjectLabel, icon: practice.subjectIcon },
    questions: pool,
    totalSeconds: pool.length * 90,
  };
}

async function fetchYouTubeVideo(ytQuery) {
  const cacheKey = `sc_yt3_${ytQuery}`;
  try {
    const hit = localStorage.getItem(cacheKey);
    if (hit) return JSON.parse(hit);
  } catch {}
  try {
    const res  = await fetch(`${API_BASE}/youtube/search?q=${encodeURIComponent(ytQuery)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const item = (data.items || [])[0];
    if (item) {
      const result = {
        videoId: item.videoId,
        title:   item.title,
        channel: item.channelTitle,
        url:     `https://www.youtube.com/watch?v=${item.videoId}`,
      };
      try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch {}
      return result;
    }
  } catch {}
  return null;
}

// Saved answers go into a dedicated "✦ AI Notes" space (a private folder) so
// they don't mix with regular materials in My Space. Find-or-create + cached id.
const AI_NOTES_FOLDER = "✦ AI Notes";
const AI_NOTES_FOLDER_KEY = "sc_ai_notes_folder_id";

async function ensureAINotesFolder() {
  try {
    const cached = localStorage.getItem(AI_NOTES_FOLDER_KEY);
    if (cached) return cached;
    const data = await listFolders();
    const existing = (data?.own || []).find(f => f.name === AI_NOTES_FOLDER);
    if (existing?.id) {
      try { localStorage.setItem(AI_NOTES_FOLDER_KEY, existing.id); } catch {}
      return existing.id;
    }
    const created = await createFolder({ name: AI_NOTES_FOLDER });
    if (created?.id) {
      try { localStorage.setItem(AI_NOTES_FOLDER_KEY, created.id); } catch {}
      return created.id;
    }
  } catch {}
  return null; // save loose if the folder can't be resolved
}

// ─── Tutor modes (Windsurf-style selector) ──────────────────────────────────
const MODES = [
  { id: "general",    icon: "✦",  label: "General" },
  { id: "materials",  icon: "📄", label: "Materials" },
  { id: "video",      icon: "▶️", label: "Video" },
  { id: "flashcards", icon: "🃏", label: "Flashcards" },
  { id: "quiz",       icon: "📝", label: "Quiz" },
  { id: "exam",       icon: "🎓", label: "Exam prep" },
];
const MODE_META = Object.fromEntries(MODES.map(m => [m.id, m]));

// Per-mode instructions appended to the prompt — they bias the output shape,
// not just the wording.
const MODE_PROMPTS = {
  materials: `\n- MODE: MATERIALS — the student wants help with their study materials. ALWAYS cite up to 3 exact document titles from the Research Hub list in "documents" and answer from their content when available.`,
  video: `\n- MODE: VIDEO — the student wants a video lesson. Keep "answer" brief (2-4 sentences framing the topic) and ALWAYS include a precise "ytQuery" for the best explanatory video.`,
  flashcards: `\n- MODE: FLASHCARDS — the student wants study flashcards. ALWAYS include a "flashcards" array of 8-12 items: {"front":"<term or question>","back":"<concise answer>"}. Keep "answer" as a 1-2 sentence intro to the deck.`,
  general: "",
};

// Keyword intent map — obvious phrases auto-route General mode to the right mode
const MODE_INTENTS = [
  { mode: "flashcards", re: /\bflash\s?cards?\b|\brevision cards?\b/i },
  { mode: "exam",       re: /\b(mock|timed|full)\s+exams?\b|\bexam\s*(prep|simulation|mode)\b|\btake (an?|the) exam\b/i },
  { mode: "quiz",       re: /\bquiz\b|\btest me\b|\bpractice questions?\b|\bpast questions?\b|\bmcqs?\b/i },
  { mode: "video",      re: /\bvideo\b|\byoutube\b|\bvideo lesson\b/i },
  { mode: "materials",  re: /\b(find|open|read|summari[sz]e|use)\s+(my|the|this|our)?\s*(notes?|pdfs?|documents?|materials?|slides|handouts?)\b/i },
];
function detectModeIntent(q) {
  for (const { mode, re } of MODE_INTENTS) if (re.test(q)) return mode;
  return null;
}

// Extract the in-progress "answer" string from partially-streamed JSON so the
// UI can render markdown as it arrives. Returns "" until the answer field starts.
function extractPartialAnswer(raw) {
  const m = raw.match(/"answer"\s*:\s*"/);
  if (!m) return "";
  let s = raw.slice(m.index + m[0].length);
  const next = s.search(/",\s*"/); // start of the next JSON field
  if (next >= 0) s = s.slice(0, next);
  if (s.endsWith("\\")) s = s.slice(0, -1); // mid-escape at stream boundary
  try { return JSON.parse(`"${s}"`); } catch {
    return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function parseAIResponse(raw, query) {
  try {
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}") + 1;
    const parsed = JSON.parse(raw.slice(s, e));
    if (!parsed.followUps || !Array.isArray(parsed.followUps)) parsed.followUps = [];
    if (!Array.isArray(parsed.documents)) parsed.documents = [];
    if (!parsed.answer) {
      // Legacy-shaped reply or model used different keys — salvage whatever text exists
      parsed.answer = [parsed.definition, parsed.explanation].filter(Boolean).join("\n\n") || raw;
    }
    return parsed;
  } catch {
    return { answer: raw, ytQuery: `${query} explained`, followUps: [], documents: [] };
  }
}

async function generateAIResponse(query, aiConfig, conversationHistory = [], subject = null, images = null, subjects = null, resources = null, opts = {}) {
  const disciplineId = detectDiscipline(subject?.label);
  const system = buildSystemPrompt({ mode: "chat", disciplineId, subject });
  const convo = buildConversationContext(conversationHistory, 8);
  const catalog = buildAppCatalog(subjects);
  // {{DOC_CATALOG}} is filled server-side with documents matching this question;
  // non-streaming fallbacks replace it with the client-side catalog.
  const docCatalog = buildDocCatalog(resources, { prefer: subject?.label });
  const modeSchema = opts.mode === "flashcards" ? `,"flashcards":[{"front":"<term or question>","back":"<concise answer>"}]` : "";
  const isGeneral = !opts.mode || opts.mode === "general";
  const prompt =
    `${system}\n\n${APP_FEATURES}\n\n{{DOC_CATALOG}}\n\n${catalog ? `${catalog}\n\n` : ""}${convo}\n\n` +
    `The student asked: "${query}"\n\n` +
    `Reply ONLY with valid JSON (no markdown code fences):\n` +
    (isGeneral
      // General mode — pure text chat. No documents/practice/video fields; the
      // model only suggests a better mode via "suggestMode" when clearly needed.
      ? `{"answer":"<REQUIRED — the full markdown answer the student reads. Size it to the question: a quick fact gets 1-3 sentences; an explanation/tutorial gets a well-structured answer with ## headings, bullet lists, **bold** key terms, and math like $x^2$ where helpful. If document content was provided, answer from it>","followUps":["<natural follow-up question 1>","<follow-up 2>","<follow-up 3>"],"suggestMode":"<one of: materials|video|flashcards|quiz|exam>"}\n\n` +
        `Rules:\n` +
        `- "answer" is REQUIRED and must never be empty.\n` +
        `- "followUps": max 3, max 60 chars each, progressing basic → advanced.\n` +
        `- "suggestMode": include ONLY when another mode clearly fits the request better — flashcards for cards/memorization, quiz when they want to be tested, exam for timed/mock tests, video when they want to watch a lesson, materials when they ask for their notes/documents. Omit it otherwise.\n` +
        `- If the student asks how to use the app, answer using the feature list above.`
      : `{"answer":"<REQUIRED — the full markdown answer the student reads. Size it to the question: a quick fact gets 1-3 sentences; an explanation/tutorial gets a well-structured answer with ## headings, bullet lists, **bold** key terms, and math like $x^2$ where helpful. If document content was provided, answer from it and mention which document>","ytQuery":"<6-8 word YouTube search query for a video lesson on this topic>","followUps":["<natural follow-up question 1>","<follow-up 2>","<follow-up 3>"],"documents":["<exact document title from the Research Hub list>"],"practice":{"subject":"<exact subject or document title from the lists above>","topic":"<exact topic label or topic phrase>"},"suggestMode":"<one of: materials|video|flashcards|quiz|exam>"${modeSchema}}\n\n` +
        `Rules:\n` +
        `- "answer" is REQUIRED and must never be empty.\n` +
        `- "documents": list up to 3 EXACT document titles from the Research Hub list when the student asks for notes/materials/PDFs, or when a listed document clearly covers their question. Copy titles EXACTLY. Omit the field otherwise.\n` +
        `- Include "practice" ONLY when the student asks for practice/quiz/past questions or to be tested on a subject the MCQ sets cover. Copy labels EXACTLY from the lists above. Omit the field entirely otherwise.\n` +
        `- "followUps": max 3, max 60 chars each, progressing basic → advanced.\n` +
        `- "suggestMode": include ONLY when another mode clearly fits the request better; omit otherwise.\n` +
        `- If the student asks how to use the app, answer using the feature list above.` +
        (MODE_PROMPTS[opts.mode] || ""));

  // Multimodal (images/scanned PDFs) — classic endpoint, client-side doc catalog
  if (images && images.length > 0) {
    const raw = await callAIMultimodal(prompt.replace("{{DOC_CATALOG}}", docCatalog || ""), images, [], aiConfig);
    return { parsed: parseAIResponse(raw, query), metaDocs: [] };
  }

  // Streaming tutor path — server matches Research Hub docs to the query
  const { raw, documents } = await callAITutor(prompt, aiConfig, {
    query: opts.query || query,
    onToken: opts.onToken,
    fallbackCatalog: docCatalog || "",
  });
  return { parsed: parseAIResponse(raw, query), metaDocs: documents };
}

async function generateAIQuestions(topic, aiConfig, subject = null, context = null) {
  const disciplineId = detectDiscipline(subject?.label);
  const system = buildSystemPrompt({ mode: "generate_quiz", disciplineId, subject });
  const prompt =
    `${system}\n\n` +
    `Generate a practice quiz about: "${topic}"\n\n` +
    (context ? `Base the questions on this study material:\n\n${context.slice(0, 12000)}\n\n` : "") +
    `Output STRICTLY a JSON array. NO prose before or after.\n` +
    `Each item: {"q": "question", "options": ["A","B","C","D"], "answer": 0, "explanation": "why correct"}\n` +
    `- "answer" is the 0-indexed correct option.\n` +
    `- Generate 5-10 well-distributed questions.\n` +
    `- Mix recall, application, and analysis levels.\n` +
    `- Avoid trick questions.`;
  const raw = await callAI(prompt, aiConfig);
  const questions = extractJSON(raw, "array");
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("AI did not return valid questions.");
  }
  return questions.map(q => ({
    q: q.q || q.question || "",
    options: q.options || [],
    answer: q.answer ?? q.correctIndex ?? 0,
    explanation: q.explanation || q.explain || "",
  })).filter(q => q.q && q.options.length >= 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "13px 14px" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: D.accent2, display: "inline-block",
          animation: `scBounce 1.2s ${i * 0.2}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`@keyframes scBounce{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-5px)}}`}</style>
    </div>
  );
}

function VideoLesson({ video, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "0.5px solid #2a1515" }}>
      {/* Thumbnail / embed toggle row */}
      <div
        onClick={() => setExpanded(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
          background: "#100808", cursor: "pointer",
        }}
      >
        <div style={{
          width: 42, height: 30, background: "#1a0808", border: "0.5px solid #3a1010",
          borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0, color: "#ef5350",
        }}>▶</div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#e57373", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {video.title}
          </div>
          <div style={{ fontSize: 10, color: "#5a3030", marginTop: 2 }}>{video.channel}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#5a3030", fontFamily: "Manrope,sans-serif" }}>
            {expanded ? "▲ hide" : "▼ watch"}
          </span>
          <a
            href={video.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 13, color: "#5a3030", textDecoration: "none" }}
            title="Open on YouTube"
          >↗</a>
        </div>
      </div>

      {/* Embedded player */}
      {expanded && (
        <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
          <iframe
            src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
              border: "none",
            }}
            title={video.title}
          />
        </div>
      )}
    </div>
  );
}

// Rough markdown → plain text for speech synthesis
function stripMd(s) {
  return (s || "")
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/[#>*`_~]/g, "")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Studocu-style practice card — real questions pulled from the app's bank
function PracticeCard({ practice, onQuick, onExam }) {
  const total = practice.total ?? practice.questions?.length ?? 0;
  return (
    <div style={{
      margin: "10px 0 2px", padding: "12px 14px", borderRadius: 12,
      background: "linear-gradient(135deg, rgba(255,215,0,0.09), rgba(255,215,0,0.03))",
      border: `0.5px solid ${D.border}`,
      fontFamily: "Manrope,sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{practice.subjectIcon || "📚"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {practice.subjectLabel}{practice.topic ? ` · ${practice.topic}` : ""}
          </div>
          <div style={{ fontSize: 10.5, color: D.muted, marginTop: 2 }}>
            {total} question{total !== 1 ? "s" : ""} · {practice.resource ? "from your Research Hub" : "from your question bank"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={onQuick}
          style={{
            flex: 1, minWidth: 130, padding: "8px 12px", borderRadius: 9,
            background: `linear-gradient(135deg, ${D.border}, #DAA520)`, border: "none",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: "Manrope,sans-serif",
          }}
        >⚡ Quick practice</button>
        {onExam && (
          <button
            onClick={onExam}
            style={{
              flex: 1, minWidth: 130, padding: "8px 12px", borderRadius: 9,
              background: "transparent", border: `0.5px solid ${D.border}`,
              color: D.accent2, fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "Manrope,sans-serif",
            }}
          >📝 Full exam (timed)</button>
        )}
      </div>
    </div>
  );
}

function AIMessageBubble({ data, onStartPractice, onStartExam, onFollowUp, onQuickAction, onOpenResource, onAskDoc, onQuizDoc, onSave, onSaveDeck, onSwitchMode, showFollowUps = true }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showVideo, setShowVideo] = useState(!!data.autoVideo);
  const [video, setVideo] = useState(data.video || null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deckSaved, setDeckSaved] = useState(false);
  const [deckSaving, setDeckSaving] = useState(false);
  const followUps = (data.followUps || []).slice(0, 3);
  // Freeform answer (new) with legacy definition+explanation fallback (old saved convos)
  const answer = data.answer || [data.definition, data.explanation].filter(Boolean).join("\n\n");
  const hasBank = (data.practice?.questions?.length || 0) > 0 || (data.questions || []).length > 0;
  const quickActions = [
    { icon: "🔍", label: "Simpler", action: () => onQuickAction?.("explain_simpler", data.topic) },
    { icon: "📝", label: "Test me", action: () => onQuickAction?.("test_me", data.topic) },
    { icon: "🃏", label: "Flashcards", action: () => onQuickAction?.("flashcards", data.topic) },
    { icon: "📖", label: "Example", action: () => onQuickAction?.("example", data.topic) },
  ];

  useEffect(() => () => { if (speaking) window.speechSynthesis?.cancel(); }, [speaking]);

  function copyAnswer() {
    navigator.clipboard.writeText(answer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggleSpeak() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(stripMd(answer).slice(0, 3000));
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  }

  // YouTube is lazy — only searched when the student actually clicks Video
  async function toggleVideo() {
    if (video) { setShowVideo(o => !o); return; }
    if (videoBusy || !data.ytQuery) return;
    setVideoBusy(true);
    try {
      const v = await fetchYouTubeVideo(data.ytQuery);
      if (v) { setVideo(v); setShowVideo(true); }
      else toast.info("No video found for this topic.");
    } finally {
      setVideoBusy(false);
    }
  }

  async function handleSave() {
    if (saving || saved || !onSave) return;
    setSaving(true);
    const ok = await onSave(data);
    setSaving(false);
    if (ok) setSaved(true);
  }

  async function handleSaveDeck() {
    if (deckSaving || deckSaved || !onSaveDeck) return;
    setDeckSaving(true);
    const ok = await onSaveDeck(data);
    setDeckSaving(false);
    if (ok) setDeckSaved(true);
  }

  const iconBtn = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 9px", borderRadius: 7,
    background: active ? D.accent : "transparent",
    border: `0.5px solid ${active ? D.border : D.line}`,
    fontSize: 11, color: active ? D.accent2 : D.hint,
    cursor: "pointer", fontFamily: "Manrope,sans-serif", transition: "all 0.15s",
  });

  return (
    <div style={{
      alignSelf: "flex-start", width: "100%",
      animation: "scSlideIn 0.3s ease",
    }}>
      <style>{`@keyframes scSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9, flexShrink: 0, marginTop: 2,
          background: D.accent, border: `0.5px solid ${D.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, color: D.accent2,
        }}>✦</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Mode badge */}
          {data.mode && data.mode !== "general" && MODE_META[data.mode] && (
            <div style={{ marginBottom: 6 }}>
              <span style={{
                fontSize: 9.5, padding: "2px 9px", borderRadius: 10,
                background: D.accent, border: `0.5px solid ${D.line}`,
                color: D.hint, fontWeight: 600, fontFamily: "Manrope,sans-serif",
              }}>{MODE_META[data.mode].icon} {MODE_META[data.mode].label}</span>
            </div>
          )}

          {/* Freeform markdown answer */}
          <MarkdownText theme="gold">{answer}</MarkdownText>

          {/* Mode suggestion — one tap switches mode and re-asks the question */}
          {data.suggestMode && MODE_META[data.suggestMode] && onSwitchMode && (
            <div style={{ margin: "8px 0 2px" }}>
              <button
                onClick={() => onSwitchMode(data.suggestMode, data.question || data.topic)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 13px", borderRadius: 16,
                  background: "transparent", border: `0.5px dashed ${D.border}`,
                  color: D.accent2, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "Manrope,sans-serif", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = D.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >{MODE_META[data.suggestMode].icon} Switch to {MODE_META[data.suggestMode].label} →</button>
            </div>
          )}

          {/* Research Hub documents the AI cited */}
          {(data.documents || []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, margin: "10px 0 2px" }}>
              {(data.documents || []).slice(0, 3).map((doc, i) => (
                <DocCard
                  key={doc.shareToken || doc.id || i}
                  doc={doc}
                  onOpen={onOpenResource ? () => onOpenResource(doc.shareToken) : null}
                  onAsk={onAskDoc}
                  onQuiz={onQuizDoc}
                />
              ))}
            </div>
          )}

          {/* Practice card — real bank questions */}
          {data.practice && hasBank && (
            <PracticeCard
              practice={data.practice}
              onQuick={onStartPractice}
              onExam={onStartExam ? () => onStartExam(data.practice) : null}
            />
          )}

          {/* Fallback — no bank match, offer AI-generated practice (not in General) */}
          {!hasBank && data.mode !== "general" && (
            <div style={{ margin: "8px 0 2px" }}>
              <button
                onClick={onStartPractice}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 13px", borderRadius: 16,
                  background: D.accent, border: `0.5px solid ${D.border}`,
                  fontSize: 11, fontWeight: 600, color: D.accent2, cursor: "pointer",
                  fontFamily: "Manrope,sans-serif",
                }}
              >✦ Generate practice questions</button>
            </div>
          )}

          {/* Flashcards (Flashcards mode) */}
          {(data.flashcards || []).length > 0 && (
            <FlashcardList
              cards={data.flashcards}
              onSave={onSaveDeck ? handleSaveDeck : null}
              saved={deckSaved}
              saving={deckSaving}
            />
          )}

          {/* Video (lazy — fetched on first click; auto-expanded in Video mode) */}
          {showVideo && video && (
            <div style={{ padding: "4px 0 8px" }}>
              <VideoLesson video={video} defaultExpanded={!!data.autoVideo} />
            </div>
          )}

          {/* Slim action bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
            marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${D.line2}`,
          }}>
            <button onClick={copyAnswer} style={iconBtn(copied)} title="Copy answer">
              {copied ? "✓ Copied" : "⧉ Copy"}
            </button>
            {window.speechSynthesis && (
              <button onClick={toggleSpeak} style={iconBtn(speaking)} title="Read aloud">
                {speaking ? "⏹ Stop" : "🔊 Listen"}
              </button>
            )}
            {(video || data.ytQuery) && (
              <button onClick={toggleVideo} disabled={videoBusy} style={iconBtn(showVideo)} title="Video lesson">
                {videoBusy ? "⏳ Loading…" : showVideo ? "▲ Hide video" : "▶️ Video"}
              </button>
            )}
            {onSave && (
              <button onClick={handleSave} disabled={saving || saved} style={iconBtn(saved)} title="Save to Research Hub">
                {saved ? "✓ Saved" : saving ? "⏳ Saving…" : "💾 Save"}
              </button>
            )}
            <span style={{ flex: 1 }} />
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={qa.action}
                style={iconBtn(false)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.accent2; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.color = D.hint; }}
              >
                <span>{qa.icon}</span>{qa.label}
              </button>
            ))}
          </div>

          {/* Follow-up suggestions — only on the latest reply (ChatGPT-style) */}
          {showFollowUps && followUps.length > 0 && (
            <div style={{ padding: "10px 0 2px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {followUps.map((fu, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowUp?.(fu)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7, width: "100%",
                      padding: "7px 10px", borderRadius: 9,
                      background: "transparent", border: `0.5px solid ${D.line}`,
                      fontSize: 12, color: D.muted, cursor: "pointer",
                      fontFamily: "Manrope,sans-serif", textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.accent; e.currentTarget.style.color = D.text; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.muted; }}
                  >
                    <span style={{ fontSize: 10, color: D.faint, flexShrink: 0 }}>💡</span>
                    <span>{fu}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: D.faint }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PracticeView({ data, onBack, aiConfig, onStartExam, onReviewMistakes }) {
  const [answered, setAnswered] = useState({});
  const [extraQuestions, setExtraQuestions] = useState(null);
  const [genError, setGenError] = useState(null);
  const genStarted = useRef(false);

  const bankQuestions = (data.questions || []).slice(0, 20);
  const questions = bankQuestions.length > 0 ? bankQuestions : (extraQuestions || []);
  const total = questions.length;
  const done  = Object.keys(answered).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const correct = questions.reduce((acc, q, i) => {
    const ci = q.answer ?? q.correctIndex ?? 0;
    return acc + (answered[i] === ci ? 1 : 0);
  }, 0);
  const finished = total > 0 && done === total;
  const wrong = finished
    ? questions
        .map((q, i) => ({ q, sel: answered[i] }))
        .filter(({ q, sel }) => sel !== undefined && sel !== (q.answer ?? q.correctIndex ?? 0))
        .map(({ q, sel }) => ({
          q: q.q || q.question,
          chosen: (q.options || [])[sel],
          correct: (q.options || [])[q.answer ?? q.correctIndex ?? 0],
        }))
    : [];

  function pick(qi, oi) {
    if (answered[qi] !== undefined) return;
    setAnswered(p => ({ ...p, [qi]: oi }));
  }

  const topic = data.topic || data.ytQuery || "";

  useEffect(() => {
    if (genStarted.current) return;
    if (bankQuestions.length > 0 || extraQuestions || !aiConfig || !topic) return;
    genStarted.current = true;
    generateAIQuestions(topic, aiConfig, data.subjectLabel ? { label: data.subjectLabel } : null, data.docContext || null)
      .then(qs => {
        if (qs && qs.length > 0) {
          setExtraQuestions(qs);
        } else {
          setGenError("No questions could be generated. Try rephrasing your topic.");
        }
      })
      .catch(err => {
        setGenError(err?.message || "Failed to generate questions. Check your AI settings.");
      });
  }, [bankQuestions.length, extraQuestions, genError, aiConfig, topic, data.subjectLabel, data.docContext]);

  if (!total) {
    if (!genError && aiConfig && topic) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${D.line}`, borderTopColor: D.border, animation: "scSpin 0.8s linear infinite" }} />
          <style>{`@keyframes scSpin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ color: D.muted, fontSize: 13, textAlign: "center", fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
            Generating practice questions with AI…<br />
            <span style={{ fontSize: 11, color: D.hint }}>This may take a few seconds</span>
          </div>
        </div>
      );
    }
    if (genError) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
          <div style={{ fontSize: 40 }}>📝</div>
          <div style={{ color: D.muted, fontSize: 13, textAlign: "center", fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
            {genError}<br />
            <span style={{ fontSize: 11, color: D.hint }}>No questions in the bank for this topic yet.</span>
          </div>
          <button onClick={() => { setGenError(null); genStarted.current = false; }}
            style={{
              padding: "7px 16px", borderRadius: 20,
              background: D.accent, border: `0.5px solid ${D.border}`,
              color: D.accent2, cursor: "pointer", fontSize: 12, fontFamily: "Manrope,sans-serif",
            }}>↻ Retry generation</button>
          <button onClick={onBack} style={{
            padding: "8px 20px", borderRadius: 20,
            background: "transparent", border: `0.5px solid ${D.line}`,
            color: D.muted, cursor: "pointer", fontSize: 12, fontFamily: "Manrope,sans-serif",
          }}>← Back to chat</button>
        </div>
      );
    }
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
        <div style={{ fontSize: 40 }}>📝</div>
        <div style={{ color: D.muted, fontSize: 13, textAlign: "center", fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
          No questions available.<br />Try a different topic from your study subjects.
        </div>
        <button onClick={onBack} style={{
          padding: "8px 20px", borderRadius: 20,
          background: D.accent, border: `0.5px solid ${D.border}`,
          color: D.accent2, cursor: "pointer", fontSize: 12, fontFamily: "Manrope,sans-serif",
        }}>← Back to chat</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Practice header */}
      <div style={{ padding: "12px 14px", borderBottom: `0.5px solid ${D.line2}`, background: D.bar, flexShrink: 0 }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 2 }}>
          {data.topic}
        </div>
        <div style={{ fontSize: 10, color: D.hint, fontFamily: "Manrope,sans-serif" }}>
          {data.subjectLabel || "AI-generated"} · {total} questions · {done} answered
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 7, overflow: "hidden" }}>
          <div style={{ height: "100%", background: D.border, borderRadius: 2, width: `${pct}%`, transition: "width 0.35s" }} />
        </div>
      </div>

      {/* Practice body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, scrollbarWidth: "none" }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: D.hint,
            background: "none", border: "none", cursor: "pointer",
            padding: "2px 0 12px", fontFamily: "Manrope,sans-serif",
          }}
        >← Back to AI explanation</button>

        {questions.map((q, qi) => {
          const sel       = answered[qi];
          const isAnswered = sel !== undefined;
          const correctIdx = q.answer ?? q.correctIndex ?? 0;

          return (
            <div key={qi} style={{
              background: D.card, border: `0.5px solid ${D.line}`,
              borderRadius: 12, padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, color: D.faint, fontWeight: 600, marginBottom: 6, fontFamily: "Manrope,sans-serif" }}>
                Q{qi + 1} of {total}
              </div>
              <div style={{ fontSize: 13, color: D.text, lineHeight: 1.55, marginBottom: 12, fontFamily: "Manrope,sans-serif" }}>
                {q.q || q.question}
              </div>

              {(q.options || []).map((opt, oi) => {
                let bg = "transparent", border = `0.5px solid ${D.line}`, color = D.muted;
                if (isAnswered) {
                  if (oi === correctIdx)           { bg = "#0f2a1a"; border = "0.5px solid #2a6a3a"; color = "#a5d6a7"; }
                  else if (oi === sel && oi !== correctIdx) { bg = "#2a0f0f"; border = "0.5px solid #6a2a2a"; color = "#ef9a9a"; }
                  else                             { color = D.hint; }
                }
                return (
                  <button
                    key={oi} onClick={() => pick(qi, oi)} disabled={isAnswered}
                    style={{
                      display: "flex", alignItems: "center", gap: 9, width: "100%",
                      padding: "8px 10px", borderRadius: 8, border, background: bg, color,
                      cursor: isAnswered ? "default" : "pointer", marginBottom: 6,
                      fontSize: 12, fontFamily: "Manrope,sans-serif", textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!isAnswered) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.accent2; e.currentTarget.style.background = D.accent; }}}
                    onMouseLeave={e => { if (!isAnswered) { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.color = D.muted; e.currentTarget.style.background = "transparent"; }}}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: D.accent, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 10, fontWeight: 700, color: D.muted,
                    }}>{String.fromCharCode(65 + oi)}</span>
                    {opt}
                  </button>
                );
              })}

              {isAnswered && (q.explanation || q.explain) && (
                <div style={{
                  background: D.accent, border: `0.5px solid ${D.line}`,
                  borderRadius: 8, padding: "9px 11px", marginTop: 8,
                  fontSize: 11, color: D.muted, lineHeight: 1.55, fontFamily: "Manrope,sans-serif",
                }}>
                  <strong style={{ color: "#a5d6a7" }}>Explanation: </strong>
                  {q.explanation || q.explain}
                </div>
              )}
            </div>
          );
        })}

        {/* Results summary */}
        {finished && (
          <div style={{
            margin: "4px 0 20px", padding: 16, borderRadius: 14, textAlign: "center",
            background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.03))",
            border: `0.5px solid ${D.border}`, fontFamily: "Manrope,sans-serif",
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>
              {pct === 100 ? "🏆" : correct / total >= 0.7 ? "🎉" : correct / total >= 0.4 ? "💪" : "📚"}
            </div>
            <div style={{ fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 700, color: D.text }}>
              {correct}/{total} correct
            </div>
            <div style={{ fontSize: 11, color: D.muted, marginTop: 3 }}>
              {Math.round((correct / total) * 100)}% · scroll up to review explanations
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => setAnswered({})}
                style={{
                  padding: "8px 16px", borderRadius: 20,
                  background: D.accent, border: `0.5px solid ${D.border}`,
                  color: D.accent2, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "Manrope,sans-serif",
                }}
              >↻ Retake</button>
              {onStartExam && data.practice && (
                <button
                  onClick={() => onStartExam(data.practice)}
                  style={{
                    padding: "8px 16px", borderRadius: 20,
                    background: `linear-gradient(135deg, ${D.border}, #DAA520)`, border: "none",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: "Manrope,sans-serif",
                  }}
                >📝 Take as full exam</button>
              )}
              {wrong.length > 0 && onReviewMistakes && (
                <button
                  onClick={() => onReviewMistakes(wrong)}
                  style={{
                    padding: "8px 16px", borderRadius: 20,
                    background: D.accent, border: `0.5px solid ${D.border}`,
                    color: D.accent2, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "Manrope,sans-serif",
                  }}
                >💬 Review {wrong.length} mistake{wrong.length !== 1 ? "s" : ""} with AI</button>
              )}
              <button
                onClick={onBack}
                style={{
                  padding: "8px 16px", borderRadius: 20,
                  background: "transparent", border: `0.5px solid ${D.line}`,
                  color: D.muted, fontSize: 12, cursor: "pointer",
                  fontFamily: "Manrope,sans-serif",
                }}
              >← Back to chat</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadMenu({ open, onClose, onSelectDoc, onSelectImg }) {
  if (!open) return null;
  const opts = [
    { icon: "📄", label: "PDF / Notes",  action: () => { onSelectDoc(); onClose(); } },
    { icon: "🖼️", label: "Upload Image", action: () => { onSelectImg(); onClose(); } },
    { icon: "📁", label: "Google Drive (soon)", action: onClose },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 46, left: 0,
      background: D.card, border: `0.5px solid ${D.line}`,
      borderRadius: 12, padding: 6, width: 172, zIndex: 20,
      boxShadow: "0 8px 32px #00000066",
    }}>
      {opts.map(o => (
        <button
          key={o.label} onClick={o.action}
          style={{
            display: "flex", alignItems: "center", gap: 9, width: "100%",
            padding: "8px 10px", borderRadius: 8, border: "none",
            background: "none", cursor: "pointer",
            fontSize: 12, color: D.muted, fontFamily: "Manrope,sans-serif",
          }}
          onMouseEnter={e => e.currentTarget.style.background = D.accent}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <span>{o.icon}</span>{o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chat history utils ─────────────────────────────────────────────────────
const HISTORY_KEY = "sc_ai_convos";
const MAX_CONVOS  = 50;

function loadConvos() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveConvos(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_CONVOS))); } catch {}
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ─── History panel ────────────────────────────────────────────────────────────
function HistoryPanel({ open, onClose, conversations, onLoad, onDelete, onNewChat }) {
  return (
    <>
      <style>{`
        @keyframes scSlideLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes scFadeIn{from{opacity:0}to{opacity:1}}
        .sc-hist-item:hover .sc-hist-del{opacity:1!important}
      `}</style>

      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "absolute", inset: 0, zIndex: 9,
            background: "rgba(0,0,0,0.55)",
            animation: "scFadeIn 0.2s ease",
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: "82%", maxWidth: 320, zIndex: 10,
        background: "#0A0D13", borderRight: `0.5px solid ${D.line}`,
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
        boxShadow: open ? "4px 0 32px #00000088" : "none",
      }}>
        {/* Panel header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "16px 14px 12px",
          borderBottom: `0.5px solid ${D.line2}`,
          background: D.bar, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: D.text }}>Chat History</div>
            <div style={{ fontSize: 10, color: D.hint, marginTop: 2 }}>{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</div>
          </div>
          <button
            onClick={onNewChat}
            style={{
              padding: "5px 11px", borderRadius: 8,
              background: D.accent, border: `0.5px solid ${D.border}`,
              fontSize: 11, fontWeight: 600, color: D.accent2,
              cursor: "pointer", fontFamily: "Manrope,sans-serif",
            }}
          >+ New</button>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: D.accent, border: `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: D.muted, fontSize: 14, flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
              <div style={{ fontSize: 13, color: D.hint, fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
                No conversations yet.<br />Ask a question to get started!
              </div>
            </div>
          ) : (
            conversations.map(c => (
              <div
                key={c.id}
                className="sc-hist-item"
                onClick={() => { onLoad(c); onClose(); }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 14px", cursor: "pointer",
                  borderBottom: `0.5px solid ${D.line2}`,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = D.accent}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: D.accent, border: `0.5px solid ${D.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>💬</div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: D.text,
                    fontFamily: "Manrope,sans-serif",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 3,
                  }}>{c.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: D.hint, fontFamily: "Manrope,sans-serif" }}>{timeAgo(c.ts)}</span>
                    <span style={{ fontSize: 10, color: D.faint }}>·</span>
                    <span style={{ fontSize: 10, color: D.hint, fontFamily: "Manrope,sans-serif" }}>
                      {c.messages.filter(m => m.type === "user").length} message{c.messages.filter(m => m.type === "user").length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  className="sc-hist-del"
                  onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                  style={{
                    opacity: 0, width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: "#2a0f0f", border: "0.5px solid #4a1010",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: 12, color: "#ef9a9a",
                    transition: "opacity 0.15s",
                  }}
                  title="Delete"
                >🗑</button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Research Hub document cards ─────────────────────────────────────────────

function slimDoc(r) {
  return {
    id: r.id, shareToken: r.shareToken, title: r.title,
    contentType: r.contentType, subject: r.subject || null, courseCode: r.courseCode || null,
  };
}

// Match AI-cited document titles against real Research Hub resources
function resolveDocRefs(titles, resources, max = 3) {
  if (!Array.isArray(titles) || !resources?.length) return [];
  const out = [];
  const used = new Set();
  for (const t of titles.slice(0, max)) {
    const [match] = findResources(String(t), resources, 1);
    if (match && !used.has(match.id)) {
      used.add(match.id);
      out.push(slimDoc(match));
    }
  }
  return out;
}

function DocCard({ doc, onOpen, onAsk, onQuiz }) {
  const meta = docTypeMeta(doc.contentType);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderRadius: 11, background: D.card, border: `0.5px solid ${D.line}`,
      fontFamily: "Manrope,sans-serif",
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0, fontSize: 16,
        background: D.accent, border: `0.5px solid ${D.line}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {doc.title}
        </div>
        <div style={{ fontSize: 10.5, color: D.hint, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {meta.tag}{doc.subject ? ` · ${doc.subject}` : ""}{doc.courseCode ? ` · ${doc.courseCode}` : ""}
        </div>
      </div>
      {onAsk && (
        <button onClick={() => onAsk(doc)} title="Read this document with AI"
          style={{
            padding: "6px 10px", borderRadius: 8, flexShrink: 0, cursor: "pointer",
            background: "transparent", border: `0.5px solid ${D.line}`,
            color: D.muted, fontSize: 11, fontFamily: "Manrope,sans-serif", fontWeight: 600,
          }}>✦ Ask AI</button>
      )}
      {onQuiz && (
        <button onClick={() => onQuiz(doc)} title="Generate practice questions from this document"
          style={{
            padding: "6px 10px", borderRadius: 8, flexShrink: 0, cursor: "pointer",
            background: "transparent", border: `0.5px solid ${D.line}`,
            color: D.muted, fontSize: 11, fontFamily: "Manrope,sans-serif", fontWeight: 600,
          }}>✎ Quiz</button>
      )}
      {onOpen && (
        <button onClick={onOpen} title="Open document"
          style={{
            padding: "6px 12px", borderRadius: 8, flexShrink: 0, cursor: "pointer",
            background: `linear-gradient(135deg, ${D.border}, #DAA520)`, border: "none",
            color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "Manrope,sans-serif",
          }}>Open</button>
      )}
    </div>
  );
}

// Windsurf-style mode selector — slim pills above the input
function ModeBar({ mode, onChange }) {
  return (
    <div style={{ padding: "6px 14px 0", background: D.bar, flexShrink: 0 }}>
      <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none" }}>
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              title={m.id === "quiz" ? "Jump straight into practice" : m.id === "exam" ? "Build a timed exam" : `${m.label} mode`}
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 14,
                background: active ? D.accent : "transparent",
                border: `0.5px solid ${active ? D.border : D.line2}`,
                fontSize: 10.5, fontWeight: active ? 700 : 500,
                color: active ? D.accent2 : D.hint,
                cursor: "pointer", fontFamily: "Manrope,sans-serif",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}
            >{m.icon} {m.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// Tap-to-flip flashcard grid for Flashcards mode
function FlashcardList({ cards, onSave, saved, saving }) {
  const [flipped, setFlipped] = useState({});
  return (
    <div style={{ margin: "10px 0 2px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
        {cards.map((c, i) => (
          <button
            key={i}
            onClick={() => setFlipped(p => ({ ...p, [i]: !p[i] }))}
            style={{
              minHeight: 90, padding: "10px 11px", borderRadius: 11, textAlign: "left",
              background: flipped[i] ? D.accent : D.card,
              border: `0.5px solid ${flipped[i] ? D.border : D.line}`,
              cursor: "pointer", fontFamily: "Manrope,sans-serif",
            }}
          >
            <div style={{ fontSize: 9, color: D.faint, marginBottom: 5, fontWeight: 700, letterSpacing: 0.5 }}>
              {flipped[i] ? "BACK" : "FRONT"} · {i + 1}
            </div>
            <div style={{ fontSize: 11.5, color: flipped[i] ? D.accent2 : D.text, lineHeight: 1.45 }}>
              {flipped[i] ? c.back : c.front}
            </div>
          </button>
        ))}
      </div>
      {onSave && (
        <button
          onClick={onSave}
          disabled={saving || saved}
          style={{
            marginTop: 9, padding: "6px 13px", borderRadius: 16,
            background: saved ? "transparent" : D.accent,
            border: `0.5px solid ${saved ? D.line : D.border}`,
            color: saved ? D.hint : D.accent2, fontSize: 11, fontWeight: 600,
            cursor: saved ? "default" : "pointer", fontFamily: "Manrope,sans-serif",
          }}
        >{saving ? "⏳ Saving…" : saved ? "✓ Deck saved to AI Notes" : `💾 Save ${cards.length}-card deck`}</button>
      )}
    </div>
  );
}

function useVoiceInput(onTranscript) {
  const [listening, setListening]   = useState(false);
  const supported                   = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recognitionRef              = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous      = false;
      r.interimResults  = true;
      r.lang            = "en-US";
      r.onresult = e => {
        let interim = "", final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          e.results[i].isFinal ? (final += t) : (interim += t);
        }
        onTranscript(final || interim, !!final);
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recognitionRef.current = r;
    }
  // eslint-disable-next-line
  }, []);

  function toggle() {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) { r.stop(); setListening(false); }
    else           { r.start(); setListening(true); }
  }

  return { listening, supported, toggle };
}

// ─── InputBar (shared) ────────────────────────────────────────────────────────
function InputBar({ value, onChange, onSend, loading, placeholder = "Ask a question…", showUpload = true, attachment, onClearAttachment, onSelectDoc, onSelectImg }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const docRef = useRef(null);
  const imgRef = useRef(null);
  const canSend = !loading && !attachment?.loading && (value.trim().length > 0 || !!attachment);

  const voice = useVoiceInput((transcript, isFinal) => {
    onChange({ target: { value: transcript } });
    if (isFinal && transcript.trim()) setTimeout(() => onSend(), 120);
  });

  function triggerDoc() { docRef.current?.click(); }
  function triggerImg() { imgRef.current?.click(); }

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Hidden file inputs */}
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }}
        onChange={e => { onSelectDoc?.(e.target.files[0]); e.target.value = ""; }} />
      <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { onSelectImg?.(e.target.files[0]); e.target.value = ""; }} />

      <div style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* Attachment preview strip */}
      {attachment && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px 0", background: D.bar,
        }}>
          {attachment.loading ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              background: D.bar, border: `0.5px solid ${D.line}`,
              borderRadius: 8, padding: "6px 10px",
            }}>
              <span style={{ fontSize: 14, display: "inline-block", animation: "scSpin 0.9s linear infinite" }}>⏳</span>
              <style>{`@keyframes scSpin{to{transform:rotate(360deg)}}`}</style>
              <span style={{ fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Reading {attachment.name}…
              </span>
            </div>
          ) : attachment.type === "img" ? (
            <img src={attachment.dataUrl} alt="preview" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: `0.5px solid ${D.line}` }} />
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              background: D.bar, border: `0.5px solid ${D.line}`,
              borderRadius: 8, padding: "6px 10px",
            }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <span style={{ fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {attachment.name}
              </span>
            </div>
          )}
          <button onClick={onClearAttachment} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: D.hint, cursor: "pointer", fontSize: 16, padding: "2px 6px",
          }}>✕</button>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px 18px", background: D.bar,
        borderTop: attachment ? "none" : `0.5px solid ${D.line2}`,
        position: "relative",
        ...(attachment ? {} : {}),
      }}>
        {/* Top border only when no attachment */}
        {!attachment && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5px", background: D.line2 }} />}

        {showUpload && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setUploadOpen(o => !o)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: D.bar, border: `0.5px solid ${D.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: D.muted, fontSize: 20, flexShrink: 0,
              }}
            >+</button>
            <UploadMenu
              open={uploadOpen}
              onClose={() => setUploadOpen(false)}
              onSelectDoc={triggerDoc}
              onSelectImg={triggerImg}
            />
          </div>
        )}
        <textarea
          value={value} onChange={onChange}
          rows={1}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          placeholder={voice.listening ? "🎤 Listening…" : placeholder}
          style={{
            flex: 1, background: D.bar, resize: "none",
            border: voice.listening ? "0.5px solid #ef4444" : `0.5px solid ${D.line}`,
            borderRadius: 18, padding: "9px 14px", fontSize: 12,
            color: voice.listening ? "#fca5a5" : D.accent2,
            fontFamily: "Manrope,sans-serif", lineHeight: 1.5,
            outline: "none", transition: "border-color 0.2s, color 0.2s",
            maxHeight: 120, overflowY: "auto",
          }}
          onFocus={e => { if (!voice.listening) e.target.style.borderColor = D.border; }}
          onBlur={e  => { if (!voice.listening) e.target.style.borderColor = D.line;   }}
        />
        {/* Mic button — only shown if browser supports SpeechRecognition */}
        {voice.supported && (
          <>
            <style>{`
              @keyframes scPulse{0%,100%{box-shadow:0 0 0 0 #ef444466}50%{box-shadow:0 0 0 6px #ef444400}}
              .sc-mic-active{animation:scPulse 1s infinite;background:#2a0a0a!important;border-color:#ef4444!important;color:#ef4444!important}
            `}</style>
            <button
              onClick={voice.toggle}
              title={voice.listening ? "Stop listening" : "Voice input"}
              className={voice.listening ? "sc-mic-active" : ""}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: D.bar, border: `0.5px solid ${D.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 15, flexShrink: 0,
                color: D.muted, transition: "all 0.2s",
              }}
            >{voice.listening ? "⏹" : "🎤"}</button>
          </>
        )}

        <button
          onClick={onSend} disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: canSend ? D.accent : "#11151E",
            border: `0.5px solid ${canSend ? D.border : D.line2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: canSend ? "pointer" : "default",
            color: canSend ? D.accent2 : D.faint,
            fontSize: 16, flexShrink: 0, transition: "all 0.15s",
          }}
        >→</button>
      </div>
      </div>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
export default function AISectionOverlay({ aiConfig, subjects, onExit, defaultView = "chat", studyTopic = "", studyMode = "input", studyAttachment = null, studyContext = null, onStartExam, onOpenResource }) {
  const [view, setView]             = useState(defaultView === "learn" ? "chat" : (defaultView || "chat"));
  const [messages, setMsgs]         = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConvos]  = useState(() => loadConvos());
  const [currentId, setCurrentId]   = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [resources, setResources] = useState(() => {
    // Seed from the same cache Research Hub writes — instant catalog, refreshed below
    try {
      const raw = localStorage.getItem("sc_resources_list");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed?.data) && parsed.data.length) return parsed.data;
    } catch {}
    return [];
  });
  const [activeDoc, setActiveDoc]   = useState(null); // pinned document context (slim doc)
  const [mode, setMode]             = useState("general"); // tutor mode selector
  const bottomRef                   = useRef(null);
  const docTextCache                = useRef({}); // resourceId -> { text, images }

  async function handleDocSelect(file) {
    if (!file) return;
    setAttachment({ type: "doc", name: file.name, content: "Extracting text…", dataUrl: null, loading: true });
    try {
      const result = await extractTextFromFile(file);
      const rawText = result.text || "";
      const text = rawText.length > 14000 ? rawText.slice(0, 14000) + "\n\n[...document truncated...]" : rawText;
      // Scanned PDFs come back as PNG page renders — compress to JPEG
      const images = [];
      for (const img of (result.images || []).slice(0, 4)) {
        try { images.push(await downscaleImage(img, 1400, 0.8)); } catch {}
      }
      setAttachment({
        type: images.length > 0 && !text ? "img" : "doc",
        name: file.name,
        content: text || (images.length > 0 ? "(scanned document — sending as images)" : ""),
        dataUrl: images[0] || null,
        images,
        loading: false,
      });
    } catch (err) {
      setAttachment(null);
      toast.error(`Couldn't read "${file.name}": ${err.message}`);
    }
  }

  async function handleImgSelect(file) {
    if (!file) return;
    setAttachment({ type: "img", name: file.name, content: null, dataUrl: null, loading: true });
    try {
      const dataUrl = await downscaleImage(file, 1400, 0.82);
      setAttachment({ type: "img", name: file.name, content: null, dataUrl });
    } catch (err) {
      setAttachment(null);
      toast.error(err.message || "Couldn't read that image.");
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, view]);

  // ── Research Hub: refresh the document list (seeded from localStorage) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/resources`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length && !cancelled) {
          setResources(data);
          try { localStorage.setItem("sc_resources_list", JSON.stringify({ data, ts: Date.now() })); } catch {}
        }
      } catch { /* offline/401 — keep seeded cache */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch + extract a Research Hub document's content so the AI can read it
  async function fetchDocContent(resource) {
    if (!resource) return null;
    const key = resource.id || resource.shareToken;
    if (docTextCache.current[key]) return docTextCache.current[key];

    // MCQ sets / tutorial questions — serialize the questions themselves
    if (Array.isArray(resource.mcqData) && resource.mcqData.length) {
      const text = resource.mcqData
        .map((q, i) => `${i + 1}. ${q.question || q.q}\n${Object.entries(q.options || {}).map(([k, v]) => `   ${k}. ${v}`).join("\n")}${q.correct ? `\n   Correct: ${q.correct}` : ""}`)
        .join("\n\n");
      const out = { text: `Question set "${resource.title}" (${resource.mcqData.length} questions):\n\n${text}` };
      docTextCache.current[key] = out;
      return out;
    }

    if (!resource.fileUrl) return null;
    try {
      // proxy-pdf streams the file through the server (avoids CORS); fall back to direct URL
      let res;
      try {
        res = await fetch(`${API_BASE}/api/resources/proxy-pdf?url=${encodeURIComponent(resource.fileUrl)}`, { headers: authHeaders() });
        if (!res.ok) res = await fetch(resource.fileUrl);
      } catch {
        res = await fetch(resource.fileUrl);
      }
      if (!res.ok) return null;
      const blob = await res.blob();
      const fileName = resource.fileName || `${resource.title || "document"}.${resource.contentType === "docx" ? "docx" : resource.contentType === "pptx" ? "pptx" : "pdf"}`;
      const file = new File([blob], fileName, { type: blob.type || resource.mimeType || "application/pdf" });
      const result = await extractTextFromFile(file);
      let text = result.text || "";
      if (text.length > 14000) text = text.slice(0, 14000) + "\n\n[...document truncated...]";
      const images = [];
      for (const img of (result.images || []).slice(0, 4)) {
        try { images.push(await downscaleImage(img, 1400, 0.8)); } catch {}
      }
      const out = {
        text: text || (images.length ? "(scanned document — provided as page images)" : ""),
        images,
      };
      docTextCache.current[key] = out;
      return out;
    } catch {
      return null;
    }
  }

  function handleBack() {
    if (showHistory) { setShowHistory(false); return; }
    if (view === "study")    { setView("chat"); return; }
    if (view === "practice") { setView("chat"); return; }
    onExit?.();
  }

  function startNewChat() {
    setMsgs([]);
    setData(null);
    setView("chat");
    setCurrentId(null);
    setShowHistory(false);
    setActiveDoc(null);
    setMode("general");
  }

  function loadConvo(c) {
    // Re-resolve practice cards — questions are stripped when persisting
    const revived = (c.messages || []).map(m => {
      if (m.type === "ai" && m.data?.practice && !m.data.practice.questions?.length) {
        const req = { subject: m.data.practice.subjectLabel || m.data.practice.subject?.label, topic: m.data.practice.topic };
        const r = resolveMcqPractice(req, resources) || resolvePractice(req, subjects);
        if (r) {
          return { ...m, data: { ...m.data, practice: r, questions: r.questions, bankCount: r.total } };
        }
      }
      return m;
    });
    setMsgs(revived);
    const lastAi = [...revived].reverse().find(m => m.type === "ai");
    setData(lastAi?.data || null);
    setView("chat");
    setCurrentId(c.id);
    // Restore the pinned document context (re-resolve to the live resource if possible)
    if (c.activeDoc?.shareToken) {
      const full = resources.find(r => r.shareToken === c.activeDoc.shareToken);
      setActiveDoc(full ? slimDoc(full) : c.activeDoc);
    } else {
      setActiveDoc(null);
    }
  }

  function deleteConvo(id) {
    const updated = conversations.filter(c => c.id !== id);
    setConvos(updated);
    saveConvos(updated);
    if (currentId === id) startNewChat();
  }

  // Strip bulky fields before writing to localStorage
  function slimMessage(m) {
    if (m.type === "user" && m.attachment) {
      return { ...m, attachment: { type: m.attachment.type, name: m.attachment.name, dataUrl: null, images: [] } };
    }
    if (m.type === "ai" && m.data) {
      const d = { ...m.data, questions: undefined, docContext: undefined, autoVideo: undefined };
      if (d.practice) d.practice = { ...d.practice, questions: undefined, subject: undefined, resource: undefined };
      if (Array.isArray(d.documents)) d.documents = d.documents.map(x => ({ id: x.id, shareToken: x.shareToken, title: x.title, contentType: x.contentType, subject: x.subject || null, courseCode: x.courseCode || null }));
      return { ...m, data: d };
    }
    if (m.type === "error") {
      return { type: "error", text: m.text };
    }
    return m;
  }

  function persistConvo(msgs, lastData, q, docCtx) {
    const id = currentId || genId();
    const title = q.length > 60 ? q.slice(0, 60) + "…" : q;
    const entry = {
      id, title, ts: Date.now(),
      messages: msgs.map(slimMessage),
      lastData: lastData ? slimMessage({ type: "ai", data: lastData }).data : null,
      activeDoc: docCtx !== undefined ? docCtx : activeDoc,
    };
    const updated = [entry, ...conversations.filter(c => c.id !== id)];
    setConvos(updated);
    saveConvos(updated);
    setCurrentId(id);
  }

  function handleExamStart(practice) {
    if (!practice?.questions?.length || !onStartExam) return;
    onStartExam(toExamSession(practice));
  }

  // "Quiz" on a document card — MCQ sets go straight to practice; other docs
  // get AI-generated questions seeded with the document's extracted content
  async function startDocQuiz(doc) {
    const full = resources.find(r => r.shareToken === doc.shareToken) || doc;
    setActiveDoc(slimDoc(full));
    const mcqPractice = full.contentType === "mcq" ? resolveMcqPractice({}, [full]) : null;
    if (mcqPractice) {
      setData({ topic: full.title, subjectLabel: full.title, questions: mcqPractice.questions, practice: mcqPractice, bankCount: mcqPractice.total });
      setView("practice");
      return;
    }
    const content = await fetchDocContent(full);
    setData({
      topic: full.title, subjectLabel: full.title,
      docContext: content?.text || null,
      questions: [],
      practice: { subjectLabel: full.title, subjectIcon: "📄", questions: [], total: 0, resource: full },
      bankCount: 0,
    });
    setView("practice");
    if (!content?.text) toast.info("Couldn't read that file — the quiz will be generated from the title only.");
  }

  // POST to study-tool-save inside the AI Notes folder (loose fallback)
  async function postToHub(body, folderId) {
    if (folderId) body.folderId = folderId;
    const post = () => fetch(`${API_BASE}/api/resources/study-tool-save`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let res = await post();
    if (!res.ok && folderId) {
      // Cached folder may have been deleted — retry as a loose resource
      try { localStorage.removeItem(AI_NOTES_FOLDER_KEY); } catch {}
      delete body.folderId;
      res = await post();
    }
    if (!res.ok) throw new Error("Save failed");
    const saved = await res.json();
    const resource = saved?.resource || saved;
    if (resource?.id) {
      setResources(prev => [resource, ...prev.filter(r => r.id !== resource.id)]);
      try { localStorage.removeItem("sc_resources_list"); } catch {}
    }
    return !!folderId;
  }

  // Save a useful AI answer as a note inside the dedicated "✦ AI Notes" space
  async function saveAnswerToHub(data) {
    try {
      const folderId = await ensureAINotesFolder();
      const inFolder = await postToHub({
        title: `AI notes — ${(data.topic || "study answer").slice(0, 60)}`,
        subject: data.subjectLabel || "AI Notes",
        contentType: "note",
        description: `**Q:** ${data.topic || ""}\n\n${data.answer || ""}`,
        isPublic: false,
      }, folderId);
      toast.success(inFolder ? "Saved to your AI Notes space ✓" : "Saved to your Research Hub ✓");
      return true;
    } catch {
      toast.error("Couldn't save — try again");
      return false;
    }
  }

  // Save a generated flashcard deck (Flashcards mode) to the AI Notes space
  async function saveDeckToHub(data) {
    try {
      const folderId = await ensureAINotesFolder();
      const inFolder = await postToHub({
        title: `AI flashcards — ${(data.topic || "deck").slice(0, 60)}`,
        subject: data.subjectLabel || "AI Notes",
        contentType: "flashcard_deck",
        flashcardData: (data.flashcards || []).map(c => ({ front: c.front, back: c.back })),
        isPublic: false,
      }, folderId);
      toast.success(inFolder ? "Deck saved to your AI Notes space ✓" : "Deck saved to your Research Hub ✓");
      return true;
    } catch {
      toast.error("Couldn't save the deck — try again");
      return false;
    }
  }

  // Practice feedback loop — send missed questions back into the conversation
  function reviewMistakes(wrong, subjectLabel) {
    if (!wrong?.length) return;
    setView("chat");
    ask(
      `I just finished a ${subjectLabel || "practice"} session and missed ${wrong.length} question${wrong.length !== 1 ? "s" : ""}. ` +
      `Explain the correct answers and where my reasoning went wrong:\n\n` +
      wrong.map((w, i) => `${i + 1}. ${w.q}\n   My answer: ${w.chosen}\n   Correct answer: ${w.correct}`).join("\n")
    );
  }

  async function ask(rawQ, attachOverride, docOverride, modeOverride) {
    const attach = attachOverride !== undefined ? attachOverride : attachment;
    const hasAttachment = !!attach;
    const q = rawQ?.trim() || (hasAttachment ? `Analyze this ${attach.type === "img" ? "image" : "document"}: ${attach.name}` : "");
    if (!q || loading) return;
    let askMode = modeOverride || mode;
    // Keyword intent — General auto-routes obvious requests to the right mode
    if (askMode === "general") {
      const intent = detectModeIntent(q);
      if (intent) {
        askMode = intent;
        setMode(intent);
        toast.info(`Switched to ${MODE_META[intent].icon} ${MODE_META[intent].label} mode`);
      }
    }
    setInput("");
    setView("chat");
    setLoading(true);

    // Build user message with optional attachment
    const userMsg = { type: "user", text: q, attachment: attach ? { ...attach } : null };
    setMsgs(p => [...p, userMsg, { type: "loading" }]);
    const capturedAttachment = attach;
    setAttachment(null);

    // Collect images for multimodal AI call
    let images = null;
    if (capturedAttachment?.type === "img" && capturedAttachment.dataUrl) {
      images = [capturedAttachment.dataUrl];
    } else if (capturedAttachment?.images && capturedAttachment.images.length > 0) {
      images = capturedAttachment.images;
    }

    // Build augmented query for AI
    let aiQuery = q;
    if (capturedAttachment?.type === "doc" && capturedAttachment.content) {
      aiQuery = `The student uploaded a document named "${capturedAttachment.name}". Document content:\n\n${capturedAttachment.content}\n\nBased on this content, answer: ${q}`;
    } else if (images) {
      aiQuery = `The student uploaded an image named "${capturedAttachment.name}". Please analyze the image and answer: ${q}`;
    }

    // ── Research Hub document pre-resolution ──
    // If the student references a real document (or clicked "Ask AI" on a doc
    // card), fetch its content and inject it so the model can read it.
    let citedDocs = [];
    let pinnedDoc = activeDoc;
    let docMatch = docOverride || null;
    if (!docMatch && !capturedAttachment && resources.length > 0 && hasDocIntent(q)) {
      const [hit] = searchDocuments(q, resources, 1);
      if (hit) docMatch = hit;
    }
    // Pinned document context — follow-up questions keep reading the same doc
    if (!docMatch && !capturedAttachment && activeDoc) {
      docMatch = resources.find(r => r.shareToken === activeDoc.shareToken) || activeDoc;
    }
    if (docMatch) {
      const slim = slimDoc(docMatch);
      citedDocs = [slim];
      if (slim.shareToken !== activeDoc?.shareToken) { setActiveDoc(slim); pinnedDoc = slim; }
      const content = await fetchDocContent(docMatch);
      if (content && (content.text || content.images?.length)) {
        if (content.images?.length) images = content.images;
        aiQuery = `The student is asking about their Research Hub document "${docMatch.title}"${docMatch.subject ? ` (${docMatch.subject})` : ""}.\n\nDocument content:\n\n${content.text || "(scanned document — provided as page images)"}\n\nBased on this document, answer: ${q}`;
      }
    }

    try {
      let aiRes = null;
      let aiError = null;
      let metaDocs = [];
      // Stream partial answers into a live message bubble
      const onToken = (acc) => {
        const partial = extractPartialAnswer(acc);
        setMsgs(p => p.map((m, i) =>
          i === p.length - 1 && (m.type === "loading" || m.type === "streaming")
            ? { type: "streaming", partial }
            : m));
      };
      // ── Action modes: Quiz / Exam prep skip prose and go straight to practice ──
      if (askMode === "quiz" || askMode === "exam") {
        let practice = null;
        let questions = null;
        let docContext = capturedAttachment?.content || null;
        // Pinned/matched doc first: MCQ sets → stored questions; other docs →
        // generate from extracted content. Only then fall back to catalog MCQs.
        if (docMatch?.contentType === "mcq") {
          practice = resolveMcqPractice({}, [docMatch]);
          questions = practice?.questions || null;
        }
        if (!questions && !docMatch) {
          practice = resolveMcqPractice({ subject: selectedSubject?.label || q, topic: q }, resources);
          questions = practice?.questions || null;
        }
        if (!questions) {
          if (!docContext && docMatch) {
            const c = await fetchDocContent(docMatch);
            docContext = c?.text || null;
          }
          try {
            questions = await generateAIQuestions(
              docMatch?.title || q, aiConfig,
              docMatch ? { label: docMatch.subject || docMatch.title } : selectedSubject,
              docContext
            );
          } catch { questions = null; }
        }
        const subjectLabel = practice?.subjectLabel || docMatch?.title || selectedSubject?.label || "AI-generated";
        const practiceObj = practice || {
          subjectLabel, subjectIcon: docMatch ? "📄" : "✦", topic: null,
          questions: questions || [], total: questions?.length || 0,
          resource: docMatch || null,
        };
        const base = [...messages, userMsg].filter(m => m.type !== "loading" && m.type !== "streaming");
        const aiData = {
          source: "ai", mode: askMode,
          answer: questions?.length
            ? `${askMode === "exam" ? "🎓 Timed exam" : "📝 Quick quiz"} on **${subjectLabel}** — ${questions.length} questions ready.`
            : `Couldn't build questions for **${subjectLabel}** — try a different topic or document.`,
          ytQuery: null, video: null, followUps: ["Make it harder", "Explain the topic first"], documents: citedDocs,
          practice: practiceObj, questions: questions || [], bankCount: questions?.length || 0,
          subjectLabel, topic: docMatch?.title || q,
        };
        const finalMsgs = base.concat({ type: "ai", data: aiData });
        setMsgs(finalMsgs);
        setData({ ...aiData, docContext });
        persistConvo(finalMsgs, aiData, q, pinnedDoc);
        if (askMode === "exam" && onStartExam && questions?.length) {
          handleExamStart(practiceObj);
        } else {
          setView("practice");
        }
        return; // finally still clears loading
      }

      try {
        const result = await generateAIResponse(aiQuery, aiConfig, messages, selectedSubject, images, subjects, resources, { onToken, query: q, mode: askMode });
        aiRes = result.parsed;
        metaDocs = result.metaDocs || [];
      } catch (err) {
        aiError = err?.message || "The AI request failed. Please try again.";
      }

      // Resolve real practice questions — MCQ resources in Research Hub first,
      // then the subject bank as fallback. General mode stays text-only.
      let practice = null;
      if (askMode !== "general") {
        if (aiRes?.practice) {
          const req = { subject: aiRes.practice.subject || selectedSubject?.label, topic: aiRes.practice.topic };
          practice = resolveMcqPractice(req, resources) || resolvePractice(req, subjects);
        }
        if (!practice && hasPracticeIntent(q)) {
          if (selectedSubject) {
            practice = resolveMcqPractice({ subject: selectedSubject.label, topic: q }, resources)
              || resolvePractice({ subject: selectedSubject.label, topic: q }, subjects);
          }
          if (!practice) {
            const mcqRes = resolveMcqPractice({ subject: q, topic: q }, resources);
            if (mcqRes) {
              practice = mcqRes;
            } else {
              const bankRes = searchQuestionBank(q, subjects);
              if (bankRes.found) {
                practice = {
                  subject: bankRes.subject, subjectId: bankRes.subject?.id,
                  subjectLabel: bankRes.subjectLabel, subjectIcon: bankRes.subjectIcon,
                  topic: bankRes.topic, questions: bankRes.questions, total: bankRes.bankCount,
                };
              }
            }
          }
        }
      }

      // Resolve AI-cited + server-matched documents into cards — skipped in
      // General mode, which stays pure text (the model can suggest Materials)
      if (askMode !== "general") {
        const aiDocs = resolveDocRefs(aiRes?.documents || [], resources);
        const used = new Set(citedDocs.map(d => d.shareToken));
        for (const d of aiDocs) if (!used.has(d.shareToken)) { used.add(d.shareToken); citedDocs.push(d); }
        for (const d of metaDocs.map(slimDoc)) {
          if (d.shareToken && !used.has(d.shareToken)) { used.add(d.shareToken); citedDocs.push(d); }
        }
        citedDocs = citedDocs.slice(0, 3);
      }

      const ytQuery = aiRes?.ytQuery || `${q} explained`;

      // Video mode — fetch + auto-expand instead of waiting for a click
      let video = null, autoVideo = false;
      if (!aiError && askMode === "video") {
        video = await fetchYouTubeVideo(ytQuery);
        autoVideo = !!video;
      }

      const base = [...messages, userMsg].filter(m => m.type !== "loading" && m.type !== "streaming");
      let finalMsgs;
      if (aiError) {
        finalMsgs = base.concat({ type: "error", text: aiError, retryQ: q, retryAttach: capturedAttachment });
      } else {
        const result = {
          source: practice ? (practice.resource ? "mcq-resource" : "bank") : "ai",
          mode: askMode,
          answer: aiRes?.answer || "",
          ytQuery, video, autoVideo, // video stays lazy outside Video mode
          followUps: aiRes?.followUps || [],
          documents: citedDocs,
          flashcards: Array.isArray(aiRes?.flashcards) ? aiRes.flashcards.filter(c => c?.front && c?.back).slice(0, 12) : [],
          practice,
          questions: practice?.questions || [],
          bankCount: practice?.total || 0,
          subjectLabel: practice?.subjectLabel || selectedSubject?.label || null,
          topic: practice?.topic || q,
          suggestMode: (typeof aiRes?.suggestMode === "string" && MODE_META[aiRes.suggestMode] && aiRes.suggestMode !== askMode) ? aiRes.suggestMode : null,
          question: q,
        };
        finalMsgs = base.concat({ type: "ai", data: result });
        setData(result);
      }
      setMsgs(finalMsgs);
      setView("chat");
      persistConvo(finalMsgs, finalMsgs[finalMsgs.length - 1]?.data || null, q, pinnedDoc);
    } finally {
      setLoading(false);
    }
  }

  const topTitle = { chat: "AI Tutor", practice: "Practice Mode", study: "Guided Study" }[view] || "AI Tutor";
  const topSub   = {
    chat:     selectedSubject ? `${selectedSubject.label || selectedSubject.id} · Ask anything` : "Scholar's Circle · Ask anything",
    practice: data ? `${data.subjectLabel || "AI"} · ${data.bankCount || 0} questions` : "",
    study:    "Roadmap → Explain → Questions → Flashcards",
  }[view] || "";

  return (
    <>
      <style>{FONTS + `
        .sc-ol *{box-sizing:border-box}
        .sc-ol input::placeholder,.sc-ol textarea::placeholder{color:#4A5266}
      `}</style>

      <div className="sc-ol" style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg, display: "flex", flexDirection: "column",
        fontFamily: "Manrope,sans-serif",
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px 11px",
          borderBottom: `0.5px solid ${D.line}`,
          background: D.bar, flexShrink: 0,
        }}>
          <button
            onClick={handleBack}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: D.accent, border: `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: D.muted, fontSize: 17, flexShrink: 0,
            }}
          >←</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: D.text, lineHeight: 1.1 }}>
              {topTitle}
            </div>
            <div style={{ fontSize: 11, color: D.hint, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {topSub}
            </div>
          </div>

          {/* Subject selector — only in chat view */}
          {view === "chat" && subjects?.length > 0 && (
            <select
              value={selectedSubject?.id || ""}
              onChange={e => {
                const subj = subjects.find(s => s.id === e.target.value);
                setSelectedSubject(subj || null);
              }}
              style={{
                background: D.accent, border: `0.5px solid ${D.line}`,
                borderRadius: 8, padding: "5px 8px", fontSize: 11,
                color: selectedSubject ? D.accent2 : D.muted,
                fontFamily: "Manrope,sans-serif", outline: "none",
                cursor: "pointer", flexShrink: 0, maxWidth: 120,
              }}
            >
              <option value="">All subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.label || s.id}</option>
              ))}
            </select>
          )}

          {/* 📚 Guided Study button */}
          <button
            onClick={() => setView(view === "study" ? "chat" : "study")}
            title="Guided Study"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: view === "study" ? D.accent : "transparent",
              border: view === "study" ? `0.5px solid ${D.border}` : `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              fontSize: 14, transition: "all 0.2s",
            }}
          >📚</button>

          {/* ⋯ History button */}
          <button
            onClick={() => setShowHistory(o => !o)}
            title="Chat history"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: showHistory ? D.accent : "transparent",
              border: showHistory ? `0.5px solid ${D.border}` : `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              fontSize: 14, color: showHistory ? D.accent2 : D.muted,
              letterSpacing: 1, transition: "all 0.2s",
            }}
          >⋯</button>

          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 7px #22c55e99", flexShrink: 0 }} />
        </div>

        {/* ── History panel ── */}
        <HistoryPanel
          open={showHistory}
          onClose={() => setShowHistory(false)}
          conversations={conversations}
          onLoad={loadConvo}
          onDelete={deleteConvo}
          onNewChat={startNewChat}
        />

        {/* ══ VIEW: CHAT (unified — includes AI responses inline) ══ */}
        {view === "chat" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", scrollbarWidth: "none" }}>
              <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.length === 0 ? (
                <>
                  <div style={{ textAlign: "center", padding: "28px 8px 12px" }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 18,
                      background: D.accent, border: `1px solid ${D.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 14px", fontSize: 26,
                    }}>🎓</div>
                    <div style={{ fontFamily: "Syne,sans-serif", fontSize: 17, fontWeight: 700, color: D.text, marginBottom: 6 }}>
                      What do you want to learn?
                    </div>
                    <div style={{ fontSize: 12, color: D.hint, lineHeight: 1.65 }}>
                      Ask anything — I can read your Research Hub documents,<br />pull practice questions, and explain any concept.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", padding: "4px 0" }}>
                    {buildChips(subjects, resources).map(c => (
                      <button
                        key={c} onClick={() => ask(c)}
                        style={{
                          padding: "7px 13px", borderRadius: 20,
                          background: D.accent, border: `0.5px solid ${D.line}`,
                          fontSize: 11, color: D.muted, cursor: "pointer",
                          fontFamily: "Manrope,sans-serif", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.accent2; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.color = D.muted; }}
                      >{c}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Context indicator */}
                  {messages.filter(m => m.type === "user").length >= 2 && (
                    <div style={{
                      alignSelf: "center", fontSize: 10, color: D.faint,
                      padding: "3px 11px", borderRadius: 12,
                      background: D.bar, border: `0.5px solid ${D.line2}`,
                      fontFamily: "Manrope,sans-serif",
                    }}>🧠 AI remembers this conversation</div>
                  )}

                  {messages.map((m, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {m.type === "user" && (
                        <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, maxWidth: "82%" }}>
                          {m.attachment?.type === "img" && m.attachment.dataUrl && (
                            <img src={m.attachment.dataUrl} alt={m.attachment.name}
                              style={{ width: 160, borderRadius: 10, border: `0.5px solid ${D.line}`, objectFit: "cover" }} />
                          )}
                          {m.attachment && (m.attachment.type === "doc" || (m.attachment.type === "img" && !m.attachment.dataUrl)) && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 7,
                              background: D.bar, border: `0.5px solid ${D.line}`,
                              borderRadius: 10, padding: "7px 12px",
                            }}>
                              <span style={{ fontSize: 18 }}>{m.attachment.type === "img" ? "🖼️" : "📄"}</span>
                              <span style={{ fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.attachment.name}</span>
                            </div>
                          )}
                          <div style={{
                            background: D.userBg, border: `0.5px solid ${D.userBdr}`,
                            borderRadius: "16px 16px 4px 16px",
                            padding: "10px 14px", fontSize: 13, color: D.userTxt,
                            fontFamily: "Manrope,sans-serif",
                            animation: "scSlideIn 0.25s ease",
                          }}><MarkdownText theme="gold">{m.text}</MarkdownText></div>
                        </div>
                      )}
                      {m.type === "loading" && (
                        <div style={{ alignSelf: "flex-start", width: 80 }}>
                          <TypingDots />
                        </div>
                      )}
                      {m.type === "streaming" && (
                        <div style={{ alignSelf: "flex-start", width: "100%", display: "flex", gap: 9, alignItems: "flex-start" }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 9, flexShrink: 0, marginTop: 2,
                            background: D.accent, border: `0.5px solid ${D.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, color: D.accent2,
                          }}>✦</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {m.partial ? (
                              <>
                                <MarkdownText theme="gold">{m.partial}</MarkdownText>
                                <span style={{ display: "inline-block", width: 7, height: 14, background: D.accent2, borderRadius: 2, verticalAlign: "text-bottom", animation: "scBlink 0.9s steps(1) infinite", marginLeft: 2 }} />
                              </>
                            ) : (
                              <TypingDots />
                            )}
                            <style>{`@keyframes scBlink{50%{opacity:0}}`}</style>
                          </div>
                        </div>
                      )}
                      {m.type === "error" && (
                        <div style={{ alignSelf: "flex-start", display: "flex", gap: 9, alignItems: "flex-start", maxWidth: "92%" }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 9, flexShrink: 0, marginTop: 2,
                            background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.4)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, color: "#fca5a5",
                          }}>⚠</div>
                          <div>
                            <div style={{
                              padding: "10px 14px", borderRadius: "4px 14px 14px 14px",
                              background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.3)",
                              fontSize: 13, color: "#fca5a5", fontFamily: "Manrope,sans-serif", lineHeight: 1.55,
                            }}>
                              {m.text}
                            </div>
                            {m.retryQ && (
                              <button
                                onClick={() => ask(m.retryQ, m.retryAttach)}
                                style={{
                                  marginTop: 6, padding: "5px 12px", borderRadius: 8,
                                  background: "transparent", border: "0.5px solid rgba(239,68,68,0.4)",
                                  color: "#fca5a5", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                  fontFamily: "Manrope,sans-serif",
                                }}
                              >↻ Try again</button>
                            )}
                          </div>
                        </div>
                      )}
                      {m.type === "ai" && m.data && (
                        <AIMessageBubble
                          data={m.data}
                          showFollowUps={i === messages.length - 1}
                          onSwitchMode={(newMode, origQ) => {
                            setMode(newMode);
                            ask(origQ || `Continue in ${MODE_META[newMode]?.label || newMode} mode`, undefined, undefined, newMode);
                          }}
                          onStartPractice={() => {
                            const qs = [...(m.data.questions || [])].sort(() => Math.random() - 0.5);
                            setData({ ...m.data, questions: qs });
                            setView("practice");
                          }}
                          onStartExam={onStartExam ? handleExamStart : null}
                          onFollowUp={(q) => ask(q)}
                          onOpenResource={onOpenResource ? (token) => onOpenResource(token) : null}
                          onAskDoc={(doc) => {
                            const full = resources.find(r => r.shareToken === doc.shareToken) || doc;
                            ask(`Help me study "${doc.title}" — summarize the key points`, undefined, full);
                          }}
                          onQuizDoc={startDocQuiz}
                          onSave={saveAnswerToHub}
                          onSaveDeck={saveDeckToHub}
                          onQuickAction={(action, topic) => {
                            const prompts = {
                              explain_simpler: `Explain ${topic} in simpler terms, as if for a beginner`,
                              test_me: `Generate 3 multiple-choice questions about ${topic} to test my understanding`,
                              flashcards: `Generate 5 flashcards about ${topic}`,
                              example: `Give me a concrete real-world example of ${topic}`,
                            };
                            ask(prompts[action] || topic);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </>
              )}
              <div ref={bottomRef} />
              </div>
            </div>

            {/* Pinned document context — follow-ups keep reading this doc */}
            {activeDoc && (
              <div style={{ padding: "6px 14px 0", background: D.bar, flexShrink: 0 }}>
                <div style={{ maxWidth: 780, margin: "0 auto" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "4px 10px", borderRadius: 14,
                    background: D.accent, border: `0.5px solid ${D.border}`,
                    fontSize: 10.5, color: D.accent2, fontFamily: "Manrope,sans-serif",
                  }}>
                    <span style={{ fontSize: 11 }}>📄</span>
                    <span style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Reading: {activeDoc.title}
                    </span>
                    {onOpenResource && activeDoc.shareToken && (
                      <button
                        onClick={() => onOpenResource(activeDoc.shareToken)}
                        title="Open document"
                        style={{ background: "none", border: "none", color: D.accent2, cursor: "pointer", fontSize: 10, padding: 0, fontFamily: "Manrope,sans-serif", opacity: 0.75 }}
                      >open ↗</button>
                    )}
                    <button
                      onClick={() => setActiveDoc(null)}
                      title="Stop reading this document"
                      style={{ background: "none", border: "none", color: D.muted, cursor: "pointer", fontSize: 12, padding: "0 2px", lineHeight: 1 }}
                    >✕</button>
                  </div>
                </div>
              </div>
            )}

            {/* Mode selector — General / Materials / Video / Flashcards / Quiz / Exam prep */}
            <ModeBar mode={mode} onChange={setMode} />

            <InputBar
              value={input}
              onChange={e => setInput(e.target.value)}
              onSend={() => ask(input)}
              loading={loading}
              showUpload
              attachment={attachment}
              onClearAttachment={() => setAttachment(null)}
              onSelectDoc={handleDocSelect}
              onSelectImg={handleImgSelect}
            />
          </>
        )}

        {/* ══ VIEW: PRACTICE ══ */}
        {view === "practice" && data && (
          <PracticeView
            data={data}
            onBack={() => setView("chat")}
            aiConfig={aiConfig}
            onStartExam={onStartExam ? handleExamStart : null}
            onReviewMistakes={(wrong) => reviewMistakes(wrong, data.subjectLabel)}
          />
        )}

        {/* ══ VIEW: STUDY (Guided Study) ══ */}
        {view === "study" && (
          <GuidedStudy
            aiConfig={aiConfig}
            initialTopic={studyTopic}
            startMode={studyMode}
            initialAttachment={studyAttachment}
            studyContext={studyContext}
          />
        )}

      </div>
    </>
  );
}
