import { useState, useEffect, useCallback, useRef } from "react";
import { Flame, Zap } from "lucide-react";
import { getSubjectColor } from "./research-hub/subjectColors";
import { useComboStreak } from "../lib/useComboStreak.js";
import { STREAK_BONUS } from "../data.js";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

const GRADE_CONFIG = [
  { grade: 1, label: "Again", icon: "😵", color: "#ef5350", bg: "rgba(239,83,80,0.12)", border: "rgba(239,83,80,0.4)", interval: "<1m" },
  { grade: 2, label: "Hard", icon: "😬", color: "#ffb74d", bg: "rgba(255,183,77,0.12)", border: "rgba(255,183,77,0.4)", interval: "~6m" },
  { grade: 3, label: "Good", icon: "😊", color: "#66bb6a", bg: "rgba(102,187,106,0.12)", border: "rgba(102,187,106,0.4)", interval: "~1d" },
  { grade: 4, label: "Easy", icon: "🎉", color: "#FFD700", bg: "rgba(255,215,0,0.12)", border: "rgba(255,215,0,0.4)", interval: "~3d" },
];

export default function FlashcardDeckRunner({ resource, onBack, onStreakUpdate, onXpUpdate }) {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [finished, setFinished] = useState(false);
  const [streakInfo, setStreakInfo] = useState(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const flipTimeoutRef = useRef(null);
  const combo = useComboStreak("flashcard");
  const xpEarnedRef = useRef(0);

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

  const handleFlip = useCallback(() => {
    if (flipped) return;
    setFlipped(true);
  }, [flipped]);

  const handleRate = async (grade) => {
    if (!resource?.id) return;
    setRating(grade);
    combo.handleAnswer(grade >= 3);
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
        setStreakInfo(data);
        if (onStreakUpdate && data.streak != null) onStreakUpdate(data.streak, data.longestStreak);
        if (data.xpAwarded > 0) {
          xpEarnedRef.current += data.xpAwarded;
          setTotalXpEarned(xpEarnedRef.current);
          if (onXpUpdate) onXpUpdate(data.xpAwarded);
        }
      }
    } catch {}

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (grade >= 3 ? 1 : 0),
    }));

    flipTimeoutRef.current = setTimeout(() => {
      if (currentIndex + 1 >= cards.length) {
        setFinished(true);
      } else {
        setCurrentIndex((i) => i + 1);
        setFlipped(false);
        setRating(null);
      }
    }, 400);
  };

  useEffect(() => () => clearTimeout(flipTimeoutRef.current), []);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "60px", color: "#7b82b8", fontFamily: "Manrope, sans-serif" }}>Loading flashcards…</div>;
  }

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "Manrope, sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎴</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#7b82b8", marginBottom: 6 }}>No flashcards in this deck</div>
        <button onClick={onBack} style={styles.backBtn}>← Back to folder</button>
      </div>
    );
  }

  if (finished) {
    const pct = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;
    const ringSize = 80;
    const ringStroke = 6;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCirc = 2 * Math.PI * ringRadius;
    const ringOffset = ringCirc - (pct / 100) * ringCirc;
    const ringColor = pct >= 70 ? "#66bb6a" : pct >= 50 ? "#ffb74d" : "#ef5350";

    return (
      <div style={{ padding: "20px", maxWidth: "500px", margin: "0 auto", textAlign: "center", fontFamily: "Manrope, sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{pct >= 70 ? "🎉" : pct >= 50 ? "📊" : "📚"}</div>
        <h2 style={{ color: "#c5c9e8", fontSize: 22, fontWeight: 800, marginBottom: 20, fontFamily: "Syne, sans-serif" }}>Session Complete!</h2>

        {/* Score ring */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="#1e2245" strokeWidth={ringStroke} />
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke={ringColor} strokeWidth={ringStroke}
                strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.6s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: ringColor }}>
              {pct}%
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
          <div style={styles.statBox}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#7986cb" }}>{sessionStats.reviewed}</div>
            <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reviewed</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ fontSize: 24, fontWeight: 800, color: ringColor }}>{sessionStats.correct}</div>
            <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>Correct</div>
          </div>
          {totalXpEarned > 0 && (
            <div style={styles.statBox}>
              <Zap size={16} style={{ color: "#f5a623", marginBottom: 4 }} />
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f5a623" }}>+{totalXpEarned}</div>
              <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>XP Earned</div>
            </div>
          )}
          {streakInfo?.streak > 0 && (
            <div style={styles.statBox}>
              <Flame size={16} style={{ color: "#ff7043", marginBottom: 4 }} />
              <div style={{ fontSize: 24, fontWeight: 800, color: "#ff7043" }}>{streakInfo.streak}</div>
              <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>Day Streak</div>
            </div>
          )}
        </div>
        <button onClick={onBack} style={styles.backBtn}>← Back to folder</button>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;
  const sc = getSubjectColor(resource?.subject);

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "Manrope, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {combo.combo >= 3 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "12px", fontWeight: 700, color: combo.combo >= 7 ? "#ff7043" : "#ffb74d", padding: "2px 8px", borderRadius: "999px", background: combo.combo >= 7 ? "rgba(255,112,67,0.12)" : "rgba(255,183,77,0.12)", border: `0.5px solid ${combo.combo >= 7 ? "rgba(255,112,67,0.3)" : "rgba(255,183,77,0.3)"}` }}>
              <Flame size={12} /> {combo.combo}x{STREAK_BONUS[combo.combo] ? ` +${STREAK_BONUS[combo.combo]}` : ""}
            </span>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: "999px",
            background: "#0d0f20", border: "0.5px solid #1e2245",
            fontSize: 12, fontWeight: 700, color: "#7b82b8",
          }}>
            🎴 Card {currentIndex + 1} of {cards.length}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: "#0a0c1e", borderRadius: 999, overflow: "hidden", marginBottom: 24 }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: `linear-gradient(90deg, ${sc.accent}, #FFD700)`,
          borderRadius: 999, transition: "width 0.4s ease",
        }} />
      </div>

      {/* 3D Flip Card */}
      <div
        onClick={handleFlip}
        style={{
          perspective: "1200px",
          cursor: flipped ? "default" : "pointer",
          minHeight: "300px",
        }}
      >
        <div style={{
          position: "relative",
          width: "100%",
          minHeight: "300px",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}>
          {/* Front face */}
          <div style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: `linear-gradient(145deg, #0d0f20, #111328)`,
            border: `0.5px solid ${sc.border}`,
            borderLeft: `3px solid ${sc.accent}`,
            borderRadius: "18px",
            padding: "36px 28px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <div style={{
              fontSize: 10, color: sc.text, marginBottom: 14,
              textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
              padding: "3px 10px", borderRadius: "999px",
              background: sc.bg, border: `0.5px solid ${sc.border}`,
            }}>
              Front
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#e8eaf6", lineHeight: 1.6 }}>
              {card.front}
            </div>
            <div style={{ fontSize: 12, color: "#3a3d60", marginTop: 24, fontWeight: 500 }}>
              👆 Tap card to flip
            </div>
          </div>

          {/* Back face */}
          <div style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: `linear-gradient(145deg, #0d0f20, #0f1a14)`,
            border: `0.5px solid ${sc.border}`,
            borderLeft: `3px solid ${sc.accent}`,
            borderRadius: "18px",
            padding: "36px 28px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <div style={{
              fontSize: 10, color: "#66bb6a", marginBottom: 14,
              textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
              padding: "3px 10px", borderRadius: "999px",
              background: "rgba(102,187,106,0.1)", border: "0.5px solid rgba(102,187,106,0.3)",
            }}>
              Back
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#a5d6a7", lineHeight: 1.6 }}>
              {card.back}
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#7b82b8", textAlign: "center", marginBottom: 12 }}>
            How well did you know this?
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {GRADE_CONFIG.map(({ grade, label, icon, color, bg, border, interval }) => (
              <button
                key={grade}
                onClick={() => handleRate(grade)}
                disabled={rating != null}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "12px 16px", borderRadius: "14px",
                  background: rating === grade ? color : bg,
                  border: `1px solid ${border}`,
                  fontSize: 12, fontWeight: 700, color: rating === grade ? "#060818" : color,
                  cursor: rating != null ? "default" : "pointer",
                  minWidth: 72,
                  transition: "all 0.15s ease",
                  opacity: rating != null && rating !== grade ? 0.4 : 1,
                  transform: rating === grade ? "scale(1.05)" : "scale(1)",
                  boxShadow: rating === grade ? `0 4px 16px ${bg}` : "none",
                }}
              >
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span>{label}</span>
                <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 500 }}>{interval}</span>
              </button>
            ))}
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
  backBtn: {
    padding: "8px 14px", background: "#111328",
    border: "0.5px solid #2a2d4a", borderRadius: "8px",
    fontSize: "13px", color: "#7b82b8", cursor: "pointer",
  },
  statBox: {
    background: "#0d0f20",
    border: "0.5px solid #1e2245",
    borderRadius: "14px",
    padding: "14px 22px",
    textAlign: "center",
    minWidth: 90,
  },
};
