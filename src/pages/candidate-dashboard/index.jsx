import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import DashboardQuickActions from '../../components/ui/DashboardQuickActions';
import ProgressOverviewCard from './components/ProgressOverviewCard';
import QuickStartPanel from './components/QuickStartPanel';
import RecentActivityFeed from './components/RecentActivityFeed';
import RecommendedTopics from './components/RecommendedTopics';
import SchedulingWidget from './components/SchedulingWidget';
import AchievementBadges from './components/AchievementBadges';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);


  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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

  const formatInterviewDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';
      const parsed = Date.parse(trimmed);
      return Number.isNaN(parsed) ? trimmed : new Date(parsed).toLocaleDateString();
    }
    if (typeof value?.toDate === 'function') {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  };


  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setError(null);
    try {
      const [interviewsResult, analyticsResult, dashboardMetricsResult] = await Promise.allSettled([
        apiClient.interviews.getMyInterviews(),
        apiClient.analytics.getDashboard(),
        apiClient.analytics.getCandidateDashboardMetrics(),
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
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Loading your dashboard"
        message="Pulling your latest interview insights and progress."
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

  // Ensure interviews is always an array
  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  
  // Use comparison metrics if available, otherwise fall back to calculated values
  const scoreMetrics = dashboardMetrics?.averageScore;
  const completedMetrics = dashboardMetrics?.completedInterviews;
  const scheduledMetrics = dashboardMetrics?.scheduledInterviews;
  const gradeMetrics = dashboardMetrics?.currentGrade;
  
  // Fallback calculations from raw data
  const completedInterviews = completedMetrics?.value ?? safeInterviews.filter(i => i?.status?.toUpperCase() === 'COMPLETED').length;
  const scheduledInterviews = scheduledMetrics?.value ?? safeInterviews.filter(i => i?.status?.toUpperCase() === 'SCHEDULED').length;
  const averageScore = scoreMetrics?.value ?? analytics?.averageScore ?? null;
  const currentGrade = gradeMetrics?.value ?? null;
  
  // Find the latest/upcoming interview for display
  const latestInterview = safeInterviews[0] || null;
  const latestCompanyName = formatCompanyLabel(latestInterview?.company) || 'Interview AI';
  const latestInterviewDate = formatInterviewDate(
    latestInterview?.scheduledFor ||
    latestInterview?.date ||
    latestInterview?.createdAt ||
    latestInterview?.updatedAt
  );

  const heroHighlights = [
    {
      label: 'Average score',
      value: averageScore ? `${Math.round(averageScore)}%` : '—',
      detail: scoreMetrics?.changeText || 'From completed interviews'
    },
    {
      label: 'Upcoming',
      value: scheduledInterviews,
      detail: scheduledMetrics?.changeText || 'Interviews scheduled'
    },
    {
      label: 'Completed',
      value: completedInterviews,
      detail: completedMetrics?.changeText || 'Total interviews done'
    }
  ];

  const showInitialLoader = dataLoading && !safeInterviews.length && !analytics;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
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
              className="container-responsive py-2 xs:py-3 sm:py-4 space-y-2 xs:space-y-3 sm:space-y-4"
            >
              {showInitialLoader && (
                <motion.div variants={fadeUpChild}>
                  <LoadingState
                    title="Syncing your interview data"
                    message="Updating your analytics and recent sessions."
                    variant="card"
                    tone="primary"
                  />
                </motion.div>
              )}
              
              {/* Hero Welcome Section */}
              <motion.div
                variants={fadeUpChild}
                className="relative overflow-hidden card-base p-2.5 xs:p-3 sm:p-4 shadow-glass dark:shadow-glass-dark"
              >
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-3 py-1 xs:px-4 xs:py-1.5 text-[10px] xs:text-xs font-semibold text-blue-700 dark:text-blue-300">
                      <span className="h-1.5 w-1.5 xs:h-2 xs:w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                      <span>Realtime performance intelligence</span>
                    </div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Welcome back, {user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Innovator'} 👋
                    </h1>
                    <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      Your AI coach has synced your latest practice sessions. Continue the streak,
                      schedule live interviews, and unlock new achievement badges.
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-2.5 sm:p-3 shadow-xl shadow-blue-500/40 w-full lg:w-auto lg:min-w-[160px] xl:min-w-[180px]">
                    <p className="text-[10px] xs:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70">Live status</p>
                    <div className="mt-0.5 sm:mt-1 text-base xs:text-lg sm:text-xl font-semibold truncate">{latestCompanyName}</div>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                      {latestInterviewDate ? `Next interview - ${latestInterviewDate}` : 'Pipeline ready'}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-2 sm:mt-3 grid grid-cols-1 xs:grid-cols-3 gap-1.5 xs:gap-2 sm:gap-2.5">
                  {heroHighlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-2 py-1.5 xs:px-2.5 xs:py-2 shadow-sm"
                    >
                      <p className="text-[10px] xs:text-xs uppercase tracking-wider sm:tracking-[0.2em] text-gray-500 dark:text-slate-400 truncate">{item.label}</p>
                      <p className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">{item.value}</p>
                      <p className="text-[10px] xs:text-xs text-gray-500 dark:text-slate-400 truncate">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div variants={fadeUpChild}>
                <DashboardQuickActions 
                  userType="candidate" 
                  className="relative z-10"
                  stats={{
                    practiceSessions: completedInterviews,
                    avgScore: averageScore ? Math.round(averageScore) : null,
                    liveInterviews: scheduledInterviews + (dashboardMetrics?.inProgressInterviews || 0),
                    totalPracticeTime: null // Not tracked in backend yet
                  }}
                />
              </motion.div>

              {/* Main Content Grid */}
              <motion.div
                variants={staggeredChildren}
                className="space-y-2 sm:space-y-3"
              >
                {/* Progress Overview - Full Width */}
                <motion.div variants={fadeUpChild}>
                  <ProgressOverviewCard 
                    analytics={analytics}
                    interviews={safeInterviews}
                    dashboardMetrics={dashboardMetrics}
                  />
                </motion.div>

                {/* My Applications Quick Link */}
                <motion.div variants={fadeUpChild}>
                  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-6 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
                          <Icon name="FileText" size={20} color="white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                            My Applications
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-slate-400">
                            Track and manage your job applications
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate('/my-applications')}
                        variant="outline"
                        className="rounded-full"
                      >
                        <Icon name="ArrowRight" size={16} className="mr-2" />
                        View All
                      </Button>
                    </div>
                  </div>
                </motion.div>

                {/* Two Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3">
                  <motion.div variants={fadeUpChild} className="lg:col-span-2 space-y-2 sm:space-y-3">
                    <RecentActivityFeed activities={safeInterviews} />
                    <SchedulingWidget upcomingInterviews={safeInterviews} />
                    {/* Managing interview anxiety (2.6.4 ii: feedback on performance problems related to anxiety) */}
                    <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-900/20 dark:to-orange-900/20 p-4 sm:p-5 shadow-lg">
                      <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                        <Icon name="Heart" className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        Managing interview anxiety
                      </h3>
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-3">
                        Many candidates find anxiety the biggest challenge. Use these evidence-based tips to stay calm and perform your best:
                      </p>
                      <ul className="space-y-2 text-sm text-amber-900 dark:text-amber-100">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                          <span><strong>Breathe before answering:</strong> Take a short pause and one deep breath to steady your voice and thoughts.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                          <span><strong>Structure helps:</strong> Using STAR (Situation, Task, Action, Result) gives you a clear frame so you feel less on the spot.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                          <span><strong>Practice out loud:</strong> Rehearsing answers aloud reduces nervousness and improves fluency on the day.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                          <span><strong>Focus on one question at a time:</strong> Avoid worrying about what’s next; answer the current question well.</span>
                        </li>
                      </ul>
                    </div>
                  </motion.div>
                  <motion.div variants={fadeUpChild} className="space-y-2 sm:space-y-3">
                    <QuickStartPanel />
                    <AchievementBadges />
                  </motion.div>
                </div>
              </motion.div>

              {/* Insights Section */}
              <motion.div
                variants={fadeUpChild}
                className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3"
              >
                <RecommendedTopics />
                <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">AI-Powered Insights</h2>
                    <span className="text-[10px] xs:text-xs uppercase tracking-widest sm:tracking-[0.3em] text-blue-600 dark:text-blue-400">Live feed</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100">
                          Communication confidence +23%
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-slate-400">
                          Based on your last 5 practice sessions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100">
                          Technical problem-solving in top quartile
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-slate-400">
                          Ready for senior-level technical interviews
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100">
                          Opportunity: deepen system design answers
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-slate-400">
                          Recommended focus: 2-3 hours per week
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CandidateDashboard;
