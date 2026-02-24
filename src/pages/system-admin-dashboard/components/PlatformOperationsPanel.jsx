import React, { useEffect, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import LoadingState from '../../../components/ui/LoadingState';
import { useToast } from '../../../components/ui/Toast.jsx';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import { ADMIN_FEED_EVENTS, combineRealtimeEventTypes } from '../../../constants/realtimeFeedEvents.js';

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

const PlatformOperationsPanel = () => {
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billing, setBilling] = useState(null);
  const [newsletter, setNewsletter] = useState(null);
  const [retention, setRetention] = useState(null);
  const [stats, setStats] = useState(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [lastCleanup, setLastCleanup] = useState(null);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadDataRef = useRef(null);

  const loadData = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const [statsResult, billingResult, newsletterResult, retentionResult] = await Promise.allSettled([
        apiClient.admin.getStats(),
        apiClient.admin.getBillingOverview(),
        apiClient.admin.getNewsletterStats(),
        apiClient.admin.getDataRetentionSummary(),
      ]);

      if (statsResult.status === 'fulfilled' && statsResult.value?.success) {
        setStats(statsResult.value.stats || null);
      }
      if (billingResult.status === 'fulfilled' && billingResult.value?.success) {
        setBilling(billingResult.value.billing || null);
      }
      if (newsletterResult.status === 'fulfilled' && newsletterResult.value?.success) {
        setNewsletter(newsletterResult.value.newsletter || null);
      }
      if (retentionResult.status === 'fulfilled' && retentionResult.value?.success) {
        setRetention(retentionResult.value.retention || null);
      }
    } catch (error) {
      showErrorToast('Failed to load operations data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData({ showLoader: true });
  }, []);

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    eventTypes: combineRealtimeEventTypes(
      ADMIN_FEED_EVENTS.operations,
      ADMIN_FEED_EVENTS.settings,
      ADMIN_FEED_EVENTS.organizations,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadDataRef.current?.({ showLoader: false });
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

  const runCleanup = async (dryRun) => {
    try {
      setCleanupRunning(true);
      const result = await apiClient.admin.runDataRetentionCleanup({
        dryRun,
        maxDocuments: 250,
      });
      if (!result?.success) {
        throw new Error('Failed to run data retention cleanup.');
      }
      setLastCleanup(result.retention || null);
      showSuccessToast(dryRun ? 'Dry run complete.' : 'Data retention cleanup executed.');
      await loadData({ showLoader: false });
    } catch (error) {
      showErrorToast(error?.message || 'Failed to run cleanup.');
    } finally {
      setCleanupRunning(false);
    }
  };

  if (loading && !billing && !newsletter && !retention) {
    return (
      <LoadingState
        title="Loading platform operations"
        message="Gathering billing, newsletter, and retention insights."
        variant="card"
        tone="secondary"
      />
    );
  }

  const activeSubscriptions = Number(billing?.statusCounts?.active || 0);
  const totalSubscriptions = Number(billing?.totalSubscriptions || 0);
  const estimatedMrr = Number(billing?.estimatedMrr || 0);
  const newsletterActive = Number(newsletter?.active || 0);
  const newsletterTotal = Number(newsletter?.total || 0);
  const pendingInterviewsCleanup = Number(retention?.pending?.interviews || 0);
  const pendingAuditCleanup = Number(retention?.pending?.platformAuditLogs || 0);
  const pendingActivityCleanup = Number(retention?.pending?.activityLogs || 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
              Operations Overview
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Billing, retention, and communication operations in one view.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadData({ showLoader: false })} disabled={refreshing}>
            <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/70 dark:bg-blue-900/20 p-4">
            <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">MRR</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(estimatedMrr)}</p>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1">Estimated recurring revenue</p>
          </div>
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/70 dark:bg-emerald-900/20 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Subscriptions</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{activeSubscriptions}/{totalSubscriptions}</p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">Active vs total</p>
          </div>
          <div className="rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/70 dark:bg-purple-900/20 p-4">
            <p className="text-xs uppercase tracking-wide text-purple-700 dark:text-purple-300">Newsletter</p>
            <p className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-300">{newsletterActive}/{newsletterTotal}</p>
            <p className="text-xs text-purple-700/80 dark:text-purple-300/80 mt-1">Active subscribers</p>
          </div>
          <div className="rounded-xl border border-orange-100 dark:border-orange-900/30 bg-orange-50/70 dark:bg-orange-900/20 p-4">
            <p className="text-xs uppercase tracking-wide text-orange-700 dark:text-orange-300">Retention Queue</p>
            <p className="mt-1 text-2xl font-bold text-orange-700 dark:text-orange-300">
              {pendingInterviewsCleanup + pendingAuditCleanup + pendingActivityCleanup}
            </p>
            <p className="text-xs text-orange-700/80 dark:text-orange-300/80 mt-1">Items eligible for cleanup</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-5 shadow-lg">
        <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100">Data Retention Controls</h4>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
          Review eligible records and trigger cleanup safely with a dry run first.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-500">Interviews</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{pendingInterviewsCleanup}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-500">Platform Audit Logs</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{pendingAuditCleanup}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-500">Activity Logs</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{pendingActivityCleanup}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => runCleanup(true)} disabled={cleanupRunning}>
            <Icon name="ScanSearch" className="w-4 h-4 mr-2" />
            Dry Run
          </Button>
          <Button onClick={() => runCleanup(false)} disabled={cleanupRunning} className="bg-orange-600 hover:bg-orange-700">
            <Icon name="ShieldAlert" className="w-4 h-4 mr-2" />
            Run Cleanup
          </Button>
        </div>

        {lastCleanup && (
          <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-900/20 p-3 text-sm">
            <p className="font-semibold text-blue-700 dark:text-blue-300">
              {lastCleanup.dryRun ? 'Latest Dry Run' : 'Latest Cleanup Execution'}
            </p>
            <p className="mt-1 text-blue-700/90 dark:text-blue-300/90">
              Interviews processed: {lastCleanup.processed?.interviews || 0}, Audit logs removed: {lastCleanup.processed?.platformAuditLogs || 0}, Activity logs removed: {lastCleanup.processed?.activityLogs || 0}
            </p>
          </div>
        )}
      </div>

      {Array.isArray(billing?.recentEvents) && billing.recentEvents.length > 0 && (
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-5 shadow-lg">
          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100">Recent Billing Events</h4>
          <div className="mt-3 space-y-2">
            {billing.recentEvents.slice(0, 8).map((event, idx) => (
              <div key={`${event.id || event.timestamp || 'billing-event'}-${idx}`} className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {event.type || event.eventType || 'Billing event'}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                  {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Timestamp unavailable'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="text-xs text-gray-500 dark:text-slate-500">
          Platform snapshot: {stats?.users?.total || 0} users, {stats?.organizations?.total || 0} organizations, {stats?.interviews?.total || 0} interviews.
        </div>
      )}
    </div>
  );
};

export default PlatformOperationsPanel;
