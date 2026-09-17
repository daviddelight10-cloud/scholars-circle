import { useEffect, useState } from "react";
import HIcon from "./HIcon.jsx";
import { lapsedSubjects } from "../../lib/homeUtils.js";

const FREEZE_COST = 15; // matches the Streak Survival in-game shop price
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const AV_COLORS = ["#FFC55C", "#9DB8E8", "#6EE7A0", "#C0B2FF", "#F9A8D4", "#7CC7FF"];
function avColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2)).toUpperCase();
}

function Sheet({ open, onClose, children }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => { cancelAnimationFrame(raf); setShown(false); };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className={`hm-sheet-backdrop${shown ? " show" : ""}`} onClick={onClose} />
      <div className={`hm-sheet${shown ? " show" : ""}`} role="dialog">
        <div className="hm-sh-handle" />
        {children}
      </div>
    </>
  );
}

function SheetHead({ title, right, onClose }) {
  return (
    <div className="hm-sh-head">
      <h3>{title}</h3>
      {right}
      <button className="hm-sh-close" onClick={onClose} aria-label="Close"><HIcon name="x" size={14} /></button>
    </div>
  );
}

/* ── Shop ── */
export function ShopSheet({ open, onClose, save, onBuyFreeze }) {
  const gems = save?.gems || 0;
  const freezes = save?.freezes || 0;
  const canAfford = gems >= FREEZE_COST;
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHead
        title="Rewards shop"
        onClose={onClose}
        right={<span className="hm-sh-bal"><HIcon name="gem" size={13} color="#6EC1FF" />{gems}</span>}
      />
      <p className="hm-sh-sub">Spend gems you earn from questions, quests and achievements.</p>

      <div className="hm-sh-row">
        <div className="hm-sh-ic" style={{ background: "rgba(124,199,255,.1)", color: "#7CC7FF" }}>
          <HIcon name="freeze" size={18} />
        </div>
        <div className="hm-sh-info">
          <h4>Streak Freeze {freezes > 0 && <span className="hm-own-tag">owns {freezes}</span>}</h4>
          <p>Miss a day without losing your streak. Auto-used when needed.</p>
        </div>
        <button
          className={`hm-sh-buy${canAfford ? "" : " cant"}`}
          onClick={canAfford ? onBuyFreeze : undefined}
          title={canAfford ? `Buy for ${FREEZE_COST} gems` : "Not enough gems"}
        >
          <HIcon name="gem" size={12} />{FREEZE_COST}
        </button>
      </div>

      <div className="hm-sh-row">
        <div className="hm-sh-ic" style={{ background: "rgba(255,181,71,.1)", color: "#FFC55C" }}>
          <HIcon name="bulb" size={18} />
        </div>
        <div className="hm-sh-info">
          <h4>Hint Tokens <span className="hm-soon-tag">coming soon</span></h4>
          <p>Reveal a hint on a hard question during practice runs.</p>
        </div>
      </div>

      <div className="hm-sh-row">
        <div className="hm-sh-ic" style={{ background: "rgba(139,108,255,.12)", color: "#C0B2FF" }}>
          <HIcon name="bolt" size={18} />
        </div>
        <div className="hm-sh-info">
          <h4>XP Boost <span className="hm-soon-tag">coming soon</span></h4>
          <p>Double XP for a practice session.</p>
        </div>
      </div>

      <div className="hm-sh-earn">
        <h5>EARN GEMS</h5>
        <div className="hm-earn-row"><span>Answer questions in practice</span><b><HIcon name="gem" size={11} color="#6EE7A0" />1–3 each</b></div>
        <div className="hm-earn-row"><span>Finish daily quests</span><b><HIcon name="gem" size={11} color="#6EE7A0" />8–18</b></div>
        <div className="hm-earn-row"><span>Unlock achievements</span><b><HIcon name="gem" size={11} color="#6EE7A0" />5+</b></div>
      </div>
    </Sheet>
  );
}

/* ── Leaderboard ── */
export function BoardSheet({ open, onClose, entries, userName, myIdx = -1, onInvite }) {
  const ranked = [...(entries || [])].sort((a, b) => (b.totalXP || b.xp || 0) - (a.totalXP || a.xp || 0)).slice(0, 5);
  const meEntry = myIdx >= 5 ? entries?.find((e) => e.username === userName) : null;
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHead title="Circle leaderboard" onClose={onClose} right={<span className="hm-lb-reset">All-time</span>} />
      <p className="hm-sh-sub">Lifetime XP across practice, reviews and cases.</p>
      <div style={{ marginTop: 10 }}>
        {ranked.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--hm-faint)", textAlign: "center", padding: "16px 0" }}>
            No leaderboard data yet.
          </p>
        )}
        {ranked.map((e, i) => {
          const isMe = e.username === userName;
          const name = isMe ? "You" : e.username;
          return (
            <div key={e.userId || e.username || i} className={`hm-lb-row${isMe ? " me" : ""}`}>
              <span className="hm-lb-rank">{i + 1}</span>
              <div className="hm-lb-av" style={{ background: avColor(name) }}>{initials(name)}</div>
              <div className="hm-lb-name">
                <h4>{name}</h4>
                {e.streak > 0 && (
                  <span><HIcon name="flame" size={9} color="#FF8A3D" />{e.streak}d streak</span>
                )}
              </div>
              <span className="hm-lb-xp">{(e.totalXP || e.xp || 0).toLocaleString()} XP</span>
            </div>
          );
        })}
        {meEntry && (
          <div className="hm-lb-row me" style={{ marginTop: 6, borderTop: "1px dashed var(--hm-stroke)" }}>
            <span className="hm-lb-rank">{myIdx + 1}</span>
            <div className="hm-lb-av" style={{ background: avColor("You") }}>{initials("You")}</div>
            <div className="hm-lb-name"><h4>You</h4></div>
            <span className="hm-lb-xp">{(meEntry.totalXP || meEntry.xp || 0).toLocaleString()} XP</span>
          </div>
        )}
      </div>
      <button className="hm-lb-invite" onClick={onInvite}>
        <HIcon name="userPlus" size={14} />Invite friends to your circle
      </button>
    </Sheet>
  );
}

/* ── Quick analytics ── */
export function StatsSheet({ open, onClose, fsrsStats, fsrsAnalytics, onOpenFull }) {
  const retention = fsrsStats?.avgRetrievability != null ? Math.round(fsrsStats.avgRetrievability * 100) : null;
  const daily = fsrsAnalytics?.dailyReviews || {};

  // last 7 days ending today
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ label: DAY_LABELS[d.getDay()], count: daily[key] || 0, today: i === 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const weekReviews = days.reduce((s, d) => s + d.count, 0);
  const masteredWeek = fsrsAnalytics?.masteredThisPeriod ?? null;

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHead title="Your week" onClose={onClose} right={<span className="hm-lb-reset">LAST 7 DAYS</span>} />
      {retention != null && (
        <div className="hm-an-big">
          <b>{retention}%</b>
          <span className="hm-an-trend"><HIcon name="trendUp" size={10} />retention</span>
        </div>
      )}
      <p className="hm-an-lbl">Average memory retrievability across your cards.</p>

      <div className="hm-an-chart">
        {days.map((d, i) => (
          <div key={i} className={`hm-an-col${d.today ? " today" : ""}`}>
            <i style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }} title={`${d.count} reviews`} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>

      <div className="hm-an-duo">
        <div className="hm-an-mini"><b>{weekReviews}</b><span>reviews this week</span></div>
        <div className="hm-an-mini"><b>{masteredWeek ?? "—"}</b><span>mastered this week</span></div>
      </div>

      {lapsedSubjects(fsrsAnalytics).length > 0 && (
        <div className="hm-an-weak">
          <h5>NEEDS WORK</h5>
          <div className="hm-an-weak-row">
            {lapsedSubjects(fsrsAnalytics).map((s) => (
              <span key={s.name} className="hm-weak-chip">{s.name} · {s.rate}% lapse</span>
            ))}
          </div>
        </div>
      )}

      <button className="hm-an-link" onClick={onOpenFull}>
        Open full analytics<HIcon name="arrowR" size={13} />
      </button>
    </Sheet>
  );
}

/* ── Daily goal ── */
const GOAL_OPTS = [
  { n: 10, name: "Light", sub: "≈ 10 min a day — keep the streak alive" },
  { n: 20, name: "Balanced", sub: "≈ 20 min a day — steady progress" },
  { n: 40, name: "Intense", sub: "≈ 40 min a day — exam-mode grind" },
];

export function GoalSheet({ open, onClose, dailyGoal, onSelect }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHead title="Daily review goal" onClose={onClose} />
      <p className="hm-sh-sub">How many review items do you want to clear each day?</p>
      {GOAL_OPTS.map((o) => (
        <button key={o.n} className={`hm-goal-opt${dailyGoal === o.n ? " sel" : ""}`} onClick={() => onSelect(o.n)}>
          <span className="hm-g-num">{o.n}</span>
          <span className="hm-g-info"><h4>{o.name}</h4><p>{o.sub}</p></span>
          <span className="hm-g-check"><HIcon name="check" size={12} /></span>
        </button>
      ))}
      <p className="hm-goal-note">Your goal caps how many due items appear in each daily review session.</p>
    </Sheet>
  );
}
