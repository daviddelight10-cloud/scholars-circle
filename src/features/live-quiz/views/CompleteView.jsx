import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { IconBolt, IconBrain, IconClover, IconShare, IconTrophy, IconZap } from "../icons.jsx";
import { getLiveHistory } from "../liveQuizApi.js";
import AvatarMark from "../../../components/AvatarMark.jsx";

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AWARD_STYLE = {
  lucky: { Icon: IconClover, color: "#3DD68C", bg: "rgba(61,214,140,0.12)" },
  speed: { Icon: IconBolt, color: "#F5C542", bg: "rgba(245,197,66,0.12)" },
  brain: { Icon: IconBrain, color: "var(--c-7fadf5)", bg: "rgba(79,142,247,0.12)" },
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
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    getLiveHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  if (!c) return null;
  const myXp = c.xpEarned?.[myId] || 0;
  const verdict = calibrationVerdict(c.calibration?.[myId]);
  const winner = c.leaderboard?.[0];
  const myIdx = (c.leaderboard || []).findIndex((u) => u.userId === myId);
  const me = myIdx >= 0 ? c.leaderboard[myIdx] : null;
  const podium = (c.leaderboard || []).slice(0, 3);
  // Visual order 2 · 1 · 3 so the winner stands in the middle.
  const podiumOrder = [1, 0, 2].filter((i) => podium[i]);
  const podiumCls = ["first", "second", "third"];

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
        <p style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "var(--c-f3f4f6)", margin: 0 }}>
          Session Complete
        </p>
        <p style={{ fontSize: 13, color: "#3DD68C", fontWeight: 600, marginTop: 6 }}>
          {myXp > 0 ? `+${myXp} XP EARNED` : `${myXp} XP`}
        </p>
        {verdict && (
          <p className={`lq-cal-line ${verdict.tone}`}>{verdict.text}</p>
        )}
      </div>

      {podium.length > 0 && (
        <div className="lq-podium" aria-label="Top three">
          {podiumOrder.map((i) => {
            const u = podium[i];
            return (
              <div key={u.userId} className={`lq-podium-slot ${podiumCls[i]}`}>
                <span className="lq-podium-medal">{MEDALS[i]}</span>
                {u.avatar
                  ? <AvatarMark avatar={u.avatar} name={u.username} size={i === 0 ? 52 : 42} className="lq-board-ava" />
                  : <span className="lq-board-ava" style={{ width: i === 0 ? 52 : 42, height: i === 0 ? 52 : 42, background: u.color, fontSize: 14 }}>{initials(u.username)}</span>}
                <span className="lq-podium-name">{u.userId === myId ? "You" : u.username}</span>
                <span className="lq-podium-pts">{u.points ?? u.score} pts</span>
                <div className="lq-podium-block" />
              </div>
            );
          })}
        </div>
      )}

      {me && (
        <div className="lq-myresult">
          <div><b>#{myIdx + 1}</b><span>Your rank</span></div>
          <div><b>{me.points ?? me.score}</b><span>Points</span></div>
          <div><b>{me.score}/{c.totalQuestions}</b><span>Correct</span></div>
        </div>
      )}

      {c.battle && (
        <div className="lq-card lq-battle-result">
          <p className="lq-card-label">{c.battle.mode === "ranked" ? "🏅 RANKED CLAN BATTLE" : "⚔️ CLAN BATTLE"}</p>
          <div className="lq-battlebar big">
            <span className={`lq-battlebar-team${c.battle.winnerId === c.battle.a.classroomId ? " ahead" : ""}`}>
              <b>{c.battle.a.name}{c.battle.a.size ? <small className="lq-battlebar-size">×{c.battle.a.size}</small> : null}</b>
              <em>{c.battle.a.score}<i className="lq-battlebar-avg">avg</i></em>
            </span>
            <span className="lq-battlebar-mid">{c.battle.winnerId ? "VS" : "DRAW"}</span>
            <span className={`lq-battlebar-team right${c.battle.winnerId === c.battle.b.classroomId ? " ahead" : ""}`}>
              <em>{c.battle.b.score}<i className="lq-battlebar-avg">avg</i></em>
              <b>{c.battle.b.name}{c.battle.b.size ? <small className="lq-battlebar-size">×{c.battle.b.size}</small> : null}</b>
            </span>
          </div>
          <p className="lq-battle-verdict">
            {c.battle.winnerId
              ? `${c.battle.winnerId === c.battle.a.classroomId ? c.battle.a.name : c.battle.b.name} takes the war`
              : "Dead even — run it back?"}
          </p>
        </div>
      )}

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

      {c.leaderboard.length > 3 && (
      <div className="lq-card lq-lb-scroll">
        <p className="lq-card-label">EVERYONE ELSE</p>
        {c.leaderboard.slice(3).map((u, k) => { const i = k + 3; return (
          <div className="lq-leaderboard-item" key={u.userId}>
            <span className="lq-lb-medal">{MEDALS[i] || `#${i + 1}`}</span>
            {u.avatar
              ? <AvatarMark avatar={u.avatar} name={u.username} size={36} className="lq-lb-avatar" />
              : <span className="lq-lb-avatar" style={{ background: u.color }}>{initials(u.username)}</span>}
            <p className="lq-lb-name">{u.username}{u.userId === myId ? " (You)" : ""}</p>
            <p className="lq-lb-score">{u.points ?? u.score}<span className="lq-lb-score-sub"> pts · {u.score}/{c.totalQuestions}</span></p>
          </div>
        ); })}
      </div>
      )}

      {history && history.length > 0 && !showHistory && (
        <button className="lq-linkbtn" onClick={() => setShowHistory(true)}>Show my recent live sessions</button>
      )}
      {history && history.length > 0 && showHistory && (
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
        {c.battle && (
          <button
            className="lq-btn-secondary"
            onClick={() => {
              const b = c.battle;
              const text = `⚔️ ${b.a.name} ${b.a.score} – ${b.b.score} ${b.b.name}${b.winnerId ? ` — ${b.winnerId === b.a.classroomId ? b.a.name : b.b.name} wins` : " — draw"} on Scholar's Circle ${window.location.origin}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
            }}
          >
            Share to WhatsApp
          </button>
        )}
        <button className="lq-btn-secondary" onClick={onExit}>Leave Session</button>
      </div>

      {/* Offscreen share card — rendered to PNG on demand */}
      <div ref={cardRef} className="lq-sharecard" aria-hidden="true">
        <div className="lq-sc-body">
          <div className="lq-sc-brand">
            <span className="lq-sc-badge" style={{ color: "#F5C542" }}>⚡ SCHOLAR'S CIRCLE</span>
            <span className="lq-sc-live"><span className="lq-sc-live-dot" />LIVE QUIZ</span>
          </div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 44, fontWeight: 700, color: "var(--c-f3f4f6)", margin: 0, lineHeight: 1.2 }}>{room.title}</p>
          <div className="lq-sc-ranks">
            {c.leaderboard.slice(0, 5).map((u, i) => (
              <div className={`lq-sc-row${u.userId === myId ? " me" : ""}`} key={u.userId}>
                <span className="lq-sc-rank">{MEDALS[i] || `#${i + 1}`}</span>
                {u.avatar
                  ? <AvatarMark avatar={u.avatar} name={u.username} size={64} className="lq-sc-ava" />
                  : <span className="lq-sc-ava" style={{ background: u.color }}>{initials(u.username)}</span>}
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
