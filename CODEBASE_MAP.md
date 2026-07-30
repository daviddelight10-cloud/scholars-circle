# Scholar's Circle — Complete Codebase Architecture Map

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   SCHOLAR'S CIRCLE                           │
│             Medical Education PWA Platform                   │
├──────────────────┬──────────────────────────────────────────┤
│  FRONTEND (SPA)  │           BACKEND (REST API)             │
│  React 18 + Vite │           Express + Prisma               │
│  TailwindCSS v4  │           PostgreSQL (Railway)           │
│  PWA (SW + WB)   │           WebSocket (Voice Tutor)        │
├──────────────────┴──────────────────────────────────────────┤
│  AUTH: Supabase Auth (JWT)                                  │
│  STORAGE: Supabase Storage + LocalStorage (offline)         │
│  AI: Backend AI Proxy → OpenRouter / Gemini / OpenAI        │
│  PAYMENTS: Paystack (Nigeria)                               │
└─────────────────────────────────────────────────────────────┘
```

**Tech Stack**: React 18, Vite 5, TailwindCSS 4, react-router-dom 7, lucide-react, pdfjs-dist, jspdf, dompurify, @supabase/supabase-js, @paystack/inline-js, vite-plugin-pwa, workbox. Backend: Express, Prisma, ws (WebSocket), helmet, cors, cookie-parser, firebase-admin (FCM push).

---

## 2. Boot Sequence

```
main.jsx
│
├── Import lazyWithRetry.js (stale SW chunk recovery)
├── Disable pinch-zoom / double-tap-zoom app-wide
│   (except inside .zoom-allowed elements like PDF viewer)
├── Register Service Worker (/sw.js)
│   ├── Update check every 5 min + on visibilitychange
│   └── On controllerchange → reload page
└── ReactDOM.createRoot(#root)
    └── <BrowserRouter>
        └── <ToastProvider>
            └── <AppRouter />
```

### Routes (AppRouter.jsx)

```
"/"              → LandingPageWrapper (redirect to /app if logged in, else HomePage)
"/features"      → LandingPageWrapper
"/pricing"       → LandingPageWrapper
"/login"         → <App /> (shows auth forms)
"/signup"        → <App /> (shows auth forms)
"/app"           → <App /> (main authenticated app)
"/resources"     → <ResearchHub /> (standalone)
"/resources/:token" → <ResourceViewer /> (shared resource link)
"/teacher/resources" → <TeacherResourcesHub />
"/teacher/resources/upload" → <ResourceUploadForm />
"/folders/:shareToken" → <SharedFolderView />
"*"              → <Navigate to="/" />
```

---

## 3. Context Providers

```
AuthProvider (AuthContext)
├── State: mode, email, username, password, user, token, session, authReady
├── On mount: supabase.auth.getSession() → restore session
├── Subscribes: supabase.auth.onAuthStateChange()
│   ├── SIGNED_OUT/USER_DELETED → clear session
│   ├── PASSWORD_RECOVERY → set session
│   └── Other → set session + token
├── Exposes: supabase client, isFaculty, isTeacher
└── Reducer: SET_MODE, SET_USER, SET_TOKEN, SET_SESSION, LOGOUT, etc.

UserDataProvider (UserDataContext)
├── State: stats, history, subjects, assignments, timetable, notes,
│          mastery, srData, wrongCounts, customFlashcards, outlineProgress
├── In-memory only; App.jsx handles localStorage persistence
└── Reducer: SET_STATS, UPDATE_STATS, SET_HISTORY, SET_SUBJECTS, etc.

UIProvider (UIContext)
├── State: tab, darkMode, showMobileMenu, demoMode, demoUsage,
│          progressSubTab, resourcesSubTab, aiTutorSubTab, aiConfig, etc.
├── In-memory only; App.jsx handles persistence + side effects
└── Reducer: SET_TAB, TOGGLE_DARK_MODE, SET_DEMO_MODE, etc.

Context Sync Bridge (App.jsx):
  App.jsx local state → Context providers via useEffect hooks
  e.g., ctxAuth.setUser(auth.user)
        ctxUserData.setStats(stats)
        ctxUI.setTab(tab)
  Page components consume via hooks (useAuth, useUserData, useUI)
```

---

## 4. App.jsx — Core Application (~10,200 lines)

### 4.1 State Management

```
AUTH STATE:
  auth: { mode, email, username, password, signupRole, inviteCode, user, error, info }
  token (JWT), authRestored
  Derived: userRole, isTeacher, isLecturerRole, isFaculty, isActivated

STUDY STATE:
  stats: { xp, sessions, streak, coins, weeklyGoal, totalCorrect, questsDone }
  history: [{ subjectId, score, total, mode, ts, seconds }]
  wrongCounts: { questionKey: count }
  mastery: { subjectId: percentage }
  srData: { questionKey: { due, interval, easeFactor, reps } }  (SM-2)
  subjects: merged from local SUBJECTS + backend + custom questions
  allQuestions: flattened from subjects
  dueCards: filtered where srData[key].due <= now

UI STATE:
  tab, sidebarCollapsed, showMobileMenu, fabOpen
  darkMode, themePack, density, headerExpanded
  showOnboarding, showPaymentModal, showDeleteModal, loadingOverlay

DEMO MODE STATE:
  demoMode, demoUsage (daily counters), demoLocked
  DEMO_LIMITS: { aiMessages:5, quizDaily:5, dailyTimeLimit:30min, masteryCap:70%, ... }

RESOURCE STATE:
  notes, customFlashcards, customQuestions, outlineProgress, timetable, discussion

AI STATE:
  aiConfig: { provider, model, apiKey }
  aiChatHistory, aiDefaultView, aiStudyTopic, aiStudyMode, aiStudyAttachment

NOTIFICATION STATE:
  notificationSettings, notificationPermission, reminders

PAYMENT STATE:
  selectedPlan, paymentMethod (paystack), PAYSTACK_PUBLIC_KEY

ACTIVE SESSION STATE:
  activeSession: { mode, source, questions, currentQ, answers, startTime }
  examQuestionCount, examCustomMinutes, showCheckpoint
```

### 4.2 Tab Navigation

```
PRIMARY_TABS = ["today", "clinical-cases", "osce", "aitutor", "voice-tutor",
                "drug-ref", "lab-values", "medical-calculators", "analytics",
                "research-hub"]

Tab Redirects (consolidation):
  leaderboard/achievements/gamification → analytics (with subTab)
  learn/bank/practice/pastpapers/studypaths → research-hub
  notes/flashcards/cheatsheet/outline → resources (with subTab)

Tab → Component Map:
  "today"              → <Home />
  "dashboard"          → inline learning paths + subject mastery rings
  "aitutor"            → <AITutorPage /> (chat, learn, study modes)
  "voice-tutor"        → <VoiceTutorPage /> (Gemini Live API)
  "analytics"          → <Progress /> (stats, leaderboard, badges, arena)
  "research-hub"       → <ResearchHub /> (resource library, folders, reviews)
  "resources"          → <Resources /> (notes, flashcards, cheatsheet, outline)
  "classroom"          → <ClassroomPage />
  "clinical-cases"     → <ClinicalCases />
  "osce"               → <OSCEPrep />
  "drug-ref"           → <DrugReference />
  "lab-values"         → <LabValues />
  "medical-calculators"→ <MedicalCalculators />
  "lectures"           → <LectureToNotes />
  "studygroups"        → <StudyGroups />
  "discuss"            → <DiscussionBoard />
  "timetable"          → <TimetableBuilder />
  "profile"            → <Profile />
  "settings"           → inline settings UI
  "premium"            → <PremiumPage /> (students only)
  "notifications"      → <NotificationsTab />

FACULTY-ONLY:
  "teacher-questions"  → <TeacherQuestionManager />
  "teacher-resources"  → <TeacherResourcesHub />
  "campus-comm"        → <CampusComm />
  "departments"        → <DepartmentManager />
  "lecturers"          → <Lecturers />

TEACHER-ONLY (admin):
  "keys"               → <KeyManagement />
  "invites"            → <TeacherInvitesPanel />
  "admin"              → <AdminDashboard />
```

### 4.3 Auth Flow

```
LOGIN:
  1. supabase.auth.signInWithPassword({ email, password })
  2. Supabase returns session { access_token, user }
  3. AuthContext: SET_SESSION + SET_TOKEN
  4. App.jsx: GET /auth/me (Bearer token) → user profile
  5. App.jsx: GET /user-data → load stats, mastery, srData, etc.
  6. Merge backend data with localStorage
  7. Redirect to /app

SIGNUP:
  1. If TEACHER/LECTURER → validate inviteCode
  2. supabase.auth.signUp({ email, password, options: { data: { username, role } } })
  3. POST /auth/profile → create Prisma User, link supabaseId
  4. If STUDENT → generate activation key
  5. Auto-login or "check email"

PASSWORD RESET:
  1. supabase.auth.resetPasswordForEmail(email)
  2. Email link → PASSWORD_RECOVERY event
  3. supabase.auth.updateUser({ password })

LOGOUT:
  1. supabase.auth.signOut()
  2. Clear localStorage auth keys
  3. Redirect to "/"

SESSION RESTORE (on page load):
  1. AuthContext: supabase.auth.getSession()
  2. If session → SET_SESSION + SET_TOKEN
  3. Subscribe to onAuthStateChange for ongoing changes
  4. App.jsx: authRestored=true → load user data from backend
```

### 4.4 Study Session Flow

```
Session Start (multiple entry points):
  startSubjectPractice(subjectId) → filter questions by subject, shuffle
  startAdaptive() → pickAdaptiveQuestion(pool, wrongCounts, mastery)
    weight = 1 + wrongCount + (mastery < 60 ? 2 : 0)
  startDiagnostic() → questions across all subjects, no feedback
  startWeakDrill() → filter where wrongCounts[key] > 0
  startSpacedReview() → dueCards where srData[key].due <= now
  startErrorDrill() → focus on error patterns

During Session:
  SessionPlayer/ExamSimulator renders question + options
  User selects answer → record in answers[]
  Show explanation (practice) or continue (exam)
  Update wrongCounts, mastery
  Checkpoint modal (exam mode, halfway)

Session End:
  1. Calculate score, percentage, duration
  2. Update stats: xp, coins, streak, sessions, totalCorrect, questsDone
  3. Add to history
  4. Update studyHeatmap
  5. Check badge unlocks (BADGES array .check(stats, history))
  6. Trigger celebration (confetti, toast, streak notification)
  7. Sync to backend: POST /user-data/sync
  8. Show PostSessionInsights (analytics breakdown)

XP Calculation:
  xp += correct * XP_PER_CORRECT * MODE_MULTIPLIERS[mode]
  coins += correct * COINS_PER_SESSION
  Streak bonus applied for consecutive days
```

### 4.5 Gamification

```
Leagues (by total XP):
  Bronze(0+) → Silver(200+) → Gold(500+) → Platinum(1000+)
  → Diamond(2500+) → Champion(5000+)

Badges (30+ in constants.js):
  Session: 1, 10, 25, 50, 100 sessions
  Streak: 3, 7, 14, 30, 100 days
  XP: 100, 500, 1000, 5000
  Accuracy: 50, 100, 500 correct
  Time: Night Owl(10pm+), Early Bird(<6am), Weekend Warrior, Midnight Oil
  Subject: Well Rounded(all subjects), Subject Master(10x one subject)
  Medical: Anatomy Master, Pharma Pro, Clinical Reasoner, OSCE Ready
  Mastery: 80%, 100%, All 80%
  Coins: 50, 100, 500
  Speed: exam < 2min, quiz < 30s
  Hidden: Comeback(7+ day break), Marathon(5 sessions/day), First Blood

Daily Quests (8):
  1 session, 3 correct, 3 sessions, 80%+ exam, 2 subjects,
  10 correct, spaced review, AI helper

Backend Gamification:
  Weekly Challenges (classroom-scoped)
  1v1 Duels (ChallengeDuel model, XP stake)
  Class Social Wall (posts + emoji reactions)
  Server-side Badge awards (UserBadge)

Celebrations:
  ConfettiOverlay, CelebrationToast, StreakLossWarning
  StudyHeatmap (GitHub-style calendar), LeagueProgress
```

### 4.6 Demo Mode

```
Activation: login with demo credentials → demoMode=true

Daily Limits (DEMO_LIMITS):
  aiMessages: 5, practiceQuestions: 10, quizDaily: 5
  dailyTimeLimit: 30 min, totalSessions: 5
  flashcardReviews: 10, lectureToNotesDaily: 1
  masteryCap: 70%, maxSpacedReviewCards: 5
  allowedDifficulties: ["easy", "medium"]
  leaderboardAccess: false, classroomAccess: false

Enforcement:
  DemoLockedOverlay when limits hit
  Daily reset at midnight (toDateString check)
  demoLocked flag when time/quiz limit reached
  Features gated: Study Groups, Classroom, Leaderboard

Demo Achievements (8):
  Demo Explorer, Feature Tester, Quiz Master, AI Curious,
  Timetable Planner, Note Taker, Flashcard Flipper, Demo Complete
```

---

## 5. Frontend Feature Modules

### 5.1 AI Tutor

```
AITutorPage (src/pages/AITutor.jsx)
├── ChatMode — conversational AI tutor
├── LearningRoom — structured learning with materials
├── MaterialMode — upload material → AI generates study content
├── GenerateMode — AI generates questions/flashcards
├── SimpleMode — quick Q&A

AI Client (src/lib/aiClient.js):
  getProxyStatus() → checks backend /health
  callViaProxy(prompt, provider, model) → POST /ai-proxy/generate
  Falls back to direct API call if user has client-side API key
  Providers: openrouter (default), gemini, openai

Secure AI Client (src/lib/aiClientSecure.js):
  callAISecure() → always uses backend proxy (keys never exposed)
  extractJSON() → parse AI responses with code blocks

Sub-modules: disciplines.js, prompts.js, fileExtract.js, useAITutor.js, voice.js, youtubeApi.js

Lecture to Notes: upload audio/video → AI transcribes → notes + flashcards + key terms
```

### 5.2 Voice Tutor (Gemini Live API)

```
VoiceTutorPage (src/features/voice-tutor/)
├── useVoiceSession.js:
│   ├── POST /api/voice-session { resourceId, mode }
│   ├── Connect WebSocket: /api/voice-session/:id/ws?token=JWT
│   ├── Capture mic (16kHz PCM) → send as { type: "audio", data: base64 }
│   ├── Server relays to Gemini Live API WebSocket
│   ├── Receive audio responses → play via AudioContext
│   ├── Text responses → transcript
│   ├── Interrupt support, page_change context
│   └── Modes: "teach" | "quiz" | "discuss"
├── UI: VoiceOrb, TranscriptDrawer, ConceptsDrawer, MaterialsDrawer
└── Server: Gemini Live WS relay, 30s grace period on disconnect
```

### 5.3 Research Hub

```
ResearchHub (src/features/research-hub/ResearchHub.jsx)
├── Views: Library, Department, SubjectDetail, FolderDetail
│   DailyReview, FsrsReviewDashboard, RetentionDashboard, ProgressDashboard
├── Resource Types: note, pdf, mcq, tutorial_question, flashcard_deck
├── Upload: UploadModal, UploadWizard, useMaterialGenerate (AI-generated materials)
├── ResourceViewer: PDF rendering (pdfjs-dist), PdfReader (293KB full reader)
│   ├── Annotation, AI page summaries, flashcard/MCQ generation
│   └── Voice tutor integration (open on specific page)
├── Spaced Repetition:
│   ├── SM-2 (ReviewQueueItem) — for MCQ resources
│   │   easinessFactor, intervalDays, repetitions, quality
│   └── FSRS (PdfReviewItem) — for PDF resources
│       state: new/learning/review/relearning, stability, difficulty
│       UserFsrsProfile — personalized weights, target retention
├── Folders: private/shared/link, share via /folders/:shareToken
│   FolderQuizAttempt — quiz across folder resources
└── Engagement: views, bookmarks, ratings, comments, quiz attempts
    Free trial: 3 free views for non-activated users
```

### 5.4 Enhanced Session / Exam Simulator

```
EnhancedSession (src/features/EnhancedSession/)
├── ExamSimulator: timer, question count, checkpoint, auto-submit
├── SmartEngine: selectAdaptiveQuestions, difficulty balancing, weakness targeting
└── PostSessionInsights: score by topic, time analysis, AI recommendations
```

### 5.5 Classroom

```
ClassroomPage (src/components/Classroom.jsx)
├── Faculty: create classrooms, manage members, announcements
│   upload documents, share links, create exams/assignments
│   grade assignments, start live sessions, create polls
├── Students: view content, download, submit assignments
│   join live sessions, vote in polls, view grades
├── Live Sessions: Jitsi Meet (room: sc-<random>), attendance tracking
│   status: scheduled → live → ended, recording URL
├── Assignments: text/file/both, submissions, grading, due dates
└── Backend: /classroom, /classroom-assignments, /live-sessions, /polls
```

### 5.6 Medical Reference Tools

```
ClinicalCases — AI-generated clinical case simulations
OSCEPrep — clinical examination practice stations
DrugReference — searchable drug database
LabValues — reference ranges with interpretation
MedicalCalculators — BMI, GFR, creatinine clearance, etc.
```

### 5.7 Notification System

```
NotificationBell + NotificationsTab
├── Classroom announcements, assignment due dates, live session reminders
├── Direct messages, study reminders, streak warnings
├── Push: Firebase Cloud Messaging (FCM), pushClient.js + firebase.js
│   Subscribe: POST /push/subscribe (fcmToken)
│   Server: firebase-admin, StudyReminderJob cron
│   NotificationPreference: per-category opt-in/out
└── NotificationSettings: configure reminder types + times
```

### 5.8 Payment / Premium

```
PremiumPage (src/features/PremiumPage.jsx)
├── Plans: week1, week2, month1
├── Flow: select plan → Paystack inline popup → POST /payment/verify
│   Server verifies with Paystack → update User (isActivated, planType, expiry)
├── Expiry: week1=7d, week2=14d, month1=30d
│   Warnings: ≤7d yellow, ≤3d red, ≤0d expired
└── Alternative: Teacher activation keys (no expiry, manual)
    Teacher generates key → student shares → teacher activates via /keys/activate
```

---

## 6. Backend Architecture

### 6.1 Server Setup

```
server/src/index.js
├── Init: dotenv, configurePush(), startStudyReminderJob(), seedBadges()
├── Middleware: helmet(CSP), cookieParser, express.json(10mb, rawBody for Paystack)
│   cors (whitelist ALLOWED_ORIGINS), static /uploads
├── Health: GET /health → { ok, database }
├── 31 route files mounted (see below)
├── WebSocket: /api/voice-session/:id/ws (Gemini Live relay)
│   Auth: verify Supabase JWT from query param
│   Relay: client audio ↔ Gemini, 30s grace period
├── Error handler: production=generic, dev=message+stack
└── Graceful shutdown: SIGTERM/SIGINT → prisma.$disconnect()
    uncaughtException/unhandledRejection → exit(1)
```

### 6.2 Auth Middleware

```
requireAuth(req, res, next):
  1. Extract token: Bearer header → cookie → query param
  2. verifySupabaseToken(token) → JWT verify
  3. Fast path: prismaId in app_metadata → req.user set
  4. Slow path: DB lookup by supabaseId (5-min in-memory cache)
  5. If no user → 403 PROFILE_NOT_FOUND

requireRole(...roles): check req.user.role in allowed roles
invalidateUserCache(supabaseId): called on profile updates
```

### 6.3 API Routes (31 files)

```
/auth              — login, signup, profile, password reset
/subjects          — CRUD subjects (faculty)
/questions         — CRUD questions (faculty)
/sessions          — record session attempts
/assignments       — legacy assignments
/challenges        — peer challenges
/analytics         — analytics queries
/users             — user management
/ai                — direct AI calls (legacy)
/user-data         — sync/load user progress (stats, mastery, srData, notes, timetable)
/keys              — activation key generation + activation
/classroom         — classrooms, members, announcements, documents, links, exams
/lecturers         — lecturer profiles, ratings, posts, DMs
/teacher-invites   — invite code generation + validation
/live-sessions     — schedule, start, end, attendance
/classroom-assignments — assignments, submissions, grading
/polls             — create, vote, end live polls
/push              — FCM push subscription + notifications
/gamification      — leagues, duels, weekly challenges, badges, wall
/wall              — class social wall posts + reactions
/youtube           — YouTube video search for subjects
/announcements     — campus-wide announcements + comments
/ai-proxy          — secure AI proxy (OpenRouter/Gemini/OpenAI, keys server-side)
/api/resources     — resource CRUD, views, bookmarks, ratings, comments, quiz attempts (80KB file!)
/api/folders       — folder CRUD, sharing, bookmarks, quiz attempts
/api/departments   — department CRUD
/api/universities  — university CRUD + departments
/api/profile       — user profile CRUD
/api/topics        — subject topics CRUD
/api/mastery       — subject mastery tracking
/payment           — Paystack payment + verification + webhook
/api/voice-session — voice tutor session CRUD + WebSocket
```

### 6.4 Database Schema (40+ models)

```
CORE:
  User (STUDENT/TEACHER/LECTURER) ← central, links to everything
  UserProfile (university, dept, bio, learning style, goals)
  University → Department → Subject → Topic → Question
  UserDepartment (user ↔ dept, year level, semester)

STUDY DATA:
  SessionAttempt → AttemptAnswer (per-question)
  UserProgress (xp, streak, coins, mastery JSON, srData JSON)
  UserTimetable, CustomFlashcard, UserNote, CourseOutlineProgress
  SubjectMastery, QuestionAttempt, QuizAttempt

CLASSROOM:
  Classroom → ClassroomMember, ClassroomLink, ClassroomAnnouncement
  ClassroomDocument → DocumentDownload
  Exam
  ClassroomAssignment → AssignmentSubmission (graded)
  LiveSession → SessionAttendance, LivePoll → PollVote
  WeeklyChallenge → WeeklyChallengeEntry
  ChallengeDuel → DuelAnswer (1v1, XP stake)

GAMIFICATION:
  UserLeague (tier, weeklyXP, promoted)
  Badge → UserBadge
  WallPost → WallReaction (class social wall)

LECTURER ECOSYSTEM:
  LecturerProfile (bio, qualifications, research areas, office hours)
  LecturerRating (1-5 stars), LecturerPost
  DirectMessage (user ↔ user)
  TeacherInvite (code-based faculty signup)

RESEARCH HUB:
  Resource (note/pdf/mcq/flashcard_deck, shareToken, isPremium)
  ResourceView, ResourceBookmark, ResourceRating, ResourceComment
  ReviewQueueItem (SM-2 spaced repetition for MCQs)
  PdfReviewItem (FSRS spaced repetition for PDFs)
  UserFsrsProfile (personalized FSRS weights, target retention)
  PdfFlashcard (AI-generated from PDFs)
  Folder → FolderBookmark, FolderDepartment, FolderQuizAttempt

CAMPUS:
  CampusAnnouncement → CampusAnnouncementRead → AnnouncementComment (threaded)
  PushSubscription, NotificationPreference

VOICE TUTOR:
  VoiceSession (transcript, mode, duration, resourceId)

AI:
  AiUsageLog (track AI calls per user)

ENUMS:
  Role: STUDENT, TEACHER, LECTURER
  PlanType: week1, week2, month1
  PaymentStatus: pending, verified, rejected
  AnnouncementCategory: IMPORTANT, LECTURES, GENERAL, UPDATE
  AnnouncementPriority: LOW, NORMAL, HIGH, CRITICAL
```

---

## 7. Data Flow Diagrams

### 7.1 User Data Sync

```
┌──────────┐     localStorage      ┌──────────┐     API calls      ┌──────────┐
│  App.jsx │ ────per-user key────→ │  Local   │ ←─GET /user-data──→ │  Prisma  │
│  state   │ ←──load on boot────── │  Storage │ ──POST /user-data/ │  DB      │
└──────────┘                       └──────────┘    sync (debounced) └──────────┘
     │                                                          │
     │ useEffect sync                                           │
     ↓                                                          ↓
┌──────────┐                                          ┌──────────┐
│ Context  │                                          │PostgreSQL│
│Providers │                                          │ (Railway)│
└──────────┘                                          └──────────┘
```

### 7.2 AI Request Flow

```
Frontend (aiClient.js)
│
├── getProxyStatus() → GET /health
│   If backend reachable → use proxy
│
├── callAI(prompt, config)
│   ├── Try: POST /ai-proxy/generate { prompt, provider, model }
│   │        Authorization: Bearer <supabase JWT>
│   │        → Server adds API key, calls provider, returns text
│   └── Fallback: direct API call with user's client-side key (if set)
│
└── Server (aiProxy.js):
    ├── requireAuth middleware
    ├── Rate limiting (aiRateLimit.js)
    ├── Provider routing: openrouter / gemini / openai
    ├── Server-side API keys (never exposed to client)
    ├── Log usage: AiUsageLog
    └── Return { text } to frontend
```

### 7.3 Resource Upload & View Flow

```
Upload:
  User selects file → UploadWizard
  → POST /api/resources/upload (multipart)
  → Server uploads to Supabase Storage
  → Creates Resource record (fileUrl, storagePath, shareToken)
  → Optional: AI generates MCQs/flashcards from content

View:
  User clicks resource → ResourceViewer
  → GET /api/resources/:token
  → If PDF → PdfReader (pdfjs-dist rendering)
  → If MCQ → McqQuizRunner / McqExamRunner
  → If flashcard → FlashcardDeckRunner
  → Track view: POST /api/resources/:id/view
  → Free trial: 3 views for non-activated users
  → If premium & not activated → show upgrade prompt
```

### 7.4 Spaced Repetition Flow

```
SM-2 (for MCQ resources):
  Answer question → quality (0-5)
  → Update ReviewQueueItem:
    easinessFactor = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
    interval = reps==0 ? 1 : reps==1 ? 6 : round(interval * EF)
    reps++, lastReviewed = now, dueAt = now + interval days

FSRS (for PDF resources):
  Review PDF page/flashcard/MCQ → rate (again/hard/good/easy)
  → Update PdfReviewItem:
    state: new→learning→review (or →relearning on lapse)
    stability, difficulty (FSRS algorithm parameters)
    nextReviewAt calculated from stability + desired retention
  → UserFsrsProfile: weights optimized after 1000+ reviews
  → Daily review queue sorted by dueAt
```

---

## 8. Key Lib Files

```
src/lib/
├── aiClient.js       — unified AI caller (proxy-first, fallback direct)
├── aiClientSecure.js — secure AI caller (proxy-only)
├── appUtils.js       — shuffle, percent, todayKey, loadFromStorage,
│                       getLeague, pickAdaptiveQuestion, api(), sync/loadUserData
├── constants.js      — NOTES_KEY, API_BASE, EMPTY_STATS, EMPTY_QUESTS,
│                       BADGES(30+), LEAGUES(6), DEMO_USERS, DEMO_LIMITS,
│                       DEMO_ACHIEVEMENTS, PRIMARY_TABS, TAB_LABELS
├── convertToPdf.js   — convert documents to PDF
├── departments.js    — getDepartments, getUserDepartment
├── detectMimeType.js — MIME type detection
├── extractFileText.js — extract text from uploaded files
├── foldersApi.js     — folder CRUD API calls
├── gamificationApi.js — gamification API calls
├── generateSummaryPdf.js — generate PDF summaries
├── lazyWithRetry.js  — lazy load with retry on stale SW chunks
├── mastery.js        — mastery calculation
├── medicalPrograms.js — medical program data
├── profileApi.js     — profile API calls
├── pushClient.js     — web push subscription
├── researchUtils.js  — research hub utilities
├── studyHistory.js   — study history management
├── supabaseClient.js — Supabase client init
├── theme.js          — theme management
├── universities.js   — university data
└── useComboStreak.js — combo streak hook
```

---

## 9. Key Components

```
src/components/
├── AITutorChat.jsx       — AI chat interface
├── AdminComponents.jsx   — KeyManagement, LockedScreen
├── Analytics.jsx         — analytics wrapper
├── Celebrations.jsx      — ConfettiOverlay, CelebrationToast, StreakLossWarning,
│                           StudyHeatmap, LeagueProgress
├── Classroom.jsx         — classroom UI (32KB)
├── Dashboard.jsx         — dashboard UI (34KB)
├── DemoLockedOverlay.jsx — demo limit reached overlay
├── Discussion.jsx        — discussion board
├── ErrorBoundary.jsx     — React error boundary
├── FlashcardRunner.jsx   — flashcard study runner
├── GlobalSearchDropdown.jsx — global search
├── Leaderboard.jsx       — leaderboard UI
├── LoadingSkeleton.jsx   — loading states
├── MarkdownText.jsx      — markdown renderer (with DOMPurify)
├── QuestionBank.jsx      — question bank browser
├── Quiz.jsx              — quiz component
├── RatingsAndComments.jsx — resource ratings + comments
├── SearchAndBadges.jsx   — search + badge display
├── SessionPlayer.jsx     — study session player (24KB)
├── SmallComponents.jsx   — CommandPalette, BulkImport, AIQuestionGen
├── StudyReminders.jsx    — reminder management
├── StudyTools.jsx        — TimetableBuilder + study tools
├── Toast.jsx             — toast notification system
├── TypewriterText.jsx    — typewriter animation
└── UniversitySelect.jsx  — university selection dropdown
```

---

## 10. PWA Configuration

```
vite.config.js + vite-plugin-pwa:
├── Service worker: /sw.js (auto-generated)
├── Manifest: name, icons (16-512px), theme color
├── Caching strategies:
│   ├── Precache: app shell (HTML, CSS, JS)
│   ├── Runtime: images (CacheFirst, expiration)
│   └── API: NetworkFirst (with timeout fallback)
├── Update flow: check every 5 min + on visibility
│   controllerchange → page reload
└── Install prompt: beforeinstallprompt event → InstallPrompt component
    iOS: manual "Add to Home Screen" instructions
```

---

## 11. Deployment

```
Frontend: Netlify (netlify.toml) or Vercel (vercel.json)
  ├── Build: vite build
  ├── Redirects: SPA fallback to index.html
  └── Headers: /public/_headers (security headers)

Backend: Railway (railway.json + nixpacks.toml)
  ├── Start: node server/src/index.js
  ├── Health: GET /health
  ├── Port: process.env.PORT || 4000
  └── DB: Prisma migrate on deploy

Environment Variables:
  Frontend: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
            VITE_API_BASE_URL, VITE_PAYSTACK_PUBLIC_KEY,
            VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
            VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,
            VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
  Backend: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
           SUPABASE_JWT_SECRET, ALLOWED_ORIGINS, FRONTEND_URL,
           OPENROUTER_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY,
           PAYSTACK_SECRET_KEY, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
           FIREBASE_PRIVATE_KEY, FCM_WEB_VAPID_KEY, FIREBASE_MESSAGING_SENDER_ID
```

---

## 12. File Size Hotspots

```
App.jsx              — 10,217 lines (the monolith)
PdfReader.jsx        — 293KB (full PDF reader with annotations, AI, flashcards)
resources.js (route) — 80KB (resource CRUD + views + bookmarks + ratings + comments)
AISectionOverlay.jsx — 60KB
AIStudyAssistant.jsx — 58KB
TeacherQuestionManager — 53KB
StudyGroups.jsx      — 55KB
DocumentReader.jsx   — 70KB
TeacherResourcesHub  — 64KB
HomePage.jsx         — 43KB
TodayPlan.jsx        — 45KB
McqQuizRunner.jsx    — 45KB
TeacherHub.jsx       — 47KB
```
