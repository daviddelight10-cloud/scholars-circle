import { useEffect, useState } from "react";
import { BADGES, resolveBadges } from "../lib/badges.js";

const RECENT_BADGES_KEY = "sc_recent_badges_v1";

// Subset of the badge catalog computable from this component's props
// (no fsrsStats/save access here — streak/xp are adapted from legacy stats).
const NOTIFY_IDS = ["streak_3", "streak_7", "streak_14", "level_5", "night_owl", "early_bird", "comeback"];
const NOTIFY_BADGES = BADGES.filter((b) => NOTIFY_IDS.includes(b.id));

function loadRecentBadges() {
  try {
    const raw = localStorage.getItem(RECENT_BADGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentBadges(badges) {
  localStorage.setItem(RECENT_BADGES_KEY, JSON.stringify(badges));
}

export function AchievementNotification({ stats, history, subjects, mastery }) {
  const [visibleBadge, setVisibleBadge] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Check for newly earned badges
  useEffect(() => {
    const ctx = {
      stats, history, subjects,
      save: { xp: stats?.xp || 0 },
      fsrsStats: { streak: stats?.streak || 0, longestStreak: Math.max(stats?.streak || 0, stats?.longestStreak || 0) },
    };
    const earnedBadges = resolveBadges(ctx, NOTIFY_BADGES).filter((b) => b.earned);
    const recentBadges = loadRecentBadges();
    
    // Find newly earned badges
    const newBadges = earnedBadges.filter(b => !recentBadges.includes(b.id));
    
    if (newBadges.length > 0) {
      // Show the first new badge
      const badgeToShow = newBadges[0];
      setVisibleBadge(badgeToShow);
      setShowConfetti(true);
      
      // Update recent badges
      const updatedRecent = [...new Set([...recentBadges, ...newBadges.map(b => b.id)])];
      saveRecentBadges(updatedRecent);
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setVisibleBadge(null);
        setShowConfetti(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [stats, history, subjects, mastery]);

  // Create confetti effect
  function createConfetti() {
    if (!showConfetti) return null;
    
    const colors = ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#a78bfa', '#f472b6'];
    const pieces = [];
    
    for (let i = 0; i < 50; i++) {
      const style = {
        left: `${Math.random() * 100}vw`,
        top: `-20px`,
        background: colors[Math.floor(Math.random() * colors.length)],
        animationDelay: `${Math.random() * 2}s`,
        animationDuration: `${2 + Math.random() * 2}s`
      };
      pieces.push(<div key={i} className="confetti-piece" style={style} />);
    }
    
    return pieces;
  }

  if (!visibleBadge) return null;

  return (
    <>
      {showConfetti && createConfetti()}
      <div className="achievement-notification" style={{
        position: "fixed",
        top: 20,
        right: 20,
        background: "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
        border: "2px solid #fbbf24",
        borderRadius: 12,
        padding: 20,
        minWidth: 300,
        maxWidth: 400,
        zIndex: 10000,
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            fontSize: 48,
            animation: "bounce 1s infinite"
          }}>
            {visibleBadge.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: 12, 
              color: "#fbbf24", 
              fontWeight: 600, 
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: 1
            }}>
              Achievement Unlocked!
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {visibleBadge.label}
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              {visibleBadge.desc}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setVisibleBadge(null);
            setShowConfetti(false);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "transparent",
            border: "none",
            color: "#9ca3af",
            fontSize: 18,
            cursor: "pointer",
            padding: 4
          }}
        >
          ✕
        </button>
      </div>
    </>
  );
}
