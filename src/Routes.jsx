import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import PageTitleManager from "./components/PageTitleManager";
import ErrorBoundary from "./components/ErrorBoundary";
import OAuthRedirectHandler from "./components/OAuthRedirectHandler";
import ThemeToggleButton from "./components/ThemeToggleButton";
import ProtectedRoute from "./components/ProtectedRoute";
import LiveChatWidget from "./components/live-chat/LiveChatWidget";
import CookieConsentBanner from './components/ui/CookieConsentBanner';
import PWAInstallPrompt from './components/ui/PWAInstallPrompt';

const NotFound = lazy(() => import("./pages/NotFound"));
const HomePage = lazy(() => import('./pages/home'));
const SharedResultsPage = lazy(() => import('./pages/shared-results'));
const CandidateAnalyticsPage = lazy(() => import('./pages/candidate-analytics'));
const LongitudinalStudyPage = lazy(() => import('./pages/longitudinal-study'));
const ABTestingPage = lazy(() => import('./pages/ab-testing'));
const PrivacySettingsPage = lazy(() => import('./pages/privacy-settings'));
const OAuthCallbackPage = lazy(() => import('./pages/oauth-callback'));
const CompanyWebhooksPage = lazy(() => import('./pages/company-webhooks'));
const ReferralProgramPage = lazy(() => import('./pages/referral-program'));
const CompanyProfilePublicPage = lazy(() => import('./pages/company-profile-public'));
const CompaniesDirectoryPage = lazy(() => import('./pages/companies-directory'));
const CompanyPublicProfileEditorPage = lazy(() => import('./pages/company-public-profile-editor'));
const InterviewPrepLibraryPage = lazy(() => import('./pages/interview-prep-library'));
const GamificationPage = lazy(() => import('./pages/gamification'));
const LiveInterviewSession = lazy(() => import('./pages/live-interview-session'));
const InterviewLobby = lazy(() => import('./pages/interview-lobby'));
const CompanyDashboard = lazy(() => import('./pages/company-dashboard'));
const Login = lazy(() => import('./pages/login'));
const AdminLogin = lazy(() => import('./pages/admin-login'));
const PracticeInterviewSetup = lazy(() => import('./pages/practice-interview-setup'));
const InterviewResultsPage = lazy(() => import('./pages/interview-results'));
const Register = lazy(() => import('./pages/register'));
const ResetPassword = lazy(() => import('./pages/reset-password'));
const CandidateDashboard = lazy(() => import('./pages/candidate-dashboard'));
const CandidateSettingsPage = lazy(() => import('./pages/candidate-settings'));
const VerifyEmail = lazy(() => import('./pages/verify-email'));
const Privacy = lazy(() => import('./pages/privacy'));
const Terms = lazy(() => import('./pages/terms'));
const Contact = lazy(() => import('./pages/contact'));
const HelpCenter = lazy(() => import('./pages/help-center'));
const LearningCenter = lazy(() => import('./pages/learning-center'));
const SuccessStories = lazy(() => import('./pages/success-stories'));
const InterviewGuides = lazy(() => import('./pages/interview-guides'));
const HelpArticles = lazy(() => import('./pages/help-articles'));
const Onboarding = lazy(() => import('./pages/onboarding'));
const About = lazy(() => import('./pages/about'));
const Careers = lazy(() => import('./pages/careers'));
const Press = lazy(() => import('./pages/press'));
const APIDocsPage = lazy(() => import('./pages/api-docs'));
const StatusPage = lazy(() => import('./pages/status'));
const JobsPage = lazy(() => import('./pages/jobs'));
const JobDetailPage = lazy(() => import('./pages/job-detail'));
const SystemAdminDashboard = lazy(() => import('./pages/system-admin-dashboard'));
const AcceptTeamInvitePage = lazy(() => import('./pages/accept-team-invite/index.jsx'));
const CompanyJobsPage = lazy(() => import('./pages/company-jobs'));
const CompanyTemplatesPage = lazy(() => import('./pages/company-templates'));
const MyApplicationsPage = lazy(() => import('./pages/my-applications'));
const CompanyApplicationsPage = lazy(() => import('./pages/company-applications'));
const CompanyInterviewsPage = lazy(() => import('./pages/company-interviews'));
const CompanyCandidatesPage = lazy(() => import('./pages/company-candidates'));
const CompanyReviewsPage = lazy(() => import('./pages/company-reviews'));
const CompanyAnalyticsPage = lazy(() => import('./pages/company-analytics'));
const CompanyTeamMembersPage = lazy(() => import('./pages/company-team-members'));
const CompanySettingsPage = lazy(() => import('./pages/company-settings'));
const CompanyBillingPage = lazy(() => import('./pages/company-billing'));
const CandidateOfferPage = lazy(() => import('./pages/application-offer'));
const CandidateOnboardingPage = lazy(() => import('./pages/application-onboarding'));
const CompanyOfferPage = lazy(() => import('./pages/company-offer'));
const CompanyOnboardingPage = lazy(() => import('./pages/company-onboarding'));
const HiredHandoffPage = lazy(() => import('./pages/hired-handoff'));

const RouteFallback = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
    <div className="text-sm font-medium tracking-wide text-slate-300">Loading...</div>
  </div>
);

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <PageTitleManager />
      <OAuthRedirectHandler />
      <ThemeToggleButton />
      <LiveChatWidget />
      <Suspense fallback={<RouteFallback />}>
      <RouterRoutes>
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
          path="/company-templates"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_TEMPLATES_PAGE']}>
              <CompanyTemplatesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-invitations"
          element={(
            <ProtectedRoute roles={['COMPANY']}>
              <Navigate to="/company-applications" replace />
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
          path="/company-reviews"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['VIEW_REVIEWS']}>
              <CompanyReviewsPage />
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
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['MANAGE_ORGANIZATION']}>
              <CompanyBillingPage />
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Navigate to="/admin-login" replace />} />
        <Route path="/admin-login" element={<AdminLogin />} />
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
          path="/candidate-settings"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CandidateSettingsPage />
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
        <Route
          path="/my-applications/:id/offer"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CandidateOfferPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/my-applications/:id/handoff"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <HiredHandoffPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/my-applications/:id/onboarding"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CandidateOnboardingPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-applications/:id/offer"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['UPDATE_APPLICATION_STATUS']}>
              <CompanyOfferPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-applications/:id/onboarding"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['UPDATE_APPLICATION_STATUS']}>
              <CompanyOnboardingPage />
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
        <Route path="/invite" element={<Navigate to="/jobs" replace />} />
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
        <Route path="/shared-results/:token" element={<SharedResultsPage />} />
        <Route
          path="/candidate-analytics"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CandidateAnalyticsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/longitudinal-study"
          element={(
            <ProtectedRoute roles={['SYSTEM_ADMIN']}>
              <LongitudinalStudyPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/ab-testing"
          element={(
            <ProtectedRoute roles={['SYSTEM_ADMIN']}>
              <ABTestingPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/gamification"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <GamificationPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/interview-prep-library"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <InterviewPrepLibraryPage />
            </ProtectedRoute>
          )}
        />
        {/* Candidate-only company pages */}
        <Route
          path="/companies"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CompaniesDirectoryPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/companies/:slug"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <CompanyProfilePublicPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-preview/:slug"
          element={(
            <ProtectedRoute roles={['COMPANY']}>
              <CompanyProfilePublicPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-profile-editor"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['MANAGE_ORGANIZATION']}>
              <CompanyPublicProfileEditorPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/referral-program"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <ReferralProgramPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-webhooks"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['MANAGE_ORGANIZATION']}>
              <CompanyWebhooksPage />
            </ProtectedRoute>
          )}
        />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/oauth/linkedin/callback" element={<OAuthCallbackPage />} />
        <Route path="/oauth/github/callback" element={<OAuthCallbackPage />} />
        <Route
          path="/privacy-settings"
          element={(
            <ProtectedRoute roles={['CANDIDATE', 'ADMIN', 'SYSTEM_ADMIN', 'COMPANY']}>
              <PrivacySettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </Suspense>
      </ErrorBoundary>
      <CookieConsentBanner />
      <PWAInstallPrompt />
    </BrowserRouter>
  );
};

export default Routes;
