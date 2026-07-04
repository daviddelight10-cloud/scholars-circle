import { useState, useEffect, useRef, useCallback } from "react";
import { callAIMultimodal } from "../lib/aiClient.js";
import MarkdownText from "../components/MarkdownText.jsx";
import { X } from "lucide-react";

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

export default function DocumentReader({ fileUrl, title, contentType, resourceId, onBack }) {
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
  const [mcqAnswers, setMcqAnswers] = useState({});
  const [showMcqResults, setShowMcqResults] = useState(false);
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

  // Escape key to exit
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && onBack) onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

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
      setMcqAnswers({});
      setShowMcqResults(false);
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

  const mcqScore = () => {
    if (!parsedMcqs.length) return 0;
    return parsedMcqs.filter((q, i) => mcqAnswers[i] === q.correct).length;
  };

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📖</div>
        <div style={{ color: t.muted, fontSize: "14px" }}>Loading document…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</div>
        <div style={{ color: t.accent, fontSize: "14px", marginBottom: "16px" }}>{error}</div>
        {onBack && <button onClick={onBack} style={{ padding: "8px 20px", borderRadius: "8px", border: `0.5px solid ${t.border}`, background: t.toolbar, color: t.text, cursor: "pointer" }}>← Back</button>}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: t.bg }}>
      {/* Small exit button */}
      <button
        onClick={onBack}
        title="Exit (Esc)"
        style={{
          position: "fixed", top: 12, right: 12, zIndex: 10000,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(0,0,0,0.5)", border: "none",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}
      >
        <X size={18} />
      </button>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: t.toolbar, borderBottom: `0.5px solid ${t.border}`, flexShrink: 0, paddingRight: 52 }}>
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
                <button key={key} onClick={() => { setStudyMode(key); setStudyResult(""); setParsedMcqs([]); setStudyError(""); }}
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
                {!studyResult && !studyLoading && (
                  <div>
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

                {studyMode === "summary" && studyResult && !studyLoading && (
                  <div style={{ fontSize: "13px", lineHeight: 1.7 }}>
                    <MarkdownText>{studyResult}</MarkdownText>
                  </div>
                )}

                {studyMode === "mcq" && parsedMcqs.length > 0 && !studyLoading && (
                  <div>
                    {showMcqResults && (
                      <div style={{ marginBottom: "14px", padding: "12px", borderRadius: "10px", background: t.hover, textAlign: "center" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, color: t.text }}>{mcqScore()}</span>
                        <span style={{ fontSize: "13px", color: t.muted }}> / {parsedMcqs.length} correct</span>
                      </div>
                    )}
                    {parsedMcqs.map((q, i) => (
                      <div key={i} style={{ marginBottom: "16px", padding: "14px", borderRadius: "10px", border: `0.5px solid ${t.border}`, background: t.bg }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: t.text, marginBottom: "10px" }}>{i + 1}. {q.question}</div>
                        {Object.entries(q.options).map(([key, val]) => {
                          const selected = mcqAnswers[i] === key;
                          const isCorrect = q.correct === key;
                          const showColor = showMcqResults && (selected || isCorrect);
                          return (
                            <button key={key} onClick={() => !showMcqResults && setMcqAnswers((p) => ({ ...p, [i]: key }))}
                              style={{
                                display: "block", width: "100%", textAlign: "left", padding: "8px 12px", marginBottom: "6px",
                                borderRadius: "8px", fontSize: "13px", cursor: showMcqResults ? "default" : "pointer",
                                background: showColor ? (isCorrect ? "rgba(76,175,80,0.15)" : selected ? "rgba(244,67,54,0.15)" : "transparent") : selected ? t.hover : "transparent",
                                border: `0.5px solid ${showColor ? (isCorrect ? "#4caf50" : selected ? "#f44336" : t.border) : selected ? t.accent : t.border}`,
                                color: t.text,
                              }}>
                              <b style={{ marginRight: "6px" }}>{key}.</b> {val}
                              {showMcqResults && isCorrect && " ✓"}
                              {showMcqResults && selected && !isCorrect && " ✗"}
                            </button>
                          );
                        })}
                        {showMcqResults && q.explanation && (
                          <div style={{ marginTop: "8px", fontSize: "12px", color: t.muted, fontStyle: "italic" }}>💡 {q.explanation}</div>
                        )}
                      </div>
                    ))}
                    {!showMcqResults ? (
                      <button onClick={() => setShowMcqResults(true)} disabled={Object.keys(mcqAnswers).length < parsedMcqs.length}
                        style={{ width: "100%", padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", background: t.accent, color: "#fff", border: "none", opacity: Object.keys(mcqAnswers).length < parsedMcqs.length ? 0.5 : 1 }}>
                        Check Answers
                      </button>
                    ) : (
                      <button onClick={() => { setMcqAnswers({}); setShowMcqResults(false); }}
                        style={{ width: "100%", padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", background: "transparent", color: t.text, border: `0.5px solid ${t.border}` }}>
                        Try Again
                      </button>
                    )}
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
    </div>
  );
}
