import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import DashboardQuickActions from '../../components/ui/DashboardQuickActions';
import ProgressOverviewCard from './components/ProgressOverviewCard';
import QuickStartPanel from './components/QuickStartPanel';
import RecentActivityFeed from './components/RecentActivityFeed';
import RecommendedTopics from './components/RecommendedTopics';
import SchedulingWidget from './components/SchedulingWidget';
import AchievementBadges from './components/AchievementBadges';
import SavedAnswersPanel from './components/SavedAnswersPanel';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import InterviewCalendar from '../../components/ui/InterviewCalendar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import GroqUsageSnapshotPanel from '../../components/ui/GroqUsageSnapshotPanel.jsx';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import { useInterviewRealtimeFeed } from '../../hooks/useInterviewRealtimeFeed';
import { deriveDashboardInsights } from './utils/candidateInsights.js';
import { getDerivedApplicationStatus } from './utils/candidateApplicationFilters.js';
import {
  getCandidateActiveInterviews,
  getCandidateUpcomingScheduledInterviews,
} from '../../utils/candidateInterviewWindows.js';
import {
  INTERVIEW_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../constants/realtimeFeedEvents.js';

const QUICK_START_DIFFICULTY_MAP = Object.freeze({
  beginner: 'easy',
  intermediate: 'medium',
  advanced: 'hard',
  expert: 'hard',
});

const PIPELINE_SEGMENTS = Object.freeze([
  { key: 'SUBMITTED', label: 'Submitted', color: '#2563eb' },
  { key: 'SCREENING', label: 'Screening', color: '#0ea5e9' },
  { key: 'INTERVIEWING', label: 'Interviewing', color: '#14b8a6' },
  { key: 'SHORTLISTED', label: 'Shortlisted', color: '#10b981' },
  { key: 'OFFER', label: 'Offer', color: '#f59e0b' },
  { key: 'HIRED', label: 'Hired', color: '#22c55e' },
  { key: 'CLOSED', label: 'Closed', color: '#94a3b8' },
]);

const ACTIVE_INTERVIEW_STATUSES = new Set(['SCHEDULED', 'IN_PROGRESS']);

const toUpperCode = (value) => String(value || '').trim().toUpperCase();

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateLabel = (value) => {
  const parsed = toDate(value);
  if (!parsed) return 'No date';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCompanyLabel = (company) => {
  if (!company) return '';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') {
    return company.displayName || company.name || company.companyName || company.fullName || company.email || '';
  }
  return '';
};

const formatInterviewDate = (value) => {
  if (!value) return '';
  const parsed = toDate(value);
  if (!parsed) {
    return typeof value === 'string' ? value : '';
  }
  return parsed.toLocaleDateString();
};

const resolveInterviewTimestamp = (interview = {}) =>
  interview?.scheduledFor
  || interview?.endedAt
  || interview?.updatedAt
  || interview?.createdAt
  || null;

const extractInterviewScore = (interview = {}) => {
  const candidates = [
    interview?.overallScore,
    interview?.score,
    interview?.evaluation?.overallScore,
    interview?.analytics?.overallScore,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }

  return null;
};

const buildPerformanceTrend = (interviews = []) =>
  (Array.isArray(interviews) ? interviews : [])
    .map((interview) => {
      const score = extractInterviewScore(interview);
      const timestamp = toDate(resolveInterviewTimestamp(interview));
      if (score == null || !timestamp) return null;
      return {
        id: interview?.id || `${timestamp.getTime()}`,
        dateLabel: toDateLabel(timestamp),
        score: Math.round(score),
        timestamp: timestamp.getTime(),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-8)
    .map((entry, index) => ({
      ...entry,
      sessionLabel: `S${index + 1}`,
    }));

const getSignedPointsLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'N/A';
  if (parsed === 0) return '0 pts';
  return `${parsed > 0 ? '+' : ''}${parsed} pts`;
};

const buildTrajectorySummary = (trend = []) => {
  if (!Array.isArray(trend) || trend.length === 0) return null;

  const scores = trend
    .map((entry) => Number(entry?.score))
    .filter((score) => Number.isFinite(score));

  if (!scores.length) return null;

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const averageScore = Math.round(totalScore / scores.length);
  const peakScore = Math.max(...scores);
  const firstSession = trend[0];
  const latestSession = trend[trend.length - 1];
  const previousSession = trend.length > 1 ? trend[trend.length - 2] : null;
  const recentSessions = trend
    .map((entry, index) => ({
      ...entry,
      deltaFromPrevious: index > 0 ? entry.score - trend[index - 1].score : null,
    }))
    .slice(-4)
    .reverse();
  const netChange = latestSession && firstSession
    ? latestSession.score - firstSession.score
    : 0;
  const latestDelta = latestSession && previousSession
    ? latestSession.score - previousSession.score
    : null;

  if (averageScore === 0 && peakScore === 0) {
    return {
      averageScore,
      peakScore,
      trackedSessions: trend.length,
      netChange,
      recentSessions,
      statusLabel: 'Baseline',
      statusClassName: 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300',
      coachTitle: 'Build the first lift',
      coachNote: 'You have a clear baseline. Use the next practice run to improve one answer framework and one pacing habit.',
    };
  }

  if (latestDelta != null && latestDelta >= 6) {
    return {
      averageScore,
      peakScore,
      trackedSessions: trend.length,
      netChange,
      recentSessions,
      statusLabel: 'Rising',
      statusClassName: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300',
      coachTitle: 'Momentum is building',
      coachNote: `Your latest session jumped ${getSignedPointsLabel(latestDelta)}. Repeat the prep pattern from that round while it is still fresh.`,
    };
  }

  if (latestDelta != null && latestDelta <= -6) {
    return {
      averageScore,
      peakScore,
      trackedSessions: trend.length,
      netChange,
      recentSessions,
      statusLabel: 'Cooling',
      statusClassName: 'bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300',
      coachTitle: 'Recent dip detected',
      coachNote: `The latest session slipped ${getSignedPointsLabel(latestDelta)}. Review missed moments from the previous round before you practice again.`,
    };
  }

  if (netChange >= 10) {
    return {
      averageScore,
      peakScore,
      trackedSessions: trend.length,
      netChange,
      recentSessions,
      statusLabel: 'Positive',
      statusClassName: 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300',
      coachTitle: 'Trend is climbing',
      coachNote: `Across the tracked window you are up ${getSignedPointsLabel(netChange)}. Focus on consistency so the next score does not fall back.`,
    };
  }

  if (netChange <= -10) {
    return {
      averageScore,
      peakScore,
      trackedSessions: trend.length,
      netChange,
      recentSessions,
      statusLabel: 'Rebuild',
      statusClassName: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300',
      coachTitle: 'Stabilize the floor',
      coachNote: `You are down ${getSignedPointsLabel(netChange)} across the tracked window. A focused fundamentals round should help reset the baseline.`,
    };
  }

  return {
    averageScore,
    peakScore,
    trackedSessions: trend.length,
    netChange,
    recentSessions,
    statusLabel: 'Steady',
    statusClassName: 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300',
    coachTitle: 'Progress is compact',
    coachNote: 'Scores are clustering tightly. Pick one skill for the next round so the curve moves with intent.',
  };
};

const toPipelineKey = (status) => {
  switch (status) {
    case 'SUBMITTED':
    case 'SCREENING':
    case 'INTERVIEWING':
    case 'SHORTLISTED':
    case 'OFFER':
    case 'HIRED':
      return status;
    default:
      return 'CLOSED';
  }
};

const buildApplicationPipeline = (applications = []) => {
  const initialCounts = PIPELINE_SEGMENTS.reduce((accumulator, segment) => {
    accumulator[segment.key] = 0;
    return accumulator;
  }, {});

  (Array.isArray(applications) ? applications : []).forEach((application) => {
    const derivedStatus = getDerivedApplicationStatus(application);
    const key = toPipelineKey(derivedStatus);
    initialCounts[key] += 1;
  });

  const segments = PIPELINE_SEGMENTS.map((segment) => ({
    ...segment,
    count: initialCounts[segment.key] || 0,
  }));

  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const activeCount = segments
    .filter((segment) => ['SUBMITTED', 'SCREENING', 'INTERVIEWING', 'SHORTLISTED', 'OFFER'].includes(segment.key))
    .reduce((sum, segment) => sum + segment.count, 0);
  const strongSignalCount = (initialCounts.SHORTLISTED || 0) + (initialCounts.OFFER || 0) + (initialCounts.HIRED || 0);

  return {
    segments,
    total,
    activeCount,
    strongSignalCount,
    conversionRate: total > 0 ? Math.round((strongSignalCount / total) * 100) : 0,
  };
};

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const score = payload[0]?.value;
  return (
    <div className="rounded-xl border border-white/30 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-xl">
      <p className="font-medium">{label}</p>
      <p className="text-blue-300">Score: {score}%</p>
    </div>
  );
};

const PROFILE_COMPLETION_FIELDS = Object.freeze([
  'fullName',
  'targetRole',
  'experienceLevel',
  'industry',
  'location',
  'phoneNumber',
  'linkedinUrl',
]);

const getProfileCompletion = (user = {}) => {
  const filled = PROFILE_COMPLETION_FIELDS.reduce((count, key) => {
    const value = user?.[key];
    if (typeof value === 'string' && value.trim().length > 0) return count + 1;
    return count;
  }, 0);
  const total = PROFILE_COMPLETION_FIELDS.length;
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percentage };
};

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [applications, setApplications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const realtimeRefreshTimeoutRef = useRef(null);
  const fetchDashboardDataRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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


  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setError(null);
    try {
      const [interviewsResult, analyticsResult, dashboardMetricsResult, applicationsResult] = await Promise.allSettled([
        apiClient.interviews.getMyInterviews(),
        apiClient.analytics.getDashboard(),
        apiClient.analytics.getCandidateDashboardMetrics(),
        apiClient.applications.getMyApplications({ limit: 100 }),
      ]);

      if (interviewsResult.status === 'fulfilled' && interviewsResult.value.success) {
        setInterviews(interviewsResult.value.interviews || []);
      } else {
        setInterviews([]);
      }

      if (analyticsResult.status === 'fulfilled' && analyticsResult.value.success) {
        setAnalytics(analyticsResult.value.stats || null);
      } else {
        setAnalytics(null);
      }

      if (dashboardMetricsResult.status === 'fulfilled' && dashboardMetricsResult.value.success) {
        setDashboardMetrics(dashboardMetricsResult.value.metrics || null);
      } else {
        setDashboardMetrics(null);
      }

      if (applicationsResult.status === 'fulfilled' && applicationsResult.value.success) {
        setApplications(Array.isArray(applicationsResult.value.applications) ? applicationsResult.value.applications : []);
      } else {
        setApplications([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  const handleStartPractice = useCallback(({ role, difficulty } = {}) => {
    const normalizedRole = typeof role === 'string' ? role.trim() : '';
    const normalizedDifficultyKey = typeof difficulty === 'string'
      ? difficulty.toLowerCase().trim()
      : '';
    const normalizedDifficulty = QUICK_START_DIFFICULTY_MAP[normalizedDifficultyKey] || 'medium';

    try {
      const existingDraftRaw = localStorage.getItem('interviewSetupDraft');
      const existingDraft = existingDraftRaw ? JSON.parse(existingDraftRaw) : {};
      const existingAdvancedSettings = existingDraft?.advancedSettings
        && typeof existingDraft.advancedSettings === 'object'
        ? existingDraft.advancedSettings
        : {};

      const nextDraft = {
        ...existingDraft,
        jobRole: normalizedRole || existingDraft?.jobRole || '',
        advancedSettings: {
          ...existingAdvancedSettings,
          difficulty: normalizedDifficulty,
        },
      };

      localStorage.setItem('interviewSetupDraft', JSON.stringify(nextDraft));
    } catch (_error) {
      // Fail-open: users can still continue to setup and configure manually.
    }

    navigate('/practice-interview-setup');
  }, [navigate]);

  useEffect(() => {
    fetchDashboardDataRef.current = fetchDashboardData;
  }, [fetchDashboardData]);

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
        fetchDashboardDataRef.current?.();
      }, 300);
    },
  });

  useEffect(() => () => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  const safeApplications = Array.isArray(applications) ? applications : [];
  const performanceTrend = useMemo(
    () => buildPerformanceTrend(safeInterviews),
    [safeInterviews],
  );
  const applicationPipeline = useMemo(
    () => buildApplicationPipeline(safeApplications),
    [safeApplications],
  );
  const trajectorySummary = useMemo(
    () => buildTrajectorySummary(performanceTrend),
    [performanceTrend],
  );
  const showInitialLoader = dataLoading && !safeInterviews.length && !analytics;

  if (status === 'loading' || !user || showInitialLoader) {
    return (
      <LoadingState
        title="Checking your session and syncing your user data"
        message="Verifying secure access and loading your analytics and recent sessions."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-error mb-3 sm:mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={fetchDashboardData}
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

  // Use comparison metrics if available, otherwise fall back to calculated values
  const scoreMetrics = dashboardMetrics?.averageScore;
  const completedMetrics = dashboardMetrics?.completedInterviews;
  const scheduledMetrics = dashboardMetrics?.scheduledInterviews;
  
  // Fallback calculations from raw data
  const completedInterviews = completedMetrics?.value ?? safeInterviews.filter((interview) => toUpperCode(interview?.status) === 'COMPLETED').length;
  const candidateActiveInterviews = getCandidateActiveInterviews(safeInterviews);
  const upcomingScheduledInterviews = getCandidateUpcomingScheduledInterviews(safeInterviews);
  const scheduledInterviews = upcomingScheduledInterviews.length;
  const inProgressInterviews = candidateActiveInterviews.filter((interview) => toUpperCode(interview?.status) === 'IN_PROGRESS').length;
  const pendingSchedulingInterviews = candidateActiveInterviews.filter(
    (interview) => toUpperCode(interview?.status) === 'SCHEDULED' && !interview?.scheduledFor,
  ).length;
  const activeInterviewCount = scheduledInterviews + inProgressInterviews + pendingSchedulingInterviews;
  const averageScore = scoreMetrics?.value ?? analytics?.averageScore ?? null;
  const totalPracticeTime = dashboardMetrics?.totalPracticeTime?.formatted ?? null;
  
  // Find the latest/upcoming interview for display
  const latestInterview = upcomingScheduledInterviews[0] || null;
  const latestCompanyName = formatCompanyLabel(latestInterview?.organization || latestInterview?.company) || 'Interview AI';
  const latestInterviewDate = formatInterviewDate(
    latestInterview?.scheduledFor ||
    latestInterview?.date ||
    latestInterview?.createdAt ||
    latestInterview?.updatedAt
  );

  const heroHighlights = [
    {
      label: 'Average score',
      value: averageScore ? `${Math.round(averageScore)}%` : 'N/A',
      detail: scoreMetrics?.changeText || 'From completed interviews'
    },
    {
      label: 'Active pipeline',
      value: activeInterviewCount,
      detail: scheduledMetrics?.changeText || 'Scheduled + in progress'
    },
    {
      label: 'Completed',
      value: completedInterviews,
      detail: completedMetrics?.changeText || 'Total interviews done'
    }
  ];

  const trendLatest = performanceTrend[performanceTrend.length - 1] || null;
  const trendPrevious = performanceTrend.length > 1 ? performanceTrend[performanceTrend.length - 2] : null;
  const trendDelta = trendLatest && trendPrevious ? trendLatest.score - trendPrevious.score : null;

  const applicationNarrative = applicationPipeline.total === 0
    ? 'No applications yet. Start applying to build your interview pipeline.'
    : `${applicationPipeline.activeCount} active applications, ${applicationPipeline.strongSignalCount} in strong-signal stages.`;
  const chartsEnabled = typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined';
  const profileCompletion = getProfileCompletion(user);

  const nextAction = (() => {
    if (completedInterviews === 0) {
      return {
        title: 'Start your first practice interview',
        detail: 'A scored session unlocks trends and personalized recommendations.',
        actionLabel: 'Start Practice',
        onClick: () => navigate('/practice-interview-setup'),
      };
    }
    if (applicationPipeline.total === 0) {
      return {
        title: 'Build your application pipeline',
        detail: 'Apply to roles that match your target and track progress here.',
        actionLabel: 'Browse Jobs',
        onClick: () => navigate('/jobs'),
      };
    }
    if (scheduledInterviews > 0) {
      return {
        title: 'Review upcoming interviews',
        detail: 'Confirm schedule details and join links before your sessions.',
        actionLabel: 'Open Applications',
        onClick: () => navigate('/my-applications'),
      };
    }
    if (activeInterviewCount > 0) {
      return {
        title: 'Track active interview workflows',
        detail: 'Some interviews are active but still waiting for scheduling details or recruiter follow-up.',
        actionLabel: 'Open Applications',
        onClick: () => navigate('/my-applications'),
      };
    }
    return {
      title: 'Strengthen answer quality',
      detail: 'Run another practice session and save standout responses.',
      actionLabel: 'Practice Again',
      onClick: () => navigate('/practice-interview-setup'),
    };
  })();

  const dashboardInsights = deriveDashboardInsights({
    interviews: safeInterviews,
    dashboardMetrics,
    analytics,
    applications: safeApplications,
  });

  const insightDotClassByColor = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
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
        userType="candidate" 
        isAuthenticated
        onLogout={handleLogout}
      />
      
      {/* Maintenance Mode Banner */}
      {maintenanceMode && <MaintenanceBanner />}
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      <GroqUsageSnapshotPanel
        description="Testing visibility for the shared Groq interview provider across the dashboard."
        topOffsetClassName={maintenanceMode ? 'top-32 xs:top-36 sm:top-40' : 'top-16 xs:top-[4.5rem] sm:top-20'}
      />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
              isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
            }`}
          >
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              animate="visible"
              className="dashboard-layout"
            >
              {/* Hero Welcome Section */}
              <motion.div
                variants={fadeUpChild}
                className="relative overflow-hidden card-base p-3 sm:p-4 lg:p-5 shadow-glass dark:shadow-glass-dark"
              >
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-3 py-1 xs:px-4 xs:py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      <span className="h-1.5 w-1.5 xs:h-2 xs:w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                      <span>Realtime performance intelligence</span>
                    </div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Welcome back, {user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Innovator'}
                    </h1>
                    <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      Track interviews, applications, and readiness from one place.
                      Focus on the next best action and keep your momentum strong.
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-2.5 sm:p-3 shadow-xl shadow-blue-500/40 w-full lg:w-auto lg:min-w-[160px] xl:min-w-[180px]">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70">Live status</p>
                    <div className="mt-0.5 sm:mt-1 text-base xs:text-lg sm:text-xl font-semibold truncate">
                      {latestInterview ? latestCompanyName : 'Interview AI'}
                    </div>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                      {latestInterviewDate
                        ? `Next interview - ${latestInterviewDate}`
                        : activeInterviewCount > 0
                          ? `${activeInterviewCount} interview workflow${activeInterviewCount === 1 ? '' : 's'} active`
                          : 'Pipeline ready'}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-3 sm:mt-4 grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-3">
                  {heroHighlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-2.5 py-2 xs:px-3 xs:py-2.5 shadow-sm"
                    >
                      <p className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-[0.18em] text-gray-500 dark:text-slate-400 truncate">{item.label}</p>
                      <p className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">{item.value}</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div variants={fadeUpChild}>
                <DashboardQuickActions 
                  userType="candidate" 
                  className="relative z-10"
                  showStats={false}
                  stats={{
                    practiceSessions: completedInterviews,
                    avgScore: averageScore ? Math.round(averageScore) : null,
                    liveInterviews: activeInterviewCount,
                    totalPracticeTime,
                  }}
                />
              </motion.div>

              <motion.div
                variants={staggeredChildren}
                className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 items-start"
              >
                <motion.div variants={fadeUpChild} className="xl:col-span-8 space-y-4 sm:space-y-5">
                  <ProgressOverviewCard
                    analytics={analytics}
                    interviews={safeInterviews}
                    dashboardMetrics={dashboardMetrics}
                    user={user}
                  />

                  <div className="grid grid-cols-1 2xl:grid-cols-5 gap-4">
                    <div className="2xl:col-span-3 h-full rounded-2xl border border-white/30 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
                            Performance Trajectory
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                            Last scored sessions and movement over time.
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">Latest</p>
                          <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                            {trendLatest ? `${trendLatest.score}%` : 'N/A'}
                          </p>
                          {trendDelta != null && (
                            <p className={`text-xs font-medium ${trendDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                              {trendDelta >= 0 ? '+' : ''}{trendDelta}% vs previous
                            </p>
                          )}
                        </div>
                      </div>

                      {performanceTrend.length > 1 && chartsEnabled ? (
                        <>
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={performanceTrend} margin={{ top: 12, right: 6, left: -22, bottom: 6 }}>
                                <defs>
                                  <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                                <XAxis dataKey="sessionLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip content={<TrendTooltip />} />
                                <Area
                                  type="monotone"
                                  dataKey="score"
                                  stroke="#2563eb"
                                  strokeWidth={2.4}
                                  fill="url(#scoreArea)"
                                  activeDot={{ r: 4, fill: '#1d4ed8' }}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>

                          {trajectorySummary && (
                            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] flex-1">
                              <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 p-3 sm:p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                      Trajectory Signals
                                    </p>
                                    <h4 className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                                      {trajectorySummary.coachTitle}
                                    </h4>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${trajectorySummary.statusClassName}`}>
                                    {trajectorySummary.statusLabel}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                                  {trajectorySummary.coachNote}
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <div className="rounded-lg border border-white/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/80 px-3 py-2.5">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Best score</p>
                                    <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-300">
                                      {trajectorySummary.peakScore}%
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-white/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/80 px-3 py-2.5">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Average</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {trajectorySummary.averageScore}%
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-white/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/80 px-3 py-2.5">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Net change</p>
                                    <p className={`mt-1 text-sm font-semibold ${trajectorySummary.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                      {getSignedPointsLabel(trajectorySummary.netChange)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-white/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/80 px-3 py-2.5">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Tracked</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {trajectorySummary.trackedSessions} sessions
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/30 p-3 sm:p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                      Session Feed
                                    </p>
                                    <h4 className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                                      Recent scored rounds
                                    </h4>
                                  </div>
                                  <span className="rounded-full bg-slate-900/5 dark:bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    Last {trajectorySummary.recentSessions.length}
                                  </span>
                                </div>

                                <div className="mt-3 space-y-2">
                                  {trajectorySummary.recentSessions.map((session) => (
                                    <div
                                      key={session.id}
                                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/90 dark:bg-slate-800/70 px-3 py-2"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                          {session.sessionLabel}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-slate-400">
                                          {session.dateLabel}
                                        </p>
                                      </div>

                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                          {session.score}%
                                        </p>
                                        <p className={`text-[11px] font-medium ${session.deltaFromPrevious == null || session.deltaFromPrevious >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                          {session.deltaFromPrevious == null ? 'Starting point' : getSignedPointsLabel(session.deltaFromPrevious)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-xl border border-dashed border-blue-200/70 dark:border-blue-700/50 bg-blue-50/70 dark:bg-blue-900/15 p-5 text-center">
                          <Icon name="BarChart3" className="w-8 h-8 mx-auto text-blue-600 dark:text-blue-300 mb-2" />
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Not enough scored interviews yet</p>
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 mb-3">
                            Complete at least two interviews to unlock trend charts and pacing insights.
                          </p>
                          <Button onClick={() => navigate('/practice-interview-setup')} className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 border-none text-white">
                            Start Practice
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="2xl:col-span-2 rounded-2xl border border-white/30 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur">
                      <div className="mb-3">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Application Pipeline</h3>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                          {applicationNarrative}
                        </p>
                      </div>

                      {applicationPipeline.total > 0 ? (
                        <>
                          <div className="h-40 sm:h-44 relative">
                            {chartsEnabled ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={applicationPipeline.segments}
                                    dataKey="count"
                                    nameKey="label"
                                    innerRadius={48}
                                    outerRadius={72}
                                    paddingAngle={2}
                                    stroke="none"
                                  >
                                    {applicationPipeline.segments.map((segment) => (
                                      <Cell key={segment.key} fill={segment.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    formatter={(value, name) => [value, name]}
                                    contentStyle={{ borderRadius: 10, border: '1px solid rgba(148,163,184,0.3)', fontSize: 12 }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="h-full rounded-xl border border-dashed border-slate-300/70 dark:border-slate-600/60 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-center px-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                  Pipeline chart is available in the live dashboard view.
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5 mb-4">
                            {applicationPipeline.segments.map((segment) => (
                              <div key={segment.key} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-2 text-gray-600 dark:text-slate-300">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
                                  {segment.label}
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-slate-100">{segment.count}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-dashed border-blue-200/70 dark:border-blue-700/40 bg-blue-50/70 dark:bg-blue-900/20 p-4 text-center mb-4">
                          <Icon name="Briefcase" className="w-7 h-7 mx-auto text-blue-600 dark:text-blue-300 mb-2" />
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">No applications yet</p>
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-300 mt-1 leading-relaxed">
                            Apply to a few roles to unlock pipeline analytics and conversion trends.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Strong signal</p>
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{applicationPipeline.strongSignalCount}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Conversion</p>
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{applicationPipeline.conversionRate}%</p>
                        </div>
                      </div>

                      <div className="flex flex-col xs:flex-row gap-2">
                        <Button onClick={() => navigate('/my-applications')} variant="outline" className="rounded-full flex-1">
                          View All
                        </Button>
                        <Button onClick={() => navigate('/jobs')} className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 border-none text-white flex-1">
                          Browse Jobs
                        </Button>
                      </div>
                    </div>
                  </div>

                  <SchedulingWidget
                    upcomingInterviews={safeInterviews}
                    onScheduleSaved={fetchDashboardData}
                  />

                  <div id="recommended-topics">
                    <RecommendedTopics
                      interviews={safeInterviews}
                      dashboardMetrics={dashboardMetrics}
                      analytics={analytics}
                      applications={safeApplications}
                      onRefresh={fetchDashboardData}
                      refreshing={dataLoading}
                      onStartPractice={handleStartPractice}
                    />
                  </div>

                  <div id="saved-answers">
                    <SavedAnswersPanel />
                  </div>

                </motion.div>

                <motion.div variants={fadeUpChild} className="xl:col-span-4 space-y-4 sm:space-y-5">
                  <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Focus for today</h2>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Priority</span>
                    </div>

                    <div className="rounded-xl border border-blue-200/60 dark:border-blue-700/50 bg-blue-50/70 dark:bg-blue-900/20 px-3 py-3 mb-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{nextAction.title}</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 mt-1 mb-3 leading-relaxed">{nextAction.detail}</p>
                      <Button
                        onClick={nextAction.onClick}
                        className="w-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 border-none text-white"
                      >
                        {nextAction.actionLabel}
                      </Button>
                    </div>

                    <div className="rounded-xl border border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 px-3 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Profile completion</p>
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          {profileCompletion.percentage}%
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mb-2.5">
                        {profileCompletion.filled}/{profileCompletion.total} fields completed
                      </p>
                      <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden mb-3">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
                          style={{ width: `${profileCompletion.percentage}%` }}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => navigate('/candidate-settings')}
                        className="w-full rounded-full"
                      >
                        Update Profile
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">AI-Powered Insights</h2>
                      <span className="text-xs uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">Live feed</span>
                    </div>
                    <div className="space-y-3">
                      {dashboardInsights.map((insight) => (
                        <div key={insight.id} className="rounded-xl border border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <div
                              className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${insightDotClassByColor[insight.color] || 'bg-blue-500'}`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{insight.title}</p>
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">{insight.detail}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <QuickStartPanel onStartPractice={handleStartPractice} />

                  <InterviewCalendar
                    interviews={safeInterviews}
                    userType="candidate"
                  />

                  <div id="recent-activity">
                    <RecentActivityFeed
                      activities={safeInterviews}
                      onViewAll={() => navigate('/my-applications')}
                      onViewHistory={() => navigate('/my-applications')}
                    />
                  </div>

                  <div id="interview-claim-toolkit">
                    <div className="rounded-2xl border border-amber-200/70 dark:border-amber-700/50 bg-gradient-to-br from-amber-50/90 via-amber-50/70 to-orange-100/60 dark:from-amber-900/20 dark:via-amber-900/10 dark:to-orange-900/20 p-4 sm:p-5 shadow-lg">
                      <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                        <Icon name="HeartPulse" className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                        Interview Claim Toolkit
                      </h3>
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-3">
                        Keep this short routine before each session to stay clear and confident.
                      </p>
                      <ul className="space-y-2 text-sm text-amber-900 dark:text-amber-100">
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <span><strong>60-second reset:</strong> One deep breath and a five-second pause before your first answer.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <span><strong>Use STAR structure:</strong> It reduces pressure and keeps answers concise.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <span><strong>Think in checkpoints:</strong> Handle one question at a time, not the entire interview at once.</span>
                        </li>
                      </ul>

                      <div className="mt-4 pt-4 border-t border-amber-200/70 dark:border-amber-700/40">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300 mb-2">
                          Session prep flow
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg border border-amber-200/80 dark:border-amber-700/40 bg-amber-100/70 dark:bg-amber-900/20 px-2.5 py-2">
                            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">90 sec</p>
                            <p className="text-[11px] text-amber-800 dark:text-amber-200">Breath + posture reset</p>
                          </div>
                          <div className="rounded-lg border border-amber-200/80 dark:border-amber-700/40 bg-amber-100/70 dark:bg-amber-900/20 px-2.5 py-2">
                            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">1 prompt</p>
                            <p className="text-[11px] text-amber-800 dark:text-amber-200">Warm-up STAR answer</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => navigate('/practice-interview-setup')}
                          className="w-full rounded-full bg-amber-600 hover:bg-amber-700 border-none text-white"
                        >
                          Start Warm-Up
                        </Button>
                      </div>
                    </div>
                  </div>

                </motion.div>

                <motion.div variants={fadeUpChild} className="xl:col-span-12">
                  <div id="achievement-badges">
                    <AchievementBadges
                      interviews={safeInterviews}
                      dashboardMetrics={dashboardMetrics}
                      analytics={analytics}
                      applications={safeApplications}
                    />
                  </div>
                </motion.div>
              </motion.div>

            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CandidateDashboard;
