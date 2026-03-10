const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DATE_PRESET_DAY_LOOKBACK = Object.freeze({
  last24h: 1,
  last7: 7,
  last30: 30,
  last90: 90,
  last180: 180,
  last365: 365,
});

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
  'zoho.com',
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

const startOfDay = (value) => {
  const parsed = toDate(value);
  if (!parsed) return null;
  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const parsed = toDate(value);
  if (!parsed) return null;
  const date = new Date(parsed);
  date.setHours(23, 59, 59, 999);
  return date;
};

const compareText = (left, right) =>
  toCleanString(left).localeCompare(toCleanString(right), undefined, { sensitivity: 'base' });

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOptionalNumber = (value) => {
  const normalized = toCleanString(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDomain = (value) => {
  const text = toCleanString(value).toLowerCase();
  if (!text || !text.includes('@')) return null;
  const domain = text.split('@').pop();
  return domain || null;
};

const domainCategory = (email) => {
  const domain = toDomain(email);
  if (!domain) return 'MISSING';
  if (FREE_EMAIL_DOMAINS.has(domain)) return 'FREE';
  return 'BUSINESS';
};

const asSet = (values = []) =>
  new Set(values.map((value) => toCleanString(value)).filter(Boolean));

const toSortedOptions = (values = [], { includeAllLabel = 'All', allValue = 'all' } = {}) => {
  const unique = Array.from(asSet(values));
  unique.sort((a, b) => compareText(a, b));
  return [
    { value: allValue, label: includeAllLabel },
    ...unique.map((value) => ({ value, label: value })),
  ];
};

const buildDateWindow = ({
  preset = 'all',
  from = '',
  to = '',
  now = new Date(),
} = {}) => {
  const normalizedPreset = toCleanString(preset).toLowerCase();
  const nowDate = toDate(now) || new Date();
  let start = null;
  let end = null;

  if (normalizedPreset in DATE_PRESET_DAY_LOOKBACK) {
    const lookbackDays = DATE_PRESET_DAY_LOOKBACK[normalizedPreset];
    start = startOfDay(new Date(nowDate.getTime() - (lookbackDays - 1) * DAY_IN_MS));
    end = endOfDay(nowDate);
  }

  if (normalizedPreset === 'custom') {
    const customStart = startOfDay(from);
    const customEnd = endOfDay(to);
    if (customStart) start = customStart;
    if (customEnd) end = customEnd;
  }

  if (start && end && start.getTime() > end.getTime()) {
    return { start: end, end: start };
  }

  return { start, end };
};

const isDateWithinWindow = (value, dateWindow) => {
  if (!dateWindow?.start && !dateWindow?.end) return true;
  const date = toDate(value);
  if (!date) return false;
  const millis = date.getTime();
  if (dateWindow.start && millis < dateWindow.start.getTime()) return false;
  if (dateWindow.end && millis > dateWindow.end.getTime()) return false;
  return true;
};

const matchesSearchTokens = (searchText, query) => {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => searchText.includes(token));
};

const normalizeFilterValue = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean') return value ? '__YES__' : '__NO__';
  if (value == null) return '';
  return String(value);
};

const countChangedFilterKeys = (defaults = {}, filters = {}, ignoredKeys = []) => {
  const ignored = new Set(ignoredKeys);
  const keys = new Set([...Object.keys(defaults || {}), ...Object.keys(filters || {})]);
  let count = 0;
  keys.forEach((key) => {
    if (ignored.has(key)) return;
    const defaultValue = normalizeFilterValue(defaults[key]);
    const activeValue = normalizeFilterValue(filters[key]);
    if (defaultValue !== activeValue) count += 1;
  });
  return count;
};

const toLabelFromCode = (value) =>
  toCleanString(value)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const compareByNewestDate = (leftDate, rightDate) => toMillis(rightDate) - toMillis(leftDate);

const compareByOldestDate = (leftDate, rightDate) => toMillis(leftDate) - toMillis(rightDate);

export const ADMIN_DATE_PRESET_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Dates' },
  { value: 'last24h', label: 'Last 24 Hours' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'last180', label: 'Last 180 Days' },
  { value: 'last365', label: 'Last 365 Days' },
  { value: 'custom', label: 'Custom Range' },
]);

// -----------------------------------------------------------------------------
// Organization Directory Filters
// -----------------------------------------------------------------------------

const ORGANIZATION_STATUS_PRIORITY = Object.freeze({
  PENDING: 1,
  APPROVED: 2,
  SUSPENDED: 3,
  REJECTED: 4,
  UNKNOWN: 99,
});

export const DEFAULT_ADMIN_ORGANIZATION_FILTERS = Object.freeze({
  searchQuery: '',
  statusFilter: 'all',
  industryFilter: 'all',
  companySizeFilter: 'all',
  ownerDomainFilter: 'all',
  reReviewFilter: 'all',
  registrationDatePreset: 'all',
  registrationFrom: '',
  registrationTo: '',
  sortBy: 'registration_newest',
});

export const ADMIN_ORGANIZATION_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
]);

export const ADMIN_ORGANIZATION_OWNER_DOMAIN_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Owner Email Domains' },
  { value: 'BUSINESS', label: 'Business Domain' },
  { value: 'FREE', label: 'Public Email Domain' },
  { value: 'MISSING', label: 'No Owner Email' },
]);

export const ADMIN_ORGANIZATION_REREVIEW_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Re-review States' },
  { value: 'REQUESTED', label: 'Re-review Requested' },
  { value: 'MULTIPLE', label: 'Multiple Re-review Requests' },
  { value: 'NONE', label: 'No Re-review Request' },
]);

export const ADMIN_ORGANIZATION_SORT_FILTER_OPTIONS = Object.freeze([
  { value: 'registration_newest', label: 'Newest Registration' },
  { value: 'registration_oldest', label: 'Oldest Registration' },
  { value: 'recently_updated', label: 'Recently Updated' },
  { value: 'organization_az', label: 'Organization A-Z' },
  { value: 'owner_az', label: 'Owner A-Z' },
  { value: 'status_priority', label: 'Status Priority' },
  { value: 'rereview_priority', label: 'Re-review Priority' },
]);

const getOrganizationMeta = (organization = {}) => {
  const status = toUpperCode(organization?.status) || 'UNKNOWN';
  const name = toCleanString(organization?.displayName || organization?.name || '');
  const ownerName = toCleanString(organization?.owner?.fullName || '');
  const ownerEmail = toCleanString(organization?.owner?.email || '');
  const reReviewCount = Math.max(0, Math.round(normalizeNumber(organization?.reReviewRequestCount, 0)));
  const reReviewState = reReviewCount > 1
    ? 'MULTIPLE'
    : ((organization?.reReviewRequestedAt || reReviewCount > 0) ? 'REQUESTED' : 'NONE');
  const createdAt = toDate(organization?.createdAt);
  const updatedAt = toDate(organization?.updatedAt || organization?.approvedAt || organization?.rejectedAt);
  const ownerDomainState = domainCategory(ownerEmail);

  const searchText = normalizeForSearch([
    organization?.id,
    name,
    ownerName,
    ownerEmail,
    organization?.industry,
    organization?.companySize,
    status,
    toLabelFromCode(status),
    organization?.rejectedReason,
    organization?.suspensionReason,
    organization?.reReviewRequestNote,
  ].filter(Boolean).join(' '));

  return {
    organization,
    status,
    name,
    ownerName,
    ownerEmail,
    industry: toCleanString(organization?.industry),
    companySize: toCleanString(organization?.companySize),
    reReviewState,
    reReviewCount,
    ownerDomainState,
    createdAt,
    updatedAt,
    createdAtMillis: createdAt?.getTime?.() || 0,
    updatedAtMillis: updatedAt?.getTime?.() || 0,
    searchText,
  };
};

const sortOrganizationMetas = (metas = [], sortBy = 'registration_newest') => {
  const normalizedSort = toCleanString(sortBy || 'registration_newest').toLowerCase();
  const sorted = [...metas];

  sorted.sort((left, right) => {
    switch (normalizedSort) {
      case 'registration_oldest': {
        const oldestDelta = compareByOldestDate(left.createdAt, right.createdAt);
        if (oldestDelta !== 0) return oldestDelta;
        return compareText(left.name, right.name);
      }
      case 'recently_updated': {
        if (right.updatedAtMillis !== left.updatedAtMillis) {
          return right.updatedAtMillis - left.updatedAtMillis;
        }
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'organization_az': {
        const nameDelta = compareText(left.name, right.name);
        if (nameDelta !== 0) return nameDelta;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'owner_az': {
        const ownerDelta = compareText(left.ownerName || left.ownerEmail, right.ownerName || right.ownerEmail);
        if (ownerDelta !== 0) return ownerDelta;
        return compareText(left.name, right.name);
      }
      case 'status_priority': {
        const leftPriority = ORGANIZATION_STATUS_PRIORITY[left.status] || ORGANIZATION_STATUS_PRIORITY.UNKNOWN;
        const rightPriority = ORGANIZATION_STATUS_PRIORITY[right.status] || ORGANIZATION_STATUS_PRIORITY.UNKNOWN;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'rereview_priority': {
        if (right.reReviewCount !== left.reReviewCount) return right.reReviewCount - left.reReviewCount;
        return compareByOldestDate(left.createdAt, right.createdAt);
      }
      case 'registration_newest':
      default: {
        const newestDelta = compareByNewestDate(left.createdAt, right.createdAt);
        if (newestDelta !== 0) return newestDelta;
        return compareText(left.name, right.name);
      }
    }
  });

  return sorted;
};

export const filterAdminOrganizations = (organizations = [], filters = {}, options = {}) => {
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];
  const activeFilters = { ...DEFAULT_ADMIN_ORGANIZATION_FILTERS, ...(filters || {}) };
  const registrationWindow = buildDateWindow({
    preset: activeFilters.registrationDatePreset,
    from: activeFilters.registrationFrom,
    to: activeFilters.registrationTo,
    now: options?.now,
  });

  const metas = safeOrganizations.map((organization) => getOrganizationMeta(organization));
  const filtered = metas.filter((meta) => {
    if (!matchesSearchTokens(meta.searchText, activeFilters.searchQuery)) return false;

    const statusFilter = toUpperCode(activeFilters.statusFilter);
    if (statusFilter && statusFilter !== 'ALL' && meta.status !== statusFilter) return false;

    if (toCleanString(activeFilters.industryFilter).toLowerCase() !== 'all') {
      if (normalizeForSearch(meta.industry) !== normalizeForSearch(activeFilters.industryFilter)) return false;
    }

    if (toCleanString(activeFilters.companySizeFilter).toLowerCase() !== 'all') {
      if (normalizeForSearch(meta.companySize) !== normalizeForSearch(activeFilters.companySizeFilter)) return false;
    }

    const ownerDomainFilter = toUpperCode(activeFilters.ownerDomainFilter);
    if (ownerDomainFilter && ownerDomainFilter !== 'ALL' && meta.ownerDomainState !== ownerDomainFilter) return false;

    const reReviewFilter = toUpperCode(activeFilters.reReviewFilter);
    if (reReviewFilter && reReviewFilter !== 'ALL' && meta.reReviewState !== reReviewFilter) return false;

    if (!isDateWithinWindow(meta.createdAt, registrationWindow)) return false;

    return true;
  });

  return sortOrganizationMetas(filtered, activeFilters.sortBy).map((meta) => meta.organization);
};

export const buildAdminOrganizationFilterOptions = (organizations = []) => {
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];
  return {
    industryOptions: toSortedOptions(
      safeOrganizations.map((organization) => organization?.industry),
      { includeAllLabel: 'All Industries' },
    ),
    companySizeOptions: toSortedOptions(
      safeOrganizations.map((organization) => organization?.companySize),
      { includeAllLabel: 'All Company Sizes' },
    ),
  };
};

export const countActiveAdminOrganizationFilters = (filters = {}) =>
  countChangedFilterKeys(DEFAULT_ADMIN_ORGANIZATION_FILTERS, filters);

// -----------------------------------------------------------------------------
// User Management Filters
// -----------------------------------------------------------------------------

const USER_STATUS_PRIORITY = Object.freeze({
  ACTIVE: 1,
  SUSPENDED: 2,
  UNKNOWN: 99,
});

const USER_ACCOUNT_TYPE_PRIORITY = Object.freeze({
  SYSTEM_ADMIN: 1,
  COMPANY: 2,
  CANDIDATE: 3,
  UNKNOWN: 99,
});

export const DEFAULT_ADMIN_USER_FILTERS = Object.freeze({
  searchQuery: '',
  accountTypeFilter: 'all',
  statusFilter: 'all',
  organizationPresenceFilter: 'all',
  organizationStatusFilter: 'all',
  emailDomainFilter: 'all',
  suspensionFilter: 'all',
  createdDatePreset: 'all',
  createdFrom: '',
  createdTo: '',
  sortBy: 'created_newest',
});

export const ADMIN_USER_ACCOUNT_TYPE_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Account Types' },
  { value: 'CANDIDATE', label: 'Candidate' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'SYSTEM_ADMIN', label: 'System Admin' },
]);

export const ADMIN_USER_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
]);

export const ADMIN_USER_ORGANIZATION_PRESENCE_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Organization States' },
  { value: 'WITH_ORG', label: 'Has Organization' },
  { value: 'WITHOUT_ORG', label: 'No Organization' },
]);

export const ADMIN_USER_ORGANIZATION_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Organization Statuses' },
  { value: 'APPROVED', label: 'Approved Organization' },
  { value: 'PENDING', label: 'Pending Organization' },
  { value: 'REJECTED', label: 'Rejected Organization' },
  { value: 'SUSPENDED', label: 'Suspended Organization' },
  { value: 'NONE', label: 'No Organization' },
]);

export const ADMIN_USER_EMAIL_DOMAIN_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Email Domains' },
  { value: 'BUSINESS', label: 'Business Domain' },
  { value: 'FREE', label: 'Public Email Domain' },
  { value: 'MISSING', label: 'No Email' },
]);

export const ADMIN_USER_SUSPENSION_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Suspension States' },
  { value: 'CURRENTLY_SUSPENDED', label: 'Currently Suspended' },
  { value: 'EVER_SUSPENDED', label: 'Previously Suspended' },
  { value: 'NEVER_SUSPENDED', label: 'Never Suspended' },
  { value: 'WITH_REASON', label: 'Has Suspension Reason' },
  { value: 'WITHOUT_REASON', label: 'No Suspension Reason' },
]);

export const ADMIN_USER_SORT_FILTER_OPTIONS = Object.freeze([
  { value: 'created_newest', label: 'Newest Account' },
  { value: 'created_oldest', label: 'Oldest Account' },
  { value: 'updated_newest', label: 'Recently Updated' },
  { value: 'name_az', label: 'Name A-Z' },
  { value: 'email_az', label: 'Email A-Z' },
  { value: 'status_priority', label: 'Status Priority' },
  { value: 'account_type', label: 'Account Type' },
]);

const getUserMeta = (user = {}) => {
  const accountType = toUpperCode(user?.accountType) || 'UNKNOWN';
  const status = toUpperCode(user?.accountStatus || 'ACTIVE') || 'ACTIVE';
  const fullName = toCleanString(user?.fullName || '');
  const email = toCleanString(user?.email || '');
  const hasOrganization = Boolean(user?.organization?.id || user?.primaryOrganizationId);
  const organizationStatus = hasOrganization
    ? (toUpperCode(user?.organization?.status) || 'UNKNOWN')
    : 'NONE';
  const createdAt = toDate(user?.createdAt);
  const updatedAt = toDate(user?.updatedAt);
  const suspendedAt = toDate(user?.suspendedAt);
  const suspensionReason = toCleanString(user?.suspensionReason || '');
  const hasSuspensionReason = Boolean(suspensionReason);
  const domainState = domainCategory(email);

  const searchText = normalizeForSearch([
    user?.id,
    fullName,
    email,
    user?.companyName,
    user?.organization?.name,
    accountType,
    status,
    toLabelFromCode(accountType),
    toLabelFromCode(status),
    suspensionReason,
  ].filter(Boolean).join(' '));

  return {
    user,
    accountType,
    status,
    fullName,
    email,
    hasOrganization,
    organizationStatus,
    createdAt,
    updatedAt,
    suspendedAt,
    hasSuspensionReason,
    domainState,
    searchText,
  };
};

const sortUserMetas = (metas = [], sortBy = 'created_newest') => {
  const normalizedSort = toCleanString(sortBy || 'created_newest').toLowerCase();
  const sorted = [...metas];

  sorted.sort((left, right) => {
    switch (normalizedSort) {
      case 'created_oldest': {
        const delta = compareByOldestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.fullName || left.email, right.fullName || right.email);
      }
      case 'updated_newest': {
        const delta = compareByNewestDate(left.updatedAt, right.updatedAt);
        if (delta !== 0) return delta;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'name_az': {
        const delta = compareText(left.fullName || left.email, right.fullName || right.email);
        if (delta !== 0) return delta;
        return compareText(left.email, right.email);
      }
      case 'email_az': {
        const delta = compareText(left.email, right.email);
        if (delta !== 0) return delta;
        return compareText(left.fullName, right.fullName);
      }
      case 'status_priority': {
        const leftPriority = USER_STATUS_PRIORITY[left.status] || USER_STATUS_PRIORITY.UNKNOWN;
        const rightPriority = USER_STATUS_PRIORITY[right.status] || USER_STATUS_PRIORITY.UNKNOWN;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'account_type': {
        const leftPriority = USER_ACCOUNT_TYPE_PRIORITY[left.accountType] || USER_ACCOUNT_TYPE_PRIORITY.UNKNOWN;
        const rightPriority = USER_ACCOUNT_TYPE_PRIORITY[right.accountType] || USER_ACCOUNT_TYPE_PRIORITY.UNKNOWN;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'created_newest':
      default: {
        const delta = compareByNewestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.fullName || left.email, right.fullName || right.email);
      }
    }
  });

  return sorted;
};

export const filterAdminUsers = (users = [], filters = {}, options = {}) => {
  const safeUsers = Array.isArray(users) ? users : [];
  const activeFilters = { ...DEFAULT_ADMIN_USER_FILTERS, ...(filters || {}) };
  const createdWindow = buildDateWindow({
    preset: activeFilters.createdDatePreset,
    from: activeFilters.createdFrom,
    to: activeFilters.createdTo,
    now: options?.now,
  });

  const metas = safeUsers.map((user) => getUserMeta(user));
  const filtered = metas.filter((meta) => {
    if (!matchesSearchTokens(meta.searchText, activeFilters.searchQuery)) return false;

    const accountTypeFilter = toUpperCode(activeFilters.accountTypeFilter);
    if (accountTypeFilter && accountTypeFilter !== 'ALL' && meta.accountType !== accountTypeFilter) return false;

    const statusFilter = toUpperCode(activeFilters.statusFilter);
    if (statusFilter && statusFilter !== 'ALL' && meta.status !== statusFilter) return false;

    const organizationPresenceFilter = toUpperCode(activeFilters.organizationPresenceFilter);
    if (organizationPresenceFilter === 'WITH_ORG' && !meta.hasOrganization) return false;
    if (organizationPresenceFilter === 'WITHOUT_ORG' && meta.hasOrganization) return false;

    const organizationStatusFilter = toUpperCode(activeFilters.organizationStatusFilter);
    if (organizationStatusFilter && organizationStatusFilter !== 'ALL') {
      if (meta.organizationStatus !== organizationStatusFilter) return false;
    }

    const emailDomainFilter = toUpperCode(activeFilters.emailDomainFilter);
    if (emailDomainFilter && emailDomainFilter !== 'ALL' && meta.domainState !== emailDomainFilter) return false;

    const suspensionFilter = toUpperCode(activeFilters.suspensionFilter);
    if (suspensionFilter && suspensionFilter !== 'ALL') {
      const currentlySuspended = meta.status === 'SUSPENDED';
      const everSuspended = currentlySuspended || Boolean(meta.suspendedAt);
      if (suspensionFilter === 'CURRENTLY_SUSPENDED' && !currentlySuspended) return false;
      if (suspensionFilter === 'EVER_SUSPENDED' && !everSuspended) return false;
      if (suspensionFilter === 'NEVER_SUSPENDED' && everSuspended) return false;
      if (suspensionFilter === 'WITH_REASON' && !meta.hasSuspensionReason) return false;
      if (suspensionFilter === 'WITHOUT_REASON' && meta.hasSuspensionReason) return false;
    }

    if (!isDateWithinWindow(meta.createdAt, createdWindow)) return false;

    return true;
  });

  return sortUserMetas(filtered, activeFilters.sortBy).map((meta) => meta.user);
};

export const buildAdminUserFilterOptions = (users = []) => {
  const safeUsers = Array.isArray(users) ? users : [];
  const organizationStatuses = safeUsers
    .map((user) => (user?.organization?.status ? toUpperCode(user.organization.status) : null))
    .filter(Boolean);

  return {
    organizationStatusOptions: [
      ...ADMIN_USER_ORGANIZATION_STATUS_FILTER_OPTIONS,
      ...Array.from(new Set(organizationStatuses))
        .filter((status) =>
          !ADMIN_USER_ORGANIZATION_STATUS_FILTER_OPTIONS.some((option) => option.value === status),
        )
        .sort((left, right) => compareText(left, right))
        .map((status) => ({ value: status, label: toLabelFromCode(status) })),
    ],
  };
};

export const countActiveAdminUserFilters = (filters = {}) =>
  countChangedFilterKeys(DEFAULT_ADMIN_USER_FILTERS, filters);

// -----------------------------------------------------------------------------
// Audit Log Filters
// -----------------------------------------------------------------------------

const getAuditActionCategory = (action) => {
  const normalizedAction = toUpperCode(action);
  if (normalizedAction.startsWith('ORG_')) return 'ORGANIZATION';
  if (normalizedAction.startsWith('USER_')) return 'USER';
  if (normalizedAction.includes('SETTING')) return 'SETTINGS';
  if (normalizedAction.includes('DATASET')) return 'DATASET';
  if (normalizedAction.includes('BILLING') || normalizedAction.includes('RETENTION')) return 'OPERATIONS';
  if (normalizedAction.startsWith('ADMIN_')) return 'SECURITY';
  return 'OTHER';
};

export const DEFAULT_ADMIN_AUDIT_FILTERS = Object.freeze({
  searchQuery: '',
  actionFilter: 'all',
  categoryFilter: 'all',
  actorTypeFilter: 'all',
  targetTypeFilter: 'all',
  metadataFilter: 'all',
  datePreset: 'all',
  from: '',
  to: '',
  sortBy: 'newest',
});

export const ADMIN_AUDIT_CATEGORY_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Categories' },
  { value: 'ORGANIZATION', label: 'Organization' },
  { value: 'USER', label: 'User' },
  { value: 'SETTINGS', label: 'Settings' },
  { value: 'DATASET', label: 'Dataset' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'OTHER', label: 'Other' },
]);

export const ADMIN_AUDIT_METADATA_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Metadata States' },
  { value: 'WITH_METADATA', label: 'With Metadata' },
  { value: 'WITHOUT_METADATA', label: 'Without Metadata' },
]);

export const ADMIN_AUDIT_SORT_FILTER_OPTIONS = Object.freeze([
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'action_az', label: 'Action A-Z' },
  { value: 'actor_az', label: 'Actor A-Z' },
  { value: 'target_type', label: 'Target Type' },
]);

const flattenMetadataText = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return '';
  return Object.entries(metadata)
    .map(([key, value]) => `${key} ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' ');
};

const getAuditMeta = (log = {}) => {
  const action = toUpperCode(log?.action) || 'UNKNOWN';
  const actorType = toUpperCode(log?.actorType || log?.actor?.accountType || '');
  const targetType = toUpperCode(log?.targetType || '');
  const metadataText = flattenMetadataText(log?.metadata);
  const createdAt = toDate(log?.createdAt || log?.timestamp);
  const category = getAuditActionCategory(action);
  const actorLabel = toCleanString(log?.actor?.fullName || log?.actor?.email || log?.actorId || '');

  const searchText = normalizeForSearch([
    log?.id,
    action,
    toLabelFromCode(action),
    actorType,
    actorLabel,
    targetType,
    log?.targetId,
    metadataText,
  ].filter(Boolean).join(' '));

  return {
    log,
    action,
    actorType: actorType || 'UNKNOWN',
    targetType: targetType || 'UNKNOWN',
    category,
    createdAt,
    actorLabel,
    hasMetadata: Boolean(log?.metadata && Object.keys(log.metadata).length > 0),
    searchText,
  };
};

const sortAuditMetas = (metas = [], sortBy = 'newest') => {
  const normalizedSort = toCleanString(sortBy || 'newest').toLowerCase();
  const sorted = [...metas];

  sorted.sort((left, right) => {
    switch (normalizedSort) {
      case 'oldest': {
        const delta = compareByOldestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.action, right.action);
      }
      case 'action_az': {
        const delta = compareText(left.action, right.action);
        if (delta !== 0) return delta;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'actor_az': {
        const delta = compareText(left.actorLabel, right.actorLabel);
        if (delta !== 0) return delta;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'target_type': {
        const delta = compareText(left.targetType, right.targetType);
        if (delta !== 0) return delta;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'newest':
      default: {
        const delta = compareByNewestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.action, right.action);
      }
    }
  });

  return sorted;
};

export const filterAdminAuditLogs = (logs = [], filters = {}, options = {}) => {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const activeFilters = { ...DEFAULT_ADMIN_AUDIT_FILTERS, ...(filters || {}) };
  const dateWindow = buildDateWindow({
    preset: activeFilters.datePreset,
    from: activeFilters.from,
    to: activeFilters.to,
    now: options?.now,
  });

  const metas = safeLogs.map((log) => getAuditMeta(log));
  const filtered = metas.filter((meta) => {
    if (!matchesSearchTokens(meta.searchText, activeFilters.searchQuery)) return false;

    const actionFilter = toUpperCode(activeFilters.actionFilter);
    if (actionFilter && actionFilter !== 'ALL' && meta.action !== actionFilter) return false;

    const categoryFilter = toUpperCode(activeFilters.categoryFilter);
    if (categoryFilter && categoryFilter !== 'ALL' && meta.category !== categoryFilter) return false;

    const actorTypeFilter = toUpperCode(activeFilters.actorTypeFilter);
    if (actorTypeFilter && actorTypeFilter !== 'ALL' && meta.actorType !== actorTypeFilter) return false;

    const targetTypeFilter = toUpperCode(activeFilters.targetTypeFilter);
    if (targetTypeFilter && targetTypeFilter !== 'ALL' && meta.targetType !== targetTypeFilter) return false;

    const metadataFilter = toUpperCode(activeFilters.metadataFilter);
    if (metadataFilter === 'WITH_METADATA' && !meta.hasMetadata) return false;
    if (metadataFilter === 'WITHOUT_METADATA' && meta.hasMetadata) return false;

    if (!isDateWithinWindow(meta.createdAt, dateWindow)) return false;

    return true;
  });

  return sortAuditMetas(filtered, activeFilters.sortBy).map((meta) => meta.log);
};

export const buildAdminAuditFilterOptions = (logs = []) => {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const actions = safeLogs.map((log) => toUpperCode(log?.action)).filter(Boolean);
  const actorTypes = safeLogs.map((log) => toUpperCode(log?.actorType || log?.actor?.accountType)).filter(Boolean);
  const targetTypes = safeLogs.map((log) => toUpperCode(log?.targetType)).filter(Boolean);

  return {
    actionOptions: [
      { value: 'all', label: 'All Actions' },
      ...Array.from(new Set(actions))
        .sort((left, right) => compareText(left, right))
        .map((action) => ({ value: action, label: toLabelFromCode(action) })),
    ],
    actorTypeOptions: [
      { value: 'all', label: 'All Actor Types' },
      ...Array.from(new Set(actorTypes))
        .sort((left, right) => compareText(left, right))
        .map((actorType) => ({ value: actorType, label: toLabelFromCode(actorType) })),
    ],
    targetTypeOptions: [
      { value: 'all', label: 'All Target Types' },
      ...Array.from(new Set(targetTypes))
        .sort((left, right) => compareText(left, right))
        .map((targetType) => ({ value: targetType, label: toLabelFromCode(targetType) })),
    ],
  };
};

export const countActiveAdminAuditFilters = (filters = {}) =>
  countChangedFilterKeys(DEFAULT_ADMIN_AUDIT_FILTERS, filters);

// -----------------------------------------------------------------------------
// Live Chat Filters
// -----------------------------------------------------------------------------

export const DEFAULT_ADMIN_LIVE_CHAT_FILTERS = Object.freeze({
  searchQuery: '',
  statusFilter: 'open',
  responseStateFilter: 'all',
  audienceFilter: 'all',
  activityPreset: 'all',
  sortBy: 'latest_activity',
});

export const ADMIN_LIVE_CHAT_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
]);

export const ADMIN_LIVE_CHAT_RESPONSE_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Response States' },
  { value: 'waiting', label: 'Waiting for Admin' },
  { value: 'responded', label: 'Admin Responded' },
  { value: 'unresponded', label: 'No Admin Response' },
  { value: 'no_messages', label: 'No Messages Yet' },
]);

export const ADMIN_LIVE_CHAT_ACTIVITY_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Activity' },
  { value: 'last24h', label: 'Active Last 24h' },
  { value: 'last7', label: 'Active Last 7d' },
  { value: 'last30', label: 'Active Last 30d' },
  { value: 'stale7', label: 'Inactive > 7d' },
  { value: 'stale30', label: 'Inactive > 30d' },
]);

export const ADMIN_LIVE_CHAT_SORT_FILTER_OPTIONS = Object.freeze([
  { value: 'latest_activity', label: 'Latest Activity' },
  { value: 'oldest_activity', label: 'Oldest Activity' },
  { value: 'waiting_first', label: 'Waiting First' },
  { value: 'open_first', label: 'Open First' },
  { value: 'name_az', label: 'Visitor Name A-Z' },
]);

const getLiveChatMeta = (chat = {}, now = new Date()) => {
  const status = toUpperCode(chat?.status) === 'CLOSED' ? 'CLOSED' : 'OPEN';
  const audience = toUpperCode(chat?.user?.accountType || 'ANONYMOUS') || 'ANONYMOUS';
  const displayName = toCleanString(chat?.user?.displayName || '');
  const email = toCleanString(chat?.user?.email || '');
  const companyName = toCleanString(chat?.user?.companyName || '');
  const lastActivity = toDate(chat?.lastMessageAt || chat?.updatedAt || chat?.createdAt);
  const responded = Boolean(chat?.respondedAt || chat?.respondedBy);
  const hasMessages = Boolean(chat?.lastMessageAt || chat?.lastMessagePreview);
  const waiting = status === 'OPEN' && !responded;

  const nowDate = toDate(now) || new Date();
  const inactivityMs = lastActivity ? Math.max(0, nowDate.getTime() - lastActivity.getTime()) : Number.POSITIVE_INFINITY;

  const searchText = normalizeForSearch([
    chat?.id,
    displayName,
    email,
    companyName,
    audience,
    status,
    chat?.lastMessagePreview,
    chat?.respondedBy,
  ].filter(Boolean).join(' '));

  return {
    chat,
    status,
    audience,
    displayName,
    email,
    companyName,
    responded,
    waiting,
    hasMessages,
    lastActivity,
    inactivityMs,
    searchText,
  };
};

const sortLiveChatMetas = (metas = [], sortBy = 'latest_activity') => {
  const normalizedSort = toCleanString(sortBy || 'latest_activity').toLowerCase();
  const sorted = [...metas];

  sorted.sort((left, right) => {
    switch (normalizedSort) {
      case 'oldest_activity': {
        const delta = compareByOldestDate(left.lastActivity, right.lastActivity);
        if (delta !== 0) return delta;
        return compareText(left.displayName || left.email, right.displayName || right.email);
      }
      case 'waiting_first': {
        if (left.waiting !== right.waiting) return left.waiting ? -1 : 1;
        const delta = compareByOldestDate(left.lastActivity, right.lastActivity);
        if (delta !== 0) return delta;
        return compareText(left.displayName || left.email, right.displayName || right.email);
      }
      case 'open_first': {
        if (left.status !== right.status) return left.status === 'OPEN' ? -1 : 1;
        return compareByNewestDate(left.lastActivity, right.lastActivity);
      }
      case 'name_az': {
        const delta = compareText(left.displayName || left.email, right.displayName || right.email);
        if (delta !== 0) return delta;
        return compareByNewestDate(left.lastActivity, right.lastActivity);
      }
      case 'latest_activity':
      default: {
        const delta = compareByNewestDate(left.lastActivity, right.lastActivity);
        if (delta !== 0) return delta;
        return compareText(left.displayName || left.email, right.displayName || right.email);
      }
    }
  });

  return sorted;
};

const matchesLiveChatActivityPreset = (meta, preset) => {
  const normalizedPreset = toCleanString(preset).toLowerCase();
  if (!normalizedPreset || normalizedPreset === 'all') return true;

  if (normalizedPreset === 'last24h') return meta.inactivityMs <= DAY_IN_MS;
  if (normalizedPreset === 'last7') return meta.inactivityMs <= 7 * DAY_IN_MS;
  if (normalizedPreset === 'last30') return meta.inactivityMs <= 30 * DAY_IN_MS;
  if (normalizedPreset === 'stale7') return meta.inactivityMs > 7 * DAY_IN_MS;
  if (normalizedPreset === 'stale30') return meta.inactivityMs > 30 * DAY_IN_MS;

  return true;
};

export const filterAdminLiveChats = (chats = [], filters = {}, options = {}) => {
  const safeChats = Array.isArray(chats) ? chats : [];
  const activeFilters = { ...DEFAULT_ADMIN_LIVE_CHAT_FILTERS, ...(filters || {}) };
  const metas = safeChats.map((chat) => getLiveChatMeta(chat, options?.now));

  const filtered = metas.filter((meta) => {
    if (!matchesSearchTokens(meta.searchText, activeFilters.searchQuery)) return false;

    const statusFilter = toUpperCode(activeFilters.statusFilter);
    if (statusFilter && statusFilter !== 'ALL' && meta.status !== statusFilter) return false;

    const responseStateFilter = toUpperCode(activeFilters.responseStateFilter);
    if (responseStateFilter === 'WAITING' && !meta.waiting) return false;
    if (responseStateFilter === 'RESPONDED' && !meta.responded) return false;
    if (responseStateFilter === 'UNRESPONDED' && meta.responded) return false;
    if (responseStateFilter === 'NO_MESSAGES' && meta.hasMessages) return false;

    const audienceFilter = toUpperCode(activeFilters.audienceFilter);
    if (audienceFilter && audienceFilter !== 'ALL' && meta.audience !== audienceFilter) return false;

    if (!matchesLiveChatActivityPreset(meta, activeFilters.activityPreset)) return false;

    return true;
  });

  return sortLiveChatMetas(filtered, activeFilters.sortBy).map((meta) => meta.chat);
};

export const buildAdminLiveChatFilterOptions = (chats = []) => {
  const safeChats = Array.isArray(chats) ? chats : [];
  const audiences = safeChats
    .map((chat) => toUpperCode(chat?.user?.accountType || 'ANONYMOUS'))
    .filter(Boolean);

  return {
    audienceOptions: [
      { value: 'all', label: 'All Audiences' },
      ...Array.from(new Set(audiences))
        .sort((left, right) => compareText(left, right))
        .map((audience) => ({ value: audience, label: toLabelFromCode(audience) })),
    ],
  };
};

export const countActiveAdminLiveChatFilters = (filters = {}) =>
  countChangedFilterKeys(DEFAULT_ADMIN_LIVE_CHAT_FILTERS, filters);

// -----------------------------------------------------------------------------
// Training Dataset Filters
// -----------------------------------------------------------------------------

export const DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS = Object.freeze({
  searchQuery: '',
  jobRoleFilter: 'all',
  experienceFilter: 'all',
  industryFilter: 'all',
  qualityBandFilter: 'all',
  minQuality: '',
  maxQuality: '',
  datePreset: 'all',
  createdFrom: '',
  createdTo: '',
  sortBy: 'created_newest',
});

export const DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS = Object.freeze({
  searchQuery: '',
  poseFilter: 'all',
  faceFilter: 'all',
  frameBandFilter: 'all',
  minFrames: '',
  maxFrames: '',
  minDurationSeconds: '',
  maxDurationSeconds: '',
  datePreset: 'all',
  createdFrom: '',
  createdTo: '',
  sortBy: 'created_newest',
});

export const ADMIN_INTERVIEW_DATASET_QUALITY_BAND_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Quality Bands' },
  { value: 'HIGH', label: 'High Quality (80-100)' },
  { value: 'MEDIUM', label: 'Medium Quality (50-79)' },
  { value: 'LOW', label: 'Low Quality (0-49)' },
]);

export const ADMIN_INTERVIEW_DATASET_SORT_OPTIONS = Object.freeze([
  { value: 'created_newest', label: 'Newest First' },
  { value: 'created_oldest', label: 'Oldest First' },
  { value: 'quality_desc', label: 'Highest Quality' },
  { value: 'quality_asc', label: 'Lowest Quality' },
  { value: 'turns_desc', label: 'Most Conversation Turns' },
  { value: 'session_az', label: 'Session A-Z' },
]);

export const ADMIN_ANALYTICS_DATASET_BOOLEAN_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
]);

export const ADMIN_ANALYTICS_FRAME_BAND_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Frame Volumes' },
  { value: 'HIGH', label: 'High (>= 500 frames)' },
  { value: 'MEDIUM', label: 'Medium (150-499 frames)' },
  { value: 'LOW', label: 'Low (< 150 frames)' },
]);

export const ADMIN_ANALYTICS_DATASET_SORT_OPTIONS = Object.freeze([
  { value: 'created_newest', label: 'Newest First' },
  { value: 'created_oldest', label: 'Oldest First' },
  { value: 'frames_desc', label: 'Most Frames' },
  { value: 'duration_desc', label: 'Longest Duration' },
  { value: 'session_az', label: 'Session A-Z' },
]);

const getInterviewDatasetMeta = (dataset = {}) => {
  const qualityScore = Math.max(0, Math.min(100, normalizeNumber(dataset?.metadata?.qualityScore, 0)));
  const totalTurns = Math.max(0, Math.round(normalizeNumber(dataset?.totalTurns, 0)));
  const createdAt = toDate(dataset?.metadata?.createdAt);
  const jobRole = toCleanString(dataset?.config?.jobRole || 'Unknown');
  const experienceLevel = toCleanString(dataset?.config?.experienceLevel || 'Unknown');
  const industry = toCleanString(dataset?.config?.industry || 'Unknown');

  let qualityBand = 'LOW';
  if (qualityScore >= 80) qualityBand = 'HIGH';
  else if (qualityScore >= 50) qualityBand = 'MEDIUM';

  const searchText = normalizeForSearch([
    dataset?.id,
    dataset?.sessionId,
    jobRole,
    experienceLevel,
    industry,
    dataset?.summary?.overallFeedback,
    dataset?.summary?.strengths,
    dataset?.summary?.improvements,
  ].filter(Boolean).join(' '));

  return {
    dataset,
    qualityScore,
    qualityBand,
    totalTurns,
    createdAt,
    jobRole,
    experienceLevel,
    industry,
    searchText,
  };
};

const sortInterviewDatasetMetas = (metas = [], sortBy = 'created_newest') => {
  const normalizedSort = toCleanString(sortBy || 'created_newest').toLowerCase();
  const sorted = [...metas];

  sorted.sort((left, right) => {
    switch (normalizedSort) {
      case 'created_oldest': {
        const delta = compareByOldestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.dataset?.sessionId || left.dataset?.id, right.dataset?.sessionId || right.dataset?.id);
      }
      case 'quality_desc': {
        if (right.qualityScore !== left.qualityScore) return right.qualityScore - left.qualityScore;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'quality_asc': {
        if (left.qualityScore !== right.qualityScore) return left.qualityScore - right.qualityScore;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'turns_desc': {
        if (right.totalTurns !== left.totalTurns) return right.totalTurns - left.totalTurns;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'session_az': {
        const delta = compareText(left.dataset?.sessionId || left.dataset?.id, right.dataset?.sessionId || right.dataset?.id);
        if (delta !== 0) return delta;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'created_newest':
      default: {
        const delta = compareByNewestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.dataset?.sessionId || left.dataset?.id, right.dataset?.sessionId || right.dataset?.id);
      }
    }
  });

  return sorted;
};

export const filterInterviewDatasets = (datasets = [], filters = {}, options = {}) => {
  const safeDatasets = Array.isArray(datasets) ? datasets : [];
  const activeFilters = { ...DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS, ...(filters || {}) };
  const createdWindow = buildDateWindow({
    preset: activeFilters.datePreset,
    from: activeFilters.createdFrom,
    to: activeFilters.createdTo,
    now: options?.now,
  });

  const minQuality = parseOptionalNumber(activeFilters.minQuality);
  const maxQuality = parseOptionalNumber(activeFilters.maxQuality);
  const normalizedMinQuality = minQuality == null ? null : Math.max(0, Math.min(100, minQuality));
  const normalizedMaxQuality = maxQuality == null ? null : Math.max(0, Math.min(100, maxQuality));

  const metas = safeDatasets.map((dataset) => getInterviewDatasetMeta(dataset));
  const filtered = metas.filter((meta) => {
    if (!matchesSearchTokens(meta.searchText, activeFilters.searchQuery)) return false;

    if (toCleanString(activeFilters.jobRoleFilter).toLowerCase() !== 'all') {
      if (normalizeForSearch(meta.jobRole) !== normalizeForSearch(activeFilters.jobRoleFilter)) return false;
    }

    if (toCleanString(activeFilters.experienceFilter).toLowerCase() !== 'all') {
      if (normalizeForSearch(meta.experienceLevel) !== normalizeForSearch(activeFilters.experienceFilter)) return false;
    }

    if (toCleanString(activeFilters.industryFilter).toLowerCase() !== 'all') {
      if (normalizeForSearch(meta.industry) !== normalizeForSearch(activeFilters.industryFilter)) return false;
    }

    const qualityBandFilter = toUpperCode(activeFilters.qualityBandFilter);
    if (qualityBandFilter && qualityBandFilter !== 'ALL' && meta.qualityBand !== qualityBandFilter) return false;

    if (normalizedMinQuality != null && meta.qualityScore < normalizedMinQuality) return false;
    if (normalizedMaxQuality != null && meta.qualityScore > normalizedMaxQuality) return false;

    if (!isDateWithinWindow(meta.createdAt, createdWindow)) return false;

    return true;
  });

  return sortInterviewDatasetMetas(filtered, activeFilters.sortBy).map((meta) => meta.dataset);
};

export const buildInterviewDatasetFilterOptions = (datasets = []) => {
  const safeDatasets = Array.isArray(datasets) ? datasets : [];
  return {
    roleOptions: toSortedOptions(
      safeDatasets.map((dataset) => dataset?.config?.jobRole),
      { includeAllLabel: 'All Roles' },
    ),
    experienceOptions: toSortedOptions(
      safeDatasets.map((dataset) => dataset?.config?.experienceLevel),
      { includeAllLabel: 'All Experience Levels' },
    ),
    industryOptions: toSortedOptions(
      safeDatasets.map((dataset) => dataset?.config?.industry),
      { includeAllLabel: 'All Industries' },
    ),
  };
};

export const countActiveInterviewDatasetFilters = (filters = {}) =>
  countChangedFilterKeys(DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS, filters);

const getAnalyticsDatasetMeta = (dataset = {}) => {
  const createdAt = toDate(dataset?.metadata?.createdAt);
  const totalFrames = Math.max(0, Math.round(normalizeNumber(dataset?.totalFrames, 0)));
  const durationMs = Math.max(0, normalizeNumber(dataset?.duration, 0));
  const durationSeconds = durationMs / 1000;
  const poseEnabled = dataset?.config?.enablePose !== false;
  const faceEnabled = dataset?.config?.enableFace !== false;

  let frameBand = 'LOW';
  if (totalFrames >= 500) frameBand = 'HIGH';
  else if (totalFrames >= 150) frameBand = 'MEDIUM';

  const searchText = normalizeForSearch([
    dataset?.id,
    dataset?.sessionId,
    dataset?.config?.detectionInterval,
    poseEnabled ? 'pose enabled' : 'pose disabled',
    faceEnabled ? 'face enabled' : 'face disabled',
  ].filter(Boolean).join(' '));

  return {
    dataset,
    createdAt,
    totalFrames,
    durationSeconds,
    poseEnabled,
    faceEnabled,
    frameBand,
    searchText,
  };
};

const sortAnalyticsDatasetMetas = (metas = [], sortBy = 'created_newest') => {
  const normalizedSort = toCleanString(sortBy || 'created_newest').toLowerCase();
  const sorted = [...metas];

  sorted.sort((left, right) => {
    switch (normalizedSort) {
      case 'created_oldest': {
        const delta = compareByOldestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.dataset?.sessionId || left.dataset?.id, right.dataset?.sessionId || right.dataset?.id);
      }
      case 'frames_desc': {
        if (right.totalFrames !== left.totalFrames) return right.totalFrames - left.totalFrames;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'duration_desc': {
        if (right.durationSeconds !== left.durationSeconds) return right.durationSeconds - left.durationSeconds;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'session_az': {
        const delta = compareText(left.dataset?.sessionId || left.dataset?.id, right.dataset?.sessionId || right.dataset?.id);
        if (delta !== 0) return delta;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'created_newest':
      default: {
        const delta = compareByNewestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.dataset?.sessionId || left.dataset?.id, right.dataset?.sessionId || right.dataset?.id);
      }
    }
  });

  return sorted;
};

export const filterAnalyticsDatasets = (datasets = [], filters = {}, options = {}) => {
  const safeDatasets = Array.isArray(datasets) ? datasets : [];
  const activeFilters = { ...DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS, ...(filters || {}) };
  const createdWindow = buildDateWindow({
    preset: activeFilters.datePreset,
    from: activeFilters.createdFrom,
    to: activeFilters.createdTo,
    now: options?.now,
  });

  const minFrames = parseOptionalNumber(activeFilters.minFrames);
  const maxFrames = parseOptionalNumber(activeFilters.maxFrames);
  const minDurationSeconds = parseOptionalNumber(activeFilters.minDurationSeconds);
  const maxDurationSeconds = parseOptionalNumber(activeFilters.maxDurationSeconds);

  const metas = safeDatasets.map((dataset) => getAnalyticsDatasetMeta(dataset));
  const filtered = metas.filter((meta) => {
    if (!matchesSearchTokens(meta.searchText, activeFilters.searchQuery)) return false;

    const poseFilter = toCleanString(activeFilters.poseFilter).toLowerCase();
    if (poseFilter === 'enabled' && !meta.poseEnabled) return false;
    if (poseFilter === 'disabled' && meta.poseEnabled) return false;

    const faceFilter = toCleanString(activeFilters.faceFilter).toLowerCase();
    if (faceFilter === 'enabled' && !meta.faceEnabled) return false;
    if (faceFilter === 'disabled' && meta.faceEnabled) return false;

    const frameBandFilter = toUpperCode(activeFilters.frameBandFilter);
    if (frameBandFilter && frameBandFilter !== 'ALL' && meta.frameBand !== frameBandFilter) return false;

    if (minFrames != null && meta.totalFrames < minFrames) return false;
    if (maxFrames != null && meta.totalFrames > maxFrames) return false;
    if (minDurationSeconds != null && meta.durationSeconds < minDurationSeconds) return false;
    if (maxDurationSeconds != null && meta.durationSeconds > maxDurationSeconds) return false;

    if (!isDateWithinWindow(meta.createdAt, createdWindow)) return false;

    return true;
  });

  return sortAnalyticsDatasetMetas(filtered, activeFilters.sortBy).map((meta) => meta.dataset);
};

export const countActiveAnalyticsDatasetFilters = (filters = {}) =>
  countChangedFilterKeys(DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS, filters);

// -----------------------------------------------------------------------------
// Pending Approval Queue Filters
// -----------------------------------------------------------------------------

const APPROVAL_PRIORITY_LEVELS = Object.freeze({
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
});

export const DEFAULT_ADMIN_APPROVAL_FILTERS = Object.freeze({
  searchQuery: '',
  priorityFilter: 'all',
  industryFilter: 'all',
  companySizeFilter: 'all',
  ownerDomainFilter: 'all',
  reReviewFilter: 'all',
  completenessFilter: 'all',
  agePreset: 'all',
  createdFrom: '',
  createdTo: '',
  sortBy: 'priority_oldest',
});

export const ADMIN_APPROVAL_PRIORITY_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Priorities' },
  { value: 'HIGH', label: 'High Priority' },
  { value: 'MEDIUM', label: 'Medium Priority' },
  { value: 'LOW', label: 'Low Priority' },
]);

export const ADMIN_APPROVAL_COMPLETENESS_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Profile Completeness' },
  { value: 'COMPLETE', label: 'Complete Profile' },
  { value: 'PARTIAL', label: 'Partial Profile' },
  { value: 'MINIMAL', label: 'Minimal Profile' },
]);

export const ADMIN_APPROVAL_SORT_FILTER_OPTIONS = Object.freeze([
  { value: 'priority_oldest', label: 'Priority then Oldest' },
  { value: 'priority_newest', label: 'Priority then Newest' },
  { value: 'registration_oldest', label: 'Oldest Registration' },
  { value: 'registration_newest', label: 'Newest Registration' },
  { value: 'name_az', label: 'Organization A-Z' },
  { value: 'rereview_first', label: 'Re-review Requests First' },
]);

const getProfileCompletenessMeta = (organization = {}) => {
  const checks = [
    Boolean(toCleanString(organization?.displayName || organization?.name)),
    Boolean(toCleanString(organization?.owner?.fullName)),
    Boolean(toCleanString(organization?.owner?.email)),
    Boolean(toCleanString(organization?.industry)),
    Boolean(toCleanString(organization?.companySize)),
    Boolean(toCleanString(organization?.owner?.companyName)),
  ];
  const completed = checks.filter(Boolean).length;
  const score = Math.round((completed / checks.length) * 100);
  if (score >= 80) return { score, level: 'COMPLETE' };
  if (score >= 50) return { score, level: 'PARTIAL' };
  return { score, level: 'MINIMAL' };
};

const getApprovalPriority = (organization = {}) => {
  const reReviewCount = Math.max(0, Math.round(normalizeNumber(organization?.reReviewRequestCount, 0)));
  const hasReReview = Boolean(organization?.reReviewRequestedAt || reReviewCount > 0);
  const domainState = domainCategory(organization?.owner?.email);
  const missingIndustry = !toCleanString(organization?.industry);
  const missingSize = !toCleanString(organization?.companySize);
  const memberCount = Math.max(0, Math.round(normalizeNumber(organization?.memberCount, 0)));
  const ageDays = Math.floor((Date.now() - toMillis(organization?.createdAt)) / DAY_IN_MS);

  let score = 0;
  if (reReviewCount >= 2) score += 3;
  else if (hasReReview) score += 2;
  if (domainState === 'MISSING') score += 3;
  else if (domainState === 'FREE') score += 2;
  if (missingIndustry) score += 1;
  if (missingSize) score += 1;
  if (memberCount === 0) score += 1;
  if (ageDays > 30) score += 1;

  if (score >= 6) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
};

const getApprovalMeta = (organization = {}) => {
  const name = toCleanString(organization?.displayName || organization?.name || '');
  const ownerName = toCleanString(organization?.owner?.fullName || '');
  const ownerEmail = toCleanString(organization?.owner?.email || '');
  const createdAt = toDate(organization?.createdAt);
  const reReviewCount = Math.max(0, Math.round(normalizeNumber(organization?.reReviewRequestCount, 0)));
  const reReviewState = reReviewCount > 1
    ? 'MULTIPLE'
    : ((organization?.reReviewRequestedAt || reReviewCount > 0) ? 'REQUESTED' : 'NONE');
  const completeness = getProfileCompletenessMeta(organization);
  const priority = getApprovalPriority(organization);
  const ownerDomainState = domainCategory(ownerEmail);

  const searchText = normalizeForSearch([
    organization?.id,
    name,
    ownerName,
    ownerEmail,
    organization?.industry,
    organization?.companySize,
    organization?.reReviewRequestNote,
    priority,
    completeness.level,
  ].filter(Boolean).join(' '));

  return {
    organization,
    name,
    ownerName,
    ownerEmail,
    industry: toCleanString(organization?.industry),
    companySize: toCleanString(organization?.companySize),
    createdAt,
    priority,
    reReviewState,
    ownerDomainState,
    completenessLevel: completeness.level,
    completenessScore: completeness.score,
    reReviewCount,
    searchText,
  };
};

const sortApprovalMetas = (metas = [], sortBy = 'priority_oldest') => {
  const normalizedSort = toCleanString(sortBy || 'priority_oldest').toLowerCase();
  const sorted = [...metas];

  sorted.sort((left, right) => {
    const leftPriority = APPROVAL_PRIORITY_LEVELS[left.priority] || APPROVAL_PRIORITY_LEVELS.LOW;
    const rightPriority = APPROVAL_PRIORITY_LEVELS[right.priority] || APPROVAL_PRIORITY_LEVELS.LOW;

    switch (normalizedSort) {
      case 'priority_newest': {
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return compareByNewestDate(left.createdAt, right.createdAt);
      }
      case 'registration_oldest': {
        const delta = compareByOldestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.name, right.name);
      }
      case 'registration_newest': {
        const delta = compareByNewestDate(left.createdAt, right.createdAt);
        if (delta !== 0) return delta;
        return compareText(left.name, right.name);
      }
      case 'name_az': {
        const delta = compareText(left.name, right.name);
        if (delta !== 0) return delta;
        return compareByOldestDate(left.createdAt, right.createdAt);
      }
      case 'rereview_first': {
        if (right.reReviewCount !== left.reReviewCount) return right.reReviewCount - left.reReviewCount;
        return compareByOldestDate(left.createdAt, right.createdAt);
      }
      case 'priority_oldest':
      default: {
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return compareByOldestDate(left.createdAt, right.createdAt);
      }
    }
  });

  return sorted;
};

export const filterPendingApprovalOrganizations = (organizations = [], filters = {}, options = {}) => {
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];
  const activeFilters = { ...DEFAULT_ADMIN_APPROVAL_FILTERS, ...(filters || {}) };
  const ageWindow = buildDateWindow({
    preset: activeFilters.agePreset,
    from: activeFilters.createdFrom,
    to: activeFilters.createdTo,
    now: options?.now,
  });

  const metas = safeOrganizations.map((organization) => getApprovalMeta(organization));
  const filtered = metas.filter((meta) => {
    if (!matchesSearchTokens(meta.searchText, activeFilters.searchQuery)) return false;

    const priorityFilter = toUpperCode(activeFilters.priorityFilter);
    if (priorityFilter && priorityFilter !== 'ALL' && meta.priority !== priorityFilter) return false;

    if (toCleanString(activeFilters.industryFilter).toLowerCase() !== 'all') {
      if (normalizeForSearch(meta.industry) !== normalizeForSearch(activeFilters.industryFilter)) return false;
    }

    if (toCleanString(activeFilters.companySizeFilter).toLowerCase() !== 'all') {
      if (normalizeForSearch(meta.companySize) !== normalizeForSearch(activeFilters.companySizeFilter)) return false;
    }

    const ownerDomainFilter = toUpperCode(activeFilters.ownerDomainFilter);
    if (ownerDomainFilter && ownerDomainFilter !== 'ALL' && meta.ownerDomainState !== ownerDomainFilter) return false;

    const reReviewFilter = toUpperCode(activeFilters.reReviewFilter);
    if (reReviewFilter && reReviewFilter !== 'ALL' && meta.reReviewState !== reReviewFilter) return false;

    const completenessFilter = toUpperCode(activeFilters.completenessFilter);
    if (completenessFilter && completenessFilter !== 'ALL' && meta.completenessLevel !== completenessFilter) return false;

    if (!isDateWithinWindow(meta.createdAt, ageWindow)) return false;

    return true;
  });

  return sortApprovalMetas(filtered, activeFilters.sortBy).map((meta) => meta.organization);
};

export const buildApprovalQueueFilterOptions = (organizations = []) => {
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];
  return {
    industryOptions: toSortedOptions(
      safeOrganizations.map((organization) => organization?.industry),
      { includeAllLabel: 'All Industries' },
    ),
    companySizeOptions: toSortedOptions(
      safeOrganizations.map((organization) => organization?.companySize),
      { includeAllLabel: 'All Company Sizes' },
    ),
  };
};

export const countActiveApprovalFilters = (filters = {}) =>
  countChangedFilterKeys(DEFAULT_ADMIN_APPROVAL_FILTERS, filters);
