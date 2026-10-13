import { memo, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import HIcon from "./HIcon.jsx";
import { monthCells, shiftMonth, DAY_LETTERS, STREAK_MILESTONES } from "../../hooks/useStreakMoment.js";
import { fetchStreakCalendar } from "../../lib/appUtils.js";
import { localDayKey } from "../../lib/dayKey.js";
import { haptics } from "../../lib/haptics.js";
import { useUI } from "../../contexts/UIContext.jsx";
import { useState, useEffect } from "react";

// Streak detail sheet — opened from the GameBar flame chip. Month calendar of
// real activity days (flame tiles), freeze-covered days (ice), milestone
// progress, this-week ring, and the freeze shop row.
function StreakSheet({ open, onClose, streak, longestStreak, freezes, save, onBuyFreeze }) {
  const { setMobileNavHidden } = useUI();
  const [shown, setShown] = useState(false);
  const todayKey = localDayKey();
  const curMonth = todayKey.slice(0, 7);
  const [viewMonth, setViewMonth] = useState(curMonth);
  const [calData, setCalData] = useState({}); // monthKey → payload | null
  const requestedRef = useRef(new Set());

  // The week ring may straddle a month boundary — pull the month's data for
  // the week-start too when it differs from the viewed month.
  const weekDays = useMemo(() => {
    const keys = [];
    const base = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      keys.push(localDayKey(d));
    }
    return keys;
  }, []);
  const weekStartMonth = weekDays[0].slice(0, 7);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => { cancelAnimationFrame(raf); setShown(false); };
  }, [open]);

  // Reopen on today's month, not where the user last browsed — render-adjust
  // on the open transition so it doesn't wait an effect cycle.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setViewMonth(curMonth);
  }

  useEffect(() => {
    if (!open) return;
    setMobileNavHidden(true);
    return () => setMobileNavHidden(false);
  }, [open, setMobileNavHidden]);

  useEffect(() => {
    if (!open) { requestedRef.current.clear(); return; }
    for (const mk of new Set([curMonth, viewMonth, weekStartMonth])) {
      if (requestedRef.current.has(mk)) continue;
      requestedRef.current.add(mk);
      fetchStreakCalendar(mk).then((d) => setCalData((p) => ({ ...p, [mk]: d })));
    }
  }, [open, viewMonth, curMonth, weekStartMonth]);

  if (!open) return null;

  const gems = save?.gems || 0;
  const canAfford = gems >= 15 && (freezes || 0) < 3;

  const curData = calData[curMonth];
  const viewData = calData[viewMonth];
  const daySet = new Set(viewData?.days || []);
  const freezeSet = new Set(viewData?.freezeDays || []);
  const daysThisMonth = curData?.days?.length ?? 0;

  // This-week ring: days studied in the trailing 7 days (freeze days don't
  // count — they kept the streak but weren't study days).
  const weekSet = new Set([...(curData?.days || []), ...(calData[weekStartMonth]?.days || [])]);
  const weekCount = weekDays.filter((k) => weekSet.has(k)).length;

  // Next milestone + progress.
  const nextMilestone = [...STREAK_MILESTONES].sort((a, b) => a - b).find((m) => m > (streak || 0));
  const prevMilestone = [...STREAK_MILESTONES].sort((a, b) => b - a).find((m) => m <= (streak || 0)) || 0;
  const goalPct = nextMilestone ? Math.min(100, Math.round(((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100)) : 100;

  // Motivational band by streak length.
  const band = (streak || 0) === 0
    ? { title: "Start your streak", sub: "One read or quiz today lights the flame." }
    : streak < 7
      ? { title: "Momentum building", sub: `${streak} day${streak === 1 ? "" : "s"} in a row — the first week is the hardest.` }
      : streak < 14
        ? { title: "You're on fire", sub: "A full week strong — most people quit by now. Not you." }
        : streak < 30
          ? { title: "Unstoppable", sub: "Two weeks and counting — this is a real habit now." }
          : { title: "Legend status", sub: `${streak} days — elite consistency. Protect the flame.` };

  const monthLabel = (() => {
    const [y, m] = viewMonth.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  })();

  const cells = monthCells(viewMonth);

  return createPortal(
    <>
      <div className={`hm-sheet-backdrop${shown ? " show" : ""}`} onClick={onClose} />
      <div className={`hm-sheet hm-ss${shown ? " show" : ""}`} role="dialog" aria-label="Streak details">
        <div className="hm-sh-handle" />
        <div className="hm-ss-hero">
          <HIcon name="flame" size={34} color="#FF8A3D" />
          <div className="hm-ss-num">{streak || 0}</div>
          <div className="hm-ss-cap">{band.title} · best {longestStreak || streak || 0}</div>
          <p className="hm-ss-hint" style={{ margin: "6px 0 0" }}>{band.sub}</p>
        </div>

        {/* Stat trio */}
        <div className="hm-ss-stats">
          <div className="hm-ss-stat"><b>{streak || 0}</b><span>Current</span></div>
          <div className="hm-ss-stat"><b>{longestStreak || streak || 0}</b><span>Best</span></div>
          <div className="hm-ss-stat"><b>{daysThisMonth}</b><span>This month</span></div>
        </div>

        {/* Next milestone */}
        {nextMilestone ? (
          <div className="hm-ss-goal">
            <div className="hm-ss-goal-t">
              <span>Day {streak || 0} of {nextMilestone}</span>
              <span>{nextMilestone - (streak || 0)} to {nextMilestone}-day badge</span>
            </div>
            <div className="hm-ss-goal-bar"><i style={{ width: `${goalPct}%` }} /></div>
          </div>
        ) : (
          <div className="hm-ss-goal">
            <div className="hm-ss-goal-t"><span>Top milestone reached — the chain is yours</span></div>
            <div className="hm-ss-goal-bar"><i style={{ width: "100%" }} /></div>
          </div>
        )}

        {/* Month calendar */}
        <div className="hm-ss-cal">
          <div className="hm-ss-cal-head">
            <button className="hm-ss-cal-nav" onClick={() => { haptics.selection(); setViewMonth(shiftMonth(viewMonth, -1)); }} aria-label="Previous month">
              <HIcon name="arrowL" size={14} />
            </button>
            <b>{monthLabel}</b>
            <button className="hm-ss-cal-nav" onClick={() => { haptics.selection(); setViewMonth(shiftMonth(viewMonth, 1)); }} disabled={viewMonth >= curMonth} aria-label="Next month">
              <HIcon name="arrowR" size={14} />
            </button>
          </div>
          <div className="hm-ss-cal-grid">
            {DAY_LETTERS.map((l, i) => <span key={i} className="hm-ss-cal-wd">{l}</span>)}
            {cells.map((c, i) => {
              if (!c) return <span key={`b${i}`} />;
              const future = c.key > todayKey;
              const on = !future && daySet.has(c.key);
              const fz = !future && !on && freezeSet.has(c.key);
              const cls = `hm-ss-d${on ? " on" : ""}${fz ? " fz" : ""}${c.key === todayKey ? " today" : ""}${future ? " future" : ""}`;
              return <span key={c.key} className={cls}>{on ? <HIcon name="flame" size={11} color="#FFC55C" /> : fz ? <HIcon name="freeze" size={10} color="#7CC7FF" /> : c.day}</span>;
            })}
          </div>
          {/* undefined = request still in flight; null = fetch failed or
              returned nothing — show the grid (empty) instead of hanging
              on "Loading…" forever */}
          {viewData === undefined ? (
            <div className="hm-ss-cal-loading">Loading activity…</div>
          ) : null}
          <div className="hm-ss-cal-foot">
            <span className="hm-ss-leg"><i className="hm-ss-leg-sq on" />streak day</span>
            {freezeSet.size > 0 && (
              <span className="hm-ss-leg"><i className="hm-ss-leg-sq fz" />freeze-saved</span>
            )}
            <span className="hm-ss-leg" style={{ marginLeft: "auto" }}>{weekCount} of 7 days this week</span>
          </div>
        </div>

        {/* Freeze shop row */}
        <div className="hm-sh-row" style={{ marginTop: 14 }}>
          <div className="hm-sh-ic" style={{ background: "rgba(124,199,255,.1)", color: "#7CC7FF" }}>
            <HIcon name="freeze" size={18} />
          </div>
          <div className="hm-sh-info">
            <h4>Streak Freeze {(freezes || 0) > 0 && <span className="hm-own-tag">owns {freezes}/3</span>}</h4>
            <p>Miss a day without losing your streak. Auto-used when needed.</p>
          </div>
          <button
            className={`hm-sh-buy${canAfford ? "" : " cant"}`}
            onClick={canAfford ? onBuyFreeze : undefined}
            title={(freezes || 0) >= 3 ? "Max 3 freezes" : canAfford ? "Buy for 15 gems" : "Not enough gems"}
          >
            <HIcon name="gem" size={12} />15
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default memo(StreakSheet);
