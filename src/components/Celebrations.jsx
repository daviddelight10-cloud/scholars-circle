import React, { useState, useEffect } from "react";
import { getLeague, getNextLeague } from "../lib/appUtils";

export function ConfettiOverlay() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#1dd1a1', '#ff9f43', '#ee5a24'];
    const newParticles = [];
    for (let i = 0; i < 150; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 8,
        speedY: 2 + Math.random() * 4,
        speedX: (Math.random() - 0.5) * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    setParticles(newParticles);
  }, []);

  return (
    <div className="confetti-container">
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall 3s ease-out forwards`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

export function CelebrationToast({ celebration, onClose }) {
  const messages = {
    streak: (data) => `🔥 ${data.days}-Day Streak! Keep it up!`,
    league: (data) => `🎉 Promoted to ${data.league.icon} ${data.league.name}!`,
    perfect: (data) => `🏆 Perfect Score! ${data.score}/${data.total}`,
    badge: (data) => `🏅 Badge Unlocked: ${data.icon} ${data.label}`,
  };

  return (
    <div className="celebration-toast" onClick={onClose}>
      <div className="celebration-content">
        <span className="celebration-icon">
          {celebration.type === 'streak' && celebration.data.icon}
          {celebration.type === 'league' && celebration.data.league.icon}
          {celebration.type === 'perfect' && '🏆'}
          {celebration.type === 'badge' && celebration.data.icon}
        </span>
        <span className="celebration-message">
          {messages[celebration.type]?.(celebration.data) || '🎉 Achievement!'}
        </span>
      </div>
    </div>
  );
}

export function StreakLossWarning({ streak, lastStudied }) {
  const [showWarning, setShowWarning] = useState(false);
  const [hoursLeft, setHoursLeft] = useState(0);

  useEffect(() => {
    if (!lastStudied || streak < 3) {
      setShowWarning(false);
      return;
    }

    const checkStreak = () => {
      const now = new Date();
      const lastDate = new Date(lastStudied);
      const tomorrow = new Date(lastDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const hoursRemaining = (tomorrow - now) / (1000 * 60 * 60);

      if (hoursRemaining < 6 && hoursRemaining > 0) {
        setHoursLeft(Math.ceil(hoursRemaining));
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    checkStreak();
    const interval = setInterval(checkStreak, 60000);
    return () => clearInterval(interval);
  }, [lastStudied, streak]);

  if (!showWarning) return null;

  return (
    <div className="streak-warning">
      <span className="streak-warning-icon">⚠️</span>
      <span className="streak-warning-text">
        Your <strong>{streak}-day streak</strong> will break in <strong>{hoursLeft} hours!</strong>
      </span>
      <button className="streak-warning-btn" onClick={() => setShowWarning(false)}>
        Study Now
      </button>
    </div>
  );
}

export function StudyHeatmap({ heatmap }) {
  const [showTooltip, setShowTooltip] = useState(null);

  const generateCalendar = () => {
    const days = [];
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const count = heatmap[key] || 0;
      days.push({ date: key, count, day: date.getDay() });
    }
    return days;
  };

  const days = generateCalendar();
  const maxCount = Math.max(...Object.values(heatmap), 1);

  const getColor = (count) => {
    if (count === 0) return 'rgba(148, 163, 184, 0.1)';
    const intensity = count / maxCount;
    if (intensity >= 0.75) return '#22c55e';
    if (intensity >= 0.5) return '#4ade80';
    if (intensity >= 0.25) return '#86efac';
    return '#bbf7d0';
  };

  const totalSessions = Object.values(heatmap).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(heatmap).filter(v => v > 0).length;

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <span className="heatmap-title">📊 Study Activity</span>
        <span className="heatmap-stats">{activeDays} active days • {totalSessions} total</span>
      </div>
      <div className="heatmap-grid">
        {days.map((d, i) => (
          <div
            key={i}
            className="heatmap-cell"
            style={{ background: getColor(d.count) }}
            onMouseEnter={() => setShowTooltip(d)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            {showTooltip?.date === d.date && (
              <div className="heatmap-tooltip">
                <strong>{d.date}</strong>
                <br />
                {d.count} questions answered
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        <div className="heatmap-legend-cells">
          <div style={{ background: getColor(0) }} />
          <div style={{ background: getColor(maxCount * 0.25) }} />
          <div style={{ background: getColor(maxCount * 0.5) }} />
          <div style={{ background: getColor(maxCount * 0.75) }} />
          <div style={{ background: getColor(maxCount) }} />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

export function LeagueProgress({ xp }) {
  const currentLeague = getLeague(xp);
  const nextLeague = getNextLeague(xp);
  const progress = nextLeague
    ? ((xp - currentLeague.minXP) / (nextLeague.minXP - currentLeague.minXP)) * 100
    : 100;

  return (
    <div className="league-progress">
      <div className="league-current">
        <span className="league-icon" style={{ color: currentLeague.color }}>{currentLeague.icon}</span>
        <span className="league-name">{currentLeague.name}</span>
      </div>
      {nextLeague && (
        <>
          <div className="league-bar">
            <div
              className="league-bar-fill"
              style={{ width: `${progress}%`, background: currentLeague.color }}
            />
          </div>
          <div className="league-next">
            <span>{nextLeague.icon} {nextLeague.name}</span>
            <span>{nextLeague.minXP - xp} XP to go</span>
          </div>
        </>
      )}
      {!nextLeague && (
        <div className="league-max">
          👑 Maximum League Reached!
        </div>
      )}
    </div>
  );
}

export function CelebrationNotification({ stats, history, yesterdayTime }) {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const today = new Date().toDateString();
    const todaySessions = history.filter(h => new Date(h.ts).toDateString() === today);
    const todayTime = todaySessions.length * 5;

    if (yesterdayTime > 0 && todayTime > yesterdayTime + 10) {
      setNotification({
        type: 'improvement',
        message: `You studied ${todayTime - yesterdayTime} minutes more than yesterday! 🎉`,
      });
    }

    if (stats.xp > 500 && Math.random() > 0.9) {
      setNotification({
        type: 'top10',
        message: "You're in the top 10% this week! 🏆",
      });
    }
  }, [stats.xp, history, yesterdayTime]);

  if (!notification) return null;

  return (
    <div className="celebration-notification" onClick={() => setNotification(null)}>
      <span>{notification.message}</span>
    </div>
  );
}
