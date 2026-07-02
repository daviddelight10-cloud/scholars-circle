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

export const BADGES = [
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

export const LEAGUES = [
  { id: "bronze", name: "Bronze", icon: "🥉", minXP: 0, color: "#cd7f32" },
  { id: "silver", name: "Silver", icon: "🥈", minXP: 200, color: "#c0c0c0" },
  { id: "gold", name: "Gold", icon: "🥇", minXP: 500, color: "#ffd700" },
  { id: "platinum", name: "Platinum", icon: "💎", minXP: 1000, color: "#e5e4e2" },
  { id: "diamond", name: "Diamond", icon: "💠", minXP: 2500, color: "#b9f2ff" },
  { id: "champion", name: "Champion", icon: "👑", minXP: 5000, color: "#ff6b6b" },
];

export const DEMO_USERS = [
  { username: "teacher", password: "teacher123", role: "teacher", isActivated: true },
  { username: "student", password: "student123", role: "student", isActivated: false },
];

export const DEMO_LIMITS = {
  aiMessages: 5,
  practiceQuestions: 10,
  questionBankQuestions: 5,
  flashcardReviews: 10,
  timetableSlots: 3,
  reminders: 2,
  allowedTabs: ["today", "subjects", "quiz", "settings"],
  dailyTimeLimit: 30,
  totalSessions: 5,
  exportEnabled: false,
  analyticsDepth: "basic",
  trialDays: 2,
  masteryCap: 70,
  maxStreak: 7,
  allowedDifficulties: ["easy", "medium"],
  maxSpacedReviewCards: 5,
  maxCustomFlashcardDecks: 1,
  allowedThemes: ["aurora", "paper", "gold"],
  premiumThemes: ["neon"],
  leaderboardAccess: false,
  studyGroupsAccess: false,
  pastPapersLimit: 1,
  aiTutorMessages: 3,
  classroomAccess: false,
  pomodoroSessions: 2,
  notesLimit: 5,
  hidePremiumTabs: true,
  aiStudyAssistantDaily: 1,
  lectureToNotesDaily: 1,
  questionBankLocked: true,
  quizDaily: 5,
};

export const DEMO_ACHIEVEMENTS = [
  { id: "demo_explorer", icon: "🗺️", label: "Demo Explorer", desc: "Visit 5 different tabs", check: (p) => p.tabsVisited.size >= 5 },
  { id: "feature_tester", icon: "🧪", label: "Feature Tester", desc: "Try 3 different features", check: (p) => p.featuresTried.size >= 3 },
  { id: "quiz_master", icon: "📝", label: "Quiz Master", desc: "Complete 3 practice sessions", check: (p, u) => u.practiceQuestions >= 3 },
  { id: "ai_curious", icon: "🤖", label: "AI Curious", desc: "Use AI Tutor once", check: (p, u) => u.aiMessages >= 1 },
  { id: "timetable_planner", icon: "📅", label: "Timetable Planner", desc: "Add 2 timetable slots", check: (p, u) => u.timetableSlots >= 2 },
  { id: "note_taker", icon: "📝", label: "Note Taker", desc: "Create a note", check: (p) => p.featuresTried.has("notes") },
  { id: "flashcard_flipper", icon: "🔄", label: "Flashcard Flipper", desc: "Review 5 flashcards", check: (p, u) => u.flashcardReviews >= 5 },
  { id: "demo_complete", icon: "🎯", label: "Demo Complete", desc: "Earn all demo achievements", check: (p, u, a) => a.length >= 7 },
];

export const PRIMARY_TABS = ["today", "practice", "aitutor", "analytics", "premium"];

export const TAB_LABELS = {
  today: "🏠 Home", dashboard: "🏠 Home", practice: "📚 Learn", aitutor: "🤖 AI Tutor",
  analytics: "📊 Progress", studypaths: "🛣️ Study Paths", learn: "📚 Learn", classroom: "🏫 Classroom",
  bank: "🏦 Questions", planner: "📅 Planner",
  outline: "📋 Course Outline", keys: "🔑 Keys", invites: "✉️ Invites", admin: "⚙️ Admin",
  flashcards: "🃏 Flashcards", lecturers: "👨‍🏫 Lecturers", reminders: "🔔 Reminders",
  leaderboard: "🏆 Leaderboard", gamification: "⚔️ Arena", studygroups: "👥 Study Groups",
  notes: "📝 Notes", achievements: "🏅 Badges", timetable: "🗓️ Timetable",
  cheatsheet: "🦉 Cheat Sheet", discuss: "💬 Discussion", settings: "⚙️ Settings",
  profile: "👤 Profile", pomodoro: "⏱️ Focus Timer", lectures: "🎓 Lectures",
  pastpapers: "📄 Past Papers", notifications: "🔔 Notifications",
  "teacher-questions": "📝 My Questions", "campus-comm": "📢 Announcements",
  premium: "💎 Premium",
};
