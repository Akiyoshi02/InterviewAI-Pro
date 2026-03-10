import {
  jobApplicationStore,
  jobStore,
  interviewStore,
  userStore,
  activityLogStore,
  organizationStore,
  organizationMemberStore,
  isJobCurrentlyPublic,
  publishOrganizationRealtimeUpdate,
  publishCandidateRealtimeUpdate,
} from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
import { queueEmailJob } from '../services/backgroundJobQueue.service.js';
import { ensureInterviewPlanStageForInterviewing } from '../services/hiringInterviewPlan.service.js';
import { buildJobSnapshot, buildOrganizationSnapshot } from '../utils/applicationSnapshot.util.js';
import {
  APPLICATION_STATUSES,
  appendStatusHistory,
  canTransitionApplicationStatus,
  buildStatusHistoryEntry,
  getAllowedApplicationTransitions,
  isTerminalApplicationStatus,
  normalizeApplicationStatus,
  normalizeDisposition,
} from '../utils/applicationLifecycle.util.js';
import {
  buildReviewerApplicationScope,
  canReviewerAccessApplication,
  isReviewerRole,
} from '../utils/reviewerAccess.util.js';
import { validateReviewerAssignmentsForOrganization } from '../utils/reviewerAssignment.util.js';
import { syncReviewRequests } from '../utils/reviewRequest.util.js';
import {
  buildInterviewPlanSnapshot,
  canMoveInterviewPlanToOffer,
  getCurrentInterviewPlanStage,
  sanitizeInterviewPlanForClient,
} from '../utils/interviewPlan.util.js';
import {
  appendApplicationOfferHistory,
  buildApplicationOfferHistoryEntry,
  buildAcceptedApplicationOffer,
  buildApplicationOfferPayload,
  buildDeclinedApplicationOffer,
  buildResentApplicationOffer,
  sanitizeApplicationOffer,
  sanitizeApplicationOfferHistory,
} from '../utils/applicationOffer.util.js';
import {
  createApplicationOnboarding,
  ensureApplicationOnboarding,
  reviewCompanyOnboardingTask,
  sanitizeApplicationOnboarding,
  submitCandidateOnboardingTask,
  updateApplicationOnboardingOverview,
} from '../utils/applicationOnboarding.util.js';
import logger from '../utils/logger.js';

const STATUS_TRANSITION_ERROR_CODE = 'INVALID_APPLICATION_STATUS_TRANSITION';
const DEFAULT_INTERVIEW_TIMEZONE = process.env.DEFAULT_INTERVIEW_TIMEZONE || 'UTC';
const DEFAULT_AUTO_SCHEDULE_LEAD_HOURS = Math.max(
  1,
  Number.parseInt(process.env.INTERVIEW_AUTO_SCHEDULE_LEAD_HOURS || '24', 10) || 24,
);
const DEFAULT_AUTO_SCHEDULE_SLOT_MINUTES = Math.max(
  15,
  Number.parseInt(process.env.INTERVIEW_AUTO_SCHEDULE_SLOT_MINUTES || '30', 10) || 30,
);
const DEFAULT_AUTO_SCHEDULE_BUFFER_MINUTES = Math.max(
  0,
  Number.parseInt(process.env.INTERVIEW_AUTO_SCHEDULE_BUFFER_MINUTES || '15', 10) || 15,
);
const DEFAULT_AUTO_SCHEDULE_WINDOW_DAYS = Math.max(
  1,
  Number.parseInt(process.env.INTERVIEW_AUTO_SCHEDULE_WINDOW_DAYS || '14', 10) || 14,
);
const DEFAULT_AUTO_SCHEDULE_MAX_INTERVIEWS_PER_DAY = Math.max(
  1,
  Number.parseInt(process.env.INTERVIEW_AUTO_SCHEDULE_MAX_INTERVIEWS_PER_DAY || '8', 10) || 8,
);
const DEFAULT_WORKING_DAYS = Object.freeze([1, 2, 3, 4, 5]);
const DEFAULT_BUSINESS_START_MINUTES = 9 * 60;
const DEFAULT_BUSINESS_END_MINUTES = 17 * 60;
const DEFAULT_INTERVIEW_DURATION_MINUTES = 30;
const DEFAULT_CONFLICT_SCOPE = 'RECRUITER';
const MAX_SLOT_SEARCH_ITERATIONS = 10000;
const WEEKDAY_LOOKUP = Object.freeze({
  SUN: 0,
  SUNDAY: 0,
  MON: 1,
  MONDAY: 1,
  TUE: 2,
  TUESDAY: 2,
  WED: 3,
  WEDNESDAY: 3,
  THU: 4,
  THURSDAY: 4,
  FRI: 5,
  FRIDAY: 5,
  SAT: 6,
  SATURDAY: 6,
});
const TERMINAL_INTERVIEW_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const INTERVIEW_SCHEDULING_MODES = new Set(['AUTO', 'MANUAL']);

const normalizeInterviewModeType = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean);
};

const getRequestOrigin = (req) => {
  const forwardedProtoHeader = req?.headers?.['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : typeof forwardedProtoHeader === 'string'
      ? forwardedProtoHeader.split(',')[0]
      : '';
  const forwardedHostHeader = req?.headers?.['x-forwarded-host'];
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : typeof forwardedHostHeader === 'string'
      ? forwardedHostHeader.split(',')[0]
      : '';

  const protocol = (forwardedProto || req?.protocol || 'http').toString().trim().toLowerCase() || 'http';
  const host = (forwardedHost || req?.get?.('host') || '').toString().trim();
  if (!host) {
    return `${protocol}://localhost:${process.env.PORT || 3000}`;
  }
  return `${protocol}://${host}`;
};

const roundToNextScheduleSlot = (date, intervalMinutes = DEFAULT_AUTO_SCHEDULE_SLOT_MINUTES) => {
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  const roundedMs = Math.ceil(date.getTime() / intervalMs) * intervalMs;
  return new Date(roundedMs);
};

const normalizeIanaTimezone = (value, fallback = DEFAULT_INTERVIEW_TIMEZONE) => {
  const timezone = typeof value === 'string' ? value.trim() : '';
  if (!timezone) return fallback;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return fallback;
  }
};

const parseIntegerWithinRange = (value, fallback, minimum, maximum = Number.POSITIVE_INFINITY) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const parseTimeToMinutes = (value, fallbackMinutes) => {
  if (typeof value !== 'string') return fallbackMinutes;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallbackMinutes;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallbackMinutes;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallbackMinutes;
  return (hours * 60) + minutes;
};

const normalizeWorkingDays = (value) => {
  const fallback = [...DEFAULT_WORKING_DAYS];
  if (!Array.isArray(value) || value.length === 0) return fallback;

  const normalized = value
    .map((day) => {
      if (Number.isInteger(day) && day >= 0 && day <= 6) return day;
      const asNumber = Number.parseInt(day, 10);
      if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 6) return asNumber;
      const key = String(day || '').trim().toUpperCase();
      if (!key) return null;
      return WEEKDAY_LOOKUP[key] ?? null;
    })
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return normalized.length > 0 ? [...new Set(normalized)].sort((a, b) => a - b) : fallback;
};

const parseConflictScope = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ORGANIZATION') return 'ORGANIZATION';
  return DEFAULT_CONFLICT_SCOPE;
};

const normalizeRecruiterInterviewAvailability = (value = null, fallback = {}) => {
  if (!value || typeof value !== 'object') return null;
  const timezone = normalizeIanaTimezone(
    value.timezone,
    normalizeIanaTimezone(fallback.timezone, DEFAULT_INTERVIEW_TIMEZONE),
  );
  const workingDays = normalizeWorkingDays(value.workingDays ?? fallback.workingDays);
  const businessHoursStartMinutes = parseTimeToMinutes(
    value.businessHoursStart,
    fallback.businessHoursStartMinutes ?? DEFAULT_BUSINESS_START_MINUTES,
  );
  const parsedEndMinutes = parseTimeToMinutes(
    value.businessHoursEnd,
    fallback.businessHoursEndMinutes ?? DEFAULT_BUSINESS_END_MINUTES,
  );
  const durationMinutes = parseIntegerWithinRange(
    value.durationMinutes,
    fallback.durationMinutes ?? DEFAULT_INTERVIEW_DURATION_MINUTES,
    15,
    180,
  );
  const businessHoursEndMinutes = parsedEndMinutes > (businessHoursStartMinutes + 15)
    ? parsedEndMinutes
    : Math.min(24 * 60, businessHoursStartMinutes + durationMinutes + 15);
  const maxInterviewsPerDay = parseIntegerWithinRange(
    value.maxInterviewsPerDay,
    fallback.maxInterviewsPerDay ?? DEFAULT_AUTO_SCHEDULE_MAX_INTERVIEWS_PER_DAY,
    1,
    40,
  );

  return {
    timezone,
    workingDays,
    businessHoursStartMinutes,
    businessHoursEndMinutes,
    maxInterviewsPerDay,
    durationMinutes,
  };
};

const resolveRecruiterAvailabilityOverrides = (recruiter = null, fallback = {}) => {
  const recruiterProfile = recruiter?.profile && typeof recruiter.profile === 'object'
    ? recruiter.profile
    : recruiter;
  if (!recruiterProfile || typeof recruiterProfile !== 'object') return null;
  const recruiterAvailability = normalizeRecruiterInterviewAvailability(
    recruiterProfile.interviewAvailability,
    {
      ...fallback,
      timezone: recruiterProfile.timezone || fallback.timezone || DEFAULT_INTERVIEW_TIMEZONE,
    },
  );
  if (!recruiterAvailability) return null;
  return recruiterAvailability;
};

const LOCAL_DATE_FORMATTER_CACHE = new Map();

const getLocalDateFormatter = (timezone) => {
  const cacheKey = timezone || 'UTC';
  if (LOCAL_DATE_FORMATTER_CACHE.has(cacheKey)) {
    return LOCAL_DATE_FORMATTER_CACHE.get(cacheKey);
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: cacheKey,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  LOCAL_DATE_FORMATTER_CACHE.set(cacheKey, formatter);
  return formatter;
};

const getLocalTimeParts = (date, timezone) => {
  const formatter = getLocalDateFormatter(timezone);
  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  const weekdayToken = String(values.weekday || '').trim().toUpperCase();
  const weekday = WEEKDAY_LOOKUP[weekdayToken] ?? null;
  const year = Number.parseInt(values.year, 10);
  const month = Number.parseInt(values.month, 10);
  const day = Number.parseInt(values.day, 10);
  const hour = Number.parseInt(values.hour, 10);
  const minute = Number.parseInt(values.minute, 10);

  if (
    !Number.isInteger(weekday)
    || !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || !Number.isInteger(hour)
    || !Number.isInteger(minute)
  ) {
    return null;
  }

  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    weekday,
    minutesFromStartOfDay: (hour * 60) + minute,
    dateKey,
  };
};

const isNonTerminalScheduledInterview = (interview) => {
  const status = String(interview?.status || '').trim().toUpperCase();
  if (TERMINAL_INTERVIEW_STATUSES.has(status)) return false;
  if (!interview?.scheduledFor) return false;
  const startMs = Date.parse(interview.scheduledFor);
  return Number.isFinite(startMs);
};

const buildScheduledInterviewIndex = ({ interviews = [], timezone, bufferMinutes }) => {
  const safeBufferMinutes = Math.max(0, bufferMinutes || 0);
  const bufferMs = safeBufferMinutes * 60 * 1000;
  const indexed = [];
  const dailyCounts = new Map();

  interviews.forEach((interview) => {
    if (!isNonTerminalScheduledInterview(interview)) return;
    const startMs = Date.parse(interview.scheduledFor);
    const durationMinutes = parseIntegerWithinRange(
      interview?.duration,
      DEFAULT_INTERVIEW_DURATION_MINUTES,
      15,
      180,
    );
    const endMs = startMs + (durationMinutes * 60 * 1000);
    const localParts = getLocalTimeParts(new Date(startMs), timezone);
    if (localParts?.dateKey) {
      dailyCounts.set(localParts.dateKey, (dailyCounts.get(localParts.dateKey) || 0) + 1);
    }
    indexed.push({
      interviewId: interview.id,
      startWithBufferMs: startMs - bufferMs,
      endWithBufferMs: endMs + bufferMs,
    });
  });

  return {
    indexed,
    dailyCounts,
  };
};

const findConstraintBasedAutoScheduleSlot = ({ settings, existingInterviews = [] }) => {
  const now = new Date();
  now.setSeconds(0, 0);
  const startDate = new Date(now.getTime() + (settings.leadHours * 60 * 60 * 1000));
  const initialSlot = roundToNextScheduleSlot(startDate, settings.slotMinutes);
  const slotStepMs = settings.slotMinutes * 60 * 1000;
  const durationMs = settings.durationMinutes * 60 * 1000;
  const slotSearchEndMs = initialSlot.getTime() + (settings.scheduleWindowDays * 24 * 60 * 60 * 1000);
  const workingDays = new Set(settings.workingDays || DEFAULT_WORKING_DAYS);

  const {
    indexed: indexedInterviews,
    dailyCounts,
  } = buildScheduledInterviewIndex({
    interviews: existingInterviews,
    timezone: settings.timezone,
    bufferMinutes: settings.bufferMinutes,
  });

  let cursorMs = initialSlot.getTime();
  let iterations = 0;
  while (cursorMs <= slotSearchEndMs && iterations < MAX_SLOT_SEARCH_ITERATIONS) {
    iterations += 1;
    const slotDate = new Date(cursorMs);
    const localParts = getLocalTimeParts(slotDate, settings.timezone);
    if (localParts) {
      const slotStartMinutes = localParts.minutesFromStartOfDay;
      const slotEndMinutes = slotStartMinutes + settings.durationMinutes;
      const withinWorkingDay = workingDays.has(localParts.weekday);
      const withinBusinessHours = (
        slotStartMinutes >= settings.businessHoursStartMinutes
        && slotEndMinutes <= settings.businessHoursEndMinutes
      );
      const currentDayLoad = dailyCounts.get(localParts.dateKey) || 0;
      const withinDailyLimit = currentDayLoad < settings.maxInterviewsPerDay;

      if (withinWorkingDay && withinBusinessHours && withinDailyLimit) {
        const candidateStartWithBuffer = cursorMs - (settings.bufferMinutes * 60 * 1000);
        const candidateEndWithBuffer = cursorMs + durationMs + (settings.bufferMinutes * 60 * 1000);
        const hasConflict = indexedInterviews.some((entry) => (
          candidateStartWithBuffer < entry.endWithBufferMs
          && candidateEndWithBuffer > entry.startWithBufferMs
        ));
        if (!hasConflict) {
          return {
            scheduledFor: slotDate.toISOString(),
            iterations,
            conflictChecks: indexedInterviews.length,
          };
        }
      }
    }
    cursorMs += slotStepMs;
  }

  return {
    scheduledFor: null,
    iterations,
    conflictChecks: indexedInterviews.length,
  };
};

const resolveInterviewAutomationSettings = (organization, job, recruiter = null, options = {}) => {
  const orgSettings = organization?.settings && typeof organization.settings === 'object'
    ? organization.settings
    : {};
  const automation = orgSettings.interviewAutomation && typeof orgSettings.interviewAutomation === 'object'
    ? orgSettings.interviewAutomation
    : {};
  const templateConfig = job?.templateConfig && typeof job.templateConfig === 'object'
    ? job.templateConfig
    : {};

  const leadHours = parseIntegerWithinRange(
    automation.leadHours,
    DEFAULT_AUTO_SCHEDULE_LEAD_HOURS,
    1,
    72,
  );
  const slotMinutes = parseIntegerWithinRange(
    automation.slotMinutes,
    DEFAULT_AUTO_SCHEDULE_SLOT_MINUTES,
    15,
    180,
  );
  const scheduleWindowDays = parseIntegerWithinRange(
    automation.scheduleWindowDays,
    DEFAULT_AUTO_SCHEDULE_WINDOW_DAYS,
    1,
    90,
  );
  const bufferMinutes = parseIntegerWithinRange(
    automation.bufferMinutes,
    DEFAULT_AUTO_SCHEDULE_BUFFER_MINUTES,
    0,
    180,
  );
  const maxInterviewsPerDay = parseIntegerWithinRange(
    automation.maxInterviewsPerDay,
    DEFAULT_AUTO_SCHEDULE_MAX_INTERVIEWS_PER_DAY,
    1,
    40,
  );

  const durationMinutes = parseIntegerWithinRange(
    automation.durationMinutes ?? templateConfig.duration,
    DEFAULT_INTERVIEW_DURATION_MINUTES,
    15,
    180,
  );

  const interviewTypes = normalizeInterviewModeType(automation.interviewTypes).length > 0
    ? normalizeInterviewModeType(automation.interviewTypes)
    : (
      normalizeInterviewModeType(templateConfig.interviewTypes).length > 0
        ? normalizeInterviewModeType(templateConfig.interviewTypes)
        : ['BEHAVIORAL', 'TECHNICAL']
    );
  const skillFocus = Array.isArray(templateConfig.skillFocus) && templateConfig.skillFocus.length > 0
    ? templateConfig.skillFocus
    : (Array.isArray(job?.skills) ? job.skills : []);

  const organizationTimezone = normalizeIanaTimezone(
    (typeof automation.timezone === 'string' && automation.timezone.trim())
      ? automation.timezone.trim()
      : ((recruiter?.profile?.timezone || recruiter?.timezone || DEFAULT_INTERVIEW_TIMEZONE)),
    DEFAULT_INTERVIEW_TIMEZONE,
  );
  const organizationWorkingDays = normalizeWorkingDays(automation.workingDays);
  const organizationBusinessHoursStartMinutes = parseTimeToMinutes(
    automation.businessHoursStart,
    DEFAULT_BUSINESS_START_MINUTES,
  );
  const parsedBusinessHoursEndMinutes = parseTimeToMinutes(
    automation.businessHoursEnd,
    DEFAULT_BUSINESS_END_MINUTES,
  );
  const organizationBusinessHoursEndMinutes = parsedBusinessHoursEndMinutes > (organizationBusinessHoursStartMinutes + 15)
    ? parsedBusinessHoursEndMinutes
    : Math.min(24 * 60, organizationBusinessHoursStartMinutes + durationMinutes + 15);
  const conflictScope = parseConflictScope(automation.conflictScope);
  const recruiterAvailability = resolveRecruiterAvailabilityOverrides(recruiter, {
    timezone: organizationTimezone,
    workingDays: organizationWorkingDays,
    businessHoursStartMinutes: organizationBusinessHoursStartMinutes,
    businessHoursEndMinutes: organizationBusinessHoursEndMinutes,
    maxInterviewsPerDay,
    durationMinutes,
  });

  const timezone = recruiterAvailability?.timezone || organizationTimezone;
  const workingDays = recruiterAvailability?.workingDays || organizationWorkingDays;
  const businessHoursStartMinutes = recruiterAvailability?.businessHoursStartMinutes ?? organizationBusinessHoursStartMinutes;
  const businessHoursEndMinutes = recruiterAvailability?.businessHoursEndMinutes ?? organizationBusinessHoursEndMinutes;
  const effectiveMaxInterviewsPerDay = recruiterAvailability?.maxInterviewsPerDay ?? maxInterviewsPerDay;
  const effectiveDurationMinutes = recruiterAvailability?.durationMinutes ?? durationMinutes;

  const now = new Date();
  now.setSeconds(0, 0);
  const baseDate = new Date(now.getTime() + leadHours * 60 * 60 * 1000);
  const scheduledFor = roundToNextScheduleSlot(baseDate, slotMinutes).toISOString();

  let autoScheduleEnabled = automation.autoScheduleOnInterviewing !== false;
  if (options?.forceAutoSchedule === true) {
    autoScheduleEnabled = true;
  } else if (options?.forceAutoSchedule === false) {
    autoScheduleEnabled = false;
  }

  return {
    autoScheduleEnabled,
    timezone,
    leadHours,
    slotMinutes,
    scheduledFor,
    scheduleWindowDays,
    bufferMinutes,
    maxInterviewsPerDay: effectiveMaxInterviewsPerDay,
    workingDays,
    businessHoursStartMinutes,
    businessHoursEndMinutes,
    conflictScope,
    durationMinutes: effectiveDurationMinutes,
    interviewTypes,
    skillFocus,
    availabilitySource: recruiterAvailability ? 'RECRUITER' : 'ORGANIZATION',
  };
};

const queueInterviewScheduledEmail = ({
  interview,
  candidate,
  job,
  organization,
  operation = 'AUTO_SCHEDULED_INTERVIEW',
} = {}) => {
  if (!interview || !candidate?.email || !organization) return;
  queueEmailJob({
    type: 'INTERVIEW_SCHEDULED',
    payload: {
      interviewId: interview.id,
      candidateId: interview.candidateId || null,
      recipient: candidate.email,
      operation,
    },
    handler: async () => {
      await emailNotifications.sendInterviewScheduled(interview, candidate, job, organization);
      logger.info(`Interview scheduled email sent to ${candidate.email}`);
    },
  });
};

const APPLICATION_STATUS_EMAIL_MESSAGES = Object.freeze({
  SUBMITTED:
    'Your application has been received and is now under review by the hiring team.',
  SCREENING:
    'Your application is currently in screening. The team is reviewing your CV and profile details.',
  INTERVIEWING:
    'Great news. Your application has moved to interviewing. Interview scheduling details will follow shortly.',
  SHORTLISTED:
    'You have been shortlisted. The hiring team will share next steps soon.',
  OFFER:
    'Your interviews are complete. The hiring team is preparing the offer stage for this application.',
  REJECTED:
    'Thank you for your interest. We have moved forward with other candidates for this role.',
  HIRED:
    'Congratulations. You have been selected for this role.',
});

const buildApplicationStatusEmailMessage = ({
  status = null,
  previousStatus = null,
  dispositionReason = null,
} = {}) => {
  const normalizedStatus = normalizeApplicationStatus(status);
  if (!normalizedStatus) return '';

  if (normalizedStatus === 'REJECTED') {
    const normalizedReason = typeof dispositionReason === 'string' ? dispositionReason.trim() : '';
    return normalizedReason
      ? `Thank you for your interest. ${normalizedReason}`
      : APPLICATION_STATUS_EMAIL_MESSAGES.REJECTED;
  }

  const baseMessage = APPLICATION_STATUS_EMAIL_MESSAGES[normalizedStatus] || '';
  if (!baseMessage) return '';

  const normalizedPrevious = normalizeApplicationStatus(previousStatus);
  if (normalizedPrevious && normalizedPrevious === normalizedStatus) {
    return '';
  }

  return baseMessage;
};

const loadReviewerApplicationScope = async (organizationId, reviewerId) => {
  if (!organizationId || !reviewerId) {
    return {
      allowedInterviewIds: new Set(),
      allowedCandidateJobScopes: new Set(),
    };
  }

  const interviews = await interviewStore.listByOrganization(organizationId).catch(() => []);
  return buildReviewerApplicationScope(interviews, reviewerId);
};

const parseOptionalStatus = (value) => {
  if (!value) return null;
  return normalizeApplicationStatus(value);
};

const parseInterviewSchedulingMode = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!INTERVIEW_SCHEDULING_MODES.has(normalized)) return null;
  return normalized;
};

const parseOptionalLimit = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
};

const paginateApplicationsInMemory = (applications = [], { limit = 50, cursor = null } = {}) => {
  const normalizedLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 200));
  const cursorMs = cursor ? Date.parse(cursor) : Number.NaN;

  const filtered = applications
    .slice()
    .sort((left, right) => Date.parse(right?.createdAt || 0) - Date.parse(left?.createdAt || 0))
    .filter((application) => {
      if (!Number.isFinite(cursorMs)) return true;
      const createdAtMs = Date.parse(application?.createdAt || '');
      return Number.isFinite(createdAtMs) ? createdAtMs < cursorMs : true;
    });

  const items = filtered.slice(0, normalizedLimit);
  return {
    items,
    nextCursor: items.length === normalizedLimit ? items[items.length - 1]?.createdAt || null : null,
    hasMore: filtered.length > normalizedLimit,
  };
};

const normalizeJobQuestions = (job = {}) => {
  const rawQuestions = Array.isArray(job?.applicationQuestions) && job.applicationQuestions.length > 0
    ? job.applicationQuestions
    : (Array.isArray(job?.customFormFields) ? job.customFormFields : []);

  return rawQuestions
    .map((rawQuestion, index) => {
      const question = rawQuestion && typeof rawQuestion === 'object'
        ? rawQuestion
        : { question: rawQuestion };
      return {
        id: (question.id || `question_${index + 1}`).toString().trim() || `question_${index + 1}`,
        question: (question.question || question.label || '').toString().trim(),
        required: Boolean(question.required),
      };
    })
    .filter((question) => question.question);
};

const normalizeAnswerValue = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
};

const buildApplicationJobPayload = (application, liveJob = null) => {
  const snapshot = application?.jobSnapshot && typeof application.jobSnapshot === 'object'
    ? application.jobSnapshot
    : null;
  const hasDeletionMarker = Boolean(
    application?.jobDeletedAt || (!liveJob && application?.jobId),
  );
  const source = liveJob || snapshot;
  const isDeleted = !liveJob && hasDeletionMarker;
  const applicationQuestions = normalizeJobQuestions(source);

  if (!source && !application?.jobId && !hasDeletionMarker) {
    return null;
  }

  return {
    id: source?.id || application?.jobId || null,
    title: source?.title || (isDeleted ? 'Deleted Position' : null),
    department: source?.department || null,
    location: source?.location || null,
    employmentType: source?.employmentType || null,
    experienceLevel: source?.experienceLevel || null,
    salaryCurrency: source?.salaryCurrency || null,
    salaryMin: source?.salaryMin ?? null,
    salaryMax: source?.salaryMax ?? null,
    skills: Array.isArray(source?.skills) ? source.skills : [],
    applicationQuestions,
    isDeleted,
    deletedAt: application?.jobDeletedAt || null,
  };
};

const buildApplicationOrganizationPayload = (application, liveOrganization = null) => {
  const snapshot = application?.organizationSnapshot && typeof application.organizationSnapshot === 'object'
    ? application.organizationSnapshot
    : null;
  const source = liveOrganization || snapshot;

  if (!source && !application?.organizationId) {
    return null;
  }

  return {
    id: source?.id || application.organizationId || null,
    name: source?.name || source?.displayName || 'Company',
    logo: source?.logo || null,
    website: source?.website || null,
  };
};

const sanitizeApplication = (application, candidate = null, job = null, organization = null, options = {}) => {
  if (!application) return null;
  const includeOffer = options?.includeOffer === true;
  const includeOnboarding = options?.includeOnboarding === true;
  const hasDeletedJobContext = Boolean(
    application.jobDeletedAt || (!job && application.jobId),
  );
  const latestHistory = Array.isArray(application.statusHistory)
    ? application.statusHistory.slice(-20)
    : [];
  const disposition = normalizeDisposition(application, {
    status: application.status,
    withdrawnBy: application.withdrawnBy || null,
    jobDeletedAt: hasDeletedJobContext ? (application.jobDeletedAt || 'LEGACY_ORPHAN_JOB') : null,
    fallbackCode: application.dispositionCode || null,
    fallbackReason: application.dispositionReason || null,
  });

  return {
    id: application.id,
    jobId: application.jobId,
    candidateId: application.candidateId,
    organizationId: application.organizationId,
    status: application.status,
    resumeUrl: application.resumeUrl,
    coverLetter: application.coverLetter,
    answers: application.answers || [],
    submittedAt: application.submittedAt || application.createdAt, // Fallback to createdAt for backward compatibility
    reviewedAt: application.reviewedAt,
    reviewedBy: application.reviewedBy,
    withdrawnBy: application.withdrawnBy || null, // Track if withdrawn by candidate
    statusSource: application.statusSource || null,
    statusChangedAt: application.statusChangedAt || application.reviewedAt || application.updatedAt || null,
    dispositionCode: disposition.code,
    dispositionCategory: disposition.category,
    dispositionReason: disposition.reason,
    dispositionNotes: disposition.notes,
    dispositionTags: disposition.tags,
    dispositionAt: application.dispositionAt || null,
    dispositionBy: application.dispositionBy || null,
    statusHistory: latestHistory,
    interviewId: application.interviewId,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    interviewPlan: sanitizeInterviewPlanForClient(application.interviewPlan),
    offer: includeOffer ? sanitizeApplicationOffer(application.offer) : null,
    offerHistory: includeOffer ? sanitizeApplicationOfferHistory(application.offerHistory) : [],
    onboarding: includeOnboarding ? sanitizeApplicationOnboarding(application.onboarding) : null,
    candidate,
    job: buildApplicationJobPayload(application, job),
    organization: buildApplicationOrganizationPayload(application, organization),
  };
};

const ensureOnboardingForHiredApplication = async (application, { actorId = null, actorRole = 'SYSTEM' } = {}) => {
  if (!application || normalizeApplicationStatus(application.status) !== 'HIRED') {
    return application;
  }

  const sanitizedExisting = sanitizeApplicationOnboarding(application.onboarding);
  if (sanitizedExisting) {
    return application;
  }

  const onboarding = createApplicationOnboarding(application, { actorId, actorRole });
  const updated = await jobApplicationStore.update(application.id, { onboarding });
  return {
    ...application,
    ...updated,
    status: updated?.status ?? application.status,
    offer: updated?.offer ?? application.offer,
    offerHistory: updated?.offerHistory ?? application.offerHistory,
    statusHistory: updated?.statusHistory ?? application.statusHistory,
    onboarding,
  };
};

const loadApplicationContext = async (application) => {
  if (!application) {
    return {
      candidate: null,
      job: null,
      organization: null,
    };
  }

  const [candidate, job, organization] = await Promise.all([
    application.candidateId ? userStore.getSummary(application.candidateId) : Promise.resolve(null),
    application.jobId ? jobStore.getById(application.jobId) : Promise.resolve(null),
    application.organizationId ? organizationStore.getById(application.organizationId) : Promise.resolve(null),
  ]);

  return { candidate, job, organization };
};

const isOfferPendingAndActionable = (offer) => {
  const sanitized = sanitizeApplicationOffer(offer);
  if (!sanitized || sanitized.status !== 'PENDING') return false;
  if (!sanitized.expiresAt) return true;
  return new Date(sanitized.expiresAt).getTime() > Date.now();
};

const buildApplicationOfferUrl = (applicationId) => (
  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-applications/${encodeURIComponent(applicationId)}/offer`
);

const buildOfferNotificationRecipients = async (organizationId, actorId = null) => {
  if (!organizationId) return [];

  const members = await organizationMemberStore.listByOrganization(organizationId).catch(() => []);
  const eligibleMembers = members.filter((member) => {
    const role = String(member?.role || '').toUpperCase();
    const status = String(member?.status || '').toUpperCase();
    return ['ADMIN', 'RECRUITER'].includes(role) && (!status || status === 'ACTIVE');
  });

  const users = await Promise.all(
    eligibleMembers.map(async (member) => {
      const user = member?.userId ? await userStore.getSummary(member.userId).catch(() => null) : null;
      if (!user?.email) return null;
      if (actorId && user.id === actorId) return null;
      return user;
    }),
  );

  return users.filter(Boolean);
};

const loadSchedulingCandidates = async ({
  application,
  recruiterId,
  settings,
  interviewIdToExclude = null,
} = {}) => {
  if (!application || !settings?.autoScheduleEnabled) return [];

  let interviews = [];
  if (settings.conflictScope === 'ORGANIZATION' || !recruiterId) {
    interviews = await interviewStore.listByOrganization(application.organizationId, { limit: 200 });
  } else {
    interviews = await interviewStore.listByCompany(recruiterId, { limit: 200 });
  }

  return interviews.filter((interview) => (
    interview
    && interview.id
    && interview.id !== interviewIdToExclude
    && isNonTerminalScheduledInterview(interview)
  ));
};

const resolveAutomationRecruiterContext = async ({
  application,
  recruiter,
  interview,
} = {}) => {
  const linkedRecruiterId = typeof interview?.companyId === 'string' && interview.companyId.trim()
    ? interview.companyId.trim()
    : null;
  const actingRecruiterId = typeof recruiter?.id === 'string' && recruiter.id.trim()
    ? recruiter.id.trim()
    : null;
  const reviewedByRecruiterId = typeof application?.reviewedBy === 'string' && application.reviewedBy.trim()
    ? application.reviewedBy.trim()
    : null;
  const recruiterId = linkedRecruiterId || actingRecruiterId || reviewedByRecruiterId || null;

  if (!recruiterId) {
    return {
      recruiterId: null,
      recruiterRecord: null,
      warning: null,
    };
  }

  try {
    const recruiterRecord = await userStore.getById(recruiterId);
    if (recruiterRecord) {
      return {
        recruiterId,
        recruiterRecord,
        warning: null,
      };
    }
    return {
      recruiterId,
      recruiterRecord: null,
      warning: 'Assigned recruiter availability could not be loaded. Interview was created without automatic scheduling.',
    };
  } catch (error) {
    logger.warn(`Failed to load recruiter ${recruiterId} for interview automation:`, error);
    return {
      recruiterId,
      recruiterRecord: null,
      warning: 'Assigned recruiter availability could not be loaded. Interview was created without automatic scheduling.',
    };
  }
};

const buildInterviewSchedulingPreview = async ({
  application,
  job,
  organization,
  recruiter,
  interview,
} = {}) => {
  if (!application || !job || !organization) {
    return {
      constraints: null,
      error: {
        message: 'Scheduling rules are unavailable right now.',
        code: 'SCHEDULING_PREVIEW_UNAVAILABLE',
      },
    };
  }

  const recruiterContext = await resolveAutomationRecruiterContext({
    application,
    recruiter,
    interview,
  });
  const settings = resolveInterviewAutomationSettings(
    organization,
    job,
    recruiterContext.recruiterRecord,
  );
  const interviewPlan = buildInterviewPlanSnapshot({
    application,
    job,
    settings,
    reviewerAssignments: Array.isArray(interview?.reviewerAssignments)
      ? interview.reviewerAssignments
      : [],
  });
  const currentStage = getCurrentInterviewPlanStage(interviewPlan);
  const previewInterviewTypes = Array.isArray(currentStage?.interviewTypes) && currentStage.interviewTypes.length > 0
    ? currentStage.interviewTypes
    : settings.interviewTypes;
  const previewSkillFocus = Array.isArray(currentStage?.skillFocus) && currentStage.skillFocus.length > 0
    ? currentStage.skillFocus
    : settings.skillFocus;

  return {
    constraints: {
      timezone: settings.timezone,
      leadHours: settings.leadHours,
      slotMinutes: settings.slotMinutes,
      scheduleWindowDays: settings.scheduleWindowDays,
      durationMinutes: Number(currentStage?.durationMinutes) || settings.durationMinutes,
      workingDays: Array.isArray(settings.workingDays) ? [...settings.workingDays] : [],
      businessHoursStartMinutes: settings.businessHoursStartMinutes,
      businessHoursEndMinutes: settings.businessHoursEndMinutes,
      maxInterviewsPerDay: settings.maxInterviewsPerDay,
      conflictScope: settings.conflictScope || null,
      availabilitySource: settings.availabilitySource || null,
      assignedRecruiterId: recruiterContext.recruiterId || null,
      assignedRecruiterName: recruiterContext.recruiterRecord?.fullName
        || recruiterContext.recruiterRecord?.displayName
        || recruiterContext.recruiterRecord?.companyName
        || null,
      planStageId: currentStage?.id || null,
      planStageName: currentStage?.name || null,
      planStageCategory: currentStage?.category || null,
      planStageSequence: currentStage?.sequence || null,
      planStageTotal: Array.isArray(interviewPlan?.stages) ? interviewPlan.stages.length : null,
      interviewTypes: Array.isArray(previewInterviewTypes) ? [...previewInterviewTypes] : [],
      skillFocus: Array.isArray(previewSkillFocus) ? [...previewSkillFocus] : [],
    },
    error: recruiterContext.warning
      ? {
        message: recruiterContext.warning,
        code: 'ASSIGNED_RECRUITER_UNAVAILABLE',
      }
      : null,
  };
};

const ensureInterviewAutomationForInterviewing = async ({
  req,
  application,
  job,
  organization,
  recruiter,
  candidate,
  interviewSchedulingMode = null,
  reviewerAssignments = undefined,
} = {}) => {
  if (!application || !job || !organization) {
    return { interview: null, created: false, scheduled: false };
  }
  const result = await ensureInterviewPlanStageForInterviewing({
    application,
    job,
    organization,
    recruiter,
    reviewerAssignments,
    interviewSchedulingMode,
  });
  const {
    interview,
    created,
    scheduled,
    slotFound,
    schedulingStats,
    warning,
    currentStage,
    plan,
  } = result;

  if (!interview) {
    return {
      ...result,
      warning: warning || null,
      plan,
    };
  }

  if (created) {
    await publishOrganizationRealtimeUpdate(application.organizationId, 'interview-created', {
      interviewId: interview.id,
      status: interview.status || null,
      candidateId: interview.candidateId || null,
      jobId: interview.jobId || null,
      planStageId: interview.planStageId || null,
      planStageName: interview.planStageName || currentStage?.name || null,
    });
    await publishCandidateRealtimeUpdate(application.candidateId, 'interview-created', {
      interviewId: interview.id,
      status: interview.status || null,
      organizationId: interview.organizationId || null,
      jobId: interview.jobId || null,
      planStageId: interview.planStageId || null,
      planStageName: interview.planStageName || currentStage?.name || null,
    });
  }

  if (scheduled) {
    await activityLogStore.record({
      organizationId: application.organizationId,
      actorId: recruiter?.id || application.reviewedBy || null,
      actorRole: recruiter?.organizationContext?.membership?.role || null,
      action: created ? 'INTERVIEW_AUTO_CREATED_AND_SCHEDULED' : 'INTERVIEW_AUTO_SCHEDULED',
      targetType: 'INTERVIEW',
      targetId: interview.id,
      metadata: {
        applicationId: application.id,
        scheduledFor: interview.scheduledFor || null,
        timezone: interview.timezone || null,
        strategy: 'CONSTRAINT_BASED_V1',
        slotFound,
        planStageId: interview.planStageId || null,
        planStageName: interview.planStageName || currentStage?.name || null,
        ...(schedulingStats || {}),
      },
    });
    await publishOrganizationRealtimeUpdate(application.organizationId, 'interview-scheduled', {
      interviewId: interview.id,
      status: 'SCHEDULED',
      scheduledFor: interview.scheduledFor || null,
      candidateId: interview.candidateId || null,
      jobId: interview.jobId || null,
      autoScheduled: true,
      strategy: 'CONSTRAINT_BASED_V1',
      planStageId: interview.planStageId || null,
      planStageName: interview.planStageName || currentStage?.name || null,
    });
    await publishCandidateRealtimeUpdate(application.candidateId, 'interview-scheduled', {
      interviewId: interview.id,
      status: 'SCHEDULED',
      scheduledFor: interview.scheduledFor || null,
      organizationId: interview.organizationId || null,
      jobId: interview.jobId || null,
      autoScheduled: true,
      strategy: 'CONSTRAINT_BASED_V1',
      planStageId: interview.planStageId || null,
      planStageName: interview.planStageName || currentStage?.name || null,
    });
    queueInterviewScheduledEmail({
      interview,
      candidate,
      job,
      organization,
      operation: created ? 'AUTO_CREATED_AND_SCHEDULED' : 'AUTO_SCHEDULED',
    });
  }

  return {
    ...result,
    plan,
    warning: warning || null,
  };
};

export class ApplicationController {
  /**
   * Submit a job application
   */
  static async submitApplication(req, res, next) {
    try {
      const { jobId } = req.params;
      const { resumeUrl, coverLetter, answers } = req.body;
      const candidateId = req.user.id;
      const normalizedResumeUrl = (resumeUrl || req.user?.profile?.resumeUrl || '').toString().trim();
      let organization = null;

      // Get the job
      let job = await jobStore.getById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Ensure scheduled jobs are promoted before evaluating application eligibility.
      if (job.status === 'PUBLISHED' && job.scheduledPublishAt && !job.publishedAt) {
        await jobStore.autoPublishScheduledJobs();
        job = await jobStore.getById(jobId);
      }

      // Check if job is publicly live and accepting applications.
      if (!isJobCurrentlyPublic(job)) {
        return res.status(400).json({ error: 'This job is not currently accepting applications' });
      }

      if (job.acceptingApplications === false) {
        return res.status(400).json({ error: 'Applications are closed for this position' });
      }

      // Enforce resume requirement server-side even if the client is bypassed.
      if (!normalizedResumeUrl) {
        return res.status(400).json({ error: 'Resume is required to submit an application' });
      }

      // Validate required answers before creating the application.
      const applicationQuestions = normalizeJobQuestions(job);
      if (applicationQuestions.length > 0) {
        const requiredQuestions = applicationQuestions.filter((question) => question.required);
        const answersByQuestionId = new Map(
          (Array.isArray(answers) ? answers : []).map((answer) => [
            (answer?.questionId || '').toString().trim(),
            normalizeAnswerValue(answer?.answer),
          ]),
        );

        for (const question of requiredQuestions) {
          const candidateAnswer = answersByQuestionId.get(question.id);
          if (!candidateAnswer) {
            return res.status(400).json({
              error: `Missing required answer for: ${question.question}`,
            });
          }
        }
      }

      // Get organization snapshot BEFORE transaction
      try {
        organization = await organizationStore.getById(job.organizationId);
      } catch (organizationError) {
        logger.warn(`Unable to fetch organization ${job.organizationId} for application snapshot:`, organizationError);
      }

      // CRITICAL FIX: Use transaction to prevent race condition (TOCTOU vulnerability)
      // This ensures duplicate check and create are atomic
      let application;
      try {
        application = await jobApplicationStore.createWithDuplicateCheck({
          jobId,
          candidateId,
          organizationId: job.organizationId,
          status: 'SUBMITTED',
          resumeUrl: normalizedResumeUrl,
          coverLetter: coverLetter || null,
          answers: answers || [],
          jobSnapshot: buildJobSnapshot(job),
          organizationSnapshot: buildOrganizationSnapshot(organization, job.organizationId),
          statusSource: 'CANDIDATE_SUBMISSION',
          statusChangedAt: new Date().toISOString(),
          statusHistory: [
            buildStatusHistoryEntry({
              previousStatus: null,
              status: 'SUBMITTED',
              changedBy: candidateId,
              source: 'CANDIDATE_SUBMISSION',
            }),
          ],
        });
      } catch (duplicateError) {
        if (duplicateError.code === 'DUPLICATE_APPLICATION') {
          return res.status(409).json({
            error: 'You have already applied to this position',
            application: sanitizeApplication(duplicateError.existingApplication, null, null, null, { includeOffer: true }),
          });
        }
        throw duplicateError;
      }

      // Log activity
      await activityLogStore.record({
        organizationId: job.organizationId,
        actorId: candidateId,
        actorRole: null,
        action: 'APPLICATION_SUBMITTED',
        targetType: 'APPLICATION',
        targetId: application.id,
        metadata: {
          jobId,
          jobTitle: job.title,
        },
      });

      logger.info(`Application submitted: ${application.id} for job ${jobId} by candidate ${candidateId}`);

      await publishOrganizationRealtimeUpdate(job.organizationId, 'application-submitted', {
        applicationId: application.id,
        jobId,
        candidateId,
        status: application.status || null,
      });
      await publishCandidateRealtimeUpdate(candidateId, 'application-submitted', {
        applicationId: application.id,
        jobId,
        organizationId: job.organizationId,
        status: application.status || null,
      });

      // Send confirmation email in background.
      if (!organization) {
        organization = await organizationStore.getById(job.organizationId).catch(() => null);
      }
      if (organization && req.user?.email) {
        queueEmailJob({
          type: 'APPLICATION_RECEIVED',
          payload: {
            applicationId: application.id,
            candidateId,
            recipient: req.user.email,
          },
          handler: async () => {
            await emailNotifications.sendApplicationReceived(application, req.user, job, organization);
            logger.info(`Application confirmation email sent to ${req.user.email}`);
          },
        });
      }

      res.status(201).json({
        success: true,
        application: sanitizeApplication(application, null, job, organization, { includeOffer: true }),
        message: 'Application submitted successfully',
      });
    } catch (error) {
      logger.error('Submit application error:', error);
      next(error);
    }
  }

  /**
   * Get candidate's applications
   */
  static async getCandidateApplications(req, res, next) {
    try {
      const candidateId = req.user.id;
      const requestedStatus = parseOptionalStatus(req.query.status);
      const requestedLimit = parseOptionalLimit(req.query.limit);
      const requestedCursor = req.query.cursor ? String(req.query.cursor).trim() : null;

      let applications = [];
      let page = null;
      if (requestedLimit || requestedCursor) {
        page = await jobApplicationStore.listByCandidatePage(candidateId, {
          status: requestedStatus,
          limit: requestedLimit || 50,
          cursor: requestedCursor,
        });
        applications = page.items;
      } else {
        applications = await jobApplicationStore.listByCandidate(candidateId);
        if (requestedStatus) {
          applications = applications.filter(
            (application) => normalizeApplicationStatus(application?.status) === requestedStatus,
          );
        }
      }

      // Enrich with job and organization details
      const jobIds = applications.map((app) => app.jobId).filter(Boolean);
      const organizationIds = [...new Set(applications.map((app) => app.organizationId).filter(Boolean))];
      
      const [jobs, organizations] = await Promise.all([
        Promise.all(jobIds.map((id) => jobStore.getById(id))),
        Promise.all(organizationIds.map((id) => organizationStore.getById(id))),
      ]);
      
      const jobMap = new Map(jobs.filter(Boolean).map((job) => [job.id, job]));
      const orgMap = new Map(organizations.filter(Boolean).map((org) => [org.id, org]));

      const enriched = applications.map((app) =>
        sanitizeApplication(app, null, jobMap.get(app.jobId), orgMap.get(app.organizationId), {
          includeOffer: true,
          includeOnboarding: true,
        }),
      );

      res.json({
        success: true,
        applications: enriched,
        pagination: page
          ? {
            limit: requestedLimit || 50,
            nextCursor: page.nextCursor || null,
            hasMore: page.hasMore === true,
          }
          : null,
      });
    } catch (error) {
      logger.error('Get candidate applications error:', error);
      next(error);
    }
  }

  /**
   * Get application by ID
   */
  static async getApplication(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationId = req.user.organizationContext?.organization?.id;
      const reviewerOnly = accountType === 'COMPANY' && isReviewerRole(req.user);

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Check access
      const isCandidate = accountType === 'CANDIDATE' && application.candidateId === userId;
      const isCompanyMember = accountType === 'COMPANY' && application.organizationId === organizationId;

      let reviewerScope = null;
      if (reviewerOnly && isCompanyMember) {
        reviewerScope = await loadReviewerApplicationScope(organizationId, userId);
      }

      const isRecruiter = isCompanyMember && !reviewerOnly;
      const isScopedReviewer = reviewerOnly
        && isCompanyMember
        && canReviewerAccessApplication(application, reviewerScope);

      if (!isCandidate && !isRecruiter && !isScopedReviewer) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get job, candidate, and organization details
      const [job, candidate, organization, interview] = await Promise.all([
        jobStore.getById(application.jobId),
        userStore.getSummary(application.candidateId),
        organizationStore.getById(application.organizationId),
        application.interviewId
          ? interviewStore.getById(application.interviewId).catch(() => null)
          : Promise.resolve(null),
      ]);

      let responseApplication = sanitizeApplication(
        application,
        candidate,
        job,
        organization,
        { includeOffer: isCandidate || isRecruiter, includeOnboarding: isCandidate || isRecruiter },
      );
      if (isRecruiter) {
        const schedulingPreview = await buildInterviewSchedulingPreview({
          application,
          job,
          organization,
          recruiter: req.user,
          interview,
        });
        responseApplication = {
          ...responseApplication,
          interviewSchedulingPreview: schedulingPreview.constraints,
          interviewSchedulingPreviewError: schedulingPreview.error,
        };
      }

      res.json({
        success: true,
        application: responseApplication,
      });
    } catch (error) {
      logger.error('Get application error:', error);
      next(error);
    }
  }

  /**
   * Get applications for a job (recruiter)
   */
  static async getJobApplications(req, res, next) {
    try {
      const { jobId } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const reviewerOnly = isReviewerRole(req.user);
      const requestedStatus = parseOptionalStatus(req.query.status);
      const requestedLimit = parseOptionalLimit(req.query.limit);
      const requestedCursor = req.query.cursor ? String(req.query.cursor).trim() : null;

      // Verify job belongs to organization
      const job = await jobStore.getById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      let applications = [];
      let page = null;
      if (reviewerOnly) {
        applications = await jobApplicationStore.listByJob(jobId);
        if (requestedStatus) {
          applications = applications.filter(
            (application) => normalizeApplicationStatus(application?.status) === requestedStatus,
          );
        }
      } else if (requestedLimit || requestedCursor) {
        page = await jobApplicationStore.listByJobPage(jobId, {
          status: requestedStatus,
          limit: requestedLimit || 50,
          cursor: requestedCursor,
        });
        applications = page.items;
      } else {
        applications = await jobApplicationStore.listByJob(jobId);
        if (requestedStatus) {
          applications = applications.filter(
            (application) => normalizeApplicationStatus(application?.status) === requestedStatus,
          );
        }
      }

      if (reviewerOnly) {
        const reviewerScope = await loadReviewerApplicationScope(organizationId, req.user.id);
        applications = applications.filter((application) => canReviewerAccessApplication(application, reviewerScope));
        if (requestedLimit || requestedCursor) {
          page = paginateApplicationsInMemory(applications, {
            limit: requestedLimit || 50,
            cursor: requestedCursor,
          });
          applications = page.items;
        }
      }

      // Enrich with candidate details
      const candidateIds = applications.map((app) => app.candidateId).filter(Boolean);
      const candidates = await userStore.getSummaries(candidateIds);

      const enriched = applications.map((app) =>
        sanitizeApplication(
          app,
          candidates.get(app.candidateId),
          job,
          null,
          { includeOffer: !reviewerOnly, includeOnboarding: !reviewerOnly },
        ),
      );

      res.json({
        success: true,
        applications: enriched,
        job: {
          id: job.id,
          title: job.title,
          department: job.department,
        },
        pagination: page
          ? {
            limit: requestedLimit || 50,
            nextCursor: page.nextCursor || null,
            hasMore: page.hasMore === true,
          }
          : null,
      });
    } catch (error) {
      logger.error('Get job applications error:', error);
      next(error);
    }
  }

  /**
   * Update application status (recruiter)
   */
  static async updateApplicationStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const requestedInterviewSchedulingMode = parseInterviewSchedulingMode(req.body?.interviewSchedulingMode);
      const hasReviewerAssignmentsOverride = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'reviewerAssignments',
      );
      const userId = req.user.id;
      const organizationId = req.user.organizationContext?.organization?.id;

      if (req.body?.interviewSchedulingMode != null && !requestedInterviewSchedulingMode) {
        return res.status(400).json({
          error: 'Invalid interview scheduling mode',
          details: { allowedModes: [...INTERVIEW_SCHEDULING_MODES] },
        });
      }

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify application belongs to organization
      if (application.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const nextStatus = normalizeApplicationStatus(status);
      const previousStatus = normalizeApplicationStatus(application.status);
      if (!nextStatus) {
        return res.status(400).json({
          error: 'Invalid status value',
          details: { allowedStatuses: APPLICATION_STATUSES },
        });
      }
      if (!canTransitionApplicationStatus(previousStatus, nextStatus, { allowNoop: true })) {
        return res.status(409).json({
          error: `Cannot change application status from ${previousStatus || 'UNKNOWN'} to ${nextStatus}`,
          code: STATUS_TRANSITION_ERROR_CODE,
          details: {
            applicationId: id,
            currentStatus: previousStatus,
            requestedStatus: nextStatus,
            allowedNextStatuses: getAllowedApplicationTransitions(previousStatus),
            isTerminal: isTerminalApplicationStatus(previousStatus),
          },
        });
      }

      if (nextStatus === 'OFFER') {
        const offerReadiness = canMoveInterviewPlanToOffer(application.interviewPlan);
        if (!offerReadiness.allowed) {
          return res.status(409).json({
            error: offerReadiness.reason || 'Complete the interview plan before moving this application to the offer stage.',
            code: offerReadiness.code || STATUS_TRANSITION_ERROR_CODE,
            details: {
              applicationId: id,
              currentStatus: previousStatus,
              requestedStatus: nextStatus,
              blockingStageId: offerReadiness.stage?.id || null,
              blockingStageName: offerReadiness.stage?.name || null,
              blockingStageOutcome: offerReadiness.stage?.outcome || null,
              blockingStageStatus: offerReadiness.stage?.status || null,
            },
          });
        }
      }

      const statusChangedAt = new Date().toISOString();
      const disposition = normalizeDisposition(req.body, {
        status: nextStatus,
        withdrawnBy: null,
        jobDeletedAt: null,
      });
      const isFinalDecision = nextStatus === 'REJECTED' || nextStatus === 'HIRED';
      const statusHistoryEntry = buildStatusHistoryEntry({
        previousStatus,
        status: nextStatus,
        changedAt: statusChangedAt,
        changedBy: userId,
        source: 'RECRUITER_MANUAL',
        note: disposition.notes || disposition.reason || null,
        dispositionCode: disposition.code,
        dispositionCategory: disposition.category,
      });

      let updated = await jobApplicationStore.update(id, {
        status: nextStatus,
        reviewedAt: statusChangedAt,
        reviewedBy: userId,
        statusSource: 'RECRUITER_MANUAL',
        statusChangedAt,
        ...(isFinalDecision
          ? {
            dispositionCode: disposition.code,
            dispositionCategory: disposition.category,
            dispositionReason: disposition.reason,
            dispositionNotes: disposition.notes,
            dispositionTags: disposition.tags,
            dispositionAt: statusChangedAt,
            dispositionBy: userId,
          }
          : {
            dispositionCode: null,
            dispositionCategory: null,
            dispositionReason: null,
            dispositionNotes: null,
            dispositionTags: [],
            dispositionAt: null,
            dispositionBy: null,
          }),
        statusHistory: appendStatusHistory(application.statusHistory, statusHistoryEntry),
      });

      if (nextStatus === 'HIRED') {
        updated = await ensureOnboardingForHiredApplication(updated, {
          actorId: userId,
          actorRole: req.user.organizationContext?.membership?.role || 'ADMIN',
        });
      }

      let validatedReviewerAssignments = undefined;
      if (hasReviewerAssignmentsOverride) {
        const reviewerAssignmentValidation = await validateReviewerAssignmentsForOrganization({
          organizationId,
          reviewerAssignments: req.body?.reviewerAssignments,
        });
        if (!reviewerAssignmentValidation.ok) {
          return res.status(reviewerAssignmentValidation.status || 400).json({
            error: reviewerAssignmentValidation.error,
            code: reviewerAssignmentValidation.code || 'INVALID_REVIEWER_ASSIGNMENTS',
            ...(reviewerAssignmentValidation.details
              ? { details: reviewerAssignmentValidation.details }
              : {}),
          });
        }
        validatedReviewerAssignments = reviewerAssignmentValidation.reviewerAssignments;
      }

      // Log activity
      await activityLogStore.record({
        organizationId,
        actorId: userId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'APPLICATION_STATUS_UPDATED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          status: nextStatus,
          jobId: application.jobId,
          dispositionCode: disposition.code || null,
          dispositionCategory: disposition.category || null,
        },
      });

      logger.info(`Application ${id} status updated to ${nextStatus} by ${userId}`);

      await publishOrganizationRealtimeUpdate(organizationId, 'application-status-updated', {
        applicationId: id,
        jobId: application.jobId || null,
        candidateId: application.candidateId || null,
        status: updated.status || status,
      });
      await publishCandidateRealtimeUpdate(application.candidateId, 'application-status-updated', {
        applicationId: id,
        jobId: application.jobId || null,
        organizationId,
        status: updated.status || status,
      });

      // Send status update email in background.
      const [candidate, job, organization] = await Promise.all([
        userStore.getSummary(application.candidateId),
        jobStore.getById(application.jobId),
        organizationStore.getById(organizationId),
      ]);
      let interviewAutomation = null;
      let interviewAutomationWarning = null;
      if (nextStatus === 'INTERVIEWING' && previousStatus !== 'INTERVIEWING' && job && organization) {
        try {
          interviewAutomation = await ensureInterviewAutomationForInterviewing({
            req,
            application: {
              ...updated,
              id: updated.id || application.id,
              jobId: updated.jobId || application.jobId,
              organizationId: updated.organizationId || application.organizationId,
              candidateId: updated.candidateId || application.candidateId,
              reviewedBy: userId,
            },
            job,
            organization,
            recruiter: req.user,
            candidate,
            interviewSchedulingMode: requestedInterviewSchedulingMode,
            reviewerAssignments: validatedReviewerAssignments,
          });
          if (
            requestedInterviewSchedulingMode !== 'MANUAL'
            && interviewAutomation?.mode === 'AUTO'
            && !interviewAutomation?.scheduled
          ) {
            interviewAutomationWarning = 'No available interview slots matched automation constraints. Schedule manually from the interview workspace.';
          }
          if (interviewAutomation?.warning) {
            interviewAutomationWarning = interviewAutomation.warning;
          }
        } catch (automationError) {
          interviewAutomationWarning = 'Interview automation could not complete automatically. Please review interview scheduling.';
          logger.error('Failed to auto-create/schedule interview after INTERVIEWING transition:', automationError);
        }
      }

      const responseApplication = interviewAutomation?.interview?.id
        ? {
          ...updated,
          interviewId: interviewAutomation.interview.id,
          ...(interviewAutomation?.plan ? { interviewPlan: interviewAutomation.plan } : {}),
        }
        : {
          ...updated,
          ...(interviewAutomation?.plan ? { interviewPlan: interviewAutomation.plan } : {}),
        };
      const shouldNotifyCandidate = previousStatus && previousStatus !== nextStatus;
      if (shouldNotifyCandidate && candidate?.email && job && organization) {
        const statusMessage = buildApplicationStatusEmailMessage({
          status: responseApplication.status,
          previousStatus,
          dispositionReason: responseApplication.dispositionReason || null,
        });
        queueEmailJob({
          type: 'APPLICATION_STATUS_UPDATED',
          payload: {
            applicationId: responseApplication.id,
            candidateId: application.candidateId,
            recipient: candidate.email || null,
            status: responseApplication.status,
          },
          handler: async () => {
            await emailNotifications.sendApplicationStatusUpdated(
              responseApplication,
              candidate,
              job,
              organization,
              statusMessage,
            );
            logger.info(`Status update email sent to ${candidate.email}`);
          },
        });
      }

      res.json({
        success: true,
        application: sanitizeApplication(responseApplication, candidate, job, organization, {
          includeOffer: true,
          includeOnboarding: true,
        }),
        ...(interviewAutomation?.interview
          ? {
            interview: interviewAutomation.interview,
            interviewAutomation: {
              created: Boolean(interviewAutomation.created),
              scheduled: Boolean(interviewAutomation.scheduled),
              slotFound: Boolean(interviewAutomation.slotFound),
              mode: interviewAutomation.mode || null,
              strategy: interviewAutomation.strategy || null,
              currentStage: interviewAutomation.currentStage || null,
              plan: sanitizeInterviewPlanForClient(interviewAutomation.plan),
              scheduleDecision: interviewAutomation.scheduleDecision || null,
            },
          }
          : {}),
        ...(interviewAutomationWarning ? { warning: interviewAutomationWarning } : {}),
      });
    } catch (error) {
      logger.error('Update application status error:', error);
      next(error);
    }
  }

  static async upsertApplicationOffer(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const actorId = req.user.id;
      const actorName = req.user.fullName || req.user.email || null;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      if (application.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (normalizeApplicationStatus(application.status) !== 'OFFER') {
        return res.status(409).json({
          error: 'Application must be in the offer stage before creating an offer.',
          code: STATUS_TRANSITION_ERROR_CODE,
        });
      }

      const offer = buildApplicationOfferPayload(req.body, {
        existing: application.offer,
        actorId,
      });

      if (!offer) {
        return res.status(400).json({ error: 'Invalid offer payload.' });
      }

      if (!offer.startDate || !offer.expiresAt) {
        return res.status(400).json({ error: 'Offer start date and expiry are required.' });
      }

      if (new Date(offer.expiresAt).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Offer expiry must be in the future.' });
      }

      if (new Date(offer.startDate).getTime() > new Date(offer.expiresAt).getTime()) {
        return res.status(400).json({ error: 'Offer start date must be before the offer expiry.' });
      }

      const offerHistory = appendApplicationOfferHistory(
        application.offerHistory,
        buildApplicationOfferHistoryEntry(offer, {
          eventType: application.offer ? 'UPDATED' : 'SENT',
          actorId,
          actorName,
          note: application.offer
            ? 'Offer details were updated.'
            : 'Structured offer was shared with the candidate.',
        }),
      );
      const updated = await jobApplicationStore.update(id, { offer, offerHistory });
      const { candidate, job, organization } = await loadApplicationContext(updated);

      await activityLogStore.record({
        organizationId,
        actorId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'APPLICATION_OFFER_UPSERTED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          status: updated.status,
          candidateId: updated.candidateId,
          jobId: updated.jobId,
          offerStatus: offer.status,
          compensationCurrency: offer.compensationCurrency,
          compensationPeriod: offer.compensationPeriod,
        },
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'application-offer-updated', {
        applicationId: id,
        candidateId: updated.candidateId || null,
        jobId: updated.jobId || null,
        status: updated.status || 'OFFER',
        offerStatus: offer.status,
      });
      await publishCandidateRealtimeUpdate(updated.candidateId, 'application-offer-updated', {
        applicationId: id,
        organizationId,
        jobId: updated.jobId || null,
        status: updated.status || 'OFFER',
        offerStatus: offer.status,
      });

      if (candidate?.email && job && organization) {
        const offerUrl = buildApplicationOfferUrl(updated.id);
        queueEmailJob({
          type: 'APPLICATION_OFFER_SHARED',
          payload: {
            applicationId: updated.id,
            candidateId: updated.candidateId,
            recipient: candidate.email,
            status: updated.status || 'OFFER',
          },
          handler: async () => {
            await emailNotifications.sendApplicationOfferShared(
              updated,
              candidate,
              job,
              organization,
              offerUrl,
              { resent: Boolean(application.offer) },
            );
          },
        });
      }

      return res.json({
        success: true,
        application: sanitizeApplication(updated, candidate, job, organization, { includeOffer: true, includeOnboarding: true }),
        message: 'Offer details saved successfully.',
      });
    } catch (error) {
      logger.error('Upsert application offer error:', error);
      next(error);
    }
  }

  static async resendApplicationOffer(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const actorId = req.user.id;
      const actorName = req.user.fullName || req.user.email || null;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      if (application.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (normalizeApplicationStatus(application.status) !== 'OFFER') {
        return res.status(409).json({ error: 'Only offer-stage applications can resend offers.' });
      }
      if (!isOfferPendingAndActionable(application.offer)) {
        return res.status(409).json({ error: 'Only pending offers can be resent.' });
      }

      const offer = buildResentApplicationOffer(application.offer, { actorId });
      const offerHistory = appendApplicationOfferHistory(
        application.offerHistory,
        buildApplicationOfferHistoryEntry(offer, {
          eventType: 'RESENT',
          actorId,
          actorName,
          note: 'Offer email was resent to the candidate.',
        }),
      );
      const updated = await jobApplicationStore.update(id, { offer, offerHistory });
      const { candidate, job, organization } = await loadApplicationContext(updated);

      await activityLogStore.record({
        organizationId,
        actorId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'APPLICATION_OFFER_RESENT',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          status: updated.status,
          candidateId: updated.candidateId,
          jobId: updated.jobId,
          offerStatus: offer.status,
        },
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'application-offer-updated', {
        applicationId: id,
        candidateId: updated.candidateId || null,
        jobId: updated.jobId || null,
        status: updated.status || 'OFFER',
        offerStatus: offer.status,
      });
      await publishCandidateRealtimeUpdate(updated.candidateId, 'application-offer-updated', {
        applicationId: id,
        organizationId,
        jobId: updated.jobId || null,
        status: updated.status || 'OFFER',
        offerStatus: offer.status,
      });

      if (candidate?.email && job && organization) {
        const offerUrl = buildApplicationOfferUrl(updated.id);
        queueEmailJob({
          type: 'APPLICATION_OFFER_RESENT',
          payload: {
            applicationId: updated.id,
            candidateId: updated.candidateId,
            recipient: candidate.email,
            status: updated.status || 'OFFER',
          },
          handler: async () => {
            await emailNotifications.sendApplicationOfferShared(
              updated,
              candidate,
              job,
              organization,
              offerUrl,
              { resent: true },
            );
          },
        });
      }

      return res.json({
        success: true,
        application: sanitizeApplication(updated, candidate, job, organization, { includeOffer: true, includeOnboarding: true }),
        message: 'Offer email resent successfully.',
      });
    } catch (error) {
      logger.error('Resend application offer error:', error);
      next(error);
    }
  }

  static async acceptApplicationOffer(req, res, next) {
    try {
      const { id } = req.params;
      const candidateId = req.user.id;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      if (application.candidateId !== candidateId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (normalizeApplicationStatus(application.status) !== 'OFFER') {
        return res.status(409).json({ error: 'This application is not in the offer stage.' });
      }

      if (!isOfferPendingAndActionable(application.offer)) {
        return res.status(409).json({ error: 'This offer is no longer available for acceptance.' });
      }

      const acceptedAt = new Date().toISOString();
      const offer = buildAcceptedApplicationOffer(application.offer, { actorId: candidateId });
      const offerHistory = appendApplicationOfferHistory(
        application.offerHistory,
        buildApplicationOfferHistoryEntry(offer, {
          eventType: 'ACCEPTED',
          actorId: candidateId,
          actorName: req.user.fullName || req.user.email || null,
          note: 'Candidate accepted the offer.',
          createdAt: acceptedAt,
        }),
      );
      let updated = await jobApplicationStore.update(id, {
        status: 'HIRED',
        reviewedAt: acceptedAt,
        reviewedBy: candidateId,
        statusSource: 'CANDIDATE_OFFER_ACCEPTED',
        statusChangedAt: acceptedAt,
        dispositionCode: 'HIRED',
        dispositionCategory: 'FINAL_DECISION',
        dispositionReason: 'Candidate accepted the offer.',
        dispositionNotes: null,
        dispositionTags: [],
        dispositionAt: acceptedAt,
        dispositionBy: candidateId,
        statusHistory: appendStatusHistory(
          application.statusHistory,
          buildStatusHistoryEntry({
            previousStatus: application.status,
            status: 'HIRED',
            changedAt: acceptedAt,
            changedBy: candidateId,
            source: 'CANDIDATE_OFFER_ACCEPTED',
            note: 'Candidate accepted the offer.',
            dispositionCode: 'HIRED',
            dispositionCategory: 'FINAL_DECISION',
          }),
        ),
        offer,
        offerHistory,
      });

      updated = await ensureOnboardingForHiredApplication(updated, {
        actorId: candidateId,
        actorRole: 'CANDIDATE',
      });

      const { candidate, job, organization } = await loadApplicationContext(updated);

      await activityLogStore.record({
        organizationId: updated.organizationId,
        actorId: candidateId,
        actorRole: 'CANDIDATE',
        action: 'APPLICATION_OFFER_ACCEPTED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          status: updated.status,
          jobId: updated.jobId,
          candidateId,
        },
      });

      await publishOrganizationRealtimeUpdate(updated.organizationId, 'application-offer-accepted', {
        applicationId: id,
        candidateId,
        jobId: updated.jobId || null,
        status: updated.status,
      });
      await publishCandidateRealtimeUpdate(candidateId, 'application-offer-accepted', {
        applicationId: id,
        organizationId: updated.organizationId || null,
        jobId: updated.jobId || null,
        status: updated.status,
      });

      if (candidate?.email && job && organization) {
        const offerUrl = buildApplicationOfferUrl(updated.id);
        queueEmailJob({
          type: 'APPLICATION_OFFER_ACCEPTED_CANDIDATE',
          payload: {
            applicationId: updated.id,
            candidateId,
            recipient: candidate.email,
          },
          handler: async () => {
            await emailNotifications.sendApplicationOfferAcceptedCandidate(
              updated,
              candidate,
              job,
              organization,
              offerUrl,
            );
          },
        });
      }

      const notificationRecipients = await buildOfferNotificationRecipients(updated.organizationId, null);
      notificationRecipients.forEach((recipient) => {
        queueEmailJob({
          type: 'APPLICATION_OFFER_ACCEPTED_TEAM',
          payload: {
            applicationId: updated.id,
            recipient: recipient.email,
          },
          handler: async () => {
            await emailNotifications.sendApplicationOfferAcceptedHiringTeam(
              updated,
              recipient,
              candidate,
              job,
              organization,
            );
          },
        });
      });

      return res.json({
        success: true,
        application: sanitizeApplication(updated, candidate, job, organization, { includeOffer: true, includeOnboarding: true }),
        message: 'Offer accepted successfully.',
      });
    } catch (error) {
      logger.error('Accept application offer error:', error);
      next(error);
    }
  }

  static async declineApplicationOffer(req, res, next) {
    try {
      const { id } = req.params;
      const candidateId = req.user.id;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      if (application.candidateId !== candidateId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (normalizeApplicationStatus(application.status) !== 'OFFER') {
        return res.status(409).json({ error: 'This application is not in the offer stage.' });
      }

      if (!isOfferPendingAndActionable(application.offer)) {
        return res.status(409).json({ error: 'This offer is no longer available for response.' });
      }

      const declineReason = String(req.body?.declineReason || '').trim() || null;
      const offer = buildDeclinedApplicationOffer(application.offer, {
        actorId: candidateId,
        declineReason,
      });
      const offerHistory = appendApplicationOfferHistory(
        application.offerHistory,
        buildApplicationOfferHistoryEntry(offer, {
          eventType: 'DECLINED',
          actorId: candidateId,
          actorName: req.user.fullName || req.user.email || null,
          note: declineReason || 'Candidate declined the offer.',
        }),
      );
      const updated = await jobApplicationStore.update(id, { offer, offerHistory });
      const { candidate, job, organization } = await loadApplicationContext(updated);

      await activityLogStore.record({
        organizationId: updated.organizationId,
        actorId: candidateId,
        actorRole: 'CANDIDATE',
        action: 'APPLICATION_OFFER_DECLINED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          status: updated.status,
          jobId: updated.jobId,
          candidateId,
          declineReason,
        },
      });

      await publishOrganizationRealtimeUpdate(updated.organizationId, 'application-offer-declined', {
        applicationId: id,
        candidateId,
        jobId: updated.jobId || null,
        status: updated.status,
        offerStatus: offer?.status || 'DECLINED',
      });
      await publishCandidateRealtimeUpdate(candidateId, 'application-offer-declined', {
        applicationId: id,
        organizationId: updated.organizationId || null,
        jobId: updated.jobId || null,
        status: updated.status,
        offerStatus: offer?.status || 'DECLINED',
      });

      if (candidate?.email && job && organization) {
        const offerUrl = buildApplicationOfferUrl(updated.id);
        queueEmailJob({
          type: 'APPLICATION_OFFER_DECLINED_CANDIDATE',
          payload: {
            applicationId: updated.id,
            candidateId,
            recipient: candidate.email,
          },
          handler: async () => {
            await emailNotifications.sendApplicationOfferDeclinedCandidate(
              updated,
              candidate,
              job,
              organization,
              offerUrl,
            );
          },
        });
      }

      const notificationRecipients = await buildOfferNotificationRecipients(updated.organizationId, null);
      notificationRecipients.forEach((recipient) => {
        queueEmailJob({
          type: 'APPLICATION_OFFER_DECLINED_TEAM',
          payload: {
            applicationId: updated.id,
            recipient: recipient.email,
          },
          handler: async () => {
            await emailNotifications.sendApplicationOfferDeclinedHiringTeam(
              updated,
              recipient,
              candidate,
              job,
              organization,
              declineReason,
            );
          },
        });
      });

      return res.json({
        success: true,
        application: sanitizeApplication(updated, candidate, job, organization, { includeOffer: true, includeOnboarding: true }),
        message: 'Offer declined successfully.',
      });
    } catch (error) {
      logger.error('Decline application offer error:', error);
      next(error);
    }
  }

  static async updateApplicationOnboarding(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const actorId = req.user.id;
      const actorRole = req.user.organizationContext?.membership?.role || 'ADMIN';

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      if (application.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (normalizeApplicationStatus(application.status) !== 'HIRED') {
        return res.status(409).json({ error: 'Onboarding is only available after the application is hired.' });
      }

      const existingOnboarding = ensureApplicationOnboarding(application, { actorId, actorRole });
      const onboarding = updateApplicationOnboardingOverview(existingOnboarding, {
        actorId,
        actorRole,
        welcomeNote: Object.prototype.hasOwnProperty.call(req.body || {}, 'welcomeNote') ? req.body.welcomeNote : undefined,
        startDate: Object.prototype.hasOwnProperty.call(req.body || {}, 'startDate') ? req.body.startDate : undefined,
      });

      if (!onboarding) {
        return res.status(400).json({ error: 'Failed to update onboarding details.' });
      }

      const updated = await jobApplicationStore.update(id, { onboarding });
      const { candidate, job, organization } = await loadApplicationContext(updated);

      await activityLogStore.record({
        organizationId,
        actorId,
        actorRole,
        action: 'APPLICATION_ONBOARDING_UPDATED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          candidateId: updated.candidateId || null,
          jobId: updated.jobId || null,
          onboardingStatus: onboarding.status,
        },
      });

      return res.json({
        success: true,
        application: sanitizeApplication(updated, candidate, job, organization, {
          includeOffer: true,
          includeOnboarding: true,
        }),
        message: 'Onboarding details updated successfully.',
      });
    } catch (error) {
      logger.error('Update application onboarding error:', error);
      next(error);
    }
  }

  static async submitApplicationOnboardingTask(req, res, next) {
    try {
      const { id, taskId } = req.params;
      const candidateId = req.user.id;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      if (application.candidateId !== candidateId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (normalizeApplicationStatus(application.status) !== 'HIRED') {
        return res.status(409).json({ error: 'Onboarding is only available after the application is hired.' });
      }

      const onboarding = ensureApplicationOnboarding(application, { actorId: candidateId, actorRole: 'CANDIDATE' });
      const result = submitCandidateOnboardingTask(onboarding, taskId, {
        actorId: candidateId,
        actorRole: 'CANDIDATE',
        note: req.body?.note || null,
      });
      if (!result?.onboarding) {
        return res.status(400).json({ error: result?.error || 'Failed to submit onboarding task.' });
      }

      const updated = await jobApplicationStore.update(id, { onboarding: result.onboarding });
      const { candidate, job, organization } = await loadApplicationContext(updated);

      await activityLogStore.record({
        organizationId: updated.organizationId,
        actorId: candidateId,
        actorRole: 'CANDIDATE',
        action: 'APPLICATION_ONBOARDING_TASK_SUBMITTED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          taskId,
          taskStatus: result.task?.status || null,
          onboardingStatus: result.onboarding.status,
        },
      });

      await publishOrganizationRealtimeUpdate(updated.organizationId, 'application-onboarding-updated', {
        applicationId: id,
        candidateId,
        jobId: updated.jobId || null,
        onboardingStatus: result.onboarding.status,
        taskId,
        taskStatus: result.task?.status || null,
      });
      await publishCandidateRealtimeUpdate(candidateId, 'application-onboarding-updated', {
        applicationId: id,
        organizationId: updated.organizationId || null,
        jobId: updated.jobId || null,
        onboardingStatus: result.onboarding.status,
        taskId,
        taskStatus: result.task?.status || null,
      });

      return res.json({
        success: true,
        application: sanitizeApplication(updated, candidate, job, organization, {
          includeOffer: true,
          includeOnboarding: true,
        }),
        message: result.task?.status === 'SUBMITTED'
          ? 'Task submitted for hiring team review.'
          : 'Onboarding task completed.',
      });
    } catch (error) {
      logger.error('Submit application onboarding task error:', error);
      next(error);
    }
  }

  static async reviewApplicationOnboardingTask(req, res, next) {
    try {
      const { id, taskId } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const actorId = req.user.id;
      const actorRole = req.user.organizationContext?.membership?.role || 'ADMIN';

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      if (application.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (normalizeApplicationStatus(application.status) !== 'HIRED') {
        return res.status(409).json({ error: 'Onboarding is only available after the application is hired.' });
      }

      const onboarding = ensureApplicationOnboarding(application, { actorId, actorRole });
      const result = reviewCompanyOnboardingTask(onboarding, taskId, {
        actorId,
        actorRole,
        status: req.body?.status,
        note: req.body?.note || null,
      });
      if (!result?.onboarding) {
        return res.status(400).json({ error: result?.error || 'Failed to update onboarding task.' });
      }

      const updated = await jobApplicationStore.update(id, { onboarding: result.onboarding });
      const { candidate, job, organization } = await loadApplicationContext(updated);

      await activityLogStore.record({
        organizationId,
        actorId,
        actorRole,
        action: 'APPLICATION_ONBOARDING_TASK_REVIEWED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          taskId,
          taskStatus: result.task?.status || null,
          onboardingStatus: result.onboarding.status,
        },
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'application-onboarding-updated', {
        applicationId: id,
        candidateId: updated.candidateId || null,
        jobId: updated.jobId || null,
        onboardingStatus: result.onboarding.status,
        taskId,
        taskStatus: result.task?.status || null,
      });
      await publishCandidateRealtimeUpdate(updated.candidateId, 'application-onboarding-updated', {
        applicationId: id,
        organizationId,
        jobId: updated.jobId || null,
        onboardingStatus: result.onboarding.status,
        taskId,
        taskStatus: result.task?.status || null,
      });

      return res.json({
        success: true,
        application: sanitizeApplication(updated, candidate, job, organization, {
          includeOffer: true,
          includeOnboarding: true,
        }),
        message: 'Onboarding task updated successfully.',
      });
    } catch (error) {
      logger.error('Review application onboarding task error:', error);
      next(error);
    }
  }

  /**
   * Withdraw application (candidate)
   */
  static async withdrawApplication(req, res, next) {
    try {
      const { id } = req.params;
      const candidateId = req.user.id;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify ownership
      if (application.candidateId !== candidateId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Can't withdraw if already hired or in interview
      if (['HIRED', 'INTERVIEWING'].includes(application.status)) {
        return res.status(400).json({
          error: 'Cannot withdraw application at this stage. Please contact the employer.',
        });
      }
      if (normalizeApplicationStatus(application.status) === 'REJECTED') {
        return res.status(409).json({
          error: 'Application is already closed.',
          code: STATUS_TRANSITION_ERROR_CODE,
          details: {
            currentStatus: normalizeApplicationStatus(application.status),
            requestedStatus: 'REJECTED',
            allowedNextStatuses: getAllowedApplicationTransitions(application.status),
          },
        });
      }

      const withdrawnAt = new Date().toISOString();

      const updated = await jobApplicationStore.update(id, {
        status: 'REJECTED',
        withdrawnBy: candidateId, // Track that this was withdrawn by the candidate
        reviewedAt: withdrawnAt,
        reviewedBy: candidateId,
        statusSource: 'CANDIDATE_WITHDRAWAL',
        statusChangedAt: withdrawnAt,
        dispositionCode: 'CANDIDATE_WITHDREW',
        dispositionCategory: 'CANDIDATE_ACTION',
        dispositionReason: 'Application withdrawn by candidate.',
        dispositionNotes: null,
        dispositionTags: [],
        dispositionAt: withdrawnAt,
        dispositionBy: candidateId,
        statusHistory: appendStatusHistory(
          application.statusHistory,
          buildStatusHistoryEntry({
            previousStatus: application.status,
            status: 'REJECTED',
            changedAt: withdrawnAt,
            changedBy: candidateId,
            source: 'CANDIDATE_WITHDRAWAL',
            note: 'Candidate withdrew application.',
            dispositionCode: 'CANDIDATE_WITHDREW',
            dispositionCategory: 'CANDIDATE_ACTION',
          }),
        ),
      });

      logger.info(`Application ${id} withdrawn by candidate ${candidateId}`);

      await publishOrganizationRealtimeUpdate(application.organizationId, 'application-withdrawn', {
        applicationId: id,
        jobId: application.jobId || null,
        candidateId,
        status: updated.status || 'REJECTED',
      });
      await publishCandidateRealtimeUpdate(candidateId, 'application-withdrawn', {
        applicationId: id,
        jobId: application.jobId || null,
        organizationId: application.organizationId || null,
        status: updated.status || 'REJECTED',
      });

      res.json({
        success: true,
        application: sanitizeApplication(updated, null, null, null, { includeOffer: true }),
        message: 'Application withdrawn successfully',
      });
    } catch (error) {
      logger.error('Withdraw application error:', error);
      next(error);
    }
  }

  /**
   * Get all applications for organization (recruiter dashboard)
   */
  static async getOrganizationApplications(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const reviewerOnly = isReviewerRole(req.user);
      const requestedStatus = parseOptionalStatus(req.query.status);
      const requestedLimit = parseOptionalLimit(req.query.limit) || 50;
      const requestedCursor = req.query.cursor ? String(req.query.cursor).trim() : null;
      const usingPagination = Boolean(requestedCursor || req.query.limit);

      let applications = [];
      let page = null;
      if (reviewerOnly) {
        applications = await jobApplicationStore.listByOrganization(organizationId, null);
        if (requestedStatus) {
          applications = applications.filter(
            (app) => normalizeApplicationStatus(app?.status) === requestedStatus,
          );
        }
      } else if (usingPagination) {
        page = await jobApplicationStore.listByOrganizationPage(organizationId, {
          status: requestedStatus,
          limit: requestedLimit,
          cursor: requestedCursor,
        });
        applications = page.items;
      } else {
        applications = await jobApplicationStore.listByOrganization(organizationId, requestedLimit);
        if (requestedStatus) {
          applications = applications.filter(
            (app) => normalizeApplicationStatus(app?.status) === requestedStatus,
          );
        }
      }

      if (reviewerOnly) {
        const reviewerScope = await loadReviewerApplicationScope(organizationId, req.user.id);
        applications = applications.filter((application) => canReviewerAccessApplication(application, reviewerScope));
        if (usingPagination) {
          page = paginateApplicationsInMemory(applications, {
            limit: requestedLimit,
            cursor: requestedCursor,
          });
          applications = page.items;
        }
      }

      // Enrich with candidate, job, and organization details
      const candidateIds = applications.map((app) => app.candidateId).filter(Boolean);
      const jobIds = applications.map((app) => app.jobId).filter(Boolean);

      const [candidates, jobs, organization] = await Promise.all([
        userStore.getSummaries(candidateIds),
        Promise.all(jobIds.map((id) => jobStore.getById(id))),
        organizationStore.getById(organizationId),
      ]);

      const jobMap = new Map(jobs.filter(Boolean).map((job) => [job.id, job]));

      const enriched = applications.map((app) =>
        sanitizeApplication(
          app,
          candidates.get(app.candidateId),
          jobMap.get(app.jobId),
          organization,
          { includeOffer: !reviewerOnly, includeOnboarding: !reviewerOnly },
        ),
      );

      res.json({
        success: true,
        applications: enriched,
        total: enriched.length,
        pagination: page
          ? {
            limit: requestedLimit,
            nextCursor: page.nextCursor || null,
            hasMore: page.hasMore === true,
          }
          : null,
      });
    } catch (error) {
      logger.error('Get organization applications error:', error);
      next(error);
    }
  }

  /**
   * Bulk update application status (recruiter)
   */
  static async bulkUpdateApplicationStatuses(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const userId = req.user.id;
      const {
        applicationIds = [],
        status,
      } = req.body || {};

      const targetStatus = normalizeApplicationStatus(status);
      if (!targetStatus) {
        return res.status(400).json({
          error: 'Invalid status value',
          details: { allowedStatuses: APPLICATION_STATUSES },
        });
      }

      const dedupedIds = [...new Set(applicationIds.filter(Boolean).map((id) => String(id).trim()))];
      if (dedupedIds.length === 0) {
        return res.status(400).json({ error: 'At least one application ID is required' });
      }

      const fetchedApplications = await Promise.all(
        dedupedIds.map(async (applicationId) => {
          try {
            const application = await jobApplicationStore.getById(applicationId);
            return { applicationId, application, error: null };
          } catch (fetchError) {
            return { applicationId, application: null, error: fetchError };
          }
        }),
      );

      const results = [];
      const updatedApplications = [];
      const statusChangedAt = new Date().toISOString();
      const candidateCache = new Map();
      const jobCache = new Map();
      let organization = null;

      const resolveCandidate = async (candidateId) => {
        if (!candidateId) return null;
        if (candidateCache.has(candidateId)) return candidateCache.get(candidateId);
        const candidate = await userStore.getSummary(candidateId).catch(() => null);
        candidateCache.set(candidateId, candidate);
        return candidate;
      };

      const resolveJob = async (jobId) => {
        if (!jobId) return null;
        if (jobCache.has(jobId)) return jobCache.get(jobId);
        const job = await jobStore.getById(jobId).catch(() => null);
        jobCache.set(jobId, job);
        return job;
      };

      for (const item of fetchedApplications) {
        const { applicationId, application, error } = item;
        if (error) {
          results.push({
            applicationId,
            updated: false,
            reason: 'FETCH_ERROR',
            message: 'Failed to load application.',
          });
          continue;
        }
        if (!application) {
          results.push({
            applicationId,
            updated: false,
            reason: 'NOT_FOUND',
            message: 'Application not found.',
          });
          continue;
        }
        if (application.organizationId !== organizationId) {
          results.push({
            applicationId,
            updated: false,
            reason: 'ACCESS_DENIED',
            message: 'Application does not belong to your organization.',
          });
          continue;
        }

        const previousStatus = normalizeApplicationStatus(application.status);
        if (!canTransitionApplicationStatus(previousStatus, targetStatus, { allowNoop: true })) {
          results.push({
            applicationId,
            updated: false,
            reason: 'INVALID_TRANSITION',
            message: `Cannot transition from ${previousStatus} to ${targetStatus}.`,
            allowedNextStatuses: getAllowedApplicationTransitions(previousStatus),
          });
          continue;
        }

        const disposition = normalizeDisposition(req.body, {
          status: targetStatus,
          withdrawnBy: null,
          jobDeletedAt: null,
        });
        const isFinalDecision = targetStatus === 'REJECTED' || targetStatus === 'HIRED';
        const statusHistoryEntry = buildStatusHistoryEntry({
          previousStatus,
          status: targetStatus,
          changedAt: statusChangedAt,
          changedBy: userId,
          source: 'RECRUITER_BULK',
          note: disposition.notes || disposition.reason || null,
          dispositionCode: disposition.code,
          dispositionCategory: disposition.category,
        });

        let updated = await jobApplicationStore.update(applicationId, {
          status: targetStatus,
          reviewedAt: statusChangedAt,
          reviewedBy: userId,
          statusSource: 'RECRUITER_BULK',
          statusChangedAt,
          ...(isFinalDecision
            ? {
              dispositionCode: disposition.code,
              dispositionCategory: disposition.category,
              dispositionReason: disposition.reason,
              dispositionNotes: disposition.notes,
              dispositionTags: disposition.tags,
              dispositionAt: statusChangedAt,
              dispositionBy: userId,
            }
            : {
              dispositionCode: null,
              dispositionCategory: null,
              dispositionReason: null,
              dispositionNotes: null,
              dispositionTags: [],
              dispositionAt: null,
              dispositionBy: null,
            }),
          statusHistory: appendStatusHistory(application.statusHistory, statusHistoryEntry),
        });

        if (targetStatus === 'HIRED') {
          updated = await ensureOnboardingForHiredApplication(updated, {
            actorId: userId,
            actorRole: req.user.organizationContext?.membership?.role || 'ADMIN',
          });
        }

        let updatedRecord = updated;
        const shouldRunInterviewAutomation = targetStatus === 'INTERVIEWING' && previousStatus !== 'INTERVIEWING';
        let candidate = null;
        let job = null;
        if (shouldRunInterviewAutomation) {
          if (!organization) {
            organization = await organizationStore.getById(organizationId).catch(() => null);
          }
          [candidate, job] = await Promise.all([
            resolveCandidate(updated.candidateId),
            resolveJob(updated.jobId),
          ]);
          if (job && organization) {
            try {
              const interviewAutomation = await ensureInterviewAutomationForInterviewing({
                req,
                application: {
                  ...updated,
                  id: updated.id || application.id,
                  jobId: updated.jobId || application.jobId,
                  organizationId: updated.organizationId || application.organizationId,
                  candidateId: updated.candidateId || application.candidateId,
                  reviewedBy: userId,
                },
                job,
                organization,
                recruiter: req.user,
                candidate,
              });
              if (interviewAutomation?.interview?.id) {
                updatedRecord = {
                  ...updatedRecord,
                  interviewId: interviewAutomation.interview.id,
                  ...(interviewAutomation?.plan ? { interviewPlan: interviewAutomation.plan } : {}),
                };
              }
              if (interviewAutomation?.warning) {
                logger.warn(`Bulk status update interview automation warning for application ${applicationId}: ${interviewAutomation.warning}`);
              }
            } catch (automationError) {
              logger.error(`Bulk status update interview automation failed for application ${applicationId}:`, automationError);
            }
          }
        }

        updatedApplications.push(updatedRecord);
        results.push({
          applicationId,
          updated: true,
          status: updatedRecord.status,
          interviewId: updatedRecord.interviewId || null,
        });

        await publishOrganizationRealtimeUpdate(organizationId, 'application-status-updated', {
          applicationId: updatedRecord.id,
          jobId: updatedRecord.jobId || null,
          candidateId: updatedRecord.candidateId || null,
          status: updatedRecord.status || targetStatus,
        });
        await publishCandidateRealtimeUpdate(updatedRecord.candidateId, 'application-status-updated', {
          applicationId: updatedRecord.id,
          jobId: updatedRecord.jobId || null,
          organizationId,
          status: updatedRecord.status || targetStatus,
        });

        const shouldNotifyCandidate = previousStatus && previousStatus !== targetStatus;
        if (shouldNotifyCandidate) {
          if (!organization) {
            organization = await organizationStore.getById(organizationId).catch(() => null);
          }
          if (!candidate || !job) {
            [candidate, job] = await Promise.all([
              resolveCandidate(updatedRecord.candidateId),
              resolveJob(updatedRecord.jobId),
            ]);
          }
          if (candidate?.email && job && organization) {
            const statusMessage = buildApplicationStatusEmailMessage({
              status: updatedRecord.status,
              previousStatus,
              dispositionReason: updatedRecord.dispositionReason || null,
            });
            queueEmailJob({
              type: 'APPLICATION_STATUS_UPDATED',
              payload: {
                applicationId: updatedRecord.id,
                candidateId: updatedRecord.candidateId,
                recipient: candidate.email || null,
                status: updatedRecord.status,
                source: 'BULK_STATUS_UPDATE',
              },
              handler: async () => {
                await emailNotifications.sendApplicationStatusUpdated(
                  updatedRecord,
                  candidate,
                  job,
                  organization,
                  statusMessage,
                );
                logger.info(`Bulk status update email sent to ${candidate.email}`);
              },
            });
          }
        }
      }

      await activityLogStore.record({
        organizationId,
        actorId: userId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'APPLICATION_STATUS_BULK_UPDATED',
        targetType: 'APPLICATION',
        targetId: null,
        metadata: {
          totalRequested: dedupedIds.length,
          updatedCount: updatedApplications.length,
          targetStatus,
        },
      });

      res.json({
        success: true,
        targetStatus,
        totalRequested: dedupedIds.length,
        updatedCount: updatedApplications.length,
        skippedCount: dedupedIds.length - updatedApplications.length,
        results,
      });
    } catch (error) {
      logger.error('Bulk update application statuses error:', error);
      next(error);
    }
  }
}

