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
import AIChatAssistant from './components/AIChatAssistant';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleToggleAIChat = () => {
    setIsAIChatOpen(!isAIChatOpen);
  };

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


  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setError(null);
    try {
      const [interviewsResult, analyticsResult] = await Promise.allSettled([
        apiClient.interviews.getMyInterviews(),
        apiClient.analytics.getDashboard(),
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
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
  const readinessScore = analytics?.averageScore ?? 82;
  const insightsCount = analytics?.insightsCount ?? 6;

  const heroHighlights = [
    {
      label: 'Readiness score',
      value: `${Math.round(readinessScore)}%`,
      detail: 'Last 30 day average'
    },
    {
      label: 'Upcoming sessions',
      value: safeInterviews?.length || 0,
      detail: 'Interviews scheduled'
    },
    {
      label: 'AI insights',
      value: insightsCount,
      detail: 'Generated this week'
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
              className="container-responsive py-4 xs:py-5 sm:py-6 md:py-8 lg:py-10 space-y-4 xs:space-y-5 sm:space-y-6 lg:space-y-8"
            >
              {showInitialLoader && (
                <motion.div
                  variants={fadeUpChild}
                  className="card-base p-6 sm:p-8 text-center"
                >
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-primary mx-auto mb-3 sm:mb-4" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Syncing your interview data...</p>
                </motion.div>
              )}
              
              {/* Hero Welcome Section */}
              <motion.div
                variants={fadeUpChild}
                className="relative overflow-hidden card-base p-4 xs:p-5 sm:p-6 md:p-8 shadow-glass dark:shadow-glass-dark"
              >
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2 sm:space-y-3">
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
                  <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-4 sm:p-5 shadow-xl shadow-blue-500/40 w-full lg:w-auto lg:min-w-[200px] xl:min-w-[240px]">
                    <p className="text-[10px] xs:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70">Live status</p>
                    <div className="mt-1.5 sm:mt-2 text-xl xs:text-2xl sm:text-3xl font-semibold truncate">{safeInterviews?.[0]?.company || 'Interview AI'}</div>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                      {safeInterviews?.[0]?.date ? `Next interview • ${safeInterviews[0].date}` : 'Pipeline ready'}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-4 sm:mt-6 grid grid-cols-1 xs:grid-cols-3 gap-2 xs:gap-3 sm:gap-4">
                  {heroHighlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl sm:rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-3 py-2 xs:px-4 xs:py-3 shadow-sm"
                    >
                      <p className="text-[10px] xs:text-xs uppercase tracking-wider sm:tracking-[0.2em] text-gray-500 dark:text-slate-400 truncate">{item.label}</p>
                      <p className="text-lg xs:text-xl sm:text-2xl font-semibold text-gray-900 dark:text-slate-100">{item.value}</p>
                      <p className="text-[10px] xs:text-xs text-gray-500 dark:text-slate-400 truncate">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div variants={fadeUpChild}>
                <DashboardQuickActions userType="candidate" className="relative z-10" />
              </motion.div>

              {/* Main Content Grid */}
              <motion.div
                variants={staggeredChildren}
                className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6"
              >
                <motion.div variants={fadeUpChild} className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <ProgressOverviewCard 
                    analytics={analytics}
                    interviews={safeInterviews}
                  />
                  <RecentActivityFeed activities={safeInterviews} />
                </motion.div>
                <motion.div variants={fadeUpChild} className="space-y-4 sm:space-y-6">
                  <QuickStartPanel />
                  <SchedulingWidget />
                  <AchievementBadges />
                </motion.div>
              </motion.div>

              {/* Insights Section */}
              <motion.div
                variants={fadeUpChild}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
              >
                <RecommendedTopics />
                <div className="card-base p-4 sm:p-6 shadow-card">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">AI-Powered Insights</h3>
                    <span className="text-[10px] xs:text-xs uppercase tracking-widest sm:tracking-[0.3em] text-blue-600 dark:text-blue-400">Live feed</span>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100">
                          Communication confidence +23%
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-slate-400">
                          Based on your last 5 practice sessions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100">
                          Technical problem-solving in top quartile
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-slate-400">
                          Ready for senior-level technical interviews
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
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
      {/* AI Chat Assistant */}
      <AIChatAssistant 
        isOpen={isAIChatOpen}
        onToggle={handleToggleAIChat}
      />
    </div>
  );
};

export default CandidateDashboard;
