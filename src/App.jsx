import { useEffect, useMemo, useState, useRef, useCallback, lazy, Suspense } from "react";

import { useLocation } from "react-router-dom";

import { useToast } from "./components/Toast";

import DOMPurify from "dompurify";



import { COINS_PER_SESSION, SUBJECTS, XP_PER_CORRECT, STREAK_BONUS, MODE_MULTIPLIERS } from "./data";



import { createClient } from "@supabase/supabase-js";



import { callAI } from "./lib/aiClient";



import TeacherQuestionManager from "./features/TeacherQuestionManager.jsx";
import DepartmentManager from "./components/teacher/DepartmentManager.jsx";

import LearnHub from "./features/LearnHub.jsx";
import DepartmentSwitcher from "./components/learn/DepartmentSwitcher.jsx";
import { getDepartments, getUserDepartment } from "./lib/departments.js";

import CampusComm from "./features/CampusComm.jsx";

import NotificationBell from "./features/NotificationBellImproved.jsx";

import NotificationsTab from "./features/NotificationsTab.jsx";



// Context providers
import { AuthProvider } from "./contexts/AuthContext";
import { UserDataProvider } from "./contexts/UserDataContext";
import { UIProvider } from "./contexts/UIContext";

// Page components
import Home from "./pages/Home";
import Learn from "./pages/Learn";
import AITutorPage from "./pages/AITutor";
import Progress from "./pages/Progress";
import Resources from "./pages/Resources";
import ClassroomPage from "./pages/Classroom";
import Profile from "./pages/Profile";

// Components
import { ErrorBoundary } from "./components/ErrorBoundary";



const NOTES_KEY = "sc_user_notes_v1";

const CUSTOM_QUESTIONS_KEY = "sc_custom_questions_v1";

const AI_DOCS_KEY = "sc_ai_study_assistant_v1";

const LECTURE_NOTES_KEY = "sc_lecture_notes_v1";



function loadFromStorage(key) {

  try {

    const raw = localStorage.getItem(key);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];

  } catch {

    return [];

  }

}



function DemoLockedOverlay({ title, description, icon = "🔒", features = [], showPlans = false }) {

  const [selectedPlan, setSelectedPlan] = useState(null);



  const plans = [

    { id: "week1", name: "1 Week Plan", price: "₦700", savings: "Perfect for trying out" },

    { id: "week2", name: "2 Weeks Plan", price: "₦1,300", savings: "Save ₦100" },

    { id: "month1", name: "1 Month Plan", price: "₦2,400", savings: "Save ₦400", highlight: true },

  ];



  const bankDetails = {

    bank: "Opay",

    accountNumber: "9069372522",

    accountName: "Zibiri-David Delight Aluaye",

  };



  return (

    <div className="card" style={{ textAlign: "center", padding: "32px 24px", maxWidth: 500, margin: "0 auto", background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)" }}>

      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>

      <h2 style={{ margin: "0 0 8px 0", fontSize: 20, color: "var(--text-primary, #f1f5f9)" }}>⭐ Premium Feature</h2>

      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "var(--text-primary, #f1f5f9)" }}>{title}</h3>

      <p style={{ marginBottom: 20, lineHeight: 1.5, fontSize: 13, color: "var(--text-secondary, #cbd5e1)" }}>{description}</p>



      {features.length > 0 && (

        <div style={{ background: "var(--success-bg, rgba(45,212,160,0.1))", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "left", border: "1px solid var(--success-border, rgba(45,212,160,0.3))" }}>

          <strong style={{ color: "var(--success-text, #2dd4a0)", display: "block", marginBottom: 10, fontSize: 13 }}>✨ What you'll unlock:</strong>

          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 12, color: "var(--text-primary, #f1f5f9)" }}>

            {features.map((f, i) => <li key={i}>{f}</li>)}

          </ul>

        </div>

      )}



      {showPlans && (

        <div style={{ marginBottom: 20 }}>

          <p style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary, #cbd5e1)" }}>Choose a plan that works for you:</p>



          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {plans.map((plan) => (

              <div

                key={plan.id}

                onClick={() => setSelectedPlan(plan.id)}

                style={{

                  border: selectedPlan === plan.id ? "2px solid var(--accent-color, #3b82f6)" : "1px solid var(--border-color, #334155)",

                  borderRadius: 10,

                  padding: 14,

                  cursor: "pointer",

                  background: selectedPlan === plan.id ? "var(--selected-bg, rgba(59,130,246,0.1))" : "var(--item-bg, rgba(255,255,255,0.05))",

                  transition: "all 0.2s",

                  position: "relative"

                }}

              >

                {plan.highlight && (

                  <div style={{ position: "absolute", top: -8, right: 10, background: "#10b981", color: "white", fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>BEST VALUE</div>

                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

                  <div>

                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary, #f1f5f9)" }}>{plan.name}</div>

                    <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>{plan.savings}</div>

                  </div>

                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-color, #3b82f6)" }}>{plan.price}</div>

                </div>

              </div>

            ))}

          </div>

        </div>

      )}



      {showPlans && selectedPlan && (

        <div style={{ background: "var(--selected-bg, rgba(59,130,246,0.1))", border: "1px solid var(--accent-color, rgba(59,130,246,0.3))", borderRadius: 10, padding: 14, marginBottom: 16 }}>

          <h4 style={{ margin: "0 0 10px 0", fontSize: 13, color: "var(--text-primary, #f1f5f9)" }}>🏦 Payment Details</h4>

          <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary, #cbd5e1)" }}>

            <div><strong>Bank:</strong> {bankDetails.bank}</div>

            <div><strong>Account Number:</strong> {bankDetails.accountNumber}</div>

            <div><strong>Account Name:</strong> {bankDetails.accountName}</div>

            <div><strong>Amount:</strong> {plans.find(p => p.id === selectedPlan)?.price}</div>

          </div>

        </div>

      )}



      {showPlans && selectedPlan && (

        <div style={{ background: "var(--warning-bg, rgba(251,191,36,0.1))", border: "1px solid var(--warning-border, rgba(251,191,36,0.3))", borderRadius: 10, padding: 14, marginBottom: 16 }}>

          <h4 style={{ margin: "0 0 10px 0", fontSize: 13, color: "var(--text-primary, #f1f5f9)" }}>📱 After Payment</h4>

          <p style={{ fontSize: 11, marginBottom: 10, color: "var(--text-secondary, #cbd5e1)" }}>

            Send a screenshot of your payment receipt to our WhatsApp to activate:

          </p>

          <a

            href={`https://wa.link/yj2em4?text=${encodeURIComponent(`Hi, I've made a payment for ${plans.find(p => p.id === selectedPlan)?.name}. Here's my payment proof:`)}`}

            target="_blank"

            rel="noopener noreferrer"

            style={{

              display: "block",

              textAlign: "center",

              background: "#25D366",

              color: "white",

              textDecoration: "none",

              padding: "10px",

              borderRadius: 6,

              fontWeight: 600,

              fontSize: 13

            }}

          >

            💬 Send Payment Proof on WhatsApp

          </a>

        </div>

      )}



      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>

        <button

          onClick={() => {

            if (showPlans && !selectedPlan) {

              toast.warning("Please select a plan first");

              return;

            }

            if (!selectedPlan) {

              toast.info(`🚀 Upgrade to access ${title}!`);

            }

          }}

          style={{

            background: "var(--accent-color, #3b82f6)",

            color: "white",

            fontWeight: 600,

            padding: "12px 24px",

            fontSize: 14,

            border: "none",

            borderRadius: 6,

            cursor: "pointer"

          }}

        >

          {selectedPlan ? `Pay ${plans.find(p => p.id === selectedPlan)?.price}` : "Upgrade Now"}

        </button>

        <button

          onClick={() => toast.info("🎁 Start your 14-day free trial today! No credit card required.")}

          style={{

            background: "transparent",

            border: "1px solid var(--border-color, #334155)",

            color: "var(--text-primary, #f1f5f9)",

            padding: "10px 20px",

            fontSize: 13,

            borderRadius: 6,

            cursor: "pointer"

          }}

        >

          Free Trial

        </button>

      </div>



      </div>

  );

}



function GlobalSearchDropdown({ query, filter, subjects }) {

  const safeSubjects = subjects || [];

  const allContent = useMemo(() => {

    const userNotes = loadFromStorage(NOTES_KEY);

    const customQuestions = loadFromStorage(CUSTOM_QUESTIONS_KEY);

    const aiDocs = loadFromStorage(AI_DOCS_KEY);

    const lectureNotes = loadFromStorage(LECTURE_NOTES_KEY);



    return {

      notes: userNotes.filter(Boolean).map((n) => ({

        type: "note",

        id: n?.id || "",

        subjectId: n?.subjectId,

        subject: safeSubjects.find((s) => s.id === n?.subjectId)?.label || "Unknown",

        title: "Student Note",

        content: n?.content || "",

        timestamp: n?.updatedAt

      })),

      questions: customQuestions.filter(Boolean).map((q, i) => ({

        type: "question",

        id: `q_${i}`,

        subjectId: q?.subjectId,

        subject: safeSubjects.find((s) => s.id === q?.subjectId)?.label || "Unknown",

        title: "Custom Question",

        content: `${q?.q || ""} ${q?.options?.join(" ") || ""} ${q?.explanation || ""}`,

        timestamp: Date.now()

      })),

      flashcards: aiDocs.filter(Boolean).flatMap((doc) =>

        (doc?.flashcards || []).filter(Boolean).map((f, i) => ({

          type: "flashcard",

          id: `${doc?.id || ""}_f_${i}`,

          subjectId: doc?.subjectId,

          subject: doc?.subjectLabel || "Unknown",

          title: "Flashcard",

          content: `${f?.front || ""} ${f?.back || ""}`,

          timestamp: doc?.createdAt

        }))

      ),

      lectures: lectureNotes.filter(Boolean).map((n) => ({

        type: "lecture",

        id: n?.id || "",

        subjectId: n?.subjectId,

        subject: safeSubjects.find((s) => s.id === n?.subjectId)?.label || "Unknown",

        title: n?.title || "",

        content: `${(n?.summary || []).join(" ")} ${(n?.key_terms || []).filter(Boolean).map(t => `${t?.term || ""} ${t?.definition || ""}`).join(" ")}`,

        timestamp: n?.createdAt

      }))

    };

  }, [safeSubjects]);



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

    // Sanitize text to prevent XSS

    const sanitizedText = DOMPurify.sanitize(text);

    // Escape special regex characters to prevent errors

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    return sanitizedText.replace(regex, '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');

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




import { PracticeWithHints } from "./features/PracticeWithHints";



import { AchievementNotification } from "./features/AchievementNotification";



import { PersonalizedStudyPaths } from "./features/PersonalizedStudyPaths";



import { StudyGroups } from "./features/StudyGroups";



const GamificationHub = lazy(() => import("./features/Gamification"));



import { ExamSimulator, selectAdaptiveQuestions, calculateSessionAnalytics, PostSessionInsights } from "./features/EnhancedSession";
import StatsPanel from "./features/StatsPanel";
import AdminDashboard from "./features/AdminDashboard";



import { OnboardingWizard, isOnboarded, markOnboarded } from "./features/Onboarding";



import AITutor from "./features/AITutor/index.jsx";
import AISectionOverlay from "./features/AISectionOverlay.jsx";



import { StudentProfile, useStudentProfile } from "./features/StudentProfile.jsx";



import Lecturers from "./features/Lecturers/index.jsx";



import { TeacherInvitesPanel } from "./features/TeacherInvites.jsx";



import { LiveSessionsPanel } from "./features/LiveSessions/LiveSessionsPanel.jsx";



import { LiveBanner } from "./features/LiveSessions/LiveBanner.jsx";



import { ClassroomAssignmentsPanel } from "./features/ClassroomAssignments/ClassroomAssignmentsPanel.jsx";



import { AttendancePanel } from "./features/LiveSessions/AttendancePanel.jsx";



import { PushPermissionBanner, NotificationSettings } from "./features/NotificationCenter.jsx";



import { InstallPrompt } from "./features/InstallPrompt.jsx";



import CourseOutline from "./features/CourseOutline";







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

  allowedThemes: ["aurora", "paper"],

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



  // Sync all user data to backend via the bulk sync endpoint

  try {

    await api("/user-data/sync", {

      token,

      method: "POST",

      body: {

        stats: data.progress,

        mastery: data.progress?.mastery,

        wrongCounts: data.progress?.wrongCounts,

        srData: data.progress?.srData,

        lastStudied: data.progress?.lastStudied,

        timetable: data.timetable,

        notes: data.notes,

        outlineProgress: data.outlineProgress,

      },

    });

  } catch (e) { console.error("Failed to sync to backend:", e); }



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



const PRIMARY_TABS = ["today", "practice", "aitutor", "analytics"];

const TAB_LABELS = {

  today: "🏠 Home", dashboard: "🏠 Home", practice: "📚 Learn", aitutor: "🤖 AI Tutor",

  analytics: "📊 Progress", studypaths: "🛤️ Study Paths", learn: "📚 Learn", classroom: "🏫 Classroom",

  bank: "🏦 Questions", planner: "📅 Planner",

  outline: "📋 Course Outline", keys: "🔑 Keys", invites: "🎫 Invites", admin: "⚙️ Admin",

  flashcards: "🃏 Flashcards", lecturers: "👨‍🏫 Lecturers", reminders: "🔔 Reminders",

  leaderboard: "🏆 Leaderboard", gamification: "⚔️ Arena", studygroups: "👥 Study Groups",

  notes: "📝 Notes", achievements: "🏅 Badges", timetable: "🗓️ Timetable",

  cheatsheet: "💡 Cheat Sheet", discuss: "💬 Discussion", settings: "⚙️ Settings",

  profile: "👤 Profile", pomodoro: "⏱️ Focus Timer", lectures: "🎓 Lectures",

  pastpapers: "📄 Past Papers", notifications: "🔔 Notifications",

  "teacher-questions": "📝 My Questions", "campus-comm": "📢 Announcements",

  premium: "💎 Premium"

};



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



  const [syncConfig, setSyncConfig] = useState({ url: "", key: "", userId: "local-user" });



  const [syncStatus, setSyncStatus] = useState("");



  const [aiConfig, setAiConfig] = useState({

    provider: "openrouter",

    model: "qwen/qwen-2.5-7b-instruct",

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



  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const [showMobileMenu, setShowMobileMenu] = useState(false);

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



  const [themePack, setThemePack] = useState("aurora");



  const [density, setDensity] = useState("cozy");



  const [headerExpanded, setHeaderExpanded] = useState(true);



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

    let result = (SUBJECTS || []).map(s => {

      // Find matching backend subject and merge questions

      const backend = backendSubjects.find(b => b.label === s.label);

      if (backend) {

        // Use backend ID so API calls (publish, etc.) reference the correct DB record

        return { ...s, id: backend.id, questions: [...(s.questions || []), ...(backend.questions || [])] };

      }

      return s;

    });

    

    // Add backend subjects that don't exist in local SUBJECTS (like MTH-111)

    for (const backend of backendSubjects) {

      if (!result.find(s => s.label === backend.label)) {

        result.push({

          id: backend.id,

          label: backend.label,

          icon: backend.label.includes("MTH") ? "∫" : backend.label.includes("BIO") ? "🐟" : backend.label.includes("CHM") ? "🧪" : backend.label.includes("PHY") ? "⚡" : backend.label.includes("GST") ? "📚" : "📖",

          accent: "#fb923c",

          image: SUBJECTS[0]?.image || "",

          lessons: [],

          questions: backend.questions || []

        });

      }

    }

    

    // Add custom questions bank

    if (customQuestions.length) {

      result.push({ id: "custom", label: "Custom Bank", icon: "🧩", image: SUBJECTS[0]?.image || "", lessons: [], questions: customQuestions });

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

      // Logged-in user: backend is source of truth — load from server
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
          setTimeout(() => setShowDeptSwitcher(true), 1200);
        }

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
        if (cachedSubjects) setBackendSubjects(JSON.parse(cachedSubjects));
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

    

    const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

    

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
          if (cached) setBackendSubjects(JSON.parse(cached));
        } catch {}
      }

      try {

        const rows = await api("/subjects");

        if (active) {
          setBackendSubjects(rows);
          // Persist for offline use
          try { localStorage.setItem("sc_subjects_cache", JSON.stringify(rows)); } catch {}
        }

      } catch {

        // Keep whatever was pre-populated from localStorage — don't clear it

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

          inviteCode: (role === "TEACHER" || role === "LECTURER") ? inviteCode : undefined,

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

      

      // Extract detailed error message

      let errorMessage = "Sign up failed. Please try again.";

      

      if (e.message) {

        errorMessage = e.message;

      }

      

      // Add helpful hints for common errors

      if (errorMessage.includes("Password must")) {

        errorMessage += "\n\nPassword requirement:\n• At least 8 characters";

      } else if (errorMessage.includes("Username")) {

        errorMessage += "\n\nUsername requirements:\n• 3-30 characters\n• Letters, numbers, and underscores only\n• No spaces allowed";

      } else if (errorMessage.includes("invite code")) {

        errorMessage += "\n\nPlease check your invite code or contact an administrator.";

      } else if (errorMessage.includes("already exists")) {

        errorMessage += "\n\nTry logging in instead or use a different email/username.";

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



  function updateStreak() {

    const now = new Date();

    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format



    if (lastStudied === todayStr) return stats.streak;



    if (!lastStudied) {

      setLastStudied(todayStr);

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

        toast.info(`🎉 Amazing! Demo streak limit of ${DEMO_LIMITS.maxStreak} days reached. Upgrade for unlimited!`);

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
              setTimeout(() => toast.success(`🏆 100% Mastery! +${res.xpBonus} XP bonus earned!`), 800);
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

          toast.success("🎉 Your account has been activated! Welcome aboard!");

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
            toast.error("⚠️ Your subscription has expired! Contact your teacher to renew.");
            expiryWarnedRef.current = true;
          } else if (daysLeft <= 1) {
            toast.error("⚠️ Your subscription expires TODAY! Contact your teacher to renew.");
            expiryWarnedRef.current = true;
          } else if (daysLeft <= 3) {
            toast.error(`⚠️ Subscription expires in ${daysLeft} days. Please renew soon!`);
            expiryWarnedRef.current = true;
          } else if (daysLeft <= 7) {
            toast(`📅 Your subscription expires in ${daysLeft} days.`, { duration: 6000 });
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
    if (!auth.user || demoMode) {

      console.log("[polling] Skipping - no user or demo mode");

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

  }, [auth.user?.id, auth.user?.isActivated, demoMode]);



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

              { title: "📚 Time to Study!", body: "Your daily study session awaits. Keep your streak going!" },

              { title: "🎯 Ready to Learn?", body: "Take 10 minutes to review and maintain your progress!" },

              { title: "💪 Don't Break the Chain!", body: "A quick study session now keeps your streak alive!" },

              { title: "🧠 Knowledge Awaits!", body: "Your brain is ready for some exercise. Let's study!" }

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

            "⚠️ Streak in Danger!",

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

            { title: "🌟 Don't Give Up!", body: "Every expert was once a beginner. Keep going with your studies!" }

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

          "🔄 Spaced Review Due",

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



    setActiveSession({ mode: "diagnostic", source: { id: "diagnostic", label: "Diagnostic", icon: "🧪" }, questions: finalQuestions });



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



    setActiveSession({ mode: "adaptive", source: { id: "adaptive", label: "Adaptive", icon: "🎯" }, questions: picked });



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



      source: { id: "spaced", label: "Spaced Review", icon: "🧠" },



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



    setActiveSession({ mode: "weak", source: { id: "weak", label: "Weak Drill", icon: "⚔️" }, questions: finalWeak });



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



    setActiveSession({ mode: "error", source: { id: "error", label: "Error Drill", icon: "🔁" }, questions: finalWrongs, totalSeconds: finalWrongs.length * 60 });



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

                  onChange={(e) => { 

                    // Only allow letters, numbers, and underscores

                    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");

                    e.target.value = sanitized;

                    signupUsernameRef.current = sanitized;

                  }}

                  placeholder="Username (letters, numbers, _ only)"

                  autoComplete="username"

                />



                <div style={{ position: "relative" }}>

                  <input

                    ref={signupPasswordRef}

                    type={showSignupPassword ? "text" : "password"}

                    onChange={(e) => { signupPasswordRef.current = e.target.value; }}

                    placeholder="Password (min 8 characters)"

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

  console.log("[GATE CHECK] auth.user:", !!auth.user, "isActivated:", isActivated, "demoMode:", demoMode, "willLock:", auth.user && !isActivated && !demoMode);

  if (auth.user && !isActivated && !demoMode) {

    console.log("[GATE] Showing locked screen");

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

          userRole={auth.user.role}

          onLogout={logout}

          onTryDemo={() => setDemoMode(true)}

          onRefresh={refreshAuth}

          isChecking={isCheckingActivation}

          onGetPremium={() => setTab("premium")}

          deferredPrompt={deferredPrompt}

          onInstall={handleInstallClick}

          isIOS={isIOS}

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

        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)} style={{ zIndex: 10001 }}>

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



      {/* Demo Locked Screen - shown when time limit reached */}

      {demoLocked && demoMode && (

        <div className="modal-overlay" style={{ zIndex: 10000 }}>

          <div className="modal-box" style={{ maxWidth: 500, textAlign: "center", background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)" }}>

            <div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div>

            <h2 style={{ margin: "0 0 12px 0", color: "var(--warning-color, #fbbf24)" }}>Daily Time Limit Reached</h2>

            <p style={{ marginBottom: 20, lineHeight: 1.6, color: "var(--text-secondary, #cbd5e1)" }}>

              You've used your {DEMO_LIMITS.dailyTimeLimit} minutes for today. Upgrade for unlimited access or wait until tomorrow!

            </p>

            <div style={{ background: "var(--success-bg, rgba(45,212,160,0.1))", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "left", border: "1px solid var(--success-border, rgba(45,212,160,0.3))" }}>

              <strong style={{ color: "var(--success-text, #2dd4a0)", display: "block", marginBottom: 10 }}>✨ Upgrade for:</strong>

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

                style={{ background: "var(--accent-color, #3b82f6)", color: "white", fontWeight: 600, padding: "12px 24px", fontSize: 14, border: "none", borderRadius: 6, cursor: "pointer" }}

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



      {/* Global Announcement Popup - shows on login for students */}

      {globalAnnouncement && (

        <div className="modal-overlay" style={{ zIndex: 9999 }}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{

            maxWidth: 500,

            border: "2px solid rgba(239, 68, 68, 0.5)",

            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(239, 68, 68, 0.15))",

            boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.25)"

          }}>

            <div style={{ textAlign: "center", marginBottom: 16 }}>

              <span style={{ fontSize: 48, display: "block", marginBottom: 8 }}>⚠️</span>

              <h3 style={{ color: "#fbbf24", fontSize: 20, textTransform: "uppercase", letterSpacing: 1 }}>Important Announcement</h3>

            </div>

            <h4 style={{ fontSize: 18, marginBottom: 12 }}>{globalAnnouncement.title}</h4>

            <p style={{ marginBottom: 16, lineHeight: 1.6 }}>{globalAnnouncement.content}</p>

            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>

              Posted: {new Date(globalAnnouncement.createdAt).toLocaleString()}

            </div>

            <button

              onClick={async () => {

                const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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

              ✓ Got it, dismiss

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

              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',

              border: '1px solid rgba(99, 102, 241, 0.3)',

              color: '#a5b4fc',

              fontSize: '12px',

              fontWeight: 500,

              cursor: 'pointer',

              transition: 'all 0.3s'

            }}

          >

            <span>{headerExpanded ? "▲" : "▼"}</span>

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

            <div className="logo-icon">🎓</div>

            <div className="logo-text">

              <div className="logo-title">Scholar's Circle</div>

              <div className="logo-subtitle">Learn • Practice • Master</div>

            </div>

          </div>



          {/* Header Controls */}

          <div className="header-controls">



            {/* Palette Button */}

            <button className="header-btn palette-btn" onClick={() => setShowPalette(true)} title="Ctrl/Cmd+K">

              <span className="btn-icon">🔍</span>

              <span className="btn-label">Search</span>

              <span className="shortcut">⌘K</span>

            </button>



            {/* Theme Selector */}

            <div className="theme-selector" onClick={() => {

              const selector = document.querySelector('.theme-selector');

              selector?.classList.toggle('open');

            }}>

              <div className="theme-selector-btn">

                <div className={`theme-dot ${themePack}`}></div>

                <span className="btn-label">{themePack.charAt(0).toUpperCase() + themePack.slice(1)}</span>

                <span style={{ fontSize: 10 }}>▼</span>

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

                  <span className="theme-name">💜 Neon</span>

                </div>

              </div>

            </div>



            {/* Dark Mode Toggle */}

            <button className="header-btn theme-btn" onClick={() => setDarkMode((v) => !v)} title="Toggle theme">

              {darkMode ? "🌙" : "☀️"}

            </button>



            {/* Notification Bell */}

            <NotificationBell token={token} currentUser={auth.user} onOpenTab={setTab} />



            {/* Profile Button */}

            <button className="header-btn profile-btn" onClick={() => setTab("profile")} title="My Profile">

              <span className="btn-icon">👤</span>

              <span className="btn-label">Profile</span>

            </button>



            {/* Install Button */}

            {deferredPrompt && !isIOS && (

              <button className="header-btn" onClick={handleInstallClick}>

                <span className="btn-icon">📱</span>

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

                <span className="stat-icon">⚡</span>

                <span className="stat-value">{stats.xp}</span>

                <span className="stat-label">XP</span>

              </div>

              <div className="user-stat streak-stat">

                <span className="stat-icon">🔥</span>

                <span className="stat-value">{stats.streak || 0}</span>

                <span className="stat-label">Streak</span>

              </div>

              <div className="user-stat session-stat">

                <span className="stat-icon">📚</span>

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

          <span className="nav-icon">🏠</span>

          <span className="nav-label">Home</span>

        </button>

        <button

          className={["practice", "learn", "bank", "pastpapers", "studypaths", "practicehints"].includes(tab) ? "active" : ""}

          onClick={() => setTab("practice")}

          title="Learn"

        >

          <span className="nav-icon">📚</span>

          <span className="nav-label">Learn</span>

        </button>

        <button

          className={["aitutor", "lectures"].includes(tab) ? "active" : ""}

          onClick={() => setTab("aitutor")}

          title="AI Tutor"

        >

          <span className="nav-icon"><span className="nav-icon-wrapper">🤖<span className="nav-icon-badge" /></span></span>

          <span className="nav-label">AI Tutor</span>

        </button>

        <button

          className={["analytics", "leaderboard", "achievements", "gamification"].includes(tab) ? "active" : ""}

          onClick={() => setTab("analytics")}

          title="Progress"

        >

          <span className="nav-icon">📊</span>

          <span className="nav-label">Progress</span>

        </button>

        <button

          className={`more-btn ${["settings", "flashcards", "notes", "timetable", "reminders", "pomodoro", "studygroups", "discuss", "cheatsheet", "outline", "classroom", "profile", "lecturers", "notifications", "premium", "teacher-questions", "campus-comm", "planner", ...(isTeacher ? ["keys", "invites", "admin"] : [])].includes(tab) ? "has-active" : ""}`}

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

            

            {/* Section: Study Resources */}

            <div className="mobile-menu-section-label">📖 Study Resources</div>

            <div className="mobile-menu-grid">

              <button className={tab === "resources" ? "active" : ""} onClick={() => { setTab("resources"); setShowMobileMenu(false); }}>

                <span>📚</span> Resources

              </button>

            </div>



            {/* Section: Classroom & Community */}

            <div className="mobile-menu-section-label">🏫 Classroom & Community</div>

            <div className="mobile-menu-grid">

              <button className={tab === "classroom" ? "active" : ""} onClick={() => { setTab("classroom"); setShowMobileMenu(false); }}>

                <span>🏫</span> Classroom

              </button>

              <button className={tab === "lecturers" ? "active" : ""} onClick={() => { setTab("lecturers"); setShowMobileMenu(false); }}>

                <span>👨‍🏫</span> Lecturers

              </button>

              <button className={tab === "studygroups" ? "active" : ""} onClick={() => { setTab("studygroups"); setShowMobileMenu(false); }}>

                <span>👥</span> Study Groups

              </button>

              <button className={tab === "discuss" ? "active" : ""} onClick={() => { setTab("discuss"); setShowMobileMenu(false); }}>

                <span>💬</span> Discussion

              </button>

            </div>



            {/* Section: Tools */}

            <div className="mobile-menu-section-label">🛠️ Tools</div>

            <div className="mobile-menu-grid">

              <button className={tab === "timetable" ? "active" : ""} onClick={() => { setTab("timetable"); setShowMobileMenu(false); }}>

                <span>🗓️</span> Timetable

              </button>

              <button className={tab === "reminders" ? "active" : ""} onClick={() => { setTab("reminders"); setShowMobileMenu(false); }}>

                <span>🔔</span> Reminders

              </button>

              <button className={tab === "pomodoro" ? "active" : ""} onClick={() => { setTab("pomodoro"); setShowMobileMenu(false); }}>

                <span>⏱️</span> Focus Timer

              </button>

              <button className={tab === "planner" ? "active" : ""} onClick={() => { setTab("planner"); setShowMobileMenu(false); }}>

                <span>📅</span> Planner

              </button>

              <button onClick={() => { window.location.href = "/resources"; setShowMobileMenu(false); }}>

                <span>📚</span> Research Hub

              </button>

            </div>



            {/* Section: Account */}

            <div className="mobile-menu-section-label">👤 Account</div>

            <div className="mobile-menu-grid">

              <button className={tab === "profile" ? "active" : ""} onClick={() => { setTab("profile"); setShowMobileMenu(false); }}>

                <span>👤</span> Profile

              </button>

              <button className={tab === "notifications" ? "active" : ""} onClick={() => { setTab("notifications"); setShowMobileMenu(false); }}>

                <span>🔔</span> Notifications

              </button>

              <button className={tab === "settings" ? "active" : ""} onClick={() => { setTab("settings"); setShowMobileMenu(false); }}>

                <span>⚙️</span> Settings

              </button>

              {!isFaculty && (

                <button className={tab === "premium" ? "active" : ""} onClick={() => { setTab("premium"); setShowMobileMenu(false); }} style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))", border: "1px solid rgba(139,92,246,0.4)" }}>

                  <span>💎</span> Premium

                </button>

              )}

            </div>



            {/* Faculty Section */}

            {isFaculty && (

              <>

                <div className="mobile-menu-section-label">🎓 Faculty Tools</div>

                <div className="mobile-menu-grid">

                  <button className={tab === "teacher-questions" ? "active" : ""} onClick={() => { setTab("teacher-questions"); setShowMobileMenu(false); }}>

                    <span>📝</span> My Questions

                  </button>

                  <button onClick={() => { window.location.href = "/teacher/resources"; setShowMobileMenu(false); }}>

                    <span>📤</span> Teacher Resources

                  </button>

                  <button className={tab === "campus-comm" ? "active" : ""} onClick={() => { setTab("campus-comm"); setShowMobileMenu(false); }}>

                    <span>📢</span> Announcements

                  </button>

                  {isTeacher && (

                    <>

                      <button className={tab === "keys" ? "active" : ""} onClick={() => { setTab("keys"); setShowMobileMenu(false); }}>

                        <span>🔑</span> Student Keys

                      </button>

                      <button className={tab === "invites" ? "active" : ""} onClick={() => { setTab("invites"); setShowMobileMenu(false); }}>

                        <span>🎫</span> Invites

                      </button>

                      <button className={tab === "admin" ? "active" : ""} onClick={() => { setTab("admin"); setShowMobileMenu(false); }}>

                        <span>🛡️</span> Admin Panel

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

          ["today", "🏠 Home"],

          ["practice", "📚 Learn"],

          ["aitutor", "🤖 AI Tutor"],

          ["analytics", "📊 Progress"],

          ["classroom", "🏫 Classroom"],

          ["resources", "📚 Resources"],

          ["studygroups", "👥 Groups"],

          ["discuss", "💬 Discussion"],

          ["timetable", "🗓️ Timetable"],

          ["settings", "⚙️ Settings"],

          ["research-hub", "📚 Research Hub"],

          ...(isFaculty ? [["teacher-questions", "📝 My Questions"], ["teacher-resources", "📤 Teacher Resources"], ["campus-comm", "📢 Announcements"], ["departments", "🏛️ Departments"]] : []),

          ...(isTeacher ? [["keys", "🔑 Keys"], ["invites", "🎫 Invites"], ["admin", "🛡️ Admin"]] : []),

        ].filter(([id]) => {

          if (!demoMode) return true;

          return !["classroom"].includes(id);

        }).map(([id, label]) => {
          const isExternalRoute = id === "research-hub" || id === "teacher-resources";
          return (
            <button
              key={id}
              className={["today", "dashboard"].includes(tab) && id === "today" ? "active" : tab === id ? "active" : ""}
              onClick={() => {
                if (isExternalRoute) {
                  window.location.href = id === "research-hub" ? "/resources" : "/teacher/resources";
                } else {
                  setTab(id);
                }
              }}
            >
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



        <TodayScreen

          userName={auth.user?.username || auth.user?.name || "Scholar"}

          onOpenAI={(ctx) => { setAiDefaultView("chat"); setAiStudyTopic(""); setAiKey(k => k + 1); setTab("aitutor"); }}

          onOpenLearn={() => { setAiDefaultView("learn"); setAiStudyTopic(""); setAiKey(k => k + 1); setTab("aitutor"); }}

          onOpenStudy={(topic, mode, attachment) => { setAiDefaultView("study"); setAiStudyTopic(topic || ""); setAiStudyMode(mode || "input"); setAiStudyAttachment(attachment || null); setAiKey(k => k + 1); setTab("aitutor"); }}

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



          onImportToBank={(questions, topic) => {

            // Save imported questions to localStorage

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

            toast.success(`✓ Imported ${newQuestions.length} questions to your Question Bank!`);

          }}



        />



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

            icon="🎓"

            features={["Unlimited lecture conversions", "AI-powered summaries", "Auto-generated flashcards", "Key term extraction"]}

            showPlans={true}

          />

        ) : (

          <>

            {demoMode && (

              <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                  <span style={{ fontSize: 16 }}>🎓</span>

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

            icon="👥"

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

                toast.warning(`Demo limit: Only ${DEMO_LIMITS.pastPapersLimit} past paper allowed. Upgrade for more!`);

                return;

              }

              // Limit to 10 questions for demo users

              const finalQs = demoMode && qs.length > 10 ? qs.slice(0, 10) : qs;

              if (demoMode && qs.length > 10) {

                toast.info("Free Trial: Limited to 10 questions. Upgrade for unlimited!");

              }

              setActiveSession({ mode: "exam", source: { id: "pastpaper", label: `Past Paper ${yr}`, icon: "📝" }, questions: finalQs, totalSeconds: (demoMode ? 15 : mins) * 60 });

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

                <span className="banner-icon">🔒</span>

                <span className="banner-text">Free Trial: Limited to 4 subjects. Upgrade for full access.</span>

                <button className="banner-action" onClick={() => setShowPaymentModal(true)}>Upgrade</button>

              </div>

              <div className="demo-banner info">

                <span className="banner-icon">📝</span>

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



                    <strong>{s.label} {locked ? "🔒" : isCapped ? "⭐" : ""}</strong>



                    <span className="muted">{m}%{isCapped && " (Demo Cap)"}</span>



                  </div>



                </button>



              );



            })}



          </div>



          {demoMode && subjects.some(s => (mastery[s.id] || 0) >= DEMO_LIMITS.masteryCap) && (

            <div className="demo-banner warning" style={{ marginTop: 16 }}>

              <span className="banner-icon">⭐</span>

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

                Weak Drill 🔒

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



                  source: { id: "challenge", label: "Peer Challenge", icon: "🏁" },



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

                ? `Spaced Review (${DEMO_LIMITS.maxSpacedReviewCards}/${dueCards.length}) 🔒`

                : `Spaced Review (${dueCards.length})`}



            </button>



            <button className="btn-neon-blue" onClick={() => setTab("learn")}>Read Lessons</button>



          </div>



          <h3 style={{ marginTop: 20 }}>Daily Quests</h3>



          <div className="quests-grid">



            {EMPTY_QUESTS.map((q) => (



              <div key={q.id} className={`quest-card ${stats.questsDone[q.id] ? 'completed' : ''}`}>



                <div className="quest-check">{stats.questsDone[q.id] ? "✓" : "○"}</div>



                <span className="quest-label">{q.label}</span>



                <span className="quest-reward">+{q.xp || 10} XP</span>



              </div>



            ))}



          </div>



        </div>



        </>



      )}






      {tab === "practice" && (
        <LearnHub
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
          mastery={mastery}
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
      )}

      {showDeptSwitcher && (
        <DepartmentSwitcher
          activeDept={activeDept}
          activeYearLevel={activeYearLevel}
          isOnboarding={!activeDept}
          onClose={() => setShowDeptSwitcher(false)}
          onConfirm={(dept, year) => {
            setActiveDept(dept);
            setActiveYearLevel(year);
            try {
              localStorage.setItem("sc_active_dept", JSON.stringify(dept));
              localStorage.setItem("sc_active_level", String(year));
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



          teacherMode={isFaculty}



          setTeacherMode={() => {}}

          currentUser={auth.user}

          token={token}



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






      {tab === "planner" && <RevisionPlanner mastery={mastery} dueCards={dueCards} subjects={subjects} />}

      {tab === "resources" && (
        <div className="card">
          <h2>📚 Study Resources</h2>
          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { id: "notes", label: "📝 Notes" },
              { id: "flashcards", label: "🔄 Flashcards" },
              { id: "cheatsheet", label: "📋 Cheat Sheets" },
              { id: "outline", label: "📑 Course Outline" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setResourcesSubTab(id)}
                style={{
                  padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  border: resourcesSubTab === id ? "2px solid #f59e0b" : "1px solid rgba(245,158,11,0.25)",
                  background: resourcesSubTab === id ? "linear-gradient(135deg,#d97706,#f59e0b)" : "rgba(30,41,59,0.6)",
                  color: resourcesSubTab === id ? "#fff" : "#fcd34d",
                }}
              >{label}</button>
            ))}
          </div>

          {resourcesSubTab === "notes" && (
            <>
              {demoMode && (
                <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📝</span>
                    <span style={{ fontSize: 13 }}>Free Trial: {DEMO_LIMITS.notesLimit - Object.values(notes).flat().length} notes remaining.</span>
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
                      toast.warning(`Free Trial limit: Max ${DEMO_LIMITS.notesLimit} notes. Upgrade for unlimited!`);
                      return;
                    }
                  }
                  setNotes(newNotes);
                }}
                demoMode={demoMode}
              />
            </>
          )}

          {resourcesSubTab === "flashcards" && (
            <FlashcardDeck subjects={subjects} srData={srData} customFlashcards={customFlashcards} setCustomFlashcards={setCustomFlashcards} token={token} />
          )}

          {resourcesSubTab === "cheatsheet" && (
            <CheatSheet subjects={subjects} mastery={mastery} />
          )}

          {resourcesSubTab === "outline" && (
            <CourseOutline
              subjects={subjects}
              outlineSubjectId={outlineSubjectId}
              setOutlineSubjectId={setOutlineSubjectId}
              startSubjectPractice={startSubjectPractice}
              addNote={(text) => setNotes((p) => ({ ...p, [outlineSubjectId]: text }))}
              outlineProgress={outlineProgress}
              setOutlineProgress={setOutlineProgress}
              toast={toast}
            />
          )}
        </div>
      )}






      {tab === "analytics" && (

        <>

        {/* Progress Hub sub-tabs */}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>

          {[

            { id: "stats", label: "📊 Stats" },

            { id: "leaderboard", label: "🏆 Leaderboard" },

            { id: "badges", label: "🏅 Badges" },

            { id: "arena", label: "⚔️ Arena" },

          ].map(({ id, label }) => (

            <button

              key={id}

              onClick={() => setProgressSubTab(id)}

              style={{

                padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,

                border: progressSubTab === id ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.25)",

                background: progressSubTab === id ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(30,41,59,0.6)",

                color: progressSubTab === id ? "#fff" : "#a5b4fc",

              }}

            >{label}</button>

          ))}

        </div>



        {progressSubTab === "leaderboard" && (

          <Leaderboard username={auth.user.username} xp={stats.xp} sessions={stats.sessions} streak={stats.streak} mastery={mastery} subjects={subjects} token={token} />

        )}



        {progressSubTab === "badges" && (

          <AchievementsBadges badges={BADGES} stats={stats} history={history} subjects={subjects} mastery={mastery} />

        )}



        {progressSubTab === "arena" && (
          <Suspense fallback={<div className="card"><p className="muted">Loading arena...</p></div>}>
            <GamificationHub token={token} userId={auth.user?.id} username={auth.user?.username} classroomId={null} leaderboard={[]} />
          </Suspense>
        )}



        {progressSubTab === "stats" && (

        <div>



          <h2>📊 Analytics</h2>

          <StatsPanel
            history={history}
            stats={stats}
            subjects={subjects}
            mastery={mastery}
            aiConfig={aiConfig}
            onRePractice={(missed) => {
              setCustomQuestions(prev => [...missed, ...prev]);
              setTab("practice");
            }}
          />

        </div>

        )}

        </>

      )}



      {tab === "admin" && isTeacher && (
        <AdminDashboard
          adminUsers={adminUsers}
          adminLogins={adminLogins}
          adminLoading={adminLoading}
          onRefresh={refreshAdmin}
          token={token}
        />
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

        <CampusComm

          token={token}

          currentUser={auth.user}

        />

      )}



      {tab === "settings" && (



        <>



        <NotificationSettings token={token} />



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

          {/* Subscription Plan Card — visible to students */}
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
              <div style={{ background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>📋 Subscription Plan</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`, borderRadius: 20, padding: "3px 10px" }}>
                    ● {statusText}
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
                  {planLabel || (isActivated ? "Active Plan" : "No Active Plan")}
                </div>
                {expiry && (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {daysLeft !== null && daysLeft > 0
                      ? `Expires ${expiry.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
                      : `Expired on ${expiry.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`}
                  </div>
                )}
                {!isActivated && (
                  <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, marginBottom: 0 }}>
                    Share your activation key above with your teacher to get started.
                  </p>
                )}
                {isActivated && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                  <p style={{ fontSize: 11, color: statusColor, marginTop: 8, marginBottom: 0, fontWeight: 600 }}>
                    ⚠️ Contact your teacher to renew your subscription before it expires.
                  </p>
                )}
              </div>
            );
          })()}

          {!auth.user?.activationKey && !isTeacher && (

            <div style={{ background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>

              <p className="muted" style={{ fontSize: 12 }}>

                {token ? "Your account doesn't have an activation key. You may be using a demo account." : "Log in to see your activation key."}

              </p>

            </div>

          )}



          <h3>AI Assistant</h3>

          <div style={{ background: "rgba(45,212,160,0.1)", border: "1px solid rgba(45,212,160,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>

            <p style={{ margin: 0, color: "#2dd4a0", fontWeight: 600 }}>✅ AI Powered by OpenRouter (Qwen 2.5 7B)</p>

            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>AI features are enabled automatically. No configuration needed!</p>

          </div>



          <AIHelper aiConfig={{ provider: "openrouter", model: "qwen/qwen-2.5-7b-instruct", apiKey: "" }} onUsed={() => {



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



          <h3>🔔 Notifications</h3>

          

          <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>

            {notificationPermission !== 'granted' ? (

              <div>

                <p style={{ margin: "0 0 12px 0" }}>Enable notifications to get study reminders and stay on track!</p>

                <button 

                  onClick={requestNotificationPermission}

                  style={{ background: "#fbbf24", color: "#000", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}

                >

                  Enable Notifications

                </button>

              </div>

            ) : (

              <div>

                <p style={{ margin: "0 0 12px 0", color: "#34d399", fontWeight: 600 }}>✅ Notifications enabled</p>

                

                <div style={{ display: "grid", gap: 12 }}>

                  {/* Daily Reminder */}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>

                    <div>

                      <div style={{ fontWeight: 600 }}>📚 Daily Reminder</div>

                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Get reminded to study daily</div>

                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                      <input 

                        type="time" 

                        value={notificationSettings.dailyReminderTime}

                        onChange={(e) => setNotificationSettings(s => ({ ...s, dailyReminderTime: e.target.value }))}

                        style={{ width: 90, padding: "4px 8px", fontSize: 13 }}

                      />

                      <input 

                        type="checkbox" 

                        checked={notificationSettings.dailyReminder}

                        onChange={(e) => setNotificationSettings(s => ({ ...s, dailyReminder: e.target.checked }))}

                        style={{ width: 18, height: 18 }}

                      />

                    </div>

                  </div>

                  

                  {/* Streak Warning */}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>

                    <div>

                      <div style={{ fontWeight: 600 }}>🔥 Streak Warning</div>

                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Alert when streak is about to break</div>

                    </div>

                    <input 

                      type="checkbox" 

                      checked={notificationSettings.streakWarning}

                      onChange={(e) => setNotificationSettings(s => ({ ...s, streakWarning: e.target.checked }))}

                      style={{ width: 18, height: 18 }}

                    />

                  </div>

                  

                  {/* Inactivity Reminder */}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>

                    <div>

                      <div style={{ fontWeight: 600 }}>👋 Inactivity Reminder</div>

                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nudge when you haven't studied</div>

                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                      <select 

                        value={notificationSettings.inactivityDays}

                        onChange={(e) => setNotificationSettings(s => ({ ...s, inactivityDays: Number(e.target.value) }))}

                        style={{ padding: "4px 8px", fontSize: 13 }}

                      >

                        <option value={1}>1 day</option>

                        <option value={2}>2 days</option>

                        <option value={3}>3 days</option>

                        <option value={5}>5 days</option>

                        <option value={7}>1 week</option>

                      </select>

                      <input 

                        type="checkbox" 

                        checked={notificationSettings.inactivityReminder}

                        onChange={(e) => setNotificationSettings(s => ({ ...s, inactivityReminder: e.target.checked }))}

                        style={{ width: 18, height: 18 }}

                      />

                    </div>

                  </div>

                  

                  {/* Spaced Review */}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>

                    <div>

                      <div style={{ fontWeight: 600 }}>🔄 Spaced Review</div>

                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Remind when cards are due</div>

                    </div>

                    <input 

                      type="checkbox" 

                      checked={notificationSettings.spacedReviewReminder}

                      onChange={(e) => setNotificationSettings(s => ({ ...s, spacedReviewReminder: e.target.checked }))}

                      style={{ width: 18, height: 18 }}

                    />

                  </div>

                  

                  {/* Weekly Progress */}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>

                    <div>

                      <div style={{ fontWeight: 600 }}>📊 Weekly Progress</div>

                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sunday evening summary</div>

                    </div>

                    <input 

                      type="checkbox" 

                      checked={notificationSettings.weeklyProgress}

                      onChange={(e) => setNotificationSettings(s => ({ ...s, weeklyProgress: e.target.checked }))}

                      style={{ width: 18, height: 18 }}

                    />

                  </div>

                  

                  {/* Motivational Quotes */}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>

                    <div>

                      <div style={{ fontWeight: 600 }}>💡 Daily Inspiration</div>

                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Morning motivational quotes</div>

                    </div>

                    <input 

                      type="checkbox" 

                      checked={notificationSettings.motivationalQuotes}

                      onChange={(e) => setNotificationSettings(s => ({ ...s, motivationalQuotes: e.target.checked }))}

                      style={{ width: 18, height: 18 }}

                    />

                  </div>

                </div>

              </div>

            )}

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

                  AI features are powered by our backend. If you're experiencing issues, please try again later or contact support.

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



          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: 16 }}>

            <h4 style={{ margin: "0 0 8px 0", fontSize: 14, color: "#ef4444" }}>⚠️ Danger Zone</h4>

            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>

              Once you delete your account, all your data will be permanently lost. This action cannot be undone.

            </p>

            <button

              onClick={() => setShowDeleteModal(true)}

              style={{

                background: "#ef4444",

                color: "white",

                border: "none",

                padding: "10px 16px",

                borderRadius: 6,

                cursor: "pointer",

                fontWeight: 600,

                width: "100%"

              }}

            >

              🗑️ Delete Account

            </button>

          </div>



        </div>



        {showDeleteModal && (

          <div style={{

            position: "fixed",

            inset: 0,

            background: "rgba(0,0,0,0.7)",

            zIndex: 2000,

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            padding: 16

          }}>

            <div className="card" style={{

              maxWidth: 400,

              width: "100%",

              padding: 24,

              background: "#0f1830",

              border: "1px solid rgba(239,68,68,0.3)"

            }}>

              <h3 style={{ margin: "0 0 12px 0", color: "#ef4444" }}>Delete Account</h3>

              <p className="muted" style={{ marginBottom: 16 }}>

                Are you sure you want to delete your account? This will permanently delete all your data including:

              </p>

              <ul style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16, paddingLeft: 20 }}>

                <li>Practice history and stats</li>

                <li>Flashcards and notes</li>

                <li>Custom questions</li>

                <li>Classroom assignments</li>

              </ul>

              <div style={{ marginBottom: 16 }}>

                <label style={{ display: "block", fontSize: 13, marginBottom: 8, color: "#a5b4fc" }}>

                  Enter your password to confirm:

                </label>

                <input

                  type="password"

                  value={deletePassword}

                  onChange={(e) => setDeletePassword(e.target.value)}

                  placeholder="Your password"

                  style={{

                    width: "100%",

                    padding: "10px 12px",

                    borderRadius: 8,

                    border: "1px solid rgba(99,102,241,0.3)",

                    background: "rgba(15,23,42,0.8)",

                    color: "#fff",

                    fontSize: 16,

                    outline: "none"

                  }}

                />

              </div>

              <div style={{ display: "flex", gap: 12 }}>

                <button

                  onClick={() => {

                    setShowDeleteModal(false);

                    setDeletePassword("");

                  }}

                  disabled={deleteLoading}

                  style={{

                    flex: 1,

                    padding: "10px 16px",

                    borderRadius: 8,

                    border: "1px solid rgba(99,102,241,0.3)",

                    background: "rgba(30,41,59,0.7)",

                    color: "#a5b4fc",

                    cursor: deleteLoading ? "not-allowed" : "pointer",

                    fontWeight: 600

                  }}

                >

                  Cancel

                </button>

                <button

                  onClick={async () => {

                    if (!deletePassword.trim()) {

                      toast.warning("Please enter your password");

                      return;

                    }

                    setDeleteLoading(true);

                    try {

                      const response = await fetch(`${API_BASE}/auth/delete-account`, {

                        method: "DELETE",

                        headers: {

                          "Content-Type": "application/json",

                          "Authorization": `Bearer ${token}`

                        },

                        body: JSON.stringify({ password: deletePassword })

                      });

                      const data = await response.json();

                      if (!response.ok) {

                        throw new Error(data.error || "Failed to delete account");

                      }

                      toast.success("Account deleted successfully");

                      localStorage.clear();

                      setToken("");

                      setAuth({ username: "", password: "", user: null, error: "" });

                      window.location.href = "/";

                    } catch (e) {

                      toast.error(e.message || "Failed to delete account");

                    } finally {

                      setDeleteLoading(false);

                    }

                  }}

                  disabled={deleteLoading}

                  style={{

                    flex: 1,

                    padding: "10px 16px",

                    borderRadius: 8,

                    border: "none",

                    background: "#ef4444",

                    color: "white",

                    cursor: deleteLoading ? "not-allowed" : "pointer",

                    fontWeight: 600

                  }}

                >

                  {deleteLoading ? "Deleting..." : "Delete"}

                </button>

              </div>

            </div>

          </div>

        )}



        </>



      )}






      {tab === "aitutor" && (
        <AISectionOverlay
          key={aiKey}
          defaultView={aiDefaultView}
          studyTopic={aiStudyTopic}
          studyMode={aiStudyMode}
          studyAttachment={aiStudyAttachment}
          aiConfig={aiConfig}
          subjects={subjects}
          onExit={() => setTab("today")}
        />
      )}

      {tab === "aitutor_legacy" && (

        <div>

          {/* AI Tutor Hub sub-tabs */}

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>

            <button

              onClick={() => setAiTutorSubTab("chat")}

              style={{

                padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,

                border: aiTutorSubTab === "chat" ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.25)",

                background: aiTutorSubTab === "chat" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(30,41,59,0.6)",

                color: aiTutorSubTab === "chat" ? "#fff" : "#a5b4fc",

              }}

            >🤖 AI Chat</button>

            <button

              onClick={() => setAiTutorSubTab("lectures")}

              style={{

                padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,

                border: aiTutorSubTab === "lectures" ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.25)",

                background: aiTutorSubTab === "lectures" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(30,41,59,0.6)",

                color: aiTutorSubTab === "lectures" ? "#fff" : "#a5b4fc",

              }}

            >🎓 Lecture to Notes</button>

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

                icon="🎓"

                features={["Unlimited lecture conversions", "AI-powered summaries", "Auto-generated flashcards", "Key term extraction"]}

                showPlans={true}

              />

            ) : (

              <>

                {demoMode && (

                  <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>

                    <span style={{ fontSize: 13 }}>⚡ Demo: {DEMO_LIMITS.lectureToNotesDaily - (demoUsage.lectureToNotesDate === new Date().toDateString() ? demoUsage.lectureToNotesUsed : 0)} conversion(s) remaining today.</span>

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

        <StudentProfile

          profile={studentProfile}

          authUser={auth.user}

          onSave={(p) => updateStudentProfile(p)}

        />

      )}



      {tab === "notifications" && (

        <NotificationsTab

          token={token}

          currentUser={auth.user}

        />

      )}



      {tab === "lecturers" && (

        <Lecturers

          token={token}

          currentUser={auth.user}

          isTeacher={isFaculty}

        />

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

      background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))",

      border: "1px solid rgba(99, 102, 241, 0.2)",

      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)",

      borderRadius: 20,

      overflow: "hidden"

    }}>

      {/* Animated Header */}

      <div style={{ 

        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))",

        padding: "20px 24px",

        borderBottom: "1px solid rgba(99, 102, 241, 0.2)"

      }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

            <div style={{

              width: 48,

              height: 48,

              borderRadius: 12,

              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",

              display: "flex",

              alignItems: "center",

              justifyContent: "center",

              fontSize: 24,

              boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)"

            }}>

              {session.source.icon}

            </div>

            <div>

              <h3 style={{ margin: 0, fontSize: 18, background: "linear-gradient(135deg, #fff, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{session.source.label}</h3>

              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{session.mode === "exam" ? "Exam Mode" : session.mode === "weak" ? "Weak Drill" : session.mode === "adaptive" ? "Adaptive" : "Practice"}</p>

            </div>

          </div>

          

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>

            {/* Timer for Exam Mode */}

            {timeLeft != null && (

              <div style={{

                background: timeLeft < 60 ? "linear-gradient(135deg, #ef4444, #dc2626)" : "rgba(30, 41, 59, 0.8)",

                border: "1px solid " + (timeLeft < 60 ? "rgba(239, 68, 68, 0.5)" : "rgba(99, 102, 241, 0.3)"),

                padding: "8px 16px",

                borderRadius: 30,

                fontSize: 14,

                fontWeight: 700,

                color: "#fff",

                animation: timeLeft < 60 ? "pulse 1s infinite" : "none"

              }}>

                ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}

              </div>

            )}

            

            {/* Question Counter */}

            <div style={{

              background: "rgba(30, 41, 59, 0.8)",

              border: "1px solid rgba(99, 102, 241, 0.3)",

              padding: "8px 16px",

              borderRadius: 30,

              fontSize: 13,

              fontWeight: 600,

              color: "#e0e7ff"

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

              <span style={{ fontSize: 16 }}>⚡</span>

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

                <span style={{ fontSize: 16 }}>🔥</span>

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

              ✕ Exit

            </button>

          </div>

        </div>

      </div>



      {/* Progress Bar */}

      <div style={{ padding: "0 24px", marginTop: 20 }}>

        <div style={{ 

          height: 6, 

          background: "rgba(30, 41, 59, 0.8)", 

          borderRadius: 10, 

          overflow: "hidden",

          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)"

        }}>

          <div style={{

            height: "100%",

            width: `${((idx + 1) / session.questions.length) * 100}%`,

            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",

            borderRadius: 10,

            transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",

            boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)"

          }} />

        </div>

      </div>

      

      {/* Running Score for Exam */}

      {isExamLike && (

        <div style={{ padding: "12px 24px 0" }}>

          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>

            Running score: <span style={{ color: "#e0e7ff" }}>{score}/{Math.max(1, idx + (showResult ? 1 : 0))}</span>

            {perQuestionTarget && <span> · Pace: ~{perQuestionTarget}s/question</span>}

          </p>

        </div>

      )}



      {/* Question */}

      <div style={{ padding: "24px" }}>

        <div style={{

          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))",

          borderRadius: 16,

          padding: 20,

          marginBottom: 20,

          border: "1px solid rgba(99, 102, 241, 0.15)",

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

              background: flaggedQuestions.has(idx) ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.1)",

              border: flaggedQuestions.has(idx) ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(99, 102, 241, 0.2)",

              padding: "8px 12px",

              borderRadius: 8,

              cursor: "pointer",

              fontSize: 14,

              color: flaggedQuestions.has(idx) ? "#f87171" : "#a5b4fc"

            }}

            title="Flag for review"

          >

            {flaggedQuestions.has(idx) ? "🚩" : "🏳️"}

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

                background: "rgba(30, 41, 59, 0.8)",

                border: "1px solid rgba(99, 102, 241, 0.3)",

                borderRadius: 8,

                padding: "8px 12px",

                color: "#e0e7ff",

                fontSize: 14

              }}

            >

              <option value="unsure">🤔 Unsure</option>

              <option value="okay">😊 Okay</option>

              <option value="sure">😎 Sure</option>

            </select>

          </div>

          <button

            onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(current.q))}

            style={{

              background: "rgba(99, 102, 241, 0.2)",

              border: "1px solid rgba(99, 102, 241, 0.3)",

              padding: "8px 16px",

              borderRadius: 8,

              color: "#a5b4fc",

              fontSize: 14,

              cursor: "pointer"

            }}

          >

            🔊 Read

          </button>

        </div>



        {/* Options */}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {current.options.map((opt, i) => {

            const isSelected = selected === i;

            const isCorrectOption = showResult && i === current.answer;

            const isWrong = showResult && i === selected && i !== current.answer;

            

            let bgGradient = "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))";

            let borderColor = "rgba(99, 102, 241, 0.2)";

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

              bgGradient = "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1))";

              borderColor = "rgba(99, 102, 241, 0.5)";

              glowColor = "rgba(99, 102, 241, 0.3)";

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

                                : isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" 

                                : "rgba(99, 102, 241, 0.2)",

                      display: "flex",

                      alignItems: "center",

                      justifyContent: "center",

                      fontWeight: 700,

                      fontSize: 14,

                      color: isSelected || isCorrectOption ? "#fff" : "#a5b4fc"

                    }}>

                      {isCorrectOption ? "✓" : isWrong ? "✗" : String.fromCharCode(65 + i)}

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

            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))",

            borderRadius: 16, 

            padding: 20,

            border: "1px solid rgba(59, 130, 246, 0.2)"

          }}>

            <p style={{ color: "#93c5fd", fontSize: 14, lineHeight: 1.6, margin: 0 }}>

              💡 {current.explanation || "No explanation available."}

            </p>

            

            {/* AI Explanation Button */}

            <div style={{ marginTop: 16 }}>

              <button 

                onClick={askAIForExplanation} 

                disabled={aiLoading}

                style={{ 

                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",

                  border: "none",

                  padding: "10px 20px",

                  borderRadius: 10,

                  color: "white",

                  fontSize: 14,

                  fontWeight: 600,

                  cursor: aiLoading ? "wait" : "pointer",

                  boxShadow: "0 4px 15px rgba(59, 130, 246, 0.4)"

                }}

              >

                {aiLoading ? "🤖 Thinking..." : "🤖 Ask AI to explain"}

              </button>

              {aiExplanation && (

                <div style={{ 

                  marginTop: 12, 

                  padding: 16, 

                  background: "rgba(30, 41, 59, 0.6)", 

                  border: "1px solid rgba(59, 130, 246, 0.3)", 

                  borderRadius: 12,

                  fontSize: 14,

                  lineHeight: 1.6,

                  color: "#93c5fd"

                }}>

                  <strong style={{ color: "#60a5fa" }}>AI Explanation:</strong>

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

              background: selected == null ? "rgba(99, 102, 241, 0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",

              color: "white",

              border: "none",

              padding: "14px 28px",

              borderRadius: 12,

              cursor: selected == null ? "not-allowed" : "pointer",

              fontSize: 15,

              fontWeight: 600,

              boxShadow: selected == null ? "none" : "0 4px 20px rgba(99, 102, 241, 0.4)",

              transition: "all 0.2s"

            }}

          >

            {isExamLike && idx === session.questions.length - 1 ? "Submit Exam 📝" : "Submit →"}

          </button>

        ) : (

          <button

            onClick={next}

            style={{

              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",

              color: "white",

              border: "none",

              padding: "14px 28px",

              borderRadius: 12,

              cursor: "pointer",

              fontSize: 15,

              fontWeight: 600,

              boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",

              transition: "all 0.2s"

            }}

          >

            {idx === session.questions.length - 1 ? "Finish 🎉" : "Next Question →"}

          </button>

        )}

      </div>

    </div>



  );

}













function Classroom({ subjects, assignments, teacherMode, setTeacherMode, onCreate, onComplete, onImportQuestions, token, currentUser }) {



  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");



  const [title, setTitle] = useState("");



  const [due, setDue] = useState("");



  const [classrooms, setClassrooms] = useState([]);



  const [selectedClassroom, setSelectedClassroom] = useState(null);



  const [loading, setLoading] = useState(true);



  const [initialLoadDone, setInitialLoadDone] = useState(false);



  const [showCreateClass, setShowCreateClass] = useState(false);



  const [newClassName, setNewClassName] = useState("");



  // Join classroom state (for students)

  const [showJoinClass, setShowJoinClass] = useState(false);

  const [joinClassCode, setJoinClassCode] = useState("");

  const [joinError, setJoinError] = useState("");



  // Link state

  const [newLinkTitle, setNewLinkTitle] = useState("");

  const [newLinkUrl, setNewLinkUrl] = useState("");

  const [popupLink, setPopupLink] = useState(null);



  // Announcement state

  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", isImportant: false });

  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(null);



  // Document state

  const [uploadingDoc, setUploadingDoc] = useState(false);



  // Exam state

  const [showExamModal, setShowExamModal] = useState(false);

  const [newExam, setNewExam] = useState({ title: "", examDate: "", duration: 60 });



  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";



  // Fetch classrooms

  useEffect(() => {

    if (!token) return;

    fetch(`${API_BASE}/classroom/my`, {

      headers: { Authorization: `Bearer ${token}` }

    })

      .then((r) => r.json())

      .then((data) => {

        setClassrooms(data || []);

        if (data && data.length > 0 && !selectedClassroom) {

          setSelectedClassroom(data[0]);

        }

      })

      .catch(() => {})

      .finally(() => {

        setLoading(false);

        setInitialLoadDone(true);

      });

  }, [token]);



  // Fetch classroom details when selected

  useEffect(() => {

    if (!token || !selectedClassroom?.id) return;

    fetch(`${API_BASE}/classroom/${selectedClassroom.id}`, {

      headers: { Authorization: `Bearer ${token}` }

    })

      .then((r) => r.json())

      .then((data) => setSelectedClassroom(data))

      .catch(() => {});

  }, [token, selectedClassroom?.id]);



  // Check for new important announcements on mount

  useEffect(() => {

    if (selectedClassroom?.announcements) {

      const unreadImportant = selectedClassroom.announcements.find(

        (a) => a.isImportant && (!a.reads || a.reads.length === 0)

      );

      if (unreadImportant) {

        setShowAnnouncementPopup(unreadImportant);

      }

    }

  }, [selectedClassroom?.announcements]);



  // Create classroom

  async function createClassroom() {

    if (!newClassName.trim()) return;

    try {

      const res = await fetch(`${API_BASE}/classroom`, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify({ name: newClassName, subjectId }),

      });

      const data = await res.json();

      setClassrooms((prev) => [...prev, data]);

      setNewClassName("");

      setShowCreateClass(false);

    } catch (err) {

      console.error("Failed to create classroom:", err);

    }

  }



  // Join classroom (student)

  async function joinClassroom() {

    if (!joinClassCode.trim()) return;

    setJoinError("");

    try {

      const res = await fetch(`${API_BASE}/classroom/${joinClassCode}/join`, {

        method: "POST",

        headers: { Authorization: `Bearer ${token}` },

      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to join classroom");

      // Refresh classrooms

      const classroomsRes = await fetch(`${API_BASE}/classroom/my`, {

        headers: { Authorization: `Bearer ${token}` }

      });

      const classroomsData = await classroomsRes.json();

      setClassrooms(classroomsData || []);

      if (classroomsData && classroomsData.length > 0) {

        setSelectedClassroom(classroomsData[classroomsData.length - 1]);

      }

      setJoinClassCode("");

      setShowJoinClass(false);

    } catch (err) {

      setJoinError(err.message);

    }

  }



  // Add link

  async function addLink() {

    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    try {

      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/links`, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify({ title: newLinkTitle, url: newLinkUrl }),

      });

      const link = await res.json();

      setSelectedClassroom((prev) => ({

        ...prev,

        links: [...(prev.links || []), link],

      }));

      setNewLinkTitle("");

      setNewLinkUrl("");

    } catch (err) {

      console.error("Failed to add link:", err);

    }

  }



  // Create announcement

  async function createAnnouncement() {

    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;

    try {

      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/announcements`, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify(newAnnouncement),

      });

      const announcement = await res.json();

      setSelectedClassroom((prev) => ({

        ...prev,

        announcements: [announcement, ...(prev.announcements || [])],

      }));

      setNewAnnouncement({ title: "", content: "", isImportant: false });

    } catch (err) {

      console.error("Failed to create announcement:", err);

    }

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

      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/documents`, {

        method: "POST",

        headers: { Authorization: `Bearer ${token}` },

        body: formData,

      });

      const doc = await res.json();

      setSelectedClassroom((prev) => ({

        ...prev,

        documents: [...(prev.documents || []), doc],

      }));

    } catch (err) {

      console.error("Failed to upload document:", err);

    } finally {

      setUploadingDoc(false);

    }

  }



  // Create exam

  async function createExam() {

    if (!newExam.title.trim() || !newExam.examDate) return;

    try {

      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/exams`, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify(newExam),

      });

      const exam = await res.json();

      setSelectedClassroom((prev) => ({

        ...prev,

        exams: [...(prev.exams || []), exam],

      }));

      setShowExamModal(false);

      setNewExam({ title: "", examDate: "", duration: 60 });

    } catch (err) {

      console.error("Failed to create exam:", err);

    }

  }



  // Mark announcement as read

  async function markAnnouncementRead(announcementId) {

    try {

      await fetch(`${API_BASE}/classroom/announcements/${announcementId}/read`, {

        method: "POST",

        headers: { Authorization: `Bearer ${token}` },

      });

    } catch (err) {

      console.error("Failed to mark as read:", err);

    }

  }



  // Calculate days until exam

  function getDaysUntilExam(examDate) {

    const now = new Date();

    const exam = new Date(examDate);

    const diff = exam - now;

    return Math.ceil(diff / (1000 * 60 * 60 * 24));

  }



  const [classTab, setClassTab] = useState("announcements");
  const isHost = teacherMode && selectedClassroom?.createdById === (currentUser?.id || currentUser?.sub);

  const CL = {
    card: "#0d0f1f", line: "#1e2140", border: "#3949ab",
    text: "#e8eaf6", muted: "#7b82b8", hint: "#4a5080", faint: "#12142a",
  };

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: CL.text, fontFamily: "Syne,sans-serif", flex: 1 }}>🏫 Classroom</div>
        {teacherMode
          ? <button onClick={() => setShowCreateClass(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, color: CL.border, cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>+ New Class</button>
          : <button onClick={() => setShowJoinClass(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, color: CL.border, cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>🔗 Join Class</button>
        }
      </div>

      {loading && !initialLoadDone && <p style={{ color: CL.muted, fontSize: 13 }}>Loading…</p>}

      {/* ── Empty states ── */}
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
            : <button onClick={() => setShowJoinClass(true)} style={{ background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 10, padding: "8px 18px", fontSize: 12, color: "#c5cae9", cursor: "pointer" }}>🔗 Join a Classroom</button>
          }
        </div>
      )}

      {/* ── Two-panel layout ── */}
      {classrooms.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>

          {/* Left sidebar — classroom list */}
          <div style={{ width: 180, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {classrooms.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedClassroom(c)}
                style={{
                  background: selectedClassroom?.id === c.id ? "#1a237e" : CL.card,
                  border: `0.5px solid ${selectedClassroom?.id === c.id ? CL.border : CL.line}`,
                  borderRadius: 12, padding: "10px 12px", cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: CL.text, fontFamily: "Manrope,sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontSize: 10, color: CL.hint }}>{c._count?.members ?? 0} members</div>
              </div>
            ))}
          </div>

          {/* Right panel — classroom content */}
          <div style={{ flex: 1, minWidth: 0 }}>
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
                    {/* Exam countdown badge */}
                    {selectedClassroom.exams?.length > 0 && (
                      <div style={{ background: "#1a0800", border: "0.5px solid #4a2000", borderRadius: 10, padding: "5px 10px", fontSize: 11, color: "#ffb74d" }}>
                        📅 {getDaysUntilExam(selectedClassroom.exams[0].examDate)}d until {selectedClassroom.exams[0].title}
                        <button onClick={() => { if (window.confirm("Start Exam Mode?")) window.dispatchEvent(new CustomEvent("startExamMode", { detail: selectedClassroom.exams[0] })); }}
                          style={{ marginLeft: 8, background: "#ef4444", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#fff", cursor: "pointer" }}>Prep</button>
                      </div>
                    )}
                    {teacherMode && (
                      <button onClick={() => setShowExamModal(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "5px 11px", fontSize: 11, color: CL.muted, cursor: "pointer" }}>📅 Add Exam</button>
                    )}
                  </div>
                </div>

                {/* Pill tabs */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {[
                    { id: "announcements", label: "📢 Announcements" },
                    { id: "sessions",      label: "🎥 Live Sessions" },
                    { id: "assignments",   label: "📝 Assignments" },
                    { id: "docs",          label: "📄 Docs & Links" },
                    { id: "attendance",    label: "📋 Attendance" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setClassTab(t.id)} style={{
                      background: classTab === t.id ? "#1a237e" : CL.faint,
                      border: `0.5px solid ${classTab === t.id ? CL.border : CL.line}`,
                      borderRadius: 20, padding: "6px 13px", fontSize: 11,
                      color: classTab === t.id ? "#c5cae9" : CL.hint,
                      cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600,
                    }}>{t.label}</button>
                  ))}
                </div>

                {/* ── Announcements tab ── */}
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
                          <div style={{ fontSize: 12, fontWeight: 700, color: a.isImportant ? "#ffb74d" : CL.text, marginBottom: 4 }}>{a.isImportant ? "⚠️ " : ""}{a.title}</div>
                          <div style={{ fontSize: 12, color: CL.muted, lineHeight: 1.6 }}>{a.content}</div>
                          <div style={{ fontSize: 10, color: CL.hint, marginTop: 5 }}>{new Date(a.createdAt).toLocaleString()}</div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* ── Live Sessions tab ── */}
                {classTab === "sessions" && (
                  <LiveSessionsPanel classroomId={selectedClassroom.id} classroomName={selectedClassroom.name} isHost={isHost} currentUser={currentUser} token={token} />
                )}

                {/* ── Assignments tab ── */}
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
                                <div style={{ fontSize: 10, color: CL.hint }}>{subj?.label || ""}{a.due ? ` · Due ${a.due}` : ""}</div>
                              </div>
                              <button onClick={() => onComplete(a.id)} style={{ background: a.done ? "#071410" : "#1a237e", border: `0.5px solid ${a.done ? "#0a3020" : CL.border}`, borderRadius: 9, padding: "5px 12px", fontSize: 11, color: a.done ? "#81c784" : "#c5cae9", cursor: "pointer" }}>{a.done ? "✓ Done" : "Mark Done"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Docs & Links tab ── */}
                {classTab === "docs" && (
                  <div>
                    {/* Links */}
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
                          <button key={link.id} onClick={() => setPopupLink(link)} style={{ background: "#0a0c1e", border: `0.5px solid #2a2d6a`, borderRadius: 20, padding: "6px 13px", fontSize: 11, color: "#9fa8da", cursor: "pointer" }}>🔗 {link.title}</button>
                        ))}
                        {!(selectedClassroom.links?.length) && <span style={{ fontSize: 12, color: CL.hint }}>No links yet.</span>}
                      </div>
                    </div>

                    {/* Documents */}
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
                          <span style={{ fontSize: 18 }}>{doc.fileType === "pdf" ? "📕" : doc.fileType === "docx" ? "📘" : "📄"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: CL.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                            <div style={{ fontSize: 10, color: CL.hint }}>{doc.fileType?.toUpperCase()} · {(doc.fileSize / 1024).toFixed(1)} KB</div>
                          </div>
                          <button onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/classroom/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
                              if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Download failed`); }
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

                {/* ── Attendance tab ── */}
                {classTab === "attendance" && (
                  <AttendancePanel classroomId={selectedClassroom.id} isHost={isHost} token={token} />
                )}

                {/* Teacher tools */}
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

          <div className="modal-content" onClick={(e) => e.stopPropagation()}>

            <h3>Create New Classroom</h3>

            <input

              value={newClassName}

              onChange={(e) => setNewClassName(e.target.value)}

              placeholder="Classroom name (e.g., 'MTH111 - 2024')"

              style={{ width: "100%", marginBottom: 12 }}

            />

            <select

              value={subjectId}

              onChange={(e) => setSubjectId(e.target.value)}

              style={{ width: "100%", marginBottom: 12 }}

            >

              <option value="">Select Subject (optional)</option>

              {subjects.map((s) => (

                <option key={s.id} value={s.id}>{s.label}</option>

              ))}

            </select>

            <div className="row">

              <button onClick={() => setShowCreateClass(false)}>Cancel</button>

              <button onClick={createClassroom}>Create</button>

            </div>

          </div>

        </div>

      )}



      {/* Join Class Modal */}

      {showJoinClass && (

        <div className="modal-overlay" onClick={() => setShowJoinClass(false)}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()}>

            <h3>🔗 Join Classroom</h3>

            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>

              Enter the Classroom ID provided by your teacher.

            </p>

            <input

              value={joinClassCode}

              onChange={(e) => setJoinClassCode(e.target.value)}

              placeholder="Classroom ID (e.g., 'abc123')"

              style={{ width: "100%", marginBottom: 8 }}

            />

            {joinError && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{joinError}</p>}

            <div className="row">

              <button onClick={() => { setShowJoinClass(false); setJoinError(""); }}>Cancel</button>

              <button onClick={joinClassroom}>Join</button>

            </div>

          </div>

        </div>

      )}



      {/* Link Popup Modal */}

      {popupLink && (

        <div className="modal-overlay" onClick={() => setPopupLink(null)}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>

            <h3>🔗 {popupLink.title}</h3>

            <p style={{ wordBreak: "break-all", color: "#a5b4fc", marginBottom: 16 }}>

              {popupLink.url}

            </p>

            <div className="row">

              <button onClick={() => setPopupLink(null)}>Close</button>

              <button

                onClick={() => {

                  window.open(popupLink.url, "_blank");

                  setPopupLink(null);

                }}

                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}

              >

                Open Link

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Important Announcement Popup */}

      {showAnnouncementPopup && (

        <div className="modal-overlay" onClick={() => {

          markAnnouncementRead(showAnnouncementPopup.id);

          setShowAnnouncementPopup(null);

        }}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{

            maxWidth: 500,

            border: "2px solid rgba(239, 68, 68, 0.5)",

            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(239, 68, 68, 0.1))"

          }}>

            <div style={{ textAlign: "center", marginBottom: 16 }}>

              <span style={{ fontSize: 40 }}>⚠️</span>

              <h3 style={{ color: "#fbbf24" }}>Important Announcement</h3>

            </div>

            <h4>{showAnnouncementPopup.title}</h4>

            <p style={{ marginBottom: 16 }}>{showAnnouncementPopup.content}</p>

            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>

              Posted: {new Date(showAnnouncementPopup.createdAt).toLocaleString()}

            </div>

            <button

              onClick={() => {

                markAnnouncementRead(showAnnouncementPopup.id);

                setShowAnnouncementPopup(null);

              }}

              style={{ width: "100%" }}

            >

              Got it!

            </button>

          </div>

        </div>

      )}



      {/* Exam Modal */}

      {showExamModal && (

        <div className="modal-overlay" onClick={() => setShowExamModal(false)}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()}>

            <h3>📅 Add Exam</h3>

            <input

              value={newExam.title}

              onChange={(e) => setNewExam((prev) => ({ ...prev, title: e.target.value }))}

              placeholder="Exam title (e.g., 'MTH111 Mid-Semester')"

              style={{ width: "100%", marginBottom: 12 }}

            />

            <input

              type="datetime-local"

              value={newExam.examDate}

              onChange={(e) => setNewExam((prev) => ({ ...prev, examDate: e.target.value }))}

              style={{ width: "100%", marginBottom: 12 }}

            />

            <input

              type="number"

              value={newExam.duration}

              onChange={(e) => setNewExam((prev) => ({ ...prev, duration: parseInt(e.target.value) }))}

              placeholder="Duration (minutes)"

              style={{ width: "100%", marginBottom: 12 }}

            />

            <div className="row">

              <button onClick={() => setShowExamModal(false)}>Cancel</button>

              <button onClick={createExam}>Add Exam</button>

            </div>

          </div>

        </div>

      )}



      {/* Teacher Tools */}

      {teacherMode && <BulkImport onImportQuestions={onImportQuestions} />}

      {teacherMode && <AIQuestionGen onImportQuestions={onImportQuestions} />}

    </div>

  );

}













function AIHelper({ aiConfig, onUsed }) {



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

      subjectIcon: "✨",

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



                <p className="flashcard-answer">{card.back}</p>



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



  const [loading, setLoading] = useState(true);



  const [initialLoadDone, setInitialLoadDone] = useState(false);



  const [timePeriod, setTimePeriod] = useState("all"); // all, weekly, monthly



  const [subjectFilter, setSubjectFilter] = useState("all"); // all, or subject ID



  const [selectedUser, setSelectedUser] = useState(null); // For profile modal



  const [userProfileData, setUserProfileData] = useState(null);



  const [loadingProfile, setLoadingProfile] = useState(false);



  const API_BASE_LB = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";







  useEffect(() => {



    if (!token) return;



    const params = new URLSearchParams();

    if (timePeriod !== "all") params.append("period", timePeriod);

    if (subjectFilter !== "all") params.append("subjectId", subjectFilter);



    fetch(`${API_BASE_LB}/users/leaderboard?${params}`, { headers: { Authorization: `Bearer ${token}` } })



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

    fetch(`${API_BASE_LB}/users/${selectedUser.userId}/profile`, {

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

      <div className="filter-tabs">

        {["all", "daily", "weekly", "monthly"].map((period) => (

          <button

            key={period}

            className={`filter-tab ${timePeriod === period ? 'active' : ''}`}

            onClick={() => setTimePeriod(period)}

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

            padding: "8px 14px",

            background: "rgba(30, 41, 59, 0.8)",

            color: "white",

            border: "1px solid rgba(99, 102, 241, 0.3)",

            borderRadius: 8,

            cursor: "pointer",

            fontSize: 13

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

        <div className="leaderboard-mvp">

          <div className="crown">👑</div>

          <div className="mvp-title">MVP of the Week</div>

          <div className="mvp-name">{mvp.username}</div>

          <div className="mvp-xp">{mvp.xp} XP</div>

        </div>

      )}



      {loading && !initialLoadDone && <p className="muted">Loading...</p>}



      <div className="history" style={{ gap: 10 }}>



        {ranked.map((entry, i) => {

          const tier = getTier(entry.totalXP || entry.xp);

          const activityStatus = getActivityStatus(entry.lastActive);

          const streakEmoji = getStreakEmoji(entry.streak);

          const earnedBadges = calculateBadges(entry);



          return (

            <div

              key={entry.username}

              className={`leaderboard-row ${entry.isMe ? 'is-me' : ''} ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}`}

              onClick={() => !entry.isMe && setSelectedUser(entry)}

              style={{ cursor: entry.isMe ? 'default' : 'pointer' }}

            >



              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>

                <div className={`leaderboard-rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}`}>

                  {medals[i] || `#${i + 1}`}

                </div>

                {/* Daily Rank Badge */}

                {entry.dailyRank && entry.dailyRank <= 10 && (

                  <div style={{

                    background: entry.dailyRank <= 3 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'rgba(99, 102, 241, 0.2)',

                    color: entry.dailyRank <= 3 ? '#000' : '#a5b4fc',

                    padding: '2px 8px',

                    borderRadius: 12,

                    fontSize: 10,

                    fontWeight: 600,

                    display: 'flex',

                    alignItems: 'center',

                    gap: 4

                  }}>

                    📅 #{entry.dailyRank} today

                  </div>

                )}

                <div className="leaderboard-user-info">

                  <div className="leaderboard-username">

                    {entry.username} {entry.isMe ? <span style={{ color: '#22c55e', fontSize: 12 }}>(you)</span> : <span style={{ color: '#6366f1', fontSize: 10 }}>→ View Profile</span>}

                    {tier && (

                      <span className="leaderboard-tier" style={{ background: tier.color, color: tier.color === '#facc15' || tier.color === '#94a3b8' ? '#000' : '#fff' }}>

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



              <div className="leaderboard-stats">

                <span className="leaderboard-stat">

                  <strong>{entry.xp} XP</strong>

                  {entry.dailyXP !== undefined && entry.dailyXP > 0 && (

                    <span style={{ color: '#22c55e', fontSize: 10, marginLeft: 4 }}>+{entry.dailyXP} today</span>

                  )}

                </span>

                <span className="leaderboard-stat">

                  {entry.sessions} sessions

                </span>

                {entry.streak > 0 && (

                  <span className="leaderboard-stat">

                    {streakEmoji} {entry.streak} day streak

                  </span>

                )}

                <span className="leaderboard-stat" style={{ marginLeft: 'auto', fontSize: 11 }}>

                  Mastery: {entry.avgMastery}% | Correct: {entry.correctRate}%

                </span>

              </div>



            </div>

          );

        })}



      </div>



      {/* User Profile Modal */}

      {selectedUser && (

        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>

            <button className="modal-close" onClick={() => setSelectedUser(null)}>×</button>



            {loadingProfile ? (

              <p className="muted">Loading profile...</p>

            ) : userProfileData && (

              <div>

                <h3 style={{ marginBottom: 16 }}>{userProfileData.username}'s Profile</h3>



                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>

                  <div className="stat-card" style={{ padding: 12, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8 }}>

                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Total XP</div>

                    <div style={{ fontSize: 20, fontWeight: 600, color: '#a5b4fc' }}>{userProfileData.xp}</div>

                  </div>

                  <div className="stat-card" style={{ padding: 12, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8 }}>

                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Sessions</div>

                    <div style={{ fontSize: 20, fontWeight: 600, color: '#4ade80' }}>{userProfileData.sessions}</div>

                  </div>

                  <div className="stat-card" style={{ padding: 12, background: 'rgba(251, 146, 60, 0.1)', borderRadius: 8 }}>

                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Streak</div>

                    <div style={{ fontSize: 20, fontWeight: 600, color: '#fb923c' }}>{userProfileData.streak} days</div>

                  </div>

                  <div className="stat-card" style={{ padding: 12, background: 'rgba(168, 85, 247, 0.1)', borderRadius: 8 }}>

                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Study Hours</div>

                    <div style={{ fontSize: 20, fontWeight: 600, color: '#c084fc' }}>{userProfileData.studyHours}h</div>

                  </div>

                </div>



                <div style={{ marginBottom: 16 }}>

                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Average Mastery</div>

                  <div style={{ height: 8, background: 'rgba(99, 102, 241, 0.2)', borderRadius: 4, overflow: 'hidden' }}>

                    <div style={{ width: `${userProfileData.avgMastery}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: 4 }} />

                  </div>

                  <div style={{ fontSize: 12, color: '#a5b4fc', marginTop: 4 }}>{userProfileData.avgMastery}%</div>

                </div>



                {userProfileData.badges && userProfileData.badges.length > 0 && (

                  <div style={{ marginBottom: 16 }}>

                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Badges Earned</div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>

                      {userProfileData.badges.map((badge, idx) => (

                        <span key={idx} style={{ fontSize: 20 }} title={badge.label}>{badge.icon}</span>

                      ))}

                    </div>

                  </div>

                )}



                {userProfileData.personalBest > 0 && (

                  <div style={{ padding: 12, background: 'rgba(250, 204, 21, 0.1)', borderRadius: 8 }}>

                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Personal Best (Exam)</div>

                    <div style={{ fontSize: 16, fontWeight: 600, color: '#facc15' }}>{userProfileData.personalBest}%</div>

                  </div>

                )}

              </div>

            )}

          </div>

        </div>

      )}



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



  const [loading, setLoading] = useState(false);

  const [preview, setPreview] = useState([]);

  const [error, setError] = useState("");



  async function generate() {

    if (!topic.trim()) return;

    setLoading(true); setError(""); setPreview([]);



    const prompt = `Generate exactly ${count} multiple-choice questions about "${topic}" for a first-year university student. Difficulty: ${difficulty}.\nReturn ONLY a JSON array with this structure (no extra text):\n[{"q":"question","options":["A","B","C","D"],"answer":0,"explanation":"why","difficulty":"${difficulty}"}]\nThe "answer" field is the index (0-3) of the correct option.`;



    try {

      const raw = await callAI(prompt, { provider: "openrouter", model: "qwen/qwen-2.5-7b-instruct" });

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

        content: "👋 Hello! I'm your AI Tutor. What should I teach you today? I can help you with any subject - just ask me a question or select a specific subject from the dropdown above.",

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

      content: "👋 Hello! I'm your AI Tutor. What should I teach you today? I can help you with any subject - just ask me a question or select a specific subject from the dropdown above.",

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

                          background: "#1e3a5f",

                          border: "1px solid #3b82f6",

                          color: "#60a5fa",

                          padding: "8px 16px",

                          borderRadius: 6,

                          cursor: "pointer",

                          fontSize: 13,

                          fontWeight: 500

                        }}

                      >

                        🔍 Break it down more

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

                          background: "#1e3a5f",

                          border: "1px solid #3b82f6",

                          color: "#60a5fa",

                          padding: "8px 16px",

                          borderRadius: 6,

                          cursor: "pointer",

                          fontSize: 13,

                          fontWeight: 500

                        }}

                      >

                        👶 Explain like I'm 6

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

        <button onClick={() => sendMessage()} disabled={loading || !message.trim()} style={{ borderColor: "#818cf8", color: "#818cf8" }}>

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

                      <span style={{ color: "#f87171", fontWeight: 600 }}>● Expired</span>

                    ) : s.isActivated ? (

                      <span style={{ color: "#34d399", fontWeight: 600 }}>● Active</span>

                    ) : (

                      <span style={{ color: "#f87171", fontWeight: 600 }}>○ Pending</span>

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



function LockedScreen({ activationKey, username, userRole, onLogout, onTryDemo, onRefresh, isChecking, onGetPremium, deferredPrompt, onInstall, isIOS }) {

  const [showActivationKey, setShowActivationKey] = useState(false);

  

  // Teachers and lecturers get auto-activated, so show simple confirmation

  const isFaculty = userRole === "TEACHER" || userRole === "LECTURER";

  

  if (isFaculty) {

    return (

      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>

        <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>

          <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>

          <h2>Account Created Successfully!</h2>

          <p className="muted" style={{ marginBottom: 24 }}>

            Welcome, <strong>{username}</strong>! Your {userRole?.toLowerCase()} account is ready to use.

          </p>

          <button onClick={onRefresh} style={{ padding: "12px 32px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>

            Continue to Dashboard

          </button>

        </div>

      </div>

    );

  }

  

  // Students see premium/demo options

  return (

    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "linear-gradient(135deg, rgba(59,130,246,0.05), rgba(139,92,246,0.05))" }}>

      <div style={{ maxWidth: 900, width: "100%" }}>

        {/* Install App Button - Top Right */}

        {deferredPrompt && !isIOS && (

          <div style={{ position: "absolute", top: 16, right: 16 }}>

            <button 

              onClick={onInstall}

              style={{

                padding: "10px 20px",

                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",

                color: "#fff",

                border: "none",

                borderRadius: 8,

                cursor: "pointer",

                fontSize: 14,

                fontWeight: 600,

                display: "flex",

                alignItems: "center",

                gap: 8,

                boxShadow: "0 4px 12px rgba(139,92,246,0.3)"

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

              background: "rgba(139,92,246,0.1)",

              border: "1px solid rgba(139,92,246,0.3)",

              borderRadius: 8,

              fontSize: 12,

              color: "#8b5cf6",

              maxWidth: 200,

              textAlign: "center"

            }}>

              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install

            </div>

          </div>

        )}

        

        {/* Header */}

        <div style={{ textAlign: "center", marginBottom: 32 }}>

          <div style={{ fontSize: 72, marginBottom: 16 }}>🎓</div>

          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Welcome to Scholar's Circle!</h1>

          <p className="muted" style={{ fontSize: 16 }}>Hi <strong>{username}</strong>, choose how you want to get started</p>

        </div>



        {/* Two equal option cards */}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 24 }}>

          

          {/* Premium Card */}

          <div className="card" style={{ 

            padding: 24, 

            textAlign: "center", 

            background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))",

            border: "2px solid rgba(59,130,246,0.3)",

            position: "relative"

          }}>

            <div style={{ position: "absolute", top: 12, right: 12, background: "#3b82f6", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>

              MOST POPULAR

            </div>

            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Premium Access</h3>

            <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>Unlimited access to all features</p>

            

            {/* Pricing */}

            <div style={{ marginBottom: 20 }}>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 8 }}>

                <span style={{ fontSize: 36, fontWeight: 800, color: "#3b82f6" }}>₦700</span>

                <span className="muted" style={{ fontSize: 14 }}>/week</span>

              </div>

              <div className="muted" style={{ fontSize: 12 }}>

                or ₦1,300/2 weeks • ₦2,400/month

              </div>

            </div>



            {/* Features */}

            <ul style={{ textAlign: "left", fontSize: 13, marginBottom: 24, lineHeight: 2, listStyle: "none", padding: 0 }}>

              <li>✓ Unlimited practice questions</li>

              <li>✓ Unlimited AI Tutor access</li>

              <li>✓ All subjects & past papers</li>

              <li>✓ Advanced analytics</li>

              <li>✓ Priority support</li>

            </ul>



            <button 

              onClick={onGetPremium}

              style={{ 

                width: "100%",

                padding: "14px 24px", 

                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", 

                color: "#fff", 

                border: "none", 

                borderRadius: 10, 

                cursor: "pointer", 

                fontSize: 16, 

                fontWeight: 700,

                boxShadow: "0 4px 14px rgba(59,130,246,0.4)",

                transition: "transform 0.2s, box-shadow 0.2s"

              }}

              onMouseEnter={e => {

                e.currentTarget.style.transform = "translateY(-2px)";

                e.currentTarget.style.boxShadow = "0 6px 20px rgba(59,130,246,0.5)";

              }}

              onMouseLeave={e => {

                e.currentTarget.style.transform = "translateY(0)";

                e.currentTarget.style.boxShadow = "0 4px 14px rgba(59,130,246,0.4)";

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

            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>

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

              <li>✓ All practice modes</li>

              <li>✓ AI Tutor access</li>

              <li>✓ All subjects unlocked</li>

              <li>✓ No daily limits</li>

              <li>✓ Full features for 2 days</li>

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

            <span>{showActivationKey ? "▼" : "▶"}</span>

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

                background: "rgba(59,130,246,0.1)", 

                border: "1px solid rgba(59,130,246,0.3)", 

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

                  background: isChecking ? "#3b82f6" : "#22c55e",

                  animation: isChecking ? "pulse 1s infinite" : "none"

                }}></span>

                <span style={{ fontSize: 11, color: isChecking ? "#3b82f6" : "#22c55e" }}>

                  {isChecking ? "Checking..." : "Auto-checking every 10s"}

                </span>

              </div>

              

              <button 

                onClick={onRefresh} 

                disabled={isChecking} 

                style={{ 

                  padding: "8px 20px", 

                  background: "#3b82f6", 

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


