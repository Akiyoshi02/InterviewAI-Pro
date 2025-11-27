import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import OAuthRedirectHandler from "components/OAuthRedirectHandler";
import ThemeToggleButton from "components/ThemeToggleButton";
import ProtectedRoute from "components/ProtectedRoute";
import NotFound from "pages/NotFound";
import HomePage from './pages/home';
import LiveInterviewSession from './pages/live-interview-session';
import CompanyDashboard from './pages/company-dashboard';
import Login from './pages/login';
import PracticeInterviewSetup from './pages/practice-interview-setup';
import Register from './pages/register';
import ResetPassword from './pages/reset-password';
import CandidateDashboard from './pages/candidate-dashboard';
import VerifyEmail from './pages/verify-email';
import Privacy from './pages/privacy';
import Terms from './pages/terms';
import Support from './pages/support';
import Onboarding from './pages/onboarding';
import JobsPage from './pages/jobs';
import InvitePage from './pages/invite';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <OAuthRedirectHandler />
      <ThemeToggleButton />
      <RouterRoutes>
        {/* Define your route here */}
        <Route path="/" element={<HomePage />} />
        <Route
          path="/live-interview-session"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <LiveInterviewSession />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-dashboard"
          element={(
            <ProtectedRoute roles={['COMPANY']}>
              <CompanyDashboard />
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<Login />} />
        <Route
          path="/practice-interview-setup"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <PracticeInterviewSetup />
            </ProtectedRoute>
          )}
        />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/candidate-dashboard"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CandidateDashboard />
            </ProtectedRoute>
          )}
        />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/onboarding"
          element={(
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          )}
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/support" element={<Support />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
