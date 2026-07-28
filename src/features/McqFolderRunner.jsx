import { useState, useCallback, useRef, useMemo } from "react";
import { X, ChevronRight, ChevronLeft, RotateCcw, Share2, Zap, Clock, Flame, Trophy } from "lucide-react";
import QuestionCard from "./QuestionCard.jsx";
import { copyShareToken } from "../lib/researchUtils.js";
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

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptions(q) {
  if (!q.options) return q;
  const entries = Object.entries(q.options);
  const shuffled = shuffleArray(entries);
  const newOptions = {};
  const remap = {};
  shuffled.forEach(([origKey, val], i) => {
    const newKey = String.fromCharCode(65 + i);
    newOptions[newKey] = val;
    remap[origKey] = newKey;
  });
  return { ...q, options: newOptions, correct: remap[q.correct] || q.correct };
}

function formatTime(ms) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function McqFolderRunner({ folder, mcqResources, onBack, onStreakUpdate, onXpUpdate }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  const combo = useComboStreak("practice");

  const allQuestions = useMemo(() => {
    const qs = [];
    for (const res of mcqResources) {
      let mcqData = res.mcqData;
      if (typeof mcqData === "string") {
        try { mcqData = JSON.parse(mcqData); } catch { continue; }
      }
      if (Array.isArray(mcqData)) {
        for (let i = 0; i < mcqData.length; i++) {
          qs.push({
            ...shuffleOptions(mcqData[i]),
            _resourceId: res.id,
            _questionIndex: i,
            _resourceTitle: res.title,
          });
        }
      }
    }
    return shuffleArray(qs);
  }, [mcqResources]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [shareToast, setShareToast] = useState("");
  const quizStartRef = useRef(Date.now());
  const questionStartRef = useRef(Date.now());

  const totalQuestions = allQuestions.length;
  const score = Object.entries(locked).filter(([i, v]) => v && answers[Number(i)] === allQuestions[Number(i)].correct).length;

  const handleSelect = (key) => {
    if (locked[currentIndex]) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: key }));
    setLocked((prev) => ({ ...prev, [currentIndex]: true }));
    const q = allQuestions[currentIndex];
    combo.handleAnswer(key === q.correct);
  };

  const handleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    let correctCount = 0;
    const details = [];
    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      const userAnswer = answers[i];
      const isCorrect = userAnswer === q.correct;
      if (isCorrect) correctCount++;
      details.push({
        resourceId: q._resourceId,
        questionIndex: q._questionIndex,
        correct: isCorrect,
        selected: userAnswer,
      });
    }

    try {
      const res = await fetch(`${API_BASE}/api/resources/folders/${folder.id}/quiz-attempts`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          score: correctCount,
          total: allQuestions.length,
          details,
          mode: "practice",
        }),
      });
      const data = await res.json();
      setResultsData(data);
      if (data.streak != null && onStreakUpdate) onStreakUpdate(data.streak, data.longestStreak);
      if (data.xpAwarded > 0 && onXpUpdate) onXpUpdate(data.xpAwarded);
    } catch {
      setResultsData({ score: correctCount, total: allQuestions.length });
    }
    setShowResults(true);
    setSubmitting(false);
  }, [answers, allQuestions, folder, submitting, onStreakUpdate, onXpUpdate]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= totalQuestions) {
      handleSubmit();
    } else {
      setCurrentIndex((i) => i + 1);
      questionStartRef.current = Date.now();
    }
  }, [currentIndex, totalQuestions, handleSubmit]);

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleRetake = () => {
    setAnswers({});
    setLocked({});
    setFlagged(new Set());
    setShowResults(false);
    setResultsData(null);
    setCurrentIndex(0);
    setSubmitting(false);
    combo.resetCombo();
    quizStartRef.current = Date.now();
    questionStartRef.current = Date.now();
  };

  const handleShare = () => {
    if (folder.shareToken) {
      copyShareToken(folder.shareToken);
      setShareToast("Folder link copied!");
      setTimeout(() => setShareToast(""), 2000);
    }
  };

  if (totalQuestions === 0) {
    return (
      <div style={{ ...fullscreenStyle, alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
        <div style={{ fontSize: "15px", marginBottom: "16px", color: "#7b82b8" }}>No MCQs found in this folder.</div>
        <button onClick={onBack} style={{ padding: "8px 14px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "13px", color: "#7b82b8", cursor: "pointer" }}>
          ← Back to folder
        </button>
      </div>
    );
  }

  if (showResults) {
    const xpEarned = resultsData?.xpAwarded ?? score * 20;
    const totalTime = Date.now() - quizStartRef.current;
    const wrongCount = totalQuestions - score;

    return (
      <div style={{ ...fullscreenStyle, overflowY: "auto" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: isMobile ? "50px 12px 32px" : "60px 20px 40px" }}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: isMobile ? "12px" : "16px", padding: isMobile ? "24px 16px" : "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: isMobile ? "32px" : "40px", marginBottom: "8px" }}>
              {score === totalQuestions ? "🏆" : score >= totalQuestions / 2 ? "🎉" : "📚"}
            </div>
            <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 700, color: "#e8eaf6", marginBottom: "4px" }}>
              Practice All Complete!
            </div>
            <div style={{ fontSize: isMobile ? "24px" : "28px", fontWeight: 800, color: score >= totalQuestions / 2 ? "#66bb6a" : "#ffb74d", marginBottom: "16px" }}>
              {score} / {totalQuestions}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? "8px" : "10px", marginBottom: "16px" }}>
              <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                <Zap size={16} style={{ color: "#f5a623", marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f5a623" }}>+{xpEarned}</div>
                <div style={{ fontSize: 10, color: "#5a6090" }}>XP Earned</div>
              </div>
              <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                <Clock size={16} style={{ color: "#7986cb", marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "#7986cb" }}>{formatTime(totalTime)}</div>
                <div style={{ fontSize: 10, color: "#5a6090" }}>Total Time</div>
              </div>
              {resultsData?.streak > 0 && (
                <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                  <Flame size={16} style={{ color: "#ff7043", marginBottom: 4 }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#ff7043" }}>{resultsData.streak}</div>
                  <div style={{ fontSize: 10, color: "#5a6090" }}>Day Streak</div>
                </div>
              )}
              <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                <Trophy size={16} style={{ color: "#DAA520", marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "#DAA520" }}>{Math.round((score / totalQuestions) * 100)}%</div>
                <div style={{ fontSize: 10, color: "#5a6090" }}>Score</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={handleRetake} style={{ flex: 1, padding: "12px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: 14, fontWeight: 700, color: "#FFD700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <RotateCcw size={16} /> Retake All
              </button>
              {folder.shareToken && (
                <button onClick={handleShare} style={{ flex: 1, padding: "12px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: 14, fontWeight: 700, color: "#7986cb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Share2 size={16} /> Share
                </button>
              )}
              <button onClick={onBack} style={{ flex: 1, padding: "12px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: 14, fontWeight: 700, color: "#7986cb", cursor: "pointer" }}>
                ← Back
              </button>
            </div>
          </div>

          {shareToast && (
            <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#0f2a1a", border: "0.5px solid #2a6a3a", color: "#a5d6a7", padding: "10px 20px", borderRadius: "20px", fontSize: 13, fontWeight: 600, zIndex: 10001 }}>
              {shareToast}
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = allQuestions[currentIndex];
  if (!q) return null;
  const progressPct = ((currentIndex + (locked[currentIndex] ? 1 : 0)) / totalQuestions) * 100;

  return (
    <div style={fullscreenStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 52px 12px 20px", background: "#0a0c1e", borderBottom: "0.5px solid #1e2245", flexShrink: 0 }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#DAA520", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ▶ Practice All — {folder.name}
        </span>
        {combo.combo >= 3 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "12px", fontWeight: 700, color: combo.combo >= 7 ? "#ff7043" : "#ffb74d", padding: "2px 8px", borderRadius: "999px", background: combo.combo >= 7 ? "rgba(255,112,67,0.12)" : "rgba(255,183,77,0.12)", border: `0.5px solid ${combo.combo >= 7 ? "rgba(255,112,67,0.3)" : "rgba(255,183,77,0.3)"}`, flexShrink: 0 }}>
            <Flame size={12} /> {combo.combo}x{STREAK_BONUS[combo.combo] ? ` +${STREAK_BONUS[combo.combo]}` : ""}
          </span>
        )}
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#66bb6a", flexShrink: 0 }}>{score}/{totalQuestions}</span>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a6090", padding: "4px" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8" }}>Q{currentIndex + 1}/{totalQuestions}</span>
          {q._resourceTitle && <span style={{ fontSize: "11px", color: "#4a5080", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{q._resourceTitle}</span>}
        </div>
        <div style={{ height: "4px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #B8860B, #FFD700)", borderRadius: "4px", transition: "width 0.3s ease" }} />
        </div>
        {(!isMobile || totalQuestions <= 30) && (
          <div style={{ display: "flex", gap: "3px", marginTop: "6px", flexWrap: "wrap" }}>
            {allQuestions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                style={{
                  width: isMobile ? "8px" : "10px", height: isMobile ? "8px" : "10px", borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
                  background: i === currentIndex ? "#FFD700"
                    : locked[i] ? (answers[i] === allQuestions[i].correct ? "#4caf50" : "#ef5350")
                    : flagged.has(i) ? "#ff7043"
                    : "#1e2245",
                }}
                title={`Q${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "20px", maxWidth: "700px", margin: "0 auto", width: "100%" }}>
        <QuestionCard
          question={q}
          questionNumber={currentIndex + 1}
          total={totalQuestions}
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
            <button onClick={handleNext} disabled={submitting} style={{ flex: 1, padding: isMobile ? "10px" : "12px", background: submitting ? "#0f1128" : "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: "#FFD700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              {submitting ? "Submitting..." : currentIndex < totalQuestions - 1 ? "Next" : "See Results"} <ChevronRight size={isMobile ? 13 : 15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
