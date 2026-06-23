import { useState, useEffect, useRef, useCallback } from "react";
import { callAIMultimodal } from "../lib/aiClient.js";
import MarkdownText from "../components/MarkdownText.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ── Theme palettes ────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg: "#EFEEE8", toolbar: "#fff", border: "#E2DFD3", text: "#3F3A33",
    muted: "#80796E", accent: "#C23B3B", hover: "rgba(194,59,59,0.10)",
    inputBg: "#FBFAF6", chatBot: "#F5F4EF", thumbBg: "#FBFAF6",
    shadow: "rgba(0,0,0,0.10)", chipBg: "#F0EEE8",
  },
  dark: {
    bg: "#1a1a2e", toolbar: "#16213e", border: "#0f3460", text: "#e0e0e0",
    muted: "#8892b0", accent: "#e94560", hover: "rgba(233,69,96,0.15)",
    inputBg: "#0f1626", chatBot: "#16213e", thumbBg: "#16213e",
    shadow: "rgba(0,0,0,0.40)", chipBg: "#1a1a2e",
  },
};

// ── Highlighter pen colors ────────────────────────────────────────────────────
const PEN_COLORS = [
  { name: "yellow", value: "rgba(255,235,59,0.35)" },
  { name: "green",  value: "rgba(76,175,80,0.35)" },
  { name: "pink",   value: "rgba(233,30,99,0.35)" },
  { name: "blue",   value: "rgba(33,150,243,0.35)" },
  { name: "orange", value: "rgba(255,152,0,0.35)" },
];

// ── Storage helpers ───────────────────────────────────────────────────────────
function docKeyFromUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveStored(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Route through backend proxy to avoid CORS issues with R2
function getProxiedUrl(fileUrl) {
  if (!fileUrl) return null;
  return `${API_BASE}/api/resources/proxy-pdf?url=${encodeURIComponent(fileUrl)}`;
}

// Load pdf.js from CDN (avoids bundling issues with Vite + PWA)
function loadPdfJs() {
  if (typeof window !== "undefined" && window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PDFJS_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
        resolve(window.pdfjsLib);
      });
      return;
    }
    const script = document.createElement("script");
    script.src = PDFJS_CDN;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF library from CDN"));
    document.head.appendChild(script);
  });
}

const SMART_CHIPS = [
  { label: "Explain simpler", prompt: "Re-explain this in simpler words a beginner would understand." },
  { label: "Step-by-step", prompt: "Break this down into clear numbered steps." },
  { label: "Give an example", prompt: "Give a concrete worked example of this." },
  { label: "Define key terms", prompt: "Define the key terms involved in plain language." },
  { label: "Quiz me", prompt: "Ask me 2 short questions to test if I understood this. Wait for my answers." },
  { label: "Why it matters", prompt: "Why is this important and where is it used in practice?" },
];

const TUTOR_SYSTEM = `You are a study assistant. A student circled content in their PDF and needs a direct answer.

RULE: Start your reply with the answer itself — NO preamble, NO "this is about...", NO "why it matters", NO compliments.

DETECT the content type from the image, then respond:
• QUESTION (has "?" or asks something) → Answer it completely and directly.
• TERM / CONCEPT → Define it in plain language + one concrete example.
• MATH / SCIENCE PROBLEM or FORMULA → Solve step by step with full working shown.
• DIAGRAM or IMAGE → Name it, label key parts, explain what it shows.
• GENERAL STATEMENT → Explain the core idea simply.

Format: **bold** key terms. Numbered steps for problems. Bullet points for lists.
Length: concise, but never cut short a multi-step solution.`;

export default function PdfReader({ fileUrl, title, initialFullscreen = false, onBack }) {
  const docKey = docKeyFromUrl(fileUrl || "unknown");

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [userZoomed, setUserZoomed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showThumbs, setShowThumbs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [fullscreen, setFullscreen] = useState(initialFullscreen);

  // Theme
  const [theme, setTheme] = useState(() => loadStored("sc_pdf_theme", "light"));
  const T = THEMES[theme];

  // Tool mode: "none" | "highlight" | "erase" | "circle"
  const [tool, setTool] = useState("none");
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Annotations: { [pageNum]: [{ color, width, points: [{x,y}] }] }  (points in PDF coords)
  const [annotations, setAnnotations] = useState(() => loadStored(`sc_pdf_annots_${docKey}`, {}));
  const currentStrokes = useRef([]); // strokes being drawn in screen coords
  const [renderStrokes, setRenderStrokes] = useState(""); // SVG path string for current stroke

  // Bookmarks
  const [bookmarks, setBookmarks] = useState(() => loadStored(`sc_pdf_bookmarks_${docKey}`, []));
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [resumePage, setResumePage] = useState(null);

  // TTS
  const [speaking, setSpeaking] = useState(false);
  const ttsUtterRef = useRef(null);

  // Mobile / overflow menu
  const [isMobile, setIsMobile] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);

  // Circle-to-Ask state (now part of tool modes)
  const circleMode = tool === "circle";
  const [isDrawing, setIsDrawing] = useState(false);
  const lassoPoints = useRef([]);
  const [lassoPath, setLassoPath] = useState("");

  // Chat popup state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatPosition, setChatPosition] = useState({ left: 0, top: 0 });
  const [chatError, setChatError] = useState(null);

  // Refs
  const pdfDocRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const viewerRef = useRef(null);
  const lassoSvgRef = useRef(null);
  const textCacheRef = useRef({});
  const pageTextRef = useRef("");
  const chatScrollRef = useRef(null);
  const inputRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // Page sorter filter
  const [pageFilter, setPageFilter] = useState("all");

  // Save-flashcard confirmation
  const [flashcardSaved, setFlashcardSaved] = useState(false);

  // Scroll mode: "single" | "vertical" | "horizontal"
  const [scrollMode, setScrollMode] = useState(() => loadStored(`sc_pdf_scrollmode_${docKey}`, "single"));
  const [transitioning, setTransitioning] = useState(false);
  const [transitionDir, setTransitionDir] = useState("next");
  const pageItemRefs = useRef([]);
  const pageCanvasRefs = useRef([]);
  const observerRef = useRef(null);
  const [visiblePages, setVisiblePages] = useState(new Set([1]));

  // Load PDF document
  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadError("");
        const pdfjs = await loadPdfJs();
        if (cancelled) return;
        const loadingTask = pdfjs.getDocument(getProxiedUrl(fileUrl));
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        // Defer fitToWidth so fullscreen layout is painted before measuring container width
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (cancelled) return;
        const fittedScale = await fitToWidth();
        await renderPage(1, fittedScale);
        setLoading(false);
        // Re-fit after loading spinner unmounts (container dimensions may shift)
        setTimeout(async () => {
          if (!cancelled) {
            const s = await fitToWidth();
            await renderPage(1, s);
          }
        }, 150);
      } catch (err) {
        console.error("PDF load error:", err);
        setLoadError(`Couldn't open this PDF. ${err.message || ""}`);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const fitToWidth = useCallback(async () => {
    if (!pdfDocRef.current) return null;
    const page = await pdfDocRef.current.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const container = viewerRef.current;
    if (!container) return null;
    const isMob = window.innerWidth < 640;
    const available = container.clientWidth - (isMob ? 8 : 40);
    const fit = Math.max(0.5, Math.min(2.2, available / base.width));
    setScale(fit);
    return fit;
  }, []);

  const renderPage = useCallback(async (n, scaleOverride) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    const page = await pdfDocRef.current.getPage(n);
    const useScale = scaleOverride ?? scale;
    const viewport = page.getViewport({ scale: useScale });
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    const ctx = canvas.getContext("2d");

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (e) {}
    }
    const task = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err) {
      if (!err || err.name !== "RenderingCancelledException") console.error(err);
    }
  }, [scale]);

  // Re-render on scale change (single mode only)
  useEffect(() => {
    if (pdfDocRef.current && !loading && scrollMode === "single") {
      renderPage(currentPage);
    }
    // In continuous mode, clear rendered flags so pages re-render at new scale
    if (scrollMode !== "single" && pdfDocRef.current && !loading) {
      pageCanvasRefs.current.forEach((c) => { if (c) delete c.dataset.rendered; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  // Render visible pages in continuous scroll mode
  useEffect(() => {
    if (scrollMode === "single" || !pdfDocRef.current || loading) return;
    visiblePages.forEach((pg) => {
      const canvas = pageCanvasRefs.current[pg - 1];
      if (canvas && !canvas.dataset.rendered) {
        canvas.dataset.rendered = "true";
        renderPageToCanvas(pg, canvas);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePages, scrollMode, loading, scale]);

  // Re-fit width when fullscreen toggles
  useEffect(() => {
    if (!pdfDocRef.current) return;
    setUserZoomed(false);
    fitToWidth().then((s) => { if (s) renderPage(currentPage, s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // Auto-refit on container resize (handles layout shifts, safe-area changes, orientation)
  useEffect(() => {
    if (!viewerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (pdfDocRef.current && !userZoomed && !loading) {
        fitToWidth().then((s) => {
          if (s && scrollMode === "single") renderPage(currentPage, s);
        });
      }
    });
    ro.observe(viewerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userZoomed, loading, scrollMode, currentPage]);

  // Esc to exit fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // Handle window resize
  useEffect(() => {
    let timer;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (userZoomed) return;
        await fitToWidth();
      }, 200);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [userZoomed, fitToWidth]);

  const renderPageToCanvas = useCallback(async (n, canvasEl) => {
    if (!pdfDocRef.current || !canvasEl) return;
    const page = await pdfDocRef.current.getPage(n);
    const viewport = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvasEl.width = Math.floor(viewport.width * dpr);
    canvasEl.height = Math.floor(viewport.height * dpr);
    canvasEl.style.width = viewport.width + "px";
    canvasEl.style.height = viewport.height + "px";
    const ctx = canvasEl.getContext("2d");
    const task = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
    try {
      await task.promise;
    } catch (err) {
      if (!err || err.name !== "RenderingCancelledException") console.error(err);
    }
  }, [scale]);

  const goToPage = useCallback(async (n) => {
    if (!pdfDocRef.current) return;
    n = Math.max(1, Math.min(pdfDocRef.current.numPages, n));
    if (n === currentPage) return;
    closeChat();

    if (scrollMode !== "single") {
      const el = pageItemRefs.current[n - 1];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" });
      setCurrentPage(n);
      return;
    }

    const dir = n > currentPage ? "next" : "prev";
    setTransitionDir(dir);
    setTransitioning(true);
    // Wait for exit animation
    await new Promise((r) => setTimeout(r, 220));
    setCurrentPage(n);
    await renderPage(n);
    // Enter animation
    setTransitioning(false);
  }, [currentPage, renderPage, scrollMode]);

  const handleZoomIn = () => {
    setUserZoomed(true);
    setScale((s) => Math.min(2.6, s * 1.2));
  };

  const handleZoomOut = () => {
    setUserZoomed(true);
    setScale((s) => Math.max(0.5, s / 1.2));
  };

  const getPageText = useCallback(async (n) => {
    if (textCacheRef.current[n]) return textCacheRef.current[n];
    if (!pdfDocRef.current) return "";
    const page = await pdfDocRef.current.getPage(n);
    const tc = await page.getTextContent();
    const text = tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
    textCacheRef.current[n] = text;
    return text;
  }, []);

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") goToPage(currentPage + 1);
      if (e.key === "ArrowLeft") goToPage(currentPage - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPage, goToPage]);

  // ---- Search ----
  const runSearch = useCallback(async (query) => {
    const q = query.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    const results = [];
    const ql = q.toLowerCase();
    for (let n = 1; n <= (pdfDocRef.current?.numPages || 0); n++) {
      const text = await getPageText(n);
      const lower = text.toLowerCase();
      let idx = lower.indexOf(ql);
      while (idx !== -1) {
        const start = Math.max(0, idx - 38);
        const end = Math.min(text.length, idx + ql.length + 38);
        const before = (start > 0 ? "…" : "") + text.slice(start, idx);
        const match = text.slice(idx, idx + ql.length);
        const after = text.slice(idx + ql.length, end) + (end < text.length ? "…" : "");
        results.push({ page: n, before, match, after, query: q });
        idx = lower.indexOf(ql, idx + ql.length);
      }
    }
    setSearchResults(results);
    setSearching(false);
  }, [getPageText]);

  // ---- Circle to Ask (lasso helpers) ----
  const getRelPoint = (e) => {
    const canvas = scrollMode === "single" ? canvasRef.current : pageCanvasRefs.current[currentPage - 1];
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const analyzeLasso = async (poly) => {
    const canvas = scrollMode === "single" ? canvasRef.current : pageCanvasRefs.current[currentPage - 1];
    if (!canvas) return;

    // Scale lasso points from CSS pixels to canvas internal pixels
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const scaledPoly = poly.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
    }));

    const xs = scaledPoly.map((p) => p.x);
    const ys = scaledPoly.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);

    const crop = document.createElement("canvas");
    crop.width = bw;
    crop.height = bh;
    const cctx = crop.getContext("2d");
    const clip = new Path2D();
    scaledPoly.forEach((p, i) => {
      const lx = p.x - minX;
      const ly = p.y - minY;
      if (i === 0) clip.moveTo(lx, ly);
      else clip.lineTo(lx, ly);
    });
    clip.closePath();
    cctx.save();
    cctx.clip(clip);
    cctx.drawImage(canvas, -minX, -minY);
    cctx.restore();
    const thumb = crop.toDataURL("image/png");

    // Position popup near the lasso (use original CSS coordinates, not internal)
    const cssMinX = Math.min(...poly.map((p) => p.x));
    const cssMaxX = Math.max(...poly.map((p) => p.x));
    const cssMaxY = Math.max(...poly.map((p) => p.y));
    const popupW = 280;
    const left = Math.max(8, Math.min((cssMinX + cssMaxX) / 2 - popupW / 2, rect.width - popupW - 8));
    const top = Math.min(cssMaxY + 14, rect.height - 40);
    setChatPosition({ left, top });

    // Get page text for context
    let pageText = "";
    try { pageText = await getPageText(currentPage); } catch (e) {}
    pageTextRef.current = pageText;

    // Start conversation: first user message with image
    const pageContext = pageText ? `\n\nPage text (use only if the image alone is ambiguous):\n${pageText.slice(0, 1000)}` : "";
    const firstPrompt = `${TUTOR_SYSTEM}${pageContext}\n\n---\n\nThe image attached is EXACTLY what the student circled. Look at the image. Identify what type of content it is (question / term / problem / diagram / statement). Then immediately provide the answer — begin your response with the answer, nothing else.`;

    setChatMessages([{ role: "user", content: "What did I circle?", image: thumb }]);
    setChatOpen(true);
    setChatLoading(true);
    setChatError(null);

    try {
      const answer = await callAIMultimodal(firstPrompt, thumb, [], { provider: "openrouter" });
      setChatMessages((prev) => [...prev, { role: "assistant", content: answer || "No response." }]);
    } catch (err) {
      setChatError(err.message || "Something went wrong reaching the AI.");
    } finally {
      setChatLoading(false);
    }
  };

  // ---- Chat popup ----
  const closeChat = () => {
    setChatOpen(false);
    setChatMessages([]);
    setChatLoading(false);
    setChatInput("");
    setChatError(null);
  };

  const sendFollowUp = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    setChatMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    // Build history for API (exclude the current message we just added)
    const historyForApi = [...chatMessages, { role: "user", content: trimmed }];

    // Add page text context to the prompt
    const followCtx = pageTextRef.current ? `\n\nPage text for reference:\n${pageTextRef.current.slice(0, 800)}` : "";
    const promptWithContext = `${TUTOR_SYSTEM}${followCtx}\n\n---\n\nCONVERSATION SO FAR:\n${historyForApi.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")}\n\nUSER FOLLOW-UP: ${trimmed}\n\nAnswer the follow-up directly. Start with the answer.`;

    try {
      const answer = await callAIMultimodal(promptWithContext, null, historyForApi, { provider: "openrouter" });
      setChatMessages((prev) => [...prev, { role: "assistant", content: answer || "No response." }]);
    } catch (err) {
      setChatError(err.message || "Something went wrong. Try sending that again.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendFollowUp(chatInput);
    }
  };

  const retryLastMessage = () => {
    // Find last user message
    const lastUserIdx = [...chatMessages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = chatMessages.length - 1 - lastUserIdx;
    const lastUserMsg = chatMessages[actualIdx];
    // Remove any error state and re-send
    setChatMessages((prev) => prev.slice(0, actualIdx + 1));
    setChatError(null);
    setChatLoading(true);
    const historyForApi = chatMessages.slice(0, actualIdx + 1);
    const retryCtx = pageTextRef.current ? `\n\nPage text:\n${pageTextRef.current.slice(0, 800)}` : "";
    const promptWithContext = `${TUTOR_SYSTEM}${retryCtx}\n\n---\n\nCONVERSATION SO FAR:\n${historyForApi.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")}\n\nRETRY: ${lastUserMsg.content}\n\nAnswer directly. Start with the answer.`;
    callAIMultimodal(promptWithContext, null, historyForApi, { provider: "openrouter" })
      .then((answer) => {
        setChatMessages((prev) => [...prev, { role: "assistant", content: answer || "No response." }]);
      })
      .catch((err) => {
        setChatError(err.message || "Something went wrong. Try again.");
      })
      .finally(() => setChatLoading(false));
  };

  // ---- Search "Ask about this" ----
  const askAboutSearchResult = async (result) => {
    goToPage(result.page);
    setShowSearch(false);

    // Get page text
    let pageText = "";
    try { pageText = await getPageText(result.page); } catch (e) {}
    pageTextRef.current = pageText;

    const snippet = (result.before + result.match + result.after).trim();
    const firstPrompt = `I found this on page ${result.page} when searching for '${result.query}' — explain it:\n"""${snippet}"""\n\n[Full page text for context:\n"""${pageText || "(no text)"}"""\n]\nExplain it like a clear, encouraging tutor. Keep it under 90 words.`;

    // Position popup in center of viewer
    const viewer = viewerRef.current;
    if (viewer) {
      setChatPosition({
        left: Math.max(8, (viewer.clientWidth - 280) / 2),
        top: 60,
      });
    }

    setChatMessages([{ role: "user", content: firstPrompt }]);
    setChatOpen(true);
    setChatLoading(true);
    setChatError(null);

    try {
      const answer = await callAIMultimodal(firstPrompt, null, [], { provider: "openrouter" });
      setChatMessages((prev) => [...prev, { role: "assistant", content: answer || "No response." }]);
    } catch (err) {
      setChatError(err.message || "Something went wrong reaching the AI.");
    } finally {
      setChatLoading(false);
    }
  };

  // ---- Thumbnails ----
  const [thumbs, setThumbs] = useState([]);
  useEffect(() => {
    if (!showThumbs || !pdfDocRef.current || thumbs.length > 0) return;
    let cancelled = false;
    (async () => {
      const arr = [];
      for (let n = 1; n <= pdfDocRef.current.numPages; n++) {
        if (cancelled) return;
        const page = await pdfDocRef.current.getPage(n);
        const vp = page.getViewport({ scale: 0.24 });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        arr.push({ page: n, dataUrl: c.toDataURL() });
      }
      if (!cancelled) setThumbs(arr);
    })();
    return () => { cancelled = true; };
  }, [showThumbs, thumbs.length]);

  // ---- Highlighter / Eraser ----
  const screenToPdf = (p) => ({ x: p.x / scale, y: p.y / scale });
  const pdfToScreen = (p) => ({ x: p.x * scale, y: p.y * scale });

  const onOverlayDown = (e) => {
    if (tool === "none") return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const p = getRelPoint(e);

    if (tool === "circle") {
      setIsDrawing(true);
      lassoPoints.current = [p];
      setLassoPath(`M ${p.x},${p.y}`);
      closeChat();
      return;
    }

    if (tool === "erase") {
      // Hit-test: find nearest stroke within threshold
      const pageAnnots = annotations[currentPage] || [];
      const threshold = 12 / scale;
      for (let si = pageAnnots.length - 1; si >= 0; si--) {
        const stroke = pageAnnots[si];
        const pdfP = screenToPdf(p);
        const hit = stroke.points.some((sp) => Math.hypot(sp.x - pdfP.x, sp.y - pdfP.y) < threshold);
        if (hit) {
          setAnnotations((prev) => {
            const arr = [...(prev[currentPage] || [])];
            arr.splice(si, 1);
            return { ...prev, [currentPage]: arr };
          });
          break;
        }
      }
      return;
    }

    if (tool === "highlight") {
      setIsDrawing(true);
      currentStrokes.current = [p];
      const d = `M ${p.x},${p.y}`;
      setRenderStrokes(d);
    }
  };

  const onOverlayMove = (e) => {
    if (!isDrawing) return;
    const p = getRelPoint(e);

    if (tool === "circle") {
      const last = lassoPoints.current[lassoPoints.current.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
      lassoPoints.current.push(p);
      const d = "M " + lassoPoints.current.map((p) => `${p.x},${p.y}`).join(" L ");
      setLassoPath(d);
      return;
    }

    if (tool === "highlight") {
      const last = currentStrokes.current[currentStrokes.current.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
      currentStrokes.current.push(p);
      const d = "M " + currentStrokes.current.map((p) => `${p.x},${p.y}`).join(" L ");
      setRenderStrokes(d);
    }
  };

  const onOverlayUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "circle") {
      const poly = lassoPoints.current;
      lassoPoints.current = [];
      setLassoPath("");
      if (poly.length < 4) return;
      await analyzeLasso(poly);
      return;
    }

    if (tool === "highlight") {
      const pts = currentStrokes.current;
      currentStrokes.current = [];
      setRenderStrokes("");
      if (pts.length < 2) return;
      // Convert to PDF coords and save
      const pdfPts = pts.map(screenToPdf);
      setAnnotations((prev) => ({
        ...prev,
        [currentPage]: [...(prev[currentPage] || []), { color: penColor, width: 12 / scale, points: pdfPts }],
      }));
    }
  };

  const clearPageAnnotations = () => {
    if (!annotations[currentPage]?.length) return;
    if (!confirm(`Clear all highlights on page ${currentPage}?`)) return;
    setAnnotations((prev) => {
      const next = { ...prev };
      delete next[currentPage];
      return next;
    });
  };

  // Build SVG paths for saved annotations on current page
  const savedAnnotationPaths = (annotations[currentPage] || []).map((stroke, si) => {
    const d = "M " + stroke.points.map((p) => {
      const s = pdfToScreen(p);
      return `${s.x},${s.y}`;
    }).join(" L ");
    return { si, d, color: stroke.color, width: stroke.width * scale };
  });

  // ---- TTS ----
  const toggleTTS = async () => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = await getPageText(currentPage);
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    ttsUtterRef.current = utter;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  // ---- Bookmarks ----
  const toggleBookmark = () => {
    setBookmarks((prev) =>
      prev.includes(currentPage)
        ? prev.filter((p) => p !== currentPage)
        : [...prev, currentPage].sort((a, b) => a - b)
    );
  };

  // ---- Swipe navigation ----
  const onTouchStartViewer = (e) => {
    if (tool !== "none") return;
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchMoveViewer = () => {};

  const onTouchEndViewer = (e) => {
    if (tool !== "none") return;
    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) goToPage(currentPage - 1);
        else goToPage(currentPage + 1);
      }
    }
  };

  // ---- Tool toggle helper ----
  const toggleTool = (t) => {
    setTool((prev) => {
      const next = prev === t ? "none" : t;
      if (next === "none") {
        setLassoPath("");
        setRenderStrokes("");
        lassoPoints.current = [];
        currentStrokes.current = [];
        if (prev === "circle") closeChat();
      }
      if (next !== "highlight") setShowColorPicker(false);
      return next;
    });
  };

  // ---- Resume ----
  const doResume = () => {
    if (resumePage) {
      goToPage(resumePage);
      setResumePage(null);
    }
  };

  // ---- Theme persistence ----
  useEffect(() => { saveStored("sc_pdf_theme", theme); }, [theme]);

  // ---- Annotation persistence (debounced) ----
  useEffect(() => {
    const t = setTimeout(() => saveStored(`sc_pdf_annots_${docKey}`, annotations), 500);
    return () => clearTimeout(t);
  }, [annotations, docKey]);

  // ---- Bookmark persistence ----
  useEffect(() => { saveStored(`sc_pdf_bookmarks_${docKey}`, bookmarks); }, [bookmarks, docKey]);

  // ---- Scroll mode persistence ----
  useEffect(() => { saveStored(`sc_pdf_scrollmode_${docKey}`, scrollMode); }, [scrollMode, docKey]);

  // ---- Re-render when scrollMode changes ----
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;
    if (scrollMode === "single") {
      fitToWidth().then(() => renderPage(currentPage));
    } else {
      // Reset canvas render flags and seed visible pages with current page
      pageCanvasRefs.current.forEach((c) => { if (c) delete c.dataset.rendered; });
      setVisiblePages(new Set([currentPage]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollMode]);

  // ---- IntersectionObserver for continuous scroll mode ----
  useEffect(() => {
    if (scrollMode === "single" || !pdfDocRef.current) {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      return;
    }
    if (observerRef.current) observerRef.current.disconnect();

    const observer = new IntersectionObserver((entries) => {
      const newVisible = new Set();
      let mostVisiblePage = currentPage;
      let maxRatio = 0;
      entries.forEach((entry) => {
        const pg = parseInt(entry.target.dataset.page, 10);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          newVisible.add(pg);
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisiblePage = pg;
          }
        }
      });
      if (newVisible.size > 0) {
        setVisiblePages((prev) => new Set([...prev, ...newVisible]));
        if (maxRatio >= 0.5 && mostVisiblePage !== currentPage) {
          setCurrentPage(mostVisiblePage);
        }
      }
    }, { root: viewerRef.current, threshold: [0, 0.3, 0.5, 0.7, 1] });

    observerRef.current = observer;

    // Observe all page items
    pageItemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [scrollMode, numPages, currentPage]);

  // ---- Mobile detection ----
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ---- Resume reading ----
  useEffect(() => {
    const saved = loadStored(`sc_pdf_lastpage_${docKey}`, null);
    if (saved && saved > 1) setResumePage(saved);
  }, [docKey]);

  useEffect(() => {
    if (currentPage > 1) saveStored(`sc_pdf_lastpage_${docKey}`, currentPage);
  }, [currentPage, docKey]);

  // ---- TTS: stop on page change ----
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, []);

  useEffect(() => {
    if (speaking && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // ---- Styles ----
  const s = {
    container: {
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: T.bg,
      borderRadius: "10px",
      position: "relative",
      ...(fullscreen && {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        borderRadius: 0,
        height: "100vh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }),
    },
    toolbar: {
      background: T.toolbar,
      borderBottom: `1px solid ${T.border}`,
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    },
    toolbarRow: {
      display: "flex",
      alignItems: "center",
      gap: isMobile ? "2px" : "6px",
      padding: isMobile ? "6px max(8px, env(safe-area-inset-left))" : "8px max(14px, env(safe-area-inset-left))",
      paddingRight: isMobile ? "max(8px, env(safe-area-inset-right))" : "max(14px, env(safe-area-inset-right))",
      width: "100%",
      boxSizing: "border-box",
      overflow: isMobile ? "hidden" : "visible",
      overflowX: isMobile ? "hidden" : "auto",
    },
    docTitle: {
      fontFamily: "Georgia, serif",
      fontSize: isMobile ? 12 : 15,
      fontWeight: 600,
      color: T.text,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      flex: 1,
      minWidth: 0,
    },
    iconBtn: {
      width: isMobile ? "36px" : "40px",
      height: isMobile ? "36px" : "40px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: T.muted,
      border: "none",
      background: "none",
      cursor: "pointer",
      flexShrink: 0,
    },
    sep: { width: "1px", height: "24px", background: T.border, margin: isMobile ? "0 1px" : "0 2px", flexShrink: 0 },
    pageIndicator: {
      fontFamily: "ui-monospace, monospace",
      fontSize: isMobile ? 12 : 14,
      color: T.muted,
      whiteSpace: "nowrap",
      flexShrink: 0,
    },
    pageInput: {
      width: isMobile ? "32px" : "40px",
      textAlign: "center",
      border: `1px solid ${T.border}`,
      borderRadius: "5px",
      padding: isMobile ? "3px 2px" : "4px 2px",
      fontFamily: "ui-monospace, monospace",
      fontSize: isMobile ? 12 : 14,
      background: T.inputBg,
      color: T.text,
      flexShrink: 0,
    },
    zoomLabel: {
      fontFamily: "ui-monospace, monospace",
      fontSize: isMobile ? 11 : 13,
      color: T.muted,
      minWidth: isMobile ? "38px" : "44px",
      textAlign: "center",
      flexShrink: 0,
    },
    spacer: { flex: 1 },
    workspace: { flex: 1, display: "flex", overflow: "hidden", minHeight: 0 },
    thumbsAside: {
      width: showThumbs ? (isMobile ? "0" : "132px") : "0",
      overflow: "hidden",
      background: T.thumbBg,
      borderRight: `1px solid ${T.border}`,
      transition: "width 0.18s ease",
      flexShrink: 0,
    },
    thumbRail: {
      width: "132px",
      height: "100%",
      overflowY: "auto",
      padding: "0 8px 10px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    pageFilterRow: {
      display: "flex",
      gap: 4,
      padding: "8px 8px 6px",
      flexWrap: "wrap",
      flexShrink: 0,
    },
    pageFilterTab: {
      fontSize: 10.5,
      fontWeight: 600,
      padding: "3px 8px",
      borderRadius: 999,
      border: `1px solid ${T.border}`,
      background: "none",
      color: T.muted,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    thumb: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px",
      padding: "5px",
      borderRadius: "6px",
      border: "1.5px solid transparent",
      background: "none",
      cursor: "pointer",
    },
    thumbLabel: {
      fontFamily: "ui-monospace, monospace",
      fontSize: 10,
      color: T.muted,
    },
    viewer: scrollMode === "single" ? {
      flex: 1,
      overflow: "auto",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: isMobile ? "8px 4px 40px" : "24px 16px 40px",
      position: "relative",
    } : scrollMode === "vertical" ? {
      flex: 1,
      overflowY: "auto",
      overflowX: "hidden",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: isMobile ? 8 : 16,
      padding: isMobile ? "8px 4px 40px" : "24px 16px 40px",
      position: "relative",
    } : {
      flex: 1,
      overflowX: "auto",
      overflowY: "hidden",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: isMobile ? 8 : 24,
      padding: isMobile ? "8px 4px 40px" : "24px 24px 40px",
      position: "relative",
      scrollSnapType: "x mandatory",
    },
    pageShadow: {
      position: "relative",
      background: theme === "dark" ? "#2a2a3e" : "white",
      boxShadow: `0 2px 10px ${T.shadow}, 0 14px 34px ${T.shadow}`,
      lineHeight: 0,
      flexShrink: 0,
    },
    continuousPageItem: {
      position: "relative",
      background: theme === "dark" ? "#2a2a3e" : "white",
      boxShadow: `0 2px 10px ${T.shadow}, 0 14px 34px ${T.shadow}`,
      lineHeight: 0,
      flexShrink: 0,
      scrollSnapAlign: scrollMode === "horizontal" ? "center" : "unset",
    },
    pageLabel: {
      position: "absolute",
      bottom: 4,
      right: 8,
      fontFamily: "ui-monospace, monospace",
      fontSize: 10,
      color: T.muted,
      background: theme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)",
      borderRadius: 4,
      padding: "1px 5px",
      pointerEvents: "none",
    },
    scrollModeToggle: {
      display: "flex",
      gap: 2,
      alignItems: "center",
      flexShrink: 0,
    },
    scrollModeBtn: {
      width: isMobile ? 26 : 30,
      height: isMobile ? 26 : 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      background: "none",
      color: T.muted,
      cursor: "pointer",
      flexShrink: 0,
    },
    loadingOverlay: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: T.bg,
      fontSize: 13,
      color: T.muted,
      gap: 8,
    },
    spinner: {
      width: 14,
      height: 14,
      border: `2px solid ${T.border}`,
      borderTopColor: T.accent,
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    },
    // Search panel
    searchWrap: { position: "relative" },
    searchPanel: {
      position: isMobile ? "fixed" : "absolute",
      top: isMobile ? 96 : "44px",
      left: isMobile ? 8 : "auto",
      right: isMobile ? 8 : 0,
      width: isMobile ? "auto" : "280px",
      maxHeight: "320px",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: "10px",
      boxShadow: `0 10px 30px ${T.shadow}`,
      display: showSearch ? "flex" : "none",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: 200,
    },
    searchRow: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 10px",
      borderBottom: `1px solid ${T.border}`,
    },
    searchInput: {
      flex: 1,
      border: "none",
      outline: "none",
      fontSize: 13,
      background: "transparent",
      color: T.text,
    },
    searchCount: {
      fontFamily: "ui-monospace, monospace",
      fontSize: 10.5,
      color: T.muted,
      whiteSpace: "nowrap",
    },
    searchResults: { overflowY: "auto", maxHeight: "270px" },
    searchItem: {
      display: "block",
      width: "100%",
      textAlign: "left",
      padding: "8px 12px",
      borderBottom: `1px solid ${T.border}`,
      background: "none",
      border: "none",
      cursor: "pointer",
    },
    searchPage: {
      display: "inline-block",
      fontFamily: "ui-monospace, monospace",
      fontSize: 10,
      color: T.accent,
      marginBottom: 2,
    },
    searchSnip: {
      display: "block",
      fontSize: 12.5,
      lineHeight: 1.4,
      color: T.muted,
    },
    askBtn: {
      display: "inline-block",
      marginTop: 4,
      fontSize: 10.5,
      fontWeight: 600,
      color: T.accent,
      background: T.hover,
      border: "none",
      borderRadius: "4px",
      padding: "2px 8px",
      cursor: "pointer",
    },
    // Lasso / highlight overlay
    lassoOverlay: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      pointerEvents: tool !== "none" ? "auto" : "none",
      touchAction: "none",
      cursor: tool === "highlight" ? "crosshair" : tool === "erase" ? "pointer" : tool === "circle" ? "crosshair" : "default",
    },
    lassoPath: {
      fill: "rgba(194,59,59,0.12)",
      stroke: T.accent,
      strokeWidth: 3,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    // Circle bubble
    circleBubble: {
      position: "absolute",
      bottom: 16,
      right: 16,
      width: 54,
      height: 54,
      borderRadius: "50%",
      background: circleMode ? T.text : T.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 6px 18px ${T.shadow}`,
      zIndex: 30,
      border: "none",
      cursor: "pointer",
      transition: "transform 0.12s ease, background 0.15s ease",
    },
    // Chat popup — mobile bottom sheet / desktop side panel
    chatBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 90,
    },
    chatPopup: isMobile ? {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: "72vh",
      background: T.toolbar,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      boxShadow: `0 -4px 24px ${T.shadow}`,
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      animation: "slideUp 0.2s ease",
    } : {
      position: "fixed",
      top: "50%",
      right: 16,
      transform: "translateY(-50%)",
      width: 420,
      maxWidth: "calc(100vw - 32px)",
      maxHeight: "calc(100vh - 100px)",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      boxShadow: `0 12px 36px ${T.shadow}`,
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
    },
    sheetHandle: {
      width: 40,
      height: 4,
      background: T.border,
      borderRadius: 2,
      margin: "8px auto 4px",
      flexShrink: 0,
    },
    chatHead: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: isMobile ? "6px 14px 8px" : "10px 14px",
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    },
    chatTag: {
      fontFamily: "ui-monospace, monospace",
      fontSize: isMobile ? 11 : 12,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: T.accent,
      fontWeight: 600,
    },
    chatClose: {
      color: T.muted,
      fontSize: 13,
      background: "none",
      border: "none",
      cursor: "pointer",
    },
    chatThread: {
      overflowY: "auto",
      padding: isMobile ? 12 : 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      flex: 1,
      minHeight: 60,
    },
    msgUser: {
      alignSelf: "flex-end",
      maxWidth: "85%",
      background: T.accent,
      color: "white",
      borderRadius: "10px 10px 2px 10px",
      padding: "8px 12px",
      fontSize: isMobile ? 13 : 14,
      lineHeight: 1.5,
    },
    msgAssistant: {
      alignSelf: "flex-start",
      maxWidth: "88%",
      background: T.chatBot,
      color: T.text,
      borderRadius: "10px 10px 10px 2px",
      padding: "8px 12px",
      fontSize: isMobile ? 13 : 14,
      lineHeight: 1.55,
    },
    msgImage: {
      maxWidth: "100%",
      maxHeight: isMobile ? 120 : 100,
      borderRadius: 6,
      border: `1px solid ${T.border}`,
      marginBottom: 6,
      display: "block",
    },
    msgLoading: {
      alignSelf: "flex-start",
      display: "flex",
      alignItems: "center",
      gap: 7,
      fontSize: isMobile ? 13 : 14,
      color: T.muted,
      background: T.chatBot,
      borderRadius: "10px 10px 10px 2px",
      padding: "8px 12px",
    },
    msgError: {
      alignSelf: "flex-start",
      background: theme === "dark" ? "rgba(233,69,96,0.15)" : "#FFF0F0",
      color: T.accent,
      borderRadius: "10px 10px 10px 2px",
      padding: "7px 11px",
      fontSize: 12.5,
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    retryBtn: {
      fontSize: 11,
      fontWeight: 600,
      color: T.accent,
      background: "none",
      border: `1px solid ${T.accent}`,
      borderRadius: 4,
      padding: "2px 8px",
      cursor: "pointer",
      alignSelf: "flex-start",
    },
    chipsRow: {
      display: "flex",
      gap: 6,
      padding: isMobile ? "8px 12px" : "8px 14px",
      flexWrap: "wrap",
      flexShrink: 0,
    },
    chip: {
      fontSize: isMobile ? 12 : 12.5,
      fontWeight: 500,
      color: T.text,
      background: T.chipBg,
      border: `1px solid ${T.border}`,
      borderRadius: "999px",
      padding: isMobile ? "5px 12px" : "4px 11px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    chatInputRow: {
      display: "flex",
      gap: 6,
      padding: isMobile ? "8px 12px 12px" : "8px 14px 10px",
      borderTop: `1px solid ${T.border}`,
      flexShrink: 0,
    },
    chatTextarea: {
      flex: 1,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: isMobile ? "8px 10px" : "6px 8px",
      fontSize: isMobile ? 14 : 13,
      color: T.text,
      background: T.inputBg,
      outline: "none",
      resize: "none",
      minHeight: 36,
      maxHeight: 60,
      fontFamily: "inherit",
    },
    chatSendBtn: {
      background: T.accent,
      color: "white",
      border: "none",
      borderRadius: 8,
      padding: isMobile ? "8px 16px" : "6px 14px",
      fontSize: isMobile ? 14 : 13,
      fontWeight: 600,
      cursor: chatInput.trim() && !chatLoading ? "pointer" : "default",
      opacity: chatInput.trim() && !chatLoading ? 1 : 0.35,
      flexShrink: 0,
    },
    saveCardBtn: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: T.chipBg,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "6px 12px",
      fontSize: 12.5,
      fontWeight: 600,
      color: flashcardSaved ? T.accent : T.text,
      cursor: flashcardSaved ? "default" : "pointer",
      flexShrink: 0,
    },
    // Color picker popup
    colorPicker: {
      position: "fixed",
      top: "auto",
      left: isMobile ? 8 : "auto",
      right: isMobile ? 8 : "auto",
      display: "flex",
      gap: 6,
      padding: "10px 12px",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      boxShadow: `0 6px 18px ${T.shadow}`,
      zIndex: 200,
      flexWrap: "wrap",
      maxWidth: "calc(100vw - 16px)",
    },
    colorDot: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      border: "2px solid transparent",
      cursor: "pointer",
      flexShrink: 0,
    },
    // Bookmark panel
    bookmarkPanel: {
      position: isMobile ? "fixed" : "absolute",
      top: isMobile ? 96 : 44,
      right: isMobile ? 8 : 0,
      width: isMobile ? 200 : 220,
      maxHeight: "300px",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      boxShadow: `0 6px 18px ${T.shadow}`,
      zIndex: 200,
      overflowY: "auto",
      padding: "8px",
    },
    bookmarkItem: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 8px",
      borderRadius: 6,
      border: "none",
      background: "none",
      cursor: "pointer",
      color: T.text,
      fontSize: 13,
      width: "100%",
      textAlign: "left",
    },
    // Overflow menu (mobile)
    overflowMenu: {
      position: "fixed",
      top: "auto",
      right: 8,
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      boxShadow: `0 6px 18px ${T.shadow}`,
      zIndex: 200,
      padding: "4px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      minWidth: 170,
      maxHeight: "80vh",
      overflowY: "auto",
    },
    overflowItem: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 6,
      border: "none",
      background: "none",
      cursor: "pointer",
      color: T.text,
      fontSize: 13,
      width: "100%",
      textAlign: "left",
    },
    // Progress bar
    progressBar: {
      height: 3,
      background: T.border,
      flexShrink: 0,
      position: "relative",
    },
    progressFill: {
      height: "100%",
      background: T.accent,
      transition: "width 0.2s ease",
      borderRadius: "0 2px 2px 0",
    },
    // Resume toast
    resumeToast: {
      position: "absolute",
      top: 12,
      left: "50%",
      transform: "translateX(-50%)",
      maxWidth: "calc(100vw - 32px)",
      whiteSpace: "nowrap",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 20,
      padding: "4px 14px",
      fontSize: 12,
      color: T.text,
      boxShadow: `0 4px 14px ${T.shadow}`,
      zIndex: 25,
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    resumeBtn: {
      background: T.accent,
      color: "white",
      border: "none",
      borderRadius: 12,
      padding: "2px 10px",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
    },
  };

  const filteredThumbs = thumbs.filter((t) => {
    if (pageFilter === "all") return true;
    if (pageFilter === "bookmarked") return bookmarks.includes(t.page);
    if (pageFilter === "highlighted") return annotations[t.page]?.length > 0;
    return true;
  });

  const showChips = chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === "assistant" && !chatLoading;
  const lastIsAssistant = chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === "assistant";
  const lastAssistantMsg = [...chatMessages].reverse().find((m) => m.role === "assistant");

  const saveAsFlashcard = () => {
    if (!lastAssistantMsg) return;
    const front = `Page ${currentPage} — ${title || "PDF notes"}`;
    const back = lastAssistantMsg.content.slice(0, 500);
    const card = { front, back, subject: title || "PDF Notes" };
    try {
      const existing = JSON.parse(localStorage.getItem("customFlashcards") || "[]");
      localStorage.setItem("customFlashcards", JSON.stringify([...existing, card]));
      setFlashcardSaved(true);
      setTimeout(() => setFlashcardSaved(false), 2500);
    } catch (e) {}
  };

  return (
    <div style={s.container}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideExitLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-60px); opacity: 0; } }
        @keyframes slideExitRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(60px); opacity: 0; } }
        @keyframes slideEnterRight { from { transform: translateX(60px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideEnterLeft { from { transform: translateX(-60px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeExit { from { opacity: 1; } to { opacity: 0; } }
        @keyframes fadeEnter { from { opacity: 0; } to { opacity: 1; } }
        .page-anim-exit-next { animation: slideExitLeft 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-exit-prev { animation: slideExitRight 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-enter-next { animation: slideEnterRight 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-enter-prev { animation: slideEnterLeft 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-fade-exit { animation: fadeExit 0.15s ease forwards; }
        .page-anim-fade-enter { animation: fadeEnter 0.2s ease forwards; }
      `}</style>

      {/* Toolbar */}
      <div style={s.toolbar}>
        {isMobile ? (
          <>
            {/* Mobile Row 1: title + tools + overflow */}
            <div style={s.toolbarRow}>
              {onBack && (
                <button style={{ ...s.iconBtn, color: T.muted, flexShrink: 0, marginRight: 2 }} onClick={onBack} title="Back">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
              )}
              <span style={s.docTitle}>{title || "PDF"}</span>
              <div style={s.sep} />
              {/* Highlight */}
              <div style={{ position: "relative" }}>
                <button
                  style={{ ...s.iconBtn, color: tool === "highlight" ? T.accent : T.muted, background: tool === "highlight" ? T.hover : "none" }}
                  onClick={() => { toggleTool("highlight"); setShowColorPicker((v) => !v); }}
                  title="Highlight"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18h6l-3 3z" fill="currentColor"/><path d="M9.5 14.5l5-5m-7 7l7-7L17 12l-7 7-2.5-2.5z"/></svg>
                </button>
                {showColorPicker && tool === "highlight" && (
                  <div style={s.colorPicker}>
                    {PEN_COLORS.map((c) => (
                      <button
                        key={c.name}
                        style={{ ...s.colorDot, background: c.value.replace("0.35", "0.7"), borderColor: penColor === c.value ? T.accent : "transparent" }}
                        onClick={() => setPenColor(c.value)}
                        title={c.name}
                      />
                    ))}
                    <div style={{ width: 1, height: 20, background: T.border }} />
                    <button style={{ ...s.iconBtn, width: 28, height: 28, color: T.muted }} onClick={clearPageAnnotations} title="Clear">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                )}
              </div>
              {/* Eraser */}
              <button
                style={{ ...s.iconBtn, color: tool === "erase" ? T.accent : T.muted, background: tool === "erase" ? T.hover : "none" }}
                onClick={() => toggleTool("erase")} title="Eraser"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16a2 2 0 0 1 0-2.8L13.2 3a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L11 20"/></svg>
              </button>
              {/* Circle AI */}
              <button
                style={{ ...s.iconBtn, color: tool === "circle" ? T.accent : T.muted, background: tool === "circle" ? T.hover : "none" }}
                onClick={() => toggleTool("circle")} title="Circle to Ask AI"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" strokeDasharray="3.2 3.2"/></svg>
              </button>
              <div style={s.sep} />
              {/* Overflow */}
              <div style={{ position: "relative" }}>
                <button
                  style={{ ...s.iconBtn, color: showOverflow ? T.accent : T.muted }}
                  onClick={() => setShowOverflow((v) => !v)} title="More"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                </button>
                {showOverflow && (
                  <div style={s.overflowMenu}>
                    <button style={s.overflowItem} onClick={() => { toggleBookmark(); setShowOverflow(false); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarks.includes(currentPage) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                      {bookmarks.includes(currentPage) ? "Bookmarked" : "Bookmark"}
                    </button>
                    {bookmarks.length > 0 && (
                      <button style={s.overflowItem} onClick={() => { setShowBookmarks((v) => !v); setShowOverflow(false); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                        Bookmarks ({bookmarks.length})
                      </button>
                    )}
                    <button style={s.overflowItem} onClick={() => { toggleTTS(); setShowOverflow(false); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                      {speaking ? "Stop reading" : "Read aloud"}
                    </button>
                    <button style={s.overflowItem} onClick={() => { setTheme((t) => t === "light" ? "dark" : "light"); setShowOverflow(false); }}>
                      {theme === "light" ? "🌙" : "☀️"} {theme === "light" ? "Dark mode" : "Light mode"}
                    </button>
                    <button style={s.overflowItem} onClick={() => { setShowThumbs((v) => !v); setShowOverflow(false); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="9" rx="1"/></svg>
                      Pages
                    </button>
                    <button style={s.overflowItem} onClick={() => { setShowSearch((v) => !v); setShowOverflow(false); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                      Search
                    </button>
                    <button style={s.overflowItem} onClick={() => { setFullscreen((v) => !v); setShowOverflow(false); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></svg>
                      Fullscreen
                    </button>
                    <div style={{ ...s.overflowItem, cursor: "default", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ fontSize: 11, color: T.muted }}>View mode</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...s.scrollModeBtn, background: scrollMode === "single" ? T.accent : "none", color: scrollMode === "single" ? "white" : T.muted, borderColor: scrollMode === "single" ? T.accent : T.border }} onClick={() => { setScrollMode("single"); setShowOverflow(false); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="18" rx="1"/></svg>
                        </button>
                        <button style={{ ...s.scrollModeBtn, background: scrollMode === "vertical" ? T.accent : "none", color: scrollMode === "vertical" ? "white" : T.muted, borderColor: scrollMode === "vertical" ? T.accent : T.border }} onClick={() => { setScrollMode("vertical"); setShowOverflow(false); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="7" rx="1"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M12 11v2"/></svg>
                        </button>
                        <button style={{ ...s.scrollModeBtn, background: scrollMode === "horizontal" ? T.accent : "none", color: scrollMode === "horizontal" ? "white" : T.muted, borderColor: scrollMode === "horizontal" ? T.accent : T.border }} onClick={() => { setScrollMode("horizontal"); setShowOverflow(false); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="7" height="12" rx="1"/><rect x="14" y="6" width="7" height="12" rx="1"/><path d="M11 12h2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Mobile Row 2: page nav + zoom */}
            <div style={{ ...s.toolbarRow, borderTop: `1px solid ${T.border}`, paddingTop: 4, paddingBottom: 4 }}>
              <button style={{ ...s.iconBtn, opacity: currentPage === 1 ? 0.35 : 1 }} onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span style={s.pageIndicator}>{numPages ? `${currentPage} / ${numPages}` : "–"}</span>
              <input
                style={s.pageInput} type="number" min="1" max={numPages} value={currentPage}
                onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) goToPage(v); }}
              />
              <button style={{ ...s.iconBtn, opacity: currentPage === numPages ? 0.35 : 1 }} onClick={() => goToPage(currentPage + 1)} disabled={currentPage === numPages}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
              </button>
              <div style={s.sep} />
              <button style={s.iconBtn} onClick={handleZoomOut}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M8 11h6"/></svg>
              </button>
              <span style={s.zoomLabel}>{Math.round(scale * 100)}%</span>
              <button style={s.iconBtn} onClick={handleZoomIn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M11 8v6M8 11h6"/></svg>
              </button>
            </div>
          </>
        ) : (
          /* Desktop: single row */
          <div style={s.toolbarRow}>
            {onBack && (
              <button style={{ ...s.iconBtn, color: T.muted, flexShrink: 0 }} onClick={onBack} title="Back">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
            )}
        <span style={s.docTitle}>{title || "PDF"}</span>

        {/* Highlighter tool */}
        <div style={{ position: "relative" }}>
          <button
            style={{ ...s.iconBtn, color: tool === "highlight" ? T.accent : T.muted, background: tool === "highlight" ? T.hover : "none" }}
            onClick={() => { toggleTool("highlight"); setShowColorPicker((v) => !v); }}
            title="Highlight"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4M9 11l3 3"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/><path d="M3 18h6l-3 3z" fill="currentColor"/></svg>
          </button>
          {showColorPicker && tool === "highlight" && (
            <div style={s.colorPicker}>
              {PEN_COLORS.map((c) => (
                <button
                  key={c.name}
                  style={{ ...s.colorDot, background: c.value.replace("0.35", "0.7"), borderColor: penColor === c.value ? T.accent : "transparent" }}
                  onClick={() => setPenColor(c.value)}
                  title={c.name}
                />
              ))}
              <div style={{ width: 1, height: 20, background: T.border }} />
              <button
                style={{ ...s.iconBtn, width: 28, height: 28, color: T.muted }}
                onClick={clearPageAnnotations}
                title="Clear page highlights"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Eraser tool */}
        <button
          style={{ ...s.iconBtn, color: tool === "erase" ? T.accent : T.muted, background: tool === "erase" ? T.hover : "none" }}
          onClick={() => toggleTool("erase")}
          title="Eraser"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16a2 2 0 0 1 0-2.8L13.2 3a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L11 20"/><path d="M18 13L8 3"/></svg>
        </button>

        {/* Circle-to-Ask tool */}
        <button
          style={{ ...s.iconBtn, color: tool === "circle" ? T.accent : T.muted, background: tool === "circle" ? T.hover : "none" }}
          onClick={() => toggleTool("circle")}
          title="Circle to Ask AI"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" strokeDasharray="3.2 3.2"/></svg>
        </button>

        <div style={s.sep} />

        {/* Page nav */}
        <button style={{ ...s.iconBtn, opacity: currentPage === 1 ? 0.35 : 1 }} onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} title="Previous page">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style={s.pageIndicator}>{numPages ? `${currentPage} / ${numPages}` : "– / –"}</span>
        <input
          style={s.pageInput}
          type="number"
          min="1"
          max={numPages}
          value={currentPage}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) goToPage(v);
          }}
        />
        <button style={{ ...s.iconBtn, opacity: currentPage === numPages ? 0.35 : 1 }} onClick={() => goToPage(currentPage + 1)} disabled={currentPage === numPages} title="Next page">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <div style={s.sep} />

        {/* Zoom */}
        <button style={s.iconBtn} onClick={handleZoomOut} title="Zoom out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M8 11h6"/></svg>
        </button>
        <span style={s.zoomLabel}>{Math.round(scale * 100)}%</span>
        <button style={s.iconBtn} onClick={handleZoomIn} title="Zoom in">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M11 8v6M8 11h6"/></svg>
        </button>

        <div style={s.sep} />

        {/* Scroll mode toggle */}
        <div style={s.scrollModeToggle}>
          <button
            style={{ ...s.scrollModeBtn, background: scrollMode === "single" ? T.accent : "none", color: scrollMode === "single" ? "white" : T.muted, borderColor: scrollMode === "single" ? T.accent : T.border }}
            onClick={() => setScrollMode("single")}
            title="Single page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="18" rx="1"/></svg>
          </button>
          <button
            style={{ ...s.scrollModeBtn, background: scrollMode === "vertical" ? T.accent : "none", color: scrollMode === "vertical" ? "white" : T.muted, borderColor: scrollMode === "vertical" ? T.accent : T.border }}
            onClick={() => setScrollMode("vertical")}
            title="Vertical scroll"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="7" rx="1"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M12 11v2"/></svg>
          </button>
          <button
            style={{ ...s.scrollModeBtn, background: scrollMode === "horizontal" ? T.accent : "none", color: scrollMode === "horizontal" ? "white" : T.muted, borderColor: scrollMode === "horizontal" ? T.accent : T.border }}
            onClick={() => setScrollMode("horizontal")}
            title="Horizontal scroll"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="7" height="12" rx="1"/><rect x="14" y="6" width="7" height="12" rx="1"/><path d="M11 12h2"/></svg>
          </button>
        </div>

        <div style={s.spacer} />

        {/* Secondary actions */}
            {/* Bookmark */}
            <div style={{ position: "relative" }}>
              <button
                style={{ ...s.iconBtn, color: bookmarks.includes(currentPage) ? T.accent : T.muted }}
                onClick={() => { toggleBookmark(); setShowBookmarks((v) => !v); }}
                title="Bookmark page"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarks.includes(currentPage) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </button>
              {showBookmarks && bookmarks.length > 0 && (
                <div style={s.bookmarkPanel}>
                  <div style={{ fontSize: 11, color: T.muted, padding: "4px 8px", marginBottom: 4 }}>Bookmarks</div>
                  {bookmarks.map((pg) => (
                    <button key={pg} style={s.bookmarkItem} onClick={() => { goToPage(pg); setShowBookmarks(false); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                      Page {pg}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TTS */}
            <button
              style={{ ...s.iconBtn, color: speaking ? T.accent : T.muted }}
              onClick={toggleTTS}
              title={speaking ? "Stop reading" : "Read aloud"}
            >
              {speaking ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              )}
            </button>

            {/* Theme toggle */}
            <button
              style={s.iconBtn}
              onClick={() => setTheme((t) => t === "light" ? "dark" : "light")}
              title={theme === "light" ? "Dark mode" : "Light mode"}
            >
              {theme === "light" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              )}
            </button>

            {/* Thumbnails */}
            <button
              style={{ ...s.iconBtn, color: showThumbs ? T.accent : T.muted, background: showThumbs ? T.hover : "none" }}
              onClick={() => setShowThumbs((v) => !v)}
              title="Pages"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="9" rx="1"/></svg>
            </button>

            {/* Search */}
            <div style={s.searchWrap}>
              <button
                style={{ ...s.iconBtn, color: showSearch ? T.accent : T.muted, background: showSearch ? T.hover : "none" }}
                onClick={() => setShowSearch((v) => !v)}
                title="Search in document"
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              </button>
              <div style={s.searchPanel}>
                <div style={s.searchRow}>
                  <input
                    style={s.searchInput}
                    type="text"
                    placeholder="Search this document…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runSearch(searchQuery); }}
                  />
                  <span style={s.searchCount}>{searchResults.length ? `${searchResults.length} ${searchResults.length > 1 ? "matches" : "match"}` : ""}</span>
                </div>
                <div style={s.searchResults}>
                  {searching && <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>Searching…</div>}
                  {!searching && searchResults.length === 0 && searchQuery.trim() && (
                    <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>No matches found.</div>
                  )}
                  {searchResults.map((r, i) => (
                    <div key={i} style={s.searchItem} onClick={() => { goToPage(r.page); setShowSearch(false); }}>
                      <span style={s.searchPage}>p.{r.page}</span>
                      <span style={s.searchSnip}>
                        {r.before}<mark style={{ background: T.hover, color: T.accent, fontWeight: 600, borderRadius: "2px" }}>{r.match}</mark>{r.after}
                      </span>
                      <button style={s.askBtn} onClick={(e) => { e.stopPropagation(); askAboutSearchResult(r); }}>
                        Ask about this →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fullscreen */}
            <button
              style={{ ...s.iconBtn, color: fullscreen ? T.accent : T.muted }}
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            >
              {fullscreen ? (
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v4a1 1 0 0 1-1 1H3M21 8h-4a1 1 0 0 1-1-1V3M3 16h4a1 1 0 0 1 1 1v4M16 21v-4a1 1 0 0 1 1-1h4"/></svg>
              ) : (
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></svg>
              )}
            </button>
        </div>
      )}
    </div>

      {/* Progress bar */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: numPages ? `${(currentPage / numPages) * 100}%` : "0%" }} />
      </div>

      {/* Mobile search panel (rendered outside toolbar when mobile) */}
      {isMobile && showSearch && (
        <div style={{ position: "absolute", top: 100, left: 8, right: 8, ...s.searchPanel, display: "flex", width: "auto" }}>
          <div style={s.searchRow}>
            <input
              style={s.searchInput}
              type="text"
              placeholder="Search this document…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(searchQuery); }}
            />
            <span style={s.searchCount}>{searchResults.length ? `${searchResults.length}` : ""}</span>
          </div>
          <div style={s.searchResults}>
            {searching && <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>Searching…</div>}
            {!searching && searchResults.length === 0 && searchQuery.trim() && (
              <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>No matches found.</div>
            )}
            {searchResults.map((r, i) => (
              <div key={i} style={s.searchItem} onClick={() => { goToPage(r.page); setShowSearch(false); }}>
                <span style={s.searchPage}>p.{r.page}</span>
                <span style={s.searchSnip}>
                  {r.before}<mark style={{ background: T.hover, color: T.accent, fontWeight: 600 }}>{r.match}</mark>{r.after}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile bookmarks panel */}
      {isMobile && showBookmarks && bookmarks.length > 0 && (
        <div style={{ position: "absolute", top: 100, right: 8, ...s.bookmarkPanel, width: 180 }}>
          <div style={{ fontSize: 11, color: T.muted, padding: "4px 8px", marginBottom: 4 }}>Bookmarks</div>
          {bookmarks.map((pg) => (
            <button key={pg} style={s.bookmarkItem} onClick={() => { goToPage(pg); setShowBookmarks(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              Page {pg}
            </button>
          ))}
        </div>
      )}

      {/* Workspace */}
      <div style={s.workspace}>
        {/* Thumbnails (desktop sidebar) */}
        {!isMobile && (
          <aside style={s.thumbsAside}>
            <div style={s.pageFilterRow}>
              {[
                { key: "all", label: "All" },
                { key: "bookmarked", label: "🔖" },
                { key: "highlighted", label: "🖍" },
              ].map((f) => (
                <button
                  key={f.key}
                  style={{
                    ...s.pageFilterTab,
                    background: pageFilter === f.key ? T.accent : "none",
                    color: pageFilter === f.key ? "white" : T.muted,
                    borderColor: pageFilter === f.key ? T.accent : T.border,
                  }}
                  onClick={() => setPageFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div style={s.thumbRail}>
              {filteredThumbs.length === 0 && (
                <div style={{ fontSize: 11, color: T.muted, padding: "12px 4px", textAlign: "center" }}>
                  No {pageFilter === "bookmarked" ? "bookmarked" : "highlighted"} pages
                </div>
              )}
              {filteredThumbs.map((t) => (
                <button
                  key={t.page}
                  style={{
                    ...s.thumb,
                    borderColor: t.page === currentPage ? T.accent : "transparent",
                    background: t.page === currentPage ? T.hover : "none",
                  }}
                  onClick={() => goToPage(t.page)}
                >
                  <img src={t.dataUrl} alt={`Page ${t.page}`} style={{ boxShadow: `0 1px 4px ${T.shadow}`, display: "block" }} />
                  <span style={{ ...s.thumbLabel, color: t.page === currentPage ? T.accent : T.muted }}>{t.page}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Mobile thumbnails drawer */}
        {isMobile && showThumbs && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40,
            display: "flex", justifyContent: "flex-start",
          }} onClick={() => setShowThumbs(false)}>
            <div style={{
              width: 160, height: "100%", background: T.toolbar, overflowY: "auto",
              padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 10,
            }} onClick={(e) => e.stopPropagation()}>
              <div style={s.pageFilterRow}>
                {[
                  { key: "all", label: "All" },
                  { key: "bookmarked", label: "🔖" },
                  { key: "highlighted", label: "🖍" },
                ].map((f) => (
                  <button
                    key={f.key}
                    style={{
                      ...s.pageFilterTab,
                      background: pageFilter === f.key ? T.accent : "none",
                      color: pageFilter === f.key ? "white" : T.muted,
                      borderColor: pageFilter === f.key ? T.accent : T.border,
                    }}
                    onClick={() => setPageFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {filteredThumbs.length === 0 && (
                <div style={{ fontSize: 11, color: T.muted, padding: "12px 4px", textAlign: "center" }}>
                  No {pageFilter === "bookmarked" ? "bookmarked" : "highlighted"} pages
                </div>
              )}
              {filteredThumbs.map((t) => (
                <button
                  key={t.page}
                  style={{
                    ...s.thumb,
                    borderColor: t.page === currentPage ? T.accent : "transparent",
                    background: t.page === currentPage ? T.hover : "none",
                  }}
                  onClick={() => { goToPage(t.page); setShowThumbs(false); }}
                >
                  <img src={t.dataUrl} alt={`Page ${t.page}`} style={{ boxShadow: `0 1px 4px ${T.shadow}`, display: "block" }} />
                  <span style={{ ...s.thumbLabel, color: t.page === currentPage ? T.accent : T.muted }}>{t.page}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Viewer */}
        <main
          ref={viewerRef}
          style={s.viewer}
          onTouchStart={onTouchStartViewer}
          onTouchMove={onTouchMoveViewer}
          onTouchEnd={onTouchEndViewer}
        >
          {/* Resume toast */}
          {resumePage && !loading && (
            <div style={s.resumeToast}>
              <span>📖 Resume p.{resumePage}?</span>
              <button style={s.resumeBtn} onClick={doResume}>Go</button>
              <button style={{ ...s.resumeBtn, background: "transparent", color: T.muted, border: `1px solid ${T.border}` }} onClick={() => setResumePage(null)}>×</button>
            </div>
          )}

          {scrollMode === "single" ? (
            <div
              style={s.pageShadow}
              className={
                transitioning
                  ? transitionDir === "next"
                    ? "page-anim-exit-next"
                    : "page-anim-exit-prev"
                  : !transitioning && currentPage
                    ? transitionDir === "next"
                      ? "page-anim-enter-next"
                      : "page-anim-enter-prev"
                    : ""
              }
            >
              <canvas
                ref={canvasRef}
                style={{
                  display: "block",
                  filter: theme === "dark" ? "invert(1) hue-rotate(180deg)" : "none",
                }}
              />
              <svg
                ref={lassoSvgRef}
                style={{ ...s.lassoOverlay, filter: theme === "dark" ? "invert(1) hue-rotate(180deg)" : "none" }}
                onPointerDown={onOverlayDown}
                onPointerMove={onOverlayMove}
                onPointerUp={onOverlayUp}
              >
                {/* Saved annotations */}
                {savedAnnotationPaths.map((sp) => (
                  <path
                    key={`a${sp.si}`}
                    d={sp.d}
                    stroke={sp.color}
                    strokeWidth={sp.width}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ mixBlendMode: "multiply" }}
                  />
                ))}
                {/* Current stroke being drawn */}
                {renderStrokes && tool === "highlight" && (
                  <path
                    d={renderStrokes}
                    stroke={penColor}
                    strokeWidth={12}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ mixBlendMode: "multiply" }}
                  />
                )}
                {/* Lasso path for circle-to-ask */}
                {lassoPath && tool === "circle" && <path d={lassoPath} style={s.lassoPath} />}
              </svg>
            </div>
          ) : (
            // Continuous scroll mode — render all pages
            Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
              <div
                key={pg}
                data-page={pg}
                ref={(el) => { pageItemRefs.current[pg - 1] = el; }}
                style={s.continuousPageItem}
              >
                <canvas
                  ref={(el) => { pageCanvasRefs.current[pg - 1] = el; }}
                  style={{
                    display: "block",
                    filter: theme === "dark" ? "invert(1) hue-rotate(180deg)" : "none",
                  }}
                />
                {/* Unified SVG overlay per page — handles annotations + drawing + lasso */}
                {visiblePages.has(pg) && (
                  <svg
                    ref={(el) => { if (pg === currentPage) lassoSvgRef.current = el; }}
                    style={{
                      ...s.lassoOverlay,
                      filter: theme === "dark" ? "invert(1) hue-rotate(180deg)" : "none",
                      pointerEvents: pg === currentPage && tool !== "none" ? "auto" : "none",
                    }}
                    onPointerDown={pg === currentPage ? onOverlayDown : undefined}
                    onPointerMove={pg === currentPage ? onOverlayMove : undefined}
                    onPointerUp={pg === currentPage ? onOverlayUp : undefined}
                  >
                    {/* Saved annotations */}
                    {(annotations[pg] || []).map((stroke, si) => {
                      const d = "M " + stroke.points.map((p) => `${p.x * scale},${p.y * scale}`).join(" L ");
                      return (
                        <path
                          key={`p${pg}a${si}`}
                          d={d}
                          stroke={stroke.color}
                          strokeWidth={stroke.width * scale}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ mixBlendMode: "multiply" }}
                        />
                      );
                    })}
                    {/* Active highlight stroke (current page only) */}
                    {pg === currentPage && renderStrokes && tool === "highlight" && (
                      <path d={renderStrokes} stroke={penColor} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ mixBlendMode: "multiply" }} />
                    )}
                    {/* Lasso path for circle-to-ask (current page only) */}
                    {pg === currentPage && lassoPath && tool === "circle" && (
                      <path d={lassoPath} style={s.lassoPath} />
                    )}
                  </svg>
                )}
                <span style={s.pageLabel}>{pg}</span>
              </div>
            ))
          )}

          {/* Chat popup — mobile bottom sheet / desktop side panel */}
          {chatOpen && (
            <>
              {isMobile && <div style={s.chatBackdrop} onClick={closeChat} />}
              <div style={s.chatPopup}>
                {isMobile && <div style={s.sheetHandle} />}
                <div style={s.chatHead}>
                  <span style={s.chatTag}>
                    {chatMessages.length > 0 ? `Answer · p.${currentPage}` : "Loading…"}
                  </span>
                  <button style={s.chatClose} onClick={closeChat}>✕</button>
                </div>

                <div ref={chatScrollRef} style={s.chatThread}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={msg.role === "user" ? s.msgUser : s.msgAssistant}>
                      {msg.image && (
                        <img src={msg.image} alt="Circled content" style={s.msgImage} />
                      )}
                      {msg.role === "assistant"
                        ? <MarkdownText>{msg.content}</MarkdownText>
                        : msg.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={s.msgLoading}>
                      <span style={s.spinner} /> Analyzing…
                    </div>
                  )}
                  {chatError && (
                    <div style={s.msgError}>
                      {chatError}
                      <button style={s.retryBtn} onClick={retryLastMessage}>Try again</button>
                    </div>
                  )}
                </div>

                {showChips && (
                  <div style={s.chipsRow}>
                    {SMART_CHIPS.map((chip) => (
                      <button key={chip.label} style={s.chip} onClick={() => sendFollowUp(chip.prompt)}>
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={s.chatInputRow}>
                  {lastIsAssistant && (
                    <button style={s.saveCardBtn} onClick={saveAsFlashcard}>
                      {flashcardSaved ? "✓ Saved" : "🔖 Save"}
                    </button>
                  )}
                  <textarea
                    ref={inputRef}
                    style={s.chatTextarea}
                    rows={1}
                    placeholder="Ask a follow-up…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                  />
                  <button
                    style={s.chatSendBtn}
                    onClick={() => sendFollowUp(chatInput)}
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}

          {loading && (
            <div style={s.loadingOverlay}>
              <span style={s.spinner} /> Loading PDF…
            </div>
          )}
          {loadError && (
            <div style={{ ...s.loadingOverlay, color: T.accent }}>{loadError}</div>
          )}
        </main>
      </div>
    </div>
  );
}
