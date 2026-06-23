import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './features/HomePage';
import App from './App';
import ResearchHub from './features/ResearchHub';
import ResourceViewer from './features/ResourceViewer';
import TeacherResourcesHub from './features/TeacherResourcesHub';
import ResourceUploadForm from './components/teacher/ResourceUploadForm';

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

      {/* Catch all - redirect to landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
