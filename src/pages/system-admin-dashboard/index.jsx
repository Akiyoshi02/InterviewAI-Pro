import React, { useEffect, lazy, Suspense, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import OrganizationApprovalQueue from './components/OrganizationApprovalQueue.jsx';
import SystemStats from './components/SystemStats.jsx';
import PlatformAuditLogs from './components/PlatformAuditLogs.jsx';
import SystemSettings from './components/SystemSettings.jsx';
import AllOrganizationsList from './components/AllOrganizationsList.jsx';
import LiveChatManager from './components/LiveChatManager.jsx';
import TrainingDataManager from './components/TrainingDataManager.jsx';
import FairnessCalibrationPanel from './components/FairnessCalibrationPanel.jsx';
import apiClient from '../../services/apiClient.js';
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';

// Research Tools Components (lazy loaded for performance)
const VideoRecorder = lazy(() => import('../../pages/research-tools/components/VideoRecorder.jsx'));
const VideoAnalyzer = lazy(() => import('../../pages/research-tools/components/VideoAnalyzer.jsx'));
const LLMDataAggregator = lazy(() => import('../../pages/research-tools/components/LLMDataAggregator.jsx'));
const DatasetDownloader = lazy(() => import('../../pages/research-tools/components/DatasetDownloader.jsx'));

const SystemAdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [researchSubTab, setResearchSubTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadStatsRef = useRef(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.getStats();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatsRef.current = loadStats;
  }, [loadStats]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
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

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    },
    [],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
    { id: 'approvals', label: 'Pending Approvals', icon: 'CheckCircle' },
    { id: 'organizations', label: 'All Organizations', icon: 'Building' },
    { id: 'fairness', label: 'Fairness & Calibration', icon: 'Scale' },
    { id: 'training-data', label: 'Training Data', icon: 'Database' },
    { id: 'research-tools', label: 'Research Tools', icon: 'FlaskConical' },
    { id: 'live-chat', label: 'Live Chat', icon: 'MessageSquare' },
    { id: 'settings', label: 'System Settings', icon: 'Settings' },
    { id: 'audit', label: 'Audit Logs', icon: 'FileText' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <Header userType="admin" isAuthenticated onLogout={handleLogout} />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex-1 min-w-0 flex flex-col items-center sm:items-start">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-600 flex-shrink-0">
                  <Icon name="Shield" className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100 break-words">
                    System Administration
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mt-0.5">
                    Platform-wide management and oversight
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 flex-shrink-0">
              <div className="px-2.5 sm:px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium whitespace-nowrap">
                System Admin
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Overview */}
        {loading ? (
          <LoadingState
            title="Loading platform stats"
            message="Aggregating system-wide metrics."
            variant="card"
            tone="secondary"
            className="mb-8"
          />
        ) : stats ? (
          <SystemStats stats={stats} onRefresh={loadStats} />
        ) : null}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-slate-700">
            <nav className="-mb-px flex space-x-4 sm:space-x-6 lg:space-x-8 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 flex-shrink-0
                    ${
                      activeTab === tab.id
                        ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                    }
                  `}
                >
                  <Icon name={tab.icon} className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="hidden xs:inline">{tab.label}</span>
                  <span className="xs:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {loading ? (
                <LoadingState
                  title="Refreshing overview"
                  message="Syncing administrative dashboards."
                  variant="card"
                  tone="secondary"
                />
              ) : stats ? (
                <>
                  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-6 shadow-lg">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">
                      Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('approvals')}
                        className="flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <Icon name="CheckCircle" className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">Review Pending ({stats.organizations?.pending || 0})</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('organizations')}
                        className="flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <Icon name="Building" className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">All Organizations ({stats.organizations?.total || 0})</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('settings')}
                        className="flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <Icon name="Settings" className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">System Settings</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('training-data')}
                        className="flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <Icon name="Database" className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">Training Data</span>
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => setActiveTab('research-tools')}
                        className="flex items-center justify-center gap-2 text-sm sm:text-base bg-blue-600 hover:bg-blue-700"
                      >
                        <Icon name="FlaskConical" className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">Research Tools</span>
                      </Button>
                    </div>
                  </div>

                  {stats.recentActivity && stats.recentActivity.length > 0 && (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                    Recent Activity
                  </h2>
                  <div className="space-y-3">
                    {stats.recentActivity.slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                      >
                        <Icon name="Activity" className="w-4 h-4 text-purple-600 mt-0.5" />
                        <div className="flex-1 text-sm">
                          <div className="text-gray-900 dark:text-slate-100 font-medium">
                            {log.action}
                          </div>
                          <div className="text-gray-600 dark:text-slate-400 text-xs mt-1">
                            {new Date(log.createdAt || log.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('audit')}
                      className="w-full"
                    >
                      View All Logs
                    </Button>
                  </div>
                </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                  <div className="text-center py-12">
                    <Icon name="AlertTriangle" className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                      Failed to Load Statistics
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-4">
                      Unable to load platform statistics. Please try again.
                    </p>
                    <Button onClick={loadStats}>
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'approvals' && (
            <OrganizationApprovalQueue onApprovalChange={loadStats} />
          )}

          {activeTab === 'organizations' && (
            <AllOrganizationsList />
          )}

          {activeTab === 'fairness' && (
            <FairnessCalibrationPanel />
          )}

          {activeTab === 'settings' && (
            <SystemSettings />
          )}

          {activeTab === 'live-chat' && (
            <LiveChatManager />
          )}

          {activeTab === 'audit' && (
            <PlatformAuditLogs />
          )}

          {activeTab === 'training-data' && (
            <TrainingDataManager />
          )}

          {activeTab === 'research-tools' && (
            <div className="space-y-6">
              {/* Research Tools Sub-Navigation */}
              <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 shadow-lg overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-600">
                      <Icon name="FlaskConical" className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                        Research Data Collection
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        Tools for LLM training data and MediaPipe reference videos
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-Tab Navigation */}
                <div className="px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/50">
                  <nav className="flex space-x-1 overflow-x-auto scrollbar-hide py-2">
                    {[
                      { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
                      { id: 'video-recorder', label: 'Video Recorder', icon: 'Video' },
                      { id: 'video-analyzer', label: 'Video Analyzer', icon: 'BarChart2' },
                      { id: 'llm-aggregator', label: 'LLM Data', icon: 'Database' },
                      { id: 'datasets', label: 'External Datasets', icon: 'Download' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setResearchSubTab(tab.id)}
                        className={`
                          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                          ${researchSubTab === tab.id
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        <Icon name={tab.icon} className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* Sub-Tab Content */}
              <motion.div
                key={researchSubTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Overview */}
                {researchSubTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="Video" className="w-4 h-4 text-purple-600" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">Videos Recorded</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                          {typeof window !== 'undefined' ? (localStorage.getItem('research_video_count') || 0) : 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="BarChart2" className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">Videos Analyzed</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                          {typeof window !== 'undefined' ? (localStorage.getItem('research_analysis_count') || 0) : 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="MessageSquare" className="w-4 h-4 text-blue-600" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">Q&A Pairs</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                          {typeof window !== 'undefined' ? (localStorage.getItem('research_qa_count') || 0) : 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="Database" className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">Data Sources</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                          {typeof window !== 'undefined' ? (localStorage.getItem('research_sources_count') || 0) : 0}
                        </p>
                      </div>
                    </div>

                    {/* Tool Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* MediaPipe Tools */}
                      <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-purple-600">
                            <Icon name="Scan" className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                            MediaPipe Video Tools
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                          Record reference videos showing correct and incorrect posture, then analyze them to extract MediaPipe metrics.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setResearchSubTab('video-recorder')}
                            size="sm"
                            className="flex-1 bg-purple-600 hover:bg-purple-700"
                          >
                            <Icon name="Video" className="w-4 h-4 mr-1" />
                            Record
                          </Button>
                          <Button
                            onClick={() => setResearchSubTab('video-analyzer')}
                            size="sm"
                            variant="outline"
                            className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300"
                          >
                            <Icon name="BarChart2" className="w-4 h-4 mr-1" />
                            Analyze
                          </Button>
                        </div>
                      </div>

                      {/* LLM Tools */}
                      <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-blue-600">
                            <Icon name="Brain" className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                            LLM Training Data Tools
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                          Import interview data from multiple sources, combine them, and export in JSONL format for LLM fine-tuning.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setResearchSubTab('llm-aggregator')}
                            size="sm"
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            <Icon name="FileUp" className="w-4 h-4 mr-1" />
                            Import Data
                          </Button>
                          <Button
                            onClick={() => setResearchSubTab('datasets')}
                            size="sm"
                            variant="outline"
                            className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
                          >
                            <Icon name="Download" className="w-4 h-4 mr-1" />
                            Datasets
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Documentation */}
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-3">
                        <Icon name="BookOpen" className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800 dark:text-amber-200">
                            Research Guide
                          </h4>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            See <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-800 rounded text-xs">docs/RESEARCH_DATA_COLLECTION_GUIDE.md</code> for 
                            complete instructions on collecting data from external sources and recording reference videos.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Video Recorder */}
                {researchSubTab === 'video-recorder' && (
                  <Suspense fallback={
                    <LoadingState
                      title="Loading Video Recorder"
                      message="Preparing recording tools..."
                      variant="card"
                      tone="secondary"
                    />
                  }>
                    <VideoRecorder />
                  </Suspense>
                )}

                {/* Video Analyzer */}
                {researchSubTab === 'video-analyzer' && (
                  <Suspense fallback={
                    <LoadingState
                      title="Loading Video Analyzer"
                      message="Preparing analysis tools..."
                      variant="card"
                      tone="secondary"
                    />
                  }>
                    <VideoAnalyzer />
                  </Suspense>
                )}

                {/* LLM Data Aggregator */}
                {researchSubTab === 'llm-aggregator' && (
                  <Suspense fallback={
                    <LoadingState
                      title="Loading Data Aggregator"
                      message="Preparing import tools..."
                      variant="card"
                      tone="secondary"
                    />
                  }>
                    <LLMDataAggregator />
                  </Suspense>
                )}

                {/* Dataset Downloader */}
                {researchSubTab === 'datasets' && (
                  <Suspense fallback={
                    <LoadingState
                      title="Loading Datasets"
                      message="Fetching available datasets..."
                      variant="card"
                      tone="secondary"
                    />
                  }>
                    <DatasetDownloader />
                  </Suspense>
                )}
              </motion.div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default SystemAdminDashboard;
