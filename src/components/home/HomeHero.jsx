import { memo, useMemo, useState } from "react";
import HIcon from "./HIcon.jsx";
import { examKeyOf, daysUntil, readiness, needPerDay } from "../../hooks/useReviewPlan.js";

const RING_C = 138.2; // 2πr for r=22
const SCOPE_KEY = "sc_home_review_scope";
const SIZE_KEY = "sc_home_review_size";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };

function relIn(ts) {
  const mins = Math.round((new Date(ts) - Date.now()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

const retInfo = (v) => (v >= 85 ? ["On target", "#3DDC97"] : v >= 65 ? ["Getting there", "#FFC857"] : ["Needs attention", "#FF9F5A"]);
const mins = (n) => `~${Math.max(1, Math.round((n * 20) / 60))} min`;
const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0);

const CalIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
);
const CheckIcon = () => (
  <svg className="hm-ck" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
);
const Chevron = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
);

// Returning-user hero: real FSRS stats, course (folder) scope, session size,
// expandable stat details and an exam countdown.
function ReturningHero({ fsrsStats, bankDueCount, folders, foldersLoading, prefs, onStartDaily, onOpenPlan }) {
  const [scope, setScope] = useState(() => lsGet(SCOPE_KEY) || "all");
  const [size, setSize] = useState(() => { const n = parseInt(lsGet(SIZE_KEY), 10); return n > 0 ? n : null; });
  const [open, setOpen] = useState(null); // 'ret' | 'm' | 'l' | 'done' | 'src'

  const list = useMemo(() => folders || [], [folders]);
  const hasList = list.length > 0;
  const fallback = !!list[0]?._fallback; // subject-based list: no per-folder scoping
  const hasFolders = hasList && !fallback;
  const folder = hasFolders && scope !== "all" ? list.find((f) => f.key === scope) || null : null;
  const effScope = folder ? folder.key : "all";

  const goal = fsrsStats?.dailyGoal || 20;
  const done = fsrsStats?.reviewedToday || 0;
  const ringPct = goal > 0 ? Math.min(1, done / goal) : 0;

  const a = useMemo(() => {
    if (hasFolders) {
      const src = folder ? [folder] : list;
      const t = { due: 0, total: 0, m: 0, l: 0, r: 0, mats: 0 };
      for (const f of src) {
        t.due += f.due; t.total += f.total; t.m += f.mastered; t.l += f.learning;
        t.r += f.retention * f.total; t.mats += f.materialCount;
      }
      return { due: t.due + (folder ? 0 : bankDueCount || 0), total: t.total, m: t.m, l: t.l, ret: t.total ? (t.r / t.total) * 100 : 100, mats: t.mats };
    }
    return {
      due: (fsrsStats?.dueCount || 0) + (bankDueCount || 0),
      total: fsrsStats?.totalItems || 0,
      m: fsrsStats?.masteredCount || 0,
      l: fsrsStats?.learningCount || 0,
      ret: fsrsStats?.avgRetrievability != null ? fsrsStats.avgRetrievability * 100 : 100,
      mats: null,
    };
  }, [hasFolders, folder, list, bankDueCount, fsrsStats]);

  // The big number is what's due; the stepper picks this session's length.
  const toGoal = Math.max(goal - done, 0);
  const presets = useMemo(() => {
    const s = new Set([3, 5, 10, 25, 50]);
    if (toGoal > 0) s.add(toGoal);
    if (a.due > 0) s.add(a.due);
    return [...s].filter((n) => n >= 1 && n <= Math.min(a.due, 100)).sort((x, y) => x - y);
  }, [toGoal, a.due]);
  const n = !presets.length ? 0
    : size != null && presets.includes(size) ? size
    : toGoal > 0 && presets.includes(toGoal) ? toGoal
    : presets[Math.min(1, presets.length - 1)];
  const idx = presets.indexOf(n);
  const stepTo = (i) => { setSize(presets[i]); lsSet(SIZE_KEY, presets[i]); };

  const pick = (key) => { setScope(key); lsSet(SCOPE_KEY, key); };

  const chips = useMemo(() => {
    const day = (f) => { const iso = prefs?.[examKeyOf(f)]; const d = iso ? daysUntil(iso) : null; return d != null && d >= 0 ? d : 9999; };
    return [...list].sort((x, y) => day(x) - day(y) || y.due - x.due);
  }, [list, prefs]);

  // Exam banner: the selected folder, else the nearest upcoming exam.
  const examFolder = useMemo(() => {
    if (folder) return folder;
    return chips.find((f) => { const iso = prefs?.[examKeyOf(f)]; return iso && daysUntil(iso) >= 0; }) || null;
  }, [folder, chips, prefs]);
  const examIso = examFolder ? prefs?.[examKeyOf(examFolder)] : null;
  const examDays = examIso ? daysUntil(examIso) : null;
  const examLive = examDays != null && examDays >= 0;

  const retPct = Math.round(a.ret);
  const rest = Math.max(a.total - a.m - a.l, 0);
  const idle = done === 0 && a.due > 0;

  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const hl = open === "m" ? "m" : open === "l" ? "l" : null;

  const mats = (folder ? [folder] : list).flatMap((f) => f.materials || []);

  let detail = null;
  if (open === "ret") {
    const [label, color] = retInfo(retPct);
    detail = (
      <>
        <b style={{ color }}>{label} · {retPct}%</b>
        <br />Of the cards that come up for review, this is the share you answer correctly. Below 90% means you are forgetting between reviews.
        <div className="hm-meter" aria-hidden="true"><i style={{ width: `${retPct}%` }} /><u /></div>
        <div className="hm-mlab"><span>0</span><span>target 90</span><span>100</span></div>
      </>
    );
  } else if (open === "m") {
    detail = <><b>Mastered · {a.m.toLocaleString()} cards</b><br />Cards you remember reliably. They return rarely, so they cost almost no time.</>;
  } else if (open === "l") {
    detail = <><b>Learning · {a.l.toLocaleString()} cards</b><br />Cards still settling in. A few more successful reviews and they move to Mastered. {rest.toLocaleString()} still to learn.</>;
  } else if (open === "done") {
    detail = (
      <>
        <b>{done} of {goal} done today</b>
        <br />{toGoal > 0 ? `${toGoal} more reviews reaches your daily goal. Short, regular sessions beat one long one.` : "Daily goal reached. Anything more is a bonus round."}
      </>
    );
  } else if (open === "src") {
    detail = (
      <>
        <b>You will practise from</b><br />Questions made from the materials you uploaded.
        {mats.length > 0 && (
          <ul className="hm-mats">
            {mats.slice(0, 8).map((m, i) => (
              <li key={i}><span>{m.title}</span><small>{m.due} q due</small></li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const start = () => onStartDaily?.({ folder: effScope === "all" ? "__all__" : effScope, size: n || undefined });

  return (
    <div className={`hm-hero${idle ? " idle" : ""}`}>
      <div className="hm-hero-glow" aria-hidden="true" />
      <div className="hm-hero-top">
        <div>
          <div className="hm-tag"><span className="hm-dot" />TODAY'S REVIEW{done === 0 && <span className="hm-tag-s"> · not started</span>}</div>
          <div className="hm-due">
            {a.due > 0 ? (
              <>
                <div className="hm-num" aria-live="polite">{a.due.toLocaleString()}</div>
                <div className="hm-cap">due in <b>{folder ? folder.folderName : "all courses"}</b></div>
              </>
            ) : (
              <div className="hm-cap">
                <b className="hm-caught">All caught up</b>
                <span className="hm-backlog">
                  {fsrsStats?.nextDueAt ? `next item in ${relIn(fsrsStats.nextDueAt)}` : `${a.total.toLocaleString()} items in deck`}
                </span>
              </div>
            )}
          </div>
          {a.total > 0 && (
            <button className="hm-deckb" aria-pressed={open === "src"} onClick={() => toggle("src")}>
              <span>{a.total.toLocaleString()} in deck{a.mats != null ? ` · ${a.mats} material${a.mats === 1 ? "" : "s"}` : ""}</span>
              <Chevron />
            </button>
          )}
        </div>
        <button className={`hm-ring${done >= goal ? " done" : ""}`} onClick={() => onOpenPlan?.(null)} aria-label={`Daily goal: ${done} of ${goal} done. Open study plan`}>
          <svg width="58" height="58" viewBox="0 0 54 54" aria-hidden="true">
            <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="5" />
            <circle cx="27" cy="27" r="22" fill="none" stroke={done >= goal ? "#3DDC97" : "url(#hm-grad)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - ringPct)} style={{ transition: "stroke-dashoffset .6s" }} />
            <defs>
              <linearGradient id="hm-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFC857" /><stop offset="100%" stopColor="#F5A623" />
              </linearGradient>
            </defs>
          </svg>
          <div className="hm-ring-lbl"><b>{done}/{goal}</b><span>GOAL</span></div>
        </button>
      </div>

      {hasList && (
        <button className="hm-exam" onClick={() => onOpenPlan?.(examFolder ? examKeyOf(examFolder) : null)} aria-label="Study plan. Tap to edit exam dates and daily goal">
          <CalIcon />
          <div className="hm-exam-t">
            {examLive ? (
              <>
                <b>{examFolder.folderName} exam {examDays === 0 ? "today" : examDays === 1 ? "tomorrow" : `in ${examDays} days`}</b>
                {(() => {
                  const need = needPerDay(examFolder, examDays);
                  const ok = goal >= need;
                  return <span className={ok ? "" : "warn"}>{ok ? `On track at ${goal}/day` : `Need ~${need}/day · goal is ${goal}`}</span>;
                })()}
              </>
            ) : (
              <>
                <b>{folder ? `Set an exam date for ${folder.folderName}` : examIso ? "Exam date passed" : "Set an exam date"}</b>
                <span>We will plan your reviews around it</span>
              </>
            )}
          </div>
          {examLive && (
            <div className="hm-exam-r"><b>{readiness(examFolder)}%</b><small>ready</small><i><u style={{ width: `${readiness(examFolder)}%` }} /></i></div>
          )}
        </button>
      )}

      {foldersLoading && (
        <div className="hm-pick hm-pick-skel" aria-hidden="true"><i /><i /><i /></div>
      )}

      {hasFolders && chips.length > 0 && (
        <div className="hm-pick" role="radiogroup" aria-label="Choose a course to review">
          {[{ key: "all", folderName: "All courses", due: list.reduce((s, f) => s + f.due, 0) + (bankDueCount || 0) }, ...chips].map((c) => (
            <button key={c.key} className={`hm-cc${c.due === 0 ? " zero" : ""}`} role="radio" aria-checked={c.key === effScope} onClick={() => pick(c.key)}>
              <span className="hm-cc-n">{c.folderName}</span>
              <em>{c.due === 0 ? <CheckIcon /> : c.due}</em>
            </button>
          ))}
        </div>
      )}

      {a.total > 0 && (
        <div className={`hm-seg-bar${hl ? " has" : ""}`} aria-hidden="true">
          <div className={`hm-seg m${hl === "m" ? " on" : ""}`} style={{ width: `${pct(a.m, a.total)}%` }} />
          <div className={`hm-seg l${hl === "l" ? " on" : ""}`} style={{ width: `${pct(a.l, a.total)}%` }} />
          <div className="hm-seg r" style={{ width: `${pct(rest, a.total)}%` }} />
        </div>
      )}

      <div className="hm-stats" role="group" aria-label="Stats. Tap one for details">
        <button className="hm-stat" aria-pressed={open === "ret"} onClick={() => toggle("ret")}><b style={{ color: retInfo(retPct)[1] }}>{retPct}%</b><span>Retention</span></button>
        <button className="hm-stat" aria-pressed={open === "m"} onClick={() => toggle("m")}><b>{a.m.toLocaleString()}</b><span><i className="hm-sdot" style={{ background: "#3DDC97" }} />Mastered</span></button>
        <button className="hm-stat" aria-pressed={open === "l"} onClick={() => toggle("l")}><b>{a.l.toLocaleString()}</b><span><i className="hm-sdot" style={{ background: "#F5A623" }} />Learning</span></button>
        <button className="hm-stat" aria-pressed={open === "done"} onClick={() => toggle("done")}><b>{done}</b><span>Done today</span></button>
      </div>

      {detail && <div className="hm-dbox">{detail}</div>}

      <div className="hm-act">
        <div className="hm-size" role="group" aria-label="Cards in this session">
          <button aria-label="Fewer cards" disabled={idx <= 0} onClick={() => stepTo(idx - 1)}>−</button>
          <div><span>{n}</span><small>CARDS</small></div>
          <button aria-label="More cards" disabled={idx < 0 || idx >= presets.length - 1} onClick={() => stepTo(idx + 1)}>+</button>
        </div>
        <button className={`hm-cta${idle ? " idle" : ""}`} onClick={start} disabled={a.due <= 0}>
          <span>{a.due > 0 ? "Start review" : "All caught up"}</span>
          <small>
            {a.due <= 0 ? "Nothing due here" : done === 0 ? `${mins(n)} · keep your ${fsrsStats?.streak || 0}-day streak` : `${mins(n)}${toGoal > 0 && n >= toGoal ? " · reaches goal" : ""}`}
          </small>
        </button>
      </div>
    </div>
  );
}

// First-run hero: no review data yet — nudge toward first upload + community.
function FirstRunHero({ onAddFirst, onTrySample }) {
  return (
    <div className="hm-hero">
      <div className="hm-hero-glow" aria-hidden="true" />
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
      <button className="hm-cta hm-cta-solo" onClick={onAddFirst}>
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
