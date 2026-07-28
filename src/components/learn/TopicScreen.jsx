import { useState, useEffect } from "react";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function masteryLevel(pct) {
  if (pct >= 81) return { label: "Mastered", color: "#10b981", bg: "#0f2a1a" };
  if (pct >= 51) return { label: "Practiced", color: "#FFD700", bg: "#0f1535" };
  if (pct >= 21) return { label: "Learning", color: "#f59e0b", bg: "#1a1000" };
  return { label: "Beginner", color: "#6b7280", bg: "#0a0b18" };
}

export default function TopicScreen({ subject, mastery, onClose, onStartPractice, onOpenHub }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerContext, setPickerContext] = useState(null); // { topicId, topicName, maxCount }

  const pct = Math.round(mastery?.[subject.id] || 0);
  const { label: lvlLabel, color: lvlColor, bg: lvlBg } = masteryLevel(pct);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${BASE}/api/topics?subjectId=${subject.id}`);
        if (res.ok) {
          const data = await res.json();
          setTopics(data);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [subject.id]);

  // Group questions by topic string (for subjects without proper Topic records)
  const topicGroups = {};
  (subject.questions || []).forEach((q) => {
    const key = q.topic || "General";
    if (!topicGroups[key]) topicGroups[key] = [];
    topicGroups[key].push(q);
  });

  // Merge DB topics with question string topics
  const displayTopics = topics.length > 0
    ? topics.map((t) => ({
        id: t.id,
        name: t.name,
        icon: t.icon || "📖",
        questionCount: t._count?.questions || topicGroups[t.name]?.length || 0,
      }))
    : Object.entries(topicGroups).map(([name, qs]) => ({
        id: null,
        name,
        icon: "📖",
        questionCount: qs.length,
      }));

  function openPicker(topicId, topicName, maxCount) {
    setPickerContext({ topicId, topicName, maxCount });
    setPickerOpen(true);
  }

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(7,8,15,0.9)", zIndex: 8000,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  };
  const sheet = {
    background: "#0d0f20", borderRadius: "20px 20px 0 0",
    border: "0.5px solid #1e2245", borderBottom: "none",
    padding: "24px 20px 48px", width: "100%", maxWidth: "520px",
    maxHeight: "92vh", overflowY: "auto",
    animation: "topicSlideUp 0.3s cubic-bezier(0.32,0.72,0,1) forwards",
  };

  return (
    <>
      <style>{`@keyframes topicSlideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={sheet}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "28px", marginBottom: "4px" }}>{subject.icon || "📚"}</div>
              <h2 style={{ color: "#e8eaf6", fontSize: "20px", fontWeight: 800, margin: "0 0 4px" }}>{subject.label}</h2>
              {subject.description && (
                <p style={{ color: "#7b82b8", fontSize: "13px", margin: 0 }}>{subject.description}</p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {onOpenHub && (
                <button
                  onClick={() => { onClose(); onOpenHub(subject.id); }}
                  title="Open full study hub"
                  style={{
                    padding: "7px 14px", background: "#0f1535",
                    border: "0.5px solid #B8860B", borderRadius: "10px",
                    color: "#7986cb", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Full Hub →
                </button>
              )}
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#7b82b8", fontSize: "24px", cursor: "pointer", padding: "4px" }}>×</button>
            </div>
          </div>

          {/* Mastery hero card */}
          <div style={{
            background: lvlBg, border: `0.5px solid ${lvlColor}33`,
            borderRadius: "14px", padding: "16px 20px", marginBottom: "20px",
            display: "flex", alignItems: "center", gap: "16px",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                border: `3px solid ${lvlColor}`, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "20px", fontWeight: 800,
                color: lvlColor, background: "#0A0D13",
              }}>
                {pct}%
              </div>
            </div>
            <div>
              <div style={{ color: lvlColor, fontWeight: 700, fontSize: "15px" }}>{lvlLabel}</div>
              <div style={{ color: "#7b82b8", fontSize: "13px" }}>
                {subject.questions?.length || 0} total questions
              </div>
            </div>
            <button
              onClick={() => openPicker(null, "All Topics", subject.questions?.length || 0)}
              style={{
                marginLeft: "auto", padding: "10px 18px", background: "#1a1a1a",
                border: "none", borderRadius: "10px", color: "#e8eaf6",
                fontWeight: 600, fontSize: "14px", cursor: "pointer",
              }}
            >
              Practice All
            </button>
          </div>

          {/* Topic list */}
          <div style={{ color: "#7b82b8", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", marginBottom: "10px", textTransform: "uppercase" }}>
            Topics
          </div>

          {loading && (
            <div style={{ color: "#4a5080", textAlign: "center", padding: "24px" }}>Loading topics…</div>
          )}

          {!loading && displayTopics.length === 0 && (
            <div style={{ color: "#4a5080", textAlign: "center", padding: "24px", fontSize: "14px" }}>
              No topics defined yet. Use "Practice All" to study the full course.
            </div>
          )}

          {!loading && displayTopics.map((t, i) => (
            <div key={t.id || t.name} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 16px", borderRadius: "12px", marginBottom: "8px",
              background: "#0a0b18", border: "0.5px solid #1e2245",
              cursor: "pointer",
            }}
              onClick={() => openPicker(t.id, t.name, t.questionCount)}
            >
              <span style={{ fontSize: "20px" }}>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e8eaf6", fontWeight: 600, fontSize: "14px" }}>{t.name}</div>
                <div style={{ color: "#4a5080", fontSize: "12px" }}>{t.questionCount} question{t.questionCount !== 1 ? "s" : ""}</div>
              </div>
              <span style={{ color: "#B8860B", fontSize: "18px" }}>›</span>
            </div>
          ))}
        </div>
      </div>

      {pickerOpen && pickerContext && (
        <QuestionCountPicker
          subjectLabel={subject.label}
          topicName={pickerContext.topicName}
          maxCount={pickerContext.maxCount}
          onClose={() => setPickerOpen(false)}
          onStart={(count) => {
            setPickerOpen(false);
            onClose();
            onStartPractice(subject.id, pickerContext.topicId, count);
          }}
        />
      )}
    </>
  );
}

export function QuestionCountPicker({ subjectLabel, topicName, maxCount, onClose, onStart }) {
  const presets = [5, 10, 20, 30].filter((n) => n <= maxCount);
  if (!presets.includes(maxCount) && maxCount > 0) presets.push(maxCount);

  const [selected, setSelected] = useState(presets[0] || maxCount);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const finalCount = useCustom ? Math.min(Math.max(1, parseInt(custom) || 1), maxCount) : selected;

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(7,8,15,0.92)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
  };
  const card = {
    background: "#0d0f20", borderRadius: "20px", border: "0.5px solid #1e2245",
    padding: "28px 24px", width: "100%", maxWidth: "380px",
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <h3 style={{ color: "#e8eaf6", fontSize: "17px", fontWeight: 700, margin: "0 0 4px" }}>
          {subjectLabel}
        </h3>
        <p style={{ color: "#7b82b8", fontSize: "13px", margin: "0 0 20px" }}>
          {topicName} · {maxCount} available
        </p>

        <div style={{ color: "#7b82b8", fontSize: "12px", fontWeight: 600, marginBottom: "10px", textTransform: "uppercase" }}>
          Number of Questions
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
          {presets.map((n) => (
            <button
              key={n}
              onClick={() => { setSelected(n); setUseCustom(false); }}
              style={{
                padding: "10px 18px", borderRadius: "10px", cursor: "pointer",
                border: (!useCustom && selected === n) ? "1.5px solid #B8860B" : "0.5px solid #1e2245",
                background: (!useCustom && selected === n) ? "#0f1535" : "#0a0b18",
                color: (!useCustom && selected === n) ? "#7986cb" : "#7b82b8",
                fontWeight: 700, fontSize: "15px",
              }}
            >
              {n === maxCount && !presets.slice(0, -1).includes(n) ? `All (${n})` : n}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div style={{ marginBottom: "20px" }}>
          <input
            type="number"
            min={1}
            max={maxCount}
            placeholder={`Custom (1–${maxCount})`}
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setUseCustom(true); }}
            onFocus={() => setUseCustom(true)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: "10px",
              background: useCustom ? "#0f1535" : "#0a0b18",
              border: useCustom ? "1.5px solid #B8860B" : "0.5px solid #1e2245",
              color: "#e8eaf6", fontSize: "15px", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "13px", background: "#0a0b18", color: "#7b82b8",
            border: "0.5px solid #1e2245", borderRadius: "12px", cursor: "pointer", fontSize: "14px",
          }}>
            Cancel
          </button>
          <button
            onClick={() => finalCount > 0 && onStart(finalCount)}
            disabled={finalCount <= 0 || finalCount > maxCount}
            style={{
              flex: 2, padding: "13px", background: "#1a1a1a", color: "#e8eaf6",
              border: "none", borderRadius: "12px", fontWeight: 700, fontSize: "15px",
              cursor: finalCount > 0 ? "pointer" : "default",
            }}
          >
            Start Practice — {finalCount} question{finalCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
