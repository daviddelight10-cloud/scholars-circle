import { useState, useEffect, useCallback } from "react";
import { getWallPosts, createWallPost, deleteWallPost, reactToPost } from "../../lib/gamificationApi";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "🎉", "💯"];

export default function ClassWall({ token, userId, classroomId, username }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [showEmojiFor, setShowEmojiFor] = useState(null);

  const refresh = useCallback(() => {
    if (!token || !classroomId) return;
    setLoading(true);
    getWallPosts(token, classroomId)
      .then(p => setPosts(Array.isArray(p) ? p : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handlePost = async () => {
    if (!newContent.trim() || posting) return;
    setPosting(true);
    const post = await createWallPost(token, classroomId, newContent.trim());
    if (post && !post.error) {
      setPosts(prev => [post, ...prev]);
      setNewContent("");
    }
    setPosting(false);
  };

  const handleDelete = async (postId) => {
    await deleteWallPost(token, postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleReact = async (postId, emoji) => {
    const result = await reactToPost(token, postId, emoji);
    setShowEmojiFor(null);
    // Update local state
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      if (result.action === "added") {
        return { ...p, reactions: [...(p.reactions || []), { userId, emoji, id: result.reaction?.id }] };
      } else {
        return { ...p, reactions: (p.reactions || []).filter(r => !(r.userId === userId && r.emoji === emoji)) };
      }
    }));
  };

  const timeAgo = (date) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text-primary)" }}>📣 Class Wall</h3>

      {/* New post input */}
      <div style={{ background: "var(--card-bg, #1e293b)", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid var(--border-color, #334155)" }}>
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Share something with your class..."
          rows={2}
          style={{
            width: "100%", background: "transparent", border: "none", resize: "none",
            color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={handlePost}
            disabled={!newContent.trim() || posting}
            style={{
              padding: "8px 16px", border: "none", borderRadius: 8,
              background: newContent.trim() ? "var(--accent-color, #FFD700)" : "var(--border-color, #334155)",
              color: "#fff", fontWeight: 600, fontSize: 12, cursor: newContent.trim() ? "pointer" : "not-allowed",
            }}
          >{posting ? "..." : "Post"}</button>
        </div>
      </div>

      {/* Posts feed */}
      {loading && <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><div className="spinner" /></div>}

      {!loading && posts.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 13 }}>No posts yet. Be the first!</div>
        </div>
      )}

      {posts.map(post => {
        const isAuthor = post.authorId === userId;
        const grouped = {};
        (post.reactions || []).forEach(r => {
          if (!grouped[r.emoji]) grouped[r.emoji] = [];
          grouped[r.emoji].push(r.userId);
        });

        return (
          <div key={post.id} style={{
            background: post.kind === "achievement" ? "rgba(255,215,0,0.05)" : "var(--card-bg, #1e293b)",
            border: post.kind === "achievement" ? "1px solid rgba(255,215,0,0.2)" : "1px solid var(--border-color, #334155)",
            borderRadius: 14, padding: 14, marginBottom: 10,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", background: "var(--accent-color)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12,
              }}>
                {post.author?.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{post.author?.username || "Student"}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{timeAgo(post.createdAt)}</div>
              </div>
              {post.kind === "achievement" && <span style={{ fontSize: 16 }}>🏆</span>}
              {isAuthor && (
                <button onClick={() => handleDelete(post.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}>×</button>
              )}
            </div>

            {/* Content */}
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 10, whiteSpace: "pre-wrap" }}>
              {post.content}
            </div>

            {/* Reactions */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(grouped).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(post.id, emoji)}
                  style={{
                    padding: "4px 8px", borderRadius: 12, border: users.includes(userId) ? "1px solid var(--accent-color)" : "1px solid var(--border-color, #334155)",
                    background: users.includes(userId) ? "rgba(255,215,0,0.1)" : "transparent",
                    cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <span>{emoji}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{users.length}</span>
                </button>
              ))}

              {/* Add reaction button */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowEmojiFor(showEmojiFor === post.id ? null : post.id)}
                  style={{ padding: "4px 8px", borderRadius: 12, border: "1px solid var(--border-color, #334155)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}
                >+</button>
                {showEmojiFor === post.id && (
                  <div style={{
                    position: "absolute", bottom: "100%", left: 0, background: "var(--card-bg, #1e293b)",
                    border: "1px solid var(--border-color, #334155)", borderRadius: 10, padding: 6,
                    display: "flex", gap: 4, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}>
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => handleReact(post.id, e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
