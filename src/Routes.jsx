import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import OAuthRedirectHandler from "components/OAuthRedirectHandler";
import ThemeToggleButton from "components/ThemeToggleButton";
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
        <Route path="/live-interview-session" element={<LiveInterviewSession />} />
        <Route path="/company-dashboard" element={<CompanyDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/practice-interview-setup" element={<PracticeInterviewSetup />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
