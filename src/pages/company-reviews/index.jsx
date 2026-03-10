import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import LoadingState from '../../components/ui/LoadingState';
import Icon from '../../components/AppIcon';
import ReviewerWorkspaceLayout from './components/ReviewerWorkspaceLayout';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import { useInterviewRealtimeFeed } from '../../hooks/useInterviewRealtimeFeed';
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';
import { buildReviewerQueue } from '../../utils/reviewerQueue.js';
import {
  INTERVIEW_FEED_EVENTS,
  ORGANIZATION_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../constants/realtimeFeedEvents.js';

const CompanyReviewsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadReviewsWorkspaceRef = useRef(null);

  const organizationRole = String(user?.organizationContext?.membership?.role || '').toUpperCase();
  const userType = user?.accountType?.toUpperCase() === 'COMPANY' ? 'company' : null;
  const workspaceRole = organizationRole || 'ADMIN';
  const workspaceReviewerId = organizationRole === 'REVIEWER' ? user?.id : null;
  const requestedInterviewId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('interviewId') || '';
  }, [location.search]);
  const requestedTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'review';
  }, [location.search]);

  const pageTitle = organizationRole === 'REVIEWER' ? 'Assigned Reviews' : 'Review Workspace';
  const pageDescription = organizationRole === 'REVIEWER'
    ? 'Use one dedicated workspace for evidence review, recording playback, AI analysis, and structured feedback.'
    : 'Inspect assigned review coverage and complete your own structured interview feedback.';

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  useEffect(() => {
    document.title = `${pageTitle} - InterviewAI Pro`;
  }, [pageTitle]);

  const loadReviewsWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.interviews.getCompanyInterviews();
      if (result?.success) {
        setInterviews(Array.isArray(result.interviews) ? result.interviews : []);
      } else {
        setInterviews([]);
        setError('Failed to load assigned reviews.');
      }
    } catch (fetchError) {
      setInterviews([]);
      setError(fetchError?.message || 'Failed to load assigned reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviewsWorkspaceRef.current = loadReviewsWorkspace;
  }, [loadReviewsWorkspace]);

  useInterviewRealtimeFeed({
    userId: user?.id,
    enabled: Boolean(user?.id),
    eventTypes: combineRealtimeEventTypes(
      INTERVIEW_FEED_EVENTS.lifecycle,
      INTERVIEW_FEED_EVENTS.reviews,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadReviewsWorkspaceRef.current?.();
      }, 300);
    },
  });

  useRealtimePathFeed({
    path: user?.organizationContext?.organization?.id
      ? `organizationFeeds/${user.organizationContext.organization.id}`
      : null,
    enabled: Boolean(user?.organizationContext?.organization?.id),
    eventTypes: combineRealtimeEventTypes(
      ORGANIZATION_FEED_EVENTS.reviews,
      ORGANIZATION_FEED_EVENTS.interviews,
      ORGANIZATION_FEED_EVENTS.applications,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadReviewsWorkspaceRef.current?.();
      }, 300);
    },
  });

  useEffect(() => () => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadReviewsWorkspace();
    }
  }, [loadReviewsWorkspace, status]);

  const handleSelectInterview = useCallback((interviewId, tab = 'review') => {
    const params = new URLSearchParams(location.search);
    if (interviewId) {
      params.set('interviewId', interviewId);
      params.set('tab', tab);
    } else {
      params.delete('interviewId');
      params.delete('tab');
    }

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  const reviewerQueue = useMemo(
    () => buildReviewerQueue({
      interviews,
      reviewerId: workspaceReviewerId,
      organizationRole: workspaceRole,
    }),
    [interviews, workspaceReviewerId, workspaceRole],
  );
  const normalizedInterviewIds = useMemo(
    () => new Set(reviewerQueue.map((interview) => interview?.id).filter(Boolean)),
    [reviewerQueue],
  );
  const effectiveSelectedInterviewId = normalizedInterviewIds.has(requestedInterviewId)
    ? requestedInterviewId
    : (reviewerQueue[0]?.id || '');
  const effectiveTab = normalizedInterviewIds.has(requestedInterviewId) ? requestedTab : 'review';

  useEffect(() => {
    if (loading) return;

    if (!effectiveSelectedInterviewId) {
      if (requestedInterviewId || requestedTab !== 'review') {
        handleSelectInterview('', 'review');
      }
      return;
    }

    if (effectiveSelectedInterviewId !== requestedInterviewId || effectiveTab !== requestedTab) {
      handleSelectInterview(effectiveSelectedInterviewId, effectiveTab);
    }
  }, [
    effectiveSelectedInterviewId,
    effectiveTab,
    handleSelectInterview,
    loading,
    requestedInterviewId,
    requestedTab,
  ]);

  if (status === 'loading' || loading) {
    return (
      <LoadingState
        title="Preparing your review workspace"
        message="Loading assigned interviews and review deadlines."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (!userType) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header
        userType={userType}
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />

      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType={userType}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
          />

          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
              isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
            }`}
          >
            <motion.section
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6"
            >
              {maintenanceMode ? (
                <div className="rounded-2xl border border-amber-200/70 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
                  Maintenance mode is active. Reviewer access remains available, but some updates may pause briefly.
                </div>
              ) : null}

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Icon name="ClipboardCheck" size={22} color="white" />
                </div>
                <div>
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    {pageTitle}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    {pageDescription}
                  </p>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              ) : null}

              <ReviewerWorkspaceLayout
                interviews={interviews}
                reviewerId={workspaceReviewerId}
                organizationRole={workspaceRole}
                selectedInterviewId={effectiveSelectedInterviewId}
                activeTab={effectiveTab}
                onSelectInterview={handleSelectInterview}
              />
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CompanyReviewsPage;
