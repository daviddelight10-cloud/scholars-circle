import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupChatApi } from "../messages/messagesApi";
import { Avatar, FdSheet } from "../feed/feedUi";
import { MaterialPicker } from "../feed/Composer.jsx";
import { linkify } from "../../lib/linkify.jsx";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "🎉"];
const POLL_MS = 5000;

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

export default function GroupChat({ classroomId, token, currentUser, onOpenResource, onJoinQuiz, onStartBattle, onAddGoal, canModerate }) {
  const [messages, setMessages] = useState(null);
  const [typing, setTyping] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pickerCache, setPickerCache] = useState(null);
  const [menuFor, setMenuFor] = useState(null);      // message with open action sheet
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState(null);
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const scrollRef = useRef(null);
  const textRef = useRef(null);
  const pressTimer = useRef(null);
  const stickRef = useRef(true);
  const lastTypingSent = useRef(0);
  const prevLen = useRef(0);

  const myId = currentUser?.id || currentUser?.sub;
  const myName = currentUser?.fullName || currentUser?.username || "You";

  const load = useCallback(async () => {
    if (document.hidden) return;
    try {
      const data = await groupChatApi.getMessages({ token, classroomId });
      const list = data.messages || [];
      setTyping(data.typing || []);
      setMessages((prev) => {
        if (!prev) { prevLen.current = list.length; return list; }
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
      setError(null);
    } catch (e) {
      if (!messages) setError(e.message || "Couldn't load chat");
    }
  }, [classroomId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    stickRef.current = atBottom;
    if (atBottom) { setShowJump(false); setNewCount(0); }
  };

  useEffect(() => {
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setShowJump(false);
      setNewCount(0);
    }
  }, [messages]);

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
      groupChatApi.sendTyping({ token, classroomId, name: myName.split(" ")[0] });
    }
  };

  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // Unique shared resources, newest first — the group's mini library.
  const sharedMaterials = useMemo(() => {
    const seen = new Set();
    return (messages || [])
      .filter((m) => m.resource && !seen.has(m.resource.id) && seen.add(m.resource.id))
      .map((m) => m.resource);
  }, [messages]);

  const pinnedMessages = useMemo(
    () => (messages || []).filter((m) => m.pinnedAt && !m.pending && !m.failed),
    [messages]
  );

  const send = async ({ resourceId, liveCode, textOverride } = {}) => {
    const t = (textOverride ?? text).trim();
    if ((!t && !resourceId) || sending) return;
    setSending(true);
    const optimistic = {
      id: `pending-${Date.now()}`,
      text: t,
      createdAt: new Date().toISOString(),
      userId: myId,
      sender: { id: myId, name: myName, avatar: currentUser?.avatar },
      resourceId: resourceId || null,
      resource: resourceId ? pickerCache?.find?.((r) => r.id === resourceId) || null : null,
      liveCode: liveCode || null,
      liveActive: !!liveCode,
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderName: (replyTo.userId || replyTo.sender?.id) === myId ? "You" : (replyTo.sender?.name || "Scholar") } : null,
      reactions: [],
      pending: true,
      _retry: { resourceId, liveCode, replyToId: replyTo?.id, text: t },
    };
    setMessages((prev) => [optimistic, ...(prev || [])]);
    if (!textOverride) { setText(""); autoGrow(textRef.current); }
    setReplyTo(null);
    stickRef.current = true;
    try {
      const saved = await groupChatApi.send({
        token, classroomId,
        text: t || "Shared a material",
        resourceId, liveCode,
        replyToId: replyTo?.id,
      });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)));
    } finally {
      setSending(false);
    }
  };

  const retry = (m) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    send({ resourceId: m._retry?.resourceId, liveCode: m._retry?.liveCode, textOverride: m._retry?.text ?? m.text });
  };

  const shareMaterial = (r) => {
    setPickerOpen(false);
    send({ resourceId: r.id, textOverride: text.trim() || `Shared ${r.title || "a material"}` });
  };

  const toggleReaction = async (messageId, emoji) => {
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
      await groupChatApi.react({ token, messageId, emoji });
      load();
    } catch {}
  };

  const togglePin = async (m) => {
    try {
      await groupChatApi.pin({ token, messageId: m.id });
      setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, pinnedAt: x.pinnedAt ? null : new Date().toISOString() } : x));
    } catch (e) { setError(e.message); }
  };

  const deleteMessage = async (m) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await groupChatApi.deleteMessage({ token, messageId: m.id });
    } catch (e) { setError(e.message); load(); }
  };

  const copyText = (t) => { try { navigator.clipboard.writeText(t); } catch {} };

  const openMenu = (m) => { if (!m.pending && !m.failed) setMenuFor(m); };
  const startPress = (m) => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => openMenu(m), 450);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

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

  const typingLine = typing.length === 0 ? null
    : typing.length === 1 ? `${typing[0].name} is typing…`
    : `${typing.map((t) => t.name).join(", ")} are typing…`;

  return (
    <div className="gv-chat">
      {pinnedMessages.length > 0 && (
        <div className="gv-materials gv-pins">
          <button className="gv-materials-head" onClick={() => setPinsOpen((v) => !v)}>
            <span>📌 Pinned <b>{pinnedMessages.length}</b></span>
            <span className="gv-caret">{pinsOpen ? "▲" : "▼"}</span>
          </button>
          {pinsOpen && (
            <div className="gv-pins-list">
              {pinnedMessages.map((m) => (
                <button
                  key={m.id}
                  className="gv-pin-row"
                  onClick={() => document.getElementById(`gmsg-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                >
                  <b>{m.sender?.name || "Scholar"}</b>
                  <span>{m.text || (m.resource ? `📎 ${m.resource.title}` : "")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            <div className="fd-quick-chips">
              <button className="fd-quick-chip" onClick={() => setPickerOpen(true)}>📎 Share a material</button>
              {onStartBattle && <button className="fd-quick-chip" onClick={onStartBattle}>⚔️ Start a battle</button>}
              {onAddGoal && <button className="fd-quick-chip" onClick={onAddGoal}>🎯 Set a goal</button>}
            </div>
          </div>
        )}

        {rendered.map(({ m, day, showDay, sameAsPrev }) => {
          const isMe = (m.userId || m.sender?.id) === myId;
          const sender = m.sender || {};
          const name = sender.name || "Scholar";
          const reactionCounts = {};
          (m.reactions || []).forEach((r) => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1; });

          return (
            <div key={m.id} id={`gmsg-${m.id}`}>
              {showDay && <div className="fd-thread-day">{day}</div>}
              <div
                className={`gv-msg ${isMe ? "me" : "them"} ${sameAsPrev ? "cont" : "first"}`}
                onTouchStart={() => startPress(m)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onContextMenu={(e) => { e.preventDefault(); openMenu(m); }}
              >
                {!isMe && (sameAsPrev
                  ? <span className="gv-msg-avatar-gap" />
                  : <Avatar user={sender} size={28} />)}
                <div className="gv-msg-body">
                  {!isMe && !sameAsPrev && (
                    <div className="gv-msg-name" style={{ color: nameColor(name) }}>{name}</div>
                  )}
                  <div className={`gv-bubble ${isMe ? "me" : "them"} ${m.pending ? "pending" : ""} ${m.failed ? "failed" : ""}`}>
                    {m.pinnedAt && <span className="gv-pin-flag">📌</span>}
                    {m.replyTo && (
                      <button
                        className="fd-reply-quote"
                        onClick={() => document.getElementById(`gmsg-${m.replyTo.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        <b>{m.replyTo.isMine ? "You" : m.replyTo.senderName}</b>
                        <span>{m.replyTo.deleted ? "Message deleted" : m.replyTo.text}</span>
                      </button>
                    )}
                    {m.text ? <span className="gv-bubble-text">{linkify(m.text)}</span> : null}
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
                      {m.failed ? "⚠ Not sent — tap ↻" : timeLabel(m.createdAt)}{m.pending ? " · sending" : ""}
                    </span>
                  </div>
                  {m.failed && <button className="fd-retry" onClick={() => retry(m)} aria-label="Retry">↻</button>}
                  {Object.keys(reactionCounts).length > 0 && (
                    <div className="gv-msg-foot">
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <button key={emoji} className="gv-reaction" onClick={() => toggleReaction(m.id, emoji)}>
                          {emoji} {count}
                        </button>
                      ))}
                      <button className="gv-react-add" onClick={() => openMenu(m)}>☺</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {typingLine && <div className="gv-typing-line">{typingLine}</div>}

      {showJump && (
        <button className="fd-jump-bottom" onClick={jumpToBottom}>
          ↓{newCount > 0 ? ` ${newCount} new` : ""}
        </button>
      )}

      {replyTo && (
        <div className="fd-reply-bar">
          <span className="fd-reply-bar-in">
            <b>{(replyTo.userId || replyTo.sender?.id) === myId ? "You" : (replyTo.sender?.name || "Scholar")}</b>
            <span>{replyTo.text}</span>
          </span>
          <button className="fd-icon-btn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button>
        </div>
      )}

      <div className="gv-composer">
        <button className="gv-attach" onClick={() => setPlusOpen(true)} title="More actions" aria-label="More actions">＋</button>
        <textarea
          ref={textRef}
          rows={1}
          className="gv-input"
          value={text}
          onChange={(e) => { setText(e.target.value); autoGrow(e.target); maybePingTyping(e.target.value); }}
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

      {plusOpen && (
        <FdSheet title="Add to chat" onClose={() => setPlusOpen(false)} className="fd-action-sheet">
          <div className="fd-sheet-actions">
            <button className="fd-sheet-action" onClick={() => { setPlusOpen(false); setPickerOpen(true); }}>📎 Share a material</button>
            {onStartBattle && <button className="fd-sheet-action" onClick={() => { setPlusOpen(false); onStartBattle(); }}>⚔️ Start a quiz battle</button>}
            {onAddGoal && <button className="fd-sheet-action" onClick={() => { setPlusOpen(false); onAddGoal(); }}>🎯 Set a group goal</button>}
          </div>
        </FdSheet>
      )}

      {menuFor && (
        <FdSheet title={menuFor.sender?.name || "Message"} onClose={() => setMenuFor(null)} className="fd-action-sheet">
          <div className="gv-emoji-row" style={{ justifyContent: "center", marginBottom: 12 }}>
            {EMOJIS.map((e) => (
              <button key={e} className="gv-emoji" onClick={() => { toggleReaction(menuFor.id, e); setMenuFor(null); }}>{e}</button>
            ))}
          </div>
          <div className="fd-sheet-actions">
            <button className="fd-sheet-action" onClick={() => { setReplyTo(menuFor); setMenuFor(null); textRef.current?.focus(); }}>↩ Reply</button>
            {menuFor.text && <button className="fd-sheet-action" onClick={() => { copyText(menuFor.text); setMenuFor(null); }}>⧉ Copy text</button>}
            <button className="fd-sheet-action" onClick={() => { togglePin(menuFor); setMenuFor(null); }}>
              {menuFor.pinnedAt ? "📌 Unpin" : "📌 Pin to top"}
            </button>
            {menuFor.resource?.shareToken && (
              <button className="fd-sheet-action" onClick={() => { onOpenResource?.(menuFor.resource.shareToken); setMenuFor(null); }}>📄 Open material</button>
            )}
            {((menuFor.userId || menuFor.sender?.id) === myId || canModerate) && (
              <button className="fd-sheet-action danger" onClick={() => { deleteMessage(menuFor); setMenuFor(null); }}>🗑 Delete</button>
            )}
          </div>
        </FdSheet>
      )}
    </div>
  );
}
