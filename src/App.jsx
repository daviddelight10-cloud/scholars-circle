import { useEffect, useMemo, useState, useRef } from "react";

import { COINS_PER_SESSION, SUBJECTS, XP_PER_CORRECT } from "./data";

import { createClient } from "@supabase/supabase-js";

import { callAI } from "./lib/aiClient";

const NOTES_KEY = "sc_user_notes_v1";
const CUSTOM_QUESTIONS_KEY = "sc_custom_questions_v1";
const AI_DOCS_KEY = "sc_ai_study_assistant_v1";
const LECTURE_NOTES_KEY = "sc_lecture_notes_v1";

function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function DemoLockedOverlay({ title, description, icon = "🔒" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 16, textAlign: "center", padding: 32 }}>
      <span style={{ fontSize: 48 }}>{icon}</span>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p className="muted" style={{ maxWidth: 400 }}>{description}</p>
      <button onClick={() => alert("Upgrade to Scholar's Circle Pro to unlock this feature!\n\nBenefits:\n• Unlimited AI tutoring\n• Full analytics dashboard\n• Study groups & leaderboard\n• Unlimited past papers\n• Classroom features")}>
        Upgrade to Pro
      </button>
    </div>
  );
}

function GlobalSearchDropdown({ query, filter, subjects }) {
  const allContent = useMemo(() => {
    const userNotes = loadFromStorage(NOTES_KEY);
    const customQuestions = loadFromStorage(CUSTOM_QUESTIONS_KEY);
    const aiDocs = loadFromStorage(AI_DOCS_KEY);
    const lectureNotes = loadFromStorage(LECTURE_NOTES_KEY);

    return {
      notes: userNotes.map((n) => ({
        type: "note",
        id: n.id,
        subjectId: n.subjectId,
        subject: subjects.find((s) => s.id === n.subjectId)?.label || "Unknown",
        title: "Student Note",
        content: n.content,
        timestamp: n.updatedAt
      })),
      questions: customQuestions.map((q, i) => ({
        type: "question",
        id: `q_${i}`,
        subjectId: q.subjectId,
        subject: subjects.find((s) => s.id === q.subjectId)?.label || "Unknown",
        title: "Custom Question",
        content: `${q.q} ${q.options?.join(" ")} ${q.explanation || ""}`,
        timestamp: Date.now()
      })),
      flashcards: aiDocs.flatMap((doc) =>
        (doc.flashcards || []).map((f, i) => ({
          type: "flashcard",
          id: `${doc.id}_f_${i}`,
          subjectId: doc.subjectId,
          subject: doc.subjectLabel,
          title: "Flashcard",
          content: `${f.front} ${f.back}`,
          timestamp: doc.createdAt
        }))
      ),
      lectures: lectureNotes.map((n) => ({
        type: "lecture",
        id: n.id,
        subjectId: n.subjectId,
        subject: subjects.find((s) => s.id === n.subjectId)?.label || "Unknown",
        title: n.title,
        content: `${(n.summary || []).join(" ")} ${(n.key_terms || []).map(t => `${t.term} ${t.definition}`).join(" ")}`,
        timestamp: n.createdAt
      }))
    };
  }, [subjects]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const allItems = [
      ...allContent.notes,
      ...allContent.questions,
      ...allContent.flashcards,
      ...allContent.lectures
    ];

    const filtered = allItems.filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;

      const contentMatch = item.content.toLowerCase().includes(lowerQuery);
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const subjectMatch = item.subject.toLowerCase().includes(lowerQuery);

      return contentMatch || titleMatch || subjectMatch;
    });

    return filtered.sort((a, b) => {
      const aContentScore = a.content.toLowerCase().includes(lowerQuery) ? 3 : 0;
      const aTitleScore = a.title.toLowerCase().includes(lowerQuery) ? 2 : 0;
      const aSubjectScore = a.subject.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const aScore = aContentScore + aTitleScore + aSubjectScore;

      const bContentScore = b.content.toLowerCase().includes(lowerQuery) ? 3 : 0;
      const bTitleScore = b.title.toLowerCase().includes(lowerQuery) ? 2 : 0;
      const bSubjectScore = b.subject.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const bScore = bContentScore + bTitleScore + bSubjectScore;

      return bScore - aScore;
    });
  }, [query, filter, allContent]);

  const typeIcons = {
    note: "📝",
    question: "❓",
    flashcard: "🃏",
    lecture: "🎓"
  };

  const typeColors = {
    note: "#818cf8",
    question: "#facc15",
    flashcard: "#2dd4a0",
    lecture: "#ef4444"
  };

  function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
  }

  if (!query.trim()) {
    return <p className="muted" style={{ textAlign: "center", padding: 20 }}>Start typing to search across all your content</p>;
  }

  if (searchResults.length === 0) {
    return <p className="muted" style={{ textAlign: "center", padding: 20 }}>No results found for "{query}"</p>;
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 12, fontSize: 12 }}>
        Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
      </p>
      {searchResults.map((item) => (
        <div
          key={item.id}
          style={{
            padding: 10,
            background: "#1f2937",
            borderRadius: 6,
            marginBottom: 6,
            borderLeft: `4px solid ${typeColors[item.type]}`
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {typeIcons[item.type]} {item.title}
            </span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              {item.subject}
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "#d1d5db",
              marginBottom: 4,
              lineHeight: 1.4
            }}
            dangerouslySetInnerHTML={{
              __html: highlightText(
                item.content.length > 150
                  ? item.content.substring(0, 150) + "..."
                  : item.content,
                query
              )
            }}
          />
          <span style={{ fontSize: 10, color: "#6b7280" }}>
            {new Date(item.timestamp).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}

import { TodayScreen } from "./features/TodayPlan";

import { LectureToNotes } from "./features/LectureToNotes";

import { PastPaperDrill } from "./features/PastPaperDrill";

import { AIStudyAssistant } from "./features/AIStudyAssistant";

import { PracticeWithHints } from "./features/PracticeWithHints";

import { AchievementNotification } from "./features/AchievementNotification";

import { PersonalizedStudyPaths } from "./features/PersonalizedStudyPaths";

import { StudyGroups } from "./features/StudyGroups";

import { OnboardingWizard, isOnboarded, markOnboarded } from "./features/Onboarding";



const EMPTY_STATS = {

  xp: 0,

  sessions: 0,

  streak: 0,

  coins: 0,

  weeklyGoal: 5,

  questsDone: {},

  totalCorrect: 0,

};

const EMPTY_QUESTS = [

  { id: "q1", label: "Complete 1 study session", target: 1, type: "sessions" },

  { id: "q2", label: "Get 3 correct answers", target: 3, type: "correct" },

  { id: "q3", label: "Complete 3 sessions today", target: 3, type: "sessions" },

  { id: "q4", label: "Score 80% or above in an exam", target: 80, type: "score" },

  { id: "q5", label: "Study 2 different subjects", target: 2, type: "subjects" },

  { id: "q6", label: "Get 10 correct answers", target: 10, type: "correct" },

  { id: "q7", label: "Complete Spaced Review", target: 1, type: "spaced" },

  { id: "q8", label: "Use the AI Helper once", target: 1, type: "ai" },

];



const BADGES = [

  // Session badges
  { id: "first_session",  icon: "🌱", label: "First Steps",    desc: "Complete your first session",            check: (s)       => s.sessions >= 1 },

  { id: "sessions_10",   icon: "📚", label: "Dedicated",       desc: "Complete 10 study sessions",             check: (s)       => s.sessions >= 10 },

  { id: "sessions_25",   icon: "🏅", label: "Veteran",         desc: "Complete 25 study sessions",             check: (s)       => s.sessions >= 25 },

  { id: "sessions_50",   icon: "🎖️", label: "Legend",         desc: "Complete 50 study sessions",             check: (s)       => s.sessions >= 50 },

  { id: "sessions_100",  icon: "🏆", label: "Hall of Fame",    desc: "Complete 100 study sessions",            check: (s)       => s.sessions >= 100, rare: true },

  // Streak badges
  { id: "streak_3",      icon: "⚡", label: "On Fire",         desc: "Keep a 3-day streak",                    check: (s)       => s.streak >= 3 },

  { id: "streak_7",      icon: "🔥", label: "7-Day Streak",    desc: "Keep a 7-day streak",                    check: (s)       => s.streak >= 7 },

  { id: "streak_14",     icon: "💫", label: "14-Day Streak",   desc: "Keep a 14-day streak",                   check: (s)       => s.streak >= 14 },

  { id: "streak_30",     icon: "🌟", label: "30-Day Streak",   desc: "Keep a 30-day streak",                   check: (s)       => s.streak >= 30, rare: true },

  { id: "streak_100",    icon: "💎", label: "100-Day Legend",  desc: "Keep a 100-day streak",                  check: (s)       => s.streak >= 100, rare: true, legendary: true },

  // XP badges
  { id: "xp_100",        icon: "⭐", label: "Scholar",         desc: "Earn 100 XP",                            check: (s)       => s.xp >= 100 },

  { id: "xp_500",        icon: "💫", label: "Expert",          desc: "Earn 500 XP",                            check: (s)       => s.xp >= 500 },

  { id: "xp_1000",       icon: "🌟", label: "Master Scholar",  desc: "Earn 1000 XP",                           check: (s)       => s.xp >= 1000 },

  { id: "xp_5000",       icon: "👑", label: "XP King",         desc: "Earn 5000 XP",                           check: (s)       => s.xp >= 5000, rare: true },

  // Accuracy badges
  { id: "correct_50",    icon: "🎯", label: "Sharpshooter",    desc: "Get 50 correct answers total",           check: (s)       => s.totalCorrect >= 50 },

  { id: "correct_100",   icon: "🎪", label: "Centurion",       desc: "Get 100 correct answers total",          check: (s)       => s.totalCorrect >= 100 },

  { id: "correct_500",   icon: "🎯", label: "Accuracy Master", desc: "Get 500 correct answers total",         check: (s)       => s.totalCorrect >= 500, rare: true },

  { id: "perfect_score", icon: "🏆", label: "Perfectionist",   desc: "Score 100% on any exam",                 check: (s, h)    => h.some(x => x.score === x.total && x.total > 0 && x.mode === "exam") },

  { id: "perfect_5",     icon: "🎖️", label: "5x Perfect",      desc: "Score 100% on 5 exams",                  check: (s, h)    => h.filter(x => x.score === x.total && x.total > 0 && x.mode === "exam").length >= 5, rare: true },

  // Time-based badges (collectible)
  { id: "night_owl",     icon: "🦉", label: "Night Owl",       desc: "Study after 10 pm",                      check: (s, h)    => h.some(x => new Date(x.ts).getHours() >= 22), rare: true },

  { id: "early_bird",    icon: "🐦", label: "Early Bird",      desc: "Study before 6 am",                      check: (s, h)    => h.some(x => new Date(x.ts).getHours() < 6), rare: true },

  { id: "weekend_warrior", icon: "⚔️", label: "Weekend Warrior", desc: "Study on Saturday and Sunday",         check: (s, h)    => { const days = h.map(x => new Date(x.ts).getDay()); return days.includes(0) && days.includes(6); }, rare: true },

  { id: "lunch_learner", icon: "🍽️", label: "Lunch Learner",   desc: "Study between 12pm-2pm",                 check: (s, h)    => h.some(x => { const hr = new Date(x.ts).getHours(); return hr >= 12 && hr < 14; }) },

  { id: "midnight_oil",  icon: "🕯️", label: "Midnight Oil",    desc: "Study past midnight",                    check: (s, h)    => h.some(x => { const hr = new Date(x.ts).getHours(); return hr >= 0 && hr < 4; }), rare: true },

  // Subject badges
  { id: "all_subjects",  icon: "🌈", label: "Well Rounded",    desc: "Study every subject at least once",      check: (s, h, sub) => new Set(h.map(x => x.subjectId)).size >= sub.length },

  { id: "subject_master", icon: "🎓", label: "Subject Master", desc: "Study one subject 10 times",             check: (s, h)    => { const counts = {}; h.forEach(x => counts[x.subjectId] = (counts[x.subjectId] || 0) + 1); return Object.values(counts).some(c => c >= 10); } },

  // Mastery badges
  { id: "mastery_80",    icon: "🎓", label: "Master",          desc: "Reach 80% mastery in any subject",       check: (s, h, sub, m) => Object.values(m).some(v => v >= 80) },

  { id: "mastery_100",   icon: "👑", label: "Grandmaster",     desc: "Reach 100% mastery in any subject",       check: (s, h, sub, m) => Object.values(m).some(v => v >= 100) },

  { id: "mastery_all",   icon: "🏆", label: "All Master",      desc: "Reach 80% in all subjects",              check: (s, h, sub, m) => sub.every(s => (m[s.id] || 0) >= 80), rare: true },

  // Coin badges
  { id: "coins_50",      icon: "💰", label: "Coin Collector",  desc: "Accumulate 50 coins",                    check: (s)       => s.coins >= 50 },

  { id: "coins_100",     icon: "💎", label: "Rich Scholar",    desc: "Accumulate 100 coins",                   check: (s)       => s.coins >= 100 },

  { id: "coins_500",     icon: "👑", label: "Coin King",       desc: "Accumulate 500 coins",                   check: (s)       => s.coins >= 500, rare: true },

  // Speed badges
  { id: "speed_demon",   icon: "💨", label: "Speed Demon",     desc: "Finish an exam in under 2 minutes",      check: (s, h)    => h.some(x => x.mode === "exam" && x.seconds > 0 && x.seconds < 120) },

  { id: "lightning",     icon: "⚡", label: "Lightning Fast",  desc: "Finish a quiz in under 30 seconds",      check: (s, h)    => h.some(x => x.seconds > 0 && x.seconds < 30), rare: true },

  // Hidden achievements (secret until unlocked)
  { id: "comeback",      icon: "🔄", label: "Comeback Kid",    desc: "Study after 7+ day break",               check: (s, h)    => { if (h.length < 2) return false; const sorted = [...h].sort((a,b) => b.ts - a.ts); const gap = sorted[0].ts - sorted[1].ts; return gap > 7 * 24 * 60 * 60 * 1000; }, hidden: true },

  { id: "marathon",      icon: "🏃", label: "Marathon",        desc: "Study 5 sessions in one day",            check: (s, h)    => { const today = new Date().toDateString(); return h.filter(x => new Date(x.ts).toDateString() === today).length >= 5; }, hidden: true },

  { id: "first_blood",   icon: "🩸", label: "First Blood",     desc: "Be the first to study today",            check: (s, h)    => { const today = new Date().toDateString(); const todaySessions = h.filter(x => new Date(x.ts).toDateString() === today); return todaySessions.length === 1 && Date.now() - todaySessions[0].ts < 60000; }, hidden: true },

];

// League system
const LEAGUES = [
  { id: "bronze", name: "Bronze", icon: "🥉", minXP: 0, color: "#cd7f32" },
  { id: "silver", name: "Silver", icon: "🥈", minXP: 200, color: "#c0c0c0" },
  { id: "gold", name: "Gold", icon: "🥇", minXP: 500, color: "#ffd700" },
  { id: "platinum", name: "Platinum", icon: "💎", minXP: 1000, color: "#e5e4e2" },
  { id: "diamond", name: "Diamond", icon: "💠", minXP: 2500, color: "#b9f2ff" },
  { id: "champion", name: "Champion", icon: "👑", minXP: 5000, color: "#ff6b6b" },
];

function getLeague(xp) {
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (xp >= LEAGUES[i].minXP) return LEAGUES[i];
  }
  return LEAGUES[0];
}

function getNextLeague(xp) {
  const current = getLeague(xp);
  const idx = LEAGUES.findIndex(l => l.id === current.id);
  if (idx < LEAGUES.length - 1) return LEAGUES[idx + 1];
  return null;
}



const DEMO_USERS = [

  { username: "teacher", password: "teacher123", role: "teacher", isActivated: true },

  { username: "student", password: "student123", role: "student", isActivated: false },

];

const DEMO_LIMITS = {
  aiMessages: 5,
  practiceQuestions: 10,
  questionBankQuestions: 5,
  flashcardReviews: 10,
  timetableSlots: 3,
  reminders: 2,
  allowedTabs: ["today", "subjects", "quiz", "settings"],
  dailyTimeLimit: 30, // minutes per day
  totalSessions: 5, // total demo sessions allowed
  exportEnabled: false, // disable data export in demo
  analyticsDepth: "basic", // vs "advanced"
  trialDays: 14, // 14-day trial period
  masteryCap: 70, // max mastery % in demo
  maxStreak: 7, // max streak days in demo
  allowedDifficulties: ["easy", "medium"], // lock advanced/expert
  maxSpacedReviewCards: 5, // limit spaced review
  maxCustomFlashcardDecks: 1, // limit flashcard decks
  allowedThemes: ["aurora", "paper"], // lock premium themes
  premiumThemes: ["neon"], // requires upgrade
  leaderboardAccess: false, // hide leaderboard in demo
  studyGroupsAccess: "view", // "view" | "full" in demo
  pastPapersLimit: 1, // only 1 past paper in demo
  aiTutorMessages: 3, // separate from AI assistant
  classroomAccess: false, // lock classroom in demo
  pomodoroSessions: 2, // per day in demo
  notesLimit: 5, // max notes in demo
  hidePremiumTabs: true, // completely hide locked tabs
};

const DEMO_ACHIEVEMENTS = [
  { id: "demo_explorer", icon: "🗺️", label: "Demo Explorer", desc: "Visit 5 different tabs", check: (p) => p.tabsVisited.size >= 5 },
  { id: "feature_tester", icon: "🧪", label: "Feature Tester", desc: "Try 3 different features", check: (p) => p.featuresTried.size >= 3 },
  { id: "quiz_master", icon: "📝", label: "Quiz Master", desc: "Complete 3 practice sessions", check: (p, u) => u.practiceQuestions >= 3 },
  { id: "ai_curious", icon: "🤖", label: "AI Curious", desc: "Use AI Tutor once", check: (p, u) => u.aiMessages >= 1 },
  { id: "timetable_planner", icon: "📅", label: "Timetable Planner", desc: "Add 2 timetable slots", check: (p, u) => u.timetableSlots >= 2 },
  { id: "note_taker", icon: "📝", label: "Note Taker", desc: "Create a note", check: (p) => p.featuresTried.has("notes") },
  { id: "flashcard_flipper", icon: "🔄", label: "Flashcard Flipper", desc: "Review 5 flashcards", check: (p, u) => u.flashcardReviews >= 5 },
  { id: "demo_complete", icon: "🎯", label: "Demo Complete", desc: "Earn all demo achievements", check: (p, u, a) => a.length >= 7 },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";



function todayKey() {

  return new Date().toDateString();

}



function CourseOutline({ subjects, outlineSubjectId, setOutlineSubjectId, startSubjectPractice, addNote, outlineProgress, setOutlineProgress }) {

  const subject = subjects.find((s) => s.id === outlineSubjectId) || subjects[0];

  const [noteView, setNoteView] = useState(null); // { text, title, weekKey }

  const [noteSearch, setNoteSearch] = useState("");

  // Combine both semesters into a single outline
  const sem1 = subject?.courseOutlines?.sem1 || [];
  const sem2 = subject?.courseOutlines?.sem2 || [];
  const outline = [...sem1, ...sem2];

  const outlineState = outlineProgress[subject?.id] || {};

  function toggleStudied(weekKey) {

    setOutlineProgress((prev) => {

      const next = { ...prev };

      const subj = { ...(next[subject.id] || {}) };

      subj[weekKey] = !subj[weekKey];

      next[subject.id] = subj;

      return next;

    });

  }

  function escapeRegExp(str) {

    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  }

  const highlightNote = useMemo(() => {

    if (!noteView?.text) return null;

    if (!noteSearch.trim()) return [noteView.text];

    try {

      const parts = noteView.text.split(new RegExp(`(${escapeRegExp(noteSearch)})`, "gi"));

      return parts.map((part, i) => (

        part.toLowerCase() === noteSearch.toLowerCase() ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>

      ));

    } catch {

      return [noteView.text];

    }

  }, [noteView, noteSearch]);

  function copyNote(text) {

    if (!text) return;

    navigator.clipboard?.writeText(text).catch(() => alert("Copy failed"));

  }

  function printNote(text, title) {

    if (!text) return;

    const win = window.open("", "_blank", "noopener,noreferrer");

    if (!win) return alert("Please allow pop-ups to print the note.");

    win.document.write(`<!doctype html><html><head><title>${title || "Study Note"}</title><style>body{font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;padding:24px;line-height:1.6;} h2{margin-top:0;}</style></head><body><h2>${title || "Study Note"}</h2><pre style="white-space:pre-wrap">${text}</pre></body></html>`);

    win.document.close();

    win.focus();

    win.print();

  }

  return (

    <div className="card">

      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>

        <h2 style={{ margin: 0 }}>Course Outline</h2>

        <select value={outlineSubjectId} onChange={(e) => setOutlineSubjectId(e.target.value)}>

          {subjects.map((s) => (

            <option key={s.id} value={s.id}>{s.label}</option>

          ))}

        </select>

      </div>

      {!outline.length && (

        <p className="muted">No outline yet for this semester.</p>

      )}

      {outline.length > 0 && (

        <div className="outline-list">

          {outline.map((mod, i) => (

            <div key={i} className="lesson-block">

              <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>

                <div>

                  <strong>{mod.title}</strong>

                  {mod.week && <span className="muted" style={{ marginLeft: 8 }}>Week {mod.week}</span>}

                </div>

                <div className="row" style={{ gap: 6 }}>

                  <button onClick={() => startSubjectPractice(subject.id, "practice")}>Start Practice</button>

                  <button onClick={() => addNote((mod.notes || ""))}>Copy to Notes</button>

                  {mod.notes && <button onClick={() => setNoteView({ text: mod.notes, title: mod.title, weekKey: mod.week })}>📖 Study note</button>}

                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>

                    <input type="checkbox" checked={!!outlineState[mod.week]} onChange={() => toggleStudied(mod.week)} />

                    Mark as studied

                  </label>

                </div>

              </div>

              {mod.outcomes && mod.outcomes.length > 0 && (

                <ul className="muted" style={{ marginTop: 8 }}>

                  {mod.outcomes.map((o, idx) => (

                    <li key={idx}>{o}</li>

                  ))}

                </ul>

              )}

              {mod.notes && <p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>{mod.notes}</p>}

              {mod.resources && mod.resources.length > 0 && (

                <div style={{ marginTop: 8 }}>

                  <strong style={{ fontSize: 13 }}>Resources:</strong>

                  <ul className="muted" style={{ marginTop: 4 }}>

                    {mod.resources.map((r, idx) => (

                      <li key={idx}><a href={r} target="_blank" rel="noreferrer">{r}</a></li>

                    ))}

                  </ul>

                </div>

              )}

            </div>

          ))}

        </div>

      )}

      {noteView && (

        <div className="modal-overlay" onClick={() => setNoteView(null)}>

          <div className="modal-box" onClick={(e) => e.stopPropagation()}>

            <div className="row" style={{ alignItems: "center", gap: 8 }}>

              <h3 style={{ margin: 0 }}>{noteView.title || "Study Note"}</h3>

              {noteView.weekKey && <span className="muted">Week {noteView.weekKey}</span>}

            </div>

            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>

              <input placeholder="Search in note" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} style={{ flex: 1 }} />

              <button onClick={() => copyNote(noteView.text)}>Copy</button>

              <button onClick={() => printNote(noteView.text, noteView.title)}>Print/PDF</button>

              <button onClick={() => startSubjectPractice(outlineSubjectId, "practice")}>Start practice</button>

            </div>

            <div style={{ maxHeight: 360, overflowY: "auto", lineHeight: 1.6, marginTop: 10 }}>

              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>

                {highlightNote || noteView.text}

              </div>

            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>

                <input type="checkbox" checked={!!outlineState[noteView.weekKey]} onChange={() => toggleStudied(noteView.weekKey)} />

                Mark as studied

              </label>

              <button onClick={() => setNoteView(null)}>Close</button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}
function percent(score, total) {

  if (!total) return 0;

  return Math.round((score / total) * 100);

}



function pickAdaptiveQuestion(pool, wrongCounts, mastery) {

  const weighted = pool.flatMap((q) => {

    const wrong = wrongCounts[q.key] || 0;

    const m = mastery[q.subjectId] ?? 0;

    const weight = 1 + wrong + (m < 60 ? 2 : 0);

    return Array.from({ length: weight }, () => q);

  });

  return weighted[Math.floor(Math.random() * weighted.length)];

}



async function api(path, { token, method = "GET", body } = {}) {

  const res = await fetch(`${API_BASE}${path}`, {

    method,

    headers: {

      "Content-Type": "application/json",

      ...(token ? { Authorization: `Bearer ${token}` } : {}),

    },

    ...(body ? { body: JSON.stringify(body) } : {}),

  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || "API request failed");

  return data;

}



async function syncUserDataToBackend(token, data) {

  if (!token) return;

  try {

    await api("/user-data/progress", { token, method: "POST", body: data.progress });

  } catch (e) { console.error("Failed to sync progress:", e); }

  try {

    await api("/user-data/timetable", { token, method: "POST", body: { timetable: data.timetable } });

  } catch (e) { console.error("Failed to sync timetable:", e); }

}



async function loadUserDataFromBackend(token) {

  if (!token) return null;

  try {

    const data = await api("/user-data", { token });

    return data;

  } catch (e) {

    console.error("Failed to load from backend:", e);

    return null;

  }

}



// Confetti celebration overlay
function ConfettiOverlay() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#1dd1a1', '#ff9f43', '#ee5a24'];
    const newParticles = [];
    for (let i = 0; i < 150; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 8,
        speedY: 2 + Math.random() * 4,
        speedX: (Math.random() - 0.5) * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    setParticles(newParticles);
  }, []);

  return (
    <div className="confetti-container">
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall 3s ease-out forwards`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

// Celebration toast notification
function CelebrationToast({ celebration, onClose }) {
  const messages = {
    streak: (data) => `🔥 ${data.days}-Day Streak! Keep it up!`,
    league: (data) => `🎉 Promoted to ${data.league.icon} ${data.league.name}!`,
    perfect: (data) => `🏆 Perfect Score! ${data.score}/${data.total}`,
    badge: (data) => `🏅 Badge Unlocked: ${data.icon} ${data.label}`,
  };

  return (
    <div className="celebration-toast" onClick={onClose}>
      <div className="celebration-content">
        <span className="celebration-icon">
          {celebration.type === 'streak' && celebration.data.icon}
          {celebration.type === 'league' && celebration.data.league.icon}
          {celebration.type === 'perfect' && '🏆'}
          {celebration.type === 'badge' && celebration.data.icon}
        </span>
        <span className="celebration-message">
          {messages[celebration.type]?.(celebration.data) || '🎉 Achievement!'}
        </span>
      </div>
    </div>
  );
}

// Streak loss warning component
function StreakLossWarning({ streak, lastStudied }) {
  const [showWarning, setShowWarning] = useState(false);
  const [hoursLeft, setHoursLeft] = useState(0);

  useEffect(() => {
    if (!lastStudied || streak < 3) {
      setShowWarning(false);
      return;
    }

    const checkStreak = () => {
      const now = new Date();
      const lastDate = new Date(lastStudied);
      const tomorrow = new Date(lastDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const hoursRemaining = (tomorrow - now) / (1000 * 60 * 60);

      if (hoursRemaining < 6 && hoursRemaining > 0) {
        setHoursLeft(Math.ceil(hoursRemaining));
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    checkStreak();
    const interval = setInterval(checkStreak, 60000);
    return () => clearInterval(interval);
  }, [lastStudied, streak]);

  if (!showWarning) return null;

  return (
    <div className="streak-warning">
      <span className="streak-warning-icon">⚠️</span>
      <span className="streak-warning-text">
        Your <strong>{streak}-day streak</strong> will break in <strong>{hoursLeft} hours!</strong>
      </span>
      <button className="streak-warning-btn" onClick={() => setShowWarning(false)}>
        Study Now
      </button>
    </div>
  );
}

// Study Heatmap Calendar Component
function StudyHeatmap({ heatmap }) {
  const [showTooltip, setShowTooltip] = useState(null);

  const generateCalendar = () => {
    const days = [];
    const today = new Date();

    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const count = heatmap[key] || 0;
      days.push({ date: key, count, day: date.getDay() });
    }

    return days;
  };

  const days = generateCalendar();
  const maxCount = Math.max(...Object.values(heatmap), 1);

  const getColor = (count) => {
    if (count === 0) return 'rgba(148, 163, 184, 0.1)';
    const intensity = count / maxCount;
    if (intensity >= 0.75) return '#22c55e';
    if (intensity >= 0.5) return '#4ade80';
    if (intensity >= 0.25) return '#86efac';
    return '#bbf7d0';
  };

  const totalSessions = Object.values(heatmap).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(heatmap).filter(v => v > 0).length;

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <span className="heatmap-title">📊 Study Activity</span>
        <span className="heatmap-stats">{activeDays} active days • {totalSessions} total</span>
      </div>
      <div className="heatmap-grid">
        {days.map((d, i) => (
          <div
            key={i}
            className="heatmap-cell"
            style={{ background: getColor(d.count) }}
            onMouseEnter={() => setShowTooltip(d)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            {showTooltip?.date === d.date && (
              <div className="heatmap-tooltip">
                <strong>{d.date}</strong>
                <br />
                {d.count} questions answered
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        <div className="heatmap-legend-cells">
          <div style={{ background: getColor(0) }} />
          <div style={{ background: getColor(maxCount * 0.25) }} />
          <div style={{ background: getColor(maxCount * 0.5) }} />
          <div style={{ background: getColor(maxCount * 0.75) }} />
          <div style={{ background: getColor(maxCount) }} />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

// League Progress Component
function LeagueProgress({ xp }) {
  const currentLeague = getLeague(xp);
  const nextLeague = getNextLeague(xp);
  const progress = nextLeague
    ? ((xp - currentLeague.minXP) / (nextLeague.minXP - currentLeague.minXP)) * 100
    : 100;

  return (
    <div className="league-progress">
      <div className="league-current">
        <span className="league-icon" style={{ color: currentLeague.color }}>{currentLeague.icon}</span>
        <span className="league-name">{currentLeague.name}</span>
      </div>
      {nextLeague && (
        <>
          <div className="league-bar">
            <div
              className="league-bar-fill"
              style={{ width: `${progress}%`, background: currentLeague.color }}
            />
          </div>
          <div className="league-next">
            <span>{nextLeague.icon} {nextLeague.name}</span>
            <span>{nextLeague.minXP - xp} XP to go</span>
          </div>
        </>
      )}
      {!nextLeague && (
        <div className="league-max">
          👑 Maximum League Reached!
        </div>
      )}
    </div>
  );
}

// Celebration Notification Component
function CelebrationNotification({ stats, history, yesterdayTime }) {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    // Check if studied more than yesterday
    const today = new Date().toDateString();
    const todaySessions = history.filter(h => new Date(h.ts).toDateString() === today);
    const todayTime = todaySessions.length * 5; // rough estimate in minutes

    if (yesterdayTime > 0 && todayTime > yesterdayTime + 10) {
      setNotification({
        type: 'improvement',
        message: `You studied ${todayTime - yesterdayTime} minutes more than yesterday! 🎉`,
      });
    }

    // Check if in top 10% (simulated)
    if (stats.xp > 500 && Math.random() > 0.9) {
      setNotification({
        type: 'top10',
        message: "You're in the top 10% this week! 🏆",
      });
    }
  }, [stats.xp, history, yesterdayTime]);

  if (!notification) return null;

  return (
    <div className="celebration-notification" onClick={() => setNotification(null)}>
      <span>{notification.message}</span>
    </div>
  );
}

function App() {

  const [tab, setTab] = useState("today");

  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded());

  const [stats, setStats] = useState(EMPTY_STATS);

  const [history, setHistory] = useState([]);

  const [wrongCounts, setWrongCounts] = useState({});

  const [mastery, setMastery] = useState({});

  const [srData, setSrData] = useState({});

  const [assignments, setAssignments] = useState([]);

  const [activeSession, setActiveSession] = useState(null);

  const [darkMode, setDarkMode] = useState(true);

  const [lastStudied, setLastStudied] = useState(() => {
    try {
      const authRaw = localStorage.getItem("scholars-circle-auth");
      let uid = "guest";
      if (authRaw) {
        const authParsed = JSON.parse(authRaw);
        uid = authParsed.authUser?.id || authParsed.authUser?.username || "guest";
      }
      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);
      if (raw) return JSON.parse(raw).lastStudied ?? null;
    } catch { /* ignore */ }
    return null;
  });

  const [syncConfig, setSyncConfig] = useState({ url: "", key: "", userId: "local-user" });

  const [syncStatus, setSyncStatus] = useState("");

  const [aiConfig, setAiConfig] = useState({

    provider: import.meta.env.VITE_GEMINI_API_KEY ? "gemini" : "openai",

    model: import.meta.env.VITE_GEMINI_API_KEY ? "gemini-2.0-flash" : "gpt-4o-mini",

    apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || "",

  });

  const [auth, setAuth] = useState({

    mode: "login",

    email: "",

    username: "",

    password: "",

    signupRole: "STUDENT",

    inviteCode: "",

    user: null,

    error: "",

    info: "",

  });

  // Refs for signup form to avoid stale closure issues
  const signupEmailRef = useRef("");
  const signupUsernameRef = useRef("");
  const signupPasswordRef = useRef("");
  const signupConfirmPasswordRef = useRef("");
  const signupRoleRef = useRef("STUDENT");
  const signupInviteCodeRef = useRef("");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  const [token, setToken] = useState("");

  const [backendSubjects, setBackendSubjects] = useState([]);

  const [adminUsers, setAdminUsers] = useState([]);

  const [adminLogins, setAdminLogins] = useState([]);

  const [adminLoading, setAdminLoading] = useState(false);

  const [customQuestions, setCustomQuestions] = useState([]);

  const [showCheckpoint, setShowCheckpoint] = useState(null);

  const [notes, setNotes] = useState({});

  const [searchQuery, setSearchQuery] = useState("");

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const [globalSearchFilter, setGlobalSearchFilter] = useState("all");

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);

  // Celebration system
  const [celebration, setCelebration] = useState(null); // { type: 'streak'|'level'|'badge', data }
  const [showConfetti, setShowConfetti] = useState(false);
  const [studyHeatmap, setStudyHeatmap] = useState(() => {
    try {
      const raw = localStorage.getItem("scholars-circle-heatmap");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const [examQuestionCount, setExamQuestionCount] = useState("all");

  const [examCustomMinutes, setExamCustomMinutes] = useState("");

  const [timetable, setTimetable] = useState({});

  const [discussion, setDiscussion] = useState({});

  const [themePack, setThemePack] = useState("aurora");

  const [density, setDensity] = useState("cozy");

  const [showPalette, setShowPalette] = useState(false);

  const [paletteQuery, setPaletteQuery] = useState("");

  const [booted, setBooted] = useState(false);

  const [customFlashcards, setCustomFlashcards] = useState([]);

  const [aiChatHistory, setAiChatHistory] = useState([]);

  const [reminders, setReminders] = useState([]);

  const [notificationPermission, setNotificationPermission] = useState("default");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [loadingOverlay, setLoadingOverlay] = useState(true);

  const [outlineSubjectId, setOutlineSubjectId] = useState(SUBJECTS[0]?.id || "");

  const [outlineProgress, setOutlineProgress] = useState({});

  const [demoMode, setDemoMode] = useState(() => {
    try {
      const authRaw = localStorage.getItem("scholars-circle-auth");
      let uid = "guest";
      if (authRaw) {
        const authParsed = JSON.parse(authRaw);
        uid = authParsed.authUser?.id || authParsed.authUser?.username || "guest";
      }
      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);
      if (raw) return JSON.parse(raw).demoMode ?? false;
    } catch { /* ignore */ }
    return false;
  });

  const [demoUsage, setDemoUsage] = useState(() => {
    try {
      const authRaw = localStorage.getItem("scholars-circle-auth");
      let uid = "guest";
      if (authRaw) {
        const authParsed = JSON.parse(authRaw);
        uid = authParsed.authUser?.id || authParsed.authUser?.username || "guest";
      }
      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.demoUsage) {
          return {
            ...parsed.demoUsage,
            demoProgress: {
              tabsVisited: new Set(parsed.demoUsage.demoProgress?.tabsVisited || []),
              featuresTried: new Set(parsed.demoUsage.demoProgress?.featuresTried || []),
              achievements: parsed.demoUsage.demoProgress?.achievements || [],
            },
          };
        }
      }
    } catch { /* ignore */ }
    return {
      aiMessages: 0,
      practiceQuestions: 0,
      questionBankQuestions: 0,
      flashcardReviews: 0,
      timetableSlots: 0,
      reminders: 0,
      sessionTimeMinutes: 0,
      totalSessionsUsed: 0,
      pomodoroSessions: 0,
      notesCount: 0,
      pastPapersUsed: 0,
      aiTutorMessages: 0,
      trialStartDate: null,
      demoProgress: {
        tabsVisited: new Set(),
        featuresTried: new Set(),
        achievements: [],
      },
    };
  });

  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [showDemoSummary, setShowDemoSummary] = useState(false);
  const [showExpirationWarning, setShowExpirationWarning] = useState(false);
  const [showDemoTour, setShowDemoTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);



  const isTeacher = String(auth.user?.role || "").toLowerCase() === "teacher";

  const isActivated = isTeacher || auth.user?.isActivated === true;

  const subjects = useMemo(() => {

    if (!customQuestions.length) return SUBJECTS;

    return [

      ...SUBJECTS,

      { id: "custom", label: "Custom Bank", icon: "🧩", image: SUBJECTS[0].image, lessons: [], questions: customQuestions },

    ];

  }, [customQuestions]);



  function buildPaletteActions() {

    return [

      { label: "Go to Dashboard", run: () => setTab("dashboard") },

      { label: "Go to Learn", run: () => setTab("learn") },

      { label: "Start Adaptive Practice", run: startAdaptive },

      { label: "Start Diagnostic", run: startDiagnostic },

      { label: "Start Weak Drill", run: startWeakDrill },

      { label: "Open Timetable", run: () => setTab("timetable") },

      { label: "Open Notes", run: () => setTab("notes") },

      { label: "Open Cheat Sheet", run: () => setTab("cheatsheet") },

      { label: "Open Discussion", run: () => setTab("discuss") },

      { label: "Toggle Theme", kbd: "Ctrl/Cmd+D", run: () => setDarkMode((v) => !v) },

      { label: "Toggle Density", run: () => setDensity((d) => d === "cozy" ? "compact" : "cozy") },

    ];

  }



  // Helper to get per-user storage key (uses user id for uniqueness)
  function storageKey(base) {
    const uid = auth.user?.id || auth.user?.username || localStorage.getItem("scholars-circle-current-user") || "guest";
    return `${base}::${uid}`;
  }

  useEffect(() => {

    // extra guard: load discussion from dedicated key in case main state parse fails
    const rawDiscuss = localStorage.getItem(storageKey("scholars-circle-discussion"));

    if (rawDiscuss) {

      try { setDiscussion(JSON.parse(rawDiscuss)); } catch { /* ignore */ }

    }

  }, [auth.user?.username]);



  useEffect(() => {

    if (!booted) return;

    localStorage.setItem(storageKey("scholars-circle-discussion"), JSON.stringify(discussion));

  }, [discussion, booted, auth.user?.username]);



  useEffect(() => {

    // Step 1: Restore auth from a shared key so we know WHO is logging in
    const authRaw = localStorage.getItem("scholars-circle-auth");
    if (authRaw) {
      try {
        const authParsed = JSON.parse(authRaw);
        setAuth((a) => ({ ...a, user: authParsed.authUser ?? null }));
        setToken(authParsed.authToken ?? "");
        // Remember current user ID for storage key
        const uid = authParsed.authUser?.id || authParsed.authUser?.username;
        if (uid) {
          localStorage.setItem("scholars-circle-current-user", uid);
        }
      } catch { /* ignore */ }
    }

    // Step 2: Load user-specific data using user ID
    const uid = (() => {
      try { const u = JSON.parse(authRaw)?.authUser; return u?.id || u?.username; } catch { return null; }
    })() || localStorage.getItem("scholars-circle-current-user") || "guest";

    const raw = localStorage.getItem(`scholars-circle-state::${uid}`);

    if (raw) {

      try {

        const parsed = JSON.parse(raw);

        setStats(parsed.stats ?? EMPTY_STATS);

        setHistory(parsed.history ?? []);

        setWrongCounts(parsed.wrongCounts ?? {});

        setMastery(parsed.mastery ?? {});

        setSrData(parsed.srData ?? {});

        setAssignments(parsed.assignments ?? []);

        setCustomQuestions(parsed.customQuestions ?? []);

        setDarkMode(parsed.darkMode ?? true);

        setLastStudied(parsed.lastStudied ?? null);

        setSyncConfig(parsed.syncConfig ?? { url: "", key: "", userId: "local-user" });

        setAiConfig((prev) => {

          if (import.meta.env.VITE_GEMINI_API_KEY) {

            return { provider: "gemini", model: "gemini-2.0-flash", apiKey: import.meta.env.VITE_GEMINI_API_KEY };

          }

          const savedModel = parsed.aiConfig?.model;

          const migratedModel = savedModel === "gemini-1.5-flash" || savedModel === "gemini-1.5-pro"

            ? "gemini-2.0-flash"

            : savedModel;

          return {

            provider: parsed.aiConfig?.provider ?? prev.provider,

            model: migratedModel ?? prev.model,

            apiKey: parsed.aiConfig?.apiKey ?? (import.meta.env.VITE_OPENAI_API_KEY ?? prev.apiKey),

          };

        });

        setNotes(parsed.notes ?? {});

        setTimetable(parsed.timetable ?? {});

        setDiscussion(parsed.discussion ?? {});

        setThemePack(parsed.themePack ?? "aurora");

        setDensity(parsed.density ?? "cozy");

        setOutlineProgress(parsed.outlineProgress ?? {});

        setNotificationPermission(parsed.notificationPermission ?? "default");

        if (parsed.demoMode !== undefined) setDemoMode(parsed.demoMode);
        if (parsed.demoUsage) {
          setDemoUsage(prev => ({
            ...prev,
            ...parsed.demoUsage,
            demoProgress: {
              ...prev.demoProgress,
              tabsVisited: new Set(parsed.demoUsage.demoProgress?.tabsVisited || []),
              featuresTried: new Set(parsed.demoUsage.demoProgress?.featuresTried || []),
              achievements: parsed.demoUsage.demoProgress?.achievements || [],
            },
          }));
        }

        setOutlineProgress(parsed.outlineProgress ?? {});
        setCustomQuestions(parsed.customQuestions ?? []);
        setDarkMode(parsed.darkMode ?? true);
        setLastStudied(parsed.lastStudied ?? null);
        setNotes(parsed.notes ?? {});
        setTimetable(parsed.timetable ?? {});

      } catch (e) {

        console.error("Failed to parse saved state", e);

      }

    }

    setBooted(true);

    setLoadingOverlay(false);

  }, []);

  // Track tab visits for demo achievements
  useEffect(() => {
    if (!demoMode || !booted) return;
    setDemoUsage(prev => ({
      ...prev,
      demoProgress: {
        ...prev.demoProgress,
        tabsVisited: new Set([...prev.demoProgress.tabsVisited, tab]),
      },
    }));
  }, [tab, demoMode, booted]);

  // Track session time
  useEffect(() => {
    if (!demoMode || !booted) return;
    const interval = setInterval(() => {
      setDemoUsage(prev => {
        const newMinutes = prev.sessionTimeMinutes + 1;
        // Show warning at 80% of daily limit
        if (newMinutes === Math.floor(DEMO_LIMITS.dailyTimeLimit * 0.8)) {
          setShowTimeWarning(true);
        }
        return {
          ...prev,
          sessionTimeMinutes: newMinutes,
        };
      });
    }, 60000); // Every minute
    return () => clearInterval(interval);
  }, [demoMode, booted]);

  // Initialize trial start date when demo mode is activated
  useEffect(() => {
    if (demoMode && !demoUsage.trialStartDate) {
      setDemoUsage(prev => ({
        ...prev,
        trialStartDate: Date.now(),
      }));
      // Show tour on first demo activation
      setShowDemoTour(true);
    }
  }, [demoMode, demoUsage.trialStartDate]);

  // Check for trial expiration
  useEffect(() => {
    if (!demoMode || !demoUsage.trialStartDate) return;
    const daysElapsed = (Date.now() - demoUsage.trialStartDate) / (1000 * 60 * 60 * 24);
    const daysRemaining = DEMO_LIMITS.trialDays - daysElapsed;
    // Show warning when 3 days or less remaining
    if (daysRemaining <= 3 && daysRemaining > 0 && !showExpirationWarning) {
      setShowExpirationWarning(true);
    }
  }, [demoMode, demoUsage.trialStartDate, showExpirationWarning]);

  // Check demo achievements
  useEffect(() => {
    if (!demoMode || !booted) return;
    const earned = DEMO_ACHIEVEMENTS.filter(a => 
      a.check(demoUsage.demoProgress, demoUsage, demoUsage.demoProgress.achievements)
    );
    setDemoUsage(prev => ({
      ...prev,
      demoProgress: {
        ...prev.demoProgress,
        achievements: earned.map(a => a.id),
      },
    }));
  }, [demoUsage, demoMode, booted]);

  function trackFeatureTry(feature) {
    if (!demoMode) return;
    setDemoUsage(prev => ({
      ...prev,
      demoProgress: {
        ...prev.demoProgress,
        featuresTried: new Set([...prev.demoProgress.featuresTried, feature]),
      },
    }));
  }

  useEffect(() => {
    if (!booted) return;

    // Load from localStorage first (per-user key)
    const raw = localStorage.getItem(storageKey("scholars-circle-state"));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setStats(parsed.stats ?? EMPTY_STATS);
        setHistory(parsed.history ?? []);
        setWrongCounts(parsed.wrongCounts ?? {});
        setMastery(parsed.mastery ?? {});
        setSrData(parsed.srData ?? {});
        setAssignments(parsed.assignments ?? []);
        setOutlineProgress(parsed.outlineProgress ?? {});
        setCustomQuestions(parsed.customQuestions ?? []);
        setDarkMode(parsed.darkMode ?? true);
        setLastStudied(parsed.lastStudied ?? null);
        setNotes(parsed.notes ?? {});
        setTimetable(parsed.timetable ?? {});
        if (parsed.discussion !== undefined) setDiscussion(parsed.discussion);
        setThemePack(parsed.themePack ?? "aurora");
        setDensity(parsed.density ?? "cozy");
        setCustomFlashcards(parsed.customFlashcards ?? []);
        setAiChatHistory(parsed.aiChatHistory ?? []);
        setReminders(parsed.reminders ?? []);
      } catch (e) {
        console.error("Failed to parse local state", e);
      }
    }

    // Then overlay with backend data for logged-in users (backend is per-user by JWT)
    if (token) {
      loadUserDataFromBackend(token).then((data) => {
        if (!data) return;
        if (data.progress) {
          setStats((prev) => ({
            ...prev,
            xp: data.progress.xp ?? prev.xp,
            sessions: data.progress.sessions ?? prev.sessions,
            streak: data.progress.streak ?? prev.streak,
            coins: data.progress.coins ?? prev.coins,
            weeklyGoal: data.progress.weeklyGoal ?? prev.weeklyGoal,
          }));
          if (data.progress.wrongCounts) setWrongCounts(data.progress.wrongCounts);
          if (data.progress.mastery) setMastery(data.progress.mastery);
          if (data.progress.srData) setSrData(data.progress.srData);
          if (data.progress.lastStudied) setLastStudied(data.progress.lastStudied);
          if (data.progress.darkMode !== undefined) setDarkMode(data.progress.darkMode);
          if (data.progress.themePack) setThemePack(data.progress.themePack);
          if (data.progress.density) setDensity(data.progress.density);
        }
        if (data.timetable && Object.keys(data.timetable).length) setTimetable(data.timetable);
        if (data.flashcards?.length) setCustomFlashcards(data.flashcards.map(f => ({ front: f.front, back: f.back, subject: f.subject })));
        if (data.reminders?.length) setReminders(data.reminders.map(r => ({ id: r.id, time: r.time, label: r.label, subject: r.subject, sent: r.sent })));
        if (data.chatHistory?.length) setAiChatHistory(data.chatHistory.map(m => ({ role: m.role, content: m.content, timestamp: new Date(m.timestamp).getTime() })));
        if (data.notes?.length) {
          const notesObj = {};
          data.notes.forEach(n => notesObj[n.subjectId] = n.content);
          setNotes(notesObj);
        }
      }).catch(() => { /* fallback to localStorage data */ });
    }

  }, [booted, token, auth.user?.id]);



  useEffect(() => {

    const challenge = new URLSearchParams(window.location.search).get("challenge");

    if (!challenge) return;

    try {

      const raw = localStorage.getItem(`challenge-${challenge}`);

      if (raw) setActiveSession(JSON.parse(raw));

    } catch {

      // ignore

    }

  }, []);



  useEffect(() => {

    if (!auth.user) return;

    let active = true;

    (async () => {

      setLoadingOverlay(true);

      try {

        const rows = await api("/subjects");

        if (active) setBackendSubjects(rows);

      } catch {

        if (active) setBackendSubjects([]);

      }

      try {

        await refreshAssignments();

      } finally {

        if (active) setLoadingOverlay(false);

      }

    })();

    return () => { active = false; };

  }, [auth.user]);



  async function refreshAdmin() {

    if (!token) return;

    setAdminLoading(true);

    try {

      const [u, l] = await Promise.all([api("/users", { token }), api("/users/logins", { token })]);

      setAdminUsers(u);

      setAdminLogins(l);

    } catch {

      setAdminUsers([]);

      setAdminLogins([]);

    }

    setAdminLoading(false);

  }



  useEffect(() => {

    if (!booted) return;

    // Don't save user data when no user is logged in (prevents overwriting after logout)
    if (!auth.user) return;

    // Save auth info to shared key
    localStorage.setItem("scholars-circle-auth", JSON.stringify({ authUser: auth.user, authToken: token }));
    if (auth.user?.id || auth.user?.username) {
      localStorage.setItem("scholars-circle-current-user", auth.user.id || auth.user.username);
    }

    // Save user-specific data
    localStorage.setItem(

      storageKey("scholars-circle-state"),

      JSON.stringify({

        stats,

        history,

        wrongCounts,

        mastery,

        srData,

        assignments,

        customQuestions,

        darkMode,

        lastStudied,

        syncConfig,

        aiConfig: { provider: aiConfig.provider, model: aiConfig.model, apiKey: aiConfig.apiKey },

        notes,

        timetable,

        discussion,

        themePack,

        density,

        outlineProgress,

        customFlashcards,

        aiChatHistory,

        reminders,

        notificationPermission,

        demoMode,

        demoUsage: {
          ...demoUsage,
          demoProgress: {
            tabsVisited: Array.from(demoUsage.demoProgress.tabsVisited),
            featuresTried: Array.from(demoUsage.demoProgress.featuresTried),
            achievements: demoUsage.demoProgress.achievements,
          },
        },

      })

    );

    // Also sync to backend if logged in
    if (token) {

      syncUserDataToBackend(token, {

        progress: {

          xp: stats.xp,

          sessions: stats.sessions,

          streak: stats.streak,

          coins: stats.coins,

          weeklyGoal: stats.weeklyGoal,

          totalCorrect: stats.totalCorrect || 0,

          mastery,

          wrongCounts,

          srData,

          lastStudied,

          darkMode,

          themePack,

          density,

        },

        timetable,

      });

    }

  }, [

    stats,

    history,

    wrongCounts,

    mastery,

    srData,

    assignments,

    customQuestions,

    darkMode,

    lastStudied,

    notes,

    timetable,

    discussion,

    syncConfig,

    aiConfig.provider,

    aiConfig.model,

    auth.user,

    token,

    booted,

  ]);



  async function login() {

    setLoadingOverlay(true);

    // Trim spaces from inputs
    const trimmedUsername = (auth.username || "").trim();
    const trimmedPassword = (auth.password || "").trim();

    try {

      const data = await api("/auth/login", {

        method: "POST",

        body: { login: trimmedUsername, password: trimmedPassword },

      });

      setToken(data.token);

      setAuth((a) => ({ ...a, email: "", username: "", password: "", user: data.user, error: "", info: "" }));

      // Reset demo mode on successful backend login
      setDemoMode(false);

      // Load data from backend
      loadFromBackend();

      setLoadingOverlay(false);

      return;

    } catch {

      const hit = DEMO_USERS.find((u) => u.username === trimmedUsername && u.password === trimmedPassword);

      if (!hit) {

        setAuth((a) => ({ ...a, error: "Invalid credentials. Try backend account or demo teacher/student.", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      setAuth((a) => ({ ...a, email: "", username: "", password: "", user: { username: hit.username, role: hit.role, isActivated: hit.isActivated }, error: "", info: "" }));

      // Enable demo mode for demo users so their usage data persists
      setDemoMode(true);

      setLoadingOverlay(false);

    }

  }



  async function signup() {

    setLoadingOverlay(true);

    try {

      setAuth((a) => ({ ...a, error: "", info: "" }));

      const email = (signupEmailRef.current || "").trim();
      const username = (signupUsernameRef.current || "").trim();
      const password = (signupPasswordRef.current || "").trim();
      const confirmPassword = (signupConfirmPasswordRef.current || "").trim();
      // Get role from auth state (updated by onChange)
      const role = auth.signupRole || "STUDENT";
      const inviteCode = (signupInviteCodeRef.current || "").trim();
      
      if (password !== confirmPassword) {
        setAuth((a) => ({ ...a, error: "Passwords do not match. Please re-enter your password.", info: "" }));
        setLoadingOverlay(false);
        return;
      }
      
      console.log("Registering with:", { email, username, role });

      await api("/auth/register", {
        method: "POST",
        body: {
          email,
          username,
          password,
          role,
          inviteCode: role === "TEACHER" ? inviteCode : undefined,
        },
      });

      // auto-login after successful registration

      const data = await api("/auth/login", {
        method: "POST",
        body: { login: email, password: password },
      });

      setToken(data.token);

      setAuth((a) => ({

        ...a,

        mode: "login",

        email: "",

        username: "",

        password: "",

        signupRole: "STUDENT",

        inviteCode: "",

        user: data.user,

        error: "",

        info: "Account created successfully.",

      }));

      // Clear ALL localStorage to prevent inheriting demo data
      localStorage.clear();

      // Set only the essential auth data
      localStorage.setItem("scholars-circle-auth", JSON.stringify({ authUser: data.user, authToken: data.token }));
      localStorage.setItem("scholars-circle-current-user", data.user.id || data.user.username);

      // Reset all state to empty for new user
      setStats(EMPTY_STATS);
      setHistory([]);
      setWrongCounts({});
      setMastery({});
      setSrData({});
      setAssignments([]);
      setLastStudied(null);
      setNotes({});
      setTimetable({});
      setDiscussion({});
      setCustomQuestions([]);
      setOutlineProgress({});
      setDemoMode(false);
      setDemoUsage({
        aiMessages: 0,
        practiceQuestions: 0,
        questionBankQuestions: 0,
        flashcardReviews: 0,
        timetableSlots: 0,
        reminders: 0,
        sessionTimeMinutes: 0,
        totalSessionsUsed: 0,
        pomodoroSessions: 0,
        notesCount: 0,
        pastPapersUsed: 0,
        aiTutorMessages: 0,
        trialStartDate: null,
        demoProgress: {
          tabsVisited: new Set(),
          featuresTried: new Set(),
          achievements: [],
        },
      });

    } catch (e) {

      setAuth((a) => ({ ...a, error: e.message || "Sign up failed", info: "" }));

    }

    setLoadingOverlay(false);

  }



  function triggerCelebration(type, data) {
    setCelebration({ type, data });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    setTimeout(() => setCelebration(null), 4000);
  }

  function updateStreak() {
    const now = new Date();
    const nowKey = now.toDateString();

    if (lastStudied === nowKey) return stats.streak;

    if (!lastStudied) {
      setLastStudied(nowKey);
      return 1;
    }

    const lastDate = new Date(lastStudied);
    const diffTime = now - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let newStreak;
    if (diffDays === 1) {
      newStreak = stats.streak + 1;
    } else {
      newStreak = 1;
    }

    setLastStudied(nowKey);
    return newStreak;
  }



  function completeSession(result, sourceSubject) {

    const gained = result.score * XP_PER_CORRECT;
    const oldStreak = stats.streak;
    const newStreak = updateStreak();
    const oldXP = stats.xp;
    const newXP = oldXP + gained;
    const oldLeague = getLeague(oldXP);
    const newLeague = getLeague(newXP);

    // Update study heatmap
    const today = new Date().toISOString().split('T')[0];
    setStudyHeatmap(prev => {
      const updated = { ...prev, [today]: (prev[today] || 0) + result.score };
      localStorage.setItem("scholars-circle-heatmap", JSON.stringify(updated));
      return updated;
    });

    // Celebration triggers
    // Streak milestones
    if ([3, 7, 14, 30, 50, 100].includes(newStreak) && newStreak !== oldStreak) {
      triggerCelebration('streak', { days: newStreak, icon: newStreak >= 30 ? '🌟' : newStreak >= 14 ? '💫' : newStreak >= 7 ? '🔥' : '⚡' });
    }

    // League promotion
    if (newLeague.id !== oldLeague.id) {
      triggerCelebration('league', { league: newLeague, oldLeague });
    }

    // Perfect score
    if (result.score === result.total && result.total >= 5) {
      triggerCelebration('perfect', { score: result.score, total: result.total });
    }

    // Demo streak cap warning
    if (demoMode && newStreak >= DEMO_LIMITS.maxStreak) {
      setTimeout(() => {
        alert(`🎉 Amazing! You've reached the demo streak limit of ${DEMO_LIMITS.maxStreak} days. Upgrade to track unlimited streaks!`);
      }, 500);
    }

    const totalCorrect = stats.totalCorrect + result.score;

    const sessions = stats.sessions + 1;

    const questsDone = { ...stats.questsDone };

    if (sessions >= EMPTY_QUESTS[0].target) questsDone.q1 = true;

    if (totalCorrect >= EMPTY_QUESTS[1].target) questsDone.q2 = true;

    setStats((s) => ({

      ...s,

      xp: s.xp + gained,

      sessions,

      streak: newStreak,

      totalCorrect,

      coins: s.coins + COINS_PER_SESSION,

      questsDone,

    }));

    setHistory((h) => [

      ...h,

      {

        subjectId: sourceSubject.id,

        subjectLabel: sourceSubject.label,

        score: result.score,

        total: result.total,

        mode: result.mode,

        seconds: result.seconds,

        ts: Date.now(),

      },

    ]);

    api("/sessions", {

      token,

      method: "POST",

      body: {

        mode: result.mode,

        score: result.score,

        total: result.total,

        durationSec: result.seconds,

        answers: (result.results || []).map((r) => ({

          questionId: r.questionId || r.key,

          selected: r.selected ?? 0,

          correct: !!r.correct,

          confidence: r.confidence || null,

        })),

      },

    }).catch(() => {});

    setActiveSession(null);

  }



  function handleResetAll() {

    const ok = window.confirm("Reset will clear your progress, outlines, and notes. Continue?");

    if (!ok) return;

    setStats(EMPTY_STATS);

    setHistory([]);

    setWrongCounts({});

    setMastery({});

    setSrData({});

    setAssignments([]);

    setLastStudied(null);

    setNotes({});

    setTimetable({});

    setDiscussion([]);

    setCustomQuestions([]);

    setOutlineProgress({});

    setToken("");

    setAuth((a) => ({ ...a, user: null }));

    // Clear all localStorage data
    localStorage.removeItem("scholars-circle-auth");
    localStorage.removeItem("scholars-circle-current-user");

    // Clear user-specific state
    const uid = storageKey("scholars-circle-state");
    localStorage.removeItem(uid);

    // Clear discussion storage
    localStorage.removeItem(storageKey("scholars-circle-discussion"));

    // Clear AI assistant storage
    localStorage.removeItem("sc_ai_study_assistant_v1");

    // Clear lecture notes storage
    localStorage.removeItem("sc_lecture_notes_v1");

    // Clear notes storage
    localStorage.removeItem("sc_user_notes_v1");

    // Clear custom questions storage
    localStorage.removeItem("sc_custom_questions_v1");

    // Clear flashcards storage
    localStorage.removeItem("sc_flashcards_v1");

  }

  function logout() {
    setToken("");
    setAuth((a) => ({ ...a, mode: "login", email: "", username: "", password: "", user: null, error: "", info: "" }));
    setDemoMode(false);
    localStorage.removeItem("scholars-circle-auth");
    localStorage.removeItem("scholars-circle-current-user");
    // Clear demo mode from localStorage on logout
    const uid = storageKey("scholars-circle-state");
    const raw = localStorage.getItem(uid);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.demoMode = false;
        localStorage.setItem(uid, JSON.stringify(parsed));
      } catch {}
    }
  }

  // Sync data with backend
  async function syncData() {
    if (!token || !auth.user?.id) {
      console.log("Skipping sync - not logged in");
      return;
    }

    try {
      const syncData = {
        stats,
        mastery,
        wrongCounts,
        srData,
        lastStudied,
        timetable,
        outlineProgress,
        notes,
      };

      await api("/user-data/sync", {
        method: "POST",
        body: syncData,
      });

      console.log("Data synced successfully");
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }

  // Load data from backend on login
  async function loadFromBackend() {
    if (!token || !auth.user?.id) {
      console.log("Skipping loadFromBackend - not logged in");
      return;
    }

    try {
      const data = await api("/user-data");
      if (data.progress) {
        setStats({
          xp: data.progress.xp,
          sessions: data.progress.sessions,
          streak: data.progress.streak,
          coins: data.progress.coins,
          weeklyGoal: data.progress.weeklyGoal,
          questsDone: {},
          totalCorrect: data.progress.totalCorrect,
        });
        setMastery(data.progress.mastery || {});
        setWrongCounts(data.progress.wrongCounts || {});
        setSrData(data.progress.srData || {});
        setLastStudied(data.progress.lastStudied);
      }
      if (data.timetable) setTimetable(data.timetable);
      if (data.outlineProgress) setOutlineProgress(data.outlineProgress);
      if (data.notes) {
        const notesObj = {};
        data.notes.forEach(n => notesObj[n.subjectId] = n.content);
        setNotes(notesObj);
      }
    } catch (err) {
      console.error("Failed to load from backend:", err);
      // Don't crash the app, just log the error
    }
  }

  // Periodic background sync (temporarily disabled to prevent errors)
  useEffect(() => {
    if (!token || !auth.user?.id) return;

    // const interval = setInterval(() => {
    //   syncData();
    // }, 30000); // Sync every 30 seconds

    // return () => clearInterval(interval);
  }, [token, auth.user?.id, stats, mastery, wrongCounts, srData, lastStudied, timetable, outlineProgress, notes]);

  // PWA Install Prompt
  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
    console.log('iOS device:', isIOSDevice);

    console.log('Setting up beforeinstallprompt listener');
    const handler = (e) => {
      console.log('beforeinstallprompt event fired!', e);
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      console.log('Removing beforeinstallprompt listener');
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Service Worker update detection
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let updateCheckInterval;

    // Detect when a new service worker takes control (app updated)
    const handleControllerChange = () => {
      console.log('New service worker activated');
      setShowUpdateToast(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for updates periodically and on visibility change
    navigator.serviceWorker.ready.then((registration) => {
      // Check every 30 seconds for updates
      updateCheckInterval = setInterval(() => {
        registration.update().catch(() => {});
      }, 30 * 1000);

      // Also check when page becomes visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Check for waiting worker and show prompt
      const checkForWaiting = () => {
        if (registration.waiting) {
          setUpdatePending(true);
          setShowUpdateToast(true);
        }
      };
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New worker is waiting
              setUpdatePending(true);
              setShowUpdateToast(true);
            }
          });
        }
      });
      checkForWaiting();
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (updateCheckInterval) clearInterval(updateCheckInterval);
    };
  }, []);

  function applyUpdate() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
    // Reload after a short delay to let the new SW take control
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }

  // Push notification support
  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    return permission === 'granted';
  }

  function sendNotification(title, body, options = {}) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        ...options
      });
    }
  }

  // iOS 16+ Progress Widget support
  function updateProgressWidget() {
    if ('setAppBadge' in navigator && stats?.xp) {
      navigator.setAppBadge(stats.xp);
    }
  }

  useEffect(() => {
    updateProgressWidget();
  }, [stats?.xp]);



  const allQuestions = useMemo(

    () =>

      subjects.flatMap((s) =>

        s.questions.map((q, i) => ({

          ...q,

          subjectId: s.id,

          subjectLabel: s.label,

          subjectIcon: s.icon,

          key: `${s.id}-${i}`,

        }))

      ),

    [subjects]

  );



  const dueCards = allQuestions.filter((q) => (srData[q.key]?.due || 0) <= Date.now() && srData[q.key]);



  async function startSubjectPractice(subjectId, mode = "practice", questionCount = null, customMinutes = null) {

    const subject = subjects.find((s) => s.id === subjectId);

    if (!subject) return;

    setLoadingOverlay(true);

    let pool = subject.questions.map((q, i) => ({

      ...q,

      key: `${subject.id}-${i}`,

      subjectId: subject.id,

      subjectLabel: subject.label,

      subjectIcon: subject.icon,

    }));

    // Shuffle and limit questions if specified
    if (questionCount && questionCount !== "all") {
      pool = pool.sort(() => Math.random() - 0.5).slice(0, parseInt(questionCount));
    }

    try {

      const backendSubject = backendSubjects.find((s) => s.label === subject.label);

      if (backendSubject) {

        const rows = await api(`/questions?subjectId=${backendSubject.id}`);

        if (rows.length >= 5) {

          pool = rows.map((q) => ({

            q: q.question,

            options: [q.optionA, q.optionB, q.optionC, q.optionD],

            answer: q.answerIndex,

            explanation: q.explanation || "",

            difficulty: q.difficulty || "medium",

            key: q.id,

            questionId: q.id,

            subjectId: subject.id,

            subjectLabel: subject.label,

            subjectIcon: subject.icon,

          }));

          // Shuffle and limit backend questions too
          if (questionCount && questionCount !== "all") {
            pool = pool.sort(() => Math.random() - 0.5).slice(0, parseInt(questionCount));
          }

        }

      }

    } catch {

      // fallback to local question bank

    }

    setLoadingOverlay(false);

    if (demoMode && demoUsage.practiceQuestions >= DEMO_LIMITS.practiceQuestions) {
      alert(`Demo limit reached: You've used ${DEMO_LIMITS.practiceQuestions} practice questions. Register for full access.`);
      return;
    }

    const autoMinutes = Math.max(10, Math.round((pool.length * 90) / 60));
    const totalSeconds = mode === "exam" ? (customMinutes ? customMinutes * 60 : autoMinutes * 60) : null;

    setActiveSession({ mode, source: subject, questions: pool, totalSeconds });

    if (demoMode) {
      setDemoUsage(prev => ({ ...prev, practiceQuestions: prev.practiceQuestions + 1 }));
    }

  }



  function startDiagnostic() {

    if (demoMode && demoUsage.practiceQuestions >= DEMO_LIMITS.practiceQuestions) {
      alert(`Demo limit reached: You've used ${DEMO_LIMITS.practiceQuestions} practice questions. Register for full access.`);
      return;
    }

    const questions = SUBJECTS.map((s) => {

      const q = s.questions[0];

      return { ...q, key: `${s.id}-0`, subjectId: s.id, subjectLabel: s.label, subjectIcon: s.icon };

    });

    setActiveSession({ mode: "diagnostic", source: { id: "diagnostic", label: "Diagnostic", icon: "🧪" }, questions });

    if (demoMode) {
      setDemoUsage(prev => ({ ...prev, practiceQuestions: prev.practiceQuestions + 1 }));
    }

  }



  function startAdaptive() {

    const picked = [];

    const seen = new Set();

    while (picked.length < Math.min(8, allQuestions.length)) {

      const candidate = pickAdaptiveQuestion(allQuestions, wrongCounts, mastery);

      if (!seen.has(candidate.key)) {

        picked.push(candidate);

        seen.add(candidate.key);

      }

    }

    setActiveSession({ mode: "adaptive", source: { id: "adaptive", label: "Adaptive", icon: "🎯" }, questions: picked });

  }



  function startSpacedReview() {

    let cardsToReview = dueCards;
    if (demoMode && dueCards.length > DEMO_LIMITS.maxSpacedReviewCards) {
      cardsToReview = dueCards.slice(0, DEMO_LIMITS.maxSpacedReviewCards);
      setTimeout(() => {
        alert(`Demo: Limited to ${DEMO_LIMITS.maxSpacedReviewCards} spaced review cards. Upgrade for unlimited reviews!`);
      }, 300);
    }

    setActiveSession({

      mode: "spaced",

      source: { id: "spaced", label: "Spaced Review", icon: "🧠" },

      questions: cardsToReview,

    });

  }



  function startWeakDrill() {

    const weak = allQuestions.filter((q) => (wrongCounts[q.key] || 0) > 0);

    setActiveSession({ mode: "weak", source: { id: "weak", label: "Weak Drill", icon: "⚔️" }, questions: weak });

  }



  function startErrorDrill() {

    const wrongs = allQuestions.filter((q) => (wrongCounts[q.key] || 0) > 0).slice(0, 12);

    if (!wrongs.length) return alert("No wrong answers yet. Practice first!");

    setActiveSession({ mode: "error", source: { id: "error", label: "Error Drill", icon: "🔁" }, questions: wrongs, totalSeconds: wrongs.length * 60 });

  }



  function updateLearningModels(results) {

    const nextWrong = { ...wrongCounts };

    const nextMastery = { ...mastery };

    const nextSr = { ...srData };

    results.forEach((r) => {

      if (!r.correct) nextWrong[r.key] = (nextWrong[r.key] || 0) + 1;

      else nextWrong[r.key] = Math.max((nextWrong[r.key] || 0) - 1, 0);

      const current = nextMastery[r.subjectId] ?? 50;

      nextMastery[r.subjectId] = Math.max(0, Math.min(100, current + (r.correct ? 8 : -6)));

      const prev = nextSr[r.key] || { interval: 1, ease: 2.5 };

      const interval = r.correct ? Math.round(prev.interval * prev.ease) : 1;

      const ease = Math.max(1.3, Math.min(3, prev.ease + (r.correct ? 0.1 : -0.2)));

      nextSr[r.key] = { interval, ease, due: Date.now() + interval * 86400000 };

    });

    setWrongCounts(nextWrong);

    setMastery(nextMastery);

    setSrData(nextSr);

  }



  async function syncToCloud() {

    if (!syncConfig.url || !syncConfig.key) {

      setSyncStatus("Set Supabase URL and Key first.");

      return;

    }

    try {

      const supabase = createClient(syncConfig.url, syncConfig.key);

      const payload = {

        user_id: syncConfig.userId,

        payload: { stats, history, wrongCounts, mastery, srData, assignments, lastStudied },

      };

      const { error } = await supabase.from("learning_profiles").upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      setSyncStatus("Synced to cloud successfully.");

    } catch (e) {

      setSyncStatus(`Sync failed: ${e.message}`);

    }

  }



  async function pullFromCloud() {

    if (!syncConfig.url || !syncConfig.key) {

      setSyncStatus("Set Supabase URL and Key first.");

      return;

    }

    try {

      const supabase = createClient(syncConfig.url, syncConfig.key);

      const { data, error } = await supabase

        .from("learning_profiles")

        .select("payload")

        .eq("user_id", syncConfig.userId)

        .maybeSingle();

      if (error) throw error;

      if (!data?.payload) {

        setSyncStatus("No cloud profile found for this user_id.");

        return;

      }

      setStats(data.payload.stats ?? EMPTY_STATS);

      setHistory(data.payload.history ?? []);

      setWrongCounts(data.payload.wrongCounts ?? {});

      setMastery(data.payload.mastery ?? {});

      setSrData(data.payload.srData ?? {});

      setAssignments(data.payload.assignments ?? []);

      setLastStudied(data.payload.lastStudied ?? null);

      setSyncStatus("Pulled latest cloud data.");

    } catch (e) {

      setSyncStatus(`Pull failed: ${e.message}`);

    }

  }



  async function refreshAssignments() {

    if (!token) return;

    try {

      const rows = await api("/assignments", { token });

      setAssignments(rows);

    } catch {

      // keep local fallback

    }

  }



  if (!auth.user) {

    return (

      <main className={darkMode ? "app dark" : "app light"}>

        {loadingOverlay && (

          <div className="loading-overlay">

            <img src="/loading.png" alt="Loading" className="loading-logo" />

            <span className="loading-text">Loading…</span>

          </div>

        )}

        {/* PWA Update Toast */}
        {showUpdateToast && (
          <div style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1e293b",
            color: "white",
            padding: "12px 20px",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 14,
            maxWidth: 400,
            border: "1px solid rgba(59,130,246,0.3)"
          }}>
            <span>🔄</span>
            <span style={{ flex: 1 }}>
              {updatePending ? "A new version is available!" : "App updated. Refresh to see changes."}
            </span>
            <button
              onClick={() => {
                if (updatePending) {
                  applyUpdate();
                } else {
                  window.location.reload();
                }
              }}
              style={{
                background: "#3b82f6",
                color: "white",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap"
              }}
            >
              {updatePending ? "Update Now" : "Reload"}
            </button>
            <button
              onClick={() => setShowUpdateToast(false)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 18,
                padding: 0
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
            <h2 style={{ margin: 0, fontSize: 24 }}>Scholar's Circle</h2>
            <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 13 }}>Your personal learning companion</p>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setAuth((a) => ({ ...a, mode: "login", error: "", info: "" }))}
              disabled={auth.mode === "login"}
              style={{ flex: 1 }}
            >
              Login
            </button>
            <button
              onClick={() => setAuth((a) => ({ ...a, mode: "signup", error: "", info: "" }))}
              disabled={auth.mode === "signup"}
              style={{ flex: 1 }}
            >
              Sign Up
            </button>
          </div>

          {auth.mode === "signup" ? (

            <>

              <p className="muted">Create your account to start learning.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                <input
                  ref={signupEmailRef}
                  onChange={(e) => { signupEmailRef.current = e.target.value.replace(/\s/g, ""); }}
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                />

                <input
                  ref={signupUsernameRef}
                  onChange={(e) => { signupUsernameRef.current = e.target.value.replace(/\s/g, ""); }}
                  placeholder="Username"
                  autoComplete="username"
                />

                <div style={{ position: "relative" }}>
                  <input
                    ref={signupPasswordRef}
                    type={showSignupPassword ? "text" : "password"}
                    onChange={(e) => { signupPasswordRef.current = e.target.value; }}
                    placeholder="Password (min 6 characters)"
                    autoComplete="new-password"
                    style={{ width: "100%", paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 18,
                      padding: 4
                    }}
                    tabIndex={-1}
                  >
                    {showSignupPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                <div style={{ position: "relative" }}>
                  <input
                    ref={signupConfirmPasswordRef}
                    type={showSignupConfirmPassword ? "text" : "password"}
                    onChange={(e) => { signupConfirmPasswordRef.current = e.target.value; }}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    style={{ width: "100%", paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupConfirmPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 18,
                      padding: 4
                    }}
                    tabIndex={-1}
                  >
                    {showSignupConfirmPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                <select ref={signupRoleRef} onChange={(e) => { setAuth((a) => ({ ...a, signupRole: e.target.value })); }} defaultValue="STUDENT">
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">Teacher</option>
                </select>

                {auth.signupRole === "TEACHER" && (
                  <input
                    ref={signupInviteCodeRef}
                    onChange={(e) => { signupInviteCodeRef.current = e.target.value.replace(/\s/g, ""); }}
                    placeholder="Teacher invite code"
                  />
                )}

                <button onClick={signup} style={{ marginTop: 4 }}>Create Account</button>

              </div>

            </>

          ) : (

            <>

              <p className="muted">Welcome back! Log in to continue your learning journey.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                <input
                  value={auth.username}
                  onChange={(e) => setAuth((a) => ({ ...a, username: e.target.value.replace(/\s/g, "") }))}
                  placeholder="Email or username"
                  autoComplete="username"
                />

                <div style={{ position: "relative" }}>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={auth.password}
                    onChange={(e) => setAuth((a) => ({ ...a, password: e.target.value }))}
                    placeholder="Password"
                    autoComplete="current-password"
                    style={{ width: "100%", paddingRight: 40 }}
                    onKeyDown={(e) => { if (e.key === "Enter") login(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 18,
                      padding: 4
                    }}
                    tabIndex={-1}
                  >
                    {showLoginPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                <button onClick={login} style={{ marginTop: 4 }}>Login</button>

              </div>

            </>

          )}

          {auth.info && (
            <div style={{ marginTop: 16, padding: 12, background: "rgba(52,211,153,0.1)", borderRadius: 8, border: "1px solid rgba(52,211,153,0.3)" }}>
              <p style={{ margin: 0, color: "#34d399", fontSize: 13 }}>{auth.info}</p>
            </div>
          )}

          {auth.error && (
            <div style={{ marginTop: 16, padding: 12, background: "rgba(248,113,113,0.1)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)" }}>
              <p style={{ margin: 0, color: "#f87171", fontSize: 13 }}>{auth.error}</p>
            </div>
          )}

          {/* Customer Support Section */}
          <div style={{ marginTop: 24, padding: 16, background: "rgba(148,163,184,0.08)", borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)" }}>
            <p style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600 }}>Need Help?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a
                href="https://wa.link/yj2em4?text=Hi%20Scholar's%20Circle%20team,%20I%20need%20help%20with%20my%20account."
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#25D366",
                  color: "white",
                  textDecoration: "none",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  justifyContent: "center"
                }}
              >
                💬 Chat on WhatsApp
              </a>
              <a
                href="tel:09028617178"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#3b82f6",
                  color: "white",
                  textDecoration: "none",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  justifyContent: "center"
                }}
              >
                📞 Call: 09028617178
              </a>
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>
              Having trouble logging in or signing up? Reach out and we'll help you right away.
            </p>
          </div>

          <p className="muted" style={{ marginTop: "20px", fontSize: "12px", textAlign: "center" }}>
            By using this app, you agree to our <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </p>

        </div>

      </main>

    );

  }

  // Gate: non-activated students see locked screen
  if (auth.user && !isActivated && !demoMode) {
    return (
      <main className={darkMode ? "app dark" : "app light"}>
        {/* PWA Update Toast */}
        {showUpdateToast && (
          <div style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1e293b",
            color: "white",
            padding: "12px 20px",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 14,
            maxWidth: 400,
            border: "1px solid rgba(59,130,246,0.3)"
          }}>
            <span>🔄</span>
            <span style={{ flex: 1 }}>
              {updatePending ? "A new version is available!" : "App updated. Refresh to see changes."}
            </span>
            <button
              onClick={() => {
                if (updatePending) {
                  applyUpdate();
                } else {
                  window.location.reload();
                }
              }}
              style={{
                background: "#3b82f6",
                color: "white",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap"
              }}
            >
              {updatePending ? "Update Now" : "Reload"}
            </button>
            <button
              onClick={() => setShowUpdateToast(false)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 18,
                padding: 0
              }}
            >
              ✕
            </button>
          </div>
        )}
        <LockedScreen
          activationKey={auth.user.activationKey}
          username={auth.user.username}
          onLogout={logout}
          onTryDemo={() => setDemoMode(true)}
        />
      </main>
    );
  }

  if (activeSession && activeSession.mode !== "practicehints") {

    return (

      <main className={darkMode ? "app dark" : "app light"}>

        {loadingOverlay && (

          <div className="loading-overlay">

            <img src="/loading.png" alt="Loading" className="loading-logo" />

            <span className="loading-text">Loading…</span>

          </div>

        )}

        {/* PWA Update Toast */}
        {showUpdateToast && (
          <div style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1e293b",
            color: "white",
            padding: "12px 20px",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 14,
            maxWidth: 400,
            border: "1px solid rgba(59,130,246,0.3)"
          }}>
            <span>🔄</span>
            <span style={{ flex: 1 }}>
              {updatePending ? "A new version is available!" : "App updated. Refresh to see changes."}
            </span>
            <button
              onClick={() => {
                if (updatePending) {
                  applyUpdate();
                } else {
                  window.location.reload();
                }
              }}
              style={{
                background: "#3b82f6",
                color: "white",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap"
              }}
            >
              {updatePending ? "Update Now" : "Reload"}
            </button>
            <button
              onClick={() => setShowUpdateToast(false)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 18,
                padding: 0
              }}
            >
              ✕
            </button>
          </div>
        )}

        <SessionPlayer

          session={activeSession}

          aiConfig={aiConfig}

          onExit={() => setActiveSession(null)}

          onComplete={(result) => {

            updateLearningModels(result.results);

            completeSession(result, activeSession.source);

          }}

        />

      </main>

    );

  }



  return (

    <main className={`${darkMode ? "app dark" : "app light"} theme-${themePack} density-${density}`}>

      {showOnboarding && (

        <OnboardingWizard

          subjects={subjects}

          onSkip={() => { markOnboarded(); setShowOnboarding(false); }}

          onComplete={(data) => {

            setShowOnboarding(false);

            setTab("today");

            try {

              const k = "sc_onboarding_data_v1";

              localStorage.setItem(k, JSON.stringify({ ...data, ts: Date.now() }));

            } catch { /* ignore */ }

          }}

        />

      )}

      {loadingOverlay && (

        <div className="loading-overlay">

          <img src="/loading.png" alt="Loading" className="loading-logo" />

          <span className="loading-text">Loading…</span>

        </div>

      )}

      {/* Confetti Celebration */}
      {showConfetti && <ConfettiOverlay />}

      {/* Celebration Toast */}
      {celebration && (
        <CelebrationToast celebration={celebration} onClose={() => setCelebration(null)} />
      )}

      {/* Streak Loss Warning */}
      <StreakLossWarning streak={stats.streak} lastStudied={lastStudied} />

      {/* PWA Update Toast */}
      {showUpdateToast && (
        <div style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1e293b",
          color: "white",
          padding: "12px 20px",
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 14,
          maxWidth: 400,
          border: "1px solid rgba(59,130,246,0.3)"
        }}>
          <span>🔄</span>
          <span style={{ flex: 1 }}>
            {updatePending ? "A new version is available!" : "App updated. Refresh to see changes."}
          </span>
          <button
            onClick={() => {
              if (updatePending) {
                applyUpdate();
              } else {
                window.location.reload();
              }
            }}
            style={{
              background: "#3b82f6",
              color: "white",
              border: "none",
              padding: "6px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap"
            }}
          >
            {updatePending ? "Update Now" : "Reload"}
          </button>
          <button
            onClick={() => setShowUpdateToast(false)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 18,
              padding: 0
            }}
          >
            ✕
          </button>
        </div>
      )}

      {showTimeWarning && demoMode && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: "rgba(239,68,68,0.95)",
          color: "white",
          padding: 16,
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 1000,
          maxWidth: 300
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>⏰ Time Limit Warning</div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            You've used {demoUsage.sessionTimeMinutes} of {DEMO_LIMITS.dailyTimeLimit} daily minutes. Upgrade for unlimited time.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowTimeWarning(false)}
              style={{ flex: 1, background: "rgba(255,255,255,0.2)", color: "white", border: "none", padding: "8px", borderRadius: 4, cursor: "pointer" }}
            >
              Dismiss
            </button>
            <button
              onClick={() => { setShowTimeWarning(false); setShowPaymentModal(true); }}
              style={{ flex: 1, background: "white", color: "#ef4444", border: "none", padding: "8px", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {showDemoSummary && demoMode && (
        <div className="modal-overlay" onClick={() => setShowDemoSummary(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>📊 Demo Summary</h3>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "rgba(59,130,246,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{demoUsage.demoProgress.achievements.length}/{DEMO_ACHIEVEMENTS.length}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Achievements</div>
                </div>
                <div style={{ background: "rgba(52,211,153,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#34d399" }}>{demoUsage.demoProgress.tabsVisited.size}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Tabs Visited</div>
                </div>
                <div style={{ background: "rgba(250,204,21,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#facc15" }}>{demoUsage.practiceQuestions}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Questions</div>
                </div>
                <div style={{ background: "rgba(168,85,247,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#a855f7" }}>{demoUsage.sessionTimeMinutes}m</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Study Time</div>
                </div>
              </div>
              <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>🎁 What You'll Get with Full Version:</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                  <li>Unlimited practice questions & AI messages</li>
                  <li>Advanced analytics & confidence heatmap</li>
                  <li>Full subject library (all courses)</li>
                  <li>No time limits - study as much as you want</li>
                  <li>Export your data & progress</li>
                  <li>Priority support & new features</li>
                </ul>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDemoSummary(false)}
                style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 6, cursor: "pointer" }}
              >
                Continue Demo
              </button>
              <button
                onClick={() => { setShowDemoSummary(false); setShowPaymentModal(true); }}
                style={{ background: "#3b82f6", color: "white", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>💳 Upgrade Your Account</h3>
            
            <div style={{ marginBottom: 20 }}>
              <p className="muted" style={{ marginBottom: 16 }}>Choose a plan that works for you:</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  onClick={() => setSelectedPlan("week1")}
                  style={{
                    border: selectedPlan === "week1" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    background: selectedPlan === "week1" ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.05)",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>1 Week Plan</div>
                      <div className="muted" style={{ fontSize: 12 }}>Perfect for trying out</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>₦700</div>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedPlan("week2")}
                  style={{
                    border: selectedPlan === "week2" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    background: selectedPlan === "week2" ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.05)",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>2 Weeks Plan</div>
                      <div className="muted" style={{ fontSize: 12 }}>Save ₦100</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>₦1,300</div>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedPlan("month1")}
                  style={{
                    border: selectedPlan === "month1" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    background: selectedPlan === "month1" ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.05)",
                    transition: "all 0.2s",
                    position: "relative"
                  }}
                >
                  <div style={{ position: "absolute", top: -10, right: 10, background: "#10b981", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>BEST VALUE</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>1 Month Plan</div>
                      <div className="muted" style={{ fontSize: 12 }}>Save ₦400</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>₦2,400</div>
                  </div>
                </div>
              </div>
            </div>

            {selectedPlan && (
              <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>🏦 Payment Details</h4>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <div><strong>Bank:</strong> Opay</div>
                  <div><strong>Account Number:</strong> 9069372522</div>
                  <div><strong>Account Name:</strong> Zibiri-David Delight Aluaye</div>
                  <div><strong>Amount:</strong> {selectedPlan === "week1" ? "₦700" : selectedPlan === "week2" ? "₦1,300" : "₦2,400"}</div>
                </div>
              </div>
            )}

            {selectedPlan && (
              <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>📱 After Payment</h4>
                <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                  Send a screenshot of your payment receipt along with your activation key to our WhatsApp:
                </p>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>Your Activation Key:</strong>
                </div>
                <div style={{
                  fontFamily: "monospace",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fbbf24",
                  letterSpacing: 2,
                  background: "rgba(0,0,0,0.3)",
                  padding: "8px 12px",
                  borderRadius: 6,
                  textAlign: "center",
                  marginBottom: 12
                }}>
                  {auth.user?.activationKey || "Log in to see your key"}
                </div>
                <a
                  href={`https://wa.link/yj2em4?text=${encodeURIComponent(`Hi, I've made a payment for ${selectedPlan === "week1" ? "1 week" : selectedPlan === "week2" ? "2 weeks" : "1 month"} plan. My activation key is: ${auth.user?.activationKey || "N/A"}. Here's my payment proof:`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "#25D366",
                    color: "white",
                    textDecoration: "none",
                    padding: "12px",
                    borderRadius: 8,
                    fontWeight: 600,
                    transition: "transform 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                  onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  💬 Send Payment Proof on WhatsApp
                </a>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDemoSummary && demoMode && (
        <div className="modal-overlay" onClick={() => setShowDemoSummary(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>📊 Demo Summary</h3>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "rgba(59,130,246,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{demoUsage.demoProgress.achievements.length}/{DEMO_ACHIEVEMENTS.length}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Achievements</div>
                </div>
                <div style={{ background: "rgba(52,211,153,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#34d399" }}>{demoUsage.demoProgress.tabsVisited.size}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Tabs Visited</div>
                </div>
                <div style={{ background: "rgba(250,204,21,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#facc15" }}>{demoUsage.practiceQuestions}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Questions</div>
                </div>
                <div style={{ background: "rgba(168,85,247,0.1)", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#a855f7" }}>{demoUsage.sessionTimeMinutes}m</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Study Time</div>
                </div>
              </div>
              <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>🎁 What You'll Get with Full Version:</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                  <li>Unlimited practice questions & AI messages</li>
                  <li>Advanced analytics & confidence heatmap</li>
                  <li>Full subject library (all courses)</li>
                  <li>No time limits - study as much as you want</li>
                  <li>Export your data & progress</li>
                  <li>Priority support & new features</li>
                </ul>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDemoSummary(false)}
                style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 6, cursor: "pointer" }}
              >
                Continue Demo
              </button>
              <button
                onClick={() => { setShowDemoSummary(false); setShowPaymentModal(true); }}
                style={{ background: "#3b82f6", color: "white", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      <AchievementNotification stats={stats} history={history} subjects={subjects} mastery={mastery} />

      {showExpirationWarning && demoMode && demoUsage.trialStartDate && (
        <div style={{
          position: "fixed",
          top: 20,
          left: 20,
          right: 20,
          zIndex: 1000,
          background: "rgba(234,179,8,0.95)",
          border: "2px solid #eab308",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>⏳</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Trial Expiring Soon</div>
              <div style={{ fontSize: 13 }}>
                Your {DEMO_LIMITS.trialDays}-day trial expires in {Math.max(0, Math.ceil(DEMO_LIMITS.trialDays - (Date.now() - demoUsage.trialStartDate) / (1000 * 60 * 60 * 24)))} days. Upgrade now to keep your progress!
              </div>
            </div>
            <button
              onClick={() => setShowExpirationWarning(false)}
              style={{ background: "white", color: "#eab308", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showDemoTour && demoMode && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div style={{
            background: darkMode ? "#1a1d2d" : "#ffffff",
            color: darkMode ? "white" : "black",
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🎓</div>
            <h3 style={{ margin: "0 0 12px 0" }}>Welcome to Demo Mode!</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20, opacity: 0.8 }}>
              Explore Scholar's Circle with limited access. Try different features to unlock demo achievements and see what the full version offers.
            </p>
            <div style={{ background: "rgba(59,130,246,0.1)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Quick Tips:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.6 }}>
                <li>Visit different tabs to earn achievements</li>
                <li>Complete practice sessions to track progress</li>
                <li>Use AI Tutor to explore smart learning</li>
                <li>Check Settings to view your demo progress</li>
              </ul>
            </div>
            <button
              onClick={() => setShowDemoTour(false)}
              style={{ width: "100%", background: "#3b82f6", color: "white", border: "none", padding: "12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              Start Exploring
            </button>
          </div>
        </div>
      )}

      <div className="hero-banner">

        <img

          src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1800&q=80"

          alt="Students learning together"

          loading="lazy"

        />

        <div className="hero-overlay">

          <h2>Learn smarter, practice deeper</h2>

          <p>Interactive study, adaptive quizzes, spaced review, and class-ready learning.</p>

        </div>

      </div>

      <header className="topbar">

        <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>

          <h1 style={{ margin: 0, flex: "1 1 auto" }}>The Scholar&apos;s Circle</h1>

          <select value={themePack} onChange={(e) => setThemePack(e.target.value)} style={{ minWidth: 120 }}>

            <option value="aurora">Aurora</option>

            <option value="paper">Paper</option>

            <option value="neon">Neon</option>

          </select>

          <button onClick={() => setDensity((d) => d === "cozy" ? "compact" : "cozy")}>

            Density: {density === "cozy" ? "Cozy" : "Compact"}

          </button>

          <button onClick={() => setShowPalette(true)} title="Ctrl/Cmd+K">⌘K Palette</button>

          <button onClick={() => setDarkMode((v) => !v)} style={{ fontSize: 18, border: "none", background: "transparent", cursor: "pointer" }}>

            {darkMode ? "🌙" : "☀️"}

          </button>

          {deferredPrompt && !isIOS && (
            <button
              onClick={handleInstallClick}
              style={{
                background: "#818cf8",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600
              }}
            >
              📱 Install App
            </button>
          )}

          {isIOS && (
            <button
              onClick={() => {
                alert("To install on iOS:\n\n1. Tap the Share button (box with arrow) at the bottom\n2. Scroll down and tap 'Add to Home Screen'\n3. Tap 'Add' in the top right");
              }}
              style={{
                background: "#818cf8",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600
              }}
            >
              📱 Install App
            </button>
          )}

          {!deferredPrompt && !isIOS && (
            <button
              onClick={() => {
                console.log("PWA not installable yet. Check console for details.");
                alert("PWA install not available. Make sure you're on HTTPS or localhost, and the service worker is registered.");
              }}
              style={{
                background: "#374151",
                color: "#9ca3af",
                border: "none",
                padding: "6px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600
              }}
            >
              📱 Install (N/A)
            </button>
          )}

        </div>

        <p className="muted">

          {auth.user.username} ({auth.user.role}) | XP <strong>{stats.xp}</strong> | Sessions <strong>{stats.sessions}</strong> | Streak{" "}

          <strong>{stats.streak}</strong> | Coins <strong>{stats.coins}</strong>

          {" | "}

          Badges <strong>{BADGES.filter(b => b.check(stats, history, subjects, mastery)).length}</strong>/{BADGES.length}
          {demoMode && (
            <span style={{ color: "#facc15", marginLeft: 8, fontWeight: 600 }}>
              <span style={{ background: "#facc15", color: "#000", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>DEMO</span>
              {" | "}
              AI: {demoUsage.aiMessages}/{DEMO_LIMITS.aiMessages}
              {" | "}
              Quiz: {demoUsage.practiceQuestions}/{DEMO_LIMITS.practiceQuestions}
              {" | "}
              Time: {demoUsage.sessionTimeMinutes}/{DEMO_LIMITS.dailyTimeLimit}min
              {" | "}
              Streak: {Math.min(stats.streak, DEMO_LIMITS.maxStreak)}{stats.streak >= DEMO_LIMITS.maxStreak ? "⭐" : ""}
              {demoUsage.trialStartDate && (
                <>
                  {" | "}
                  Days left: {Math.max(0, DEMO_LIMITS.trialDays - Math.ceil((Date.now() - demoUsage.trialStartDate) / (1000 * 60 * 60 * 24)))}
                </>
              )}
            </span>
          )}

        </p>

      </header>



      <div className="search-bar-wrap">

        <div className="row" style={{ gap: 8 }}>
          <button
            onClick={() => setGlobalSearchOpen(false)}
            style={{
              padding: "8px 12px",
              background: !globalSearchOpen ? "#818cf8" : "#374151",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            Subjects
          </button>
          <button
            onClick={() => setGlobalSearchOpen(true)}
            style={{
              padding: "8px 12px",
              background: globalSearchOpen ? "#818cf8" : "#374151",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            Global
          </button>
          <input

            className="search-bar"

            placeholder={globalSearchOpen ? "🔍 Search notes, questions, flashcards, lectures…" : "🔍 Search subjects, lessons or questions…"}

            value={searchQuery}

            onChange={(e) => setSearchQuery(e.target.value)}

            style={{ flex: 1 }}

          />

          {searchQuery.trim() && (

            <button style={{ marginLeft: 6 }} onClick={() => setSearchQuery("")}>✕</button>

          )}
        </div>

      </div>

      {searchQuery.trim() && !globalSearchOpen && (

        <SearchResults query={searchQuery} subjects={subjects} onStart={(id) => { startSubjectPractice(id); setSearchQuery(""); }} />

      )}

      {searchQuery.trim() && globalSearchOpen && (
        <div className="card" style={{ marginTop: 8, maxHeight: 400, overflowY: "auto" }}>
          <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {["all", "notes", "questions", "flashcards", "lectures"].map((filter) => (
              <button
                key={filter}
                onClick={() => setGlobalSearchFilter(filter)}
                style={{
                  background: globalSearchFilter === filter ? "#818cf8" : "#374151",
                  color: "white",
                  padding: "4px 10px",
                  fontSize: 11,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer"
                }}
              >
                {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          <GlobalSearchDropdown query={searchQuery} filter={globalSearchFilter} subjects={subjects} />
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        <button
          className={tab === "dashboard" ? "active" : ""}
          onClick={() => setTab("dashboard")}
          title="Home"
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button
          className={tab === "practice" ? "active" : ""}
          onClick={() => setTab("practice")}
          title="Practice"
        >
          <span className="nav-icon">📝</span>
          <span className="nav-label">Practice</span>
        </button>
        <button
          className={tab === "aiassistant" ? "active" : ""}
          onClick={() => setTab("aiassistant")}
          title="AI Assistant"
        >
          <span className="nav-icon">🤖</span>
          <span className="nav-label">AI</span>
        </button>
        <button
          className={tab === "planner" ? "active" : ""}
          onClick={() => setTab("planner")}
          title="Planner"
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Plan</span>
        </button>
        <button
          className={`more-btn ${["settings", "analytics", "flashcards", "notes", "timetable", "achievements", "reminders", "pomodoro", "leaderboard", "studygroups", "discuss", "cheatsheet", "outline", "bank", "classroom", "pastpapers", "lectures", "learn", "studypaths", "today", "aitutor", ...(isTeacher ? ["keys", "admin"] : [])].includes(tab) ? "has-active" : ""}`}
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          title="More"
        >
          <span className="nav-icon">{showMobileMenu ? "✕" : "☰"}</span>
          <span className="nav-label">More</span>
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-grid">
              <button className={tab === "today" ? "active" : ""} onClick={() => { setTab("today"); setShowMobileMenu(false); }}>
                <span>📆</span> Today
              </button>
              <button className={tab === "studypaths" ? "active" : ""} onClick={() => { setTab("studypaths"); setShowMobileMenu(false); }}>
                <span>🛤️</span> Study Paths
              </button>
              <button className={tab === "learn" ? "active" : ""} onClick={() => { setTab("learn"); setShowMobileMenu(false); }}>
                <span>📚</span> Learn
              </button>
              <button className={tab === "practicehints" ? "active" : ""} onClick={() => { setTab("practicehints"); setShowMobileMenu(false); }}>
                <span>💡</span> Hints
              </button>
              <button className={tab === "lectures" ? "active" : ""} onClick={() => { setTab("lectures"); setShowMobileMenu(false); }}>
                <span>🎓</span> Lectures
              </button>
              <button className={tab === "pastpapers" ? "active" : ""} onClick={() => { setTab("pastpapers"); setShowMobileMenu(false); }}>
                <span>📄</span> Past Papers
              </button>
              {!demoMode && (
                <button className={tab === "classroom" ? "active" : ""} onClick={() => { setTab("classroom"); setShowMobileMenu(false); }}>
                  <span>🏫</span> Classroom
                </button>
              )}
              <button className={tab === "bank" ? "active" : ""} onClick={() => { setTab("bank"); setShowMobileMenu(false); }}>
                <span>🏦</span> Question Bank
              </button>
              <button className={tab === "analytics" ? "active" : ""} onClick={() => { setTab("analytics"); setShowMobileMenu(false); }}>
                <span>📊</span> Stats
              </button>
              <button className={tab === "outline" ? "active" : ""} onClick={() => { setTab("outline"); setShowMobileMenu(false); }}>
                <span>📋</span> Outline
              </button>
              {isTeacher && (
                <>
                  <button className={tab === "keys" ? "active" : ""} onClick={() => { setTab("keys"); setShowMobileMenu(false); }}>
                    <span>🔑</span> Keys
                  </button>
                  <button className={tab === "admin" ? "active" : ""} onClick={() => { setTab("admin"); setShowMobileMenu(false); }}>
                    <span>⚙️</span> Admin
                  </button>
                </>
              )}
              <button className={tab === "flashcards" ? "active" : ""} onClick={() => { setTab("flashcards"); setShowMobileMenu(false); }}>
                <span>🃏</span> Flashcards
              </button>
              <button className={tab === "aitutor" ? "active" : ""} onClick={() => { setTab("aitutor"); setShowMobileMenu(false); }}>
                <span>👨‍🏫</span> AI Tutor
              </button>
              <button className={tab === "reminders" ? "active" : ""} onClick={() => { setTab("reminders"); setShowMobileMenu(false); }}>
                <span>🔔</span> Reminders
              </button>
              {!demoMode && (
                <>
                  <button className={tab === "leaderboard" ? "active" : ""} onClick={() => { setTab("leaderboard"); setShowMobileMenu(false); }}>
                    <span>🏆</span> Leaderboard
                  </button>
                  <button className={tab === "studygroups" ? "active" : ""} onClick={() => { setTab("studygroups"); setShowMobileMenu(false); }}>
                    <span>👥</span> Groups
                  </button>
                </>
              )}
              <button className={tab === "pomodoro" ? "active" : ""} onClick={() => { setTab("pomodoro"); setShowMobileMenu(false); }}>
                <span>⏱️</span> Timer
              </button>
              <button className={tab === "notes" ? "active" : ""} onClick={() => { setTab("notes"); setShowMobileMenu(false); }}>
                <span>📝</span> Notes
              </button>
              <button className={tab === "achievements" ? "active" : ""} onClick={() => { setTab("achievements"); setShowMobileMenu(false); }}>
                <span>🏅</span> Achievements
              </button>
              <button className={tab === "timetable" ? "active" : ""} onClick={() => { setTab("timetable"); setShowMobileMenu(false); }}>
                <span>🗓️</span> Timetable
              </button>
              <button className={tab === "cheatsheet" ? "active" : ""} onClick={() => { setTab("cheatsheet"); setShowMobileMenu(false); }}>
                <span>📄</span> Cheat Sheet
              </button>
              <button className={tab === "discuss" ? "active" : ""} onClick={() => { setTab("discuss"); setShowMobileMenu(false); }}>
                <span>💬</span> Discuss
              </button>
              <button className={tab === "settings" ? "active" : ""} onClick={() => { setTab("settings"); setShowMobileMenu(false); }}>
                <span>⚙️</span> Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Tabs Navigation */}
      <nav className="tabs desktop-tabs">

        {[

          ["today", "Today"],

          ["dashboard", "Home"],

          ["studypaths", "Study Paths"],

          ["learn", "Learn"],

          ["practice", "Practice"],

          ["practicehints", "Practice with Hints"],

          ["lectures", "Lecture Notes"],

          ["pastpapers", "Past Papers"],

          ["classroom", "Classroom"],

          ["bank", "Question Bank"],

          ["planner", "Planner"],

          ["analytics", "Stats"],

          ["outline", "Course Outline"],

          ...(isTeacher ? [["keys", "🔑 Keys"], ["admin", "Admin"]] : []),

          ["flashcards", "Flashcards"],

          ["aiassistant", "AI Study Assistant"],

          ["aitutor", "AI Tutor"],

          ["reminders", "Reminders"],

          ["leaderboard", "Leaderboard"],

          ["studygroups", "Study Groups"],

          ["pomodoro", "Timer"],

          ["notes", "Notes"],

          ["achievements", "Achievements"],

          ["timetable", "Timetable"],

          ["cheatsheet", "Cheat Sheet"],

          ["discuss", "Discuss"],

          ["settings", "Settings"],

        ].filter(([id]) => {
          // In demo mode, hide premium tabs completely
          if (!demoMode) return true;
          const lockedTabs = ["leaderboard", "classroom", "studygroups"];
          return !lockedTabs.includes(id);
        }).map(([id, label]) => (

          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>

            {label}

          </button>

        ))}

      </nav>



      {tab === "today" && (

        <TodayScreen

          subjects={subjects}

          mastery={mastery}

          dueCards={dueCards}

          history={history}

          stats={stats}

          aiConfig={aiConfig}

          onStartSpaced={startSpacedReview}

          onStartSubject={(id) => startSubjectPractice(id)}

          onOpenTab={setTab}

          userId={auth.user?.id || auth.user?.username || "guest"}

        />

      )}



      {tab === "lectures" && (

        <LectureToNotes

          subjects={subjects}

          aiConfig={aiConfig}

          onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}

        />

      )}



      


      {tab === "studypaths" && (
        <PersonalizedStudyPaths
          subjects={subjects}
          mastery={mastery}
          history={history}
          stats={stats}
          onStartPractice={(subjectId) => startSubjectPractice(subjectId)}
        />
      )}



      {tab === "studygroups" && (
        demoMode ? (
          <DemoLockedOverlay
            title="👥 Study Groups Locked"
            description="Join study groups, collaborate with peers, and learn together. Upgrade to Pro to connect with other students!"
            icon="👥"
          />
        ) : (
          <StudyGroups stats={stats} username={auth.user?.username || "Student"} subjects={subjects} />
        )
      )}



      {tab === "practicehints" && (
        activeSession?.mode === "practicehints" ? (
          <PracticeWithHints
            questions={activeSession.questions}
            subject={activeSession.source}
            onComplete={(result) => {
              updateLearningModels(result.results);
              completeSession(result, activeSession.source);
              setActiveSession(null);
            }}
          />
        ) : (
          <div className="card">
            <h2>🎯 Practice with Hints</h2>
            <p className="muted">
              Select a subject to start a practice session with progressive hints.
            </p>
            <div className="subjects" style={{ marginTop: 16 }}>
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    const subjectQuestions = SUBJECTS.find(sub => sub.id === s.id)?.questions || [];
                    setActiveSession({
                      mode: "practicehints",
                      source: { id: s.id, label: s.label, icon: s.icon },
                      questions: subjectQuestions
                    });
                  }}
                  className="subject-btn"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, minWidth: 200 }}
                >
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      )}



      {tab === "aiassistant" && (

        <AIStudyAssistant

          subjects={subjects}

          onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}

        />

      )}



      {tab === "pastpapers" && (
        <>
          {demoMode && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📄</span>
                <span style={{ fontSize: 13 }}>Demo: {DEMO_LIMITS.pastPapersLimit - (demoUsage.pastPapersUsed || 0)} past paper remaining.</span>
              </div>
            </div>
          )}
          <PastPaperDrill
            subjects={subjects}
            demoMode={demoMode}
            demoUsage={demoUsage}
            setDemoUsage={setDemoUsage}
            onStartPastPaper={(qs, yr, mins) => {
              if (demoMode && (demoUsage.pastPapersUsed || 0) >= DEMO_LIMITS.pastPapersLimit) {
                alert(`Demo limit: Only ${DEMO_LIMITS.pastPapersLimit} past paper allowed. Upgrade to access all past papers!`);
                return;
              }
              setActiveSession({ mode: "exam", source: { id: "pastpaper", label: `Past Paper ${yr}`, icon: "📝" }, questions: qs, totalSeconds: mins * 60 });
              if (demoMode) {
                setDemoUsage(prev => ({ ...prev, pastPapersUsed: (prev.pastPapersUsed || 0) + 1 }));
              }
            }}
          />
        </>
      )}



      {tab === "dashboard" && (

        <>

          {/* Stats Overview */}
          <div className="card">
            <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <LeagueProgress xp={stats.xp} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <StudyHeatmap heatmap={studyHeatmap} />
              </div>
            </div>
          </div>

          <div className="card">

          <h2>Learning Paths</h2>

          <p className="muted">Complete subjects in sequence and unlock mastery progression.</p>

          {demoMode && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔒</span>
                <span style={{ fontSize: 13 }}>Demo: Limited to 4 subjects. Upgrade for full access.</span>
                <button onClick={() => setShowPaymentModal(true)} style={{ marginLeft: "auto", background: "#3b82f6", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                  Upgrade
                </button>
              </div>
            </div>
          )}

          <div className="subjects">

            {subjects.map((s, i) => {

              const locked = i > 0 && (mastery[subjects[i - 1].id] || 0) < 60;

              let m = mastery[s.id] || 0;
              const isCapped = demoMode && m > DEMO_LIMITS.masteryCap;
              if (demoMode && m > DEMO_LIMITS.masteryCap) m = DEMO_LIMITS.masteryCap;

              const r = 28; const circ = 2 * Math.PI * r;

              return (

                <button key={s.id} className="subject-btn rich" disabled={locked} onClick={() => startSubjectPractice(s.id)}>

                  <div className="subject-media" style={{ position: "relative" }}>

                    <img src={s.image} alt={s.label} loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />

                    <span className="subject-icon-fallback">{s.icon}</span>

                    <svg width="68" height="68" style={{ position:"absolute",inset:0,zIndex:2 }}>

                      <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="4"/>

                      <circle cx="34" cy="34" r={r} fill="none" stroke={locked ? "#4f5a67" : isCapped ? "#facc15" : "#2dd4a0"} strokeWidth="4"

                        strokeDasharray={circ} strokeDashoffset={circ - (circ * m / 100)}

                        transform="rotate(-90 34 34)" style={{ transition:"stroke-dashoffset 0.5s" }}/>

                    </svg>

                  </div>

                  <div className="subject-meta">

                    <strong>{s.label} {locked ? "🔒" : isCapped ? "⭐" : ""}</strong>

                    <span className="muted">{m}%{isCapped && " (Demo Cap)"}</span>

                  </div>

                </button>

              );

            })}

          </div>

          {demoMode && subjects.some(s => (mastery[s.id] || 0) >= DEMO_LIMITS.masteryCap) && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginTop: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>⭐</span>
                <span style={{ fontSize: 13, flex: 1 }}>Mastery capped at {DEMO_LIMITS.masteryCap}% in demo. Upgrade to unlock full mastery tracking!</span>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  style={{ background: "#3b82f6", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Upgrade
                </button>
              </div>
            </div>
          )}

          <div className="row">

            <button onClick={startDiagnostic}>Start Diagnostic</button>

            <button onClick={startAdaptive}>Adaptive Practice</button>

            {demoMode ? (
              <button
                disabled
                title="Upgrade to unlock Weak Drill"
                style={{ opacity: 0.5, cursor: "not-allowed" }}
              >
                Weak Drill 🔒
              </button>
            ) : (
              <button onClick={startWeakDrill}>Weak Drill</button>
            )}

            <button onClick={startErrorDrill}>Error Drill</button>

            <button

              onClick={() => {

                const id = Date.now().toString(36);

                const challenge = {

                  mode: "challenge",

                  source: { id: "challenge", label: "Peer Challenge", icon: "🏁" },

                  questions: allQuestions.slice(0, 6),

                };

                localStorage.setItem(`challenge-${id}`, JSON.stringify(challenge));

                const url = `${window.location.origin}${window.location.pathname}?challenge=${id}`;

                navigator.clipboard?.writeText(url);

                alert("Peer challenge link copied.");

              }}

            >

              Peer Challenge

            </button>

          </div>

          <div className="row">

            <button onClick={startSpacedReview} disabled={dueCards.length === 0}>

              {demoMode && dueCards.length > DEMO_LIMITS.maxSpacedReviewCards
                ? `Spaced Review (${DEMO_LIMITS.maxSpacedReviewCards}/${dueCards.length}) 🔒`
                : `Spaced Review (${dueCards.length})`}

            </button>

            <button onClick={() => setTab("learn")}>Read Lessons</button>

          </div>

          <h3>Daily Quests</h3>

          <ul>

            {EMPTY_QUESTS.map((q) => (

              <li key={q.id}>

                {stats.questsDone[q.id] ? "✅" : "⬜"} {q.label}

              </li>

            ))}

          </ul>

        </div>

        </>

      )}

      {tab === "learn" && (

        <div className="card">

          <h2>Read → Practice → Test</h2>

          {subjects.map((s) => (

            <div key={s.id} className="lesson-block">

              <div className="row">

                <h3>{s.icon} {s.label}</h3>

                <button onClick={() => startSubjectPractice(s.id, "exam", examQuestionCount, examCustomMinutes)}>Take Exam</button>

              </div>

              <img className="lesson-image" src={s.image} alt={`${s.label} visual`} loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />

              {s.lessons.map((l) => (

                <div key={l.title}>

                  <strong>{l.title}</strong>

                  <p className="muted">{l.content}</p>

                </div>

              ))}

              {s.questions[0] && (

                <button onClick={() => setShowCheckpoint({ ...s.questions[0], subjectId: s.id })}>

                  Quick Lesson Checkpoint

                </button>

              )}

            </div>

          ))}

          {showCheckpoint && <SimpleCheckpoint question={showCheckpoint} onDone={() => setShowCheckpoint(null)} />}

        </div>

      )}

      {tab === "practice" && (

        <div className="card">

          <h2>Practice Hub</h2>

          <p className="muted">Choose a mode.</p>

          {demoMode && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <span style={{ fontSize: 13 }}>Demo: {DEMO_LIMITS.practiceQuestions - demoUsage.practiceQuestions} practice questions remaining today.</span>
                <button onClick={() => setShowPaymentModal(true)} style={{ marginLeft: "auto", background: "#3b82f6", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                  Upgrade
                </button>
              </div>
            </div>
          )}

          <div className="row">

            <button onClick={startAdaptive}>Adaptive</button>

            <button onClick={startSpacedReview}>Spaced</button>

            {demoMode ? (
              <button
                disabled
                title="Upgrade to unlock Weak Drill"
                style={{ opacity: 0.5, cursor: "not-allowed" }}
              >
                Weak Drill 🔒
              </button>
            ) : (
              <button onClick={startWeakDrill}>Weak Drill</button>
            )}

          </div>

          <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              Questions:
              <select value={examQuestionCount} onChange={(e) => setExamQuestionCount(e.target.value)}>
                <option value="all">All</option>
                {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              Time:
              <select value={examCustomMinutes} onChange={(e) => setExamCustomMinutes(e.target.value)}>
                <option value="">Auto (~1.5min/Q)</option>
                {[10, 15, 20, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n}min</option>)}
              </select>
            </label>
          </div>

          <div className="subjects">

            {subjects.map((s) => (

              <button key={s.id} className="subject-btn" onClick={() => startSubjectPractice(s.id, "exam", examQuestionCount, examCustomMinutes)}>

                {s.icon} {s.label} Exam

              </button>

            ))}

          </div>

        </div>

      )}

      {tab === "keys" && isTeacher && (
        <KeyManagement token={token} />
      )}

      {tab === "classroom" && (
        demoMode ? (
          <DemoLockedOverlay
            title="🏫 Classroom Locked"
            description="Join virtual classrooms, participate in discussions, and submit assignments. Upgrade to Pro for full classroom access!"
            icon="🏫"
          />
        ) : (
        <Classroom

          subjects={subjects}

          assignments={assignments}

          teacherMode={isTeacher}

          setTeacherMode={() => {}}

          onCreate={async (a) => {
            try {
              if (token) {
                const backendSubject = backendSubjects.find((s) => s.label === subjects.find((x) => x.id === a.subjectId)?.label);
                if (backendSubject) {
                  await api("/assignments", {
                    token,
                    method: "POST",
                    body: { title: a.title, subjectId: backendSubject.id, dueAt: a.due || null },
                  });
                  refreshAssignments();
                }
              }
            } catch {
              setAssignments((prev) => [...prev, a]);
            }
          }}
          onComplete={async (id) => {
            try {
              await apiRequest("/api/assignments/complete", "POST", { id }, token);
            } catch {
              // ignore offline
            }
            setAssignments((prev) =>
              prev.map((a) => (a.id === id ? { ...a, completed: true, completedAt: new Date().toISOString() } : a))
            );
          }}
          onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}
        />
        )
      )}

      {tab === "bank" && <QuestionBank subjects={subjects} onStartPastPaper={(qs, yr, mins) => {
        setActiveSession({ mode: "exam", source: { id: "pastpaper", label: `Past Paper ${yr}`, icon: "📝" }, questions: qs, totalSeconds: mins * 60 });

      }} />}

      {tab === "planner" && <RevisionPlanner mastery={mastery} dueCards={dueCards} subjects={subjects} />}

      {tab === "outline" && (

        <CourseOutline

          subjects={subjects}

          outlineSubjectId={outlineSubjectId}

          setOutlineSubjectId={setOutlineSubjectId}

          startSubjectPractice={startSubjectPractice}

          addNote={(text) => setNotes((p) => ({ ...p, [outlineSubjectId]: text }))}

          outlineProgress={outlineProgress}

          setOutlineProgress={setOutlineProgress}

        />

      )}

      {tab === "analytics" && (

        <div className="card">

          <h2>Deep Analytics</h2>

          <p className="muted">

            Avg Score:{" "}

            {history.length ? Math.round(history.reduce((a, h) => a + percent(h.score, h.total), 0) / history.length) : 0}

            % | Weekly Progress: {stats.sessions}/{stats.weeklyGoal}

          </p>

          <h3>Recent Exam Percentages</h3>

          <div className="history">

            {history

              .filter((h) => h.mode === "exam")

              .slice(-8)

              .reverse()

              .map((h, i) => (

                <div key={`${h.ts}-${i}`} className="history-row">

                  <span>{h.subjectLabel}</span>

                  <strong>{percent(h.score, h.total)}%</strong>

                </div>

              ))}

          </div>

          <h3>Mastery Chart</h3>

          {subjects.map((s) => (

            <div key={s.id} className="chart-row">

              <span>{s.label}</span>

              <div className="bar">

                <div className="fill" style={{ width: `${mastery[s.id] || 0}%` }} />

              </div>

              <strong>{mastery[s.id] || 0}%</strong>

            </div>

          ))}

          <h3>Performance Timeline</h3>

          <div className="sparkline">

            {history.slice(-20).map((h, i) => (

              <div key={`${h.ts}-${i}`} className="spark" style={{ height: `${Math.max(8, percent(h.score, h.total))}%` }} title={`${h.subjectLabel} ${percent(h.score, h.total)}%`} />

            ))}

          </div>

          <h3>Confidence Heatmap</h3>

          <p className="muted" style={{ fontSize: 13 }}>Each square = one answered question. Green = correct + sure, Red = wrong, Yellow = unsure.</p>

          <ConfidenceHeatmap history={history} />

          <button

            onClick={() => {

              const canvas = document.createElement("canvas");

              canvas.width = 900; canvas.height = 540;

              const ctx = canvas.getContext("2d");

              const grad = ctx.createLinearGradient(0, 0, 900, 540);

              grad.addColorStop(0, "#0b0f14"); grad.addColorStop(1, "#131b26");

              ctx.fillStyle = grad; ctx.fillRect(0, 0, 900, 540);

              ctx.strokeStyle = "#2dd4a0"; ctx.lineWidth = 6;

              ctx.strokeRect(18, 18, 864, 504);

              ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 2;

              ctx.strokeRect(28, 28, 844, 484);

              ctx.fillStyle = "#2dd4a0"; ctx.font = "bold 38px Inter, sans-serif";

              ctx.textAlign = "center"; ctx.fillText("The Scholar's Circle", 450, 100);

              ctx.fillStyle = "#eaf0f8"; ctx.font = "22px Inter, sans-serif";

              ctx.fillText("Certificate of Achievement", 450, 145);

              ctx.fillStyle = "#aab4c4"; ctx.font = "16px Inter, sans-serif";

              ctx.fillText("This certifies that", 450, 210);

              ctx.fillStyle = "#facc15"; ctx.font = "bold 32px Inter, sans-serif";

              ctx.fillText(auth.user.username, 450, 255);

              ctx.fillStyle = "#eaf0f8"; ctx.font = "16px Inter, sans-serif";

              ctx.fillText("has demonstrated academic dedication and learning excellence.", 450, 295);

              ctx.fillStyle = "#2dd4a0"; ctx.font = "bold 18px Inter, sans-serif";

              ctx.fillText(`XP Earned: ${stats.xp}  |  Sessions: ${stats.sessions}  |  Streak: ${stats.streak} days`, 450, 350);

              const topS = subjects.map((s) => ({ label: s.label, m: mastery[s.id] || 0 })).sort((a,b) => b.m - a.m).slice(0,3);

              ctx.fillStyle = "#818cf8"; ctx.font = "14px Inter, sans-serif";

              ctx.fillText("Top Subjects: " + topS.map(s => `${s.label} ${s.m}%`).join("  |  "), 450, 385);

              ctx.fillStyle = "#aab4c4"; ctx.font = "14px Inter, sans-serif";

              ctx.fillText(`Issued: ${new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}`, 450, 460);

              canvas.toBlob((blob) => {

                const a = document.createElement("a");

                a.href = URL.createObjectURL(blob);

                a.download = `scholars_circle_cert_${auth.user.username}.png`;

                a.click();

              });

            }}

          >

            Download Certificate (PNG)

          </button>

        </div>

      )}

      {tab === "admin" && isTeacher && (

        <div className="card">

          <div className="row">

            <h2>Admin</h2>

            <button onClick={refreshAdmin} disabled={adminLoading || !token}>

              {adminLoading ? "Loading..." : "Refresh"}

            </button>

          </div>

          {!token && <p className="muted">Backend token missing. Log in via backend to use admin view.</p>}

          <h3>Registered Users</h3>

          <div className="history">

            {adminUsers.length === 0 && <p className="muted">No users loaded yet.</p>}

            {adminUsers.map((u) => (

              <div key={u.id} className="history-row">

                <span>

                  {u.username} ({u.role}) — {u.email}

                </span>

                <strong>{new Date(u.createdAt).toLocaleDateString()}</strong>

              </div>

            ))}

          </div>

          <h3>Recent Logins</h3>

          <div className="history">

            {adminLogins.length === 0 && <p className="muted">No login events loaded yet.</p>}

            {adminLogins.slice(0, 30).map((e) => (

              <div key={e.id} className="history-row">

                <span>

                  {e.user?.username} — {new Date(e.createdAt).toLocaleString()}

                </span>

                <strong>{(e.ip || "").toString().slice(0, 20)}</strong>

              </div>

            ))}

          </div>

        </div>

      )}

      {tab === "settings" && (

        <div className="card">

          <h2>Settings, AI & Sync</h2>

          <div className="row">

            <span>Theme</span>

            <button onClick={() => setDarkMode((v) => !v)}>{darkMode ? "Dark" : "Light"}</button>

          </div>

          <div className="row">

            <button

              onClick={() => {

                setToken("");

                setAuth({ username: "", password: "", user: null, error: "" });

              }}

            >

              Logout

            </button>

            <button className="danger" onClick={handleResetAll}>

              Reset data

            </button>

          </div>

          {demoMode && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#facc15" }}>🎯 Demo Mode Progress</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {DEMO_ACHIEVEMENTS.map(ach => {
                  const earned = demoUsage.demoProgress.achievements.includes(ach.id);
                  return (
                    <div key={ach.id} style={{
                      background: earned ? "rgba(52,211,153,0.1)" : "rgba(148,163,184,0.1)",
                      border: earned ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(148,163,184,0.3)",
                      borderRadius: 8,
                      padding: 12,
                      opacity: earned ? 1 : 0.6
                    }}>
                      <div style={{ fontSize: 20 }}>{ach.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{ach.label}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>{ach.desc}</div>
                      {earned && <div style={{ color: "#34d399", fontSize: 11, marginTop: 4 }}>✓ Earned</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, padding: 12, background: "rgba(59,130,246,0.1)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.3)" }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Demo Completion: {Math.round((demoUsage.demoProgress.achievements.length / DEMO_ACHIEVEMENTS.length) * 100)}%</div>
                <div style={{ height: 8, background: "rgba(148,163,184,0.3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(demoUsage.demoProgress.achievements.length / DEMO_ACHIEVEMENTS.length) * 100}%`,
                    background: "#3b82f6",
                    transition: "width 0.3s"
                  }} />
                </div>
                <button onClick={() => setShowPaymentModal(true)} style={{ marginTop: 12, width: "100%", background: "#3b82f6", color: "white", border: "none", padding: "10px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                  Upgrade to Full Version
                </button>
              </div>
            </div>
          )}

          {auth.user?.activationKey && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Your Activation Key</p>
              <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#facc15", letterSpacing: 2 }}>
                {auth.user.activationKey}
              </div>
              {!isActivated && <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Share this key with your teacher to get activated</p>}
              {isActivated && <p className="muted" style={{ fontSize: 11, marginTop: 8, color: "#34d399" }}>✓ Your account is activated</p>}
            </div>
          )}
          {!auth.user?.activationKey && !isTeacher && (
            <div style={{ background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p className="muted" style={{ fontSize: 12 }}>
                {token ? "Your account doesn't have an activation key. You may be using a demo account." : "Log in to see your activation key."}
              </p>
            </div>
          )}

          <h3>AI Assistant (Real API)</h3>

          <div className="row">

            <select value={aiConfig.provider} onChange={(e) => {

              const nextProvider = e.target.value;

              setAiConfig((p) => ({

                ...p,

                provider: nextProvider,

                model: nextProvider === "gemini" ? "gemini-1.5-flash" : (p.model || "gpt-4o-mini"),

              }));

            }}>

              <option value="openai">OpenAI-compatible</option>

              <option value="gemini">Google Gemini</option>

            </select>

            <input

              placeholder={aiConfig.provider === "gemini" ? "Gemini API key" : "OpenAI API key"}

              type="password"

              value={aiConfig.apiKey}

              onChange={(e) => setAiConfig((p) => ({ ...p, apiKey: e.target.value }))}

            />

            <input

              placeholder="Model"

              value={aiConfig.model}

              onChange={(e) => setAiConfig((p) => ({ ...p, model: e.target.value }))}

            />

          </div>

          <AIHelper aiConfig={aiConfig} onUsed={() => {

            setAiHelpUsed(true);

            setStats((s) => ({ ...s, questsDone: { ...s.questsDone, q8: true } }));

          }} />

          <h3>Cloud Sync (Supabase)</h3>

          <div className="row">

            <input placeholder="Supabase URL" value={syncConfig.url} onChange={(e) => setSyncConfig((p) => ({ ...p, url: e.target.value }))} />

            <input placeholder="Supabase anon key" value={syncConfig.key} onChange={(e) => setSyncConfig((p) => ({ ...p, key: e.target.value }))} />

          </div>

          <div className="row">

            <input placeholder="user_id" value={syncConfig.userId} onChange={(e) => setSyncConfig((p) => ({ ...p, userId: e.target.value }))} />

            <button onClick={syncToCloud}>Push</button>

            <button onClick={pullFromCloud}>Pull</button>

          </div>

          {syncStatus && <p className="muted">{syncStatus}</p>}

          <p className="muted">Create table: learning_profiles(user_id text primary key, payload jsonb).</p>

          <h3>Customer Support</h3>

          <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: "0 0 12px 0", fontWeight: 600 }}>Need help? We're here for you!</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href="https://wa.link/yj2em4"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#25D366",
                  color: "white",
                  textDecoration: "none",
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontWeight: 600,
                  transition: "transform 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <span style={{ fontSize: 20 }}>💬</span>
                <span>Chat on WhatsApp</span>
              </a>

              <a
                href="tel:09028617178"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#3b82f6",
                  color: "white",
                  textDecoration: "none",
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontWeight: 600,
                  transition: "transform 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <span style={{ fontSize: 20 }}>📞</span>
                <span>Call: 09028617178</span>
              </a>
            </div>

            <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
              Available 9AM - 6PM (Mon-Fri). For faster response, use WhatsApp.
            </p>
          </div>

          <div style={{ background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Common Issues</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <details style={{ cursor: "pointer" }}>
                <summary style={{ fontWeight: 500, padding: 4 }}>How do I reset my password?</summary>
                <p className="muted" style={{ marginTop: 4, fontSize: 12, marginLeft: 12 }}>
                  Contact support via WhatsApp with your username and email. We'll help you reset it.
                </p>
              </details>
              <details style={{ cursor: "pointer" }}>
                <summary style={{ fontWeight: 500, padding: 4 }}>App not installing on iPhone?</summary>
                <p className="muted" style={{ marginTop: 4, fontSize: 12, marginLeft: 12 }}>
                  Tap Share → Add to Home Screen. Make sure you're on Safari and HTTPS.
                </p>
              </details>
              <details style={{ cursor: "pointer" }}>
                <summary style={{ fontWeight: 500, padding: 4 }}>How to activate my account?</summary>
                <p className="muted" style={{ marginTop: 4, fontSize: 12, marginLeft: 12 }}>
                  Share your activation key (shown above) with your teacher. They'll activate you.
                </p>
              </details>
              <details style={{ cursor: "pointer" }}>
                <summary style={{ fontWeight: 500, padding: 4 }}>AI not working?</summary>
                <p className="muted" style={{ marginTop: 4, fontSize: 12, marginLeft: 12 }}>
                  Add your API key in the AI Assistant section above. We support OpenAI and Gemini.
                </p>
              </details>
            </div>
          </div>

          <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 10, padding: 16 }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Feedback & Suggestions</h4>
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              We love hearing from you! Share your ideas for new features or report bugs.
            </p>
            <button
              onClick={() => {
                const message = encodeURIComponent("Hi Scholar's Circle team, I have a suggestion/feedback:");
                window.open(`https://wa.link/yj2em4?text=${message}`, "_blank");
              }}
              style={{
                background: "#34d399",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                width: "100%"
              }}
            >
              📝 Send Feedback
            </button>
          </div>

        </div>

      )}

      {tab === "flashcards" && (

        <FlashcardDeck subjects={subjects} srData={srData} customFlashcards={customFlashcards} setCustomFlashcards={setCustomFlashcards} token={token} />

      )}

      {tab === "aitutor" && (

        <AITutorChat aiConfig={aiConfig} chatHistory={aiChatHistory} setChatHistory={setAiChatHistory} subjects={subjects} token={token} demoMode={demoMode} demoUsage={demoUsage} setDemoUsage={setDemoUsage} />

      )}

      {tab === "reminders" && (

        <StudyReminders reminders={reminders} setReminders={setReminders} timetable={timetable} notificationPermission={notificationPermission} setNotificationPermission={setNotificationPermission} token={token} />

      )}

      {tab === "leaderboard" && (
        demoMode ? (
          <DemoLockedOverlay
            title="🏆 Leaderboard Locked"
            description="Compete with other students and see how you rank globally. Upgrade to Pro to unlock the leaderboard and join the competition!"
            icon="🏆"
          />
        ) : (
          <Leaderboard username={auth.user.username} xp={stats.xp} sessions={stats.sessions} streak={stats.streak} mastery={mastery} subjects={subjects} token={token} />
        )
      )}

      {tab === "pomodoro" && (
        demoMode ? (
          demoUsage.pomodoroSessions >= DEMO_LIMITS.pomodoroSessions ? (
            <DemoLockedOverlay
              title="⏱️ Pomodoro Locked"
              description={`You've used all ${DEMO_LIMITS.pomodoroSessions} focus sessions for today. Upgrade for unlimited focus sessions!`}
              icon="⏱️"
            />
          ) : (
            <>
              {demoMode && (
                <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⏱️</span>
                    <span style={{ fontSize: 13 }}>Demo: {DEMO_LIMITS.pomodoroSessions - demoUsage.pomodoroSessions} focus sessions remaining today.</span>
                  </div>
                </div>
              )}
              <PomodoroTimer
                demoMode={demoMode}
                onSessionDone={() => {
                  setStats((s) => ({ ...s, questsDone: { ...s.questsDone, q7: s.questsDone.q7 } }));
                  if (demoMode) {
                    setDemoUsage(prev => ({ ...prev, pomodoroSessions: prev.pomodoroSessions + 1 }));
                  }
                }}
              />
            </>
          )
        ) : (
          <PomodoroTimer onSessionDone={() =>
            setStats((s) => ({ ...s, questsDone: { ...s.questsDone, q7: s.questsDone.q7 } }))
          } />
        )
      )}

      {tab === "notes" && (
        <>
          {demoMode && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📝</span>
                <span style={{ fontSize: 13 }}>Demo: {DEMO_LIMITS.notesLimit - Object.values(notes).flat().length} notes remaining.</span>
              </div>
            </div>
          )}
          <NotesEditor
            subjects={subjects}
            notes={notes}
            setNotes={(newNotes) => {
              if (demoMode) {
                const noteCount = Object.values(newNotes).flat().length;
                if (noteCount > DEMO_LIMITS.notesLimit) {
                  alert(`Demo limit: Maximum ${DEMO_LIMITS.notesLimit} notes allowed. Upgrade to Pro for unlimited notes!`);
                  return;
                }
              }
              setNotes(newNotes);
            }}
            demoMode={demoMode}
          />
        </>
      )}

      {tab === "achievements" && (

        <AchievementsBadges badges={BADGES} stats={stats} history={history} subjects={subjects} mastery={mastery} />

      )}

      {tab === "timetable" && (

        <TimetableBuilder timetable={timetable} setTimetable={setTimetable} subjects={subjects} />

      )}

      {tab === "cheatsheet" && (

        <CheatSheet subjects={subjects} mastery={mastery} />

      )}

      {tab === "discuss" && (

        <DiscussionBoard subjects={subjects} discussion={discussion} setDiscussion={setDiscussion} username={auth.user.username} isTeacher={isTeacher} />

      )}

      {showPalette && (

        <CommandPalette

          query={paletteQuery}

          setQuery={setPaletteQuery}

          onClose={() => setShowPalette(false)}

          actions={buildPaletteActions()}

        />

      )}

    </main>

  );

}



function CommandPalette({ query, setQuery, onClose, actions }) {

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (

    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>

      <div className="modal-box" style={{ maxWidth: 520 }}>

        <div className="row" style={{ alignItems: "center", gap: 8 }}>

          <input

            autoFocus

            placeholder="Type a command…"

            value={query}

            onChange={(e) => setQuery(e.target.value)}

            style={{ flex: 1 }}

          />

          <button onClick={onClose}>Esc</button>

        </div>

        <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 10, display: "grid", gap: 6 }}>

          {filtered.slice(0, 12).map((a) => (

            <button key={a.label} className="palette-row" onClick={() => { a.run(); onClose(); setQuery(""); }}>

              <span>{a.label}</span>

              {a.kbd && <kbd>{a.kbd}</kbd>}

            </button>

          ))}

          {filtered.length === 0 && <p className="muted">No matches.</p>}

        </div>

      </div>

    </div>

  );

}



function SessionPlayer({ session, onExit, onComplete, aiConfig }) {

  const [idx, setIdx] = useState(0);

  const [selected, setSelected] = useState(null);

  const [showResult, setShowResult] = useState(false);

  const [score, setScore] = useState(0);

  const [results, setResults] = useState([]);

  const [confidence, setConfidence] = useState("unsure");

  const [timeLeft, setTimeLeft] = useState(session.totalSeconds ?? null);

  const [startedAt] = useState(Date.now());

  const [finalResult, setFinalResult] = useState(null);

  const [showWrongReview, setShowWrongReview] = useState(false);

  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const current = session.questions[idx];

  async function askAIForExplanation() {
    if (!current) return;
    setAiLoading(true);
    setAiExplanation(null);
    try {
      const userAnswer = current.options[selected];
      const correctAnswer = current.options[current.answer];
      const isCorrect = selected === current.answer;
      const prompt = `You are a helpful tutor. A student answered a multiple choice question${isCorrect ? " correctly" : " incorrectly"}.

Question: ${current.q}

The student chose: ${userAnswer}

The correct answer is: ${correctAnswer}

The existing explanation is: ${current.explanation || "No explanation provided."}

${isCorrect 
  ? "The student got it right! Reinforce why this is correct and briefly explain the concept. Keep it concise (2-3 sentences) and educational." 
  : "Explain in a friendly, encouraging way why the student's answer is wrong and why the correct answer is right. Keep it concise (2-3 sentences) and educational."}`;
      const explanation = await callAI(prompt, aiConfig);
      setAiExplanation(explanation);
    } catch (err) {
      setAiExplanation("Sorry, couldn't get AI explanation. Please check your API key in Settings.");
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  const isExamLike = session.mode === "exam";

  const perQuestionTarget = session.totalSeconds ? Math.round(session.totalSeconds / session.questions.length) : null;



  useEffect(() => {

    if (timeLeft == null || showResult) return undefined;

    if (timeLeft <= 0) {

      onComplete({ score, total: session.questions.length, results, mode: session.mode, seconds: session.totalSeconds });

      return undefined;

    }

    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);

    return () => clearTimeout(t);

  }, [timeLeft, showResult, score, session, onComplete, results]);



  if (!current) {

    return (

      <div className="card">

        <h2>No questions available for this mode.</h2>

        <button onClick={onExit}>Back</button>

      </div>

    );

  }



  if (finalResult) {

    const pct = Math.round((finalResult.score / Math.max(1, finalResult.total)) * 100);

    const emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📖";

    const confMap = { unsure: 0.4, okay: 0.6, sure: 0.8 };

    const avgConf = finalResult.results.length ? Math.round((finalResult.results.reduce((a,r)=>a+(confMap[r.confidence]||0.6),0)/finalResult.results.length)*100) : 0;

    const calibrationGap = avgConf - pct;

    const gapLabel = calibrationGap > 5 ? "Overconfident" : calibrationGap < -5 ? "Underconfident" : "Well calibrated";

    return (

      <div className="card" style={{ textAlign: "center" }}>

        <h2>{emoji} Session Complete!</h2>

        <p style={{ fontSize: "3rem", margin: "8px 0" }}>{pct}%</p>

        <p className="muted">{finalResult.score} / {finalResult.total} correct &nbsp;·&nbsp; {finalResult.seconds}s &nbsp;·&nbsp; {session.source.label}</p>

        <p className="muted" style={{ marginTop: 4 }}>Avg confidence {avgConf}% → {gapLabel} ({calibrationGap >=0 ? "+" : ""}{calibrationGap} pts vs score)</p>

        <div className="row" style={{ justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>

          <button style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }} onClick={() => onComplete(finalResult)}>Save & Continue</button>

          {finalResult.results.some(r => !r.correct) && (

            <button style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }} onClick={() => setShowWrongReview(v => !v)}>

              {showWrongReview ? "Hide" : "Review"} Wrong Answers ({finalResult.results.filter(r => !r.correct).length})

            </button>

          )}

          <button onClick={() => {

            const text = `I scored ${pct}% (${finalResult.score}/${finalResult.total}) on ${session.source.label} at The Scholar's Circle! 🎓`;

            if (navigator.share) navigator.share({ title: "Scholar's Circle", text });

            else navigator.clipboard?.writeText(text).then(() => alert("Score copied to clipboard!"));

          }}>📤 Share Score</button>

          <button onClick={onExit}>Back</button>

        </div>

        {showWrongReview && (

          <div style={{ textAlign: "left", marginTop: 18 }}>

            <h3 style={{ textAlign: "center" }}>Wrong Answers</h3>

            {finalResult.results.map((r, i) => {

              if (r.correct) return null;

              const q = session.questions[i];

              if (!q) return null;

              return (

                <div key={i} className="lesson-block" style={{ borderLeft: "3px solid #ff6b6b" }}>

                  <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Q{i + 1}: {q.q}</p>

                  <p style={{ margin: "4px 0", color: "#ff6b6b", fontSize: 14 }}>

                    Your answer: <strong>{q.options[r.selected] ?? "—"}</strong>

                  </p>

                  <p style={{ margin: "4px 0", color: "#2dd4a0", fontSize: 14 }}>

                    Correct: <strong>{q.options[q.answer]}</strong>

                  </p>

                  {q.explanation && (

                    <p style={{ margin: "8px 0 0", fontSize: 13 }} className="muted">

                      💡 {q.explanation}

                    </p>

                  )}

                </div>

              );

            })}

          </div>

        )}

      </div>

    );

  }



  function submit() {

    if (selected == null || showResult) return;

    setAiExplanation(null);

    const correct = selected === current.answer;

    if (correct) setScore((s) => s + 1);

    setResults((r) => [

      ...r,

      {

        key: current.key,

        questionId: current.questionId || current.key,

        subjectId: current.subjectId,

        selected: selected ?? 0,

        correct,

        confidence,

      },

    ]);

    if (isExamLike) {

      if (idx === session.questions.length - 1) {

        setFinalResult({

          score: correct ? score + 1 : score,

          total: session.questions.length,

          results: [...results, { key: current.key, subjectId: current.subjectId, correct, confidence }],

          mode: session.mode,

          seconds: Math.round((Date.now() - startedAt) / 1000),

        });

      } else {

        setIdx((i) => i + 1);

        setSelected(null);

        setConfidence("unsure");

      }

      return;

    }

    setShowResult(true);

  }



  function next() {

    setAiExplanation(null);

    if (idx === session.questions.length - 1) {

      setFinalResult({

        score,

        total: session.questions.length,

        results,

        mode: session.mode,

        seconds: Math.round((Date.now() - startedAt) / 1000),

      });

      return;

    }

    setIdx((i) => i + 1);

    setSelected(null);

    setShowResult(false);

  }



  return (

    <div className="card">

      <div className="row">

        <h2>

          {session.source.icon} {session.source.label}

        </h2>

        <div className="row">

          {timeLeft != null && <strong>⏱ {timeLeft}s</strong>}

          <button onClick={onExit}>Exit</button>

        </div>

      </div>

      {perQuestionTarget && (

        <div className="bar" style={{ margin: "6px 0 10px" }}>

          <div className="fill" style={{ width: `${Math.min(100, ((idx) / Math.max(1, session.questions.length)) * 100)}%`, background: "#818cf8" }} />

        </div>

      )}

      <p className="muted">

        Question {idx + 1}/{session.questions.length}

      </p>

      {isExamLike && (

        <p className="muted">

          Running score: {score}/{Math.max(1, idx + (showResult ? 1 : 0))} (

          {Math.round((score / Math.max(1, idx + (showResult ? 1 : 0))) * 100)}%)

          {perQuestionTarget ? ` • Pace: ~${perQuestionTarget}s/question` : ""}

        </p>

      )}

      <p className="question">{current.q}</p>

      <div className="row">

        <label>Confidence</label>

        <select value={confidence} onChange={(e) => setConfidence(e.target.value)}>

          <option value="unsure">Unsure</option>

          <option value="okay">Okay</option>

          <option value="sure">Sure</option>

        </select>

        <button onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(current.q))}>🔊 Read</button>

      </div>

      <div className="options">

        {current.options.map((opt, i) => {

          const isSelected = selected === i;

          const isCorrect = showResult && i === current.answer;

          const isWrong = showResult && i === selected && i !== current.answer;

          return (

            <button

              key={opt}

              className={`option ${isCorrect ? "ok" : ""} ${isWrong ? "bad" : ""} ${isSelected ? "selected" : ""}`}

              onClick={() => setSelected(i)}

              disabled={showResult}

            >

              {String.fromCharCode(65 + i)}. {opt}

              {isSelected && (

                <span style={{ marginLeft: 8, fontWeight: 700, color: isCorrect ? "#065f46" : isWrong ? "#991b1b" : "#3b82f6" }}>

                  ✓

                </span>

              )}

            </button>

          );

        })}

      </div>

      {showResult && !isExamLike && (

        <div>

          <p className="muted">{current.explanation}</p>

          <div style={{ marginTop: 12 }}>
            <button 
              onClick={askAIForExplanation} 
              disabled={aiLoading}
              style={{ fontSize: 14, padding: "6px 12px" }}
            >
              {aiLoading ? "🤖 Thinking..." : "🤖 Ask AI to explain"}
            </button>
            {aiExplanation && (
              <div style={{ 
                marginTop: 8, 
                padding: 12, 
                background: "#f0f9ff", 
                border: "1px solid #bae6fd", 
                borderRadius: 8,
                fontSize: 14,
                lineHeight: 1.5
              }}>
                <strong style={{ color: "#0284c7" }}>AI Explanation:</strong>
                <p style={{ margin: "4px 0 0" }}>{aiExplanation}</p>
              </div>
            )}
          </div>

          <ul>

            {current.options.map((opt, i) => (

              <li key={opt} className="muted">

                {String.fromCharCode(65 + i)}: {i === current.answer ? "Correct option for this concept." : "Not the best match for this question."}

              </li>

            ))}

          </ul>

        </div>

      )}

      <div className="row">

        {!showResult || isExamLike ? (

          <button onClick={submit} disabled={selected == null}>

            {isExamLike && idx === session.questions.length - 1 ? "Submit Exam" : "Submit"}

          </button>

        ) : (

          <button onClick={next}>{idx === session.questions.length - 1 ? "Finish" : "Next"}</button>

        )}

      </div>

    </div>

  );
}






function Classroom({ subjects, assignments, teacherMode, setTeacherMode, onCreate, onComplete, onImportQuestions }) {

  const [subjectId, setSubjectId] = useState(subjects[0].id);

  const [title, setTitle] = useState("");

  const [due, setDue] = useState("");

  return (

    <div className="card">

      <div className="row">

        <h2>Classroom</h2>

        <button onClick={() => setTeacherMode((v) => !v)}>{teacherMode ? "Teacher Mode: ON" : "Teacher Mode: OFF"}</button>

      </div>

      {teacherMode && (

        <div className="lesson-block">

          <h3>Create Assignment</h3>

          <div className="row">

            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" />

            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>

              {subjects.map((s) => (

                <option key={s.id} value={s.id}>

                  {s.label}

                </option>

              ))}

            </select>

            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />

            <button

              onClick={() => {

                if (!title.trim()) return;

                onCreate({ id: Date.now().toString(), title, subjectId, due, done: false });

                setTitle("");

              }}

            >

              Add

            </button>

          </div>

        </div>

      )}

      {teacherMode && <BulkImport onImportQuestions={onImportQuestions} />}

      {teacherMode && <AIQuestionGen onImportQuestions={onImportQuestions} />}

      <h3>Assignments</h3>

      {assignments.length === 0 && <p className="muted">No assignments yet.</p>}

      {assignments.map((a) => (

        <div key={a.id} className="history-row">

          <span>

            {a.title} ({subjects.find((s) => s.id === a.subjectId)?.label}) {a.due ? `- Due ${a.due}` : ""}

          </span>

          <button onClick={() => onComplete(a.id)}>{a.done ? "Done" : "Mark Done"}</button>

        </div>

      ))}

    </div>

  );
}






function AIHelper({ aiConfig, onUsed }) {

  const [q, setQ] = useState("");

  const [a, setA] = useState("");

  const [loading, setLoading] = useState(false);



  async function askAI() {

    if (!q.trim()) return;

    if (!aiConfig.apiKey) {

      setA("Add API key in settings to use live AI.");

      return;

    }

    try {

      setLoading(true);

      const provider = aiConfig.provider || "openai";

      const model = aiConfig.model || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");

      let text = "";

      if (provider === "gemini") {

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiConfig.apiKey}`, {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({

            contents: [

              {

                parts: [

                  { text: `Explain this for a university student in simple terms and give one memory trick: ${q}` },

                ],

              },

            ],

          }),

        });

        const data = await res.json();

        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || data.error?.message || "No response.";

      } else {

        const res = await fetch("https://api.openai.com/v1/responses", {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

            Authorization: `Bearer ${aiConfig.apiKey}`,

          },

          body: JSON.stringify({

            model,

            input: `Explain this for a university student in simple terms and give one memory trick: ${q}`,

          }),

        });

        const data = await res.json();

        text = data.output_text || data.error?.message || "No response.";

      }

      setA(text);

      if (onUsed) onUsed();

    } catch (e) {

      setA(`AI request failed: ${e.message}`);

    } finally {

      setLoading(false);

    }

  }



  return (

    <div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask for explanation..." />

      <button onClick={askAI} disabled={loading}>{loading ? "Thinking..." : "Explain"}</button>

      {a && <p className="muted">{a}</p>}

    </div>

  );
}






function SimpleCheckpoint({ question, onDone }) {

  const [selected, setSelected] = useState(null);

  const [show, setShow] = useState(false);

  return (

    <div className="lesson-block">

      <h3>Checkpoint</h3>

      <p>{question.q}</p>

      {question.options.map((o, i) => (

        <button key={o} className="option" onClick={() => setSelected(i)}>

          {o}

        </button>

      ))}

      {!show ? (

        <button onClick={() => setShow(true)} disabled={selected == null}>

          Check

        </button>

      ) : (

        <p className="muted">{selected === question.answer ? "Correct ✅" : "Try again next round ❌"}</p>

      )}

      <button onClick={onDone}>Close</button>

    </div>

  );
}






function QuestionBank({ subjects, onStartPastPaper }) {

  const [q, setQ] = useState("");

  const [subj, setSubj] = useState("all");

  const [diff, setDiff] = useState("all");

  const [year, setYear] = useState("all");

  const [questionCount, setQuestionCount] = useState("all");

  const [customMinutes, setCustomMinutes] = useState("");

  const allRows = subjects.flatMap((s) =>

    s.questions.map((qu, i) => ({ ...qu, subjectId: s.id, subjectLabel: s.label, subjectIcon: s.icon, subject: s.label, year: qu.year || 2020 + (i % 6) }))

  );

  const rows = allRows.filter(

    (row) =>

      (subj === "all" || row.subject === subj) &&

      (diff === "all" || row.difficulty === diff) &&

      (year === "all" || String(row.year) === year) &&

      (row.q.toLowerCase().includes(q.toLowerCase()) || row.options.some((o) => o.toLowerCase().includes(q.toLowerCase())))

  );

  const years = [...new Set(allRows.map(r => r.year))].sort();

  // Calculate selected questions
  const selectedRows = questionCount === "all" 
    ? rows 
    : rows.slice(0, parseInt(questionCount));

  // Calculate time
  const autoMinutes = Math.max(10, Math.round((selectedRows.length * 90) / 60));
  const minutes = customMinutes ? parseInt(customMinutes) : autoMinutes;

  return (

    <div className="card">

      <h2>Past Questions Bank</h2>

      <div className="row" style={{ flexWrap: "wrap" }}>

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />

        <select value={subj} onChange={(e) => setSubj(e.target.value)}>

          <option value="all">All Subjects</option>

          {subjects.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}

        </select>

        <select value={diff} onChange={(e) => setDiff(e.target.value)}>

          <option value="all">All Difficulty</option>

          <option value="easy">easy</option>

          <option value="medium">medium</option>

          <option value="hard">hard</option>

        </select>

        <select value={year} onChange={(e) => setYear(e.target.value)}>

          <option value="all">All Years</option>

          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}

        </select>

        <select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>
          <option value="all">All questions</option>
          {[10, 20, 30, 50].map(n => (
            <option key={n} value={n} disabled={rows.length < n}>
              {n} questions
            </option>
          ))}
        </select>

        <select value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)}>
          <option value="">Auto time (~{autoMinutes} min)</option>
          {[10, 15, 20, 30, 45, 60, 90, 120].map(n => (
            <option key={n} value={n}>
              {n} minutes
            </option>
          ))}
        </select>

        {year !== "all" && selectedRows.length > 0 && (

          <button style={{ borderColor: "#fb923c", color: "#fb923c" }}

            onClick={() => onStartPastPaper && onStartPastPaper(selectedRows, year, minutes)}>

            📝 Take {year} Paper ({selectedRows.length} Qs · {minutes} min)

          </button>

        )}

      </div>

      <p className="muted" style={{ fontSize: 13 }}>{rows.length} questions shown</p>

      {rows.slice(0, 30).map((row, i) => (

        <div key={i} className="history-row">

          <span>{row.subject} ({row.year}) — {row.q.slice(0, 70)}{row.q.length > 70 ? "…" : ""}</span>

          <strong>{row.difficulty || "medium"}</strong>

        </div>

      ))}

    </div>

  );
}






function RevisionPlanner({ mastery, dueCards, subjects }) {

  const weak = subjects

    .map((s) => ({ subject: s.label, value: mastery[s.id] || 0 }))

    .sort((a, b) => a.value - b.value)

    .slice(0, 3);

  return (

    <div className="card">

      <h2>Smart Revision Planner</h2>

      <p className="muted">Auto-generated from weak topics and due cards.</p>

      <ol>

        {weak.map((w) => (

          <li key={w.subject}>

            Study {w.subject} ({w.value}% mastery) for 25 minutes, then do 10 practice questions.

          </li>

        ))}

        <li>Complete spaced review: {dueCards.length} cards due.</li>

        <li>Attempt one timed exam and review all wrong answers.</li>

      </ol>

    </div>

  );
}






function BulkImport({ onImportQuestions }) {

  const [csv, setCsv] = useState("");

  return (

    <div className="lesson-block">

      <h3>Question Authoring Studio</h3>

      <p className="muted">CSV: question,a,b,c,d,answerIndex(0-3),difficulty</p>

      <textarea rows={5} style={{ width: "100%" }} value={csv} onChange={(e) => setCsv(e.target.value)} />

      <button

        onClick={() => {

          const parsed = csv

            .split("\n")

            .map((l) => l.trim())

            .filter(Boolean)

            .map((line) => {

              const [q, a, b, c, d, ans, difficulty] = line.split(",");

              return { q, options: [a, b, c, d], answer: Number(ans), difficulty: difficulty || "medium", explanation: "Imported question" };

            })

            .filter((r) => r.q && r.options.every(Boolean) && Number.isInteger(r.answer));

          onImportQuestions(parsed);

          setCsv("");

        }}

      >

        Import Questions

      </button>

    </div>

  );
}






function FlashcardDeck({ subjects, srData, customFlashcards, setCustomFlashcards, token }) {

  const allCards = [

    ...subjects.flatMap((s) =>

      s.questions.map((q, i) => ({

        front: q.q,

        back: q.explanation || q.options[q.answer],

        subject: s.label,

        key: `${s.id}-${i}`,

        type: "auto",

      }))

    ),

    ...customFlashcards.map((c, i) => ({ ...c, key: `custom-${i}`, type: "custom" })),

  ];

  const dueCards = allCards.filter((c) => (srData[c.key]?.due || 0) <= Date.now() && srData[c.key]);

  const pool = dueCards.length > 0 ? dueCards : allCards;



  const [idx, setIdx] = useState(0);

  const [flipped, setFlipped] = useState(false);

  const [subjectFilter, setSubjectFilter] = useState("all");

  const [finished, setFinished] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const [newFront, setNewFront] = useState("");

  const [newBack, setNewBack] = useState("");

  const [newSubject, setNewSubject] = useState(subjects[0]?.label || "");

  const [cardTypeFilter, setCardTypeFilter] = useState("all");



  const filteredByType = cardTypeFilter === "all" ? pool : pool.filter((c) => c.type === cardTypeFilter);

  const filtered = subjectFilter === "all" ? filteredByType : filteredByType.filter((c) => c.subject === subjectFilter);

  const card = filtered[idx];



  function next() {

    setFlipped(false);

    if (idx + 1 >= filtered.length) { setFinished(true); return; }

    setTimeout(() => setIdx((i) => i + 1), 150);

  }

  function restart() { setIdx(0); setFlipped(false); setFinished(false); }

  function createCard() {

    if (!newFront.trim() || !newBack.trim()) return;

    const newCard = { front: newFront, back: newBack, subject: newSubject };

    setCustomFlashcards((p) => [...p, newCard]);

    if (token) {

      api("/user-data/flashcards", { token, method: "POST", body: newCard }).catch(console.error);

    }

    setNewFront("");

    setNewBack("");

    setShowCreate(false);

    restart();

  }

  function deleteCustomCard(index) {

    const card = customFlashcards[index];

    setCustomFlashcards((p) => p.filter((_, i) => i !== index));

    if (token && card.id) {

      api(`/user-data/flashcards/${card.id}`, { token, method: "DELETE" }).catch(console.error);

    }

    restart();

  }



  return (

    <div className="card">

      <div className="row">

        <h2>Flashcards</h2>

        <button onClick={() => setShowCreate(true)}>+ Create Card</button>

      </div>

      <div className="row">

        <select value={cardTypeFilter} onChange={(e) => { setCardTypeFilter(e.target.value); restart(); }}>

          <option value="all">All Types ({pool.length})</option>

          <option value="auto">Auto from Questions</option>

          <option value="custom">Custom ({customFlashcards.length})</option>

        </select>

        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); restart(); }}>

          <option value="all">All Subjects</option>

          {subjects.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}

        </select>

      </div>

      {dueCards.length > 0 && subjectFilter === "all" && cardTypeFilter === "all" && (

        <p className="muted" style={{ color: "#2dd4a0" }}>Showing {dueCards.length} due spaced-review cards.</p>

      )}

      {finished ? (

        <div style={{ textAlign: "center", padding: 32 }}>

          <p style={{ fontSize: "2rem" }}>🎉</p>

          <h3>Deck complete!</h3>

          <button onClick={restart}>Restart</button>

        </div>

      ) : card ? (

        <>

          <p className="muted">{idx + 1} / {filtered.length} — {card.subject}</p>

          <div className="flashcard-wrap" onClick={() => setFlipped((v) => !v)}>

            <div className={`flashcard ${flipped ? "flipped" : ""}`}>

              <div className="flashcard-front">

                <p className="question">{card.front}</p>

                <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Tap to reveal answer</p>

              </div>

              <div className="flashcard-back">

                <p style={{ fontSize: "1.1rem", color: "#2dd4a0" }}>{card.back}</p>

              </div>

            </div>

          </div>

          {flipped && (

            <div className="row" style={{ marginTop: 16 }}>

              <button style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }} onClick={next}>Got it wrong</button>

              <button style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }} onClick={next}>Got it right ✓</button>

            </div>

          )}

        </>

      ) : (

        <p className="muted">No cards available.</p>

      )}

      {customFlashcards.length > 0 && (

        <div style={{ marginTop: 20 }}>

          <h4>Custom Cards ({customFlashcards.length})</h4>

          <div className="history">

            {customFlashcards.map((c, i) => (

              <div key={i} className="history-row">

                <span>{c.subject}: {c.front.substring(0, 40)}...</span>

                <button className="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => deleteCustomCard(i)}>Delete</button>

              </div>

            ))}

          </div>

        </div>

      )}

      {showCreate && (

        <div className="modal-overlay" onClick={() => setShowCreate(false)}>

          <div className="modal-box" onClick={(e) => e.stopPropagation()}>

            <h3>Create Flashcard</h3>

            <label>Subject</label>

            <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>

              {subjects.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}

            </select>

            <label>Front (Question)</label>

            <textarea value={newFront} onChange={(e) => setNewFront(e.target.value)} placeholder="Enter the question..." rows={3} />

            <label>Back (Answer)</label>

            <textarea value={newBack} onChange={(e) => setNewBack(e.target.value)} placeholder="Enter the answer..." rows={3} />

            <div className="row" style={{ marginTop: 16 }}>

              <button onClick={createCard}>Create</button>

              <button onClick={() => setShowCreate(false)}>Cancel</button>

            </div>

          </div>

        </div>

      )}

    </div>

  );
}






function Leaderboard({ username, xp, sessions, streak, mastery, subjects, token }) {

  const [board, setBoard] = useState([]);

  const [loading, setLoading] = useState(false);

  const [timePeriod, setTimePeriod] = useState("all"); // all, weekly, monthly

  const [subjectFilter, setSubjectFilter] = useState("all"); // all, or subject ID

  const API_BASE_LB = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";



  useEffect(() => {

    if (!token) return;

    setLoading(true);

    const params = new URLSearchParams();
    if (timePeriod !== "all") params.append("period", timePeriod);
    if (subjectFilter !== "all") params.append("subjectId", subjectFilter);

    fetch(`${API_BASE_LB}/users/leaderboard?${params}`, { headers: { Authorization: `Bearer ${token}` } })

      .then((r) => r.json())

      .then((users) => {
        setBoard(users);
      })

      .catch(() => {})

      .finally(() => setLoading(false));

  }, [token, timePeriod, subjectFilter]);



  const localEntry = { username, xp, sessions, streak: streak || 0, isMe: true, avgMastery: 0, correctRate: 0, studyHours: 0, personalBest: 0 };

  const merged = board.length > 0

    ? board.map((e) => ({ ...e, isMe: e.username === username }))

    : [localEntry, { username: "demo_student", xp: Math.max(0, xp - 40), sessions: Math.max(0, sessions - 2), streak: Math.max(0, (streak || 0) - 1), isMe: false, avgMastery: 0, correctRate: 0, studyHours: 0, personalBest: 0 }];



  const ranked = [...merged].sort((a, b) => b.xp - a.xp);

  const medals = ["🥇", "🥈", "🥉"];

  // MVP of the week
  const mvp = ranked[0];

  // Calculate badges for each user
  function calculateBadges(entry) {
    const earned = [];
    const stats = { xp: entry.totalXP || entry.xp, sessions: entry.sessions, streak: entry.streak, totalCorrect: Math.round((entry.correctRate / 100) * (entry.sessions * 10)) };
    const history = []; // Would need full history for some badges
    const mastery = {}; // Would need subject mastery

    BADGES.forEach(badge => {
      try {
        if (badge.check(stats, history, subjects, mastery)) {
          earned.push(badge);
        }
      } catch (e) {
        console.log('Badge check failed:', e);
      }
    });
    return earned;
  }

  // Tier calculation
  function getTier(xp) {
    if (xp >= 1000) return { name: "Platinum", color: "#a855f7", icon: "💎" };
    if (xp >= 500) return { name: "Gold", color: "#facc15", icon: "🥇" };
    if (xp >= 250) return { name: "Silver", color: "#94a3b8", icon: "🥈" };
    if (xp >= 100) return { name: "Bronze", color: "#cd7f32", icon: "🥉" };
    return null;
  }

  // Streak visualization
  function getStreakEmoji(streak) {
    if (streak >= 30) return "🔥🔥🔥";
    if (streak >= 14) return "🔥🔥";
    if (streak >= 7) return "🔥";
    if (streak >= 3) return "⚡";
    return "";
  }

  // Activity indicator
  function getActivityStatus(lastActive) {
    if (!lastActive) return "";
    const minutesAgo = (Date.now() - new Date(lastActive).getTime()) / 60000;
    if (minutesAgo < 5) return "🟢 Active now";
    if (minutesAgo < 1440) return "🟡 Studied today";
    return "";
  }



  return (

    <div className="card">

      <h2>Leaderboard</h2>

      <p className="muted">Ranked by total XP earned.</p>

      {/* Time period filter */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {["all", "weekly", "monthly"].map((period) => (
          <button
            key={period}
            onClick={() => setTimePeriod(period)}
            style={{
              padding: "6px 12px",
              background: timePeriod === period ? "#818cf8" : "#374151",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {/* Subject filter */}
      <div style={{ marginBottom: 16 }}>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          style={{
            padding: "6px 12px",
            background: "#374151",
            color: "white",
            border: "1px solid #4b5563",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          <option value="all">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
          ))}
        </select>
      </div>

      {/* MVP of the week */}
      {mvp && timePeriod === "weekly" && (
        <div style={{
          background: "linear-gradient(135deg, rgba(250,204,21,0.2), rgba(251,191,36,0.1))",
          border: "2px solid #facc15",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          textAlign: "center"
        }}>
          <div style={{ fontSize: 32 }}>👑</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#facc15", marginBottom: 4 }}>MVP of the Week</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{mvp.username}</div>
          <div style={{ color: "#facc15", fontWeight: 600 }}>{mvp.xp} XP</div>
        </div>
      )}

      {loading && <p className="muted">Loading...</p>}

      <div className="history" style={{ gap: 10 }}>

        {ranked.map((entry, i) => {
          const tier = getTier(entry.totalXP || entry.xp);
          const activityStatus = getActivityStatus(entry.lastActive);
          const streakEmoji = getStreakEmoji(entry.streak);
          const earnedBadges = calculateBadges(entry);

          return (
            <div key={entry.username} className="history-row" style={{

              padding: "12px 14px",

              borderRadius: 8,

              background: entry.isMe ? "rgba(45,212,160,0.08)" : "transparent",

              border: entry.isMe ? "1px solid #2dd4a0" : "1px solid #3e4752",

            }}>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <strong style={{ fontSize: 18, minWidth: 28 }}>{medals[i] || `#${i + 1}`}</strong>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {entry.username} {entry.isMe ? "(you)" : ""}
                    {tier && (
                      <span style={{
                        background: tier.color,
                        color: "#000",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700
                      }}>
                        {tier.icon} {tier.name}
                      </span>
                    )}
                    {earnedBadges.length > 0 && (
                      <span style={{ fontSize: 12, color: "#facc15" }}>
                        {earnedBadges.slice(0, 3).map(b => b.icon).join(" ")}
                        {earnedBadges.length > 3 && ` +${earnedBadges.length - 3}`}
                      </span>
                    )}
                  </div>
                  {activityStatus && (
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{activityStatus}</span>
                  )}
                </div>
              </div>

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span>
                  <strong style={{ color: "#facc15" }}>{entry.xp} XP</strong>
                  <span className="muted" style={{ marginLeft: 10 }}>{entry.sessions} sessions</span>
                  {entry.streak > 0 && (
                    <span className="muted" style={{ marginLeft: 10 }}>{streakEmoji} {entry.streak} day streak</span>
                  )}
                </span>
                <span className="muted" style={{ fontSize: 11 }}>
                  Avg Mastery: {entry.avgMastery}% | Correct: {entry.correctRate}% | Hours: {entry.studyHours}h
                  {entry.personalBest > 0 && ` | Best: ${entry.personalBest}%`}
                </span>
              </div>

            </div>
          );
        })}

      </div>

      {!token && <p className="muted" style={{ marginTop: 12 }}>Connect to the backend to see real rankings.</p>}

    </div>

  );
}






function PomodoroTimer({ onSessionDone }) {

  const MODES = [

    { id: "work", label: "Focus", duration: 25 * 60, color: "#2dd4a0" },

    { id: "short", label: "Short Break", duration: 5 * 60, color: "#818cf8" },

    { id: "long", label: "Long Break", duration: 15 * 60, color: "#fb923c" },

  ];

  const [modeIdx, setModeIdx] = useState(0);

  const [timeLeft, setTimeLeft] = useState(MODES[0].duration);

  const [running, setRunning] = useState(false);

  const [cycles, setCycles] = useState(0);

  const [task, setTask] = useState("");



  const mode = MODES[modeIdx];



  useEffect(() => {

    const handler = (e) => {

      if (e.key === "Escape") {

        // Close any open modals - handled by parent App component

      }

    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);

  }, []);



  useEffect(() => {

    if (!running) return;

    if (timeLeft <= 0) {

      setRunning(false);

      if (mode.id === "work") {

        setCycles((c) => c + 1);

        if (onSessionDone) onSessionDone();

      }

      const msg = mode.id === "work" ? "Focus session done! Take a break." : "Break over — back to work!";

      if (window.Notification?.permission === "granted") new Notification("Scholar's Circle", { body: msg });

      else alert(msg);

      return;

    }

    const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);

    return () => clearInterval(t);

  }, [running, timeLeft, mode, onSessionDone]);



  function switchMode(i) {

    setModeIdx(i);

    setTimeLeft(MODES[i].duration);

    setRunning(false);

  }



  function requestNotifPerm() {

    if (window.Notification) Notification.requestPermission();

  }



  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");

  const secs = String(timeLeft % 60).padStart(2, "0");

  const progress = 1 - timeLeft / mode.duration;



  return (

    <div className="card" style={{ textAlign: "center" }}>

      <h2>Pomodoro Timer</h2>

      <div className="row" style={{ justifyContent: "center", marginBottom: 16 }}>

        {MODES.map((m, i) => (

          <button key={m.id} onClick={() => switchMode(i)}

            style={{ borderColor: modeIdx === i ? m.color : undefined, color: modeIdx === i ? m.color : undefined }}>

            {m.label}

          </button>

        ))}

      </div>

      {task && <p className="muted">Working on: <strong>{task}</strong></p>}

      <div style={{ position: "relative", display: "inline-flex", margin: "16px auto" }}>

        <svg width="200" height="200" style={{ transform: "rotate(-90deg)" }}>

          <circle cx="100" cy="100" r="88" fill="none" stroke="#3e4752" strokeWidth="10" />

          <circle cx="100" cy="100" r="88" fill="none" stroke={mode.color} strokeWidth="10"

            strokeDasharray={`${2 * Math.PI * 88}`}

            strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress)}`}

            style={{ transition: "stroke-dashoffset 1s linear" }} />

        </svg>

        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>

          <span style={{ fontSize: "2.8rem", fontWeight: "bold", color: mode.color }}>{mins}:{secs}</span>

          <span className="muted" style={{ fontSize: 13 }}>{mode.label}</span>

        </div>

      </div>

      <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 8 }}>

        <button onClick={() => setRunning((v) => !v)} style={{ borderColor: mode.color, color: mode.color, padding: "10px 24px", fontSize: "1rem" }}>

          {running ? "⏸ Pause" : "▶ Start"}

        </button>

        <button onClick={() => { setTimeLeft(mode.duration); setRunning(false); }}>↺ Reset</button>

      </div>

      <p className="muted" style={{ marginTop: 16 }}>Completed focus sessions today: <strong>{cycles}</strong></p>

      <div style={{ marginTop: 12 }}>

        <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="What are you studying?" style={{ width: "100%", maxWidth: 320 }} />

      </div>

      <button className="muted" style={{ marginTop: 8, fontSize: 12 }} onClick={requestNotifPerm}>Enable notifications</button>

    </div>

  );
}






function NotesEditor({ subjects, notes, setNotes }) {

  const [activeSubject, setActiveSubject] = useState(subjects[0]?.id || "");

  const text = notes[activeSubject] || "";



  return (

    <div className="card">

      <h2>My Notes</h2>

      <p className="muted">Write and save personal notes per subject. Auto-saved.</p>

      <div className="row" style={{ flexWrap: "wrap" }}>

        {subjects.map((s) => (

          <button key={s.id} onClick={() => setActiveSubject(s.id)}

            style={{ borderColor: activeSubject === s.id ? "#2dd4a0" : undefined, color: activeSubject === s.id ? "#2dd4a0" : undefined }}>

            {s.icon} {s.label}

          </button>

        ))}

      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0" }}>

        <strong>{subjects.find((s) => s.id === activeSubject)?.label} Notes</strong>

        <span className="muted" style={{ fontSize: 12 }}>{text.length} characters</span>

        {text && (

          <button style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => {

            const blob = new Blob([text], { type: "text/plain" });

            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);

            a.download = `${activeSubject}_notes.txt`; a.click();

          }}>Export .txt</button>

        )}

      </div>

      <textarea

        rows={18}

        style={{ width: "100%", fontFamily: "monospace", fontSize: 14, lineHeight: 1.7, resize: "vertical" }}

        value={text}

        placeholder={`Start typing your ${subjects.find((s) => s.id === activeSubject)?.label} notes here…\n\nTips:\n• Use bullet points\n• Write key formulas\n• Summarise each lesson in your own words`}

        onChange={(e) => setNotes((prev) => ({ ...prev, [activeSubject]: e.target.value }))}

      />

    </div>

  );
}






function SearchResults({ query, subjects, onStart }) {

  const q = query.toLowerCase();

  const subjectHits = subjects.filter((s) => s.label.toLowerCase().includes(q) || s.icon.includes(q));

  const lessonHits = subjects.flatMap((s) =>

    s.lessons

      .filter((l) => l.title.toLowerCase().includes(q) || l.content.toLowerCase().includes(q))

      .map((l) => ({ ...l, subjectLabel: s.label, subjectId: s.id }))

  );

  const questionHits = subjects.flatMap((s) =>

    s.questions

      .filter((qn) => qn.q.toLowerCase().includes(q) || qn.options.some((o) => o.toLowerCase().includes(q)))

      .slice(0, 3)

      .map((qn) => ({ ...qn, subjectLabel: s.label, subjectId: s.id }))

  );

  const total = subjectHits.length + lessonHits.length + questionHits.length;

  if (total === 0) return <div className="card"><p className="muted">No results for &ldquo;{query}&rdquo;.</p></div>;

  return (

    <div className="card">

      <h3>Search results for &ldquo;{query}&rdquo; — {total} found</h3>

      {subjectHits.length > 0 && (

        <>

          <p className="muted" style={{ margin: "8px 0 4px" }}><strong>Subjects</strong></p>

          {subjectHits.map((s) => (

            <div key={s.id} className="history-row">

              <span>{s.icon} {s.label}</span>

              <button onClick={() => onStart(s.id)}>Practice</button>

            </div>

          ))}

        </>

      )}

      {lessonHits.length > 0 && (

        <>

          <p className="muted" style={{ margin: "8px 0 4px" }}><strong>Lessons</strong></p>

          {lessonHits.map((l, i) => (

            <div key={i} className="history-row">

              <span><strong>{l.title}</strong> — {l.subjectLabel}</span>

              <span className="muted" style={{ fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.content.slice(0, 80)}…</span>

            </div>

          ))}

        </>

      )}

      {questionHits.length > 0 && (

        <>

          <p className="muted" style={{ margin: "8px 0 4px" }}><strong>Questions</strong></p>

          {questionHits.map((qn, i) => (

            <div key={i} className="history-row">

              <span>{qn.q.slice(0, 80)}{qn.q.length > 80 ? "…" : ""}</span>

              <span className="muted" style={{ fontSize: 12 }}>{qn.subjectLabel} · {qn.difficulty}</span>

            </div>

          ))}

        </>

      )}

    </div>

  );
}






function AchievementsBadges({ badges, stats, history, subjects, mastery }) {

  const earned = badges.filter(b => { try { return b.check(stats, history, subjects, mastery); } catch { return false; } });

  const locked = badges.filter(b => { try { return !b.check(stats, history, subjects, mastery); } catch { return true; } });

  return (

    <div className="card">

      <h2>Achievements & Badges</h2>

      <p className="muted">{earned.length} / {badges.length} earned</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>

        {earned.map(b => (

          <div key={b.id} className="badge-card earned">

            <span className="badge-icon">{b.icon}</span>

            <strong>{b.label}</strong>

            <span className="muted" style={{ fontSize: 12 }}>{b.desc}</span>

          </div>

        ))}

      </div>

      {locked.length > 0 && (

        <>

          <h3 style={{ opacity: 0.6 }}>Locked</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>

            {locked.map(b => (

              <div key={b.id} className="badge-card locked">

                <span className="badge-icon" style={{ filter: "grayscale(1)", opacity: 0.4 }}>{b.icon}</span>

                <strong style={{ opacity: 0.5 }}>{b.label}</strong>

                <span className="muted" style={{ fontSize: 12 }}>{b.desc}</span>

              </div>

            ))}

          </div>

        </>

      )}

    </div>

  );
}






function TimetableBuilder({ timetable, setTimetable, subjects }) {

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const HOURS = ["8am","9am","10am","11am","12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm"];

  const COLORS = ["#2dd4a0","#818cf8","#fb923c","#facc15","#f472b6","#38bdf8","#a78bfa"];

  const [editing, setEditing] = useState(null);

  const [draft, setDraft] = useState({ subject: "", color: COLORS[0] });



  function cellKey(d, h) { return `${d}-${h}`; }



  function save() {

    if (!draft.subject.trim()) { setEditing(null); return; }

    setTimetable(prev => ({ ...prev, [editing]: { subject: draft.subject, color: draft.color } }));

    setEditing(null);

  }



  function clear(key) { setTimetable(prev => { const n = {...prev}; delete n[key]; return n; }); }



  return (

    <div className="card">

      <h2>Weekly Study Timetable</h2>

      <p className="muted">Click any cell to assign a subject or custom label.</p>

      <div style={{ overflowX: "auto" }}>

        <table className="timetable">

          <thead>

            <tr>

              <th></th>

              {DAYS.map(d => <th key={d}>{d}</th>)}

            </tr>

          </thead>

          <tbody>

            {HOURS.map(h => (

              <tr key={h}>

                <td className="tt-hour">{h}</td>

                {DAYS.map(d => {

                  const key = cellKey(d, h);

                  const cell = timetable[key];

                  return (

                    <td key={key} className="tt-cell"

                      style={{ background: cell ? cell.color + "33" : undefined, borderColor: cell ? cell.color : undefined, cursor: "pointer" }}

                      onClick={() => { setDraft(cell ? { subject: cell.subject, color: cell.color } : { subject: "", color: COLORS[0] }); setEditing(key); }}>

                      {cell ? <span style={{ fontSize: 12, color: cell.color, fontWeight: "bold" }}>{cell.subject}</span> : null}

                    </td>

                  );

                })}

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {editing && (

        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>

          <div className="modal-box">

            <h3>Edit slot: {editing}</h3>

            <input value={draft.subject} onChange={e => setDraft(p => ({...p, subject: e.target.value}))} placeholder="Subject or activity" style={{ width: "100%" }} />

            <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>

              {subjects.map((s, i) => (

                <button key={s.id} style={{ fontSize: 12, borderColor: COLORS[i % COLORS.length] }}

                  onClick={() => setDraft({ subject: s.label, color: COLORS[i % COLORS.length] })}>

                  {s.icon} {s.label}

                </button>

              ))}

            </div>

            <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>

              {COLORS.map(c => (

                <div key={c} onClick={() => setDraft(p => ({...p, color: c}))}

                  style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: draft.color === c ? "3px solid white" : "2px solid transparent" }} />

              ))}

            </div>

            <div className="row" style={{ marginTop: 12 }}>

              <button style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }} onClick={save}>Save</button>

              <button className="danger" onClick={() => { clear(editing); setEditing(null); }}>Clear</button>

              <button onClick={() => setEditing(null)}>Cancel</button>

            </div>

          </div>

        </div>

      )}

    </div>

  );
}






function CheatSheet({ subjects, mastery }) {

  const [active, setActive] = useState(subjects[0]?.id || "");

  const subject = subjects.find(s => s.id === active);



  function printSheet() {

    const win = window.open("", "_blank");

    const content = subject.lessons.map(l => `<h3>${l.title}</h3><p>${l.content}</p>`).join("");

    const keyFacts = subject.questions.slice(0, 5).map(q =>

      `<li><strong>Q:</strong> ${q.q}<br/><strong>A:</strong> ${q.options[q.answer]} — ${q.explanation}</li>`

    ).join("");

    win.document.write(`<html><head><title>${subject.label} Cheat Sheet</title>

    <style>body{font-family:sans-serif;padding:24px;max-width:700px;margin:auto}h1{color:#2dd4a0}h3{color:#818cf8}li{margin-bottom:8px}</style></head>

    <body><h1>${subject.icon} ${subject.label} — Quick Reference Sheet</h1>${content}<h2>Key Facts</h2><ul>${keyFacts}</ul></body></html>`);

    win.document.close(); win.print();

  }



  return (

    <div className="card">

      <div className="row">

        <h2>Cheat Sheets</h2>

        <button onClick={printSheet} style={{ borderColor: "#fb923c", color: "#fb923c" }}>🖨️ Print / Save PDF</button>

      </div>

      <p className="muted">Auto-generated quick reference from lesson content + key Q&A.</p>

      <div className="row" style={{ flexWrap: "wrap" }}>

        {subjects.map(s => (

          <button key={s.id} onClick={() => setActive(s.id)}

            style={{ borderColor: active === s.id ? "#2dd4a0" : undefined, color: active === s.id ? "#2dd4a0" : undefined }}>

            {s.icon} {s.label}

          </button>

        ))}

      </div>

      {subject && (

        <>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 6px" }}>

            <h3 style={{ margin: 0 }}>{subject.icon} {subject.label}</h3>

            <span className="muted" style={{ fontSize: 13 }}>Mastery: {mastery[subject.id] || 0}%</span>

          </div>

          {subject.lessons.map(l => (

            <div key={l.title} className="lesson-block">

              <strong style={{ color: "#818cf8" }}>{l.title}</strong>

              <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{l.content}</p>

            </div>

          ))}

          <h3>Key Q&A</h3>

          {subject.questions.slice(0, 6).map((q, i) => (

            <div key={i} className="cheat-qa">

              <p style={{ margin: "0 0 4px" }}><strong>Q{i+1}:</strong> {q.q}</p>

              <p style={{ margin: 0, color: "#2dd4a0", fontSize: 14 }}><strong>A:</strong> {q.options[q.answer]} — <span className="muted">{q.explanation}</span></p>

            </div>

          ))}

        </>

      )}

    </div>

  );
}






function DiscussionBoard({ subjects, discussion, setDiscussion, username, isTeacher }) {

  const [activeSubject, setActiveSubject] = useState(subjects[0]?.id || "");

  const [text, setText] = useState("");

  const threads = discussion[activeSubject] || [];



  useEffect(() => {

    if (!activeSubject && subjects[0]?.id) setActiveSubject(subjects[0].id);

  }, [subjects, activeSubject]);



  function post() {

    if (!text.trim()) return;

    const msg = { id: Date.now(), author: username, role: isTeacher ? "Teacher" : "Student", text: text.trim(), ts: Date.now(), replies: [] };

    setDiscussion(prev => ({ ...prev, [activeSubject]: [msg, ...(prev[activeSubject] || [])] }));

    setText("");

  }



  function reply(threadId, replyText) {

    if (!replyText.trim()) return;

    setDiscussion(prev => ({

      ...prev,

      [activeSubject]: (prev[activeSubject] || []).map(t =>

        t.id === threadId ? { ...t, replies: [...t.replies, { id: Date.now(), author: username, role: isTeacher ? "Teacher" : "Student", text: replyText, ts: Date.now() }] } : t

      )

    }));

  }



  return (

    <div className="card">

      <h2>Discussion Board</h2>

      <p className="muted">Ask questions, share insights per subject. Stored locally.</p>

      <div className="row" style={{ flexWrap: "wrap" }}>

        {subjects.map(s => (

          <button key={s.id} onClick={() => setActiveSubject(s.id)}

            style={{ borderColor: activeSubject === s.id ? "#2dd4a0" : undefined, color: activeSubject === s.id ? "#2dd4a0" : undefined }}>

            {s.icon} {s.label} {(discussion[s.id] || []).length > 0 ? `(${(discussion[s.id] || []).length})` : ""}

          </button>

        ))}

      </div>

      <div className="row" style={{ marginTop: 12, alignItems: "flex-start" }}>

        <textarea rows={3} style={{ flex: 1, resize: "vertical" }} value={text}

          onChange={e => setText(e.target.value)} placeholder="Ask a question or share a tip…" />

        <button style={{ borderColor: "#2dd4a0", color: "#2dd4a0", alignSelf: "flex-end" }} onClick={post}>Post</button>

      </div>

      {threads.length === 0 && <p className="muted">No posts yet. Be the first to ask a question!</p>}

      {threads.map(t => (

        <DiscussionThread key={t.id} thread={t} onReply={(rt) => reply(t.id, rt)} username={username} isTeacher={isTeacher} />

      ))}

    </div>

  );





}




function DiscussionThread({ thread, onReply, username, isTeacher }) {

  const [replyText, setReplyText] = useState("");

  const [showReply, setShowReply] = useState(false);

  return (

    <div className="discussion-thread">

      <div className="discussion-post">

        <span className="post-author">{thread.author} <span className="muted" style={{ fontSize: 11 }}>({thread.role}) · {new Date(thread.ts).toLocaleString()}</span></span>

        <p style={{ margin: "4px 0" }}>{thread.text}</p>

        <button style={{ fontSize: 12 }} onClick={() => setShowReply(v => !v)}>↩ Reply ({thread.replies.length})</button>

      </div>

      {thread.replies.map(r => (

        <div key={r.id} className="discussion-reply">

          <span className="post-author" style={{ color: isTeacher || r.role === "Teacher" ? "#facc15" : "#818cf8" }}>

            {r.author} <span className="muted" style={{ fontSize: 11 }}>({r.role}) · {new Date(r.ts).toLocaleString()}</span>

          </span>

          <p style={{ margin: "2px 0" }}>{r.text}</p>

        </div>

      ))}

      {showReply && (

        <div className="row" style={{ marginTop: 4, paddingLeft: 16 }}>

          <input style={{ flex: 1 }} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" />

          <button style={{ borderColor: "#818cf8", color: "#818cf8" }} onClick={() => { onReply(replyText); setReplyText(""); setShowReply(false); }}>Send</button>

        </div>

      )}

    </div>

  );

}







function AIQuestionGen({ onImportQuestions }) {

  const [topic, setTopic] = useState("");

  const [count, setCount] = useState(5);

  const [difficulty, setDifficulty] = useState("medium");

  const [provider, setProvider] = useState(import.meta.env.VITE_GEMINI_API_KEY ? "gemini" : "openai");

  const [apiKey, setApiKey] = useState(
    (import.meta.env.VITE_GEMINI_API_KEY && import.meta.env.VITE_GEMINI_API_KEY) ||
    import.meta.env.VITE_OPENAI_API_KEY ||
    ""
  );

  const [model, setModel] = useState(import.meta.env.VITE_GEMINI_API_KEY ? "gemini-2.0-flash" : "gpt-4o-mini");

  const [loading, setLoading] = useState(false);

  const [preview, setPreview] = useState([]);

  const [error, setError] = useState("");



  async function generate() {

    if (!topic.trim()) return;

    if (!apiKey.trim()) { setError(`Enter your ${provider === "gemini" ? "Gemini" : "OpenAI"} API key above.`); return; }

    setLoading(true); setError(""); setPreview([]);

    const prompt = `Generate exactly ${count} multiple-choice questions about "${topic}" for a first-year university student. Difficulty: ${difficulty}.\nReturn ONLY a JSON array with this structure (no extra text):\n[{"q":"question","options":["A","B","C","D"],"answer":0,"explanation":"why","difficulty":"${difficulty}"}]\nThe "answer" field is the index (0-3) of the correct option.`;

    try {

      const effectiveModel = model || (provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini");

      let raw = "";

      if (provider === "gemini") {

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`, {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),

        });

        const data = await res.json();

        raw = (data?.candidates?.[0]?.content?.parts?.[0]?.text || data.error?.message || "").trim();

      } else {

        const res = await fetch("https://api.openai.com/v1/responses", {

          method: "POST",

          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },

          body: JSON.stringify({ model: effectiveModel, input: prompt }),

        });

        const data = await res.json();

        raw = (data.output_text || "").trim();

      }

      const jsonStr = raw.startsWith("[") ? raw : raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);

      const parsed = JSON.parse(jsonStr);

      setPreview(parsed);

    } catch (e) {

      setError(`Generation failed: ${e.message}. Make sure your API key is valid and the model supports text generation.`);

    } finally {

      setLoading(false);

    }

  }



  function importAll() {

    onImportQuestions(preview.map(q => ({ ...q, explanation: q.explanation || "AI-generated question." })));

    setPreview([]); setTopic("");

  }



  return (

    <div className="lesson-block">

      <h3>AI Question Generator</h3>

      <p className="muted">Paste a topic, get instant MCQs added to the Custom Bank.</p>

      <div className="row" style={{ flexWrap: "wrap" }}>

        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic (e.g. Cell Division, Integration)" style={{ flex: 2, minWidth: 200 }} />

        <select value={count} onChange={e => setCount(Number(e.target.value))}>

          {[3,5,8,10].map(n => <option key={n} value={n}>{n} Qs</option>)}

        </select>

        <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>

          <option value="easy">easy</option>

          <option value="medium">medium</option>

          <option value="hard">hard</option>

        </select>

      </div>

      <div className="row" style={{ flexWrap: "wrap", marginTop: 8, gap: 8 }}>

        <select value={provider} onChange={(e) => {

          const next = e.target.value;

          setProvider(next);

          setModel(next === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini");

        }}>

          <option value="openai">OpenAI-compatible</option>

          <option value="gemini">Google Gemini</option>

        </select>

        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={provider === "gemini" ? "Gemini API key" : "OpenAI API key"} style={{ flex: 1, minWidth: 220 }} />

        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" />

      </div>

      <button onClick={generate} disabled={loading} style={{ marginTop: 8, borderColor: "#818cf8", color: "#818cf8" }}>

        {loading ? "Generating…" : "✨ Generate Questions"}

      </button>

      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}

      {preview.length > 0 && (

        <>

          <h4>Preview ({preview.length} questions)</h4>

          {preview.map((q, i) => (

            <div key={i} className="history-row">

              <span style={{ fontSize: 13 }}>{i+1}. {q.q}</span>

              <span className="muted" style={{ fontSize: 12 }}>{q.options[q.answer]}</span>

            </div>

          ))}

          <button onClick={importAll} style={{ marginTop: 8, borderColor: "#2dd4a0", color: "#2dd4a0" }}>

            ✅ Import all {preview.length} to Question Bank

          </button>

        </>

      )}

    </div>

  );

}



function ConfidenceHeatmap({ history }) {

  if (!history.length) return <p className="muted">No session history yet.</p>;

  const recent = history.slice(-100);

  return (

    <div className="heatmap">

      {recent.map((h, i) => {

        const pct = Math.round((h.score / Math.max(1, h.total)) * 100);

        const color = pct === 100 ? "#2dd4a0" : pct >= 80 ? "#818cf8" : pct >= 50 ? "#facc15" : "#ff6b6b";

        return (

          <div

            key={i}

            className="heatmap-cell"

            style={{ background: color }}

            title={`${h.subjectLabel}: ${pct}% on ${new Date(h.ts).toLocaleDateString()}`}

          />

        );

      })}

    </div>

  );

}



function AITutorChat({ aiConfig, chatHistory, setChatHistory, subjects, token, demoMode, demoUsage, setDemoUsage }) {

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState("");

  const messagesEndRef = useRef(null);



  const scrollToBottom = () => {

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  };



  useEffect(() => {

    scrollToBottom();

  }, [chatHistory]);



  async function sendMessage() {

    if (!message.trim() || loading) return;

    if (demoMode && (demoUsage.aiTutorMessages || 0) >= DEMO_LIMITS.aiTutorMessages) {
      setChatHistory([...chatHistory, { role: "assistant", content: `Demo limit reached: You've used ${DEMO_LIMITS.aiTutorMessages} AI tutor messages. Register for full access.`, timestamp: Date.now() }]);
      return;
    }

    if (!aiConfig.apiKey) {

      setChatHistory([...chatHistory, { role: "assistant", content: "Please configure your API key in Settings first.", timestamp: Date.now() }]);

      return;

    }

    const userMsg = message.trim();

    setMessage("");

    setLoading(true);

    const newHistory = [...chatHistory, { role: "user", content: userMsg, timestamp: Date.now() }];

    setChatHistory(newHistory);

    if (demoMode) {
      setDemoUsage(prev => ({ ...prev, aiTutorMessages: (prev.aiTutorMessages || 0) + 1 }));
    }



    try {

      const context = selectedSubject

        ? `You are a helpful tutor for ${selectedSubject}. The user is studying this subject. Keep answers concise and educational.`

        : "You are a helpful study tutor. Keep answers concise and educational.";

      const systemPrompt = context + "\n\nSubjects available: " + subjects.map(s => s.label).join(", ");



      let responseText = "";

      // Use backend proxy if available, otherwise use direct call
      try {
        responseText = await callAI(`${systemPrompt}\n\nUser: ${userMsg}`, aiConfig);
      } catch (proxyError) {
        console.log("Backend proxy failed, trying direct call:", proxyError);

        // Fallback to direct call if proxy fails
        if (aiConfig.provider === "gemini") {

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.apiKey}`, {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({

              contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${userMsg}` }] }],

              generationConfig: { maxOutputTokens: 500, temperature: 0.7 },

            }),

          });

          const data = await res.json();

          if (!res.ok) {

            throw new Error(data.error?.message || "API request failed");

          }

          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

        } else {

          const res = await fetch("https://api.openai.com/v1/chat/completions", {

            method: "POST",

          headers: { 

            "Content-Type": "application/json", 

            "Authorization": `Bearer ${aiConfig.apiKey}` 

          },

          body: JSON.stringify({

            model: aiConfig.model,

            messages: [

              { role: "system", content: systemPrompt },

              ...newHistory.slice(-10).map(m => ({ role: m.role, content: m.content }))

            ],

            max_tokens: 500,

            temperature: 0.7,

          }),

        });

        const data = await res.json();

        if (!res.ok) {

          throw new Error(data.error?.message || "API request failed");

        }

        responseText = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

      }
      }

      setChatHistory([...newHistory, { role: "assistant", content: responseText, timestamp: Date.now() }]);

      if (token) {

        api("/user-data/chat", { token, method: "POST", body: { role: "assistant", content: responseText } }).catch(console.error);

      }

    } catch (e) {

      console.error("AI Tutor error:", e);

      setChatHistory([...newHistory, { role: "assistant", content: "Error: " + e.message, timestamp: Date.now() }]);

    } finally {

      setLoading(false);

    }

  }



  function clearHistory() {

    setChatHistory([]);

    if (token) {

      api("/user-data/chat", { token, method: "DELETE" }).catch(console.error);

    }

  }



  return (

    <div className="card">

      <div className="row">

        <h2>AI Tutor</h2>

        <button onClick={clearHistory} style={{ fontSize: 12 }}>Clear Chat</button>

      </div>

      <div className="row">

        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>

          <option value="">General Tutor</option>

          {subjects.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}

        </select>

      </div>

      <div style={{ height: 400, overflowY: "auto", border: "1px solid #3e4752", borderRadius: 10, padding: 12, background: "rgba(0,0,0,0.2)" }}>

        {chatHistory.length === 0 && (

          <p className="muted" style={{ textAlign: "center", marginTop: 160 }}>

            👋 Ask me anything about your studies!

          </p>

        )}

        {chatHistory.map((msg, i) => (

          <div key={i} style={{ marginBottom: 12 }}>

            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>

              <span style={{ fontSize: 20 }}>{msg.role === "user" ? "👤" : "🤖"}</span>

              <div style={{ flex: 1, background: msg.role === "user" ? "rgba(129,140,248,0.15)" : "rgba(45,212,160,0.1)", padding: 10, borderRadius: 8 }}>

                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>

                <span className="muted" style={{ fontSize: 11 }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>

              </div>

            </div>

          </div>

        ))}

        {loading && (

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

            <span style={{ fontSize: 20 }}>🤖</span>

            <span className="muted">Thinking...</span>

          </div>

        )}

        <div ref={messagesEndRef} />

      </div>

      <div className="row" style={{ marginTop: 12 }}>

        <input

          style={{ flex: 1 }}

          value={message}

          onChange={(e) => setMessage(e.target.value)}

          placeholder="Ask a question..."

          onKeyPress={(e) => e.key === "Enter" && sendMessage()}

        />

        <button onClick={sendMessage} disabled={loading || !message.trim()} style={{ borderColor: "#818cf8", color: "#818cf8" }}>

          Send

        </button>

      </div>

    </div>

  );

}



function StudyReminders({ reminders, setReminders, timetable, notificationPermission, setNotificationPermission, token }) {

  const [newReminderTime, setNewReminderTime] = useState("");

  const [newReminderLabel, setNewReminderLabel] = useState("");

  const [newReminderSubject, setNewReminderSubject] = useState("");




  useEffect(() => {

    if ("Notification" in window && Notification.permission !== "granted") {

      Notification.requestPermission().then((perm) => setNotificationPermission(perm));

    }

  }, []);




  useEffect(() => {

    const interval = setInterval(() => {

      const now = new Date();

      reminders.forEach((r) => {

        if (!r.sent && new Date(r.time) <= now) {

          if (notificationPermission === "granted") {

            new Notification("📚 Study Reminder", { body: r.label, icon: "/loading.png" });

          }

          setReminders((prev) => prev.map((rem) => rem.id === r.id ? { ...rem, sent: true } : rem));

        }

      });

    }, 30000);

    return () => clearInterval(interval);

  }, [reminders, notificationPermission, setReminders]);




  function addReminder() {

    if (!newReminderTime || !newReminderLabel) {

      alert("Please enter both time and label");

      return;

    }

    const reminder = {

      id: Date.now(),

      time: newReminderTime,

      label: newReminderLabel,

      subject: newReminderSubject,

      sent: false,

    };

    setReminders([...reminders, reminder]);

    if (token) {

      api("/user-data/reminders", { token, method: "POST", body: reminder }).catch(console.error);

    }

    setNewReminderTime("");

    setNewReminderLabel("");

    setNewReminderSubject("");

  }



  function deleteReminder(id) {

    setReminders(reminders.filter((r) => r.id !== id));

    if (token) {

      api(`/user-data/reminders/${id}`, { token, method: "DELETE" }).catch(console.error);

    }

  }



  function requestPermission() {

    if ("Notification" in window) {

      Notification.requestPermission().then((perm) => setNotificationPermission(perm));

    }

  }



  const timetableReminders = Object.entries(timetable).flatMap(([day, slots]) =>

    Object.entries(slots).map(([hour, subject]) => ({

      label: `Study ${subject} from Timetable`,

      subject,

      day,

      hour: parseInt(hour),

    }))

  );



  return (

    <div className="card">

      <div className="row">

        <h2>Study Reminders</h2>

        <div className="row" style={{ gap: 8 }}>

          <span className="muted">Notifications: {notificationPermission}</span>

          {notificationPermission !== "granted" && <button onClick={requestPermission}>Enable</button>}

        </div>

      </div>

      <div className="row" style={{ flexWrap: "wrap" }}>

        <input type="datetime-local" value={newReminderTime} onChange={(e) => setNewReminderTime(e.target.value)} />

        <input

          placeholder="Label (e.g., 'Review BIO111')"

          value={newReminderLabel}

          onChange={(e) => setNewReminderLabel(e.target.value)}

          style={{ flex: 1, minWidth: 200 }}

        />

        <select value={newReminderSubject} onChange={(e) => setNewReminderSubject(e.target.value)}>

          <option value="">No Subject</option>

          {SUBJECTS.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}

        </select>

        <button onClick={addReminder} style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}>+ Add</button>

      </div>

      {timetableReminders.length > 0 && (

        <div style={{ marginTop: 16 }}>

          <h4>Timetable Suggestions</h4>

          <p className="muted" style={{ fontSize: 13 }}>Click to add reminder for scheduled study time:</p>

          <div className="history">

            {timetableReminders.slice(0, 5).map((r, i) => {

              const [hours, minutes] = r.hour.toString().padStart(2, '0').match(/.{1,2}/g) || ['00', '00'];

              const nextOccurrence = new Date();

              nextOccurrence.setHours(parseInt(hours), parseInt(minutes), 0, 0);

              if (nextOccurrence <= new Date()) nextOccurrence.setDate(nextOccurrence.getDate() + 1);

              return (

                <div key={i} className="history-row">

                  <span>{r.day} {hours}:{minutes} — {r.label}</span>

                  <button style={{ fontSize: 12 }} onClick={() => {

                    setNewReminderTime(nextOccurrence.toISOString().slice(0, 16));

                    setNewReminderLabel(r.label);

                    setNewReminderSubject(r.subject);

                  }}>Add Reminder</button>

                </div>

              );

            })}

          </div>

        </div>

      )}

      <h4 style={{ marginTop: 20 }}>Your Reminders ({reminders.length})</h4>

      {reminders.length === 0 && <p className="muted">No reminders set yet.</p>}

      <div className="history">

        {reminders.sort((a, b) => new Date(a.time) - new Date(b.time)).map((r) => {

          const isPast = new Date(r.time) < new Date();

          return (

            <div key={r.id} className="history-row" style={{ opacity: r.sent ? 0.5 : 1 }}>

              <span>

                {r.sent ? "✅" : isPast ? "⏰" : "📅"} {r.label} — {new Date(r.time).toLocaleString()}

                {r.subject && <span className="muted"> ({r.subject})</span>}

              </span>

              <button className="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => deleteReminder(r.id)}>Delete</button>

            </div>

          );

        })}

      </div>

    </div>

  );

}


function KeyManagement({ token }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, activated
  const [search, setSearch] = useState("");
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState("month1");

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await api("/keys/students", { token });
      setStudents(data);
    } catch (e) {
      console.error("Failed to load students:", e);
    }
    setLoading(false);
  }

  useEffect(() => { loadStudents(); }, []);

  async function activate(userId, duration = "month1") {
    try {
      await api(`/keys/activate/${userId}`, { token, method: "POST", body: { duration } });
      loadStudents();
      setShowActivateModal(false);
      setSelectedStudent(null);
      setSelectedDuration("month1");
    } catch (e) {
      alert(e.message);
    }
  }

  async function deactivate(userId) {
    try {
      await api(`/keys/deactivate/${userId}`, { token, method: "POST" });
      loadStudents();
    } catch (e) {
      alert(e.message);
    }
  }

  const filtered = students.filter((s) => {
    if (filter === "pending" && s.isActivated) return false;
    if (filter === "activated" && !s.isActivated) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.username.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.activationKey || "").toLowerCase().includes(q);
    }
    return true;
  });

  const pendingCount = students.filter((s) => !s.isActivated).length;
  const activeCount = students.filter((s) => s.isActivated).length;

  return (
    <div className="card">
      <h2>🔑 Student Key Management</h2>
      <p className="muted">{students.length} students total · <strong style={{ color: "#facc15" }}>{pendingCount} pending</strong> · <strong style={{ color: "#34d399" }}>{activeCount} activated</strong></p>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or key..."
          style={{ flex: 1, minWidth: 180 }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Students</option>
          <option value="pending">Pending Activation</option>
          <option value="activated">Activated</option>
        </select>
        <button onClick={loadStudents} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading && !students.length ? (
        <p className="muted">Loading students...</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No students found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Student</th>
                <th style={{ padding: "8px 6px" }}>Key</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
                <th style={{ padding: "8px 6px" }}>Activated</th>
                <th style={{ padding: "8px 6px" }}>Joined</th>
                <th style={{ padding: "8px 6px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "8px 6px" }}>
                    <strong>{s.username}</strong>
                    <br />
                    <span className="muted" style={{ fontSize: 11 }}>{s.email}</span>
                  </td>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace", letterSpacing: 1, color: "#facc15" }}>
                    {s.activationKey || "—"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {s.isExpired ? (
                      <span style={{ color: "#f87171", fontWeight: 600 }}>● Expired</span>
                    ) : s.isActivated ? (
                      <span style={{ color: "#34d399", fontWeight: 600 }}>● Active</span>
                    ) : (
                      <span style={{ color: "#f87171", fontWeight: 600 }}>○ Pending</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 6px", fontSize: 11 }}>
                    {s.isActivated && s.activatedAt ? (
                      <>
                        {new Date(s.activatedAt).toLocaleDateString()} {new Date(s.activatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <br />
                        <span className="muted">by {s.activatedByUsername}</span>
                        {s.planType && (
                          <>
                            <br />
                            <span style={{ color: "#facc15" }}>
                              {s.planType === "week1" ? "1 Week" : s.planType === "week2" ? "2 Weeks" : "1 Month"}
                            </span>
                          </>
                        )}
                        {s.activationExpiry && (
                          <>
                            <br />
                            <span className="muted">
                              Expires: {new Date(s.activationExpiry).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "8px 6px", fontSize: 11 }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {s.isActivated ? (
                      <button
                        onClick={() => deactivate(s.id)}
                        style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedStudent(s); setShowActivateModal(true); }}
                        style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showActivateModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowActivateModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Activate {selectedStudent.username}</h3>
            
            <p className="muted" style={{ marginBottom: 16 }}>Select activation duration:</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div
                onClick={() => setSelectedDuration("week1")}
                style={{
                  border: selectedDuration === "week1" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  background: selectedDuration === "week1" ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>1 Week</div>
                    <div className="muted" style={{ fontSize: 12 }}>₦700</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>7 days</div>
                </div>
              </div>

              <div
                onClick={() => setSelectedDuration("week2")}
                style={{
                  border: selectedDuration === "week2" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  background: selectedDuration === "week2" ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>2 Weeks</div>
                    <div className="muted" style={{ fontSize: 12 }}>₦1,300</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>14 days</div>
                </div>
              </div>

              <div
                onClick={() => setSelectedDuration("month1")}
                style={{
                  border: selectedDuration === "month1" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  background: selectedDuration === "month1" ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.05)",
                  transition: "all 0.2s",
                  position: "relative"
                }}
              >
                <div style={{ position: "absolute", top: -10, right: 10, background: "#10b981", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>POPULAR</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>1 Month</div>
                    <div className="muted" style={{ fontSize: 12 }}>₦2,400</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>30 days</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowActivateModal(false); setSelectedStudent(null); setSelectedDuration("month1"); }}
                style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => activate(selectedStudent.id, selectedDuration)}
                style={{ background: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LockedScreen({ activationKey, username, onLogout, onTryDemo }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🔒</div>
        <h2>Account Pending Activation</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Welcome, <strong>{username}</strong>! Your account has been created but is not yet activated.
          A teacher must activate your key before you can access the full app.
        </p>
        <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Your Activation Key</p>
          <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, color: "#facc15", letterSpacing: 3 }}>
            {activationKey || "—"}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Share this key with your teacher to get activated</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 13, margin: 0 }}>
            While you wait, here's what you'll get access to:
          </p>
          <ul style={{ textAlign: "left", fontSize: 12, margin: "8px 0 0 16px", lineHeight: 1.8 }}>
            <li>All subject exams & practice modes</li>
            <li>AI Tutor & flashcards</li>
            <li>Timetable builder & study planner</li>
            <li>Discussion board & much more</li>
          </ul>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onTryDemo} style={{ padding: "8px 24px", background: "#2dd4a0", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Try Demo Mode
          </button>
          <button onClick={onLogout} style={{ padding: "8px 24px" }}>Log Out</button>
        </div>
      </div>
    </div>
  );
}

export default App;
