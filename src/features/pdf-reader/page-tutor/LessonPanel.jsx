// Page Tutor lesson view — collapsible sections with per-section audio,
// hard-term chips, "extra context" labels, unreadable-content notices,
// key points, clinical note, recall, flashcards, report, voice handoff.
import { useState, useRef, useEffect } from "react";
import AudioPlayer from "./AudioPlayer.jsx";
import RecallStep from "./RecallStep.jsx";
import GeneratingState from "./GeneratingState.jsx";
import MindMap from "./MindMap.jsx";
import { playableSections } from "./lessonUtils.js";

const chip = (T, active) => ({
  padding: "3px 9px", borderRadius: 999, border: `1px solid ${active ? "#4F8EF7" : T.border}`,
  background: active ? "rgba(79,142,247,0.12)" : "transparent",
  color: active ? "#4F8EF7" : T.muted, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
});

function Section({ T, item, expanded, onToggle, onPlay, playing, active, onSeeOnPage }) {
  const s = item.section;
  const [showFull, setShowFull] = useState(false);
  // Audiobook-style transcript: while the section is the live audio target,
  // the box shows `narration` — the verbatim spoken script — so what you read
  // is exactly what you hear. "full text" flips to the richer explanation.
  const liveText = active && s.narration && !showFull;
  return (
    <div
      data-ptsec={item.index}
      style={{
        border: `1px solid ${playing ? "rgba(79,142,247,0.55)" : T.border}`,
        borderRadius: 12, overflow: "hidden", background: T.inputBg,
        boxShadow: playing ? "0 0 0 3px rgba(79,142,247,0.12)" : "none",
        transition: "border-color .25s ease, box-shadow .25s ease",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
          background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0, fontSize: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: item.playable ? "rgba(79,142,247,0.15)" : T.chipBg,
          color: item.playable ? "#4F8EF7" : T.muted, border: "none",
        }}
          role="button"
          onClick={(e) => { e.stopPropagation(); if (item.playable) onPlay(); }}
          title={item.mode === "speech" ? "Play with your device's voice" : item.playable ? "Play this section" : "Audio not ready"}
        >
          {playing ? "❚❚" : "▶"}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text }}>{s.heading}</span>
        {s.source === "added_context" && (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#F5A623", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            extra context
          </span>
        )}
        <span style={{ fontSize: 11, color: T.muted }}>{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div style={{ padding: "0 12px 12px" }}>
          {s.unclear && (
            <div style={{
              fontSize: 11, color: "#facc15", background: "rgba(250,204,21,0.08)",
              border: "1px solid rgba(250,204,21,0.25)", borderRadius: 8, padding: "6px 9px", marginBottom: 8,
            }}>
              Part of this page could not be read clearly — check the original.
            </div>
          )}
          {liveText ? (
            <div style={{
              borderLeft: "3px solid rgba(79,142,247,0.6)", borderRadius: "0 10px 10px 0",
              background: "rgba(79,142,247,0.06)", padding: "9px 11px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
                  color: "#4F8EF7", display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 10 }}>
                    {[0, 1, 2].map((b) => (
                      <span key={b} style={{
                        width: 2.5, height: "100%", borderRadius: 2, background: "#4F8EF7",
                        transformOrigin: "bottom",
                        animation: playing ? `sc-pt-eq .9s ease-in-out ${b * 0.15}s infinite` : "none",
                        transform: playing ? undefined : "scaleY(.35)",
                      }} />
                    ))}
                  </span>
                  Transcript
                </span>
                {s.explanation !== s.narration && (
                  <button onClick={() => setShowFull(true)} style={chip(T, false)} title="Show the written explanation instead">
                    📄 full text
                  </button>
                )}
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{s.narration}</div>
            </div>
          ) : (
            <>
              {active && s.narration && s.explanation !== s.narration && (
                <div style={{ marginBottom: 6 }}>
                  <button onClick={() => setShowFull(false)} style={chip(T, true)} title="Back to the spoken transcript">
                    🔊 transcript
                  </button>
                </div>
              )}
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{s.explanation}</div>
            </>
          )}
          {s.terms?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {s.terms.map((t) => <TermChip key={t.term} T={T} term={t} />)}
            </div>
          )}
          {s.anchor_quote && (
            <button
              onClick={() => onSeeOnPage(s.anchor_quote)}
              style={{ marginTop: 10, padding: 0, border: "none", background: "none", color: "#4F8EF7", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              See on page ↗
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TermChip({ T, term }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen((v) => !v)} style={chip(T, open)} title={term.meaning}>
      {open ? `${term.term} — ${term.meaning}` : term.term}
    </button>
  );
}

export default function LessonPanel({ T, page, tutor, onAskVoice, onSeeOnPage, onToast, follow, onToggleFollow, view: viewProp, onViewChange }) {
  const [openSections, setOpenSections] = useState({ 0: true });
  const [internalView, setInternalView] = useState("list"); // list | map — header 🧠 can drive it via props
  const view = viewProp ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportNote, setReportNote] = useState("");

  const { status, error, lesson, audioSections, player, regenerating } = tutor;
  const list = playableSections(lesson?.lesson, audioSections, { speech: tutor.speechSupported ? "always" : false });
  const playingItem = list[player.idx];
  const scrollRef = useRef(null);

  // Follow-along: scroll the panel so the playing section stays in view.
  // (Collapsed playing sections are force-expanded at render below — no state
  // write needed, so the user's collapse choice returns when playback moves on.)
  useEffect(() => {
    if (player.idx < 0) return;
    scrollRef.current?.querySelector(`[data-ptsec="${player.idx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [player.idx]);

  if (status === "loading") return <GeneratingState T={T} page={page} />;
  if (status === "error" || status === "premium") {
    return (
      <div style={{ padding: "30px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: status === "premium" ? "#F5A623" : T.accent, lineHeight: 1.5 }}>
          {error || (status === "premium" ? "Explaining new pages is a Premium feature." : "Something went wrong.")}
        </div>
        <button
          onClick={() => tutor.explain(page)}
          style={{ marginTop: 12, padding: "8px 18px", borderRadius: 9, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >Try again</button>
      </div>
    );
  }
  if (!lesson) {
    return (
      <div style={{ padding: "30px 16px", textAlign: "center", color: T.muted, fontSize: 12.5, lineHeight: 1.6 }}>
        Get a simple walkthrough of page {page} — with audio and recall questions.
        <button
          onClick={() => tutor.explain(page)}
          style={{
            display: "block", margin: "14px auto 0", padding: "11px 22px", borderRadius: 10,
            border: "none", background: "#F5A623", color: "#1B212D", fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >✨ Explain page {page}</button>
      </div>
    );
  }

  const les = lesson.lesson;
  const sendReport = () => {
    tutor.report("errors", reportNote.trim());
    setReportSent(true);
    onToast?.("Report sent — thanks");
  };

  const jumpToSection = (i) => {
    setView("list");
    setOpenSections((m) => ({ ...m, [i]: true }));
    setTimeout(() => {
      scrollRef.current?.querySelector(`[data-ptsec="${i}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {view === "map" ? (
        <MindMap
          T={T}
          lesson={lesson}
          playingIdx={player.idx}
          onJumpSection={jumpToSection}
          onSeeOnPage={onSeeOnPage}
        />
      ) : (
      <div ref={scrollRef} style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "4px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, lineHeight: 1.35, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {les.page_title}
            {lesson.generationSource && lesson.generationSource !== "gemini" && (
              <span style={{
                fontSize: 9.5, fontWeight: 800, color: "#4F8EF7", textTransform: "uppercase",
                letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 999,
                border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.1)",
              }}>
                Quick mode
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
            Page {page} · {lesson.cached ? "from the shared cache" : "generated for you"}
            {lesson.audioStatus === "pending" || lesson.audioStatus === "partial" ? " · audio loading…" : ""}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
            {[["list", "📋 List"], ["map", "🧠 Mind map"]].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={chip(T, view === v)}>{label}</button>
            ))}
          </div>
          {lesson.generationSource && lesson.generationSource !== "gemini" && (
            <div style={{ fontSize: 11, color: T.muted, marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
              Made with the backup engine — the primary was busy.
              <button
                onClick={() => tutor.regenerate(page)}
                disabled={regenerating}
                style={{ padding: "3px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: "#4F8EF7", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: regenerating ? 0.6 : 1 }}
              >{regenerating ? "Upgrading…" : "Upgrade quality"}</button>
            </div>
          )}
        </div>

        {error ? <div style={{ fontSize: 12, color: T.accent }}>{error}</div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((item, i) => (
            <Section
              key={item.sectionId}
              T={T}
              item={{ ...item, section: les.sections[i] }}
              expanded={openSections[i] !== false || (player.idx === i && player.playing)}
              onToggle={() => setOpenSections((m) => ({ ...m, [i]: m[i] === false }))}
              onPlay={() => tutor.playSection(i)}
              playing={player.idx === i && player.playing}
              active={player.idx === i}
              onSeeOnPage={onSeeOnPage}
            />
          ))}
        </div>

        {lesson.audioStatus === "failed" && (
          <div style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {tutor.speechSupported
              ? "Hosted audio unavailable — sections play with your device's voice."
              : "Audio couldn't be generated — the written lesson still works."}
            <button onClick={tutor.retry} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: "#4F8EF7", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
          </div>
        )}

        {les.key_points?.length > 0 && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", background: T.hover }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, marginBottom: 6 }}>Key points</div>
            {les.key_points.map((k, i) => (
              <div key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: T.accent }}>•</span>{k}
              </div>
            ))}
          </div>
        )}

        {les.clinical_note && (
          <div style={{ border: "1px solid rgba(61,214,140,0.3)", borderRadius: 12, padding: "12px 14px", background: "rgba(61,214,140,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#3DD68C", marginBottom: 4 }}>Clinical note</div>
            <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55 }}>{les.clinical_note}</div>
          </div>
        )}

        <RecallStep T={T} recall={les.recall} onGraded={tutor.logRecall} />

        <button
          onClick={onAskVoice}
          style={{
            padding: "12px 14px", borderRadius: 10, border: "none",
            background: "#4F8EF7", color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          🎙️ Ask a question about this page
        </button>

        <div style={{ textAlign: "center", paddingBottom: 4 }}>
          {!reportOpen ? (
            <button onClick={() => setReportOpen(true)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
              Report an error
            </button>
          ) : reportSent ? (
            <span style={{ fontSize: 11.5, color: "#3DD68C" }}>Report sent — thanks.</span>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="What's wrong?"
                style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12, fontFamily: "inherit" }}
              />
              <button onClick={sendReport} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
            </div>
          )}
        </div>
      </div>
      )}

      {(list.some((i) => i.playable) || player.idx >= 0) && (
        <AudioPlayer
          T={T}
          player={player}
          sectionHeading={playingItem?.heading || les.page_title}
          onToggle={tutor.toggle}
          onSeekBy={tutor.seekBy}
          onCycleSpeed={tutor.cycleSpeed}
          onSeekTo={tutor.seekTo}
          follow={follow}
          onToggleFollow={onToggleFollow}
        />
      )}
    </div>
  );
}
