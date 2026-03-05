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
const TERMINAL_INTERVIEW_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
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

const LOCAL_DATE_FORMATTER_CACHE = new Map();

const normalizeInterviewModeType = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean);
};

export const roundToNextScheduleSlot = (date, intervalMinutes = DEFAULT_AUTO_SCHEDULE_SLOT_MINUTES) => {
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  const roundedMs = Math.ceil(date.getTime() / intervalMs) * intervalMs;
  return new Date(roundedMs);
};

export const normalizeIanaTimezone = (value, fallback = DEFAULT_INTERVIEW_TIMEZONE) => {
  const timezone = typeof value === 'string' ? value.trim() : '';
  if (!timezone) return fallback;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return fallback;
  }
};

export const parseIntegerWithinRange = (value, fallback, minimum, maximum = Number.POSITIVE_INFINITY) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

export const parseTimeToMinutes = (value, fallbackMinutes) => {
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

export const normalizeWorkingDays = (value) => {
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

export const parseConflictScope = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ORGANIZATION') return 'ORGANIZATION';
  return DEFAULT_CONFLICT_SCOPE;
};

export const normalizeRecruiterInterviewAvailability = (value = null, fallback = {}) => {
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

export const resolveRecruiterAvailabilityOverrides = (recruiter = null, fallback = {}) => {
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

export const getLocalTimeParts = (date, timezone) => {
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

export const isNonTerminalScheduledInterview = (interview) => {
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

export const findConstraintBasedAutoScheduleSlot = ({ settings, existingInterviews = [] }) => {
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

export const evaluateSlotAgainstInterviewAutomation = ({
  scheduledFor,
  settings,
  existingInterviews = [],
}) => {
  const scheduledMs = Date.parse(scheduledFor);
  if (!Number.isFinite(scheduledMs)) {
    return {
      isValid: false,
      reasonCodes: ['INVALID_DATETIME'],
    };
  }

  const now = new Date();
  now.setSeconds(0, 0);
  const leadStart = new Date(now.getTime() + (settings.leadHours * 60 * 60 * 1000));
  const initialSlot = roundToNextScheduleSlot(leadStart, settings.slotMinutes);
  const slotWindowEndMs = initialSlot.getTime() + (settings.scheduleWindowDays * 24 * 60 * 60 * 1000);
  const workingDays = new Set(settings.workingDays || DEFAULT_WORKING_DAYS);
  const localParts = getLocalTimeParts(new Date(scheduledMs), settings.timezone);
  if (!localParts) {
    return {
      isValid: false,
      reasonCodes: ['INVALID_DATETIME'],
    };
  }

  const {
    indexed: indexedInterviews,
    dailyCounts,
  } = buildScheduledInterviewIndex({
    interviews: existingInterviews,
    timezone: settings.timezone,
    bufferMinutes: settings.bufferMinutes,
  });

  const reasonCodes = [];
  if (scheduledMs < initialSlot.getTime()) {
    reasonCodes.push('TOO_SOON');
  }
  if (scheduledMs > slotWindowEndMs) {
    reasonCodes.push('OUTSIDE_WINDOW');
  }

  const slotStartMinutes = localParts.minutesFromStartOfDay;
  const slotEndMinutes = slotStartMinutes + settings.durationMinutes;
  if (!workingDays.has(localParts.weekday)) {
    reasonCodes.push('NON_WORKING_DAY');
  }
  if (
    slotStartMinutes < settings.businessHoursStartMinutes
    || slotEndMinutes > settings.businessHoursEndMinutes
  ) {
    reasonCodes.push('OUTSIDE_BUSINESS_HOURS');
  }

  const currentDayLoad = dailyCounts.get(localParts.dateKey) || 0;
  if (currentDayLoad >= settings.maxInterviewsPerDay) {
    reasonCodes.push('DAILY_LIMIT_REACHED');
  }

  const durationMs = settings.durationMinutes * 60 * 1000;
  const candidateStartWithBuffer = scheduledMs - (settings.bufferMinutes * 60 * 1000);
  const candidateEndWithBuffer = scheduledMs + durationMs + (settings.bufferMinutes * 60 * 1000);
  const conflict = indexedInterviews.find((entry) => (
    candidateStartWithBuffer < entry.endWithBufferMs
    && candidateEndWithBuffer > entry.startWithBufferMs
  ));
  if (conflict) {
    reasonCodes.push('CONFLICT');
  }

  return {
    isValid: reasonCodes.length === 0,
    reasonCodes,
    conflictInterviewId: conflict?.interviewId || null,
  };
};

export const selectSlotFromPreferredOrAuto = ({
  strategy = 'AUTO',
  preferredSlots = [],
  settings,
  existingInterviews = [],
}) => {
  const normalizedStrategy = String(strategy || '').trim().toUpperCase();
  const evaluations = [];

  if (normalizedStrategy === 'PREFERRED_FIRST') {
    preferredSlots.forEach((slot) => {
      const evaluation = evaluateSlotAgainstInterviewAutomation({
        scheduledFor: slot,
        settings,
        existingInterviews,
      });
      evaluations.push({
        scheduledFor: slot,
        isValid: evaluation.isValid,
        reasonCodes: evaluation.reasonCodes,
      });
    });

    const acceptedPreferred = evaluations.find((entry) => entry.isValid);
    if (acceptedPreferred) {
      return {
        scheduledFor: acceptedPreferred.scheduledFor,
        source: 'PREFERRED_SLOT',
        preferredSlotEvaluations: evaluations,
        slotSearch: null,
      };
    }
  }

  const autoResult = findConstraintBasedAutoScheduleSlot({
    settings,
    existingInterviews,
  });
  return {
    scheduledFor: autoResult.scheduledFor || null,
    source: autoResult.scheduledFor ? 'AUTO_EARLIEST' : null,
    preferredSlotEvaluations: evaluations,
    slotSearch: {
      iterations: autoResult.iterations || 0,
      conflictChecks: autoResult.conflictChecks || 0,
    },
  };
};

export const resolveInterviewAutomationSettings = (organization, job, recruiter = null, options = {}) => {
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
  const meetingLinkTemplate = typeof automation.meetingLinkTemplate === 'string' && automation.meetingLinkTemplate.trim()
    ? automation.meetingLinkTemplate.trim()
    : '';

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
    meetingLinkTemplate,
    availabilitySource: recruiterAvailability ? 'RECRUITER' : 'ORGANIZATION',
  };
};

export const INTERVIEW_SCHEDULING_DEFAULTS = Object.freeze({
  timezone: DEFAULT_INTERVIEW_TIMEZONE,
  leadHours: DEFAULT_AUTO_SCHEDULE_LEAD_HOURS,
  slotMinutes: DEFAULT_AUTO_SCHEDULE_SLOT_MINUTES,
  bufferMinutes: DEFAULT_AUTO_SCHEDULE_BUFFER_MINUTES,
  scheduleWindowDays: DEFAULT_AUTO_SCHEDULE_WINDOW_DAYS,
  maxInterviewsPerDay: DEFAULT_AUTO_SCHEDULE_MAX_INTERVIEWS_PER_DAY,
  workingDays: DEFAULT_WORKING_DAYS,
  conflictScope: DEFAULT_CONFLICT_SCOPE,
});
