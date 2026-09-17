import { useState } from "react";
import { feedApi } from "./feedApi";
import { CommentsSection } from "./CommentsSection";
import { Avatar, relTime } from "./feedUi";

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

export function ActivityRow({ item, onOpenResource, onJoinRoom }) {
  return (
    <div className="fd-activity">
      <span className="fd-activity-icon">{item.icon}</span>
      <div className="fd-activity-body">
        <span className="fd-activity-text">
          <b>{item.actor?.name}</b> {item.text}
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

export function RoomCard({ room, onJoin, onOpenResource, compact }) {
  const seatsLeft = Math.max(0, (room.seats || room.maxSeats || 8) - (room.seatsUsed || 0));
  return (
    <div className={`fd-card fd-room ${compact ? "compact" : ""}`}>
      <div className="fd-room-top">
        <div className="fd-live-badge green">● STUDYING</div>
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
          📄 {room.resource.title}
        </button>
      )}
      {!compact && room.participants?.length > 0 && (
        <div className="fd-room-avatars">
          {room.participants.map((p, i) => (
            <Avatar key={p?.id || i} user={p} size={26} />
          ))}
        </div>
      )}
      <button
        className={`fd-join-btn ${seatsLeft === 0 ? "disabled" : ""}`}
        disabled={seatsLeft === 0}
        onClick={onJoin}
      >
        {seatsLeft === 0 ? "Room full" : "Join room"}
      </button>
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
  return (
    <div className="fd-resource" onClick={() => resource.shareToken && onOpenResource?.(resource.shareToken)}>
      <div className="fd-resource-icon">{TYPE_ICONS[resource.contentType] || "📄"}</div>
      <div className="fd-resource-info">
        <div className="fd-resource-tag">{resource.subject}{uni ? ` · ${uni}` : ""}</div>
        <div className="fd-resource-title">{resource.title}</div>
        <div className="fd-resource-meta">
          {resource.viewCount || 0} views · {saveCount} saves
          {resource.comments != null ? ` · ${resource.comments} comments` : ""}
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

function PostActions({ block, token, onDeleted, setCommentsOpen, commentCount }) {
  const [liked, setLiked] = useState(block.liked);
  const [likes, setLikes] = useState(block.likes || 0);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((c) => c + (next ? 1 : -1));
    try {
      const res = await feedApi.toggleLike({ token, id: block.id });
      setLiked(res.liked);
      setLikes(res.count);
    } catch {
      setLiked(!next);
      setLikes((c) => c + (next ? -1 : 1));
    }
  };

  const share = async () => {
    const url = block.resource?.shareToken
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

  return (
    <div className="fd-actions">
      <button className={`fd-action ${liked ? "liked" : ""}`} onClick={toggleLike}>
        {liked ? "♥" : "♡"} {likes > 0 ? likes : ""}
      </button>
      <button className="fd-action" onClick={() => setCommentsOpen((v) => !v)}>
        💬 {commentCount > 0 ? commentCount : ""}
      </button>
      <button className="fd-action" onClick={share}>↗</button>
      <div className="fd-action-menu-wrap">
        <button className="fd-action" onClick={() => setMenuOpen((v) => !v)}>⋯</button>
        {menuOpen && (
          <div className="fd-menu">
            <button onClick={share}>Share</button>
            {block.isMine && (
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

export function FeedCard({ block, token, me, onOpenResource, onOpenTab, onDelete, onJoinRoom }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(block.comments || 0);

  if (block.type === "divider") return <DividerBlock label={block.label} />;

  if (block.type === "activity") {
    return (
      <ActivityRow
        item={{ icon: block.icon, actor: block.actor, text: block.text, ts: block.ts, resource: block.resource, roomId: block.roomId }}
        onOpenResource={onOpenResource}
        onJoinRoom={onJoinRoom}
      />
    );
  }

  if (block.type === "room") {
    return <RoomCard room={block.room} onJoin={() => onJoinRoom?.(block.room)} onOpenResource={onOpenResource} />;
  }

  if (block.type === "folder") {
    return (
      <div className="fd-card">
        <div className="fd-card-head">
          <Avatar user={block.author} />
          <div className="fd-card-who">
            <div className="fd-card-name">{block.author?.name}</div>
            <div className="fd-card-meta">{block.author?.uni || block.author?.handle || ""} · {relTime(block.ts)}</div>
          </div>
          <span className="fd-card-kind">shared a space</span>
        </div>
        <div className="fd-folder" onClick={() => onOpenTab?.("research-hub")}>
          <div className="fd-resource-icon">📁</div>
          <div className="fd-resource-info">
            <div className="fd-resource-tag">
              {[block.folder.courseCode, block.folder.level, block.uni].filter(Boolean).join(" · ") || "Space"}
            </div>
            <div className="fd-resource-title">{block.folder.name}</div>
            <div className="fd-resource-meta">
              {block.folder.resourceCount} materials · {block.folder.saves} saves
            </div>
          </div>
          <span className="fd-link">Open</span>
        </div>
      </div>
    );
  }

  if (block.type === "resource") {
    return (
      <div className="fd-card">
        <div className="fd-card-head">
          <Avatar user={block.author} />
          <div className="fd-card-who">
            <div className="fd-card-name">{block.author?.name}</div>
            <div className="fd-card-meta">{block.author?.uni || block.author?.handle || ""} · {relTime(block.ts)}</div>
          </div>
          <span className="fd-card-kind">uploaded a resource</span>
        </div>
        <ResourceInner resource={block.resource} uni={block.uni} token={token} onOpenResource={onOpenResource} />
        <div className="fd-actions">
          <button className="fd-action" onClick={() => setCommentsOpen((v) => !v)}>
            💬 {commentCount > 0 ? commentCount : ""}
          </button>
          <button className="fd-action" onClick={() => block.resource.shareToken && onOpenResource?.(block.resource.shareToken)}>
            Open ↗
          </button>
        </div>
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
    <div className={`fd-card ${isActivity ? "fd-activity-card" : ""}`}>
      <div className="fd-card-head">
        <Avatar user={block.author} />
        <div className="fd-card-who">
          <div className="fd-card-name">
            {block.author?.name}
            {block.author?.role === "LECTURER" || block.author?.role === "TEACHER" ? (
              <span className="fd-badge">Faculty</span>
            ) : null}
          </div>
          <div className="fd-card-meta">
            {block.author?.uni || block.author?.handle || ""} · {relTime(block.ts)}
          </div>
        </div>
        {block.kind === "question" && <span className="fd-card-kind question">Question</span>}
      </div>

      {isActivity ? (
        <div className="fd-activity">
          <span className="fd-activity-icon">🔥</span>
          <div className="fd-activity-body">
            <span className="fd-activity-text"><b>{block.author?.name}</b> {block.text}</span>
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
      />

      {commentsOpen && (
        <CommentsSection
          token={token}
          me={me}
          kind="post"
          targetId={block.id}
          onCountChange={setCommentCount}
        />
      )}
    </div>
  );
}
