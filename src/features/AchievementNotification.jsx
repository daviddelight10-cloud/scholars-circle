import { useEffect, useState } from "react";

const RECENT_BADGES_KEY = "sc_recent_badges_v1";

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
    const BADGES = [
      { id: "first_session", icon: "🌱", label: "First Steps", desc: "Complete your first session", check: (s) => s.sessions >= 1 },
      { id: "sessions_10", icon: "📚", label: "Dedicated", desc: "Complete 10 study sessions", check: (s) => s.sessions >= 10 },
      { id: "sessions_25", icon: "🏅", label: "Veteran", desc: "Complete 25 study sessions", check: (s) => s.sessions >= 25 },
      { id: "streak_3", icon: "⚡", label: "On Fire", desc: "Keep a 3-day streak", check: (s) => s.streak >= 3 },
      { id: "streak_7", icon: "🔥", label: "7-Day Streak", desc: "Keep a 7-day streak", check: (s) => s.streak >= 7 },
      { id: "xp_100", icon: "⭐", label: "Scholar", desc: "Earn 100 XP", check: (s) => s.xp >= 100 },
      { id: "xp_500", icon: "💫", label: "Expert", desc: "Earn 500 XP", check: (s) => s.xp >= 500 },
      { id: "correct_50", icon: "🎯", label: "Sharpshooter", desc: "Get 50 correct answers total", check: (s) => s.totalCorrect >= 50 },
      { id: "perfect_score", icon: "🏆", label: "Perfectionist", desc: "Score 100% on any exam", check: (s, h) => h.some(x => x.score === x.total && x.total > 0 && x.mode === "exam") },
      { id: "speed_demon", icon: "💨", label: "Speed Demon", desc: "Finish an exam in under 2 minutes", check: (s, h) => h.some(x => x.mode === "exam" && x.seconds > 0 && x.seconds < 120) },
      { id: "night_owl", icon: "🦉", label: "Night Owl", desc: "Study after 10 pm", check: (s, h) => h.some(x => new Date(x.ts).getHours() >= 22) },
      { id: "all_subjects", icon: "🌈", label: "Well Rounded", desc: "Study every subject at least once", check: (s, h, sub) => new Set(h.map(x => x.subjectId)).size >= sub.length },
      { id: "mastery_80", icon: "🎓", label: "Master", desc: "Reach 80% mastery in any subject", check: (s, h, sub, m) => Object.values(m).some(v => v >= 80) },
      { id: "mastery_100", icon: "👑", label: "Grandmaster", desc: "Reach 100% mastery in any subject", check: (s, h, sub, m) => Object.values(m).some(v => v >= 100) },
      { id: "coins_50", icon: "💰", label: "Coin Collector", desc: "Accumulate 50 coins", check: (s) => s.coins >= 50 },
    ];

    const earnedBadges = BADGES.filter(b => b.check(stats, history, subjects, mastery));
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
