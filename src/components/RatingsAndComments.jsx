import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../lib/constants";

export default function RatingsAndComments({ resourceId }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [showFlagBox, setShowFlagBox] = useState(false);
  const [flagText, setFlagText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  };

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/comments`);
      if (res.ok) setComments(await res.json());
    } catch {}
    setLoading(false);
  }, [resourceId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const submitRating = async (stars) => {
    setRating(stars);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/rate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ stars }),
      });
      if (res.ok) {
        const data = await res.json();
        setAvgRating(data.avgRating);
        setRatingCount(data.ratingCount);
      }
    } catch {}
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/comments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [newComment, ...prev]);
        setCommentText("");
      }
    } catch {}
    setSubmitting(false);
  };

  const submitFlag = async () => {
    if (!flagText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/flag`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: flagText.trim() }),
      });
      if (res.ok) {
        setShowFlagBox(false);
        setFlagText("");
        fetchComments();
      }
    } catch {}
    setSubmitting(false);
  };

  return (
    <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "18px", marginTop: "16px" }}>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "#c5c9e8", marginBottom: "14px" }}>Ratings & Comments</div>

      {/* Star Rating */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => submitRating(s)}
              onMouseEnter={() => setHoverRating(s)}
              onMouseLeave={() => setHoverRating(0)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: (hoverRating || rating) >= s ? "#f5a623" : "#2a2d4a", padding: "2px" }}
            >
              ★
            </button>
          ))}
        </div>
        {avgRating !== null && (
          <span style={{ fontSize: "12px", color: "#7b82b8" }}>{avgRating.toFixed(1)} ({ratingCount} rating{ratingCount !== 1 ? "s" : ""})</span>
        )}
      </div>

      {/* Comment Input */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          style={{ flex: 1, background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#9fa8da", outline: "none" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !submitting) submitComment(); }}
        />
        <button
          onClick={submitComment}
          disabled={submitting || !commentText.trim()}
          style={{ padding: "10px 16px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#c5cae9", cursor: "pointer", opacity: submitting || !commentText.trim() ? 0.5 : 1 }}
        >Post</button>
      </div>

      {/* Flag as outdated/wrong */}
      {!showFlagBox ? (
        <button
          onClick={() => setShowFlagBox(true)}
          style={{ background: "none", border: "none", color: "#ff5470", fontSize: "11px", cursor: "pointer", marginBottom: "14px", padding: 0 }}
        >
          ⚑ Flag as outdated or wrong
        </button>
      ) : (
        <div style={{ marginBottom: "14px", padding: "12px", background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "8px" }}>
          <textarea
            value={flagText}
            onChange={(e) => setFlagText(e.target.value)}
            placeholder="What's wrong with this resource?"
            style={{ width: "100%", background: "#0d0f20", border: "0.5px solid #2a2d4a", borderRadius: "6px", padding: "8px", fontSize: "12px", color: "#9fa8da", outline: "none", resize: "vertical", minHeight: "50px", marginBottom: "8px" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => { setShowFlagBox(false); setFlagText(""); }} style={{ flex: 1, padding: "8px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "6px", fontSize: "12px", color: "#7986cb", cursor: "pointer" }}>Cancel</button>
            <button onClick={submitFlag} disabled={submitting || !flagText.trim()} style={{ flex: 1, padding: "8px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "6px", fontSize: "12px", color: "#ef9a9a", cursor: "pointer", opacity: submitting || !flagText.trim() ? 0.5 : 1 }}>Submit Flag</button>
          </div>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div style={{ fontSize: "12px", color: "#4a5080" }}>Loading comments...</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#4a5080" }}>No comments yet — be the first to share feedback.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ padding: "10px 12px", background: "#0a0c1e", border: c.flagged ? "0.5px solid #4a1010" : "0.5px solid #1e2245", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#7986cb" }}>{c.user?.fullName || c.user?.username || "Anonymous"}</span>
                {c.flagged && <span style={{ fontSize: "10px", color: "#ff5470" }}>⚑ Flagged</span>}
              </div>
              <div style={{ fontSize: "13px", color: "#c5c9e8", lineHeight: 1.4 }}>{c.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
