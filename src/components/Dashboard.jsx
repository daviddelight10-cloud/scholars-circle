import { useState, useEffect, useMemo, useCallback } from "react";
import { T, FONTS, RADIUS, subjectColor } from "../lib/theme";
import { useUserData } from "../contexts/UserDataContext";
import NotificationBellImproved from "../features/NotificationBellImproved";

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
          {qLabel} · {rLabel} due
        </h2>
        <span style={{ display: "block", fontFamily: FONTS.mono, fontSize: "0.72rem", color: T.textFaint, marginTop: 6 }}>
          Questions use SM-2 · readings use FSRS
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
  token,
  authUser,
}) {
  const { lastActivity, srData } = useUserData();
  const [fsrsDueCount, setFsrsDueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchFsrsStats() {
      try {
        const res = await fetch(`${API_BASE}/api/resources/pdf-review/stats`, { headers: getAuthHeaders() });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setFsrsDueCount(data.dueCount || 0);
        }
      } catch {}
    }
    fetchFsrsStats();
    return () => { cancelled = true; };
  }, []);

  const subjectMastery = useMemo(() => computeSubjectMastery(subjects || [], srData || {}), [subjects, srData]);
  const sm2DueCount = dueCards?.length || 0;

  const handleResume = useCallback(() => {
    onOpenTab?.("research-hub");
  }, [onOpenTab]);

  const handleReviewReadings = useCallback(() => {
    onOpenTab?.("research-hub");
  }, [onOpenTab]);

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
          .dash-resume-card { flex-direction: column !important; gap: 16px !important; text-align: center !important; padding: 22px 16px !important; }
          .dash-resume-ring { width: 80px !important; height: 80px !important; }
          .dash-topbar-actions { gap: 8px !important; }
        }
        @media (max-width: 420px) {
          .dash-ring-wall { grid-template-columns: 1fr !important; }
          .dash-topbar-actions .dash-pill { display: none !important; }
        }
        @media (max-width: 768px) {
          .dash-ask-card { padding: 20px 16px !important; }
          .dash-due-card { padding: 18px 16px !important; }
          .dash-ring-card { padding: 16px 12px !important; }
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

      {/* Your circles — ring wall */}
      <div style={{ marginTop: 46 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 800, color: T.text }}>
            Your circles
          </h3>
          <button
            onClick={() => onOpenTab?.("research-hub")}
            style={{
              fontSize: "0.84rem", color: T.blue, fontWeight: 600, background: "none", border: "none", cursor: "pointer",
            }}
          >
            View all courses →
          </button>
        </div>
        {subjectMastery.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 18px", fontSize: "13.5px", color: T.textFaint,
            background: T.inkCard, border: `1px dashed ${T.lineStrong}`, borderRadius: 14,
          }}>
            Take a quiz in Research Hub and your subject mastery will show up here.
          </div>
        ) : (
          <div className="dash-ring-wall" style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
          }}>
            {subjectMastery.map((entry) => (
              <RingCard
                key={entry.subjectId}
                entry={entry}
                onClick={() => onStartSubject?.(entry.subjectId)}
              />
            ))}
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
    </div>
  );
}
