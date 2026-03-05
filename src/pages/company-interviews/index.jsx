import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import InterviewCalendar from '../../components/ui/InterviewCalendar';
import ScheduleInterviewModal from '../../components/ui/ScheduleInterviewModal';
import InterviewScorecard from '../../components/ui/InterviewScorecard';
import UnifiedFilterPanel, {
  FILTER_DATE_GRID_CLASS,
  FILTER_GRID_CLASS,
  FILTER_SUBPANEL_CLASS,
  UnifiedFilterSelect,
  UnifiedFilterToggleButton,
  UnifiedSearchField,
  UnifiedTextInput,
} from '../../components/ui/UnifiedFilterPanel';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useInterviewRealtimeFeed } from '../../hooks/useInterviewRealtimeFeed';
import {
  INTERVIEW_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../constants/realtimeFeedEvents.js';

const COMPANY_INTERVIEW_DATE_PRESET_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const COMPANY_INTERVIEW_SCHEDULE_OPTIONS = [
  { value: 'all', label: 'All Schedule States' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'past', label: 'Past' },
  { value: 'unscheduled', label: 'Unscheduled' },
];

const COMPANY_INTERVIEW_SCORE_OPTIONS = [
  { value: 'all', label: 'All Score Bands' },
  { value: 'scored', label: 'Scored Interviews' },
  { value: 'unscored', label: 'No Score Yet' },
  { value: '80+', label: '80 and Above' },
  { value: '60-79', label: '60 to 79' },
  { value: '<60', label: 'Below 60' },
];

const COMPANY_INTERVIEW_SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'scheduledSoon', label: 'Scheduled Soonest' },
  { value: 'candidateAsc', label: 'Candidate Name (A-Z)' },
  { value: 'scoreDesc', label: 'Highest Score' },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DEFAULT_COMPANY_INTERVIEW_FILTERS = {
  searchQuery: '',
  statusFilter: 'all',
  jobRoleFilter: 'all',
  scheduleFilter: 'all',
  scoreFilter: 'all',
  datePreset: 'all',
  from: '',
  to: '',
  sortBy: 'recent',
};

const normalizeFilterText = (value) => (value || '').toString().trim().toLowerCase();

const getCompanyInterviewDateWindow = (filters = {}) => {
  const preset = normalizeFilterText(filters.datePreset || 'all');
  if (preset === 'all') return { from: null, to: null };
  if (preset === 'custom') {
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;
    if (from && !Number.isNaN(from.getTime())) from.setHours(0, 0, 0, 0);
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
    return {
      from: from && !Number.isNaN(from.getTime()) ? from : null,
      to: to && !Number.isNaN(to.getTime()) ? to : null,
    };
  }
  const from = new Date();
  if (preset === 'last7') from.setDate(from.getDate() - 7);
  if (preset === 'last30') from.setDate(from.getDate() - 30);
  if (preset === 'last90') from.setDate(from.getDate() - 90);
  from.setHours(0, 0, 0, 0);
  return { from, to: null };
};

const countActiveCompanyInterviewFilters = (filters = {}) => {
  let count = 0;
  if (normalizeFilterText(filters.searchQuery)) count += 1;
  if ((filters.statusFilter || 'all') !== 'all') count += 1;
  if ((filters.jobRoleFilter || 'all') !== 'all') count += 1;
  if ((filters.scheduleFilter || 'all') !== 'all') count += 1;
  if ((filters.scoreFilter || 'all') !== 'all') count += 1;
  if ((filters.datePreset || 'all') !== 'all') count += 1;
  if ((filters.sortBy || 'recent') !== 'recent') count += 1;
  return count;
};

const getPendingRescheduleRequest = (interview) => {
  if (!interview) return null;
  if (interview.pendingRescheduleRequest) return interview.pendingRescheduleRequest;
  if (!Array.isArray(interview.rescheduleRequests)) return null;
  for (let index = interview.rescheduleRequests.length - 1; index >= 0; index -= 1) {
    const request = interview.rescheduleRequests[index];
    if ((request?.status || '').toUpperCase() === 'PENDING') {
      return request;
    }
  }
  return null;
};

const decodeHtmlEntities = (value) => {
  if (typeof value !== 'string') return value || '';
  if (!value.includes('&')) return value;
  if (typeof document === 'undefined') return value;
  const decoder = document.createElement('textarea');
  decoder.innerHTML = value;
  return decoder.value;
};

const getCandidateProfileImage = (candidate) => {
  const possibleValues = [
    candidate?.profilePhotoUrl,
    candidate?.photoURL,
    candidate?.avatarUrl,
    candidate?.avatar,
    candidate?.imageUrl,
    candidate?.profileImage,
    candidate?.profile?.photoURL,
    candidate?.profile?.photoUrl,
    candidate?.profile?.imageUrl,
  ];
  const match = possibleValues.find((entry) => typeof entry === 'string' && entry.trim());
  return match ? match.trim() : null;
};

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.toLowerCase().startsWith('uploads/')) return `/${trimmed}`;
  return '';
};

const buildAssetSources = (value) => {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (
    trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('data:')
    || trimmed.startsWith('blob:')
  ) {
    return [trimmed];
  }

  const uploadsPath = normalizeUploadsPath(trimmed);
  if (uploadsPath) {
    const base = API_BASE_URL.replace(/\/$/, '');
    const sources = [];
    if (base) sources.push(`${base}${uploadsPath}`);
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== base) {
      sources.push(`${window.location.origin}${uploadsPath}`);
    }
    return sources;
  }

  return [trimmed];
};

const CompanyInterviews = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, status } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list | calendar
  const [scheduleModal, setScheduleModal] = useState(null); // { interview } | null
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(DEFAULT_COMPANY_INTERVIEW_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const [pendingRealtimeInterviewUpdates, setPendingRealtimeInterviewUpdates] = useState(0);
  const [rescheduleActionLoadingId, setRescheduleActionLoadingId] = useState(null);

  useEffect(() => {
    document.title = 'Interviews - InterviewAI Pro';
  }, []);

  const loadInterviews = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.interviews.getCompanyInterviews();
      if (result.success) {
        setInterviews(result.interviews || []);
        setPendingRealtimeInterviewUpdates(0);
      } else {
        setError(result.error || 'Failed to load interviews.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useInterviewRealtimeFeed({
    userId: user?.id,
    enabled: Boolean(user?.id),
    eventTypes: combineRealtimeEventTypes(
      INTERVIEW_FEED_EVENTS.lifecycle,
      INTERVIEW_FEED_EVENTS.pipeline,
      INTERVIEW_FEED_EVENTS.reviews,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      // Keep interview list stable while users are browsing/filtering.
      setPendingRealtimeInterviewUpdates((prev) => Math.min(prev + 1, 99));
    },
  });

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  useEffect(() => {
    const interviewId = new URLSearchParams(location.search).get('interviewId');
    if (!interviewId || interviews.length === 0) return;
    const interview = interviews.find((item) => item.id === interviewId);
    if (interview) {
      setSelectedInterview(interview);
      setShowDetails(true);
      const params = new URLSearchParams(location.search);
      params.delete('interviewId');
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : '',
          hash: location.hash,
        },
        { replace: true },
      );
    }
  }, [interviews, location.hash, location.pathname, location.search, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'Pending Scheduling', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700' },
      SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700' },
      IN_PROGRESS: { label: 'In Progress', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700' },
      COMPLETED: { label: 'Completed', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700' },
      CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
    };
    const config = statusConfig[status?.toUpperCase()] || {
      label: String(status || 'Unknown')
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_COMPANY_INTERVIEW_FILTERS);
    setShowAdvancedFilters(false);
  };

  const interviewFilterOptions = useMemo(
    () => ({
      jobRoleOptions: [
        { value: 'all', label: 'All Roles' },
        ...Array.from(
          new Set(
            interviews
              .map((interview) => interview?.jobRole)
              .map((value) => value?.toString?.().trim())
              .filter(Boolean),
          ),
        ).map((value) => ({ value, label: value })),
      ],
    }),
    [interviews],
  );

  const activeFilterCount = countActiveCompanyInterviewFilters(filters);

  const filteredInterviews = useMemo(
    () => {
      const interviewDateWindow = getCompanyInterviewDateWindow(filters);
      const searchTokens = normalizeFilterText(filters.searchQuery).split(' ').filter(Boolean);
      return interviews
        .filter((interview) => {
        const status = (interview?.status || '').toString().toUpperCase();
        const jobRole = (interview?.jobRole || '').toString();
        const scheduledDate = interview?.scheduledFor ? new Date(interview.scheduledFor) : null;
        const createdDate = interview?.createdAt ? new Date(interview.createdAt) : null;
        const primaryDate = scheduledDate && !Number.isNaN(scheduledDate.getTime())
          ? scheduledDate
          : (createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null);
        const score = Number(interview?.overallScore);
        const hasScore = Number.isFinite(score);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (filters.statusFilter !== 'all' && status !== filters.statusFilter) return false;
        if (filters.jobRoleFilter !== 'all' && jobRole !== filters.jobRoleFilter) return false;

        if (filters.scheduleFilter !== 'all') {
          if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
            if (filters.scheduleFilter !== 'unscheduled') return false;
          } else {
            if (filters.scheduleFilter === 'unscheduled') return false;
            if (filters.scheduleFilter === 'upcoming' && scheduledDate < now) return false;
            if (filters.scheduleFilter === 'past' && scheduledDate >= now) return false;
            if (filters.scheduleFilter === 'today' && (scheduledDate < startOfToday || scheduledDate > endOfToday)) return false;
          }
        }

        if (filters.scoreFilter === 'scored' && !hasScore) return false;
        if (filters.scoreFilter === 'unscored' && hasScore) return false;
        if (filters.scoreFilter === '80+' && !(hasScore && score >= 80)) return false;
        if (filters.scoreFilter === '60-79' && !(hasScore && score >= 60 && score < 80)) return false;
        if (filters.scoreFilter === '<60' && !(hasScore && score < 60)) return false;

        if (interviewDateWindow.from || interviewDateWindow.to) {
          if (!primaryDate) return false;
          if (interviewDateWindow.from && primaryDate < interviewDateWindow.from) return false;
          if (interviewDateWindow.to && primaryDate > interviewDateWindow.to) return false;
        }

        if (searchTokens.length) {
          const searchableText = [
            interview?.candidate?.fullName || '',
            interview?.candidate?.email || '',
            interview?.jobRole || '',
            interview?.status || '',
            interview?.pipelineStatus || '',
          ]
            .join(' ')
            .toLowerCase();
          if (!searchTokens.every((token) => searchableText.includes(token))) return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftScheduled = left?.scheduledFor ? new Date(left.scheduledFor).getTime() : 0;
        const rightScheduled = right?.scheduledFor ? new Date(right.scheduledFor).getTime() : 0;
        const leftCreated = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightCreated = right?.createdAt ? new Date(right.createdAt).getTime() : 0;

        if (filters.sortBy === 'oldest') return leftCreated - rightCreated;
        if (filters.sortBy === 'scheduledSoon') {
          if (!leftScheduled && !rightScheduled) return rightCreated - leftCreated;
          if (!leftScheduled) return 1;
          if (!rightScheduled) return -1;
          return leftScheduled - rightScheduled;
        }
        if (filters.sortBy === 'candidateAsc') {
          const leftName = left?.candidate?.fullName || left?.candidate?.email || '';
          const rightName = right?.candidate?.fullName || right?.candidate?.email || '';
          return leftName.localeCompare(rightName);
        }
        if (filters.sortBy === 'scoreDesc') return Number(right?.overallScore || 0) - Number(left?.overallScore || 0);
        return rightCreated - leftCreated;
      });
    },
    [filters, interviews],
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredInterviews.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInterviews = filteredInterviews.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleViewDetails = (interview) => {
    setSelectedInterview(interview);
    setShowDetails(true);
  };

  const handleRejectRescheduleRequest = async (interview) => {
    const pendingRequest = getPendingRescheduleRequest(interview);
    if (!interview?.id || !pendingRequest?.id) return;
    try {
      setRescheduleActionLoadingId(interview.id);
      setError('');
      await apiClient.interviews.rejectRescheduleRequest(interview.id, pendingRequest.id, {});
      await loadInterviews();
      if (selectedInterview?.id === interview.id) {
        setSelectedInterview((prev) => (prev ? { ...prev, pendingRescheduleRequest: null } : prev));
      }
    } catch (requestError) {
      setError(requestError?.message || 'Failed to reject reschedule request.');
    } finally {
      setRescheduleActionLoadingId(null);
    }
  };
  const selectedPendingRescheduleRequest = getPendingRescheduleRequest(selectedInterview);
  const selectedCandidateImageSources = useMemo(
    () => buildAssetSources(getCandidateProfileImage(selectedInterview?.candidate)),
    [selectedInterview],
  );
  const selectedCandidateImageSrc = selectedCandidateImageSources[0] || null;

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Loading interviews"
        message="Pulling the latest interview activity."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header 
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />
      
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <motion.section
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Icon name="Calendar" size={22} color="white" />
                  </div>
                  <div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Interviews
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Manage and review all interview sessions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon name="List" size={13} /> List
                    </button>
                    <button
                      onClick={() => setViewMode('calendar')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === 'calendar'
                          ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon name="CalendarDays" size={13} /> Calendar
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconName="RefreshCw"
                    onClick={loadInterviews}
                    disabled={loading}
                    className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Calendar View */}
              {viewMode === 'calendar' && (
                <InterviewCalendar
                  interviews={interviews}
                  userType="company"
                  onViewInterview={(iv) => {
                    // Scroll to list and highlight, or navigate
                    setViewMode('list');
                  }}
                />
              )}

              {pendingRealtimeInterviewUpdates > 0 && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Icon name="Bell" className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-300" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      {pendingRealtimeInterviewUpdates} new interview update{pendingRealtimeInterviewUpdates === 1 ? '' : 's'} available.
                      Refresh when you are ready.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadInterviews}
                    disabled={loading}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/20"
                  >
                    <Icon name="RefreshCw" size={14} className="mr-1.5" />
                    Refresh List
                  </Button>
                </div>
              )}

              {/* Filters */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <UnifiedFilterPanel
                  title="Interview Filters"
                  description="Refine interviews by candidate, role, status, scheduling state, score, and date range."
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
                      placeholder="Candidate name, email, role, status, or pipeline stage"
                    />
                    <UnifiedFilterSelect
                      label="Status"
                      value={filters.statusFilter}
                      onChange={(value) => updateFilter('statusFilter', value)}
                      options={[
                        { value: 'all', label: 'All Statuses' },
                        { value: 'PENDING', label: 'Pending Scheduling' },
                        { value: 'SCHEDULED', label: 'Scheduled' },
                        { value: 'IN_PROGRESS', label: 'In Progress' },
                        { value: 'COMPLETED', label: 'Completed' },
                        { value: 'CANCELLED', label: 'Cancelled' },
                      ]}
                    />
                    <UnifiedFilterSelect
                      label="Job Role"
                      value={filters.jobRoleFilter}
                      onChange={(value) => updateFilter('jobRoleFilter', value)}
                      options={interviewFilterOptions.jobRoleOptions}
                    />
                  </div>

                  {showAdvancedFilters && (
                    <div className={FILTER_SUBPANEL_CLASS}>
                      <div className={FILTER_GRID_CLASS}>
                        <UnifiedFilterSelect
                          label="Schedule State"
                          value={filters.scheduleFilter}
                          onChange={(value) => updateFilter('scheduleFilter', value)}
                          options={COMPANY_INTERVIEW_SCHEDULE_OPTIONS}
                        />
                        <UnifiedFilterSelect
                          label="Score Band"
                          value={filters.scoreFilter}
                          onChange={(value) => updateFilter('scoreFilter', value)}
                          options={COMPANY_INTERVIEW_SCORE_OPTIONS}
                        />
                        <UnifiedFilterSelect
                          label="Date Range"
                          value={filters.datePreset}
                          onChange={(value) => updateFilter('datePreset', value)}
                          options={COMPANY_INTERVIEW_DATE_PRESET_OPTIONS}
                        />
                        <UnifiedFilterSelect
                          label="Sort By"
                          value={filters.sortBy}
                          onChange={(value) => updateFilter('sortBy', value)}
                          options={COMPANY_INTERVIEW_SORT_OPTIONS}
                        />
                      </div>

                      {filters.datePreset === 'custom' && (
                        <div className={FILTER_DATE_GRID_CLASS}>
                          <label className="space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">From</span>
                            <UnifiedTextInput
                              type="date"
                              value={filters.from}
                              onChange={(event) => updateFilter('from', event.target.value)}
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">To</span>
                            <UnifiedTextInput
                              type="date"
                              value={filters.to}
                              onChange={(event) => updateFilter('to', event.target.value)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </UnifiedFilterPanel>
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                >
                  {error}
                </motion.div>
              )}

              {/* Interviews List */}
              {viewMode === 'calendar' ? null : loading ? (
                <LoadingState
                  title="Loading interviews"
                  message="Updating interview schedules and status."
                  variant="card"
                  tone="primary"
                />
              ) : filteredInterviews.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-8 text-center"
                >
                  <Icon name="FileText" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {activeFilterCount > 0
                      ? 'No interviews match your filters.' 
                      : 'No interviews found yet. Move candidates to Interviewing to auto-schedule sessions.'}
                  </p>
                </motion.div>
              ) : (
                <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2 sm:space-y-3"
                >
                  {paginatedInterviews.map((interview) => {
                    const pendingRescheduleRequest = getPendingRescheduleRequest(interview);
                    const candidateName = decodeHtmlEntities(
                      interview.candidate?.fullName || interview.candidate?.email || 'Unknown Candidate',
                    );
                    const candidateEmail = decodeHtmlEntities(interview.candidate?.email || '');
                    const roleLabel = decodeHtmlEntities(interview.jobRole || 'Position');
                    const candidateProfileImage = getCandidateProfileImage(interview.candidate);
                    const candidateProfileImageSources = buildAssetSources(candidateProfileImage);
                    const candidateProfileImageSrc = candidateProfileImageSources[0] || null;
                    return (
                      <div
                        key={interview.id}
                        className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 self-center">
                              {candidateProfileImageSrc && (
                                <img
                                  src={candidateProfileImageSrc}
                                  alt={candidateName}
                                  className="w-full h-full rounded-full object-cover border border-white/40 dark:border-slate-700/50"
                                  onError={(event) => {
                                    const nextIndex = Number.parseInt(
                                      event.currentTarget.dataset.fallbackIndex || '1',
                                      10,
                                    );
                                    if (
                                      Number.isInteger(nextIndex)
                                      && nextIndex >= 0
                                      && nextIndex < candidateProfileImageSources.length
                                    ) {
                                      event.currentTarget.dataset.fallbackIndex = String(nextIndex + 1);
                                      event.currentTarget.src = candidateProfileImageSources[nextIndex];
                                      return;
                                    }
                                    event.currentTarget.style.display = 'none';
                                    const fallback = event.currentTarget.nextElementSibling;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                  data-fallback-index="1"
                                />
                              )}
                              <div className={`w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-500 items-center justify-center text-white font-semibold text-sm sm:text-base ${candidateProfileImageSrc ? 'hidden' : 'flex'}`}>
                                {candidateName?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base truncate">
                                {candidateName}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate">
                                {candidateEmail}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-xs text-gray-600 dark:text-slate-300">
                                  {roleLabel}
                                </span>
                                {interview.scheduledFor && (
                                  <>
                                    <span className="text-gray-400">&middot;</span>
                                    <span className="text-xs text-gray-600 dark:text-slate-300">
                                      {new Date(interview.scheduledFor).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </div>
                              {pendingRescheduleRequest && (
                                <p className="mt-2 inline-flex items-center rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                                  Candidate requested reschedule
                                </p>
                              )}
                              {!pendingRescheduleRequest && interview.lastCandidateContact && (
                                <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                                  <Icon name="MessageCircle" size={12} />
                                  Candidate message
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {getStatusBadge(interview.status)}
                            {(interview.status === 'SCHEDULED' || interview.status === 'PENDING' || !interview.scheduledFor) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                iconName={interview.scheduledFor ? 'CalendarClock' : 'CalendarPlus'}
                                onClick={() => setScheduleModal({
                                  interview: {
                                    ...interview,
                                    pendingRescheduleRequest,
                                  },
                                })}
                                className="rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                title={interview.scheduledFor ? 'Reschedule' : 'Schedule'}
                              />
                            )}
                            {pendingRescheduleRequest && (
                              <Button
                                variant="ghost"
                                size="sm"
                                iconName="X"
                                onClick={() => handleRejectRescheduleRequest(interview)}
                                disabled={rescheduleActionLoadingId === interview.id}
                                className="rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                title="Reject request"
                              />
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(interview)}
                              className="rounded-full"
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 mt-6">
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredInterviews.length)} of {filteredInterviews.length} interviews
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

              {/* Stats Summary */}
              {!loading && interviews.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">
                        {interviews.length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {interviews.filter(i => i.status === 'PENDING').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                        {interviews.filter(i => i.status === 'SCHEDULED').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Scheduled</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        {interviews.filter(i => i.status === 'IN_PROGRESS').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">In Progress</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {interviews.filter(i => i.status === 'COMPLETED').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Completed</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.section>
          </main>
        </div>
      </div>

      {/* Interview Details Modal */}
      {showDetails && selectedInterview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDetails(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  Interview Details
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Icon name="X" className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Candidate</p>
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      {selectedCandidateImageSrc && (
                        <img
                          src={selectedCandidateImageSrc}
                          alt={decodeHtmlEntities(
                            selectedInterview.candidate?.fullName
                            || selectedInterview.candidate?.email
                            || 'Candidate',
                          )}
                          className="w-full h-full rounded-full object-cover border border-white/40 dark:border-slate-700/50"
                          onError={(event) => {
                            const nextIndex = Number.parseInt(
                              event.currentTarget.dataset.fallbackIndex || '1',
                              10,
                            );
                            if (
                              Number.isInteger(nextIndex)
                              && nextIndex >= 0
                              && nextIndex < selectedCandidateImageSources.length
                            ) {
                              event.currentTarget.dataset.fallbackIndex = String(nextIndex + 1);
                              event.currentTarget.src = selectedCandidateImageSources[nextIndex];
                              return;
                            }
                            event.currentTarget.style.display = 'none';
                            const fallback = event.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                          data-fallback-index="1"
                        />
                      )}
                      <div className={`w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-500 items-center justify-center text-white text-sm font-semibold ${selectedCandidateImageSrc ? 'hidden' : 'flex'}`}>
                        {decodeHtmlEntities(
                          selectedInterview.candidate?.fullName
                          || selectedInterview.candidate?.email
                          || '?',
                        ).charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                        {decodeHtmlEntities(
                          selectedInterview.candidate?.fullName
                          || selectedInterview.candidate?.email
                          || 'Unknown',
                        )}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                        {decodeHtmlEntities(selectedInterview.candidate?.email || '')}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Job Role</p>
                  <p className="font-medium text-gray-900 dark:text-slate-100">
                    {decodeHtmlEntities(selectedInterview.jobRole || 'Not specified')}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Status</p>
                  {getStatusBadge(selectedInterview.status)}
                </div>

                {selectedInterview.scheduledFor && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Scheduled For</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {new Date(selectedInterview.scheduledFor).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedPendingRescheduleRequest && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                      Candidate reschedule request
                    </p>
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      {selectedPendingRescheduleRequest.reason}
                    </p>
                    {Array.isArray(selectedPendingRescheduleRequest.preferredSlots)
                      && selectedPendingRescheduleRequest.preferredSlots.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.08em] text-amber-700/80 dark:text-amber-200/80">
                          Preferred Slots
                        </p>
                        {selectedPendingRescheduleRequest.preferredSlots.map((slot) => (
                          <p
                            key={slot}
                            className="text-sm text-amber-900 dark:text-amber-100"
                          >
                            {new Date(slot).toLocaleString()}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!selectedPendingRescheduleRequest && selectedInterview.lastCandidateContact && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Icon name="MessageCircle" size={14} className="text-blue-600 dark:text-blue-300" />
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                        Message from {selectedInterview.lastCandidateContact.candidateName || 'candidate'}
                      </p>
                    </div>
                    <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                      {selectedInterview.lastCandidateContact.message}
                    </p>
                    <p className="text-[11px] text-blue-600/70 dark:text-blue-300/60">
                      {new Date(selectedInterview.lastCandidateContact.sentAt).toLocaleString()}
                    </p>
                    {(selectedInterview.status === 'SCHEDULED' || selectedInterview.status === 'PENDING' || !selectedInterview.scheduledFor) && (
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="CalendarClock"
                        onClick={() => {
                          setShowDetails(false);
                          setScheduleModal({
                            interview: {
                              ...selectedInterview,
                              pendingRescheduleRequest: selectedPendingRescheduleRequest,
                            },
                          });
                        }}
                        className="mt-1 rounded-full border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                      >
                        Reschedule Interview
                      </Button>
                    )}
                  </div>
                )}

                {selectedInterview.createdAt && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Created</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {new Date(selectedInterview.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedInterview.endedAt && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Completed</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {new Date(selectedInterview.endedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedInterview.overallScore && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Overall Score</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {selectedInterview.overallScore}%
                    </p>
                  </div>
                )}

                {selectedInterview.invitationId && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Linked to Invitation</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                      {selectedInterview.invitationId}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                {selectedInterview.status === 'COMPLETED' && (
                  <div className="mb-4">
                    <InterviewScorecard
                      jobTitle={selectedInterview.jobRole}
                      onSubmit={(data) => console.log('Scorecard submitted:', data)}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  {(selectedInterview.status === 'SCHEDULED' || !selectedInterview.scheduledFor) && (
                    <Button
                      variant="outline"
                      size="sm"
                      iconName={selectedInterview.scheduledFor ? 'CalendarClock' : 'CalendarPlus'}
                      onClick={() => {
                        setShowDetails(false);
                        setScheduleModal({
                          interview: {
                            ...selectedInterview,
                            pendingRescheduleRequest: selectedPendingRescheduleRequest,
                          },
                        });
                      }}
                      className="flex-1"
                    >
                      {selectedPendingRescheduleRequest
                        ? 'Review & Reschedule'
                        : (selectedInterview.scheduledFor ? 'Reschedule' : 'Schedule')}
                    </Button>
                  )}
                  {selectedPendingRescheduleRequest && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="X"
                      onClick={() => handleRejectRescheduleRequest(selectedInterview)}
                      disabled={rescheduleActionLoadingId === selectedInterview.id}
                      className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
                      Reject Request
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Schedule / Reschedule Modal */}
      {scheduleModal && (
        <ScheduleInterviewModal
          interview={scheduleModal.interview}
          isOpen={true}
          onClose={() => setScheduleModal(null)}
          onScheduled={() => { setScheduleModal(null); loadInterviews(); }}
        />
      )}
    </div>
  );
};

export default CompanyInterviews;

