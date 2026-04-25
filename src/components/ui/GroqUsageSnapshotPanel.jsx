import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../AppIcon';
import apiClient from '../../services/apiClient.js';

const formatUsageValue = (value) => (
  Number.isFinite(value) ? value.toLocaleString() : 'N/A'
);

const formatUsagePercent = (value) => (
  Number.isFinite(value) ? `${value.toFixed(1)}%` : 'N/A'
);

const getUsageBarTone = (percent) => {
  if (!Number.isFinite(percent)) {
    return 'bg-slate-300 dark:bg-slate-600';
  }
  if (percent <= 10) {
    return 'bg-red-500';
  }
  if (percent <= 30) {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
};

const buildGroqUsageViewModel = (aiHealth) => {
  const groqRateLimits = aiHealth?.interviewProvider?.rateLimits || aiHealth?.runtimeModel?.groqRateLimits || null;
  const provider = String(
    aiHealth?.interviewProvider?.provider || aiHealth?.runtimeModel?.interviewProvider || '',
  ).toLowerCase();

  return {
    groqProviderEnabled: provider === 'groq',
    groqRateLimits,
    interviewModel: aiHealth?.interviewProvider?.expectedModel || aiHealth?.runtimeModel?.interviewModel || '',
  };
};

const GroqUsageSnapshotPanel = ({
  mode = 'self',
  aiHealth = null,
  loading = false,
  error = '',
  defaultExpanded = false,
  title = 'Groq Usage Snapshot',
  description = 'Remaining Groq limits for the interview provider.',
  pollIntervalMs = 15000,
  topOffsetClassName = 'top-16 xs:top-[4.5rem] sm:top-20',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [localAiHealth, setLocalAiHealth] = useState(null);
  const [localLoading, setLocalLoading] = useState(mode === 'self');
  const [localError, setLocalError] = useState('');
  const refreshIntervalRef = useRef(null);

  const loadAIHealth = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLocalLoading(true);
      }
      const result = await apiClient.admin.getAIHealth();
      setLocalAiHealth(result || null);
      setLocalError(result?.success ? '' : result?.error || 'Failed to load AI runtime status.');
    } catch (loadError) {
      setLocalError(loadError?.message || 'Failed to load AI runtime status.');
    } finally {
      if (!silent) {
        setLocalLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (mode !== 'self') {
      return undefined;
    }

    loadAIHealth();
    refreshIntervalRef.current = setInterval(() => {
      loadAIHealth({ silent: true });
    }, pollIntervalMs);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [loadAIHealth, mode, pollIntervalMs]);

  const resolvedAiHealth = mode === 'external' ? aiHealth : localAiHealth;
  const resolvedLoading = mode === 'external' ? loading : localLoading;
  const resolvedError = mode === 'external' ? error : localError;
  const { groqProviderEnabled, groqRateLimits, interviewModel } = buildGroqUsageViewModel(resolvedAiHealth);

  return (
    <div className={`pointer-events-none fixed inset-x-0 ${topOffsetClassName} z-[60] flex justify-center px-3 sm:px-4`}>
      <div className="pointer-events-auto w-full max-w-3xl flex flex-col items-center">
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center justify-center rounded-full border border-sky-200/80 dark:border-sky-700/60 bg-white/95 dark:bg-slate-900/95 px-4 py-2 shadow-xl shadow-sky-500/10 backdrop-blur hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
            aria-expanded={false}
            aria-label="Show Groq usage snapshot"
          >
            <Icon name="ChevronDown" size={18} className="text-sky-700 dark:text-sky-300" />
          </button>
        ) : (
          <div className="w-full rounded-2xl border border-sky-200/70 dark:border-sky-700/50 bg-sky-50/95 dark:bg-sky-950/95 overflow-hidden shadow-2xl shadow-sky-500/10 backdrop-blur-xl">
            <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-sky-200/80 dark:border-sky-800/60">
              <div className="text-center flex-1">
                <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                  {title}
                </p>
                <p className="text-xs text-sky-700 dark:text-sky-300 mt-1">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-200/80 dark:border-sky-700/60 bg-white/80 dark:bg-slate-900/70 hover:bg-sky-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Hide Groq usage snapshot"
              >
                <Icon name="ChevronUp" size={18} className="text-sky-700 dark:text-sky-300" />
              </button>
            </div>

            <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">
              {resolvedError && (
                <div className="mb-3 rounded-lg border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-900/20 px-3 py-2">
                  <p className="text-xs text-amber-700 dark:text-amber-300">{resolvedError}</p>
                </div>
              )}

              {resolvedLoading && !resolvedAiHealth ? (
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  Checking current Groq rate-limit visibility.
                </p>
              ) : !groqProviderEnabled ? (
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  Groq usage details appear here when the interview provider is set to Groq.
                </p>
              ) : !groqRateLimits ? (
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  No Groq rate-limit headers have been observed yet. Run an interview request to populate usage data for this model.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-400">Daily Requests Left</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mt-1">
                            {formatUsageValue(groqRateLimits.requestsRemaining)} / {formatUsageValue(groqRateLimits.requestsLimit)}
                          </p>
                        </div>
                        <p className="text-xs font-medium text-gray-600 dark:text-slate-300">
                          {formatUsagePercent(groqRateLimits.requestsRemainingPercent)}
                        </p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getUsageBarTone(groqRateLimits.requestsRemainingPercent)}`}
                          style={{ width: `${Number.isFinite(groqRateLimits.requestsRemainingPercent) ? groqRateLimits.requestsRemainingPercent : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                        Reset window: {groqRateLimits.requestsReset || 'Not provided'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-400">Minute Tokens Left</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mt-1">
                            {formatUsageValue(groqRateLimits.tokensRemaining)} / {formatUsageValue(groqRateLimits.tokensLimit)}
                          </p>
                        </div>
                        <p className="text-xs font-medium text-gray-600 dark:text-slate-300">
                          {formatUsagePercent(groqRateLimits.tokensRemainingPercent)}
                        </p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getUsageBarTone(groqRateLimits.tokensRemainingPercent)}`}
                          style={{ width: `${Number.isFinite(groqRateLimits.tokensRemainingPercent) ? groqRateLimits.tokensRemainingPercent : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                        Reset window: {groqRateLimits.tokensReset || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/40 p-3">
                      <p className="text-xs text-gray-500 dark:text-slate-400">Interview Model</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                        {interviewModel || 'Not configured'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/40 p-3">
                      <p className="text-xs text-gray-500 dark:text-slate-400">Observed From</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                        {groqRateLimits.source || 'Unknown'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/40 p-3">
                      <p className="text-xs text-gray-500 dark:text-slate-400">Retry After</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                        {groqRateLimits.retryAfter ? `${groqRateLimits.retryAfter}s` : 'Not currently throttled'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/40 p-3">
                      <p className="text-xs text-gray-500 dark:text-slate-400">Last Observed</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                        {groqRateLimits.observedAt ? new Date(groqRateLimits.observedAt).toLocaleString() : 'Not available'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-sky-200/70 dark:border-sky-800/60 bg-sky-100/60 dark:bg-sky-950/30 px-3 py-2">
                    <p className="text-xs text-sky-900 dark:text-sky-100">
                      Groq currently exposes remaining <span className="font-semibold">Requests Per Day</span> and <span className="font-semibold">Tokens Per Minute</span> in response headers. It does not expose a full daily-token remainder in this panel.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroqUsageSnapshotPanel;
