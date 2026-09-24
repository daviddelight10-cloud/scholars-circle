import { useState } from "react";
import { feedApi } from "./feedApi";
import { CommentsSection } from "./CommentsSection";
import { Avatar, displayTitle, relTime } from "./feedUi";

const TYPE_ICONS = {
  note: "📝", pdf: "📄", mcq: "❓", tutorial_question: "📘",
  flashcard_deck: "🃏", tutorial: "🎓",
};

export function DividerBlock({ label }) {
  return (
    <div className="fd-divider">
      <span>{label}</span>
    </div>
  );
}

export function ActivityRow({ item, onOpenResource, onJoinRoom, onOpenProfile }) {
  return (
    <div className="fd-activity">
      <span className="fd-activity-icon">{item.icon}</span>
      <div className="fd-activity-body">
        <span className="fd-activity-text">
          <b className="fd-name-btn" onClick={() => item.actor?.id && onOpenProfile?.(item.actor.id)}>{item.actor?.name}</b> {item.text}
        </span>
        <span className="fd-activity-ts">{relTime(item.ts)}</span>
      </div>
      {item.resource?.shareToken && (
        <button className="fd-link" onClick={() => onOpenResource?.(item.resource.shareToken)}>Open</button>
      )}
      {item.roomId && (
        <button className="fd-link" onClick={() => onJoinRoom?.(item.roomId)}>Join</button>
      )}
    </div>
  );
}

export function RoomCard({ room, me, onJoin, onLeave, onEnd, onOpenResource, compact }) {
  const seatsLeft = Math.max(0, (room.seats || room.maxSeats || 8) - (room.seatsUsed || 0));
  const isHost = me?.id && room.host?.id === me.id;
  const isIn = me?.id && (isHost || (room.participants || []).some(
    (p) => (p?.id === me.id) || (p?.userId === me.id) || (p?.user?.id === me.id)
  ));
  return (
    <div className={`fd-card fd-room ${compact ? "compact" : ""}`}>
      <div className="fd-room-top">
        <div className="fd-live-badge green">STUDYING</div>
        <div className="fd-room-seats">{room.seatsUsed || 0}/{room.seats || room.maxSeats || 8}</div>
      </div>
      <div className="fd-room-name">{room.name}</div>
      <div className="fd-room-meta">
        {[room.subject, room.focus, room.host?.name && `hosted by ${room.host.name}`]
          .filter(Boolean).join(" · ")}
      </div>
      {room.resource && (
        <button
          className="fd-material-chip"
          onClick={(e) => { e.stopPropagation(); room.resource.shareToken && onOpenResource?.(room.resource.shareToken); }}
          title="Open the material they're studying"
        >
          📄 {displayTitle(room.resource.title)}
        </button>
      )}
      {!compact && room.participants?.length > 0 && (
        <div className="fd-room-avatars">
          {room.participants.map((p, i) => (
            <Avatar key={p?.id || i} user={p} size={26} />
          ))}
        </div>
      )}
      {isIn ? (
        <div className="fd-room-inrow">
          <span className="fd-in-chip">✓ You're in</span>
          {!isHost && (
            <button className="fd-join-btn ghost" onClick={onLeave}>Leave</button>
          )}
          {isHost && (
            <button className="fd-join-btn danger" onClick={onEnd}>End room</button>
          )}
        </div>
      ) : (
        <button
          className={`fd-join-btn ${seatsLeft === 0 ? "disabled" : ""}`}
          disabled={seatsLeft === 0}
          onClick={onJoin}
        >
          {seatsLeft === 0 ? "Room full" : "Join room"}
        </button>
      )}
    </div>
  );
}

function ResourceInner({ resource, uni, token, onOpenResource }) {
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(resource.saved || 0);
  const toggleSave = async (e) => {
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    setSaveCount((c) => c + (next ? 1 : -1));
    try {
      await feedApi.toggleBookmark({ token, resourceId: resource.id, bookmarked: !next });
    } catch {
      setSaved(!next);
      setSaveCount((c) => c + (next ? -1 : 1));
    }
  };
  const stats = [
    resource.viewCount > 0 ? `${resource.viewCount} views` : null,
    saveCount > 0 ? `${saveCount} saves` : null,
    resource.comments > 0 ? `${resource.comments} comments` : null,
  ].filter(Boolean);
  return (
    <div className="fd-resource" onClick={() => resource.shareToken && onOpenResource?.(resource.shareToken)}>
      <div className="fd-resource-icon">{TYPE_ICONS[resource.contentType] || "📄"}</div>
      <div className="fd-resource-info">
        <div className="fd-resource-tag">{resource.subject}{uni ? ` · ${uni}` : ""}</div>
        <div className="fd-resource-title">{displayTitle(resource.title)}</div>
        <div className="fd-resource-meta">
          {stats.length > 0 ? stats.join(" · ") : <span className="fd-new-chip">New</span>}
        </div>
      </div>
      <button
        className={`fd-save-btn ${saved ? "saved" : ""}`}
        title={saved ? "Saved" : "Save to My Space"}
        onClick={toggleSave}
      >
        {saved ? "✓" : "🔖"}
      </button>
    </div>
  );
}

export function PostActions({ block, token, onDeleted, setCommentsOpen, commentCount, onOpenResource, onOpenTab }) {
  const isPost = block.type === "post";
  const isResource = block.type === "resource";
  const isFolder = block.type === "folder";
  const [liked, setLiked] = useState(!!block.liked);
  const [likes, setLikes] = useState(isResource ? block.resource?.likes || 0 : block.likes || 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [popTick, setPopTick] = useState(0);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((c) => c + (next ? 1 : -1));
    if (next) setPopTick((t) => t + 1);
    try {
      const res = isResource
        ? await feedApi.toggleResourceLike({ token, resourceId: block.resource.id })
        : await feedApi.toggleLike({ token, id: block.id });
      setLiked(res.liked);
      setLikes(res.count);
    } catch {
      setLiked(!next);
      setLikes((c) => c + (next ? -1 : 1));
    }
  };

  const share = async () => {
    const url = isFolder && block.folder?.shareToken
      ? `${window.location.origin}/folders/${block.folder.shareToken}`
      : block.resource?.shareToken
        ? `${window.location.origin}/r/${block.resource.shareToken}`
        : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: block.resource?.title || "Scholars Circle", text: block.text?.slice(0, 120), url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
    setMenuOpen(false);
  };

  const openTarget = () => {
    setMenuOpen(false);
    if (isResource && block.resource?.shareToken) onOpenResource?.(block.resource.shareToken);
    if (isFolder) onOpenTab?.("research-hub");
  };

  return (
    <div className="fd-actions">
      {(isPost || isResource) && (
        <button
          className={`fd-action ${liked ? "liked" : ""}`}
          onClick={toggleLike}
          title="Cheer them on"
        >
          <span key={popTick} className={`fd-action-icon ${popTick ? "pop" : ""}`}>👏</span>
          {likes > 0 ? `${likes} ` : ""}{liked ? "Cheered" : "Cheer"}
        </button>
      )}
      {(isPost || isResource) && (
        <button className="fd-action" onClick={() => setCommentsOpen?.((v) => !v)} title="Comments">
          <span className="fd-action-icon">💬</span>
          {commentCount > 0 ? commentCount : ""}
        </button>
      )}
      <button className="fd-action" onClick={share} title="Share">
        <span className="fd-action-icon">↗</span>
      </button>
      <div className="fd-action-menu-wrap">
        <button className="fd-action" onClick={() => setMenuOpen((v) => !v)} title="More">
          <span className="fd-action-icon">⋯</span>
        </button>
        {menuOpen && (
          <div className="fd-menu">
            <button onClick={share}>Share</button>
            {(isResource || isFolder) && (
              <button onClick={openTarget}>{isResource ? "Open resource" : "Open space"}</button>
            )}
            {isPost && block.isMine && (
              <button className="danger" onClick={() => { setMenuOpen(false); onDeleted?.(block.id); }}>
                Delete post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function FeedCard({ block, token, me, onOpenResource, onOpenTab, onDelete, onJoinRoom, onLeaveRoom, onEndRoom, onOpenProfile, onJoinQuiz }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(block.comments ?? block.resource?.comments ?? 0);
  const [acceptedId, setAcceptedId] = useState(block.acceptedCommentId || null);

  if (block.type === "divider") return <DividerBlock label={block.label} />;

  if (block.type === "activity") {
    return (
      <ActivityRow
        item={{ icon: block.icon, actor: block.actor, text: block.text, ts: block.ts, resource: block.resource, roomId: block.roomId }}
        onOpenResource={onOpenResource}
        onJoinRoom={onJoinRoom}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  if (block.type === "room") {
    return (
      <RoomCard
        room={block.room}
        me={me}
        onJoin={() => onJoinRoom?.(block.room)}
        onLeave={() => onLeaveRoom?.(block.room)}
        onEnd={() => onEndRoom?.(block.room)}
        onOpenResource={onOpenResource}
      />
    );
  }

  if (block.type === "folder") {
    const folderStats = [
      block.folder.resourceCount > 0 ? `${block.folder.resourceCount} materials` : null,
      block.folder.saves > 0 ? `${block.folder.saves} saves` : null,
    ].filter(Boolean);
    return (
      <div className="fd-card">
        <div className="fd-card-head">
          <button className="fd-who-btn" onClick={() => block.author?.id && onOpenProfile?.(block.author.id)}>
            <Avatar user={block.author} />
          </button>
          <div className="fd-card-who">
            <div className="fd-card-name">
              <button className="fd-name-btn" onClick={() => block.author?.id && onOpenProfile?.(block.author.id)}>
                {block.author?.name}
              </button>
            </div>
            <div className="fd-card-meta">shared a space · {relTime(block.ts)}</div>
          </div>
        </div>
        <div className="fd-folder" onClick={() => onOpenTab?.("research-hub")}>
          <div className="fd-resource-icon">📁</div>
          <div className="fd-resource-info">
            <div className="fd-resource-tag">
              {[block.folder.courseCode, block.folder.level, block.uni].filter(Boolean).join(" · ") || "Space"}
            </div>
            <div className="fd-resource-title">{block.folder.name}</div>
            <div className="fd-resource-meta">
              {folderStats.length > 0 ? folderStats.join(" · ") : <span className="fd-new-chip">New</span>}
            </div>
          </div>
          <span className="fd-link">Open</span>
        </div>
        <PostActions
          block={block}
          token={token}
          onDeleted={onDelete}
          onOpenResource={onOpenResource}
          onOpenTab={onOpenTab}
        />
      </div>
    );
  }

  if (block.type === "resource") {
    return (
      <div className="fd-card">
        <div className="fd-card-head">
          <button className="fd-who-btn" onClick={() => block.author?.id && onOpenProfile?.(block.author.id)}>
            <Avatar user={block.author} />
          </button>
          <div className="fd-card-who">
            <div className="fd-card-name">
              <button className="fd-name-btn" onClick={() => block.author?.id && onOpenProfile?.(block.author.id)}>
                {block.author?.name}
              </button>
            </div>
            <div className="fd-card-meta">uploaded a resource · {relTime(block.ts)}</div>
          </div>
        </div>
        <ResourceInner resource={block.resource} uni={block.uni} token={token} onOpenResource={onOpenResource} />
        <PostActions
          block={block}
          token={token}
          onDeleted={onDelete}
          setCommentsOpen={setCommentsOpen}
          commentCount={commentCount}
          onOpenResource={onOpenResource}
          onOpenTab={onOpenTab}
        />
        {commentsOpen && (
          <CommentsSection
            token={token}
            me={me}
            kind="resource"
            targetId={block.resource.id}
            onCountChange={setCommentCount}
          />
        )}
      </div>
    );
  }

  // post
  const isActivity = block.kind === "activity";
  return (
    <div className={`fd-card ${isActivity ? "fd-activity-card" : ""} ${block.kind === "question" ? "is-question" : ""}`}>
      <div className="fd-card-head">
        <button className="fd-who-btn" onClick={() => block.author?.id && onOpenProfile?.(block.author.id)}>
          <Avatar user={block.author} />
        </button>
        <div className="fd-card-who">
          <div className="fd-card-name">
            <button className="fd-name-btn" onClick={() => block.author?.id && onOpenProfile?.(block.author.id)}>
              {block.author?.name}
            </button>
            {block.author?.role === "LECTURER" || block.author?.role === "TEACHER" ? (
              <span className="fd-badge">Faculty</span>
            ) : null}
          </div>
          <div className="fd-card-meta">
            {block.author?.uni || block.author?.handle || ""} · {relTime(block.ts)}
          </div>
        </div>
        {block.kind === "question" && (
          <span className={`fd-card-kind question ${acceptedId ? "answered" : ""}`}>
            {acceptedId ? "✓ Answered" : "Question"}
          </span>
        )}
      </div>

      {isActivity ? (
        <div className="fd-activity">
          <span className="fd-activity-icon">{block.liveCode ? "⚡" : /streak/i.test(block.text || "") ? "🔥" : "✨"}</span>
          <div className="fd-activity-body">
            <span className="fd-activity-text"><b>{block.author?.name}</b> {block.text}</span>
            {block.liveCode && (
              <button className="fd-joinlive-btn" onClick={() => onJoinQuiz?.(block.liveCode)}>
                ⚡ Join live
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="fd-card-text">{block.text}</div>
      )}

      {block.resource && (
        <ResourceInner resource={block.resource} uni={block.author?.uni} token={token} onOpenResource={onOpenResource} />
      )}

      <PostActions
        block={block}
        token={token}
        onDeleted={onDelete}
        setCommentsOpen={setCommentsOpen}
        commentCount={commentCount}
        onOpenResource={onOpenResource}
        onOpenTab={onOpenTab}
      />

      {commentsOpen && (
        <CommentsSection
          token={token}
          me={me}
          kind="post"
          targetId={block.id}
          isQuestion={block.kind === "question"}
          postAuthorId={block.author?.id}
          acceptedCommentId={acceptedId}
          onAccepted={setAcceptedId}
          onOpenProfile={onOpenProfile}
          onCountChange={setCommentCount}
        />
      )}
    </div>
  );
}
