import { IconBolt, IconBrain, IconClover, IconTrophy } from "../icons.jsx";

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AWARD_STYLE = {
  lucky: { Icon: IconClover, color: "#3DD68C", bg: "rgba(61,214,140,0.12)" },
  speed: { Icon: IconBolt, color: "#F5C542", bg: "rgba(245,197,66,0.12)" },
  brain: { Icon: IconBrain, color: "#7FADF5", bg: "rgba(79,142,247,0.12)" },
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function CompleteView({ room, myId, onExit }) {
  const c = room.complete;
  if (!c) return null;
  const myXp = c.xpEarned?.[myId] || 0;

  return (
    <div className="lq-view">
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", background: "rgba(245,197,66,0.12)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
        }}>
          <IconTrophy size={32} style={{ color: "#F5C542" }} />
        </div>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "#F3F4F6", margin: 0 }}>
          Session Complete
        </p>
        <p style={{ fontSize: 13, color: "#3DD68C", fontWeight: 600, marginTop: 6 }}>
          {myXp > 0 ? `+${myXp} XP EARNED` : `${myXp} XP`}
        </p>
      </div>

      {c.awards?.length > 0 && (
        <div className="lq-card">
          <p className="lq-card-label">SESSION AWARDS</p>
          <div className="lq-awards">
            {c.awards.map((a) => {
              const st = AWARD_STYLE[a.key] || AWARD_STYLE.brain;
              return (
                <div className="lq-award-card" key={a.key}>
                  <div className="lq-award-icon" style={{ background: st.bg, color: st.color }}>
                    <st.Icon size={18} />
                  </div>
                  <div className="lq-award-info">
                    <p className="lq-award-title">{a.title}</p>
                    <p className="lq-award-subtitle">{a.subtitle}</p>
                  </div>
                  <div className="lq-award-winner" style={{ color: st.color, background: st.bg }}>
                    {a.winnerId === myId ? "You" : a.winnerName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="lq-card">
        <p className="lq-card-label">FINAL SCORES</p>
        {c.leaderboard.map((u, i) => (
          <div className="lq-leaderboard-item" key={u.userId}>
            <span className="lq-lb-medal">{MEDALS[i] || `#${i + 1}`}</span>
            <span className="lq-lb-avatar" style={{ background: u.color }}>{initials(u.username)}</span>
            <p className="lq-lb-name">{u.username}{u.userId === myId ? " (You)" : ""}</p>
            <p className="lq-lb-score">{u.score}/{c.totalQuestions}</p>
          </div>
        ))}
      </div>

      <div className="lq-action-group">
        <button className="lq-btn-primary" onClick={onExit}>Back to My Space</button>
      </div>
    </div>
  );
}
