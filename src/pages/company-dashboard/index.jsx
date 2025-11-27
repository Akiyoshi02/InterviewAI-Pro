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
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  const viewportConfig = { once: true, amount: 0.2 };

  const sectionReveal = {
    hidden: { opacity: 0, y: 40 },
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
        staggerChildren: 0.12,
        delayChildren: 0.05
      }
    }
  };

  const fadeUpChild = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' }
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
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
      title: `${interview.candidate?.fullName || 'Candidate'} - ${interview.jobRole || 'Interview'}`,
      description: interview.status === 'COMPLETED' 
        ? `Interview completed ${interview.endedAt || interview.updatedAt ? new Date(interview.endedAt || interview.updatedAt).toLocaleDateString() : ''}`
        : 'Interview in progress',
      timestamp: interview.updatedAt || interview.createdAt ? new Date(interview.updatedAt || interview.createdAt) : new Date(),
      interview
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

  const handleCandidateMove = (candidateId, newStage) => {
    console.log('Moving candidate:', candidateId, 'to stage:', newStage);
    // Update candidate pipeline stage
  };

  const handleBulkAction = (action, candidateIds) => {
    console.log('Bulk action:', action, 'for candidates:', candidateIds);
    // Perform bulk action
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
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 right-0 h-96 w-96 bg-gradient-to-br from-blue-400/30 via-purple-400/20 to-transparent blur-[140px]" />
        <div className="absolute bottom-0 left-[-10%] h-[420px] w-[420px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <div className="relative z-10">
        <Header 
          userType="company"
          isAuthenticated
          onLogout={handleLogout}
        />
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          
          <main className={`flex-1 transition-all duration-300 lg:pl-4 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[18rem]'
          }`}>
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-10 space-y-6 sm:space-y-8 lg:space-y-10"
            >
              {showInitialLoader && (
                <motion.div
                  variants={fadeUpChild}
                  className="rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-8 text-center"
                >
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Loading company analytics...</p>
                </motion.div>
              )}
              <motion.div
                variants={fadeUpChild}
                className="relative overflow-hidden rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 sm:p-8 shadow-[0_30px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur"
              >
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="inline-flex items-center space-x-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span>AI-powered hiring control center</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100">
                      Welcome back, {user?.fullName || user?.email?.split('@')[0] || 'Team Lead'} 👋
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-slate-300 max-w-2xl">
                      {user?.companyName || 'Your organization'} is synced. Continue orchestrating interviews,
                      review AI insights, and fast-forward decisions.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-5 shadow-xl shadow-blue-500/40 w-full sm:w-auto">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/70">Next live event</p>
                    <div className="mt-2 text-3xl font-semibold">
                      {safeInterviews?.find((i) => i?.company) ?.company || currentUser?.companyName || 'Live session'}
                    </div>
                    <p className="text-sm text-white/80">
                      {interviewsToday > 0 ? `${interviewsToday} interviews today` : 'Pipeline ready'}
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

                <div className="relative z-10 mt-6 flex flex-wrap gap-3">
                  <Button
                    variant="default"
                    iconName="Plus"
                    iconPosition="left"
                    onClick={handleScheduleInterview}
                    className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                  >
                    Schedule Interview
                  </Button>
                  <Button
                    variant="outline"
                    iconName="Video"
                    iconPosition="left"
                    onClick={() => window.location.href = '/live-interview-session'}
                    className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Start Live Session
                  </Button>
                </div>
              </motion.div>

              <motion.div variants={fadeUpChild}>
                <OverviewPanel
                  activeJobPostings={metrics?.activeJobPostings || safeInterviews?.length || 0}
                  pendingReviews={safeInterviews?.filter(i => i && i.status === 'COMPLETED' && !i.evaluation)?.length || 0}
                  upcomingInterviews={safeInterviews?.filter(i => i && i.status === 'SCHEDULED')?.length || 0}
                  onViewAllJobs={() => console.log('View all jobs')}
                  onViewPendingReviews={() => console.log('View pending reviews')}
                  onViewUpcomingInterviews={() => console.log('View upcoming interviews')}
                />
              </motion.div>

              <motion.div variants={fadeUpChild}>
                <DashboardQuickActions
                  userType="company"
                  recentActivity={recentActivity}
                  onActionClick={handleActionClick}
                />
              </motion.div>

              <motion.div variants={fadeUpChild}>
                <CandidatePipeline
                  onCandidateMove={handleCandidateMove}
                  onBulkAction={handleBulkAction}
                />
              </motion.div>

              <motion.div variants={fadeUpChild} data-section="candidates">
                <CandidateTable
                  interviews={safeInterviews}
                  onViewRecording={handleViewRecording}
                  onViewAnalysis={handleViewAnalysis}
                  onUpdateStatus={handleUpdateStatus}
                />
              </motion.div>

              <motion.div
                variants={staggeredChildren}
                className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 lg:gap-8"
              >
                <motion.div variants={fadeUpChild} className="xl:col-span-3">
                  <HiringMetrics 
                    metrics={metrics}
                    interviews={safeInterviews}
                    onExportReport={handleExportReport} 
                  />
                </motion.div>
                
                <motion.div variants={fadeUpChild} className="xl:col-span-1">
                  <QuickActions
                    onScheduleInterview={handleScheduleInterview}
                    onCreateTemplate={handleCreateTemplate}
                    onGenerateReport={handleGenerateReport}
                  />
                </motion.div>
              </motion.div>
            </motion.section>
          </main>
        </div>

        {/* Mobile Navigation Helper */}
        <div className="lg:hidden fixed bottom-6 right-6 z-20">
          <Button
            variant="default"
            size="icon"
            className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/40 hover:from-blue-700 hover:to-purple-700"
            onClick={handleScheduleInterview}
          >
            <Icon name="Plus" size={24} color="white" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompanyDashboard;