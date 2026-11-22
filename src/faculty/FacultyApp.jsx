import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, School, FileText, Laptop, Megaphone, Folder,
  GraduationCap, Cog, Building2, KeyRound, Mail, User,
  ExternalLink, LogOut, Menu, X, BookOpen,
} from "lucide-react";
import { ensureAppSession, getStoredToken } from "../lib/authToken.js";
import { api } from "../lib/appUtils.js";
import { CUSTOM_QUESTIONS_KEY } from "../lib/constants.js";
import { lazyWithRetry } from "../lib/lazyWithRetry.js";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useUserData } from "../contexts/UserDataContext.jsx";
import { toast } from "../components/Toast.jsx";
import TabSkeleton from "../components/TabSkeleton.jsx";
import StaffLogin from "./StaffLogin.jsx";
import { IS_FACULTY_HOST, STUDENT_APP_URL } from "./env.js";
import "./faculty.css";
const STAFF_ROLES = new Set(["teacher", "lecturer", "admin"]);
const ADMIN_ROLES = new Set(["teacher", "admin"]);

const LecturerInsights = lazyWithRetry(() => import("../features/LecturerInsights.jsx"));
const ClassroomPage = lazyWithRetry(() => import("../pages/Classroom.jsx"));
const TeacherQuestionManager = lazyWithRetry(() => import("../features/TeacherQuestionManager.jsx"));
const TeacherResourcesHub = lazyWithRetry(() => import("../features/TeacherResourcesHub.jsx"));
const CampusComm = lazyWithRetry(() => import("../features/CampusComm.jsx"));
const Lecturers = lazyWithRetry(() => import("../features/Lecturers/index.jsx"));
const ResearchHub = lazyWithRetry(() => import("../features/research-hub/ResearchHub.jsx"));
const AdminDashboard = lazyWithRetry(() => import("../features/AdminDashboard.jsx"));
const UniversityManager = lazyWithRetry(() => import("../components/teacher/UniversityManager.jsx"));
const DepartmentManager = lazyWithRetry(() => import("../components/teacher/DepartmentManager.jsx"));
const TeacherInvitesPanel = lazyWithRetry(() => import("../features/TeacherInvites.jsx").then((m) => ({ default: m.TeacherInvitesPanel })));
const KeyManagement = lazyWithRetry(() => import("../components/AdminComponents.jsx").then((m) => ({ default: m.KeyManagement })));
const LecturerProfileEditor = lazyWithRetry(() => import("../features/Lecturers/LecturerProfileEditor.jsx").then((m) => ({ default: m.LecturerProfileEditor })));

const NAV_SECTIONS = [
  {
    label: "Teach",
    items: [
      // Insights is lecturer-facing (per-uploader material stats); admins
      // get the Dashboard as their home instead.
      ["insights", "Insights", BarChart3, ["lecturer"]],
      ["classroom", "Classroom", School],
      ["questions", "My Questions", FileText],
      ["resources", "Resources", Laptop],
      ["announce", "Announcements", Megaphone],
    ],
  },
  {
    label: "Study space",
    items: [
      ["space", "Space", Folder],
      ["directory", "Directory", GraduationCap],
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      ["dashboard", "Dashboard", Cog],
      ["universities", "Universities", Building2],
      ["departments", "Departments", Building2],
      ["keys", "Student Keys", KeyRound],
      ["invites", "Invites", Mail],
    ],
  },
  {
    label: "Account",
    items: [
      ["profile", "Profile", User],
    ],
  },
];

const VIEW_META = {
  insights: ["Insights", "Performance of your shared materials"],
  classroom: ["Classroom", "Classes, live sessions and assignments"],
  questions: ["My Questions", "Your question bank"],
  resources: ["Resources", "Upload and manage teaching materials"],
  announce: ["Announcements", "Campus communication"],
  space: ["Space", "Files and study materials"],
  directory: ["Directory", "Lecturers and public profiles"],
  dashboard: ["Dashboard", "Platform overview and admin tools"],
  universities: ["Universities", "Manage institutions"],
  departments: ["Departments", "Manage departments"],
  keys: ["Student Keys", "Activation keys and access"],
  invites: ["Invites", "Staff invite codes"],
  profile: ["Profile", "Your public staff profile"],
};

const Boot = () => (
  <div className="app dark fc-shell fc-boot">
    <aside className="fc-side">
      <div className="fc-brand">
        <span className="fc-brand-logo"><BookOpen size={17} /></span>
        <div><b>Scholar's Circle</b><span>Staff</span></div>
      </div>
      <div className="fc-boot-nav">
        {[96, 72, 88, 64, 80].map((w, i) => <div key={i} className="fc-skel" style={{ height: 34, width: `${w}%` }} />)}
      </div>
    </aside>
    <main className="fc-main">
      <div className="fc-boot-main">
        <div className="fc-skel" style={{ height: 22, width: 200 }} />
        <div className="fc-boot-row">
          {[0, 1, 2, 3].map((i) => <div key={i} className="fc-skel" style={{ height: 92 }} />)}
        </div>
        <div className="fc-skel" style={{ height: 260 }} />
      </div>
    </main>
  </div>
);

export default function FacultyApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();
  const { setSubjects, setAssignments } = useUserData();

  const [status, setStatus] = useState("checking"); // checking | guest | student | staff
  const [authUser, setAuthUser] = useState(null);
  const [backendSubjects, setBackendSubjects] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [epoch, setEpoch] = useState(0); // re-runs session bootstrap after sign-in

  const role = String(authUser?.role || "").toLowerCase();
  const isAdmin = ADMIN_ROLES.has(role);
  const token = getStoredToken() || "";

  const studentAppUrl = STUDENT_APP_URL;

  // AuthProvider rebuilds setUser/setToken on every render, so they must NOT
  // be effect deps: bootstrap -> setUser -> provider re-render -> new setters
  // -> bootstrap again was an endless spinner loop. Read them via a ref and
  // key the bootstrap on epoch only (once per mount / per sign-in).
  const authSettersRef = useRef({ setUser, setToken });
  authSettersRef.current = { setUser, setToken };

  useEffect(() => {
    let live = true;
    if (epoch > 0) setStatus("checking");
    ensureAppSession({ revalidate: true }).then((u) => {
      if (!live) return;
      if (!u) { setStatus("guest"); return; }
      const { setUser: su, setToken: st } = authSettersRef.current;
      setAuthUser(u);
      su?.(u);
      st?.(getStoredToken() || "");
      setStatus(STAFF_ROLES.has(String(u.role || "").toLowerCase()) ? "staff" : "student");
    }).catch(() => { if (live) setStatus("guest"); });
    return () => { live = false; };
  }, [epoch]);

  // UserDataContext rebuilds its setters on every state change, so hold them
  // in a ref — otherwise each fetch result re-creates these callbacks and the
  // load effect below refetches forever.
  const dataSettersRef = useRef({ setSubjects, setAssignments });
  dataSettersRef.current = { setSubjects, setAssignments };

  const refreshAssignments = useCallback(async () => {
    try {
      const rows = await api("/assignments");
      if (Array.isArray(rows)) dataSettersRef.current.setAssignments(rows);
    } catch { /* keep local fallback */ }
  }, []);

  const refreshSubjects = useCallback(async () => {
    try {
      const rows = await api("/subjects");
      if (Array.isArray(rows)) {
        setBackendSubjects(rows);
        dataSettersRef.current.setSubjects(rows); // same { id, label } shape Classroom expects
        try { localStorage.setItem("sc_subjects_cache", JSON.stringify(rows)); } catch { /* full */ }
      }
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    if (status !== "staff") return;
    refreshSubjects();
    refreshAssignments();
  }, [status, refreshSubjects, refreshAssignments]);

  // Imported classroom questions persist to the same key the student app reads.
  const onImportQuestions = useCallback((rows) => {
    try {
      const prev = JSON.parse(localStorage.getItem(CUSTOM_QUESTIONS_KEY) || "[]");
      localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify([...prev, ...rows]));
      toast.success(`Imported ${rows.length} questions`);
    } catch {
      toast.error("Import failed");
    }
  }, []);

  const homeView = isAdmin ? "dashboard" : "insights";
  const seg = location.pathname.split("/").filter(Boolean);
  const raw = IS_FACULTY_HOST ? (seg[0] || homeView) : (seg[1] || homeView);
  const allowed = (id) => NAV_SECTIONS.some(
    (s) => (!s.adminOnly || isAdmin) && s.items.some(([vid,,, roles]) => vid === id && (!roles || roles.includes(role)))
  );
  const view = allowed(raw) ? raw : homeView;
  const [pageTitle, pageSub] = VIEW_META[view] || ["", ""];
  const go = useCallback((v) => {
    setMenuOpen(false);
    navigate(IS_FACULTY_HOST ? `/${v}` : `/faculty/${v}`);
  }, [navigate]);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    try { localStorage.removeItem("scholars-circle-auth"); } catch { /* noop */ }
    setAuthUser(null);
    setUser?.(null);
    setStatus("guest");
  }, [setUser]);

  const displayName = authUser?.fullName || authUser?.username || authUser?.email || "Staff";
  const roleLabel = role === "lecturer" ? "Lecturer" : "Admin";
  const userCard = (
    <div className="fc-user">
      <span className="fc-avatar">{String(displayName).trim().charAt(0) || "S"}</span>
      <div className="fc-user-meta">
        <b>{displayName}</b>
        <span>{roleLabel}</span>
      </div>
      <button type="button" className="fc-iconbtn" aria-label="Sign out" title="Sign out" onClick={logout}>
        <LogOut size={15} />
      </button>
    </div>
  );

  if (status === "checking") return <Boot />;
  if (status === "guest") return <StaffLogin onSignedIn={() => setEpoch((e) => e + 1)} />;
  if (status === "student") {
    return (
      <div className="app dark fc-gate">
        <div className="fc-gate-card">
          <GraduationCap size={40} />
          <h1>Staff portal</h1>
          <p>This area is for lecturers, teachers and admins. Your account is a student account.</p>
          <a className="fc-btn" href={studentAppUrl}>Open Scholar's Circle</a>
          <button type="button" className="fc-linkbtn" onClick={logout}>Sign out and use a staff account</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app dark fc-shell">
      <aside className="fc-side">
        <div className="fc-brand">
          <span className="fc-brand-logo"><BookOpen size={17} /></span>
          <div>
            <b>Scholar's Circle</b>
            <span>Staff</span>
          </div>
        </div>
        <nav className="fc-nav">
          {NAV_SECTIONS.map((sec) => (sec.adminOnly && !isAdmin) ? null : (
            <div key={sec.label} className="fc-nav-sec">
              <span className="fc-nav-label">{sec.label}</span>
              {sec.items.filter(([,,, roles]) => !roles || roles.includes(role)).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={`fc-nav-item${view === id ? " active" : ""}`}
                  onClick={() => go(id)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="fc-side-foot">
          <a className="fc-nav-item" href={studentAppUrl}>
            <ExternalLink size={17} />
            <span>Student app</span>
          </a>
          {userCard}
        </div>
      </aside>

      <header className="fc-topbar">
        <button type="button" className="fc-iconbtn" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <b>Scholar's Circle · Staff</b>
        <span className="fc-topbar-user">
          <span className="fc-avatar">{String(displayName).trim().charAt(0) || "S"}</span>
          <span>{displayName}</span>
        </span>
      </header>

      {menuOpen && (
        <div className="fc-drawer-veil" onClick={() => setMenuOpen(false)}>
          <div className="fc-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="fc-drawer-head">
              <b>Menu</b>
              <button type="button" className="fc-iconbtn" aria-label="Close" onClick={() => setMenuOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {NAV_SECTIONS.map((sec) => (sec.adminOnly && !isAdmin) ? null : (
              <div key={sec.label} className="fc-nav-sec">
                <span className="fc-nav-label">{sec.label}</span>
                {sec.items.filter(([,,, roles]) => !roles || roles.includes(role)).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    className={`fc-nav-item${view === id ? " active" : ""}`}
                    onClick={() => go(id)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ))}
            <div className="fc-drawer-foot">
              <a className="fc-nav-item" href={studentAppUrl}>
                <ExternalLink size={17} />
                <span>Student app</span>
              </a>
              {userCard}
            </div>
          </div>
        </div>
      )}

      <main className="fc-main">
        <header className="fc-pagehead">
          <h1>{pageTitle}</h1>
          <p>{pageSub}</p>
        </header>
        <Suspense fallback={<TabSkeleton />}>
          {view === "insights" && <LecturerInsights token={token} />}
          {view === "classroom" && (
            <ClassroomPage
              isFaculty
              authUser={authUser}
              token={token}
              backendSubjects={backendSubjects}
              refreshAssignments={refreshAssignments}
              setAssignments={setAssignments}
              onImportQuestions={onImportQuestions}
            />
          )}
          {view === "questions" && (
            <TeacherQuestionManager token={token} subjects={backendSubjects} onSubjectsRefresh={refreshSubjects} />
          )}
          {view === "resources" && <TeacherResourcesHub onBack={() => go(homeView)} isLecturer={!isAdmin} />}
          {view === "announce" && <CampusComm token={token} currentUser={authUser} />}
          {view === "space" && (
            <ResearchHub onBack={() => go(homeView)} streak={0} onStreakUpdate={() => {}} onXpUpdate={() => {}} activeSemester={null} />
          )}
          {view === "directory" && <Lecturers token={token} currentUser={authUser} isTeacher />}
          {view === "dashboard" && isAdmin && <AdminDashboard token={token} />}
          {view === "universities" && isAdmin && <UniversityManager />}
          {view === "departments" && isAdmin && <DepartmentManager />}
          {view === "keys" && isAdmin && <KeyManagement token={token} />}
          {view === "invites" && isAdmin && <TeacherInvitesPanel token={token} />}
          {view === "profile" && <LecturerProfileEditor token={token} />}
        </Suspense>
      </main>
    </div>
  );
}
