import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import AiOrb from "../../components/AiOrb.jsx";
import MarkdownText from "../../components/MarkdownText.jsx";
import McqCard from "../../components/McqCard.jsx";
import { parseMcqSegments } from "../../lib/mcqBlocks.js";
import { callAIMultimodalStream } from "../../lib/aiClient.js";
import { API_BASE } from "../../lib/constants.js";
import { QUIZ_NEXT_CHIPS } from "../pdf-reader/chatPrompts.js";
import { SCHOLAR_SYSTEM, SCHOLAR_CHIPS } from "./scholarPrompt.js";
import { useReviewPlan, examKeyOf, daysUntil, readiness } from "../../hooks/useReviewPlan.js";

const MAX_HISTORY = 10;
const SEEN_KEY = "sc_scholar_seen";

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
 * The app's global Scholar — a floating orb that opens the same chat the PDF
 * reader uses, minus the document context. Proactive welcome cards are built
 * from the student's live FSRS folders + exam dates.
 *
 * Other surfaces can open it via `window.dispatchEvent(new CustomEvent("sc-open-scholar"))`.
 */
export default function GlobalScholar({ hidden = false, onOpenAITutor, onOpenVoice, theme = "dark" }) {
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

  const sessionRef = useRef(0);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const { folders, prefs } = useReviewPlan();
  const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || window.matchMedia?.("(pointer: coarse)")?.matches);

  const dueCount = useMemo(() => (folders || []).reduce((n, f) => n + (f.due || 0), 0), [folders]);
  const exam = useMemo(() => nextExam(folders, prefs), [folders, prefs]);
  const weak = useMemo(() => weakestFolder(folders), [folders]);

  // Proactive welcome cards — built from live account data, generic fallbacks last.
  const cards = useMemo(() => {
    const list = [];
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
      icon: "😅", title: "I'm stuck on a topic", sub: "Tell me what's hard",
      prompt: "I'm struggling with a topic but not sure where to start. Ask me what the topic is, then explain it simply and give me a mini study plan.",
    });
    return list.slice(0, 4);
  }, [dueCount, exam, weak]);

  // Injected into the prompt so Scholar answers with the student's reality in mind.
  const studyCtx = useMemo(() => {
    const lines = [];
    if (dueCount > 0) lines.push(`- ${dueCount} flashcards due for review`);
    if (exam) lines.push(`- ${exam.name} exam in ${exam.days} day${exam.days === 1 ? "" : "s"}`);
    if (weak) lines.push(`- Weakest subject right now: ${weak.name}`);
    return lines.length ? `\n\nSTUDENT CONTEXT:\n${lines.join("\n")}` : "";
  }, [dueCount, exam, weak]);

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Typewriter reveal identical to the reader's streamChatAnswer — tokens land
  // instantly but the bubble reveals gradually.
  const streamAnswer = useCallback(async (prompt, history) => {
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
      const text = await callAIMultimodalStream(prompt, null, history, { provider: "openrouter" }, {
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
    const trimmed = (text || "").trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setError(null);
    const history = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
    const prompt = `${SCHOLAR_SYSTEM}${studyCtx}\n\n---\n\n${trimmed}`;
    try {
      await streamAnswer(prompt, history);
    } catch (err) {
      if (!err.stoppedByUser) setError(err.message || "Something went wrong. Try sending that again.");
    } finally {
      setLoading(false);
    }
  }, [loading, messages, studyCtx, streamAnswer]);

  const stopStream = () => abortRef.current?.abort();

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
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
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

  // Escape closes the sheet; abort any in-flight stream on unmount.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const segs = useMemo(() => messages.map((m) => (m.role === "assistant" ? parseMcqSegments(m.content || "") : [])), [messages]);
  const mcqPrefix = useMemo(() => {
    const out = [];
    let acc = 0;
    for (const s of segs) { out.push(acc); acc += s.filter((sg) => sg.type === "mcq").length; }
    return out;
  }, [segs]);
  const lastSegs = segs[segs.length - 1] || [];
  const lastIsQuiz = lastSegs.some((sg) => sg.type === "mcq");
  const chipsToShow = lastIsQuiz ? QUIZ_NEXT_CHIPS : SCHOLAR_CHIPS;
  const showChips = messages.length > 0 && !loading && !messages[messages.length - 1]?.streaming;

  const handleQuizPick = (key, mcq, orig) => {
    if (quizResults[key]) return;
    const correct = orig === mcq.answer;
    setQuizResults((prev) => ({ ...prev, [key]: { picked: orig, correct } }));
    setQuizStats((st) => ({ answered: st.answered + 1, correct: st.correct + (correct ? 1 : 0) }));
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
      right: isMobile ? 16 : 24,
      bottom: isMobile ? "calc(84px + env(safe-area-inset-bottom))" : 24,
      width: 56, height: 56, borderRadius: "50%",
      background: "linear-gradient(145deg, #FFD166, #F5A623 55%, #B06F0A)",
      border: "1px solid rgba(255,255,255,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 8px 24px rgba(245,166,35,0.45), 0 2px 6px rgba(0,0,0,0.35)",
      cursor: "pointer", zIndex: 9989,
      transition: "transform 0.15s ease",
    },
    fabBadge: {
      position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px",
      borderRadius: 999, background: "linear-gradient(145deg, #FFC24B, #F5A623)",
      color: "#1a1200", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center",
      justifyContent: "center", boxShadow: "0 2px 8px rgba(245,166,35,0.5)",
    },
    backdrop: {
      position: "fixed", inset: 0, background: "var(--app-overlay, rgba(0,0,0,0.55))",
      zIndex: 9990, animation: "gs-fade 0.18s ease",
    },
    panel: isMobile ? {
      position: "fixed", left: 0, right: 0, bottom: 0,
      height: "min(82dvh, 680px)", borderRadius: "18px 18px 0 0",
      background: "var(--app-card)", border: "1px solid var(--app-line)", borderBottom: "none",
      display: "flex", flexDirection: "column", overflow: "hidden",
      zIndex: 9991, animation: "gs-sheet-up 0.24s cubic-bezier(0.4,0,0.2,1)",
      paddingBottom: "env(safe-area-inset-bottom)",
    } : {
      position: "fixed", right: 24, bottom: 24,
      width: 400, height: "min(72vh, 700px)", borderRadius: 18,
      background: "var(--app-card)", border: "1px solid var(--app-line)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      zIndex: 9991, animation: "gs-sheet-up 0.24s cubic-bezier(0.4,0,0.2,1)",
      boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    },
    head: {
      display: "flex", alignItems: "center", gap: 8, padding: "12px 14px",
      borderBottom: "1px solid var(--app-line)", flexShrink: 0,
    },
    thread: { flex: 1, overflowY: "auto", padding: "14px 14px 8px", overscrollBehavior: "contain" },
    msgUser: {
      maxWidth: "82%", marginLeft: "auto", marginBottom: 10,
      background: "var(--app-accent-soft)", border: "1px solid var(--app-accent-line)",
      color: "var(--app-text)", borderRadius: "14px 14px 4px 14px",
      padding: "9px 12px", fontSize: 13.5, lineHeight: 1.45,
      whiteSpace: "pre-wrap", wordBreak: "break-word",
      animation: "gs-msg-in 0.2s ease",
    },
    msgAssistant: { display: "flex", gap: 8, marginBottom: 10, animation: "gs-msg-in 0.2s ease" },
    msgCard: {
      flex: 1, minWidth: 0, background: "var(--app-tint-soft)", border: "1px solid var(--app-line)",
      borderRadius: "4px 14px 14px 14px", padding: "10px 12px",
      fontSize: 13.5, lineHeight: 1.5, color: "var(--app-text)", overflowWrap: "break-word",
    },
    streamCursor: {
      display: "inline-block", width: 7, height: 15, marginLeft: 2, verticalAlign: "-2px",
      background: "#F5A623", borderRadius: 1, animation: "gs-cursor-blink 0.8s step-end infinite",
    },
    msgActions: { display: "flex", gap: 6, marginTop: 8 },
    msgActionBtn: {
      background: "none", border: "1px solid var(--app-line-strong)", borderRadius: 8,
      color: "var(--app-dim)", fontSize: 11, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit",
    },
    chipsRow: { display: "flex", gap: 6, padding: "4px 14px 8px", overflowX: "auto", flexShrink: 0 },
    chip: {
      flexShrink: 0, border: "1px solid var(--app-line-strong)", borderRadius: 999,
      background: "transparent", color: "var(--app-dim)", fontSize: 12, fontWeight: 600,
      padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    },
    inputRow: {
      display: "flex", alignItems: "flex-end", gap: 8, padding: "10px 12px",
      borderTop: "1px solid var(--app-line)", flexShrink: 0,
    },
    textarea: {
      flex: 1, resize: "none", border: "1px solid var(--app-line-strong)", borderRadius: 12,
      background: "var(--app-surface)", color: "var(--app-text)", fontSize: 13.5,
      padding: "9px 12px", fontFamily: "inherit", lineHeight: 1.4, maxHeight: 120, outline: "none",
    },
    sendBtn: {
      width: 38, height: 38, borderRadius: "50%", border: "none", flexShrink: 0,
      background: "linear-gradient(145deg, #F5A623, #d98a12)", color: "#1a1200",
      fontSize: 16, fontWeight: 800, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    card: {
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "11px 12px", borderRadius: 12, textAlign: "left",
      border: "1px solid var(--app-line)", background: "var(--app-tint-soft)",
      cursor: "pointer", fontFamily: "inherit", animation: "gs-fade-in-up 0.3s ease both",
    },
  }), [isMobile]);

  if (hidden) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes gs-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gs-sheet-up { from { transform: translateY(24px); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
        @keyframes gs-msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gs-fade-in-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gs-cursor-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes gs-dot-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.35; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes sc-orb-pulse { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.12); filter: brightness(1.15); } }
        .gs-typing i { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: gs-dot-bounce 1.1s ease-in-out infinite; }
        .gs-typing i:nth-child(2) { animation-delay: 0.15s; }
        .gs-typing i:nth-child(3) { animation-delay: 0.3s; }
        .gs-card:hover { border-color: rgba(245,166,35,0.55); }
        .gs-card:active { transform: scale(0.98); }
        .gs-chip:hover { border-color: rgba(245,166,35,0.5); color: #F5A623; }
        .gs-input:focus { border-color: rgba(245,166,35,0.6) !important; box-shadow: 0 0 0 3px rgba(245,166,35,0.15); }
        .gs-fab:hover { transform: scale(1.06); }
        .gs-fab:active { transform: scale(0.94); }
        .gs-chips::-webkit-scrollbar { display: none; }
      `}</style>

      {!open && (
        <button
          className="gs-fab"
          style={s.fab}
          onClick={openSheet}
          aria-label="Ask Scholar"
          title="Scholar — your AI study assistant"
        >
          <AiOrb size={30} pulsing={!seen || loading} />
          {dueCount > 0 && <span style={s.fabBadge}>{dueCount > 99 ? "99" : dueCount}</span>}
        </button>
      )}

      {open && (
        <>
          <div style={s.backdrop} onClick={() => setOpen(false)} />
          <div style={s.panel} role="dialog" aria-label="Scholar chat">
            <div style={s.head}>
              <AiOrb size={22} pulsing={loading} />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--app-text)" }}>Scholar</span>
                <span style={{ fontSize: 10.5, color: loading ? "#b07a10" : "var(--app-dim)" }}>
                  {loading ? (messages[messages.length - 1]?.streaming ? "Writing…" : "Thinking…") : "Your study companion"}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                {aiUsage && !aiUsage.isActivated && (
                  <button
                    style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                      border: "1px solid rgba(245,166,35,0.4)", background: "rgba(245,166,35,0.1)",
                      color: "#F5A623", cursor: "pointer", fontFamily: "inherit",
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
                    fontSize: 11, fontWeight: 700, padding: "3px 10px",
                    borderRadius: 999, background: "var(--app-tint-med)",
                    color: "var(--app-dim)",
                  }}>
                    🧠 {quizStats.correct}/{quizStats.answered}
                  </span>
                )}
                <button
                  style={{
                    background: "none", border: "none", color: "var(--app-dim)",
                    fontSize: 14, cursor: "pointer", padding: 4, fontFamily: "inherit",
                  }}
                  onClick={clearChat}
                  aria-label="New chat"
                  title="New chat"
                >
                  {confirmClear ? "Clear?" : "＋"}
                </button>
                <button
                  style={{
                    background: "none", border: "none", color: "var(--app-dim)",
                    fontSize: 15, cursor: "pointer", padding: 4, fontFamily: "inherit",
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "18px 8px 8px" }}>
                  <AiOrb size={44} pulsing style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--app-text)", marginBottom: 4 }}>Scholar</div>
                  <div style={{ fontSize: 12.5, color: "var(--app-dim)", lineHeight: 1.5, maxWidth: 300, marginBottom: 14 }}>
                    Hey — what topic is giving you trouble today? Explain it, drill it, or plan around it — I've got you.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
                    {cards.map((c, i) => (
                      <button
                        key={c.title}
                        className="gs-card"
                        style={{ ...s.card, animationDelay: `${i * 60}ms` }}
                        onClick={() => send(c.prompt)}
                      >
                        <span style={{ fontSize: 17 }}>{c.icon}</span>
                        <span style={{ flex: 1, textAlign: "left" }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>{c.title}</span>
                          <span style={{ display: "block", fontSize: 11, color: "var(--app-dim)" }}>{c.sub}</span>
                        </span>
                        <span style={{ color: "var(--app-faint)", fontSize: 14 }}>›</span>
                      </button>
                    ))}
                  </div>
                  {(onOpenAITutor || onOpenVoice) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {onOpenAITutor && (
                        <button style={s.chip} className="gs-chip" onClick={() => { setOpen(false); onOpenAITutor(); }}>
                          🤖 Full AI Tutor
                        </button>
                      )}
                      {onOpenVoice && (
                        <button style={s.chip} className="gs-chip" onClick={() => { setOpen(false); onOpenVoice(); }}>
                          🎙 Talk by voice
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} style={msg.role === "user" ? s.msgUser : s.msgAssistant}>
                  {msg.role === "assistant" && <AiOrb size={18} pulsing={!!msg.streaming} style={{ marginTop: 2 }} />}
                  {msg.role === "user" ? (
                    msg.content
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
                  margin: "4px 0 8px", padding: "10px 12px", borderRadius: 12,
                  border: "1px solid rgba(255,93,108,0.4)", background: "rgba(255,93,108,0.08)",
                  fontSize: 12.5, color: "var(--app-text)",
                }}>
                  <div style={{ fontWeight: 700 }}>⚠️ Scholar hit a snag</div>
                  <div style={{ fontSize: 11.5, opacity: 0.85, margin: "2px 0 6px" }}>{error}</div>
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
                  <button key={chip.label} style={s.chip} className="gs-chip" onClick={() => send(chip.prompt)}>
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            <div style={s.inputRow}>
              <textarea
                ref={inputRef}
                style={s.textarea}
                className="gs-input"
                rows={1}
                placeholder={messages.length === 0 ? "Ask Scholar anything…" : "Ask a follow-up…"}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                aria-label="Chat message"
              />
              <button
                style={{ ...s.sendBtn, opacity: loading || input.trim() ? 1 : 0.35 }}
                onClick={() => (loading ? stopStream() : send(input))}
                disabled={!loading && !input.trim()}
                aria-label={loading ? "Stop generating" : "Send message"}
              >
                {loading ? "■" : "↑"}
              </button>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
}
