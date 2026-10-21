import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import CadetProfile from './pages/CadetProfile';
import TestHistory from './pages/TestHistory';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import { useAuth } from './context/AuthContext';

const ExamPage = lazy(() => import('./pages/ExamPage'));

export default function AppRoutes() {
  const location = useLocation();
  const { user, loading, refreshUser, passwordRecovery } = useAuth();
  const signedIn = Boolean(user);
  const [refreshError, setRefreshError] = useState('');
  useLayoutEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.key]);
  useEffect(() => {
    let active = true;
    setRefreshError('');
    if (!loading && !passwordRecovery && (['/dashboard', '/profile'].includes(location.pathname) || (location.pathname === '/' && !signedIn))) {
      refreshUser().catch(() => {
        if (active) setRefreshError('Unable to refresh account details.');
      });
    }
    return () => { active = false; };
  }, [location.key, location.pathname, loading, refreshUser, signedIn, passwordRecovery]);

  if (passwordRecovery && location.pathname !== '/reset-password') return <Navigate to="/reset-password" replace />;

  // Home and dashboard get a fresh view on every visit, including same-page links.
  // Keep auth mounted through notice cleanup so the signup password handoff survives.
  return <>{refreshError && <div className="alert alert-error" role="alert">{refreshError}
    <button type="button" className="reload-btn" onClick={async () => {
      try { await refreshUser(); setRefreshError(''); }
      catch { setRefreshError('Unable to refresh account details.'); }
    }}>Retry refresh</button>
  </div>}<Routes>
    <Route path="/" element={loading
      ? <div className="center-loading"><span className="spinner" />Checking your session…</div>
      : signedIn ? <Navigate to="/dashboard" replace /> : <LandingPage key={location.key} />} />
    <Route path="/login" element={<AuthPage key="login" mode="login" />} />
    <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
    <Route path="/forgot-password" element={<Navigate to="/reset-password" replace />} />
    <Route path="/reset-password" element={<PasswordRecoveryPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard key={location.key} /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><CadetProfile key={location.key} /></ProtectedRoute>} />
    <Route path="/progress" element={<ProtectedRoute><TestHistory key={`${user?.id}:${location.key}`} /></ProtectedRoute>} />
    <Route path="/test/:category" element={<ProtectedRoute><Suspense fallback={<div className="center-loading">Preparing your training workspace…</div>}><ExamPage /></Suspense></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></>;
}
