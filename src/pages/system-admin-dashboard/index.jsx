import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import OrganizationApprovalQueue from './components/OrganizationApprovalQueue.jsx';
import SystemStats from './components/SystemStats.jsx';
import PlatformAuditLogs from './components/PlatformAuditLogs.jsx';
import SystemSettings from './components/SystemSettings.jsx';
import AllOrganizationsList from './components/AllOrganizationsList.jsx';
import LiveChatManager from './components/LiveChatManager.jsx';
import TrainingDataManager from './components/TrainingDataManager.jsx';
import FairnessCalibrationPanel from './components/FairnessCalibrationPanel.jsx';
import ClassificationMetricsPanel from './components/ClassificationMetricsPanel.jsx';
import ModelFineTuningPanel from './components/ModelFineTuningPanel.jsx';
import MediaPipeCalibrationPanel from './components/MediaPipeCalibrationPanel.jsx';
import ResearchToolsPanel from './components/ResearchToolsPanel.jsx';
import UserManagementPanel from './components/UserManagementPanel.jsx';
import PlatformOperationsPanel from './components/PlatformOperationsPanel.jsx';
import apiClient from '../../services/apiClient.js';
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';
import {
  ADMIN_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../constants/realtimeFeedEvents.js';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';

const SECTION_DEFINITIONS = [
  {
    id: 'approvals',
    title: 'Organization Approvals',
    description: 'Review and process pending organization verification requests.',
    icon: 'CheckCircle',
  },
  {
    id: 'organizations',
    title: 'All Organizations',
    description: 'View all organizations and manage lifecycle status.',
    icon: 'Building',
  },
  {
    id: 'users',
    title: 'User Management',
    description: 'Manage user access, role elevation, and account status.',
    icon: 'Users',
  },
  {
    id: 'operations',
    title: 'Platform Operations',
    description: 'Monitor billing, data retention, and operational health.',
    icon: 'Wallet',
  },
  {
    id: 'fairness',
    title: 'Fairness and Calibration',
    description: 'Inspect fairness quality and calibration outcomes.',
    icon: 'Scale',
  },
  {
    id: 'classification',
    title: 'Classification Metrics',
    description: 'Confusion matrix and precision/recall/F1 for AI vs SME score classification.',
    icon: 'Grid3X3',
  },
  {
    id: 'fine-tuning',
    title: 'Model Fine-Tuning',
    description: 'Train and evaluate domain-specialized LLM from collected interview data.',
    icon: 'Cpu',
  },
  {
    id: 'mediapipe-calibration',
    title: 'MediaPipe Calibration',
    description: 'Compare static posture/face thresholds against data-driven calibrated values.',
    icon: 'ScanFace',
  },
  {
    id: 'training-data',
    title: 'Training Data Governance',
    description: 'Manage datasets for evaluation and model training workflows.',
    icon: 'Database',
  },
  {
    id: 'research-tools',
    title: 'Research Tools',
    description: 'Record posture/gestures, analyze videos, and add external datasets.',
    icon: 'FlaskConical',
  },
  {
    id: 'live-chat',
    title: 'Live Chat',
    description: 'Monitor and respond to visitor conversations from admin console.',
    icon: 'MessageSquare',
  },
  {
    id: 'settings',
    title: 'System Settings',
    description: 'Update global maintenance and platform settings.',
    icon: 'Settings',
  },
  {
    id: 'audit',
    title: 'Audit Logs',
    description: 'Track system-level actions and administrative events.',
    icon: 'FileText',
  },
];

const SECTION_MAP = SECTION_DEFINITIONS.reduce((acc, section) => {
  acc[section.id] = section;
  return acc;
}, {});

const getSectionPath = (sectionId) => {
  if (!sectionId || sectionId === 'overview') return '/system-admin-dashboard';
  return `/system-admin-dashboard/${sectionId}`;
};

const SectionContainer = ({ title, description, icon, children }) => (
  <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/88 dark:bg-slate-800/85 p-4 sm:p-6 shadow-lg space-y-4">
    <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-slate-700">
      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
        <Icon name={icon} className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{description}</p>
      </div>
    </div>
    {children}
  </section>
);

const SystemAdminDashboard = () => {
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const { section } = useParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadStatsRef = useRef(null);

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

  const activeSection = useMemo(() => {
    if (!section) return 'overview';
    return SECTION_MAP[section] ? section : null;
  }, [section]);

  useEffect(() => {
    if (activeSection === null) {
      navigate('/system-admin-dashboard', { replace: true });
    }
  }, [activeSection, navigate]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.getStats();
      if (result.success) {
        setStats(result.stats);
      }
    } catch {
      // Silent failure — dashboard stats unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadStatsRef.current = loadStats;
  }, [loadStats]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    eventTypes: combineRealtimeEventTypes(
      ADMIN_FEED_EVENTS.organizations,
      ADMIN_FEED_EVENTS.settings,
      ADMIN_FEED_EVENTS.users,
      ADMIN_FEED_EVENTS.operations,
      ADMIN_FEED_EVENTS.datasets,
      ADMIN_FEED_EVENTS.interviews,
      ADMIN_FEED_EVENTS.reviews,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadStatsRef.current?.();
      }, 300);
    },
  });

  useEffect(() => () => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigateToSection = useCallback((sectionId) => {
    navigate(getSectionPath(sectionId));
  }, [navigate]);

  const showInitialLoader = loading && !stats;

  if (status === 'loading' || !user || activeSection === null || showInitialLoader) {
    return (
      <LoadingState
        title="Checking your session and syncing your platform data"
        message="Verifying secure access and loading platform controls and governance metrics."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  const pendingApprovals = stats?.organizations?.pending || 0;
  const totalOrganizations = stats?.organizations?.total || 0;
  const totalUsers = stats?.users?.total || 0;
  const totalInterviews = stats?.interviews?.total || 0;
  const recentActivity = Array.isArray(stats?.recentActivity) ? stats.recentActivity : [];
  const firstName = user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Admin';
  const isOverview = activeSection === 'overview';
  const sectionMeta = isOverview
    ? {
      title: `Welcome back, ${firstName}`,
      description: 'Centralized controls for organizations, users, operations, and policy governance.',
      icon: 'LayoutDashboard',
    }
    : SECTION_MAP[activeSection];

  const renderOverview = () => (
    <>
      {stats ? (
        <SystemStats stats={stats} onRefresh={loadStats} />
      ) : (
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
          <div className="text-center py-8">
            <Icon name="AlertTriangle" className="w-10 h-10 text-yellow-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-slate-400 mb-4">Unable to load platform metrics.</p>
            <Button onClick={loadStats}>Retry</Button>
          </div>
        </div>
      )}

      {recentActivity.length > 0 && (
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-6 shadow-lg">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Recent Administrative Activity</h2>
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <Icon name="Activity" className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="text-gray-900 dark:text-slate-100 font-medium">{log.action}</div>
                  <div className="text-gray-600 dark:text-slate-400 text-xs mt-1">{new Date(log.createdAt || log.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/88 dark:bg-slate-800/85 p-4 sm:p-6 shadow-lg">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Administrative Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SECTION_DEFINITIONS.map((sectionDef) => (
            <button
              key={sectionDef.id}
              type="button"
              onClick={() => navigateToSection(sectionDef.id)}
              className="text-left rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-blue-600/10 dark:bg-blue-900/30">
                  <Icon name={sectionDef.icon} className="w-4 h-4 text-blue-700 dark:text-blue-300" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{sectionDef.title}</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">{sectionDef.description}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );

  const renderActiveSection = () => {
    if (activeSection === 'overview') return renderOverview();

    switch (activeSection) {
      case 'approvals':
        return (
          <SectionContainer title={SECTION_MAP.approvals.title} description={SECTION_MAP.approvals.description} icon={SECTION_MAP.approvals.icon}>
            <OrganizationApprovalQueue onApprovalChange={loadStats} />
          </SectionContainer>
        );
      case 'organizations':
        return (
          <SectionContainer title={SECTION_MAP.organizations.title} description={SECTION_MAP.organizations.description} icon={SECTION_MAP.organizations.icon}>
            <AllOrganizationsList />
          </SectionContainer>
        );
      case 'users':
        return (
          <SectionContainer title={SECTION_MAP.users.title} description={SECTION_MAP.users.description} icon={SECTION_MAP.users.icon}>
            <UserManagementPanel />
          </SectionContainer>
        );
      case 'operations':
        return (
          <SectionContainer title={SECTION_MAP.operations.title} description={SECTION_MAP.operations.description} icon={SECTION_MAP.operations.icon}>
            <PlatformOperationsPanel />
          </SectionContainer>
        );
      case 'fairness':
        return (
          <SectionContainer title={SECTION_MAP.fairness.title} description={SECTION_MAP.fairness.description} icon={SECTION_MAP.fairness.icon}>
            <FairnessCalibrationPanel />
          </SectionContainer>
        );
      case 'classification':
        return (
          <SectionContainer title={SECTION_MAP.classification.title} description={SECTION_MAP.classification.description} icon={SECTION_MAP.classification.icon}>
            <ClassificationMetricsPanel />
          </SectionContainer>
        );
      case 'fine-tuning':
        return (
          <SectionContainer title={SECTION_MAP['fine-tuning'].title} description={SECTION_MAP['fine-tuning'].description} icon={SECTION_MAP['fine-tuning'].icon}>
            <ModelFineTuningPanel />
          </SectionContainer>
        );
      case 'mediapipe-calibration':
        return (
          <SectionContainer title={SECTION_MAP['mediapipe-calibration'].title} description={SECTION_MAP['mediapipe-calibration'].description} icon={SECTION_MAP['mediapipe-calibration'].icon}>
            <MediaPipeCalibrationPanel />
          </SectionContainer>
        );
      case 'training-data':
        return (
          <SectionContainer title={SECTION_MAP['training-data'].title} description={SECTION_MAP['training-data'].description} icon={SECTION_MAP['training-data'].icon}>
            <TrainingDataManager />
          </SectionContainer>
        );
      case 'research-tools':
        return (
          <SectionContainer title={SECTION_MAP['research-tools'].title} description={SECTION_MAP['research-tools'].description} icon={SECTION_MAP['research-tools'].icon}>
            <ResearchToolsPanel />
          </SectionContainer>
        );
      case 'live-chat':
        return (
          <SectionContainer title={SECTION_MAP['live-chat'].title} description={SECTION_MAP['live-chat'].description} icon={SECTION_MAP['live-chat'].icon}>
            <LiveChatManager />
          </SectionContainer>
        );
      case 'settings':
        return (
          <SectionContainer title={SECTION_MAP.settings.title} description={SECTION_MAP.settings.description} icon={SECTION_MAP.settings.icon}>
            <SystemSettings />
          </SectionContainer>
        );
      case 'audit':
        return (
          <SectionContainer title={SECTION_MAP.audit.title} description={SECTION_MAP.audit.description} icon={SECTION_MAP.audit.icon}>
            <PlatformAuditLogs />
          </SectionContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div className="dashboard-shell">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header userType="admin" isAuthenticated onLogout={handleLogout} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="admin"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              animate="visible"
              className="dashboard-layout"
            >
              <motion.section variants={fadeUpChild} className="relative overflow-hidden card-base p-2.5 xs:p-3 sm:p-4 shadow-glass dark:shadow-glass-dark">
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-3 py-1 xs:px-4 xs:py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      <span className="h-1.5 w-1.5 xs:h-2 xs:w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                      <span>{isOverview ? 'Platform governance center' : 'System admin section'}</span>
                    </div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      {sectionMeta.title}
                    </h1>
                    <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      {sectionMeta.description}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white p-2.5 sm:p-3 shadow-xl shadow-blue-500/40 w-full lg:w-auto lg:min-w-[160px] xl:min-w-[180px]">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70">System role</p>
                    <div className="mt-0.5 sm:mt-1 text-base xs:text-lg sm:text-xl font-semibold truncate">System Admin</div>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                      {isOverview ? 'Full platform oversight' : `Focused view: ${sectionMeta.title}`}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-2 sm:mt-3 grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-1.5 xs:gap-2 sm:gap-2.5">
                  {[
                    { label: 'Pending approvals', value: pendingApprovals },
                    { label: 'Organizations', value: totalOrganizations },
                    { label: 'Users', value: totalUsers },
                    { label: 'Interviews', value: totalInterviews },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-2 py-1.5 xs:px-2.5 xs:py-2 shadow-sm">
                      <p className="text-xs uppercase tracking-wider sm:tracking-[0.2em] text-gray-500 dark:text-slate-400 truncate">{item.label}</p>
                      <p className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">{item.value}</p>
                    </div>
                  ))}
                </div>
              </motion.section>

              {!isOverview && (
                <motion.div variants={fadeUpChild} className="flex flex-wrap gap-2">
                  <Button variant="outline" iconName="ArrowLeft" iconPosition="left" onClick={() => navigateToSection('overview')}>
                    Back to Overview
                  </Button>
                  <Button variant="outline" onClick={loadStats}>
                    Refresh Stats
                  </Button>
                </motion.div>
              )}

              <motion.div variants={staggeredChildren} className="space-y-2 sm:space-y-3">
                <motion.div variants={fadeUpChild}>
                  {renderActiveSection()}
                </motion.div>
              </motion.div>
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SystemAdminDashboard;
