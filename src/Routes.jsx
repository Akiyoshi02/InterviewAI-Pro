import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import PageTitleManager from "components/PageTitleManager";
import ErrorBoundary from "components/ErrorBoundary";
import OAuthRedirectHandler from "components/OAuthRedirectHandler";
import ThemeToggleButton from "components/ThemeToggleButton";
import ProtectedRoute from "components/ProtectedRoute";
import LiveChatWidget from "./components/live-chat/LiveChatWidget";
import NotFound from "pages/NotFound";
import HomePage from './pages/home';
import LiveInterviewSession from './pages/live-interview-session';
import InterviewLobby from './pages/interview-lobby';
import CompanyDashboard from './pages/company-dashboard';
import Login from './pages/login';
import AdminLogin from './pages/admin-login';
import PracticeInterviewSetup from './pages/practice-interview-setup';
import InterviewResultsPage from './pages/interview-results';
import Register from './pages/register';
import ResetPassword from './pages/reset-password';
import CandidateDashboard from './pages/candidate-dashboard';
import VerifyEmail from './pages/verify-email';
import Privacy from './pages/privacy';
import Terms from './pages/terms';
import Contact from './pages/contact';
import HelpCenter from './pages/help-center';
import LearningCenter from './pages/learning-center';
import SuccessStories from './pages/success-stories';
import InterviewGuides from './pages/interview-guides';
import HelpArticles from './pages/help-articles';
import Onboarding from './pages/onboarding';
import About from './pages/about';
import Careers from './pages/careers';
import Press from './pages/press';
import APIDocsPage from './pages/api-docs';
import StatusPage from './pages/status';
import JobsPage from './pages/jobs';
import JobDetailPage from './pages/job-detail';
import InvitePage from './pages/invite';
import SystemAdminDashboard from './pages/system-admin-dashboard';
import AcceptTeamInvitePage from './pages/accept-team-invite';
import CompanyJobsPage from './pages/company-jobs';
import MyApplicationsPage from './pages/my-applications';
import CompanyApplicationsPage from './pages/company-applications';
import CompanyInterviewsPage from './pages/company-interviews';
import CompanyInvitationsPage from './pages/company-invitations';
import CompanyCandidatesPage from './pages/company-candidates';
import CompanyAnalyticsPage from './pages/company-analytics';
import CompanyTeamMembersPage from './pages/company-team-members';
import CompanySettingsPage from './pages/company-settings';
import CompanyBillingPage from './pages/company-billing';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <PageTitleManager />
      <OAuthRedirectHandler />
      <ThemeToggleButton />
      <LiveChatWidget />
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
          path="/interview-lobby/:interviewId"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <InterviewLobby />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/interview-results/:interviewId"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <InterviewResultsPage />
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
        <Route
          path="/company-jobs"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_JOBS_PAGE']}>
              <CompanyJobsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-applications"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_APPLICATIONS_PAGE']}>
              <CompanyApplicationsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-interviews"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_INTERVIEWS_PAGE']}>
              <CompanyInterviewsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-invitations"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_INVITATIONS_PAGE']}>
              <CompanyInvitationsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-candidates"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_CANDIDATES_PAGE']}>
              <CompanyCandidatesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-analytics"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_ANALYTICS_PAGE']}>
              <CompanyAnalyticsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-team-members"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['MANAGE_MEMBERS']}>
              <CompanyTeamMembersPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-settings"
          element={(
            <ProtectedRoute roles={['COMPANY']}>
              <CompanySettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-billing"
          element={(
            <ProtectedRoute roles={['COMPANY']}>
              <CompanyBillingPage />
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLogin />} />
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
        <Route path="/accept-team-invite/:token" element={<AcceptTeamInvitePage />} />
        <Route
          path="/candidate-dashboard"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CandidateDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/my-applications"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <MyApplicationsPage />
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
        <Route path="/contact" element={<Contact />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/learning-center" element={<LearningCenter />} />
        <Route path="/success-stories" element={<SuccessStories />} />
        <Route path="/interview-guides" element={<InterviewGuides />} />
        <Route path="/help-articles" element={<HelpArticles />} />
        <Route path="/about" element={<About />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/press" element={<Press />} />
        <Route path="/api-docs" element={<APIDocsPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route
          path="/jobs"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <JobsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/jobs/:id"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <JobDetailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/invite"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <InvitePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/system-admin-dashboard"
          element={(
            <ProtectedRoute roles={['SYSTEM_ADMIN']}>
              <SystemAdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/system-admin-dashboard/:section"
          element={(
            <ProtectedRoute roles={['SYSTEM_ADMIN']}>
              <SystemAdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/research-tools"
          element={
            <ProtectedRoute roles={['SYSTEM_ADMIN']}>
              <Navigate to="/system-admin-dashboard/research-tools" replace />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
