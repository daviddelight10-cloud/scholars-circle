import React, { useEffect, useRef, useState } from "react";
import { lecturersApi } from "./api.js";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export function Messages({ token, currentUser, initialPartner, onBack }) {
  const [inbox, setInbox] = useState([]);
  const [activePartner, setActivePartner] = useState(initialPartner || null);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const isMobile = useIsMobile(768);

  // Load inbox
  useEffect(() => {
    let alive = true;
    lecturersApi.getInbox(token)
      .then((data) => { if (alive) setInbox(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingInbox(false); });
    return () => { alive = false; };
  }, [token]);

  // Load thread when partner changes
  useEffect(() => {
    if (!activePartner) return;
    let alive = true;
    setLoadingThread(true);
    const partnerUserId = activePartner.userId || activePartner.partnerId || activePartner.id;
    lecturersApi.getThread(partnerUserId, token)
      .then((data) => { if (alive) setThread(data); })
      .catch(() => { if (alive) setThread([]); })
      .finally(() => { if (alive) setLoadingThread(false); });
    return () => { alive = false; };
  }, [activePartner, token]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread, loadingThread]);

  async function send() {
    if (!draft.trim() || !activePartner || sending) return;
    setSending(true);
    try {
      const payload = activePartner.id && !activePartner.userId
        ? { toLecturerId: activePartner.id, content: draft }
        : { toUserId: activePartner.userId || activePartner.partnerId, content: draft };
      const msg = await lecturersApi.sendMessage(payload, token);
      setThread((t) => [...t, msg]);
      setDraft("");
    } catch (e) {
      alert("Failed to send: " + e.message);
    } finally {
      setSending(false);
    }
  }

  // On mobile, show ONE pane at a time (inbox or thread)
  const showInboxPane = !isMobile || !activePartner;
  const showThreadPane = !isMobile || !!activePartner;

  // Pane height: full viewport on mobile (minus topbar+bottom nav), fixed on desktop
  const paneMaxHeight = isMobile ? "calc(100dvh - 180px)" : 600;
  const paneMinHeight = isMobile ? "calc(100dvh - 180px)" : 500;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header: hide outer back button when inside a thread on mobile (we use in-thread back instead) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : undefined }}>💬 Messages</h2>
        {onBack && (!isMobile || !activePartner) && <button onClick={onBack} style={ghostBtn}>← Back</button>}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
          gap: isMobile ? 0 : 12,
          minHeight: paneMinHeight,
        }}
      >
        {/* Inbox sidebar */}
        {showInboxPane && (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: paneMaxHeight, minHeight: isMobile ? paneMinHeight : undefined }}>
          <div style={{ padding: 12, borderBottom: "1px solid rgba(255,215,0,0.2)", fontWeight: 600 }}>Conversations</div>
          {loadingInbox && <div style={{ padding: 16, color: "#9ca3af" }}>Loading...</div>}
          {!loadingInbox && inbox.length === 0 && (
            <div style={{ padding: 20, color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
              No messages yet.<br />Find a lecturer in the directory and click Message.
            </div>
          )}
          <div style={{ overflowY: "auto", maxHeight: isMobile ? "calc(100dvh - 240px)" : 540 }}>
            {inbox.map((entry) => {
              const isActive = activePartner && (activePartner.partnerId === entry.partnerId || activePartner.userId === entry.partnerId);
              const partner = entry.partner;
              const displayName = partner?.lecturerProfile?.fullName || partner?.username || "Unknown";
              return (
                <button
                  key={entry.partnerId}
                  onClick={() => setActivePartner({ partnerId: entry.partnerId, userId: entry.partnerId, displayName })}
                  style={{
                    width: "100%",
                    padding: 12,
                    background: isActive ? "rgba(255,215,0,0.15)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,215,0,0.1)",
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #FFD700, #DAA520)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                      <span>{partner?.lecturerProfile?.title ? `${partner.lecturerProfile.title} ` : ""}{displayName}</span>
                      {entry.unreadCount > 0 && (
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "#ef4444", color: "#fff" }}>{entry.unreadCount}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {entry.lastMessage?.content}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Thread view */}
        {showThreadPane && (
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: paneMaxHeight, minHeight: isMobile ? paneMinHeight : 500 }}>
          {!activePartner ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", padding: 20, textAlign: "center" }}>
              Select a conversation to start messaging
            </div>
          ) : (
            <>
              <div style={{ padding: 10, borderBottom: "1px solid rgba(255,215,0,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
                {isMobile && (
                  <button
                    onClick={() => setActivePartner(null)}
                    aria-label="Back to conversations"
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,215,0,0.3)",
                      background: "rgba(20,20,20,0.7)",
                      color: "#FFD700",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ←
                  </button>
                )}
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #FFD700, #DAA520)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 14, flexShrink: 0 }}>
                  {(activePartner.displayName || activePartner.fullName || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activePartner.displayName || activePartner.fullName || "Conversation"}
                </div>
              </div>
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, WebkitOverflowScrolling: "touch" }}>
                {loadingThread && <div style={{ color: "#9ca3af" }}>Loading...</div>}
                {!loadingThread && thread.length === 0 && (
                  <div style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>No messages yet. Say hi!</div>
                )}
                {thread.map((m) => {
                  const mine = m.fromId === currentUser?.id;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: isMobile ? "85%" : "75%",
                        padding: "8px 12px",
                        borderRadius: 14,
                        background: mine ? "linear-gradient(135deg, #FFD700, #DAA520)" : "rgba(20,20,20,0.9)",
                        color: "#fff",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: 14,
                        lineHeight: 1.4,
                      }}
                    >
                      {m.content}
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 4, textAlign: "right" }}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: 10, borderTop: "1px solid rgba(255,215,0,0.2)", display: "flex", gap: 6, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); send(); } }}
                  placeholder="Type a message..."
                  disabled={sending}
                  rows={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "10px 12px",
                    borderRadius: 18,
                    background: "rgba(10,10,10,0.8)",
                    color: "#fff",
                    border: "1px solid rgba(255,215,0,0.3)",
                    fontSize: 16,
                    fontFamily: "inherit",
                    resize: "none",
                    maxHeight: 120,
                    outline: "none",
                  }}
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  style={{
                    padding: isMobile ? "10px 14px" : "10px 18px",
                    borderRadius: 18,
                    border: "none",
                    background: draft.trim() ? "linear-gradient(135deg, #FFD700, #DAA520)" : "rgba(255,215,0,0.3)",
                    color: "#fff",
                    cursor: sending ? "wait" : "pointer",
                    fontWeight: 600,
                    minWidth: isMobile ? 56 : 72,
                    flexShrink: 0,
                  }}
                >
                  {sending ? "…" : isMobile ? "➤" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

const ghostBtn = {
  padding: "8px 14px",
  borderRadius: 8,
  background: "rgba(20,20,20,0.6)",
  color: "#FFD700",
  border: "1px solid rgba(255,215,0,0.3)",
  cursor: "pointer"
};
