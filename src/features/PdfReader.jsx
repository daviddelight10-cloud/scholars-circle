import { useState, useEffect, useRef, useCallback } from "react";
import { callAIMultimodal } from "../lib/aiClient.js";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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

  // Circle-to-Ask state
  const [circleMode, setCircleMode] = useState(false);
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
  const pageTextRef = useRef(""); // captured page text for current chat session
  const chatScrollRef = useRef(null);
  const inputRef = useRef(null);

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
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (e) {}
    }
    const task = page.render({ canvasContext: ctx, viewport });
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

  // ---- Circle to Ask ----
  const toggleCircleMode = () => {
    setCircleMode((prev) => {
      const next = !prev;
      if (!next) {
        setLassoPath("");
        lassoPoints.current = [];
        closeChat();
      }
      return next;
    });
  };

  const getRelPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onLassoDown = (e) => {
    if (!circleMode) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const p = getRelPoint(e);
    lassoPoints.current = [p];
    setLassoPath(`M ${p.x},${p.y}`);
    closeChat();
  };

  const onLassoMove = (e) => {
    if (!isDrawing) return;
    const p = getRelPoint(e);
    const last = lassoPoints.current[lassoPoints.current.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
    lassoPoints.current.push(p);
    const d = "M " + lassoPoints.current.map((p) => `${p.x},${p.y}`).join(" L ");
    setLassoPath(d);
  };

  const onLassoUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const poly = lassoPoints.current;
    lassoPoints.current = [];
    setLassoPath("");
    if (poly.length < 4) return;
    await analyzeLasso(poly);
  };

  const analyzeLasso = async (poly) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
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
    poly.forEach((p, i) => {
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

    // Position popup near the lasso
    const popupW = 280;
    const left = Math.max(8, Math.min((minX + maxX) / 2 - popupW / 2, canvas.width - popupW - 8));
    const top = Math.min(maxY + 14, canvas.height - 40);
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

  // ---- Styles ----
  const s = {
    container: {
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "#EFEEE8",
      borderRadius: "10px",
      position: "relative",
    },
    toolbar: {
      background: "#fff",
      borderBottom: "1px solid #E2DFD3",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 10px",
      flexWrap: "wrap",
      flexShrink: 0,
    },
    docTitle: {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      fontWeight: 600,
      color: "#3F3A33",
      marginRight: "4px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "38vw",
    },
    iconBtn: {
      width: "30px",
      height: "30px",
      borderRadius: "7px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#80796E",
      border: "none",
      background: "none",
      cursor: "pointer",
      flexShrink: 0,
    },
    sep: { width: "1px", height: "20px", background: "#E2DFD3", margin: "0 4px" },
    pageIndicator: {
      fontFamily: "ui-monospace, monospace",
      fontSize: "12.5px",
      color: "#80796E",
      whiteSpace: "nowrap",
    },
    pageInput: {
      width: "32px",
      textAlign: "center",
      border: "1px solid #E2DFD3",
      borderRadius: "5px",
      padding: "3px 2px",
      fontFamily: "ui-monospace, monospace",
      fontSize: "12.5px",
      background: "#FBFAF6",
      color: "#3F3A33",
    },
    zoomLabel: {
      fontFamily: "ui-monospace, monospace",
      fontSize: "11.5px",
      color: "#80796E",
      minWidth: "38px",
      textAlign: "center",
    },
    spacer: { flex: 1 },
    workspace: { flex: 1, display: "flex", overflow: "hidden", minHeight: 0 },
    thumbsAside: {
      width: showThumbs ? "132px" : "0",
      overflow: "hidden",
      background: "#FBFAF6",
      borderRight: "1px solid #E2DFD3",
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
      fontSize: "10px",
      color: "#80796E",
    },
    viewer: {
      flex: 1,
      overflow: "auto",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "24px 16px 40px",
      position: "relative",
    },
    pageShadow: {
      position: "relative",
      background: "white",
      boxShadow: "0 2px 10px rgba(0,0,0,0.10), 0 14px 34px rgba(0,0,0,0.10)",
      lineHeight: 0,
    },
    loadingOverlay: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#EFEEE8",
      fontSize: "13px",
      color: "#80796E",
      gap: "8px",
    },
    spinner: {
      width: "14px",
      height: "14px",
      border: "2px solid #E2DFD3",
      borderTopColor: "#C23B3B",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    },
    // Search panel
    searchWrap: { position: "relative" },
    searchPanel: {
      position: "absolute",
      top: "38px",
      right: 0,
      width: "280px",
      maxHeight: "320px",
      background: "#fff",
      border: "1px solid #E2DFD3",
      borderRadius: "10px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      display: showSearch ? "flex" : "none",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: 10,
    },
    searchRow: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "8px 10px",
      borderBottom: "1px solid #E4E2D8",
    },
    searchInput: {
      flex: 1,
      border: "none",
      outline: "none",
      fontSize: "13px",
      background: "transparent",
      color: "#3F3A33",
    },
    searchCount: {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10.5px",
      color: "#80796E",
      whiteSpace: "nowrap",
    },
    searchResults: { overflowY: "auto", maxHeight: "270px" },
    searchItem: {
      display: "block",
      width: "100%",
      textAlign: "left",
      padding: "8px 12px",
      borderBottom: "1px solid #E4E2D8",
      background: "none",
      border: "none",
      cursor: "pointer",
    },
    searchPage: {
      display: "inline-block",
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "#C23B3B",
      marginBottom: "2px",
    },
    searchSnip: {
      display: "block",
      fontSize: "12.5px",
      lineHeight: 1.4,
      color: "#80796E",
    },
    askBtn: {
      display: "inline-block",
      marginTop: "4px",
      fontSize: "10.5px",
      fontWeight: 600,
      color: "#C23B3B",
      background: "rgba(194,59,59,0.08)",
      border: "none",
      borderRadius: "4px",
      padding: "2px 8px",
      cursor: "pointer",
    },
    // Lasso overlay
    lassoOverlay: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      pointerEvents: circleMode ? "auto" : "none",
      touchAction: "none",
      cursor: circleMode ? "crosshair" : "default",
    },
    lassoPath: {
      fill: "rgba(194,59,59,0.12)",
      stroke: "#C23B3B",
      strokeWidth: 3,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    // Circle bubble
    circleBubble: {
      position: "absolute",
      bottom: "16px",
      right: "16px",
      width: "48px",
      height: "48px",
      borderRadius: "50%",
      background: circleMode ? "#3F3A33" : "#C23B3B",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 6px 18px rgba(0,0,0,0.24)",
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
      width: "280px",
      background: "#fff",
      border: "1px solid #E2DFD3",
      borderRadius: "10px",
      boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
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
      borderBottom: "1px solid #E4E2D8",
      flexShrink: 0,
    },
    chatTag: {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "#C23B3B",
      fontWeight: 600,
    },
    chatClose: {
      color: "#80796E",
      fontSize: "13px",
      background: "none",
      border: "none",
      cursor: "pointer",
    },
    chatThread: {
      overflowY: "auto",
      padding: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      flex: 1,
      minHeight: "60px",
    },
    msgUser: {
      alignSelf: "flex-end",
      maxWidth: "85%",
      background: "#C23B3B",
      color: "white",
      borderRadius: "10px 10px 2px 10px",
      padding: "7px 11px",
      fontSize: "12.5px",
      lineHeight: 1.45,
      whiteSpace: "pre-wrap",
    },
    msgAssistant: {
      alignSelf: "flex-start",
      maxWidth: "85%",
      background: "#F5F4EF",
      color: "#3F3A33",
      borderRadius: "10px 10px 10px 2px",
      padding: "7px 11px",
      fontSize: "12.5px",
      lineHeight: 1.45,
      whiteSpace: "pre-wrap",
    },
    msgImage: {
      maxWidth: "100%",
      maxHeight: "80px",
      borderRadius: "6px",
      border: "1px solid #E4E2D8",
      marginBottom: "4px",
      display: "block",
    },
    msgLoading: {
      alignSelf: "flex-start",
      display: "flex",
      alignItems: "center",
      gap: "7px",
      fontSize: "12.5px",
      color: "#80796E",
      background: "#F5F4EF",
      borderRadius: "10px 10px 10px 2px",
      padding: "7px 11px",
    },
    msgError: {
      alignSelf: "flex-start",
      background: "#FFF0F0",
      color: "#C23B3B",
      borderRadius: "10px 10px 10px 2px",
      padding: "7px 11px",
      fontSize: "12.5px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
    retryBtn: {
      fontSize: "11px",
      fontWeight: 600,
      color: "#C23B3B",
      background: "none",
      border: "1px solid #C23B3B",
      borderRadius: "4px",
      padding: "2px 8px",
      cursor: "pointer",
      alignSelf: "flex-start",
    },
    chipsRow: {
      display: "flex",
      gap: "5px",
      padding: "6px 10px",
      flexWrap: "wrap",
      flexShrink: 0,
    },
    chip: {
      fontSize: "11px",
      fontWeight: 500,
      color: "#3F3A33",
      background: "#F0EEE8",
      border: "1px solid #E2DFD3",
      borderRadius: "999px",
      padding: "3px 10px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    chatInputRow: {
      display: "flex",
      gap: "6px",
      padding: "8px 10px",
      borderTop: "1px solid #E4E2D8",
      flexShrink: 0,
    },
    chatTextarea: {
      flex: 1,
      border: "1px solid #E2DFD3",
      borderRadius: "8px",
      padding: "6px 8px",
      fontSize: "12.5px",
      color: "#3F3A33",
      background: "#FBFAF6",
      outline: "none",
      resize: "none",
      minHeight: "32px",
      maxHeight: "60px",
      fontFamily: "inherit",
    },
    chatSendBtn: {
      background: "#C23B3B",
      color: "white",
      border: "none",
      borderRadius: "8px",
      padding: "6px 12px",
      fontSize: "12.5px",
      fontWeight: 600,
      cursor: chatInput.trim() && !chatLoading ? "pointer" : "default",
      opacity: chatInput.trim() && !chatLoading ? 1 : 0.35,
      flexShrink: 0,
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

        <button
          style={{ ...s.iconBtn, color: showThumbs ? "#C23B3B" : "#80796E", background: showThumbs ? "rgba(194,59,59,0.10)" : "none" }}
          onClick={() => setShowThumbs((v) => !v)}
          title="Pages"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="9" rx="1"/></svg>
        </button>

        <div style={s.sep} />

        <button style={{ ...s.iconBtn, opacity: currentPage === 1 ? 0.35 : 1 }} onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} title="Previous page">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <div style={s.sep} />

        <button style={s.iconBtn} onClick={handleZoomOut} title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M8 11h6"/></svg>
        </button>
        <span style={s.zoomLabel}>{Math.round(scale * 100)}%</span>
        <button style={s.iconBtn} onClick={handleZoomIn} title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M11 8v6M8 11h6"/></svg>
        </button>

        <div style={s.spacer} />

        <div style={s.searchWrap}>
          <button
            style={{ ...s.iconBtn, color: showSearch ? "#C23B3B" : "#80796E", background: showSearch ? "rgba(194,59,59,0.10)" : "none" }}
            onClick={() => setShowSearch((v) => !v)}
            title="Search in document"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
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
              {searching && <div style={{ padding: "14px 12px", fontSize: "12.5px", color: "#80796E" }}>Searching…</div>}
              {!searching && searchResults.length === 0 && searchQuery.trim() && (
                <div style={{ padding: "14px 12px", fontSize: "12.5px", color: "#80796E" }}>No matches found.</div>
              )}
              {searchResults.map((r, i) => (
                <div key={i} style={s.searchItem} onClick={() => { goToPage(r.page); setShowSearch(false); }}>
                  <span style={s.searchPage}>p.{r.page}</span>
                  <span style={s.searchSnip}>
                    {r.before}<mark style={{ background: "rgba(194,59,59,0.10)", color: "#C23B3B", fontWeight: 600, borderRadius: "2px" }}>{r.match}</mark>{r.after}
                  </span>
                  <button style={s.askBtn} onClick={(e) => { e.stopPropagation(); askAboutSearchResult(r); }}>
                    Ask about this →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div style={s.workspace}>
        {/* Thumbnails */}
        <aside style={s.thumbsAside}>
          <div style={s.thumbRail}>
            {thumbs.map((t) => (
              <button
                key={t.page}
                style={{
                  ...s.thumb,
                  borderColor: t.page === currentPage ? "#C23B3B" : "transparent",
                  background: t.page === currentPage ? "rgba(194,59,59,0.10)" : "none",
                }}
                onClick={() => goToPage(t.page)}
              >
                <img src={t.dataUrl} alt={`Page ${t.page}`} style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.18)", display: "block" }} />
                <span style={{ ...s.thumbLabel, color: t.page === currentPage ? "#C23B3B" : "#80796E" }}>{t.page}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Viewer */}
        <main ref={viewerRef} style={s.viewer}>
          <div style={s.pageShadow}>
            <canvas ref={canvasRef} style={{ display: "block" }} />
            <svg
              ref={lassoSvgRef}
              style={s.lassoOverlay}
              onPointerDown={onLassoDown}
              onPointerMove={onLassoMove}
              onPointerUp={onLassoUp}
            >
              {lassoPath && <path d={lassoPath} style={s.lassoPath} />}
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
                      {msg.content}
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
            <div style={{ ...s.loadingOverlay, color: "#C23B3B" }}>{loadError}</div>
          )}
        </main>
      </div>

      {/* Circle-to-Ask bubble */}
      <button style={s.circleBubble} onClick={toggleCircleMode} title="Circle something to ask">
        {circleMode ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="7" strokeDasharray="3.2 3.2"/></svg>
        )}
      </button>
    </div>
  );
}
