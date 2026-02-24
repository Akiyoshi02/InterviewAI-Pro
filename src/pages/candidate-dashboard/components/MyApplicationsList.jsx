import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import LoadingState from '../../../components/ui/LoadingState';
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
import { CANDIDATE_FEED_EVENTS } from '../../../constants/realtimeFeedEvents.js';
import { getDispositionLabel } from '../../../constants/applicationDisposition.js';
import {
  APPLICATION_DATE_PRESET_FILTER_OPTIONS,
  APPLICATION_JOB_STATE_FILTER_OPTIONS,
  APPLICATION_REVIEW_STATE_FILTER_OPTIONS,
  APPLICATION_SORT_FILTER_OPTIONS,
  APPLICATION_STATUS_FILTER_OPTIONS,
  APPLICATION_WITHDRAWAL_FILTER_OPTIONS,
  DEFAULT_CANDIDATE_APPLICATION_FILTERS,
  buildCandidateApplicationFilterOptions,
  canCandidateWithdrawApplication,
  countActiveCandidateFilters,
  filterCandidateApplications,
  getDerivedApplicationStatus,
  groupCandidateApplicationsByJob,
} from '../utils/candidateApplicationFilters.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper function to convert relative upload paths to absolute URLs
const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  // Convert relative path to absolute URL
  const base = API_URL.replace(/\/$/, '');
  return `${base}${logoPath.startsWith('/') ? logoPath : `/${logoPath}`}`;
};

// Helper to format dates
const formatDate = (dateInput) => {
  if (!dateInput) return 'N/A';
  let date;
  if (dateInput.toDate) { // Firestore Timestamp
    date = dateInput.toDate();
  } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    date = new Date(dateInput);
  } else {
    return 'N/A';
  }

  if (isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString();
};

// Helper to format employment type
const formatEmploymentType = (type) => {
  if (!type) return 'N/A';
  const formatted = type.replace(/_/g, ' ').toLowerCase();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const getStatusConfig = (application = {}) => {
  const derivedStatus = getDerivedApplicationStatus(application);
  if (derivedStatus === 'WITHDRAWN') {
    return {
      label: 'Withdrew',
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      icon: 'XCircle',
    };
  }
  if (derivedStatus === 'POSITION_CLOSED') {
    return {
      label: 'Position Closed',
      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      icon: 'Archive',
    };
  }

  const configs = {
    SUBMITTED: {
      label: 'Submitted',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: 'Send',
    },
    SCREENING: {
      label: 'Under Review',
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: 'Eye',
    },
    INTERVIEWING: {
      label: 'Interviewing',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      icon: 'Video',
    },
    SHORTLISTED: {
      label: 'Shortlisted',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: 'Star',
    },
    REJECTED: {
      label: 'Not Selected',
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      icon: 'XCircle',
    },
    HIRED: {
      label: 'Hired',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: 'CheckCircle',
    },
    UNKNOWN: {
      label: 'Unknown',
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      icon: 'HelpCircle',
    },
  };
  return configs[derivedStatus] || configs.UNKNOWN;
};

const MyApplicationsList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(DEFAULT_CANDIDATE_APPLICATION_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState({ open: false, applicationId: null });
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState('');
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadApplicationsRef = useRef(null);

  useEffect(() => {
    loadApplications();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_CANDIDATE_APPLICATION_FILTERS);
  };

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.applications.getMyApplications();
      if (result.success) {
        const apps = result.applications || [];
        setApplications(apps);
        // Auto-expand first job by default
        if (apps.length > 0) {
          const firstJobId = apps[0]?.job?.id;
          if (firstJobId) {
            setExpandedJobs(new Set([firstJobId]));
          }
        }
      } else {
        setError('Failed to load applications');
      }
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplicationsRef.current = loadApplications;
  }, [loadApplications]);

  useRealtimePathFeed({
    path: user?.id ? `candidateFeeds/${user.id}` : null,
    enabled: Boolean(user?.id),
    eventTypes: CANDIDATE_FEED_EVENTS.applications,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadApplicationsRef.current?.();
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

  const handleWithdrawClick = (applicationId) => {
    setWithdrawDialog({ open: true, applicationId });
  };

  const handleWithdrawConfirm = async () => {
    if (!withdrawDialog.applicationId) return;

    setIsWithdrawing(true);
    try {
      const result = await apiClient.applications.withdraw(withdrawDialog.applicationId);
      if (result.success) {
        setWithdrawDialog({ open: false, applicationId: null });
        setWithdrawSuccess('Application withdrawn successfully.');
        setTimeout(() => setWithdrawSuccess(''), 4000);
        loadApplications();
      } else {
        throw new Error(result.error || 'Failed to withdraw application');
      }
    } catch (err) {
      setWithdrawDialog({ open: false, applicationId: null });
      setError(err.message || 'Failed to withdraw application. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleWithdrawCancel = () => {
    setWithdrawDialog({ open: false, applicationId: null });
  };

  const toggleJob = (jobId) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const filteredApplications = useMemo(
    () => filterCandidateApplications(applications, filters),
    [applications, filters],
  );

  const groupedApplications = useMemo(
    () => groupCandidateApplicationsByJob(filteredApplications, { sortBy: filters.sortBy }),
    [filteredApplications, filters.sortBy],
  );

  const {
    companyOptions,
    employmentTypeOptions,
    dispositionOptions,
  } = useMemo(() => buildCandidateApplicationFilterOptions(applications), [applications]);

  const activeFilterCount = useMemo(
    () => countActiveCandidateFilters(filters),
    [filters],
  );

  useEffect(() => {
    setExpandedJobs((previous) => {
      const visibleJobIds = groupedApplications.map((group) => group.jobId);
      const visibleLookup = new Set(visibleJobIds);
      const next = new Set([...previous].filter((jobId) => visibleLookup.has(jobId)));

      if (next.size === 0 && visibleJobIds.length > 0) {
        next.add(visibleJobIds[0]);
      }

      const previousIds = [...previous];
      const nextIds = [...next];
      const unchanged = previousIds.length === nextIds.length
        && previousIds.every((jobId, index) => jobId === nextIds[index]);

      return unchanged ? previous : next;
    });
  }, [groupedApplications]);

  if (loading) {
    return (
      <LoadingState
        title="Loading applications"
        message="Refreshing your application status updates."
        variant="card"
        tone="primary"
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-gray-900 dark:text-slate-100 mb-4">{error}</p>
          <Button onClick={loadApplications}>Retry</Button>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 inline-flex mb-4">
            <Icon name="FileText" className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
            No Applications Yet
          </h3>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            Start applying to jobs to see your application status here.
          </p>
          <Button onClick={() => navigate('/jobs')} className="bg-blue-600 hover:bg-blue-700">
            <Icon name="Search" className="w-4 h-4 mr-2" />
            Browse Jobs
          </Button>
        </div>
      </div>
    );
  }

  const totalApplicationsCount = groupedApplications.reduce((sum, jobData) => sum + jobData.filteredCount, 0);
  const totalJobsCount = groupedApplications.length;

  // Pagination calculations
  const jobsArray = groupedApplications;
  const totalPages = Math.ceil(jobsArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = jobsArray.slice(startIndex, endIndex);

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-6 shadow-lg">
      {withdrawSuccess && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {withdrawSuccess}
        </div>
      )}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              My Applications
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {totalApplicationsCount} {totalApplicationsCount === 1 ? 'application' : 'applications'} to {totalJobsCount} {totalJobsCount === 1 ? 'position' : 'positions'}
            </p>
            {activeFilterCount > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Filtered view enabled
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadApplications}
            className="flex items-center gap-2"
          >
            <Icon name="RefreshCw" className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <UnifiedFilterPanel
          title="Application Filters"
          description="Narrow applications by status, company, outcome, review state, and submission timeline."
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
              placeholder="Role, company, location, status, or outcome"
              value={filters.searchQuery}
              onChange={(event) => updateFilter('searchQuery', event.target.value)}
            />
            <UnifiedFilterSelect
              label="Status"
              value={filters.statusFilter}
              onChange={(value) => updateFilter('statusFilter', value)}
              options={APPLICATION_STATUS_FILTER_OPTIONS}
              placeholder="All statuses"
            />
          </div>

          {showAdvancedFilters && (
            <div className={FILTER_SUBPANEL_CLASS}>
              <div className={FILTER_GRID_CLASS}>
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
                  label="Job State"
                  value={filters.jobStateFilter}
                  onChange={(value) => updateFilter('jobStateFilter', value)}
                  options={APPLICATION_JOB_STATE_FILTER_OPTIONS}
                  placeholder="All job states"
                />
                <UnifiedFilterSelect
                  label="Review State"
                  value={filters.reviewStateFilter}
                  onChange={(value) => updateFilter('reviewStateFilter', value)}
                  options={APPLICATION_REVIEW_STATE_FILTER_OPTIONS}
                  placeholder="All review states"
                />
                <UnifiedFilterSelect
                  label="Withdrawal State"
                  value={filters.withdrawalFilter}
                  onChange={(value) => updateFilter('withdrawalFilter', value)}
                  options={APPLICATION_WITHDRAWAL_FILTER_OPTIONS}
                  placeholder="All withdrawal states"
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
                  options={APPLICATION_DATE_PRESET_FILTER_OPTIONS}
                  placeholder="All dates"
                />
                <UnifiedFilterSelect
                  label="Sort By"
                  value={filters.sortBy}
                  onChange={(value) => updateFilter('sortBy', value)}
                  options={APPLICATION_SORT_FILTER_OPTIONS}
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

        {/* Job Groups */}
        <div className="space-y-4">
          {groupedApplications.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-3 rounded-full bg-gray-100 dark:bg-slate-800 inline-flex mb-4">
                <Icon name="Search" className="w-8 h-8 text-gray-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                No applications found
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                Try adjusting your search or filter criteria.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
                <Button onClick={() => navigate('/jobs')} className="bg-blue-600 hover:bg-blue-700">
                  <Icon name="Search" className="w-4 h-4 mr-2" />
                  Browse Jobs
                </Button>
              </div>
            </div>
          ) : (
            <>
            {paginatedJobs.map((jobData, index) => {
              const jobId = jobData.jobId;
              const isExpanded = expandedJobs.has(jobId);
              const latestApplication = jobData.applications[0]; // Most recent application
              const statusConfig = getStatusConfig(latestApplication);
              
              return (
                <motion.div
                  key={jobId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden"
                >
                  {/* Job Header */}
                  <button
                    onClick={() => toggleJob(jobId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Company Logo or Briefcase Icon */}
                      {jobData.organization?.logo && getLogoUrl(jobData.organization.logo) ? (
                        <img
                          src={getLogoUrl(jobData.organization.logo)}
                          alt={jobData.organization.name || 'Company logo'}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain p-1 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0 ${jobData.organization?.logo && getLogoUrl(jobData.organization.logo) ? 'hidden' : 'flex'}`}
                      >
                        <Icon name="Briefcase" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {jobData.job?.title || 'Deleted Position'}
                          </h3>
                          {jobData.job?.isDeleted && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200 text-xs font-medium shrink-0">
                              Deleted
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                          {jobData.organization?.name || 'Company'}
                          {jobData.job?.location && ` - ${jobData.job.location}`}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-3 ml-4">
                      <div className={`hidden sm:flex px-2.5 py-1 rounded-full text-xs font-medium items-center gap-1.5 ${statusConfig.color}`}>
                        <Icon name={statusConfig.icon} className="w-3 h-3" />
                        {statusConfig.label}
                      </div>
                      <Icon 
                        name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                        className="w-5 h-5 text-gray-400 dark:text-slate-500 transition-transform" 
                      />
                    </div>
                  </button>

                  {/* Expanded Application Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-200 dark:border-slate-700"
                      >
                        <div className="p-4 space-y-4 bg-gray-50/50 dark:bg-slate-800/30">
                          {jobData.applications.map((application, appIndex) => {
                            const appStatusConfig = getStatusConfig(application);
                            const canWithdraw = canCandidateWithdrawApplication(application);
                            
                            return (
                              <motion.div
                                key={application.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: appIndex * 0.03 }}
                                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                              >
                                <div className="space-y-3">
                                  {/* Status and Date */}
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${appStatusConfig.color}`}>
                                        <Icon name={appStatusConfig.icon} className="w-3 h-3" />
                                        {appStatusConfig.label}
                                      </div>
                                      {jobData.applications.length > 1 && (
                                        <span className="text-xs text-gray-500 dark:text-slate-500">
                                          Application #{jobData.applications.length - appIndex}
                                        </span>
                                      )}
                                    </div>
                                    {canWithdraw && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleWithdrawClick(application.id)}
                                        disabled={isWithdrawing}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 text-xs"
                                      >
                                        <Icon name="XCircle" className="w-3 h-3 mr-1" />
                                        Withdraw
                                      </Button>
                                    )}
                                  </div>

                                  {application.dispositionCode && (
                                    <div className="text-xs text-gray-600 dark:text-slate-400">
                                      Reason: {getDispositionLabel(application.dispositionCode)}
                                      {application.dispositionReason ? ` - ${application.dispositionReason}` : ''}
                                    </div>
                                  )}
                                  {application.dispositionNotes && (
                                    <div className="text-xs text-gray-600 dark:text-slate-400">
                                      Note: {application.dispositionNotes}
                                    </div>
                                  )}

                                  {/* Job Details */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    {jobData.job?.department && (
                                      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                                        <Icon name="Building" className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{jobData.job.department}</span>
                                      </div>
                                    )}
                                    {jobData.job?.employmentType && (
                                      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                                        <Icon name="Clock" className="w-4 h-4 shrink-0" />
                                        <span>{formatEmploymentType(jobData.job.employmentType)}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                                      <Icon name="Calendar" className="w-4 h-4 shrink-0" />
                                      <span>Applied {formatDate(application.submittedAt || application.createdAt)}</span>
                                    </div>
                                    {application.reviewedAt && (
                                      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                                        <Icon name="Eye" className="w-4 h-4 shrink-0" />
                                        <span>Reviewed {formatDate(application.reviewedAt)}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Cover Letter Excerpt */}
                                  {application.coverLetter && (
                                    <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                                      <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                                        Cover Letter (excerpt):
                                      </p>
                                      <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">
                                        {application.coverLetter}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 mt-6">
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  Showing {startIndex + 1} to {Math.min(endIndex, jobsArray.length)} of {jobsArray.length} positions
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
        </div>
      </div>

      {/* Withdraw Confirmation Dialog */}
      <ConfirmDialog
        open={withdrawDialog.open}
        onClose={handleWithdrawCancel}
        onConfirm={handleWithdrawConfirm}
        title="Withdraw Application"
        message="Are you sure you want to withdraw this application? This action cannot be undone."
        confirmText="Withdraw"
        cancelText="Cancel"
        variant="danger"
        loading={isWithdrawing}
      />
    </div>
  );
};

export default MyApplicationsList;

