import React, { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const EMOJIS = ["👍", "❤️", "🔥", "😂", "🎉"];

export default function GroupChat({ classroomId, token, currentUser, onShareResource }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);
  const lastFetchRef = useRef(0);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/messages`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setMessages(data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleTyping() {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTypingUsers(new Set()), 3000);
  }

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const msg = await res.json();
      setMessages((prev) => [msg, ...prev]);
      setText("");
      fetchMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(messageId, emoji) {
    try {
      await fetch(`${API_BASE}/study-group/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ emoji }),
      });
      fetchMessages();
    } catch (err) {
      console.error("Reaction failed:", err);
    }
    setShowEmojiPicker(null);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getDisplayName(user) {
    return user?.fullName || user?.username || "Scholar";
  }

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  }

  const myId = currentUser?.id || currentUser?.sub;

  if (loading) {
    return (
      <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading chat…</div>
      </div>
    );
  }

  return (
    <div className="sg-chat-container">
      <div ref={scrollRef} className="sg-chat-thread">
        {messages.length === 0 && (
          <div className="cr-empty" style={{ padding: "32px 20px" }}>
            <div className="cr-empty-icon">💬</div>
            <div className="cr-empty-title">No messages yet</div>
            <div className="cr-empty-desc">Start the conversation — say hi to your study group!</div>
          </div>
        )}
        {[...messages].reverse().map((msg) => {
          const isMe = msg.userId === myId;
          const displayName = getDisplayName(msg.user);
          return (
            <div key={msg.id} className={`sg-msg-row ${isMe ? "me" : "them"}`}>
              {!isMe && (
                <div className="sg-msg-avatar">{getInitials(displayName)}</div>
              )}
              <div className="sg-msg-bubble-wrap">
                {!isMe && <div className="sg-msg-name">{displayName}</div>}
                <div className={`sg-msg-bubble ${isMe ? "me" : "them"}`}>
                  <div className="sg-msg-text">{msg.text}</div>
                </div>
                <div className="sg-msg-meta">
                  <span className="sg-msg-time">{formatTime(msg.createdAt)}</span>
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="sg-reactions-display">
                      {Object.entries(
                        msg.reactions.reduce((acc, r) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([emoji, count]) => (
                        <span key={emoji} className="sg-reaction-chip" onClick={() => toggleReaction(msg.id, emoji)}>
                          {emoji} {count}
                        </span>
                      ))}
                    </div>
                  )}
                  <button className="sg-react-btn" onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}>
                    😊
                  </button>
                </div>
                {showEmojiPicker === msg.id && (
                  <div className="sg-emoji-picker">
                    {EMOJIS.map((e) => (
                      <button key={e} className="sg-emoji-btn" onClick={() => toggleReaction(msg.id, e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="sg-typing">
            {[...typingUsers].join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing…
          </div>
        )}
      </div>

      {error && <div className="sg-chat-error">{error}</div>}

      <div className="sg-chat-input-row">
        {onShareResource && (
          <button className="sg-share-btn" onClick={onShareResource} title="Share a resource">
            📎
          </button>
        )}
        <input
          className="sg-chat-input"
          value={text}
          onChange={(e) => { setText(e.target.value); handleTyping(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message…"
          disabled={sending}
        />
        <button className="sg-chat-send" onClick={sendMessage} disabled={!text.trim() || sending}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
