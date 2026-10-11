import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HIcon from "./HIcon.jsx";
import { useModalA11y } from "../../hooks/useModalA11y.js";
import { weekStrip } from "../../hooks/useStreakMoment.js";
import { API_BASE } from "../../lib/constants.js";
import { localDayKey } from "../../lib/dayKey.js";
import { haptics } from "../../lib/haptics.js";
import { deriveRating, normalizeQuestion, rateQuestion } from "../../features/streak-survival/fsrsBridge.js";
import { loadSave, mutate } from "../../features/streak-survival/survivalStore.js";
import { sound, setSoundEnabled } from "../../features/streak-survival/survivalAudio.js";
import useConfetti from "../../features/streak-survival/useConfetti.js";

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function warmupLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Morning warm-up";
  if (h < 17) return "Afternoon recall";
  if (h < 22) return "Evening recall";
  return "Late-night recall";
}

function dateKicker() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
}

// Per-state visual + copy. accent feeds --wc-a (flame tile + glow + kicker).
const STATES = {
  day1: {
    accent: "#F5A623",
    kicker: () => dateKicker(),
    title: () => `Day 1 — your streak begins`,
    sub: (m) => `${m.name}, you just lit the flame. Open Scholars Circle any day to keep it burning.`,
  },
  extended: {
    accent: "#FF8A3D",
    kicker: () => "STREAK EXTENDED",
    title: (m) => `Day ${m.streak}, ${m.name}`,
    sub: (m) => `${m.streak} days in a row — consistency is your superpower.`,
  },
  milestone: {
    accent: "#FF5470",
    kicker: (m) => `${m.streak}-DAY MILESTONE`,
    title: (m) => `${m.streak} days strong, ${m.name}`,
    sub: () => `That's rare — most people don't make it this far. Keep the chain alive.`,
  },
  freeze: {
    accent: "#7CC7FF",
    kicker: () => "FREEZE USED",
    title: () => `A freeze saved your streak`,
    sub: (m) => `You missed a day, but Day ${m.streak} continues. ${m.freezes} freeze${m.freezes === 1 ? "" : "s"} left.`,
  },
  broken: {
    accent: "#9DB8E8",
    kicker: () => "STREAK LOST",
    title: (m) => `Your ${m.prevStreak}-day streak ended`,
    sub: (m) => `Longest run: ${m.longestStreak} days. Today counts as Day 1 — bounce back.`,
  },
  streak: {
    accent: "#4F8EF7",
    kicker: () => dateKicker(),
    title: (m) => `Good ${greetingWord()}, ${m.name}`,
    sub: (m) => (m.offline
      ? `${m.streak}-day streak — reconnect to extend it.`
      : `${m.streak} days and counting. Your flame is safe for today.`),
  },
};

// Animated day count (skipped under prefers-reduced-motion).
function useCountUp(target, durationMs = 700) {
  const [val, setVal] = useState(() => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? target : 0; } catch { return target; }
  });
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVal(target); return; }
    } catch { setVal(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / durationMs);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

/* ── Week strip: last 7 local days, lit tiles inside the streak window ── */
function WeekStrip({ streak }) {
  const days = useMemo(() => weekStrip(streak), [streak]);
  return (
    <div className="hm-sm-week" aria-label={`${streak}-day streak`}>
      {days.map((d) => (
        <span key={d.key} className={`hm-sm-day${d.lit ? " lit" : ""}${d.today ? " today" : ""}`}>
          {d.today ? <HIcon name="flame" size={12} color="#FF8A3D" /> : d.letter}
        </span>
      ))}
    </div>
  );
}

/* ── Warm-up card: one recall question from the user's recent practice ── */
function WarmupCard({ onCelebrate, onReview }) {
  const [item, setItem] = useState(null);   // {stem, options, correctIdx, explanation, resourceId, pageIndex, topic, subject, resourceTitle}
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);
  const [skipped, setSkipped] = useState(false);
  const [bonusAwarded, setBonusAwarded] = useState(false);
  const startRef = useRef(0);
  const ratedRef = useRef(false);

  useEffect(() => {
    let live = true;
    const bail = setTimeout(() => { if (live) setLoading(false); }, 3000);
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      fetch(`${API_BASE}/api/resources/fsrs/warmup-question`, {
        headers: { Authorization: `Bearer ${authData.authToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!live || !d?.item?.mcq) return;
          const it = d.item;
          const nq = normalizeQuestion(it.mcq, it.pageIndex, it.resourceId);
          if (!nq.q || nq.opts.length < 2) return;
          // Shuffle options client-side; track where the correct one landed.
          const order = nq.opts.map((_, i) => i);
          for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
          }
          setItem({
            stem: nq.q,
            options: order.map((i) => nq.opts[i]),
            correctIdx: order.indexOf(nq.a),
            explanation: nq.explanation,
            resourceId: it.resourceId,
            pageIndex: it.pageIndex,
            topic: it.topic,
            subject: it.subject,
            resourceTitle: it.resourceTitle,
          });
          startRef.current = Date.now();
        })
        .catch(() => {})
        .finally(() => { if (live) { clearTimeout(bail); setLoading(false); } });
    } catch { setLoading(false); }
    return () => { live = false; clearTimeout(bail); };
  }, []);

  const answer = (idx) => {
    if (!item || picked != null) return;
    setPicked(idx);
    const correct = idx === item.correctIdx;
    if (!ratedRef.current) {
      ratedRef.current = true;
      const grade = deriveRating({ correct, revealed: false, hintUsed: false, elapsedMs: Date.now() - startRef.current });
      rateQuestion({
        resourceId: item.resourceId,
        pageIndex: item.pageIndex,
        grade,
        topic: item.topic,
        subject: item.subject,
      });
    }
    if (correct) {
      haptics.success();
      sound.correct();
      // Once-a-day +2💎 warm-up bonus — server syncs via the gem pipeline.
      mutate((s) => {
        if (s.warmupBonusDate !== localDayKey()) {
          s.warmupBonusDate = localDayKey();
          s.gems = (s.gems || 0) + 2;
          setBonusAwarded(true);
        }
      });
      onCelebrate?.();
    } else {
      haptics.error();
      sound.wrong();
    }
  };

  if (loading) {
    return (
      <div className="hm-wu hm-wu-loading" aria-hidden="true">
        <div className="hm-wu-skel" />
        <div className="hm-wu-skel short" />
      </div>
    );
  }
  if (!item || skipped) return null;

  const correct = picked === item.correctIdx;

  return (
    <div className={`hm-wu${picked != null ? (correct ? " right" : " wrong") : ""}`}>
      <div className="hm-wu-head">
        <span className="hm-wu-tag"><HIcon name="bolt" size={11} color="#FFC55C" />{warmupLabel()}</span>
        <span className="hm-wu-src">{item.resourceTitle || item.subject || "from your practice"}</span>
        {picked == null && (
          <button className="hm-wu-skip" onClick={() => setSkipped(true)}>Skip</button>
        )}
      </div>
      <p className="hm-wu-q">{item.stem}</p>
      <div className="hm-wu-opts">
        {item.options.map((opt, i) => {
          let cls = "hm-wu-opt";
          if (picked != null) {
            if (i === item.correctIdx) cls += " is-correct";
            else if (i === picked) cls += " is-wrong";
            else cls += " is-dim";
          }
          return (
            <button key={i} className={cls} disabled={picked != null} onClick={() => answer(i)}>
              <span className="hm-wu-letter">{String.fromCharCode(65 + i)}</span>
              <span className="hm-wu-opt-t">{opt}</span>
            </button>
          );
        })}
      </div>
      {picked != null && (
        <div className="hm-wu-verdict">
          {correct ? (
            <><b>Correct</b> — memory refreshed{bonusAwarded ? " · +2💎" : ""}</>
          ) : (
            <>The answer is <b>{String.fromCharCode(65 + item.correctIdx)}</b> — good thing you saw it again.</>
          )}
          {!correct && item.explanation && <p className="hm-wu-expl">{item.explanation}</p>}
          {!correct && (
            <button className="hm-wu-review" onClick={onReview}>
              <HIcon name="play" size={12} />Review this deck
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── The sheet ── */
function StreakMoment({ moment, name, dueCount, recentDoc, hasExam, onClose, onStartDaily, onOpenDoc, onOpenExams }) {
  const open = !!moment;
  const { modalProps, focusRef } = useModalA11y({ isOpen: open, onClose, labelledBy: "hm-sm-title" });
  const [shown, setShown] = useState(false);
  const confetti = useConfetti();
  const firedRef = useRef(false);
  const dayCount = useCountUp(moment?.streak ?? 0);

  useEffect(() => {
    try { setSoundEnabled(loadSave().soundOn !== false); } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => { cancelAnimationFrame(raf); setShown(false); };
  }, [open]);

  // Milestones (and first correct warm-up) get confetti + a rising tone.
  useEffect(() => {
    if (!open || firedRef.current) return;
    if (moment.state === "milestone" || moment.state === "day1") {
      firedRef.current = true;
      setTimeout(() => { confetti.fire(80); sound.milestone(); haptics.success(); }, 350);
    } else if (moment.state === "extended" || moment.state === "streak") {
      firedRef.current = true;
      setTimeout(() => { haptics.light(); sound.click(); }, 300);
    }
  }, [open, moment, confetti]);

  if (!open) return null;
  const k = STATES[moment.state] || STATES.streak;
  const kicker = `${moment.levelUp ? "LEVEL UP · " : ""}${k.kicker(moment)}`;
  const nextSteps = [
    dueCount > 0 && { icon: "play", accent: "#F5A623", label: "Daily review", sub: `${dueCount} item${dueCount === 1 ? "" : "s"} due`, go: () => { onClose(); onStartDaily?.(); } },
    recentDoc && { icon: "book", accent: "#6EC1FF", label: "Continue reading", sub: recentDoc.title, go: () => { onClose(); onOpenDoc?.(recentDoc.shareToken); } },
    hasExam && { icon: "target", accent: "#C0B2FF", label: "Exam sim", sub: "Take your saved exam", go: () => { onClose(); onOpenExams?.(); } },
  ].filter(Boolean);

  return createPortal(
    <>
      <div className={`hm-sheet-backdrop hm-sm-backdrop${shown ? " show" : ""}`} onClick={onClose} />
      <div
        {...modalProps}
        ref={focusRef}
        tabIndex={-1}
        className={`hm-sheet hm-sm${shown ? " show" : ""}`}
        style={{ "--wc-a": k.accent }}
      >
        <div className="hm-sh-handle" />

        {/* Streak hero */}
        <div className={`hm-sm-flame s-${moment.state}`}>
          <HIcon name="flame" size={42} color={k.accent} />
          <span className="hm-sm-count">{moment.state === "broken" ? 1 : dayCount}</span>
        </div>
        <div className="hm-wc-kicker">{kicker}</div>
        <h3 id="hm-sm-title" className="hm-wc-title">{k.title({ ...moment, name })}</h3>
        <p className="hm-wc-sub">{k.sub({ ...moment, name })}</p>

        <WeekStrip streak={moment.streak} />
        {moment.freezes > 0 && (
          <div className="hm-sm-frz"><HIcon name="freeze" size={11} color="#7CC7FF" />{moment.freezes} freeze{moment.freezes === 1 ? "" : "s"} held — a missed day won't break the chain</div>
        )}

        {/* Warm-up question (renders nothing for users with no practice) */}
        <WarmupCard onCelebrate={() => confetti.fire(70)} onReview={() => { onClose(); onStartDaily?.(); }} />

        {/* What's next */}
        {nextSteps.length > 0 && (
          <div className="hm-sm-next">
            <div className="hm-sm-next-h">What's next</div>
            {nextSteps.map((s) => (
              <button key={s.label} className="hm-sm-card" onClick={s.go}>
                <span className="hm-sm-card-ic" style={{ background: `color-mix(in srgb, ${s.accent} 14%, transparent)`, color: s.accent }}>
                  <HIcon name={s.icon} size={15} />
                </span>
                <span className="hm-sm-card-t">
                  <b>{s.label}</b>
                  <span>{s.sub}</span>
                </span>
                <HIcon name="arrowR" size={14} color="#8b93a7" />
              </button>
            ))}
          </div>
        )}

        <button className="hm-wc-later" onClick={onClose}>Not now</button>
        <button className="hm-wc-x" onClick={onClose} aria-label="Dismiss"><HIcon name="x" size={14} /></button>
      </div>
      <canvas ref={confetti.canvasRef} className="hm-sm-confetti" />
    </>,
    document.body
  );
}

export default memo(StreakMoment);
