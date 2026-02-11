/**
 * Fairness & Calibration Panel (FR10)
 *
 * Admin view for fairness metrics and AI vs SME calibration.
 * - Score distribution (AI overall scores)
 * - Final score distribution (after SME override when applicable)
 * - Calibration: mean absolute difference, agreement within 10 pts, override count
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';

const BUCKET_LABELS = ['0-20', '21-40', '41-60', '61-80', '81-100'];

const FairnessCalibrationPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.admin.getFairnessCalibration(500);
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load fairness and calibration data');
      }
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadRef.current?.();
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
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <LoadingState
        title="Loading fairness & calibration"
        message="Aggregating score distributions and AI vs SME calibration."
        variant="card"
        tone="secondary"
      />
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-2">
          <Icon name="AlertCircle" className="w-5 h-5" />
          <span className="font-medium">Error</span>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  const fairness = data?.fairness ?? {};
  const calibration = data?.calibration ?? {};
  const sampleSize = data?.sampleSize ?? {};

  const maxBucket = Math.max(
    ...BUCKET_LABELS.map((b) => fairness.scoreDistribution?.[b] ?? 0),
    1
  );
  const maxFinalBucket = Math.max(
    ...BUCKET_LABELS.map((b) => fairness.finalScoreDistribution?.[b] ?? 0),
    1
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
          Fairness & Calibration (FR10)
        </h2>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <Icon name="RefreshCw" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="ml-2 hidden xs:inline">Refresh</span>
        </Button>
      </div>

      <p className="text-sm text-gray-600 dark:text-slate-400">
        Score distributions and AI vs SME calibration from the most recent interviews and reviews.
        Used to assess fairness and alignment between AI and human evaluators.
      </p>

      {/* Fairness metrics */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Icon name="Scale" className="w-4 h-4 text-purple-600" />
          Fairness metrics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Completed interviews</p>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {fairness.completedInterviews ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">With AI score</p>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {fairness.withScore ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">SME overrides</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {fairness.smeOverrideCount ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Sample (interviews)</p>
            <p className="text-xl font-bold text-gray-700 dark:text-slate-300">
              {sampleSize.interviews ?? 0}
            </p>
          </div>
        </div>

        <h4 className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-2">
          AI overall score distribution
        </h4>
        <div className="space-y-2">
          {BUCKET_LABELS.map((bucket) => {
            const count = fairness.scoreDistribution?.[bucket] ?? 0;
            const pct = fairness.withScore ? (count / fairness.withScore) * 100 : 0;
            const barPct = maxBucket ? (count / maxBucket) * 100 : 0;
            return (
              <div key={bucket} className="flex items-center gap-3">
                <span className="w-14 text-xs text-gray-600 dark:text-slate-400">{bucket}</span>
                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-purple-500 dark:bg-purple-600 rounded"
                  />
                </div>
                <span className="w-16 text-xs text-gray-700 dark:text-slate-300 text-right">
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>

        <h4 className="text-xs font-medium text-gray-600 dark:text-slate-400 mt-6 mb-2">
          Final score distribution (after SME override when applicable)
        </h4>
        <div className="space-y-2">
          {BUCKET_LABELS.map((bucket) => {
            const count = fairness.finalScoreDistribution?.[bucket] ?? 0;
            const total = (fairness.finalScoreDistribution && BUCKET_LABELS.reduce((s, b) => s + (fairness.finalScoreDistribution[b] ?? 0), 0)) || 1;
            const pct = (count / total) * 100;
            const barPct = maxFinalBucket ? (count / maxFinalBucket) * 100 : 0;
            return (
              <div key={`final-${bucket}`} className="flex items-center gap-3">
                <span className="w-14 text-xs text-gray-600 dark:text-slate-400">{bucket}</span>
                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-blue-500 dark:bg-blue-600 rounded"
                  />
                </div>
                <span className="w-16 text-xs text-gray-700 dark:text-slate-300 text-right">
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calibration metrics */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Icon name="GitCompare" className="w-4 h-4 text-blue-600" />
          Calibration (AI vs SME)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Reviews with both scores</p>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {calibration.reviewsWithBothScores ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Mean |AI − SME| (pts)</p>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {calibration.meanAbsoluteDifference != null
                ? calibration.meanAbsoluteDifference.toFixed(1)
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Agreement within 10 pts</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {calibration.agreementWithin10Percent != null
                ? `${calibration.agreementWithin10Percent}%`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Inter-rater reliability (ICC)</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {calibration.interRaterReliabilityIcc != null
                ? calibration.interRaterReliabilityIcc.toFixed(3)
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Override count</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {calibration.overrideCount ?? 0}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-4">
          Sample: {sampleSize.reviews ?? 0} recent reviews. Lower mean difference, higher agreement, and ICC closer to 1
          indicate better AI–SME alignment and inter-rater reliability.
        </p>
      </div>
    </div>
  );
};

export default FairnessCalibrationPanel;
