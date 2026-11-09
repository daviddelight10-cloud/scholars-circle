import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuiz } from "./useLiveQuiz.js";
import { useLiveKitVoice } from "./useLiveKitVoice.js";
import { endLiveRoom } from "./liveQuizApi.js";
import { sounds } from "./sounds.js";
import LobbyView from "./views/LobbyView.jsx";
import VotingView from "./views/VotingView.jsx";
import RevealView from "./views/RevealView.jsx";
import CompleteView from "./views/CompleteView.jsx";
import { IconBulb, IconChat, IconCheck, IconClock, IconMic, IconMicOff, IconMore, IconSend, IconVolume, IconVolumeOff, IconX } from "./icons.jsx";
import { ConfirmSheet, HostSheet } from "./Sheets.jsx";
import { ScoreStrip } from "./LiveBoard.jsx";
import AvatarMark from "../../components/AvatarMark.jsx";

const EMOJIS = ["💡", "🔥", "👏", "❤️", "😂"];

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Participants strip — in-flow above the body (left rail on desktop).
// Rendered only while playing: the lobby and results screens already list
// everyone, and it never needs to overlap question text.
const RAIL_PHASES = ["transition", "question", "reveal", "teachback"];
function ParticipantRail({ room, myId, voice }) {
  if (!RAIL_PHASES.includes(room.phase)) return null;
  // A per-person avatar rail is unreadable past ~12 players — show the
  // top 3 + your rank and let people open the full board instead.
  if (room.participants.filter((p) => !p.spectator).length > 12) return <ScoreStrip room={room} myId={myId} />;
  return (
    <div className="lq-rail" aria-label="Participants">
      {room.participants.map((p) => {
        const lockedIn = room.phase === "question" && (room.question?.lockedIds || []).includes(p.userId);
        const pts = p.points || 0;
        const delta = room.phase === "reveal" || room.phase === "teachback" ? room.reveal?.pointsDelta?.[p.userId] : null;
        return (
          <div className="lq-pcell" key={p.userId} title={p.username}>
            <div
              className={`lq-pcell-ava${voice.speakingIds.has(p.userId) ? " speaking" : ""}${p.connected ? "" : " offline"}${p.isHost ? " host" : ""}`}
              style={{ background: p.avatar ? "transparent" : p.color }}
            >
              {p.avatar ? <AvatarMark avatar={p.avatar} name={p.username} size={28} /> : initials(p.username)}
              {lockedIn && <span className="lq-pcell-lock"><IconCheck size={8} /></span>}
            </div>
            {(pts > 0 || delta != null) && (
              <span className={`lq-pcell-pts${p.userId === myId ? " me" : ""}`}>
                {pts}{delta ? <em className={delta > 0 ? "up" : "down"}>{delta > 0 ? `+${delta}` : delta}</em> : null}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Group-vs-group battle: persistent team scoreboard under the header. Lineups
// can be asymmetric, so each side's score is the average of its players who
// answered — headcount doesn't move the bar, quality per player does.
function BattleBar({ battle }) {
  if (!battle) return null;
  const { a, b, scores, myTeam, mode } = battle;
  const sa = scores?.a || 0;
  const sb = scores?.b || 0;
  return (
    <div className="lq-battlebar" role="status" aria-label="Battle score (average points per player)">
      <span className={`lq-battlebar-team${myTeam === "a" ? " me" : ""}${sa > sb ? " ahead" : ""}`}>
        <b>{a?.name}</b><em>{sa}<i className="lq-battlebar-avg">avg</i></em>
      </span>
      <span className="lq-battlebar-mid">
        {mode === "ranked" ? "🏅 RANKED" : "⚔️ VS"}
      </span>
      <span className={`lq-battlebar-team right${myTeam === "b" ? " me" : ""}${sb > sa ? " ahead" : ""}`}>
        <em>{sb}<i className="lq-battlebar-avg">avg</i></em><b>{b?.name}</b>
      </span>
    </div>
  );
}

function TransitionView({ room }) {
  const [count, setCount] = useState(3);
  useEffect(() => {
    const iv = setInterval(() => setCount((c) => (c > 1 ? c - 1 : c)), 700);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="lq-view" style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p className="lq-q-label">GET READY</p>
        <p key={count} className="lq-countdown">{count}</p>
        <p style={{ fontSize: 13, color: "var(--app-dim)", marginTop: 8 }}>
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

  const room = useLiveQuiz(roomId, ticket, { onReaction, onChat, myId });
  useEffect(() => { roomRef.current = room; });
  const [soundOn, setSoundOn] = useState(() => !sounds.muted);

  // Voice connects once the session is live (and stays for lobby so friends can talk while waiting)
  const voice = useLiveKitVoice(roomId, room.phase !== "connecting" && room.phase !== "ended" && room.phase !== "error");

  // Voice windows: mics auto-mute while answers are being cast (so nobody can
  // call out the answer) unless the host opened the floor. Auto-restore after.
  const autoMutedRef = useRef(false);
  useEffect(() => {
    if (!voice.connected || !voice.setMicMuted) return;
    const quiet = room.phase === "question" && !room.micOpen;
    if (quiet && !voice.muted && !autoMutedRef.current) {
      autoMutedRef.current = true;
      voice.setMicMuted(true);
    } else if (!quiet && autoMutedRef.current) {
      autoMutedRef.current = false;
      voice.setMicMuted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.phase, room.micOpen, voice.connected, voice.muted]);

  const micLocked = room.phase === "question" && !room.micOpen;

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

  const [confirm, setConfirm] = useState(null); // "leave" | "end" | null
  const [hostOpen, setHostOpen] = useState(false);

  const doLeave = () => {
    // The host leaving ends the session for everyone (their X is treated like
    // End — a live session without its host has no driver). Battle rooms run
    // host-less by design, so their host can simply step out.
    if (room.isHost && !room.battle && room.phase !== "ended") {
      try { endLiveRoom(roomId); } catch {}
      room.actions.end();
    } else {
      room.actions.leave();
    }
    onExit?.();
  };

  const handleLeave = () => {
    const hostEnds = room.isHost && !room.battle && room.phase !== "ended" && room.phase !== "complete";
    if (hostEnds) setConfirm("leave");
    else doLeave();
  };

  const doEnd = async () => {
    try { await endLiveRoom(roomId); } catch {}
    room.actions.end();
    onExit?.();
  };

  const headerLabel =
    room.phase === "lobby" ? "LOBBY" :
    room.phase === "complete" ? "COMPLETE" :
    room.phase === "ended" ? "ENDED" :
    "LIVE";

  const meConnected = room.participants.find((p) => p.userId === myId)?.connected !== false;

  // Compact question counter + countdown, owned by the header bar
  const qTotal = room.question?.total || (room.phase !== "lobby" ? room.settings.numQuestions : 0);
  const showQChip = ["transition", "question", "reveal", "teachback"].includes(room.phase) && qTotal > 0;
  const qNow = Math.min(
    (room.phase === "reveal" || room.phase === "teachback"
      ? (room.reveal?.index ?? Math.max(0, room.talkedThrough - 1))
      : room.talkedThrough) + 1,
    qTotal
  );
  const timeLimit = room.question?.timeLimit || room.settings.timePerQuestion || 30;
  const inQuestion = room.phase === "question" && room.timeLeft != null;

  return (
    <div className="lq-app">
      <div className="lq-header">
        <div className="lq-header-inner">
          <button className="lq-icon-btn exit" aria-label="Exit session" onClick={handleLeave}>
            <IconX size={18} />
          </button>
          <div className="lq-header-title">
            <p className="label">{room.phase !== "lobby" && room.phase !== "complete" && room.phase !== "ended" && <span className="lq-live-dot" style={{ display: "inline-block", marginRight: 5, verticalAlign: "middle" }} />}{headerLabel}</p>
            <p className="title">{room.title || "Live Quiz"}</p>
          </div>
          {showQChip && <span className="lq-q-count">Q{qNow}/{qTotal}</span>}
          {inQuestion && (
            <span className={`lq-timer-chip${!room.paused && room.timeLeft <= 5 ? " danger" : ""}`}>
              {room.paused ? "⏸" : `${room.timeLeft}s`}
            </span>
          )}
        </div>
        {inQuestion && (
          <div
            className={`lq-header-progress${room.timeLeft <= 5 ? " danger" : ""}`}
            style={{ width: `${Math.max(0, Math.min(100, (room.timeLeft / timeLimit) * 100))}%` }}
            role="timer"
            aria-label={`${room.timeLeft} seconds left`}
          />
        )}
      </div>

      <div className="lq-stage">
        {room.battle && room.phase !== "complete" && <BattleBar battle={room.battle} />}
        <ParticipantRail room={room} myId={myId} voice={voice} />
        <div className="lq-body">
        {room.phase === "connecting" && (
          <div className="lq-view"><div className="lq-center">
            <IconClock size={28} style={{ color: "#F5C542", marginBottom: 12 }} />
            <p style={{ color: "var(--app-dim)", fontSize: 14 }}>Connecting to live session…</p>
          </div></div>
        )}
        {room.phase === "lobby" && <LobbyView room={room} myId={myId} actions={room.actions} />}
        {room.phase === "transition" && <TransitionView room={room} />}
        {room.phase === "question" && <VotingView room={room} actions={room.actions} timeLeft={room.timeLeft} myId={myId} />}
        {(room.phase === "reveal" || room.phase === "teachback") && <RevealView room={room} myId={myId} actions={room.actions} />}
        {room.phase === "complete" && (
          <CompleteView room={room} myId={myId} onBackToLobby={room.actions.backToLobby} onExit={handleLeave} />
        )}
        {room.phase === "ended" && (
          <div className="lq-view"><div className="lq-center">
            <p className="lq-title" style={{ fontSize: 20 }}>{room.endReason === "kicked" ? "Removed from session" : "Session ended"}</p>
            <p className="lq-subtitle">{room.endReason === "kicked" ? "The host removed you from this live quiz." : "The host wrapped up this live session."}</p>
            <button className="lq-btn-primary" style={{ maxWidth: 320 }} onClick={onExit}>Back to My Space</button>
          </div></div>
        )}
        {room.phase === "error" && (
          <div className="lq-view"><div className="lq-center">
            <p className="lq-title" style={{ fontSize: 20 }}>Connection lost</p>
            <p className="lq-subtitle">{room.error || "Couldn't reach the session."}</p>
            <button className="lq-btn-primary" style={{ maxWidth: 320 }} onClick={room.retry}>Reconnect</button>
            <button className="lq-btn-secondary" style={{ maxWidth: 320 }} onClick={onExit}>Go back</button>
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
                  m.avatar
                    ? <AvatarMark avatar={m.avatar} name={m.name} size={20} className="lq-chat-avatar" />
                    : <span className="lq-chat-avatar" style={{ background: m.color || "#555" }}>{initials(m.name)}</span>
                )}
                <p className="lq-chat-bubble">{m.text}</p>
                {m.userId === myId && (
                  m.avatar
                    ? <AvatarMark avatar={m.avatar} name={m.name} size={20} className="lq-chat-avatar" />
                    : <span className="lq-chat-avatar" style={{ background: m.color || "#3B82F6" }}>{initials(m.name)}</span>
                )}
              </div>
            ))}
            {room.chat.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--app-dim)", textAlign: "center" }}>No messages yet — say hi!</p>
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
      </div>

      <div className="lq-footer">
        <p className="lq-footer-text">
          {room.groupStreak > 0 ? `🔥 Group streak ${room.groupStreak}` : ""}
          {!meConnected && `${room.groupStreak > 0 ? " · " : ""}reconnecting…`}
        </p>
        <div className="lq-footer-btns">
          <button className="lq-footer-btn labelled" onClick={() => setEmojiOpen((o) => !o)} aria-label="Send reaction">
            <IconBulb size={19} /><span>React</span>
          </button>
          <button
            className={`lq-footer-btn labelled${!voice.muted ? " mic-on" : " active-mic"}`}
            onClick={voice.toggleMic}
            disabled={!voice.voiceAvailable || !voice.connected || micLocked}
            aria-label="Toggle microphone"
            title={micLocked ? "Mic opens when answers reveal" : voice.voiceAvailable ? (voice.muted ? "Unmute mic" : "Mute mic") : "Voice not configured"}
          >
            {voice.muted ? <IconMicOff size={19} /> : <IconMic size={19} />}<span>{voice.muted ? "Muted" : "Mic on"}</span>
          </button>
          <button
            className="lq-footer-btn labelled"
            onClick={() => { sounds.setMuted(soundOn); setSoundOn(!soundOn); }}
            aria-label={soundOn ? "Mute sounds" : "Unmute sounds"}
          >
            {soundOn ? <IconVolume size={19} /> : <IconVolumeOff size={19} />}<span>Sound</span>
          </button>
          <button
            className={`lq-footer-btn labelled${chatOpen ? " active-chat" : ""}${room.unread > 0 ? " has-unread" : ""}`}
            onClick={toggleChat}
            aria-label="Toggle chat"
          >
            <IconChat size={19} /><span>Chat</span>
            {room.unread > 0 && <span className="lq-chat-badge">{room.unread}</span>}
          </button>
          {room.isHost && room.phase !== "complete" && room.phase !== "ended" && (
            <button
              className={`lq-footer-btn labelled${room.presenterMode || room.micOpen ? " mic-open" : ""}`}
              onClick={() => setHostOpen(true)}
              aria-label="Host tools"
            >
              <IconMore size={19} /><span>Host</span>
            </button>
          )}
        </div>
      </div>

      {confirm === "leave" && (
        <ConfirmSheet
          title="Leave and end this session?"
          body="You're the host, so leaving ends the live quiz for everyone."
          confirmLabel="End for everyone"
          danger
          onConfirm={() => { setConfirm(null); doLeave(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "end" && (
        <ConfirmSheet
          title="End this live session?"
          body="Everyone is taken out of the room. This can't be undone."
          confirmLabel="End for everyone"
          danger
          onConfirm={() => { setConfirm(null); doEnd(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {hostOpen && (
        <HostSheet
          presenterMode={room.presenterMode}
          micOpen={room.micOpen}
          canPresent={!room.battle}
          onPresenter={() => room.actions.setPresenter(!room.presenterMode)}
          onMic={() => room.actions.setMicMode(!room.micOpen)}
          onEnd={() => { setHostOpen(false); setConfirm("end"); }}
          onClose={() => setHostOpen(false)}
        />
      )}
    </div>
  );
}

