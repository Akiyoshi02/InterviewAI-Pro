const DISPOSITION_LIBRARY = {
  NOT_SELECTED: {
    category: 'ASSESSMENT',
    reason: 'We selected another candidate for this role.',
  },
  SKILL_MISMATCH: {
    category: 'ASSESSMENT',
    reason: 'Required skills did not align closely enough with this role.',
  },
  EXPERIENCE_MISMATCH: {
    category: 'ASSESSMENT',
    reason: 'Experience level did not match the role requirements.',
  },
  SALARY_MISMATCH: {
    category: 'COMPENSATION',
    reason: 'Compensation expectations were not aligned for this role.',
  },
  POSITION_FILLED: {
    category: 'ROLE_OUTCOME',
    reason: 'This position has now been filled.',
  },
  JOB_CLOSED: {
    category: 'ROLE_OUTCOME',
    reason: 'This role has been closed and removed.',
  },
  CANDIDATE_WITHDREW: {
    category: 'CANDIDATE_ACTION',
    reason: 'Application withdrawn by candidate.',
  },
  OFFER_DECLINED: {
    category: 'CANDIDATE_ACTION',
    reason: 'Offer declined by candidate.',
  },
  HIRED: {
    category: 'FINAL_DECISION',
    reason: 'Candidate selected for hire.',
  },
  OTHER: {
    category: 'OTHER',
    reason: 'Application outcome recorded.',
  },
};

export const DISPOSITION_CODES = Object.freeze(Object.keys(DISPOSITION_LIBRARY));

export const DISPOSITION_CODE_SET = new Set(DISPOSITION_CODES);

export const APPLICATION_STATUSES = Object.freeze([
  'SUBMITTED',
  'SCREENING',
  'INTERVIEWING',
  'SHORTLISTED',
  'OFFER',
  'REJECTED',
  'HIRED',
]);

const APPLICATION_STATUS_SET = new Set(APPLICATION_STATUSES);

const TERMINAL_APPLICATION_STATUSES = new Set(['REJECTED', 'HIRED']);

const APPLICATION_STATUS_TRANSITIONS = Object.freeze({
  SUBMITTED: new Set(['SCREENING', 'INTERVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED']),
  SCREENING: new Set(['INTERVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED']),
  INTERVIEWING: new Set(['SHORTLISTED', 'OFFER', 'REJECTED', 'HIRED']),
  SHORTLISTED: new Set(['INTERVIEWING', 'OFFER', 'REJECTED', 'HIRED']),
  OFFER: new Set(['INTERVIEWING', 'REJECTED', 'HIRED']),
  REJECTED: new Set(),
  HIRED: new Set(),
});

const normalizeString = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

export const normalizeApplicationStatus = (status, fallback = null) => {
  const normalized = normalizeString(status)?.toUpperCase() || null;
  if (normalized && APPLICATION_STATUS_SET.has(normalized)) {
    return normalized;
  }
  const normalizedFallback = normalizeString(fallback)?.toUpperCase() || null;
  if (normalizedFallback && APPLICATION_STATUS_SET.has(normalizedFallback)) {
    return normalizedFallback;
  }
  return null;
};

export const isTerminalApplicationStatus = (status) =>
  TERMINAL_APPLICATION_STATUSES.has(normalizeApplicationStatus(status));

export const getAllowedApplicationTransitions = (status) => {
  const normalized = normalizeApplicationStatus(status);
  if (!normalized) return [];
  const allowed = APPLICATION_STATUS_TRANSITIONS[normalized];
  return Array.from(allowed || []);
};

export const canTransitionApplicationStatus = (
  fromStatus,
  toStatus,
  { allowNoop = true } = {},
) => {
  const from = normalizeApplicationStatus(fromStatus);
  const to = normalizeApplicationStatus(toStatus);
  if (!from || !to) return false;
  if (from === to) return allowNoop;
  const allowed = APPLICATION_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
};

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => normalizeString(tag)?.toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
};

export const inferDefaultDispositionCode = (status, { withdrawnBy = null, jobDeletedAt = null } = {}) => {
  const normalizedStatus = (status || '').toString().toUpperCase();
  if (normalizedStatus === 'HIRED') return 'HIRED';
  if (normalizedStatus !== 'REJECTED') return null;
  if (withdrawnBy) return 'CANDIDATE_WITHDREW';
  if (jobDeletedAt) return 'JOB_CLOSED';
  return 'NOT_SELECTED';
};

export const normalizeDisposition = (
  input = {},
  {
    status = null,
    withdrawnBy = null,
    jobDeletedAt = null,
    fallbackCode = null,
    fallbackReason = null,
  } = {},
) => {
  const sourceCode = normalizeString(input.code || input.dispositionCode || fallbackCode);
  const normalizedCode = sourceCode ? sourceCode.toUpperCase() : null;
  const inferredCode = inferDefaultDispositionCode(status, { withdrawnBy, jobDeletedAt });
  const selectedCode = DISPOSITION_CODE_SET.has(normalizedCode)
    ? normalizedCode
    : (DISPOSITION_CODE_SET.has(inferredCode) ? inferredCode : null);
  const lib = selectedCode ? DISPOSITION_LIBRARY[selectedCode] : null;
  const rawCategory = normalizeString(input.category || input.dispositionCategory);
  const rawReason = normalizeString(input.reason || input.dispositionReason || fallbackReason);

  return {
    code: selectedCode,
    category: normalizeString(rawCategory || lib?.category),
    reason: normalizeString(rawReason || lib?.reason),
    notes: normalizeString(input.notes || input.dispositionNotes),
    tags: normalizeTags(input.tags || input.dispositionTags),
  };
};

export const buildStatusHistoryEntry = ({
  previousStatus = null,
  status,
  changedAt,
  changedBy = null,
  source = null,
  note = null,
  dispositionCode = null,
  dispositionCategory = null,
} = {}) => {
  const normalizedStatus = normalizeString(status)?.toUpperCase();
  if (!normalizedStatus) return null;

  return {
    previousStatus: normalizeString(previousStatus)?.toUpperCase() || null,
    status: normalizedStatus,
    changedAt: normalizeString(changedAt) || new Date().toISOString(),
    changedBy: normalizeString(changedBy),
    source: normalizeString(source),
    note: normalizeString(note),
    dispositionCode: normalizeString(dispositionCode)?.toUpperCase() || null,
    dispositionCategory: normalizeString(dispositionCategory),
  };
};

export const appendStatusHistory = (history = [], entry = null, maxEntries = 60) => {
  const existing = Array.isArray(history) ? history.filter(Boolean) : [];
  if (!entry) return existing.slice(-maxEntries);
  return [...existing, entry].slice(-maxEntries);
};

export const dispositionCodeToLabel = (code) => {
  const normalizedCode = normalizeString(code)?.toUpperCase();
  if (!normalizedCode) return null;
  return normalizedCode
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
};
