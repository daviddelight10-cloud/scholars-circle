import { Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './features/HomePage';
import AuthPages from './pages/AuthPages';
import { lazyWithRetry } from './lib/lazyWithRetry.js';
import { ensureAppSession } from './lib/authToken.js';

const App = lazyWithRetry(() => import('./App'));
const ResearchHub = lazyWithRetry(() => import('./features/research-hub/ResearchHub'));
const TeacherResourcesHub = lazyWithRetry(() => import('./features/TeacherResourcesHub'));
const SharedFolderView = lazyWithRetry(() => import('./features/SharedFolderView'));
const SharedResourceView = lazyWithRetry(() => import('./features/SharedResourceView'));
const LiveQuizPage = lazyWithRetry(() => import('./features/live-quiz/LiveQuizPage'));
const ResourceUploadForm = lazyWithRetry(() => import('./components/teacher/ResourceUploadForm'));
const BlogList = lazyWithRetry(() => import('./blog/BlogList'));
const BlogPost = lazyWithRetry(() => import('./blog/BlogPost'));
const PrivacyPage = lazyWithRetry(() => import('./pages/LegalPages').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazyWithRetry(() => import('./pages/LegalPages').then(m => ({ default: m.TermsPage })));
const CopyrightPolicyPage = lazyWithRetry(() => import('./pages/LegalPages').then(m => ({ default: m.CopyrightPolicyPage })));

function RequireAuth({ children }) {
  const location = useLocation();
  const redirectTo = `/signup?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  const [status, setStatus] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('scholars-circle-auth') || 'null');
      return parsed?.authUser ? 'authed' : 'checking';
    } catch { return 'checking'; }
  });

  // A post-signup return (email-confirm or OAuth) can land here with a live
  // Supabase session but no scholars-circle-auth yet — recover before
  // bouncing, or the user loops back to signup forever.
  useEffect(() => {
    if (status !== 'checking') return;
    let live = true;
    ensureAppSession().then((u) => { if (live) setStatus(u ? 'authed' : 'guest'); });
    return () => { live = false; };
  }, [status]);

  if (status === 'checking') return <PageLoader />;
  if (status === 'guest') return <Navigate to={redirectTo} replace />;
  return children;
}

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--app-bg)' }}>
    <div style={{ width: 32, height: 32, border: '3px solid var(--app-tint-strong)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// Auth check component
function LandingPageWrapper() {
  const location = useLocation();
  const forceHome = new URLSearchParams(location.search).get('force_home') === '1';
  const authData = localStorage.getItem('scholars-circle-auth');
  if (authData && !forceHome) {
    try {
      const parsed = JSON.parse(authData);
      if (parsed.authUser) {
        return <Navigate to="/app" replace />;
      }
    } catch (e) {
      // Invalid auth data, continue to landing page
    }
  }
  return <HomePage />;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Landing page routes - redirect to /app if logged in */}
      <Route path="/" element={<LandingPageWrapper />} />
      <Route path="/features" element={<LandingPageWrapper />} />
      <Route path="/pricing" element={<LandingPageWrapper />} />

      {/* Auth routes - show lightweight AuthPages component */}
      <Route path="/login" element={<AuthPages />} />
      <Route path="/signup" element={<AuthPages />} />

      {/* Main app route */}
      <Route path="/app" element={<App />} />

      {/* Research Hub routes - requires auth */}
      <Route path="/resources" element={<RequireAuth><div className="app dark"><ResearchHub /></div></RequireAuth>} />
      <Route path="/resources/:token" element={<div className="app dark"><SharedResourceView /></div>} />
      <Route path="/teacher/resources" element={<div className="app dark"><TeacherResourcesHub /></div>} />
      <Route path="/teacher/resources/upload" element={<div className="app dark"><ResourceUploadForm /></div>} />

      {/* Shared folder route */}
      <Route path="/folders/:shareToken" element={<div className="app dark"><SharedFolderView /></div>} />

      {/* Live quiz room — invite link target. Public: guests see the invite
          card and get sent to signup; joining itself still requires auth. */}
      <Route path="/live/:code" element={<LiveQuizPage />} />

      {/* Blog routes */}
      <Route path="/blog" element={<BlogList />} />
      <Route path="/blog/:slug" element={<BlogPost />} />

      {/* Legal — public (copyright form accepts guest notices) */}
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/copyright" element={<CopyrightPolicyPage />} />

      {/* Catch all - redirect to landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
