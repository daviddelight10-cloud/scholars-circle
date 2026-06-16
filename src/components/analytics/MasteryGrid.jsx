import { useState, useEffect } from "react";
import { getMasteryGrid } from "../../lib/mastery.js";

const STATUS_COLORS = {
  correct: { bg: "#0f2a1a", border: "#2a6a3a", label: "Correct" },
  wrong:   { bg: "#2a0a0a", border: "#4a1010", label: "Wrong" },
  unseen:  { bg: "#0a0b18", border: "#1e2245", label: "Not seen" },
};

export default function MasteryGrid({ subjectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!subjectId) return;
    getMasteryGrid(subjectId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [subjectId]);

  if (loading) {
    return <div style={{ color: "#4a5080", fontSize: "13px", padding: "12px 0" }}>Loading mastery grid…</div>;
  }

  if (!data || data.grid.length === 0) {
    return (
      <div style={{ color: "#4a5080", fontSize: "13px", padding: "12px 0" }}>
        No questions attempted yet — start practising to fill this grid.
      </div>
    );
  }

  const VISIBLE = 50;
  const grid = showAll ? data.grid : data.grid.slice(0, VISIBLE);
  const hasMore = data.grid.length > VISIBLE && !showAll;

  const counts = data.grid.reduce(
    (acc, q) => { acc[q.status] = (acc[q.status] || 0) + 1; return acc; },
    {}
  );

  return (
    <div>
      {/* Legend + counts */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ color: "#7b82b8", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>
          Mastery Grid
        </div>
        {Object.entries(STATUS_COLORS).map(([status, { bg, border, label }]) => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: bg, border: `0.5px solid ${border}` }} />
            <span style={{ color: "#7b82b8", fontSize: "11px" }}>{label} ({counts[status] || 0})</span>
          </div>
        ))}
      </div>

      {/* Grid cells */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
        {grid.map((q, i) => {
          const { bg, border } = STATUS_COLORS[q.status];
          return (
            <div
              key={q.id}
              title={`Q${i + 1} · ${q.topic} · ${q.difficulty} · ${STATUS_COLORS[q.status].label}${q.attemptCount > 0 ? ` (${q.attemptCount} attempt${q.attemptCount !== 1 ? "s" : ""})` : ""}`}
              style={{
                width: "20px", height: "20px", borderRadius: "4px",
                background: bg, border: `0.5px solid ${border}`,
                cursor: "default", flexShrink: 0,
              }}
            />
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            background: "none", border: "0.5px solid #1e2245", borderRadius: "8px",
            color: "#7b82b8", fontSize: "12px", padding: "6px 12px", cursor: "pointer",
          }}
        >
          Show all {data.total} questions
        </button>
      )}
    </div>
  );
}
