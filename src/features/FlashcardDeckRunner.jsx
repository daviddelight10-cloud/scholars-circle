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

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "#060818",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Manrope, sans-serif",
  overflow: "auto",
};

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
      setCards([...parsed].sort(() => Math.random() - 0.5));
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
    setFlipped((f) => !f);
  }, []);

  // Keyboard shortcuts: Space=flip, 1-4=rate, Esc=back
  useEffect(() => {
    if (finished || loading || cards.length === 0) return;
    const onKey = (e) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (rating == null) setFlipped((f) => !f);
      } else if (e.key === "Escape") {
        onBack();
      } else if (flipped && rating == null && ["1", "2", "3", "4"].includes(e.key)) {
        handleRate(parseInt(e.key, 10));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rating, finished, loading, cards.length, onBack]);

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
    return (
      <div style={overlayStyle}>
        <div className="fc-pulse-text" style={{ color: "#9aa2d8", fontSize: 16, fontWeight: 600 }}>Loading flashcards…</div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div style={overlayStyle}>
        <div className="fc-float" style={{ fontSize: 56, marginBottom: 16 }}>🎴</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#9aa2d8", marginBottom: 8 }}>No flashcards in this deck</div>
        <button onClick={onBack} style={styles.backBtn}>← Back to folder</button>
      </div>
    );
  }

  if (finished) {
    const pct = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;
    const ringSize = 100;
    const ringStroke = 7;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCirc = 2 * Math.PI * ringRadius;
    const ringOffset = ringCirc - (pct / 100) * ringCirc;
    const ringColor = pct >= 70 ? "#66bb6a" : pct >= 50 ? "#ffb74d" : "#ef5350";
    const sc2 = getSubjectColor(resource?.subject);

    return (
      <div style={{ ...overlayStyle, justifyContent: "center", alignItems: "center" }}>
        {/* Ambient glow backdrop */}
        <div style={{
          position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
          width: "400px", height: "400px", borderRadius: "50%",
          background: `radial-gradient(circle, ${sc2.bg} 0%, transparent 70%)`,
          pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: "540px", width: "90%" }}>
          <div className="fc-scale-in" style={{ fontSize: 56, marginBottom: 14 }}>{pct >= 70 ? "🎉" : pct >= 50 ? "📊" : "📚"}</div>
          <h2 style={{ color: "#e8eaf6", fontSize: 26, fontWeight: 800, marginBottom: 24, fontFamily: "Syne, sans-serif" }}>Session Complete!</h2>

          {/* Score ring */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{
              position: "relative", width: ringSize, height: ringSize,
              filter: `drop-shadow(0 0 16px ${ringColor}55)`,
            }}>
              <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={ringStroke} />
                <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke={ringColor} strokeWidth={ringStroke}
                  strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: ringColor }}>
                {pct}%
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 28, flexWrap: "wrap" }}>
            <div style={styles.statBox}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#9aa2e0" }}>{sessionStats.reviewed}</div>
              <div style={{ fontSize: 10, color: "#7b82b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reviewed</div>
            </div>
            <div style={{ ...styles.statBox, borderTop: `2px solid ${ringColor}` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: ringColor }}>{sessionStats.correct}</div>
              <div style={{ fontSize: 10, color: "#7b82b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Correct</div>
            </div>
            {totalXpEarned > 0 && (
              <div style={{ ...styles.statBox, borderTop: "2px solid #f5a623" }}>
                <Zap size={16} style={{ color: "#f5a623", marginBottom: 4 }} />
                <div style={{ fontSize: 24, fontWeight: 800, color: "#f5a623" }}>+{totalXpEarned}</div>
                <div style={{ fontSize: 10, color: "#7b82b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>XP Earned</div>
              </div>
            )}
            {streakInfo?.streak > 0 && (
              <div style={{ ...styles.statBox, borderTop: "2px solid #ff7043" }}>
                <Flame size={16} style={{ color: "#ff7043", marginBottom: 4 }} />
                <div style={{ fontSize: 24, fontWeight: 800, color: "#ff7043" }}>{streakInfo.streak}</div>
                <div style={{ fontSize: 10, color: "#7b82b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Day Streak</div>
              </div>
            )}
          </div>
          <button onClick={onBack} style={styles.backBtn}>← Back to folder</button>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;
  const sc = getSubjectColor(resource?.subject);
  const stateDotColor = { 0: "#60a5fa", 1: "#ffb74d", 2: "#66bb6a", 3: "#ef5350" }[reviewItem?.state] || "#60a5fa";

  return (
    <div style={overlayStyle}>
      {/* Ambient glow backdrop */}
      <div style={{
        position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "500px", borderRadius: "50%",
        background: `radial-gradient(circle, ${sc.bg} 0%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "840px", margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh", padding: "20px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onBack} style={styles.backBtn}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {combo.combo >= 3 && (
              <span
                className={combo.combo >= 7 ? "fc-pulse-glow" : ""}
                style={{
                  display: "flex", alignItems: "center", gap: 4, fontSize: "12px", fontWeight: 700,
                  color: combo.combo >= 7 ? "#ff7043" : "#ffb74d", padding: "4px 10px", borderRadius: "999px",
                  background: combo.combo >= 7 ? "rgba(255,112,67,0.14)" : "rgba(255,183,77,0.14)",
                  border: `0.5px solid ${combo.combo >= 7 ? "rgba(255,112,67,0.35)" : "rgba(255,183,77,0.35)"}`,
                  backdropFilter: "blur(8px)",
                }}
              >
                <Flame size={12} /> {combo.combo}x{STREAK_BONUS[combo.combo] ? ` +${STREAK_BONUS[combo.combo]}` : ""}
              </span>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 16px", borderRadius: "999px",
              background: "rgba(13,15,32,0.7)", border: `0.5px solid ${sc.border}`,
              backdropFilter: "blur(8px)",
              fontSize: 12, fontWeight: 700, color: "#9aa2d8",
            }}>
              🎴 Card {currentIndex + 1} of {cards.length}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position: "relative", height: 7, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden", marginBottom: 24 }}>
          <div className="fc-shimmer" style={{
            position: "relative", height: "100%", width: `${progress}%`,
            background: `linear-gradient(90deg, ${sc.accent}, #FFD700)`,
            borderRadius: 999, transition: "width 0.4s ease",
            overflow: "hidden",
          }} />
        </div>

        {/* 3D Flip Card — centered, larger */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            onClick={handleFlip}
            style={{
              perspective: "1400px",
              cursor: "pointer",
              width: "100%",
              maxWidth: "760px",
              minHeight: "420px",
              filter: `drop-shadow(0 24px 50px rgba(0,0,0,0.4)) drop-shadow(0 6px 14px ${sc.bg})`,
            }}
          >
            <div style={{
              position: "relative",
              width: "100%",
              minHeight: "420px",
              transformStyle: "preserve-3d",
              transition: "transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}>
              {/* Front face */}
              <div style={{
                position: "absolute", inset: 0,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background: "rgba(15,17,36,0.85)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `0.5px solid ${sc.border}`,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `4px solid ${sc.accent}`,
                borderRadius: "24px",
                padding: "56px 44px",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                textAlign: "center",
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 30px ${sc.bg}`,
              }}>
                <div style={{
                  fontSize: 11, color: sc.text, marginBottom: 20,
                  textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
                  padding: "5px 14px", borderRadius: "999px",
                  background: sc.bg, border: `0.5px solid ${sc.border}`,
                }}>
                  Front
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#eef0fb", lineHeight: 1.65, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                  {card.front}
                </div>
                <div className="fc-bounce-hint" style={{ fontSize: 13, color: "#565c8f", marginTop: 32, fontWeight: 500 }}>
                  👆 Tap card to flip
                </div>
              </div>

              {/* Back face */}
              <div style={{
                position: "absolute", inset: 0,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: "rgba(14,20,17,0.85)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `0.5px solid ${sc.border}`,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `4px solid ${sc.accent}`,
                borderRadius: "24px",
                padding: "56px 44px",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                textAlign: "center",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 30px rgba(102,187,106,0.12)",
              }}>
                <div style={{
                  fontSize: 11, color: "#66bb6a", marginBottom: 20,
                  textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
                  padding: "5px 14px", borderRadius: "999px",
                  background: "rgba(102,187,106,0.12)", border: "0.5px solid rgba(102,187,106,0.35)",
                }}>
                  Back
                </div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "#b9e8bb", lineHeight: 1.65, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                  {card.back}
                </div>
                <div className="fc-bounce-hint" style={{ fontSize: 13, color: "#565c8f", marginTop: 32, fontWeight: 500 }}>
                  👆 Tap to flip back
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rating buttons */}
        {flipped && (
          <div className="fc-fade-in-up" style={{
            marginTop: 28, padding: "18px 16px", borderRadius: "18px",
            background: "rgba(13,15,32,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: "0.5px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9aa2d8", textAlign: "center", marginBottom: 14 }}>
              How well did you know this?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {GRADE_CONFIG.map(({ grade, label, icon, color, bg, border, interval }, i) => (
                <button
                  key={grade}
                  onClick={() => handleRate(grade)}
                  disabled={rating != null}
                  className="fc-fade-in-up"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    padding: "14px 20px", borderRadius: "16px",
                    background: rating === grade ? color : bg,
                    border: `1px solid ${border}`,
                    fontSize: 12, fontWeight: 700, color: rating === grade ? "#060818" : color,
                    cursor: rating != null ? "default" : "pointer",
                    minWidth: 80,
                    transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
                    opacity: rating != null && rating !== grade ? 0.4 : 1,
                    transform: rating === grade ? "scale(1.06) translateY(-2px)" : "scale(1) translateY(0)",
                    boxShadow: rating === grade ? `0 8px 20px ${bg}` : "none",
                    animationDelay: `${i * 50}ms`,
                  }}
                  onMouseEnter={(e) => { if (rating == null) { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = `0 6px 16px ${bg}`; } }}
                  onMouseLeave={(e) => { if (rating == null) { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "none"; } }}
                >
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span>{label}</span>
                  <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500 }}>{interval}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FSRS state indicator */}
        {reviewItem && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginTop: 18, fontSize: 12, color: "#7b82b8",
            padding: "6px 14px", borderRadius: "999px",
            background: "rgba(13,15,32,0.5)", backdropFilter: "blur(8px)",
            border: "0.5px solid rgba(255,255,255,0.05)",
            width: "fit-content", margin: "18px auto 0",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: stateDotColor, boxShadow: `0 0 6px ${stateDotColor}` }} />
            {reviewItem.state === 0 && "New card"}
            {reviewItem.state === 1 && "Learning"}
            {reviewItem.state === 2 && "Review"}
            {reviewItem.state === 3 && "Relearning"}
            {reviewItem.reps > 0 && ` · ${reviewItem.reps} reps`}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  backBtn: {
    padding: "9px 16px", background: "rgba(17,19,40,0.6)",
    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
    border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: "999px",
    fontSize: "13px", fontWeight: 600, color: "#9aa2d8", cursor: "pointer",
    transition: "all 0.15s ease",
  },
  statBox: {
    background: "rgba(13,15,32,0.6)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "0.5px solid rgba(255,255,255,0.06)",
    borderRadius: "16px",
    padding: "16px 24px",
    textAlign: "center",
    minWidth: 96,
  },
};
