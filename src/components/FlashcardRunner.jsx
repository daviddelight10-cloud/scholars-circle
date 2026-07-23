import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

const THEME_PALETTE = {
  dark: {
    bg: "#0d0f1f", cardBg: "rgba(13,15,32,0.85)", border: "#1e2245", text: "#e8eaf6",
    muted: "#7b82b8", accent: "#B8860B", hover: "rgba(255,255,255,0.05)",
    shadow: "rgba(0,0,0,0.4)", secondary: "#5c6bc0",
  },
  light: {
    bg: "#f5f7fa", cardBg: "rgba(255,255,255,0.92)", border: "#e0e6ed", text: "#1a1a2e",
    muted: "#6b7280", accent: "#2563EB", hover: "rgba(0,0,0,0.04)",
    shadow: "rgba(0,0,0,0.08)", secondary: "#7c3aed",
  },
  sepia: {
    bg: "#EFE8D3", cardBg: "rgba(239,232,211,0.92)", border: "#DED2B0", text: "#3A3A3A",
    muted: "#6E6656", accent: "#8B5E34", hover: "rgba(139,94,52,0.08)",
    shadow: "rgba(58,58,58,0.10)", secondary: "#a0522d",
  },
};

const RATINGS = [
  { grade: 1, label: "Again", icon: "😵", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", interval: "<1m" },
  { grade: 2, label: "Hard", icon: "😬", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)", interval: "~6m" },
  { grade: 3, label: "Good", icon: "😊", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.4)", interval: "~1d" },
  { grade: 4, label: "Easy", icon: "🎉", color: "#FFD700", bg: "rgba(255,215,0,0.12)", border: "rgba(255,215,0,0.4)", interval: "~3d" },
];

export default function FlashcardRunner({ flashcards: initialFlashcards, resourceId, onComplete, theme = "dark" }) {
  const T = THEME_PALETTE[theme] || THEME_PALETTE.dark;
  const [queue, setQueue] = useState(initialFlashcards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [againQueue, setAgainQueue] = useState([]);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(false);
  const [lastInterval, setLastInterval] = useState(null);

  const current = queue[index];

  const handleRate = useCallback(async (grade) => {
    if (!current || rating) return;
    setRating(true);

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          resourceId,
          itemType: "flashcard",
          flashcardId: current.id,
          grade,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastInterval(data.intervalLabel);
      }
    } catch {}

    setReviewed((r) => r + 1);
    const isAgain = grade === 1;
    const newAgainQueue = isAgain ? [...againQueue, current] : againQueue;
    if (isAgain) {
      setAgainCount((c) => c + 1);
      setAgainQueue(newAgainQueue);
    }
    setResults((r) => [...r, { id: current.id, grade }]);
    setRating(false);

    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      setFlipped(false);
      setLastInterval(null);
    } else if (newAgainQueue.length > 0) {
      setQueue(newAgainQueue);
      setAgainQueue([]);
      setIndex(0);
      setFlipped(false);
    } else {
      setDone(true);
    }
  }, [current, rating, resourceId, index, queue.length, againQueue]);

  const restart = () => {
    setQueue(initialFlashcards);
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
    setAgainCount(0);
    setAgainQueue([]);
    setResults([]);
    setDone(false);
    setLastInterval(null);
  };

  if (done) {
    const goodCount = results.filter((r) => r.grade >= 3).length;
    const pct = reviewed > 0 ? Math.round((goodCount / reviewed) * 100) : 0;
    const ringSize = 100;
    const ringStroke = 7;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCirc = 2 * Math.PI * ringRadius;
    const ringOffset = ringCirc - (pct / 100) * ringCirc;
    const ringColor = pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

    return (
      <div style={{ textAlign: "center", padding: "32px 16px" }}>
        <div className="sc-card-enter" style={{ fontSize: 48, marginBottom: 10 }}>{pct >= 70 ? "🎉" : pct >= 50 ? "📊" : "📚"}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 20 }}>Review Complete!</div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", width: ringSize, height: ringSize, filter: `drop-shadow(0 0 12px ${ringColor}44)` }}>
            <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke={T.hover} strokeWidth={ringStroke} />
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke={ringColor} strokeWidth={ringStroke}
                strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: ringColor }}>{pct}%</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { val: goodCount, label: "Good/Easy", color: "#22c55e" },
            { val: againCount, label: "Again", color: "#ef4444" },
            { val: reviewed, label: "Total", color: T.secondary },
          ].map((s) => (
            <div key={s.label} style={{
              background: T.cardBg, border: `0.5px solid ${T.border}`, borderTop: `2px solid ${s.color}`,
              borderRadius: 14, padding: "14px 20px", textAlign: "center", minWidth: 80,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={restart} style={{
            padding: "11px 22px", borderRadius: 12, background: T.hover, border: `1px solid ${T.border}`,
            color: T.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s ease",
          }}>Review Again</button>
          {onComplete && <button onClick={onComplete} style={{
            padding: "11px 22px", borderRadius: 12,
            background: `linear-gradient(135deg, ${T.accent}, ${T.secondary})`, border: "none",
            color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.15s ease",
          }}>Done</button>}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted, fontSize: 14 }}>
        No flashcards to review. Generate some first!
      </div>
    );
  }

  const progress = ((index) / (queue.length + againQueue.length)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, position: "relative", height: 6, background: T.hover, borderRadius: 999, overflow: "hidden" }}>
          <div className="sc-shimmer-bar" style={{
            position: "relative", height: "100%", width: `${Math.min(progress, 100)}%`,
            background: `linear-gradient(90deg, ${T.accent}, ${T.secondary})`,
            borderRadius: 999, transition: "width 0.4s ease", overflow: "hidden",
          }} />
        </div>
        <span style={{
          fontSize: 11, color: T.muted, whiteSpace: "nowrap", fontWeight: 600,
          padding: "3px 10px", borderRadius: 999, background: T.hover,
        }}>{index + 1} / {queue.length}</span>
      </div>

      <div
        onClick={() => !flipped && setFlipped(true)}
        style={{ perspective: "1200px", cursor: flipped ? "default" : "pointer", width: "100%" }}
      >
        <div style={{
          position: "relative", width: "100%", minHeight: 240,
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}>
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            background: T.cardBg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: `0.5px solid ${T.border}`, borderLeft: `4px solid ${T.accent}`,
            borderRadius: 18, padding: "32px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 28px ${T.shadow}`,
          }}>
            <div style={{
              position: "absolute", top: 12, left: 16,
              fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              padding: "3px 10px", borderRadius: 999, background: T.hover,
            }}>Question</div>
            {current.sourcePage && (
              <div style={{ position: "absolute", top: 12, right: 16, fontSize: 10, color: T.muted }}>p.{current.sourcePage}</div>
            )}
            <div style={{ fontSize: 17, fontWeight: 500, color: T.text, textAlign: "center", lineHeight: 1.6 }}>{current.front}</div>
            {!flipped && (
              <div style={{ marginTop: 18, fontSize: 12, color: T.muted }}>👆 Tap to reveal answer</div>
            )}
          </div>
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: T.cardBg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: `0.5px solid ${T.border}`, borderLeft: `4px solid #22c55e`,
            borderRadius: 18, padding: "32px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 28px ${T.shadow}`,
          }}>
            <div style={{
              position: "absolute", top: 12, left: 16,
              fontSize: 10, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              padding: "3px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)",
            }}>Answer</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: T.text, textAlign: "center", lineHeight: 1.6 }}>{current.back}</div>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="sc-fade-in-up" style={{
          padding: "14px 12px", borderRadius: 14,
          background: T.cardBg, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: `0.5px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, textAlign: "center", marginBottom: 12 }}>
            How well did you know this?
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {RATINGS.map((r, i) => (
              <button
                key={r.grade}
                onClick={() => handleRate(r.grade)}
                disabled={rating}
                className="sc-fade-in-up"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: "12px 16px", borderRadius: 14,
                  background: rating === r.grade ? r.color : r.bg,
                  border: `1px solid ${r.border}`,
                  fontSize: 12, fontWeight: 700, color: rating === r.grade ? "#fff" : r.color,
                  cursor: rating ? "default" : "pointer", minWidth: 72,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
                  opacity: rating && rating !== r.grade ? 0.4 : 1,
                  transform: rating === r.grade ? "scale(1.06) translateY(-2px)" : "scale(1) translateY(0)",
                  boxShadow: rating === r.grade ? `0 6px 16px ${r.bg}` : "none",
                  animationDelay: `${i * 50}ms`,
                }}
                onMouseEnter={(e) => { if (!rating) { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = `0 4px 12px ${r.bg}`; } }}
                onMouseLeave={(e) => { if (!rating) { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "none"; } }}
              >
                <span style={{ fontSize: 20 }}>{r.icon}</span>
                <span>{r.label}</span>
                <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 500 }}>{r.interval}</span>
              </button>
            ))}
          </div>
          {lastInterval && (
            <div style={{ textAlign: "center", fontSize: 11, color: T.muted, marginTop: 10 }}>Next review: {lastInterval}</div>
          )}
        </div>
      )}
    </div>
  );
}
