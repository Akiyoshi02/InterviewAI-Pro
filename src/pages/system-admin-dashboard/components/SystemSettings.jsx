import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import MessageDialog from '../../../components/ui/MessageDialog';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import { ADMIN_FEED_EVENTS } from '../../../constants/realtimeFeedEvents.js';
import { DEFAULT_MODEL } from '../../../services/llmClient.js';

const SUPPORTED_PRIMARY_MODELS = ['qwen3:8b', 'qwen2.5:7b-instruct'];
const FALLBACK_MODEL = 'qwen2.5:7b-instruct';

const SystemSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedSettings, setEditedSettings] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [messageDialog, setMessageDialog] = useState({ open: false, title: '', message: '', variant: 'success' });
  const [aiHealth, setAiHealth] = useState(null);
  const [aiHealthLoading, setAiHealthLoading] = useState(false);
  const [aiHealthError, setAiHealthError] = useState('');
  const realtimeRefreshTimeoutRef = useRef(null);
  const aiHealthIntervalRef = useRef(null);
  const loadSettingsRef = useRef(null);

  useEffect(() => {
    loadSettings();
    loadAIHealth();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.getSettings();
      if (result.success) {
        const s = result.settings || {};
        setSettings(s);
        setEditedSettings({
          ...JSON.parse(JSON.stringify(s)),
          nonverbalFeedbackEnabled: s.nonverbalFeedbackEnabled !== false,
        });
      }
    } catch {
      // Silent failure — settings form stays at defaults
    } finally {
      setLoading(false);
    }
  };

  const loadAIHealth = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setAiHealthLoading(true);
      }
      const result = await apiClient.admin.getAIHealth();
      setAiHealth(result || null);
      if (result?.success) {
        setAiHealthError('');
      } else {
        setAiHealthError(result?.error || 'Failed to load AI runtime status.');
      }
    } catch (error) {
      setAiHealthError(error?.message || 'Failed to load AI runtime status.');
    } finally {
      if (!silent) {
        setAiHealthLoading(false);
      }
    }
  };

  useEffect(() => {
    loadSettingsRef.current = loadSettings;
  }, [loadSettings]);

  useEffect(() => {
    aiHealthIntervalRef.current = setInterval(() => {
      loadAIHealth({ silent: true });
    }, 15000);
    return () => {
      if (aiHealthIntervalRef.current) {
        clearInterval(aiHealthIntervalRef.current);
      }
    };
  }, []);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    eventTypes: ADMIN_FEED_EVENTS.settings,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial || hasChanges) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadSettingsRef.current?.();
        loadAIHealth({ silent: true });
      }, 300);
    },
  });

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      if (aiHealthIntervalRef.current) {
        clearInterval(aiHealthIntervalRef.current);
      }
    },
    [],
  );

  const handleFeatureFlagChange = (flag, value) => {
    setEditedSettings(prev => ({
      ...prev,
      featureFlags: {
        ...prev.featureFlags,
        [flag]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleMaintenanceModeChange = (value) => {
    setEditedSettings(prev => ({
      ...prev,
      maintenanceMode: value,
    }));
    setHasChanges(true);
  };

  const handleNonverbalFeedbackChange = (value) => {
    setEditedSettings(prev => ({
      ...prev,
      nonverbalFeedbackEnabled: value,
    }));
    setHasChanges(true);
  };

  const handleAIConfigChange = (key, value) => {
    setEditedSettings(prev => ({
      ...prev,
      defaultAIConfig: {
        ...prev.defaultAIConfig,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleDataRetentionChange = (key, value) => {
    setEditedSettings(prev => ({
      ...prev,
      dataRetention: {
        ...(prev.dataRetention || {}),
        [key]: parseInt(value) || 0,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges || saving) return;

    try {
      setSaving(true);
      const result = await apiClient.admin.updateSettings(editedSettings);
      if (result.success) {
        setSettings(result.settings);
        setEditedSettings(JSON.parse(JSON.stringify(result.settings)));
        setHasChanges(false);
        setMessageDialog({
          open: true,
          title: 'Success',
          message: 'Settings saved successfully!',
          variant: 'success',
        });
      } else {
        setMessageDialog({
          open: true,
          title: 'Error',
          message: result.error || 'Failed to save settings. Please try again.',
          variant: 'error',
        });
      }
    } catch (err) {
      setMessageDialog({
        open: true,
        title: 'Error',
        message: 'Failed to save settings. Please try again.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setEditedSettings(JSON.parse(JSON.stringify(settings)));
    setHasChanges(false);
    setShowResetConfirm(false);
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading settings"
        message="Fetching current platform configuration."
        variant="card"
        tone="secondary"
      />
    );
  }

  if (!editedSettings) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <Icon name="AlertTriangle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
            Failed to Load Settings
          </h3>
          <Button onClick={loadSettings} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              System Configuration
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Manage platform-wide settings and feature flags
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  loading={saving}
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {!saving && <Icon name="Save" className="w-4 h-4 mr-2" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
            {!hasChanges && (
              <div className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                <Icon name="CheckCircle" className="w-4 h-4" />
                Saved
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${editedSettings.maintenanceMode ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
              <Icon
                name={editedSettings.maintenanceMode ? 'AlertTriangle' : 'CheckCircle'}
                className={`w-5 h-5 ${editedSettings.maintenanceMode ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
              />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Maintenance Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                When enabled, the platform will be in read-only mode for all users except system admins.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={editedSettings.maintenanceMode}
              onChange={(e) => handleMaintenanceModeChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </motion.div>

      {/* Feedback & defensibility (2.7.3: configurable multimodal within limits of defensible feedback) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className={`p-2 rounded-lg ${editedSettings.nonverbalFeedbackEnabled !== false ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <Icon
                name="Scan"
                className={`w-5 h-5 ${editedSettings.nonverbalFeedbackEnabled !== false ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}
              />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Nonverbal (body language) feedback in interviews
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                When enabled, candidates see body language and presence analysis during interviews. When disabled, only defensible feedback (transcript + rubric scoring) is used.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={editedSettings.nonverbalFeedbackEnabled !== false}
              onChange={(e) => handleNonverbalFeedbackChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </motion.div>

      {/* Feature Flags */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
          Feature Flags
        </h3>
        <div className="space-y-4">
          {Object.entries(editedSettings.featureFlags || {}).map(([flag, enabled]) => (
            <div key={flag} className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-slate-700 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {flag.split(/(?=[A-Z])/).join(' ')}
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                  {flag === 'enableJobPosting' && 'Enable job posting and management features'}
                  {flag === 'enableInvitations' && 'Enable team invitation onboarding and related compatibility flows'}
                  {flag === 'enableReviews' && 'Enable interview review and evaluation features'}
                  {flag === 'enableAnalytics' && 'Enable analytics and reporting features'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => handleFeatureFlagChange(flag, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
              </label>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
          Default AI Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Primary Model
            </label>
            <select
              value={editedSettings.defaultAIConfig.model}
              onChange={(e) => handleAIConfigChange('model', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {SUPPORTED_PRIMARY_MODELS.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
              {!SUPPORTED_PRIMARY_MODELS.includes(editedSettings.defaultAIConfig.model) && (
                <option value={editedSettings.defaultAIConfig.model}>
                  {editedSettings.defaultAIConfig.model} (unsupported)
                </option>
              )}
            </select>
            {!SUPPORTED_PRIMARY_MODELS.includes(editedSettings.defaultAIConfig.model) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Current saved model is outside the supported set. Switch to a supported model from the dropdown.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Temperature (0.0 - 1.0)
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={editedSettings.defaultAIConfig.temperature}
              onChange={(e) => handleAIConfigChange('temperature', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-blue-200/70 dark:border-blue-700/50 bg-blue-50/60 dark:bg-blue-900/20 px-3 py-2">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              Automatic fallback is enabled. If the primary model fails, the app retries with
              <span className="font-semibold"> {FALLBACK_MODEL}</span>.
            </p>
          </div>
          <div className="rounded-lg border border-purple-200/70 dark:border-purple-700/50 bg-purple-50/60 dark:bg-purple-900/20 px-3 py-2">
            <p className="text-xs text-purple-800 dark:text-purple-200">
              <span className="font-semibold">Thinking Mode</span> is enabled for evaluation tasks (STAR analysis, interview summaries, document verification) to improve scoring accuracy through chain-of-thought reasoning. Conversational tasks remain fast with thinking disabled.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/20 px-3 py-2">
            <p className="text-xs text-emerald-800 dark:text-emerald-200">
              <span className="font-semibold">Structured Output</span> is enforced via JSON schema constraints on all AI responses, guaranteeing valid structured data from every call.
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-slate-400 mt-3">
          These settings will be used as defaults for new AI interview sessions. Users can still override them.
        </p>
      </motion.div>

      {/* AI Runtime Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              AI Runtime Model Status
            </h3>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
              Live status of Ollama and the most recently active model path (primary/fallback).
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadAIHealth()}
            loading={aiHealthLoading}
            disabled={aiHealthLoading}
          >
            <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {aiHealthError && (
          <div className="mb-4 rounded-lg border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-900/20 px-3 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-300">{aiHealthError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Ollama Service</p>
            <p className={`text-sm font-semibold mt-1 ${
              aiHealthLoading && !aiHealth
                ? 'text-gray-700 dark:text-slate-300'
                : aiHealth?.ollamaReachable
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-400'
            }`}>
              {aiHealthLoading && !aiHealth ? 'Checking...' : aiHealth?.ollamaReachable ? 'Online' : 'Offline'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Configured Primary</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
              {aiHealth?.runtimeModel?.primaryModel || editedSettings.defaultAIConfig.model || DEFAULT_MODEL}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Fallback Model</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
              {aiHealth?.runtimeModel?.fallbackModel || FALLBACK_MODEL}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Current Active Model</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
              {aiHealth?.runtimeModel?.lastSuccessfulModel || 'No successful call yet'}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Last Call Used Fallback</p>
            <p className={`text-sm font-semibold mt-1 ${aiHealth?.runtimeModel?.lastUsedFallback ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-slate-100'}`}>
              {aiHealth?.runtimeModel?.lastUsedFallback ? 'Yes' : 'No'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Total Calls</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
              {Number.isFinite(aiHealth?.runtimeModel?.totalCalls) ? aiHealth.runtimeModel.totalCalls : 0}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Fallback Used Calls</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
              {Number.isFinite(aiHealth?.runtimeModel?.fallbackUsedCalls) ? aiHealth.runtimeModel.fallbackUsedCalls : 0}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Empty-content Events</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
              {Number.isFinite(aiHealth?.runtimeModel?.emptyContentEvents) ? aiHealth.runtimeModel.emptyContentEvents : 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Last empty-content model: {aiHealth?.runtimeModel?.lastEmptyContentModel || 'N/A'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">Last Empty-content Cause</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
              {aiHealth?.runtimeModel?.lastEmptyContentDoneReason || 'N/A'}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Thinking present: {aiHealth?.runtimeModel?.lastEmptyContentHadThinking ? 'Yes' : 'No'} · Retry exhausted: {aiHealth?.runtimeModel?.lastEmptyContentRetryExhausted ? 'Yes' : 'No'}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">Last Attempt Path</p>
          <p className="text-sm text-gray-900 dark:text-slate-100 mt-1 break-words">
            {Array.isArray(aiHealth?.runtimeModel?.lastAttemptedModels) && aiHealth.runtimeModel.lastAttemptedModels.length > 0
              ? aiHealth.runtimeModel.lastAttemptedModels.join(' -> ')
              : 'No attempt recorded yet'}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
            Last update: {aiHealth?.runtimeModel?.lastCallAt ? new Date(aiHealth.runtimeModel.lastCallAt).toLocaleString() : 'Not available'}
          </p>
        </div>
      </motion.div>

      {/* Data Retention */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
          Data Retention Policies
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Interview Data Retention (days)
            </label>
            <input
              type="number"
              min="30"
              value={editedSettings.dataRetention?.interviewDataDays || 365}
              onChange={(e) => handleDataRetentionChange('interviewDataDays', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              How long to keep interview recordings and transcripts
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Activity Log Retention (days)
            </label>
            <input
              type="number"
              min="1"
              value={editedSettings.dataRetention?.activityLogDays || 90}
              onChange={(e) => handleDataRetentionChange('activityLogDays', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              How long to keep activity and audit logs
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-slate-400 mt-3">
          These settings apply platform-wide. Organizations can configure their own retention policies within these limits.
        </p>
      </motion.div>

      {/* Last Updated */}
      {settings && settings.updatedAt && (
        <div className="text-center text-sm text-gray-600 dark:text-slate-400">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
          {settings.updatedBy && ` by admin ${settings.updatedBy}`}
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
        title="Discard Changes?"
        message="Are you sure you want to discard all changes and reset to the current saved settings? This action cannot be undone."
        confirmText="Discard Changes"
        cancelText="Cancel"
        variant="warning"
      />

      {/* Message Dialog */}
      <MessageDialog
        open={messageDialog.open}
        onClose={() => setMessageDialog({ ...messageDialog, open: false })}
        title={messageDialog.title}
        message={messageDialog.message}
        variant={messageDialog.variant}
        buttonText="OK"
      />
    </div>
  );
};

export default SystemSettings;

