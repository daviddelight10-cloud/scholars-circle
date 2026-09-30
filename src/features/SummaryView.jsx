import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/constants";
import MarkdownText from "../components/MarkdownText";

const D = {
  bg: "#0a0a0a",
  bar: "#121212",
  accent: "#1e1e22",
  line: "rgba(255,255,255,0.09)",
  text: "#EDEFF5",
  muted: "#9AA3B5",
  faint: "#3A4356",
  gold: "#FFD700",
};

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

/**
 * Full-screen, ChatGPT-style reading surface for AI-generated summaries.
 * Markdown renders directly on the page background in a centered column —
 * no card, no chrome. Extras: section rail (desktop), reading progress,
 * blur-to-recall mode, and a Practice shortcut into the parent's MCQs.
 */
export default function SummaryView({ resource, onBack, onOpenResource }) {
  const [recall, setRecall] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeSec, setActiveSec] = useState(0);
  const bodyRef = useRef(null);

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

  // Reading progress + active section. Capture-phase scroll listener catches
  // whichever ancestor element actually scrolls (page or fixed wrapper).
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
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);

  const jump = (i) => {
    document.getElementById(`md-sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pill = (active) => ({
    display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
    fontSize: 11, fontWeight: 700, cursor: "pointer",
    color: active ? "#0a0a0a" : D.gold,
    background: active ? D.gold : "rgba(255,215,0,0.08)",
    border: `0.5px solid ${active ? D.gold : "rgba(255,215,0,0.25)"}`,
    borderRadius: 999, padding: "6px 12px", textDecoration: "none",
  });

  return (
    <div style={{ minHeight: "100%", display: "flex", background: D.bg, fontFamily: "Manrope,sans-serif" }}>
      <style>{`
        .sum-rail { display: none; }
        @media (min-width: 960px) { .sum-rail { display: block; } }
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
            <div style={{ fontSize: 11, color: "#646E84", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {resource?.subject ? `${resource.subject} · ` : ""}AI-generated summary
            </div>
          </div>

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
        <div ref={bodyRef} style={{ flex: 1, padding: "26px 18px 60px" }}>
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
    </div>
  );
}
