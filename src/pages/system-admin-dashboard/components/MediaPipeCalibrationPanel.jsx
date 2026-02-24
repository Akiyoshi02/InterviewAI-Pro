import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';
import apiClient from '../../../services/apiClient';
import {
  saveCalibratedOverrides,
  clearCalibratedOverrides,
  loadCalibratedOverrides,
} from '../../../config/mediapipeReferenceData';

const confidenceBadge = (level) => {
  const styles = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    none: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[level] || styles.none}`}>
      {level || 'none'}
    </span>
  );
};

const deviationIndicator = (deviation) => {
  if (deviation === null || deviation === undefined) {
    return <span className="text-xs text-gray-400 dark:text-slate-500">N/A</span>;
  }
  const abs = Math.abs(deviation);
  const sign = deviation >= 0 ? '+' : '';
  const color = abs <= 10
    ? 'text-green-600 dark:text-green-400'
    : abs <= 25
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';
  return <span className={`text-xs font-semibold ${color}`}>{sign}{deviation}%</span>;
};

const MediaPipeCalibrationPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appliedAt, setAppliedAt] = useState(() => {
    const stored = loadCalibratedOverrides();
    return stored?.appliedAt || null;
  });

  const handleApplyCalibrated = () => {
    if (!data?.calibrated) return;
    const success = saveCalibratedOverrides(data.calibrated);
    if (success) {
      setAppliedAt(new Date().toISOString());
    }
  };

  const handleRevertToStatic = () => {
    clearCalibratedOverrides();
    setAppliedAt(null);
  };

  const loadCalibration = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.admin.getMediaPipeCalibration();
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load calibration data');
      }
    } catch (err) {
      setError(err.message || 'Failed to load MediaPipe calibration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalibration();
  }, [loadCalibration]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingIndicator size={24} tone="primary" />
        <span className="ml-3 text-sm text-gray-600 dark:text-slate-400">Loading calibration data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Icon name="AlertTriangle" className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-slate-400 mb-4">{error}</p>
        <Button onClick={loadCalibration} variant="outline" size="sm">Retry</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <Icon name="Activity" className="w-10 h-10 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-slate-400">No calibration data available yet.</p>
      </div>
    );
  }

  const { comparisons, summary } = data;
  const categories = ['posture', 'eyeContact', 'facial', 'engagement'];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Analytics Datasets</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{summary?.totalAnalyticsDatasets ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">High-Score Data</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{summary?.highScoreDatasets ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Metrics Calibrated</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{summary?.metricsCalibrated ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">High Confidence</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{summary?.highConfidenceMetrics ?? 0}</p>
        </div>
      </div>

      {/* Comparison Tables by Category */}
      {categories.map((category) => {
        const categoryComparisons = (comparisons || []).filter((c) =>
          c.metric.startsWith(`${category}.`),
        );
        if (categoryComparisons.length === 0) return null;

        return (
          <div key={category} className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 capitalize">
              {category === 'eyeContact' ? 'Eye Contact' : category} Thresholds
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left p-2 text-gray-500 dark:text-slate-400">Metric</th>
                    <th className="text-center p-2 text-gray-500 dark:text-slate-400">Static</th>
                    <th className="text-center p-2 text-gray-500 dark:text-slate-400">Calibrated</th>
                    <th className="text-center p-2 text-gray-500 dark:text-slate-400">Deviation</th>
                    <th className="text-center p-2 text-gray-500 dark:text-slate-400">Samples</th>
                    <th className="text-center p-2 text-gray-500 dark:text-slate-400">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryComparisons.map((comp) => (
                    <tr key={comp.metric} className="border-b border-gray-100 dark:border-slate-800">
                      <td className="p-2 font-medium text-gray-700 dark:text-slate-300">
                        {comp.metric.split('.')[1]}
                      </td>
                      <td className="p-2 text-center text-gray-600 dark:text-slate-400">
                        {comp.staticValue ?? '-'}
                      </td>
                      <td className="p-2 text-center font-semibold text-gray-900 dark:text-slate-100">
                        {comp.calibratedValue !== null ? comp.calibratedValue : '-'}
                      </td>
                      <td className="p-2 text-center">
                        {deviationIndicator(comp.deviation)}
                      </td>
                      <td className="p-2 text-center text-gray-600 dark:text-slate-400">
                        {comp.stats?.sampleSize ?? 0}
                      </td>
                      <td className="p-2 text-center">
                        {confidenceBadge(comp.confidence)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Apply / Revert Actions */}
      <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Apply Calibrated Values</h3>
        {appliedAt && (
          <div className="mb-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 px-3 py-2 text-xs text-green-700 dark:text-green-300">
            Calibrated values are currently active (applied {new Date(appliedAt).toLocaleString()}).
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleApplyCalibrated}
            disabled={!data?.calibrated || (summary?.metricsCalibrated ?? 0) === 0}
            iconName="Check"
            iconPosition="left"
          >
            Apply Calibrated Values
          </Button>
          <Button
            onClick={handleRevertToStatic}
            variant="outline"
            disabled={!appliedAt}
            iconName="RotateCcw"
            iconPosition="left"
          >
            Revert to Static Values
          </Button>
          <Button onClick={loadCalibration} variant="outline" iconName="RefreshCw" iconPosition="left">
            Refresh
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
          Applying calibrated values updates the scoring thresholds used during live interviews.
          Revert restores the original research-backed static values.
        </p>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500 dark:text-slate-500 space-y-1">
        <p><span className="text-green-600 dark:text-green-400 font-semibold">Green</span> deviation: within 10% of static (close match)</p>
        <p><span className="text-yellow-600 dark:text-yellow-400 font-semibold">Yellow</span> deviation: 10-25% (moderate difference)</p>
        <p><span className="text-red-600 dark:text-red-400 font-semibold">Red</span> deviation: &gt;25% (significant recalibration needed)</p>
      </div>
    </div>
  );
};

export default MediaPipeCalibrationPanel;
