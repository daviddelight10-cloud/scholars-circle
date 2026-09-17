import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feedApi } from "./feedApi";
import { FeedCard, ActivityRow, RoomCard, DividerBlock } from "./FeedCard";
import { Composer } from "./Composer";
import { Avatar } from "./feedUi";
import { usePullToRefresh } from "../../lib/usePullToRefresh";
import NotificationBell from "../NotificationBellImproved.jsx";
import "../../feed.css";

const TABS = [
  { key: "forYou", label: "For You" },
  { key: "circle", label: "My Circle" },
  { key: "live", label: "Live" },
];

export default function Feed({ authUser, token, subjects = [], onOpenTab, onOpenSearch, onOpenResource }) {
  const [tab, setTab] = useState("forYou");
  const [subject, setSubject] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [newPosts, setNewPosts] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [circle, setCircle] = useState({ following: [], digest: [] });
  const [rooms, setRooms] = useState([]);
  const [sessions, setSessions] = useState({ live: [], upcoming: [] });
  const [streakOpen, setStreakOpen] = useState(false);
  const [fsrsStats, setFsrsStats] = useState(null);
  const [dailyReviews, setDailyReviews] = useState({});
  const [followBusy, setFollowBusy] = useState({});
  const topRef = useRef(null);

  const me = useMemo(
    () => ({
      id: authUser?.id,
      name: authUser?.fullName || authUser?.username || "You",
      username: authUser?.username,
      avatar: authUser?.avatar,
    }),
    [authUser]
  );

  const subjectChips = useMemo(() => {
    const set = new Set();
    subjects.forEach((s) => s.label && set.add(s.label));
    blocks.forEach((b) => {
      const subj = b.resource?.subject || b.room?.subject;
      if (subj) set.add(subj);
    });
    return [...set].slice(0, 12);
  }, [subjects, blocks]);

  const loadFeed = useCallback(
    async ({ cursor, quiet } = {}) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const scope = tab === "circle" ? "circle" : "forYou";
        const data = await feedApi.getFeed({ token, scope, subject, cursor });
        if (cursor) {
          setBlocks((prev) => [...prev, ...(data.blocks || [])]);
        } else {
          setBlocks(data.blocks || []);
        }
        setNextCursor(data.nextCursor || null);
      } catch (err) {
        if (!cursor) setError(err.message || "Couldn't load your feed");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, tab, subject]
  );

  const loadAux = useCallback(async () => {
    feedApi.getSuggested({ token }).then(setSuggested).catch(() => {});
    feedApi.getPublicRooms({ token }).then(setRooms).catch(() => setRooms([]));
    feedApi.getFsrsStats({ token }).then(setFsrsStats).catch(() => {});
    feedApi
      .getFsrsAnalytics({ token })
      .then((a) => setDailyReviews(a?.dailyReviews || {}))
      .catch(() => {});
    if (tab === "circle") {
      feedApi.getCircle({ token }).then(setCircle).catch(() => {});
    }
    if (tab === "live") {
      Promise.all([
        feedApi.getLiveSessions({ token }).catch(() => []),
        feedApi.getUpcomingSessions({ token }).catch(() => []),
      ])
        .then(([live, upcoming]) => setSessions({ live: live || [], upcoming: upcoming || [] }))
        .catch(() => {});
    }
  }, [token, tab]);

  useEffect(() => {
    setBlocks([]);
    setNextCursor(null);
    setNewPosts(false);
    loadFeed();
    loadAux();
  }, [loadFeed, loadAux]);

  // Light polling for "new posts" pill
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const scope = tab === "circle" ? "circle" : "forYou";
        const data = await feedApi.getFeed({ token, scope, subject });
        const newest = data.blocks?.[0]?.ts;
        const mine = blocks[0]?.ts;
        if (newest && mine && new Date(newest) > new Date(mine)) setNewPosts(true);
      } catch {}
    }, 45000);
    return () => clearInterval(iv);
  }, [token, tab, subject, blocks]);

  const ptr = usePullToRefresh(async () => {
    setNewPosts(false);
    await Promise.all([loadFeed({ quiet: true }), loadAux()]);
  });

  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    loadFeed({ cursor: nextCursor, quiet: true });
  };

  const handlePosted = (post) => {
    setBlocks((prev) => [{ ...post, type: "post" }, ...prev]);
  };

  const handleDeletePost = async (id) => {
    try {
      await feedApi.deletePost({ token, id });
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFollow = async (user) => {
    setFollowBusy((p) => ({ ...p, [user.id]: true }));
    try {
      await feedApi.follow({ token, userId: user.id });
      setSuggested((prev) => prev.filter((u) => u.id !== user.id));
      if (tab === "circle") feedApi.getCircle({ token }).then(setCircle).catch(() => {});
    } catch {} finally {
      setFollowBusy((p) => ({ ...p, [user.id]: false }));
    }
  };

  const handleJoinRoom = async (roomOrId) => {
    const room = typeof roomOrId === "string" ? { id: roomOrId } : roomOrId;
    try {
      await feedApi.joinRoom({ token, roomId: room.id });
      feedApi.getPublicRooms({ token }).then(setRooms).catch(() => {});
      // Room is anchored on a material — open it so you study the same doc
      if (room.resource?.shareToken) onOpenResource?.(room.resource.shareToken);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleJoinSession = async (session) => {
    try {
      const res = await feedApi.joinSession({ token, sessionId: session.id });
      if (res.roomName) window.open(`https://meet.jit.si/${res.roomName}`, "_blank");
    } catch (err) {
      alert(err.message);
    }
  };

  const streakDays = useMemo(() => {
    const days = [];
    for (let i = 20; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, active: (dailyReviews[key] || 0) > 0, today: i === 0 });
    }
    return days;
  }, [dailyReviews]);

  const renderBlocks = () => {
    const out = [];
    blocks.forEach((b, i) => {
      // Suggested people strip after the 4th card
      if (i === 4 && suggested.length > 0 && tab !== "circle") {
        out.push(
          <div key="suggested-strip" className="fd-strip">
            <div className="fd-strip-head">
              <span>People to follow</span>
              <span className="fd-strip-hint">Same campus energy</span>
            </div>
            <div className="fd-strip-scroll">
              {suggested.map((u) => (
                <div key={u.id} className="fd-person">
                  <Avatar user={u} size={44} />
                  <div className="fd-person-name">{u.name}</div>
                  <div className="fd-person-meta">{u.uni || `${u.xp} XP`}</div>
                  <button
                    className="fd-follow-btn"
                    disabled={followBusy[u.id]}
                    onClick={() => handleFollow(u)}
                  >
                    {followBusy[u.id] ? "…" : "Follow"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }
      // Live study rooms strip after the 8th card
      if (i === 8 && rooms.length > 0 && tab === "forYou") {
        out.push(
          <div key="rooms-strip" className="fd-strip">
            <div className="fd-strip-head">
              <span>Studying now</span>
              <button className="fd-link" onClick={() => setTab("live")}>See all</button>
            </div>
            <div className="fd-strip-scroll">
              {rooms.slice(0, 6).map((r) => (
                <div key={r.id} className="fd-room-mini">
                  <div className="fd-room-mini-name">{r.name}</div>
                  <div className="fd-room-mini-meta">
                    {r.resource?.title || r.subject || "Open study"} · {r.seatsUsed}/{r.maxSeats} seats
                  </div>
                  <button className="fd-join-btn" onClick={() => handleJoinRoom(r)}>Join</button>
                </div>
              ))}
            </div>
          </div>
        );
      }
      out.push(
        <FeedCard
          key={b.id}
          block={b}
          token={token}
          me={me}
          onOpenResource={onOpenResource}
          onOpenTab={onOpenTab}
          onDelete={handleDeletePost}
          onJoinRoom={handleJoinRoom}
        />
      );
    });
    return out;
  };

  return (
    <div ref={ptr.ref} className="fd-root">
      <div style={ptr.indicatorStyle} className="fd-ptr">
        {ptr.showSpinner ? "Refreshing…" : "↓ Pull to refresh"}
      </div>

      <header className="fd-topbar" ref={topRef}>
        <div className="fd-topbar-left">
          <button className="fd-me" onClick={() => onOpenTab?.("profile")} title="Profile">
            <Avatar user={me} size={34} />
          </button>
          <div className="fd-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`fd-tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fd-topbar-right">
          <button className="fd-chip-btn" onClick={() => setStreakOpen((v) => !v)} title="Streak">
            🔥 {fsrsStats?.streak ?? 0}
          </button>
          <button className="fd-icon-btn" onClick={() => onOpenSearch?.()} title="Search">⌕</button>
          <NotificationBell token={token} currentUser={authUser} onOpenTab={onOpenTab} />
        </div>
      </header>

      {streakOpen && (
        <div className="fd-streak-pop">
          <div className="fd-streak-num">🔥 {fsrsStats?.streak ?? 0}-day streak</div>
          <div className="fd-streak-grid">
            {streakDays.map((d) => (
              <span
                key={d.key}
                className={`fd-streak-dot ${d.active ? "on" : ""} ${d.today ? "today" : ""}`}
                title={d.key}
              />
            ))}
          </div>
          <div className="fd-streak-hint">Review cards daily to keep it alive</div>
        </div>
      )}

      <div className="fd-layout">
        <main className="fd-main">
          {tab !== "live" && (
            <>
              <div className="fd-chips">
                <button
                  className={`fd-chip ${!subject ? "active" : ""}`}
                  onClick={() => setSubject(null)}
                >
                  All
                </button>
                {subjectChips.map((s) => (
                  <button
                    key={s}
                    className={`fd-chip ${subject === s ? "active" : ""}`}
                    onClick={() => setSubject(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <Composer token={token} me={me} subjects={subjects} onPosted={handlePosted}
                onRoomsChanged={() => feedApi.getPublicRooms({ token }).then(setRooms).catch(() => {})} />
            </>
          )}

          {tab === "circle" && (
            <div className="fd-circle">
              <div className="fd-strip">
                <div className="fd-strip-head">
                  <span>Your circle</span>
                  <span className="fd-strip-hint">{circle.following.length} following</span>
                </div>
                <div className="fd-strip-scroll">
                  {circle.following.length === 0 && (
                    <div className="fd-empty-inline">Follow people to build your circle</div>
                  )}
                  {circle.following.map((u) => (
                    <div key={u.id} className="fd-person">
                      <Avatar user={u} size={44} />
                      <div className="fd-person-name">{u.name}</div>
                      <div className="fd-person-meta">{u.handle}</div>
                    </div>
                  ))}
                </div>
              </div>
              {circle.digest.length > 0 && (
                <div className="fd-digest">
                  <DividerBlock label="From your circle today" />
                  {circle.digest.map((d, i) => (
                    <ActivityRow key={i} item={d} onOpenResource={onOpenResource} onJoinRoom={handleJoinRoom} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "live" && (
            <LiveTab
              token={token}
              me={me}
              rooms={rooms}
              sessions={sessions}
              subjects={subjects}
              onJoinRoom={handleJoinRoom}
              onJoinSession={handleJoinSession}
              onOpenResource={onOpenResource}
              onRoomsChanged={() => feedApi.getPublicRooms({ token }).then(setRooms).catch(() => {})}
            />
          )}

          {newPosts && (
            <button
              className="fd-new-pill"
              onClick={() => {
                setNewPosts(false);
                loadFeed({ quiet: true });
              }}
            >
              ↑ New posts
            </button>
          )}

          {tab !== "live" && (
            <>
              {loading && (
                <div className="fd-skeletons">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="fd-card fd-skeleton" />
                  ))}
                </div>
              )}
              {error && !loading && (
                <div className="fd-empty">
                  <div className="fd-empty-title">Couldn't load your feed</div>
                  <div className="fd-empty-sub">{error}</div>
                  <button className="fd-follow-btn" onClick={() => loadFeed()}>Retry</button>
                </div>
              )}
              {!loading && !error && blocks.length === 0 && (
                <div className="fd-empty">
                  <div className="fd-empty-title">
                    {tab === "circle" ? "Your circle is quiet" : "Nothing here yet"}
                  </div>
                  <div className="fd-empty-sub">
                    {tab === "circle"
                      ? "Follow classmates and their activity shows up here."
                      : "Share a resource or go live with friends to get things moving."}
                  </div>
                  {suggested.length > 0 && tab === "circle" && (
                    <div className="fd-strip-scroll" style={{ marginTop: 14 }}>
                      {suggested.map((u) => (
                        <div key={u.id} className="fd-person">
                          <Avatar user={u} size={44} />
                          <div className="fd-person-name">{u.name}</div>
                          <div className="fd-person-meta">{u.uni || `${u.xp} XP`}</div>
                          <button
                            className="fd-follow-btn"
                            disabled={followBusy[u.id]}
                            onClick={() => handleFollow(u)}
                          >
                            Follow
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {renderBlocks()}
              {nextCursor && !loading && (
                <button className="fd-more-btn" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </main>

        <aside className="fd-rail">
          <div className="fd-rail-card">
            <div className="fd-rail-title">🔥 {fsrsStats?.streak ?? 0}-day streak</div>
            <div className="fd-streak-grid">
              {streakDays.map((d) => (
                <span key={d.key} className={`fd-streak-dot ${d.active ? "on" : ""}`} />
              ))}
            </div>
          </div>
          {rooms.length > 0 && (
            <div className="fd-rail-card">
              <div className="fd-rail-title">Studying now</div>
              {rooms.slice(0, 4).map((r) => (
                <RoomCard key={r.id} room={r} compact onJoin={() => handleJoinRoom(r)} onOpenResource={onOpenResource} />
              ))}
            </div>
          )}
          {suggested.length > 0 && (
            <div className="fd-rail-card">
              <div className="fd-rail-title">People to follow</div>
              {suggested.slice(0, 5).map((u) => (
                <div key={u.id} className="fd-rail-person">
                  <Avatar user={u} size={34} />
                  <div className="fd-rail-person-info">
                    <div className="fd-person-name">{u.name}</div>
                    <div className="fd-person-meta">{u.uni || `${u.xp} XP`}</div>
                  </div>
                  <button
                    className="fd-follow-btn sm"
                    disabled={followBusy[u.id]}
                    onClick={() => handleFollow(u)}
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function LiveTab({ token, me, rooms, sessions, subjects, onJoinRoom, onJoinSession, onOpenResource, onRoomsChanged }) {
  return (
    <div className="fd-live">
      <Composer
        token={token}
        me={me}
        subjects={subjects}
        liveOnly
        onPosted={() => {}}
        onRoomsChanged={onRoomsChanged}
      />

      {rooms.length > 0 && (
        <div className="fd-section">
          <DividerBlock label="Studying now" />
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} onJoin={() => onJoinRoom(r)} onOpenResource={onOpenResource} />
          ))}
        </div>
      )}

      {sessions.live.length > 0 && (
        <div className="fd-section">
          <DividerBlock label="Live class sessions" />
          {sessions.live.map((s) => (
            <div key={s.id} className="fd-card fd-session">
              <div className="fd-live-badge">● LIVE</div>
              <div className="fd-session-title">{s.title}</div>
              <div className="fd-session-meta">{s.classroom?.name || "Class session"}</div>
              <button className="fd-join-btn" onClick={() => onJoinSession(s)}>Join session</button>
            </div>
          ))}
        </div>
      )}

      {sessions.upcoming.length > 0 && (
        <div className="fd-section">
          <DividerBlock label="Upcoming" />
          {sessions.upcoming.map((s) => (
            <div key={s.id} className="fd-card fd-session">
              <div className="fd-session-title">{s.title}</div>
              <div className="fd-session-meta">
                {s.classroom?.name} · {new Date(s.scheduledFor).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
      )}

      {rooms.length === 0 && sessions.live.length === 0 && sessions.upcoming.length === 0 && (
        <div className="fd-empty">
          <div className="fd-empty-title">Nobody's live right now</div>
          <div className="fd-empty-sub">Go live with friends and your circle gets to join your study room.</div>
        </div>
      )}
    </div>
  );
}
