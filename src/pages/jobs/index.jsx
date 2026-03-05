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
import { buildJobShareCardUrl, buildJobSharePackage, prepareJobShareAttachments } from '../../utils/jobShare.js';
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

const normalizeMatchText = (value) => (value || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const toStringList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => toStringList(item))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;/|]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
};

const toTokenSet = (value) => new Set(
  normalizeMatchText(value)
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1),
);

const countOverlap = (leftSet, rightSet) => {
  if (!leftSet?.size || !rightSet?.size) return 0;
  let count = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) count += 1;
  });
  return count;
};

const EXPERIENCE_LEVEL_RANK = {
  entry: 1,
  junior: 2,
  mid: 3,
  senior: 4,
  lead: 5,
  principal: 6,
  executive: 7,
};

const normalizeExperienceLevel = (value) => {
  const normalized = normalizeMatchText(value);
  if (!normalized) return '';
  if (normalized.includes('entry')) return 'entry';
  if (normalized.includes('junior')) return 'junior';
  if (normalized.includes('mid')) return 'mid';
  if (normalized.includes('senior')) return 'senior';
  if (normalized.includes('lead')) return 'lead';
  if (normalized.includes('principal')) return 'principal';
  if (normalized.includes('executive') || normalized.includes('c level') || normalized.includes('c-level')) return 'executive';
  return '';
};

const normalizeEmploymentType = (value) => {
  const normalized = normalizeMatchText(value);
  if (!normalized) return '';
  if (normalized.includes('full') && normalized.includes('time')) return 'full-time';
  if (normalized.includes('part') && normalized.includes('time')) return 'part-time';
  if (normalized.includes('contract')) return 'contract';
  if (normalized.includes('intern')) return 'internship';
  if (normalized.includes('freelance')) return 'freelance';
  return normalized;
};

const normalizeWorkMode = (value) => {
  const normalized = normalizeMatchText(value);
  if (!normalized) return '';
  if (normalized.includes('remote')) return 'remote';
  if (normalized.includes('hybrid')) return 'hybrid';
  if (normalized.includes('on site') || normalized.includes('onsite')) return 'onsite';
  if (normalized.includes('flexible')) return 'flexible';
  return '';
};

const normalizeIndustry = (value) => {
  const normalized = normalizeMatchText(value);
  if (!normalized) return '';
  if (normalized.includes('tech') || normalized.includes('software') || normalized.includes('it')) return 'technology';
  if (normalized.includes('data') || normalized.includes('analytics')) return 'data';
  if (normalized.includes('design')) return 'design';
  if (normalized.includes('product')) return 'product';
  if (normalized.includes('marketing')) return 'marketing';
  if (normalized.includes('finance') || normalized.includes('account')) return 'finance';
  return normalized;
};

const normalizeSkill = (value) => {
  const normalized = normalizeMatchText(value);
  if (!normalized) return '';
  const aliases = {
    'node js': 'nodejs',
    'node.js': 'nodejs',
    js: 'javascript',
    ts: 'typescript',
    'c plus plus': 'c++',
    cpp: 'c++',
    'c sharp': 'c#',
    csharp: 'c#',
    'qa': 'testing',
    'testing qa': 'testing',
    postgresql: 'postgresql',
    'postgre sql': 'postgresql',
  };
  return aliases[normalized] || normalized;
};

const CANDIDATE_SALARY_EXPECTATION_RANGES = {
  'below-50k': { min: 0, max: 50000 },
  '50k-100k': { min: 50000, max: 100000 },
  '100k-150k': { min: 100000, max: 150000 },
  '150k-200k': { min: 150000, max: 200000 },
  '200k-300k': { min: 200000, max: 300000 },
  '300k-500k': { min: 300000, max: 500000 },
  'above-500k': { min: 500000, max: Number.POSITIVE_INFINITY },
};

const parseCandidateSalaryExpectation = (value) => {
  const normalized = normalizeMatchText(value);
  if (!normalized || normalized === 'negotiable') return null;
  if (CANDIDATE_SALARY_EXPECTATION_RANGES[normalized]) {
    return CANDIDATE_SALARY_EXPECTATION_RANGES[normalized];
  }
  const compact = normalized.replace(/\s+/g, '');
  const rangeMatch = compact.match(/(\d+)\s*k?\s*-\s*(\d+)\s*k?/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]) * 1000;
    const max = Number(rangeMatch[2]) * 1000;
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
  }
  return null;
};

const parseJobSalaryRange = (job = {}) => {
  const min = Number(job?.salaryMin);
  const max = Number(job?.salaryMax);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    return {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : Number.POSITIVE_INFINITY,
    };
  }
  const rangeText = normalizeMatchText(job?.compensationRange);
  if (!rangeText) return null;
  const numericParts = Array.from(rangeText.matchAll(/(\d[\d,]*)/g))
    .map((match) => Number(String(match[1]).replace(/,/g, '')))
    .filter(Number.isFinite);
  if (numericParts.length >= 2) {
    return { min: numericParts[0], max: numericParts[1] };
  }
  if (numericParts.length === 1) {
    if (rangeText.includes('up to')) return { min: 0, max: numericParts[0] };
    return { min: numericParts[0], max: Number.POSITIVE_INFINITY };
  }
  return null;
};

const rangesOverlap = (left, right) => {
  if (!left || !right) return false;
  const leftMin = Number.isFinite(left.min) ? left.min : 0;
  const leftMax = Number.isFinite(left.max) ? left.max : Number.POSITIVE_INFINITY;
  const rightMin = Number.isFinite(right.min) ? right.min : 0;
  const rightMax = Number.isFinite(right.max) ? right.max : Number.POSITIVE_INFINITY;
  return Math.max(leftMin, rightMin) <= Math.min(leftMax, rightMax);
};

const computeJobMatchScore = (job, profile) => {
  if (!profile) return 0;
  let score = 0;

  const targetRole = normalizeMatchText(profile.targetRole || profile.jobRole);
  const candidateIndustry = normalizeIndustry(profile.industry);
  const candidateExperience = normalizeExperienceLevel(profile.experienceLevel);
  const preferredEmploymentType = normalizeEmploymentType(profile.preferredEmploymentType);
  const preferredWorkType = normalizeWorkMode(profile.preferredWorkType);
  const candidateLocation = normalizeMatchText(profile.location);
  const candidateSalaryExpectation = parseCandidateSalaryExpectation(profile.expectedSalary);
  const candidateFieldOfStudy = normalizeMatchText(profile.fieldOfStudy);
  const candidateCareerGoals = normalizeMatchText(profile.careerGoals);

  const candidateSkills = toStringList(profile.skills).map(normalizeSkill).filter(Boolean);
  const candidateCertifications = toStringList(profile.certifications).map(normalizeSkill).filter(Boolean);
  const candidateSkillSet = new Set([...candidateSkills, ...candidateCertifications]);

  const jobTitle = normalizeMatchText(job.title);
  const jobIndustry = normalizeIndustry(job.industry || job.department);
  const jobExperience = normalizeExperienceLevel(job.experienceLevel);
  const jobEmploymentType = normalizeEmploymentType(job.employmentType);
  const jobLocation = normalizeMatchText(job.location || 'remote');
  const jobWorkMode = normalizeWorkMode(jobLocation) || 'onsite';
  const jobSalaryRange = parseJobSalaryRange(job);
  const jobSkills = toStringList(job.skills).map(normalizeSkill).filter(Boolean);
  const jobKeywords = new Set([
    ...toTokenSet(jobTitle),
    ...toTokenSet(job.description),
    ...toTokenSet(toStringList(job.requirements).join(' ')),
    ...toTokenSet(job.department),
    ...toTokenSet(jobIndustry),
    ...jobSkills,
  ]);

  // Role/title match (max 25)
  if (targetRole && jobTitle) {
    if (jobTitle.includes(targetRole)) {
      score += 25;
    } else {
      const roleTokens = toTokenSet(targetRole);
      const titleTokens = toTokenSet(jobTitle);
      const overlap = countOverlap(roleTokens, titleTokens);
      if (roleTokens.size > 0) {
        const overlapRatio = overlap / roleTokens.size;
        score += Math.round(Math.min(20, overlapRatio * 20));
      }
      if (overlap === 0 && roleTokens.has('engineer') && titleTokens.has('engineer')) {
        score += 8;
      }
    }
  }

  // Skills + certifications + required skill text match (max 25)
  if (candidateSkillSet.size > 0 && jobKeywords.size > 0) {
    let matchedSkillCount = 0;
    candidateSkillSet.forEach((skill) => {
      if (!skill) return;
      const skillTokens = toTokenSet(skill);
      const tokenOverlap = countOverlap(skillTokens, jobKeywords);
      if (jobKeywords.has(skill) || tokenOverlap > 0) matchedSkillCount += 1;
    });
    score += Math.min(25, matchedSkillCount * 5);
  }

  // Industry/department match (max 10)
  if (candidateIndustry && jobIndustry) {
    if (candidateIndustry === jobIndustry) {
      score += 10;
    } else {
      const industryOverlap = countOverlap(toTokenSet(candidateIndustry), toTokenSet(jobIndustry));
      if (industryOverlap > 0) score += 5;
    }
  }

  // Experience level match (max 10)
  if (candidateExperience && jobExperience) {
    const candidateRank = EXPERIENCE_LEVEL_RANK[candidateExperience] || 0;
    const requiredRank = EXPERIENCE_LEVEL_RANK[jobExperience] || 0;
    if (candidateRank > 0 && requiredRank > 0) {
      const rankGap = candidateRank - requiredRank;
      if (rankGap >= 0) score += 10;
      else if (rankGap === -1) score += 6;
      else if (rankGap === -2) score += 3;
    }
  }

  // Preferred employment type match (max 10)
  if (preferredEmploymentType && jobEmploymentType) {
    if (preferredEmploymentType === jobEmploymentType) {
      score += 10;
    }
  }

  // Work mode + location match (max 10)
  if (preferredWorkType) {
    if (preferredWorkType === 'flexible') {
      score += 8;
    } else if (preferredWorkType === jobWorkMode) {
      score += 10;
    } else if (
      (preferredWorkType === 'remote' && jobWorkMode === 'hybrid')
      || (preferredWorkType === 'hybrid' && (jobWorkMode === 'remote' || jobWorkMode === 'onsite'))
    ) {
      score += 5;
    }
  }

  // City/location text similarity (max 5)
  if (candidateLocation && jobLocation && jobWorkMode !== 'remote') {
    const locationOverlap = countOverlap(toTokenSet(candidateLocation), toTokenSet(jobLocation));
    if (locationOverlap > 0) score += 5;
  }

  // Expected salary overlap (max 5)
  if (candidateSalaryExpectation && jobSalaryRange) {
    if (rangesOverlap(candidateSalaryExpectation, jobSalaryRange)) {
      score += 5;
    } else if (candidateSalaryExpectation.min <= jobSalaryRange.max) {
      score += 2;
    }
  }

  // Soft profile signals that overlap with job details (max 10)
  if (candidateFieldOfStudy) {
    const studyOverlap = countOverlap(toTokenSet(candidateFieldOfStudy), jobKeywords);
    if (studyOverlap > 0) score += 4;
  }
  if (candidateCareerGoals) {
    const goalsOverlap = countOverlap(toTokenSet(candidateCareerGoals), jobKeywords);
    if (goalsOverlap > 0) score += 6;
  }

  return Math.min(100, Math.max(0, score));
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
  const [clipboardToast, setClipboardToast] = useState('');
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
  const handleShare = async (job, platform, e) => {
    e.stopPropagation();
    const jobUrl = `${window.location.origin}/jobs/${job.id}`;
    const shareCardUrl = buildJobShareCardUrl(job.id, {
      apiBaseUrl: API_URL,
      version: job.updatedAt || job.publishedAt || job.createdAt || '',
    });
    const sharePackage = buildJobSharePackage(job, {
      jobUrl,
      shareUrl: shareCardUrl,
      organizationName: job?.organization?.name || '',
      apiBaseUrl: API_URL,
    });
    const targetShareUrl = sharePackage.primaryShareUrl || jobUrl;
    const isLikelyMobile = /android|iphone|ipad|ipod/i.test(
      typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
    );
    
    let shareUrl = '';
    try {
      switch (platform) {
        case 'whatsapp':
          if (navigator.share && isLikelyMobile) {
            const attachmentResult = await prepareJobShareAttachments(job, {
              apiBaseUrl: API_URL,
              maxImages: 1,
              includeVideo: true,
            });
            const primaryAttachment = attachmentResult.files[0]
              ? [attachmentResult.files[0]]
              : [];
            const canAttachFiles = primaryAttachment.length > 0
              && typeof navigator.canShare === 'function'
              && navigator.canShare({ files: primaryAttachment });
            if (canAttachFiles) {
              await navigator.share({
                files: primaryAttachment,
                text: sharePackage.whatsappCaptionText || sharePackage.summaryText,
              });
              setClipboardToast('Share sheet opened with one attached media file and caption.');
              setTimeout(() => setClipboardToast(''), 3000);
              return;
            }
          }
          shareUrl = `https://wa.me/?text=${encodeURIComponent(sharePackage.whatsappText)}`;
          break;
        case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetShareUrl)}&quote=${encodeURIComponent(sharePackage.summaryText)}`;
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(sharePackage.detailedText);
            setClipboardToast('Share opened. Detailed job summary copied to clipboard.');
            setTimeout(() => setClipboardToast(''), 3500);
          }
          break;
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(sharePackage.summaryText)}&url=${encodeURIComponent(targetShareUrl)}`;
          break;
        case 'linkedin':
          shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(targetShareUrl)}`;
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(sharePackage.detailedText);
            setClipboardToast('Share opened. Detailed job summary copied to clipboard.');
            setTimeout(() => setClipboardToast(''), 3500);
          }
          break;
        case 'instagram':
          // Instagram doesn't support direct URL sharing with metadata payloads.
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(sharePackage.detailedText);
          }
          setClipboardToast('Detailed job share package copied to clipboard!');
          setTimeout(() => setClipboardToast(''), 3000);
          return;
        default:
          // Native share or copy.
          if (navigator.share) {
            const attachmentResult = await prepareJobShareAttachments(job, {
              apiBaseUrl: API_URL,
              maxImages: 1,
              includeVideo: true,
            });
            const sharePayload = {
              title: sharePackage.title,
              text: sharePackage.nativeShareText,
              url: targetShareUrl,
            };
            const canAttachFiles = attachmentResult.files.length > 0
              && typeof navigator.canShare === 'function'
              && navigator.canShare({ files: attachmentResult.files });
            if (canAttachFiles) {
              sharePayload.files = attachmentResult.files;
            }
            await navigator.share({
              ...sharePayload,
            });
            return;
          }
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(sharePackage.detailedText);
            setClipboardToast('Detailed job share package copied to clipboard!');
            setTimeout(() => setClipboardToast(''), 3000);
          } else {
            setClipboardToast('Sharing is unavailable in this browser.');
            setTimeout(() => setClipboardToast(''), 3000);
          }
          return;
      }

      if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setClipboardToast(err?.message || 'Failed to share this job.');
      setTimeout(() => setClipboardToast(''), 3000);
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

            {/* AI-Powered Job Recommendations */}
            {user?.accountType?.toUpperCase() === 'CANDIDATE' && !loading && jobs.length > 0 && (() => {
              const profile = user?.profile || user;
              const recommendations = jobs
                .map((j) => ({ ...j, matchScore: computeJobMatchScore(j, profile) }))
                .filter((j) => j.matchScore >= 30)
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, 4);
              if (recommendations.length === 0) return null;
              return (
                <div className="rounded-2xl border border-blue-100 dark:border-blue-800/40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="Sparkles" size={16} className="text-blue-600 dark:text-blue-400" />
                    <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Recommended for You</h2>
                    <span className="ml-auto text-xs text-blue-500 dark:text-blue-400">Based on your profile</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recommendations.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="text-left p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-white/60 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{job.title}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{job.organization?.name || 'Company'}</p>
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${
                            job.matchScore >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                          }`}>
                            {job.matchScore}% match
                          </span>
                        </div>
                        {job.location && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1"><Icon name="MapPin" size={10} />{job.location}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                    <div className="text-center py-12">
                      <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 inline-flex mb-4">
                        <Icon name={filters.bookmarkFilter === 'saved' ? 'Bookmark' : 'Briefcase'} className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                        {filters.bookmarkFilter === 'saved' ? 'No saved jobs yet' : 'No openings available'}
                      </h3>
                      <p className="text-gray-600 dark:text-slate-400 mb-4">
                        {filters.bookmarkFilter === 'saved'
                          ? 'Bookmark roles to quickly return to them later.'
                          : activeFilterCount > 0
                            ? 'No roles match your current filters. Clear filters to broaden your results.'
                            : 'There are no public job listings at the moment. You can still practice interviews for any role.'}
                      </p>
                      <Button className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => handlePractice(null)}>
                        <Icon name="Play" size={16} className="mr-1.5" />
                        Start a practice interview
                      </Button>
                    </div>
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

      {/* Clipboard / share toast */}
      {clipboardToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 shadow-2xl flex items-center gap-3 max-w-sm">
          <Icon name="Copy" className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-200 flex-1">{clipboardToast}</p>
          <button onClick={() => setClipboardToast('')} className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800">
            <Icon name="X" className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          </button>
        </div>
      )}
    </div>
  );
};

export default JobsPage;
