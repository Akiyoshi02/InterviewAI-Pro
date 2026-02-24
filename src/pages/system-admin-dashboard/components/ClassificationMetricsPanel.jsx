import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';
import apiClient from '../../../services/apiClient';

const LABELS = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent'];
const HEAT_COLORS = [
  'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500',
  'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  'bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100',
  'bg-blue-400 dark:bg-blue-700/70 text-white',
  'bg-blue-600 dark:bg-blue-600 text-white font-bold',
];

function heatColor(value, max) {
  if (!value || value === 0) return HEAT_COLORS[0];
  const ratio = max > 0 ? value / max : 0;
  if (ratio <= 0.1) return HEAT_COLORS[1];
  if (ratio <= 0.3) return HEAT_COLORS[2];
  if (ratio <= 0.5) return HEAT_COLORS[3];
  if (ratio <= 0.8) return HEAT_COLORS[4];
  return HEAT_COLORS[5];
}

const MetricBar = ({ label, value, maxValue = 1 }) => {
  const pct = Math.round((value || 0) * 100);
  const width = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-700 dark:text-slate-300">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-slate-100">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

const ClassificationMetricsPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.admin.getClassificationMetrics();
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load metrics');
      }
    } catch (err) {
      setError(err.message || 'Failed to load classification metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingIndicator size={24} tone="primary" />
        <span className="ml-3 text-sm text-gray-600 dark:text-slate-400">Loading classification metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Icon name="AlertTriangle" className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-slate-400 mb-4">{error}</p>
        <Button onClick={loadMetrics} variant="outline" size="sm">Retry</Button>
      </div>
    );
  }

  if (!data || !data.confusionMatrix) {
    return (
      <div className="text-center py-8">
        <Icon name="BarChart3" className="w-10 h-10 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-slate-400">No classification data available yet.</p>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
          SME reviews with both AI and human scores are needed to build the confusion matrix.
        </p>
      </div>
    );
  }

  const { confusionMatrix, metrics, accuracy, sampleSize, labels } = data;
  const maxCell = Math.max(...confusionMatrix.matrix.flat(), 1);
  const displayLabels = labels || LABELS;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Accuracy</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{accuracy}%</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Macro F1</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{Math.round((metrics?.macroAvg?.f1 || 0) * 100)}%</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Sample Size</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{sampleSize}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Confidence</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {sampleSize >= 50 ? 'High' : sampleSize >= 20 ? 'Medium' : 'Low'}
          </p>
        </div>
      </div>

      {/* Confusion Matrix Heatmap */}
      <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
          Confusion Matrix (AI Predicted vs SME Actual)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left text-gray-500 dark:text-slate-400">SME Actual \ AI Predicted</th>
                {displayLabels.map((label) => (
                  <th key={label} className="p-2 text-center text-gray-700 dark:text-slate-300 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {confusionMatrix.matrix.map((row, ri) => (
                <tr key={displayLabels[ri]}>
                  <td className="p-2 font-medium text-gray-700 dark:text-slate-300">{displayLabels[ri]}</td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-1">
                      <div className={`rounded-lg p-2 text-center text-xs font-semibold ${heatColor(cell, maxCell)}`}>
                        {cell}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
          Diagonal (darker cells) = correct predictions. Off-diagonal = misclassifications.
        </p>
      </div>

      {/* Per-Class Metrics */}
      <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
          Per-Class Precision, Recall, and F1
        </h3>
        <div className="space-y-4">
          {(metrics?.perClass || []).map((cls) => (
            <div key={cls.label} className="space-y-2">
              <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{cls.label}</p>
              <div className="grid grid-cols-3 gap-3">
                <MetricBar label="Precision" value={cls.precision} />
                <MetricBar label="Recall" value={cls.recall} />
                <MetricBar label="F1" value={cls.f1} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button onClick={loadMetrics} variant="outline" size="sm" iconName="RefreshCw" iconPosition="left">
          Refresh Metrics
        </Button>
      </div>
    </div>
  );
};

export default ClassificationMetricsPanel;
