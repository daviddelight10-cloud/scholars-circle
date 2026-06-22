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

const SUGGESTED_CHIPS = [
  "Why does this matter?",
  "Give an example",
  "Is this likely on the exam?",
];

export default function PdfReader({ fileUrl, title }) {
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
  const [fullscreen, setFullscreen] = useState(false);

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
  const pinchRef = useRef(null);
  const lastTapRef = useRef(0);

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
        await fitToWidth();
        await renderPage(1);
        setLoading(false);
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
    if (!pdfDocRef.current) return;
    const page = await pdfDocRef.current.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const container = viewerRef.current;
    if (!container) return;
    const available = container.clientWidth - 40;
    const fit = available / base.width;
    setScale(Math.max(0.5, Math.min(2.2, fit)));
  }, []);

  const renderPage = useCallback(async (n) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    const page = await pdfDocRef.current.getPage(n);
    const viewport = page.getViewport({ scale });
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

  // Re-render on scale change
  useEffect(() => {
    if (pdfDocRef.current && !loading) {
      renderPage(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  // Re-fit width when fullscreen toggles
  useEffect(() => {
    if (!pdfDocRef.current) return;
    setUserZoomed(false);
    fitToWidth();
  }, [fullscreen]);

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

  const goToPage = useCallback(async (n) => {
    if (!pdfDocRef.current) return;
    n = Math.max(1, Math.min(pdfDocRef.current.numPages, n));
    if (n === currentPage) return;
    setCurrentPage(n);
    closeChat();
    await renderPage(n);
  }, [currentPage, renderPage]);

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
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const analyzeLasso = async (poly) => {
    const canvas = canvasRef.current;
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
    const firstPrompt = `A student circled something on page ${currentPage} of their study notes (a PDF). ${pageText ? `Full text of that page, for context:\n"""${pageText}"""\n\n` : ""}A cropped image of exactly what they circled is attached. Identify what's being asked or shown there specifically, and explain it like a clear, encouraging tutor. Keep it under 90 words.`;

    setChatMessages([{ role: "user", content: firstPrompt, image: thumb }]);
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
    const promptWithContext = `${trimmed}\n\n[Context: You are a tutor helping a student with their study notes. The student previously circled something on page ${currentPage} and you explained it. Continue the conversation naturally. Page text for reference:\n"""${pageTextRef.current || "(no text extracted)"}"""\nKeep your answer under 120 words.]`;

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
    const promptWithContext = `${lastUserMsg.content}\n\n[Context: You are a tutor helping a student with their study notes. Continue the conversation naturally. Page text for reference:\n"""${pageTextRef.current || "(no text extracted)"}"""\nKeep your answer under 120 words.]`;
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

  // ---- Pinch-to-zoom ----
  const onTouchStartViewer = (e) => {
    if (tool !== "none") return;
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      pinchRef.current = {
        dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        scale: scale,
      };
    } else if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      // Double-tap detection
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap: toggle zoom
        setUserZoomed(true);
        setScale((s) => s > 1.5 ? Math.max(0.5, s / 1.8) : Math.min(2.6, s * 1.8));
      }
      lastTapRef.current = now;
    }
  };

  const onTouchMoveViewer = (e) => {
    if (tool !== "none") return;
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / pinchRef.current.dist;
      const newScale = Math.max(0.5, Math.min(3, pinchRef.current.scale * ratio));
      setScale(newScale);
      setUserZoomed(true);
    }
  };

  const onTouchEndViewer = (e) => {
    if (tool !== "none") return;
    if (e.touches.length < 2) pinchRef.current = null;
    // Swipe nav (only if not pinching)
    if (e.changedTouches.length === 1 && !pinchRef.current) {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
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
      }),
    },
    toolbar: {
      background: T.toolbar,
      borderBottom: `1px solid ${T.border}`,
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: isMobile ? "8px 8px" : "10px 14px",
      flexWrap: "wrap",
      flexShrink: 0,
    },
    docTitle: {
      fontFamily: "Georgia, serif",
      fontSize: isMobile ? 12 : 15,
      fontWeight: 600,
      color: T.text,
      marginRight: "4px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: isMobile ? "24vw" : "38vw",
    },
    iconBtn: {
      width: "40px",
      height: "40px",
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
    sep: { width: "1px", height: "24px", background: T.border, margin: "0 2px" },
    pageIndicator: {
      fontFamily: "ui-monospace, monospace",
      fontSize: isMobile ? 12 : 14,
      color: T.muted,
      whiteSpace: "nowrap",
    },
    pageInput: {
      width: "40px",
      textAlign: "center",
      border: `1px solid ${T.border}`,
      borderRadius: "5px",
      padding: "4px 2px",
      fontFamily: "ui-monospace, monospace",
      fontSize: 14,
      background: T.inputBg,
      color: T.text,
    },
    zoomLabel: {
      fontFamily: "ui-monospace, monospace",
      fontSize: 13,
      color: T.muted,
      minWidth: "44px",
      textAlign: "center",
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
      padding: "10px 8px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
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
    viewer: {
      flex: 1,
      overflow: "auto",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: isMobile ? "8px 4px 40px" : "24px 16px 40px",
      position: "relative",
    },
    pageShadow: {
      position: "relative",
      background: theme === "dark" ? "#2a2a3e" : "white",
      boxShadow: `0 2px 10px ${T.shadow}, 0 14px 34px ${T.shadow}`,
      lineHeight: 0,
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
      position: "absolute",
      top: "38px",
      right: 0,
      width: isMobile ? "240px" : "280px",
      maxHeight: "320px",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: "10px",
      boxShadow: `0 10px 30px ${T.shadow}`,
      display: showSearch ? "flex" : "none",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: 10,
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
    // Chat popup
    chatPopup: {
      position: "absolute",
      left: chatPosition.left,
      top: chatPosition.top,
      width: isMobile ? "calc(100vw - 16px)" : "280px",
      maxWidth: "320px",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: "10px",
      boxShadow: `0 10px 28px ${T.shadow}`,
      zIndex: 20,
      display: "flex",
      flexDirection: "column",
      maxHeight: "420px",
    },
    chatHead: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    },
    chatTag: {
      fontFamily: "ui-monospace, monospace",
      fontSize: 10,
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
      padding: 10,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      flex: 1,
      minHeight: 60,
    },
    msgUser: {
      alignSelf: "flex-end",
      maxWidth: "85%",
      background: T.accent,
      color: "white",
      borderRadius: "10px 10px 2px 10px",
      padding: "7px 11px",
      fontSize: 12.5,
      lineHeight: 1.45,
    },
    msgAssistant: {
      alignSelf: "flex-start",
      maxWidth: "85%",
      background: T.chatBot,
      color: T.text,
      borderRadius: "10px 10px 10px 2px",
      padding: "7px 11px",
      fontSize: 12.5,
      lineHeight: 1.45,
    },
    msgImage: {
      maxWidth: "100%",
      maxHeight: 80,
      borderRadius: 6,
      border: `1px solid ${T.border}`,
      marginBottom: 4,
      display: "block",
    },
    msgLoading: {
      alignSelf: "flex-start",
      display: "flex",
      alignItems: "center",
      gap: 7,
      fontSize: 12.5,
      color: T.muted,
      background: T.chatBot,
      borderRadius: "10px 10px 10px 2px",
      padding: "7px 11px",
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
      gap: 5,
      padding: "6px 10px",
      flexWrap: "wrap",
      flexShrink: 0,
    },
    chip: {
      fontSize: 11,
      fontWeight: 500,
      color: T.text,
      background: T.chipBg,
      border: `1px solid ${T.border}`,
      borderRadius: "999px",
      padding: "3px 10px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    chatInputRow: {
      display: "flex",
      gap: 6,
      padding: "8px 10px",
      borderTop: `1px solid ${T.border}`,
      flexShrink: 0,
    },
    chatTextarea: {
      flex: 1,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "6px 8px",
      fontSize: 12.5,
      color: T.text,
      background: T.inputBg,
      outline: "none",
      resize: "none",
      minHeight: 32,
      maxHeight: 60,
      fontFamily: "inherit",
    },
    chatSendBtn: {
      background: T.accent,
      color: "white",
      border: "none",
      borderRadius: 8,
      padding: "6px 12px",
      fontSize: 12.5,
      fontWeight: 600,
      cursor: chatInput.trim() && !chatLoading ? "pointer" : "default",
      opacity: chatInput.trim() && !chatLoading ? 1 : 0.35,
      flexShrink: 0,
    },
    // Color picker popup
    colorPicker: {
      position: "absolute",
      top: 42,
      left: 0,
      display: "flex",
      gap: 6,
      padding: "8px 10px",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      boxShadow: `0 6px 18px ${T.shadow}`,
      zIndex: 15,
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
      position: "absolute",
      top: 42,
      right: 0,
      width: isMobile ? "200px" : "220px",
      maxHeight: "300px",
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      boxShadow: `0 6px 18px ${T.shadow}`,
      zIndex: 15,
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
      position: "absolute",
      top: 42,
      right: 0,
      background: T.toolbar,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      boxShadow: `0 6px 18px ${T.shadow}`,
      zIndex: 15,
      padding: "4px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      minWidth: 160,
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
      top: 8,
      left: "50%",
      transform: "translateX(-50%)",
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

  const showChips = chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === "assistant" && !chatLoading;
  const lastIsAssistant = chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === "assistant";

  return (
    <div style={s.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toolbar */}
      <div style={s.toolbar}>
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

        <div style={s.spacer} />

        {/* Desktop: show all secondary actions. Mobile: overflow menu */}
        {!isMobile ? (
          <>
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
          </>
        ) : (
          /* Mobile: overflow menu */
          <div style={{ position: "relative" }}>
            <button
              style={{ ...s.iconBtn, color: showOverflow ? T.accent : T.muted }}
              onClick={() => setShowOverflow((v) => !v)}
              title="More"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            {showOverflow && (
              <div style={s.overflowMenu}>
                <button style={s.overflowItem} onClick={() => { toggleBookmark(); }}>
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
                  {theme === "light" ? "🌙" : "☀️"}
                  {theme === "light" ? "Dark mode" : "Light mode"}
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
              </div>
            )}
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
            <div style={s.thumbRail}>
              {thumbs.map((t) => (
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
              padding: "10px 8px", display: "flex", flexDirection: "column", gap: 10,
            }} onClick={(e) => e.stopPropagation()}>
              {thumbs.map((t) => (
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

          <div style={s.pageShadow}>
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

            {/* Chat popup */}
            {chatOpen && (
              <div style={s.chatPopup}>
                <div style={s.chatHead}>
                  <span style={s.chatTag}>{chatMessages.length > 0 ? "Tutor Chat" : "Loading…"}</span>
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
                      <span style={s.spinner} /> One sec…
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
                    {SUGGESTED_CHIPS.map((chip) => (
                      <button key={chip} style={s.chip} onClick={() => sendFollowUp(chip)}>
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                <div style={s.chatInputRow}>
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
            )}
          </div>

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
