import { memo, useMemo, useState } from "react";
import HIcon from "./HIcon.jsx";
import { MaterialsSheet, Sheet, SheetHead } from "./HomeSheets.jsx";
import { examKeyOf, daysUntil, needPerDay } from "../../hooks/useReviewPlan.js";

const RING_C = 138.2; // 2πr for r=22
const SCOPE_KEY = "sc_home_review_scope";
const SIZE_KEY = "sc_home_review_size";
const MATS_KEY = "sc_home_review_mats";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };

function relIn(ts) {
  const mins = Math.round((new Date(ts) - Date.now()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

const mins = (n) => `~${Math.max(1, Math.round((n * 20) / 60))} min`;

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
  const [picked, setPicked] = useState(() => { try { const v = JSON.parse(lsGet(MATS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [matsOpen, setMatsOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState(false);
  const setPick = (ids) => { setPicked(ids); lsSet(MATS_KEY, JSON.stringify(ids)); };

  const list = useMemo(() => folders || [], [folders]);
  const hasList = list.length > 0;
  const fallback = !!list[0]?._fallback; // subject-based list: no per-folder scoping
  const hasFolders = hasList && !fallback;
  const folder = hasFolders && scope !== "all" ? list.find((f) => f.key === scope) || null : null;
  const effScope = folder ? folder.key : "all";

  const goal = fsrsStats?.dailyGoal || 20;
  const done = fsrsStats?.reviewedToday || 0;
  const ringPct = goal > 0 ? Math.min(1, done / goal) : 0;
  const reduced = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false, []);

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

  // Materials the user hand-picked (within the current course scope).
  const scopeMats = useMemo(
    () => (folder ? [folder] : list).flatMap((f) => (f.materials || []).filter((m) => m.id).map((m) => ({ ...m, folderName: f.folderName }))),
    [folder, list],
  );
  const pickedMats = useMemo(() => {
    if (!hasFolders) return [];
    const s = new Set(picked);
    return scopeMats.filter((m) => s.has(m.id));
  }, [picked, scopeMats, hasFolders]);
  const picks = pickedMats.length > 0;
  const pickDue = pickedMats.reduce((s, m) => s + m.due, 0);
  const pickTotal = pickedMats.reduce((s, m) => s + m.total, 0);
  const shownDue = picks ? pickDue : a.due;
  const avail = picks ? pickTotal : a.due;

  // Session length — three plain choices instead of a stepper.
  const toGoal = Math.max(goal - done, 0);
  const sizeOpts = useMemo(() => {
    const opts = [];
    const push = (m, label) => { if (m >= 1 && !opts.some((o) => o.n === m)) opts.push({ n: m, label }); };
    if (avail > 0) push(Math.min(10, avail), "Quick");
    if (toGoal > 0 && toGoal < avail) push(toGoal, "Daily goal");
    if (avail > 0) push(avail, "Everything due");
    return opts;
  }, [avail, toGoal]);
  const n = avail <= 0 ? 0
    : size != null ? Math.min(size, avail)
    : (sizeOpts.find((o) => o.label === "Daily goal")?.n ?? sizeOpts[0]?.n ?? 0);

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

  const idle = done < goal && shownDue > 0;

  const sessScope = picks ? `${pickedMats.length} material${pickedMats.length === 1 ? "" : "s"}` : folder ? folder.folderName : "All courses";

  const start = () => onStartDaily?.(picks
    ? { folder: "__all__", resources: pickedMats.map((m) => m.id), practice: true, size: n || undefined }
    : { folder: effScope === "all" ? "__all__" : effScope, size: n || undefined });

  return (
    <>
    <div className={`hm-hero${idle ? " idle" : ""}`}>
      <div className="hm-hero-glow" aria-hidden="true" />
      <div className="hm-hero-top">
        <div>
          <div className="hm-tag"><span className="hm-dot" />TODAY'S REVIEW{done === 0 && <span className="hm-tag-s"> · not started</span>}</div>
          <div className="hm-due">
            {shownDue > 0 ? (
              <>
                <div className="hm-num" aria-live="polite">{shownDue.toLocaleString()}</div>
                <div className="hm-cap">cards to review today</div>
              </>
            ) : (
              <div className="hm-cap">
                <b className="hm-caught">All caught up</b>
                <span className="hm-backlog">
                  {picks ? `${pickTotal.toLocaleString()} cards to practise ahead` : fsrsStats?.nextDueAt ? `next item in ${relIn(fsrsStats.nextDueAt)}` : `${a.total.toLocaleString()} items in deck`}
                </span>
              </div>
            )}
          </div>
        </div>
        <button className={`hm-ring${done >= goal ? " done" : ""}`} onClick={() => onOpenPlan?.(null)} aria-label={`Daily goal: ${done} of ${goal} reviewed today. Tap to change your goal`}>
          <svg width="58" height="58" viewBox="0 0 54 54" aria-hidden="true">
            <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="5" />
            <circle className="hm-ring-arc" cx="27" cy="27" r="22" fill="none" stroke={done >= goal ? "#3DDC97" : "url(#hm-grad)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - ringPct)} style={{ transition: "stroke-dashoffset .6s" }} />
            <defs>
              <linearGradient id="hm-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFC857" /><stop offset="100%" stopColor="#F5A623" />
                {!reduced && <animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="6s" repeatCount="indefinite" />}
              </linearGradient>
            </defs>
          </svg>
          <div className="hm-ring-lbl"><b>{done}/{goal}</b><span>TODAY</span></div>
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
                  return <span className={goal >= need ? "" : "warn"}>{goal >= need ? "You're on track" : `Aim for ~${need}/day`}</span>;
                })()}
              </>
            ) : (
              <>
                <b>{folder ? `Set an exam date for ${folder.folderName}` : examIso ? "Exam date passed" : "Set an exam date"}</b>
                <span>We'll plan your reviews around it</span>
              </>
            )}
          </div>
        </button>
      )}

      <div className="hm-act">
        <button className={`hm-cta${idle ? " idle" : ""}`} onClick={start} disabled={avail <= 0}>
          <span>{shownDue > 0 ? (picks ? "Start practice" : "Start review") : picks && avail > 0 ? "Practice ahead" : "All caught up"}</span>
          <small>
            {shownDue <= 0 ? (picks && avail > 0 ? "Nothing due · extra practice" : "Nothing due here") : done === 0 ? `${mins(n)} · keep your ${fsrsStats?.streak || 0}-day streak` : `${mins(n)}${toGoal > 0 && n >= toGoal ? " · reaches goal" : ""}`}
          </small>
        </button>
      </div>

      {done > 0 && done >= goal && shownDue > 0 && (
        <div className="hm-goalmsg" role="status">Daily goal reached. Anything more is a bonus round.</div>
      )}

      <button className="hm-sess" onClick={() => setOptsOpen(true)}>
        <span className="hm-sess-t"><b>{sessScope}</b>{n > 0 ? ` · ${n} card${n === 1 ? "" : "s"}` : ""}</span>
        <span className="hm-sess-c">
          {(picks || !!folder) && <i className="hm-sess-dot" aria-label="Custom selection active" />}
          Customise <Chevron />
        </span>
      </button>
    </div>

      {/* Sheets live outside .hm-hero — its idle heartbeat animates
          transform, which would trap position:fixed children inside it */}
      <Sheet open={optsOpen} onClose={() => setOptsOpen(false)}>
        <SheetHead title="Review options" onClose={() => setOptsOpen(false)} />
        {foldersLoading && (
          <div className="hm-pick hm-pick-skel" aria-hidden="true"><i /><i /><i /></div>
        )}
        {hasFolders && chips.length > 0 && (
          <>
            <p className="hm-sh-sub">What to review</p>
            <div className="hm-pick" role="radiogroup" aria-label="Choose a course to review">
              {[{ key: "all", folderName: "All courses", due: list.reduce((s, f) => s + f.due, 0) + (bankDueCount || 0) }, ...chips].map((c) => (
                <button key={c.key} className={`hm-cc${c.due === 0 ? " zero" : ""}`} role="radio" aria-checked={c.key === effScope} onClick={() => pick(c.key)}>
                  <span className="hm-cc-n">{c.folderName}</span>
                  <em>{c.due === 0 ? <CheckIcon /> : c.due}</em>
                </button>
              ))}
            </div>
          </>
        )}
        {hasFolders && scopeMats.length > 0 && (
          <div className="hm-mpick">
            <button className={`hm-mpick-b${picks ? " on" : ""}`} onClick={() => setMatsOpen(true)} aria-haspopup="dialog">
              <span>{picks ? `${pickedMats.length} material${pickedMats.length === 1 ? "" : "s"} selected` : "Choose materials to practise"}</span>
              <em>{picks ? `${pickDue} due` : `${scopeMats.length}`}</em>
            </button>
            {picks && <button className="hm-mpick-x" onClick={() => setPick([])} aria-label="Clear selected materials">Clear</button>}
          </div>
        )}
        {sizeOpts.length > 0 && (
          <>
            <p className="hm-sh-sub">Session length</p>
            <div className="hm-pick" role="radiogroup" aria-label="Cards in this session">
              {sizeOpts.map((o) => (
                <button key={o.label} className="hm-cc" role="radio" aria-checked={n === o.n} onClick={() => { setSize(o.n); lsSet(SIZE_KEY, o.n); }}>
                  <span className="hm-cc-n">{o.label}</span>
                  <em>{o.n}</em>
                </button>
              ))}
            </div>
          </>
        )}
        <button className="hm-cta hm-cta-solo" style={{ marginTop: 16 }} onClick={() => { setOptsOpen(false); start(); }} disabled={avail <= 0}>
          Start review{n > 0 ? ` · ${n} cards` : ""}
        </button>
      </Sheet>
      <MaterialsSheet open={matsOpen} onClose={() => setMatsOpen(false)} materials={scopeMats} selected={pickedMats.map((m) => m.id)} onChange={setPick} />
    </>
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
        Then invite your study group: live quiz rooms turn revision into a competition.
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
