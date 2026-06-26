import React, { useState, useEffect } from "react";
import { BADGES } from "../lib/constants";

export function Leaderboard({ username, xp, sessions, streak, mastery, subjects, token }) {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [timePeriod, setTimePeriod] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userProfileData, setUserProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const API_BASE_LB = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (timePeriod !== "all") params.append("period", timePeriod);
    if (subjectFilter !== "all") params.append("subjectId", subjectFilter);
    fetch(`${API_BASE_LB}/users/leaderboard?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((users) => { setBoard(users); })
      .catch(() => {})
      .finally(() => { setLoading(false); setInitialLoadDone(true); });
  }, [token, timePeriod, subjectFilter]);

  useEffect(() => {
    if (!selectedUser || !token) return;
    setLoadingProfile(true);
    fetch(`${API_BASE_LB}/users/${selectedUser.userId}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((data) => { setUserProfileData(data); })
      .catch(() => {
        setUserProfileData({
          username: selectedUser.username,
          xp: selectedUser.totalXP || selectedUser.xp,
          sessions: selectedUser.sessions,
          streak: selectedUser.streak,
          avgMastery: selectedUser.avgMastery,
          correctRate: selectedUser.correctRate,
          studyHours: selectedUser.studyHours,
          personalBest: selectedUser.personalBest,
          badges: calculateBadges(selectedUser),
          recentSessions: [],
        });
      })
      .finally(() => setLoadingProfile(false));
  }, [selectedUser, token]);

  const localEntry = { username, xp, sessions, streak: streak || 0, isMe: true, avgMastery: 0, correctRate: 0, studyHours: 0, personalBest: 0 };
  const merged = board.length > 0
    ? board.map((e) => ({ ...e, isMe: e.username === username }))
    : [localEntry, { username: "demo_student", xp: Math.max(0, xp - 40), sessions: Math.max(0, sessions - 2), streak: Math.max(0, (streak || 0) - 1), isMe: false, avgMastery: 0, correctRate: 0, studyHours: 0, personalBest: 0 }];

  const ranked = [...merged].sort((a, b) => b.xp - a.xp);

  function calculateBadges(entry) {
    const earned = [];
    const stats = { xp: entry.totalXP || entry.xp, sessions: entry.sessions, streak: entry.streak, totalCorrect: Math.round((entry.correctRate / 100) * (entry.sessions * 10)) };
    const history = [];
    const mastery = {};
    BADGES.forEach(badge => {
      try {
        if (badge.check(stats, history, subjects, mastery)) { earned.push(badge); }
      } catch (e) { console.log('Badge check failed:', e); }
    });
    return earned;
  }

  function getTier(xp) {
    if (xp >= 1000) return { name: "Diamond", color: "#4F8EF7", icon: "💎" };
    if (xp >= 500) return { name: "Platinum", color: "#a855f7", icon: "💠" };
    if (xp >= 250) return { name: "Gold", color: "#facc15", icon: "🥇" };
    if (xp >= 100) return { name: "Silver", color: "#94a3b8", icon: "🥈" };
    return { name: "Bronze", color: "#cd7f32", icon: "🥉" };
  }

  function getStreakEmoji(streak) {
    if (streak >= 30) return "🔥🔥🔥";
    if (streak >= 14) return "🔥🔥";
    if (streak >= 7) return "🔥";
    if (streak >= 3) return "⚡";
    return "";
  }

  function getActivityStatus(lastActive) {
    if (!lastActive) return "";
    const minutesAgo = (Date.now() - new Date(lastActive).getTime()) / 60000;
    if (minutesAgo < 5) return "🟢 Active now";
    if (minutesAgo < 1440) return "🟡 Studied today";
    return "";
  }

  const TIERS = [
    { name: 'Bronze', min: 0, color: '#cd7f32' },
    { name: 'Silver', min: 100, color: '#94a3b8' },
    { name: 'Gold', min: 250, color: '#facc15' },
    { name: 'Platinum', min: 500, color: '#a855f7' },
    { name: 'Diamond', min: 1000, color: '#4F8EF7' },
  ];

  const myXP = xp || 0;
  const myTierIdx = TIERS.reduce((acc, t, i) => myXP >= t.min ? i : acc, 0);
  const myTier = TIERS[myTierIdx];
  const nextTier = TIERS[myTierIdx + 1];

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  const me = ranked.find(e => e.isMe);
  const myRank = me ? ranked.indexOf(me) + 1 : ranked.length + 1;
  const personAbove = me && myRank > 1 ? ranked[myRank - 2] : null;
  const xpToPass = personAbove ? (personAbove.xp - me.xp) : 0;

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const risers = [...ranked].sort((a, b) => (b.dailyXP || 0) - (a.dailyXP || 0)).slice(0, 3);
  const streakLegends = [...ranked].sort((a, b) => (b.streak || 0) - (a.streak || 0)).slice(0, 3);

  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const ms = monday - Date.now();
      if (ms <= 0) return setCountdown('0d 0h 0m');
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${d}d ${h}h ${m}m`);
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const ringColors = ['#F5A623', '#A8B0BE', '#C9824A'];
  const profileTier = userProfileData ? getTier(userProfileData.xp) : null;

  return (
    <div className="card" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
      {/* League Hero */}
      <div className="lb-hero">
        <div className="lb-hero-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z"/></svg>
        </div>
        <div className="lb-hero-text">
          <span className="tag">YOUR LEAGUE</span>
          <h2>{myTier.name} Circle</h2>
          <p>
            <span className="promo">Top 5</span> advance to {nextTier ? nextTier.name : 'Champion'} ·{' '}
            <span className="demo">Bottom 5</span> drop to {myTierIdx > 0 ? TIERS[myTierIdx - 1].name : 'Bronze'}
          </p>
        </div>
        <div className="lb-countdown">
          <div className="cd-label">LEAGUE RESETS IN</div>
          <div className="cd-value">{countdown || '—'}</div>
        </div>
      </div>

      {/* Tier Track */}
      <div className="lb-tier-track">
        {TIERS.map((t, i) => (
          <div key={t.name} className={`lb-tier-node ${i === myTierIdx ? 'active' : i < myTierIdx ? 'done' : ''}`}>
            <div className="lb-tier-line" />
            <div className="lb-tier-hex" />
            <span className="lb-tier-label">{t.name}</span>
          </div>
        ))}
      </div>

      {/* Time period + subject filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="lb-scope-tabs" style={{ marginBottom: 0 }}>
          {["all", "weekly", "monthly"].map((period) => (
            <button
              key={period}
              className={`lb-scope-tab ${timePeriod === period ? 'active' : ''}`}
              onClick={() => setTimePeriod(period)}
            >
              {period === 'all' ? '🏆 All' : period === 'weekly' ? '📅 Week' : '📆 Month'}
            </button>
          ))}
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          style={{
            padding: '7px 14px', background: '#151A24', color: '#EDEFF5',
            border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999,
            cursor: 'pointer', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <option value="all">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
          ))}
        </select>
      </div>

      {loading && !initialLoadDone && <p className="muted" style={{ textAlign: 'center', padding: 40 }}>Loading leaderboard…</p>}

      {/* Podium */}
      {top3.length >= 1 && (
        <div className="lb-podium">
          {/* #2 - left */}
          {top3[1] && (
            <div className="lb-pod-col rank2" onClick={() => !top3[1].isMe && setSelectedUser(top3[1])} style={{ cursor: top3[1].isMe ? 'default' : 'pointer' }}>
              <div className="lb-pod-ring">
                <svg viewBox="0 0 74 74" width="74" height="74"><circle cx="37" cy="37" r="33" fill="none" stroke={ringColors[1]} strokeWidth="4"/></svg>
                <div className="lb-pod-avatar">{getInitials(top3[1].username)}</div>
              </div>
              <span className="name">{top3[1].username}{top3[1].isMe && ' (you)'}</span>
              <span className="xp">{(top3[1].xp || 0).toLocaleString()} XP</span>
            </div>
          )}
          {/* #1 - center */}
          <div className="lb-pod-col rank1" onClick={() => !top3[0].isMe && setSelectedUser(top3[0])} style={{ cursor: top3[0].isMe ? 'default' : 'pointer' }}>
            <div className="lb-pod-ring">
              <span className="lb-pod-crown">👑</span>
              <svg viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="42" fill="none" stroke={ringColors[0]} strokeWidth="5"/></svg>
              <div className="lb-pod-avatar">{getInitials(top3[0].username)}</div>
            </div>
            <span className="name">{top3[0].username}{top3[0].isMe && ' (you)'}</span>
            <span className="xp">{(top3[0].xp || 0).toLocaleString()} XP</span>
          </div>
          {/* #3 - right */}
          {top3[2] && (
            <div className="lb-pod-col rank3" onClick={() => !top3[2].isMe && setSelectedUser(top3[2])} style={{ cursor: top3[2].isMe ? 'default' : 'pointer' }}>
              <div className="lb-pod-ring">
                <svg viewBox="0 0 74 74" width="74" height="74"><circle cx="37" cy="37" r="33" fill="none" stroke={ringColors[2]} strokeWidth="4"/></svg>
                <div className="lb-pod-avatar">{getInitials(top3[2].username)}</div>
              </div>
              <span className="name">{top3[2].username}{top3[2].isMe && ' (you)'}</span>
              <span className="xp">{(top3[2].xp || 0).toLocaleString()} XP</span>
            </div>
          )}
        </div>
      )}

      {/* Rank List (4th onward) */}
      {rest.length > 0 && (
        <>
          <span className="lb-section-label">{myTier.name.toUpperCase()} CIRCLE · RANK 4–{ranked.length}</span>
          <div className="lb-rank-list">
            {rest.map((entry, i) => {
              const rank = i + 4;
              const isPromo = rank <= 5;
              const isDemo = rank >= ranked.length - 4;
              return (
                <div
                  key={entry.username}
                  className={`lb-rank-row ${isPromo ? 'promo' : ''} ${isDemo ? 'demo' : ''} ${entry.isMe ? 'me' : ''}`}
                  onClick={() => !entry.isMe && setSelectedUser(entry)}
                  style={{ cursor: entry.isMe ? 'default' : 'pointer' }}
                >
                  <span className="lb-rank-num">{rank}</span>
                  <span className={`lb-rank-trend ${entry.trend > 0 ? 'up' : entry.trend < 0 ? 'down' : 'same'}`}>
                    {entry.trend > 0 ? '▲' : entry.trend < 0 ? '▼' : '–'}{entry.trend !== 0 && entry.trend ? Math.abs(entry.trend) : ''}
                  </span>
                  <span className="lb-rank-av">{getInitials(entry.username)}</span>
                  <span className="lb-rank-name">
                    <span className="nm">{entry.username}{entry.isMe && ' (you)'}</span>
                    {entry.streak > 0 && <span className="meta">🔥 {entry.streak}d streak · {entry.sessions} sessions</span>}
                  </span>
                  <span className="lb-rank-xp">{(entry.xp || 0).toLocaleString()} XP</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dual Grid: Risers + Streak Legends */}
      <div className="lb-dual-grid">
        <div className="lb-mini-card">
          <h3>📈 This week's risers</h3>
          {risers.map((r, i) => (
            <div key={r.username} className="lb-mini-row">
              <span className="mname">{r.username}{r.isMe && ' (you)'}</span>
              <span className="mval green">+{(r.dailyXP || Math.round(r.xp * 0.15) || 0)} XP</span>
            </div>
          ))}
        </div>
        <div className="lb-mini-card">
          <h3>🔥 Streak legends</h3>
          {streakLegends.map((r, i) => (
            <div key={r.username} className="lb-mini-row">
              <span className="mname">{r.username}{r.isMe && ' (you)'}</span>
              <span className="mval">{r.streak || 0} days</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky You Bar */}
      {me && (
        <div className="lb-you-bar">
          <span>#{myRank} · <b>You</b> · {(me.xp || 0).toLocaleString()} XP</span>
          {personAbove && (
            <>
              <div className="sep" />
              <span className="next">{xpToPass > 0 ? `${xpToPass} XP to pass ${personAbove.username} →` : "You're at the top! 🎉"}</span>
            </>
          )}
        </div>
      )}

      {/* User Profile Modal — compact, no scroll */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content lb-profile-modal" onClick={(e) => e.stopPropagation()}>
            {loadingProfile ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p className="muted">Loading profile…</p>
              </div>
            ) : userProfileData ? (
              <>
                {/* Header */}
                <div className="lb-profile-header">
                  <div className="lb-profile-avatar" style={{ background: profileTier.color }}>
                    {getInitials(userProfileData.username)}
                  </div>
                  <div className="lb-profile-header-info">
                    <div className="uname">{userProfileData.username}</div>
                    <span className="tier-badge" style={{ background: profileTier.color, color: profileTier.color === '#facc15' || profileTier.color === '#94a3b8' ? '#000' : '#fff' }}>
                      {profileTier.icon} {profileTier.name}
                    </span>
                  </div>
                  <button className="modal-close" onClick={() => setSelectedUser(null)} style={{ position: 'static', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', color: '#9AA3B5', cursor: 'pointer', padding: 4 }}>×</button>
                </div>

                {/* Body */}
                <div className="lb-profile-body">
                  {/* 2×2 Stat Grid */}
                  <div className="lb-profile-stats">
                    <div className="lb-profile-stat">
                      <div className="label">Total XP</div>
                      <div className="value" style={{ color: '#a5b4fc' }}>{(userProfileData.xp || 0).toLocaleString()}</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Sessions</div>
                      <div className="value" style={{ color: '#4ade80' }}>{userProfileData.sessions || 0}</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Streak</div>
                      <div className="value" style={{ color: '#fb923c' }}>{userProfileData.streak || 0} days</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Study Hours</div>
                      <div className="value" style={{ color: '#c084fc' }}>{userProfileData.studyHours || 0}h</div>
                    </div>
                  </div>

                  {/* Mastery Bar */}
                  <div className="lb-profile-mastery">
                    <div className="mlabel">
                      <span>Average Mastery</span>
                      <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{userProfileData.avgMastery || 0}%</span>
                    </div>
                    <div className="bar">
                      <div className="fill" style={{ width: `${userProfileData.avgMastery || 0}%` }} />
                    </div>
                  </div>

                  {/* Badges + Personal Best in one row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {userProfileData.badges && userProfileData.badges.length > 0 && (
                      <div className="lb-profile-badges">
                        <span className="blabel">Badges:</span>
                        {userProfileData.badges.slice(0, 6).map((badge, idx) => (
                          <span key={idx} style={{ fontSize: 18 }} title={badge.label}>{badge.icon}</span>
                        ))}
                        {userProfileData.badges.length > 6 && <span style={{ fontSize: 11, color: '#646E84' }}>+{userProfileData.badges.length - 6}</span>}
                      </div>
                    )}
                    {userProfileData.personalBest > 0 && (
                      <span className="lb-profile-pb">🏆 PB: {userProfileData.personalBest}%</span>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {!token && <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>Connect to the backend to see real rankings.</p>}

    </div>
  );
}
