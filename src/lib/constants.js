export const NOTES_KEY = "sc_user_notes_v1";
export const CUSTOM_QUESTIONS_KEY = "sc_custom_questions_v1";
export const AI_DOCS_KEY = "sc_ai_study_assistant_v1";
export const LECTURE_NOTES_KEY = "sc_lecture_notes_v1";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

export const EMPTY_STATS = {
  xp: 0,
  sessions: 0,
  streak: 0,
  coins: 0,
  weeklyGoal: 5,
  questsDone: {},
  totalCorrect: 0,
};

export const EMPTY_QUESTS = [
  { id: "q1", label: "Complete 1 study session", target: 1, type: "sessions" },
  { id: "q2", label: "Get 3 correct answers", target: 3, type: "correct" },
  { id: "q3", label: "Complete 3 sessions today", target: 3, type: "sessions" },
  { id: "q4", label: "Score 80% or above in an exam", target: 80, type: "score" },
  { id: "q5", label: "Study 2 different subjects", target: 2, type: "subjects" },
  { id: "q6", label: "Get 10 correct answers", target: 10, type: "correct" },
  { id: "q7", label: "Complete Spaced Review", target: 1, type: "spaced" },
  { id: "q8", label: "Use the AI Helper once", target: 1, type: "ai" },
];

export const LEAGUES = [
  { id: "bronze", name: "Bronze", icon: "🥉", minXP: 0, color: "#cd7f32" },
  { id: "silver", name: "Silver", icon: "🥈", minXP: 200, color: "#c0c0c0" },
  { id: "gold", name: "Gold", icon: "🥇", minXP: 500, color: "#ffd700" },
  { id: "platinum", name: "Platinum", icon: "💎", minXP: 1000, color: "#e5e4e2" },
  { id: "diamond", name: "Diamond", icon: "💠", minXP: 2500, color: "#b9f2ff" },
  { id: "champion", name: "Champion", icon: "👑", minXP: 5000, color: "#ff6b6b" },
];

export const TEST_USERS = [
  { username: "teacher", password: "teacher123", role: "teacher", isActivated: true },
  { username: "student", password: "student123", role: "student", isActivated: false },
];

export const FREE_TIER_LIMITS = {
  trialDays: 2,                      // full-access trial window
  aiTutorDaily: 5,                   // AI Tutor messages per day (post-trial)
  summariesTotal: 5,                 // lifetime AI summaries (post-trial)
  mcqGensTotal: 5,                   // lifetime Rapid Recall generations (post-trial)
  guidedStudiesTotal: 2,             // lifetime guided study sessions (post-trial)
  survivalHeartsBeforeCooldown: 6,   // hearts lost before the cooldown kicks in
  survivalCooldownMinutes: 10,       // wait before new practice/survival sessions
};

export const FREE_TIER_ACHIEVEMENTS = [
  { id: "trial_explorer", icon: "🗺️", label: "Trial Explorer", desc: "Visit 5 different tabs", check: (p) => p.tabsVisited.size >= 5 },
  { id: "feature_tester", icon: "🧪", label: "Feature Tester", desc: "Try 3 different features", check: (p) => p.featuresTried.size >= 3 },
  { id: "quiz_master", icon: "📝", label: "Quiz Master", desc: "Complete 3 practice sessions", check: (p, u) => u.practiceQuestions >= 3 },
  { id: "ai_curious", icon: "🤖", label: "AI Curious", desc: "Use AI Tutor once", check: (p, u) => u.aiMessages >= 1 },
  { id: "timetable_planner", icon: "📅", label: "Timetable Planner", desc: "Add 2 timetable slots", check: (p, u) => u.timetableSlots >= 2 },
  { id: "note_taker", icon: "📝", label: "Note Taker", desc: "Create a note", check: (p) => p.featuresTried.has("notes") },
  { id: "flashcard_flipper", icon: "🔄", label: "Flashcard Flipper", desc: "Review 5 flashcards", check: (p, u) => u.flashcardReviews >= 5 },
  { id: "trial_complete", icon: "🎯", label: "Trial Complete", desc: "Earn all free trial achievements", check: (p, u, a) => a.length >= 7 },
];

export const PRIMARY_TABS = ["today", "clinical-cases", "aitutor", "voice-tutor", "drug-ref", "lab-values", "medical-calculators", "analytics", "research-hub", "discuss"];

// Full-bleed screens that render their own floating exit pill — no global back header or bottom nav
export const BARE_TABS = [
  "settings", "refer", "profile", "premium",
  "timetable", "clinical-cases", "drug-ref", "lab-values", "medical-calculators",
];

// Simplified experience for LECTURER role: only these destinations exist
export const LECTURER_NAV_TABS = ["research-hub", "aitutor", "insights", "profile", "settings"];
// Reachable but not in nav: voice-tutor launches from materials; discuss stays
// reachable so DM deep-links still open the conversation view.
export const LECTURER_ALLOWED_TABS = [...LECTURER_NAV_TABS, "voice-tutor", "discuss"];
export const LECTURER_HOME_TAB = "research-hub";

export const TAB_LABELS = {
  today: "🏠 Home", dashboard: "🏠 Home", aitutor: "🤖 AI Tutor",
  analytics: "📊 Progress", classroom: "🏫 Classroom",
  outline: "📋 Course Outline", keys: "🔑 Keys", invites: "✉️ Invites", admin: "⚙️ Admin",
  flashcards: "🃏 Flashcards", lecturers: "👨‍⚕️ Clinicians",
  leaderboard: "🏆 Leaderboard", gamification: "⚔️ Arena",
  notes: "📝 Notes", achievements: "🏅 Badges", timetable: "🗓️ Schedule",
  cheatsheet: "🦉 Cheat Sheet", discuss: "💬 Discussion", settings: "⚙️ Settings",
  profile: "👤 Profile", lectures: "🎓 Lectures",
  pastpapers: "📄 Past Papers", notifications: "🔔 Notifications",
  "teacher-questions": "📝 My Questions", "campus-comm": "📢 Announcements",
  premium: "💎 Premium",
  "clinical-cases": "🩺 Clinical Cases",
  "drug-ref": "💊 Drug Reference", "lab-values": "🧪 Lab Values",
  "medical-calculators": "🧮 Med Calculators",
  "voice-tutor": "🎙️ Voice Tutor",
  insights: "📊 Insights",
};
