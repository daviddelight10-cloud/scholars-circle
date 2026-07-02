import { useEffect, useMemo, useState, useRef, useCallback, lazy, Suspense } from "react";

import { useLocation, Link } from "react-router-dom";

import { useToast } from "./components/Toast";

import DOMPurify from "dompurify";

import {
  Home as HomeIcon, BookOpen, Bot, BarChart3, Search, Menu, X,
  School, Users, MessageCircle, Calendar, Bell, Timer,
  CalendarDays, User, Settings, Gem, FileText, Laptop,
  Megaphone, KeyRound, Mail, Cog, GraduationCap, Building2,
  Download, Moon, Sun, Sparkles, ClipboardList, UserCircle,
} from "lucide-react";



import { COINS_PER_SESSION, SUBJECTS, XP_PER_CORRECT, STREAK_BONUS, MODE_MULTIPLIERS } from "./data";



import { createClient } from "@supabase/supabase-js";



import { callAI } from "./lib/aiClient";



import TeacherQuestionManager from "./features/TeacherQuestionManager.jsx";
import DepartmentManager from "./components/teacher/DepartmentManager.jsx";

import LearnHub from "./features/LearnHub.jsx";
import DepartmentSwitcher from "./components/learn/DepartmentSwitcher.jsx";
import { getDepartments, getUserDepartment } from "./lib/departments.js";

import NotificationBell from "./features/NotificationBellImproved.jsx";

import NotificationsTab from "./features/NotificationsTab.jsx";



// Context providers + hooks
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { UserDataProvider, useUserData } from "./contexts/UserDataContext";
import { UIProvider, useUI } from "./contexts/UIContext";

// Page components (lazy loaded for code splitting)
const Home = lazy(() => import("./pages/Home"));
const Learn = lazy(() => import("./pages/Learn"));
const AITutorPage = lazy(() => import("./pages/AITutor"));
const Progress = lazy(() => import("./pages/Progress"));
const Resources = lazy(() => import("./pages/Resources"));
const ClassroomPage = lazy(() => import("./pages/Classroom"));
const Profile = lazy(() => import("./pages/Profile"));

// Components
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  NOTES_KEY, CUSTOM_QUESTIONS_KEY, AI_DOCS_KEY, LECTURE_NOTES_KEY,
  EMPTY_STATS, EMPTY_QUESTS, BADGES, LEAGUES, DEMO_USERS, DEMO_LIMITS,
  DEMO_ACHIEVEMENTS, API_BASE, PRIMARY_TABS, TAB_LABELS,
} from "./lib/constants";
import {
  loadFromStorage, todayKey, percent, pickAdaptiveQuestion,
  getLeague, getNextLeague, api, syncUserDataToBackend, loadUserDataFromBackend,
} from "./lib/appUtils";

import DemoLockedOverlay from "./components/DemoLockedOverlay";
import { GlobalSearchDropdown } from "./components/GlobalSearchDropdown";
import {
  ConfettiOverlay, CelebrationToast, StreakLossWarning,
  StudyHeatmap, LeagueProgress, CelebrationNotification,
} from "./components/Celebrations";
import {
  CommandPalette, AIHelper, SimpleCheckpoint,
  RevisionPlanner, BulkImport, AIQuestionGen,
} from "./components/SmallComponents";
import { SessionPlayer } from "./components/SessionPlayer";
import { QuestionBank } from "./components/QuestionBank";
import { Classroom } from "./components/Classroom";
import { FlashcardDeck } from "./components/FlashcardDeck";
import { Leaderboard } from "./components/Leaderboard";
import { PomodoroTimer, NotesEditor, TimetableBuilder, CheatSheet } from "./components/StudyTools";
import { SearchResults, AchievementsBadges, ConfidenceHeatmap } from "./components/SearchAndBadges";
import { DiscussionBoard } from "./components/Discussion";
import { AITutorChat } from "./components/AITutorChat";
import { StudyReminders } from "./components/StudyReminders";
import { KeyManagement, LockedScreen } from "./components/AdminComponents";



// DemoLockedOverlay imported from ./components/DemoLockedOverlay



// GlobalSearchDropdown imported from ./components/GlobalSearchDropdown



import { TodayScreen } from "./features/TodayPlan";



import { LectureToNotes } from "./features/LectureToNotes";



import { PastPaperDrill } from "./features/PastPaperDrill";




import { PracticeWithHints } from "./features/PracticeWithHints";



import { AchievementNotification } from "./features/AchievementNotification";



import { PersonalizedStudyPaths } from "./features/PersonalizedStudyPaths";



import { StudyGroups } from "./features/StudyGroups";



const GamificationHub = lazy(() => import("./features/Gamification"));
const ResearchHub = lazy(() => import("./features/research-hub/ResearchHub"));

const ResourceViewer = lazy(() => import("./features/ResourceViewer"));
const TeacherResourcesHub = lazy(() => import("./features/TeacherResourcesHub"));
const AdminDashboard = lazy(() => import("./features/AdminDashboard"));
const Lecturers = lazy(() => import("./features/Lecturers/index.jsx"));
const CampusComm = lazy(() => import("./features/CampusComm.jsx"));



import { ExamSimulator, selectAdaptiveQuestions, calculateSessionAnalytics, PostSessionInsights } from "./features/EnhancedSession";
import StatsPanel from "./features/StatsPanel";



import { OnboardingWizard, isOnboarded, markOnboarded } from "./features/Onboarding";



import AITutor from "./features/AITutor/index.jsx";
import AISectionOverlay from "./features/AISectionOverlay.jsx";



import { StudentProfile, useStudentProfile } from "./features/StudentProfile.jsx";



import { TeacherInvitesPanel } from "./features/TeacherInvites.jsx";



import { LiveSessionsPanel } from "./features/LiveSessions/LiveSessionsPanel.jsx";



import { LiveBanner } from "./features/LiveSessions/LiveBanner.jsx";



import { ClassroomAssignmentsPanel } from "./features/ClassroomAssignments/ClassroomAssignmentsPanel.jsx";



import { AttendancePanel } from "./features/LiveSessions/AttendancePanel.jsx";



import { PushPermissionBanner, NotificationSettings } from "./features/NotificationCenter.jsx";



import { InstallPrompt } from "./features/InstallPrompt.jsx";
import PremiumPage from "./features/PremiumPage.jsx";
import PaystackPop from "@paystack/inline-js";
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_2c321f6a4471b672ee716506912ede6f6f99d8cd";



import CourseOutline from "./features/CourseOutline";







// EMPTY_STATS, EMPTY_QUESTS imported from ./lib/constants







// BADGES imported from ./lib/constants



// LEAGUES, getLeague, getNextLeague imported from ./lib/constants and ./lib/appUtils







// DEMO_USERS, DEMO_LIMITS, DEMO_ACHIEVEMENTS imported from ./lib/constants

// API_BASE imported from ./lib/constants







// todayKey imported from ./lib/appUtils

// percent imported from ./lib/appUtils







// pickAdaptiveQuestion imported from ./lib/appUtils







// api imported from ./lib/appUtils







// syncUserDataToBackend imported from ./lib/appUtils







// loadUserDataFromBackend imported from ./lib/appUtils







// ConfettiOverlay, CelebrationToast, StreakLossWarning, StudyHeatmap, LeagueProgress, CelebrationNotification imported from ./components/Celebrations



// PRIMARY_TABS, TAB_LABELS imported from ./lib/constants;



function App() {

  const toast = useToast();



  const [tab, setTabRaw] = useState("today");

  const prevTabRef = useRef("today");

  const setTab = useCallback((newTab) => {

    setTabRaw((curr) => { prevTabRef.current = curr; return newTab; });

  }, []);

  const goBack = useCallback(() => {

    const prev = prevTabRef.current;

    setTabRaw(PRIMARY_TABS.includes(prev) ? prev : "today");

  }, []);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);



  useEffect(() => {

    function onOffline() { setIsOffline(true); toast.warning("You're offline. Changes will sync when you're back."); }

    function onOnline() { setIsOffline(false); toast.success("You're back online!"); }

    window.addEventListener("offline", onOffline);

    window.addEventListener("online", onOnline);

    return () => { window.removeEventListener("offline", onOffline); window.removeEventListener("online", onOnline); };

  }, []);



  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded());



  // Guard: pause backend sync during login/logout transitions to prevent wiping data

  const syncPausedRef = useRef(false);



  const [stats, setStats] = useState(EMPTY_STATS);



  const [history, setHistory] = useState([]);



  const [wrongCounts, setWrongCounts] = useState({});



  const [mastery, setMastery] = useState({});



  const [srData, setSrData] = useState({});

  const [activeDept, setActiveDept] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sc_active_dept") || "null"); } catch { return null; }
  });
  const [activeYearLevel, setActiveYearLevel] = useState(() => {
    return parseInt(localStorage.getItem("sc_active_level") || "1");
  });
  const [activeSemester, setActiveSemester] = useState(() => {
    return localStorage.getItem("sc_active_semester") || null;
  });
  const [showDeptSwitcher, setShowDeptSwitcher] = useState(false);



  const [assignments, setAssignments] = useState([]);



  const [activeSession, setActiveSession] = useState(null);



  const [darkMode, setDarkMode] = useState(true);



  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");

  const [deleteLoading, setDeleteLoading] = useState(false);



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

  const [lastActivity, setLastActivity] = useState(() => {

    try {

      const authRaw = localStorage.getItem("scholars-circle-auth");

      let uid = "guest";

      if (authRaw) {

        const authParsed = JSON.parse(authRaw);

        uid = authParsed.authUser?.id || authParsed.authUser?.username || "guest";

      }

      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);

      if (raw) return JSON.parse(raw).lastActivity ?? null;

    } catch { /* ignore */ }

    return null;

  });



  const [syncConfig, setSyncConfig] = useState({ url: "", key: "", userId: "local-user" });



  const [syncStatus, setSyncStatus] = useState("");



  const [aiConfig, setAiConfig] = useState({

    provider: "openrouter",

    model: "google/gemini-2.5-flash",

    apiKey: "",

  });



  // Global announcement popup (shows on login for students)

  const [globalAnnouncement, setGlobalAnnouncement] = useState(null);



  const location = useLocation();



  const [auth, setAuth] = useState({



    mode: location.pathname === "/signup" ? "signup" : "login",



    email: "",



    username: "",



    password: "",



    signupRole: "STUDENT",



    inviteCode: "",



    user: null,



    error: "",



    info: "",



  });



  // Update auth mode when route changes

  useEffect(() => {

    if (location.pathname === "/signup") {

      setAuth((a) => ({ ...a, mode: "signup", error: "", info: "" }));

    } else if (location.pathname === "/login") {

      setAuth((a) => ({ ...a, mode: "login", error: "", info: "" }));

    }

  }, [location.pathname]);

  // Open payment modal when navigated with #upgrade hash (from ResourceViewer)
  useEffect(() => {
    if (window.location.hash === "#upgrade") {
      setShowPaymentModal(true);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (window.location.hash === "#research-hub") {
      setTab("research-hub");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [location]);

  // Listen for custom event from ResourceViewer (works when rendered in-app)
  useEffect(() => {
    const handleOpenPremium = () => setShowPaymentModal(true);
    window.addEventListener("sc-open-premium", handleOpenPremium);
    return () => window.removeEventListener("sc-open-premium", handleOpenPremium);
  }, []);

  // Listen for custom event from ResourceViewer to navigate to Research Hub
  useEffect(() => {
    const handleOpenResearchHub = () => setTab("research-hub");
    window.addEventListener("sc-open-research-hub", handleOpenResearchHub);
    return () => window.removeEventListener("sc-open-research-hub", handleOpenResearchHub);
  }, []);



  // Refs for signup form to avoid stale closure issues

  const signupEmailRef = useRef("");

  const signupFullNameRef = useRef("");

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



  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [homeViewerToken, setHomeViewerToken] = useState(null);

  const [homeViewerPage, setHomeViewerPage] = useState(null);

  const [progressSubTab, setProgressSubTab] = useState("stats");

  const [learnSubTab, setLearnSubTab] = useState("practice");

  const [resourcesSubTab, setResourcesSubTab] = useState("notes");

  const [aiTutorSubTab, setAiTutorSubTab] = useState("chat");

  const [isIOS, setIsIOS] = useState(false);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [showUpdateToast, setShowUpdateToast] = useState(false);

  const [updatePending, setUpdatePending] = useState(false);

  const [isCheckingActivation, setIsCheckingActivation] = useState(false);

  

  // Ref to track previous activation status for comparison

  const prevActivationRef = useRef(null);

  // Ref to prevent repeated expiry warnings within the same session
  const expiryWarnedRef = useRef(false);



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



  const [themePack, setThemePack] = useState("gold");



  const [density, setDensity] = useState("cozy");



  const [headerExpanded, setHeaderExpanded] = useState(true);

  useEffect(() => {
    if (tab === "today") setHeaderExpanded(false);
    else setHeaderExpanded(true);
  }, [tab]);



  const [showPalette, setShowPalette] = useState(false);



  const [paletteQuery, setPaletteQuery] = useState("");



  const [booted, setBooted] = useState(false);



  const { profile: studentProfile, update: updateStudentProfile } = useStudentProfile();



  const [customFlashcards, setCustomFlashcards] = useState([]);



  const [aiChatHistory, setAiChatHistory] = useState([]);



  const [reminders, setReminders] = useState([]);



  const [notificationPermission, setNotificationPermission] = useState("default");



  // Notification settings state - must be declared early

  const [notificationSettings, setNotificationSettings] = useState(() => {

    try {

      const saved = localStorage.getItem('scholars-circle-notification-settings');

      return saved ? JSON.parse(saved) : {

        dailyReminder: true,

        dailyReminderTime: '18:00',

        streakWarning: true,

        inactivityReminder: true,

        inactivityDays: 2,

        spacedReviewReminder: true,

        leaderboardAlerts: true,

        weeklyProgress: true,

        motivationalQuotes: false

      };

    } catch {

      return {

        dailyReminder: true,

        dailyReminderTime: '18:00',

        streakWarning: true,

        inactivityReminder: true,

        inactivityDays: 2,

        spacedReviewReminder: true,

        leaderboardAlerts: true,

        weeklyProgress: true,

        motivationalQuotes: false

      };

    }

  });



  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("paystack");



  const [loadingOverlay, setLoadingOverlay] = useState(true);



  const [outlineSubjectId, setOutlineSubjectId] = useState(SUBJECTS[0]?.id || "");



  const [outlineProgress, setOutlineProgress] = useState({});



  const [demoMode, setDemoMode] = useState(() => {

    try {

      const authRaw = localStorage.getItem("scholars-circle-auth");

      let uid = localStorage.getItem("scholars-circle-current-user") || "guest";

      if (authRaw) {

        const authParsed = JSON.parse(authRaw);

        uid = authParsed.authUser?.id || authParsed.authUser?.username || uid;

      }

      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);

      if (raw) return JSON.parse(raw).demoMode ?? false;

    } catch { /* ignore */ }

    return false;

  });



  const [demoUsage, setDemoUsage] = useState(() => {

    try {

      const authRaw = localStorage.getItem("scholars-circle-auth");

      let uid = localStorage.getItem("scholars-circle-current-user") || "guest";

      if (authRaw) {

        const authParsed = JSON.parse(authRaw);

        uid = authParsed.authUser?.id || authParsed.authUser?.username || uid;

      }

      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);

      if (raw) {

        const parsed = JSON.parse(raw);

        if (parsed.demoUsage) {

          const today = new Date().toDateString();

          const storedDate = parsed.demoUsage.sessionDate;

          // Reset daily counters if it's a new day

          const isSameDay = storedDate === today;

          return {

            ...parsed.demoUsage,

            // Reset daily counters if new day

            sessionTimeMinutes: isSameDay ? (parsed.demoUsage.sessionTimeMinutes || 0) : 0,

            sessionDate: today,

            quizUsed: isSameDay && parsed.demoUsage.quizDate === today ? (parsed.demoUsage.quizUsed || 0) : 0,

            quizDate: isSameDay && parsed.demoUsage.quizDate === today ? parsed.demoUsage.quizDate : null,

            aiStudyAssistantUsed: isSameDay && parsed.demoUsage.aiStudyAssistantDate === today ? (parsed.demoUsage.aiStudyAssistantUsed || 0) : 0,

            aiStudyAssistantDate: isSameDay && parsed.demoUsage.aiStudyAssistantDate === today ? parsed.demoUsage.aiStudyAssistantDate : null,

            lectureToNotesUsed: isSameDay && parsed.demoUsage.lectureToNotesDate === today ? (parsed.demoUsage.lectureToNotesUsed || 0) : 0,

            lectureToNotesDate: isSameDay && parsed.demoUsage.lectureToNotesDate === today ? parsed.demoUsage.lectureToNotesDate : null,

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

      sessionDate: new Date().toDateString(),

      totalSessionsUsed: 0,

      pomodoroSessions: 0,

      notesCount: 0,

      pastPapersUsed: 0,

      aiTutorMessages: 0,

      trialStartDate: null,

      // New daily usage counters

      aiStudyAssistantUsed: 0,

      aiStudyAssistantDate: null,

      lectureToNotesUsed: 0,

      lectureToNotesDate: null,

      quizUsed: 0,

      quizDate: null,

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

  const [aiDefaultView, setAiDefaultView] = useState("chat");

  const [aiKey, setAiKey] = useState(0);

  const [aiStudyTopic, setAiStudyTopic] = useState("");

  const [aiStudyMode, setAiStudyMode] = useState("input");

  const [aiStudyAttachment, setAiStudyAttachment] = useState(null);

  const [showDemoTour, setShowDemoTour] = useState(false);

  const [tourStep, setTourStep] = useState(0);

  const [demoLocked, setDemoLocked] = useState(() => {

    try {

      const authRaw = localStorage.getItem("scholars-circle-auth");

      let uid = localStorage.getItem("scholars-circle-current-user") || "guest";

      if (authRaw) {

        const authParsed = JSON.parse(authRaw);

        uid = authParsed.authUser?.id || authParsed.authUser?.username || uid;

      }

      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);

      if (raw) {

        const parsed = JSON.parse(raw);

        const today = new Date().toDateString();

        // Check if demo is locked due to time limit (same day)

        if (parsed.demoLocked && parsed.demoLockedDate === today) {

          return true;

        }

        // Check if time limit was reached (same day)

        if (parsed.demoUsage?.sessionDate === today && parsed.demoUsage?.sessionTimeMinutes >= DEMO_LIMITS.dailyTimeLimit) {

          return true;

        }

        // Check if quiz limit was reached (same day)

        if (parsed.demoUsage?.quizDate === today && (parsed.demoUsage?.quizUsed || 0) >= DEMO_LIMITS.quizDaily) {

          return true;

        }

      }

    } catch { /* ignore */ }

    return false;

  });







  const userRole = String(auth.user?.role || "").toLowerCase();



  const isTeacher = userRole === "teacher"; // admin (full access)



  const isLecturerRole = userRole === "lecturer"; // faculty without admin powers



  const isFaculty = isTeacher || isLecturerRole; // any faculty (TEACHER or LECTURER)



  const isActivated = isFaculty || auth.user?.isActivated === true;

  

  // Debug log for activation status

  useEffect(() => {

    if (auth.user) {

      console.log("[isActivated] auth.user.isActivated:", auth.user.isActivated, "isTeacher:", isTeacher, "isActivated:", isActivated);

    }

  }, [auth.user, isTeacher, isActivated]);



  const subjects = useMemo(() => {

    // Start with local subjects - ensure SUBJECTS is always an array
    const safeBackend = Array.isArray(backendSubjects) ? backendSubjects : [];

    let result = (SUBJECTS || []).map(s => {

      // Find matching backend subject and merge questions

      const backend = safeBackend.find(b => b.label === s.label);

      if (backend) {

        // Use backend ID so API calls (publish, etc.) reference the correct DB record
        // Include departmentId, subjectDepts, yearLevel for filtering

        return {
          ...s,
          id: backend.id,
          departmentId: backend.departmentId,
          subjectDepts: backend.subjectDepts,
          yearLevel: backend.yearLevel,
          questions: [...(s.questions || []), ...(backend.questions || [])],
        };

      }

      return s;

    });

    

    // Add backend subjects that don't exist in local SUBJECTS (like MTH-111)

    for (const backend of safeBackend) {

      if (!result.find(s => s.label === backend.label)) {

        result.push({

          id: backend.id,

          label: backend.label,

          icon: backend.icon || (backend.label.includes("MTH") ? "📍" : backend.label.includes("BIO") ? "🐟" : backend.label.includes("CHM") ? "⚗️" : backend.label.includes("PHY") ? "⚛️" : backend.label.includes("GST") ? "📚" : "📖"),

          accent: "#fb923c",

          image: SUBJECTS[0]?.image || "",

          lessons: [],

          questions: backend.questions || [],

          departmentId: backend.departmentId,

          subjectDepts: backend.subjectDepts,

          yearLevel: backend.yearLevel,

        });

      }

    }

    

    // Add custom questions bank

    if (customQuestions.length) {

      result.push({ id: "custom", label: "Custom Bank", icon: "📦", image: SUBJECTS[0]?.image || "", lessons: [], questions: customQuestions });

    }

    

    return result;

  }, [customQuestions, backendSubjects]);



  // allQuestions must be defined before notification useEffect

  const allQuestions = useMemo(

    () => (subjects || []).flatMap((s) =>

      (s.questions || []).map((q, i) => ({

        ...q,

        subjectId: s.id,

        subjectLabel: s.label,

        subjectIcon: s.icon,

        key: `${s.id}-${i}`,

      }))

    ),

    [subjects]

  );



  // dueCards must be defined before notification useEffect

  const dueCards = allQuestions.filter((q) => (srData[q.key]?.due || 0) <= Date.now() && srData[q.key]);



  // --- Context sync: push local state to contexts so page components can consume via hooks ---
  const ctxAuth = useAuth();
  const ctxUserData = useUserData();
  const ctxUI = useUI();

  useEffect(() => { ctxAuth.setUser(auth.user); }, [auth.user]);
  useEffect(() => { ctxAuth.setToken(token); }, [token]);
  useEffect(() => { ctxUserData.setStats(stats); }, [stats]);
  useEffect(() => { ctxUserData.setHistory(history); }, [history]);
  useEffect(() => { ctxUserData.setMastery(mastery); }, [mastery]);
  useEffect(() => { ctxUserData.setSrData(srData); }, [srData]);
  useEffect(() => { ctxUserData.setSubjects(subjects); }, [subjects]);
  useEffect(() => { ctxUserData.setAssignments(assignments); }, [assignments]);
  useEffect(() => { ctxUserData.setWrongCounts(wrongCounts); }, [wrongCounts]);
  useEffect(() => { ctxUserData.setNotes(notes); }, [notes]);
  useEffect(() => { ctxUserData.setCustomFlashcards(customFlashcards); }, [customFlashcards]);
  useEffect(() => { ctxUserData.setOutlineProgress(outlineProgress); }, [outlineProgress]);
  useEffect(() => { ctxUserData.setLastActivity(lastActivity); }, [lastActivity]);
  useEffect(() => { ctxUI.setTab(tab); }, [tab]);
  useEffect(() => { ctxUI.setDarkMode(darkMode); }, [darkMode]);
  useEffect(() => { ctxUI.setDemoMode(demoMode); }, [demoMode]);
  useEffect(() => { ctxUI.setDemoUsage(demoUsage); }, [demoUsage]);
  useEffect(() => { ctxUI.setProgressSubTab(progressSubTab); }, [progressSubTab]);
  useEffect(() => { ctxUI.setLearnSubTab(learnSubTab); }, [learnSubTab]);
  useEffect(() => { ctxUI.setResourcesSubTab(resourcesSubTab); }, [resourcesSubTab]);
  useEffect(() => { ctxUI.setAiTutorSubTab(aiTutorSubTab); }, [aiTutorSubTab]);
  useEffect(() => { ctxUI.setAiConfig(aiConfig); }, [aiConfig]);
  // --- End context sync ---







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

        setLastActivity(parsed.lastActivity ?? null);



        setSyncConfig(parsed.syncConfig ?? { url: "", key: "", userId: "local-user" });



        setAiConfig((prev) => {

          const saved = parsed.aiConfig;

          if (saved?.provider && saved?.model) {

            return {

              provider: saved.provider,

              model: saved.model,

              apiKey: saved.apiKey ?? "",

            };

          }

          return prev;

        });



        setNotes(parsed.notes ?? {});



        setTimetable(parsed.timetable ?? {});



        setDiscussion(parsed.discussion ?? {});



        setThemePack(parsed.themePack ?? "gold");



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

        setLastActivity(parsed.lastActivity ?? null);

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

        const today = new Date().toDateString();

        const currentMinutes = prev.sessionDate === today ? prev.sessionTimeMinutes : 0;

        const newMinutes = currentMinutes + 1;

        // Show warning at 80% of daily limit

        if (newMinutes === Math.floor(DEMO_LIMITS.dailyTimeLimit * 0.8)) {

          setShowTimeWarning(true);

        }

        // Block at 100% of daily limit - lock demo

        if (newMinutes >= DEMO_LIMITS.dailyTimeLimit) {

          setShowTimeWarning(false);

          setDemoLocked(true);

        }

        return {

          ...prev,

          sessionTimeMinutes: newMinutes,

          sessionDate: today,

        };

      });

    }, 60000); // Every minute

    return () => clearInterval(interval);

  }, [demoMode, booted]);



  // Redirect merged tabs to their consolidated home
  useEffect(() => {
    if (tab === "leaderboard") { setProgressSubTab("leaderboard"); setTab("analytics"); }
    else if (tab === "achievements") { setProgressSubTab("badges"); setTab("analytics"); }
    else if (tab === "gamification") { setProgressSubTab("arena"); setTab("analytics"); }
    else if (tab === "learn") { setLearnSubTab("lessons"); setTab("practice"); }
    else if (tab === "bank") { setLearnSubTab("bank"); setTab("practice"); }
    else if (tab === "notes") { setResourcesSubTab("notes"); setTab("resources"); }
    else if (tab === "flashcards") { setResourcesSubTab("flashcards"); setTab("resources"); }
    else if (tab === "cheatsheet") { setResourcesSubTab("cheatsheet"); setTab("resources"); }
    else if (tab === "outline") { setResourcesSubTab("outline"); setTab("resources"); }
  }, [tab]);

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

    if (daysRemaining <= 3 && daysRemaining > 0) {

      setShowExpirationWarning(true);

    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, demoUsage.trialStartDate]);



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



    if (token && auth.user?.id) {

      // Logged-in user: backend is source of truth → load from server
      // But if offline, skip the network call and use localStorage immediately
      if (!navigator.onLine) {
        loadLocalState();
      } else {

      loadUserDataFromBackend(token).then((data) => {

        if (!data) return;

        if (data.progress) {

          // Validate streak: if lastStudied is stale, streak should reset

          let validatedStreak = data.progress.streak ?? 0;

          const backendLastStudied = data.progress.lastStudied
            ? new Date(data.progress.lastStudied).toISOString().split('T')[0]
            : null;

          if (backendLastStudied && validatedStreak > 0) {

            const todayStr = new Date().toISOString().split('T')[0];

            if (backendLastStudied !== todayStr) {

              const lastDate = new Date(backendLastStudied + 'T00:00:00');

              const today = new Date(todayStr + 'T00:00:00');

              const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

              if (diffDays > 1) validatedStreak = 0;

            }

          }

          setStats({

            xp: data.progress.xp ?? 0,

            sessions: data.progress.sessions ?? 0,

            streak: validatedStreak,

            coins: data.progress.coins ?? 0,

            weeklyGoal: data.progress.weeklyGoal ?? 5,

            questsDone: {},

            totalCorrect: data.progress.totalCorrect ?? 0,

          });

          setMastery(data.progress.mastery || {});

          setWrongCounts(data.progress.wrongCounts || {});

          setSrData(data.progress.srData || {});

          setLastStudied(data.progress.lastStudied ? new Date(data.progress.lastStudied).toISOString().split('T')[0] : null);

          setLastActivity(data.progress.lastActivity ?? null);

          if (data.progress.themePack) setThemePack(data.progress.themePack);

          if (data.progress.density) setDensity(data.progress.density);

        }

        if (data.timetable && Object.keys(data.timetable).length) setTimetable(data.timetable);

        if (data.flashcards?.length) setCustomFlashcards(data.flashcards.map(f => ({ id: f.id, front: f.front, back: f.back, subject: f.subject })));

        if (data.reminders?.length) setReminders(data.reminders.map(r => ({ id: r.id, time: r.time, label: r.label, subject: r.subject, sent: r.sent })));

        if (data.chatHistory?.length) setAiChatHistory(data.chatHistory.map(m => ({ role: m.role, content: m.content, timestamp: new Date(m.timestamp).getTime() })));

        if (data.notes?.length) {

          const notesObj = {};

          data.notes.forEach(n => notesObj[n.subjectId] = n.content);

          setNotes(notesObj);

        }

        if (data.outlineProgress?.length) {

          const opObj = {};

          data.outlineProgress.forEach(op => {

            if (!opObj[op.subjectId]) opObj[op.subjectId] = {};

            opObj[op.subjectId][op.semester] = op.progress;

          });

          setOutlineProgress(opObj);

        }

        if (data.discussions?.length) {

          const discObj = {};

          data.discussions.forEach(d => {

            if (!discObj[d.subjectId]) discObj[d.subjectId] = [];

            discObj[d.subjectId].push({ id: d.id, text: d.text, role: d.role, ts: new Date(d.createdAt).getTime(), replies: d.replies || [] });

          });

          setDiscussion(discObj);

        }

        // Show dept onboarding for students who haven't picked a department yet
        const storedDept = localStorage.getItem("sc_active_dept");
        if (!storedDept || storedDept === "null") {
          // Only show if not previously skipped
          setTimeout(() => setShowDeptSwitcher(true), 1200);
        }
        // "skipped" ? user dismissed onboarding, don't show again

      }).catch((err) => {

        console.error("Boot backend load failed, trying localStorage:", err);

        // Fallback: load from localStorage for this user

        loadLocalState();

      });

      } // end else (online)

    } else {

      // Demo/offline user: load from localStorage only

      loadLocalState();

    }



    function loadLocalState() {

      // Restore cached backend subjects (with questions) for offline use
      try {
        const cachedSubjects = localStorage.getItem("sc_subjects_cache");
        if (cachedSubjects) {
          const parsed = JSON.parse(cachedSubjects);
          if (Array.isArray(parsed)) setBackendSubjects(parsed);
        }
      } catch {}

      const raw = localStorage.getItem(storageKey("scholars-circle-state"));

      if (!raw) return;

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

        setLastActivity(parsed.lastActivity ?? null);

        setNotes(parsed.notes ?? {});

        setTimetable(parsed.timetable ?? {});

        if (parsed.discussion !== undefined) setDiscussion(parsed.discussion);

        setThemePack(parsed.themePack ?? "gold");

        setDensity(parsed.density ?? "cozy");

        setCustomFlashcards(parsed.customFlashcards ?? []);

        setAiChatHistory(parsed.aiChatHistory ?? []);

        setReminders(parsed.reminders ?? []);

      } catch (e) {

        console.error("Failed to parse local state", e);

      }

    }



  }, [booted, token, auth.user?.id]);



  // Check streak validity on app load and whenever lastStudied changes

  // This ensures streak resets properly even after backend data overwrites local state

  const streakCheckedRef = useRef(false);

  useEffect(() => {

    if (!booted || !lastStudied) return;

    // Only run this check once per session after data is fully loaded

    if (streakCheckedRef.current) return;

    streakCheckedRef.current = true;



    const todayStr = new Date().toISOString().split('T')[0];

    if (lastStudied === todayStr) return; // Already studied today, streak is valid



    const lastDate = new Date(lastStudied + 'T00:00:00');

    const today = new Date(todayStr + 'T00:00:00');

    const diffTime = today.getTime() - lastDate.getTime();

    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));



    // If more than 1 day has passed, reset streak to 0

    if (diffDays > 1) {

      console.log('[STREAK] Resetting streak - missed', diffDays, 'days since last study');

      setStats(prev => ({ ...prev, streak: 0 }));

    }

  }, [booted, lastStudied]); // Run after data loads



  // Sync timetable to backend immediately when it changes

  useEffect(() => {

    if (!token || !auth.user?.id || !booted) return;

    if (Object.keys(timetable).length === 0) return; // Don't sync empty timetable



    const syncTimetable = async () => {

      try {

        await api("/user-data/timetable", { token, method: "POST", body: { timetable } });

        console.log("[Timetable] Synced to backend");

      } catch (e) {

        console.error("[Timetable] Failed to sync:", e);

      }

    };



    // Debounce sync by 1 second to avoid rapid API calls

    const timeout = setTimeout(syncTimetable, 1000);

    return () => clearTimeout(timeout);

  }, [timetable, token, auth.user?.id, booted]);



  // Check for important announcements on login (for students)

  useEffect(() => {

    if (!token || isFaculty) return;

    async function checkAnnouncements() {

      try {

        // Fetch user's classrooms

        const classroomsRes = await fetch(`${API_BASE}/classroom/my`, {

          headers: { Authorization: `Bearer ${token}` }

        });

        const classrooms = await classroomsRes.json();

        

        // Check each classroom for unread important announcements

        for (const classroom of (classrooms || [])) {

          const detailRes = await fetch(`${API_BASE}/classroom/${classroom.id}`, {

            headers: { Authorization: `Bearer ${token}` }

          });

          const details = await detailRes.json();

          

          if (details.announcements) {

            const unreadImportant = details.announcements.find(

              a => a.isImportant && (!a.reads || a.reads.length === 0)

            );

            if (unreadImportant) {

              setGlobalAnnouncement(unreadImportant);

              return; // Show one announcement at a time

            }

          }

        }

      } catch (err) {

        console.error("Failed to check announcements:", err);

      }

    }

    

    checkAnnouncements();

  }, [token, isFaculty]);







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

      // Pre-populate from localStorage cache immediately (shows subjects before network responds)
      if (active) {
        try {
          const cached = localStorage.getItem("sc_subjects_cache");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) setBackendSubjects(parsed);
          }
        } catch {}
      }

      try {

        const rows = await api("/subjects");

        if (active) {
          if (Array.isArray(rows)) {
            setBackendSubjects(rows);
            // Persist for offline use
            try { localStorage.setItem("sc_subjects_cache", JSON.stringify(rows)); } catch {}
          }
        }

      } catch {

        // Keep whatever was pre-populated from localStorage — don’t clear it

      }



      try {



        await refreshAssignments();



      } finally {



        if (active) setLoadingOverlay(false);



      }



    })();



    return () => { active = false; };



  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [auth.user?.id]);







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



    } finally {

      setAdminLoading(false);

    }



  }







  useEffect(() => {



    if (!booted) return;



    // Don't save user data when no user is logged in AND not in demo mode

    if (!auth.user && !demoMode) return;



    // Don't save during login/logout transitions to prevent overwriting good data with empty state

    if (syncPausedRef.current) return;



    // Save auth info to shared key (only if logged in)

    if (auth.user) {

      localStorage.setItem("scholars-circle-auth", JSON.stringify({ authUser: auth.user, authToken: token }));

      if (auth.user?.id || auth.user?.username) {

        localStorage.setItem("scholars-circle-current-user", auth.user.id || auth.user.username);

      }

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

        lastActivity,



        syncConfig,



        aiConfig: { provider: aiConfig.provider, model: aiConfig.model },



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



        demoLocked,

        demoLockedDate: demoLocked ? new Date().toDateString() : null,



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



    // Also sync to backend if logged in (but not in demo mode)

    // Skip sync when login/logout transition is in progress to prevent wiping data

    if (token && !demoMode && !syncPausedRef.current) {



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



        notes,



        outlineProgress,



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



    lastActivity,



    notes,



    timetable,



    discussion,



    syncConfig,



    aiConfig.provider,



    aiConfig.model,



    auth.user,



    token,



    booted,



    demoMode,



    demoUsage,



    demoLocked,



    themePack,



    density,



    outlineProgress,



    customFlashcards,



    aiChatHistory,



    reminders,



    notificationPermission,



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



      // Pause sync to prevent the save effect from pushing empty/stale state to backend

      syncPausedRef.current = true;



      setToken(data.token);



      setAuth((a) => ({ ...a, email: "", username: "", password: "", user: data.user, error: "", info: "" }));



      // Reset demo mode on successful backend login

      setDemoMode(false);



      // Clear previous user's localStorage keys (state reset happens when backend data loads)

      const prevUid = localStorage.getItem("scholars-circle-current-user") || "guest";

      Object.keys(localStorage).forEach(k => {

        if (k.includes(`::${prevUid}`) || k.startsWith("sc_")) {

          localStorage.removeItem(k);

        }

      });



      // Store new user identity

      localStorage.setItem("scholars-circle-auth", JSON.stringify({ authUser: data.user, authToken: data.token }));

      localStorage.setItem("scholars-circle-current-user", data.user.id || data.user.username);



      // Load data from backend (source of truth) then resume sync

      try {

        await loadFromBackend(data.token);

      } finally {

        syncPausedRef.current = false;

      }



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



      const email = (signupEmailRef.current?.value || "").trim();

      const fullName = (signupFullNameRef.current?.value || "").trim();

      const username = (signupUsernameRef.current?.value || "").trim();

      const password = (signupPasswordRef.current?.value || "").trim();

      const confirmPassword = (signupConfirmPasswordRef.current?.value || "").trim();

      // Get role from auth state (updated by onChange)

      const role = auth.signupRole || "STUDENT";

      const inviteCode = (signupInviteCodeRef.current?.value || "").trim();

      

      if (password !== confirmPassword) {

        setAuth((a) => ({ ...a, error: "Passwords do not match. Please re-enter your password.", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      

      if (!email) {

        setAuth((a) => ({ ...a, error: "Please enter your email address.", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

        setAuth((a) => ({ ...a, error: "Please enter a valid email address (e.g. you@example.com).", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      if (!username) {

        setAuth((a) => ({ ...a, error: "Please choose a username.", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      if (username.length < 3) {

        setAuth((a) => ({ ...a, error: "Username must be at least 3 characters.", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {

        setAuth((a) => ({ ...a, error: "Username can only contain letters, numbers, and underscores (no spaces).", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      if (!password) {

        setAuth((a) => ({ ...a, error: "Please enter a password.", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      if (password.length < 8) {

        setAuth((a) => ({ ...a, error: "Password must be at least 8 characters.", info: "" }));

        setLoadingOverlay(false);

        return;

      }

      console.log("Registering with:", { email, username, fullName, role });



      await api("/auth/register", {

        method: "POST",

        body: {

          email,

          username,

          fullName,

          password,

          role,

          inviteCode: (role === "TEACHER" || role === "LECTURER") ? inviteCode : undefined,

        },

      });

      // auto-login after successful registration
      try {
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

      clearUserState();

      setDemoMode(false);

      setDemoUsage({

        aiMessages: 0,

        practiceQuestions: 0,

        questionBankQuestions: 0,

        flashcardReviews: 0,

        timetableSlots: 0,

        reminders: 0,

        sessionTimeMinutes: 0,

        sessionDate: new Date().toDateString(),

        totalSessionsUsed: 0,

        pomodoroSessions: 0,

        notesCount: 0,

        pastPapersUsed: 0,

        aiTutorMessages: 0,

        trialStartDate: null,

        aiStudyAssistantUsed: 0,

        aiStudyAssistantDate: null,

        lectureToNotesUsed: 0,

        lectureToNotesDate: null,

        quizUsed: 0,

        quizDate: null,

        demoProgress: {

          tabsVisited: new Set(),

          featuresTried: new Set(),

          achievements: [],

        },

      });

      } catch (loginErr) {
        // Registration succeeded but auto-login failed — switch to login mode
        console.error("Auto-login after registration failed:", loginErr);
        setAuth((a) => ({
          ...a,
          mode: "login",
          error: "",
          info: "Account created successfully! Please sign in with your email and password.",
          username: email,
        }));
      }

    } catch (e) {

      console.error("Registration error:", e);

      let errorMessage = e.message || "Sign up failed. Please try again.";

      // Network errors — server unreachable
      if (e.message === "Failed to fetch" || e.message?.includes("NetworkError") || e.message?.includes("network")) {
        errorMessage = "Could not connect to the server. Please check your internet connection and try again.";
      }
      // Rate limit errors
      else if (e.message?.includes("Too many") || e.message?.includes("rate limit")) {
        errorMessage = "Too many signup attempts. Please wait a few minutes and try again.";
      }

      setAuth((a) => ({ ...a, error: errorMessage, info: "" }));

    }



    setLoadingOverlay(false);



  }







  function triggerCelebration(type, data) {

    setCelebration({ type, data });

    setShowConfetti(true);

    setTimeout(() => setShowConfetti(false), 3000);

    setTimeout(() => setCelebration(null), 4000);

  }



  function handleStreakUpdate(newStreak, longestStreak) {
    setStats((s) => ({ ...s, streak: newStreak }));
    setLastStudied(new Date().toISOString().split('T')[0]);
    setLastActivity(new Date().toISOString());
  }

  function updateStreak() {

    const now = new Date();

    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format



    if (lastStudied === todayStr) return stats.streak;



    if (!lastStudied) {

      setLastStudied(todayStr);

      setLastActivity(new Date().toISOString());

      return 1;

    }



    // Parse the last studied date properly

    const lastDate = new Date(lastStudied + 'T00:00:00');

    const today = new Date(todayStr + 'T00:00:00');



    // Calculate difference in days

    const diffTime = today.getTime() - lastDate.getTime();

    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));



    let newStreak;

    if (diffDays === 1) {

      // Consecutive day - increment streak

      newStreak = stats.streak + 1;

    } else if (diffDays === 0) {

      // Same day - keep current streak (shouldn't happen but handle it)

      newStreak = stats.streak;

    } else {

      // Missed day(s) - reset streak

      newStreak = 1;

    }



    setLastStudied(todayStr);

    setLastActivity(new Date().toISOString());

    return newStreak;

  }







  function completeSession(result, sourceSubject) {



    // Calculate base XP with mode multiplier

    const modeMultiplier = MODE_MULTIPLIERS[result.mode] || 1;

    const baseXP = result.score * XP_PER_CORRECT;

    const streakBonusXP = result.streakBonus || 0;

    const gained = Math.round((baseXP + streakBonusXP) * modeMultiplier);

    

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

      triggerCelebration('streak', { days: newStreak, icon: newStreak >= 30 ? '🔥' : newStreak >= 14 ? '🔥' : newStreak >= 7 ? '✨' : '✨' });

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

        toast.info(`🔥 Amazing! Demo streak limit of ${DEMO_LIMITS.maxStreak} days reached. Upgrade for unlimited!`);

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

    // Submit per-question mastery to backend
    if (token && sourceSubject?.id && (result.results || []).length > 0) {
      const masteryResults = (result.results || [])
        .filter((r) => r.questionId || r.key)
        .map((r) => ({ questionId: r.questionId || r.key, correct: !!r.correct }));

      if (masteryResults.length > 0) {
        import("./lib/mastery.js").then(({ submitMasterySession }) => {
          submitMasterySession(sourceSubject.id, masteryResults).then((res) => {
            if (res?.justMastered && res?.xpBonus > 0) {
              setTimeout(() => toast.success(`🎉 100% Mastery! +${res.xpBonus} XP bonus earned!`), 800);
            }
          });
        });
      }
    }

    // Trigger badge checks and league XP update after session

    if (token) {

      import("./lib/gamificationApi").then(({ checkBadges }) => {

        checkBadges(token).catch(() => {});

      });

    }



    setActiveSession(null);



  }







  function handleResetAll() {



    const ok = window.confirm("Reset will clear your progress, outlines, and notes. Continue?");



    if (!ok) return;



    const uid = auth.user?.id || auth.user?.username || localStorage.getItem("scholars-circle-current-user") || "guest";



    // Reset all React state

    clearUserState();

    setToken("");

    setAuth((a) => ({ ...a, user: null }));



    // Clear all localStorage data for this user

    const keysToRemove = [

      "scholars-circle-auth",

      "scholars-circle-current-user",

      `scholars-circle-state::${uid}`,

      `scholars-circle-discussion::${uid}`,

    ];

    keysToRemove.forEach(k => localStorage.removeItem(k));



    // Clear any remaining per-user or app-specific keys

    Object.keys(localStorage).forEach(k => {

      if (k.includes(`::${uid}`) || k.startsWith("sc_") || k.startsWith("scholars-circle-") || k.startsWith("challenge-")) {

        localStorage.removeItem(k);

      }

    });



  }



  // Reset all user-specific React state to defaults (used on login and logout)

  function clearUserState() {

    setStats(EMPTY_STATS);

    setHistory([]);

    setWrongCounts({});

    setMastery({});

    setSrData({});

    setAssignments([]);

    setCustomQuestions([]);

    setNotes({});

    setTimetable({});

    setDiscussion({});

    setCustomFlashcards([]);

    setAiChatHistory([]);

    setReminders([]);

    setOutlineProgress({});

    setLastStudied(null);

    setLastActivity(null);

  }



  function logout() {

    // 1. Pause sync so clearing state doesn't push empty data anywhere

    syncPausedRef.current = true;



    // 2. Get current user ID before clearing auth

    const uid = auth.user?.id || auth.user?.username || localStorage.getItem("scholars-circle-current-user") || "guest";



    // 3. Reset ALL React state to defaults

    setToken("");

    setAuth((a) => ({ ...a, mode: "login", email: "", username: "", password: "", user: null, error: "", info: "" }));

    clearUserState();

    setDemoMode(false);

    setDemoLocked(false);



    // 3. Clear ALL user-specific localStorage keys

    const keysToRemove = [

      "scholars-circle-auth",

      "scholars-circle-current-user",

      "sc_demo_locked",

      "scholars-circle-heatmap",

      "scholars-circle-notifications",

      "scholars-circle-notification-settings",

      `scholars-circle-state::${uid}`,

      `scholars-circle-discussion::${uid}`,

    ];

    keysToRemove.forEach(k => localStorage.removeItem(k));



    // 4. Clear any remaining per-user or app-specific keys (iterate all localStorage)

    const allKeys = Object.keys(localStorage);

    allKeys.forEach(k => {

      if (

        k.includes(`::${uid}`) ||

        k.startsWith("sc_") ||

        k.startsWith("scholars-circle-") ||

        k.startsWith("challenge-")

      ) {

        localStorage.removeItem(k);

      }

    });



    // 5. Clear service worker caches

    if ('caches' in window) {

      caches.keys().then(names => names.forEach(name => {

        if (name.includes('runtime') || name.includes('api')) caches.delete(name);

      }));

    }

  }



  // Refresh auth status - check if user has been activated or deactivated

  const refreshAuth = useCallback(async () => {

    const authRaw = localStorage.getItem("scholars-circle-auth");

    if (!authRaw) {

      console.log("[refreshAuth] No auth data, skipping");

      return;

    }

    

    const authParsed = JSON.parse(authRaw);

    const currentToken = authParsed.authToken;

    if (!currentToken) {

      console.log("[refreshAuth] No token, skipping");

      return;

    }

    

    console.log("[refreshAuth] Checking activation status...");

    setIsCheckingActivation(true);

    try {

      const res = await api("/auth/refresh", { token: currentToken, method: "GET" });

      console.log("[refreshAuth] Response:", res);

      

      if (res.user) {

        // Use ref to get previous activation status (avoids stale closure)

        const prevIsActivated = prevActivationRef.current;

        const newIsActivated = res.user.isActivated === true;

        const userIsTeacher = String(res.user.role || "").toLowerCase() === "teacher";



        // CRITICAL: never update token from refresh polling. The /auth/refresh

        // endpoint re-signs a fresh JWT on every call, so the string always

        // differs. If we setToken(), every downstream useEffect with `token`

        // in its deps refetches (causing the "reloading every second" bug on

        // the lecturer profile, attendance, arena, etc.).

        // We ONLY care about activation status changes here.

        setAuth((a) => {

          const same =

            a.user &&

            a.user.id === res.user.id &&

            a.user.username === res.user.username &&

            a.user.role === res.user.role &&

            a.user.isActivated === res.user.isActivated &&

            a.user.activationKey === res.user.activationKey;

          return same ? a : { ...a, user: { ...(a.user || {}), ...res.user } };

        });

        

        // Update localStorage

        const authRaw = localStorage.getItem("scholars-circle-auth");

        if (authRaw) {

          const authParsed = JSON.parse(authRaw);

          authParsed.authToken = res.token;

          authParsed.authUser = { ...(authParsed.authUser || {}), ...res.user };

          localStorage.setItem("scholars-circle-auth", JSON.stringify(authParsed));

        }

        

        // Update the ref with new status

        prevActivationRef.current = newIsActivated;

        

        // Show notification if activation status changed

        if (prevIsActivated === false && newIsActivated === true) {

          // User was just activated

          console.log("[refreshAuth] Account activated!");

          toast.success("✅ Your account has been activated! Welcome aboard!");

          // Exit demo mode so restrictions are lifted immediately

          setDemoMode(false);

        } else if (prevIsActivated === true && newIsActivated === false && !userIsTeacher) {

          // User was deactivated

          console.log("[refreshAuth] Account deactivated!");

          toast.error("Your account has been deactivated. Please contact your teacher.");

          // Exit demo mode if active

          setDemoMode(false);

        }

        // Expiry warning — once per session
        if (newIsActivated && res.user.activationExpiry && !expiryWarnedRef.current) {
          const daysLeft = Math.ceil((new Date(res.user.activationExpiry) - Date.now()) / 86400000);
          if (daysLeft <= 0) {
            toast.error("❌ Your subscription has expired! Contact your teacher to renew.");
            expiryWarnedRef.current = true;
          } else if (daysLeft <= 1) {
            toast.error("⚠️ Your subscription expires TODAY! Contact your teacher to renew.");
            expiryWarnedRef.current = true;
          } else if (daysLeft <= 3) {
            toast.error(`⚠️ Subscription expires in ${daysLeft} days. Please renew soon!`);
            expiryWarnedRef.current = true;
          } else if (daysLeft <= 7) {
            toast(`⚠️ Your subscription expires in ${daysLeft} days.`, { duration: 6000 });
            expiryWarnedRef.current = true;
          }
        }

      }

    } catch (err) {

      console.error("[refreshAuth] Failed:", err);

    } finally {

      setIsCheckingActivation(false);

    }

  }, []);



  // Poll for activation status changes (both activation and deactivation)

  useEffect(() => {

    // Only require auth.user — refreshAuth reads token from localStorage directly
    // so we don't gate on the `token` state (which may be empty on first render
    // even when localStorage already has a valid token, causing the interval to
    // never start on page reload).
    if (!auth.user) {

      console.log("[polling] Skipping - no user");

      return;

    }

    

    console.log("[polling] Starting activation polling for user:", auth.user?.username);

    

    // Initialize ref with current activation status ONLY if not already set

    if (prevActivationRef.current === null) {

      prevActivationRef.current = auth.user?.isActivated === true;

      console.log("[polling] Initialized prevActivationRef to:", prevActivationRef.current);

    }

    

    // Check immediately on mount

    refreshAuth();

    // Use a faster interval (10s) while the user is NOT yet activated so
    // activation feels near-instant; slow down to 30s once activated.
    const intervalMs = auth.user?.isActivated ? 30000 : 10000;

    const interval = setInterval(refreshAuth, intervalMs);

    

    console.log(`[polling] Interval set up, checking every ${intervalMs / 1000}s`);

    

    return () => {

      console.log("[polling] Cleaning up interval");

      clearInterval(interval);

    };

  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [auth.user?.id, auth.user?.isActivated]);



  // 5-minute polling for app updates (data sync, leaderboard refresh, etc.)

  useEffect(() => {

    if (!token || !auth.user?.id || demoMode) return;



    const FIVE_MINUTES = 5 * 60 * 1000;



    const pollForUpdates = async () => {

      console.log("[5min-poll] Checking for updates...");



      // Sync data with backend

      try {

        await api("/user-data/sync", {

          method: "POST",

          body: {

            stats,

            mastery,

            wrongCounts,

            srData,

            lastStudied,

            lastActivity,

            timetable,

            outlineProgress,

            notes,

          },

        });

        console.log("[5min-poll] Data synced");

      } catch (err) {

        console.log("[5min-poll] Sync failed:", err.message);

      }

    };



    // Initial sync after 30 seconds (let app load first)

    const initialTimeout = setTimeout(pollForUpdates, 30000);



    // Then poll every 5 minutes

    const interval = setInterval(pollForUpdates, FIVE_MINUTES);



    return () => {

      clearTimeout(initialTimeout);

      clearInterval(interval);

    };

  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [token, auth.user?.id, demoMode]);



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

        lastActivity,

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



  // Load data from backend on login — backend is the source of truth

  // Accepts optional authToken param for use during login (before state updates propagate)

  async function loadFromBackend(authToken) {

    const tok = authToken || token;

    if (!tok) {

      console.log("Skipping loadFromBackend - no token");

      return;

    }



    try {

      const data = await api("/user-data", { token: tok });

      if (data.progress) {

        setStats({

          xp: data.progress.xp ?? 0,

          sessions: data.progress.sessions ?? 0,

          streak: data.progress.streak ?? 0,

          coins: data.progress.coins ?? 0,

          weeklyGoal: data.progress.weeklyGoal ?? 5,

          questsDone: {},

          totalCorrect: data.progress.totalCorrect ?? 0,

        });

        setMastery(data.progress.mastery || {});

        setWrongCounts(data.progress.wrongCounts || {});

        setSrData(data.progress.srData || {});

        setLastStudied(data.progress.lastStudied || null);

        setLastActivity(data.progress.lastActivity ?? null);

        if (data.progress.themePack) setThemePack(data.progress.themePack);

        if (data.progress.density) setDensity(data.progress.density);

      }

      if (data.timetable && Object.keys(data.timetable).length) setTimetable(data.timetable);

      if (data.outlineProgress?.length) {

        const opObj = {};

        data.outlineProgress.forEach(op => {

          if (!opObj[op.subjectId]) opObj[op.subjectId] = {};

          opObj[op.subjectId][op.semester] = op.progress;

        });

        setOutlineProgress(opObj);

      }

      if (data.notes?.length) {

        const notesObj = {};

        data.notes.forEach(n => notesObj[n.subjectId] = n.content);

        setNotes(notesObj);

      }

      if (data.flashcards?.length) {

        setCustomFlashcards(data.flashcards.map(f => ({ id: f.id, front: f.front, back: f.back, subject: f.subject })));

      }

      if (data.reminders?.length) {

        setReminders(data.reminders.map(r => ({ id: r.id, time: r.time, label: r.label, subject: r.subject, sent: r.sent })));

      }

      if (data.chatHistory?.length) {

        setAiChatHistory(data.chatHistory.map(m => ({ role: m.role, content: m.content, timestamp: new Date(m.timestamp).getTime() })));

      }

      if (data.discussions?.length) {

        const discObj = {};

        data.discussions.forEach(d => {

          if (!discObj[d.subjectId]) discObj[d.subjectId] = [];

          discObj[d.subjectId].push({ id: d.id, text: d.text, role: d.role, ts: new Date(d.createdAt).getTime(), replies: d.replies || [] });

        });

        setDiscussion(discObj);

      }

    } catch (err) {

      console.error("Failed to load from backend:", err);

    }

  }



  // Periodic background sync (temporarily disabled to prevent errors)

  useEffect(() => {

    if (!token || !auth.user?.id) return;



    // const interval = setInterval(() => {

    //   syncData();

    // }, 30000); // Sync every 30 seconds



    // return () => clearInterval(interval);

  }, [token, auth.user?.id, stats, mastery, wrongCounts, srData, lastStudied, lastActivity, timetable, outlineProgress, notes]);



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

      window.__deferredPrompt = e;

      window.dispatchEvent(new CustomEvent('pwa-install-available', { detail: e }));

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

      // Don't show toast - the new SW is already active, just refresh quietly

      // Data is preserved in localStorage

      window.location.reload();

    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);



    // Receive deep-link messages from notification clicks (SW posts { type: 'NAVIGATE', tab })

    const handleSwMessage = (event) => {

      const msg = event.data;

      if (msg?.type === 'NAVIGATE' && msg.tab) {

        try { setTab(msg.tab); } catch {}

      }

    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);



    // Check for updates periodically and on visibility change

    navigator.serviceWorker.ready.then((registration) => {

      // Check every 2 minutes for updates (more frequent polling)

      updateCheckInterval = setInterval(() => {

        registration.update().catch(() => {});

      }, 2 * 60 * 1000);



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

          console.log('Update waiting to be applied');

          setUpdatePending(true);

          setShowUpdateToast(true);

        }

      };

      registration.addEventListener('updatefound', () => {

        const newWorker = registration.installing;

        if (newWorker) {

          newWorker.addEventListener('statechange', () => {

            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {

              // New worker is waiting - show update prompt

              console.log('New service worker installed and waiting');

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

    

    // Save current state to localStorage before updating

    // (This is already done automatically by the save effect)

    console.log('Applying update - data preserved in localStorage');

    

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

    

    // Store preference

    if (permission === 'granted') {

      localStorage.setItem('scholars-circle-notifications', 'enabled');

    }

    

    return permission === 'granted';

  }



  function sendNotification(title, body, options = {}) {

    if (Notification.permission === 'granted') {

      const notification = new Notification(title, {

        body,

        icon: '/icon-192.png',

        badge: '/icon-96.png',

        vibrate: [200, 100, 200],

        requireInteraction: options.requireInteraction || false,

        tag: options.tag || 'default',

        data: options.data || {},

        ...options

      });

      

      // Handle notification click

      notification.onclick = () => {

        window.focus();

        notification.close();

        if (options.data?.tab) {

          setTab(options.data.tab);

        }

      };

      

      return notification;

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

  

  // ============ COMPREHENSIVE NOTIFICATION SYSTEM ============

  

  // Save notification settings

  useEffect(() => {

    localStorage.setItem('scholars-circle-notification-settings', JSON.stringify(notificationSettings));

  }, [notificationSettings]);

  

  // Schedule all notifications

  useEffect(() => {

    if (!booted || notificationPermission !== 'granted') return;



    const timeouts = [];

    const now = new Date();

    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format



    // 1. DAILY STUDY REMINDER

    if (notificationSettings.dailyReminder) {

      const studiedToday = lastStudied === todayStr;



      if (!studiedToday) {

        const [hours, minutes] = notificationSettings.dailyReminderTime.split(':').map(Number);

        const reminderTime = new Date();

        reminderTime.setHours(hours, minutes, 0, 0);



        // If time has passed today, schedule for tomorrow

        if (now >= reminderTime) {

          reminderTime.setDate(reminderTime.getDate() + 1);

        }



        const timeoutMs = reminderTime.getTime() - now.getTime();



        if (timeoutMs > 0 && timeoutMs < 24 * 60 * 60 * 1000) { // Within 24 hours

          const timeout = setTimeout(() => {

            const messages = [

              { title: "⏰ Time to Study!", body: "Your daily study session awaits. Keep your streak going!" },

              { title: "📚 Ready to Learn?", body: "Take 10 minutes to review and maintain your progress!" },

              { title: "🔥 Don't Break the Chain!", body: "A quick study session now keeps your streak alive!" },

              { title: "📚 Knowledge Awaits!", body: "Your brain is ready for some exercise. Let's study!" }

            ];

            const msg = messages[Math.floor(Math.random() * messages.length)];

            sendNotification(msg.title, msg.body, {

              tag: 'daily-reminder',

              data: { tab: 'practice' }

            });

          }, timeoutMs);

          timeouts.push(timeout);

        }

      }

    }



    // 2. STREAK WARNING (if streak > 2 and about to lose it)

    if (notificationSettings.streakWarning && stats.streak >= 2 && lastStudied) {

      // Parse lastStudied as ISO date

      const lastStudiedDate = new Date(lastStudied + 'T23:59:59');

      const hoursSinceStudied = (now - lastStudiedDate) / (1000 * 60 * 60);



      // Warn if 20+ hours since last study (streak will break in ~4 hours)

      if (hoursSinceStudied >= 20 && hoursSinceStudied < 24) {

        const hoursLeft = Math.ceil(24 - hoursSinceStudied);

        timeouts.push(setTimeout(() => {

          sendNotification(

            "🔥 Streak in Danger!",

            `Your ${stats.streak}-day streak will break in ${hoursLeft} hours! Study now to save it.`,

            { tag: 'streak-warning', requireInteraction: true, data: { tab: 'practice' } }

          );

        }, 0));

      }

    }



    // 3. INACTIVITY REMINDER (if not studied for X days)

    if (notificationSettings.inactivityReminder && lastStudied) {

      // Parse lastStudied as ISO date

      const lastStudiedDate = new Date(lastStudied + 'T00:00:00');

      const daysSinceStudied = Math.floor((now - lastStudiedDate) / (1000 * 60 * 60 * 24));



      if (daysSinceStudied >= notificationSettings.inactivityDays) {

        timeouts.push(setTimeout(() => {

          const messages = [

            { title: "👋 We Miss You!", body: `It's been ${daysSinceStudied} days since your last study session. Time to get back on track!` },

            { title: "📚 Your Books Are Gathering Dust!", body: "Your knowledge needs refreshing. Come back for a quick review!" },

            { title: "💪 Don't Give Up!", body: "Every expert was once a beginner. Keep going with your studies!" }

          ];

          const msg = messages[Math.floor(Math.random() * messages.length)];

          sendNotification(msg.title, msg.body, { tag: 'inactivity', data: { tab: 'home' } });

        }, 0));

      }

    }

    

    // 4. SPACED REVIEW REMINDER (if cards are due)

    if (notificationSettings.spacedReviewReminder && dueCards.length > 0) {

      // Remind 30 minutes after app load if user hasn't done spaced review

      timeouts.push(setTimeout(() => {

        sendNotification(

          "🔔 Spaced Review Due",

          `You have ${dueCards.length} cards waiting for review. Spaced repetition helps you remember 90% better!`,

          { tag: 'spaced-review', data: { tab: 'spaced' } }

        );

      }, 30 * 60 * 1000));

    }

    

    // 5. WEEKLY PROGRESS SUMMARY (Sunday evenings)

    if (notificationSettings.weeklyProgress) {

      const dayOfWeek = now.getDay(); // 0 = Sunday

      const hours = now.getHours();

      

      if (dayOfWeek === 0 && hours >= 18 && hours < 19) { // Sunday 6-7 PM

        timeouts.push(setTimeout(() => {

          const weekXP = Object.entries(studyHeatmap)

            .filter(([date]) => {

              const d = new Date(date);

              const weekAgo = new Date(now);

              weekAgo.setDate(weekAgo.getDate() - 7);

              return d >= weekAgo;

            })

            .reduce((sum, [, count]) => sum + count, 0);

          

          sendNotification(

            "📊 Weekly Progress",

            `This week: ${weekXP} XP earned, ${stats.sessions} sessions completed, ${stats.streak}-day streak! Keep it up!`,

            { tag: 'weekly-progress', data: { tab: 'stats' } }

          );

        }, 0));

      }

    }

    

    // 6. MOTIVATIONAL QUOTES (if enabled, once daily)

    if (notificationSettings.motivationalQuotes) {

      const quoteTime = new Date();

      quoteTime.setHours(8, 0, 0, 0); // 8 AM

      

      if (now < quoteTime) {

        const timeoutMs = quoteTime.getTime() - now.getTime();

        timeouts.push(setTimeout(() => {

          const quotes = [

            { quote: "The expert in anything was once a beginner.", author: "Helen Hayes" },

            { quote: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },

            { quote: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },

            { quote: "Education is not preparation for life; education is life itself.", author: "John Dewey" },

            { quote: "The more that you read, the more things you will know.", author: "Dr. Seuss" },

            { quote: "Learning never exhausts the mind.", author: "Leonardo da Vinci" }

          ];

          const q = quotes[Math.floor(Math.random() * quotes.length)];

          sendNotification(

            "💡 Daily Inspiration",

            `"${q.quote}" — ${q.author}`,

            { tag: 'motivational-quote' }

          );

        }, timeoutMs));

      }

    }

    

    return () => timeouts.forEach(clearTimeout);

  }, [booted, notificationPermission, lastStudied, stats.streak, stats.sessions, dueCards.length, notificationSettings, studyHeatmap]);



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



    // Check if demo is locked

    if (demoMode && demoLocked) {

      return;

    }



    // Check daily quiz limit for demo mode

    if (demoMode) {

      const today = new Date().toDateString();

      const usedToday = demoUsage.quizDate === today ? demoUsage.quizUsed : 0;

      if (usedToday >= DEMO_LIMITS.quizDaily) {

        setDemoLocked(true);

        return;

      }

    }



    // Limit questions to 10 for demo users

    let finalPool = pool;

    if (demoMode && pool.length > 10) {

      finalPool = pool.slice(0, 10);

      setTimeout(() => {

        toast.info("Free Trial: Limited to 10 questions. Upgrade for unlimited!");

      }, 300);

    }



    // Smart Practice Engine: adaptive question selection for practice mode

    if (mode === "practice" && finalPool.length > 10 && !questionCount) {

      finalPool = selectAdaptiveQuestions(finalPool, {

        count: Math.min(15, finalPool.length),

        wrongCounts: wrongCounts || {},

        mastery: mastery || {},

        srData: srData || {},

        recentResults: (history || []).slice(-20).flatMap(h => h.results || []),

      });

    }



    const autoMinutes = Math.max(10, Math.round((finalPool.length * 90) / 60));

    const totalSeconds = mode === "exam" ? (customMinutes ? customMinutes * 60 : autoMinutes * 60) : null;



    setActiveSession({ mode, source: subject, questions: finalPool, totalSeconds });



    if (demoMode) {

      const today = new Date().toDateString();

      setDemoUsage(prev => ({

        ...prev,

        quizUsed: prev.quizDate === today ? (prev.quizUsed || 0) + 1 : 1,

        quizDate: today,

        practiceQuestions: prev.practiceQuestions + 1,

      }));

    }



  }







  function startDiagnostic() {



    // Check if demo is locked

    if (demoMode && demoLocked) {

      return;

    }



    // Check daily quiz limit for demo mode

    if (demoMode) {

      const today = new Date().toDateString();

      const usedToday = demoUsage.quizDate === today ? demoUsage.quizUsed : 0;

      if (usedToday >= DEMO_LIMITS.quizDaily) {

        setDemoLocked(true);

        return;

      }

    }



    const questions = SUBJECTS.map((s) => {



      const q = s.questions[0];



      return { ...q, key: `${s.id}-0`, subjectId: s.id, subjectLabel: s.label, subjectIcon: s.icon };



    });



    // Limit to 10 questions for demo users

    const finalQuestions = demoMode && questions.length > 10 ? questions.slice(0, 10) : questions;

    if (demoMode && questions.length > 10) {

      setTimeout(() => {

        toast.info("Free Trial: Limited to 10 questions. Upgrade for unlimited!");

      }, 300);

    }



    setActiveSession({ mode: "diagnostic", source: { id: "diagnostic", label: "Diagnostic", icon: "📖" }, questions: finalQuestions });



    if (demoMode) {

      const today = new Date().toDateString();

      setDemoUsage(prev => ({

        ...prev,

        quizUsed: prev.quizDate === today ? (prev.quizUsed || 0) + 1 : 1,

        quizDate: today,

        practiceQuestions: prev.practiceQuestions + 1,

      }));

    }



  }







  function startAdaptive() {



    const picked = [];



    const seen = new Set();



    const maxQuestions = demoMode ? 10 : 8;



    while (picked.length < Math.min(maxQuestions, allQuestions.length)) {



      const candidate = pickAdaptiveQuestion(allQuestions, wrongCounts, mastery);



      if (!seen.has(candidate.key)) {



        picked.push(candidate);



        seen.add(candidate.key);



      }



    }



    if (demoMode) {

      setTimeout(() => {

        toast.info("Free Trial: Limited to 10 questions. Upgrade for unlimited!");

      }, 300);

    }



    setActiveSession({ mode: "adaptive", source: { id: "adaptive", label: "Adaptive", icon: "📖" }, questions: picked });



  }







  function startSpacedReview() {



    let cardsToReview = dueCards;

    if (demoMode && dueCards.length > DEMO_LIMITS.maxSpacedReviewCards) {

      cardsToReview = dueCards.slice(0, DEMO_LIMITS.maxSpacedReviewCards);

      setTimeout(() => {

        toast.info(`Demo: Limited to ${DEMO_LIMITS.maxSpacedReviewCards} spaced review cards. Upgrade for unlimited!`);

      }, 300);

    }



    setActiveSession({



      mode: "spaced",



      source: { id: "spaced", label: "Spaced Review", icon: "📖" },



      questions: cardsToReview,



    });



  }







  function startWeakDrill() {



    const weak = allQuestions.filter((q) => (wrongCounts[q.key] || 0) > 0);

    

    // Limit to 10 questions for demo users

    const finalWeak = demoMode && weak.length > 10 ? weak.slice(0, 10) : weak;

    if (demoMode && weak.length > 10) {

      setTimeout(() => {

        toast.info("Free Trial: Limited to 10 questions. Upgrade for unlimited!");

      }, 300);

    }



    setActiveSession({ mode: "weak", source: { id: "weak", label: "Weak Drill", icon: "📖" }, questions: finalWeak });



  }







  function startErrorDrill() {



    const wrongs = allQuestions.filter((q) => (wrongCounts[q.key] || 0) > 0).slice(0, 12);



    if (!wrongs.length) { toast.info("No wrong answers yet. Practice first!"); return; }

    

    // Limit to 10 questions for demo users

    const finalWrongs = demoMode && wrongs.length > 10 ? wrongs.slice(0, 10) : wrongs;

    if (demoMode && wrongs.length > 10) {

      setTimeout(() => {

        toast.info("Free Trial: Limited to 10 questions. Upgrade for unlimited!");

      }, 300);

    }



    setActiveSession({ mode: "error", source: { id: "error", label: "Error Drill", icon: "📖" }, questions: finalWrongs, totalSeconds: finalWrongs.length * 60 });



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



        payload: { stats, history, wrongCounts, mastery, srData, assignments, lastStudied, lastActivity },



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

      setLastActivity(data.payload.lastActivity ?? null);



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

      <main style={{ minHeight: '100vh', background: '#0A0D13', color: '#EDEFF5', fontFamily: 'Manrope, sans-serif', fontSize: 16, lineHeight: 1.5, WebkitFontSmoothing: 'antialiased', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          a { color: inherit; text-decoration: none; }
          h1, h2 { font-family: 'Syne', sans-serif; margin: 0; letter-spacing: -0.01em; }
          p { margin: 0; }
          button { font-family: inherit; }

          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes counterspin { to { transform: rotate(-360deg); } }
          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
          @keyframes sweep { from { transform: translateY(0); opacity: 1; } to { transform: translateY(420%); opacity: 0; } }
          @keyframes blink { 50% { opacity: 0; } }

          .auth-orbit-ring { animation: spin 70s linear infinite; }
          .auth-orbit-chip span { display: inline-block; animation: counterspin 70s linear infinite; }
          .auth-float-card { animation: float 6s ease-in-out infinite; }
          .auth-pulse-dot { animation: pulse 2s ease-in-out infinite; }
          .auth-scan-sweep { animation: sweep 2.6s ease-out 1; }
          .auth-cursor { animation: blink 1s steps(2) infinite; color: #FFD700; }

          .auth-btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            padding: 11px 20px; border-radius: 999px;
            font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 0.92rem;
            cursor: pointer; border: 1px solid transparent;
            transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
            white-space: nowrap;
          }
          .auth-btn:hover { transform: translateY(-1px); }
          .auth-btn-ghost { color: #EDEFF5; border-color: rgba(255,255,255,0.16); background: transparent; }
          .auth-btn-ghost:hover { border-color: #9AA3B5; }
          .auth-btn-primary { background: #F5A623; color: #1A1300; }
          .auth-btn-primary:hover { background: #FFB838; }
          .auth-btn-sm { padding: 8px 16px; font-size: 0.85rem; }
          .auth-btn-lg { padding: 15px 26px; font-size: 0.98rem; }

          .auth-tab {
            flex: 1; background: none; border: none; padding: 9px 0; border-radius: 999px;
            font-weight: 700; font-size: 0.88rem; color: #646E84; cursor: pointer; position: relative; z-index: 1;
            transition: color 0.2s ease;
          }
          .auth-tab.active { color: #1A1300; }

          .auth-input {
            width: 100%; background: #151A24; border: 1px solid rgba(255,255,255,0.16); color: #EDEFF5;
            border-radius: 10px; padding: 13px 14px; font-size: 0.95rem; font-family: 'Manrope', sans-serif;
            transition: border-color 0.15s ease, box-shadow 0.15s ease; appearance: none; -webkit-appearance: none;
          }
          .auth-input::placeholder { color: #646E84; }
          .auth-input:focus { border-color: #FFD700; box-shadow: 0 0 0 3px rgba(79,142,247,0.14); outline: none; }

          .auth-select {
            width: 100%; background: #151A24; border: 1px solid rgba(255,255,255,0.16); color: #EDEFF5;
            border-radius: 10px; padding: 13px 14px; font-size: 0.95rem; font-family: 'Manrope', sans-serif;
            cursor: pointer; appearance: none; -webkit-appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239AA3B5' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px;
          }
          .auth-select:focus { border-color: #FFD700; box-shadow: 0 0 0 3px rgba(79,142,247,0.14); outline: none; }

          @media (max-width: 900px) {
            .auth-shell { grid-template-columns: 1fr !important; }
            .auth-visual-panel { display: none !important; }
            .auth-form-panel { padding: 32px 24px !important; min-height: 100vh; }
          }
          @media (max-width: 560px) {
            .auth-form-panel { padding: 24px 20px !important; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
          }
        `}</style>

        {loadingOverlay && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,13,19,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <img src="/loading.png" alt="Loading" style={{ width: 64, height: 64, borderRadius: 14 }} />
            <span style={{ color: '#9AA3B5', fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }}>Loading...</span>
          </div>
        )}

        {/* PWA Update Toast */}
        {showUpdateToast && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#151A24', color: '#EDEFF5', padding: '12px 20px', borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, maxWidth: 400,
            border: '1px solid rgba(79,142,247,0.3)'
          }}>
            <span style={{ fontSize: 16 }}>Update</span>
            <span style={{ flex: 1 }}>
              {updatePending ? 'A new version is available!' : 'App updated. Refresh to see changes.'}
            </span>
            <button
              onClick={() => {
                if (updatePending) { applyUpdate(); } else { window.location.reload(); }
              }}
              style={{ background: '#FFD700', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {updatePending ? 'Update Now' : 'Reload'}
            </button>
            <button
              onClick={() => setShowUpdateToast(false)}
              style={{ background: 'none', border: 'none', color: '#646E84', cursor: 'pointer', fontSize: 18, padding: 0 }}
            >x</button>
          </div>
        )}

        <div className="auth-shell" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* Visual Panel */}
          <div className="auth-visual-panel" style={{
            position: 'relative',
            background: 'radial-gradient(circle at 30% 20%, rgba(79,142,247,0.14), transparent 55%), radial-gradient(circle at 80% 85%, rgba(245,166,35,0.10), transparent 50%), #11151E',
            borderRight: '1px solid rgba(255,255,255,0.09)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '40px 48px',
          }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none',
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)',
              backgroundSize: '42px 42px',
              WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 72%)',
              maskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 72%)',
            }} />
            <div className="auth-scan-sweep" style={{ position: 'absolute', left: 0, right: 0, top: '-30%', height: '30%', background: 'linear-gradient(180deg, rgba(79,142,247,0.10), transparent)', pointerEvents: 'none' }} />

            {/* Top: Logo + boot line */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: '#EDEFF5' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F5A623', boxShadow: '0 0 0 4px rgba(245,166,35,0.14)' }} />
                Scholar's Circle
              </Link>
              <div style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', color: '#646E84', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{'>>> connecting to your circle'}</span>
                <span className="auth-cursor">_</span>
              </div>
            </div>

            {/* Center: Orbit + Ring */}
            <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 340, height: 340 }}>
                <div className="auth-orbit-ring" style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(255,255,255,0.16)', borderRadius: '50%' }}>
                  {[
                    { top: '-12px', left: '50%', transform: 'translateX(-50%)', label: 'BIO 111' },
                    { top: '50%', left: 'auto', right: '-12px', transform: 'translateY(-50%)', label: 'CHM 111' },
                    { top: 'auto', bottom: '-12px', left: '50%', transform: 'translateX(-50%)', label: 'PHY 111' },
                    { top: '50%', left: '-12px', right: 'auto', transform: 'translateY(-50%)', label: 'MTH 111' },
                  ].map((c, i) => (
                    <span key={i} className="auth-orbit-chip" style={{ position: 'absolute', top: c.top, left: c.left, right: c.right, bottom: c.bottom, transform: c.transform, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: '#9AA3B5', background: '#151A24', border: '1px solid rgba(255,255,255,0.16)', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      <span>{c.label}</span>
                    </span>
                  ))}
                </div>
                <div style={{ position: 'absolute', width: 190, height: 190, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#11151E', boxShadow: '0 0 0 1px rgba(255,255,255,0.16), 0 0 60px rgba(79,142,247,0.18)' }}>
                  <svg viewBox="0 0 190 190" width="190" height="190" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                    <defs>
                      <linearGradient id="authRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFD700" />
                        <stop offset="100%" stopColor="#F5A623" />
                      </linearGradient>
                    </defs>
                    <circle fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="8" cx="95" cy="95" r="80" />
                    <circle
                      fill="none" strokeWidth="8" strokeLinecap="round" stroke="url(#authRingGrad)"
                      cx="95" cy="95" r="80"
                      strokeDasharray="503"
                      strokeDashoffset={auth.mode === 'signup' ? 503 - (503 * 0.12) : 503 - (503 * 0.68)}
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.2,0.7,0.2,1)' }}
                    />
                  </svg>
                  <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 20px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.2, color: '#EDEFF5' }}>
                      {auth.mode === 'signup' ? 'Join the Circle.' : 'Welcome back.'}
                    </h2>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#9AA3B5', marginTop: 6, display: 'block', letterSpacing: '0.03em' }}>
                      {auth.mode === 'signup' ? '2-DAY FREE TRIAL - NO CARD' : 'YOUR STREAK IS WAITING'}
                    </span>
                  </div>
                </div>
                <div className="auth-float-card" style={{ position: 'absolute', top: '6%', right: '0%', background: '#151A24', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', boxShadow: '0 12px 28px rgba(0,0,0,0.4)', color: '#F5A623' }}>+12 XP</div>
                <div className="auth-float-card" style={{ position: 'absolute', bottom: '8%', left: '-4%', background: '#151A24', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', boxShadow: '0 12px 28px rgba(0,0,0,0.4)', color: '#FF5470', animationDelay: '1.2s' }}>4-day streak</div>
              </div>
            </div>

            {/* Bottom: Pulse stat */}
            <div style={{ position: 'relative', zIndex: 2 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#646E84' }}>
                <span className="auth-pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#3DD68C', marginRight: 8, boxShadow: '0 0 0 3px rgba(61,214,140,0.18)' }} />
                1,284 students studying right now
              </span>
            </div>
          </div>

          {/* Form Panel */}
          <div className="auth-form-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>
            <div style={{ width: '100%', maxWidth: 380 }}>

              <a href="/?force_home=1" style={{ fontSize: '0.84rem', color: '#646E84', fontWeight: 600, display: 'inline-flex', gap: 6, marginBottom: 28, textDecoration: 'none' }}>
                {'<- Back to home'}
              </a>

              {/* Tabs */}
              <div style={{ position: 'relative', display: 'flex', gap: 4, background: '#11151E', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 999, padding: 4, marginBottom: 32 }}>
                <button
                  className={'auth-tab ' + (auth.mode === 'login' ? 'active' : '')}
                  onClick={() => setAuth((a) => ({ ...a, mode: 'login', error: '', info: '' }))}
                >Sign in</button>
                <button
                  className={'auth-tab ' + (auth.mode === 'signup' ? 'active' : '')}
                  onClick={() => setAuth((a) => ({ ...a, mode: 'signup', error: '', info: '' }))}
                >Sign up</button>
                <div style={{
                  position: 'absolute', top: 4, left: 4,
                  width: 'calc(50% - 4px)', height: 'calc(100% - 8px)',
                  background: '#F5A623', borderRadius: 999,
                  transition: 'transform 0.25s cubic-bezier(0.3,0.7,0.3,0.1)',
                  transform: auth.mode === 'signup' ? 'translateX(100%)' : 'translateX(0)',
                }} />
              </div>

              {/* Sign In */}
              {auth.mode === 'login' ? (
                <>
                  <div style={{ marginBottom: 28 }}>
                    <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>Welcome back</h1>
                    <p style={{ color: '#9AA3B5', fontSize: '0.94rem' }}>Your mastery ring missed you. Let's get back to it.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Email or username</label>
                      <input
                        className="auth-input"
                        value={auth.username}
                        onChange={(e) => setAuth((a) => ({ ...a, username: e.target.value.replace(/\s/g, '') }))}
                        placeholder="you@email.com"
                        autoComplete="username"
                        onKeyDown={(e) => { if (e.key === 'Enter') login(); }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="auth-input"
                          type={showLoginPassword ? 'text' : 'password'}
                          value={auth.password}
                          onChange={(e) => setAuth((a) => ({ ...a, password: e.target.value }))}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          style={{ paddingRight: 40 }}
                          onKeyDown={(e) => { if (e.key === 'Enter') login(); }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#646E84', cursor: 'pointer', padding: 4, display: 'flex', fontSize: 14 }}
                          tabIndex={-1}
                        >
                          {showLoginPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9AA3B5', cursor: 'pointer' }}>
                        <input type="checkbox" style={{ accentColor: '#F5A623', width: 15, height: 15 }} />Keep me signed in
                      </label>
                    </div>

                    <button onClick={login} disabled={loadingOverlay} className="auth-btn auth-btn-primary auth-btn-lg" style={{ width: '100%', opacity: loadingOverlay ? 0.6 : 1, cursor: loadingOverlay ? 'not-allowed' : 'pointer' }}>
                      {loadingOverlay ? 'Signing in...' : 'Sign in ->'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: '#646E84', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
                    or
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
                  </div>

                  <button className="auth-btn auth-btn-ghost" style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: '0.9rem' }}>
                    Continue with Google
                  </button>

                  <p style={{ textAlign: 'center', marginTop: 26, fontSize: '0.88rem', color: '#9AA3B5' }}>
                    New here? <span onClick={() => setAuth((a) => ({ ...a, mode: 'signup', error: '', info: '' }))} style={{ color: '#F5A623', fontWeight: 700, cursor: 'pointer' }}>Start your 2-day free trial</span>
                  </p>
                </>
              ) : (
                /* Sign Up */
                <>
                  <div style={{ marginBottom: 28 }}>
                    <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>Join the Circle</h1>
                    <p style={{ color: '#9AA3B5', fontSize: '0.94rem' }}>2-day free trial. No card needed.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Full name</label>
                      <input
                        className="auth-input"
                        ref={signupFullNameRef}
                                                placeholder="Adeola Okafor"
                        autoComplete="name"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Username</label>
                      <input
                        className="auth-input"
                        ref={signupUsernameRef}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                          e.target.value = sanitized;
                        }}
                        placeholder="adeola_okafor"
                        autoComplete="username"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Email</label>
                      <input
                        className="auth-input"
                        ref={signupEmailRef}
                        onChange={(e) => { e.target.value = e.target.value.replace(/\s/g, ''); }}
                        placeholder="you@email.com"
                        type="email"
                        autoComplete="email"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="auth-input"
                          ref={signupPasswordRef}
                          type={showSignupPassword ? 'text' : 'password'}
                                                    placeholder="Min 8 characters"
                          autoComplete="new-password"
                          style={{ paddingRight: 40 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((v) => !v)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#646E84', cursor: 'pointer', padding: 4, display: 'flex', fontSize: 14 }}
                          tabIndex={-1}
                        >
                          {showSignupPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Confirm password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="auth-input"
                          ref={signupConfirmPasswordRef}
                          type={showSignupConfirmPassword ? 'text' : 'password'}
                                                    placeholder="Re-enter your password"
                          autoComplete="new-password"
                          style={{ paddingRight: 40 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupConfirmPassword((v) => !v)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#646E84', cursor: 'pointer', padding: 4, display: 'flex', fontSize: 14 }}
                          tabIndex={-1}
                        >
                          {showSignupConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Role</label>
                      <select
                        className="auth-select"
                        ref={signupRoleRef}
                        onChange={(e) => { setAuth((a) => ({ ...a, signupRole: e.target.value })); }}
                        defaultValue="STUDENT"
                      >
                        <option value="STUDENT">Student</option>
                        <option value="TEACHER">Teacher</option>
                      </select>
                    </div>

                    {auth.signupRole === 'TEACHER' && (
                      <div>
                        <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Teacher invite code</label>
                        <input
                          className="auth-input"
                          ref={signupInviteCodeRef}
                          onChange={(e) => { e.target.value = e.target.value.replace(/\s/g, ''); }}
                          placeholder="Enter invite code"
                        />
                      </div>
                    )}

                    <label style={{ fontSize: '0.82rem', color: '#646E84', display: 'flex', gap: 9, alignItems: 'flex-start', lineHeight: 1.4 }}>
                      <input type="checkbox" style={{ marginTop: 3, accentColor: '#F5A623', width: 15, height: 15, flexShrink: 0 }} />
                      <span>I agree to the <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#FFD700', fontWeight: 600 }}>Terms of Service</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#FFD700', fontWeight: 600 }}>Privacy Policy</a>.</span>
                    </label>

                    <button onClick={signup} disabled={loadingOverlay} className="auth-btn auth-btn-primary auth-btn-lg" style={{ width: '100%', opacity: loadingOverlay ? 0.6 : 1, cursor: loadingOverlay ? 'not-allowed' : 'pointer' }}>
                      {loadingOverlay ? 'Creating account...' : 'Start your 2-day free trial ->'}
                    </button>
                  </div>

                  <p style={{ textAlign: 'center', marginTop: 26, fontSize: '0.88rem', color: '#9AA3B5' }}>
                    Already circling back? <span onClick={() => setAuth((a) => ({ ...a, mode: 'login', error: '', info: '' }))} style={{ color: '#F5A623', fontWeight: 700, cursor: 'pointer' }}>Sign in</span>
                  </p>
                </>
              )}

              {/* Error / Info banners */}
              {auth.info && (
                <div style={{ marginTop: 16, padding: 12, background: 'rgba(52,211,153,0.1)', borderRadius: 10, border: '1px solid rgba(52,211,153,0.3)' }}>
                  <p style={{ margin: 0, color: '#34d399', fontSize: 13 }}>{auth.info}</p>
                </div>
              )}

              {auth.error && (
                <div style={{ marginTop: 16, padding: 12, background: 'rgba(248,113,113,0.1)', borderRadius: 10, border: '1px solid rgba(248,113,113,0.3)' }}>
                  <p style={{ margin: 0, color: '#f87171', fontSize: 13, whiteSpace: 'pre-wrap' }}>{auth.error}</p>
                </div>
              )}

              {/* Support */}
              <div style={{ marginTop: 24, padding: 16, background: 'rgba(148,163,184,0.06)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.15)' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: '#9AA3B5' }}>Need help?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <a
                    href="https://wa.link/yj2em4?text=Hi%20Scholar's%20Circle%20team,%20I%20need%20help%20with%20my%20account."
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', color: 'white', textDecoration: 'none', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, justifyContent: 'center' }}
                  >
                    Chat on WhatsApp
                  </a>
                  <a
                    href="tel:09028617178"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFD700', color: 'white', textDecoration: 'none', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, justifyContent: 'center' }}
                  >
                    Call: 09028617178
                  </a>
                </div>
                <p style={{ marginTop: 8, fontSize: 11, textAlign: 'center', color: '#646E84' }}>
                  Having trouble? Reach out and we'll help you right away.
                </p>
              </div>

            </div>
          </div>

        </div>

      </main>

    );

  }



  // Gate: non-activated students see locked screen

  console.log("[GATE CHECK] auth.user:", !!auth.user, "isActivated:", isActivated, "demoMode:", demoMode, "willLock:", auth.user && !isActivated && !demoMode);

  if (auth.user && !isActivated && !demoMode) {

    console.log("[GATE] Showing locked screen");

    return (

      <main className={`${darkMode ? "app dark" : "app light"} theme-${themePack}`}>

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

            border: "1px solid rgba(255,215,0,0.3)"

          }}>

            <span>📱</span>

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

                background: "#FFD700",

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

              ?

            </button>

          </div>

        )}

        <LockedScreen

          activationKey={auth.user.activationKey}

          username={auth.user.username}

          userRole={auth.user.role}

          onLogout={logout}

          onTryDemo={() => setDemoMode(true)}

          onRefresh={refreshAuth}

          isChecking={isCheckingActivation}

          onGetPremium={() => setShowPaymentModal(true)}

          deferredPrompt={deferredPrompt}

          onInstall={handleInstallClick}

          isIOS={isIOS}

        />

      </main>

    );

  }



  if (activeSession && activeSession.mode !== "practicehints") {



    return (



      <main className={`${darkMode ? "app dark" : "app light"} theme-${themePack}`}>



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

            border: "1px solid rgba(255,215,0,0.3)"

          }}>

            <span>📱</span>

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

                background: "#FFD700",

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

              ?

            </button>

          </div>

        )}



        {activeSession.mode === "exam" ? (

          <ExamSimulator

            session={activeSession}

            aiConfig={aiConfig}

            history={history}

            onExit={(action) => {

              setActiveSession(null);

              if (action === "drill-weak") {

                setTimeout(() => startWeakDrill(), 300);

              }

            }}

            onComplete={(result) => {

              updateLearningModels(result.results);

              completeSession(result, activeSession.source);

            }}

          />

        ) : (

          <SessionPlayer

            session={activeSession}

            aiConfig={aiConfig}

            onExit={() => setActiveSession(null)}

            onComplete={(result) => {

              updateLearningModels(result.results);

              completeSession(result, activeSession.source);

            }}

          />

        )}



      </main>



    );



  }





  return (

    <main className={`${darkMode ? "app dark" : "app light"} theme-${themePack}`}>

      {/* Offline Banner */}
      {isOffline && (
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 999,
          background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))",
          borderBottom: "1px solid rgba(245,158,11,0.3)",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#fbbf24",
          fontWeight: 500,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>You're offline. Cached content is available — changes will sync when you reconnect.</span>
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

          border: "1px solid rgba(255,215,0,0.3)"

        }}>

          <span>📱</span>

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

              background: "#FFD700",

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

            ?

          </button>

        </div>

      )}

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

          border: "1px solid rgba(255,215,0,0.3)"

        }}>

          <span>📱</span>

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

              background: "#FFD700",

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

            ?

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

          <div style={{ fontWeight: 600, marginBottom: 8 }}>? Time Limit Warning</div>

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

                <div style={{ background: "rgba(255,215,0,0.1)", padding: 12, borderRadius: 8 }}>

                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>{demoUsage.demoProgress.achievements.length}/{DEMO_ACHIEVEMENTS.length}</div>

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

                <div style={{ background: "rgba(218,165,32,0.1)", padding: 12, borderRadius: 8 }}>

                  <div style={{ fontSize: 24, fontWeight: 700, color: "#DAA520" }}>{demoUsage.sessionTimeMinutes}m</div>

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

                style={{ background: "#FFD700", color: "white", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}

              >

                Upgrade Now

              </button>

            </div>

          </div>

        </div>

      )}



      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)} style={{ zIndex: 10001 }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 0 }}>
            {/* Compact header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
                <span>⭐</span> Upgrade
              </div>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: "none", border: "none", color: "#7b82b8", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {/* Plan picker — horizontal row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[
                  { id: "week1", label: "1 Week", price: "₦700" },
                  { id: "week2", label: "2 Weeks", price: "₦1,300" },
                  { id: "month1", label: "1 Month", price: "₦2,400", badge: "BEST VALUE" },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedPlan(p.id); setPaymentMethod("paystack"); }}
                    style={{
                      flex: 1,
                      position: "relative",
                      border: selectedPlan === p.id ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      padding: "12px 8px",
                      cursor: "pointer",
                      background: selectedPlan === p.id ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.03)",
                      textAlign: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    {p.badge && (
                      <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#fff", fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{p.badge}</div>
                    )}
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#FFD700" }}>{p.price}</div>
                    {selectedPlan === p.id && (
                      <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: "#FFD700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>?</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Payment method toggle + content */}
              {selectedPlan && (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button
                      onClick={() => setPaymentMethod("paystack")}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: paymentMethod === "paystack" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.15)",
                        background: paymentMethod === "paystack" ? "rgba(255,215,0,0.1)" : "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >💳 Pay Online</button>
                    <button
                      onClick={() => setPaymentMethod("transfer")}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: paymentMethod === "transfer" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.15)",
                        background: paymentMethod === "transfer" ? "rgba(255,215,0,0.1)" : "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >🏦 Bank Transfer</button>
                  </div>
                  {/* Paystack */}
                  {paymentMethod === "paystack" && (
                    <button
                      onClick={() => {
                        const plan = { week1: { label: "1 Week", price: 700 }, week2: { label: "2 Weeks", price: 1300 }, month1: { label: "1 Month", price: 2400 } }[selectedPlan];
                        const rawEmail = auth.user?.email || auth.user?.username || "";
                        const payEmail = rawEmail.includes("@") ? rawEmail : `${rawEmail || "user"}@scholars-circle.app`;
                        try {
                          const popup = new PaystackPop();
                          popup.newTransaction({
                            key: PAYSTACK_PUBLIC_KEY,
                            email: payEmail,
                            amount: plan.price * 100,
                            currency: "NGN",
                            reference: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            metadata: { plan: selectedPlan, activationKey: auth.user?.activationKey || "", userId: auth.user?.id || "" },
                            onSuccess: (transaction) => {
                              fetch(`${API_BASE}/payment/verify`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                body: JSON.stringify({ reference: transaction.reference, plan: selectedPlan, activationKey: auth.user?.activationKey || "" }),
                              })
                                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                                .then(({ ok, data }) => {
                                  if (ok && data.activated) {
                                    refreshAuth();
                                    setShowPaymentModal(false);
                                  }
                                })
                                .catch(() => {});
                            },
                            onCancel: () => {},
                          });
                        } catch (err) {
                          alert(`Payment error: ${err.message || "Unknown error"}. Please refresh and try again.`);
                        }
                      }}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 10, border: "none",
                        fontSize: 15, fontWeight: 700, cursor: "pointer",
                        background: "linear-gradient(135deg, #FFD700, #DAA520)", color: "#fff",
                      }}
                    >💳 Pay {selectedPlan === "week1" ? "₦700" : selectedPlan === "week2" ? "₦1,300" : "₦2,400"} → Instant Activation</button>
                  )}
                  {/* Bank Transfer */}
                  {paymentMethod === "transfer" && (
                    <div>
                      <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13, lineHeight: 1.7 }}>
                        <div><strong>Bank:</strong> Opay</div>
                        <div><strong>Account:</strong> 9069372522</div>
                        <div><strong>Name:</strong> Zibiri-David Delight Aluaye</div>
                        <div><strong>Amount:</strong> {selectedPlan === "week1" ? "₦700" : selectedPlan === "week2" ? "₦1,300" : "₦2,400"}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#9fa8da", marginBottom: 8, textAlign: "center" }}>
                        Activation key: <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#fbbf24", letterSpacing: 1 }}>{auth.user?.activationKey || "N/A"}</span>
                      </div>
                      <a
                        href={`https://wa.link/yj2em4?text=${encodeURIComponent(`Hi, I've paid for ${selectedPlan === "week1" ? "1 week" : selectedPlan === "week2" ? "2 weeks" : "1 month"} plan. Key: ${auth.user?.activationKey || "N/A"}. Proof:`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block", textAlign: "center", background: "#25D366", color: "#fff",
                          textDecoration: "none", padding: "12px", borderRadius: 8, fontWeight: 600, fontSize: 14,
                        }}
                      >💬 Send Payment Proof on WhatsApp</a>
                      <div style={{ fontSize: 10, color: "#4a5080", textAlign: "center", marginTop: 8 }}>Manual activation may take up to 2 hours</div>
                    </div>
                  )}
                </>
              )}
              {/* Footer */}
              <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: "#4a5080" }}>
                Cancel anytime — <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowPaymentModal(false)}>Close</span>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Demo Locked Screen - shown when time limit reached */}

      {demoLocked && demoMode && (

        <div className="modal-overlay" style={{ zIndex: 10000 }}>

          <div className="modal-box" style={{ maxWidth: 500, textAlign: "center", background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)" }}>

            <div style={{ fontSize: 64, marginBottom: 16 }}>📱</div>

            <h2 style={{ margin: "0 0 12px 0", color: "var(--warning-color, #fbbf24)" }}>Daily Time Limit Reached</h2>

            <p style={{ marginBottom: 20, lineHeight: 1.6, color: "var(--text-secondary, #cbd5e1)" }}>

              You've used your {DEMO_LIMITS.dailyTimeLimit} minutes for today. Upgrade for unlimited access or wait until tomorrow!

            </p>

            <div style={{ background: "var(--success-bg, rgba(45,212,160,0.1))", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "left", border: "1px solid var(--success-border, rgba(45,212,160,0.3))" }}>

              <strong style={{ color: "var(--success-text, #2dd4a0)", display: "block", marginBottom: 10 }}>? Upgrade for:</strong>

              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 12, color: "var(--text-primary, #f1f5f9)" }}>

                <li>Unlimited study time</li>

                <li>Unlimited quizzes & practice</li>

                <li>Full subject library</li>

                <li>AI Tutor & flashcards</li>

              </ul>

            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>

              <button

                onClick={() => {

                  setShowPaymentModal(true);

                }}

                style={{ background: "var(--accent-color, #FFD700)", color: "white", fontWeight: 600, padding: "12px 24px", fontSize: 14, border: "none", borderRadius: 6, cursor: "pointer" }}

              >

                Upgrade Now

              </button>

              <button

                onClick={() => {

                  const tomorrow = new Date();

                  tomorrow.setDate(tomorrow.getDate() + 1);

                  tomorrow.setHours(0, 0, 0, 0);

                  const hoursLeft = Math.ceil((tomorrow.getTime() - Date.now()) / (1000 * 60 * 60));

                  toast.info(`Come back tomorrow! Limits reset in ~${hoursLeft} hours.`);

                }}

                style={{ background: "transparent", border: "1px solid var(--border-color, #334155)", color: "var(--text-primary, #f1f5f9)", padding: "10px 20px", fontSize: 13, borderRadius: 6, cursor: "pointer" }}

              >

                Wait Till Tomorrow

              </button>

              <button

                onClick={() => {

                  if (confirm("Are you sure you want to log out? Your demo progress will be saved.")) {

                    logout();

                  }

                }}

                style={{ background: "var(--danger-bg, rgba(239,68,68,0.1))", border: "1px solid var(--danger-border, #ef4444)", color: "var(--danger-text, #fca5a5)", padding: "10px 20px", fontSize: 13, borderRadius: 6, cursor: "pointer" }}

              >

                Log Out

              </button>

            </div>

          </div>

        </div>

      )}



      {showDemoSummary && demoMode && !demoLocked && (

        <div className="modal-overlay" onClick={() => setShowDemoSummary(false)}>

          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>

            <h3 style={{ margin: "0 0 16px 0" }}>📊 Demo Summary</h3>

            <div style={{ marginBottom: 20 }}>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>

                <div style={{ background: "rgba(255,215,0,0.1)", padding: 12, borderRadius: 8 }}>

                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>{demoUsage.demoProgress.achievements.length}/{DEMO_ACHIEVEMENTS.length}</div>

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

                <div style={{ background: "rgba(218,165,32,0.1)", padding: 12, borderRadius: 8 }}>

                  <div style={{ fontSize: 24, fontWeight: 700, color: "#DAA520" }}>{demoUsage.sessionTimeMinutes}m</div>

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

                style={{ background: "#FFD700", color: "white", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}

              >

                Upgrade Now

              </button>

            </div>

          </div>

        </div>

      )}



      <AchievementNotification stats={stats} history={history} subjects={subjects} mastery={mastery} />



      {/* Global Announcement Popup - shows on login for students */}

      {globalAnnouncement && (

        <div className="modal-overlay" style={{ zIndex: 9999 }}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{

            maxWidth: 500,

            border: "2px solid rgba(239, 68, 68, 0.5)",

            background: "linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(239, 68, 68, 0.15))",

            boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.25)"

          }}>

            <div style={{ textAlign: "center", marginBottom: 16 }}>

              <span style={{ fontSize: 48, display: "block", marginBottom: 8 }}>🎁</span>

              <h3 style={{ color: "#fbbf24", fontSize: 20, textTransform: "uppercase", letterSpacing: 1 }}>Important Announcement</h3>

            </div>

            <h4 style={{ fontSize: 18, marginBottom: 12 }}>{globalAnnouncement.title}</h4>

            <p style={{ marginBottom: 16, lineHeight: 1.6 }}>{globalAnnouncement.content}</p>

            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>

              Posted: {new Date(globalAnnouncement.createdAt).toLocaleString()}

            </div>

            <button

              onClick={async () => {

                await fetch(`${API_BASE}/classroom/announcements/${globalAnnouncement.id}/read`, {

                  method: "POST",

                  headers: { Authorization: `Bearer ${token}` },

                });

                setGlobalAnnouncement(null);

              }}

              style={{ 

                width: "100%", 

                background: "linear-gradient(135deg, #f59e0b, #d97706)",

                border: "none",

                padding: "12px 24px",

                borderRadius: 8,

                color: "white",

                fontWeight: 600,

                cursor: "pointer"

              }}

            >

              ? Got it, dismiss

            </button>

          </div>

        </div>

      )}



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

            <span style={{ fontSize: 24 }}>⭐</span>

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

            <div style={{ fontSize: 32, marginBottom: 16 }}>💯</div>

            <h3 style={{ margin: "0 0 12px 0" }}>Welcome to Demo Mode!</h3>

            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20, opacity: 0.8 }}>

              Explore Scholar's Circle with limited access. Try different features to unlock demo achievements and see what the full version offers.

            </p>

            <div style={{ background: "rgba(255,215,0,0.1)", padding: 12, borderRadius: 8, marginBottom: 16 }}>

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

              style={{ width: "100%", background: "#FFD700", color: "white", border: "none", padding: "12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}

            >

              Start Exploring

            </button>

          </div>

        </div>

      )}



      {(tab === "dashboard" || tab === "today") && (

        <>

          {/* Header Toggle Button */}

          <button

            className="header-toggle-btn"

            onClick={() => setHeaderExpanded(!headerExpanded)}

            style={{

              display: 'flex',

              alignItems: 'center',

              justifyContent: 'center',

              gap: '8px',

              padding: '8px 16px',

              margin: '8px auto',

              borderRadius: '12px',

              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(218, 165, 32, 0.15))',

              border: '1px solid rgba(255, 215, 0, 0.3)',

              color: '#FFD700',

              fontSize: '12px',

              fontWeight: 500,

              cursor: 'pointer',

              transition: 'all 0.3s'

            }}

          >

            <span>{headerExpanded ? "▼" : "▶"}</span>

            <span>{headerExpanded ? "Hide Header" : "Show Header"}</span>

          </button>



          <div className="hero-banner" style={{ display: headerExpanded ? 'block' : 'none' }}>



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



          <header className="topbar topbar-cosmic" style={{ display: headerExpanded ? 'block' : 'none' }}>



            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>



          {/* Logo */}

          <div className="app-logo">

            <div className="logo-icon">🎮</div>

            <div className="logo-text">

              <div className="logo-title">Scholar's Circle</div>

              <div className="logo-subtitle">Learn • Practice • Master</div>

            </div>

          </div>



          {/* Header Controls */}

          <div className="header-controls">



            {/* Palette Button */}

            <button className="header-btn palette-btn" onClick={() => setShowPalette(true)} title="Ctrl/Cmd+K">

              <span className="btn-icon"><Search size={16} /></span>

              <span className="btn-label">Search</span>

              <span className="shortcut">?K</span>

            </button>



            {/* Theme Selector */}

            <div className="theme-selector" onClick={() => {

              const selector = document.querySelector('.theme-selector');

              selector?.classList.toggle('open');

            }}>

              <div className="theme-selector-btn">

                <div className={`theme-dot ${themePack}`}></div>

                <span className="btn-label">{themePack.charAt(0).toUpperCase() + themePack.slice(1)}</span>

                <span style={{ fontSize: 10 }}>✨</span>

              </div>

              <div className="theme-dropdown" onClick={(e) => e.stopPropagation()}>

                <div className={`theme-option ${themePack === 'aurora' ? 'active' : ''}`} onClick={() => setThemePack('aurora')}>

                  <div className="theme-preview aurora"></div>

                  <span className="theme-name">🌌 Aurora</span>

                </div>

                <div className={`theme-option ${themePack === 'paper' ? 'active' : ''}`} onClick={() => setThemePack('paper')}>

                  <div className="theme-preview paper"></div>

                  <span className="theme-name">📄 Paper</span>

                </div>

                <div className={`theme-option ${themePack === 'neon' ? 'active' : ''}`} onClick={() => setThemePack('neon')}>

                  <div className="theme-preview neon"></div>

                  <span className="theme-name">🎉 Neon</span>

                </div>

                <div className={`theme-option ${themePack === 'gold' ? 'active' : ''}`} onClick={() => setThemePack('gold')}>

                  <div className="theme-preview gold"></div>

                  <span className="theme-name">👑 Gold</span>

                </div>

              </div>

            </div>



            {/* Dark Mode Toggle */}

            <button className="header-btn theme-btn" onClick={() => setDarkMode((v) => !v)} title="Toggle theme">

              {darkMode ? <><Moon size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Dark</> : <><Sun size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Light</>}

            </button>



            {/* Notification Bell */}

            <NotificationBell token={token} currentUser={auth.user} onOpenTab={setTab} />



            {/* Profile Button */}

            <button className="header-btn profile-btn" onClick={() => setTab("profile")} title="My Profile">

              <span className="btn-icon"><User size={16} /></span>

              <span className="btn-label">Profile</span>

            </button>



            {/* Install Button */}

            {deferredPrompt && !isIOS && (

              <button className="header-btn" onClick={handleInstallClick}>

                <span className="btn-icon"><Download size={16} /></span>

                <span className="btn-label">Install</span>

              </button>

            )}



          </div>



        </div>



        {/* User Profile Card */}

        <div className="user-profile-card">

          <div className="user-avatar">

            {auth.user.username?.charAt(0)?.toUpperCase() || 'U'}

          </div>

          <div className="user-info">

            <div className="user-name">

              {auth.user.username}

              {demoMode && <span className="demo-badge">Demo</span>}

            </div>

            <div className="user-role">{auth.user.role}</div>

            <div className="user-stats">

              <div className="user-stat xp-stat">

                <span className="stat-icon">🔥</span>

                <span className="stat-value">{stats.xp}</span>

                <span className="stat-label">XP</span>

              </div>

              <div className="user-stat streak-stat">

                <span className="stat-icon">🎯</span>

                <span className="stat-value">{stats.streak || 0}</span>

                <span className="stat-label">Streak</span>

              </div>

              <div className="user-stat session-stat">

                <span className="stat-icon">🎯</span>

                <span className="stat-value">{stats.sessions}</span>

                <span className="stat-label">Sessions</span>

              </div>

            </div>

          </div>

          

          {/* User Badges */}

          <div className="user-badges">

            {BADGES.filter(b => b.check(stats, history, subjects, mastery)).slice(0, 5).map((badge, i) => (

              <div key={i} className="badge-icon" title={badge.name}>{badge.icon}</div>

            ))}

            {BADGES.filter(b => b.check(stats, history, subjects, mastery)).length > 5 && (

              <div className="badge-icon badge-more">+{BADGES.filter(b => b.check(stats, history, subjects, mastery)).length - 5}</div>

            )}

          </div>

        </div>



        {/* Demo Usage Info */}

        {demoMode && (

          <div style={{ marginTop: 12, fontSize: 11, color: "#64748b", display: "flex", gap: 16, flexWrap: "wrap" }}>

            <span>AI: {demoUsage.aiMessages}/{DEMO_LIMITS.aiMessages}</span>

            <span>Quiz: {demoUsage.practiceQuestions}/{DEMO_LIMITS.practiceQuestions}</span>

            <span>Time: {demoUsage.sessionTimeMinutes}/{DEMO_LIMITS.dailyTimeLimit}min</span>

            {demoUsage.trialStartDate && (

              <span>Days left: {Math.max(0, DEMO_LIMITS.trialDays - Math.ceil((Date.now() - demoUsage.trialStartDate) / (1000 * 60 * 60 * 24)))}</span>

            )}

          </div>

        )}



      </header>

        </>

      )}









      {/* Mobile Bottom Navigation */}

      <nav className="mobile-nav">

        <button

          className={["today", "dashboard"].includes(tab) ? "active" : ""}

          onClick={() => setTab("today")}

          title="Home"

        >

          <HomeIcon size={20} className="nav-icon" />

          <span className="nav-label">Home</span>

        </button>

        <button

          className={["practice", "learn", "bank", "pastpapers", "studypaths", "practicehints"].includes(tab) ? "active" : ""}

          onClick={() => setTab("practice")}

          title="Learn"

        >

          <BookOpen size={20} className="nav-icon" />

          <span className="nav-label">Learn</span>

        </button>

        <button

          className={["research-hub", "resources"].includes(tab) ? "active" : ""}

          onClick={() => setTab("research-hub")}

          title="Research Hub"

        >

          <Search size={20} className="nav-icon" />

          <span className="nav-label">Research</span>

        </button>

        <button

          className={["analytics", "leaderboard", "achievements", "gamification"].includes(tab) ? "active" : ""}

          onClick={() => setTab("analytics")}

          title="Progress"

        >

          <BarChart3 size={20} className="nav-icon" />

          <span className="nav-label">Progress</span>

        </button>

        <button

          className={`more-btn ${["settings", "flashcards", "notes", "timetable", "reminders", "pomodoro", "studygroups", "discuss", "cheatsheet", "outline", "classroom", "profile", "lecturers", "notifications", "premium", "teacher-questions", "campus-comm", "planner", ...(isTeacher ? ["keys", "invites", "admin"] : [])].includes(tab) ? "has-active" : ""}`}

          onClick={() => setShowMobileMenu(!showMobileMenu)}

          title="More"

        >

          <span className="nav-icon">{showMobileMenu ? <X size={20} /> : <Menu size={20} />}</span>

          <span className="nav-label">More</span>

        </button>

      </nav>



      {/* Mobile Menu Overlay */}

      {showMobileMenu && (

        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>

          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>

            

            {/* Section: Study Resources */}

            <div className="mobile-menu-section-label"><BookOpen size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Study Resources</div>

            <div className="mobile-menu-grid">

              <button className={tab === "resources" ? "active" : ""} onClick={() => { setTab("resources"); setShowMobileMenu(false); }}>

                <BookOpen size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Resources

              </button>

            </div>



            {/* Section: Classroom & Community */}

            <div className="mobile-menu-section-label"><School size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Classroom & Community</div>

            <div className="mobile-menu-grid">

              <button className={tab === "classroom" ? "active" : ""} onClick={() => { setTab("classroom"); setShowMobileMenu(false); }}>

                <School size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Classroom

              </button>

              <button className={tab === "lecturers" ? "active" : ""} onClick={() => { setTab("lecturers"); setShowMobileMenu(false); }}>

                <GraduationCap size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Lecturers

              </button>

              <button className={tab === "studygroups" ? "active" : ""} onClick={() => { setTab("studygroups"); setShowMobileMenu(false); }}>

                <Users size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Study Groups

              </button>

              <button className={tab === "discuss" ? "active" : ""} onClick={() => { setTab("discuss"); setShowMobileMenu(false); }}>

                <MessageCircle size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Discussion

              </button>

            </div>



            {/* Section: Tools */}

            <div className="mobile-menu-section-label"><Cog size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Tools</div>

            <div className="mobile-menu-grid">

              <button className={tab === "timetable" ? "active" : ""} onClick={() => { setTab("timetable"); setShowMobileMenu(false); }}>

                <CalendarDays size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Timetable

              </button>

              <button className={tab === "reminders" ? "active" : ""} onClick={() => { setTab("reminders"); setShowMobileMenu(false); }}>

                <Bell size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Reminders

              </button>

              <button className={tab === "pomodoro" ? "active" : ""} onClick={() => { setTab("pomodoro"); setShowMobileMenu(false); }}>

                <Timer size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Focus Timer

              </button>

              <button className={tab === "planner" ? "active" : ""} onClick={() => { setTab("planner"); setShowMobileMenu(false); }}>

                <CalendarDays size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Planner

              </button>

            </div>



            {/* Section: Account */}

            <div className="mobile-menu-section-label"><UserCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Account</div>

            <div className="mobile-menu-grid">

              <button className={tab === "profile" ? "active" : ""} onClick={() => { setTab("profile"); setShowMobileMenu(false); }}>

                <User size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Profile

              </button>

              <button className={tab === "notifications" ? "active" : ""} onClick={() => { setTab("notifications"); setShowMobileMenu(false); }}>

                <Bell size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Notifications

              </button>

              <button className={tab === "settings" ? "active" : ""} onClick={() => { setTab("settings"); setShowMobileMenu(false); }}>

                <Settings size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Settings

              </button>

              {!isFaculty && (

                <button className={tab === "premium" ? "active" : ""} onClick={() => { setTab("premium"); setShowMobileMenu(false); }} style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.2))", border: "1px solid rgba(218,165,32,0.4)" }}>

                  <Gem size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Premium

                </button>

              )}

            </div>



            {/* Faculty Section */}

            {isFaculty && (

              <>

                <div className="mobile-menu-section-label"><GraduationCap size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Faculty Tools</div>

                <div className="mobile-menu-grid">

                  <button className={tab === "teacher-questions" ? "active" : ""} onClick={() => { setTab("teacher-questions"); setShowMobileMenu(false); }}>

                    <FileText size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> My Questions

                  </button>

                  <button className={tab === "teacher-resources" ? "active" : ""} onClick={() => { setTab("teacher-resources"); setShowMobileMenu(false); }}>

                    <Laptop size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Teacher Resources

                  </button>

                  <button className={tab === "campus-comm" ? "active" : ""} onClick={() => { setTab("campus-comm"); setShowMobileMenu(false); }}>

                    <Megaphone size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Announcements

                  </button>

                  {isTeacher && (

                    <>

                      <button className={tab === "keys" ? "active" : ""} onClick={() => { setTab("keys"); setShowMobileMenu(false); }}>

                        <KeyRound size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Student Keys

                      </button>

                      <button className={tab === "invites" ? "active" : ""} onClick={() => { setTab("invites"); setShowMobileMenu(false); }}>

                        <Mail size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Invites

                      </button>

                      <button className={tab === "admin" ? "active" : ""} onClick={() => { setTab("admin"); setShowMobileMenu(false); }}>

                        <Cog size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Admin Panel

                      </button>

                    </>

                  )}

                </div>

              </>

            )}



          </div>

        </div>

      )}



      {/* Desktop Tabs Navigation */}

      <nav className="tabs desktop-tabs">



        {[

          ["today", "Home", HomeIcon],

          ["practice", "Learn", BookOpen],

          ["aitutor", "AI Tutor", Bot],

          ["analytics", "Progress", BarChart3],

          ["classroom", "Classroom", School],

          ["resources", "Resources", BookOpen],

          ["studygroups", "Groups", Users],

          ["discuss", "Discussion", MessageCircle],

          ["timetable", "Timetable", CalendarDays],

          ["settings", "Settings", Settings],

          ["research-hub", "Research Hub", Search],

          ...(!isFaculty ? [["premium", "Premium", Gem]] : []),

          ...(isFaculty ? [["teacher-questions", "My Questions", FileText], ["teacher-resources", "Teacher Resources", Laptop], ["campus-comm", "Announcements", Megaphone], ["departments", "Departments", Building2]] : []),

          ...(isTeacher ? [["keys", "Keys", KeyRound], ["invites", "Invites", Mail], ["admin", "Admin", Cog]] : []),

        ].filter(([id]) => {

          if (!demoMode) return true;

          return !["classroom"].includes(id);

        }).map(([id, label, Icon]) => {
          return (
            <button
              key={id}
              className={["today", "dashboard"].includes(tab) && id === "today" ? "active" : tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}



      </nav>



      {/* Back Navigation Header for secondary tabs */}

      {!PRIMARY_TABS.includes(tab) && (

        <div className="tab-back-header">

          <button className="tab-back-btn" onClick={goBack}>

            ← Back

          </button>

          <span className="tab-back-title">{TAB_LABELS[tab] || tab}</span>

        </div>

      )}



      {tab === "today" && (



        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <Home
          loading={loadingOverlay}

          authUser={auth.user}

          subjects={subjects}

          mastery={mastery}

          dueCards={dueCards}

          history={history}

          stats={stats}

          aiConfig={aiConfig}

          onStartSpaced={startSpacedReview}

          onStartSubject={(id) => startSubjectPractice(id)}

          onOpenTab={setTab}

          onOpenLeaderboard={() => { setProgressSubTab("leaderboard"); setTab("analytics"); }}

          onOpenAI={(topic) => { setAiDefaultView("chat"); setAiStudyTopic(topic || ""); setAiKey(k => k + 1); setTab("aitutor"); }}

          onOpenLearn={() => { setAiDefaultView("learn"); setAiStudyTopic(""); setAiKey(k => k + 1); setTab("aitutor"); }}

          onOpenStudy={(topic, mode, attachment) => { setAiDefaultView("study"); setAiStudyTopic(topic || ""); setAiStudyMode(mode || "input"); setAiStudyAttachment(attachment || null); setAiKey(k => k + 1); setTab("aitutor"); }}

          onOpenResource={(shareToken, page) => { setHomeViewerPage(page || null); setHomeViewerToken(shareToken); }}

          token={token}

          onImportToBank={(questions, topic) => {

            const key = `sc_custom_questions::${auth.user?.id || auth.user?.username || "guest"}`;

            const existing = JSON.parse(localStorage.getItem(key) || "[]");

            const newQuestions = questions.map((q, i) => ({

              id: `custom_${Date.now()}_${i}`,

              q: q.q,

              options: q.options,

              answer: q.answer,

              explanation: q.explanation,

              topic: topic,

              subject: "custom",

              year: new Date().getFullYear(),

              difficulty: "medium",

            }));

            localStorage.setItem(key, JSON.stringify([...existing, ...newQuestions]));

            toast.success(`✅ Imported ${newQuestions.length} questions to your Question Bank!`);

          }}

        />
                </Suspense>
        </ErrorBoundary>



      )}

      {homeViewerToken && (
        <ErrorBoundary>
          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
            <ResourceViewer
              token={homeViewerToken}
              initialPage={homeViewerPage}
              onBack={() => { setHomeViewerToken(null); setHomeViewerPage(null); setTab("research-hub"); }}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {tab === "lectures" && (

        demoMode && (() => {

          const today = new Date().toDateString();

          const usedToday = demoUsage.lectureToNotesDate === today ? demoUsage.lectureToNotesUsed : 0;

          return usedToday >= DEMO_LIMITS.lectureToNotesDaily;

        })() ? (

          <DemoLockedOverlay

            title="Lecture to Notes"

            description={`You've used your daily Lecture to Notes limit (${DEMO_LIMITS.lectureToNotesDaily}/day). Upgrade for unlimited access!`}

            icon="⏱️"

            features={["Unlimited lecture conversions", "AI-powered summaries", "Auto-generated flashcards", "Key term extraction"]}

            showPlans={true}

          />

        ) : (

          <>

            {demoMode && (

              <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                  <span style={{ fontSize: 16 }}>⏱️</span>

                  <span style={{ fontSize: 13 }}>Demo: {DEMO_LIMITS.lectureToNotesDaily - (demoUsage.lectureToNotesDate === new Date().toDateString() ? demoUsage.lectureToNotesUsed : 0)} Lecture to Notes use(s) remaining today.</span>

                </div>

              </div>

            )}

            <LectureToNotes

              subjects={subjects}

              aiConfig={aiConfig}

              onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}

              demoMode={demoMode}

              demoUsage={demoUsage}

              setDemoUsage={setDemoUsage}

            />

          </>

        )

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

        demoMode && !DEMO_LIMITS.studyGroupsAccess ? (

          <DemoLockedOverlay

            title="Study Groups"

            description="Study Groups is a premium feature. Upgrade to collaborate with other students and join study sessions!"

            icon="⏱️"

            features={["Join study groups", "Collaborate with peers", "Share notes & resources", "Group study sessions"]}

            showPlans={true}

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

            <h2>💡 Practice with Hints</h2>

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













      {tab === "pastpapers" && (

        <>

          {demoMode && (

            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                <span style={{ fontSize: 16 }}>⏱️</span>

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

                toast.warning(`Demo limit: Only ${DEMO_LIMITS.pastPapersLimit} past paper allowed. Upgrade for more!`);

                return;

              }

              // Limit to 10 questions for demo users

              const finalQs = demoMode && qs.length > 10 ? qs.slice(0, 10) : qs;

              if (demoMode && qs.length > 10) {

                toast.info("Free Trial: Limited to 10 questions. Upgrade for unlimited!");

              }

              setActiveSession({ mode: "exam", source: { id: "pastpaper", label: `Past Paper ${yr}`, icon: "📖" }, questions: finalQs, totalSeconds: (demoMode ? 15 : mins) * 60 });

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

            <>

              <div className="demo-banner warning">

                <span className="banner-icon">💡</span>

                <span className="banner-text">Free Trial: Limited to 4 subjects. Upgrade for full access.</span>

                <button className="banner-action" onClick={() => setShowPaymentModal(true)}>Upgrade</button>

              </div>

              <div className="demo-banner info">

                <span className="banner-icon">💡</span>

                <span className="banner-text">Demo: {Math.max(0, DEMO_LIMITS.quizDaily - (demoUsage.quizDate === new Date().toDateString() ? demoUsage.quizUsed : 0))} quiz(es) remaining today.</span>

              </div>

            </>

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



                    <strong>{s.label} {locked ? "🔒" : isCapped ? "⏳" : ""}</strong>



                    <span className="muted">{m}%{isCapped && " (Demo Cap)"}</span>



                  </div>



                </button>



              );



            })}



          </div>



          {demoMode && subjects.some(s => (mastery[s.id] || 0) >= DEMO_LIMITS.masteryCap) && (

            <div className="demo-banner warning" style={{ marginTop: 16 }}>

              <span className="banner-icon">⚠️</span>

              <span className="banner-text">Mastery capped at {DEMO_LIMITS.masteryCap}% in demo. Upgrade to unlock full mastery tracking!</span>

              <button className="banner-action" onClick={() => setShowPaymentModal(true)}>Upgrade</button>

            </div>

          )}



          <div className="row" style={{ marginTop: 16 }}>



            <button className="btn-neon-blue" onClick={startDiagnostic}>Start Diagnostic</button>



            <button className="btn-neon-green" onClick={startAdaptive}>Adaptive Practice</button>



            {demoMode ? (

              <button

                disabled

                title="Upgrade to unlock Weak Drill"

                style={{ opacity: 0.5, cursor: "not-allowed" }}

              >

                Weak Drill 💡

              </button>

            ) : (

              <button className="btn-neon-yellow" onClick={startWeakDrill}>Weak Drill</button>

            )}



            <button className="btn-neon-orange" onClick={startErrorDrill}>Error Drill</button>



            <button className="btn-neon-purple"



              onClick={() => {



                const id = Date.now().toString(36);



                const challenge = {



                  mode: "challenge",



                  source: { id: "challenge", label: "Peer Challenge", icon: "📖" },



                  questions: allQuestions.slice(0, 6),



                };



                localStorage.setItem(`challenge-${id}`, JSON.stringify(challenge));



                const url = `${window.location.origin}${window.location.pathname}?challenge=${id}`;



                navigator.clipboard?.writeText(url);



                toast.success("Peer challenge link copied!");



              }}



            >



              Peer Challenge



            </button>



          </div>



          <div className="row" style={{ marginTop: 12 }}>



            <button className="btn-neon-green" onClick={startSpacedReview} disabled={dueCards.length === 0}>



              {demoMode && dueCards.length > DEMO_LIMITS.maxSpacedReviewCards

                ? `⏱ Spaced Review (${DEMO_LIMITS.maxSpacedReviewCards}/${dueCards.length}) ⏱`

                : `Spaced Review (${dueCards.length})`}



            </button>



            <button className="btn-neon-blue" onClick={() => setTab("learn")}>Read Lessons</button>



          </div>



          <h3 style={{ marginTop: 20 }}>Daily Quests</h3>



          <div className="quests-grid">



            {EMPTY_QUESTS.map((q) => (



              <div key={q.id} className={`quest-card ${stats.questsDone[q.id] ? 'completed' : ''}`}>



                <div className="quest-check">{stats.questsDone[q.id] ? "✅" : "⭕"}</div>



                <span className="quest-label">{q.label}</span>



                <span className="quest-reward">+{q.xp || 10} XP</span>



              </div>



            ))}



          </div>



        </div>



        </>



      )}






      {tab === "practice" && (
        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <Learn
          loading={loadingOverlay}
          subjects={subjects}
          mastery={mastery}
          srData={srData}
          wrongCounts={wrongCounts}
          history={history}
          customFlashcards={customFlashcards}
          setCustomFlashcards={setCustomFlashcards}
          outlineProgress={outlineProgress}
          setOutlineProgress={setOutlineProgress}
          demoMode={demoMode}
          DEMO_LIMITS={DEMO_LIMITS}
          token={token}
          completeSession={completeSession}
          startSubjectPractice={startSubjectPractice}
          startAdaptive={startAdaptive}
          startSpacedReview={startSpacedReview}
          startWeakDrill={startWeakDrill}
          startErrorDrill={startErrorDrill}
          setActiveSession={setActiveSession}
          toast={toast}
          dueCards={dueCards}
          aiConfig={aiConfig}
          setMastery={setMastery}
          setWrongCounts={setWrongCounts}
          activeDept={activeDept}
          activeYearLevel={activeYearLevel}
          onOpenDeptSwitcher={() => setShowDeptSwitcher(true)}
        />
                </Suspense>
        </ErrorBoundary>
      )}

      {showDeptSwitcher && (
        <DepartmentSwitcher
          activeDept={activeDept}
          activeYearLevel={activeYearLevel}
          activeSemester={activeSemester}
          subjects={subjects}
          isOnboarding={!activeDept}
          onClose={() => setShowDeptSwitcher(false)}
          onSkip={() => {
            try { localStorage.setItem("sc_active_dept", "skipped"); } catch {}
            setShowDeptSwitcher(false);
          }}
          onConfirm={(dept, year, semester) => {
            setActiveDept(dept);
            setActiveYearLevel(year);
            setActiveSemester(semester);
            try {
              localStorage.setItem("sc_active_dept", JSON.stringify(dept));
              localStorage.setItem("sc_active_level", String(year));
              localStorage.setItem("sc_active_semester", semester || "");
            } catch {}
            setShowDeptSwitcher(false);
          }}
        />
      )}



      {tab === "keys" && isTeacher && (

        <KeyManagement token={token} />

      )}



      {tab === "invites" && isTeacher && (

        <TeacherInvitesPanel token={token} />

      )}



      {tab === "classroom" && (
        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <ClassroomPage
          loading={loadingOverlay}
          subjects={subjects}
          assignments={assignments}
          setAssignments={setAssignments}
          refreshAssignments={refreshAssignments}
          isFaculty={isFaculty}
          authUser={auth.user}
          token={token}
          demoMode={demoMode}
          backendSubjects={backendSubjects}
          onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}
        />
                </Suspense>
        </ErrorBoundary>
      )}






      {tab === "planner" && <RevisionPlanner mastery={mastery} dueCards={dueCards} subjects={subjects} />}

      {tab === "resources" && (
        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <Resources
          loading={loadingOverlay}
          subjects={subjects}
          notes={notes}
          setNotes={setNotes}
          srData={srData}
          customFlashcards={customFlashcards}
          setCustomFlashcards={setCustomFlashcards}
          token={token}
          mastery={mastery}
          demoMode={demoMode}
          resourcesSubTab={resourcesSubTab}
          setResourcesSubTab={setResourcesSubTab}
          outlineSubjectId={outlineSubjectId}
          setOutlineSubjectId={setOutlineSubjectId}
          outlineProgress={outlineProgress}
          setOutlineProgress={setOutlineProgress}
          startSubjectPractice={startSubjectPractice}
          toast={toast}
        />
                </Suspense>
        </ErrorBoundary>
      )}






      {tab === "analytics" && (
        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <Progress
          loading={loadingOverlay}
          authUser={auth.user}
          stats={stats}
          history={history}
          subjects={subjects}
          mastery={mastery}
          token={token}
          progressSubTab={progressSubTab}
          setProgressSubTab={setProgressSubTab}
          aiConfig={aiConfig}
          onRePractice={(missed) => {
            setCustomQuestions(prev => [...missed, ...prev]);
            setTab("practice");
          }}
        />
                </Suspense>
        </ErrorBoundary>
      )}



      {tab === "admin" && isTeacher && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <AdminDashboard
          adminUsers={adminUsers}
          adminLogins={adminLogins}
          adminLoading={adminLoading}
          onRefresh={refreshAdmin}
          token={token}
        />
        </Suspense>
      )}



      {tab === "teacher-questions" && isFaculty && (

        <TeacherQuestionManager

          token={token}

          subjects={subjects}

          onSubjectsRefresh={() => token && loadUserDataFromBackend(token)}

        />

      )}

      {tab === "departments" && isTeacher && (
        <DepartmentManager />
      )}

      {tab === "campus-comm" && isFaculty && (

        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <CampusComm

          token={token}

          currentUser={auth.user}

        />

        </Suspense>
      )}



      {tab === "premium" && !isFaculty && (
        <PremiumPage
          user={auth.user}
          token={token}
          isActivated={isActivated}
          onActivated={() => refreshAuth()}
        />
      )}

      {tab === "research-hub" && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <ResearchHub onBack={() => setTab("today")} streak={stats.streak} onStreakUpdate={handleStreakUpdate} activeSemester={activeSemester} />
        </Suspense>
      )}

      {tab === "teacher-resources" && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <TeacherResourcesHub onBack={() => setTab("today")} />
        </Suspense>
      )}

      {tab === "settings" && (
        <>
        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            ⚙️ Settings
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#7b82b8" }}>Manage your account, preferences & support</p>
        </div>

        {/* 💳 Account — Activation key + Subscription */}
        {auth.user?.activationKey && (
          <div style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>
              <span>💳</span> Account
            </div>
            <p style={{ fontSize: 12, color: "#7b82b8", margin: "0 0 4px 0" }}>Your Activation Key</p>
            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#fbbf24", letterSpacing: 2, marginBottom: 12 }}>
              {auth.user.activationKey}
            </div>
            {!isActivated && <p style={{ fontSize: 11, color: "#7b82b8", margin: 0 }}>Share this key with your teacher to get activated</p>}
            {isActivated && <p style={{ fontSize: 11, color: "#34d399", margin: 0 }}>? Your account is activated</p>}
          </div>
        )}

        {/* Subscription Plan Card */}
        {!isTeacher && auth.user && (() => {
          const planType = auth.user.planType;
          const expiry = auth.user.activationExpiry ? new Date(auth.user.activationExpiry) : null;
          const daysLeft = expiry ? Math.ceil((expiry - Date.now()) / 86400000) : null;
          const planLabel = planType === "week1" ? "1-Week Plan" : planType === "week2" ? "2-Week Plan" : planType === "month1" ? "1-Month Plan" : null;
          const statusColor = !isActivated ? "#94a3b8" : daysLeft !== null && daysLeft <= 3 ? "#ef4444" : daysLeft !== null && daysLeft <= 7 ? "#f59e0b" : "#10b981";
          const statusText = !isActivated ? "Not Activated" : daysLeft !== null && daysLeft <= 0 ? "Expired" : daysLeft !== null && daysLeft <= 1 ? "Expires Today!" : daysLeft !== null ? `${daysLeft} days left` : "Active";
          const statusBg = !isActivated ? "rgba(148,163,184,0.1)" : daysLeft !== null && daysLeft <= 3 ? "rgba(239,68,68,0.1)" : daysLeft !== null && daysLeft <= 7 ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)";
          const statusBorder = !isActivated ? "rgba(148,163,184,0.3)" : daysLeft !== null && daysLeft <= 3 ? "rgba(239,68,68,0.3)" : daysLeft !== null && daysLeft <= 7 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)";
          return (
            <div style={{ background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>💳 Subscription</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`, borderRadius: 20, padding: "3px 10px" }}>
                  ? {statusText}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
                {planLabel || (isActivated ? "Active Plan" : "No Active Plan")}
              </div>
              {expiry && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {daysLeft !== null && daysLeft > 0
                    ? `Expires ${expiry.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
                    : `Expired on ${expiry.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`}
                </div>
              )}
              {isActivated && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                <p style={{ fontSize: 11, color: statusColor, marginTop: 8, marginBottom: 0, fontWeight: 600 }}>
                  ⚠️ Contact your teacher to renew before it expires.
                </p>
              )}
            </div>
          );
        })()}

        {/* Demo Mode Progress */}
        {demoMode && (
          <div style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 700, color: "#facc15" }}>📊 Demo Progress</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {DEMO_ACHIEVEMENTS.map(ach => {
                const earned = demoUsage.demoProgress.achievements.includes(ach.id);
                return (
                  <div key={ach.id} style={{
                    background: earned ? "rgba(52,211,153,0.1)" : "rgba(148,163,184,0.08)",
                    border: earned ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 8, padding: 10, opacity: earned ? 1 : 0.6
                  }}>
                    <div style={{ fontSize: 18 }}>{ach.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginTop: 4 }}>{ach.label}</div>
                    <div style={{ fontSize: 10, marginTop: 2, color: "#94a3b8" }}>{ach.desc}</div>
                    {earned && <div style={{ color: "#34d399", fontSize: 10, marginTop: 4 }}>? Earned</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, padding: 10, background: "rgba(255,215,0,0.1)", borderRadius: 8, border: "1px solid rgba(255,215,0,0.3)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Completion: {Math.round((demoUsage.demoProgress.achievements.length / DEMO_ACHIEVEMENTS.length) * 100)}%</div>
              <div style={{ height: 6, background: "rgba(148,163,184,0.3)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(demoUsage.demoProgress.achievements.length / DEMO_ACHIEVEMENTS.length) * 100}%`, background: "#FFD700", transition: "width 0.3s" }} />
              </div>
              <button onClick={() => setShowPaymentModal(true)} style={{ marginTop: 10, width: "100%", background: "#FFD700", color: "white", border: "none", padding: "10px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Upgrade to Full Version
              </button>
            </div>
          </div>
        )}

        {/* 🎨 Appearance */}
        <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>
            <span>🎨</span> Appearance
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>Theme</span>
            <button onClick={() => setDarkMode((v) => !v)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: darkMode ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {darkMode ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
        </div>

        {/* 🔔 Notifications */}
        <NotificationSettings token={token} />

        {/* 🎟️ Support */}
        <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>
            <span>🎟️</span> Support
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="https://wa.link/yj2em4" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, background: "#25D366", color: "white", textDecoration: "none", padding: "12px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
              <span style={{ fontSize: 18 }}>📞</span> Chat on WhatsApp
            </a>
            <a href="tel:09028617178" style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFD700", color: "white", textDecoration: "none", padding: "12px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
              <span style={{ fontSize: 18 }}>📞</span> Call: 09028617178
            </a>
          </div>
          <p style={{ marginTop: 10, fontSize: 11, color: "#7b82b8", marginBottom: 0 }}>Available 9AM–6PM (Mon–Fri). For faster response, use WhatsApp.</p>
        </div>

        {/* ? Help / FAQ */}
        <div style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>
            <span>❓</span> Common Issues
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <details style={{ cursor: "pointer" }}>
              <summary style={{ fontWeight: 500, padding: "4px 0", fontSize: 13 }}>How do I reset my password?</summary>
              <p style={{ marginTop: 4, fontSize: 12, marginLeft: 12, color: "#94a3b8" }}>Contact support via WhatsApp with your username and email. We'll help you reset it.</p>
            </details>
            <details style={{ cursor: "pointer" }}>
              <summary style={{ fontWeight: 500, padding: "4px 0", fontSize: 13 }}>App not installing on iPhone?</summary>
              <p style={{ marginTop: 4, fontSize: 12, marginLeft: 12, color: "#94a3b8" }}>Tap Share → Add to Home Screen. Make sure you're on Safari and HTTPS.</p>
            </details>
            <details style={{ cursor: "pointer" }}>
              <summary style={{ fontWeight: 500, padding: "4px 0", fontSize: 13 }}>How to activate my account?</summary>
              <p style={{ marginTop: 4, fontSize: 12, marginLeft: 12, color: "#94a3b8" }}>Share your activation key (shown above) with your teacher. They'll activate you.</p>
            </details>
          </div>
        </div>

        {/* 💬 Feedback */}
        <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 15, fontWeight: 700 }}>
            <span>💬</span> Feedback
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>We love hearing from you! Share ideas for new features or report bugs.</p>
          <button onClick={() => { const msg = encodeURIComponent("Hi Scholar's Circle team, I have a suggestion/feedback:"); window.open(`https://wa.link/yj2em4?text=${msg}`, "_blank"); }} style={{ background: "#34d399", color: "white", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, width: "100%", fontSize: 14 }}>
            📧 Send Feedback
          </button>
        </div>

        {/* ⚠️ Danger Zone */}
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 15, fontWeight: 700, color: "#ef4444" }}>
            <span>⚠️</span> Danger Zone
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => { setToken(""); setAuth({ username: "", password: "", user: null, error: "" }); }} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Logout
            </button>
            <button className="danger" onClick={handleResetAll} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Reset Data
            </button>
          </div>
        </div>
        </>
      )}






      {tab === "aitutor" && (
        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <AITutorPage
          loading={loadingOverlay}
          aiKey={aiKey}
          aiDefaultView={aiDefaultView}
          aiStudyTopic={aiStudyTopic}
          aiStudyMode={aiStudyMode}
          aiStudyAttachment={aiStudyAttachment}
          aiConfig={aiConfig}
          subjects={subjects}
          onExit={() => setTab("today")}
        />
                </Suspense>
        </ErrorBoundary>
      )}

      {tab === "aitutor_legacy" && (

        <div>

          {/* AI Tutor Hub sub-tabs */}

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>

            <button

              onClick={() => setAiTutorSubTab("chat")}

              style={{

                padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,

                border: aiTutorSubTab === "chat" ? "2px solid #FFD700" : "1px solid rgba(255,215,0,0.25)",

                background: aiTutorSubTab === "chat" ? "linear-gradient(135deg,#FFD700,#DAA520)" : "rgba(20,20,20,0.6)",

                color: aiTutorSubTab === "chat" ? "#fff" : "#FFD700",

              }}

            >🧠 AI Chat</button>

            <button

              onClick={() => setAiTutorSubTab("lectures")}

              style={{

                padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,

                border: aiTutorSubTab === "lectures" ? "2px solid #FFD700" : "1px solid rgba(255,215,0,0.25)",

                background: aiTutorSubTab === "lectures" ? "linear-gradient(135deg,#FFD700,#DAA520)" : "rgba(20,20,20,0.6)",

                color: aiTutorSubTab === "lectures" ? "#fff" : "#FFD700",

              }}

            >🎙️ Lecture to Notes</button>

          </div>



          {aiTutorSubTab === "chat" && (

            <AITutor

              aiConfig={aiConfig}

              subjects={subjects}

              studentProfile={studentProfile}

              onImportFlashcards={(cards) => setCustomFlashcards((p) => [...p, ...cards])}

              onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}

              token={token}

              demoMode={demoMode}

              demoUsage={demoUsage}

              setDemoUsage={setDemoUsage}

              onNavigate={(target) => setTab(target)}

            />

          )}



          {aiTutorSubTab === "lectures" && (

            demoMode && (() => {

              const today = new Date().toDateString();

              const usedToday = demoUsage.lectureToNotesDate === today ? demoUsage.lectureToNotesUsed : 0;

              return usedToday >= DEMO_LIMITS.lectureToNotesDaily;

            })() ? (

              <DemoLockedOverlay

                title="Lecture to Notes"

                description={`You've used your daily limit (${DEMO_LIMITS.lectureToNotesDaily}/day). Upgrade for unlimited access!`}

                icon="⏱️"

                features={["Unlimited lecture conversions", "AI-powered summaries", "Auto-generated flashcards", "Key term extraction"]}

                showPlans={true}

              />

            ) : (

              <>

                {demoMode && (

                  <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>

                    <span style={{ fontSize: 13 }}>? Demo: {DEMO_LIMITS.lectureToNotesDaily - (demoUsage.lectureToNotesDate === new Date().toDateString() ? demoUsage.lectureToNotesUsed : 0)} conversion(s) remaining today.</span>

                  </div>

                )}

                <LectureToNotes

                  subjects={subjects}

                  aiConfig={aiConfig}

                  onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}

                  demoMode={demoMode}

                  demoUsage={demoUsage}

                  setDemoUsage={setDemoUsage}

                />

              </>

            )

          )}

        </div>

      )}



      {tab === "profile" && (
        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <Profile
          loading={loadingOverlay}
          studentProfile={studentProfile}
          authUser={auth.user}
          onSave={(p) => updateStudentProfile(p)}
        />
                </Suspense>
        </ErrorBoundary>
      )}



      {tab === "notifications" && (

        <NotificationsTab

          token={token}

          currentUser={auth.user}

        />

      )}



      {tab === "lecturers" && (

        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <Lecturers

          token={token}

          currentUser={auth.user}

          isTeacher={isFaculty}

        />

        </Suspense>
      )}



      {tab === "reminders" && (



        <StudyReminders reminders={reminders} setReminders={setReminders} timetable={timetable} notificationPermission={notificationPermission} setNotificationPermission={setNotificationPermission} token={token} />



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









      {tab === "timetable" && (



        <TimetableBuilder timetable={timetable} setTimetable={setTimetable} subjects={subjects} />



      )}






      {tab === "discuss" && (



        <DiscussionBoard subjects={subjects} discussion={discussion} setDiscussion={setDiscussion} username={auth.user.username} isTeacher={isFaculty} />



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







// CommandPalette imported from ./components/SmallComponents







// SessionPlayer imported from ./components/SessionPlayer

function _SessionPlayer_REMOVED({ session, onExit, onComplete, aiConfig }) {



  const [idx, setIdx] = useState(0);



  const [selected, setSelected] = useState(null);



  const [showResult, setShowResult] = useState(false);



  const [score, setScore] = useState(0);



  const [results, setResults] = useState([]);



  const [confidence, setConfidence] = useState("unsure");



  const [timeLeft, setTimeLeft] = useState(session.totalSeconds ?? null);



  const [startedAt] = useState(Date.now());



  const [finalResult, setFinalResult] = useState(null);



  const [aiExplanation, setAiExplanation] = useState(null);

  const [aiLoading, setAiLoading] = useState(false);

  

  // Streak tracking for bonus XP

  const [currentStreak, setCurrentStreak] = useState(0);

  const [streakBonus, setStreakBonus] = useState(0);

  const [totalStreakBonus, setTotalStreakBonus] = useState(0);

  

  // Flagged questions

  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());



  const current = session.questions[idx];

  

  // Calculate XP in real-time

  const modeMultiplier = MODE_MULTIPLIERS[session.mode] || 1;

  const currentXP = Math.round((score * XP_PER_CORRECT + totalStreakBonus) * modeMultiplier);

  

  // Toggle flag

  function toggleFlag() {

    setFlaggedQuestions(prev => {

      const newSet = new Set(prev);

      if (newSet.has(idx)) {

        newSet.delete(idx);

      } else {

        newSet.add(idx);

      }

      return newSet;

    });

  }



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

      setAiExplanation("Sorry, couldn't get AI explanation. Please try again later.");

      console.error(err);

    } finally {

      setAiLoading(false);

    }

  }



  const isExamLike = session.mode === "exam";



  const perQuestionTarget = session.totalSeconds ? Math.round(session.totalSeconds / session.questions.length) : null;







  // No auto-save - let user review results until they click Exit



  // Timer effect - only depends on timeLeft and showResult

  useEffect(() => {

    if (timeLeft == null || showResult || finalResult) return undefined;

    

    if (timeLeft <= 0) {

      // Time's up - end session

      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);

      setFinalResult({ 

        score, 

        total: session.questions.length, 

        results, 

        mode: session.mode, 

        seconds: elapsedSeconds 

      });

      return undefined;

    }

    

    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);

    return () => clearTimeout(t);

  }, [timeLeft, showResult, finalResult]); // Removed unnecessary dependencies







  if (!current) {



    return (



      <div className="card">



        <h2>No questions available for this mode.</h2>



        <button onClick={onExit}>Back</button>



      </div>



    );



  }







  if (finalResult) {

    const analytics = calculateSessionAnalytics(finalResult.results, session.questions, finalResult.seconds);



    return (

      <PostSessionInsights

        analytics={analytics}

        session={session}

        results={finalResult.results}

        questions={session.questions}

        history={[]}

        aiConfig={aiConfig}

        onExit={() => {

          onComplete({ ...finalResult, streakBonus: totalStreakBonus, flaggedQuestions: Array.from(flaggedQuestions) });

          onExit();

        }}

        onSave={() => {

          onComplete({ ...finalResult, streakBonus: totalStreakBonus, flaggedQuestions: Array.from(flaggedQuestions) });

        }}

      />

    );

  }







  function submit() {



    if (selected == null || showResult) return;



    setAiExplanation(null);



    const correct = selected === current.answer;



    if (correct) {

      setScore((s) => s + 1);

      

      // Update streak and calculate bonus

      const newStreak = currentStreak + 1;

      setCurrentStreak(newStreak);

      

      // Check for streak bonus milestones

      if (STREAK_BONUS[newStreak]) {

        const bonus = STREAK_BONUS[newStreak];

        setStreakBonus(bonus);

        setTotalStreakBonus(prev => prev + bonus);

      }

    } else {

      // Reset streak on wrong answer

      setCurrentStreak(0);

      setStreakBonus(0);

    }



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

    setStreakBonus(0); // Reset streak bonus display for next question



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



    <div className="card" style={{ 

      background: "linear-gradient(145deg, rgba(10, 10, 10, 0.95), rgba(20, 20, 20, 0.9))",

      border: "1px solid rgba(255, 215, 0, 0.2)",

      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)",

      borderRadius: 20,

      overflow: "hidden"

    }}>

      {/* Animated Header */}

      <div style={{ 

        background: "linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(218, 165, 32, 0.1))",

        padding: "20px 24px",

        borderBottom: "1px solid rgba(255, 215, 0, 0.2)"

      }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

            <div style={{

              width: 48,

              height: 48,

              borderRadius: 12,

              background: "linear-gradient(135deg, #FFD700, #DAA520)",

              display: "flex",

              alignItems: "center",

              justifyContent: "center",

              fontSize: 24,

              boxShadow: "0 4px 15px rgba(255, 215, 0, 0.4)"

            }}>

              {session.source.icon}

            </div>

            <div>

              <h3 style={{ margin: 0, fontSize: 18, background: "linear-gradient(135deg, #fff, #FFD700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{session.source.label}</h3>

              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{session.mode === "exam" ? "Exam Mode" : session.mode === "weak" ? "Weak Drill" : session.mode === "adaptive" ? "Adaptive" : "Practice"}</p>

            </div>

          </div>

          

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>

            {/* Timer for Exam Mode */}

            {timeLeft != null && (

              <div style={{

                background: timeLeft < 60 ? "linear-gradient(135deg, #ef4444, #dc2626)" : "rgba(20, 20, 20, 0.8)",

                border: "1px solid " + (timeLeft < 60 ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 215, 0, 0.3)"),

                padding: "8px 16px",

                borderRadius: 30,

                fontSize: 14,

                fontWeight: 700,

                color: "#fff",

                animation: timeLeft < 60 ? "pulse 1s infinite" : "none"

              }}>

                ? {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}

              </div>

            )}

            

            {/* Question Counter */}

            <div style={{

              background: "rgba(20, 20, 20, 0.8)",

              border: "1px solid rgba(255, 215, 0, 0.3)",

              padding: "8px 16px",

              borderRadius: 30,

              fontSize: 13,

              fontWeight: 600,

              color: "#FFD700"

            }}>

              Q{idx + 1}<span style={{ color: "#6b7280" }}>/{session.questions.length}</span>

            </div>

            

            {/* XP Counter */}

            <div style={{

              display: "flex",

              alignItems: "center",

              gap: 6,

              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",

              padding: "8px 16px",

              borderRadius: 30,

              fontWeight: 700,

              fontSize: 14,

              color: "#fff",

              boxShadow: "0 4px 15px rgba(251, 191, 36, 0.4)",

              animation: "pulse 2s infinite"

            }}>

              <span style={{ fontSize: 16 }}>🏁</span>

              <span>{currentXP}</span>

              <span style={{ fontSize: 11, opacity: 0.9 }}>XP</span>

            </div>

            

            {/* Streak Counter */}

            {currentStreak >= 2 && (

              <div style={{

                display: "flex",

                alignItems: "center",

                gap: 6,

                background: currentStreak >= 7 ? "linear-gradient(135deg, #f97316, #ea580c)" 

                           : currentStreak >= 5 ? "linear-gradient(135deg, #ef4444, #dc2626)"

                           : "linear-gradient(135deg, #22c55e, #16a34a)",

                padding: "8px 16px",

                borderRadius: 30,

                fontWeight: 700,

                fontSize: 14,

                color: "#fff",

                boxShadow: `0 4px 15px ${currentStreak >= 7 ? "rgba(249, 115, 22, 0.4)" : currentStreak >= 5 ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}`,

                animation: "pulse 1s infinite"

              }}>

                <span style={{ fontSize: 16 }}>⏱️</span>

                <span>{currentStreak}</span>

                {streakBonus > 0 && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: 10 }}>+{streakBonus}</span>}

              </div>

            )}

            

            {/* Exit Button */}

            <button

              type="button"

              onClick={onExit}

              style={{

                background: "rgba(239, 68, 68, 0.2)",

                border: "1px solid rgba(239, 68, 68, 0.3)",

                padding: "8px 16px",

                borderRadius: 10,

                color: "#f87171",

                fontWeight: 600,

                fontSize: 13,

                cursor: "pointer",

                zIndex: 10,

                position: "relative"

              }}

            >

              ? Exit

            </button>

          </div>

        </div>

      </div>



      {/* Progress Bar */}

      <div style={{ padding: "0 24px", marginTop: 20 }}>

        <div style={{ 

          height: 6, 

          background: "rgba(20, 20, 20, 0.8)", 

          borderRadius: 10, 

          overflow: "hidden",

          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)"

        }}>

          <div style={{

            height: "100%",

            width: `${((idx + 1) / session.questions.length) * 100}%`,

            background: "linear-gradient(90deg, #FFD700, #DAA520, #DAA520)",

            borderRadius: 10,

            transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",

            boxShadow: "0 0 20px rgba(255, 215, 0, 0.5)"

          }} />

        </div>

      </div>

      

      {/* Running Score for Exam */}

      {isExamLike && (

        <div style={{ padding: "12px 24px 0" }}>

          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>

            Running score: <span style={{ color: "#FFD700" }}>{score}/{Math.max(1, idx + (showResult ? 1 : 0))}</span>

            {perQuestionTarget && <span> → Pace: ~{perQuestionTarget}s/question</span>}

          </p>

        </div>

      )}



      {/* Question */}

      <div style={{ padding: "24px" }}>

        <div style={{

          background: "linear-gradient(135deg, rgba(20, 20, 20, 0.6), rgba(10, 10, 10, 0.8))",

          borderRadius: 16,

          padding: 20,

          marginBottom: 20,

          border: "1px solid rgba(255, 215, 0, 0.15)",

          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",

          position: "relative"

        }}>

          {/* Flag Button */}

          <button

            onClick={toggleFlag}

            style={{

              position: "absolute",

              top: 12,

              right: 12,

              background: flaggedQuestions.has(idx) ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 215, 0, 0.1)",

              border: flaggedQuestions.has(idx) ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255, 215, 0, 0.2)",

              padding: "8px 12px",

              borderRadius: 8,

              cursor: "pointer",

              fontSize: 14,

              color: flaggedQuestions.has(idx) ? "#f87171" : "#FFD700"

            }}

            title="Flag for review"

          >

            {flaggedQuestions.has(idx) ? "👁️" : "✅"}

          </button>

          

          <p style={{ 

            fontSize: 17, 

            lineHeight: 1.7, 

            color: "#f1f5f9",

            margin: 0,

            paddingRight: 50

          }}>

            {current.q}

          </p>

        </div>



        {/* Confidence & Read Aloud */}

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            <label style={{ color: "#9ca3af", fontSize: 13 }}>Confidence:</label>

            <select 

              value={confidence} 

              onChange={(e) => setConfidence(e.target.value)}

              style={{

                background: "rgba(20, 20, 20, 0.8)",

                border: "1px solid rgba(255, 215, 0, 0.3)",

                borderRadius: 8,

                padding: "8px 12px",

                color: "#FFD700",

                fontSize: 14

              }}

            >

              <option value="unsure">🤔 Unsure</option>

              <option value="okay">😐 Okay</option>

              <option value="sure">😎 Sure</option>

            </select>

          </div>

          <button

            onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(current.q))}

            style={{

              background: "rgba(255, 215, 0, 0.2)",

              border: "1px solid rgba(255, 215, 0, 0.3)",

              padding: "8px 16px",

              borderRadius: 8,

              color: "#FFD700",

              fontSize: 14,

              cursor: "pointer"

            }}

          >

            📖 Read

          </button>

        </div>



        {/* Options */}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {current.options.map((opt, i) => {

            const isSelected = selected === i;

            const isCorrectOption = showResult && i === current.answer;

            const isWrong = showResult && i === selected && i !== current.answer;

            

            let bgGradient = "linear-gradient(135deg, rgba(20, 20, 20, 0.8), rgba(10, 10, 10, 0.9))";

            let borderColor = "rgba(255, 215, 0, 0.2)";

            let glowColor = "transparent";

            

            if (showResult) {

              if (isCorrectOption) {

                bgGradient = "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))";

                borderColor = "rgba(34, 197, 94, 0.5)";

                glowColor = "rgba(34, 197, 94, 0.3)";

              } else if (isWrong) {

                bgGradient = "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))";

                borderColor = "rgba(239, 68, 68, 0.5)";

                glowColor = "rgba(239, 68, 68, 0.3)";

              }

            } else if (isSelected) {

              bgGradient = "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(218, 165, 32, 0.1))";

              borderColor = "rgba(255, 215, 0, 0.5)";

              glowColor = "rgba(255, 215, 0, 0.3)";

            }



            return (

              <button

                key={opt}

                onClick={() => !showResult && setSelected(i)}

                disabled={showResult}

                style={{

                  padding: "16px 20px",

                  background: bgGradient,

                  border: `2px solid ${borderColor}`,

                  borderRadius: 14,

                  color: "#f1f5f9",

                  textAlign: "left",

                  cursor: showResult ? "default" : "pointer",

                  fontSize: 15,

                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",

                  boxShadow: `0 4px 15px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,

                  transform: isSelected && !showResult ? "scale(1.02)" : "scale(1)"

                }}

              >

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

                    <span style={{ 

                      width: 32, 

                      height: 32, 

                      borderRadius: 10,

                      background: isCorrectOption ? "linear-gradient(135deg, #22c55e, #16a34a)" 

                                : isWrong ? "linear-gradient(135deg, #ef4444, #dc2626)"

                                : isSelected ? "linear-gradient(135deg, #FFD700, #DAA520)" 

                                : "rgba(255, 215, 0, 0.2)",

                      display: "flex",

                      alignItems: "center",

                      justifyContent: "center",

                      fontWeight: 700,

                      fontSize: 14,

                      color: isSelected || isCorrectOption ? "#fff" : "#FFD700"

                    }}>

                      {isCorrectOption ? "✅" : isWrong ? "❌" : String.fromCharCode(65 + i)}

                    </span>

                    <span>{opt}</span>

                  </div>

                  {isCorrectOption && (

                    <span style={{ 

                      background: "linear-gradient(135deg, #22c55e, #16a34a)", 

                      padding: "4px 12px", 

                      borderRadius: 20, 

                      fontSize: 12, 

                      fontWeight: 600,

                      color: "#fff"

                    }}>Correct</span>

                  )}

                </div>

              </button>

            );

          })}

        </div>

      </div>



      {/* Explanation (shown after answer) */}

      {showResult && !isExamLike && (

        <div style={{ padding: "0 24px 24px" }}>

          <div style={{ 

            background: "linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(218, 165, 32, 0.05))",

            borderRadius: 16, 

            padding: 20,

            border: "1px solid rgba(255, 215, 0, 0.2)"

          }}>

            <p style={{ color: "#FFD700", fontSize: 14, lineHeight: 1.6, margin: 0 }}>

              💡 {current.explanation || "No explanation available."}

            </p>

            

            {/* AI Explanation Button */}

            <div style={{ marginTop: 16 }}>

              <button 

                onClick={askAIForExplanation} 

                disabled={aiLoading}

                style={{ 

                  background: "linear-gradient(135deg, #FFD700, #0a0a0a)",

                  border: "none",

                  padding: "10px 20px",

                  borderRadius: 10,

                  color: "white",

                  fontSize: 14,

                  fontWeight: 600,

                  cursor: aiLoading ? "wait" : "pointer",

                  boxShadow: "0 4px 15px rgba(255, 215, 0, 0.4)"

                }}

              >

                {aiLoading ? "🤖 Thinking..." : "💡 Ask AI to explain"}

              </button>

              {aiExplanation && (

                <div style={{ 

                  marginTop: 12, 

                  padding: 16, 

                  background: "rgba(20, 20, 20, 0.6)", 

                  border: "1px solid rgba(255, 215, 0, 0.3)", 

                  borderRadius: 12,

                  fontSize: 14,

                  lineHeight: 1.6,

                  color: "#FFD700"

                }}>

                  <strong style={{ color: "#FFD700" }}>AI Explanation:</strong>

                  <p style={{ margin: "8px 0 0" }}>{aiExplanation}</p>

                </div>

              )}

            </div>

          </div>

        </div>

      )}



      {/* Action Buttons */}

      <div style={{ padding: "0 24px 24px", display: "flex", gap: 12, justifyContent: "flex-end" }}>

        {!showResult || isExamLike ? (

          <button

            onClick={submit}

            disabled={selected == null}

            style={{

              background: selected == null ? "rgba(255, 215, 0, 0.3)" : "linear-gradient(135deg, #FFD700, #DAA520)",

              color: "white",

              border: "none",

              padding: "14px 28px",

              borderRadius: 12,

              cursor: selected == null ? "not-allowed" : "pointer",

              fontSize: 15,

              fontWeight: 600,

              boxShadow: selected == null ? "none" : "0 4px 20px rgba(255, 215, 0, 0.4)",

              transition: "all 0.2s"

            }}

          >

            {isExamLike && idx === session.questions.length - 1 ? "Submit Exam ✅" : "Submit ➡️"}

          </button>

        ) : (

          <button

            onClick={next}

            style={{

              background: "linear-gradient(135deg, #FFD700, #DAA520)",

              color: "white",

              border: "none",

              padding: "14px 28px",

              borderRadius: 12,

              cursor: "pointer",

              fontSize: 15,

              fontWeight: 600,

              boxShadow: "0 4px 20px rgba(255, 215, 0, 0.4)",

              transition: "all 0.2s"

            }}

          >

            {idx === session.questions.length - 1 ? "Finish ✅" : "Next Question ➡️"}

          </button>

        )}

      </div>

    </div>



  );

}













// Classroom imported from ./components/Classroom

function _Classroom_REMOVED({ subjects, assignments, teacherMode, setTeacherMode, onCreate, onComplete, onImportQuestions, token, currentUser }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [joinClassCode, setJoinClassCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [popupLink, setPopupLink] = useState(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", isImportant: false });
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [newExam, setNewExam] = useState({ title: "", examDate: "", duration: 60 });
  const [classTab, setClassTab] = useState("announcements");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const tabListRef = useRef(null);
  const touchStartX = useRef(null);

  // Track viewport changes
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fetch classrooms
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/classroom/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setClassrooms(data || []);
        if (data && data.length > 0 && !selectedClassroom) setSelectedClassroom(data[0]);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setInitialLoadDone(true); });
  }, [token]);

  // Fetch classroom details when selected
  useEffect(() => {
    if (!token || !selectedClassroom?.id) return;
    fetch(`${API_BASE}/classroom/${selectedClassroom.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setSelectedClassroom(data))
      .catch(() => {});
  }, [token, selectedClassroom?.id]);

  // Check for new important announcements
  useEffect(() => {
    if (selectedClassroom?.announcements) {
      const unreadImportant = selectedClassroom.announcements.find((a) => a.isImportant && (!a.reads || a.reads.length === 0));
      if (unreadImportant) setShowAnnouncementPopup(unreadImportant);
    }
  }, [selectedClassroom?.announcements]);

  // Create classroom
  async function createClassroom() {
    if (!newClassName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/classroom`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newClassName, subjectId }) });
      const data = await res.json();
      setClassrooms((prev) => [...prev, data]);
      setNewClassName("");
      setShowCreateClass(false);
    } catch (err) { console.error("Failed to create classroom:", err); }
  }

  // Join classroom
  async function joinClassroom() {
    if (!joinClassCode.trim()) return;
    setJoinError("");
    try {
      const res = await fetch(`${API_BASE}/classroom/${joinClassCode}/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join classroom");
      const classroomsRes = await fetch(`${API_BASE}/classroom/my`, { headers: { Authorization: `Bearer ${token}` } });
      const classroomsData = await classroomsRes.json();
      setClassrooms(classroomsData || []);
      if (classroomsData && classroomsData.length > 0) setSelectedClassroom(classroomsData[classroomsData.length - 1]);
      setJoinClassCode("");
      setShowJoinClass(false);
    } catch (err) { setJoinError(err.message); }
  }

  // Add link
  async function addLink() {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/links`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: newLinkTitle, url: newLinkUrl }) });
      const link = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, links: [...(prev.links || []), link] }));
      setNewLinkTitle(""); setNewLinkUrl("");
    } catch (err) { console.error("Failed to add link:", err); }
  }

  // Create announcement
  async function createAnnouncement() {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/announcements`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newAnnouncement) });
      const announcement = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, announcements: [announcement, ...(prev.announcements || [])] }));
      setNewAnnouncement({ title: "", content: "", isImportant: false });
    } catch (err) { console.error("Failed to create announcement:", err); }
  }

  // Upload document
  async function uploadDocument(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const doc = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, documents: [...(prev.documents || []), doc] }));
    } catch (err) { console.error("Failed to upload document:", err); }
    finally { setUploadingDoc(false); }
  }

  // Create exam
  async function createExam() {
    if (!newExam.title.trim() || !newExam.examDate) return;
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/exams`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newExam) });
      const exam = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, exams: [...(prev.exams || []), exam] }));
      setShowExamModal(false);
      setNewExam({ title: "", examDate: "", duration: 60 });
    } catch (err) { console.error("Failed to create exam:", err); }
  }

  // Mark announcement as read
  async function markAnnouncementRead(announcementId) {
    try { await fetch(`${API_BASE}/classroom/announcements/${announcementId}/read`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); }
    catch (err) { console.error("Failed to mark as read:", err); }
  }

  function getDaysUntilExam(examDate) {
    return Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));
  }

  const isHost = teacherMode && selectedClassroom?.createdById === (currentUser?.id || currentUser?.sub);
  const CL = { card: "#0d0f1f", line: "#1e2140", border: "#3949ab", text: "#e8eaf6", muted: "#7b82b8", hint: "#4a5080", faint: "#12142a" };

  const TABS = [
    { id: "announcements", label: "📢 Announcements" },
    { id: "sessions", label: "📡 Live Sessions" },
    { id: "assignments", label: "📝 Assignments" },
    { id: "docs", label: "📄 Docs & Links" },
    { id: "attendance", label: "✅ Attendance" },
  ];

  // Sub-tab navigation
  function goToTab(direction) {
    const idx = TABS.findIndex((t) => t.id === classTab);
    const nextIdx = direction === "next" ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
    setClassTab(TABS[nextIdx].id);
    if (tabListRef.current) {
      const btn = tabListRef.current.children[nextIdx];
      if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  // Touch swipe for tab switching
  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 60) { goToTab(diff < 0 ? "next" : "prev"); }
    touchStartX.current = null;
  }

  const classroomCard = (c) => (
    <div key={c.id} onClick={() => setSelectedClassroom(c)} style={{
      background: selectedClassroom?.id === c.id ? "#1a237e" : CL.card,
      border: `0.5px solid ${selectedClassroom?.id === c.id ? CL.border : CL.line}`,
      borderRadius: 12, padding: "10px 12px", cursor: "pointer", transition: "background 0.15s",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: CL.text, fontFamily: "Manrope,sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
      <div style={{ fontSize: 10, color: CL.hint }}>{c._count?.members ?? 0} members</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: CL.text, fontFamily: "Syne,sans-serif", flex: 1 }}>🏫 Classroom</div>
        {teacherMode
          ? <button onClick={() => setShowCreateClass(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, color: CL.border, cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>+ New Class</button>
          : <button onClick={() => setShowJoinClass(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, color: CL.border, cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>👥 Join Class</button>
        }
      </div>

      {loading && !initialLoadDone && <p style={{ color: CL.muted, fontSize: 13 }}>Loading…</p>}

      {/* Empty states */}
      {initialLoadDone && classrooms.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 16 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏫</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: CL.text, marginBottom: 6, fontFamily: "Syne,sans-serif" }}>
            {teacherMode ? "No classrooms yet" : "You haven't joined a classroom"}
          </div>
          <div style={{ fontSize: 12, color: CL.muted, marginBottom: 16 }}>
            {teacherMode ? "Create your first classroom to get started." : "Ask your teacher for the Classroom ID to join."}
          </div>
          {teacherMode
            ? <button onClick={() => setShowCreateClass(true)} style={{ background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 10, padding: "8px 18px", fontSize: 12, color: "#c5cae9", cursor: "pointer" }}>+ Create Classroom</button>
            : <button onClick={() => setShowJoinClass(true)} style={{ background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 10, padding: "8px 18px", fontSize: 12, color: "#c5cae9", cursor: "pointer" }}>👥 Join a Classroom</button>
          }
        </div>
      )}

      {/* Main layout */}
      {classrooms.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: isMobile ? "column" : "row" }}>
          {/* Sidebar / Mobile strip */}
          {isMobile ? (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {classrooms.map(c => (
                <div key={c.id} onClick={() => setSelectedClassroom(c)} style={{
                  background: selectedClassroom?.id === c.id ? "#1a237e" : CL.card,
                  border: `0.5px solid ${selectedClassroom?.id === c.id ? CL.border : CL.line}`,
                  borderRadius: 20, padding: "6px 14px", cursor: "pointer", flexShrink: 0,
                  fontSize: 12, fontWeight: 600, color: selectedClassroom?.id === c.id ? "#c5cae9" : CL.muted,
                  whiteSpace: "nowrap", fontFamily: "Manrope,sans-serif",
                }}>{c.name}</div>
              ))}
            </div>
          ) : (
            <div style={{ width: 180, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {classrooms.map(classroomCard)}
            </div>
          )}

          {/* Right panel — classroom content */}
          <div style={{ flex: 1, minWidth: 0 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {selectedClassroom && (
              <>
                {/* Classroom header */}
                <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: CL.text, fontFamily: "Syne,sans-serif" }}>{selectedClassroom.name}</div>
                      {teacherMode && (
                        <div style={{ fontSize: 10, color: CL.hint, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                          ID: <code style={{ background: "#0a0c1e", padding: "1px 6px", borderRadius: 5, color: CL.muted }}>{selectedClassroom.id}</code>
                          <button onClick={() => navigator.clipboard.writeText(selectedClassroom.id)} style={{ background: "none", border: "none", color: CL.border, cursor: "pointer", fontSize: 10, padding: 0 }}>Copy</button>
                        </div>
                      )}
                    </div>
                    {selectedClassroom.exams?.length > 0 && (
                      <div style={{ background: "#1a0800", border: "0.5px solid #4a2000", borderRadius: 10, padding: "5px 10px", fontSize: 11, color: "#ffb74d" }}>
                        📅 {getDaysUntilExam(selectedClassroom.exams[0].examDate)}d until {selectedClassroom.exams[0].title}
                        <button onClick={() => { if (window.confirm("Start Exam Mode?")) window.dispatchEvent(new CustomEvent("startExamMode", { detail: selectedClassroom.exams[0] })); }} style={{ marginLeft: 8, background: "#ef4444", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#fff", cursor: "pointer" }}>Prep</button>
                      </div>
                    )}
                    {teacherMode && <button onClick={() => setShowExamModal(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "5px 11px", fontSize: 11, color: CL.muted, cursor: "pointer" }}>📝 Add Exam</button>}
                  </div>
                </div>

                {/* Pill tabs with navigation arrows */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
                  <button onClick={() => goToTab("prev")} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: "50%", width: 28, height: 28, flexShrink: 0, color: CL.muted, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>←</button>
                  <div ref={tabListRef} style={{ display: "flex", gap: 6, flex: 1, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}>
                    {TABS.map(t => (
                      <button key={t.id} onClick={() => setClassTab(t.id)} style={{
                        background: classTab === t.id ? "#1a237e" : CL.faint,
                        border: `0.5px solid ${classTab === t.id ? CL.border : CL.line}`,
                        borderRadius: 20, padding: "6px 13px", fontSize: 11,
                        color: classTab === t.id ? "#c5cae9" : CL.hint,
                        cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600,
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}>{t.label}</button>
                    ))}
                  </div>
                  <button onClick={() => goToTab("next")} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: "50%", width: 28, height: 28, flexShrink: 0, color: CL.muted, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>←</button>
                </div>

                {/* Announcements tab */}
                {classTab === "announcements" && (
                  <div>
                    {teacherMode && (
                      <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                        <input value={newAnnouncement.title} onChange={e => setNewAnnouncement(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title" style={{ width: "100%", boxSizing: "border-box", background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "8px 12px", fontSize: 12, color: CL.text, outline: "none", marginBottom: 7 }} />
                        <textarea value={newAnnouncement.content} onChange={e => setNewAnnouncement(p => ({ ...p, content: e.target.value }))} placeholder="Announcement content…" rows={3} style={{ width: "100%", boxSizing: "border-box", background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "8px 12px", fontSize: 12, color: CL.muted, outline: "none", resize: "vertical", marginBottom: 7 }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: CL.muted, cursor: "pointer" }}>
                            <input type="checkbox" checked={newAnnouncement.isImportant} onChange={e => setNewAnnouncement(p => ({ ...p, isImportant: e.target.checked }))} />⚠️ Important
                          </label>
                          <button onClick={createAnnouncement} style={{ marginLeft: "auto", background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 9, padding: "6px 14px", fontSize: 11, color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Post</button>
                        </div>
                      </div>
                    )}
                    {(selectedClassroom.announcements || []).length === 0
                      ? <p style={{ fontSize: 12, color: CL.hint, padding: "16px 4px" }}>No announcements yet.</p>
                      : (selectedClassroom.announcements || []).map(a => (
                        <div key={a.id} style={{ background: a.isImportant ? "#140800" : CL.card, border: `0.5px solid ${a.isImportant ? "#4a2000" : CL.line}`, borderRadius: 12, padding: "11px 14px", marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: a.isImportant ? "#ffb74d" : CL.text, marginBottom: 4 }}>{a.isImportant ? "🚨 " : ""}{a.title}</div>
                          <div style={{ fontSize: 12, color: CL.muted, lineHeight: 1.6 }}>{a.content}</div>
                          <div style={{ fontSize: 10, color: CL.hint, marginTop: 5 }}>{new Date(a.createdAt).toLocaleString()}</div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* Live Sessions tab */}
                {classTab === "sessions" && (
                  <LiveSessionsPanel classroomId={selectedClassroom.id} classroomName={selectedClassroom.name} isHost={isHost} currentUser={currentUser} token={token} />
                )}

                {/* Assignments tab */}
                {classTab === "assignments" && (
                  <div>
                    <ClassroomAssignmentsPanel classroomId={selectedClassroom.id} isHost={isHost} currentUser={currentUser} token={token} />
                    {assignments.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: CL.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8, fontFamily: "Syne,sans-serif" }}>LEGACY ASSIGNMENTS</div>
                        {assignments.map(a => {
                          const subj = subjects.find(s => s.id === a.subjectId);
                          return (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 12, padding: "10px 14px", marginBottom: 7 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: CL.text }}>{a.title}</div>
                                <div style={{ fontSize: 10, color: CL.hint }}>{subj?.label || ""}{a.due ? ` — Due ${a.due}` : ""}</div>
                              </div>
                              <button onClick={() => onComplete(a.id)} style={{ background: a.done ? "#071410" : "#1a237e", border: `0.5px solid ${a.done ? "#0a3020" : CL.border}`, borderRadius: 9, padding: "5px 12px", fontSize: 11, color: a.done ? "#81c784" : "#c5cae9", cursor: "pointer" }}>{a.done ? "✅ Done" : "Mark Done"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Docs & Links tab */}
                {classTab === "docs" && (
                  <div>
                    <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: CL.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10, fontFamily: "Syne,sans-serif" }}>QUICK LINKS</div>
                      {teacherMode && (
                        <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
                          <input value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="Link name" style={{ flex: 1, minWidth: 100, background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "7px 11px", fontSize: 11, color: CL.text, outline: "none" }} />
                          <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://…" style={{ flex: 2, minWidth: 140, background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "7px 11px", fontSize: 11, color: CL.text, outline: "none" }} />
                          <button onClick={addLink} style={{ background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 9, padding: "7px 13px", fontSize: 11, color: "#c5cae9", cursor: "pointer" }}>Add</button>
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {(selectedClassroom.links || []).map(link => (
                          <button key={link.id} onClick={() => setPopupLink(link)} style={{ background: "#0a0c1e", border: `0.5px solid #2a2d6a`, borderRadius: 20, padding: "6px 13px", fontSize: 11, color: "#9fa8da", cursor: "pointer" }}>👉 {link.title}</button>
                        ))}
                        {!(selectedClassroom.links?.length) && <span style={{ fontSize: 12, color: CL.hint }}>No links yet.</span>}
                      </div>
                    </div>
                    <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: CL.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10, fontFamily: "Syne,sans-serif" }}>DOCUMENTS</div>
                      {teacherMode && (
                        <div style={{ marginBottom: 10 }}>
                          <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadDocument} disabled={uploadingDoc} style={{ fontSize: 11 }} />
                          {uploadingDoc && <span style={{ fontSize: 11, color: CL.muted, marginLeft: 8 }}>Uploading…</span>}
                        </div>
                      )}
                      {(selectedClassroom.documents || []).map(doc => (
                        <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 11, padding: "9px 12px", marginBottom: 7 }}>
                          <span style={{ fontSize: 18 }}>{doc.fileType === "pdf" ? "📄" : doc.fileType === "docx" ? "📄" : "📄"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: CL.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                            <div style={{ fontSize: 10, color: CL.hint }}>{doc.fileType?.toUpperCase()} — {(doc.fileSize / 1024).toFixed(1)} KB</div>
                          </div>
                          <button onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/classroom/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
                              if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Download failed"); }
                              const blob = await res.blob(); const url = URL.createObjectURL(blob);
                              const link = document.createElement("a"); link.href = url; link.download = doc.filename || doc.title || "document";
                              document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                            } catch (err) { toast.error("Download failed: " + err.message); }
                          }} style={{ background: "#071410", border: "0.5px solid #0a3020", borderRadius: 8, padding: "5px 10px", fontSize: 10, color: "#81c784", cursor: "pointer" }}>⬇️ Download</button>
                        </div>
                      ))}
                      {!(selectedClassroom.documents?.length) && <span style={{ fontSize: 12, color: CL.hint }}>No documents yet.</span>}
                    </div>
                  </div>
                )}

                {/* Attendance tab */}
                {classTab === "attendance" && (
                  <AttendancePanel classroomId={selectedClassroom.id} isHost={isHost} token={token} />
                )}

                {/* Teacher tools — single instance */}
                {teacherMode && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <BulkImport onImportQuestions={onImportQuestions} />
                    <AIQuestionGen onImportQuestions={onImportQuestions} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateClass && (
        <div className="modal-overlay" onClick={() => setShowCreateClass(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>Create New Classroom</h3>
            <input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Classroom name (e.g., 'MTH111 - 2024')" style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14 }}>
              <option value="">Select Subject (optional)</option>
              {subjects.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCreateClass(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={createClassroom} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a237e", color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Join Class Modal */}
      {showJoinClass && (
        <div className="modal-overlay" onClick={() => { setShowJoinClass(false); setJoinError(""); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>👥 Join Classroom</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Enter the Classroom ID provided by your teacher.</p>
            <input value={joinClassCode} onChange={(e) => setJoinClassCode(e.target.value)} placeholder="Classroom ID (e.g., 'abc123')" style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            {joinError && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{joinError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowJoinClass(false); setJoinError(""); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={joinClassroom} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a237e", color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Join</button>
            </div>
          </div>
        </div>
      )}

      {/* Link Popup Modal */}
      {popupLink && (
        <div className="modal-overlay" onClick={() => setPopupLink(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, padding: 20 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>👉 {popupLink.title}</h3>
            <p style={{ wordBreak: "break-all", color: "#FFD700", marginBottom: 16, fontSize: 13 }}>{popupLink.url}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPopupLink(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Close</button>
              <button onClick={() => { window.open(popupLink.url, "_blank"); setPopupLink(null); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #FFD700, #DAA520)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Open Link</button>
            </div>
          </div>
        </div>
      )}

      {/* Important Announcement Popup */}
      {showAnnouncementPopup && (
        <div className="modal-overlay" onClick={() => { markAnnouncementRead(showAnnouncementPopup.id); setShowAnnouncementPopup(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, padding: 20, border: "2px solid rgba(239,68,68,0.5)", background: "linear-gradient(135deg, rgba(20,20,20,0.95), rgba(239,68,68,0.1))" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 40 }}>🚨</span>
              <h3 style={{ color: "#fbbf24", margin: "4px 0 0 0" }}>Important Announcement</h3>
            </div>
            <h4 style={{ margin: "0 0 8px 0" }}>{showAnnouncementPopup.title}</h4>
            <p style={{ marginBottom: 14, fontSize: 14, lineHeight: 1.6 }}>{showAnnouncementPopup.content}</p>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>Posted: {new Date(showAnnouncementPopup.createdAt).toLocaleString()}</div>
            <button onClick={() => { markAnnouncementRead(showAnnouncementPopup.id); setShowAnnouncementPopup(null); }} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(239,68,68,0.2)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Got it!</button>
          </div>
        </div>
      )}

      {/* Exam Modal */}
      {showExamModal && (
        <div className="modal-overlay" onClick={() => setShowExamModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>📝 Add Exam</h3>
            <input value={newExam.title} onChange={(e) => setNewExam((prev) => ({ ...prev, title: e.target.value }))} placeholder="Exam title (e.g., 'MTH111 Mid-Semester')" style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <input type="datetime-local" value={newExam.examDate} onChange={(e) => setNewExam((prev) => ({ ...prev, examDate: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <input type="number" value={newExam.duration} onChange={(e) => setNewExam((prev) => ({ ...prev, duration: parseInt(e.target.value) }))} placeholder="Duration (minutes)" style={{ width: "100%", boxSizing: "border-box", marginBottom: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowExamModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={createExam} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a237e", color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Add Exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// AIHelper imported from ./components/SmallComponents

function _AIHelper_REMOVED({ aiConfig, onUsed }) {



  const [q, setQ] = useState("");



  const [a, setA] = useState("");



  const [loading, setLoading] = useState(false);







  async function askAI() {



    if (!q.trim()) return;



    try {



      setLoading(true);



      const text = await callAI(q, aiConfig);



      setA(text);



      onUsed?.();



    } catch (err) {



      setA(err.message || "AI request failed. Please try again later.");



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













// SimpleCheckpoint imported from ./components/SmallComponents

function _SimpleCheckpoint_REMOVED({ question, onDone }) {



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



        <p className="muted">{selected === question.answer ? "Correct ?" : "Try again next round ?"}</p>



      )}



      <button onClick={onDone}>Close</button>



    </div>



  );

}













// QuestionBank imported from ./components/QuestionBank

function _QuestionBank_REMOVED({ subjects, onStartPastPaper }) {



  const [q, setQ] = useState("");



  const [subj, setSubj] = useState("all");



  const [diff, setDiff] = useState("all");



  const [year, setYear] = useState("all");



  const [questionCount, setQuestionCount] = useState("all");



  const [customMinutes, setCustomMinutes] = useState("");



  const [customQuestions, setCustomQuestions] = useState([]);



  // Load custom questions from localStorage

  useEffect(() => {

    const uid = localStorage.getItem("scholars-circle-current-user") || "guest";

    const key = `sc_custom_questions::${uid}`;

    try {

      const raw = localStorage.getItem(key);

      if (raw) setCustomQuestions(JSON.parse(raw));

    } catch {}

  }, []);



  // Guard against undefined subjects

  if (!subjects || !Array.isArray(subjects)) {

    return (

      <div className="card">

        <h2>Past Questions Bank</h2>

        <p className="muted">Loading subjects...</p>

      </div>

    );

  }



  const allRows = [

    ...subjects.flatMap((s) =>

      (s.questions || []).map((qu, i) => ({ ...qu, subjectId: s.id, subjectLabel: s.label, subjectIcon: s.icon, subject: s.label, year: qu.year || 2020 + (i % 6) }))

    ),

    ...customQuestions.map((qu) => ({

      ...qu,

      subjectId: "custom",

      subjectLabel: qu.topic || "Custom",

      subjectIcon: "📄",

    }))

  ];



  const rows = allRows.filter(



    (row) =>



      (subj === "all" || row.subject === subj || (subj === "Custom" && row.subjectId === "custom")) &&



      (diff === "all" || row.difficulty === diff) &&



      (year === "all" || String(row.year) === year) &&



      (row.q.toLowerCase().includes(q.toLowerCase()) || row.options.some((o) => o.toLowerCase().includes(q.toLowerCase())))



  );



  const years = [...new Set(allRows.map(r => r.year))].sort();

  

  // Get unique subjects including custom

  const subjectOptions = [...new Set(allRows.map(r => r.subjectLabel))];



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



          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}



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



            📝 Take {year} Paper ({selectedRows.length} Qs — {minutes} min)



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













// RevisionPlanner imported from ./components/SmallComponents

function _RevisionPlanner_REMOVED({ mastery, dueCards, subjects }) {



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













// BulkImport imported from ./components/SmallComponents

function _BulkImport_REMOVED({ onImportQuestions }) {



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













// FlashcardDeck imported from ./components/FlashcardDeck

function _FlashcardDeck_REMOVED({ subjects, srData, customFlashcards, setCustomFlashcards, token }) {



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



          <p style={{ fontSize: "2rem" }}>💡</p>



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



                <p className="flashcard-answer">{card.back}</p>



              </div>



            </div>



          </div>



          {flipped && (



            <div className="row" style={{ marginTop: 16 }}>



              <button style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }} onClick={next}>Got it wrong</button>



              <button style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }} onClick={next}>Got it right ?</button>



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













// Leaderboard imported from ./components/Leaderboard

function _Leaderboard_REMOVED({ username, xp, sessions, streak, mastery, subjects, token }) {



  const [board, setBoard] = useState([]);



  const [loading, setLoading] = useState(true);



  const [initialLoadDone, setInitialLoadDone] = useState(false);



  const [timePeriod, setTimePeriod] = useState("all"); // all, weekly, monthly



  const [subjectFilter, setSubjectFilter] = useState("all"); // all, or subject ID



  const [selectedUser, setSelectedUser] = useState(null); // For profile modal



  const [userProfileData, setUserProfileData] = useState(null);



  const [loadingProfile, setLoadingProfile] = useState(false);







  useEffect(() => {



    if (!token) return;



    const params = new URLSearchParams();

    if (timePeriod !== "all") params.append("period", timePeriod);

    if (subjectFilter !== "all") params.append("subjectId", subjectFilter);



    fetch(`${API_BASE}/users/leaderboard?${params}`, { headers: { Authorization: `Bearer ${token}` } })



      .then((r) => r.json())



      .then((users) => {

        setBoard(users);

      })



      .catch(() => {})



      .finally(() => {

        setLoading(false);

        setInitialLoadDone(true);

      });



  }, [token, timePeriod, subjectFilter]);



  // Fetch user profile data when selected

  useEffect(() => {

    if (!selectedUser || !token) return;



    setLoadingProfile(true);

    fetch(`${API_BASE}/users/${selectedUser.userId}/profile`, {

      headers: { Authorization: `Bearer ${token}` }

    })

      .then((r) => r.json())

      .then((data) => {

        setUserProfileData(data);

      })

      .catch(() => {

        // If endpoint doesn't exist, use leaderboard data

        setUserProfileData({

          username: selectedUser.username,

          xp: selectedUser.totalXP || selectedUser.xp,

          sessions: selectedUser.sessions,

          streak: selectedUser.streak,

          avgMastery: selectedUser.avgMastery,

          correctRate: selectedUser.correctRate,

          studyHours: selectedUser.studyHours,

          personalBest: selectedUser.personalBest,

          badges: calculateBadges(selectedUser),

          recentSessions: [],

        });

      })

      .finally(() => setLoadingProfile(false));

  }, [selectedUser, token]);







  const localEntry = { username, xp, sessions, streak: streak || 0, isMe: true, avgMastery: 0, correctRate: 0, studyHours: 0, personalBest: 0 };



  const merged = board.length > 0



    ? board.map((e) => ({ ...e, isMe: e.username === username }))



    : [localEntry, { username: "demo_student", xp: Math.max(0, xp - 40), sessions: Math.max(0, sessions - 2), streak: Math.max(0, (streak || 0) - 1), isMe: false, avgMastery: 0, correctRate: 0, studyHours: 0, personalBest: 0 }];







  const ranked = [...merged].sort((a, b) => b.xp - a.xp);



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

    if (xp >= 1000) return { name: "Diamond", color: "#FFD700", icon: "💎" };

    if (xp >= 500) return { name: "Platinum", color: "#DAA520", icon: "👑" };

    if (xp >= 250) return { name: "Gold", color: "#facc15", icon: "🥇" };

    if (xp >= 100) return { name: "Silver", color: "#94a3b8", icon: "🥈" };

    return { name: "Bronze", color: "#cd7f32", icon: "🥉" };

  }



  // Streak visualization

  function getStreakEmoji(streak) {

    if (streak >= 30) return "🔥🔥🔥";

    if (streak >= 14) return "🔥🔥";

    if (streak >= 7) return "🔥";

    if (streak >= 3) return "✨";

    return "";

  }



  // Activity indicator

  function getActivityStatus(lastActive) {

    if (!lastActive) return "";

    const minutesAgo = (Date.now() - new Date(lastActive).getTime()) / 60000;

    if (minutesAgo < 5) return "👍 Active now";

    if (minutesAgo < 1440) return "📚 Studied today";

    return "";

  }







  // Tier definitions for track
  const TIERS = [
    { name: 'Bronze', min: 0, color: '#cd7f32' },
    { name: 'Silver', min: 100, color: '#94a3b8' },
    { name: 'Gold', min: 250, color: '#facc15' },
    { name: 'Platinum', min: 500, color: '#DAA520' },
    { name: 'Diamond', min: 1000, color: '#FFD700' },
  ];

  const myXP = xp || 0;
  const myTierIdx = TIERS.reduce((acc, t, i) => myXP >= t.min ? i : acc, 0);
  const myTier = TIERS[myTierIdx];
  const nextTier = TIERS[myTierIdx + 1];

  function getInitials(name) {
    if (!name) return '👤';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  const me = ranked.find(e => e.isMe);
  const myRank = me ? ranked.indexOf(me) + 1 : ranked.length + 1;
  const personAbove = me && myRank > 1 ? ranked[myRank - 2] : null;
  const xpToPass = personAbove ? (personAbove.xp - me.xp) : 0;

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const risers = [...ranked].sort((a, b) => (b.dailyXP || 0) - (a.dailyXP || 0)).slice(0, 3);
  const streakLegends = [...ranked].sort((a, b) => (b.streak || 0) - (a.streak || 0)).slice(0, 3);

  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const ms = monday - Date.now();
      if (ms <= 0) return setCountdown('0d 0h 0m');
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${d}d ${h}h ${m}m`);
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const ringColors = ['#F5A623', '#A8B0BE', '#C9824A'];
  const profileTier = userProfileData ? getTier(userProfileData.xp) : null;

  return (
    <div className="card" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>

      {/* League Hero */}
      <div className="lb-hero">
        <div className="lb-hero-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z"/></svg>
        </div>
        <div className="lb-hero-text">
          <span className="tag">YOUR LEAGUE</span>
          <h2>{myTier.name} Circle</h2>
          <p>
            <span className="promo">Top 5</span> advance to {nextTier ? nextTier.name : 'Champion'} —{' '}
            <span className="demo">Bottom 5</span> drop to {myTierIdx > 0 ? TIERS[myTierIdx - 1].name : 'Bronze'}
          </p>
        </div>
        <div className="lb-countdown">
          <div className="cd-label">LEAGUE RESETS IN</div>
          <div className="cd-value">{countdown || '⏱'}</div>
        </div>
      </div>

      {/* Tier Track */}
      <div className="lb-tier-track">
        {TIERS.map((t, i) => (
          <div key={t.name} className={`lb-tier-node ${i === myTierIdx ? 'active' : i < myTierIdx ? 'done' : ''}`}>
            <div className="lb-tier-line" />
            <div className="lb-tier-hex" />
            <span className="lb-tier-label">{t.name}</span>
          </div>
        ))}
      </div>

      {/* Time period + subject filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="lb-scope-tabs" style={{ marginBottom: 0 }}>
          {["all", "weekly", "monthly"].map((period) => (
            <button
              key={period}
              className={`lb-scope-tab ${timePeriod === period ? 'active' : ''}`}
              onClick={() => setTimePeriod(period)}
            >
              {period === 'all' ? '📊 All' : period === 'weekly' ? '📅 Week' : '📅 Month'}
            </button>
          ))}
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          style={{
            padding: '7px 14px', background: '#151A24', color: '#EDEFF5',
            border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999,
            cursor: 'pointer', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <option value="all">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
          ))}
        </select>
      </div>

      {loading && !initialLoadDone && <p className="muted" style={{ textAlign: 'center', padding: 40 }}>Loading leaderboard…</p>}

      {/* Podium */}
      {top3.length >= 1 && (
        <div className="lb-podium">
          {/* #2 - left */}
          {top3[1] && (
            <div className="lb-pod-col rank2" onClick={() => !top3[1].isMe && setSelectedUser(top3[1])} style={{ cursor: top3[1].isMe ? 'default' : 'pointer' }}>
              <div className="lb-pod-ring">
                <svg viewBox="0 0 74 74" width="74" height="74"><circle cx="37" cy="37" r="33" fill="none" stroke={ringColors[1]} strokeWidth="4"/></svg>
                <div className="lb-pod-avatar">{getInitials(top3[1].username)}</div>
              </div>
              <span className="name">{top3[1].username}{top3[1].isMe && ' (you)'}</span>
              <span className="xp">{(top3[1].xp || 0).toLocaleString()} XP</span>
            </div>
          )}
          {/* #1 - center */}
          <div className="lb-pod-col rank1" onClick={() => !top3[0].isMe && setSelectedUser(top3[0])} style={{ cursor: top3[0].isMe ? 'default' : 'pointer' }}>
            <div className="lb-pod-ring">
              <span className="lb-pod-crown">👑</span>
              <svg viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="42" fill="none" stroke={ringColors[0]} strokeWidth="5"/></svg>
              <div className="lb-pod-avatar">{getInitials(top3[0].username)}</div>
            </div>
            <span className="name">{top3[0].username}{top3[0].isMe && ' (you)'}</span>
            <span className="xp">{(top3[0].xp || 0).toLocaleString()} XP</span>
          </div>
          {/* #3 - right */}
          {top3[2] && (
            <div className="lb-pod-col rank3" onClick={() => !top3[2].isMe && setSelectedUser(top3[2])} style={{ cursor: top3[2].isMe ? 'default' : 'pointer' }}>
              <div className="lb-pod-ring">
                <svg viewBox="0 0 74 74" width="74" height="74"><circle cx="37" cy="37" r="33" fill="none" stroke={ringColors[2]} strokeWidth="4"/></svg>
                <div className="lb-pod-avatar">{getInitials(top3[2].username)}</div>
              </div>
              <span className="name">{top3[2].username}{top3[2].isMe && ' (you)'}</span>
              <span className="xp">{(top3[2].xp || 0).toLocaleString()} XP</span>
            </div>
          )}
        </div>
      )}

      {/* Rank List (4th onward) */}
      {rest.length > 0 && (
        <>
          <span className="lb-section-label">{myTier.name.toUpperCase()} CIRCLE • RANK 4—{ranked.length}</span>
          <div className="lb-rank-list">
            {rest.map((entry, i) => {
              const rank = i + 4;
              const isPromo = rank <= 5;
              const isDemo = rank >= ranked.length - 4;
              return (
                <div
                  key={entry.username}
                  className={`lb-rank-row ${isPromo ? 'promo' : ''} ${isDemo ? 'demo' : ''} ${entry.isMe ? 'me' : ''}`}
                  onClick={() => !entry.isMe && setSelectedUser(entry)}
                  style={{ cursor: entry.isMe ? 'default' : 'pointer' }}
                >
                  <span className="lb-rank-num">{rank}</span>
                  <span className={`lb-rank-trend ${entry.trend > 0 ? 'up' : entry.trend < 0 ? 'down' : 'same'}`}>
                    {entry.trend > 0 ? '↑' : entry.trend < 0 ? '↓' : '↓'}{entry.trend !== 0 && entry.trend ? Math.abs(entry.trend) : ''}
                  </span>
                  <span className="lb-rank-av">{getInitials(entry.username)}</span>
                  <span className="lb-rank-name">
                    <span className="nm">{entry.username}{entry.isMe && ' (you)'}</span>
                    {entry.streak > 0 && <span className="meta">🔥 {entry.streak}d streak — {entry.sessions} sessions</span>}
                  </span>
                  <span className="lb-rank-xp">{(entry.xp || 0).toLocaleString()} XP</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dual Grid: Risers + Streak Legends */}
      <div className="lb-dual-grid">
        <div className="lb-mini-card">
          <h3>📈 This week's risers</h3>
          {risers.map((r, i) => (
            <div key={r.username} className="lb-mini-row">
              <span className="mname">{r.username}{r.isMe && ' (you)'}</span>
              <span className="mval green">+{(r.dailyXP || Math.round(r.xp * 0.15) || 0)} XP</span>
            </div>
          ))}
        </div>
        <div className="lb-mini-card">
          <h3>🔥 Streak legends</h3>
          {streakLegends.map((r, i) => (
            <div key={r.username} className="lb-mini-row">
              <span className="mname">{r.username}{r.isMe && ' (you)'}</span>
              <span className="mval">{r.streak || 0} days</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky You Bar */}
      {me && (
        <div className="lb-you-bar">
          <span>#{myRank} — <b>You</b> — {(me.xp || 0).toLocaleString()} XP</span>
          {personAbove && (
            <>
              <div className="sep" />
              <span className="next">{xpToPass > 0 ? `${xpToPass} XP to pass ${personAbove.username} 🏆` : "You're at the top! 🎉"}</span>
            </>
          )}
        </div>
      )}

      {/* User Profile Modal — compact, no scroll */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content lb-profile-modal" onClick={(e) => e.stopPropagation()}>
            {loadingProfile ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p className="muted">Loading profile…</p>
              </div>
            ) : userProfileData ? (
              <>
                {/* Header */}
                <div className="lb-profile-header">
                  <div className="lb-profile-avatar" style={{ background: profileTier.color }}>
                    {getInitials(userProfileData.username)}
                  </div>
                  <div className="lb-profile-header-info">
                    <div className="uname">{userProfileData.username}</div>
                    <span className="tier-badge" style={{ background: profileTier.color, color: profileTier.color === '#facc15' || profileTier.color === '#94a3b8' ? '#000' : '#fff' }}>
                      {profileTier.icon} {profileTier.name}
                    </span>
                  </div>
                  <button className="modal-close" onClick={() => setSelectedUser(null)} style={{ position: 'static', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', color: '#9AA3B5', cursor: 'pointer', padding: 4 }}>×</button>
                </div>

                {/* Body */}
                <div className="lb-profile-body">
                  {/* 2×2 Stat Grid */}
                  <div className="lb-profile-stats">
                    <div className="lb-profile-stat">
                      <div className="label">Total XP</div>
                      <div className="value" style={{ color: '#FFD700' }}>{(userProfileData.xp || 0).toLocaleString()}</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Sessions</div>
                      <div className="value" style={{ color: '#4ade80' }}>{userProfileData.sessions || 0}</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Streak</div>
                      <div className="value" style={{ color: '#fb923c' }}>{userProfileData.streak || 0} days</div>
                    </div>
                    <div className="lb-profile-stat">
                      <div className="label">Study Hours</div>
                      <div className="value" style={{ color: '#c084fc' }}>{userProfileData.studyHours || 0}h</div>
                    </div>
                  </div>

                  {/* Mastery Bar */}
                  <div className="lb-profile-mastery">
                    <div className="mlabel">
                      <span>Average Mastery</span>
                      <span style={{ color: '#FFD700', fontWeight: 700 }}>{userProfileData.avgMastery || 0}%</span>
                    </div>
                    <div className="bar">
                      <div className="fill" style={{ width: `${userProfileData.avgMastery || 0}%` }} />
                    </div>
                  </div>

                  {/* Badges + Personal Best in one row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {userProfileData.badges && userProfileData.badges.length > 0 && (
                      <div className="lb-profile-badges">
                        <span className="blabel">Badges:</span>
                        {userProfileData.badges.slice(0, 6).map((badge, idx) => (
                          <span key={idx} style={{ fontSize: 18 }} title={badge.label}>{badge.icon}</span>
                        ))}
                        {userProfileData.badges.length > 6 && <span style={{ fontSize: 11, color: '#646E84' }}>+{userProfileData.badges.length - 6}</span>}
                      </div>
                    )}
                    {userProfileData.personalBest > 0 && (
                      <span className="lb-profile-pb">🏅 PB: {userProfileData.personalBest}%</span>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {!token && <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>Connect to the backend to see real rankings.</p>}

    </div>

  );
}













// PomodoroTimer imported from ./components/StudyTools

function _PomodoroTimer_REMOVED({ onSessionDone }) {



  const MODES = [



    { id: "work", label: "Focus", duration: 25 * 60, color: "#2dd4a0" },



    { id: "short", label: "Short Break", duration: 5 * 60, color: "#FFD700" },



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



      const msg = mode.id === "work" ? "Focus session done! Take a break." : "Break over → back to work!";



      if (window.Notification?.permission === "granted") new Notification("Scholar's Circle", { body: msg });



      else toast.info(msg);



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



          {running ? "⏸️ Pause" : "▶️ Start"}



        </button>



        <button onClick={() => { setTimeLeft(mode.duration); setRunning(false); }}>? Reset</button>



      </div>



      <p className="muted" style={{ marginTop: 16 }}>Completed focus sessions today: <strong>{cycles}</strong></p>



      <div style={{ marginTop: 12 }}>



        <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="What are you studying?" style={{ width: "100%", maxWidth: 320 }} />



      </div>



      <button className="muted" style={{ marginTop: 8, fontSize: 12 }} onClick={requestNotifPerm}>Enable notifications</button>



    </div>



  );

}













// NotesEditor imported from ./components/StudyTools

function _NotesEditor_REMOVED({ subjects, notes, setNotes }) {



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













// SearchResults imported from ./components/SearchAndBadges

function _SearchResults_REMOVED({ query, subjects, onStart }) {



  const q = query.toLowerCase();



  const subjectHits = (subjects || []).filter((s) => s.label.toLowerCase().includes(q) || s.icon.includes(q));



  const lessonHits = (subjects || []).flatMap((s) =>



    (s.lessons || [])



      .filter((l) => l.title.toLowerCase().includes(q) || l.content.toLowerCase().includes(q))



      .map((l) => ({ ...l, subjectLabel: s.label, subjectId: s.id }))



  );



  const questionHits = (subjects || []).flatMap((s) =>



    (s.questions || [])



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



              <span className="muted" style={{ fontSize: 12 }}>{qn.subjectLabel} — {qn.difficulty}</span>



            </div>



          ))}



        </>



      )}



    </div>



  );

}













// AchievementsBadges imported from ./components/SearchAndBadges

function _AchievementsBadges_REMOVED({ badges, stats, history, subjects, mastery }) {



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













// TimetableBuilder imported from ./components/StudyTools

function _TimetableBuilder_REMOVED({ timetable, setTimetable, subjects }) {



  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];



  const HOURS = ["8am","9am","10am","11am","12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm"];



  const COLORS = ["#2dd4a0","#FFD700","#fb923c","#facc15","#f472b6","#38bdf8","#a78bfa"];



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













// CheatSheet imported from ./components/StudyTools

function _CheatSheet_REMOVED({ subjects, mastery }) {



  const [active, setActive] = useState(subjects[0]?.id || "");



  const subject = subjects.find(s => s.id === active);







  function printSheet() {



    const win = window.open("", "_blank");



    const content = subject.lessons.map(l => `<h3>${l.title}</h3><p>${l.content}</p>`).join("");



    const keyFacts = subject.questions.slice(0, 5).map(q =>



      `<li><strong>Q:</strong> ${q.q}<br/><strong>A:</strong> ${q.options[q.answer]} — ${q.explanation}</li>`



    ).join("");



    win.document.write(`<html><head><title>${subject.label} Cheat Sheet</title>



    <style>body{font-family:sans-serif;padding:24px;max-width:700px;margin:auto}h1{color:#2dd4a0}h3{color:#FFD700}li{margin-bottom:8px}</style></head>



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



              <strong style={{ color: "#FFD700" }}>{l.title}</strong>



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













// DiscussionBoard imported from ./components/Discussion

function _DiscussionBoard_REMOVED({ subjects, discussion, setDiscussion, username, isTeacher }) {



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









// DiscussionThread imported from ./components/Discussion

function _DiscussionThread_REMOVED({ thread, onReply, username, isTeacher }) {



  const [replyText, setReplyText] = useState("");



  const [showReply, setShowReply] = useState(false);



  return (



    <div className="discussion-thread">



      <div className="discussion-post">



        <span className="post-author">{thread.author} <span className="muted" style={{ fontSize: 11 }}>({thread.role}) — {new Date(thread.ts).toLocaleString()}</span></span>



        <p style={{ margin: "4px 0" }}>{thread.text}</p>



        <button style={{ fontSize: 12 }} onClick={() => setShowReply(v => !v)}>? Reply ({thread.replies.length})</button>



      </div>



      {thread.replies.map(r => (



        <div key={r.id} className="discussion-reply">



          <span className="post-author" style={{ color: isTeacher || r.role === "Teacher" ? "#facc15" : "#FFD700" }}>



            {r.author} <span className="muted" style={{ fontSize: 11 }}>({r.role}) — {new Date(r.ts).toLocaleString()}</span>



          </span>



          <p style={{ margin: "2px 0" }}>{r.text}</p>



        </div>



      ))}



      {showReply && (



        <div className="row" style={{ marginTop: 4, paddingLeft: 16 }}>



          <input style={{ flex: 1 }} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" />



          <button style={{ borderColor: "#FFD700", color: "#FFD700" }} onClick={() => { onReply(replyText); setReplyText(""); setShowReply(false); }}>Send</button>



        </div>



      )}



    </div>



  );



}















// AIQuestionGen imported from ./components/SmallComponents

function _AIQuestionGen_REMOVED({ onImportQuestions }) {



  const [topic, setTopic] = useState("");



  const [count, setCount] = useState(5);



  const [difficulty, setDifficulty] = useState("medium");



  const [loading, setLoading] = useState(false);

  const [preview, setPreview] = useState([]);

  const [error, setError] = useState("");



  async function generate() {

    if (!topic.trim()) return;

    setLoading(true); setError(""); setPreview([]);



    const prompt = `Generate exactly ${count} multiple-choice questions about "${topic}" for a first-year university student. Difficulty: ${difficulty}.\nReturn ONLY a JSON array with this structure (no extra text):\n[{"q":"question","options":["A","B","C","D"],"answer":0,"explanation":"why","difficulty":"${difficulty}"}]\nThe "answer" field is the index (0-3) of the correct option.`;



    try {

      const raw = await callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" });

      const jsonStr = raw.startsWith("[") ? raw : raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);

      const parsed = JSON.parse(jsonStr);

      setPreview(parsed);

    } catch (e) {

      setError(`Generation failed: ${e.message}`);

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



      <button onClick={generate} disabled={loading} style={{ marginTop: 8, borderColor: "#FFD700", color: "#FFD700" }}>



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



            ? Import all {preview.length} to Question Bank



          </button>



        </>



      )}



    </div>



  );



}







// ConfidenceHeatmap imported from ./components/SearchAndBadges

function _ConfidenceHeatmap_REMOVED({ history }) {



  if (!history.length) return <p className="muted">No session history yet.</p>;



  const recent = history.slice(-100);



  return (



    <div className="heatmap">



      {recent.map((h, i) => {



        const pct = Math.round((h.score / Math.max(1, h.total)) * 100);



        const color = pct === 100 ? "#2dd4a0" : pct >= 80 ? "#FFD700" : pct >= 50 ? "#facc15" : "#ff6b6b";



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







// AITutorChat imported from ./components/AITutorChat

function _AITutorChat_REMOVED({ aiConfig, chatHistory, setChatHistory, subjects, token, demoMode, demoUsage, setDemoUsage }) {



  const [message, setMessage] = useState("");



  const [loading, setLoading] = useState(false);



  const [selectedSubject, setSelectedSubject] = useState("");



  const messagesEndRef = useRef(null);

  const chatContainerRef = useRef(null);

  const prevHistoryLengthRef = useRef(0);







  const scrollToBottom = () => {



    // Only scroll within the chat container, never the page itself

    const c = chatContainerRef.current;

    if (c) c.scrollTop = c.scrollHeight;



  };







  useEffect(() => {

    // Only scroll when a new message is added (length increased)

    if (chatHistory.length > prevHistoryLengthRef.current) {

      scrollToBottom();

    }

    prevHistoryLengthRef.current = chatHistory.length;

  }, [chatHistory]);



  // Initialize with welcome message if chat is empty

  useEffect(() => {

    if (chatHistory.length === 0) {

      const welcomeMsg = {

        role: "assistant",

        content: "🤖 Hello! I'm your AI Tutor. What should I teach you today? I can help you with any subject - just ask me a question or select a specific subject from the dropdown above.",

        timestamp: Date.now()

      };

      setChatHistory([welcomeMsg]);

    }

  }, []);







  async function sendMessage(overrideMessage = null) {

    const msgToSend = overrideMessage || message;

    if (!msgToSend.trim() || loading) return;



    if (demoMode && (demoUsage.aiTutorMessages || 0) >= DEMO_LIMITS.aiTutorMessages) {

      setChatHistory([...chatHistory, { role: "assistant", content: `Demo limit reached: You've used ${DEMO_LIMITS.aiTutorMessages} AI tutor messages. Register for full access.`, timestamp: Date.now() }]);

      return;

    }



    const userMsg = msgToSend.trim();

    // Only clear if not using override (which means it was typed)

    if (!overrideMessage) {

      setMessage("");

    }

    setLoading(true);



    const newHistory = [...chatHistory, { role: "user", content: userMsg, timestamp: Date.now() }];

    setChatHistory(newHistory);



    if (demoMode) {

      setDemoUsage(prev => ({ ...prev, aiTutorMessages: (prev.aiTutorMessages || 0) + 1 }));

    }



    try {

      const context = selectedSubject

        ? `You are a helpful tutor for ${selectedSubject}. The user is studying this subject. Keep answers concise and educational. After explaining, always ask if the user wants you to: break the concept down more, or explain it like they're 6 years old.`

        : "You are a helpful study tutor. Keep answers concise and educational. After explaining, always ask if the user wants you to: break the concept down more, or explain it like they're 6 years old.";



      let systemPrompt = context + "\n\nSubjects available: " + subjects.map(s => s.label).join(", ");

      

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

                { role: "user", content: userMsg }

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



      // Add follow-up buttons to all responses (except errors)

      let finalResponse = responseText;

      const isError = responseText.toLowerCase().startsWith("error:") || responseText.toLowerCase().includes("demo limit");

      if (!isError) {

        finalResponse = responseText + "\n\n[FollowUpButtons]";

      }



      setChatHistory([...newHistory, { role: "assistant", content: finalResponse, timestamp: Date.now() }]);



      if (token) {

        api("/user-data/chat", { token, method: "POST", body: { role: "assistant", content: finalResponse } }).catch(console.error);

      }

    } catch (e) {

      console.error("AI Tutor error:", e);

      setChatHistory([...newHistory, { role: "assistant", content: "Error: " + e.message, timestamp: Date.now() }]);

    } finally {

      setLoading(false);

    }

  }







  function clearHistory() {



    const welcomeMsg = {

      role: "assistant",

      content: "🤖 Hello! I'm your AI Tutor. What should I teach you today? I can help you with any subject - just ask me a question or select a specific subject from the dropdown above.",

      timestamp: Date.now()

    };

    setChatHistory([welcomeMsg]);



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



      <div className="ai-chat-container" ref={chatContainerRef} style={{ maxHeight: "400px", overflowY: "auto" }}>



        {chatHistory.map((msg, i) => (



          <div key={i} style={{ marginBottom: 12 }}>



            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>



              <span style={{ fontSize: 20 }}>{msg.role === "user" ? "👤" : "🤖"}</span>



              <div className={msg.role === "user" ? "ai-chat-msg-user" : "ai-chat-msg-assistant"} style={{ flex: 1 }}>



                {msg.content.includes("[FollowUpButtons]") ? (

                  <>

                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content.replace("[FollowUpButtons]", "")}</p>

                    <div style={{ 

                      display: "flex", 

                      gap: 8, 

                      marginTop: 12,

                      flexWrap: "wrap"

                    }}>

                      <button

                        onClick={() => {

                          // Find the last user question and rewrite it with follow-up

                          const lastUserMsg = chatHistory.slice(0, i).reverse().find(m => m.role === "user");

                          const originalQ = lastUserMsg?.content || "the previous topic";

                          sendMessage(`Break down ${originalQ} in more detail for me`);

                        }}

                        disabled={loading}

                        style={{

                          background: "#1a1a1a",

                          border: "1px solid #FFD700",

                          color: "#FFD700",

                          padding: "8px 16px",

                          borderRadius: 6,

                          cursor: "pointer",

                          fontSize: 13,

                          fontWeight: 500

                        }}

                      >

                        💡 Break it down more

                      </button>

                      <button

                        onClick={() => {

                          // Find the last user question and rewrite it with follow-up

                          const lastUserMsg = chatHistory.slice(0, i).reverse().find(m => m.role === "user");

                          const originalQ = lastUserMsg?.content || "the previous topic";

                          sendMessage(`Explain ${originalQ} like I'm 6 years old to me`);

                        }}

                        disabled={loading}

                        style={{

                          background: "#1a1a1a",

                          border: "1px solid #FFD700",

                          color: "#FFD700",

                          padding: "8px 16px",

                          borderRadius: 6,

                          cursor: "pointer",

                          fontSize: 13,

                          fontWeight: 500

                        }}

                      >

                        👩🏛️ Explain like I'm 6

                      </button>

                    </div>

                  </>

                ) : (

                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>

                )}



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

          className="ai-chat-input"

          style={{ flex: 1 }}

          value={message}

          onChange={(e) => setMessage(e.target.value)}

          placeholder="Ask a question..."

          onKeyPress={(e) => e.key === "Enter" && sendMessage()}

        />

        <button onClick={() => sendMessage()} disabled={loading || !message.trim()} style={{ borderColor: "#FFD700", color: "#FFD700" }}>

          Send

        </button>

      </div>



    </div>



  );



}







// StudyReminders imported from ./components/StudyReminders

function _StudyReminders_REMOVED({ reminders, setReminders, timetable, notificationPermission, setNotificationPermission, token }) {



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



            new Notification("🔔 Study Reminder", { body: r.label, icon: "/loading.png" });



          }



          setReminders((prev) => prev.map((rem) => rem.id === r.id ? { ...rem, sent: true } : rem));



        }



      });



    }, 30000);



    return () => clearInterval(interval);



  }, [reminders, notificationPermission, setReminders]);









  function addReminder() {



    if (!newReminderTime || !newReminderLabel) {



      toast.warning("Please enter both time and label");



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



            {timetableReminders.slice(0, 15).map((r, i) => {



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



                {r.sent ? "✅" : isPast ? "⏰" : "🔔"} {r.label} — {new Date(r.time).toLocaleString()}



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





// KeyManagement imported from ./components/AdminComponents

function _KeyManagement_REMOVED({ token }) {

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

      toast.error(e.message);

    }

  }



  async function deactivate(userId) {

    try {

      await api(`/keys/deactivate/${userId}`, { token, method: "POST" });

      loadStudents();

    } catch (e) {

      toast.error(e.message);

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

      <p className="muted">{students.length} students total — <strong style={{ color: "#facc15" }}>{pendingCount} pending</strong> — <strong style={{ color: "#34d399" }}>{activeCount} activated</strong></p>



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

                <th style={{ padding: "8px 6px" }}>Days Left</th>

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

                      <span style={{ color: "#f87171", fontWeight: 600 }}>? Expired</span>

                    ) : s.isActivated ? (

                      <span style={{ color: "#34d399", fontWeight: 600 }}>? Active</span>

                    ) : (

                      <span style={{ color: "#f87171", fontWeight: 600 }}>? Pending</span>

                    )}

                  </td>

                  <td style={{ padding: "8px 6px" }}>

                    {s.isExpired ? (

                      <span style={{ 

                        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))",

                        border: "1px solid rgba(239, 68, 68, 0.4)",

                        padding: "4px 8px",

                        borderRadius: 6,

                        color: "#f87171",

                        fontWeight: 700,

                        fontSize: 12

                      }}>Expired</span>

                    ) : s.daysRemaining !== null ? (

                      <span style={{ 

                        background: s.daysRemaining <= 3 

                          ? "linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.1))"

                          : s.daysRemaining <= 7

                          ? "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))"

                          : "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))",

                        border: s.daysRemaining <= 3 

                          ? "1px solid rgba(249, 115, 22, 0.4)"

                          : s.daysRemaining <= 7

                          ? "1px solid rgba(251, 191, 36, 0.4)"

                          : "1px solid rgba(34, 197, 94, 0.4)",

                        padding: "4px 8px",

                        borderRadius: 6,

                        color: s.daysRemaining <= 3 ? "#f97316" : s.daysRemaining <= 7 ? "#fbbf24" : "#4ade80",

                        fontWeight: 700,

                        fontSize: 12

                      }}>

                        {s.daysRemaining}d

                      </span>

                    ) : (

                      <span style={{ color: "#6b7280", fontSize: 11 }}>—</span>

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

                  border: selectedDuration === "week1" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.2)",

                  borderRadius: 12,

                  padding: 16,

                  cursor: "pointer",

                  background: selectedDuration === "week1" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)",

                  transition: "all 0.2s"

                }}

              >

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

                  <div>

                    <div style={{ fontWeight: 600, fontSize: 16 }}>1 Week</div>

                    <div className="muted" style={{ fontSize: 12 }}>₦700</div>

                  </div>

                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>7 days</div>

                </div>

              </div>



              <div

                onClick={() => setSelectedDuration("week2")}

                style={{

                  border: selectedDuration === "week2" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.2)",

                  borderRadius: 12,

                  padding: 16,

                  cursor: "pointer",

                  background: selectedDuration === "week2" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)",

                  transition: "all 0.2s"

                }}

              >

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

                  <div>

                    <div style={{ fontWeight: 600, fontSize: 16 }}>2 Weeks</div>

                    <div className="muted" style={{ fontSize: 12 }}>₦1,300</div>

                  </div>

                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>14 days</div>

                </div>

              </div>



              <div

                onClick={() => setSelectedDuration("month1")}

                style={{

                  border: selectedDuration === "month1" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.2)",

                  borderRadius: 12,

                  padding: 16,

                  cursor: "pointer",

                  background: selectedDuration === "month1" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)",

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

                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>30 days</div>

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



// LockedScreen imported from ./components/AdminComponents

function _LockedScreen_REMOVED({ activationKey, username, userRole, onLogout, onTryDemo, onRefresh, isChecking, onGetPremium, deferredPrompt, onInstall, isIOS }) {

  const [showActivationKey, setShowActivationKey] = useState(false);

  

  // Teachers and lecturers get auto-activated, so show simple confirmation

  const isFaculty = userRole === "TEACHER" || userRole === "LECTURER";

  

  if (isFaculty) {

    return (

      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>

        <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>

          <div style={{ fontSize: 64, marginBottom: 12 }}>📱</div>

          <h2>Account Created Successfully!</h2>

          <p className="muted" style={{ marginBottom: 24 }}>

            Welcome, <strong>{username}</strong>! Your {userRole?.toLowerCase()} account is ready to use.

          </p>

          <button onClick={onRefresh} style={{ padding: "12px 32px", background: "#FFD700", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>

            Continue to Dashboard

          </button>

        </div>

      </div>

    );

  }

  

  // Students see premium/demo options

  return (

    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "linear-gradient(135deg, rgba(255,215,0,0.05), rgba(218,165,32,0.05))" }}>

      <div style={{ maxWidth: 900, width: "100%" }}>

        {/* Install App Button - Top Right */}

        {deferredPrompt && !isIOS && (

          <div style={{ position: "absolute", top: 16, right: 16 }}>

            <button 

              onClick={onInstall}

              style={{

                padding: "10px 20px",

                background: "linear-gradient(135deg, #DAA520, #FFD700)",

                color: "#fff",

                border: "none",

                borderRadius: 8,

                cursor: "pointer",

                fontSize: 14,

                fontWeight: 600,

                display: "flex",

                alignItems: "center",

                gap: 8,

                boxShadow: "0 4px 12px rgba(218,165,32,0.3)"

              }}

            >

              <span>📱</span>

              <span>Install App</span>

            </button>

          </div>

        )}

        

        {/* iOS Install Instructions */}

        {isIOS && (

          <div style={{ position: "absolute", top: 16, right: 16 }}>

            <div style={{

              padding: "10px 16px",

              background: "rgba(218,165,32,0.1)",

              border: "1px solid rgba(218,165,32,0.3)",

              borderRadius: 8,

              fontSize: 12,

              color: "#DAA520",

              maxWidth: 200,

              textAlign: "center"

            }}>

              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install

            </div>

          </div>

        )}

        

        {/* Header */}

        <div style={{ textAlign: "center", marginBottom: 32 }}>

          <div style={{ fontSize: 72, marginBottom: 16 }}>🎮</div>

          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Welcome to Scholar's Circle!</h1>

          <p className="muted" style={{ fontSize: 16 }}>Hi <strong>{username}</strong>, choose how you want to get started</p>

        </div>



        {/* Two equal option cards */}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 24 }}>

          

          {/* Premium Card */}

          <div className="card" style={{ 

            padding: 24, 

            textAlign: "center", 

            background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(218,165,32,0.1))",

            border: "2px solid rgba(255,215,0,0.3)",

            position: "relative"

          }}>

            <div style={{ position: "absolute", top: 12, right: 12, background: "#FFD700", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>

              MOST POPULAR

            </div>

            <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Premium Access</h3>

            <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>Unlimited access to all features</p>

            

            {/* Pricing */}

            <div style={{ marginBottom: 20 }}>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 8 }}>

                <span style={{ fontSize: 36, fontWeight: 800, color: "#FFD700" }}>₦700</span>

                <span className="muted" style={{ fontSize: 14 }}>/week</span>

              </div>

              <div className="muted" style={{ fontSize: 12 }}>

                or ₦1,300/2 weeks — ₦2,400/month

              </div>

            </div>



            {/* Features */}

            <ul style={{ textAlign: "left", fontSize: 13, marginBottom: 24, lineHeight: 2, listStyle: "none", padding: 0 }}>

              <li>✅ Unlimited practice questions</li>

              <li>✅ Unlimited AI Tutor access</li>

              <li>✅ All subjects & past papers</li>

              <li>✅ Advanced analytics</li>

              <li>✅ Priority support</li>

            </ul>



            <button 

              onClick={onGetPremium}

              style={{ 

                width: "100%",

                padding: "14px 24px", 

                background: "linear-gradient(135deg, #FFD700, #DAA520)", 

                color: "#fff", 

                border: "none", 

                borderRadius: 10, 

                cursor: "pointer", 

                fontSize: 16, 

                fontWeight: 700,

                boxShadow: "0 4px 14px rgba(255,215,0,0.4)",

                transition: "transform 0.2s, box-shadow 0.2s"

              }}

              onMouseEnter={e => {

                e.currentTarget.style.transform = "translateY(-2px)";

                e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,215,0,0.5)";

              }}

              onMouseLeave={e => {

                e.currentTarget.style.transform = "translateY(0)";

                e.currentTarget.style.boxShadow = "0 4px 14px rgba(255,215,0,0.4)";

              }}

            >

              Get Premium Access

            </button>

          </div>



          {/* Free Trial Card */}

          <div className="card" style={{ 

            padding: 24, 

            textAlign: "center",

            background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))",

            border: "2px solid rgba(16,185,129,0.3)",

            position: "relative"

          }}>

            <div style={{ position: "absolute", top: 12, right: 12, background: "#10b981", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>

              FREE

            </div>

            <div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>2-Day Free Trial</h3>

            <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>Full access for 48 hours</p>

            

            {/* Daily limits */}

            <div style={{ marginBottom: 20 }}>

              <div style={{ fontSize: 36, fontWeight: 800, color: "#10b981", marginBottom: 8 }}>Free</div>

              <div className="muted" style={{ fontSize: 12 }}>

                2 days of full access

              </div>

            </div>



            {/* Features */}

            <ul style={{ textAlign: "left", fontSize: 13, marginBottom: 24, lineHeight: 2, listStyle: "none", padding: 0 }}>

              <li>✅ All practice modes</li>

              <li>✅ AI Tutor access</li>

              <li>✅ All subjects unlocked</li>

              <li>✅ No daily limits</li>

              <li>✅ Full features for 2 days</li>

            </ul>



            <button 

              onClick={onTryDemo}

              style={{ 

                width: "100%",

                padding: "14px 24px", 

                background: "linear-gradient(135deg, #10b981, #059669)", 

                color: "#fff", 

                border: "none", 

                borderRadius: 10, 

                cursor: "pointer", 

                fontSize: 16, 

                fontWeight: 700,

                boxShadow: "0 4px 14px rgba(16,185,129,0.4)",

                transition: "transform 0.2s, box-shadow 0.2s"

              }}

              onMouseEnter={e => {

                e.currentTarget.style.transform = "translateY(-2px)";

                e.currentTarget.style.boxShadow = "0 6px 20px rgba(16,185,129,0.5)";

              }}

              onMouseLeave={e => {

                e.currentTarget.style.transform = "translateY(0)";

                e.currentTarget.style.boxShadow = "0 4px 14px rgba(16,185,129,0.4)";

              }}

            >

              Start Free Trial

            </button>

          </div>

        </div>



        {/* Alternative: Activation Key (Collapsible) */}

        <div className="card" style={{ padding: 16, textAlign: "center" }}>

          <button 

            onClick={() => setShowActivationKey(!showActivationKey)}

            style={{ 

              background: "none", 

              border: "none", 

              color: "#94a3b8", 

              cursor: "pointer", 

              fontSize: 13,

              display: "flex",

              alignItems: "center",

              gap: 8,

              margin: "0 auto"

            }}

          >

            <span>{showActivationKey ? "👁️" : "👁‍👀"}</span>

            <span>Have an activation key from your teacher?</span>

          </button>

          

          {showActivationKey && (

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>

              <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>

                <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Your Activation Key</p>

                <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#facc15", letterSpacing: 2 }}>

                  {activationKey || "—"}

                </div>

                <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Share this key with your teacher to get activated</p>

              </div>

              

              <div style={{ 

                background: "rgba(255,215,0,0.1)", 

                border: "1px solid rgba(255,215,0,0.3)", 

                borderRadius: 8, 

                padding: 10, 

                marginBottom: 12,

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                gap: 8

              }}>

                <span style={{ 

                  display: "inline-block",

                  width: 6,

                  height: 6,

                  borderRadius: "50%",

                  background: isChecking ? "#FFD700" : "#22c55e",

                  animation: isChecking ? "pulse 1s infinite" : "none"

                }}></span>

                <span style={{ fontSize: 11, color: isChecking ? "#FFD700" : "#22c55e" }}>

                  {isChecking ? "Checking..." : "Auto-checking every 10s"}

                </span>

              </div>

              

              <button 

                onClick={onRefresh} 

                disabled={isChecking} 

                style={{ 

                  padding: "8px 20px", 

                  background: "#FFD700", 

                  color: "#fff", 

                  border: "none", 

                  borderRadius: 6, 

                  cursor: isChecking ? "wait" : "pointer", 

                  opacity: isChecking ? 0.7 : 1,

                  fontSize: 13

                }}

              >

                {isChecking ? "Checking..." : "Check Activation Now"}

              </button>

            </div>

          )}

        </div>



        {/* Logout */}

        <div style={{ textAlign: "center", marginTop: 16 }}>

          <button onClick={onLogout} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>

            Log Out

          </button>

        </div>

      </div>

    </div>

  );

}

// Wrap App with Context providers
function AppWithProviders() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <UserDataProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </UserDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default AppWithProviders;


