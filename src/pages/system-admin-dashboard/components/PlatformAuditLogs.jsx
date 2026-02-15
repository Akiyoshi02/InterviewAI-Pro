import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import UnifiedFilterPanel, {
  FILTER_DATE_GRID_CLASS,
  FILTER_GRID_CLASS,
  UnifiedFilterField,
  UnifiedFilterSelect,
  UnifiedSearchField,
  UnifiedTextInput,
} from '../../../components/ui/UnifiedFilterPanel';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import {
  ADMIN_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../../constants/realtimeFeedEvents.js';
import {
  ADMIN_AUDIT_CATEGORY_FILTER_OPTIONS,
  ADMIN_AUDIT_METADATA_FILTER_OPTIONS,
  ADMIN_AUDIT_SORT_FILTER_OPTIONS,
  ADMIN_DATE_PRESET_FILTER_OPTIONS,
  DEFAULT_ADMIN_AUDIT_FILTERS,
  buildAdminAuditFilterOptions,
  countActiveAdminAuditFilters,
  filterAdminAuditLogs,
} from '../utils/adminDashboardFilters.js';

const FETCH_LIMIT = 100;
const MAX_FETCH_PAGES = 6;
const PAGE_SIZE = 25;

const PlatformAuditLogs = () => {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_ADMIN_AUDIT_FILTERS);
  const [isTruncated, setIsTruncated] = useState(false);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadAuditLogsRef = useRef(null);

  const loadAuditLogs = useCallback(async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const aggregated = [];
      let cursor = null;
      let pageCounter = 0;
      let hasMore = false;

      while (pageCounter < MAX_FETCH_PAGES) {
        const result = await apiClient.admin.getAuditLogs(FETCH_LIMIT, 0, cursor);
        if (!result?.success) {
          throw new Error('Failed to load audit logs.');
        }

        const chunk = Array.isArray(result.logs) ? result.logs : [];
        aggregated.push(...chunk);
        hasMore = Boolean(result.hasMore);
        cursor = result.nextCursor || null;

        if (!hasMore || !cursor || chunk.length === 0) {
          break;
        }

        pageCounter += 1;
      }

      const deduped = Array.from(
        new Map(aggregated.filter((log) => log?.id).map((log) => [log.id, log])).values(),
      );

      setAllLogs(deduped);
      setIsTruncated(Boolean(hasMore && cursor));
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs({ showLoader: true });
  }, [loadAuditLogs]);

  useEffect(() => {
    loadAuditLogsRef.current = loadAuditLogs;
  }, [loadAuditLogs]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    eventTypes: combineRealtimeEventTypes(
      ADMIN_FEED_EVENTS.organizations,
      ADMIN_FEED_EVENTS.settings,
      ADMIN_FEED_EVENTS.datasets,
      ADMIN_FEED_EVENTS.interviews,
      ADMIN_FEED_EVENTS.reviews,
      ADMIN_FEED_EVENTS.users,
      ADMIN_FEED_EVENTS.operations,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadAuditLogsRef.current?.({ showLoader: false });
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

  const filterOptions = useMemo(
    () => buildAdminAuditFilterOptions(allLogs),
    [allLogs],
  );

  const filteredLogs = useMemo(
    () => filterAdminAuditLogs(allLogs, filters),
    [allLogs, filters],
  );

  const activeFilterCount = useMemo(
    () => countActiveAdminAuditFilters(filters),
    [filters],
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalFiltered = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageStartIndex = (page - 1) * PAGE_SIZE;
  const paginatedLogs = useMemo(
    () => filteredLogs.slice(pageStartIndex, pageStartIndex + PAGE_SIZE),
    [filteredLogs, pageStartIndex],
  );

  const clearFilters = () => {
    setFilters(DEFAULT_ADMIN_AUDIT_FILTERS);
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'ORG_APPROVED':
        return { name: 'CheckCircle', color: 'text-green-600 dark:text-green-400' };
      case 'ORG_REJECTED':
        return { name: 'XCircle', color: 'text-red-600 dark:text-red-400' };
      case 'ORG_SUSPENDED':
        return { name: 'AlertTriangle', color: 'text-orange-600 dark:text-orange-400' };
      case 'ORG_ACTIVATED':
        return { name: 'CheckCircle', color: 'text-blue-600 dark:text-blue-400' };
      case 'SETTINGS_UPDATED':
        return { name: 'Settings', color: 'text-purple-600 dark:text-purple-400' };
      case 'USER_SUSPENDED':
        return { name: 'UserX', color: 'text-red-600 dark:text-red-400' };
      case 'ADMIN_SEEDED':
        return { name: 'Shield', color: 'text-purple-600 dark:text-purple-400' };
      default:
        return { name: 'Activity', color: 'text-gray-600 dark:text-gray-400' };
    }
  };

  const getActionLabel = (action) =>
    (action || '')
      .split('_')
      .filter(Boolean)
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');

  const formatMetadata = (metadata) => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return null;
    }

    return (
      <div className="mt-2 text-xs text-gray-600 dark:text-slate-400 space-y-1">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="font-medium">{key}:</span>
            <span className="truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading && allLogs.length === 0) {
    return (
      <LoadingState
        title="Loading audit logs"
        message="Fetching recent administrative activity."
        variant="card"
        tone="secondary"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Platform Audit Logs
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Showing {totalFiltered} filtered logs from {allLogs.length} loaded records.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadAuditLogs({ showLoader: false })}
            disabled={loading || refreshing}
            className="flex items-center gap-2"
            loading={refreshing}
          >
            {!(loading || refreshing) && <Icon name="RefreshCw" className="w-4 h-4" />}
            {(loading || refreshing) ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <UnifiedFilterPanel
          className="mb-6"
          title="Audit Log Filters"
          description="Filter logs by action, actor, target, metadata flags, date windows, and sorting."
          activeCount={activeFilterCount}
          onClear={clearFilters}
        >
          <div className={FILTER_GRID_CLASS}>
            <UnifiedSearchField
              label="Search"
              className="sm:col-span-2 xl:col-span-2"
              type="text"
              value={filters.searchQuery}
              onChange={(event) => setFilters((prev) => ({ ...prev, searchQuery: event.target.value }))}
              placeholder="Action, actor, target, metadata, or id"
            />
            <UnifiedFilterSelect
              label="Action"
              value={filters.actionFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, actionFilter: value }))}
              options={filterOptions.actionOptions}
              placeholder="All actions"
            />
            <UnifiedFilterSelect
              label="Category"
              value={filters.categoryFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, categoryFilter: value }))}
              options={ADMIN_AUDIT_CATEGORY_FILTER_OPTIONS}
              placeholder="All categories"
            />
            <UnifiedFilterSelect
              label="Actor Type"
              value={filters.actorTypeFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, actorTypeFilter: value }))}
              options={filterOptions.actorTypeOptions}
              placeholder="All actors"
            />
            <UnifiedFilterSelect
              label="Target Type"
              value={filters.targetTypeFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, targetTypeFilter: value }))}
              options={filterOptions.targetTypeOptions}
              placeholder="All targets"
            />
            <UnifiedFilterSelect
              label="Metadata Flag"
              value={filters.metadataFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, metadataFilter: value }))}
              options={ADMIN_AUDIT_METADATA_FILTER_OPTIONS}
              placeholder="All metadata"
            />
            <UnifiedFilterSelect
              label="Date Range"
              value={filters.datePreset}
              onChange={(value) => setFilters((prev) => ({ ...prev, datePreset: value }))}
              options={ADMIN_DATE_PRESET_FILTER_OPTIONS}
              placeholder="All dates"
            />
            <UnifiedFilterSelect
              label="Sort By"
              value={filters.sortBy}
              onChange={(value) => setFilters((prev) => ({ ...prev, sortBy: value }))}
              options={ADMIN_AUDIT_SORT_FILTER_OPTIONS}
              placeholder="Sort logs"
            />
          </div>

          {filters.datePreset === 'custom' && (
            <div className={FILTER_DATE_GRID_CLASS}>
              <UnifiedFilterField label="From Date">
                <UnifiedTextInput
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                />
              </UnifiedFilterField>
              <UnifiedFilterField label="To Date">
                <UnifiedTextInput
                  type="date"
                  value={filters.to}
                  onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                />
              </UnifiedFilterField>
            </div>
          )}
        </UnifiedFilterPanel>

        {isTruncated && (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Showing the latest {allLogs.length} logs. Refine filters or refresh to inspect recent windows.
          </div>
        )}

        {paginatedLogs.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="FileText" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-slate-400">
              No audit logs match the selected filters.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedLogs.map((log, index) => {
                const icon = getActionIcon(log.action);
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-900/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 shrink-0">
                        <Icon name={icon.name} className={`w-4 h-4 ${icon.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-slate-100">
                                {getActionLabel(log.action)}
                              </span>
                              {log.targetType && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                  {log.targetType}
                                </span>
                              )}
                            </div>
                            {(log.actor || log.actorId) && (
                              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                                by {log.actor?.fullName || log.actor?.email || log.actorType || `Admin ${log.actorId || 'System'}`}
                              </p>
                            )}
                            {formatMetadata(log.metadata)}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              {new Date(log.createdAt || log.timestamp).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              {new Date(log.createdAt || log.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-500">
                Showing {totalFiltered === 0 ? 0 : pageStartIndex + 1}-{Math.min(pageStartIndex + paginatedLogs.length, totalFiltered)} of {totalFiltered}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                >
                  <Icon name="ChevronLeft" className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <Icon name="ChevronRight" className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
          Action Types
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { action: 'ORG_APPROVED', description: 'Organization approval granted' },
            { action: 'ORG_REJECTED', description: 'Organization approval denied' },
            { action: 'ORG_SUSPENDED', description: 'Organization access suspended' },
            { action: 'ORG_ACTIVATED', description: 'Organization reactivated' },
            { action: 'SETTINGS_UPDATED', description: 'System settings modified' },
            { action: 'USER_SUSPENDED', description: 'User account suspended' },
          ].map(({ action, description }) => {
            const icon = getActionIcon(action);
            return (
              <div key={action} className="flex items-start gap-2 text-sm">
                <Icon name={icon.name} className={`w-4 h-4 mt-0.5 ${icon.color}`} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-slate-100">
                    {getActionLabel(action)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlatformAuditLogs;
