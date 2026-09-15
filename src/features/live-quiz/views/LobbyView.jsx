import { useState } from "react";
import { IconCheck, IconClock, IconCopy, IconList, IconSpinner, IconUsers } from "../icons.jsx";

const TIMES = [15, 20, 30, 45, 60];

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function LobbyView({ room, myId, actions }) {
  const { code, title, isHost, settings, participants } = room;
  const [copied, setCopied] = useState(false);

  const me = participants.find((p) => p.userId === myId);
  const inviteUrl = `${window.location.origin}/live/${code}`;
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
        <p style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
          {copied ? "Invite link copied!" : "Tap to copy the invite link, or share the code."}
        </p>
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
                <span className={`lq-invite-status ${ready ? "lq-status-ready" : "lq-status-waiting"}`}>
                  {ready ? <><IconCheck size={12} /> Ready</> : <><IconSpinner size={12} /> Waiting…</>}
                </span>
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
