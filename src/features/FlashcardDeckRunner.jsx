import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export default function FlashcardDeckRunner({ resource, onBack, onStreakUpdate }) {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [rating, setRating] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (resource?.flashcardData) {
      const parsed = typeof resource.flashcardData === "string" ? JSON.parse(resource.flashcardData) : resource.flashcardData;
      setCards(parsed);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [resource]);

  const fetchReviewItem = useCallback(async () => {
    if (!resource?.id || !cards[currentIndex]) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/resources/fsrs/status/${resource.id}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        const match = (data.flashcards || []).find(
          (i) => i.flashcardId === `deck_${currentIndex}`
        );
        setReviewItem(match || null);
      }
    } catch {}
  }, [resource, cards, currentIndex]);

  useEffect(() => {
    if (cards.length > 0 && !finished) {
      fetchReviewItem();
    }
  }, [currentIndex, cards, finished, fetchReviewItem]);

  const handleRate = async (grade) => {
    if (!resource?.id) return;
    setRating(grade);
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/rate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          resourceId: resource.id,
          itemType: "flashcard",
          pageIndex: -1,
          flashcardId: `deck_${currentIndex}`,
          grade,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (onStreakUpdate) {
          onStreakUpdate(data);
        }
      }
    } catch {}

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (grade >= 3 ? 1 : 0),
    }));

    setTimeout(() => {
      if (currentIndex + 1 >= cards.length) {
        setFinished(true);
      } else {
        setCurrentIndex((i) => i + 1);
        setShowBack(false);
        setRating(null);
      }
    }, 400);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "60px", color: "#7b82b8" }}>Loading flashcards…</div>;
  }

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎴</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#7b82b8", marginBottom: 6 }}>No flashcards in this deck</div>
        <button onClick={onBack} style={styles.backBtn}>← Back to folder</button>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((sessionStats.correct / sessionStats.reviewed) * 100);
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: "#e8eaf6", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Session Complete!</h2>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
          <div style={styles.statBox}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#7986cb" }}>{sessionStats.reviewed}</div>
            <div style={{ fontSize: 11, color: "#4a5080" }}>Cards Reviewed</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#66bb6a" }}>{sessionStats.correct}</div>
            <div style={{ fontSize: 11, color: "#4a5080" }}>Correct ({pct}%)</div>
          </div>
        </div>
        <button onClick={onBack} style={styles.backBtn}>← Back to folder</button>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#7b82b8" }}>
          🎴 {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#0a0c1e", borderRadius: 4, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #B8860B, #5c6bc0)", borderRadius: 4, transition: "width 0.3s" }} />
      </div>

      {/* Card */}
      <div
        onClick={() => !showBack && setShowBack(true)}
        style={{
          ...styles.card,
          cursor: showBack ? "default" : "pointer",
          minHeight: "280px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {!showBack ? (
          <>
            <div style={{ fontSize: 11, color: "#4a5080", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Front</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#e8eaf6", lineHeight: 1.5 }}>{card.front}</div>
            <div style={{ fontSize: 12, color: "#3a3d60", marginTop: 20 }}>Tap to reveal answer</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "#4a5080", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Back</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#a5d6a7", lineHeight: 1.5 }}>{card.back}</div>
          </>
        )}
      </div>

      {/* Rating buttons */}
      {showBack && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#7b82b8", textAlign: "center", marginBottom: 10 }}>How well did you know this?</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => handleRate(1)} style={{ ...styles.rateBtn, background: "#4a1010", borderColor: "#ff5470", color: "#ef9a9a" }}>
              <span style={{ fontSize: 18 }}>😵</span>
              <span>Again</span>
            </button>
            <button onClick={() => handleRate(2)} style={{ ...styles.rateBtn, background: "#3a2800", borderColor: "#ffb74d", color: "#ffcc80" }}>
              <span style={{ fontSize: 18 }}>😬</span>
              <span>Hard</span>
            </button>
            <button onClick={() => handleRate(3)} style={{ ...styles.rateBtn, background: "#0f2a1a", borderColor: "#66bb6a", color: "#a5d6a7" }}>
              <span style={{ fontSize: 18 }}>😊</span>
              <span>Good</span>
            </button>
            <button onClick={() => handleRate(4)} style={{ ...styles.rateBtn, background: "#0f1440", borderColor: "#7986cb", color: "#FFD700" }}>
              <span style={{ fontSize: 18 }}>🎉</span>
              <span>Easy</span>
            </button>
          </div>
        </div>
      )}

      {/* FSRS state indicator */}
      {reviewItem && (
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#4a5080" }}>
          {reviewItem.state === 0 && "🆕 New card"}
          {reviewItem.state === 1 && "📖 Learning"}
          {reviewItem.state === 2 && "🔄 Review"}
          {reviewItem.state === 3 && "🔁 Relearning"}
          {reviewItem.reps > 0 && ` · ${reviewItem.reps} reps`}
        </div>
      )}
    </div>
  );
}

const styles = {
  backBtn: { padding: "8px 14px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "13px", color: "#7b82b8", cursor: "pointer" },
  card: {
    background: "#0d0f20",
    border: "0.5px solid #1e2245",
    borderRadius: "16px",
    padding: "32px 24px",
    transition: "border-color 0.15s",
  },
  statBox: {
    background: "#0d0f20",
    border: "0.5px solid #1e2245",
    borderRadius: "12px",
    padding: "16px 24px",
    textAlign: "center",
    minWidth: 100,
  },
  rateBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "12px 18px",
    borderRadius: "12px",
    border: "0.5px solid",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    minWidth: 70,
  },
};
