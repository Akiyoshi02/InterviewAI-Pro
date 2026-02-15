import React, { useEffect, useMemo, useRef, useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import UnifiedFilterPanel, {
  FILTER_DATE_GRID_CLASS,
  FILTER_GRID_CLASS,
  FILTER_SUBPANEL_CLASS,
  UnifiedFilterField,
  UnifiedFilterSelect,
  UnifiedFilterToggleButton,
  UnifiedSearchField,
  UnifiedTextInput,
} from '../../../components/ui/UnifiedFilterPanel';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import { ORGANIZATION_FEED_EVENTS } from '../../../constants/realtimeFeedEvents.js';
import {
  DEFAULT_INVITATION_FILTERS,
  INVITATION_CANDIDATE_LINK_FILTER_OPTIONS,
  INVITATION_DATE_PRESET_FILTER_OPTIONS,
  INVITATION_LIFECYCLE_FILTER_OPTIONS,
  INVITATION_LIFECYCLE_LABELS,
  INVITATION_SORT_FILTER_OPTIONS,
  INVITATION_STATUS_FILTER_OPTIONS,
  INVITATION_STATUS_LABELS,
  buildInvitationFilterOptions,
  countActiveInvitationFilters,
  filterInvitations,
} from '../utils/invitationFilters.js';

const stageOptions = [
  { value: 'SCREENING', label: 'AI Screening' },
  { value: 'INTERVIEW', label: 'Live Interview' },
  { value: 'FINAL', label: 'Final Review' },
];

const getStatusBadgeClass = (status) => {
  const statusCode = String(status || '').toUpperCase();
  if (statusCode === 'PENDING') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200';
  }
  if (statusCode === 'ACCEPTED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200';
  }
  if (statusCode === 'EXPIRED') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200';
  }
  if (statusCode === 'REVOKED') {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200';
  }
  return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200';
};

const getLifecycleBadgeClass = (lifecycleState) => {
  const stateCode = String(lifecycleState || '').toUpperCase();
  if (stateCode === 'AWAITING_CANDIDATE') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200';
  }
  if (stateCode === 'IN_PROGRESS') {
    return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200';
  }
  if (stateCode === 'ACCEPTED_WITH_INTERVIEW') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200';
  }
  if (stateCode === 'ACCEPTED_WITHOUT_INTERVIEW') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200';
  }
  if (stateCode === 'EXPIRED') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200';
  }
  if (stateCode === 'REVOKED') {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200';
  }
  return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200';
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return '-';
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const InvitationManager = ({ onRefresh }) => {
  const { organization } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    jobId: '',
    email: '',
    stage: 'SCREENING',
  });
  const [filters, setFilters] = useState(DEFAULT_INVITATION_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadDataRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [jobsRes, invitesRes] = await Promise.all([
        apiClient.jobs.list(),
        apiClient.invitations.list(),
      ]);

      if (jobsRes.success) {
        const nextJobs = jobsRes.jobs || [];
        setJobs(nextJobs);
        setForm((previous) => {
          const currentJobStillExists = previous.jobId && nextJobs.some((job) => job.id === previous.jobId);
          if (currentJobStillExists) return previous;
          return {
            ...previous,
            jobId: nextJobs[0]?.id || '',
          };
        });
      }

      if (invitesRes.success) {
        setInvitations(invitesRes.invitations || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useRealtimePathFeed({
    path: organization?.id ? `organizationFeeds/${organization.id}` : null,
    enabled: Boolean(organization?.id),
    eventTypes: ORGANIZATION_FEED_EVENTS.invitations,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadDataRef.current?.();
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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (onRefresh) {
      onRefresh(loadData);
    }
  }, [onRefresh]);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_INVITATION_FILTERS);
    setShowAdvancedFilters(false);
  };

  const activeFilterCount = useMemo(
    () => countActiveInvitationFilters(filters),
    [filters],
  );

  const invitationFilterOptions = useMemo(
    () => buildInvitationFilterOptions(invitations, jobs),
    [invitations, jobs],
  );

  const filteredInvitationMetas = useMemo(
    () => filterInvitations(invitations, filters, { jobs }),
    [invitations, filters, jobs],
  );

  const jobSelectOptions = useMemo(
    () => jobs.map((job) => ({ value: job.id, label: job.title || job.id })),
    [jobs],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(filteredInvitationMetas.length / itemsPerPage);
  const safePage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvitationMetas = filteredInvitationMetas.slice(startIndex, endIndex);

  useEffect(() => {
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.jobId || !form.email) {
      setError('Job and candidate email are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setStatusMessage('');

    try {
      const result = await apiClient.invitations.create({
        jobId: form.jobId,
        email: form.email.trim(),
        stage: form.stage,
      });

      if (result.success) {
        setInvitations((previous) => [result.invitation, ...previous]);
        setForm((previous) => ({ ...previous, email: '' }));
        setStatusMessage('Invitation sent successfully.');
      } else {
        setError(result.error || 'Failed to send invitation.');
      }
    } catch (err) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      {statusMessage && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs sm:text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <form className="grid gap-3 md:grid-cols-3 items-end mb-4" onSubmit={handleSubmit}>
        <Select
          label="Job"
          options={jobSelectOptions}
          value={form.jobId}
          onChange={(value) => setForm((previous) => ({ ...previous, jobId: value }))}
          loading={loading}
          placeholder="Select job"
        />
        <Input
          label="Candidate Email"
          type="email"
          placeholder="candidate@example.com"
          value={form.email}
          onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
        />
        <Select
          label="Stage"
          options={stageOptions}
          value={form.stage}
          onChange={(value) => setForm((previous) => ({ ...previous, stage: value }))}
        />
        <div className="md:col-span-3">
          <Button
            type="submit"
            fullWidth
            disabled={submitting || !form.jobId || !form.email}
            className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
          >
            {submitting ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
      </form>

      <UnifiedFilterPanel
        className="mb-4"
        title="Invitation Filters"
        description={`Filter sent invitations by recipient, role, status, lifecycle, candidate linkage, and date windows. Showing ${filteredInvitationMetas.length} of ${invitations.length}.`}
        activeCount={activeFilterCount}
        onClear={clearFilters}
        headerActions={(
          <UnifiedFilterToggleButton
            active={showAdvancedFilters}
            onClick={() => setShowAdvancedFilters((previous) => !previous)}
            label="Advanced Filters"
          />
        )}
      >
        <div className={FILTER_GRID_CLASS}>
          <UnifiedSearchField
            label="Search"
            className="sm:col-span-2 xl:col-span-2"
            type="text"
            value={filters.searchQuery}
            onChange={(event) => updateFilter('searchQuery', event.target.value)}
            placeholder="Email, job, stage, status, candidate, or inviter"
          />
          <UnifiedFilterSelect
            label="Status"
            value={filters.statusFilter}
            onChange={(value) => updateFilter('statusFilter', value)}
            options={INVITATION_STATUS_FILTER_OPTIONS}
          />
          <UnifiedFilterSelect
            label="Job"
            value={filters.jobFilter}
            onChange={(value) => updateFilter('jobFilter', value)}
            options={invitationFilterOptions.jobOptions}
          />
        </div>
        {showAdvancedFilters && (
          <div className={FILTER_SUBPANEL_CLASS}>
            <div className={FILTER_GRID_CLASS}>
              <UnifiedFilterSelect
                label="Stage"
                value={filters.stageFilter}
                onChange={(value) => updateFilter('stageFilter', value)}
                options={invitationFilterOptions.stageOptions}
              />
              <UnifiedFilterSelect
                label="Lifecycle"
                value={filters.lifecycleFilter}
                onChange={(value) => updateFilter('lifecycleFilter', value)}
                options={INVITATION_LIFECYCLE_FILTER_OPTIONS}
              />
              <UnifiedFilterSelect
                label="Candidate Link"
                value={filters.candidateLinkFilter}
                onChange={(value) => updateFilter('candidateLinkFilter', value)}
                options={INVITATION_CANDIDATE_LINK_FILTER_OPTIONS}
              />
              <UnifiedFilterSelect
                label="Sent Date"
                value={filters.datePreset}
                onChange={(value) => {
                  setFilters((previous) => ({
                    ...previous,
                    datePreset: value,
                    ...(value === 'custom' ? {} : { sentFrom: '', sentTo: '' }),
                  }));
                }}
                options={INVITATION_DATE_PRESET_FILTER_OPTIONS}
              />
              <UnifiedFilterSelect
                label="Sort By"
                value={filters.sortBy}
                onChange={(value) => updateFilter('sortBy', value)}
                options={INVITATION_SORT_FILTER_OPTIONS}
              />
            </div>
            {filters.datePreset === 'custom' && (
              <div className={FILTER_DATE_GRID_CLASS}>
                <UnifiedFilterField label="Sent From">
                  <UnifiedTextInput
                    type="date"
                    value={filters.sentFrom}
                    onChange={(event) => updateFilter('sentFrom', event.target.value)}
                  />
                </UnifiedFilterField>
                <UnifiedFilterField label="Sent To">
                  <UnifiedTextInput
                    type="date"
                    value={filters.sentTo}
                    onChange={(event) => updateFilter('sentTo', event.target.value)}
                  />
                </UnifiedFilterField>
              </div>
            )}
          </div>
        )}
      </UnifiedFilterPanel>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-slate-400 uppercase tracking-wide text-xs border-b border-white/30 dark:border-slate-700">
              <th className="pb-2 py-2">Email</th>
              <th className="pb-2 py-2">Job</th>
              <th className="pb-2 py-2">Stage</th>
              <th className="pb-2 py-2">Status</th>
              <th className="pb-2 py-2">Lifecycle</th>
              <th className="pb-2 py-2">Sent</th>
              <th className="pb-2 py-2">Expires</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvitationMetas.map((meta) => (
              <tr key={meta.invitation.id} className="border-b border-white/30 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors duration-200">
                <td className="py-3 text-gray-900 dark:text-slate-100">
                  {meta.invitation.email || '-'}
                </td>
                <td className="py-3 text-gray-500 dark:text-slate-300">
                  <div className="flex flex-col">
                    <span className="text-gray-800 dark:text-slate-100 font-medium">{meta.jobTitle}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{meta.jobId || '-'}</span>
                  </div>
                </td>
                <td className="py-3">
                  <span className="inline-flex items-center rounded-full border border-blue-100 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
                    {meta.stageLabel}
                  </span>
                </td>
                <td className="py-3">
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(meta.effectiveStatus)}`}>
                    {INVITATION_STATUS_LABELS[meta.effectiveStatus] || meta.effectiveStatus}
                  </span>
                </td>
                <td className="py-3">
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${getLifecycleBadgeClass(meta.lifecycleState)}`}>
                    {INVITATION_LIFECYCLE_LABELS[meta.lifecycleState] || meta.lifecycleState}
                  </span>
                </td>
                <td className="py-3 text-xs text-gray-500 dark:text-slate-400">
                  {formatDateTime(meta.createdAtDate)}
                </td>
                <td className="py-3 text-xs text-gray-500 dark:text-slate-400">
                  {formatDateTime(meta.expiresAtDate)}
                </td>
              </tr>
            ))}
            {!filteredInvitationMetas.length && (
              <tr>
                <td className="py-4 text-sm text-gray-500 dark:text-slate-400" colSpan={7}>
                  {loading
                    ? 'Loading invitations...'
                    : (activeFilterCount > 0
                      ? 'No invitations match the selected filters.'
                      : 'No invitations sent yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 mt-6">
          <div className="text-sm text-gray-600 dark:text-slate-400">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredInvitationMetas.length)} of {filteredInvitationMetas.length} invitations
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
              disabled={safePage === 1}
              className="rounded-full"
            >
              <Icon name="ChevronLeft" size={16} />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => {
                if (
                  page === 1
                  || page === totalPages
                  || (page >= safePage - 1 && page <= safePage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[40px] h-10 px-3 rounded-full text-sm font-medium transition-colors ${
                        safePage === page
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                }
                if (page === safePage - 2 || page === safePage + 2) {
                  return (
                    <span key={page} className="text-gray-500 dark:text-slate-500 px-1">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={safePage === totalPages}
              className="rounded-full"
            >
              Next
              <Icon name="ChevronRight" size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationManager;

