import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import OverviewPanel from './components/OverviewPanel';
import CandidatePipeline from './components/CandidatePipeline';
import CandidateTable from './components/CandidateTable';
import HiringMetrics from './components/HiringMetrics';
import QuickActions from './components/QuickActions';
import ReviewerDashboardPanel from './components/ReviewerDashboardPanel';
import HiringInsightsBoard from './components/HiringInsightsBoard';
import HiringFocusPanel from './components/HiringFocusPanel';
import InterviewReviewEnhanced from './components/InterviewReviewEnhanced';
import PendingApprovalBanner from './components/PendingApprovalBanner';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import { useInterviewRealtimeFeed } from '../../hooks/useInterviewRealtimeFeed';
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';
import { hasPermission } from '../../utils/rolePermissions';
import {
  INTERVIEW_FEED_EVENTS,
  ORGANIZATION_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../constants/realtimeFeedEvents.js';

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReviewInterviewId, setSelectedReviewInterviewId] = useState(null);
  const [selectedReviewTab, setSelectedReviewTab] = useState('overview');
  const [actionMessage, setActionMessage] = useState('');
  const [statusUpdateModal, setStatusUpdateModal] = useState({ open: false, interviewId: null, currentStatus: 'SCREENING' });
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const realtimeRefreshTimeoutRef = useRef(null);
  const fetchCompanyDataRef = useRef(null);

  // Get organization role for permission checks
  const organizationRole = user?.organizationContext?.membership?.role;
  const canViewAnalytics = hasPermission(organizationRole, 'ACCESS_ANALYTICS_PAGE');
  const canManageCandidates = hasPermission(organizationRole, 'MANAGE_CANDIDATES');
  const canAccessJobsPage = hasPermission(organizationRole, 'ACCESS_JOBS_PAGE');
  const canAccessCandidatesPage = hasPermission(organizationRole, 'ACCESS_CANDIDATES_PAGE');
  const canAccessInterviewsPage = hasPermission(organizationRole, 'ACCESS_INTERVIEWS_PAGE');
  const canUpdateApplicationStatus = hasPermission(organizationRole, 'UPDATE_APPLICATION_STATUS');
  const canExportReports = hasPermission(organizationRole, 'EXPORT_REPORTS');
  const isReviewerOnly = organizationRole === 'REVIEWER';


  const viewportConfig = { once: true, amount: 0.15 };

  const sectionReveal = {
    hidden: { opacity: 0, y: 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const staggeredChildren = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05
      }
    }
  };

  const fadeUpChild = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  const formatCompanyLabel = (company) => {
    if (!company) return '';
    if (typeof company === 'string') return company;
    if (typeof company === 'object') {
      return company.companyName || company.fullName || company.email || '';
    }
    return '';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const clearReviewSearchParams = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('interviewId') && !params.has('tab')) {
      return;
    }

    params.delete('interviewId');
    params.delete('tab');

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

  // Set document title - must be before conditional returns (Rules of Hooks)
  useEffect(() => {
    document.title = 'Company Dashboard - InterviewAI Pro';
  }, []);


  const fetchCompanyData = useCallback(async () => {
    if (!user) return;
    if (user.accountType?.toUpperCase() !== 'COMPANY') {
      navigate('/candidate-dashboard', { replace: true });
      return;
    }

    setDataLoading(true);
    setError(null);
    try {
      const [interviewsResult, metricsResult, jobsResult, dashboardMetricsResult] = await Promise.allSettled([
        apiClient.interviews.getCompanyInterviews(),
        canViewAnalytics
          ? apiClient.analytics.getCompanyMetrics()
          : Promise.resolve({ success: false }),
        canAccessJobsPage
          ? apiClient.jobs.getOrganizationJobs()
          : Promise.resolve({ success: false }),
        canViewAnalytics
          ? apiClient.analytics.getDashboardMetrics()
          : Promise.resolve({ success: false }),
      ]);

      if (interviewsResult.status === 'fulfilled' && interviewsResult.value.success) {
        setInterviews(interviewsResult.value.interviews || []);
      } else {
        setInterviews([]);
      }

      if (metricsResult.status === 'fulfilled' && metricsResult.value.success) {
        setMetrics(metricsResult.value.metrics || null);
      } else {
        setMetrics(null);
      }

      if (jobsResult.status === 'fulfilled' && jobsResult.value.success) {
        setJobs(jobsResult.value.jobs || []);
      } else {
        setJobs([]);
      }

      if (dashboardMetricsResult.status === 'fulfilled' && dashboardMetricsResult.value.success) {
        setDashboardMetrics(dashboardMetricsResult.value.metrics || null);
      } else {
        setDashboardMetrics(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [canAccessJobsPage, canViewAnalytics, navigate, user]);

  useEffect(() => {
    fetchCompanyDataRef.current = fetchCompanyData;
  }, [fetchCompanyData]);

  useInterviewRealtimeFeed({
    userId: user?.id,
    enabled: Boolean(user?.id),
    eventTypes: combineRealtimeEventTypes(
      INTERVIEW_FEED_EVENTS.lifecycle,
      INTERVIEW_FEED_EVENTS.pipeline,
      INTERVIEW_FEED_EVENTS.reviews,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        fetchCompanyDataRef.current?.();
      }, 300);
    },
  });

  useRealtimePathFeed({
    path: user?.organizationContext?.organization?.id
      ? `organizationFeeds/${user.organizationContext.organization.id}`
      : null,
    enabled: Boolean(user?.organizationContext?.organization?.id),
    eventTypes: combineRealtimeEventTypes(
      ORGANIZATION_FEED_EVENTS.jobs,
      ORGANIZATION_FEED_EVENTS.applications,
      ORGANIZATION_FEED_EVENTS.pipeline,
      ORGANIZATION_FEED_EVENTS.reviews,
      ORGANIZATION_FEED_EVENTS.interviews,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        fetchCompanyDataRef.current?.();
      }, 300);
    },
  });

  useEffect(() => () => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!selectedReviewInterviewId) return undefined;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedReviewInterviewId(null);
        clearReviewSearchParams();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [clearReviewSearchParams, selectedReviewInterviewId]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const interviewIdFromQuery = params.get('interviewId');
    const tabFromQuery = params.get('tab') || 'overview';
    if (!interviewIdFromQuery) return;

    if (isReviewerOnly) {
      navigate(`/company-reviews?interviewId=${encodeURIComponent(interviewIdFromQuery)}&tab=${encodeURIComponent(tabFromQuery)}`, { replace: true });
      return;
    }

    setSelectedReviewInterviewId((previous) => (
      previous === interviewIdFromQuery ? previous : interviewIdFromQuery
    ));
    setSelectedReviewTab(tabFromQuery);
    setActionMessage('');
  }, [isReviewerOnly, location.search, navigate]);

  // Handle hash routing for navigation to specific sections (e.g., candidates)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        // Remove the # symbol
        const sectionId = hash.substring(1);
        
        // Legacy hash support for removed invitations section
        if (sectionId === 'invitations') {
          return;
        }
        
        // Wait a bit for the page to render if needed
        setTimeout(() => {
          const element = document.querySelector(`[data-section="${sectionId}"]`);
          if (element) {
            // Calculate offset for fixed header
            const headerHeight = 64; // h-16 = 64px
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }, 100);
      }
    };

    // Handle initial hash if present
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Calculate derived data before conditional returns.
  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const showInitialLoader = dataLoading && !safeInterviews.length && !metrics;

  if (status === 'loading' || !user || showInitialLoader) {
    return (
      <LoadingState
        title="Checking your session and syncing your company data"
        message="Verifying secure access and loading interviews, jobs, and hiring metrics."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  // Count active (published) job postings
  const activeJobPostings = safeJobs.filter(job => job?.status === 'PUBLISHED').length;
  
  const interviewsToday = safeInterviews.filter((interview) => {
    if (!interview?.scheduledFor) return false;
    const statusCode = String(interview?.status || '').toUpperCase();
    if (!['SCHEDULED', 'IN_PROGRESS'].includes(statusCode)) return false;
    const interviewDate = new Date(interview.scheduledFor);
    const today = new Date();
    return (
      interviewDate.getDate() === today.getDate() &&
      interviewDate.getMonth() === today.getMonth() &&
      interviewDate.getFullYear() === today.getFullYear()
    );
  }).length;

  const pendingReviews = safeInterviews?.filter((interview) => {
    if (!interview || interview.status !== 'COMPLETED') return false;
    if (isReviewerOnly) {
      return String(interview.myReviewStatus || 'PENDING').toUpperCase() !== 'SUBMITTED';
    }
    return !interview.evaluation;
  })?.length || 0;
  const completedReviews = safeInterviews?.filter((interview) => (
    interview && interview.status === 'COMPLETED' &&
      String(interview.myReviewStatus || '').toUpperCase() === 'SUBMITTED'
  ))?.length || 0;
  const upcomingInterviews = safeInterviews?.filter(
    (interview) => interview && interview.status === 'SCHEDULED',
  )?.length || 0;

  const heroHighlights = isReviewerOnly
    ? [
        {
          label: 'Pending reviews',
          value: pendingReviews,
          detail: pendingReviews > 0 ? 'Needs reviewer input' : 'All caught up',
        },
        {
          label: 'Upcoming interviews',
          value: upcomingInterviews,
          detail: interviewsToday > 0 ? `Today: ${interviewsToday}` : 'Scheduled sessions',
        },
        {
          label: 'Completed reviews',
          value: completedReviews,
          detail: completedReviews > 0 ? 'Submitted feedback' : 'No completed reviews yet',
        },
      ]
    : [
        {
          label: 'Active roles',
          value: dashboardMetrics?.activeJobPostings?.value ?? activeJobPostings,
          detail: dashboardMetrics?.activeJobPostings?.changeText ||
            (activeJobPostings === 1 ? 'Open requisition' : 'Open requisitions'),
        },
        {
          label: 'Avg time to hire',
          value: metrics?.averageTimeToHire || '--',
          detail: 'Last 30 days',
        },
        {
          label: 'Interviews today',
          value: interviewsToday,
          detail: 'On the calendar',
        },
      ];

  const latestCompanyName =
    formatCompanyLabel(safeInterviews?.find((i) => i?.company)?.company) ||
    user?.companyName ||
    user?.organizationContext?.organization?.displayName ||
    'Live session';
  const heroBadgeLabel = isReviewerOnly ? 'Structured review workspace' : 'AI-powered hiring control center';
  const heroDescription = isReviewerOnly
    ? 'Review assigned interviews, inspect candidate evidence, and submit structured feedback without changing hiring settings.'
    : `${user?.companyName || 'Your organization'} is synced. Continue orchestrating interviews, review AI insights, and fast-forward decisions.`;
  const heroEventLabel = isReviewerOnly ? 'Next review focus' : 'Next live event';
  const heroEventDetail = isReviewerOnly
    ? pendingReviews > 0
      ? `${pendingReviews} review${pendingReviews === 1 ? '' : 's'} pending`
      : upcomingInterviews > 0
        ? `${upcomingInterviews} scheduled interview${upcomingInterviews === 1 ? '' : 's'}`
        : completedReviews > 0
          ? `${completedReviews} completed review${completedReviews === 1 ? '' : 's'}`
          : 'Reviewer queue ready'
    : interviewsToday > 0
      ? `${interviewsToday} interviews today`
      : 'Pipeline ready';

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-error mb-3 sm:mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={fetchCompanyData}
              className="text-sm sm:text-base text-primary hover:underline"
            >
              Retry
            </button>
            <button
              onClick={handleLogout}
              className="text-sm sm:text-base text-muted-foreground hover:text-primary"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const findInterviewForCandidate = (candidateId) => {
    const matches = safeInterviews.filter((interview) => (
      interview?.candidate?.id === candidateId || interview?.candidateId === candidateId
    ));
    if (!matches.length) return null;
    return [...matches].sort((left, right) => {
      const leftTs = new Date(left?.endedAt || left?.updatedAt || left?.createdAt || 0).getTime();
      const rightTs = new Date(right?.endedAt || right?.updatedAt || right?.createdAt || 0).getTime();
      return rightTs - leftTs;
    })[0];
  };

  const handleViewRecording = async (candidateId) => {
    const interview = findInterviewForCandidate(candidateId);
    if (!interview?.id) {
      setActionMessage('No interview found for this candidate.');
      return;
    }

    if (isReviewerOnly) {
      navigate(`/company-reviews?interviewId=${encodeURIComponent(interview.id)}&tab=video`);
      return;
    }

    try {
      await apiClient.interviews.getRecordingUrl(interview.id);
      setSelectedReviewInterviewId(interview.id);
      setSelectedReviewTab('video');
      setActionMessage('');
    } catch (error) {
      setActionMessage(error?.message || 'Recording is not available for this interview.');
      setSelectedReviewInterviewId(interview.id);
      setSelectedReviewTab('video');
    }
  };

  const handleViewAnalysis = async (candidateId) => {
    const interview = findInterviewForCandidate(candidateId);
    if (!interview?.id) {
      setActionMessage('No interview found for this candidate.');
      return;
    }

    if (isReviewerOnly) {
      navigate(`/company-reviews?interviewId=${encodeURIComponent(interview.id)}&tab=evaluation`);
      return;
    }

    try {
      await apiClient.interviews.getEvaluation(interview.id);
      setSelectedReviewInterviewId(interview.id);
      setSelectedReviewTab('evaluation');
      setActionMessage('');
    } catch (error) {
      setActionMessage(error?.message || 'Evaluation not available yet.');
      setSelectedReviewInterviewId(interview.id);
      setSelectedReviewTab('evaluation');
    }
  };

  const handleUpdateStatus = (candidateId) => {
    const interview = findInterviewForCandidate(candidateId);
    if (!interview?.id) {
      setActionMessage('No interview found for this candidate.');
      return;
    }
    setStatusUpdateModal({ open: true, interviewId: interview.id, currentStatus: interview.pipelineStatus || interview.status || 'SCREENING' });
  };

  const handleScheduleInterview = () => {
    navigate('/company-interviews');
  };

  const handleCreateTemplate = () => {
    navigate('/company-templates');
  };

  const handleGenerateReport = () => {
    navigate('/company-analytics');
  };

  const handleExportReport = () => {
    navigate('/company-analytics');
  };

  const handleOpenAssignedReviews = () => {
    navigate('/company-reviews');
  };

  const handleOpenAssignedReviewInterview = (interviewId) => {
    if (!interviewId) return;
    navigate(`/company-reviews?interviewId=${encodeURIComponent(interviewId)}&tab=review`);
  };

  const PIPELINE_STAGE_OPTIONS = [
    { value: 'SCREENING', label: 'Screening' },
    { value: 'INTERVIEW', label: 'Interview' },
    { value: 'OFFER', label: 'Offer' },
    { value: 'HIRED', label: 'Hired' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  const handleStatusUpdateSubmit = async (newStatus) => {
    if (!statusUpdateModal.interviewId || !newStatus) return;
    setStatusUpdateLoading(true);
    try {
      await apiClient.pipeline.move(statusUpdateModal.interviewId, { pipelineStatus: newStatus });
      setStatusUpdateModal({ open: false, interviewId: null, currentStatus: 'SCREENING' });
      setActionMessage('');
      await fetchCompanyData();
    } catch (err) {
      setActionMessage(err?.message || 'Failed to update status. Please try again.');
      setStatusUpdateModal({ open: false, interviewId: null, currentStatus: 'SCREENING' });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header 
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />
      
      {/* Maintenance Mode Banner */}
      {maintenanceMode && <MaintenanceBanner />}
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            assistantProps={{ interviews: safeInterviews, metrics }}
          />
          
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              animate="visible"
              className="dashboard-layout"
            >
              {/* Pending Approval Banner */}
              {user?.organizationContext?.organization && (
                <PendingApprovalBanner organization={user.organizationContext.organization} />
              )}
              
              {/* Hero Welcome Section */}
              <motion.div
                variants={fadeUpChild}
                className="relative overflow-hidden card-base p-2.5 xs:p-3 sm:p-4 shadow-glass dark:shadow-glass-dark"
              >
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-3 py-1 xs:px-4 xs:py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      <span className="h-1.5 w-1.5 xs:h-2 xs:w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                      <span>{heroBadgeLabel}</span>
                    </div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Welcome back, {user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Team Lead'}
                    </h1>
                    <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      {heroDescription}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-2.5 sm:p-3 shadow-xl shadow-blue-500/40 w-full lg:w-auto lg:min-w-[160px] xl:min-w-[180px]">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70">{heroEventLabel}</p>
                    <div className="mt-0.5 sm:mt-1 text-base xs:text-lg sm:text-xl font-semibold truncate">
                      {latestCompanyName}
                    </div>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                      {heroEventDetail}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-2 sm:mt-3 grid grid-cols-1 xs:grid-cols-3 gap-1.5 xs:gap-2 sm:gap-2.5">
                  {heroHighlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-2 py-1.5 xs:px-2.5 xs:py-2 shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-wider sm:tracking-[0.2em] text-gray-500 dark:text-slate-400 truncate">{item.label}</p>
                      <p className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">{item.value}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {actionMessage && (
                <motion.div variants={fadeUpChild} className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
                  {actionMessage}
                </motion.div>
              )}

              {isReviewerOnly ? (
                <motion.div
                  variants={staggeredChildren}
                  className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 items-start"
                >
                  <motion.div variants={fadeUpChild} className="xl:col-span-8 space-y-3 sm:space-y-4">
                    <OverviewPanel
                      dashboardMetrics={dashboardMetrics}
                      activeJobPostings={activeJobPostings}
                      pendingReviews={pendingReviews}
                      upcomingInterviews={upcomingInterviews}
                      interviewsToday={interviewsToday}
                      completedReviews={completedReviews}
                      roleVariant="reviewer"
                      onViewAllJobs={null}
                      onViewPendingReviews={() => navigate('/company-reviews')}
                      onViewUpcomingInterviews={canAccessInterviewsPage ? () => navigate('/company-interviews') : null}
                    />
                    <ReviewerDashboardPanel
                      interviews={safeInterviews}
                      onOpenWorkspace={handleOpenAssignedReviews}
                      onOpenInterview={handleOpenAssignedReviewInterview}
                    />
                  </motion.div>
                  <motion.div variants={fadeUpChild} className="xl:col-span-4 space-y-3 sm:space-y-4">
                    <QuickActions
                      onScheduleInterview={handleScheduleInterview}
                      onCreateTemplate={handleCreateTemplate}
                      onGenerateReport={handleGenerateReport}
                      organizationRole={organizationRole}
                    />
                  </motion.div>
                </motion.div>
              ) : (
                <>
                  {/* Main Content Grid */}
                  <motion.div
                    variants={staggeredChildren}
                    className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 items-start"
                  >
                    <motion.div variants={fadeUpChild} className="xl:col-span-8 space-y-3 sm:space-y-4">
                      <OverviewPanel
                        dashboardMetrics={dashboardMetrics}
                        activeJobPostings={activeJobPostings}
                        pendingReviews={pendingReviews}
                        upcomingInterviews={upcomingInterviews}
                        interviewsToday={interviewsToday}
                        completedReviews={completedReviews}
                        roleVariant="company"
                        onViewAllJobs={canAccessJobsPage ? () => navigate('/company-jobs') : null}
                        onViewPendingReviews={canAccessInterviewsPage ? () => navigate('/company-interviews') : null}
                        onViewUpcomingInterviews={canAccessInterviewsPage ? () => navigate('/company-interviews') : null}
                      />

                      {/* Show metrics for ADMIN and RECRUITER only */}
                      {canManageCandidates && canViewAnalytics && (
                        <HiringMetrics 
                          metrics={metrics}
                          interviews={safeInterviews}
                          onExportReport={handleExportReport} 
                        />
                      )}

                      {canManageCandidates && (
                        <HiringInsightsBoard
                          interviews={safeInterviews}
                          jobs={safeJobs}
                          onCreateJob={() => navigate('/company-jobs')}
                          onScheduleInterview={handleScheduleInterview}
                          onOpenCandidates={() => navigate('/company-candidates')}
                        />
                      )}
                    </motion.div>
                    <motion.div variants={fadeUpChild} className="xl:col-span-4 space-y-3 sm:space-y-4">
                      <QuickActions
                        onScheduleInterview={handleScheduleInterview}
                        onCreateTemplate={handleCreateTemplate}
                        onGenerateReport={handleGenerateReport}
                        organizationRole={organizationRole}
                      />
                      {canManageCandidates && (
                        <HiringFocusPanel
                          interviews={safeInterviews}
                          jobs={safeJobs}
                          pendingReviews={pendingReviews}
                          onOpenInterviews={handleScheduleInterview}
                          onOpenCandidates={() => navigate('/company-candidates')}
                          onOpenJobs={() => navigate('/company-jobs')}
                        />
                      )}
                    </motion.div>
                  </motion.div>

                  {/* Recruiter Pipeline - Full Width */}
                  {canManageCandidates && (
                    <motion.div variants={fadeUpChild} className="mt-3 sm:mt-4">
                      <CandidatePipeline />
                    </motion.div>
                  )}
                </>
              )}

              {/* Recent Interviews - Full Width */}
              <motion.div variants={fadeUpChild} className="mt-3 sm:mt-4" data-section="candidates">
                <CandidateTable
                  interviews={safeInterviews}
                  onViewRecording={handleViewRecording}
                  onViewAnalysis={handleViewAnalysis}
                  onUpdateStatus={handleUpdateStatus}
                  canExport={canExportReports}
                  canUpdateStatus={canUpdateApplicationStatus}
                  roleVariant={isReviewerOnly ? 'reviewer' : 'company'}
                />
              </motion.div>
            </motion.section>
          </main>
        </div>

        {selectedReviewInterviewId && !isReviewerOnly && (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Interview review details"
            onClick={() => {
              setSelectedReviewInterviewId(null);
              setSelectedReviewTab('overview');
              clearReviewSearchParams();
            }}
          >
            <div className="min-h-screen px-4 py-20 sm:px-6 lg:px-8">
              <div
                className="mx-auto w-full max-w-7xl rounded-[28px] border border-white/10 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-6 shadow-[0_30px_120px_rgba(15,23,42,0.45)]"
                onClick={(event) => event.stopPropagation()}
              >
                <InterviewReviewEnhanced
                  interviewId={selectedReviewInterviewId}
                  initialActiveTab={selectedReviewTab}
                  onClose={() => {
                    setSelectedReviewInterviewId(null);
                    setSelectedReviewTab('overview');
                    clearReviewSearchParams();
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {statusUpdateModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Update Pipeline Status</h3>
                <button
                  type="button"
                  onClick={() => setStatusUpdateModal({ open: false, interviewId: null, currentStatus: 'SCREENING' })}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-full p-1"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-400">Move this candidate to a new stage in your hiring pipeline.</p>
              <div className="space-y-2">
                {PIPELINE_STAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={statusUpdateLoading}
                    onClick={() => handleStatusUpdateSubmit(option.value)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      statusUpdateModal.currentStatus === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500'
                    } disabled:opacity-50`}
                  >
                    {option.label}
                    {statusUpdateModal.currentStatus === option.value && (
                      <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">(current)</span>
                    )}
                  </button>
                ))}
              </div>
              {statusUpdateLoading && (
                <p className="text-xs text-center text-gray-500 dark:text-slate-400">Updating...</p>
              )}
            </div>
          </div>
        )}

        {/* Floating Action Button - Mobile Only - ADMIN and RECRUITER only */}
        {hasPermission(organizationRole, 'SEND_INVITATIONS') && (
          <div className="lg:hidden fixed bottom-20 right-4 z-30">
            <Button
              variant="default"
              size="icon"
              className="w-12 h-12 xs:w-14 xs:h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/40 hover:from-blue-700 hover:to-purple-700"
              onClick={handleScheduleInterview}
              aria-label="Schedule new interview"
            >
              <Icon name="Plus" size={22} color="white" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDashboard;
