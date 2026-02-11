/**
 * Training Data Manager
 * 
 * Admin interface for managing training datasets:
 * - View statistics for collected data
 * - Browse interview conversation datasets
 * - Browse posture/face-mesh analytics datasets
 * - Export data in JSONL format for LLM fine-tuning
 * - Delete datasets
 * 
 * For system administrators only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';
import { useToast } from '../../../components/ui/Toast';
import apiClient from '../../../services/apiClient';
import { downloadJSONL, downloadJSON } from '../../../services/interviewDatasetService';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';

/**
 * Statistics Card Component
 */
const StatCard = ({ icon, title, value, subtitle, color = 'blue' }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 shadow-lg backdrop-blur">
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_10%_10%,rgba(59,130,246,0.1),transparent_40%)]" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-lg`}>
            <Icon name={icon} size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
          </div>
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Dataset Card Component
 */
const DatasetCard = ({ dataset, type, onDelete, onExport }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
      return;
    }
    setIsDeleting(true);
    await onDelete(dataset.id, type);
    setIsDeleting(false);
  };

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800/50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {dataset.sessionId || dataset.id}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {new Date(dataset.metadata?.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          type === 'interview' 
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
            : 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300'
        }`}>
          {type}
        </span>
      </div>

      {/* Dataset Info */}
      <div className="space-y-2 mb-3">
        {type === 'interview' && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-slate-400">Job Role</span>
              <span className="text-gray-700 dark:text-slate-300">{dataset.config?.jobRole || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-slate-400">Q&A Pairs</span>
              <span className="text-gray-700 dark:text-slate-300">{dataset.totalQAPairs || 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-slate-400">Conversation Turns</span>
              <span className="text-gray-700 dark:text-slate-300">{dataset.totalTurns || 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-slate-400">Quality Score</span>
              <span className={`font-medium ${
                (dataset.metadata?.qualityScore || 0) >= 70 ? 'text-green-600' :
                (dataset.metadata?.qualityScore || 0) >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {dataset.metadata?.qualityScore || 0}%
              </span>
            </div>
          </>
        )}
        {type === 'analytics' && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-slate-400">Total Frames</span>
              <span className="text-gray-700 dark:text-slate-300">{dataset.totalFrames || 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-slate-400">Duration</span>
              <span className="text-gray-700 dark:text-slate-300">
                {Math.round((dataset.duration || 0) / 1000)}s
              </span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          iconName="Download"
          iconPosition="left"
          onClick={() => onExport(dataset, type)}
          className="flex-1 text-xs"
        >
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconName="Trash2"
          onClick={handleDelete}
          loading={isDeleting}
          className="text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

/**
 * Main Training Data Manager Component
 */
const TrainingDataManager = () => {
  const { success: showSuccess, error: showError } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [datasets, setDatasets] = useState({ interview: [], analytics: [] });
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadDataRef = useRef(null);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsResult, datasetsResult] = await Promise.all([
        apiClient.datasets.getStatistics(),
        apiClient.datasets.list('all', 100, 0),
      ]);

      if (statsResult.success) {
        setStatistics(statsResult.statistics);
      }

      if (datasetsResult.success) {
        setDatasets(datasetsResult.datasets);
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
      showError('Failed to load training data');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadDataRef.current?.();
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle delete
  const handleDelete = async (id, type) => {
    try {
      const result = await apiClient.datasets.delete(id, type);
      if (result.success) {
        showSuccess('Dataset deleted successfully');
        await loadData();
      }
    } catch (error) {
      console.error('Failed to delete dataset:', error);
      showError('Failed to delete dataset');
    }
  };

  // Handle export single dataset
  const handleExportSingle = (dataset, type) => {
    const filename = `${type}_dataset_${dataset.sessionId || dataset.id}.json`;
    downloadJSON(dataset, filename);
    showSuccess('Dataset exported successfully');
  };

  // Handle bulk export
  const handleBulkExport = async (type) => {
    setIsExporting(true);
    try {
      const result = await apiClient.datasets.export(type, 'jsonl', 0);
      if (result.success && result.content) {
        const filename = `${type}_training_data_${new Date().toISOString().split('T')[0]}.jsonl`;
        downloadJSONL(result.content, filename);
        showSuccess(`Exported ${type} data successfully`);
      }
    } catch (error) {
      console.error('Failed to export datasets:', error);
      showError('Failed to export datasets');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingIndicator size={32} tone="primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Icon name="Database" size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              Training Data Manager
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Manage and export LLM and analytics training datasets
            </p>
          </div>
        </div>
        <Button
          iconName="RefreshCw"
          iconPosition="left"
          onClick={loadData}
          variant="outline"
          className="rounded-full"
        >
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-700">
        {['overview', 'interview', 'analytics'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && statistics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Interview Statistics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Interview Data Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon="MessageSquare"
                title="Total Sessions"
                value={statistics.interview?.totalSessions || 0}
                color="blue"
              />
              <StatCard
                icon="HelpCircle"
                title="Q&A Pairs"
                value={statistics.interview?.totalQAPairs || 0}
                color="green"
              />
              <StatCard
                icon="Star"
                title="High Quality"
                value={statistics.interview?.highQualityPairs || 0}
                subtitle="Score >= 7"
                color="amber"
              />
              <StatCard
                icon="MessageCircle"
                title="Conv. Turns"
                value={statistics.interview?.totalConversationTurns || 0}
                color="purple"
              />
            </div>
          </div>

          {/* Analytics Statistics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Analytics Data Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon="Video"
                title="Sessions"
                value={statistics.analytics?.totalSessions || 0}
                color="purple"
              />
              <StatCard
                icon="Camera"
                title="Total Frames"
                value={statistics.analytics?.totalFrames || 0}
                color="blue"
              />
              <StatCard
                icon="User"
                title="Avg Posture"
                value={`${statistics.analytics?.averagePostureScore || 0}%`}
                color="green"
              />
              <StatCard
                icon="Eye"
                title="Avg Attention"
                value={`${statistics.analytics?.averageAttentionScore || 0}%`}
                color="amber"
              />
            </div>
          </div>

          {/* Distribution Charts */}
          {statistics.interview?.byRole && Object.keys(statistics.interview.byRole).length > 0 && (
            <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800/50">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
                Distribution by Job Role
              </h4>
              <div className="space-y-2">
                {Object.entries(statistics.interview.byRole).map(([role, count]) => (
                  <div key={role} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 dark:text-slate-400 w-32 truncate">
                      {role}
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{
                          width: `${(count / statistics.interview.totalSessions) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-8 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Actions */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10 rounded-xl border border-purple-200 dark:border-purple-500/30">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                Export Training Data
              </h4>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Download datasets in JSONL format for LLM fine-tuning
              </p>
            </div>
            <Button
              iconName="Download"
              iconPosition="left"
              onClick={() => handleBulkExport('interview')}
              loading={isExporting}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Export Interview Data
            </Button>
            <Button
              iconName="Download"
              iconPosition="left"
              onClick={() => handleBulkExport('analytics')}
              loading={isExporting}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-500/30 dark:text-purple-300"
            >
              Export Analytics Data
            </Button>
          </div>
        </motion.div>
      )}

      {/* Interview Tab */}
      {activeTab === 'interview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {datasets.interview.length} interview dataset(s)
            </p>
            <Button
              iconName="Download"
              iconPosition="left"
              onClick={() => handleBulkExport('interview')}
              loading={isExporting}
              size="sm"
            >
              Export All JSONL
            </Button>
          </div>
          
          {datasets.interview.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Icon name="MessageSquare" size={48} className="mx-auto mb-4 opacity-30" />
              <p>No interview datasets collected yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {datasets.interview.map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  type="interview"
                  onDelete={handleDelete}
                  onExport={handleExportSingle}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {datasets.analytics.length} analytics dataset(s)
            </p>
            <Button
              iconName="Download"
              iconPosition="left"
              onClick={() => handleBulkExport('analytics')}
              loading={isExporting}
              size="sm"
            >
              Export All JSONL
            </Button>
          </div>
          
          {datasets.analytics.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Icon name="Camera" size={48} className="mx-auto mb-4 opacity-30" />
              <p>No analytics datasets collected yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {datasets.analytics.map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  type="analytics"
                  onDelete={handleDelete}
                  onExport={handleExportSingle}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default TrainingDataManager;
