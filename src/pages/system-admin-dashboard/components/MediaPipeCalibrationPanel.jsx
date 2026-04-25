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

const CATEGORY_TITLES = {
  posture: 'Posture Thresholds',
  eyeContact: 'Eye Contact Thresholds',
  facial: 'Facial Thresholds',
  engagement: 'Engagement Thresholds',
};

const CATEGORY_DESCRIPTIONS = {
  posture: 'Posture alignment thresholds learned from collected shoulder, spine, and head-position samples.',
  eyeContact: 'Face orientation, blink, gaze, and eyeball/iris thresholds calibrated from live interview analytics.',
  facial: 'Facial-expression thresholds currently used to detect active speaking during interview answers.',
  engagement: 'Movement thresholds used to score composure and flag excessive fidgeting.',
};

const ADVANCED_EYE_METRICS = new Set([
  'eyeContact.gaze.irisPosition.tolerance',
  'eyeContact.gaze.horizontalOffsetThreshold',
  'eyeContact.gaze.verticalOffsetThreshold',
  'eyeContact.gaze.asymmetryThreshold',
  'eyeContact.gaze.irisSymmetryThreshold',
]);

const METRIC_METADATA = {
  'posture.shoulder.maxSlopeThreshold': {
    label: 'Shoulder Slope Limit',
    description: 'Maximum shoulder tilt allowed before posture scoring begins to drop.',
  },
  'posture.shoulder.moderateSlopeThreshold': {
    label: 'Shoulder Moderate Tilt',
    description: 'Moderate shoulder tilt threshold used for fair posture scoring.',
  },
  'posture.shoulder.poorSlopeThreshold': {
    label: 'Shoulder Poor Tilt',
    description: 'High shoulder tilt threshold used to classify poor posture.',
  },
  'posture.spine.maxForwardHeadThreshold': {
    label: 'Forward Head Limit',
    description: 'Maximum forward-head displacement allowed before posture penalties apply.',
  },
  'posture.spine.moderateForwardHeadThreshold': {
    label: 'Forward Head Moderate Limit',
    description: 'Moderate forward-head displacement threshold for fair posture scoring.',
  },
  'posture.spine.poorForwardHeadThreshold': {
    label: 'Forward Head Poor Limit',
    description: 'Severe forward-head threshold used to classify poor posture.',
  },
  'posture.head.maxTiltThreshold': {
    label: 'Head Tilt Limit',
    description: 'Maximum acceptable head tilt before head-position scoring drops.',
  },
  'posture.head.poorTiltThreshold': {
    label: 'Head Tilt Poor Limit',
    description: 'Severe head tilt threshold used to classify poor head position.',
  },
  'posture.head.loweredThreshold': {
    label: 'Head Lowered Limit',
    description: 'Threshold for detecting when the candidate is consistently looking downward.',
  },
  'eyeContact.orientation.maxYawThreshold': {
    label: 'Yaw Limit',
    description: 'Maximum left-right face rotation allowed while maintaining direct eye contact.',
  },
  'eyeContact.orientation.moderateYawThreshold': {
    label: 'Yaw Moderate Limit',
    description: 'Moderate face rotation threshold used before eye-contact scoring drops further.',
  },
  'eyeContact.orientation.poorYawThreshold': {
    label: 'Yaw Poor Limit',
    description: 'Severe left-right face rotation threshold used to classify looking away.',
  },
  'eyeContact.orientation.maxPitchThreshold': {
    label: 'Pitch Limit',
    description: 'Maximum up-down face tilt allowed before attention scoring begins to drop.',
  },
  'eyeContact.orientation.moderatePitchThreshold': {
    label: 'Pitch Moderate Limit',
    description: 'Moderate up-down face tilt threshold used for fair eye-contact scoring.',
  },
  'eyeContact.orientation.poorPitchThreshold': {
    label: 'Pitch Poor Limit',
    description: 'Severe up-down face tilt threshold used to classify looking away.',
  },
  'eyeContact.eyes.blinkThreshold': {
    label: 'Blink Threshold',
    description: 'EAR threshold used to detect a blink or prolonged eye closure.',
  },
  'eyeContact.gaze.irisPosition.tolerance': {
    label: 'Gaze Center Tolerance',
    description: 'Allowed eyeball drift from the camera-center target before gaze is penalized.',
  },
  'eyeContact.gaze.horizontalOffsetThreshold': {
    label: 'Horizontal Eye Offset Limit',
    description: 'Maximum left-right iris drift allowed before eye-contact accuracy drops.',
  },
  'eyeContact.gaze.verticalOffsetThreshold': {
    label: 'Vertical Eye Offset Limit',
    description: 'Maximum up-down iris drift allowed before eye-contact accuracy drops.',
  },
  'eyeContact.gaze.asymmetryThreshold': {
    label: 'Eye Asymmetry Limit',
    description: 'Threshold for imbalance between left-eye and right-eye openness/gaze behaviour.',
  },
  'eyeContact.gaze.irisSymmetryThreshold': {
    label: 'Iris Symmetry Limit',
    description: 'Threshold for left/right iris mismatch used to detect unstable eyeball tracking.',
  },
  'facial.mouth.speakingThreshold': {
    label: 'Speaking Mouth Threshold',
    description: 'MAR threshold used to recognize when the candidate is actively speaking.',
  },
  'engagement.fidgetThreshold': {
    label: 'Fidgeting Threshold',
    description: 'Movement threshold used to flag excessive hand motion and reduced composure.',
  },
};

const humanizeToken = (token) =>
  String(token || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getMetricMetadata = (metricPath) => {
  if (METRIC_METADATA[metricPath]) {
    return METRIC_METADATA[metricPath];
  }

  const parts = String(metricPath || '').split('.');
  const relevant = parts.length > 3 ? parts.slice(-2) : parts.slice(-1);

  return {
    label: relevant.map(humanizeToken).join(' '),
    description: 'Calibrated from collected interview analytics samples.',
  };
};

const formatMetricValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (Math.abs(numeric) >= 10) return numeric.toFixed(1);
  if (Math.abs(numeric) >= 1) return numeric.toFixed(2);
  return numeric.toFixed(3);
};

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
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {CATEGORY_TITLES[category] || `${category} Thresholds`}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {CATEGORY_DESCRIPTIONS[category]}
              </p>
              {category === 'eyeContact' && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  <Icon name="Eye" className="w-3.5 h-3.5" />
                  Advanced eye tracking active: gaze center, eyeball offsets, iris symmetry, and eye asymmetry.
                </div>
              )}
            </div>
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
                  {categoryComparisons.map((comp) => {
                    const metadata = getMetricMetadata(comp.metric);
                    const isAdvancedEyeMetric = ADVANCED_EYE_METRICS.has(comp.metric);

                    return (
                    <tr key={comp.metric} className="border-b border-gray-100 dark:border-slate-800 align-top">
                      <td className="p-2 font-medium text-gray-700 dark:text-slate-300">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{metadata.label}</span>
                            {isAdvancedEyeMetric && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                Eye / Iris
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-normal text-gray-500 dark:text-slate-400">
                            {metadata.description}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
                            {comp.metric}
                          </p>
                        </div>
                      </td>
                      <td className="p-2 text-center text-gray-600 dark:text-slate-400">
                        {formatMetricValue(comp.staticValue)}
                      </td>
                      <td className="p-2 text-center font-semibold text-gray-900 dark:text-slate-100">
                        {formatMetricValue(comp.calibratedValue)}
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
                  )})}
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
