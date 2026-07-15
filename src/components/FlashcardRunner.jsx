import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

const RATINGS = [
  { grade: 1, label: "Again", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "#ef4444" },
  { grade: 2, label: "Hard", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "#f59e0b" },
  { grade: 3, label: "Good", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "#22c55e" },
  { grade: 4, label: "Easy", color: "#FFD700", bg: "rgba(255,215,0,0.12)", border: "#FFD700" },
];

export default function FlashcardRunner({ flashcards: initialFlashcards, resourceId, onComplete, theme = "dark" }) {
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

    // Move to next card
    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      setFlipped(false);
      setLastInterval(null);
    } else if (newAgainQueue.length > 0) {
      // Review again-queue items
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
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf6", marginBottom: 8 }}>Review Complete!</div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>{goodCount}</div>
            <div style={{ fontSize: 11, color: "#7b82b8" }}>Good/Easy</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>{againCount}</div>
            <div style={{ fontSize: 11, color: "#7b82b8" }}>Again</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#7986cb" }}>{reviewed}</div>
            <div style={{ fontSize: 11, color: "#7b82b8" }}>Total</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={restart} style={{ padding: "10px 20px", borderRadius: 10, background: "#0d0f1f", border: "0.5px solid #1e2245", color: "#7b82b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Review Again</button>
          {onComplete && <button onClick={onComplete} style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#B8860B,#5c6bc0)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Done</button>}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#4a5080", fontSize: 14 }}>
        No flashcards to review. Generate some first!
      </div>
    );
  }

  const progress = ((index) / (queue.length + againQueue.length)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: "#0a0c1e", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(progress, 100)}%`, background: "linear-gradient(90deg,#B8860B,#5c6bc0)", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
        <span style={{ fontSize: 11, color: "#4a5080", whiteSpace: "nowrap" }}>{index + 1} / {queue.length}</span>
      </div>

      {/* Card */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        style={{
          minHeight: 220,
          background: flipped ? "#0d0f20" : "#0d0f1f",
          border: `0.5px solid ${flipped ? "#B8860B" : "#1e2245"}`,
          borderRadius: 14,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: flipped ? "default" : "pointer",
          position: "relative",
          transition: "all 0.2s",
        }}
      >
        <div style={{ position: "absolute", top: 10, left: 14, fontSize: 10, color: "#3a3d60", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {flipped ? "Answer" : "Question"}
        </div>
        {current.sourcePage && (
          <div style={{ position: "absolute", top: 10, right: 14, fontSize: 10, color: "#3a3d60" }}>p.{current.sourcePage}</div>
        )}
        <div style={{ fontSize: 16, color: "#e8eaf6", textAlign: "center", lineHeight: 1.6 }}>
          {flipped ? current.back : current.front}
        </div>
        {!flipped && (
          <div style={{ marginTop: 16, fontSize: 11, color: "#3a3d60" }}>Tap to reveal answer →</div>
        )}
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {RATINGS.map((r) => (
            <button
              key={r.grade}
              onClick={() => handleRate(r.grade)}
              disabled={rating}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: r.bg,
                border: `1px solid ${r.border}40`,
                color: r.color,
                cursor: rating ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 700,
                opacity: rating ? 0.5 : 1,
                transition: "all 0.15s",
              }}
            >
              {r.label}
              {lastInterval && r.grade === 3 && <div style={{ fontSize: 9, color: "#4a5080", marginTop: 2 }}>{lastInterval}</div>}
            </button>
          ))}
        </div>
      )}

      {/* Last interval feedback */}
      {lastInterval && flipped && (
        <div style={{ textAlign: "center", fontSize: 11, color: "#4a5080" }}>Next review: {lastInterval}</div>
      )}
    </div>
  );
}
