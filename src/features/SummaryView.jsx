import { API_BASE } from "../lib/constants";
import MarkdownText from "../components/MarkdownText";

const D = {
  bg: "#0a0a0a",
  bar: "#121212",
  accent: "#1e1e22",
  line: "rgba(255,255,255,0.09)",
  text: "#EDEFF5",
  muted: "#9AA3B5",
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
 * no card, no chrome. The generated PDF stays available as a download.
 */
export default function SummaryView({ resource, onBack }) {
  return (
    <div style={{
      minHeight: "100%", display: "flex", flexDirection: "column",
      background: D.bg, fontFamily: "Manrope,sans-serif",
    }}>
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

        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          color: D.gold, background: "rgba(255,215,0,0.1)",
          border: "0.5px solid rgba(255,215,0,0.3)", borderRadius: 6,
          padding: "4px 8px", flexShrink: 0,
        }}>
          ✨ AI SUMMARY
        </span>

        {resource?.fileUrl && (
          <a
            href={pdfDownloadUrl(resource.fileUrl)}
            target="_blank"
            rel="noopener noreferrer"
            title="Download PDF"
            style={{
              display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              fontSize: 11, fontWeight: 700, color: D.gold, textDecoration: "none",
              background: "rgba(255,215,0,0.08)", border: "0.5px solid rgba(255,215,0,0.25)",
              borderRadius: 999, padding: "6px 12px",
            }}
          >
            ⬇ PDF
          </a>
        )}
      </div>

      {/* Body — markdown on the page background, centered column */}
      <div style={{ flex: 1, padding: "26px 18px 60px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", width: "100%" }}>
          <MarkdownText theme="gold">{resource?.description || ""}</MarkdownText>
          <div style={{
            marginTop: 40, paddingTop: 16, borderTop: `0.5px solid ${D.line}`,
            fontSize: 11, color: "#4A5266", textAlign: "center",
          }}>
            Generated from {resource?.title || "your material"} · Scholars Circle
          </div>
        </div>
      </div>
    </div>
  );
}
