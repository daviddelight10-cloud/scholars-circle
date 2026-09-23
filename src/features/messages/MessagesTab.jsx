import { useCallback, useEffect, useRef, useState } from "react";
import { messagesApi } from "./messagesApi";
import { ChatThread } from "./ChatThread";
import { PeopleSearchSheet } from "./PeopleSearchSheet";
import { Avatar, SectionHeader, relTime } from "../feed/feedUi";

const INBOX_POLL_MS = 15000;

// Chats tab: inbox of DM threads. `openChatWith` lets the parent deep-link
// straight into a thread (profile "Message" button, push notification).
export function MessagesTab({ token, me, openChatWith, onChatOpened, onOpenProfile, onUnreadChange }) {
  const [inbox, setInbox] = useState(null);
  const [error, setError] = useState(null);
  const [partner, setPartner] = useState(null); // {id, name, ...} when a thread is open
  const [searchOpen, setSearchOpen] = useState(false);
  const partnerRef = useRef(null);
  partnerRef.current = partner;

  const loadInbox = useCallback(async () => {
    try {
      const list = await messagesApi.getInbox({ token });
      setInbox(list || []);
      const unread = (list || []).reduce((n, c) => n + (c.unreadCount || 0), 0);
      onUnreadChange?.(unread);
    } catch (e) {
      if (!inbox) setError(e.message || "Couldn't load chats");
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadInbox();
    const iv = setInterval(() => {
      if (!partnerRef.current) loadInbox();
    }, INBOX_POLL_MS);
    return () => clearInterval(iv);
  }, [loadInbox]);

  // Deep-link: parent asked us to open a thread with this user
  useEffect(() => {
    if (!openChatWith) return;
    const u = openChatWith;
    setPartner({ id: u.id, name: u.name, handle: u.handle, avatar: u.avatar, uni: u.uni });
    onChatOpened?.();
  }, [openChatWith]); // eslint-disable-line react-hooks/exhaustive-deps

  const openThread = (conv) => {
    setPartner(conv.partner);
    // Optimistically clear the unread pill on the row
    setInbox((prev) =>
      (prev || []).map((c) => (c.partner.id === conv.partner.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  if (partner) {
    return (
      <ChatThread
        token={token}
        me={me}
        partner={partner}
        onBack={() => { setPartner(null); loadInbox(); }}
        onOpenProfile={onOpenProfile}
        onRead={loadInbox}
      />
    );
  }

  return (
    <div className="fd-chats">
      <div className="fd-chats-head">
        <SectionHeader title="Messages" hint={inbox?.length ? `${inbox.length} chat${inbox.length === 1 ? "" : "s"}` : "DM classmates"} />
        <button className="fd-follow-btn" onClick={() => setSearchOpen(true)}>+ New chat</button>
      </div>

      {inbox === null && !error && (
        <div className="fd-skeletons">
          {[0, 1, 2].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 64 }} />)}
        </div>
      )}

      {error && (
        <div className="fd-empty">
          <div className="fd-empty-title">Couldn't load chats</div>
          <div className="fd-empty-sub">{error}</div>
          <button className="fd-follow-btn" onClick={loadInbox}>Retry</button>
        </div>
      )}

      {inbox?.length === 0 && (
        <div className="fd-empty">
          <div className="fd-empty-icon">💬</div>
          <div className="fd-empty-title">No chats yet</div>
          <div className="fd-empty-sub">
            Message someone from their profile, or start a chat here — plan study sessions, swap notes, share wins.
          </div>
          <button className="fd-follow-btn" style={{ marginTop: 12 }} onClick={() => setSearchOpen(true)}>
            Find someone to chat with
          </button>
        </div>
      )}

      {(inbox || []).map((c) => (
        <button key={c.partner.id} className="fd-chat-row" onClick={() => openThread(c)}>
          <Avatar user={c.partner} size={46} />
          <span className="fd-chat-info">
            <span className="fd-chat-name">
              {c.partner.name}
              {c.partner.role === "LECTURER" || c.partner.role === "TEACHER" ? (
                <span className="fd-badge">Faculty</span>
              ) : null}
            </span>
            <span className="fd-chat-preview">
              {c.lastMessage.isMine ? "You: " : ""}{c.lastMessage.text}
            </span>
          </span>
          <span className="fd-chat-side">
            <span className="fd-chat-time">{relTime(c.lastMessage.ts)}</span>
            {c.unreadCount > 0 && <span className="fd-unread">{c.unreadCount}</span>}
          </span>
        </button>
      ))}

      {searchOpen && (
        <PeopleSearchSheet
          token={token}
          onClose={() => setSearchOpen(false)}
          onPick={(u) => { setSearchOpen(false); setPartner(u); }}
        />
      )}
    </div>
  );
}
