import React, { useState, useEffect } from 'react';
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
import { authHelpers } from '../../config/firebase.js';

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const handleToggleAIChat = () => {
    setIsAIChatOpen(!isAIChatOpen);
  };

  const handleLogout = async () => {
    try {
      await authHelpers.signOut();
      
      // Clear all auth-related localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('socialAuthVerified');
      localStorage.removeItem('socialAuthData');
      localStorage.removeItem('socialAuthIntent');
      localStorage.removeItem('socialAuthProvider');
      localStorage.removeItem('pendingRegistration');
      localStorage.removeItem('pendingAccountType');
      
      // Clear any legacy auth storage keys to avoid stale sessions
      const legacyAuthKeys = Object.keys(localStorage).filter(k => 
        /firebase|legacyAuth/i.test(k)
      );
      legacyAuthKeys.forEach(key => localStorage.removeItem(key));
      
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Still clear everything and redirect on error
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('socialAuthVerified');
      localStorage.removeItem('socialAuthData');
      localStorage.removeItem('socialAuthIntent');
      localStorage.removeItem('socialAuthProvider');
      localStorage.removeItem('pendingRegistration');
      localStorage.removeItem('pendingAccountType');
      
      // Clear any legacy auth-related localStorage keys
      const authKeys = Object.keys(localStorage).filter(k => 
        /firebase|legacyAuth/i.test(k)
      );
      authKeys.forEach(key => localStorage.removeItem(key));
      
      navigate('/login');
    }
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


  // 1. Instantly show dashboard if cached user exists
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData && typeof userData === 'object') {
          setUser(userData);
          setLoading(false); // Show dashboard instantly
        }
      } catch (e) {
        // If parsing fails, treat as not authenticated
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // 2. In background, verify session and update user data
  useEffect(() => {
    let isMounted = true;
    setVerifying(true);
    const verifySessionAndLoadData = async () => {
      try {
        // Check Firebase session
        const { data } = await authHelpers.getSession();
        const session = data?.session;
        if (!session) {
          throw new Error('Session expired. Please log in again.');
        }
        // Check backend user
        const userData = await apiClient.auth.getMe();
        if (!userData.success || !userData.user) {
          throw new Error('User not found. Please log in again.');
        }
        // Update localStorage and state
        localStorage.setItem('user', JSON.stringify(userData.user));
        if (isMounted) setUser(userData.user);
        // Fetch interviews
        try {
          const interviewsData = await apiClient.interviews.getMyInterviews();
          if (interviewsData.success && Array.isArray(interviewsData.interviews)) {
            if (isMounted) setInterviews(interviewsData.interviews);
          } else {
            if (isMounted) setInterviews([]);
          }
        } catch {
          if (isMounted) setInterviews([]);
        }
        // Fetch analytics
        try {
          const analyticsData = await apiClient.analytics.getDashboard();
          if (analyticsData.success && analyticsData) {
            if (isMounted) setAnalytics(analyticsData);
          } else {
            if (isMounted) setAnalytics(null);
          }
        } catch {
          if (isMounted) setAnalytics(null);
        }
        if (isMounted) setError(null);
      } catch (err) {
        // If session or backend check fails, log out and redirect
        setUser(null);
        setError(err.message || 'Session expired. Please log in again.');
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        setTimeout(() => navigate('/login'), 1500);
      } finally {
        if (isMounted) setVerifying(false);
      }
    };
    verifySessionAndLoadData();
    return () => { isMounted = false; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-error mb-3 sm:mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="text-sm sm:text-base text-primary hover:underline"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Ensure interviews is always an array
  const safeInterviews = Array.isArray(interviews) ? interviews : [];

  const heroHighlights = [
    {
      label: 'Readiness score',
      value: `${Math.round(analytics?.averageScore ?? 82)}%`,
      detail: 'Last 30 day average'
    },
    {
      label: 'Upcoming sessions',
      value: safeInterviews?.length || 0,
      detail: 'Interviews scheduled'
    },
    {
      label: 'AI insights',
      value: analytics?.insightsCount || 6,
      detail: 'Generated this week'
    }
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 right-0 h-80 w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[420px] w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <div className="relative z-10">
        <Header 
          userType="candidate" 
          isAuthenticated={!!user}
          onLogout={handleLogout}
        />
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main
            className={`flex-1 transition-all duration-300 lg:pl-4 ${
              isNavCollapsed ? 'lg:ml-20' : 'lg:ml-[18rem]'
            }`}
          >
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-10 space-y-6 sm:space-y-8 lg:space-y-10"
            >
              <motion.div
                variants={fadeUpChild}
                className="relative overflow-hidden rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 sm:p-8 shadow-[0_30px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur"
              >
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="inline-flex items-center space-x-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span>Realtime performance intelligence</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100">
                      Welcome back, {user?.fullName || user?.email?.split('@')[0] || 'Innovator'} 👋
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-slate-300 max-w-2xl">
                      Your AI coach has synced your latest practice sessions. Continue the streak,
                      schedule live interviews, and unlock new achievement badges.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-5 shadow-xl shadow-blue-500/40 w-full sm:w-auto">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/70">Live status</p>
                    <div className="mt-2 text-3xl font-semibold">{safeInterviews?.[0]?.company || 'Interview AI'}</div>
                    <p className="text-sm text-white/80">
                      {safeInterviews?.[0]?.date ? `Next interview • ${safeInterviews[0].date}` : 'Pipeline ready'}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-6 grid gap-4 sm:grid-cols-3">
                  {heroHighlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-4 py-3 shadow-sm shadow-blue-500/10"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">{item.label}</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{item.value}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeUpChild}>
                <DashboardQuickActions userType="candidate" className="relative z-10" />
              </motion.div>

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

              <motion.div
                variants={fadeUpChild}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
              >
                <RecommendedTopics />
                <div className="rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">AI-Powered Insights</h3>
                    <span className="text-xs uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400">Live feed</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          Communication confidence +23%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Based on your last 5 practice sessions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          Technical problem-solving in top quartile
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Ready for senior-level technical interviews
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          Opportunity: deepen system design answers
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
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