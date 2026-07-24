import { useEffect, useMemo, useState, useRef, useCallback, lazy, Suspense } from "react";
import { lazyWithRetry } from "./lib/lazyWithRetry.js";

import { useLocation, Link } from "react-router-dom";

import { useToast } from "./components/Toast";


import {
  Home as HomeIcon, BookOpen, Bot, BarChart3, Search, Menu, X,
  School, Users, MessageCircle, Calendar, Bell, Timer,
  CalendarDays, User, Settings, Gem, FileText, Laptop,
  Megaphone, KeyRound, Mail, Cog, GraduationCap, Building2,
  Download, Moon, Sun, Sparkles, ClipboardList, UserCircle, Mic,
  ChevronLeft,
} from "lucide-react";



import { COINS_PER_SESSION, SUBJECTS, XP_PER_CORRECT, STREAK_BONUS, MODE_MULTIPLIERS } from "./data";



import { supabase } from "./lib/supabaseClient.js";



import { callAI } from "./lib/aiClient";



const TeacherQuestionManager = lazyWithRetry(() => import("./features/TeacherQuestionManager.jsx"));
const DepartmentManager = lazyWithRetry(() => import("./components/teacher/DepartmentManager.jsx"));

const DepartmentSwitcher = lazyWithRetry(() => import("./components/learn/DepartmentSwitcher.jsx"));
import { getDepartments, getUserDepartment } from "./lib/departments.js";

import NotificationBell from "./features/NotificationBellImproved.jsx";

const NotificationsTab = lazyWithRetry(() => import("./features/NotificationsTab.jsx"));

import { InstallPrompt } from "./features/InstallPrompt.jsx";

// Context providers + hooks
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { UserDataProvider, useUserData } from "./contexts/UserDataContext";
import { UIProvider, useUI } from "./contexts/UIContext";

// Page components (lazy loaded for code splitting)
const Home = lazyWithRetry(() => import("./pages/Home"));
const AITutorPage = lazyWithRetry(() => import("./pages/AITutor"));
const VoiceTutorPage = lazyWithRetry(() => import("./features/voice-tutor/VoiceTutor.jsx"));
const Progress = lazyWithRetry(() => import("./pages/Progress"));
const Resources = lazyWithRetry(() => import("./pages/Resources"));
const ClassroomPage = lazyWithRetry(() => import("./pages/Classroom"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));

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
import {
  ConfettiOverlay, CelebrationToast, StreakLossWarning,
  StudyHeatmap, LeagueProgress,
} from "./components/Celebrations";
import {
  CommandPalette, BulkImport, AIQuestionGen,
} from "./components/SmallComponents";
const SessionPlayer = lazyWithRetry(() => import("./components/SessionPlayer"));
const TimetableBuilder = lazyWithRetry(() => import("./components/StudyTools").then(m => ({ default: m.TimetableBuilder })));
const DiscussionBoard = lazyWithRetry(() => import("./components/Discussion").then(m => ({ default: m.DiscussionBoard })));
const StudyReminders = lazyWithRetry(() => import("./components/StudyReminders").then(m => ({ default: m.StudyReminders })));
import { KeyManagement, LockedScreen } from "./components/AdminComponents";



// DemoLockedOverlay imported from ./components/DemoLockedOverlay



// GlobalSearchDropdown imported from ./components/GlobalSearchDropdown



const LectureToNotes = lazyWithRetry(() => import("./features/LectureToNotes").then(m => ({ default: m.LectureToNotes })));

import { AchievementNotification } from "./features/AchievementNotification";

const StudyGroups = lazyWithRetry(() => import("./features/StudyGroups").then(m => ({ default: m.StudyGroups })));



const GamificationHub = lazyWithRetry(() => import("./features/Gamification"));
const ResearchHub = lazyWithRetry(() => import("./features/research-hub/ResearchHub"));

const ResourceViewer = lazyWithRetry(() => import("./features/ResourceViewer"));
const TeacherResourcesHub = lazyWithRetry(() => import("./features/TeacherResourcesHub"));
const AdminDashboard = lazyWithRetry(() => import("./features/AdminDashboard"));
const Lecturers = lazyWithRetry(() => import("./features/Lecturers/index.jsx"));
const CampusComm = lazyWithRetry(() => import("./features/CampusComm.jsx"));



import { ExamSimulator, selectAdaptiveQuestions, calculateSessionAnalytics, PostSessionInsights } from "./features/EnhancedSession";



import { OnboardingWizard, isOnboarded, markOnboarded } from "./features/Onboarding";



const AITutor = lazyWithRetry(() => import("./features/AITutor/index.jsx"));



import { useStudentProfile } from "./features/StudentProfile.jsx";



const TeacherInvitesPanel = lazyWithRetry(() => import("./features/TeacherInvites.jsx").then(m => ({ default: m.TeacherInvitesPanel })));



const LiveSessionsPanel = lazyWithRetry(() => import("./features/LiveSessions/LiveSessionsPanel.jsx").then(m => ({ default: m.LiveSessionsPanel })));



const ClassroomAssignmentsPanel = lazyWithRetry(() => import("./features/ClassroomAssignments/ClassroomAssignmentsPanel.jsx").then(m => ({ default: m.ClassroomAssignmentsPanel })));



const AttendancePanel = lazyWithRetry(() => import("./features/LiveSessions/AttendancePanel.jsx").then(m => ({ default: m.AttendancePanel })));



const NotificationSettings = lazyWithRetry(() => import("./features/NotificationCenter.jsx").then(m => ({ default: m.NotificationSettings })));



const PremiumPage = lazyWithRetry(() => import("./features/PremiumPage.jsx"));

const ClinicalCases = lazyWithRetry(() => import("./features/clinicalCases/ClinicalCases.jsx"));
const OSCEPrep = lazyWithRetry(() => import("./features/osce/OSCEPrep.jsx"));
const DrugReference = lazyWithRetry(() => import("./features/drugReference/DrugReference.jsx"));
const LabValues = lazyWithRetry(() => import("./features/labValues/LabValues.jsx"));
const MedicalCalculators = lazyWithRetry(() => import("./features/medicalCalculators/MedicalCalculators.jsx"));
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_2c321f6a4471b672ee716506912ede6f6f99d8cd";









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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    const handleOpenResearchHub = (e) => {
      if (e.detail) window.__sc_pending_hub_tab = e.detail;
      setTab("research-hub");
    };
    window.addEventListener("sc-open-research-hub", handleOpenResearchHub);
    return () => window.removeEventListener("sc-open-research-hub", handleOpenResearchHub);
  }, []);



  // Refs for signup form to avoid stale closure issues

  const signupEmailRef = useRef("");

  const signupFullNameRef = useRef("");

  const signupPasswordRef = useRef("");

  const signupConfirmPasswordRef = useRef("");

  const signupRoleRef = useRef("STUDENT");

  const signupInviteCodeRef = useRef("");



  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");



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


  const [resourcesSubTab, setResourcesSubTab] = useState("notes");

  const [aiTutorSubTab, setAiTutorSubTab] = useState("chat");

  const [voiceTutorResourceId, setVoiceTutorResourceId] = useState(null);

  const [voiceSessionActive, setVoiceSessionActive] = useState(false);

  const [isIOS, setIsIOS] = useState(false);

  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

  const [showIOSInstall, setShowIOSInstall] = useState(false);

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



  const { profile: studentProfile, update: updateStudentProfile } = useStudentProfile(auth.user?.id);



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
  useEffect(() => { ctxUI.setResourcesSubTab(resourcesSubTab); }, [resourcesSubTab]);
  useEffect(() => { ctxUI.setAiTutorSubTab(aiTutorSubTab); }, [aiTutorSubTab]);
  useEffect(() => { ctxUI.setAiConfig(aiConfig); }, [aiConfig]);
  // --- End context sync ---

  useEffect(() => {
    function openVoiceTutor(e) {
      const resourceId = e.detail?.resourceId || null;
      setVoiceTutorResourceId(resourceId);
      setTab("voice-tutor");
    }
    window.addEventListener("sc-open-voice-tutor", openVoiceTutor);
    return () => window.removeEventListener("sc-open-voice-tutor", openVoiceTutor);
  }, [setTab]);







  function buildPaletteActions() {



    return [



      { label: "Go to Dashboard", run: () => setTab("dashboard") },



      { label: "Go to Research Hub", run: () => setTab("research-hub") },



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



    // Step 1: Restore auth from Supabase session (replaces localStorage-based restore)
    async function restoreSession() {

      try {

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {

          setToken(session.access_token);

          // Fetch app profile from backend
          try {

            const profile = await api("/auth/refresh", { token: session.access_token });

            if (profile?.user) {

              setAuth((a) => ({ ...a, user: profile.user, error: "", info: "" }));

              const uid = profile.user.id || profile.user.email;

              if (uid) localStorage.setItem("scholars-circle-current-user", uid);

            }

          } catch (profileErr) {

            console.error("[restoreSession] Failed to fetch profile:", profileErr);

            // If profile not found, try to create it (e.g. partial signup)
            if (profileErr.message?.includes("profile") || profileErr.message?.includes("not found") || profileErr.message?.includes("403")) {
              try {
                const user = (await supabase.auth.getUser()).data?.user;
                const fullName = user?.user_metadata?.fullName || "";
                const role = user?.user_metadata?.role || "STUDENT";
                const profile = await api("/auth/profile", {
                  token: session.access_token,
                  method: "POST",
                  body: { fullName, role },
                });
                if (profile) {
                  setAuth((a) => ({ ...a, user: profile, error: "", info: "" }));
                  const uid = profile.id || profile.email;
                  if (uid) localStorage.setItem("scholars-circle-current-user", uid);
                }
              } catch (createErr) {
                console.error("[restoreSession] Failed to create missing profile:", createErr);
                setAuth((a) => ({ ...a, info: "Please complete your profile to continue.", error: "" }));
              }
            }

          }

        }

      } catch (err) {

        console.error("[restoreSession] Session restore error:", err);

      }

    }

    // Fire session restore (async, don't block boot)
    restoreSession();



    // Step 2: Load user-specific data using user ID from localStorage (fallback)
    const uid = (() => {

      try { const u = JSON.parse(localStorage.getItem("scholars-circle-auth"))?.authUser; return u?.id || u?.username; } catch { return null; }

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



  // Detect Supabase PASSWORD_RECOVERY event (user clicked reset link in email)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setResetPasswordMode(true);
      }
    });
    return () => data?.subscription?.unsubscribe();
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
    else if (["learn", "bank", "practice", "pastpapers", "studypaths", "practicehints"].includes(tab)) { setTab("research-hub"); }
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



    // Trim spaces from inputs — login uses email now (username dropped)

    const trimmedEmail = (auth.email || auth.username || "").trim();

    const trimmedPassword = (auth.password || "").trim();



    try {



      // Sign in with Supabase Auth

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({

        email: trimmedEmail,

        password: trimmedPassword,

      });



      if (authError) throw authError;



      // Pause sync to prevent the save effect from pushing empty/stale state to backend

      syncPausedRef.current = true;



      const sessionToken = authData.session?.access_token || "";

      setToken(sessionToken);



      // Fetch app profile from backend

      let appUser = null;

      try {

        const profile = await api("/auth/refresh", { token: sessionToken });

        appUser = profile?.user || null;

      } catch (profileErr) {

        console.error("[login] Failed to fetch app profile:", profileErr);

        // If profile doesn't exist yet (e.g. partial signup), try to create it
        if (profileErr.message?.includes("profile") || profileErr.message?.includes("not found") || profileErr.message?.includes("403")) {
          try {
            const user = (await supabase.auth.getUser()).data?.user;
            const fullName = user?.user_metadata?.fullName || "";
            const role = user?.user_metadata?.role || "STUDENT";
            const profile = await api("/auth/profile", {
              token: sessionToken,
              method: "POST",
              body: { fullName, role },
            });
            appUser = profile;
          } catch (createErr) {
            console.error("[login] Failed to create missing profile:", createErr);
          }
        }

      }



      setAuth((a) => ({ ...a, email: "", username: "", password: "", user: appUser, error: "", info: "" }));



      // Reset demo mode on successful login

      setDemoMode(false);



      // Clear previous user's localStorage keys (state reset happens when backend data loads)

      const prevUid = localStorage.getItem("scholars-circle-current-user") || "guest";

      Object.keys(localStorage).forEach(k => {

        if (k.includes(`::${prevUid}`) || k.startsWith("sc_")) {

          localStorage.removeItem(k);

        }

      });



      // Store new user identity

      if (appUser) {

        localStorage.setItem("scholars-circle-auth", JSON.stringify({ authUser: appUser, authToken: sessionToken }));

        localStorage.setItem("scholars-circle-current-user", appUser.id || appUser.email);

      }



      // Load data from backend (source of truth) then resume sync

      try {

        await loadFromBackend(sessionToken);

      } finally {

        syncPausedRef.current = false;

      }



      setLoadingOverlay(false);



      return;



    } catch (loginErr) {



      // Check if this is a demo user (fallback for offline/demo mode)

      const hit = DEMO_USERS.find((u) => u.username === trimmedEmail && u.password === trimmedPassword);



      if (!hit) {

        const errMsg = loginErr?.message || "Invalid credentials. Please check your email and password.";

        setAuth((a) => ({ ...a, error: errMsg, info: "" }));

        setLoadingOverlay(false);

        return;

      }



      setAuth((a) => ({ ...a, email: "", username: "", password: "", user: { username: hit.username, role: hit.role, isActivated: hit.isActivated }, error: "", info: "" }));



      // Enable demo mode for demo users so their usage data persists

      setDemoMode(true);



      setLoadingOverlay(false);



    }



  }



  async function handleForgotPassword() {
    const email = (auth.email || "").trim();
    if (!email) {
      setAuth((a) => ({ ...a, error: "Please enter your email address first.", info: "" }));
      return;
    }
    setLoadingOverlay(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setAuth((a) => ({
        ...a,
        error: "",
        info: "Password reset link sent! Check your email to reset your password.",
      }));
    } catch (err) {
      setAuth((a) => ({ ...a, error: err.message || "Failed to send reset email.", info: "" }));
    } finally {
      setLoadingOverlay(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      setAuth((a) => ({ ...a, error: "Password must be at least 8 characters.", info: "" }));
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setAuth((a) => ({ ...a, error: "Passwords do not match.", info: "" }));
      return;
    }
    setLoadingOverlay(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setAuth((a) => ({
        ...a,
        error: "",
        info: "Password updated successfully! You can now sign in with your new password.",
      }));
      setResetPasswordMode(false);
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err) {
      setAuth((a) => ({ ...a, error: err.message || "Failed to update password.", info: "" }));
    } finally {
      setLoadingOverlay(false);
    }
  }



  async function signup() {



    setLoadingOverlay(true);



    try {



      setAuth((a) => ({ ...a, error: "", info: "" }));



      const email = (signupEmailRef.current?.value || "").trim();

      const fullName = (signupFullNameRef.current?.value || "").trim();

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

      // 1. Sign up with Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { fullName, role },
        },
      });

      if (signUpError) throw signUpError;

      // 2. Create app profile on backend (invite codes, activation keys)
      const sessionToken = signUpData.session?.access_token || "";
      let appUser = null;

      if (sessionToken) {
        try {
          const profile = await api("/auth/profile", {
            token: sessionToken,
            method: "POST",
            body: {
              fullName,
              role,
              inviteCode: (role === "TEACHER" || role === "LECTURER") ? inviteCode : undefined,
            },
          });
          appUser = profile;
        } catch (profileErr) {
          console.error("Profile creation failed:", profileErr);
          try {
            const existing = await api("/auth/refresh", { token: sessionToken });
            appUser = existing?.user || null;
          } catch {
            // Continue without profile
          }
        }
      } else {
        // Email confirmation required — no session yet
        setAuth((a) => ({
          ...a,
          mode: "login",
          error: "",
          info: "Account created! Please check your email to confirm your account, then sign in.",
          email: email,
        }));
        setLoadingOverlay(false);
        return;
      }

      // 3. Auto-login (session is already active from Supabase signUp)
      setToken(sessionToken);



      setAuth((a) => ({



        ...a,



        mode: "login",



        email: "",



        username: "",



        password: "",



        signupRole: "STUDENT",



        inviteCode: "",



        user: appUser,



        error: "",



        info: "Account created successfully.",



      }));



      // Clear ALL localStorage to prevent inheriting demo data

      localStorage.clear();



      // Set only the essential auth data

      if (appUser) {

        localStorage.setItem("scholars-circle-auth", JSON.stringify({ authUser: appUser, authToken: sessionToken }));

        localStorage.setItem("scholars-circle-current-user", appUser.id || appUser.email);

      }



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

    } catch (e) {

      console.error("Registration error:", e);

      let errorMessage = e.message || "Sign up failed. Please try again.";

      // Supabase auth errors
      if (e.message?.includes("already registered") || e.message?.includes("already been registered")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      }
      // Network errors — server unreachable
      else if (e.message === "Failed to fetch" || e.message?.includes("NetworkError") || e.message?.includes("network")) {
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

  function handleXpUpdate(xpGained) {
    if (xpGained > 0) {
      setStats((s) => ({ ...s, xp: s.xp + xpGained }));
    }
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

    // 0. Sign out from Supabase (clears session, invalidates token)
    supabase.auth.signOut().catch((err) => console.error("[logout] Supabase signOut error:", err));

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

    // Get fresh token from Supabase session (auto-refreshed by Supabase SDK)
    const { data: { session } } = await supabase.auth.getSession();
    const currentToken = session?.access_token;

    if (!currentToken) {

      console.log("[refreshAuth] No Supabase session, skipping");

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

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      window.__deferredPrompt = null;
    };
    window.addEventListener('appinstalled', onInstalled);

    const onDismissed = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    };
    window.addEventListener('pwa-install-dismissed', onDismissed);

    return () => {

      console.log('Removing beforeinstallprompt listener');

      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('pwa-install-dismissed', onDismissed);

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

    window.__deferredPrompt = null;

    window.dispatchEvent(new CustomEvent('pwa-install-dismissed'));

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

              {resetPasswordMode ? (
                <>
                  <div style={{ marginBottom: 28 }}>
                    <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>Set new password</h1>
                    <p style={{ color: '#9AA3B5', fontSize: '0.94rem' }}>Enter your new password below.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>New password</label>
                      <input
                        className="auth-input"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        autoComplete="new-password"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword(); }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Confirm new password</label>
                      <input
                        className="auth-input"
                        type="password"
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword(); }}
                      />
                    </div>
                    <button onClick={handleResetPassword} disabled={loadingOverlay} className="auth-btn auth-btn-primary auth-btn-lg" style={{ width: '100%', opacity: loadingOverlay ? 0.6 : 1, cursor: loadingOverlay ? 'not-allowed' : 'pointer' }}>
                      {loadingOverlay ? 'Updating...' : 'Update password ->'}
                    </button>
                    <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.88rem', color: '#9AA3B5' }}>
                      <span onClick={() => { setResetPasswordMode(false); setAuth((a) => ({ ...a, mode: 'login', error: '', info: '' })); }} style={{ color: '#F5A623', fontWeight: 700, cursor: 'pointer' }}>Back to sign in</span>
                    </p>
                  </div>
                </>
              ) : (
              <>
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
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Email</label>
                      <input
                        className="auth-input"
                        value={auth.email}
                        onChange={(e) => setAuth((a) => ({ ...a, email: e.target.value.replace(/\s/g, '') }))}
                        placeholder="you@email.com"
                        autoComplete="email"
                        type="email"
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

                    <div style={{ textAlign: 'right', marginTop: -4 }}>
                      <span
                        onClick={handleForgotPassword}
                        style={{ color: '#F5A623', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Forgot password?
                      </span>
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

                  <button
                    className="auth-btn auth-btn-ghost"
                    style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: '0.9rem' }}
                    onClick={async () => {
                      const { error: oauthError } = await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: window.location.origin },
                      });
                      if (oauthError) {
                        setAuth((a) => ({ ...a, error: oauthError.message, info: "" }));
                      }
                    }}
                  >
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

          <Suspense fallback={<div className="card"><p className="muted">Loading session...</p></div>}>
          <SessionPlayer

            session={activeSession}

            aiConfig={aiConfig}

            onExit={() => setActiveSession(null)}

            onComplete={(result) => {

              updateLearningModels(result.results);

              completeSession(result, activeSession.source);

            }}

          />
          </Suspense>

        )}



      </main>



    );



  }





  return (

    <main className={`${darkMode ? "app dark" : "app light"} theme-${themePack}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>

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



            // Sync onboarding data to student profile

            if (data.isUniStudent !== undefined || data.institution) {

              updateStudentProfile({

                isUniversityStudent: data.isUniStudent,

                institution: data.institution || "",

                universityId: data.universityId || null,

              });

            }



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
                      onClick={async () => {
                        const plan = { week1: { label: "1 Week", price: 700 }, week2: { label: "2 Weeks", price: 1300 }, month1: { label: "1 Month", price: 2400 } }[selectedPlan];
                        const rawEmail = auth.user?.email || auth.user?.username || "";
                        const payEmail = rawEmail.includes("@") ? rawEmail : `${rawEmail || "user"}@scholars-circle.app`;
                        try {
                          const { default: PaystackPop } = await import("@paystack/inline-js");
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

            {!isInstalled && !isIOS && deferredPrompt && (

              <button className="header-btn" onClick={handleInstallClick}>

                <span className="btn-icon"><Download size={16} /></span>

                <span className="btn-label">Install</span>

              </button>

            )}

            {!isInstalled && isIOS && (

              <button className="header-btn" onClick={() => setShowIOSInstall(true)}>

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

      {!(tab === "voice-tutor" && voiceSessionActive) && (
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

          className={tab === "voice-tutor" ? "active" : ""}

          onClick={() => setTab("voice-tutor")}

          title="Voice Tutor"

        >

          <Mic size={20} className="nav-icon" />

          <span className="nav-label">Voice</span>

        </button>

        <button

          className={["research-hub", "resources"].includes(tab) ? "active" : ""}

          onClick={() => setTab("research-hub")}

          title="My Circle"

        >

          <Search size={20} className="nav-icon" />

          <span className="nav-label">Circle</span>

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

          className={`more-btn ${["settings", "flashcards", "notes", "timetable", "studygroups", "discuss", "cheatsheet", "outline", "classroom", "profile", "lecturers", "notifications", "premium", "teacher-questions", "campus-comm", "voice-tutor", ...(isTeacher ? ["keys", "invites", "admin"] : [])].includes(tab) ? "has-active" : ""}`}

          onClick={() => setShowMobileMenu(!showMobileMenu)}

          title="More"

        >

          <span className="nav-icon">{showMobileMenu ? <X size={20} /> : <Menu size={20} />}</span>

          <span className="nav-label">More</span>

        </button>

      </nav>
      )}



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



            {/* Section: Medical Tools */}

            <div className="mobile-menu-section-label"><span style={{ fontSize: 14 }}>🩺</span> Medical Tools</div>

            <div className="mobile-menu-grid">

              <button className={tab === "clinical-cases" ? "active" : ""} onClick={() => { setTab("clinical-cases"); setShowMobileMenu(false); }}>

                🩺 Clinical Cases

              </button>

              <button className={tab === "osce" ? "active" : ""} onClick={() => { setTab("osce"); setShowMobileMenu(false); }}>

                🏥 OSCE Prep

              </button>

              <button className={tab === "drug-ref" ? "active" : ""} onClick={() => { setTab("drug-ref"); setShowMobileMenu(false); }}>

                💊 Drug Reference

              </button>

              <button className={tab === "lab-values" ? "active" : ""} onClick={() => { setTab("lab-values"); setShowMobileMenu(false); }}>

                🧪 Lab Values

              </button>

              <button className={tab === "medical-calculators" ? "active" : ""} onClick={() => { setTab("medical-calculators"); setShowMobileMenu(false); }}>

                🧮 Med Calculators

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

                <CalendarDays size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Schedule

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



      {/* Desktop Sidebar Navigation */}

      <aside className={`app-sidebar${sidebarCollapsed ? " collapsed" : ""}`}>

        <button className="app-sidebar-toggle" onClick={() => setSidebarCollapsed(v => !v)}>

          <ChevronLeft size={18} />

        </button>

        <div className="app-sidebar-scroll">

          <div className="app-sidebar-section">

            <span className="app-sidebar-label">Main</span>

            {[

              ["today", "Home", HomeIcon],


              ["aitutor", "AI Tutor", Bot],

              ["voice-tutor", "Voice Tutor", Mic],

            ].filter(([id]) => !demoMode || !["classroom"].includes(id)).map(([id, label, Icon]) => (

              <button

                key={id}

                className={`app-sidebar-item ${["today", "dashboard"].includes(tab) && id === "today" ? "active" : tab === id ? "active" : ""}`}

                onClick={() => setTab(id)}

              >

                <Icon size={18} className="app-sidebar-icon" />

                <span className="app-sidebar-text">{label}</span>

              </button>

            ))}

          </div>

          <div className="app-sidebar-section">

            <span className="app-sidebar-label">Workspace</span>

            {[

              ["analytics", "Progress", BarChart3],

              ["classroom", "Classroom", School],

              ["resources", "Resources", BookOpen],

              ["research-hub", "My Circle", Search],

            ].filter(([id]) => !demoMode || !["classroom"].includes(id)).map(([id, label, Icon]) => (

              <button

                key={id}

                className={`app-sidebar-item ${tab === id ? "active" : ""}`}

                onClick={() => setTab(id)}

              >

                <Icon size={18} className="app-sidebar-icon" />

                <span className="app-sidebar-text">{label}</span>

              </button>

            ))}

          </div>

          <div className="app-sidebar-section">

            <span className="app-sidebar-label">Community</span>

            {[

              ["studygroups", "Groups", Users],

              ["discuss", "Discussion", MessageCircle],

              ["timetable", "Schedule", CalendarDays],

            ].map(([id, label, Icon]) => (

              <button

                key={id}

                className={`app-sidebar-item ${tab === id ? "active" : ""}`}

                onClick={() => setTab(id)}

              >

                <Icon size={18} className="app-sidebar-icon" />

                <span className="app-sidebar-text">{label}</span>

              </button>

            ))}

          </div>

          <div className="app-sidebar-section">

            <span className="app-sidebar-label">Account</span>

            {[

              ["settings", "Settings", Settings],

              ...(!isFaculty ? [["premium", "Premium", Gem]] : []),

            ].map(([id, label, Icon]) => (

              <button

                key={id}

                className={`app-sidebar-item ${tab === id ? "active" : ""}${id === "premium" ? " app-sidebar-premium" : ""}`}

                onClick={() => setTab(id)}

              >

                <Icon size={18} className="app-sidebar-icon" />

                <span className="app-sidebar-text">{label}</span>

              </button>

            ))}

          </div>

          {isFaculty && (

            <div className="app-sidebar-section">

              <span className="app-sidebar-label">Faculty</span>

              {[

                ["teacher-questions", "My Questions", FileText],

                ["teacher-resources", "Teacher Resources", Laptop],

                ["campus-comm", "Announcements", Megaphone],

                ["departments", "Departments", Building2],

                ...(isTeacher ? [["keys", "Keys", KeyRound], ["invites", "Invites", Mail], ["admin", "Admin", Cog]] : []),

              ].map(([id, label, Icon]) => (

                <button

                  key={id}

                  className={`app-sidebar-item ${tab === id ? "active" : ""}`}

                  onClick={() => setTab(id)}

                >

                  <Icon size={18} className="app-sidebar-icon" />

                  <span className="app-sidebar-text">{label}</span>

                </button>

              ))}

            </div>

          )}

        </div>

      </aside>



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

          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
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
          </Suspense>

        )

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
          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
          <StudyGroups stats={stats} username={auth.user?.username || "Student"} subjects={subjects} />
          </Suspense>
        )

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



            <button className="btn-neon-blue" onClick={() => setTab("research-hub")}>Browse Resources</button>



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






      {showDeptSwitcher && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
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
        </Suspense>
      )}



      {tab === "keys" && isTeacher && (

        <KeyManagement token={token} />

      )}



      {tab === "invites" && isTeacher && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <TeacherInvitesPanel token={token} />
        </Suspense>
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
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <TeacherQuestionManager
          token={token}
          subjects={subjects}
          onSubjectsRefresh={() => token && loadUserDataFromBackend(token)}
        />
        </Suspense>
      )}

      {tab === "departments" && isTeacher && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <DepartmentManager />
        </Suspense>
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
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <PremiumPage
          user={auth.user}
          token={token}
          isActivated={isActivated}
          onActivated={() => refreshAuth()}
        />
        </Suspense>
      )}

      {tab === "clinical-cases" && (
        <ErrorBoundary>
          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
            <ClinicalCases />
          </Suspense>
        </ErrorBoundary>
      )}

      {tab === "osce" && (
        <ErrorBoundary>
          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
            <OSCEPrep />
          </Suspense>
        </ErrorBoundary>
      )}

      {tab === "drug-ref" && (
        <ErrorBoundary>
          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
            <DrugReference />
          </Suspense>
        </ErrorBoundary>
      )}

      {tab === "lab-values" && (
        <ErrorBoundary>
          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
            <LabValues />
          </Suspense>
        </ErrorBoundary>
      )}

      {tab === "medical-calculators" && (
        <ErrorBoundary>
          <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
            <MedicalCalculators />
          </Suspense>
        </ErrorBoundary>
      )}

      {tab === "research-hub" && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <ResearchHub onBack={() => setTab("today")} streak={stats.streak} onStreakUpdate={handleStreakUpdate} onXpUpdate={handleXpUpdate} activeSemester={activeSemester} />
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
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <NotificationSettings token={token} />
        </Suspense>

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

      {tab === "voice-tutor" && (
        <ErrorBoundary>
                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <VoiceTutorPage
          preselectedResourceId={voiceTutorResourceId}
          onExit={() => { setVoiceTutorResourceId(null); setTab("today"); }}
          onSessionActiveChange={setVoiceSessionActive}
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
            <Suspense fallback={<div className="card"><p className="muted">Loading AI Tutor...</p></div>}>
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
            </Suspense>
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

                <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
                <LectureToNotes
                  subjects={subjects}
                  aiConfig={aiConfig}
                  onImportQuestions={(rows) => setCustomQuestions((p) => [...p, ...rows])}
                  demoMode={demoMode}
                  demoUsage={demoUsage}
                  setDemoUsage={setDemoUsage}
                />
                </Suspense>

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
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <NotificationsTab
          token={token}
          currentUser={auth.user}
        />
        </Suspense>
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





















      {tab === "timetable" && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <TimetableBuilder timetable={timetable} setTimetable={setTimetable} subjects={subjects} />
        </Suspense>
      )}

      {tab === "timetable" && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <StudyReminders reminders={reminders} setReminders={setReminders} timetable={timetable} notificationPermission={notificationPermission} setNotificationPermission={setNotificationPermission} token={token} />
        </Suspense>
      )}






      {tab === "discuss" && (
        <Suspense fallback={<div className="card"><p className="muted">Loading...</p></div>}>
        <DiscussionBoard subjects={subjects} discussion={discussion} setDiscussion={setDiscussion} username={auth.user.username} isTeacher={isFaculty} />
        </Suspense>
      )}



      {showPalette && (



        <CommandPalette



          query={paletteQuery}



          setQuery={setPaletteQuery}



          onClose={() => setShowPalette(false)}



          actions={buildPaletteActions()}



        />



      )}



      {showIOSInstall && (
        <div onClick={() => setShowIOSInstall(false)} style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#1a1d29", borderRadius: 16, padding: 24, maxWidth: 380, width: "100%",
            border: "1px solid rgba(255,215,0,0.3)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <img src="/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: 12 }} />
            </div>
            <h3 style={{ textAlign: "center", fontSize: 18, fontWeight: 700, margin: "0 0 12px 0" }}>
              Install Scholar's Circle
            </h3>
            <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", margin: "0 0 20px 0" }}>
              Add the app to your Home Screen for the best experience.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>1</span>
                <span style={{ fontSize: 13 }}>Tap the <b>Share</b> button at the bottom of Safari</span>
                <span style={{ fontSize: 22 }}>⬆️</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>2</span>
                <span style={{ fontSize: 13 }}>Scroll down and tap <b>"Add to Home Screen"</b></span>
                <span style={{ fontSize: 22 }}>➕</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>3</span>
                <span style={{ fontSize: 13 }}>Tap <b>"Add"</b> — that's it!</span>
                <span style={{ fontSize: 22 }}>✅</span>
              </div>
            </div>
            <button onClick={() => setShowIOSInstall(false)} style={{
              marginTop: 20, width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #FFD700, #DAA520)", color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              Got it
            </button>
          </div>
        </div>
      )}

      <InstallPrompt />

    </main>



  );



}







// CommandPalette imported from ./components/SmallComponents








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


