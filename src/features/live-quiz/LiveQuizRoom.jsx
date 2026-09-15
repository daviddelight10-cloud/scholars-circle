import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuiz } from "./useLiveQuiz.js";
import { useLiveKitVoice } from "./useLiveKitVoice.js";
import { endLiveRoom } from "./liveQuizApi.js";
import { sounds } from "./sounds.js";
import LobbyView from "./views/LobbyView.jsx";
import VotingView from "./views/VotingView.jsx";
import RevealView from "./views/RevealView.jsx";
import CompleteView from "./views/CompleteView.jsx";
import { IconBulb, IconChat, IconCheck, IconClock, IconMic, IconMicOff, IconSend, IconStop, IconX } from "./icons.jsx";

const EMOJIS = ["💡", "🔥", "👏", "❤️", "😂"];

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function TransitionView({ room }) {
  return (
    <div className="lq-view" style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p className="lq-q-label">GET READY</p>
        <p style={{ fontFamily: "Georgia,serif", fontSize: 32, fontWeight: 700, color: "#F3F4F6", margin: "8px 0 0" }}>
          Next question coming…
        </p>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
          Question {(room.nextIndex ?? 0) + 1} of {room.question?.total || room.settings.numQuestions}
        </p>
      </div>
    </div>
  );
}

export default function LiveQuizRoom({ roomId, ticket, myId, onExit }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const chatEndRef = useRef(null);
  const chatOpenRef = useRef(false);
  const roomRef = useRef(null);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  const onReaction = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setFloaters((f) => [...f, { id, emoji: msg.emoji, right: 16 + Math.random() * 40 }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2100);
    sounds.pop();
  }, []);

  const onChat = useCallback((msg) => {
    if (!chatOpenRef.current && msg.userId !== myId) roomRef.current?.setUnread((n) => n + 1);
  }, [myId]);

  const room = useLiveQuiz(roomId, ticket, { onReaction, onChat });
  useEffect(() => { roomRef.current = room; });

  // Voice connects once the session is live (and stays for lobby so friends can talk while waiting)
  const voice = useLiveKitVoice(roomId, room.phase !== "connecting" && room.phase !== "ended" && room.phase !== "error");

  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
    }
  }, [room.chat, chatOpen]);

  const [chatText, setChatText] = useState("");

  const toggleChat = () => {
    setChatOpen((o) => {
      const next = !o;
      if (next) room.setUnread(0);
      return next;
    });
  };

  const sendChat = () => {
    const v = chatText.trim();
    if (!v) return;
    room.actions.sendChat(v);
    setChatText("");
  };

  const handleLeave = () => {
    room.actions.leave();
    onExit?.();
  };

  const handleEnd = async () => {
    if (!window.confirm("End this live session for everyone?")) return;
    try { await endLiveRoom(roomId); } catch {}
    room.actions.end();
    onExit?.();
  };

  const headerLabel =
    room.phase === "lobby" ? "PRE-SESSION LOBBY" :
    room.phase === "complete" ? "SESSION COMPLETE" :
    room.phase === "ended" ? "SESSION ENDED" :
    `LIVE · ${room.code || ""}`;

  const meConnected = room.participants.find((p) => p.userId === myId)?.connected !== false;

  return (
    <div className="lq-app">
      <div className="lq-header">
        <div className="lq-header-top">
          <button className="lq-icon-btn exit" aria-label="Exit session" onClick={handleLeave}>
            <IconX size={18} />
          </button>
          <div className="lq-header-title">
            <p className="label">{headerLabel}</p>
            <p className="title">{room.title || "Live Quiz"}</p>
          </div>
          {room.phase !== "lobby" && room.phase !== "complete" && room.phase !== "ended" && (
            <span className="lq-live-badge"><span className="lq-live-dot" />LIVE</span>
          )}
          {room.isHost && room.phase !== "complete" && room.phase !== "ended" && (
            <button className="lq-icon-btn" onClick={handleEnd} title="End session for everyone" aria-label="End session for everyone"
              style={{ color: "#FF6B5E" }}>
              <IconStop size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="lq-avatar-row">
          {room.participants.map((p) => (
            <div className="lq-avatar-wrap" key={p.userId} title={p.username}>
              <div
                className={`lq-avatar${voice.speakingIds.has(p.userId) ? " speaking" : ""}${p.connected ? "" : " offline"}`}
                style={{ background: p.color }}
              >
                {initials(p.username)}
              </div>
              {room.phase === "question" && p.userId === myId && room.timeLeft != null && !room.question?.answered && (
                <span className="lq-avatar-status" style={{ background: "#12161F", color: room.timeLeft <= 5 ? "#FF6B5E" : "#F5C542" }}>
                  {room.timeLeft}
                </span>
              )}
              {room.phase === "question" && room.reveal == null && room.question?.answered && p.userId === myId && (
                <span className="lq-avatar-status" style={{ background: "#3DD68C", color: "#0A0C10" }}><IconCheck size={9} /></span>
              )}
            </div>
          ))}
      </div>

      <div className="lq-body">
        {room.phase === "connecting" && (
          <div className="lq-view"><div className="lq-center">
            <IconClock size={28} style={{ color: "#F5C542", marginBottom: 12 }} />
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Connecting to live session…</p>
          </div></div>
        )}
        {room.phase === "lobby" && <LobbyView room={room} myId={myId} actions={room.actions} />}
        {room.phase === "transition" && <TransitionView room={room} />}
        {room.phase === "question" && <VotingView room={room} actions={room.actions} timeLeft={room.timeLeft} />}
        {(room.phase === "reveal" || room.phase === "teachback") && <RevealView room={room} myId={myId} actions={room.actions} />}
        {room.phase === "complete" && (
          <CompleteView room={room} myId={myId} onBackToLobby={room.actions.backToLobby} onExit={handleLeave} />
        )}
        {room.phase === "ended" && (
          <div className="lq-view"><div className="lq-center">
            <p className="lq-title" style={{ fontSize: 20 }}>Session ended</p>
            <p className="lq-subtitle">The host wrapped up this live session.</p>
            <button className="lq-btn-primary" style={{ maxWidth: 320 }} onClick={onExit}>Back to My Space</button>
          </div></div>
        )}
        {room.phase === "error" && (
          <div className="lq-view"><div className="lq-center">
            <p className="lq-title" style={{ fontSize: 20 }}>Connection lost</p>
            <p className="lq-subtitle">{room.error || "Couldn't reach the session."}</p>
            <button className="lq-btn-primary" style={{ maxWidth: 320 }} onClick={onExit}>Go back</button>
          </div></div>
        )}
      </div>

      {/* Poll overlay (lifeline results) */}
      {room.poll && (
        <div className="lq-poll-overlay">
          <div className="lq-poll-header">
            <p className="lq-poll-title">
              {room.poll.denied ? "LIFELINE UNAVAILABLE" : `GROUP POLL — ${room.poll.basedOn || 0} ANSWERS IN`}
            </p>
            <button className="lq-poll-close" onClick={() => room.actions.clearPoll()}>
              <IconX size={14} />
            </button>
          </div>
          {room.poll.denied ? (
            <p style={{ fontSize: 13, color: "#FF6B5E", margin: 0 }}>{room.poll.denied}</p>
          ) : (
            ["A", "B", "C", "D"].map((letter) => {
              const total = Object.values(room.poll.votes).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round(((room.poll.votes[letter] || 0) / total) * 100);
              return (
                <div className="lq-poll-bar-row" key={letter}>
                  <span className="lq-poll-letter">{letter}</span>
                  <div className="lq-poll-bar-bg"><div className="lq-poll-bar-fill" style={{ width: `${pct}%` }} /></div>
                  <span className="lq-poll-percent">{pct}%</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Emoji picker popover */}
      {emojiOpen && (
        <div className="lq-emoji-pop">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => { room.actions.react(e); setEmojiOpen(false); }}>{e}</button>
          ))}
        </div>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <div className="lq-chat-panel">
          <p className="lq-chat-header">GROUP CHAT</p>
          <div className="lq-chat-messages" ref={chatEndRef}>
            {room.chat.map((m, i) => (
              <div className={`lq-chat-msg${m.userId === myId ? " me" : ""}`} key={i}>
                {m.userId !== myId && (
                  <span className="lq-chat-avatar" style={{ background: m.color || "#555" }}>{initials(m.name)}</span>
                )}
                <p className="lq-chat-bubble">{m.text}</p>
                {m.userId === myId && (
                  <span className="lq-chat-avatar" style={{ background: m.color || "#3B82F6" }}>{initials(m.name)}</span>
                )}
              </div>
            ))}
            {room.chat.length === 0 && (
              <p style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>No messages yet — say hi!</p>
            )}
          </div>
          <div className="lq-chat-row">
            <input
              className="lq-chat-input"
              type="text"
              placeholder="Message the group…"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } }}
              enterKeyHint="send"
              maxLength={300}
            />
            <button className="lq-icon-btn" onClick={sendChat} style={{ background: "#F5C542", color: "#1A1400", border: "none", width: 46, height: 46 }} aria-label="Send">
              <IconSend size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Floating reactions */}
      {floaters.map((f) => (
        <div key={f.id} className="lq-float-emoji" style={{ right: f.right }}>{f.emoji}</div>
      ))}

      <div className="lq-footer">
        <p className="lq-footer-text">
          {room.groupStreak > 0 ? `🔥 Group streak: ${room.groupStreak} · ` : ""}
          {room.phase === "lobby" ? "Waiting to start…" :
           room.phase === "complete" ? "Session complete" :
           room.phase === "ended" ? "Session ended" :
           `Question ${Math.min(room.talkedThrough + 1, room.question?.total || room.settings.numQuestions)}/${room.question?.total || room.settings.numQuestions}`}
          {!meConnected && " · reconnecting…"}
        </p>
        <div className="lq-footer-btns">
          <button className="lq-footer-btn" onClick={() => setEmojiOpen((o) => !o)} aria-label="Send reaction">
            <IconBulb size={20} />
          </button>
          <button
            className={`lq-footer-btn${!voice.muted ? " mic-on" : " active-mic"}`}
            onClick={voice.toggleMic}
            disabled={!voice.voiceAvailable || !voice.connected}
            aria-label="Toggle microphone"
            title={voice.voiceAvailable ? (voice.muted ? "Unmute mic" : "Mute mic") : "Voice not configured"}
          >
            {voice.muted ? <IconMicOff size={20} /> : <IconMic size={20} />}
          </button>
          <button
            className={`lq-footer-btn${chatOpen ? " active-chat" : ""}${room.unread > 0 ? " has-unread" : ""}`}
            onClick={toggleChat}
            aria-label="Toggle chat"
          >
            <IconChat size={20} />
            {room.unread > 0 && <span className="lq-chat-badge">{room.unread}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
