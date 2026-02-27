import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import EmailTemplatesManager from '../../../components/ui/EmailTemplatesManager';
import CandidateNotesTimeline from '../../../components/ui/CandidateNotesTimeline';
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
import {
  ORGANIZATION_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../../constants/realtimeFeedEvents.js';
import {
  COMPANY_APPLICATION_DATE_PRESET_FILTER_OPTIONS,
  COMPANY_APPLICATION_JOB_STATE_FILTER_OPTIONS,
  COMPANY_APPLICATION_REVIEW_STATE_FILTER_OPTIONS,
  COMPANY_APPLICATION_SORT_FILTER_OPTIONS,
  COMPANY_APPLICATION_STATUS_FILTER_OPTIONS,
  DEFAULT_COMPANY_APPLICATION_FILTERS,
  buildCompanyApplicationFilterOptions,
  countActiveCompanyFilters,
  filterCompanyApplications,
  getDerivedApplicationStatus,
} from '../utils/companyApplicationFilters.js';

const formatDate = (dateInput) => {
  if (!dateInput) return 'N/A';
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString();
};

const getStatusConfig = (application = {}) => {
  const derivedStatus = getDerivedApplicationStatus(application);
  const configs = {
    SUBMITTED: {
      label: 'Submitted',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
    SCREENING: {
      label: 'Screening',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    },
    INTERVIEWING: {
      label: 'Interviewing',
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    },
    SHORTLISTED: {
      label: 'Shortlisted',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
    REJECTED: {
      label: 'Not Selected',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    },
    WITHDRAWN: {
      label: 'Withdrew',
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    },
    POSITION_CLOSED: {
      label: 'Position Closed',
      className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    },
    HIRED: {
      label: 'Hired',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    },
    UNKNOWN: {
      label: 'Unknown',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    },
  };
  return configs[derivedStatus] || configs.UNKNOWN;
};

const BULK_STATUS_OPTIONS = [
  { value: 'SCREENING', label: 'Move to Screening' },
  { value: 'SHORTLISTED', label: 'Shortlist' },
  { value: 'INTERVIEWING', label: 'Move to Interviewing' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'HIRED', label: 'Mark as Hired' },
];

const exportCandidatesCSV = (candidates) => {
  const headers = ['Name', 'Email', 'Job Title', 'Status', 'Experience', 'Skills', 'Applied Date'];
  const rows = candidates.map((c) => [
    c.candidate?.fullName || '',
    c.candidate?.email || '',
    c.job?.title || '',
    getDerivedApplicationStatus(c),
    c.candidate?.experienceLevel || '',
    (c.candidate?.skills || []).join('; '),
    new Date(c.submittedAt || c.createdAt || '').toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `candidates_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const CandidateManager = () => {
  const { organization } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_COMPANY_APPLICATION_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadDataRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [showEmailComposer, setShowEmailComposer] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_COMPANY_APPLICATION_FILTERS);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load applications (which include candidate info)
      const [applicationsResult, jobsResult] = await Promise.all([
        apiClient.applications.getOrganizationApplications(),
        apiClient.jobs.getOrganizationJobs(),
      ]);

      if (applicationsResult.success) {
        setCandidates(applicationsResult.applications || []);
      }

      if (jobsResult.success) {
        setJobs(jobsResult.jobs || []);
      }
    } catch {
      // Silent failure — table stays empty; user can refresh
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
    eventTypes: combineRealtimeEventTypes(
      ORGANIZATION_FEED_EVENTS.jobs,
      ORGANIZATION_FEED_EVENTS.applications,
      ORGANIZATION_FEED_EVENTS.pipeline,
    ),
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

  const handleViewDetails = async (application) => {
    setSelectedCandidate(application);
    setShowEmailComposer(false);
    setShowDetails(true);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (pageCandidates) => {
    const pageIds = pageCandidates.map((c) => c.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatusValue || selectedIds.size === 0) return;
    setBulkUpdating(true);
    setBulkError(null);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) => apiClient.applications.updateStatus(id, bulkStatusValue))
      );
      setSelectedIds(new Set());
      setBulkStatusValue('');
      await loadData();
    } catch (err) {
      setBulkError(err.message || 'Bulk update failed');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkExport = () => {
    const toExport = selectedIds.size > 0
      ? filteredCandidates.filter((c) => selectedIds.has(c.id))
      : filteredCandidates;
    exportCandidatesCSV(toExport);
  };

  const filteredCandidates = useMemo(
    () => filterCompanyApplications(candidates, filters),
    [candidates, filters],
  );

  const {
    jobOptions,
    companyOptions,
    employmentTypeOptions,
    dispositionOptions,
  } = useMemo(
    () => buildCompanyApplicationFilterOptions(candidates, jobs),
    [candidates, jobs],
  );

  const activeFilterCount = useMemo(
    () => countActiveCompanyFilters(filters),
    [filters],
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  if (loading) {
    return (
      <LoadingState
        title="Loading candidates"
        message="Gathering pipeline and candidate details."
        variant="card"
        tone="secondary"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Candidate Pipeline ({filteredCandidates.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="flex items-center gap-2"
          >
            <Icon name="RefreshCw" className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <UnifiedFilterPanel
          title="Candidate Filters"
          description="Search and segment candidates by role, status, job state, review progress, and application date."
          activeCount={activeFilterCount}
          onClear={clearFilters}
          headerActions={(
            <UnifiedFilterToggleButton
              active={showAdvancedFilters}
              onClick={() => setShowAdvancedFilters((previous) => !previous)}
              label={showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            />
          )}
        >
          <div className={FILTER_GRID_CLASS}>
            <UnifiedSearchField
              label="Search"
              className="sm:col-span-2 xl:col-span-3"
              type="text"
              placeholder="Candidate, role, outcome, location, or notes"
              value={filters.searchQuery}
              onChange={(event) => updateFilter('searchQuery', event.target.value)}
            />
            <UnifiedFilterSelect
              label="Status"
              value={filters.statusFilter}
              onChange={(value) => updateFilter('statusFilter', value)}
              options={COMPANY_APPLICATION_STATUS_FILTER_OPTIONS}
              placeholder="All statuses"
            />
          </div>

          {showAdvancedFilters && (
            <div className={FILTER_SUBPANEL_CLASS}>
              <div className={FILTER_GRID_CLASS}>
                <UnifiedFilterSelect
                  label="Job Role"
                  value={filters.jobFilter}
                  onChange={(value) => updateFilter('jobFilter', value)}
                  options={jobOptions}
                  placeholder="All roles"
                />
                <UnifiedFilterSelect
                  label="Company"
                  value={filters.companyFilter}
                  onChange={(value) => updateFilter('companyFilter', value)}
                  options={companyOptions}
                  placeholder="All companies"
                />
                <UnifiedFilterSelect
                  label="Employment Type"
                  value={filters.employmentTypeFilter}
                  onChange={(value) => updateFilter('employmentTypeFilter', value)}
                  options={employmentTypeOptions}
                  placeholder="All employment types"
                />
                <UnifiedFilterSelect
                  label="Outcome"
                  value={filters.dispositionFilter}
                  onChange={(value) => updateFilter('dispositionFilter', value)}
                  options={dispositionOptions}
                  placeholder="All outcomes"
                />
                <UnifiedFilterSelect
                  label="Review State"
                  value={filters.reviewStateFilter}
                  onChange={(value) => updateFilter('reviewStateFilter', value)}
                  options={COMPANY_APPLICATION_REVIEW_STATE_FILTER_OPTIONS}
                  placeholder="All review states"
                />
                <UnifiedFilterSelect
                  label="Job State"
                  value={filters.jobStateFilter}
                  onChange={(value) => updateFilter('jobStateFilter', value)}
                  options={COMPANY_APPLICATION_JOB_STATE_FILTER_OPTIONS}
                  placeholder="All job states"
                />
                <UnifiedFilterSelect
                  label="Date Range"
                  value={filters.datePreset}
                  onChange={(value) => {
                    setFilters((previous) => ({
                      ...previous,
                      datePreset: value,
                      ...(value === 'custom' ? {} : { appliedFrom: '', appliedTo: '' }),
                    }));
                  }}
                  options={COMPANY_APPLICATION_DATE_PRESET_FILTER_OPTIONS}
                  placeholder="All dates"
                />
                <UnifiedFilterSelect
                  label="Sort By"
                  value={filters.sortBy}
                  onChange={(value) => updateFilter('sortBy', value)}
                  options={COMPANY_APPLICATION_SORT_FILTER_OPTIONS}
                  placeholder="Latest activity"
                />
              </div>

              {filters.datePreset === 'custom' && (
                <div className={FILTER_DATE_GRID_CLASS}>
                  <UnifiedFilterField label="Applied From">
                    <UnifiedTextInput
                      type="date"
                      value={filters.appliedFrom}
                      onChange={(event) => updateFilter('appliedFrom', event.target.value)}
                    />
                  </UnifiedFilterField>
                  <UnifiedFilterField label="Applied To">
                    <UnifiedTextInput
                      type="date"
                      value={filters.appliedTo}
                      onChange={(event) => updateFilter('appliedTo', event.target.value)}
                    />
                  </UnifiedFilterField>
                </div>
              )}
            </div>
          )}
        </UnifiedFilterPanel>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 p-3 flex flex-wrap items-center gap-3 shadow-sm"
        >
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {selectedIds.size} selected
          </span>
          <select
            value={bulkStatusValue}
            onChange={(e) => setBulkStatusValue(e.target.value)}
            className="flex-1 min-w-[160px] text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Change status...</option>
            {BULK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="primary"
            onClick={handleBulkStatusUpdate}
            disabled={!bulkStatusValue || bulkUpdating}
            loading={bulkUpdating}
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            iconName="Download"
            onClick={handleBulkExport}
          >
            Export CSV
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
          >
            Clear
          </button>
          {bulkError && <p className="text-xs text-red-600 dark:text-red-400 w-full">{bulkError}</p>}
        </motion.div>
      )}

      {/* Candidates List */}
      {filteredCandidates.length === 0 ? (
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
          <div className="text-center py-12">
            <Icon name="Users" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-slate-400">
              No candidates match the selected filters
            </p>
            <Button variant="outline" onClick={clearFilters} className="mt-4">
              Clear Filters
            </Button>
          </div>
        </div>
      ) : (
        <>
        {/* Select All row */}
        <div className="flex items-center gap-2 px-1 mb-1">
          <input
            type="checkbox"
            checked={paginatedCandidates.length > 0 && paginatedCandidates.every((c) => selectedIds.has(c.id))}
            onChange={() => toggleSelectAll(paginatedCandidates)}
            className="w-4 h-4 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Select all on this page
          </span>
          <Button
            size="sm"
            variant="ghost"
            iconName="Download"
            onClick={handleBulkExport}
            className="ml-auto text-xs text-gray-500 dark:text-slate-400"
          >
            Export All
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {paginatedCandidates.map((candidate, index) => {
            const statusConfig = getStatusConfig(candidate);
            const isSelected = selectedIds.has(candidate.id);

            return (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl border bg-white dark:bg-slate-900/50 p-4 hover:shadow-md transition-shadow ${
                  isSelected
                    ? 'border-blue-400 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-900/10'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(candidate.id)}
                        className="w-4 h-4 mt-1 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                        <Icon name="User" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {candidate.candidate?.fullName || candidate.candidate?.email || 'Unknown Candidate'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                          {candidate.job?.title || 'Position'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
                        {statusConfig.label}
                      </div>
                      
                      {candidate.candidate?.experienceLevel && (
                        <div className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300">
                          {candidate.candidate.experienceLevel}
                        </div>
                      )}

                      {candidate.candidate?.skills && candidate.candidate.skills.length > 0 && (
                        <div className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300">
                          {candidate.candidate.skills.length} skills
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-gray-500 dark:text-slate-500 flex flex-wrap gap-3">
                      <span>Applied {formatDate(candidate.submittedAt || candidate.createdAt)}</span>
                      {candidate.reviewedAt && <span>Reviewed {formatDate(candidate.reviewedAt)}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(candidate)}
                      className="min-w-[100px]"
                    >
                      <Icon name="Eye" className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 mt-6">
            <div className="text-sm text-gray-600 dark:text-slate-400">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCandidates.length)} of {filteredCandidates.length} candidates
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-full"
              >
                <Icon name="ChevronLeft" size={16} />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[40px] h-10 px-3 rounded-full text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
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
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full"
              >
                Next
                <Icon name="ChevronRight" size={16} />
              </Button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Details Modal - Rendered outside section using Portal */}
      {showDetails && selectedCandidate && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {showDetails && selectedCandidate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowDetails(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full my-8"
              >
              {/* Modal Header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Icon name="User" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                      {selectedCandidate.candidate?.fullName || 'Candidate Profile'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {selectedCandidate.candidate?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <Icon name="X" className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Position Applied For
                    </h3>
                    <p className="text-base text-gray-900 dark:text-slate-100">
                      {selectedCandidate.job?.title}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Status
                    </h3>
                    {(() => {
                      const statusConfig = getStatusConfig(selectedCandidate);
                      return (
                        <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusConfig.className}`}>
                          {statusConfig.label}
                        </div>
                      );
                    })()}
                  </div>

                  {selectedCandidate.candidate?.experienceLevel && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Experience Level
                      </h3>
                      <p className="text-base text-gray-900 dark:text-slate-100">
                        {selectedCandidate.candidate.experienceLevel}
                      </p>
                    </div>
                  )}

                  {selectedCandidate.candidate?.location && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Location
                      </h3>
                      <p className="text-base text-gray-900 dark:text-slate-100">
                        {selectedCandidate.candidate.location}
                      </p>
                    </div>
                  )}

                  {selectedCandidate.submittedAt && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Application Date
                      </h3>
                      <p className="text-base text-gray-900 dark:text-slate-100">
                        {formatDate(selectedCandidate.submittedAt || selectedCandidate.createdAt)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Educational Background */}
                {(selectedCandidate.candidate?.highestQualification || selectedCandidate.candidate?.fieldOfStudy || selectedCandidate.candidate?.institutionName) && (
                  <div className="rounded-lg border border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="GraduationCap" className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Educational Background
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {selectedCandidate.candidate?.highestQualification && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Qualification: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.highestQualification}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.fieldOfStudy && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Field: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.fieldOfStudy}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.institutionName && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Institution: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.institutionName}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.graduationYear && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Graduation: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.graduationYear}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Job Preferences */}
                {(selectedCandidate.candidate?.availability || selectedCandidate.candidate?.preferredWorkType || selectedCandidate.candidate?.expectedSalary) && (
                  <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="Briefcase" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Job Preferences
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {selectedCandidate.candidate?.availability && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Availability: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.availability}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.preferredWorkType && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Work Type: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.preferredWorkType}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.preferredEmploymentType && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Employment: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.preferredEmploymentType}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.expectedSalary && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Expected Salary: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.expectedSalary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Professional Links */}
                {(selectedCandidate.candidate?.linkedinUrl || selectedCandidate.candidate?.githubUrl || selectedCandidate.candidate?.portfolioUrl) && (
                  <div className="rounded-lg border border-sky-100 dark:border-sky-900/30 bg-sky-50/50 dark:bg-sky-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="Link" className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Professional Links
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.candidate?.linkedinUrl && (
                        <a
                          href={selectedCandidate.candidate.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          <Icon name="Linkedin" className="w-3.5 h-3.5" />
                          LinkedIn
                        </a>
                      )}
                      {selectedCandidate.candidate?.githubUrl && (
                        <a
                          href={selectedCandidate.candidate.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Icon name="Github" className="w-3.5 h-3.5" />
                          GitHub
                        </a>
                      )}
                      {selectedCandidate.candidate?.portfolioUrl && (
                        <a
                          href={selectedCandidate.candidate.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                        >
                          <Icon name="Globe" className="w-3.5 h-3.5" />
                          Portfolio
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {selectedCandidate.candidate?.certifications && selectedCandidate.candidate.certifications.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Certifications
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.candidate.certifications.map((cert, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-sm text-amber-700 dark:text-amber-300"
                        >
                          {cert}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Skills */}
                {selectedCandidate.job?.skills && selectedCandidate.job.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Key Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.job.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 rounded-full border border-blue-100 text-xs text-blue-600 dark:border-blue-500/30 dark:text-blue-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Candidate Skills */}
                {selectedCandidate.candidate?.skills && selectedCandidate.candidate.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Candidate Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.candidate.skills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-sm text-blue-700 dark:text-blue-300"
                        >
                          {skill}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resume */}
                {selectedCandidate.resumeUrl && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Resume
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const resumeUrl = await apiClient.uploads.getDownloadUrl(selectedCandidate.resumeUrl);
                        if (!resumeUrl) return;
                        window.open(resumeUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <Icon name="FileText" className="w-4 h-4 mr-2" />
                      View Resume
                    </Button>
                  </div>
                )}

                {/* Cover Letter */}
                {selectedCandidate.coverLetter && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Cover Letter
                    </h3>
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                        {selectedCandidate.coverLetter}
                      </p>
                    </div>
                  </div>
                )}

                {/* Application Questions */}
                {selectedCandidate.answers && selectedCandidate.answers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Application Responses
                    </h3>
                    <div className="space-y-3">
                      {selectedCandidate.answers.map((answer, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700"
                        >
                          <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                            Question {idx + 1}
                          </p>
                          <p className="text-sm text-gray-900 dark:text-slate-100">
                            {answer.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Candidate Notes & Activity Timeline */}
              <div className="px-6 pb-2">
                <CandidateNotesTimeline
                  applicationId={selectedCandidate.id}
                  candidateName={selectedCandidate.candidate?.fullName || selectedCandidate.candidate?.email}
                  applicationStatus={getDerivedApplicationStatus(selectedCandidate)}
                />
              </div>

              {/* Email Composer (inline, toggled) */}
              {showEmailComposer && (
                <div className="px-6 pb-4">
                  <EmailTemplatesManager candidate={selectedCandidate.candidate} />
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={() => { setShowDetails(false); setShowEmailComposer(false); }}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEmailComposer((v) => !v)}
                  className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300"
                >
                  <Icon name="Mail" className="w-4 h-4 mr-2" />
                  {showEmailComposer ? 'Hide Email' : 'Send Email'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      ) : null}
    </div>
  );
};

export default CandidateManager;
