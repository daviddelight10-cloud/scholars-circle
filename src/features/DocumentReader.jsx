import { useState, useEffect, useRef, useCallback } from "react";
import { callAIMultimodal } from "../lib/aiClient.js";
import MarkdownText from "../components/MarkdownText.jsx";
import {
  loadHistory, saveHistory, createHistoryEntry,
  recordPracticeResult, getWeakSpots, getWeakSpotQuestions,
  getMastery, recordPracticeSession, getMasteryColor, getMasteryEmoji,
} from "../lib/studyHistory.js";
import { copyShareToken } from "../lib/researchUtils.js";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

const MAMMOTH_CDN = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
const JSZIP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

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

function getProxiedUrl(fileUrl) {
  if (!fileUrl) return null;
  return `${API_BASE}/api/resources/proxy-pdf?url=${encodeURIComponent(fileUrl)}`;
}

function getAuthHeaders() {
  const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  return authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {};
}

// Extract text from PPTX using JSZip — parses slide XML for <a:t> text nodes
async function extractPptxText(arrayBuffer) {
  await loadScript(JSZIP_CDN, "JSZip");
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error("JSZip library failed to load");
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)/)[1], 10);
      return na - nb;
    });
  if (slideFiles.length === 0) throw new Error("No slides found in PPTX file");
  const slides = [];
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
    const slideNum = parseInt(slideFile.match(/slide(\d+)/)[1], 10);
    slides.push({ num: slideNum, text: slideText });
  }
  return slides;
}

const THEMES = {
  light: {
    bg: "#EFEEE8", toolbar: "#fff", border: "#C9C5B8", text: "#2D2823",
    muted: "#6B665C", accent: "#C23B3B", hover: "rgba(194,59,59,0.10)",
    inputBg: "#F2F0EA", chatBot: "#EEEAE2", thumbBg: "#FBFAF6",
    shadow: "rgba(0,0,0,0.14)", chipBg: "#E8E5DD",
  },
  dark: {
    bg: "#1a1a2e", toolbar: "#16213e", border: "#0f3460", text: "#e0e0e0",
    muted: "#8892b0", accent: "#e94560", hover: "rgba(233,69,96,0.15)",
    inputBg: "#0f1626", chatBot: "#16213e", thumbBg: "#16213e",
    shadow: "rgba(0,0,0,0.40)", chipBg: "#1a1a2e",
  },
};

const SMART_CHIPS = [
  { label: "Explain simpler", prompt: "Re-explain this in simpler words a beginner would understand." },
  { label: "Step-by-step", prompt: "Break this down into clear numbered steps." },
  { label: "Give an example", prompt: "Give a concrete worked example of this." },
  { label: "Define key terms", prompt: "Define the key terms involved in plain language." },
  { label: "Quiz me", prompt: "Ask me 2 short questions to test if I understood this. Wait for my answers." },
  { label: "Why it matters", prompt: "Why is this important and where is it used in practice?" },
];

export default function DocumentReader({ fileUrl, title, contentType, resourceId, folderId, onBack }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("sc_doc_theme") || "dark");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [imageData, setImageData] = useState(null);
  const [pptxSlides, setPptxSlides] = useState([]);
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [studyMode, setStudyMode] = useState("summary");
  const [studyResult, setStudyResult] = useState("");
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState("");
  const [parsedMcqs, setParsedMcqs] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartRef = useRef({ x: 0, y: 0 });
  const t = THEMES[theme];

  // ── AI Study History (localStorage via shared utility) ─────────────────────
  const studyResourceId = resourceId || title || "doc";
  const [studyHistory, setStudyHistory] = useState(() => loadHistory(studyResourceId));
  const [historyView, setHistoryView] = useState(null);
  const [historyQuizAnswers, setHistoryQuizAnswers] = useState({});
  const [historyQuizLocked, setHistoryQuizLocked] = useState({});
  const [historyQuizIdx, setHistoryQuizIdx] = useState(0);
  const [historyQuizShowResults, setHistoryQuizShowResults] = useState(false);
  const [studyStep, setStudyStep] = useState("setup"); // "setup" | "history"

  // Practice-first state
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [practiceLocked, setPracticeLocked] = useState({});
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [practiceShowResults, setPracticeShowResults] = useState(false);

  // Auto-save toast
  const [autoSaveToast, setAutoSaveToast] = useState(null);
  const autoSaveTimerRef = useRef(null);

  // Mastery
  const [mastery, setMastery] = useState(() => getMastery(studyResourceId));

  useEffect(() => {
    saveHistory(studyResourceId, studyHistory);
    setMastery(getMastery(studyResourceId));
  }, [studyHistory, studyResourceId]);

  function saveStudyHistoryEntry(entry) {
    const newEntry = createHistoryEntry(entry);
    setStudyHistory((prev) => [newEntry, ...prev].slice(0, 20));
  }

  function deleteStudyHistoryEntry(id) {
    setStudyHistory((prev) => prev.filter((e) => e.id !== id));
  }

  function clearStudyHistory() {
    setStudyHistory([]);
  }

  // ── Auto-save to folder ────────────────────────────────────────────────────
  async function autoSaveToFolder(mcqs, rangeLabel) {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;
    if (!token || !folderId) return;

    const shortTitle = (title || "Document").replace(/\.[^.]+$/, "").slice(0, 60);
    try {
      const res = await fetch(`${API_BASE}/api/resources/study-tool-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `[AI] MCQs from ${shortTitle} (${rangeLabel})`,
          subject: "General",
          contentType: "mcq",
          mcqData: mcqs,
          description: `AI-generated MCQs from ${shortTitle}, ${rangeLabel}`,
          isPublic: false,
          folderId,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setAutoSaveToast({ status: "saved", resourceId: data.resource?.id || data.id, label: "Saved to your folder" });
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => setAutoSaveToast(null), 5000);
    } catch (err) {
      setAutoSaveToast({ status: "error", label: "Auto-save failed" });
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => setAutoSaveToast(null), 5000);
    }
  }

  async function undoAutoSave() {
    if (!autoSaveToast?.resourceId) return;
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/resources/${autoSaveToast.resourceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    setAutoSaveToast(null);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
  }

  // ── Practice helpers ───────────────────────────────────────────────────────
  function startPractice(weakFirst = false) {
    const mcqs = weakFirst ? getWeakSpotQuestions(studyResourceId, parsedMcqs) : parsedMcqs;
    setPracticeAnswers({});
    setPracticeLocked({});
    setPracticeIdx(0);
    setPracticeShowResults(false);
    setPracticeMode(true);
  }

  function handlePracticeAnswer(key) {
    if (practiceLocked[practiceIdx]) return;
    setPracticeAnswers((prev) => ({ ...prev, [practiceIdx]: key }));
    setPracticeLocked((prev) => ({ ...prev, [practiceIdx]: true }));
  }

  function practiceNext() {
    if (!parsedMcqs.length) return;
    if (practiceIdx < parsedMcqs.length - 1) {
      setPracticeIdx(practiceIdx + 1);
    } else {
      setPracticeShowResults(true);
      recordPracticeResult(studyResourceId, parsedMcqs, practiceAnswers);
      const score = parsedMcqs.reduce((acc, q, i) => acc + (practiceAnswers[i] === q.correct ? 1 : 0), 0);
      recordPracticeSession(studyResourceId, null, score, parsedMcqs.length);
      setMastery(getMastery(studyResourceId));
    }
  }

  function practiceRetake() {
    setPracticeAnswers({});
    setPracticeLocked({});
    setPracticeIdx(0);
    setPracticeShowResults(false);
  }

  const practiceScore = parsedMcqs.length
    ? parsedMcqs.reduce((acc, q, i) => acc + (practiceAnswers[i] === q.correct ? 1 : 0), 0)
    : 0;

  // ── History quiz helpers ───────────────────────────────────────────────────
  function startHistoryQuiz(entry, weakFirst = false) {
    const mcqs = weakFirst ? getWeakSpotQuestions(studyResourceId, entry.mcqs) : entry.mcqs;
    setHistoryView({ ...entry, mcqs });
    setHistoryQuizAnswers({});
    setHistoryQuizLocked({});
    setHistoryQuizIdx(0);
    setHistoryQuizShowResults(false);
  }

  function handleHistoryQuizAnswer(key) {
    if (historyQuizLocked[historyQuizIdx]) return;
    setHistoryQuizAnswers((prev) => ({ ...prev, [historyQuizIdx]: key }));
    setHistoryQuizLocked((prev) => ({ ...prev, [historyQuizIdx]: true }));
  }

  function historyQuizNext() {
    if (!historyView?.mcqs) return;
    if (historyQuizIdx < historyView.mcqs.length - 1) {
      setHistoryQuizIdx(historyQuizIdx + 1);
    } else {
      setHistoryQuizShowResults(true);
      recordPracticeResult(studyResourceId, historyView.mcqs, historyQuizAnswers);
      const score = historyView.mcqs.reduce((acc, q, i) => acc + (historyQuizAnswers[i] === q.correct ? 1 : 0), 0);
      recordPracticeSession(studyResourceId, historyView.id, score, historyView.mcqs.length);
      setMastery(getMastery(studyResourceId));
    }
  }

  function historyQuizRetake() {
    setHistoryQuizAnswers({});
    setHistoryQuizLocked({});
    setHistoryQuizIdx(0);
    setHistoryQuizShowResults(false);
  }

  const historyQuizScore = historyView?.mcqs
    ? historyView.mcqs.reduce((acc, q, i) => acc + (historyQuizAnswers[i] === q.correct ? 1 : 0), 0)
    : 0;

  async function handleSharePracticeSet(entry) {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;
    if (!token) return;
    const shortTitle = (title || "Document").replace(/\.[^.]+$/, "").slice(0, 60);
    try {
      const res = await fetch(`${API_BASE}/api/resources/study-tool-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `[AI] MCQs from ${shortTitle} (${entry.rangeLabel})`,
          subject: "General",
          contentType: "mcq",
          mcqData: entry.mcqs,
          description: `AI-generated MCQs from ${shortTitle}, ${entry.rangeLabel}`,
          isPublic: true,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.shareToken) {
        await copyShareToken(data.shareToken);
        setAutoSaveToast({ status: "saved", label: "Share link copied!", resourceId: null });
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => setAutoSaveToast(null), 4000);
      }
    } catch {}
  }

  // Escape key to exit
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && onBack) onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  // Enable browser zoom while reading documents, revert on unmount
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    const original = viewport?.content || '';
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover');
    }
    return () => {
      if (viewport) viewport.setAttribute('content', original);
    };
  }, []);

  // Fetch and extract content
  useEffect(() => {
    let cancelled = false;
    async function loadContent() {
      setLoading(true);
      setError("");
      setExtractedText("");
      setImageData(null);
      setPptxSlides([]);
      setStudyResult("");
      setParsedMcqs([]);
      setChatMessages([]);
      try {
        if (contentType === "image") {
          const res = await fetch(getProxiedUrl(fileUrl), { headers: getAuthHeaders() });
          if (!res.ok) throw new Error("Failed to fetch image");
          const blob = await res.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Failed to read image"));
            reader.readAsDataURL(blob);
          });
          if (!cancelled) {
            setImageData(dataUrl);
            setLoading(false);
          }
        } else if (contentType === "docx") {
          const res = await fetch(getProxiedUrl(fileUrl), { headers: getAuthHeaders() });
          if (!res.ok) throw new Error("Failed to fetch document");
          const arrayBuffer = await res.arrayBuffer();
          await loadScript(MAMMOTH_CDN, "mammoth");
          const mammoth = window.mammoth;
          if (!mammoth) throw new Error("DOCX library failed to load");
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = (result.value || "").trim();
          if (!text) throw new Error("No text found in document");
          if (!cancelled) {
            setExtractedText(text);
            setLoading(false);
          }
        } else if (contentType === "txt") {
          const res = await fetch(getProxiedUrl(fileUrl), { headers: getAuthHeaders() });
          if (!res.ok) throw new Error("Failed to fetch text file");
          const text = await res.text();
          if (!text || !text.trim()) throw new Error("Text file is empty");
          if (!cancelled) {
            setExtractedText(text.trim());
            setLoading(false);
          }
        } else if (contentType === "pptx") {
          const res = await fetch(getProxiedUrl(fileUrl), { headers: getAuthHeaders() });
          if (!res.ok) throw new Error("Failed to fetch presentation");
          const arrayBuffer = await res.arrayBuffer();
          const slides = await extractPptxText(arrayBuffer);
          const fullText = slides.map((s) => `--- Slide ${s.num} ---\n${s.text}`).join("\n\n");
          if (!fullText.trim()) throw new Error("No text found in presentation");
          if (!cancelled) {
            setPptxSlides(slides);
            setExtractedText(fullText);
            setLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load document");
          setLoading(false);
        }
      }
    }
    loadContent();
    return () => { cancelled = true; };
  }, [fileUrl, contentType]);

  // Parse MCQ markdown
  const parseMcqMarkdown = (raw) => {
    const blocks = raw.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
    const mcqs = [];
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 3) continue;
      const qLine = lines.find((l) => /^Q\d*[:.)]?\s*/i.test(l) || (!/^[A-D][.):]\s/.test(l) && !/^Correct\s*Answer/i.test(l) && !/^Explanation/i.test(l)));
      if (!qLine) continue;
      const question = qLine.replace(/^Q\d*[:.)]?\s*/i, "").trim();
      const options = {};
      for (const line of lines) {
        const m = line.match(/^([A-D])[\.\):]\s*(.+)/);
        if (m) options[m[1]] = m[2].trim();
      }
      if (Object.keys(options).length < 2) continue;
      const correctLine = lines.find((l) => /^Correct\s*Answer/i.test(l));
      let correct = "";
      if (correctLine) {
        const m = correctLine.match(/Correct\s*Answer[:\s]*([A-D])/i);
        if (m) correct = m[1].toUpperCase();
      }
      const explLine = lines.find((l) => /^Explanation/i.test(l));
      const explanation = explLine ? explLine.replace(/^Explanation[:.)]?\s*/i, "").trim() : "";
      if (question && Object.keys(options).length >= 2 && correct) {
        mcqs.push({ question, options, correct, explanation });
      }
    }
    return mcqs;
  };

  // Study generate
  const handleStudyGenerate = async () => {
    setStudyError("");
    setStudyResult("");
    setParsedMcqs([]);
    setPracticeMode(false);
    setPracticeShowResults(false);
    setPracticeAnswers({});
    setPracticeLocked({});
    setPracticeIdx(0);

    let promptText = "";
    let imageToSend = null;

    if (contentType === "image" && imageData) {
      imageToSend = imageData;
      if (studyMode === "mcq") {
        promptText = `You are an expert exam writer for university students. Look at the image provided and generate multiple-choice questions based on what you see.\n\nDetermine the appropriate number of questions yourself based on how much content is in the image (between 3 and 15).\n\nFORMAT — separate each question with a line containing only "---":\nQ: <question text>\nA. <option A>\nB. <option B>\nC. <option C>\nD. <option D>\nCorrect Answer: <letter>\nExplanation: <brief explanation>\n\nRules:\n- Exactly 4 options (A–D) per question\n- One correct answer\n- Questions should test understanding, not just memorization\n- Keep explanations to 1–2 sentences\n- Base questions on what is visible in the image`;
      } else {
        promptText = `You are an expert study assistant. Look at the image provided and summarize it for university exam preparation.\n\nUse this structure with Markdown headings:\n\n## Key Topics\n- List the main topics covered\n\n## Important Details\n- Key facts, definitions, formulas, and concepts\n\n## Likely Exam Focus\n- What questions or topics are most likely to appear on an exam based on this content\n\nKeep it concise but thorough. Use bullet points and bold key terms.`;
      }
    } else if ((contentType === "docx" || contentType === "txt" || contentType === "pptx") && extractedText) {
      if (studyMode === "mcq") {
        promptText = `You are an expert exam writer for university students. Generate multiple-choice questions from the text below.\n\nDetermine the appropriate number of questions yourself based on how much content is in the text (between 10 and 20). Cover all key topics.\n\nFORMAT — separate each question with a line containing only "---":\nQ: <question text>\nA. <option A>\nB. <option B>\nC. <option C>\nD. <option D>\nCorrect Answer: <letter>\nExplanation: <brief explanation>\n\nRules:\n- Exactly 4 options (A–D) per question\n- One correct answer\n- Questions should test understanding, not just memorization\n- Keep explanations to 1–2 sentences\n\nTEXT:\n"""\n${extractedText.slice(0, 10000)}\n"""`;
      } else {
        promptText = `You are an expert study assistant. Summarize the text below for university exam preparation.\n\nUse this structure with Markdown headings:\n\n## Key Topics\n- List the main topics covered\n\n## Important Details\n- Key facts, definitions, formulas, and concepts\n\n## Likely Exam Focus\n- What questions or topics are most likely to appear on an exam based on this content\n\nKeep it concise but thorough. Use bullet points and bold key terms.\n\nTEXT:\n"""\n${extractedText.slice(0, 10000)}\n"""`;
      }
    } else {
      setStudyError("No content available to generate study materials.");
      return;
    }

    setStudyLoading(true);
    try {
      console.log("[DocReader] AI call start", { contentType, studyMode, hasText: !!extractedText, hasImage: !!imageToSend, promptLen: promptText.length });
      const raw = await callAIMultimodal(promptText, imageToSend, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
      console.log("[DocReader] AI response:", { len: raw?.length, preview: raw?.slice(0, 120) });
      if (!raw || raw.trim().length < 10) {
        console.warn("[DocReader] Empty response");
        setStudyError("AI returned an empty response. Try again.");
        return;
      }
      setStudyResult(raw);
      if (studyMode === "mcq") {
        const mcqs = parseMcqMarkdown(raw);
        setParsedMcqs(mcqs);
        if (mcqs.length > 0) {
          const rangeLabel = contentType === "image" ? "image" : "document";
          saveStudyHistoryEntry({ type: "mcq", mode: "auto", rangeLabel, mcqs, rawText: raw });
          autoSaveToFolder(mcqs, rangeLabel);
          setPracticeMode(true);
        }
      } else {
        saveStudyHistoryEntry({ type: "summary", mode: "auto", rangeLabel: contentType === "image" ? "image" : "document", rawText: raw });
      }
    } catch (err) {
      console.error("[DocReader] study error:", err);
      setStudyError(err.message || "Failed to generate. Please try again.");
    } finally {
      setStudyLoading(false);
    }
  };

  // Chat with AI about the content
  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      let contextText = "";
      let imageToSend = null;
      if (contentType === "image" && imageData) {
        imageToSend = imageData;
        contextText = "The user is looking at an image. Answer their question about it.";
      } else if ((contentType === "docx" || contentType === "txt" || contentType === "pptx") && extractedText) {
        contextText = `The user is reading a document with this content:\n"""\n${extractedText.slice(0, 8000)}\n"""`;
      }

      const systemMsg = { role: "system", content: contextText };
      const history = [systemMsg, ...chatMessages.slice(-6)];
      console.log("[DocReader] chat AI call start", { contentType, hasText: !!extractedText, hasImage: !!imageToSend, historyLen: history.length });
      const raw = await callAIMultimodal(chatInput.trim(), imageToSend, history, { provider: "openrouter", model: "google/gemini-2.5-flash" });
      console.log("[DocReader] chat AI response:", { len: raw?.length, preview: raw?.slice(0, 120) });
      if (raw) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: raw }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "No response from AI. Please try again." }]);
      }
    } catch (err) {
      console.error("[DocReader] chat error:", err);
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Sync canvas size to displayed image size
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }, []);

  useEffect(() => {
    if (contentType === "image" && imageData) {
      // Sync after image loads and on resize
      const img = imageRef.current;
      if (img) {
        const sync = () => syncCanvasSize();
        if (img.complete) sync();
        else img.addEventListener("load", sync, { once: true });
      }
      window.addEventListener("resize", syncCanvasSize);
      return () => window.removeEventListener("resize", syncCanvasSize);
    }
  }, [contentType, imageData, syncCanvasSize]);

  // Get pointer position relative to canvas
  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Circle-to-search on image (mouse + touch)
  const handleCanvasStart = (e) => {
    e.preventDefault();
    const pos = getPointerPos(e);
    setIsDrawing(true);
    drawStartRef.current = pos;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleCanvasMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getPointerPos(e);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const radius = Math.hypot(pos.x - drawStartRef.current.x, pos.y - drawStartRef.current.y);
    ctx.beginPath();
    ctx.arc(drawStartRef.current.x, drawStartRef.current.y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#e94560";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const handleCanvasEnd = async (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPointerPos(e.changedTouches ? { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY } : e);
    const radius = Math.hypot(pos.x - drawStartRef.current.x, pos.y - drawStartRef.current.y);
    if (radius < 10) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Crop the circled region and send to AI
    const img = imageRef.current;
    if (!img) return;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = img.naturalWidth / canvasRect.width;
    const scaleY = img.naturalHeight / canvasRect.height;
    const cropSize = Math.round(radius * 2 * Math.max(scaleX, scaleY));
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropSize;
    cropCanvas.height = cropSize;
    const cropCtx = cropCanvas.getContext("2d");
    const sx = Math.max(0, Math.round((drawStartRef.current.x - radius) * scaleX));
    const sy = Math.max(0, Math.round((drawStartRef.current.y - radius) * scaleY));
    cropCtx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, cropSize, cropSize);
    const croppedDataUrl = cropCanvas.toDataURL("image/png");

    // Clear the circle
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setChatLoading(true);
    try {
      const prompt = "The user circled a region in the image. Explain what is inside the circled area in detail. If it contains text, transcribe it. If it contains a diagram, explain it.";
      const raw = await callAIMultimodal(prompt, croppedDataUrl, [], { provider: "openrouter", model: "google/gemini-2.5-flash" });
      if (raw) {
        setChatMessages((prev) => [...prev, { role: "user", content: "🔍 Circled something in the image" }, { role: "assistant", content: raw }]);
        setShowStudyTools(true);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't analyze that region. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Search in extracted text
  const handleSearch = () => {
    if (!searchQuery.trim() || !extractedText) {
      setSearchResults([]);
      return;
    }
    const lower = extractedText.toLowerCase();
    const query = searchQuery.toLowerCase();
    const results = [];
    let idx = 0;
    while ((idx = lower.indexOf(query, idx)) !== -1) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(extractedText.length, idx + searchQuery.length + 60);
      results.push({
        index: idx,
        preview: (start > 0 ? "…" : "") + extractedText.slice(start, end) + (end < extractedText.length ? "…" : ""),
      });
      idx += searchQuery.length;
    }
    setSearchResults(results);
  };

  if (loading) {
    return (
      <div className="zoom-allowed" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📖</div>
        <div style={{ color: t.muted, fontSize: "14px" }}>Loading document…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="zoom-allowed" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</div>
        <div style={{ color: t.accent, fontSize: "14px", marginBottom: "16px" }}>{error}</div>
        {onBack && <button onClick={onBack} style={{ padding: "8px 20px", borderRadius: "8px", border: `0.5px solid ${t.border}`, background: t.toolbar, color: t.text, cursor: "pointer" }}>← Back</button>}
      </div>
    );
  }

  return (
    <div className="zoom-allowed" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: t.bg }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: t.toolbar, borderBottom: `0.5px solid ${t.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: t.muted, fontSize: "18px", cursor: "pointer", padding: "4px 8px" }}>←</button>
        <span style={{ fontSize: "13px", fontWeight: 600, color: t.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ background: "none", border: "none", color: t.muted, fontSize: "16px", cursor: "pointer", padding: "4px 8px" }}>{theme === "dark" ? "☀️" : "🌙"}</button>
        <button onClick={() => setShowStudyTools(!showStudyTools)} style={{
          padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
          background: showStudyTools ? t.accent : "transparent", color: showStudyTools ? "#fff" : t.muted,
          border: `0.5px solid ${showStudyTools ? t.accent : t.border}`,
        }}>✨ Study Tools</button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Content Panel */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px", position: "relative" }}>
          {contentType === "image" && imageData && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", height: "100%" }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  ref={imageRef}
                  src={imageData}
                  alt={title}
                  style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "8px", display: "block" }}
                />
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasStart}
                  onMouseMove={handleCanvasMove}
                  onMouseUp={handleCanvasEnd}
                  onMouseLeave={() => setIsDrawing(false)}
                  onTouchStart={handleCanvasStart}
                  onTouchMove={handleCanvasMove}
                  onTouchEnd={handleCanvasEnd}
                  style={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    cursor: "crosshair", touchAction: "none", pointerEvents: "auto",
                  }}
                />
              </div>
              <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", fontSize: "11px", color: t.muted, background: t.toolbar, padding: "4px 12px", borderRadius: "999px", border: `0.5px solid ${t.border}`, whiteSpace: "nowrap" }}>
                ✏️ Circle any area to search & explain
              </div>
            </div>
          )}

          {(contentType === "docx" || contentType === "txt" || contentType === "pptx") && extractedText && (
            <div>
              {/* Search bar */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search in document…"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "13px", outline: "none" }}
                />
                <button onClick={handleSearch} style={{ padding: "8px 16px", borderRadius: "8px", border: `0.5px solid ${t.border}`, background: t.toolbar, color: t.text, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Search</button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginBottom: "16px", padding: "12px", background: t.toolbar, borderRadius: "8px", border: `0.5px solid ${t.border}`, maxHeight: "200px", overflowY: "auto" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: t.muted, marginBottom: "8px" }}>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</div>
                  {searchResults.map((r, i) => (
                    <div key={i} style={{ fontSize: "12px", color: t.text, marginBottom: "6px", lineHeight: 1.5, cursor: "pointer" }}
                      onClick={() => {
                        const el = document.getElementById(`doc-text`);
                        if (el) {
                          const before = extractedText.slice(0, r.index);
                          const linesBefore = before.split("\n").length;
                          el.scrollTop = linesBefore * 24;
                        }
                      }}>
                      {r.preview}
                    </div>
                  ))}
                </div>
              )}

              <div id="doc-text" style={{ fontSize: "14px", lineHeight: 1.8, color: t.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {extractedText}
              </div>
            </div>
          )}
        </div>

        {/* Study Tools Panel */}
        {showStudyTools && (
          <div style={{ width: "380px", flexShrink: 0, borderLeft: `0.5px solid ${t.border}`, background: t.toolbar, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Mode tabs */}
            <div style={{ display: "flex", gap: "4px", padding: "10px", borderBottom: `0.5px solid ${t.border}` }}>
              {[["summary", "📝 Summary"], ["mcq", "❓ MCQs"], ["chat", "💬 Ask AI"]].map(([key, label]) => (
                <button key={key} onClick={() => { setStudyMode(key); setStudyResult(""); setParsedMcqs([]); setStudyError(""); setPracticeMode(false); setHistoryView(null); setStudyStep("setup"); }}
                  style={{
                    flex: 1, padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    background: studyMode === key ? t.accent : "transparent", color: studyMode === key ? "#fff" : t.muted,
                    border: `0.5px solid ${studyMode === key ? t.accent : t.border}`,
                  }}>{label}</button>
              ))}
            </div>

            {/* Summary / MCQ Panel */}
            {(studyMode === "summary" || studyMode === "mcq") && (
              <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>

                {/* History view */}
                {studyStep === "history" && !historyView && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>🕘 Study History</span>
                      <button style={{ background: "none", border: "none", color: t.muted, fontSize: 12, cursor: "pointer" }} onClick={() => setStudyStep("setup")}>← Back</button>
                    </div>
                    {studyHistory.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 16px", color: t.muted, fontSize: 13 }}>
                        No history yet. Generate some MCQs or summaries to see them here.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                          {studyHistory.map((entry) => (
                            <div key={entry.id} style={{
                              background: t.hover, border: `0.5px solid ${t.border}`, borderRadius: 10,
                              padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
                            }}>
                              <span style={{ fontSize: 20, flexShrink: 0 }}>{entry.type === "mcq" ? "📝" : "📄"}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {entry.type === "mcq" ? `${entry.mcqs?.length || 0} MCQs` : "Summary"} · {entry.rangeLabel}
                                </div>
                                <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>
                                  {new Date(entry.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })} at {new Date(entry.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                              <button
                                style={{
                                  padding: "6px 12px", background: entry.type === "mcq" ? `${t.accent}20` : t.hover,
                                  border: `1px solid ${entry.type === "mcq" ? t.accent : t.border}`, borderRadius: 8,
                                  fontSize: 11, fontWeight: 700, color: entry.type === "mcq" ? t.accent : t.text,
                                  cursor: "pointer", flexShrink: 0,
                                }}
                                onClick={() => entry.type === "mcq" ? startHistoryQuiz(entry) : setHistoryView(entry)}
                              >
                                {entry.type === "mcq" ? "Practice" : "View"}
                              </button>
                              {entry.type === "mcq" && getWeakSpots(studyResourceId).length > 0 && (
                                <button
                                  style={{
                                    padding: "4px 8px", background: "rgba(255,179,0,0.15)",
                                    border: "1px solid rgba(255,179,0,0.4)", borderRadius: 6,
                                    fontSize: 10, fontWeight: 700, color: "#ffb74d", cursor: "pointer", flexShrink: 0,
                                  }}
                                  onClick={() => startHistoryQuiz(entry, true)} title="Practice weak spots first"
                                >⚡</button>
                              )}
                              {entry.type === "mcq" && (
                                <button style={{ background: "none", border: "none", color: t.muted, fontSize: 14, cursor: "pointer", padding: 4, flexShrink: 0 }}
                                  onClick={() => handleSharePracticeSet(entry)} title="Share with study group">🔗</button>
                              )}
                              <button style={{ background: "none", border: "none", color: t.muted, fontSize: 14, cursor: "pointer", padding: 4, flexShrink: 0 }}
                                onClick={() => deleteStudyHistoryEntry(entry.id)} title="Delete">🗑</button>
                            </div>
                          ))}
                        </div>
                        <button onClick={clearStudyHistory} style={{ width: "100%", marginTop: 12, padding: "8px", borderRadius: 8, fontSize: 12, color: t.accent, background: "transparent", border: `0.5px solid ${t.accent}`, cursor: "pointer" }}>Clear all history</button>
                      </>
                    )}
                  </div>
                )}

                {/* History quiz view */}
                {studyStep === "history" && historyView && historyView.type === "mcq" && !historyQuizShowResults && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>📝 Practice ({historyView.mcqs.length} questions)</span>
                      <button style={{ background: "none", border: "none", color: t.muted, fontSize: 12, cursor: "pointer" }} onClick={() => setHistoryView(null)}>← Back to list</button>
                    </div>
                    <div style={{ height: 4, background: t.hover, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ height: "100%", width: `${historyView.mcqs.length > 0 ? ((historyQuizIdx + (historyQuizLocked[historyQuizIdx] ? 1 : 0)) / historyView.mcqs.length) * 100 : 0}%`, background: t.accent, borderRadius: 4, transition: "width 0.3s ease" }} />
                    </div>
                    {(() => {
                      const q = historyView.mcqs[historyQuizIdx];
                      if (!q) return null;
                      const selected = historyQuizAnswers[historyQuizIdx];
                      const isLocked = historyQuizLocked[historyQuizIdx];
                      return (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.5, marginBottom: 12 }}>Q{historyQuizIdx + 1}. {q.question}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {Object.entries(q.options).map(([key, val]) => {
                              const isSelected = selected === key;
                              const isCorrect = key === q.correct;
                              const showCorrect = isLocked && isCorrect;
                              const showWrong = isLocked && isSelected && !isCorrect;
                              return (
                                <div key={key} onClick={() => !isLocked && handleHistoryQuizAnswer(key)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8,
                                    cursor: isLocked ? "default" : "pointer",
                                    background: showCorrect ? `${t.accent}15` : showWrong ? "rgba(244,67,54,0.12)" : t.hover,
                                    border: `1px solid ${showCorrect ? t.accent : showWrong ? "#ef5350" : isSelected ? t.accent : t.border}`,
                                    transition: "all 0.15s",
                                  }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: showCorrect ? t.accent : showWrong ? "#ef5350" : t.muted, minWidth: 20 }}>{key}.</span>
                                  <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{val}</span>
                                  {showCorrect && <span style={{ fontSize: 14, color: t.accent }}>✓</span>}
                                  {showWrong && <span style={{ fontSize: 14, color: "#ef5350" }}>✕</span>}
                                </div>
                              );
                            })}
                          </div>
                          {isLocked && (
                            <>
                              {q.explanation && (
                                <div style={{ marginTop: 10, padding: "10px 12px", background: t.hover, border: `0.5px solid ${t.border}`, borderRadius: 8, fontSize: 12, color: t.muted, lineHeight: 1.5 }}>
                                  <span style={{ fontWeight: 700, color: t.text }}>Explanation: </span>{q.explanation}
                                </div>
                              )}
                              <button style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", background: t.accent, color: "#fff", border: "none" }} onClick={historyQuizNext}>
                                {historyQuizIdx < historyView.mcqs.length - 1 ? "Next →" : "See Results"}
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* History quiz results */}
                {studyStep === "history" && historyView && historyView.type === "mcq" && historyQuizShowResults && (
                  <div>
                    <div style={{ textAlign: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 32, marginBottom: 4 }}>{historyQuizScore === historyView.mcqs.length ? "🏆" : historyQuizScore >= historyView.mcqs.length / 2 ? "🎉" : "📚"}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: historyQuizScore >= historyView.mcqs.length / 2 ? "#66bb6a" : "#ffb74d" }}>{historyQuizScore} / {historyView.mcqs.length}</div>
                      <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>{historyView.mcqs.length > 0 ? Math.round((historyQuizScore / historyView.mcqs.length) * 100) : 0}% correct</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 250, overflowY: "auto", marginBottom: 12 }}>
                      {historyView.mcqs.map((q, i) => {
                        const userAnswer = historyQuizAnswers[i];
                        const isCorrect = userAnswer === q.correct;
                        return (
                          <div key={i} style={{ padding: "10px 12px", background: t.hover, border: `0.5px solid ${isCorrect ? "#2a6a3a" : "#6a2a2a"}`, borderRadius: 8 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                              <span style={{ fontSize: 13 }}>{isCorrect ? "✅" : "❌"}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.4 }}>{q.question}</span>
                            </div>
                            <div style={{ fontSize: 11, color: t.muted }}>
                              Correct: <span style={{ color: t.accent }}>{q.correct}. {q.options[q.correct]}</span>
                              {userAnswer && !isCorrect && <> · Your answer: <span style={{ color: "#ef5350" }}>{userAnswer}. {q.options[userAnswer]}</span></>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }} onClick={historyQuizRetake}>🔄 Retake</button>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }} onClick={() => handleSharePracticeSet(historyView)}>🔗 Share</button>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }} onClick={() => setHistoryView(null)}>← Back to list</button>
                    </div>
                  </div>
                )}

                {/* History summary view */}
                {studyStep === "history" && historyView && historyView.type === "summary" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>📄 Saved Summary</span>
                      <button style={{ background: "none", border: "none", color: t.muted, fontSize: 12, cursor: "pointer" }} onClick={() => setHistoryView(null)}>← Back to list</button>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                      <MarkdownText>{historyView.rawText}</MarkdownText>
                    </div>
                  </div>
                )}

                {/* Setup screen */}
                {studyStep === "setup" && !studyResult && !studyLoading && (
                  <div>
                    {/* Mastery progress bar */}
                    {mastery.totalQuestions > 0 && (
                      <div style={{ padding: "10px 14px", background: t.hover, border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{getMasteryEmoji(mastery.correctRate)} Document mastery</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: getMasteryColor(mastery.correctRate) }}>{mastery.correctRate}%</span>
                        </div>
                        <div style={{ height: 6, background: t.border, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${mastery.correctRate}%`, background: getMasteryColor(mastery.correctRate), borderRadius: 4, transition: "width 0.4s ease" }} />
                        </div>
                        <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>
                          {mastery.mastered}/{mastery.totalQuestions} questions mastered · Practiced {mastery.practicedCount} time{mastery.practicedCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    )}

                    {/* History button */}
                    {studyHistory.length > 0 && (
                      <button
                        style={{ width: "100%", padding: "10px 14px", background: t.hover, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: t.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
                        onClick={() => setStudyStep("history")}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>🕘</span> History ({studyHistory.length})</span>
                        <span style={{ fontSize: 14, color: t.muted }}>→</span>
                      </button>
                    )}

                    <p style={{ fontSize: "13px", color: t.muted, marginBottom: "14px", lineHeight: 1.6 }}>
                      {studyMode === "mcq" ? "Generate multiple-choice questions from this document to test your knowledge." : "Get an AI-powered summary with key topics, important details, and likely exam focus areas."}
                    </p>
                    <button onClick={handleStudyGenerate} style={{
                      width: "100%", padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                      background: t.accent, color: "#fff", border: "none",
                    }}>✨ Generate {studyMode === "mcq" ? "Questions" : "Summary"}</button>
                  </div>
                )}

                {studyLoading && (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
                    <div style={{ fontSize: "13px", color: t.muted }}>{studyMode === "mcq" ? "Writing questions…" : "Summarizing…"}</div>
                  </div>
                )}
                {studyError && <div style={{ fontSize: "13px", color: t.accent, padding: "12px", background: t.hover, borderRadius: "8px" }}>{studyError}</div>}

                {/* Summary result */}
                {studyMode === "summary" && studyResult && !studyLoading && (
                  <div style={{ fontSize: "13px", lineHeight: 1.7 }}>
                    <MarkdownText>{studyResult}</MarkdownText>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => { navigator.clipboard?.writeText(studyResult).catch(() => {}); }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }}>📋 Copy</button>
                      <button onClick={handleStudyGenerate} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }}>🔄 Regenerate</button>
                      <button onClick={() => { setStudyResult(""); setParsedMcqs([]); }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }}>✨ New</button>
                    </div>
                  </div>
                )}

                {/* MCQ practice-first view */}
                {studyMode === "mcq" && parsedMcqs.length > 0 && !studyLoading && practiceMode && !practiceShowResults && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>📝 Practice ({parsedMcqs.length} questions)</span>
                      <button style={{ background: "none", border: "none", color: t.muted, fontSize: 12, cursor: "pointer" }} onClick={() => setPracticeMode(false)}>View text instead</button>
                    </div>
                    <div style={{ height: 4, background: t.hover, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ height: "100%", width: `${parsedMcqs.length > 0 ? ((practiceIdx + (practiceLocked[practiceIdx] ? 1 : 0)) / parsedMcqs.length) * 100 : 0}%`, background: t.accent, borderRadius: 4, transition: "width 0.3s ease" }} />
                    </div>
                    {(() => {
                      const q = parsedMcqs[practiceIdx];
                      if (!q) return null;
                      const selected = practiceAnswers[practiceIdx];
                      const isLocked = practiceLocked[practiceIdx];
                      return (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.5, marginBottom: 12 }}>Q{practiceIdx + 1}. {q.question}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {Object.entries(q.options).map(([key, val]) => {
                              const isSelected = selected === key;
                              const isCorrect = key === q.correct;
                              const showCorrect = isLocked && isCorrect;
                              const showWrong = isLocked && isSelected && !isCorrect;
                              return (
                                <div key={key} onClick={() => !isLocked && handlePracticeAnswer(key)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8,
                                    cursor: isLocked ? "default" : "pointer",
                                    background: showCorrect ? `${t.accent}15` : showWrong ? "rgba(244,67,54,0.12)" : t.hover,
                                    border: `1px solid ${showCorrect ? t.accent : showWrong ? "#ef5350" : isSelected ? t.accent : t.border}`,
                                    transition: "all 0.15s",
                                  }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: showCorrect ? t.accent : showWrong ? "#ef5350" : t.muted, minWidth: 20 }}>{key}.</span>
                                  <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{val}</span>
                                  {showCorrect && <span style={{ fontSize: 14, color: t.accent }}>✓</span>}
                                  {showWrong && <span style={{ fontSize: 14, color: "#ef5350" }}>✕</span>}
                                </div>
                              );
                            })}
                          </div>
                          {isLocked && (
                            <>
                              {q.explanation && (
                                <div style={{ marginTop: 10, padding: "10px 12px", background: t.hover, border: `0.5px solid ${t.border}`, borderRadius: 8, fontSize: 12, color: t.muted, lineHeight: 1.5 }}>
                                  <span style={{ fontWeight: 700, color: t.text }}>Explanation: </span>{q.explanation}
                                </div>
                              )}
                              <button style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", background: t.accent, color: "#fff", border: "none" }} onClick={practiceNext}>
                                {practiceIdx < parsedMcqs.length - 1 ? "Next →" : "See Results"}
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* MCQ practice results */}
                {studyMode === "mcq" && parsedMcqs.length > 0 && !studyLoading && practiceMode && practiceShowResults && (
                  <div>
                    <div style={{ textAlign: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 32, marginBottom: 4 }}>{practiceScore === parsedMcqs.length ? "🏆" : practiceScore >= parsedMcqs.length / 2 ? "🎉" : "📚"}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: practiceScore >= parsedMcqs.length / 2 ? "#66bb6a" : "#ffb74d" }}>{practiceScore} / {parsedMcqs.length}</div>
                      <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>{parsedMcqs.length > 0 ? Math.round((practiceScore / parsedMcqs.length) * 100) : 0}% correct</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 250, overflowY: "auto", marginBottom: 12 }}>
                      {parsedMcqs.map((q, i) => {
                        const userAnswer = practiceAnswers[i];
                        const isCorrect = userAnswer === q.correct;
                        return (
                          <div key={i} style={{ padding: "10px 12px", background: t.hover, border: `0.5px solid ${isCorrect ? "#2a6a3a" : "#6a2a2a"}`, borderRadius: 8 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                              <span style={{ fontSize: 13 }}>{isCorrect ? "✅" : "❌"}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.4 }}>{q.question}</span>
                            </div>
                            <div style={{ fontSize: 11, color: t.muted }}>
                              Correct: <span style={{ color: t.accent }}>{q.correct}. {q.options[q.correct]}</span>
                              {userAnswer && !isCorrect && <> · Your answer: <span style={{ color: "#ef5350" }}>{userAnswer}. {q.options[userAnswer]}</span></>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }} onClick={practiceRetake}>🔄 Retake</button>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }} onClick={() => setPracticeMode(false)}>📄 View text</button>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }} onClick={() => { setStudyResult(""); setParsedMcqs([]); setPracticeMode(false); }}>✨ New</button>
                    </div>
                  </div>
                )}

                {/* MCQ text fallback (no parsed MCQs or user chose to view text) */}
                {studyMode === "mcq" && studyResult && !studyLoading && (parsedMcqs.length === 0 || !practiceMode) && (
                  <div style={{ fontSize: "13px", lineHeight: 1.7 }}>
                    {parsedMcqs.length > 0 && !practiceMode && (
                      <button onClick={() => startPractice()} style={{ width: "100%", marginBottom: 12, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", background: t.accent, color: "#fff", border: "none" }}>📝 Practice these questions</button>
                    )}
                    {parsedMcqs.length === 0 && (
                      <div style={{ fontSize: 12, color: t.muted, marginBottom: 10, padding: "8px 12px", background: t.hover, borderRadius: 8 }}>Couldn't structure these questions for practice — you can still copy the text below.</div>
                    )}
                    <MarkdownText>{studyResult}</MarkdownText>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => { navigator.clipboard?.writeText(studyResult).catch(() => {}); }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }}>📋 Copy</button>
                      <button onClick={handleStudyGenerate} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }}>🔄 Regenerate</button>
                      <button onClick={() => { setStudyResult(""); setParsedMcqs([]); setPracticeMode(false); }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: t.hover, color: t.text, border: `0.5px solid ${t.border}` }}>✨ New</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat Panel */}
            {studyMode === "chat" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: "center", color: t.muted, fontSize: "13px", padding: "20px 0" }}>
                      Ask any question about this document…
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{
                      marginBottom: "12px", padding: "10px 14px", borderRadius: "12px", maxWidth: "90%",
                      background: msg.role === "user" ? t.accent : t.chatBot,
                      color: msg.role === "user" ? "#fff" : t.text,
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      marginLeft: msg.role === "user" ? "auto" : 0,
                      fontSize: "13px", lineHeight: 1.6,
                    }}>
                      {msg.role === "assistant" ? <MarkdownText>{msg.content}</MarkdownText> : msg.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ fontSize: "13px", color: t.muted, padding: "8px 14px" }}>⏳ Thinking…</div>
                  )}
                </div>

                {/* Smart chips */}
                <div style={{ display: "flex", gap: "6px", padding: "8px 10px", overflowX: "auto", flexShrink: 0 }}>
                  {SMART_CHIPS.map((chip) => (
                    <button key={chip.label} onClick={() => { setChatInput(chip.prompt); }}
                      style={{
                        padding: "6px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
                        background: t.chipBg, color: t.muted, border: `0.5px solid ${t.border}`,
                      }}>{chip.label}</button>
                  ))}
                </div>

                {/* Input */}
                <div style={{ display: "flex", gap: "8px", padding: "10px", borderTop: `0.5px solid ${t.border}`, flexShrink: 0 }}>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                    placeholder="Ask about this document…"
                    style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "13px", outline: "none" }}
                  />
                  <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                    style={{ padding: "10px 16px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", background: t.accent, color: "#fff", border: "none", opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}>
                    ➤
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-save toast */}
      {autoSaveToast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: autoSaveToast.status === "saved" ? "#2a8a4a" : "#c0392b",
          color: "white", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 12, zIndex: 10000,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          <span>{autoSaveToast.status === "saved" ? "✅" : "⚠️"} {autoSaveToast.label}</span>
          {autoSaveToast.status === "saved" && autoSaveToast.resourceId && (
            <button onClick={undoAutoSave} style={{
              background: "rgba(255,255,255,0.2)", border: "none", color: "white",
              padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600,
            }}>Undo</button>
          )}
        </div>
      )}
    </div>
  );
}
