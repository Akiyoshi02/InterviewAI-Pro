import {
  APPLICATION_DISPOSITION_OPTIONS,
  getDispositionLabel,
  isJobClosedDisposition,
} from '../../../constants/applicationDisposition.js';

const BASE_APPLICATION_STATUSES = new Set([
  'SUBMITTED',
  'SCREENING',
  'INTERVIEWING',
  'SHORTLISTED',
  'REJECTED',
  'HIRED',
]);

const ACTIVE_DERIVED_STATUSES = new Set([
  'SUBMITTED',
  'SCREENING',
  'INTERVIEWING',
  'SHORTLISTED',
]);

const FINAL_DERIVED_STATUSES = new Set([
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
  'POSITION_CLOSED',
]);

const WITHDRAW_BLOCKED_STATUSES = new Set(['INTERVIEWING', 'REJECTED', 'HIRED']);

const STATUS_SORT_PRIORITY = Object.freeze({
  SUBMITTED: 1,
  SCREENING: 2,
  INTERVIEWING: 3,
  SHORTLISTED: 4,
  HIRED: 5,
  REJECTED: 6,
  WITHDRAWN: 7,
  POSITION_CLOSED: 8,
  UNKNOWN: 99,
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DATE_PRESET_DAY_LOOKBACK = Object.freeze({
  last7: 7,
  last30: 30,
  last90: 90,
  last180: 180,
  last365: 365,
});

export const DERIVED_STATUS_LABELS = Object.freeze({
  SUBMITTED: 'Submitted',
  SCREENING: 'Under Review',
  INTERVIEWING: 'Interviewing',
  SHORTLISTED: 'Shortlisted',
  HIRED: 'Hired',
  REJECTED: 'Not Selected',
  WITHDRAWN: 'Withdrew',
  POSITION_CLOSED: 'Position Closed',
  UNKNOWN: 'Unknown',
});

export const DEFAULT_CANDIDATE_APPLICATION_FILTERS = Object.freeze({
  searchQuery: '',
  statusFilter: 'all',
  companyFilter: 'all',
  employmentTypeFilter: 'all',
  dispositionFilter: 'all',
  jobStateFilter: 'all',
  reviewStateFilter: 'all',
  withdrawalFilter: 'all',
  datePreset: 'all',
  appliedFrom: '',
  appliedTo: '',
  sortBy: 'latest_activity',
});

export const APPLICATION_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active Pipeline' },
  { value: 'FINAL', label: 'Final Outcomes' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'SCREENING', label: 'Under Review' },
  { value: 'INTERVIEWING', label: 'Interviewing' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'WITHDRAWN', label: 'Withdrew' },
  { value: 'POSITION_CLOSED', label: 'Position Closed' },
  { value: 'REJECTED', label: 'Not Selected' },
  { value: 'UNKNOWN', label: 'Unknown' },
]);

export const APPLICATION_JOB_STATE_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Job States' },
  { value: 'OPEN', label: 'Open Positions' },
  { value: 'CLOSED', label: 'Closed Positions' },
]);

export const APPLICATION_REVIEW_STATE_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Review States' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'PENDING', label: 'Awaiting Review' },
]);

export const APPLICATION_WITHDRAWAL_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Withdrawal States' },
  { value: 'WITHDRAWABLE', label: 'Can Withdraw' },
  { value: 'LOCKED', label: 'Cannot Withdraw' },
]);

export const APPLICATION_DATE_PRESET_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Dates' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'last180', label: 'Last 180 Days' },
  { value: 'last365', label: 'Last 365 Days' },
  { value: 'custom', label: 'Custom Range' },
]);

export const APPLICATION_SORT_FILTER_OPTIONS = Object.freeze([
  { value: 'latest_activity', label: 'Latest Activity' },
  { value: 'recent_applied', label: 'Recently Applied' },
  { value: 'oldest_applied', label: 'Oldest Applied' },
  { value: 'company_az', label: 'Company A-Z' },
  { value: 'status', label: 'Status Order' },
]);

const toCleanString = (value) => (value == null ? '' : String(value).trim());

const toUpperCode = (value) => toCleanString(value).toUpperCase();

const normalizeForSearch = (value) =>
  toCleanString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toMillis = (value) => toDate(value)?.getTime?.() || 0;

const startOfDay = (dateValue) => {
  const date = toDate(dateValue);
  if (!date) return null;
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (dateValue) => {
  const date = toDate(dateValue);
  if (!date) return null;
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const compareText = (a, b) =>
  toCleanString(a).localeCompare(toCleanString(b), undefined, { sensitivity: 'base' });

const parseEmploymentTypeLabel = (value) => {
  const code = toUpperCode(value);
  if (!code) return 'Not specified';
  const formatted = code.toLowerCase().replaceAll('_', ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export const getDerivedApplicationStatus = (application = {}) => {
  const rawStatus = toUpperCode(application?.status);
  if (rawStatus === 'REJECTED' && application?.withdrawnBy) {
    return 'WITHDRAWN';
  }
  if (rawStatus === 'REJECTED' && isJobClosedDisposition(application)) {
    return 'POSITION_CLOSED';
  }
  if (rawStatus && BASE_APPLICATION_STATUSES.has(rawStatus)) {
    return rawStatus;
  }
  return 'UNKNOWN';
};

const inferDispositionCode = (application, derivedStatus) => {
  const explicitCode = toUpperCode(application?.dispositionCode);
  if (explicitCode) return explicitCode;
  if (derivedStatus === 'WITHDRAWN') return 'CANDIDATE_WITHDREW';
  if (derivedStatus === 'POSITION_CLOSED') return 'JOB_CLOSED';
  if (derivedStatus === 'REJECTED') return 'NOT_SELECTED';
  if (derivedStatus === 'HIRED') return 'HIRED';
  return null;
};

const getSubmittedAtDate = (application) =>
  toDate(application?.submittedAt || application?.createdAt);

const getLastActivityAtMillis = (application) =>
  Math.max(
    toMillis(application?.statusChangedAt),
    toMillis(application?.reviewedAt),
    toMillis(application?.updatedAt),
    toMillis(application?.submittedAt),
    toMillis(application?.createdAt),
  );

const isWithdrawable = (application) => {
  const rawStatus = toUpperCode(application?.status);
  if (!rawStatus) return false;
  if (application?.withdrawnBy) return false;
  return !WITHDRAW_BLOCKED_STATUSES.has(rawStatus);
};

export const canCandidateWithdrawApplication = (application = {}) => isWithdrawable(application);

const buildSearchText = (application, { derivedStatus, dispositionCode }) => {
  const job = application?.job || {};
  const organization = application?.organization || {};
  const answersText = Array.isArray(application?.answers)
    ? application.answers
      .map((item) => item?.answer || item?.question || '')
      .filter(Boolean)
      .join(' ')
    : '';

  const searchTokens = [
    job?.title,
    job?.department,
    job?.location,
    parseEmploymentTypeLabel(job?.employmentType),
    organization?.name,
    application?.status,
    DERIVED_STATUS_LABELS[derivedStatus],
    dispositionCode,
    getDispositionLabel(dispositionCode),
    application?.dispositionReason,
    application?.dispositionNotes,
    application?.coverLetter,
    answersText,
  ];

  return normalizeForSearch(searchTokens.filter(Boolean).join(' '));
};

const getApplicationFilterMeta = (application = {}) => {
  const derivedStatus = getDerivedApplicationStatus(application);
  const dispositionCode = inferDispositionCode(application, derivedStatus);
  const submittedAtDate = getSubmittedAtDate(application);
  const companyName = toCleanString(application?.organization?.name || '');
  const employmentTypeCode = toUpperCode(application?.job?.employmentType);
  const reviewState = toDate(application?.reviewedAt) ? 'REVIEWED' : 'PENDING';
  const jobState = isJobClosedDisposition(application) ? 'CLOSED' : 'OPEN';
  const statusPhase = ACTIVE_DERIVED_STATUSES.has(derivedStatus)
    ? 'ACTIVE'
    : (FINAL_DERIVED_STATUSES.has(derivedStatus) ? 'FINAL' : 'UNKNOWN');

  return {
    application,
    derivedStatus,
    dispositionCode,
    statusPhase,
    reviewState,
    jobState,
    companyName,
    normalizedCompanyName: normalizeForSearch(companyName),
    employmentTypeCode,
    submittedAtDate,
    submittedAtMillis: submittedAtDate?.getTime?.() || 0,
    lastActivityAtMillis: getLastActivityAtMillis(application),
    withdrawalState: isWithdrawable(application) ? 'WITHDRAWABLE' : 'LOCKED',
    searchText: buildSearchText(application, { derivedStatus, dispositionCode }),
  };
};

const buildDateWindow = (filters = {}, now = new Date()) => {
  const preset = toCleanString(filters?.datePreset || 'all').toLowerCase();
  const nowDate = toDate(now) || new Date();
  let start = null;
  let end = null;

  if (preset in DATE_PRESET_DAY_LOOKBACK) {
    const lookbackDays = DATE_PRESET_DAY_LOOKBACK[preset];
    start = startOfDay(new Date(nowDate.getTime() - (lookbackDays - 1) * DAY_IN_MS));
    end = endOfDay(nowDate);
  }

  if (preset === 'custom') {
    const customStart = startOfDay(filters?.appliedFrom);
    const customEnd = endOfDay(filters?.appliedTo);
    if (customStart) start = customStart;
    if (customEnd) end = customEnd;
  }

  if (start && end && start.getTime() > end.getTime()) {
    return { start: end, end: start };
  }

  return { start, end };
};

const matchesSearch = (meta, searchQuery) => {
  const normalizedQuery = normalizeForSearch(searchQuery);
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => meta.searchText.includes(token));
};

const matchesStatus = (meta, statusFilter) => {
  const normalized = toUpperCode(statusFilter);
  if (!normalized || normalized === 'ALL') return true;
  if (normalized === 'ACTIVE' || normalized === 'FINAL') {
    return meta.statusPhase === normalized;
  }
  return meta.derivedStatus === normalized;
};

const matchesDisposition = (meta, dispositionFilter) => {
  const normalized = toUpperCode(dispositionFilter);
  if (!normalized || normalized === 'ALL') return true;
  if (normalized === 'NONE') return !meta.dispositionCode;
  return meta.dispositionCode === normalized;
};

const matchesCaseInsensitiveOption = (actualValue, selectedValue) => {
  const selected = normalizeForSearch(selectedValue);
  if (!selected || selected === 'all') return true;
  return normalizeForSearch(actualValue) === selected;
};

const matchesDateWindow = (meta, window) => {
  if (!window.start && !window.end) return true;
  if (!meta.submittedAtDate) return false;
  const submittedAt = meta.submittedAtDate.getTime();
  if (window.start && submittedAt < window.start.getTime()) return false;
  if (window.end && submittedAt > window.end.getTime()) return false;
  return true;
};

const compareByDefault = (leftMeta, rightMeta) => {
  if (rightMeta.lastActivityAtMillis !== leftMeta.lastActivityAtMillis) {
    return rightMeta.lastActivityAtMillis - leftMeta.lastActivityAtMillis;
  }
  if (rightMeta.submittedAtMillis !== leftMeta.submittedAtMillis) {
    return rightMeta.submittedAtMillis - leftMeta.submittedAtMillis;
  }
  return compareText(leftMeta.application?.id, rightMeta.application?.id);
};

const sortMetaEntries = (metaEntries, sortBy = 'latest_activity') => {
  const normalizedSortBy = toCleanString(sortBy || 'latest_activity').toLowerCase();
  const sorted = [...metaEntries];

  sorted.sort((leftMeta, rightMeta) => {
    switch (normalizedSortBy) {
      case 'recent_applied':
        if (rightMeta.submittedAtMillis !== leftMeta.submittedAtMillis) {
          return rightMeta.submittedAtMillis - leftMeta.submittedAtMillis;
        }
        return compareByDefault(leftMeta, rightMeta);
      case 'oldest_applied':
        if (leftMeta.submittedAtMillis !== rightMeta.submittedAtMillis) {
          return leftMeta.submittedAtMillis - rightMeta.submittedAtMillis;
        }
        return compareByDefault(leftMeta, rightMeta);
      case 'company_az': {
        const companyComparison = compareText(leftMeta.companyName, rightMeta.companyName);
        if (companyComparison !== 0) return companyComparison;
        return compareByDefault(leftMeta, rightMeta);
      }
      case 'status': {
        const leftPriority = STATUS_SORT_PRIORITY[leftMeta.derivedStatus] || STATUS_SORT_PRIORITY.UNKNOWN;
        const rightPriority = STATUS_SORT_PRIORITY[rightMeta.derivedStatus] || STATUS_SORT_PRIORITY.UNKNOWN;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return compareByDefault(leftMeta, rightMeta);
      }
      case 'latest_activity':
      default:
        return compareByDefault(leftMeta, rightMeta);
    }
  });

  return sorted;
};

export const filterCandidateApplications = (applications = [], filters = {}, options = {}) => {
  const safeApplications = Array.isArray(applications) ? applications : [];
  const activeFilters = { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, ...(filters || {}) };
  const dateWindow = buildDateWindow(activeFilters, options.now);

  const metas = safeApplications.map((application) => getApplicationFilterMeta(application));
  const filteredMetas = metas.filter((meta) => {
    if (!matchesSearch(meta, activeFilters.searchQuery)) return false;
    if (!matchesStatus(meta, activeFilters.statusFilter)) return false;
    if (!matchesDisposition(meta, activeFilters.dispositionFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.companyName, activeFilters.companyFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.employmentTypeCode, activeFilters.employmentTypeFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.jobState, activeFilters.jobStateFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.reviewState, activeFilters.reviewStateFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.withdrawalState, activeFilters.withdrawalFilter)) return false;
    if (!matchesDateWindow(meta, dateWindow)) return false;
    return true;
  });

  return sortMetaEntries(filteredMetas, activeFilters.sortBy).map((meta) => meta.application);
};

const sortGroupApplications = (applications = []) =>
  [...applications].sort((left, right) =>
    toMillis(right?.submittedAt || right?.createdAt) - toMillis(left?.submittedAt || left?.createdAt));

const getGroupSortValue = (group, key) => {
  if (!group) return '';
  if (key === 'company') return group.organization?.name || '';
  if (key === 'latestActivity') return group.latestActivityAtMillis || 0;
  if (key === 'newestApplied') return group.newestAppliedAtMillis || 0;
  if (key === 'oldestApplied') return group.oldestAppliedAtMillis || 0;
  return '';
};

export const groupCandidateApplicationsByJob = (applications = [], { sortBy = 'latest_activity' } = {}) => {
  const map = new Map();
  const safeApplications = Array.isArray(applications) ? applications : [];

  safeApplications.forEach((application, index) => {
    const jobId = application?.job?.id || application?.jobId || `unknown-${application?.id || index}`;
    if (!map.has(jobId)) {
      map.set(jobId, {
        jobId,
        job: application?.job || null,
        organization: application?.organization || null,
        applications: [],
        filteredCount: 0,
        latestActivityAtMillis: 0,
        newestAppliedAtMillis: 0,
        oldestAppliedAtMillis: Number.MAX_SAFE_INTEGER,
      });
    }

    const group = map.get(jobId);
    const submittedAtMillis = toMillis(application?.submittedAt || application?.createdAt);
    const latestActivity = getLastActivityAtMillis(application);

    group.applications.push(application);
    group.filteredCount += 1;
    group.latestActivityAtMillis = Math.max(group.latestActivityAtMillis, latestActivity);
    group.newestAppliedAtMillis = Math.max(group.newestAppliedAtMillis, submittedAtMillis);
    group.oldestAppliedAtMillis = Math.min(group.oldestAppliedAtMillis, submittedAtMillis || Number.MAX_SAFE_INTEGER);
    if (!group.job && application?.job) group.job = application.job;
    if (!group.organization && application?.organization) group.organization = application.organization;
  });

  const groups = Array.from(map.values()).map((group) => ({
    ...group,
    applications: sortGroupApplications(group.applications),
    oldestAppliedAtMillis: group.oldestAppliedAtMillis === Number.MAX_SAFE_INTEGER ? 0 : group.oldestAppliedAtMillis,
  }));

  const normalizedSortBy = toCleanString(sortBy || 'latest_activity').toLowerCase();
  groups.sort((left, right) => {
    switch (normalizedSortBy) {
      case 'company_az': {
        const companyComparison = compareText(getGroupSortValue(left, 'company'), getGroupSortValue(right, 'company'));
        if (companyComparison !== 0) return companyComparison;
        return getGroupSortValue(right, 'latestActivity') - getGroupSortValue(left, 'latestActivity');
      }
      case 'oldest_applied':
        if (getGroupSortValue(left, 'oldestApplied') !== getGroupSortValue(right, 'oldestApplied')) {
          return getGroupSortValue(left, 'oldestApplied') - getGroupSortValue(right, 'oldestApplied');
        }
        return getGroupSortValue(right, 'latestActivity') - getGroupSortValue(left, 'latestActivity');
      case 'recent_applied':
        if (getGroupSortValue(right, 'newestApplied') !== getGroupSortValue(left, 'newestApplied')) {
          return getGroupSortValue(right, 'newestApplied') - getGroupSortValue(left, 'newestApplied');
        }
        return getGroupSortValue(right, 'latestActivity') - getGroupSortValue(left, 'latestActivity');
      case 'status': {
        const leftStatus = getDerivedApplicationStatus(left.applications?.[0]);
        const rightStatus = getDerivedApplicationStatus(right.applications?.[0]);
        const leftPriority = STATUS_SORT_PRIORITY[leftStatus] || STATUS_SORT_PRIORITY.UNKNOWN;
        const rightPriority = STATUS_SORT_PRIORITY[rightStatus] || STATUS_SORT_PRIORITY.UNKNOWN;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return getGroupSortValue(right, 'latestActivity') - getGroupSortValue(left, 'latestActivity');
      }
      case 'latest_activity':
      default:
        return getGroupSortValue(right, 'latestActivity') - getGroupSortValue(left, 'latestActivity');
    }
  });

  return groups;
};

export const buildCandidateApplicationFilterOptions = (applications = []) => {
  const safeApplications = Array.isArray(applications) ? applications : [];
  const metas = safeApplications.map((application) => getApplicationFilterMeta(application));

  const companyByNormalized = new Map();
  metas.forEach((meta) => {
    if (!meta.companyName) return;
    const normalized = normalizeForSearch(meta.companyName);
    if (!normalized) return;
    if (!companyByNormalized.has(normalized)) {
      companyByNormalized.set(normalized, meta.companyName);
    }
  });
  const companyOptions = [
    { value: 'all', label: 'All Companies' },
    ...Array.from(companyByNormalized.values())
      .sort((a, b) => compareText(a, b))
      .map((companyName) => ({
        value: companyName,
        label: companyName,
      })),
  ];

  const employmentTypes = new Set(
    metas
      .map((meta) => meta.employmentTypeCode)
      .filter(Boolean),
  );
  const employmentTypeOptions = [
    { value: 'all', label: 'All Employment Types' },
    ...Array.from(employmentTypes)
      .sort((a, b) => compareText(parseEmploymentTypeLabel(a), parseEmploymentTypeLabel(b)))
      .map((code) => ({
        value: code,
        label: parseEmploymentTypeLabel(code),
      })),
  ];

  const knownDispositionCodes = APPLICATION_DISPOSITION_OPTIONS.map((item) => item.value);
  const discoveredDispositionCodes = metas
    .map((meta) => meta.dispositionCode)
    .filter(Boolean);
  const allDispositionCodes = new Set([...knownDispositionCodes, ...discoveredDispositionCodes]);
  const dispositionOptions = [
    { value: 'all', label: 'All Outcomes' },
    ...Array.from(allDispositionCodes)
      .sort((a, b) => compareText(getDispositionLabel(a), getDispositionLabel(b)))
      .map((code) => ({
        value: code,
        label: getDispositionLabel(code),
      })),
  ];

  if (metas.some((meta) => !meta.dispositionCode)) {
    dispositionOptions.push({ value: 'none', label: 'No Recorded Outcome' });
  }

  return {
    companyOptions,
    employmentTypeOptions,
    dispositionOptions,
  };
};

export const countActiveCandidateFilters = (filters = {}) => {
  const current = { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, ...(filters || {}) };
  const isCustomDateRange = toCleanString(current.datePreset).toLowerCase() === 'custom';
  const entries = [
    ['searchQuery', (value) => normalizeForSearch(value).length > 0],
    ['statusFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['companyFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['employmentTypeFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['dispositionFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['jobStateFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['reviewStateFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['withdrawalFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['datePreset', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['appliedFrom', (value) => isCustomDateRange && toCleanString(value).length > 0],
    ['appliedTo', (value) => isCustomDateRange && toCleanString(value).length > 0],
    ['sortBy', (value) => toCleanString(value).toLowerCase() !== DEFAULT_CANDIDATE_APPLICATION_FILTERS.sortBy],
  ];

  return entries.reduce((count, [key, predicate]) => {
    if (predicate(current[key])) return count + 1;
    return count;
  }, 0);
};
