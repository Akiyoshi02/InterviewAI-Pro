/**
 * Research Tools Panel
 *
 * Focused MediaPipe tooling for:
 * - Recording reference posture/gesture videos
 * - Analyzing recorded videos into metrics
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import VideoRecorder from '../../research-tools/components/VideoRecorder.jsx';
import VideoAnalyzer from '../../research-tools/components/VideoAnalyzer.jsx';
import apiClient from '../../../services/apiClient.js';

const ResearchToolsPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [datasetStats, setDatasetStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await apiClient.datasets.getStatistics();
        if (result?.success) {
          setDatasetStats(result.statistics || result.stats || result);
        }
      } catch {
        // Silent fallback to "--"
      }
    };
    fetchStats();
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
    { id: 'video-recorder', label: 'Video Recorder', icon: 'Video' },
    { id: 'video-analyzer', label: 'Video Analyzer', icon: 'BarChart2' },
  ];

  return (
    <div className="space-y-6">
      <div>
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
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
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

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Research Data Collection Overview
              </h2>
              <p className="text-gray-600 dark:text-slate-400 mb-6">
                Use these tools for MediaPipe calibration workflows. For question datasets,
                use the Question Catalog workflow.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-purple-600">
                      <Icon name="Scan" className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100">MediaPipe Tools</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <Icon name="Video" className="w-4 h-4 text-purple-600" />
                      Record reference videos (good/bad posture)
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon name="BarChart2" className="w-4 h-4 text-purple-600" />
                      Analyze videos and compute metrics
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon name="FileJson" className="w-4 h-4 text-purple-600" />
                      Export calibration-oriented outputs
                    </li>
                  </ul>
                  <button
                    onClick={() => setActiveTab('video-recorder')}
                    className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Start Recording
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-blue-600">
                      <Icon name="BookOpenCheck" className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100">Question Dataset Governance</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <Icon name="BookOpenCheck" className="w-4 h-4 text-blue-600" />
                      Import and approve interview questions in Question Catalog
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon name="Database" className="w-4 h-4 text-blue-600" />
                      Use Training Data for export/lifecycle operations
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon name="ShieldCheck" className="w-4 h-4 text-blue-600" />
                      Keep runtime question curation separate from video calibration
                    </li>
                  </ul>
                  <button
                    onClick={() => navigate('/system-admin-dashboard/question-catalog')}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Open Question Catalog
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Video" className="w-4 h-4 text-purple-600" />
                  <span className="text-xs text-gray-500 dark:text-slate-400">Videos Recorded</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {datasetStats?.videoCount ?? datasetStats?.interviewDatasets ?? '--'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="BarChart2" className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs text-gray-500 dark:text-slate-400">Videos Analyzed</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {datasetStats?.analysisCount ?? datasetStats?.analyticsDatasets ?? '--'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Database" className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-gray-500 dark:text-slate-400">Total Datasets</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {datasetStats?.totalDatasets ?? datasetStats?.sourcesCount ?? '--'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Icon name="BookOpen" className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">Admin Workflow</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Use <strong>Question Catalog</strong> for question dataset imports and approvals.
                    Use this section for video recording and analysis calibration workflows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'video-recorder' && <VideoRecorder />}
        {activeTab === 'video-analyzer' && <VideoAnalyzer />}
      </motion.div>
    </div>
  );
};

export default ResearchToolsPanel;
