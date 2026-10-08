import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { IconBolt, IconBrain, IconClover, IconShare, IconTrophy, IconZap } from "../icons.jsx";
import { getLiveHistory } from "../liveQuizApi.js";

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AWARD_STYLE = {
  lucky: { Icon: IconClover, color: "#3DD68C", bg: "rgba(61,214,140,0.12)" },
  speed: { Icon: IconBolt, color: "#F5C542", bg: "rgba(245,197,66,0.12)" },
  brain: { Icon: IconBrain, color: "#7FADF5", bg: "rgba(79,142,247,0.12)" },
  clutch: { Icon: IconZap, color: "#FF9F43", bg: "rgba(255,159,67,0.12)" },
};

const MEDALS = ["🥇", "🥈", "🥉"];

function calibrationVerdict(cal) {
  if (!cal) return null;
  const [hc, hw] = cal.High || [0, 0];
  const [lc] = cal.Low || [0, 0];
  if (hw > 0) {
    return { tone: "bad", text: `⚠️ Overconfident on ${hw} answer${hw === 1 ? "" : "s"} — high confidence, wrong pick` };
  }
  if (hc >= 2) {
    return { tone: "good", text: `🎯 Well calibrated — ${hc} high-confidence call${hc === 1 ? "" : "s"} and no misses` };
  }
  if (lc > hc) {
    return { tone: "", text: `💡 You knew more than you thought — ${lc} correct on low confidence` };
  }
  return null;
}

export default function CompleteView({ room, myId, onBackToLobby, onExit }) {
  const c = room.complete;
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    getLiveHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  if (!c) return null;
  const myXp = c.xpEarned?.[myId] || 0;
  const verdict = calibrationVerdict(c.calibration?.[myId]);
  const winner = c.leaderboard?.[0];

  const shareResults = async () => {
    if (sharing || !cardRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `live-quiz-${room.code || "results"}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${room.title} — Live Quiz` });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = file.name;
        a.click();
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.warn("Share card failed:", e?.message);
    }
    setSharing(false);
  };

  return (
    <div className="lq-view">
      <div style={{ textAlign: "center", marginTop: 24 }}>
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
        {verdict && (
          <p className={`lq-cal-line ${verdict.tone}`}>{verdict.text}</p>
        )}
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
            <p className="lq-lb-score">{u.points ?? u.score}<span className="lq-lb-score-sub"> pts · {u.score}/{c.totalQuestions}</span></p>
          </div>
        ))}
      </div>

      {history && history.length > 0 && (
        <div className="lq-card">
          <p className="lq-card-label">YOUR RECENT LIVE SESSIONS</p>
          {history.slice(0, 5).map((h) => (
            <div className="lq-history-item" key={`${h.code}-${h.endedAt}`}>
              <div className="lq-history-info">
                <p className="lq-history-title">{h.title}</p>
                <p className="lq-history-meta">
                  {new Date(h.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}{h.players} player{h.players === 1 ? "" : "s"}
                  {h.winner ? ` · won by ${h.winner}` : ""}
                </p>
              </div>
              {h.myRank && (
                <span className={`lq-history-rank${h.myRank === 1 ? " top" : ""}`}>
                  #{h.myRank}{h.myPoints != null ? ` · ${h.myPoints} pts` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="lq-action-group">
        <button className="lq-btn-primary" onClick={onBackToLobby}>Rematch — back to lobby</button>
        <button className="lq-btn-secondary" onClick={shareResults} disabled={sharing}>
          <IconShare size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {sharing ? "Preparing card…" : "Share results"}
        </button>
        <button className="lq-btn-secondary" onClick={onExit}>Leave Session</button>
      </div>

      {/* Offscreen share card — rendered to PNG on demand */}
      <div ref={cardRef} className="lq-sharecard" aria-hidden="true">
        <div className="lq-sc-body">
          <div className="lq-sc-brand">
            <span className="lq-sc-badge" style={{ color: "#F5C542" }}>⚡ SCHOLAR'S CIRCLE</span>
            <span className="lq-sc-live"><span className="lq-sc-live-dot" />LIVE QUIZ</span>
          </div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 44, fontWeight: 700, color: "#F3F4F6", margin: 0, lineHeight: 1.2 }}>{room.title}</p>
          <div className="lq-sc-ranks">
            {c.leaderboard.slice(0, 5).map((u, i) => (
              <div className={`lq-sc-row${u.userId === myId ? " me" : ""}`} key={u.userId}>
                <span className="lq-sc-rank">{MEDALS[i] || `#${i + 1}`}</span>
                <span className="lq-sc-ava" style={{ background: u.color }}>{initials(u.username)}</span>
                <span className="lq-sc-name">{u.username}</span>
                <span className="lq-sc-pts"><b>{u.points ?? u.score}</b><i> pts · {u.score}/{c.totalQuestions}</i></span>
              </div>
            ))}
          </div>
          <div className="lq-sc-cta">
            <p>{winner ? `${winner.username} takes the crown — think you can beat them?` : "Think you can beat these scores?"}</p>
            <span>Join the next one → scholarcircle.app</span>
          </div>
        </div>
      </div>
    </div>
  );
}
