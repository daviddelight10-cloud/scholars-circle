import { useEffect, useState } from "react";
import { IconCheck, IconClock, IconCopy, IconCrown, IconList, IconShare, IconSpinner, IconUserMinus, IconUsers } from "../icons.jsx";
import { messagesApi } from "../../messages/messagesApi.js";

const TIMES = [15, 20, 30, 45, 60];

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function LobbyView({ room, myId, actions }) {
  const { code, title, isHost, settings, participants } = room;
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [peerQ, setPeerQ] = useState("");
  const [peers, setPeers] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  const me = participants.find((p) => p.userId === myId);
  const inviteUrl = `${window.location.origin}/live/${code}`;
  const inviteText = `Join my live quiz on Scholar's Circle — "${title}" ⚡\n${inviteUrl}`;
  const allReady = participants.every((p) => p.lobbyReady);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Live Quiz invite", text: inviteText });
      } else {
        copyInvite();
      }
    } catch { /* cancelled */ }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, "_blank");
  };

  // Peer search for in-app friend invites
  useEffect(() => {
    if (!inviteOpen) return;
    const t = setTimeout(() => {
      messagesApi.searchPeers({ q: peerQ }).then(setPeers).catch(() => setPeers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [peerQ, inviteOpen]);

  const inviteFriend = async (p) => {
    try {
      await messagesApi.send({ toUserId: p.id, content: inviteText });
      setSentTo(p.id);
      setTimeout(() => setSentTo(null), 2000);
    } catch { /* best-effort */ }
  };

  const kick = (p) => {
    if (window.confirm(`Remove ${p.username} from the session?`)) actions.kick(p.userId);
  };

  return (
    <div className="lq-view">
      <p className="lq-label">Create live session</p>
      <h2 className="lq-title">{title}</h2>
      <p className="lq-subtitle">
        Share the invite link — everyone answers the same questions, at the same time.
      </p>

      <div className="lq-section">
        <div className="lq-code-card">
          <div>
            <p className="lq-label" style={{ marginBottom: 4 }}>Room code</p>
            <div className="lq-code">{code}</div>
          </div>
          <button className="lq-icon-btn" onClick={copyInvite} aria-label="Copy invite link" style={{ width: 44, height: 44 }}>
            {copied ? <IconCheck size={18} style={{ color: "#3DD68C" }} /> : <IconCopy size={18} />}
          </button>
        </div>
        <div className="lq-invite-btns">
          <button className="lq-invite-btn" onClick={shareNative}>
            <IconShare size={13} /> Share link
          </button>
          <button className="lq-invite-btn" onClick={shareWhatsApp}>💬 WhatsApp</button>
          <button className={`lq-invite-btn${inviteOpen ? " on" : ""}`} onClick={() => setInviteOpen((v) => !v)}>
            <IconUsers size={13} /> Invite friends
          </button>
        </div>
        {inviteOpen && (
          <div className="lq-invite-panel">
            <input
              className="lq-invite-search"
              placeholder="Search people…"
              value={peerQ}
              onChange={(e) => setPeerQ(e.target.value)}
              autoFocus
            />
            <div className="lq-invite-peers">
              {peers === null && <p className="lq-invite-empty">Loading…</p>}
              {peers?.length === 0 && <p className="lq-invite-empty">No one found{peerQ ? ` for "${peerQ}"` : ""}.</p>}
              {(peers || []).map((p) => (
                <button key={p.id} className="lq-peer-row" onClick={() => inviteFriend(p)} disabled={sentTo === p.id}>
                  <span
                    className="lq-peer-ava"
                    style={p.avatar ? { backgroundImage: `url(${p.avatar})`, backgroundSize: "cover" } : { background: "#3B82F6" }}
                  >
                    {!p.avatar && (p.name || "?").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="lq-peer-name">{p.name}</span>
                  <span className="lq-peer-send">{sentTo === p.id ? "Sent ✓" : "Invite"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isHost ? (
        <div className="lq-setup-grid">
          <div className="lq-section">
            <p className="lq-label">Time per question</p>
            <div className="lq-time-chips">
              {TIMES.map((t) => (
                <button
                  key={t}
                  className={`lq-time-chip${settings.timePerQuestion === t ? " selected" : ""}`}
                  onClick={() => actions.updateSettings(t, settings.numQuestions)}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
          <div className="lq-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p className="lq-label" style={{ marginBottom: 0 }}>Number of questions</p>
              <p style={{ fontSize: 11, color: "#6B7280", margin: 0 }}>Max: {room.maxQuestions || 20}</p>
            </div>
            <div className="lq-stepper">
              <button
                className="lq-step-btn"
                disabled={settings.numQuestions <= 1}
                onClick={() => actions.updateSettings(settings.timePerQuestion, settings.numQuestions - 1)}
              >−</button>
              <span className="lq-step-value">{settings.numQuestions}</span>
              <button
                className="lq-step-btn"
                disabled={settings.numQuestions >= (room.maxQuestions || 20)}
                onClick={() => actions.updateSettings(settings.timePerQuestion, settings.numQuestions + 1)}
              >+</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="lq-section">
          <p className="lq-label">Host settings</p>
          <div className="lq-settings-summary">
            <div className="lq-summary-item"><IconClock size={16} /> {settings.timePerQuestion} seconds per question</div>
            <div className="lq-summary-item"><IconList size={16} /> {settings.numQuestions} questions in total</div>
          </div>
        </div>
      )}

      <div className="lq-section">
        <p className="lq-label"><IconUsers size={12} style={{ verticalAlign: "-2px" }} /> Participants ({participants.length}/8)</p>
        <div className="lq-invite-grid">
          {participants.map((p) => {
            const ready = p.lobbyReady;
            return (
              <div className="lq-invite-card" key={p.userId}>
                <span className="lq-invite-avatar" style={{ background: p.color, opacity: p.connected ? 1 : 0.4 }}>
                  {initials(p.username)}
                </span>
                <p className="lq-invite-name">
                  {p.username}{p.userId === myId ? " (You)" : ""}{p.isHost ? " · Host" : ""}
                </p>
                {isHost && p.userId !== myId ? (
                  <span className="lq-host-tools">
                    <button
                      className="lq-mini-btn"
                      title={`Make ${p.username} the host`}
                      aria-label={`Make ${p.username} the host`}
                      onClick={() => actions.transferHost(p.userId)}
                    ><IconCrown size={13} /></button>
                    <button
                      className="lq-mini-btn danger"
                      title={`Remove ${p.username}`}
                      aria-label={`Remove ${p.username}`}
                      onClick={() => kick(p)}
                    ><IconUserMinus size={13} /></button>
                  </span>
                ) : (
                  <span className={`lq-invite-status ${ready ? "lq-status-ready" : "lq-status-waiting"}`}>
                    {ready ? <><IconCheck size={12} /> Ready</> : <><IconSpinner size={12} /> Waiting…</>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="lq-action-group">
        {isHost ? (
          <>
            <button className="lq-btn-primary" onClick={actions.start}>
              {allReady ? "Start Session" : "Start Session Anyway"}
            </button>
            <p style={{ fontSize: 11, color: "#6B7280", textAlign: "center", margin: 0 }}>
              Friends can only join before the first question starts.
            </p>
          </>
        ) : me?.lobbyReady ? (
          <button className="lq-btn-primary loading" disabled>Waiting for host to start…</button>
        ) : (
          <button className="lq-btn-primary" onClick={() => actions.lobbyReady(true)}>Ready Up!</button>
        )}
      </div>
    </div>
  );
}
