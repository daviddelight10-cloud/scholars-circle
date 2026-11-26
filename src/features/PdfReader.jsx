import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUI } from "../contexts/UIContext.jsx";
import { callAIMultimodalStream } from "../lib/aiClient.js";
import MarkdownText from "../components/MarkdownText.jsx";
import McqCard from "../components/McqCard.jsx";
import { parseMcqSegments } from "../lib/mcqBlocks.js";
import { useVoiceSession } from "../features/voice-tutor/useVoiceSession.js";
import VoiceOrb from "../features/voice-tutor/VoiceOrb.jsx";
import TranscriptOverlay from "../features/voice-tutor/TranscriptOverlay.jsx";
import { VOICE_STATES, COLORS } from "../features/voice-tutor/voiceConfig.js";
import {
  recordPracticeResult, recordPracticeSession,
} from "../lib/studyHistory.js";
import { rateQuestion } from "./streak-survival/fsrsBridge.js";
import { questEvent } from "./streak-survival/survivalStore.js";
import { API_BASE } from "../lib/constants";
import { fetchWithAuth, getValidToken } from "../lib/authToken.js";
import { getResolvedTheme } from "../lib/theme.js";
import { docKeyFromUrl } from "../lib/researchUtils.js";
import pdfjsLib, { loadPdfJs } from "../lib/pdfjs.js";

// ── Split modules (styles, palettes, prompts, persistence) ──────────────────
import { THEMES, CHROME, INK_COLORS, HIGHLIGHT_COLORS, PEN_WIDTHS, HIGHLIGHT_WIDTHS } from "./pdf-reader/constants.js";
import { SMART_CHIPS, STARTER_CHIPS, QUIZ_NEXT_CHIPS, GROUNDING_STOPWORDS, TUTOR_SYSTEM } from "./pdf-reader/chatPrompts.js";
import {
  loadStored, saveStored, mergePageArrays, mergeBookmarkList, mergeReaderStats,
  getProxiedUrl, fetchProxiedPdf, idbGetFile, idbPutFile, idbDelFile,
} from "./pdf-reader/storage.js";
import { buildStyles } from "./pdf-reader/styles.js";
import { usePageText } from "./pdf-reader/usePageText.js";
import { buildSearchResults } from "./pdf-reader/textSearch.js";
import { buildNotesMarkdown, downloadTextFile } from "./pdf-reader/notesExport.js";
import { NoteEditorModal, NotesPanel, ShortcutsModal, StatsModal } from "./pdf-reader/panels.jsx";
import { useOverlayBackClose } from "../hooks/useOverlayBackClose.js";
import PdfDeckTab, { usePdfDeck } from "./pdf-reader/PdfDeckTab.jsx";
import { usePageTutor } from "./pdf-reader/page-tutor/usePageTutor.js";
import LessonPanel from "./pdf-reader/page-tutor/LessonPanel.jsx";
import LectureBar from "./pdf-reader/page-tutor/LectureBar.jsx";
import ChapterReview from "./pdf-reader/page-tutor/ChapterReview.jsx";
import Celebration from "./pdf-reader/page-tutor/Celebration.jsx";
import { checkRankJump } from "../lib/rankWatch.js";
import { buildLessonContext } from "./pdf-reader/page-tutor/lessonUtils.js";
import { logEvent as tutorLogEvent } from "./pdf-reader/page-tutor/pageTutorApi.js";
import { smoothPath, taperedOutline, dotPath, arrowHeadPath, eraseSplit } from "./pdf-reader/ink.js";


const RING_C = 2 * Math.PI * 6.4;
const ProgressRing = ({ pct }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
    <defs>
      <linearGradient id="scPdfRingG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F5A623" /><stop offset="1" stopColor="#E8963C" />
      </linearGradient>
    </defs>
    <circle cx="8" cy="8" r="6.4" fill="none" stroke="rgba(128,128,140,0.3)" strokeWidth="2" />
    <circle cx="8" cy="8" r="6.4" fill="none" stroke="url(#scPdfRingG)" strokeWidth="2" strokeLinecap="round"
      strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - pct / 100)} transform="rotate(-90 8 8)" />
  </svg>
);

// Scholar's identity orb — gold gradient sphere; pulses while the AI is working.
const AiOrb = ({ size = 18, pulsing = false, style }) => (
  <div
    aria-hidden="true"
    style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "radial-gradient(circle at 32% 28%, #FFE1A6, #F5A623 52%, #B06F0A)",
      boxShadow: "0 0 10px rgba(245,166,35,0.45), inset 0 1px 2px rgba(255,255,255,0.5)",
      animation: pulsing ? "sc-orb-pulse 1.4s ease-in-out infinite" : "none",
      ...style,
    }}
  />
);

// Waiting-for-first-token state — typing dots + rotating status verbs.
const THINK_VERBS = ["Reading the page", "Connecting ideas", "Drafting answer", "Checking details"];
const ThinkingBubble = ({ s }) => {
  const [vi, setVi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setVi((v) => (v + 1) % THINK_VERBS.length), 1700);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={s.msgLoading}>
      <span style={s.typingDots} className="sc-typing"><i /><i /><i /></span>
      {THINK_VERBS[vi]}…
    </div>
  );
};

// Empty-chat welcome cards — replace the starter chips in the thread body.
const WELCOME_CARDS = [
  { icon: "📖", label: "Explain this page", prompt: STARTER_CHIPS[0].prompt },
  { icon: "🧠", label: "Quiz me", prompt: STARTER_CHIPS[2].prompt },
  { icon: "📝", label: "Key points", prompt: STARTER_CHIPS[1].prompt },
  { icon: "✨", label: "Make a mnemonic", prompt: STARTER_CHIPS[3].prompt },
];

export default function PdfReader({ fileUrl, title, initialFullscreen = false, onBack, resourceId: propResourceId, initialPage }) {
  const docKey = docKeyFromUrl(fileUrl || "unknown");

  // Device/browser back exits the reader instead of leaving the app.
  useOverlayBackClose(onBack, { open: !!onBack });

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [userZoomed, setUserZoomed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showThumbs, setShowThumbs] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [focusPinned, setFocusPinned] = useState(false);
  const focusPinRef = useRef(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [scannedPagesLikely, setScannedPagesLikely] = useState(false); // doc may need OCR
  const [ocrScanning, setOcrScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fullscreen, setFullscreen] = useState(initialFullscreen);
  const { setMobileNavHidden } = useUI();

  // Theme — "auto" (default) follows the app theme; light/dark/sepia are
  // explicit overrides. "dim" was removed: brightness-only darkening left
  // black text black on a dimmed page — unreadable.
  const [themePref, setThemePref] = useState(() => {
    const t = loadStored("sc_pdf_theme", "auto");
    return THEMES[t] ? t : "auto"; // "dim"/unknown/legacy → auto
  });
  const [appTheme, setAppTheme] = useState(getResolvedTheme);
  useEffect(() => {
    const on = (e) => setAppTheme(e.detail.resolved);
    window.addEventListener("sc:theme-change", on);
    return () => window.removeEventListener("sc:theme-change", on);
  }, []);
  const theme = themePref === "auto" ? appTheme : themePref;
  const [readerBrightness, setReaderBrightness] = useState(() => loadStored("sc_pdf_bright", 1.1));
  const T = THEMES[theme];

  // Page-canvas filter: theme base + user brightness multiplier.
  // "dark" inverts the raster — black text becomes light on a dark page.
  const pageCssFilter = () => {
    const base = theme === "dark" ? "invert(1) hue-rotate(180deg)"
      : theme === "sepia" ? "sepia(0.6) brightness(0.95) contrast(0.92)"
      : "";
    const b = readerBrightness !== 1 ? ` brightness(${readerBrightness.toFixed(2)})` : "";
    return (base + b) || "none";
  };

  // Tool mode: "none" | "highlight" | "erase" | "circle" | "pen" | "line" | "arrow"
  const [tool, setTool] = useState("none");
  const [askNudge, setAskNudge] = useState(false); // intro "circle" — hint at the Ask AI tool instead of auto-arming it
  const [penColor, setPenColor] = useState(INK_COLORS[0].value);


  // Annotate popover state (mobile)
  const [annotatePopOpen, setAnnotatePopOpen] = useState(false);
  const [annotateTab, setAnnotateTab] = useState("none"); // "none" | armed tool name
  const [penWidth, setPenWidth] = useState(2.5);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [highlightWidth, setHighlightWidth] = useState(16);
  const [overflowBackdropOpen, setOverflowBackdropOpen] = useState(false);
  const [stylusOnly, setStylusOnly] = useState(() => loadStored("sc_pdf_stylusonly", false));

  // Annotations: { [pageNum]: [{ id, color, width, points: [{x,y,p?,v?}], type }] }  (points in PDF coords)
  const [annotations, setAnnotations] = useState(() => loadStored(`sc_pdf_annots_${docKey}`, {}));
  const currentStrokes = useRef([]); // strokes being drawn in screen coords
  const [renderStrokes, setRenderStrokes] = useState(""); // SVG path string for current marker stroke
  const [penPreview, setPenPreview] = useState(""); // filled-outline path for the live pen stroke
  const [shapePreview, setShapePreview] = useState(null); // {type:"line"|"arrow", a, b}
  const [eraseDot, setEraseDot] = useState(null); // {x,y} eraser cursor while dragging
  const shapeRef = useRef(null); // [start, current] for line/arrow
  const eraseTrail = useRef([]); // screen-coord erase points for the active gesture
  const undoStackRef = useRef([]); // {kind:"stroke",page,ref} | {kind:"mark",page,id}
  const [undoCount, setUndoCount] = useState(0);
  const [definePop, setDefinePop] = useState(null); // {x,y,above,word,loading,data}
  const [cardEdit, setCardEdit] = useState(null); // {front,back,page} flashcard mini-sheet

  // Bookmarks — named entries { page, name }; legacy number[] data is
  // upgraded on load so nothing is lost.
  const [bookmarks, setBookmarks] = useState(() =>
    (loadStored(`sc_pdf_bookmarks_${docKey}`, []) || [])
      .map((b) => (typeof b === "number" ? { page: b, name: "" } : b))
      .filter((b) => b && b.page > 0)
  );
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [renamingPage, setRenamingPage] = useState(null); // page # being named

  // Kindle-style "back to where you were" — every non-sequential jump pushes
  // the page you left onto the stack; Back pops it.
  const navStackRef = useRef([]);
  const [navStackLen, setNavStackLen] = useState(0);

  // PDF outline / table of contents (from getOutline)
  const [outline, setOutline] = useState(null);
  const [showOutline, setShowOutline] = useState(false);

  // Search match navigation — active match index + per-page text index with
  // span offsets so matches can be painted on the page itself.
  const [searchIdx, setSearchIdx] = useState(-1);
  const activeMatchRef = useRef(null); // {page, i0, i1} span index range
  const [pageJumpOpen, setPageJumpOpen] = useState(false); // mobile page-chip jump

  // ── Text-anchored marks (real highlights + margin notes) ──
  // { [page]: [{ id, color, rects:[[x0,y0,x1,y1] 0–1 vs page box], text, note, createdAt }] }
  const [textMarks, setTextMarks] = useState(() => loadStored(`sc_pdf_marks_${docKey}`, {}));
  const [selPop, setSelPop] = useState(null); // { x, y, above }
  const pendingSelRef = useRef(null); // { page, text, rects } — survives popover taps
  // On touch devices we collapse the DOM selection after capture (hides the OS
  // Copy/Share menu that would stack on our popover). That collapse fires a
  // selectionchange — this flag keeps our popover alive through it.
  const suppressSelClearRef = useRef(false);
  const [markMenu, setMarkMenu] = useState(null); // { mark, x, y }
  const [noteEdit, setNoteEdit] = useState(null); // { page, id }
  const [flashMark, setFlashMark] = useState(null); // mark id pulsing after a jump
  const [showNotes, setShowNotes] = useState(false);
  const [deckToast, setDeckToast] = useState(null);
  const [deckAddedKeys, setDeckAddedKeys] = useState({}); // "msgIdx:segIdx" → true
  const [deckHintSeen, setDeckHintSeen] = useState(() => loadStored("sc_pdf_deck_hint", false));

  // ── Shared (community) annotations — highlights + page comments visible to
  // everyone reading this document. Requires sign-in; local marks stay private.
  const [sharedAnnots, setSharedAnnots] = useState([]);
  const [showShared, setShowShared] = useState(() => loadStored(`sc_pdf_showshared_${docKey}`, true));
  const [sharedMenu, setSharedMenu] = useState(null); // { annot, x, y }
  const [commentsFor, setCommentsFor] = useState(null); // page number | null
  const [commentDraft, setCommentDraft] = useState("");
  const [shareBusy, setShareBusy] = useState(false);

  // TTS
  const [speaking, setSpeaking] = useState(false);
  const ttsUtterRef = useRef(null);

  // Mobile / overflow menu
  const [isMobile, setIsMobile] = useState(false);
  // Chat docks beside the document from 900px up (tablet landscape, laptop);
  // 640–899px (portrait tablets) get a floating card, <640px the bottom sheet.
  const [dockW, setDockW] = useState(0); // 0 = not dockable
  const dockMode = dockW > 0;
  const [showOverflow, setShowOverflow] = useState(false);
  const [sheetDrag, setSheetDrag] = useState(0);
  const menuDragRef = useRef(null);

  // Circle-to-Ask state (now part of tool modes)
  const circleMode = tool === "circle";
  const [isDrawing, setIsDrawing] = useState(false);
  const lassoPoints = useRef([]);
  const [lassoPath, setLassoPath] = useState("");
  // Page the current draw gesture started on — lets circle/pen/erase work on
  // any visible page in continuous scroll, not just currentPage
  const [drawPage, setDrawPage] = useState(null);
  const drawPageRef = useRef(null);

  // Chat popup state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState(null);
  const [chatExpanded, setChatExpanded] = useState(false); // mobile sheet tall mode
  const [copiedIdx, setCopiedIdx] = useState(null); // assistant msg index just copied
  const [confirmNewChat, setConfirmNewChat] = useState(false); // two-tap clear confirm
  const [showJumpLatest, setShowJumpLatest] = useState(false); // scrolled-up pill
  const chatAbortRef = useRef(null); // in-flight stream AbortController
  const chatNearBottomRef = useRef(true); // auto-scroll only while pinned
  const sheetDragRef = useRef(null); // mobile sheet swipe-to-dismiss/expand

  // Refs
  const pdfDocRef = useRef(null);
  const { getPageText, getPageIndexData, ocrDocument, ocrStatus, pageIndexRef } = usePageText(pdfDocRef, docKey);
  const canvasRef = useRef(null);
  const canvas2Ref = useRef(null); // two-page spread: right-hand page
  const renderTaskRef = useRef(null);
  const viewerRef = useRef(null);
  const lassoSvgRef = useRef(null);
  const pageTextRef = useRef("");
  const chatScrollRef = useRef(null);
  const inputRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const drawingGestureRef = useRef(false); // a lasso/pen stroke owned this touch — touchend must not swipe/zoom
  const pageDimsRef = useRef({}); // { pageNum: { width, height } } for virtualization placeholders
  const dimsMeasuringRef = useRef(new Set()); // pages with an in-flight dims measurement
  const renderTasksRef = useRef({}); // { pageNum: renderTask } for per-canvas cancellation
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const pinchMidRef = useRef({ x: 0, y: 0 });
  const pinchActiveRef = useRef(false);
  const pinchLayoutOriginRef = useRef({ x: 0, y: 0 }); // wrapper's untransformed origin on screen
  const pinchContentRef = useRef({ x: 0, y: 0 }); // content point pinned under the fingers
  const zoomAnchorPageRef = useRef(0); // page under the zoom focal point — re-rendered first
  const cssScaleRef = useRef(1); // live CSS scale during pinch (no re-render)
  const lastTapRef = useRef(0);
  // Gallery-style pan-zoom state
  const [panZoom, setPanZoom] = useState({ scale: 1, x: 0, y: 0 });
  const panZoomRef = useRef({ scale: 1, x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });
  const pinchStartPanZoomRef = useRef({ scale: 1, x: 0, y: 0 });
  const panZoomContentRef = useRef(null); // ref to the zoomable content wrapper
  const thumbObserverRef = useRef(null);
  const thumbRenderedRef = useRef(new Set());
  const debounceScaleRef = useRef(null);
  const textLayerRefs = useRef({}); // { pageNum: textLayerContainer }
  const zoomBadgeRef = useRef(null); // live % text — written imperatively during pinch
  const liveHandlersRef = useRef({}); // always-fresh handlers for non-passive listeners
  const fitScaleRef = useRef(0); // last computed fit-to-width scale
  const [, setDimsVersion] = useState(0); // bumped when background page-dims measurement completes
  const gestureDrivenRef = useRef(false); // true when gesture* events drive the zoom (desktop Safari)

  // Page sorter filter
  const [pageFilter, setPageFilter] = useState("all");

  // Save-flashcard confirmation — per assistant message
  const [savedFlashIdx, setSavedFlashIdx] = useState(null);
  // { "msgIdx:segIdx": { picked: originalOptionIdx, correct: bool } }
  const [quizResults, setQuizResults] = useState({});

  // ── AI Study Tools state (voice tutor + chat only) ─────────────────────────
  const [studyToolsOpen, setStudyToolsOpen] = useState(false);
  const [studyTab, setStudyTab] = useState("tools"); // "tools" | "deck"
  const [studyView, setStudyView] = useState("tools"); // "tools" | "lesson" — lesson = Page Tutor
  const studyDeck = usePdfDeck(propResourceId, studyToolsOpen);
  const studyResourceId = propResourceId || docKey;

  // FSRS review pulls — due items for this doc drive the review card's
  // urgency copy, weakness-aware sampling, and the FAB badge. Refreshes when
  // any rating lands (sc-fsrs-rated fires from rateQuestion).
  const [dueItems, setDueItems] = useState([]);
  useEffect(() => {
    if (!propResourceId) { setDueItems([]); return; }
    let dead = false;
    const load = () => {
      fetchWithAuth(`${API_BASE}/api/resources/fsrs/due?resources=${encodeURIComponent(propResourceId)}&limit=100`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!dead && d) setDueItems(Array.isArray(d.items) ? d.items : []); })
        .catch(() => {});
    };
    load();
    window.addEventListener("sc-fsrs-rated", load);
    return () => { dead = true; window.removeEventListener("sc-fsrs-rated", load); };
  }, [propResourceId]);
  const duePages = useMemo(
    () => new Set(dueItems.map((i) => (i.pageIndex ?? -1) + 1).filter((p) => p > 0)),
    [dueItems]
  );
  const dueCount = dueItems.length;
  const [lastReview, setLastReview] = useState(() => loadStored(`sc_review_last_${docKey}`, null));
  const pageTutor = usePageTutor({
    resourceId: propResourceId,
    onLessonDone: (xpAwarded) => {
      const L = lectureRef.current;
      if (L) lecturePlayRef.current?.(L, L.pos + 1);
      if (xpAwarded > 0) {
        window.dispatchEvent(new CustomEvent("sc-xp-gained", { detail: { xp: xpAwarded } }));
        questEvent?.("xpToday", xpAwarded);
      }
      checkRankCelebration();
    },
    onPlayFailed: () => { if (lectureRef.current) setLectureBlocked(true); },
  });

  const [aiUsage, setAiUsage] = useState(null);
  const pageEnterTimeRef = useRef(Date.now());
  // ── Voice Tutor state ──────────────────────────────────────────────────────
  const voice = useVoiceSession({ onGoToPage: (p) => goToPage(p) });
  const [voiceName] = useState("Achird");
  const [voiceLevel] = useState(() => {
    try { return localStorage.getItem("sc-voice-level") || "standard"; } catch { return "standard"; }
  });
  const [voiceMinimized, setVoiceMinimized] = useState(false);
  const [rankCelebration, setRankCelebration] = useState(null); // {from,to,passed,tier}
  const closeCelebration = useCallback(() => setRankCelebration(null), []);
  const checkRankCelebration = useCallback(() => {
    checkRankJump().then((j) => { if (j) setRankCelebration(j); }).catch(() => {});
  }, []);
  const [voiceTextInput, setVoiceTextInput] = useState("");
  const voiceActive = voice.state !== VOICE_STATES.IDLE && voice.state !== VOICE_STATES.ENDED && voice.state !== VOICE_STATES.ERROR;
  const vtStateColor = {
    [VOICE_STATES.LISTENING]: COLORS.electric,
    [VOICE_STATES.SPEAKING]: "#A78BFA",
    [VOICE_STATES.THINKING]: COLORS.gold,
    [VOICE_STATES.READY]: COLORS.green,
  }[voice.state] || COLORS.textDim;
  const vtStateLabel = {
    [VOICE_STATES.CONNECTING]: "Connecting…",
    [VOICE_STATES.READY]: "Ready — tap mic to speak",
    [VOICE_STATES.LISTENING]: "Listening…",
    [VOICE_STATES.SPEAKING]: "Speaking…",
    [VOICE_STATES.THINKING]: "Thinking…",
  }[voice.state] || "";
  const vtTimer = `${Math.floor(voice.elapsedSec / 60)}:${String(voice.elapsedSec % 60).padStart(2, "0")}`;

  // Scroll mode: "single" | "vertical" | "horizontal"
  const [scrollMode, setScrollMode] = useState(() => loadStored(`sc_pdf_scrollmode_${docKey}`, "vertical"));
  const [transitioning, setTransitioning] = useState(false);
  const [transitionDir, setTransitionDir] = useState("next");
  const pageItemRefs = useRef([]);
  const pageCanvasRefs = useRef([]);
  const observerRef = useRef(null);
  const pageVrRef = useRef(new Map());
  const [visiblePages, setVisiblePages] = useState(new Set([1]));
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomIndicatorTimerRef = useRef(null);
  const [pinchActive, setPinchActive] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // Virtual window: visible pages + buffer for pre-rendering
  const RENDER_BUFFER = 2;
  const virtualPages = useMemo(() => {
    const vp = new Set();
    visiblePages.forEach((pg) => {
      for (let i = Math.max(1, pg - RENDER_BUFFER); i <= Math.min(numPages, pg + RENDER_BUFFER); i++) {
        vp.add(i);
      }
    });
    return vp;
  }, [visiblePages, numPages]);

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
        let pdf;
        try {
          // Streamed/ranged load — pdf.js range-requests chunks through the
          // proxy so page 1 paints before the whole file downloads.
          const token = await getValidToken();
          const loadingTask = pdfjs.getDocument({
            url: getProxiedUrl(fileUrl),
            httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            rangeChunkSize: 262144, // 256KB chunks — fewer round-trips per page
          });
          pdf = await loadingTask.promise;
        } catch (streamErr) {
          // Fallback: whole-file fetch, then the IndexedDB offline copy.
          let pdfData;
          try {
            pdfData = await fetchProxiedPdf(fileUrl);
            pdfBytesRef.current = pdfData;
          } catch (netErr) {
            const blob = await idbGetFile(docKey);
            if (!blob) throw streamErr;
            pdfData = new Uint8Array(await blob.arrayBuffer());
            setDeckToast({ type: "ok", text: "📴 Opened offline copy" });
            setTimeout(() => setDeckToast(null), 3000);
            setOfflineInfo({ size: pdfData.byteLength });
          }
          if (cancelled) return;
          pdf = await pdfjs.getDocument({ data: pdfData }).promise;
        }
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        // Table of contents from the document outline — destinations resolve
        // to page numbers; entries without a dest are kept as dividers.
        (async () => {
          try {
            const ol = await pdf.getOutline();
            if (!ol?.length || cancelled) return;
            const flat = [];
            const walk = async (items, depth) => {
              for (const it of items) {
                let page = null;
                try {
                  let dest = it.dest;
                  if (typeof dest === "string") dest = await pdf.getDestination(dest);
                  if (Array.isArray(dest) && dest[0]) page = (await pdf.getPageIndex(dest[0])) + 1;
                } catch {}
                flat.push({ title: String(it.title || "Untitled").trim(), page, depth });
                if (it.items?.length) await walk(it.items, depth + 1);
              }
            };
            await walk(ol, 0);
            if (!cancelled) setOutline(flat);
          } catch {}
        })();
        // Persist page count so community PDF cards can show reading progress
        try { saveStored(`sc_pdf_meta_${docKey}`, { numPages: pdf.numPages }); } catch {}
        const startPage = initialPage ? Math.max(1, Math.min(initialPage, pdf.numPages)) : 1;
        // Book mode: land on the spread's left page so pairs stay (1,2),(3,4)…
        const start = scrollMode === "book" ? startPage - ((startPage - 1) % 2) : startPage;
        setCurrentPage(start);
        // Store first page dimensions for virtualization placeholders
        try {
          const p1 = await pdf.getPage(1);
          const vp1 = p1.getViewport({ scale: 1 });
          pageDimsRef.current[1] = { width: vp1.width, height: vp1.height };
        } catch (e) {}
        // Measure every page's base dimensions in the background — without this,
        // placeholders and zoom commits fall back to page 1's aspect, which
        // visibly stretches mixed-size documents in continuous scroll modes.
        (async () => {
          for (let n = 1; n <= pdf.numPages; n++) {
            if (cancelled || pageDimsRef.current[n]) continue;
            try {
              const p = await pdf.getPage(n);
              const vp = p.getViewport({ scale: 1 });
              pageDimsRef.current[n] = { width: vp.width, height: vp.height };
            } catch {}
          }
          if (!cancelled) setDimsVersion((v) => v + 1); // one repaint to correct placeholder sizes
        })();
        // Defer fitToWidth so fullscreen layout is painted before measuring container width
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (cancelled) return;
        const fittedScale = await fitToWidth();
        if (scrollMode === "book") {
          await renderSpread(start, fittedScale);
        } else {
          await renderPage(startPage, fittedScale);
        }
        setLoading(false);
        // Re-fit after loading spinner unmounts (container dimensions may shift)
        setTimeout(async () => {
          if (!cancelled) {
            const s = await fitToWidth();
            if (scrollMode === "book") {
              await renderSpread(start, s);
            } else {
              await renderPage(startPage, s);
            }
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

  // Auto-scroll chat to bottom on new messages — but only while the user is
  // already pinned to the bottom, so scrolling up to re-read isn't hijacked.
  useEffect(() => {
    scrollChatBottom();
    const el = chatScrollRef.current;
    if (el) setShowJumpLatest(el.scrollHeight - el.scrollTop - el.clientHeight > 80 && chatMessages.length > 2);
  }, [chatMessages, chatLoading]);

  const fitToWidth = useCallback(async () => {
    if (!pdfDocRef.current) return null;
    const page = await pdfDocRef.current.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const container = viewerRef.current;
    if (!container) return null;
    const isMob = window.innerWidth < 640;
    const readingMax = base.width > base.height ? 1100 : 900;
    // Book mode: two pages share the row — each gets half the container
    const available = scrollMode === "book"
      ? Math.max(200, (container.clientWidth - 48) / 2)
      : isMob
        ? container.clientWidth - 8
        : Math.min(container.clientWidth - 40, readingMax);
    // Continuous modes show many pages at once — fit to the median measured
    // page width so mixed-size documents don't leave most pages oversized.
    let fitBasis = base.width;
    if (scrollMode !== "single") {
      const widths = Object.values(pageDimsRef.current)
        .map((d) => d.width)
        .filter(Boolean)
        .sort((a, b) => a - b);
      if (widths.length > 1) fitBasis = widths[Math.floor(widths.length / 2)];
    }
    const fit = Math.max(0.5, Math.min(2.2, available / fitBasis));
    fitScaleRef.current = fit;
    setScale(fit);
    return fit;
  }, [scrollMode]);

  const renderPage = useCallback(async (n, scaleOverride) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    const page = await pdfDocRef.current.getPage(n);
    const useScale = scaleOverride ?? scale;
    const viewport = page.getViewport({ scale: useScale });
    if (!pageDimsRef.current[n]) {
      const baseVp = page.getViewport({ scale: 1 });
      pageDimsRef.current[n] = { width: baseVp.width, height: baseVp.height };
    }
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.floor(viewport.width * dpr);
    const h = Math.floor(viewport.height * dpr);
    // Render to a detached canvas so the old bitmap stays visible until the new
    // pixels are ready — prevents the blank flash during zoom re-renders.
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (e) {}
    }
    const task = page.render({ canvasContext: off.getContext("2d"), viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err) {
      if (!err || err.name !== "RenderingCancelledException") console.error(err);
      return; // cancelled/failed — keep the old bitmap on screen
    } finally {
      if (renderTaskRef.current === task) delete renderTaskRef.current;
    }
    // Atomic swap: resize + blit in one synchronous step
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(off, 0, 0);
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    canvas.dataset.renderedScale = useScale;
  }, [scale]);

  // Re-render on scale change (single + book modes)
  useEffect(() => {
    if (scrollMode === "single" || scrollMode === "book") {
      if (scrollMode === "book") {
        const c = canvasRef.current;
        const rs = c ? parseFloat(c.dataset.renderedScale || "0") : 0;
        if (pdfDocRef.current && !loading && (!rs || Math.abs(rs - scale) / scale > 0.35)) {
          renderSpread(currentPage);
        }
        return;
      }
      const c = canvasRef.current;
      const rs = c ? parseFloat(c.dataset.renderedScale || "0") : 0;
      // Zoom hysteresis: skip the re-render while the existing bitmap still has
      // resolution headroom (small zooms stay sharp via the DPR margin)
      if (pdfDocRef.current && !loading && (!rs || Math.abs(rs - scale) / scale > 0.35)) {
        renderPage(currentPage);
      }
      return;
    }
    // In continuous mode, debounce re-render to prevent thrashing
    if (!pdfDocRef.current || loading) return;
    if (debounceScaleRef.current) clearTimeout(debounceScaleRef.current);
    debounceScaleRef.current = setTimeout(() => {
      pageCanvasRefs.current.forEach((c) => {
        if (!c) return;
        const rs = parseFloat(c.dataset.renderedScale || "0");
        // Zoom hysteresis: only re-render pages whose bitmap diverges enough to
        // look soft — small zooms keep the existing bitmap (DPR headroom)
        if (!rs || Math.abs(rs - scale) / scale > 0.35) delete c.dataset.rendered;
      });
      // Bound the re-render window to the zoom anchor page — visiblePages only
      // accumulates, so without this every visited page re-renders on zoom.
      // The IntersectionObserver repopulates the window immediately after.
      setVisiblePages(new Set([zoomAnchorPageRef.current || currentPage]));
    }, 150);
    return () => {
      if (debounceScaleRef.current) clearTimeout(debounceScaleRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  // Render visible pages in continuous scroll mode
  useEffect(() => {
    if (scrollMode === "single" || scrollMode === "book" || !pdfDocRef.current || loading) return;
    virtualPages.forEach((pg) => {
      const canvas = pageCanvasRefs.current[pg - 1];
      if (canvas && !canvas.dataset.rendered) {
        canvas.dataset.rendered = "true";
        renderPageToCanvas(pg, canvas);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualPages, scrollMode, loading, scale]);

  // Watchdog: a page in the render window that never produced a bitmap (stuck
  // flag, dropped task) gets re-triggered instead of staying blank forever.
  useEffect(() => {
    if (scrollMode === "single" || scrollMode === "book" || loading) return;
    const id = setInterval(() => {
      if (!pdfDocRef.current) return;
      virtualPages.forEach((pg) => {
        const c = pageCanvasRefs.current[pg - 1];
        if (!c || c.dataset.renderedScale) return;
        if (c.dataset.rendered && !c.dataset.stuck) { c.dataset.stuck = "1"; return; }
        delete c.dataset.stuck;
        c.dataset.rendered = "true";
        renderPageToCanvas(pg, c);
      });
    }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualPages, scrollMode, loading, scale]);

  // Re-fit width when fullscreen toggles
  useEffect(() => {
    if (!pdfDocRef.current) return;
    setUserZoomed(false);
    fitToWidth().then((s) => { if (s) renderCurrent(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // Auto-refit on container resize (handles layout shifts, safe-area changes, orientation)
  useEffect(() => {
    if (!viewerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (pdfDocRef.current && !userZoomed && !loading) {
        fitToWidth().then((s) => {
          if (s && (scrollMode === "single" || scrollMode === "book")) renderCurrent(s);
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

  const renderPageToCanvas = useCallback(async (n, canvasEl, scaleOverride) => {
    if (!pdfDocRef.current || !canvasEl) return;
    const fail = (err, retry = true) => {
      if (err && err.name !== "RenderingCancelledException") console.error("PDF page render failed:", n, err);
      delete canvasEl.dataset.rendered; // let the machinery retry later
      if (retry && (!err || err.name !== "RenderingCancelledException")) {
        const tries = Number(canvasEl.dataset.tries || 0) + 1;
        canvasEl.dataset.tries = tries;
        if (tries <= 3) {
          setTimeout(() => {
            if (canvasEl.isConnected && !canvasEl.dataset.rendered) {
              canvasEl.dataset.rendered = "true";
              renderPageToCanvas(n, canvasEl, scaleOverride);
            }
          }, 400 * tries);
        }
      }
    };
    try {
      const page = await pdfDocRef.current.getPage(n);
      const useScale = scaleOverride ?? scale;
      const viewport = page.getViewport({ scale: useScale });
      // Cap the bitmap area — mobile browsers refuse (or silently blank) large canvases
      const maxPixels = isMobile ? 3_000_000 : 16_000_000;
      let dpr = Math.min(window.devicePixelRatio || 1, 3);
      const area = viewport.width * viewport.height;
      if (area * dpr * dpr > maxPixels) dpr = Math.max(1, Math.sqrt(maxPixels / area));
      const w = Math.floor(viewport.width * dpr);
      const h = Math.floor(viewport.height * dpr);
      // Store base dimensions (at scale 1) for virtualization placeholders
      if (!pageDimsRef.current[n]) {
        const baseVp = page.getViewport({ scale: 1 });
        pageDimsRef.current[n] = { width: baseVp.width, height: baseVp.height };
      }
      // Render to a detached canvas so the old bitmap stays on screen until the
      // new pixels are ready — no blank flash during zoom re-renders.
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const offCtx = off.getContext("2d");
      if (!offCtx) throw new Error("Canvas unavailable");
      // Cancel any previous render task for this page
      if (renderTasksRef.current[n]) {
        try { renderTasksRef.current[n].cancel(); } catch (e) {}
      }
      const task = page.render({ canvasContext: offCtx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      renderTasksRef.current[n] = task;
      try {
        await task.promise;
      } finally {
        if (renderTasksRef.current[n] === task) delete renderTasksRef.current[n];
      }
      if (!canvasEl.isConnected) { delete canvasEl.dataset.rendered; return; }
      // Atomic swap: resize + blit in one synchronous step
      canvasEl.width = w;
      canvasEl.height = h;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(off, 0, 0);
      off.width = off.height = 0; // release the detached bitmap immediately
      canvasEl.style.width = viewport.width + "px";
      canvasEl.style.height = viewport.height + "px";
      canvasEl.dataset.renderedScale = useScale;
      canvasEl.dataset.tries = 0;
      // Render text layer for selection/copy
      renderTextLayer(n, page, viewport, canvasEl);
    } catch (err) {
      fail(err);
    }
  }, [scale, isMobile]);

  // Book (two-page spread): render the left page into canvasRef and its
  // facing page into canvas2Ref. Reuses renderPageToCanvas incl. text layers.
  const renderSpread = useCallback(async (left, scaleOverride) => {
    if (!pdfDocRef.current) return;
    await renderPageToCanvas(left, canvasRef.current, scaleOverride);
    const right = left + 1;
    if (right <= pdfDocRef.current.numPages && canvas2Ref.current) {
      await renderPageToCanvas(right, canvas2Ref.current, scaleOverride);
    }
  }, [renderPageToCanvas]);

  // Render "the current view" after a fit/refit — single page or the spread.
  const renderCurrent = useCallback((fitScale) => {
    if (scrollMode === "book") return renderSpread(currentPage, fitScale);
    return renderPage(currentPage, fitScale);
  }, [scrollMode, currentPage, renderSpread, renderPage]);

  // Render a transparent text layer overlay for text selection + copy
  const renderTextLayer = async (pageNum, page, viewport, canvasEl) => {
    try {
      const container = canvasEl.parentElement?.querySelector(`[data-text-layer="${pageNum}"]`);
      if (!container) return;
      container.innerHTML = "";
      container.style.width = viewport.width + "px";
      container.style.height = viewport.height + "px";
      const textContent = await page.getTextContent();
      const items = [];
      const ocrEntry = pageIndexRef.current[pageNum];
      // Scanned page with OCR results — paint invisible word boxes so
      // selection/search/highlights work like a text PDF.
      if (!textContent.items.length && ocrEntry?.ocr && ocrEntry.words?.length) {
        let ti = 0;
        for (const w of ocrEntry.words) {
          const h = (w.y1 - w.y0) * viewport.height;
          const span = document.createElement("span");
          Object.assign(span.style, {
            position: "absolute",
            left: w.x0 * viewport.width + "px",
            top: w.y0 * viewport.height + "px",
            width: (w.x1 - w.x0) * viewport.width + "px",
            height: h + "px",
            fontSize: h + "px",
            color: "transparent",
            whiteSpace: "pre",
            cursor: "text",
            overflow: "hidden",
          });
          span.textContent = w.t;
          span.dataset.ti = ti++;
          container.appendChild(span);
          items.push(span);
        }
        textLayerRefs.current[pageNum] = container;
        paintSearchMark(pageNum);
        return;
      }
      let ti = 0; // filtered-item index — matches getPageIndexData's itemStart order
      for (const item of textContent.items) {
        if (!item.str) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]);
        const style = {
          left: tx[4] + "px",
          top: (tx[5] - fontHeight) + "px",
          fontSize: fontHeight + "px",
          fontFamily: item.fontName || "sans-serif",
          color: "transparent",
          position: "absolute",
          whiteSpace: "pre",
          cursor: "text",
          transformOrigin: "0 0",
        };
        const span = document.createElement("span");
        Object.assign(span.style, style);
        span.textContent = item.str;
        span.dataset.ti = ti++;
        if (item.width > 0) {
          span.style.width = item.width * viewport.scale + "px";
        }
        container.appendChild(span);
        items.push(span);
      }
      // Store text layer ref for copy operations
      textLayerRefs.current[pageNum] = container;
      // Repaint an active search mark when a virtualized page remounts
      paintSearchMark(pageNum);
    } catch (e) {
      // Non-critical — text layer is optional
    }
  };

  // Lazily measure one page's base dimensions — placeholders for unmeasured
  // pages otherwise borrow page 1's aspect and look stretched on mixed-size
  // documents. Retries pages the load-time loop failed to measure.
  const measurePageDims = useCallback(async (pg) => {
    if (!pdfDocRef.current || pageDimsRef.current[pg] || dimsMeasuringRef.current.has(pg)) return;
    dimsMeasuringRef.current.add(pg);
    try {
      const page = await pdfDocRef.current.getPage(pg);
      if (!pageDimsRef.current[pg]) {
        const vp = page.getViewport({ scale: 1 });
        pageDimsRef.current[pg] = { width: vp.width, height: vp.height };
        setDimsVersion((v) => v + 1); // repaint so the placeholder corrects
      }
    } catch {}
    dimsMeasuringRef.current.delete(pg);
  }, []);

  // Get placeholder dimensions for virtualized pages
  const getPlaceholderDims = (pg) => {
    const base = pageDimsRef.current[pg];
    if (base) return { width: base.width * scale, height: base.height * scale };
    // Unknown page — measure it now (self-corrects on the next repaint) and
    // use page 1 only as a transient stand-in so scroll length stays sane.
    measurePageDims(pg);
    const fallback = pageDimsRef.current[1];
    if (fallback) return { width: fallback.width * scale, height: fallback.height * scale };
    return { width: 0, height: 0 };
  };

  // ---- Pan-zoom helpers (must be defined before goToPage which calls resetPanZoom) ----
  const resetPanZoom = () => {
    const el = panZoomContentRef.current;
    if (el) el.style.transform = "none"; // imperative reset — React skips identical prop writes
    panZoomRef.current = { scale: 1, x: 0, y: 0 };
    setPanZoom({ scale: 1, x: 0, y: 0 });
  };

  // Writes the transform straight to the DOM — no React re-render during gestures.
  const applyPanZoom = (pz) => {
    panZoomRef.current = pz;
    const el = panZoomContentRef.current;
    if (el) el.style.transform = `translate(${pz.x}px, ${pz.y}px) scale(${pz.scale})`;
    if (zoomBadgeRef.current) zoomBadgeRef.current.textContent = Math.round(scale * pz.scale * 100) + "%";
  };

  // Finds the page element under a screen point + the fractional offset inside
  // it. Fractions are transform-invariant, so capture BEFORE clearing the pinch
  // preview transform and the anchor survives the preview→commit switch.
  const capturePageAnchor = (screenX, screenY) => {
    const el = document.elementFromPoint(screenX, screenY)?.closest?.("[data-page]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      el,
      pg: parseInt(el.dataset.page, 10),
      fx: (screenX - r.left) / r.width,
      fy: (screenY - r.top) / r.height,
    };
  };

  // Shared zoom-commit: anchors zoom at a screen point (touch/cursor), compensates scroll
  const commitZoomAtPoint = (newScale, screenX, screenY, anchor = null) => {
    const container = viewerRef.current;
    if (!container) {
      setUserZoomed(true);
      setScale(newScale);
      return;
    }
    const rect = container.getBoundingClientRect();
    const oldScale = scale;
    const scaleRatio = newScale / oldScale;
    // Content-space point under the anchor before zoom (fallback if no page anchor)
    const contentX = container.scrollLeft + (screenX - rect.left);
    const contentY = container.scrollTop + (screenY - rect.top);
    // In continuous mode, anchor on the actual page under the point
    if (scrollMode !== "single" && !anchor) anchor = capturePageAnchor(screenX, screenY);
    // Immediately resize all mounted canvases so layout is correct before paint
    const canvases = scrollMode === "single" ? [canvasRef.current] : scrollMode === "book" ? [canvasRef.current, canvas2Ref.current] : pageCanvasRefs.current;
    canvases.forEach((c) => {
      if (c) {
        const pg = scrollMode === "single" ? currentPage : parseInt(c.parentElement?.dataset?.page, 10);
        let base = pageDimsRef.current[pg];
        if (!base) {
          // Never borrow page 1's dims for a different page — its aspect would
          // squeeze the bitmap. The canvas already knows its true aspect from
          // its last render; derive base dims from it, else measure lazily.
          const rs = parseFloat(c.dataset.renderedScale || "0");
          const sw = parseFloat(c.style.width);
          const sh = parseFloat(c.style.height);
          if (rs > 0 && Number.isFinite(sw) && Number.isFinite(sh) && sw > 0 && sh > 0) {
            base = { width: sw / rs, height: sh / rs };
            pageDimsRef.current[pg] = base;
          } else {
            measurePageDims(pg);
          }
        }
        if (base) {
          c.style.width = (base.width * newScale) + "px";
          c.style.height = (base.height * newScale) + "px";
        }
      }
    });
    setUserZoomed(true);
    zoomAnchorPageRef.current = anchor?.pg || 0;
    setScale(newScale);
    // Render the anchored page at the new scale right away so the spot the user
    // is zooming into sharpens first — the debounced pass handles the rest.
    if (anchor && scrollMode !== "single") {
      const ac = pageCanvasRefs.current[anchor.pg - 1];
      if (ac) {
        ac.dataset.rendered = "true";
        renderPageToCanvas(anchor.pg, ac, newScale);
      }
    }
    // After React commits the new scale, adjust scroll so the same content point
    // stays under the anchor. Double rAF: placeholders need a React commit first.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (anchor && scrollMode !== "single") {
        const r2 = anchor.el.getBoundingClientRect();
        container.scrollTop += (r2.top + anchor.fy * r2.height) - screenY;
        container.scrollLeft += (r2.left + anchor.fx * r2.width) - screenX;
      } else {
        container.scrollTop = contentY * scaleRatio - (screenY - rect.top);
        container.scrollLeft = contentX * scaleRatio - (screenX - rect.left);
      }
    }));
  };

  const goToPage = useCallback(async (n, opts = {}) => {
    if (!pdfDocRef.current) return;
    n = Math.max(1, Math.min(pdfDocRef.current.numPages, n));
    if (n === currentPage) return;
    // Record jump navigation for the Back button — sequential page turns and
    // Back-driven returns don't create history entries.
    if (!opts.fromBack && Math.abs(n - currentPage) > (scrollMode === "book" ? 2 : 1)) {
      navStackRef.current.push(currentPage);
      if (navStackRef.current.length > 60) navStackRef.current.shift();
      setNavStackLen(navStackRef.current.length);
    }
    closeChat();
    resetPanZoom();

    if (scrollMode === "book") {
      // Book mode pairs pages (1,2),(3,4)… — normalize to the spread's left page
      const left = n - ((n - 1) % 2);
      if (left === currentPage) return;
      const dir = left > currentPage ? "next" : "prev";
      setTransitionDir(dir);
      setTransitioning(true);
      await new Promise((r) => setTimeout(r, 220));
      setCurrentPage(left);
      await renderSpread(left);
      setTransitioning(false);
      return;
    }

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
  }, [currentPage, renderPage, renderSpread, scrollMode]);

  const navBack = useCallback(() => {
    const prev = navStackRef.current.pop();
    if (prev == null) return;
    setNavStackLen(navStackRef.current.length);
    goToPage(prev, { fromBack: true });
  }, [goToPage]);

  // Sequential page turn — a spread counts as one step in book mode.
  // Tiny haptic tick for native-app feel — no-ops where unsupported.
  const buzz = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };

  const stepPage = useCallback((dir) => {
    buzz(8);
    goToPage(currentPage + dir * (scrollMode === "book" ? 2 : 1));
  }, [goToPage, currentPage, scrollMode]);

  // ---- Per-page text index for search + selection highlight painting ----
  // Items are filtered identically to the text-layer builder, so index i in
  // `itemStart` maps to the i-th span in the page's text layer container.
  // Paint the active search match onto the text-layer spans. Called after a
  // jump AND from renderTextLayer so matches survive virtualization re-mounts.
  const paintSearchMark = useCallback((pageNum) => {
    const m = activeMatchRef.current;
    const container = textLayerRefs.current[pageNum];
    if (!container) return;
    for (const span of container.children) {
      const ti = Number(span.dataset.ti);
      const hit = m && m.page === pageNum && ti >= m.i0 && ti <= m.i1;
      // Tutor-driven jumps (karaoke / See on page) glow gold; user searches amber.
      span.style.background = hit ? (m.karaoke ? "rgba(245,166,35,0.32)" : "rgba(255,171,64,0.55)") : "";
      span.style.borderRadius = hit ? "3px" : "";
      span.style.boxShadow = hit
        ? (m.karaoke ? "0 0 0 1.5px rgba(245,166,35,0.95), 0 0 10px rgba(245,166,35,0.45)" : "0 0 0 1px rgba(255,171,64,0.8)")
        : "";
    }
    // Center the first marked span within the page area for scroll modes
    if (m && m.page === pageNum) {
      const first = container.children[m.i0];
      first?.scrollIntoView?.({ block: "center", behavior: "auto" });
    }
  }, []);

  const goToMatch = useCallback(async (i) => {
    const r = searchResults[i];
    if (!r) return;
    setSearchIdx(i);
    const karaoke = karaokeMarkRef.current;
    karaokeMarkRef.current = false;
    activeMatchRef.current = { page: r.page, i0: r.i0, i1: r.i1, karaoke };
    await goToPage(r.page);
    // Text layer mounts async — poll briefly, then paint (also re-painted
    // from renderTextLayer when a virtualized page mounts).
    for (let attempt = 0; attempt < 8; attempt++) {
      if (textLayerRefs.current[r.page]?.children.length) break;
      await new Promise((res) => setTimeout(res, 120));
    }
    paintSearchMark(r.page);
  }, [searchResults, goToPage, paintSearchMark]);

  // ── Text selection → floating action popover ──
  // Debounced on selectionchange so mid-drag updates don't flash the menu;
  // covers mouse drag, touch selection handles, and shift+arrow selects.
  useEffect(() => {
    let debounce = null;
    const capture = () => {
      if (tool !== "none" && tool !== "highlight") { setSelPop(null); return; }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setSelPop(null); return; }
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (!text) { setSelPop(null); return; }
      const node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
      const layer = node?.closest?.("[data-text-layer]");
      if (!layer || !viewerRef.current?.contains(layer)) { setSelPop(null); return; }
      const page = Number(layer.dataset.textLayer);
      const lr = layer.getBoundingClientRect();
      if (!lr.width || !lr.height) { setSelPop(null); return; }
      const rects = [];
      try {
        for (const r of sel.getRangeAt(0).getClientRects()) {
          const x0 = Math.max(0, (r.left - lr.left) / lr.width);
          const y0 = Math.max(0, (r.top - lr.top) / lr.height);
          const x1 = Math.min(1, (r.right - lr.left) / lr.width);
          const y1 = Math.min(1, (r.bottom - lr.top) / lr.height);
          if (x1 - x0 > 0.002 && y1 - y0 > 0.002) rects.push([x0, y0, x1, y1]);
        }
      } catch {}
      if (!rects.length) { setSelPop(null); return; }
      pendingSelRef.current = { page, text: text.slice(0, 2000), rects };
      // MARK armed → convert the selection straight into a text highlight
      // (lands in Highlights & notes) instead of showing the action popover.
      if (tool === "highlight") {
        addMark("highlight", highlightColor);
        setAnnotatePopOpen(false);
        return;
      }
      const first = rects[0];
      const cx = lr.left + ((first[0] + first[2]) / 2) * lr.width;
      const cyTop = lr.top + first[1] * lr.height;
      const cyBot = lr.top + first[3] * lr.height;
      const above = cyTop > 110;
      // Touch devices draw their own Copy/Share menu anchored to the DOM
      // selection — it stacks on top of our popover. Every action here runs
      // off pendingSelRef (copy uses the clipboard API), so we can drop the
      // selection and keep only our bar. Desktop keeps native selection so
      // mouse users can still drag the handles. `pend` repaints the range as
      // an overlay since collapsing erases the native highlight.
      const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
      setSelPop({
        x: Math.max(100, Math.min(window.innerWidth - 100, cx)),
        y: above ? cyTop - 10 : cyBot + 10,
        above,
        pend: coarse ? { page, rects } : null,
      });
      if (coarse) {
        suppressSelClearRef.current = true;
        sel.removeAllRanges();
      }
    };
    const onChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        if (!suppressSelClearRef.current) {
          pendingSelRef.current = null;
          setSelPop(null);
        }
        return;
      }
      suppressSelClearRef.current = false;
      clearTimeout(debounce);
      debounce = setTimeout(capture, 260);
    };
    document.addEventListener("selectionchange", onChange);
    return () => { document.removeEventListener("selectionchange", onChange); clearTimeout(debounce); };
  }, [tool, highlightColor]);

  // Scrolling/zooming detaches the popover from its selection — dismiss it.
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const dismiss = () => setSelPop(null);
    v.addEventListener("scroll", dismiss, { passive: true });
    return () => v.removeEventListener("scroll", dismiss);
  }, []);

  // Persist marks (debounced)
  useEffect(() => {
    const t = setTimeout(() => saveStored(`sc_pdf_marks_${docKey}`, textMarks), 400);
    return () => clearTimeout(t);
  }, [textMarks, docKey]);

  const addMark = (kind, color) => {
    const sel = pendingSelRef.current;
    if (!sel) return null;
    const mark = {
      id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}`,
      kind, color, rects: sel.rects, text: sel.text, note: "", createdAt: Date.now(),
    };
    setTextMarks((prev) => ({ ...prev, [sel.page]: [...(prev[sel.page] || []), mark] }));
    undoStackRef.current.push({ kind: "mark", page: sel.page, id: mark.id });
    setUndoCount(undoStackRef.current.length);
    window.getSelection()?.removeAllRanges?.();
    pendingSelRef.current = null;
    setSelPop(null);
    buzz(12);
    return { ...mark, page: sel.page };
  };
  const removeMark = (page, id) =>
    setTextMarks((prev) => ({ ...prev, [page]: (prev[page] || []).filter((m) => m.id !== id) }));
  const updateMark = (page, id, patch) =>
    setTextMarks((prev) => ({ ...prev, [page]: (prev[page] || []).map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const jumpToMark = (page, id) => {
    goToPage(page);
    setFlashMark(id);
    setTimeout(() => setFlashMark(null), 1800);
  };
  const flatMarks = useMemo(() => {
    const out = [];
    for (const [pg, list] of Object.entries(textMarks)) {
      for (const m of list) out.push({ ...m, page: Number(pg) });
    }
    return out.sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);
  }, [textMarks]);

  // Shared annotations grouped by page → { highlights: [], comments: [] }
  const sharedByPage = useMemo(() => {
    const out = {};
    for (const a of sharedAnnots) {
      (out[a.page] ||= { highlights: [], comments: [] });
      (a.kind === "highlight" ? out[a.page].highlights : out[a.page].comments).push(a);
    }
    return out;
  }, [sharedAnnots]);

  const sharedCount = useMemo(
    () => sharedAnnots.reduce((n, a) => n + (a.kind === "comment" ? 1 : 0), 0),
    [sharedAnnots]
  );

  const getAuthToken = () => {
    try { return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken || null; }
    catch { return null; }
  };

  // Load the shared board once the document is ready (signed-in users only)
  useEffect(() => {
    if (loading || !fileUrl) return;
    const token = getAuthToken();
    if (!token) return;
    let cancelled = false;
    fetchWithAuth(`${API_BASE}/api/resources/shared-annotations/${encodeURIComponent(docKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.annotations)) setSharedAnnots(d.annotations); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, fileUrl, docKey]);

  const toastDeck = (text, type = "ok") => {
    setDeckToast({ type, text });
    setTimeout(() => setDeckToast(null), 2800);
  };

  // Share the pending selection as a community highlight
  const shareSelection = async () => {
    const sel = pendingSelRef.current;
    const token = getAuthToken();
    if (!sel) return;
    if (!token) { toastDeck("Sign in to share highlights", "error"); return; }
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const r = await fetchWithAuth(`${API_BASE}/api/resources/shared-annotations`, {
        method: "POST",
        body: JSON.stringify({
          docKey, page: sel.page, kind: "highlight",
          color: "rgba(255,211,77,0.35)", rects: sel.rects,
          excerpt: sel.text.slice(0, 500),
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.annotation) throw new Error(d?.error || "Share failed");
      setSharedAnnots((prev) => [...prev, d.annotation]);
      window.getSelection()?.removeAllRanges?.();
      pendingSelRef.current = null;
      setSelPop(null);
      toastDeck("Shared — everyone reading this PDF sees it");
    } catch (e) {
      toastDeck(e.message || "Couldn't share highlight", "error");
    } finally {
      setShareBusy(false);
    }
  };

  const postComment = async () => {
    const txt = commentDraft.trim();
    const token = getAuthToken();
    if (!txt || commentsFor == null) return;
    if (!token) { toastDeck("Sign in to comment", "error"); return; }
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const r = await fetchWithAuth(`${API_BASE}/api/resources/shared-annotations`, {
        method: "POST",
        body: JSON.stringify({ docKey, page: commentsFor, kind: "comment", body: txt.slice(0, 2000) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.annotation) throw new Error(d?.error || "Couldn't post comment");
      setSharedAnnots((prev) => [...prev, d.annotation]);
      setCommentDraft("");
    } catch (e) {
      toastDeck(e.message || "Couldn't post comment", "error");
    } finally {
      setShareBusy(false);
    }
  };

  const deleteShared = async (id) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const r = await fetchWithAuth(`${API_BASE}/api/resources/shared-annotations/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error();
      setSharedAnnots((prev) => prev.filter((a) => a.id !== id));
      setSharedMenu(null);
    } catch {
      toastDeck("Couldn't delete — try again", "error");
    }
  };

  // Community highlights + a comment-count pin for one page.
  // Renders inside the page wrapper (position:relative), percents vs page box.
  const renderSharedMarks = (pg) => {
    if (!showShared) return null;
    const group = sharedByPage[pg];
    if (!group) return null;
    return (
      <>
        {group.highlights.map((a) =>
          (a.rects || []).map((r, ri) => (
            <div
              key={`sh-${a.id}-${ri}`}
              title={`${a.author}${a.excerpt ? ` — “${a.excerpt.slice(0, 80)}”` : ""}`}
              onClick={(e) => { e.stopPropagation(); setSharedMenu({ annot: a, x: e.clientX, y: e.clientY }); }}
              style={{
                position: "absolute",
                left: `${r[0] * 100}%`, top: `${r[1] * 100}%`,
                width: `${(r[2] - r[0]) * 100}%`, height: `${(r[3] - r[1]) * 100}%`,
                background: a.color || "rgba(80,200,255,0.3)",
                border: `1px dashed ${T.accent}`,
                borderRadius: 2,
                zIndex: 5,
                cursor: "pointer",
                mixBlendMode: (theme === "dark") ? "screen" : "multiply",
              }}
            />
          ))
        )}
        {group.comments.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setCommentsFor(pg); }}
            title={`${group.comments.length} comment${group.comments.length > 1 ? "s" : ""} on this page`}
            style={{
              position: "absolute", top: 6, right: 6, zIndex: 9,
              display: "flex", alignItems: "center", gap: 4,
              background: T.toolbar, border: `1px solid ${T.border}`, borderRadius: 999,
              color: T.text, fontSize: 11, fontWeight: 700, padding: "3px 8px",
              cursor: "pointer", boxShadow: `0 4px 14px ${T.shadow}`,
            }}
          >
            💬 {group.comments.length}
          </button>
        )}
      </>
    );
  };

  // While the selection popover is open on touch devices, the DOM selection is
  // collapsed (hides the OS menu) — paint the captured range so the user still
  // sees what they picked. Desktop keeps its native selection highlight.
  const renderPendingSel = (pg) => {
    const pend = selPop?.pend;
    if (!pend || pend.page !== pg) return null;
    return pend.rects.map((r, ri) => (
      <div
        key={`pend-${ri}`}
        style={{
          position: "absolute",
          left: `${r[0] * 100}%`, top: `${r[1] * 100}%`,
          width: `${(r[2] - r[0]) * 100}%`, height: `${(r[3] - r[1]) * 100}%`,
          background: "rgba(79,142,247,0.3)",
          mixBlendMode: (theme === "dark") ? "screen" : "multiply",
          borderRadius: 2,
          zIndex: 6,
          pointerEvents: "none",
        }}
      />
    ));
  };

  const clearSearchMark = useCallback(() => {
    const m = activeMatchRef.current;
    activeMatchRef.current = null;
    if (!m) return;
    const container = textLayerRefs.current[m.page];
    if (!container) return;
    for (const span of container.children) {
      span.style.background = "";
      span.style.borderRadius = "";
      span.style.boxShadow = "";
    }
  }, []);

  const zoomToCenter = (newScale) => {
    const container = viewerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      commitZoomAtPoint(newScale, rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      setUserZoomed(true);
      setScale(newScale);
    }
  };

  const handleZoomIn = () => {
    zoomToCenter(Math.min(2.6, scale * 1.2));
    showZoomBadge();
  };

  const handleZoomOut = () => {
    zoomToCenter(Math.max(0.5, scale / 1.2));
    showZoomBadge();
  };

  // Tap the % chip → return to fit-to-width
  const resetToFit = () => {
    setUserZoomed(false);
    resetPanZoom();
    fitToWidth().then((s) => { if (s && (scrollMode === "single" || scrollMode === "book")) renderCurrent(s); });
  };

  // Keyboard nav + shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") stepPage(1);
      if (e.key === "ArrowLeft") stepPage(-1);
      if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); setShowShortcuts((v) => !v); }
      if (e.key === "Escape") setShowShortcuts(false);
      // Ctrl/Cmd +/-/0 — intercept browser page zoom; only the material zooms
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "+" || e.key === "=") { e.preventDefault(); handleZoomIn(); return; }
        if (e.key === "-" || e.key === "_") { e.preventDefault(); handleZoomOut(); return; }
        if (e.key === "0") {
          e.preventDefault();
          setUserZoomed(false);
          resetPanZoom();
          fitToWidth().then((s) => { if (s && (scrollMode === "single" || scrollMode === "book")) renderCurrent(s); });
          return;
        }
      }
      if (e.key === "+" || e.key === "=") { handleZoomIn(); }
      if (e.key === "-" || e.key === "_") { handleZoomOut(); }
      if (e.key === "b") toggleBookmark();
      if (e.key === "t") setThemePref((t) => t === "auto" ? "light" : t === "light" ? "dark" : t === "dark" ? "sepia" : "auto");
      if (e.key === "f") setFullscreen((v) => !v);
      if (e.key === "h") toggleTool("highlight");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPage, goToPage]);

  // ---- Search ----
  // Results carry the span range [i0,i1] covering the match so the hit can be
  // painted directly on the page's text layer, plus i/N match navigation.
  const runSearch = useCallback(async (query) => {
    const q = query.trim();
    clearSearchMark();
    setSearchIdx(-1);
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    const results = await buildSearchResults(q, getPageIndexData, pdfDocRef.current?.numPages || 0);
    setSearchResults(results);
    setSearching(false);
    // If nothing matched and indexed pages carry little/no text, this is
    // probably a scanned PDF — offer OCR.
    if (!results.length) {
      const idxs = pageIndexRef.current;
      const keys = Object.keys(idxs);
      const thin = keys.filter((k) => !idxs[k].ocr && (idxs[k].raw || "").length < 25).length;
      setScannedPagesLikely(thin > 0);
    } else {
      setScannedPagesLikely(false);
    }
  }, [getPageIndexData, clearSearchMark]);

  // OCR the whole document (skips text pages + already-scanned pages), then
  // refresh mounted empty text layers and re-run the open search.
  const runOcrScan = useCallback(async () => {
    if (ocrScanning || !pdfDocRef.current) return;
    setOcrScanning(true);
    try {
      await ocrDocument();
      setScannedPagesLikely(false);
      // Rebuild text layers on pages that mounted before OCR finished.
      for (const [n, container] of Object.entries(textLayerRefs.current)) {
        const idx = pageIndexRef.current[+n];
        if (!container || container.childElementCount || !idx?.ocr || !idx.words?.length) continue;
        const wrapper = container.parentElement;
        const canvas = wrapper?.querySelector("canvas");
        if (!canvas || !pageDimsRef.current[+n]) continue;
        const scale = canvas.getBoundingClientRect().width / pageDimsRef.current[+n].width;
        if (!(scale > 0)) continue;
        const page = await pdfDocRef.current.getPage(+n);
        renderTextLayer(+n, page, page.getViewport({ scale }), canvas);
      }
      if (searchQuery.trim()) runSearch(searchQuery);
    } finally {
      setOcrScanning(false);
    }
  }, [ocrScanning, ocrDocument, searchQuery, runSearch]);

  // ---- Circle to Ask (lasso helpers) ----
  const getRelPoint = (e) => {
    const pg = drawPageRef.current || currentPage;
    const canvas = scrollMode === "single" ? canvasRef.current : pageCanvasRefs.current[pg - 1];
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const analyzeLasso = async (poly, pg = currentPage) => {
    // One stream at a time — a second circle while an answer is still
    // streaming would interleave two writers into the same message.
    if (chatLoading) return;
    const canvas = scrollMode === "single" ? canvasRef.current : pageCanvasRefs.current[pg - 1];
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

    if (pg !== currentPage) setCurrentPage(pg);

    // Get page text for context
    let pageText = "";
    try { pageText = await getPageText(pg); } catch (e) {}
    pageTextRef.current = pageText;

    // Start conversation: first user message with image
    const pageContext = pageText ? `\n\nPage text (use only if the image alone is ambiguous):\n"""\n${pageText.slice(0, 1000)}\n"""` : "";
    const firstPrompt = `${TUTOR_SYSTEM}${pageContext}\n\n---\n\nThe image attached is EXACTLY what the student circled. Look at the image. Identify what type of content it is (question / term / problem / diagram / statement). Then immediately provide the answer — begin your response with the answer, nothing else.`;

    setStudyToolsOpen(false);
    closeAllMobileOverlays();
    // Append to any existing thread (NotebookLM-style: each circle becomes a
    // new turn), otherwise start a fresh thread.
    const circleMsg = { role: "user", content: "What did I circle?", image: thumb, page: pg };
    setChatMessages((prev) => (prev.length ? [...prev, circleMsg] : [circleMsg]));
    setChatOpen(true);
    setChatLoading(true);
    setChatError(null);
    chatNearBottomRef.current = true;

    try {
      await streamChatAnswer(firstPrompt, thumb, trimHistory(chatMessages, pg), { page: pg });
    } catch (err) {
      if (!err.stoppedByUser) setChatError(err.message || "Something went wrong reaching the AI.");
    } finally {
      setChatLoading(false);
    }
  };

  // ---- AI Study Tools helpers ----
  const MAX_STUDY_CHARS = 60000; // gemini-2.5-flash handles large context

  const extractTextForRange = async (from, to) => {
    if (!pdfDocRef.current) return "";
    const parts = [];
    let total = 0;
    for (let n = from; n <= to; n++) {
      if (total >= MAX_STUDY_CHARS) break;
      const text = await getPageText(n);
      parts.push(text);
      total += text.length;
    }
    let combined = parts.join("\n\n");
    if (combined.length > MAX_STUDY_CHARS) {
      combined = combined.slice(0, MAX_STUDY_CHARS) + "\n\n[...content truncated for processing...]";
    }
    return combined;
  };

  const openStudyTools = () => {
    hideChat();
    closeAllMobileOverlays();
    setStudyToolsOpen(true);
    checkRankCelebration();
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    if (authData.authToken) {
      fetch(`${API_BASE}/ai-proxy/usage`, {
        headers: { Authorization: `Bearer ${authData.authToken}` },
        credentials: "include",
      }).then(r => r.ok ? r.json() : null).then(data => setAiUsage(data)).catch(() => {});
    }
  };

  const closeStudyTools = () => {
    // An active voice session keeps running — minimize to the floating orb.
    if (voiceActive) setVoiceMinimized(true);
    setStudyToolsOpen(false);
  };

  // ── Voice Tutor handlers ───────────────────────────────────────────────────
  const handleVoiceStart = useCallback(async (lessonContext = "") => {
    if (!propResourceId) return;
    setVoiceMinimized(false);
    setStudyToolsOpen(false);
    try {
      const text = await getPageText(currentPage);
      pageTextRef.current = text;
    } catch {}
    await voice.startSession(propResourceId, voiceName, currentPage, pageTextRef.current, { level: voiceLevel, allowPageNav: true, lessonContext });
  }, [propResourceId, voiceName, voiceLevel, currentPage, voice, getPageText]);

  // ── Page Tutor handlers ────────────────────────────────────────────────────
  // Snapshot for a fresh generation: a rendered JPEG of the page (the GLM
  // fallback's image input) plus extracted/OCR'd text (helps scanned pages).
  const buildPageSnapshot = useCallback(async (page) => {
    let pageImage = null, pageText = "";
    try {
      const pg = await pdfDocRef.current?.getPage(page);
      if (pg) {
        const base = pg.getViewport({ scale: 1 });
        const scale = Math.min(2, 1400 / base.width);
        const vp = pg.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        await pg.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        pageImage = canvas.toDataURL("image/jpeg", 0.8);
      }
    } catch {}
    try { pageText = String(await getPageText(page) || "").slice(0, 6000); } catch {}
    return { pageImage, pageText };
  }, [getPageText]);

  const handleExplain = useCallback(() => {
    setStudyView("lesson");
    pageTutor.explain(currentPage, { snapshot: buildPageSnapshot(currentPage) });
  }, [currentPage, pageTutor, buildPageSnapshot]);

  // ── Lecture mode — continuous playback across a page range ──────────────────
  const [lecture, setLecture] = useState(null);          // { queue:[pages], pos, cachedOnly }
  const [lecturePrep, setLecturePrep] = useState(0);     // page generating mid-lecture
  const [lectureBlocked, setLectureBlocked] = useState(false); // autoplay rejected — needs a tap
  const lectureRef = useRef(null);
  const lectureNavRef = useRef(false);                   // programmatic page turn — don't cancel
  const lecturePlayRef = useRef(null);
  useEffect(() => { lectureRef.current = lecture; }, [lecture]);

  const stopLecture = useCallback(() => {
    lectureRef.current = null;
    setLecture(null);
    setLecturePrep(0);
    setLectureBlocked(false);
  }, []);

  // Attempt playback — anything that can't start (pending audio, rejected
  // autoplay) surfaces the "Continue" button instead of stalling silently.
  const tryLecturePlay = useCallback(() => {
    if (!lectureRef.current) return;
    if (!pageTutor.playAll()) setLectureBlocked(true);
  }, [pageTutor]);

  const lecturePlay = useCallback((L, pos) => {
    if (!L || pos >= L.queue.length) {
      stopLecture();
      toastDeck("🎧 Lecture finished — nice session");
      return;
    }
    const p = L.queue[pos];
    const next = { ...L, pos };
    lectureRef.current = next;
    setLecture(next);
    setLectureBlocked(false);
    if (pageTutor.lessonPages.has(p)) {
      lectureNavRef.current = true;
      goToPage(p);
      setTimeout(tryLecturePlay, 400);
    } else if (!L.cachedOnly && aiUsage?.isActivated !== false) {
      setLecturePrep(p);
      pageTutor.explain(p, { snapshot: buildPageSnapshot(p) });
    } else {
      lecturePlayRef.current?.(next, pos + 1); // skip pages we can't play
    }
  }, [pageTutor, goToPage, buildPageSnapshot, aiUsage, stopLecture, tryLecturePlay]);
  useEffect(() => { lecturePlayRef.current = lecturePlay; }, [lecturePlay]);

  const startLecture = useCallback((from, to, cachedOnly) => {
    const lo = Math.max(1, Math.min(from, to));
    const hi = Math.min(numPages, Math.max(from, to));
    let queue = [];
    for (let p = lo; p <= hi; p++) queue.push(p);
    if (cachedOnly) queue = queue.filter((p) => pageTutor.lessonPages.has(p));
    if (!queue.length) { toastDeck("No explained pages in that range yet"); return; }
    setStudyView("lesson");
    lecturePlay({ queue, pos: -1, cachedOnly }, 0);
  }, [numPages, pageTutor, lecturePlay]);

  const resumeLecture = useCallback(() => {
    setLectureBlocked(false);
    if (!pageTutor.playAll()) setLectureBlocked(true);
  }, [pageTutor]);

  // Mid-lecture generation: play when the page lands, stop if it fails.
  useEffect(() => {
    if (!lecturePrep) return;
    if (pageTutor.status === "ready" && pageTutor.lesson?.page === lecturePrep) {
      setLecturePrep(0);
      lectureNavRef.current = true;
      goToPage(lecturePrep);
      setTimeout(tryLecturePlay, 500);
    } else if (pageTutor.status === "error" || pageTutor.status === "premium") {
      setLecturePrep(0);
      stopLecture();
    }
  }, [pageTutor.status, pageTutor.lesson, lecturePrep, goToPage, pageTutor, stopLecture, tryLecturePlay]);

  // While a lecture is stalled on pending audio, retry when the poll lands it.
  useEffect(() => {
    if (!lecture || !lectureBlocked || lecturePrep || pageTutor.player.playing) return;
    if (pageTutor.playAll()) setLectureBlocked(false);
  }, [pageTutor.audioSections]); // eslint-disable-line react-hooks/exhaustive-deps

  // A manual page turn cancels the lecture; programmatic turns carry the flag.
  useEffect(() => {
    const L = lectureRef.current;
    if (!L || L.pos < 0) return;
    if (lectureNavRef.current) { lectureNavRef.current = false; return; }
    if (currentPage !== L.queue[L.pos]) stopLecture();
  }, [currentPage, stopLecture]);

  // ── Karaoke follow-along — scroll the page to the playing section's anchor ──
  const [followAlong, setFollowAlong] = useState(true);
  const karaokeAnchorRef = useRef(false);
  const karaokeQuoteRef = useRef("");
  const karaokeMarkRef = useRef(false); // next goToMatch paints gold, not amber

  // Section changed → search for its anchor (quietly; the sheet stays open).
  useEffect(() => {
    if (!followAlong || !pageTutor.player.playing || pageTutor.player.idx < 0) return;
    const sec = pageTutor.lesson?.lesson?.sections?.[pageTutor.player.idx];
    const quote = sec?.anchor_quote;
    if (!quote || quote === karaokeQuoteRef.current) return;
    karaokeQuoteRef.current = quote;
    karaokeAnchorRef.current = true;
    setSearchQuery(quote);
    runSearch(quote);
  }, [pageTutor.player.idx, followAlong]); // eslint-disable-line react-hooks/exhaustive-deps

  // Results landed → jump to the match. Misses are silent (scanned pages).
  useEffect(() => {
    if (!karaokeAnchorRef.current || searching) return;
    karaokeAnchorRef.current = false;
    if (searchResults.length) { karaokeMarkRef.current = true; goToMatch(0); }
  }, [searchResults, searching, goToMatch]);

  // ── Lesson resume — persist playing position; offer to continue on reopen ──
  const RESUME_KEY = `sc_pt_resume_${docKey}`;
  const [resumeLesson, setResumeLesson] = useState(() => loadStored(RESUME_KEY, null));
  const resumePlayRef = useRef(null); // section idx to start once the lesson lands

  useEffect(() => {
    if (pageTutor.player.playing && pageTutor.player.idx >= 0)
      saveStored(RESUME_KEY, { page: currentPage, idx: pageTutor.player.idx });
  }, [pageTutor.player.idx, pageTutor.player.playing, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!resumeLesson) return;
    const t = setTimeout(() => setResumeLesson(null), 9000);
    return () => clearTimeout(t);
  }, [resumeLesson]);

  // The resume target's lesson arrives via adopt() → start its section.
  useEffect(() => {
    const target = resumePlayRef.current;
    if (!target || target.page !== currentPage) return;
    const secs = pageTutor.lesson?.lesson?.sections;
    if (!secs?.length) return;
    resumePlayRef.current = null;
    pageTutor.playSection(Math.min(target.idx, secs.length - 1));
  }, [pageTutor.lesson, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResumeLesson = () => {
    const r = resumeLesson;
    setResumeLesson(null);
    if (!r) return;
    const secs = pageTutor.lesson?.lesson?.sections;
    if (r.page === currentPage && secs?.length) pageTutor.playSection(Math.min(r.idx, secs.length - 1));
    else { resumePlayRef.current = { page: r.page, idx: r.idx }; goToPage(r.page); }
  };

  const handleTutorAsk = useCallback(() => {
    if (pageTutor.lesson?.lessonId) tutorLogEvent(pageTutor.lesson.lessonId, "ask_voice");
    const ctx = buildLessonContext(pageTutor.lesson?.lesson, currentPage, title);
    handleVoiceStart(ctx);
  }, [pageTutor.lesson, currentPage, title, handleVoiceStart]);

  // "See on page" — reuse in-document search to highlight the section's anchor.
  const pendingAnchorRef = useRef(false);
  const handleSeeOnPage = useCallback((quote) => {
    if (!quote) return;
    pendingAnchorRef.current = true;
    setSearchQuery(quote);
    if (isMobile) closeStudyTools();
    runSearch(quote);
  }, [runSearch, isMobile]);

  useEffect(() => {
    if (!pendingAnchorRef.current || searching) return;
    pendingAnchorRef.current = false;
    if (searchResults.length) { karaokeMarkRef.current = true; goToMatch(0); }
    else toastDeck("Couldn't locate that text on the page", "error");
  }, [searchResults, searching, goToMatch]);

  // Landing on a tutored page → one gold pulse on its thumbnail.
  useEffect(() => {
    if (!pageTutor.lessonPages?.has(currentPage)) return;
    const el = thumbItemRefs.current[currentPage - 1];
    if (!el) return;
    el.classList.add("sc-pulse-once");
    const t = setTimeout(() => el.classList.remove("sc-pulse-once"), 900);
    return () => clearTimeout(t);
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Page turns: keep audio playing; adopt a cached lesson or reset the panel.
  useEffect(() => { pageTutor.onPageChanged(currentPage); }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVoiceEnd = useCallback(() => {
    voice.endSession();
    setVoiceMinimized(false);
    setVoiceTextInput("");
  }, [voice]);

  const handleVoiceMinimize = useCallback(() => {
    setVoiceMinimized(true);
  }, []);

  const handleVoiceExpand = useCallback(() => {
    setVoiceMinimized(false);
  }, []);

  // Update pageTextRef and send page changes to voice tutor when session is active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pdfDocRef.current) return;
      try {
        const text = await getPageText(currentPage);
        if (!cancelled) {
          pageTextRef.current = text;
          if (voiceActive && voice.state === VOICE_STATES.READY) {
            voice.sendPageChange(currentPage, text);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [currentPage, voiceActive, voice.state, voice.sendPageChange, getPageText]);

  // Cleanup voice session on unmount
  useEffect(() => {
    return () => {
      if (voice.state !== VOICE_STATES.IDLE && voice.state !== VOICE_STATES.ENDED) {
        voice.endSession();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Chat popup ----
  const chatSessionRef = useRef(0);
  const closeChat = () => {
    chatAbortRef.current?.abort();
    chatSessionRef.current++;
    setChatOpen(false);
    setChatMessages([]);
    setChatLoading(false);
    setChatInput("");
    setChatError(null);
    setQuizResults({});
    setConfirmNewChat(false);
    setShowJumpLatest(false);
    chatNearBottomRef.current = true;
  };

  // Dismiss the chat but keep the thread, so reopening resumes the
  // conversation instead of starting over. Deliberately does NOT bump
  // chatSessionRef — an in-flight stream keeps landing into the thread so
  // the answer is there (or still typing) when the user reopens.
  const hideChat = () => {
    setChatOpen(false);
    setChatLoading(false);
    setChatInput("");
    setChatError(null);
    setConfirmNewChat(false);
  };

  // "New chat" — two taps to confirm when a thread exists.
  const startNewChat = () => {
    if (chatMessages.length > 0 && !confirmNewChat) {
      setConfirmNewChat(true);
      setTimeout(() => setConfirmNewChat(false), 2500);
      return;
    }
    setConfirmNewChat(false);
    chatAbortRef.current?.abort();
    chatSessionRef.current++;
    setChatMessages([]);
    setChatError(null);
    setQuizResults({});
    setChatOpen(true);
    chatNearBottomRef.current = true;
  };

  // Stop the in-flight stream — whatever text already arrived stays.
  const stopStream = () => chatAbortRef.current?.abort();

  // Context caps: keep the last N turns, and only the most recent circled
  // image — older thumbs cost tokens on every turn and go stale quickly.
  const MAX_HISTORY_TURNS = 10;
  const trimHistory = (msgs, pageOfTurn) => {
    const recent = msgs.slice(-MAX_HISTORY_TURNS);
    let lastImg = -1;
    // A circled image only stays in history while it matches THIS turn's page.
    // After the student scrolls, a stale circle would anchor the model to the
    // old page (the image outweighs fresh page text) — so it drops out.
    recent.forEach((m, i) => { if (m.image && m.page === pageOfTurn) lastImg = i; });
    return recent.map((m, i) => ({
      role: m.role,
      content: m.content,
      ...(i === lastImg && m.image ? { image: m.image } : {}),
    }));
  };

  // Keyword search across the doc — grounds non-quiz answers in the pages
  // that actually mention the topic instead of only the current page.
  const findRelevantPages = async (query, excludePage) => {
    const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GROUNDING_STOPWORDS.has(w));
    const numP = pdfDocRef.current?.numPages || 0;
    if (!words.length || numP <= 3) return [];
    const scored = [];
    for (let n = 1; n <= Math.min(numP, 200); n++) {
      if (n === excludePage) continue;
      let text;
      try { text = await getPageText(n); } catch { continue; }
      if (!text) continue;
      const lower = text.toLowerCase();
      let score = 0;
      let firstIdx = Infinity;
      for (const w of words) {
        let idx = lower.indexOf(w);
        let c = 0;
        while (idx !== -1 && c < 20) {
          if (idx < firstIdx) firstIdx = idx;
          c++;
          idx = lower.indexOf(w, idx + w.length);
        }
        score += c;
      }
      if (score >= 2) scored.push({ page: n, score, text, firstIdx: firstIdx === Infinity ? 0 : firstIdx });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 2).map((h) => ({
      page: h.page,
      excerpt: h.text.slice(Math.max(0, h.firstIdx - 600), h.firstIdx + 1400).trim(),
    }));
  };

  // Scanned pages have no text layer — render the page so vision can read it.
  const renderPageImage = async (pg) => {
    try {
      if (!pdfDocRef.current) return null;
      const page = await pdfDocRef.current.getPage(pg);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(1.6, 1400 / base.width) });
      const c = document.createElement("canvas");
      c.width = Math.ceil(viewport.width);
      c.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: c.getContext("2d"), viewport }).promise;
      return c.toDataURL("image/jpeg", 0.82);
    } catch {
      return null;
    }
  };

  // Auto-scroll helpers — only scroll while the user is pinned to the bottom.
  const scrollChatBottom = (force = false) => {
    const el = chatScrollRef.current;
    if (el && (force || chatNearBottomRef.current)) el.scrollTop = el.scrollHeight;
  };
  const onChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    chatNearBottomRef.current = near;
    setShowJumpLatest(!near && chatMessages.length > 2);
  };

  // Strip quiz blocks before copying/saving — nobody wants raw ```mcq JSON.
  const plainTextOf = (msg) =>
    parseMcqSegments(msg.content).filter((s) => s.type === "text").map((s) => s.text).join("\n").trim();

  const copyMessage = async (i, msg) => {
    try {
      await navigator.clipboard.writeText(plainTextOf(msg) || msg.content);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((v) => (v === i ? null : v)), 1800);
    } catch {}
  };

  const autoGrowInput = (el) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(96, el.scrollHeight)}px`;
  };

  // Mobile sheet: swipe down dismisses, swipe up expands, tap toggles.
  const sheetTouchStart = (e) => { sheetDragRef.current = e.touches[0].clientY; };
  const sheetTouchEnd = (e) => {
    if (sheetDragRef.current == null) return;
    const dy = e.changedTouches[0].clientY - sheetDragRef.current;
    sheetDragRef.current = null;
    if (dy > 80) hideChat();
    else if (dy < -60) setChatExpanded(true);
    else if (Math.abs(dy) < 8) setChatExpanded((v) => !v);
  };

  // Refresh the AI-credit chip whenever the chat opens.
  useEffect(() => {
    if (!chatOpen) return;
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    if (!authData.authToken) return;
    fetch(`${API_BASE}/ai-proxy/usage`, { headers: { Authorization: `Bearer ${authData.authToken}` }, credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAiUsage(d))
      .catch(() => {});
  }, [chatOpen]);

  // Open the chat directly (no circled content) — keeps any existing thread.
  const openChatDirect = () => {
    setStudyToolsOpen(false);
    closeAllMobileOverlays();
    setChatError(null);
    setChatOpen(true);
  };

  // Practice sheet "Ask AI" entry — arm circle mode or open chat once on mount.
  useEffect(() => {
    let intro = null;
    try { intro = sessionStorage.getItem("sc_reader_intro"); sessionStorage.removeItem("sc_reader_intro"); } catch { /* storage unavailable */ }
    // "circle" must NOT arm the tool — the user has to tap Ask AI themselves.
    // We just nudge them toward it with a hint pill + a pulse on the button.
    if (intro === "circle") {
      setAskNudge(true);
      const t = setTimeout(() => setAskNudge(false), 7000);
      return () => clearTimeout(t);
    }
    else if (intro === "chat") openChatDirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat MCQ answers feed the same weakspot store, FSRS scheduler, streak,
  // XP pool and quest counters as a Streak Survival run — one progress record.
  const QUIZ_LETTERS = ["A", "B", "C", "D", "E", "F"];
  const handleChatQuizPick = (mcq, pickedIdx) => {
    const correct = pickedIdx === mcq.answer;
    try {
      const optionsObj = Object.fromEntries(mcq.options.map((o, i) => [QUIZ_LETTERS[i], o]));
      const appMcq = { question: mcq.question, options: optionsObj, correct: QUIZ_LETTERS[mcq.answer], explanation: mcq.explanation || "" };
      recordPracticeResult(studyResourceId, [appMcq], { 0: QUIZ_LETTERS[pickedIdx] });
      recordPracticeSession(studyResourceId, null, correct ? 1 : 0, 1);
    } catch {}
    // Aggregate FSRS card per document — chat questions are ephemeral and
    // have no stable bank index, so the server pins chat_mcq to pageIndex -1.
    if (propResourceId) {
      rateQuestion({
        resourceId: propResourceId,
        itemType: "chat_mcq",
        pageIndex: -1,
        grade: correct ? 3 : 1,
        topic: title,
        subject: title,
      }).then((data) => {
        if (data?.xpAwarded > 0) {
          window.dispatchEvent(new CustomEvent("sc-xp-gained", { detail: { xp: data.xpAwarded } }));
        }
      });
    }
    try {
      questEvent("answered", 1);
      if (correct) questEvent("correct", 1);
    } catch {}
  };

  // "Next question" flow — tells the model the outcome so it can adapt.
  const requestNextQuestion = (res) => {
    const vals = Object.values(quizResults);
    const c = vals.filter((v) => v.correct).length;
    const tail = vals.length ? ` I'm ${c}/${vals.length} so far.` : "";
    sendFollowUp(`${res ? `I got that one ${res.correct ? "right" : "wrong"}. ` : ""}Next question — same mcq format.${tail}`);
  };

  // Streams an AI answer into the chat as a live assistant message. Tokens
  // update one message in place; it's finalized (flag stripped) on completion.
  // `meta` (page, sources) lands on the finished message for the UI trail.
  const streamChatAnswer = async (prompt, image, history, meta = {}) => {
    const session = chatSessionRef.current;
    const ctl = new AbortController();
    chatAbortRef.current = ctl;
    // Typewriter reveal: tokens land in `target` instantly but the bubble
    // reveals gradually, so fast models still visibly type out.
    let target = "";
    let shown = 0;
    const reveal = setInterval(() => {
      if (session !== chatSessionRef.current || shown >= target.length) return;
      const lag = target.length - shown;
      shown += Math.max(1, Math.min(6, Math.ceil(lag / 14)));
      const partial = target.slice(0, shown);
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.streaming) return [...prev.slice(0, -1), { ...last, content: partial }];
        return [...prev, { role: "assistant", content: partial, streaming: true }];
      });
      scrollChatBottom();
    }, 24);
    const finalize = (content) => session === chatSessionRef.current && setChatMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        return [...prev.slice(0, -1), { role: "assistant", content: content || last.content, ...meta }];
      }
      return content ? [...prev, { role: "assistant", content, ...meta }] : prev;
    });
    try {
      const text = await callAIMultimodalStream(prompt, image, history, { provider: "openrouter" }, {
        signal: ctl.signal,
        onToken: (raw) => { if (session === chatSessionRef.current) target = raw; },
      });
      clearInterval(reveal);
      finalize(text || "No response.");
    } catch (err) {
      clearInterval(reveal);
      // Abort/error: flush everything received so far rather than the
      // partially-revealed slice, then propagate as before.
      finalize(target || undefined);
      throw err;
    }
  };

  // Close study tools when chat opens (mutual exclusion)
  // This is called from openStudyTools via closeChat, and vice versa

  const sendFollowUp = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    setChatMessages((prev) => [...prev, { role: "user", content: trimmed, page: currentPage }]);
    setChatInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setChatLoading(true);
    setChatError(null);
    chatNearBottomRef.current = true;

    // Refresh page text so a question asked after navigating uses the page
    // actually on screen (getPageText is LRU-cached).
    try { pageTextRef.current = await getPageText(currentPage); } catch {}

    // Quiz scope: "quiz me on the whole document" pulls a window of pages
    // around the current one; plain "quiz me" stays on this page.
    const isQuizIntent = /\b(quiz|test|question|mcq)\b/i.test(trimmed);
    const wantsDocScope = isQuizIntent && /\b(whole|entire|full|all|document|chapter|everything|overall)\b/i.test(trimmed);

    const ctxParts = [];
    const sourcePages = [];
    let pageImage = null;
    if (pageTextRef.current) {
      if (wantsDocScope) {
        try {
          const from = Math.max(1, currentPage - 3);
          const to = Math.min(numPages, currentPage + 15);
          const docSlice = await extractTextForRange(from, to);
          if (docSlice) ctxParts.push(`[Pages ${from}–${to}]\n${docSlice.slice(0, 8000)}`);
        } catch {}
      } else {
        ctxParts.push(`[Current page ${currentPage} — the student is viewing THIS page now]\n${pageTextRef.current.slice(0, 3500)}`);
        // Grounding: non-quiz questions also get the document pages that best
        // match the query, so "what does chapter 3 say about X" has real context.
        if (!isQuizIntent) {
          try {
            const hits = await findRelevantPages(trimmed, currentPage);
            for (const h of hits) {
              ctxParts.push(`[Page ${h.page}]\n${h.excerpt}`);
              sourcePages.push(h.page);
            }
          } catch {}
        }
      }
    } else {
      // Scanned page — no text layer; send the rendered page image instead.
      try { pageImage = await renderPageImage(currentPage); } catch {}
    }

    const contextBlock = ctxParts.length
      ? `\n\nDOCUMENT EXCERPTS:\n${ctxParts.map((c) => `"""\n${c}\n"""`).join("\n")}`
      : pageImage
        ? "\n\nThe current page is attached as an image — this PDF has no text layer, so answer from the image."
        : "";
    // Anchoring fix: history still discusses the earlier page — tell the model
    // the student moved, so "this"/"here"/"this page" bind to the new page.
    const lastUserPage = [...chatMessages].reverse().find((m) => m.role === "user")?.page;
    const navNote = lastUserPage != null && lastUserPage !== currentPage
      ? `\n\nNOTE: The student has scrolled to page ${currentPage} since your last exchange — "this", "here", "this page" now refer to page ${currentPage}, not the earlier discussion.`
      : "";
    const promptWithContext = `${TUTOR_SYSTEM}${contextBlock}${navNote}\n\n---\n\n${trimmed}`;

    try {
      await streamChatAnswer(promptWithContext, pageImage, trimHistory(chatMessages, currentPage), { page: currentPage, sources: sourcePages });
    } catch (err) {
      if (!err.stoppedByUser) setChatError(err.message || "Something went wrong. Try sending that again.");
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

  const retryLastMessage = async () => {
    // Find last user message
    const lastUserIdx = [...chatMessages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = chatMessages.length - 1 - lastUserIdx;
    const lastUserMsg = chatMessages[actualIdx];
    // Remove any error state and re-send
    setChatMessages((prev) => prev.slice(0, actualIdx + 1));
    setChatError(null);
    setChatLoading(true);
    const historyForApi = trimHistory(chatMessages.slice(0, actualIdx), lastUserMsg.page ?? currentPage);
    const msgPage = lastUserMsg.page ?? currentPage;
    let msgText = "";
    try { msgText = await getPageText(msgPage); } catch {}
    const retryCtx = msgText ? `\n\nDOCUMENT EXCERPTS:\n"""\n[Page ${msgPage}]\n${msgText.slice(0, 4000)}\n"""` : "";
    const promptWithContext = `${TUTOR_SYSTEM}${retryCtx}\n\n---\n\n${lastUserMsg.content}`;
    streamChatAnswer(promptWithContext, null, historyForApi, { page: msgPage })
      .catch((err) => {
        if (!err.stoppedByUser) setChatError(err.message || "Something went wrong. Try again.");
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

    setStudyToolsOpen(false);
    closeAllMobileOverlays();
    // Append to the thread like circle-to-ask — the bubble stays compact while
    // the full prompt goes to the model.
    setChatMessages((prev) => [...prev, { role: "user", content: `🔎 "${result.query}"`, page: result.page }]);
    setChatOpen(true);
    setChatLoading(true);
    setChatError(null);
    chatNearBottomRef.current = true;

    try {
      await streamChatAnswer(firstPrompt, null, trimHistory(chatMessages, result.page), { page: result.page });
    } catch (err) {
      if (!err.stoppedByUser) setChatError(err.message || "Something went wrong reaching the AI.");
    } finally {
      setChatLoading(false);
    }
  };

  // ── Selection → AI actions ──
  const askAboutSelection = async (instruction) => {
    const sel = pendingSelRef.current;
    if (!sel || chatLoading) return;
    setSelPop(null);
    window.getSelection()?.removeAllRanges?.();
    const snippet = sel.text.length > 90 ? sel.text.slice(0, 90) + "…" : sel.text;
    setChatMessages((prev) => [...prev, { role: "user", content: `📌 “${snippet}”`, page: sel.page }]);
    setStudyToolsOpen(false);
    closeAllMobileOverlays();
    setChatOpen(true);
    setChatLoading(true);
    setChatError(null);
    chatNearBottomRef.current = true;
    let pageText = "";
    try { pageText = await getPageText(sel.page); } catch {}
    const prompt = `${instruction}\n"""${sel.text}"""\n\n[Selected on page ${sel.page}. Page text for context:\n"""${(pageText || "").slice(0, 1500)}"""\n]`;
    try {
      await streamChatAnswer(prompt, null, trimHistory(chatMessages, sel.page), { page: sel.page });
    } catch (err) {
      if (!err.stoppedByUser) setChatError(err.message || "Something went wrong reaching the AI.");
    } finally {
      setChatLoading(false);
    }
  };

  const speakSelection = () => {
    const sel = pendingSelRef.current;
    if (!sel || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(sel.text);
    utter.rate = 1.0;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    ttsUtterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
    setSelPop(null);
    window.getSelection()?.removeAllRanges?.();
  };

  const copySelection = async () => {
    const sel = pendingSelRef.current;
    if (!sel) return;
    try { await navigator.clipboard.writeText(sel.text); } catch {}
    setSelPop(null);
    window.getSelection()?.removeAllRanges?.();
  };

  // ── Quiz from a selection / highlight / answer ──
  // Routes through the chat's mcq pipeline (same as "Quiz me"): the reply is a
  // batch of interactive cards the student answers in place — score, FSRS
  // recording, and a per-question "add to deck" button are all already there.
  const quizFromText = async (text, page) => {
    const t = (text || "").trim();
    if (!t || chatLoading) return;
    const pg = page ?? currentPage;
    const snippet = t.length > 90 ? t.slice(0, 90) + "…" : t;
    setChatMessages((prev) => [...prev, { role: "user", content: `❓ Quiz me on: “${snippet}”`, page: pg }]);
    setSelPop(null);
    setMarkMenu(null);
    window.getSelection()?.removeAllRanges?.();
    pendingSelRef.current = null;
    setStudyToolsOpen(false);
    closeAllMobileOverlays();
    setChatOpen(true);
    setChatLoading(true);
    setChatError(null);
    chatNearBottomRef.current = true;
    const prompt = `Quiz the student on this passage they selected on page ${pg} of their PDF.

IMPORTANT: answer with a one-line lead-in PLUS 3–5 separate \`\`\`mcq quiz blocks in THIS ONE reply — override the one-question-per-reply rule; do not drip them out one at a time.

Passage:
"""${t.slice(0, 2500)}"""`;
    try {
      await streamChatAnswer(`${TUTOR_SYSTEM}\n\n---\n\n${prompt}`, null, trimHistory(chatMessages, pg), { page: pg });
    } catch (err) {
      if (!err.stoppedByUser) setChatError(err.message || "Something went wrong reaching the AI.");
    } finally {
      setChatLoading(false);
    }
  };
  const genQuizFromSelection = () => {
    const sel = pendingSelRef.current;
    if (!sel) return;
    quizFromText(sel.text, sel.page);
  };

  // ── Define — instant dictionary card for short selections, AI for long ──
  const handleDefine = () => {
    const sel = pendingSelRef.current;
    const word = sel?.text?.trim() || "";
    const short = word && word.split(/\s+/).length <= 3 && word.length <= 40;
    if (!short) {
      askAboutSelection("Define this term precisely and simply, with one concrete example:");
      return;
    }
    const pos = selPop;
    setDefinePop({
      x: pos?.x ?? window.innerWidth / 2,
      y: pos?.y ?? window.innerHeight / 3,
      above: pos?.above ?? false,
      word, loading: true, data: null,
    });
    setSelPop(null);
    window.getSelection()?.removeAllRanges?.();
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setDefinePop((p) => (p ? { ...p, loading: false, data: json } : p)))
      .catch(() => setDefinePop((p) => (p ? { ...p, loading: false, data: null } : p)));
  };

  // ── Selection → flashcard — back carries the passage, front is the prompt ──
  const openCardEdit = () => {
    const sel = pendingSelRef.current;
    if (!sel) return;
    setCardEdit({ front: "", back: sel.text.slice(0, 600), page: sel.page });
    setSelPop(null);
    window.getSelection()?.removeAllRanges?.();
  };
  const saveCard = async () => {
    if (!cardEdit || !propResourceId) return;
    const front = cardEdit.front.trim(), back = cardEdit.back.trim();
    if (!front || !back) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/resources/fsrs/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: propResourceId, front, back, sourcePage: cardEdit.page }),
      });
      if (!res.ok) throw new Error();
      toastDeck("🃏 Card saved — it'll appear in your review deck");
      window.dispatchEvent(new Event("sc-fsrs-rated"));
      setCardEdit(null);
    } catch {
      toastDeck("Couldn't save the card — try again", "error");
    }
  };

  // Add one answered chat-quiz question to the Survival Quiz deck.
  // Chat mcq shape {question, options:[], answer:idx} → app shape {options:{A..}, correct:"A"}.
  const addChatMcqToDeck = async (mcq, page, key) => {
    if (deckAddedKeys[key]) return;
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    if (!authData.authToken) {
      setDeckToast({ type: "error", text: "Sign in to save questions to your deck." });
      setTimeout(() => setDeckToast(null), 3200);
      return;
    }
    const options = Object.fromEntries((mcq.options || []).slice(0, 6).map((o, i) => [QUIZ_LETTERS[i], String(o)]));
    const correct = QUIZ_LETTERS[mcq.answer] || "A";
    try {
      const res = await fetch(`${API_BASE}/api/resources/deck/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.authToken}` },
        body: JSON.stringify({
          sourceResourceId: propResourceId || null,
          sourceTitle: title || "PDF",
          questions: [{ question: mcq.question, options, correct, explanation: mcq.explanation || "", sourcePage: page ?? currentPage }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setDeckAddedKeys((prev) => ({ ...prev, [key]: true }));
      window.dispatchEvent(new CustomEvent("sc-fsrs-rated"));
      setDeckToast({ type: "ok", text: data.added ? "✓ Added to your deck — it'll come up in Survival Quiz." : "Already in your deck." });
      setTimeout(() => setDeckToast(null), 3600);
      saveStored("sc_pdf_deck_hint", true);
      setDeckHintSeen(true);
    } catch (e) {
      setDeckToast({ type: "error", text: e.message || "Couldn't save to deck." });
      setTimeout(() => setDeckToast(null), 3200);
    }
  };

  // ── Offline copy ── keep the fetched bytes so "Save offline" doesn't
  // re-download; IndexedDB fallback opens the doc with no network.
  const pdfBytesRef = useRef(null);
  const [offlineInfo, setOfflineInfo] = useState(null); // null | { size } | "saving"

  useEffect(() => {
    if (!docKey) return;
    let live = true;
    idbGetFile(docKey).then((blob) => {
      if (live && blob) setOfflineInfo({ size: blob.size || blob.byteLength || 0 });
    });
    return () => { live = false; };
  }, [docKey]);

  const toggleOfflineCopy = async () => {
    if (offlineInfo === "saving") return;
    if (offlineInfo) {
      await idbDelFile(docKey);
      setOfflineInfo(null);
      setDeckToast({ type: "ok", text: "Offline copy removed." });
      setTimeout(() => setDeckToast(null), 2600);
      return;
    }
    setOfflineInfo("saving");
    try {
      let bytes = pdfBytesRef.current;
      if (!bytes) bytes = await fetchProxiedPdf(fileUrl);
      await idbPutFile(docKey, new Blob([bytes], { type: "application/pdf" }));
      setOfflineInfo({ size: bytes.byteLength });
      setDeckToast({ type: "ok", text: `✓ Saved offline (${(bytes.byteLength / 1048576).toFixed(1)} MB) — opens without internet.` });
      setTimeout(() => setDeckToast(null), 3200);
    } catch {
      setOfflineInfo(null);
      setDeckToast({ type: "error", text: "Couldn't save offline copy." });
      setTimeout(() => setDeckToast(null), 3000);
    }
  };

  // ---- Thumbnails (lazy via IntersectionObserver) ----
  const [thumbs, setThumbs] = useState([]);
  const thumbItemRefs = useRef([]);
  const thumbRenderQueueRef = useRef([]);
  const thumbRenderingRef = useRef(0);

  // Corner page scrubber — reveals on page turns and while dragging, then
  // auto-hides after a few seconds so it doesn't squat over the page.
  const [scrubVisible, setScrubVisible] = useState(false);
  const scrubTimer = useRef(null);
  const scrubDrag = useRef(null);   // active drag { moved, startY }
  const scrubMoved = useRef(false); // click-guard: true once a real drag happened
  const pokeScrub = useCallback(() => {
    setScrubVisible(true);
    clearTimeout(scrubTimer.current);
    scrubTimer.current = setTimeout(() => setScrubVisible(false), 3000);
  }, []);
  useEffect(() => () => clearTimeout(scrubTimer.current), []);

  // Lazy thumbnail renderer — shared by the side/drawer panels and the
  // bottom scrubber strip; thumbRenderedRef dedupes across containers.
  const renderThumb = useCallback(async (pg) => {
    if (thumbRenderedRef.current.has(pg)) return;
    thumbRenderedRef.current.add(pg);
    try {
      const page = await pdfDocRef.current.getPage(pg);
      const vp = page.getViewport({ scale: 0.24 });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      const dataUrl = c.toDataURL();
      setThumbs((prev) => prev.map((t) => t.page === pg ? { ...t, dataUrl } : t));
    } catch (e) {
      thumbRenderedRef.current.delete(pg);
    }
  }, []);

  // Initialize placeholder thumb entries once the document loads — the
  // bottom scrubber needs them even when the thumbnails panel never opens.
  useEffect(() => {
    if (numPages <= 0 || !pdfDocRef.current) return;
    if (thumbs.length > 0) return;
    const arr = Array.from({ length: pdfDocRef.current.numPages }, (_, i) => ({ page: i + 1, dataUrl: null }));
    setThumbs(arr);
  }, [numPages, thumbs.length]);

  // Lazy render thumbnails when they scroll into view — one observer shared
  // by the panel items and the bottom scrubber items.
  useEffect(() => {
    if (thumbs.length === 0 || !pdfDocRef.current) return;
    if (thumbObserverRef.current) thumbObserverRef.current.disconnect();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pg = parseInt(entry.target.dataset.page, 10);
          renderThumb(pg);
        }
      });
    }, { rootMargin: "100px" });

    thumbObserverRef.current = observer;
    thumbItemRefs.current.forEach((el) => { if (el) observer.observe(el); });

    return () => observer.disconnect();
  }, [thumbs.length, showThumbs, renderThumb]);

  // Page turns reveal the corner scrubber and ensure its thumb is rendered.
  useEffect(() => {
    if (numPages > 1) { pokeScrub(); renderThumb(currentPage); }
  }, [currentPage, numPages, pokeScrub, renderThumb]);

  // Apple-style vertical scrub — drag the floating thumb along the edge and
  // the page follows your finger position on the viewer. Tap opens the panel.
  const onScrubDown = (e) => {
    e.stopPropagation();
    scrubDrag.current = { moved: false, startY: e.clientY };
    scrubMoved.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pokeScrub();
  };
  const onScrubMove = (e) => {
    const d = scrubDrag.current;
    if (!d) return;
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect?.height) return;
    if (!d.moved && Math.abs(e.clientY - d.startY) < 8) return;
    d.moved = true;
    scrubMoved.current = true;
    pokeScrub();
    const frac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const pg = Math.min(numPages, Math.max(1, Math.round(frac * (numPages - 1)) + 1));
    if (pg !== currentPage) goToPage(pg);
  };
  const onScrubEnd = () => { scrubDrag.current = null; };

  // ---- Highlighter / Eraser ----
  const screenToPdf = (p) => ({ x: p.x / scale, y: p.y / scale });
  const pdfToScreen = (p) => ({ x: p.x * scale, y: p.y * scale });

  // True when the page has a rendered text layer (spans) — i.e. selectable.
  // Scanned pages have none until OCR runs, so MARK falls back to freehand.
  const pageHasText = (pg) => !!(textLayerRefs.current[pg]?.childElementCount);
  const overlayEventsFor = (pg) =>
    tool === "none" || (tool === "highlight" && pageHasText(pg)) ? "none" : "auto";

  // Erase gesture — split strokes at contact points and drop marks the
  // cursor touches. Points arrive in PDF coords; radius scales with zoom.
  const applyErase = (pg, pdfPts) => {
    const radius = 10 / scale;
    setAnnotations((prev) => {
      const list = prev[pg] || [];
      if (!list.length) return prev;
      const out = [];
      let changed = false;
      for (const st of list) {
        const runs = eraseSplit(st.points, pdfPts, radius);
        if (runs.length === 1 && runs[0].length === st.points.length) { out.push(st); continue; }
        changed = true;
        for (const r of runs) out.push({ ...st, points: r });
      }
      return changed ? { ...prev, [pg]: out } : prev;
    });
    const eb = pageDimsRef.current[pg] || { width: 1, height: 1 };
    setTextMarks((prev) => {
      const list = prev[pg] || [];
      if (!list.length) return prev;
      const hit = (m) => m.rects.some((r) => pdfPts.some((ep) => {
        const nx = ep.x / eb.width, ny = ep.y / eb.height;
        return nx >= r[0] && nx <= r[2] && ny >= r[1] && ny <= r[3];
      }));
      const kept = list.filter((m) => !hit(m));
      return kept.length === list.length ? prev : { ...prev, [pg]: kept };
    });
  };

  const newStrokeId = () => `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}`;

  const onOverlayDown = (e, pg = currentPage) => {
    if (tool === "none") return;
    // Stylus-only mode: only pen/mouse inks — fingers keep scrolling (palm rejection).
    if (stylusOnly && e.pointerType === "touch") return;
    e.preventDefault();
    // Dismiss the tool picker as soon as ink lands so it never covers the page.
    setAnnotatePopOpen(false);
    // iOS Safari: setPointerCapture can throw InvalidPointerId on SVG elements,
    // and e.target may be a child <path> — capture on the SVG that owns the
    // handlers, and never let a capture failure abort the gesture.
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    drawingGestureRef.current = true;
    drawPageRef.current = pg;
    setDrawPage(pg);
    const p = getRelPoint(e);

    if (tool === "circle") {
      setIsDrawing(true);
      lassoPoints.current = [p];
      setLassoPath(`M ${p.x},${p.y}`);
      // Desktop docked chat stays open — closing it mid-gesture reflows the
      // workspace under the pointer and corrupts the lasso. Mobile sheet still
      // dismisses since it covers the document — hideChat keeps the thread so
      // the new circle appends to the conversation instead of wiping it.
      if (!dockMode) hideChat();
      return;
    }

    if (tool === "line" || tool === "arrow") {
      setIsDrawing(true);
      shapeRef.current = [p, p];
      setShapePreview({ type: tool, a: p, b: p });
      return;
    }

    if (tool === "erase") {
      setIsDrawing(true);
      eraseTrail.current = [p];
      setEraseDot(p);
      applyErase(pg, [screenToPdf(p)]);
      return;
    }

    if (tool === "highlight" || tool === "pen") {
      setIsDrawing(true);
      currentStrokes.current = [{ x: p.x, y: p.y, p: e.pressure || 0.5, v: 0 }];
      if (tool === "pen") setPenPreview(dotPath(p, penWidth / 2));
      else setRenderStrokes(`M ${p.x},${p.y}`);
    }
  };

  const onOverlayMove = (e) => {
    if (!isDrawing) return;
    // iOS Safari delivers fewer pointermove samples than Android — drain the
    // coalesced queue so fast/small circles still get enough fidelity points.
    const evts = e.nativeEvent?.getCoalescedEvents?.() || [e];

    if (tool === "circle") {
      for (const ev of evts) {
        const p = getRelPoint(ev);
        const last = lassoPoints.current[lassoPoints.current.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 3) continue;
        lassoPoints.current.push(p);
      }
      const d = "M " + lassoPoints.current.map((p) => `${p.x},${p.y}`).join(" L ");
      setLassoPath(d);
      return;
    }

    if (tool === "line" || tool === "arrow") {
      const p = getRelPoint(evts[evts.length - 1]);
      if (shapeRef.current) {
        shapeRef.current[1] = p;
        setShapePreview({ type: tool, a: shapeRef.current[0], b: p });
      }
      return;
    }

    if (tool === "erase") {
      const fresh = [];
      for (const ev of evts) {
        const p = getRelPoint(ev);
        const last = eraseTrail.current[eraseTrail.current.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2) continue;
        eraseTrail.current.push(p);
        fresh.push(screenToPdf(p));
      }
      setEraseDot(eraseTrail.current[eraseTrail.current.length - 1]);
      if (fresh.length) applyErase(drawPageRef.current || currentPage, fresh);
      return;
    }

    if (tool === "highlight" || tool === "pen") {
      for (const ev of evts) {
        const p = getRelPoint(ev);
        const last = currentStrokes.current[currentStrokes.current.length - 1];
        const dist = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
        if (last && dist < 2) continue;
        currentStrokes.current.push({ x: p.x, y: p.y, p: ev.pressure || 0.5, v: Math.min(1, dist / 18) });
      }
      if (tool === "pen") setPenPreview(taperedOutline(currentStrokes.current, penWidth) || dotPath(currentStrokes.current[0], penWidth / 2));
      else setRenderStrokes(smoothPath(currentStrokes.current));
    }
  };

  const finishLasso = async (poly, pg) => {
    lassoPoints.current = [];
    setLassoPath("");
    setTool("none");
    setAnnotateTab("none");
    if (poly.length < 3) return;
    // Reject accidental taps — a real circle encloses a real area.
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    if (Math.max(...xs) - Math.min(...xs) < 24 && Math.max(...ys) - Math.min(...ys) < 24) return;
    await analyzeLasso(poly, pg);
  };

  const onOverlayUp = async () => {
    const pg = drawPageRef.current || currentPage;
    drawPageRef.current = null;
    setDrawPage(null);
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "circle") {
      await finishLasso(lassoPoints.current, pg);
      return;
    }

    if (tool === "line" || tool === "arrow") {
      const seg = shapeRef.current;
      shapeRef.current = null;
      setShapePreview(null);
      if (!seg || Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y) < 8) return;
      const stroke = { id: newStrokeId(), type: tool, color: penColor, width: penWidth / scale, points: [screenToPdf(seg[0]), screenToPdf(seg[1])] };
      setAnnotations((prev) => ({ ...prev, [pg]: [...(prev[pg] || []), stroke] }));
      undoStackRef.current.push({ kind: "stroke", page: pg, ref: stroke });
      setUndoCount(undoStackRef.current.length);
      return;
    }

    if (tool === "erase") {
      eraseTrail.current = [];
      setEraseDot(null);
      return;
    }

    if (tool === "highlight" || tool === "pen") {
      const pts = currentStrokes.current;
      currentStrokes.current = [];
      setRenderStrokes("");
      setPenPreview("");
      // Convert to PDF coords, keeping captured pressure/velocity.
      const pdfPts = pts.map((q) => ({ ...screenToPdf(q), p: q.p, v: q.v }));
      if (tool === "pen") {
        // Single tap → dot; a stroke → tapered ink. Renderer decides by point count.
        const stroke = { id: newStrokeId(), color: penColor, width: penWidth / scale, points: pdfPts, type: "pen" };
        setAnnotations((prev) => ({ ...prev, [pg]: [...(prev[pg] || []), stroke] }));
        undoStackRef.current.push({ kind: "stroke", page: pg, ref: stroke });
        setUndoCount(undoStackRef.current.length);
        return;
      }
      // Marker on scanned pages: a wide-thin drag straightens into a clean
      // highlight mark; anything else becomes a freehand multiply-blend stroke.
      const xs = pdfPts.map((p) => p.x), ys = pdfPts.map((p) => p.y);
      const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
      if (bh > 0 && bw / bh > 2.2) {
        const base = pageDimsRef.current[pg] || { width: 1, height: 1 };
        const x0 = Math.max(0, Math.min(...xs) / base.width), y0 = Math.max(0, Math.min(...ys) / base.height);
        const x1 = Math.min(1, Math.max(...xs) / base.width), y1 = Math.min(1, Math.max(...ys) / base.height);
        if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return;
        const mark = {
          id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}`,
          kind: "highlight", color: highlightColor, rects: [[x0, y0, x1, y1]],
          text: "", note: "", createdAt: Date.now(),
        };
        setTextMarks((prev) => ({ ...prev, [pg]: [...(prev[pg] || []), mark] }));
        undoStackRef.current.push({ kind: "mark", page: pg, id: mark.id });
        setUndoCount(undoStackRef.current.length);
        return;
      }
      if (pdfPts.length < 2) return;
      const stroke = { id: newStrokeId(), type: "hl", color: highlightColor, width: highlightWidth / scale, points: pdfPts };
      setAnnotations((prev) => ({ ...prev, [pg]: [...(prev[pg] || []), stroke] }));
      undoStackRef.current.push({ kind: "stroke", page: pg, ref: stroke });
      setUndoCount(undoStackRef.current.length);
    }
  };

  // iOS fires pointercancel aggressively — a resting palm, a second finger, or
  // the OS taking the gesture for scroll/callout. Commit whatever the user
  // managed to draw instead of silently dropping it.
  const onOverlayCancel = async () => {
    const pg = drawPageRef.current || currentPage;
    drawPageRef.current = null;
    setDrawPage(null);
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === "circle") {
      await finishLasso(lassoPoints.current, pg);
      return;
    }
    shapeRef.current = null;
    eraseTrail.current = [];
    currentStrokes.current = [];
    setShapePreview(null);
    setEraseDot(null);
    setRenderStrokes("");
    setPenPreview("");
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
  // Saved stroke → render geometry. Pen strokes become tapered filled
  // outlines (old strokes render tapered too — defaults cover missing p/v).
  const strokeGeom = (stroke, toScreen) => {
    const pts = stroke.points.map((p) => { const s = toScreen(p); return { x: s.x, y: s.y, p: p.p, v: p.v }; });
    const w = stroke.width * scale;
    const type = stroke.type || "hl";
    if (type === "pen") {
      return pts.length < 2
        ? { kind: "fill", d: dotPath(pts[0], Math.max(1.5, w / 2)), color: stroke.color }
        : { kind: "fill", d: taperedOutline(pts, w), color: stroke.color };
    }
    if (type === "line") return { kind: "stroke", d: `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`, color: stroke.color, width: w };
    if (type === "arrow") return { kind: "arrow", d: `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`, head: arrowHeadPath(pts[0], pts[1], w), color: stroke.color, width: w };
    return { kind: "stroke", d: smoothPath(pts), color: stroke.color, width: w, multiply: true };
  };
  const savedAnnotationPaths = (annotations[currentPage] || []).map((stroke, si) => ({ si, ...strokeGeom(stroke, pdfToScreen) }));

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

  // ---- Bookmarks (named: { page, name }) ----
  const toggleBookmark = () => {
    buzz(10);
    setBookmarks((prev) =>
      prev.some((b) => b.page === currentPage)
        ? prev.filter((b) => b.page !== currentPage)
        : [...prev, { page: currentPage, name: "" }].sort((a, b) => a.page - b.page)
    );
  };
  const renameBookmark = (page, name) => {
    setBookmarks((prev) => prev.map((b) => (b.page === page ? { ...b, name } : b)));
    setRenamingPage(null);
  };
  const removeBookmark = (page) => {
    setBookmarks((prev) => prev.filter((b) => b.page !== page));
  };

  // ---- Notes export — real Markdown with highlight text + margin notes ----
  const exportAnnotations = () => {
    const md = buildNotesMarkdown({ title, textMarks, bookmarks, annotations });
    downloadTextFile(`${(title || "pdf").replace(/[^a-z0-9]/gi, "_")}_notes.md`, md);
  };

  // ---- Reading analytics ----
  const [readingStats, setReadingStats] = useState(() => loadStored(`sc_pdf_stats_${docKey}`, {
    pageTimes: {}, // { pageNum: seconds }
    pagesRead: [], // [pageNum, ...]
    sessionStart: Date.now(),
    totalSeconds: 0,
  }));
  const [showStats, setShowStats] = useState(false);

  // Track time on page change
  useEffect(() => {
    const now = Date.now();
    const elapsed = Math.round((now - pageEnterTimeRef.current) / 1000);
    if (elapsed > 0 && elapsed < 600) {
      setReadingStats((prev) => {
        const pt = { ...prev.pageTimes };
        pt[currentPage] = (pt[currentPage] || 0) + elapsed;
        const pr = prev.pagesRead.includes(currentPage) ? prev.pagesRead : [...prev.pagesRead, currentPage];
        const day = new Date().toISOString().slice(0, 10);
        const days = { ...(prev.days || {}) };
        const d = days[day] || { pages: [], sec: 0 };
        if (!d.pages.includes(currentPage)) d.pages = [...d.pages, currentPage];
        d.sec += elapsed;
        days[day] = d;
        const updated = { ...prev, pageTimes: pt, pagesRead: pr, totalSeconds: prev.totalSeconds + elapsed, days };
        saveStored(`sc_pdf_stats_${docKey}`, updated);
        return updated;
      });
    }
    pageEnterTimeRef.current = now;
  }, [currentPage, docKey]);

  // Save analytics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - pageEnterTimeRef.current) / 1000);
      if (elapsed > 0 && elapsed < 600) {
        setReadingStats((prev) => {
          const pt = { ...prev.pageTimes };
          pt[currentPage] = (pt[currentPage] || 0) + elapsed;
          const pr = prev.pagesRead.includes(currentPage) ? prev.pagesRead : [...prev.pagesRead, currentPage];
          const day = new Date().toISOString().slice(0, 10);
          const days = { ...(prev.days || {}) };
          const d = days[day] || { pages: [], sec: 0 };
          if (!d.pages.includes(currentPage)) d.pages = [...d.pages, currentPage];
          d.sec += elapsed;
          days[day] = d;
          const updated = { ...prev, pageTimes: pt, pagesRead: pr, totalSeconds: prev.totalSeconds + elapsed, days };
          saveStored(`sc_pdf_stats_${docKey}`, updated);
          return updated;
        });
        pageEnterTimeRef.current = now;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentPage, docKey]);

  // ---- Touch: gallery-style pinch-zoom + pan + swipe navigation + double-tap ----
  // Strategy: persistent CSS transform on the zoomable content wrapper.
  // Pinch zooms in/out, single-finger drag pans when zoomed. No PDF re-render.
  const showZoomBadge = () => {
    setShowZoomIndicator(true);
    if (zoomIndicatorTimerRef.current) clearTimeout(zoomIndicatorTimerRef.current);
    zoomIndicatorTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1200);
  };

  const onTouchStartViewer = (e) => {
    // A lasso/pen stroke is in progress — ignore extra touches (resting palm,
    // second finger) so they can't start pinch tracking or corrupt the path.
    if (lassoPoints.current.length || currentStrokes.current.length) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartPanZoomRef.current = { ...panZoomRef.current };
      pinchStartScaleRef.current = scale;
      pinchMidRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      // transform-origin is 0 0, so screen = layoutOrigin + t + s·point.
      // Capture the wrapper's untransformed origin + the content point under
      // the midpoint — the move handler keeps that point pinned to the fingers.
      const t0 = panZoomRef.current;
      const wr = panZoomContentRef.current?.getBoundingClientRect();
      const ox = wr ? wr.left - t0.x : 0;
      const oy = wr ? wr.top - t0.y : 0;
      pinchLayoutOriginRef.current = { x: ox, y: oy };
      pinchContentRef.current = {
        x: (pinchMidRef.current.x - ox) / (t0.scale || 1),
        y: (pinchMidRef.current.y - oy) / (t0.scale || 1),
      };
      pinchActiveRef.current = true;
      setPinchActive(true);
    } else if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      // Fresh touch — clear any stale flag from an interrupted prior gesture;
      // onOverlayDown re-arms it if this touch becomes a draw gesture.
      drawingGestureRef.current = false;
      // Allow panning when zoomed in (paged modes; continuous uses native scroll)
      if (panZoomRef.current.scale > 1 && tool === "none" && (scrollMode === "single" || scrollMode === "book")) {
        panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStartOffsetRef.current = { x: panZoomRef.current.x, y: panZoomRef.current.y };
        setIsPanning(true);
      }
    }
  };

  const onTouchMoveViewer = (e) => {
    // Draw/lasso in progress — block native scroll so iOS Safari can't steal
    // the gesture (its touch-action support inside scrollers is unreliable).
    if (lassoPoints.current.length || currentStrokes.current.length) {
      e.preventDefault();
      return;
    }
    if (e.touches.length === 2 && pinchActiveRef.current && pinchStartDistRef.current > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDistRef.current;
      // Track the live midpoint so the commit anchors where the fingers actually are
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchMidRef.current = { x: midX, y: midY };
      const startScale = pinchStartScaleRef.current || 1;
      const s0 = pinchStartPanZoomRef.current.scale || 1;
      // Clamp the preview so the committed scale can never exceed the real zoom
      // range (0.5–2.6) — no snap-back on release, identical for all scroll modes
      const s = Math.max(0.5 / startScale, Math.min(2.6 / startScale, s0 * ratio));
      // Keep the content point captured at pinch start pinned under the live
      // midpoint: screen = layoutOrigin + t + s·point  →  t = M − O − s·C0
      const O = pinchLayoutOriginRef.current;
      const C0 = pinchContentRef.current;
      applyPanZoom({
        scale: s,
        x: midX - O.x - s * C0.x,
        y: midY - O.y - s * C0.y,
      });
      showZoomBadge();
    } else if (e.touches.length === 1 && isPanning && panZoomRef.current.scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      applyPanZoom({
        scale: panZoomRef.current.scale,
        x: panStartOffsetRef.current.x + dx,
        y: panStartOffsetRef.current.y + dy,
      });
    }
  };

  const onTouchEndViewer = (e) => {
    if (pinchActiveRef.current) {
      pinchActiveRef.current = false;
      setPinchActive(false);
      pinchStartDistRef.current = 0;
      // Commit the CSS preview into a real re-render so text re-sharpens
      const commitScale = Math.max(0.5, Math.min(2.6, pinchStartScaleRef.current * panZoomRef.current.scale));
      const mid = pinchMidRef.current;
      const fit = fitScaleRef.current;
      // Anchor on the page under the pinch midpoint BEFORE clearing the preview
      // transform — the fraction is transform-invariant so it lands correctly.
      const anchor = scrollMode !== "single" && mid ? capturePageAnchor(mid.x, mid.y) : null;
      resetPanZoom();
      if (fit && commitScale <= fit + 0.02) {
        // Pinched back out to fit width — restore the fitted layout
        setUserZoomed(false);
        fitToWidth().then((s) => { if (s && (scrollMode === "single" || scrollMode === "book")) renderCurrent(s); });
      } else if (Math.abs(commitScale - scale) > 0.01) {
        if (mid) {
          commitZoomAtPoint(commitScale, mid.x, mid.y, anchor);
        } else {
          setUserZoomed(true);
          setScale(commitScale);
        }
      }
      showZoomBadge();
      return;
    }
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (e.changedTouches.length === 1) {
      // This touch was a draw/lasso gesture — it already completed via the
      // pointerup path; a second swipe/double-tap must not fire on release.
      // The flag is cleared on the NEXT touchstart so every finger that
      // lifted within this gesture (drawing finger, palm, second finger)
      // bails — a palm touchend can't un-swallow the drawing finger's.
      if (drawingGestureRef.current || tool !== "none") return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      // Double-tap: reset zoom or zoom in (only when no tool active)
      const now = Date.now();
      if (dist < 10 && now - lastTapRef.current < 300 && tool === "none") {
        lastTapRef.current = 0;
        if (userZoomed) {
          // Zoomed in — double-tap returns to fit
          setUserZoomed(false);
          resetPanZoom();
          fitToWidth().then((s) => { if (s && (scrollMode === "single" || scrollMode === "book")) renderCurrent(s); });
        } else {
          commitZoomAtPoint(Math.min(2.6, scale * 2), t.clientX, t.clientY);
        }
        showZoomBadge();
        return;
      }
      lastTapRef.current = now;
      // Swipe navigation (paged modes only, and only when not zoomed —
      // when zoomed the drag pans natively via the scroll container)
      if ((scrollMode === "single" || scrollMode === "book") && !userZoomed && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) stepPage(-1);
        else stepPage(1);
      }
    }
  };

  // ---- Ctrl+wheel / trackpad pinch zoom (desktop) ----
  // Attached natively with { passive: false } — React's onWheel is passive, so
  // preventDefault() there would be a no-op and the browser would zoom the page.
  const onWheelViewer = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.5, Math.min(2.6, scale * delta));
    commitZoomAtPoint(newScale, e.clientX, e.clientY);
    showZoomBadge();
  };

  // Safari gesture events (iOS pinch + desktop trackpad pinch). preventDefault
  // always blocks native zoom; on iOS the touch pipeline owns the gesture so the
  // gesture handlers only drive zoom when no touch pinch is active (desktop).
  const onGestureStartViewer = () => {
    if (pinchActiveRef.current) return;
    gestureDrivenRef.current = true;
    pinchStartScaleRef.current = scale;
    pinchStartPanZoomRef.current = { ...panZoomRef.current };
    // Anchor the zoom at the viewer center using the same origin-0 math as pinch
    const t0 = panZoomRef.current;
    const wr = panZoomContentRef.current?.getBoundingClientRect();
    const ox = wr ? wr.left - t0.x : 0;
    const oy = wr ? wr.top - t0.y : 0;
    pinchLayoutOriginRef.current = { x: ox, y: oy };
    const vr = viewerRef.current?.getBoundingClientRect();
    const cx = vr ? vr.left + vr.width / 2 : 0;
    const cy = vr ? vr.top + vr.height / 2 : 0;
    pinchMidRef.current = { x: cx, y: cy };
    pinchContentRef.current = {
      x: (cx - ox) / (t0.scale || 1),
      y: (cy - oy) / (t0.scale || 1),
    };
    setPinchActive(true);
  };

  const onGestureChangeViewer = (e) => {
    if (!gestureDrivenRef.current) return;
    const startScale = pinchStartScaleRef.current || 1;
    const s0 = pinchStartPanZoomRef.current.scale || 1;
    const s = Math.max(0.5 / startScale, Math.min(2.6 / startScale, s0 * e.scale));
    const O = pinchLayoutOriginRef.current;
    const C0 = pinchContentRef.current;
    const M = pinchMidRef.current;
    applyPanZoom({ scale: s, x: M.x - O.x - s * C0.x, y: M.y - O.y - s * C0.y });
    showZoomBadge();
  };

  const onGestureEndViewer = () => {
    if (!gestureDrivenRef.current) return;
    gestureDrivenRef.current = false;
    setPinchActive(false);
    const commitScale = Math.max(0.5, Math.min(2.6, pinchStartScaleRef.current * panZoomRef.current.scale));
    const container = viewerRef.current;
    const rect = container?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : 0;
    const cy = rect ? rect.top + rect.height / 2 : 0;
    // Capture anchor before clearing the preview transform
    const anchor = scrollMode !== "single" ? capturePageAnchor(cx, cy) : null;
    resetPanZoom();
    if (Math.abs(commitScale - scale) > 0.01) {
      if (container) {
        commitZoomAtPoint(commitScale, cx, cy, anchor);
      } else {
        setUserZoomed(true);
        setScale(commitScale);
      }
    }
  };

  // React registers onTouchMove/onWheel as passive root listeners, making
  // preventDefault() a silent no-op. Bind non-passive listeners on the viewer
  // instead so pinch/pan don't fight native scrolling, and block iOS Safari's
  // native pinch-zoom (gesturestart) so it can't double-zoom over our transform.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const onMove = (e) => liveHandlersRef.current.onTouchMoveViewer?.(e);
    const onWheel = (e) => liveHandlersRef.current.onWheelViewer?.(e);
    const onGestureStart = (e) => { e.preventDefault(); liveHandlersRef.current.onGestureStartViewer?.(); };
    const onGestureChange = (e) => { e.preventDefault(); liveHandlersRef.current.onGestureChangeViewer?.(e); };
    const onGestureEnd = (e) => { e.preventDefault(); liveHandlersRef.current.onGestureEndViewer?.(); };
    viewer.addEventListener("touchmove", onMove, { passive: false });
    viewer.addEventListener("wheel", onWheel, { passive: false });
    viewer.addEventListener("gesturestart", onGestureStart);
    viewer.addEventListener("gesturechange", onGestureChange);
    viewer.addEventListener("gestureend", onGestureEnd);
    return () => {
      viewer.removeEventListener("touchmove", onMove);
      viewer.removeEventListener("wheel", onWheel);
      viewer.removeEventListener("gesturestart", onGestureStart);
      viewer.removeEventListener("gesturechange", onGestureChange);
      viewer.removeEventListener("gestureend", onGestureEnd);
    };
  }, []);

  // Keep the native listeners pointed at fresh handler closures
  useEffect(() => {
    liveHandlersRef.current = { onTouchMoveViewer, onWheelViewer, onGestureStartViewer, onGestureChangeViewer, onGestureEndViewer };
  });

  // ---- Tool toggle helper ----
  const toggleTool = (t) => {
    setSelPop(null); // arming a tool clears any open selection popover/pending paint
    setAskNudge(false);
    buzz(10);
    setTool((prev) => {
      const next = prev === t ? "none" : t;
      // Book mode is read-only — no per-page ink overlay on the spread.
      // Activating a pen/highlight/lasso tool switches back to single page.
      if (next !== "none" && scrollMode === "book") setScrollMode("single");
      if (next === "none") {
        setLassoPath("");
        setRenderStrokes("");
        setPenPreview("");
        setShapePreview(null);
        setEraseDot(null);
        lassoPoints.current = [];
        currentStrokes.current = [];
        shapeRef.current = null;
        eraseTrail.current = [];
        if (prev === "circle" && !dockMode) hideChat(); // docked chat persists — dismiss via ✕
      }
      setAnnotateTab(next);
      return next;
    });
  };

  // Undo the most recent annotation/mark (dock ↩ + Ctrl/Cmd-Z).
  const undoLast = () => {
    const item = undoStackRef.current.pop();
    if (!item) return;
    if (item.kind === "mark") removeMark(item.page, item.id);
    else setAnnotations((prev) => ({ ...prev, [item.page]: (prev[item.page] || []).filter((s) => s !== item.ref && s.id !== item.id) }));
    setUndoCount(undoStackRef.current.length);
    buzz(8);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (!undoStackRef.current.length) return;
      e.preventDefault();
      undoLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Annotate popover: select a tab (pen / highlight / erase) ----
  const selectAnnotateTab = (tab) => {
    if (annotateTab === tab) {
      // Tapping the already-active tab disarms it
      toggleTool(tab);
    } else {
      toggleTool(tab);
    }
  };

  // ---- Immersive read: chrome auto-hides on scroll-down, returns on
  // scroll-up (or the existing center-tap). Only fires while scrolling —
  // single/book modes don't scroll vertically so they're unaffected.
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    let last = v.scrollTop;
    const onScroll = () => {
      const t = v.scrollTop;
      const dy = t - last;
      last = t;
      // On desktop the study panel is a docked side panel, not an overlay —
      // chrome may hide while scrolling but the panel must stay put.
      if (dy > 6 && t > 80) { setChromeHidden(true); if (isMobile) closeAllMobileOverlays(); }
      else if (dy < -6 && !focusPinRef.current) setChromeHidden(false);
    };
    v.addEventListener("scroll", onScroll, { passive: true });
    return () => v.removeEventListener("scroll", onScroll);
  }, [loading, isMobile]);

  // ---- Close all mobile overlays (mutual exclusion) ----
  const closeAllMobileOverlays = () => {
    setAnnotatePopOpen(false);
    setShowOverflow(false);
    setOverflowBackdropOpen(false);
    setStudyToolsOpen(false);
    if (voiceActive) setVoiceMinimized(true);
  };

  // ── Kindle-style tap zones ── center tap toggles chrome, edge taps turn
  // pages in the paged modes. Ignores drags, selections, mark taps and any
  // active tool/zoom state. Touch taps defer 280ms so the existing
  // double-tap-to-zoom gesture always wins.
  const tapStartRef = useRef(null);
  const tapActionRef = useRef(null);
  const onViewerPointerDown = (e) => {
    tapStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onViewerTap = (e) => {
    if (e.detail > 1) { clearTimeout(tapActionRef.current); return; } // double-click — the zoom gesture owns it
    if (tool !== "none" || pinchActive || panZoom.scale !== 1) return;
    if (e.target.closest("[data-mark], button, a, input, textarea, select, [role='button']")) return;
    if (window.getSelection && !window.getSelection().isCollapsed) return;
    // No DOM selection to collapse on touch (we cleared it) — a tap dismisses
    // the action popover instead of toggling chrome.
    if (selPop) { setSelPop(null); pendingSelRef.current = null; suppressSelClearRef.current = false; return; }
    const st = tapStartRef.current;
    tapStartRef.current = null;
    if (st && (Math.abs(e.clientX - st.x) > 10 || Math.abs(e.clientY - st.y) > 10 || Date.now() - st.t > 600)) return;
    const rect = viewerRef.current?.getBoundingClientRect();
    const w = rect?.width || window.innerWidth;
    const x = ((e.clientX - (rect?.left || 0)) / w);
    const act = () => {
      if (x < 0.2) {
        if (scrollMode !== "vertical") stepPage(-1);
      } else if (x > 0.8) {
        if (scrollMode !== "vertical") stepPage(1);
      } else {
        setChromeHidden((v) => !v);
        closeAllMobileOverlays();
      }
    };
    clearTimeout(tapActionRef.current);
    tapActionRef.current = setTimeout(act, e.pointerType === "touch" ? 280 : 0);
  };

  // ── Presentation mode ── fullscreen + single page + hidden chrome; edge
  // taps/arrow keys advance. Esc (existing fullscreen exit) restores chrome.
  const presentationRef = useRef(false);
  const enterPresentation = () => {
    presentationRef.current = true;
    // resetPanZoom must run explicitly: if the user is already in single mode,
    // setScrollMode no-ops, the scrollMode effect never fires, and a stale
    // pinch-zoom/translate would shrink the page into the corner.
    resetPanZoom();
    setScrollMode("single");
    setChromeHidden(true);
    closeAllMobileOverlays();
    setFullscreen(true);
  };
  useEffect(() => {
    if (!fullscreen && presentationRef.current) {
      presentationRef.current = false;
      setChromeHidden(false);
    }
  }, [fullscreen]);

  // ---- Theme persistence ----
  useEffect(() => { saveStored("sc_pdf_theme", themePref); }, [themePref]);
  useEffect(() => { saveStored("sc_pdf_bright", readerBrightness); }, [readerBrightness]);

  // ---- Annotation persistence (debounced) ----
  useEffect(() => {
    const t = setTimeout(() => saveStored(`sc_pdf_annots_${docKey}`, annotations), 500);
    return () => clearTimeout(t);
  }, [annotations, docKey]);

  // ---- Bookmark persistence ----
  useEffect(() => { saveStored(`sc_pdf_bookmarks_${docKey}`, bookmarks); }, [bookmarks, docKey]);

  // ---- Scroll mode persistence ----
  useEffect(() => { saveStored(`sc_pdf_scrollmode_${docKey}`, scrollMode); }, [scrollMode, docKey]);

  // ── Server sync ─────────────────────────────────────────────────────────
  // Hydrate once per document (union-merge so offline edits never get lost),
  // then debounce-push local changes. localStorage stays the instant cache;
  // the server row makes the state follow the account across devices.
  const syncHydratedRef = useRef(false);
  const syncTimerRef = useRef(null);

  useEffect(() => {
    if (syncHydratedRef.current || loading || !fileUrl) return;
    let authData;
    try { authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}"); } catch { authData = {}; }
    if (!authData.authToken) { syncHydratedRef.current = true; return; }
    let cancelled = false;
    fetch(`${API_BASE}/api/resources/reader-state/${encodeURIComponent(docKey)}`, {
      headers: { Authorization: `Bearer ${authData.authToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const st = data?.state;
        if (st) {
          if (st.annotations) setAnnotations((local) => mergePageArrays(st.annotations, local));
          if (st.marks) setTextMarks((local) => mergePageArrays(st.marks, local));
          if (Array.isArray(st.bookmarks) && st.bookmarks.length) setBookmarks((local) => mergeBookmarkList(st.bookmarks, local));
          if (st.stats) setReadingStats((local) => mergeReaderStats(st.stats, local));
          if (Array.isArray(st.chat) && st.chat.length) {
            setChatMessages((local) => (local.length >= st.chat.length ? local : st.chat));
          }
          // Resume point: server wins only when it's ahead of local, and an
          // explicit initialPage deep link always beats the stored position.
          if (st.lastPage && !initialPage) {
            const localLast = loadStored(`sc_pdf_lastpage_${docKey}`, null) || 0;
            if (st.lastPage > localLast) {
              saveStored(`sc_pdf_lastpage_${docKey}`, st.lastPage);
              goToPage(st.lastPage);
            }
          }
          // Scroll mode is a device preference — inherit only while untouched
          if (st.scrollMode && st.scrollMode !== "vertical") {
            setScrollMode((local) => (local === "vertical" ? st.scrollMode : local));
          }
        }
        syncHydratedRef.current = true;
      })
      .catch(() => { syncHydratedRef.current = true; });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, docKey, fileUrl]);

  // Push local changes — whole-state upsert, debounced. Skips until the
  // hydrate completes so a cold cache can't clobber the server copy.
  useEffect(() => {
    if (!syncHydratedRef.current || loading || !fileUrl) return;
    let authData;
    try { authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}"); } catch { authData = {}; }
    if (!authData.authToken) return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const chat = chatMessages
        .filter((m) => !m.streaming)
        .slice(-60)
        .map((m) => ({ role: m.role, content: m.content, page: m.page }));
      fetch(`${API_BASE}/api/resources/reader-state/${encodeURIComponent(docKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.authToken}` },
        body: JSON.stringify({
          resourceId: propResourceId || null,
          lastPage: currentPage,
          scrollMode,
          annotations,
          marks: textMarks,
          bookmarks,
          stats: {
            pageTimes: readingStats.pageTimes,
            pagesRead: readingStats.pagesRead,
            totalSeconds: readingStats.totalSeconds,
          },
          chat,
        }),
      }).catch(() => {});
    }, 2500);
    return () => clearTimeout(syncTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, textMarks, bookmarks, scrollMode, readingStats, chatMessages, currentPage, docKey, loading, fileUrl]);

  // ---- Re-render when scrollMode changes ----
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;
    resetPanZoom();
    if (scrollMode === "single" || scrollMode === "book") {
      if (scrollMode === "book") {
        // Snap to the spread's left page before fitting/rendering
        const left = currentPage - ((currentPage - 1) % 2);
        if (left !== currentPage) setCurrentPage(left);
        fitToWidth().then((s) => renderSpread(left, s));
      } else {
        fitToWidth().then((s) => renderPage(currentPage, s));
      }
    } else {
      // Reset canvas render flags and seed visible pages with current page
      pageCanvasRefs.current.forEach((c) => { if (c) delete c.dataset.rendered; });
      setVisiblePages(new Set([currentPage]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollMode]);

  // ---- IntersectionObserver for continuous scroll mode ----
  useEffect(() => {
    if (scrollMode === "single" || scrollMode === "book" || !pdfDocRef.current) {
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
        // Ratio relative to the VIEWER, not the page — a page taller than the
        // viewport can never reach a high page-relative ratio, which left
        // partially visible neighbours "invisible" (no render window, no circle).
        const rb = entry.rootBounds;
        const ir = entry.intersectionRect;
        const vr = entry.isIntersecting
          ? (scrollMode === "horizontal"
            ? ir.width / (rb?.width || 1)
            : ir.height / (rb?.height || 1))
          : 0;
        // Persist per-page ratios — entries only include pages whose
        // intersection changed, so the incumbent's ratio must come from the map.
        pageVrRef.current.set(pg, vr);
        if (vr >= 0.1) {
          newVisible.add(pg);
          if (vr > maxRatio) {
            maxRatio = vr;
            mostVisiblePage = pg;
          }
        }
      });
      if (newVisible.size > 0) {
        setVisiblePages((prev) => new Set([...prev, ...newVisible]));
        // Most-visible wins — no fixed 0.5 gate, which froze currentPage when
        // several pages shared the viewport (zoomed out, short/landscape pages,
        // boundary scroll) and left AI chat context pages behind. 8% hysteresis
        // stops flip-flopping while parked on a page boundary.
        const incumbentVr = pageVrRef.current.get(currentPage) || 0;
        if (mostVisiblePage !== currentPage && maxRatio >= incumbentVr + 0.08) {
          setCurrentPage(mostVisiblePage);
        }
      }
    }, { root: viewerRef.current, threshold: Array.from({ length: 21 }, (_, i) => i / 20) });

    observerRef.current = observer;

    // Observe all page items
    pageItemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [scrollMode, numPages, currentPage]);

  // ---- Mobile detection ----
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 640);
      setDockW(w >= 1200 ? 400 : w >= 900 ? 340 : 0);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ---- Resume reading — auto-navigate to last page ----
  // Explicit initialPage deep links (?page=N, provenance chips) always win.
  useEffect(() => {
    if (loading || initialPage) return;
    const saved = loadStored(`sc_pdf_lastpage_${docKey}`, null);
    if (!saved || saved <= 1 || !pdfDocRef.current) return;
    const clamped = Math.min(saved, pdfDocRef.current.numPages);
    // Book mode restores to the spread containing the saved page
    const target = scrollMode === "book" ? clamped - ((clamped - 1) % 2) : clamped;
    if (target === currentPage) return;
    setCurrentPage(target);
    if (scrollMode === "single") {
      renderPage(target);
    } else if (scrollMode === "book") {
      renderSpread(target);
    } else {
      // In continuous mode, wait for page placeholders to render, then scroll
      setTimeout(() => {
        const el = pageItemRefs.current[target - 1];
        if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
      }, 300);
    }
  }, [docKey, loading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ---- Hide bottom nav while fullscreen (portal lifts us above it too;
  //      this flag covers any other overlay rendered inside #root) ----
  useEffect(() => {
    if (!fullscreen) return;
    setMobileNavHidden(true);
    return () => setMobileNavHidden(false);
  }, [fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Styles ----
  const s = buildStyles({ T, isMobile, theme, scrollMode, showThumbs, tool, circleMode, chatOpen, chatExpanded, dockMode, dockW, userZoomed, pinchActive, fullscreen, showSearch, annotatePopOpen, studyToolsOpen });

  const filteredThumbs = thumbs.filter((t) => {
    if (pageFilter === "all") return true;
    if (pageFilter === "bookmarked") return bookmarks.some((b) => b.page === t.page);
    if (pageFilter === "highlighted") return annotations[t.page]?.length > 0;
    return true;
  });

  // Page the thread is grounded in — the last message's context page, not the
  // live scroll position (you can read p.12 while the thread is about p.5).
  const chatCtxPage = [...chatMessages].reverse().find((m) => m.page != null)?.page ?? currentPage;

  // Parsed assistant segments (text + mcq + mcq_error), question numbering,
  // and running quiz score — shared by the thread renderer.
  const chatSegs = useMemo(
    () => chatMessages.map((m) => (m.role === "assistant" ? parseMcqSegments(m.content) : null)),
    [chatMessages]
  );
  const mcqPrefix = useMemo(() => {
    const pre = [0];
    chatSegs.forEach((segs, i) => {
      pre[i + 1] = pre[i] + (segs ? segs.filter((s) => s.type === "mcq").length : 0);
    });
    return pre;
  }, [chatSegs]);
  const quizStats = useMemo(() => {
    const vals = Object.values(quizResults);
    return { answered: vals.length, correct: vals.filter((v) => v.correct).length };
  }, [quizResults]);

  // Contextual chips: quiz answered → next-question prompts; quiz waiting →
  // hide chips until the card is answered; otherwise the standard helpers.
  const lastAssistantIdx = chatMessages.length - 1 - [...chatMessages].reverse().findIndex((m) => m.role === "assistant");
  const lastMcqState = (() => {
    if (lastAssistantIdx !== chatMessages.length - 1 || lastAssistantIdx < 0) return "none";
    const segs = chatSegs[lastAssistantIdx] || [];
    const mcqSegIdxs = segs.map((sg, j) => (sg.type === "mcq" ? j : -1)).filter((j) => j >= 0);
    if (!mcqSegIdxs.length) return "none";
    return mcqSegIdxs.every((j) => quizResults[`${lastAssistantIdx}:${j}`]) ? "answered" : "open";
  })();
  const chipsToShow = chatMessages.length === 0 ? STARTER_CHIPS
    : lastMcqState === "answered" ? QUIZ_NEXT_CHIPS
    : lastMcqState === "open" ? []
    : SMART_CHIPS;
  const showChips = chatMessages.length > 0 && chipsToShow.length > 0 &&
    chatMessages[chatMessages.length - 1]?.role === "assistant" && !chatLoading;

  // Turns an AI answer into an interactive quiz — same chat mcq cards as the
  // selection quiz. (FSRS + optional deck add live on the cards themselves.)
  const saveAsQuiz = (msg, key) => {
    const text = plainTextOf(msg).slice(0, 1200);
    if (!text) return;
    setSavedFlashIdx(key);
    setTimeout(() => setSavedFlashIdx((v) => (v === key ? null : v)), 2500);
    quizFromText(text, msg.page ?? currentPage);
  };

  // Kindle-style progress line under the title — plus a real ETA once the
  // reader has enough session data (avg seconds/page from readingStats).
  const progressPct = numPages ? Math.min(100, Math.round((currentPage / numPages) * 100)) : 0;
  const readPages = readingStats.pagesRead?.length || 0;
  const avgSecPerPage = readPages >= 3 ? readingStats.totalSeconds / readPages : 0;
  const etaMin = avgSecPerPage > 5 ? Math.max(1, Math.round(((numPages - currentPage) * avgSecPerPage) / 60)) : null;
  const progressLine = numPages
    ? `Page ${currentPage} of ${numPages} · ${progressPct}%${etaMin ? ` · ~${etaMin} min left` : ""}`
    : "";
  const todayStats = readingStats.days?.[new Date().toISOString().slice(0, 10)];
  const todayLine = todayStats && todayStats.sec >= 30
    ? ` · today ${todayStats.pages.length}p ${Math.round(todayStats.sec / 60)}m`
    : "";

  const reader = (
    <div style={s.container}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translate3d(0, 100%, 0); } to { transform: translate3d(0, 0, 0); } }
        @keyframes sheetUp { from { transform: translate3d(0, 32px, 0); opacity: 0.4; } to { transform: translate3d(0, 0, 0); opacity: 1; } }
        @keyframes slideExitLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-60px); opacity: 0; } }
        @keyframes slideExitRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(60px); opacity: 0; } }
        @keyframes slideEnterRight { from { transform: translateX(60px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideEnterLeft { from { transform: translateX(-60px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeExit { from { opacity: 1; } to { opacity: 0; } }
        @keyframes fadeEnter { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sc-cursor-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes sc-msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sc-fade-in-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sc-q-in-r { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes sc-q-in-l { from { opacity: 0; transform: translateX(-22px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes sc-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes sc-card-enter { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes sc-ring-fill { from { stroke-dashoffset: var(--ring-circ, 283); } to { stroke-dashoffset: var(--ring-offset, 0); } }
        .sc-fade-in-up { animation: sc-fade-in-up 0.35s cubic-bezier(0.4,0,0.2,1) forwards; }
        .sc-toolbar-btns button { transition: transform .12s ease, filter .15s ease; }
        .sc-toolbar-btns button:hover { filter: brightness(1.3); }
        .sc-toolbar-btns button:active { transform: scale(.9); }
        @keyframes sc-comet { 0%, 100% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes sc-orb-pulse { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.12); filter: brightness(1.15); } }
        @keyframes sc-dot-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.35; } 30% { transform: translateY(-4px); opacity: 1; } }
        .sc-typing i { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: sc-dot-bounce 1.1s ease-in-out infinite; }
        .sc-typing i:nth-child(2) { animation-delay: 0.15s; }
        .sc-typing i:nth-child(3) { animation-delay: 0.3s; }
        .sc-chips-row button { animation: sc-fade-in-up 0.3s ease both; }
        .sc-chips-row button:nth-child(2) { animation-delay: 0.06s; }
        .sc-chips-row button:nth-child(3) { animation-delay: 0.12s; }
        .sc-chips-row button:nth-child(4) { animation-delay: 0.18s; }
        .sc-chips-row button:hover, .sc-msg-actions button:hover { border-color: rgba(245,166,35,0.5); color: #b07a10; }
        .sc-msg-actions button { animation: sc-fade-in-up 0.3s ease both; }
        .sc-msg-actions button:nth-child(2) { animation-delay: 0.05s; }
        .sc-msg-actions button:nth-child(3) { animation-delay: 0.1s; }
        .sc-chat-input:focus { border-color: rgba(245,166,35,0.6) !important; box-shadow: 0 0 0 3px rgba(245,166,35,0.15); }
        .sc-welcome-card:hover { border-color: rgba(245,166,35,0.55); transform: translateY(-1px); }
        .sc-welcome-card:active { transform: scale(0.97); }
        @keyframes sc-landing-pulse { 0% { box-shadow: 0 0 0 0 rgba(245,166,35,.65); } 100% { box-shadow: 0 0 0 14px rgba(245,166,35,0); } }
        .sc-pulse-once { animation: sc-landing-pulse .85s ease-out; }
        .sc-card-enter { animation: sc-card-enter 0.3s cubic-bezier(0.4,0,0.2,1) forwards; }
        .sc-chips-row::-webkit-scrollbar { display: none; }
        .sc-shimmer-bar::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, var(--app-tint-strong), transparent);
          background-size: 200% 100%; animation: sc-shimmer 2s infinite;
        }
        /* Study-tools cards — lift + glow on hover (desktop) */
        .sc-tool-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
        .sc-tool-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.18); border-color: rgba(245,166,35,0.4) !important; }
        .sc-tool-card:active { transform: translateY(0); }
        @keyframes sc-confetti-fall {
          0% { transform: translate3d(0,-12vh,0) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate3d(var(--cx,0),110vh,0) rotate(var(--cr,720deg)); opacity: 0; }
        }
        @keyframes sc-rank-pop {
          0% { transform: scale(0.6) translateY(14px); opacity: 0; }
          60% { transform: scale(1.05) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes sc-rank-shine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .page-anim-exit-next { animation: slideExitLeft 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-exit-prev { animation: slideExitRight 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-enter-next { animation: slideEnterRight 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-enter-prev { animation: slideEnterLeft 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-anim-fade-exit { animation: fadeExit 0.15s ease forwards; }
        .page-anim-fade-enter { animation: fadeEnter 0.2s ease forwards; }
        [data-text-layer] ::selection { background: rgba(194,59,59,0.3); }
        [data-text-layer] span { line-height: 1; }
      `}</style>

      {/* Toolbar + Progress — absolute overlay that slides off; the viewer
          underneath never reflows, so there's no content jump. transform is
          "none" while visible so fixed-position children keep viewport anchoring. */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 50,
        transform: chromeHidden ? "translateY(-105%)" : "none",
        transition: "transform 0.24s ease",
      }}>
      <div style={s.toolbar}>
        {/* Slim reading progress — pinned to the toolbar's bottom edge */}
        {numPages > 0 && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, pointerEvents: "none", zIndex: 1 }}>
            <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, (currentPage / numPages) * 100))}%`, background: "linear-gradient(90deg, #F5A623, #E8963C)", borderRadius: 1, transition: "width 0.2s ease" }} />
          </div>
        )}
        {isMobile ? (
          <>
            {/* Mobile single-row toolbar */}
            <div style={s.toolbarRow} className="sc-toolbar-btns">
              {onBack && (
                <button style={{ ...s.iconBtn, color: T.muted, flexShrink: 0, marginRight: 2 }} onClick={onBack} title="Back" aria-label="Back">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
              )}
              <div style={s.docTitleBlock}>
                <span style={s.docTitle}>{title || "PDF"}</span>
                <button
                  style={{ ...s.docSubtitle, display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${T.border}`, borderRadius: 9, padding: "2px 7px", cursor: "pointer", alignSelf: "flex-start" }}
                  onClick={() => setPageJumpOpen(true)}
                  title="Jump to page"
                >
                  <ProgressRing pct={progressPct} />
                  {progressLine}
                </button>
              </div>
              {/* Annotate button */}
              <button
                style={{
                  ...s.iconBtn,
                  color: (tool === "highlight" || tool === "pen" || tool === "erase") ? CHROME.blue : T.muted,
                  background: (tool === "highlight" || tool === "pen" || tool === "erase") ? "rgba(79,142,247,0.16)" : "none",
                  border: (tool === "highlight" || tool === "pen" || tool === "erase") ? "1px solid rgba(79,142,247,0.4)" : "1px solid transparent",
                }}
                onClick={() => { setAnnotatePopOpen((v) => !v); setShowOverflow(false); setOverflowBackdropOpen(false); }}
                title="Annotate"
                aria-label="Annotate"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
              </button>
              {/* Overflow */}
              <button
                style={{
                  ...s.iconBtn,
                  color: showOverflow ? CHROME.blue : T.muted,
                  background: showOverflow ? "rgba(79,142,247,0.16)" : "none",
                  border: showOverflow ? "1px solid rgba(79,142,247,0.4)" : "1px solid transparent",
                }}
                onClick={() => { setShowOverflow((v) => !v); setOverflowBackdropOpen((v) => !v); setAnnotatePopOpen(false); }}
                title="More"
                aria-label="More options"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
              </button>
            </div>
          </>
        ) : (
          /* Desktop: single row */
          <div style={s.toolbarRow} className="sc-toolbar-btns">
            {onBack && (
              <button style={{ ...s.iconBtn, color: T.muted, flexShrink: 0 }} onClick={onBack} title="Back" aria-label="Back">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
            )}
        <div style={s.docTitleBlock}>
          <span style={s.docTitle}>{title || "PDF"}</span>
          <span style={{ ...s.docSubtitle, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <ProgressRing pct={progressPct} />
            {progressLine}{todayLine}
          </span>
        </div>

        {/* Annotate — same popover as mobile: pen / marker / erase */}
        <button
          style={{
            ...s.iconBtn,
            color: (tool === "highlight" || tool === "pen" || tool === "erase") ? CHROME.blue : T.muted,
            background: (tool === "highlight" || tool === "pen" || tool === "erase") ? "rgba(79,142,247,0.16)" : "none",
            border: (tool === "highlight" || tool === "pen" || tool === "erase") ? "1px solid rgba(79,142,247,0.4)" : "1px solid transparent",
          }}
          onClick={() => { setAnnotatePopOpen((v) => !v); setShowOverflow(false); }}
          title="Annotate"
          aria-label="Annotate"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
        </button>

        <div style={s.sep} />

        {/* Back to previous location (jump history) */}
        {navStackLen > 0 && (
          <button
            style={{ ...s.iconBtn, color: T.accent }}
            onClick={navBack}
            title="Back to where you were"
            aria-label="Back to previous location"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>
          </button>
        )}

        {/* Page nav */}
        <button style={{ ...s.iconBtn, opacity: currentPage === 1 ? 0.35 : 1 }} onClick={() => stepPage(-1)} disabled={currentPage === 1} title="Previous page" aria-label="Previous page">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style={s.pageIndicator}>
          {numPages
            ? scrollMode === "book" && currentPage + 1 <= numPages
              ? `${currentPage}–${currentPage + 1} / ${numPages}`
              : `${currentPage} / ${numPages}`
            : "– / –"}
        </span>
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
        <button style={{ ...s.iconBtn, opacity: currentPage === numPages ? 0.35 : 1 }} onClick={() => stepPage(1)} disabled={currentPage === numPages} title="Next page" aria-label="Next page">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <div style={s.sep} />

        {/* Zoom */}
        <button style={s.iconBtn} onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M8 11h6"/></svg>
        </button>
        <span style={s.zoomLabel}>{Math.round(scale * 100)}%</span>
        <button style={s.iconBtn} onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
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
            style={{ ...s.scrollModeBtn, background: scrollMode === "book" ? T.accent : "none", color: scrollMode === "book" ? "white" : T.muted, borderColor: scrollMode === "book" ? T.accent : T.border }}
            onClick={() => { setCurrentPage((p) => p - ((p - 1) % 2)); setScrollMode("book"); }}
            title="Two-page spread"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2.5" y="4" width="8.5" height="16" rx="1"/><rect x="13" y="4" width="8.5" height="16" rx="1"/></svg>
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

            {/* ⋮ More + bookmark/TOC panels — order:1 keeps the button right of Search */}
            <div style={{ position: "relative", order: 1, display: "flex", alignItems: "center" }}>
              {/* Focus — pin the chrome hidden until toggled off */}
              <button
                style={{
                  ...s.iconBtn,
                  color: focusPinned ? "#F5A623" : T.muted,
                  background: focusPinned ? "rgba(245,166,35,0.14)" : "none",
                  border: focusPinned ? "1px solid rgba(245,166,35,0.45)" : "1px solid transparent",
                }}
                onClick={() => {
                  const next = !focusPinned;
                  setFocusPinned(next);
                  focusPinRef.current = next;
                  setChromeHidden(next);
                }}
                title={focusPinned ? "Exit focus — show toolbar" : "Focus — hide toolbar until toggled"}
                aria-label="Focus mode"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button
                style={{
                  ...s.iconBtn,
                  color: showOverflow ? CHROME.blue : T.muted,
                  background: showOverflow ? "rgba(79,142,247,0.16)" : "none",
                  border: showOverflow ? "1px solid rgba(79,142,247,0.4)" : "1px solid transparent",
                }}
                onClick={() => { setShowOverflow((v) => !v); setAnnotatePopOpen(false); }}
                title="More"
                aria-label="More options"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
              </button>
              {showBookmarks && bookmarks.length > 0 && (
                <div style={s.bookmarkPanel}>
                  <div style={{ fontSize: 11, color: T.muted, padding: "4px 8px", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Bookmarks ({bookmarks.length})</span>
                    <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 10, padding: 0 }} onClick={() => { setBookmarks([]); saveStored(`sc_pdf_bookmarks_${docKey}`, []); }}>Clear all</button>
                  </div>
                  {bookmarks.map((b) => (
                    <div key={b.page} style={s.bookmarkItem}>
                      {renamingPage === b.page ? (
                        <input
                          autoFocus
                          defaultValue={b.name}
                          placeholder={`Page ${b.page}`}
                          style={s.bookmarkRename}
                          onKeyDown={(e) => { if (e.key === "Enter") renameBookmark(b.page, e.target.value.trim()); if (e.key === "Escape") setRenamingPage(null); }}
                          onBlur={(e) => renameBookmark(b.page, e.target.value.trim())}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <button
                          style={{ flex: 1, background: "none", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
                          onClick={() => { goToPage(b.page); setShowBookmarks(false); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                          {b.name || `Page ${b.page}`}
                        </button>
                      )}
                      <button style={{ ...s.bookmarkMiniBtn }} title="Rename" onClick={(e) => { e.stopPropagation(); setRenamingPage(b.page); }}>✎</button>
                      <button style={{ ...s.bookmarkMiniBtn }} title="Remove" onClick={(e) => { e.stopPropagation(); removeBookmark(b.page); }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

            {/* Table of contents — only when the PDF ships an outline */}
            {outline?.length > 0 && showOutline && (
                  <div style={{ ...s.bookmarkPanel, width: 300, maxHeight: "55vh" }}>
                    <div style={{ fontSize: 11, color: T.muted, padding: "4px 8px", marginBottom: 4 }}>Contents</div>
                    {outline.map((it, i) => (
                      <button
                        key={i}
                        disabled={it.page == null}
                        onClick={() => { goToPage(it.page); setShowOutline(false); }}
                        style={{
                          ...s.bookmarkItem,
                          padding: `7px 8px 7px ${8 + it.depth * 14}px`,
                          fontSize: it.depth === 0 ? 12.5 : 12,
                          fontWeight: it.depth === 0 ? 600 : 400,
                          color: it.page == null ? T.muted : T.text,
                          cursor: it.page == null ? "default" : "pointer",
                          display: "flex", justifyContent: "space-between", gap: 8,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                        {it.page != null && <span style={{ color: T.muted, fontSize: 11, flexShrink: 0 }}>p.{it.page}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            {/* Search */}
            <div style={s.searchWrap}>
              <button
                style={{ ...s.iconBtn, color: showSearch ? CHROME.blue : T.muted, background: showSearch ? "rgba(79,142,247,0.16)" : "none", border: showSearch ? "1px solid rgba(79,142,247,0.4)" : "1px solid transparent" }}
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
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      if (searchResults.length) goToMatch(searchIdx < 0 ? 0 : (searchIdx + 1) % searchResults.length);
                      else runSearch(searchQuery);
                    }}
                  />
                  {searchResults.length > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      <button style={s.matchNavBtn} title="Previous match" aria-label="Previous match"
                        onClick={() => goToMatch(searchIdx <= 0 ? searchResults.length - 1 : searchIdx - 1)}>‹</button>
                      <span style={s.searchCount}>{searchIdx >= 0 ? `${searchIdx + 1}/` : ""}{searchResults.length}</span>
                      <button style={s.matchNavBtn} title="Next match" aria-label="Next match"
                        onClick={() => goToMatch((searchIdx + 1) % searchResults.length)}>›</button>
                    </span>
                  )}
                  <button
                    style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}
                    onClick={() => setShowSearch(false)}
                    aria-label="Close search"
                  >✕</button>
                </div>
                <div style={s.searchResults}>
                  {searching && <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>Searching…</div>}
                  {!searching && searchResults.length === 0 && searchQuery.trim() && (
                    <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>
                      No matches found.
                      {scannedPagesLikely && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>This looks like a scanned document — OCR can make its pages searchable.</div>
                          <button
                            style={{ ...s.askBtn, margin: 0 }}
                            disabled={ocrScanning}
                            onClick={runOcrScan}
                          >
                            {ocrScanning ? "Scanning…" : "Scan document for text"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {searchResults.map((r, i) => (
                    <div key={i} style={{ ...s.searchItem, ...(i === searchIdx ? { background: T.hover } : {}) }} onClick={() => { goToMatch(i); setShowSearch(false); }}>
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

        </div>
      )}
            {/* Annotate popover — shared: same picker for desktop & mobile */}
            <div style={s.annotatePop}>
              {/* Tool tabs */}
              <div style={s.toolTabs}>
                <button
                  style={{ ...s.toolTab, ...(annotateTab === "pen" ? { ...s.toolTabActive, color: CHROME.blue } : {}) }}
                  onClick={() => selectAnnotateTab("pen")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                  PEN
                </button>
                <button
                  style={{ ...s.toolTab, ...(annotateTab === "highlight" ? { ...s.toolTabActive, color: CHROME.gold } : {}) }}
                  onClick={() => selectAnnotateTab("highlight")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18h6l-3 3z" fill="currentColor"/><path d="M9.5 14.5l5-5m-7 7l7-7L17 12l-7 7-2.5-2.5z"/></svg>
                  MARK
                </button>
                <button
                  style={{ ...s.toolTab, ...(annotateTab === "line" ? { ...s.toolTabActive, color: CHROME.blue } : {}) }}
                  onClick={() => selectAnnotateTab("line")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 19L19 5"/></svg>
                  LINE
                </button>
                <button
                  style={{ ...s.toolTab, ...(annotateTab === "arrow" ? { ...s.toolTabActive, color: CHROME.blue } : {}) }}
                  onClick={() => selectAnnotateTab("arrow")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 19L19 5M19 5h-7M19 5v7"/></svg>
                  ARROW
                </button>
                <button
                  style={{ ...s.toolTab, ...(annotateTab === "erase" ? { ...s.toolTabActive, color: CHROME.coral } : {}) }}
                  onClick={() => selectAnnotateTab("erase")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16a2 2 0 0 1 0-2.8L13.2 3a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L11 20"/></svg>
                  ERASE
                </button>
              </div>

              {/* Pen / line / arrow options — shared ink colour + width */}
              {(annotateTab === "pen" || annotateTab === "line" || annotateTab === "arrow") && (
                <>
                  <div style={s.popRowLabel}>Ink colour</div>
                  <div style={s.swatchRow}>
                    {INK_COLORS.map((c) => (
                      <button
                        key={c.name}
                        style={{
                          ...s.swatchDot,
                          background: c.value,
                          boxShadow: penColor === c.value ? `0 0 0 2px ${T.toolbar}, 0 0 0 4px ${CHROME.blue}` : "none",
                        }}
                        onClick={() => setPenColor(c.value)}
                        title={c.name} aria-label={c.name} />
                    ))}
                  </div>
                  <div style={s.popRowLabel}>Stroke</div>
                  <div style={s.widthRow}>
                    {PEN_WIDTHS.map((w) => (
                      <button
                        key={w}
                        style={{ ...s.widthChip, ...(penWidth === w ? s.widthChipActive : {}) }}
                        onClick={() => setPenWidth(w)}
                      >
                        <div style={{ width: 20, height: w, borderRadius: w, background: penWidth === w ? CHROME.blue : T.muted }} />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Highlight options */}
              {annotateTab === "highlight" && (
                <>
                  <div style={s.popRowLabel}>Highlight colour</div>
                  <div style={s.swatchRow}>
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.name}
                        style={{
                          ...s.swatchDot,
                          background: c.value,
                          boxShadow: highlightColor === c.value ? `0 0 0 2px ${T.toolbar}, 0 0 0 4px ${CHROME.gold}` : "none",
                        }}
                        onClick={() => setHighlightColor(c.value)}
                        title={c.name}
                      />
                    ))}
                  </div>
                  <div style={s.popRowLabel}>Thickness</div>
                  <div style={s.widthRow}>
                    {HIGHLIGHT_WIDTHS.map((w) => (
                      <button
                        key={w}
                        style={{ ...s.widthChip, ...(highlightWidth === w ? s.widthChipActive : {}) }}
                        onClick={() => setHighlightWidth(w)}
                      >
                        <div style={{ width: 20, height: Math.min(10, w / 2), borderRadius: 3, background: highlightWidth === w ? CHROME.gold : T.muted }} />
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, padding: "10px 0 2px" }}>
                    Drag across text to highlight — saves to Highlights &amp; notes.
                  </div>
                </>
              )}

              {/* Erase hint */}
              {annotateTab === "erase" && (
                <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "12px 0" }}>
                  Drag through ink to cut it — tap a highlight to remove it.
                </div>
              )}

              {/* No tool selected hint */}
              {annotateTab === "none" && (
                <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "12px 0" }}>
                  Pick a tool above to start annotating this page.
                </div>
              )}

              {/* Stylus-only mode — fingers scroll, only pen/mouse inks */}
              <button
                style={{ ...s.overflowItem, padding: "8px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 8, color: stylusOnly ? CHROME.blue : T.muted, border: `1px solid ${stylusOnly ? "rgba(79,142,247,0.4)" : T.border}`, borderRadius: 8, marginTop: 8, background: stylusOnly ? "rgba(79,142,247,0.10)" : "none" }}
                onClick={() => { const v = !stylusOnly; setStylusOnly(v); saveStored("sc_pdf_stylusonly", v); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                Stylus only {stylusOnly ? "· on" : "· off"}
              </button>

              {/* Clear button */}
              {annotations[currentPage]?.length > 0 && (
                <button style={s.clearBtn} onClick={clearPageAnnotations}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  Clear this page
                </button>
              )}
            </div>
            {showOverflow && overflowBackdropOpen && isMobile && (
              <div style={s.overflowBackdrop} onClick={() => { setShowOverflow(false); setOverflowBackdropOpen(false); }} />
            )}
            {showOverflow && !isMobile && (
              <div style={{ position: "fixed", inset: 0, zIndex: 250 }} onClick={() => setShowOverflow(false)} />
            )}

            {/* Overflow menu — dropdown on desktop, bottom sheet on mobile */}
            {showOverflow && (
              <div
                style={isMobile
                  ? { ...s.sheet, transform: `translateY(${sheetDrag}px)`, transition: sheetDrag ? "none" : "transform 0.18s ease" }
                  : s.overflowMenu}
              >
                {isMobile && (
                  <div
                    style={s.sheetHandle}
                    onPointerDown={(e) => { menuDragRef.current = { start: e.clientY, dy: 0 }; e.currentTarget.setPointerCapture(e.pointerId); }}
                    onPointerMove={(e) => {
                      const d = menuDragRef.current;
                      if (!d) return;
                      d.dy = Math.max(0, e.clientY - d.start);
                      setSheetDrag(d.dy);
                    }}
                    onPointerUp={() => {
                      const dy = menuDragRef.current?.dy || 0;
                      menuDragRef.current = null;
                      setSheetDrag(0);
                      if (dy > 80) { setShowOverflow(false); setOverflowBackdropOpen(false); }
                    }}
                    onPointerCancel={() => { menuDragRef.current = null; setSheetDrag(0); }}
                  />
                )}
                {isMobile && (
                  <div style={{ ...s.overflowItem, display: "flex", alignItems: "center", gap: 8, cursor: "default" }} onClick={(e) => e.stopPropagation()}>
                    <button style={{ ...s.navBtn, border: `1px solid ${T.border}` }} onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                    </button>
                    <span style={{ ...s.zoomChip, flex: "0 0 auto" }}>{Math.round(scale * 100)}%</span>
                    <button style={{ ...s.navBtn, border: `1px solid ${T.border}` }} onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                    <button
                      style={{ marginLeft: "auto", background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "5px 12px", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      onClick={() => { resetToFit(); setShowOverflow(false); setOverflowBackdropOpen(false); }}
                    >
                      Fit width
                    </button>
                  </div>
                )}
                <button style={s.overflowItem} onClick={() => { toggleBookmark(); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarks.some((b) => b.page === currentPage) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  {bookmarks.some((b) => b.page === currentPage) ? "Bookmarked" : "Bookmark"}
                </button>
                {bookmarks.length > 0 && (
                  <button style={s.overflowItem} onClick={() => { setShowBookmarks((v) => !v); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                    Bookmarks ({bookmarks.length})
                  </button>
                )}
                {navStackLen > 0 && (
                  <button style={s.overflowItem} onClick={() => { navBack(); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>
                    Back to where I was
                  </button>
                )}
                {outline?.length > 0 && (
                  <button style={s.overflowItem} onClick={() => { setShowOutline((v) => !v); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="1.6" fill="currentColor" stroke="none"/></svg>
                    Contents
                  </button>
                )}
                <button style={s.overflowItem} onClick={() => { setShowNotes((v) => !v); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Highlights & notes{flatMarks.length ? ` (${flatMarks.length})` : ""}
                </button>
                <button style={s.overflowItem} onClick={() => { toggleTTS(); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                  {speaking ? "Stop reading" : "Read aloud"}
                </button>
                <button style={s.overflowItem} onClick={() => { setShowSearch((v) => !v); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                  Search
                </button>
                <button style={s.overflowItem} onClick={() => { exportAnnotations(); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  Export notes
                </button>
                <button
                  style={{ ...s.overflowItem, color: offlineInfo && offlineInfo !== "saving" ? "#3d9970" : undefined }}
                  onClick={() => { toggleOfflineCopy(); setShowOverflow(false); setOverflowBackdropOpen(false); }}
                >
                  {offlineInfo === "saving" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-9-9"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l7 7 7-7"/><path d="M12 19V5"/><path d="M5 21h14" strokeLinecap="round"/></svg>
                  )}
                  {offlineInfo === "saving"
                    ? "Saving offline…"
                    : offlineInfo
                      ? `Offline copy ✓ (${(offlineInfo.size / 1048576).toFixed(1)} MB) — tap to remove`
                      : "Save offline copy"}
                </button>
                <button
                  style={{ ...s.overflowItem, color: ocrScanning ? T.accent : undefined }}
                  onClick={() => { runOcrScan(); setShowOverflow(false); setOverflowBackdropOpen(false); }}
                  disabled={ocrScanning}
                >
                  {ocrScanning ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-9-9"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
                  )}
                  {ocrScanning ? "Scanning text…" : "Scan scanned pages (OCR)"}
                </button>
                <button style={s.overflowItem} onClick={() => { setCommentsFor(currentPage); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  Page comments{sharedCount ? ` (${sharedCount} in doc)` : ""}
                </button>
                <button
                  style={{ ...s.overflowItem, color: showShared ? T.accent : undefined }}
                  onClick={() => { const v = !showShared; setShowShared(v); saveStored(`sc_pdf_showshared_${docKey}`, v); setShowOverflow(false); setOverflowBackdropOpen(false); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {showShared ? "Community highlights: on" : "Community highlights: off"}
                </button>
                <button style={s.overflowItem} onClick={() => { setShowStats(true); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 16l4-4 3 3 5-5"/></svg>
                  Reading stats
                </button>
                {!isMobile && (
                  <button style={s.overflowItem} onClick={() => { setShowShortcuts(true); setShowOverflow(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/></svg>
                    Keyboard shortcuts
                  </button>
                )}
                <button style={s.overflowItem} onClick={() => { setShowThumbs((v) => !v); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="9" rx="1"/></svg>
                  Pages
                </button>
                <button
                  style={{ ...s.overflowItem, color: focusPinned ? "#F5A623" : undefined }}
                  onClick={() => {
                    const next = !focusPinned;
                    setFocusPinned(next);
                    focusPinRef.current = next;
                    setChromeHidden(next);
                    setShowOverflow(false); setOverflowBackdropOpen(false);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  {focusPinned ? "Exit focus mode" : "Focus mode"}
                </button>
                <button style={s.overflowItem} onClick={() => { setFullscreen((v) => !v); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></svg>
                  Fullscreen
                </button>
                <button style={s.overflowItem} onClick={() => { enterPresentation(); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  Present (slides mode)
                </button>
                {isMobile && (
                <div style={{ ...s.overflowItem, cursor: "default", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>View mode</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...s.scrollModeBtn, background: scrollMode === "single" ? T.accent : "none", color: scrollMode === "single" ? "white" : T.muted, borderColor: scrollMode === "single" ? T.accent : T.border }} onClick={() => { setScrollMode("single"); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="18" rx="1"/></svg>
                    </button>
                    <button style={{ ...s.scrollModeBtn, background: scrollMode === "vertical" ? T.accent : "none", color: scrollMode === "vertical" ? "white" : T.muted, borderColor: scrollMode === "vertical" ? T.accent : T.border }} onClick={() => { setScrollMode("vertical"); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="7" rx="1"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M12 11v2"/></svg>
                    </button>
                    <button style={{ ...s.scrollModeBtn, background: scrollMode === "book" ? T.accent : "none", color: scrollMode === "book" ? "white" : T.muted, borderColor: scrollMode === "book" ? T.accent : T.border }} onClick={() => { setCurrentPage((p) => p - ((p - 1) % 2)); setScrollMode("book"); setShowOverflow(false); setOverflowBackdropOpen(false); }} title="Two-page spread">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2.5" y="4" width="8.5" height="16" rx="1"/><rect x="13" y="4" width="8.5" height="16" rx="1"/></svg>
                    </button>
                    <button style={{ ...s.scrollModeBtn, background: scrollMode === "horizontal" ? T.accent : "none", color: scrollMode === "horizontal" ? "white" : T.muted, borderColor: scrollMode === "horizontal" ? T.accent : T.border }} onClick={() => { setScrollMode("horizontal"); setShowOverflow(false); setOverflowBackdropOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="7" height="12" rx="1"/><rect x="14" y="6" width="7" height="12" rx="1"/><path d="M11 12h2"/></svg>
                    </button>
                  </div>
                </div>
                )}
                {/* Separator */}
                <div style={{ height: 1, background: T.border, margin: "4px 0" }} />
                {/* Theme swatches */}
                <div style={{ ...s.overflowItem, cursor: "default", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.04em" }}>READING THEME</span>
                  <div style={s.themeSwatchRow}>
                    <button
                      style={{
                        ...s.themeSwatch,
                        background: THEMES[appTheme].bg,
                        color: THEMES[appTheme].text,
                        borderColor: themePref === "auto" ? CHROME.blue : "var(--app-tint-med)",
                        boxShadow: themePref === "auto" ? "0 0 8px rgba(79,142,247,0.4)" : "none",
                      }}
                      onClick={() => { setThemePref("auto"); }}
                      title="Auto — follow the app theme"
                    >
                      ⟲
                    </button>
                    <button
                      style={{
                        ...s.themeSwatch,
                        background: THEMES.light.bg,
                        color: THEMES.light.text,
                        borderColor: themePref === "light" ? CHROME.blue : "var(--app-tint-med)",
                        boxShadow: themePref === "light" ? "0 0 8px rgba(79,142,247,0.4)" : "none",
                      }}
                      onClick={() => { setThemePref("light"); }}
                      title="Light — always"
                    >
                      Aa
                    </button>
                    <button
                      style={{
                        ...s.themeSwatch,
                        background: THEMES.dark.bg,
                        color: THEMES.dark.text,
                        borderColor: themePref === "dark" ? CHROME.blue : "var(--app-tint-med)",
                        boxShadow: themePref === "dark" ? "0 0 8px rgba(79,142,247,0.4)" : "none",
                      }}
                      onClick={() => { setThemePref("dark"); }}
                      title="Dark — full invert"
                    >
                      Aa
                    </button>
                    <button
                      style={{
                        ...s.themeSwatch,
                        background: THEMES.sepia.bg,
                        color: THEMES.sepia.text,
                        borderColor: themePref === "sepia" ? CHROME.blue : "var(--app-tint-med)",
                        boxShadow: themePref === "sepia" ? "0 0 8px rgba(79,142,247,0.4)" : "none",
                      }}
                      onClick={() => { setThemePref("sepia"); }}
                      title="Sepia — warm paper"
                    >
                      Aa
                    </button>
                  </div>
                  {/* Page brightness — stacks on top of the theme */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 2px 0" }}>
                    <span style={{ fontSize: 12, color: T.muted }}>🔆</span>
                    <input
                      type="range"
                      min={0.4}
                      max={1.1}
                      step={0.05}
                      value={readerBrightness}
                      onChange={(e) => setReaderBrightness(parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: T.accent, height: 20 }}
                      aria-label="Page brightness"
                    />
                    {readerBrightness !== 1 && (
                      <button
                        style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 10 }}
                        onClick={() => setReaderBrightness(1)}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
    </div>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: numPages ? `${(currentPage / numPages) * 100}%` : "0%" }} />
        </div>
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
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (searchResults.length) goToMatch(searchIdx < 0 ? 0 : (searchIdx + 1) % searchResults.length);
                else runSearch(searchQuery);
              }}
            />
            {searchResults.length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <button style={s.matchNavBtn} title="Previous match" aria-label="Previous match"
                  onClick={() => goToMatch(searchIdx <= 0 ? searchResults.length - 1 : searchIdx - 1)}>‹</button>
                <span style={s.searchCount}>{searchIdx >= 0 ? `${searchIdx + 1}/` : ""}{searchResults.length}</span>
                <button style={s.matchNavBtn} title="Next match" aria-label="Next match"
                  onClick={() => goToMatch((searchIdx + 1) % searchResults.length)}>›</button>
              </span>
            )}
            <button
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 15, padding: "0 2px", flexShrink: 0 }}
              onClick={() => setShowSearch(false)}
              aria-label="Close search"
            >✕</button>
          </div>
          <div style={s.searchResults}>
            {searching && <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>Searching…</div>}
            {!searching && searchResults.length === 0 && searchQuery.trim() && (
              <div style={{ padding: "14px 12px", fontSize: "12.5px", color: T.muted }}>
                No matches found.
                {scannedPagesLikely && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>This looks like a scanned document — OCR can make its pages searchable.</div>
                    <button
                      style={{ ...s.askBtn, margin: 0 }}
                      disabled={ocrScanning}
                      onClick={runOcrScan}
                    >
                      {ocrScanning ? "Scanning…" : "Scan document for text"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {searchResults.map((r, i) => (
              <div key={i} style={{ ...s.searchItem, ...(i === searchIdx ? { background: T.hover } : {}) }} onClick={() => { goToMatch(i); setShowSearch(false); }}>
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
        <div style={{ position: "absolute", top: 100, right: 8, ...s.bookmarkPanel, width: 220 }}>
          <div style={{ fontSize: 11, color: T.muted, padding: "4px 8px", marginBottom: 4 }}>Bookmarks</div>
          {bookmarks.map((b) => (
            <div key={b.page} style={s.bookmarkItem}>
              {renamingPage === b.page ? (
                <input
                  autoFocus
                  defaultValue={b.name}
                  placeholder={`Page ${b.page}`}
                  style={s.bookmarkRename}
                  onKeyDown={(e) => { if (e.key === "Enter") renameBookmark(b.page, e.target.value.trim()); if (e.key === "Escape") setRenamingPage(null); }}
                  onBlur={(e) => renameBookmark(b.page, e.target.value.trim())}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  style={{ flex: 1, background: "none", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
                  onClick={() => { goToPage(b.page); setShowBookmarks(false); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  {b.name || `Page ${b.page}`}
                </button>
              )}
              <button style={{ ...s.bookmarkMiniBtn }} title="Rename" onClick={(e) => { e.stopPropagation(); setRenamingPage(b.page); }}>✎</button>
              <button style={{ ...s.bookmarkMiniBtn }} title="Remove" onClick={(e) => { e.stopPropagation(); removeBookmark(b.page); }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile outline / TOC panel */}
      {isMobile && showOutline && outline?.length > 0 && (
        <div style={{ position: "absolute", top: 100, left: 8, right: 8, maxHeight: "50vh", overflowY: "auto", zIndex: 55, background: T.toolbar, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: `0 8px 28px ${T.shadow}`, padding: 6 }}>
          <div style={{ fontSize: 11, color: T.muted, padding: "4px 8px", marginBottom: 4 }}>Contents</div>
          {outline.map((it, i) => (
            <button key={i} disabled={it.page == null} onClick={() => { goToPage(it.page); setShowOutline(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: it.page == null ? T.muted : T.text, cursor: it.page == null ? "default" : "pointer", padding: `7px 8px 7px ${8 + it.depth * 14}px`, fontSize: it.depth === 0 ? 12.5 : 12, fontWeight: it.depth === 0 ? 600 : 400, fontFamily: "inherit", borderRadius: 6 }}>
              {it.title}
              {it.page != null && <span style={{ float: "right", color: T.muted, fontSize: 11 }}>p.{it.page}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Mobile page-jump sheet — tap the page chip in the nav pill */}
      {isMobile && pageJumpOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 69, background: "rgba(0,0,0,0.35)" }} onClick={() => setPageJumpOpen(false)} />
          <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 70, background: T.toolbar, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 8, boxShadow: `0 8px 28px ${T.shadow}` }}>
            <span style={{ fontSize: 12, color: T.muted }}>Go to page</span>
            <input
              autoFocus
              type="number" min="1" max={numPages}
              style={{ ...s.pageInput, width: 64, fontSize: 15, padding: "6px 8px" }}
              placeholder={String(currentPage)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) goToPage(v);
                setPageJumpOpen(false);
              }}
            />
            <span style={{ fontSize: 12, color: T.muted }}>/ {numPages}</span>
          </div>
        </>
      )}

      {/* ── Text selection popover ── */}
      {selPop && tool === "none" && (
        <div
          style={{
            position: "fixed",
            left: selPop.x,
            ...(selPop.above ? { bottom: window.innerHeight - selPop.y } : { top: selPop.y }),
            transform: "translateX(-50%)",
            zIndex: 300,
            background: T.toolbar,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            boxShadow: `0 10px 32px ${T.shadow}`,
            padding: "6px 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            maxWidth: "94vw",
            flexWrap: "wrap",
          }}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              title={`Highlight ${c.name}`}
              aria-label={`Highlight ${c.name}`}
              onClick={() => addMark("highlight", c.value)}
              style={{ width: 22, height: 22, borderRadius: "50%", background: c.value.replace("0.4", "0.85"), border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer", flexShrink: 0 }}
            />
          ))}
          <span style={{ width: 1, height: 18, background: T.border, margin: "0 3px" }} />
          <button style={s.selPopBtn} onClick={() => { const m = addMark("note", "rgba(255,211,77,0.4)"); if (m) setNoteEdit({ page: m.page, id: m.id }); }}>
            📝 Note
          </button>
          <button style={s.selPopBtn} onClick={() => askAboutSelection("Explain this passage clearly and concisely — under 100 words:")}>✨ Explain</button>
          <button style={s.selPopBtn} onClick={handleDefine}>📖 Define</button>
          <button style={s.selPopBtn} onClick={genQuizFromSelection} disabled={chatLoading}>❓ Quiz</button>
          {propResourceId && <button style={s.selPopBtn} onClick={openCardEdit}>🃏 Card</button>}
          <button style={s.selPopBtn} onClick={shareSelection} disabled={shareBusy} title="Share this highlight with everyone reading this PDF">📤 Share</button>
          <button style={s.selPopBtn} onClick={copySelection}>📋 Copy</button>
          <button style={s.selPopBtn} onClick={speakSelection} title="Read aloud" aria-label="Read aloud">🔊</button>
        </div>
      )}

      {/* ── Define card — instant dictionary lookup for short selections ── */}
      {definePop && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setDefinePop(null)} />
          <div
            style={{
              position: "fixed",
              left: Math.max(8, Math.min(window.innerWidth - 250, definePop.x - 110)),
              ...(definePop.above ? { bottom: window.innerHeight - definePop.y } : { top: definePop.y }),
              transform: "translateX(-50%)",
              zIndex: 300,
              background: T.toolbar,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: `0 10px 32px ${T.shadow}`,
              padding: "10px 12px",
              width: 240,
              maxWidth: "92vw",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{definePop.word}</span>
              {definePop.data?.[0]?.phonetic && <span style={{ fontSize: 11, color: T.muted }}>{definePop.data[0].phonetic}</span>}
            </div>
            {definePop.loading && <div style={{ fontSize: 12, color: T.muted, padding: "8px 0" }}>Looking up…</div>}
            {!definePop.loading && !definePop.data && (
              <div style={{ fontSize: 12, color: T.muted, padding: "8px 0" }}>No dictionary entry — try Ask AI below.</div>
            )}
            {!definePop.loading && definePop.data?.[0]?.meanings?.slice(0, 2).map((m, i) => (
              <div key={i} style={{ marginTop: 6 }}>
                <span style={{ fontSize: 10, fontStyle: "italic", color: CHROME.blue }}>{m.partOfSpeech}</span>
                <div style={{ fontSize: 12, color: T.text, lineHeight: 1.45 }}>{m.definitions?.[0]?.definition}</div>
              </div>
            ))}
            <button
              style={{ ...s.selPopBtn, marginTop: 8, width: "100%" }}
              onClick={() => { setDefinePop(null); askAboutSelection("Define this term precisely and simply, with one concrete example:"); }}
            >
              ✨ Ask AI for more
            </button>
          </div>
        </>
      )}

      {/* ── Flashcard mini-sheet — selection becomes the card's back ── */}
      {cardEdit && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,0.3)" }} onClick={() => setCardEdit(null)} />
          <div
            style={{
              position: "fixed",
              left: "50%",
              bottom: isMobile ? 96 : 60,
              transform: "translateX(-50%)",
              zIndex: 300,
              background: T.toolbar,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              boxShadow: `0 12px 36px ${T.shadow}`,
              padding: 14,
              width: 300,
              maxWidth: "92vw",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, marginBottom: 8 }}>
              New flashcard · p.{cardEdit.page}
            </div>
            <input
              autoFocus
              value={cardEdit.front}
              onChange={(e) => setCardEdit({ ...cardEdit, front: e.target.value })}
              placeholder="Front — question or term"
              style={{ ...s.pageInput, width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 13, marginBottom: 8 }}
              onKeyDown={(e) => { if (e.key === "Enter") saveCard(); }}
            />
            <textarea
              value={cardEdit.back}
              onChange={(e) => setCardEdit({ ...cardEdit, back: e.target.value })}
              rows={3}
              placeholder="Back — answer"
              style={{ width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 12, resize: "vertical", fontFamily: "inherit", lineHeight: 1.45, marginBottom: 10, border: `1px solid ${T.border}`, borderRadius: 6, background: T.inputBg, color: T.text }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ flex: 1, background: "linear-gradient(145deg, #F5A623, #d98a12)", color: "#1a1200", border: "none", borderRadius: 12, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: cardEdit.front.trim() && cardEdit.back.trim() ? 1 : 0.5 }}
                onClick={saveCard}
                disabled={!cardEdit.front.trim() || !cardEdit.back.trim()}
              >
                Save card
              </button>
              <button
                style={{ background: T.hover, color: T.text, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
                onClick={() => setCardEdit(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mark context menu (tap an existing highlight) ── */}
      {markMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setMarkMenu(null)} />
          <div
            style={{
              position: "fixed",
              left: Math.max(8, Math.min(window.innerWidth - 200, markMenu.x - 80)),
              top: Math.max(8, markMenu.y - 8),
              transform: "translateY(-100%)",
              zIndex: 300,
              background: T.toolbar,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: `0 10px 32px ${T.shadow}`,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 170,
            }}
          >
            <div style={{ fontSize: 11, color: T.muted, padding: "2px 8px 6px", maxHeight: 48, overflow: "hidden" }}>
              {markMenu.mark.text ? `“${markMenu.mark.text.slice(0, 80)}${markMenu.mark.text.length > 80 ? "…" : ""}”` : "Highlighted region"}
            </div>
            <div style={{ display: "flex", gap: 4, padding: "0 4px 4px" }}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  title={c.name}
                  onClick={() => { updateMark(markMenu.mark.page, markMenu.mark.id, { color: c.value }); setMarkMenu(null); }}
                  style={{ width: 20, height: 20, borderRadius: "50%", background: c.value.replace("0.4", "0.85"), border: markMenu.mark.color === c.value ? "2px solid " + T.text : "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
                />
              ))}
            </div>
            <button style={s.selMenuItem} onClick={() => { setNoteEdit({ page: markMenu.mark.page, id: markMenu.mark.id }); setMarkMenu(null); }}>
              📝 {markMenu.mark.note ? "Edit note" : "Add note"}
            </button>
            {markMenu.mark.text && (
              <>
                <button style={s.selMenuItem} onClick={() => { quizFromText(markMenu.mark.text, markMenu.mark.page); }}>❓ Make quiz question</button>
                <button style={s.selMenuItem} onClick={() => { pendingSelRef.current = { page: markMenu.mark.page, text: markMenu.mark.text, rects: markMenu.mark.rects }; askAboutSelection("Explain this passage clearly and concisely — under 100 words:"); setMarkMenu(null); }}>✨ Ask AI</button>
              </>
            )}
            <button style={{ ...s.selMenuItem, color: "#e35d6a" }} onClick={() => { removeMark(markMenu.mark.page, markMenu.mark.id); setMarkMenu(null); }}>
              🗑 Delete
            </button>
          </div>
        </>
      )}

      {/* ── Shared highlight card (tap a community mark) ── */}
      {sharedMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setSharedMenu(null)} />
          <div
            style={{
              position: "fixed",
              left: Math.max(8, Math.min(window.innerWidth - 230, sharedMenu.x - 90)),
              top: Math.max(8, sharedMenu.y - 8),
              transform: "translateY(-100%)",
              zIndex: 300,
              background: T.toolbar,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: `0 10px 32px ${T.shadow}`,
              padding: "10px 12px",
              minWidth: 190,
              maxWidth: 240,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: T.accent, color: "#0b0b0e", fontSize: 11, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {(sharedMenu.annot.author || "S")[0].toUpperCase()}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{sharedMenu.annot.author}</span>
            </div>
            {sharedMenu.annot.excerpt && (
              <div style={{ fontSize: 11.5, color: T.muted, maxHeight: 60, overflow: "hidden", marginBottom: 6 }}>
                “{sharedMenu.annot.excerpt.slice(0, 120)}{sharedMenu.annot.excerpt.length > 120 ? "…" : ""}”
              </div>
            )}
            {sharedMenu.annot.mine && (
              <button
                style={{ ...s.selMenuItem, color: "#e35d6a", width: "100%" }}
                onClick={() => deleteShared(sharedMenu.annot.id)}
              >
                🗑 Remove shared highlight
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Page comments sheet ── */}
      {commentsFor != null && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 340, background: "rgba(0,0,0,0.45)" }} onClick={() => setCommentsFor(null)} />
          <div
            style={{
              position: "fixed",
              left: isMobile ? 0 : "50%",
              right: isMobile ? 0 : undefined,
              bottom: 0,
              ...(isMobile ? {} : { transform: "translateX(-50%)", width: 460 }),
              zIndex: 341,
              background: T.toolbar,
              border: `1px solid ${T.border}`,
              borderRadius: isMobile ? "16px 16px 0 0" : "16px 16px 0 0",
              boxShadow: `0 -10px 40px ${T.shadow}`,
              display: "flex",
              flexDirection: "column",
              maxHeight: "70vh",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                💬 Comments · p.{commentsFor}
              </span>
              <button style={{ ...s.matchNavBtn, fontSize: 16 }} onClick={() => setCommentsFor(null)} aria-label="Close comments">✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {(sharedByPage[commentsFor]?.comments || []).length === 0 && (
                <div style={{ padding: "18px 6px", fontSize: 12.5, color: T.muted, textAlign: "center" }}>
                  No comments on this page yet — be the first.
                </div>
              )}
              {(sharedByPage[commentsFor]?.comments || []).map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 9 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    background: T.accent, color: "#0b0b0e", fontSize: 12, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {(a.author || "S")[0].toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{a.author}</span>
                      <span style={{ fontSize: 10, color: T.muted }}>
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                      </span>
                      {a.mine && (
                        <button
                          style={{ marginLeft: "auto", background: "none", border: "none", color: "#e35d6a", fontSize: 11, cursor: "pointer", padding: 0 }}
                          onClick={() => deleteShared(a.id)}
                        >
                          delete
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 1 }}>{a.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: `1px solid ${T.border}`, paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                placeholder={getAuthToken() ? `Comment on page ${commentsFor}…` : "Sign in to comment"}
                disabled={!getAuthToken()}
                style={{
                  flex: 1, background: T.hover, border: `1px solid ${T.border}`, borderRadius: 999,
                  color: T.text, fontSize: 13, padding: "8px 14px", outline: "none",
                }}
              />
              <button
                onClick={postComment}
                disabled={shareBusy || !commentDraft.trim() || !getAuthToken()}
                style={{
                  background: T.accent, border: "none", borderRadius: 999, color: "#0b0b0e",
                  fontWeight: 800, fontSize: 13, padding: "8px 16px", cursor: "pointer",
                  opacity: shareBusy || !commentDraft.trim() ? 0.5 : 1,
                }}
              >
                Post
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Margin note editor ── */}
      <NoteEditorModal
        noteEdit={noteEdit}
        marks={textMarks}
        onSave={(page, id, v) => updateMark(page, id, { note: v, kind: v ? "note" : "highlight" })}
        onClose={() => setNoteEdit(null)}
        T={T} s={s} isMobile={isMobile}
      />

      {/* ── Deck toast ── */}
      {deckToast && (
        <div
          style={{
            position: "fixed", bottom: isMobile ? 100 : 30, left: "50%", transform: "translateX(-50%)",
            zIndex: 400, background: deckToast.type === "error" ? "#5a1f28" : "#123a24",
            color: "var(--app-text)", padding: "10px 18px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
            boxShadow: "0 8px 26px rgba(0,0,0,0.4)", maxWidth: "92vw", textAlign: "center",
          }}
        >
          {deckToast.text}
        </div>
      )}

      {/* ── OCR status pill ── */}
      {(ocrScanning || ocrStatus) && (
        <div
          style={{
            position: "fixed", bottom: isMobile ? 160 : 80, left: "50%", transform: "translateX(-50%)",
            zIndex: 400, background: "var(--c-123a24)", color: "var(--app-text)", padding: "9px 16px", borderRadius: 999,
            fontSize: 12, fontWeight: 600, boxShadow: "0 8px 26px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", gap: 8, maxWidth: "92vw",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}><path d="M21 12a9 9 0 1 1-9-9"/></svg>
          {ocrStatus?.message || "Scanning document for text…"}
        </div>
      )}

      {/* ── Notes panel (all marks across the document) ── */}
      {showNotes && (
        <NotesPanel
          marks={flatMarks}
          onJump={jumpToMark}
          onClose={() => setShowNotes(false)}
          T={T} s={s} isMobile={isMobile}
        />
      )}

      {/* Resume-lesson toast — top center, auto-dismisses */}
      {resumeLesson && !loading && !loadError && (
        <div style={s.resumeToast}>
          <span>Resume lesson · p.{resumeLesson.page}{resumeLesson.idx >= 0 ? ` §${resumeLesson.idx + 1}` : ""}</span>
          <button style={{ ...s.resumeBtn, background: "linear-gradient(145deg, #F5A623, #d98a12)", color: "#1a1200" }} onClick={handleResumeLesson}>▶ Resume</button>
          <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }} onClick={() => setResumeLesson(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Floating show-header hint when chrome hidden */}
      {chromeHidden && (
        <div
          onClick={() => { focusPinRef.current = false; setFocusPinned(false); setChromeHidden(false); closeAllMobileOverlays(); }}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 40,
            zIndex: 60, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)",
            pointerEvents: "auto",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ opacity: 0.6 }}>
            <path d="M6 15l6-6 6 6" />
          </svg>
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
              {filteredThumbs.map((t) => {
                return (
                <button
                  key={t.page}
                  data-page={t.page}
                  ref={(el) => { thumbItemRefs.current[t.page - 1] = el; }}
                  style={{
                    ...s.thumb,
                    borderColor: t.page === currentPage ? T.accent : pageTutor.lessonPages?.has(t.page) ? "rgba(245,166,35,0.45)" : "transparent",
                    background: t.page === currentPage ? T.hover : "none",
                  }}
                  onClick={() => goToPage(t.page)}
                >
                  {t.dataUrl ? (
                    <img src={t.dataUrl} alt={`Page ${t.page}`} style={{ boxShadow: `0 1px 4px ${T.shadow}`, display: "block" }} />
                  ) : (
                    <div style={{ width: 84, height: 110, background: T.inputBg, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: T.muted }}>…</div>
                  )}
                  <span style={{ ...s.thumbLabel, color: t.page === currentPage ? T.accent : T.muted }}>
                    {pageTutor.lessonPages?.has(t.page) && <span style={{ color: "#F5A623", marginRight: 3 }} title="Lesson available — free to open">✦</span>}
                    {t.page}
                  </span>
                </button>
                );
              })}
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
              {filteredThumbs.map((t) => {
                return (
                <button
                  key={t.page}
                  data-page={t.page}
                  ref={(el) => { thumbItemRefs.current[t.page - 1] = el; }}
                  style={{
                    ...s.thumb,
                    borderColor: t.page === currentPage ? T.accent : pageTutor.lessonPages?.has(t.page) ? "rgba(245,166,35,0.45)" : "transparent",
                    background: t.page === currentPage ? T.hover : "none",
                  }}
                  onClick={() => { goToPage(t.page); setShowThumbs(false); }}
                >
                  {t.dataUrl ? (
                    <img src={t.dataUrl} alt={`Page ${t.page}`} style={{ boxShadow: `0 1px 4px ${T.shadow}`, display: "block" }} />
                  ) : (
                    <div style={{ width: 84, height: 110, background: T.inputBg, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: T.muted }}>…</div>
                  )}
                  <span style={{ ...s.thumbLabel, color: t.page === currentPage ? T.accent : T.muted }}>
                    {pageTutor.lessonPages?.has(t.page) && <span style={{ color: "#F5A623", marginRight: 3 }} title="Lesson available — free to open">✦</span>}
                    {t.page}
                  </span>
                </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Viewer */}
        <main
          ref={viewerRef}
          style={s.viewer}
          onTouchStart={onTouchStartViewer}
          onTouchEnd={onTouchEndViewer}
          onPointerDown={onViewerPointerDown}
          onClick={onViewerTap}
        >
          {/* Zoom indicator badge */}
          {showZoomIndicator && (
            <div ref={zoomBadgeRef} style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)", color: "white", borderRadius: 20,
              padding: "4px 16px", fontSize: 13, fontWeight: 600, zIndex: 50,
              pointerEvents: "none", transition: "opacity 0.3s ease",
            }}>
              {Math.round(scale * panZoom.scale * 100)}%
            </div>
          )}

          {/* Zoomable content wrapper — gallery-style pan/zoom */}
          <div
            ref={panZoomContentRef}
            style={{
              transform: (scrollMode === "single" || scrollMode === "book" || pinchActive) ? `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})` : "none",
              transformOrigin: "0 0",
              transition: "none",
              willChange: pinchActive || isPanning ? "transform" : "auto",
              ...(scrollMode === "single" || scrollMode === "book" ? {
                flex: 1,
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                width: "100%",
                height: "100%",
              } : scrollMode === "vertical" ? {
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: isMobile ? 8 : 16,
                width: "100%",
                minHeight: "100%",
                padding: isMobile ? "8px 4px 40px" : "24px 16px 40px",
              } : {
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                gap: isMobile ? 8 : 24,
                height: "100%",
                minWidth: "100%",
                padding: isMobile ? "8px 4px 40px" : "24px 24px 40px",
              }),
            }}
          >
          {scrollMode === "single" ? (
            <div
              style={{
                ...s.pageShadow,
                // Auto margins center a short page (present mode, landscape
                // scans) and collapse to start-alignment when it overflows —
                // same trick as continuous mode, keeps overflow scrollable.
                margin: "auto",
              }}
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
                  // Global `canvas { max-width:100%; height:auto }` would clamp the
                  // width while the inline pixel height stays → stretched page.
                  maxWidth: "none",
                  filter: pageCssFilter(),
                }}
              />
              {/* Text layer — always mounted: MARK needs it alive to select,
                  and unmounting wipes its spans (breaks selection/search marks) */}
              <div
                data-text-layer={currentPage}
                ref={(el) => { textLayerRefs.current[currentPage] = el; }}
                style={{
                  position: "absolute", top: 0, left: 0, overflow: "hidden",
                  pointerEvents: "auto", userSelect: "text", zIndex: 5,
                  mixBlendMode: theme === "dark" ? "difference" : "normal",
                }}
              />
              {/* Text-anchored highlights + notes (normalized rect overlays) */}
              {(textMarks[currentPage] || []).map((m) =>
                m.rects.map((r, ri) => (
                  <div
                    key={`${m.id}:${ri}`}
                    data-mark={m.id}
                    onClick={(e) => { e.stopPropagation(); setMarkMenu({ mark: { ...m, page: currentPage }, x: e.clientX, y: e.clientY }); }}
                    title={m.note || undefined}
                    style={{
                      position: "absolute",
                      left: `${r[0] * 100}%`, top: `${r[1] * 100}%`,
                      width: `${(r[2] - r[0]) * 100}%`, height: `${(r[3] - r[1]) * 100}%`,
                      background: m.color,
                      mixBlendMode: (theme === "dark") ? "screen" : "multiply",
                      borderRadius: 2,
                      zIndex: 6,
                      cursor: "pointer",
                      borderBottom: m.note ? `2px solid ${T.accent}` : "none",
                      boxShadow: flashMark === m.id ? "0 0 0 3px rgba(255,171,64,0.9)" : "none",
                      transition: "box-shadow 0.3s ease",
                    }}
                  />
                ))
              )}
              {/* Community highlights + comment pin */}
              {renderSharedMarks(currentPage)}
              {renderPendingSel(currentPage)}
              <svg
                ref={lassoSvgRef}
                style={{ ...s.lassoOverlay, filter: pageCssFilter(), pointerEvents: overlayEventsFor(currentPage) }}
                onPointerDown={onOverlayDown}
                onPointerMove={onOverlayMove}
                onPointerUp={onOverlayUp}
                onPointerCancel={onOverlayCancel}
                onLostPointerCapture={onOverlayCancel}
              >
                {/* Saved annotations */}
                {savedAnnotationPaths.map((sp) =>
                  sp.kind === "fill" ? (
                    <path key={`a${sp.si}`} d={sp.d} fill={sp.color} stroke="none" />
                  ) : sp.kind === "arrow" ? (
                    <g key={`a${sp.si}`}>
                      <path d={sp.d} stroke={sp.color} strokeWidth={sp.width} fill="none" strokeLinecap="round" />
                      <path d={sp.head} fill={sp.color} stroke="none" />
                    </g>
                  ) : (
                    <path key={`a${sp.si}`} d={sp.d} stroke={sp.color} strokeWidth={sp.width} fill="none" strokeLinecap="round" strokeLinejoin="round" style={sp.multiply ? { mixBlendMode: "multiply" } : undefined} />
                  )
                )}
                {/* Live ink: pen is a tapered fill, marker a multiply stroke */}
                {penPreview && tool === "pen" && <path d={penPreview} fill={penColor} stroke="none" />}
                {renderStrokes && tool === "highlight" && (
                  <path d={renderStrokes} stroke={highlightColor} strokeWidth={highlightWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ mixBlendMode: "multiply" }} />
                )}
                {shapePreview && (tool === "line" || tool === "arrow") && (
                  <>
                    <path d={`M ${shapePreview.a.x},${shapePreview.a.y} L ${shapePreview.b.x},${shapePreview.b.y}`} stroke={penColor} strokeWidth={penWidth} fill="none" strokeLinecap="round" />
                    {tool === "arrow" && <path d={arrowHeadPath(shapePreview.a, shapePreview.b, penWidth)} fill={penColor} />}
                  </>
                )}
                {eraseDot && tool === "erase" && (
                  <circle cx={eraseDot.x} cy={eraseDot.y} r={10} fill="none" stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="3 3" />
                )}
                {/* Lasso path for circle-to-ask */}
                {lassoPath && tool === "circle" && <path d={lassoPath} style={s.lassoPath} />}
              </svg>
            </div>
          ) : scrollMode === "book" ? (
            // ── Two-page spread (book mode): facing pages side by side ──
            <div
              // margin:auto centers a short spread and collapses to start
              // alignment when it overflows — same trick as continuous mode.
              style={{ ...s.spreadRow, margin: "auto" }}
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
              {[currentPage, currentPage + 1].filter((pg) => pg <= numPages).map((pg) => (
                <div key={pg} style={{ ...s.pageShadow, margin: 0, flexShrink: 0 }} data-page={pg}>
                  <canvas
                    ref={pg === currentPage ? canvasRef : canvas2Ref}
                    style={{ display: "block", maxWidth: "none", filter: pageCssFilter() }}
                  />
                  {/* Text layer for selection/copy — always mounted */}
                  <div
                    data-text-layer={pg}
                    ref={(el) => { textLayerRefs.current[pg] = el; }}
                    style={{
                      position: "absolute", top: 0, left: 0, overflow: "hidden",
                      pointerEvents: "auto", userSelect: "text", zIndex: 5,
                      mixBlendMode: theme === "dark" ? "difference" : "normal",
                    }}
                  />
                  {/* Text-anchored highlights + notes */}
                  {(textMarks[pg] || []).map((m) =>
                    m.rects.map((r, ri) => (
                      <div
                        key={`${m.id}:${ri}`}
                        data-mark={m.id}
                        onClick={(e) => { e.stopPropagation(); setMarkMenu({ mark: { ...m, page: pg }, x: e.clientX, y: e.clientY }); }}
                        title={m.note || undefined}
                        style={{
                          position: "absolute",
                          left: `${r[0] * 100}%`, top: `${r[1] * 100}%`,
                          width: `${(r[2] - r[0]) * 100}%`, height: `${(r[3] - r[1]) * 100}%`,
                          background: m.color,
                          mixBlendMode: (theme === "dark") ? "screen" : "multiply",
                          borderRadius: 2,
                          zIndex: 6,
                          cursor: "pointer",
                          borderBottom: m.note ? `2px solid ${T.accent}` : "none",
                          boxShadow: flashMark === m.id ? "0 0 0 3px rgba(255,171,64,0.9)" : "none",
                          transition: "box-shadow 0.3s ease",
                        }}
                      />
                    ))
                  )}
                  {renderSharedMarks(pg)}
                  {renderPendingSel(pg)}
                  <span style={s.pageLabel}>{pg}</span>
                </div>
              ))}
            </div>
          ) : (
            // Continuous scroll mode — virtualized: only render canvases for pages in virtual window
            Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => {
              const isInVirtual = virtualPages.has(pg);
              const dims = getPlaceholderDims(pg);
              return (
                <div
                  key={pg}
                  data-page={pg}
                  ref={(el) => { pageItemRefs.current[pg - 1] = el; }}
                  style={{
                    ...s.continuousPageItem,
                    // Auto margins center the page when it fits and collapse to
                    // start-alignment when it overflows, so the far edge stays
                    // reachable via scroll — align-items:center would clip it.
                    margin: scrollMode === "horizontal" ? "auto 0" : "0 auto",
                    ...(!isInVirtual && dims.height > 0 ? {
                      width: dims.width,
                      height: dims.height,
                    } : {}),
                  }}
                >
                  {isInVirtual ? (
                    <>
                      <canvas
                        ref={(el) => { pageCanvasRefs.current[pg - 1] = el; }}
                        style={{
                          display: "block",
                          maxWidth: "none",
                          filter: pageCssFilter(),
                        }}
                      />
                      {/* Text layer for selection/copy — always mounted */}
                      <div
                        data-text-layer={pg}
                        ref={(el) => { textLayerRefs.current[pg] = el; }}
                        style={{
                          position: "absolute", top: 0, left: 0, overflow: "hidden",
                          pointerEvents: "auto", userSelect: "text", zIndex: 5,
                          mixBlendMode: theme === "dark" ? "difference" : "normal",
                        }}
                      />
                      {/* Text-anchored highlights + notes */}
                      {(textMarks[pg] || []).map((m) =>
                        m.rects.map((r, ri) => (
                          <div
                            key={`${m.id}:${ri}`}
                            data-mark={m.id}
                            onClick={(e) => { e.stopPropagation(); setMarkMenu({ mark: { ...m, page: pg }, x: e.clientX, y: e.clientY }); }}
                            title={m.note || undefined}
                            style={{
                              position: "absolute",
                              left: `${r[0] * 100}%`, top: `${r[1] * 100}%`,
                              width: `${(r[2] - r[0]) * 100}%`, height: `${(r[3] - r[1]) * 100}%`,
                              background: m.color,
                              mixBlendMode: (theme === "dark") ? "screen" : "multiply",
                              borderRadius: 2,
                              zIndex: 6,
                              cursor: "pointer",
                              borderBottom: m.note ? `2px solid ${T.accent}` : "none",
                              boxShadow: flashMark === m.id ? "0 0 0 3px rgba(255,171,64,0.9)" : "none",
                              transition: "box-shadow 0.3s ease",
                            }}
                          />
                        ))
                      )}
                      {renderSharedMarks(pg)}
                      {renderPendingSel(pg)}
                      {/* Unified SVG overlay per page — handles annotations + drawing + lasso */}
                      {(
                        <svg
                          ref={(el) => { if (pg === currentPage) lassoSvgRef.current = el; }}
                          style={{
                            ...s.lassoOverlay,
                            filter: pageCssFilter(),
                            pointerEvents: overlayEventsFor(pg),
                          }}
                          onPointerDown={(e) => onOverlayDown(e, pg)}
                          onPointerMove={onOverlayMove}
                          onPointerUp={onOverlayUp}
                          onPointerCancel={onOverlayCancel}
                          onLostPointerCapture={onOverlayCancel}
                        >
                          {/* Saved annotations */}
                          {(annotations[pg] || []).map((stroke, si) => {
                            const sp = strokeGeom(stroke, (p) => ({ x: p.x * scale, y: p.y * scale }));
                            return sp.kind === "fill" ? (
                              <path key={`p${pg}a${si}`} d={sp.d} fill={sp.color} stroke="none" />
                            ) : sp.kind === "arrow" ? (
                              <g key={`p${pg}a${si}`}>
                                <path d={sp.d} stroke={sp.color} strokeWidth={sp.width} fill="none" strokeLinecap="round" />
                                <path d={sp.head} fill={sp.color} stroke="none" />
                              </g>
                            ) : (
                              <path key={`p${pg}a${si}`} d={sp.d} stroke={sp.color} strokeWidth={sp.width} fill="none" strokeLinecap="round" strokeLinejoin="round" style={sp.multiply ? { mixBlendMode: "multiply" } : undefined} />
                            );
                          })}
                          {/* Live ink (page the gesture started on) */}
                          {pg === drawPage && penPreview && tool === "pen" && <path d={penPreview} fill={penColor} stroke="none" />}
                          {pg === drawPage && renderStrokes && tool === "highlight" && (
                            <path d={renderStrokes} stroke={highlightColor} strokeWidth={highlightWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ mixBlendMode: "multiply" }} />
                          )}
                          {pg === drawPage && shapePreview && (tool === "line" || tool === "arrow") && (
                            <>
                              <path d={`M ${shapePreview.a.x},${shapePreview.a.y} L ${shapePreview.b.x},${shapePreview.b.y}`} stroke={penColor} strokeWidth={penWidth} fill="none" strokeLinecap="round" />
                              {tool === "arrow" && <path d={arrowHeadPath(shapePreview.a, shapePreview.b, penWidth)} fill={penColor} />}
                            </>
                          )}
                          {pg === drawPage && eraseDot && tool === "erase" && (
                            <circle cx={eraseDot.x} cy={eraseDot.y} r={10} fill="none" stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="3 3" />
                          )}
                          {/* Lasso path for circle-to-ask (page the gesture started on) */}
                          {pg === drawPage && lassoPath && tool === "circle" && (
                            <path d={lassoPath} style={s.lassoPath} />
                          )}
                        </svg>
                      )}
                    </>
                  ) : (
                    // Placeholder for off-screen page — maintains scroll dimensions
                    <div style={{ width: dims.width || "100%", height: dims.height || 200, background: (theme === "dark") ? "#1e1e28" : "#f0f0f0" }} />
                  )}
                  <span style={s.pageLabel}>{pg}</span>
                </div>
              );
            })
          )}
          </div>{/* end zoomable content wrapper */}
        </main>

        {/* Chat — desktop: docked side panel (flex child of workspace);
            mobile: fixed bottom sheet (fixed positioning escapes the flex row) */}
        {chatOpen && (
          <>
            {isMobile && <div style={s.chatBackdrop} onClick={hideChat} onTouchStart={(e) => e.stopPropagation()} />}
            <div style={s.chatPopup} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
              {isMobile && <div style={s.sheetHandle} onTouchStart={sheetTouchStart} onTouchEnd={sheetTouchEnd} />}
              {!isMobile && !dockMode && <div style={s.chatGoldLine} />}
              <div
                style={s.chatHead}
                onTouchStart={isMobile ? sheetTouchStart : undefined}
                onTouchEnd={isMobile ? sheetTouchEnd : undefined}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <AiOrb size={22} pulsing={chatLoading} />
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={s.chatName}>Scholar</span>
                    <span style={{ ...s.chatStatus, color: chatLoading ? "#b07a10" : T.muted }}>
                      {chatLoading
                        ? (chatMessages[chatMessages.length - 1]?.streaming ? "Writing…" : "Thinking…")
                        : `Reading p.${chatCtxPage}`}
                    </span>
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                  {aiUsage && !aiUsage.isActivated && (
                    <button
                      style={s.creditsChip}
                      onClick={() => window.dispatchEvent(new CustomEvent("sc-open-premium"))}
                      aria-label={`${Math.max(0, aiUsage.limit - aiUsage.used)} AI requests left today — upgrade for unlimited`}
                      title="AI requests left today"
                    >
                      ⚡ {Math.max(0, aiUsage.limit - aiUsage.used)}
                    </button>
                  )}
                  {quizStats.answered > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px",
                      borderRadius: 999, background: "rgba(61,214,140,0.12)",
                      border: "1px solid rgba(61,214,140,0.3)", color: "#3DD68C",
                    }}>
                      🧠 {quizStats.correct}/{quizStats.answered}
                    </span>
                  )}
                  <button
                    style={{ ...s.chatMiniBtn, color: confirmNewChat ? T.accent : T.muted }}
                    onClick={startNewChat}
                    aria-label="Start a new chat"
                    title="New chat"
                  >
                    {confirmNewChat ? "Clear?" : "＋"}
                  </button>
                  <button style={s.chatClose} onClick={hideChat} aria-label="Close chat">✕</button>
                </span>
              </div>

              <div ref={chatScrollRef} style={s.chatThread} onScroll={onChatScroll}>
                {chatMessages.length === 0 && !chatLoading && (
                  <div style={s.emptyWrap}>
                    <AiOrb size={44} pulsing style={{ marginBottom: 6 }} />
                    <div style={s.emptyTitle}>Scholar</div>
                    <div style={s.emptyText}>
                      Circle anything on the page to ask about it — I explain concepts,
                      solve problems, and quiz you as you read.
                    </div>
                    <div style={s.welcomeCards}>
                      {WELCOME_CARDS.map((c) => (
                        <button key={c.label} style={s.welcomeCard} className="sc-welcome-card" onClick={() => sendFollowUp(c.prompt)}>
                          <span style={{ fontSize: 15 }}>{c.icon}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text }}>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={msg.role === "user" ? s.msgUser : s.msgAssistant}>
                    {msg.role === "assistant" && <AiOrb size={18} pulsing={!!msg.streaming} style={{ marginTop: 2 }} />}
                    {msg.role === "user" && msg.image && (
                      <button
                        style={s.msgImageWrap}
                        onClick={() => msg.page != null && goToPage(msg.page)}
                        aria-label={msg.page != null ? `Jump to page ${msg.page}` : "Circled content"}
                      >
                        <img src={msg.image} alt="Circled content" style={s.msgImage} />
                        {msg.page != null && <span style={s.imgPageBadge}>p.{msg.page}</span>}
                      </button>
                    )}
                    {msg.role === "assistant"
                      ? (
                        <div style={s.msgCard}>
                          {msg.image && (
                            <button
                              style={s.msgImageWrap}
                              onClick={() => msg.page != null && goToPage(msg.page)}
                              aria-label={msg.page != null ? `Jump to page ${msg.page}` : "Circled content"}
                            >
                              <img src={msg.image} alt="Circled content" style={s.msgImage} />
                              {msg.page != null && <span style={s.imgPageBadge}>p.{msg.page}</span>}
                            </button>
                          )}
                          {(chatSegs[i] || []).map((seg, j) => {
                            if (seg.type === "mcq") {
                              const qNum = mcqPrefix[i] + (chatSegs[i].slice(0, j + 1).filter((sg) => sg.type === "mcq").length);
                              const key = `${i}:${j}`;
                              const res = quizResults[key];
                              return (
                                <div key={j}>
                                  <McqCard
                                    mcq={seg.mcq}
                                    T={T}
                                    qNum={qNum}
                                    stats={quizStats}
                                    picked={res?.picked ?? null}
                                    onPick={(orig) => {
                                      setQuizResults((prev) => ({
                                        ...prev,
                                        [key]: { picked: orig, correct: orig === seg.mcq.answer },
                                      }));
                                      handleChatQuizPick(seg.mcq, orig);
                                    }}
                                    onNext={() => requestNextQuestion(res)}
                                  />
                                  {res && (
                                    <div style={{ marginTop: -4, marginBottom: 8, marginLeft: 2 }}>
                                      {!deckHintSeen && !deckAddedKeys[key] && (
                                        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 2 }}>
                                          Your deck powers Survival Quiz & daily review — keep questions worth remembering.
                                        </div>
                                      )}
                                      <button
                                        style={{
                                          background: "none", border: "none", cursor: deckAddedKeys[key] ? "default" : "pointer",
                                          color: deckAddedKeys[key] ? "#3d9970" : T.accent,
                                          fontSize: 11.5, fontWeight: 600, padding: "2px 4px", fontFamily: "inherit",
                                        }}
                                        onClick={() => addChatMcqToDeck(seg.mcq, msg.page, key)}
                                        disabled={!!deckAddedKeys[key]}
                                        title="Save this question to your Survival Quiz deck (FSRS-scheduled)"
                                      >
                                        {deckAddedKeys[key] ? "✓ In your deck" : "＋ Add to deck"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            if (seg.type === "mcq_error") {
                              return (
                                <McqCard
                                  key={j}
                                  T={T}
                                  error
                                  onRetry={() => sendFollowUp("That quiz question didn't render — please send it again in the exact mcq format.")}
                                />
                              );
                            }
                            return <MarkdownText key={j} theme={theme} onGotoPage={goToPage}>{seg.text}</MarkdownText>;
                          })}
                          {msg.streaming && <span style={s.streamCursor} />}
                          {msg.sources?.length > 0 && (
                            <div style={s.srcRow}>
                              <span style={s.srcLabel}>📄 Pages used</span>
                              {msg.sources.map((p) => (
                                <button key={p} style={s.srcChip} onClick={() => goToPage(p)} aria-label={`Jump to page ${p}`}>
                                  p.{p}
                                </button>
                              ))}
                            </div>
                          )}
                          {!msg.streaming && (
                            <div style={s.msgActions} className="sc-msg-actions">
                              <button
                                style={s.msgActionBtn}
                                onClick={() => copyMessage(i, msg)}
                                aria-label="Copy answer"
                              >
                                {copiedIdx === i ? "✓ Copied" : "📋 Copy"}
                              </button>
                              {!(chatSegs[i] || []).some((sg) => sg.type === "mcq") && (
                                <button
                                  style={s.msgActionBtn}
                                  onClick={() => saveAsQuiz(msg, i)}
                                  disabled={savedFlashIdx === i || chatLoading}
                                  aria-label="Turn this answer into deck questions"
                                >
                                  {savedFlashIdx === i ? "✓ Queued" : "❓ Quiz"}
                                </button>
                              )}
                              {i === chatMessages.length - 1 && (
                                <button style={s.msgActionBtn} onClick={retryLastMessage} aria-label="Regenerate answer">
                                  ↻ Retry
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                      : msg.content}
                  </div>
                ))}
                {chatLoading && !chatMessages[chatMessages.length - 1]?.streaming && (
                  <ThinkingBubble s={s} />
                )}
                {chatError && (
                  <div style={s.msgError}>
                    <div style={{ fontWeight: 700 }}>⚠️ Scholar hit a snag</div>
                    <div style={{ fontSize: 11.5, opacity: 0.85 }}>{chatError}</div>
                    <button style={s.retryBtn} onClick={retryLastMessage}>↻ Try again</button>
                  </div>
                )}
              </div>

              {showJumpLatest && (
                <button
                  style={s.jumpLatest}
                  onClick={() => { chatNearBottomRef.current = true; scrollChatBottom(true); setShowJumpLatest(false); }}
                  aria-label="Jump to latest message"
                >
                  ↓ Latest
                </button>
              )}

              {showChips && (
                <div style={s.chipsRow} className="sc-chips-row">
                  {chipsToShow.map((chip) => (
                    <button key={chip.label} style={s.chip} onClick={() => sendFollowUp(chip.prompt)}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              <div style={s.chatInputRow}>
                <textarea
                  ref={inputRef}
                  style={s.chatTextarea}
                  className="sc-chat-input"
                  rows={1}
                  placeholder={chatMessages.length === 0 ? `Ask about p.${chatCtxPage}…` : "Ask a follow-up…"}
                  value={chatInput}
                  onChange={(e) => { setChatInput(e.target.value); autoGrowInput(e.target); }}
                  onKeyDown={handleChatKeyDown}
                  aria-label="Chat message"
                />
                <button
                  style={{
                    ...s.chatSendBtn,
                    opacity: chatLoading || chatInput.trim() ? 1 : 0.35,
                    cursor: chatLoading || chatInput.trim() ? "pointer" : "default",
                  }}
                  onClick={() => (chatLoading ? stopStream() : sendFollowUp(chatInput))}
                  disabled={!chatLoading && !chatInput.trim()}
                  aria-label={chatLoading ? "Stop generating" : "Send message"}
                >
                  {chatLoading ? "■" : "↑"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>{/* end workspace */}

          {/* Page scrubber — Apple-style floating mini-thumb, top-right.
              Drag vertically to skim pages; tap opens the thumbnails panel. */}
          {!chromeHidden && !loading && !loadError && numPages > 1 && (
            <div
              style={{
                position: "absolute",
                top: isMobile ? 108 : 62,
                right: (chatOpen && dockMode ? dockW : 0) + (studyToolsOpen && dockMode ? dockW : 0) + 12,
                zIndex: 48,
                opacity: scrubVisible && !(isMobile && (showOverflow || studyToolsOpen)) ? 1 : 0,
                transform: scrubVisible ? "translateX(0)" : "translateX(12px)",
                pointerEvents: scrubVisible && !(isMobile && (showOverflow || studyToolsOpen)) ? "auto" : "none",
                transition: "opacity 0.22s ease, transform 0.22s ease",
                touchAction: "none",
              }}
              onPointerDown={onScrubDown}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubEnd}
              onPointerCancel={onScrubEnd}
              onClick={(e) => { e.stopPropagation(); if (!scrubMoved.current) setShowThumbs(true); }}
            >
              <div
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: 5, borderRadius: 10, cursor: "grab",
                  background: `${T.toolbar}E6`,
                  backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
                  border: `1px solid ${T.border}`,
                  boxShadow: `0 8px 22px ${T.shadow}`,
                }}
              >
                {thumbs[currentPage - 1]?.dataUrl ? (
                  <img src={thumbs[currentPage - 1].dataUrl} alt="" draggable={false} style={{ width: 34, borderRadius: 3, display: "block" }} />
                ) : (
                  <div style={{ width: 34, height: 44, borderRadius: 3, background: T.hover }} />
                )}
                <span style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", fontWeight: 700, color: T.accent }}>{currentPage}</span>
              </div>
            </div>
          )}

          {/* Circle-to-Ask active — Google-style light overlay (non-blocking,
              pointer-events none so lasso/pointer drawing still works) */}
          {circleMode && !loading && !loadError && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none",
              boxShadow: "inset 0 0 0 1.5px rgba(79,142,247,0.5), inset 0 -100px 140px -70px rgba(79,142,247,0.32), inset 0 100px 140px -70px rgba(79,142,247,0.2)",
              background: "linear-gradient(180deg, rgba(79,142,247,0.05), rgba(79,142,247,0.015) 40%, rgba(79,142,247,0.05))",
            }}>
              <div className="pdf-circle-hint" style={{
                position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)",
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 15px", borderRadius: 22,
                background: "rgba(15,20,32,0.88)", color: "#dbe6ff",
                fontSize: 12.5, fontWeight: 600, fontFamily: "Manrope, system-ui, sans-serif",
                whiteSpace: "nowrap", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" strokeDasharray="3.2 3.2"/></svg>
                Circle, highlight, or tap anything — AI explains it
              </div>
            </div>
          )}

          {/* "Read & ask AI" nudge — the intro didn't arm the tool; point at it */}
          {askNudge && !circleMode && !loading && !loadError && (
            <div className="pdf-circle-hint pdf-circle-hint--sticky" style={{
              position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)",
              zIndex: 60, pointerEvents: "none",
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 15px", borderRadius: 22,
              background: "rgba(15,20,32,0.88)", color: "#dbe6ff",
              fontSize: 12.5, fontWeight: 600, fontFamily: "Manrope, system-ui, sans-serif",
              whiteSpace: "nowrap", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" strokeDasharray="3.2 3.2"/></svg>
              Tap <b style={{ color: "#8fb8ff" }}>Ask AI</b> below, then circle anything on the page
            </div>
          )}

          {/* Floating nav pill — page nav + zoom + circle-to-ask (mobile & desktop) */}
          {!chromeHidden && !loading && !loadError && (
            <div
              style={{
                ...s.navDock,
                right: (chatOpen && dockMode ? dockW : 0) + (studyToolsOpen && dockMode ? dockW : 0),
                // Sheets own the bottom of the screen — fade the pill out
                // instead of letting it poke through under the panel.
                opacity: isMobile && (showOverflow || studyToolsOpen) ? 0 : 1,
                pointerEvents: isMobile && (showOverflow || studyToolsOpen) ? "none" : "auto",
                transition: "opacity 0.18s ease",
              }}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div style={s.navPill}>
                {isMobile && (
                  <>
                    <button
                      style={{ ...s.navBtn, opacity: currentPage <= 1 ? 0.35 : 1 }}
                      onClick={() => stepPage(-1)}
                      disabled={currentPage <= 1}
                      title="Previous page"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button
                      style={{ ...s.pageChip, background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => setPageJumpOpen(true)}
                      title="Jump to page"
                      aria-label="Jump to page"
                    >
                      {scrollMode === "book" && currentPage + 1 <= numPages ? `${currentPage}–${currentPage + 1}` : currentPage} / {numPages}
                    </button>
                    <button
                      style={{ ...s.navBtn, opacity: currentPage >= numPages ? 0.35 : 1 }}
                      onClick={() => stepPage(1)}
                      disabled={currentPage >= numPages}
                      title="Next page"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <span style={s.navDivider} />
                  </>
                )}
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    height: 30,
                    borderRadius: 999,
                    padding: "0 12px",
                    color: tool === "circle" ? "white" : CHROME.blue,
                    background: tool === "circle" ? CHROME.blue : "rgba(79,142,247,0.12)",
                    border: tool === "circle" ? "none" : "1px solid rgba(79,142,247,0.3)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    transition: "all 0.15s ease",
                  }}
                  className={askNudge ? "pdf-ask-pulse" : undefined}
                  onClick={() => toggleTool("circle")}
                  title="Circle to Ask AI"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" strokeDasharray="3.2 3.2"/></svg>
                  Ask AI
                </button>
              </div>
            </div>
          )}

          {/* AI Study Tools floating button — hidden only under the mobile sheet; the
              desktop dock leaves the document usable so the FAB stays visible */}
          {(!chatOpen || dockMode) && !loading && !loadError && !chromeHidden && !(voiceActive && !voiceMinimized) && (
            isMobile ? (
              <button
                style={{
                  ...s.aiFab,
                  opacity: studyToolsOpen || showOverflow ? 0 : 1,
                  pointerEvents: studyToolsOpen || showOverflow ? "none" : "auto",
                }}
                onClick={openStudyTools}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                title="AI Study Tools"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>
                </svg>
                {dueCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px",
                    borderRadius: 999, background: "linear-gradient(145deg, #FFC24B, #F5A623)",
                    color: "#1a1200", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center",
                    justifyContent: "center", boxShadow: "0 2px 8px rgba(245,166,35,0.5)",
                  }}>{dueCount > 99 ? "99" : dueCount}</span>
                )}
              </button>
            ) : (
              <button
                style={{
                  ...s.studyFab,
                  opacity: studyToolsOpen || showOverflow ? 0 : 1,
                  pointerEvents: studyToolsOpen || showOverflow ? "none" : "auto",
                }}
                onClick={openStudyTools}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                title="AI Study Tools"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>
                </svg>
                {dueCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px",
                    borderRadius: 999, background: "linear-gradient(145deg, #FFC24B, #F5A623)",
                    color: "#1a1200", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center",
                    justifyContent: "center", boxShadow: "0 2px 8px rgba(245,166,35,0.5)",
                  }}>{dueCount > 99 ? "99" : dueCount}</span>
                )}
              </button>
            )
          )}


          {/* Page Tutor mini player — audio keeps playing while the panel is closed */}
          {/* ── Annotate tool dock — persistent while a tool is armed ── */}
          {annotateTab !== "none" && (
            <div style={s.toolDock} onPointerDown={(e) => e.stopPropagation()}>
              {[
                { t: "pen", tint: CHROME.blue, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
                { t: "highlight", tint: CHROME.gold, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18h6l-3 3z" fill="currentColor"/><path d="M9.5 14.5l5-5m-7 7l7-7L17 12l-7 7-2.5-2.5z"/></svg> },
                { t: "line", tint: CHROME.blue, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 19L19 5"/></svg> },
                { t: "arrow", tint: CHROME.blue, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 19L19 5M19 5h-7M19 5v7"/></svg> },
                { t: "erase", tint: CHROME.coral, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16a2 2 0 0 1 0-2.8L13.2 3a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L11 20"/></svg> },
              ].map(({ t, tint, icon }) => (
                <button
                  key={t}
                  style={{ ...s.dockBtn, color: annotateTab === t ? tint : T.muted, background: annotateTab === t ? `${tint === CHROME.gold ? "rgba(245,166,35,0.16)" : tint === CHROME.coral ? "rgba(227,93,106,0.14)" : "rgba(79,142,247,0.16)"}` : "none", borderColor: annotateTab === t ? `${tint === CHROME.gold ? "rgba(245,166,35,0.45)" : tint === CHROME.coral ? "rgba(227,93,106,0.4)" : "rgba(79,142,247,0.4)"}` : "transparent" }}
                  onClick={() => selectAnnotateTab(t)}
                  title={{ pen: "Pen", highlight: "Marker", line: "Line", arrow: "Arrow", erase: "Eraser" }[t]}
                  aria-label={t}
                >
                  {icon}
                </button>
              ))}
              <span style={s.dockSep} />
              {(annotateTab === "pen" || annotateTab === "line" || annotateTab === "arrow") && (
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {INK_COLORS.map((c) => (
                    <button key={c.name} style={{ ...s.dockSwatch, background: c.value, boxShadow: penColor === c.value ? `0 0 0 2px ${T.toolbar}, 0 0 0 3.5px ${CHROME.blue}` : "none" }} onClick={() => setPenColor(c.value)} title={c.name} aria-label={c.name} />
                  ))}
                </div>
              )}
              {annotateTab === "highlight" && (
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button key={c.name} style={{ ...s.dockSwatch, background: c.value, boxShadow: highlightColor === c.value ? `0 0 0 2px ${T.toolbar}, 0 0 0 3.5px ${CHROME.gold}` : "none" }} onClick={() => setHighlightColor(c.value)} title={c.name} aria-label={c.name} />
                  ))}
                </div>
              )}
              {(annotateTab === "pen" || annotateTab === "line" || annotateTab === "arrow") && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {PEN_WIDTHS.map((w) => (
                    <button key={w} style={{ ...s.dockBtn, width: 26, height: 26 }} onClick={() => setPenWidth(w)} title={`${w}px`} aria-label={`Stroke ${w}px`}>
                      <div style={{ width: 16, height: w, borderRadius: w, background: penWidth === w ? CHROME.blue : T.muted }} />
                    </button>
                  ))}
                </div>
              )}
              {annotateTab === "highlight" && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {HIGHLIGHT_WIDTHS.map((w) => (
                    <button key={w} style={{ ...s.dockBtn, width: 26, height: 26 }} onClick={() => setHighlightWidth(w)} title={`${w}px`} aria-label={`Thickness ${w}px`}>
                      <div style={{ width: 16, height: Math.min(10, w / 2), borderRadius: 3, background: highlightWidth === w ? CHROME.gold : T.muted }} />
                    </button>
                  ))}
                </div>
              )}
              <span style={s.dockSep} />
              <button
                style={{ ...s.dockBtn, color: undoCount ? T.text : T.muted, opacity: undoCount ? 1 : 0.4 }}
                onClick={undoLast}
                disabled={!undoCount}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>
              </button>
              <button
                style={{ ...s.dockBtn, color: "#4ADE80", background: "rgba(74,222,128,0.12)", borderColor: "rgba(74,222,128,0.35)" }}
                onClick={() => toggleTool("none")}
                title="Done annotating"
                aria-label="Done"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6L9 17l-5-5"/></svg>
              </button>
            </div>
          )}

          {!studyToolsOpen && pageTutor.lesson && pageTutor.player.idx >= 0 && (
            <button
              onClick={() => { setStudyView("lesson"); openStudyTools(); }}
              style={{
                position: "fixed", bottom: isMobile ? 76 : 88, left: "50%", transform: "translateX(-50%)",
                zIndex: 95, display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 999, border: `1px solid ${T.border}`,
                background: `${T.toolbar}F0`, backdropFilter: "blur(12px)", boxShadow: `0 4px 18px ${T.shadow}`,
                color: T.text, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <span style={{ color: "#F5A623", fontSize: 13 }}>{pageTutor.player.playing ? "❚❚" : "▶"}</span>
              Page Tutor · p.{pageTutor.lesson.page}
            </button>
          )}

          {/* AI Study Tools panel — mobile bottom sheet / desktop side panel */}
          {studyToolsOpen && (
            <>
              {isMobile && <div style={s.studyBackdrop} onClick={closeStudyTools} onTouchStart={(e) => e.stopPropagation()} />}
              <div style={s.studyPanel} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                {isMobile && <div style={s.sheetHandle} />}
                <div style={s.studyHead}>
                  <span style={s.studyTitle}>
                    {studyView !== "tools" ? (
                      <>
                        <button
                          onClick={() => setStudyView("tools")}
                          style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer", padding: "0 4px 0 0", fontFamily: "inherit" }}
                          title="Back to tools"
                        >‹</button>
                        {studyView === "review" ? "Chapter review" : `Page Tutor · p.${currentPage}`}
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>
                        </svg>
                        AI Study Tools
                      </>
                    )}
                  </span>
                  <button style={s.studyClose} onClick={closeStudyTools}>✕</button>
                </div>

                {studyView === "review" ? (
                  <ChapterReview
                    T={T}
                    items={pageTutor.reviewItems}
                    resourceId={propResourceId}
                    duePages={duePages}
                    deckItems={studyDeck.items}
                    onJumpPage={(p) => { goToPage(p); setStudyView("lesson"); }}
                    onRankCheck={checkRankCelebration}
                    onFinish={(c, t) => {
                      const r = { c, t, at: Date.now() };
                      setLastReview(r);
                      saveStored(`sc_review_last_${docKey}`, r);
                    }}
                  />
                ) : studyView === "lesson" ? (
                  <>
                  <LectureBar
                    T={T}
                    page={currentPage}
                    numPages={numPages}
                    tutor={pageTutor}
                    ctl={{ lecture, blocked: lectureBlocked, prep: lecturePrep, premium: aiUsage?.isActivated, start: startLecture, stop: stopLecture, resume: resumeLecture }}
                  />
                  <LessonPanel
                    T={T}
                    page={currentPage}
                    tutor={pageTutor}
                    onAskVoice={handleTutorAsk}
                    onSeeOnPage={handleSeeOnPage}
                    onToast={(m) => toastDeck(m)}
                    follow={followAlong}
                    onToggleFollow={() => setFollowAlong((f) => !f)}
                  />
                  </>
                ) : (
                <>

                {aiUsage && !aiUsage.isActivated && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    margin: "0 12px 8px",
                    borderRadius: 8,
                    background: "rgba(250, 204, 21, 0.1)",
                    border: "1px solid rgba(250, 204, 21, 0.3)",
                    fontSize: 12,
                    color: "#facc15",
                  }}>
                    <span>⚡ AI requests remaining today: {Math.max(0, aiUsage.limit - aiUsage.used)}/{aiUsage.limit}</span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>Upgrade for unlimited</span>
                  </div>
                )}

                  {propResourceId && (
                    <div role="tablist" aria-label="Study tools" style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
                      {[["tools", "Tools"], ["deck", `Deck${studyDeck.items.length ? ` (${studyDeck.items.length})` : ""}`]].map(([id, label]) => (
                        <button
                          key={id}
                          role="tab"
                          aria-selected={studyTab === id}
                          onClick={() => setStudyTab(id)}
                          style={{
                            flex: 1, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                            border: `1px solid ${studyTab === id ? T.accent : T.border}`,
                            background: studyTab === id ? T.accent : "transparent",
                            color: studyTab === id ? "#fff" : T.muted,
                          }}
                        >{label}</button>
                      ))}
                    </div>
                  )}

                  {propResourceId && studyTab === "deck" && (
                    <div style={s.studyBody}>
                      <PdfDeckTab
                        resourceId={propResourceId}
                        T={T}
                        deck={studyDeck}
                        onJump={(p) => { goToPage(p); if (isMobile) closeStudyTools(); }}
                      />
                    </div>
                  )}

                  <div style={{ ...s.studyBody, ...(propResourceId && studyTab === "deck" ? { display: "none" } : null) }}>

                    {/* Progress ring — pages tutored so far */}
                    {propResourceId && numPages > 0 && pageTutor.lessonPages.size > 0 && (() => {
                      const C = 2 * Math.PI * 15;
                      const pct = Math.min(1, pageTutor.lessonPages.size / numPages);
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 2px 6px", animation: "sc-fade-in-up .35s ease both" }}>
                          <svg width="32" height="32" viewBox="0 0 36 36">
                            <defs>
                              <linearGradient id="pt-ring-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#FFD166" />
                                <stop offset="100%" stopColor="#F5A623" />
                              </linearGradient>
                            </defs>
                            <circle cx="18" cy="18" r="15" fill="none" stroke={T.border} strokeWidth="3" />
                            <circle cx="18" cy="18" r="15" fill="none" stroke="url(#pt-ring-grad)" strokeWidth="3" strokeLinecap="round"
                              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 18 18)"
                              style={{ transition: "stroke-dashoffset .6s ease" }} />
                          </svg>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{pageTutor.lessonPages.size}/{numPages} pages tutored</div>
                            <div style={{ fontSize: 10.5, color: T.muted }}>Lessons are shared with everyone reading this doc</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Learn ── */}
                    {propResourceId && (
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: "12px 2px 4px" }}>Learn</div>
                    )}
                    {propResourceId && (
                      <button
                        onClick={handleExplain}
                        disabled={pageTutor.status === "loading"}
                        style={{
                          position: "relative", overflow: "hidden",
                          display: "flex", alignItems: "center", gap: 10,
                          width: "100%", padding: "13px 14px", borderRadius: 14,
                          border: "none",
                          background: "linear-gradient(135deg, #FFC24B 0%, #F5A623 55%, #E8940C 100%)",
                          boxShadow: "0 4px 18px rgba(245,166,35,0.35)",
                          color: "#1B212D",
                          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          opacity: pageTutor.status === "loading" ? 0.7 : 1,
                          animation: "sc-fade-in-up .35s ease both", animationDelay: "50ms",
                        }}
                      >
                        <div className="sc-shimmer-bar" style={{ position: "absolute", inset: 0, opacity: 0.22, pointerEvents: "none" }} />
                        <span style={{ fontSize: 18 }}>✨</span>
                        <span style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>Explain this page</div>
                          <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
                            Simple walkthrough + audio · page {currentPage}
                          </div>
                        </span>
                        <span style={{ fontSize: 15 }}>›</span>
                      </button>
                    )}

                    {/* Chapter review — mixed quiz across explained pages */}
                    {propResourceId && (pageTutor.reviewItems.length >= 3 ? (
                      <button
                        onClick={() => setStudyView("review")}
                        className="sc-tool-card"
                        style={{
                          display: "flex", alignItems: "center", gap: 10, marginTop: 8,
                          width: "100%", padding: "12px 14px", borderRadius: 12,
                          border: `1px solid ${dueCount > 0 ? "rgba(245,166,35,0.5)" : T.border}`,
                          background: dueCount > 0 ? "rgba(245,166,35,0.07)" : T.hover,
                          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          animation: "sc-fade-in-up .35s ease both", animationDelay: "100ms",
                        }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgba(245,166,35,0.14)", color: "#F5A623", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>🧠</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Chapter review</div>
                          <div style={{ fontSize: 11, lineHeight: 1.4, color: dueCount > 0 ? "#F5A623" : T.muted, fontWeight: dueCount > 0 ? 700 : 400 }}>
                            {dueCount > 0
                              ? `⚡ ${dueCount} due now`
                              : `${pageTutor.reviewItems.length} questions across ${pageTutor.lessonPages.size} page${pageTutor.lessonPages.size !== 1 ? "s" : ""}`}
                            {lastReview ? <span style={{ color: T.muted, fontWeight: 400 }}> · Last: {lastReview.c}/{lastReview.t}</span> : ""}
                          </div>
                        </div>
                        <span style={{ fontSize: 15, color: T.muted }}>›</span>
                      </button>
                    ) : (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10, marginTop: 8,
                        width: "100%", padding: "12px 14px", borderRadius: 12,
                        border: `1px dashed ${T.border}`, background: "transparent", opacity: 0.7,
                        animation: "sc-fade-in-up .35s ease both", animationDelay: "100ms",
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: T.hover, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>🧠</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.muted }}>Chapter review</div>
                          <div style={{ fontSize: 11, color: T.muted }}>Explain pages to unlock a mixed quiz</div>
                        </div>
                        <span style={{ fontSize: 12 }}>🔒</span>
                      </div>
                    ))}

                    {/* ── Ask ── */}
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: "16px 2px 4px" }}>Ask</div>
                    <button
                      onClick={openChatDirect}
                      className="sc-tool-card"
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", padding: "12px 14px", borderRadius: 12,
                        border: `1px solid ${T.border}`, background: T.hover,
                        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                        marginBottom: 8,
                        animation: "sc-fade-in-up .35s ease both", animationDelay: "130ms",
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: "rgba(79,142,247,0.14)", color: "#4F8EF7", fontSize: 17,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        💬
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Chat with AI</div>
                        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
                          Ask about this page — or circle anything to ask directly.
                        </div>
                      </div>
                      <span style={{ fontSize: 15, color: T.muted }}>›</span>
                    </button>

                    {/* Voice Tutor — one-tap, uses saved voice prefs */}
                    {propResourceId && (
                      <button
                        onClick={() => handleVoiceStart()}
                        disabled={voice.state === VOICE_STATES.CONNECTING}
                        className="sc-tool-card"
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          width: "100%", padding: "10px 14px", borderRadius: 12,
                          border: `1px solid ${T.border}`, background: "transparent",
                          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          marginBottom: 14,
                          opacity: voice.state === VOICE_STATES.CONNECTING ? 0.6 : 1,
                          animation: "sc-fade-in-up .35s ease both", animationDelay: "160ms",
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: T.accent, color: "white", fontSize: 14,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          🎙️
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>
                            {voice.state === VOICE_STATES.CONNECTING ? "Connecting…" : "Voice Tutor"}
                          </div>
                          <div style={{ fontSize: 10.5, color: T.muted }}>Hands-free · {voiceName}</div>
                        </div>
                        <span style={{ fontSize: 14, color: T.muted }}>›</span>
                      </button>
                    )}
                    {voice.error && (
                      <div style={{ ...s.studyErrorBox, marginBottom: 12 }}>{voice.error}</div>
                    )}
                  </div>
                </>
                )}

              </div>
            </>
          )}



          {rankCelebration && (
            <Celebration
              from={rankCelebration.from}
              to={rankCelebration.to}
              passed={rankCelebration.passed}
              tier={rankCelebration.tier}
              onDone={closeCelebration}
            />
          )}

          {loading && (
            <div style={s.loadingOverlay}>
              <span style={s.spinner} /> Loading PDF…
            </div>
          )}
          {loadError && (
            <div style={{ ...s.loadingOverlay, color: T.accent }}>{loadError}</div>
          )}

          {/* ── Voice Tutor: Expanded overlay ──────────────────────────────────── */}
          {voiceActive && !voiceMinimized && (
            <div style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(var(--app-glass-rgb),0.55)",
              backdropFilter: "blur(24px) saturate(1.15)",
              WebkitBackdropFilter: "blur(24px) saturate(1.15)",
              padding: "0 16px",
            }}>
              {/* Title chip */}
              <div style={{
                position: "absolute",
                top: 16,
                left: 20,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 14px",
                borderRadius: 999,
                background: "var(--app-tint-med)",
                border: "1px solid var(--app-tint-med)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                fontSize: 12.5,
                fontWeight: 600,
                color: COLORS.text,
              }}>
                <span style={{ fontSize: 14 }}>🎙️</span>
                Voice Tutor
                <span style={{ color: COLORS.textDim, fontWeight: 500 }}>· {voiceName}</span>
              </div>

              {/* Timer chip */}
              <div style={{
                position: "absolute",
                top: 16,
                right: 20,
                padding: "7px 14px",
                borderRadius: 999,
                background: "var(--app-tint-med)",
                border: "1px solid var(--app-tint-med)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                fontSize: 12.5,
                fontWeight: 600,
                color: COLORS.text,
                fontFamily: "ui-monospace, monospace",
              }}>
                {vtTimer}
              </div>

              {/* Voice orb with state glow */}
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{
                  position: "absolute",
                  width: isMobile ? 260 : 320,
                  height: isMobile ? 260 : 320,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${vtStateColor}38 0%, transparent 65%)`,
                  transition: "background 0.4s ease",
                  pointerEvents: "none",
                }} />
                <VoiceOrb
                  state={voice.state}
                  micLevel={voice.micLevel}
                  size={isMobile ? 180 : 220}
                  getAudioData={voice.getAudioData}
                />
              </div>

              {/* Status pill */}
              <div style={{
                marginTop: 18,
                padding: "8px 18px",
                borderRadius: 999,
                background: "var(--app-tint-med)",
                border: "1px solid var(--app-tint-med)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.text,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: vtStateColor,
                  boxShadow: `0 0 8px ${vtStateColor}`,
                }} />
                {vtStateLabel}
              </div>

              {/* Transcript overlay */}
              {voice.transcript.length > 0 && (
                <div style={{
                  marginTop: 14,
                  width: isMobile ? "92%" : 480,
                  maxWidth: "92vw",
                  maxHeight: isMobile ? "30dvh" : "200px",
                  overflowY: "auto",
                  padding: "10px 12px",
                  borderRadius: 18,
                  background: "var(--app-tint-soft)",
                  border: "1px solid var(--app-tint-med)",
                }}>
                  <TranscriptOverlay transcript={voice.transcript} />
                </div>
              )}

              {/* Text fallback input */}
              {voice.fallbackMode && (
                <div style={{
                  marginTop: 12,
                  width: isMobile ? "92%" : 460,
                  maxWidth: "92vw",
                  display: "flex",
                  gap: 6,
                  padding: 6,
                  borderRadius: 999,
                  background: "var(--app-tint-med)",
                  border: "1px solid var(--app-tint-med)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}>
                  <input
                    style={{
                      flex: 1,
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: "none",
                      background: "transparent",
                      color: COLORS.text,
                      fontSize: 14,
                      outline: "none",
                    }}
                    placeholder="Type your question…"
                    value={voiceTextInput}
                    onChange={(e) => setVoiceTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && voiceTextInput.trim()) {
                        voice.sendText(voiceTextInput);
                        setVoiceTextInput("");
                      }
                    }}
                  />
                  <button
                    style={{
                      padding: "8px 18px",
                      borderRadius: 999,
                      background: COLORS.electric,
                      color: "white",
                      border: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (voiceTextInput.trim()) {
                        voice.sendText(voiceTextInput);
                        setVoiceTextInput("");
                      }
                    }}
                  >
                    Send
                  </button>
                </div>
              )}

              {/* Controls */}
              <div style={{
                marginTop: 20,
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "8px 10px",
                borderRadius: 999,
                background: "rgba(var(--app-glass-rgb),0.55)",
                border: "1px solid var(--app-tint-med)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
              }}>
                {/* Hands-free toggle */}
                <button
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: voice.handsFreeMode ? "none" : "1px solid var(--app-tint-med)",
                    background: voice.handsFreeMode ? COLORS.electric : "transparent",
                    color: voice.handsFreeMode ? "white" : COLORS.textDim,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s ease, color 0.2s ease",
                  }}
                  onClick={voice.toggleHandsFree}
                  title="Hands-free mode"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>
                    <path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7"/>
                    <path d="M5.6 5.6a9 9 0 000 12.8M18.4 5.6a9 9 0 010 12.8"/>
                  </svg>
                </button>

                {/* Mic toggle (when not hands-free) */}
                {!voice.handsFreeMode && (
                  <button
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      border: "none",
                      background: voice.state === VOICE_STATES.LISTENING ? COLORS.electric : "var(--app-tint-med)",
                      color: voice.state === VOICE_STATES.LISTENING ? "white" : COLORS.text,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: voice.state === VOICE_STATES.LISTENING ? `0 0 0 4px rgba(79,142,247,0.25)` : "none",
                      transition: "background 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onClick={voice.toggleListening}
                    title="Tap to talk"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
                      <path d="M5 11a7 7 0 0014 0M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}

                {/* Minimize */}
                <button
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: "1px solid var(--app-tint-med)",
                    background: "transparent",
                    color: COLORS.textDim,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={handleVoiceMinimize}
                  title="Minimize — keep reading while it runs"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="4 14 10 14 10 20"/>
                    <polyline points="20 10 14 10 14 4"/>
                    <line x1="14" y1="10" x2="21" y2="3"/>
                    <line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                </button>

                {/* End session */}
                <button
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(239,68,68,0.18)",
                    color: "#ef4444",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={handleVoiceEnd}
                  title="End session"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Voice error */}
              {voice.error && (
                <div style={{
                  marginTop: 12,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  fontSize: 12,
                  color: "#ef4444",
                  maxWidth: 400,
                  textAlign: "center",
                }}>
                  {voice.error}
                </div>
              )}
            </div>
          )}

          {/* ── Voice Tutor: Minimized floating widget ─────────────────────────── */}
          {voiceActive && voiceMinimized && (
            <div style={{
              position: "fixed",
              bottom: isMobile ? "calc(80px + env(safe-area-inset-bottom))" : "90px",
              right: isMobile ? 16 : 24,
              zIndex: 250,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px 7px 8px",
              borderRadius: 999,
              background: "rgba(var(--app-glass-rgb),0.72)",
              border: "1px solid var(--app-tint-med)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}>
              {/* Mini orb — tap to expand */}
              <div
                onClick={handleVoiceExpand}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 0 0 2px ${vtStateColor}`,
                  transition: "box-shadow 0.3s ease",
                }}
                title="Expand Voice Tutor"
              >
                <VoiceOrb
                  state={voice.state}
                  micLevel={voice.micLevel}
                  size={30}
                  getAudioData={voice.getAudioData}
                />
              </div>

              {/* Status + timer — tap to expand */}
              <div
                onClick={handleVoiceExpand}
                style={{ cursor: "pointer", display: "flex", flexDirection: "column", lineHeight: 1.25 }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>
                  {vtStateLabel || "Voice Tutor"}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.textDim, fontFamily: "ui-monospace, monospace" }}>
                  {vtTimer}
                </span>
              </div>

              {/* Expand */}
              <button
                style={{
                  width: 30, height: 30, borderRadius: "50%", border: "none",
                  background: "var(--app-tint-med)", color: COLORS.textDim,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onClick={handleVoiceExpand}
                title="Expand"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>

              {/* End */}
              <button
                style={{
                  width: 30, height: 30, borderRadius: "50%", border: "none",
                  background: "rgba(239,68,68,0.18)", color: "#ef4444",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onClick={handleVoiceEnd}
                title="End session"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}

          {showShortcuts && (
            <ShortcutsModal onClose={() => setShowShortcuts(false)} T={T} />
          )}

          {showStats && (
            <StatsModal
              stats={readingStats}
              numPages={numPages}
              strokeCount={Object.values(annotations).reduce((sum, strokes) => sum + (strokes?.length || 0), 0)}
              onClose={() => setShowStats(false)}
              T={T}
            />
          )}
    </div>
  );

  // iOS: in fullscreen, mount on document.body — fixed elements inside the
  // #root overflow scroller lose z-order to body-level fixed elements (nav)
  return fullscreen ? createPortal(reader, document.body) : reader;
}
