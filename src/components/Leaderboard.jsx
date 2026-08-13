import React, { useState, useEffect, useCallback, useRef } from "react";
import { BADGES, API_BASE } from "../lib/constants";

export function Leaderboard({ username, xp, sessions, streak, token }) {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [timePeriod, setTimePeriod] = useState("all");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [sortBy, setSortBy] = useState("xp"); // xp | streak | accuracy
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userProfileData, setUserProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [prevRanks, setPrevRanks] = useState({});
  const prevRanksRef = useRef({});
  const [, setTick] = useState(0);
  const [countdown, setCountdown] = useState('');

  // Re-render every 5s so the "Updated Xs ago" indicator stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const fetchLeaderboard = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (timePeriod !== "all") params.append("period", timePeriod);
    if (friendsOnly) params.append("friends", "true");
    params.append("page", String(page));
    params.append("limit", "50");
    fetch(`${API_BASE}/users/leaderboard?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const entries = data.entries || data;
        const newRanks = {};
        entries.forEach((e, i) => { newRanks[e.userId || e.username] = i + 1; });
        if (page === 1 && Object.keys(prevRanksRef.current).length > 0) {
          setPrevRanks(prevRanksRef.current);
        }
        prevRanksRef.current = newRanks;
        setBoard(prev => page === 1 ? entries : [...prev, ...entries]);
        setTotalCount(data.total || entries.length);
        setHasMore(data.hasMore || false);
        if (data.league) setLeagueInfo(data.league);
        setLastUpdated(new Date());
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setInitialLoadDone(true); });
  }, [token, timePeriod, friendsOnly, page]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // 30s polling for live updates
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (page === 1) fetchLeaderboard();
    }, 30000);
    return () => clearInterval(id);
  }, [token, fetchLeaderboard, page]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [timePeriod, friendsOnly]);

  // Countdown to next Monday (league reset)
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

  useEffect(() => {
    if (!selectedUser || !token) return;
    setLoadingProfile(true);
    fetch(`${API_BASE}/users/${selectedUser.userId}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((data) => {
        setUserProfileData(data);
        setIsFollowing(data.isFollowing || false);
      })
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

  const handleFollowToggle = async () => {
    if (!selectedUser || !token) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`${API_BASE}/users/${selectedUser.userId}/follow`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
      }
    } catch (e) {
      console.error("Follow toggle failed:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const localEntry = { username, xp, sessions, streak: streak || 0, isMe: true, avgMastery: 0, correctRate: 0, studyHours: 0, personalBest: 0 };
  const boardWithMe = board.map((e) => ({ ...e, isMe: !!e.isMe }));
  const imInBoard = boardWithMe.some(e => e.isMe);
  const merged = board.length > 0
    ? (imInBoard ? boardWithMe : [...boardWithMe, localEntry])
    : [localEntry];

  const sortFn = sortBy === 'streak'
    ? (a, b) => (b.streak || 0) - (a.streak || 0)
    : sortBy === 'accuracy'
    ? (a, b) => (b.correctRate || 0) - (a.correctRate || 0)
    : (a, b) => (b.xp || 0) - (a.xp || 0);
  const ranked = [...merged].sort(sortFn);

  function calculateBadges(entry) {
    const earned = [];
    const stats = { xp: entry.totalXP || entry.xp, sessions: entry.sessions, streak: entry.streak, totalCorrect: Math.round((entry.correctRate / 100) * (entry.sessions * 10)) };
    const history = [];
    const mastery = {};
    BADGES.forEach(badge => {
      try {
        if (badge.check(stats, history, [], mastery)) { earned.push(badge); }
      } catch (e) {}
    });
    return earned;
  }

  function getTier(xp) {
    if (xp >= 1000) return { name: "Diamond", color: "#FFD700", icon: "💎" };
    if (xp >= 500) return { name: "Platinum", color: "#DAA520", icon: "💠" };
    if (xp >= 250) return { name: "Gold", color: "#facc15", icon: "🥇" };
    if (xp >= 100) return { name: "Silver", color: "#94a3b8", icon: "🥈" };
    return { name: "Bronze", color: "#cd7f32", icon: "🥉" };
  }

  const TIERS = [
    { name: 'Bronze', min: 0, color: '#cd7f32' },
    { name: 'Silver', min: 100, color: '#94a3b8' },
    { name: 'Gold', min: 250, color: '#facc15' },
    { name: 'Platinum', min: 500, color: '#DAA520' },
    { name: 'Diamond', min: 1000, color: '#FFD700' },
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

  const ringColors = ['#F5A623', '#A8B0BE', '#C9824A'];
  const profileTier = userProfileData ? getTier(userProfileData.xp) : null;

  return (
    <div className="card" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
      {/* League Hero — real league data from backend */}
      <div className="lb-hero">
        <div className="lb-hero-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z"/></svg>
        </div>
        <div className="lb-hero-text">
          <span className="tag">YOUR LEAGUE</span>
          <h2>{leagueInfo ? `${leagueInfo.tier.charAt(0).toUpperCase() + leagueInfo.tier.slice(1)} Circle` : `${myTier.name} Circle`}</h2>
          <p>
            <span className="promo">Top 5</span> advance to {nextTier ? nextTier.name : 'Champion'} ·{' '}
            <span className="demo">Bottom 5</span> drop to {myTierIdx > 0 ? TIERS[myTierIdx - 1].name : 'Bronze'}
          </p>
          {leagueInfo && (leagueInfo.promoted || leagueInfo.demoted) && (
            <p className="lb-league-status">
              {leagueInfo.promoted && <span className="promo">⬆ Promoted last week!</span>}
              {leagueInfo.demoted && <span className="demo">⬇ Demoted last week</span>}
            </p>
          )}
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

      {/* Filters + sort + friends toggle + polling indicator */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="lb-scope-tabs" style={{ marginBottom: 0 }}>
            {['all', 'weekly', 'monthly'].map((period) => (
              <button
                key={period}
                className={`lb-scope-tab ${timePeriod === period ? 'active' : ''}`}
                onClick={() => setTimePeriod(period)}
              >
                {period === 'all' ? '🏆 All' : period === 'weekly' ? '📅 Week' : '📆 Month'}
              </button>
            ))}
          </div>
          <button
            className={`lb-scope-tab ${friendsOnly ? 'active' : ''}`}
            onClick={() => setFriendsOnly(f => !f)}
            style={{ marginBottom: 0 }}
          >
            👥 Friends
          </button>
          <div className="lb-sort-tabs" style={{ marginBottom: 0 }}>
            {[
              { key: 'xp', label: '⚡ XP' },
              { key: 'streak', label: '🔥 Streak' },
              { key: 'accuracy', label: '🎯 Accuracy' },
            ].map((s) => (
              <button
                key={s.key}
                className={`lb-scope-tab ${sortBy === s.key ? 'active' : ''}`}
                onClick={() => setSortBy(s.key)}
                style={{ marginBottom: 0, fontSize: 11 }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {lastUpdated && (
          <span className="lb-poll-indicator">
            <span className="lb-poll-dot" /> Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && !initialLoadDone && (
        <div className="lb-skeleton">
          <div className="lb-podium">
            <div className="lb-pod-col rank2"><div className="lb-skel-circle" /><div className="lb-skel-line w60" /></div>
            <div className="lb-pod-col rank1"><div className="lb-skel-circle lg" /><div className="lb-skel-line w80" /></div>
            <div className="lb-pod-col rank3"><div className="lb-skel-circle" /><div className="lb-skel-line w60" /></div>
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="lb-rank-row lb-skel-row">
              <div className="lb-skel-line w20" />
              <div className="lb-skel-circle sm" />
              <div className="lb-skel-line w120" />
              <div className="lb-skel-line w40" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {initialLoadDone && board.length === 0 && token && (
        <div className="lb-empty-state">
          <div className="lb-empty-icon">🏆</div>
          <h3>No rankings yet</h3>
          <p>{friendsOnly ? "Follow some scholars to see them here!" : "Be the first to study and claim the #1 spot!"}</p>
        </div>
      )}

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
              {top3[1].trend > 0 && <span className="lb-pod-trend up">▲</span>}
              {top3[1].trend < 0 && <span className="lb-pod-trend down">▼</span>}
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
            {top3[0].trend > 0 && <span className="lb-pod-trend up">▲</span>}
            {top3[0].trend < 0 && <span className="lb-pod-trend down">▼</span>}
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
              {top3[2].trend > 0 && <span className="lb-pod-trend up">▲</span>}
              {top3[2].trend < 0 && <span className="lb-pod-trend down">▼</span>}
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
              const prevRank = prevRanks[entry.userId || entry.username];
              const rankClass = prevRank != null && prevRank !== rank
                ? prevRank > rank ? 'rank-up' : 'rank-down'
                : '';
              return (
                <div
                  key={entry.userId || entry.username}
                  className={`lb-rank-row ${isPromo ? 'promo' : ''} ${isDemo ? 'demo' : ''} ${entry.isMe ? 'me' : ''} ${rankClass}`}
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
                    <span className="meta">
                      {entry.streak > 0 && <>🔥 {entry.streak}d · </>}
                      {entry.sessions > 0 && <>📚 {entry.sessions} · </>}
                      {entry.correctRate > 0 && <>🎯 {entry.correctRate}% · </>}
                      {entry.studyHours > 0 && <>⏱ {entry.studyHours}h</>}
                    </span>
                  </span>
                  <span className="lb-rank-xp">{(entry.xp || 0).toLocaleString()} XP</span>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button className="lb-load-more" onClick={() => setPage(p => p + 1)}>
              Load More ({totalCount - board.length} remaining)
            </button>
          )}
        </>
      )}

      {/* Sticky You Bar with progress */}
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
                  <div className="lb-profile-actions">
                    {selectedUser.userId && !selectedUser.isMe && token && (
                      <button
                        className={`lb-follow-btn ${isFollowing ? 'following' : ''}`}
                        onClick={handleFollowToggle}
                        disabled={followLoading}
                      >
                        {followLoading ? '…' : isFollowing ? '✓ Following' : '+ Follow'}
                      </button>
                    )}
                    <button className="modal-close" onClick={() => setSelectedUser(null)} style={{ position: 'static', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', color: '#9AA3B5', cursor: 'pointer', padding: 4 }}>×</button>
                  </div>
                </div>

                {/* Follow counts */}
                {userProfileData.followerCount != null && (
                  <div className="lb-follow-stats">
                    <span><b>{userProfileData.followerCount}</b> followers</span>
                    <span><b>{userProfileData.followingCount}</b> following</span>
                  </div>
                )}

                {/* Body */}
                <div className="lb-profile-body">
                  {/* 3×2 Stat Grid */}
                  <div className="lb-profile-stats">
                    <div className="lb-profile-stat">
                      <div className="label">Total XP</div>
                      <div className="value" style={{ color: '#FFD700' }}>{(userProfileData.xp || 0).toLocaleString()}</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Sessions</div>
                      <div className="value" style={{ color: '#DAA520' }}>{userProfileData.sessions || 0}</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Streak</div>
                      <div className="value" style={{ color: '#fbbf24' }}>{userProfileData.streak || 0} days</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Accuracy</div>
                      <div className="value" style={{ color: '#F5A623' }}>{userProfileData.correctRate || 0}%</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Study Hours</div>
                      <div className="value" style={{ color: '#B8860B' }}>{userProfileData.studyHours || 0}h</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Personal Best</div>
                      <div className="value" style={{ color: '#FFD700' }}>{userProfileData.personalBest || 0}%</div>
                    </div>
                  </div>

                  {/* Mastery Bar */}
                  <div className="lb-profile-mastery">
                    <div className="mlabel">
                      <span>Average Mastery</span>
                      <span style={{ color: '#FFD700', fontWeight: 700 }}>{userProfileData.avgMastery || 0}%</span>
                    </div>
                    <div className="bar">
                      <div className="fill" style={{ width: `${userProfileData.avgMastery || 0}%` }} />
                    </div>
                  </div>

                  {/* Badges */}
                  {userProfileData.badges && userProfileData.badges.length > 0 && (
                    <div className="lb-profile-badges">
                      <span className="blabel">Badges:</span>
                      {userProfileData.badges.slice(0, 6).map((badge, idx) => (
                        <span key={idx} style={{ fontSize: 18 }} title={badge.label}>{badge.icon}</span>
                      ))}
                      {userProfileData.badges.length > 6 && <span style={{ fontSize: 11, color: '#646E84' }}>+{userProfileData.badges.length - 6}</span>}
                    </div>
                  )}

                  {/* Recent Activity */}
                  {userProfileData.recentSessions && userProfileData.recentSessions.length > 0 && (
                    <div className="lb-profile-recent">
                      <div className="blabel">Recent Activity</div>
                      {userProfileData.recentSessions.slice(0, 5).map((s, idx) => (
                        <div key={idx} className="lb-recent-row">
                          <span className="lb-recent-mode">{(s.mode || 'practice').charAt(0).toUpperCase() + (s.mode || 'practice').slice(1)}</span>
                          <span className="lb-recent-score">{s.score}/{s.total} · {Math.round(s.percentage)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
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
