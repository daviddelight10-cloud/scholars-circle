import { useState, useEffect, useRef, useMemo } from "react";
import {
  Check, Target, LifeBuoy, Trophy, HeartPulse, Flame, Rocket,
  Frown, Annoyed, Meh, Smile, Zap, Sparkles, Users, Stethoscope,
  Microscope, FlaskConical, GraduationCap,
} from "lucide-react";
import { saveMyProfile } from "../lib/profileApi.js";
import { getUniversities, FALLBACK_INSTITUTIONS, isLocalInstitutionId } from "../lib/universities.js";
import UniversitySelect from "../components/UniversitySelect.jsx";
import DisciplineSelect from "../components/DisciplineSelect.jsx";
import { MEDICAL_PROGRAMS } from "../lib/medicalPrograms.js";
import { haptics } from "../lib/haptics.js";
import "./onboarding.css";

const STORE_KEY = "sc_onboarded_v1";
const REDUCED = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function isOnboarded(uid) {
  try {
    if (uid && localStorage.getItem(`${STORE_KEY}::${uid}`) === "1") return true;
    return localStorage.getItem(STORE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded(uid) {
  try {
    localStorage.setItem(STORE_KEY, "1");
    if (uid) localStorage.setItem(`${STORE_KEY}::${uid}`, "1");
  } catch {
    // ignore
  }
}

const MOTIVES = [
  { id: "exam", Icon: Target, label: "Pass my upcoming exams", sub: "Exam season is real" },
  { id: "catchup", Icon: LifeBuoy, label: "Stop falling behind", sub: "The syllabus is winning" },
  { id: "top", Icon: Trophy, label: "Top my class", sub: "Chasing that distinction" },
  { id: "career", Icon: HeartPulse, label: "Feel career-ready", sub: "Walk into anything confident" },
];

const MOTIVE_HEAD = {
  exam: "Exam mode: engaged.",
  catchup: "We'll get you caught up.",
  top: "Love the ambition.",
  career: "Future-proof energy.",
};

const GOAL_MAP = {
  exam: "Pass my upcoming exams",
  catchup: "Catch up and build confidence",
  top: "Top my class and excel",
  career: "Feel career-ready",
};

const MINUTES = [15, 30, 45, 60, 90, 120];

const MOODS = [
  { id: 1, Icon: Frown, label: "Lost", sub: "Where do I even start" },
  { id: 2, Icon: Annoyed, label: "Shaky", sub: "I know bits, not the whole" },
  { id: 3, Icon: Meh, label: "Okay", sub: "Managing, mostly" },
  { id: 4, Icon: Smile, label: "Solid", sub: "Bring it on" },
  { id: 5, Icon: Rocket, label: "Ready", sub: "Peak form" },
];

const TASK_TYPES = [
  { type: "Flashcards", icon: "🃏" },
  { type: "Case quiz", icon: "🩺" },
  { type: "Rapid review", icon: "⚡" },
];

function defaultCourses(program, level) {
  if (!program) return [];
  const has = (arr) => arr.filter((s) => program.subjects.includes(s));
  if (program.id === "medicine") {
    const n = parseInt(level, 10);
    if (n <= 200) return has(["Anatomy", "Physiology", "Biochemistry"]);
    if (n === 300) return has(["Pharmacology", "Pathology", "Microbiology"]);
    return has(["Internal Medicine", "Surgery", "Obstetrics & Gynaecology"]);
  }
  return program.subjects.slice(0, 3);
}

function launchConfetti() {
  const cvs = document.createElement("canvas");
  cvs.className = "ob-confetti";
  cvs.width = window.innerWidth;
  cvs.height = window.innerHeight;
  document.body.appendChild(cvs);
  const ctx = cvs.getContext("2d");
  const cols = ["#FFD700", "#2dd4a0", "#eaf0f8", "#ef4444"];
  const parts = [];
  for (let i = 0; i < 130; i++) {
    parts.push({
      x: Math.random() * cvs.width, y: -20 - Math.random() * cvs.height * 0.3,
      v: 2.2 + Math.random() * 3.2, w: 5 + Math.random() * 6, r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.22, c: cols[i % 4],
    });
  }
  function frame() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    let alive = false;
    for (const p of parts) {
      p.y += p.v; p.r += p.vr;
      if (p.y < cvs.height + 20) alive = true;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.w / 2, p.w, p.w * 0.62);
      ctx.restore();
    }
    if (alive) requestAnimationFrame(frame); else cvs.remove();
  }
  requestAnimationFrame(frame);
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

const SUBJECT_ALIASES = {
  "obstetrics and gynaecology": "obgyn",
  "internal medicine": "medicine",
  "community medicine": "medicine",
  "medical surgical nursing": "nursing",
};

// ---------- presentational components ----------
function ProgressBar({ filled }) {
  return (
    <div className="ob-bar">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="ob-bar-seg">
          <div className="ob-bar-fill" style={{ width: i < filled ? "100%" : "0%" }} />
        </div>
      ))}
    </div>
  );
}

function Affirm({ children }) {
  return <p className="ob-affirm"><Check size={13} strokeWidth={3} />{children}</p>;
}

function Head({ title, sub }) {
  return (
    <>
      <p className="ob-h1">{title}</p>
      <p className="ob-muted ob-hsub">{sub}</p>
    </>
  );
}

function RowList({ items, selVal, onPick, getVal }) {
  return (
    <div className="ob-rows">
      {items.map((it) => {
        const v = getVal(it);
        const sel = v === selVal;
        const ItIcon = it.Icon;
        return (
          <button key={String(v)} type="button" className={`ob-tile ob-row${sel ? " sel" : ""}`} onClick={() => onPick(v)}>
            <span className="ob-ic"><ItIcon size={17} color={sel ? "#FFD700" : "#8B8D97"} /></span>
            <span className="ob-row-body">
              <span className="ob-row-label" style={{ color: sel ? "#FFD700" : undefined }}>{it.label}</span>
              {it.sub && <span className="ob-row-sub">{it.sub}</span>}
            </span>
            {sel && <span className="ob-tick"><Check size={11} strokeWidth={3.5} color="#1A1300" /></span>}
          </button>
        );
      })}
    </div>
  );
}

function WizardFooter({ label, enabled, onBack, onNext }) {
  return (
    <div className="ob-foot-inner">
      {onBack && <button type="button" className="ob-btnS" onClick={onBack}>Back</button>}
      <button type="button" className={`ob-btnP${onBack ? " grow" : ""}`} disabled={!enabled} onClick={onNext}>
        {label}
      </button>
    </div>
  );
}

export function OnboardingWizard({ subjects = [], uid, onComplete, onSkip, onSetupReward }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState("fwd");
  const [motivation, setMotivation] = useState(null);
  const [programId, setProgramId] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [uniName, setUniName] = useState("");
  const [uniId, setUniId] = useState(null);
  const [dailyMinutes, setDailyMinutes] = useState(45);
  const [confidence, setConfidence] = useState(null);
  const [uniResults, setUniResults] = useState(FALLBACK_INSTITUTIONS);
  const [xpShown, setXpShown] = useState(0);
  const timerRef = useRef(null);
  const rewardRef = useRef(false);
  const contentRef = useRef(null);

  const program = useMemo(() => MEDICAL_PROGRAMS.find((p) => p.id === programId) || null, [programId]);
  const programShort = useMemo(() => {
    if (!program) return "Study";
    let s = program.label.replace(/\s*\(.*$/, "").trim();
    if (s.length > 18) s = s.split(/[&,]/)[0].trim();
    return s;
  }, [program]);
  const levelShort = useMemo(() => (yearLevel.match(/^\d+/) || [""])[0], [yearLevel]);
  const motive = MOTIVES.find((m) => m.id === motivation) || null;
  const moodLabel = MOODS.find((m) => m.id === confidence)?.label || "Okay";

  useEffect(() => {
    getUniversities()
      .then((rows) => {
        if (rows && rows.length > 0) {
          const normalized = rows.map((r) => ({ id: r.id, name: r.name, type: r.type || "university", city: r.city || null }));
          const existing = new Set(normalized.map((r) => r.name.toLowerCase()));
          setUniResults([...normalized, ...FALLBACK_INSTITUTIONS.filter((f) => !existing.has(f.name.toLowerCase()))]);
        }
      })
      .catch(() => {});
  }, []);

  // Fire the real reward (+50 XP, day-1 streak) once when the reveal mounts
  useEffect(() => {
    if (step === 8 && !rewardRef.current) {
      rewardRef.current = true;
      try { onSetupReward?.(); } catch {}
      if (REDUCED) return;
      setTimeout(launchConfetti, 750);
      const t0 = performance.now() + 1900;
      function fr(t) {
        const k = Math.min(1, Math.max(0, (t - t0) / 900));
        setXpShown(Math.round(50 * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(fr);
      }
      requestAnimationFrame(fr);
    }
  }, [step, onSetupReward]);

  function go(n) {
    clearTimeout(timerRef.current);
    setDir(n >= step ? "fwd" : "back");
    setStep(n);
    contentRef.current?.scrollTo({ top: 0 });
  }

  function autoNext() {
    const at = step;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => go(at + 1), 620);
  }

  function pickMotive(id) { haptics.selection(); setMotivation(id); autoNext(); }
  function pickProgram(p) { haptics.selection(); setProgramId(p.id); setYearLevel(""); setSelectedSubjects([]); autoNext(); }
  function pickLevel(l) {
    haptics.selection();
    setYearLevel(l);
    setSelectedSubjects(defaultCourses(program, l));
    autoNext();
  }
  function toggleCourse(c) {
    haptics.selection();
    setSelectedSubjects((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }
  function pickMinutes(m) { haptics.selection(); setDailyMinutes(m); autoNext(); }
  function pickMood(v) { haptics.selection(); setConfidence(v); autoNext(); }

  function matchSubjectId(course) {
    const target = norm(course);
    if (SUBJECT_ALIASES[target]) return SUBJECT_ALIASES[target];
    const exact = subjects.find((s) => norm(s.label) === target || norm(s.id) === target);
    if (exact) return exact.id;
    const fuzzy = subjects.find((s) => {
      const l = norm(s.label || s.id);
      return l && (l.includes(target) || target.includes(l));
    });
    return fuzzy ? fuzzy.id : null;
  }

  const tasks = useMemo(() => {
    const picks = selectedSubjects.slice(0, 3);
    const n = picks.length || 1;
    const base = Math.floor(dailyMinutes / n), rem = dailyMinutes - base * n;
    return picks.map((course, i) => ({
      course,
      ...TASK_TYPES[i % TASK_TYPES.length],
      mins: base + (i === 0 ? rem : 0),
    }));
  }, [selectedSubjects, dailyMinutes]);

  function taskDestination(task) {
    if (task.type === "Flashcards") return { kind: "tab", tab: "flashcards" };
    if (task.type === "Case quiz") return { kind: "tab", tab: "clinical-cases" };
    const sid = matchSubjectId(task.course);
    return sid ? { kind: "practice", subjectId: sid } : { kind: "tab", tab: "practice" };
  }

  function coachNote() {
    const c = confidence || 3;
    if (c <= 2) {
      if (motivation === "exam") return "Exam pressure on a low-confidence day — we kept the load light and hit the highest-yield topics first.";
      return "Low-battery day. Momentum beats intensity — show up, tick the boxes, and we'll ramp back up.";
    }
    if (motivation === "top" && c >= 4) return "Distinction pace. Bonus challenge questions unlocked today.";
    if (motivation === "exam") return "Steady, exam-focused reps — past-question style all the way.";
    if (motivation === "career") return "Case-first session today. Think like the professional you're becoming.";
    if (motivation === "catchup") return "Catch-up mode: today closes one more gap. Keep the streak alive.";
    return "A steady session, tuned to how you're feeling.";
  }

  function goalText() {
    return GOAL_MAP[motivation] || (confidence <= 2 ? "Catch up and build confidence" : confidence >= 4 ? "Maintain and excel" : "Improve steadily");
  }

  function finish(destination) {
    markOnboarded(uid);
    haptics.success();
    saveMyProfile({
      isUniversityStudent: true,
      institution: uniName || null,
      universityId: isLocalInstitutionId(uniId) ? null : uniId || null,
      programme: program ? program.label : null,
      department: program ? program.label : null,
      level: yearLevel || null,
      learningStyle: "visual",
      goals: goalText(),
      targetGrade: "A",
      studyHoursPerDay: Math.round((dailyMinutes / 60) * 10) / 10,
      courses: selectedSubjects,
    }).catch((e) => console.warn("Profile backend save failed:", e?.message || e));
    onComplete({
      selectedSubjects,
      dailyMinutes,
      confidence,
      programId,
      programme: program ? program.label : null,
      yearLevel,
      institution: uniName,
      universityId: uniId,
      motivation,
      goals: goalText(),
      courses: selectedSubjects,
      destination: destination || null,
    });
  }

  // ---------- screens ----------
  let screen = null;
  let foot = null;

  if (step === 0) {
    screen = (
      <div className="ob-welcome">
        <div className="ob-decor" style={{ top: "9%", right: "6%", animationDelay: "0s" }}><FlaskConical size={44} color="#FFD700" /></div>
        <div className="ob-decor" style={{ top: "28%", left: "4%", animationDelay: "0.8s", animationDuration: "6.5s" }}><Microscope size={38} color="#FFD700" /></div>
        <div className="ob-decor" style={{ bottom: "16%", right: "9%", animationDelay: "0.4s", animationDuration: "7s" }}><GraduationCap size={36} color="#FFD700" /></div>
        <div className="ob-welcome-inner">
          <div className="ob-logo-orb"><Stethoscope size={30} color="#FFD700" /></div>
          <p className="ob-eyebrow">SCHOLAR'S CIRCLE</p>
          <h1 className="ob-hero">School, minus<br />the overwhelm.</h1>
          <p className="ob-muted ob-hero-sub">Answer a few quick questions and get a daily plan built around your courses, your exams, and your energy.</p>
          <p className="ob-xp-hook"><Zap size={13} /> ≈ 30 seconds · earn +50 XP for setup</p>
          <button type="button" className="ob-skip" onClick={onSkip}>Skip setup</button>
        </div>
      </div>
    );
    foot = (
      <div className="ob-foot-inner">
        <button type="button" className="ob-btnP" onClick={() => go(1)}>Build my study plan</button>
      </div>
    );
  } else if (step === 1) {
    screen = (
      <>
        <ProgressBar filled={1} />
        <Head title="What's pulling you through this semester?" sub="Your answer tunes your daily plan — there's no wrong one." />
        <RowList items={MOTIVES} selVal={motivation} onPick={pickMotive} getVal={(m) => m.id} />
      </>
    );
    foot = <WizardFooter label="Next" enabled={!!motivation} onBack={() => go(0)} onNext={() => go(2)} />;
  } else if (step === 2) {
    screen = (
      <>
        <ProgressBar filled={2} />
        {motive && <Affirm>{MOTIVE_HEAD[motivation]}</Affirm>}
        <Head title="What's your discipline?" sub="Search it — we'll shape everything around it." />
        <DisciplineSelect value={programId} onChange={pickProgram} autoFocus />
        {program && (
          <p className="ob-muted" style={{ marginTop: 12, fontSize: 12 }}>
            {program.icon} {program.label} · {program.subjects.length} core courses
          </p>
        )}
      </>
    );
    foot = <WizardFooter label="Next" enabled={!!programId} onBack={() => go(1)} onNext={() => go(3)} />;
  } else if (step === 3) {
    screen = (
      <>
        <ProgressBar filled={3} />
        <Affirm>{`${programShort} it is.`}</Affirm>
        <Head title="Which level are you?" sub="Your course list depends on it." />
        <div className="ob-g3">
          {(program?.levels || []).map((l) => {
            const sel = yearLevel === l;
            const num = (l.match(/^\d+/) || [l])[0];
            return (
              <button key={l} type="button" className={`ob-tile ob-level${sel ? " sel" : ""}`} onClick={() => pickLevel(l)}>
                {num}
                {sel && <span className="ob-tick"><Check size={11} strokeWidth={3.5} color="#1A1300" /></span>}
              </button>
            );
          })}
        </div>
        {program && program.levels.some((l) => l.length > 9) && yearLevel && (
          <p className="ob-muted" style={{ marginTop: 10, fontSize: 12, textAlign: "center" }}>{yearLevel}</p>
        )}
      </>
    );
    foot = <WizardFooter label="Next" enabled={!!yearLevel} onBack={() => go(2)} onNext={() => go(4)} />;
  } else if (step === 4) {
    screen = (
      <>
        <ProgressBar filled={4} />
        <Affirm>{`${levelShort ? `${levelShort}-level` : yearLevel} — got it.`}</Affirm>
        <Head title="Your semester load" sub="Pre-filled suggestions — untick what you're not taking." />
        <div className="ob-g2">
          {(program?.subjects || []).map((c) => {
            const sel = selectedSubjects.includes(c);
            return (
              <button key={c} type="button" className={`ob-tile ob-course${sel ? " sel" : ""}`} onClick={() => toggleCourse(c)}>
                {c}
              </button>
            );
          })}
        </div>
        <p className="ob-count">{selectedSubjects.length} selected</p>
      </>
    );
    foot = <WizardFooter label="Next" enabled={selectedSubjects.length > 0} onBack={() => go(3)} onNext={() => go(5)} />;
  } else if (step === 5) {
    screen = (
      <>
        <ProgressBar filled={5} />
        <Affirm>{`Nice load — ${selectedSubjects.length} course${selectedSubjects.length > 1 ? "s" : ""}.`}</Affirm>
        <Head title="Where do you study?" sub="We'll connect you with coursemates and study circles." />
        <div className="ob-uni">
          <UniversitySelect
            value={uniName}
            onChange={(val, uni) => {
              setUniName(val);
              setUniId(uni ? uni.id : null);
              if (uni && uni.name === val) { haptics.selection(); autoNext(); }
            }}
            universities={uniResults}
            placeholder="Search your university, polytechnic or college…"
            autoFocus
          />
        </div>
        <p className="ob-skipwrap"><button type="button" className="ob-skip" onClick={() => { haptics.light(); go(6); }}>Skip for now</button></p>
      </>
    );
    foot = <WizardFooter label="Next" enabled={!!uniName} onBack={() => go(4)} onNext={() => go(6)} />;
  } else if (step === 6) {
    screen = (
      <>
        <ProgressBar filled={6} />
        <Affirm>Almost there.</Affirm>
        <Head title="Daily study time" sub="Small and consistent beats heroic and rare." />
        <div className="ob-g3">
          {MINUTES.map((m) => {
            const sel = dailyMinutes === m;
            return (
              <button key={m} type="button" className={`ob-tile ob-level${sel ? " sel" : ""}`} onClick={() => pickMinutes(m)}>
                {m} min
                {sel && <span className="ob-tick"><Check size={11} strokeWidth={3.5} color="#1A1300" /></span>}
              </button>
            );
          })}
        </div>
      </>
    );
    foot = <WizardFooter label="Next" enabled onBack={() => go(5)} onNext={() => go(7)} />;
  } else if (step === 7) {
    screen = (
      <>
        <ProgressBar filled={7} />
        <Affirm>Last one.</Affirm>
        <Head title="How confident do you feel right now?" sub="Be honest — your plan adapts to it." />
        <RowList items={MOODS} selVal={confidence} onPick={pickMood} getVal={(m) => m.id} />
      </>
    );
    foot = <WizardFooter label="Start studying" enabled={!!confidence} onBack={() => go(6)} onNext={() => go(8)} />;
  } else if (step === 8) {
    const sample = selectedSubjects.slice(0, 3).join(", ");
    const items = [
      `Loaded ${sample}${selectedSubjects.length > 3 ? " and more" : ""}`,
      `Daily target set: ${dailyMinutes} minutes`,
      "Calibrated to your confidence level",
      `Connected to ${uniName || "your study circle"}`,
    ];
    screen = (
      <div className="ob-reveal">
        <div className="ob-spinner" />
        <p className="ob-reveal-title">Building your {levelShort ? `${levelShort}L ` : ""}{programShort} plan</p>
        <p className="ob-muted ob-reveal-sub">This takes a few seconds</p>
        <div className="ob-reveal-items">
          {items.map((it, i) => (
            <div key={i} className="ob-reveal-item" style={{ animationDelay: `${0.15 + i * 0.45}s` }}>
              <span className="ob-check-dot"><Check size={12} strokeWidth={3} color="#9FE1CB" /></span>
              <span>{it}</span>
            </div>
          ))}
        </div>
        <div className="ob-xp-card">
          <p className="ob-xp-big">+{REDUCED ? 50 : xpShown} XP</p>
          <p className="ob-muted ob-xp-sub">for completing setup — day 1 streak started</p>
        </div>
        <button type="button" className="ob-btnP ob-enter" onClick={() => { haptics.light(); go(9); }}>See your plan</button>
      </div>
    );
  } else if (step === 9) {
    screen = (
      <>
        <div className="ob-chips">
          <span className="ob-chip"><span className="ob-flame"><Flame size={13} color="#FFD700" /></span>Day 1 streak</span>
          <span className="ob-chip"><Zap size={13} color="#FFD700" /><span className="ob-chip-xp">+50 XP earned</span></span>
        </div>
        <p className="ob-h1">Your {levelShort ? `${levelShort}L ` : ""}{programShort} plan</p>
        <p className="ob-muted ob-hsub">Tuned to a "{moodLabel}" day · {dailyMinutes} min target</p>
        <div className="ob-plan-card">
          <div className="ob-plan-head">
            <span className="ob-plan-eyebrow">TODAY'S PLAN</span>
            <span className="ob-muted ob-plan-hint">tap a task to start</span>
          </div>
          {tasks.map((t, i) => (
            <button key={i} type="button" className="ob-task" onClick={() => finish(taskDestination(t))}>
              <span className="ob-task-ic">{t.icon}</span>
              <span className="ob-task-body">
                <span className="ob-task-course">{t.course}</span>
                <span className="ob-task-type"> · {t.type}</span>
              </span>
              <span className="ob-task-mins">{t.mins}m</span>
            </button>
          ))}
        </div>
        <div className="ob-note">
          <Flame size={14} color="#FFD700" />
          <span className="ob-muted">{coachNote()}</span>
        </div>
        <button type="button" className="ob-circle" onClick={() => finish({ kind: "feed", feedTab: "groups" })}>
          <span className="ob-ic"><Users size={17} color="#FFD700" /></span>
          <span className="ob-circle-body">
            <span className="ob-circle-title">{uniName || "Your study circle"}</span>
            <span className="ob-circle-sub">Find coursemates studying {selectedSubjects[1] || selectedSubjects[0] || "your courses"}</span>
          </span>
          <span className="ob-circle-arrow">→</span>
        </button>
        <button type="button" className="ob-btnP ob-enter" onClick={() => finish(null)}>Enter Scholar's Circle</button>
      </>
    );
  }

  return (
    <div className="ob-shell">
      <aside className="ob-aside" aria-hidden="true">
        <div className="ob-awrap">
          <div className="ob-alogo">
            <span className="ob-alogo-mark"><Stethoscope size={19} color="#FFD700" /></span>
            Scholar's Circle
          </div>
          <h2 className="ob-ahead">Study plans that survive the semester.</h2>
          <p className="ob-asub">Turn your courses, exam dates, and energy into a daily plan — with your coursemates studying alongside you.</p>
          {step === 0 ? (
            <div className="ob-acard">
              {[
                [Stethoscope, "Clinical case simulations & OSCE prep"],
                [Sparkles, "AI tutor, drug reference & calculators"],
                [FlaskConical, "Lab values + spaced-repetition flashcards"],
                [Flame, "Streaks, XP & a class leaderboard"],
              ].map(([Icon, txt], i) => (
                <div key={i} className="ob-afeat"><Icon size={16} color="#FFD700" /><span>{txt}</span></div>
              ))}
            </div>
          ) : (
            <div className="ob-acard">
              {[
                ["Motivation", motive?.label, !!motivation],
                ["Discipline", program?.label, !!program],
                ["Level", yearLevel, !!yearLevel],
                ["Courses", selectedSubjects.length ? `${selectedSubjects.length} selected` : "", selectedSubjects.length > 0],
                ["Institution", uniName, !!uniName],
                ["Daily target", `${dailyMinutes} min`, !!dailyMinutes],
                ["Confidence", confidence ? moodLabel : "", !!confidence],
              ].map(([lab, val, done], i) => (
                <div key={i} className="ob-afact">
                  <span className={`ob-adot${done ? " done" : ""}`}>{done ? <Check size={10} strokeWidth={3} color="#9FE1CB" /> : null}</span>
                  <span className="ob-alab">{lab}</span>
                  <span className="ob-aval" style={{ color: done ? "#eaf0f8" : "#565A66" }}>{done ? String(val).length > 34 ? String(val).slice(0, 34) + "…" : val : "—"}</span>
                </div>
              ))}
            </div>
          )}
          {step >= 8 && (
            <div className="ob-adone"><Flame size={14} color="#FFD700" />Setup complete — +50 XP earned</div>
          )}
        </div>
        <div className="ob-afoot">
          <span className="ob-astars">★★★★★</span>
          <p>Consistency beats cramming — {dailyMinutes} focused minutes a day.</p>
        </div>
      </aside>
      <div className="ob-pane">
        <div className="ob-content" ref={contentRef} aria-live="polite">
          <div className="ob-wrap">
            <div key={step} className={`ob-scr${dir === "back" ? " back" : ""}`}>{screen}</div>
          </div>
        </div>
        {foot && <div className="ob-foot"><div className="ob-wrap">{foot}</div></div>}
      </div>
    </div>
  );
}
