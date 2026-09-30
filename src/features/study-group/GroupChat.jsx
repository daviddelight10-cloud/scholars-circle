import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../lib/constants";
import { Avatar } from "../feed/feedUi";
import { MaterialPicker } from "../feed/Composer.jsx";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "🎉"];
const POLL_MS = 6000;

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function typeIcon(contentType) {
  if (contentType === "mcq") return "❓";
  if (contentType === "flashcards") return "🃏";
  if (contentType === "summary" || contentType === "notes") return "📝";
  return "📄";
}

// Color-hash a sender name so each member's name label reads distinctly.
function nameColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 72%)`;
}

export default function GroupChat({ classroomId, token, currentUser, onOpenResource, onJoinQuiz }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [pickerCache, setPickerCache] = useState(null);
  const [emojiFor, setEmojiFor] = useState(null); // messageId with open picker
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);

  const myId = currentUser?.id || currentUser?.sub;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/messages`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setMessages((prev) => {
        if (!prev) return data;
        const ids = new Set(data.map((m) => m.id));
        const pending = prev.filter((m) => m.pending && !ids.has(m.id));
        return [...data, ...pending];
      });
      setError(null);
    } catch (e) {
      if (!messages) setError(e.message || "Couldn't load chat");
    }
  }, [classroomId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  useEffect(() => {
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Unique shared resources, newest first — the group's mini library.
  const sharedMaterials = useMemo(() => {
    const seen = new Set();
    return (messages || [])
      .filter((m) => m.resource && !seen.has(m.resource.id) && seen.add(m.resource.id))
      .map((m) => m.resource);
  }, [messages]);

  const send = async ({ resourceId, liveCode, textOverride } = {}) => {
    const t = (textOverride ?? text).trim();
    if ((!t && !resourceId) || sending) return;
    setSending(true);
    const optimistic = {
      id: `pending-${Date.now()}`,
      text: t,
      createdAt: new Date().toISOString(),
      userId: myId,
      sender: { id: myId, name: currentUser?.fullName || currentUser?.username || "You", avatar: currentUser?.avatar },
      resourceId: resourceId || null,
      resource: resourceId ? pickerCache?.find?.((r) => r.id === resourceId) || null : null,
      liveCode: liveCode || null,
      liveActive: !!liveCode,
      reactions: [],
      pending: true,
    };
    setMessages((prev) => [optimistic, ...(prev || [])]);
    if (!textOverride) setText("");
    stickRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ text: t || "Shared a material", resourceId, liveCode }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const saved = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const shareMaterial = (r) => {
    setPickerOpen(false);
    send({ resourceId: r.id, textOverride: text.trim() || `Shared ${r.title || "a material"}` });
  };

  const toggleReaction = async (messageId, emoji) => {
    setEmojiFor(null);
    setMessages((prev) =>
      (prev || []).map((m) => {
        if (m.id !== messageId) return m;
        const existing = (m.reactions || []).find((r) => r.emoji === emoji && r.user?.id === myId);
        return {
          ...m,
          reactions: existing
            ? m.reactions.filter((r) => !(r.emoji === emoji && r.user?.id === myId))
            : [...(m.reactions || []), { emoji, user: { id: myId } }],
        };
      })
    );
    try {
      await fetch(`${API_BASE}/study-group/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ emoji }),
      });
      load();
    } catch {}
  };

  // oldest → newest for rendering, pre-grouped with day separators
  const rendered = useMemo(() => {
    const ordered = [...(messages || [])].reverse();
    const out = [];
    let lastDay = null;
    ordered.forEach((m, i) => {
      const day = dayLabel(m.createdAt);
      const showDay = day !== lastDay;
      lastDay = day;
      const prev = ordered[i - 1];
      const sameAsPrev = !showDay && prev && (prev.userId || prev.sender?.id) === (m.userId || m.sender?.id);
      out.push({ m, day, showDay, sameAsPrev });
    });
    return out;
  }, [messages]);

  return (
    <div className="gv-chat">
      {sharedMaterials.length > 0 && (
        <div className="gv-materials">
          <button className="gv-materials-head" onClick={() => setMaterialsOpen((v) => !v)}>
            <span>📎 Shared materials <b>{sharedMaterials.length}</b></span>
            <span className="gv-caret">{materialsOpen ? "▲" : "▼"}</span>
          </button>
          {materialsOpen && (
            <div className="gv-materials-rail">
              {sharedMaterials.map((r) => (
                <button
                  key={r.id}
                  className="gv-material-chip"
                  onClick={() => r.shareToken && onOpenResource?.(r.shareToken)}
                  title={r.title}
                >
                  <span>{typeIcon(r.contentType)}</span>
                  <span className="gv-material-chip-name">{r.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="gv-chat-scroll" onScroll={onScroll}>
        {messages === null && !error && (
          <div className="fd-skeletons">
            {[0, 1, 2].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 52 }} />)}
          </div>
        )}
        {error && messages === null && (
          <div className="fd-empty"><div className="fd-empty-title">Couldn't load chat</div><div className="fd-empty-sub">{error}</div></div>
        )}
        {rendered.length === 0 && messages !== null && (
          <div className="fd-empty" style={{ paddingTop: 40 }}>
            <div className="fd-empty-icon">💬</div>
            <div className="fd-empty-title">No messages yet</div>
            <div className="fd-empty-sub">Say hi, share a material, or start a quiz battle — this is your group's home base.</div>
          </div>
        )}

        {rendered.map(({ m, day, showDay, sameAsPrev }) => {
          const isMe = (m.userId || m.sender?.id) === myId;
          const sender = m.sender || {};
          const name = sender.name || "Scholar";
          const reactionCounts = {};
          (m.reactions || []).forEach((r) => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1; });

          return (
            <div key={m.id}>
              {showDay && <div className="fd-thread-day">{day}</div>}
              <div className={`gv-msg ${isMe ? "me" : "them"} ${sameAsPrev ? "cont" : "first"}`}>
                {!isMe && (sameAsPrev
                  ? <span className="gv-msg-avatar-gap" />
                  : <Avatar user={sender} size={28} />)}
                <div className="gv-msg-body">
                  {!isMe && !sameAsPrev && (
                    <div className="gv-msg-name" style={{ color: nameColor(name) }}>{name}</div>
                  )}
                  <div
                    className={`gv-bubble ${isMe ? "me" : "them"} ${m.pending ? "pending" : ""}`}
                    onDoubleClick={() => setEmojiFor(emojiFor === m.id ? null : m.id)}
                  >
                    {m.text ? <span className="gv-bubble-text">{m.text}</span> : null}
                    {m.resource && (
                      <button
                        className="gv-res-card"
                        onClick={() => m.resource.shareToken && onOpenResource?.(m.resource.shareToken)}
                      >
                        <span className="gv-res-icon">{typeIcon(m.resource.contentType)}</span>
                        <span className="gv-res-info">
                          <span className="gv-res-title">{m.resource.title}</span>
                          {m.resource.subject && <span className="gv-res-sub">{m.resource.subject}</span>}
                        </span>
                        <span className="gv-res-open">Open →</span>
                      </button>
                    )}
                    {m.liveCode && (
                      <div className={`gv-battle-card ${m.liveActive ? "live" : "ended"}`}>
                        <span className="gv-battle-flag">⚔️ Quiz battle</span>
                        {m.resource?.title && <span className="gv-battle-title">{m.resource.title}</span>}
                        {m.liveActive ? (
                          <button className="gv-battle-join" onClick={() => onJoinQuiz?.(m.liveCode)}>Join →</button>
                        ) : (
                          <span className="gv-battle-ended">Ended</span>
                        )}
                      </div>
                    )}
                    <span className="gv-bubble-meta">
                      {timeLabel(m.createdAt)}{m.pending ? " · sending" : ""}
                    </span>
                  </div>
                  {(Object.keys(reactionCounts).length > 0 || !m.pending) && (
                    <div className="gv-msg-foot">
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <button key={emoji} className="gv-reaction" onClick={() => toggleReaction(m.id, emoji)}>
                          {emoji} {count}
                        </button>
                      ))}
                      <button className="gv-react-add" onClick={() => setEmojiFor(emojiFor === m.id ? null : m.id)}>☺</button>
                    </div>
                  )}
                  {emojiFor === m.id && (
                    <div className="gv-emoji-row">
                      {EMOJIS.map((e) => (
                        <button key={e} className="gv-emoji" onClick={() => toggleReaction(m.id, e)}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="gv-composer">
        <button className="gv-attach" onClick={() => setPickerOpen(true)} title="Share a material" aria-label="Share a material">📎</button>
        <input
          className="gv-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the group…"
          maxLength={2000}
        />
        <button className="gv-send" onClick={() => send()} disabled={!text.trim() || sending} aria-label="Send">
          {sending ? "…" : "↑"}
        </button>
      </div>

      {pickerOpen && (
        <MaterialPicker
          token={token}
          cache={pickerCache}
          setCache={setPickerCache}
          onPick={shareMaterial}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
