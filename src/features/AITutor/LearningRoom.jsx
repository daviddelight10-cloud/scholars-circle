import React, { useState, useEffect, useRef, useCallback } from "react";
import { searchYouTube, fetchTranscript, fetchVideoDetails, getTranscriptWindow, formatTime } from "./youtubeApi.js";
import { speak, stopSpeaking, SpeechRecognitionAPI } from "./voice.js";
import MarkdownText from "../../components/MarkdownText.jsx";

// ─── YouTube IFrame Player loader (singleton) ────────────────────────────────
let ytApiPromise = null;
function loadYouTubeAPI() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  });
  return ytApiPromise;
}

const QUICK_ACTIONS = [
  { id: "explain", icon: "💡", label: "Explain this part", prompt: "Explain in simple language what is being said in this part of the video." },
  { id: "hint", icon: "🎯", label: "Hint", prompt: "I'm stuck. Give me a small hint to help me understand this concept, but don't give the full answer." },
  { id: "quiz", icon: "✅", label: "Quiz me", prompt: "Ask me 3 quick questions to check my understanding of what was just covered." },
  { id: "simplify", icon: "👶", label: "Explain simply", prompt: "Explain this concept like I am a 5-year-old, using a simple everyday analogy." },
  { id: "pidgin", icon: "🇳🇬", label: "Pidgin", prompt: "Break down what was just said in Nigerian Pidgin English so a Nigerian student can easily understand. Keep it educational and friendly." },
  { id: "example", icon: "🌍", label: "Example", prompt: "Give me a real-world example of this concept, preferably one a Nigerian university student can relate to." },
  { id: "jamb", icon: "📝", label: "JAMB-style", prompt: "Generate 3 JAMB / Post-UTME style multiple-choice questions on the topic just covered, with answers and brief explanations." },
  { id: "university", icon: "🎓", label: "University-style", prompt: "Generate 3 university exam style questions on the topic just covered (Nigerian university level, e.g. UI/UNILAG/OAU/ABU). Include a mix of: one short-answer, one essay/discussion question (with marking guide), and one application/calculation problem if applicable. Provide model answers and grading criteria." },
];

export default function LearningRoom({ tutor, subject, aiConfig }) {
  // Search state
  const [query, setQuery] = useState("");
  const [ngBoost, setNgBoost] = useState(true);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  // Selected video state
  const [video, setVideo] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [transcriptError, setTranscriptError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerState, setPlayerState] = useState("idle"); // idle, playing, paused

  // AI lesson state
  const [messages, setMessages] = useState([]);
  const [askInput, setAskInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [lessonSummary, setLessonSummary] = useState(null);
  const [keyConcepts, setKeyConcepts] = useState([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [endQuiz, setEndQuiz] = useState(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // Player refs
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const timeIntervalRef = useRef(null);
  const chatScrollRef = useRef(null);

  // ─── Search ────────────────────────────────────────────────────────────────
  async function doSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const items = await searchYouTube(query.trim(), { ngBoost });
      setResults(items);
      if (!items.length) setSearchError("No videos found. Try different keywords.");
    } catch (err) {
      setSearchError(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  // ─── Select Video ──────────────────────────────────────────────────────────
  async function selectVideo(v) {
    stopSpeaking();
    setVideo(v);
    setTranscript(null);
    setTranscriptError(null);
    setCurrentTime(0);
    setPlayerState("idle");
    setMessages([]);
    setLessonSummary(null);
    setKeyConcepts([]);
    setEndQuiz(null);
    setSpeakingMsgIdx(null);

    // If loaded from URL (title is "Custom Video"), fetch real details
    if (v.title === "Custom Video") {
      // Use YouTube oEmbed (free, no API key needed) to get real title
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.videoId}&format=json`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.title) {
            const updated = { ...v, title: data.title, channelTitle: data.author_name || v.channelTitle };
            setVideo(updated);
          }
        })
        .catch(() => {
          // Fallback: try our details endpoint
          fetchVideoDetails(v.videoId)
            .then((d) => {
              if (d?.title) setVideo((prev) => ({ ...prev, title: d.title, channelTitle: d.channelTitle || prev.channelTitle }));
            })
            .catch(() => {});
        });
    }

    // Try to fetch transcript (Phase 2)
    fetchTranscript(v.videoId).then(
      (segs) => {
        setTranscript(segs);
        // Auto-generate summary from transcript (Phase 3)
        if (segs.length) generateSummary(v, segs);
      },
      (err) => setTranscriptError(err.message || "No transcript")
    );
  }

  // ─── Mount YT player when video selected ───────────────────────────────────
  useEffect(() => {
    if (!video || !containerRef.current) return;
    let cancelled = false;
    let player;

    loadYouTubeAPI().then((YT) => {
      if (cancelled || !containerRef.current) return;
      // Destroy previous
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      // Build a fresh div for the player
      containerRef.current.innerHTML = '<div id="sc-yt-player" style="width:100%;height:100%;"></div>';
      player = new YT.Player("sc-yt-player", {
        width: "100%",
        height: "100%",
        videoId: video.videoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            playerRef.current = e.target;
          },
          onStateChange: (e) => {
            const ST = window.YT.PlayerState;
            if (e.data === ST.PLAYING) setPlayerState("playing");
            else if (e.data === ST.PAUSED) setPlayerState("paused");
            else if (e.data === ST.ENDED) {
              setPlayerState("ended");
              // Auto-generate end-of-lesson quiz (Phase 3)
              if (transcript?.length) generateEndQuiz(video, transcript);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.videoId]);

  // ─── Track current time ────────────────────────────────────────────────────
  useEffect(() => {
    if (!video) return;
    timeIntervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (p && typeof p.getCurrentTime === "function") {
        try {
          setCurrentTime(p.getCurrentTime() || 0);
        } catch {}
      }
    }, 1000);
    return () => clearInterval(timeIntervalRef.current);
  }, [video?.videoId]);

  // ─── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, asking]);

  // ─── Pause / Resume helpers ────────────────────────────────────────────────
  function pauseVideo() {
    try { playerRef.current?.pauseVideo(); } catch {}
  }
  function playVideo() {
    try { playerRef.current?.playVideo(); } catch {}
  }
  function seekTo(seconds) {
    try { playerRef.current?.seekTo(seconds, true); } catch {}
  }

  // ─── Build context-aware prompt ────────────────────────────────────────────
  function buildLessonPrompt(userQuestion) {
    // Get a wider transcript window (120 seconds) for better context
    const window = transcript ? getTranscriptWindow(transcript, currentTime, 120) : [];
    const transcriptChunk = window.map((s) => `[${formatTime(s.start)}] ${s.text}`).join(" ").slice(0, 2500);

    // Also get the full transcript up to current point for broader context
    const pastTranscript = transcript
      ? transcript.filter((s) => s.start <= currentTime).map((s) => s.text).join(" ").slice(-1500)
      : "";

    let context = `You are a Khan Academy-style university tutor helping a Nigerian student understand a YouTube video lesson.\n`;
    if (subject?.label) context += `Subject context: ${subject.label}\n`;
    context += `\nVideo being watched:\n`;
    context += `Title: "${video.title}"\n`;
    if (video.channelTitle) context += `Channel: ${video.channelTitle}\n`;
    context += `Current timestamp: ${formatTime(currentTime)}\n`;
    if (transcriptChunk) {
      context += `\nWhat is being said around this moment (transcript with timestamps):\n"${transcriptChunk}"\n`;
      if (pastTranscript && pastTranscript.length > transcriptChunk.length) {
        context += `\nEarlier in the video, the lecturer covered:\n"${pastTranscript}"\n`;
      }
      context += `\nIMPORTANT: Base your answer DIRECTLY on what the video is saying. Reference specific points from the transcript. Do not give generic textbook answers — explain what THIS video is teaching.\n`;
    } else {
      context += `\n(Transcript not available for this video.)\n`;
      context += `Based on the video title "${video.title}", explain the topic as if you are teaching the content that would typically be covered in such a lesson. Be specific to the topic in the title.\n`;
    }
    context += `\nTutor behavior:\n`;
    context += `- Use plain text only. NO markdown symbols (*, #, backticks, **).\n`;
    context += `- Use Nigerian university examples where helpful.\n`;
    context += `- Be Socratic when possible: ask one short check-understanding question after explaining.\n`;
    context += `- Keep responses focused (under 200 words unless asked for more).\n`;
    context += `- Always relate your answer back to what the video is discussing.\n`;
    context += `\nStudent question:\n${userQuestion}`;
    return context;
  }

  async function ask(userMessage) {
    if (!userMessage.trim() || asking || !video) return;
    pauseVideo();
    setAsking(true);
    const userMsg = { role: "user", content: userMessage, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    try {
      const prompt = buildLessonPrompt(userMessage);
      const { text } = await tutor.generate({ mode: "chat", input: prompt });
      const aiMsg = { role: "assistant", content: text, ts: Date.now() };
      setMessages((m) => [...m, aiMsg]);
      if (autoSpeak) {
        const idx = messages.length + 1; // approximate index after add
        setSpeakingMsgIdx(idx);
        speak(text, { onEnd: () => setSpeakingMsgIdx(null) });
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${err.message || "AI request failed"}`, ts: Date.now() }]);
    } finally {
      setAsking(false);
    }
  }

  function handleQuickAction(action) {
    ask(action.prompt);
  }

  // ─── Phase 3: Auto-generated lesson summary ────────────────────────────────
  async function generateSummary(v, segs) {
    if (!segs?.length || generatingSummary) return;
    setGeneratingSummary(true);
    try {
      const fullText = segs.map((s) => s.text).join(" ").slice(0, 8000);
      const prompt = `You are a study assistant. Read this YouTube lesson transcript and produce:
1. A 2-3 sentence summary of what the lesson is about.
2. A list of 4-7 key concepts covered (just short labels, separated by newlines).

Use plain text. NO markdown symbols.

Format your response EXACTLY like this:

SUMMARY:
[your summary here]

KEY CONCEPTS:
- concept 1
- concept 2
- concept 3

Lesson title: ${v.title}
Channel: ${v.channelTitle || "unknown"}
Transcript:
"${fullText}"`;
      const { text } = await tutor.generate({ mode: "chat", input: prompt });
      const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?:KEY CONCEPTS:|$)/i);
      const conceptsMatch = text.match(/KEY CONCEPTS:\s*([\s\S]*)/i);
      const summary = summaryMatch ? summaryMatch[1].trim() : text;
      const concepts = conceptsMatch
        ? conceptsMatch[1]
            .split(/\n+/)
            .map((line) => line.replace(/^[-•*]\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 8)
        : [];
      setLessonSummary(summary);
      setKeyConcepts(concepts);
    } catch (err) {
      console.warn("Summary generation failed:", err.message);
    } finally {
      setGeneratingSummary(false);
    }
  }

  // ─── Phase 3: End-of-lesson quiz ───────────────────────────────────────────
  async function generateEndQuiz(v, segs) {
    if (generatingQuiz || endQuiz) return;
    setGeneratingQuiz(true);
    try {
      const fullText = segs.map((s) => s.text).join(" ").slice(0, 6000);
      const prompt = `Generate 5 multiple-choice questions to test understanding of this lesson.

Output STRICTLY a JSON array, no prose before or after.
Each item: {"q": "question", "options": ["A","B","C","D"], "answer": 0, "explanation": "why correct"}
- "answer" is 0-indexed correct option.

Lesson: ${v.title}
Transcript: "${fullText}"`;
      const { text } = await tutor.generate({ mode: "chat", input: prompt });
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const arr = JSON.parse(jsonMatch[0]);
        if (Array.isArray(arr)) {
          setEndQuiz({
            questions: arr,
            current: 0,
            answers: [],
            score: 0,
            done: false,
          });
        }
      }
    } catch (err) {
      console.warn("Quiz generation failed:", err.message);
    } finally {
      setGeneratingQuiz(false);
    }
  }

  function answerQuizQuestion(optionIdx) {
    if (!endQuiz || endQuiz.done) return;
    const q = endQuiz.questions[endQuiz.current];
    const correct = optionIdx === q.answer;
    const newAnswers = [...endQuiz.answers, { selected: optionIdx, correct }];
    const newScore = endQuiz.score + (correct ? 1 : 0);
    const next = endQuiz.current + 1;
    if (next >= endQuiz.questions.length) {
      setEndQuiz({ ...endQuiz, answers: newAnswers, score: newScore, done: true });
    } else {
      setEndQuiz({ ...endQuiz, current: next, answers: newAnswers, score: newScore });
    }
  }

  // ─── Voice (TTS / STT) ─────────────────────────────────────────────────────
  function handleSpeak(idx, text) {
    if (speakingMsgIdx === idx) {
      stopSpeaking();
      setSpeakingMsgIdx(null);
      return;
    }
    setSpeakingMsgIdx(idx);
    speak(text, { onEnd: () => setSpeakingMsgIdx(null) });
  }

  function toggleListening() {
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRecognitionAPI();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      let t = "";
      for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript;
      setAskInput(t);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="learning-room" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Search Bar */}
      {!video && (
        <SearchPanel
          query={query}
          setQuery={setQuery}
          ngBoost={ngBoost}
          setNgBoost={setNgBoost}
          searching={searching}
          searchError={searchError}
          results={results}
          onSearch={doSearch}
          onSelect={selectVideo}
          subject={subject}
        />
      )}

      {/* Active Lesson */}
      {video && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
          {/* Top bar: back + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => { setVideo(null); stopSpeaking(); }}
              style={btnSecondary}
            >
              ← Back to search
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#FFD700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {video.title}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {video.channelTitle} · {formatTime(currentTime)}
                {transcript && <> · <span style={{ color: "#34d399" }}>📜 transcript ready</span></>}
                {transcriptError && <> · <span style={{ color: "#fbbf24" }}>⚠️ no transcript (AI will use video title)</span></>}
              </div>
            </div>
          </div>

          {/* Two-column: Video + AI panel */}
          <div
            className="learning-room-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 3fr) minmax(280px, 2fr)",
              gap: 12,
              alignItems: "start",
            }}
          >
            {/* LEFT: Video + lesson companion */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="yt-frame" style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: 12,
                overflow: "hidden",
                background: "#000",
                border: "1px solid rgba(255,215,0,0.2)",
              }}>
                <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              </div>

              {/* Player controls helper */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={playerState === "playing" ? pauseVideo : playVideo} style={btnPrimary}>
                  {playerState === "playing" ? "⏸️ Pause" : "▶️ Play"}
                </button>
                <button onClick={() => seekTo(Math.max(0, currentTime - 10))} style={btnSecondary}>⏪ -10s</button>
                <button onClick={() => seekTo(currentTime + 10)} style={btnSecondary}>⏩ +10s</button>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>
                  ⏱️ {formatTime(currentTime)}
                </span>
              </div>

              {/* Lesson Summary (Phase 3) */}
              {(lessonSummary || generatingSummary) && (
                <LessonSummary
                  summary={lessonSummary}
                  concepts={keyConcepts}
                  loading={generatingSummary}
                />
              )}

              {/* End-of-lesson Quiz (Phase 3) */}
              {(endQuiz || generatingQuiz) && (
                <EndQuiz
                  quiz={endQuiz}
                  loading={generatingQuiz}
                  onAnswer={answerQuizQuestion}
                  onRestart={() => video && transcript && generateEndQuiz(video, transcript)}
                />
              )}
            </div>

            {/* RIGHT: AI Tutor Panel */}
            <div className="tutor-panel" style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(10,10,10,0.7)",
              border: "1px solid rgba(255,215,0,0.25)",
              borderRadius: 12,
              padding: 12,
              gap: 10,
              minHeight: 420,
              maxHeight: 700,
            }}>
              {/* Tutor avatar + status */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,215,0,0.15)" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, #FFD700, #DAA520)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>🎓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#FFD700" }}>Tunde the Tutor</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {asking ? "💭 thinking..." : playerState === "playing" ? "👀 watching with you" : "⏸️ paused — ask anything"}
                  </div>
                </div>
                <button
                  onClick={() => setAutoSpeak((s) => !s)}
                  title={autoSpeak ? "Auto-speak ON" : "Auto-speak OFF"}
                  style={{ ...btnSecondary, padding: "4px 8px", fontSize: 11 }}
                >
                  {autoSpeak ? "🔊" : "🔇"}
                </button>
              </div>

              {/* Quick action chips */}
              <div className="quick-actions-row" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleQuickAction(a)}
                    disabled={asking}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,215,0,0.3)",
                      background: "rgba(20,20,20,0.7)",
                      color: "#FFD700",
                      fontSize: 11,
                      cursor: asking ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 4 }}>
                {messages.length === 0 && !asking && (
                  <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", padding: 20 }}>
                    Pause the video and ask anything, or tap a quick action above.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className="lr-msg"
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "92%",
                      padding: "8px 12px",
                      borderRadius: 12,
                      background: m.role === "user" ? "linear-gradient(135deg, #FFD700, #DAA520)" : "rgba(20,20,20,0.9)",
                      color: m.role === "user" ? "#fff" : "#e5e7eb",
                      fontSize: 13,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      border: m.role === "assistant" ? "1px solid rgba(255,215,0,0.2)" : "none",
                    }}
                  >
                    {m.role === "assistant" ? <MarkdownText>{m.content}</MarkdownText> : m.content}
                    {m.role === "assistant" && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => handleSpeak(i, m.content)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid rgba(255,215,0,0.3)",
                            background: speakingMsgIdx === i ? "rgba(255,215,0,0.3)" : "transparent",
                            color: "#FFD700",
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          {speakingMsgIdx === i ? "⏹️ Stop" : "🔊 Listen"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {asking && (
                  <div style={{ alignSelf: "flex-start", color: "#9ca3af", fontStyle: "italic", padding: "6px 12px", fontSize: 12 }}>
                    🤔 Thinking...
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={(e) => { e.preventDefault(); ask(askInput); setAskInput(""); }} style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={toggleListening}
                  title="Speak your question"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: listening ? "2px solid #ef4444" : "1px solid rgba(255,215,0,0.3)",
                    background: listening ? "rgba(239,68,68,0.15)" : "rgba(20,20,20,0.7)",
                    color: listening ? "#f87171" : "#FFD700",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {listening ? "⏹️" : "🎤"}
                </button>
                <input
                  type="text"
                  className="lr-input"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  placeholder={listening ? "Listening..." : "Ask about this video..."}
                  disabled={asking}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,215,0,0.3)",
                    background: "rgba(20,20,20,0.7)",
                    color: "#fff",
                    fontSize: 14,
                  }}
                />
                <button
                  type="submit"
                  disabled={asking || !askInput.trim()}
                  style={{ ...btnPrimary, padding: "8px 14px", fontSize: 13 }}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <style>{`
        /* Force YT iframe to fill its container at every size */
        .yt-frame iframe {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
        }
        @media (max-width: 900px) {
          .learning-room-grid { grid-template-columns: 1fr !important; }
          .tutor-panel { max-height: 520px !important; min-height: 360px !important; }
        }
        @media (max-width: 600px) {
          .learning-room { padding: 8px !important; }
          .tutor-panel { padding: 8px !important; min-height: 320px !important; }
          .quick-actions-row button { font-size: 10px !important; padding: 5px 8px !important; }
          .lr-msg { font-size: 12px !important; }
          .lr-input { font-size: 14px !important; } /* >= 16px prevents iOS zoom; using 14 with viewport meta */
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function extractVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.trim().match(p);
    if (m) return m[1];
  }
  return null;
}

function SearchPanel({ query, setQuery, ngBoost, setNgBoost, searching, searchError, results, onSearch, onSelect, subject }) {
  const isUrl = /(?:youtube\.com|youtu\.be)/.test(query);

  function handleSubmit(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    const videoId = extractVideoId(query);
    if (videoId) {
      onSelect({
        videoId,
        title: "Custom Video",
        channelTitle: "YouTube",
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      });
    } else {
      onSearch(e);
    }
  }

  const suggestions = [
    "mitosis cell division",
    "photosynthesis light reactions",
    "Newton's laws of motion",
    "differential equations basics",
    "BIO 101 cell biology",
    "JAMB biology past questions",
    "thermodynamics first law",
    "balanced chemical equations",
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>🎬</div>
        <h3 style={{ margin: 0, color: "#FFD700" }}>Learn from any topic</h3>
        <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
          Search a topic or paste a YouTube URL → watch the lesson → pause anytime to ask the AI tutor
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={subject ? `Topic or YouTube URL (${subject.label})...` : "Search topic or paste YouTube URL..."}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${isUrl ? "rgba(34,197,94,0.5)" : "rgba(255,215,0,0.3)"}`,
            background: "rgba(20,20,20,0.8)",
            color: "#fff",
            fontSize: 14,
          }}
        />
        <button type="submit" disabled={searching || !query.trim()} style={btnPrimary}>
          {searching ? "Searching..." : isUrl ? "▶️ Load" : "🔍 Search"}
        </button>
      </form>
      {isUrl && (
        <div style={{ fontSize: 11, color: "#34d399", marginTop: -8 }}>🔗 YouTube URL detected — click Load to play</div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#FFD700", cursor: "pointer" }}>
        <input type="checkbox" checked={ngBoost} onChange={(e) => setNgBoost(e.target.checked)} />
        🇳🇬 Boost results for Nigerian university context
      </label>

      {searchError && (
        <div style={{ color: "#f87171", fontSize: 13, padding: 10, background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>
          {searchError}
        </div>
      )}

      {results.length === 0 && !searching && (
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Try one of these:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,215,0,0.3)",
                  background: "rgba(20,20,20,0.6)",
                  color: "#FFD700",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {results.map((v) => (
            <button
              key={v.videoId}
              onClick={() => onSelect(v)}
              style={{
                textAlign: "left",
                background: "rgba(20,20,20,0.7)",
                border: "1px solid rgba(255,215,0,0.2)",
                borderRadius: 10,
                padding: 0,
                cursor: "pointer",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {v.thumbnail && (
                <img
                  src={v.thumbnail}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }}
                />
              )}
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#FFD700", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3 }}>
                  {v.title}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {v.channelTitle}
                  {v.duration && ` · ${v.duration}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonSummary({ summary, concepts, loading }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(218,165,32,0.05))",
      border: "1px solid rgba(255,215,0,0.2)",
      borderRadius: 10,
      padding: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFD700", marginBottom: 6 }}>
        📖 Lesson Companion {loading && "(generating...)"}
      </div>
      {summary && (
        <div style={{ fontSize: 13, color: "#FFD700", lineHeight: 1.5, marginBottom: 8 }}>
          {summary}
        </div>
      )}
      {concepts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {concepts.map((c, i) => (
            <span key={i} style={{
              padding: "3px 8px",
              borderRadius: 12,
              background: "rgba(255,215,0,0.15)",
              color: "#c4b5fd",
              fontSize: 11,
            }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EndQuiz({ quiz, loading, onAnswer, onRestart }) {
  if (loading || !quiz) {
    return (
      <div style={{ padding: 12, background: "rgba(20,20,20,0.6)", borderRadius: 10, fontSize: 13, color: "#FFD700" }}>
        🧠 Generating end-of-lesson quiz...
      </div>
    );
  }
  if (quiz.done) {
    const pct = Math.round((quiz.score / quiz.questions.length) * 100);
    return (
      <div style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(255,215,0,0.3)", background: "rgba(20,20,20,0.8)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚"}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#FFD700" }}>
            {quiz.score} / {quiz.questions.length} ({pct}%)
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>End-of-lesson quiz</div>
        </div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {quiz.questions.map((q, i) => {
            const a = quiz.answers[i];
            return (
              <div key={i} style={{ padding: 8, borderRadius: 8, background: "rgba(10,10,10,0.6)", fontSize: 12 }}>
                <div style={{ color: "#e5e7eb", fontWeight: 600, marginBottom: 4 }}>{i + 1}. {q.q}</div>
                <div style={{ color: a.correct ? "#4ade80" : "#f87171" }}>
                  {a.correct ? "✓" : "✗"} Your answer: {q.options[a.selected]}
                </div>
                {!a.correct && (
                  <div style={{ color: "#4ade80" }}>Correct: {q.options[q.answer]}</div>
                )}
                {q.explanation && (
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>💡 {q.explanation}</div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onRestart} style={{ ...btnSecondary, marginTop: 10 }}>🔄 New Quiz</button>
      </div>
    );
  }
  const q = quiz.questions[quiz.current];
  return (
    <div style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(255,215,0,0.3)", background: "rgba(20,20,20,0.8)" }}>
      <div style={{ fontSize: 11, color: "#FFD700", marginBottom: 6 }}>
        🧠 Quiz · {quiz.current + 1} / {quiz.questions.length}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#FFD700", marginBottom: 10 }}>{q.q}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onAnswer(i)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,215,0,0.3)",
              background: "rgba(10,10,10,0.6)",
              color: "#e5e7eb",
              fontSize: 13,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {String.fromCharCode(65 + i)}. {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shared button styles ────────────────────────────────────────────────────
const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #FFD700, #DAA520)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const btnSecondary = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,215,0,0.3)",
  background: "rgba(20,20,20,0.7)",
  color: "#FFD700",
  fontSize: 12,
  cursor: "pointer",
};
