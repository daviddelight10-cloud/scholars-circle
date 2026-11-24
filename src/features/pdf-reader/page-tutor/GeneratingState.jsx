// Animated generation state — replaces the static "writing your lesson"
// screen. Staged labels + an asymptotic progress bar (never claims 100%)
// + shimmer skeletons, so a 5-15s wait feels alive instead of frozen.
import { useEffect, useState } from "react";

const STAGES = [
  "Reading the page…",
  "Writing your lesson…",
  "Checking facts against the page…",
  "Preparing narration…",
];
const STAGE_MS = 2200;

export default function GeneratingState({ T, page }) {
  const [stage, setStage] = useState(0);
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const s = setInterval(() => setStage((i) => Math.min(i + 1, STAGES.length - 1)), STAGE_MS);
    // Ease toward 92% — progress always moving, never lying about finishing.
    const p = setInterval(() => setPct((v) => v + (92 - v) * 0.06), 120);
    return () => { clearInterval(s); clearInterval(p); };
  }, []);

  return (
    <div style={{ padding: "26px 16px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        @keyframes ptPulse { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.12); opacity: 1; } }
        @keyframes ptSpin { to { transform: rotate(360deg); } }
        @keyframes ptFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes ptShimmer { from { background-position: -200px 0; } to { background-position: 200px 0; } }
        .pt-shimmer { background: linear-gradient(90deg, ${T.border}33 25%, ${T.border}77 50%, ${T.border}33 75%); background-size: 400px 100%; animation: ptShimmer 1.4s linear infinite; border-radius: 6px; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", width: 54, height: 54 }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "2px solid transparent", borderTopColor: "#F5A623", borderRightColor: "#F5A623",
            animation: "ptSpin 1.1s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 9, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #F5A623, #b87413)",
            animation: "ptPulse 1.6s ease-in-out infinite",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#1B212D",
          }}>✦</div>
        </div>
        <div key={stage} style={{ fontSize: 13.5, fontWeight: 700, color: T.text, animation: "ptFade .45s ease" }}>
          {STAGES[stage]}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: -8 }}>
          Page {page} · usually a few seconds — audio follows in the background
        </div>
        <div style={{ width: "100%", maxWidth: 260, height: 5, borderRadius: 4, background: `${T.border}55`, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 4,
            background: "linear-gradient(90deg, #F5A623, #ffd479)",
            transition: "width .25s ease",
          }} />
        </div>
      </div>

      {/* Skeleton section cards — hints at what's coming */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.85 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", background: T.inputBg }}>
            <div className="pt-shimmer" style={{ height: 11, width: `${55 - i * 12}%`, marginBottom: 9 }} />
            <div className="pt-shimmer" style={{ height: 8, width: "92%", marginBottom: 5 }} />
            <div className="pt-shimmer" style={{ height: 8, width: `${70 + i * 8}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
