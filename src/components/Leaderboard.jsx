import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../lib/constants";
import { Avatar } from "../features/feed/feedUi.jsx";
import { levelProgress } from "../features/streak-survival/survivalStore.js";

const TIER_META = {
  bronze:   { icon: "🥉", color: "#C9824A" },
  silver:   { icon: "🥈", color: "#A8B0BE" },
  gold:     { icon: "🥇", color: "#F5C542" },
  platinum: { icon: "💠", color: "#7CC7FF" },
  diamond:  { icon: "💎", color: "#C0B2FF" },
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function LvlChip({ xp }) {
  return <span className="lb-lvl">LVL {levelProgress(xp || 0).level}</span>;
}

export function Leaderboard({ token }) {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [period, setPeriod] = useState("weekly"); // weekly | all
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [countdown, setCountdown] = useState("");

  const fetchLeaderboard = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams({ period, page: String(page), limit: "50" });
    if (friendsOnly) params.set("friends", "true");
    fetch(`${API_BASE}/users/leaderboard?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const entries = data.entries || data || [];
        setBoard((prev) => (page === 1 ? entries : [...prev, ...entries]));
        setTotalCount(data.total || entries.length);
        setHasMore(!!data.hasMore);
        if (data.league) setLeagueInfo(data.league);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setInitialLoadDone(true); });
  }, [token, period, friendsOnly, page]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Silent refresh every 30s while on page 1
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => { if (page === 1) fetchLeaderboard(); }, 30000);
    return () => clearInterval(id);
  }, [token, fetchLeaderboard, page]);

  const changePeriod = (p) => { setPeriod(p); setPage(1); };
  const toggleFriendsOnly = () => { setFriendsOnly((v) => !v); setPage(1); };

  // Countdown to next Monday (league reset)
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() + (now.getDay() === 0 ? 1 : 8 - now.getDay()));
      monday.setHours(0, 0, 0, 0);
      const ms = monday - now;
      if (ms <= 0) return setCountdown("soon");
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      setCountdown(d > 0 ? `${d}d ${h}h` : `${h}h`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Fetch live profile when a row is tapped
  useEffect(() => {
    if (!selectedUser || !token) return;
    setProfile(null);
    setProfileLoading(true);
    fetch(`${API_BASE}/users/${selectedUser.userId}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setProfile(data); setIsFollowing(!!data.isFollowing); })
      .catch(() => setProfile({
        username: selectedUser.username,
        avatar: selectedUser.avatar,
        xp: selectedUser.totalXP,
        streak: selectedUser.streak,
      }))
      .finally(() => setProfileLoading(false));
  }, [selectedUser, token]);

  const toggleFollow = async () => {
    if (!selectedUser?.userId || !token) return;
    setFollowBusy(true);
    try {
      const res = await fetch(`${API_BASE}/users/${selectedUser.userId}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(!!data.following);
      }
    } catch {} finally { setFollowBusy(false); }
  };

  const me = board.find((e) => e.isMe);
  const myRank = me ? board.indexOf(me) + 1 : null;
  const tier = TIER_META[leagueInfo?.tier] || TIER_META.bronze;
  const top3 = board.slice(0, 3);
  const rest = board.slice(3);
  const showTrend = period === "weekly";

  const openProfile = (e) => { if (!e.isMe) setSelectedUser(e); };

  const podiumCol = (e, rank) => {
    if (!e) return null;
    const name = e.isMe ? "You" : (e.fullName || e.username);
    return (
      <button
        key={e.userId || rank}
        className={`lb-pod rank${rank}${e.isMe ? " me" : ""}`}
        onClick={() => openProfile(e)}
      >
        <div className="lb-pod-av">
          {rank === 1 && <span className="lb-pod-crown">👑</span>}
          <Avatar user={e} size={rank === 1 ? 56 : 44} />
        </div>
        <span className="lb-pod-name">{name}</span>
        <LvlChip xp={e.totalXP} />
        <span className="lb-pod-xp">{(e.xp || 0).toLocaleString()} XP</span>
      </button>
    );
  };

  return (
    <div className="lb-root">
      {/* Header: title + league chip + my rank + reset countdown */}
      <div className="lb-head">
        <h2>Leaderboard</h2>
        <div className="lb-head-sub">
          <span className="lb-tier" style={{ color: tier.color }}>
            {tier.icon} {cap(leagueInfo?.tier || "bronze")} Circle
          </span>
          {myRank && <span className="lb-head-rank">#{myRank}</span>}
          {period === "weekly" && countdown && <span className="lb-head-reset">resets in {countdown}</span>}
        </div>
      </div>

      {/* Scope: period segment + friends toggle */}
      <div className="lb-scope">
        <div className="lb-seg">
          {[["weekly", "This week"], ["all", "All-time"]].map(([id, label]) => (
            <button
              key={id}
              className={`lb-seg-btn${period === id ? " on" : ""}`}
              onClick={() => changePeriod(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className={`lb-friends${friendsOnly ? " on" : ""}`}
          onClick={toggleFriendsOnly}
        >
          👥 Friends
        </button>
      </div>

      {leagueInfo && period === "weekly" && (leagueInfo.promoted || leagueInfo.demoted) && (
        <div className={`lb-league-note ${leagueInfo.promoted ? "up" : "down"}`}>
          {leagueInfo.promoted ? "⬆ Promoted last week — keep it up!" : "⬇ Demoted last week — climb back!"}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !initialLoadDone && (
        <div className="lb-skel">
          <div className="lb-skel-pods">
            <div className="lb-skel-circle" /><div className="lb-skel-circle lg" /><div className="lb-skel-circle" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="lb-skel-row" />)}
        </div>
      )}

      {/* Empty state */}
      {initialLoadDone && board.length === 0 && token && (
        <div className="lb-empty">
          <div className="lb-empty-ico">🏆</div>
          <h3>No rankings yet</h3>
          <p>{friendsOnly ? "Follow some scholars to see them here!" : "Be the first to study and claim the #1 spot!"}</p>
        </div>
      )}

      {/* Podium */}
      {top3.length > 0 && (
        <div className="lb-podium">
          {podiumCol(top3[1], 2)}
          {podiumCol(top3[0], 1)}
          {podiumCol(top3[2], 3)}
        </div>
      )}

      {/* Rank list */}
      {rest.length > 0 && (
        <div className="lb-list">
          {rest.map((e, i) => {
            const rank = i + 4;
            return (
              <button
                key={e.userId || e.username}
                className={`lb-row${e.isMe ? " me" : ""}`}
                onClick={() => openProfile(e)}
              >
                <span className="lb-rank">{rank}</span>
                <Avatar user={e} size={34} />
                <span className="lb-name">
                  <span className="lb-nm">{e.isMe ? "You" : (e.fullName || e.username)}</span>
                  <span className="lb-meta">
                    {e.streak > 0 && <>🔥 {e.streak}d</>}
                    {e.streak > 0 && " · "}
                    <LvlChip xp={e.totalXP} />
                  </span>
                </span>
                {showTrend && e.trend !== 0 && (
                  <span className={`lb-trend ${e.trend > 0 ? "up" : "down"}`}>
                    {e.trend > 0 ? "▲" : "▼"}{Math.abs(e.trend)}
                  </span>
                )}
                <span className="lb-xp">
                  {e.dailyXP > 0 && <em className="lb-today">+{e.dailyXP}</em>}
                  {(e.xp || 0).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button className="lb-more" onClick={() => setPage((p) => p + 1)}>
          Load more ({totalCount - board.length} remaining)
        </button>
      )}

      {!token && <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>Connect to the backend to see real rankings.</p>}

      {/* Profile sheet */}
      {selectedUser && (
        <div className="lb-sheet-back" onClick={() => setSelectedUser(null)}>
          <div className="lb-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="lb-sheet-handle" />
            {profileLoading ? (
              <p className="lb-sheet-loading">Loading profile…</p>
            ) : profile ? (
              <>
                <div className="lb-sheet-head">
                  <Avatar user={profile} size={52} />
                  <div className="lb-sheet-id">
                    <h3>{profile.fullName || profile.username}</h3>
                    <span>
                      @{profile.username}
                      {profile.level ? ` · ${profile.level}` : ""}
                      {profile.uni ? ` · ${profile.uni}` : ""}
                    </span>
                  </div>
                  {selectedUser.userId && !selectedUser.isMe && token && (
                    <button
                      className={`lb-follow${isFollowing ? " on" : ""}`}
                      onClick={toggleFollow}
                      disabled={followBusy}
                    >
                      {followBusy ? "…" : isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>

                {(profile.followerCount != null || profile.followingCount != null) && (
                  <div className="lb-sheet-follow">
                    <span><b>{profile.followerCount || 0}</b> followers</span>
                    <span><b>{profile.followingCount || 0}</b> following</span>
                  </div>
                )}

                <div className="lb-sheet-stats">
                  <div className="lb-sheet-stat"><b>{levelProgress(profile.xp || 0).level}</b><span>Level</span></div>
                  <div className="lb-sheet-stat"><b>{(profile.xp || 0).toLocaleString()}</b><span>Total XP</span></div>
                  <div className="lb-sheet-stat"><b>{profile.streak || 0}</b><span>🔥 Streak</span></div>
                  <div className="lb-sheet-stat"><b>{(profile.weeklyXP || 0).toLocaleString()}</b><span>This week</span></div>
                  <div className="lb-sheet-stat"><b>{profile.avgMastery || 0}%</b><span>Mastered</span></div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
