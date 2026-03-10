import crypto from 'crypto';

const ONBOARDING_STATUS_VALUES = Object.freeze(['IN_PROGRESS', 'COMPLETED']);
const ONBOARDING_TASK_OWNER_VALUES = Object.freeze(['CANDIDATE', 'TEAM']);
const ONBOARDING_TASK_TYPE_VALUES = Object.freeze(['ACTION', 'DOCUMENT', 'ACKNOWLEDGEMENT']);
const ONBOARDING_TASK_STATUS_VALUES = Object.freeze(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED']);
const ONBOARDING_HISTORY_EVENT_VALUES = Object.freeze([
  'CREATED',
  'UPDATED',
  'TASK_SUBMITTED',
  'TASK_APPROVED',
  'TASK_REJECTED',
  'TASK_COMPLETED',
]);
const MAX_ONBOARDING_HISTORY_ENTRIES = 40;
const DEFAULT_ONBOARDING_TASK_RULES = Object.freeze({
  'candidate-confirm-details': {
    daysBeforeStart: 7,
    fallbackDaysAfterCreation: 3,
    minimumDaysAfterCreation: 1,
  },
  'candidate-share-documents': {
    daysBeforeStart: 5,
    fallbackDaysAfterCreation: 5,
    minimumDaysAfterCreation: 1,
  },
  'candidate-review-policies': {
    daysBeforeStart: 2,
    fallbackDaysAfterCreation: 7,
    minimumDaysAfterCreation: 2,
  },
  'team-prepare-access': {
    daysBeforeStart: 3,
    fallbackDaysAfterCreation: 6,
    minimumDaysAfterCreation: 2,
  },
  'team-confirm-first-day': {
    daysBeforeStart: 1,
    fallbackDaysAfterCreation: 8,
    minimumDaysAfterCreation: 3,
  },
});

const normalizeString = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeIsoDate = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const addDays = (dateValue, days) => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString();
};

const getLaterIsoDate = (left, right) => {
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = right ? new Date(right).getTime() : Number.NaN;
  if (Number.isNaN(leftTime)) return right || null;
  if (Number.isNaN(rightTime)) return left || null;
  return leftTime >= rightTime ? left : right;
};

const buildOnboardingDueDate = ({
  startDate = null,
  createdAt = new Date().toISOString(),
  daysBeforeStart = null,
  fallbackDaysAfterCreation = 3,
  minimumDaysAfterCreation = 1,
} = {}) => {
  const createdAtIso = normalizeIsoDate(createdAt) || new Date().toISOString();
  const minimumDueAt = addDays(createdAtIso, minimumDaysAfterCreation) || createdAtIso;

  if (!startDate || daysBeforeStart == null) {
    return addDays(createdAtIso, fallbackDaysAfterCreation) || minimumDueAt;
  }

  const targetDueAt = addDays(startDate, -daysBeforeStart);
  return getLaterIsoDate(targetDueAt, minimumDueAt);
};

const buildDefaultOnboardingTaskDueDate = (taskId, { startDate = null, createdAt = new Date().toISOString() } = {}) => {
  const rule = DEFAULT_ONBOARDING_TASK_RULES[taskId];
  if (!rule) return null;
  return buildOnboardingDueDate({
    startDate,
    createdAt,
    daysBeforeStart: rule.daysBeforeStart,
    fallbackDaysAfterCreation: rule.fallbackDaysAfterCreation,
    minimumDaysAfterCreation: rule.minimumDaysAfterCreation,
  });
};

export const APPLICATION_ONBOARDING_STATUSES = ONBOARDING_STATUS_VALUES;
export const APPLICATION_ONBOARDING_TASK_OWNERS = ONBOARDING_TASK_OWNER_VALUES;
export const APPLICATION_ONBOARDING_TASK_TYPES = ONBOARDING_TASK_TYPE_VALUES;
export const APPLICATION_ONBOARDING_TASK_STATUSES = ONBOARDING_TASK_STATUS_VALUES;
export const APPLICATION_ONBOARDING_HISTORY_EVENTS = ONBOARDING_HISTORY_EVENT_VALUES;

export const normalizeOnboardingTaskStatus = (value, fallback = 'PENDING') => {
  const normalized = normalizeString(value)?.toUpperCase() || null;
  if (normalized && ONBOARDING_TASK_STATUS_VALUES.includes(normalized)) return normalized;
  if (fallback == null) return null;
  return ONBOARDING_TASK_STATUS_VALUES.includes(fallback) ? fallback : 'PENDING';
};

const normalizeOnboardingTaskOwner = (value, fallback = 'CANDIDATE') => {
  const normalized = normalizeString(value)?.toUpperCase() || null;
  if (normalized && ONBOARDING_TASK_OWNER_VALUES.includes(normalized)) return normalized;
  return ONBOARDING_TASK_OWNER_VALUES.includes(fallback) ? fallback : 'CANDIDATE';
};

const normalizeOnboardingTaskType = (value, fallback = 'ACTION') => {
  const normalized = normalizeString(value)?.toUpperCase() || null;
  if (normalized && ONBOARDING_TASK_TYPE_VALUES.includes(normalized)) return normalized;
  return ONBOARDING_TASK_TYPE_VALUES.includes(fallback) ? fallback : 'ACTION';
};

const isTaskCompletedForProgress = (task) => {
  const status = normalizeOnboardingTaskStatus(task?.status);
  return status === 'COMPLETED' || status === 'APPROVED';
};

const computeOnboardingStatus = (tasks = [], fallback = 'IN_PROGRESS') => {
  const requiredTasks = tasks.filter((task) => task.required !== false);
  if (requiredTasks.length === 0) return fallback;
  return requiredTasks.every((task) => isTaskCompletedForProgress(task))
    ? 'COMPLETED'
    : 'IN_PROGRESS';
};

const buildOnboardingProgress = (tasks = []) => {
  const requiredTasks = tasks.filter((task) => task.required !== false);
  const completedRequired = requiredTasks.filter((task) => isTaskCompletedForProgress(task)).length;
  return {
    totalTasks: tasks.length,
    requiredTasks: requiredTasks.length,
    completedTasks: tasks.filter((task) => isTaskCompletedForProgress(task)).length,
    completedRequiredTasks: completedRequired,
    percentComplete: requiredTasks.length > 0
      ? Math.round((completedRequired / requiredTasks.length) * 100)
      : 0,
  };
};

const sanitizeOnboardingTask = (task) => {
  if (!task || typeof task !== 'object') return null;
  const title = normalizeString(task.title);
  if (!title) return null;
  const status = normalizeOnboardingTaskStatus(task.status);
  return {
    id: normalizeString(task.id) || `onboarding-task-${crypto.randomUUID()}`,
    title,
    description: normalizeString(task.description),
    owner: normalizeOnboardingTaskOwner(task.owner),
    type: normalizeOnboardingTaskType(task.type),
    required: task.required !== false,
    status,
    dueAt: normalizeIsoDate(task.dueAt),
    candidateNote: normalizeString(task.candidateNote),
    reviewerNote: normalizeString(task.reviewerNote),
    createdAt: normalizeIsoDate(task.createdAt),
    updatedAt: normalizeIsoDate(task.updatedAt),
    submittedAt: normalizeIsoDate(task.submittedAt),
    completedAt: normalizeIsoDate(task.completedAt),
    approvedAt: normalizeIsoDate(task.approvedAt),
    rejectedAt: normalizeIsoDate(task.rejectedAt),
  };
};

const sanitizeOnboardingHistory = (history = []) => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const eventType = normalizeString(entry.eventType)?.toUpperCase() || 'UPDATED';
      return {
        id: normalizeString(entry.id) || `onboarding-history-${crypto.randomUUID()}`,
        eventType: ONBOARDING_HISTORY_EVENT_VALUES.includes(eventType) ? eventType : 'UPDATED',
        taskId: normalizeString(entry.taskId),
        actorId: normalizeString(entry.actorId),
        actorRole: normalizeString(entry.actorRole)?.toUpperCase() || null,
        note: normalizeString(entry.note),
        createdAt: normalizeIsoDate(entry.createdAt),
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, MAX_ONBOARDING_HISTORY_ENTRIES);
};

const buildOnboardingHistoryEntry = ({
  eventType = 'UPDATED',
  taskId = null,
  actorId = null,
  actorRole = null,
  note = null,
  createdAt = new Date().toISOString(),
} = {}) => {
  const normalizedEventType = normalizeString(eventType)?.toUpperCase() || 'UPDATED';
  return {
    id: crypto.randomUUID(),
    eventType: ONBOARDING_HISTORY_EVENT_VALUES.includes(normalizedEventType) ? normalizedEventType : 'UPDATED',
    taskId: normalizeString(taskId),
    actorId: normalizeString(actorId),
    actorRole: normalizeString(actorRole)?.toUpperCase() || null,
    note: normalizeString(note),
    createdAt: normalizeIsoDate(createdAt) || new Date().toISOString(),
  };
};

export const sanitizeApplicationOnboarding = (onboarding) => {
  if (!onboarding || typeof onboarding !== 'object') return null;
  const startDate = normalizeIsoDate(onboarding.startDate);
  const createdAt = normalizeIsoDate(onboarding.createdAt) || new Date().toISOString();
  const tasks = Array.isArray(onboarding.tasks)
    ? onboarding.tasks.map(sanitizeOnboardingTask).filter(Boolean)
    : [];
  const repairedTasks = tasks.map((task) => {
    const defaultDueAt = buildDefaultOnboardingTaskDueDate(task.id, { startDate, createdAt });
    if (!defaultDueAt) return task;

    const currentDueAtMs = task?.dueAt ? Date.parse(task.dueAt) : Number.NaN;
    const defaultDueAtMs = Date.parse(defaultDueAt);
    const status = normalizeOnboardingTaskStatus(task?.status);
    const isActiveTask = !['APPROVED', 'COMPLETED'].includes(status);
    if (!isActiveTask || !Number.isFinite(defaultDueAtMs)) return task;
    if (Number.isFinite(currentDueAtMs) && currentDueAtMs >= defaultDueAtMs) return task;

    return {
      ...task,
      dueAt: defaultDueAt,
    };
  });
  const status = computeOnboardingStatus(repairedTasks, normalizeString(onboarding.status)?.toUpperCase() || 'IN_PROGRESS');
  return {
    status,
    startDate,
    welcomeNote: normalizeString(onboarding.welcomeNote),
    createdAt,
    createdBy: normalizeString(onboarding.createdBy),
    updatedAt: normalizeIsoDate(onboarding.updatedAt),
    updatedBy: normalizeString(onboarding.updatedBy),
    completedAt: status === 'COMPLETED'
      ? normalizeIsoDate(onboarding.completedAt) || new Date().toISOString()
      : null,
    tasks: repairedTasks,
    progress: buildOnboardingProgress(repairedTasks),
    history: sanitizeOnboardingHistory(onboarding.history),
  };
};

const buildDefaultOnboardingTasks = (application = {}, createdAt = new Date().toISOString()) => {
  const startDate = normalizeIsoDate(application?.offer?.startDate) || null;
  const createdAtIso = normalizeIsoDate(createdAt) || new Date().toISOString();
  return [
    {
      id: 'candidate-confirm-details',
      title: 'Confirm personal details',
      description: 'Review your profile, contact information, and preferred name for the hiring team.',
      owner: 'CANDIDATE',
      type: 'ACKNOWLEDGEMENT',
      required: true,
      status: 'PENDING',
      dueAt: buildDefaultOnboardingTaskDueDate('candidate-confirm-details', { startDate, createdAt: createdAtIso }),
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
    },
    {
      id: 'candidate-share-documents',
      title: 'Share onboarding documents',
      description: 'Submit any required identity, bank, or payroll details to the hiring team.',
      owner: 'CANDIDATE',
      type: 'DOCUMENT',
      required: true,
      status: 'PENDING',
      dueAt: buildDefaultOnboardingTaskDueDate('candidate-share-documents', { startDate, createdAt: createdAtIso }),
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
    },
    {
      id: 'candidate-review-policies',
      title: 'Review first-day instructions',
      description: 'Read the handbook, onboarding note, and first-day expectations before your start date.',
      owner: 'CANDIDATE',
      type: 'ACKNOWLEDGEMENT',
      required: true,
      status: 'PENDING',
      dueAt: buildDefaultOnboardingTaskDueDate('candidate-review-policies', { startDate, createdAt: createdAtIso }),
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
    },
    {
      id: 'team-prepare-access',
      title: 'Prepare account access and equipment',
      description: 'Internal task for the hiring team to prepare system access, device, and workspace setup.',
      owner: 'TEAM',
      type: 'ACTION',
      required: true,
      status: 'PENDING',
      dueAt: buildDefaultOnboardingTaskDueDate('team-prepare-access', { startDate, createdAt: createdAtIso }),
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
    },
    {
      id: 'team-confirm-first-day',
      title: 'Confirm first-day schedule',
      description: 'Internal task to share the first-day agenda, reporting contact, and final joining instructions.',
      owner: 'TEAM',
      type: 'ACTION',
      required: true,
      status: 'PENDING',
      dueAt: buildDefaultOnboardingTaskDueDate('team-confirm-first-day', { startDate, createdAt: createdAtIso }),
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
    },
  ].map(sanitizeOnboardingTask);
};

export const createApplicationOnboarding = (application = {}, { actorId = null, actorRole = 'SYSTEM' } = {}) => {
  const createdAt = new Date().toISOString();
  const organizationName = normalizeString(application?.organizationSnapshot?.name)
    || normalizeString(application?.organization?.name)
    || 'the hiring team';
  const jobTitle = normalizeString(application?.jobSnapshot?.title)
    || normalizeString(application?.job?.title)
    || 'your role';

  return sanitizeApplicationOnboarding({
    status: 'IN_PROGRESS',
    startDate: application?.offer?.startDate || null,
    welcomeNote: `Welcome to ${organizationName}. Use this onboarding checklist to complete the final steps for ${jobTitle}.`,
    createdAt,
    createdBy: actorId,
    updatedAt: createdAt,
    updatedBy: actorId,
    completedAt: null,
    tasks: buildDefaultOnboardingTasks(application, createdAt),
    history: [
      buildOnboardingHistoryEntry({
        eventType: 'CREATED',
        actorId,
        actorRole,
        note: 'Onboarding checklist created for the hired candidate.',
        createdAt,
      }),
    ],
  });
};

export const ensureApplicationOnboarding = (application = {}, { actorId = null, actorRole = 'SYSTEM' } = {}) =>
  sanitizeApplicationOnboarding(application?.onboarding) || createApplicationOnboarding(application, { actorId, actorRole });

export const updateApplicationOnboardingOverview = (
  existingOnboarding,
  { actorId = null, actorRole = 'ADMIN', welcomeNote = undefined, startDate = undefined } = {},
) => {
  const onboarding = sanitizeApplicationOnboarding(existingOnboarding);
  if (!onboarding) return null;
  const updatedAt = new Date().toISOString();
  const next = sanitizeApplicationOnboarding({
    ...onboarding,
    welcomeNote: welcomeNote !== undefined ? welcomeNote : onboarding.welcomeNote,
    startDate: startDate !== undefined ? startDate : onboarding.startDate,
    updatedAt,
    updatedBy: actorId,
    history: [
      buildOnboardingHistoryEntry({
        eventType: 'UPDATED',
        actorId,
        actorRole,
        note: 'Onboarding overview updated.',
        createdAt: updatedAt,
      }),
      ...onboarding.history,
    ],
  });
  return next;
};

export const submitCandidateOnboardingTask = (
  existingOnboarding,
  taskId,
  { actorId = null, actorRole = 'CANDIDATE', note = null } = {},
) => {
  const onboarding = sanitizeApplicationOnboarding(existingOnboarding);
  if (!onboarding) return { error: 'Onboarding is not available.' };

  const task = onboarding.tasks.find((item) => item.id === taskId);
  if (!task) return { error: 'Onboarding task not found.' };
  if (task.owner !== 'CANDIDATE') return { error: 'Only candidate-owned tasks can be updated here.' };

  const now = new Date().toISOString();
  const nextStatus = task.type === 'DOCUMENT' ? 'SUBMITTED' : 'COMPLETED';
  const updatedTasks = onboarding.tasks.map((item) => {
    if (item.id !== taskId) return item;
    return sanitizeOnboardingTask({
      ...item,
      status: nextStatus,
      candidateNote: note ?? item.candidateNote,
      submittedAt: nextStatus === 'SUBMITTED' ? now : item.submittedAt,
      completedAt: nextStatus === 'COMPLETED' ? now : item.completedAt,
      approvedAt: null,
      rejectedAt: null,
      reviewerNote: null,
      updatedAt: now,
    });
  });

  const eventType = nextStatus === 'SUBMITTED' ? 'TASK_SUBMITTED' : 'TASK_COMPLETED';
  const updated = sanitizeApplicationOnboarding({
    ...onboarding,
    tasks: updatedTasks,
    updatedAt: now,
    updatedBy: actorId,
    history: [
      buildOnboardingHistoryEntry({
        eventType,
        taskId,
        actorId,
        actorRole,
        note: note || (nextStatus === 'SUBMITTED'
          ? 'Candidate submitted the task for review.'
          : 'Candidate completed the task.'),
        createdAt: now,
      }),
      ...onboarding.history,
    ],
  });

  return { onboarding: updated, task: updated.tasks.find((item) => item.id === taskId) };
};

export const reviewCompanyOnboardingTask = (
  existingOnboarding,
  taskId,
  { actorId = null, actorRole = 'ADMIN', status, note = null } = {},
) => {
  const onboarding = sanitizeApplicationOnboarding(existingOnboarding);
  if (!onboarding) return { error: 'Onboarding is not available.' };

  const normalizedStatus = normalizeOnboardingTaskStatus(status, null);
  if (!normalizedStatus) return { error: 'Invalid onboarding task status.' };

  const task = onboarding.tasks.find((item) => item.id === taskId);
  if (!task) return { error: 'Onboarding task not found.' };

  const currentStatus = normalizeOnboardingTaskStatus(task.status, 'PENDING');
  const isCandidateDocumentTask = task.owner === 'CANDIDATE' && task.type === 'DOCUMENT';
  const isTeamTask = task.owner === 'TEAM';

  if (isTeamTask) {
    if (normalizedStatus !== 'COMPLETED') {
      return { error: 'This task only supports completion updates.' };
    }
    if (currentStatus === 'COMPLETED') {
      return { error: 'This onboarding task is already complete.' };
    }
  } else if (isCandidateDocumentTask) {
    if (!['APPROVED', 'REJECTED'].includes(normalizedStatus)) {
      return { error: 'Candidate document tasks can only be approved or sent back.' };
    }
    if (currentStatus !== 'SUBMITTED') {
      return { error: 'Only submitted candidate documents can be reviewed.' };
    }
  } else {
    return { error: 'This task does not support the requested update.' };
  }

  const now = new Date().toISOString();
  const updatedTasks = onboarding.tasks.map((item) => {
    if (item.id !== taskId) return item;
    return sanitizeOnboardingTask({
      ...item,
      status: normalizedStatus,
      reviewerNote: note ?? item.reviewerNote,
      updatedAt: now,
      completedAt: normalizedStatus === 'COMPLETED' ? now : item.completedAt,
      approvedAt: normalizedStatus === 'APPROVED' ? now : item.approvedAt,
      rejectedAt: normalizedStatus === 'REJECTED' ? now : item.rejectedAt,
      submittedAt: normalizedStatus === 'REJECTED' ? item.submittedAt : item.submittedAt,
    });
  });

  const eventType = normalizedStatus === 'APPROVED'
    ? 'TASK_APPROVED'
    : normalizedStatus === 'REJECTED'
      ? 'TASK_REJECTED'
      : 'TASK_COMPLETED';

  const updated = sanitizeApplicationOnboarding({
    ...onboarding,
    tasks: updatedTasks,
    updatedAt: now,
    updatedBy: actorId,
    history: [
      buildOnboardingHistoryEntry({
        eventType,
        taskId,
        actorId,
        actorRole,
        note: note || (
          normalizedStatus === 'APPROVED'
            ? 'Hiring team approved the candidate submission.'
            : normalizedStatus === 'REJECTED'
              ? 'Hiring team requested an updated submission.'
              : 'Hiring team completed the internal onboarding task.'
        ),
        createdAt: now,
      }),
      ...onboarding.history,
    ],
  });

  return { onboarding: updated, task: updated.tasks.find((item) => item.id === taskId) };
};
