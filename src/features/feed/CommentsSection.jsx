import { useEffect, useState } from "react";
import { feedApi } from "./feedApi";
import { Avatar, relTime } from "./feedUi";

export function CommentsSection({ token, me, kind, targetId, isQuestion, postAuthorId, acceptedCommentId, onAccepted, onOpenProfile, onCountChange }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(null);
  const isPost = kind === "post";
  const canAccept = isPost && isQuestion && postAuthorId && me?.id === postAuthorId;

  useEffect(() => {
    let alive = true;
    const load = isPost
      ? feedApi.getComments({ token, postId: targetId })
      : feedApi.getResourceComments({ token, resourceId: targetId });
    load
      .then((list) => {
        if (!alive) return;
        const normalized = (list || []).map((c) => ({
          id: c.id,
          text: c.text,
          ts: c.ts || c.createdAt,
          author: c.author || { id: c.user?.id, name: c.user?.fullName || c.user?.username || "Scholar" },
          likes: c.likes || 0,
          liked: !!c.liked,
          isMine: c.isMine || c.user?.id === me?.id,
          isAccepted: !!c.isAccepted,
        }));
        setComments(normalized);
        onCountChange?.(normalized.length);
      })
      .catch(() => alive && setComments([]));
    return () => { alive = false; };
  }, [token, kind, targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const created = isPost
        ? await feedApi.addComment({ token, postId: targetId, text: t })
        : await feedApi.addResourceComment({ token, resourceId: targetId, text: t });
      const normalized = {
        id: created.id,
        text: created.text,
        ts: created.ts || created.createdAt,
        author: created.author || { id: me?.id, name: me?.name || "You" },
        likes: 0,
        liked: false,
        isMine: true,
      };
      setComments((prev) => [...(prev || []), normalized]);
      setText("");
      onCountChange?.((comments?.length || 0) + 1);
    } catch {} finally {
      setBusy(false);
    }
  };

  const likeComment = async (c) => {
    if (!isPost) return;
    setComments((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x))
    );
    try {
      const res = await feedApi.toggleCommentLike({ token, commentId: c.id });
      setComments((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, liked: res.liked, likes: res.count } : x))
      );
    } catch {}
  };

  const accept = async (c) => {
    if (acceptBusy) return;
    setAcceptBusy(c.id);
    try {
      const res = await feedApi.acceptAnswer({ token, postId: targetId, commentId: c.id });
      const aid = res.acceptedCommentId;
      setComments((prev) => prev.map((x) => ({ ...x, isAccepted: x.id === aid })));
      onAccepted?.(aid);
    } catch {} finally {
      setAcceptBusy(null);
    }
  };

  const accepted = comments?.find((c) => c.isAccepted || c.id === acceptedCommentId);

  return (
    <div className="fd-comments">
      {comments === null && <div className="fd-comments-loading">Loading…</div>}
      {accepted && (
        <div className="fd-comment accepted">
          <Avatar user={accepted.author} size={28} />
          <div className="fd-comment-body">
            <div className="fd-comment-head">
              <b className="fd-name-btn" onClick={() => accepted.author?.id && onOpenProfile?.(accepted.author.id)}>{accepted.author?.name}</b>
              <span className="fd-accepted-chip">✓ Best answer</span>
            </div>
            <div className="fd-comment-text">{accepted.text}</div>
          </div>
        </div>
      )}
      {comments?.filter((c) => !c.isAccepted && c.id !== acceptedCommentId).map((c) => (
        <div key={c.id} className="fd-comment">
          <Avatar user={c.author} size={28} />
          <div className="fd-comment-body">
            <div className="fd-comment-head">
              <b className="fd-name-btn" onClick={() => c.author?.id && onOpenProfile?.(c.author.id)}>{c.author?.name}</b>
              <span className="fd-activity-ts">{relTime(c.ts)}</span>
            </div>
            <div className="fd-comment-text">{c.text}</div>
            {canAccept && !accepted && (
              <button
                className="fd-accept-btn"
                disabled={acceptBusy === c.id}
                onClick={() => accept(c)}
              >
                {acceptBusy === c.id ? "Marking…" : "✓ Mark as answer"}
              </button>
            )}
            {canAccept && accepted && (
              <button
                className="fd-accept-btn ghost"
                disabled={acceptBusy === c.id}
                onClick={() => accept(c)}
                title="Change the accepted answer"
              >
                {acceptBusy === c.id ? "Marking…" : "Mark instead"}
              </button>
            )}
          </div>
          {isPost && (
            <button
              className={`fd-comment-like ${c.liked ? "liked" : ""}`}
              onClick={() => likeComment(c)}
            >
              {c.liked ? "♥" : "♡"}{c.likes > 0 ? ` ${c.likes}` : ""}
            </button>
          )}
        </div>
      ))}
      <div className="fd-comment-input">
        <Avatar user={me} size={28} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={isPost ? "Write a reply…" : "Ask the author…"}
        />
        <button className="fd-send" disabled={!text.trim() || busy} onClick={submit}>
          Send
        </button>
      </div>
    </div>
  );
}
