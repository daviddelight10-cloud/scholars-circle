import { useCallback, useEffect, useRef, useState } from "react";
import { messagesApi } from "./messagesApi";
import { Avatar } from "../feed/feedUi";

const POLL_MS = 4000;

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

export function ChatThread({ token, me, partner, onBack, onOpenProfile, onRead }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const stickRef = useRef(true); // autoscroll only when already at bottom

  const load = useCallback(
    async ({ initial } = {}) => {
      try {
        const list = await messagesApi.getThread({ token, userId: partner.id });
        setMessages((prev) => {
          // Avoid clobbering optimistic sends that haven't landed yet
          if (!prev) return list;
          const ids = new Set(list.map((m) => m.id));
          const pending = prev.filter((m) => m.pending && !ids.has(m.id));
          return [...list, ...pending];
        });
        if (initial) onRead?.(); // server marks incoming read — refresh badge once per open
      } catch (e) {
        if (initial) setError(e.message || "Couldn't load chat");
      }
    },
    [token, partner.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    load({ initial: true });
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const optimistic = {
      id: `pending-${Date.now()}`,
      text: t,
      ts: new Date().toISOString(),
      isMine: true,
      pending: true,
    };
    setMessages((prev) => [...(prev || []), optimistic]);
    setText("");
    stickRef.current = true;
    try {
      const saved = await messagesApi.send({ token, toUserId: partner.id, content: t });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(t);
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  let lastDay = null;

  return (
    <div className="fd-thread">
      <div className="fd-thread-head">
        <button className="fd-backbtn" onClick={onBack} aria-label="Back to chats">←</button>
        <button className="fd-thread-peer" onClick={() => onOpenProfile?.(partner.id)}>
          <Avatar user={partner} size={34} />
          <span className="fd-thread-peer-info">
            <span className="fd-thread-peer-name">{partner.name}</span>
            <span className="fd-thread-peer-meta">{partner.handle || partner.uni || ""}</span>
          </span>
        </button>
      </div>

      <div ref={scrollRef} className="fd-thread-scroll" onScroll={onScroll}>
        {messages === null && !error && <div className="fd-comments-loading">Loading chat…</div>}
        {error && <div className="fd-empty-sub" style={{ padding: 16 }}>{error}</div>}
        {messages?.length === 0 && (
          <div className="fd-empty" style={{ paddingTop: 40 }}>
            <div className="fd-empty-title">Say hi to {partner.name?.split(" ")[0] || "them"} 👋</div>
            <div className="fd-empty-sub">Plan a study session, share a resource, or just vibe.</div>
          </div>
        )}
        {(messages || []).map((m) => {
          const day = dayLabel(m.ts);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <div className="fd-thread-day">{day}</div>}
              <div className={`fd-msg-row ${m.isMine ? "me" : "them"}`}>
                {!m.isMine && <Avatar user={partner} size={26} />}
                <div className={`fd-bubble ${m.isMine ? "me" : "them"} ${m.pending ? "pending" : ""}`}>
                  <span className="fd-bubble-text">{m.text}</span>
                  <span className="fd-bubble-meta">
                    {timeLabel(m.ts)}
                    {m.isMine && !m.pending && (m.read ? " · read" : "")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fd-thread-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Message ${partner.name?.split(" ")[0] || ""}…`}
          maxLength={2000}
        />
        <button className="fd-send" disabled={!text.trim() || sending} onClick={send}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
