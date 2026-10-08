import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { messagesApi } from "./messagesApi";
import { Avatar, FdScreen, FdSheet } from "../feed/feedUi";
import { MaterialPicker } from "../feed/Composer.jsx";
import { linkify } from "../../lib/linkify.jsx";

const POLL_MS = 3500;
const EMOJIS = ["👍", "❤️", "🔥", "😂", "🎉"];

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

export function ChatThread({ token, me, partner, onBack, onOpenProfile, onOpenResource, onRead }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [replyTo, setReplyTo] = useState(null);      // message being quoted
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCache, setPickerCache] = useState(null);
  const [menuFor, setMenuFor] = useState(null);      // message with open action sheet
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const scrollRef = useRef(null);
  const textRef = useRef(null);
  const pressTimer = useRef(null);
  const stickRef = useRef(true); // autoscroll only when already at bottom
  const lastTypingSent = useRef(0);
  const unreadBoundary = useRef(null); // id of first incoming unread msg (snapshot on open)
  const prevLen = useRef(0);

  const load = useCallback(
    async ({ initial } = {}) => {
      if (document.hidden) return; // pause polling in background tabs
      try {
        const data = await messagesApi.getThread({ token, userId: partner.id });
        const list = data.messages || [];
        setPeerTyping(!!data.peerTyping);
        setPeerOnline(!!data.peerOnline);
        setMessages((prev) => {
          if (initial && !unreadBoundary.current) {
            const firstUnread = list.find((m) => !m.isMine && !m.read);
            unreadBoundary.current = firstUnread?.id || "none";
          }
          if (!prev) return list;
          const ids = new Set(list.map((m) => m.id));
          const pending = prev.filter((m) => (m.pending || m.failed) && !ids.has(m.id));
          const merged = [...list, ...pending];
          if (!stickRef.current && merged.length > prevLen.current) {
            setNewCount((c) => c + merged.length - prevLen.current);
            setShowJump(true);
          }
          prevLen.current = merged.length;
          return merged;
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
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  useEffect(() => {
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setShowJump(false);
      setNewCount(0);
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    stickRef.current = atBottom;
    if (atBottom) { setShowJump(false); setNewCount(0); }
  };

  const jumpToBottom = () => {
    stickRef.current = true;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setShowJump(false);
    setNewCount(0);
  };

  const maybePingTyping = (value) => {
    if (!value.trim()) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now;
      messagesApi.sendTyping({ token, toUserId: partner.id });
    }
  };

  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const send = async ({ resourceId, textOverride } = {}) => {
    const t = (textOverride ?? text).trim();
    if ((!t && !resourceId) || sending) return;
    setSending(true);
    const resource = resourceId ? pickerCache?.find?.((r) => r.id === resourceId) || null : null;
    const optimistic = {
      id: `pending-${Date.now()}`,
      text: t || (resource ? `Shared ${resource.title}` : ""),
      ts: new Date().toISOString(),
      isMine: true,
      pending: true,
      resource,
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderName: replyTo.isMine ? "You" : partner.name } : null,
      _retry: { resourceId, replyToId: replyTo?.id, text: t },
    };
    setMessages((prev) => [...(prev || []), optimistic]);
    if (!textOverride) { setText(""); autoGrow(textRef.current); }
    setReplyTo(null);
    stickRef.current = true;
    try {
      const saved = await messagesApi.send({
        token,
        toUserId: partner.id,
        content: optimistic._retry.text,
        resourceId,
        replyToId: replyTo?.id || undefined,
      });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch (e) {
      // Keep the bubble — mark failed, tap to retry
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)));
    } finally {
      setSending(false);
    }
  };

  const retry = (m) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    send({ resourceId: m._retry?.resourceId, textOverride: m._retry?.text ?? m.text });
  };

  const shareMaterial = (r) => {
    setPickerOpen(false);
    send({ resourceId: r.id });
  };

  const copyText = (t) => {
    try { navigator.clipboard.writeText(t); } catch {}
  };

  const toggleReaction = async (m, emoji) => {
    setMessages((prev) =>
      (prev || []).map((x) => {
        if (x.id !== m.id) return x;
        const mine = (x.myReactions || []).includes(emoji);
        const reactions = { ...(x.reactions || {}) };
        reactions[emoji] = Math.max(0, (reactions[emoji] || 0) + (mine ? -1 : 1));
        if (!reactions[emoji]) delete reactions[emoji];
        return { ...x, reactions, myReactions: mine ? x.myReactions.filter((e) => e !== emoji) : [...(x.myReactions || []), emoji] };
      })
    );
    try { await messagesApi.react({ token, id: m.id, emoji }); } catch {}
  };

  const deleteMessage = async (m) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    try { await messagesApi.deleteMessage({ token, id: m.id }); } catch (e) { setError(e.message); load(); }
  };

  const openMenu = (m) => { if (!m.pending) setMenuFor(m); };
  const startPress = (m) => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => openMenu(m), 450);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  // Pre-group with day separators + unread boundary marker
  const rendered = useMemo(() => {
    const out = [];
    let lastDay = null;
    (messages || []).forEach((m, i) => {
      const day = dayLabel(m.ts);
      const showDay = day !== lastDay;
      lastDay = day;
      const prev = messages[i - 1];
      const cont = !showDay && prev && prev.isMine === m.isMine;
      const unreadHere = !!unreadBoundary.current && m.id === unreadBoundary.current;
      out.push({ m, day, showDay, cont, unreadHere });
    });
    return out;
  }, [messages]);

  const meta = peerTyping ? "typing…" : peerOnline ? "🟢 Online" : (partner.handle || partner.uni || "");

  return (
    <FdScreen
      className="fd-thread-screen"
      title={partner.name}
      meta={meta}
      onBack={onBack}
      onBackLabel="Back to chats"
      avatar={
        <button className="fd-thread-peer" onClick={() => onOpenProfile?.(partner.id)} aria-label={`Open ${partner.name}'s profile`}>
          <Avatar user={partner} size={34} />
        </button>
      }
      footer={
        <>
          {replyTo && (
            <div className="fd-reply-bar">
              <span className="fd-reply-bar-in">
                <b>{replyTo.isMine ? "You" : partner.name}</b>
                <span>{replyTo.text}</span>
              </span>
              <button className="fd-icon-btn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button>
            </div>
          )}
          <div className="fd-thread-input">
            <button className="gv-attach" onClick={() => setPickerOpen(true)} title="Share a material" aria-label="Share a material">📎</button>
            <textarea
              ref={textRef}
              rows={1}
              value={text}
              onChange={(e) => { setText(e.target.value); autoGrow(e.target); maybePingTyping(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message ${partner.name?.split(" ")[0] || ""}…`}
              maxLength={2000}
            />
            <button className="fd-send" disabled={!text.trim() || sending} onClick={() => send()} aria-label="Send">
              {sending ? "…" : "↑"}
            </button>
          </div>
        </>
      }
    >
      <div className="fd-thread">
        <div ref={scrollRef} className="fd-thread-scroll" onScroll={onScroll}>
          {messages === null && !error && <div className="fd-comments-loading">Loading chat…</div>}
          {error && messages === null && <div className="fd-empty-sub" style={{ padding: 16 }}>{error}</div>}
          {messages?.length === 0 && (
            <div className="fd-empty" style={{ paddingTop: 40 }}>
              <div className="fd-empty-title">Say hi to {partner.name?.split(" ")[0] || "them"} 👋</div>
              <div className="fd-empty-sub">Plan a study session, share a resource, or just vibe.</div>
              <div className="fd-quick-chips">
                <button className="fd-quick-chip" onClick={() => setPickerOpen(true)}>📎 Share a material</button>
              </div>
            </div>
          )}
          {rendered.map(({ m, day, showDay, cont, unreadHere }) => {
            return (
              <div key={m.id} id={`msg-${m.id}`}>
                {showDay && <div className="fd-thread-day">{day}</div>}
                {unreadHere && <div className="fd-unread-divider">New messages</div>}
                <div
                  className={`fd-msg-row ${m.isMine ? "me" : "them"} ${cont ? "cont" : "first"}`}
                  onTouchStart={() => startPress(m)}
                  onTouchEnd={cancelPress}
                  onTouchMove={cancelPress}
                  onContextMenu={(e) => { e.preventDefault(); openMenu(m); }}
                >
                  {!m.isMine && (cont
                    ? <span style={{ width: 26, flexShrink: 0 }} />
                    : <Avatar user={partner} size={26} />)}
                  <div className={`fd-bubble ${m.isMine ? "me" : "them"} ${m.pending ? "pending" : ""} ${m.failed ? "failed" : ""}`}>
                    {m.replyTo && (
                      <button
                        className="fd-reply-quote"
                        onClick={() => document.getElementById(`msg-${m.replyTo.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        <b>{m.replyTo.isMine ? "You" : m.replyTo.senderName}</b>
                        <span>{m.replyTo.deleted ? "Message deleted" : m.replyTo.text}</span>
                      </button>
                    )}
                    {m.text ? <span className="fd-bubble-text">{linkify(m.text)}</span> : null}
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
                    <span className="fd-bubble-meta">
                      {m.failed ? "⚠ Not sent — tap to retry" : timeLabel(m.ts)}
                      {m.isMine && !m.pending && !m.failed && (m.read ? " · read" : "")}
                    </span>
                    {Object.keys(m.reactions || {}).length > 0 && (
                      <span className="fd-bubble-reactions">
                        {Object.entries(m.reactions).map(([e, c]) => (
                          <i key={e}>{e}{c > 1 ? ` ${c}` : ""}</i>
                        ))}
                      </span>
                    )}
                  </div>
                  {m.failed && <button className="fd-retry" onClick={() => retry(m)} aria-label="Retry">↻</button>}
                </div>
              </div>
            );
          })}
        </div>

        {showJump && (
          <button className="fd-jump-bottom" onClick={jumpToBottom}>
            ↓{newCount > 0 ? ` ${newCount} new` : ""}
          </button>
        )}
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

      {menuFor && (
        <FdSheet title={menuFor.isMine ? "Your message" : `Message from ${partner.name?.split(" ")[0]}`} onClose={() => setMenuFor(null)} className="fd-action-sheet">
          <div className="gv-emoji-row" style={{ justifyContent: "center", marginBottom: 12 }}>
            {EMOJIS.map((e) => (
              <button key={e} className="gv-emoji" onClick={() => { toggleReaction(menuFor, e); setMenuFor(null); }}>{e}</button>
            ))}
          </div>
          <div className="fd-sheet-actions">
            <button className="fd-sheet-action" onClick={() => { setReplyTo(menuFor); setMenuFor(null); textRef.current?.focus(); }}>↩ Reply</button>
            {menuFor.text && <button className="fd-sheet-action" onClick={() => { copyText(menuFor.text); setMenuFor(null); }}>⧉ Copy text</button>}
            {menuFor.resource?.shareToken && (
              <button className="fd-sheet-action" onClick={() => { onOpenResource?.(menuFor.resource.shareToken); setMenuFor(null); }}>📄 Open material</button>
            )}
            {menuFor.isMine && (
              <button className="fd-sheet-action danger" onClick={() => { deleteMessage(menuFor); setMenuFor(null); }}>🗑 Delete</button>
            )}
          </div>
        </FdSheet>
      )}
    </FdScreen>
  );
}
