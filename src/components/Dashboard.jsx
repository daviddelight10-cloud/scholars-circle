import { useState, useEffect, useCallback } from "react";
import { FONTS } from "../lib/theme";
import { useUserData } from "../contexts/UserDataContext";
import { getMyProfile } from "../lib/profileApi.js";
import NotificationBellImproved from "../features/NotificationBellImproved";
import DailyReview from "../features/research-hub/DailyReview.jsx";
import TopicSkeletonCard from "./home/TopicSkeletonCard.jsx";
import TopicSkeletonView from "./home/TopicSkeletonView.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

const D = {
  ink: "#07090D",
  panel: "rgba(255,255,255,0.05)",
  panel2: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.09)",
  blue: "#4F8EF7",
  gold: "#F5A623",
  coral: "#FF5470",
  green: "#3DD68C",
  textHi: "#F5F7FB",
  textMid: "#9AA2B2",
  textLow: "#565E6E",
};

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { "Content-Type": "application/json", Authorization: `Bearer ${authData.authToken}` };
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

function HeroCard({ fsrsStats, sm2DueCount, onStartDaily, onReviewQuestions, onReviewReadings }) {
  const dueCount = fsrsStats?.dueCount || 0;
  const totalDue = dueCount + sm2DueCount;
  const dailyGoal = fsrsStats?.dailyGoal || 20;
  const masteredCount = fsrsStats?.masteredCount || 0;
  const totalItems = fsrsStats?.totalItems || 0;
  const streak = fsrsStats?.streak || 0;
  const retentionPct = Math.round((fsrsStats?.avgRetrievability || 0) * 100);
  const r = 27;
  const circumference = 2 * Math.PI * r;
  const goalPct = dailyGoal > 0 ? Math.min(100, Math.round((Math.min(dueCount, dailyGoal) / dailyGoal) * 100)) : 0;
  const offset = circumference - (circumference * goalPct / 100);

  return (
    <div style={{
      background: "linear-gradient(165deg, rgba(79,142,247,0.16) 0%, rgba(79,142,247,0.03) 45%, rgba(255,255,255,0.02) 100%)",
      border: "1px solid rgba(79,142,247,0.28)", borderRadius: 26, padding: 22,
      position: "relative", overflow: "hidden",
      boxShadow: "0 20px 50px -20px rgba(79,142,247,0.25)",
    }}>
      <div style={{ position: "absolute", top: "-40%", right: "-30%", width: 200, height: 200, background: "radial-gradient(circle, rgba(79,142,247,0.35), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.1em", color: D.blue, textTransform: "uppercase" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: D.blue, boxShadow: `0 0 8px ${D.blue}` }} />
            Spaced Repetition · FSRS
          </div>
          <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 34, marginTop: 8, letterSpacing: "-0.02em", color: D.textHi }}>
            {totalDue} <span style={{ fontSize: 13, fontWeight: 600, color: D.textMid, fontFamily: FONTS.body, letterSpacing: 0 }}>items due today</span>
          </div>
        </div>
        <div style={{ width: 64, height: 64, position: "relative", flexShrink: 0 }}>
          <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="32" cy="32" r="27" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
            <circle cx="32" cy="32" r="27" stroke={D.gold} strokeWidth="6" fill="none"
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 6px rgba(245,166,35,0.7))" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <b style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color: D.textHi }}>{Math.min(dueCount, dailyGoal)}/{dailyGoal}</b>
            <small style={{ fontSize: "7.5px", color: D.textLow, letterSpacing: "0.05em" }}>TODAY</small>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 18, position: "relative" }}>
        <div style={{ fontSize: 10, color: D.textMid, fontWeight: 500 }}>
          <strong style={{ display: "block", color: D.textHi, fontSize: 15, fontWeight: 700, fontFamily: FONTS.mono, marginBottom: 2 }}>{retentionPct}%</strong>Retention
        </div>
        <div style={{ fontSize: 10, color: D.textMid, fontWeight: 500 }}>
          <strong style={{ display: "block", color: D.textHi, fontSize: 15, fontWeight: 700, fontFamily: FONTS.mono, marginBottom: 2 }}>{masteredCount}</strong>Mastered
        </div>
        <div style={{ fontSize: 10, color: D.textMid, fontWeight: 500 }}>
          <strong style={{ display: "block", color: D.textHi, fontSize: 15, fontWeight: 700, fontFamily: FONTS.mono, marginBottom: 2 }}>{streak}</strong>Day streak
        </div>
        <div style={{ fontSize: 10, color: D.textMid, fontWeight: 500 }}>
          <strong style={{ display: "block", color: D.textHi, fontSize: 15, fontWeight: 700, fontFamily: FONTS.mono, marginBottom: 2 }}>{totalItems}</strong>Total cards
        </div>
      </div>
      <button onClick={onStartDaily} style={{
        marginTop: 18, width: "100%", background: "linear-gradient(135deg, #FFC24D, #F5A623)",
        color: "#201400", border: "none", borderRadius: 15, padding: 14,
        fontFamily: FONTS.body, fontWeight: 800, fontSize: 14, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: "0 10px 24px -8px rgba(245,166,35,0.5)", position: "relative", overflow: "hidden",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7z" fill="#201400"/></svg>
        Start Daily Review
      </button>
      <div style={{ display: "flex", gap: 8, marginTop: 9, position: "relative" }}>
        <button onClick={onReviewQuestions} style={{
          flex: 1, background: "rgba(255,255,255,0.045)", border: `1px solid ${D.border}`,
          color: D.textMid, borderRadius: 12, padding: 10, fontSize: "11.5px", fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 21c0 .6.4 1 1 1h4c.6 0 1-.4 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .6.4 1 1 1h6c.6 0 1-.4 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z" fill="currentColor"/></svg>
          Questions only
        </button>
        <button onClick={onReviewReadings} style={{
          flex: 1, background: "rgba(255,255,255,0.045)", border: `1px solid ${D.border}`,
          color: D.textMid, borderRadius: 12, padding: 10, fontSize: "11.5px", fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4h11l5 5v11a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          Readings only
        </button>
      </div>
    </div>
  );
}

function VoiceTutorCard({ onOpenVoice }) {
  return (
    <div onClick={onOpenVoice} style={{
      background: `radial-gradient(circle at 85% -10%, rgba(79,142,247,0.22), transparent 55%), linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
      border: "1px solid rgba(79,142,247,0.22)", borderRadius: 24, padding: 20,
      position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
    }}>
      <div style={{ width: 64, height: 64, flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="sc-voice-ring" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(79,142,247,0.35)" }} />
        <div className="sc-voice-ring sc-voice-ring-delay" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(79,142,247,0.35)" }} />
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "radial-gradient(circle at 32% 28%, #CFE0FF, #4F8EF7 55%, #17407a)",
          boxShadow: "0 0 0 1px rgba(79,142,247,0.25), 0 0 24px rgba(79,142,247,0.5)", position: "relative",
        }}>
          <div style={{ position: "absolute", inset: 11, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.65), transparent 70%)", opacity: 0.65 }} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 14, fontFamily: FONTS.display, fontWeight: 700, color: D.textHi, margin: 0 }}>Talk it through out loud</h3>
        <p style={{ fontSize: 11, color: D.textMid, marginTop: 2, margin: 0 }}>Live, spoken conversation — barge in anytime</p>
        <div className="sc-voice-wave" style={{ display: "flex", alignItems: "center", gap: "2.5px", marginTop: 10, height: 16 }}>
          <span /><span /><span /><span /><span /><span />
        </div>
      </div>
      <button style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 7,
        background: "linear-gradient(135deg, #7DAAFF, #4F8EF7)", color: "#0B1B3A",
        border: "none", borderRadius: 30, padding: "11px 16px",
        fontFamily: FONTS.body, fontWeight: 800, fontSize: "12.5px", cursor: "pointer",
        boxShadow: "0 8px 20px -6px rgba(79,142,247,0.55)",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0014 0M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        Tap to talk
      </button>
    </div>
  );
}

function ChatTutorCard({ onOpenAI }) {
  const [input, setInput] = useState("");
  const chips = ["Explain the brachial plexus", "Quiz me on GST 115"];
  return (
    <div style={{
      background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
      border: `1px solid ${D.border}`, borderRadius: 22, padding: 18, position: "relative", overflow: "hidden",
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%", flexShrink: 0, position: "relative",
          background: "radial-gradient(circle at 32% 28%, #FFE3A8, #F5A623 55%, #9c5f08)",
          boxShadow: "0 0 0 1px rgba(245,166,35,0.2), 0 0 22px rgba(245,166,35,0.45)",
        }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(245,166,35,0.3)" }} />
          <div style={{ position: "absolute", inset: 10, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.6), transparent 70%)", opacity: 0.6 }} />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontFamily: FONTS.display, fontWeight: 700, color: D.textHi, margin: 0 }}>Ask the Circle</h3>
          <p style={{ fontSize: 11, color: D.textMid, marginTop: 2, margin: 0 }}>Grounded in your own course material</p>
        </div>
      </div>
      <div style={{
        marginTop: 16, display: "flex", alignItems: "center", gap: 9,
        background: "rgba(0,0,0,0.25)", border: `1px solid ${D.border}`, borderRadius: 15, padding: "12px 12px 12px 15px",
      }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { onOpenAI(input); setInput(""); } }}
          placeholder="What do you want explained today?"
          style={{ flex: 1, background: "none", border: "none", color: D.textHi, fontSize: 13, outline: "none", fontFamily: FONTS.body }}
        />
        <button onClick={() => { if (input.trim()) { onOpenAI(input); setInput(""); } }} style={{
          width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: D.blue, color: "#fff", boxShadow: "0 4px 12px rgba(79,142,247,0.3)",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 11l18-8-8 18-2-8-8-2z" fill="#fff"/></svg>
        </button>
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        {chips.map((chip) => (
          <button key={chip} onClick={() => onOpenAI(chip)} style={{
            fontSize: "10.5px", color: D.textMid, background: "rgba(255,255,255,0.045)",
            border: `1px solid ${D.border}`, padding: "7px 11px", borderRadius: 20,
            fontWeight: 500, cursor: "pointer", fontFamily: FONTS.body,
          }}>{chip}</button>
        ))}
      </div>
    </div>
  );
}

function ForYouSection({ items, onOpenAll, onOpenItem }) {
  const list = (items && items.length > 0)
    ? items.map((r) => ({ id: r.id, title: r.title, subject: r.subject, tag: r.contentType === "mcq" ? "MCQ" : r.contentType === "pdf" ? "PDF" : "Note", shareToken: r.shareToken }))
    : [];

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 13 }}>
        <h2 style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 700, color: D.textHi, margin: 0 }}>For you</h2>
        <button onClick={onOpenAll} style={{ fontSize: "10.5px", color: D.blue, textDecoration: "none", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>View all →</button>
      </div>
      {list.length === 0 ? (
        <div style={{
          background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
          border: `1px solid ${D.border}`, borderRadius: 18, padding: "24px 16px",
          textAlign: "center", color: D.textLow, fontSize: "12px",
        }}>
          No department materials yet. Materials from your department will appear here.
        </div>
      ) : (
        <div className="sc-scroll-row" style={{ display: "flex", gap: 11, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
          {list.map((card) => (
            <div key={card.id} onClick={() => onOpenItem?.(card.shareToken)} className="sc-foryou-card" style={{
              minWidth: 172, background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
              border: `1px solid ${D.border}`, borderRadius: 18, padding: 14, flexShrink: 0, cursor: "pointer",
            }}>
              <div className="sc-foryou-tag" style={{
                fontSize: 9, fontFamily: FONTS.mono, display: "inline-block", padding: "4px 8px", borderRadius: 7,
                marginBottom: 10, fontWeight: 600, letterSpacing: "0.03em",
                color: card.tag === "MCQ" ? D.coral : card.tag === "PDF" ? D.blue : D.green,
                background: card.tag === "MCQ" ? "rgba(255,84,112,0.12)" : card.tag === "PDF" ? "rgba(79,142,247,0.12)" : "rgba(61,214,140,0.12)",
              }}>{card.tag}</div>
              <p style={{ fontSize: "12.5px", lineHeight: 1.4, fontWeight: 700, color: D.textHi, margin: 0 }}>{card.title}</p>
              <span style={{ fontSize: 10, color: D.textLow, display: "block", marginTop: 10, fontWeight: 600 }}>{card.subject}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LibrarySection({ counts, onOpenDept, onOpenSpace, onOpenPublic }) {
  const pills = [
    { label: "My Department", sub: `${counts.dept} materials`, color: D.blue, bg: "rgba(79,142,247,0.15)", onClick: onOpenDept,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" stroke="#4F8EF7" strokeWidth="1.6" fill="none"/><path d="M3 12.5l9 4.5 9-4.5" stroke="#4F8EF7" strokeWidth="1.6" fill="none"/></svg> },
    { label: "My Space", sub: `${counts.saved} saved · ${counts.uploads} uploads`, color: D.gold, bg: "rgba(245,166,35,0.15)", onClick: onOpenSpace,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 7l2-3h6l2 3h8v11a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" stroke="#F5A623" strokeWidth="1.6" fill="none"/></svg> },
    { label: "Public", sub: `${counts.public} resources`, color: D.green, bg: "rgba(61,214,140,0.15)", onClick: onOpenPublic,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3DD68C" strokeWidth="1.6"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" stroke="#3DD68C" strokeWidth="1.4"/></svg> },
  ];
  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 13 }}>
        <h2 style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 700, color: D.textHi, margin: 0 }}>Your library</h2>
      </div>
      <div className="sc-pill-row" style={{ display: "flex", gap: 9, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
        {pills.map((p) => (
          <div key={p.label} onClick={p.onClick} className="sc-lib-pill" style={{
            display: "flex", alignItems: "center", gap: 10,
            background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
            border: `1px solid ${D.border}`, borderRadius: 16, padding: "12px 15px",
            whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer",
          }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: p.bg }}>{p.icon}</div>
            <div><p style={{ fontSize: "12.5px", fontWeight: 700, color: D.textHi, margin: 0 }}>{p.label}</p><span style={{ fontSize: "9.5px", color: D.textLow, display: "block", marginTop: 1, fontWeight: 500 }}>{p.sub}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardSection({ userName, onOpenLeaderboard, token }) {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchBoard() {
      try {
        const res = await fetch(`${API_BASE}/users/leaderboard`, { headers: { Authorization: `Bearer ${token}` } });
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

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 13 }}>
        <h2 style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 700, color: D.textHi, margin: 0 }}>Your study circle</h2>
        <button onClick={onOpenLeaderboard} style={{ fontSize: "10.5px", color: D.blue, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>View →</button>
      </div>
      <div style={{
        background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
        border: `1px solid ${D.border}`, borderRadius: 20, padding: "8px 16px",
      }}>
        {loading ? (
          <div style={{ color: D.textLow, fontSize: "12.5px", padding: "12px 0" }}>Loading leaderboard…</div>
        ) : ranked.length === 0 ? (
          <div style={{ color: D.textLow, fontSize: "12.5px", padding: "12px 0" }}>No leaderboard data yet.</div>
        ) : ranked.map((entry, i) => {
          const isMe = entry.username === myName || entry.username === userName;
          const xp = entry.totalXP || entry.xp || 0;
          const rankColors = [
            { bg: "rgba(245,166,35,0.18)", color: D.gold, shadow: "0 0 8px rgba(245,166,35,0.2)" },
            { bg: "rgba(192,192,192,0.15)", color: "#E0E0E0" },
            { bg: "rgba(205,127,50,0.15)", color: "#E08E45" },
          ];
          const rc = rankColors[i] || { bg: "rgba(255,255,255,0.06)", color: D.textMid };
          return (
            <div key={entry.userId || i} style={isMe ? {
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(79,142,247,0.1)", borderRadius: 12, margin: "6px 0 8px",
              padding: "10px 10px", border: "1px solid rgba(79,142,247,0.2)",
              boxShadow: "0 4px 16px rgba(79,142,247,0.18)", fontSize: "12.5px", fontWeight: 600,
            } : {
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 0", borderBottom: i < ranked.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              fontSize: "12.5px", fontWeight: 600,
            }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontFamily: FONTS.mono, marginRight: 10, fontWeight: 600,
                  background: rc.bg, color: rc.color, boxShadow: rc.shadow || "none",
                }}>{i + 1}</span>
                {isMe ? "You" : entry.username}
              </div>
              <span style={{ fontFamily: FONTS.mono, color: D.gold, fontSize: "11.5px" }}>{xp.toLocaleString()} XP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard({
  userName, stats, subjects, mastery, dueCards, history,
  onStartSpaced, onStartSubject, onOpenTab, onOpenLeaderboard,
  onOpenAI, onOpenLearn, onOpenStudy, onOpenResource, token, authUser,
}) {
  const { lastActivity, srData } = useUserData();
  const [fsrsStats, setFsrsStats] = useState(null);
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [showSkeletonView, setShowSkeletonView] = useState(false);
  const [skeletonCourse, setSkeletonCourse] = useState("");

  const fetchFsrsStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchFsrsStats(); }, [fetchFsrsStats]);

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
          if (cached) {
            const parsed = JSON.parse(cached);
            resources = parsed.data || parsed;
            if (parsed.ts && Date.now() - parsed.ts > 5 * 60 * 1000) resources = [];
          }
        } catch {}
        if (resources.length === 0) {
          const res = await fetch(`${API_BASE}/api/resources`, { headers });
          if (res.ok) {
            resources = await res.json();
            try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: resources, ts: Date.now() })); } catch {}
          }
        }
        let userProfile = null;
        try {
          const profileData = await getMyProfile();
          if (profileData?.profile) userProfile = profileData.profile;
          if (profileData?.userDept) userProfile = { ...userProfile, ...profileData.userDept };
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
        const deptId = userProfile?.departmentId || userProfile?.department?.id;
        const deptName = userProfile?.department?.name || userProfile?.department;
        const deptResources = resources.filter((r) => {
          if (r.status === "rejected") return false;
          if (deptId && r.resourceDepts) {
            return r.resourceDepts.some((rd) => String(rd.department?.id) === String(deptId));
          }
          if (deptName && r.department === deptName) return true;
          if (deptName && r.resourceDepts) {
            return r.resourceDepts.some((rd) => rd.department?.name === deptName);
          }
          return false;
        });
        const forYou = deptResources
          .filter((r) => r.uploader?.role !== "STUDENT" || r.status === "approved")
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 6);
        setResourceCounts({ dept: deptResources.length, public: resources.length, saved, uploads });
        setForYouPreview(forYou);
      } catch {}
    }
    fetchHubData();
    return () => { cancelled = true; };
  }, []);

  const sm2DueCount = dueCards?.length || 0;

  const handleReviewReadings = useCallback(async () => {
    if (onOpenResource) {
      try {
        const res = await fetch(`${API_BASE}/api/resources/fsrs/due?limit=50`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const readingItem = (data.items || []).find(
            (item) => ["whole_pdf", "page"].includes(item.itemType) && item.resource?.shareToken
          );
          if (readingItem) {
            onOpenResource(readingItem.resource.shareToken, readingItem.pageIndex);
            return;
          }
        }
      } catch {}
    }
    onOpenTab?.("research-hub");
  }, [onOpenTab, onOpenResource]);

  const handleOpenAI = useCallback((topic) => { onOpenAI?.(topic); }, [onOpenAI]);

  const openResearchHub = useCallback((tab, subTab) => {
    window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail: { tab, subTab } }));
  }, []);

  const greeting = `Good ${greetingWord()}`;
  const initials = getInitials(userName || authUser?.username || authUser?.name);
  const streak = stats?.streak || fsrsStats?.streak || 0;

  return (
    <div style={{ fontFamily: FONTS.body, color: D.textHi, position: "relative", minHeight: "100vh" }}>
      <style>{`
        @keyframes sc-pulse { 0% { transform: scale(1); opacity: 0.7; } 70% { transform: scale(1.35); opacity: 0; } 100% { opacity: 0; } }
        @keyframes sc-waveMove { 0%, 100% { transform: scaleY(0.4); opacity: 0.4; } 50% { transform: scaleY(1); opacity: 0.9; } }
        .sc-voice-ring { animation: sc-pulse 2.6s ease-in-out infinite; }
        .sc-voice-ring-delay { animation-delay: 1.3s; }
        .sc-voice-wave span { width: 2.5px; border-radius: 2px; background: ${D.blue}; opacity: 0.55; animation: sc-waveMove 1.4s ease-in-out infinite; }
        .sc-voice-wave span:nth-child(1) { height: 5px; animation-delay: 0s; }
        .sc-voice-wave span:nth-child(2) { height: 11px; animation-delay: 0.15s; }
        .sc-voice-wave span:nth-child(3) { height: 16px; animation-delay: 0.3s; }
        .sc-voice-wave span:nth-child(4) { height: 9px; animation-delay: 0.45s; }
        .sc-voice-wave span:nth-child(5) { height: 14px; animation-delay: 0.6s; }
        .sc-voice-wave span:nth-child(6) { height: 6px; animation-delay: 0.75s; }
        .sc-scroll-row::-webkit-scrollbar, .sc-pill-row::-webkit-scrollbar { display: none; }
        @media (min-width: 640px) {
          .sc-scroll-row { overflow-x: visible; flex-wrap: wrap; }
          .sc-foryou-card { min-width: 0; flex: 1 1 200px; }
          .sc-pill-row { overflow-x: visible; flex-wrap: wrap; }
          .sc-lib-pill { flex: 1 1 200px; }
        }
        @media (min-width: 980px) {
          .sc-top-grid { display: grid; grid-template-columns: minmax(320px, 440px) 1fr; gap: 22px; align-items: stretch; }
          .sc-tutors-col { display: flex; flex-direction: column; gap: 22px; }
          .sc-tutors-col > div { flex: 1; }
          .sc-lower-grid { display: grid; grid-template-columns: 1fr 360px; gap: 30px; align-items: start; }
          .sc-sidebar-col { position: sticky; top: 24px; }
          .sc-foryou-card { flex: 1 1 220px; }
        }
      `}</style>

      {/* Ambient mesh background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none",
        background: `
          radial-gradient(circle 220px at -5% -8%, rgba(79,142,247,0.28), transparent 70%),
          radial-gradient(circle 200px at 108% 18%, rgba(245,166,35,0.14), transparent 70%),
          radial-gradient(circle 210px at -8% 55%, rgba(255,84,112,0.11), transparent 70%)
        `,
      }} />

      <div style={{
        maxWidth: 900, margin: "0 auto", padding: "28px 20px 28px",
        position: "relative", zIndex: 2,
      }}>
        {/* Greeting */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14 }}>
          <div>
            <h1 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 25, letterSpacing: "-0.015em", lineHeight: 1.15, color: D.textHi, margin: 0, textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
              {greeting},<br />master
            </h1>
            <p style={{ color: D.textMid, fontSize: "12.5px", marginTop: 5, fontWeight: 500, margin: 0 }}>
              You're ahead of yesterday's pace.
            </p>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: FONTS.mono, fontSize: "10.5px", color: D.gold,
              background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.22)",
              padding: "5px 10px 5px 8px", borderRadius: 20, marginTop: 12,
              boxShadow: "0 4px 12px rgba(245,166,35,0.1)",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2c1 4-3 5-3 9a5 5 0 0010 0c0-2-1-3-2-4 0 2-1 3-2 2 1-3-1-5-3-7z" fill="#F5A623"/></svg>
              {streak}-day streak
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NotificationBellImproved token={token} currentUser={authUser} onOpenTab={onOpenTab} />
            <div
              onClick={() => onOpenTab?.("profile")}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "conic-gradient(from 0deg, #F5A623, #FFD98A, #FF5470, #F5A623)",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", cursor: "pointer", flexShrink: 0,
              }}
            >
              <div style={{ position: "absolute", inset: 2, borderRadius: "50%", background: "#1A1200", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ position: "relative", zIndex: 1, fontFamily: FONTS.display, fontWeight: 700, fontSize: 13, color: "#FFD98A" }}>{initials}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top grid: Hero + Tutors */}
        <div className="sc-top-grid" style={{ marginTop: 22 }}>
          <HeroCard
            fsrsStats={fsrsStats}
            sm2DueCount={sm2DueCount}
            onStartDaily={() => setShowDailyReview(true)}
            onReviewQuestions={onStartSpaced}
            onReviewReadings={handleReviewReadings}
          />
          <div className="sc-tutors-col" style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 22 }}>
            <VoiceTutorCard onOpenVoice={() => onOpenTab?.("voice-tutor")} />
            <ChatTutorCard onOpenAI={handleOpenAI} />
          </div>
        </div>

        {/* Course Roadmap card — prominent, full width */}
        <div style={{ marginTop: 22 }}>
          <TopicSkeletonCard
            onOpenSkeleton={(course) => { setSkeletonCourse(course || ""); setShowSkeletonView(true); }}
            token={token}
          />
        </div>

        {/* Lower grid: main content + sidebar */}
        <div className="sc-lower-grid" style={{ marginTop: 0 }}>
          <div className="sc-lower-main">
            <ForYouSection
              items={forYouPreview}
              onOpenAll={() => openResearchHub("department", "foryou")}
              onOpenItem={(t) => onOpenResource?.(t)}
            />
            <LibrarySection
              counts={resourceCounts}
              onOpenDept={() => openResearchHub("department", "foryou")}
              onOpenSpace={() => openResearchHub("space", "saved")}
              onOpenPublic={() => openResearchHub("public")}
            />
          </div>
          <div className="sc-sidebar-col" style={{ marginTop: 30 }}>
            <LeaderboardSection
              userName={userName}
              onOpenLeaderboard={onOpenLeaderboard}
              token={token}
            />
          </div>
        </div>

        <div style={{ textAlign: "center", color: D.textLow, fontSize: "10.5px", marginTop: 22, fontFamily: FONTS.mono, letterSpacing: "0.02em" }}>
          Analytics live in Progress tab ↓
        </div>
      </div>

      {/* Daily Review overlay */}
      {showDailyReview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
          <DailyReview
            onBack={() => { setShowDailyReview(false); fetchFsrsStats(); }}
            onComplete={() => { fetchFsrsStats(); }}
            onOpenPdf={onOpenResource}
          />
        </div>
      )}

      {/* Topic Skeleton overlay */}
      {showSkeletonView && (
        <TopicSkeletonView
          courseCode={skeletonCourse}
          onExit={() => setShowSkeletonView(false)}
          onOpenResource={onOpenResource}
          onStartStudying={(topic) => { onOpenStudy?.(topic.title, "auto-roadmap", null); setShowSkeletonView(false); }}
        />
      )}
    </div>
  );
}
