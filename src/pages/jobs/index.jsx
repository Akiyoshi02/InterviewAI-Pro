import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
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
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';
import { CANDIDATE_FEED_EVENTS, PUBLIC_FEED_EVENTS } from '../../constants/realtimeFeedEvents.js';
import JobApplicationForm from './components/JobApplicationForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const BOOKMARK_STORAGE_PREFIX = 'jobs-bookmarks';

const JOB_DATE_PRESET_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const JOB_BOOKMARK_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'saved', label: 'Saved Roles' },
  { value: 'unsaved', label: 'Unsaved Roles' },
];

const JOB_APPLICATION_FILTER_OPTIONS = [
  { value: 'all', label: 'All Application States' },
  { value: 'not-applied', label: 'Not Applied' },
  { value: 'applied', label: 'Applied' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'not-selected', label: 'Not Selected' },
  { value: 'can-reapply', label: 'Can Reapply' },
];

const JOB_LOCATION_MODE_OPTIONS = [
  { value: 'all', label: 'All Locations' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

const JOB_DEADLINE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Closing Windows' },
  { value: '7', label: 'Closing in 7 Days' },
  { value: '30', label: 'Closing in 30 Days' },
  { value: 'none', label: 'No Deadline' },
];

const JOB_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'closingSoon', label: 'Closing Soon' },
  { value: 'titleAsc', label: 'Role Name (A-Z)' },
  { value: 'companyAsc', label: 'Company (A-Z)' },
];

const DEFAULT_JOB_FILTERS = {
  searchQuery: '',
  bookmarkFilter: 'all',
  applicationFilter: 'all',
  employmentType: 'all',
  experienceLevel: 'all',
  department: 'all',
  locationMode: 'all',
  datePreset: 'all',
  postedFrom: '',
  postedTo: '',
  deadlineWindow: 'all',
  sortBy: 'newest',
};

const normalizeText = (value) => (value || '').toString().trim().toLowerCase();

const getDateWindow = (filters = {}) => {
  const now = new Date();
  const preset = normalizeText(filters.datePreset || 'all');
  if (preset === 'all') return { from: null, to: null };

  if (preset === 'custom') {
    const from = filters.postedFrom ? new Date(filters.postedFrom) : null;
    const to = filters.postedTo ? new Date(filters.postedTo) : null;
    if (from && !Number.isNaN(from.getTime())) from.setHours(0, 0, 0, 0);
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
    return {
      from: from && !Number.isNaN(from.getTime()) ? from : null,
      to: to && !Number.isNaN(to.getTime()) ? to : null,
    };
  }

  const from = new Date(now);
  if (preset === 'last7') from.setDate(from.getDate() - 7);
  if (preset === 'last30') from.setDate(from.getDate() - 30);
  if (preset === 'last90') from.setDate(from.getDate() - 90);
  from.setHours(0, 0, 0, 0);
  return { from, to: null };
};

const countActiveJobFilters = (filters = {}) => {
  let count = 0;
  if (normalizeText(filters.searchQuery)) count += 1;
  if ((filters.bookmarkFilter || 'all') !== 'all') count += 1;
  if ((filters.applicationFilter || 'all') !== 'all') count += 1;
  if ((filters.employmentType || 'all') !== 'all') count += 1;
  if ((filters.experienceLevel || 'all') !== 'all') count += 1;
  if ((filters.department || 'all') !== 'all') count += 1;
  if ((filters.locationMode || 'all') !== 'all') count += 1;
  if ((filters.datePreset || 'all') !== 'all') count += 1;
  if ((filters.deadlineWindow || 'all') !== 'all') count += 1;
  if ((filters.sortBy || 'newest') !== 'newest') count += 1;
  return count;
};

// Helper function to convert relative upload paths to absolute URLs
const getAssetUrl = (assetPath) => {
  if (!assetPath) return null;
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
    return assetPath;
  }
  // Convert relative path to absolute URL
  const base = API_URL.replace(/\/$/, '');
  return `${base}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
};

const parseBookmarkIds = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => String(id || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const JobsPage = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationJob, setApplicationJob] = useState(null);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [applicationsByJobId, setApplicationsByJobId] = useState(new Map()); // Map<jobId, {status, withdrawnBy}>
  const [pendingRealtimeJobUpdates, setPendingRealtimeJobUpdates] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jobsPerPage] = useState(12);
  const [bookmarkedJobIds, setBookmarkedJobIds] = useState(new Set());
  const [filters, setFilters] = useState(DEFAULT_JOB_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const applicationsRefreshTimeoutRef = useRef(null);
  const loadApplicationsRef = useRef(null);
  const bookmarkStorageKey = `${BOOKMARK_STORAGE_PREFIX}:${user?.id || user?.uid || 'guest'}`;
  
  const userType = user?.accountType?.toLowerCase() === 'company' ? 'company' : 'candidate';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiClient.jobs.listPublic(50);
      if (result.success) {
        setJobs(result.jobs || []);
        setPendingRealtimeJobUpdates(0);
      } else {
        setError('Failed to load jobs.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user's applications to check which jobs have been applied to and their status
  const loadApplications = async () => {
    if (user?.accountType?.toUpperCase() !== 'CANDIDATE') {
      setApplicationsByJobId(new Map());
      return;
    }
    try {
      const result = await apiClient.applications.getMyApplications();
      if (result.success && result.applications) {
        const applicationsMap = new Map();
        result.applications.forEach((app) => {
          if (app.jobId) {
            const existing = applicationsMap.get(app.jobId);
            const isWithdrawn = app.status === 'REJECTED' && app.withdrawnBy;
            const existingIsWithdrawn = existing?.status === 'REJECTED' && existing?.withdrawnBy;

            if (!existing || (!isWithdrawn && existingIsWithdrawn) || (isWithdrawn === existingIsWithdrawn)) {
              applicationsMap.set(app.jobId, {
                status: app.status,
                withdrawnBy: app.withdrawnBy || null,
              });
            }
          }
        });
        setApplicationsByJobId(applicationsMap);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    }
  };

  useEffect(() => {
    loadApplicationsRef.current = loadApplications;
  }, [loadApplications]);

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useRealtimePathFeed({
    path: 'publicFeeds/jobs',
    enabled: true,
    eventTypes: PUBLIC_FEED_EVENTS.jobs,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      // Keep browsing stable at scale; prompt user to refresh on demand.
      setPendingRealtimeJobUpdates((prev) => Math.min(prev + 1, 99));
    },
  });

  useRealtimePathFeed({
    path: user?.id ? `candidateFeeds/${user.id}` : null,
    enabled: Boolean(user?.id && user?.accountType?.toUpperCase() === 'CANDIDATE'),
    eventTypes: CANDIDATE_FEED_EVENTS.applications,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (applicationsRefreshTimeoutRef.current) {
        clearTimeout(applicationsRefreshTimeoutRef.current);
      }
      applicationsRefreshTimeoutRef.current = setTimeout(() => {
        loadApplicationsRef.current?.();
      }, 300);
    },
  });

  useEffect(
    () => () => {
      if (applicationsRefreshTimeoutRef.current) {
        clearTimeout(applicationsRefreshTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const savedBookmarks = parseBookmarkIds(localStorage.getItem(bookmarkStorageKey));
    setBookmarkedJobIds(new Set(savedBookmarks));
  }, [bookmarkStorageKey]);

  const handlePractice = (job) => {
    if (job) {
      try {
        const draft = JSON.parse(localStorage.getItem('interviewSetupDraft') || '{}');
        localStorage.setItem(
          'interviewSetupDraft',
          JSON.stringify({
            ...draft,
            jobRole: job.title,
            industry: job.department || draft.industry,
          }),
        );
      } catch {
        // ignore
      }
    }
    navigate('/practice-interview-setup');
  };

  const handleApply = (job) => {
    if (!job) return;
    
    // Only candidates can apply
    if (user?.accountType?.toUpperCase() !== 'CANDIDATE') {
      alert('Only candidates can apply to jobs.');
      return;
    }
    
    setApplicationJob(job);
    setShowApplicationForm(true);
  };

  const handleApplicationSuccess = async (application) => {
    setShowApplicationForm(false);
    setApplicationSuccess(true);
    // Update the application status for this job
    if (application?.jobId) {
      setApplicationsByJobId((prev) => {
        const newMap = new Map(prev);
        newMap.set(application.jobId, {
          status: application.status || 'SUBMITTED',
          withdrawnBy: application.withdrawnBy || null,
        });
        return newMap;
      });
    }
    
    if (user?.accountType?.toUpperCase() === 'CANDIDATE') {
      await loadApplicationsRef.current?.();
    }
    
    setTimeout(() => setApplicationSuccess(false), 5000);
  };

  // Format experience level for display
  const formatExperienceLevel = (level) => {
    if (!level) return null;
    const mapping = {
      'ENTRY': 'Entry Level',
      'JUNIOR': 'Junior',
      'MID': 'Mid-Level',
      'SENIOR': 'Senior',
      'LEAD': 'Lead',
      'PRINCIPAL': 'Principal',
      'EXECUTIVE': 'Executive'
    };
    return mapping[level] || level.charAt(0) + level.slice(1).toLowerCase();
  };

  // Format employment type for display
  const formatEmploymentType = (type) => {
    if (!type) return null;
    const mapping = {
      'FULL_TIME': 'Full-time',
      'PART_TIME': 'Part-time',
      'CONTRACT': 'Contract',
      'INTERNSHIP': 'Internship',
    };
    return mapping[type] || type.replace('_', '-').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Check if location should be shown as Remote (only when no location was provided)
  const shouldShowRemote = (location) => {
    // If location is null, undefined, or empty string, show Remote
    if (!location) return true;
    // If location is not a string, show Remote
    if (typeof location !== 'string') return true;
    // If location is empty after trimming or equals "Remote", show Remote
    const trimmed = location.trim();
    return trimmed === '' || trimmed === 'Remote';
  };

  // Get the actual location value to display
  const getDisplayLocation = (location) => {
    if (shouldShowRemote(location)) return 'Remote';
    return location.trim();
  };

  // Calculate days left for application based on expiresAt or publishedAt + postingDuration
  const getDaysLeft = (job) => {
    if (!job) return null;
    
    // If expiresAt is available, use it directly
    if (job.expiresAt) {
      const expires = new Date(job.expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) return null;
      return daysLeft;
    }
    
    // Fallback: calculate from publishedAt + postingDuration
    if (job.publishedAt) {
      const published = new Date(job.publishedAt);
      const now = new Date();
      const postingDuration = job.postingDuration || 30;
      const daysSincePublished = Math.floor((now - published) / (1000 * 60 * 60 * 24));
      const daysLeft = postingDuration - daysSincePublished;
      if (daysLeft <= 0) return null;
      return daysLeft;
    }
    
    return null;
  };

  // Handle bookmark toggle
  const handleBookmark = (jobId, e) => {
    e?.stopPropagation?.();
    if (!jobId) return;

    setBookmarkedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      localStorage.setItem(bookmarkStorageKey, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_JOB_FILTERS);
    setShowAdvancedFilters(false);
  };

  // Handle share
  const handleShare = (job, platform, e) => {
    e.stopPropagation();
    const jobUrl = `${window.location.origin}/jobs/${job.id}`;
    const shareText = `Check out this job: ${job.title} at ${job.organization?.name || 'Company'}`;
    
    let shareUrl = '';
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + jobUrl)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(jobUrl)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;
        break;
      case 'instagram':
        // Instagram doesn't support direct sharing via URL
        navigator.clipboard.writeText(jobUrl);
        alert('Job URL copied to clipboard!');
        return;
      default:
        // Native share or copy
        if (navigator.share) {
          navigator.share({
            title: job.title,
            text: shareText,
            url: jobUrl,
          });
          return;
        } else {
          navigator.clipboard.writeText(jobUrl);
          alert('Job URL copied to clipboard!');
          return;
        }
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  const filterOptions = {
    employmentTypeOptions: [
      { value: 'all', label: 'All Employment Types' },
      ...Array.from(
        new Set(
          jobs
            .map((job) => job?.employmentType)
            .map((value) => value?.toString?.().trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: formatEmploymentType(value) })),
    ],
    experienceLevelOptions: [
      { value: 'all', label: 'All Experience Levels' },
      ...Array.from(
        new Set(
          jobs
            .map((job) => job?.experienceLevel)
            .map((value) => value?.toString?.().trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: formatExperienceLevel(value) || value })),
    ],
    departmentOptions: [
      { value: 'all', label: 'All Departments' },
      ...Array.from(
        new Set(
          jobs
            .map((job) => job?.department)
            .map((value) => value?.toString?.().trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: value })),
    ],
  };

  const activeFilterCount = countActiveJobFilters(filters);
  const normalizedQuery = normalizeText(filters.searchQuery);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const dateWindow = getDateWindow(filters);
  const filteredJobs = jobs
    .filter((job) => {
      const isSaved = bookmarkedJobIds.has(job.id);
      const applicationInfo = applicationsByJobId.get(job.id);
      const isWithdrawn = applicationInfo?.status === 'REJECTED' && Boolean(applicationInfo?.withdrawnBy);
      const isRejected = applicationInfo?.status === 'REJECTED' && !applicationInfo?.withdrawnBy;
      const isApplied = Boolean(applicationInfo) && !isWithdrawn && !isRejected;
      const canReapply = isWithdrawn;
      const locationLabel = getDisplayLocation(job?.location);
      const normalizedLocation = normalizeText(locationLabel);
      const locationMode = normalizedLocation.includes('remote')
        ? 'remote'
        : normalizedLocation.includes('hybrid')
          ? 'hybrid'
          : 'onsite';
      const postedAtValue = job?.publishedAt || job?.createdAt || null;
      const postedAt = postedAtValue ? new Date(postedAtValue) : null;
      const hasValidPostedAt = postedAt && !Number.isNaN(postedAt.getTime());
      const daysLeft = getDaysLeft(job);

      if (filters.bookmarkFilter === 'saved' && !isSaved) return false;
      if (filters.bookmarkFilter === 'unsaved' && isSaved) return false;

      if (filters.applicationFilter === 'not-applied' && applicationInfo) return false;
      if (filters.applicationFilter === 'applied' && !isApplied) return false;
      if (filters.applicationFilter === 'withdrawn' && !isWithdrawn) return false;
      if (filters.applicationFilter === 'not-selected' && !isRejected) return false;
      if (filters.applicationFilter === 'can-reapply' && !canReapply) return false;

      if (filters.employmentType !== 'all' && (job?.employmentType || '') !== filters.employmentType) return false;
      if (filters.experienceLevel !== 'all' && (job?.experienceLevel || '') !== filters.experienceLevel) return false;
      if (filters.department !== 'all' && (job?.department || '') !== filters.department) return false;
      if (filters.locationMode !== 'all' && locationMode !== filters.locationMode) return false;

      if (filters.deadlineWindow === '7' && !(Number.isFinite(daysLeft) && daysLeft <= 7)) return false;
      if (filters.deadlineWindow === '30' && !(Number.isFinite(daysLeft) && daysLeft <= 30)) return false;
      if (filters.deadlineWindow === 'none' && Number.isFinite(daysLeft)) return false;

      if (dateWindow.from || dateWindow.to) {
        if (!hasValidPostedAt) return false;
        if (dateWindow.from && postedAt < dateWindow.from) return false;
        if (dateWindow.to && postedAt > dateWindow.to) return false;
      }

      if (queryTokens.length) {
        const searchableText = [
          job?.title || '',
          job?.organization?.name || '',
          job?.department || '',
          locationLabel,
          job?.description || '',
          job?.employmentType || '',
          job?.experienceLevel || '',
          ...(Array.isArray(job?.skills) ? job.skills : []),
        ]
          .join(' ')
          .toLowerCase();

        if (!queryTokens.every((token) => searchableText.includes(token))) return false;
      }

      return true;
    })
    .sort((left, right) => {
      const leftPosted = new Date(left?.publishedAt || left?.createdAt || 0).getTime() || 0;
      const rightPosted = new Date(right?.publishedAt || right?.createdAt || 0).getTime() || 0;

      switch (filters.sortBy) {
        case 'oldest':
          return leftPosted - rightPosted;
        case 'closingSoon': {
          const leftDays = getDaysLeft(left);
          const rightDays = getDaysLeft(right);
          if (!Number.isFinite(leftDays) && !Number.isFinite(rightDays)) return rightPosted - leftPosted;
          if (!Number.isFinite(leftDays)) return 1;
          if (!Number.isFinite(rightDays)) return -1;
          return leftDays - rightDays;
        }
        case 'titleAsc':
          return (left?.title || '').localeCompare(right?.title || '');
        case 'companyAsc':
          return (left?.organization?.name || '').localeCompare(right?.organization?.name || '');
        case 'newest':
        default:
          return rightPosted - leftPosted;
      }
    });

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / jobsPerPage));
  const startIndex = (currentPage - 1) * jobsPerPage;
  const endIndex = startIndex + jobsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
  const bookmarkedCount = jobs.filter((job) => bookmarkedJobIds.has(job.id)).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header userType={userType} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType={userType}
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}
          >
          <section className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6">
            <div className="mb-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30">
                    <Icon name="Briefcase" size={24} color="white" />
                  </div>
                  <div>
                    <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">
                      Interview-ready roles
                    </h1>
                    <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 mt-1 sm:whitespace-nowrap">
                      Browse openings from teams already using InterviewAI to streamline their hiring process.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {pendingRealtimeJobUpdates > 0 && (
              <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Icon name="Bell" className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-300" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {pendingRealtimeJobUpdates} new job update{pendingRealtimeJobUpdates === 1 ? '' : 's'} available.
                    Refresh when you are ready.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadJobs}
                  disabled={loading}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/20"
                >
                  <Icon name="RefreshCw" size={14} className="mr-1.5" />
                  Refresh List
                </Button>
              </div>
            )}

            {!loading && !error && jobs.length > 0 && (
              <UnifiedFilterPanel
                title="Role Filters"
                description={`Refine openings by saved status, application state, role attributes, and posting window. Saved roles: ${bookmarkedCount}.`}
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
                    placeholder="Role, company, skills, location, or description"
                  />
                  <UnifiedFilterSelect
                    label="Saved Roles"
                    value={filters.bookmarkFilter}
                    onChange={(value) => updateFilter('bookmarkFilter', value)}
                    options={JOB_BOOKMARK_FILTER_OPTIONS}
                  />
                  <UnifiedFilterSelect
                    label="Application State"
                    value={filters.applicationFilter}
                    onChange={(value) => updateFilter('applicationFilter', value)}
                    options={JOB_APPLICATION_FILTER_OPTIONS}
                  />
                  <UnifiedFilterSelect
                    label="Employment Type"
                    value={filters.employmentType}
                    onChange={(value) => updateFilter('employmentType', value)}
                    options={filterOptions.employmentTypeOptions}
                  />
                  <UnifiedFilterSelect
                    label="Experience Level"
                    value={filters.experienceLevel}
                    onChange={(value) => updateFilter('experienceLevel', value)}
                    options={filterOptions.experienceLevelOptions}
                  />
                </div>

                {showAdvancedFilters && (
                  <div className={FILTER_SUBPANEL_CLASS}>
                    <div className={FILTER_GRID_CLASS}>
                      <UnifiedFilterSelect
                        label="Department"
                        value={filters.department}
                        onChange={(value) => updateFilter('department', value)}
                        options={filterOptions.departmentOptions}
                      />
                      <UnifiedFilterSelect
                        label="Location Mode"
                        value={filters.locationMode}
                        onChange={(value) => updateFilter('locationMode', value)}
                        options={JOB_LOCATION_MODE_OPTIONS}
                      />
                      <UnifiedFilterSelect
                        label="Closing Window"
                        value={filters.deadlineWindow}
                        onChange={(value) => updateFilter('deadlineWindow', value)}
                        options={JOB_DEADLINE_FILTER_OPTIONS}
                      />
                      <UnifiedFilterSelect
                        label="Posted Date"
                        value={filters.datePreset}
                        onChange={(value) => updateFilter('datePreset', value)}
                        options={JOB_DATE_PRESET_FILTER_OPTIONS}
                      />
                      <UnifiedFilterSelect
                        label="Sort By"
                        value={filters.sortBy}
                        onChange={(value) => updateFilter('sortBy', value)}
                        options={JOB_SORT_OPTIONS}
                      />
                    </div>

                    {filters.datePreset === 'custom' && (
                      <div className={FILTER_DATE_GRID_CLASS}>
                        <label className="space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Posted From</span>
                          <UnifiedTextInput
                            type="date"
                            value={filters.postedFrom}
                            onChange={(event) => updateFilter('postedFrom', event.target.value)}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Posted To</span>
                          <UnifiedTextInput
                            type="date"
                            value={filters.postedTo}
                            onChange={(event) => updateFilter('postedTo', event.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </UnifiedFilterPanel>
            )}

            {loading && (
              <div className="grid gap-4 xs:gap-5 sm:gap-6 max-w-4xl mx-auto" aria-busy="true">
                <div className="grid gap-3 xs:gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`job-skeleton-${index}`}
                      className="card-base p-4 xs:p-5 space-y-3 xs:space-y-4 animate-pulse"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                          <div className="h-3 w-1/3 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        </div>
                        <div className="h-5 w-16 rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        <div className="h-3 w-5/6 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="h-5 w-14 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        <span className="h-5 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        <span className="h-5 w-16 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                      </div>
                      <div className="h-3 w-1/2 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    </div>
                  ))}
                </div>
                <div className="card-base p-4 xs:p-5 sm:p-6 space-y-4 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-5 w-2/3 rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                    <div className="h-3 w-1/3 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-3 w-11/12 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-3 w-5/6 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                  <div className="h-20 rounded-xl bg-slate-200/60 dark:bg-slate-700/40" />
                  <div className="flex flex-wrap gap-2">
                    <span className="h-5 w-14 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <span className="h-5 w-16 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <span className="h-5 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                  <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
                    <div className="h-9 flex-1 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-9 flex-1 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                </div>
              </div>
            )}
    
            {error && (
              <div className="text-center text-sm xs:text-base text-red-600 dark:text-red-400">{error}</div>
            )}
    
            {!loading && !error && (
              <motion.div
                className="flex flex-col gap-4 xs:gap-5 sm:gap-6"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
              >
                {filteredJobs.length === 0 ? (
                  <div className="card-base p-6 xs:p-8 text-center max-w-lg mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
                      <Icon name={filters.bookmarkFilter === 'saved' ? 'Bookmark' : 'Briefcase'} size={28} className="text-gray-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                      {filters.bookmarkFilter === 'saved' ? 'No saved jobs yet' : 'No openings available'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                      {filters.bookmarkFilter === 'saved'
                        ? 'Bookmark roles to quickly return to them later.'
                        : activeFilterCount > 0
                          ? 'No roles match your current filters. Clear filters to broaden your results.'
                          : 'There are no public job listings at the moment. You can still practice interviews for any role.'}
                    </p>
                    <Button className="rounded-full" onClick={() => handlePractice(null)}>
                      <Icon name="Play" size={16} className="mr-1.5" />
                      Start a practice interview
                    </Button>
                  </div>
                ) : (
                  <>
                  {paginatedJobs.map((job) => {
                    const isBookmarked = bookmarkedJobIds.has(job.id);
                    const applicationInfo = user?.accountType?.toUpperCase() === 'CANDIDATE' 
                      ? applicationsByJobId.get(job.id) 
                      : null;
                    const hasApplied = !!applicationInfo;
                    const isWithdrawn = applicationInfo?.status === 'REJECTED' && applicationInfo?.withdrawnBy;
                    const isRejected = applicationInfo?.status === 'REJECTED' && !applicationInfo?.withdrawnBy;
                    const canReapply = isWithdrawn; // Can reapply if withdrawn
                    const showAppliedBadge = hasApplied && !isWithdrawn && !isRejected;
                    const showWithdrawnBadge = isWithdrawn;
                    const showRejectedBadge = isRejected;
                    
                    const daysLeft = getDaysLeft(job);
                    const companyLogoUrl = getAssetUrl(job.organization?.logo);
                    
                    return (
                    <motion.div
                      key={job.id}
                      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                      className="group card-base p-4 xs:p-5 sm:p-6 flex flex-col sm:flex-row gap-4 xs:gap-5 sm:gap-6 relative hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      {/* Left Section - Company Logo */}
                      <div className="flex-shrink-0">
                        <div className="w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center p-2">
                          {companyLogoUrl ? (
                            <img
                              src={companyLogoUrl}
                              alt={job.organization?.name || 'Company logo'}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full items-center justify-center text-gray-400 dark:text-slate-500" style={{ display: companyLogoUrl ? 'none' : 'flex' }}>
                            <Icon name="Building2" size={32} />
                          </div>
                        </div>
                      </div>
                      
                      {/* Middle Section - Job Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h2 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                            {job.title}
                          </h2>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookmark(job.id, e);
                            }}
                            className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark job'}
                            title={isBookmarked ? 'Remove bookmark' : 'Save job'}
                          >
                            <Icon
                              name={isBookmarked ? 'BookmarkCheck' : 'Bookmark'}
                              size={18}
                              className={
                                isBookmarked
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-400 dark:text-slate-500'
                              }
                            />
                          </button>
                        </div>
                        
                        {job.organization?.name && (
                          <p className="text-sm text-gray-700 dark:text-slate-300 mb-3">
                            {job.organization.name}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 mb-2">
                          {/* Location */}
                          {!shouldShowRemote(job.location) && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-400">
                              <Icon name="MapPin" size={16} className="text-gray-500 dark:text-slate-500" />
                              <span>{job.location}</span>
                            </div>
                          )}
                          {shouldShowRemote(job.location) && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-400">
                              <Icon name="MapPin" size={16} className="text-gray-500 dark:text-slate-500" />
                              <span>Remote</span>
                            </div>
                          )}
                          
                          {/* Employment Type */}
                          {job.employmentType && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-400">
                              <Icon name="Briefcase" size={16} className="text-gray-500 dark:text-slate-500" />
                              <span>{formatEmploymentType(job.employmentType)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right Section - Status Badges and Days Left */}
                      <div className="flex flex-col items-end flex-shrink-0">
                        {/* Status Badges and Days Left - In one line */}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {/* Application Status Badges */}
                          {showAppliedBadge && (
                            <div className="px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center gap-1.5 shadow-sm">
                              <Icon name="CheckCircle" size={14} className="text-green-600 dark:text-green-400" />
                              <span className="text-xs font-medium text-green-700 dark:text-green-300">Applied</span>
                            </div>
                          )}
                          {showWithdrawnBadge && (
                            <div className="px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 flex items-center gap-1.5 shadow-sm">
                              <Icon name="XCircle" size={14} className="text-orange-600 dark:text-orange-400" />
                              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Withdrew</span>
                            </div>
                          )}
                          {showRejectedBadge && (
                            <div className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 flex items-center gap-1.5 shadow-sm">
                              <Icon name="XCircle" size={14} className="text-gray-600 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Not Selected</span>
                            </div>
                          )}
                          
                          {/* Days Left */}
                          {daysLeft && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-400">
                              <Icon name="Clock" size={16} className="text-gray-500 dark:text-slate-500" />
                              <span>{daysLeft} days left</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Share Icons - Positioned at bottom right corner, only show on hover */}
                      <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleShare(job, 'share', e)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                          aria-label="Share"
                        >
                          <Icon name="Share2" size={16} className="text-gray-600 dark:text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => handleShare(job, 'whatsapp', e)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                          aria-label="Share on WhatsApp"
                        >
                          <Icon name="MessageCircle" size={16} className="text-gray-600 dark:text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => handleShare(job, 'facebook', e)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                          aria-label="Share on Facebook"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleShare(job, 'instagram', e)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                          aria-label="Share on Instagram"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleShare(job, 'twitter', e)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                          aria-label="Share on Twitter"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleShare(job, 'linkedin', e)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                          aria-label="Share on LinkedIn"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                    );
                  })}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-4 mt-6">
                      <div className="text-sm text-gray-600 dark:text-slate-400">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
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
              </motion.div>
            )}
    
          </section>
        </main>
        </div>
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && applicationJob && (
        <JobApplicationForm
          job={applicationJob}
          onClose={() => {
            setShowApplicationForm(false);
            setApplicationJob(null);
          }}
          onSuccess={handleApplicationSuccess}
        />
      )}

      {/* Success Message */}
      {applicationSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 max-w-md"
        >
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <Icon name="CheckCircle" className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                  Application Submitted!
                </h4>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Your application has been sent to the employer. You can track its status in your candidate dashboard.
                </p>
              </div>
              <button
                onClick={() => setApplicationSuccess(false)}
                className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded"
              >
                <Icon name="X" className="w-4 h-4 text-green-600 dark:text-green-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default JobsPage;
