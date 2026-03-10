const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKDAY_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

export const toLocalDatetimeValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const roundToNextSlot = (date, slotMinutes = 30) => {
  const slotIntervalMs = Math.max(1, Number(slotMinutes) || 30) * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / slotIntervalMs) * slotIntervalMs);
};

export const formatMinutesOfDay = (minutes) => {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export const formatWorkingDays = (workingDays = []) => {
  if (!Array.isArray(workingDays) || workingDays.length === 0) return 'No working days configured';
  return workingDays
    .map((day) => WEEKDAY_LABELS[Number(day)] || null)
    .filter(Boolean)
    .join(', ');
};

export const getAvailabilitySourceLabel = (constraints) => {
  if (!constraints) return 'Availability';
  if (constraints.availabilitySource === 'RECRUITER') {
    return constraints.assignedRecruiterName
      ? `${constraints.assignedRecruiterName}'s availability`
      : 'Assigned recruiter availability';
  }
  return 'Organization availability';
};

const getAvailabilityScopeLabel = (constraints) => (
  constraints?.availabilitySource === 'RECRUITER'
    ? 'assigned recruiter'
    : 'organization'
);

const formatSlotLabel = (date, timezone) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
};

const getZonedDateParts = (date, timezone) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date).reduce((accumulator, part) => {
      if (part.type !== 'literal') {
        accumulator[part.type] = part.value;
      }
      return accumulator;
    }, {});
    const weekday = WEEKDAY_INDEX[parts.weekday] ?? null;
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    if (!Number.isInteger(weekday) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    return {
      weekday,
      minutesFromStartOfDay: (hour * 60) + minute,
    };
  } catch {
    return null;
  }
};

export const validateManualInterviewSelection = ({
  scheduledFor,
  duration,
  constraints,
  requiresAvailabilityChecks,
} = {}) => {
  const normalizedDate = new Date(scheduledFor);
  if (Number.isNaN(normalizedDate.getTime())) {
    return 'Select a valid interview date and time.';
  }
  if (normalizedDate.getTime() <= Date.now()) {
    return 'Interview date and time must be in the future.';
  }
  if (!requiresAvailabilityChecks) {
    return null;
  }
  if (!constraints) {
    return 'Manual scheduling rules are unavailable right now. Please try again in a moment.';
  }

  const leadHours = Math.max(0, Number(constraints.leadHours) || 0);
  const scheduleWindowDays = Math.max(1, Number(constraints.scheduleWindowDays) || 1);
  const slotMinutes = Math.max(1, Number(constraints.slotMinutes) || 30);
  const effectiveDuration = Math.max(15, Number(duration) || Number(constraints.durationMinutes) || 30);

  const now = new Date();
  now.setSeconds(0, 0);
  const initialSlot = roundToNextSlot(
    new Date(now.getTime() + (leadHours * 60 * 60 * 1000)),
    slotMinutes,
  );
  if (normalizedDate.getTime() < initialSlot.getTime()) {
    return `Selected time must be at least ${leadHours} hour${leadHours === 1 ? '' : 's'} ahead.`;
  }
  if (normalizedDate.getTime() > (initialSlot.getTime() + (scheduleWindowDays * 24 * 60 * 60 * 1000))) {
    return `Selected time must be within the next ${scheduleWindowDays} day${scheduleWindowDays === 1 ? '' : 's'}.`;
  }

  const localParts = getZonedDateParts(normalizedDate, constraints.timezone);
  if (!localParts) {
    return 'Unable to validate the selected time in the configured availability timezone.';
  }

  const workingDays = new Set(Array.isArray(constraints.workingDays) ? constraints.workingDays : []);
  if (workingDays.size > 0 && !workingDays.has(localParts.weekday)) {
    return `Selected time falls outside the ${getAvailabilityScopeLabel(constraints)} working days.`;
  }

  const businessHoursStartMinutes = Number(constraints.businessHoursStartMinutes);
  const businessHoursEndMinutes = Number(constraints.businessHoursEndMinutes);
  const slotStartMinutes = localParts.minutesFromStartOfDay;
  const slotEndMinutes = slotStartMinutes + effectiveDuration;
  if (
    Number.isFinite(businessHoursStartMinutes)
    && Number.isFinite(businessHoursEndMinutes)
    && (
      slotStartMinutes < businessHoursStartMinutes
      || slotEndMinutes > businessHoursEndMinutes
    )
  ) {
    return `Selected time must be within ${formatMinutesOfDay(businessHoursStartMinutes)}-${formatMinutesOfDay(businessHoursEndMinutes)} ${constraints.timezone || 'UTC'}.`;
  }

  return null;
};

export const buildManualWindowBounds = (constraints) => {
  if (!constraints) return null;
  const leadHours = Math.max(0, Number(constraints.leadHours) || 0);
  const scheduleWindowDays = Math.max(1, Number(constraints.scheduleWindowDays) || 1);
  const slotMinutes = Math.max(1, Number(constraints.slotMinutes) || 30);

  const now = new Date();
  now.setSeconds(0, 0);
  const minimumDate = roundToNextSlot(
    new Date(now.getTime() + (leadHours * 60 * 60 * 1000)),
    slotMinutes,
  );
  const maximumDate = new Date(minimumDate.getTime() + (scheduleWindowDays * 24 * 60 * 60 * 1000));

  return {
    minimumDate,
    maximumDate,
    slotMinutes,
  };
};

export const buildSuggestedManualSlots = ({
  constraints,
  duration,
  requiresAvailabilityChecks,
  count = 4,
} = {}) => {
  if (!constraints || !requiresAvailabilityChecks) return [];

  const bounds = buildManualWindowBounds(constraints);
  if (!bounds) return [];

  const suggestions = [];
  const slotStepMs = bounds.slotMinutes * 60 * 1000;
  const maxIterations = Math.ceil((bounds.maximumDate.getTime() - bounds.minimumDate.getTime()) / slotStepMs) + 1;

  for (let index = 0; index < maxIterations && suggestions.length < count; index += 1) {
    const candidateDate = new Date(bounds.minimumDate.getTime() + (index * slotStepMs));
    const candidateValue = toLocalDatetimeValue(candidateDate);
    const validationMessage = validateManualInterviewSelection({
      scheduledFor: candidateValue,
      duration,
      constraints,
      requiresAvailabilityChecks,
    });
    if (!validationMessage) {
      suggestions.push({
        value: candidateValue,
        localLabel: formatSlotLabel(candidateDate),
        availabilityLabel: formatSlotLabel(candidateDate, constraints.timezone || 'UTC'),
      });
    }
  }

  return suggestions;
};
