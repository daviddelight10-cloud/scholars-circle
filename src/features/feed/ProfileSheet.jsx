import { useEffect, useState } from "react";
import { feedApi } from "./feedApi";
import { Avatar, relTime } from "./feedUi";

export function ProfileSheet({ token, userId, onClose, onOpenResource, onFollowChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    feedApi
      .getFeedUser({ token, userId })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setFollowing(!!d.isFollowing);
      })
      .catch((e) => alive && setError(e.message || "Couldn't load profile"));
    return () => { alive = false; };
  }, [token, userId]);

  const toggleFollow = async () => {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      if (next) {
        await feedApi.follow({ token, userId });
      } else {
        await feedApi.unfollow({ token, userId });
      }
      onFollowChanged?.();
      setData((d) =>
        d ? { ...d, user: { ...d.user, followers: (d.user.followers || 0) + (next ? 1 : -1) } } : d
      );
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  };

  const u = data?.user;

  return (
    <div className="fd-sheet-backdrop" onClick={onClose}>
      <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="fd-sheet-close" onClick={onClose}>✕</button>

        {!data && !error && <div className="fd-sheet-loading">Loading profile…</div>}
        {error && (
          <div className="fd-sheet-loading">
            {error}
            <button className="fd-follow-btn" onClick={onClose} style={{ marginTop: 10 }}>Close</button>
          </div>
        )}

        {data && u && (
          <>
            <div className="fd-profile-head">
              <Avatar user={u} size={64} />
              <div className="fd-profile-who">
                <div className="fd-profile-name">
                  {u.name}
                  {u.role === "LECTURER" || u.role === "TEACHER" ? <span className="fd-badge">Faculty</span> : null}
                </div>
                <div className="fd-profile-meta">
                  {[u.handle, u.uni, u.department, u.level && `Level ${u.level}`].filter(Boolean).join(" · ")}
                </div>
                <div className="fd-profile-meta">{u.followers} followers · {u.following} following{data.followsMe ? " · follows you" : ""}</div>
              </div>
            </div>

            {!data.isMe && (
              <button
                className={`fd-follow-btn wide ${following ? "following" : ""}`}
                disabled={busy}
                onClick={toggleFollow}
              >
                {busy ? "…" : following ? "Following ✓" : "Follow"}
              </button>
            )}

            <div className="fd-profile-stats">
              <div className="fd-stat"><b>{u.xp}</b><span>XP</span></div>
              <div className="fd-stat"><b>🔥 {u.streak}</b><span>Streak</span></div>
              <div className="fd-stat"><b>{u.sessions}</b><span>Sessions</span></div>
              <div className="fd-stat"><b>{u.totalCorrect}</b><span>Correct</span></div>
            </div>

            {data.badges?.length > 0 && (
              <div className="fd-profile-badges">
                {data.badges.map((b, i) => (
                  <span key={i} className="fd-badge-chip" title={b.name}>{b.icon} {b.name}</span>
                ))}
              </div>
            )}

            {data.posts?.length > 0 && (
              <div className="fd-profile-posts">
                <div className="fd-strip-head"><span>Recent posts</span></div>
                {data.posts.map((p) => (
                  <div key={p.id} className="fd-profile-post">
                    {p.kind === "question" && <span className="fd-card-kind question sm">Q</span>}
                    {p.kind === "activity" && <span className="fd-card-kind sm">🔥</span>}
                    <div className="fd-profile-post-body">
                      <div className="fd-profile-post-text">{p.text || (p.resource ? `Shared ${p.resource.title}` : "")}</div>
                      <div className="fd-card-meta">
                        {relTime(p.ts)} · ♥ {p.likes} · 💬 {p.comments}
                        {p.acceptedCommentId ? " · ✓ answered" : ""}
                      </div>
                    </div>
                    {p.resource?.shareToken && (
                      <button className="fd-link" onClick={() => onOpenResource?.(p.resource.shareToken)}>Open</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data.posts?.length === 0 && (
              <div className="fd-empty-inline" style={{ marginTop: 14 }}>No posts yet</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
