import { memo } from "react";
import HIcon from "./HIcon.jsx";

const RING_C = 138.2; // 2πr for r=22

function relIn(ts) {
  const mins = Math.round((new Date(ts) - Date.now()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

// Returning-user hero: real FSRS stats + goal ring.
function ReturningHero({ fsrsStats, sm2DueCount, onStartDaily }) {
  const due = (fsrsStats?.dueCount || 0) + (sm2DueCount || 0);
  const goal = fsrsStats?.dailyGoal || 20;
  const done = fsrsStats?.reviewedToday || 0;
  const pct = goal > 0 ? Math.min(1, done / goal) : 0;
  const retention = fsrsStats?.avgRetrievability != null
    ? `${Math.round(fsrsStats.avgRetrievability * 100)}%` : "—";
  const breakdown = [
    fsrsStats?.mcqCount ? `${fsrsStats.mcqCount} questions` : null,
  ].filter(Boolean);
  return (
    <div className="hm-hero">
      <div className="hm-hero-top">
        <div className="hm-tag"><span className="hm-dot" />TODAY'S REVIEW</div>
        <div className="hm-ring">
          <svg width="54" height="54" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
            <circle cx="27" cy="27" r="22" fill="none" stroke="url(#hm-grad)" strokeWidth="5" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - pct)} style={{ transition: "stroke-dashoffset .4s" }} />
            <defs>
              <linearGradient id="hm-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFC55C" /><stop offset="100%" stopColor="#F5A623" />
              </linearGradient>
            </defs>
          </svg>
          <div className="hm-ring-lbl"><b>{done}/{goal}</b><span>GOAL</span></div>
        </div>
      </div>
      <div className="hm-due">
        {due > 0 ? (
          <>
            <div className="hm-num">{due}</div>
            <div className="hm-cap">
              item{due === 1 ? "" : "s"} due for review
              <span className="hm-backlog">{fsrsStats?.totalItems || 0} items in deck</span>
            </div>
          </>
        ) : (
          <div className="hm-cap">
            <b className="hm-caught">All caught up</b>
            <span className="hm-backlog">
              {fsrsStats?.nextDueAt ? `next item in ${relIn(fsrsStats.nextDueAt)}` : `${fsrsStats?.totalItems || 0} items in deck`}
            </span>
          </div>
        )}
      </div>
      {breakdown.length > 0 && (
        <div className="hm-chips">
          {breakdown.map((p) => <span key={p} className="hm-chip">{p}</span>)}
        </div>
      )}
      <div className="hm-stats">
        <div className="hm-stat"><b>{retention}</b><span>Retention</span></div>
        <div className="hm-stat"><b>{fsrsStats?.masteredCount ?? "—"}</b><span>Mastered</span></div>
        <div className="hm-stat"><b>{fsrsStats?.learningCount ?? "—"}</b><span>Learning</span></div>
        <div className="hm-stat"><b>{fsrsStats?.reviewedToday ?? 0}</b><span>Done today</span></div>
      </div>
      <button className="hm-cta" onClick={onStartDaily}>
        <HIcon name="play" size={14} />Start Daily Review
      </button>
    </div>
  );
}

// First-run hero: no review data yet — nudge toward first upload + community.
function FirstRunHero({ onAddFirst, onTrySample }) {
  return (
    <div className="hm-hero">
      <div className="hm-hero-top">
        <div className="hm-tag"><span className="hm-dot" />WELCOME TO SCHOLARS CIRCLE</div>
        <div className="hm-hero-spark"><HIcon name="spark" size={18} /></div>
      </div>
      <h2 className="hm-fr-title">Turn your notes into memory.</h2>
      <p className="hm-fr-sub">
        Scholars Circle turns every PDF you upload into practice questions and daily
        reviews — so the reading you do today actually sticks on exam day.
      </p>
      <div className="hm-steps">
        <span className="hm-step"><b>1</b>&nbsp;Add a PDF</span>
        <span className="hm-step-arrow">→</span>
        <span className="hm-step"><b>2</b>&nbsp;AI makes cards</span>
        <span className="hm-step-arrow">→</span>
        <span className="hm-step"><b>3</b>&nbsp;Review daily</span>
      </div>
      <button className="hm-cta" onClick={onAddFirst}>
        <HIcon name="plus" size={15} />Add your first PDF
      </button>
      <button className="hm-cta-ghost2" onClick={onTrySample}>
        <HIcon name="users" size={14} />Try a sample deck
      </button>
    </div>
  );
}

function HomeHero(props) {
  return props.firstRun ? <FirstRunHero {...props} /> : <ReturningHero {...props} />;
}

export default memo(HomeHero);
