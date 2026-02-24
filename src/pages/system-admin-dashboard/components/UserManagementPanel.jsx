import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import LoadingState from '../../../components/ui/LoadingState';
import UnifiedFilterPanel, {
  FILTER_DATE_GRID_CLASS,
  FILTER_GRID_CLASS,
  UnifiedFilterField,
  UnifiedFilterSelect,
  UnifiedSearchField,
  UnifiedTextInput,
} from '../../../components/ui/UnifiedFilterPanel';
import { useToast } from '../../../components/ui/Toast.jsx';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import { ADMIN_FEED_EVENTS } from '../../../constants/realtimeFeedEvents.js';
import {
  ADMIN_DATE_PRESET_FILTER_OPTIONS,
  ADMIN_USER_ACCOUNT_TYPE_FILTER_OPTIONS,
  ADMIN_USER_EMAIL_DOMAIN_FILTER_OPTIONS,
  ADMIN_USER_ORGANIZATION_PRESENCE_FILTER_OPTIONS,
  ADMIN_USER_SORT_FILTER_OPTIONS,
  ADMIN_USER_STATUS_FILTER_OPTIONS,
  ADMIN_USER_SUSPENSION_FILTER_OPTIONS,
  DEFAULT_ADMIN_USER_FILTERS,
  buildAdminUserFilterOptions,
  countActiveAdminUserFilters,
  filterAdminUsers,
} from '../utils/adminDashboardFilters.js';

const PAGE_SIZE = 25;
const FETCH_BATCH_SIZE = 250;
const MAX_FETCH_PAGES = 20;

const statusBadgeClass = (status) => {
  const normalized = (status || 'ACTIVE').toString().toUpperCase();
  if (normalized === 'SUSPENDED') {
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
};

const accountTypeBadgeClass = (accountType) => {
  const normalized = (accountType || '').toString().toUpperCase();
  if (normalized === 'SYSTEM_ADMIN') {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  }
  if (normalized === 'COMPANY') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-slate-700/70 dark:text-slate-200';
};

const UserManagementPanel = () => {
  const { success: showSuccessToast, error: showErrorToast, warning: showWarningToast } = useToast();
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_ADMIN_USER_FILTERS);
  const [page, setPage] = useState(1);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [suspensionModal, setSuspensionModal] = useState({ open: false, user: null, reason: '' });
  const [promoteConfirmUser, setPromoteConfirmUser] = useState(null);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadUsersRef = useRef(null);

  const loadUsers = useCallback(async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const aggregated = [];
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      let pageCounter = 0;

      while (aggregated.length < total && pageCounter < MAX_FETCH_PAGES) {
        const result = await apiClient.admin.listUsers({
          limit: FETCH_BATCH_SIZE,
          offset,
        });

        if (!result?.success) {
          throw new Error('Failed to load users.');
        }

        const chunk = Array.isArray(result.users) ? result.users : [];
        aggregated.push(...chunk);

        const nextTotal = Number(result.total);
        total = Number.isFinite(nextTotal) ? nextTotal : aggregated.length;

        if (!result.hasMore || chunk.length === 0) {
          break;
        }

        offset += FETCH_BATCH_SIZE;
        pageCounter += 1;
      }

      const deduped = Array.from(
        new Map(aggregated.filter((user) => user?.id).map((user) => [user.id, user])).values(),
      );

      setAllUsers(deduped);
    } catch (error) {
      showErrorToast(error?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showErrorToast]);

  useEffect(() => {
    loadUsers({ showLoader: true });
  }, [loadUsers]);

  useEffect(() => {
    loadUsersRef.current = loadUsers;
  }, [loadUsers]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    eventTypes: ADMIN_FEED_EVENTS.users,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadUsersRef.current?.({ showLoader: false });
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
    () => buildAdminUserFilterOptions(allUsers),
    [allUsers],
  );

  const filteredUsers = useMemo(
    () => filterAdminUsers(allUsers, filters),
    [allUsers, filters],
  );

  const activeFilterCount = useMemo(
    () => countActiveAdminUserFilters(filters),
    [filters],
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalFiltered = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageStartIndex = (page - 1) * PAGE_SIZE;
  const paginatedUsers = useMemo(
    () => filteredUsers.slice(pageStartIndex, pageStartIndex + PAGE_SIZE),
    [filteredUsers, pageStartIndex],
  );

  const clearFilters = () => {
    setFilters(DEFAULT_ADMIN_USER_FILTERS);
  };

  const handleChangeStatus = (user, nextStatus) => {
    if (!user?.id || actionLoadingId) return;
    if (nextStatus === 'SUSPENDED') {
      setSuspensionModal({ open: true, user, reason: '' });
    } else {
      confirmChangeStatus(user, nextStatus, '');
    }
  };

  const confirmChangeStatus = async (user, nextStatus, reason) => {
    try {
      setActionLoadingId(user.id);
      const result = await apiClient.admin.updateUserStatus(user.id, {
        status: nextStatus,
        reason: reason || undefined,
      });
      if (!result?.success) {
        throw new Error('Failed to update user status.');
      }
      showSuccessToast(nextStatus === 'SUSPENDED' ? 'User suspended successfully.' : 'User reactivated successfully.');
      await loadUsers({ showLoader: false });
    } catch (error) {
      showErrorToast(error?.message || 'Failed to update user status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmSuspension = () => {
    const { user, reason } = suspensionModal;
    if (reason.trim().length < 8) {
      showWarningToast('Please provide at least 8 characters for the suspension reason.');
      return;
    }
    setSuspensionModal({ open: false, user: null, reason: '' });
    confirmChangeStatus(user, 'SUSPENDED', reason.trim());
  };

  const handlePromoteToAdmin = (user) => {
    if (!user?.id || actionLoadingId) return;
    setPromoteConfirmUser(user);
  };

  const confirmPromoteToAdmin = async () => {
    const user = promoteConfirmUser;
    setPromoteConfirmUser(null);
    try {
      setActionLoadingId(user.id);
      const result = await apiClient.admin.promoteToSystemAdmin(user.id);
      if (!result?.success) {
        throw new Error('Failed to promote user.');
      }
      showSuccessToast('User promoted to system admin.');
      await loadUsers({ showLoader: false });
    } catch (error) {
      showErrorToast(error?.message || 'Failed to promote user.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading && allUsers.length === 0) {
    return (
      <LoadingState
        title="Loading users"
        message="Retrieving platform user directory."
        variant="card"
        tone="secondary"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
              User Directory
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Showing {totalFiltered} filtered users from {allUsers.length} total accounts.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadUsers({ showLoader: false })} disabled={refreshing}>
            <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <UnifiedFilterPanel
          className="mt-4"
          title="User Filters"
          description="Filter users by account type, status, organization mapping, domain, and account creation date."
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
              placeholder="Name, email, organization, or id"
            />
            <UnifiedFilterSelect
              label="Account Type"
              value={filters.accountTypeFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, accountTypeFilter: value }))}
              options={ADMIN_USER_ACCOUNT_TYPE_FILTER_OPTIONS}
              placeholder="All account types"
            />
            <UnifiedFilterSelect
              label="Account Status"
              value={filters.statusFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, statusFilter: value }))}
              options={ADMIN_USER_STATUS_FILTER_OPTIONS}
              placeholder="All statuses"
            />
            <UnifiedFilterSelect
              label="Organization Presence"
              value={filters.organizationPresenceFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, organizationPresenceFilter: value }))}
              options={ADMIN_USER_ORGANIZATION_PRESENCE_FILTER_OPTIONS}
              placeholder="All"
            />
            <UnifiedFilterSelect
              label="Organization Status"
              value={filters.organizationStatusFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, organizationStatusFilter: value }))}
              options={filterOptions.organizationStatusOptions}
              placeholder="All organization statuses"
            />
            <UnifiedFilterSelect
              label="Email Domain"
              value={filters.emailDomainFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, emailDomainFilter: value }))}
              options={ADMIN_USER_EMAIL_DOMAIN_FILTER_OPTIONS}
              placeholder="Any domain"
            />
            <UnifiedFilterSelect
              label="Suspension"
              value={filters.suspensionFilter}
              onChange={(value) => setFilters((prev) => ({ ...prev, suspensionFilter: value }))}
              options={ADMIN_USER_SUSPENSION_FILTER_OPTIONS}
              placeholder="All suspension states"
            />
            <UnifiedFilterSelect
              label="Created Date"
              value={filters.createdDatePreset}
              onChange={(value) => setFilters((prev) => ({ ...prev, createdDatePreset: value }))}
              options={ADMIN_DATE_PRESET_FILTER_OPTIONS}
              placeholder="All dates"
            />
            <UnifiedFilterSelect
              label="Sort By"
              value={filters.sortBy}
              onChange={(value) => setFilters((prev) => ({ ...prev, sortBy: value }))}
              options={ADMIN_USER_SORT_FILTER_OPTIONS}
              placeholder="Sort users"
            />
          </div>

          {filters.createdDatePreset === 'custom' && (
            <div className={FILTER_DATE_GRID_CLASS}>
              <UnifiedFilterField label="Created From">
                <UnifiedTextInput
                  type="date"
                  value={filters.createdFrom}
                  onChange={(event) => setFilters((prev) => ({ ...prev, createdFrom: event.target.value }))}
                />
              </UnifiedFilterField>
              <UnifiedFilterField label="Created To">
                <UnifiedTextInput
                  type="date"
                  value={filters.createdTo}
                  onChange={(event) => setFilters((prev) => ({ ...prev, createdTo: event.target.value }))}
                />
              </UnifiedFilterField>
            </div>
          )}
        </UnifiedFilterPanel>
      </div>

      <div className="space-y-3">
        {paginatedUsers.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-6 text-center">
            <Icon name="Users" className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-slate-400">No users match the selected filters.</p>
          </div>
        ) : (
          paginatedUsers.map((user) => {
            const normalizedStatus = (user.accountStatus || 'ACTIVE').toUpperCase();
            const isSuspended = normalizedStatus === 'SUSPENDED';
            const isSystemAdmin = (user.accountType || '').toUpperCase() === 'SYSTEM_ADMIN';
            const isBusy = actionLoadingId === user.id;

            return (
              <div
                key={user.id}
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {user.fullName || 'Unnamed User'}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${accountTypeBadgeClass(user.accountType)}`}>
                        {(user.accountType || 'UNKNOWN').toString().replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(user.accountStatus)}`}>
                        {normalizedStatus}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 break-all">{user.email || 'No email'}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
                      Organization: {user.organization?.name || 'None'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isSuspended ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handleChangeStatus(user, 'ACTIVE')}
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                      >
                        <Icon name="PlayCircle" className="w-4 h-4 mr-2" />
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy || isSystemAdmin}
                        onClick={() => handleChangeStatus(user, 'SUSPENDED')}
                        className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                      >
                        <Icon name="PauseCircle" className="w-4 h-4 mr-2" />
                        Suspend
                      </Button>
                    )}

                    {!isSystemAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handlePromoteToAdmin(user)}
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20"
                      >
                        <Icon name="Shield" className="w-4 h-4 mr-2" />
                        Promote
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-slate-500">
          Showing {totalFiltered === 0 ? 0 : pageStartIndex + 1}-{Math.min(pageStartIndex + paginatedUsers.length, totalFiltered)} of {totalFiltered}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            Previous
          </Button>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      {suspensionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <Icon name="ShieldOff" size={18} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Suspend user</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">{suspensionModal.user?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Suspension reason <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 font-normal ml-1">(minimum 8 characters)</span>
              </label>
              <textarea
                value={suspensionModal.reason}
                onChange={(e) => setSuspensionModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain why this account is being suspended..."
                rows={3}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 dark:placeholder:text-slate-400 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSuspensionModal({ open: false, user: null, reason: '' })}>
                Cancel
              </Button>
              <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white border-none" onClick={handleConfirmSuspension}>
                Suspend User
              </Button>
            </div>
          </div>
        </div>
      )}

      {promoteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <Icon name="ShieldCheck" size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Promote to System Admin?</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">{promoteConfirmUser?.email || promoteConfirmUser?.fullName}</p>
              </div>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
              This grants full platform administrative access. This action cannot be undone from the UI.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPromoteConfirmUser(null)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-none" onClick={confirmPromoteToAdmin}>
                Promote
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPanel;
