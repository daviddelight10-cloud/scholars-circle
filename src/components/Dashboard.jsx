import { useState, useEffect, useMemo, useCallback } from "react";
import { T, FONTS, RADIUS, subjectColor } from "../lib/theme";
import { useUserData } from "../contexts/UserDataContext";
import NotificationBellImproved from "../features/NotificationBellImproved";
import DailyReview from "../features/research-hub/DailyReview.jsx";
import RetentionDashboard from "../features/research-hub/RetentionDashboard.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authData.authToken}`,
    };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function computeSubjectMastery(subjects, srData) {
  const map = {};
  for (const s of subjects) {
    if (!s.questions || s.questions.length === 0) continue;
    if (!map[s.id]) map[s.id] = { subjectId: s.id, subjectLabel: s.label, icon: s.icon, total: 0, mastered: 0, learning: 0, fresh: 0 };
    s.questions.forEach((_, i) => {
      const key = `${s.id}-${i}`;
      const card = srData[key];
      map[s.id].total += 1;
      if (!card) map[s.id].fresh += 1;
      else if (card.interval >= 7) map[s.id].mastered += 1;
      else map[s.id].learning += 1;
    });
  }
  return Object.values(map).sort((a, b) => a.subjectLabel.localeCompare(b.subjectLabel));
}

function RingCard({ entry, onClick }) {
  const { subjectId, subjectLabel, icon, total, mastered, learning, fresh } = entry;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const color = subjectColor(subjectLabel);
  const r = 38, cx = 48, cy = 48;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * pct / 100);
  const nodeR = 50;

  const dots = [];
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
    const nx = cx + nodeR * Math.cos(angle);
    const ny = cy + nodeR * Math.sin(angle);
    let fill = "transparent", stroke = "rgba(255,255,255,0.25)", opacity = 1;
    if (i < mastered) { fill = color; stroke = color; }
    else if (i < mastered + learning) { fill = color; stroke = color; opacity = 0.4; }
    dots.push(
      <circle key={i} cx={nx} cy={ny} r={3.4} fill={fill} stroke={stroke} strokeWidth={1.4} opacity={opacity} />
    );
  }

  return (
    <div
      className="dash-ring-card"
      onClick={onClick}
      style={{
        background: T.inkCard, border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
        padding: "22px 18px", display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", cursor: "pointer", transition: "border-color 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.lineStrong; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint, letterSpacing: "0.04em" }}>
        {icon} {subjectLabel}
      </span>
      <div style={{ width: 96, height: 96, margin: "12px 0 10px", position: "relative" }}>
        <svg viewBox="0 0 96 96" width={96} height={96}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={6} />
          <circle
            cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)" }}
          />
          {dots}
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONTS.display, fontWeight: 800, fontSize: "1.4rem", color: T.text,
        }}>
          {pct}%
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, fontSize: "0.7rem", fontFamily: FONTS.mono, color: T.textFaint }}>
        <span style={{ color }}>{mastered} mastered</span>
        <span>·</span>
        <span>{learning} learning</span>
        <span>·</span>
        <span>{fresh} new</span>
      </div>
    </div>
  );
}

function ResumeCard({ lastActivity, mastery, subjects, onResume, hasHistory }) {
  if (!lastActivity) {
    const isNewUser = !hasHistory;
    return (
      <div style={{
        background: `linear-gradient(135deg, ${T.inkCard}, ${T.inkCard2})`,
        border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
        padding: 30, display: "flex", alignItems: "center", gap: 28, position: "relative", overflow: "hidden",
      }}>
        <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {isNewUser ? "Get started" : "Welcome back"}
          </span>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.3rem", fontWeight: 800, margin: "7px 0 6px", color: T.text }}>
            {isNewUser ? "Start your first practice set" : "Pick up where you left off"}
          </h2>
          <p style={{ color: T.textDim, fontSize: "0.92rem" }}>
            {isNewUser
              ? "Open Research Hub and try a quiz to begin your spaced repetition journey."
              : "Open Research Hub to continue studying, review due cards, or explore new resources."}
          </p>
          <button
            onClick={onResume}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16,
              padding: "11px 20px", borderRadius: 999, fontWeight: 700, fontSize: "0.88rem",
              background: T.gold, color: "#1A1300", border: "none", cursor: "pointer",
              transition: "transform 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            Go to Research Hub →
          </button>
        </div>
      </div>
    );
  }

  const subject = subjects.find((s) => s.id === lastActivity.subjectId || s.label === lastActivity.subjectId);
  const pct = subject ? Math.round(mastery[subject.id] || 0) : 0;
  const circumference = 283;
  const offset = circumference - (circumference * pct / 100);

  return (
    <div className="dash-resume-card" style={{
      background: `linear-gradient(135deg, ${T.inkCard}, ${T.inkCard2})`,
      border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
      padding: 30, display: "flex", alignItems: "center", gap: 28, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 100% 0%, rgba(79,142,247,0.14), transparent 60%)",
        pointerEvents: "none",
      }} />
      <div className="dash-resume-ring" style={{ position: "relative", width: 108, height: 108, flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width={108} height={108} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id="gradResume" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={T.blue} />
              <stop offset="100%" stopColor={T.gold} />
            </linearGradient>
          </defs>
          <circle cx={50} cy={50} r={45} fill="none" stroke={T.line} strokeWidth={7} />
          <circle
            cx={50} cy={50} r={45} fill="none" stroke="url(#gradResume)" strokeWidth={7}
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONTS.display, fontWeight: 800, fontSize: "1.1rem", color: T.text,
        }}>
          {pct}%
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Continue your circle
        </span>
        <h2 style={{ fontFamily: FONTS.display, fontSize: "1.3rem", fontWeight: 800, margin: "7px 0 6px", color: T.text }}>
          {lastActivity.resourceTitle}
        </h2>
        <p style={{ color: T.textDim, fontSize: "0.92rem" }}>Pick up right where you left off.</p>
        <button
          onClick={onResume}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16,
            padding: "11px 20px", borderRadius: 999, fontWeight: 700, fontSize: "0.88rem",
            background: T.gold, color: "#1A1300", border: "none", cursor: "pointer",
            transition: "transform 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
        >
          Resume →
        </button>
      </div>
    </div>
  );
}

function DueCard({ sm2DueCount, fsrsDueCount, onReviewQuestions, onReviewReadings }) {
  const totalDue = sm2DueCount + fsrsDueCount;
  const qLabel = `${sm2DueCount} question${sm2DueCount !== 1 ? "s" : ""}`;
  const rLabel = `${fsrsDueCount} reading${fsrsDueCount !== 1 ? "s" : ""}`;

  return (
    <div className="dash-due-card" style={{
      background: T.inkCard, border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
      padding: 26, display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Spaced Repetition
          </span>
        </div>
        <h2 style={{ fontFamily: FONTS.display, fontSize: "1.3rem", fontWeight: 800, marginTop: 10, lineHeight: 1.3, color: T.text }}>
          {totalDue > 0 ? `${totalDue} item${totalDue !== 1 ? "s" : ""} due` : "Nothing due right now"}
        </h2>
        <span style={{ display: "block", fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint, marginTop: 6 }}>
          {totalDue > 0 ? `${qLabel} · ${rLabel}` : "All caught up — great job!"}
        </span>
      </div>
      <div style={{ marginTop: 18 }}>
        <button
          onClick={onReviewQuestions}
          disabled={sm2DueCount === 0}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 20px", borderRadius: 999, fontWeight: 700, fontSize: "0.88rem",
            background: "transparent", border: `1px solid ${T.lineStrong}`, color: T.text,
            cursor: sm2DueCount === 0 ? "default" : "pointer", marginBottom: 8,
            opacity: sm2DueCount === 0 ? 0.4 : 1, transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => { if (sm2DueCount > 0) e.currentTarget.style.borderColor = T.textDim; }}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = T.lineStrong}
        >
          Review questions →
        </button>
        <button
          onClick={onReviewReadings}
          disabled={fsrsDueCount === 0}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 20px", borderRadius: 999, fontWeight: 700, fontSize: "0.88rem",
            background: "transparent", border: `1px solid ${T.lineStrong}`, color: T.text,
            cursor: fsrsDueCount === 0 ? "default" : "pointer",
            opacity: fsrsDueCount === 0 ? 0.4 : 1, transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => { if (fsrsDueCount > 0) e.currentTarget.style.borderColor = T.textDim; }}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = T.lineStrong}
        >
          Review readings →
        </button>
      </div>
    </div>
  );
}

function AskCard({ onOpenAI }) {
  const [input, setInput] = useState("");
  const chips = ["Explain the brachial plexus", "Quiz me on GST 115", "Summarise today's PHY 111 slide"];

  return (
    <div className="dash-ask-card" style={{
      background: `linear-gradient(135deg, rgba(79,142,247,0.07), ${T.inkCard})`,
      border: `1px solid ${T.line}`, borderRadius: RADIUS.lg, padding: 30,
      display: "flex", flexDirection: "column", gap: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: `conic-gradient(from 0deg, ${T.blue}, ${T.gold}, ${T.blue})`,
          animation: "spin-slow 6s linear infinite",
        }} />
        <div>
          <h3 style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 800, color: T.text }}>
            Ask the Circle
          </h3>
          <p style={{ fontSize: "0.84rem", color: T.textFaint, marginTop: 2 }}>
            Your AI tutor — grounded in your own course material.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) onOpenAI(input); }}
          placeholder="What do you want explained today?"
          style={{
            flex: 1, background: T.inkSoft, border: `1px solid ${T.lineStrong}`, borderRadius: 999,
            padding: "13px 18px", color: T.text, fontSize: "0.92rem", outline: "none",
            fontFamily: FONTS.body,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.blueDim}`; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = T.lineStrong; e.currentTarget.style.boxShadow = "none"; }}
        />
        <button
          onClick={() => input.trim() && onOpenAI(input)}
          aria-label="Send"
          style={{
            width: 46, height: 46, borderRadius: "50%", background: T.gold, border: "none",
            color: "#1A1300", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            cursor: "pointer",
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
          </svg>
        </button>
      </div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => onOpenAI(chip)}
            style={{
              fontFamily: FONTS.mono, fontSize: "0.78rem", color: T.textDim,
              background: T.inkSoft, border: `1px solid ${T.lineStrong}`, borderRadius: 999,
              padding: "7px 13px", cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.lineStrong; e.currentTarget.style.color = T.textDim; }}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeaderboardCard({ userXp, userName, onOpenTab, onOpenLeaderboard, token }) {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchBoard() {
      try {
        const res = await fetch(`${API_BASE}/users/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBoard(Array.isArray(data) ? data.slice(0, 5) : []);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    }
    if (token) fetchBoard();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [token]);

  const myName = userName || "You";
  const ranked = [...board].sort((a, b) => (b.totalXP || b.xp || 0) - (a.totalXP || a.xp || 0));
  const top3 = ranked.slice(0, 3);

  return (
    <div
      onClick={() => onOpenLeaderboard?.()}
      style={{
        background: T.inkCard, border: `1px solid ${T.line}`, borderRadius: RADIUS.lg, padding: 24,
        cursor: "pointer", transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = T.lineStrong}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ fontFamily: FONTS.display, fontSize: "1.02rem", fontWeight: 800, color: T.text, margin: 0 }}>
          Your study circle
        </h3>
        <span style={{ fontSize: "0.78rem", color: T.blue, fontWeight: 600 }}>View →</span>
      </div>
      {loading ? (
        <div style={{ color: T.textFaint, fontSize: "0.86rem", padding: "12px 0" }}>Loading leaderboard…</div>
      ) : ranked.length === 0 ? (
        <div style={{ color: T.textFaint, fontSize: "0.86rem", padding: "12px 0" }}>
          No leaderboard data yet. Start a quiz to appear on the board!
        </div>
      ) : (
        <>
          <div style={{ display: "flex", marginBottom: 14 }}>
            {top3.map((entry, i) => (
              <div key={entry.userId || i} style={{
                width: 34, height: 34, borderRadius: "50%", border: `2px solid ${T.inkCard}`,
                background: T.inkCard2, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONTS.mono, fontSize: "0.7rem", fontWeight: 600, color: T.textDim,
                marginLeft: i === 0 ? 0 : -10,
              }}>
                {getInitials(entry.username)}
              </div>
            ))}
          </div>
          <span style={{ fontSize: "0.92rem", color: T.textDim, marginBottom: 14, display: "block" }}>
            <b style={{ color: T.text }}>{ranked.length} scholars</b> on the board this week.
          </span>
          {ranked.map((entry, i) => {
            const isMe = entry.username === myName || entry.username === userName;
            const xp = entry.totalXP || entry.xp || 0;
            return (
              <div key={entry.userId || i} style={{
                display: "flex", alignItems: "center", gap: 10, fontSize: "0.88rem",
                padding: isMe ? "8px 10px" : "4px 0",
                background: isMe ? T.goldDim : "transparent",
                borderRadius: isMe ? RADIUS.sm : 0,
                margin: isMe ? "0 -10px" : 0,
              }}>
                <span style={{ fontFamily: FONTS.mono, color: isMe ? T.gold : T.textFaint, width: 18, fontWeight: isMe ? 700 : 400 }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: isMe ? 700 : 400, color: T.text }}>{isMe ? "You" : entry.username}</span>
                <span style={{ fontFamily: FONTS.mono, color: isMe ? T.gold : T.textFaint, fontSize: "0.82rem", fontWeight: isMe ? 600 : 400 }}>{xp.toLocaleString()} XP</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function timeUntilDue(dueAt) {
  if (!dueAt) return "";
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return "Overdue";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${mins}m`;
}

function AssignmentsCard({ onOpenTab, token }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchAssignments() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const clsRes = await fetch(`${API_BASE}/classroom/my`, { headers });
        if (!clsRes.ok) { if (!cancelled) setLoading(false); return; }
        const classrooms = await clsRes.json();
        if (!Array.isArray(classrooms) || classrooms.length === 0) { if (!cancelled) setLoading(false); return; }
        const allAssignments = [];
        for (const c of classrooms.slice(0, 5)) {
          try {
            const aRes = await fetch(`${API_BASE}/classroom-assignments/classroom/${c.id}`, { headers });
            if (aRes.ok) {
              const items = await aRes.json();
              if (Array.isArray(items)) {
                items.forEach((a) => allAssignments.push({ ...a, classroomName: c.name }));
              }
            }
          } catch {}
        }
        if (!cancelled) {
          allAssignments.sort((a, b) => new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime());
          setAssignments(allAssignments.slice(0, 4));
        }
      } catch {}
      if (!cancelled) setLoading(false);
    }
    if (token) fetchAssignments();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div
      onClick={() => onOpenTab?.("classroom")}
      style={{
        background: T.inkCard, border: `1px solid ${T.line}`, borderRadius: RADIUS.lg, padding: 24,
        cursor: "pointer", transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = T.lineStrong}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ fontFamily: FONTS.display, fontSize: "1.02rem", fontWeight: 800, color: T.text, margin: 0 }}>
          Upcoming
        </h3>
        <span style={{ fontSize: "0.78rem", color: T.blue, fontWeight: 600 }}>View all →</span>
      </div>
      {loading ? (
        <div style={{ color: T.textFaint, fontSize: "0.86rem", padding: "12px 0" }}>Loading assignments…</div>
      ) : assignments.length === 0 ? (
        <div style={{ color: T.textFaint, fontSize: "0.86rem", padding: "12px 0" }}>
          No upcoming assignments. Join a classroom to see them here.
        </div>
      ) : (
        assignments.map((a, i) => {
          const due = timeUntilDue(a.dueAt);
          const isOverdue = due === "Overdue";
          const isSoon = !isOverdue && (due.endsWith("h") || due.endsWith("m"));
          const color = isOverdue ? T.coral : isSoon ? T.gold : T.blue;
          const bgColor = isOverdue ? T.coralDim : isSoon ? T.goldDim : T.blueDim;
          return (
            <div key={a.id || i} style={{
              display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: RADIUS.sm,
              background: T.inkSoft, border: `1px solid ${T.line}`, marginBottom: i < assignments.length - 1 ? 10 : 0,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONTS.mono, fontSize: "0.65rem", fontWeight: 700,
                background: bgColor, color,
              }}>{due || "—"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                {a.classroomName && (
                  <div style={{ fontSize: "0.76rem", color: T.textFaint, marginTop: 2 }}>{a.classroomName}</div>
                )}
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: "0.76rem", color: T.textFaint, flexShrink: 0 }}>
                {a.dueAt ? new Date(a.dueAt).toLocaleDateString("en", { weekday: "short" }) : ""}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function StudyBitesRow({ sm2DueCount, fsrsDueCount, weakest, onReviewQuestions, onReviewReadings, onBoostSubject, onBrowseDept, onAskAI }) {
  const totalDue = sm2DueCount + fsrsDueCount;
  const bites = [];
  if (totalDue > 0) {
    bites.push({ icon: "🧠", label: `Review ${totalDue} item${totalDue !== 1 ? "s" : ""}`, subtitle: "Spaced repetition", color: T.green, bg: T.greenDim, onClick: onReviewQuestions });
  }
  if (fsrsDueCount > 0) {
    bites.push({ icon: "📄", label: `Review ${fsrsDueCount} reading${fsrsDueCount !== 1 ? "s" : ""}`, subtitle: "FSRS due", color: T.gold, bg: T.goldDim, onClick: onReviewReadings });
  }
  if (weakest && weakest.mastery < 50) {
    bites.push({ icon: "🎯", label: `Boost ${weakest.label}`, subtitle: `${weakest.mastery}% mastery`, color: T.coral, bg: T.coralDim, onClick: onBoostSubject });
  }
  bites.push({ icon: "🎓", label: "My Department", subtitle: "Browse materials", color: T.gold, bg: T.goldDim, onClick: onBrowseDept });
  bites.push({ icon: "✨", label: "Ask AI", subtitle: "Get help now", color: T.blue, bg: T.blueDim, onClick: onAskAI });
  if (bites.length === 0) return null;
  return (
    <div className="dash-bites-row" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginTop: 4, scrollbarWidth: "none" }}>
      {bites.map((bite, i) => (
        <div key={i} className="dash-bite-card" onClick={bite.onClick} style={{
          flexShrink: 0, minWidth: 160, background: bite.bg, border: `1px solid ${T.line}`,
          borderRadius: RADIUS.lg, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
          display: "flex", alignItems: "center", gap: 12,
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = T.lineStrong}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>{bite.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bite.label}</div>
            <div style={{ fontSize: "0.76rem", color: T.textFaint, marginTop: 2 }}>{bite.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickAccessGrid({ deptCount, savedCount, uploadCount, publicCount, onOpenDept, onOpenSpace, onOpenPublic }) {
  const cards = [
    { icon: "🎓", label: "My Department", subtitle: `${deptCount} material${deptCount !== 1 ? "s" : ""}`, onClick: onOpenDept, color: T.gold },
    { icon: "📁", label: "My Space", subtitle: `${savedCount} saved · ${uploadCount} uploads`, onClick: onOpenSpace, color: T.blue },
    { icon: "🌐", label: "Public", subtitle: `${publicCount} resources`, onClick: onOpenPublic, color: T.green },
  ];
  return (
    <div className="dash-quick-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 32 }}>
      {cards.map((c) => (
        <div key={c.label} onClick={c.onClick} style={{
          background: T.inkCard, border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
          padding: "22px 18px", cursor: "pointer", transition: "border-color 0.2s, transform 0.2s",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.lineStrong; e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.transform = "translateY(0)"; }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
          <div style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 800, color: T.text }}>{c.label}</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.76rem", color: c.color, marginTop: 6 }}>{c.subtitle}</div>
        </div>
      ))}
    </div>
  );
}

function ForYouPreview({ items, onOpenAll, onOpenItem }) {
  if (!items || items.length === 0) return null;
  const typeIcon = (t) => t === "pdf" ? "📄" : t === "mcq" ? "📝" : t === "note" ? "🗒️" : t === "tutorial_question" ? "❓" : "📎";
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 800, color: T.text, margin: 0 }}>For you</h3>
        <button onClick={onOpenAll} style={{ fontSize: "0.84rem", color: T.blue, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View all →</button>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
        {items.map((r) => (
          <div key={r.id} onClick={() => onOpenItem?.(r.shareToken)} style={{
            flexShrink: 0, width: 200, background: T.inkCard, border: `1px solid ${T.line}`,
            borderRadius: RADIUS.md, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = T.lineStrong}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.74rem", color: T.textFaint }}>
              <span>{typeIcon(r.contentType)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyReviewCard({ fsrsStats, onStart }) {
  const dueCount = fsrsStats?.dueCount || 0;
  const dailyGoal = fsrsStats?.dailyGoal || 20;
  const learningCount = fsrsStats?.learningCount || 0;
  const masteredCount = fsrsStats?.masteredCount || 0;
  const totalItems = fsrsStats?.totalItems || 0;
  const streak = fsrsStats?.streak || 0;
  const goalPct = dailyGoal > 0 ? Math.min(100, Math.round((Math.min(dueCount, dailyGoal) / dailyGoal) * 100)) : 0;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.inkCard}, ${T.inkCard2})`,
      border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
      padding: 28, display: "flex", flexDirection: "column", gap: 18,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 180, height: 180,
        background: "radial-gradient(circle at 100% 0%, rgba(79,142,247,0.10), transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🧠</span>
          <span style={{
            fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            FSRS Daily Review
          </span>
        </div>
        <h2 style={{
          fontFamily: FONTS.display, fontSize: "1.3rem", fontWeight: 800,
          margin: "6px 0 4px", color: dueCount > 0 ? T.text : T.textDim,
        }}>
          {dueCount > 0 ? `${dueCount} item${dueCount !== 1 ? "s" : ""} due` : "All caught up!"}
        </h2>
        <p style={{ fontSize: "0.84rem", color: T.textDim, margin: 0 }}>
          {dueCount > 0
            ? `Interleaved pages, flashcards & MCQs — goal: ${dailyGoal}/day`
            : "Come back later or study new material to build your queue."}
        </p>
      </div>

      {/* Progress bar toward daily goal */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint }}>
            Daily goal progress
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: dueCount > 0 ? T.blue : T.textFaint }}>
            {Math.min(dueCount, dailyGoal)}/{dailyGoal}
          </span>
        </div>
        <div style={{ height: 8, background: T.inkSoft, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${goalPct}%`,
            background: dueCount > 0
              ? `linear-gradient(90deg, ${T.blue}, ${T.gold})`
              : `linear-gradient(90deg, #22c55e, #4caf50)`,
            borderRadius: 4, transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Mini stats row */}
      <div style={{ display: "flex", gap: 16, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 800, color: "#f59e0b" }}>{learningCount}</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Learning</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 800, color: "#22c55e" }}>{masteredCount}</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Mastered</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 800, color: T.gold }}>{totalItems}</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Total</div>
        </div>
        {streak > 0 && (
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 800, color: T.coral }}>{streak}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Streak</div>
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        disabled={dueCount === 0}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 24px", borderRadius: 999, fontWeight: 700, fontSize: "0.92rem",
          background: dueCount > 0 ? T.gold : T.inkSoft,
          color: dueCount > 0 ? "#1A1300" : T.textFaint,
          border: "none", cursor: dueCount > 0 ? "pointer" : "default",
          transition: "transform 0.15s", position: "relative", zIndex: 1,
          opacity: dueCount === 0 ? 0.5 : 1,
        }}
        onMouseEnter={(e) => { if (dueCount > 0) e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
      >
        {dueCount > 0 ? "Start Daily Review →" : "No items due now"}
      </button>
    </div>
  );
}

function RetentionSummaryCard({ fsrsStats, fsrsAnalytics, onViewAnalytics }) {
  const totalItems = fsrsStats?.totalItems || 0;
  const masteredCount = fsrsStats?.masteredCount || 0;
  const avgRetrievability = fsrsStats?.avgRetrievability || 0;
  const streak = fsrsStats?.streak || 0;
  const longestStreak = fsrsStats?.longestStreak || 0;
  const masteryPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;
  const retentionPct = Math.round(avgRetrievability * 100);

  const dailyReviews = fsrsAnalytics?.dailyReviews || {};
  const maxDaily = Math.max(1, ...Object.values(dailyReviews));
  const heatmapDays = Object.entries(dailyReviews).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);

  function heatColor(count) {
    if (count === 0) return T.inkSoft;
    const intensity = count / maxDaily;
    if (intensity < 0.25) return "#0f2a1a";
    if (intensity < 0.5) return "#1a4a1a";
    if (intensity < 0.75) return "#2a6a2a";
    return "#22c55e";
  }

  return (
    <div style={{
      background: T.inkCard, border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
      padding: 28, display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>📊</span>
        <span style={{
          fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint,
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          Retention Analytics
        </span>
      </div>

      {/* Key metrics */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center", minWidth: 60 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 800, color: "#7986cb" }}>{retentionPct}%</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Retention</div>
        </div>
        <div style={{ textAlign: "center", minWidth: 60 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 800, color: "#22c55e" }}>{masteryPct}%</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Mastery</div>
        </div>
        <div style={{ textAlign: "center", minWidth: 60 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 800, color: T.coral }}>{streak}</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Streak</div>
        </div>
        <div style={{ textAlign: "center", minWidth: 60 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 800, color: T.gold }}>{longestStreak}</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginTop: 2 }}>Best</div>
        </div>
      </div>

      {/* Mastery progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint }}>Overall mastery</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: "0.72rem", color: "#22c55e" }}>{masteredCount}/{totalItems}</span>
        </div>
        <div style={{ height: 8, background: T.inkSoft, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${masteryPct}%`,
            background: "linear-gradient(90deg, #22c55e, #4caf50)",
            borderRadius: 4, transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Mini heatmap */}
      {heatmapDays.length > 0 && (
        <div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "0.68rem", color: T.textFaint, marginBottom: 6 }}>
            Study activity (30 days)
          </div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {heatmapDays.map(([date, count]) => (
              <div key={date} title={`${date}: ${count} reviews`} style={{
                width: 11, height: 11, borderRadius: 2,
                background: heatColor(count),
                border: count > 0 ? "none" : `0.5px solid ${T.line}`,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* View analytics button */}
      <button
        onClick={onViewAnalytics}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "11px 20px", borderRadius: 999, fontWeight: 700, fontSize: "0.86rem",
          background: "transparent", border: `1px solid ${T.lineStrong}`, color: T.text,
          cursor: "pointer", transition: "border-color 0.15s", marginTop: "auto",
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = T.textDim}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = T.lineStrong}
      >
        View full analytics →
      </button>
    </div>
  );
}

export default function Dashboard({
  userName,
  stats,
  subjects,
  mastery,
  dueCards,
  history,
  onStartSpaced,
  onStartSubject,
  onOpenTab,
  onOpenLeaderboard,
  onOpenAI,
  onOpenLearn,
  onOpenStudy,
  onOpenResource,
  token,
  authUser,
}) {
  const { lastActivity, srData } = useUserData();
  const [fsrsStats, setFsrsStats] = useState(null);
  const [fsrsAnalytics, setFsrsAnalytics] = useState(null);
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [showRetention, setShowRetention] = useState(false);

  const fetchFsrsStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsStats(await res.json());
    } catch {}
  }, []);

  const fetchFsrsAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/analytics?days=30`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsAnalytics(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchFsrsStats();
    fetchFsrsAnalytics();
  }, [fetchFsrsStats, fetchFsrsAnalytics]);

  const [resourceCounts, setResourceCounts] = useState({ dept: 0, public: 0, saved: 0, uploads: 0 });
  const [forYouPreview, setForYouPreview] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchHubData() {
      try {
        const headers = getAuthHeaders();
        let resources = [];
        try {
          const cached = localStorage.getItem("sc_resources_list");
          if (cached) resources = JSON.parse(cached).data || [];
        } catch {}
        if (resources.length === 0) {
          const res = await fetch(`${API_BASE}/api/resources`, { headers });
          if (res.ok) resources = await res.json();
        }
        let dept = null;
        try {
          const deptRes = await fetch(`${API_BASE}/users/me/department`, { headers });
          if (deptRes.ok) dept = await deptRes.json();
        } catch {}
        let saved = 0;
        try {
          const bmRes = await fetch(`${API_BASE}/api/resources/bookmarks`, { headers });
          if (bmRes.ok) saved = (await bmRes.json()).length;
        } catch {}
        let uploads = 0;
        try {
          const upRes = await fetch(`${API_BASE}/api/resources/teacher/my`, { headers });
          if (upRes.ok) uploads = (await upRes.json()).length;
        } catch {}
        if (cancelled) return;
        const deptResources = dept?.department
          ? resources.filter((r) => r.department === dept.department || (r.resourceDepts?.some((rd) => rd.department.name === dept.department)))
          : [];
        const forYou = deptResources
          .filter((r) => r.uploader?.role !== "STUDENT")
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 4);
        setResourceCounts({ dept: deptResources.length, public: resources.length, saved, uploads });
        setForYouPreview(forYou);
      } catch {}
    }
    fetchHubData();
    return () => { cancelled = true; };
  }, []);

  const subjectMastery = useMemo(() => computeSubjectMastery(subjects || [], srData || {}), [subjects, srData]);
  const fsrsDueCount = fsrsStats?.dueCount || 0;
  const sm2DueCount = dueCards?.length || 0;

  const weakest = useMemo(() => {
    if (!subjectMastery.length) return null;
    return subjectMastery.reduce((min, s) => {
      const m = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
      return !min || m < min.mastery ? { label: s.subjectLabel, icon: s.icon, id: s.subjectId, mastery: m } : min;
    }, null);
  }, [subjectMastery]);

  const handleResume = useCallback(() => {
    onOpenTab?.("research-hub");
  }, [onOpenTab]);

  const openResearchHub = useCallback((tab, subTab) => {
    window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail: { tab, subTab } }));
  }, []);

  const handleReviewReadings = useCallback(async () => {
    if (onOpenResource) {
      try {
        const res = await fetch(`${API_BASE}/api/resources/fsrs/due?limit=1`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const firstItem = data.items?.[0];
          if (firstItem?.resource?.shareToken) {
            onOpenResource(firstItem.resource.shareToken, firstItem.pageIndex);
            return;
          }
        }
      } catch {}
    }
    onOpenTab?.("research-hub");
  }, [onOpenTab, onOpenResource]);

  const handleOpenAI = useCallback((topic) => {
    onOpenAI?.(topic);
  }, [onOpenAI]);

  const greeting = `Good ${greetingWord()}`;
  const initials = getInitials(userName || authUser?.username || authUser?.name);

  return (
    <div style={{ fontFamily: FONTS.body, color: T.text, maxWidth: 1180, margin: "0 auto", padding: "0 0 80px" }}>
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .dash-hero-row { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
        .dash-ring-wall { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .dash-lower-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .dash-resume-card { display: flex; align-items: center; gap: 28px; }
        .dash-resume-ring { width: 108px; height: 108px; flexShrink: 0; }
        .dash-topbar-actions { display: flex; align-items: center; gap: 12px; }
        @media (max-width: 768px) {
          .dash-hero-row { grid-template-columns: 1fr !important; }
          .dash-ring-wall { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .dash-lower-grid { grid-template-columns: 1fr !important; }
          .dash-fsrs-grid { grid-template-columns: 1fr !important; }
          .dash-resume-card { flex-direction: column !important; gap: 16px !important; text-align: center !important; padding: 22px 16px !important; }
          .dash-resume-ring { width: 80px !important; height: 80px !important; }
          .dash-topbar-actions { gap: 8px !important; }
        }
        @media (max-width: 420px) {
          .dash-ring-wall { grid-template-columns: 1fr !important; }
          .dash-topbar-actions .dash-pill { padding: 5px 9px !important; font-size: 0.72rem !important; }
        }
        .dash-bites-row::-webkit-scrollbar { display: none; }
        .dash-bite-card { flexShrink: 0; min-width: 160px; }
        .dash-quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 768px) {
          .dash-ask-card { padding: 20px 16px !important; }
          .dash-due-card { padding: 18px 16px !important; }
          .dash-ring-card { padding: 16px 12px !important; }
          .dash-quick-grid { grid-template-columns: 1fr !important; }
          .dash-bite-card { min-width: 140px !important; }
        }
      `}</style>

      {/* Topbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 0", flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 800, margin: 0, color: T.text }}>
            {greeting}, {userName || "Scholar"}
          </h1>
          <p style={{ fontSize: "0.86rem", color: T.textDim, marginTop: 3 }}>
            {(stats?.streak || 0) > 0
              ? `${stats.streak}-day streak. Don't break it today.`
              : "Start a review today to begin your streak."}
          </p>
        </div>
        <div className="dash-topbar-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="dash-pill" style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999,
            background: T.inkCard, border: `1px solid ${T.lineStrong}`,
            fontFamily: FONTS.mono, fontSize: "0.8rem", fontWeight: 600, color: T.coral,
          }}>
            🔥 {stats?.streak || 0}
          </div>
          <div className="dash-pill" style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999,
            background: T.inkCard, border: `1px solid ${T.lineStrong}`,
            fontFamily: FONTS.mono, fontSize: "0.8rem", fontWeight: 600, color: T.gold,
          }}>
            ⚡ {stats?.xp || 0} XP
          </div>
          <NotificationBellImproved token={token} currentUser={authUser} onOpenTab={onOpenTab} />
          <div
            onClick={() => onOpenTab?.("profile")}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: `linear-gradient(135deg, ${T.blue}, ${T.gold})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONTS.mono, fontWeight: 700, fontSize: "0.82rem", color: "#0A0D13",
              cursor: "pointer", transition: "transform 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            title="View profile"
          >
            {initials}
          </div>
        </div>
      </div>

      {/* Study Bites */}
      <StudyBitesRow
        sm2DueCount={sm2DueCount}
        fsrsDueCount={fsrsDueCount}
        weakest={weakest}
        onReviewQuestions={onStartSpaced}
        onReviewReadings={handleReviewReadings}
        onBoostSubject={() => weakest && onStartSubject?.(weakest.id)}
        onBrowseDept={() => openResearchHub("department", "foryou")}
        onAskAI={() => handleOpenAI("")}
      />

      {/* Hero row */}
      <div className="dash-hero-row" style={{ marginTop: 8 }}>
        <ResumeCard
          lastActivity={lastActivity}
          mastery={mastery}
          subjects={subjects}
          onResume={handleResume}
          hasHistory={(history?.length || 0) > 0 || (stats?.totalReviews || 0) > 0}
        />
        <DueCard
          sm2DueCount={sm2DueCount}
          fsrsDueCount={fsrsDueCount}
          onReviewQuestions={onStartSpaced}
          onReviewReadings={handleReviewReadings}
        />
      </div>

      {/* For You preview */}
      <ForYouPreview
        items={forYouPreview}
        onOpenAll={() => openResearchHub("department", "foryou")}
        onOpenItem={(token) => onOpenResource?.(token)}
      />

      {/* Quick Access — mirrors Research Hub tabs */}
      <QuickAccessGrid
        deptCount={resourceCounts.dept}
        savedCount={resourceCounts.saved}
        uploadCount={resourceCounts.uploads}
        publicCount={resourceCounts.public}
        onOpenDept={() => openResearchHub("department", "foryou")}
        onOpenSpace={() => openResearchHub("space", "saved")}
        onOpenPublic={() => openResearchHub("public")}
      />

      {/* FSRS Daily Review + Retention Analytics */}
      <div style={{ marginTop: 46 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 800, color: T.text }}>
            Your review system
          </h3>
          <button
            onClick={() => onOpenTab?.("research-hub")}
            style={{
              fontSize: "0.84rem", color: T.blue, fontWeight: 600, background: "none", border: "none", cursor: "pointer",
            }}
          >
            Open Research Hub →
          </button>
        </div>

        <div className="dash-fsrs-grid" style={{
          display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20,
        }}>
          {/* Daily Review Card */}
          <DailyReviewCard
            fsrsStats={fsrsStats}
            onStart={() => setShowDailyReview(true)}
          />

          {/* Retention Summary Card */}
          <RetentionSummaryCard
            fsrsStats={fsrsStats}
            fsrsAnalytics={fsrsAnalytics}
            onViewAnalytics={() => setShowRetention(true)}
          />
        </div>

        {/* Subject breakdown from FSRS */}
        {fsrsStats?.bySubject && Object.keys(fsrsStats.bySubject).length > 0 && (
          <div style={{
            marginTop: 20, padding: 22, background: T.inkCard,
            border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
          }}>
            <div style={{
              fontSize: "0.78rem", fontFamily: FONTS.mono, color: T.textFaint,
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14,
            }}>
              Subject mastery (FSRS)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(fsrsStats.bySubject)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 6)
                .map(([subject, s]) => {
                  const pct = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
                  return (
                    <div key={subject} style={{
                      display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <span style={{
                        fontSize: "0.86rem", fontWeight: 600, color: T.text,
                        minWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{subject}</span>
                      <div style={{
                        flex: 1, height: 8, background: T.inkSoft, borderRadius: 4, overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: pct >= 70 ? "linear-gradient(90deg, #22c55e, #4caf50)"
                            : pct >= 40 ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                            : "linear-gradient(90deg, #ef4444, #f87171)",
                          borderRadius: 4, transition: "width 0.4s ease",
                        }} />
                      </div>
                      <span style={{
                        fontFamily: FONTS.mono, fontSize: "0.76rem", color: T.textFaint,
                        minWidth: 70, textAlign: "right",
                      }}>{s.mastered}/{s.total} · {s.due} due</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Ask the Circle */}
      <div style={{ marginTop: 46 }}>
        <AskCard onOpenAI={handleOpenAI} />
      </div>

      {/* Lower grid — leaderboard + assignments */}
      <div className="dash-lower-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 46,
      }}>
        <LeaderboardCard userXp={stats?.xp || 0} userName={userName} onOpenTab={onOpenTab} onOpenLeaderboard={onOpenLeaderboard} token={token} />
        <AssignmentsCard onOpenTab={onOpenTab} token={token} />
      </div>

      {/* Daily Review full-screen overlay */}
      {showDailyReview && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#0a0a0a",
          display: "flex", flexDirection: "column",
        }}>
          <DailyReview
            onBack={() => { setShowDailyReview(false); fetchFsrsStats(); fetchFsrsAnalytics(); }}
            onComplete={() => { fetchFsrsStats(); fetchFsrsAnalytics(); }}
          />
        </div>
      )}

      {/* Retention Dashboard full-screen overlay */}
      {showRetention && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#0a0a0a",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <RetentionDashboard
            fsrsStats={fsrsStats}
            fsrsAnalytics={fsrsAnalytics}
            onBack={() => setShowRetention(false)}
          />
        </div>
      )}
    </div>
  );
}
