import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import AiOrb from "../../components/AiOrb.jsx";
import MarkdownText from "../../components/MarkdownText.jsx";
import McqCard from "../../components/McqCard.jsx";
import { parseMcqSegments } from "../../lib/mcqBlocks.js";
import { callAIMultimodalStream } from "../../lib/aiClient.js";
import { extractFileText } from "../../lib/extractFileText.js";
import { downscaleImage, readFileAsDataUrl } from "../../lib/imageUtils.js";
import { haptics } from "../../lib/haptics.js";
import { API_BASE } from "../../lib/constants.js";
import { QUIZ_NEXT_CHIPS } from "../pdf-reader/chatPrompts.js";
import { SCHOLAR_SYSTEM } from "./scholarPrompt.js";
import { useReviewPlan, examKeyOf, daysUntil, readiness } from "../../hooks/useReviewPlan.js";

const MAX_HISTORY = 10;
const SEEN_KEY = "sc_scholar_seen";
const FAB_KEY = "sc_scholar_fab_top";

// App-var-backed theme for McqCard (it only reads these fields).
const T = {
  border: "var(--app-line-strong)",
  hover: "var(--app-tint-med)",
  muted: "var(--app-dim)",
  text: "var(--app-text)",
  toolbar: "var(--app-card2)",
  accent: "var(--app-accent)",
};

const THINK_VERBS = ["Thinking", "Connecting ideas", "Drafting answer", "Checking details"];
const INTRO_KEY = "sc_scholar_intro";
const MOOD_KEY = "sc_mood_today";
// Daily check-in — id, chip label, the mascot's reply, orb reaction.
const MOODS = [
  ["good", "😊 Good", "Love it — let's make it count ✨", "excited"],
  ["okay", "😐 Okay", "Steady day — I'm here when you need me", "greeting"],
  ["struggling", "😩 Struggling", "Then we go light today — small wins only 💛", "greeting"],
  ["pumped", "⚡ Pumped", "Beast mode — let's go 🔥", "excited"],
];

// Questions phrased as "teach/study/learn me X" want the full AI Tutor, not a
// chat bubble — routed there with the topic prefilled. Conservative on
// purpose: plain "explain X" stays in chat.
const TUTOR_INTENT = /\b(teach me|tutor me|full lesson|lesson on|study\b|learn\b|roadmap|walk me through|i want to (learn|study)|help me (learn|study)|course on|tutorial on)\b/i;

const extractTopic = (q) =>
  q
    .replace(/^(please\s+)?(can you\s+|could you\s+|hey\s+)?/i, "")
    .replace(/^(teach me|tutor me|help me (to )?(learn|study|understand)|i want to (learn|study|understand)|study|learn( about)?|walk me through|give me a (full )?(lesson|tutorial|roadmap|course)( on)?|lesson on|roadmap for|course on|tutorial on)\s*/i, "")
    .replace(/[?.!\s]+$/g, "")
    .replace(/\b(in detail|in depth|deeply|step by step|from scratch|for beginners?|please)\b/gi, "")
    .trim()
    .slice(0, 120);

// Pull a studyable topic out of an answered question for the "learn deeply"
// route — "what is glycolysis" / "explain glycolysis" → "glycolysis".
const deepTopic = (q) =>
  q
    .replace(/^(please\s+)?(can you\s+|could you\s+|hey\s+|hi\s+|hello\s+|so\s+|okay\s+|ok\s+)?/i, "")
    .replace(/^(what (is|are|was|were|does|do|did|happens|happened)s?\s+|explain( to me| me)?|tell me( about)?|describe|define|discuss|how (does|do|did|can|to)\s+|why (is|are|does|do|was|did)\s+|break down|help me understand)\s*/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[?.!\s]+$/g, "")
    .trim();

// Only offer the deep-learn route after genuine knowledge questions — not
// commands, quiz flow, or chit-chat.
const COMMAND_START = /^(next|continue|another|repeat|again|more|simpler|easier|harder|yes\b|no\b|ok\b|okay|thanks|thank|stop|skip|i got|got it|correct|wrong|try again|summarize my|explain my attached|quiz me on my attached)/i;
const looksLearnable = (q) => {
  const t = (q || "").trim();
  return t.length >= 4 && t.length <= 80 && !COMMAND_START.test(t);
};

const ThinkingBubble = () => {
  const [vi, setVi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setVi((v) => (v + 1) % THINK_VERBS.length), 1700);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--app-dim)", fontSize: 12.5, padding: "8px 4px" }}>
      <span className="gs-typing"><i /><i /><i /></span>
      {THINK_VERBS[vi]}…
    </div>
  );
};

// Nearest upcoming exam across all folders (null when none within 60d).
function nextExam(folders, prefs) {
  let best = null;
  for (const f of folders || []) {
    const d = daysUntil(prefs?.[examKeyOf(f)]);
    if (d != null && d >= 0 && d <= 60 && (!best || d < best.days)) {
      best = { name: f.folderName || f.courseCode || "Your course", days: d };
    }
  }
  return best;
}

// Lowest-readiness folder with enough items to be meaningful.
function weakestFolder(folders) {
  let weak = null;
  for (const f of folders || []) {
    if ((f.total || 0) < 5) continue;
    const r = readiness(f);
    if (!weak || r < weak.r) weak = { name: f.folderName || f.courseCode || "a subject", r };
  }
  return weak;
}

/**
 * The app's global Scholar — a floating orb on the Home screen that opens a
 * chat sheet. Proactive welcome cards come from live FSRS folders + exam
 * dates; "teach/study/learn me X" questions route to the full AI Tutor with
 * the topic prefilled.
 *
 * Other surfaces can open it via `window.dispatchEvent(new CustomEvent("sc-open-scholar"))`.
 */
export default function GlobalScholar({ hidden = false, onOpenAITutor, theme = "dark" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [quizResults, setQuizResults] = useState({});
  const [quizStats, setQuizStats] = useState({ answered: 0, correct: 0 });
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const [confirmClear, setConfirmClear] = useState(false);
  const [seen, setSeen] = useState(() => {
    try { return !!localStorage.getItem(SEEN_KEY); } catch { return true; }
  });
  // Dragged FAB position (px from viewport top); null = default bottom slot.
  const [fabTop, setFabTop] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(FAB_KEY) || "null");
      return typeof v === "number" && v > 0 ? v : null;
    } catch { return null; }
  });
  // Pending attachment — { type:"img", name, dataUrl } or
  // { type:"doc", name, text, images }. Consumed by the next send.
  const [attach, setAttach] = useState(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachMenu, setAttachMenu] = useState(false);
  // One-shot mascot reaction shown on the live orbs (celebrate/oops).
  const [orbMood, setOrbMood] = useState(null);
  // Companion teaser bubble — pops next to the orb with a contextual line.
  const [bubble, setBubble] = useState(null); // { text, prompt? }
  // Daily mood check-in — the orb asks once a day; the pick feeds STUDENT CONTEXT.
  const [moodAsk, setMoodAsk] = useState(false);
  const [moodToday, setMoodToday] = useState(() => {
    try {
      const m = JSON.parse(localStorage.getItem(MOOD_KEY) || "null");
      return m?.date === new Date().toDateString() ? m.mood : null;
    } catch { return null; }
  });
  // True on the first-ever sheet open — guides the first chat (attach hint,
  // "try me" card).
  const [firstOpen, setFirstOpen] = useState(false);
  // Dozing when untouched for a while — the sleepy mood dozes the FAB orb.
  const [sleepy, setSleepy] = useState(false);
  const lastActiveRef = useRef(Date.now());
  // Sheet drag-to-dismiss (mobile) and orb→sheet morph (tap only).
  const [panelDy, setPanelDy] = useState(0);
  const sheetDragRef = useRef({ down: false, startY: 0 });
  const [morph, setMorph] = useState(null); // { from:{x,y,size}, to:{x,y}, go }
  const [morphing, setMorphing] = useState(false);
  const morphFromRef = useRef(null);
  const headOrbRef = useRef(null);

  const sessionRef = useRef(0);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const dragRef = useRef({ down: false, moved: false, startY: 0, startTop: 0 });
  const camRef = useRef(null);
  const imgRef = useRef(null);
  const docRef = useRef(null);
  const moodRef = useRef(0);
  const bubbleCountRef = useRef(0);
  const prevLoadingRef = useRef(false);

  const { folders, prefs } = useReviewPlan();
  const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || window.matchMedia?.("(pointer: coarse)")?.matches);

  const dueCount = useMemo(() => (folders || []).reduce((n, f) => n + (f.due || 0), 0), [folders]);
  const exam = useMemo(() => nextExam(folders, prefs), [folders, prefs]);
  const weak = useMemo(() => weakestFolder(folders), [folders]);

  // Proactive welcome cards — built from live account data, generic fallbacks last.
  const cards = useMemo(() => {
    const list = [];
    if (firstOpen) list.push({
      icon: "✨", title: "Show me what you can do", sub: "Try a quick quiz on your subjects",
      prompt: `Quiz me on ${weak?.name || folders?.[0]?.name || "general knowledge"} — one mcq question at a time, keep it fun.`,
    });
    if (dueCount > 0) list.push({
      icon: "📚", title: `${dueCount} card${dueCount === 1 ? "" : "s"} due`, sub: "Quick review plan",
      prompt: `I have ${dueCount} flashcards due for review. Give me a focused 10-minute plan, then quiz me on the most likely weak points — one mcq question at a time.`,
    });
    if (exam && exam.days <= 30) list.push({
      icon: "⏳", title: `${exam.name} in ${exam.days}d`, sub: "Build a cram plan",
      prompt: `My ${exam.name} exam is in ${exam.days} days. Build me a realistic day-by-day revision plan with daily goals.`,
    });
    if (weak) list.push({
      icon: "🧠", title: `Drill ${weak.name}`, sub: `Weakest subject · ${weak.r}% ready`,
      prompt: `${weak.name} is my weakest subject right now. Quiz me on its fundamentals — one mcq question at a time, starting with the basics.`,
    });
    list.push({
      icon: "💬", title: "I'm stuck on a topic", sub: "Tell me what's hard",
      prompt: "I'm struggling with a topic but not sure where to start. Ask me what the topic is, then explain it simply and give me a mini study plan.",
    });
    return list.slice(0, 4);
  }, [dueCount, exam, weak, firstOpen, folders]);

  // Injected into the prompt so Scholar answers with the student's reality in mind.
  const studyCtx = useMemo(() => {
    const lines = [];
    if (dueCount > 0) lines.push(`- ${dueCount} flashcards due for review`);
    if (exam) lines.push(`- ${exam.name} exam in ${exam.days} day${exam.days === 1 ? "" : "s"}`);
    if (weak) lines.push(`- Weakest subject right now: ${weak.name}`);
    if (moodToday) lines.push(`- Mood check-in today: ${moodToday}`);
    return lines.length ? `\n\nSTUDENT CONTEXT:\n${lines.join("\n")}` : "";
  }, [dueCount, exam, weak, moodToday]);

  // Time-of-day greeting for the welcome hero.
  const greet = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  // First name for the companion voice (best-effort from stored auth).
  const userName = useMemo(() => {
    try {
      const a = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      return String(a.user?.fullName || a.user?.username || "").split(" ")[0];
    } catch { return ""; }
  }, []);

  // Companion teaser lines — same live data as the welcome cards, phrased as
  // the mascot talking. `prompt` rides along so tapping the bubble can act.
  const teasers = useMemo(() => {
    const t = [];
    if (dueCount > 0) t.push({
      text: `${dueCount} card${dueCount === 1 ? "" : "s"} due — 10-min review? 📚`,
      prompt: `I have ${dueCount} flashcards due for review. Give me a focused 10-minute plan, then quiz me on the most likely weak points — one mcq question at a time.`,
    });
    if (exam && exam.days <= 30) t.push({
      text: `${exam.name} in ${exam.days}d — cram plan? ⏳`,
      prompt: `My ${exam.name} exam is in ${exam.days} days. Build me a realistic day-by-day revision plan with daily goals.`,
    });
    if (weak) t.push({
      text: `${weak.name} is your weakest — drill it? 🧠`,
      prompt: `${weak.name} is my weakest subject right now. Quiz me on its fundamentals — one mcq question at a time, starting with the basics.`,
    });
    t.push({ text: `${userName ? `${userName}, stuck` : "Stuck"} on a topic? Just ask me 💬`, prompt: null });
    return t;
  }, [dueCount, exam, weak, userName]);

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Typewriter reveal identical to the reader's streamChatAnswer — tokens land
  // instantly but the bubble reveals gradually. `images` are base64 data URLs
  // for the vision call (photo attachments / scanned-doc pages).
  const streamAnswer = useCallback(async (prompt, history, images) => {
    const session = sessionRef.current;
    const ctl = new AbortController();
    abortRef.current = ctl;
    let target = "";
    let shown = 0;
    const reveal = setInterval(() => {
      if (session !== sessionRef.current || shown >= target.length) return;
      const lag = target.length - shown;
      shown += Math.max(1, Math.min(6, Math.ceil(lag / 14)));
      const partial = target.slice(0, shown);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.streaming) return [...prev.slice(0, -1), { ...last, content: partial }];
        return [...prev, { role: "assistant", content: partial, streaming: true }];
      });
      scrollBottom();
    }, 24);
    const finalize = (content) => session === sessionRef.current && setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        return [...prev.slice(0, -1), { role: "assistant", content: content || last.content }];
      }
      return content ? [...prev, { role: "assistant", content }] : prev;
    });
    try {
      const text = await callAIMultimodalStream(prompt, images?.length ? images : null, history, { provider: "openrouter" }, {
        signal: ctl.signal,
        onToken: (raw) => { if (session === sessionRef.current) target = raw; },
      });
      clearInterval(reveal);
      finalize(text || "No response.");
    } catch (err) {
      clearInterval(reveal);
      finalize(target || undefined);
      throw err;
    }
  }, [scrollBottom]);

  const send = useCallback(async (text) => {
    const att = attach;
    const trimmed = (text || "").trim();
    if ((!trimmed && !att) || loading) return;
    const images = att?.type === "img" ? [att.dataUrl] : (att?.images || []).slice(0, 3);
    const docCtx = att?.type === "doc" && att.text
      ? `\n\nATTACHED DOCUMENT "${att.name}":\n${att.text.slice(0, 8000)}`
      : "";
    const imgHint = images.length
      ? "\n\n[The student attached image(s) — read them carefully and ground your answer in what they show.]"
      : "";
    const content = trimmed || (att.type === "img" ? "What's in this photo?" : `Here's my document: ${att.name}`);
    lastActiveRef.current = Date.now();
    setSleepy(false);
    setMessages((prev) => [...prev, {
      role: "user", content,
      images: images.length ? images : undefined,
      docName: att?.type === "doc" ? att.name : undefined,
    }]);
    setAttach(null);
    setAttachMenu(false);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setError(null);
    haptics.light();
    const history = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
    const prompt = `${SCHOLAR_SYSTEM}${studyCtx}${docCtx}${imgHint}\n\n---\n\n${content}`;
    try {
      await streamAnswer(prompt, history, images);
    } catch (err) {
      if (!err.stoppedByUser) {
        setError(err.message || "Something went wrong. Try sending that again.");
        setMood("oops");
        haptics.error();
      }
    } finally {
      setLoading(false);
    }
  }, [loading, messages, studyCtx, attach, streamAnswer]);

  // Typed input only — a "teach me X" question wants the full AI Tutor with
  // the topic prefilled, not a chat bubble. Card/chip prompts skip this.
  const handleSubmit = useCallback((text) => {
    const trimmed = (text || "").trim();
    if ((!trimmed && !attach) || loading) return;
    if (onOpenAITutor && trimmed && TUTOR_INTENT.test(trimmed)) {
      const topic = extractTopic(trimmed) || trimmed;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: `That deserves a real lesson — opening **Guided Study** for *${topic}*. I'll walk you through it step by step, with quick checks along the way…` },
      ]);
      setInput("");
      setTimeout(() => { setOpen(false); onOpenAITutor(topic); }, 650);
      return;
    }
    send(trimmed);
  }, [loading, attach, onOpenAITutor, send]);

  // "Learn this deeply" chip — same flow as the teach-me intent: confirm,
  // close, launch Guided Study on the extracted topic.
  const routeToStudy = useCallback((topic) => {
    haptics.selection();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Learn "${topic}" deeply` },
      { role: "assistant", content: `Good choice — opening **Guided Study** for *${topic}*. Step by step, with quick checks along the way…` },
    ]);
    setTimeout(() => { setOpen(false); onOpenAITutor(topic); }, 650);
  }, [onOpenAITutor]);

  const stopStream = () => abortRef.current?.abort();

  // File pickers — camera/gallery photos go straight to vision; documents get
  // client-side text extraction (scanned PDFs fall back to page images).
  const pickFile = async (file, kind) => {
    if (!file) return;
    setAttachMenu(false);
    setAttachBusy(true);
    setError(null);
    try {
      if (kind === "img") {
        const dataUrl = await downscaleImage(file).catch(() => readFileAsDataUrl(file));
        setAttach({ type: "img", name: file.name, dataUrl });
      } else {
        const out = await extractFileText(file, 3);
        // Picked an image through the doc input — treat it as a photo.
        if (!out.text && out.images?.length) {
          setAttach({ type: "img", name: file.name, dataUrl: out.images[0] });
        } else {
          setAttach({ type: "doc", name: file.name, text: out.text || "", images: out.images || [] });
        }
      }
      haptics.success();
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message || "Couldn't read that file.");
      haptics.error();
    } finally {
      setAttachBusy(false);
    }
  };

  // One-shot mascot reaction on the live orbs — auto-clears so one-shot
  // keyframes can replay on the next trigger.
  const setMood = (m) => {
    const id = ++moodRef.current;
    lastActiveRef.current = Date.now();
    setSleepy(false);
    setOrbMood(m);
    if (m) setTimeout(() => { if (moodRef.current === id) setOrbMood(null); }, m === "celebrate" ? 1000 : 650);
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => (prev[prev.length - 1]?.role === "assistant" ? prev.slice(0, -1) : prev));
    setError(null);
    send(lastUser.content);
  };

  const clearChat = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    sessionRef.current += 1;
    abortRef.current?.abort();
    setMessages([]);
    setQuizResults({});
    setQuizStats({ answered: 0, correct: 0 });
    setError(null);
    setConfirmClear(false);
  };

  const openSheet = useCallback(() => {
    setOpen(true);
    setConfirmClear(false);
    lastActiveRef.current = Date.now();
    setSleepy(false);
    try {
      if (!localStorage.getItem(SEEN_KEY)) setFirstOpen(true);
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setSeen(true);
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    if (authData.authToken) {
      fetch(`${API_BASE}/ai-proxy/usage`, {
        headers: { Authorization: `Bearer ${authData.authToken}` },
        credentials: "include",
      }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setAiUsage(d)).catch(() => {});
    }
  }, []);

  // Other surfaces (and future AI entry points) can summon Scholar globally.
  useEffect(() => {
    const onOpen = () => openSheet();
    window.addEventListener("sc-open-scholar", onOpen);
    return () => window.removeEventListener("sc-open-scholar", onOpen);
  }, [openSheet]);

  // First-run intro — the mascot introduces itself once with three short
  // bubbles, then hands off to the normal rotating teasers.
  useEffect(() => {
    if (hidden || open) return;
    let done = true;
    try { done = !!localStorage.getItem(INTRO_KEY); } catch {}
    if (done) return;
    const lines = [
      { text: `Hey${userName ? ` ${userName}` : ""} — I'm Scholar, your study buddy ✨`, prompt: null },
      { text: "Ask me anything — or snap your notes and I'll read them 📷", prompt: null },
      { text: "Tap me anytime — I'm always here 💬", prompt: null },
    ];
    const timers = [];
    lines.forEach((m, i) => {
      timers.push(setTimeout(() => { bubbleCountRef.current += 1; setBubble(m); }, 2200 + i * 4900));
      timers.push(setTimeout(() => setBubble((b) => (b === m ? null : b)), 2200 + i * 4900 + 4400));
    });
    timers.push(setTimeout(() => { try { localStorage.setItem(INTRO_KEY, "1"); } catch {} }, 2200 + lines.length * 4900));
    return () => timers.forEach(clearTimeout);
  }, [hidden, open, userName]);

  // Companion teasers — the orb speaks first, mascot-style. Max 3 bubbles
  // per session, ~45s apart, only while the sheet is closed.
  useEffect(() => {
    if (hidden || open || !teasers.length || moodAsk) return;
    let cancelled = false;
    let hideT = null;
    const show = () => {
      if (cancelled || bubbleCountRef.current >= 3) return;
      const t = teasers[bubbleCountRef.current % teasers.length];
      bubbleCountRef.current += 1;
      setBubble(t);
      hideT = setTimeout(() => setBubble((b) => (b === t ? null : b)), 4600);
    };
    // First-ever visit: a quicker hello so the mascot introduces itself —
    // unless the intro sequence is still playing, in which case wait it out.
    let introPending = false;
    try { introPending = !localStorage.getItem(INTRO_KEY); } catch {}
    const first = setTimeout(show, introPending ? 19000 : seen ? 9000 : 2800);
    const iv = setInterval(show, 45000);
    return () => { cancelled = true; clearTimeout(first); clearTimeout(hideT); clearInterval(iv); };
  }, [hidden, open, teasers, seen, moodAsk]);

  // Daily mood check-in — the orb asks once a day, after the first-run intro
  // has had its moment. The pick rides STUDENT CONTEXT so replies match tone.
  useEffect(() => {
    if (hidden || open) return;
    const today = new Date().toDateString();
    let asked = false;
    try { asked = JSON.parse(localStorage.getItem(MOOD_KEY) || "null")?.date === today; } catch {}
    if (asked) return;
    let introPending = false;
    try { introPending = !localStorage.getItem(INTRO_KEY); } catch {}
    const t = setTimeout(() => setMoodAsk(true), introPending ? 19500 : 2600);
    return () => clearTimeout(t);
  }, [hidden, open]);

  const pickMood = (m) => {
    const opt = MOODS.find((x) => x[0] === m) || MOODS[0];
    haptics.selection();
    try { localStorage.setItem(MOOD_KEY, JSON.stringify({ date: new Date().toDateString(), mood: m })); } catch {}
    setMoodToday(m);
    setMoodAsk(false);
    setMood(opt[3]);
    bubbleCountRef.current = 99; // the check-in is today's bubble — no generic teasers after
    setBubble({ text: opt[2], prompt: null });
    setTimeout(() => setBubble(null), 4600);
  };
  const dismissMood = () => {
    try { localStorage.setItem(MOOD_KEY, JSON.stringify({ date: new Date().toDateString(), mood: null })); } catch {}
    setMoodAsk(false);
  };

  // Doze off after ~60s without interaction — wakes on open/send/mood/drag.
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastActiveRef.current > 60000) setSleepy(true);
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  // Orb → sheet morph: when opened by tapping the FAB, a ghost orb flies
  // from the FAB's spot into the header as the sheet slides up.
  useLayoutEffect(() => {
    if (!open || !morphFromRef.current) return;
    const from = morphFromRef.current;
    morphFromRef.current = null;
    setMorphing(true);
    setMorph({ from });
    let t2;
    const t1 = setTimeout(() => {
      const el = headOrbRef.current;
      if (!el) { setMorph(null); setMorphing(false); return; }
      const r = el.getBoundingClientRect();
      setMorph({ from, to: { x: r.left, y: r.top } });
      requestAnimationFrame(() => requestAnimationFrame(() => setMorph((c) => (c ? { ...c, go: true } : c))));
      t2 = setTimeout(() => { setMorph(null); setMorphing(false); }, 360);
    }, 290);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [open]);

  // Reply landed while the sheet was closed — the orb bounces to flag it.
  useEffect(() => {
    if (prevLoadingRef.current && !loading && !open) setMood("excited");
    prevLoadingRef.current = loading;
  }, [loading, open]);

  // Escape closes the sheet; abort any in-flight stream on unmount.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // FAB drag — chat-head style vertical repositioning along the screen edge.
  const onFabPointerDown = (e) => {
    const el = e.currentTarget;
    lastActiveRef.current = Date.now();
    setSleepy(false);
    const rect = el.getBoundingClientRect();
    dragRef.current = { down: true, moved: false, startY: e.clientY, startTop: rect.top };
    el.setPointerCapture?.(e.pointerId);
  };
  const onFabPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.down) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) > 8) d.moved = true;
    if (d.moved) {
      const top = Math.min(Math.max(d.startTop + dy, 12), window.innerHeight - 68);
      setFabTop(top);
    }
  };
  const onFabPointerUp = (e) => {
    const d = dragRef.current;
    if (!d.down) return;
    dragRef.current.down = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!d.moved) {
      haptics.selection();
      const r = e.currentTarget.getBoundingClientRect();
      morphFromRef.current = { x: r.left + (r.width - 52) / 2, y: r.top + (r.height - 52) / 2, size: 52 };
      openSheet();
      return;
    }
    setFabTop((top) => {
      try { localStorage.setItem(FAB_KEY, JSON.stringify(top)); } catch {}
      return top;
    });
  };

  const segs = useMemo(() => messages.map((m) => (m.role === "assistant" ? parseMcqSegments(m.content || "") : [])), [messages]);
  const mcqPrefix = useMemo(() => {
    const out = [];
    let acc = 0;
    for (const s of segs) { out.push(acc); acc += s.filter((sg) => sg.type === "mcq").length; }
    return out;
  }, [segs]);
  const lastSegs = segs[segs.length - 1] || [];
  const lastIsQuiz = lastSegs.some((sg) => sg.type === "mcq");
  // Suggestion chips — contextual only (Gizmo-style). Quiz flow gets next-step
  // controls; a knowledge answer gets the "learn this deeply" Guided Study
  // route. No fixed chips.
  const chipsToShow = useMemo(() => {
    if (lastIsQuiz) return QUIZ_NEXT_CHIPS;
    const lastA = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastA?.content?.includes("Guided Study")) return [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || lastUser.images || lastUser.docName || !onOpenAITutor) return [];
    if (!looksLearnable(lastUser.content)) return [];
    const topic = deepTopic(lastUser.content);
    if (topic.length < 3) return [];
    return [{
      label: `📚 Learn "${topic.length > 28 ? `${topic.slice(0, 26)}…` : topic}" deeply`,
      route: topic,
    }];
  }, [lastIsQuiz, messages, onOpenAITutor]);
  const showChips = messages.length > 0 && !loading && !messages[messages.length - 1]?.streaming;

  const handleQuizPick = (key, mcq, orig) => {
    if (quizResults[key]) return;
    const correct = orig === mcq.answer;
    setQuizResults((prev) => ({ ...prev, [key]: { picked: orig, correct } }));
    setQuizStats((st) => ({ answered: st.answered + 1, correct: st.correct + (correct ? 1 : 0) }));
    // The mascot reacts — celebration on a win, sympathetic wobble on a miss.
    if (correct) { haptics.success(); setMood("celebrate"); }
    else { haptics.error(); setMood("oops"); }
  };

  const copyMessage = (i, msg) => {
    navigator.clipboard?.writeText(msg.content || "").then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? -1 : c)), 1400);
    }).catch(() => {});
  };

  const s = useMemo(() => ({
    fab: {
      position: "fixed",
      right: isMobile ? 14 : 22,
      ...(fabTop != null ? { top: fabTop } : { bottom: isMobile ? "calc(84px + env(safe-area-inset-bottom))" : 24 }),
      width: 62, height: 62, borderRadius: "50%",
      background: "transparent",
      border: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "grab", zIndex: 9989, padding: 0,
      touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
      animation: "gs-breathe 3.6s ease-in-out infinite",
      transition: "box-shadow 0.2s ease",
    },
    fabBadge: {
      position: "absolute", top: 0, right: 0, width: 15, height: 15,
      borderRadius: "50%", background: "linear-gradient(145deg, #FF5470, #d62b4b)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 8px rgba(255,84,112,0.5)",
      border: "2px solid var(--app-bg)",
      animation: "gs-dot-pulse 2.4s ease-in-out infinite",
    },
    backdrop: {
      position: "fixed", inset: 0, background: "rgba(8,6,2,0.55)",
      backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      zIndex: 9990, animation: "gs-fade 0.2s ease",
    },
    panel: isMobile ? {
      position: "fixed", left: 0, right: 0, bottom: 0,
      height: "min(86dvh, 720px)", borderRadius: "22px 22px 0 0",
      background: "var(--app-card)", border: "1px solid var(--app-line)", borderBottom: "none",
      display: "flex", flexDirection: "column", overflow: "hidden",
      zIndex: 9991, animation: "gs-sheet-up 0.28s cubic-bezier(0.32,0.72,0.24,1)",
      paddingBottom: "env(safe-area-inset-bottom)",
      boxShadow: "0 -18px 60px rgba(0,0,0,0.45)",
    } : {
      position: "fixed", right: 24, bottom: 24,
      width: 412, height: "min(76vh, 720px)", borderRadius: 22,
      background: "var(--app-card)", border: "1px solid var(--app-line)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      zIndex: 9991, animation: "gs-panel-in 0.28s cubic-bezier(0.32,0.72,0.24,1)",
      boxShadow: "0 28px 70px rgba(0,0,0,0.55)",
    },
    grabStrip: {
      flexShrink: 0, height: 15, display: "flex", alignItems: "center",
      justifyContent: "center", cursor: "grab", touchAction: "none",
      background: "linear-gradient(135deg, rgba(245,166,35,0.14), rgba(245,166,35,0.03) 55%, transparent)",
    },
    grabPill: { width: 38, height: 4.5, borderRadius: 99, background: "var(--app-line-strong)" },
    head: {
      position: "relative", flexShrink: 0,
      display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
      borderBottom: "1px solid var(--app-line)",
      background: "linear-gradient(135deg, rgba(245,166,35,0.14), rgba(245,166,35,0.03) 55%, transparent)",
      overflow: "hidden",
    },
    headGoldLine: {
      position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
      background: "linear-gradient(180deg, #FFD98A, #F5A623, #B06F0A)",
    },
    thread: { flex: 1, overflowY: "auto", padding: "16px 16px 10px", overscrollBehavior: "contain" },
    msgUser: {
      maxWidth: "82%", marginLeft: "auto", marginBottom: 12,
      background: "linear-gradient(135deg, rgba(245,166,35,0.16), rgba(245,166,35,0.08))",
      border: "1px solid rgba(245,166,35,0.35)",
      color: "var(--app-text)", borderRadius: "16px 16px 5px 16px",
      padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5,
      whiteSpace: "pre-wrap", wordBreak: "break-word",
      animation: "gs-msg-in 0.22s ease",
    },
    msgAssistant: { display: "flex", gap: 9, marginBottom: 12, animation: "gs-msg-in 0.22s ease" },
    msgCard: {
      flex: 1, minWidth: 0,
      borderRadius: "5px 16px 16px 16px", padding: "4px 10px",
      fontSize: 13.5, lineHeight: 1.55, color: "var(--app-text)", overflowWrap: "break-word",
    },
    streamCursor: {
      display: "inline-block", width: 7, height: 15, marginLeft: 2, verticalAlign: "-2px",
      background: "#F5A623", borderRadius: 1, animation: "gs-cursor-blink 0.8s step-end infinite",
    },
    msgActions: { display: "flex", gap: 6, marginTop: 6 },
    msgActionBtn: {
      background: "none", border: "1px solid var(--app-line-strong)", borderRadius: 8,
      color: "var(--app-dim)", fontSize: 11, padding: "3px 9px", cursor: "pointer", fontFamily: "inherit",
    },
    chipsRow: { display: "flex", gap: 7, padding: "6px 16px 10px", overflowX: "auto", flexShrink: 0 },
    chip: {
      flexShrink: 0, border: "1px solid rgba(245,166,35,0.3)", borderRadius: 999,
      background: "rgba(245,166,35,0.06)", color: "var(--app-dim)", fontSize: 12, fontWeight: 600,
      padding: "7px 13px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
      transition: "all 0.15s ease",
    },
    inputRow: {
      display: "flex", alignItems: "flex-end", gap: 9, padding: "11px 14px",
      borderTop: "1px solid var(--app-line)", flexShrink: 0,
      background: "var(--app-card)",
    },
    textarea: {
      flex: 1, resize: "none", border: "1.5px solid var(--app-line-strong)", borderRadius: 999,
      background: "var(--app-surface)", color: "var(--app-text)", fontSize: 13.5,
      padding: "10px 16px", fontFamily: "inherit", lineHeight: 1.4, maxHeight: 120, outline: "none",
      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
      background: "linear-gradient(145deg, #FFD166, #F5A623 55%, #B06F0A)",
      color: "#1a1200", fontSize: 16, fontWeight: 800, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 14px rgba(245,166,35,0.4)",
      transition: "transform 0.12s ease",
    },
    attachBtn: {
      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
      border: "1.5px solid var(--app-line-strong)", background: "var(--app-surface)",
      color: "var(--app-dim)", fontSize: 15, cursor: "pointer", fontFamily: "inherit",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "transform 0.12s ease, border-color 0.15s ease, color 0.15s ease",
    },
    attachMenu: {
      position: "absolute", left: 12, bottom: 66, zIndex: 6, width: 242,
      borderRadius: 16, background: "var(--app-card2)", border: "1px solid var(--app-line-strong)",
      boxShadow: "0 14px 40px rgba(0,0,0,0.5)", padding: 6,
      animation: "gs-fade-in-up 0.18s ease both",
    },
    attachOpt: {
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "10px 10px", border: "none", background: "none", borderRadius: 10,
      color: "var(--app-text)", fontSize: 13, fontWeight: 600,
      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
    },
    attachOptIcon: {
      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
      background: "linear-gradient(145deg, rgba(245,166,35,0.22), rgba(245,166,35,0.08))",
      border: "1px solid rgba(245,166,35,0.25)",
    },
    attachRow: {
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      padding: "9px 14px 0", flexShrink: 0,
    },
    attachChip: {
      display: "inline-flex", alignItems: "center", gap: 7, maxWidth: "100%",
      padding: "5px 8px 5px 6px", borderRadius: 999,
      border: "1px solid rgba(245,166,35,0.35)", background: "rgba(245,166,35,0.08)",
      fontSize: 12, fontWeight: 600, color: "var(--app-text)",
      animation: "gs-fade-in-up 0.2s ease both",
    },
    bubble: {
      position: "fixed",
      right: isMobile ? 82 : 94,
      ...(fabTop != null
        ? { top: Math.max(8, fabTop + 6) }
        : { bottom: isMobile ? "calc(100px + env(safe-area-inset-bottom))" : 34 }),
      maxWidth: 210, padding: "9px 26px 9px 12px",
      borderRadius: 14, background: "var(--app-card2)",
      border: "1px solid rgba(245,166,35,0.4)",
      color: "var(--app-text)", fontSize: 12, fontWeight: 600, lineHeight: 1.4,
      boxShadow: "0 8px 26px rgba(0,0,0,0.4), 0 0 18px rgba(245,166,35,0.12)",
      cursor: "pointer", zIndex: 9989, fontFamily: "inherit", textAlign: "left",
      animation: "gs-bubble-in 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
    },
    bubbleTail: {
      position: "absolute", right: -5, top: "50%", width: 10, height: 10,
      transform: "translateY(-50%) rotate(45deg)",
      background: "var(--app-card2)",
      borderTop: "1px solid rgba(245,166,35,0.4)",
      borderRight: "1px solid rgba(245,166,35,0.4)",
    },
    bubbleX: {
      position: "absolute", top: 4, right: 7, background: "none", border: "none",
      color: "var(--app-faint)", fontSize: 10, cursor: "pointer", padding: 2,
      fontFamily: "inherit",
    },
    card: {
      display: "flex", alignItems: "center", gap: 12, width: "100%",
      padding: "12px 13px", borderRadius: 14, textAlign: "left",
      border: "1px solid var(--app-line)", background: "var(--app-tint-soft)",
      cursor: "pointer", fontFamily: "inherit",
      animation: "gs-fade-in-up 0.35s cubic-bezier(0.4,0,0.2,1) both",
      transition: "border-color 0.15s ease, transform 0.15s ease",
    },
    cardIcon: {
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
      background: "linear-gradient(145deg, rgba(245,166,35,0.22), rgba(245,166,35,0.08))",
      border: "1px solid rgba(245,166,35,0.25)",
    },
  }), [isMobile, fabTop]);

  if (hidden) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes gs-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gs-sheet-up { from { transform: translateY(30px); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
        @keyframes gs-panel-in { from { transform: translateY(18px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes gs-msg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gs-fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gs-cursor-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes gs-dot-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.35; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes gs-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3.5px); } }
        @keyframes gs-breathe { 0%, 100% { box-shadow: 0 8px 26px rgba(245,166,35,0.5), 0 0 0 0 rgba(245,166,35,0.35); } 50% { box-shadow: 0 10px 30px rgba(245,166,35,0.62), 0 0 0 7px rgba(245,166,35,0.10); } }
        @keyframes gs-shine { 0%, 72% { transform: translateX(-130%) rotate(18deg); } 100% { transform: translateX(230%) rotate(18deg); } }
        @keyframes gs-hop { 0%,72%,100% { transform: translateY(0) scale(1,1); } 75% { transform: translateY(0) scale(1.1,0.82); } 81% { transform: translateY(-13px) scale(0.96,1.06); } 87% { transform: translateY(0) scale(1.06,0.86); } 93% { transform: translateY(-2px) scale(0.98,1.02); } }
        @keyframes gs-bubble-in { from { opacity: 0; transform: translateX(14px) scale(0.7); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes gs-dot-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.75); opacity: 0.75; } }
        @keyframes gs-attachhint { 0%,100% { box-shadow: 0 0 0 0 rgba(245,166,35,0.55); } 50% { box-shadow: 0 0 0 6px rgba(245,166,35,0.12); } }
        @keyframes sc-orb-pulse { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.12); filter: brightness(1.15); } }
        .gs-orb-idle { animation: gs-float 3.2s ease-in-out infinite; }
        .gs-orb-hop { display: flex; animation: gs-hop 11s ease-in-out infinite; }
        .gs-shine { position: absolute; top: -20%; bottom: -20%; width: 34%; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent); animation: gs-shine 5.2s ease-in-out infinite; }
        .gs-typing i { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: gs-dot-bounce 1.1s ease-in-out infinite; }
        .gs-typing i:nth-child(2) { animation-delay: 0.15s; }
        .gs-typing i:nth-child(3) { animation-delay: 0.3s; }
        .gs-card:hover { border-color: rgba(245,166,35,0.55); transform: translateY(-1px); }
        .gs-card:active { transform: scale(0.98); }
        .gs-chip:hover { border-color: rgba(245,166,35,0.6); color: var(--app-accent); background: rgba(245,166,35,0.12); }
        .gs-input:focus { border-color: rgba(245,166,35,0.65) !important; box-shadow: 0 0 0 3.5px rgba(245,166,35,0.16); }
        .gs-fab:active { transform: scale(0.9); }
        .gs-send:active { transform: scale(0.9); }
        .gs-attach:active { transform: scale(0.9); }
        .gs-attachmenu-open { border-color: rgba(245,166,35,0.65) !important; color: var(--app-accent) !important; }
        .gs-attachopt:hover { background: var(--app-tint-med); }
        .gs-chips::-webkit-scrollbar { display: none; }
        .gs-icobtn:hover { color: var(--app-accent); }
      `}</style>

      {!open && (
        <button
          className="gs-fab"
          style={s.fab}
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          onPointerCancel={() => { dragRef.current.down = false; }}
          aria-label="Ask Scholar"
          title="Scholar — drag to move, tap to chat"
        >
          <span className="gs-orb-hop">
            <span className="gs-orb-idle" style={{ display: "flex" }}>
              <AiOrb size={52} state={orbMood || (loading ? "thinking" : !seen ? "excited" : sleepy ? "sleepy" : undefined)} />
            </span>
          </span>
          {dueCount > 0 && <span style={s.fabBadge} />}
        </button>
      )}

      {/* Ghost orb — flies from the FAB into the sheet header on tap-open */}
      {morph && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed", zIndex: 9996, pointerEvents: "none", display: "flex",
            left: morph.go && morph.to ? morph.to.x : morph.from.x,
            top: morph.go && morph.to ? morph.to.y : morph.from.y,
            transform: morph.go ? "scale(0.5)" : "scale(1)",
            transformOrigin: "top left",
            opacity: morph.go ? 0 : 1,
            transition: "left .3s cubic-bezier(0.32,0.72,0.24,1), top .3s cubic-bezier(0.32,0.72,0.24,1), transform .3s cubic-bezier(0.32,0.72,0.24,1), opacity .1s ease .26s",
          }}
        >
          <AiOrb size={morph.from.size} />
        </div>
      )}

      {/* Companion teaser — the mascot speaks first, rate-limited */}
      {!open && bubble && (
        <button
          style={s.bubble}
          onClick={() => {
            haptics.selection();
            const p = bubble.prompt;
            setBubble(null);
            openSheet();
            if (p) send(p);
          }}
          aria-label="Scholar suggestion"
        >
          {bubble.text}
          <span style={s.bubbleTail} aria-hidden="true" />
          <span
            style={s.bubbleX}
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); bubbleCountRef.current = 99; setBubble(null); }}
            aria-label="Dismiss suggestions"
          >✕</span>
        </button>
      )}

      {/* Daily mood check-in — the orb asks once a day */}
      {!open && moodAsk && (
        <div style={{ ...s.bubble, cursor: "default" }} role="dialog" aria-label="Mood check-in">
          <div style={{ marginBottom: 7 }}>How are you feeling today?</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {MOODS.map(([m, label]) => (
              <button
                key={m}
                onClick={() => pickMood(m)}
                style={{
                  background: "rgba(245,166,35,0.12)",
                  border: "1px solid rgba(245,166,35,0.4)",
                  borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 700,
                  color: "var(--app-text)", cursor: "pointer", fontFamily: "inherit",
                }}
              >{label}</button>
            ))}
          </div>
          <span style={s.bubbleTail} aria-hidden="true" />
          <span
            style={s.bubbleX}
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); dismissMood(); }}
            aria-label="Dismiss"
          >✕</span>
        </div>
      )}

      {open && (
        <>
          <div style={s.backdrop} onClick={() => setOpen(false)} />
          <div
            style={{
              ...s.panel,
              ...(panelDy
                ? { transform: `translateY(${panelDy}px)`, transition: "none" }
                : { transition: "transform .22s cubic-bezier(0.32,0.72,0.24,1)" }),
            }}
            role="dialog" aria-label="Scholar chat"
          >
            {isMobile && (
              <div
                style={s.grabStrip}
                onPointerDown={(e) => {
                  sheetDragRef.current = { down: true, startY: e.clientY };
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = sheetDragRef.current;
                  if (d.down) setPanelDy(Math.max(0, e.clientY - d.startY));
                }}
                onPointerUp={(e) => {
                  const d = sheetDragRef.current;
                  if (!d.down) return;
                  d.down = false;
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                  const dismiss = e.clientY - d.startY > 110;
                  setPanelDy(0);
                  if (dismiss) setOpen(false);
                }}
                onPointerCancel={() => { sheetDragRef.current.down = false; setPanelDy(0); }}
                aria-hidden="true"
              >
                <span style={s.grabPill} />
              </div>
            )}
            <div style={s.head}>
              <div style={s.headGoldLine} />
              <span ref={headOrbRef} style={{ display: "flex", marginLeft: 4 }}>
                <AiOrb size={26} state={orbMood || (loading ? "thinking" : undefined)} style={{ opacity: morphing ? 0 : 1, transition: "opacity .16s ease .06s" }} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--app-text)", letterSpacing: "-0.01em" }}>Scholar</span>
                <span style={{ fontSize: 10.5, color: loading ? "var(--app-accent)" : "var(--app-dim)", fontWeight: 600 }}>
                  {loading ? (messages[messages.length - 1]?.streaming ? "Writing…" : "Thinking…") : "Ask me anything — I'll route you right"}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                {aiUsage && !aiUsage.isActivated && (
                  <button
                    style={{
                      fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                      border: "1px solid rgba(245,166,35,0.4)", background: "rgba(245,166,35,0.1)",
                      color: "var(--app-accent)", cursor: "pointer", fontFamily: "inherit", marginRight: 2,
                    }}
                    onClick={() => window.dispatchEvent(new CustomEvent("sc-open-premium"))}
                    aria-label={`${Math.max(0, aiUsage.limit - aiUsage.used)} AI requests left today — upgrade for unlimited`}
                    title="AI requests left today"
                  >
                    ⚡ {Math.max(0, aiUsage.limit - aiUsage.used)}
                  </button>
                )}
                {quizStats.answered > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", marginRight: 2,
                    borderRadius: 999, background: "var(--app-tint-med)", color: "var(--app-dim)",
                  }}>
                    🧠 {quizStats.correct}/{quizStats.answered}
                  </span>
                )}
                {onOpenAITutor && (
                  <button
                    className="gs-icobtn"
                    style={{
                      background: "none", border: "none", color: "var(--app-dim)",
                      fontSize: 15, cursor: "pointer", padding: "4px 7px", fontFamily: "inherit",
                    }}
                    onClick={() => { setOpen(false); onOpenAITutor(""); }}
                    aria-label="Open full AI Tutor"
                    title="Open full AI Tutor"
                  >
                    ⤢
                  </button>
                )}
                <button
                  className="gs-icobtn"
                  style={{
                    background: "none", border: "none", color: "var(--app-dim)",
                    fontSize: 14, cursor: "pointer", padding: "4px 7px", fontFamily: "inherit",
                  }}
                  onClick={clearChat}
                  aria-label="New chat"
                  title="New chat"
                >
                  {confirmClear ? "Clear?" : "＋"}
                </button>
                <button
                  className="gs-icobtn"
                  style={{
                    background: "none", border: "none", color: "var(--app-dim)",
                    fontSize: 15, cursor: "pointer", padding: "4px 7px", fontFamily: "inherit",
                  }}
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                >
                  ✕
                </button>
              </span>
            </div>

            <div ref={scrollRef} style={s.thread}>
              {messages.length === 0 && !loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "26px 10px 10px" }}>
                  <div className="gs-orb-idle" style={{ marginBottom: 12 }}>
                    <AiOrb size={54} state="greeting" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "var(--app-text)", letterSpacing: "-0.01em", marginBottom: 5 }}>
                    {userName ? `${greet}, ${userName}` : "Hey, I'm Scholar"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--app-dim)", lineHeight: 1.55, maxWidth: 300, marginBottom: 18 }}>
                    What's giving you trouble today? I explain, quiz, and plan — or say "teach me…" and I'll take you straight into a full lesson.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
                    {cards.map((c, i) => (
                      <button
                        key={c.title}
                        className="gs-card"
                        style={{ ...s.card, animationDelay: `${0.08 + i * 0.07}s` }}
                        onClick={() => send(c.prompt)}
                      >
                        <span style={s.cardIcon}>{c.icon}</span>
                        <span style={{ flex: 1, textAlign: "left" }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>{c.title}</span>
                          <span style={{ display: "block", fontSize: 11, color: "var(--app-dim)" }}>{c.sub}</span>
                        </span>
                        <span style={{ color: "var(--app-faint)", fontSize: 14 }}>›</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--app-faint)", marginTop: 14, letterSpacing: "0.02em" }}>
                    Powered by your live study data
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} style={msg.role === "user" ? s.msgUser : s.msgAssistant}>
                  {msg.role === "assistant" && <AiOrb size={19} state={msg.streaming ? "thinking" : undefined} style={{ marginTop: 3 }} />}
                  {msg.role === "user" ? (
                    <>
                      {msg.images?.[0] && (
                        <img
                          src={msg.images[0]}
                          alt={msg.docName || "attachment"}
                          style={{ display: "block", maxWidth: "100%", maxHeight: 150, borderRadius: 10, marginBottom: 6 }}
                        />
                      )}
                      {msg.docName && (
                        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75, marginBottom: 4 }}>
                          📄 {msg.docName}
                        </div>
                      )}
                      {msg.content}
                    </>
                  ) : (
                    <div style={s.msgCard}>
                      {(segs[i] || []).map((seg, j) => {
                        if (seg.type === "mcq") {
                          const qNum = mcqPrefix[i] + segs[i].slice(0, j + 1).filter((sg) => sg.type === "mcq").length;
                          const key = `${i}:${j}`;
                          const res = quizResults[key];
                          return (
                            <McqCard
                              key={j}
                              mcq={seg.mcq}
                              T={T}
                              qNum={qNum}
                              stats={quizStats}
                              picked={res?.picked ?? null}
                              onPick={(orig) => handleQuizPick(key, seg.mcq, orig)}
                              onNext={() => send(`${res ? `I got that one ${res.correct ? "right" : "wrong"}. ` : ""}Next question — same mcq format.`)}
                            />
                          );
                        }
                        if (seg.type === "mcq_error") {
                          return (
                            <McqCard
                              key={j}
                              T={T}
                              error
                              onRetry={() => send("That quiz question didn't render — please send it again in the exact mcq format.")}
                            />
                          );
                        }
                        return <MarkdownText key={j} theme={theme}>{seg.text}</MarkdownText>;
                      })}
                      {msg.streaming && <span style={s.streamCursor} />}
                      {!msg.streaming && (
                        <div style={s.msgActions}>
                          <button style={s.msgActionBtn} onClick={() => copyMessage(i, msg)} aria-label="Copy answer">
                            {copiedIdx === i ? "✓ Copied" : "📋 Copy"}
                          </button>
                          {i === messages.length - 1 && (
                            <button style={s.msgActionBtn} onClick={retryLast} aria-label="Regenerate answer">
                              ↻ Retry
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && !messages[messages.length - 1]?.streaming && <ThinkingBubble />}
              {error && (
                <div style={{
                  margin: "4px 0 8px", padding: "11px 13px", borderRadius: 13,
                  border: "1px solid rgba(255,93,108,0.4)", background: "rgba(255,93,108,0.08)",
                  fontSize: 12.5, color: "var(--app-text)",
                }}>
                  <div style={{ fontWeight: 700 }}>⚠️ Scholar hit a snag</div>
                  <div style={{ fontSize: 11.5, opacity: 0.85, margin: "2px 0 7px" }}>{error}</div>
                  <button
                    style={{ ...s.msgActionBtn, color: "var(--app-accent)" }}
                    onClick={retryLast}
                  >
                    ↻ Try again
                  </button>
                </div>
              )}
            </div>

            {showChips && (
              <div style={s.chipsRow} className="gs-chips">
                {chipsToShow.map((chip) => (
                  <button key={chip.label} style={s.chip} className="gs-chip" onClick={() => (chip.route ? routeToStudy(chip.route) : send(chip.prompt))}>
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {(attach || attachBusy) && (
              <div style={s.attachRow}>
                <span style={s.attachChip}>
                  {attachBusy ? (
                    <>
                      <span className="gs-typing" style={{ color: "var(--app-dim)" }}><i /><i /><i /></span>
                      Reading your file…
                    </>
                  ) : attach.type === "img" ? (
                    <>
                      <img src={attach.dataUrl} alt="" style={{ width: 24, height: 24, borderRadius: 7, objectFit: "cover" }} />
                      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attach.name}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 15 }}>📄</span>
                      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attach.name}</span>
                    </>
                  )}
                  {!attachBusy && (
                    <button
                      onClick={() => setAttach(null)}
                      aria-label="Remove attachment"
                      style={{ background: "none", border: "none", color: "var(--app-dim)", fontSize: 12, cursor: "pointer", padding: "2px 3px", fontFamily: "inherit" }}
                    >✕</button>
                  )}
                </span>
                {!attachBusy && attach?.type === "doc" && (attach.text || attach.images?.length > 0) && (
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { l: "Summarize", p: "Summarize my attached document — key points, keep it short." },
                      { l: "Explain", p: "Explain my attached document simply, like I'm new to the topic." },
                      { l: "Quiz me", p: "Quiz me on my attached document — one mcq question at a time." },
                    ].map((a) => (
                      <button key={a.l} className="gs-chip" style={s.chip} onClick={() => send(a.p)}>{a.l}</button>
                    ))}
                  </span>
                )}
              </div>
            )}

            <div style={s.inputRow}>
              <button
                className={`gs-attach${attachMenu ? " gs-attachmenu-open" : ""}`}
                style={{
                  ...s.attachBtn,
                  ...(firstOpen && messages.length === 0 && !attach
                    ? { animation: "gs-attachhint 1.7s ease-in-out infinite" }
                    : {}),
                }}
                onClick={() => { haptics.selection(); setAttachMenu((v) => !v); }}
                aria-label="Attach a photo or document"
                title="Attach a photo or document"
              >📎</button>
              <textarea
                ref={inputRef}
                style={s.textarea}
                className="gs-input"
                rows={1}
                placeholder={attach ? `Ask about ${attach.type === "img" ? "this photo" : attach.name}…` : messages.length === 0 ? "Ask Scholar anything — or “teach me …”" : "Ask a follow-up…"}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(input);
                  }
                }}
                aria-label="Chat message"
              />
              <button
                className="gs-send"
                style={{ ...s.sendBtn, opacity: loading || input.trim() || attach ? 1 : 0.4 }}
                onClick={() => (loading ? stopStream() : handleSubmit(input))}
                disabled={!loading && !input.trim() && !attach}
                aria-label={loading ? "Stop generating" : "Send message"}
              >
                {loading ? "■" : "↑"}
              </button>
            </div>

            {attachMenu && (
              <>
                <div
                  style={{ position: "absolute", inset: 0, zIndex: 5 }}
                  onClick={() => setAttachMenu(false)}
                  aria-hidden="true"
                />
                <div style={s.attachMenu} role="menu" aria-label="Attach to chat">
                  {[
                    { icon: "📷", label: "Take a photo", sub: "Notes, textbook, problem", ref: camRef },
                    { icon: "🖼️", label: "Photo library", sub: "Pick from your gallery", ref: imgRef },
                    { icon: "📄", label: "Document", sub: "PDF, Word, slides, notes", ref: docRef },
                  ].map((o) => (
                    <button key={o.label} className="gs-attachopt" style={s.attachOpt} onClick={() => o.ref.current?.click()}>
                      <span style={s.attachOptIcon}>{o.icon}</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{o.label}</span>
                        <span style={{ display: "block", fontSize: 10.5, color: "var(--app-dim)" }}>{o.sub}</span>
                      </span>
                      <span style={{ color: "var(--app-faint)", fontSize: 14 }}>›</span>
                    </button>
                  ))}
                  <div style={{ fontSize: 10, color: "var(--app-faint)", padding: "4px 12px 8px", lineHeight: 1.4 }}>
                    Snap your notes or a past question — Scholar reads it with you.
                  </div>
                </div>
              </>
            )}

            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => { pickFile(e.target.files?.[0], "img"); e.target.value = ""; }} />
            <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { pickFile(e.target.files?.[0], "img"); e.target.value = ""; }} />
            <input ref={docRef} type="file" accept=".pdf,.docx,.txt,.md,.pptx,image/*" style={{ display: "none" }}
              onChange={(e) => { pickFile(e.target.files?.[0], "doc"); e.target.value = ""; }} />
          </div>
        </>
      )}
    </>,
    document.body
  );
}
