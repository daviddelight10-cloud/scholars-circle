import React, { useEffect, useRef, useState } from "react";
import { lecturersApi } from "./api.js";

export function Messages({ token, currentUser, initialPartner, onBack }) {
  const [inbox, setInbox] = useState([]);
  const [activePartner, setActivePartner] = useState(initialPartner || null);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

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

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>💬 Messages</h2>
        {onBack && <button onClick={onBack} style={ghostBtn}>← Back</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, minHeight: 500 }}>
        {/* Inbox sidebar */}
        <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: 600 }}>
          <div style={{ padding: 12, borderBottom: "1px solid rgba(99,102,241,0.2)", fontWeight: 600 }}>Conversations</div>
          {loadingInbox && <div style={{ padding: 16, color: "#9ca3af" }}>Loading...</div>}
          {!loadingInbox && inbox.length === 0 && (
            <div style={{ padding: 20, color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
              No messages yet.<br />Find a lecturer in the directory and click Message.
            </div>
          )}
          <div style={{ overflowY: "auto", maxHeight: 540 }}>
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
                    background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(99,102,241,0.1)",
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
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

        {/* Thread view */}
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: 600 }}>
          {!activePartner ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Select a conversation to start messaging
            </div>
          ) : (
            <>
              <div style={{ padding: 12, borderBottom: "1px solid rgba(99,102,241,0.2)", fontWeight: 600 }}>
                {activePartner.displayName || activePartner.fullName || "Conversation"}
              </div>
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
                        maxWidth: "75%",
                        padding: "8px 12px",
                        borderRadius: 12,
                        background: mine ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(30,41,59,0.9)",
                        color: "#fff",
                        whiteSpace: "pre-wrap",
                        fontSize: 14
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
              <div style={{ padding: 12, borderTop: "1px solid rgba(99,102,241,0.2)", display: "flex", gap: 6 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message..."
                  disabled={sending}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: "rgba(15,23,42,0.8)", color: "#fff", border: "1px solid rgba(99,102,241,0.3)" }}
                />
                <button onClick={send} disabled={sending || !draft.trim()} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: draft.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.3)", color: "#fff", cursor: sending ? "wait" : "pointer", fontWeight: 600 }}>
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const ghostBtn = {
  padding: "8px 14px",
  borderRadius: 8,
  background: "rgba(30,41,59,0.6)",
  color: "#a5b4fc",
  border: "1px solid rgba(99,102,241,0.3)",
  cursor: "pointer"
};
