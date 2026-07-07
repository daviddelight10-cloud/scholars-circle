import { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './features/HomePage';
import { lazyWithRetry } from './lib/lazyWithRetry.js';

const App = lazyWithRetry(() => import('./App'));
const ResearchHub = lazyWithRetry(() => import('./features/research-hub/ResearchHub'));
const ResourceViewer = lazyWithRetry(() => import('./features/ResourceViewer'));
const TeacherResourcesHub = lazyWithRetry(() => import('./features/TeacherResourcesHub'));
const SharedFolderView = lazyWithRetry(() => import('./features/SharedFolderView'));
const ResourceUploadForm = lazyWithRetry(() => import('./components/teacher/ResourceUploadForm'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#0f1117' }}>
    <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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

      {/* Auth routes - show App component with auth forms */}
      <Route path="/login" element={<App />} />
      <Route path="/signup" element={<App />} />

      {/* Main app route */}
      <Route path="/app" element={<App />} />

      {/* Research Hub routes */}
      <Route path="/resources" element={<ResearchHub />} />
      <Route path="/resources/:token" element={<ResourceViewer />} />
      <Route path="/teacher/resources" element={<TeacherResourcesHub />} />
      <Route path="/teacher/resources/upload" element={<ResourceUploadForm />} />

      {/* Shared folder route */}
      <Route path="/folders/:shareToken" element={<SharedFolderView />} />

      {/* Catch all - redirect to landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
