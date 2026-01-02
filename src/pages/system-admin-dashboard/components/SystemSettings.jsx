import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';

const SystemSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedSettings, setEditedSettings] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.getSettings();
      if (result.success) {
        setSettings(result.settings);
        setEditedSettings(JSON.parse(JSON.stringify(result.settings)));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

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
        alert('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Discard all changes and reset to current saved settings?')) {
      return;
    }
    setEditedSettings(JSON.parse(JSON.stringify(settings)));
    setHasChanges(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
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
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {saving ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <>
                      <Icon name="Save" className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
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
                  {flag === 'enableInvitations' && 'Enable interview invitation system'}
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
              Model
            </label>
            <input
              type="text"
              value={editedSettings.defaultAIConfig.model}
              onChange={(e) => handleAIConfigChange('model', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., qwen2.5:7b-instruct"
            />
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
        <p className="text-xs text-gray-600 dark:text-slate-400 mt-3">
          These settings will be used as defaults for new AI interview sessions. Users can still override them.
        </p>
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
    </div>
  );
};

export default SystemSettings;

