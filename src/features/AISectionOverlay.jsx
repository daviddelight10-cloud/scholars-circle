import React, { useState, useRef, useEffect, useMemo } from "react";
import { callAI, callAIMultimodal, extractJSON } from "../lib/aiClient";
import { buildSystemPrompt, buildConversationContext } from "./AITutor/prompts.js";
import { detectDiscipline } from "./AITutor/disciplines.js";
import { extractTextFromFile } from "./AITutor/fileExtract.js";
import LearningRoom from "./AITutor/LearningRoom";
import GuidedStudy from "./GuidedStudy";
import MarkdownText from "../components/MarkdownText.jsx";

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  bg:      "#0B0E1A",
  card:    "#141829",
  bar:     "#0E1120",
  accent:  "#1C1F3A",
  border:  "#6366F1",
  line:    "#1E2238",
  line2:   "#161A2E",
  text:    "#E2E8F0",
  muted:   "#94A3B8",
  hint:    "#64748B",
  faint:   "#334155",
  userBg:  "#1E1B4B",
  userBdr: "#6366F1",
  userTxt: "#A5B4FC",
  aiBdr:   "#252A45",
  accent2: "#818CF8",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Manrope:wght@400;500;600&display=swap');`;

const CHIPS = [
  "What is a Cell?",
  "Explain Ohm's Law",
  "Define osmosis",
  "What is photosynthesis?",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function searchQuestionBank(query, subjects) {
  if (!subjects?.length) return { found: false };
  const ql = query.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  const words = ql.split(/\s+/).filter(w => w.length > 3);
  if (!words.length) return { found: false };
  for (const subj of subjects) {
    const pool = (subj.questions || []).filter(q => {
      const qt = ((q.q || q.question || "") + " " + (q.topic || "") + " " + subj.label).toLowerCase();
      return words.some(w => qt.includes(w));
    });
    if (pool.length >= 2) {
      return {
        found: true,
        questions: pool.slice(0, 15),
        subjectLabel: subj.label,
        subjectIcon: subj.icon || "📚",
        topic: `${subj.icon || "📚"} ${subj.label}`,
        bankCount: pool.length,
      };
    }
  }
  return { found: false };
}

async function fetchYouTubeVideo(ytQuery) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
  const cacheKey = `sc_yt3_${ytQuery}`;
  try {
    const hit = localStorage.getItem(cacheKey);
    if (hit) return JSON.parse(hit);
  } catch {}
  try {
    const res  = await fetch(`${API_BASE}/youtube/search?q=${encodeURIComponent(ytQuery)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const item = (data.items || [])[0];
    if (item) {
      const result = {
        videoId: item.videoId,
        title:   item.title,
        channel: item.channelTitle,
        url:     `https://www.youtube.com/watch?v=${item.videoId}`,
      };
      try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch {}
      return result;
    }
  } catch {}
  return null;
}

async function generateAIResponse(query, aiConfig, conversationHistory = [], subject = null, images = null) {
  const disciplineId = detectDiscipline(subject?.label);
  const system = buildSystemPrompt({ mode: "chat", disciplineId, subject });
  const convo = buildConversationContext(conversationHistory, 8);
  const prompt =
    `${system}${convo}\n\n` +
    `The student asked: "${query}"\n\n` +
    `Reply ONLY with valid JSON (no markdown, no code fences):\n` +
    `{"definition":"1-2 sentence clear definition","explanation":"3-4 sentence educational explanation with examples","ytQuery":"6-8 word YouTube search query","followUps":["follow-up question 1","follow-up question 2","follow-up question 3"]}\n\n` +
    `The followUps should be natural student questions that go deeper into the topic, progressively from basic to advanced. Max 60 chars each.`;
  const raw = images && images.length > 0
    ? await callAIMultimodal(prompt, images, [], aiConfig)
    : await callAI(prompt, aiConfig);
  try {
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}") + 1;
    const parsed = JSON.parse(raw.slice(s, e));
    if (!parsed.followUps || !Array.isArray(parsed.followUps)) parsed.followUps = [];
    return parsed;
  } catch {
    return { definition: raw.slice(0, 220), explanation: raw, ytQuery: `${query} explained`, followUps: [] };
  }
}

async function generateAIQuestions(topic, aiConfig, subject = null) {
  const disciplineId = detectDiscipline(subject?.label);
  const system = buildSystemPrompt({ mode: "generate_quiz", disciplineId, subject });
  const prompt =
    `${system}\n\n` +
    `Generate a practice quiz about: "${topic}"\n\n` +
    `Output STRICTLY a JSON array. NO prose before or after.\n` +
    `Each item: {"q": "question", "options": ["A","B","C","D"], "answer": 0, "explanation": "why correct"}\n` +
    `- "answer" is the 0-indexed correct option.\n` +
    `- Generate 5-10 well-distributed questions.\n` +
    `- Mix recall, application, and analysis levels.\n` +
    `- Avoid trick questions.`;
  const raw = await callAI(prompt, aiConfig);
  const questions = extractJSON(raw, "array");
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("AI did not return valid questions.");
  }
  return questions.map(q => ({
    q: q.q || q.question || "",
    options: q.options || [],
    answer: q.answer ?? q.correctIndex ?? 0,
    explanation: q.explanation || q.explain || "",
  })).filter(q => q.q && q.options.length >= 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "13px 14px" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: D.accent2, display: "inline-block",
          animation: `scBounce 1.2s ${i * 0.2}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`@keyframes scBounce{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-5px)}}`}</style>
    </div>
  );
}

function CollapseSection({ icon, iconBg, iconBdr, label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `0.5px solid ${D.line2}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 9, padding: "10px 12px",
          textAlign: "left",
        }}
        onMouseEnter={e => e.currentTarget.style.background = D.accent}
        onMouseLeave={e => e.currentTarget.style.background = "none"}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: iconBg, border: `0.5px solid ${iconBdr}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: D.accent2, fontFamily: "Manrope,sans-serif" }}>{label}</span>
        <span style={{
          fontSize: 13, color: D.faint, display: "inline-block",
          transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s",
        }}>›</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px 47px", fontSize: 12, color: D.muted, lineHeight: 1.7, fontFamily: "Manrope,sans-serif" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function VideoLesson({ video }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "0.5px solid #2a1515" }}>
      {/* Thumbnail / embed toggle row */}
      <div
        onClick={() => setExpanded(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
          background: "#100808", cursor: "pointer",
        }}
      >
        <div style={{
          width: 42, height: 30, background: "#1a0808", border: "0.5px solid #3a1010",
          borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0, color: "#ef5350",
        }}>▶</div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#e57373", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {video.title}
          </div>
          <div style={{ fontSize: 10, color: "#5a3030", marginTop: 2 }}>{video.channel}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#5a3030", fontFamily: "Manrope,sans-serif" }}>
            {expanded ? "▲ hide" : "▼ watch"}
          </span>
          <a
            href={video.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 13, color: "#5a3030", textDecoration: "none" }}
            title="Open on YouTube"
          >↗</a>
        </div>
      </div>

      {/* Embedded player */}
      {expanded && (
        <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
          <iframe
            src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
              border: "none",
            }}
            title={video.title}
          />
        </div>
      )}
    </div>
  );
}

function AIMessageBubble({ data, onStartPractice, onFollowUp, onQuickAction }) {
  const [copied, setCopied] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const followUps = data.followUps || [];
  const quickActions = [
    { icon: "🔍", label: "Simpler", action: () => onQuickAction?.("explain_simpler", data.topic) },
    { icon: "📝", label: "Test me", action: () => onQuickAction?.("test_me", data.topic) },
    { icon: "🃏", label: "Flashcards", action: () => onQuickAction?.("flashcards", data.topic) },
    { icon: "📖", label: "Example", action: () => onQuickAction?.("example", data.topic) },
  ];

  function copyAnswer() {
    const text = `${data.definition || ""}\n\n${data.explanation || ""}`.trim();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      alignSelf: "flex-start", width: "100%",
      animation: "scSlideIn 0.3s ease",
    }}>
      <style>{`@keyframes scSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* AI avatar + bubble */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
          background: D.accent, border: `0.5px solid ${D.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, color: D.accent2,
        }}>✦</div>

        <div style={{
          flex: 1, background: D.card,
          border: `0.5px solid ${D.aiBdr}`,
          borderRadius: "4px 16px 16px 16px",
          overflow: "hidden",
        }}>
          {/* Main content — definition + explanation as flowing text */}
          <div style={{ padding: "12px 14px" }}>
            {data.definition && (
              <div style={{
                fontSize: 13, fontWeight: 600, color: D.accent2,
                marginBottom: data.explanation ? 8 : 0,
                fontFamily: "Manrope,sans-serif", lineHeight: 1.5,
              }}>
                <MarkdownText>{data.definition}</MarkdownText>
              </div>
            )}
            {data.explanation && (
              <div style={{
                fontSize: 13, color: D.text, lineHeight: 1.65,
                fontFamily: "Manrope,sans-serif",
              }}>
                <MarkdownText>{data.explanation}</MarkdownText>
              </div>
            )}
          </div>

          {/* Video toggle — inline, compact */}
          {data.video && (
            <div style={{ borderTop: `0.5px solid ${D.line2}` }}>
              <button
                onClick={() => setShowVideo(o => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 14px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 11, color: D.muted,
                  fontFamily: "Manrope,sans-serif",
                }}
              >
                <span style={{ fontSize: 13 }}>▶️</span>
                <span>{showVideo ? "Hide video" : "Watch video lesson"}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: D.faint }}>
                  {showVideo ? "▲" : "▼"}
                </span>
              </button>
              {showVideo && (
                <div style={{ padding: "0 14px 12px" }}>
                  <VideoLesson video={data.video} />
                </div>
              )}
            </div>
          )}

          {/* Practice button — inline */}
          <div style={{
            borderTop: `0.5px solid ${D.line2}`,
            padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <button
              onClick={onStartPractice}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 16,
                background: D.accent, border: `0.5px solid ${D.border}`,
                fontSize: 11, fontWeight: 600, color: D.accent2, cursor: "pointer",
                fontFamily: "Manrope,sans-serif",
              }}
            >
              {data.source === "bank" && data.bankCount
                ? `▶ Practice — ${data.bankCount} questions`
                : "✦ Generate Practice"}
            </button>
            <button
              onClick={copyAnswer}
              title="Copy answer"
              style={{
                marginLeft: "auto", width: 26, height: 26, borderRadius: 7,
                background: "transparent", border: `0.5px solid ${D.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 12, color: copied ? "#4caf50" : D.hint,
                transition: "all 0.15s",
              }}
            >{copied ? "✓" : "⧉"}</button>
          </div>

          {/* Quick action chips */}
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap",
            padding: "8px 14px", borderTop: `0.5px solid ${D.line2}`,
          }}>
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={qa.action}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 14,
                  background: "transparent", border: `0.5px solid ${D.line}`,
                  fontSize: 10, fontWeight: 600, color: D.muted, cursor: "pointer",
                  fontFamily: "Manrope,sans-serif", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.accent2; e.currentTarget.style.background = D.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.color = D.muted; e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 11 }}>{qa.icon}</span>{qa.label}
              </button>
            ))}
          </div>

          {/* Follow-up suggestions */}
          {followUps.length > 0 && (
            <div style={{ padding: "8px 14px 12px", borderTop: `0.5px solid ${D.line2}` }}>
              <div style={{ fontSize: 10, color: D.faint, fontWeight: 600, marginBottom: 7, fontFamily: "Manrope,sans-serif" }}>
                💡 Suggested follow-up questions
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {followUps.map((fu, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowUp?.(fu)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7, width: "100%",
                      padding: "7px 10px", borderRadius: 9,
                      background: "transparent", border: `0.5px solid ${D.line}`,
                      fontSize: 12, color: D.text, cursor: "pointer",
                      fontFamily: "Manrope,sans-serif", textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 10, color: D.faint, flexShrink: 0 }}>{i + 1}.</span>
                    <span>{fu}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: D.faint }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PracticeView({ data, onBack, aiConfig }) {
  const [answered, setAnswered] = useState({});
  const [extraQuestions, setExtraQuestions] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState(null);

  const bankQuestions = (data.questions || []).slice(0, 10);
  const questions = bankQuestions.length > 0 ? bankQuestions : (extraQuestions || []);
  const total = questions.length;
  const done  = Object.keys(answered).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  function pick(qi, oi) {
    if (answered[qi] !== undefined) return;
    setAnswered(p => ({ ...p, [qi]: oi }));
  }

  const topic = data.topic || data.ytQuery || "";

  useEffect(() => {
    if (bankQuestions.length === 0 && !extraQuestions && !genLoading && !genError && aiConfig && topic) {
      setGenLoading(true);
      generateAIQuestions(topic, aiConfig, data.subjectLabel ? { label: data.subjectLabel } : null)
        .then(qs => {
          if (qs && qs.length > 0) {
            setExtraQuestions(qs);
          } else {
            setGenError("No questions could be generated. Try rephrasing your topic.");
          }
        })
        .catch(err => {
          setGenError(err?.message || "Failed to generate questions. Check your AI settings.");
        })
        .finally(() => setGenLoading(false));
    }
  }, [bankQuestions.length, extraQuestions, genLoading, genError, aiConfig, topic, data.subjectLabel]);

  if (!total) {
    if (genLoading) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${D.line}`, borderTopColor: D.border, animation: "scSpin 0.8s linear infinite" }} />
          <style>{`@keyframes scSpin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ color: D.muted, fontSize: 13, textAlign: "center", fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
            Generating practice questions with AI…<br />
            <span style={{ fontSize: 11, color: D.hint }}>This may take a few seconds</span>
          </div>
        </div>
      );
    }
    if (genError) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
          <div style={{ fontSize: 40 }}>📝</div>
          <div style={{ color: D.muted, fontSize: 13, textAlign: "center", fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
            {genError}<br />
            <span style={{ fontSize: 11, color: D.hint }}>No questions in the bank for this topic yet.</span>
          </div>
          <button onClick={() => { setGenError(null); setGenLoading(false); }}
            style={{
              padding: "7px 16px", borderRadius: 20,
              background: D.accent, border: `0.5px solid ${D.border}`,
              color: D.accent2, cursor: "pointer", fontSize: 12, fontFamily: "Manrope,sans-serif",
            }}>↻ Retry generation</button>
          <button onClick={onBack} style={{
            padding: "8px 20px", borderRadius: 20,
            background: "transparent", border: `0.5px solid ${D.line}`,
            color: D.muted, cursor: "pointer", fontSize: 12, fontFamily: "Manrope,sans-serif",
          }}>← Back to chat</button>
        </div>
      );
    }
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
        <div style={{ fontSize: 40 }}>📝</div>
        <div style={{ color: D.muted, fontSize: 13, textAlign: "center", fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
          No questions available.<br />Try a different topic from your study subjects.
        </div>
        <button onClick={onBack} style={{
          padding: "8px 20px", borderRadius: 20,
          background: D.accent, border: `0.5px solid ${D.border}`,
          color: D.accent2, cursor: "pointer", fontSize: 12, fontFamily: "Manrope,sans-serif",
        }}>← Back to chat</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Practice header */}
      <div style={{ padding: "12px 14px", borderBottom: `0.5px solid ${D.line2}`, background: D.bar, flexShrink: 0 }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 2 }}>
          {data.topic}
        </div>
        <div style={{ fontSize: 10, color: D.hint, fontFamily: "Manrope,sans-serif" }}>
          {data.subjectLabel || "AI-generated"} · {total} questions · {done} answered
        </div>
        <div style={{ height: 3, background: "#1a1d35", borderRadius: 2, marginTop: 7, overflow: "hidden" }}>
          <div style={{ height: "100%", background: D.border, borderRadius: 2, width: `${pct}%`, transition: "width 0.35s" }} />
        </div>
      </div>

      {/* Practice body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, scrollbarWidth: "none" }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: D.hint,
            background: "none", border: "none", cursor: "pointer",
            padding: "2px 0 12px", fontFamily: "Manrope,sans-serif",
          }}
        >← Back to AI explanation</button>

        {questions.map((q, qi) => {
          const sel       = answered[qi];
          const isAnswered = sel !== undefined;
          const correctIdx = q.answer ?? q.correctIndex ?? 0;

          return (
            <div key={qi} style={{
              background: D.card, border: `0.5px solid ${D.line}`,
              borderRadius: 12, padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, color: D.faint, fontWeight: 600, marginBottom: 6, fontFamily: "Manrope,sans-serif" }}>
                Q{qi + 1} of {total}
              </div>
              <div style={{ fontSize: 13, color: D.text, lineHeight: 1.55, marginBottom: 12, fontFamily: "Manrope,sans-serif" }}>
                {q.q || q.question}
              </div>

              {(q.options || []).map((opt, oi) => {
                let bg = "transparent", border = `0.5px solid ${D.line}`, color = D.muted;
                if (isAnswered) {
                  if (oi === correctIdx)           { bg = "#0f2a1a"; border = "0.5px solid #2a6a3a"; color = "#a5d6a7"; }
                  else if (oi === sel && oi !== correctIdx) { bg = "#2a0f0f"; border = "0.5px solid #6a2a2a"; color = "#ef9a9a"; }
                  else                             { color = D.hint; }
                }
                return (
                  <button
                    key={oi} onClick={() => pick(qi, oi)} disabled={isAnswered}
                    style={{
                      display: "flex", alignItems: "center", gap: 9, width: "100%",
                      padding: "8px 10px", borderRadius: 8, border, background: bg, color,
                      cursor: isAnswered ? "default" : "pointer", marginBottom: 6,
                      fontSize: 12, fontFamily: "Manrope,sans-serif", textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!isAnswered) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.accent2; e.currentTarget.style.background = D.accent; }}}
                    onMouseLeave={e => { if (!isAnswered) { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.color = D.muted; e.currentTarget.style.background = "transparent"; }}}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: D.accent, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 10, fontWeight: 700, color: D.muted,
                    }}>{String.fromCharCode(65 + oi)}</span>
                    {opt}
                  </button>
                );
              })}

              {isAnswered && (q.explanation || q.explain) && (
                <div style={{
                  background: D.accent, border: `0.5px solid ${D.line}`,
                  borderRadius: 8, padding: "9px 11px", marginTop: 8,
                  fontSize: 11, color: D.muted, lineHeight: 1.55, fontFamily: "Manrope,sans-serif",
                }}>
                  <strong style={{ color: "#a5d6a7" }}>Explanation: </strong>
                  {q.explanation || q.explain}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UploadMenu({ open, onClose, onSelectDoc, onSelectImg }) {
  if (!open) return null;
  const opts = [
    { icon: "📄", label: "PDF / Notes",  action: () => { onSelectDoc(); onClose(); } },
    { icon: "🖼️", label: "Upload Image", action: () => { onSelectImg(); onClose(); } },
    { icon: "📁", label: "Google Drive (soon)", action: onClose },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 46, left: 0,
      background: D.card, border: `0.5px solid ${D.line}`,
      borderRadius: 12, padding: 6, width: 172, zIndex: 20,
      boxShadow: "0 8px 32px #00000066",
    }}>
      {opts.map(o => (
        <button
          key={o.label} onClick={o.action}
          style={{
            display: "flex", alignItems: "center", gap: 9, width: "100%",
            padding: "8px 10px", borderRadius: 8, border: "none",
            background: "none", cursor: "pointer",
            fontSize: 12, color: D.muted, fontFamily: "Manrope,sans-serif",
          }}
          onMouseEnter={e => e.currentTarget.style.background = D.accent}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <span>{o.icon}</span>{o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chat history utils ─────────────────────────────────────────────────────
const HISTORY_KEY = "sc_ai_convos";
const MAX_CONVOS  = 50;

function loadConvos() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveConvos(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_CONVOS))); } catch {}
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ─── History panel ────────────────────────────────────────────────────────────
function HistoryPanel({ open, onClose, conversations, onLoad, onDelete, onNewChat }) {
  return (
    <>
      <style>{`
        @keyframes scSlideLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes scFadeIn{from{opacity:0}to{opacity:1}}
        .sc-hist-item:hover .sc-hist-del{opacity:1!important}
      `}</style>

      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "absolute", inset: 0, zIndex: 9,
            background: "rgba(0,0,0,0.55)",
            animation: "scFadeIn 0.2s ease",
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: "82%", maxWidth: 320, zIndex: 10,
        background: "#080910", borderRight: `0.5px solid #1e2140`,
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
        boxShadow: open ? "4px 0 32px #00000088" : "none",
      }}>
        {/* Panel header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "16px 14px 12px",
          borderBottom: `0.5px solid #1a1d35`,
          background: D.bar, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: D.text }}>Chat History</div>
            <div style={{ fontSize: 10, color: D.hint, marginTop: 2 }}>{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</div>
          </div>
          <button
            onClick={onNewChat}
            style={{
              padding: "5px 11px", borderRadius: 8,
              background: D.accent, border: `0.5px solid ${D.border}`,
              fontSize: 11, fontWeight: 600, color: D.accent2,
              cursor: "pointer", fontFamily: "Manrope,sans-serif",
            }}
          >+ New</button>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: D.accent, border: `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: D.muted, fontSize: 14, flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
              <div style={{ fontSize: 13, color: D.hint, fontFamily: "Manrope,sans-serif", lineHeight: 1.6 }}>
                No conversations yet.<br />Ask a question to get started!
              </div>
            </div>
          ) : (
            conversations.map(c => (
              <div
                key={c.id}
                className="sc-hist-item"
                onClick={() => { onLoad(c); onClose(); }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 14px", cursor: "pointer",
                  borderBottom: `0.5px solid ${D.line2}`,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = D.accent}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: D.accent, border: `0.5px solid ${D.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>💬</div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: D.text,
                    fontFamily: "Manrope,sans-serif",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 3,
                  }}>{c.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: D.hint, fontFamily: "Manrope,sans-serif" }}>{timeAgo(c.ts)}</span>
                    <span style={{ fontSize: 10, color: D.faint }}>·</span>
                    <span style={{ fontSize: 10, color: D.hint, fontFamily: "Manrope,sans-serif" }}>
                      {c.messages.filter(m => m.type === "user").length} message{c.messages.filter(m => m.type === "user").length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  className="sc-hist-del"
                  onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                  style={{
                    opacity: 0, width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: "#2a0f0f", border: "0.5px solid #4a1010",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: 12, color: "#ef9a9a",
                    transition: "opacity 0.15s",
                  }}
                  title="Delete"
                >🗑</button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Voice hook ──────────────────────────────────────────────────────────────
function useVoiceInput(onTranscript) {
  const [listening, setListening]   = useState(false);
  const [supported, setSupported]   = useState(false);
  const recognitionRef              = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSupported(true);
      const r = new SR();
      r.continuous      = false;
      r.interimResults  = true;
      r.lang            = "en-US";
      r.onresult = e => {
        let interim = "", final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          e.results[i].isFinal ? (final += t) : (interim += t);
        }
        onTranscript(final || interim, !!final);
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recognitionRef.current = r;
    }
  // eslint-disable-next-line
  }, []);

  function toggle() {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) { r.stop(); setListening(false); }
    else           { r.start(); setListening(true); }
  }

  return { listening, supported, toggle };
}

// ─── InputBar (shared) ────────────────────────────────────────────────────────
function InputBar({ value, onChange, onSend, loading, placeholder = "Ask a question…", showUpload = true, attachment, onClearAttachment, onSelectDoc, onSelectImg }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const docRef = useRef(null);
  const imgRef = useRef(null);
  const canSend = !loading && (value.trim().length > 0 || !!attachment);

  const voice = useVoiceInput((transcript, isFinal) => {
    onChange({ target: { value: transcript } });
    if (isFinal && transcript.trim()) setTimeout(() => onSend(), 120);
  });

  function triggerDoc() { docRef.current?.click(); }
  function triggerImg() { imgRef.current?.click(); }

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Hidden file inputs */}
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }}
        onChange={e => { onSelectDoc?.(e.target.files[0]); e.target.value = ""; }} />
      <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { onSelectImg?.(e.target.files[0]); e.target.value = ""; }} />

      {/* Attachment preview strip */}
      {attachment && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px 0", background: D.bar,
        }}>
          {attachment.type === "img" ? (
            <img src={attachment.dataUrl} alt="preview" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: `0.5px solid ${D.line}` }} />
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              background: D.bar, border: `0.5px solid ${D.line}`,
              borderRadius: 8, padding: "6px 10px",
            }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <span style={{ fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {attachment.name}
              </span>
            </div>
          )}
          <button onClick={onClearAttachment} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: D.hint, cursor: "pointer", fontSize: 16, padding: "2px 6px",
          }}>✕</button>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px 18px", background: D.bar,
        borderTop: attachment ? "none" : `0.5px solid ${D.line2}`,
        position: "relative",
        ...(attachment ? {} : {}),
      }}>
        {/* Top border only when no attachment */}
        {!attachment && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5px", background: D.line2 }} />}

        {showUpload && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setUploadOpen(o => !o)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: D.bar, border: `0.5px solid ${D.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: D.muted, fontSize: 20, flexShrink: 0,
              }}
            >+</button>
            <UploadMenu
              open={uploadOpen}
              onClose={() => setUploadOpen(false)}
              onSelectDoc={triggerDoc}
              onSelectImg={triggerImg}
            />
          </div>
        )}
        <input
          value={value} onChange={onChange}
          onKeyDown={e => e.key === "Enter" && canSend && onSend()}
          placeholder={voice.listening ? "🎤 Listening…" : placeholder}
          style={{
            flex: 1, background: D.bar,
            border: voice.listening ? "0.5px solid #ef4444" : `0.5px solid ${D.line}`,
            borderRadius: 20, padding: "9px 14px", fontSize: 12,
            color: voice.listening ? "#fca5a5" : D.accent2,
            fontFamily: "Manrope,sans-serif",
            outline: "none", transition: "border-color 0.2s, color 0.2s",
          }}
          onFocus={e => { if (!voice.listening) e.target.style.borderColor = D.border; }}
          onBlur={e  => { if (!voice.listening) e.target.style.borderColor = D.line;   }}
        />
        {/* Mic button — only shown if browser supports SpeechRecognition */}
        {voice.supported && (
          <>
            <style>{`
              @keyframes scPulse{0%,100%{box-shadow:0 0 0 0 #ef444466}50%{box-shadow:0 0 0 6px #ef444400}}
              .sc-mic-active{animation:scPulse 1s infinite;background:#2a0a0a!important;border-color:#ef4444!important;color:#ef4444!important}
            `}</style>
            <button
              onClick={voice.toggle}
              title={voice.listening ? "Stop listening" : "Voice input"}
              className={voice.listening ? "sc-mic-active" : ""}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: D.bar, border: `0.5px solid ${D.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 15, flexShrink: 0,
                color: D.muted, transition: "all 0.2s",
              }}
            >{voice.listening ? "⏹" : "🎤"}</button>
          </>
        )}

        <button
          onClick={onSend} disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: canSend ? D.accent : "#0d0f1f",
            border: `0.5px solid ${canSend ? D.border : "#1a1d35"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: canSend ? "pointer" : "default",
            color: canSend ? D.accent2 : D.faint,
            fontSize: 16, flexShrink: 0, transition: "all 0.15s",
          }}
        >→</button>
      </div>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
export default function AISectionOverlay({ aiConfig, subjects, onExit, defaultView = "chat", studyTopic = "", studyMode = "input", studyAttachment = null }) {
  const [view, setView]             = useState(defaultView || "chat");
  const [messages, setMsgs]         = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConvos]  = useState(() => loadConvos());
  const [currentId, setCurrentId]   = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const bottomRef                   = useRef(null);

  async function handleDocSelect(file) {
    if (!file) return;
    setAttachment({ type: "doc", name: file.name, content: "Extracting text…", dataUrl: null, loading: true });
    try {
      const result = await extractTextFromFile(file);
      const text = (result.text || "").slice(0, 4000);
      const images = result.images || [];
      setAttachment({
        type: images.length > 0 && !text ? "img" : "doc",
        name: file.name,
        content: text || (images.length > 0 ? "(scanned document — sending as images)" : ""),
        dataUrl: images[0] || null,
        images: images,
        loading: false,
      });
    } catch (err) {
      setAttachment({
        type: "doc", name: file.name,
        content: `Failed to extract text: ${err.message}`,
        dataUrl: null, loading: false,
      });
    }
  }

  function handleImgSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setAttachment({ type: "img", name: file.name, content: null, dataUrl: ev.target.result });
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, view]);

  const fakeTutor = useMemo(() => ({
    generate: async ({ input }) => {
      const text = await callAI(input, aiConfig);
      return { text };
    },
  }), [aiConfig]);

  function handleBack() {
    if (showHistory) { setShowHistory(false); return; }
    if (view === "learn")    { setView("chat"); return; }
    if (view === "study")    { setView("chat"); return; }
    if (view === "practice") { setView("chat"); return; }
    onExit?.();
  }

  function startNewChat() {
    setMsgs([]);
    setData(null);
    setView("chat");
    setCurrentId(null);
    setShowHistory(false);
  }

  function loadConvo(c) {
    setMsgs(c.messages);
    setData(c.lastData || null);
    setView("chat");
    setCurrentId(c.id);
  }

  function deleteConvo(id) {
    const updated = conversations.filter(c => c.id !== id);
    setConvos(updated);
    saveConvos(updated);
    if (currentId === id) startNewChat();
  }

  function persistConvo(msgs, lastData, q) {
    const id = currentId || genId();
    const title = q.length > 60 ? q.slice(0, 60) + "…" : q;
    const entry = { id, title, ts: Date.now(), messages: msgs, lastData };
    const updated = [entry, ...conversations.filter(c => c.id !== id)];
    setConvos(updated);
    saveConvos(updated);
    setCurrentId(id);
  }

  async function ask(rawQ) {
    const hasAttachment = !!attachment;
    const q = rawQ?.trim() || (hasAttachment ? `Analyze this ${attachment.type === "img" ? "image" : "document"}: ${attachment.name}` : "");
    if (!q || loading) return;
    setInput("");
    setView("chat");
    setLoading(true);

    // Build user message with optional attachment
    const userMsg = { type: "user", text: q, attachment: attachment ? { ...attachment } : null };
    setMsgs(p => [...p, userMsg, { type: "loading" }]);
    const capturedAttachment = attachment;
    setAttachment(null);

    // Collect images for multimodal AI call
    let images = null;
    if (capturedAttachment?.type === "img" && capturedAttachment.dataUrl) {
      images = [capturedAttachment.dataUrl];
    } else if (capturedAttachment?.images && capturedAttachment.images.length > 0) {
      images = capturedAttachment.images;
    }

    // Build augmented query for AI
    let aiQuery = q;
    if (capturedAttachment?.type === "doc" && capturedAttachment.content) {
      aiQuery = `The student uploaded a document named "${capturedAttachment.name}". Document content:\n\n${capturedAttachment.content}\n\nBased on this content, answer: ${q}`;
    } else if (images) {
      aiQuery = `The student uploaded an image named "${capturedAttachment.name}". Please analyze the image and answer: ${q}`;
    }

    try {
      const bankRes = searchQuestionBank(q, subjects);
      let aiRes = { definition: "", explanation: "", ytQuery: `${q} explained`, followUps: [] };
      try { aiRes = await generateAIResponse(aiQuery, aiConfig, messages, selectedSubject, images); } catch {}
      const ytQuery = aiRes.ytQuery || `${q} explained`;
      const video   = await fetchYouTubeVideo(ytQuery);

      const result = bankRes.found
        ? { source: "bank", ...bankRes, ...aiRes, ytQuery, video }
        : { source: "ai", ...aiRes, ytQuery, video, questions: [], bankCount: 0, subjectLabel: selectedSubject?.label || null, topic: q };

      const finalMsgs = [...messages, userMsg].filter(m => m.type !== "loading").concat({ type: "ai", data: result });
      setData(result);
      setMsgs(finalMsgs);
      setView("chat");
      persistConvo(finalMsgs, result, q);
    } catch (e) {
      setMsgs(p => p.filter(m => m.type !== "loading").concat({
        type: "ai",
        data: { source: "ai", definition: "Something went wrong — check your AI settings.", explanation: String(e?.message || ""), ytQuery: q, video: null, questions: [], bankCount: 0, subjectLabel: selectedSubject?.label || null, topic: q },
      }));
    } finally {
      setLoading(false);
    }
  }

  const topTitle = { chat: "AI Tutor", practice: "Practice Mode", learn: "Video Lessons", study: "Guided Study" }[view] || "AI Tutor";
  const topSub   = {
    chat:     selectedSubject ? `${selectedSubject.label || selectedSubject.id} · Ask anything` : "Scholar's Circle · Ask anything",
    practice: data ? `${data.subjectLabel || "AI"} · ${data.bankCount || 0} questions` : "",
    learn:    "Watch a video · Ask AI questions as you go",
    study:    "Roadmap → Explain → Questions → Flashcards",
  }[view] || "";

  return (
    <>
      <style>{FONTS + `
        .sc-ol *{box-sizing:border-box}
        .sc-ol input::placeholder{color:#333760}
      `}</style>

      <div className="sc-ol" style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg, display: "flex", flexDirection: "column",
        fontFamily: "Manrope,sans-serif",
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px 11px",
          borderBottom: `0.5px solid ${D.line}`,
          background: D.bar, flexShrink: 0,
        }}>
          <button
            onClick={handleBack}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: D.accent, border: `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: D.muted, fontSize: 17, flexShrink: 0,
            }}
          >←</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 700, color: D.text, lineHeight: 1.1 }}>
              {topTitle}
            </div>
            <div style={{ fontSize: 11, color: D.hint, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {topSub}
            </div>
          </div>

          {/* Subject selector — only in chat view */}
          {view === "chat" && subjects?.length > 0 && (
            <select
              value={selectedSubject?.id || ""}
              onChange={e => {
                const subj = subjects.find(s => s.id === e.target.value);
                setSelectedSubject(subj || null);
              }}
              style={{
                background: D.accent, border: `0.5px solid ${D.line}`,
                borderRadius: 8, padding: "5px 8px", fontSize: 11,
                color: selectedSubject ? D.accent2 : D.muted,
                fontFamily: "Manrope,sans-serif", outline: "none",
                cursor: "pointer", flexShrink: 0, maxWidth: 120,
              }}
            >
              <option value="">All subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.label || s.id}</option>
              ))}
            </select>
          )}

          {/* 📚 Guided Study button */}
          <button
            onClick={() => setView(view === "study" ? "chat" : "study")}
            title="Guided Study"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: view === "study" ? D.accent : "transparent",
              border: view === "study" ? `0.5px solid ${D.border}` : `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              fontSize: 14, transition: "all 0.2s",
            }}
          >📚</button>

          {/* ⋯ History button */}
          <button
            onClick={() => setShowHistory(o => !o)}
            title="Chat history"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: showHistory ? D.accent : "transparent",
              border: showHistory ? `0.5px solid ${D.border}` : `0.5px solid ${D.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              fontSize: 14, color: showHistory ? D.accent2 : D.muted,
              letterSpacing: 1, transition: "all 0.2s",
            }}
          >⋯</button>

          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 7px #22c55e99", flexShrink: 0 }} />
        </div>

        {/* ── History panel ── */}
        <HistoryPanel
          open={showHistory}
          onClose={() => setShowHistory(false)}
          conversations={conversations}
          onLoad={loadConvo}
          onDelete={deleteConvo}
          onNewChat={startNewChat}
        />

        {/* ══ VIEW: CHAT (unified — includes AI responses inline) ══ */}
        {view === "chat" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 14, scrollbarWidth: "none" }}>

              {messages.length === 0 ? (
                <>
                  <div style={{ textAlign: "center", padding: "28px 8px 12px" }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 18,
                      background: D.accent, border: `1px solid ${D.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 14px", fontSize: 26,
                    }}>🎓</div>
                    <div style={{ fontFamily: "Syne,sans-serif", fontSize: 17, fontWeight: 700, color: D.text, marginBottom: 6 }}>
                      What do you want to learn?
                    </div>
                    <div style={{ fontSize: 12, color: D.hint, lineHeight: 1.65 }}>
                      Ask any question — get a clear answer,<br />follow-up suggestions, and a video lesson.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", padding: "4px 0" }}>
                    {CHIPS.map(c => (
                      <button
                        key={c} onClick={() => ask(c)}
                        style={{
                          padding: "7px 13px", borderRadius: 20,
                          background: D.accent, border: `0.5px solid ${D.line}`,
                          fontSize: 11, color: D.muted, cursor: "pointer",
                          fontFamily: "Manrope,sans-serif", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.accent2; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = D.line; e.currentTarget.style.color = D.muted; }}
                      >{c}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Context indicator */}
                  {messages.filter(m => m.type === "user").length >= 2 && (
                    <div style={{
                      alignSelf: "center", fontSize: 10, color: D.faint,
                      padding: "3px 11px", borderRadius: 12,
                      background: D.bar, border: `0.5px solid ${D.line2}`,
                      fontFamily: "Manrope,sans-serif",
                    }}>🧠 AI remembers this conversation</div>
                  )}

                  {messages.map((m, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {m.type === "user" && (
                        <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, maxWidth: "82%" }}>
                          {m.attachment?.type === "img" && (
                            <img src={m.attachment.dataUrl} alt={m.attachment.name}
                              style={{ width: 160, borderRadius: 10, border: `0.5px solid ${D.line}`, objectFit: "cover" }} />
                          )}
                          {m.attachment?.type === "doc" && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 7,
                              background: D.bar, border: `0.5px solid ${D.line}`,
                              borderRadius: 10, padding: "7px 12px",
                            }}>
                              <span style={{ fontSize: 18 }}>📄</span>
                              <span style={{ fontSize: 11, color: D.muted, fontFamily: "Manrope,sans-serif", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.attachment.name}</span>
                            </div>
                          )}
                          <div style={{
                            background: D.userBg, border: `0.5px solid ${D.userBdr}`,
                            borderRadius: "16px 16px 4px 16px",
                            padding: "10px 14px", fontSize: 13, color: D.userTxt,
                            fontFamily: "Manrope,sans-serif",
                            animation: "scSlideIn 0.25s ease",
                          }}><MarkdownText>{m.text}</MarkdownText></div>
                        </div>
                      )}
                      {m.type === "loading" && (
                        <div style={{
                          alignSelf: "flex-start",
                          background: D.card, border: `0.5px solid ${D.aiBdr}`,
                          borderRadius: "4px 16px 16px 16px", width: 80,
                        }}>
                          <TypingDots />
                        </div>
                      )}
                      {m.type === "ai" && m.data && (
                        <AIMessageBubble
                          data={m.data}
                          onStartPractice={() => { setData(m.data); setView("practice"); }}
                          onFollowUp={(q) => ask(q)}
                          onQuickAction={(action, topic) => {
                            const prompts = {
                              explain_simpler: `Explain ${topic} in simpler terms, as if for a beginner`,
                              test_me: `Generate 3 multiple-choice questions about ${topic} to test my understanding`,
                              flashcards: `Generate 5 flashcards about ${topic}`,
                              example: `Give me a concrete real-world example of ${topic}`,
                            };
                            ask(prompts[action] || topic);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </>
              )}
              <div ref={bottomRef} />
            </div>

            <InputBar
              value={input}
              onChange={e => setInput(e.target.value)}
              onSend={() => ask(input)}
              loading={loading}
              showUpload
              attachment={attachment}
              onClearAttachment={() => setAttachment(null)}
              onSelectDoc={handleDocSelect}
              onSelectImg={handleImgSelect}
            />
          </>
        )}

        {/* ══ VIEW: PRACTICE ══ */}
        {view === "practice" && data && (
          <PracticeView data={data} onBack={() => setView("chat")} aiConfig={aiConfig} />
        )}

        {/* ══ VIEW: LEARN (Video Lessons) ══ */}
        {view === "learn" && (
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
            <LearningRoom tutor={fakeTutor} aiConfig={aiConfig} />
          </div>
        )}

        {/* ══ VIEW: STUDY (Guided Study) ══ */}
        {view === "study" && (
          <GuidedStudy
            aiConfig={aiConfig}
            initialTopic={studyTopic}
            startMode={studyMode}
            initialAttachment={studyAttachment}
          />
        )}

      </div>
    </>
  );
}
