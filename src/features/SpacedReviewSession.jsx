import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, RotateCcw, Flame, Zap } from "lucide-react";
import QuestionCard from "./QuestionCard.jsx";
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

const fullscreenStyle = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "#060818", display: "flex", flexDirection: "column",
};

function shuffleOptions(q) {
  if (!q.options) return q;
  const entries = Object.entries(q.options);
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const newOptions = {};
  const remap = {};
  shuffled.forEach(([origKey, val], i) => {
    const newKey = String.fromCharCode(65 + i);
    newOptions[newKey] = val;
    remap[origKey] = newKey;
  });
  return { ...q, options: newOptions, correct: remap[q.correct] || q.correct };
}

export default function SpacedReviewSession({ subject, resourceIds, onBack, onStreakUpdate, onXpUpdate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [finished, setFinished] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [streakInfo, setStreakInfo] = useState(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  const questionStartRef = useRef(Date.now());
  const combo = useComboStreak("spaced");
  const xpEarnedRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (resourceIds) params.set("resourceIds", resourceIds.join(","));

    fetch(`${API_BASE}/api/resources/fsrs/due-mcqs?${params.toString()}`, {
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        const enriched = (data.items || [])
          .filter((i) => i.mcq)
          .map((i) => ({
            ...shuffleOptions(i.mcq),
            _resourceId: i.resourceId,
            _pageIndex: i.pageIndex,
            _resourceTitle: i.resource?.title,
          }));
        setItems(enriched);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [subject, resourceIds]);

  const handleSelect = (key) => {
    if (locked[currentIndex]) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: key }));
    setLocked((prev) => ({ ...prev, [currentIndex]: true }));

    const q = items[currentIndex];
    const isCorrect = key === q.correct;
    const timeSpentMs = Date.now() - questionStartRef.current;

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    }));

    combo.handleAnswer(isCorrect);

    fetch(`${API_BASE}/api/resources/fsrs/rate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        resourceId: q._resourceId,
        itemType: "mcq",
        pageIndex: q._pageIndex,
        flashcardId: "none",
        grade: isCorrect ? (timeSpentMs < 5000 ? 4 : 3) : 1,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setStreakInfo(data);
        if (data.streak != null && onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
        if (data.xpAwarded > 0) {
          xpEarnedRef.current += data.xpAwarded;
          setTotalXpEarned(xpEarnedRef.current);
          if (onXpUpdate) onXpUpdate(data.xpAwarded);
        }
      })
      .catch(() => {});
  };

  const handleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  };

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= items.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      questionStartRef.current = Date.now();
    }
  }, [currentIndex, items.length]);

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleRestart = () => {
    setAnswers({});
    setLocked({});
    setFlagged(new Set());
    setFinished(false);
    setCurrentIndex(0);
    setSessionStats({ reviewed: 0, correct: 0 });
    setTotalXpEarned(0);
    xpEarnedRef.current = 0;
    combo.resetCombo();
    questionStartRef.current = Date.now();
  };

  if (loading) {
    return (
      <div style={{ ...fullscreenStyle, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#7b82b8", fontSize: "15px" }}>Loading due MCQs...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ ...fullscreenStyle, alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>✅</div>
        <div style={{ fontSize: "15px", color: "#7b82b8", marginBottom: "16px" }}>No due MCQs in scope!</div>
        <button onClick={onBack} style={{ padding: "8px 14px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "13px", color: "#7b82b8", cursor: "pointer" }}>
          ← Back
        </button>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((sessionStats.correct / sessionStats.reviewed) * 100);
    return (
      <div style={{ ...fullscreenStyle, overflowY: "auto" }}>
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "60px 20px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{pct >= 70 ? "🎉" : pct >= 50 ? "📊" : "📚"}</div>
          <h2 style={{ color: "#c5c9e8", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Spaced Review Complete!</h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "14px", padding: "14px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#7986cb" }}>{sessionStats.reviewed}</div>
              <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reviewed</div>
            </div>
            <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "14px", padding: "14px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: pct >= 70 ? "#66bb6a" : "#ffb74d" }}>{pct}%</div>
              <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>Accuracy</div>
            </div>
            {totalXpEarned > 0 && (
              <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "14px", padding: "14px 22px", textAlign: "center" }}>
                <Zap size={16} style={{ color: "#f5a623", marginBottom: 4 }} />
                <div style={{ fontSize: 24, fontWeight: 800, color: "#f5a623" }}>+{totalXpEarned}</div>
                <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>XP Earned</div>
              </div>
            )}
            {streakInfo?.streak > 0 && (
              <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "14px", padding: "14px 22px", textAlign: "center" }}>
                <Flame size={16} style={{ color: "#ff7043", marginBottom: 4 }} />
                <div style={{ fontSize: 24, fontWeight: 800, color: "#ff7043" }}>{streakInfo.streak}</div>
                <div style={{ fontSize: 10, color: "#5a6090", textTransform: "uppercase", letterSpacing: "0.05em" }}>Day Streak</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={handleRestart} style={{ padding: "12px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: 14, fontWeight: 700, color: "#FFD700", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <RotateCcw size={16} /> Review Again
            </button>
            <button onClick={onBack} style={{ padding: "12px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: 14, fontWeight: 700, color: "#7986cb", cursor: "pointer" }}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = items[currentIndex];
  const progressPct = ((currentIndex + (locked[currentIndex] ? 1 : 0)) / items.length) * 100;

  return (
    <div style={fullscreenStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 52px 12px 20px", background: "#0a0c1e", borderBottom: "0.5px solid #1e2245", flexShrink: 0 }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#f59e0b", flex: 1 }}>🔁 Spaced Review</span>
        {combo.combo >= 3 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "12px", fontWeight: 700, color: combo.combo >= 7 ? "#ff7043" : "#ffb74d", padding: "2px 8px", borderRadius: "999px", background: combo.combo >= 7 ? "rgba(255,112,67,0.12)" : "rgba(255,183,77,0.12)", border: `0.5px solid ${combo.combo >= 7 ? "rgba(255,112,67,0.3)" : "rgba(255,183,77,0.3)"}` }}>
            <Flame size={12} /> {combo.combo}x{STREAK_BONUS[combo.combo] ? ` +${STREAK_BONUS[combo.combo]}` : ""}
          </span>
        )}
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#66bb6a", flexShrink: 0 }}>{sessionStats.correct}/{items.length}</span>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a6090", padding: "4px" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8" }}>Q{currentIndex + 1}/{items.length}</span>
          {q._resourceTitle && <span style={{ fontSize: "11px", color: "#4a5080", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{q._resourceTitle}</span>}
        </div>
        <div style={{ height: "4px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #f59e0b, #FFD700)", borderRadius: "4px", transition: "width 0.3s ease" }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "20px", maxWidth: "700px", margin: "0 auto", width: "100%" }}>
        <QuestionCard
          question={q}
          questionNumber={currentIndex + 1}
          total={items.length}
          selectedAnswer={answers[currentIndex]}
          isLocked={locked[currentIndex]}
          isFlagged={flagged.has(currentIndex)}
          isMobile={isMobile}
          onSelectAnswer={handleSelect}
          onToggleFlag={handleFlag}
        />

        {locked[currentIndex] && (
          <div style={{ display: "flex", gap: "10px", marginTop: isMobile ? "12px" : "16px" }}>
            {currentIndex > 0 && (
              <button onClick={handlePrev} style={{ padding: isMobile ? "10px" : "12px", background: "transparent", border: "0.5px solid #2a2d4a", borderRadius: "10px", fontSize: isMobile ? "12px" : "13px", fontWeight: 600, color: "#5a6090", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <ChevronLeft size={isMobile ? 13 : 15} /> Prev
              </button>
            )}
            <button onClick={handleNext} style={{ flex: 1, padding: isMobile ? "10px" : "12px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: "#FFD700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              {currentIndex < items.length - 1 ? "Next" : "Finish"} <ChevronRight size={isMobile ? 13 : 15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
