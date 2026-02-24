const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DATE_PRESET_DAY_LOOKBACK = Object.freeze({
  last7: 7,
  last30: 30,
  last90: 90,
  last180: 180,
});

const KNOWN_STATUS_CODES = new Set(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']);
const KNOWN_STAGE_CODES = Object.freeze(['SCREENING', 'INTERVIEW', 'FINAL']);

const STATUS_SORT_PRIORITY = Object.freeze({
  PENDING: 1,
  ACCEPTED: 2,
  EXPIRED: 3,
  REVOKED: 4,
  UNKNOWN: 99,
});

const LIFECYCLE_SORT_PRIORITY = Object.freeze({
  AWAITING_CANDIDATE: 1,
  IN_PROGRESS: 2,
  ACCEPTED_WITHOUT_INTERVIEW: 3,
  ACCEPTED_WITH_INTERVIEW: 4,
  EXPIRED: 5,
  REVOKED: 6,
  UNKNOWN: 99,
});

const STAGE_LABELS = Object.freeze({
  SCREENING: 'AI Screening',
  INTERVIEW: 'Live Interview',
  FINAL: 'Final Review',
});

export const INVITATION_STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
  UNKNOWN: 'Unknown',
});

export const INVITATION_LIFECYCLE_LABELS = Object.freeze({
  AWAITING_CANDIDATE: 'Awaiting Candidate',
  IN_PROGRESS: 'Acceptance In Progress',
  ACCEPTED_WITHOUT_INTERVIEW: 'Accepted (No Interview Link)',
  ACCEPTED_WITH_INTERVIEW: 'Accepted (Interview Linked)',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
  UNKNOWN: 'Unknown',
});

export const DEFAULT_INVITATION_FILTERS = Object.freeze({
  searchQuery: '',
  statusFilter: 'all',
  jobFilter: 'all',
  stageFilter: 'all',
  lifecycleFilter: 'all',
  candidateLinkFilter: 'all',
  datePreset: 'all',
  sentFrom: '',
  sentTo: '',
  sortBy: 'newest_created',
});

export const INVITATION_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'REVOKED', label: 'Revoked' },
  { value: 'UNKNOWN', label: 'Unknown' },
]);

export const INVITATION_LIFECYCLE_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Lifecycle States' },
  { value: 'AWAITING_CANDIDATE', label: INVITATION_LIFECYCLE_LABELS.AWAITING_CANDIDATE },
  { value: 'IN_PROGRESS', label: INVITATION_LIFECYCLE_LABELS.IN_PROGRESS },
  { value: 'ACCEPTED_WITHOUT_INTERVIEW', label: INVITATION_LIFECYCLE_LABELS.ACCEPTED_WITHOUT_INTERVIEW },
  { value: 'ACCEPTED_WITH_INTERVIEW', label: INVITATION_LIFECYCLE_LABELS.ACCEPTED_WITH_INTERVIEW },
  { value: 'EXPIRED', label: INVITATION_LIFECYCLE_LABELS.EXPIRED },
  { value: 'REVOKED', label: INVITATION_LIFECYCLE_LABELS.REVOKED },
  { value: 'UNKNOWN', label: INVITATION_LIFECYCLE_LABELS.UNKNOWN },
]);

export const INVITATION_CANDIDATE_LINK_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Candidate Link States' },
  { value: 'linked', label: 'Candidate Linked' },
  { value: 'unlinked', label: 'No Candidate Linked' },
]);

export const INVITATION_DATE_PRESET_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Dates' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'last180', label: 'Last 180 Days' },
  { value: 'custom', label: 'Custom Range' },
]);

export const INVITATION_SORT_FILTER_OPTIONS = Object.freeze([
  { value: 'newest_created', label: 'Newest Sent' },
  { value: 'oldest_created', label: 'Oldest Sent' },
  { value: 'newest_updated', label: 'Recently Updated' },
  { value: 'email_az', label: 'Email (A-Z)' },
  { value: 'job_az', label: 'Job (A-Z)' },
  { value: 'expires_soon', label: 'Expires Soon' },
  { value: 'status_priority', label: 'Status Priority' },
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
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toMillis = (value) => toDate(value)?.getTime?.() || 0;

const startOfDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const compareText = (left, right) =>
  toCleanString(left).localeCompare(toCleanString(right), undefined, { sensitivity: 'base' });

const formatUnknownStageLabel = (stageCode) => {
  const code = toUpperCode(stageCode);
  if (!code) return 'Unknown';
  return code
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const deriveEffectiveStatus = (invitation = {}, now = new Date()) => {
  const nowDate = toDate(now) || new Date();
  const rawStatus = toUpperCode(invitation?.status);
  const expiresAtDate = toDate(invitation?.expiresAt);
  const expiredByTime = Boolean(expiresAtDate && expiresAtDate.getTime() < nowDate.getTime());

  if ((rawStatus === 'PENDING' || !rawStatus) && expiredByTime) {
    return 'EXPIRED';
  }
  if (KNOWN_STATUS_CODES.has(rawStatus)) return rawStatus;
  return rawStatus || 'UNKNOWN';
};

const deriveLifecycleState = (invitation = {}, effectiveStatus = 'UNKNOWN') => {
  if (effectiveStatus === 'PENDING') {
    return invitation?.acceptanceInProgress ? 'IN_PROGRESS' : 'AWAITING_CANDIDATE';
  }
  if (effectiveStatus === 'ACCEPTED') {
    return invitation?.acceptedInterviewId
      ? 'ACCEPTED_WITH_INTERVIEW'
      : 'ACCEPTED_WITHOUT_INTERVIEW';
  }
  if (effectiveStatus === 'EXPIRED') return 'EXPIRED';
  if (effectiveStatus === 'REVOKED') return 'REVOKED';
  return 'UNKNOWN';
};

const buildDateWindow = (filters = {}, now = new Date()) => {
  const preset = toCleanString(filters?.datePreset || 'all').toLowerCase();
  const nowDate = toDate(now) || new Date();
  let start = null;
  let end = null;

  if (preset in DATE_PRESET_DAY_LOOKBACK) {
    const lookback = DATE_PRESET_DAY_LOOKBACK[preset];
    start = startOfDay(new Date(nowDate.getTime() - (lookback - 1) * DAY_IN_MS));
    end = endOfDay(nowDate);
  }

  if (preset === 'custom') {
    const customStart = startOfDay(filters?.sentFrom);
    const customEnd = endOfDay(filters?.sentTo);
    if (customStart) start = customStart;
    if (customEnd) end = customEnd;
  }

  if (start && end && start.getTime() > end.getTime()) {
    return { start: end, end: start };
  }

  return { start, end };
};

const buildJobLookup = (jobs = []) => {
  const lookup = new Map();
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  safeJobs.forEach((job) => {
    const id = toCleanString(job?.id);
    if (!id) return;
    lookup.set(id, {
      id,
      title: toCleanString(job?.title) || id,
    });
  });
  return lookup;
};

export const getInvitationFilterMeta = (invitation = {}, jobLookup = new Map(), options = {}) => {
  const now = options?.now ? toDate(options.now) || new Date() : new Date();
  const jobId = toCleanString(invitation?.jobId);
  const mappedJob = jobLookup.get(jobId);
  const fallbackJobTitle = toCleanString(
    invitation?.metadata?.jobTitle || invitation?.jobTitle || invitation?.job?.title || '',
  );
  const jobTitle = mappedJob?.title || fallbackJobTitle || (jobId || 'Unknown Job');

  const stageCode = toUpperCode(invitation?.stage || 'UNKNOWN');
  const stageLabel = STAGE_LABELS[stageCode] || formatUnknownStageLabel(stageCode);
  const createdAtDate = toDate(invitation?.createdAt || invitation?.updatedAt);
  const updatedAtDate = toDate(invitation?.updatedAt || invitation?.createdAt);
  const expiresAtDate = toDate(invitation?.expiresAt);
  const effectiveStatus = deriveEffectiveStatus(invitation, now);
  const lifecycleState = deriveLifecycleState(invitation, effectiveStatus);
  const hasCandidateLink = Boolean(
    invitation?.candidateUserId
      || invitation?.acceptedApplicationId
      || invitation?.acceptedInterviewId,
  );

  const searchText = normalizeForSearch([
    invitation?.email,
    jobId,
    jobTitle,
    stageCode,
    stageLabel,
    effectiveStatus,
    INVITATION_STATUS_LABELS[effectiveStatus] || effectiveStatus,
    lifecycleState,
    INVITATION_LIFECYCLE_LABELS[lifecycleState] || lifecycleState,
    invitation?.status,
    invitation?.candidateUserId,
    invitation?.invitedBy,
    invitation?.acceptedInterviewId,
    invitation?.acceptedApplicationId,
  ].filter(Boolean).join(' '));

  return {
    invitation,
    jobId,
    jobTitle,
    stageCode,
    stageLabel,
    effectiveStatus,
    lifecycleState,
    hasCandidateLink,
    createdAtDate,
    updatedAtDate,
    expiresAtDate,
    createdAtMillis: createdAtDate?.getTime?.() || 0,
    updatedAtMillis: updatedAtDate?.getTime?.() || 0,
    expiresAtMillis: expiresAtDate?.getTime?.() || 0,
    searchText,
  };
};

const matchesSearch = (meta, query) => {
  const normalized = normalizeForSearch(query);
  if (!normalized) return true;
  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => meta.searchText.includes(token));
};

const matchesCaseInsensitiveOption = (actualValue, selectedValue) => {
  const selected = normalizeForSearch(selectedValue);
  if (!selected || selected === 'all') return true;
  return normalizeForSearch(actualValue) === selected;
};

const matchesDateWindow = (meta, dateWindow) => {
  if (!dateWindow.start && !dateWindow.end) return true;
  if (!meta.createdAtDate) return false;
  const createdAt = meta.createdAtDate.getTime();
  if (dateWindow.start && createdAt < dateWindow.start.getTime()) return false;
  if (dateWindow.end && createdAt > dateWindow.end.getTime()) return false;
  return true;
};

const compareByDefault = (leftMeta, rightMeta) => {
  if (rightMeta.createdAtMillis !== leftMeta.createdAtMillis) {
    return rightMeta.createdAtMillis - leftMeta.createdAtMillis;
  }
  if (rightMeta.updatedAtMillis !== leftMeta.updatedAtMillis) {
    return rightMeta.updatedAtMillis - leftMeta.updatedAtMillis;
  }
  const emailComparison = compareText(leftMeta.invitation?.email, rightMeta.invitation?.email);
  if (emailComparison !== 0) return emailComparison;
  return compareText(leftMeta.invitation?.id, rightMeta.invitation?.id);
};

const sortInvitationMetas = (metas = [], sortBy = DEFAULT_INVITATION_FILTERS.sortBy) => {
  const normalizedSort = toCleanString(sortBy || DEFAULT_INVITATION_FILTERS.sortBy).toLowerCase();
  const sorted = [...metas];

  sorted.sort((leftMeta, rightMeta) => {
    switch (normalizedSort) {
      case 'oldest_created':
        if (leftMeta.createdAtMillis !== rightMeta.createdAtMillis) {
          return leftMeta.createdAtMillis - rightMeta.createdAtMillis;
        }
        return compareByDefault(leftMeta, rightMeta);
      case 'newest_updated':
        if (rightMeta.updatedAtMillis !== leftMeta.updatedAtMillis) {
          return rightMeta.updatedAtMillis - leftMeta.updatedAtMillis;
        }
        return compareByDefault(leftMeta, rightMeta);
      case 'email_az': {
        const emailComparison = compareText(leftMeta.invitation?.email, rightMeta.invitation?.email);
        if (emailComparison !== 0) return emailComparison;
        return compareByDefault(leftMeta, rightMeta);
      }
      case 'job_az': {
        const jobComparison = compareText(leftMeta.jobTitle, rightMeta.jobTitle);
        if (jobComparison !== 0) return jobComparison;
        return compareByDefault(leftMeta, rightMeta);
      }
      case 'expires_soon': {
        const leftPendingPriority = leftMeta.effectiveStatus === 'PENDING' ? 0 : 1;
        const rightPendingPriority = rightMeta.effectiveStatus === 'PENDING' ? 0 : 1;
        if (leftPendingPriority !== rightPendingPriority) {
          return leftPendingPriority - rightPendingPriority;
        }
        const leftExpiry = leftMeta.expiresAtMillis || Number.MAX_SAFE_INTEGER;
        const rightExpiry = rightMeta.expiresAtMillis || Number.MAX_SAFE_INTEGER;
        if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
        return compareByDefault(leftMeta, rightMeta);
      }
      case 'status_priority': {
        const leftStatusPriority = STATUS_SORT_PRIORITY[leftMeta.effectiveStatus] || STATUS_SORT_PRIORITY.UNKNOWN;
        const rightStatusPriority = STATUS_SORT_PRIORITY[rightMeta.effectiveStatus] || STATUS_SORT_PRIORITY.UNKNOWN;
        if (leftStatusPriority !== rightStatusPriority) {
          return leftStatusPriority - rightStatusPriority;
        }
        const leftLifecyclePriority = LIFECYCLE_SORT_PRIORITY[leftMeta.lifecycleState] || LIFECYCLE_SORT_PRIORITY.UNKNOWN;
        const rightLifecyclePriority = LIFECYCLE_SORT_PRIORITY[rightMeta.lifecycleState] || LIFECYCLE_SORT_PRIORITY.UNKNOWN;
        if (leftLifecyclePriority !== rightLifecyclePriority) {
          return leftLifecyclePriority - rightLifecyclePriority;
        }
        return compareByDefault(leftMeta, rightMeta);
      }
      case 'newest_created':
      default:
        return compareByDefault(leftMeta, rightMeta);
    }
  });

  return sorted;
};

export const filterInvitations = (invitations = [], filters = {}, options = {}) => {
  const activeFilters = { ...DEFAULT_INVITATION_FILTERS, ...(filters || {}) };
  const invitationList = Array.isArray(invitations) ? invitations : [];
  const jobLookup = buildJobLookup(options?.jobs || []);
  const dateWindow = buildDateWindow(activeFilters, options?.now);

  const metas = invitationList.map((invitation) =>
    getInvitationFilterMeta(invitation, jobLookup, { now: options?.now }));

  const filteredMetas = metas.filter((meta) => {
    if (!matchesSearch(meta, activeFilters.searchQuery)) return false;
    if (!matchesCaseInsensitiveOption(meta.effectiveStatus, activeFilters.statusFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.jobId, activeFilters.jobFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.stageCode, activeFilters.stageFilter)) return false;
    if (!matchesCaseInsensitiveOption(meta.lifecycleState, activeFilters.lifecycleFilter)) return false;
    if (!matchesDateWindow(meta, dateWindow)) return false;

    const linkFilter = normalizeForSearch(activeFilters.candidateLinkFilter);
    if (linkFilter === 'linked' && !meta.hasCandidateLink) return false;
    if (linkFilter === 'unlinked' && meta.hasCandidateLink) return false;

    return true;
  });

  return sortInvitationMetas(filteredMetas, activeFilters.sortBy);
};

export const buildInvitationFilterOptions = (invitations = [], jobs = [], options = {}) => {
  const invitationList = Array.isArray(invitations) ? invitations : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const jobLookup = buildJobLookup(safeJobs);
  const now = options?.now;

  const jobOptionMap = new Map();
  safeJobs.forEach((job) => {
    const id = toCleanString(job?.id);
    if (!id) return;
    const title = toCleanString(job?.title) || id;
    jobOptionMap.set(id, { value: id, label: title });
  });

  invitationList.forEach((invitation) => {
    const meta = getInvitationFilterMeta(invitation, jobLookup, { now });
    if (!meta.jobId || jobOptionMap.has(meta.jobId)) return;
    jobOptionMap.set(meta.jobId, { value: meta.jobId, label: meta.jobTitle });
  });

  const stageSet = new Set(KNOWN_STAGE_CODES);
  invitationList.forEach((invitation) => {
    const stageCode = toUpperCode(invitation?.stage || 'UNKNOWN');
    if (stageCode) stageSet.add(stageCode);
  });

  const stageOptions = [
    { value: 'all', label: 'All Stages' },
    ...Array.from(stageSet)
      .sort((left, right) => compareText(STAGE_LABELS[left] || formatUnknownStageLabel(left), STAGE_LABELS[right] || formatUnknownStageLabel(right)))
      .map((stageCode) => ({
        value: stageCode,
        label: STAGE_LABELS[stageCode] || formatUnknownStageLabel(stageCode),
      })),
  ];

  const jobOptions = [
    { value: 'all', label: 'All Jobs' },
    ...Array.from(jobOptionMap.values()).sort((left, right) => compareText(left.label, right.label)),
  ];

  return {
    jobOptions,
    stageOptions,
  };
};

export const countActiveInvitationFilters = (filters = {}) => {
  const current = { ...DEFAULT_INVITATION_FILTERS, ...(filters || {}) };
  const isCustomDateRange = toCleanString(current.datePreset).toLowerCase() === 'custom';

  const entries = [
    ['searchQuery', (value) => normalizeForSearch(value).length > 0],
    ['statusFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['jobFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['stageFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['lifecycleFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['candidateLinkFilter', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['datePreset', (value) => toCleanString(value).toLowerCase() !== 'all'],
    ['sentFrom', (value) => isCustomDateRange && toCleanString(value).length > 0],
    ['sentTo', (value) => isCustomDateRange && toCleanString(value).length > 0],
    ['sortBy', (value) => toCleanString(value).toLowerCase() !== DEFAULT_INVITATION_FILTERS.sortBy],
  ];

  return entries.reduce((count, [key, predicate]) => {
    if (predicate(current[key])) return count + 1;
    return count;
  }, 0);
};

