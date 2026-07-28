import { useState, useEffect } from "react";
import { getPeerComparison } from "../../lib/mastery.js";

export default function PeerComparison({ subjectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId) return;
    getPeerComparison(subjectId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [subjectId]);

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "#4a5080", fontSize: "13px", textAlign: "center" }}>
        Loading peer data…
      </div>
    );
  }

  if (!data || data.totalStudents < 2) {
    return (
      <div style={{
        padding: "14px 16px", borderRadius: "12px", background: "#0a0b18",
        border: "0.5px solid #1e2245", color: "#4a5080", fontSize: "13px", textAlign: "center",
      }}>
        Not enough peers yet to compare. Keep practising!
      </div>
    );
  }

  const bars = [
    { label: "You", pct: data.yourPct, color: "#B8860B", bg: "#0f1535" },
    { label: "Class avg", pct: data.classAvg, color: "#7b82b8", bg: "#0a0b18" },
    { label: "Top", pct: data.topPct, color: "#10b981", bg: "#0f2a1a" },
  ];

  const rankBadge = data.rank <= 3
    ? { bg: "#1a1000", color: "#ffb74d", border: "#3a2800", label: `#${data.rank} 🏆` }
    : { bg: "#0f1535", color: "#7986cb", border: "#1e2245", label: `#${data.rank}` };

  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ color: "#7b82b8", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Peer Comparison
        </div>
        <div style={{
          padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
          background: rankBadge.bg, color: rankBadge.color, border: `0.5px solid ${rankBadge.border}`,
        }}>
          {rankBadge.label} of {data.totalStudents}
        </div>
      </div>

      {bars.map(({ label, pct, color, bg }) => (
        <div key={label} style={{ marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "#c5c9e8", fontSize: "13px" }}>{label}</span>
            <span style={{ color, fontWeight: 700, fontSize: "13px" }}>{pct}%</span>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", background: "#1e2245", overflow: "hidden" }}>
            <div style={{
              width: `${pct}%`, height: "100%", borderRadius: "3px",
              background: color, transition: "width 0.6s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
