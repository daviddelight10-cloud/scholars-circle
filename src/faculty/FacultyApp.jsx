import { Suspense, useCallback, useEffect, useState } from "react";
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

const Loader = () => (
  <div className="fc-loader">
    <div className="fc-spinner" />
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

  useEffect(() => {
    let live = true;
    setStatus("checking");
    ensureAppSession({ revalidate: true }).then((u) => {
      if (!live) return;
      if (!u) { setStatus("guest"); return; }
      setAuthUser(u);
      setUser?.(u);
      setToken?.(getStoredToken() || "");
      setStatus(STAFF_ROLES.has(String(u.role || "").toLowerCase()) ? "staff" : "student");
    }).catch(() => { if (live) setStatus("guest"); });
    return () => { live = false; };
  }, [setUser, setToken, epoch]);

  const refreshAssignments = useCallback(async () => {
    try {
      const rows = await api("/assignments");
      if (Array.isArray(rows)) setAssignments(rows);
    } catch { /* keep local fallback */ }
  }, [setAssignments]);

  const refreshSubjects = useCallback(async () => {
    try {
      const rows = await api("/subjects");
      if (Array.isArray(rows)) {
        setBackendSubjects(rows);
        setSubjects(rows); // same { id, label } shape Classroom expects
        try { localStorage.setItem("sc_subjects_cache", JSON.stringify(rows)); } catch { /* full */ }
      }
    } catch { /* offline */ }
  }, [setSubjects]);

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

  if (status === "checking") return <div className="app dark"><Loader /></div>;
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
          <BookOpen size={20} />
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
            <ExternalLink size={18} />
            <span>Student app</span>
          </a>
          <button type="button" className="fc-nav-item" onClick={logout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <header className="fc-topbar">
        <button type="button" className="fc-iconbtn" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <b>Scholar's Circle · Staff</b>
        <span className="fc-topbar-user">{authUser?.fullName || authUser?.username || ""}</span>
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
            <a className="fc-nav-item" href={studentAppUrl}>
              <ExternalLink size={18} />
              <span>Student app</span>
            </a>
            <button type="button" className="fc-nav-item" onClick={logout}>
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}

      <main className="fc-main">
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
          {view === "resources" && <TeacherResourcesHub onBack={() => go("insights")} isLecturer={!isAdmin} />}
          {view === "announce" && <CampusComm token={token} currentUser={authUser} />}
          {view === "space" && (
            <ResearchHub onBack={() => go("insights")} streak={0} onStreakUpdate={() => {}} onXpUpdate={() => {}} activeSemester={null} />
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
