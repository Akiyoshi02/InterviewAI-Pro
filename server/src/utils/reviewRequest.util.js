const normalizeId = (value) => (typeof value === 'string' ? value.trim() : '');

const toIsoString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return null;
};

const addHours = (iso, hours) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(parsed.getHours() + hours);
  return parsed.toISOString();
};

export const DEFAULT_REVIEW_DUE_HOURS_AFTER_INTERVIEW = 48;
export const DEFAULT_REVIEW_DUE_DAYS_WITHOUT_SCHEDULE = 7;
export const REVIEW_DUE_SOON_WINDOW_HOURS = 24;
export const REVIEW_OVERDUE_REMINDER_COOLDOWN_HOURS = 24;
export const REVIEW_OVERDUE_REMINDER_MAX_AGE_DAYS = 14;
export const REVIEW_REMINDER_HISTORY_LIMIT = 10;

const normalizeReminderHistory = (reminderHistory = []) => (
  Array.isArray(reminderHistory)
    ? reminderHistory
      .map((entry) => {
        const sentAt = toIsoString(entry?.sentAt);
        if (!sentAt) return null;
        return {
          sentAt,
          workflowState: String(entry?.workflowState || '').trim().toUpperCase() || null,
          channel: String(entry?.channel || 'EMAIL').trim().toUpperCase() || 'EMAIL',
          source: String(entry?.source || 'AUTOMATED').trim().toUpperCase() === 'MANUAL'
            ? 'MANUAL'
            : 'AUTOMATED',
        };
      })
      .filter(Boolean)
      .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt))
      .slice(0, REVIEW_REMINDER_HISTORY_LIMIT)
    : []
);

export const normalizeReviewRequests = (reviewRequests = []) => (
  Array.isArray(reviewRequests)
    ? reviewRequests
      .map((request) => {
        const reviewerId = normalizeId(request?.reviewerId);
        if (!reviewerId) return null;
        return {
          reviewerId,
          assignedAt: toIsoString(request?.assignedAt),
          assignedBy: normalizeId(request?.assignedBy) || null,
          dueAt: toIsoString(request?.dueAt),
          dueSource: String(request?.dueSource || '').trim().toUpperCase() === 'MANUAL' ? 'MANUAL' : 'AUTO',
          lastReminderAt: toIsoString(request?.lastReminderAt),
          reminderHistory: normalizeReminderHistory(request?.reminderHistory),
          completedAt: toIsoString(request?.completedAt),
          completedReviewId: normalizeId(request?.completedReviewId) || null,
        };
      })
      .filter(Boolean)
    : []
);

export const buildAutoReviewDueAt = ({
  scheduledFor = null,
  completedAt = null,
  duration = 30,
  assignedAt = null,
} = {}) => {
  const completedAtIso = toIsoString(completedAt);
  if (completedAtIso) {
    return addHours(completedAtIso, DEFAULT_REVIEW_DUE_HOURS_AFTER_INTERVIEW);
  }

  const scheduledForIso = toIsoString(scheduledFor);
  if (scheduledForIso) {
    const interviewEnd = new Date(scheduledForIso);
    interviewEnd.setMinutes(interviewEnd.getMinutes() + Math.max(0, Number(duration) || 0));
    return addHours(interviewEnd.toISOString(), DEFAULT_REVIEW_DUE_HOURS_AFTER_INTERVIEW);
  }

  const assignedAtIso = toIsoString(assignedAt) || new Date().toISOString();
  return addHours(assignedAtIso, DEFAULT_REVIEW_DUE_DAYS_WITHOUT_SCHEDULE * 24);
};

export const syncReviewRequests = ({
  existingReviewRequests = [],
  reviewerAssignments = [],
  assignedBy = null,
  interview = {},
  nowValue = new Date().toISOString(),
} = {}) => {
  const normalizedAssignments = Array.from(
    new Set(
      (Array.isArray(reviewerAssignments) ? reviewerAssignments : [])
        .map((value) => normalizeId(value))
        .filter(Boolean),
    ),
  );

  if (normalizedAssignments.length === 0) {
    return [];
  }

  const normalizedExisting = normalizeReviewRequests(existingReviewRequests);
  const existingByReviewerId = new Map(
    normalizedExisting.map((request) => [request.reviewerId, request]),
  );
  const assignedAt = toIsoString(nowValue) || new Date().toISOString();
  const normalizedAssignedBy = normalizeId(assignedBy) || null;

  return normalizedAssignments.map((reviewerId) => {
    const existing = existingByReviewerId.get(reviewerId);
    const isCompleted = Boolean(existing?.completedAt || existing?.completedReviewId);
    const dueAt = existing?.dueSource === 'MANUAL' && existing?.dueAt
      ? existing.dueAt
      : buildAutoReviewDueAt({
        scheduledFor: interview?.scheduledFor,
        completedAt: interview?.completedAt,
        duration: interview?.duration,
        assignedAt: existing?.assignedAt || assignedAt,
      });

    return {
      reviewerId,
      assignedAt: existing?.assignedAt || assignedAt,
      assignedBy: existing?.assignedBy || normalizedAssignedBy,
      dueAt: isCompleted ? (existing?.dueAt || dueAt) : dueAt,
      dueSource: existing?.dueSource === 'MANUAL' ? 'MANUAL' : 'AUTO',
      lastReminderAt: existing?.lastReminderAt || null,
      reminderHistory: existing?.reminderHistory || [],
      completedAt: existing?.completedAt || null,
      completedReviewId: existing?.completedReviewId || null,
    };
  });
};

export const applyReviewRequestUpdates = ({
  reviewRequests = [],
  reviewRequestUpdates = [],
  interview = {},
} = {}) => {
  const normalizedRequests = normalizeReviewRequests(reviewRequests);
  const normalizedUpdates = Array.isArray(reviewRequestUpdates)
    ? reviewRequestUpdates
      .map((update) => {
        const reviewerId = normalizeId(update?.reviewerId);
        if (!reviewerId) return null;
        return {
          reviewerId,
          dueSource: String(update?.dueSource || '').trim().toUpperCase() === 'MANUAL'
            ? 'MANUAL'
            : 'AUTO',
          dueAt: toIsoString(update?.dueAt),
        };
      })
      .filter(Boolean)
    : [];

  if (normalizedUpdates.length === 0) {
    return normalizedRequests;
  }

  const updatesByReviewerId = new Map(
    normalizedUpdates.map((update) => [update.reviewerId, update]),
  );

  return normalizedRequests.map((request) => {
    const update = updatesByReviewerId.get(request.reviewerId);
    if (!update) return request;
    if (request.completedAt || request.completedReviewId) {
      return request;
    }

    const nextDueAt = update.dueSource === 'MANUAL' && update.dueAt
      ? update.dueAt
      : buildAutoReviewDueAt({
        scheduledFor: interview?.scheduledFor,
        completedAt: interview?.completedAt,
        duration: interview?.duration,
        assignedAt: request.assignedAt,
      });
    const dueChanged = nextDueAt !== request.dueAt || update.dueSource !== request.dueSource;

    return {
      ...request,
      dueSource: update.dueSource,
      dueAt: nextDueAt,
      lastReminderAt: dueChanged ? null : request.lastReminderAt,
      reminderHistory: request.reminderHistory || [],
    };
  });
};

export const completeReviewRequest = ({
  reviewRequests = [],
  reviewerId,
  reviewId,
  completedAt = new Date().toISOString(),
} = {}) => {
  const normalizedReviewerId = normalizeId(reviewerId);
  if (!normalizedReviewerId) {
    return normalizeReviewRequests(reviewRequests);
  }

  const normalizedCompletedAt = toIsoString(completedAt) || new Date().toISOString();
  const normalizedReviewId = normalizeId(reviewId) || null;

  return normalizeReviewRequests(reviewRequests).map((request) => (
    request.reviewerId === normalizedReviewerId
      ? {
        ...request,
        completedAt: normalizedCompletedAt,
        completedReviewId: normalizedReviewId,
      }
      : request
  ));
};

export const deriveReviewRequestState = (reviewRequest, interview = {}, nowValue = Date.now()) => {
  const normalizedRequest = normalizeReviewRequests([reviewRequest])[0];
  if (!normalizedRequest) {
    return {
      workflowState: 'UNASSIGNED',
      isCompleted: false,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  if (normalizedRequest.completedAt || normalizedRequest.completedReviewId) {
    return {
      workflowState: 'COMPLETED',
      isCompleted: true,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  const interviewStatus = String(interview?.status || '').trim().toUpperCase();
  if (interviewStatus !== 'COMPLETED') {
    return {
      workflowState: 'WAITING_FOR_INTERVIEW',
      isCompleted: false,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  const dueAtMs = normalizedRequest.dueAt ? Date.parse(normalizedRequest.dueAt) : NaN;
  const nowMs = typeof nowValue === 'number' ? nowValue : Date.parse(nowValue);
  if (!Number.isFinite(dueAtMs) || !Number.isFinite(nowMs)) {
    return {
      workflowState: 'PENDING',
      isCompleted: false,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  if (nowMs > dueAtMs) {
    return {
      workflowState: 'OVERDUE',
      isCompleted: false,
      isOverdue: true,
      isDueSoon: false,
    };
  }

  const dueSoonThresholdMs = REVIEW_DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000;
  if (dueAtMs - nowMs <= dueSoonThresholdMs) {
    return {
      workflowState: 'DUE_SOON',
      isCompleted: false,
      isOverdue: false,
      isDueSoon: true,
    };
  }

  return {
    workflowState: 'PENDING',
    isCompleted: false,
    isOverdue: false,
    isDueSoon: false,
  };
};

export const getReviewRequestReminderDecision = (
  reviewRequest,
  interview = {},
  {
    nowValue = Date.now(),
  } = {},
) => {
  const normalizedRequest = normalizeReviewRequests([reviewRequest])[0];
  if (!normalizedRequest) {
    return {
      shouldSend: false,
      workflowState: 'UNASSIGNED',
      dueAt: null,
      reason: 'INVALID_REQUEST',
    };
  }

  const derived = deriveReviewRequestState(normalizedRequest, interview, nowValue);
  if (derived.isCompleted) {
    return {
      shouldSend: false,
      workflowState: derived.workflowState,
      dueAt: normalizedRequest.dueAt || null,
      reason: 'ALREADY_COMPLETED',
    };
  }

  if (derived.workflowState !== 'DUE_SOON' && derived.workflowState !== 'OVERDUE') {
    return {
      shouldSend: false,
      workflowState: derived.workflowState,
      dueAt: normalizedRequest.dueAt || null,
      reason: 'NOT_READY',
    };
  }

  const nowMs = typeof nowValue === 'number' ? nowValue : Date.parse(nowValue);
  const lastReminderMs = normalizedRequest.lastReminderAt
    ? Date.parse(normalizedRequest.lastReminderAt)
    : Number.NaN;
  const dueAtMs = normalizedRequest.dueAt ? Date.parse(normalizedRequest.dueAt) : Number.NaN;

  if (derived.workflowState === 'DUE_SOON') {
    if (Number.isFinite(lastReminderMs)) {
      return {
        shouldSend: false,
        workflowState: derived.workflowState,
        dueAt: normalizedRequest.dueAt || null,
        reason: 'ALREADY_REMINDERED',
      };
    }

    return {
      shouldSend: true,
      workflowState: derived.workflowState,
      dueAt: normalizedRequest.dueAt || null,
      reason: 'READY',
    };
  }

  if (!Number.isFinite(nowMs) || !Number.isFinite(dueAtMs)) {
    return {
      shouldSend: false,
      workflowState: derived.workflowState,
      dueAt: normalizedRequest.dueAt || null,
      reason: 'INVALID_DUE_AT',
    };
  }

  const maxAgeMs = REVIEW_OVERDUE_REMINDER_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (nowMs - dueAtMs > maxAgeMs) {
    return {
      shouldSend: false,
      workflowState: derived.workflowState,
      dueAt: normalizedRequest.dueAt || null,
      reason: 'STALE_OVERDUE',
    };
  }

  if (Number.isFinite(lastReminderMs)) {
    const cooldownMs = REVIEW_OVERDUE_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
    if (nowMs - lastReminderMs < cooldownMs) {
      return {
        shouldSend: false,
        workflowState: derived.workflowState,
        dueAt: normalizedRequest.dueAt || null,
        reason: 'COOLDOWN',
      };
    }
  }

  return {
    shouldSend: true,
    workflowState: derived.workflowState,
    dueAt: normalizedRequest.dueAt || null,
    reason: 'READY',
  };
};

export const markReviewRequestReminder = ({
  reviewRequests = [],
  reviewerId,
  remindedAt = new Date().toISOString(),
  workflowState = null,
  channel = 'EMAIL',
  source = 'AUTOMATED',
} = {}) => {
  const normalizedReviewerId = normalizeId(reviewerId);
  if (!normalizedReviewerId) {
    return normalizeReviewRequests(reviewRequests);
  }

  const normalizedRemindedAt = toIsoString(remindedAt) || new Date().toISOString();
  const normalizedWorkflowState = String(workflowState || '').trim().toUpperCase() || null;
  const normalizedChannel = String(channel || 'EMAIL').trim().toUpperCase() || 'EMAIL';
  const normalizedSource = String(source || 'AUTOMATED').trim().toUpperCase() === 'MANUAL'
    ? 'MANUAL'
    : 'AUTOMATED';

  return normalizeReviewRequests(reviewRequests).map((request) => (
    request.reviewerId === normalizedReviewerId
      ? {
        ...request,
        lastReminderAt: normalizedRemindedAt,
        reminderHistory: [
          {
            sentAt: normalizedRemindedAt,
            workflowState: normalizedWorkflowState,
            channel: normalizedChannel,
            source: normalizedSource,
          },
          ...(Array.isArray(request.reminderHistory) ? request.reminderHistory : []),
        ].slice(0, REVIEW_REMINDER_HISTORY_LIMIT),
      }
      : request
  ));
};

export const enrichInterviewReviewRequests = (interview = {}, { nowValue = Date.now() } = {}) => {
  const reviewRequests = normalizeReviewRequests(
    Array.isArray(interview?.reviewRequests) && interview.reviewRequests.length > 0
      ? interview.reviewRequests
      : syncReviewRequests({
        existingReviewRequests: [],
        reviewerAssignments: interview?.reviewerAssignments,
        assignedBy: interview?.scheduledBy || interview?.companyId || null,
        interview,
        nowValue,
      }),
  );

  const reviewerAssigneeMap = new Map(
    (Array.isArray(interview?.reviewerAssignees) ? interview.reviewerAssignees : [])
      .filter((reviewer) => reviewer?.id)
      .map((reviewer) => [normalizeId(reviewer.id), reviewer]),
  );

  const detailedRequests = reviewRequests.map((request) => {
    const derived = deriveReviewRequestState(request, interview, nowValue);
    return {
      ...request,
      ...derived,
      reviewer: reviewerAssigneeMap.get(request.reviewerId) || null,
    };
  });

  const pendingRequests = detailedRequests.filter((request) => !request.isCompleted);
  const nextDueAt = pendingRequests
    .map((request) => request.dueAt)
    .filter(Boolean)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] || null;

  return {
    reviewRequestsDetailed: detailedRequests,
    reviewWorkflowSummary: {
      total: detailedRequests.length,
      pending: pendingRequests.length,
      completed: detailedRequests.length - pendingRequests.length,
      waiting: detailedRequests.filter((request) => request.workflowState === 'WAITING_FOR_INTERVIEW').length,
      dueSoon: detailedRequests.filter((request) => request.workflowState === 'DUE_SOON').length,
      overdue: detailedRequests.filter((request) => request.workflowState === 'OVERDUE').length,
      nextDueAt,
    },
  };
};
