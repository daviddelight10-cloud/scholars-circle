import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/constants";
import { callAIMultimodal } from "../lib/aiClient";
import MarkdownText from "../components/MarkdownText";
import { SpeechEngine, chunkNarration, mdToSpeechText, pickVoice, speechSupported, unlockSpeech } from "./pdf-reader/page-tutor/speech";
import { isPremium, openPremium } from "../lib/premium";

const D = {
  bg: "var(--app-bg)",
  bar: "var(--app-surface)",
  accent: "var(--app-card2)",
  line: "var(--app-tint-med)",
  text: "var(--app-text)",
  muted: "var(--app-dim)",
  hint: "#646E84",
  faint: "#3A4356",
  gold: "#FFD700",
};

const SUMMARY_TUTOR = `You are a study assistant embedded in a student's AI-generated study summary.

RULE: Start your reply with the answer itself — NO preamble, NO "great question", NO restating the question.

Format: **bold** key terms. Bullet points for lists. Numbered steps for processes.
Length: concise and scannable — this is revision, not a lecture.`;

const CHAT_STARTERS = ["Explain the hardest concept simply", "Quiz me on this summary", "Test me like a viva", "Give me a clinical vignette"];

function pdfDownloadUrl(fileUrl) {
  const token = (() => {
    try {
      return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken || "";
    } catch {
      return "";
    }
  })();
  return `${API_BASE}/api/resources/proxy-pdf?url=${encodeURIComponent(fileUrl)}&token=${encodeURIComponent(token)}`;
}

function getScrollParent(el) {
  let node = el?.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (/(auto|scroll)/.test(oy) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return document.scrollingElement;
}

/**
 * Full-screen, ChatGPT-style reading surface for AI-generated summaries.
 * Markdown renders directly on the page background in a centered column —
 * no card, no chrome. Extras: section rail (desktop), reading progress +
 * resume memory, blur-to-recall mode, Practice shortcut, embedded Ask AI.
 */
export default function SummaryView({ resource, onBack, onOpenResource }) {
  const [recall, setRecall] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeSec, setActiveSec] = useState(0);
  const [resumeTo, setResumeTo] = useState(() => {  // saved scrollTop offered for restore
    try {
      const saved = parseInt(localStorage.getItem(`sc_sum_scroll_${resource?.id}`) || "0", 10) || 0;
      return saved > 150 ? saved : null;
    } catch { return null; }
  });
  const bodyRef = useRef(null);
  const lastSaveRef = useRef(0);

  const scrollKey = `sc_sum_scroll_${resource?.id}`;

  // Section titles — same ordering as MarkdownText's md-sec-N heading ids.
  const sections = useMemo(() => {
    const md = (resource?.description || "").replace(/```[\s\S]*?```/g, "");
    const out = [];
    const re = /^#{1,4}\s+(.+?)\s*$/gm;
    let m;
    while ((m = re.exec(md)) !== null) out.push(m[1].replace(/\*\*/g, ""));
    return out;
  }, [resource?.description]);

  const mcqToken = resource?.sourceResource?.derivedResources
    ?.find((d) => d.contentType === "mcq")?.shareToken || null;

  // ── Podcast listen — same chunked SpeechEngine the Page Tutor fallback uses ──
  const speechRef = useRef(null);
  const chunksRef = useRef([]);
  const [audio, setAudio] = useState(null); // { playing, idx, count, rate, done }
  const getEngine = () => (speechRef.current ||= new SpeechEngine());

  const bindAndStart = (rate, startAt = 0) => {
    getEngine().start(chunksRef.current, {
      startAt,
      rate,
      onChunk: (idx, count) => setAudio((a) => (a ? { ...a, idx, count, playing: true, done: false } : a)),
      onEnd: () => setAudio((a) => (a ? { ...a, playing: false, done: true } : a)),
    });
    setAudio({ playing: true, idx: startAt, count: chunksRef.current.length, rate, done: false });
  };

  const startAudio = () => {
    chunksRef.current = chunkNarration(mdToSpeechText(resource?.description || ""));
    if (chunksRef.current.length) bindAndStart(audio?.rate || 1);
  };

  const toggleAudio = () => {
    if (!speechSupported()) return;
    unlockSpeech(); // gesture-chain TTS unlock — see speech.js
    if (!audio || audio.done) return startAudio();
    const eng = getEngine();
    if (audio.playing) { eng.pause(); setAudio({ ...audio, playing: false }); }
    else { eng.resume(); setAudio({ ...audio, playing: true }); }
  };

  const stopAudio = () => { getEngine().cancel(); setAudio(null); };

  // Scrubbing through the narration (and the ±15s hops) is a premium
  // control — free users get play/pause, the bar is read-only and taps
  // route to the upgrade modal.
  const premium = isPremium();
  const [scrub, setScrub] = useState(null); // 0..1 while the bar is being dragged

  const barFrac = (e, bar) => {
    const r = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };

  const onBarDown = (e) => {
    if (!premium) { openPremium("summary_seek"); return; }
    const bar = e.currentTarget;
    bar.setPointerCapture?.(e.pointerId);
    setScrub(barFrac(e, bar));
    const move = (ev) => setScrub(barFrac(ev, bar));
    const up = (ev) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      setScrub(null);
      getEngine().seekTo(barFrac(ev, bar));
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };

  const seekOrUpsell = (n) => (premium ? getEngine().skipBy(n) : openPremium("summary_seek"));
  const cycleRate = () => {
    const next = audio.rate === 1 ? 1.25 : audio.rate === 1.25 ? 1.5 : 1;
    getEngine().setRate(next);
    setAudio({ ...audio, rate: next });
  };

  useEffect(() => () => speechRef.current?.cancel(), []);
  // Pre-resolve the voice list — engine.start() then speaks synchronously
  // inside the tap (mobile browsers drop non-gesture-chained utterances).
  useEffect(() => { if (speechSupported()) pickVoice(); }, []);

  // ── Ask AI chat ──
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const chatEndRef = useRef(null);

  const sendChat = async (text) => {
    const trimmed = (text ?? chatInput).trim();
    if (!trimmed || chatLoading) return;
    const historyForApi = [...chatMsgs, { role: "user", content: trimmed }];
    setChatMsgs(historyForApi);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);
    const ctx = `\n\nTHE SUMMARY (student's reference):\n${(resource?.description || "").slice(0, 6000)}`;
    const prompt = `${SUMMARY_TUTOR}${ctx}\n\n---\n\nCONVERSATION SO FAR:\n${historyForApi.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")}\n\nAnswer the user's latest message directly.`;
    try {
      const answer = await callAIMultimodal(prompt, null, historyForApi, { provider: "openrouter" });
      setChatMsgs((prev) => [...prev, { role: "assistant", content: answer || "No response." }]);
    } catch (err) {
      setChatError(err.message || "Something went wrong. Try again.");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatLoading]);

  // Reading progress + active section + scroll-position memory.
  // Capture-phase scroll listener catches whichever ancestor scrolls.
  useEffect(() => {
    const onScroll = (e) => {
      const t = e.target;
      const el = t === document ? document.scrollingElement : t;
      if (!(el instanceof Element) || el.scrollHeight <= el.clientHeight) return;
      setProgress(Math.min(1, el.scrollTop / (el.scrollHeight - el.clientHeight)));
      const heads = bodyRef.current?.querySelectorAll("[id^='md-sec-']");
      if (heads?.length) {
        const limit = el.getBoundingClientRect().top + 100;
        let cur = 0;
        heads.forEach((h, i) => { if (h.getBoundingClientRect().top <= limit) cur = i; });
        setActiveSec(cur);
      }
      // Persist scroll position (throttled ~300ms); clear the resume offer once used
      const now = Date.now();
      if (now - lastSaveRef.current > 300) {
        lastSaveRef.current = now;
        try { localStorage.setItem(scrollKey, String(Math.round(el.scrollTop))); } catch {}
        if (resumeTo !== null && Math.abs(el.scrollTop - resumeTo) < 60) setResumeTo(null);
      }
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [scrollKey, resumeTo]);

  const jump = (i) => {
    document.getElementById(`md-sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resume = () => {
    const el = getScrollParent(bodyRef.current);
    el?.scrollTo({ top: resumeTo, behavior: "smooth" });
    setResumeTo(null);
  };

  const pill = (active) => ({
    display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
    fontSize: 11, fontWeight: 700, cursor: "pointer",
    color: active ? "var(--app-ink)" : D.gold,
    background: active ? D.gold : "rgba(255,215,0,0.08)",
    border: `0.5px solid ${active ? D.gold : "rgba(255,215,0,0.25)"}`,
    borderRadius: 999, padding: "6px 12px", textDecoration: "none",
  });

  return (
    <div style={{ minHeight: "100%", display: "flex", background: D.bg, fontFamily: "Manrope,sans-serif" }}>
      <style>{`
        .sum-rail { display: none; }
        @media (min-width: 960px) {
          .sum-rail { display: block; }
        }
        @keyframes sumFadeUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      {/* Section rail — desktop */}
      {sections.length > 1 && (
        <nav className="sum-rail" style={{
          position: "sticky", top: 0, alignSelf: "flex-start", flexShrink: 0,
          width: 210, maxHeight: "100vh", overflowY: "auto", scrollbarWidth: "none",
          padding: "72px 18px 30px 26px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: D.faint, marginBottom: 12 }}>
            SECTIONS
          </div>
          {sections.map((s, i) => (
            <button
              key={i}
              onClick={() => jump(i)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 0 6px 12px", marginBottom: 2,
                fontSize: 12, fontWeight: activeSec === i ? 700 : 500,
                color: activeSec === i ? D.gold : D.muted,
                borderLeft: `2px solid ${activeSec === i ? D.gold : "transparent"}`,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >{s}</button>
          ))}
        </nav>
      )}

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Slim sticky top bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px 11px", flexShrink: 0,
          position: "sticky", top: 0, zIndex: 20,
          borderBottom: `0.5px solid ${D.line}`, background: D.bar,
        }}>
          <button
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: D.accent, border: `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: D.muted, fontSize: 17,
            }}
          >←</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700,
              color: D.text, lineHeight: 1.1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {resource?.title || "Summary"}
            </div>
            <div style={{ fontSize: 11, color: "var(--app-faint)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {resource?.subject ? `${resource.subject} · ` : ""}AI-generated summary
            </div>
          </div>

          {speechSupported() && (
            <button
              onClick={toggleAudio}
              title={audio?.playing ? "Pause the audio summary" : "Listen to this summary like a podcast"}
              style={pill(!!audio)}
            >
              {audio?.playing ? "❚❚ Listening" : "🎧 Listen"}
            </button>
          )}

          <button
            onClick={() => setChatOpen((o) => !o)}
            title="Ask AI about this summary"
            style={pill(chatOpen)}
          >
            ✦ Ask AI
          </button>

          <button
            onClick={() => setRecall((r) => !r)}
            title={recall ? "Show all terms" : "Blur key terms — tap each to reveal"}
            style={pill(recall)}
          >
            {recall ? "👁 Recall" : "🙈 Recall"}
          </button>

          {mcqToken && onOpenResource && (
            <button onClick={() => onOpenResource(mcqToken)} title="Practice the source material's questions" style={pill(true)}>
              ⚡ Practice
            </button>
          )}

          {resource?.fileUrl && (
            <a href={pdfDownloadUrl(resource.fileUrl)} target="_blank" rel="noopener noreferrer" title="Download PDF" style={pill(false)}>
              ⬇ PDF
            </a>
          )}

          {/* Reading progress — bottom edge of the bar */}
          <div style={{
            position: "absolute", left: 0, bottom: -1, height: 2,
            width: `${progress * 100}%`, background: D.gold,
            transition: "width 0.1s linear",
          }} />
        </div>

        {/* Body — markdown on the page background, centered column */}
        <div ref={bodyRef} style={{ flex: 1, padding: `26px 18px ${audio ? 150 : 60}px` }}>
          <div style={{ maxWidth: 780, margin: "0 auto", width: "100%" }}>
            <MarkdownText theme="gold" recallMode={recall}>{resource?.description || ""}</MarkdownText>
            <div style={{
              marginTop: 40, paddingTop: 16, borderTop: `0.5px solid ${D.line}`,
              fontSize: 11, color: "#4A5266", textAlign: "center",
            }}>
              Generated from {resource?.title || "your material"} · Scholars Circle
            </div>
          </div>
        </div>
      </div>

      {/* Podcast mini-player */}
      {audio && (
        <div style={{
          position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
          width: "min(440px, calc(100vw - 32px))", zIndex: 45,
          background: D.bar, border: `0.5px solid ${D.line}`, borderRadius: 16,
          padding: "10px 12px 12px", boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column", gap: 8,
          animation: "sumFadeUp 0.25s ease", fontFamily: "Manrope,sans-serif",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: D.gold, flexShrink: 0 }}>
              {audio.playing ? "LISTENING" : audio.done ? "FINISHED" : "PAUSED"}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: D.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {resource?.title || "Summary"}
            </span>
            <button onClick={stopAudio} aria-label="Stop playback" style={{ background: "none", border: "none", color: D.hint, fontSize: 15, cursor: "pointer", padding: 2, fontFamily: "inherit" }}>✕</button>
          </div>

          {/* Progress — premium users can drag the knob to scrub back through
              the audio; free users see a read-only bar that routes to upgrade */}
          <div
            onPointerDown={onBarDown}
            title={premium ? "Drag to scrub through the audio" : "Premium — drag to scrub through the audio"}
            style={{ height: 16, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
          >
            <div style={{ position: "relative", width: "100%", height: 4, borderRadius: 99, background: D.accent }}>
              <div style={{
                height: "100%", borderRadius: 99, background: D.gold,
                width: `${(scrub ?? (audio.count ? audio.idx / audio.count : 0)) * 100}%`,
                transition: scrub != null ? "none" : "width 0.3s linear",
              }} />
              <div style={{
                position: "absolute", top: "50%", left: `${(scrub ?? (audio.count ? audio.idx / audio.count : 0)) * 100}%`,
                width: 12, height: 12, borderRadius: "50%", background: D.gold,
                transform: "translate(-50%, -50%)", boxShadow: "0 1px 5px rgba(0,0,0,0.45)",
                opacity: premium ? 1 : 0.5,
              }} />
            </div>
            {!premium && <span aria-hidden="true" style={{ fontSize: 10, marginLeft: 8 }}>🔒</span>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {[["↺ 15", () => seekOrUpsell(-1), "Back ~15s"], ["↻ 15", () => seekOrUpsell(1), "Forward ~15s"]].map(([l, fn, t]) => (
              <button key={l} onClick={fn} title={premium ? t : `Premium — ${t.toLowerCase()}`} style={{
                padding: "5px 10px", borderRadius: 9, border: `0.5px solid ${D.line}`,
                background: "none", color: premium ? D.muted : D.hint, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                opacity: premium ? 1 : 0.65,
              }}>{l}</button>
            ))}
            <button
              onClick={toggleAudio}
              aria-label={audio.playing ? "Pause" : "Play"}
              style={{
                width: 40, height: 40, borderRadius: "50%", border: "none",
                background: D.gold, color: "var(--app-ink)", fontSize: 15, fontWeight: 800,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >{audio.playing ? "❚❚" : audio.done ? "↻" : "▶"}</button>
            <button onClick={cycleRate} title="Playback speed" style={{
              padding: "5px 9px", borderRadius: 9, border: `0.5px solid ${D.line}`,
              background: "none", color: D.gold, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}>{audio.rate}×</button>
            <span style={{ fontSize: 10.5, color: D.hint, minWidth: 34, textAlign: "right" }}>
              {audio.count ? `${Math.round((audio.idx / audio.count) * 100)}%` : ""}
            </span>
          </div>
        </div>
      )}

      {/* Resume where you left off */}
      {resumeTo !== null && (
        <button
          onClick={resume}
          style={{
            position: "fixed", bottom: audio ? 118 : 20, left: "50%", transform: "translateX(-50%)",
            zIndex: 40, padding: "9px 18px", borderRadius: 999, cursor: "pointer",
            background: D.gold, color: "var(--app-ink)", border: "none",
            fontSize: 12, fontWeight: 700, fontFamily: "Manrope,sans-serif",
            boxShadow: "0 4px 18px rgba(0,0,0,0.5)", animation: "sumFadeUp 0.25s ease",
          }}
        >
          ⟲ Resume where you left off
        </button>
      )}

      {/* Ask AI — floating panel */}
      {chatOpen && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(380px, 100vw)",
          zIndex: 50, display: "flex", flexDirection: "column",
          background: D.bar, borderLeft: `0.5px solid ${D.line}`,
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 12px",
            borderBottom: `0.5px solid ${D.line}`, flexShrink: 0,
          }}>
            <span style={{ color: D.gold, fontSize: 15 }}>✦</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: D.text }}>Ask about this summary</div>
              <div style={{ fontSize: 10.5, color: D.hint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resource?.title}</div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                width: 28, height: 28, borderRadius: "50%", background: D.accent,
                border: `0.5px solid ${D.line}`, color: D.muted, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: 10, scrollbarWidth: "thin" }}>
            {chatMsgs.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: 11.5, color: D.hint, marginBottom: 2 }}>Ask anything — it knows the summary:</div>
                {CHAT_STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendChat(s)}
                    style={{
                      textAlign: "left", padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,215,0,0.06)", border: `0.5px solid rgba(255,215,0,0.2)`,
                      color: "var(--c-e8d9a0)", fontSize: 12, fontWeight: 600, fontFamily: "Manrope,sans-serif",
                    }}
                  >{s}</button>
                ))}
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                background: m.role === "user" ? "rgba(255,215,0,0.10)" : "var(--app-tint-soft)",
                border: `0.5px solid ${m.role === "user" ? "rgba(255,215,0,0.3)" : D.line}`,
                borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                padding: "8px 11px", fontSize: 12.5, color: D.text, lineHeight: 1.6,
              }}>
                {m.role === "assistant" ? <MarkdownText theme="gold">{m.content}</MarkdownText> : m.content}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: "flex-start", padding: "8px 11px", fontSize: 12.5, color: D.hint }}>Thinking…</div>
            )}
            {chatError && (
              <div style={{ fontSize: 11.5, color: "var(--c-ef9a9a)", padding: "4px 2px" }}>{chatError}</div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{
            display: "flex", gap: 8, padding: "10px 12px", flexShrink: 0,
            borderTop: `0.5px solid ${D.line}`,
          }}>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Ask about this summary…"
              rows={1}
              style={{
                flex: 1, resize: "none", borderRadius: 10, padding: "9px 11px",
                background: D.accent, border: `0.5px solid ${D.line}`,
                color: D.text, fontSize: 12.5, fontFamily: "Manrope,sans-serif",
                outline: "none", maxHeight: 90,
              }}
            />
            <button
              onClick={() => sendChat()}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0, alignSelf: "flex-end",
                background: chatInput.trim() ? D.gold : D.accent, border: "none",
                color: chatInput.trim() ? "var(--app-ink)" : D.faint, fontSize: 15,
                cursor: chatInput.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >→</button>
          </div>
        </div>
      )}
    </div>
  );
}
