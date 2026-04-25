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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';
import UnifiedFilterPanel, {
  FILTER_DATE_GRID_CLASS,
  FILTER_GRID_CLASS,
  UnifiedFilterField,
  UnifiedFilterSelect,
  UnifiedSearchField,
  UnifiedTextInput,
} from '../../../components/ui/UnifiedFilterPanel';
import { useToast } from '../../../components/ui/Toast';
import apiClient from '../../../services/apiClient';
import { downloadJSONL, downloadJSON } from '../../../services/interviewDatasetService';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import { ADMIN_FEED_EVENTS } from '../../../constants/realtimeFeedEvents.js';
import {
  ADMIN_ANALYTICS_DATASET_BOOLEAN_FILTER_OPTIONS,
  ADMIN_ANALYTICS_DATASET_SORT_OPTIONS,
  ADMIN_ANALYTICS_FRAME_BAND_OPTIONS,
  ADMIN_DATE_PRESET_FILTER_OPTIONS,
  ADMIN_INTERVIEW_DATASET_QUALITY_BAND_OPTIONS,
  ADMIN_INTERVIEW_DATASET_SORT_OPTIONS,
  DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS,
  DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS,
  buildInterviewDatasetFilterOptions,
  countActiveAnalyticsDatasetFilters,
  countActiveInterviewDatasetFilters,
  filterAnalyticsDatasets,
  filterInterviewDatasets,
} from '../utils/adminDashboardFilters.js';

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
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
      {confirmDelete ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-2">Delete this dataset? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              loading={isDeleting}
              className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      ) : (
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
      )}
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
  const [interviewFilters, setInterviewFilters] = useState(DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS);
  const [analyticsFilters, setAnalyticsFilters] = useState(DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS);
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
    eventTypes: ADMIN_FEED_EVENTS.datasets,
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

  const interviewFilterOptions = useMemo(
    () => buildInterviewDatasetFilterOptions(datasets.interview || []),
    [datasets.interview],
  );

  const filteredInterviewDatasets = useMemo(
    () => filterInterviewDatasets(datasets.interview || [], interviewFilters),
    [datasets.interview, interviewFilters],
  );

  const filteredAnalyticsDatasets = useMemo(
    () => filterAnalyticsDatasets(datasets.analytics || [], analyticsFilters),
    [datasets.analytics, analyticsFilters],
  );

  const interviewActiveFilterCount = useMemo(
    () => countActiveInterviewDatasetFilters(interviewFilters),
    [interviewFilters],
  );

  const analyticsActiveFilterCount = useMemo(
    () => countActiveAnalyticsDatasetFilters(analyticsFilters),
    [analyticsFilters],
  );

  // Handle delete
  const handleDelete = async (id, type) => {
    try {
      const result = await apiClient.datasets.delete(id, type);
      if (result.success) {
        showSuccess('Dataset deleted successfully');
        await loadData();
      }
    } catch (error) {
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
      const minQuality = type === 'interview'
        ? Math.max(0, Number(interviewFilters.minQuality) || 0)
        : 0;
      const result = await apiClient.datasets.export(type, 'jsonl', minQuality);
      if (result.success && result.content) {
        const filename = `${type}_training_data_${new Date().toISOString().split('T')[0]}.jsonl`;
        downloadJSONL(result.content, filename);
        showSuccess(`Exported ${type} data successfully`);
      }
    } catch (error) {
      showError('Failed to export datasets');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFiltered = (type) => {
    const filtered = type === 'interview' ? filteredInterviewDatasets : filteredAnalyticsDatasets;
    const filename = `${type}_filtered_data_${new Date().toISOString().split('T')[0]}.json`;
    downloadJSON(filtered, filename);
    showSuccess(`Exported ${filtered.length} filtered ${type} datasets`);
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
                icon="BrandBrain"
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
          <UnifiedFilterPanel
            title="Interview Dataset Filters"
            description="Search interview sessions and refine by role, experience, industry, quality, and date range."
            activeCount={interviewActiveFilterCount}
            onClear={() => setInterviewFilters(DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS)}
          >
            <div className={FILTER_GRID_CLASS}>
              <UnifiedSearchField
                label="Search"
                className="sm:col-span-2 xl:col-span-2"
                type="text"
                value={interviewFilters.searchQuery}
                onChange={(event) => setInterviewFilters((prev) => ({ ...prev, searchQuery: event.target.value }))}
                placeholder="Session id, role, summary, or company"
              />
              <UnifiedFilterSelect
                label="Job Role"
                value={interviewFilters.jobRoleFilter}
                onChange={(value) => setInterviewFilters((prev) => ({ ...prev, jobRoleFilter: value }))}
                options={interviewFilterOptions.roleOptions}
                placeholder="All job roles"
              />
              <UnifiedFilterSelect
                label="Experience Level"
                value={interviewFilters.experienceFilter}
                onChange={(value) => setInterviewFilters((prev) => ({ ...prev, experienceFilter: value }))}
                options={interviewFilterOptions.experienceOptions}
                placeholder="All experience levels"
              />
              <UnifiedFilterSelect
                label="Industry"
                value={interviewFilters.industryFilter}
                onChange={(value) => setInterviewFilters((prev) => ({ ...prev, industryFilter: value }))}
                options={interviewFilterOptions.industryOptions}
                placeholder="All industries"
              />
              <UnifiedFilterSelect
                label="Quality Band"
                value={interviewFilters.qualityBandFilter}
                onChange={(value) => setInterviewFilters((prev) => ({ ...prev, qualityBandFilter: value }))}
                options={ADMIN_INTERVIEW_DATASET_QUALITY_BAND_OPTIONS}
                placeholder="All quality bands"
              />
              <UnifiedFilterSelect
                label="Created Date"
                value={interviewFilters.datePreset}
                onChange={(value) => setInterviewFilters((prev) => ({ ...prev, datePreset: value }))}
                options={ADMIN_DATE_PRESET_FILTER_OPTIONS}
                placeholder="All dates"
              />
              <UnifiedFilterSelect
                label="Sort By"
                value={interviewFilters.sortBy}
                onChange={(value) => setInterviewFilters((prev) => ({ ...prev, sortBy: value }))}
                options={ADMIN_INTERVIEW_DATASET_SORT_OPTIONS}
                placeholder="Sort sessions"
              />
              <UnifiedFilterField label="Minimum Quality">
                <UnifiedTextInput
                  type="number"
                  min="0"
                  max="100"
                  value={interviewFilters.minQuality}
                  onChange={(event) => setInterviewFilters((prev) => ({ ...prev, minQuality: event.target.value }))}
                  placeholder="0"
                />
              </UnifiedFilterField>
              <UnifiedFilterField label="Maximum Quality">
                <UnifiedTextInput
                  type="number"
                  min="0"
                  max="100"
                  value={interviewFilters.maxQuality}
                  onChange={(event) => setInterviewFilters((prev) => ({ ...prev, maxQuality: event.target.value }))}
                  placeholder="100"
                />
              </UnifiedFilterField>
            </div>
            {interviewFilters.datePreset === 'custom' && (
              <div className={FILTER_DATE_GRID_CLASS}>
                <UnifiedFilterField label="Created From">
                  <UnifiedTextInput
                    type="date"
                    value={interviewFilters.createdFrom}
                    onChange={(event) => setInterviewFilters((prev) => ({ ...prev, createdFrom: event.target.value }))}
                  />
                </UnifiedFilterField>
                <UnifiedFilterField label="Created To">
                  <UnifiedTextInput
                    type="date"
                    value={interviewFilters.createdTo}
                    onChange={(event) => setInterviewFilters((prev) => ({ ...prev, createdTo: event.target.value }))}
                  />
                </UnifiedFilterField>
              </div>
            )}
          </UnifiedFilterPanel>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Showing {filteredInterviewDatasets.length} of {datasets.interview.length} interview dataset(s)
            </p>
            <div className="flex items-center gap-2">
              <Button
                iconName="Download"
                iconPosition="left"
                onClick={() => handleExportFiltered('interview')}
                size="sm"
                variant="outline"
              >
                Export Filtered JSON
              </Button>
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
          </div>

          {filteredInterviewDatasets.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Icon name="MessageSquare" size={48} className="mx-auto mb-4 opacity-30" />
              <p>No interview datasets match the selected filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInterviewDatasets.map((dataset) => (
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
          <UnifiedFilterPanel
            title="Analytics Dataset Filters"
            description="Filter analytics sessions by capture flags, frame ranges, duration windows, and creation date."
            activeCount={analyticsActiveFilterCount}
            onClear={() => setAnalyticsFilters(DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS)}
          >
            <div className={FILTER_GRID_CLASS}>
              <UnifiedSearchField
                label="Search"
                className="sm:col-span-2 xl:col-span-2"
                type="text"
                value={analyticsFilters.searchQuery}
                onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, searchQuery: event.target.value }))}
                placeholder="Session id, config, model, or source"
              />
              <UnifiedFilterSelect
                label="Pose Detection"
                value={analyticsFilters.poseFilter}
                onChange={(value) => setAnalyticsFilters((prev) => ({ ...prev, poseFilter: value }))}
                options={ADMIN_ANALYTICS_DATASET_BOOLEAN_FILTER_OPTIONS.map((option) => ({
                  value: option.value,
                  label: `Pose: ${option.label}`,
                }))}
                placeholder="Any pose state"
              />
              <UnifiedFilterSelect
                label="Face Detection"
                value={analyticsFilters.faceFilter}
                onChange={(value) => setAnalyticsFilters((prev) => ({ ...prev, faceFilter: value }))}
                options={ADMIN_ANALYTICS_DATASET_BOOLEAN_FILTER_OPTIONS.map((option) => ({
                  value: option.value,
                  label: `Face: ${option.label}`,
                }))}
                placeholder="Any face state"
              />
              <UnifiedFilterSelect
                label="Frame Band"
                value={analyticsFilters.frameBandFilter}
                onChange={(value) => setAnalyticsFilters((prev) => ({ ...prev, frameBandFilter: value }))}
                options={ADMIN_ANALYTICS_FRAME_BAND_OPTIONS}
                placeholder="All frame bands"
              />
              <UnifiedFilterSelect
                label="Created Date"
                value={analyticsFilters.datePreset}
                onChange={(value) => setAnalyticsFilters((prev) => ({ ...prev, datePreset: value }))}
                options={ADMIN_DATE_PRESET_FILTER_OPTIONS}
                placeholder="All dates"
              />
              <UnifiedFilterSelect
                label="Sort By"
                value={analyticsFilters.sortBy}
                onChange={(value) => setAnalyticsFilters((prev) => ({ ...prev, sortBy: value }))}
                options={ADMIN_ANALYTICS_DATASET_SORT_OPTIONS}
                placeholder="Sort analytics"
              />
              <UnifiedFilterField label="Minimum Frames">
                <UnifiedTextInput
                  type="number"
                  min="0"
                  value={analyticsFilters.minFrames}
                  onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, minFrames: event.target.value }))}
                  placeholder="0"
                />
              </UnifiedFilterField>
              <UnifiedFilterField label="Maximum Frames">
                <UnifiedTextInput
                  type="number"
                  min="0"
                  value={analyticsFilters.maxFrames}
                  onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, maxFrames: event.target.value }))}
                  placeholder="Any"
                />
              </UnifiedFilterField>
              <UnifiedFilterField label="Min Duration (seconds)">
                <UnifiedTextInput
                  type="number"
                  min="0"
                  value={analyticsFilters.minDurationSeconds}
                  onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, minDurationSeconds: event.target.value }))}
                  placeholder="0"
                />
              </UnifiedFilterField>
              <UnifiedFilterField label="Max Duration (seconds)">
                <UnifiedTextInput
                  type="number"
                  min="0"
                  value={analyticsFilters.maxDurationSeconds}
                  onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, maxDurationSeconds: event.target.value }))}
                  placeholder="Any"
                />
              </UnifiedFilterField>
            </div>
            {analyticsFilters.datePreset === 'custom' && (
              <div className={FILTER_DATE_GRID_CLASS}>
                <UnifiedFilterField label="Created From">
                  <UnifiedTextInput
                    type="date"
                    value={analyticsFilters.createdFrom}
                    onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, createdFrom: event.target.value }))}
                  />
                </UnifiedFilterField>
                <UnifiedFilterField label="Created To">
                  <UnifiedTextInput
                    type="date"
                    value={analyticsFilters.createdTo}
                    onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, createdTo: event.target.value }))}
                  />
                </UnifiedFilterField>
              </div>
            )}
          </UnifiedFilterPanel>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Showing {filteredAnalyticsDatasets.length} of {datasets.analytics.length} analytics dataset(s)
            </p>
            <div className="flex items-center gap-2">
              <Button
                iconName="Download"
                iconPosition="left"
                onClick={() => handleExportFiltered('analytics')}
                size="sm"
                variant="outline"
              >
                Export Filtered JSON
              </Button>
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
          </div>

          {filteredAnalyticsDatasets.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Icon name="Camera" size={48} className="mx-auto mb-4 opacity-30" />
              <p>No analytics datasets match the selected filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAnalyticsDatasets.map((dataset) => (
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
