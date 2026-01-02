import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import DashboardQuickActions from '../../components/ui/DashboardQuickActions';
import OverviewPanel from './components/OverviewPanel';
import CandidatePipeline from './components/CandidatePipeline';
import CandidateTable from './components/CandidateTable';
import HiringMetrics from './components/HiringMetrics';
import QuickActions from './components/QuickActions';
import OrganizationAdminPanel from './components/OrganizationAdminPanel';
import InvitationManager from './components/InvitationManager';
import ReviewerPanel from './components/ReviewerPanel';
import AIChatAssistant from './components/AIChatAssistant';
import PendingApprovalBanner from './components/PendingApprovalBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleToggleAIChat = () => {
    setIsAIChatOpen(!isAIChatOpen);
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
      const [interviewsResult, metricsResult] = await Promise.allSettled([
        apiClient.interviews.getCompanyInterviews(),
        apiClient.analytics.getCompanyMetrics(),
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
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [navigate, user]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

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

  // Calculate derived data - must be before conditional returns (Rules of Hooks)
  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  const recentActivity = safeInterviews
    .filter(i => i && ['COMPLETED', 'IN_PROGRESS'].includes(i.status))
    .slice(0, 4)
    .map(interview => ({
      type: interview.status === 'COMPLETED' ? 'interview_completed' : 'live_session',
      title: `${interview.candidate?.fullName || interview.candidate?.email || 'Candidate'} - ${interview.jobRole || 'Interview'}`,
      description: interview.status === 'COMPLETED' 
        ? `Interview completed ${interview.endedAt || interview.updatedAt ? new Date(interview.endedAt || interview.updatedAt).toLocaleDateString() : ''}`
        : 'Interview in progress',
      timestamp: interview.updatedAt || interview.createdAt ? new Date(interview.updatedAt || interview.createdAt) : new Date()
    }));

  const interviewsToday = safeInterviews.filter((interview) => {
    if (!interview?.scheduledFor) return false;
    const interviewDate = new Date(interview.scheduledFor);
    const today = new Date();
    return (
      interviewDate.getDate() === today.getDate() &&
      interviewDate.getMonth() === today.getMonth() &&
      interviewDate.getFullYear() === today.getFullYear()
    );
  }).length;

  const heroHighlights = [
    {
      label: 'Active roles',
      value: metrics?.activeJobPostings || safeInterviews?.length || 0,
      detail: 'Open requisitions'
    },
    {
      label: 'Avg time to hire',
      value: metrics?.averageTimeToHire || '18d',
      detail: 'Last 30 days'
    },
    {
      label: 'Interviews today',
      value: interviewsToday,
      detail: 'On the calendar'
    }
  ];

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

  const showInitialLoader = dataLoading && !safeInterviews.length && !metrics;

  const handleViewRecording = (candidateId) => {
    console.log('Viewing recording for candidate:', candidateId);
    // Navigate to recording viewer
  };

  const handleViewAnalysis = (candidateId) => {
    console.log('Viewing analysis for candidate:', candidateId);
    // Navigate to analysis report
  };

  const handleUpdateStatus = (candidateId) => {
    console.log('Updating status for candidate:', candidateId);
    // Open status update modal
  };

  const handleScheduleInterview = () => {
    window.location.href = '/practice-interview-setup';
  };

  const handleCreateTemplate = () => {
    window.location.href = '/practice-interview-setup';
  };

  const handleGenerateReport = () => {
    console.log('Generating hiring report...');
    // Generate and download report
  };

  const handleExportReport = () => {
    console.log('Exporting metrics report...');
    // Export metrics data
  };

  const handleActionClick = (action) => {
    switch (action?.id) {
      case 'setup-interview':
        window.location.href = '/practice-interview-setup';
        break;
      case 'review-candidates':
        // Scroll to candidate table or filter
        document.querySelector('[data-section="candidates"]')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'live-session':
        window.location.href = '/live-interview-session';
        break;
      default:
        console.log('Action clicked:', action?.id);
    }
  };

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
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
      />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              animate="visible"
              className="container-responsive py-2 xs:py-3 sm:py-4 space-y-2 xs:space-y-3 sm:space-y-4"
            >
              {showInitialLoader && (
                <motion.div
                  variants={fadeUpChild}
                  className="card-base p-4 sm:p-6 text-center"
                >
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-primary mx-auto mb-3 sm:mb-4" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Syncing your company data...</p>
                </motion.div>
              )}

              {/* Pending Approval Banner */}
              {!showInitialLoader && user?.organizationContext?.organization && (
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
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-3 py-1 xs:px-4 xs:py-1.5 text-[10px] xs:text-xs font-semibold text-blue-700 dark:text-blue-300">
                      <span className="h-1.5 w-1.5 xs:h-2 xs:w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                      <span>AI-powered hiring control center</span>
                    </div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Welcome back, {user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Team Lead'} 👋
                    </h1>
                    <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      {user?.companyName || 'Your organization'} is synced. Continue orchestrating interviews,
                      review AI insights, and fast-forward decisions.
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-2.5 sm:p-3 shadow-xl shadow-blue-500/40 w-full lg:w-auto lg:min-w-[160px] xl:min-w-[180px]">
                    <p className="text-[10px] xs:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70">Next live event</p>
                    <div className="mt-0.5 sm:mt-1 text-base xs:text-lg sm:text-xl font-semibold truncate">
                      {safeInterviews?.find((i) => i?.company)?.company ||
                        user?.companyName ||
                        user?.organizationContext?.organization?.displayName ||
                        'Live session'}
                    </div>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                      {interviewsToday > 0 ? `${interviewsToday} interviews today` : 'Pipeline ready'}
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
                  userType="company"
                  recentActivity={recentActivity}
                  onActionClick={handleActionClick}
                />
              </motion.div>

              {/* Main Content Grid */}
              <motion.div
                variants={staggeredChildren}
                className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3"
              >
                <motion.div variants={fadeUpChild} className="lg:col-span-2 space-y-2 sm:space-y-3">
                  <OverviewPanel
                    activeJobPostings={metrics?.activeJobPostings || safeInterviews?.length || 0}
                    pendingReviews={safeInterviews?.filter(i => i && i.status === 'COMPLETED' && !i.evaluation)?.length || 0}
                    upcomingInterviews={safeInterviews?.filter(i => i && i.status === 'SCHEDULED')?.length || 0}
                    onViewAllJobs={() => console.log('View all jobs')}
                    onViewPendingReviews={() => console.log('View pending reviews')}
                    onViewUpcomingInterviews={() => console.log('View upcoming interviews')}
                  />
                  <CandidatePipeline />
                  <HiringMetrics 
                    metrics={metrics}
                    interviews={safeInterviews}
                    onExportReport={handleExportReport} 
                  />
                  {user?.organizationContext?.membership?.role === 'ADMIN' && (
                    <OrganizationAdminPanel />
                  )}
                </motion.div>
                <motion.div variants={fadeUpChild} className="space-y-2 sm:space-y-3">
                  <QuickActions
                    onScheduleInterview={handleScheduleInterview}
                    onCreateTemplate={handleCreateTemplate}
                    onGenerateReport={handleGenerateReport}
                  />
                  <ReviewerPanel interviews={safeInterviews} />
                  <InvitationManager />
                </motion.div>
              </motion.div>

              {/* Recent Interviews - Full Width */}
              <motion.div variants={fadeUpChild} data-section="candidates">
                <CandidateTable
                  interviews={safeInterviews}
                  onViewRecording={handleViewRecording}
                  onViewAnalysis={handleViewAnalysis}
                  onUpdateStatus={handleUpdateStatus}
                />
              </motion.div>
            </motion.section>
          </main>
        </div>

        {/* Floating Action Button - Mobile Only */}
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
      </div>
      {/* AI Chat Assistant */}
      <AIChatAssistant 
        isOpen={isAIChatOpen}
        onToggle={handleToggleAIChat}
        interviews={safeInterviews}
        metrics={metrics}
      />
    </div>
  );
};

export default CompanyDashboard;

